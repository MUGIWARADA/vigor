#!/usr/bin/env node
/**
 * Fit the engine's movement to a description built from video.
 *
 *   # 1. video -> tracks (python, see vision/)
 *   python3 vision/track.py --clip match.mp4 --corners ... --out match-tracks.json
 *   python3 vision/build_movement.py --tracks match-tracks.json --out movement-target.json
 *
 *   # 2. targets -> fitted model (this script)
 *   npm run fit -- --target movement-target.json --out movement-model.json
 *
 *   # 3. play with it
 *   npm run match -- --motion movement-model.json --repeat 8 --minutes 12
 *
 * The fit writes down its own before/after error, because "it learned" is a
 * claim and claims need a number.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { runMatch, parseMatchRequest } from '../src/game/open'
import { fitMotion, targetFromPipeline } from '../src/game/motion-fit'
import { movementStats, type MovementStats } from '../src/game/motion'
import { createDefaultPlan } from '../src/game/data'

const argv = process.argv.slice(2)
const flags: Record<string, string> = {}
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i]!
  if (!arg.startsWith('--')) continue
  flags[arg.slice(2)] = argv[i + 1] ?? ''
  i += 1
}

if (!flags.target) {
  console.error(`usage: npm run fit -- --target movement-target.json [--out movement-model.json]
                  [--minutes 6] [--seed 8100] [--rounds 2] [--candidates 5]`)
  process.exit(2)
}

const pipeline = JSON.parse(readFileSync(flags.target, 'utf8'))
const target = targetFromPipeline(pipeline) as Partial<MovementStats>
if (!target.defence && !target.midfield && !target.attack) {
  console.error('target file has no groups — was it built by vision/build_movement.py?')
  process.exit(1)
}

const parsed = parseMatchRequest({ seed: Number(flags.seed ?? 8100), minutes: 12 })
if (!parsed.ok) {
  console.error(parsed.errors.join('\n'))
  process.exit(1)
}

const config = {
  homePlan: createDefaultPlan('bracelonia'),
  awayPlan: createDefaultPlan('banyarn'),
  difficulty: 'normal' as const,
  rules: 'standard' as const,
  halfSeconds: 360,
  humanTeams: [],
  seed: Number(flags.seed ?? 8100),
}

const quiet = flags.quiet === '1' || flags.quiet === 'true'
const started = Date.now()
const result = fitMotion(target, config, {
  minutes: Number(flags.minutes ?? 6),
  seed: Number(flags.seed ?? 8100),
  rounds: Number(flags.rounds ?? 2),
  candidates: Number(flags.candidates ?? 5),
  onEvaluate: quiet ? undefined : (label, error) => {
    process.stderr.write(`  ${label.padEnd(28)} error ${error.toFixed(4)}\n`)
  },
})

const improved = result.before > 0 ? (1 - result.after / result.before) * 100 : 0
console.log(`movement fit ${target.defence ? 'from video' : ''}: error ${result.before.toFixed(4)} -> ${result.after.toFixed(4)} (${improved.toFixed(1)}% closer)`)
for (const [line, prior] of Object.entries(result.model.lines)) {
  if (!prior) continue
  const want = (target as Record<string, { advanceX?: number; spreadY?: number }>)[line] ?? {}
  const got = (result.measured as unknown as Record<string, { advanceX: number; spreadY: number }>)[line]
  console.log(`  ${line.padEnd(9)} depth ${prior.depthM >= 0 ? '+' : ''}${prior.depthM.toFixed(2)} m   width x${prior.widthScale.toFixed(3)}` +
    (want.advanceX !== undefined ? `   advance ${got.advanceX.toFixed(1)} vs ${want.advanceX.toFixed(1)}   spread ${got.spreadY.toFixed(1)} vs ${want.spreadY!.toFixed(1)}` : ''))
}

if (result.after >= result.before) {
  console.error('\nthe fit found nothing better than the current roles — the model is still written, with the identity priors')
}

const payload = {
  ...result.model,
  source: {
    ...result.model.source,
    clip: pipeline.source?.clip,
    seconds: pipeline.source?.seconds,
    errorBefore: Math.round(result.before * 1000) / 1000,
    errorAfter: Math.round(result.after * 1000) / 1000,
    matches: result.model.source.matches,
  },
}

if (flags.out) {
  writeFileSync(flags.out, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`wrote ${flags.out} in ${((Date.now() - started) / 1000).toFixed(0)}s`)
} else {
  console.log(JSON.stringify(payload, null, 2))
}

// A fit is only believable if the thing it changed is visible afterwards.
if (flags.compare === '1' || flags.compare === 'true') {
  const plain = runMatch({ ...parsed.request!, minutes: Number(flags.minutes ?? 6) })
  const withModel = runMatch({ ...parsed.request!, minutes: Number(flags.minutes ?? 6), motion: payload as never })
  console.log(`before: ${Math.round(plain.players.reduce((s, p) => s + p.distance, 0))} m covered by 22 players`)
  console.log(`after : ${Math.round(withModel.players.reduce((s, p) => s + p.distance, 0))} m covered by 22 players`)
  void movementStats
}
