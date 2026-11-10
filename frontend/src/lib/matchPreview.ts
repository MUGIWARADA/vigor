import type { Match, Team } from '@/types'

export type TeamMatchResult = 'W' | 'D' | 'L'

export interface TeamMatchFilters {
  competitionId: string
  opponentId: string
  result: TeamMatchResult | 'all'
  seasonIds?: ReadonlySet<string>
}

/** Result from one team's point of view. Returns null if the team did not play. */
export function resultForTeam(match: Match, teamId: string): TeamMatchResult | null {
  if (match.homeTeamId === teamId) {
    if (match.homeGoals > match.awayGoals) return 'W'
    if (match.homeGoals < match.awayGoals) return 'L'
    return 'D'
  }
  if (match.awayTeamId === teamId) {
    if (match.awayGoals > match.homeGoals) return 'W'
    if (match.awayGoals < match.homeGoals) return 'L'
    return 'D'
  }
  return null
}

export function opponentIdForTeam(match: Match, teamId: string): string | null {
  if (match.homeTeamId === teamId) return match.awayTeamId
  if (match.awayTeamId === teamId) return match.homeTeamId
  return null
}

/** Teams that actually appear in a competition's stored fixtures/results. */
export function teamsInCompetition(matches: Match[], teams: Team[], competitionId: string): Team[] {
  const participantIds = new Set<string>()
  for (const match of matches) {
    if (match.competitionId !== competitionId) continue
    participantIds.add(match.homeTeamId)
    participantIds.add(match.awayTeamId)
  }
  return teams.filter((team) => participantIds.has(team.id))
}

/**
 * A team's played matches, latest first, filtered by competition, opponent,
 * result and season. `seasonIds` is a set because the demo data stores one
 * season row per competition even when the display label is the same.
 */
export function filterTeamMatches(matches: Match[], teamId: string, filters: TeamMatchFilters): Match[] {
  return matches
    .filter((match) => match.homeTeamId === teamId || match.awayTeamId === teamId)
    .filter((match) => filters.competitionId === 'all' || match.competitionId === filters.competitionId)
    .filter((match) => filters.opponentId === 'all' || opponentIdForTeam(match, teamId) === filters.opponentId)
    .filter((match) => filters.result === 'all' || resultForTeam(match, teamId) === filters.result)
    .filter((match) => !filters.seasonIds || filters.seasonIds.has(match.seasonId))
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
}
