import { describe, expect, it } from 'vitest'
import { createDefaultPlan } from '../data'
import { createMatch, offsideOvershoot, resumeSecondHalf, stepMatch } from '../engine'

/**
 * Offside legality.
 *
 * The engine used to play 15 to 36 passes a match to a man standing six metres
 * beyond the last defender — not because the run was mistimed, because the pass
 * was scored attractive and the sixty-point offside penalty inside the scoring
 * sum could be out-bid by space, angle and position bonuses. The driven-ball
 * branch had no offside check at all, and the fast restart deliberately looked
 * for a man beyond the opposition line even from a free kick, where the Laws do
 * not allow it.
 *
 * These two tests guard the fix from both ends: no illegal pass anywhere in a
 * match, and offside still happening at all, because a rule that never fires is
 * indistinguishable from a rule that was deleted.
 */
function play(seed: number, minutes = 8) {
  return createMatch({
    homePlan: createDefaultPlan('bracelonia'),
    awayPlan: createDefaultPlan('banyarn'),
    difficulty: 'normal',
    rules: 'standard',
    halfSeconds: (minutes * 60) / 2,
    humanTeams: [],
    seed,
  })
}

function furthestIllegalPass(seed: number, minutes = 8) {
  const state = play(seed, minutes)
  let worst = 0
  let flagged = 0
  const depths: number[] = []
  let guard = 0
  const limit = (minutes * 60) / 0.05 + 6000
  let previousFlag: string | null = null
  while (state.phase !== 'fulltime' && guard < limit) {
    if (state.phase === 'halftime') resumeSecondHalf(state)
    stepMatch(state, {}, 0.05)
    guard += 1
    const flaggedId = state.ball.offsideReceiverId
    if (flaggedId && flaggedId !== previousFlag) {
      const receiver = state.players.find((p) => p.id === flaggedId)
      const passer = state.players.find((p) => p.id === state.ball.lastTouchPlayerId)
      if (receiver && passer && receiver.teamId === passer.teamId) {
        flagged += 1
        const overshoot = offsideOvershoot(state, receiver, passer)
        depths.push(overshoot)
        worst = Math.max(worst, overshoot)
      }
    }
    previousFlag = flaggedId
  }
  return { worst, flagged, depths, stats: state.stats.bracelonia.offsides + state.stats.banyarn.offsides }
}

describe('offside legality', () => {
  it('never plays a pass to a man standing metres beyond the last defender', () => {
    // The carrier plays against the line he has *seen*, which lags the real one
    // by about half a second (docs/stepping-line.md). So some overshoot past the
    // true line is the design, not a defect — but it is bounded by how far a
    // line can travel in that half second plus the one-stride allowance. What
    // this guards is the original defect, which was six metres and more on a
    // third of all passes.
    let flagged = 0
    for (const seed of [8100, 8431, 8762]) {
      const result = furthestIllegalPass(seed)
      flagged += result.flagged
      expect(result.worst).toBeLessThanOrEqual(6.5)
    }
    // Not a vacuous pass: flags still happen.
    expect(flagged).toBeGreaterThan(0)
  }, 240_000)

  it('still catches a side offside, at something like the rate football does', () => {
    // Roughly two per side in ninety minutes is real; a twelve-minute match of
    // this engine should produce a handful across several seeds, not dozens and
    // not none.
    // Per match, both sides: real football is about four. Sixteen matches'
    // worth of noise either way, but a regression to thirty or a collapse to
    // zero both fall outside.
    let whistles = 0
    for (const seed of [8100, 8431, 8762, 9093]) whistles += furthestIllegalPass(seed).stats
    const perMatch = whistles / 4
    expect(perMatch).toBeGreaterThanOrEqual(1.5)
    expect(perMatch).toBeLessThanOrEqual(8)
  }, 240_000)

  it('mistimes runs by a stride or two, not by a breakdown', () => {
    // The distinguishing fact about a mistimed run is its size: half a metre
    // beyond the line, not six. If the median creeps up, something has started
    // choosing illegal passes again and the fix in §3 has been undone.
    const depths: number[] = []
    for (const seed of [8100, 8431, 8762]) depths.push(...furthestIllegalPass(seed).depths)
    expect(depths.length).toBeGreaterThan(2)
    depths.sort((a, b) => a - b)
    const median = depths[Math.floor(depths.length / 2)]!
    // A stride is ~0.7 m and the perception lag adds about the same again, so
    // the middle of the distribution sits just under two metres. Six metres is
    // the old defect and must never come back.
    expect(median).toBeGreaterThan(0)
    expect(median).toBeLessThan(2.5)
  }, 240_000)
})
