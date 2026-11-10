import type { Competition, Match, MatchEvent, Player, PlayerMatchMinutes, Position, Team } from '@/types'
import { computeLeagueTable, CUP_ROUND_LABELS } from './league-table'
import { computeAllRoundMatchRatings, computeAllRoundSeasonRatings, RATING_CATEGORY_LABELS, type CategoryScore } from './ratings'
import type { FixtureView, ScorerView, StandingsView } from './footballData'

/**
 * Overview building blocks — top single-match performance packs and trending
 * topics, computed from stored records (demo) or provider view models (real).
 *
 * Honesty rules (spec §19):
 *  - Demo values come from the fictional dataset only (stored events and
 *    season stats, scored by the all-round rating v1); nothing is fabricated
 *    for effect — heat/social counts are never
 *    invented, each topic carries a factual signal instead.
 *  - Real values come only from what football-data.org actually returns
 *    (goals/assists/pens/apps). Ratings and xG are NOT in the free feed and
 *    are never estimated for real players here.
 *  - External links are plain search URLs built from names/fixtures; they
 *    are offered only for REAL players/matches (searching for fictional
 *    people would return nonsense or unrelated real people).
 */

/* ------------------------------------------------------------------ */
/* External search links (real data only)                              */
/* ------------------------------------------------------------------ */

/** YouTube search URL — used for real-player / real-match highlight links. */
export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

/** X (Twitter) search URL — used for real trending topics only. */
export function xSearchUrl(query: string): string {
  return `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query`
}

export function playerHighlightsUrl(playerName: string, teamName?: string): string {
  return youtubeSearchUrl(teamName ? `${playerName} ${teamName} highlights` : `${playerName} highlights`)
}

export function matchHighlightsUrl(homeName: string, awayName: string): string {
  return youtubeSearchUrl(`${homeName} vs ${awayName} highlights`)
}

/* ------------------------------------------------------------------ */
/* Demo: top single-match performances                                 */
/* ------------------------------------------------------------------ */

export interface TopMatchPerformance {
  playerId: string
  playerName: string
  position: Position
  teamId: string
  teamName: string
  teamTla: string
  matchId: string
  competitionId: string
  competitionName: string
  /** "MD 8" for leagues, "Semi-finals" for the cup (`cupCompetitionId`). */
  roundLabel: string
  kickoff: string
  homeName: string
  homeTla: string
  awayName: string
  awayTla: string
  scoreline: string
  opponentName: string
  opponentTla: string
  isHome: boolean
  /** All-round match rating v1 (est.) — position-tailored, not goal-centric. */
  rating: number
  /** Raw 0–100 all-round score behind the rating (tie-break / display). */
  score: number
  categories: CategoryScore[]
  passesCompleted: number
  recoveries: number
  /** Carry distance in pitch units, from event coordinates. */
  carryDistance: number
  /** GK only: shots stopped proxy (faced − conceded, est.). */
  saves: number | null
  shotsFaced: number | null
  goalsConceded: number | null
  minutes: number
  starter: boolean
  goals: number
  assists: number
  shots: number
  /** Sum of shot xG values in this match — a model estimate ("est."). */
  shotXg: number
  chancesCreated: number
  /** Season positioning estimates (0–100, metric registry: estimate). */
  positioningAttack: number
  positioningDefense: number
}

export interface PerformanceInput {
  matches: Match[]
  minutes: PlayerMatchMinutes[]
  events: MatchEvent[]
  players: Player[]
  teams: Team[]
  competitions: Competition[]
}

/**
 * Best single-match performances, ranked by the ALL-ROUND match rating
 * (lib/ratings): position-tailored percentiles over goals/shots/xG, chances,
 * completed passes, carries + carry distance, recoveries (GKs: shots
 * stopped/conceded). A minimum-minutes bar (default 45) keeps cameos off
 * the board. Defenders and goalkeepers can — and do — top this list.
 */
