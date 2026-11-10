/**
 * Community Game Mode data.
 *
 * The clubs and players are fictional/parody game content. Their PES PS2
 * values are original game-balance conversions from observable playing
 * profiles (role, foot, build, pace, passing, finishing, defending, aerial
 * game and work rate). They are not copied from a commercial game database
 * and must never be presented as official ratings for any real player.
 */

import { defaultRoleFor } from './roles'

export type TeamId = 'bracelonia' | 'banyarn'
export type PositionCode =
  | 'GK' | 'LB' | 'LCB' | 'CB' | 'RCB' | 'RB' | 'LWB' | 'RWB'
  | 'DM' | 'LDM' | 'RDM' | 'LM' | 'LCM' | 'CM' | 'RCM' | 'RM'
  | 'CAM' | 'LW' | 'ST' | 'RW' | 'LST' | 'RST'

export type Foot = 'L' | 'R' | 'B'
export type FormArrow = 'top' | 'good' | 'normal' | 'poor' | 'terrible'

export interface PesAttributes {
  attack: number
  defence: number
  balance: number
  stamina: number
  topSpeed: number
  acceleration: number
  response: number
  agility: number
  dribbleAccuracy: number
  dribbleSpeed: number
  shortPassAccuracy: number
  shortPassSpeed: number
  longPassAccuracy: number
  longPassSpeed: number
  shotAccuracy: number
  shotPower: number
  shotTechnique: number
  freeKickAccuracy: number
  curling: number
  header: number
  jump: number
  technique: number
  aggression: number
  mentality: number
  gkSkills: number
  teamwork: number
  consistency: number
  condition: number
  weakFootAccuracy: number
  weakFootFrequency: number
  injuryTolerance: 'A' | 'B' | 'C'
}

export const PES_ATTRIBUTE_LABELS: Array<[keyof PesAttributes, string]> = [
  ['attack', 'Attack'], ['defence', 'Defence'], ['balance', 'Balance'], ['stamina', 'Stamina'],
  ['topSpeed', 'Top Speed'], ['acceleration', 'Acceleration'], ['response', 'Response'], ['agility', 'Agility'],
  ['dribbleAccuracy', 'Dribble Accuracy'], ['dribbleSpeed', 'Dribble Speed'],
  ['shortPassAccuracy', 'Short Pass Accuracy'], ['shortPassSpeed', 'Short Pass Speed'],
  ['longPassAccuracy', 'Long Pass Accuracy'], ['longPassSpeed', 'Long Pass Speed'],
  ['shotAccuracy', 'Shot Accuracy'], ['shotPower', 'Shot Power'], ['shotTechnique', 'Shot Technique'],
  ['freeKickAccuracy', 'Free Kick Accuracy'], ['curling', 'Curling'], ['header', 'Header'], ['jump', 'Jump'],
  ['technique', 'Technique'], ['aggression', 'Aggression'], ['mentality', 'Mentality'],
  ['gkSkills', 'GK Skills'], ['teamwork', 'Teamwork'], ['consistency', 'Consistency'],
  ['condition', 'Condition/Fitness'], ['weakFootAccuracy', 'Weak Foot Accuracy'],
  ['weakFootFrequency', 'Weak Foot Frequency'], ['injuryTolerance', 'Injury Tolerance'],
]

export const PES_STARS = [
  'Dribbling', 'Tactical Dribble', 'Positioning', 'Reaction', 'Playmaking', 'Passing', 'Scoring',
  '1-on-1 Scoring', 'Post Player', 'Lines', 'Middle Shooting', 'Side', 'Centre', 'Penalties',
  '1-Touch Pass', 'Outside', 'Marking', 'Sliding', 'Covering', 'D-Line Control',
  'Penalty Stopper', '1-on-1 Stopper', 'Long Throw',
] as const
export type PesStar = (typeof PES_STARS)[number]

export interface GamePlayer {
  id: string
  teamId: TeamId
  name: string
  number: number
  position: PositionCode
  secondaryPositions: PositionCode[]
  age: number
  heightCm: number
  weightKg: number
  foot: Foot
  favouredSide: 'L' | 'R' | 'B'
  attributes: PesAttributes
  stars: PesStar[]
  form: FormArrow
}

export interface TeamIdentity {
  buildUp: string
  press: string
  defensiveShape: string
  lineHeight: number
  pressing: number
  compactness: number
  support: number
  width: number
  directness: number
  tempo: number
  offsideTrap: number
}

export interface GameTeam {
  id: TeamId
  name: string
  shortName: string
  color: string
  secondaryColor: string
  textColor: string
  gkColor: string
  defaultFormation: string
  identity: TeamIdentity
  players: GamePlayer[]
}

/**
 * EA FC-style gameplay tuning, split between human-controlled teams and CPU
 * teams. Every value is a 0–100 slider with 50 representing the tuned core
 * simulation. These settings are match-level tuning, not fake player data,
 * and remain local to Community Game Mode.
 */
export interface GameplaySideSettings {
  sprintSpeed: number
  acceleration: number
  passSpeed: number
  passError: number
  shotSpeed: number
  shotError: number
  firstTouchError: number
  goalkeeperAbility: number
  marking: number
  runFrequency: number
  lineHeight: number
  lineLength: number
  lineWidth: number
  fullbackPositioning: number
  tackleAggression: number
}

export interface GameplaySettings {
  user: GameplaySideSettings
  cpu: GameplaySideSettings
  refereeStrictness: number
  injuryFrequency: number
}

const DEFAULT_GAMEPLAY_SIDE: GameplaySideSettings = {
  sprintSpeed: 50,
  acceleration: 50,
  passSpeed: 50,
  passError: 50,
  shotSpeed: 50,
  shotError: 50,
  firstTouchError: 50,
  goalkeeperAbility: 50,
  marking: 50,
  runFrequency: 50,
  lineHeight: 50,
  lineLength: 50,
  lineWidth: 50,
  fullbackPositioning: 50,
  tackleAggression: 50,
}

export const DEFAULT_GAMEPLAY_SETTINGS: GameplaySettings = {
  user: { ...DEFAULT_GAMEPLAY_SIDE },
  cpu: { ...DEFAULT_GAMEPLAY_SIDE },
  refereeStrictness: 50,
  injuryFrequency: 50,
}

