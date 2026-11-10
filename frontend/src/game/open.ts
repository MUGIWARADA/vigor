/**
 * Open match system — the engine without the game around it.
 *
 * One request in, one result out. No React, no browser, no clock, no canvas:
 * `runMatch()` takes a seed and two sides and returns a JSON-shaped record of
 * everything that happened. That is what makes the engine *open* — a script, a
 * test, a spreadsheet or an outside agent can drive a match and read the same
 * numbers the report screen reads, without knowing anything about the UI.
 *
 * Two rules hold this file together:
 *
 *  1. **Determinism.** The same request must produce byte-identical JSON, on
 *     any machine, forever. Nothing here reads the clock, the filesystem or
 *     Math.random, and `resultJson()` sorts keys so object order cannot leak in.
 *  2. **Engine time is not match time.** `minutes` is minutes of simulated
 *     play. A twelve-minute request is a twelve-minute request, not "a match
 *     shortened to twelve minutes of a ninety-minute clock".
 */
import { createDefaultPlan, getTeam, type TeamId, type TeamPlan } from './data'
import type { MotionModel } from './motion'
import {
  playerRating,
  simulateMatch,
  type Difficulty,
  type MatchEvent,
  type MatchMode,
  type MatchState,
  type RulesProfile,
  type TeamStats,
} from './engine'

/** Bumped when the shape of a result changes. Additive changes keep the minor. */
export const OPEN_ENGINE_VERSION = '1.0.0'

export const TEAM_IDS: TeamId[] = ['bracelonia', 'banyarn']

export const DEFAULT_REQUEST = {
  seed: 8100,
  minutes: 12,
  difficulty: 'normal' as Difficulty,
  rules: 'standard' as RulesProfile,
  mode: 'match' as MatchMode,
}

export interface SideRequest {
  team: TeamId
  /** A full tactic sheet. Omit to use the club's default plan. */
  plan?: TeamPlan
}

export interface MatchRequest {
  seed: number
  minutes: number
  home: SideRequest
  away: SideRequest
  difficulty: Difficulty
  rules: RulesProfile
  mode: MatchMode
  /** Movement learned from video. Absent means the roles as they are. */
  motion?: MotionModel
}

export interface PlayerLine {
  id: string
  team: TeamId
  name: string
  number: number
  position: string
  played: boolean
  rating: number
  distance: number
  sprintDistance: number
  distanceInPossession: number
  distanceOutOfPossession: number
  topSpeedMps: number
}

export interface TeamLine extends TeamStats {
  possession: number
  passCompletion: number
  shotAccuracy: number
}

export interface OpenGoal {
  minute: number
  team: TeamId
  scorer: string
  ownGoal: boolean
  /** The dead ball that started the move, or `open`. */
  from: MatchEvent['from']
}

export interface OpenMatchResult {
  engine: string
  request: {
    seed: number
    minutes: number
    difficulty: Difficulty
    rules: RulesProfile
    mode: MatchMode
    home: { team: TeamId; formation: string; sliders: TeamPlan['sliders'] }
    away: { team: TeamId; formation: string; sliders: TeamPlan['sliders'] }
    motion: MotionModel['lines'] | null
  }
  score: { home: number; away: number }
  teams: Record<TeamId, TeamLine>
  /** How each side's goals were created — the set-piece share, not a guess. */
  goalOrigins: Record<TeamId, Record<string, number>>
  goals: OpenGoal[]
  events: MatchEvent[]
  players: PlayerLine[]
  /** True when the match reached full time rather than the step guard. */
  fullTime: boolean
}

const isTeam = (v: unknown): v is TeamId => typeof v === 'string' && (TEAM_IDS as string[]).includes(v)

const round = (v: number, dp = 2) => {
  const f = 10 ** dp
  return Math.round(v * f) / f
}

export interface ParseOutcome {
  ok: boolean
  errors: string[]
  request?: MatchRequest
}

/**
 * Turn anything that arrived as JSON into a MatchRequest, or explain why not.
 *
 * The errors name the field: `home.team: "arse" is not a side (bracelonia,
 * banyarn)` is more use than `invalid request`.
 */
