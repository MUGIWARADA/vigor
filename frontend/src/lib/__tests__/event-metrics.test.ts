import { describe, expect, it } from 'vitest'
import type { Match, MatchEvent, PlayerMatchMinutes } from '@/types'
import { buildEventMetrics, EVENT_DERIVED_METRICS, EVENT_UNAVAILABLE_REASONS } from '@/lib/eventMetrics'

/* ------------------------------------------------------------------ */
/* Event-metric derivation: known inputs → expected outputs.            */
/* Every fixture below is hand-crafted so the assertion checks the      */
/* DEFINITION (25%-closer rule, mirroring, third boundaries), not the   */
/* generator.                                                          */
/* ------------------------------------------------------------------ */

const baseMatch = (over: Partial<Match>): Match => ({
  id: 'm-001',
  competitionId: 'c-apl',
  seasonId: 's-2026-27',
  round: 1,
  kickoff: '2026-08-08T14:30:00.000Z',
  venue: 'Demo Park',
  homeTeamId: 't-home',
  awayTeamId: 't-away',
  homeGoals: 0,
  awayGoals: 0,
  possessionHome: 50,
  shotsHome: 0,
  shotsAway: 0,
  provenance: 'DEMO',
  ...over,
})

const baseEvent = (over: Partial<MatchEvent>): MatchEvent => ({
  id: `e-${Math.random().toString(36).slice(2)}`,
  matchId: 'm-001',
  minute: 10,
  type: 'pass',
  teamId: 't-home',
  playerId: 'p-1',
  x: 50,
  y: 50,
  provenance: 'DEMO',
  ...over,
})

const minutesRow = (playerId: string, minutes: number, matchId = 'm-001'): PlayerMatchMinutes => ({
  playerId,
  matchId,
  minutes,
  starter: minutes >= 60,
  rating: 6.5,
})

describe('buildEventMetrics — progression definitions', () => {
  it('counts a pass that moves 25% closer to goal as progressive (boundary: dist 40 → 30)', () => {
    // Home player (attacks right). Start (50, 50): dist to (100, 50) = 50... craft exact:
    // start (60, 50) → dist 40; end (70, 50) → dist 30 = 0.75 × 40 → progressive.
    const events = [baseEvent({ x: 60, y: 50, endX: 70, endY: 50 })]
    const s = buildEventMetrics(events, [baseMatch({})], [minutesRow('p-1', 90)])
    const own = s.get('p-1')!
    expect(own.passAttempts).toBe(1)
    expect(own.passCompletions).toBe(1)
    expect(own.progressivePasses).toBe(1)
  })

  it('does NOT count a sideways pass (same distance to goal)', () => {
    // (60, 40) → (60, 60): both dist √(40² + 10²) — pure lateral move.
    const events = [baseEvent({ x: 60, y: 40, endX: 60, endY: 60 })]
    const s = buildEventMetrics(events, [baseMatch({})], [minutesRow('p-1', 90)])
    expect(s.get('p-1')!.progressivePasses).toBe(0)
  })

  it('does not count a pass that improves distance by less than 25%', () => {
    // dist 40 → 31 (> 30 = 0.75 × 40): forward but not progressive.
    const events = [baseEvent({ x: 60, y: 50, endX: 69, endY: 50 })]
    const s = buildEventMetrics(events, [baseMatch({})], [minutesRow('p-1', 90)])
    expect(s.get('p-1')!.progressivePasses).toBe(0)
  })

  it('applies the same rule to carries', () => {
    const events = [
      baseEvent({ type: 'progressive-carry', x: 60, y: 50, endX: 75, endY: 50 }), // dist 40 → 25 ✓
      baseEvent({ type: 'progressive-carry', x: 20, y: 50, endX: 30, endY: 50, minute: 30 }), // dist 80 → 70 ✗
    ]
    const s = buildEventMetrics(events, [baseMatch({})], [minutesRow('p-1', 90)])
    expect(s.get('p-1')!.progressiveCarries).toBe(1)
  })

  it('mirrors away-team coordinates 180° before measuring (away attacks LEFT in storage)', () => {
    // Away pass stored at x 40 → frame x 60 (dist 40); end x 30 → frame 70 (dist 30) → progressive.
    const events = [baseEvent({ teamId: 't-away', playerId: 'p-2', x: 40, y: 50, endX: 30, endY: 50 })]
    const s = buildEventMetrics(events, [baseMatch({})], [minutesRow('p-2', 90)])
    expect(s.get('p-2')!.progressivePasses).toBe(1)
  })

  it('does NOT count a backwards away pass as progressive', () => {
    // Away pass stored x 40 → 50: frame 60 → 50, moving AWAY from goal.
    const events = [baseEvent({ teamId: 't-away', playerId: 'p-2', x: 40, y: 50, endX: 50, endY: 50 })]
    const s = buildEventMetrics(events, [baseMatch({})], [minutesRow('p-2', 90)])
    expect(s.get('p-2')!.progressivePasses).toBe(0)
  })
})

