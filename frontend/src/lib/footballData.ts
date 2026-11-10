import { apiGetJson } from '@/api/client'

/* ------------------------------------------------------------------ */
/* Real competition data — football-data.org via the backend proxy     */
/* (Phase 4a). All values arrive through /api/v1/fd/* wrapped in a     */
/* provenance envelope; nothing is fetched directly from the provider   */
/* in the browser (the API token stays server-side).                   */
/* ------------------------------------------------------------------ */

/** Provenance envelope added by the backend proxy. */
export interface FdEnvelope<T = unknown> {
  source: string
  endpoint: string
  competition: string | null
  fetchedAt: string
  cached: boolean
  data: T
}

/** The competitions the UI exposes (what the free tier actually serves). */
export const FD_COMPETITIONS = [
  { code: 'PL', name: 'Premier League', country: 'England' },
  { code: 'PD', name: 'La Liga', country: 'Spain' },
  { code: 'SA', name: 'Serie A', country: 'Italy' },
  { code: 'BL1', name: 'Bundesliga', country: 'Germany' },
  { code: 'FL1', name: 'Ligue 1', country: 'France' },
  { code: 'CL', name: 'Champions League', country: 'Europe' },
] as const

export type FdCompetitionCode = (typeof FD_COMPETITIONS)[number]['code']

/* ------------------------------------------------------------------ */
/* Raw provider JSON (only the fields we consume — trimmed shapes)      */
/* ------------------------------------------------------------------ */

interface RawTeamRef {
  id: number
  name: string
  shortName?: string
  tla?: string
  crest?: string
}