export function parseMatchRequest(raw: unknown): ParseOutcome {
  const errors: string[] = []
  const src = (raw ?? {}) as Record<string, unknown>

  const seed = src.seed === undefined ? DEFAULT_REQUEST.seed : src.seed
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0) {
    errors.push(`seed: expected a whole number of 0 or more, got ${JSON.stringify(seed)}`)
  }

  const minutes = src.minutes === undefined ? DEFAULT_REQUEST.minutes : src.minutes
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 1 || minutes > 120) {
    errors.push(`minutes: expected a number of simulated minutes between 1 and 120, got ${JSON.stringify(minutes)}`)
  }

  const side = (key: 'home' | 'away', fallback: TeamId): SideRequest => {
    const value = src[key] ?? fallback
    if (isTeam(value)) return { team: value }
    if (typeof value === 'string') {
      errors.push(`${key}: ${JSON.stringify(value)} is not a side (${TEAM_IDS.join(', ')})`)
      return { team: fallback }
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>
      const team = obj.team
      if (!isTeam(team)) {
        errors.push(`${key}.team: ${JSON.stringify(team)} is not a side (${TEAM_IDS.join(', ')})`)
        return { team: fallback }
      }
      if (obj.plan === undefined) return { team }
      const plan = obj.plan as TeamPlan
      if (!plan || typeof plan !== 'object' || !Array.isArray((plan as TeamPlan).slots)) {
        errors.push(`${key}.plan: expected a tactic sheet with a slots array`)
        return { team }
      }
      if (plan.teamId !== team) {
        errors.push(`${key}.plan.teamId: sheet is for ${JSON.stringify(plan.teamId)} but the side is ${team}`)
        return { team }
      }
      return { team, plan }
    }
    errors.push(`${key}: expected a side id or { team, plan? }, got ${JSON.stringify(value)}`)
    return { team: fallback }
  }

  const home = side('home', 'bracelonia')
  const away = side('away', 'banyarn')
  if (home.team === away.team) errors.push(`home and away: both sides are ${home.team}`)

  const difficulty = (src.difficulty ?? DEFAULT_REQUEST.difficulty) as Difficulty
  if (!['easy', 'normal', 'hard', 'real'].includes(difficulty)) {
    errors.push(`difficulty: expected easy, normal, hard or real, got ${JSON.stringify(difficulty)}`)
  }

  const rules = (src.rules ?? DEFAULT_REQUEST.rules) as RulesProfile
  if (!['arcade', 'standard', 'current'].includes(rules)) {
    errors.push(`rules: expected arcade, standard or current, got ${JSON.stringify(rules)}`)
  }

  const mode = (src.mode ?? DEFAULT_REQUEST.mode) as MatchMode
  if (!['match', 'training', 'watch'].includes(mode)) {
    errors.push(`mode: expected match, training or watch, got ${JSON.stringify(mode)}`)
  }

  let motion: MotionModel | undefined
  if (src.motion !== undefined) {
    const candidate = src.motion as MotionModel
    if (!candidate || typeof candidate !== 'object' || typeof candidate.lines !== 'object' || candidate.lines === null) {
      errors.push('motion: expected a movement model with a lines object (see docs/motion-learning.md)')
    } else {
      motion = candidate
    }
  }

  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    errors: [],
    request: {
      seed: seed as number,
      minutes: minutes as number,
      home,
      away,
      difficulty,
      rules,
      mode,
      motion,
    },
  }
}

function planFor(side: SideRequest): TeamPlan {
  return side.plan ?? createDefaultPlan(side.team)
}

function teamLine(stats: TeamStats, other: TeamStats): TeamLine {
  const total = stats.possessionSeconds + other.possessionSeconds
  return {
    ...stats,
    possession: total > 0 ? round((stats.possessionSeconds / total) * 100, 1) : 50,
    passCompletion: stats.passes > 0 ? round((stats.completedPasses / stats.passes) * 100, 1) : 0,
    shotAccuracy: stats.shots > 0 ? round((stats.shotsOnTarget / stats.shots) * 100, 1) : 0,
  }
}

