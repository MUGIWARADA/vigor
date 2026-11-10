/**
 * Position roles.
 *
 * EA FC's FC IQ idea, applied to this engine: a player is not "a CM", he is a
 * CM with a job. The job is picked per slot in the Match Plan, it is visible in
 * one line, and it changes where he actually goes — no twelve-slider reading
 * required to make a holding midfielder hold.
 *
 * Every role is a small, legible bundle of movement modifiers. Nothing here is
 * decorative: each field is read by `computeTargets` (and the pressing test in
 * `aiActions`) in the engine.
 */

import type { PositionCode, TeamPlan } from './data'

export type RoleId =
  // goalkeeper
  | 'goalkeeper'
  // centre-backs
  | 'defender' | 'stopper' | 'ball-playing' | 'wide-centre-back'
  // full-backs and wing-backs
  | 'full-back' | 'wing-back' | 'inverted-full-back' | 'false-back'
  // defensive midfield
  | 'holding' | 'deep-lying-playmaker' | 'ball-winning'
  // central midfield
  | 'box-to-box' | 'playmaker' | 'half-winger' | 'holding-mid'
  // attacking midfield
  | 'attacking-playmaker' | 'shadow-striker' | 'inside-forward-mid'
  // wide
  | 'winger' | 'inverted-winger' | 'inside-forward'
  // strikers
  | 'advanced-forward' | 'poacher' | 'false-nine' | 'target-forward'

export type Lane = 'wide' | 'half-space' | 'central'

export interface RoleProfile {
  /** Human label, and the one-line description shown in the menu. */
  label: string
  description: string
  /**
   * Metres added to his attacking position beyond what the shape already
   * gives him. Negative means he sits in front of the ball rather than beyond.
   */
  depth: number
  /** Lane width multiplier in possession: >1 hugs the touchline, <1 comes in. */
  width: number
  /** Where he wants to receive in the final third. */
  lane: Lane
  /** He holds behind the ball and offers an option instead of running beyond. */
  supportOnly: boolean
  /**
   * Box arrival: 0 never, 1 default, 1.4 late runs, 2 always the first one in.
   * Reads as "how far up the pitch may his final-third target sit".
   */
  boxArrival: number
  /** Pressing appetite multiplier out of possession. */
  press: number
  /** How deep he tracks back with the ball on the far side (metres). */
  recovery: number
}

