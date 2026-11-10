/**
 * Set-piece shapes.
 *
 * The shape at a dead ball is not the open-play shape. It is the set-piece
 * skeleton (who stands where for this delivery) laid over each side's own
 * shape. Written the way it is actually coached:
 *
 *   attacking side   = set-piece attacking skeleton + our attacking shape
 *   defending side   = set-piece defending skeleton + our defensive shape
 *
 * Real-world grounding used for the skeleton (Premier League, Opta/BBC
 * analysis): corners and free kicks produce roughly 28% of goals; about one
 * corner in nine is taken short; inswingers dominate; the modern defence is a
 * hybrid — a near-post guard plus three zonal players on the six-yard line,
 * with the two biggest aerial threats picked up man-to-man, blockers on the
 * keeper and two players left up for the counter. Attacking groups put five to
 * seven in the box: a near-post flicker, a penalty-spot runner, a back-post
 * overload, an edge-of-box player and one screen in front of the keeper.
 */

import type { TeamPlan } from './data'

export interface SetPiecePoint {
  x: number
  y: number
  /** What this body is for, which decides who is picked to stand there. */
  duty: SetPieceDuty
}

export type SetPieceDuty =
  | 'near-post' | 'penalty-spot' | 'back-post' | 'edge' | 'screen'
  | 'short' | 'rest' | 'near-post-guard' | 'zone' | 'mark' | 'counter'

export interface TeamShapeInput {
  /** 0-100 team width slider. */
  width: number
  /** 0-100 compactness slider. */
  compactness: number
  /** 0-100 line height slider. */
  lineHeight: number
}

export const SET_PIECE_DATA = {
  /** Share of Premier League goals originating from dead balls. */
  goalsFromSetPieces: 0.283,
  /** Share of corners taken short. */
  shortCornerShare: 0.113,
  /** Long throws into the box per game (up from 1.52). */
  longThrowsPerGame: 3.44,
  /** Bodies the attacking side commits into the box on a standard corner. */
  boxCommitment: 6,
  /** Zonal players on the six-yard line in the modern hybrid defence. */
  hybridZonalLine: 3,
  /** Players left up the pitch to counter. */
  counterLeave: 2,
} as const

const spread = (slider: number) => (slider - 50) / 100 // -0.5 .. +0.5

/**
 * Attacking corner skeleton. The routine sets the target zone; the team's own
 * attacking width decides how wide the box group spreads, and the compactness
 * of the block behind it decides how far up the rest-defence sits.
 */
export function cornerAttackShape(routine: string, side: -1 | 1, shape: TeamShapeInput): SetPiecePoint[] {
  const nearY = side < 0 ? 29.5 : 38.5
  const farY = side < 0 ? 39 : 29
  // Team width stretches the group across the face of goal, so a wide team
  // attacks both posts and a narrow one crowds the penalty spot. The posts are
  // the anchors of the routine; width moves the bodies around them, and no
  // runner is ever sent outside the width of the six-yard box.
  const k = clamp(0.78 + spread(shape.width) * 0.95, 0.34, 1.24)
  const boxY = (base: number) => clamp(34 + (base - 34) * k, 25.5, 42.5)
  const w = spread(shape.width) * 3.2
  const backRest = 2 + spread(shape.compactness) * 8
  const points: SetPiecePoint[] = []

  const routinePrimary: Record<string, SetPiecePoint> = {
    'Near-post flick': { x: 100, y: nearY, duty: 'near-post' },
    'Back-post overload': { x: 100, y: farY, duty: 'back-post' },
    'Edge-of-box cutback': { x: 95, y: 34, duty: 'edge' },
    'Short corner': { x: 97, y: 34, duty: 'penalty-spot' },
    'Six-yard inswinger': { x: 99.5, y: 34, duty: 'penalty-spot' },
  }
  const primary = routinePrimary[routine] ?? { x: 99, y: 34, duty: 'penalty-spot' as SetPieceDuty }
  points.push({ x: primary.x, y: primary.y === 34 ? 34 : boxY(primary.y), duty: primary.duty })
  points.push({ x: 99, y: boxY(34 + (34 - nearY) * 0.35), duty: 'penalty-spot' })
  // A wide team attacks both posts: the near-post runner goes out toward the
  // touchline the ball came from, the back-post runner out the other way.
  //
  // The runners stand GOAL-SIDE of the six-yard line, not on it: the zonal
  // defenders own that line, and a delivery aimed at it is a delivery aimed at
  // a defender's head. Attackers start a metre and a half deeper and come
  // forward onto the ball, which is why the near-post flick works.
  //
  // Measured, do not "improve" this: starting the runners at the penalty spot
  // to give them a proper run cut the corners that produce a shot from 84% to
  // 53%. The delivery follows the runner, so a runner six metres further out
  // drags the ball six metres further from goal.
  points.push({ x: 99.8, y: boxY(nearY + w * side), duty: 'near-post' })
  points.push({ x: 99.2, y: boxY(farY - w * side), duty: 'back-post' })
  // The screen: one body on the keeper, the reason near-post flick-ons work.
  points.push({ x: 100.5, y: 34, duty: 'screen' })
  // The edge-of-box man holds a central position whatever the width: somebody
  // has to be there for the cutback.
  points.push({ x: 88 + spread(shape.lineHeight) * 3, y: 34, duty: 'edge' })
  if (routine.includes('Short')) points.push({ x: 96, y: side < 0 ? 8 : 60, duty: 'short' })
  points.push({ x: 74 + backRest, y: 24, duty: 'rest' })
  points.push({ x: 74 + backRest, y: 44, duty: 'rest' })
  return points
}

