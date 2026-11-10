import type {
  Dimension,
  Phase,
  Player,
  PositionGroup,
  RoleId,
  TeamStyle,
} from '@/types'
import {
  DIMENSION_METRICS,
  METRICS,
  MIN_MINUTES_FOR_PERCENTILE,
  PHASES,
  metricPer90Value,
} from './metrics'
import { groupOf } from './positions'
import { ageAt } from './utils'
import { ROLES } from './roles'

/**
 * Deterministic analysis engine.
 *
 * All rankings, percentiles and similarity scores are computed from real
 * (demo-dataset) metric values with documented formulas. No LLM is involved
 * in producing numbers (spec §9, §10).
 */

export const DEMO_REFERENCE_DATE = '2026-10-10'

export function playerAge(player: Player): number {
  return ageAt(player.dob, DEMO_REFERENCE_DATE)
}

/* ------------------------------------------------------------------ */
/* Peer groups                                                         */
/* ------------------------------------------------------------------ */

export interface PeerFilters {
  positionGroup?: PositionGroup | 'all'
  role?: RoleId | 'all'
  teamStyle?: TeamStyle | 'all'
  teamId?: string | 'all'
  minMinutes: number
  ageMin?: number
  ageMax?: number
}

export function buildPeerGroup(players: Player[], filters: PeerFilters): Player[] {
  return players.filter((p) => {
    if (p.stats.minutes < filters.minMinutes) return false
    if (filters.positionGroup && filters.positionGroup !== 'all') {
      if (groupOf(p.position) !== filters.positionGroup) return false
    }
    if (filters.role && filters.role !== 'all' && p.role !== filters.role) return false
    if (filters.teamStyle && filters.teamStyle !== 'all') {
      // team style of the player's team is resolved by the caller via teamsById
      return true // resolved in buildPeerGroupWithContext
    }
    if (filters.teamId && filters.teamId !== 'all' && p.teamId !== filters.teamId) return false
    if (filters.ageMin !== undefined && playerAge(p) < filters.ageMin) return false
    if (filters.ageMax !== undefined && playerAge(p) > filters.ageMax) return false
    return true
  })
}

/** Peer-group construction with team-style resolution. */
export function buildPeerGroupWithContext(
  players: Player[],
  teamsById: Map<string, { style: TeamStyle }>,
  filters: PeerFilters,
): Player[] {
  const base = buildPeerGroup(players, filters)
  if (!filters.teamStyle || filters.teamStyle === 'all') return base
  return base.filter((p) => teamsById.get(p.teamId)?.style === filters.teamStyle)
}

/* ------------------------------------------------------------------ */
/* Percentiles                                                         */
/* ------------------------------------------------------------------ */

/**
 * Direction-adjusted percentile of `value` among `peerValues`.
 *
 * Formula: 100 × (share of peers the player beats + half of ties).
 * For lower-is-better metrics the comparison is inverted so that a higher
 * percentile always means "better relative to peers".
 * Returns null when there are no peers or the peer group is too small
 * (fewer than 5 values) for a stable estimate.
 */
