import type { Match, MatchEvent, Player, PlayerMatchMinutes, Phase } from '@/types'
import { METRICS, MIN_MINUTES_FOR_PERCENTILE } from '@/lib/metrics'
import {
  computePhaseAnalysis,
  median,
  percentile,
  MIN_PEERS_FOR_PERCENTILE,
  type MetricAnalysisRow,
} from '@/lib/analysis'

/* ------------------------------------------------------------------ */
/* Event-derived contextual metrics (spec: Phase 3)                    */
/* ------------------------------------------------------------------ */

/**
 * Contextual metrics computed from STORED, source-attributed event records —
 * not from provider season aggregates. Every definition below is explicit,
 * deterministic and testable with known inputs:
 *
 *  - pass:              a completed 'pass' event (start + end point stored)
 *  - pass attempt:      'pass' + 'incomplete-pass' events
 *  - pass completion:   completions ÷ attempts (null when no attempts — never
 *                       zero-filled)
 *  - progressive pass:  a completed pass whose end point is at least 25%
 *                       closer to the opponent goal than its start point
 *                       (dist_end ≤ 0.75 × dist_start; Opta-style rule)
 *  - progressive carry: same 25%-closer rule applied to a
 *                       'progressive-carry' event's start and end points
 *  - final-third entry: a completed pass or carry whose start was outside the
 *                       attacking final third and whose end point is inside it
 *                       (final third = attacking-frame x ≥ 66.7)
 *  - build-up turnover: a 'turnover' event whose start lies in the own third
 *                       (attacking-frame x < 33.3)
 *
 * Attack direction is resolved per event from its match (home attacks toward
 * x=100; away events are stored rotated 180°). Metric values are per-90 over
 * the minutes the player actually played in the filtered match set.
 *
 * NOT derivable from event-only data (excluded, with reasons):
 *  - line_breaking_passes / passes_between_lines / receipts_between_lines —
 *    require the opposing players' positions at pass time (tracking data).
 */

export interface EventMetricFilters {
  /** Restrict to one competition (league / cup); omit or 'all' for both. */
  competitionId?: string | 'all'
  /** Restrict to one season; omit or 'all' for every season. */
  seasonId?: string | 'all'
}

export interface EventMetricSet {
  playerId: string
  /** Minutes played in the filtered match set. */
  minutes: number
  /** Matches with minutes in the filtered match set. */
  matches: number
  /** Positioned stored events attributed to the player (sample size). */
  eventCount: number
  passAttempts: number
  passCompletions: number
  progressivePasses: number
  progressiveCarries: number
  passesFinalThird: number
  carriesFinalThird: number
  turnoversAll: number
  buildUpTurnovers: number
}

const FINAL_THIRD_X = 100 / 3 * 2
const OWN_THIRD_X = 100 / 3
const GOAL = { x: 100, y: 50 }

/** Distance from an attacking-frame point to the opponent goal. */
function distToGoal(fx: number, fy: number): number {
  return Math.hypot(GOAL.x - fx, GOAL.y - fy)
}

/** Convert an absolute pitch point into the team's attacking frame. */
function toAttackFrame(point: { x: number; y: number }, attackingRight: boolean) {
  return attackingRight ? point : { x: 100 - point.x, y: 100 - point.y }
}

/**
 * Build per-player event metric sets from the stored records. Pure and
 * deterministic: same inputs → same outputs.
 */
