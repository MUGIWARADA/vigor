import { describe, expect, it } from 'vitest'
import { createMatch, stepMatch } from '@/game/engine'
import { createDefaultPlan } from '@/game/data'

/**
 * Front-line run timing.
 *
 * The front line can only be legally high if its runs are timed: you may go
 * beyond the last defender as the ball is played to you, not while you are
 * waiting for it. Two rules used to break that and both were measured:
 *
 *  - every forward got eight metres of licence beyond the line whenever ANY
 *    team-mate passed, so the whole line drifted offside on every pass;
 *  - a through ball to a man already beyond the line was rewarded with a
 *    bonus, so the carrier was paid to play the one pass that cannot work.
 *
 * Together the side was caught offside 23 times a match (11.8 per team). With
 * the licence restricted to the intended receiver and the offside through ball
 * no longer rewarded, it is roughly 9 per team on the same seeds — and goals
 * went up, not down, because those possessions stopped being wasted.
 *
 * The assertion is on offsides rather than goals deliberately: offsides are
 * low-variance over ten matches, whereas a goals threshold tight enough to
 * catch a regression would flake on a good day.
 */
const HOME = createDefaultPlan('bracelonia')
const AWAY = createDefaultPlan('banyarn')

function playMatch(seed: number) {
  const state = createMatch({
    homePlan: HOME,
    awayPlan: AWAY,
    difficulty: 'normal',
    rules: 'standard',
    halfSeconds: 360,
    humanTeams: [],
    seed,
  })
  let stalls = 0
  let guard = 0
  while (state.phase !== 'fulltime' && guard < 40000) {
    stepMatch(state, {}, 0.05)
    guard += 1
    if (state.phase !== 'play') continue
    if (!state.ball.ownerId && (state.ball.stalledFor ?? 0) > 1.2) stalls += 1
  }
  return { state, stalls }
}

describe('front-line run timing', () => {
  it('does not let the whole line drift offside on every pass', () => {
    const seeds = [8100, 8431, 8762, 9093, 9424, 9755, 10086, 10417, 10748, 11079]
    let offsides = 0
    let goals = 0
    let stalls = 0
    for (const seed of seeds) {
      const { state, stalls: s } = playMatch(seed)
      offsides += state.stats.bracelonia.offsides + state.stats.banyarn.offsides
      goals += state.events.filter((e) => (e as { kind?: string }).kind === 'goal').length
      stalls += s
    }
    // Two teams, ten matches. The old rules ran at ~23 a match (11.8 per team);
    // restricting the run licence brought it to ~9 per team, and making pass
    // legality a filter rather than a weight (see `offsideOvershoot` and
    // docs/offsides.md) brought it to roughly one. The bound is per team and
    // deliberately much tighter than the old twelve: a bound that the old
    // engine also satisfied was guarding nothing.
    expect(offsides / (seeds.length * 2)).toBeLessThan(4)
    // The point of the change was that those possessions are no longer wasted.
    expect(goals).toBeGreaterThan(seeds.length * 2.8)
    expect(stalls).toBe(0)
  }, 600000)
})
