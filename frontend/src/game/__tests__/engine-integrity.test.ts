import { describe, it } from 'vitest'
import { createMatch, stepMatch } from '../engine'
import { createDefaultPlan } from '../data'

/**
 * Engine integrity — measured on the output, not on the code path.
 *
 * Ported in spirit from ai-football-analytics' `tracking_quality.py`, which
 * exists because a green unit suite that feeds fake frames cannot tell you the
 * output is wrong. These are the simulation's equivalents of its three checks:
 *
 *  - impossible steps: no player covers more ground in one frame than a human
 *    could. In a simulation this catches a bad target, a teleport, or a
 *    restart that respawns somebody mid-pitch.
 *  - ball teleports: the ball never jumps across the pitch inside a frame.
 *  - body overlap: two players never occupy the same patch of grass. This is
 *    the "clashing" everyone notices, and it is worth asserting because the
 *    separation solver is the only thing that prevents it.
 *
 * Deliberately *not* asserted here: who wins a duel, how many goals, how wide
 * the block is. Those belong to behavioural tests; this file only asserts that
 * the world stays physically possible.
 */
const HOME = createDefaultPlan('bracelonia')
const AWAY = createDefaultPlan('banyarn')

const DT = 0.05
const FRAME_CEILING_M = 1.5 // 30 m/s — nobody in this game runs 108 km/h
const BALL_CEILING_M = 8.0 // a struck ball moves fast, but not by teleporting
const OVERLAP_FLOOR_M = 0.9 // shoulder to shoulder, not inside each other

function measure(seed: number, frames: number) {
  const state = createMatch({
    homePlan: HOME,
    awayPlan: AWAY,
    difficulty: 'normal',
    rules: 'standard',
    halfSeconds: 360,
    humanTeams: [],
    seed,
  })
  const previous = new Map<string, { x: number; y: number }>()
  let previousBall: { x: number; y: number } | null = null
  let worstStep = 0
  let worstBall = 0
  let overlapFrames = 0
  let deepOverlapFrames = 0
  let nonFinite = 0
  let deadFrames = 0
  let stillRun = 0

  for (let frame = 0; frame < frames; frame++) {
    const phaseBefore = state.phase
    stepMatch(state, {}, DT)
    // A restart or a phase change legitimately repositions people.
    if (state.phase !== 'play' || phaseBefore !== 'play') {
      previous.clear()
      previousBall = null
      continue
    }
    for (const p of state.players) {
      if (!p.onPitch || p.sentOff) continue
      if (!Number.isFinite(p.pos.x) || !Number.isFinite(p.pos.y) || !Number.isFinite(p.vel.x)) nonFinite += 1
      const before = previous.get(p.id)
      if (before) {
        const step = Math.hypot(p.pos.x - before.x, p.pos.y - before.y)
        worstStep = Math.max(worstStep, step)
      }
      previous.set(p.id, { ...p.pos })
    }
    const on = state.players.filter((p) => p.onPitch && !p.sentOff)
    for (let i = 0; i < on.length; i++) {
      for (let j = i + 1; j < on.length; j++) {
        const d = Math.hypot(on[i]!.pos.x - on[j]!.pos.x, on[i]!.pos.y - on[j]!.pos.y)
        if (d < OVERLAP_FLOOR_M) overlapFrames += 1
        if (d < 0.4) deepOverlapFrames += 1
      }
    }
    const ballMoved = previousBall
      ? Math.hypot(state.ball.pos.x - previousBall.x, state.ball.pos.y - previousBall.y)
      : 0
    worstBall = Math.max(worstBall, ballMoved)
    previousBall = { ...state.ball.pos }
    // A ball nobody owns and nobody moves towards is the frozen-game bug
    // class. The engine's own anti-stall shakes it loose after 4.5 s, so this
    // counts how often that has to fire.
    stillRun = ballMoved < 0.02 && !state.ball.ownerId ? stillRun + 1 : 0
    if (stillRun === 90) deadFrames += 1
  }

  return { worstStep, worstBall, overlapFrames, deepOverlapFrames, nonFinite, deadFrames }
}

describe('engine integrity', () => {
  it('keeps the world physically possible over two full matches', () => {
    for (const seed of [8100, 8762]) {
      const m = measure(seed, 7200)
      expect(m.nonFinite, `seed ${seed}: a position or velocity went non-finite`).toBe(0)
      expect(m.worstStep, `seed ${seed}: a player stepped ${m.worstStep.toFixed(2)} m in one frame`)
        .toBeLessThan(FRAME_CEILING_M)
      expect(m.worstBall, `seed ${seed}: the ball jumped ${m.worstBall.toFixed(2)} m in one frame`)
        .toBeLessThan(BALL_CEILING_M)
      // Measured at 0-1 frames per match after the hard-overlap pass; the
      // allowance is for the single frame it can take to separate a scrum.
      expect(m.overlapFrames, `seed ${seed}: ${m.overlapFrames} frames with two bodies inside ${OVERLAP_FLOOR_M} m`)
        .toBeLessThan(6)
      expect(m.deepOverlapFrames, `seed ${seed}: ${m.deepOverlapFrames} frames with two bodies on the same pixel`)
        .toBe(0)
      // Each deadFrames is one firing of the 4.5 s anti-stall, so a handful is
      // normal play (a ball sitting in a corner). The bug it replaced pinned
      // the whole passage: one seed never moved the ball for 4,281 frames.
      expect(m.deadFrames, `seed ${seed}: ball dead for 4.5 s on ${m.deadFrames} occasions`).toBeLessThanOrEqual(6)
    }
  }, 240000)
})
