/**
 * Movement learning.
 *
 * The engine has always moved players by role: a Holding midfielder holds
 * because `RoleProfile.supportOnly` says so. This file is how those roles get
 * *fitted to a video* instead of to my opinion.
 *
 * Three pieces, in order:
 *
 *  1. `TracksDocument` — the one schema both a video tracker and the engine
 *     itself can produce: per frame, per player, a position in pitch metres.
 *     (`vision/track.py` writes it; `collectTracks` in `motion-fit.ts` does too.)
 *  2. `movementStats` — seven numbers per line of a team, computed by one
 *     implementation from either source. That identity is the whole trick:
 *     comparing video to simulation is only honest if the same code measures
 *     both.
 *  3. `withMotionPrior` — a learned prior nudges the role that drives the
 *     movement. It is a small, legible adjustment, not a black box: metres of
 *     depth and a multiplier on lane width, per line.
 *
 * What this is not: a neural policy. It is system identification — measure what
 * the video does, then ask the engine's parameters to reproduce it. See
 * `docs/motion-learning.md` for why that is the right shape for a rule-based
 * engine and where it stops.
 */
import type { RoleProfile } from './roles'
import type { PositionCode } from './data'

export const MOTION_VERSION = 1 as const

/** The three lines a fixed camera can honestly infer. */
export type Line = 'defence' | 'midfield' | 'attack'

export const LINES: Line[] = ['defence', 'midfield', 'attack']

export interface TrackPlayer {
  id: string
  team: string
  x: number
  y: number
  /**
   * Which line this player belongs to, when the source knows. The engine does;
   * a camera does not, and there the lines are inferred by rank instead. The
   * field exists so a fitted model cannot game the grouping: if the engine's
   * lines were re-inferred from position, a wider defence would be reclassified
   * as a midfield and the measurement would move without anyone moving.
   */
  line?: Line
}

export interface TrackFrame {
  t: number
  players: TrackPlayer[]
}

/** Positions in pitch metres. The interface the whole system speaks. */
export interface TracksDocument {
  source?: string
  fps: number
  pitch: { length: number; width: number }
  frames: TrackFrame[]
}

export interface GroupStats {
  /** Mean position up the pitch, in the attacking frame, metres from own goal. */
  lineX: number
  /** Standard deviation of that position: how much the line travels. */
  advanceX: number
  /** Standard deviation across the pitch: how wide the line lives. */
  spreadY: number
  speed: number
  sprintShare: number
  runLength: number
  curvature: number
  players: number
  samples: number
}

export type MovementStats = Record<Line, GroupStats>

/** A fitted prior for one line. Two numbers, both in the engine's own units. */
export interface LinePrior {
  /** Metres added to the role's depth when in possession. */
  depthM: number
  /** Multiplier on the role's lane width. */
  widthScale: number
  /** What the fit was trying to reproduce, for anyone reading the file later. */
  target?: Partial<GroupStats>
}

export interface MotionModel {
  version: typeof MOTION_VERSION
  /** Where the numbers came from. A model without provenance is a rumour. */
  source: {
    clip?: string
    seconds?: number
    fittedAt?: string
    /** Relative error before and after the fit: the evidence it did anything. */
    errorBefore?: number
    errorAfter?: number
    matches?: number
  }
  lines: Partial<Record<Line, LinePrior>>
}

/** Which line a slot belongs to. Goalkeepers are not part of this. */
export function lineOfPosition(pos: PositionCode): Line | null {
  switch (pos) {
    case 'GK': return null
    case 'LB': case 'LCB': case 'CB': case 'RCB': case 'RB': case 'LWB': case 'RWB': return 'defence'
    case 'DM': case 'LDM': case 'RDM': case 'LM': case 'LCM': case 'CM': case 'RCM': case 'RM': case 'CAM': return 'midfield'
    default: return 'attack'
  }
}

/**
 * Apply a learned prior to a role.
 *
 * Deliberately marginal: the prior cannot invent a behaviour the role does not
 * have, it can only say "this job, as played by the side in the video, sits
 * four metres higher and stays a fifth wider". Anything more would be the model
 * quietly overruling the tactic sheet the manager set.
 */
export function withMotionPrior(profile: RoleProfile, prior: LinePrior | undefined): RoleProfile {
  if (!prior) return profile
  const depthM = Number.isFinite(prior.depthM) ? clamp(prior.depthM, -12, 12) : 0
  const widthScale = Number.isFinite(prior.widthScale) ? clamp(prior.widthScale, 0.6, 1.6) : 1
  return {
    ...profile,
    depth: profile.depth + depthM,
    width: profile.width * widthScale,
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const SPRINT = 5.5
const SPEED_MIN = 2.0
const RUN_MIN_M = 3.0

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0)
const std = (values: number[]) => {
  if (values.length < 2) return 0
  const m = mean(values)
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)))
}

type Sample = { t: number; ax: number; ay: number }

/**
 * The seven numbers, from any tracks document.
 *
 * Lines are inferred by rank, not supplied: each side's players are ordered by
 * mean position up the pitch and split into three equal groups. A video does not
 * know who is a centre-back and neither does this; it knows who stands deepest.
 */
