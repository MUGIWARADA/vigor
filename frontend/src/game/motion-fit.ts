/**
 * Fitting the engine to a movement description.
 *
 * Kept out of `motion.ts` on purpose: this file imports the engine, and the
 * engine imports `motion.ts`. One direction only, so there is no cycle.
 *
 * The fit is a coordinate descent over six numbers — metres of depth and a lane
 * width multiplier for each of the three lines — scored by how closely the
 * simulated movement matches the video's own seven statistics. Every candidate
 * is a real simulated match, not a gradient step through a surrogate: we can
 * afford it because a match is a couple of seconds, and because the thing being
 * optimised is the thing being reported.
 */
import {
  createMatch,
  resumeSecondHalf,
  stepMatch,
  type MatchConfig,
  type MatchState,
} from './engine'
import { lineOfPosition, movementError, movementStats, type Line, type LinePrior, type MotionModel, type MovementStats, type TracksDocument, LINES, MOTION_VERSION } from './motion'

export interface FitOptions {
  /** Minutes of play per evaluation. Shorter is noisier and faster. */
  minutes?: number
  seed?: number
  /** Coordinate-descent sweeps. More rounds, smaller returns. */
  rounds?: number
  /** Candidate values tried per parameter per round. */
  candidates?: number
  /** Sample rate of the tracks the engine writes, Hz. */
  sampleHz?: number
  /** Called after each evaluation, for a CLI that wants to show progress. */
  onEvaluate?: (label: string, error: number) => void
}

/** Play a match and record where everyone was, in the pipeline's schema. */
export function collectTracks(config: MatchConfig, minutes: number, sampleHz = 5): TracksDocument {
  const state: MatchState = createMatch({ ...config, halfSeconds: (minutes * 60) / 2, humanTeams: [] })
  const step = 0.05
  const every = Math.max(1, Math.round(1 / (sampleHz * step)))
  const frames: TracksDocument['frames'] = []
  const teamName = (teamId: string) => (teamId === config.homePlan.teamId ? 'home' : 'away')

  let guard = 0
  let tick = 0
  const limit = (minutes * 60) / step + 6000
  while (state.phase !== 'fulltime' && guard < limit) {
    if (state.phase === 'halftime') resumeSecondHalf(state)
    stepMatch(state, {}, step)
    guard += 1
    if (tick % every === 0) {
      frames.push({
        t: Math.round((tick * step) * 1000) / 1000,
        players: state.players
          .filter((p) => p.onPitch)
          .map((p) => ({
            id: p.id, team: teamName(p.teamId), x: p.pos.x, y: p.pos.y,
            line: lineOfPosition(p.slotPosition) ?? undefined,
          })),
      })
    }
    tick += 1
  }

  return { source: 'engine', fps: sampleHz, pitch: { length: 105, width: 68 }, frames }
}

export interface FitResult {
  model: MotionModel
  before: number
  after: number
  measured: MovementStats
}

/**
 * Fit the six numbers to a movement description.
 *
 * Note the honest limit: it is fitted on one seed over a short match, so it fits
 * *that* match's movement, not football's. Widen `seed`/`minutes` to trade time
 * for a fit that is less of a coincidence.
 */
export function fitMotion(
  target: Partial<MovementStats>,
  config: MatchConfig,
  options: FitOptions = {},
): FitResult {
  const minutes = options.minutes ?? 6
  const seed = options.seed ?? config.seed ?? 8100
  const rounds = options.rounds ?? 2
  const candidates = options.candidates ?? 5
  const sampleHz = options.sampleHz ?? 5

  const measure = (lines: Partial<Record<Line, LinePrior>>) => {
    const tracks = collectTracks(
      { ...config, seed, motion: { version: MOTION_VERSION, source: {}, lines } },
      minutes,
      sampleHz,
    )
    const stats = movementStats(tracks, true)
    return stats
  }

  const start: Partial<Record<Line, LinePrior>> = {}
  for (const line of LINES) start[line] = { depthM: 0, widthScale: 1 }

  const first = measure(start)
  const before = movementError(first, target)
  options.onEvaluate?.('baseline', before)

  let best = start
  let bestError = before
  let bestStats = first

  // Bounds are part of the method, not a detail: a fit that is free to say "this
  // line plays twelve metres deeper and half as wide" will say it to win a
  // hundredth of error, and no manager would recognise the result. The engine
  // is being nudged toward footage, not replaced by it.
  const DEPTH_MIN = -8, DEPTH_MAX = 8
  const WIDTH_MIN = 0.75, WIDTH_MAX = 1.35
  const span = 8
  for (let round = 0; round < rounds; round += 1) {
    const reach = span / (round + 1)
    for (const line of LINES) {
      for (const key of ['depthM', 'widthScale'] as const) {
        const centre = best[line]![key]
        const values = Array.from({ length: candidates }, (_, i) => {
          const frac = candidates === 1 ? 0 : (i / (candidates - 1)) * 2 - 1
          const raw = key === 'depthM'
            ? centre + frac * reach
            : centre + frac * (reach / span) * 0.45
          return key === 'depthM'
            ? Math.min(DEPTH_MAX, Math.max(DEPTH_MIN, raw))
            : Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, raw))
        })
        for (const value of values) {
          const candidate: Partial<Record<Line, LinePrior>> = { ...best, [line]: { ...best[line]!, [key]: value } }
          const stats = measure(candidate)
          const error = movementError(stats, target)
          options.onEvaluate?.(`${line}.${key}=${value.toFixed(2)}`, error)
          if (error < bestError - 1e-4) {
            bestError = error
            best = candidate
            bestStats = stats
          }
        }
      }
    }
  }

  return {
    model: {
      version: MOTION_VERSION,
      source: {
        clip: undefined,
        errorBefore: Math.round(before * 1000) / 1000,
        errorAfter: Math.round(bestError * 1000) / 1000,
        matches: (rounds * LINES.length * 2 * candidates) + 1,
      },
      lines: Object.fromEntries(Object.entries(best).map(([line, prior]) => [
        line,
        {
          depthM: Math.round((prior!.depthM / 0.25)) * 0.25,
          widthScale: Math.round(prior!.widthScale * 100) / 100,
          target: (target as Record<string, { advanceX?: number; spreadY?: number }>)[line],
        },
      ])) as MotionModel['lines'],
    },
    before,
    after: bestError,
    measured: bestStats,
  }
}

/** Pull the target description out of `vision/build_movement.py`'s output. */
export function targetFromPipeline(pipeline: { groups?: Record<string, unknown> }): Partial<MovementStats> {
  return (pipeline.groups ?? {}) as Partial<MovementStats>
}

/** Group line membership is a property of a slot, exposed here for tools. */
export { lineOfPosition }
