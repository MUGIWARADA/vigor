/**
 * Pass flow: what a carrier does with the ball when the picture is not yet
 * there. Real possession is not a conveyor of passes — it is drive, wait and
 * release, chosen by how much grass is in front of him, whether a team-mate
 * is dropping in to offer an angle, and whether a runner is joining the move.
 *
 * The other half of the same problem is what possession must NOT be: a ball
 * that lives on the centre-backs. Two centre-backs exchanging square passes
 * for twenty seconds is not control, it is stalling, and it is the thing that
 * makes a simulated team look like it has no idea how to come out.
 *
 * Everything here is pure: the engine passes a picture in and gets an action
 * out, so the decision can be tested without a match.
 */

export type FlowAction = 'drive' | 'wait' | 'pass'

export type FlowReason = 'space' | 'drop' | 'join' | 'release' | 'circulate'

export interface FlowPicture {
  /** Metres from the carrier to the nearest opponent. */
  pressure: number
  /** Carrier's position in his own scoring frame: 0 own goal line, 105 theirs. */
  localX: number
  /** Metres of genuinely clear grass in front of him, before contact. */
  spaceAhead: number
  /** Lane blockage of the best available pass, in metres of clear gap. */
  bestLane: number
  /** Forward progress, in metres, that the best pass would buy. */
  bestGain: number
  /** A team-mate is dropping toward him to offer a short angle. */
  dropComing: boolean
  /** Metres to the nearest man actually dropping in (99 when nobody is). */
  dropDistance: number
  /** A team-mate is arriving on a timed run / joining from behind. */
  joinArriving: boolean
  /** Team-mates open and ahead of him. */
  progressiveOptions: number
  /** Composure on the ball, 0..100 (response/mentality/technique). */
  composure: number
  /** Team tempo, 0..100. A quick side does not stand over the ball. */
  tempo: number
  /**
   * How much this position is licensed to carry the ball, 0..1. A centre-back
   * steps out with it, a winger goes at his man.
   */
  carryLicence: number
  /** He has just held it; a second hold in a row is a stall, not patience. */
  heldRecently: boolean
}

