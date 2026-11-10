import type {
  Competition,
  Foot,
  Match,
  MatchEvent,
  Player,
  PlayerMatchMinutes,
  PlayerSeasonStats,
  Position,
  RoleId,
  Season,
  Team,
  TouchPoint,
} from '@/types'
import {
  CUP,
  DEMO_TEAMS,
  FORMATION_SLOTS,
  HEIGHT_RANGES,
  LEAGUES,
  NAME_POOLS,
  ROSTER_LAYOUT,
  SECONDARY_POSITION,
  SHIRT_POOLS,
  STYLE_MODS,
  TEMPLATES,
  TOUCH_ZONES,
  ROUNDS_PLAYED,
  SEASON_LABEL,
  SEASON_START,
  type DemoTeamSeed,
  type LeagueConfig,
} from './reference'
import { gauss, mulberry32, poisson, rand, randInt, weightedPick, type Rng } from '@/lib/rng'

/**
 * Deterministic DEMO dataset generator.
 *
 * Everything produced here is FICTIONAL (spec §19 — label: DEMO). The value
 * of this generator is that every number in the UI is internally consistent,
 * reproducible (same seed → same dataset) and computed through the same
 * analysis formulas that will later run against real imported data.
 */

export const DEMO_SOURCE_NAME = 'Vigor demo dataset (fictional)'
/** Primary league — the Bremya League (England). */
export const DEMO_COMPETITION_ID = 'c-brm'
export const DEMO_SEASON_ID = 's-2026-27-brm'
export const DEMO_CUP_ID = CUP.id
export const DEMO_CUP_SEASON_ID = CUP.seasonId
export const DEMO_LEAGUE_IDS = LEAGUES.map((l) => l.id)

/**
 * Honest scope label for the whole demo dataset: v2 is five leagues plus the
 * Atlantica Cup, so UI copy that says only the primary league would mislabel.
 */
export function datasetScopeLabel(ds: { competitions: Competition[] }): string {
  const comps = ds.competitions
  if (comps.length > 2) {
    const cup = comps[comps.length - 1]!
    const leagues = comps.length - 1
    return `${leagues} leagues + ${cup.name}`
  }
  return comps[0]?.name ?? 'Demo dataset'
}

export interface DemoDataset {
  competition: Competition
  season: Season
  /** All competitions / seasons present in the dataset (league + cup). */
  competitions: Competition[]
  seasons: Season[]
  teams: Team[]
  players: Player[]
  matches: Match[]
  events: MatchEvent[]
  playerMatchMinutes: PlayerMatchMinutes[]
}

/* ------------------------------------------------------------------ */
/* Working structures                                                  */
/* ------------------------------------------------------------------ */

interface RateSet {
  passesAtt: number
  completion: number
  fwdShare: number
  progressive: number
  passesFT: number
  lineBreaking: number
  carries: number
  progCarries: number
  carriesFT: number
  dribbles: number
  dribbleRate: number
  touches: number
  turnovers: number
  buReceptions: number
  buTurnovers: number
  tackles: number
  interceptions: number
  recoveries: number
  recoveriesFT: number
  clearances: number
  aerials: number
  aerialRate: number
  shots: number
  xgQuality: number
  xaRate: number
  /* --- v2 additions --- */
  /** Share of attempted passes that are long (own-half switches, crosses …). */
  longShare: number
  longCompRate: number
  shortCompRate: number
  /** Chances created (passes leading directly to a shot) per 90. */
  chancesRate: number
  /** Metres carried per 90. */
  carryDistRate: number
  /** Ground duels contested per 90 (aerials tracked separately). */
  groundDuels: number
  duelWinRate: number
  tacklesWonRate: number
  shotsBlockedRate: number
  /** Share of aerials won in the attacking third. */
  aerialAttShare: number
  /** 0–100 model estimates (DEMO only, never fabricated for real data). */
  posAtt: number
  posDef: number
  /** Goalkeeper rates. */
  saveRate: number
  xgPrevRate: number
  pensFacedRate: number
  penStopRate: number
}

interface WorkingPlayer {
  id: string
  name: string
  teamId: string
  position: Position
  secondaryPosition: Position
  role: RoleId
  foot: Foot
  dob: string
  heightCm: number
  shirtNumber: number
  quality: number
  rates: RateSet
  depth: number
  byPosition: Map<Position, WorkingPlayer[]>
}

interface StintRow {
  player: WorkingPlayer
  from: number
  to: number
  starter: boolean
  rating: number
  /** Positional prior for this lineup slot (formation-shaped, SofaScore-style). */
  anchor: Zone
}

const clamp01 = (v: number) => Math.min(0.98, Math.max(0.4, v))
const round2 = (v: number) => Math.round(v * 100) / 100

/* ------------------------------------------------------------------ */
/* Positional event coordinates                                        */
/* ------------------------------------------------------------------ */

/**
 * Positional coordinate priors in HOME orientation (attacking toward x=100).
 * Tuned so per-player averages form a recognisable formation shape, the way
 * real average-position maps look (SofaScore lineups): keeper on the goal
 * line, a clear back line just outside the box, fullbacks higher than the
 * centre-backs, and the whole outfield block compact around the middle third
 * of the pitch, with a front line high and wide.
 */
export interface Zone {
  x: number
  y: number
  sx: number
  sy: number
  /** Goalkeeper zone: event-type x-displacements do not apply (already deep). */
  noDx?: boolean
}

const POS_XY: Record<Position, Zone> = {
  GK: { x: 6, y: 50, sx: 2, sy: 7, noDx: true },
  CB: { x: 33, y: 50, sx: 6, sy: 10 },
  LB: { x: 45, y: 84, sx: 8, sy: 7 },
  RB: { x: 45, y: 16, sx: 8, sy: 7 },
  WB: { x: 50, y: 84, sx: 9, sy: 7 },
  DM: { x: 43, y: 50, sx: 7, sy: 12 },
  CM: { x: 51, y: 50, sx: 9, sy: 13 },
  LMF: { x: 51, y: 86, sx: 10, sy: 7 },
  RMF: { x: 51, y: 14, sx: 10, sy: 7 },
  AM: { x: 58, y: 50, sx: 9, sy: 13 },
  LW: { x: 63, y: 86, sx: 10, sy: 7 },
  RW: { x: 63, y: 14, sx: 10, sy: 7 },
  SS: { x: 62, y: 50, sx: 8, sy: 13 },
  CF: { x: 66, y: 50, sx: 7, sy: 11 },
  ST: { x: 67, y: 50, sx: 8, sy: 11 },
}

/**
 * When a formation fields several players in the same position (two CBs, a
 * midfield three, a strike pair …) their slots are spread across the width so
 * the average-position dots read as distinct banks, like real match maps.
 */
const SLOT_SPREAD: Partial<Record<Position, number>> = {
  CB: 13,
  DM: 9,
  CM: 13,
  ST: 13,
}

/** x-displacement by event type relative to the player's positional zone. */
const TYPE_DX: Partial<Record<MatchEvent['type'], number>> = {
  turnover: -3,
  recovery: -10,
  'progressive-carry': 2,
  'chance-created': 9,
  'yellow-card': 0,
  'red-card': 0,
}

/**
 * Event position for a player of the given position, in the team's attacking
 * orientation. Away-team events are rotated 180° (x → 100 − x, y → 100 − y)
 * so both teams attack the correct goal AND keep real flanks: home attacks
 * toward x=100, away toward x=0, and the away right-back ends up on the same
 * touchline as the home left-back, the way real match maps are drawn.
 */
function eventPos(
  rng: Rng,
  zone: Zone,
  type: MatchEvent['type'],
  attackingRight: boolean,
): { x: number; y: number } {
  let x: number
  if (type === 'goal') x = rand(rng, 84, 96)
  else if (type === 'shot') x = rand(rng, 68, 88)
  else x = gauss(rng, zone.x + (zone.noDx ? 0 : (TYPE_DX[type] ?? 0)), zone.sx)
  const y = gauss(rng, zone.y, zone.sy)
  const cx = Math.min(98, Math.max(2, x))
  const cy = Math.min(96, Math.max(4, y))
  return { x: attackingRight ? cx : 100 - cx, y: attackingRight ? cy : 100 - cy }
}

/* ------------------------------------------------------------------ */
/* Round-robin fixtures                                                */
/* ------------------------------------------------------------------ */

function roundRobin(ids: string[]): [string, string][][] {
  const teams = [...ids]
  const n = teams.length
  const rounds: [string, string][][] = []
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = teams[i]!
      const b = teams[n - 1 - i]!
      pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a])
    }
    rounds.push(pairs)
    teams.splice(1, 0, teams.pop()!)
  }
  return rounds
}

/* ------------------------------------------------------------------ */
/* Rates                                                               */
/* ------------------------------------------------------------------ */

