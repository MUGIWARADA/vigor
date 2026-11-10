/**
 * Vigor — domain types.
 *
 * These types mirror the conceptual database schema planned for the
 * Spring Boot / PostgreSQL backend (see docs/DATA-MODEL.md). In Phase 1
 * they are populated by the clearly-labelled demo dataset generator.
 */

/** Data provenance labels (spec §19). */
export type Provenance =
  | 'DEMO'
  | 'IMPORTED'
  | 'CALCULATED'
  | 'MODEL_ESTIMATE'
  | 'MANUAL'
  | 'VERIFIED'

export type Position =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'WB'
  | 'DM'
  | 'CM'
  | 'LMF'
  | 'RMF'
  | 'AM'
  | 'LW'
  | 'RW'
  | 'SS'
  | 'CF'
  | 'ST'

/** Coarse position groups used for peer comparison. */
export type PositionGroup = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'WM' | 'AM' | 'W' | 'ST'

export type Foot = 'Left' | 'Right' | 'Both'

export type TeamStyle =
  | 'Possession-oriented'
  | 'Direct'
  | 'Counterattacking'
  | 'High-pressing'

export type Phase =
  | 'build-up'
  | 'progression'
  | 'final-third'
  | 'pressing'
  | 'defensive'
  | 'transition'

/** Similarity / composite dimensions. */
export type Dimension =
  | 'progression'
  | 'retention'
  | 'creation'
  | 'defending'
  | 'finishing'
  | 'carrying'

export type RoleId =
  | 'goalkeeper'
  | 'ball-playing-cb'
  | 'aggressive-cb'
  | 'attacking-fb'
  | 'defensive-fb'
  | 'deep-lying-playmaker'
  | 'ball-winner'
  | 'box-to-box'
  | 'advanced-playmaker'
  | 'winger'
  | 'inverted-winger'
  | 'target-forward'
  | 'mobile-striker'

/** Season-level aggregate statistics for one player. */
export interface PlayerSeasonStats {
  appearances: number
  minutes: number
  starts: number
  goals: number
  assists: number
  shots: number
  /** Expected goals — model estimate in the demo dataset. */
  xg: number
  /** Expected assists — model estimate in the demo dataset. */
  xa: number
  passesAttempted: number
  passesCompleted: number
  forwardPassesAttempted: number
  forwardPassesCompleted: number
  progressivePasses: number
  passesFinalThird: number
  lineBreakingPasses: number
  carries: number
  progressiveCarries: number
  carriesFinalThird: number
  dribblesAttempted: number
  dribblesCompleted: number
  touches: number
  turnovers: number
  buildUpReceptions: number
  buildUpTurnovers: number
  tackles: number
  tacklesWon: number
  interceptions: number
  recoveries: number
  recoveriesFinalThird: number
  clearances: number
  shotsBlocked: number
  aerialsWon: number
  aerialsContested: number
  /** Aerials won in the attacking third (set pieces / crosses to finish). */
  aerialsWonAttacking: number
  /** Aerials won in own defensive zone. */
  aerialsWonDefensive: number
  /** Ground+air duels contested/won (subset view over tackles, aerials, dribbles faced). */
  duelsContested: number
  duelsWon: number
  /** Pass split: longPasses + shortPasses sums exactly to passesAttempted/Completed. */
  longPassesAttempted: number
  longPassesCompleted: number
  shortPassesAttempted: number
  shortPassesCompleted: number
  /** Shots directly creating a shot for a teammate (chances/“key passes”). */
  chancesCreated: number
  /** Total distance carried with the ball, metres. */
  carryDistance: number
  /** Goalkeeper-only: shots stopped. */
  saves: number
  /** Goalkeeper-only: model estimate, saves above expected. May be negative. */
  xgPrevented: number
  /** Goalkeeper-only: penalties faced / stopped this season. */
  penaltiesFaced: number
  penaltiesStopped: number
  /** 0–100 model estimate of attacking positioning intelligence (never in real feed). */
  positioningAttack: number
  /** 0–100 model estimate of defensive positioning intelligence (never in real feed). */
  positioningDefense: number
}

export interface TouchPoint {
  /** 0–100, own goal (0) → opponent goal (100). */
  x: number
  /** 0–100, left touchline (0) → right touchline (100). */
  y: number
  /** Relative frequency weight of this demo spatial sample. */
  w: number
}

export interface Player {
  id: string
  name: string
  teamId: string
  position: Position
  secondaryPosition?: Position
  role: RoleId
  foot: Foot
  /** ISO date of birth. */
  dob: string
  heightCm?: number
  /** Squad shirt number (used in pitch visualisations). */
  shirtNumber?: number
  provenance: Provenance
  sourceName: string
  stats: PlayerSeasonStats
  /** Demo spatial sample used for the profile action/position map. */
  touchMap: TouchPoint[]
}