const ROLES: Record<RoleId, RoleProfile> = {
  goalkeeper: {
    label: 'Goalkeeper', description: 'Stays at home, protects the near post.',
    depth: 0, width: 1, lane: 'central', supportOnly: true, boxArrival: 0, press: 0.6, recovery: 0,
  },
  defender: {
    label: 'Defender', description: 'Holds the line, marks the centre-forward, no risks.',
    depth: -3, width: 1, lane: 'central', supportOnly: true, boxArrival: 0.2, press: 0.9, recovery: 1,
  },
  stopper: {
    label: 'Stopper', description: 'Steps out to meet the ball early, wins it higher.',
    depth: 2, width: 1, lane: 'central', supportOnly: true, boxArrival: 0.2, press: 1.5, recovery: 0.8,
  },
  'ball-playing': {
    label: 'Ball-Playing Defender', description: 'Carries out of the line and steps into midfield.',
    depth: 5, width: 1, lane: 'central', supportOnly: true, boxArrival: 0.3, press: 0.95, recovery: 0.9,
  },
  'wide-centre-back': {
    label: 'Wide Centre-Back', description: 'Covers the flank behind an attacking full-back.',
    depth: 1, width: 1.35, lane: 'wide', supportOnly: true, boxArrival: 0.15, press: 0.9, recovery: 1.2,
  },
  'full-back': {
    label: 'Full-Back', description: 'Supports the winger, crosses from the byline, recovers.',
    depth: 4, width: 1.1, lane: 'wide', supportOnly: false, boxArrival: 0.7, press: 1, recovery: 1.1,
  },
  'wing-back': {
    label: 'Wing-Back', description: 'Plays the whole flank, arrives in the box late.',
    depth: 9, width: 1.2, lane: 'wide', supportOnly: false, boxArrival: 0.9, press: 1.15, recovery: 1.2,
  },
  'inverted-full-back': {
    label: 'Inverted Full-Back', description: 'Steps into midfield beside the pivot when you have it.',
    depth: 2, width: 0.45, lane: 'half-space', supportOnly: true, boxArrival: 0.3, press: 1.05, recovery: 1,
  },
  'false-back': {
    label: 'False Back', description: 'Forms a back three in possession, never overlaps.',
    depth: -2, width: 1.15, lane: 'wide', supportOnly: true, boxArrival: 0.1, press: 0.85, recovery: 1,
  },
  holding: {
    label: 'Holding', description: 'Screens the back four. Never leaves the pivot.',
    depth: -3, width: 0.8, lane: 'central', supportOnly: true, boxArrival: 0, press: 1.1, recovery: 1,
  },
  'deep-lying-playmaker': {
    label: 'Deep-Lying Playmaker', description: 'Drops to take it off the centre-backs and dictates.',
    depth: -5, width: 0.9, lane: 'central', supportOnly: true, boxArrival: 0, press: 0.85, recovery: 1,
  },
  'ball-winning': {
    label: 'Ball-Winning Midfielder', description: 'Hunts the second ball, presses, plays it simple.',
    depth: -2, width: 1, lane: 'central', supportOnly: true, boxArrival: 0.2, press: 1.45, recovery: 1.1,
  },
  'box-to-box': {
    label: 'Box-to-Box', description: 'Arrives in the box and gets back into his own.',
    depth: 6, width: 1, lane: 'half-space', supportOnly: false, boxArrival: 1.2, press: 1.15, recovery: 1.1,
  },
  playmaker: {
    label: 'Playmaker', description: 'Finds the pocket between the lines and faces the goal.',
    depth: 3, width: 0.85, lane: 'half-space', supportOnly: true, boxArrival: 0.6, press: 0.85, recovery: 0.9,
  },
  'half-winger': {
    label: 'Half-Winger', description: 'Drifts wide to overload the flank from central midfield.',
    depth: 5, width: 1.5, lane: 'wide', supportOnly: false, boxArrival: 0.8, press: 1, recovery: 1,
  },
  'holding-mid': {
    label: 'Holding Midfielder', description: 'Balances the midfield pair; covers when the other goes.',
    depth: -2, width: 0.85, lane: 'central', supportOnly: true, boxArrival: 0.1, press: 1, recovery: 1,
  },
  'attacking-playmaker': {
    label: 'Attacking Playmaker', description: 'The link: receives between the lines and creates.',
    depth: 4, width: 0.8, lane: 'half-space', supportOnly: true, boxArrival: 0.8, press: 0.8, recovery: 0.8,
  },
  'shadow-striker': {
    label: 'Shadow Striker', description: 'Runs beyond the striker into the box.',
    depth: 9, width: 0.7, lane: 'central', supportOnly: false, boxArrival: 1.5, press: 1.05, recovery: 0.8,
  },
  'inside-forward-mid': {
    label: 'Inside Forward (AM)', description: 'Starts central, attacks the half-space with the ball.',
    depth: 7, width: 1.1, lane: 'half-space', supportOnly: false, boxArrival: 1.1, press: 1, recovery: 0.9,
  },
  winger: {
    label: 'Winger', description: 'Holds the touchline, beats his man, crosses.',
    depth: 5, width: 1.3, lane: 'wide', supportOnly: false, boxArrival: 0.7, press: 0.9, recovery: 0.9,
  },
  'inverted-winger': {
    label: 'Inverted Winger', description: 'Starts wide, comes inside onto his stronger foot.',
    depth: 6, width: 0.9, lane: 'half-space', supportOnly: false, boxArrival: 1, press: 0.95, recovery: 0.9,
  },
  'inside-forward': {
    label: 'Inside Forward', description: 'Lives in the box between full-back and centre-back.',
    depth: 9, width: 0.6, lane: 'central', supportOnly: false, boxArrival: 1.5, press: 1, recovery: 0.85,
  },
  'advanced-forward': {
    label: 'Advanced Forward', description: 'Leads the line, attacks the last shoulder.',
    depth: 4, width: 0.8, lane: 'central', supportOnly: false, boxArrival: 1.6, press: 1, recovery: 0.6,
  },
  poacher: {
    label: 'Poacher', description: 'Only the box. No build-up, no width, all six-yard line.',
    depth: 6, width: 0.6, lane: 'central', supportOnly: false, boxArrival: 2, press: 0.75, recovery: 0.5,
  },
  'false-nine': {
    label: 'False Nine', description: 'Drops into midfield to pull a centre-back out of the line.',
    depth: -8, width: 0.8, lane: 'half-space', supportOnly: true, boxArrival: 1, press: 1.05, recovery: 0.7,
  },
  'target-forward': {
    label: 'Target Forward', description: 'Holds the ball up, wins everything in the air.',
    depth: 1, width: 0.7, lane: 'central', supportOnly: true, boxArrival: 1.4, press: 0.9, recovery: 0.5,
  },
}