/**
 * Defending corner skeleton. Hybrid is the modern default: one on the near
 * post, three zonal across the six-yard line, two man-markers on the biggest
 * aerial threats, everyone else screens the edge and one stays up.
 */
export function cornerDefenceShape(mode: string, side: -1 | 1, shape: TeamShapeInput): SetPiecePoint[] {
  const nearY = side < 0 ? 29.5 : 38.5
  const farY = side < 0 ? 39 : 29
  // A compact side defends smaller: the zonal line sits closer to goal. A
  // loose one steps out and defends the penalty spot instead.
  // A compact side defends the six-yard box; a loose one steps out toward the
  // penalty spot and leaves the space behind the line.
  const zonalX = 97 + spread(shape.compactness) * 4
  const points: SetPiecePoint[] = []
  if (mode === 'Zonal') {
    points.push({ x: zonalX + 1, y: nearY, duty: 'zone' })
    points.push({ x: zonalX, y: 34, duty: 'zone' })
    points.push({ x: zonalX - 1, y: farY, duty: 'zone' })
    points.push({ x: zonalX - 4, y: 30, duty: 'zone' })
    points.push({ x: zonalX - 4, y: 38, duty: 'zone' })
    points.push({ x: zonalX - 8, y: 34, duty: 'zone' })
  } else if (mode === 'Player marking') {
    points.push({ x: 103, y: nearY, duty: 'near-post-guard' })
    points.push({ x: 100, y: 34, duty: 'mark' })
    points.push({ x: 96, y: 30, duty: 'mark' })
    points.push({ x: 96, y: 38, duty: 'mark' })
    points.push({ x: 92, y: 34, duty: 'mark' })
    points.push({ x: 86, y: 34, duty: 'edge' })
  } else if (mode === 'Near-post heavy') {
    points.push({ x: 103.2, y: nearY, duty: 'near-post-guard' })
    points.push({ x: 100.5, y: nearY, duty: 'zone' })
    points.push({ x: 99, y: 34, duty: 'zone' })
    points.push({ x: 97, y: farY, duty: 'zone' })
    points.push({ x: 91, y: 34, duty: 'mark' })
    points.push({ x: 85, y: 34, duty: 'edge' })
  } else {
    // Hybrid.
    points.push({ x: 103, y: nearY, duty: 'near-post-guard' })
    points.push({ x: zonalX, y: nearY, duty: 'zone' })
    points.push({ x: zonalX, y: 34, duty: 'zone' })
    points.push({ x: zonalX, y: farY, duty: 'zone' })
    points.push({ x: 96, y: 31, duty: 'mark' })
    points.push({ x: 96, y: 37, duty: 'mark' })
    points.push({ x: 89, y: 34, duty: 'edge' })
  }
  // Two up the pitch: the counter is the reason teams defend corners well.
  const upX = 62 + spread(shape.lineHeight) * 10
  points.push({ x: upX, y: 20, duty: 'counter' })
  points.push({ x: upX, y: 48, duty: 'counter' })
  return points
}

/** Wide free-kick attacking shape: near/far post plus the edge of the box. */
export function wideFreeKickAttackShape(side: -1 | 1, shape: TeamShapeInput): SetPiecePoint[] {
  const w = spread(shape.width) * 2.4
  return [
    { x: 98, y: 34, duty: 'penalty-spot' },
    { x: 95, y: (side < 0 ? 40 : 28) + w, duty: 'back-post' },
    { x: 94, y: (side < 0 ? 29 : 39) - w, duty: 'near-post' },
    { x: 92, y: (side < 0 ? 24 : 44) + w, duty: 'near-post' },
    { x: 84, y: 34, duty: 'edge' },
    { x: 100.5, y: 34, duty: 'screen' },
  ]
}

/**
 * How long the picture takes to set, in restart-clock seconds. Real dead balls
 * eat twenty to thirty seconds of match time; the engine runs a compressed
 * clock, so this is the equivalent wait. Tired legs and a big travel distance
 * add to it — a team that has to walk 40 m to a corner sets up slower.
 */
export function setPieceSetupSeconds(
  type: 'corner' | 'freekick' | 'offside' | 'throw' | 'goalkick' | 'penalty',
  options: { meanLoad: number; meanSpeed: number; travel: number; jitter: number },
): number {
  const base: Record<typeof type, number> = {
    corner: 2.6,
    freekick: 2.4,
    offside: 1.1,
    throw: 1.0,
    goalkick: 0.9,
    penalty: 2.6,
  }
  // A set piece is a production: everybody walks to a spot and the taker waits
  // for the picture. A throw-in is not — the thrower picks it up and goes.
  const isSetPiece = type === 'corner' || type === 'freekick' || type === 'penalty'
  const weight = isSetPiece ? 1 : 0.45
  const fatigue = 1 + clamp01((options.meanLoad - 45) / 100) * 0.55 * weight
  const speed = clamp01((80 - options.meanSpeed) / 40) * 0.35 * weight
  const travel = clamp01(options.travel / 45) * 0.6 * weight
  return base[type] * (1 + fatigue + speed + travel) + options.jitter
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

/** Reads a plan's sliders into the shape input the skeletons use. */
export function shapeInput(plan: TeamPlan): TeamShapeInput {
  return { width: plan.sliders.width, compactness: plan.sliders.compactness, lineHeight: plan.sliders.lineHeight }
}
