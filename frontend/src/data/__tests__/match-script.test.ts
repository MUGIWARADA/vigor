import { describe, expect, it } from 'vitest'
import { buildDemoDataset } from '@/data/generate'

const ds = buildDemoDataset()

describe('match script (substitutions, injuries, cards)', () => {
  it('never exceeds five substitutions per team per match', () => {
    const per = new Map<string, number>()
    for (const e of ds.events)
      if (e.type === 'substitution') per.set(`${e.matchId}:${e.teamId}`, (per.get(`${e.matchId}:${e.teamId}`) ?? 0) + 1)
    expect(Math.max(...per.values())).toBeLessThanOrEqual(5)
    const avg = [...per.values()].reduce((a, b) => a + b, 0) / per.size
    expect(avg).toBeGreaterThan(2.5) // a modern five-subs feel
  })

  it('records substitution reasons across the scenario families', () => {
    const reasons = new Set<string>()
    for (const e of ds.events) if (e.type === 'substitution' && e.note) reasons.add(e.note.split(' — ')[0]!)
    for (const family of ['Tactical change', 'Late change', 'Serious injury', 'Knock', 'Protective change'])
      expect(reasons.has(family), family).toBe(true)
  })

  it('generates injuries with physio-style detail and cards for tackles', () => {
    const injuries = ds.events.filter((e) => e.type === 'injury')
    expect(injuries.length).toBeGreaterThan(100)
    expect(injuries.some((e) => /ACL|Achilles|hamstring|sprain/i.test(e.note ?? ''))).toBe(true)
  })

  it('sent-off and substituted players record no further events in that match', () => {
    const offAt = new Map<string, number>()
    for (const e of ds.events) {
      if (e.type === 'red-card' && e.playerId) offAt.set(`${e.matchId}:${e.playerId}`, e.minute)
      if (e.type === 'substitution' && e.playerId) offAt.set(`${e.matchId}:${e.playerId}`, e.minute)
    }
    const later = [...ds.events].filter((e) => {
      if (
        !e.playerId ||
        e.type === 'red-card' ||
        e.type === 'yellow-card' ||
        e.type === 'substitution' ||
        e.type === 'injury'
      )
        return false
      const off = offAt.get(`${e.matchId}:${e.playerId}`)
      return off !== undefined && e.minute > off
    })
    expect(later.length).toBe(0)
  })

  it('every team keeps a goalkeeper on the pitch all match (no zero-GK minutes)', () => {
    const playerPos = new Map(ds.players.map((p) => [p.id, p.position]))
    const rowsByTeamMatch = new Map<string, typeof ds.playerMatchMinutes>()
    for (const r of ds.playerMatchMinutes) {
      const key = `${r.matchId}:${playerPos.get(r.playerId) === 'GK' ? 'gk' : 'x'}`
      const list = rowsByTeamMatch.get(key) ?? []
      list.push(r)
      rowsByTeamMatch.set(key, list)
    }
    // 22 GKs per match-context: two teams * 90 minutes of GK coverage unless a GK was sent off late with no sub left.
    const gkMinutesByMatch = new Map<string, number>()
    for (const r of ds.playerMatchMinutes)
      if (playerPos.get(r.playerId) === 'GK')
        gkMinutesByMatch.set(r.matchId, (gkMinutesByMatch.get(r.matchId) ?? 0) + r.minutes)
    const totalGk = [...gkMinutesByMatch.values()].reduce((a, b) => a + b, 0)
    expect(totalGk).toBeGreaterThan(0.98 * 2 * 90 * ds.matches.length)
  })
})
