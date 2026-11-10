import type {
  Match,
  MatchEvent,
  Player,
  PlayerMatchMinutes,
  PlayerSeasonStats,
  PositionGroup,
  Team,
} from '@/types'
import { groupOf } from './positions'

/**
 * All-round rating system v1 — SofaScore-style, NOT goal-centric.
 *
 * How it works (same idea at season and single-match level):
 *  1. Performance is broken into categories: output, creation, passing,
 *     carrying, defending, duels, goalkeeping and positioning/awareness.
 *  2. Every metric in a category is converted to a **percentile within the
 *     player's own position group** (GK / CB / FB / DM / CM / WM / AM / W /
 *     ST) — a centre-back is never punished for not scoring, a striker is
 *     never rewarded for clearances.
 *  3. Category scores (mean of metric percentiles) are combined with
 *     **position-archetype weights** (what the role is actually for), then
 *     mapped to the 1–10 scale: rating = 5.0 + score/100 × 4.8.
 *
 * Season ratings use the full stat set (goals, chances created, passes,
 * duels won, dribbles, carry distance, tackles, blocks, saves, positioning
 * est.). Single-match ratings use what match events honestly contain
 * (goals/shots/xG, chances, completed passes, carries + carry distance from
 * event coordinates, recoveries, turnovers; goalkeepers get a shots-stopped
 * proxy from the opponent's recorded shots). Per-match duels/tackles/blocks
 * are not events — they are excluded at match level rather than fabricated,
 * and the category weights are renormalised over what exists.
 *
 * Ratings are model estimates ("est.") — interpretation, not measurement.
 */

export const RATING_SYSTEM_VERSION = 'all-round v1'

export type RatingCategory =
  | 'output'
  | 'creation'
  | 'passing'
  | 'carrying'
  | 'defending'
  | 'duels'
  | 'goalkeeping'
  | 'positioning'

export const RATING_CATEGORY_LABELS: Record<RatingCategory, string> = {
  output: 'Finishing',
  creation: 'Creation',
  passing: 'Passing',
  carrying: 'Carrying',
  defending: 'Defending',
  duels: 'Duels',
  goalkeeping: 'Goalkeeping',
  positioning: 'Positioning',
}

type Archetype = 'GK' | 'DF' | 'MF' | 'FW'

const ARCHETYPE: Record<PositionGroup, Archetype> = {
  GK: 'GK', CB: 'DF', FB: 'DF', DM: 'MF', CM: 'MF', WM: 'MF', AM: 'MF', W: 'FW', ST: 'FW',
}

export function archetypeOf(group: PositionGroup): Archetype {
  return ARCHETYPE[group]
}

/** What each role is for — category weights (must sum to ~1 before renormalising). */
const WEIGHTS: Record<Archetype, Partial<Record<RatingCategory, number>>> = {
  GK: { goalkeeping: 0.5, positioning: 0.2, passing: 0.15, duels: 0.15 },
  DF: { defending: 0.3, duels: 0.2, passing: 0.2, positioning: 0.15, carrying: 0.1, output: 0.05 },
  MF: { passing: 0.25, creation: 0.2, carrying: 0.15, defending: 0.15, duels: 0.1, output: 0.1, positioning: 0.05 },
  FW: { output: 0.35, creation: 0.2, carrying: 0.15, positioning: 0.15, passing: 0.1, duels: 0.05 },
}

/* ------------------------------------------------------------------ */
/* Fast percentiles (sorted peers + binary search)                     */
/* ------------------------------------------------------------------ */

function sortedPercentile(sortedAsc: number[], value: number, direction: 'higher' | 'lower'): number | null {
  const n = sortedAsc.length
  if (n < 5) return null
  // count of values < value (lower bound) and <= value (upper bound)
  let lo = 0
  let hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sortedAsc[mid]! < value) lo = mid + 1
    else hi = mid
  }
  const less = lo
  lo = 0
  hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sortedAsc[mid]! <= value) lo = mid + 1
    else hi = mid
  }
  const lessOrEqual = lo
  const tied = lessOrEqual - less
  const beaten = direction === 'higher' ? less : n - lessOrEqual
  return (100 * (beaten + tied / 2)) / n
}

interface MetricDef<T> {
  id: string
  direction?: 'higher' | 'lower'
  get: (row: T) => number | null
}

/**
 * Score rows into category percentiles + a 1–10 rating.
 * `groupKey` = fine position group (peers), `archetype` = weights template.
 */
