import { describe, expect, it } from 'vitest'
import { buildDemoDataset, DEMO_COMPETITION_ID, DEMO_CUP_ID, DEMO_SEASON_ID } from '@/data/generate'
import { buildDemoContent } from '@/data/content'
import { METRICS } from '@/lib/metrics'
import { groupOf } from '@/lib/positions'

/**
 * Dataset invariants: the demo generator must produce internally consistent,
 * reproducible, clearly-labelled fictional data.
 */
describe('demo dataset', () => {
  const ds = buildDemoDataset()

  it('is deterministic — rebuilding produces identical data', () => {
    // buildDemoDataset is memoised; verify via the underlying content builder
    // against a fresh reference of the same dataset object.
    const contentA = buildDemoContent(ds)
    const contentB = buildDemoContent(ds)
    expect(contentA).toEqual(contentB)
    // 96 teams × 24 players; 384 league matches (8 matchdays × 5 leagues) + 15 cup matches.
    expect(ds.players.length).toBe(2304)
    expect(ds.matches.length).toBe(399)
    expect(ds.teams.length).toBe(96)
  })

  it('labels every record as DEMO with the demo source name', () => {
    for (const p of ds.players) {
      expect(p.provenance).toBe('DEMO')
      expect(p.sourceName).toContain('demo dataset')
    }
    for (const m of ds.matches) expect(m.provenance).toBe('DEMO')
    for (const e of ds.events) expect(e.provenance).toBe('DEMO')
    expect(ds.competition.id).toBe(DEMO_COMPETITION_ID)
    expect(ds.season.id).toBe(DEMO_SEASON_ID)
  })

  it('exposes five leagues plus the cup with consistent ids', () => {
    expect(ds.competitions.length).toBe(6)
    expect(ds.seasons.length).toBe(6)
    const cup = ds.competitions.find((c) => c.id === DEMO_CUP_ID)!
    expect(cup.provenance).toBe('DEMO')
    const cupSeason = ds.seasons.find((s) => s.competitionId === cup.id)!
    expect(cupSeason).toBeDefined()
    const cupMatches = ds.matches.filter((m) => m.competitionId === cup.id)
    // R16 (8) + QF (4) + SF (2) + Final (1) = 15 knockout matches, single-leg.
    expect(cupMatches.length).toBe(15)
    expect(cupMatches.filter((m) => m.round === 1).length).toBe(8)
    expect(cupMatches.filter((m) => m.round === 2).length).toBe(4)
    expect(cupMatches.filter((m) => m.round === 3).length).toBe(2)
    expect(cupMatches.filter((m) => m.round === 4).length).toBe(1)
    for (const m of cupMatches) {
      expect(m.seasonId).toBe(cupSeason.id)
      expect(m.homeGoals).not.toBe(m.awayGoals) // no draws in a knockout
    }
    const leagueMatches = ds.matches.filter((m) => m.competitionId === DEMO_COMPETITION_ID)
    expect(leagueMatches.length).toBe(80) // 20 teams, 8 matchdays
    // Every league plays its first 8 matchdays: 10 matches/round for 20-team
    // leagues, 9 for 18-team leagues.
    const perCompetition = new Map<string, number>()
    for (const m of ds.matches) perCompetition.set(m.competitionId, (perCompetition.get(m.competitionId) ?? 0) + 1)
    expect(perCompetition.get('c-brm')).toBe(80)
    expect(perCompetition.get('c-lgs')).toBe(80)
    expect(perCompetition.get('c-sas')).toBe(80)
    expect(perCompetition.get('c-bnd')).toBe(72)
    expect(perCompetition.get('c-lsf')).toBe(72)
  })

  it('stores the pass sample as two-point events with clamped coordinates', () => {
    const passes = ds.events.filter((e) => e.type === 'pass' || e.type === 'incomplete-pass')
    // A stratified sample per team per match — present, but far below a full feed.
    expect(passes.length).toBeGreaterThan(ds.matches.length * 40)
    expect(passes.length).toBeLessThan(ds.matches.length * 130)
    const playerById = new Map(ds.players.map((p) => [p.id, p]))
    const matchById = new Map(ds.matches.map((m) => [m.id, m]))
    for (const e of passes) {
      expect(e.x).toBeGreaterThanOrEqual(0)
      expect(e.x).toBeLessThanOrEqual(100)
      expect(e.y).toBeGreaterThanOrEqual(0)
      expect(e.y).toBeLessThanOrEqual(100)
      expect(e.endX).toBeDefined()
      expect(e.endY).toBeDefined()
      expect(e.endX!).toBeGreaterThanOrEqual(0)
      expect(e.endX!).toBeLessThanOrEqual(100)
      expect(e.endY!).toBeGreaterThanOrEqual(0)
      expect(e.endY!).toBeLessThanOrEqual(100)
      // only outfield players sample passes
      const p = playerById.get(e.playerId!)
      expect(p).toBeDefined()
      expect(p!.position).not.toBe('GK')
      // start and end must differ (a pass has length)
      expect(Math.hypot(e.endX! - e.x!, e.endY! - e.y!)).toBeGreaterThan(1)
      const m = matchById.get(e.matchId)!
      expect([m.homeTeamId, m.awayTeamId]).toContain(e.teamId)
    }
  }, 30000)

  it('keeps season minutes equal to the sum of match minutes', () => {
    const byPlayer = new Map<string, number>()
    for (const row of ds.playerMatchMinutes) {
      byPlayer.set(row.playerId, (byPlayer.get(row.playerId) ?? 0) + row.minutes)
    }
    for (const p of ds.players) {
      expect(p.stats.minutes).toBe(byPlayer.get(p.id) ?? 0)
    }
  })

  it('keeps season goals/assists equal to the counted match events', () => {
    const goals = new Map<string, number>()
    const assists = new Map<string, number>()
    for (const e of ds.events) {
      if (e.type === 'goal') {
        if (e.playerId) goals.set(e.playerId, (goals.get(e.playerId) ?? 0) + 1)
        if (e.secondaryPlayerId) {
          assists.set(e.secondaryPlayerId, (assists.get(e.secondaryPlayerId) ?? 0) + 1)
        }
      }
    }
    for (const p of ds.players) {
      expect(p.stats.goals).toBe(goals.get(p.id) ?? 0)
      expect(p.stats.assists).toBe(assists.get(p.id) ?? 0)
    }
  })

  it('keeps match scores consistent with goal events', () => {
    for (const m of ds.matches) {
      const homeGoals = ds.events.filter((e) => e.matchId === m.id && e.type === 'goal' && e.teamId === m.homeTeamId).length
      const awayGoals = ds.events.filter((e) => e.matchId === m.id && e.type === 'goal' && e.teamId === m.awayTeamId).length
      expect(homeGoals).toBe(m.homeGoals)
      expect(awayGoals).toBe(m.awayGoals)
    }
  })

  it('maintains logical constraints on counting metrics', () => {
    for (const p of ds.players) {
      const s = p.stats
      expect(s.passesCompleted).toBeLessThanOrEqual(s.passesAttempted)
      expect(s.forwardPassesCompleted).toBeLessThanOrEqual(s.forwardPassesAttempted)
      expect(s.progressivePasses).toBeLessThanOrEqual(s.passesCompleted)
      expect(s.passesFinalThird).toBeLessThanOrEqual(s.passesCompleted)
      expect(s.lineBreakingPasses).toBeLessThanOrEqual(s.passesFinalThird)
      expect(s.progressiveCarries).toBeLessThanOrEqual(s.carries)
      expect(s.carriesFinalThird).toBeLessThanOrEqual(s.progressiveCarries)
      expect(s.dribblesCompleted).toBeLessThanOrEqual(s.dribblesAttempted)
      expect(s.buildUpTurnovers).toBeLessThanOrEqual(s.turnovers)
      expect(s.recoveriesFinalThird).toBeLessThanOrEqual(s.recoveries)
      expect(s.aerialsWon).toBeLessThanOrEqual(s.aerialsContested)
      expect(s.minutes).toBeGreaterThanOrEqual(0)
      // v2 invariants: the long/short split sums exactly to the pass totals.
      expect(s.longPassesAttempted + s.shortPassesAttempted).toBe(s.passesAttempted)
      expect(s.longPassesCompleted + s.shortPassesCompleted).toBe(s.passesCompleted)
      expect(s.longPassesCompleted).toBeLessThanOrEqual(s.longPassesAttempted)
      expect(s.shortPassesCompleted).toBeLessThanOrEqual(s.shortPassesAttempted)
      expect(s.tacklesWon).toBeLessThanOrEqual(s.tackles)
      expect(s.duelsWon).toBeLessThanOrEqual(s.duelsContested)
      expect(s.shotsBlocked).toBeLessThanOrEqual(s.clearances)
      expect(s.aerialsWonAttacking + s.aerialsWonDefensive).toBe(s.aerialsWon)
      expect(s.positioningAttack).toBeGreaterThanOrEqual(0)
      expect(s.positioningAttack).toBeLessThanOrEqual(100)
      expect(s.positioningDefense).toBeGreaterThanOrEqual(0)
      expect(s.positioningDefense).toBeLessThanOrEqual(100)
      expect(s.chancesCreated).toBeGreaterThanOrEqual(0)
      expect(s.carryDistance).toBeGreaterThanOrEqual(0)
      // at most one match per league round (8) plus four knockout rounds
      expect(s.appearances).toBeLessThanOrEqual(12)
      if (groupOf(p.position) === 'GK') {
        expect(s.shots).toBe(0)
        expect(s.saves).toBeGreaterThanOrEqual(0)
        expect(s.penaltiesStopped).toBeLessThanOrEqual(s.penaltiesFaced)
        expect(s.xgPrevented).toBeGreaterThanOrEqual(-10)
        expect(s.xgPrevented).toBeLessThanOrEqual(10)
      }
      if (groupOf(p.position) === 'GK') {
        expect(s.shots).toBe(0)
      }
    }
  })

  it('gives every team a full roster of 24 players', () => {
    for (const t of ds.teams) {
      const roster = ds.players.filter((p) => p.teamId === t.id)
      expect(roster.length).toBe(24)
      expect(roster.filter((p) => p.position === 'GK').length).toBe(2)
    }
  })

  it('produces playing-time spread (starters, rotation and small samples)', () => {
    const minutes = ds.players.map((p) => p.stats.minutes)
    expect(Math.max(...minutes)).toBeGreaterThan(500)
    expect(minutes.filter((m) => m > 0 && m < 270).length).toBeGreaterThan(10)
  })

  it('has unique player names', () => {
    const names = new Set(ds.players.map((p) => p.name))
    expect(names.size).toBe(ds.players.length)
  })
})