/** Run a match. Pure: no I/O, no clock, no randomness beyond the seed. */
export function runMatch(request: MatchRequest): OpenMatchResult {
  const homePlan = planFor(request.home)
  const awayPlan = planFor(request.away)
  const seconds = request.minutes * 60

  const state: MatchState = simulateMatch({
    homePlan,
    awayPlan,
    difficulty: request.difficulty,
    rules: request.rules,
    mode: request.mode,
    motion: request.motion,
    halfSeconds: seconds / 2,
    humanTeams: [],
    seed: request.seed,
  }, seconds, 0.05)

  const goals: OpenGoal[] = state.events
    .filter((e) => e.kind === 'goal')
    .map((e) => ({
      minute: e.minute,
      team: e.teamId ?? request.home.team,
      scorer: e.text,
      ownGoal: /own goal/i.test(e.text),
      from: e.from ?? 'open',
    }))

  const goalOrigins: Record<TeamId, Record<string, number>> = {
    bracelonia: {},
    banyarn: {},
  }
  for (const goal of goals) {
    const bucket = goalOrigins[goal.team] ?? (goalOrigins[goal.team] = {})
    const key = goal.from ?? 'open'
    bucket[key] = (bucket[key] ?? 0) + 1
  }

  const players: PlayerLine[] = state.players.map((p) => ({
    id: p.id,
    team: p.teamId,
    name: p.base.name,
    number: p.base.number,
    position: p.slotPosition,
    played: p.samples > 0,
    rating: playerRating(p),
    distance: round(p.distance, 1),
    sprintDistance: round(p.sprintDistance, 1),
    distanceInPossession: round(p.distanceInPossession, 1),
    distanceOutOfPossession: round(p.distanceOutOfPossession, 1),
    topSpeedMps: round(p.topSpeedMps, 2),
  }))

  return {
    engine: OPEN_ENGINE_VERSION,
    request: {
      seed: request.seed,
      minutes: request.minutes,
      difficulty: request.difficulty,
      rules: request.rules,
      mode: request.mode,
      home: { team: request.home.team, formation: homePlan.formation, sliders: homePlan.sliders },
      away: { team: request.away.team, formation: awayPlan.formation, sliders: awayPlan.sliders },
      motion: request.motion?.lines ?? null,
    },
    score: { home: state.score[request.home.team], away: state.score[request.away.team] },
    teams: {
      [request.home.team]: teamLine(state.stats[request.home.team], state.stats[request.away.team]),
      [request.away.team]: teamLine(state.stats[request.away.team], state.stats[request.home.team]),
    } as Record<TeamId, TeamLine>,
    goalOrigins,
    goals,
    events: state.events,
    players,
    fullTime: state.phase === 'fulltime',
  }
}

/** Key-sorted JSON, so equal results are equal strings. */
export function resultJson(result: OpenMatchResult): string {
  const sort = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sort)
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        out[key] = sort((value as Record<string, unknown>)[key])
      }
      return out
    }
    return value
  }
  return JSON.stringify(sort(result), null, 2)
}

/** A readable line or two per side, for a terminal or a log. */
export function describeResult(result: OpenMatchResult): string {
  const { request, score, teams } = result
  const home = getTeam(request.home.team).shortName ?? request.home.team
  const away = getTeam(request.away.team).shortName ?? request.away.team
  const a = teams[request.home.team]
  const b = teams[request.away.team]
  const lines = [
    `${home} ${score.home}-${score.away} ${away}  (seed ${request.seed}, ${request.minutes} min, ${request.difficulty})`,
    `  possession ${a.possession}% / ${b.possession}%   shots ${a.shots} (${a.shotsOnTarget} on target) / ${b.shots} (${b.shotsOnTarget})`,
    `  passes ${a.completedPasses}/${a.passes} / ${b.completedPasses}/${b.passes}   corners ${a.corners}/${b.corners}   fouls ${a.fouls}/${b.fouls}`,
    `  xG ${a.xg.toFixed(2)} / ${b.xg.toFixed(2)}   saves ${a.saves}/${b.saves}`,
  ]
  const originKeys = new Set<string>([
    ...Object.keys(result.goalOrigins[request.home.team] ?? {}),
    ...Object.keys(result.goalOrigins[request.away.team] ?? {}),
  ])
  if (originKeys.size) {
    const parts = [...originKeys].sort().map((k) =>
      `${k} ${result.goalOrigins[request.home.team]?.[k] ?? 0}/${result.goalOrigins[request.away.team]?.[k] ?? 0}`)
    lines.push(`  goal origins  ${parts.join('   ')}`)
  }
  if (!result.fullTime) lines.push('  note: match did not reach full time')
  return lines.join('\n')
}