export function normalizeGameplaySettings(input?: Partial<GameplaySettings> | null): GameplaySettings {
  const clampSlider = (value: unknown, fallback: number) => {
    const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
    return Math.round(Math.min(100, Math.max(0, n)))
  }
  const side = (value: Partial<GameplaySideSettings> | undefined): GameplaySideSettings => ({
    sprintSpeed: clampSlider(value?.sprintSpeed, 50),
    acceleration: clampSlider(value?.acceleration, 50),
    passSpeed: clampSlider(value?.passSpeed, 50),
    passError: clampSlider(value?.passError, 50),
    shotSpeed: clampSlider(value?.shotSpeed, 50),
    shotError: clampSlider(value?.shotError, 50),
    firstTouchError: clampSlider(value?.firstTouchError, 50),
    goalkeeperAbility: clampSlider(value?.goalkeeperAbility, 50),
    marking: clampSlider(value?.marking, 50),
    runFrequency: clampSlider(value?.runFrequency, 50),
    lineHeight: clampSlider(value?.lineHeight, 50),
    lineLength: clampSlider(value?.lineLength, 50),
    lineWidth: clampSlider(value?.lineWidth, 50),
    fullbackPositioning: clampSlider(value?.fullbackPositioning, 50),
    tackleAggression: clampSlider(value?.tackleAggression, 50),
  })
  return {
    user: side(input?.user),
    cpu: side(input?.cpu),
    refereeStrictness: clampSlider(input?.refereeStrictness, 50),
    injuryFrequency: clampSlider(input?.injuryFrequency, 50),
  }
}

interface Profile {
  pace: number
  dribble: number
  pass: number
  shoot: number
  defend: number
  physical: number
  aerial: number
  stamina: number
  technique: number
  mentality: number
  gk: number
}

type RawPlayer = {
  name: string
  no: number
  pos: PositionCode
  sec?: PositionCode[]
  h: number
  age: number
  foot: Foot
  p: [number, number, number, number, number, number, number, number, number, number, number]
}

const clamp99 = (n: number) => Math.max(35, Math.min(99, Math.round(n)))
const clamp8 = (n: number) => Math.max(1, Math.min(8, Math.round(n)))
const hash = (s: string) => [...s].reduce((a, c) => ((a * 31) + c.charCodeAt(0)) >>> 0, 7)
const jitter = (seed: string, salt: number, range = 2) => ((hash(seed) >> (salt % 16)) % (range * 2 + 1)) - range

function profile(p: RawPlayer['p']): Profile {
  return {
    pace: p[0], dribble: p[1], pass: p[2], shoot: p[3], defend: p[4], physical: p[5],
    aerial: p[6], stamina: p[7], technique: p[8], mentality: p[9], gk: p[10],
  }
}

