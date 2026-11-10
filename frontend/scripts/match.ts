#!/usr/bin/env node
/**
 * Run a match from the command line.
 *
 *   npm run match -- --seed 8100 --minutes 12
 *   npm run match -- --home bracelonia --away banyarn --json > match.json
 *   npm run match -- --request request.json --json
 *
 * This is the whole "open" claim in one file: the engine does not need React,
 * Vite, a browser or a screen to play a match. Anything that can run a command
 * can now drive the game and read the result.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import {
  DEFAULT_REQUEST,
  aggregateResults,
  describeAggregate,
  describeResult,
  parseMatchRequest,
  resultJson,
  runMatch,
  TEAM_IDS,
} from '../src/game/open'

function usage(): string {
  return `touchline match — run one match of the engine, headless

  npm run match -- [options]

Options
  --seed <n>          deterministic seed (default ${DEFAULT_REQUEST.seed})
  --minutes <n>       minutes of simulated play, 1-120 (default ${DEFAULT_REQUEST.minutes})
  --home <team>       home side: ${TEAM_IDS.join(' | ')} (default bracelonia)
  --away <team>       away side (default banyarn)
  --difficulty <d>    easy | normal | hard | real
  --rules <r>         arcade | standard | current
  --request <file>    read the whole request from JSON instead of flags
  --repeat <n>        run n matches, seeds from --seed upward, and aggregate
  --motion <file>     play with movement learned from video (docs/motion-learning.md)
  --trace <file>      write per-frame positions in the pipeline's tracks schema
  --out <file>        write the result here instead of stdout
  --json              machine-readable JSON (default is a text summary)
  --help              this text

Engine time, not match time: --minutes 12 is twelve minutes of play.
Same seed and same request give byte-identical JSON.`
}

const argv = process.argv.slice(2)
const flags: Record<string, string | boolean> = {}
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i]!
  if (!arg.startsWith('--')) {
    console.error(`unexpected argument: ${arg}`)
    process.exit(2)
  }
  const key = arg.slice(2)
  const next = argv[i + 1]
  if (next && !next.startsWith('--')) {
    flags[key] = next
    i += 1
  } else {
    flags[key] = true
  }
}

if (flags.help) {
  console.log(usage())
  process.exit(0)
}

const request: Record<string, unknown> = flags.request
  ? JSON.parse(readFileSync(String(flags.request), 'utf8'))
  : {
      seed: flags.seed !== undefined ? Number(flags.seed) : DEFAULT_REQUEST.seed,
      minutes: flags.minutes !== undefined ? Number(flags.minutes) : DEFAULT_REQUEST.minutes,
      home: flags.home ?? 'bracelonia',
      away: flags.away ?? 'banyarn',
      difficulty: flags.difficulty,
      rules: flags.rules,
    }
for (const key of ['difficulty', 'rules', 'mode'] as const) {
  if (request[key] === undefined) delete request[key]
}
if (flags.motion) {
  request.motion = JSON.parse(readFileSync(String(flags.motion), 'utf8'))
}

const parsed = parseMatchRequest(request)
if (!parsed.ok || !parsed.request) {
  console.error('the request was refused:')
  for (const error of parsed.errors) console.error(`  - ${error}`)
  process.exit(1)
}

const repeat = flags.repeat === undefined ? 1 : Number(flags.repeat)
if (!Number.isInteger(repeat) || repeat < 1) {
  console.error(`--repeat: expected a whole number of 1 or more, got ${String(flags.repeat)}`)
  process.exit(1)
}

if (flags.trace) {
  const { collectTracks } = await import('../src/game/motion-fit')
  const tracks = collectTracks({
    ...parsed.request,
    homePlan: (await import('../src/game/data')).createDefaultPlan(parsed.request.home.team),
    awayPlan: (await import('../src/game/data')).createDefaultPlan(parsed.request.away.team),
    halfSeconds: (parsed.request.minutes * 60) / 2,
    humanTeams: [],
    seed: parsed.request.seed,
  }, parsed.request.minutes, Number(flags.hz ?? 5))
  writeFileSync(String(flags.trace), JSON.stringify(tracks))
  console.error(`wrote ${tracks.frames.length} frames to ${flags.trace}`)
}

const started = Date.now()

// A batch is just n seeds: same request, seed advanced by one each time, so a
// run can be reproduced from its first seed and its length.
const results = Array.from({ length: repeat }, (_, i) =>
  runMatch({ ...parsed.request!, seed: parsed.request!.seed + i }))

const output = repeat === 1
  ? (flags.json ? resultJson(results[0]!) : describeResult(results[0]!))
  : flags.json
    ? resultJson({ engine: results[0]!.engine, request: results[0]!.request, matches: results, aggregate: aggregateResults(results) })
    : [describeAggregate(aggregateResults(results)), '', ...results.map(describeResult)].join('\n')

if (flags.out) {
  writeFileSync(String(flags.out), output.endsWith('\n') ? output : `${output}\n`)
  if (!flags.json) console.log(output)
  console.error(`wrote ${flags.out} in ${((Date.now() - started) / 1000).toFixed(1)}s`)
} else {
  console.log(output)
}