/**
 * A batch, summarised.
 *
 * Every field says its unit in its name, because the two are easy to confuse and
 * the first version of this did confuse them: `goals` is per match while `shots`
 * and the rest are per side. Reporting "offsides 1.35" without saying "per side"
 * made a figure of 2.7 a match look like a tick against a target of four.
 */
export interface MatchAggregate {
  matches: number
  minutesPerMatch: number
  goalsPerMatch: number
  shotsPerSide: number
  shotsOnTargetPerSide: number
  onTargetPct: number
  cornersPerSide: number
  foulsPerSide: number
  /** Per side. Double it for the match figure that football reporting uses. */
  offsidesPerSide: number
  xgPerSide: number
  passCompletion: number
  possessionHome: number
  /** Share of all goals by the dead ball that started the move. */
  goalOrigins: Record<string, number>
}

/**
 * Turn a batch of results into the numbers we actually judge a build by.
 *
 * This exists because a single match says almost nothing: the corner probe that
 * settled the deflection question needed sixty seeds, and the difference
 * between 4.08 and 4.17 goals a match is not visible in one run.
 */
export function aggregateResults(results: OpenMatchResult[]): MatchAggregate {
  const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0)
  const sides = results.flatMap((r) => Object.values(r.teams) as TeamLine[])
  const goals = results.map((r) => r.goals.length)
  const origins: Record<string, number> = {}
  for (const result of results) {
    for (const bucket of Object.values(result.goalOrigins)) {
      for (const [key, count] of Object.entries(bucket)) origins[key] = (origins[key] ?? 0) + count
    }
  }
  const totalGoals = goals.reduce((a, b) => a + b, 0)
  const originShare: Record<string, number> = {}
  for (const [key, count] of Object.entries(origins)) {
    originShare[key] = totalGoals > 0 ? round((count / totalGoals) * 100, 1) : 0
  }
  return {
    matches: results.length,
    minutesPerMatch: results[0]?.request.minutes ?? 0,
    goalsPerMatch: round(mean(goals), 2),
    shotsPerSide: round(mean(sides.map((s) => s.shots)), 2),
    shotsOnTargetPerSide: round(mean(sides.map((s) => s.shotsOnTarget)), 2),
    onTargetPct: round(mean(sides.map((s) => s.shotAccuracy)), 1),
    cornersPerSide: round(mean(sides.map((s) => s.corners)), 2),
    foulsPerSide: round(mean(sides.map((s) => s.fouls)), 2),
    offsidesPerSide: round(mean(sides.map((s) => s.offsides)), 2),
    xgPerSide: round(mean(sides.map((s) => s.xg)), 2),
    passCompletion: round(mean(sides.map((s) => s.passCompletion)), 1),
    possessionHome: round(mean(results.map((r) => r.teams[r.request.home.team]?.possession ?? 50)), 1),
    goalOrigins: originShare,
  }
}

export function describeAggregate(agg: MatchAggregate): string {
  const origins = Object.entries(agg.goalOrigins).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, share]) => `${key} ${share}%`).join('  ')
  return [
    `${agg.matches} matches x ${agg.minutesPerMatch} min`,
    `  per match    goals ${agg.goalsPerMatch}   offsides ${(agg.offsidesPerSide * 2).toFixed(2)}`,
    `  per side     shots ${agg.shotsPerSide} (${agg.shotsOnTargetPerSide} on target, ${agg.onTargetPct}%)   xG ${agg.xgPerSide}`,
    `               corners ${agg.cornersPerSide}   fouls ${agg.foulsPerSide}   offsides ${agg.offsidesPerSide}   pass completion ${agg.passCompletion}%`,
    `  home possession ${agg.possessionHome}%`,
    origins ? `  goal origins: ${origins}` : '',
  ].filter(Boolean).join('\n')
}