/* Position-derived priors for v2 stat fields (ranges are fictional). */
const LONG_SHARE: Record<Position, number> = {
  GK: 0.52, CB: 0.26, LB: 0.2, RB: 0.2, WB: 0.22, DM: 0.18, CM: 0.12,
  LMF: 0.1, RMF: 0.1, AM: 0.1, LW: 0.12, RW: 0.12, SS: 0.12, CF: 0.14, ST: 0.13,
}
const CARRY_LEN: Record<Position, number> = {
  GK: 5, CB: 7, LB: 12, RB: 12, WB: 14, DM: 8, CM: 10,
  LMF: 11, RMF: 11, AM: 11, LW: 15, RW: 15, SS: 10, CF: 8, ST: 8,
}
const GROUND_DUELS: Record<Position, number> = {
  GK: 0.3, CB: 4.5, LB: 4, RB: 4, WB: 4.5, DM: 5, CM: 4,
  LMF: 4.5, RMF: 4.5, AM: 3, LW: 3.5, RW: 3.5, SS: 3, CF: 3.5, ST: 3,
}
const AERIAL_ATT_SHARE: Record<Position, number> = {
  GK: 0.05, CB: 0.1, LB: 0.2, RB: 0.2, WB: 0.15, DM: 0.2, CM: 0.25,
  LMF: 0.3, RMF: 0.3, AM: 0.35, LW: 0.3, RW: 0.3, SS: 0.4, CF: 0.55, ST: 0.5,
}
const BLOCK_SHARE: Record<Position, number> = {
  GK: 0.1, CB: 0.35, LB: 0.3, RB: 0.3, WB: 0.3, DM: 0.3, CM: 0.2,
  LMF: 0.2, RMF: 0.2, AM: 0.1, LW: 0.1, RW: 0.1, SS: 0.05, CF: 0.05, ST: 0.05,
}
const POS_BIAS_ATT: Record<Position, number> = {
  GK: -22, CB: -4, LB: 2, RB: 2, WB: 8, DM: -2, CM: 2,
  LMF: 6, RMF: 6, AM: 10, LW: 12, RW: 12, SS: 14, CF: 8, ST: 10,
}
const POS_BIAS_DEF: Record<Position, number> = {
  GK: 8, CB: 12, LB: 8, RB: 8, WB: 2, DM: 10, CM: 4,
  LMF: -2, RMF: -2, AM: -8, LW: -10, RW: -10, SS: -10, CF: -6, ST: -8,
}

function buildRates(
  rng: Rng,
  position: Position,
  style: string,
  quality: number,
  league?: LeagueConfig,
): RateSet {
  const t = TEMPLATES[position]
  const mods = STYLE_MODS[style as keyof typeof STYLE_MODS] ?? {}
  const lmods = league?.mods ?? {}
  const attack = 0.85 + 0.3 * quality
  const defend = 0.85 + 0.3 * quality
  const jitter = () => rand(rng, 0.85, 1.15)
  const m = (key: keyof typeof t, base: number, mult = 1): number => {
    const styleMod = mods[key] ?? 1
    const leagueMod = lmods[key] ?? 1
    return base * jitter() * styleMod * leagueMod * mult
  }
  const completion = clamp01(m('completion', rand(rng, ...t.completion)))
  const longShare = Math.min(
    0.6,
    LONG_SHARE[position] * rand(rng, 0.7, 1.3) * (lmods.fwdShare ?? 1),
  )
  const clearances = m('clearances', rand(rng, ...t.clearances), defend)
  const saveRate = Math.min(0.88, Math.max(0.55, 0.64 + 0.15 * quality * rand(rng, 0.85, 1.15)))
  return {
    passesAtt: m('passesAtt', rand(rng, ...t.passesAtt)),
    completion,
    fwdShare: Math.min(0.55, m('fwdShare', rand(rng, ...t.fwdShare))),
    progressive: m('progressive', rand(rng, ...t.progressive), attack),
    passesFT: m('passesFT', rand(rng, ...t.passesFT), attack),
    lineBreaking: m('lineBreaking', rand(rng, ...t.lineBreaking), attack),
    carries: m('carries', rand(rng, ...t.carries)),
    progCarries: m('progCarries', rand(rng, ...t.progCarries), attack),
    carriesFT: m('carriesFT', rand(rng, ...t.carriesFT), attack),
    dribbles: m('dribbles', rand(rng, ...t.dribbles), attack),
    dribbleRate: clamp01(rand(rng, ...t.dribbleRate)),
    touches: m('touches', rand(rng, ...t.touches)),
    turnovers: m('turnovers', rand(rng, ...t.turnovers), 1.1 - 0.2 * quality),
    buReceptions: m('buReceptions', rand(rng, ...t.buReceptions)),
    buTurnovers: m('buTurnovers', rand(rng, ...t.buTurnovers), 1.1 - 0.2 * quality),
    tackles: m('tackles', rand(rng, ...t.tackles), defend),
    interceptions: m('interceptions', rand(rng, ...t.interceptions), defend),
    recoveries: m('recoveries', rand(rng, ...t.recoveries), defend),
    recoveriesFT: m('recoveriesFT', rand(rng, ...t.recoveriesFT), defend),
    clearances,
    aerials: m('aerials', rand(rng, ...t.aerials)),
    aerialRate: clamp01(rand(rng, ...t.aerialRate)),
    shots: m('shots', rand(rng, ...t.shots), attack),
    xgQuality: rand(rng, ...t.xgQuality),
    xaRate: m('xaRate', rand(rng, ...t.xaRate), attack),
    /* --- v2 --- */
    longShare,
    longCompRate: Math.min(0.9, Math.max(0.3, (completion - 0.17) * rand(rng, 0.9, 1.1))),
    shortCompRate: Math.min(0.98, Math.max(0.5, (completion + 0.03) * rand(rng, 0.98, 1.02))),
    chancesRate: Math.max(0, (m('xaRate', rand(rng, ...t.xaRate), attack) / 0.09) * rand(rng, 0.8, 1.2)),
    carryDistRate: m('carries', rand(rng, ...t.carries)) * CARRY_LEN[position] * rand(rng, 0.8, 1.2),
    groundDuels: GROUND_DUELS[position] * rand(rng, 0.75, 1.25),
    duelWinRate: Math.min(0.78, Math.max(0.35, 0.42 + 0.28 * quality * rand(rng, 0.85, 1.15))),
    tacklesWonRate: Math.min(0.9, Math.max(0.5, 0.62 + 0.22 * quality * rand(rng, 0.9, 1.1))),
    shotsBlockedRate: clearances * BLOCK_SHARE[position] * rand(rng, 0.7, 1.3),
    aerialAttShare: Math.min(0.75, Math.max(0.02, AERIAL_ATT_SHARE[position] * rand(rng, 0.6, 1.4))),
    posAtt: Math.min(97, Math.max(15, Math.round(30 + 45 * quality * rand(rng, 0.85, 1.15) + POS_BIAS_ATT[position]))),
    posDef: Math.min(97, Math.max(15, Math.round(30 + 45 * quality * rand(rng, 0.85, 1.15) + POS_BIAS_DEF[position]))),
    saveRate,
    xgPrevRate: (saveRate - 0.7) * 4.4,
    pensFacedRate: 0.045 * rand(rng, 0.5, 1.8),
    penStopRate: Math.min(0.4, Math.max(0.06, (0.14 + 0.16 * quality) * rand(rng, 0.7, 1.3))),
  }
}

function roleFor(rng: Rng, position: Position, style: string): RoleId {
  switch (position) {
    case 'GK': return 'goalkeeper'
    case 'CB': return style === 'Possession-oriented' || rng() < 0.5 ? 'ball-playing-cb' : 'aggressive-cb'
    case 'LB':
    case 'RB':
    case 'WB':
      return style === 'Possession-oriented' || style === 'High-pressing' || rng() < 0.5
        ? 'attacking-fb'
        : 'defensive-fb'
    case 'DM': return rng() < 0.55 ? 'deep-lying-playmaker' : 'ball-winner'
    case 'CM': return rng() < 0.6 ? 'box-to-box' : 'deep-lying-playmaker'
    case 'LMF':
    case 'RMF':
      return rng() < 0.5 ? 'winger' : 'box-to-box'
    case 'AM': return 'advanced-playmaker'
    case 'LW':
    case 'RW':
      return rng() < 0.55 ? 'inverted-winger' : 'winger'
    case 'SS': return 'mobile-striker'
    case 'CF': return 'target-forward'
    case 'ST': return rng() < 0.6 ? 'mobile-striker' : 'target-forward'
  }
}

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */

/**
 * Per-league name generator. ~70% of names come from the league's country
 * pool, ~30% from other pools (foreign signings). All full names are unique
 * across the whole dataset.
 */