export function buildEventMetrics(
  events: MatchEvent[],
  matches: Match[],
  minutesRows: PlayerMatchMinutes[],
  filters: EventMetricFilters = {},
): Map<string, EventMetricSet> {
  const matchById = new Map(matches.map((m) => [m.id, m]))
  const matchAllowed = (m: Match) =>
    (!filters.competitionId || filters.competitionId === 'all' || m.competitionId === filters.competitionId)
    && (!filters.seasonId || filters.seasonId === 'all' || m.seasonId === filters.seasonId)

  const sets = new Map<string, EventMetricSet>()
  const setOf = (playerId: string): EventMetricSet => {
    let s = sets.get(playerId)
    if (!s) {
      s = {
        playerId,
        minutes: 0,
        matches: 0,
        eventCount: 0,
        passAttempts: 0,
        passCompletions: 0,
        progressivePasses: 0,
        progressiveCarries: 0,
        passesFinalThird: 0,
        carriesFinalThird: 0,
        turnoversAll: 0,
        buildUpTurnovers: 0,
      }
      sets.set(playerId, s)
    }
    return s
  }

  // Minutes denominators, restricted to the filtered match set.
  for (const row of minutesRows) {
    const m = matchById.get(row.matchId)
    if (!m || !matchAllowed(m)) continue
    const s = setOf(row.playerId)
    s.minutes += row.minutes
    if (row.minutes > 0) s.matches += 1
  }

  for (const e of events) {
    if (e.x === undefined || e.y === undefined || !e.playerId) continue
    const m = matchById.get(e.matchId)
    if (!m || !matchAllowed(m)) continue
    const s = setOf(e.playerId)
    s.eventCount += 1

    const attackingRight = e.teamId === m.homeTeamId
    const start = toAttackFrame({ x: e.x, y: e.y }, attackingRight)

    if (e.type === 'pass' || e.type === 'incomplete-pass') {
      s.passAttempts += 1
      if (e.type === 'pass') {
        s.passCompletions += 1
        if (e.endX !== undefined && e.endY !== undefined) {
          const end = toAttackFrame({ x: e.endX, y: e.endY }, attackingRight)
          if (distToGoal(end.x, end.y) <= 0.75 * distToGoal(start.x, start.y)) {
            s.progressivePasses += 1
          }
          if (start.x < FINAL_THIRD_X && end.x >= FINAL_THIRD_X) {
            s.passesFinalThird += 1
          }
        }
      }
    } else if (e.type === 'progressive-carry') {
      if (e.endX !== undefined && e.endY !== undefined) {
        const end = toAttackFrame({ x: e.endX, y: e.endY }, attackingRight)
        if (distToGoal(end.x, end.y) <= 0.75 * distToGoal(start.x, start.y)) {
          s.progressiveCarries += 1
        }
        if (start.x < FINAL_THIRD_X && end.x >= FINAL_THIRD_X) {
          s.carriesFinalThird += 1
        }
      }
    } else if (e.type === 'turnover') {
      s.turnoversAll += 1
      if (start.x < OWN_THIRD_X) s.buildUpTurnovers += 1
    }
  }

  return sets
}

/* ------------------------------------------------------------------ */
/* Registry integration                                                */
/* ------------------------------------------------------------------ */

const per90 = (value: number, minutes: number): number | null =>
  minutes > 0 ? (value / minutes) * 90 : null

/** Metric ids the event store can compute, with their extractors. */
export const EVENT_DERIVED_METRICS: Record<string, {
  /** Per-90 value (or rate, %) for the metric row. */
  value: (s: EventMetricSet) => number | null
  /** Raw season value (count or rate). */
  raw: (s: EventMetricSet) => number | null
  /** Peer comparability guard — e.g. rates need attempts. */
  eligible?: (s: EventMetricSet) => boolean
}> = {
  pass_completion: {
    value: (s) => (s.passAttempts > 0 ? (s.passCompletions / s.passAttempts) * 100 : null),
    raw: (s) => (s.passAttempts > 0 ? (s.passCompletions / s.passAttempts) * 100 : null),
    eligible: (s) => s.passAttempts > 0,
  },
  progressive_passes: {
    value: (s) => per90(s.progressivePasses, s.minutes),
    raw: (s) => s.progressivePasses,
    eligible: (s) => s.minutes > 0,
  },
  progressive_carries: {
    value: (s) => per90(s.progressiveCarries, s.minutes),
    raw: (s) => s.progressiveCarries,
    eligible: (s) => s.minutes > 0,
  },
  passes_final_third: {
    value: (s) => per90(s.passesFinalThird, s.minutes),
    raw: (s) => s.passesFinalThird,
    eligible: (s) => s.minutes > 0,
  },
  carries_final_third: {
    value: (s) => per90(s.carriesFinalThird, s.minutes),
    raw: (s) => s.carriesFinalThird,
    eligible: (s) => s.minutes > 0,
  },
  build_up_turnovers: {
    value: (s) => per90(s.buildUpTurnovers, s.minutes),
    raw: (s) => s.buildUpTurnovers,
    eligible: (s) => s.minutes > 0,
  },
  turnovers: {
    value: (s) => per90(s.turnoversAll, s.minutes),
    raw: (s) => s.turnoversAll,
    eligible: (s) => s.minutes > 0,
  },
}