interface RawStandingRow {
  position: number
  team: RawTeamRef
  playedGames: number
  form?: string | null
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

interface RawStandingsGroup {
  stage: string
  type: string
  group: string | null
  table: RawStandingRow[]
}

export interface RawStandingsData {
  competition?: { code?: string; name?: string }
  season?: { currentMatchday?: number; startDate?: string; endDate?: string }
  standings: RawStandingsGroup[]
}

interface RawMatch {
  id: number
  utcDate: string
  status: string
  matchday?: number | null
  stage?: string | null
  group?: string | null
  homeTeam: RawTeamRef
  awayTeam: RawTeamRef
  score?: {
    fullTime?: { home: number | null; away: number | null }
    halfTime?: { home: number | null; away: number | null }
  }
}

export interface RawMatchesData {
  /** Null when the provider returns a filtered subset. */
  count?: number | null
  matches: RawMatch[]
}

interface RawScorer {
  player: {
    id: number
    name: string
    nationality?: string | null
    position?: string | null
    section?: string | null
  }
  team: RawTeamRef
  playedMatches?: number
  goals: number
  assists?: number | null
  penalties?: number | null
}

export interface RawScorersData {
  count?: number | null
  scorers: RawScorer[]
}

/* ------------------------------------------------------------------ */
/* Mapped view models                                                  */
/* ------------------------------------------------------------------ */

export interface StandingRow {
  position: number
  teamName: string
  teamTla: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

export interface StandingsView {
  /** Human-readable stage, e.g. "Regular season" / "League phase". */
  stageLabel: string
  competitionName: string
  currentMatchday: number | null
  rows: StandingRow[]
}

export interface FixtureView {
  id: number
  utcDate: string
  status: string
  matchday: number | null
  stageLabel: string | null
  groupLabel: string | null
  homeName: string
  homeTla: string
  awayName: string
  awayTla: string
  homeGoals: number | null
  awayGoals: number | null
  finished: boolean
}

export interface ScorerView {
  playerName: string
  nationality: string | null
  teamName: string
  teamTla: string
  playedMatches: number | null
  goals: number
  assists: number | null
  penalties: number | null
}

const STAGE_LABELS: Record<string, string> = {
  REGULAR_SEASON: 'Regular season',
  LEAGUE_STAGE: 'League phase',
  QUALIFICATION: 'Qualifying',
  PRELIMINARY_ROUND: 'Preliminary round',
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter-finals',
  SEMI_FINALS: 'Semi-finals',
  FINAL: 'Final',
}

function stageLabel(stage: string | null | undefined): string | null {
  if (!stage) return null
  return STAGE_LABELS[stage] ?? stage.replaceAll('_', ' ').toLowerCase()
}

function teamTla(team: RawTeamRef): string {
  return team.tla ?? team.shortName?.slice(0, 3).toUpperCase() ?? team.name.slice(0, 3).toUpperCase()
}

/** Map a standings envelope to the league-table view model. */
export function mapStandings(env: FdEnvelope<RawStandingsData>): StandingsView {
  const data = env.data
  const groups = data?.standings ?? []
  const group = groups.find((g) => g.type === 'TOTAL') ?? groups[0]
  const rows: StandingRow[] = (group?.table ?? []).map((r) => ({
    position: r.position,
    teamName: r.team?.name ?? '—',
    teamTla: teamTla(r.team ?? ({ id: 0, name: '—' } as RawTeamRef)),
    played: r.playedGames,
    won: r.won,
    drawn: r.draw,
    lost: r.lost,
    goalsFor: r.goalsFor,
    goalsAgainst: r.goalsAgainst,
    goalDifference: r.goalDifference,
    points: r.points,
  }))
  return {
    stageLabel: stageLabel(group?.stage) ?? 'Standings',
    competitionName: data?.competition?.name ?? env.competition ?? '—',
    currentMatchday: data?.season?.currentMatchday ?? null,
    rows,
  }
}

/** Map a fixtures/results envelope to the view model. */
export function mapFixtures(env: FdEnvelope<RawMatchesData>): FixtureView[] {
  return (env.data?.matches ?? []).map((m) => ({
    id: m.id,
    utcDate: m.utcDate,
    status: m.status,
    matchday: m.matchday ?? null,
    stageLabel: stageLabel(m.stage),
    groupLabel: m.group ?? null,
    homeName: m.homeTeam?.name ?? '—',
    homeTla: teamTla(m.homeTeam ?? ({ id: 0, name: '—' } as RawTeamRef)),
    awayName: m.awayTeam?.name ?? '—',
    awayTla: teamTla(m.awayTeam ?? ({ id: 0, name: '—' } as RawTeamRef)),
    homeGoals: m.score?.fullTime?.home ?? null,
    awayGoals: m.score?.fullTime?.away ?? null,
    finished: m.status === 'FINISHED',
  }))
}

/** Map a top-scorers envelope to the view model. */
export function mapScorers(env: FdEnvelope<RawScorersData>): ScorerView[] {
  return (env.data?.scorers ?? []).map((s) => ({
    playerName: s.player?.name ?? '—',
    nationality: s.player?.nationality ?? null,
    teamName: s.team?.name ?? '—',
    teamTla: teamTla(s.team ?? ({ id: 0, name: '—' } as RawTeamRef)),
    playedMatches: s.playedMatches ?? null,
    goals: s.goals,
    assists: s.assists ?? null,
    penalties: s.penalties ?? null,
  }))
}

/* ------------------------------------------------------------------ */
/* Fetchers (through the backend proxy)                                */
/* ------------------------------------------------------------------ */

export async function fetchStandings(code: FdCompetitionCode | string): Promise<FdEnvelope<RawStandingsData>> {
  return apiGetJson<FdEnvelope<RawStandingsData>>(`/api/v1/fd/competitions/${code}/standings`)
}

export async function fetchFixtures(
  code: FdCompetitionCode | string,
  dateFrom: string,
  dateTo: string,
): Promise<FdEnvelope<RawMatchesData>> {
  return apiGetJson<FdEnvelope<RawMatchesData>>(
    `/api/v1/fd/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  )
}

export async function fetchScorers(code: FdCompetitionCode | string): Promise<FdEnvelope<RawScorersData>> {
  return apiGetJson<FdEnvelope<RawScorersData>>(`/api/v1/fd/competitions/${code}/scorers`)
}
