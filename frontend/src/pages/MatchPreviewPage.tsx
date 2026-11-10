import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  MapPin,
  RotateCcw,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader, SectionLabel } from '@/components/shared/page-header'
import { ProvenanceBadge } from '@/components/shared/provenance'
import { Pitch, toView } from '@/components/pitch/Pitch'
import { DEMO_COMPETITION_ID, DEMO_CUP_ID } from '@/data/generate'
import { averagePosition, type PitchPoint } from '@/lib/heatmap'
import { computeLeagueTable, CUP_ROUND_LABELS, type LeagueTableRow } from '@/lib/league-table'
import {
  filterTeamMatches,
  opponentIdForTeam,
  resultForTeam,
  teamsInCompetition,
  type TeamMatchResult,
} from '@/lib/matchPreview'
import { GK_DOT_COLOR, cn, fmtDate, readableTextOn } from '@/lib/utils'
import { useData } from '@/state/data'
import { useSettings } from '@/state/settings'
import type { Match, MatchEvent, Team } from '@/types'

type ResultFilter = TeamMatchResult | 'all'

const RESULT_WORD: Record<TeamMatchResult, string> = {
  W: 'Won',
  D: 'Drew',
  L: 'Lost',
}

const KEY_EVENT_LABELS: Partial<Record<MatchEvent['type'], string>> = {
  goal: 'Goal',
  'own-goal': 'Own goal',
  'yellow-card': 'Yellow card',
  'red-card': 'Red card',
  injury: 'Injury',
  substitution: 'Substitution',
}

function roundLabel(match: Match): string {
  return match.competitionId === DEMO_CUP_ID
    ? CUP_ROUND_LABELS[match.round] ?? `Round ${match.round}`
    : `Matchday ${match.round}`
}

function TeamBadge({ team, large = false }: { team: Team; large?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-extrabold',
        large ? 'h-12 w-12 text-[11px]' : 'h-9 w-9 text-[9px]',
      )}
      style={{ backgroundColor: team.color, color: readableTextOn(team.color) }}
    >
      {team.shortName.slice(0, 3).toUpperCase()}
    </span>
  )
}

function ResultBadge({ result }: { result: TeamMatchResult }) {
  return (
    <Badge variant={result === 'W' ? 'positive' : result === 'L' ? 'negative' : 'warning'}>
      {result} · {RESULT_WORD[result]}
    </Badge>
  )
}

function StatRow({
  label,
  home,
  away,
  homeColor,
  awayColor,
}: {
  label: string
  home: number
  away: number
  homeColor: string
  awayColor: string
}) {
  const max = Math.max(home, away, 1)
  return (
    <div className="grid grid-cols-[2.5rem_1fr_6.5rem_1fr_2.5rem] items-center gap-2 text-xs">
      <span className="text-metric text-right font-semibold text-fg">{home}</span>
      <span className="flex h-1.5 justify-end overflow-hidden rounded-full bg-ink-700">
        <span className="h-full" style={{ width: `${(home / max) * 100}%`, backgroundColor: homeColor }} />
      </span>
      <span className="text-center text-[10px] font-medium uppercase tracking-wide text-fg-faint">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-ink-700">
        <span className="block h-full" style={{ width: `${(away / max) * 100}%`, backgroundColor: awayColor }} />
      </span>
      <span className="text-metric font-semibold text-fg">{away}</span>
    </div>
  )
}