/** Metrics that explicitly CANNOT be derived from event-only records. */
export const EVENT_UNAVAILABLE_REASONS: Record<string, string> = {
  line_breaking_passes: 'requires the opposing line geometry at pass time (tracking data) — not derivable from event-only records',
  passes_between_lines: 'requires the opposing line geometry at pass time (tracking data) — not derivable from event-only records',
  receipts_between_lines: 'requires the opposing line geometry at receipt time (tracking data) — not derivable from event-only records',
}

/**
 * Build an analysis row from event-derived values, percentile-ranked against
 * the peers' event-derived values (same filters, same sample mechanism — an
 * apples-to-apples comparison).
 */
export function computeEventMetricRow(
  player: Player,
  peers: Player[],
  metricId: string,
  source: Map<string, EventMetricSet>,
): MetricAnalysisRow | null {
  const spec = EVENT_DERIVED_METRICS[metricId]
  const def = METRICS[metricId]
  if (!spec || !def) return null

  const own = source.get(player.id)
  const value = own ? spec.value(own) : null
  const rawValue = own ? spec.raw(own) : null

  const peerValues = peers
    .map((p) => source.get(p.id))
    .filter((s): s is EventMetricSet => !!s && (!spec.eligible || spec.eligible(s)))
    .map((s) => spec.value(s))
    .filter((v): v is number => v !== null)

  const pct = value !== null && peerValues.length >= MIN_PEERS_FOR_PERCENTILE
    ? percentile(value, peerValues, def.direction)
    : null

  const peerMed = median(peerValues)
  const peerBest = peerValues.length > 0
    ? (def.direction === 'higher' ? Math.max(...peerValues) : Math.min(...peerValues))
    : null

  let interpretation: string | null = null
  if (value === null) {
    interpretation = 'No qualifying events in this sample for the selected filters.'
  } else if (pct !== null) {
    const band = pct >= 90 ? 'elite' : pct >= 75 ? 'strong' : pct >= 25 ? 'middling' : 'low'
    interpretation =
      `${band === 'middling' ? 'Around the middle of the peer group' : `${band[0]!.toUpperCase()}${band.slice(1)} in this peer group`} ` +
      `(${pct.toFixed(0)}th percentile, ${def.direction === 'higher' ? 'higher' : 'lower'} is better` +
      (peerMed !== null ? `, peer median ${peerMed.toFixed(def.decimals)}` : '') + ').'
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
    minutes: own?.minutes ?? 0,
    matches: own?.matches ?? 0,
    smallSample: (own?.minutes ?? 0) < MIN_MINUTES_FOR_PERCENTILE,
    peerGroupTooSmall: peerValues.length < MIN_PEERS_FOR_PERCENTILE,
    interpretation,
    source: 'EVENTS',
    sampleEvents: own?.eventCount ?? 0,
  }
}

/**
 * Phase analysis with event-derived values where the event store supports the
 * metric; provider demo stats fill the rest (each row carries its source).
 */
export function computePhaseAnalysisWithEvents(
  player: Player,
  peers: Player[],
  phase: Phase,
  source: Map<string, EventMetricSet>,
): { rows: MetricAnalysisRow[]; unavailableRows: MetricAnalysisRow[] } {
  const base = computePhaseAnalysis(player, peers, phase)
  const rows = base.rows.map((row) => {
    if (EVENT_DERIVED_METRICS[row.metricId]) {
      const eventRow = computeEventMetricRow(player, peers, row.metricId, source)
      if (eventRow) return eventRow
    }
    return row
  })
  return { rows, unavailableRows: base.unavailableRows }
}