function makeNameGen(rng: Rng, poolKey: string, used: Set<string>) {
  const local = NAME_POOLS[poolKey]!
  const foreignKeys = Object.keys(NAME_POOLS).filter((k) => k !== poolKey)
  const tryPool = (pool: { first: readonly string[]; last: readonly string[] }): { first: string; last: string } | null => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const first = pool.first[Math.floor(rng() * pool.first.length)]!
      const last = pool.last[Math.floor(rng() * pool.last.length)]!
      if (!used.has(`${first} ${last}`)) return { first, last }
    }
    return null
  }
  return {
    next(): { first: string; last: string } {
      const localName = rng() < 0.7 ? tryPool(local) : null
      if (localName) {
        used.add(`${localName.first} ${localName.last}`)
        return localName
      }
      for (let i = 0; i < 10; i++) {
        const fk = foreignKeys[Math.floor(rng() * foreignKeys.length)]!
        const name = tryPool(NAME_POOLS[fk]!)
        if (name) {
          used.add(`${name.first} ${name.last}`)
          return name
        }
      }
      // Extremely unlikely fallback: deterministic unique placeholder.
      const n = used.size + 1
      const name = { first: local.first[n % local.first.length]!, last: `${local.last[n % local.last.length]}${n}` }
      used.add(`${name.first} ${name.last}`)
      return name
    },
  }
}

/**
 * Classic squad numbers per position (SofaScore-style pitch dots show them).
 * Pools sum to the 24-player ROSTER_LAYOUT exactly (defined in reference.ts);
 * a fallback assigns the smallest unused number if a pool is exhausted.
 */

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

let cached: DemoDataset | null = null

export function buildDemoDataset(): DemoDataset {
  if (cached) return cached
  cached = generate()
  return cached
}