function scoreRows<T extends { group: PositionGroup }>(
  rows: T[],
  categories: Partial<Record<RatingCategory, MetricDef<T>[]>>,
  positioningScore: (row: T, peers: T[]) => number | null,
): Map<T, { rating: number; score: number; categories: CategoryScore[] }> {
  const byGroup = new Map<PositionGroup, T[]>()
  for (const r of rows) {
    const list = byGroup.get(r.group) ?? []
    list.push(r)
    byGroup.set(r.group, list)
  }

  // Pre-sort peer values per (group, metric)
  const sortedPeers = new Map<string, number[]>()
  for (const [group, peers] of byGroup) {
    for (const metrics of Object.values(categories)) {
      for (const m of metrics ?? []) {
        const vals = peers
          .map((p) => m.get(p))
          .filter((v): v is number => v !== null && Number.isFinite(v))
          .sort((a, b) => a - b)
        sortedPeers.set(`${group}:${m.id}`, vals)
      }
    }
  }

  const out = new Map<T, { rating: number; score: number; categories: CategoryScore[] }>()
  for (const row of rows) {
    const weights = WEIGHTS[ARCHETYPE[row.group]]
    const catScores: CategoryScore[] = []
    let weighted = 0
    let totalWeight = 0
    for (const [cat, weight] of Object.entries(weights) as [RatingCategory, number][]) {
      let score: number | null = null
      if (cat === 'positioning') {
        score = positioningScore(row, byGroup.get(row.group) ?? [])
      } else {
        const metrics = categories[cat] ?? []
        const pcts: number[] = []
        for (const m of metrics) {
          const v = m.get(row)
          if (v === null || !Number.isFinite(v)) continue
          const peers = sortedPeers.get(`${row.group}:${m.id}`) ?? []
          const pct = sortedPercentile(peers, v, m.direction ?? 'higher')
          if (pct !== null) pcts.push(pct)
        }
        score = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null
      }
      catScores.push({ category: cat, label: RATING_CATEGORY_LABELS[cat], score, weight })
      if (score !== null) {
        weighted += score * weight
        totalWeight += weight
      }
    }
    const score = totalWeight > 0 ? weighted / totalWeight : 50
    const rating = Math.round(Math.min(9.8, Math.max(4.0, 5.0 + (score / 100) * 4.8)) * 10) / 10
    out.set(row, { rating, score: Math.round(score * 10) / 10, categories: catScores })
  }
  return out
}

export interface CategoryScore {
  category: RatingCategory
  label: string
  /** 0–100 percentile score, or null when the category has no data. */
  score: number | null
  weight: number
}

/* ------------------------------------------------------------------ */
/* Season all-round ratings (feeds the slider + Top players board)     */
/* ------------------------------------------------------------------ */

const per90 = (s: PlayerSeasonStats, v: number) => (s.minutes > 0 ? (v / s.minutes) * 90 : 0)
const pctOf = (done: number, total: number) => (total > 0 ? (done / total) * 100 : null)

interface SeasonRow {
  group: PositionGroup
  player: Player
}

export interface AllRoundSeasonRating {
  playerId: string
  playerName: string
  position: Player['position']
  group: PositionGroup
  archetype: Archetype
  rating: number
  score: number
  categories: CategoryScore[]
  /** Strongest category by score — the player's headline quality. */
  topCategory: CategoryScore | null
  minutes: number
  appearances: number
}

const SEASON_CATEGORIES: Partial<Record<RatingCategory, MetricDef<SeasonRow>[]>> = {
  output: [
    { id: 'goals', get: (r) => per90(r.player.stats, r.player.stats.goals) },
    { id: 'xg', get: (r) => per90(r.player.stats, r.player.stats.xg) },
    { id: 'shots', get: (r) => per90(r.player.stats, r.player.stats.shots) },
  ],
  creation: [
    { id: 'assists', get: (r) => per90(r.player.stats, r.player.stats.assists) },
    { id: 'chances', get: (r) => per90(r.player.stats, r.player.stats.chancesCreated) },
    { id: 'xa', get: (r) => per90(r.player.stats, r.player.stats.xa) },
  ],
  passing: [
    { id: 'passPct', get: (r) => pctOf(r.player.stats.passesCompleted, r.player.stats.passesAttempted) },
    { id: 'progPasses', get: (r) => per90(r.player.stats, r.player.stats.progressivePasses) },
    { id: 'lineBreaking', get: (r) => per90(r.player.stats, r.player.stats.lineBreakingPasses) },
  ],
  carrying: [
    { id: 'dribbles', get: (r) => per90(r.player.stats, r.player.stats.dribblesCompleted) },
    { id: 'progCarries', get: (r) => per90(r.player.stats, r.player.stats.progressiveCarries) },
    { id: 'carryDistance', get: (r) => per90(r.player.stats, r.player.stats.carryDistance) },
  ],
  defending: [
    { id: 'tacklesWon', get: (r) => per90(r.player.stats, r.player.stats.tacklesWon) },
    { id: 'interceptions', get: (r) => per90(r.player.stats, r.player.stats.interceptions) },
    { id: 'blocks', get: (r) => per90(r.player.stats, r.player.stats.shotsBlocked) },
    { id: 'recoveries', get: (r) => per90(r.player.stats, r.player.stats.recoveries) },
  ],
  duels: [
    { id: 'duelsWon', get: (r) => per90(r.player.stats, r.player.stats.duelsWon) },
    { id: 'duelPct', get: (r) => pctOf(r.player.stats.duelsWon, r.player.stats.duelsContested) },
    { id: 'aerialsWon', get: (r) => per90(r.player.stats, r.player.stats.aerialsWon) },
  ],
  goalkeeping: [
    { id: 'saves', get: (r) => per90(r.player.stats, r.player.stats.saves) },
    { id: 'xgPrevented', get: (r) => per90(r.player.stats, r.player.stats.xgPrevented) },
    {
      id: 'penStops',
      get: (r) =>
        r.player.stats.penaltiesFaced > 0
          ? pctOf(r.player.stats.penaltiesStopped, r.player.stats.penaltiesFaced)
          : null,
    },
  ],
}

