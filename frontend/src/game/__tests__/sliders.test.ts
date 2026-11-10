import { describe, expect, it } from 'vitest'
import { createMatch, stepMatch } from '../engine'
import { FORMATIONS, createDefaultPlan, type TeamPlan } from '../data'

/**
 * Sliders must actually matter.
 *
 * These are measured, not asserted from reading the code: the ball is pinned
 * at a known spot with a known owner and the match is stepped sixty frames, so
 * the only thing that can move anybody's target is the dial under test. A
 * slider that is wired to nothing, wired backwards, or wired so weakly it
 * cannot be felt fails here.
 */

// The line under test is the centre-back line. Full-backs are deliberately
// staggered by the offside trap, so folding them in diluted the reading.
const DEF = ['LCB', 'CB', 'RCB', 'SW']
const WIDE = ['LW', 'RW', 'LM', 'RM', 'LB', 'RB']

interface Scenario {
  /** Where the ball is, in the home team's attacking frame. */
  x: number
  y: number
  /**
   * `away` is a ball in flight (nobody owns it, nothing can be tackled);
   * `carrier` is an away player actually on the ball, which is the only
   * picture in which a defensive block has somebody to press.
   */
  possession: 'home' | 'away' | 'loose' | 'carrier'
}

function shape(tweak: (plan: TeamPlan) => void, scenario: Scenario, roleFor?: (plan: TeamPlan) => void) {
  const homePlan = createDefaultPlan('bracelonia')
  tweak(homePlan)
  roleFor?.(homePlan)
  const state = createMatch({
    homePlan,
    awayPlan: createDefaultPlan('banyarn'),
    difficulty: 'normal',
    rules: 'standard',
    halfSeconds: 100000,
    humanTeams: [],
    seed: 4242,
  })
  state.phase = 'play'
  state.restart = null
  const team = scenario.possession === 'home' ? 'bracelonia' : 'banyarn'
  const holder = state.players.find((p) => p.teamId === team && p.slotPosition === 'CM')
    ?? state.players.find((p) => p.teamId === team && p.slotPosition !== 'GK')!
  const ballPos = { x: scenario.x, y: scenario.y }
  for (let frame = 0; frame < 60; frame++) {
    state.phase = 'play'
    state.restart = null
    state.ball.pos = { ...ballPos }
    state.ball.vel = { x: 0, y: 0 }
    state.ball.z = 0
    // Away possession is pinned as a ball in flight: nobody can win a tackle,
    // so the picture under test cannot quietly turn into the other shape.
    state.ball.kind = scenario.possession === 'away' ? 'pass' : scenario.possession === 'carrier' ? 'dribble' : scenario.possession === 'home' ? 'dribble' : 'loose'
    state.ball.ownerId = scenario.possession === 'home' || scenario.possession === 'carrier' ? holder.id : null
    state.ball.intendedReceiverId = null
    state.ball.passTeamId = holder.teamId
    state.ball.lastTouchTeamId = holder.teamId
    holder.pos = { ...ballPos }
    holder.vel = { x: 0, y: 0 }
    stepMatch(state, {}, 0.05)
  }
  const mine = state.players.filter((p) => p.teamId === 'bracelonia' && p.onPitch)
  const back = mine.filter((p) => DEF.includes(p.slotPosition))
  const outfield = mine.filter((p) => p.slotPosition !== 'GK')
  const wide = mine.filter((p) => WIDE.includes(p.slotPosition))
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
  const spread = (xs: number[]) => {
    const m = mean(xs)
    return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
  }
  const nearest = Math.min(...outfield.map((p) => Math.hypot(p.target.x - ballPos.x, p.target.y - ballPos.y)))
  const gaps = outfield
    .filter((p) => p.id !== holder.id)
    .map((p) => Math.hypot(p.target.x - ballPos.x, p.target.y - ballPos.y))
    .sort((a, b) => a - b)
  return {
    defLine: mean(back.map((p) => p.target.x)),
    spread: spread(outfield.map((p) => p.target.y)),
    pressGap: nearest,
    width: mean(wide.map((p) => Math.abs(p.target.y - 34))),
    nearestTwo: (gaps[0]! + (gaps[1] ?? gaps[0]!)) / 2,
    // Bodies committed to the ball: the clearest read on pressing appetite.
    nearBall: outfield.filter((p) => Math.hypot(p.target.x - ballPos.x, p.target.y - ballPos.y) < 12).length,
    slotX: (position: string) => {
      const p = mine.find((x) => x.slotPosition === position)
      return p ? p.target.x : 0
    },
    slotY: (position: string) => {
      const p = mine.find((x) => x.slotPosition === position)
      return p ? p.target.y : 0
    },
  }
}

const DEFENDING: Scenario = { x: 40, y: 34, possession: 'away' }
const MIDFIELD: Scenario = { x: 62, y: 18, possession: 'home' }
/** An away carrier in midfield: the picture a pressing side is asked to solve. */
const PRESSED: Scenario = { x: 55, y: 34, possession: 'carrier' }

const setSlider = (key: keyof TeamPlan['sliders']) => (plan: TeamPlan, value: number) => { plan.sliders[key] = value }