describe('buildEventMetrics — final third, completion, turnovers', () => {
  it('counts a final-third entry only when the start is outside and the end inside', () => {
    const events = [
      baseEvent({ x: 60, y: 50, endX: 68, endY: 50 }), // 60 → 68 crosses 66.67 ✓
      baseEvent({ x: 70, y: 50, endX: 80, endY: 50, minute: 20 }), // already inside ✗
      baseEvent({ x: 60, y: 50, endX: 65, endY: 50, minute: 30 }), // stays outside ✗
    ]
    const s = buildEventMetrics(events, [baseMatch({})], [minutesRow('p-1', 90)])
    expect(s.get('p-1')!.passesFinalThird).toBe(1)
  })

  it('counts final-third carries separately from passes', () => {
    const events = [
      baseEvent({ type: 'progressive-carry', x: 60, y: 50, endX: 70, endY: 50 }),
      baseEvent({ type: 'progressive-carry', x: 70, y: 50, endX: 80, endY: 50, minute: 40 }), // inside → inside
    ]
    const s = buildEventMetrics(events, [baseMatch({})], [minutesRow('p-1', 90)])
    expect(s.get('p-1')!.carriesFinalThird).toBe(1)
  })

  it('computes completion from pass + incomplete-pass events, null when no attempts', () => {
    const events = [
      baseEvent({ type: 'pass' }),
      baseEvent({ type: 'pass', minute: 20 }),
      baseEvent({ type: 'incomplete-pass', minute: 30 }),
    ]
    const withAttempts = buildEventMetrics(events, [baseMatch({})], [minutesRow('p-1', 90)])
    expect(withAttempts.get('p-1')!.passAttempts).toBe(3)
    expect(withAttempts.get('p-1')!.passCompletions).toBe(2)
    expect(EVENT_DERIVED_METRICS.pass_completion!.value(withAttempts.get('p-1')!)).toBeCloseTo(66.6667, 3)

    const noAttempts = buildEventMetrics([], [baseMatch({})], [minutesRow('p-1', 90)])
    expect(EVENT_DERIVED_METRICS.pass_completion!.value(noAttempts.get('p-1')!)).toBeNull()
  })

  it('classifies build-up turnovers by the own-third boundary (frame x < 33.3)', () => {
    const events = [
      baseEvent({ type: 'turnover', x: 33, y: 50 }), // own third ✓
      baseEvent({ type: 'turnover', x: 34, y: 50, minute: 20 }), // middle third ✗
      baseEvent({ type: 'turnover', teamId: 't-away', playerId: 'p-2', x: 67, y: 50, minute: 30 }), // away: frame 33 ✓
    ]
    const s = buildEventMetrics(events, [baseMatch({})], [minutesRow('p-1', 90), minutesRow('p-2', 90)])
    expect(s.get('p-1')!.turnoversAll).toBe(2)
    expect(s.get('p-1')!.buildUpTurnovers).toBe(1)
    expect(s.get('p-2')!.buildUpTurnovers).toBe(1)
  })
})

