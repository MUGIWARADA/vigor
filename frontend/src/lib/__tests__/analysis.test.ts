import { describe, expect, it } from 'vitest'
import type { Player, PlayerSeasonStats } from '@/types'
import {
  buildPeerGroupWithContext,
  compositeScore,
  computeSimilarity,
  defaultWeightsForRole,
  percentile,
} from '@/lib/analysis'
import { metricPer90Value } from '@/lib/metrics'
import { buildDemoDataset, DEMO_SOURCE_NAME } from '@/data/generate'

/* ------------------------------------------------------------------ */
/* Percentiles                                                         */
/* ------------------------------------------------------------------ */

describe('percentile', () => {
  it('returns null for peer groups smaller than 5', () => {
    expect(percentile(5, [1, 2, 3, 4])).toBeNull()
    expect(percentile(5, [])).toBeNull()
  })

  it('computes the share of peers beaten, plus half of ties', () => {
    const peers = [1, 2, 3, 4, 5]
    // value 3 beats 1 and 2, ties with 3 → (2 + 0.5) / 5 = 50
    expect(percentile(3, peers)).toBe(50)
    // value 6 beats all five, no ties → 100
    expect(percentile(6, peers)).toBe(100)
    // value 0 beats none → 0
    expect(percentile(0, peers)).toBe(0)
    // value 5 beats 4, ties with 5 → (4 + 0.5) / 5 = 90
    expect(percentile(5, peers)).toBe(90)
  })

  it('inverts the comparison for lower-is-better metrics', () => {
    const peers = [1, 2, 3, 4, 5]
    // lower is better: value 0 is the best (everyone is above it)
    expect(percentile(0, peers, 'lower')).toBe(100)
    // value 6 is the worst
    expect(percentile(6, peers, 'lower')).toBe(0)
    // value 3: two peers above it, one tie → (2 + 0.5) / 5 = 50
    expect(percentile(3, peers, 'lower')).toBe(50)
  })
})

/* ------------------------------------------------------------------ */
/* Per-90 & metric accessors                                           */
/* ------------------------------------------------------------------ */

