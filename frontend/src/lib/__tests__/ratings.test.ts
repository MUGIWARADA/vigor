import { describe, expect, it } from 'vitest'
import { buildDemoDataset } from '@/data/generate'
import { computeAllRoundMatchRatings, computeAllRoundSeasonRatings } from '@/lib/ratings'

const ds = buildDemoDataset()

describe('all-round season ratings', () => {
  const ratings = computeAllRoundSeasonRatings(ds.players, 450)

  it('qualifies on minutes (not goals) and sorts by rating', () => {
    expect(ratings.length).toBeGreaterThan(500)
    for (const r of ratings) {
      expect(r.minutes).toBeGreaterThanOrEqual(450)
      expect(r.rating).toBeGreaterThanOrEqual(4)
      expect(r.rating).toBeLessThanOrEqual(9.8)
    }
    for (let i = 1; i < ratings.length; i++) {
      expect(ratings[i]!.rating).toBeLessThanOrEqual(ratings[i - 1]!.rating)
    }
  })

  it('is not a strikers-only board: every archetype has an elite (8.0+) player', () => {
    for (const arch of ['GK', 'DF', 'MF', 'FW'] as const) {
      const best = ratings.find((r) => r.archetype === arch)!
      expect(best.rating).toBeGreaterThanOrEqual(8)
    }
    // The overall top 20 contains more than one archetype.
    expect(new Set(ratings.slice(0, 20).map((r) => r.archetype)).size).toBeGreaterThan(1)
  })

  it('weights categories by role: keepers are scored on goalkeeping, not finishing', () => {
    const gk = ratings.find((r) => r.archetype === 'GK')!
    const gkCats = Object.fromEntries(gk.categories.map((c) => [c.category, c]))
    expect(gkCats.goalkeeping!.weight).toBeGreaterThan(0)
    expect(gkCats.goalkeeping!.score).not.toBeNull()
    expect(gk.categories.some((c) => c.category === 'output')).toBe(false)

    const fw = ratings.find((r) => r.archetype === 'FW')!
    const fwCats = Object.fromEntries(fw.categories.map((c) => [c.category, c]))
    expect(fwCats.output!.weight).toBeGreaterThan(fwCats.passing!.weight)
  })
})

describe('all-round match ratings', () => {
  const ratings = computeAllRoundMatchRatings(
    ds.matches,
    ds.playerMatchMinutes,
    ds.events,
    ds.players,
    ds.teams,
  )
  const playerById = new Map(ds.players.map((p) => [p.id, p]))

  it('lets defenders and goalkeepers produce top performances', () => {
    const top = [...ratings.values()].sort((a, b) => b.rating - a.rating || b.score - a.score).slice(0, 20)
    const groups = top.map((r) => playerById.get(r.playerId)!.position)
    expect(groups.some((p) => ['CB', 'LB', 'RB', 'WB'].includes(p))).toBe(true)
    expect(groups).toContain('GK')
  })

  it('counts the all-round components from events (passes, carries, recoveries)', () => {
    const anyRow = [...ratings.values()].find((r) => r.components.passesCompleted > 0)!
    expect(anyRow.components.passesAttempted).toBeGreaterThanOrEqual(anyRow.components.passesCompleted)
    const gkRow = [...ratings.values()].find((r) => playerById.get(r.playerId)!.position === 'GK')!
    expect(gkRow.components.shotsFaced).not.toBeNull()
    expect(gkRow.components.saves).toBe(
      Math.max(0, (gkRow.components.shotsFaced ?? 0) - (gkRow.components.goalsConceded ?? 0)),
    )
  })
})