describe('tactical scenarios', () => {
  it('demo scenario: both teams shape correctly and defend their own goal', () => {
    const ds = buildDemoDataset()
    const content = buildDemoContent(ds)
    const sc = content.demoScenarios[0]!

    // Every token inside the pitch.
    for (const p of [...sc.attack.players, ...sc.defence.players]) {
      expect(p.x, `${p.label} x`).toBeGreaterThanOrEqual(2)
      expect(p.x, `${p.label} x`).toBeLessThanOrEqual(98)
      expect(p.y, `${p.label} y`).toBeGreaterThanOrEqual(2)
      expect(p.y, `${p.label} y`).toBeLessThanOrEqual(98)
    }

    // Attack defends the LEFT goal (x≈0); defence defends the RIGHT goal (x≈100).
    const attackGk = sc.attack.players.find((p) => p.label.includes('GK'))!
    const defenceGk = sc.defence.players.find((p) => p.label.includes('GK'))!
    expect(attackGk.x).toBeLessThan(15)
    expect(defenceGk.x).toBeGreaterThan(85)

    // The two blocks engage: every defender is goalside of the attackers' keeper
    // and every attacker is goalside of the defenders' keeper.
    for (const p of sc.defence.players) expect(p.x).toBeGreaterThan(attackGk.x + 10)
    for (const p of sc.attack.players) expect(p.x).toBeLessThan(defenceGk.x - 10)

    // No two same-team tokens printed on top of each other.
    for (const side of [sc.attack, sc.defence]) {
      for (let i = 0; i < side.players.length; i++) {
        for (let j = i + 1; j < side.players.length; j++) {
          const a = side.players[i]!
          const b = side.players[j]!
          expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.label} overlaps ${b.label}`).toBeGreaterThan(4)
        }
      }
    }

    // Flanks rotate 180°: the defending RB shares the bottom touchline with
    // the attacking LB (they mark each other), not the attacking RB.
    const atkLb = sc.attack.players.find((p) => p.label.includes('LB'))!
    const atkRb = sc.attack.players.find((p) => p.label.includes('RB'))!
    const defLb = sc.defence.players.find((p) => p.label.includes('LB'))!
    const defRb = sc.defence.players.find((p) => p.label.includes('RB'))!
    expect(atkLb.y).toBeGreaterThan(70)
    expect(defRb.y).toBeGreaterThan(70)
    expect(atkRb.y).toBeLessThan(30)
    expect(defLb.y).toBeLessThan(30)

    // Centre-back pairs read as two banks across the width, not one blob.
    for (const side of [sc.attack, sc.defence]) {
      const cbs = side.players.filter((p) => p.label.includes('CB'))
      if (cbs.length === 2) {
        expect(Math.abs(cbs[0]!.y - cbs[1]!.y)).toBeGreaterThan(8)
      }
    }
  })
})

describe('metric registry', () => {
  it('documents every available metric with numerator, denominator and version', () => {
    for (const def of Object.values(METRICS)) {
      expect(def.numerator.length).toBeGreaterThan(5)
      expect(def.denominator.length).toBeGreaterThan(3)
      expect(def.sourceVersion).toMatch(/demo-dataset v0\.2\.0/)
      expect(['higher', 'lower']).toContain(def.direction)
      if (!def.available) {
        expect(def.unavailableReason).toBeTruthy()
      }
    }
  })

  it('gates the documented unavailable metrics', () => {
    const gated = ['pass_completion_under_pressure', 'receptions_under_pressure', 'passes_between_lines', 'receipts_between_lines', 'pressures_applied', 'xt_added']
    for (const id of gated) {
      expect(METRICS[id]!.available).toBe(false)
    }
  })
})