/** Positioning/awareness: FW read attack, GK/DF read defence, MF the blend. */
function positioningValue(player: Player): number {
  const arch = ARCHETYPE[groupOf(player.position)]
  if (arch === 'FW') return player.stats.positioningAttack
  if (arch === 'MF') return (player.stats.positioningAttack + player.stats.positioningDefense) / 2
  return player.stats.positioningDefense
}

export function computeAllRoundSeasonRatings(
  players: Player[],
  minMinutes = 450,
  limit?: number,
): AllRoundSeasonRating[] {
  const rows: SeasonRow[] = players
    .filter((p) => p.stats.minutes >= minMinutes)
    .map((player) => ({ group: groupOf(player.position), player }))

  const scored = scoreRows(rows, SEASON_CATEGORIES, (row, peers) => {
    const vals = peers.map((p) => positioningValue(p.player)).sort((a, b) => a - b)
    return sortedPercentile(vals, positioningValue(row.player), 'higher')
  })

  const results = rows.map((row) => {
    const s = scored.get(row)!
    const topCategory =
      s.categories
        .filter((c) => c.score !== null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null
    return {
      playerId: row.player.id,
      playerName: row.player.name,
      position: row.player.position,
      group: row.group,
      archetype: ARCHETYPE[row.group],
      rating: s.rating,
      score: s.score,
      categories: s.categories,
      topCategory,
      minutes: row.player.stats.minutes,
      appearances: row.player.stats.appearances,
    } satisfies AllRoundSeasonRating
  })

  results.sort(
    (a, b) => b.rating - a.rating || b.score - a.score || b.minutes - a.minutes || a.playerName.localeCompare(b.playerName),
  )
  return limit !== undefined ? results.slice(0, limit) : results
}

/* ------------------------------------------------------------------ */
/* Single-match all-round ratings (feeds Top performances)             */
/* ------------------------------------------------------------------ */

export interface MatchPerformanceComponents {
  goals: number
  assists: number
  shots: number
  shotXg: number
  chancesCreated: number
  passesCompleted: number
  passesAttempted: number
  passCompletion: number | null
  progressiveCarries: number
  /** Carry distance in pitch units (event start→end), summed. */
  carryDistance: number
  recoveries: number
  turnovers: number
  /** Goalkeepers: opponent shots minus goals conceded (proxy, est.). */
  saves: number | null
  /** Goalkeepers: total opponent shots in the match (recorded match total). */
  shotsFaced: number | null
  goalsConceded: number | null
}

interface MatchRow {
  group: PositionGroup
  playerId: string
  matchId: string
  minutes: number
  components: MatchPerformanceComponents
}

const MATCH_CATEGORIES: Partial<Record<RatingCategory, MetricDef<MatchRow>[]>> = {
  output: [
    { id: 'm-goals', get: (r) => r.components.goals },
    { id: 'm-xg', get: (r) => r.components.shotXg },
    { id: 'm-shots', get: (r) => r.components.shots },
  ],
  creation: [
    { id: 'm-assists', get: (r) => r.components.assists },
    { id: 'm-chances', get: (r) => r.components.chancesCreated },
  ],
  passing: [
    { id: 'm-passes', get: (r) => r.components.passesCompleted },
    { id: 'm-passPct', get: (r) => r.components.passCompletion },
  ],
  carrying: [
    { id: 'm-carries', get: (r) => r.components.progressiveCarries },
    { id: 'm-carryDist', get: (r) => r.components.carryDistance },
  ],
  defending: [
    { id: 'm-recoveries', get: (r) => r.components.recoveries },
    { id: 'm-turnovers', direction: 'lower', get: (r) => r.components.turnovers },
  ],
  goalkeeping: [
    { id: 'm-saves', get: (r) => r.components.saves },
    { id: 'm-conceded', direction: 'lower', get: (r) => r.components.goalsConceded },
  ],
  // duels / positioning have no per-match events — weights renormalise.
}

export interface AllRoundMatchRating {
  playerId: string
  matchId: string
  rating: number
  score: number
  categories: CategoryScore[]
  components: MatchPerformanceComponents
}

/**
 * All-round rating for every player-match row (minutes >= minMinutes),
 * percentile-scored against rows from the same position group.
 */
export function computeAllRoundMatchRatings(
  matches: Match[],
  minutes: PlayerMatchMinutes[],
  events: MatchEvent[],
  players: Player[],
  _teams: Team[],
  minMinutes = 45,
): Map<string, AllRoundMatchRating> {
  const playerById = new Map(players.map((p) => [p.id, p]))
  const matchById = new Map(matches.map((m) => [m.id, m]))

  const blank = (): MatchPerformanceComponents => ({
    goals: 0, assists: 0, shots: 0, shotXg: 0, chancesCreated: 0,
    passesCompleted: 0, passesAttempted: 0, passCompletion: null,
    progressiveCarries: 0, carryDistance: 0, recoveries: 0, turnovers: 0,
    saves: null, shotsFaced: null, goalsConceded: null,
  })

  const comps = new Map<string, MatchPerformanceComponents>()
  const bump = (matchId: string, playerId: string | undefined, fn: (c: MatchPerformanceComponents) => void) => {
    if (!playerId || !playerById.has(playerId)) return
    const key = `${matchId}:${playerId}`
    const c = comps.get(key) ?? blank()
    fn(c)
    comps.set(key, c)
  }

  for (const e of events) {
    switch (e.type) {
      case 'goal':
        bump(e.matchId, e.playerId, (c) => (c.goals += 1))
        bump(e.matchId, e.secondaryPlayerId, (c) => (c.assists += 1))
        break
      case 'shot':
        bump(e.matchId, e.playerId, (c) => {
          c.shots += 1
          c.shotXg += e.value ?? 0
        })
        break
      case 'chance-created':
        bump(e.matchId, e.playerId, (c) => (c.chancesCreated += 1))
        break
      case 'pass':
        bump(e.matchId, e.playerId, (c) => {
          c.passesCompleted += 1
          c.passesAttempted += 1
        })
        break
      case 'incomplete-pass':
        bump(e.matchId, e.playerId, (c) => (c.passesAttempted += 1))
        break
      case 'progressive-carry':
        bump(e.matchId, e.playerId, (c) => {
          c.progressiveCarries += 1
          if (e.x !== undefined && e.y !== undefined && e.endX !== undefined && e.endY !== undefined) {
            c.carryDistance += Math.hypot(e.endX - e.x, e.endY - e.y)
          }
        })
        break
      case 'recovery':
        bump(e.matchId, e.playerId, (c) => (c.recoveries += 1))
        break
      case 'turnover':
        bump(e.matchId, e.playerId, (c) => (c.turnovers += 1))
        break
      default:
        break
    }
  }

  const rows: MatchRow[] = []
  for (const r of minutes) {
    if (r.minutes < minMinutes) continue
    const player = playerById.get(r.playerId)
    const match = matchById.get(r.matchId)
    if (!player || !match) continue
    const c = comps.get(`${r.matchId}:${r.playerId}`) ?? blank()
    c.passCompletion = pctOf(c.passesCompleted, c.passesAttempted)
    c.carryDistance = Math.round(c.carryDistance)
    c.shotXg = Math.round(c.shotXg * 100) / 100
    if (player.position === 'GK') {
      const isHome = player.teamId === match.homeTeamId
      const shotsFaced = isHome ? match.shotsAway : match.shotsHome
      const conceded = isHome ? match.awayGoals : match.homeGoals
      c.goalsConceded = conceded
      c.shotsFaced = shotsFaced
      c.saves = Math.max(0, shotsFaced - conceded)
    }
    rows.push({
      group: groupOf(player.position),
      playerId: r.playerId,
      matchId: r.matchId,
      minutes: r.minutes,
      components: c,
    })
  }

  const scored = scoreRows(rows, MATCH_CATEGORIES, () => null)
  const out = new Map<string, AllRoundMatchRating>()
  for (const row of rows) {
    const s = scored.get(row)!
    out.set(`${row.matchId}:${row.playerId}`, {
      playerId: row.playerId,
      matchId: row.matchId,
      rating: s.rating,
      score: s.score,
      categories: s.categories,
      components: row.components,
    })
  }
  return out
}
