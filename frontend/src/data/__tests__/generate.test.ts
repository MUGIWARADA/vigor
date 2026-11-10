import { describe, expect, it } from 'vitest'
import { buildDemoDataset } from '@/data/generate'

const ds = buildDemoDataset()

describe('demo dataset positional invariants', () => {
  it('is deterministic across builds', () => {
    expect(buildDemoDataset()).toEqual(ds)
  }, 30000)

  it('keeps every positioned event inside the pitch', () => {
    for (const e of ds.events) {
      if (e.x === undefined) {
        expect(e.y).toBeUndefined()
        continue
      }
      expect(e.x).toBeGreaterThanOrEqual(0)
      expect(e.x).toBeLessThanOrEqual(100)
      expect(e.y!).toBeGreaterThanOrEqual(0)
      expect(e.y!).toBeLessThanOrEqual(100)
    }
  }, 30000)

  it('respects attack direction: home goals near x=100, away goals mirrored near x=0', () => {
    for (const m of ds.matches) {
      const goals = ds.events.filter((e) => e.matchId === m.id && e.type === 'goal' && e.x !== undefined)
      for (const g of goals) {
        if (g.teamId === m.homeTeamId) {
          expect(g.x!).toBeGreaterThan(50)
        } else {
          expect(g.x!).toBeLessThan(50)
        }
      }
    }
  }, 30000)

  it('emits exactly the recorded number of shot events per match', () => {
    for (const m of ds.matches) {
      const shots = ds.events.filter((e) => e.matchId === m.id && e.type === 'shot')
      expect(shots.length).toBe(m.shotsHome + m.shotsAway)
    }
  }, 30000)

  it('assigns classic, unique shirt numbers within each team', () => {
    const byTeam = new Map<string, number[]>()
    for (const p of ds.players) {
      expect(p.shirtNumber).toBeDefined()
      expect(p.shirtNumber!).toBeGreaterThanOrEqual(1)
      expect(p.shirtNumber!).toBeLessThanOrEqual(99)
      const list = byTeam.get(p.teamId) ?? []
      list.push(p.shirtNumber!)
      byTeam.set(p.teamId, list)
    }
    for (const [teamId, numbers] of byTeam) {
      expect(new Set(numbers).size).toBe(numbers.length)
      // Every squad numbers a goalkeeper 1.
      const gk = ds.players.find((p) => p.teamId === teamId && p.position === 'GK')!
      expect(gk.shirtNumber).toBe(1)
    }
  }, 30000)

  it('shapes average positions into recognisable formation banks (SofaScore-style)', () => {
    const ds = buildDemoDataset()
    const m = ds.matches[0]!
    const avgOf = (playerId: string) => {
      const evs = ds.events.filter((e) => e.matchId === m.id && e.playerId === playerId && e.x !== undefined && e.type !== 'substitution')
      if (evs.length === 0) return null
      const n = evs.length
      return { x: evs.reduce((s, e) => s + e.x!, 0) / n, y: evs.reduce((s, e) => s + e.y!, 0) / n, n }
    }
    for (const teamId of [m.homeTeamId, m.awayTeamId]) {
      const starters = ds.playerMatchMinutes
        .filter((r) => r.matchId === m.id && r.starter)
        .map((r) => ds.players.find((p) => p.id === r.playerId)!)
        .filter((p) => p && p.teamId === teamId)
      const avgs = starters.map((p) => ({ p, avg: avgOf(p.id) }))
      // Every starter — including the keeper — has an average position.
      for (const { p, avg } of avgs) expect(avg, `no average for ${p.name}`).not.toBeNull()
      const gk = avgs.find(({ p }) => p.position === 'GK')!
      const cbs = avgs.filter(({ p }) => p.position === 'CB')
      const outfield = avgs.filter(({ p }) => p.position !== 'GK')
      // Keeper is the deepest player: no outfielder sits level with or behind
      // him (away side is mirrored, so the comparison flips).
      const home = teamId === m.homeTeamId
      for (const { p, avg } of outfield) {
        if (home) expect(avg!.x, `${p.name} deeper than the keeper`).toBeGreaterThan(gk.avg!.x - 4)
        else expect(avg!.x, `${p.name} deeper than the keeper`).toBeLessThan(gk.avg!.x + 4)
      }
      // A centre-back pair reads as two distinct banks, not one blob.
      if (cbs.length === 2) {
        expect(Math.abs(cbs[0]!.avg!.y - cbs[1]!.avg!.y)).toBeGreaterThan(8)
      }
      // Real match-map geometry: the away team is rotated 180°, so the away
      // left-back shares a flank with the home RIGHT-back, not the home LB.
      const lbs = avgs.filter(({ p }) => p.position === 'LB')
      const rbs = avgs.filter(({ p }) => p.position === 'RB')
      if (!home && lbs.length === 1 && rbs.length === 1) {
        expect(lbs[0]!.avg!.y).toBeLessThan(35)
        expect(rbs[0]!.avg!.y).toBeGreaterThan(65)
      }
      // The front line sits clearly higher than the centre-backs.
      const forwards = avgs.filter(({ p }) => ['ST', 'LW', 'RW'].includes(p.position))
      if (forwards.length > 0 && cbs.length > 0) {
        const fwdX = forwards.reduce((s, f) => s + f.avg!.x, 0) / forwards.length
        const cbX = cbs.reduce((s, c) => s + c.avg!.x, 0) / cbs.length
        expect(Math.abs(fwdX - cbX)).toBeGreaterThan(15)
      }
    }
  }, 30000)

  it('gives most starters several positioned events (enough for positional overlays)', () => {
    const minutesByMatch = new Map<string, Map<string, number>>()
    for (const r of ds.playerMatchMinutes) {
      const byMatch = minutesByMatch.get(r.matchId) ?? new Map<string, number>()
      byMatch.set(r.playerId, r.minutes)
      minutesByMatch.set(r.matchId, byMatch)
    }
    const positionedByMatchPlayer = new Map<string, number>()
    for (const e of ds.events) {
      if (e.playerId && e.x !== undefined) {
        const key = `${e.matchId}:${e.playerId}`
        positionedByMatchPlayer.set(key, (positionedByMatchPlayer.get(key) ?? 0) + 1)
      }
    }
    let starters = 0
    let covered = 0
    for (const [matchId, byPlayer] of minutesByMatch) {
      for (const [playerId, minutes] of byPlayer) {
        if (minutes < 60) continue
        starters++
        if ((positionedByMatchPlayer.get(`${matchId}:${playerId}`) ?? 0) >= 3) covered++
      }
    }
    // Deterministic dataset: assert a strong but not absolute floor.
    expect(covered / starters).toBeGreaterThan(0.85)
  }, 30000)
})