export function computeTopMatchPerformances(
  input: PerformanceInput,
  options: { limit?: number; minMinutes?: number; cupCompetitionId?: string } = {},
): TopMatchPerformance[] {
  const limit = options.limit ?? 9
  const minMinutes = options.minMinutes ?? 45
  const playerById = new Map(input.players.map((p) => [p.id, p]))
  const teamById = new Map(input.teams.map((t) => [t.id, t]))
  const matchById = new Map(input.matches.map((m) => [m.id, m]))
  const compById = new Map(input.competitions.map((c) => [c.id, c]))

  const ratings = computeAllRoundMatchRatings(
    input.matches,
    input.minutes,
    input.events,
    input.players,
    input.teams,
    minMinutes,
  )
  const minuteRow = new Map(input.minutes.map((r) => [`${r.matchId}:${r.playerId}`, r]))

  return [...ratings.values()]
    .map((r) => {
      const player = playerById.get(r.playerId)
      const match = matchById.get(r.matchId)
      const mRow = minuteRow.get(`${r.matchId}:${r.playerId}`)
      if (!player || !match || !mRow) return null
      const team = teamById.get(player.teamId)
      const home = teamById.get(match.homeTeamId)
      const away = teamById.get(match.awayTeamId)
      const isHome = player.teamId === match.homeTeamId
      const opponent = isHome ? away : home
      const isCup = options.cupCompetitionId !== undefined && match.competitionId === options.cupCompetitionId
      const c = r.components
      return {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        teamId: player.teamId,
        teamName: team?.name ?? '—',
        teamTla: team?.shortName ?? '—',
        matchId: match.id,
        competitionId: match.competitionId,
        competitionName: compById.get(match.competitionId)?.name ?? match.competitionId,
        roundLabel: isCup ? CUP_ROUND_LABELS[match.round] ?? `Round ${match.round}` : `MD ${match.round}`,
        kickoff: match.kickoff,
        homeName: home?.name ?? match.homeTeamId,
        homeTla: home?.shortName ?? '—',
        awayName: away?.name ?? match.awayTeamId,
        awayTla: away?.shortName ?? '—',
        scoreline: `${match.homeGoals}–${match.awayGoals}`,
        opponentName: opponent?.name ?? '—',
        opponentTla: opponent?.shortName ?? '—',
        isHome,
        rating: r.rating,
        score: r.score,
        categories: r.categories,
        passesCompleted: c.passesCompleted,
        recoveries: c.recoveries,
        carryDistance: c.carryDistance,
        saves: c.saves,
        shotsFaced: c.shotsFaced,
        goalsConceded: c.goalsConceded,
        minutes: mRow.minutes,
        starter: mRow.starter,
        goals: c.goals,
        assists: c.assists,
        shots: c.shots,
        shotXg: c.shotXg,
        chancesCreated: c.chancesCreated,
        positioningAttack: player.stats.positioningAttack,
        positioningDefense: player.stats.positioningDefense,
      } satisfies TopMatchPerformance
    })
    .filter((p): p is TopMatchPerformance => p !== null)
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        b.score - a.score ||
        b.goals - a.goals ||
        b.minutes - a.minutes ||
        a.playerName.localeCompare(b.playerName),
    )
    .slice(0, limit)
}

/* ------------------------------------------------------------------ */
/* Demo: trending topics                                               */
/* ------------------------------------------------------------------ */

export interface TrendingTopic {
  id: string
  /** Short hashtag-style chip, e.g. "#GoldenBoot". */
  tag: string
  title: string
  summary: string
  /** Factual signal behind the topic (never an invented mention count). */
  signal: string
  playerId?: string
  matchId?: string
  /** Search query for X — real topics only; demo topics stay in-app. */
  xQuery?: string
}

/**
 * Demo trending topics, derived deterministically from the snapshot: the
 * best performance, scoring/assist races, the rating king, the cup final,
 * the goal-fest and the five title races. All fictional — topics link to
 * in-app profiles, match reports and discussion rooms, never to social
 * search (invented players have no social footprint to find).
 */
