import { describe, expect, it } from 'vitest'
import { buildDemoDataset } from '@/data/generate'
import { computePlayerCarryMap, computePlayerPassMap, PROGRESSIVE_THRESHOLD } from '@/lib/playerMaps'
import type { Match, MatchEvent, Player } from '@/types'

const ds = buildDemoDataset()

function mkMatch(id: string, homeTeamId: string, awayTeamId: string): Match {
  return {
    id, competitionId: 'c', seasonId: 's', round: 1, kickoff: '2026-09-01T12:00:00Z',
    homeTeamId, awayTeamId, homeGoals: 0, awayGoals: 0, venue: 'V',
    possessionHome: 50, shotsHome: 0, shotsAway: 0, provenance: 'DEMO',
  }
}

function passEvent(id: string, matchId: string, teamId: string, x: number, y: number, endX: number, type: MatchEvent['type'] = 'pass'): MatchEvent {
  return { id, matchId, minute: 10, type, teamId, playerId: 'p1', x, y, endX, endY: y, provenance: 'DEMO' }
}

const player = { id: 'p1', teamId: 't-away' } as Player

describe('computePlayerPassMap orientation', () => {
  it('rotates away-team segments 180° so the player attacks right', () => {
    // Stored: away team attacking LEFT — pass from x=70 (their right flank
    // y=84 in stored frame) to x=52. Normalised: x 30→48 (progressive), y=16.
    const matches = [mkMatch('m1', 't-home', 't-away')]
    const events = [passEvent('e1', 'm1', 't-away', 70, 84, 52)]
    const map = computePlayerPassMap(events, matches, player)
    const seg = map.completed[0]!
    expect(seg.x).toBe(30)
    expect(seg.endX).toBe(48)
    expect(seg.y).toBe(16)
    expect(seg.progression).toBe(18)
    expect(seg.progressive).toBe(true)
    expect(map.channels.left).toBe(100)
  })

  it('classifies progressive and final-third entries and counts the sample honestly', () => {
    const matches = [mkMatch('m1', 't-home', 't-away')]
    const events = [
      passEvent('e1', 'm1', 't-home', 60, 50, 75), // (player is away team member? no—playerId matches, teamId drives orientation)
    ]
    // Home orientation: x 60→75 crosses into final third, progression 15.
    const homePlayer = { id: 'p1', teamId: 't-home' } as Player
    const map = computePlayerPassMap(
      [...events, passEvent('e2', 'm1', 't-home', 40, 50, 45, 'incomplete-pass')],
      matches,
      homePlayer,
    )
    expect(map.sampleCompleted).toBe(1)
    expect(map.sampleIncomplete).toBe(1)
    expect(map.completionPct).toBe(50)
    expect(map.completed[0]!.finalThirdEntry).toBe(true)
    expect(map.completed[0]!.progression).toBeGreaterThanOrEqual(PROGRESSIVE_THRESHOLD)
  })
})

describe('player maps on the demo dataset', () => {
  it('produces non-empty maps whose summaries reconcile with the segments', () => {
    const cm = ds.players.find((p) => p.position === 'CM' && p.stats.minutes > 700)!
    const pm = computePlayerPassMap(ds.events, ds.matches, cm)
    expect(pm.sampleCompleted).toBeGreaterThan(0)
    expect(pm.progressiveCount).toBe(pm.completed.filter((s) => s.progressive).length)
    expect(pm.finalThirdEntries).toBe(pm.completed.filter((s) => s.finalThirdEntry).length)

    const cmMap = computePlayerCarryMap(ds.events, ds.matches, cm)
    expect(cmMap.count).toBe(cmMap.carries.length)
    for (const c of cmMap.carries) {
      // Carries are generated toward the opponent goal: after normalisation
      // every carry must progress forward.
      expect(c.progression).toBeGreaterThan(0)
    }
  })
})