export function MatchPreviewPage() {
  const { data, teams, playerById } = useData()
  const { settings } = useSettings()
  const [searchParams, setSearchParams] = useSearchParams()
  const [competitionFilter, setCompetitionFilter] = useState('all')
  const [opponentFilter, setOpponentFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [seasonFilter, setSeasonFilter] = useState('all')

  const ds = data?.dataset
  const competitions = ds?.competitions ?? []
  const matches = ds?.matches ?? []

  const teamByIdMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])
  const seasonById = useMemo(
    () => new Map((ds?.seasons ?? []).map((season) => [season.id, season])),
    [ds],
  )

  const competitionSummaries = useMemo(
    () =>
      competitions.map((competition) => {
        const competitionMatches = matches.filter((match) => match.competitionId === competition.id)
        const competitionTeams = teamsInCompetition(matches, teams, competition.id)
        const table = computeLeagueTable(competitionMatches, competitionTeams)
        const isCup = competition.id === DEMO_CUP_ID
        const final = isCup
          ? [...competitionMatches].sort((a, b) => b.round - a.round || b.kickoff.localeCompare(a.kickoff))[0]
          : undefined
        const finalWinner = final
          ? teamByIdMap.get(final.homeGoals > final.awayGoals ? final.homeTeamId : final.awayTeamId)
          : undefined
        return {
          competition,
          matches: competitionMatches,
          teams: competitionTeams,
          table,
          headline: isCup
            ? finalWinner
              ? `Cup winner: ${finalWinner.name}`
              : `${competitionTeams.length} qualified teams`
            : table[0]
              ? `Leader: ${table[0].teamName}`
              : 'No matches played',
          goals: competitionMatches.reduce((sum, match) => sum + match.homeGoals + match.awayGoals, 0),
        }
      }),
    [competitions, matches, teams, teamByIdMap],
  )

  const requestedCompetition = searchParams.get('league') ?? DEMO_COMPETITION_ID
  const selectedSummary =
    competitionSummaries.find((summary) => summary.competition.id === requestedCompetition) ??
    competitionSummaries[0]
  const selectedCompetitionId = selectedSummary?.competition.id ?? requestedCompetition
  const selectedTable = selectedSummary?.table ?? []

  const selectedTeamId = searchParams.get('team')
  const selectedTeam = selectedTeamId ? teamByIdMap.get(selectedTeamId) : undefined
  const previewMatchId = searchParams.get('preview')

  const allTeamMatches = useMemo(
    () =>
      selectedTeam
        ? filterTeamMatches(matches, selectedTeam.id, {
            competitionId: 'all',
            opponentId: 'all',
            result: 'all',
          })
        : [],
    [matches, selectedTeam],
  )

  const teamCompetitions = useMemo(() => {
    const ids = new Set(allTeamMatches.map((match) => match.competitionId))
    return competitions.filter((competition) => ids.has(competition.id))
  }, [allTeamMatches, competitions])

  const teamOpponents = useMemo(() => {
    if (!selectedTeam) return []
    const ids = new Set(
      allTeamMatches
        .map((match) => opponentIdForTeam(match, selectedTeam.id))
        .filter((id): id is string => !!id),
    )
    return teams.filter((team) => ids.has(team.id)).sort((a, b) => a.name.localeCompare(b.name))
  }, [allTeamMatches, selectedTeam, teams])

  const seasonOptions = useMemo(() => {
    const byLabel = new Map<string, Set<string>>()
    for (const match of allTeamMatches) {
      const season = seasonById.get(match.seasonId)
      const label = (season?.label ?? match.seasonId).replace(/ cup$/i, '')
      const ids = byLabel.get(label) ?? new Set<string>()
      ids.add(match.seasonId)
      byLabel.set(label, ids)
    }
    return [...byLabel.entries()].map(([label, ids]) => ({ label, ids }))
  }, [allTeamMatches, seasonById])

  const filteredTeamMatches = useMemo(() => {
    if (!selectedTeam) return []
    const season = seasonOptions.find((option) => option.label === seasonFilter)
    return filterTeamMatches(matches, selectedTeam.id, {
      competitionId: competitionFilter,
      opponentId: opponentFilter,
      result: resultFilter,
      seasonIds: seasonFilter === 'all' ? undefined : season?.ids,
    })
  }, [
    matches,
    selectedTeam,
    competitionFilter,
    opponentFilter,
    resultFilter,
    seasonFilter,
    seasonOptions,
  ])

  const filteredSummary = useMemo(() => {
    if (!selectedTeam) return { W: 0, D: 0, L: 0, gf: 0, ga: 0 }
    return filteredTeamMatches.reduce(
      (summary, match) => {
        const result = resultForTeam(match, selectedTeam.id)
        if (result) summary[result] += 1
        const isHome = match.homeTeamId === selectedTeam.id
        summary.gf += isHome ? match.homeGoals : match.awayGoals
        summary.ga += isHome ? match.awayGoals : match.homeGoals
        return summary
      },
      { W: 0, D: 0, L: 0, gf: 0, ga: 0 },
    )
  }, [filteredTeamMatches, selectedTeam])

  const previewMatch = useMemo(
    () =>
      previewMatchId && selectedTeam
        ? allTeamMatches.find((match) => match.id === previewMatchId)
        : undefined,
    [previewMatchId, selectedTeam, allTeamMatches],
  )

  const previewEvents = useMemo(
    () =>
      previewMatch
        ? (ds?.events ?? [])
            .filter((event) => event.matchId === previewMatch.id)
            .sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id))
        : [],
    [ds, previewMatch],
  )

  const previewLineup = useMemo(
    () =>
      previewMatch
        ? (ds?.playerMatchMinutes ?? [])
            .filter((row) => row.matchId === previewMatch.id)
            .map((row) => ({ row, player: playerById(row.playerId) }))
            .filter((entry) => !!entry.player)
        : [],
    [ds, previewMatch, playerById],
  )

  const previewAverages = useMemo(() => {
    const points = new Map<string, PitchPoint[]>()
    for (const event of previewEvents) {
      if (!event.playerId || event.x === undefined || event.y === undefined) continue
      const list = points.get(event.playerId) ?? []
      list.push({ x: event.x, y: event.y })
      points.set(event.playerId, list)
    }
    const averages = new Map<string, PitchPoint>()
    for (const [playerId, playerPoints] of points) {
      const average = averagePosition(playerPoints)
      if (average) averages.set(playerId, average)
    }
    return averages
  }, [previewEvents])

  useEffect(() => {
    setCompetitionFilter('all')
    setOpponentFilter('all')
    setResultFilter('all')
    setSeasonFilter('all')
  }, [selectedTeamId])

  const updateSearch = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next)
  }

  const closeDrawer = () => updateSearch({ team: null, preview: null })

  useEffect(() => {
    if (!selectedTeam) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (previewMatch) updateSearch({ preview: null })
      else closeDrawer()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
    // updateSearch deliberately reads the latest URL state when Escape fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam, previewMatch])

  if (!data || !ds) {
    return (
      <div className="space-y-5">
        <PageHeader title="Match Preview" />
        <EmptyState
          icon={CalendarDays}
          title="No match data available"
          description={
            settings.demoMode
              ? 'Data is loading or unavailable.'
              : 'Demo data is disabled and no real data source is connected. Enable demo data in Settings.'
          }
          showSettingsAction={!settings.demoMode}
        />
      </div>
    )
  }

  const resetFilters = () => {
    setCompetitionFilter('all')
    setOpponentFilter('all')
    setResultFilter('all')
    setSeasonFilter('all')
  }
  const filtersActive =
    competitionFilter !== 'all' || opponentFilter !== 'all' || resultFilter !== 'all' || seasonFilter !== 'all'

  const previewHome = previewMatch ? teamByIdMap.get(previewMatch.homeTeamId) : undefined
  const previewAway = previewMatch ? teamByIdMap.get(previewMatch.awayTeamId) : undefined
  const previewResult = previewMatch && selectedTeam ? resultForTeam(previewMatch, selectedTeam.id) : null
  const previewCompetition = previewMatch
    ? competitions.find((competition) => competition.id === previewMatch.competitionId)
    : undefined
  const previewSeason = previewMatch ? seasonById.get(previewMatch.seasonId) : undefined
  const listReturnParams = new URLSearchParams(searchParams)
  listReturnParams.delete('preview')
  const fullAnalysisReturnTo = `/matches?${listReturnParams.toString()}`
  const countEvents = (teamId: string, types: MatchEvent['type'][]) =>
    previewEvents.filter((event) => event.teamId === teamId && types.includes(event.type)).length
  const keyEvents = previewEvents.filter((event) => KEY_EVENT_LABELS[event.type])

  const topRatedFor = (teamId: string) =>
    previewLineup
      .filter(({ player }) => player?.teamId === teamId)
      .sort((a, b) => b.row.rating - a.row.rating || b.row.minutes - a.row.minutes)
      .slice(0, 3)

  const standingsLine = (row: LeagueTableRow) =>
    selectedCompetitionId === DEMO_CUP_ID
      ? `${row.played} played · ${row.won} won · ${row.goalsFor} scored`
      : `#${row.position} · ${row.points} pts · ${row.won}W ${row.drawn}D ${row.lost}L`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Match Preview"
        description="Choose a league slab, pick a team, then browse that team's played matches in the sliding side panel. Open any result for a quick preview or continue into the full match analysis."
        actions={<ProvenanceBadge provenance="DEMO" />}
      />

      <section aria-label="Choose a league">
        <SectionLabel>Leagues & competitions</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {competitionSummaries.map(({ competition, matches: compMatches, teams: compTeams, headline, goals }) => {
            const selected = competition.id === selectedCompetitionId
            return (
              <button
                key={competition.id}
                type="button"
                aria-label={`Show teams in ${competition.name}`}
                aria-pressed={selected}
                onClick={() => updateSearch({ league: competition.id, team: null, preview: null })}
                className={cn(
                  'group rounded-xl p-4 text-left transition-colors panel-border',
                  selected ? 'bg-accent-400/10' : 'bg-ink-900 hover:bg-ink-850',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[10px] font-extrabold',
                      selected ? 'bg-accent-500 text-on-bright' : 'bg-ink-700 text-fg',
                    )}
                  >
                    {competition.shortName.slice(0, 3).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-fg">{competition.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-fg-muted">{headline}</span>
                    <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-faint">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" aria-hidden /> {compTeams.length} teams
                      </span>
                      <span>{compMatches.length} matches</span>
                      <span>{goals} goals</span>
                    </span>
                  </span>
                  <ChevronRight
                    className={cn('mt-1 h-5 w-5 shrink-0', selected ? 'text-accent-300' : 'text-fg-faint')}
                    aria-hidden
                  />
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section aria-label={`Teams in ${selectedSummary?.competition.name ?? 'selected league'}`}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <SectionLabel className="mb-1">Teams</SectionLabel>
            <h2 className="text-base font-semibold text-fg">
              Teams in {selectedSummary?.competition.name ?? 'this league'}
            </h2>
            <p className="mt-1 text-xs text-fg-faint">
              Click a team and its match history slides in from the right.
            </p>
          </div>
          <Badge variant="muted">{selectedTable.length} teams</Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {selectedTable.map((row) => {
            const team = teamByIdMap.get(row.teamId)
            if (!team) return null
            return (
              <button
                key={team.id}
                type="button"
                aria-label={`View matches for ${team.name}`}
                onClick={() => updateSearch({ league: selectedCompetitionId, team: team.id, preview: null })}
                className="group relative overflow-hidden rounded-xl bg-ink-900 p-4 text-left panel-border transition-colors hover:bg-ink-850"
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: team.color }} />
                <span className="flex items-start gap-3 pl-1">
                  <TeamBadge team={team} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">{team.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-fg-faint">
                      {team.city} · {team.formation} · {team.style}
                    </span>
                    <span className="text-metric mt-2 block text-xs text-fg-muted">{standingsLine(row)}</span>
                    <span className="text-metric mt-0.5 block text-[11px] text-fg-faint">
                      GF {row.goalsFor} · GA {row.goalsAgainst} · GD {row.goalDifference > 0 ? '+' : ''}
                      {row.goalDifference}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-accent-300 opacity-0 transition-opacity group-hover:opacity-100">
                    Matches <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {selectedTeam && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${selectedTeam.name} matches`}>
          <button
            type="button"
            aria-label="Close team matches"
            className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-[2px]"
            onClick={closeDrawer}
          />
          <aside className="match-drawer-panel absolute inset-y-0 right-0 flex w-[min(94vw,620px)] flex-col border-l border-line-strong bg-ink-900 shadow-2xl">
            {previewMatch && previewHome && previewAway ? (
              <>
                <div className="sticky top-0 z-10 border-b border-line bg-ink-900/95 px-4 py-3 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => updateSearch({ preview: null })}>
                      <ArrowLeft aria-hidden /> Back to matches
                    </Button>
                    <span className="ml-auto text-[11px] font-medium uppercase tracking-wide text-fg-faint">
                      Match preview
                    </span>
                    <Button variant="ghost" size="icon-sm" aria-label="Close match preview" onClick={closeDrawer}>
                      <X aria-hidden />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                          <TeamBadge team={previewHome} large />
                          <span className="w-full truncate text-sm font-semibold text-fg">{previewHome.name}</span>
                          <span className="text-[10px] uppercase tracking-wide text-fg-faint">Home</span>
                        </div>
                        <div className="text-center">
                          <div className="text-metric text-4xl font-extrabold text-fg">
                            {previewMatch.homeGoals}–{previewMatch.awayGoals}
                          </div>
                          <div className="mt-1 text-[10px] uppercase tracking-wide text-fg-faint">Full time</div>
                          {previewResult && (
                            <div className="mt-2">
                              <ResultBadge result={previewResult} />
                            </div>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                          <TeamBadge team={previewAway} large />
                          <span className="w-full truncate text-sm font-semibold text-fg">{previewAway.name}</span>
                          <span className="text-[10px] uppercase tracking-wide text-fg-faint">Away</span>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-fg-faint">
                        <span>{previewCompetition?.name ?? previewMatch.competitionId}</span>
                        <span>{roundLabel(previewMatch)}</span>
                        <span>{previewSeason?.label.replace(/ cup$/i, '') ?? previewMatch.seasonId}</span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden /> {fmtDate(previewMatch.kickoff)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" aria-hidden /> {previewMatch.venue}
                        </span>
                      </div>
                      <Button asChild className="mt-4 w-full">
                        <Link
                          to={`/matches/${previewMatch.id}?returnTo=${encodeURIComponent(
                            fullAnalysisReturnTo,
                          )}`}
                        >
                          Open full match analysis <ArrowRight aria-hidden />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Match numbers</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <StatRow
                        label="Possession %"
                        home={previewMatch.possessionHome}
                        away={100 - previewMatch.possessionHome}
                        homeColor={previewHome.color}
                        awayColor={previewAway.color}
                      />
                      <StatRow
                        label="Shots"
                        home={previewMatch.shotsHome}
                        away={previewMatch.shotsAway}
                        homeColor={previewHome.color}
                        awayColor={previewAway.color}
                      />
                      <StatRow
                        label="Chances"
                        home={countEvents(previewHome.id, ['chance-created'])}
                        away={countEvents(previewAway.id, ['chance-created'])}
                        homeColor={previewHome.color}
                        awayColor={previewAway.color}
                      />
                      <StatRow
                        label="Recoveries"
                        home={countEvents(previewHome.id, ['recovery'])}
                        away={countEvents(previewAway.id, ['recovery'])}
                        homeColor={previewHome.color}
                        awayColor={previewAway.color}
                      />
                      <StatRow
                        label="Carries"
                        home={countEvents(previewHome.id, ['progressive-carry'])}
                        away={countEvents(previewAway.id, ['progressive-carry'])}
                        homeColor={previewHome.color}
                        awayColor={previewAway.color}
                      />
                      <StatRow
                        label="Cards"
                        home={countEvents(previewHome.id, ['yellow-card', 'red-card'])}
                        away={countEvents(previewAway.id, ['yellow-card', 'red-card'])}
                        homeColor={previewHome.color}
                        awayColor={previewAway.color}
                      />
                      <StatRow
                        label="Subs"
                        home={countEvents(previewHome.id, ['substitution'])}
                        away={countEvents(previewAway.id, ['substitution'])}
                        homeColor={previewHome.color}
                        awayColor={previewAway.color}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Average positions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Pitch ariaLabel={`${previewHome.name} and ${previewAway.name} average positions`}>
                        {previewLineup
                          .filter(({ row }) => row.starter)
                          .map(({ player }) => {
                            if (!player) return null
                            const average = previewAverages.get(player.id)
                            if (!average) return null
                            const point = toView(average.x, average.y)
                            const color =
                              player.position === 'GK'
                                ? GK_DOT_COLOR
                                : teamByIdMap.get(player.teamId)?.color ?? '#ffffff'
                            return (
                              <g key={player.id} aria-hidden>
                                <circle cx={point.x} cy={point.y} r={2.05} fill={color} />
                                <text
                                  x={point.x}
                                  y={point.y + 0.08}
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                  fontSize={1.65}
                                  fontWeight={800}
                                  fill={readableTextOn(color)}
                                >
                                  {player.shirtNumber ?? '–'}
                                </text>
                              </g>
                            )
                          })}
                      </Pitch>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-fg-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: previewHome.color }} aria-hidden />
                          {previewHome.name}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-fg-faint">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: GK_DOT_COLOR }} aria-hidden />
                          Goalkeepers
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          {previewAway.name}
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: previewAway.color }} aria-hidden />
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
                        Starters' mean positions from their positioned events. Open the full match analysis for
                        individual player heat maps.
                      </p>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {[previewHome, previewAway].map((team) => (
                      <Card key={team.id}>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-fg-faint" aria-hidden /> {team.shortName} top rated
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {topRatedFor(team.id).map(({ row, player }) => (
                              <li key={row.playerId} className="flex items-center gap-2 text-xs">
                                <Link
                                  to={`/players/${row.playerId}`}
                                  className="min-w-0 flex-1 truncate font-medium text-fg hover:text-accent-300"
                                >
                                  {player?.name ?? row.playerId}
                                </Link>
                                <span className="text-fg-faint">{row.minutes}'</span>
                                <Badge variant="accent">{row.rating.toFixed(1)}</Badge>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Goals & key events</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {keyEvents.length === 0 ? (
                        <p className="py-4 text-center text-xs text-fg-faint">No key events recorded.</p>
                      ) : (
                        <ul className="space-y-2">
                          {keyEvents.map((event) => {
                            const player = event.playerId ? playerById(event.playerId) : undefined
                            const secondary = event.secondaryPlayerId ? playerById(event.secondaryPlayerId) : undefined
                            const team = teamByIdMap.get(event.teamId)
                            return (
                              <li key={event.id} className="flex gap-3 rounded-md bg-ink-800/60 px-3 py-2 text-xs">
                                <span className="text-metric w-8 shrink-0 font-bold text-accent-300">{event.minute}'</span>
                                <span
                                  aria-hidden
                                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: team?.color ?? '#ffffff' }}
                                />
                                <span className="min-w-0">
                                  <span className="font-semibold text-fg">{KEY_EVENT_LABELS[event.type]}</span>
                                  {player && <span className="text-fg-muted"> · {player.name}</span>}
                                  {secondary && (
                                    <span className="text-fg-muted">
                                      {' '}
                                      {event.type === 'substitution' ? '→' : 'assist:'} {secondary.name}
                                    </span>
                                  )}
                                  {event.note && <span className="block truncate text-[11px] text-fg-faint">{event.note}</span>}
                                </span>
                                <span className="ml-auto shrink-0 text-[10px] font-semibold text-fg-faint">
                                  {team?.shortName}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <>
                <div className="border-b border-line px-4 py-4">
                  <div className="flex items-start gap-3">
                    <TeamBadge team={selectedTeam} large />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-lg font-semibold text-fg">{selectedTeam.name}</h2>
                          <p className="truncate text-xs text-fg-faint">
                            {selectedTeam.city} · {selectedTeam.formation} · {selectedTeam.style}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon-sm" aria-label="Close team matches" onClick={closeDrawer}>
                          <X aria-hidden />
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Badge variant="accent">
                          {filteredTeamMatches.length} of {allTeamMatches.length} matches
                        </Badge>
                        <Badge variant="positive">{filteredSummary.W} won</Badge>
                        <Badge variant="warning">{filteredSummary.D} drawn</Badge>
                        <Badge variant="negative">{filteredSummary.L} lost</Badge>
                        <Badge>
                          GF {filteredSummary.gf} · GA {filteredSummary.ga}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="mp-competition">Competition</Label>
                      <Select value={competitionFilter} onValueChange={setCompetitionFilter}>
                        <SelectTrigger id="mp-competition" aria-label="Competition">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All competitions</SelectItem>
                          {teamCompetitions.map((competition) => (
                            <SelectItem key={competition.id} value={competition.id}>
                              {competition.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="mp-opponent">Team faced</Label>
                      <Select value={opponentFilter} onValueChange={setOpponentFilter}>
                        <SelectTrigger id="mp-opponent" aria-label="Team faced">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All teams faced</SelectItem>
                          {teamOpponents.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="mp-season">Season</Label>
                      <Select value={seasonFilter} onValueChange={setSeasonFilter}>
                        <SelectTrigger id="mp-season" aria-label="Season">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All seasons</SelectItem>
                          {seasonOptions.map((season) => (
                            <SelectItem key={season.label} value={season.label}>
                              {season.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="text-label mb-1">Result</div>
                      <div className="grid grid-cols-4 overflow-hidden rounded-md border border-line-strong" role="group" aria-label="Result">
                        {(
                          [
                            ['all', 'All'],
                            ['W', 'Won'],
                            ['D', 'Drawn'],
                            ['L', 'Lost'],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={resultFilter === value}
                            onClick={() => setResultFilter(value)}
                            className={cn(
                              'px-2 py-2 text-[11px] font-semibold',
                              resultFilter === value
                                ? 'bg-accent-500 text-on-bright'
                                : 'bg-ink-800 text-fg-muted hover:bg-ink-700',
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {filtersActive && (
                    <Button variant="ghost" size="xs" className="mt-2" onClick={resetFilters}>
                      <RotateCcw aria-hidden /> Reset match filters
                    </Button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  {filteredTeamMatches.length === 0 ? (
                    <div className="flex h-full items-center justify-center p-4">
                      <EmptyState
                        icon={CalendarDays}
                        title="No matches match these filters"
                        description="Try another competition, opponent, result or season — or reset the match filters."
                      />
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {filteredTeamMatches.map((match) => {
                        const home = teamByIdMap.get(match.homeTeamId)
                        const away = teamByIdMap.get(match.awayTeamId)
                        const result = resultForTeam(match, selectedTeam.id)
                        if (!home || !away || !result) return null
                        const opponent = match.homeTeamId === selectedTeam.id ? away : home
                        const competition = competitions.find((item) => item.id === match.competitionId)
                        return (
                          <li key={match.id}>
                            <button
                              type="button"
                              aria-label={`${RESULT_WORD[result]} ${match.homeGoals}–${match.awayGoals} ${
                                match.homeTeamId === selectedTeam.id ? 'at home against' : 'away to'
                              } ${opponent.name}, ${competition?.name ?? match.competitionId}, ${fmtDate(match.kickoff)}`}
                              onClick={() => updateSearch({ preview: match.id })}
                              className="w-full rounded-xl bg-ink-850 p-3 text-left panel-border transition-colors hover:bg-ink-800"
                            >
                              <span className="flex items-center gap-3">
                                <span className="min-w-0 flex-1">
                                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-wide text-fg-faint">
                                    <span>{competition?.shortName ?? match.competitionId}</span>
                                    <span>·</span>
                                    <span>{roundLabel(match)}</span>
                                    <span>·</span>
                                    <span>{fmtDate(match.kickoff)}</span>
                                  </span>
                                  <span className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[13px]">
                                    <span
                                      className={cn(
                                        'truncate text-right',
                                        home.id === selectedTeam.id ? 'font-bold text-fg' : 'text-fg-muted',
                                      )}
                                    >
                                      {home.shortName}
                                    </span>
                                    <span className="text-metric rounded bg-ink-950 px-2 py-1 font-extrabold text-fg">
                                      {match.homeGoals}–{match.awayGoals}
                                    </span>
                                    <span
                                      className={cn(
                                        'truncate',
                                        away.id === selectedTeam.id ? 'font-bold text-fg' : 'text-fg-muted',
                                      )}
                                    >
                                      {away.shortName}
                                    </span>
                                  </span>
                                  <span className="mt-1 block truncate text-[11px] text-fg-faint">
                                    {match.homeTeamId === selectedTeam.id ? 'Home' : 'Away'} vs {opponent.name} · {match.venue}
                                  </span>
                                </span>
                                <span className="flex shrink-0 flex-col items-end gap-2">
                                  <ResultBadge result={result} />
                                  <ChevronRight className="h-4 w-4 text-fg-faint" aria-hidden />
                                </span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