describe('metricPer90Value', () => {
  const stats: PlayerSeasonStats = {
    appearances: 8, minutes: 720, starts: 8,
    goals: 6, assists: 2, shots: 24, xg: 5.1, xa: 2.4,
    passesAttempted: 300, passesCompleted: 261,
    forwardPassesAttempted: 100, forwardPassesCompleted: 78,
    progressivePasses: 40, passesFinalThird: 30, lineBreakingPasses: 20,
    carries: 90, progressiveCarries: 18, carriesFinalThird: 9,
    dribblesAttempted: 20, dribblesCompleted: 11,
    touches: 400, turnovers: 20, buildUpReceptions: 48, buildUpTurnovers: 6,
    tackles: 12, interceptions: 8, recoveries: 40, recoveriesFinalThird: 3,
    clearances: 5, aerialsWon: 10, aerialsContested: 18,
    tacklesWon: 8, shotsBlocked: 3,
    aerialsWonAttacking: 4, aerialsWonDefensive: 6, duelsContested: 34, duelsWon: 19,
    longPassesAttempted: 45, longPassesCompleted: 27,
    shortPassesAttempted: 255, shortPassesCompleted: 234,
    chancesCreated: 14, carryDistance: 900,
    saves: 0, xgPrevented: 0, penaltiesFaced: 0, penaltiesStopped: 0,
    positioningAttack: 65, positioningDefense: 60,
  }

  it('normalises count metrics per 90 minutes', () => {
    // 6 goals in 720 minutes = 8 matchdays → 0.75 per 90
    expect(metricPer90Value(stats, 'goals')).toBeCloseTo(0.75, 5)
  })

  it('passes rates through unchanged (computed from attempts and successes)', () => {
    expect(metricPer90Value(stats, 'pass_completion')).toBeCloseTo(87, 0)
    expect(metricPer90Value(stats, 'dribble_success')).toBeCloseTo(55, 0)
  })

  it('returns null for metrics unavailable in the dataset', () => {
    expect(metricPer90Value(stats, 'xt_added')).toBeNull()
    expect(metricPer90Value(stats, 'pressures_applied')).toBeNull()
    expect(metricPer90Value(stats, 'passes_between_lines')).toBeNull()
  })

  it('returns null for rates with zero attempts (never zero-filled)', () => {
    const noDribbles = { ...stats, dribblesAttempted: 0, dribblesCompleted: 0 }
    expect(metricPer90Value(noDribbles, 'dribble_success')).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Peer groups                                                         */
/* ------------------------------------------------------------------ */

describe('buildPeerGroupWithContext', () => {
  const ds = buildDemoDataset()
  const teams = new Map(ds.teams.map((t) => [t.id, t]))

  it('respects minimum minutes and position group', () => {
    const peers = buildPeerGroupWithContext(ds.players, teams, {
      positionGroup: 'ST',
      minMinutes: 400,
    })
    expect(peers.length).toBeGreaterThan(0)
    for (const p of peers) {
      expect(p.stats.minutes).toBeGreaterThanOrEqual(400)
      expect(['ST', 'SS', 'CF']).toContain(p.position)
    }
  })
})

/* ------------------------------------------------------------------ */
/* Similarity                                                          */
/* ------------------------------------------------------------------ */

const statsOf = (overrides: Partial<PlayerSeasonStats>, minutes = 630): PlayerSeasonStats => ({
  appearances: 7, minutes, starts: 7,
  goals: 0, assists: 0, shots: 0, xg: 0, xa: 0,
  passesAttempted: 300, passesCompleted: 250,
  forwardPassesAttempted: 100, forwardPassesCompleted: 70,
  progressivePasses: 30, passesFinalThird: 20, lineBreakingPasses: 10,
  carries: 80, progressiveCarries: 10, carriesFinalThird: 5,
  dribblesAttempted: 10, dribblesCompleted: 5,
  touches: 350, turnovers: 20, buildUpReceptions: 40, buildUpTurnovers: 5,
  tackles: 10, interceptions: 6, recoveries: 35, recoveriesFinalThird: 2,
    clearances: 4, aerialsWon: 8, aerialsContested: 15,
    tacklesWon: 7, shotsBlocked: 2,
    aerialsWonAttacking: 3, aerialsWonDefensive: 5, duelsContested: 30, duelsWon: 16,
    longPassesAttempted: 40, longPassesCompleted: 24,
    shortPassesAttempted: 260, shortPassesCompleted: 237,
    chancesCreated: 12, carryDistance: 850,
    saves: 0, xgPrevented: 0, penaltiesFaced: 0, penaltiesStopped: 0,
    positioningAttack: 62, positioningDefense: 58,
  ...overrides,
})

const makePlayer = (id: string, stats: PlayerSeasonStats): Player => ({
  id,
  name: `Player ${id}`,
  teamId: 't-atl',
  position: 'CM',
  role: 'box-to-box',
  foot: 'Right',
  dob: '1998-04-01',
  provenance: 'DEMO',
  sourceName: DEMO_SOURCE_NAME,
  stats,
  touchMap: [],
})

describe('computeSimilarity', () => {
  const target = makePlayer('p-target', statsOf({ goals: 3, assists: 5, xa: 3.2 }))
  const nearClone = makePlayer('p-clone', statsOf({ goals: 3, assists: 4, xa: 3.0 }))
  const different = makePlayer('p-diff', statsOf({ goals: 0, assists: 0, xa: 0.2, tackles: 30 }))
  const weights = defaultWeightsForRole('box-to-box')

  it('is deterministic — identical inputs produce identical output', () => {
    const a = computeSimilarity(target, { weights, candidates: [nearClone, different] })
    const b = computeSimilarity(target, { weights, candidates: [nearClone, different] })
    expect(a).toEqual(b)
  })

  it('ranks the statistical clone above the different profile', () => {
    const results = computeSimilarity(target, { weights, candidates: [different, nearClone] })
    expect(results[0]!.player.id).toBe('p-clone')
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score)
    expect(results[0]!.score).toBeGreaterThan(70)
  })

  it('excludes metrics missing for either player and reports them', () => {
    const noDribbler = makePlayer('p-nodribble', statsOf({ dribblesAttempted: 0, dribblesCompleted: 0 }))
    // Two other candidates give the take-on metric pool variance (z-scores).
    const varied = makePlayer('p-varied', statsOf({ goals: 1, assists: 1, dribblesAttempted: 24, dribblesCompleted: 9 }))
    const results = computeSimilarity(target, { weights, candidates: [noDribbler, varied, nearClone] })
    const noDribbleResult = results.find((r) => r.player.id === 'p-nodribble')!
    expect(noDribbleResult.excludedMetrics).toContain('dribble_success')
    // The clone has the metric available, so it is not excluded for them.
    const cloneResult = results.find((r) => r.player.id === 'p-clone')!
    expect(cloneResult.excludedMetrics).not.toContain('dribble_success')
  })

  it('explains the largest contributing metrics', () => {
    const results = computeSimilarity(target, { weights, candidates: [different] })
    const worst = results[0]!
    expect(worst.contributions.length).toBeGreaterThan(0)
    expect(worst.contributions.length).toBeLessThanOrEqual(3)
    for (const c of worst.contributions) {
      expect(c.distance).toBeGreaterThan(0)
    }
  })

  it('produces scores within 0–100', () => {
    const results = computeSimilarity(target, { weights, candidates: [nearClone, different] })
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(100)
    }
  })
})

/* ------------------------------------------------------------------ */
/* Composite                                                           */
/* ------------------------------------------------------------------ */

describe('compositeScore', () => {
  const ds = buildDemoDataset()
  const teams = new Map(ds.teams.map((t) => [t.id, t]))
  const peers = buildPeerGroupWithContext(ds.players, teams, {
    positionGroup: 'CM',
    minMinutes: 270,
  })
  const weights = defaultWeightsForRole('box-to-box')

  it('returns a 0–100 weighted percentile score for a valid player', () => {
    const player = peers[0]!
    const score = compositeScore(player, peers, weights)
    expect(score).not.toBeNull()
    expect(score!).toBeGreaterThanOrEqual(0)
    expect(score!).toBeLessThanOrEqual(100)
  })

  it('is deterministic', () => {
    const player = peers[0]!
    expect(compositeScore(player, peers, weights)).toBe(compositeScore(player, peers, weights))
  })
})