function group(pos: PositionCode): 'GK' | 'DF' | 'MF' | 'FW' {
  if (pos === 'GK') return 'GK'
  if (['LB', 'LCB', 'CB', 'RCB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'DF'
  if (['LW', 'RW', 'ST', 'LST', 'RST'].includes(pos)) return 'FW'
  return 'MF'
}

function attributes(raw: RawPlayer): PesAttributes {
  const p = profile(raw.p)
  const g = group(raw.pos)
  const j = (salt: number) => jitter(raw.name, salt)
  const attackBase = g === 'FW' ? 76 : g === 'MF' ? 66 : g === 'DF' ? 48 : 35
  const defenceBase = g === 'DF' ? 76 : g === 'MF' ? 58 : g === 'FW' ? 38 : 45
  const weakBase = raw.foot === 'B' ? 7 : 4 + (p.technique > 88 ? 1 : 0)
  return {
    attack: clamp99(attackBase + (p.shoot + p.pass + p.dribble - 210) / 6 + j(1)),
    defence: clamp99(defenceBase + (p.defend - 70) * 0.55 + j(2)),
    balance: clamp99(p.physical + j(3)),
    stamina: clamp99(p.stamina + j(4)),
    topSpeed: clamp99(p.pace + j(5)),
    acceleration: clamp99(p.pace * 0.82 + p.dribble * 0.18 + j(6)),
    response: clamp99((p.technique + p.mentality + p.defend) / 3 + 5 + j(7)),
    agility: clamp99(p.dribble * 0.72 + p.pace * 0.28 + j(8)),
    dribbleAccuracy: clamp99(p.dribble + j(9)),
    dribbleSpeed: clamp99(p.dribble * 0.58 + p.pace * 0.42 + j(10)),
    shortPassAccuracy: clamp99(p.pass + j(11)),
    shortPassSpeed: clamp99(p.pass * 0.72 + p.technique * 0.28 + j(12)),
    longPassAccuracy: clamp99(p.pass * 0.94 + p.technique * 0.06 + j(13)),
    longPassSpeed: clamp99(p.pass * 0.62 + p.physical * 0.38 + j(14)),
    shotAccuracy: clamp99(p.shoot + j(15)),
    shotPower: clamp99(p.shoot * 0.55 + p.physical * 0.45 + j(16)),
    shotTechnique: clamp99(p.shoot * 0.55 + p.technique * 0.45 + j(17)),
    freeKickAccuracy: clamp99(p.pass * 0.52 + p.shoot * 0.28 + p.technique * 0.2 - 4 + j(18)),
    curling: clamp99(p.technique * 0.62 + p.pass * 0.38 + j(19)),
    header: clamp99(p.aerial + j(20)),
    jump: clamp99(p.aerial * 0.72 + p.physical * 0.28 + (raw.h - 180) * 0.35 + j(21)),
    technique: clamp99(p.technique + j(22)),
    aggression: clamp99((g === 'FW' ? 76 : g === 'MF' ? 68 : 58) + (p.stamina - 75) / 4 + j(23)),
    mentality: clamp99(p.mentality + j(24)),
    gkSkills: clamp99(g === 'GK' ? p.gk : 45 + p.defend / 12),
    teamwork: clamp99((p.pass + p.defend + p.stamina + p.mentality) / 4 + 6 + j(25)),
    consistency: clamp8(4 + (hash(raw.name) % 5) / 1.4),
    condition: clamp8(4 + ((hash(raw.name) >> 5) % 5) / 1.3),
    weakFootAccuracy: clamp8(weakBase + (hash(raw.name) % 2)),
    weakFootFrequency: clamp8(weakBase - 1 + ((hash(raw.name) >> 3) % 3)),
    injuryTolerance: p.stamina >= 86 ? 'A' : p.stamina <= 68 ? 'C' : 'B',
  }
}

function stars(raw: RawPlayer, a: PesAttributes): PesStar[] {
  const p = profile(raw.p)
  const out = new Set<PesStar>()
  const g = group(raw.pos)
  if (p.dribble >= 84) out.add('Dribbling')
  if (p.dribble >= 79 && p.technique >= 84) out.add('Tactical Dribble')
  if (g === 'FW' && a.attack >= 82) out.add('Positioning')
  if ((p.pace >= 86 && a.response >= 78) || (g === 'GK' && a.response >= 86)) out.add('Reaction')
  if (g === 'MF' && p.pass >= 87) out.add('Playmaking')
  if (p.pass >= 85) out.add('Passing')
  if (g === 'FW' && p.shoot >= 84) out.add('Scoring')
  if (g === 'FW' && p.shoot >= 82 && p.technique >= 80) out.add('1-on-1 Scoring')
  if (p.physical >= 83 && p.aerial >= 78 && (g === 'FW' || raw.pos === 'DM')) out.add('Post Player')
  if ((g === 'FW' && p.pace >= 84) || (g === 'DF' && a.teamwork >= 82)) out.add('Lines')
  if (p.shoot >= 80 && g !== 'GK') out.add('Middle Shooting')
  if (['LB', 'RB', 'LWB', 'RWB', 'LM', 'RM', 'LW', 'RW'].includes(raw.pos)) out.add('Side')
  if (['DM', 'LDM', 'RDM', 'LCM', 'CM', 'RCM', 'CAM', 'CB', 'LCB', 'RCB'].includes(raw.pos)) out.add('Centre')
  if (p.shoot >= 87 && p.mentality >= 84) out.add('Penalties')
  if (p.pass >= 82 && p.technique >= 82) out.add('1-Touch Pass')
  if (p.technique >= 86) out.add('Outside')
  if (p.defend >= 82) out.add('Marking')
  if (p.defend >= 80 && p.physical >= 76) out.add('Sliding')
  if ((g === 'DF' || raw.pos.includes('DM')) && a.teamwork >= 80) out.add('Covering')
  if (['LCB', 'CB', 'RCB'].includes(raw.pos) && p.defend >= 84 && p.mentality >= 82) out.add('D-Line Control')
  if (g === 'GK' && p.gk >= 84) out.add('Penalty Stopper')
  if (g === 'GK' && p.gk >= 82 && a.response >= 82) out.add('1-on-1 Stopper')
  if (['LB', 'RB', 'LWB', 'RWB', 'LCB', 'RCB'].includes(raw.pos) && p.physical >= 82 && raw.h >= 182) out.add('Long Throw')
  return [...out]
}

function player(teamId: TeamId, raw: RawPlayer, index: number): GamePlayer {
  const a = attributes(raw)
  const forms: FormArrow[] = ['normal', 'good', 'normal', 'top', 'normal', 'poor', 'good']
  return {
    id: `${teamId}-${raw.no}-${index}`,
    teamId,
    name: raw.name,
    number: raw.no,
    position: raw.pos,
    secondaryPositions: raw.sec ?? [],
    age: raw.age,
    heightCm: raw.h,
    weightKg: Math.round(raw.h * 0.42 - 4),
    foot: raw.foot,
    favouredSide: raw.pos.startsWith('L') ? 'L' : raw.pos.startsWith('R') ? 'R' : 'B',
    attributes: a,
    stars: stars(raw, a),
    form: forms[(hash(raw.name) + index) % forms.length]!,
  }
}

// Raw profile order: pace, dribble, pass, shoot, defend, physical, aerial,
// stamina, technique, mentality, goalkeeping. This is a compact editorial
// profile used to derive the full PES sheet; the derived sheet is what the UI
// and engine use.
const BRACELONIA_RAW: RawPlayer[] = [
  { name: 'Juan Garcea', no: 1, pos: 'GK', h: 191, age: 25, foot: 'R', p: [68, 62, 78, 35, 64, 82, 78, 66, 72, 84, 90] },
  { name: 'Jules Koundéir', no: 23, pos: 'RB', sec: ['RCB'], h: 180, age: 27, foot: 'R', p: [82, 76, 80, 58, 86, 78, 75, 84, 80, 84, 45] },
  { name: 'Pau Cubanti', no: 5, pos: 'LCB', h: 184, age: 19, foot: 'R', p: [76, 72, 84, 52, 87, 76, 80, 78, 82, 85, 45] },
  { name: 'Erik Garzo', no: 24, pos: 'RCB', sec: ['DM'], h: 182, age: 25, foot: 'R', p: [74, 74, 85, 55, 83, 74, 76, 80, 84, 82, 45] },
  { name: 'Alex Baldero', no: 3, pos: 'LB', sec: ['LWB', 'LM'], h: 175, age: 23, foot: 'L', p: [93, 82, 76, 60, 76, 68, 62, 86, 79, 78, 45] },
  { name: 'Rodrico Hernaz', no: 16, pos: 'DM', sec: ['CM'], h: 191, age: 30, foot: 'R', p: [68, 82, 94, 79, 89, 85, 80, 87, 90, 93, 45] },
  { name: 'Frankie de Jongh', no: 21, pos: 'LCM', sec: ['DM', 'RCM'], h: 181, age: 29, foot: 'R', p: [80, 88, 91, 72, 78, 74, 70, 88, 91, 86, 45] },
  { name: 'Pedrilho', no: 8, pos: 'RCM', sec: ['LCM', 'CAM'], h: 174, age: 23, foot: 'R', p: [77, 91, 92, 78, 68, 62, 58, 85, 94, 87, 45] },
  { name: 'Yemi Lawal', no: 19, pos: 'RW', sec: ['LW'], h: 180, age: 19, foot: 'L', p: [94, 95, 86, 87, 42, 64, 62, 79, 94, 86, 45] },
  { name: 'Gabby Jesulo', no: 9, pos: 'ST', sec: ['LW', 'RW'], h: 175, age: 29, foot: 'R', p: [86, 87, 82, 85, 55, 72, 74, 88, 86, 84, 45] },
  { name: 'Rafinher', no: 11, pos: 'LW', sec: ['RW'], h: 176, age: 29, foot: 'L', p: [91, 89, 86, 88, 58, 69, 68, 90, 88, 87, 45] },
  { name: 'Voytek Shensny', no: 25, pos: 'GK', h: 196, age: 36, foot: 'R', p: [58, 55, 72, 32, 60, 85, 84, 60, 68, 88, 87] },
  { name: 'João Cancelaro', no: 2, pos: 'RB', sec: ['LB', 'RWB'], h: 182, age: 32, foot: 'R', p: [83, 86, 88, 72, 74, 70, 66, 82, 89, 80, 45] },
  { name: 'Andre Kristensen', no: 15, pos: 'CB', sec: ['DM'], h: 188, age: 30, foot: 'R', p: [72, 70, 80, 57, 85, 82, 84, 76, 78, 84, 45] },
  { name: 'Gerard Martiño', no: 18, pos: 'LB', sec: ['LCB'], h: 184, age: 24, foot: 'L', p: [84, 74, 78, 62, 79, 76, 74, 83, 77, 79, 45] },
  { name: 'Gavio', no: 6, pos: 'CM', sec: ['DM', 'CAM'], h: 173, age: 22, foot: 'R', p: [79, 86, 86, 70, 76, 68, 64, 91, 88, 88, 45] },
  { name: 'Fermin Lopaz', no: 30, pos: 'CAM', sec: ['CM'], h: 174, age: 23, foot: 'R', p: [82, 84, 82, 84, 62, 68, 66, 88, 84, 84, 45] },
  { name: 'Dario Olmo', no: 20, pos: 'CAM', sec: ['LW'], h: 179, age: 28, foot: 'R', p: [80, 89, 88, 84, 56, 66, 70, 78, 91, 84, 45] },
  { name: 'Karin Ademiyi', no: 17, pos: 'LW', sec: ['ST', 'RW'], h: 180, age: 24, foot: 'L', p: [96, 86, 76, 82, 45, 68, 66, 82, 82, 78, 45] },
  { name: 'Anton Gordano', no: 22, pos: 'LW', sec: ['RW', 'ST'], h: 182, age: 25, foot: 'R', p: [90, 84, 80, 84, 58, 78, 76, 89, 83, 85, 45] },
  { name: 'Dominik Livaković', no: 13, pos: 'GK', h: 188, age: 31, foot: 'R', p: [62, 54, 68, 30, 58, 80, 76, 63, 64, 82, 83] },
  { name: 'Xavi', no: 26, pos: 'RB', sec: ['LB'], h: 176, age: 19, foot: 'R', p: [86, 76, 74, 56, 74, 68, 64, 82, 76, 76, 45] },
  { name: 'Brian Farinós', no: 14, pos: 'CM', sec: ['LW'], h: 172, age: 20, foot: 'R', p: [80, 83, 79, 70, 60, 62, 56, 80, 82, 76, 45] },
  { name: 'Marcos Bernaldes', no: 28, pos: 'DM', h: 191, age: 19, foot: 'L', p: [72, 78, 84, 62, 79, 80, 78, 80, 82, 80, 45] },
  { name: 'Rooni Bardji', no: 27, pos: 'RW', h: 173, age: 20, foot: 'L', p: [87, 86, 78, 80, 42, 62, 58, 76, 85, 78, 45] },
  { name: 'Hamza Abdelkarim', no: 29, pos: 'ST', h: 184, age: 18, foot: 'R', p: [85, 76, 70, 80, 38, 76, 78, 78, 75, 76, 45] },
]

const BANYARN_RAW: RawPlayer[] = [
  { name: 'Manuel Neuwer', no: 1, pos: 'GK', h: 193, age: 40, foot: 'R', p: [72, 68, 86, 38, 68, 86, 82, 68, 78, 94, 92] },
  { name: 'Josip Stanisic', no: 44, pos: 'RB', sec: ['CB', 'LB'], h: 187, age: 26, foot: 'R', p: [79, 74, 80, 58, 84, 80, 78, 84, 79, 84, 45] },
  { name: 'Dayo Upamekano', no: 2, pos: 'RCB', h: 186, age: 27, foot: 'R', p: [86, 72, 78, 54, 88, 92, 84, 80, 76, 80, 45] },
  { name: 'Kim Min-Jae', no: 3, pos: 'LCB', h: 190, age: 29, foot: 'R', p: [84, 70, 79, 55, 92, 94, 88, 85, 77, 88, 45] },
  { name: 'Alfonzo Daviz', no: 19, pos: 'LB', sec: ['LWB', 'LW'], h: 183, age: 25, foot: 'L', p: [97, 87, 80, 68, 78, 74, 66, 88, 84, 82, 45] },
  { name: 'Joss Kimmish', no: 6, pos: 'RDM', sec: ['RB', 'CM'], h: 177, age: 31, foot: 'R', p: [74, 82, 94, 76, 84, 76, 70, 90, 90, 92, 45] },
  { name: 'Alex Pavlovich', no: 45, pos: 'LDM', sec: ['CM'], h: 188, age: 22, foot: 'R', p: [73, 78, 88, 74, 84, 82, 78, 86, 84, 85, 45] },
  { name: 'Michel Oliseer', no: 17, pos: 'RW', sec: ['CAM'], h: 180, age: 24, foot: 'L', p: [89, 92, 89, 87, 48, 68, 64, 83, 92, 85, 45] },
  { name: 'Jamal Musiara', no: 42, pos: 'CAM', sec: ['LW'], h: 184, age: 23, foot: 'R', p: [86, 96, 88, 85, 54, 66, 68, 82, 95, 86, 45] },
  { name: 'Luiz Díaz', no: 14, pos: 'LW', sec: ['RW'], h: 178, age: 29, foot: 'R', p: [93, 90, 82, 84, 58, 68, 72, 90, 87, 85, 45] },
  { name: 'Harri Cane', no: 9, pos: 'ST', sec: ['CAM'], h: 188, age: 33, foot: 'R', p: [72, 83, 90, 96, 46, 85, 90, 84, 90, 95, 45] },
  { name: 'Voytek Shensny', no: 26, pos: 'GK', h: 199, age: 35, foot: 'R', p: [56, 50, 66, 28, 55, 86, 82, 58, 62, 82, 82] },
  { name: 'Jonas Tarr', no: 4, pos: 'CB', h: 195, age: 30, foot: 'R', p: [74, 66, 78, 56, 87, 91, 90, 79, 74, 86, 45] },
  { name: 'Hiro Ito', no: 21, pos: 'LCB', sec: ['LB'], h: 188, age: 27, foot: 'L', p: [78, 72, 82, 55, 84, 80, 82, 80, 79, 82, 45] },
  { name: 'Sasha Boye', no: 23, pos: 'RB', sec: ['RWB'], h: 178, age: 26, foot: 'R', p: [88, 78, 75, 60, 79, 78, 68, 85, 78, 80, 45] },
  { name: 'Konner Laimar', no: 27, pos: 'CM', sec: ['RB', 'DM'], h: 180, age: 29, foot: 'R', p: [85, 79, 82, 68, 82, 78, 68, 94, 81, 88, 45] },
  { name: 'Lennart Karl', no: 46, pos: 'CAM', sec: ['RW'], h: 168, age: 18, foot: 'L', p: [84, 89, 84, 82, 46, 58, 54, 78, 89, 80, 45] },
  { name: 'Ismail Saibari', no: 34, pos: 'CAM', sec: ['CM'], h: 185, age: 25, foot: 'R', p: [82, 86, 84, 83, 62, 80, 74, 86, 86, 82, 45] },
  { name: 'Serge Gnabry', no: 7, pos: 'LW', sec: ['RW', 'ST'], h: 176, age: 31, foot: 'R', p: [89, 86, 80, 86, 50, 74, 70, 82, 85, 82, 45] },
  { name: 'Tim Binder', no: 11, pos: 'ST', sec: ['LW'], h: 184, age: 21, foot: 'R', p: [88, 80, 74, 82, 42, 78, 76, 80, 79, 78, 45] },
  { name: 'Jonah Urbig', no: 40, pos: 'GK', h: 189, age: 23, foot: 'R', p: [66, 58, 72, 30, 58, 80, 76, 64, 68, 80, 82] },
  { name: 'Nate Brown', no: 32, pos: 'LB', sec: ['LWB', 'LM'], h: 180, age: 23, foot: 'L', p: [88, 80, 78, 62, 76, 70, 64, 86, 80, 78, 45] },
  { name: 'Tomas Bischof', no: 20, pos: 'CM', sec: ['DM'], h: 176, age: 21, foot: 'L', p: [78, 82, 86, 72, 74, 68, 62, 84, 85, 80, 45] },
  { name: 'David Daiber', no: 47, pos: 'DM', h: 184, age: 19, foot: 'R', p: [74, 74, 80, 58, 78, 76, 72, 80, 78, 78, 45] },
  { name: 'Maycon Cardoso', no: 48, pos: 'RW', h: 175, age: 19, foot: 'L', p: [90, 84, 76, 78, 40, 62, 60, 78, 82, 75, 45] },
  { name: 'Bara Ndiaye', no: 49, pos: 'ST', h: 185, age: 18, foot: 'R', p: [89, 78, 70, 80, 38, 78, 76, 80, 76, 76, 45] },
]

export const GAME_TEAMS: GameTeam[] = [
  {
    id: 'bracelonia',
    name: 'Bracelonia',
    shortName: 'BRA',
    color: '#2456a6',
    secondaryColor: '#a50044',
    textColor: '#ffffff',
    gkColor: '#f5a524',
    defaultFormation: '4-3-3',
    identity: {
      buildUp: 'Patient positional build-up into a 3-2-5, close support and third-man combinations.',
      press: 'High press with an immediate five-second counterpress.',
      defensiveShape: '4-4-2, very high line and coordinated offside trap.',
      lineHeight: 80, pressing: 82, compactness: 62, support: 74, width: 68, directness: 35, tempo: 58, offsideTrap: 88,
    },
    players: BRACELONIA_RAW.map((p, i) => player('bracelonia', p, i)),
  },
  {
    id: 'banyarn',
    name: 'Banyarn Munic',
    shortName: 'BAM',
    color: '#c8102e',
    secondaryColor: '#ffffff',
    textColor: '#ffffff',
    gkColor: '#f5a524',
    defaultFormation: '4-2-3-1',
    identity: {
      buildUp: 'Attract pressure, then play vertically into wide overloads and a loaded box.',
      press: 'Aggressive player-oriented high press and counterpress.',
      defensiveShape: '4-4-2, high line protected by a sweeper-keeper.',
      lineHeight: 73, pressing: 87, compactness: 58, support: 64, width: 79, directness: 68, tempo: 73, offsideTrap: 68,
    },
    players: BANYARN_RAW.map((p, i) => player('banyarn', p, i)),
  },
]

export const getTeam = (id: TeamId) => GAME_TEAMS.find((t) => t.id === id)!
export const getPlayer = (id: string) => GAME_TEAMS.flatMap((t) => t.players).find((p) => p.id === id)

export interface FormationSlotTemplate {
  id: string
  position: PositionCode
  x: number
  y: number
}

const slot = (id: string, position: PositionCode, x: number, y: number): FormationSlotTemplate => ({ id, position, x, y })

export const FORMATIONS: Record<string, FormationSlotTemplate[]> = {
  '4-3-3': [
    slot('gk', 'GK', 5, 34), slot('lb', 'LB', 19, 10), slot('lcb', 'LCB', 14, 26), slot('rcb', 'RCB', 14, 42), slot('rb', 'RB', 19, 58),
    slot('dm', 'DM', 32, 34), slot('lcm', 'LCM', 44, 22), slot('rcm', 'RCM', 44, 46),
    slot('lw', 'LW', 63, 10), slot('st', 'ST', 69, 34), slot('rw', 'RW', 63, 58),
  ],
  '4-2-3-1': [
    slot('gk', 'GK', 5, 34), slot('lb', 'LB', 19, 10), slot('lcb', 'LCB', 14, 26), slot('rcb', 'RCB', 14, 42), slot('rb', 'RB', 19, 58),
    slot('ldm', 'LDM', 31, 26), slot('rdm', 'RDM', 31, 42), slot('lm', 'LM', 51, 11), slot('cam', 'CAM', 53, 34), slot('rm', 'RM', 51, 57),
    slot('st', 'ST', 69, 34),
  ],
  '4-4-2': [
    slot('gk', 'GK', 5, 34), slot('lb', 'LB', 18, 10), slot('lcb', 'LCB', 14, 26), slot('rcb', 'RCB', 14, 42), slot('rb', 'RB', 18, 58),
    slot('lm', 'LM', 40, 10), slot('lcm', 'LCM', 38, 26), slot('rcm', 'RCM', 38, 42), slot('rm', 'RM', 40, 58),
    slot('lst', 'LST', 66, 26), slot('rst', 'RST', 66, 42),
  ],
  '3-5-2': [
    slot('gk', 'GK', 5, 34), slot('lcb', 'LCB', 15, 18), slot('cb', 'CB', 13, 34), slot('rcb', 'RCB', 15, 50),
    slot('lwb', 'LWB', 38, 7), slot('dm', 'DM', 33, 34), slot('lcm', 'LCM', 44, 23), slot('rcm', 'RCM', 44, 45), slot('rwb', 'RWB', 38, 61),
    slot('lst', 'LST', 67, 26), slot('rst', 'RST', 67, 42),
  ],
  '3-4-3': [
    slot('gk', 'GK', 5, 34), slot('lcb', 'LCB', 15, 18), slot('cb', 'CB', 13, 34), slot('rcb', 'RCB', 15, 50),
    slot('lm', 'LM', 38, 8), slot('lcm', 'LCM', 36, 26), slot('rcm', 'RCM', 36, 42), slot('rm', 'RM', 38, 60),
    slot('lw', 'LW', 62, 12), slot('st', 'ST', 68, 34), slot('rw', 'RW', 62, 56),
  ],
  '5-3-2': [
    slot('gk', 'GK', 5, 34), slot('lwb', 'LWB', 24, 7), slot('lcb', 'LCB', 15, 19), slot('cb', 'CB', 13, 34), slot('rcb', 'RCB', 15, 49), slot('rwb', 'RWB', 24, 61),
    slot('lcm', 'LCM', 38, 22), slot('dm', 'DM', 34, 34), slot('rcm', 'RCM', 38, 46),
    slot('lst', 'LST', 65, 26), slot('rst', 'RST', 65, 42),
  ],
}

export type ArrowDirection = 'none' | 'forward' | 'back' | 'inside' | 'outside' | 'forward-inside' | 'forward-outside'

export interface PlanSlot {
  slotId: string
  playerId: string
  x: number
  y: number
  attackArrow: ArrowDirection
  defenceArrow: ArrowDirection
  /**
   * Position role (EA FC-style). Optional so old saved plans keep working:
   * a missing role falls back to the default for the slot's position.
   */
  role?: string
}

export interface TeamPlan {
  teamId: TeamId
  name: string
  formation: string
  slots: PlanSlot[]
  benchIds: string[]
  captainId: string
  sliders: {
    lineHeight: number
    pressing: number
    compactness: number
    support: number
    width: number
    directness: number
    tempo: number
    offsideTrap: number
  }
  strategies: string[]
  setPieces: {
    leftCorner: string
    rightCorner: string
    penalty: string
    longFreeKick: string
    shortFreeKick: string
    attackingCorner: string
    defendingCorner: string
    assignmentMode: 'auto' | 'manual'
    primaryTarget: string
    secondaryTarget: string
    edgePlayer: string
  }
}

function compatibility(playerPos: PositionCode, player: GamePlayer, slotPos: PositionCode): number {
  if (playerPos === slotPos) return 100
  if (player.secondaryPositions.includes(slotPos)) return 88
  const compatible: Partial<Record<PositionCode, PositionCode[]>> = {
    LCB: ['CB', 'RCB', 'LB'], CB: ['LCB', 'RCB'], RCB: ['CB', 'LCB', 'RB'],
    LB: ['LWB', 'LM'], RB: ['RWB', 'RM'], LWB: ['LB', 'LM'], RWB: ['RB', 'RM'],
    DM: ['LDM', 'RDM', 'CM'], LDM: ['DM', 'LCM'], RDM: ['DM', 'RCM'],
    LCM: ['CM', 'LDM', 'CAM'], CM: ['LCM', 'RCM', 'DM'], RCM: ['CM', 'RDM', 'CAM'],
    LM: ['LW', 'LWB'], RM: ['RW', 'RWB'], CAM: ['CM', 'ST'], LW: ['LM', 'ST'], RW: ['RM', 'ST'],
    ST: ['LST', 'RST', 'LW', 'RW'], LST: ['ST', 'RST'], RST: ['ST', 'LST'],
  }
  if (compatible[playerPos]?.includes(slotPos)) return 78
  if (group(playerPos) === group(slotPos)) return 62
  return 35
}

export function positionOverall(player: GamePlayer, slotPos: PositionCode): number {
  const a = player.attributes
  const g = group(slotPos)
  const base = g === 'GK'
    ? a.gkSkills * 0.72 + a.response * 0.14 + a.jump * 0.07 + a.mentality * 0.07
    : g === 'DF'
      ? a.defence * 0.28 + a.balance * 0.14 + a.response * 0.14 + a.topSpeed * 0.1 + a.header * 0.1 + a.shortPassAccuracy * 0.1 + a.stamina * 0.07 + a.teamwork * 0.07
      : g === 'MF'
        ? a.shortPassAccuracy * 0.2 + a.technique * 0.18 + a.dribbleAccuracy * 0.13 + a.teamwork * 0.12 + a.stamina * 0.1 + a.response * 0.1 + a.attack * 0.09 + a.defence * 0.08
        : a.attack * 0.2 + a.shotAccuracy * 0.2 + a.dribbleSpeed * 0.14 + a.topSpeed * 0.12 + a.technique * 0.12 + a.response * 0.1 + a.header * 0.06 + a.aggression * 0.06
  return Math.round(base * (compatibility(player.position, player, slotPos) / 100) + formModifier(player.form))
}

export function formModifier(form: FormArrow): number {
  return form === 'top' ? 4 : form === 'good' ? 2 : form === 'poor' ? -2 : form === 'terrible' ? -4 : 0
}

export function effectiveAttribute(player: GamePlayer, key: keyof PesAttributes): number {
  const raw = player.attributes[key]
  if (typeof raw === 'string') return raw === 'A' ? 3 : raw === 'B' ? 2 : 1
  const highImpact = ['attack', 'defence', 'acceleration', 'response', 'agility', 'jump', 'shotPower', 'stamina', 'mentality'].includes(key)
  const lowImpact = ['balance', 'shortPassSpeed', 'longPassSpeed'].includes(key)
  const pct = player.form === 'top' ? (highImpact ? 0.12 : lowImpact ? 0.06 : 0.09)
    : player.form === 'good' ? (highImpact ? 0.06 : lowImpact ? 0.03 : 0.048)
      : player.form === 'poor' ? (highImpact ? -0.09 : lowImpact ? -0.03 : -0.05)
        : player.form === 'terrible' ? (highImpact ? -0.17 : lowImpact ? -0.06 : -0.1) : 0
  return Math.max(1, Math.min(110, raw * (1 + pct)))
}

/**
 * Local per-player edits. Everything in the PES sheet is editable, plus the
 * preferred foot, which is not an attribute but changes which side of the
 * body a player strikes the ball from.
 */
/**
 * What a wrong-foot strike costs, as a multiplier on the error spread and on
 * the pace of the ball. PES's Weak Foot Accuracy is 1–8; 8 is genuinely
 * two-footed and 1 is a one-footed specialist whose weak side sprays it.
 * Shared by the engine and the Ratings editor so the number on screen and
 * the number in the match are the same one.
 */
export function weakFootPenalty(accuracy: number): { noiseScale: number; powerScale: number } {
  const gap = Math.max(0, Math.min(8, accuracy) - 8) + (8 - Math.max(1, Math.min(8, accuracy)))
  return {
    noiseScale: 1 + gap * 0.115,
    powerScale: 1 - gap * 0.018,
  }
}

export type RatingOverrides = Record<string, Partial<PesAttributes> & { foot?: Foot; stars?: PesStar[] }>

/**
 * The attributes the match engine actually reads. The Ratings sheet only
 * offers these, so nothing on it is decorative: a number you can move is a
 * number the simulation reacts to.
 */
export const ENGINE_ATTRIBUTES: Array<keyof PesAttributes> = [
  'attack', 'defence', 'balance', 'stamina', 'topSpeed', 'acceleration',
  'response', 'agility', 'dribbleAccuracy', 'dribbleSpeed',
  'shortPassAccuracy', 'shortPassSpeed', 'longPassAccuracy', 'longPassSpeed',
  'shotAccuracy', 'shotPower', 'shotTechnique', 'freeKickAccuracy', 'curling',
  'header', 'jump', 'technique', 'aggression', 'mentality', 'gkSkills',
  'teamwork', 'consistency', 'condition', 'weakFootAccuracy',
  'weakFootFrequency', 'injuryTolerance',
]

const RATING_EIGHT_KEYS = new Set<keyof PesAttributes>(['consistency', 'condition', 'weakFootAccuracy', 'weakFootFrequency'])

export function normalizeRatingOverrides(input?: RatingOverrides | null): RatingOverrides {
  if (!input || typeof input !== 'object') return {}
  const out: RatingOverrides = {}
  for (const [playerId, rawOverride] of Object.entries(input)) {
    if (!rawOverride || typeof rawOverride !== 'object') continue
    const clean: Partial<PesAttributes> & { foot?: Foot; stars?: PesStar[] } = {}
    const rawFoot = (rawOverride as { foot?: unknown }).foot
    if (rawFoot === 'L' || rawFoot === 'R' || rawFoot === 'B') clean.foot = rawFoot
    const rawStars = (rawOverride as { stars?: unknown }).stars
    if (Array.isArray(rawStars)) {
      const known = PES_STARS.filter((star) => rawStars.includes(star))
      clean.stars = known
    }
    for (const [key] of PES_ATTRIBUTE_LABELS) {
      const value = (rawOverride as Partial<PesAttributes>)[key]
      if (key === 'injuryTolerance') {
        if (value === 'A' || value === 'B' || value === 'C') clean.injuryTolerance = value
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        const max = RATING_EIGHT_KEYS.has(key) ? 8 : 99
        clean[key] = Math.min(max, Math.max(1, Math.round(value))) as never
      }
    }
    if (Object.keys(clean).length) out[playerId] = clean
  }
  return out
}

export function withRatingOverrides(player: GamePlayer, overrides?: RatingOverrides | null): GamePlayer {
  const override = overrides?.[player.id]
  if (!override || !Object.keys(override).length) return player
  const { foot, stars, ...attributes } = override
  return {
    ...player,
    foot: foot ?? player.foot,
    stars: stars ?? player.stars,
    attributes: {
      ...player.attributes,
      ...attributes,
    },
  }
}

export interface PlayerGameRatings {
  overall: number
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number
  goalkeeping: number
}

/**
 * Compact video-game categories derived from the detailed PES sheet. The
 * underlying sheet is the real-life role/performance profile conversion;
 * these categories simply present it in the quick overall/PAC/SHO language
 * players expect when checking a squad.
 */
export function playerGameRatings(player: GamePlayer, slotPos: PositionCode = player.position): PlayerGameRatings {
  const e = (key: keyof PesAttributes) => effectiveAttribute(player, key)
  const round = (value: number) => Math.max(1, Math.min(99, Math.round(value)))
  const isGk = slotPos === 'GK'
  return {
    overall: positionOverall(player, slotPos),
    pace: round(e('topSpeed') * 0.65 + e('acceleration') * 0.35),
    shooting: round(isGk ? e('shotAccuracy') * 0.35 + e('attack') * 0.2 : e('shotAccuracy') * 0.45 + e('shotTechnique') * 0.25 + e('shotPower') * 0.15 + e('attack') * 0.15),
    passing: round(e('shortPassAccuracy') * 0.52 + e('longPassAccuracy') * 0.24 + e('technique') * 0.14 + e('teamwork') * 0.1),
    dribbling: round(e('dribbleAccuracy') * 0.44 + e('dribbleSpeed') * 0.25 + e('technique') * 0.2 + e('agility') * 0.11),
    defending: round(isGk ? e('gkSkills') * 0.35 + e('defence') * 0.3 + e('response') * 0.2 + e('teamwork') * 0.15 : e('defence') * 0.5 + e('response') * 0.2 + e('balance') * 0.15 + e('teamwork') * 0.15),
    physical: round(e('balance') * 0.35 + e('stamina') * 0.3 + e('jump') * 0.15 + e('header') * 0.2),
    goalkeeping: round(e('gkSkills') * 0.64 + e('response') * 0.2 + e('jump') * 0.16),
  }
}

export function averageGameRatings(players: GamePlayer[]): PlayerGameRatings {
  const empty: PlayerGameRatings = { overall: 0, pace: 0, shooting: 0, passing: 0, dribbling: 0, defending: 0, physical: 0, goalkeeping: 0 }
  if (!players.length) return empty
  const totals = players.reduce<PlayerGameRatings>((sum, player) => {
    const r = playerGameRatings(player)
    return {
      overall: sum.overall + r.overall,
      pace: sum.pace + r.pace,
      shooting: sum.shooting + r.shooting,
      passing: sum.passing + r.passing,
      dribbling: sum.dribbling + r.dribbling,
      defending: sum.defending + r.defending,
      physical: sum.physical + r.physical,
      goalkeeping: sum.goalkeeping + r.goalkeeping,
    }
  }, empty)
  return {
    overall: Math.round(totals.overall / players.length),
    pace: Math.round(totals.pace / players.length),
    shooting: Math.round(totals.shooting / players.length),
    passing: Math.round(totals.passing / players.length),
    dribbling: Math.round(totals.dribbling / players.length),
    defending: Math.round(totals.defending / players.length),
    physical: Math.round(totals.physical / players.length),
    goalkeeping: Math.round(totals.goalkeeping / players.length),
  }
}

function bestForSlot(team: GameTeam, slot: FormationSlotTemplate, used: Set<string>): GamePlayer {
  return team.players
    .filter((p) => !used.has(p.id))
    .sort((a, b) => positionOverall(b, slot.position) - positionOverall(a, slot.position))[0]!
}

export function createDefaultPlan(teamId: TeamId, formation = getTeam(teamId).defaultFormation): TeamPlan {
  const team = getTeam(teamId)
  const used = new Set<string>()
  const defaultXiNames: Record<TeamId, string[]> = {
    bracelonia: ['Juan Garcea', 'Alex Baldero', 'Pau Cubanti', 'Erik Garzo', 'Jules Koundéir', 'Rodrico Hernaz', 'Frankie de Jongh', 'Pedrilho', 'Rafinher', 'Gabby Jesulo', 'Yemi Lawal'],
    banyarn: ['Manuel Neuwer', 'Alfonzo Daviz', 'Kim Min-Jae', 'Dayo Upamekano', 'Josip Stanisic', 'Alex Pavlovich', 'Joss Kimmish', 'Luiz Díaz', 'Jamal Musiara', 'Michel Oliseer', 'Harri Cane'],
  }
  const slots = FORMATIONS[formation]!.map((s, index) => {
    // Use the curated default XI in formation-slot order for each club's
    // default system. For other formations, choose by positional overall.
    const player = formation === team.defaultFormation
      ? team.players.find((p) => p.name === defaultXiNames[teamId][index])!
      : bestForSlot(team, s, used)
    used.add(player.id)
    return {
      slotId: s.id,
      playerId: player.id,
      x: s.x,
      y: s.y,
      attackArrow: (['LB', 'RB', 'LWB', 'RWB', 'LW', 'RW'].includes(s.position)
        ? 'forward'
        : ['LCM', 'RCM', 'LM', 'RM'].includes(s.position)
          ? 'forward-inside'
          : s.position === 'CAM' ? 'forward' : 'none') as ArrowDirection,
      defenceArrow: 'none' as ArrowDirection,
      role: defaultRoleFor(s.position),
    }
  })
  const benchIds = formation === team.defaultFormation
    ? team.players.slice(11, 20).map((p) => p.id)
    : team.players.filter((p) => !used.has(p.id)).sort((a, b) => positionOverall(b, b.position) - positionOverall(a, a.position)).slice(0, 9).map((p) => p.id)
  const starters = slots.map((s) => getPlayer(s.playerId)!)
  const bestDelivery = [...starters].sort((a, b) => (b.attributes.freeKickAccuracy + b.attributes.curling) - (a.attributes.freeKickAccuracy + a.attributes.curling))
  const targets = [...starters].sort((a, b) => (b.attributes.header + b.attributes.jump + b.heightCm / 4) - (a.attributes.header + a.attributes.jump + a.heightCm / 4))
  const penalty = [...starters].sort((a, b) => (b.attributes.shotAccuracy + b.attributes.mentality) - (a.attributes.shotAccuracy + a.attributes.mentality))[0]!
  return {
    teamId,
    name: `${team.name} Match Plan`,
    formation,
    slots,
    benchIds,
    captainId: starters.find((p) => p.attributes.mentality >= 90)?.id ?? starters[0]!.id,
    sliders: { ...team.identity },
    strategies: teamId === 'bracelonia' ? ['Possession', 'Zone Press', 'Offside Trap'] : ['Counter Attack', 'Zone Press', 'Wide Overload'],
    setPieces: {
      leftCorner: bestDelivery.find((p) => p.foot === 'R')?.id ?? bestDelivery[0]!.id,
      rightCorner: bestDelivery.find((p) => p.foot === 'L')?.id ?? bestDelivery[1]?.id ?? bestDelivery[0]!.id,
      penalty: penalty.id,
      longFreeKick: bestDelivery[0]!.id,
      shortFreeKick: bestDelivery[1]?.id ?? bestDelivery[0]!.id,
      attackingCorner: 'Six-yard inswinger',
      defendingCorner: 'Hybrid',
      assignmentMode: 'auto',
      primaryTarget: targets[0]!.id,
      secondaryTarget: targets[1]?.id ?? targets[0]!.id,
      edgePlayer: starters.find((p) => ['DM', 'LDM', 'RDM', 'LCM', 'RCM', 'CM'].includes(p.position))?.id ?? starters[5]!.id,
    },
  }
}

export function rebuildPlanForFormation(plan: TeamPlan, formation: string): TeamPlan {
  const fresh = createDefaultPlan(plan.teamId, formation)
  return {
    ...fresh,
    name: plan.name,
    sliders: plan.sliders,
    strategies: plan.strategies,
    setPieces: plan.setPieces,
  }
}

export function encodePlan(plan: TeamPlan): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(plan))))
}

export function decodePlan(code: string): TeamPlan | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as TeamPlan
    if (!parsed || !GAME_TEAMS.some((t) => t.id === parsed.teamId) || !Array.isArray(parsed.slots) || parsed.slots.length !== 11) return null
    return parsed
  } catch {
    return null
  }
}