export function percentile(
  value: number,
  peerValues: number[],
  direction: 'higher' | 'lower' = 'higher',
): number | null {
  if (peerValues.length < 5) return null
  let beaten = 0
  let tied = 0
  for (const pv of peerValues) {
    if (direction === 'higher' ? pv < value : pv > value) beaten += 1
    else if (pv === value) tied += 1
  }
  return (100 * (beaten + tied / 2)) / peerValues.length
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

/* ------------------------------------------------------------------ */
/* Per-metric analysis rows                                            */
/* ------------------------------------------------------------------ */

export interface MetricAnalysisRow {
  metricId: string
  label: string
  /** Per-90 value (or rate) of the player. Null = not available. */
  value: number | null
  /** Season total (counts) or rate value. */
  rawValue: number | null
  unit: 'per 90' | '%' | 'total'
  direction: 'higher' | 'lower'
  percentile: number | null
  peerCount: number
  peerMedian: number | null
  /** Best value in the peer group, honouring direction. */
  peerBest: number | null
  minutes: number
  matches: number
  smallSample: boolean
  peerGroupTooSmall: boolean
  interpretation: string | null
  /** Where the value came from: provider season stats or stored events. */
  source?: 'PROVIDER' | 'EVENTS'
  /** For EVENTS rows: number of stored positioned events behind the value. */
  sampleEvents?: number
}

export const MIN_PEERS_FOR_PERCENTILE = 5

export function computeMetricRow(
  player: Player,
  peers: Player[],
  metricId: string,
): MetricAnalysisRow | null {
  const def = METRICS[metricId]
  if (!def) return null

  const group = groupOf(player.position)
  const applies = def.appliesTo === 'all'
    || (def.appliesTo === 'outfield' ? group !== 'GK' : def.appliesTo.includes(group))

  const value = applies ? metricPer90Value(player.stats, metricId) : null
  const rawValue = applies
    ? (def.kind === 'rate' ? metricPer90Value(player.stats, metricId) : (player.stats.minutes > 0
        ? (metricRaw(player, metricId))
        : null))
    : null

  const peerValues = peers
    .map((p) => {
      const g = groupOf(p.position)
      const ok = def.appliesTo === 'all'
        || (def.appliesTo === 'outfield' ? g !== 'GK' : def.appliesTo.includes(g))
      return ok ? metricPer90Value(p.stats, metricId) : null
    })
    .filter((v): v is number => v !== null)

  const pct = value !== null && peerValues.length >= MIN_PEERS_FOR_PERCENTILE
    ? percentile(value, peerValues, def.direction)
    : null

  const peerMed = median(peerValues)
  const peerBest = peerValues.length > 0
    ? (def.direction === 'higher' ? Math.max(...peerValues) : Math.min(...peerValues))
    : null

  let interpretation: string | null = null
  if (pct !== null && value !== null) {
    const band = pct >= 90 ? 'elite' : pct >= 75 ? 'strong' : pct >= 25 ? 'middling' : 'low'
    interpretation =
      `${band === 'middling' ? 'Around the middle of the peer group' : `${band[0]!.toUpperCase()}${band.slice(1)} in this peer group`} ` +
      `(${pct.toFixed(0)}th percentile, ${def.direction === 'higher' ? 'higher' : 'lower'} is better` +
      (peerMed !== null ? `, peer median ${peerMed.toFixed(def.decimals)}` : '') + ').'
  } else if (value === null && !applies) {
    interpretation = 'Not applicable to this player’s position group.'
  } else if (value === null) {
    interpretation = 'Not available in the current dataset.'
  } else if (peerValues.length < MIN_PEERS_FOR_PERCENTILE) {
    interpretation = `Peer group too small for a stable percentile (n=${peerValues.length}).`
  }

  return {
    metricId,
    label: def.label,
    value,
    rawValue,
    unit: def.unit,
    direction: def.direction,
    percentile: pct,
    peerCount: peerValues.length,
    peerMedian: peerMed,
    peerBest,
    minutes: player.stats.minutes,
    matches: player.stats.appearances,
    smallSample: player.stats.minutes < MIN_MINUTES_FOR_PERCENTILE,
    peerGroupTooSmall: peerValues.length < MIN_PEERS_FOR_PERCENTILE,
    interpretation,
  }
}

function metricRaw(player: Player, metricId: string): number | null {
  const def = METRICS[metricId]
  if (!def || !def.available) return null
  // Raw totals for counts; rates identical to per-90 accessor.
  if (def.kind === 'rate') return metricPer90Value(player.stats, metricId)
  // Access raw field via the per-90 accessor inverted: simpler to recompute below.
  const per90 = metricPer90Value(player.stats, metricId)
  if (per90 === null) return null
  if (def.kind === 'count') return per90 * (player.stats.minutes / 90)
  return per90
}

export function computePhaseAnalysis(
  player: Player,
  peers: Player[],
  phase: Phase,
): { rows: MetricAnalysisRow[]; unavailableRows: MetricAnalysisRow[] } {
  const phaseDef = PHASES[phase]
  const rows: MetricAnalysisRow[] = []
  const unavailableRows: MetricAnalysisRow[] = []
  for (const id of phaseDef.metricIds) {
    const row = computeMetricRow(player, peers, id)
    if (!row) continue
    if (METRICS[id]!.available) rows.push(row)
    else unavailableRows.push(row)
  }
  return { rows, unavailableRows }
}

/* ------------------------------------------------------------------ */
/* Similarity engine (spec §9)                                         */
/* ------------------------------------------------------------------ */

export type SimilarityWeights = Record<Dimension, number>

export interface SimilarityContribution {
  metricId: string
  dimension: Dimension
  /** Standard-deviation distance between target and candidate. */
  distance: number
}

export interface SimilarityResult {
  player: Player
  /** 0–100. score = 100 × (1 − D/3), D = weighted mean std-distance. */
  score: number
  weightedDistance: number
  contributions: SimilarityContribution[]
  /** Metrics excluded because values are missing for this pair. */
  excludedMetrics: string[]
}

export interface SimilarityOptions {
  weights: SimilarityWeights
  /** Candidate pool already filtered by position/age/minutes/style. */
  candidates: Player[]
}

interface ZStats { mean: number; sd: number }

function zStatsFor(values: number[]): ZStats | null {
  if (values.length < 2) return null
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  const sd = Math.sqrt(variance)
  if (sd < 1e-9) return null
  return { mean, sd }
}

/**
 * Deterministic, explainable player similarity.
 *
 * Method:
 *  1. Per-metric z-scores are computed within the candidate pool ∪ target.
 *  2. Each dimension's distance is the mean absolute z-distance across the
 *     metrics available for BOTH players (missing metrics are excluded and
 *     reported — never zero-filled).
 *  3. Overall weighted distance D uses the user's dimension weights.
 *  4. Score = 100 × (1 − D/3), clamped to 0–100. One standard deviation of
 *     weighted distance therefore costs ~33 points.
 */
export function computeSimilarity(
  target: Player,
  options: SimilarityOptions,
): SimilarityResult[] {
  const targetGroup = groupOf(target.position)
  const pool = options.candidates.filter((c) => c.id !== target.id)

  // Gather per-dimension metric stats.
  const dimStats = new Map<Dimension, {
    metricId: string
    stats: ZStats
    targetValue: number
    weight: number
  }[]>()

  for (const dim of Object.keys(DIMENSION_METRICS) as Dimension[]) {
    const dimWeight = options.weights[dim] ?? 0
    if (dimWeight <= 0) continue
    const usable: { metricId: string; stats: ZStats; targetValue: number; weight: number }[] = []
    for (const metricId of DIMENSION_METRICS[dim]) {
      const def = METRICS[metricId]
      if (!def || !def.available) continue
      if (def.appliesTo !== 'all') {
        const applies = def.appliesTo === 'outfield'
          ? targetGroup !== 'GK'
          : def.appliesTo.includes(targetGroup)
        if (!applies) continue
      }
      const targetValue = metricPer90Value(target.stats, metricId)
      if (targetValue === null) continue
      const values = [targetValue]
      for (const c of pool) {
        const g = groupOf(c.position)
        const ok = def.appliesTo === 'all'
          || (def.appliesTo === 'outfield' ? g !== 'GK' : def.appliesTo.includes(g))
        const v = ok ? metricPer90Value(c.stats, metricId) : null
        if (v !== null) values.push(v)
      }
      const stats = zStatsFor(values)
      if (!stats) continue
      usable.push({ metricId, stats, targetValue, weight: 1 })
    }
    if (usable.length > 0) dimStats.set(dim, usable)
  }

  const results: SimilarityResult[] = pool.map((candidate) => {
    const contributions: SimilarityContribution[] = []
    const excluded: string[] = []
    let distSum = 0
    let weightSum = 0

    for (const [dim, metrics] of dimStats) {
      const dimWeight = options.weights[dim] ?? 0
      let mSum = 0
      let mCount = 0
      for (const m of metrics) {
        const g = groupOf(candidate.position)
        const def = METRICS[m.metricId]!
        const ok = def.appliesTo === 'all'
          || (def.appliesTo === 'outfield' ? g !== 'GK' : def.appliesTo.includes(g))
        const cValue = ok ? metricPer90Value(candidate.stats, m.metricId) : null
        if (cValue === null) {
          excluded.push(m.metricId)
          continue
        }
        const zt = (m.targetValue - m.stats.mean) / m.stats.sd
        const zc = (cValue - m.stats.mean) / m.stats.sd
        const dist = Math.abs(zt - zc)
        mSum += dist * m.weight
        mCount += m.weight
        contributions.push({ metricId: m.metricId, dimension: dim, distance: dist })
      }
      if (mCount > 0) {
        distSum += dimWeight * (mSum / mCount)
        weightSum += dimWeight
      }
    }

    const D = weightSum > 0 ? distSum / weightSum : 3
    const score = Math.max(0, Math.min(100, Math.round(100 * (1 - D / 3))))
    contributions.sort((a, b) => b.distance - a.distance || a.metricId.localeCompare(b.metricId))

    return {
      player: candidate,
      score,
      weightedDistance: D,
      contributions: contributions.slice(0, 3),
      excludedMetrics: [...new Set(excluded)].sort(),
    }
  })

  results.sort((a, b) => b.score - a.score || a.player.id.localeCompare(b.player.id))
  return results
}

/* ------------------------------------------------------------------ */
/* Composite score (spec §10 — opt-in, components always shown)        */
/* ------------------------------------------------------------------ */

/**
 * Composite = weighted mean of direction-adjusted peer percentiles across
 * dimensions. Each dimension score is the mean percentile of its available
 * metrics. Returns null when no dimension has usable data.
 */
export function compositeScore(
  player: Player,
  peers: Player[],
  weights: SimilarityWeights,
): number | null {
  const group = groupOf(player.position)
  let weightedSum = 0
  let weightSum = 0

  for (const dim of Object.keys(DIMENSION_METRICS) as Dimension[]) {
    const w = weights[dim] ?? 0
    if (w <= 0) continue
    const pcts: number[] = []
    for (const metricId of DIMENSION_METRICS[dim]) {
      const def = METRICS[metricId]
      if (!def || !def.available) continue
      if (def.appliesTo !== 'all') {
        const ok = def.appliesTo === 'outfield'
          ? group !== 'GK'
          : def.appliesTo.includes(group)
        if (!ok) continue
      }
      const value = metricPer90Value(player.stats, metricId)
      if (value === null) continue
      const peerValues = peers
        .map((p) => {
          const g = groupOf(p.position)
          const ok = def.appliesTo === 'all'
            || (def.appliesTo === 'outfield' ? g !== 'GK' : def.appliesTo.includes(g))
          return ok ? metricPer90Value(p.stats, metricId) : null
        })
        .filter((v): v is number => v !== null)
      const pct = percentile(value, peerValues, def.direction)
      if (pct !== null) pcts.push(pct)
    }
    if (pcts.length > 0) {
      weightedSum += w * (pcts.reduce((s, v) => s + v, 0) / pcts.length)
      weightSum += w
    }
  }

  if (weightSum === 0) return null
  return Math.round(weightedSum / weightSum)
}

/** Default role weights exposed for UI pickers. */
export function defaultWeightsForRole(role: RoleId): SimilarityWeights {
  return { ...ROLES[role].defaultWeights }
}