export interface FlowVerdict {
  action: FlowAction
  /** How long he stands the ball up, in seconds. Only meaningful for 'wait'. */
  hold: number
  reason: FlowReason
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

/**
 * Drive, wait or release. The carrier has to be genuinely free to wait — a
 * pressed player standing over the ball is just a tackle waiting to happen —
 * and he has to actually have somebody coming, otherwise patience is a stall.
 */
export function flowVerdict(picture: FlowPicture): FlowVerdict {
  const patience = clamp01((picture.composure - 40) / 55)
  const urgency = clamp01(picture.tempo / 100)
  // The ball can only be carried into space if there is space, and only from
  // a place where carrying it makes sense: a centre-back needs a lot more
  // grass to step out than a winger does to go at his full-back.
  const licence = clamp(picture.carryLicence, 0, 1)
  const wantsSpace = picture.spaceAhead >= 8 + (1 - licence) * 13 + (1 - patience) * 4
    && picture.localX > 26
  const spaceBeatsPass = picture.spaceAhead > picture.bestLane + 7
  if (wantsSpace && spaceBeatsPass && picture.pressure > 2.2) {
    return { action: 'drive', hold: 0, reason: 'space' }
  }
  // A pass is "on" when either the lane is genuinely clear or the ball moves
  // the attack forward. Anything else is a ball played into a crowd.
  const passIsOn = picture.bestLane >= 3 || picture.bestGain > 3
  // Waiting is only worth it when somebody is actually coming, and only in
  // the part of the pitch where the team is building rather than finishing.
  // A drop is only worth waiting for if he is nearly here: standing over the
  // ball while a man jogs twenty metres is a stall, not patience.
  const dropIsClose = picture.dropComing && picture.dropDistance <= 10
  const someoneOffers = dropIsClose || (picture.joinArriving && picture.localX < 70)
  if (!picture.heldRecently && !passIsOn && someoneOffers
    && picture.pressure > 2.4 && picture.localX < 72) {
    const hold = 0.3 + patience * 0.24 + (1 - urgency) * 0.14
      - (3 - Math.min(3, picture.pressure)) * 0.1
    return {
      action: 'wait',
      hold: clamp(hold, 0.28, 0.7),
      reason: dropIsClose ? 'drop' : 'join',
    }
  }
  return {
    action: 'pass',
    hold: 0,
    reason: picture.progressiveOptions > 0 ? 'release' : 'circulate',
  }
}

/** The pitch is 105 x 68 in this engine's own coordinates. */
const CENTRE_BACKS = ['LCB', 'CB', 'RCB']

export interface CirculationInput {
  /** Slot position of the player on the ball. */
  passerRole: string
  /** Slot position of the player he is considering. */
  receiverRole: string
  /** Metres from the passer to his nearest opponent. */
  pressure: number
  /** Receiver's x in the passer's scoring frame. */
  receiverLocalX: number
  /** Passer's x in his own scoring frame. */
  passerLocalX: number
  /** Team-mates open and ahead of the passer. */
  progressiveOptions: number
}

/**
 * How much a pass to a centre-back should be marked down. Zero for everybody
 * who is not a centre-back: this is not a rule about passing backwards, it is
 * a rule about the ball never leaving the back line.
 *
 * The exception is real: under a press the square ball to the other centre-back
 * is exactly the right, safe pass, and a team that refuses it loses the ball in
 * front of its own box. So the penalty collapses when the passer is under
 * pressure, and disappears entirely when the keeper is starting the move.
 */
export function circulationPenalty(input: CirculationInput): number {
  if (!CENTRE_BACKS.includes(input.receiverRole)) return 0
  if (input.passerRole === 'GK') return 0
  const pressured = input.pressure < 4.2
  const passerIsCentreBack = CENTRE_BACKS.includes(input.passerRole)
  // With time, and a man free further forward, another centre-back is a stall.
  const base = pressured ? 2 : 5
  // Two centre-backs knocking it to each other is only a stall when they have
  // the time to do something better.
  const stagnation = passerIsCentreBack && !pressured ? 2 : 0
  const nobodyAhead = input.progressiveOptions === 0 ? -2.6 : 0
  const backwards = input.receiverLocalX < input.passerLocalX - 1 ? 1.2 : 0
  return Math.max(0, base + stagnation + nobodyAhead + (pressured ? 0 : backwards))
}

/** Which team-mate should drop in to offer the carrier a short angle. */
export interface DropCandidate {
  id: string
  role: string
  /** Metres from the carrier. */
  distance: number
  /** Metres to his nearest opponent — how free he is. */
  openness: number
  /** He is already on a run forward; do not turn a runner into a dropper. */
  running: boolean
  /** mentality, 0..100: who wants the ball in tight spaces. */
  mentality: number
}

const DEEP_ROLES = ['DM', 'LDM', 'RDM']
const WIDE_SUPPORT = ['LB', 'RB', 'LWB', 'RWB']

/**
 * The nearest sensible man drops. Deep midfield first — that is whose job the
 * outlet is — then a full-back, then whoever else is close enough to make the
 * angle real. Never a centre-back who is already the last line, never a
 * forward who is waiting in the box.
 */
export function pickDropper(candidates: DropCandidate[]): DropCandidate | undefined {
  const score = (c: DropCandidate) => {
    if (c.running) return -99
    if (c.distance < 3.5 || c.distance > 21) return -99
    const roleBonus = DEEP_ROLES.includes(c.role) ? 9 : WIDE_SUPPORT.includes(c.role) ? 5.5 : 0
    const crowdPenalty = Math.max(0, 3.4 - c.openness) * 2.4
    return roleBonus + Math.min(6, c.openness) * 0.8 + c.mentality / 18 - c.distance * 0.35 - crowdPenalty
  }
  const ranked = candidates.filter((c) => score(c) > -50).sort((a, b) => score(b) - score(a))
  return ranked[0]
}