export function movementStats(tracks: TracksDocument, homeAttacksRight = true): MovementStats {
  const pitchW = tracks.pitch.length
  const pitchH = tracks.pitch.width
  const byTeamPlayer = new Map<string, { team: string; samples: Sample[] }>()

  for (const frame of tracks.frames) {
    for (const player of frame.players) {
      const attacksRight = player.team === 'home' ? homeAttacksRight : !homeAttacksRight
      const ax = attacksRight ? player.x : pitchW - player.x
      const ay = attacksRight ? player.y : pitchH - player.y
      const key = `${player.team}:${player.id}`
      let entry = byTeamPlayer.get(key)
      if (!entry) {
        entry = { team: player.team, samples: [] }
        byTeamPlayer.set(key, entry)
      }
      entry.samples.push({ t: frame.t, ax, ay })
    }
  }

  const grouped: Record<Line, Sample[][]> = { defence: [], midfield: [], attack: [] }

  // Lines the source declared for itself win over lines inferred from position.
  const declared = new Map<string, Line>()
  for (const frame of tracks.frames) {
    for (const player of frame.players) {
      if (player.line) declared.set(`${player.team}:${player.id}`, player.line)
    }
  }

  for (const team of new Set([...byTeamPlayer.values()].map((v) => v.team))) {
    const players = [...byTeamPlayer.entries()].filter(([, v]) => v.team === team && v.samples.length > 4)
    if (!players.length) continue
    // The engine declares a line for every outfield player; a keeper declares
    // none and is not part of any line. Mixed sources fall back to rank.
    const declaredCount = players.filter(([key]) => declared.has(key)).length
    if (declaredCount >= Math.ceil(players.length * 0.8)) {
      for (const [key, value] of players) {
        const line = declared.get(key)
        if (line) grouped[line].push(value.samples)
      }
      continue
    }
    // Rank by where they live, deepest first; equal thirds of the squad.
    const ranked = players
      .map(([, v]) => v)
      .sort((a, b) => mean(a.samples.map((s) => s.ax)) - mean(b.samples.map((s) => s.ax)))
    const size = Math.max(1, Math.floor(ranked.length / 3))
    const chunks = [ranked.slice(0, size), ranked.slice(size, size * 2), ranked.slice(size * 2)]
    chunks.forEach((chunk, index) => grouped[LINES[index]!]!.push(...chunk.map((c) => c.samples)))
  }

  const out = {} as MovementStats
  for (const line of LINES) {
    const series = grouped[line]
    const xs = series.flat().map((s) => s.ax)
    const ys = series.flat().map((s) => s.ay)
    const speeds: number[] = []
    const runLengths: number[] = []
    const curvatures: number[] = []

    for (const samples of series) {
      for (let i = 1; i < samples.length; i += 1) {
        const a = samples[i - 1]!
        const b = samples[i]!
        const step = Math.hypot(b.ax - a.ax, b.ay - a.ay)
        speeds.push(step / Math.max(1e-3, b.t - a.t))
      }
      // Runs: contiguous samples moving at running pace, closed at any pause.
      let run: Sample[] = []
      const close = () => {
        if (run.length > 1) {
          const length = run.reduce((sum, s, i) => (i === 0 ? 0 : sum + Math.hypot(s.ax - run[i - 1]!.ax, s.ay - run[i - 1]!.ay)), 0)
          const chord = Math.hypot(run[run.length - 1]!.ax - run[0]!.ax, run[run.length - 1]!.ay - run[0]!.ay)
          if (length >= RUN_MIN_M) {
            runLengths.push(length)
            curvatures.push(chord > 0.5 ? length / chord : 1)
          }
        }
        run = []
      }
      for (let i = 1; i < samples.length; i += 1) {
        const a = samples[i - 1]!
        const b = samples[i]!
        const speed = Math.hypot(b.ax - a.ax, b.ay - a.ay) / Math.max(1e-3, b.t - a.t)
        if (speed >= SPEED_MIN) {
          // Start the run at a, not b: otherwise every run is one step short and
          // a twelve-metre run is recorded as ten point eight.
          if (!run.length) run.push(a)
          run.push(b)
        } else close()
      }
      close()
    }

    out[line] = {
      lineX: round(mean(xs), 2),
      advanceX: round(std(xs), 2),
      spreadY: round(std(ys), 2),
      speed: round(mean(speeds), 2),
      sprintShare: round(speeds.length ? speeds.filter((s) => s >= SPRINT).length / speeds.length : 0, 3),
      runLength: round(mean(runLengths), 2),
      curvature: round(mean(curvatures) || 1, 3),
      players: series.length,
      samples: xs.length,
    }
  }
  return out
}

function round(v: number, dp: number) {
  const f = 10 ** dp
  return Math.round(v * f) / f
}

/** How far apart two movement descriptions are, as one number. */
export function movementError(measured: MovementStats, target: Partial<MovementStats>): number {
  const terms: number[] = []
  for (const line of LINES) {
    const want = target[line]
    const got = measured[line]
    if (!want || !got) continue
    for (const key of ['advanceX', 'spreadY', 'lineX'] as const) {
      const w = want[key]
      if (typeof w !== 'number' || w <= 0) continue
      terms.push(Math.abs(got[key] - w) / w)
    }
  }
  return terms.length ? terms.reduce((a, b) => a + b, 0) / terms.length : 0
}