export function computeTrendingTopics(
  input: PerformanceInput & { cupCompetitionId: string },
): TrendingTopic[] {
  const { players, teams, matches, competitions, cupCompetitionId } = input
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const compById = new Map(competitions.map((c) => [c.id, c]))
  const tla = (id: string) => teamById.get(id)?.shortName ?? '—'
  const topics: TrendingTopic[] = []

  // 1 — Performance of the snapshot.
  const topPerf = computeTopMatchPerformances(input, { limit: 1, cupCompetitionId })[0]
  if (topPerf) {
    topics.push({
      id: 'top-performance',
      tag: '#Masterclass',
      title: `${topPerf.playerName}'s ${topPerf.rating.toFixed(1)} masterclass`,
      summary: `${topPerf.goals} goals and ${topPerf.assists} assists in ${topPerf.minutes} minutes as ${topPerf.teamName} played ${topPerf.homeName} ${topPerf.scoreline} ${topPerf.awayName}. The highest-rated single performance in the snapshot.`,
      signal: `Match rating ${topPerf.rating.toFixed(1)} (est.) · ${topPerf.competitionName}, ${topPerf.roundLabel}`,
      playerId: topPerf.playerId,
      matchId: topPerf.matchId,
    })
  }

  // 2 — Golden boot race (season aggregates = league + cup output).
  const byGoals = [...players].sort((a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists)
  const topScorer = byGoals[0]
  const runnerUp = byGoals[1]
  if (topScorer) {
    topics.push({
      id: 'golden-boot',
      tag: '#GoldenBoot',
      title: `${topScorer.name} leads the scoring charts`,
      summary: runnerUp
        ? `${topScorer.stats.goals} goals for ${teamById.get(topScorer.teamId)?.name ?? ''} puts him ${topScorer.stats.goals - runnerUp.stats.goals} clear of ${runnerUp.name} (${runnerUp.stats.goals}).`
        : `${topScorer.stats.goals} goals so far.`,
      signal: `${topScorer.stats.goals} goals · ${topScorer.stats.appearances} apps · all competitions`,
      playerId: topScorer.id,
    })
  }

  // 3 — The creators' race.
  const topCreator = [...players].sort((a, b) => b.stats.assists - a.stats.assists || b.stats.goals - a.stats.goals)[0]
  if (topCreator && topCreator.stats.assists > 0) {
    topics.push({
      id: 'top-creator',
      tag: '#Playmaker',
      title: `${topCreator.name} is creating everything`,
      summary: `A snapshot-leading ${topCreator.stats.assists} assists for ${teamById.get(topCreator.teamId)?.name ?? ''}, on top of ${topCreator.stats.goals} goals of his own.`,
      signal: `${topCreator.stats.assists} assists · ${topCreator.stats.goals} goals · all competitions`,
      playerId: topCreator.id,
    })
  }

  // 4 — All-round rating leader (position-tailored; minutes >= 450).
  const topRated = computeAllRoundSeasonRatings(players, 450, 1)[0]
  if (topRated) {
    topics.push({
      id: 'rating-king',
      tag: '#CompletePlayer',
      title: `${topRated.playerName} tops the all-round ratings`,
      summary: `A ${topRated.rating.toFixed(1)} all-round rating (est.) — ${topRated.position} for ${teamById.get(players.find((p) => p.id === topRated.playerId)?.teamId ?? '')?.name ?? ''}, leading with ${topRated.topCategory ? RATING_CATEGORY_LABELS[topRated.topCategory.category].toLowerCase() : 'all-round play'}. The rating blends finishing, creation, passing, carrying, defending, duels and positioning against positional peers, so it is not a strikers-only board.`,
      signal: `All-round rating ${topRated.rating.toFixed(1)} (est.) · ${topRated.appearances} apps`,
      playerId: topRated.playerId,
    })
  }

  // 5 — Cup final.
  const finalMatch = matches.find((m) => m.competitionId === cupCompetitionId && m.round === 4)
  if (finalMatch) {
    const homeWon = finalMatch.homeGoals > finalMatch.awayGoals
    const winner = teamById.get(homeWon ? finalMatch.homeTeamId : finalMatch.awayTeamId)
    const loser = teamById.get(homeWon ? finalMatch.awayTeamId : finalMatch.homeTeamId)
    topics.push({
      id: 'cup-final',
      tag: '#CupFinal',
      title: `${winner?.name ?? 'The winners'} lift the ${compById.get(cupCompetitionId)?.shortName ?? 'Cup'}`,
      summary: `${tla(finalMatch.homeTeamId)} ${finalMatch.homeGoals}–${finalMatch.awayGoals} ${tla(finalMatch.awayTeamId)} settled the final between ${winner?.name ?? ''} and ${loser?.name ?? ''}.`,
      signal: `${compById.get(cupCompetitionId)?.name ?? 'Cup'} · Final`,
      matchId: finalMatch.id,
    })
  }

  // 6 — The goal-fest.
  const goalFest = [...matches].sort((a, b) => b.homeGoals + b.awayGoals - (a.homeGoals + a.awayGoals))[0]
  if (goalFest && goalFest.homeGoals + goalFest.awayGoals >= 6) {
    topics.push({
      id: 'goal-fest',
      tag: '#GoalFest',
      title: `${goalFest.homeGoals + goalFest.awayGoals} goals in one game`,
      summary: `${teamById.get(goalFest.homeTeamId)?.name ?? ''} ${goalFest.homeGoals}–${goalFest.awayGoals} ${teamById.get(goalFest.awayTeamId)?.name ?? ''} — the highest-scoring match in the snapshot.`,
      signal: `${compById.get(goalFest.competitionId)?.name ?? ''} · ${goalFest.competitionId === cupCompetitionId ? CUP_ROUND_LABELS[goalFest.round] ?? '' : `MD ${goalFest.round}`}`,
      matchId: goalFest.id,
    })
  }

  // 7 — Title races across the five leagues.
  const leagueComps = competitions.filter((c) => c.id !== cupCompetitionId)
  const leaderLines = leagueComps.map((c) => {
    const compMatches = matches.filter((m) => m.competitionId === c.id)
    const compTeams = teams.filter((t) => compMatches.some((m) => m.homeTeamId === t.id || m.awayTeamId === t.id))
    const leader = computeLeagueTable(compMatches, compTeams)[0]
    return leader ? `${c.shortName}: ${leader.teamName} (${leader.points} pts)` : null
  }).filter((l): l is string => l !== null)
  if (leaderLines.length > 0) {
    topics.push({
      id: 'title-races',
      tag: '#TitleRaces',
      title: 'Five title races taking shape',
      summary: leaderLines.join(' · '),
      signal: 'League leaders after matchday 8',
    })
  }

  return topics
}

/* ------------------------------------------------------------------ */
/* Real data: scorer packs + trending topics                           */
/* ------------------------------------------------------------------ */

export interface RankedRealScorer extends ScorerView {
  /** goals + assists (assists may be null in the feed → counted as 0). */
  involvement: number
}

/**
 * Real "top performances" are scorer packs only: football-data.org's free
 * tier provides goals/assists/penalties/apps per player, not per-match
 * ratings or xG. Ranked by goal involvement; every other field passes
 * through untouched and anything missing stays missing (gated).
 */
export function rankRealScorers(scorers: ScorerView[], limit = 9): RankedRealScorer[] {
  return scorers
    .map((s) => ({ ...s, involvement: s.goals + (s.assists ?? 0) }))
    .sort((a, b) => b.involvement - a.involvement || b.goals - a.goals || a.playerName.localeCompare(b.playerName))
    .slice(0, limit)
}

/**
 * Real trending topics from provider data: scoring leader, assist leader,
 * table leader and the biggest recent result. Each carries an X search
 * query (real people/fixtures have a social footprint); in-app discussion
 * rooms only exist for players with local records, so the UI links to the
 * rooms index rather than inventing a room.
 */
export function buildRealTrendingTopics(
  competitionName: string,
  scorers: ScorerView[],
  fixtures: FixtureView[],
  standings: StandingsView | null,
): TrendingTopic[] {
  const topics: TrendingTopic[] = []
  const topScorer = scorers[0]
  if (topScorer) {
    topics.push({
      id: 'real-top-scorer',
      tag: '#GoldenBoot',
      title: `${topScorer.playerName} leads the ${competitionName} scoring charts`,
      summary: `${topScorer.goals} goals for ${topScorer.teamName}${topScorer.playedMatches !== null ? ` in ${topScorer.playedMatches} appearances` : ''}.`,
      signal: `${topScorer.goals} goals · ${topScorer.assists ?? '—'} assists · football-data.org`,
      xQuery: `${topScorer.playerName} ${competitionName}`,
    })
  }
  const topAssister = [...scorers]
    .filter((s) => s.assists !== null)
    .sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0))[0]
  if (topAssister && (topAssister.assists ?? 0) > 0) {
    topics.push({
      id: 'real-top-assister',
      tag: '#Playmaker',
      title: `${topAssister.playerName} is the ${competitionName}'s top creator`,
      summary: `${topAssister.assists} assists for ${topAssister.teamName}, alongside ${topAssister.goals} goals.`,
      signal: `${topAssister.assists} assists · ${topAssister.goals} goals · football-data.org`,
      xQuery: `${topAssister.playerName} ${competitionName}`,
    })
  }
  const leader = standings?.rows[0]
  if (leader) {
    topics.push({
      id: 'real-leader',
      tag: '#TitleRace',
      title: `${leader.teamName} top the ${competitionName}`,
      summary: `${leader.points} points from ${leader.played} games (${leader.won}W ${leader.drawn}D ${leader.lost}L), goal difference ${leader.goalDifference > 0 ? `+${leader.goalDifference}` : leader.goalDifference}.`,
      signal: `${standings?.stageLabel ?? ''} · matchday ${standings?.currentMatchday ?? '—'}`,
      xQuery: `${leader.teamName} ${competitionName}`,
    })
  }
  const biggestWin = fixtures
    .filter((f) => f.finished && f.homeGoals !== null && f.awayGoals !== null)
    .sort((a, b) => Math.abs((b.homeGoals ?? 0) - (b.awayGoals ?? 0)) - Math.abs((a.homeGoals ?? 0) - (a.awayGoals ?? 0)))[0]
  if (biggestWin) {
    topics.push({
      id: 'real-big-result',
      tag: '#BigResult',
      title: `${biggestWin.homeName} ${biggestWin.homeGoals}–${biggestWin.awayGoals} ${biggestWin.awayName}`,
      summary: `The heaviest result in the current ${competitionName} window.`,
      signal: `${competitionName}${biggestWin.matchday !== null ? ` · MD ${biggestWin.matchday}` : ''}`,
      xQuery: `${biggestWin.homeName} ${biggestWin.awayName} ${biggestWin.homeGoals}-${biggestWin.awayGoals}`,
    })
  }
  return topics
}
