import { describe, expect, it } from 'vitest'
import { createDefaultPlan } from '../data'
import {
  OPEN_ENGINE_VERSION,
  describeResult,
  parseMatchRequest,
  resultJson,
  runMatch,
  type MatchRequest,
} from '../open'

const base = (over: Partial<MatchRequest> = {}): MatchRequest => ({
  seed: 8100,
  minutes: 4,
  home: { team: 'bracelonia' },
  away: { team: 'banyarn' },
  difficulty: 'normal',
  rules: 'standard',
  mode: 'match',
  ...over,
})

describe('open match system', () => {
  it('returns the same JSON for the same request, twice', () => {
    const once = resultJson(runMatch(base({ minutes: 2 })))
    const twice = resultJson(runMatch(base({ minutes: 2 })))
    expect(twice).toBe(once)
    // And the result says which engine produced it, so old files stay readable.
    expect(JSON.parse(once).engine).toBe(OPEN_ENGINE_VERSION)
  }, 30_000)

  it('gives a different match for a different seed', () => {
    const a = resultJson(runMatch(base({ seed: 8100 })))
    const b = resultJson(runMatch(base({ seed: 8101 })))
    expect(b).not.toBe(a)
  })

  it('reports numbers that agree with each other', () => {
    const result = runMatch(base({ minutes: 6 }))
    const home = result.teams.bracelonia
    const away = result.teams.banyarn

    // The score is the goals, counted once.
    expect(result.goals.length).toBe(result.score.home + result.score.away)
    const homeOrigins = Object.values(result.goalOrigins.bracelonia).reduce((a, b) => a + b, 0)
    const awayOrigins = Object.values(result.goalOrigins.banyarn).reduce((a, b) => a + b, 0)
    expect(homeOrigins).toBe(result.score.home)
    expect(awayOrigins).toBe(result.score.away)

    // Possession is a share of one match: it adds to a hundred.
    expect(home.possession + away.possession).toBeCloseTo(100, 0)
    expect(home.passCompletion).toBeGreaterThanOrEqual(0)
    expect(home.passCompletion).toBeLessThanOrEqual(100)
    expect(home.shotsOnTarget).toBeLessThanOrEqual(home.shots)

    // Every player line is a real player with a real rating.
    expect(result.players.length).toBeGreaterThan(20)
    for (const player of result.players) {
      expect(player.rating).toBeGreaterThanOrEqual(3)
      expect(player.rating).toBeLessThanOrEqual(10)
      expect(player.number).toBeGreaterThan(0)
      expect(player.name.length).toBeGreaterThan(2)
      // The phase split partitions the metres, in the output as in the report:
      // the two figures are rounded independently, so allow one rounding step.
      const split = player.distanceInPossession + player.distanceOutOfPossession
      expect(Math.abs(split - player.distance)).toBeLessThanOrEqual(0.11)
    }

    // The text summary mentions both sides and the score.
    const text = describeResult(result)
    expect(text).toContain('BRA')
    expect(text).toContain('BAM')
  })

  it('refuses a request it cannot honour, and says which field is wrong', () => {
    const badTeam = parseMatchRequest({ home: 'arse', away: 'banyarn' })
    expect(badTeam.ok).toBe(false)
    expect(badTeam.errors.join('\n')).toContain('home:')
    expect(badTeam.errors.join('\n')).toContain('not a side')

    const badMinutes = parseMatchRequest({ minutes: 0 })
    expect(badMinutes.ok).toBe(false)
    expect(badMinutes.errors.join('\n')).toContain('minutes')

    const badSeed = parseMatchRequest({ seed: -3 })
    expect(badSeed.ok).toBe(false)
    expect(badSeed.errors.join('\n')).toContain('seed')

    const sameSide = parseMatchRequest({ home: 'bracelonia', away: 'bracelonia' })
    expect(sameSide.ok).toBe(false)

    // A tactic sheet for the wrong club is a mistake worth naming.
    const mismatched = parseMatchRequest({ home: { team: 'bracelonia', plan: createDefaultPlan('banyarn') } })
    expect(mismatched.ok).toBe(false)
    expect(mismatched.errors.join('\n')).toContain('plan.teamId')
  })

  it('accepts a side given as a bare id, and fills the rest from the defaults', () => {
    const parsed = parseMatchRequest({ home: 'banyarn', away: 'bracelonia' })
    expect(parsed.ok).toBe(true)
    expect(parsed.request!.home.team).toBe('banyarn')
    expect(parsed.request!.seed).toBe(8100)
    expect(parsed.request!.minutes).toBe(12)
    expect(parsed.request!.difficulty).toBe('normal')
  })

  it('plays the tactic sheet it was handed, not the default one', () => {
    const plan = createDefaultPlan('bracelonia')
    const narrow = { ...plan, formation: '4-4-2', sliders: { ...plan.sliders, width: 0 } }
    const result = runMatch(base({ minutes: 3, home: { team: 'bracelonia', plan: narrow } }))
    expect(result.request.home.formation).toBe('4-4-2')
    expect(result.request.home.sliders.width).toBe(0)
  })
})