function generate(): DemoDataset {
  const rng = mulberry32(20261015)

  const leagueCompetitions: Competition[] = LEAGUES.map((l) => ({
    id: l.id,
    name: l.name,
    shortName: l.shortName,
    provenance: 'DEMO' as const,
  }))
  const leagueSeasons: Season[] = LEAGUES.map((l) => ({
    id: `s-2026-27-${l.code}`,
    label: SEASON_LABEL,
    competitionId: l.id,
    startDate: SEASON_START,
    endDate: '2027-05-15',
    provenance: 'DEMO' as const,
  }))
  /** Singular primary pointers — the Bremya League (England). */
  const competition = leagueCompetitions[0]!
  const season = leagueSeasons[0]!
  const cupCompetition: Competition = {
    id: CUP.id,
    name: CUP.name,
    shortName: CUP.shortName,
    provenance: 'DEMO',
  }
  const cupSeason: Season = {
    id: CUP.seasonId,
    label: `${SEASON_LABEL} cup`,
    competitionId: CUP.id,
    startDate: SEASON_START,
    endDate: '2027-05-15',
    provenance: 'DEMO',
  }

  const teams: Team[] = DEMO_TEAMS.map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    city: t.city,
    style: t.style,
    formation: t.formation,
    color: t.color,
    provenance: 'DEMO' as const,
    sourceName: DEMO_SOURCE_NAME,
  }))
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const seedById = new Map(DEMO_TEAMS.map((t) => [t.id, t]))

  /* ---------------- Players ---------------- */

  let playerSeq = 0
  const usedNames = new Set<string>()
  const nameGens = new Map<string, ReturnType<typeof makeNameGen>>(
    LEAGUES.map((l) => [l.namePool, makeNameGen(rng, l.namePool, usedNames)]),
  )

  const working: WorkingPlayer[] = []
  const byTeam = new Map<string, Map<Position, WorkingPlayer[]>>()
  const leagueOfTeam = new Map<string, LeagueConfig>()

  for (const seed of DEMO_TEAMS) {
    const league = LEAGUES.find((l) => l.id === seed.leagueId)!
    leagueOfTeam.set(seed.id, league)
    const positionMap = new Map<Position, WorkingPlayer[]>()
    const names = nameGens.get(league.namePool)!
    const shirtPools = new Map<Position, number[]>(
      (Object.keys(SHIRT_POOLS) as Position[]).map((p) => [p, [...SHIRT_POOLS[p]!]]),
    )
    const shirtTaken = new Set<number>()
    const nextShirt = (position: Position): number => {
      const pool = shirtPools.get(position) ?? []
      while (pool.length > 0) {
        const n = pool.shift()!
        if (!shirtTaken.has(n)) {
          shirtTaken.add(n)
          return n
        }
      }
      let n = 30
      while (shirtTaken.has(n)) n += 1
      shirtTaken.add(n)
      return n
    }
    for (const position of ROSTER_LAYOUT) {
      playerSeq += 1
      const nm = names.next()
      const quality = Math.min(0.97, Math.max(0.05, gauss(rng, 0.32 + seed.strength * 0.4, 0.13)))
      // Mix a normal-ish core with a uniform spread so squads contain both
      // teenagers and veterans (the bounded gauss helper has light tails).
      const age = Math.round(
        Math.min(36, Math.max(17, rng() < 0.28 ? rand(rng, 17.5, 35.5) : gauss(rng, 25.5, 4.2))),
      )
      const birthYear = 2026 - age
      const dob = `${birthYear}-${String(randInt(rng, 1, 12)).padStart(2, '0')}-${String(randInt(rng, 1, 28)).padStart(2, '0')}`
      const foot: Foot = rng() < 0.72 ? 'Right' : rng() < 0.75 ? 'Left' : 'Both'
      const wp: WorkingPlayer = {
        id: `p-${String(playerSeq).padStart(4, '0')}`,
        name: `${nm.first} ${nm.last}`,
        teamId: seed.id,
        position,
        secondaryPosition: SECONDARY_POSITION[position][0]!,
        role: roleFor(rng, position, seed.style),
        foot,
        dob,
        heightCm: randInt(rng, HEIGHT_RANGES[position][0], HEIGHT_RANGES[position][1]),
        shirtNumber: nextShirt(position),
        quality,
        rates: buildRates(rng, position, seed.style, quality, league),
        depth: 0,
        byPosition: positionMap,
      }
      working.push(wp)
      const list = positionMap.get(position) ?? []
      list.push(wp)
      positionMap.set(position, list)
    }
    // Depth = quality order within each position
    for (const list of positionMap.values()) {
      list.sort((a, b) => b.quality - a.quality)
      list.forEach((p, i) => (p.depth = i))
    }
    byTeam.set(seed.id, positionMap)
  }

  /* ---------------- Star players ----------------
     Roughly a third of sides carry a genuine match-winner: their best
     attacker gets a big quality bump and more dangerous shooting/creating
     rates, so top-performance lists have standouts. */
  for (const seed of DEMO_TEAMS) {
    const starChance = seed.strength >= 0.75 ? 0.8 : seed.strength >= 0.6 ? 0.4 : 0.18
    if (rng() > starChance) continue
    const posMap = byTeam.get(seed.id)!
    const starSlots: Position[] = ['ST', 'SS', 'CF', 'AM', 'LW', 'RW']
    const candidates = starSlots
      .map((p) => (posMap.get(p) ?? [])[0])
      .filter((p): p is WorkingPlayer => !!p)
    const star = candidates.length > 0 ? candidates[Math.floor(rng() * candidates.length)]! : undefined
    if (!star) continue
    star.quality = Math.min(0.99, Math.max(0.78, star.quality + 0.28))
    star.rates = {
      ...star.rates,
      shots: star.rates.shots * 1.3,
      xgQuality: Math.min(0.24, star.rates.xgQuality * 1.2),
      xaRate: star.rates.xaRate * 1.2,
      dribbles: star.rates.dribbles * 1.15,
      chancesRate: star.rates.chancesRate * 1.25,
      posAtt: Math.min(99, star.rates.posAtt + 8),
    }
    // Re-sort depth lists so the star leads his position.
    for (const list of posMap.values()) {
      list.sort((a, b) => b.quality - a.quality)
      list.forEach((p, i) => (p.depth = i))
    }
  }

  /* ---------------- Fixtures ---------------- */

  /* Fixtures: each league plays the first ROUNDS_PLAYED matchdays of its own
     double round-robin (shared calendar weeks), then a 16-team cross-league
     knockout — the Atlantica Cup — contested by each league's top sides plus
     the best remaining team overall. Cup draws are settled by a one-goal
     nudge (demo convention); winners advance, and later rounds are appended
     to the fixture list as results come in. */
  interface Fixture {
    homeId: string
    awayId: string
    competitionId: string
    seasonId: string
    round: number
    kickoffDay: number
  }
  const fixtures: Fixture[] = []
  for (const league of LEAGUES) {
    const teamIds = DEMO_TEAMS.filter((t) => t.leagueId === league.id).map((t) => t.id)
    const rounds = roundRobin(teamIds).slice(0, ROUNDS_PLAYED)
    for (const [r, pairs] of rounds.entries()) {
      for (const [homeId, awayId] of pairs) {
        fixtures.push({
          homeId,
          awayId,
          competitionId: league.id,
          seasonId: `s-2026-27-${league.code}`,
          round: r + 1,
          kickoffDay: 8 + r * 7,
        })
      }
    }
  }

  // Cup: top 3 per league by strength + best remaining side (16 total),
  // seeded so the strongest sides cannot meet in the Round of 16.
  const cupField: DemoTeamSeed[] = []
  const leftovers: DemoTeamSeed[] = []
  for (const league of LEAGUES) {
    const ranked = DEMO_TEAMS
      .filter((t) => t.leagueId === league.id)
      .sort((a, b) => b.strength - a.strength)
    cupField.push(...ranked.slice(0, CUP.qualifiersPerLeague))
    leftovers.push(...ranked.slice(CUP.qualifiersPerLeague))
  }
  cupField.push(...leftovers.sort((a, b) => b.strength - a.strength).slice(0, CUP.wildcards))
  const cupSeeds = [...cupField].sort((a, b) => b.strength - a.strength)
  for (let i = 0; i < cupSeeds.length / 2; i++) {
    const home = cupSeeds[i]!
    const away = cupSeeds[cupSeeds.length - 1 - i]!
    const flip = rng() < 0.5
    fixtures.push({
      homeId: flip ? away.id : home.id,
      awayId: flip ? home.id : away.id,
      competitionId: CUP.id,
      seasonId: CUP.seasonId,
      round: 1,
      kickoffDay: 8 + ROUNDS_PLAYED * 7 + 3 + i,
    })
  }
  const cupWinners = new Map<number, string[]>()

  const matches: Match[] = []
  const events: MatchEvent[] = []
  const playerMatchMinutes: PlayerMatchMinutes[] = []
  let matchSeq = 0
  let eventSeq = 0
  const nextEventId = () => `e-${String((eventSeq += 1)).padStart(5, '0')}`

  const goalsByPlayer = new Map<string, number>()
  const assistsByPlayer = new Map<string, number>()
  const ratingRows = new Map<string, { goals: number; assists: number }>()

  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1)

  for (const fx of fixtures) {
    {
      const { homeId, awayId, competitionId, seasonId, round, kickoffDay } = fx
      matchSeq += 1
      const homeSeed = seedById.get(homeId)!
      const awaySeed = seedById.get(awayId)!
      const kickoff = new Date(Date.UTC(2026, 7, kickoffDay, 14 + (matchSeq % 3) * 2, 30, 0))
        .toISOString()

      const lambdaHome = Math.min(4.2, 1.35 * Math.pow(homeSeed.strength / awaySeed.strength, 1.6) * 1.12)
      const lambdaAway = Math.min(4.2, 1.35 * Math.pow(awaySeed.strength / homeSeed.strength, 1.6) / 1.12)
      let homeGoals = Math.min(5, poisson(rng, lambdaHome))
      let awayGoals = Math.min(5, poisson(rng, lambdaAway))
      if (competitionId === DEMO_CUP_ID) {
        while (homeGoals === awayGoals) {
          if (rng() < 0.5) homeGoals += 1
          else awayGoals += 1
        }
        const winners = cupWinners.get(round) ?? []
        winners.push(homeGoals > awayGoals ? homeId : awayId)
        cupWinners.set(round, winners)
        // Round of 16 (8 ties) → quarter-finals
        if (round === 1 && winners.length === 8) {
          for (let q = 0; q < 4; q++) {
            fixtures.push({
              homeId: winners[q * 2]!,
              awayId: winners[q * 2 + 1]!,
              competitionId: CUP.id,
              seasonId: CUP.seasonId,
              round: 2,
              kickoffDay: 8 + (ROUNDS_PLAYED + 2) * 7 + q,
            })
          }
        }
        // Quarter-finals (4 ties) → semi-finals
        if (round === 2 && winners.length === 4) {
          for (let s = 0; s < 2; s++) {
            fixtures.push({
              homeId: winners[s * 2]!,
              awayId: winners[s * 2 + 1]!,
              competitionId: CUP.id,
              seasonId: CUP.seasonId,
              round: 3,
              kickoffDay: 8 + (ROUNDS_PLAYED + 3) * 7 + s,
            })
          }
        }
        // Semi-finals (2 ties) → final
        if (round === 3 && winners.length === 2) {
          fixtures.push({
            homeId: winners[0]!,
            awayId: winners[1]!,
            competitionId: CUP.id,
            seasonId: CUP.seasonId,
            round: 4,
            kickoffDay: 8 + (ROUNDS_PLAYED + 4) * 7,
          })
        }
      }

      const stylePoss = (s: string) => (s === 'Possession-oriented' ? 6 : s === 'High-pressing' ? 2 : s === 'Counterattacking' ? -4 : -6)
      const possessionHome = Math.min(72, Math.max(28,
        50 + (homeSeed.strength - awaySeed.strength) * 30
        + stylePoss(homeSeed.style) - stylePoss(awaySeed.style) + gauss(rng, 0, 4)))

      const shotsHome = poisson(rng, lambdaHome * 9 + 6)
      const shotsAway = poisson(rng, lambdaAway * 9 + 6)

      const match: Match = {
        id: `m-${String(matchSeq).padStart(3, '0')}`,
        competitionId,
        seasonId,
        round,
        kickoff,
        homeTeamId: homeId,
        awayTeamId: awayId,
        homeGoals,
        awayGoals,
        venue: homeSeed.venue,
        possessionHome: Math.round(possessionHome),
        shotsHome,
        shotsAway,
        provenance: 'DEMO',
      }
      matches.push(match)

      /* ------- Lineups, substitutions, minutes ------- */

      const lineups = new Map<string, StintRow[]>()
      const availability = new Map<string, boolean>()
      for (const wp of working) availability.set(wp.id, rng() > 0.04)

      const pickLineup = (teamId: string): StintRow[] => {
        const seedT = seedById.get(teamId)!
        const posMap = byTeam.get(teamId)!
        const slots = FORMATION_SLOTS[seedT.formation] ?? FORMATION_SLOTS['4-3-3']!
        // Count duplicates per position so the i-th CB / CM / ST gets its own
        // lateral slot (spread across the width, SofaScore-style banks).
        const slotCounts = new Map<Position, number>()
        for (const s of slots) slotCounts.set(s, (slotCounts.get(s) ?? 0) + 1)
        const slotSeen = new Map<Position, number>()
        const chosen: WorkingPlayer[] = []
        const rows: StintRow[] = []
        for (const slot of slots) {
          const occ = slotSeen.get(slot) ?? 0
          slotSeen.set(slot, occ + 1)
          const k = slotCounts.get(slot) ?? 1
          const base = POS_XY[slot]
          const anchor: Zone = {
            ...base,
            y: base.y + (occ - (k - 1) / 2) * (SLOT_SPREAD[slot] ?? 0),
          }
          const pool = (posMap.get(slot) ?? []).filter((p) => availability.get(p.id) && !chosen.includes(p))
          let player: WorkingPlayer | undefined = pool[0]
          if (!player) {
            // fall back to secondary-position players
            const alt = working.find(
              (p) => p.teamId === teamId && availability.get(p.id) && !chosen.includes(p)
                && (p.position === slot || p.secondaryPosition === slot),
            )
            player = alt ?? working.find((p) => p.teamId === teamId && availability.get(p.id) && !chosen.includes(p))
          } else if (slot !== 'GK' && pool.length > 1 && rng() < 0.1) {
            player = pool[1]
          }
          if (!player) continue
          chosen.push(player)
          rows.push({ player, from: 0, to: 90, starter: true, rating: 0, anchor })
        }

        return rows
      }

      lineups.set(homeId, pickLineup(homeId))
      lineups.set(awayId, pickLineup(awayId))
      /* ------- Match script: injuries, cards & substitutions -------
       * A small scenario engine (max 5 subs per team). Incidents are planned
       * as a minute-ordered queue and executed against the stint windows, so
       * every downstream emitter (goals, shots, passes, tags) automatically
       * respects who is actually on the pitch — red cards and unsubstituted
       * injuries genuinely leave a team with 10. Reasons ride on event notes:
       *   serious injury (any time; tackle ⇒ 6/10 red, 3/10 yellow, 1/10 none)
       *   knock (any time; tackle ⇒ 6/10 yellow, 3/10 red, 1/10 none; sub only
       *     after treatment and only if he cannot continue)
       *   fatigue (45–75', workload / poor-day / big-shift driven, 2–3 men)
       *   late tactical (75–89', protects or chases by scoreline)
       *   bookings: protective subs (early yellow ⇒ off ~20–30' later;
       *     46–60' yellow ⇒ stance-dependent), second yellow ⇒ red,
       *     red for a defender/midfielder ⇒ defensive reinforcement sub.
       */
      const MAX_SUBS = 5
      const DEF_POS: Position[] = ['CB', 'LB', 'RB', 'WB']
      const ATT_POS: Position[] = ['AM', 'LW', 'RW', 'SS', 'CF', 'ST']
      const SERIOUS_INJURIES = ['ACL injury', 'Achilles tendon injury', 'knee hyperextension', 'hamstring tear', 'muscle pull', 'ankle sprain', 'MCL sprain']
      const KNOCKS = ['dead leg', 'knock to the ankle', 'muscle tightness', 'heavy collision', 'rolled ankle']

      interface TeamScript {
        teamId: string
        rows: StintRow[]
        bench: WorkingPlayer[]
        subsUsed: number
        booked: Map<string, number>
      }
      const mkScript = (teamId: string): TeamScript => {
        const rows = lineups.get(teamId) ?? []
        const chosenIds = new Set(rows.map((r) => r.player.id))
        return {
          teamId,
          rows,
          bench: working.filter((p) => p.teamId === teamId && availability.get(p.id) && !chosenIds.has(p.id)),
          subsUsed: 0,
          booked: new Map(),
        }
      }
      const scripts = new Map<string, TeamScript>([
        [homeId, mkScript(homeId)],
        [awayId, mkScript(awayId)],
      ])
      const scriptOf = (teamId: string) => scripts.get(teamId)!
      const opponentOf = (teamId: string) => scriptOf(teamId === homeId ? awayId : homeId)
      const stanceOf = (teamId: string) => {
        const diff = teamId === homeId ? homeGoals - awayGoals : awayGoals - homeGoals
        return diff > 0 ? 'winning' : diff < 0 ? 'losing' : 'drawing'
      }
      const aliveAt = (st: TeamScript, minute: number) =>
        st.rows.filter((r) => minute > r.from && minute <= r.to)
      const formToday = new Map<string, number>()
      for (const st of scripts.values()) {
        for (const r of st.rows) formToday.set(r.player.id, gauss(rng, 0, 1))
      }
      const workload = (r: StintRow) =>
        r.player.rates.touches + r.player.rates.carries * 2 + r.player.rates.recoveries * 2

      const makeSub = (
        st: TeamScript,
        victim: StintRow,
        minute: number,
        note: string,
        prefer: Position[] = [],
        needsGk = false,
        anchorOverride?: StintRow['anchor'],
      ): boolean => {
        if (st.subsUsed >= MAX_SUBS || minute > 89 || victim.to <= minute) return false
        const victimIsGk = needsGk || victim.player.position === 'GK'
        const candidates = st.bench.filter((b) => (victimIsGk ? b.position === 'GK' : b.position !== 'GK'))
        if (candidates.length === 0) return false
        const score = (b: WorkingPlayer) =>
          b.position === victim.player.position
            ? 40
            : b.secondaryPosition === victim.player.position
              ? 30
              : prefer.includes(b.position)
                ? 25 - prefer.indexOf(b.position)
                : DEF_POS.includes(b.position) === DEF_POS.includes(victim.player.position)
                  ? 10
                  : 0
        const best = Math.max(...candidates.map(score))
        const top = candidates.filter((b) => score(b) === best)
        const inPlayer = top[randInt(rng, 0, top.length - 1)]!
        st.bench.splice(st.bench.indexOf(inPlayer), 1)
        victim.to = minute
        st.rows.push({ player: inPlayer, from: minute, to: 90, starter: false, rating: 0, anchor: anchorOverride ?? victim.anchor })
        st.subsUsed += 1
        events.push({
          id: nextEventId(), matchId: match.id, minute, type: 'substitution',
          teamId: st.teamId, playerId: victim.player.id, secondaryPlayerId: inPlayer.id,
          note, provenance: 'DEMO',
        })
        return true
      }

      type QueueKind = 'booking' | 'serious' | 'knock' | 'knock-sub' | 'fatigue' | 'late' | 'protective' | 'red-reinforce' | 'gk-reinforce'
      interface QueueItem { minute: number; kind: QueueKind; teamId: string; victimId?: string }
      const queue: QueueItem[] = []
      const schedule = (minute: number, kind: QueueKind, teamId: string, victimId?: string) => {
        if (minute <= 89) queue.push({ minute, kind, teamId, victimId })
      }

      const sendOff = (st: TeamScript, row: StintRow, minute: number) => {
        row.to = minute
        const pos = row.player.position
        if (pos === 'GK') {
          schedule(minute + 1, 'gk-reinforce', st.teamId)
        } else if ([...DEF_POS, 'DM', 'CM', 'LMF', 'RMF'].includes(pos) && rng() < 0.75) {
          schedule(minute + randInt(rng, 1, 5), 'red-reinforce', st.teamId)
        }
        // A forward's red card: no substitution — the shape just drops a man.
      }

      const giveCard = (st: TeamScript, row: StintRow, minute: number, type: 'yellow-card' | 'red-card', note?: string) => {
        if (row.to <= minute) return
        const secondYellow = type === 'yellow-card' && st.booked.has(row.player.id)
        const actual = secondYellow ? 'red-card' : type
        const pos = eventPos(rng, row.anchor, actual, st.teamId === homeId)
        events.push({
          id: nextEventId(), matchId: match.id, minute, type: actual,
          teamId: st.teamId, playerId: row.player.id, x: pos.x, y: pos.y,
          note: secondYellow ? 'Second yellow card' : note, provenance: 'DEMO',
        })
        if (actual === 'red-card') {
          sendOff(st, row, minute)
          return
        }
        st.booked.set(row.player.id, minute)
        // Protective substitutions for booked players.
        if (minute <= 45 && rng() < 0.35) {
          schedule(minute + randInt(rng, 20, 30), 'protective', st.teamId, row.player.id)
        } else if (minute >= 46 && minute <= 60) {
          const p = stanceOf(st.teamId) === 'winning' ? 0.5 : stanceOf(st.teamId) === 'drawing' ? 0.3 : 0.15
          if (rng() < p) schedule(minute + randInt(rng, 8, 18), 'protective', st.teamId, row.player.id)
        }
      }

      const tacklerCard = (victimTeamId: string, minute: number, severe: boolean) => {
        const opp = opponentOf(victimTeamId)
        const candidates = aliveAt(opp, minute).filter((r) => r.player.position !== 'GK')
        if (candidates.length === 0) return
        const tackler = weightedPick(
          rng, candidates,
          candidates.map((r) => (DEF_POS.includes(r.player.position) ? 5 : r.player.position === 'DM' ? 4 : r.player.position === 'CM' ? 2 : 1)),
        )
        const roll = rng()
        // Serious injury from a tackle: 6/10 red, 3/10 yellow, 1/10 no card.
        // Knock from a tackle: 6/10 yellow, 3/10 red, 1/10 no card.
        if (severe ? roll < 0.6 : roll >= 0.6 && roll < 0.9) giveCard(opp, tackler, minute, 'red-card', 'Foul causing injury')
        else if (severe ? roll < 0.9 : roll < 0.6) giveCard(opp, tackler, minute, 'yellow-card', 'Foul causing injury')
      }

      const emitInjury = (st: TeamScript, row: StintRow, minute: number, note: string) => {
        const pos = eventPos(rng, row.anchor, 'injury', st.teamId === homeId)
        events.push({
          id: nextEventId(), matchId: match.id, minute, type: 'injury',
          teamId: st.teamId, playerId: row.player.id, x: pos.x, y: pos.y, note, provenance: 'DEMO',
        })
      }

      // Plan the incidents.
      for (const st of scripts.values()) {
        const bookings = Math.min(5, poisson(rng, 1.5))
        for (let i = 0; i < bookings; i++) schedule(randInt(rng, 5, 88), 'booking', st.teamId)
        if (rng() < 0.17) schedule(randInt(rng, 5, 86), 'serious', st.teamId)
        if (rng() < 0.02) schedule(randInt(rng, 5, 86), 'serious', st.teamId)
        if (rng() < 0.35) schedule(randInt(rng, 5, 84), 'knock', st.teamId)
        if (rng() < 0.08) schedule(randInt(rng, 5, 84), 'knock', st.teamId)
        // Fatigue: 2–3 of the hardest-working / most extreme-form starters, 45–75'.
        const fatiguePool = st.rows
          .filter((r) => r.starter && r.player.position !== 'GK')
          .sort((a, b) => workload(b) + Math.abs(formToday.get(b.player.id) ?? 0) * 30 - (workload(a) + Math.abs(formToday.get(a.player.id) ?? 0) * 30))
          .slice(0, 6)
        const tiredCount = rng() < 0.2 ? 1 : rng() < 0.35 ? 3 : 2
        for (let i = 0; i < tiredCount && i < fatiguePool.length; i++) {
          schedule(randInt(rng, 45, 75), 'fatigue', st.teamId, fatiguePool[i]!.player.id)
        }
        const lateCount = rng() < 0.7 ? randInt(rng, 1, 2) : 0
        for (let i = 0; i < lateCount; i++) schedule(randInt(rng, 75, 89), 'late', st.teamId)
      }

      // Execute in minute order (handlers may schedule follow-ups).
      let guard = 0
      while (queue.length > 0 && guard++ < 400) {
        queue.sort((a, b) => a.minute - b.minute)
        const item = queue.shift()!
        const st = scriptOf(item.teamId)
        const minute = item.minute
        const alive = aliveAt(st, minute)
        const pickAlive = (rows: StintRow[]) =>
          rows.length > 0 ? rows[randInt(rng, 0, rows.length - 1)] : undefined

        if (item.kind === 'booking') {
          const row = pickAlive(alive)
          if (row) giveCard(st, row, minute, rng() < 0.03 ? 'red-card' : 'yellow-card')
        } else if (item.kind === 'serious') {
          const victim = item.victimId
            ? alive.find((r) => r.player.id === item.victimId)
            : pickAlive(alive.filter((r) => r.starter))
          if (!victim) continue
          const inj = SERIOUS_INJURIES[randInt(rng, 0, SERIOUS_INJURIES.length - 1)]!
          const fromTackle = rng() < 0.75
          emitInjury(st, victim, minute, `Serious injury — ${inj}${fromTackle ? ' (from a tackle)' : ' (awkward landing)'}`)
          if (fromTackle) tacklerCard(st.teamId, minute, true)
          if (!makeSub(st, victim, Math.min(89, minute + 1), `Serious injury — ${inj}`)) victim.to = minute
        } else if (item.kind === 'knock') {
          const victim = pickAlive(alive.filter((r) => r.player.position !== 'GK'))
          if (!victim) continue
          const knock = KNOCKS[randInt(rng, 0, KNOCKS.length - 1)]!
          const fromTackle = rng() < 0.7
          const continues = rng() < 0.55
          emitInjury(
            st, victim, minute,
            `Knock — ${knock}${fromTackle ? ' (from a tackle)' : ' (awkward landing)'}${continues ? ' · treated, continues' : ' · being assessed'}`,
          )
          if (fromTackle) tacklerCard(st.teamId, minute, false)
          if (!continues) schedule(minute + randInt(rng, 3, 8), 'knock-sub', st.teamId, victim.player.id)
        } else if (item.kind === 'knock-sub') {
          const victim = alive.find((r) => r.player.id === item.victimId)
          if (victim && !makeSub(st, victim, minute, 'Knock — could not continue')) victim.to = minute
        } else if (item.kind === 'fatigue') {
          const victim =
            alive.find((r) => r.player.id === item.victimId) ??
            alive.filter((r) => r.starter && r.player.position !== 'GK').sort((a, b) => workload(b) - workload(a))[0]
          if (!victim || victim.player.position === 'GK') continue
          const form = formToday.get(victim.player.id) ?? 0
          const reason =
            form <= -0.8
              ? 'Tactical change — off the pace today'
              : form >= 1.2
                ? 'Tactical change — rested after a big shift'
                : 'Tactical change — fresh legs (fatigue)'
          makeSub(st, victim, minute, reason)
        } else if (item.kind === 'late') {
          const stance = stanceOf(st.teamId)
          if (stance === 'winning') {
            const victim = pickAlive(alive.filter((r) => ATT_POS.includes(r.player.position)))
            if (victim) makeSub(st, victim, minute, 'Late change — protecting the lead', [...DEF_POS, 'DM'])
          } else if (stance === 'losing') {
            const victim = pickAlive(alive.filter((r) => [...DEF_POS, 'DM'].includes(r.player.position)))
            if (victim) makeSub(st, victim, minute, 'Late change — chasing the game', ATT_POS)
          } else if (rng() < 0.6) {
            const victim = pickAlive(alive.filter((r) => r.player.position !== 'GK'))
            if (victim) makeSub(st, victim, minute, 'Late change — looking for a winner', ATT_POS)
          }
        } else if (item.kind === 'protective') {
          const victim = alive.find((r) => r.player.id === item.victimId)
          if (victim && victim.player.position !== 'GK') {
            makeSub(st, victim, minute, 'Protective change — on a booking')
          }
        } else if (item.kind === 'red-reinforce') {
          const victim = pickAlive(alive.filter((r) => ATT_POS.includes(r.player.position)))
          if (victim) makeSub(st, victim, minute, 'Reshuffle after red card — defensive reinforcement', [...DEF_POS, 'DM'])
        } else if (item.kind === 'gk-reinforce') {
          // Sacrifice an outfielder for the spare keeper, who takes the
          // dismissed keeper's anchor (goal area), not the outfielder's.
          const dismissed = st.rows.find((r) => r.player.position === 'GK' && r.to <= minute)
          const victim = pickAlive(alive.filter((r) => r.player.position !== 'GK'))
          if (victim)
            makeSub(st, victim, minute, 'Goalkeeper sent off — replacement keeper', [], true, dismissed?.anchor ?? victim.anchor)
        }
      }


      const onPitch = (teamId: string, minute: number): StintRow[] =>
        (lineups.get(teamId) ?? []).filter((r) => minute > r.from && minute <= r.to)

      /* ------- Goal events ------- */

      const emitGoals = (teamId: string, count: number) => {
        for (let g = 0; g < count; g++) {
          const minute = randInt(rng, 2, 90)
          const rows = onPitch(teamId, minute)
          if (rows.length === 0) continue
          const scorer = weightedPick(
            rng, rows,
            rows.map((r) => (r.player.position === 'GK' ? 0.001 : r.player.rates.shots * r.player.rates.xgQuality + 0.05)),
          )
          let assist: StintRow | undefined
          if (rng() < 0.62) {
            const creators = rows.filter((r) => r.player.id !== scorer.player.id && r.player.position !== 'GK')
            if (creators.length > 0) {
              assist = weightedPick(rng, creators, creators.map((r) => r.player.rates.xaRate + 0.03))
            }
          }
          bump(goalsByPlayer, scorer.player.id)
          const key = `${match.id}:${scorer.player.id}`
          const rr = ratingRows.get(key) ?? { goals: 0, assists: 0 }
          rr.goals += 1
          ratingRows.set(key, rr)
          if (assist) {
            bump(assistsByPlayer, assist.player.id)
            const ak = `${match.id}:${assist.player.id}`
            const ar = ratingRows.get(ak) ?? { goals: 0, assists: 0 }
            ar.assists += 1
            ratingRows.set(ak, ar)
          }
          const pos = eventPos(rng, scorer.anchor, 'goal', teamId === homeId)
          events.push({
            id: nextEventId(),
            matchId: match.id,
            minute,
            type: 'goal',
            teamId,
            playerId: scorer.player.id,
            secondaryPlayerId: assist?.player.id,
            x: pos.x,
            y: pos.y,
            value: round2(rand(rng, 0.04, 0.75)),
            provenance: 'DEMO',
          })
        }
      }
      emitGoals(homeId, homeGoals)
      emitGoals(awayId, awayGoals)

      /* ------- Shot events — exactly the recorded match shot totals ------- */

      const emitShots = (teamId: string, count: number) => {
        for (let s = 0; s < count; s++) {
          const minute = randInt(rng, 2, 90)
          const rows = onPitch(teamId, minute).filter((r) => r.player.position !== 'GK')
          if (rows.length === 0) continue
          const taker = weightedPick(rng, rows, rows.map((r) => r.player.rates.shots + 0.05))
          const pos = eventPos(rng, taker.anchor, 'shot', teamId === homeId)
          events.push({
            id: nextEventId(),
            matchId: match.id,
            minute,
            type: 'shot',
            teamId,
            playerId: taker.player.id,
            x: pos.x,
            y: pos.y,
            value: round2(rand(rng, 0.02, 0.42)),
            provenance: 'DEMO',
          })
        }
      }
      emitShots(homeId, match.shotsHome)
      emitShots(awayId, match.shotsAway)

      /* ------- Cards ------- */

      /* ------- Goalkeeper event positions (claims / sweeps near the box) -------
         Real average-position maps always show the keeper; without these the
         GK would have no dot at all. Kept sparse and clearly event-based. */
      for (const teamId of [homeId, awayId]) {
        const count = randInt(rng, 2, 4)
        for (let g = 0; g < count; g++) {
          const minute = randInt(rng, 2, 90)
          // Keeper actually on the pitch at that minute (a dismissed or
          // substituted starter must never record later actions).
          const gkRow = onPitch(teamId, minute).find((r) => r.player.position === 'GK')
          if (!gkRow) continue
          const pos = eventPos(rng, gkRow.anchor, 'recovery', teamId === homeId)
          events.push({
            id: nextEventId(),
            matchId: match.id,
            minute,
            type: 'recovery',
            teamId,
            playerId: gkRow.player.id,
            x: pos.x,
            y: pos.y,
            provenance: 'DEMO',
          })
        }
      }

      /* ------- Demo tactical tag events ------- */

      const tagTypes: Array<{ type: MatchEvent['type']; weight: number }> = [
        { type: 'turnover', weight: 5 },
        { type: 'recovery', weight: 5 },
        { type: 'progressive-carry', weight: 4 },
        { type: 'chance-created', weight: 3 },
      ]
      /* Volume chosen so most participants have several positioned events per
         match — enough for meaningful average positions and event-based heat
         maps without implying tracking-data coverage. */
      const tagCount = randInt(rng, 100, 140)
      for (let t = 0; t < tagCount; t++) {
        const teamId = rng() < 0.5 ? homeId : awayId
        const tag = weightedPick(rng, tagTypes, tagTypes.map((x) => x.weight)).type
        const minute = randInt(rng, 2, 90)
        const rows = onPitch(teamId, minute).filter((r) => r.player.position !== 'GK')
        if (rows.length === 0) continue
        const weights = rows.map((r) => {
          switch (tag) {
            case 'turnover': return r.player.rates.touches
            case 'recovery': return r.player.rates.recoveries + 1
            case 'progressive-carry': return r.player.rates.progCarries + 0.5
            case 'chance-created': return r.player.rates.xaRate + 0.1
            default: return 1
          }
        })
        const row = weightedPick(rng, rows, weights)
        const pos = eventPos(rng, row.anchor, tag, teamId === homeId)
        // Carries are two-point events: the end point is a measured distance
        // further toward the opponent goal, so progression can be computed.
        const carryEnd: { endX?: number; endY?: number } = {}
        if (tag === 'progressive-carry') {
          const forward = 8 + rng() * 8
          const flip = teamId === homeId ? 1 : -1
          carryEnd.endX = Math.min(98, Math.max(2, pos.x + flip * forward))
          carryEnd.endY = Math.min(96, Math.max(4, pos.y + gauss(rng, 0, 3)))
        }
        events.push({
          id: nextEventId(),
          matchId: match.id,
          minute,
          type: tag,
          teamId,
          playerId: row.player.id,
          x: pos.x,
          y: pos.y,
          ...carryEnd,
          provenance: 'DEMO',
        })
      }

      /* ------- Demo pass sample (stored events, start + end points) -------
         A stratified SAMPLE of each team's passing — deliberately not the full
         match feed. Volume follows possession share; success follows the
         passer's demonstrated completion rate; destinations target teammates
         with a forward bias, so progression and final-third entries emerge
         from formation geometry instead of being asserted. Anything computed
         from this sample is labelled CALCULATED with the event count shown. */
      const emitPasses = (teamId: string) => {
        const attackingRight = teamId === homeId
        const share = teamId === homeId ? possessionHome : 100 - possessionHome
        const count = Math.round(randInt(rng, 34, 46) * (0.7 + share / 100))
        for (let i = 0; i < count; i++) {
          const minute = randInt(rng, 2, 90)
          const rows = onPitch(teamId, minute).filter((r) => r.player.position !== 'GK')
          if (rows.length < 2) continue
          const passer = weightedPick(rng, rows, rows.map((r) => r.player.rates.touches))
          const mates = rows.filter((r) => r.player.id !== passer.player.id)
          const target = weightedPick(rng, mates, mates.map((r) => {
            const advance = attackingRight ? r.anchor.x - passer.anchor.x : passer.anchor.x - r.anchor.x
            return 1 + Math.max(0, advance) / 18
          }))
          const clampX = (v: number) => Math.min(98, Math.max(2, v))
          const clampY = (v: number) => Math.min(96, Math.max(4, v))
          // Register passes over the player's actual operating zone, not a
          // 2.5-unit dot around the formation anchor; otherwise heat maps
          // collapse into unrealistically thin horizontal bands.
          const from = {
            x: clampX(gauss(rng, passer.anchor.x, Math.max(3, passer.anchor.sx * 0.72))),
            y: clampY(gauss(rng, passer.anchor.y, Math.max(4, passer.anchor.sy * 0.72))),
          }
          const to = {
            x: clampX(gauss(rng, target.anchor.x, Math.max(3.5, target.anchor.sx * 0.82))),
            y: clampY(gauss(rng, target.anchor.y, Math.max(4.5, target.anchor.sy * 0.82))),
          }
          // A pass has length: forwards now cluster tightly (SS/CF/ST), so
          // pushes the end point out along its direction when the sampled
          // points fall within 2.5 pitch units of each other.
          const ddx = to.x - from.x
          const ddy = to.y - from.y
          if (Math.hypot(ddx, ddy) < 2.5) {
            // Aim the extension toward the pitch centre so coordinate
            // clamping can never shorten it below the minimum.
            const inward = Math.hypot(50 - from.y, 50 - from.x) < 3
            const ang = inward ? Math.PI / 4 : Math.atan2(50 - from.y, 50 - from.x)
            to.x = clampX(from.x + Math.cos(ang) * 2.5)
            to.y = clampY(from.y + Math.sin(ang) * 2.5)
          }
          const success = rng() < passer.player.rates.completion
          events.push({
            id: nextEventId(),
            matchId: match.id,
            minute,
            type: success ? 'pass' : 'incomplete-pass',
            teamId,
            playerId: passer.player.id,
            x: attackingRight ? from.x : 100 - from.x,
            y: attackingRight ? from.y : 100 - from.y,
            endX: attackingRight ? to.x : 100 - to.x,
            endY: attackingRight ? to.y : 100 - to.y,
            provenance: 'DEMO',
          })
        }
      }
      emitPasses(homeId)
      emitPasses(awayId)

      /* ------- Minutes rows & ratings ------- */

      for (const teamId of [homeId, awayId]) {
        for (const row of lineups.get(teamId) ?? []) {
          const { player: wp } = row
          const bonus = ratingRows.get(`${match.id}:${wp.id}`) ?? { goals: 0, assists: 0 }
          const shareBonus = rng() < 0.3 ? gauss(rng, 0.4, 0.2) : 0
          const rating = Math.min(9.8, Math.max(4.0,
            5.6 + wp.quality * 1.5 + gauss(rng, 0, 0.5)
            + bonus.goals * 0.45 + bonus.assists * 0.25 + shareBonus))
          playerMatchMinutes.push({
            playerId: wp.id,
            matchId: match.id,
            minutes: row.to - row.from,
            starter: row.starter,
            rating: Math.round(rating * 10) / 10,
          })
        }
      }
    }
  }

  /* ---------------- Aggregate season stats ---------------- */

  const minutesAgg = new Map<string, { minutes: number; appearances: number; starts: number; last3: number[] }>()
  for (const row of playerMatchMinutes) {
    const agg = minutesAgg.get(row.playerId) ?? { minutes: 0, appearances: 0, starts: 0, last3: [] }
    agg.minutes += row.minutes
    agg.appearances += 1
    if (row.starter) agg.starts += 1
    minutesAgg.set(row.playerId, agg)
  }
  // Last-3-match ratings per player (chronological by match id)
  const matchIndex = new Map(matches.map((m, i) => [m.id, i]))
  const ratingsByPlayer = new Map<string, { matchIndex: number; rating: number }[]>()
  for (const row of playerMatchMinutes) {
    const list = ratingsByPlayer.get(row.playerId) ?? []
    list.push({ matchIndex: matchIndex.get(row.matchId) ?? 0, rating: row.rating })
    ratingsByPlayer.set(row.playerId, list)
  }

  /* Team-level context for goalkeeper stats: shots/goals faced while each
     keeper was on the pitch are approximated from team totals scaled by the
     keeper's minute share (demo-honest approximation, labelled DEMO). */
  const teamFaced = new Map<string, { shots: number; goals: number }>()
  for (const m of matches) {
    const h = teamFaced.get(m.homeTeamId) ?? { shots: 0, goals: 0 }
    h.shots += m.shotsAway
    h.goals += m.awayGoals
    teamFaced.set(m.homeTeamId, h)
    const a = teamFaced.get(m.awayTeamId) ?? { shots: 0, goals: 0 }
    a.shots += m.shotsHome
    a.goals += m.homeGoals
    teamFaced.set(m.awayTeamId, a)
  }
  const gkMinutesByTeam = new Map<string, number>()
  for (const wp of working) {
    if (wp.position !== 'GK') continue
    const min = minutesAgg.get(wp.id)?.minutes ?? 0
    gkMinutesByTeam.set(wp.teamId, (gkMinutesByTeam.get(wp.teamId) ?? 0) + min)
  }

  const players: Player[] = working.map((wp) => {    const agg = minutesAgg.get(wp.id) ?? { minutes: 0, appearances: 0, starts: 0, last3: [] }
    const minutes = agg.minutes
    const min90 = minutes / 90
    const r = wp.rates
    const goals = goalsByPlayer.get(wp.id) ?? 0
    const assists = assistsByPlayer.get(wp.id) ?? 0

    const passesAttempted = Math.round(r.passesAtt * min90)
    /* Long/short split sums exactly to the passing totals. */
    const longAttempted = Math.min(passesAttempted, Math.round(passesAttempted * r.longShare))
    const shortAttempted = passesAttempted - longAttempted
    const longCompleted = Math.min(longAttempted, Math.round(longAttempted * r.longCompRate))
    const shortCompleted = Math.min(shortAttempted, Math.round(shortAttempted * r.shortCompRate))
    const passesCompleted = Math.min(passesAttempted, longCompleted + shortCompleted)
    const forwardAttempted = Math.round(passesAttempted * r.fwdShare)
    const forwardCompleted = Math.min(forwardAttempted, Math.round(forwardAttempted * clamp01(r.completion - 0.05)))
    const progressivePasses = Math.min(passesCompleted, Math.round(r.progressive * min90))
    const passesFinalThird = Math.min(progressivePasses, Math.round(r.passesFT * min90))
    const lineBreakingPasses = Math.min(passesFinalThird, Math.round(r.lineBreaking * min90))
    const carries = Math.round(r.carries * min90)
    const progressiveCarries = Math.min(carries, Math.round(r.progCarries * min90))
    const carriesFinalThird = Math.min(progressiveCarries, Math.round(r.carriesFT * min90))
    const dribblesAttempted = Math.round(r.dribbles * min90)
    const dribblesCompleted = Math.min(dribblesAttempted, Math.round(dribblesAttempted * r.dribbleRate))
    const touches = Math.max(passesAttempted + dribblesAttempted, Math.round(r.touches * min90))
    const turnovers = Math.max(goals, Math.round(r.turnovers * min90))
    const buildUpReceptions = Math.round(r.buReceptions * min90)
    const buildUpTurnovers = Math.min(turnovers, Math.round(r.buTurnovers * min90))
    const tackles = Math.round(r.tackles * min90)
    const interceptions = Math.round(r.interceptions * min90)
    const recoveries = Math.round(r.recoveries * min90)
    const recoveriesFinalThird = Math.min(recoveries, Math.round(r.recoveriesFT * min90))
    const clearances = Math.round(r.clearances * min90)
    const aerialsContested = Math.round(r.aerials * min90)
    const aerialsWon = Math.min(aerialsContested, Math.round(aerialsContested * r.aerialRate))
    const shots = wp.position === 'GK' ? 0 : Math.max(goals + 1, Math.round(r.shots * min90))
    const xg = round2(shots * r.xgQuality * rand(rng, 0.75, 1.3))
    const xa = round2(r.xaRate * min90 * rand(rng, 0.7, 1.35))

    /* --- v2 stat fields --- */
    const chancesCreated = Math.round(r.chancesRate * min90)
    const carryDistance = Math.round(r.carryDistRate * min90)
    const groundDuels = Math.max(0, Math.round(r.groundDuels * min90))
    const duelsContested = groundDuels + aerialsContested
    const duelsWon = Math.min(duelsContested, Math.round(groundDuels * r.duelWinRate) + aerialsWon)
    const tacklesWon = Math.min(tackles, Math.round(tackles * r.tacklesWonRate))
    const shotsBlocked = Math.min(clearances, Math.round(r.shotsBlockedRate * min90))
    const aerialsWonAttacking = Math.min(aerialsWon, Math.round(aerialsWon * r.aerialAttShare))
    const aerialsWonDefensive = aerialsWon - aerialsWonAttacking

    let saves = 0
    let xgPrevented = 0
    let penaltiesFaced = 0
    let penaltiesStopped = 0
    if (wp.position === 'GK' && minutes > 0) {
      const faced = teamFaced.get(wp.teamId) ?? { shots: 0, goals: 0 }
      const teamGkMin = gkMinutesByTeam.get(wp.teamId) ?? minutes
      const share = teamGkMin > 0 ? minutes / teamGkMin : 0
      const onTargetFaced = faced.shots * 0.36 * share
      const conceded = faced.goals * share
      const expectedSaves = Math.max(0, onTargetFaced - conceded)
      saves = Math.max(0, Math.min(Math.round(onTargetFaced), Math.round(expectedSaves * rand(rng, 0.9, 1.04))))
      xgPrevented = round2(onTargetFaced * (r.saveRate - 0.7) * rand(rng, 0.7, 1.3))
      penaltiesFaced = poisson(rng, r.pensFacedRate * min90)
      for (let p = 0; p < penaltiesFaced; p++) {
        if (rng() < r.penStopRate) penaltiesStopped += 1
      }
    }

    const stats: PlayerSeasonStats = {
      appearances: agg.appearances,
      minutes,
      starts: agg.starts,
      goals,
      assists,
      shots,
      xg,
      xa,
      passesAttempted,
      passesCompleted,
      forwardPassesAttempted: forwardAttempted,
      forwardPassesCompleted: forwardCompleted,
      progressivePasses,
      passesFinalThird,
      lineBreakingPasses,
      longPassesAttempted: longAttempted,
      longPassesCompleted: longCompleted,
      shortPassesAttempted: shortAttempted,
      shortPassesCompleted: shortCompleted,
      chancesCreated,
      carryDistance,
      carries,
      progressiveCarries,
      carriesFinalThird,
      dribblesAttempted,
      dribblesCompleted,
      touches,
      turnovers,
      buildUpReceptions,
      buildUpTurnovers,
      tackles,
      tacklesWon,
      interceptions,
      recoveries,
      recoveriesFinalThird,
      clearances,
      shotsBlocked,
      aerialsWon,
      aerialsContested,
      aerialsWonAttacking,
      aerialsWonDefensive,
      duelsContested,
      duelsWon,
      saves,
      xgPrevented,
      penaltiesFaced,
      penaltiesStopped,
      positioningAttack: r.posAtt,
      positioningDefense: r.posDef,
    }

    return {
      id: wp.id,
      name: wp.name,
      teamId: wp.teamId,
      position: wp.position,
      secondaryPosition: wp.secondaryPosition,
      role: wp.role,
      foot: wp.foot,
      dob: wp.dob,
      heightCm: wp.heightCm,
      shirtNumber: wp.shirtNumber,
      provenance: 'DEMO' as const,
      sourceName: DEMO_SOURCE_NAME,
      stats,
      touchMap: buildTouchMap(rng, wp, minutes, teamById.get(wp.teamId)?.style),
    }
  })

  return {
    competition,
    season,
    competitions: [...leagueCompetitions, cupCompetition],
    seasons: [...leagueSeasons, cupSeason],
    teams,
    players,
    matches,
    events,
    playerMatchMinutes,
  }
}