describe('buildEventMetrics — per-90 and filters', () => {
  it('converts counts to per-90 using played minutes', () => {
    // 3 progressive passes in 180 minutes = 1.5 per 90.
    const events = [
      baseEvent({ x: 60, y: 50, endX: 70, endY: 50 }),
      baseEvent({ x: 60, y: 50, endX: 70, endY: 50, minute: 20 }),
      baseEvent({ x: 60, y: 50, endX: 70, endY: 50, minute: 30 }),
    ]
    const s = buildEventMetrics(events, [baseMatch({})], [minutesRow('p-1', 180)])
    expect(EVENT_DERIVED_METRICS.progressive_passes!.value(s.get('p-1')!)).toBeCloseTo(1.5, 6)
  })

  it('scopes matches by competition and season filters', () => {
    const league = baseMatch({})
    const cup = baseMatch({ id: 'm-002', competitionId: 'c-ac', seasonId: 's-cup' })
    const events = [
      baseEvent({ x: 60, y: 50, endX: 70, endY: 50 }), // league
      baseEvent({ matchId: 'm-002', x: 60, y: 50, endX: 70, endY: 50, minute: 20 }), // cup
    ]
    const minutes = [minutesRow('p-1', 90), minutesRow('p-1', 90, 'm-002')]

    const all = buildEventMetrics(events, [league, cup], minutes, {})
    expect(all.get('p-1')!.progressivePasses).toBe(2)
    expect(all.get('p-1')!.minutes).toBe(180)

    const leagueOnly = buildEventMetrics(events, [league, cup], minutes, { competitionId: 'c-apl' })
    expect(leagueOnly.get('p-1')!.progressivePasses).toBe(1)
    expect(leagueOnly.get('p-1')!.minutes).toBe(90)

    const cupOnly = buildEventMetrics(events, [league, cup], minutes, { seasonId: 's-cup' })
    expect(cupOnly.get('p-1')!.progressivePasses).toBe(1)

    const allKeyword = buildEventMetrics(events, [league, cup], minutes, { competitionId: 'all' })
    expect(allKeyword.get('p-1')!.progressivePasses).toBe(2)
  })

  it('ignores events whose match is missing from the match list', () => {
    const events = [baseEvent({ matchId: 'm-gone' })]
    const s = buildEventMetrics(events, [baseMatch({})], [minutesRow('p-1', 90)])
    expect(s.get('p-1')?.eventCount ?? 0).toBe(0)
  })

  it('ignores unpositioned events', () => {
    const events = [baseEvent({ x: undefined, y: undefined, endX: undefined, endY: undefined })]
    const s = buildEventMetrics(events, [baseMatch({})], [minutesRow('p-1', 90)])
    expect(s.get('p-1')?.eventCount ?? 0).toBe(0)
  })
})

describe('event-derived metric registry contract', () => {
  it('declares why line-breaking passes cannot be event-derived', () => {
    expect(EVENT_UNAVAILABLE_REASONS.line_breaking_passes).toMatch(/tracking data/)
    expect(EVENT_DERIVED_METRICS.line_breaking_passes).toBeUndefined()
  })

  it('never zero-fills pass completion (null when no attempts)', () => {
    const empty: import('@/lib/eventMetrics').EventMetricSet = {
      playerId: 'p-1',
      minutes: 90,
      matches: 1,
      eventCount: 5,
      passAttempts: 0,
      passCompletions: 0,
      progressivePasses: 0,
      progressiveCarries: 0,
      passesFinalThird: 0,
      carriesFinalThird: 0,
      turnoversAll: 0,
      buildUpTurnovers: 0,
    }
    expect(EVENT_DERIVED_METRICS.pass_completion!.value(empty)).toBeNull()
    expect(EVENT_DERIVED_METRICS.pass_completion!.eligible!(empty)).toBe(false)
  })
})