/** Roles offered for each position, and the one a slot starts on. */
const BY_POSITION: Record<string, { roles: RoleId[]; fallback: RoleId }> = {
  GK: { roles: ['goalkeeper'], fallback: 'goalkeeper' },
  LCB: { roles: ['defender', 'stopper', 'ball-playing', 'wide-centre-back'], fallback: 'defender' },
  CB: { roles: ['defender', 'stopper', 'ball-playing'], fallback: 'defender' },
  RCB: { roles: ['defender', 'stopper', 'ball-playing', 'wide-centre-back'], fallback: 'defender' },
  LB: { roles: ['full-back', 'wing-back', 'inverted-full-back', 'false-back'], fallback: 'full-back' },
  RB: { roles: ['full-back', 'wing-back', 'inverted-full-back', 'false-back'], fallback: 'full-back' },
  LWB: { roles: ['wing-back', 'full-back', 'false-back'], fallback: 'wing-back' },
  RWB: { roles: ['wing-back', 'full-back', 'false-back'], fallback: 'wing-back' },
  DM: { roles: ['holding', 'deep-lying-playmaker', 'ball-winning'], fallback: 'holding' },
  LDM: { roles: ['holding', 'deep-lying-playmaker', 'ball-winning'], fallback: 'holding' },
  RDM: { roles: ['holding', 'deep-lying-playmaker', 'ball-winning'], fallback: 'holding' },
  LCM: { roles: ['box-to-box', 'playmaker', 'half-winger', 'holding-mid'], fallback: 'box-to-box' },
  CM: { roles: ['box-to-box', 'playmaker', 'half-winger', 'holding-mid'], fallback: 'box-to-box' },
  RCM: { roles: ['box-to-box', 'playmaker', 'half-winger', 'holding-mid'], fallback: 'box-to-box' },
  LM: { roles: ['winger', 'inverted-winger', 'inside-forward'], fallback: 'winger' },
  RM: { roles: ['winger', 'inverted-winger', 'inside-forward'], fallback: 'winger' },
  LW: { roles: ['winger', 'inverted-winger', 'inside-forward'], fallback: 'inverted-winger' },
  RW: { roles: ['winger', 'inverted-winger', 'inside-forward'], fallback: 'inverted-winger' },
  CAM: { roles: ['attacking-playmaker', 'shadow-striker', 'inside-forward-mid'], fallback: 'attacking-playmaker' },
  ST: { roles: ['advanced-forward', 'poacher', 'false-nine', 'target-forward'], fallback: 'advanced-forward' },
  LST: { roles: ['advanced-forward', 'poacher', 'false-nine', 'target-forward'], fallback: 'advanced-forward' },
  RST: { roles: ['advanced-forward', 'poacher', 'false-nine', 'target-forward'], fallback: 'advanced-forward' },
}

export function rolesForPosition(position: PositionCode | string): RoleId[] {
  return BY_POSITION[position]?.roles ?? ['box-to-box']
}

export function defaultRoleFor(position: PositionCode | string): RoleId {
  return BY_POSITION[position]?.fallback ?? 'box-to-box'
}

export function roleProfile(role: RoleId | undefined, position: PositionCode | string): RoleProfile {
  const resolved = role && ROLES[role] ? role : defaultRoleFor(position)
  return ROLES[resolved]
}

export function roleOptions(): Array<{ id: RoleId; label: string; description: string }> {
  return (Object.keys(ROLES) as RoleId[]).map((id) => ({ id, ...ROLES[id] }))
}

/** The role of a slot in a plan, falling back to the position default. */
export function slotRole(plan: TeamPlan, slotId: string, position: PositionCode | string): RoleId {
  const slot = plan.slots.find((s) => s.slotId === slotId)
  const saved = slot?.role as RoleId | undefined
  return saved && ROLES[saved] ? saved : defaultRoleFor(position)
}