/* ------------------------------------------------------------------ */
/* Touch map                                                           */
/* ------------------------------------------------------------------ */

function buildTouchMap(rng: Rng, wp: WorkingPlayer, minutes: number, style?: string): TouchPoint[] {
  const zone = TOUCH_ZONES[wp.position]
  const count = Math.min(60, Math.max(10, Math.round((minutes / 90) * 22)))
  let shift = 0
  if (style === 'Possession-oriented' && ['LB', 'RB', 'AM', 'LW', 'RW', 'ST'].includes(wp.position)) shift = 3
  if (style === 'High-pressing' && ['LW', 'RW', 'ST', 'AM'].includes(wp.position)) shift = 3
  if (style === 'Counterattacking' && ['LW', 'RW', 'ST'].includes(wp.position)) shift = 2
  if (style === 'Direct' && ['CM', 'AM'].includes(wp.position)) shift = -2
  const out: TouchPoint[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      x: Math.min(97, Math.max(3, gauss(rng, zone[0] + shift, zone[2]))),
      y: Math.min(96, Math.max(4, gauss(rng, zone[1], zone[3]))),
      w: randInt(rng, 1, 3),
    })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

export function last3Rating(rows: PlayerMatchMinutes[], matches: Match[], playerId: string): number | null {
  const matchOrder = new Map(matches.map((m, i) => [m.id, i]))
  const mine = rows
    .filter((r) => r.playerId === playerId)
    .sort((a, b) => (matchOrder.get(a.matchId) ?? 0) - (matchOrder.get(b.matchId) ?? 0))
  if (mine.length === 0) return null
  const last3 = mine.slice(-3)
  return last3.reduce((s, r) => s + r.rating, 0) / last3.length
}

export function seasonRating(rows: PlayerMatchMinutes[], playerId: string): number | null {
  const mine = rows.filter((r) => r.playerId === playerId)
  if (mine.length === 0) return null
  return mine.reduce((s, r) => s + r.rating, 0) / mine.length
}