export interface Team {
  id: string
  name: string
  shortName: string
  city: string
  style: TeamStyle
  formation: string
  /** Display colour (hex) for badges and charts. */
  color: string
  provenance: Provenance
  sourceName: string
}

export interface Competition {
  id: string
  name: string
  shortName: string
  provenance: Provenance
}

export interface Season {
  id: string
  label: string
  competitionId: string
  startDate: string
  endDate: string
  provenance: Provenance
}

export type MatchEventType =
  | 'goal'
  | 'own-goal'
  | 'yellow-card'
  | 'red-card'
  | 'substitution'
  | 'injury'
  | 'shot'
  | 'chance-created'
  | 'turnover'
  | 'recovery'
  | 'progressive-carry'
  | 'pass'
  | 'incomplete-pass'

export interface MatchEvent {
  id: string
  matchId: string
  minute: number
  type: MatchEventType
  teamId: string
  playerId?: string
  /** Secondary participant: assist provider or substitute coming on. */
  secondaryPlayerId?: string
  x?: number
  y?: number
  /** End point for two-point events (passes, carries) — same 0–100 frame as x/y. */
  endX?: number
  endY?: number
  /** Optional numeric payload, e.g. shot xG. */
  value?: number
  note?: string
  provenance: Provenance
}

export interface Match {
  id: string
  competitionId: string
  seasonId: string
  round: number
  kickoff: string
  homeTeamId: string
  awayTeamId: string
  homeGoals: number
  awayGoals: number
  venue: string
  possessionHome: number
  shotsHome: number
  shotsAway: number
  provenance: Provenance
}

export interface PlayerMatchMinutes {
  playerId: string
  matchId: string
  minutes: number
  starter: boolean
  /** Synthetic demo match rating (out of 10). */
  rating: number
}

export type NewsCategory =
  | 'match-report'
  | 'transfer'
  | 'injury'
  | 'tactical'
  | 'analysis'
  | 'general'

export interface NewsArticle {
  id: string
  title: string
  source: string
  publishedAt: string
  category: NewsCategory
  teamId?: string
  playerId?: string
  summary: string
  externalUrl?: string
  provenance: Provenance
}

export type DiscussionKind = 'question' | 'observation' | 'comparison'

export type ReferenceType = 'player' | 'metric' | 'match' | 'scenario'

export interface ReferenceLink {
  type: ReferenceType
  targetId: string
  label: string
}

export interface DiscussionReply {
  id: string
  author: string
  authorBadge?: string
  publishedAt: string
  body: string
  provenance: Provenance
}

export interface DiscussionPost {
  id: string
  playerId: string
  kind: DiscussionKind
  author: string
  authorBadge?: string
  publishedAt: string
  body: string
  link?: ReferenceLink
  replies: DiscussionReply[]
  provenance: Provenance
}

export interface Shortlist {
  id: string
  name: string
  note: string
  playerIds: string[]
  createdAt: string
  provenance: Provenance
}

/** Notable performance change (demo: synthetic per-match rating series). */
export interface FormChange {
  playerId: string
  seasonRating: number
  last3Rating: number
  windowLabel: string
  provenance: Provenance
}

/* ------------------------------------------------------------------ */
/* Tactical Lab                                                        */
/* ------------------------------------------------------------------ */

export type TacticalSide = 'attack' | 'defence'

export interface ScenarioPlayer {
  id: string
  label: string
  /** 0–100 along pitch length (attack plays toward x=100). */
  x: number
  /** 0–100 across pitch width. */
  y: number
  role?: string
  linkedPlayerId?: string
}

export type TacticalActionType = 'pass' | 'carry' | 'run' | 'movement'

export interface ScenarioAction {
  id: string
  order: number
  type: TacticalActionType
  from: { x: number; y: number }
  to: { x: number; y: number }
  label?: string
  note?: string
  /** Optional link to a player record the action is based on. */
  linkedPlayerId?: string
}

export interface TacticalScenario {
  id: string
  name: string
  description?: string
  provenance: Provenance
  createdAt: string
  updatedAt: string
  attack: { formation: string; players: ScenarioPlayer[] }
  defence: { formation: string; players: ScenarioPlayer[] }
  actions: ScenarioAction[]
  /** Explicit ball position (set by dragging the ball or finishing a pass /
      carry). When absent the ball is derived from the action sequence. */
  ball?: { x: number; y: number }
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

export interface GlobalFilters {
  competitionId: string | 'all'
  seasonId: string | 'all'
  positionGroup: PositionGroup | 'all'
  teamId: string | 'all'
  ageMin: number
  ageMax: number
  minMinutes: number
}

/** Context configuration for the contextual analysis engine (spec §8). */
export interface AnalysisContextConfig {
  playerId: string
  phase: Phase
  positionGroup: PositionGroup
  teamStyle: TeamStyle | 'all'
  /** Peer group selector. */
  peerGroup: 'same-league' | 'same-position' | 'same-role' | 'age-group'
  minMinutes: number
  ageMin: number
  ageMax: number
}