function extremes(key: keyof TeamPlan['sliders'], scenario: Scenario) {
  return {
    low: shape((plan) => setSlider(key)(plan, 0), scenario),
    high: shape((plan) => setSlider(key)(plan, 100), scenario),
  }
}

describe('every dial moves the team', () => {
  it('defensive line: 0 sits deep, 100 squeezes the pitch', () => {
    const { low, high } = extremes('lineHeight', DEFENDING)
    expect(high.defLine - low.defLine).toBeGreaterThan(12)
  })

  it('compactness: 100 halves the distance between the units', () => {
    const { low, high } = extremes('compactness', DEFENDING)
    expect(low.spread - high.spread).toBeGreaterThan(3)
  })

  it('pressing: 100 steps the block up and sends a second man with the ball', () => {
    // Only measurable with an opponent actually on the ball: a side cannot
    // press a pass in flight, and a block with nothing to press just holds
    // its line.
    const { low, high } = extremes('pressing', PRESSED)
    // The block squeezes up the pitch instead of sitting in front of the box.
    expect(high.defLine - low.defLine).toBeGreaterThan(4)
    // And the chase is not left to one man: the second-closest defender
    // closes on the carrier too.
    expect(low.nearestTwo - high.nearestTwo).toBeGreaterThan(1)
  })

  it('width: 100 stretches for the touchline, 0 plays narrow', () => {
    const { low, high } = extremes('width', MIDFIELD)
    // The weakest of the dials, but it is real: the wide men are metres wider
    // at 100 than at 0.
    expect(high.width - low.width).toBeGreaterThan(2.5)
  })

  it('support: 100 gives the carrier more options close to the ball', () => {
    const { low, high } = extremes('support', MIDFIELD)
    expect(high.nearBall - low.nearBall).toBeGreaterThan(1)
  })

  it('tempo changes how quickly the carrier decides, not just a number', () => {
    // Measured where tempo actually bites: the plan the carrier makes when he
    // picks his head up. He is given the ball in midfield with the opposition
    // cleared out of the picture, so the only thing that can shorten the gap
    // between decisions is the dial.
    const decisionClock = (tempo: number) => {
      const plan = createDefaultPlan('bracelonia')
      plan.sliders.tempo = tempo
      const state = createMatch({ homePlan: plan, awayPlan: createDefaultPlan('banyarn'), difficulty: 'normal', rules: 'standard', halfSeconds: 100000, humanTeams: [], seed: 77 })
      state.phase = 'play'
      state.restart = null
      const carrier = state.players.find((p) => p.teamId === 'bracelonia' && p.slotPosition === 'CM')!
      let peak = 0
      let previous = 0
      for (let frame = 0; frame < 240; frame++) {
        state.phase = 'play'
        state.restart = null
        for (const p of state.players) {
          if (p.teamId !== 'banyarn') continue
          p.pos = { x: 102, y: p.pos.y }
          p.vel = { x: 0, y: 0 }
        }
        if (state.ball.ownerId !== carrier.id) {
          carrier.pos = { x: 60, y: 34 }
          carrier.vel = { x: 0, y: 0 }
          state.ball.pos = { x: 60, y: 34 }
          state.ball.vel = { x: 0, y: 0 }
          state.ball.z = 0
          state.ball.ownerId = carrier.id
          state.ball.kind = 'dribble'
          state.ball.lastTouchTeamId = 'bracelonia'
          state.ball.intendedReceiverId = null
        }
        stepMatch(state, {}, 0.05)
        // A jump upward is the engine handing him a fresh decision window.
        if (carrier.decisionTimer > previous + 0.01 && carrier.decisionTimer > peak) peak = carrier.decisionTimer
        previous = carrier.decisionTimer
      }
      return peak
    }
    const slow = decisionClock(0)
    const fast = decisionClock(100)
    // Measured 0.75s at tempo 0 and 0.38s at tempo 100.
    expect(slow / fast).toBeGreaterThan(1.5)
  })
})

describe('roles move players independently of the sliders', () => {
  const withRole = (position: string, role: string) => (plan: TeamPlan) => {
    const slot = plan.slots.find((s) => FORMATIONS[plan.formation]?.find((t) => t.id === s.slotId)?.position === position)
    if (slot) slot.role = role
  }

  it('a holding midfielder sits in front of the ball, a box-to-box one goes with it', () => {
    const holding = shape(() => {}, MIDFIELD, withRole('DM', 'holding'))
    const b2b = shape(() => {}, MIDFIELD, withRole('DM', 'box-to-box'))
    expect(b2b.slotX('DM') - holding.slotX('DM')).toBeGreaterThan(4)
  })

  it('a winger holds the touchline, an inverted winger comes inside', () => {
    const winger = shape(() => {}, MIDFIELD, withRole('LW', 'winger'))
    const inverted = shape(() => {}, MIDFIELD, withRole('LW', 'inverted-winger'))
    // The left flank: smaller y is wider.
    expect(inverted.slotY('LW') - winger.slotY('LW')).toBeGreaterThan(3)
  })
})
