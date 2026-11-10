import { circulationPenalty, flowVerdict, pickDropper, type DropCandidate } from './passflow'
import { emptyTeamTactics, recordTacticalSample, type TeamTactics } from './tactics'
import {
  MANAGER_MARKS, SUB_RULES, pickSubstitution,
  type BenchView, type StarterView, type SubContext,
} from './subs'
import { roleProfile, type RoleId } from './roles'
import { lineOfPosition, type MotionModel } from './motion'
import {
  cornerAttackShape,
  cornerDefenceShape,
  setPieceSetupSeconds,
  shapeInput,
  wideFreeKickAttackShape,
  type SetPieceDuty,
} from './setpieces'
import {
  FORMATIONS,
  effectiveAttribute,
  getPlayer,
  getTeam,
  normalizeGameplaySettings,
  normalizeRatingOverrides,
  positionOverall,
  weakFootPenalty,
  withRatingOverrides,
  type GamePlayer,
  type GameplaySettings,
  type GameplaySideSettings,
  type PositionCode,
  type RatingOverrides,
  type TeamId,
  type TeamPlan,
} from './data'

export type Difficulty = 'easy' | 'normal' | 'hard' | 'real'
export type RulesProfile = 'arcade' | 'standard' | 'current'
export type MatchMode = 'match' | 'training' | 'watch'

export interface Vec { x: number; y: number }

export interface PlayerInput {
  move: Vec
  sprint: boolean
  close: boolean
  pass: boolean
  through: boolean
  /** Double-tap pass: a flat, hard ball along the floor. */
  drivenPass: boolean
  drivenPower: number
  cross: boolean
  shoot: boolean
  shootHeld: boolean
  shootPower: number
  crossPower: number
  tackle: boolean
  tackleHeld: boolean
  tacklePower: number
  knockAhead: boolean
  switchPlayer: boolean
  sendRun: boolean
  callSupport: boolean
  manual: boolean
  lineStep: boolean
  lineDrop: boolean
}

export const NEUTRAL_INPUT: PlayerInput = {
  move: { x: 0, y: 0 }, sprint: false, close: false, pass: false, through: false, drivenPass: false, drivenPower: 0.6, cross: false,
  shoot: false, shootHeld: false, shootPower: 0.6, crossPower: 0.6, tackle: false, tackleHeld: false, tacklePower: 0.25, knockAhead: false, switchPlayer: false,
  sendRun: false, callSupport: false, manual: false, lineStep: false, lineDrop: false,
}

export interface MatchConfig {
  homePlan: TeamPlan
  awayPlan: TeamPlan
  difficulty: Difficulty
  rules: RulesProfile
  halfSeconds: number
  humanTeams: TeamId[]
  seed?: number
  mode?: MatchMode
  gameplay?: GameplaySettings
  ratingOverrides?: RatingOverrides
  /**
   * Movement learned from match video (see `motion.ts`). Absent means the roles
   * move exactly as they always have: a fitted model is an addition, never a
   * silent replacement.
   */
  motion?: MotionModel
}

export interface RuntimePlayer {
  id: string
  teamId: TeamId
  base: GamePlayer
  slotId: string
  slotPosition: PositionCode
  baseX: number
  baseY: number
  pos: Vec
  vel: Vec
  facing: Vec
  target: Vec
  smoothedTarget: Vec
  onPitch: boolean
  burst: number
  load: number
  decisionTimer: number
  tackleCooldown: number
  slideTimer: number
  runUntil: number
  /** A goalkeeper with the ball in his hands holds it to let the picture reset. */
  holdUntil: number
  /** Last time he stood the ball up waiting for a drop or a join. */
  lastHoldAt: number
  /** One-against-one: this defender is going after the man with the ball. */
  duelCommit: boolean
  duelUntil: number
  duelCarrierId: string | null
  supportUntil: number
  gkRushUntil: number
  /** Winger is committed to cutting inside and shooting. */
  insideRunUntil: number
  /**
   * Which side of the body the ball sits on, -1 = his left, +1 = his right.
   * This is what decides the striking foot: a ball on the left of the body
   * can only be hit with the left foot without a touch to reshape.
   */
  ballSide: number
  moveUrgency: number
  touchTimer: number
  touchDirection: Vec
  touchDistance: number
  yellowCards: number
  sentOff: boolean
  injured: boolean
  distance: number
  /**
   * Physical output, measured rather than summarised. `topSpeedMps` is the
   * fastest frame he produced; the two counters are how far he covered above
   * each band (5.5 m/s ≈ 19.8 km/h high intensity, 7 m/s ≈ 25.2 km/h sprint).
   * Distance alone flatters the player who walks to the right places.
   */
  topSpeedMps: number
  highIntensityDistance: number
  sprintDistance: number
  /** The same totals, split by whether his side had the ball. */
  distanceInPossession: number
  distanceOutOfPossession: number
  sprintInPossession: number
  sprintOutOfPossession: number
  touches: number
  passes: number
  completedPasses: number
  shots: number
  goals: number
  tackles: number
  interceptions: number
  fouls: number
  saves: number
  avgX: number
  avgY: number
  samples: number
  /**
   * The same averages, split by whether the player's side had the ball. A
   * whole-match average answers "where does this team live"; it cannot answer
   * "what shape does it hold when it attacks", and those are different
   * questions with different answers — the second one is what a coach (and
   * the shape panel) actually asks.
   */
  inX: number
  inY: number
  inCount: number
  outX: number
  outY: number
  outCount: number
  touchPoints: Array<{ x: number; y: number }>
  positionHeat: number[]
}

export type BallKind = 'dribble' | 'pass' | 'shot' | 'cross' | 'loose' | 'restart'

export interface BallState {
  pos: Vec
  vel: Vec
  z: number
  vz: number
  ownerId: string | null
  intendedReceiverId: string | null
  passTeamId: TeamId | null
  lastTouchTeamId: TeamId
  lastTouchPlayerId: string | null
  kind: BallKind
  offsideReceiverId: string | null
  aerialResolved: boolean
  shotXg: number
  shotOrigin: Vec | null
  shotPower: number
  shotDistance: number
  age: number
  saveAttempted: boolean
  interceptionAttempts: string[]
  /** Last pass was struck flat and hard along the floor. */
  driven?: boolean
  /**
   * The ball is in the air on a football pass (a clipped ball, a switch, a
   * diagonal). Kept separate from `kind` so a lofted pass is never mistaken
   * for a cross — a cross is a delivery into the box from wide, and it is the
   * only thing that sets kind 'cross'.
   */
  lofted?: boolean
  /** Half-clock stamp for when a dead ball last became nobody's. */
  looseAt?: number
  /** Seconds this ball has been sitting still with nobody on it. */
  stalledFor?: number
}

export type RestartType = 'kickoff' | 'throw' | 'corner' | 'goalkick' | 'freekick' | 'penalty' | 'offside'

export interface RestartState {
  type: RestartType
  teamId: TeamId
  x: number
  y: number
  takerId: string
  timer: number
  aim: Vec
  /** Realistic set-up window, in seconds, before the restart may be taken. */
  setup: number
  /** A fast restart is on: a free team-mate ahead makes an immediate release worth it. */
  quick: boolean
  /** The free man a quick restart should be released to. */
  quickTargetId: string | null
  /** The taker has reached the BallState at least once (sticky). */
  arrived: boolean
  /** Restart-clock time at which he first got there; the set-up starts then. */
  arrivedAt: number | null
  /** A human asked to play the restart during the set-up window; fire it on completion. */
  buffered: PlayerInput | null
  /**
   * Human-controlled restarts only: if the pad is idle for a beat after the
   * set-up window, a team-mate takes it. A match must never freeze waiting on
   * a button the player does not know is there.
   */
  autoTake?: boolean
  /**
   * Why this restart happened, where the engine knows: `header`, `keeper`,
   * `block`, `deflection`, `goal-line`. Written for corners, which are the
   * hardest dead ball to calibrate because four different events produce them
   * and they all look identical from the stats sheet.
   */
  cause?: string
}

export interface TeamStats {
  possessionSeconds: number
  passes: number
  completedPasses: number
  shots: number
  shotsOnTarget: number
  xg: number
  corners: number
  fouls: number
  offsides: number
  tackles: number
  saves: number
  drivenPasses?: number
}

export interface MatchEvent {
  minute: number
  teamId?: TeamId
  playerId?: string
  text: string
  kind: 'goal' | 'card' | 'sub' | 'chance' | 'info'
  /**
   * How a goal was created, where the engine knows: the dead ball that started
   * the move, or `open` for a goal built from open play. Set-piece share is a
   * real balance lever (about 28% of goals in the modern game), so it has to
   * be measurable rather than assumed.
   */
  from?: 'corner' | 'freekick' | 'throw' | 'goalkick' | 'penalty' | 'kickoff' | 'open'
}

/** How long each beat of the goal presentation lasts, in seconds. */
export const GOAL_PRESENTATION = { celebration: 2.6, scoreline: 1.9, net: 3.0 } as const
export const GOAL_PHASE_SECONDS = GOAL_PRESENTATION.celebration
  + GOAL_PRESENTATION.scoreline
  + GOAL_PRESENTATION.net

/**
 * Everything the goal replay needs: who scored, the score it made, and the
 * two points that matter for the goal-mouth graphic - where the ball crossed
 * the line and where it was struck from.
 */
export interface GoalRecord {
  teamId: TeamId
  scorerId: string | null
  scorerName: string
  scorerNumber: number | null
  minute: number
  /** Metres across the pitch where the ball crossed the goal line. */
  impactY: number
  /** Metres off the ground where it crossed. */
  impactZ: number
  /** Where the strike started, for the path drawn on the goal-mouth view. */
  fromY: number
  fromZ: number
  ownGoal: boolean
  /** Which goal it went in: the camera behind it flips the mouth view. */
  end: 'left' | 'right'
  score: Record<TeamId, number>
}

export interface PendingSub { teamId: TeamId; outId: string; inId: string }

export interface MatchState {
  config: MatchConfig
  phase: 'restart' | 'play' | 'goal' | 'halftime' | 'fulltime'
  restart: RestartState | null
  players: RuntimePlayer[]
  ball: BallState
  score: Record<TeamId, number>
  half: 1 | 2
  halfElapsed: number
  clockSeconds: number
  phaseTimer: number
  sampleTimer: number
  controlled: Record<TeamId, string | null>
  stats: Record<TeamId, TeamStats>
  events: MatchEvent[]
  message: string
  rng: number
  substitutions: Record<TeamId, { used: number; windows: number }>
  pendingSubs: PendingSub[]
  managerChecks: Record<string, boolean>
  /** The dead ball that most recently put the match back in play. */
  lastRestart: { type: RestartType; teamId: TeamId; clock: number; elapsed: number } | null
  kickoffTeam: TeamId
  resultRecorded: boolean
  /**
   * Where each side last *saw* the defensive line it is attacking, in world x.
   *
   * Attackers and passers track the last defender with their eyes, not with a
   * laser: a line that steps up takes about half a second to register. That lag
   * is what makes a stepping line work at all — the flag is judged on the true
   * line, the pass is played against the seen one. See docs/stepping-line.md.
   */
  lineSeenX: Record<TeamId, number>
  /** Running shape statistics, sampled once a second (see tactics.ts). */
  tactics: Record<TeamId, TeamTactics>
  /** Most recent goal, kept for the celebration and the goal-mouth replay. */
  lastGoal: GoalRecord | null
  /**
   * Possession as the shape code understands it, and when it last changed
   * hands. A side drops as a unit in the seconds after losing the ball; without
   * this stamp the block could only ever be anchored to where the ball *is*,
   * which is what made a turnover invisible — the defence stepped up while the
   * front line dropped, and the two cancelled out.
   */
  possessionTeam?: TeamId | null
  possessionGainedAt?: number
}

const W = 105
const H = 68
const GROUND_BALL_DRAG = 0.72
const AIR_BALL_DRAG = 0.11
export const POSITION_HEAT_COLS = 21
export const POSITION_HEAT_ROWS = 14
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const len = (v: Vec) => Math.hypot(v.x, v.y)
const norm = (v: Vec): Vec => {
  const l = len(v)
  return l < 0.0001 ? { x: 1, y: 0 } : { x: v.x / l, y: v.y / l }
}
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y })
const mul = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s })
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)
/** A vector at right angles to `v`, scaled — used to fan runners apart. */
const perpOffset = (v: Vec, scale: number): Vec => ({ x: -v.y * scale, y: v.x * scale })
const rotate = (v: Vec, radians: number): Vec => ({
  x: v.x * Math.cos(radians) - v.y * Math.sin(radians),
  y: v.x * Math.sin(radians) + v.y * Math.cos(radians),
})
/**
 * Turning with the ball is a physical skill, not a free rotation. PES agility
 * and dribble accuracy decide how quickly a carrier can put his body between
 * the ball and the defender; without the ball almost anyone turns quickly.
 */
function carrierTurnRate(p: RuntimePlayer): number {
  const skill = attr(p, 'agility') * 0.55 + attr(p, 'dribbleAccuracy') * 0.45
  return clamp(0.24 + (skill - 62) / 210, 0.2, 0.56)
}

function turnFacing(p: RuntimePlayer, desired: Vec, amount: number) {
  if (len(desired) < 0.01) return
  p.facing = norm(add(mul(p.facing, 1 - amount), mul(norm(desired), amount)))
}
const other = (t: TeamId): TeamId => t === 'bracelonia' ? 'banyarn' : 'bracelonia'

function rand(state: MatchState): number {
  state.rng = (state.rng * 1664525 + 1013904223) >>> 0
  return state.rng / 4294967296
}
function range(state: MatchState, min: number, max: number) { return min + rand(state) * (max - min) }

export function attackDir(state: MatchState, teamId: TeamId): 1 | -1 {
  const homeDir = state.half === 1 ? 1 : -1
  return teamId === 'bracelonia' ? homeDir : (homeDir * -1) as 1 | -1
}
function localToWorld(state: MatchState, teamId: TeamId, x: number, y: number): Vec {
  return attackDir(state, teamId) === 1 ? { x, y } : { x: W - x, y: H - y }
}
/**
 * Who has the ball, for shape and load purposes: a pass in flight still belongs
 * to the side that played it, and a rebound to the side that shot. Kept in one
 * place so the phase split, the sampling pass and the movement accounting can
 * never disagree about which phase a frame was.
 */
function possessionTeamOf(state: MatchState): TeamId | null {
  const owner = byId(state, state.ball.ownerId)
  return owner?.teamId
    ?? ((state.ball.kind === 'pass' || state.ball.kind === 'cross') ? state.ball.passTeamId : null)
    ?? (state.ball.kind === 'shot' ? state.ball.lastTouchTeamId : null)
}

function worldToLocal(state: MatchState, teamId: TeamId, p: Vec): Vec {
  return attackDir(state, teamId) === 1 ? { ...p } : { x: W - p.x, y: H - p.y }
}
function goalTarget(state: MatchState, teamId: TeamId): Vec {
  return { x: attackDir(state, teamId) === 1 ? W : 0, y: H / 2 }
}
function ownGoal(state: MatchState, teamId: TeamId): Vec {
  return { x: attackDir(state, teamId) === 1 ? 0 : W, y: H / 2 }
}
function byId(state: MatchState, id: string | null): RuntimePlayer | undefined {
  return id ? state.players.find((p) => p.id === id) : undefined
}
function onPitch(state: MatchState, teamId?: TeamId): RuntimePlayer[] {
  return state.players.filter((p) => p.onPitch && !p.sentOff && (!teamId || p.teamId === teamId))
}
function attr(p: RuntimePlayer, key: Parameters<typeof effectiveAttribute>[1]): number {
  return effectiveAttribute(p.base, key)
}
/**
 * Which foot a strike is taken with.
 *
 * The ball's position relative to the body decides it: a ball on his right
 * can only be hit with his right without a touch to reshape, which is why
 * the engine keeps the ball physically on one side (see `ballPhysics`).
 * `weakFootAccuracy` (1-8) says how much a wrong-foot strike costs, and
 * `weakFootFrequency` says how willingly he uses it at all.
 */
export function strikeFoot(p: RuntimePlayer, ballPos: Vec): { foot: 'L' | 'R'; weak: boolean; noiseScale: number; powerScale: number } {
  const perp = { x: -p.facing.y, y: p.facing.x }
  const lateral = (ballPos.x - p.pos.x) * perp.x + (ballPos.y - p.pos.y) * perp.y
  const nearFoot: 'L' | 'R' = lateral >= 0 ? 'R' : 'L'
  const twoFooted = p.base.foot === 'B'
  const weak = !twoFooted && nearFoot !== p.base.foot
  if (!weak) return { foot: nearFoot, weak: false, noiseScale: 1, powerScale: 1 }
  const accuracy = attr(p, 'weakFootAccuracy')
  // 8 is genuinely two-footed, 1 is a one-footed specialist whose weak side
  // sprays it. The frequency of use is handled in ballPhysics: a player who
  // rarely uses his weak foot rolls the ball onto the strong one when he has
  // the yard to do it, and has to hit it as it lies when he does not.
  return { foot: nearFoot, weak: true, ...weakFootPenalty(accuracy) }
}

function difficultyParams(state: MatchState, teamId: TeamId) {
  const human = state.config.humanTeams.includes(teamId)
  const level = human ? 'normal' : state.config.difficulty
  if (level === 'easy') return { decision: 0.78, error: 1.55, quality: 0.72, press: 0.72, shotError: 1.45 }
  if (level === 'hard') return { decision: 0.43, error: 0.78, quality: 1.12, press: 1.12, shotError: 0.82 }
  if (level === 'real') return { decision: 0.34, error: 0.62, quality: 1.22, press: 1.22, shotError: 0.7 }
  return { decision: 0.58, error: 1, quality: 1, press: 1, shotError: 1 }
}
function planFor(state: MatchState, teamId: TeamId): TeamPlan {
  return teamId === 'bracelonia' ? state.config.homePlan : state.config.awayPlan
}
function gameplayFor(state: MatchState, teamId: TeamId): GameplaySideSettings {
  const settings = state.config.gameplay?.user && state.config.gameplay?.cpu
    ? state.config.gameplay
    : normalizeGameplaySettings(state.config.gameplay)
  return state.config.humanTeams.includes(teamId) ? settings.user : settings.cpu
}
function matchGameplay(state: MatchState): GameplaySettings {
  return state.config.gameplay?.user && state.config.gameplay?.cpu
    ? state.config.gameplay
    : normalizeGameplaySettings(state.config.gameplay)
}
function sliderScale(value: number, amount = 0.006): number {
  return clamp(1 + (value - 50) * amount, 0.55, 1.5)
}
function sliderErrorScale(value: number): number {
  return clamp(0.55 + value / 111, 0.55, 1.45)
}
function slotPosition(plan: TeamPlan, slotId: string): PositionCode {
  return FORMATIONS[plan.formation]?.find((s) => s.id === slotId)?.position ?? 'CM'
}
function fatigueFactor(p: RuntimePlayer): number {
  const mentalityBuffer = (attr(p, 'mentality') / 100) * 0.35
  return 1 - Math.min(0.24, (p.load / 100) * 0.25 * (1 - mentalityBuffer)) - (p.injured ? 0.28 : 0)
}
function maxSpeed(state: MatchState, p: RuntimePlayer, sprint: boolean, withBall: boolean, urgent = false): number {
  const settings = gameplayFor(state, p.teamId)
  const top = (4.9 + attr(p, 'topSpeed') * 0.036) * (0.7 + settings.sprintSpeed / 166)
  const dribble = withBall ? 0.72 + attr(p, 'dribbleSpeed') / 420 : 1
  // A genuine recovery sprint should still look like a sprint late in a move.
  // Short-term burst depletion therefore gets a much higher floor for an
  // assigned loose-BallState chaser; previously a depleted chaser ambled at
  // roughly two-thirds of his top speed and loose balls looked unresponsive.
  const effectiveBurst = urgent ? Math.max(p.burst, 0.86) : p.burst
  const tacticModifier = urgent ? 1.06 : 1
  return top * (sprint ? 1 : 0.78) * dribble * fatigueFactor(p) * (0.55 + effectiveBurst * 0.45) * tacticModifier
}

function predictedBallPosition(state: MatchState, horizon: number): Vec {
  if (horizon <= 0) return { ...state.ball.pos }
  const drag = state.ball.z > 0.05 ? AIR_BALL_DRAG : GROUND_BALL_DRAG
  const travel = (1 - Math.exp(-drag * horizon)) / drag
  return {
    x: clamp(state.ball.pos.x + state.ball.vel.x * travel, 0.2, 104.8),
    y: clamp(state.ball.pos.y + state.ball.vel.y * travel, 0.2, 67.8),
  }
}

function looseBallIntercept(state: MatchState, p: RuntimePlayer): { point: Vec; time: number } {
  const speed = Math.max(0.1, maxSpeed(state, p, true, false, true))
  const reaction = clamp(0.3 - attr(p, 'response') / 650 - attr(p, 'mentality') / 2600, 0.05, 0.27)
  let time = reaction + dist(p.pos, state.ball.pos) / speed
  let point = predictedBallPosition(state, time)
  for (let i = 0; i < 3; i++) {
    time = reaction + dist(p.pos, point) / speed
    point = predictedBallPosition(state, time)
  }
  return { point, time }
}

interface LooseBallAssignment {
  rank: number
  point: Vec
  time: number
}

function looseBallAssignments(state: MatchState): Map<string, LooseBallAssignment> {
  const assignments = new Map<string, LooseBallAssignment>()
  if (state.phase !== 'play' || state.ball.ownerId) return assignments
  const intended = byId(state, state.ball.intendedReceiverId)
  for (const teamId of ['bracelonia', 'banyarn'] as TeamId[]) {
    // With a live intended receiver, only the defending team contests the
    // lane; extra attackers must not cut across their own receiver.
    if (intended && intended.teamId === teamId) continue
    const candidates = onPitch(state, teamId)
      .filter((p) => {
        if (p.slotPosition !== 'GK') return true
        const local = worldToLocal(state, teamId, state.ball.pos)
        return state.ball.kind === 'loose' && local.x < 18 && dist(p.pos, state.ball.pos) < 13 && len(state.ball.vel) < 10
      })
      .map((p) => ({ p, ...looseBallIntercept(state, p) }))
      .sort((a, b) => a.time - b.time)
    const primary = candidates[0]
    if (!primary) continue
    const primaryRank = state.ball.kind === 'loose' || state.ball.kind === 'shot' || !intended ? 2 : 1
    // Rank is urgency, not just distance. Three men converging on the same
    // point at the same urgency is what makes a loose ball look like a
    // scrum: the winner goes flat out, the cover man arcs in behind him one
    // notch slower, and anyone further away holds and covers. They must not
    // fight for the same pixel.

    assignments.set(primary.p.id, { rank: primaryRank, point: primary.point, time: primary.time })

    // A genuinely loose BallState (rebound, deflection, heavy touch, knock
    // ahead) should look like football: the nearest two or three players
    // break immediately instead of one man jogging while ten watch.
    const contestEveryone = !intended && (state.ball.kind === 'loose' || state.ball.kind === 'shot')
    if (contestEveryone) {
      const closeChasers = candidates.slice(1, 3).filter((c) => c.time <= primary.time + 1.9)
      closeChasers.forEach((candidate, index) => {
        const goalSide = norm(sub(ownGoal(state, teamId), candidate.point))
        const continuation = len(state.ball.vel) > 0.5 ? mul(norm(state.ball.vel), 1.2) : { x: 0, y: 0 }
        // The second man does not run at the same spot: he takes a point
        // wider and goal-side of the favourite, ready for a knock-down or a
        // tackle that spills the ball.
        const point = index === 0
          ? candidate.point
          : add(add(candidate.point, mul(goalSide, 2.4)), add(continuation, perpOffset(goalSide, index === 0 ? 0 : 1.7)))
        assignments.set(candidate.p.id, {
          rank: index === 0 ? 2 : 1,
          point: { x: clamp(point.x, 0.5, 104.5), y: clamp(point.y, 0.5, 67.5) },
          time: candidate.time,
        })
      })
      continue
    }

    const secondary = candidates[1]
    if (!secondary) continue
    // A second recovery runner is for a genuinely loose BallState or rebound.
    // On an ordinary pass/cross with a live intended receiver, only the
    // first opponent attacks the lane; sending a second urgent chaser at
    // every pass would over-press the receiver and flatten build-up.
    if (intended && (state.ball.kind === 'pass' || state.ball.kind === 'cross')) continue
    const ballLocal = worldToLocal(state, teamId, state.ball.pos)
    const highValueSecondBall = ballLocal.x < 30 || ballLocal.x > 76
    const secondaryIsClose = secondary.time <= primary.time + (highValueSecondBall ? 1.15 : 0.65)
    if (!secondaryIsClose && state.ball.kind === 'loose') continue
    if (!secondaryIsClose && intended) continue
    const goalSide = norm(sub(ownGoal(state, teamId), secondary.point))
    const continuation = len(state.ball.vel) > 0.5 ? mul(norm(state.ball.vel), 1.5) : { x: 0, y: 0 }
    const supportPoint = add(add(secondary.point, mul(goalSide, 2.3)), continuation)
    assignments.set(secondary.p.id, {
      rank: 1,
      point: { x: clamp(supportPoint.x, 0.5, 104.5), y: clamp(supportPoint.y, 0.5, 67.5) },
      time: secondary.time,
    })
  }
  return assignments
}

// Deterministic 0..1 from a seed and a key. Matches used to start every
// player's decision timer from Math.random(), which made "seeded" matches
// slide a frame or two run-to-run and turned close assertions into coin
// flips. Everything a match does should now be a pure function of its seed.
function seededUnit(seed: number, key: string): number {
  let h = (seed >>> 0) ^ 0x9e3779b9
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  h ^= h >>> 15
  h = Math.imul(h, 0x2545f491) >>> 0
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

function makeRuntime(plan: TeamPlan, stateHalf: 1 | 2, config: MatchConfig): RuntimePlayer[] {
  const starterIds = new Set(plan.slots.map((s) => s.playerId))
  const players: RuntimePlayer[] = []
  const fakeState = { half: stateHalf, config } as MatchState
  for (const s of plan.slots) {
    const base = withRatingOverrides(getPlayer(s.playerId)!, config.ratingOverrides)
    const pos = localToWorld(fakeState, plan.teamId, s.x, s.y)
    players.push({
      id: base.id, teamId: plan.teamId, base, slotId: s.slotId, slotPosition: slotPosition(plan, s.slotId),
      baseX: s.x, baseY: s.y, pos, vel: { x: 0, y: 0 }, facing: { x: attackDir(fakeState, plan.teamId), y: 0 }, target: pos, smoothedTarget: pos,
      onPitch: true, burst: 1, load: 0, decisionTimer: seededUnit(config.seed ?? 20261019, `${plan.teamId}:${s.slotId}`) * 0.3, tackleCooldown: 0, slideTimer: 0,
      runUntil: 0, holdUntil: 0, lastHoldAt: 0, duelCommit: false, duelUntil: 0, duelCarrierId: null, supportUntil: 0, gkRushUntil: 0, insideRunUntil: 0, ballSide: 0, moveUrgency: 0, touchTimer: 0, touchDirection: { x: 1, y: 0 }, touchDistance: 0, yellowCards: 0, sentOff: false, injured: false, distance: 0, topSpeedMps: 0, highIntensityDistance: 0, sprintDistance: 0, distanceInPossession: 0, distanceOutOfPossession: 0, sprintInPossession: 0, sprintOutOfPossession: 0,
      touches: 0, passes: 0, completedPasses: 0, shots: 0, goals: 0, tackles: 0, interceptions: 0, fouls: 0, saves: 0,
      avgX: 0, avgY: 0, samples: 0, inX: 0, inY: 0, inCount: 0, outX: 0, outY: 0, outCount: 0, touchPoints: [], positionHeat: Array(POSITION_HEAT_COLS * POSITION_HEAT_ROWS).fill(0),
    })
  }
  for (const id of plan.benchIds) {
    if (starterIds.has(id)) continue
    const base = withRatingOverrides(getPlayer(id)!, config.ratingOverrides)
    players.push({
      id: base.id, teamId: plan.teamId, base, slotId: 'bench', slotPosition: base.position, baseX: 50, baseY: 70,
      pos: { x: 52, y: plan.teamId === 'bracelonia' ? -3 : 71 }, vel: { x: 0, y: 0 }, facing: { x: 1, y: 0 },
      target: { x: 52, y: 70 }, smoothedTarget: { x: 52, y: 70 }, onPitch: false, burst: 1, load: 0, decisionTimer: 0, tackleCooldown: 0, slideTimer: 0,
      runUntil: 0, holdUntil: 0, lastHoldAt: 0, duelCommit: false, duelUntil: 0, duelCarrierId: null, supportUntil: 0, gkRushUntil: 0, insideRunUntil: 0, ballSide: 0, moveUrgency: 0, touchTimer: 0, touchDirection: { x: 1, y: 0 }, touchDistance: 0, yellowCards: 0, sentOff: false, injured: false, distance: 0, topSpeedMps: 0, highIntensityDistance: 0, sprintDistance: 0, distanceInPossession: 0, distanceOutOfPossession: 0, sprintInPossession: 0, sprintOutOfPossession: 0,
      touches: 0, passes: 0, completedPasses: 0, shots: 0, goals: 0, tackles: 0, interceptions: 0, fouls: 0, saves: 0,
      avgX: 0, avgY: 0, samples: 0, inX: 0, inY: 0, inCount: 0, outX: 0, outY: 0, outCount: 0, touchPoints: [], positionHeat: Array(POSITION_HEAT_COLS * POSITION_HEAT_ROWS).fill(0),
    })
  }
  return players
}

export function createMatch(config: MatchConfig): MatchState {
  config = {
    ...config,
    gameplay: normalizeGameplaySettings(config.gameplay),
    ratingOverrides: normalizeRatingOverrides(config.ratingOverrides),
  }
  const state: MatchState = {
    config,
    phase: 'restart',
    restart: null,
    players: [...makeRuntime(config.homePlan, 1, config), ...makeRuntime(config.awayPlan, 1, config)],
    ball: {
      pos: { x: W / 2, y: H / 2 }, vel: { x: 0, y: 0 }, z: 0, vz: 0, ownerId: null, intendedReceiverId: null,
      passTeamId: null, lastTouchTeamId: 'bracelonia', lastTouchPlayerId: null, kind: 'restart', offsideReceiverId: null,
      aerialResolved: false, shotXg: 0, shotOrigin: null, shotPower: 0, shotDistance: 0, age: 0, saveAttempted: false, interceptionAttempts: [],
    },
    score: { bracelonia: 0, banyarn: 0 },
    half: 1,
    halfElapsed: 0,
    clockSeconds: 0,
    phaseTimer: 0,
    lastGoal: null,
    tactics: { bracelonia: emptyTeamTactics(), banyarn: emptyTeamTactics() },
    lineSeenX: { bracelonia: 52.5, banyarn: 52.5 },
    sampleTimer: 0,
    controlled: { bracelonia: null, banyarn: null },
    stats: {
      bracelonia: { possessionSeconds: 0, passes: 0, completedPasses: 0, shots: 0, shotsOnTarget: 0, xg: 0, corners: 0, fouls: 0, offsides: 0, tackles: 0, saves: 0 },
      banyarn: { possessionSeconds: 0, passes: 0, completedPasses: 0, shots: 0, shotsOnTarget: 0, xg: 0, corners: 0, fouls: 0, offsides: 0, tackles: 0, saves: 0 },
    },
    events: [],
    message: 'Kick-off',
    rng: (config.seed ?? 20261019) >>> 0,
    substitutions: { bracelonia: { used: 0, windows: 0 }, banyarn: { used: 0, windows: 0 } },
    pendingSubs: [],
    managerChecks: {},
    kickoffTeam: 'bracelonia',
    lastRestart: null,
    resultRecorded: false,
  }
  setupKickoff(state, 'bracelonia')
  // A side knows where the line is from the first whistle; a stale default here
  // would hold the whole front line at halfway for the opening seconds.
  for (const teamId of ['bracelonia', 'banyarn'] as TeamId[]) {
    const line = secondLastOpponentX(state, teamId)
    if (Number.isFinite(line)) state.lineSeenX[teamId] = line
  }
  return state
}

function defensiveTrapContext(state: MatchState, teamId: TeamId, owner: RuntimePlayer | undefined, trapSlider: number): { bonus: number; stagger: number; trigger: boolean } {
  if (!owner || owner.teamId === teamId) return { bonus: 0, stagger: 0.3, trigger: false }
  const pressureDistance = Math.min(...onPitch(state, teamId).map((p) => dist(p.pos, owner.pos)), 99)
  const backward = norm(sub(ownGoal(state, owner.teamId), owner.pos))
  const movingBackward = owner.vel.x * backward.x + owner.vel.y * backward.y > 1.1
  const facingBackward = owner.facing.x * backward.x + owner.facing.y * backward.y > 0.28
  const trigger = pressureDistance < 4.6 || movingBackward || facingBackward
  if (teamId === 'bracelonia') {
    // Flick-style trap: the line is always brave, but the synchronized step
    // is tied to pressure or a backward-facing carrier. Stepping as four
    // separate staggered defenders would simply play runners onside.
    return {
      bonus: trapSlider * (trigger ? 0.09 : 0.035),
      stagger: trigger ? 0.07 : 0.16,
      trigger,
    }
  }
  if (teamId === 'banyarn') {
    // Banyarn still defend high and man-oriented, but their line step is a
    // situational squeeze on a backward/dead BallState rather than a constant
    // all-four offside trap.
    const squeeze = movingBackward || facingBackward || pressureDistance < 2.8
    return {
      bonus: trapSlider * (squeeze ? 0.042 : 0.015),
      stagger: squeeze ? 0.18 : 0.28,
      trigger: squeeze,
    }
  }
  return { bonus: trapSlider * 0.02, stagger: 0.3, trigger }
}

type DefensiveMode = 'press' | 'contain' | 'drop'

function defensiveMode(state: MatchState, teamId: TeamId, owner: RuntimePlayer | undefined): DefensiveMode {
  if (!owner || owner.teamId === teamId) return 'contain'
  const pressing = planFor(state, teamId).sliders.pressing
  const ballLocal = worldToLocal(state, teamId, owner.pos)
  const minute = state.clockSeconds / 60
  const scoreDiff = state.score[teamId] - state.score[other(teamId)]
  const backward = norm(sub(ownGoal(state, owner.teamId), owner.pos))
  const facingBackward = owner.facing.x * backward.x + owner.facing.y * backward.y > 0.28
  const looseTouch = owner.touchTimer > 0.03 || owner.touchDistance > 1.1

  // Classic, readable phase choice rather than every player independently
  // inventing a press: protect the box first, chase the game late, protect a
  // late lead if the plan is not an all-out press, otherwise use BallState zone
  // and the carrier's body shape.
  if (ballLocal.x < 28) return 'contain'
  if (scoreDiff < 0 && minute > 62) return 'press'
  if (scoreDiff > 0 && minute > 72 && pressing < 78) return 'drop'
  if (ballLocal.x > 62 && pressing >= 56) return 'press'
  if (ballLocal.x > 48 && pressing >= 74) return 'press'
  if ((facingBackward || looseTouch) && pressing >= 60) return 'press'
  if (pressing < 42) return 'drop'
  return 'contain'
}

function anchorFor(state: MatchState, p: RuntimePlayer): Vec {
  const plan = planFor(state, p.teamId)
  const sliders = plan.sliders
  const ballLocal = worldToLocal(state, p.teamId, state.ball.pos)
  const owner = byId(state, state.ball.ownerId)
  // A team does not cease to be "in possession" for shape purposes during
  // the second a pass is travelling. Using only the current owner made all
  // eleven players oscillate between attacking and defensive anchors on
  // every pass, stranding forwards/fullbacks around halfway.
  //
  // The same applies to a player pushing the BallState: a knock-ahead is a
  // loose BallState with the carrier as its intended receiver, and a shot is
  // still the shooting team's attack. Treating either as "no possession" made
  // strikers and wingers drop back the instant their own man pushed the ball
  // or shot, which is the opposite of following the play in.
  const looseOwner = state.ball.kind === 'loose' && state.ball.intendedReceiverId
    ? byId(state, state.ball.intendedReceiverId)
    : undefined
  const possessionTeam = owner?.teamId
    ?? ((state.ball.kind === 'pass' || state.ball.kind === 'cross') ? state.ball.passTeamId : null)
    ?? looseOwner?.teamId
    ?? (state.ball.kind === 'shot' ? state.ball.lastTouchTeamId : null)
  const inPossession = possessionTeam === p.teamId
  const loose = !owner
  const settings = gameplayFor(state, p.teamId)
  const trap = defensiveTrapContext(state, p.teamId, owner, sliders.offsideTrap)
  const mode = defensiveMode(state, p.teamId, owner)
  const lineCap = clamp(50 + (settings.lineHeight - 50) * 0.22 + (sliders.lineHeight - 50) * 0.1, 44, 62)
  // In possession the centre-backs own a high build-up line behind the BallState.
  // It travels from roughly 22m when the BallState is deep to the high-50s in
  // sustained attacks; the CDM sits in front of it, in midfield, rather than
  // becoming a third centre-back on the offside line.
  // Team LENGTH lives here. This is the one number that decides how far the
  // side stretches from its own goal to the other, and it was set so the back
  // four travelled 60% of the ball's progress — which meant that with the ball
  // on halfway the centre-backs stood on halfway too, and the team became a
  // 35 m band that slid up and down the pitch as one piece. A side that wants
  // to be spread has to hold its depth at the back and let the front line get
  // away from it. The line now follows the ball at roughly a third of its
  // travel, so the space between defence and attack is where the game happens.
  const buildUpLine = clamp(
    12.5 + ballLocal.x * 0.6 + (sliders.lineHeight - 50) * 0.1 + (settings.lineHeight - 50) * 0.08,
    10,
    58,
  )
  const defensiveLine = inPossession
    ? buildUpLine
    : clamp(
      // The defensive line is anchored in the side's own half and follows the
      // ball forward from there. The old curve put its constant term far
      // enough up the pitch that a pressing side defended with its centre-backs
      // on the halfway line whenever the ball crossed it — a line nobody could
      // actually hold, leaving the whole space between it and the keeper open.
      Math.min(
        19 + ballLocal.x * 0.34 + (sliders.lineHeight - 50) * 0.3 + (settings.lineHeight - 50) * 0.11 + trap.bonus - 2
        // Pressing is what turns a block into a squeeze: the whole unit steps up
        // the pitch to get near the ball. Line height sets where the block
        // lives, pressing sets how far forward it goes hunting. The dial is read
        // against the club's own default, so a plan left alone defends exactly
        // where that side has always defended.
        + (sliders.pressing - getTeam(p.teamId).identity.pressing) * 0.16
        + (mode === 'press' ? 2 : mode === 'drop' ? -5 : 0),
        // ...but the line cannot run away with itself. A back line MAY stand
        // ahead of the ball — that is precisely what pressing, and the offside
        // trap, are — but a cap of `ball - 4` was tried here first and it
        // destroyed both: the trap test failed with the line at 34 instead of
        // above 50, and offsides fell from 4.4 a match to 0.4. Ten metres in
        // front of the ball is a high line; fifty is a broken one.
        ballLocal.x + 10,
      ),
      12,
      lineCap,
    )
  let x = p.baseX + clamp((ballLocal.x - 52.5) * (inPossession ? 0.34 : 0.27), -15, 15)
  const widthScale = (inPossession ? 0.76 + sliders.width / 190 : 1.18 - sliders.compactness / 175) * (0.82 + settings.lineWidth / 278)
  let y = 34 + (p.baseY - 34) * widthScale + (ballLocal.y - p.baseY) * (inPossession ? 0.1 : 0.18)
  const pos = p.slotPosition
  if (pos === 'GK') {
    const sweeperDepth = !inPossession && owner ? 0.9 + attr(p, 'response') / 100 * 1.4 : 0
    x = 4 + ballLocal.x * 0.075 + (inPossession ? 3 : sweeperDepth)
    // Position on the BallState-to-goal angle bisector, not halfway toward the
    // BallState's touchline y-coordinate. The old share stranded the keeper
    // near one post on wide dribbles and made far-post finishes far too easy.
    const angleShare = clamp(3.2 / (Math.max(6, ballLocal.x) + 3.2), 0.08, 0.32)
    y = 34 + (ballLocal.y - 34) * angleShare
  } else if (['LB', 'LCB', 'CB', 'RCB', 'RB'].includes(pos)) {
    const isCentreBack = ['LCB', 'CB', 'RCB'].includes(pos)
    x = isCentreBack ? defensiveLine : defensiveLine + (p.baseX - 15) * (inPossession ? 0.35 : trap.stagger)
    if (inPossession && ['LB', 'RB'].includes(pos)) x += 12 + (settings.fullbackPositioning - 50) * 0.14
  } else if (['DM', 'LDM', 'RDM'].includes(pos)) {
    x = Math.max(x + (inPossession ? 5 : -4), defensiveLine + 8)
  } else if (['LCM', 'CM', 'RCM'].includes(pos)) {
    x += inPossession ? 5 : -4
  } else if (['LM', 'RM', 'LW', 'RW'].includes(pos)) {
    x += inPossession ? 7 : -8
    // The width dial is exactly about these four players: a winger told to
    // hold the touchline has to actually hold it.
    const wide = (inPossession ? 1 : 0.86) * widthScale
    y = 34 + (p.baseY - 34) * wide + (ballLocal.y - 34) * 0.08
  } else if (['CAM', 'ST', 'LST', 'RST'].includes(pos)) {
    x += inPossession ? 4 : -10
  }
  if (inPossession && owner?.id !== p.id && state.ball.kind !== 'shot') {
    const progress = clamp((ballLocal.x - 28) / 48, 0, 1)
    const sameSide = Math.sign(p.baseY - 34) === Math.sign(ballLocal.y - 34)
    // Where the width dial reaches: the touchline is only the touchline if the
    // manager has asked the team to use it. A narrow side plays in the
    // half-spaces even when the ball is wide.
    const widthBite = clamp(widthScale, 0.6, 1.25)
    const touchlineY = 34 + (p.baseY < 34 ? -28 : 28) * clamp(widthBite, 0.45, 1)
    const halfSpaceY = 34 + (p.baseY < 34 ? -11 : 11) * clamp(widthBite, 0.5, 1.2)
    const fullbackAdvance = (settings.fullbackPositioning - 50) * 0.16
    const runAdvance = (settings.runFrequency - 50) * 0.05

    if (ballLocal.x < 42) {
      // First-phase build-up uses the whole team: split centre-backs,
      // touchline fullbacks, a pivot show, interiors in the half-spaces and
      // the front line pinning depth so the first pass is not the only
      // available progression mechanism.
      if (['LCB', 'CB', 'RCB'].includes(pos)) {
        x = defensiveLine
        y = p.baseY < 34 ? 18 : 50
      } else if (['LB', 'RB', 'LWB', 'RWB'].includes(pos)) {
        x = Math.max(x, 34 + progress * 8 + fullbackAdvance)
        y = touchlineY
      } else if (['DM', 'LDM', 'RDM'].includes(pos)) {
        x = Math.max(x, ballLocal.x + 7)
        y = ballLocal.y < 34 ? 39 : 29
      } else if (['LCM', 'CM', 'RCM'].includes(pos)) {
        x = Math.max(x, ballLocal.x + 15)
        y = halfSpaceY
        // Support is a distance, not a slogan: a high setting brings the
        // options in toward the ball, a low one leaves them on their own
        // patch of grass.
        y += (ballLocal.y - y) * clamp(sliders.support / 240, 0, 0.42)
      } else if (pos === 'CAM') {
        x = Math.max(x, ballLocal.x + 24)
      } else if (['LM', 'RM', 'LW', 'RW'].includes(pos)) {
        x = Math.max(x, 60)
        y = touchlineY
      } else if (['ST', 'LST', 'RST'].includes(pos)) {
        x = Math.max(x, 70)
      }
    }

    // As the BallState advances, the whole block must travel with it. The old
    // anchors only shifted a base position by ±15m, leaving interiors and
    // fullbacks stranded near halfway during sustained final-third attacks.
    if (['DM', 'LDM', 'RDM'].includes(pos)) {
      const pivotX = ballLocal.x < 45
        ? ballLocal.x + 8
        : ballLocal.x < 68
          ? ballLocal.x + 2
          : ballLocal.x - 13
      x = clamp(pivotX, defensiveLine + 8, 76)
      y = ballLocal.y < 34 ? 38 : 30
    } else if (['LCM', 'CM', 'RCM'].includes(pos)) {
      x = Math.max(x, Math.min(86, ballLocal.x + 9 + progress * 8 + runAdvance))
      if (ballLocal.x > 48) {
        y = halfSpaceY
        // Support closing in toward the ball, whether the side is building or
        // already camped in the final third.
        y += (ballLocal.y - y) * clamp(sliders.support / 240, 0, 0.42)
      }
    } else if (pos === 'CAM') {
      x = Math.max(x, Math.min(90, ballLocal.x + 13 + runAdvance))
    } else if (['LM', 'RM', 'LW', 'RW'].includes(pos)) {
      x = Math.max(x, Math.min(96, ballLocal.x + 16 + runAdvance))
      // The winger owns the touchline on his own side: he stays wide to
      // receive and only steps infield once the ball is deep enough that the
      // near-post space is worth attacking.
      if (sameSide && ballLocal.x > 50) y = ballLocal.x > 80 ? (p.baseY < 34 ? 30 : 38) : touchlineY
    } else if (['ST', 'LST', 'RST'].includes(pos)) {
      x = Math.max(x, Math.min(97, ballLocal.x + 20 + runAdvance))
    } else if (['LB', 'RB', 'LWB', 'RWB'].includes(pos) && ballLocal.x >= 42) {
      if (sameSide) {
        const overlap = ballLocal.x + (Math.abs(ballLocal.y - 34) > 15 ? 15 : 9) + fullbackAdvance
        x = Math.max(x, Math.min(95, overlap))
        y = touchlineY
      } else {
        x = Math.max(x, Math.min(78, ballLocal.x - 6 + fullbackAdvance * 0.5))
        y = ballLocal.x > 68 ? (p.baseY < 34 ? 20 : 48) : touchlineY
      }
    } else if (['LCB', 'CB', 'RCB'].includes(pos) && ballLocal.x > 55) {
      x = Math.max(x, Math.min(58, ballLocal.x - 24))
    }
  }

  if (!inPossession && possessionTeam && pos !== 'GK') {
    // Out of possession, structure and retreat are two different rules, and the
    // old code had only one of them — applied in the wrong order.
    //
    // 1. STRUCTURE. Units are spaced off the back line rather than off their
    //    formation slots, so the block stays compact instead of leaving a 25 m
    //    hole between defence and midfield that the opponent can play into.
    // 2. RETREAT. Nobody may stand beyond the ball by more than his unit's
    //    out-ball allowance. That allowance is large when the ball is deep in
    //    our own third — the front men are then the out-ball and stand near
    //    halfway — and shrinks to nothing as the ball climbs, so when we lose
    //    it high up the pitch the whole side gets goal-side of it.
    //
    // Order is the whole point. This block used to be a floor alone, with the
    // ball-relative cap applied *before* it, so the floor always won. Measured
    // with the ball in our own third: 9.3 of 10 outfielders were standing
    // ahead of it — the side defended with its two centre-backs behind the
    // ball and nobody else — and 6 % of players stranded upfield got goal-side
    // within four seconds of a turnover.
    const attacker = ['CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'LST', 'RST'].includes(pos)
    const midfielder = ['DM', 'LDM', 'RDM', 'LCM', 'CM', 'RCM'].includes(pos)
    // Units hold their distance from the back line — that is what keeps the
    // block compact — but never so far that the floor pushes a man ahead of
    // the ball by more than the out-ball allowance. A floor in absolute x can
    // only ever push players forward, so an unqualified one is an instruction
    // to stand up the pitch: with the ball in our own third the old floors put
    // nine of ten outfielders ahead of it.
    const outBallAllowance = 20
    const unitFloor = Math.min(
      attacker ? defensiveLine + 31 : midfielder ? defensiveLine + 15 : defensiveLine,
      ballLocal.x + outBallAllowance
    )
    x = Math.max(x, unitFloor)
    // A block is not a queue behind the ball: the front men are the out-ball
    // and they have to be available. Their ceiling therefore has two parents —
    // the height of the back line (a side that defends on halfway has forwards
    // on halfway) and the ball itself (nobody stands twenty metres up the pitch
    // from a ball that is being played in front of him).
    //
    // An earlier attempt set the ball ceiling to zero as the ball climbed, on
    // the theory that everyone should be goal-side of it. That is what a
    // training drill looks like, not a football match: the front line stopped
    // running beyond the last defender, offsides collapsed from 4.4 a match to
    // 0.4 and pass completion fell six points because there was nobody ahead
    // of the ball to pass to.
    //
    // A run has to have somewhere to go, though: the front men need a band
    // deep enough to time a run into. Clamping attackers to four metres of
    // depth (floor = line + 26, cap = line + 30, an earlier attempt) removed
    // the offside trap from the game — offsides fell from 4.4 a match to 1.9 —
    // because nobody could ever be beyond the last defender.
    const structuralCap = attacker ? defensiveLine + 49 : midfielder ? defensiveLine + 31 : defensiveLine + 16
    const ballCap = ballLocal.x + outBallAllowance
    const cap = Math.min(structuralCap, ballCap)
    if (x > cap) {
      x = cap
      // Tracking back is collective and it is a sprint: everyone caught ahead
      // of the ball runs to get behind it, not just the nearest man. Urgency 2
      // is the 1.78x speed multiplier with a 24 m response radius, so a side
      // that has just lost the ball visibly turns and goes.
      p.moveUrgency = Math.max(p.moveUrgency, attacker ? 2 : 1)
    }
  }

  if (inPossession && owner?.id !== p.id && state.ball.kind !== 'shot' && ballLocal.x > 60) {
    // Final-third occupation: penalty-spot striker, far-side back-post runner,
    // edge player and same-side overlap. This is what turns wide possession
    // into crosses and cutbacks instead of harmless circulation.
    if (['ST', 'LST', 'RST'].includes(pos)) {
      x = Math.max(x, 93)
      y = ballLocal.y < 34 ? 31 : 37
    } else if (['LW', 'RW', 'LM', 'RM'].includes(pos) && Math.sign(p.baseY - 34) !== Math.sign(ballLocal.y - 34)) {
      x = Math.max(x, 95)
      y = ballLocal.y < 34 ? 42 : 26
    } else if (pos === 'CAM') {
      x = Math.max(x, 86)
      y = ballLocal.y < 34 ? 29 : 39
    } else if (['LCM', 'CM', 'RCM'].includes(pos)) {
      // The eighteen-yard box belongs to the front line. An interior
      // midfielder arrives at the edge of it, not on the penalty spot.
      const boxOccupants = onPitch(state, p.teamId)
        .filter((t) => t.id !== p.id && ['ST', 'LST', 'RST', 'LW', 'RW'].includes(t.slotPosition) && t.onPitch)
        .filter((t) => worldToLocal(state, p.teamId, t.pos).x > 86).length
      const lateRun = boxOccupants < 2 && ballLocal.x > 92
      x = Math.max(x, lateRun ? 88 : 82)
      y = p.baseY < 34 ? 24 : 44
    } else if ((pos === 'LB' && ballLocal.y < 34) || (pos === 'RB' && ballLocal.y >= 34)) {
      x = Math.max(x, Math.min(94, ballLocal.x + 15 + (settings.fullbackPositioning - 50) * 0.16))
    }
  }
  if (loose) x += clamp((ballLocal.x - x) * 0.08, -3, 3)
  if (pos !== 'GK') {
    const lengthScale = 0.82 + settings.lineLength / 278
    x = ballLocal.x + (x - ballLocal.x) * lengthScale
  }
  const slotData = plan.slots.find((s) => s.slotId === p.slotId)
  const arrow = inPossession ? slotData?.attackArrow : slotData?.defenceArrow
  if (arrow?.includes('forward')) x += 7
  if (arrow === 'back') x -= 7
  if (arrow?.includes('inside')) y += (34 - y) * 0.22
  if (arrow?.includes('outside')) y += (y - 34) * 0.18
  if (p.runUntil > state.clockSeconds) {
    x = Math.min(97, Math.max(x, ballLocal.x + 18))
  }
  if (p.supportUntil > state.clockSeconds && owner) {
    const ownerLocal = worldToLocal(state, p.teamId, owner.pos)
    x = ownerLocal.x - 6
    y = ownerLocal.y + (p.baseY >= 34 ? 9 : -9)
  }
  // ---------------------------------------------------------------------
  // Role discipline. Everything above is shape; this is what each position
  // is actually for once the shape is roughly right. It is deliberately
  // attribute- and slider-driven: a slow full-back does not fly, a
  // centre-back with poor mentality gets dragged out of the line, and a
  // winger only abuses a mismatch he can actually win.
  // ---------------------------------------------------------------------
  if (pos !== 'GK') {
    const attackers = onPitch(state, p.teamId).filter((t) => t.id !== p.id && t.slotPosition !== 'GK')
    const attackerLocalX = attackers.map((t) => worldToLocal(state, p.teamId, t.pos).x)
    const isCentralMid = ['LCM', 'CM', 'RCM'].includes(pos)
    const isWide = ['LM', 'RM', 'LW', 'RW'].includes(pos)
    const isFullBack = ['LB', 'RB', 'LWB', 'RWB'].includes(pos)
    const isCentreBack = ['LCB', 'CB', 'RCB'].includes(pos)

    const ownerLocalX = worldToLocal(state, p.teamId, owner ? owner.pos : state.ball.pos).x
    if (inPossession) {
      // Central midfield does not join the front line. Unless the attackers
      // are already ahead of him, he stays behind the ball and supports the
      // build-up; he only arrives in the box late, and only when the men in
      // front of him are already there.
      if (isCentralMid) {
        const aheadOfMe = attackerLocalX.filter((lx) => lx > x + 4).length
        const supportDepth = 4 + sliders.support / 22 + (attr(p, 'mentality') - 70) * 0.06
        if (aheadOfMe < 2) x = Math.min(x, ballLocal.x + supportDepth)
        else if (ballLocal.x > 60) x = Math.min(x, Math.min(x, ballLocal.x + 6 + (attr(p, 'response') - 70) * 0.08))
      }

      // The attacking midfielder lives between their midfield and their
      // back line, on the shoulder of the front three, ready to be the link.
      if (pos === 'CAM') {
        const forwards = attackers.filter((t) => ['ST', 'LST', 'RST', 'LW', 'RW'].includes(t.slotPosition))
        const deepestForwardX = forwards.length
          ? Math.min(...forwards.map((t) => worldToLocal(state, p.teamId, t.pos).x))
          : ballLocal.x + 12
        const pocketX = clamp(Math.min(deepestForwardX - 4, ballLocal.x + 14), ballLocal.x + 4, 92)
        x = ballLocal.x > 45 ? Math.max(x, pocketX) : x
        const forwardYs = forwards.map((t) => worldToLocal(state, p.teamId, t.pos).y).sort((a, b) => a - b)
        if (forwardYs.length >= 2 && ballLocal.x > 55) {
          // Fill the gap between the two most central forwards rather than
          // standing on top of one of them.
          const mid = (forwardYs[0]! + forwardYs[forwardYs.length - 1]!) / 2
          y = 34 + (mid - 34) * -0.35
        }
      }

      // A winger with a yard on his marker and the ability to carry it goes
      // at him. That is what pace and dribbling are for, and it is how a
      // wide attack turns into a byline cross instead of a square ball.
      if (isWide && owner && ownerLocalX > 52) {
        const marker = nearestOpponent(state, p)
        const paceEdge = attr(p, 'topSpeed') - (marker ? attr(marker, 'topSpeed') : 65)
        const carrier = attr(p, 'dribbleAccuracy') + attr(p, 'dribbleSpeed') * 0.5
        if (paceEdge > 2 && carrier > 150 && Math.abs(y - 34) > 12) {
          x = Math.max(x, Math.min(99, ownerLocalX + 14 + paceEdge * 0.6))
        }
      }

      // Open grass is taken. Any attacker with clear space ahead of him - no
      // opponent within eight metres of the point he would run into - pushes
      // into it instead of holding the shape.
      const attackingRole = ['ST', 'LST', 'RST', 'LW', 'RW', 'LM', 'RM', 'CAM'].includes(pos)
      if (attackingRole && owner?.id !== p.id && ballLocal.x > 45) {
        const runTo = localToWorld(state, p.teamId, clamp(x + 8, 2, 100), y)
        const grassAhead = opponentDistance(state, runTo, p.teamId)
        if (grassAhead > 8) x = Math.min(97, x + clamp((grassAhead - 8) * 0.5, 0, 6))
      }
    } else if (possessionTeam) {
      // Full-backs pick up the opposing winger on their flank and sit
      // goal-side of him. That is the duel that decides whether a cross ever
      // arrives, and it is not something to leave to a generic nearest-man.
      // ...but not when the side is deliberately holding one synchronized
      // line for the trap: then the back four step together, and the wide
      // duel is fought from the line rather than from the winger's shoulder.
      if (isFullBack && settings.marking > 34 && !trap.trigger) {
        const flank = p.baseY < 34 ? -1 : 1
        const enemyWinger = onPitch(state, other(p.teamId))
          .filter((t) => ['LM', 'RM', 'LW', 'RW'].includes(t.slotPosition) && Math.sign(t.pos.y - H / 2) === flank)
          .sort((a, b) => dist(a.pos, ownGoal(state, p.teamId)) - dist(b.pos, ownGoal(state, p.teamId)))[0]
        if (enemyWinger) {
          const enemyLocal = worldToLocal(state, p.teamId, enemyWinger.pos)
          const own = worldToLocal(state, p.teamId, ownGoal(state, p.teamId))
          const tightness = clamp(1.9 - (settings.marking - 50) * 0.014, 1.0, 2.8)
          const goalSide = norm(sub(own, enemyLocal))
          x = enemyLocal.x + goalSide.x * tightness
          y = enemyLocal.y + goalSide.y * tightness
        }
      }

      // Centre-backs hold the line and their spacing. They step out only to
      // pick up a man who is genuinely free in front of them, and they never
      // get dragged wide enough to open the middle.
      if (isCentreBack) {
        const discipline = clamp((attr(p, 'mentality') + attr(p, 'response') - 130) / 200, -0.2, 0.4)
        const centre = 34 + (p.baseY - 34) * 0.35
        y = centre + (y - centre) * clamp(1.08 - discipline * 0.5, 0.5, 1.1)
        y = clamp(y, 34 - 15 - discipline * 4, 34 + 15 + discipline * 4)
        if (ballLocal.x > 68) x = Math.min(x, 92)
        else x = Math.min(x, ballLocal.x + 4 + discipline * 6)
      }
    }
  }
  // -----------------------------------------------------------------------
  // Position roles. The shape decides where the unit stands; the role decides
  // what this player does inside it. One pick per slot, read here directly —
  // a Holding midfielder holds without anyone touching a slider.
  // -----------------------------------------------------------------------
  if (pos !== 'GK') {
    const slotRole = plan.slots.find((s) => s.slotId === p.slotId)?.role
    const role = roleProfile(slotRole as RoleId | undefined, pos as PositionCode)
    if (inPossession && owner?.id !== p.id) {
      x += role.depth
      if (role.supportOnly) x = Math.min(x, ballLocal.x + 6)
      y = 34 + (y - 34) * role.width
      if (role.lane === 'wide') {
        // How close to the paint a wide player is allowed to live, and how
        // hard the role itself pushes him there. This is the dial a manager
        // turns to stretch a game — so both have to move with it.
        const stretch = clamp(0.74 + plan.sliders.width / 195, 0.74, 1.26)
        y = 34 + (y - 34) * stretch
        const edgeY = 19 - (clamp(plan.sliders.width, 0, 100) / 100) * 11
        y = p.baseY < 34 ? Math.min(y, edgeY) : Math.max(y, 68 - edgeY)
      }
      else if (role.lane === 'central') y = 34 + (y - 34) * 0.6
      // Box arrival belongs to the roles built for it. A holding midfielder
      // does not stand on the penalty spot because the shape drifted up.
      if (role.boxArrival < 0.5) x = Math.min(x, 86)
      else if (role.boxArrival > 1.2) x = Math.max(x, Math.min(96, ballLocal.x + 12))
    } else if (!inPossession && possessionTeam) {
      // Getting back is a duty attached to the role: a poacher jogs, a
      // wing-back and a holding midfielder recover into their own third.
      x -= role.recovery * clamp((ballLocal.x - 38) / 55, 0, 1) * 5
      y = 34 + (y - 34) * (1 + (role.width - 1) * 0.4)
    }
    // ---------------------------------------------------------------------
    // Movement learned from video. Applied last, to the target the shape, the
    // sliders and the role have already produced — so it is the video's
    // geometry rather than a tug of war with the tactic sheet. Absent a model,
    // none of this runs and the engine behaves exactly as before.
    // ---------------------------------------------------------------------
    if (state.config.motion) {
      const learned = state.config.motion.lines[lineOfPosition(pos as PositionCode) ?? 'midfield']
      if (learned) {
        if (inPossession && owner?.id !== p.id) x += clamp(learned.depthM ?? 0, -12, 12)
        const widthScale = clamp(learned.widthScale ?? 1, 0.6, 1.6)
        if (widthScale !== 1) y = clamp(34 + (y - 34) * widthScale, 2, 66)
      }
    }
    // Support: how tightly the side squeezes around the ball to give the
    // carrier options. Low leaves everyone on their own patch of grass, high
    // brings the whole unit in toward the ball.
    if (inPossession && owner?.id !== p.id && Math.abs(ballLocal.y - 34) > 4) {
      const squeeze = clamp(plan.sliders.support / 180, 0, 0.5)
      y += (ballLocal.y - y) * squeeze
      if (['DM', 'LDM', 'RDM', 'LCM', 'CM', 'RCM', 'CAM'].includes(pos)) {
        x += (ballLocal.x - x) * clamp(plan.sliders.support / 320, 0, 0.28)
      }
    }
  }
  if (inPossession) {
    // Phase caps stop movement arrows and generic forward bonuses from
    // turning an overlap into a goal-line target or disconnecting the
    // front line by 50m during first-phase build-up.
    if (ballLocal.x < 42) {
      if (['LB', 'RB', 'LWB', 'RWB'].includes(pos)) x = Math.min(x, ballLocal.x + 20)
      else if (['LM', 'RM', 'LW', 'RW'].includes(pos)) x = Math.min(x, ballLocal.x + 36)
      else if (pos === 'CAM') x = Math.min(x, ballLocal.x + 28)
      else if (['ST', 'LST', 'RST'].includes(pos)) x = Math.min(x, ballLocal.x + 40)
    }
    if (['LB', 'RB', 'LWB', 'RWB'].includes(pos)) x = Math.min(x, 94)
    else if (['DM', 'LDM', 'RDM'].includes(pos)) x = Math.min(x, 78)
    else if (['LCM', 'CM', 'RCM'].includes(pos)) x = Math.min(x, 84)
    if (['LB', 'RB', 'LWB', 'RWB', 'LCM', 'CM', 'RCM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'LST', 'RST'].includes(pos)) {
      const secondLastLocalX = worldToLocal(state, p.teamId, { x: secondLastOpponentX(state, p.teamId), y: 34 }).x
      // In the final third, attackers run to where the retreating line will
      // be when the cross/pass is released. Capping strictly to this exact
      // frame's second-last defender dragged the whole front line back to
      // the BallState during transitions and emptied the penalty area.
      const anticipatedLine = ballLocal.x > 55 ? clamp(Math.min(ballLocal.x + 10, secondLastLocalX + 5), 65, 97) : secondLastLocalX + 1.4
      const onsideLimit = Math.max(ballLocal.x, secondLastLocalX + 1.4, anticipatedLine)
      x = Math.min(x, onsideLimit)
    }
  }
  // COLLECTIVE RETREAT — the last word on shape, deliberately.
  //
  // Losing the ball is an event, not a steady state: the side drops as a unit
  // and then re-forms. A block anchored only to where the ball *is* cannot
  // express that, because the ball has not moved in the instant possession
  // changes — the back line stepped up (it follows the ball) while the front
  // line dropped, and the two cancelled. Measured before this: **1.2 m of
  // retreat three seconds after a turnover**, against the 15-20 m a sprinting
  // player covers in that time.
  //
  // Every outfield player takes the same shift, which is what makes it read as
  // one team turning and running rather than a line shuffling.
  if (!inPossession && pos !== 'GK' && state.possessionTeam && state.possessionTeam !== p.teamId) {
    const sinceGain = state.halfElapsed - (state.possessionGainedAt ?? -99)
    const fresh = clamp(1 - sinceGain / 4.5, 0, 1)
    // ONLY the men who are upfield drop, and the line never does.
    //
    // A first version shifted every outfield player back by up to 13 m. Because
    // possession changes often enough that the shift was active most of the
    // time, that was not a retreat at all — it was a permanently ten-metre
    // deeper defensive line, and it handed the pitch to the counter: offsides
    // fell from 4.46 a match to 1.86 because no attacker could ever be beyond a
    // line that was running away from him, and pass completion fell with it.
    //
    // Tracking back is what the men in front of the ball do. The back line's job
    // is to hold its height, which is exactly what makes it a line.
    const behindTheBall = ballLocal.x + 2
    if (fresh > 0 && x > behindTheBall) {
      const gap = x - behindTheBall
      x = Math.max(behindTheBall, x - fresh * RETREAT_DEPTH_M)
      // A man fifteen metres up the pitch with the ball gone is not jogging
      // back, he is recovering. Urgency 3 is the 2.15x band with a 30 m
      // response radius; urgency 2 was leaving recovery runs at about 3 m/s,
      // which reads as strolling on screen.
      p.moveUrgency = Math.max(p.moveUrgency, gap > 12 ? 3 : fresh > 0.35 ? 2 : 1)
    }
  }
  return localToWorld(state, p.teamId, clamp(x, 2, 102), clamp(y, 2, 66))
}

function nearestOpponent(state: MatchState, p: RuntimePlayer): RuntimePlayer | undefined {
  return onPitch(state, other(p.teamId)).sort((a, b) => dist(a.pos, p.pos) - dist(b.pos, p.pos))[0]
}
function opponentDistance(state: MatchState, pos: Vec, teamId: TeamId): number {
  return Math.min(...onPitch(state, other(teamId)).map((p) => dist(p.pos, pos)), 99)
}
function laneBlocked(state: MatchState, from: Vec, to: Vec, teamId: TeamId): number {
  let blocked = 0
  const line = sub(to, from)
  const length = Math.max(0.1, len(line))
  for (const opp of onPitch(state, other(teamId))) {
    const t = clamp(((opp.pos.x - from.x) * line.x + (opp.pos.y - from.y) * line.y) / (length * length), 0, 1)
    const closest = { x: from.x + line.x * t, y: from.y + line.y * t }
    const d = dist(opp.pos, closest)
    if (d < 2.4 && t > 0.08 && t < 0.92) blocked += (2.4 - d) * 4
  }
  return blocked
}
function secondLastOpponentX(state: MatchState, attackingTeam: TeamId): number {
  const dir = attackDir(state, attackingTeam)
  const xs = onPitch(state, other(attackingTeam)).map((p) => p.pos.x).sort((a, b) => dir === 1 ? b - a : a - b)
  return xs[1] ?? xs[0] ?? (dir === 1 ? W : 0)
}
interface BreakawayContext {
  inBehind: boolean
  local: Vec
  lineX: number
  opponentsAhead: number
  outfieldAhead: number
  teammatesAhead: number
  supportRunners: RuntimePlayer[]
  nearestChaserDistance: number
  goalkeeper?: RuntimePlayer
}

function breakawayContext(state: MatchState, p: RuntimePlayer): BreakawayContext {
  const local = worldToLocal(state, p.teamId, p.pos)
  const lineX = worldToLocal(state, p.teamId, { x: secondLastOpponentX(state, p.teamId), y: H / 2 }).x
  const opponents = onPitch(state, other(p.teamId)).map((opp) => ({
    player: opp,
    local: worldToLocal(state, p.teamId, opp.pos),
    distance: dist(opp.pos, p.pos),
  }))
  const opponentsAhead = opponents.filter((o) => o.local.x > local.x + 0.5).length
  const outfieldAhead = opponents.filter((o) => o.player.slotPosition !== 'GK' && o.local.x > local.x + 0.5).length
  const chasers = opponents
    .filter((o) => o.player.slotPosition !== 'GK' && o.local.x <= local.x + 1)
    .sort((a, b) => a.distance - b.distance)
  const supportRunners = onPitch(state, p.teamId)
    .filter((t) => t.id !== p.id && t.slotPosition !== 'GK')
    .map((t) => ({ player: t, local: worldToLocal(state, p.teamId, t.pos), distance: dist(t.pos, p.pos) }))
    .filter((t) => t.local.x > local.x - 8 && t.distance < 38)
    .sort((a, b) => (b.local.x - a.local.x) || (a.distance - b.distance))
    .slice(0, 3)
    .map((t) => t.player)
  const teammatesAhead = supportRunners.filter((t) => worldToLocal(state, p.teamId, t.pos).x > local.x + 2).length
  const pastLine = local.x > lineX + 1
  return {
    // A break is being beyond the last line with the goal in front of you,
    // not simply having every opponent behind you because they dropped into
    // their own box. The old test counted that as a breakaway, so a full-back
    // carrying the ball at 20 metres was treated like a striker clean through.
    inBehind: local.x > 46 && pastLine && outfieldAhead <= 1 && dist(p.pos, goalTarget(state, p.teamId)) < 34,
    local,
    lineX,
    opponentsAhead,
    outfieldAhead,
    teammatesAhead,
    supportRunners,
    nearestChaserDistance: chasers[0]?.distance ?? 99,
    goalkeeper: onPitch(state, other(p.teamId)).find((opp) => opp.slotPosition === 'GK'),
  }
}

function isOffsideAtPass(state: MatchState, receiver: RuntimePlayer, passer: RuntimePlayer): boolean {
  if (receiver.teamId !== passer.teamId) return false
  const dir = attackDir(state, receiver.teamId)
  const line = secondLastOpponentX(state, receiver.teamId)
  if (dir === 1) return receiver.pos.x > 52.5 && receiver.pos.x > line && receiver.pos.x > state.ball.pos.x
  return receiver.pos.x < 52.5 && receiver.pos.x < line && receiver.pos.x < state.ball.pos.x
}
/**
 * How far beyond the last defender a man is standing, in metres, right now.
 *
 * Zero when he is legal. This exists so the two places that choose a pass can
 * ask the same question the referee asks, in the same units: the number is the
 * margin by which the pass would be illegal, not a score to be traded off
 * against how attractive the receiver looks.
 */
export function offsideOvershoot(state: MatchState, receiver: RuntimePlayer, passer: RuntimePlayer): number {
  return overshootAgainstLine(state, receiver, passer, secondLastOpponentX(state, receiver.teamId))
}

/**
 * The same distance, measured against the line the *passer* believes he is
 * looking at. A carrier is not a linesman: he plays what he has registered, and
 * a defence that has just stepped up is a metre or two behind the picture in his
 * head. The flag is judged on `offsideOvershoot`; the pass is chosen on this.
 */
function perceivedOvershoot(state: MatchState, receiver: RuntimePlayer, passer: RuntimePlayer): number {
  const seen = state.lineSeenX?.[receiver.teamId]
  return overshootAgainstLine(state, receiver, passer, Number.isFinite(seen) ? seen : secondLastOpponentX(state, receiver.teamId))
}

function overshootAgainstLine(state: MatchState, receiver: RuntimePlayer, passer: RuntimePlayer, line: number): number {
  if (receiver.teamId !== passer.teamId) return 0
  if (!isOffsideAtPass(state, receiver, passer)) return 0
  const receiverLocal = worldToLocal(state, receiver.teamId, receiver.pos).x
  const lineLocal = worldToLocal(state, receiver.teamId, { x: line, y: 34 }).x
  const ballLocal = worldToLocal(state, receiver.teamId, state.ball.pos).x
  return Math.max(0, Math.min(receiverLocal - lineLocal, receiverLocal - ballLocal))
}

/**
 * Real offsides are measured in inches: a runner goes a stride too early, not
 * six metres too early. Anything beyond this is not a mistimed run, it is a man
 * standing in an illegal position, and no carrier picks that pass on purpose.
 */
/**
 * How far a side drops, as one unit, in the moment after losing the ball. The
 * drop decays over ~4.5 s as the block re-forms. See the collective-retreat
 * block at the end of `anchorFor`.
 */
const RETREAT_DEPTH_M = 13
const OFFSIDE_MARGIN_M = 1.2

/**
 * How long it takes a side to register that the line has moved, in seconds.
 *
 * Half a second is the whole mechanism: a defence that steps up as one is two
 * metres further forward than the attackers think it is, and that gap is where
 * offsides come from. Turn this to zero and the line becomes a laser fence
 * nobody can ever be beyond; make it long and the side plays permanently
 * offside. See docs/stepping-line.md.
 */
const LINE_REACTION_S = 0.5

export function offsideLineX(state: MatchState, attackingTeam: TeamId): number {
  return secondLastOpponentX(state, attackingTeam)
}

function setOwner(state: MatchState, p: RuntimePlayer, completedPass = false, touchDistance?: number, secure = false) {
  const previous = byId(state, state.ball.lastTouchPlayerId)
  const incomingSpeed = len(state.ball.vel)
  const incomingHeight = state.ball.z
  if (secure) {
    p.touchTimer = 0
    p.touchDistance = 0
    p.touchDirection = { ...p.facing }
  } else {
    const derivedTouch = clamp(
      0.24 + incomingSpeed * 0.026 + incomingHeight * 0.18 + Math.max(0, 88 - attr(p, 'technique')) * 0.007,
      0.16,
      1.8,
    )
    p.touchDistance = clamp(touchDistance ?? derivedTouch, 0, 3.2)
    p.touchDirection = len(p.vel) > 0.35 ? norm(p.vel) : { ...p.facing }
    p.touchTimer = clamp(0.05 + p.touchDistance * 0.09 + incomingSpeed * 0.003, 0.05, 0.34)
  }
  // Which side of the body he takes it on. A ball arriving from his left
  // sits on his left, and that is the foot he has to strike it with unless
  // he has the room to roll it across.
  {
    const perp = { x: -p.facing.y, y: p.facing.x }
    const lateral = (state.ball.pos.x - p.pos.x) * perp.x + (state.ball.pos.y - p.pos.y) * perp.y
    const strong = p.base.foot === 'L' ? -1 : 1
    p.ballSide = secure || Math.abs(lateral) < 0.22 ? strong : Math.sign(lateral)
  }
  state.ball.ownerId = p.id
  state.ball.intendedReceiverId = null
  state.ball.kind = 'dribble'
  state.ball.vel = { x: 0, y: 0 }
  state.ball.z = 0
  state.ball.vz = 0
  state.ball.aerialResolved = false
  state.ball.shotOrigin = null
  state.ball.shotPower = 0
  state.ball.shotDistance = 0
  state.ball.age = 0
  state.ball.saveAttempted = false
  state.ball.interceptionAttempts = []
  if (!state.config.humanTeams.includes(p.teamId) || state.controlled[p.teamId] !== p.id) {
    const oneTouch = p.base.stars.includes('1-Touch Pass') ? 0.55 : 1
    p.decisionTimer = Math.max(p.decisionTimer, clamp(0.78 - attr(p, 'response') / 230, 0.34, 0.62) * oneTouch)
  }
  p.touches += 1
  p.touchPoints.push(worldToLocal(state, p.teamId, p.pos))
  if (p.touchPoints.length > 500) p.touchPoints.splice(0, 100)
  if (completedPass && previous && previous.teamId === p.teamId) {
    previous.completedPasses += 1
    state.stats[p.teamId].completedPasses += 1
  }
  state.ball.lastTouchTeamId = p.teamId
  state.ball.lastTouchPlayerId = p.id
  if (state.config.humanTeams.includes(p.teamId)) state.controlled[p.teamId] = p.id
}

function looseBall(state: MatchState, vel: Vec, kind: BallKind = 'loose', z = 0, vz = 0) {
  state.ball.ownerId = null
  state.ball.vel = vel
  state.ball.kind = kind
  state.ball.lofted = kind === 'cross' || z > 0.5
  state.ball.z = z
  state.ball.vz = vz
  state.ball.aerialResolved = false
  if (kind !== 'shot') {
    state.ball.shotOrigin = null
    state.ball.shotPower = 0
    state.ball.shotDistance = 0
  }
  state.ball.age = 0
  state.ball.saveAttempted = false
  state.ball.interceptionAttempts = []
  if (kind !== 'pass') state.ball.driven = false
}

function executePass(state: MatchState, passer: RuntimePlayer, receiver: RuntimePlayer, through = false, lofted = false) {
  const params = difficultyParams(state, passer.teamId)
  const settings = gameplayFor(state, passer.teamId)
  const isHuman = state.config.humanTeams.includes(passer.teamId) && state.controlled[passer.teamId] === passer.id
  const errorScale = (isHuman ? 0.85 : params.error) * sliderErrorScale(settings.passError)
  const targetNow = { ...receiver.pos }
  const distanceToReceiver = dist(passer.pos, targetNow)
  const travel = clamp(distanceToReceiver / 16, 0.25, 1.75)
  let target = add(add(targetNow, mul(receiver.vel, travel * (through ? 0.85 : 0.55))), mul(sub(receiver.target, targetNow), through ? 0.08 : 0.16))
  if (through) target = add(target, mul(norm(sub(goalTarget(state, passer.teamId), receiver.pos)), 4.5))
  const dir = norm(sub(target, passer.pos))
  const perp = { x: -dir.y, y: dir.x }
  const long = distanceToReceiver > 24 || lofted
  const accuracy = attr(passer, long ? 'longPassAccuracy' : 'shortPassAccuracy')
  const pressure = clamp(7 - (nearestOpponent(state, passer) ? dist(nearestOpponent(state, passer)!.pos, passer.pos) : 7), 0, 7)
  const strike = strikeFoot(passer, state.ball.pos)
  // Consistency (PES 1-8) is repeatability: the same pass, played twice, lands
  // in the same place. It scales execution error, not ambition.
  const consistencyError = clamp(1 + (5 - attr(passer, 'consistency')) * 0.045, 0.8, 1.2)
  const error = range(state, -1, 1) * Math.max(0.2, (100 - accuracy) * 0.055 + pressure * 0.16) * errorScale * strike.noiseScale * consistencyError
  target = add(target, mul(perp, error))
  const offside = state.restart?.type === 'throw' || state.restart?.type === 'corner' || state.restart?.type === 'goalkick'
    ? false
    : isOffsideAtPass(state, receiver, passer)
  const speed = clamp(
    (9.5 + distanceToReceiver * 0.33 + attr(passer, long ? 'longPassSpeed' : 'shortPassSpeed') * 0.055) * 0.9 * sliderScale(settings.passSpeed),
    9.5,
    25,
  )
  const flight = Math.max(0.3, distanceToReceiver / speed)
  state.ball.intendedReceiverId = receiver.id
  state.ball.passTeamId = passer.teamId
  state.ball.driven = false
  state.ball.offsideReceiverId = offside ? receiver.id : null
  state.ball.lastTouchTeamId = passer.teamId
  state.ball.lastTouchPlayerId = passer.id
  passer.passes += 1
  state.stats[passer.teamId].passes += 1
  looseBall(state, mul(norm(sub(target, state.ball.pos)), speed), 'pass', lofted ? 0.2 : 0, lofted ? (0.5 * 9.8 * flight) : 0)
  state.ball.lofted = lofted
  if (state.config.humanTeams.includes(passer.teamId)) state.controlled[passer.teamId] = receiver.id
}

/**
 * A low driven pass. PES's double-tap pass: flat, quick and along the floor,
 * played into feet between the lines or driven across the face of the box.
 * It beats a compact block because there is no flight time to read, and it
 * costs accuracy over distance — the same trade a real player makes.
 */
export function executeDrivenPass(state: MatchState, passer: RuntimePlayer, receiver: RuntimePlayer, power = 0.65) {
  const settings = gameplayFor(state, passer.teamId)
  const params = difficultyParams(state, passer.teamId)
  const isHuman = state.config.humanTeams.includes(passer.teamId) && state.controlled[passer.teamId] === passer.id
  const errorScale = (isHuman ? 0.8 : params.error) * sliderErrorScale(settings.passError)
  const distance = dist(passer.pos, receiver.pos)
  const lead = clamp(distance / 30, 0.12, 0.7) * (1 + power * 0.5)
  let target = add(receiver.pos, mul(receiver.vel, lead))
  const dir = norm(sub(target, passer.pos))
  const perp = { x: -dir.y, y: dir.x }
  // Long accuracy drives it, short accuracy and technique refine it.
  const accuracy = attr(passer, 'longPassAccuracy') * 0.5
    + attr(passer, 'shortPassAccuracy') * 0.3
    + attr(passer, 'technique') * 0.2
  const pressure = nearestOpponent(state, passer)
    ? clamp(6 - dist(nearestOpponent(state, passer)!.pos, passer.pos), 0, 6)
    : 0
  // Flat and hard is harder to keep on line than a rolled pass, so the error
  // grows with the drive power as well as the distance.
  const strike = strikeFoot(passer, state.ball.pos)
  const error = range(state, -1, 1) * Math.max(
    0.18,
    (100 - accuracy) * 0.05 + pressure * 0.15 + distance * 0.012 + power * 0.5,
  ) * errorScale * strike.noiseScale
  target = add(target, mul(perp, error))
  const offside = isOffsideAtPass(state, receiver, passer)
  const speed = clamp(
    (14 + power * 9 + distance * 0.16 + attr(passer, 'longPassSpeed') * 0.05) * 0.94 * sliderScale(settings.passSpeed),
    13,
    30,
  )
  state.ball.intendedReceiverId = receiver.id
  state.ball.passTeamId = passer.teamId
  state.ball.offsideReceiverId = offside ? receiver.id : null
  state.ball.lastTouchTeamId = passer.teamId
  state.ball.lastTouchPlayerId = passer.id
  state.ball.driven = true
  passer.passes += 1
  state.stats[passer.teamId].passes += 1
  state.stats[passer.teamId].drivenPasses = (state.stats[passer.teamId].drivenPasses ?? 0) + 1
  looseBall(state, mul(norm(sub(target, state.ball.pos)), speed), 'pass', 0.06, 0)
  if (state.config.humanTeams.includes(passer.teamId)) state.controlled[passer.teamId] = receiver.id
}

/** Where a driven ball can go: into feet between the lines, or across the box. */
function drivenPassOption(state: MatchState, carrier: RuntimePlayer): { receiver: RuntimePlayer; score: number } | null {
  const local = worldToLocal(state, carrier.teamId, carrier.pos)
  const candidates = onPitch(state, carrier.teamId)
    .filter((t) => t.id !== carrier.id && t.slotPosition !== 'GK')
    // The driven ball exists to find a man between the lines. Space beyond the
    // last defender looks like the same picture in the numbers — forward, open,
    // uncrowded — but it is the one place the ball cannot be played: 83% of this
    // engine's offsides were this branch finding an illegal man and driving it
    // into his feet.
    .filter((t) => perceivedOvershoot(state, t, carrier) <= OFFSIDE_MARGIN_M)
    .map((t) => {
      const target = worldToLocal(state, carrier.teamId, t.pos)
      const distance = dist(carrier.pos, t.pos)
      const lane = laneBlocked(state, carrier.pos, t.pos, carrier.teamId)
      const space = nearestOpponent(state, t) ? dist(nearestOpponent(state, t)!.pos, t.pos) : 20
      const forward = target.x - local.x
      const betweenLines = target.x > 58 && target.x < 92 && space > 4
      const score = (betweenLines ? 1.1 : 0)
        + clamp(space / 12, 0, 0.9)
        + clamp(forward / 30, -0.3, 0.8)
        + (distance > 11 && distance < 34 ? 0.5 : -0.5)
        + (lane < 2 ? 0.7 : lane > 6 ? -1 : 0)
      return { receiver: t, score, lane, distance }
    })
    .filter((c) => c.distance > 10 && c.distance < 36 && c.lane < 4.5)
    .sort((a, b) => b.score - a.score)
  return candidates[0] ?? null
}

/**
 * A cross is aimed at a man, not at a rectangle. The routine decides the
 * patch of box he is attacking (near post, back post, edge); the target man
 * inside that patch decides the exact ball, with his run led and the
 * crosser's long passing, technique and weak foot deciding how close the
 * ball lands to him. Real crosses miss their man by a couple of metres, not
 * by the width of the box.
 */
function crossTargetMan(state: MatchState, crosser: RuntimePlayer, target: Vec): RuntimePlayer | undefined {
  return onPitch(state, crosser.teamId)
    .filter((p) => p.id !== crosser.id && p.slotPosition !== 'GK')
    .sort((a, b) => {
      const score = (p: RuntimePlayer) => {
        const near = dist(p.pos, target)
        const aerial = (attr(p, 'header') + attr(p, 'jump') + attr(p, 'attack')) / 3
        return -near - (100 - aerial) * 0.06
      }
      return score(b) - score(a)
    })[0]
}

function executeCross(state: MatchState, crosser: RuntimePlayer, power = 0.65, targetOverride?: Vec) {
  const settings = gameplayFor(state, crosser.teamId)
  const goal = goalTarget(state, crosser.teamId)
  const dir = attackDir(state, crosser.teamId)
  const routine = planFor(state, crosser.teamId).setPieces.attackingCorner
  const targetX = goal.x - dir * (routine.includes('Edge') ? 20 : routine.includes('Near') ? 7 : routine.includes('Back') ? 5 : 8.5)
  const targetY = routine.includes('Edge')
    ? 34
    : routine.includes('Near') ? (crosser.pos.y < 34 ? 27 : 41) : routine.includes('Back') ? (crosser.pos.y < 34 ? 43 : 25) : 34
  const zone = targetOverride ?? { x: targetX, y: targetY }
  const receiver = crossTargetMan(state, crosser, zone)
  if (!receiver) return
  const strike = strikeFoot(crosser, state.ball.pos)
  const crosserSkill = attr(crosser, 'longPassAccuracy') * 0.5 + attr(crosser, 'curling') * 0.3 + attr(crosser, 'technique') * 0.2
  const pressure = nearestOpponent(state, crosser)
    ? clamp(5 - dist(nearestOpponent(state, crosser)!.pos, crosser.pos), 0, 5)
    : 0
  // Land it on him: 0.7 m for an unpressured elite crosser, about 3 m for a
  // hurried one, scaled by the Human/CPU pass-error sliders.
  const crossOverpower = clamp((power - 0.82) / 0.18, 0, 1)
  const missRadius = (0.55 + (100 - crosserSkill) * 0.055 + pressure * 0.13 + power * 0.6 + crossOverpower * 2.4)
    * sliderErrorScale(settings.passError) * strike.noiseScale
  const lead = mul(receiver.vel, clamp(dist(crosser.pos, receiver.pos) / 34, 0.15, 0.55))
  const aim = add(add(receiver.pos, lead), mul(sub(zone, receiver.pos), 0.22))
  // A cross is a delivery into the box, so its landing zone is clamped into
  // the box: no more balls sailing out to the corner flag or over the far
  // touchline because the nearest runner was standing on the chalk.
  const target = {
    x: clamp(aim.x, goal.x - dir * 20, goal.x - dir * 2.5),
    y: clamp(aim.y + range(state, -1, 1) * missRadius, 14, 54),
  }
  const distanceToTarget = dist(crosser.pos, target)
  // A delivery has to come DOWN onto the runners, not fly through the crowd.
  // Deriving the flight time from a flat horizontal speed gives a 27-metre
  // corner an arc that peaks at about 2.3 m and is already at heading height
  // eight metres short of the near post — so the first man anywhere near the
  // ball wins it, and he is a defender. Set the apex instead and let gravity
  // decide the flight: the ball stays above the block until it reaches the
  // players it was aimed at. Power flattens the arc, as it should.
  const apex = clamp(2.4 + distanceToTarget * 0.11 + (0.55 - power) * 2.4, 2.6, 7.5)
  const flight = Math.max(0.55, 2 * Math.sqrt((2 * apex) / 9.8))
  const speed = (distanceToTarget / flight) * sliderScale(settings.passSpeed)
  state.ball.intendedReceiverId = receiver.id
  state.ball.passTeamId = crosser.teamId
  state.ball.offsideReceiverId = null
  state.ball.lastTouchTeamId = crosser.teamId
  state.ball.lastTouchPlayerId = crosser.id
  crosser.passes += 1
  state.stats[crosser.teamId].passes += 1
  looseBall(state, mul(norm(sub(target, state.ball.pos)), speed), 'cross', 0.2, Math.sqrt(2 * 9.8 * apex))
}

/** 25.2 km/h: the usual sprint band in tracking data. */
const SPRINT_MPS = 7
/** 19.8 km/h: high-intensity running, the band below a sprint. */
const HIGH_INTENSITY_MPS = 5.5

const GOAL_POST_LOW = H / 2 - 3.66
const GOAL_POST_HIGH = H / 2 + 3.66

export interface ShotGeometry {
  /** Metres across the pitch to the goal line. */
  dx: number
  /** Metres off the centre line. */
  lateral: number
  distance: number
  /** Angular width of the goal mouth as seen from the shooter (radians). */
  span: number
  /** 0 from the middle of the pitch, 1 from the byline. */
  tightness: number
  /** Where a shooter aims: inside the post away from the keeper. */
  aimY: number
}

/**
 * What the shooter can actually see. A goal is 7.32 m wide, so from the
 * middle of the box it subtends a wide mouth and from the byline it is a
 * sliver — the same absolute aiming error is a miss from one and a goal from
 * the other. The aim point is the open side of the keeper, not the centre of
 * the goal, which is what made every angled shot a shot straight at him.
 */
export function shotGeometry(state: MatchState, shooter: RuntimePlayer, keeperY?: number): ShotGeometry {
  const goal = goalTarget(state, shooter.teamId)
  const dx = Math.max(0.8, Math.abs(goal.x - shooter.pos.x))
  const lateral = Math.abs(shooter.pos.y - H / 2)
  const distance = Math.hypot(dx, lateral)
  const span = Math.abs(Math.atan2(GOAL_POST_LOW - shooter.pos.y, dx) - Math.atan2(GOAL_POST_HIGH - shooter.pos.y, dx))
  const tightness = clamp((0.3 - span) / 0.3, 0, 1)
  // Which side of goal is open? The keeper stands somewhere on the line; the
  // shooter takes the bigger half of what is left.
  const keeper = keeperY ?? onPitch(state, other(shooter.teamId)).find((p) => p.slotPosition === 'GK')?.pos.y ?? H / 2
  const guard = 1.05 + tightness * 0.9
  const lowGap = Math.max(0, keeper - guard - GOAL_POST_LOW)
  const highGap = Math.max(0, GOAL_POST_HIGH - (keeper + guard))
  const placement = clamp(attr(shooter, 'shotAccuracy') / 100 * 0.55 + attr(shooter, 'shotTechnique') / 100 * 0.45, 0, 1)
  const inset = 0.55 + placement * 0.35
  // From a tight angle the far post is a sliver behind the near one, so the
  // shot goes to the near post the keeper is covering — low percentage, as it
  // should be — instead of being handed an open far corner.
  const nearPostSide = shooter.pos.y < H / 2 ? 'low' : 'high'
  const preferHigh = tightness > 0.42 ? nearPostSide === 'high' : highGap >= lowGap
  const aimY = preferHigh
    ? keeper + guard + highGap * inset
    : keeper - guard - lowGap * inset
  return { dx, lateral, distance, span, tightness, aimY: clamp(aimY, GOAL_POST_LOW - 2, GOAL_POST_HIGH + 2) }
}

function shotXg(state: MatchState, shooter: RuntimePlayer): number {
  const goal = goalTarget(state, shooter.teamId)
  const d = dist(shooter.pos, goal)
  const angle = Math.abs(Math.atan2(shooter.pos.y - 34, Math.max(1, Math.abs(goal.x - shooter.pos.x))))
  const angleFactor = clamp(1 - angle / 1.65, 0.08, 1)
  // The previous curve still valued a central 25m attempt above 0.20 xG.
  // Distance now bites much sooner: roughly 0.26 at 12m, 0.12 at 20m and
  // 0.06 at 28m before the angle adjustment.
  return clamp(0.82 * Math.exp(-d / 9.6) * angleFactor + (d < 7 ? 0.08 : 0) + (state.ball.z > 1 ? -0.02 : 0.005), 0.01, 0.86)
}

function executeShot(state: MatchState, shooter: RuntimePlayer, power = 0.65, aimY?: number) {
  const goal = goalTarget(state, shooter.teamId)
  const params = difficultyParams(state, shooter.teamId)
  const settings = gameplayFor(state, shooter.teamId)
  const human = state.config.humanTeams.includes(shooter.teamId) && state.controlled[shooter.teamId] === shooter.id
  const errorScale = (human ? 0.9 : params.shotError) * sliderErrorScale(settings.shotError)
  const geometry = shotGeometry(state, shooter)
  const targetY = aimY ?? geometry.aimY + range(state, -1, 1) * 0.4
  const shotDistance = dist(shooter.pos, goal)
  const outsideBox = clamp((shotDistance - 16.5) / 13, 0, 1.15)
  const middleShooting = shooter.base.stars.includes('Middle Shooting')
  const nearestDefender = nearestOpponent(state, shooter)
  const pressureError = nearestDefender ? clamp(4.5 - dist(nearestDefender.pos, shooter.pos), 0, 4.5) * 0.12 : 0
  const movementError = len(shooter.vel) * 0.045
  const firstTimeError = state.ball.kind !== 'dribble' ? len(state.ball.vel) * 0.012 + state.ball.z * 0.16 : 0
  // A header is not a shot: it is met with the forehead and aimed with the
  // neck. The finish is judged on Header, not Shot Accuracy, and it is never
  // as clean as a strike off the laces.
  const headed = state.ball.z > 1.0 && state.ball.kind !== 'dribble'
  const finishAccuracy = headed
    ? attr(shooter, 'header') * 0.75 + attr(shooter, 'attack') * 0.25
    : attr(shooter, 'shotAccuracy')
  const baseError = Math.max(
    0.16,
    (100 - finishAccuracy) * 0.034 * (headed ? 1.15 : 1)
      + Math.max(0, 92 - attr(shooter, 'shotTechnique')) * 0.006
      + pressureError
      + movementError
      + firstTimeError,
  )
  const techniqueFactor = clamp(1.18 - attr(shooter, 'shotTechnique') / 180, 0.6, 1.05) * (middleShooting ? 0.8 : 1)
  // Shooting dispersion is angular: even an elite striker cannot keep the
  // same absolute error cone from 30m as from 10m. This inherent distance
  // term is separate from the attribute/pressure/body-shape error above.
  const inherentDistanceError = (
    0.3 + shotDistance * 0.105 + outsideBox * (1.85 + shotDistance * 0.095 + power * 1.5)
  ) * techniqueFactor
  // From a tight angle the mouth is a sliver, so the same dispersion is a far
  // bigger share of it. This is what stops a byline toe-poke being as likely
  // as a penalty-spot finish.
  const visibleGoalFactor = 1 + geometry.tightness * 1.2
  const strike = strikeFoot(shooter, state.ball.pos)
  // Real shooting is far more accurate than it is dangerous: roughly three
  // in four strikes are on target, and it is the keeper's reach, reactions
  // and the pace/height of the ball that decide the rest. The dispersion
  // here is therefore deliberately tight; what keeps the score down is the
  // save model, not spraying shots into the stands.
  // A loaded shot is the point of the charge bar: the extra pace is real, but
  // past about four-fifths of the bar the strike starts to spray and climb,
  // which is exactly the trade a player makes when he leans back and hits it.
  const overpower = clamp((power - 0.82) / 0.18, 0, 1)
  const accuracyHalfRange = (inherentDistanceError + baseError * (0.55 + shotDistance / 55))
    * visibleGoalFactor * strike.noiseScale * clamp(1 + (5 - attr(shooter, 'consistency')) * 0.045, 0.8, 1.2) * 0.2 * (1 + overpower * 0.95)
  const accuracyError = range(state, -1, 1) * accuracyHalfRange * errorScale
  // A miss is an angular miss — the body shape and the strike, not a fixed
  // number of metres — so the error is applied to the shot angle and resolved
  // at the goal line. From the middle of the box that is a couple of metres;
  // from the byline the same mis-strike sends it metres wide, which is why
  // those shots almost never go in.
  const aimDx = goal.x - shooter.pos.x
  const aimAngle = Math.atan2(targetY - shooter.pos.y, aimDx)
  const angularError = Math.atan2(accuracyError, Math.max(3.5, Math.abs(aimDx) + geometry.lateral * 0.35))
  const shotAngle = aimAngle + angularError
  const resolvedY = shooter.pos.y + Math.tan(shotAngle) * aimDx
  const target = { x: goal.x, y: clamp(resolvedY, 18, 50) }
  const speed = clamp(
    (15.5 + power * 11 + attr(shooter, 'shotPower') * 0.026) * 0.92 * sliderScale(settings.shotSpeed)
      * strike.powerScale,
    15,
    32,
  )
  const heightHalfRange = (0.12 + shotDistance * 0.05 + outsideBox * (0.85 + power * 1.25)) * techniqueFactor + baseError * 0.24
    + overpower * 0.85
  const heightError = range(state, -1, 1) * heightHalfRange * errorScale
  const targetZ = clamp(0.22 + power * 1.05 + outsideBox * 0.3 + heightError, 0.05, 3.1)
  const flightTime = Math.max(0.18, (shotDistance / speed) * 1.04)
  const startZ = 0.08
  const launchVz = clamp((targetZ - startZ + 4.9 * flightTime * flightTime) / flightTime, 0, 9.5)
  const xg = shotXg(state, shooter)
  state.ball.shotXg = xg
  state.ball.intendedReceiverId = null
  state.ball.passTeamId = shooter.teamId
  state.ball.lastTouchTeamId = shooter.teamId
  state.ball.lastTouchPlayerId = shooter.id
  shooter.shots += 1
  state.stats[shooter.teamId].shots += 1
  state.stats[shooter.teamId].xg += xg
  if (Math.abs(target.y - 34) <= 3.66 && targetZ <= 2.44) state.stats[shooter.teamId].shotsOnTarget += 1
  looseBall(state, mul(norm(sub(target, state.ball.pos)), speed), 'shot', startZ, launchVz)
  state.ball.shotOrigin = { ...shooter.pos }
  state.ball.shotPower = clamp(power, 0, 1)
  state.ball.shotDistance = shotDistance
}

function centralCongestion(state: MatchState, passer: RuntimePlayer): number {
  const passerLocal = worldToLocal(state, passer.teamId, passer.pos)
  let congestion = 0
  for (const opp of onPitch(state, other(passer.teamId))) {
    const local = worldToLocal(state, passer.teamId, opp.pos)
    if (local.x > passerLocal.x + 1 && local.x < passerLocal.x + 30 && local.y > 24 && local.y < 44) {
      congestion += clamp(1.15 - dist(passer.pos, opp.pos) / 34, 0.15, 1)
    }
  }
  return clamp(congestion, 0, 6)
}

function chooseReceiver(state: MatchState, passer: RuntimePlayer, direction?: Vec, through = false, maxDistance = Infinity): RuntimePlayer | undefined {
  const all = onPitch(state, passer.teamId)
    .filter((p) => p.id !== passer.id && dist(passer.pos, p.pos) <= maxDistance)
  if (!all.length) return undefined
  // A pass to a man standing beyond the last defender is not a bad pass, it is
  // not a pass: the referee whistles it the moment he touches it. This used to
  // be a sixty-point penalty inside the scoring sum, which any forward with
  // space and an angle could out-bid — the side was playing 56 of them a match
  // and being caught 36 times. Legality is a filter, not a weight. The margin
  // keeps the genuinely marginal run, which is what offside actually looks
  // like; if nobody is legal, the carrier still has his team-mates to consider.
  const legal = all.filter((p) => perceivedOvershoot(state, p, passer) <= OFFSIDE_MARGIN_M)
  const candidates = legal.length ? legal : all
  const goal = goalTarget(state, passer.teamId)
  const plan = planFor(state, passer.teamId)
  const passerLocal = worldToLocal(state, passer.teamId, passer.pos)
  const congestion = centralCongestion(state, passer)
  const nearestPresser = nearestOpponent(state, passer)
  const pressureDistance = nearestPresser ? dist(nearestPresser.pos, passer.pos) : 99
  // Does the passer actually have somebody ahead of him to find? Without this
  // the "do not just play it to the other centre-back" rule would punish a
  // back line that has genuinely nothing on.
  const progressiveOptions = onPitch(state, passer.teamId).filter((t) =>
    t.id !== passer.id && t.slotPosition !== 'GK'
    && worldToLocal(state, passer.teamId, t.pos).x > passerLocal.x + 5
    && opponentDistance(state, t.pos, passer.teamId) > 4.5
    && !isOffsideAtPass(state, t, passer)).length
  return candidates.sort((a, b) => {
    const score = (p: RuntimePlayer) => {
      const d = dist(passer.pos, p.pos)
      const to = norm(sub(p.pos, passer.pos))
      const angleScore = direction && len(direction) > 0.1 ? (to.x * direction.x + to.y * direction.y) * 34 : 0
      const rawForward = dist(passer.pos, goal) - dist(p.pos, goal)
      const forward = clamp(rawForward, -12, 18) * (0.45 + plan.sliders.directness / 130)
      const receiverOpenDistance = opponentDistance(state, p.pos, passer.teamId)
      const open = Math.min(12, receiverOpenDistance) * 1.15
      const lane = laneBlocked(state, passer.pos, p.pos, passer.teamId) * 2.2
      const shortPreference = -(Math.abs(d - (18 - plan.sliders.directness / 10)) * 0.35)
      // The keeper is a real outlet, not a last resort. He is the safest
      // pass on the pitch when his own box is clear, which is exactly when a
      // side under pressure plays back to him.
      const gkFree = p.slotPosition === 'GK' ? opponentDistance(state, p.pos, passer.teamId) : 0
      const gkPenalty = p.slotPosition === 'GK'
        ? (gkFree > 13 && pressureDistance < 8 ? 1.5 : passerLocal.x < 26 && pressureDistance < 5 ? -4 : -16)
        : 0
      const receiverLocal = worldToLocal(state, passer.teamId, p.pos)
      const circulation = circulationPenalty({
        passerRole: passer.slotPosition,
        receiverRole: p.slotPosition,
        pressure: pressureDistance,
        receiverLocalX: receiverLocal.x,
        passerLocalX: passerLocal.x,
        progressiveOptions,
      })
      const betweenLines = receiverLocal.x > 48 && receiverLocal.x < 82 ? (receiverLocal.x - 48) * 0.16 : 0
      const runner = p.runUntil > state.clockSeconds ? 9 + attr(p, 'aggression') / 12 : 0
      const finalThird = receiverLocal.x > 68 ? plan.sliders.directness / 14 : 0
      const verticalJump = receiverLocal.x - passerLocal.x
      const longVerticalPenalty = verticalJump > 30 ? (verticalJump - 30) * Math.max(0.25, 1.05 - plan.sliders.directness / 130) : 0
      const passerIsDefender = ['GK', 'LB', 'LCB', 'CB', 'RCB', 'RB', 'LWB', 'RWB'].includes(passer.slotPosition)
      const receiverIsMidfielder = ['DM', 'LDM', 'RDM', 'LM', 'LCM', 'CM', 'RCM', 'RM', 'CAM'].includes(p.slotPosition)
      const receiverIsForward = ['LW', 'RW', 'ST', 'LST', 'RST'].includes(p.slotPosition)
      const stageBonus = (passerIsDefender && receiverIsMidfielder ? 5.5 : 0)
        + (!passerIsDefender && passerLocal.x > 45 && receiverIsForward ? 4.5 : 0)
        + (d >= 7 && d <= 24 ? plan.sliders.support / 18 : 0)
      const wideReceiver = Math.abs(receiverLocal.y - 34) >= 18
      const centralReceiver = Math.abs(receiverLocal.y - 34) <= 10
      const defensiveOutlet = ['LB', 'LCB', 'CB', 'RCB', 'RB', 'LWB', 'RWB'].includes(p.slotPosition)
      const pivotReceiver = ['DM', 'LDM', 'RDM'].includes(p.slotPosition)
      const buildUpBonus = passerLocal.x < 42
        ? (wideReceiver ? 4 + congestion * 1.5 : 0) + (defensiveOutlet ? 3.2 : 0) + (pivotReceiver ? 2.4 : 0)
        : 0
      const wingEscapeBonus = congestion > 1.7 && wideReceiver ? congestion * 2.1 : 0
      const congestionPenalty = centralReceiver ? congestion * 1.45 : 0
      const switchBonus = Math.abs(passerLocal.y - 34) > 13
        && Math.sign(receiverLocal.y - 34) !== Math.sign(passerLocal.y - 34)
        && wideReceiver
        && receiverOpenDistance > 5
        ? 4 + plan.sliders.width / 20
        : 0
      const secureResetBonus = receiverLocal.x < passerLocal.x - 2 && pressureDistance < 5 && receiverOpenDistance > 4 ? 5 : 0
      const thirdManBonus = ((['LCB', 'CB', 'RCB'].includes(passer.slotPosition) && ['LB', 'RB', 'LWB', 'RWB'].includes(p.slotPosition))
        || (['LB', 'RB', 'LWB', 'RWB'].includes(passer.slotPosition) && pivotReceiver)) ? 4.2 : 0
      const identityBuildBonus = passerLocal.x < 46 && passer.teamId === 'banyarn' && p.slotPosition === 'RDM' ? 4 : 0
      // A through ball to a man who is already beyond the line is not a
      // through ball, it is an offside. Discounting the penalty for a runner
      // meant the carrier was rewarded for playing exactly the pass that
      // cannot work — the runner bonus and the through bonus together
      // outweighed it. Offside is offside, whoever is running.
      const offside = isOffsideAtPass(state, p, passer)
      const offsidePenalty = offside ? 60 : 0
      return angleScore + forward + open + shortPreference + gkPenalty + betweenLines + runner + finalThird + stageBonus
        + buildUpBonus + wingEscapeBonus + switchBonus + secureResetBonus + thirdManBonus + identityBuildBonus
        - longVerticalPenalty - lane - congestionPenalty - offsidePenalty - circulation
        + (through && !offside && p.runUntil > state.clockSeconds ? 16 : 0)
    }
    return score(b) - score(a)
  })[0]
}

function chooseKickoffReceiver(state: MatchState, taker: RuntimePlayer, input?: PlayerInput): RuntimePlayer | undefined {
  if (input?.through) return chooseReceiver(state, taker, input.move, true)
  const takerLocal = worldToLocal(state, taker.teamId, taker.pos)
  const desiredY = input && len(input.move) > 0.1 ? clamp(34 + input.move.y * 16, 8, 60) : 34
  const candidates = onPitch(state, taker.teamId)
    .filter((p) => p.id !== taker.id && p.slotPosition !== 'GK')
    .filter((p) => worldToLocal(state, taker.teamId, p.pos).x <= takerLocal.x + 2)
  return candidates.sort((a, b) => {
    const score = (p: RuntimePlayer) => {
      const midfielder = ['DM', 'LDM', 'RDM', 'LCM', 'CM', 'RCM', 'CAM', 'LM', 'RM'].includes(p.slotPosition) ? 14 : 0
      const distanceScore = -Math.abs(dist(taker.pos, p.pos) - 16) * 0.55
      const sideScore = -Math.abs(p.pos.y - desiredY) * 0.55
      const open = Math.min(12, opponentDistance(state, p.pos, taker.teamId)) * 0.7
      const lane = laneBlocked(state, taker.pos, p.pos, taker.teamId) * 1.45
      return midfielder + distanceScore + sideScore + open - lane
    }
    return score(b) - score(a)
  })[0] ?? chooseReceiver(state, taker, input?.move)
}

function knockBallAhead(state: MatchState, p: RuntimePlayer, direction?: Vec): boolean {
  if (state.ball.ownerId !== p.id || state.phase !== 'play') return false
  const moveDirection = direction && len(direction) > 0.08 ? norm(direction) : null
  const velocityDirection = len(p.vel) > 1 ? norm(p.vel) : null
  const dir = moveDirection ?? velocityDirection ?? p.facing
  let speed = clamp(
    len(p.vel) + 5.2 + attr(p, 'dribbleSpeed') / 22 + attr(p, 'topSpeed') / 55,
    9.5,
    16.5,
  )
  const opposingGk = onPitch(state, other(p.teamId)).find((opp) => opp.slotPosition === 'GK')
  if (opposingGk) {
    const gkDistance = dist(opposingGk.pos, p.pos)
    if (gkDistance < 16) speed = Math.min(speed, Math.max(8.5, gkDistance * 0.62))
  }
  state.ball.lastTouchTeamId = p.teamId
  state.ball.lastTouchPlayerId = p.id
  looseBall(state, mul(dir, speed), 'loose', 0, 0)
  state.ball.intendedReceiverId = p.id
  state.ball.passTeamId = p.teamId
  state.ball.offsideReceiverId = null
  p.touchDirection = { ...dir }
  p.touchDistance = 3
  p.touchTimer = 0.16
  p.decisionTimer = Math.max(p.decisionTimer, 0.28)
  return true
}

/**
 * How long a keeper keeps the BallState in his hands. A save is not a signal
 * to restart instantly: he stands up, walks to the edge of his six-yard box
 * and waits while his team climbs back into shape and the opposition drops
 * off. Leading late and after a spell of pressure he takes longer. Capped
 * below the Law's eight-second limit for holding the ball.
 */
function keeperHoldSeconds(state: MatchState, p: RuntimePlayer): number {
  const lead = state.score[p.teamId] - state.score[other(p.teamId)]
  const late = state.clockSeconds / 60 > 72
  return clamp(
    range(state, 3.4, 5.4) + (lead > 0 ? 0.9 : 0) + (late && lead >= 0 ? 0.7 : 0) + (p.load > 70 ? 0.5 : 0),
    2.8,
    8.5,
  )
}

/**
 * How much a position is allowed to carry the ball. Carrying is a tool, and
 * like any tool it belongs to the players it suits: a winger goes at his man, a
 * centre-back steps out only into a genuinely empty pitch.
 */
function carryLicenceFor(position: string): number {
  if (['LW', 'RW', 'LW', 'RWB', 'LWB'].includes(position)) return 1
  if (['CAM', 'LM', 'RM', 'CM', 'LCM', 'RCM', 'SS'].includes(position)) return 0.72
  if (['LB', 'RB', 'ST', 'LST', 'RST'].includes(position)) return 0.6
  if (['DM', 'LDM', 'RDM', 'WB'].includes(position)) return 0.4
  return 0.22
}

/** Metres of genuinely clear grass in front of the carrier, up to 20. */
function openGrassAhead(state: MatchState, p: RuntimePlayer): number {
  const toGoal = norm(sub(goalTarget(state, p.teamId), p.pos))
  const heading = norm({ x: toGoal.x * 0.6 + attackDir(state, p.teamId) * 0.4, y: toGoal.y * 0.6 })
  const opponents = onPitch(state, other(p.teamId)).filter((o) => o.slotPosition !== 'GK')
  for (let step = 2; step <= 20; step += 2) {
    const point = add(p.pos, mul(heading, step))
    if (opponents.some((o) => dist(o.pos, point) < 2.8)) return step - 2
  }
  return 20
}

/**
 * A team-mate is dropping toward the ball right now, and how far away he is.
 * A man who has been asked for the angle counts, but only once he is close
 * enough for the wait to be a beat rather than a stall.
 */
function dropComing(state: MatchState, carrier: RuntimePlayer): number {
  let nearest = 99
  for (const t of onPitch(state, carrier.teamId)) {
    if (t.id === carrier.id || t.slotPosition === 'GK') continue
    const d = dist(t.pos, carrier.pos)
    if (d > 18 || d < 4) continue
    const asked = t.supportUntil > state.clockSeconds && d <= 16
    const arriving = dist(t.target, carrier.pos) < d - 1.2
    if (asked || arriving) nearest = Math.min(nearest, d)
  }
  return nearest
}

/** A team-mate is arriving on a run, so the ball can be slid in behind. */
function joinArriving(state: MatchState, carrier: RuntimePlayer): boolean {
  return onPitch(state, carrier.teamId).some((t) =>
    t.id !== carrier.id && t.slotPosition !== 'GK'
    && t.runUntil > state.clockSeconds
    && dist(t.pos, carrier.pos) < 38)
}

/** Ask the nearest sensible team-mate to drop in and give the carrier an out. */
function offerDrop(state: MatchState, carrier: RuntimePlayer): void {
  const candidates: DropCandidate[] = onPitch(state, carrier.teamId)
    .filter((t) => t.id !== carrier.id && t.slotPosition !== 'GK')
    .map((t) => ({
      id: t.id,
      role: t.slotPosition,
      distance: dist(t.pos, carrier.pos),
      openness: opponentDistance(state, t.pos, carrier.teamId),
      running: t.runUntil > state.clockSeconds,
      mentality: attr(t, 'mentality'),
    }))
  const dropper = pickDropper(candidates)
  if (!dropper) return
  const p = byId(state, dropper.id)
  if (!p) return
  p.supportUntil = Math.max(p.supportUntil, state.clockSeconds + 1.6)
}

function aiCarrierDecision(state: MatchState, p: RuntimePlayer) {
  const params = difficultyParams(state, p.teamId)
  const local = worldToLocal(state, p.teamId, p.pos)
  const nearest = nearestOpponent(state, p)
  const pressure = nearest ? dist(nearest.pos, p.pos) : 99
  const plan = planFor(state, p.teamId)
  if (p.slotPosition === 'GK') {
    const receiver = chooseReceiver(state, p)
    if (receiver) executePass(state, p, receiver, false, plan.sliders.directness > 62 && rand(state) > 0.45)
    return
  }
  const distanceGoal = dist(p.pos, goalTarget(state, p.teamId))
  const breakaway = breakawayContext(state, p)
  if (breakaway.inBehind) {
    const squareTarget = breakaway.supportRunners.find((runner) => {
      const runnerLocal = worldToLocal(state, p.teamId, runner.pos)
      return runnerLocal.x > local.x - 6
        && dist(runner.pos, goalTarget(state, p.teamId)) < 17
        && laneBlocked(state, p.pos, runner.pos, p.teamId) < 2.5
        && !isOffsideAtPass(state, runner, p)
    })
    const wideCarrier = Math.abs(p.pos.y - 34) > 12
    if (squareTarget && (wideCarrier || distanceGoal > 16)) {
      executePass(state, p, squareTarget)
      return
    }
    // Clean through: the finishers take it on, the rest of the side keeps the
    // move alive. A full-back who has broken the line squares it to the man
    // arriving rather than shooting from 22 metres.
    const breakFinisher = ['ST', 'LST', 'RST', 'LW', 'RW', 'CAM', 'CM', 'LCM', 'RCM'].includes(p.slotPosition)
    if (distanceGoal <= 24 && (breakFinisher || distanceGoal <= 14)) {
      const aimY = breakaway.goalkeeper && breakaway.goalkeeper.pos.y > 34 ? 31.1 : 36.9
      executeShot(state, p, clamp(0.5 + distanceGoal / 55, 0.52, 0.78), aimY)
      return
    }
    // A clean break should become a foot race and a 1v1, not a sideways
    // recycle because the generic receiver score found a safer option.
    // Knock it into the channel when only the keeper (or one recovering
    // defender) is ahead, when there is no support, or when a chaser is
    // close enough that protecting a close dribble would invite a tackle.
    if (breakaway.outfieldAhead <= 1 || breakaway.supportRunners.length < 2 || breakaway.nearestChaserDistance < 5) {
      const goal = goalTarget(state, p.teamId)
      const channel = {
        x: goal.x,
        y: clamp(p.pos.y + (p.pos.y < 34 ? -3.5 : 3.5), 5, 63),
      }
      knockBallAhead(state, p, sub(channel, p.pos))
      return
    }
  }
  const central = Math.abs(p.pos.y - 34) < 17
  // Anywhere in the box is a shooting position, not only the middle of it.
  const inBox = distanceGoal < 16.5
  if (distanceGoal < 35 && (central || inBox) && local.x > 62) {
    const chanceQuality = shotXg(state, p)
    // Shot selection should not collapse just because the statistical xG
    // curve now values long attempts realistically. Use a compressed
    // decision appeal for behaviour while retaining the lower xG number
    // for match statistics.
    const shootingAppeal = Math.pow(chanceQuality, 0.55)
    let shootChance = clamp(shootingAppeal * 1.45 + (attr(p, 'shotAccuracy') - 60) / 200, 0.26, 0.88) * params.quality
    // Who shoots from where. A full-back does not take a 23-metre effort
    // because the ball fell to him: he recycles and keeps the move alive. A
    // striker does not spend his afternoon shooting from the edge of the D
    // when his job is to get across the six-yard box. The interior
    // midfielder, on the other hand, is exactly the man who should strike
    // from the edge of the area when the lane opens — that is his chance.
    const shotPos = p.slotPosition
    const deepRole = ['LB', 'RB', 'LWB', 'RWB', 'LCB', 'CB', 'RCB', 'SW'].includes(shotPos)
    const screenRole = ['DM', 'LDM', 'RDM'].includes(shotPos)
    const interiorRole = ['CM', 'LCM', 'RCM', 'CAM'].includes(shotPos)
    const strikerRole = ['ST', 'LST', 'RST'].includes(shotPos)
    if (deepRole) shootChance *= distanceGoal < 15 ? 0.7 : 0.16
    else if (screenRole) shootChance *= distanceGoal < 18 ? 0.8 : 0.2
    else if (interiorRole) shootChance *= distanceGoal < 21 ? 1.05 : distanceGoal < 26 ? 0.5 : 0.22
    else if (strikerRole) shootChance *= distanceGoal > 20 ? 0.6 : 1.2
    // In the box the shot is the default. Waiting for a better picture inside
    // the area is how attacks die: the chance is now, and the block is
    // already arriving.
    if (inBox) shootChance = Math.max(shootChance, distanceGoal < 11 ? 0.96 : 0.88)
    if (distanceGoal > 22) {
      const specialist = p.base.stars.includes('Middle Shooting')
      const shotLane = laneBlocked(state, p.pos, goalTarget(state, p.teamId), p.teamId)
      shootChance *= specialist ? 1 : 0.8
      if (shotLane > 5) shootChance *= 0.5
      if (pressure < 2.5) shootChance *= 0.68
    }
    // A big chance in front of goal: if the man with it is not a finisher,
    // he squares it. This is the decision that separates a striker from a
    // centre-back who happens to be on the end of a cutback.
    const isFinisher = ['ST', 'LST', 'RST'].includes(p.slotPosition)
      || attr(p, 'shotAccuracy') >= 82
      || p.base.stars.includes('Scoring')
    const square = onPitch(state, p.teamId)
      .filter((t) => t.id !== p.id && t.slotPosition !== 'GK')
      .map((t) => ({
        t,
        l: worldToLocal(state, p.teamId, t.pos),
        d: dist(t.pos, goalTarget(state, p.teamId)),
        lane: laneBlocked(state, p.pos, t.pos, p.teamId),
      }))
      .filter(({ t, l, d, lane }) => l.x > 78 && d < 14 && lane < 3 && !isOffsideAtPass(state, t, p))
      .sort((a, b) => a.d - b.d)[0]
    // Cross and shoot decisions belong to profiles, not to a single rule:
    // an interior midfielder squares a chance he is not built to finish, and
    // even a striker gives it up when a team-mate has a clearly better angle.
    const squareGain = square ? distanceGoal - square.d : 0
    const shouldSquare = Boolean(square) && chanceQuality > 0.1 && (
      (!isFinisher && chanceQuality > 0.14)
      || (!p.base.stars.includes('Scoring') && squareGain > 4.5)
    )
    if (shouldSquare && square) {
      executePass(state, p, square.t)
      return
    }
    if (rand(state) < shootChance || distanceGoal < 11) {
      executeShot(state, p, clamp(0.38 + distanceGoal / 55 + attr(p, 'shotPower') / 420, 0.42, 0.86))
      return
    }
  }
  // The wide branch belongs to the wide attackers. A full-back on the same
  // grass is a crosser, not a shooter: he overlaps to deliver, and only takes
  // a shot when he has genuinely arrived in the box.
  const wideShooter = ['LW', 'RW', 'LM', 'RM'].includes(p.slotPosition) ? 1
    : ['LWB', 'RWB'].includes(p.slotPosition) ? 0.45
      : 0.22
  const wideDistance = Math.abs(p.pos.y - 34)
  if (local.x > 64 && wideDistance >= 12 && distanceGoal < 34) {
    // A winger in the final third has two jobs and picks between them on how
    // much grass he has: drive inside and shoot when the corridor is open and
    // the angle is good, otherwise look for the striker in the box.
    const inverted = (p.pos.y < 34 && p.base.foot === 'R') || (p.pos.y >= 34 && p.base.foot === 'L') || p.base.foot === 'B'
    const insideCorridor = {
      x: p.pos.x + attackDir(state, p.teamId) * 8,
      y: p.pos.y + (34 - p.pos.y) * 0.7,
    }
    const cutLane = laneBlocked(state, p.pos, insideCorridor, p.teamId)
    const boxRunners = onPitch(state, p.teamId)
      .filter((t) => t.id !== p.id && t.slotPosition !== 'GK')
      .map((t) => ({ t, l: worldToLocal(state, p.teamId, t.pos) }))
      .filter(({ l }) => l.x > 82 && Math.abs(l.y - 34) < 16)
      .sort((a, b) => Math.abs(a.l.y - 34) - Math.abs(b.l.y - 34))
    const striker = boxRunners[0]
    const strikerLane = striker ? laneBlocked(state, p.pos, striker.t.pos, p.teamId) : 99
    // The keeper is not a marker: whether a striker is "free" is about the
    // defenders around him.
    const strikerMarker = striker
      ? onPitch(state, other(p.teamId))
        .filter((o) => o.slotPosition !== 'GK')
        .sort((a, b) => dist(a.pos, striker.t.pos) - dist(b.pos, striker.t.pos))[0]
      : undefined
    const strikerFree = Boolean(striker) && (!strikerMarker || dist(strikerMarker!.pos, striker!.t.pos) > 4.2)
    // At the corner of the box a winger does not always need to come inside
    // first: if the angle across the keeper is on, he hits it.
    if (distanceGoal < 19.5 && wideDistance < 25 && cutLane < 4 && pressure > 1.1
      && rand(state) < 0.5 * wideShooter * params.quality * (0.6 + attr(p, 'shotAccuracy') / 160)) {
      executeShot(state, p, clamp(0.5 + distanceGoal / 80, 0.5, 0.8),
        34 + (p.pos.y < 34 ? 1.4 : -1.4))
      return
    }
    const shootingAngle = clamp(1 - Math.abs(p.pos.y - 34) / 46, 0.15, 1)
    // Coming inside is a winger's route to goal, not a full-back's: the same
    // corridor is worth half as much to a defender, who should be delivering
    // from where he is.
    const cutAppeal = ((strikerFree ? -0.15 : 0) + clamp((9 - cutLane) / 16, 0, 0.46)
      + clamp((7 - pressure) / 20, 0, 0.18)
      + (distanceGoal < 18 ? 0.34 : distanceGoal < 23 ? 0.16 : distanceGoal < 27 ? 0.02 : -0.2)
      + shootingAngle * 0.16
      + (inverted ? 0.15 : 0)
      + (attr(p, 'dribbleAccuracy') - 78) / 320) * (0.5 + wideShooter * 0.5)
    const crossAppeal = (striker ? (strikerLane < 3 ? 0.33 : 0.19) : 0)
      + (strikerFree ? 0.22 : 0)
      + (boxRunners.length >= 2 ? 0.08 : 0)
      + (wideDistance > 20 ? 0.12 : 0)
      + (distanceGoal > 26 ? 0.16 : distanceGoal > 21 ? 0.06 : 0)
      + (attr(p, 'longPassAccuracy') - 74) / 340
    // The decision is a straight comparison of the two pieces of space: if
    // the corridor inside is clearly cleaner than the lane to the striker,
    // he comes inside; if the striker is well placed, he looks for him.
    const insideIsCleaner = striker ? cutLane + 1.6 < strikerLane : cutLane < 2.4
    if (cutAppeal + range(state, -0.1, 0.1) > crossAppeal || (insideIsCleaner && cutLane < 4.4 && distanceGoal < 27)) {
      // Cut inside. If the angle is already on, hit it now; otherwise knock
      // it into the inside channel and go after it.
      if (distanceGoal < 28 && cutLane < 4 && pressure > 1.2) {
        executeShot(state, p, clamp(0.44 + distanceGoal / 70 + attr(p, 'shotAccuracy') / 520, 0.46, 0.8),
          34 + (p.pos.y < 34 ? 1.6 : -1.6))
        return
      }
      p.insideRunUntil = state.clockSeconds + 1.9
      knockBallAhead(state, p, sub(insideCorridor, p.pos))
      return
    }
    if (local.x > 72 && p.insideRunUntil > state.clockSeconds && cutLane < 4.5) {
      executeShot(state, p, clamp(0.44 + distanceGoal / 70, 0.46, 0.8))
      return
    }
    // A cross is the end of a move, not the start of one: it goes in when
    // there are bodies arriving in the box (two or more, or a striker on a
    // timed run), otherwise the winger keeps the ball and the move builds.
    const crossReady = boxRunners.length >= 2
      || (striker ? striker.t.runUntil > state.clockSeconds : false)
      || strikerFree
    if (crossReady) {
      if (local.x > 79 && rand(state) < 0.34) {
        const cutback = onPitch(state, p.teamId)
          .filter((t) => t.id !== p.id && ['CAM', 'LCM', 'RCM', 'CM', 'ST'].includes(t.slotPosition))
          // The man arriving at the edge of the box is a legal receiver or he
          // is an offside waiting to be given: standing beyond the line at x 83
          // is exactly where a cutback target looks most attractive and is
          // least playable.
          .filter((t) => perceivedOvershoot(state, t, p) <= OFFSIDE_MARGIN_M)
          .sort((a, b) => Math.abs(worldToLocal(state, p.teamId, a.pos).x - 83) - Math.abs(worldToLocal(state, p.teamId, b.pos).x - 83))[0]
        if (cutback) {
          executePass(state, p, cutback)
          return
        }
      }
      // Look for the striker's run: aim the cross at his near/back post.
      const aim = striker
        ? { x: goalTarget(state, p.teamId).x - attackDir(state, p.teamId) * 6.5, y: clamp(striker.t.pos.y, 26, 42) }
        : undefined
      executeCross(state, p, clamp(0.55 + wideDistance / 60, 0.55, 0.85), aim)
      return
    }
    // Nobody to cross to. A full-back who has run to the touchline keeps the
    // ball: check back inside, let the box fill, or recycle possession if the
    // defensive shape is already set. Whipping it into an empty area and out
    // of play is what this replaces.
    if (wideDistance > 26 || local.x > 88) {
      const recycle = onPitch(state, p.teamId)
        .filter((t) => t.id !== p.id && t.slotPosition !== 'GK')
        .filter((t) => worldToLocal(state, p.teamId, t.pos).x < local.x - 8)
        .filter((t) => laneBlocked(state, p.pos, t.pos, p.teamId) < 3.2)
        .sort((a, b) => dist(a.pos, p.pos) - dist(b.pos, p.pos))[0]
      if (recycle && rand(state) < 0.6) {
        executePass(state, p, recycle)
        return
      }
      // Otherwise he takes a controlling touch off the line and stands the
      // ball up: the box gets a second to fill before the next decision, and
      // he asks for the angle he is waiting for rather than standing there
      // hoping somebody notices.
      p.holdUntil = state.halfElapsed + range(state, 0.6, 1.2)
      p.lastHoldAt = state.halfElapsed
      offerDrop(state, p)
      if (wideDistance > 26) knockBallAhead(state, p, { x: -attackDir(state, p.teamId) * 0.5, y: 34 - p.pos.y })
      return
    }
  }
  if (local.x >= 32 && local.x <= 78 && pressure > 4.2 && attr(p, 'dribbleSpeed') >= 78) {
    const laneTarget = dribbleTarget(state, p)
    const openLane = laneBlocked(state, p.pos, laneTarget, p.teamId) < 3.5
    const knockChance = 0.16 * params.quality * (0.55 + gameplayFor(state, p.teamId).runFrequency / 110)
    if (openLane && rand(state) < knockChance) {
      knockBallAhead(state, p, sub(laneTarget, p.pos))
      return
    }
  }
  // Build-up with the driven ball. When the short options are standing in a
  // crowd but a team-mate has found space between the lines, the ball is
  // driven into his feet rather than rolled slowly into pressure.
  const driven = drivenPassOption(state, p)
  if (driven && driven.score >= 1.6) {
    const congestion = centralCongestion(state, p)
    // The driven ball is a tool for a specific picture - a crowded middle and
    // a man free between the lines - not the default way to move the ball.
    const driveAppeal = clamp((driven.score - 1.6) / 3.2, 0, 1) * 0.26
      + clamp((congestion - 1.7) / 3.5, 0, 0.16)
      + clamp((attr(p, 'longPassAccuracy') - 78) / 400, 0, 0.08)
      + clamp(plan.sliders.directness / 900, 0, 0.06)
    if (rand(state) < clamp(driveAppeal, 0.01, 0.26) * params.quality) {
      executeDrivenPass(state, p, driven.receiver, clamp(0.48 + dist(p.pos, driven.receiver.pos) / 60, 0.48, 0.95))
      return
    }
  }
  // Recycling to the keeper. A side under pressure in its own half, with the
  // keeper standing free behind the press, plays it back and starts again -
  // that is not a failure, it is how good teams keep the ball.
  {
    const keeper = onPitch(state, p.teamId).find((t) => t.slotPosition === 'GK')
    const keeperFree = keeper ? opponentDistance(state, keeper.pos, p.teamId) : 0
    const local = worldToLocal(state, p.teamId, p.pos)
    if (keeper && keeper.id !== p.id && local.x < 58 && pressure < 5.4 && keeperFree > 9
      && laneBlocked(state, p.pos, keeper.pos, p.teamId) < 2.6
      && dist(p.pos, keeper.pos) < 40 && rand(state) < 0.3 + (attr(p, 'teamwork') - 70) / 260) {
      executePass(state, p, keeper)
      return
    }
  }
  // ---------------------------------------------------------------------
  // Drive, wait or release. A side that only ever passes is easy to defend,
  // and a side that stands over the ball for the sake of it is worse: the
  // carrier goes at the space when there is space, waits for a drop or a
  // join when the picture is not there yet, and otherwise moves it on.
  // ---------------------------------------------------------------------
  const look = chooseReceiver(state, p)
  if (look) {
    const goal = goalTarget(state, p.teamId)
    const ahead = onPitch(state, p.teamId).filter((t) =>
      t.id !== p.id && t.slotPosition !== 'GK'
      && worldToLocal(state, p.teamId, t.pos).x > local.x + 5
      && opponentDistance(state, t.pos, p.teamId) > 4.5).length
    const lookLane = laneBlocked(state, p.pos, look.pos, p.teamId)
    const lookGain = dist(p.pos, goal) - dist(look.pos, goal)
    // If the best ball available is a pass into a crowd, somebody has to give
    // him an angle — asking for the drop is what makes waiting possible.
    if ((lookLane < 2.6 || lookGain <= 2.5) && pressure > 2.4 && local.x < 62) offerDrop(state, p)
    const dropDistance = dropComing(state, p)
    const flow = flowVerdict({
      pressure,
      localX: local.x,
      spaceAhead: openGrassAhead(state, p),
      bestLane: lookLane,
      bestGain: lookGain,
      dropComing: dropDistance < 99,
      dropDistance,
      joinArriving: joinArriving(state, p),
      progressiveOptions: ahead,
      composure: (attr(p, 'response') + attr(p, 'mentality') + attr(p, 'technique')) / 3,
      tempo: plan.sliders.tempo,
      carryLicence: carryLicenceFor(p.slotPosition),
      heldRecently: p.lastHoldAt > 0 && state.halfElapsed - p.lastHoldAt < 3.5,
    })
    if (flow.action === 'wait') {
      // Stand the ball up and let the angle arrive. He shields it rather than
      // running into the crowd while he waits.
      p.holdUntil = state.halfElapsed + flow.hold
      p.lastHoldAt = state.halfElapsed
      offerDrop(state, p)
      return
    }
    if (flow.action === 'drive') {
      knockBallAhead(state, p, sub(dribbleTarget(state, p), p.pos))
      return
    }
  }
  const receiver = chooseReceiver(state, p, undefined, rand(state) < plan.sliders.directness / 150)
  if (!receiver) return
  const receiverLane = laneBlocked(state, p.pos, receiver.pos, p.teamId)
  const receiverForwardGain = dist(p.pos, goalTarget(state, p.teamId)) - dist(receiver.pos, goalTarget(state, p.teamId))
  let passChance = 0.3 + plan.sliders.tempo / 420
  const receiverLocal = worldToLocal(state, p.teamId, receiver.pos)
  if (pressure < 4.2) passChance = 0.86
  else if (local.x < 42 && Math.abs(receiverLocal.y - 34) >= 18 && centralCongestion(state, p) > 1.7) passChance = 0.78
  else if (local.x < 28) passChance = 0.66
  else if (receiverLane < 1.8 && receiverForwardGain > 7) passChance = 0.62
  else if (receiverLane > 7) passChance = 0.18
  if (rand(state) < passChance * params.quality) executePass(state, p, receiver, receiver.runUntil > state.clockSeconds, dist(p.pos, receiver.pos) > 34)
}

function dribbleTarget(state: MatchState, p: RuntimePlayer): Vec {
  const goal = goalTarget(state, p.teamId)
  const nearest = nearestOpponent(state, p)
  // Waiting for the picture: he stands the ball up and puts his body between
  // it and the nearest opponent instead of walking into the crowd.
  if (p.holdUntil > state.halfElapsed) {
    const away = nearest ? norm(sub(p.pos, nearest.pos)) : { x: -attackDir(state, p.teamId), y: 0 }
    return { x: clamp(p.pos.x + away.x * 1.6, 1, 103.6), y: clamp(p.pos.y + away.y * 1.6, 1.6, 66.4) }
  }
  let target = add(p.pos, mul(norm(sub(goal, p.pos)), 16))
  const congestion = centralCongestion(state, p)
  if (p.insideRunUntil > state.clockSeconds) {
    // Committed to the cut-back inside: drive at the corridor between the
    // full-back and the centre-back, not down the line.
    target = {
      x: clamp(p.pos.x + attackDir(state, p.teamId) * 17, 2, 103),
      y: p.pos.y < 34 ? 33.5 : 34.5,
    }
  } else if (congestion > 2.1 && Math.abs(p.pos.y - 34) < 20) {
    // Do not keep driving into a packed central corridor when the touchline
    // is the available escape route.
    const side = p.pos.y <= 34 ? 12 : 56
    target = {
      x: p.pos.x + attackDir(state, p.teamId) * 11,
      y: p.pos.y + (side - p.pos.y) * 0.72,
    }
  }
  if (nearest && dist(nearest.pos, p.pos) < 7) {
    const away = norm(sub(p.pos, nearest.pos))
    target = add(target, mul(away, 8))
  }
  if (Math.abs(p.pos.y - 34) > 25) target.y += (34 - target.y) * 0.18
  // Deep on the paint the only way forward is inside. Carrying the ball
  // straight at the corner flag is how a full-back "pushes it out".
  const local = worldToLocal(state, p.teamId, p.pos)
  if (local.x > 84 && Math.abs(local.y - 34) > 24) {
    const side = local.y < 34 ? 1 : -1
    return localToWorld(state, p.teamId, Math.min(101, local.x + 3), 34 - side * 13)
  }
  return { x: clamp(target.x, 1, 103.6), y: clamp(target.y, 1.6, 66.4) }
}

/**
 * Chance-creation spacing. Once the carrier reaches the final third the front
 * players stop sharing the same strip of grass: the best finisher attacks the
 * near post, the next one the back post, one holds the edge of the box for the
 * cutback and the pass-and-shoot, and one keeps the far-side width for a tap-in
 * from a switched cross. Channels are ranked, so nobody doubles up.
 */
function chanceCreationShape(state: MatchState, owner: RuntimePlayer): Map<string, { target: Vec; urgency: number }> {
  const out = new Map<string, { target: Vec; urgency: number }>()
  const teamId = owner.teamId
  const leftSide = owner.pos.y < H / 2
  const nearY = leftSide ? 29.5 : 38.5
  const farY = leftSide ? 38.5 : 29.5
  const crossing = Math.abs(owner.pos.y - H / 2) > 15
  const spots = [
    { x: 99.5, y: nearY, urgency: crossing ? 2 : 1 },
    { x: 98, y: farY, urgency: crossing ? 2 : 1 },
    { x: 86.5, y: 34, urgency: 1 },
    { x: 92, y: leftSide ? 19 : 49, urgency: 1 },
  ]
  const rank = (p: RuntimePlayer) => attr(p, 'attack') + attr(p, 'header') * 0.6 + attr(p, 'shotAccuracy') * 0.5
    + (['ST', 'LST', 'RST'].includes(p.slotPosition) ? 26 : 0)
    + (['LW', 'RW', 'CAM', 'LCM', 'RCM', 'CM'].includes(p.slotPosition) ? 10 : 0)
  const candidates = onPitch(state, teamId)
    .filter((p) => p.id !== owner.id && p.slotPosition !== 'GK' && p.runUntil <= state.clockSeconds)
    .sort((a, b) => rank(b) - rank(a))
  spots.forEach((spot, i) => {
    const player = candidates[i]
    if (!player) return
    const world = localToWorld(state, teamId, spot.x, spot.y)
    // A touch of lateral spread so two runners do not queue on one spot.
    const spread = (i % 2 === 0 ? 1 : -1) * 1.1
    out.set(player.id, { target: { x: clamp(world.x, 1, 104), y: clamp(world.y + spread, 1, 67) }, urgency: spot.urgency })
  })
  return out
}

/**
 * The line has been played through: the carrier is deeper than the back line
 * and running at the goal. That is not a moment to hold shape.
 */
function backlineBreached(state: MatchState, teamId: TeamId, carrier: RuntimePlayer): boolean {
  const defenders = onPitch(state, teamId).filter((p) => p.slotPosition !== 'GK' && !['ST', 'LST', 'RST', 'LW', 'RW'].includes(p.slotPosition))
  if (defenders.length < 2) return false
  const ballLocal = worldToLocal(state, teamId, carrier.pos)
  if (ballLocal.x > 62) return false
  const xs = defenders.map((p) => worldToLocal(state, teamId, p.pos).x).sort((a, b) => a - b)
  const line = xs[Math.min(1, xs.length - 1)]!
  return ballLocal.x < line - 1.5
}

/**
 * Where each beaten defender sprints when the line goes: first man delays the
 * carrier, then the goal is covered, then near post, far post, edge of the box
 * and the cutback lane. Everyone runs at full urgency.
 */
/**
 * The defender closest to a man running at goal. Only he is allowed to leave
 * the shape, and only sometimes: going to ground after a 1v1 is a gamble that
 * either kills the move or empties the middle. Response, Top Speed, Defence,
 * the marking and tackle-aggression sliders and the difficulty decide how
 * often he takes it on, and fatigue makes him think twice. The decision is
 * held for a second or two so he commits to the chase instead of dithering
 * between pressing and covering every frame.
 */
function oneOnOneChaser(state: MatchState, p: RuntimePlayer, carrier: RuntimePlayer): boolean {
  if (p.slotPosition === 'GK') return false
  if (dist(carrier.pos, ownGoal(state, p.teamId)) > 42) return false
  const nearest = onPitch(state, p.teamId)
    .filter((d) => d.slotPosition !== 'GK')
    .sort((a, b) => dist(a.pos, carrier.pos) - dist(b.pos, carrier.pos))[0]
  if (nearest?.id !== p.id) return false
  return dist(p.pos, carrier.pos) < 16
}

function duelShouldCommit(state: MatchState, p: RuntimePlayer, carrier: RuntimePlayer): boolean {
  if (p.duelCarrierId === carrier.id && p.duelUntil > state.halfElapsed) return p.duelCommit
  const settings = gameplayFor(state, p.teamId)
  const score = 0.15
    + (attr(p, 'response') - 62) / 200
    + (attr(p, 'topSpeed') - 62) / 220
    + (attr(p, 'defence') - 62) / 260
    + (settings.marking - 50) / 300
    + (settings.tackleAggression - 50) / 500
    + (difficultyParams(state, p.teamId).quality - 1) * 0.14
    - (p.load - 40) / 260
    + (rand(state) - 0.5) * 0.42
  const commit = score > 0.42
  p.duelUntil = state.halfElapsed + range(state, 0.9, 1.8)
  p.duelCarrierId = carrier.id
  p.duelCommit = commit
  return commit
}

function recoverySpot(state: MatchState, teamId: TeamId, carrier: RuntimePlayer, rank: number): Vec {
  const own = ownGoal(state, teamId)
  const toGoal = norm(sub(own, carrier.pos))
  if (rank <= 0) return add(carrier.pos, mul(toGoal, 1.75))
  const ballLocal = worldToLocal(state, teamId, carrier.pos)
  const nearPost = ballLocal.y < H / 2 ? 29 : 39
  const farPost = ballLocal.y < H / 2 ? 39 : 29
  // Recovering is not retreating to the goal line. Ranks form a line between
  // the ball and the goal, each a couple of metres deeper than the last: the
  // first two cover the central lane and the posts, the rest fill in behind
  // them. The old spots put ranks 1-3 within three metres of the goal, so a
  // side caught upfield ran to its own six-yard box and handed over the whole
  // half instead of forming a block.
  const depth = clamp(ballLocal.x - (8 + rank * 2.6), 5, 58)
  const spots: Vec[] = [
    { x: depth, y: 34 },
    { x: Math.max(5, depth - 3), y: nearPost },
    { x: Math.max(5, depth - 4), y: farPost },
    { x: Math.max(6, depth - 9), y: 34 },
    { x: Math.max(6, depth - 12), y: 24 },
    { x: Math.max(6, depth - 12), y: 44 },
  ]
  const spot = spots[Math.min(rank - 1, spots.length - 1)]!
  return localToWorld(state, teamId, spot.x, spot.y)
}

/**
 * Bodies in front of the shot. The nearest defenders inside the shooting
 * corridor step onto the carrier-to-goal line instead of holding a shape
 * beside it, which is what actually blocks shots.
 */
function shotBlockTargets(state: MatchState, carrier: RuntimePlayer): Map<string, Vec> {
  const out = new Map<string, Vec>()
  const goal = goalTarget(state, carrier.teamId)
  const laneLength = dist(carrier.pos, goal)
  if (laneLength > 33) return out
  const dir = norm(sub(goal, carrier.pos))
  onPitch(state, other(carrier.teamId))
    .filter((p) => p.slotPosition !== 'GK')
    .map((p) => {
      const toBall = sub(p.pos, carrier.pos)
      return {
        p,
        along: toBall.x * dir.x + toBall.y * dir.y,
        perp: Math.abs(toBall.x * dir.y - toBall.y * dir.x),
      }
    })
    .filter((d) => d.along > 0.6 && d.along < Math.min(laneLength, 22) && d.perp < 9.5)
    .sort((a, b) => a.perp - b.perp)
    .slice(0, 4)
    .forEach(({ p, along }) => {
      // Step sideways onto the lane at his own depth, a stride toward the
      // BallState. Do not drag a defender who is already deep in the lane back
      // up the pitch toward the shooter: that opens the very space the shot
      // is aimed into.
      const stand = clamp(along - 0.9, 1.1, Math.min(laneLength - 0.6, 21))
      out.set(p.id, add(carrier.pos, mul(dir, stand)))
    })
  return out
}

const ATTACKING_SLOTS = new Set(['ST', 'LST', 'RST', 'CAM', 'LW', 'RW', 'LM', 'RM'])

/**
 * Attackers play off the last defender, not through him. A forward who is
 * waiting for the ball sits on the shoulder of the offside line and times the
 * break; he only steps beyond it while a pass is already travelling (his run
 * was timed) or for a deliberate run he has been sent on. Each player holds a
 * slightly different distance, so on the odd occasion the line is mistimed he
 * is caught offside — which is what really happens.
 */
/**
 * Run timing: how far past the shoulder a forward is willing to go.
 *
 * A line that is never broken is never offside, and that is not football — the
 * best forwards gamble a stride early and are caught for it a couple of times a
 * match. The engine had the opposite defect: it played a dozen passes a match to
 * men six metres beyond the line (see docs/offsides.md), which is not a gamble,
 * it is an error. This is the thing that defect was standing in front of.
 *
 * Two halves, both of which have to be there:
 *
 *  - **Appetite.** Aggression and attacking intent push a player onto the
 *    shoulder; response — how well he reads the moment the ball is released —
 *    pulls him back. This is the per-player half, so the poacher gambles and the
 *    false nine does not, without anyone touching a slider.
 *  - **Timing.** Going early is an event, not a personality: even a good reader
 *    mistimes a run now and then. A slow oscillation with a per-player phase
 *    means different players mistime different runs, and no two runs are
 *    identical.
 *
 * The result is capped inside the referee's allowance (OFFSIDE_MARGIN_M), which
 * is deliberate: a gamble that the pass filter refuses to feed is not a gamble,
 * it is a player nobody can pass to. The mistiming has to stay in the band where
 * a carrier will still play the ball and the referee will still whistle.
 */
function lineGambleM(state: MatchState, p: RuntimePlayer): number {
  const appetite = clamp(
    (attr(p, 'aggression') * 0.5 + attr(p, 'attack') * 0.5 - attr(p, 'response') * 0.62) / 26,
    0,
    2.4,
  )
  const phase = hashUnit(p.id) * 6.283
  const timing = 0.5 + 0.5 * Math.sin(state.clockSeconds * 0.52 + phase)
  return appetite * timing
}

function holdAttackingLine(state: MatchState, p: RuntimePlayer, target: Vec): Vec {
  if (!ATTACKING_SLOTS.has(p.slotPosition)) return target
  const lineX = secondLastOpponentX(state, p.teamId)
  if (!Number.isFinite(lineX)) return target
  const local = worldToLocal(state, p.teamId, target)
  // His ceiling is the line as he last saw it, not as it is. A defender who has
  // stepped up is behind the picture in his head for about half a second, and
  // that is the half-second in which he is offside without knowing it.
  const seen = state.lineSeenX?.[p.teamId]
  const perceivedX = Number.isFinite(seen) ? seen : lineX
  const lineLocal = worldToLocal(state, p.teamId, { x: perceivedX, y: 34 }).x
  // Behind the line: stand on his shoulder. Tuned per player so the front
  // three form a staggered queue rather than one flat line.
  // A staggered queue, not a flat wall: the deepest man sits on the shoulder,
  // the others hang two to five metres behind him at different depths.
  const shoulder = 0.4 + hashUnit(p.id) * 3.6
  const passTravelling = (state.ball.kind === 'pass' || state.ball.kind === 'cross' || state.ball.kind === 'shot')
    && (state.ball.passTeamId === p.teamId || state.ball.lastTouchTeamId === p.teamId)
  const sentOnRun = p.runUntil > state.clockSeconds
  // Who is allowed beyond the line, and by how much. This used to hand every
  // forward eight metres of licence the moment any team-mate passed the ball,
  // so the whole front line drifted offside together on every pass and the
  // side was caught 23 times a match. The licence belongs to the man who has
  // actually been sent, and to nobody else: a timed run means the runner goes
  // and the rest hold the shoulder.
  // Only the man the ball is actually going to may run beyond the line: the
  // pass is already away, so he is onside when he receives it. Everyone else —
  // including everybody else on the front line while the ball is in flight —
  // holds the shoulder. Handing the whole line three metres of drift on every
  // pass was how the side kept getting caught: they crept beyond the line
  // during one pass, and the next pass to them was offside.
  const intended = passTravelling && state.ball.intendedReceiverId === p.id
  const allowance = intended ? 10 : sentOnRun ? 6 : 0
  // He holds his shoulder, and now and then he goes a stride early. The gamble
  // is capped at the referee's allowance so the pass to him stays playable.
  // The cap is on where he may end up (a stride past the line, inside the
  // referee's allowance), not on how far he may travel: capping the travel
  // instead meant only the man already standing on the shoulder could ever
  // gamble, and the whole front line was structurally incapable of mistiming a
  // run. Midfielders hanging two metres back are exactly who gets caught.
  const gamble = intended || sentOnRun ? 0 : lineGambleM(state, p)
  const limit = Math.min(
    lineLocal - shoulder + allowance + gamble,
    lineLocal + OFFSIDE_MARGIN_M * 0.85,
  )
  if (local.x > limit) {
    const overshoot = local.x - limit
    // A man already beyond the line curves back onside rather than staying
    // offside and waiting for a flag.
    local.x = limit - Math.min(3, overshoot * 0.25)
    const world = localToWorld(state, p.teamId, local.x, local.y)
    return { x: clamp(world.x, 0.6, 104.4), y: clamp(world.y, 0.6, 67.4) }
  }
  return target
}

/**
 * Follow the shot in. When the shooting team's ball is on its way, the front
 * players move onto the rebound rather than standing and admiring it: near
 * post, far post and the edge of the box, staggered so the keeper's spill is
 * attacked from three directions.
 */
function reboundTargets(state: MatchState, shootingTeam: TeamId | null): Map<string, Vec> {
  const out = new Map<string, Vec>()
  if (!shootingTeam) return out
  // Only when the attack is actually on the edge of the box. A knock-ahead in
  // his own half is not an invitation for the front three to abandon the shape.
  if (dist(state.ball.pos, goalTarget(state, shootingTeam)) > 34) return out
  const goal = goalTarget(state, shootingTeam)
  const leftSide = state.ball.pos.y < H / 2
  const spots = [
    { x: -7.5, y: leftSide ? 30.5 : 37.5 },
    { x: -9, y: leftSide ? 37.5 : 30.5 },
    { x: -16, y: 34 },
    { x: -21, y: leftSide ? 24 : 44 },
  ]
  const dir = attackDir(state, shootingTeam)
  const candidates = onPitch(state, shootingTeam)
    .filter((p) => p.slotPosition !== 'GK' && p.id !== state.ball.lastTouchPlayerId)
    .sort((a, b) => attr(b, 'attack') + attr(b, 'response') - (attr(a, 'attack') + attr(a, 'response')))
  spots.forEach((spot, i) => {
    const player = candidates[i]
    if (!player) return
    out.set(player.id, {
      x: clamp(goal.x + dir * spot.x, 2, 103),
      y: clamp(spot.y, 3, 65),
    })
  })
  return out
}

function computeTargets(state: MatchState, inputs: Partial<Record<TeamId, PlayerInput>>) {
  if (state.phase === 'goal' && state.lastGoal) {
    // A goal is not a freeze. The scorers turn and run for the corner by the
    // flag nearest where the ball went in, the rest of the side follows him
    // in a loose wave, and the conceding team trudges back into its own half.
    const goal = state.lastGoal
    const dir = attackDir(state, goal.teamId)
    const goalEnd = dir > 0 ? W : 0
    const nearSide = goal.impactY < H / 2 ? 3.2 : H - 3.2
    for (const p of onPitch(state)) {
      p.moveUrgency = 0
      if (p.slotPosition === 'GK') {
        p.target = { x: goalEnd - dir * 4.5, y: clamp(goal.impactY, 26, 42) }
        continue
      }
      if (p.teamId === goal.teamId) {
        const seed = hashUnit(p.id)
        const isScorer = p.id === goal.scorerId
        const depth = isScorer ? 2.2 : 4.5 + seed * 9
        const along = (seed - 0.5) * (isScorer ? 5 : 22)
        p.target = {
          x: clamp(goalEnd - dir * depth, 2.5, 102.5),
          y: clamp(nearSide + along * (nearSide < H / 2 ? 1 : -1), 1.8, H - 1.8),
        }
        // The scorer leads the celebration at a sprint, his team-mates follow.
        p.moveUrgency = isScorer ? 2 : seed > 0.45 ? 1 : 0
      } else {
        // Heads down back to the halfway shape they will restart from.
        p.target = localToWorld(state, p.teamId, 30 + hashUnit(p.id) * 8, clamp(p.baseY, 6, 62))
        p.moveUrgency = 0
      }
    }
    return
  }
  if (state.phase === 'restart' && state.restart) {
    // A dead ball is not a frozen state. Players keep jogging into the
    // picture for this exact restart: throw-in support angles and markers,
    // free-kick triangles/walls/box runners, corner occupation, goal-kick
    // build-up or the penalty edge. On top of that everyone keeps shuffling
    // and, on set pieces, the box attackers hold deep and then break in
    // timed waves — nobody snaps to a spot and stops.
    const restart = state.restart
    const assignments = restart.type === 'kickoff' ? new Map<string, Vec>() : restartAssignments(state)
    const takerSpot = restartStandPoint(state, restart.type, restart.teamId, restart.x, restart.y)
    for (const p of onPitch(state)) {
      p.moveUrgency = 0
      if (p.id === restart.takerId) {
        p.target = restart.type === 'kickoff'
          ? { x: W / 2 - attackDir(state, restart.teamId) * 1.2, y: H / 2 }
          : restartTakerTarget(state, restart, takerSpot)
        // Approaching the BallState to restart play is a real sprint, not a jog.
        p.moveUrgency = dist(p.pos, state.ball.pos) > 3 ? 2 : restart.type === 'kickoff' ? 0 : 1
      } else if (restart.type === 'kickoff') {
        p.target = { ...p.target }
      } else {
        const assignment = assignments.get(p.id)
        const spot = assignment ?? anchorFor(state, p)
        const attacking = p.teamId === restart.teamId
        let target = spot
        if (attacking && (restart.type === 'corner' || restart.type === 'freekick' || restart.type === 'penalty')) {
          const run = setPieceRunTarget(state, restart, p, spot)
          target = run.target
          if (run.sprint) p.moveUrgency = 2
        } else if (attacking && restart.type === 'throw' && restart.quick) {
          // Fast throw: the support runners break up the line with the ball.
          p.moveUrgency = 1
        }
        // A dead ball near our box is a cross waiting to happen. Real sides
        // drop everybody who is not on the halfway line into the box: the
        // back four pick up the men on the posts, the midfield fills the
        // edge of the six-yard box, and the near-post zone gets a body. This
        // applies to throws as well as free kicks - a long throw into the
        // box is the same problem.
        if (!attacking && (restart.type === 'throw' || restart.type === 'freekick' || restart.type === 'offside' || restart.type === 'corner')) {
          const blockSpot = setPieceDefenceSpot(state, restart, p)
          if (blockSpot) {
            // A marking assignment on a man already in the box is kept; the
            // block only repositions the players who were left marking space.
            const inTheirBox = (v: { x: number; y: number }) => {
              const l = worldToLocal(state, p.teamId, v)
              return l.x < 17 && Math.abs(l.y - 34) < 20
            }
            if (!assignment || !inTheirBox(target)) target = blockSpot
          }
        }
        const amplitude = assignment ? (attacking ? 0.75 : 0.55) : 0.85
        const shuffle = restartShuffle(hashUnit(p.id), restart.timer, amplitude)
        let setSpot = { x: clamp(target.x + shuffle.x, 0.5, 104.5), y: clamp(target.y + shuffle.y, 0.5, 67.5) }
        // Leave the taker room to breathe. The Law gives opponents 9.15 m at a
        // free kick; everyone else gets a working ring so the ball can be
        // played through the set-up instead of into a crowd of bodies.
        const legalRing = restart.type === 'freekick' || restart.type === 'offside'
        const clearance = attacking ? (legalRing ? 2.6 : 1.5) : (legalRing ? 9.15 : 2.6)
        const gap = dist(setSpot, state.ball.pos)
        if (gap < clearance) {
          // Nobody ambles out of the taker's space: they back away briskly.
          p.moveUrgency = Math.max(p.moveUrgency, 1)
          const outward = gap > 0.05 ? norm(sub(setSpot, state.ball.pos)) : norm(sub(ownGoal(state, p.teamId), state.ball.pos))
          setSpot = {
            x: clamp(state.ball.pos.x + outward.x * clearance, 0.5, 104.5),
            y: clamp(state.ball.pos.y + outward.y * clearance, 0.5, 67.5),
          }
        }
        p.target = setSpot
      }
    }
    return
  }
  const owner = byId(state, state.ball.ownerId)
  const looseAssignments = looseBallAssignments(state)
  const breakaway = owner ? breakawayContext(state, owner) : null
  // Shared per-frame maps: the attacking shape once the ball reaches the
  // final third, and the shot-blocking corridor for the defending side.
  const ownerLocalX = owner ? worldToLocal(state, owner.teamId, owner.pos).x : 0
  const chanceShape = owner && ownerLocalX > 70 && !breakaway?.inBehind ? chanceCreationShape(state, owner) : null
  const blockLines = owner ? shotBlockTargets(state, owner) : null
  // Follow the play in: while a shot is on its way, or while our own man is
  // pushing the BallState forward on his own, the front players attack the
  // rebound instead of admiring the effort from midfield.
  const followUp = state.ball.kind === 'shot'
    ? reboundTargets(state, state.ball.lastTouchTeamId)
    : !owner && state.ball.kind === 'loose' && state.ball.intendedReceiverId
      ? reboundTargets(state, byId(state, state.ball.intendedReceiverId)?.teamId ?? null)
      : null
  const lineBreached = owner ? backlineBreached(state, other(owner.teamId), owner) : false
  const breakSupportRank = new Map<string, number>()
  if (breakaway?.inBehind) {
    breakaway.supportRunners.slice(0, 2).forEach((runner, i) => breakSupportRank.set(runner.id, i))
  }
  // A keeper with it in his hands is not a carrier to be pressed: he walks to
  // the edge of his box and holds while his own side climbs back into shape
  // and the opposition drops into theirs.
  const gkHolding = Boolean(owner && owner.slotPosition === 'GK' && owner.holdUntil > state.halfElapsed)
  for (const p of onPitch(state)) {
    p.moveUrgency = 0
    let target = anchorFor(state, p)
    if (gkHolding && owner) {
      if (p.id === owner.id) {
        const holdLocal = { x: 5.6, y: clamp(worldToLocal(state, p.teamId, p.pos).y + (34 - worldToLocal(state, p.teamId, p.pos).y) * 0.35, 26, 42) }
        target = localToWorld(state, p.teamId, holdLocal.x, holdLocal.y)
        p.target = target
        continue
      }
      if (p.teamId === owner.teamId) {
        // His own team walks into its build-up picture, ready for the throw out.
        p.target = anchorFor(state, p)
        continue
      }
      // Opposition: fall back, re-form the block, one man stays half-hearted
      // goal-side to stop a quick throw down the middle.
      const nearest = onPitch(state, p.teamId)
        .filter((d) => d.slotPosition !== 'GK')
        .sort((a, b) => dist(a.pos, owner.pos) - dist(b.pos, owner.pos))[0]
      if (nearest && nearest.id === p.id) {
        target = add(owner.pos, mul(norm(sub(ownGoal(state, p.teamId), owner.pos)), 5.5))
        p.moveUrgency = 1
      } else {
        target = anchorFor(state, p)
      }
      p.target = { x: clamp(target.x, 0.5, 104.5), y: clamp(target.y, 0.5, 67.5) }
      continue
    }
    // A keeper with the ball at his feet is the start of the build-up: the
    // centre-backs split wide and drop level with the box, the full-backs
    // push up into the pivot line, and the midfield shows for it. Nobody
    // leaves him standing over it on his own.
    if (owner && owner.slotPosition === 'GK' && p.teamId === owner.teamId && p.id !== owner.id) {
      const local = worldToLocal(state, owner.teamId, p.pos)
      if (worldToLocal(state, owner.teamId, owner.pos).x < 26) {
        if (['LCB', 'CB', 'RCB'].includes(p.slotPosition)) {
          const spread = p.baseY < 34 ? 22 : 46
          target = localToWorld(state, owner.teamId, 15 + (p.slotPosition === 'CB' ? 2.5 : 0), spread)
        } else if (['LB', 'LWB'].includes(p.slotPosition)) {
          target = localToWorld(state, owner.teamId, 34, 9)
        } else if (['RB', 'RWB'].includes(p.slotPosition)) {
          target = localToWorld(state, owner.teamId, 34, 59)
        } else if (['DM', 'LDM', 'RDM'].includes(p.slotPosition)) {
          target = localToWorld(state, owner.teamId, 26, clamp(local.y, 26, 42))
        }
        p.target = { x: clamp(target.x, 0.5, 104.5), y: clamp(target.y, 0.5, 67.5) }
        continue
      }
    }
    if (owner && owner.id === p.id && !state.config.humanTeams.includes(p.teamId)) {
      target = dribbleTarget(state, p)
    } else if (owner && owner.teamId === p.teamId) {
      // Make a passing angle: step away from the nearest marker when close to the ball.
      if (dist(p.pos, owner.pos) < 28) {
        const marker = nearestOpponent(state, p)
        if (marker) target = add(target, mul(norm(sub(target, marker.pos)), 2.4))
      }
      if (['ST', 'LST', 'RST', 'LW', 'RW'].includes(p.slotPosition)) {
        const local = worldToLocal(state, p.teamId, target)
        local.x = Math.min(96, local.x + 4 + attr(p, 'aggression') / 18)
        target = localToWorld(state, p.teamId, local.x, local.y)
      }
      const supportRank = breakSupportRank.get(p.id)
      const shapeSpot = chanceShape?.get(p.id)
      if (supportRank !== undefined && breakaway) {
        const ownerLocal = breakaway.local
        const local = supportRank === 0
          ? { x: Math.min(97, ownerLocal.x + 12), y: ownerLocal.y < 34 ? 40 : 28 }
          : { x: Math.min(90, ownerLocal.x + 6), y: 34 }
        target = localToWorld(state, p.teamId, local.x, local.y)
        p.moveUrgency = 1
      } else if (shapeSpot) {
        // Spread for the tap-in, the cutback and the pass-and-shoot.
        target = shapeSpot.target
        p.moveUrgency = Math.max(p.moveUrgency, shapeSpot.urgency)
      }
    } else if (owner && owner.teamId !== p.teamId && p.slotPosition !== 'GK') {
      const defenders = onPitch(state, p.teamId)
        .filter((d) => d.slotPosition !== 'GK')
        .sort((a, b) => dist(a.pos, owner.pos) - dist(b.pos, owner.pos))
      const pressRank = defenders.findIndex((d) => d.id === p.id)
      const pressIntensity = planFor(state, p.teamId).sliders.pressing * difficultyParams(state, p.teamId).press
        * roleProfile(planFor(state, p.teamId).slots.find((s) => s.slotId === p.slotId)?.role as RoleId | undefined, p.slotPosition).press
      const mode = defensiveMode(state, p.teamId, owner)
      const ballLocal = worldToLocal(state, p.teamId, owner.pos)
      const carrierDistance = dist(p.pos, owner.pos)
      // How many players are allowed to leave the shape and hunt the ball.
      // This is the most visible thing the pressing dial does: one man
      // contains, a pressing side sends two, an all-out press sends three.
      const hunting = mode === 'press'
        ? (planFor(state, p.teamId).sliders.pressing >= 92 ? 3 : 2)
        : mode === 'contain'
          ? (planFor(state, p.teamId).sliders.pressing >= 65 ? 2 : 1)
          : 1
      const markingSettings = gameplayFor(state, p.teamId)
      const eliteCarrier = attr(owner, 'dribbleAccuracy') >= 88 || attr(owner, 'dribbleSpeed') >= 90
      // Pressing appetite tightens the distance the first defender stands off
      // by: a side told to press gets on the ball-carrier's toes, a side told
      // to sit off gives him two metres.
      const pressTightness = clamp((planFor(state, p.teamId).sliders.pressing - 50) / 60, -0.5, 0.7)
      const markingStandOff = clamp(
        1.65 - (markingSettings.marking - 50) * 0.012 - pressTightness
          + (eliteCarrier && mode !== 'press' ? 0.35 : 0),
        0.8,
        2.9,
      )
      // Inside shooting range there is no such thing as a comfortable
      // stand-off: somebody has to be in front of the BallState. Nobody is
      // allowed to let a man line up a shot from 18 metres.
      const inShootingRange = dist(owner.pos, ownGoal(state, p.teamId)) < 30
      const closestShouldPress = mode === 'press'
        || (mode === 'contain' && (carrierDistance < 11 || ballLocal.x < 35))
        || (mode === 'drop' && carrierDistance < 7)
        || (inShootingRange && carrierDistance < 11)
      if (oneOnOneChaser(state, p, owner) && duelShouldCommit(state, p, owner)) {
        // Take him on. Full tilt to a point in front of his run, not a
        // hopeful chase from behind — this is the tackle that ends the break.
        const own = ownGoal(state, p.teamId)
        const closing = clamp(dist(p.pos, owner.pos) / 14, 0.05, 1)
        const predicted = add(owner.pos, mul(owner.vel, 0.22 + closing * 0.85))
        target = add(predicted, mul(norm(sub(own, predicted)), 0.9))
        p.moveUrgency = 3
      } else if (lineBreached) {
        // The line is gone. Do not hold it, do not mark hopefully: sprint
        // back, first man delays the carrier, the rest cover the goal.
        target = recoverySpot(state, p.teamId, owner, pressRank)
        p.moveUrgency = 2
      } else if (pressRank === 0 && closestShouldPress) {
        const predicted = add(owner.pos, mul(owner.vel, 0.25))
        const goal = ownGoal(state, p.teamId)
        // The closest outfield player presses. Stand goal-side at tackling
        // distance instead of targeting the carrier's centre every frame;
        // centre-targeting plus separation physically shoved the carrier.
        target = add(predicted, mul(norm(sub(goal, predicted)), markingStandOff))
        if (mode === 'press' || inShootingRange) p.moveUrgency = carrierDistance < 7 ? 2 : 1
      } else if (pressRank > 0 && pressRank < hunting) {
        const goal = ownGoal(state, p.teamId)
        const pivot = onPitch(state, owner.teamId)
          .filter((o) => o.id !== owner.id && ['DM', 'LDM', 'RDM', 'LCM', 'CM', 'RCM', 'CAM'].includes(o.slotPosition))
          .sort((a, b) => (Math.abs(a.pos.y - 34) + dist(a.pos, owner.pos) * 0.12) - (Math.abs(b.pos.y - 34) + dist(b.pos, owner.pos) * 0.12))[0]
        target = pivot
          ? add({ x: (owner.pos.x + pivot.pos.x) / 2, y: (owner.pos.y + pivot.pos.y) / 2 }, mul(norm(sub(goal, owner.pos)), 1.1))
          : add(owner.pos, mul(norm(sub(goal, owner.pos)), 4.2))
      } else if (mode === 'drop' && ['LB', 'LCB', 'CB', 'RCB', 'RB'].includes(p.slotPosition)) {
        // Keep the synchronized anchor line. Individual nearest-man marking
        // overrides for each defender staggered the line by several metres
        // and made the offside trap fictional rather than functional.
      } else {
        const nearestOpp = onPitch(state, owner.teamId)
          .filter((o) => o.id !== owner.id)
          .sort((a, b) => dist(a.pos, target) - dist(b.pos, target))[0]
        const highThirdTrapSupport = mode === 'press'
          && pressRank === 2
          && worldToLocal(state, p.teamId, owner.pos).x > 56
          && pressIntensity > 62
        const markingRange = 13 + (markingSettings.marking - 50) * 0.06
        if (nearestOpp && (highThirdTrapSupport || dist(nearestOpp.pos, target) < markingRange)) {
          const goal = ownGoal(state, p.teamId)
          const markingDistance = clamp(2.2 - (markingSettings.marking - 50) * 0.015, 1.2, 3.2)
          target = add(nearestOpp.pos, mul(norm(sub(goal, nearestOpp.pos)), highThirdTrapSupport ? 3.1 : markingDistance))
          if (highThirdTrapSupport) p.moveUrgency = 1
        }
      }
    } else if (!owner && state.phase === 'play') {
      const intercept = looseBallIntercept(state, p)
      const predictedLanding = predictedBallPosition(state, state.ball.z > 0.3 ? 0.62 : 0.28)
      // A cross into the box is attacked, not watched. The men arriving in the
      // area go for the ball's landing point instead of standing on the spot
      // they were assigned: that is what makes a delivery a chance rather than
      // a defensive header. Defenders keep their zones and their men — which is
      // exactly why the attacker who moves first gets there.
      if (state.ball.kind === 'cross' && state.ball.passTeamId === p.teamId
        && ['ST', 'LST', 'RST', 'LW', 'RW', 'CAM', 'LCM', 'RCM', 'CM', 'LM', 'RM'].includes(p.slotPosition)
        && worldToLocal(state, p.teamId, predictedLanding).x > 78) {
        target = predictedLanding
        p.moveUrgency = 2
      } else if (state.ball.intendedReceiverId === p.id) {
        target = intercept.point
        p.moveUrgency = 2
      } else {
        const assignment = looseAssignments.get(p.id)
        if (assignment) {
          target = assignment.point
          p.moveUrgency = assignment.rank
          // Two men going for the same ball must not converge on the same
          // pixel: the slower chaser holds off a yard and a half so he arrives
          // as cover instead of shoving the favourite off it.
          if (assignment.rank === 1) {
            const closeBy = onPitch(state, p.teamId).filter((t) => t.id !== p.id
              && looseAssignments.has(t.id)
              && dist(t.pos, assignment.point) < dist(p.pos, assignment.point))
            if (closeBy.length) {
              const away = norm(sub(p.pos, assignment.point))
              target = add(assignment.point, mul(away, 1.6))
            }
          }
        } else if (state.ball.kind === 'loose' && dist(p.pos, state.ball.pos) < 7) {
          // No formal assignment, but he is close enough that standing still
          // would look wrong: break on the BallState at full urgency.
          target = intercept.point
          p.moveUrgency = 2
        } else if (state.ball.kind === 'cross' && dist(p.pos, predictedLanding) < 13) {
          target = predictedLanding
          p.moveUrgency = 1
        } else if ((state.ball.kind === 'pass' || state.ball.kind === 'cross')) {
          const possessionTeam = state.ball.passTeamId ?? state.ball.lastTouchTeamId
          const synchronizedBackLine = ['LB', 'LCB', 'CB', 'RCB', 'RB', 'LWB', 'RWB'].includes(p.slotPosition)
          if (p.teamId !== possessionTeam && !synchronizedBackLine) {
            const nearestOpp = onPitch(state, possessionTeam)
              .filter((o) => o.id !== state.ball.lastTouchPlayerId)
              .sort((a, b) => dist(a.pos, target) - dist(b.pos, target))[0]
            const settings = gameplayFor(state, p.teamId)
            if (nearestOpp && dist(nearestOpp.pos, target) < 13 + (settings.marking - 50) * 0.06) {
              const markingDistance = clamp(2.1 - (settings.marking - 50) * 0.015, 1.2, 3.1)
              target = add(nearestOpp.pos, mul(norm(sub(ownGoal(state, p.teamId), nearestOpp.pos)), markingDistance))
            }
          }
        }
      }
    }
    if (p.slotPosition === 'GK' && p.gkRushUntil > state.clockSeconds) {
      target = { ...state.ball.pos }
      p.moveUrgency = 2
    }
    if (p.slotPosition === 'GK' && !owner && state.ball.kind === 'shot') {
      const goal = ownGoal(state, p.teamId)
      const headingToGoal = (goal.x === 0 && state.ball.vel.x < -2) || (goal.x === W && state.ball.vel.x > 2)
      if (headingToGoal) {
        // A keeper has time to take a step out and narrow the angle on a
        // long-range strike. Do not force him back to the goal line; that
        // retreat made distance shots artificially easy to place past him.
        const shotDistance = state.ball.shotDistance || dist(state.ball.shotOrigin ?? state.ball.pos, goal)
        const desiredDepth = clamp(1.15 + Math.max(0, shotDistance - 16) * 0.055, 1.15, 2.9)
        const currentDepth = goal.x === 0 ? p.pos.x : W - p.pos.x
        const depth = clamp(Math.max(currentDepth, desiredDepth), 1, 4.4)
        const lineX = goal.x === 0 ? depth : W - depth
        const t = (lineX - state.ball.pos.x) / state.ball.vel.x
        // The keeper is not psychic: he needs a beat to pick up the strike
        // before his feet start moving. Without it he covered the whole goal
        // from six metres and close-range shots were saved almost every time.
        const reaction = clamp(0.16 - attr(p, 'response') / 900, 0.085, 0.17)
        if (t > 0 && state.ball.age >= reaction) {
          const projected = clamp(state.ball.pos.y + state.ball.vel.y * t, 28.5, 39.5)
          // On a tight angle he covers the near post first, exactly like a
          // real keeper, and makes the shooter beat him on the far side.
          const shooterOnPitch = state.ball.shotOrigin
          if (shooterOnPitch) {
            const dx = Math.abs(goal.x - shooterOnPitch.x)
            const span = Math.abs(Math.atan2(H / 2 - 3.66 - shooterOnPitch.y, Math.max(0.8, dx))
              - Math.atan2(H / 2 + 3.66 - shooterOnPitch.y, Math.max(0.8, dx)))
            const tightness = clamp((0.3 - span) / 0.3, 0, 1)
            const nearPost = goal.x === 0
              ? (shooterOnPitch.y < H / 2 ? H / 2 - 3.66 : H / 2 + 3.66)
              : (shooterOnPitch.y < H / 2 ? H / 2 - 3.66 : H / 2 + 3.66)
            const cover = nearPost + Math.sign(H / 2 - nearPost) * 0.55
            target = { x: lineX, y: clamp(projected + (cover - projected) * tightness * 0.8, 28.5, 39.5) }
          } else {
            target = { x: lineX, y: projected }
          }
          p.moveUrgency = 2
        }
      }
    }
    if (p.slotPosition === 'GK' && !owner && state.phase === 'play'
      && worldToLocal(state, p.teamId, state.ball.pos).x < 20
      && Math.hypot(state.ball.vel.x, state.ball.vel.y) < 3.5
      && dist(p.pos, state.ball.pos) < 22) {
      // A ball that has died in his own box is the keeper's to collect. Without
      // this he stood on his line watching a dead ball four metres away, and
      // play stopped until the anti-stall shook it loose.
      target = { ...state.ball.pos }
      p.moveUrgency = 2
    }
    if (p.slotPosition === 'GK' && !owner && state.ball.kind === 'cross') {
      const landing = predictedBallPosition(state, 0.62)
      if (worldToLocal(state, p.teamId, landing).x < 15) {
        target = landing
        p.moveUrgency = 2
      }
    }
    const followSpot = followUp?.get(p.id)
    if (followSpot && !owner && state.phase === 'play') {
      target = followSpot
      p.moveUrgency = Math.max(p.moveUrgency, 1)
    }
    const blockLine = blockLines?.get(p.id)
    if (blockLine && !lineBreached && p.teamId !== owner?.teamId && p.slotPosition !== 'GK') {
      // Get a body in the way of the shot, on the carrier-to-goal line.
      target = blockLine
      p.moveUrgency = 2
    }
    if (!owner && state.phase === 'play' && state.ball.kind === 'shot' && p.teamId !== state.ball.lastTouchTeamId) {
      // The shot is away: solve the intercept and throw yourself across it
      // rather than watch it pass. This is the dive that gets a leg in front
      // of a BallState already heading for the goal.
      const intercept = looseBallIntercept(state, p)
      if (intercept.time < 1.05 && dist(p.pos, intercept.point) < 16) {
        target = intercept.point
        p.moveUrgency = 2
      }
    }
    if (p.slotPosition === 'GK' && owner && owner.teamId !== p.teamId && breakaway?.inBehind) {
      const goal = ownGoal(state, p.teamId)
      const distanceToGoal = dist(owner.pos, goal)
      if (distanceToGoal < 34) {
        const depth = clamp(distanceToGoal * 0.28, 3, 9.5)
        target = add(goal, mul(norm(sub(owner.pos, goal)), depth))
        p.moveUrgency = Math.max(p.moveUrgency, 1)
      }
    }
    // Time the run off the last defender rather than through him — but only
    // while the attack is still being built. Once the carrier is in the final
    // third the front men commit to the box: the defence is scrambling by then
    // and holding a rigid line there would leave the box empty.
    const committing = ownerLocalX > 72 || state.ball.kind === 'cross' || state.ball.kind === 'shot'
    if (!committing && p.id !== state.ball.intendedReceiverId && p.slotPosition !== 'GK') {
      target = holdAttackingLine(state, p, target)
    }
    p.target = { x: clamp(target.x, 0.5, 104.5), y: clamp(target.y, 0.5, 67.5) }
  }
  // ---------------------------------------------------------------------
  // Block geometry. Every branch above answers a local question — where should
  // this role stand relative to the ball — and none of them knows how long or
  // how wide the unit ends up. That is how ten outfield players end up living
  // inside twenty-eight metres and half the pitch goes unused. Measure the
  // unit in its own frame (deepest = nearest our goal, forward = +x) and
  // stretch it from the deepest man forward to the length and width the phase
  // asks for. The last defender holds his ground; everyone in front of him
  // pushes up, which is what covers the pitch without abandoning the space
  // behind.
  // ---------------------------------------------------------------------
  if (state.phase === 'play') {
    const ballOwner = byId(state, state.ball.ownerId)
    const looseCarrier = state.ball.kind === 'loose' && state.ball.intendedReceiverId
      ? byId(state, state.ball.intendedReceiverId)
      : undefined
    const possessionTeam = ballOwner?.teamId
      ?? ((state.ball.kind === 'pass' || state.ball.kind === 'cross') ? state.ball.passTeamId : null)
      ?? looseCarrier?.teamId
      ?? (state.ball.kind === 'shot' ? state.ball.lastTouchTeamId : null)
    const committingBall = worldToLocal(state, 'bracelonia', state.ball.pos).x > 72
      || state.ball.kind === 'cross' || state.ball.kind === 'shot'
    for (const teamId of ['bracelonia', 'banyarn'] as const) {
      const unit = onPitch(state, teamId).filter((p) => p.slotPosition !== 'GK')
      if (unit.length < 7) continue
      const plan = planFor(state, teamId)
      const settings = gameplayFor(state, teamId)
      const withBall = possessionTeam === teamId
      // Read both dials against the club's own defaults: an untouched plan
      // behaves the way that side always has, and moving the slider genuinely
      // lengthens or widens the side.
      const lengthDial = clamp(plan.sliders.width * 0.5 + (settings.lineLength - 50) * 0.6
        - (plan.sliders.compactness - 50) * 0.5 + (settings.lineLength - 50) * 0 + 25, 5, 95)
      const widthDial = clamp(plan.sliders.width + (settings.lineWidth - 50) * 0.4
        - (plan.sliders.compactness - 50) * 0.6, 5, 95)
      const wantedLength = (42 + lengthDial * 0.28) * (withBall ? 1.0 : 0.9)
      const wantedWidth = 32 + widthDial * 0.28
      const local = unit.map((p) => worldToLocal(state, teamId, p.target))
      const xs = local.map((v) => v.x)
      const ys = local.map((v) => v.y)
      const deepest = Math.min(...xs)
      const midY = (Math.min(...ys) + Math.max(...ys)) / 2
      const spanX = Math.max(1, Math.max(...xs) - deepest)
      const spanY = Math.max(1, Math.max(...ys) - Math.min(...ys))
      const stretchX = clamp(wantedLength / spanX, 1, 1.9)
      const stretchY = clamp(wantedWidth / spanY, 1, 1.7)
      if (stretchX <= 1.02 && stretchY <= 1.02) continue
      // Ceilings exist to stop a stretch putting a pivot on the goal line,
      // not to tell a midfielder he may not attack the edge of the box.
      const capFor = (slot: string) => ['LB', 'RB', 'LWB', 'RWB'].includes(slot) ? 94
        : ['DM', 'LDM', 'RDM'].includes(slot) ? 90
          : ['LCM', 'CM', 'RCM'].includes(slot) ? 94
            : ['CAM', 'LM', 'RM', 'LW', 'RW'].includes(slot) ? 94
              : 95
      unit.forEach((p, i) => {
        // A player with an assigned job — pressing, chasing a loose ball,
        // stepping onto a shooting lane — keeps his job. He still moves with
        // the unit a little, so a stretched side does not open a hole between
        // the men doing the work and the shape behind them.
        const v = local[i]!
        // Nobody within a dozen metres of the ball is shaping: they are in the
        // duel, and moving their target half a metre sideways is the
        // difference between winning the tackle and shadowing the runner.
        if (dist(p.pos, state.ball.pos) < 14) return
        const weight = p.moveUrgency >= 1 ? 0.35 : 1
        const sx = 1 + (stretchX - 1) * weight
        const sy = 1 + (stretchY - 1) * weight
        const stretched = {
          x: clamp(deepest + (v.x - deepest) * sx, 1.2, Math.min(103, capFor(p.slotPosition))),
          y: clamp(midY + (v.y - midY) * sy, 1.2, 66.8),
        }
        let next = localToWorld(state, teamId, stretched.x, stretched.y)
        // Stretching must not walk anybody offside or drag the far-side
        // full-back out of the covering line: the point is to cover the pitch,
        // not to abandon the space behind it.
        if (!committingBall && p.id !== state.ball.intendedReceiverId) {
          next = holdAttackingLine(state, p, next)
        }
        const centreBacks = unit.filter((t) => ['LCB', 'CB', 'RCB'].includes(t.slotPosition))
          .map((t) => worldToLocal(state, teamId, t.target).x)
          .sort((a, b) => a - b)
        if (['LB', 'RB', 'LWB', 'RWB'].includes(p.slotPosition) && centreBacks.length) {
          // The far-side full-back tucks in as a third centre-back and holds
          // the line; the one on the ball's side is the man who overlaps.
          const farSide = Math.sign(p.baseY - 34) !== Math.sign(worldToLocal(state, teamId, state.ball.pos).y - 34)
          const lineLocal = worldToLocal(state, teamId, next).x
          const capLocal = centreBacks[centreBacks.length - 1]! + 6
          const markingTheBall = dist(p.pos, state.ball.pos) < 16
          if ((!withBall || farSide) && !markingTheBall && lineLocal > capLocal) {
            next = localToWorld(state, teamId, capLocal, stretched.y)
          }
        }
        p.target = { x: clamp(next.x, 0.5, 104.5), y: clamp(next.y, 0.5, 67.5) }
      })
      if (!withBall) {
        // A back four that is not on one line is not an offside trap, it is a
        // staircase. Hold the whole line at the median of the four.
        const backFour = unit.filter((p) => ['LB', 'RB', 'LWB', 'RWB', 'LCB', 'CB', 'RCB'].includes(p.slotPosition))
        const lineX = backFour.map((p) => worldToLocal(state, teamId, p.target).x).sort((a, b) => a - b)
        if (lineX.length >= 3) {
          const median = lineX[Math.floor(lineX.length / 2)]!
          for (const p of backFour) {
            // A defender who has stepped out — to block a shot, to cover a
            // runner, or simply because he is the man closing the ball down —
            // is not part of the line this frame.
            if (p.moveUrgency >= 1) continue
            if (dist(p.pos, state.ball.pos) < 16) continue
            const l = worldToLocal(state, teamId, p.target)
            if (Math.abs(l.x - median) < 9) p.target = localToWorld(state, teamId, median, l.y)
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------
  // Do not "fix" the flat shape here by pulling the midfield back.
  //
  // Measured over 24 matches: clamping midfield targets so they can never
  // stand higher than the striker's line costs 1.2 goals a match (4.17 -> 2.96)
  // and eleven shots (14.4 -> 11.6). Clamping them a fixed eight to twelve
  // metres behind the striker costs 1.5 (4.17 -> 2.4-2.8). The reason is not
  // the arithmetic, it is the football: the midfielder arriving beyond the
  // front line *is* the second wave, and taking that away removes the cutback
  // and the late run. The flat average in the shape panel is the opponent's
  // line doing the squeezing, not our midfield misbehaving — see
  // docs/shape-and-lines.md for the measurements.
  // ---------------------------------------------------------------------

  // A ball that has stopped belongs to whoever wants it. When it has been
  // sitting still for most of a second, the two nearest players on each side
  // break for it at full pace — otherwise the fastest man in the game is the
  // one standing closest, and he does not move.
  if (state.phase === 'play' && !state.ball.ownerId && (state.ball.stalledFor ?? 0) > 0.7) {
    for (const teamId of ['bracelonia', 'banyarn'] as const) {
      onPitch(state, teamId)
        .filter((p) => p.slotPosition !== 'GK')
        .sort((a, b) => dist(a.pos, state.ball.pos) - dist(b.pos, state.ball.pos))
        .slice(0, 2)
        .forEach((p, index) => {
          p.target = {
            x: clamp(state.ball.pos.x + (index === 0 ? 0 : 1.6), 0.6, 104.4),
            y: clamp(state.ball.pos.y + (index === 0 ? 0 : -1.6), 0.6, 67.4),
          }
          p.moveUrgency = 2
        })
    }
  }

  // Human second-man contain: Square/K held sends the nearest non-controlled
  // team-mate to a goal-side contain position without tackling automatically.
  for (const teamId of state.config.humanTeams) {
    const input = inputs[teamId]
    const controlled = byId(state, state.controlled[teamId])
    if (input?.shootHeld && owner && owner.teamId !== teamId && controlled) {
      const helper = onPitch(state, teamId).filter((p) => p.id !== controlled.id && p.slotPosition !== 'GK').sort((a, b) => dist(a.pos, owner.pos) - dist(b.pos, owner.pos))[0]
      if (helper) {
        helper.target = add(owner.pos, mul(norm(sub(ownGoal(state, teamId), owner.pos)), 3.6))
        helper.moveUrgency = 1
      }
    }
  }
}

function movePlayers(state: MatchState, inputs: Partial<Record<TeamId, PlayerInput>>, dt: number) {
  const owner = byId(state, state.ball.ownerId)
  for (const p of onPitch(state)) {
    const human = state.config.humanTeams.includes(p.teamId)
    const controlled = human && state.controlled[p.teamId] === p.id
    const input = inputs[p.teamId] ?? NEUTRAL_INPUT
    const urgency = p.moveUrgency
    let desired: Vec
    let sprint = false
    if (controlled && state.phase === 'play') {
      const move = len(input.move) > 1 ? norm(input.move) : input.move
      sprint = input.sprint
      const superCancel = input.sprint && input.close
      const isIntendedReceiver = !owner
        && state.ball.intendedReceiverId === p.id
        && (state.ball.kind === 'pass' || state.ball.kind === 'cross')
      const contestingLooseBall = !owner
        && urgency > 0
        && (state.ball.kind === 'loose' || !state.ball.intendedReceiverId)
      if ((isIntendedReceiver || contestingLooseBall) && !superCancel) {
        // Football-game receiver/loose-BallState lock-on: after a pass, control
        // switches to the receiver immediately; after a deflection it may
        // already sit with the nearest recovery runner. Without assistance,
        // simply holding a run direction makes that player sprint away from
        // the BallState (the reported Raphinha problem). Blend steering with a
        // strong seek toward the predicted intercept point. Shift+E /
        // R1+R2 remains the deliberate super-cancel.
        const intercept = isIntendedReceiver || urgency >= 2 ? looseBallIntercept(state, p).point : p.target
        const toIntercept = sub(intercept, p.pos)
        const seek = norm(toIntercept)
        const blended = norm(add(mul(seek, 0.86), mul(move, 0.42)))
        sprint = sprint || len(toIntercept) > 2.4
        const speed = maxSpeed(state, p, sprint, false, true) * clamp(len(toIntercept) / 1.25, 0.58, 1)
        desired = mul(blended, speed)
        turnFacing(p, blended, 0.55)
      } else if (!superCancel && owner && owner.teamId !== p.teamId && input.tackleHeld) {
        // Holding J/Cross is pressure, not an instant tackle. The controlled
        // defender closes to a goal-side position while the charge builds;
        // releasing the button commits to the tackle at that intensity.
        const predicted = add(owner.pos, mul(owner.vel, 0.22))
        const pressurePoint = add(predicted, mul(norm(sub(ownGoal(state, p.teamId), predicted)), 1.45))
        const toPressure = sub(pressurePoint, p.pos)
        const blended = norm(add(mul(norm(toPressure), 0.58), mul(move, 0.5)))
        sprint = sprint || len(toPressure) > 3
        const speed = maxSpeed(state, p, sprint, false, true) * clamp(len(toPressure) / 1.8, 0.35, 1) * (input.close ? 0.62 : 1)
        desired = mul(blended, speed)
        turnFacing(p, blended, 0.55)
      } else {
        const speed = maxSpeed(state, p, sprint, owner?.id === p.id) * (input.close ? 0.55 : 1)
        desired = len(move) > 0.08
          ? mul(move, speed)
          : (owner?.id === p.id && p.touchTimer > 0 ? mul(p.vel, 0.72) : { x: 0, y: 0 })
        // Carrying the ball costs turning speed; sprinting to close down does not.
        if (len(move) > 0.08) turnFacing(p, move, owner?.id === p.id ? carrierTurnRate(p) : 0.65)
      }
    } else {
      // Keep the logical tactical target immediate, but steer through a
      // smoothed movement target. Formation/press targets can legitimately
      // change when possession or the BallState side changes; without this
      // layer every such change became a visible stop-and-reverse.
      if (!Number.isFinite(p.smoothedTarget.x) || !Number.isFinite(p.smoothedTarget.y) || dist(p.smoothedTarget, p.pos) > 32) {
        p.smoothedTarget = { ...p.target }
      } else {
        const response = urgency >= 3 ? 30 : urgency === 2 ? 24 : urgency === 1 ? 9 : state.ball.intendedReceiverId === p.id ? 14 : 5.4
        const blend = 1 - Math.exp(-response * dt)
        p.smoothedTarget = add(p.smoothedTarget, mul(sub(p.target, p.smoothedTarget), blend))
      }
      const to = sub(p.smoothedTarget, p.pos)
      const d = len(to)
      sprint = urgency > 0
        ? d > 0.65
        : d > 10 || Boolean(owner && owner.teamId !== p.teamId && dist(p.pos, owner.pos) < 9)
      // Ordinary shape movement arrives over five metres. An assigned
      // loose-BallState runner should not start cruising that early: he stays
      // near full pace until the final stride or two, then checks only
      // enough to make contact with the BallState.
      const arriveRadius = urgency >= 3 ? 1.1 : urgency === 2 ? 1.45 : urgency === 1 ? 2.35 : 5
      const runThroughBall = state.ball.intendedReceiverId === p.id || urgency >= 2
      // Shape duty is not standing still. A player eight metres out of
      // position has to jog back into it; at a twelfth of his top speed he
      // never arrives, and the side stays stuck in whatever shape the last
      // transition left it in.
      const shapeFloor = d > 10 ? 0.52 : d > 5 ? 0.38 : d > 2 ? 0.24 : 0.12
      const speedScale = clamp(
        d / arriveRadius,
        urgency >= 3 ? 0.86 : runThroughBall ? 0.58 : urgency > 0 ? 0.38 : shapeFloor,
        1,
      )
      let speed = maxSpeed(state, p, sprint, owner?.id === p.id, urgency > 0) * speedScale
      if (p.slotPosition === 'GK' && !owner && state.ball.kind === 'shot' && state.ball.age < 1.4) {
        // A keeper covering a shot is diving, not sprinting: his lateral reach
        // over the flight is a metre or so, not the four metres a sprinter
        // covers. Only Jump and Response buy him any extra ground.
        speed = Math.min(speed, (1.7 + attr(p, 'jump') / 100 * 1.5 + attr(p, 'response') / 100 * 1.2) * speedScale)
      }
      desired = mul(norm(to), speed)
      if (d > 0.4) {
        const base = owner?.id === p.id ? carrierTurnRate(p) : urgency > 0 ? 0.45 : 0.3
        turnFacing(p, to, base)
      }
    }
    const accel = (3 + attr(p, 'acceleration') * 0.045)
      * (urgency >= 3 ? 2.15 : urgency >= 2 ? 1.78 : urgency === 1 ? 1.38 : 1)
      * (0.5 + gameplayFor(state, p.teamId).acceleration / 100)
    const delta = sub(desired, p.vel)
    const maxDelta = accel * dt
    p.vel = len(delta) <= maxDelta ? desired : add(p.vel, mul(norm(delta), maxDelta))
    if (p.slideTimer > 0) {
      p.slideTimer -= dt
      p.vel = mul(p.vel, Math.max(0, 1 - dt * 2.2))
    }
    const old = { ...p.pos }
    p.pos = { x: clamp(p.pos.x + p.vel.x * dt, 0.2, 104.8), y: clamp(p.pos.y + p.vel.y * dt, 0.2, 67.8) }
    const moved = dist(old, p.pos)
    p.distance += moved
    if (dt > 0) {
      const speedNow = moved / dt
      if (speedNow > p.topSpeedMps) p.topSpeedMps = speedNow
      if (speedNow >= SPRINT_MPS) p.sprintDistance += moved
      else if (speedNow >= HIGH_INTENSITY_MPS) p.highIntensityDistance += moved
      // The same metres, attributed to the phase they were run in. Distance
      // alone cannot tell a full-back who overlapped from one who spent the
      // match shuffling across in a block; the split can.
      const ours = possessionTeamOf(state) === p.teamId
      if (ours) {
        p.distanceInPossession += moved
        if (speedNow >= SPRINT_MPS) p.sprintInPossession += moved
      } else {
        p.distanceOutOfPossession += moved
        if (speedNow >= SPRINT_MPS) p.sprintOutOfPossession += moved
      }
    }
    // Physical condition (PES 1-8, 5 neutral) sets how quickly the tank
    // empties; stamina sets how big the hit is. Both are editable.
    const conditionDrain = clamp(1 + (5 - attr(p, 'condition')) * 0.06, 0.78, 1.28)
    p.load = clamp(p.load + moved * (sprint ? 0.055 : 0.026) * (105 - attr(p, 'stamina')) / 42 * conditionDrain, 0, 100)
    p.burst = clamp(p.burst + (sprint && len(p.vel) > 5 ? -dt * 0.24 : dt * 0.16) * (attr(p, 'stamina') / 80), 0.25, 1)
    p.decisionTimer -= dt
    p.touchTimer = Math.max(0, p.touchTimer - dt)
    if (p.touchTimer === 0) p.touchDistance = 0
    p.tackleCooldown = Math.max(0, p.tackleCooldown - dt)
  }
  // Body separation uses the smaller physical body radius, not the full
  // visual circle. The previous 2.15m centre distance, combined with a
  // presser targeting the carrier's centre, repeatedly shoved the carrier
  // and looked like glitching. The carrier also braces with Balance, so he
  // takes the smaller share of any correction.
  const players = onPitch(state)
  // Two players in the same shirt-sized patch of grass is the clash everyone
  // notices. The body radius stays where the duel model expects it — pushing
  // bodies further apart than this changes who wins a tackle, not just how it
  // looks — so the visual circle is drawn smaller instead (MatchStage).
  const minDistance = 1.55
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i]!
      const b = players[j]!
      const d = dist(a.pos, b.pos)
      if (d > 0.01 && d < minDistance) {
        const direction = norm(sub(b.pos, a.pos))
        const overlap = minDistance - d
        let aShare = clamp(0.5 + (attr(b, 'balance') - attr(a, 'balance')) / 220, 0.3, 0.7)
        if (owner?.id === a.id) aShare = 0.24
        if (owner?.id === b.id) aShare = 0.76
        // A shoulder-to-shoulder tangle is resolved by leaning (small, capped
        // correction); two bodies genuinely occupying the same patch of grass
        // is not a tangle, it is an error, and it is resolved outright.
        const correction = d < 1.0
          ? Math.min(overlap * 0.9, 0.34)
          : Math.min(overlap * 0.45, 0.09)
        a.pos = sub(a.pos, mul(direction, correction * aShare))
        b.pos = add(b.pos, mul(direction, correction * (1 - aShare)))
        // Contact absorbs momentum, but a carrier rides it with his balance
        // instead of bouncing off a shoulder. Without that distinction any
        // defender who got alongside simply stopped the break dead by leaning.
        const brace = (who: RuntimePlayer) => clamp(0.38 - attr(who, 'balance') / 340, 0.10, 0.34)
        const aInward = a.vel.x * direction.x + a.vel.y * direction.y
        if (aInward > 0) a.vel = sub(a.vel, mul(direction, aInward * (owner?.id === a.id ? brace(a) : 0.38)))
        const bInward = b.vel.x * direction.x + b.vel.y * direction.y
        if (bInward < 0) b.vel = sub(b.vel, mul(direction, bInward * (owner?.id === b.id ? brace(b) : 0.38)))
      }
    }
  }
}

function switchControlled(state: MatchState, teamId: TeamId, direction?: Vec) {
  const owner = byId(state, state.ball.ownerId)
  if (owner?.teamId === teamId) {
    state.controlled[teamId] = owner.id
    return
  }
  const current = byId(state, state.controlled[teamId])
  const candidates = onPitch(state, teamId).filter((p) => p.slotPosition !== 'GK' && p.id !== current?.id)
  const next = candidates.sort((a, b) => {
    const score = (p: RuntimePlayer) => {
      let s = -dist(p.pos, state.ball.pos)
      if (current && direction && len(direction) > 0.1) {
        const v = norm(sub(p.pos, current.pos))
        s += (v.x * direction.x + v.y * direction.y) * 13
      }
      if (owner) s -= dist(p.pos, owner.pos) * 0.35
      return s
    }
    return score(b) - score(a)
  })[0]
  if (next) state.controlled[teamId] = next.id
}

function sendRun(state: MatchState, teamId: TeamId, direction: Vec) {
  const owner = byId(state, state.ball.ownerId)
  const source = owner?.teamId === teamId ? owner : byId(state, state.controlled[teamId])
  if (!source) return
  const runner = onPitch(state, teamId)
    .filter((p) => p.id !== source.id && p.slotPosition !== 'GK')
    .sort((a, b) => {
      const score = (p: RuntimePlayer) => {
        const v = norm(sub(p.pos, source.pos))
        return (v.x * direction.x + v.y * direction.y) * 20 - dist(p.pos, source.pos) * 0.25 + attr(p, 'aggression') / 12
      }
      return score(b) - score(a)
    })[0]
  if (runner) runner.runUntil = state.clockSeconds + 3.2
}

function promisingAttackScore(state: MatchState, offender: RuntimePlayer, victim: RuntimePlayer): { score: number; defendersBehind: number; attackX: number } {
  const attackLocal = worldToLocal(state, victim.teamId, victim.pos)
  const victimDefensiveLocalX = worldToLocal(state, offender.teamId, victim.pos).x
  const defendersBehind = onPitch(state, offender.teamId)
    .filter((p) => p.id !== offender.id && worldToLocal(state, offender.teamId, p.pos).x < victimDefensiveLocalX - 1)
    .length
  const toGoal = norm(sub(goalTarget(state, victim.teamId), victim.pos))
  const speedTowardGoal = victim.vel.x * toGoal.x + victim.vel.y * toGoal.y
  const score = clamp((attackLocal.x - 38) / 48, 0, 1) * 0.34
    + clamp((5 - defendersBehind) / 5, 0, 1) * 0.3
    + clamp(speedTowardGoal / 7, 0, 1) * 0.2
    + (Math.abs(victim.pos.y - 34) < 16 ? 0.1 : 0.03)
    + (opponentDistance(state, victim.pos, victim.teamId) > 4 ? 0.06 : 0)
  return { score: clamp(score, 0, 1), defendersBehind, attackX: attackLocal.x }
}

function aiTackleIntensity(state: MatchState, defender: RuntimePlayer, carrier: RuntimePlayer, slide: boolean): number {
  const settings = gameplayFor(state, defender.teamId)
  const plan = planFor(state, defender.teamId)
  const defensiveLocalX = worldToLocal(state, defender.teamId, carrier.pos).x
  const minute = state.clockSeconds / 60
  const losing = state.score[defender.teamId] < state.score[other(defender.teamId)]
  const promise = promisingAttackScore(state, defender, carrier).score
  return clamp(
    0.18 + attr(defender, 'aggression') / 520 + plan.sliders.pressing / 750
      + (settings.tackleAggression - 50) / 320
      + (defensiveLocalX < 35 ? 0.08 : 0)
      + (promise > 0.62 ? 0.06 : 0)
      + (minute > 68 && losing ? 0.07 : 0)
      + (slide ? 0.16 : 0),
    0.12,
    0.9,
  )
}

function tackleAttempt(state: MatchState, defender: RuntimePlayer, slide: boolean, intensityInput = 0.45): boolean {
  const carrier = byId(state, state.ball.ownerId)
  if (!carrier || carrier.teamId === defender.teamId || defender.tackleCooldown > 0) return false
  const settings = gameplayFor(state, defender.teamId)
  const intensity = clamp(intensityInput * (0.82 + settings.tackleAggression / 280), 0.05, 1)
  const d = dist(defender.pos, carrier.pos)
  const reach = slide ? 2.85 + intensity * 1.25 : 2.05 + intensity * 0.8
  if (d > reach) return false
  defender.tackleCooldown = 0.42 + intensity * 0.58 + (slide ? 0.32 : 0)
  if (slide) {
    defender.slideTimer = 0.32 + intensity * 0.28
    defender.vel = mul(norm(sub(carrier.pos, defender.pos)), maxSpeed(state, defender, true, false) * (0.82 + intensity * 0.38))
  }
  const carrierToDefender = norm(sub(defender.pos, carrier.pos))
  const behindFactor = clamp(-(carrier.facing.x * carrierToDefender.x + carrier.facing.y * carrierToDefender.y) + 0.2, 0, 1)
  const closingDirection = norm(sub(carrier.pos, defender.pos))
  const closingSpeed = Math.max(0, (defender.vel.x - carrier.vel.x) * closingDirection.x + (defender.vel.y - carrier.vel.y) * closingDirection.y)
  const attackScore = attr(defender, 'defence') * 0.55 + attr(defender, 'balance') * 0.2 + attr(defender, 'response') * 0.15 + attr(defender, 'agility') * 0.1
  const carryScore = attr(carrier, 'dribbleAccuracy') * 0.45 + attr(carrier, 'balance') * 0.25 + attr(carrier, 'technique') * 0.2 + attr(carrier, 'agility') * 0.1
  const touchExposure = clamp(carrier.touchDistance / 3, 0, 1) * 0.11 + clamp(carrier.touchTimer / 0.42, 0, 1) * 0.07
  const successChance = clamp(
    0.31 + (attackScore - carryScore) / 120 + intensity * 0.13 - intensity * intensity * 0.07
      + (slide ? 0.03 : 0) + touchExposure - clamp(len(carrier.vel) / 30, 0, 0.22),
    0.06,
    0.78,
  )
  // Defending your own box is a different job from defending the halfway
  // line. A foul in the box is a penalty, so real defenders jockey, hold their
  // ground and block instead of diving in — which is why real football produces
  // about one penalty per three or four matches while this engine was giving
  // away 0.75 a match, nearly three times as many. Staying on your feet is a
  // skill, so it belongs to the defender's own defensive quality rather than
  // to a flat penalty discount.
  const inOwnBox = worldToLocal(state, defender.teamId, carrier.pos).x < 16.5
  const boxDiscretion = inOwnBox
    ? clamp(0.52 - attr(defender, 'defence') / 300, 0.16, 0.52)
    : 1
  const success = rand(state) < successChance
  if (success) {
    defender.tackles += 1
    state.stats[defender.teamId].tackles += 1
    state.ball.lastTouchTeamId = defender.teamId
    state.ball.lastTouchPlayerId = defender.id
    // A won tackle is not automatically a fair one. The gate here used to be
    // `intensity > 0.82`, which this engine never reaches: the intensity sum
    // tops out near 0.7 and typically sits at 0.4 (measured histogram of won
    // tackles: 0.3 x40, 0.4 x297, 0.5 x66, 0.6 x14, 0.7 x3, nothing above).
    // So this branch fired zero times a match for its whole life, and the
    // "won the ball but took the man" foul — one of the biggest classes of
    // foul in real football — did not exist in the game.
    //
    // What makes a won tackle a foul is not how hard the defender tried, it is
    // whether his momentum carried him through the ball and into the man. That
    // is measurable: how fast he is still closing (median 0.4 m/s at the moment
    // of the win, p90 6.1 m/s), whether he arrived from behind or the side, and
    // whether he left his feet. A defender with real defensive quality pulls
    // out of that contact; an aggressive one follows through.
    // The scale is anchored to a real closing speed rather than to an arbitrary
    // span: a defender arriving at walking pace (1.2 m/s) is under control, and
    // by about 7.7 m/s a sprinting defender has committed his weight and cannot
    // pull out. Above that he is entirely at the mercy of his momentum.
    const lateMomentum = clamp((closingSpeed - 1.2) / 6.5, 0, 1)
    const followThroughChance = clamp(
      0.025 + lateMomentum * 0.26 + behindFactor * 0.10 + (slide ? 0.05 : 0)
        + (attr(defender, 'aggression') - 65) / 900
        - (attr(defender, 'defence') - 65) / 700
        + (settings.tackleAggression - 50) / 1200,
      0,
      0.40,
    ) * boxDiscretion
    if (rand(state) < followThroughChance) {
      commitFoul(state, defender, carrier, slide, intensity, behindFactor, closingSpeed, true)
      return true
    }
    if (rand(state) < clamp(0.56 - intensity * 0.18, 0.32, 0.62)) setOwner(state, defender)
    else looseBall(state, mul(norm(sub(defender.pos, carrier.pos)), range(state, 3.2, 6.8) * (0.75 + intensity * 0.35)))
    return true
  }
  // A missed tackle is mostly a clean miss, not a foul. Open play was
  // producing a foul every twenty seconds because every failed challenge
  // rolled at up to 42% to be illegal.
  // Fouls are weighted toward challenges the defender did NOT win. A foul on a
  // failed challenge is close to goal-neutral — the attacker was keeping the
  // ball anyway — whereas a foul after the ball has been won hands possession
  // straight back in the position the defence had just escaped, creating an
  // attack that did not exist a second earlier. Getting the mix right keeps
  // the foul count honest without inflating the score (see docs/fouls.md).
  const foulChance = clamp(
    0.014 + intensity * 0.12 + (slide ? 0.07 : 0) + behindFactor * 0.06
      + closingSpeed * 0.008 + (settings.tackleAggression - 50) * 0.0010,
    0.008,
    0.26,
  ) * boxDiscretion
  if (d < 2.3 && rand(state) < foulChance) commitFoul(state, defender, carrier, slide, intensity, behindFactor, closingSpeed, false)
  return false
}

function commitFoul(
  state: MatchState,
  offender: RuntimePlayer,
  victim: RuntimePlayer,
  slide: boolean,
  intensity = 0.45,
  behindFactor = 0,
  closingSpeed = 0,
  wonBall = false,
) {
  offender.fouls += 1
  state.stats[offender.teamId].fouls += 1
  const local = worldToLocal(state, offender.teamId, victim.pos)
  const inBox = local.x < 16.5 && Math.abs(victim.pos.y - 34) < 20.16
  const promise = promisingAttackScore(state, offender, victim)
  const minute = state.clockSeconds / 60
  const totalFouls = state.stats.bracelonia.fouls + state.stats.banyarn.fouls
  const settings = matchGameplay(state)
  const physicalSeverity = clamp(
    0.04 + intensity * 0.46 + (slide ? 0.1 : 0) + behindFactor * 0.12 + clamp(closingSpeed / 45, 0, 0.1)
      + (attr(offender, 'aggression') - 65) / 220 - (attr(offender, 'defence') - 65) / 260
      + (wonBall ? -0.1 : 0) + range(state, -0.03, 0.03),
    0,
    1.1,
  )
  let cardThreshold = state.config.rules === 'arcade' ? 0.72 : state.config.rules === 'current' ? 0.57 : 0.62
  cardThreshold += (50 - settings.refereeStrictness) * 0.0025
  // Time never makes the same challenge reckless by itself. It only removes
  // a little early-match tolerance after warnings, repeated fouls and the
  // point where tactical fouls become much more valuable.
  if (minute < 12 && totalFouls < 5) cardThreshold += 0.04
  if (minute > 55) cardThreshold -= clamp((minute - 55) / 300, 0, 0.12)
  if (totalFouls > 10) cardThreshold -= 0.03

  // Persistent infringement is a caution for a player who will not stop. It is
  // not a second reason to book a man who is already on a yellow: real referees
  // reach for the second yellow on the next reckless challenge, not on the same
  // accumulation that produced the first one. Without this guard, once a player
  // reached five fouls *every* later foul re-triggered this rule and booked him
  // again immediately, which is why 6 of 7 red cards in a 20-match sample were
  // "a second caution" — about six times the real rate of second yellows.
  const persistent = offender.yellowCards === 0
    && (offender.fouls >= 5 || (offender.fouls === 4 && rand(state) < 0.3))
  const stopsPromisingAttack = !inBox && promise.score >= 0.72 && intensity >= 0.3
  // An obvious goal-scoring opportunity is a clear run at goal, not any foul
  // committed in the attacking half. At 38m this test was catching fouls from
  // well outside shooting range — 7 of the 11 red cards in a 40-match sample
  // were DOGSO dismissals, roughly three times the real rate. 26m is the edge
  // of the area, and only the keeper counts as cover: a striker with a
  // defender still goal-side of him has not been denied an *obvious*
  // opportunity, and referees do not send men off for it.
  const obviousGoalChance = promise.score >= 0.84 && promise.attackX > 70 && promise.defendersBehind === 0 && dist(victim.pos, goalTarget(state, victim.teamId)) < 26
  const seriousFoulPlay = physicalSeverity > cardThreshold + 0.36 || (intensity > 0.96 && slide && behindFactor > 0.7)
  // Denying a goalscoring opportunity is a red only for a real challenge: a
  // toe in that happens to brush a striker is not a sending-off.
  const directRed = seriousFoulPlay
    || (obviousGoalChance && intensity >= 0.5 && (!inBox || intensity >= 0.8 || behindFactor > 0.7))
  const yellow = !directRed && (physicalSeverity > cardThreshold || stopsPromisingAttack || persistent || (inBox && obviousGoalChance))
  const cardReason = directRed
    ? (seriousFoulPlay ? 'serious foul play' : 'denying an obvious goal-scoring opportunity')
    : physicalSeverity > cardThreshold
      ? 'a reckless tackle'
      : stopsPromisingAttack
        ? 'stopping a promising attack'
        : persistent
          ? 'persistent fouling'
          : 'a tactical foul'

  const sendOff = (reason: string) => {
    offender.sentOff = true
    offender.onPitch = false
    pushEvent(state, offender.teamId, offender.id, `#${offender.base.number} is sent off for ${reason}.`, 'card')
    if (state.controlled[offender.teamId] === offender.id) switchControlled(state, offender.teamId)
  }
  if (directRed) {
    sendOff(cardReason)
  } else if (yellow) {
    offender.yellowCards += 1
    pushEvent(state, offender.teamId, offender.id, `#${offender.base.number} is booked for ${cardReason}.`, 'card')
    if (offender.yellowCards >= 2) sendOff('a second caution')
  }

  if (onPitch(state, offender.teamId).length < 7) {
    state.phase = 'fulltime'
    state.restart = null
    state.message = 'Full-time — a team is below seven players'
    pushEvent(state, offender.teamId, offender.id, 'The match cannot continue with fewer than seven players.', 'info')
    return
  }

  const tolerance = victim.base.attributes.injuryTolerance
  const baseInjuryChance = state.config.rules === 'arcade' ? 0.004 : tolerance === 'A' ? 0.008 : tolerance === 'B' ? 0.016 : 0.028
  const injuryChance = baseInjuryChance
    * clamp(0.3 + physicalSeverity * 1.15, 0.25, 1.7)
    * clamp(0.2 + settings.injuryFrequency / 62.5, 0.2, 1.8)
  if (rand(state) < injuryChance) {
    victim.injured = true
    pushEvent(state, victim.teamId, victim.id, `#${victim.base.number} is carrying a knock.`, 'info')
  }
  if (inBox) setRestart(state, 'penalty', victim.teamId, victim.pos.x, victim.pos.y)
  else setRestart(state, 'freekick', victim.teamId, victim.pos.x, victim.pos.y)
}

function pushEvent(
  state: MatchState,
  teamId: TeamId | undefined,
  playerId: string | undefined,
  text: string,
  kind: MatchState['events'][number]['kind'],
  from?: MatchState['events'][number]['from'],
) {
  state.events.unshift({ minute: Math.floor(state.clockSeconds / 60), teamId, playerId, text, kind, from })
  state.events = state.events.slice(0, 40)
  state.message = text
}

/**
 * Where a goal came from. A goal inside fifteen seconds of one side's dead
 * ball, with that side still on the ball, is a set-piece goal: the corner, the
 * free kick, the long throw. Everything else is open play.
 */
function goalOrigin(state: MatchState, teamId: TeamId): MatchEvent['from'] {
  const last = state.lastRestart
  if (!last || last.teamId !== teamId) return 'open'
  // The match clock runs compressed, so the window has to be measured in real
  // seconds of play: a corner routine, a clearance and a second ball is twelve
  // to fifteen seconds of football, not two.
  const since = state.halfElapsed - last.elapsed
  if (last.type === 'penalty') return since < 6 ? 'penalty' : 'open'
  if (last.type === 'corner') return since < 10 ? 'corner' : 'open'
  if (last.type === 'freekick' || last.type === 'offside') return since < 8 ? 'freekick' : 'open'
  // A throw-in is not a set piece unless it is a long one into the box; a goal
  // kick never is, and neither is a goal inside ten seconds of kick-off.
  if (last.type === 'throw') return since < 6 ? 'throw' : 'open'
  return 'open'
}

function placeAtAnchor(state: MatchState) {
  for (const p of onPitch(state)) {
    p.pos = anchorFor(state, p)
    p.target = { ...p.pos }
    p.smoothedTarget = { ...p.pos }
    p.vel = { x: 0, y: 0 }
  }
}

function targetAtAnchor(state: MatchState) {
  // Ordinary restarts keep everyone's current position and momentum and let
  // them jog into the restart picture. Snapping all 22 players to their
  // anchors—or abruptly quartering every velocity—made throw-ins and fouls
  // look like the simulation had stopped and restarted.
  for (const p of onPitch(state)) {
    p.target = anchorFor(state, p)
  }
}

function setupKickoff(state: MatchState, teamId: TeamId) {
  state.phase = 'restart'
  state.ball.pos = { x: W / 2, y: H / 2 }
  state.ball.vel = { x: 0, y: 0 }
  state.ball.z = 0
  state.ball.vz = 0
  placeAtAnchor(state)
  const candidates = onPitch(state, teamId).filter((p) => p.slotPosition !== 'GK').sort((a, b) => dist(a.pos, state.ball.pos) - dist(b.pos, state.ball.pos))
  const taker = candidates[0]!
  const dir = attackDir(state, teamId)
  taker.pos = { x: W / 2 - dir * 1.2, y: H / 2 }
  // The old code moved only pos. target still pointed at the taker's
  // original formation anchor, so during the restart phase he immediately
  // ran away from the stationary BallState and fought body separation around
  // the centre spot until the player pressed pass.
  taker.target = { ...taker.pos }
  taker.smoothedTarget = { ...taker.pos }
  taker.vel = { x: 0, y: 0 }
  taker.facing = { x: dir, y: 0 }
  const partner = candidates.find((p) => p.id !== taker.id && dist(p.pos, state.ball.pos) < 7)
  if (partner) {
    partner.pos = { x: W / 2 - dir * 4.2, y: H / 2 + (partner.baseY >= H / 2 ? 2.6 : -2.6) }
    partner.target = { ...partner.pos }
    partner.smoothedTarget = { ...partner.pos }
    partner.vel = { x: 0, y: 0 }
    partner.facing = { x: dir, y: 0 }
  }
  state.ball.ownerId = taker.id
  state.ball.kind = 'restart'
  state.ball.lastTouchTeamId = teamId
  state.ball.lastTouchPlayerId = taker.id
  state.restart = {
    type: 'kickoff', teamId, x: W / 2, y: H / 2, takerId: taker.id, timer: 0, aim: { x: W / 2, y: H / 2 },
    setup: restartSetupSeconds(state, 'kickoff', false, teamId), quick: false, quickTargetId: null,
    arrived: true, arrivedAt: 0, buffered: null,
    autoTake: state.config.humanTeams.includes(teamId),
  }
  if (state.config.humanTeams.includes(teamId)) state.controlled[teamId] = taker.id
  state.message = state.half === 1 && state.clockSeconds === 0 ? 'Kick-off' : 'Restart'
}

function smoothstep01(t: number): number {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/** Stable 0..1 hash of an id, used for per-player stagger without touching the RNG. */
function hashUnit(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

/**
 * A dead ball is not a free kick for the defending side either: it is a few
 * seconds of jockeying, checking off a marker, pointing, walking into a
 * throw-in angle. Two incommensurate frequencies per player keep that
 * shuffle alive without ever looking like a loop or making anyone wander
 * out of shape.
 */
function restartShuffle(seed: number, time: number, amplitude: number): Vec {
  const x = Math.sin(time * 1.13 + seed * 6.283) * 0.62 + Math.sin(time * 2.27 + seed * 12.71) * 0.38
  const y = Math.sin(time * 0.87 + seed * 9.41) * 0.58 + Math.sin(time * 1.79 + seed * 3.17) * 0.42
  return { x: x * amplitude, y: y * amplitude }
}

/** How long a realistic side takes to set the picture before it releases. */
function restartSetupSeconds(state: MatchState, type: RestartType, quick: boolean, teamId?: TeamId): number {
  if (quick) return type === 'penalty' ? 1.1 : type === 'freekick' || type === 'offside' ? 0.4 : 0.44
  const jitter = range(state, 0, 1)
  if (type === 'kickoff') return 0.6
  const squad = teamId ? onPitch(state, teamId).filter((p) => p.slotPosition !== 'GK') : []
  const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0)
  // A dead ball is a set-up, and a set-up takes time. Tired legs, a slow squad
  // and a long walk to the spot all stretch it: stamina and speed matter.
  const options = {
    meanLoad: mean(squad.map((p) => p.load)),
    meanSpeed: mean(squad.map((p) => attr(p, 'topSpeed'))),
    travel: mean(squad.map((p) => dist(p.pos, state.ball.pos))),
    jitter,
  }
  if (type === 'corner' || type === 'freekick' || type === 'offside' || type === 'throw' || type === 'goalkick' || type === 'penalty') {
    return setPieceSetupSeconds(type, options)
  }
  return 1.35 + jitter * 0.75
}

/**
 * A throw-in or free kick is normally a set-up, not a rush: the taker takes
 * the BallState, walks back, scans and waits for the runners. It is only
 * immediate when the opposition is caught out of shape and there is a free
 * man ahead to release — the fast restart that actually creates something.
 */
function quickRestartOpportunity(state: MatchState, type: RestartType, teamId: TeamId, ballPos: Vec): { quick: boolean; targetId: string | null } {
  if (type !== 'throw' && type !== 'freekick' && type !== 'offside') return { quick: false, targetId: null }
  const ballLocal = worldToLocal(state, teamId, ballPos)
  const goal = goalTarget(state, teamId)
  // You cannot be offside from a throw-in. You can from a free kick, including
  // the one given for an offside. The fast restart used to look for a man
  // beyond the opposition's deepest outfield player and release to him from all
  // three — which is the one place the ball cannot legally be played from two
  // of them. The quick release stays; the shortcut only applies where the Laws
  // allow it.
  const offsideApplies = type !== 'throw'
  const lineLocal = offsideApplies
    ? worldToLocal(state, teamId, { x: secondLastOpponentX(state, teamId), y: 34 }).x
    : Infinity
  // Where the opposition's deepest outfield player sits in our attacking
  // frame. A man beyond that line is the classic fast throw/free kick: no
  // offside from a throw, and their shape is behind the BallState.
  const oppLine = onPitch(state, other(teamId))
    .filter((p) => p.slotPosition !== 'GK')
    .reduce((best, p) => Math.max(best, worldToLocal(state, teamId, p.pos).x), 0)
  let best: { id: string; score: number; space: number; ahead: number; behind: boolean } | null = null
  for (const p of onPitch(state, teamId)) {
    if (p.slotPosition === 'GK') continue
    const local = worldToLocal(state, teamId, p.pos)
    const ahead = local.x - ballLocal.x
    const marker = nearestOpponent(state, p)
    const space = marker ? dist(marker.pos, p.pos) : 30
    // Beyond their line you take it quickly even with a marker nearby; in
    // front of it you only go fast for a genuinely free man with grass to run
    // into. Everything else is a normal, patient throw-in.
    if (offsideApplies && local.x > lineLocal) continue
    const behind = local.x > oppLine + 3 && local.x > 62
    if (behind ? space < 7 || ahead < 8 : space < 11 || ahead < 16 || local.x < 58) continue
    const score = space * 0.5 + ahead * 0.55 + clamp((78 - dist(p.pos, goal)) / 9, 0, 6) + attr(p, 'response') / 45 + (behind ? 4 : 0)
    if (!best || score > best.score) best = { id: p.id, score, space, ahead, behind }
  }
  if (!best) return { quick: false, targetId: null }
  return { quick: true, targetId: best.id }
}

/** Where the taker stands while he sets himself: back a step, scan, then step in. */
function restartTakerTarget(state: MatchState, restart: RestartState, base: Vec): Vec {
  if (restart.type === 'kickoff') return base
  const u = clamp(restart.timer / Math.max(0.3, restart.setup), 0, 1)
  const away = restartBackAway(state, restart)
  const stepBack = restart.type === 'throw' ? 0.6
    : restart.type === 'corner' ? 2.6
      : restart.type === 'penalty' ? 4
        : restart.type === 'goalkick' ? 2.4
          : restart.type === 'freekick' ? 3.1 : 1.8
  // Walk back to get the run-up, hold, then walk in and strike it.
  const shape = smoothstep01(u / 0.32) * (1 - smoothstep01((u - 0.6) / 0.3))
  const seed = hashUnit(restart.takerId)
  const along = restart.type === 'throw' ? { x: 1, y: 0 } : restart.type === 'corner' ? { x: 0, y: 1 } : { x: -away.y, y: away.x }
  const shuffle = Math.sin(restart.timer * 1.06 + seed * 6.283) * (restart.quick ? 0.16 : 0.95) * shape
  return {
    x: clamp(base.x + away.x * stepBack * shape + along.x * shuffle, 0.4, 104.6),
    y: clamp(base.y + away.y * stepBack * shape + along.y * shuffle, 0.4, 67.6),
  }
}

/** Direction pointing away from play, used for run-ups and the thrower's back-step. */
function restartBackAway(state: MatchState, restart: RestartState): Vec {
  if (restart.type === 'throw') {
    const base = restartStandPoint(state, 'throw', restart.teamId, restart.x, restart.y)
    return { x: 0, y: base.y < H / 2 ? -1 : 1 }
  }
  if (restart.type === 'corner') return { x: -attackDir(state, restart.teamId), y: restart.y < H / 2 ? 0.18 : -0.18 }
  const away = norm(sub(state.ball.pos, goalTarget(state, restart.teamId)))
  return len(away) > 0.1 ? away : { x: -attackDir(state, restart.teamId), y: 0 }
}

/**
 * Attacking a set piece means timed runs, not standing in the box: the
 * runners hold a few metres deeper, then break for the near post / back post
 * as the taker is about to strike. Staggered per player so the box moves in
 * waves instead of on a count.
 */
/**
 * Where a defending player stands when the opposition has a dead ball within
 * crossing range. This is the picture every side has for a corner, a long
 * throw or a free kick wide of the box: the back four on the posts and the
 * six-yard line, the midfield on the edge of the area picking up the second
 * ball, and the front man left up as the out-ball. Each slot owns a zone, so
 * nobody is sent to the same pixel as a team-mate.
 */
function setPieceDefenceSpot(state: MatchState, restart: RestartState, p: RuntimePlayer): Vec | null {
  const goal = ownGoal(state, p.teamId)
  const toOwnGoal = dist(restart, goal)
  // Within about 35 m of our goal it is a delivery we have to defend. Beyond
  // that the side keeps its shape and only the nearest men drop.
  if (!(restart.type === 'corner' || 100 - toOwnGoal > 65)) return null
  const own = worldToLocal(state, p.teamId, goal)
  const localPoint = (x: number, y: number) => localToWorld(state, p.teamId, clamp(x, 1, 104), clamp(y, 1, 67))
  const pos = p.slotPosition
  // Zone by role, measured from our own goal line.
  const zones: Record<string, { x: number; y: number }> = {
    LCB: { x: 4.5, y: 28.5 },
    CB: { x: 3.2, y: 34 },
    RCB: { x: 4.5, y: 39.5 },
    LB: { x: 8.5, y: 24 },
    RB: { x: 8.5, y: 44 },
    LWB: { x: 8.5, y: 24 },
    RWB: { x: 8.5, y: 44 },
    LDM: { x: 12.5, y: 30 },
    RDM: { x: 12.5, y: 38 },
    DM: { x: 11.5, y: 34 },
    LM: { x: 15, y: 20 },
    RM: { x: 15, y: 48 },
    LCM: { x: 15, y: 28 },
    RCM: { x: 15, y: 40 },
    CM: { x: 16.5, y: 34 },
    CAM: { x: 19, y: 34 },
  }
  // The nearest free attacker in our box is picked up man-for-man, goal-side.
  const attackers = onPitch(state, other(p.teamId)).filter((a) => a.slotPosition !== 'GK')
  const inOurBox = attackers
    .filter((a) => worldToLocal(state, p.teamId, a.pos).x < 18)
    .sort((a, b) => dist(a.pos, p.pos) - dist(b.pos, p.pos))
  const mine = inOurBox.find((a) => onPitch(state, p.teamId)
    .filter((d) => d.id !== p.id && d.slotPosition !== 'GK')
    .every((d) => dist(d.pos, a.pos) > 3.2))
  if (mine && (pos !== 'ST' && pos !== 'LST' && pos !== 'RST')) {
    const local = worldToLocal(state, p.teamId, mine.pos)
    const goalSide = norm(sub(own, local))
    return localPoint(local.x + goalSide.x * 1.4, local.y + goalSide.y * 1.4)
  }
  const zone = zones[pos]
  if (!zone) return null
  return localPoint(own.x + zone.x, zone.y)
}

function setPieceRunTarget(state: MatchState, restart: RestartState, p: RuntimePlayer, spot: Vec): { target: Vec; sprint: boolean } {
  const local = worldToLocal(state, p.teamId, spot)
  if (local.x < 84) return { target: spot, sprint: false }
  const progress = clamp(restart.timer / Math.max(0.4, restart.setup), 0, 1)
  const seed = hashUnit(p.id + restart.type)
  const holdLocal = {
    x: clamp(local.x - (5 + seed * 4.5), 1, 104),
    y: clamp(local.y + (local.y < 34 ? -2.4 : 2.4), 1, 67),
  }
  const hold = localToWorld(state, p.teamId, holdLocal.x, holdLocal.y)
  const go = smoothstep01((progress - 0.46 - seed * 0.22) / 0.26)
  return {
    target: {
      x: hold.x + (spot.x - hold.x) * go,
      y: hold.y + (spot.y - hold.y) * go,
    },
    sprint: go > 0,
  }
}

function restartStandPoint(state: MatchState, type: RestartType, teamId: TeamId, bx: number, by: number): Vec {
  const dir = attackDir(state, teamId)
  if (type === 'throw') {
    return {
      x: clamp(bx - dir * 0.35, 0.5, 104.5),
      y: clamp(by + (by < H / 2 ? -0.25 : 0.25), 0.5, 67.5),
    }
  }
  if (type === 'corner') {
    return {
      x: clamp(bx - dir * 1.15, 0.5, 104.5),
      y: clamp(by + (by < H / 2 ? 1 : -1), 0.5, 67.5),
    }
  }
  return {
    x: clamp(bx - dir * 1.1, 0.5, 104.5),
    y: clamp(by, 0.5, 67.5),
  }
}

function setRestart(state: MatchState, type: RestartType, teamId: TeamId, x: number, y: number, cause?: string) {
  applyPendingSubs(state)
  state.phase = 'restart'
  state.ball.vel = { x: 0, y: 0 }
  state.ball.z = 0
  state.ball.vz = 0
  state.ball.kind = 'restart'
  state.ball.ownerId = null
  state.ball.intendedReceiverId = null
  let bx = clamp(x, 0.4, 104.6)
  let by = clamp(y, 0.4, 67.6)
  if (type === 'corner') {
    state.stats[teamId].corners += 1
    bx = attackDir(state, teamId) === 1 ? 104.3 : 0.7
    by = y < 34 ? 0.7 : 67.3
  }
  if (type === 'goalkick') {
    const local = { x: 5.5, y: y < 34 ? 29 : 39 }
    const world = localToWorld(state, teamId, local.x, local.y)
    bx = world.x; by = world.y
  }
  if (type === 'penalty') {
    const world = localToWorld(state, teamId, 94, 34)
    bx = world.x; by = world.y
  }
  if (type === 'offside') state.stats[other(teamId)].offsides += 1
  state.ball.pos = { x: bx, y: by }
  targetAtAnchor(state)
  const plan = planFor(state, teamId)
  let preferredId: string | undefined
  if (type === 'corner') preferredId = worldToLocal(state, teamId, { x: bx, y: by }).y < 34 ? plan.setPieces.leftCorner : plan.setPieces.rightCorner
  if (type === 'penalty') preferredId = plan.setPieces.penalty
  if (type === 'freekick') preferredId = worldToLocal(state, teamId, { x: bx, y: by }).x > 65 ? plan.setPieces.shortFreeKick : plan.setPieces.longFreeKick
  if (type === 'goalkick') preferredId = onPitch(state, teamId).find((p) => p.slotPosition === 'GK')?.id
  let taker = preferredId ? byId(state, preferredId) : undefined
  const nearestTaker = () => onPitch(state, teamId).sort((a, b) => dist(a.pos, state.ball.pos) - dist(b.pos, state.ball.pos))[0]!
  if (!taker || !taker.onPitch || taker.sentOff) {
    taker = nearestTaker()
  } else if (type !== 'goalkick' && type !== 'penalty' && dist(taker.pos, state.ball.pos) > (type === 'corner' ? 12 : 18)) {
    // A named set-piece taker stranded upfield does not jog the length of the
    // pitch to take a throw: the nearest team-mate takes it, as at any ground.
    taker = nearestTaker()
  }
  // Do not teleport the taker onto the restart. He keeps his current
  // position and momentum and runs to the BallState like a real player; the
  // BallState stays dead on the spot until he reaches it.
  const standPoint = restartStandPoint(state, type, teamId, bx, by)
  taker.target = standPoint
  taker.decisionTimer = 0
  if (dist(taker.smoothedTarget, taker.pos) > 18) taker.smoothedTarget = { ...taker.pos }
  state.ball.ownerId = taker.id
  state.ball.lastTouchTeamId = teamId
  state.ball.lastTouchPlayerId = taker.id
  const quick = quickRestartOpportunity(state, type, teamId, { x: bx, y: by })
  state.restart = {
    type, teamId, x: bx, y: by, takerId: taker.id, timer: 0, aim: { x: bx, y: by },
    setup: restartSetupSeconds(state, type, quick.quick, teamId),
    quick: quick.quick,
    quickTargetId: quick.targetId,
    arrived: dist(taker.pos, { x: bx, y: by }) <= 2.8,
    arrivedAt: dist(taker.pos, { x: bx, y: by }) <= 2.8 ? 0 : null,
    buffered: null,
    autoTake: state.config.humanTeams.includes(teamId),
    cause,
  }
  positionForRestart(state, type, teamId, taker)
  if (state.config.humanTeams.includes(teamId)) state.controlled[teamId] = taker.id
  state.message = type === 'penalty' ? 'Penalty' : type === 'corner' ? 'Corner' : type === 'throw' ? 'Throw-in' : type === 'goalkick' ? 'Goal kick' : type === 'offside' ? 'Offside' : 'Free-kick'
}

function restartAssignments(state: MatchState): Map<string, Vec> {
  const assignments = new Map<string, Vec>()
  const restart = state.restart
  if (!restart) return assignments
  const { type, teamId } = restart
  const taker = byId(state, restart.takerId)
  if (!taker) return assignments
  const dir = attackDir(state, teamId)
  const ballLocal = worldToLocal(state, teamId, state.ball.pos)
  const localPoint = (x: number, y: number) => localToWorld(state, teamId, clamp(x, 1, 104), clamp(y, 1, 67))
  const assignSupportAndMarks = (spots: Vec[]) => {
    const remaining = onPitch(state, teamId)
      .filter((p) => p.id !== taker.id && p.slotPosition !== 'GK')
      .sort((a, b) => dist(a.pos, state.ball.pos) - dist(b.pos, state.ball.pos))
      .slice(0, spots.length + 2)
    const supportPlayers: RuntimePlayer[] = []
    for (const spot of spots) {
      if (!remaining.length) break
      remaining.sort((a, b) => dist(a.pos, spot) - dist(b.pos, spot))
      const player = remaining.shift()!
      supportPlayers.push(player)
      assignments.set(player.id, spot)
    }
    const markers = onPitch(state, other(teamId))
      .filter((p) => p.slotPosition !== 'GK')
      .sort((a, b) => dist(a.pos, state.ball.pos) - dist(b.pos, state.ball.pos))
      .slice(0, supportPlayers.length)
    markers.forEach((marker, i) => {
      const marked = supportPlayers[i]
      if (!marked) return
      const goalSide = norm(sub(ownGoal(state, marker.teamId), marked.pos))
      assignments.set(marker.id, add(marked.pos, mul(goalSide, 2)))
    })
  }

  if (type === 'throw') {
    const side = ballLocal.y < H / 2 ? -1 : 1
    const infield = (metres: number) => clamp(ballLocal.y - side * metres, 4, 64)
    // A quick throw is a counter: the support breaks up the line instead of
    // forming the usual short backwards triangle.
    const quick = restart.quick
    assignSupportAndMarks([
      localPoint(ballLocal.x - (quick ? 1 : 6), infield(9)),
      localPoint(ballLocal.x + (quick ? 15 : 8), infield(14)),
      localPoint(ballLocal.x + (quick ? 24 : 14), side < 0 ? 3 : 65),
    ])
  }

  if (type === 'corner') {
    const attackingPlan = planFor(state, teamId)
    const defendingPlan = planFor(state, other(teamId))
    const routine = attackingPlan.setPieces.attackingCorner
    const side: -1 | 1 = ballLocal.y < H / 2 ? -1 : 1
    // Attacking side = set-piece skeleton + our attacking shape.
    const attackShape = cornerAttackShape(routine, side, shapeInput(attackingPlan))
    // Defending side = set-piece skeleton + their defensive shape.
    const defenceShape = cornerDefenceShape(defendingPlan.setPieces.defendingCorner, side, shapeInput(defendingPlan))
    const usedAttackers = new Set<string>([taker.id])
    const assignedAttackers: RuntimePlayer[] = []
    const assignAttacker = (player: RuntimePlayer | undefined, spot: { x: number; y: number }) => {
      if (!player || usedAttackers.has(player.id)) return false
      usedAttackers.add(player.id)
      assignedAttackers.push(player)
      assignments.set(player.id, localPoint(spot.x, spot.y))
      return true
    }
    const aerialScore = (p: RuntimePlayer) => attr(p, 'header') * 1.2 + attr(p, 'jump') + attr(p, 'attack') * 0.5
    const attackingPool = () => onPitch(state, teamId)
      .filter((p) => !usedAttackers.has(p.id) && p.slotPosition !== 'GK')
      .sort((a, b) => aerialScore(b) - aerialScore(a))
    const rolePlayer = (id: string) => {
      const manual = attackingPlan.setPieces.assignmentMode === 'manual' ? byId(state, id) : undefined
      return manual && manual.onPitch && !usedAttackers.has(manual.id) && manual.slotPosition !== 'GK'
        ? manual
        : attackingPool()[0]
    }
    // Named aerial targets first (the plan's primary/secondary/edge picks),
    // then the rest of the skeleton filled by aerial ability.
    const spotOf = (duty: SetPieceDuty, index = 0) => attackShape.filter((p) => p.duty === duty)[index] ?? attackShape[0]!
    const primarySpot = spotOf(routine.includes('Near-post') ? 'near-post' : routine.includes('Back-post') ? 'back-post' : 'penalty-spot')
    const secondarySpot = spotOf(routine.includes('Back-post') ? 'penalty-spot' : 'back-post')
    const primary = rolePlayer(attackingPlan.setPieces.primaryTarget)
    assignAttacker(primary, primarySpot)
    const secondary = rolePlayer(attackingPlan.setPieces.secondaryTarget)
    assignAttacker(secondary, secondarySpot)
    assignAttacker(rolePlayer(attackingPlan.setPieces.edgePlayer), spotOf('edge'))
    if (routine.includes('Short')) {
      const shortOption = attackingPool()
        .sort((a, b) => (attr(b, 'shortPassAccuracy') + attr(b, 'dribbleAccuracy')) - (attr(a, 'shortPassAccuracy') + attr(a, 'dribbleAccuracy')))[0]
      assignAttacker(shortOption, spotOf('short'))
    }
    // Everything else the skeleton wants, in order: the screen on the keeper,
    // the near-post flicker, the back-post overload, the edge, then rest
    // defence behind the ball.
    for (const point of attackShape) {
      if (point.duty === 'rest') continue
      if (assignAttacker(attackingPool()[0], point)) continue
      break
    }
    const restDefence = onPitch(state, teamId)
      .filter((p) => !usedAttackers.has(p.id) && p.slotPosition !== 'GK')
      .sort((a, b) => a.baseX - b.baseX)
    const restSpots = attackShape.filter((p) => p.duty === 'rest')
    restDefence.forEach((p, i) => {
      const spot = restSpots[Math.min(i, restSpots.length - 1)] ?? { x: 60, y: i % 2 ? 24 : 44 }
      assignAttacker(p, spot)
    })

    const defendingGk = onPitch(state, other(teamId)).find((p) => p.slotPosition === 'GK')
    if (defendingGk) assignments.set(defendingGk.id, localPoint(101, 34))
    const usedDefenders = new Set<string>()
    const defensiveScore = (p: RuntimePlayer) => attr(p, 'defence') * 1.1 + attr(p, 'header') + attr(p, 'jump') * 0.6 + attr(p, 'aggression') * 0.3
    const defenderPool = () => onPitch(state, other(teamId))
      .filter((p) => p.slotPosition !== 'GK' && !usedDefenders.has(p.id))
      .sort((a, b) => defensiveScore(b) - defensiveScore(a))
    const assignDefender = (player: RuntimePlayer | undefined, spot: { x: number; y: number }) => {
      if (!player || usedDefenders.has(player.id)) return false
      usedDefenders.add(player.id)
      assignments.set(player.id, localPoint(spot.x, spot.y))
      return true
    }
    // Man-marking duty goes to the nearest defender to the attacker he is
    // picking up, not to the best header of a ball by default.
    const markAttacker = (attacker: RuntimePlayer | undefined, fallback: { x: number; y: number }) => {
      if (!attacker) return assignDefender(defenderPool()[0], fallback)
      const marker = defenderPool().sort((a, b) => dist(a.pos, attacker.pos) - dist(b.pos, attacker.pos))[0]
      if (!marker) return false
      usedDefenders.add(marker.id)
      const goalSide = norm(sub(goalTarget(state, teamId), attacker.pos))
      assignments.set(marker.id, add(attacker.pos, mul(goalSide, 1.35)))
      return true
    }
    // The defence is filled duty by duty from its own skeleton: near-post
    // guard first (the job nobody can skip), then the zonal line, then the
    // man-markers, then the edge, then the two left up for the counter.
    //
    // Every man-marking duty picks up a DIFFERENT attacker, in order of how
    // dangerous he is in the air. A player-marking block that put all four
    // markers on the primary target left two of the biggest threats standing
    // free in the six-yard box.
    const markQueue = assignedAttackers
      .filter((p) => p.slotPosition !== 'GK')
      .sort((a, b) => aerialScore(b) - aerialScore(a))
    const markedIds = new Set<string>()
    const nextMark = (): RuntimePlayer | undefined => {
      const free = markQueue.find((p) => !markedIds.has(p.id))
      return free ?? [primary, secondary].find((p) => p && !markedIds.has(p.id))
    }
    for (const point of defenceShape) {
      if (point.duty === 'mark') {
        const target = nextMark() ?? (point.y < 34 ? primary : secondary)
        if (target) markedIds.add(target.id)
        if (markAttacker(target, point)) continue
        break
      }
      if (point.duty === 'counter') {
        // Fastest two, because these two are the whole counter-attack.
        const fastest = defenderPool().sort((a, b) => (attr(b, 'topSpeed') + attr(b, 'acceleration')) - (attr(a, 'topSpeed') + attr(a, 'acceleration')))[0]
        if (assignDefender(fastest, point)) continue
        break
      }
      if (!assignDefender(defenderPool()[0], point)) break
    }
    // Player marking means exactly that: once the skeleton's duties are filled,
    // anybody still spare picks up the nearest attacker who has nobody on him.
    // Without this a "man-marking" block left two of the biggest aerial
    // threats in the six-yard box with nobody within three metres.
    if (defendingPlan.setPieces.defendingCorner === 'Player marking') {
      for (const defender of defenderPool()) {
        const spare = assignedAttackers
          .filter((a) => !markedIds.has(a.id))
          .sort((a, b) => dist(defender.pos, a.pos) - dist(defender.pos, b.pos))[0]
        if (!spare) break
        markedIds.add(spare.id)
        assignDefender(defender, { x: 0, y: 0 })
        const goalSide = norm(sub(goalTarget(state, teamId), spare.pos))
        assignments.set(defender.id, add(spare.pos, mul(goalSide, 1.35)))
      }
    }
  }

  if (type === 'freekick' || type === 'offside') {
    if (ballLocal.x > 62) {
      const goal = goalTarget(state, teamId)
      const distanceToGoal = dist(state.ball.pos, goal)
      const central = Math.abs(ballLocal.y - 34) < 15
      const wallCount = central
        ? (distanceToGoal <= 23 ? 4 : distanceToGoal <= 30 ? 3 : distanceToGoal <= 38 ? 2 : 1)
        : (distanceToGoal <= 28 ? 2 : 1)
      const toGoal = norm(sub(goal, state.ball.pos))
      const wallCentre = add(state.ball.pos, mul(toGoal, 9.15))
      const wallSide = { x: -toGoal.y, y: toGoal.x }
      const usedDefenders = new Set<string>()
      const wall = onPitch(state, other(teamId))
        .filter((p) => p.slotPosition !== 'GK')
        .sort((a, b) => dist(a.pos, wallCentre) - dist(b.pos, wallCentre))
        .slice(0, wallCount)
        .sort((a, b) => worldToLocal(state, teamId, a.pos).y - worldToLocal(state, teamId, b.pos).y)
      wall.forEach((p, i) => {
        usedDefenders.add(p.id)
        assignments.set(p.id, add(wallCentre, mul(wallSide, (i - (wall.length - 1) / 2) * 1.05)))
      })
      if (wall.length >= 3 && distanceToGoal <= 27) {
        const draughtExcluder = onPitch(state, other(teamId))
          .filter((p) => p.slotPosition !== 'GK' && !usedDefenders.has(p.id))
          .sort((a, b) => dist(a.pos, wallCentre) - dist(b.pos, wallCentre))[0]
        if (draughtExcluder) {
          usedDefenders.add(draughtExcluder.id)
          assignments.set(draughtExcluder.id, add(wallCentre, mul(toGoal, 1.35)))
        }
      }
      const defendingGk = onPitch(state, other(teamId)).find((p) => p.slotPosition === 'GK')
      if (defendingGk) {
        assignments.set(defendingGk.id, localPoint(101.2, 34 - Math.sign(ballLocal.y - 34) * 2.2))
      }

      const attackingPlan = planFor(state, teamId)
      const usedAttackers = new Set<string>([taker.id])
      const boxAttackers: RuntimePlayer[] = []
      const assignBox = (player: RuntimePlayer | undefined, spot: Vec) => {
        if (!player || usedAttackers.has(player.id)) return
        usedAttackers.add(player.id)
        boxAttackers.push(player)
        assignments.set(player.id, localPoint(spot.x, spot.y))
      }
      const bestHeader = () => onPitch(state, teamId)
        .filter((p) => !usedAttackers.has(p.id) && p.slotPosition !== 'GK')
        .sort((a, b) => (attr(b, 'header') + attr(b, 'jump') + attr(b, 'attack')) - (attr(a, 'header') + attr(a, 'jump') + attr(a, 'attack')))[0]
      const roleOrBest = (id: string) => {
        const named = attackingPlan.setPieces.assignmentMode === 'manual' ? byId(state, id) : undefined
        return named && named.onPitch && !usedAttackers.has(named.id) && named.slotPosition !== 'GK' ? named : bestHeader()
      }
      // Attacking free kick = set-piece skeleton + our attacking shape. The
      // side the ball is on decides which post is overloaded.
      const fkSide: -1 | 1 = ballLocal.y < H / 2 ? -1 : 1
      const fkShape = wideFreeKickAttackShape(fkSide, shapeInput(attackingPlan))
      const fkSpot = (duty: SetPieceDuty, index = 0) => fkShape.filter((p) => p.duty === duty)[index] ?? { x: 95, y: 34 }
      assignBox(roleOrBest(attackingPlan.setPieces.primaryTarget), fkSpot('penalty-spot'))
      assignBox(roleOrBest(attackingPlan.setPieces.secondaryTarget), fkSpot('back-post'))
      assignBox(roleOrBest(attackingPlan.setPieces.edgePlayer), fkSpot('edge'))
      // The short option is a midfielder's job and is kept for him: somebody
      // drops square of the ball so the taker is never forced to hang one
      // into a crowded box.
      const centralUnits = ['DM', 'LDM', 'RDM', 'LCM', 'CM', 'RCM', 'CAM']
      const shortOption = onPitch(state, teamId)
        .filter((p) => !usedAttackers.has(p.id) && p.slotPosition !== 'GK')
        .sort((a, b) => (centralUnits.includes(a.slotPosition) ? 0 : 1) - (centralUnits.includes(b.slotPosition) ? 0 : 1)
          || (attr(b, 'shortPassAccuracy') + attr(b, 'response')) - (attr(a, 'shortPassAccuracy') + attr(a, 'response')))[0]
      assignBox(shortOption, { x: ballLocal.x - 4, y: ballLocal.y < 34 ? ballLocal.y + 9 : ballLocal.y - 9 })
      // Then the rest of the set-piece skeleton: near post, the screen on the
      // keeper and any trailing runner.
      assignBox(bestHeader(), fkSpot('near-post'))
      assignBox(bestHeader(), fkSpot('screen'))
      const markers = onPitch(state, other(teamId))
        .filter((p) => p.slotPosition !== 'GK' && !usedDefenders.has(p.id))
        .sort((a, b) => (attr(b, 'header') + attr(b, 'defence')) - (attr(a, 'header') + attr(a, 'defence')))
      boxAttackers.slice(0, 3).forEach((attacker, i) => {
        const marker = markers[i]
        if (!marker) return
        const goalSide = norm(sub(goal, attacker.pos))
        assignments.set(marker.id, add(attacker.pos, mul(goalSide, 1.35)))
      })
    } else {
      assignSupportAndMarks([
        localPoint(ballLocal.x - 7, ballLocal.y - 8),
        localPoint(ballLocal.x - 7, ballLocal.y + 8),
        localPoint(ballLocal.x + 9, ballLocal.y + (ballLocal.y < 34 ? 8 : -8)),
      ])
    }
  }

  if (type === 'goalkick') {
    for (const p of onPitch(state, teamId)) {
      if (['LCB', 'CB', 'RCB'].includes(p.slotPosition)) assignments.set(p.id, localPoint(11, p.baseY < 34 ? 18 : 50))
      else if (['LB', 'RB', 'LWB', 'RWB'].includes(p.slotPosition)) assignments.set(p.id, localPoint(30, p.baseY < 34 ? 4 : 64))
      else if (['DM', 'LDM', 'RDM'].includes(p.slotPosition)) assignments.set(p.id, localPoint(23, 34))
      else if (['LCM', 'CM', 'RCM'].includes(p.slotPosition)) assignments.set(p.id, localPoint(36, p.baseY < 34 ? 24 : 44))
    }
    const mode = defensiveMode(state, other(teamId), taker)
    if (mode === 'press') {
      const pressers = onPitch(state, other(teamId))
        .filter((p) => p.slotPosition !== 'GK')
        .sort((a, b) => b.baseX - a.baseX)
        .slice(0, 3)
      const pressSpots = [{ x: 25, y: 28 }, { x: 25, y: 40 }, { x: 29, y: 34 }]
      pressers.forEach((p, i) => assignments.set(p.id, localPoint(pressSpots[i]!.x, pressSpots[i]!.y)))
    }
  }

  if (type === 'penalty') {
    const defendingGk = onPitch(state, other(teamId)).find((p) => p.slotPosition === 'GK')
    if (defendingGk) assignments.set(defendingGk.id, { x: dir === 1 ? 104.2 : 0.8, y: 34 })
    for (const sideTeam of [teamId, other(teamId)] as TeamId[]) {
      const rebounders = onPitch(state, sideTeam)
        .filter((p) => p.id !== taker.id && p.id !== defendingGk?.id && p.slotPosition !== 'GK')
        .sort((a, b) => (attr(b, 'topSpeed') + attr(b, 'response')) - (attr(a, 'topSpeed') + attr(a, 'response')))
      rebounders.slice(0, 2).forEach((p, i) => assignments.set(p.id, localPoint(84, i === 0 ? 27 : 41)))
      for (const p of rebounders.slice(2)) {
        const currentLocal = worldToLocal(state, teamId, p.pos)
        assignments.set(p.id, localPoint(78, clamp(currentLocal.y, 5, 63)))
      }
    }
  }
  return assignments
}

function positionForRestart(state: MatchState, type: RestartType, teamId: TeamId, taker: RuntimePlayer) {
  void type
  void teamId
  void taker
  for (const [playerId, target] of restartAssignments(state)) {
    const p = byId(state, playerId)
    if (p) p.target = target
  }
}

export function restartTakerReady(state: MatchState): boolean {
  const restart = state.restart
  if (!restart) return false
  // Sticky: once he has reached the BallState he is considered in position
  // even while he steps back for his run-up (a penalty taker is four metres
  // behind the spot when he starts moving, and the restart is still his).
  if (restart.arrived) return true
  const taker = byId(state, restart.takerId)
  if (!taker) return false
  return dist(taker.pos, state.ball.pos) <= 2.8
}

/**
 * A human release is allowed as soon as the taker is over the BallState on a
 * kick-off (the BallState is already at his feet), but every other restart has
 * to be gathered and set first, exactly like the AI's.
 */
export function restartMayRelease(state: MatchState, human = false): boolean {
  if (!restartTakerReady(state)) return false
  const restart = state.restart
  if (!restart) return false
  if (human && restart.type === 'kickoff') return true
  return restartSetupComplete(state)
}

/** The team has finished setting the picture; the restart can now be released. */
export function restartSetupComplete(state: MatchState): boolean {
  const restart = state.restart
  if (!restart) return false
  if (!restart.arrived) return false
  const started = restart.arrivedAt ?? 0
  // The set-up clock starts when the taker actually gets to the BallState, so
  // a long run to a touchline throw is followed by the thrower setting
  // himself instead of him arriving and instantly releasing it.
  if (restart.timer < started + restart.setup) return false
  // A corner or a free kick is not taken until the picture is set: enough
  // bodies on their spots. Slow or exhausted sides take longer to form it,
  // which is exactly why tired teams concede from dead balls.
  if (restart.type === 'corner' || restart.type === 'freekick' || restart.type === 'offside') {
    if (restart.timer < started + restart.setup + 1.2) {
      const spots = restartAssignments(state)
      let assigned = 0
      let ready = 0
      let travel = 0
      for (const [playerId, spot] of spots) {
        const p = byId(state, playerId)
        if (!p || p.teamId !== restart.teamId || !p.onPitch || p.slotPosition === 'GK') continue
        const d = dist(p.pos, spot)
        assigned += 1
        travel += d
        if (d <= 6) ready += 1
      }
      // Only wait for a picture that can actually form: if the group is
      // scattered across the pitch, the taker is not going to stand over it
      // while everybody jogs 30 metres.
      if (assigned >= 4 && travel / assigned < 14 && ready / assigned < 0.55) return false
    }
  }
  return true
}

/**
 * A throw-in is not a ground pass: the BallState leaves the hands above head
 * height on a slow looping arc, hangs in the air and is attacked by both
 * sides. Offside never applies from a throw.
 */
function executeThrow(state: MatchState, taker: RuntimePlayer, receiver: RuntimePlayer) {
  executePass(state, taker, receiver, false, false)
  const travel = dist(state.ball.pos, receiver.pos)
  const speed = clamp(7.5 + travel * 0.26, 7.5, 15)
  const dir = norm(state.ball.vel)
  const flight = clamp(travel / Math.max(4, speed), 0.45, 2.3)
  looseBall(state, mul(dir, speed), 'pass', 1.9, 0.5 * 9.8 * flight)
  state.ball.intendedReceiverId = receiver.id
  state.ball.passTeamId = taker.teamId
  state.ball.offsideReceiverId = null
  state.ball.lastTouchTeamId = taker.teamId
  state.ball.lastTouchPlayerId = taker.id
}

function executeRestart(state: MatchState, input?: PlayerInput) {
  const restart = state.restart
  if (!restart) return
  const taker = byId(state, restart.takerId)
  if (!taker) return
  // The taker has to have actually reached the BallState and the side has to
  // have set the picture. Pressing the button early is buffered rather than
  // causing a restart from 15 metres away; AI takers wait on the same clock.
  if (!restartMayRelease(state, input !== undefined)) return
  state.phase = 'play'
  const type = restart.type
  state.restart = null
  // Remember where the ball came from, so a goal can be attributed to the
  // dead ball that started the move rather than to nothing in particular.
  state.lastRestart = { type, teamId: taker.teamId, clock: state.clockSeconds, elapsed: state.halfElapsed }
  if (type === 'penalty') {
    executeShot(state, taker, input?.shootPower ?? 0.68, input && len(input.move) > 0.1 ? 34 + input.move.y * 3.2 : undefined)
    return
  }
  if (type === 'corner') {
    const routine = planFor(state, taker.teamId).setPieces.attackingCorner
    if (input?.pass || (!input && routine.includes('Short'))) {
      const receiver = onPitch(state, taker.teamId)
        .filter((p) => p.id !== taker.id && p.slotPosition !== 'GK')
        .sort((a, b) => dist(a.pos, taker.pos) - dist(b.pos, taker.pos))[0]
      if (receiver) {
        executePass(state, taker, receiver)
        state.ball.offsideReceiverId = null
      }
    } else executeCross(state, taker, input?.crossPower ?? 0.68)
    return
  }
  if (type === 'freekick' || type === 'offside') {
    const local = worldToLocal(state, taker.teamId, taker.pos)
    const goal = goalTarget(state, taker.teamId)
    const toGoal = dist(taker.pos, goal)
    const geometry = shotGeometry(state, taker)
    const inRange = toGoal < 34 && local.x > 62
    // Human: the buttons mean what they say.
    if (input?.shoot && inRange) {
      executeShot(state, taker, input.shootPower ?? 0.72)
      return
    }
    if (input?.cross && local.x > 62) {
      executeCross(state, taker, input.crossPower ?? 0.66)
      return
    }
    if (!input && inRange) {
      const boxLoaded = onPitch(state, taker.teamId)
        .filter((t) => t.id !== taker.id && t.slotPosition !== 'GK')
        .filter((t) => {
          const l = worldToLocal(state, taker.teamId, t.pos)
          return l.x > 82 && Math.abs(l.y - 34) < 18
        }).length
      const specialist = taker.base.stars.includes('Middle Shooting')
      const freeKickSkill = (attr(taker, 'freeKickAccuracy') + attr(taker, 'curling')) / 2
      // A dead ball is a set-up, not a coin flip. Central and close, the wall
      // is beaten or curled over: shoot. Wide and deep the angle is gone, so
      // the ball is worked short or driven across the face instead. Wide near
      // the box it is only a cross once runners are actually in there.
      const shootAppeal = clamp((34 - toGoal) / 24, 0, 1)
        * clamp(1 - geometry.tightness * 0.9, 0, 1)
        * clamp(0.35 + freeKickSkill / 130, 0.3, 1)
        * (specialist ? 1.25 : 1)
      const shortOption = onPitch(state, taker.teamId)
        .filter((t) => t.id !== taker.id && t.slotPosition !== 'GK' && dist(t.pos, taker.pos) < 12)
        .sort((a, b) => dist(a.pos, taker.pos) - dist(b.pos, taker.pos))[0]
      const roll = rand(state)
      if (geometry.tightness < 0.55 && roll < shootAppeal * 1.05) {
        executeShot(state, taker, clamp(0.5 + freeKickSkill / 300, 0.52, 0.86))
        return
      }
      if (roll < 0.9 && local.x > 70) {
        if (boxLoaded >= 2) {
          executeCross(state, taker, clamp(0.58 + freeKickSkill / 320, 0.55, 0.88))
          return
        }
        if (shortOption) {
          executeDrivenPass(state, taker, shortOption, 0.6)
          return
        }
      }
      if (shortOption && rand(state) < 0.3) {
        executePass(state, taker, shortOption)
        return
      }
    }
  }
  // A quick restart (no human input, free man ahead) releases first time to
  // the man the break is on for instead of resetting into the shape.
  const quickTarget = !input && restart.quick && restart.quickTargetId ? byId(state, restart.quickTargetId) : undefined
  const receiver = quickTarget && quickTarget.onPitch && quickTarget.id !== taker.id
    ? quickTarget
    : type === 'kickoff'
      ? chooseKickoffReceiver(state, taker, input)
      : chooseReceiver(state, taker, input?.move, input?.through ?? false, type === 'throw' ? 22 : Infinity)
  if (receiver) {
    if (type === 'throw') executeThrow(state, taker, receiver)
    else executePass(state, taker, receiver, input?.through ?? false, type === 'goalkick' && (input?.cross ?? false))
    if (type === 'throw' || type === 'goalkick') state.ball.offsideReceiverId = null
  } else setOwner(state, taker, false, 0, true)
}

function handleHumanActions(state: MatchState, teamId: TeamId, input: PlayerInput) {
  if (state.phase === 'restart') {
    const restart = state.restart
    if (!restart || restart.teamId !== teamId) return
    if (!(input.pass || input.cross || input.shoot || input.through)) return
    if (restartMayRelease(state, true)) executeRestart(state, input)
    // Asking for it during the set-up is remembered, not ignored: the throw
    // still has to be taken properly, but the release happens the instant the
    // side is set instead of making the player press again.
    else restart.buffered = { ...input, move: { ...input.move } }
    return
  }
  if (state.phase !== 'play') return
  if (input.lineStep) planFor(state, teamId).sliders.lineHeight = clamp(planFor(state, teamId).sliders.lineHeight + 4, 0, 100)
  if (input.lineDrop) planFor(state, teamId).sliders.lineHeight = clamp(planFor(state, teamId).sliders.lineHeight - 4, 0, 100)
  if (input.switchPlayer) switchControlled(state, teamId, input.move)
  if (input.sendRun) {
    const owner = byId(state, state.ball.ownerId)
    if (owner?.teamId === teamId) sendRun(state, teamId, len(input.move) > 0.1 ? input.move : owner.facing)
    else switchControlled(state, teamId, input.move)
  }
  if (input.callSupport) {
    const owner = byId(state, state.ball.ownerId)
    if (owner?.teamId === teamId) {
      const support = onPitch(state, teamId).filter((p) => p.id !== owner.id).sort((a, b) => dist(a.pos, owner.pos) - dist(b.pos, owner.pos))[0]
      if (support) support.supportUntil = state.clockSeconds + 2.5
    }
  }
  const controlled = byId(state, state.controlled[teamId])
  if (!controlled) return
  const owner = byId(state, state.ball.ownerId)
  if (owner?.id === controlled.id) {
    // The carrier must let a non-trivial first touch settle before the next
    // deliberate action. This is brief for clean elite receptions and longer
    // for a bouncing/heavy touch taken at speed or under pressure.
    if (controlled.touchTimer > 0.05) return
    if (input.knockAhead) {
      knockBallAhead(state, controlled, len(input.move) > 0.08 ? input.move : undefined)
    } else if (input.pass) {
      if (input.manual) {
        const receiver = chooseReceiver(state, controlled, input.move)
        if (receiver) {
          executePass(state, controlled, receiver)
          receiver.runUntil = state.clockSeconds + 2.4
        }
      } else {
        const receiver = chooseReceiver(state, controlled, len(input.move) > 0.08 ? input.move : controlled.facing)
        if (receiver) executePass(state, controlled, receiver)
      }
    } else if (input.drivenPass) {
      const receiver = chooseReceiver(state, controlled, len(input.move) > 0.08 ? input.move : controlled.facing, false, 40)
      if (receiver) executeDrivenPass(state, controlled, receiver, clamp(input.drivenPower, 0.4, 0.95))
    } else if (input.through) {
      if (controlled.slotPosition === 'GK' && input.manual) return
      const receiver = chooseReceiver(state, controlled, len(input.move) > 0.08 ? input.move : controlled.facing, true)
      if (receiver) executePass(state, controlled, receiver, true)
    } else if (input.cross) {
      const local = worldToLocal(state, teamId, controlled.pos)
      if (local.x > 55 && Math.abs(controlled.pos.y - 34) > 13) executeCross(state, controlled, input.crossPower)
      else {
        const receiver = chooseReceiver(state, controlled, len(input.move) > 0.08 ? input.move : controlled.facing)
        if (receiver) executePass(state, controlled, receiver, false, true)
      }
    } else if (input.shoot) {
      executeShot(state, controlled, input.shootPower, 34 + input.move.y * 3.4)
    }
  } else if (owner && owner.teamId !== teamId) {
    if (input.tackle) tackleAttempt(state, controlled, false, input.tacklePower)
    else if (input.cross) tackleAttempt(state, controlled, true, clamp(0.38 + input.crossPower * 0.58, 0.38, 0.96))
    else if (input.through) {
      const gk = onPitch(state, teamId).find((p) => p.slotPosition === 'GK')
      if (gk) gk.gkRushUntil = state.clockSeconds + 1.8
    }
  } else if (!owner && input.shoot && dist(controlled.pos, state.ball.pos) < 3 && state.ball.z < 1.2) {
    // Clear a loose ball first-time.
    state.ball.lastTouchTeamId = teamId
    state.ball.lastTouchPlayerId = controlled.id
    executeShot(state, controlled, Math.max(0.55, input.shootPower), 34 + input.move.y * 3.4)
  }
}

function aiActions(state: MatchState) {
  const owner = byId(state, state.ball.ownerId)
  if (state.phase === 'restart' && state.restart && !state.config.humanTeams.includes(state.restart.teamId)
    && restartSetupComplete(state) && restartTakerReady(state)) {
    executeRestart(state)
    return
  }
  if (state.phase !== 'play') return
  if (owner && owner.holdUntil > state.halfElapsed) {
    // He is holding it. Tick the clock slowly so the release is a fresh
    // decision the moment the hold ends, not a queued instant pass.
    if (owner.decisionTimer <= 0) owner.decisionTimer = 0.18
  } else if (owner && !state.config.humanTeams.includes(owner.teamId) && owner.decisionTimer <= 0 && owner.touchTimer <= 0) {
    // Tempo is the speed of circulation: a high tempo means he has made up his
    // mind sooner, a low one means he takes another look.
    owner.decisionTimer = difficultyParams(state, owner.teamId).decision
      * (1.15 - attr(owner, 'response') / 500)
      * clamp(1.35 - planFor(state, owner.teamId).sliders.tempo / 148, 0.68, 1.35)
    aiCarrierDecision(state, owner)
  }
  // AI teammates on human sides may send themselves on obvious runs.
  for (const p of onPitch(state)) {
    if (owner && p.teamId === owner.teamId && p.id !== owner.id && p.decisionTimer <= 0) {
      p.decisionTimer = range(state, 0.8, 1.6)
      if (['ST', 'LW', 'RW', 'CAM'].includes(p.slotPosition) && rand(state) < (attr(p, 'aggression') / 260) * (0.35 + gameplayFor(state, p.teamId).runFrequency / 75)) p.runUntil = state.clockSeconds + 2.6
    }
    if (owner && p.teamId !== owner.teamId && p.tackleCooldown <= 0 && dist(p.pos, owner.pos) < 2.45) {
      const cpuControlled = !state.config.humanTeams.includes(p.teamId) || state.controlled[p.teamId] !== p.id
      const nearestDefender = onPitch(state, p.teamId).sort((a, b) => dist(a.pos, owner.pos) - dist(b.pos, owner.pos))[0]
      const backward = norm(sub(ownGoal(state, owner.teamId), owner.pos))
      const carrierFacingBackward = owner.facing.x * backward.x + owner.facing.y * backward.y > 0.25
      const looseTouch = owner.touchTimer > 0.03 || owner.touchDistance > 1.1
      const touchlineTrap = Math.abs(owner.pos.y - 34) > 27
      const challengeTrigger = looseTouch || carrierFacingBackward || touchlineTrap || dist(p.pos, owner.pos) < 1.55
      const attemptChance = (state.config.humanTeams.includes(p.teamId) ? 0.2 : 0.24 * difficultyParams(state, p.teamId).press)
        * sliderScale(gameplayFor(state, p.teamId).tackleAggression, 0.004)
        * (challengeTrigger ? 1 : 0.18)
      if (cpuControlled && nearestDefender?.id === p.id && rand(state) < attemptChance) {
        const slide = rand(state) < 0.07
        tackleAttempt(state, p, slide, aiTackleIntensity(state, p, owner, slide))
      }
    }
  }
}

function resolveAerial(state: MatchState, inputs: Partial<Record<TeamId, PlayerInput>>) {
  // Shots have their own keeper save/catch resolution, including BallState height
  // and flight time. Do not let the generic header duel intercept them first.
  if (state.ball.kind === 'shot' || state.ball.aerialResolved || state.ball.z < 0.95 || state.ball.vz > 1.6) return
  const candidates = onPitch(state).filter((p) => dist(p.pos, state.ball.pos) < 3.1)
  if (!candidates.length) return
  const scored = candidates.map((p) => {
    // A keeper only gets his hands into a crowd he is actually standing in.
    // Giving every keeper a flat reach bonus meant he won a delivery landing
    // twelve metres out and the attack died before the runners could reach it.
    const gkDepth = p.slotPosition === 'GK' ? worldToLocal(state, p.teamId, p.pos).x : 99
    const reach = 1.55 + (p.base.heightCm - 165) / 100 + attr(p, 'jump') / 135 + (gkDepth < 7 ? 0.42 : 0)
    const reachScore = clamp(18 - Math.abs(reach - state.ball.z) * 16, -10, 18)
    // Attacking the ball beats waiting under it. A player travelling towards
    // the ball meets it at his highest point and with his weight going
    // forward; a player standing on the spot has to jump from a standstill.
    // This is the difference between a corner that is attacked and one that is
    // simply delivered into a crowd.
    const toBall = norm(sub(state.ball.pos, p.pos))
    const closing = len(p.vel) > 0.3 ? p.vel.x * toBall.x + p.vel.y * toBall.y : 0
    // Who can actually get his head to it? The duel is not decided where a
    // player is standing now, it is decided where he will be when the ball
    // arrives at heading height. A man attacking the delivery meets it; a man
    // standing under it has to jump from a flat foot. Predict half a second
    // ahead for anyone moving at pace.
    // The duel is settled at the moment the ball reaches heading height, not
    // now. Work out when that is from how fast the ball is falling, then put
    // every player where he will be at that instant — and trust that picture
    // more for the man running onto it than for the man standing under it.
    const fall = Math.max(0.35, -state.ball.vz)
    const timeToContact = clamp((state.ball.z - 1.85) / fall, 0.1, 0.55)
    const arrival = add(p.pos, mul(p.vel, timeToContact))
    const arrivalTrust = 0.94 - clamp(closing, 0, 5) * 0.05
    const contestDistance = Math.min(
      dist(p.pos, state.ball.pos),
      dist(arrival, state.ball.pos) * arrivalTrust,
    )
    const score = reachScore + attr(p, 'header') * 0.2 + attr(p, 'balance') * 0.13
      + attr(p, 'response') * 0.1 + clamp(closing * 1.1, -3, 5) - contestDistance * 4.6 + range(state, -3, 3)
    return { p, score, reach }
  }).sort((a, b) => b.score - a.score)
  const winner = scored[0]
  if (!winner || winner.reach + 0.25 < state.ball.z) return
  state.ball.aerialResolved = true
  const p = winner.p
  const input = inputs[p.teamId]
  const humanWinning = state.config.humanTeams.includes(p.teamId) && state.controlled[p.teamId] === p.id
  state.ball.lastTouchTeamId = p.teamId
  state.ball.lastTouchPlayerId = p.id
  p.touches += 1
  if (p.slotPosition === 'GK') {
    const local = worldToLocal(state, p.teamId, p.pos)
    // Coming for a cross is a decision, not a magnet. A keeper claims when he
    // is genuinely on top of it and the crowd is thin; otherwise he punches,
    // or he stays and the header is contested. Claiming roughly three in four
    // of the crosses he reached was killing the corner as a contest.
    const claimChance = clamp((attr(p, 'gkSkills') - 40) / 150 + 0.1 - (candidates.length - 1) * 0.12, 0.05, 0.55)
    if (local.x < 9 && candidates.length <= 3 && rand(state) < claimChance) {
      setOwner(state, p, false, 0, true)
      p.decisionTimer = 0.65
      p.holdUntil = state.halfElapsed + keeperHoldSeconds(state, p)
    } else {
      looseBall(state, mul(norm(sub(p.pos, ownGoal(state, p.teamId))), range(state, 13, 19)), 'loose', 1.4, 2.4)
    }
    return
  }
  if (!humanWinning && state.ball.kind === 'cross' && p.teamId !== state.ball.passTeamId
    && worldToLocal(state, p.teamId, p.pos).x < 20
    && rand(state) < (candidates.length > 2 ? 0.62 : 0.46)) {
    // A defender under a dropping cross in his own six-yard box heads it away.
    // He does not chest it down and start playing: this branch used to sit
    // below the control branch, so almost every defensive header in the box
    // was quietly turned into a controlled touch and the corner never came.
    setRestart(state, 'corner', other(p.teamId), p.pos.x, p.pos.y, 'header')
    return
  }
  if (candidates.length === 1 && state.ball.z < 1.55 && (!humanWinning || input?.close)) {
    if (state.ball.offsideReceiverId === p.id) {
      setRestart(state, 'offside', other(p.teamId), p.pos.x, p.pos.y)
      return
    }
    setOwner(state, p, state.ball.intendedReceiverId === p.id)
    return
  }
  const local = worldToLocal(state, p.teamId, p.pos)
  if (humanWinning && input?.pass) {
    const receiver = chooseReceiver(state, p, input.move)
    if (receiver) {
      state.ball.intendedReceiverId = receiver.id
      looseBall(state, mul(norm(sub(receiver.pos, state.ball.pos)), 11), 'pass', 0.7, 0.8)
      return
    }
  }
  if ((humanWinning && input?.shoot) || (!humanWinning && local.x > 74 && Math.abs(p.pos.y - 34) < 24)) {
    executeShot(state, p, 0.52)
    return
  }
  if ((humanWinning && input?.cross) || local.x < 28) {
    const dir = norm(sub(goalTarget(state, p.teamId), p.pos))
    looseBall(state, mul(dir, range(state, 13, 19)), 'loose', 1.1, 2.2)
    return
  }
  const receiver = chooseReceiver(state, p)
  if (receiver) {
    state.ball.intendedReceiverId = receiver.id
    looseBall(state, mul(norm(sub(receiver.pos, state.ball.pos)), 10.5), 'pass', 0.65, 0.7)
  } else {
    looseBall(state, mul(p.facing, 7), 'loose', 0.5, 0.6)
  }
}

function ballPhysics(state: MatchState, inputs: Partial<Record<TeamId, PlayerInput>>, dt: number) {
  state.ball.age += dt
  const owner = byId(state, state.ball.ownerId)
  if (owner) {
    const settling = owner.touchTimer > 0
    const direction = settling ? owner.touchDirection : owner.facing
    const sprintPush = inputs[owner.teamId]?.sprint && len(owner.vel) > 4
      ? (breakawayContext(state, owner).inBehind ? 0.78 : 0.38)
      : 0
    const ahead = 1.05 + Math.min(0.85, len(owner.vel) * 0.08) + sprintPush + (settling ? owner.touchDistance : 0)
    // The ball is carried on one side of the body, not through the middle of
    // it. A one-footed player rolls it onto his strong side whenever he has
    // the yard to do it; under pressure he has to hit it as it lies, which
    // is where the weak-foot strikes come from.
    const strongSide = owner.base.foot === 'L' ? -1 : owner.base.foot === 'R' ? 1 : 0
    if (strongSide !== 0) {
      const marker = nearestOpponent(state, owner)
      const space = marker ? dist(marker.pos, owner.pos) : 20
      const weakFrequency = attr(owner, 'weakFootFrequency')
      const drift = (space > 4 ? 1.15 + (8 - weakFrequency) * 0.28 : 0.08) * dt
      if (owner.ballSide === 0) owner.ballSide = strongSide
      owner.ballSide += clamp(strongSide - owner.ballSide, -drift, drift)
    }
    const perpDir = { x: -direction.y, y: direction.x }
    const carry = owner.ballSide * 0.52
    const target = {
      x: clamp(owner.pos.x + direction.x * ahead + perpDir.x * carry, 0.2, 104.8),
      y: clamp(owner.pos.y + direction.y * ahead + perpDir.y * carry, 0.2, 67.8),
    }
    const old = { ...state.ball.pos }
    // Do not glue the BallState to its dribbling point in a single frame.
    // A reception visibly rolls/cushions into the first touch, then settles
    // under the carrier; ordinary dribbling also has a small physical lag
    // when the carrier changes direction.
    const followRate = settling ? 8.5 : 11 + attr(owner, 'dribbleAccuracy') / 9
    const alpha = clamp(1 - Math.exp(-followRate * dt), 0.05, 0.82)
    state.ball.pos = {
      x: old.x + (target.x - old.x) * alpha,
      y: old.y + (target.y - old.y) * alpha,
    }
    state.ball.vel = dt > 0 ? { x: (state.ball.pos.x - old.x) / dt, y: (state.ball.pos.y - old.y) / dt } : { ...owner.vel }
    state.ball.z = 0
    state.stats[owner.teamId].possessionSeconds += dt * (2700 / state.config.halfSeconds)
    return
  }
  // Sensible-style aftertouch from the team that struck the ball.
  const touchTeam = state.ball.lastTouchTeamId
  const input = inputs[touchTeam]
  const striker = byId(state, state.ball.lastTouchPlayerId)
  if (input && striker && (state.ball.kind === 'shot' || state.ball.kind === 'cross' || state.ball.kind === 'pass')) {
    const curve = (attr(striker, 'curling') / 100) * 5.2
    const forward = norm(state.ball.vel)
    const side = { x: -forward.y, y: forward.x }
    const sideInput = input.move.x * side.x + input.move.y * side.y
    state.ball.vel = add(state.ball.vel, mul(side, sideInput * curve * dt))
    state.ball.vz += -input.move.y * 0.35 * dt
  }
  state.ball.pos = add(state.ball.pos, mul(state.ball.vel, dt))
  state.ball.z += state.ball.vz * dt
  state.ball.vz -= 9.8 * dt
  if (state.ball.z <= 0) {
    state.ball.z = 0
    if (state.ball.vz < -2.2) state.ball.vz = -state.ball.vz * 0.38
    else state.ball.vz = 0
    state.ball.aerialResolved = false
  }
  const friction = state.ball.z > 0.05 ? Math.exp(-AIR_BALL_DRAG * dt) : Math.exp(-GROUND_BALL_DRAG * dt)
  state.ball.vel = mul(state.ball.vel, friction)
  // A pass that has run out of pace is nobody's pass any more. Left as a
  // "pass" with an intended receiver who is nowhere near it, the ball simply
  // sat there: the receiver had given up on it, the defence was not assigned
  // to a ball that supposedly still belonged to somebody, and play froze for
  // thousands of frames. Hand it to the loose-ball logic the moment it dies.
  // A man chasing his own knock-ahead is not a dead pass, so his carry keeps
  // its intended receiver and stays his to win back.
  const selfCarry = state.ball.intendedReceiverId === state.ball.lastTouchPlayerId
  if (!selfCarry && state.ball.z < 0.4 && len(state.ball.vel) < 0.9
    && (state.ball.kind === 'pass' || state.ball.kind === 'cross')) {
    state.ball.kind = 'loose'
    state.ball.intendedReceiverId = null
    state.ball.passTeamId = null
    state.ball.looseAt = state.halfElapsed
  }
  // Anti-stall. A ball nobody owns and nobody is moving towards is a frozen
  // game: the shape keeps shuffling, the clock keeps running, and nothing
  // happens for thousands of frames. Track how long it has been sitting there
  // so the chase can be forced.
  if (!state.ball.ownerId && state.phase === 'play' && Math.hypot(state.ball.vel.x, state.ball.vel.y) < 0.4) {
    state.ball.stalledFor = (state.ball.stalledFor ?? 0) + dt
  } else {
    state.ball.stalledFor = 0
  }
  if ((state.ball.stalledFor ?? 0) > 4.5 && !state.ball.ownerId && state.phase === 'play') {
    // Last resort: somebody picks it up. A dead ball on the pitch is a
    // referee's dropped ball, not a permanent fixture.
    const keeperCanCollect = (p: RuntimePlayer) => p.slotPosition === 'GK'
      && worldToLocal(state, p.teamId, state.ball.pos).x < 20
      && dist(p.pos, state.ball.pos) < 24
    const nearest = onPitch(state)
      .filter((p) => p.slotPosition !== 'GK' || keeperCanCollect(p))
      .sort((a, b) => dist(a.pos, state.ball.pos) - dist(b.pos, state.ball.pos))[0]
    if (nearest && dist(nearest.pos, state.ball.pos) < 30) {
      setOwner(state, nearest, false, 0, true)
      state.ball.stalledFor = 0
      return
    }
  }
  resolveAerial(state, inputs)
  if (state.ball.ownerId) return
  handleBallContact(state)
  if (state.phase !== 'play') return
  checkOutOfPlay(state)
}

function handleBallContact(state: MatchState) {
  const keeperCanUseHands = state.ball.kind === 'shot' && state.ball.z <= 2.45
  // A shot can be blocked with a leg, a chest or a head, so defenders are not
  // limited to knee height the way a ground pass is.
  const blockableHeight = state.ball.kind === 'shot' && state.ball.z <= 1.95
  if (state.ball.z > 1.15 && !keeperCanUseHands && !blockableHeight) return
  const speed = len(state.ball.vel)
  const candidates = onPitch(state)
    .filter((p) => {
      if (state.ball.age < 0.16 && state.ball.lastTouchPlayerId === p.id) return false
      if (state.ball.intendedReceiverId === p.id && p.touchTimer > 0 && state.ball.age < 0.24) return false
      // Ground balls are only playable at shin height; a shot is not, and a
      // defender can get a leg, a chest or a head in front of it.
      if (state.ball.z > 1.15 && !blockableHeight
        && !(keeperCanUseHands && p.slotPosition === 'GK' && p.teamId !== state.ball.lastTouchTeamId)) return false
      const d = dist(p.pos, state.ball.pos)
      if (state.ball.intendedReceiverId === p.id) return d < 2.2
      if (p.slotPosition === 'GK') return d < (state.ball.kind === 'shot' ? (state.ball.z > 1.15 ? 3.15 : 3.45) : 2.35)
      // Defenders throw a leg or a body at a shot: a slightly wider contact
      // band than an ordinary loose-BallState pickup.
      // A defender lunging at a shot covers more ground than an ordinary
      // pickup: the leg is out, the body is committed.
      if (state.ball.kind === 'shot') return d < 2.6 && state.ball.z <= 1.95
      if (state.ball.kind === 'loose') return d < 1.55
      return d < 1.28
    })
    .sort((a, b) => {
      const intendedFirst = Number(state.ball.intendedReceiverId === b.id) - Number(state.ball.intendedReceiverId === a.id)
      const keeperPriority = (p: RuntimePlayer) => state.ball.kind === 'shot'
        && p.slotPosition === 'GK'
        && p.teamId !== state.ball.lastTouchTeamId
        && dist(state.ball.pos, ownGoal(state, p.teamId)) < 8 ? 1 : 0
      return intendedFirst || keeperPriority(b) - keeperPriority(a) || dist(a.pos, state.ball.pos) - dist(b.pos, state.ball.pos)
    })
  // A defender who has already thrown himself at a shot and missed must not
  // continue to occupy the only contact slot and thereby prevent the
  // goalkeeper behind him from making a save on the next frame.
  const p = candidates.find((candidate) => !(
    state.ball.kind === 'shot'
    && candidate.slotPosition !== 'GK'
    && candidate.teamId !== state.ball.lastTouchTeamId
    && state.ball.interceptionAttempts.includes(candidate.id)
  )) ?? candidates[0]
  if (!p) return
  const contactDistance = dist(p.pos, state.ball.pos)

  if (state.ball.kind === 'shot') {
    if (p.slotPosition === 'GK' && p.teamId !== state.ball.lastTouchTeamId) {
      if (state.ball.saveAttempted) return
      const passedKeeperPlane = (ownGoal(state, p.teamId).x === 0 && state.ball.pos.x <= p.pos.x + 0.25)
        || (ownGoal(state, p.teamId).x === W && state.ball.pos.x >= p.pos.x - 0.25)
      const flightTimeEstimate = state.ball.shotDistance && len(state.ball.vel) > 1
        ? state.ball.shotDistance / Math.max(8, len(state.ball.vel))
        : state.ball.age
      // Whether he can even throw a hand at it depends on how long the ball
      // has been travelling: a keeper cannot reach a shot three metres wide
      // of him from six metres out, but from 25 metres he gets there.
      const reachableContact = 2.75 + clamp(flightTimeEstimate, 0, 1.2) * 1.6
      if (contactDistance > reachableContact && !passedKeeperPlane) return
      const goalPlane = ownGoal(state, p.teamId)
      const timeToGoalPlane = Math.abs(state.ball.vel.x) > 0.5 ? (goalPlane.x - state.ball.pos.x) / state.ball.vel.x : -1
      if (timeToGoalPlane > 0) {
        const projectedY = state.ball.pos.y + state.ball.vel.y * timeToGoalPlane
        const projectedZ = Math.max(0, state.ball.z + state.ball.vz * timeToGoalPlane - 4.9 * timeToGoalPlane * timeToGoalPlane)
        // Do not turn a shot that is already going safely wide/over into a
        // needless catch attempt, parry or corner.
        if (Math.abs(projectedY - 34) > 4.35 || projectedZ > 2.75) return
      }
      state.ball.saveAttempted = true
      const placement = Math.abs(state.ball.pos.y - 34)
      // How far the ball passes from him, measured across its own flight path
      // rather than straight across the pitch. On an acute angle from the
      // byline a shot at the far post crosses only centimetres from a keeper
      // standing on the near post — it looks open and is not.
      const shotDir = len(state.ball.vel) > 0.5 ? norm(state.ball.vel) : { x: 1, y: 0 }
      const toKeeper = sub(p.pos, state.ball.pos)
      const lateralReach = Math.abs(toKeeper.x * shotDir.y - toKeeper.y * shotDir.x)
      const flightTime = state.ball.age
      const originDistance = state.ball.shotDistance || (state.ball.shotOrigin ? dist(state.ball.shotOrigin, ownGoal(state, p.teamId)) : 18)
      const shotPower = state.ball.shotPower || clamp((speed - 17) / 17, 0.25, 1)
      const shooter = byId(state, state.ball.lastTouchPlayerId)
      const keeperSpeed = len(p.vel)
      const movingTowardBall = keeperSpeed > 0.2
        ? (norm(p.vel).x * norm(sub(state.ball.pos, p.pos)).x + norm(p.vel).y * norm(sub(state.ball.pos, p.pos)).y)
        : 0
      // Lateral keeper movement is not, by itself, being wrong-footed: if
      // he has reached the shot line, small adjustment steps mean he is set.
      const setFactor = keeperSpeed < 1.4 || (lateralReach <= 0.75 && keeperSpeed < 3.6)
        ? 0.13
        : movingTowardBall > 0.45 ? 0.07 : -0.1
      const reachHeight = 1.55 + (p.base.heightCm - 165) / 100 + attr(p, 'jump') / 135 + 0.42
      const heightPenalty = state.ball.z < 0.18
        ? 0.03
        : clamp((state.ball.z - 0.75) / 6.5, 0, 0.27) + Math.max(0, state.ball.z - reachHeight) * 0.3
      const readiness = clamp((flightTime - 0.18) / 0.8, 0, 1) * 0.34
      const longShotBonus = clamp((originDistance - 16) / 40, 0, 0.3)
      // Pace matters, but do not double-count it too heavily: BallState speed
      // already determines how little readiness time the keeper receives.
      const pacePenalty = clamp((speed - 14) / 85, 0, 0.22) + shotPower * 0.03
      const keeperSettings = gameplayFor(state, p.teamId)
      const difficultyFactor = (difficultyParams(state, p.teamId).quality - 1) * 0.18 + (keeperSettings.goalkeeperAbility - 50) * 0.004
      const specialistPenalty = originDistance > 18 && shooter?.base.stars.includes('Middle Shooting') ? 0.04 : 0
      // Reach model. What decides a save is how much goal the keeper can
      // physically cover before the ball arrives: a reflex plus arm span, and
      // then however far he can travel in the flight time left after he picks
      // the shot up. Close-range finishes beat him because there is no time;
      // on-target efforts from 25 metres are saved almost every time because
      // there is time to get there. Attributes drive both halves: Jump and
      // Response buy ground, GK Skills convert being there into a save.
      const keeperReaction = clamp(0.2 - attr(p, 'response') / 800, 0.09, 0.18)
      const diveTime = Math.max(0.03, flightTime - keeperReaction)
      const reach = 1.02 + attr(p, 'jump') / 100 * 0.55 + attr(p, 'response') / 100 * 0.32
        + diveTime * (2.35 + attr(p, 'jump') / 100 * 1.7)
      const uncovered = Math.max(0, lateralReach - reach)
      const covered = clamp(1 - uncovered / 1.15, 0, 1)
      const keeperQuality = attr(p, 'gkSkills') / 100 * 0.55 + attr(p, 'response') / 100 * 0.28 + attr(p, 'jump') / 100 * 0.17
      const saveChance = clamp(
        (0.1 + keeperQuality * 0.79) * covered
          + readiness * 0.288 + longShotBonus * 1.55 + setFactor * 0.55 + difficultyFactor * 0.6
          - pacePenalty * 0.45 - heightPenalty - Math.max(0, contactDistance - 2.4) / 11 - specialistPenalty,
        0.02,
        0.94,
      )
      if (rand(state) > saveChance) return
      p.saves += 1
      state.stats[p.teamId].saves += 1
      state.ball.lastTouchTeamId = p.teamId
      state.ball.lastTouchPlayerId = p.id

      const bodyBonus = lateralReach <= 0.85 ? 0.16 : lateralReach <= 1.35 ? 0.07 : 0
      const comfortableHeight = state.ball.z >= 0.15 && state.ball.z <= 1.55 ? 0.08 : 0
      const catchChance = clamp(
        0.11 + attr(p, 'gkSkills') / 230 + attr(p, 'response') / 620
          + bodyBonus + comfortableHeight + readiness * 0.42 + setFactor * 0.6 + difficultyFactor * 0.35
          - clamp((speed - 10) / 58, 0, 0.38)
          - shotPower * 0.16
          - placement / 16
          - Math.max(0, lateralReach - 1.2) / 5
          - heightPenalty * 0.7
          - (flightTime < 0.35 ? 0.18 : 0),
        0.02,
        0.9,
      )
      if (rand(state) < catchChance) {
        setOwner(state, p, false, 0, true)
        p.decisionTimer = clamp(0.95 - attr(p, 'response') / 320, 0.55, 0.85)
        p.holdUntil = state.halfElapsed + keeperHoldSeconds(state, p)
      } else {
        const cornerChance = clamp(
          (state.ball.z > 1.65 ? 0.5 : 0)
            + (placement > 2.75 ? 0.34 : placement > 2.1 ? 0.14 : 0)
            + (lateralReach > 2.3 ? 0.12 : 0),
          0,
          0.72,
        )
        if (rand(state) < cornerChance) {
          // Tipped over or pushed around the post rather than back into play.
          setRestart(state, 'corner', other(p.teamId), state.ball.pos.x, state.ball.pos.y, 'keeper')
        } else {
          const awayFromGoal = norm(sub(state.ball.pos, goalTarget(state, other(p.teamId))))
          const wide = (state.ball.pos.y >= p.pos.y ? 0.72 : -0.72) + (state.ball.pos.y >= 34 ? 0.18 : -0.18)
          const parrySpeed = clamp(6 + speed * 0.28 + attr(p, 'gkSkills') / 35, 7, 16)
          looseBall(state, mul(norm({ x: awayFromGoal.x, y: awayFromGoal.y + wide }), parrySpeed), 'loose', 0.35 + state.ball.z * 0.12, 1 + state.ball.z * 0.25)
        }
      }
      return
    }
    if (p.teamId !== state.ball.lastTouchTeamId && speed > 11) {
      if (state.ball.interceptionAttempts.includes(p.id)) return
      // Only a genuine lunge consumes the attempt. A speculative stretch from
      // the edge of reach must not stop him throwing himself at it a frame
      // later when the BallState is actually on him.
      if (contactDistance < 1.9) state.ball.interceptionAttempts.push(p.id)
      const toBall = norm(sub(state.ball.pos, p.pos))
      const closing = len(p.vel) > 0.5 ? norm(p.vel).x * toBall.x + norm(p.vel).y * toBall.y : 0
      const lunge = closing > 0.35 ? 0.12 : 0
      const heightPenalty = clamp((state.ball.z - 1.0) / 2.4, 0, 0.32)
      // Geometry first: a BallState that passes within a stride of a defender
      // hits him. Pace and height only matter on the edges of that reach.
      const blockChance = contactDistance < 0.75
        ? 0.92
        : contactDistance < 1.4
          ? 0.76 - speed / 190 - heightPenalty * 0.4
          : clamp(0.6 - (contactDistance - 1.4) * 0.3 - speed / 120 + lunge - heightPenalty, 0.05, 0.6)
      if (rand(state) > blockChance) return
      // A close-range block is a dive, not a standing interception.
      if (contactDistance < 1.15) p.slideTimer = Math.max(p.slideTimer, 0.18)
      state.ball.lastTouchTeamId = p.teamId
      state.ball.lastTouchPlayerId = p.id
      // A block that skews behind is where most corners come from. Without it
      // the box is a wall that either stops the ball dead or gifts a break.
      // His own goal, not the one he attacks. `goalTarget` is the goal a side is
      // shooting at, so the old version measured the distance to the *far* goal
      // and the branch could only fire if a defender blocked a shot inside the
      // opponent's box — which is why blocked shots produced no corners at all.
      const defendedGoal = ownGoal(state, p.teamId)
      if (state.ball.kind === 'shot' && dist(state.ball.pos, defendedGoal) < 27 && rand(state) < 0.42) {
        const behindX = defendedGoal.x > W / 2 ? W - 0.4 : 0.4
        state.ball.pos = { x: behindX, y: clamp(state.ball.pos.y + range(state, -1.6, 1.6), 0.6, H - 0.6) }
        setRestart(state, 'corner', other(p.teamId), state.ball.pos.x, state.ball.pos.y, 'block')
        return
      }
      looseBall(state, mul(norm(sub(state.ball.pos, p.pos)), range(state, 4, 8)), 'loose', 0.25, 0.7)
      return
    }
  }

  if (state.ball.offsideReceiverId === p.id) {
    setRestart(state, 'offside', other(p.teamId), p.pos.x, p.pos.y)
    return
  }
  const intended = state.ball.intendedReceiverId === p.id
  const opponentInterception = Boolean(state.ball.passTeamId && p.teamId !== state.ball.passTeamId)
  if (opponentInterception && (state.ball.kind === 'pass' || state.ball.kind === 'cross')) {
    if (state.ball.interceptionAttempts.includes(p.id)) return
    state.ball.interceptionAttempts.push(p.id)
    const interceptionChance = contactDistance < 0.55
      ? 0.9
      : clamp(0.18 + attr(p, 'response') / 285 + attr(p, 'defence') / 560 - speed / 135 - contactDistance / 9, 0.05, 0.68)
    if (rand(state) > interceptionChance) return
    // A defender who gets a head or a leg to a cross in his own box does not
    // always control it. Under pressure the ball skews off him and behind —
    // which is where most corners in real football are actually won.
    // A deflection behind is not only a header off a cross. A defender's leg
    // on a driven pass, a shin on a cutback, a mis-hit clearance — all of them
    // end behind the goal line in a real match, and none of them existed here,
    // which is the main reason this engine produced 2.3 corners a match
    // against a real ten. Any defensive touch inside his own box on a ball
    // travelling goalward can go behind, more often the closer to the byline
    // it happens.
    // His own goal — the one he is defending. This branch used `goalTarget`,
    // which is the goal a side attacks, so it only ever fired when the ball was
    // deep in the *opponent's* box with p's own team attacking, and then handed
    // the corner to the defence. The volume it produced was therefore real but
    // the situation was inverted: a defender's touch on a ball going towards the
    // goal he defends is what wins a corner, and that is what this now measures.
    const goalBeingDefended = ownGoal(state, p.teamId)
    const toOwn = norm(sub(goalBeingDefended, state.ball.pos))
    const headingToGoal = (state.ball.vel.x * toOwn.x + state.ball.vel.y * toOwn.y) > 2
    const nearOwnGoal = dist(state.ball.pos, goalBeingDefended)
    const deflectable = headingToGoal && nearOwnGoal < 30
      && (state.ball.kind === 'cross' || state.ball.kind === 'pass' || state.ball.kind === 'shot')
    if (deflectable && rand(state) < clamp(0.3 + (30 - nearOwnGoal) / 60, 0.3, 0.62)) {
      const behindX = goalBeingDefended.x > W / 2 ? W - 0.4 : 0.4
      state.ball.lastTouchTeamId = p.teamId
      state.ball.lastTouchPlayerId = p.id
      state.ball.pos = { x: behindX, y: clamp(state.ball.pos.y + range(state, -2.2, 2.2), 0.6, H - 0.6) }
      setRestart(state, 'corner', other(p.teamId), state.ball.pos.x, state.ball.pos.y, 'deflection')
      return
    }
  }
  if (!intended && state.ball.passTeamId === p.teamId && contactDistance > 1.02 && state.ball.kind !== 'loose') return

  const touchSettings = gameplayFor(state, p.teamId)
  const pressureDistance = opponentDistance(state, p.pos, p.teamId)
  const touchSkill = attr(p, 'technique') * 0.52 + attr(p, 'dribbleAccuracy') * 0.28 + attr(p, 'response') * 0.2
  const incomingAlignment = speed > 1 && len(p.vel) > 0.4
    ? clamp(((norm(state.ball.vel).x * norm(p.vel).x + norm(state.ball.vel).y * norm(p.vel).y) + 1) / 2, 0, 1)
    : 0.55
  const errorLoad = clamp(
    ((100 - touchSkill) / 100) * 0.36
      + clamp((speed - 5) / 17, 0, 1) * 0.34
      + clamp(state.ball.z / 1.5, 0, 1) * 0.17
      + clamp((4.2 - pressureDistance) / 4.2, 0, 1) * 0.2
      + clamp(len(p.vel) / 9, 0, 1) * 0.1
      + (1 - incomingAlignment) * 0.08
      - (p.base.stars.includes('1-Touch Pass') ? 0.07 : 0),
    0,
    1,
  ) * sliderErrorScale(touchSettings.firstTouchError)
  const touchDistance = clamp(0.16 + errorLoad * 2.35 + range(state, -0.05, 0.25), 0.08, 3.2)
  const controlChance = clamp(
    (intended ? 0.62 : 0.46) + touchSkill / 210 - errorLoad * 0.26 + (speed < 5 ? 0.14 : 0),
    0.06,
    0.97,
  )
  if (rand(state) < controlChance) {
    if (opponentInterception) p.interceptions += 1
    setOwner(state, p, intended, touchDistance)
  } else {
    const previousPasserId = state.ball.lastTouchPlayerId
    state.ball.lastTouchTeamId = p.teamId
    // Most failed controls are recoverable heavy first touches into the
    // player's intended path, with the error angle/distance increasing as
    // BallState pace, height, pressure and poor technique combine.
    const recoverable = intended && !opponentInterception
    state.ball.lastTouchPlayerId = recoverable ? previousPasserId : p.id
    state.ball.intendedReceiverId = recoverable ? p.id : null
    if (recoverable) {
      state.ball.passTeamId = p.teamId
      p.touchTimer = 0.18
      p.touchDistance = touchDistance
    }
    const desired = norm(add(mul(p.facing, 0.62), len(p.vel) > 0.4 ? mul(norm(p.vel), 0.38) : { x: 0, y: 0 }))
    const direction = rotate(desired, range(state, -1, 1) * errorLoad * 0.75)
    const heavySpeed = clamp(1.5 + touchDistance * 1.45 + speed * 0.08, 1.8, 6.8)
    looseBall(state, mul(direction, heavySpeed), 'loose', 0.12 + errorLoad * 0.18, 0.35 + errorLoad * 0.3)
  }
}

function goalScored(state: MatchState, teamId: TeamId, impact?: { x?: number; y: number; z: number }) {
  state.score[teamId] += 1
  const scorer = byId(state, state.ball.lastTouchPlayerId)
  const ownGoal = Boolean(scorer && scorer.teamId !== teamId)
  if (scorer && scorer.teamId === teamId) scorer.goals += 1
  pushEvent(state, teamId, scorer?.id, `GOAL — #${scorer?.base.number ?? ''} scores for ${getTeam(teamId).shortName}.`, 'goal',
    goalOrigin(state, teamId))
  // Snapshot the geometry now: the ball keeps rolling into the net, so the
  // crossing point has to be read at the line, not after.
  const crossedY = impact?.y ?? state.ball.pos.y
  const crossedZ = clamp(impact?.z ?? state.ball.z, 0, 2.44)
  const from = state.ball.shotOrigin ?? state.ball.pos
  state.lastGoal = {
    teamId,
    scorerId: scorer?.id ?? null,
    scorerName: scorer ? scorer.base.name : getTeam(teamId).shortName,
    scorerNumber: scorer?.base.number ?? null,
    minute: Math.min(90, Math.max(1, Math.round((state.clockSeconds / 60)))),
    impactY: crossedY,
    impactZ: crossedZ,
    fromY: from.y,
    fromZ: 0.1,
    ownGoal,
    end: (impact?.x ?? state.ball.pos.x) < W / 2 ? 'left' : 'right',
    score: { ...state.score },
  }
  state.phase = 'goal'
  // The celebration runs, then the scoreline, then the goal-mouth replay.
  state.phaseTimer = GOAL_PHASE_SECONDS
  state.ball.vel = { x: 0, y: 0 }
  state.kickoffTeam = other(teamId)
}

function checkOutOfPlay(state: MatchState) {
  const b = state.ball.pos
  if (b.y < 0 || b.y > H) {
    setRestart(state, 'throw', other(state.ball.lastTouchTeamId), clamp(b.x, 1, 104), b.y < 0 ? 0.5 : 67.5)
    return
  }
  // The goal line is out of play, not a surface to rest on. A shot that died
  // exactly on x = 0 or x = 105 used to satisfy neither test, so it sat on the
  // line for ever: the keeper stood four metres away, nobody was assigned to a
  // ball that was neither loose nor in play, and the passage froze. Measured at
  // five such freezes per match — the biggest single source of "random
  // glitches" left in the engine.
  if (b.x <= 0 || b.x >= W) {
    const inGoal = Math.abs(b.y - 34) <= 3.66 && state.ball.z < 2.44
    const defendingTeam: TeamId = (b.x <= 0 && attackDir(state, 'bracelonia') === 1) || (b.x >= W && attackDir(state, 'bracelonia') === -1) ? 'bracelonia' : 'banyarn'
    const attackingTeam = other(defendingTeam)
    if (inGoal) {
      goalScored(
        state,
        state.ball.lastTouchTeamId === defendingTeam ? attackingTeam : state.ball.lastTouchTeamId,
        { x: b.x, y: b.y, z: state.ball.z },
      )
      return
    }
    if (state.ball.lastTouchTeamId === defendingTeam) setRestart(state, 'corner', attackingTeam, b.x, b.y, `goal-line:${state.ball.kind}`)
    else setRestart(state, 'goalkick', defendingTeam, b.x, b.y)
  }
}

export function applySubstitution(state: MatchState, teamId: TeamId, outId: string, inId: string, newWindow = true): boolean {
  const record = state.substitutions[teamId]
  if (record.used >= 5) return false
  const out = byId(state, outId)
  const incoming = byId(state, inId)
  if (!out || !incoming || !out.onPitch || incoming.onPitch || incoming.sentOff) return false
  incoming.slotId = out.slotId
  incoming.slotPosition = out.slotPosition
  incoming.baseX = out.baseX
  incoming.baseY = out.baseY
  incoming.pos = { ...out.pos }
  incoming.target = { ...out.pos }
  incoming.smoothedTarget = { ...out.pos }
  incoming.vel = { x: 0, y: 0 }
  incoming.onPitch = true
  incoming.burst = 1
  incoming.load = 0
  out.onPitch = false
  if (state.ball.ownerId === out.id) setOwner(state, incoming, false, 0, true)
  if (state.ball.intendedReceiverId === out.id) state.ball.intendedReceiverId = incoming.id
  if (state.restart?.takerId === out.id) state.restart.takerId = incoming.id
  if (state.controlled[teamId] === out.id) state.controlled[teamId] = incoming.id
  record.used += 1
  if (newWindow) record.windows += 1
  pushEvent(state, teamId, incoming.id, `#${incoming.base.number} replaces #${out.base.number}.`, 'sub')
  return true
}

function applyPendingSubs(state: MatchState) {
  if (!state.pendingSubs.length) return
  const pending = [...state.pendingSubs]
  state.pendingSubs = []
  const windowsCounted = new Set<TeamId>()
  for (const s of pending) {
    applySubstitution(state, s.teamId, s.outId, s.inId, !windowsCounted.has(s.teamId))
    windowsCounted.add(s.teamId)
  }
}

/** What the manager can see: his eleven, his nine, and the state of the game. */
function managerView(state: MatchState, teamId: TeamId) {
  const plan = planFor(state, teamId)
  const pendingOut = new Set(state.pendingSubs.filter((s) => s.teamId === teamId).map((s) => s.outId))
  const pendingIn = new Set(state.pendingSubs.filter((s) => s.teamId === teamId).map((s) => s.inId))
  const starters: StarterView[] = onPitch(state, teamId).map((p) => ({
    id: p.id,
    slotPosition: p.slotPosition,
    load: p.load,
    injured: p.injured,
    yellowCards: p.yellowCards,
    rating: playerRating(p),
    fitness: clamp(100 - p.load, 0, 100),
  })).filter((s) => !pendingOut.has(s.id))
  const bench: BenchView[] = plan.benchIds
    .map((id) => byId(state, id))
    .filter((p): p is RuntimePlayer => Boolean(p) && !p!.onPitch && !p!.sentOff && !pendingIn.has(p!.id))
    .map((p) => ({
      id: p.id,
      position: p.base.position,
      overall: positionOverall(p.base, p.base.position),
      load: p.load,
      attack: (p.base.attributes.attack + p.base.attributes.shotAccuracy) / 2,
      defence: (p.base.attributes.defence + p.base.attributes.technique) / 2,
      isKeeper: p.slotPosition === 'GK' || p.base.position === 'GK',
    }))
  return { starters, bench }
}

function managerContext(state: MatchState, teamId: TeamId, minute: number): SubContext {
  const record = state.substitutions[teamId]
  return {
    minute,
    losing: state.score[teamId] < state.score[other(teamId)],
    winning: state.score[teamId] > state.score[other(teamId)],
    drawn: state.score[teamId] === state.score[other(teamId)],
    subsUsed: record.used + state.pendingSubs.filter((s) => s.teamId === teamId).length,
    // The half-time change is free: it does not use one of the three windows.
    windowsLeft: Math.max(0, SUB_RULES.windows - record.windows),
  }
}

/**
 * The bench is not a lottery. A manager looks up at the clock, sees who is
 * running on empty, what the scoreline is asking for, and makes one call —
 * then comes back at the next mark.
 */
function aiManager(state: MatchState) {
  const minute = state.clockSeconds / 60
  for (const teamId of ['bracelonia', 'banyarn'] as TeamId[]) {
    if (state.config.humanTeams.includes(teamId)) continue
    const mark = MANAGER_MARKS.find((m) => minute >= m && !state.managerChecks[`${teamId}-${m}`])
    if (mark === undefined) continue
    // Half-time is handled when the whistle goes, not on the ticking clock.
    if (mark === 45 && minute < 45) continue
    state.managerChecks[`${teamId}-${mark}`] = true
    const record = state.substitutions[teamId]
    if (record.used >= SUB_RULES.maxSubs) continue
    // Three windows — and a manager who reaches the last ten minutes with
    // changes still in his pocket spends them anyway, in the window he has.
    // Reaching the last ten minutes with changes in his pocket, the manager
    // spends them in the window he has rather than carrying them home.
    const mustTopUp = minute >= 78 && record.used < SUB_RULES.maxSubs
    if (record.windows >= SUB_RULES.windows && !mustTopUp) continue
    const opensWindow = record.windows < SUB_RULES.windows
    // A manager chasing the game makes two changes at once rather than
    // spending two windows on them.
    const changes = minute >= 62 ? 2 : 1
    for (let i = 0; i < changes; i++) {
      const { starters, bench } = managerView(state, teamId)
      const plan = pickSubstitution(starters, bench, managerContext(state, teamId, minute))
      if (!plan) break
      // Straight on, not queued until the next throw-in twenty minutes later.
      applySubstitution(state, teamId, plan.outId, plan.inId, opensWindow && i === 0)
    }
  }
}

/**
 * Half-time: the one moment a manager can change a side without spending a
 * window. Run for both teams as the whistle goes, so the changes are already
 * on the pitch when the second half kicks off.
 */
function halfTimeManager(state: MatchState) {
  for (const teamId of ['bracelonia', 'banyarn'] as TeamId[]) {
    if (state.config.humanTeams.includes(teamId)) continue
    const record = state.substitutions[teamId]
    if (record.used >= SUB_RULES.maxSubs) continue
    const { starters, bench } = managerView(state, teamId)
    const plan = pickSubstitution(starters, bench, managerContext(state, teamId, 45))
    if (!plan) continue
    applySubstitution(state, teamId, plan.outId, plan.inId, false)
  }
}

export function resumeSecondHalf(state: MatchState) {
  if (state.phase !== 'halftime') return
  state.half = 2
  state.halfElapsed = 0
  // Rebuild world positions from plan anchors with ends swapped.
  setupKickoff(state, other(state.kickoffTeam))
}

function sanitizeFiniteState(state: MatchState) {
  const finiteVec = (v: Vec, fallback: Vec): Vec => (
    Number.isFinite(v.x) && Number.isFinite(v.y) ? v : { ...fallback }
  )
  if (!Number.isFinite(state.ball.pos.x) || !Number.isFinite(state.ball.pos.y)
    || !Number.isFinite(state.ball.vel.x) || !Number.isFinite(state.ball.vel.y)
    || !Number.isFinite(state.ball.z) || !Number.isFinite(state.ball.vz)) {
    setupKickoff(state, state.ball.lastTouchTeamId)
    return
  }
  state.ball.z = clamp(state.ball.z, 0, 8)
  for (const p of onPitch(state)) {
    p.pos = finiteVec(p.pos, { x: W / 2, y: H / 2 })
    p.pos = { x: clamp(p.pos.x, 0.2, 104.8), y: clamp(p.pos.y, 0.2, 67.8) }
    p.vel = finiteVec(p.vel, { x: 0, y: 0 })
    if (len(p.vel) > 14) p.vel = mul(norm(p.vel), 14)
    p.facing = norm(finiteVec(p.facing, { x: attackDir(state, p.teamId), y: 0 }))
    p.target = finiteVec(p.target, p.pos)
    p.smoothedTarget = finiteVec(p.smoothedTarget, p.target)
  }
}

export function stepMatch(state: MatchState, inputs: Partial<Record<TeamId, PlayerInput>>, dtRaw: number) {
  const dt = clamp(dtRaw, 0.001, 0.05)
  if (state.phase === 'halftime' || state.phase === 'fulltime') return state
  sanitizeFiniteState(state)
  if (state.phase === 'goal') {
    state.phaseTimer -= dt
    // Do not freeze the whole scene after a goal. Players keep decelerating
    // and walking back toward their shape while the BallState remains in the net;
    // only the eventual kickoff reset changes the picture.
    computeTargets(state, inputs)
    movePlayers(state, inputs, dt)
    state.ball.pos = add(state.ball.pos, mul(state.ball.vel, dt))
    state.ball.vel = mul(state.ball.vel, Math.exp(-2.2 * dt))
    if (state.phaseTimer <= 0) setupKickoff(state, state.kickoffTeam)
    return state
  }
  // The match clock only ticks while the BallState is in play. Running to a
  // throw, picking it up, walking back and waiting for the runners is dead
  // time, not match time: the timer starts when the BallState is struck.
  if (state.phase === 'play') {
    const clockRate = 2700 / state.config.halfSeconds
    state.clockSeconds += dt * clockRate
    state.halfElapsed += dt
    if (state.halfElapsed >= state.config.halfSeconds) {
      if (state.half === 1) {
        state.phase = 'halftime'
        state.message = 'Half-time'
        halfTimeManager(state)
      } else {
        state.phase = 'fulltime'
        state.message = 'Full-time'
      }
      return state
    }
  }
  // The line each side is attacking, as it registers over time. Sampled every
  // tick so a step-up arrives as a step, not as a jump.
  for (const teamId of ['bracelonia', 'banyarn'] as TeamId[]) {
    const trueLine = secondLastOpponentX(state, teamId)
    if (!Number.isFinite(trueLine)) continue
    const previous = state.lineSeenX[teamId]
    const alpha = clamp(dt / LINE_REACTION_S, 0, 1)
    state.lineSeenX[teamId] = previous + (trueLine - previous) * alpha
  }
  state.sampleTimer += dt
  if (state.sampleTimer > 1) {
    state.sampleTimer = 0
    // Who had the ball at this sample, worked out the same way the shape code
    // works it out: a pass in flight still belongs to the side that played it,
    // and a rebound still belongs to the side that shot.
    const sampleOwner = byId(state, state.ball.ownerId)
    const samplePossession = sampleOwner?.teamId
      ?? ((state.ball.kind === 'pass' || state.ball.kind === 'cross') ? state.ball.passTeamId : null)
      ?? (state.ball.kind === 'shot' ? state.ball.lastTouchTeamId : null)
    for (const p of onPitch(state)) {
      // Store post-match position data in each team's own attacking
      // orientation. Raw world averages across both halves cancel toward
      // halfway after the teams switch ends.
      const local = worldToLocal(state, p.teamId, p.pos)
      p.samples += 1
      p.avgX += (local.x - p.avgX) / p.samples
      p.avgY += (local.y - p.avgY) / p.samples
      if (samplePossession === p.teamId) {
        p.inCount += 1
        p.inX += (local.x - p.inX) / p.inCount
        p.inY += (local.y - p.inY) / p.inCount
      } else {
        p.outCount += 1
        p.outX += (local.x - p.outX) / p.outCount
        p.outY += (local.y - p.outY) / p.outCount
      }
      const col = clamp(Math.floor(local.x / (W / POSITION_HEAT_COLS)), 0, POSITION_HEAT_COLS - 1)
      const row = clamp(Math.floor(local.y / (H / POSITION_HEAT_ROWS)), 0, POSITION_HEAT_ROWS - 1)
      const index = row * POSITION_HEAT_COLS + col
      p.positionHeat[index] = (p.positionHeat[index] ?? 0) + 1
    }
    if (state.phase === 'play') {
      recordTacticalSample(state, {
        bracelonia: attackDir(state, 'bracelonia'),
        banyarn: attackDir(state, 'banyarn'),
      })
    }
  }
  // Possession transitions, for the shape code. The ball does not move in the
  // instant a tackle is won, so without a stamp of *when* it changed hands a
  // side can only ever be shaped by where the ball is — which is why a turnover
  // was invisible in the picture even though the event log recorded it.
  // Hysteresis: a three-quarter-second flicker does not count as a change, so
  // a contested loose ball cannot reset the block every other frame.
  {
    const now = possessionTeamOf(state)
    if (now && now !== state.possessionTeam) {
      // halfElapsed, not clockSeconds: the match clock runs ~3.75x faster than
      // simulated time, so a 4.5-second decay measured on it is really 1.2 s.
      const sinceLast = state.halfElapsed - (state.possessionGainedAt ?? -99)
      if (sinceLast > 0.75) {
        state.possessionTeam = now
        state.possessionGainedAt = state.halfElapsed
      }
    } else if (now) {
      state.possessionTeam = now
    }
  }
  aiManager(state)
  if (state.phase === 'restart' && state.restart) {
    state.restart.timer += dt
    const takerNow = byId(state, state.restart.takerId)
    if (takerNow && !state.restart.arrived && dist(takerNow.pos, state.ball.pos) <= 2.8) {
      state.restart.arrived = true
      state.restart.arrivedAt = state.restart.timer
    }
    const input = inputs[state.restart.teamId]
    if (input) handleHumanActions(state, state.restart.teamId, input)
    if (state.phase === 'restart') {
      const buffered = state.restart?.buffered
      if (buffered && restartMayRelease(state, true)) executeRestart(state, buffered)
      else if (state.restart.autoTake
        && state.restart.timer >= (state.restart.arrivedAt ?? 0) + state.restart.setup + 2.5) {
        // A human team never stalls the match. If the pad is idle a beat too
        // long, the nearest team-mate takes the restart for you — the clock
        // keeps running and play never freezes on an unpressed button.
        executeRestart(state)
      } else aiActions(state)
    }
    computeTargets(state, inputs)
    movePlayers(state, inputs, dt)
    const taker = byId(state, state.restart?.takerId ?? null)
    if (taker && state.ball.ownerId === taker.id) {
      state.ball.pos = { x: state.restart!.x, y: state.restart!.y }
    }
    return state
  }
  for (const teamId of state.config.humanTeams) {
    const input = inputs[teamId]
    if (input) handleHumanActions(state, teamId, input)
    if (!byId(state, state.controlled[teamId])?.onPitch) switchControlled(state, teamId)
  }
  aiActions(state)
  computeTargets(state, inputs)
  movePlayers(state, inputs, dt)
  ballPhysics(state, inputs, dt)
  return state
}

export function simulateMatch(config: MatchConfig, seconds = 240, step = 0.05): MatchState {
  const actualStep = Math.min(step, 0.05)
  const state = createMatch({ ...config, halfSeconds: seconds / 2, humanTeams: [] })
  // Dead-ball set-ups no longer advance the match clock, so a simulation
  // needs extra wall-clock steps to reach full time.
  //
  // The allowance used to be a flat 6,000 steps (300 s of dead-ball time),
  // which is not enough: measuring a 12-minute match showed it needing 21,248
  // steps against a 20,400 budget, so **6 of 8 matches were cut off in the
  // middle of play** and every aggregate this project published through
  // `npm run match` was measuring a truncated match. The allowance now scales
  // with the match length and carries a generous margin; the guard is only
  // there to stop an infinite loop, and a truncated match is far worse than a
  // slow one.
  let guard = 0
  while (state.phase !== 'fulltime' && guard < seconds / actualStep * 2 + 20000) {
    if (state.phase === 'halftime') resumeSecondHalf(state)
    stepMatch(state, {}, actualStep)
    guard += 1
  }
  return state
}

export interface RatingReason {
  key: string
  label: string
  /** How much this moved the rating. Negative for the things that cost. */
  delta: number
  reason: string
}

/**
 * The rating, line by line: every contribution with the number that produced
 * it. A rating a player cannot interrogate is a number he simply disagrees
 * with — the same discipline the tactical profile runs on. `playerRating` sums
 * exactly these deltas, so the explanation and the score cannot drift apart.
 */
export function ratingReasons(p: RuntimePlayer): RatingReason[] {
  const g = p.slotPosition === 'GK' ? 'GK' : ['LB', 'LCB', 'CB', 'RCB', 'RB', 'LWB', 'RWB'].includes(p.slotPosition) ? 'DF' : ['LW', 'RW', 'ST', 'LST', 'RST'].includes(p.slotPosition) ? 'FW' : 'MF'
  const out: RatingReason[] = []
  if (p.goals > 0) {
    out.push({
      key: 'goals',
      label: `${p.goals} goal${p.goals === 1 ? '' : 's'}`,
      delta: p.goals * (g === 'FW' ? 0.75 : 0.95),
      reason: `weighted by position: ${g === 'FW' ? '0.75' : '0.95'} each, because a goal is rarer from ${g === 'FW' ? 'a forward' : 'deep'}`,
    })
  }
  if (p.completedPasses > 0) {
    out.push({ key: 'passes', label: `${p.completedPasses} completed passes`, delta: p.completedPasses * 0.018, reason: '0.018 each — volume, not quality' })
  }
  if (p.tackles > 0) {
    out.push({
      key: 'tackles',
      label: `${p.tackles} tackle${p.tackles === 1 ? '' : 's'}`,
      delta: p.tackles * (g === 'DF' || g === 'MF' ? 0.11 : 0.05),
      reason: `0.11 each for a defender or midfielder, 0.05 for a forward`,
    })
  }
  if (p.interceptions > 0) {
    out.push({ key: 'interceptions', label: `${p.interceptions} interception${p.interceptions === 1 ? '' : 's'}`, delta: p.interceptions * 0.13, reason: '0.13 each — reading the game is the best-paid defensive act in the model' })
  }
  if (p.saves > 0) {
    out.push({ key: 'saves', label: `${p.saves} save${p.saves === 1 ? '' : 's'}`, delta: p.saves * (g === 'GK' ? 0.16 : 0.04), reason: `${g === 'GK' ? '0.16 each for a keeper' : '0.04 each for an outfielder'}` })
  }
  if (p.shots > 0) {
    out.push({ key: 'shots', label: `${p.shots} shot${p.shots === 1 ? '' : 's'}`, delta: p.shots * (g === 'FW' ? 0.05 : 0.025), reason: 'getting the shot away counts, even when it does not go in' })
  }
  // 4.5 km rather than 9: this engine's matches are short, so a hard-working
  // player covers 3-4.5 km, not the 11 km of a real ninety. Dividing by 9000
  // meant every starter sat on the 0.45 cap and the term stopped discriminating
  // between the man who ran and the man who did not.
  out.push({
    key: 'distance',
    label: `${(p.distance / 1000).toFixed(1)} km covered`,
    delta: Math.min(0.45, p.distance / 4500),
    reason: `worth up to 0.45, reached at 4.5 km — he covered ${Math.min(0.45, p.distance / 4500).toFixed(2)}`,
  })
  if (p.sprintDistance > 0) {
    out.push({ key: 'sprints', label: `${p.sprintDistance.toFixed(0)} m sprinting`, delta: 0, reason: `no rating weight on purpose: hard running is already paid for through the distance total, and paying twice rewards the wrong players` })
  }
  if (p.fouls > 0) out.push({ key: 'fouls', label: `${p.fouls} foul${p.fouls === 1 ? '' : 's'}`, delta: -p.fouls * 0.13, reason: '0.13 against each' })
  if (p.yellowCards > 0) out.push({ key: 'cards', label: `${p.yellowCards} booked`, delta: -p.yellowCards * 0.35, reason: '0.35 against each booking' })
  if (p.sentOff) out.push({ key: 'sent-off', label: 'Sent off', delta: -1.2, reason: 'leaving his side a man short' })
  return out
}

export const RATING_BASE = 6.05

export function playerRating(p: RuntimePlayer): number {
  const raw = RATING_BASE + ratingReasons(p).reduce((sum, r) => sum + r.delta, 0)
  return clamp(Math.round(raw * 10) / 10, 3, 10)
}

export function shapeMetrics(state: MatchState, teamId: TeamId) {
  const players = onPitch(state, teamId).filter((p) => p.slotPosition !== 'GK')
  const locals = players.map((p) => worldToLocal(state, teamId, p.pos))
  const xs = locals.map((p) => p.x)
  const ys = locals.map((p) => p.y)
  const defenders = players.filter((p) => ['LB', 'LCB', 'CB', 'RCB', 'RB', 'LWB', 'RWB'].includes(p.slotPosition))
  const line = defenders.length ? defenders.reduce((sum, p) => sum + worldToLocal(state, teamId, p.pos).x, 0) / defenders.length : 0
  return {
    width: Math.max(...ys) - Math.min(...ys),
    length: Math.max(...xs) - Math.min(...xs),
    lineHeight: line,
    centroidX: xs.reduce((a, b) => a + b, 0) / xs.length,
  }
}

export function matchMinute(state: MatchState): number {
  return Math.min(90, Math.floor(state.clockSeconds / 60))
}

export function clockLabel(state: MatchState): string {
  const total = Math.min(5400, Math.floor(state.clockSeconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
