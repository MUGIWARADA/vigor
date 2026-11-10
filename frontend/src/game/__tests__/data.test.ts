import { describe, expect, it } from 'vitest'
import {
  GAME_TEAMS,
  PES_ATTRIBUTE_LABELS,
  createDefaultPlan,
  decodePlan,
  encodePlan,
  getPlayer,
  getTeam,
  ENGINE_ATTRIBUTES,
  normalizeRatingOverrides,
  playerGameRatings,
  weakFootPenalty,
  withRatingOverrides,
} from '../data'

const RATED_1_99 = PES_ATTRIBUTE_LABELS.slice(0, 26).map(([key]) => key)

describe('Community Game Mode fictional squads', () => {
  it('registers 26 players per club with unique IDs and shirt numbers', () => {
    for (const team of GAME_TEAMS) {
      expect(team.players).toHaveLength(26)
      expect(new Set(team.players.map((p) => p.id)).size).toBe(26)
      expect(new Set(team.players.map((p) => p.number)).size).toBe(26)
      expect(team.players.every((p) => p.name.length > 2)).toBe(true)
    }
    expect(new Set(GAME_TEAMS.flatMap((t) => t.players.map((p) => p.id))).size).toBe(52)
  })

  it('gives every fictional player a valid PES PS2-style attribute sheet', () => {
    for (const team of GAME_TEAMS) {
      for (const player of team.players) {
        for (const key of RATED_1_99) {
          expect(player.attributes[key]).toBeGreaterThanOrEqual(30)
          expect(player.attributes[key]).toBeLessThanOrEqual(99)
        }
        expect(player.attributes.consistency).toBeGreaterThanOrEqual(1)
        expect(player.attributes.consistency).toBeLessThanOrEqual(8)
        expect(player.attributes.condition).toBeGreaterThanOrEqual(1)
        expect(player.attributes.condition).toBeLessThanOrEqual(8)
        expect(['A', 'B', 'C']).toContain(player.attributes.injuryTolerance)
      }
    }
  })

  it('builds a 20-player matchday squad: 11 starters and 9 substitutes', () => {
    for (const team of GAME_TEAMS) {
      const plan = createDefaultPlan(team.id)
      expect(plan.slots).toHaveLength(11)
      expect(plan.benchIds).toHaveLength(9)
      const all = [...plan.slots.map((s) => s.playerId), ...plan.benchIds]
      expect(new Set(all).size).toBe(20)
      expect(all.every((id) => getPlayer(id)?.teamId === team.id)).toBe(true)
    }
  })

  it('derives compact game ratings and applies sanitized local rating overrides', () => {
    const player = GAME_TEAMS[0]!.players.find((p) => p.name === 'Pedrilho')!
    const ratings = playerGameRatings(player)
    expect(ratings.overall).toBeGreaterThan(75)
    expect(ratings.passing).toBeGreaterThan(80)
    expect(ratings.dribbling).toBeGreaterThan(80)
    const overrides = normalizeRatingOverrides({
      [player.id]: { topSpeed: 140, consistency: 42, injuryTolerance: 'A' },
    })
    expect(overrides[player.id]?.topSpeed).toBe(99)
    expect(overrides[player.id]?.consistency).toBe(8)
    const edited = withRatingOverrides(player, overrides)
    expect(edited.attributes.topSpeed).toBe(99)
    expect(player.attributes.topSpeed).not.toBe(99)
    expect(playerGameRatings(edited).pace).toBeGreaterThan(ratings.pace)
  })

  it('stores a preferred-foot override and applies it to the player', () => {
    const player = getTeam('bracelonia').players.find((p) => p.foot === 'R')!
    const overrides = normalizeRatingOverrides({ [player.id]: { foot: 'L', weakFootAccuracy: 3 } })
    expect(overrides[player.id]?.foot).toBe('L')
    expect(overrides[player.id]?.weakFootAccuracy).toBe(3)
    const edited = withRatingOverrides(player, overrides)
    expect(edited.foot).toBe('L')
    expect(edited.attributes.weakFootAccuracy).toBe(3)
    // The foot must not leak into the attribute sheet.
    expect((edited.attributes as unknown as Record<string, unknown>).foot).toBeUndefined()
    // Left foot is the strong side now, so a wrong-foot strike costs him.
    expect(weakFootPenalty(edited.attributes.weakFootAccuracy).noiseScale).toBeGreaterThan(1.3)
    expect(weakFootPenalty(8).noiseScale).toBe(1)
    // Bogus values are dropped rather than stored.
    expect(normalizeRatingOverrides({ [player.id]: { foot: 'X' as never } })).toEqual({})
  })

  it('lets special abilities be switched on and off per player', () => {
    const player = getTeam('bracelonia').players.find((p) => p.name === 'Rafinher')!
    const overrides = normalizeRatingOverrides({ [player.id]: { stars: ['Scoring', 'Middle Shooting', 'Not A Star' as never] } })
    expect(overrides[player.id]?.stars).toEqual(['Scoring', 'Middle Shooting'])
    const edited = withRatingOverrides(player, overrides)
    expect(edited.stars).toContain('Scoring')
    expect(edited.stars).toContain('Middle Shooting')
    // Every attribute the Ratings sheet offers is read somewhere by the engine.
    for (const [key] of PES_ATTRIBUTE_LABELS) expect(ENGINE_ATTRIBUTES).toContain(key)
  })

  it('round-trips a shareable Match Plan code', () => {
    const plan = createDefaultPlan('bracelonia')
    plan.name = 'My testing plan'
    plan.sliders.pressing = 91
    const decoded = decodePlan(encodePlan(plan))
    expect(decoded).not.toBeNull()
    expect(decoded?.name).toBe('My testing plan')
    expect(decoded?.sliders.pressing).toBe(91)
    expect(decoded?.slots.map((s) => s.playerId)).toEqual(plan.slots.map((s) => s.playerId))
  })
})
