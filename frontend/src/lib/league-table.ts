import type { Match, MatchEvent, PlayerMatchMinutes, Player, Team } from '@/types'

/**
 * Demo league tables, cup brackets and per-competition scorers — pure
 * functions over the demo dataset (spec §19: all fictional).
 *
 * Shared by the Competitions page (demo section) and the Overview home tab.
 * Real-data tables come separately from football-data.org; these helpers are
 * never used to fabricate real values.
 */

export interface LeagueTableRow {
  position: number
  teamId: string
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

/**
 * Computes a classic league table from finished matches. `matches` must
 * already be filtered to one competition; teams with no played matches are
 * still listed (0 points) so the table always shows the full division.
 * Order: points → goal difference → goals for → name.
 */
export function computeLeagueTable(matches: Match[], teams: Team[]): LeagueTableRow[] {
  const rows = new Map<string, Omit<LeagueTableRow, 'position' | 'goalDifference'>>()
  const init = (team: Team) => ({
    teamId: team.id,
    teamName: team.name,
    teamTla: team.shortName,
    played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
  })
  for (const team of teams) rows.set(team.id, init(team))
  for (const m of matches) {
    const home = rows.get(m.homeTeamId)
    const away = rows.get(m.awayTeamId)
    if (!home || !away) continue
    home.played += 1
    away.played += 1
    home.goalsFor += m.homeGoals
    home.goalsAgainst += m.awayGoals
    away.goalsFor += m.awayGoals
    away.goalsAgainst += m.homeGoals
    if (m.homeGoals > m.awayGoals) {
      home.won += 1
      home.points += 3
      away.lost += 1
    } else if (m.homeGoals < m.awayGoals) {
      away.won += 1
      away.points += 3
      home.lost += 1
    } else {
      home.drawn += 1
      away.drawn += 1
      home.points += 1
      away.points += 1
    }
  }
  return [...rows.values()]
    .map((r) => ({ ...r, goalDifference: r.goalsFor - r.goalsAgainst }))
    .sort((a, b) =>
      b.points - a.points
      || b.goalDifference - a.goalDifference
      || b.goalsFor - a.goalsFor
      || a.teamName.localeCompare(b.teamName),
    )
    .map((r, i) => ({ ...r, position: i + 1 }))
}

/** Knockout round names for the demo cup (match.round 1–4). */
export const CUP_ROUND_LABELS: Record<number, string> = {
  1: 'Round of 16',
  2: 'Quarter-finals',
  3: 'Semi-finals',
  4: 'Final',
}

/** Groups a competition's matches into rounds (labelled "Matchday N"; cup
 *  callers relabel with CUP_ROUND_LABELS). */
export function groupMatchesByRound(matches: Match[]): { round: number; label: string; matches: Match[] }[] {
  const byRound = new Map<number, Match[]>()
  for (const m of matches) {
    const list = byRound.get(m.round) ?? []
    list.push(m)
    byRound.set(m.round, list)
  }
  return [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, ms]) => ({
      round,
      label: `Matchday ${round}`,
      matches: [...ms].sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    }))
}

export interface CompetitionScorer {
  playerId: string
  playerName: string
  teamId: string
  teamTla: string
  teamName: string
  goals: number
  assists: number
  appearances: number
}

/**
 * Per-competition scorers/creators, computed from the stored goal events (not
 * from the cross-competition season aggregates — those mix the cup into
 * league stats). `sortBy` picks the leaderboard: goals (default) or assists.
 */
export function computeCompetitionScorers(
  competitionMatches: Match[],
  events: MatchEvent[],
  players: Player[],
  minutes: PlayerMatchMinutes[],
  teams: Team[],
  limit = 20,
  sortBy: 'goals' | 'assists' = 'goals',
): CompetitionScorer[] {
  const matchIds = new Set(competitionMatches.map((m) => m.id))
  const playerById = new Map(players.map((p) => [p.id, p]))
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const rows = new Map<string, { goals: number; assists: number; apps: Set<string> }>()

  const tally = (id: string | undefined, key: 'goals' | 'assists') => {
    if (!id || !playerById.has(id)) return
    const row = rows.get(id) ?? { goals: 0, assists: 0, apps: new Set<string>() }
    row[key] += 1
    rows.set(id, row)
  }
  for (const e of events) {
    if (e.type === 'goal' && matchIds.has(e.matchId)) {
      tally(e.playerId, 'goals')
      tally(e.secondaryPlayerId, 'assists')
    }
  }
  for (const row of minutes) {
    if (!matchIds.has(row.matchId)) continue
    const r = rows.get(row.playerId) ?? { goals: 0, assists: 0, apps: new Set<string>() }
    r.apps.add(row.matchId)
    rows.set(row.playerId, r)
  }

  return [...rows.entries()]
    .filter(([, r]) => (sortBy === 'goals' ? r.goals > 0 : r.assists > 0))
    .map(([playerId, r]) => {
      const player = playerById.get(playerId)
      const team = player ? teamById.get(player.teamId) : undefined
      return {
        playerId,
        playerName: player?.name ?? playerId,
        teamId: player?.teamId ?? '',
        teamTla: team?.shortName ?? '—',
        teamName: team?.name ?? '—',
        goals: r.goals,
        assists: r.assists,
        appearances: r.apps.size,
      }
    })
    .sort((a, b) =>
      sortBy === 'goals'
        ? b.goals - a.goals || b.assists - a.assists || a.playerName.localeCompare(b.playerName)
        : b.assists - a.assists || b.goals - a.goals || a.playerName.localeCompare(b.playerName),
    )
    .slice(0, limit)
}
