import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardPen,
  ExternalLink,
  Flame,
  MessagesSquare,
  Newspaper,
  Trophy,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GlobalFilterBar } from '@/components/shared/global-filter-bar'
import { PageHeader, SectionLabel } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { EstimateTag, ProvenanceBadge } from '@/components/shared/provenance'
import { PlayerAvatar, PlayerLink, PositionBadge } from '@/components/shared/player-bits'
import { InfoNote } from '@/components/shared/info-note'
import { useData } from '@/state/data'
import { useFilteredPlayers } from '@/hooks/useFilteredPlayers'
import { useSettings } from '@/state/settings'
import { isBackendConfigured } from '@/api/client'
import { recentlyViewedStore, scenarioStore, useStore } from '@/lib/store'
import { metricPer90Value, metricValueForPlayer } from '@/lib/metrics'
import { playerAge } from '@/lib/analysis'
import { fmt, fmtDateTime, initials } from '@/lib/utils'
import { DEMO_CUP_ID, DEMO_SOURCE_NAME } from '@/data/generate'
import type { Player, Team } from '@/types'
import { CUP_ROUND_LABELS, computeLeagueTable } from '@/lib/league-table'
import { computeAllRoundSeasonRatings, RATING_SYSTEM_VERSION } from '@/lib/ratings'
import { groupOf } from '@/lib/positions'
import {
  buildRealTrendingTopics,
  computeTopMatchPerformances,
  computeTrendingTopics,
  matchHighlightsUrl,
  playerHighlightsUrl,
  rankRealScorers,
  xSearchUrl,
  type TrendingTopic,
} from '@/lib/overview'
import {
  FD_COMPETITIONS,
  fetchFixtures,
  fetchScorers,
  fetchStandings,
  mapFixtures,
  mapScorers,
  mapStandings,
  type FdEnvelope,
  type RawMatchesData,
  type RawScorersData,
  type RawStandingsData,
} from '@/lib/footballData'

/**
 * Overview — the SofaScore-style front page (Phase 4c).
 *
 * Four tabs instead of one long scroll:
 *   Home              — filters, top performers, form, news, your workspace
 *   Matches           — latest results across every competition
 *   Trending          — derived talking points + discussion activity
 *   Top performances  — best single-match performance packs
 *
 * Demo mode renders the fictional five leagues + Atlantica Cup (DEMO).
 * Real mode (Settings toggle + backend) renders football-data.org data for a
 * selected competition (Premier League by default): headline tables/results,
 * scorer packs limited to what the free feed really provides, X search links
 * for trending topics and YouTube highlight search links for real players
 * and matches. External search links are never shown for fictional players.
 */

type OverviewTab = 'home' | 'matches' | 'trending' | 'performances'

const HOME_RANK_OPTIONS = [
  { id: 'overall', label: 'Overall rating', column: 'Overall', decimals: 1 },
  { id: 'goal_involvement', label: 'Goal involvement /90', column: 'G+A /90', decimals: 2 },
  { id: 'goals', label: 'Goals /90', column: 'Goals /90', decimals: 2 },
  { id: 'assists', label: 'Assists /90', column: 'Assists /90', decimals: 2 },
  { id: 'xg', label: 'xG /90', column: 'xG /90', decimals: 2 },
  { id: 'xa', label: 'xA /90', column: 'xA /90', decimals: 2 },
  { id: 'chances_created', label: 'Chances created /90', column: 'Chances /90', decimals: 2 },
  { id: 'progressive_passes', label: 'Progressive passes /90', column: 'Prog. passes /90', decimals: 2 },
  { id: 'progressive_carries', label: 'Progressive carries /90', column: 'Prog. carries /90', decimals: 2 },
  { id: 'pass_completion', label: 'Pass completion %', column: 'Pass %', decimals: 1 },
  { id: 'recoveries', label: 'Recoveries /90', column: 'Recoveries /90', decimals: 2 },
  { id: 'tackles_won', label: 'Tackles won /90', column: 'Tackles won /90', decimals: 2 },
  { id: 'shots_blocked', label: 'Shots blocked /90', column: 'Blocks /90', decimals: 2 },
  { id: 'duels_won_rate', label: 'Duel win %', column: 'Duel %', decimals: 1 },
  { id: 'gk_saves', label: 'Goalkeeper saves /90', column: 'Saves /90', decimals: 2 },
] as const
type HomeRankMetric = (typeof HOME_RANK_OPTIONS)[number]['id']


function isoDay(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function TlaBadge({ tla }: { tla: string }) {
  return (
    <span className="inline-flex h-6 min-w-9 items-center justify-center rounded panel-border bg-ink-800 px-1.5 text-[10px] font-semibold tracking-wide text-fg-muted">
      {tla}
    </span>
  )
}

export function OverviewPage() {
  const { settings } = useSettings()
  const realActive = settings.realDataEnabled && isBackendConfigured()
  return realActive ? <RealOverview /> : <DemoOverview />
}

/* ================================================================== */
/* Demo overview — the five fictional leagues + Atlantica Cup          */
/* ================================================================== */

function DemoOverview() {
  const { data, playerById } = useData()
  const { settings } = useSettings()
  const filtered = useFilteredPlayers()
  const [tab, setTab] = useState<OverviewTab>('home')
  const [matchComp, setMatchComp] = useState<string>('all')
  const [homeRankMetric, setHomeRankMetric] = useState<HomeRankMetric>('overall')
  /* Top performances filters */
  const [perfView, setPerfView] = useState<'overall' | 'GK' | 'DEF' | 'MID' | 'ATT'>('overall')
  const [perfComp, setPerfComp] = useState<string>('all')
  const [perfTeam, setPerfTeam] = useState<string>('all')
  const [perfSort, setPerfSort] = useState<string>('rating')
  const [perfMins, setPerfMins] = useState<string>('45')
  const [perfCount, setPerfCount] = useState<string>('9')

  const recentlyViewed = useStore(recentlyViewedStore)
  const userScenarios = useStore(scenarioStore)

  const ds = data?.dataset
  const realPending = settings.realDataEnabled && !isBackendConfigured()

  const performanceInput = useMemo(
    () =>
      ds
        ? {
            matches: ds.matches,
            minutes: ds.playerMatchMinutes,
            events: ds.events,
            players: ds.players,
            teams: ds.teams,
            competitions: ds.competitions,
          }
        : null,
    [ds],
  )

  const seasonRatings = useMemo(
    () => (ds ? computeAllRoundSeasonRatings(ds.players, 450) : []),
    [ds],
  )
  const seasonRatingByPlayer = useMemo(
    () => new Map(seasonRatings.map((rating) => [rating.playerId, rating])),
    [seasonRatings],
  )
  const homeRankOption =
    HOME_RANK_OPTIONS.find((option) => option.id === homeRankMetric) ?? HOME_RANK_OPTIONS[0]

  const topPerformers = useMemo(() => {
    const valueFor = (player: Player): number | null => {
      if (homeRankMetric === 'overall') return seasonRatingByPlayer.get(player.id)?.rating ?? null
      if (homeRankMetric === 'goal_involvement') {
        const goals = metricPer90Value(player.stats, 'goals')
        const assists = metricPer90Value(player.stats, 'assists')
        return goals === null || assists === null ? null : goals + assists
      }
      return metricValueForPlayer(player, homeRankMetric, groupOf(player.position))
    }

    return [...filtered]
      .filter((player) => player.stats.minutes >= 450)
      .map((player) => ({ player, value: valueFor(player) }))
      .filter((row): row is { player: Player; value: number } => row.value !== null)
      .sort(
        (a, b) =>
          b.value - a.value ||
          (seasonRatingByPlayer.get(b.player.id)?.rating ?? 0) -
            (seasonRatingByPlayer.get(a.player.id)?.rating ?? 0) ||
          b.player.stats.minutes - a.player.stats.minutes ||
          a.player.name.localeCompare(b.player.name),
      )
      .slice(0, 5)
  }, [filtered, homeRankMetric, seasonRatingByPlayer])

  const leagueLeaders = useMemo(() => {
    if (!ds) return []
    return ds.competitions
      .filter((c) => c.id !== DEMO_CUP_ID)
      .map((c) => {
        const compMatches = ds.matches.filter((m) => m.competitionId === c.id)
        const compTeams = ds.teams.filter((t) =>
          compMatches.some((m) => m.homeTeamId === t.id || m.awayTeamId === t.id),
        )
        const leader = computeLeagueTable(compMatches, compTeams)[0]
        return leader ? { competition: c, leader } : null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [ds])

  const latestMatches = useMemo(() => {
    if (!ds) return []
    const all = matchComp === 'all' ? ds.matches : ds.matches.filter((m) => m.competitionId === matchComp)
    return [...all].sort((a, b) => b.kickoff.localeCompare(a.kickoff)).slice(0, 20)
  }, [ds, matchComp])

  const trending = useMemo(
    () => (performanceInput ? computeTrendingTopics({ ...performanceInput, cupCompetitionId: DEMO_CUP_ID }) : []),
    [performanceInput],
  )

  const perfPool = useMemo(
    () =>
      performanceInput
        ? computeTopMatchPerformances(performanceInput, { limit: 10000, cupCompetitionId: DEMO_CUP_ID })
        : [],
    [performanceInput],
  )

  const performances = useMemo(() => {
    const LINES: Record<string, string[] | null> = {
      overall: null,
      GK: ['GK'],
      DEF: ['CB', 'FB'],
      MID: ['DM', 'CM', 'WM', 'AM'],
      ATT: ['W', 'ST'],
    }
    const line = LINES[perfView]
    const mins = Number(perfMins)
    const sortKey = (x: (typeof perfPool)[number]): number => {
      switch (perfSort) {
        case 'contributions': return x.goals + x.assists
        case 'goalsPer90': return x.minutes > 0 ? (x.goals / x.minutes) * 90 : 0
        case 'contributionsPer90': return x.minutes > 0 ? ((x.goals + x.assists) / x.minutes) * 90 : 0
        case 'chances': return x.chancesCreated
        case 'passes': return x.passesCompleted
        case 'recoveries': return x.recoveries
        case 'carries': return x.carryDistance
        case 'shots': return x.shots
        default: return x.rating
      }
    }
    return perfPool
      .filter((x) => (line ? line.includes(groupOf(x.position)) : true))
      .filter((x) => (perfComp === 'all' ? true : x.competitionId === perfComp))
      .filter((x) => (perfTeam === 'all' ? true : x.teamId === perfTeam))
      .filter((x) => x.minutes >= mins)
      .sort((a, b) => sortKey(b) - sortKey(a) || b.rating - a.rating || b.score - a.score)
      .slice(0, Number(perfCount))
  }, [perfPool, perfView, perfComp, perfTeam, perfSort, perfMins, perfCount])

  const formChanges = data?.content.formChanges ?? []
  const news = data?.content.news ?? []
  const shortlists = data?.content.shortlists ?? []
  const discussions = data?.content.discussions ?? []
  const demoScenarios = data?.content.demoScenarios ?? []
  const allScenarios = [...demoScenarios, ...userScenarios]
  const recentRooms = [...discussions]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 4)
  const teamById = useMemo(() => new Map((ds?.teams ?? []).map((t) => [t.id, t])), [ds])
  const compById = useMemo(() => new Map((ds?.competitions ?? []).map((c) => [c.id, c])), [ds])

  /** Homepage hero: top 8 by the all-round season rating. */
  const sliderStars = useMemo(() => {
    if (!ds) return []
    const byId = new Map(ds.players.map((p) => [p.id, p]))
    return seasonRatings.slice(0, 8).map((r) => ({
      rating: r,
      player: byId.get(r.playerId)!,
    }))
  }, [ds, seasonRatings])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        description="Your football front page: the latest results, what's trending and the best performances across the five fictional demo leagues and the Atlantica Cup."
      />

      {!settings.demoMode && (
        <InfoNote variant="scope" title="Demo data is disabled">
          No player-level real data source is connected yet, so intelligence panels are empty by
          design. Real competition data (league tables, fixtures, scorers) is available in the
          Competitions section when enabled in Settings. Enable demo data to explore the rest of
          the interface with clearly-labelled fictional records.
        </InfoNote>
      )}

      {realPending && ds && (
        <InfoNote variant="scope" title="Real data is enabled but no backend is connected">
          Showing the fictional demo leagues instead. Start the Spring Boot backend with
          FOOTBALL_DATA_TOKEN set to switch this page to real football-data.org data — see the
          backend README.
        </InfoNote>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as OverviewTab)}>
        <TabsList>
          <TabsTrigger value="home">Home</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="performances">Top performances</TabsTrigger>
        </TabsList>

        {/* ============================ HOME ============================ */}
        <TabsContent value="home" className="mt-4 space-y-4">
          {sliderStars.length > 0 && <TopPerformersSlider stars={sliderStars} teamById={teamById} />}

          <GlobalFilterBar />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* Recently viewed */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-fg-faint" aria-hidden />
                  Recently viewed players
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentlyViewed.length === 0 ? (
                  <p className="py-6 text-center text-xs text-fg-faint">
                    Players you open will appear here (stored locally in your browser).
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {recentlyViewed.slice(0, 5).map((entry) => {
                      const p = playerById(entry.playerId)
                      if (!p) return null
                      return (
                        <li key={entry.playerId}>
                          <Link
                            to={`/players/${p.id}`}
                            className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-ink-800"
                          >
                            <PlayerAvatar name={p.name} position={p.position} size="sm" />
                            <span className="text-[13px] font-medium text-fg">{p.name}</span>
                            <PositionBadge position={p.position} />
                            <span className="ml-auto text-[10px] text-fg-faint">
                              {new Date(entry.viewedAt).toLocaleDateString('en-GB')}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Top performers under filters */}
            <Card className="xl:col-span-2">
              <CardHeader className="flex-row flex-wrap items-end gap-3">
                <div className="mr-auto">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-fg-faint" aria-hidden />
                    Top performers
                  </CardTitle>
                  <p className="mt-1 text-[11px] text-fg-faint">
                    Overall is the default. Goals/90 and the other measures are alternative ranking metrics; minimum 450 minutes.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-1 sm:w-56">
                  <Label htmlFor="ovw-home-rank-metric">Rank by</Label>
                  <Select
                    value={homeRankMetric}
                    onValueChange={(value) => setHomeRankMetric(value as HomeRankMetric)}
                  >
                    <SelectTrigger id="ovw-home-rank-metric" aria-label="Rank by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOME_RANK_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button asChild variant="ghost" size="xs">
                  <Link to="/rankings">Full rankings</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {topPerformers.length === 0 ? (
                  <EmptyState
                    title="No players match the current filters"
                    description="Adjust the filters above, or enable demo data in Settings if it is disabled."
                    showSettingsAction={!settings.demoMode}
                  />
                ) : (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-label border-b border-line">
                        <th className="pb-1.5 text-left font-semibold">Player</th>
                        <th className="pb-1.5 text-left font-semibold">Team</th>
                        <th className="pb-1.5 text-right font-semibold">{homeRankOption.column}</th>
                        <th className="pb-1.5 text-right font-semibold">Minutes</th>
                        <th className="pb-1.5 pr-1 text-right font-semibold">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPerformers.map(({ player, value }) => (
                        <tr key={player.id} className="border-b border-line/40">
                          <td className="py-1.5">
                            <PlayerLink player={player} showPosition />
                          </td>
                          <td className="py-1.5 text-fg-muted">
                            {teamById.get(player.teamId)?.shortName}
                          </td>
                          <td className="text-metric py-1.5 text-right font-semibold text-fg">
                            {fmt(value, homeRankOption.decimals)}
                          </td>
                          <td className="text-metric py-1.5 text-right text-fg-muted">{player.stats.minutes}</td>
                          <td className="py-1.5 pr-1 text-right">
                            <ProvenanceBadge provenance="DEMO" compact />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* League leaders */}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Title races</CardTitle>
                <Button asChild variant="ghost" size="xs">
                  <Link to="/competitions">Full tables</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {leagueLeaders.length === 0 ? (
                  <EmptyState title="No league data" description="League tables need the demo dataset or real competition data." />
                ) : (
                  <ul className="space-y-1.5">
                    {leagueLeaders.map(({ competition, leader }) => (
                      <li key={competition.id}>
                        <Link
                          to="/competitions"
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-ink-800"
                        >
                          <span className="w-28 shrink-0 truncate text-[11px] text-fg-faint">{competition.name}</span>
                          <TlaBadge tla={leader.teamTla} />
                          <span className="truncate text-[13px] font-medium text-fg">{leader.teamName}</span>
                          <span className="text-metric ml-auto text-xs text-fg-muted">
                            {leader.points} pts · GD {leader.goalDifference > 0 ? `+${leader.goalDifference}` : leader.goalDifference}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Performance changes */}
            <Card>
              <CardHeader>
                <CardTitle>Notable performance changes</CardTitle>
              </CardHeader>
              <CardContent>
                {formChanges.length === 0 ? (
                  <EmptyState title="No form data" description="Demo form-change records require demo data." />
                ) : (
                  <ul className="space-y-1.5">
                    {formChanges.slice(0, 6).map((change) => {
                      const p = playerById(change.playerId)
                      if (!p) return null
                      const delta = change.last3Rating - change.seasonRating
                      const up = delta >= 0
                      return (
                        <li key={change.playerId} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-ink-800">
                          <span
                            className={up ? 'text-positive flex items-center' : 'text-negative flex items-center'}
                            aria-label={up ? 'Improving' : 'Dipping'}
                          >
                            {up ? <ArrowUpRight className="h-4 w-4" aria-hidden /> : <ArrowDownRight className="h-4 w-4" aria-hidden />}
                          </span>
                          <PlayerLink player={p} className="text-[13px]" />
                          <span className="text-metric ml-auto text-xs text-fg-muted" title={`${change.windowLabel} (demo synthetic rating)`}>
                            {fmt(change.last3Rating, 1)} vs {fmt(change.seasonRating, 1)} avg
                          </span>
                          <ProvenanceBadge provenance="DEMO" compact />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* News */}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-fg-faint" aria-hidden />
                  Latest news
                </CardTitle>
                <Button asChild variant="ghost" size="xs">
                  <Link to="/news">All news</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {news.length === 0 ? (
                  <EmptyState title="No news sources connected" description="News requires a configured feed or licensed provider (Phase 7)." />
                ) : (
                  <ul className="space-y-2.5">
                    {news.slice(0, 4).map((article) => (
                      <li key={article.id} className="border-b border-line/40 pb-2.5 last:border-0 last:pb-0">
                        <Link to="/news" className="text-[13px] font-medium leading-snug text-fg hover:text-accent-300">
                          {article.title}
                        </Link>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-fg-faint">
                          <span>{fmtDateTime(article.publishedAt)}</span>
                          <span aria-hidden>·</span>
                          <span>{article.source}</span>
                          <ProvenanceBadge provenance={article.provenance} compact />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Shortlists */}
            <Card>
              <CardHeader>
                <CardTitle>Saved scouting shortlists</CardTitle>
              </CardHeader>
              <CardContent>
                {shortlists.length === 0 ? (
                  <EmptyState title="No shortlists" description="Shortlists are demo records in Phase 1; user-created lists arrive with the backend." />
                ) : (
                  <ul className="space-y-2">
                    {shortlists.map((sl) => (
                      <li key={sl.id} className="rounded-md panel-border bg-ink-900/50 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-fg">{sl.name}</span>
                          <Badge variant="muted">{sl.playerIds.length} players</Badge>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-fg-muted">{sl.note}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {sl.playerIds.slice(0, 4).map((pid) => {
                            const p = playerById(pid)
                            return p ? (
                              <Link
                                key={pid}
                                to={`/players/${pid}`}
                                className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-fg-muted hover:text-accent-300"
                              >
                                {p.name}
                              </Link>
                            ) : null
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Tactical scenarios */}
            <Card className="xl:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardPen className="h-4 w-4 text-fg-faint" aria-hidden />
                  Recent tactical scenarios
                </CardTitle>
                <Button asChild variant="ghost" size="xs">
                  <Link to="/tactical-lab">Open Lab</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {allScenarios.length === 0 ? (
                  <EmptyState
                    title="No scenarios yet"
                    description="Create one in the Tactical Lab — scenarios are stored locally in your browser."
                  />
                ) : (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {allScenarios.slice(0, 4).map((sc) => (
                      <li key={sc.id} className="rounded-md panel-border bg-ink-900/50 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <Link to="/tactical-lab" className="text-[13px] font-medium text-fg hover:text-accent-300">
                            {sc.name}
                          </Link>
                          <ProvenanceBadge provenance={sc.provenance} compact />
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-fg-faint">
                          <span>{sc.attack.formation} vs {sc.defence.formation}</span>
                          <span aria-hidden>·</span>
                          <span>{sc.actions.length} actions</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="xl:col-span-3">
              <SectionLabel>Dataset coverage</SectionLabel>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg panel-border bg-ink-900/50 px-4 py-2.5 text-[11px] text-fg-faint">
                {ds ? (
                  <>
                    <span>{ds.competitions.length} competitions — {ds.season.label}</span>
                    <span aria-hidden>·</span>
                    <span>{ds.players.length} players, {ds.teams.length} teams</span>
                    <span aria-hidden>·</span>
                    <span>{ds.matches.length} matches, {ds.events.length} events</span>
                    <span aria-hidden>·</span>
                    <span>Oldest player {Math.max(...ds.players.map((p) => playerAge(p)))} yrs</span>
                    <ProvenanceBadge provenance="DEMO" compact />
                  </>
                ) : (
                  <span>No dataset loaded.</span>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* =========================== MATCHES =========================== */}
        <TabsContent value="matches" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex w-60 flex-col gap-1">
              <Label htmlFor="ovw-match-comp">Competition</Label>
              <Select value={matchComp} onValueChange={setMatchComp}>
                <SelectTrigger id="ovw-match-comp">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All competitions</SelectItem>
                  {(ds?.competitions ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="flex-1 text-[11px] leading-relaxed text-fg-faint">
              Latest results first — the 20 most recent matches. Every row opens the full match
              report with timeline, event map and tagging.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link to="/matches">Open Match Preview</Link>
            </Button>
          </div>

          {latestMatches.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No matches"
              description="Matches appear here when the demo dataset is enabled, or from real competition data in real mode."
              showSettingsAction={!settings.demoMode}
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="flex flex-wrap items-center gap-2 px-4 pt-3 text-[11px] text-fg-faint">
                  <ProvenanceBadge provenance="DEMO" compact />
                  <span>{DEMO_SOURCE_NAME} · all fictional</span>
                </div>
                <table className="mt-1 w-full text-[13px]">
                  <thead>
                    <tr className="text-label border-b border-line">
                      <th className="px-4 py-2 text-left font-semibold">Kick-off</th>
                      <th className="py-2 text-left font-semibold">Match</th>
                      <th className="py-2 text-center font-semibold">Score</th>
                      <th className="px-4 py-2 text-right font-semibold">Competition / round</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestMatches.map((m) => {
                      const home = teamById.get(m.homeTeamId)
                      const away = teamById.get(m.awayTeamId)
                      const comp = compById.get(m.competitionId)
                      const round =
                        m.competitionId === DEMO_CUP_ID
                          ? CUP_ROUND_LABELS[m.round] ?? `Round ${m.round}`
                          : `MD ${m.round}`
                      return (
                        <tr key={m.id} className="border-b border-line/40">
                          <td className="px-4 py-2 text-fg-muted">
                            {fmtDay(m.kickoff)}
                            <span className="block text-[11px] text-fg-faint">{fmtTime(m.kickoff)}</span>
                          </td>
                          <td className="py-2">
                            <Link to={`/matches/${m.id}`} className="flex items-center gap-2 rounded hover:text-fg">
                              <TlaBadge tla={home?.shortName ?? '—'} />
                              <span className="font-medium text-fg">{home?.name ?? m.homeTeamId}</span>
                              <span className="text-fg-faint">vs</span>
                              <TlaBadge tla={away?.shortName ?? '—'} />
                              <span className="font-medium text-fg">{away?.name ?? m.awayTeamId}</span>
                            </Link>
                          </td>
                          <td className="text-metric py-2 text-center font-semibold text-fg">
                            {m.homeGoals}–{m.awayGoals}
                          </td>
                          <td className="px-4 py-2 text-right text-[11px] text-fg-faint">
                            {comp?.name ?? m.competitionId} · {round}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* =========================== TRENDING =========================== */}
        <TabsContent value="trending" className="mt-4 space-y-4">
          <InfoNote variant="scope" title="Demo topics stay in-app">
            These talking points are computed from the fictional snapshot, so they link to player
            profiles, match reports and the in-app discussion rooms — never to social search,
            because invented players have no social footprint to find. Trending topics from real
            data (Settings → Real data) carry X search links instead.
          </InfoNote>

          {trending.length === 0 ? (
            <EmptyState
              icon={Flame}
              title="Nothing trending"
              description="Trending topics are derived from match and player records; enable the demo dataset or real competition data to see them."
              showSettingsAction={!settings.demoMode}
            />
          ) : (
            <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {trending.map((topic, i) => (
                <li key={topic.id}>
                  <TrendingCard topic={topic} rank={i + 1} />
                </li>
              ))}
            </ol>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessagesSquare className="h-4 w-4 text-fg-faint" aria-hidden />
                Recent discussion activity
              </CardTitle>
              <Button asChild variant="ghost" size="xs">
                <Link to="/discussions">All rooms</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentRooms.length === 0 ? (
                <EmptyState title="No discussions" description="Discussion rooms require demo data or authenticated users (Phase 2)." />
              ) : (
                <ul className="space-y-2.5">
                  {recentRooms.map((post) => {
                    const p = playerById(post.playerId)
                    return (
                      <li key={post.id} className="flex gap-3 border-b border-line/40 pb-2.5 last:border-0 last:pb-0">
                        {p && <PlayerAvatar name={p.name} position={p.position} size="sm" />}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {p && (
                              <Link to={`/discussions/${p.id}`} className="text-[13px] font-medium text-fg hover:text-accent-300">
                                {p.name}
                              </Link>
                            )}
                            <Badge variant="muted" className="normal-case">{post.kind}</Badge>
                            <span className="text-[10px] text-fg-faint">
                              {post.author} · {fmtDateTime(post.publishedAt)}
                            </span>
                            <ProvenanceBadge provenance={post.provenance} compact />
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fg-muted">{post.body}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================= TOP PERFORMANCES ======================= */}
        <TabsContent value="performances" className="mt-4 space-y-4">
          <InfoNote variant="scope" title="How these packs are ranked">
            By the <strong>all-round match rating</strong> — not by goals. Each performance is
            percentile-scored against players in the same position group across finishing (goals,
            shots, xG), creation (assists, chances), passing (completed passes and completion),
            carrying (progressive carries and carry distance), defending (recoveries, few
            turnovers) and goalkeeping (shots stopped proxy, conceded) — then blended with weights
            for the player's role, so a centre-back's masterclass can beat a striker's brace.
            Minimum 45 minutes. Ratings and xG are model estimates (<strong>est.</strong>).
            Season-only measures (duels, tackles, blocks, positioning) feed the season rating in
            the slider above and on the Competitions page.
          </InfoNote>

          {/* Filters: position view, competition, team, sort metric, sample size */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Performance view">
              {(
                [
                  ['overall', 'Overall'],
                  ['GK', 'Goalkeepers'],
                  ['DEF', 'Defenders'],
                  ['MID', 'Midfielders'],
                  ['ATT', 'Forwards'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={perfView === value}
                  onClick={() => setPerfView(value)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${
                    perfView === value ? 'bg-accent-500 text-on-bright' : 'bg-ink-800 text-fg-muted hover:bg-ink-700'
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-fg-faint">
                {perfPool.length.toLocaleString()} scored performances in pool · showing {performances.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
              <div className="flex flex-col gap-1">
                <Label htmlFor="ovw-perf-comp">Competition</Label>
                <Select value={perfComp} onValueChange={setPerfComp}>
                  <SelectTrigger id="ovw-perf-comp"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All competitions</SelectItem>
                    {(ds?.competitions ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ovw-perf-team">Team</Label>
                <Select value={perfTeam} onValueChange={setPerfTeam}>
                  <SelectTrigger id="ovw-perf-team"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All teams</SelectItem>
                    {[...(ds?.teams ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ovw-perf-sort">Sort by</Label>
                <Select value={perfSort} onValueChange={setPerfSort}>
                  <SelectTrigger id="ovw-perf-sort"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rating">Overall rating (all-round)</SelectItem>
                    <SelectItem value="contributions">Goals + assists</SelectItem>
                    <SelectItem value="goalsPer90">Goals /90</SelectItem>
                    <SelectItem value="contributionsPer90">Goals + assists /90</SelectItem>
                    <SelectItem value="chances">Chances created</SelectItem>
                    <SelectItem value="passes">Passes completed</SelectItem>
                    <SelectItem value="recoveries">Recoveries</SelectItem>
                    <SelectItem value="carries">Carry distance</SelectItem>
                    <SelectItem value="shots">Shots</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ovw-perf-mins">Minimum minutes</Label>
                <Select value={perfMins} onValueChange={setPerfMins}>
                  <SelectTrigger id="ovw-perf-mins"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="45">45+ minutes</SelectItem>
                    <SelectItem value="60">60+ minutes</SelectItem>
                    <SelectItem value="75">75+ minutes</SelectItem>
                    <SelectItem value="90">Full 90 only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ovw-perf-count">Results</Label>
                <Select value={perfCount} onValueChange={setPerfCount}>
                  <SelectTrigger id="ovw-perf-count"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9">Top 9</SelectItem>
                    <SelectItem value="18">Top 18</SelectItem>
                    <SelectItem value="27">Top 27</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {performances.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title={perfPool.length > 0 ? 'No performances match these filters' : 'No performances yet'}
              description={
                perfPool.length > 0
                  ? 'Try a wider view — another competition or team, or fewer minimum minutes.'
                  : 'Performance packs need match events to score — enable the demo dataset or real competition data.'
              }
              showSettingsAction={!settings.demoMode && perfPool.length === 0}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {performances.map((perf, i) => (
                  <Card key={`${perf.matchId}:${perf.playerId}`}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center rounded-lg border border-positive/40 bg-positive/10 px-2.5 py-1.5">
                          <span className="text-metric text-xl font-bold leading-none text-fg">
                            {perf.rating.toFixed(1)}
                          </span>
                          <span className="mt-1 flex items-center gap-1 text-[9px] uppercase tracking-wide text-fg-faint">
                            rating
                            <EstimateTag title="All-round match rating v1: position-group percentiles over finishing, creation, passing, carrying, defending and goalkeeping events, blended with role weights. A model estimate, not a measured fact." />
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-fg-faint">#{i + 1} · {perf.competitionName}</span>
                          <Link
                            to={`/players/${perf.playerId}`}
                            className="block truncate text-[15px] font-semibold text-fg hover:text-accent-300"
                          >
                            {perf.playerName}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-muted">
                            <PositionBadge position={perf.position} />
                            <TlaBadge tla={perf.teamTla} />
                            <span className="truncate">{perf.teamName}</span>
                          </div>
                        </div>
                        <ProvenanceBadge provenance="DEMO" compact className="ml-auto" />
                      </div>

                      <Link
                        to={`/matches/${perf.matchId}`}
                        className="block rounded-md panel-border bg-ink-900/60 px-2.5 py-1.5 text-[12px] text-fg-muted hover:text-fg"
                      >
                        {perf.roundLabel} · {perf.homeTla} <strong className="text-fg">{perf.scoreline}</strong> {perf.awayTla}
                        <span className="block text-[10px] text-fg-faint">
                          {fmtDay(perf.kickoff)} · vs {perf.opponentName}
                        </span>
                      </Link>

                      <dl className="grid grid-cols-5 gap-1.5 text-center">
                        {[
                          { label: 'Minutes', value: String(perf.minutes) },
                          { label: 'Goals', value: String(perf.goals) },
                          { label: 'Assists', value: String(perf.assists) },
                          { label: 'Passes ✓', value: String(perf.passesCompleted) },
                          { label: 'Recoveries', value: String(perf.recoveries) },
                          { label: 'Carry dist', value: String(perf.carryDistance) },
                          { label: 'Shots', value: String(perf.shots) },
                          { label: 'Chances cr.', value: String(perf.chancesCreated) },
                          perf.saves !== null
                            ? { label: 'Shots faced', value: String(perf.shotsFaced ?? 0) }
                            : { label: 'Score /100', value: String(Math.round(perf.score)) },
                        ].map((s) => (
                          <div key={s.label} className="rounded-md bg-ink-800/70 px-1 py-1.5">
                            <dd className="text-metric text-[15px] font-semibold text-fg">{s.value}</dd>
                            <dt className="text-[9px] uppercase tracking-wide text-fg-faint">{s.label}</dt>
                          </div>
                        ))}
                        <div className="rounded-md bg-ink-800/70 px-1 py-1.5">
                          <dd className="text-metric text-[15px] font-semibold text-fg">
                            {perf.shotXg.toFixed(2)}
                          </dd>
                          <dt className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wide text-fg-faint">
                            Shot xG
                            <EstimateTag title="Sum of the shot xG values stored on this match's shot events. xG is a model estimate of goal probability, not a measured fact." />
                          </dt>
                        </div>
                      </dl>

                      <p className="text-[11px] text-fg-faint">
                        Strongest:{' '}
                        {perf.categories
                          .filter((c) => c.score !== null)
                          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                          .slice(0, 3)
                          .map((c) => `${c.label} ${Math.round(c.score ?? 0)}`)
                          .join(' · ')}
                        {perf.saves !== null && (
                          <> · shots stopped ≈{perf.saves} (faced − conceded, est.)</>
                        )}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-fg-faint">
                        Season positioning — attack {perf.positioningAttack} · defence {perf.positioningDefense}
                        <EstimateTag title="Positioning intelligence (0–100) is a DEMO-only model estimate from the metric registry. It is never fabricated for real data." />
                      </p>

                      <div className="flex gap-2">
                        <Button asChild size="xs" variant="secondary">
                          <Link to={`/matches/${perf.matchId}`}>Match report</Link>
                        </Button>
                        <Button asChild size="xs" variant="ghost">
                          <Link to={`/players/${perf.playerId}`}>Player profile</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <p className="text-[11px] text-fg-faint">
                Season-long consistency instead? See the{' '}
                <Link to="/competitions" className="font-medium text-accent-300 hover:underline">
                  all-round season rating board (450+ minutes)
                </Link>{' '}
                on the Competitions page.
              </p>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TrendingCard({ topic, rank }: { topic: TrendingTopic; rank: number }) {
  return (
    <Card className="h-full">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <span className="text-metric text-sm font-bold text-fg-faint">{rank}</span>
          <Badge variant="accent" className="normal-case">{topic.tag}</Badge>
          <span className="ml-auto text-[10px] text-fg-faint">{topic.signal}</span>
        </div>
        <h3 className="text-[15px] font-semibold leading-snug text-fg">{topic.title}</h3>
        <p className="text-xs leading-relaxed text-fg-muted">{topic.summary}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {topic.playerId && (
            <Button asChild size="xs" variant="secondary">
              <Link to={`/players/${topic.playerId}`}>Player profile</Link>
            </Button>
          )}
          {topic.matchId && (
            <Button asChild size="xs" variant="secondary">
              <Link to={`/matches/${topic.matchId}`}>Match report</Link>
            </Button>
          )}
          <Button asChild size="xs" variant="ghost">
            <Link to={topic.playerId ? `/discussions/${topic.playerId}` : '/discussions'}>
              <MessagesSquare className="h-3 w-3" aria-hidden />
              Discuss in-app
            </Link>
          </Button>
          {topic.xQuery && (
            <Button asChild size="xs" variant="ghost">
              <a href={xSearchUrl(topic.xQuery)} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3 w-3" aria-hidden />
                Search on X
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/* ================================================================== */
/* Real overview — football-data.org via the backend proxy             */
/* ================================================================== */

interface RealBundle {
  standings: FdEnvelope<RawStandingsData>
  fixtures: FdEnvelope<RawMatchesData>
  scorers: FdEnvelope<RawScorersData>
}

function RealOverview() {
  const [tab, setTab] = useState<OverviewTab>('home')
  const [code, setCode] = useState<string>('PL')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const cacheRef = useRef(new Map<string, RealBundle>())

  const dateFrom = useMemo(() => isoDay(-7), [version])
  const dateTo = useMemo(() => isoDay(14), [version])

  useEffect(() => {
    if (cacheRef.current.has(code)) {
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchStandings(code), fetchFixtures(code, dateFrom, dateTo), fetchScorers(code)])
      .then(([standings, fixtures, scorers]) => {
        if (cancelled) return
        cacheRef.current.set(code, { standings, fixtures, scorers })
        setVersion((v) => v + 1)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load real data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [code, dateFrom, dateTo])

  const bundle = cacheRef.current.get(code) ?? null
  const comp = FD_COMPETITIONS.find((c) => c.code === code)
  const compName = comp?.name ?? code

  const standings = useMemo(() => (bundle ? mapStandings(bundle.standings) : null), [bundle])
  const fixtures = useMemo(() => (bundle ? mapFixtures(bundle.fixtures) : []), [bundle])
  const scorers = useMemo(() => (bundle ? mapScorers(bundle.scorers) : []), [bundle])
  const trending = useMemo(
    () => buildRealTrendingTopics(compName, scorers, fixtures, standings),
    [compName, scorers, fixtures, standings],
  )
  const packs = useMemo(() => rankRealScorers(scorers, 9), [scorers])
  const recentFinished = useMemo(
    () =>
      fixtures
        .filter((f) => f.finished)
        .sort((a, b) => b.utcDate.localeCompare(a.utcDate))
        .slice(0, 5),
    [fixtures],
  )
  const envelope = bundle?.standings

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        description="Your football front page from real competition data (football-data.org free tier — delayed, not live)."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-60 flex-col gap-1">
          <Label htmlFor="ovw-real-comp">Competition</Label>
          <Select value={code} onValueChange={setCode}>
            <SelectTrigger id="ovw-real-comp">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FD_COMPETITIONS.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name} ({c.country})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="flex-1 text-[11px] leading-relaxed text-fg-faint">
          Full tables, fixtures and scorer lists live on the{' '}
          <Link to="/competitions" className="font-medium text-accent-300 hover:underline">Competitions page</Link>;
          this page is the at-a-glance front page.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-negative/40 bg-negative/10 p-3 text-[12px] leading-relaxed text-fg">
          <p className="font-semibold">Could not load {compName}</p>
          <p className="mt-0.5 text-fg-muted">{error}</p>
        </div>
      )}

      {loading && !bundle && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-fg-muted">
            Loading {compName} from football-data.org…
          </CardContent>
        </Card>
      )}

      {bundle && envelope && (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-md panel-border bg-ink-900/60 px-3 py-2 text-[11px] text-fg-muted">
            <ProvenanceBadge provenance="IMPORTED" />
            <span className="font-medium text-fg">{compName}</span>
            <span>· {envelope.source}</span>
            <span>· fetched {fmtDay(envelope.fetchedAt)} {fmtTime(envelope.fetchedAt)}</span>
            {envelope.cached && <Badge variant="muted" className="normal-case">cached</Badge>}
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as OverviewTab)}>
            <TabsList>
              <TabsTrigger value="home">Home</TabsTrigger>
              <TabsTrigger value="matches">Matches</TabsTrigger>
              <TabsTrigger value="trending">Trending</TabsTrigger>
              <TabsTrigger value="performances">Top performances</TabsTrigger>
            </TabsList>

            {/* HOME */}
            <TabsContent value="home" className="mt-4 space-y-4">
              {packs.length > 0 && <RealPerformersSlider packs={packs} competitionName={compName} />}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle>Top of the table</CardTitle>
                    <Button asChild variant="ghost" size="xs">
                      <Link to="/competitions">Full table</Link>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {(standings?.rows ?? []).slice(0, 6).map((r) => (
                        <li key={r.position} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-ink-800">
                          <span className="w-5 text-[11px] text-fg-faint">{r.position}</span>
                          <TlaBadge tla={r.teamTla} />
                          <span className="truncate text-[13px] font-medium text-fg">{r.teamName}</span>
                          <span className="text-metric ml-auto text-xs text-fg-muted">{r.points} pts</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Latest results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentFinished.length === 0 ? (
                      <p className="py-6 text-center text-xs text-fg-faint">No finished matches in the current window.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {recentFinished.map((f) => (
                          <li key={f.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-ink-800">
                            <span className="w-20 shrink-0 text-[11px] text-fg-faint">{fmtDay(f.utcDate)}</span>
                            <span className="truncate text-[13px] text-fg">{f.homeName}</span>
                            <span className="text-metric shrink-0 font-semibold text-fg">{f.homeGoals}–{f.awayGoals}</span>
                            <span className="truncate text-[13px] text-fg">{f.awayName}</span>
                            <a
                              href={matchHighlightsUrl(f.homeName, f.awayName)}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-auto shrink-0 text-[11px] font-medium text-accent-300 hover:underline"
                            >
                              Highlights
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top scorers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {scorers.slice(0, 5).map((s, i) => (
                        <li key={`${s.playerName}-${i}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-ink-800">
                          <span className="w-5 text-[11px] text-fg-faint">{i + 1}</span>
                          <span className="truncate text-[13px] font-medium text-fg">{s.playerName}</span>
                          <TlaBadge tla={s.teamTla} />
                          <span className="text-metric ml-auto text-xs text-fg-muted">
                            {s.goals}g{s.assists !== null ? ` · ${s.assists}a` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* MATCHES */}
            <TabsContent value="matches" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <p className="flex items-center gap-1.5 px-4 pt-3 text-[11px] text-fg-faint">
                    <CalendarDays className="h-3 w-3" aria-hidden />
                    Window: past 7 days → next 14 days. Highlight links open a YouTube search for the
                    real fixture (external).
                  </p>
                  <table className="mt-1 w-full text-[13px]">
                    <thead>
                      <tr className="text-label border-b border-line">
                        <th className="px-4 py-2 text-left font-semibold">Kick-off</th>
                        <th className="py-2 text-left font-semibold">Fixture</th>
                        <th className="py-2 text-center font-semibold">Score</th>
                        <th className="px-4 py-2 text-right font-semibold">Watch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fixtures.map((f) => (
                        <tr key={f.id} className="border-b border-line/40">
                          <td className="px-4 py-2 text-fg-muted">
                            {fmtDay(f.utcDate)}
                            <span className="block text-[11px] text-fg-faint">{fmtTime(f.utcDate)}</span>
                          </td>
                          <td className="py-2">
                            <span className="flex items-center gap-2">
                              <TlaBadge tla={f.homeTla} />
                              <span className="font-medium text-fg">{f.homeName}</span>
                              <span className="text-fg-faint">vs</span>
                              <TlaBadge tla={f.awayTla} />
                              <span className="font-medium text-fg">{f.awayName}</span>
                            </span>
                          </td>
                          <td className="text-metric py-2 text-center font-semibold text-fg">
                            {f.finished ? `${f.homeGoals}–${f.awayGoals}` : <span className="font-normal text-fg-faint">—</span>}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <a
                              href={matchHighlightsUrl(f.homeName, f.awayName)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-medium text-accent-300 hover:underline"
                            >
                              Highlights
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {fixtures.length === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-fg-muted">No matches in this window.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TRENDING */}
            <TabsContent value="trending" className="mt-4 space-y-4">
              <InfoNote variant="scope" title="Real topics link out — rooms stay in-app">
                These topics describe real people and fixtures, so each carries an X search link.
                Discussion rooms exist for players with local records, so "Discuss in-app" opens
                the rooms index rather than inventing a room for a player we have no record of.
              </InfoNote>
              <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {trending.map((topic, i) => (
                  <li key={topic.id}>
                    <TrendingCard topic={topic} rank={i + 1} />
                  </li>
                ))}
              </ol>
            </TabsContent>

            {/* TOP PERFORMANCES (scorer packs — gated to the free feed) */}
            <TabsContent value="performances" className="mt-4 space-y-4">
              <InfoNote variant="scope" title="Scorer packs only — nothing estimated">
                football-data.org's free tier reports goals, assists, penalties and appearances per
                player — no per-match ratings, xG or positioning data. Real packs are ranked by
                goal involvement using only those fields, which is why there are no
                <strong> est.</strong> tags here: in this app an est. tag always marks a genuine
                model output, and none exists for real players yet.
              </InfoNote>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {packs.map((s, i) => (
                  <Card key={`${s.playerName}-${i}`}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center rounded-lg border border-info/40 bg-info/10 px-2.5 py-1.5">
                          <span className="text-metric text-xl font-bold leading-none text-fg">{s.involvement}</span>
                          <span className="mt-1 text-[9px] uppercase tracking-wide text-fg-faint">G+A</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-fg-faint">#{i + 1} · {compName}</span>
                          <p className="truncate text-[15px] font-semibold text-fg">{s.playerName}</p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-muted">
                            <TlaBadge tla={s.teamTla} />
                            <span className="truncate">{s.teamName}</span>
                            {s.nationality && <span className="text-fg-faint">· {s.nationality}</span>}
                          </div>
                        </div>
                        <ProvenanceBadge provenance="IMPORTED" compact className="ml-auto" />
                      </div>

                      <dl className="grid grid-cols-4 gap-2 text-center">
                        {[
                          { label: 'Apps', value: s.playedMatches !== null ? String(s.playedMatches) : '—' },
                          { label: 'Goals', value: String(s.goals) },
                          { label: 'Assists', value: s.assists !== null ? String(s.assists) : '—' },
                          { label: 'Pens', value: s.penalties !== null ? String(s.penalties) : '—' },
                        ].map((stat) => (
                          <div key={stat.label} className="rounded-md bg-ink-800/70 px-1 py-1.5">
                            <dd className="text-metric text-[15px] font-semibold text-fg">{stat.value}</dd>
                            <dt className="text-[9px] uppercase tracking-wide text-fg-faint">{stat.label}</dt>
                          </div>
                        ))}
                      </dl>

                      <Button asChild size="xs" variant="secondary">
                        <a href={playerHighlightsUrl(s.playerName, s.teamName)} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3 w-3" aria-hidden />
                          Watch highlights (YouTube)
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

/* ================================================================== */
/* Top performers slider — homepage hero (kit-card design)             */
/* ================================================================== */

const POSITION_XY: Record<string, { x: number; y: number }> = {
  GK: { x: 8, y: 50 }, CB: { x: 22, y: 50 }, LB: { x: 24, y: 16 }, RB: { x: 24, y: 84 },
  WB: { x: 34, y: 50 }, DM: { x: 40, y: 50 }, CM: { x: 52, y: 50 }, LMF: { x: 55, y: 16 },
  RMF: { x: 55, y: 84 }, AM: { x: 66, y: 50 }, LW: { x: 74, y: 14 }, RW: { x: 74, y: 86 },
  SS: { x: 80, y: 42 }, CF: { x: 86, y: 50 }, ST: { x: 88, y: 50 },
}

function useCarousel(length: number) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const dragX = useRef<number | null>(null)
  useEffect(() => {
    if (paused || length <= 1) return
    const id = setInterval(() => setIndex((i) => (i + 1) % length), 5000)
    return () => clearInterval(id)
  }, [paused, length])
  const prev = () => setIndex((i) => (i - 1 + length) % length)
  const next = () => setIndex((i) => (i + 1) % length)
  /** Drag / swipe support: fling left for next, right for previous. */
  const swipe = {
    onPointerDown: (e: { clientX: number }) => {
      dragX.current = e.clientX
    },
    onPointerUp: (e: { clientX: number }) => {
      if (dragX.current === null) return
      const dx = e.clientX - dragX.current
      dragX.current = null
      if (dx <= -40) next()
      else if (dx >= 40) prev()
    },
  }
  return {
    index: Math.min(index, Math.max(0, length - 1)),
    setIndex,
    setPaused,
    prev,
    next,
    swipe,
  }
}

function SliderControls({
  length,
  index,
  onPrev,
  onNext,
  onPick,
}: {
  length: number
  index: number
  onPrev: () => void
  onNext: () => void
  onPick: (i: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="mr-1 flex items-center gap-1.5" aria-hidden={false}>
        {Array.from({ length }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(i)}
            aria-label={`Show performer ${i + 1}`}
            aria-current={i === index}
            className={
              i === index
                ? 'h-1.5 w-6 rounded-full bg-accent-400 accent-glow transition-all'
                : 'h-1.5 w-1.5 rounded-full bg-ink-600 transition-all hover:bg-ink-500'
            }
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous performer"
        className="rounded-md border border-line-strong p-1.5 text-fg-muted transition-colors hover:bg-ink-800 hover:text-accent-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next performer"
        className="rounded-md border border-line-strong p-1.5 text-fg-muted transition-colors hover:bg-ink-800 hover:text-accent-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

function KitPanel({
  color,
  shirtNumber,
  monogram,
  tla,
  position,
}: {
  color: string
  shirtNumber?: number
  monogram: string
  tla: string
  position?: string
}) {
  const xy = position ? POSITION_XY[position] ?? { x: 50, y: 50 } : null
  return (
    <div
      className="relative flex min-h-44 w-full shrink-0 flex-col justify-between overflow-hidden rounded-lg p-4 sm:w-60"
      style={{ background: `linear-gradient(150deg, ${color} 0%, #101012 80%)` }}
      aria-hidden
    >
      <span className="pointer-events-none absolute -right-2 -top-6 select-none text-[110px] font-black leading-none text-white/15">
        {shirtNumber ?? ''}
      </span>
      <div className="flex items-start justify-between">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/70 bg-black/30 text-lg font-bold text-white">
          {monogram}
        </span>
        {xy && (
          <svg viewBox="0 0 100 64" className="h-14 w-24 opacity-90">
            <rect x="1" y="1" width="98" height="62" rx="3" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
            <line x1="50" y1="1" x2="50" y2="63" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
            <circle cx="50" cy="32" r="9" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
            <circle cx={xy.x} cy={(xy.y / 100) * 64} r="4" style={{ fill: 'var(--color-accent-400)' }} stroke="#101012" strokeWidth="1" />
          </svg>
        )}
      </div>
      <div className="flex items-end justify-between">
        <span className="rounded bg-black/40 px-2 py-1 font-mono text-xs font-bold tracking-widest text-white">
          {tla}
        </span>
        {position && <span className="text-[11px] font-semibold text-white/80">{position}</span>}
      </div>
    </div>
  )
}

function TopPerformersSlider({
  stars,
  teamById,
}: {
  stars: { rating: ReturnType<typeof computeAllRoundSeasonRatings>[number]; player: Player }[]
  teamById: Map<string, Team>
}) {
  const { index, setIndex, setPaused, prev, next, swipe } = useCarousel(stars.length)
  if (stars.length === 0) return null

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Top performers right now"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold tracking-tight text-fg">Top performers right now</h2>
        <span className="text-[11px] text-fg-faint">
          All-round rating {RATING_SYSTEM_VERSION} (est.) — position-tailored, not just goals
        </span>
        <div className="ml-auto">
          <SliderControls length={stars.length} index={index} onPrev={prev} onNext={next} onPick={setIndex} />
        </div>
      </div>
      <Card className="cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing" {...swipe}>
        {/* Sliding track: all slides sit side by side and the track glides. */}
        <div
          className="flex transition-transform duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {stars.map((star, i) => (
            <div key={star.player.id} className="w-full shrink-0" aria-hidden={i !== index}>
              <DemoPerformerSlide star={star} team={teamById.get(star.player.teamId)} rank={i + 1} active={i === index} />
            </div>
          ))}
        </div>
      </Card>
    </section>
  )
}

function DemoPerformerSlide({
  star,
  team,
  rank,
  active,
}: {
  star: { rating: ReturnType<typeof computeAllRoundSeasonRatings>[number]; player: Player }
  team: Team | undefined
  rank: number
  active: boolean
}) {
  const { player, rating } = star
    const s = player.stats
  const per90g = s.minutes > 0 ? (s.goals / s.minutes) * 90 : 0
  const per90a = s.minutes > 0 ? (s.assists / s.minutes) * 90 : 0
  const roleStats =
    rating.archetype === 'GK'
      ? [
          { label: 'Saves', value: String(s.saves) },
          { label: 'xG prevented', value: fmt(s.xgPrevented, 1), est: true },
          { label: 'Pens stopped', value: `${s.penaltiesStopped}/${s.penaltiesFaced}` },
        ]
      : rating.archetype === 'DF'
        ? [
            { label: 'Tackles won', value: String(s.tacklesWon) },
            { label: 'Blocks', value: String(s.shotsBlocked) },
            { label: 'Duels won', value: String(s.duelsWon) },
          ]
        : rating.archetype === 'MF'
          ? [
              { label: 'Pass %', value: s.passesAttempted ? fmt((s.passesCompleted / s.passesAttempted) * 100, 0) : '—' },
              { label: 'Chances cr.', value: String(s.chancesCreated) },
              { label: 'Prog. passes', value: String(s.progressivePasses) },
            ]
          : [
              { label: 'Goals', value: String(s.goals) },
              { label: 'Assists', value: String(s.assists) },
              { label: 'xG', value: fmt(s.xg, 1), est: true },
            ]
  const topCats = rating.categories
    .filter((c) => c.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3)

  return (
    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
      <KitPanel
        color={team?.color ?? '#3a3a42'}
        shirtNumber={player.shirtNumber}
        monogram={initials(player.name)}
        tla={team?.shortName ?? '—'}
        position={player.position}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
              #{rank} · {rating.group} · {team?.name ?? ''}
            </span>
            <Link
              to={`/players/${player.id}`}
              tabIndex={active ? undefined : -1}
              className="block truncate text-2xl font-bold tracking-tight text-fg hover:text-accent-300"
            >
              {player.name}
            </Link>
            <div className="mt-1 flex items-center gap-1.5">
              <PositionBadge position={player.position} />
              <span className="text-[11px] text-fg-muted">
                {s.appearances} apps · {s.minutes} mins · G+A/90 {fmt(per90g + per90a, 2)}
              </span>
              <ProvenanceBadge provenance="DEMO" compact />
            </div>
          </div>
          <div className="ml-auto flex shrink-0 flex-col items-center rounded-lg border border-accent-500/60 bg-accent-400/10 px-3 py-2 accent-glow">
            <span className="text-metric text-3xl font-black leading-none text-fg">
              {rating.rating.toFixed(1)}
            </span>
            <span className="mt-1 flex items-center gap-1 text-[9px] uppercase tracking-wide text-fg-faint">
              rating
              <EstimateTag title="All-round rating v1: percentile vs positional peers across finishing, creation, passing, carrying, defending, duels, goalkeeping and positioning, weighted for the role. A model estimate." />
            </span>
          </div>
        </div>

        <dl className="mt-3 grid max-w-md grid-cols-3 gap-2 text-center">
          {roleStats.map((stat) => (
            <div key={stat.label} className="rounded-md bg-ink-800/70 px-1 py-1.5">
              <dd className="text-metric text-[15px] font-semibold text-fg">{stat.value}</dd>
              <dt className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wide text-fg-faint">
                {stat.label}
                {'est' in stat && stat.est ? <EstimateTag /> : null}
              </dt>
            </div>
          ))}
        </dl>

        <div className="mt-3 max-w-md space-y-1">
          {topCats.map((c) => (
            <div key={c.category} className="flex items-center gap-2 text-[11px]">
              <span className="w-20 shrink-0 text-fg-muted">{c.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                <span className="block h-full rounded-full bg-accent-400" style={{ width: `${Math.round(c.score ?? 0)}%` }} />
              </span>
              <span className="text-metric w-8 text-right text-fg-faint">{Math.round(c.score ?? 0)}</span>
            </div>
          ))}
        </div>

        <Button asChild size="xs" variant="secondary" className="mt-3">
          <Link to={`/players/${player.id}`} tabIndex={active ? undefined : -1}>Player profile</Link>
        </Button>
      </div>
    </CardContent>
  )
}

function RealPerformersSlider({
  packs,
  competitionName,
}: {
  packs: ReturnType<typeof rankRealScorers>
  competitionName: string
}) {
  const slides = packs.slice(0, 8)
  const { index, setIndex, setPaused, prev, next, swipe } = useCarousel(slides.length)
  if (slides.length === 0) return null
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Top performers right now"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold tracking-tight text-fg">Top performers right now</h2>
        <span className="text-[11px] text-fg-faint">
          {competitionName} — ranked by goal involvement (the free feed has no ratings; none are invented)
        </span>
        <div className="ml-auto">
          <SliderControls length={slides.length} index={index} onPrev={prev} onNext={next} onPick={setIndex} />
        </div>
      </div>
      <Card className="cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing" {...swipe}>
        <div
          className="flex transition-transform duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((sc, i) => (
            <div key={`${sc.playerName}-${i}`} className="w-full shrink-0" aria-hidden={i !== index}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
                <KitPanel color="#2a2a30" monogram={initials(sc.playerName)} tla={sc.teamTla} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
                        #{i + 1} · {sc.teamName}
                      </span>
                      <p className="truncate text-2xl font-bold tracking-tight text-fg">{sc.playerName}</p>
                      {sc.nationality && <p className="mt-0.5 text-[11px] text-fg-muted">{sc.nationality}</p>}
                    </div>
                    <div className="ml-auto flex shrink-0 flex-col items-center rounded-lg border border-accent-500/60 bg-accent-400/10 px-3 py-2 accent-glow">
                      <span className="text-metric text-3xl font-black leading-none text-fg">{sc.involvement}</span>
                      <span className="mt-1 text-[9px] uppercase tracking-wide text-fg-faint">Goals + assists</span>
                    </div>
                  </div>
                  <dl className="mt-3 grid max-w-md grid-cols-4 gap-2 text-center">
                    {[
                      { label: 'Apps', value: sc.playedMatches !== null ? String(sc.playedMatches) : '—' },
                      { label: 'Goals', value: String(sc.goals) },
                      { label: 'Assists', value: sc.assists !== null ? String(sc.assists) : '—' },
                      { label: 'Pens', value: sc.penalties !== null ? String(sc.penalties) : '—' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-md bg-ink-800/70 px-1 py-1.5">
                        <dd className="text-metric text-[15px] font-semibold text-fg">{stat.value}</dd>
                        <dt className="text-[9px] uppercase tracking-wide text-fg-faint">{stat.label}</dt>
                      </div>
                    ))}
                  </dl>
                  <Button asChild size="xs" variant="secondary" className="mt-3">
                    <a
                      href={playerHighlightsUrl(sc.playerName, sc.teamName)}
                      target="_blank"
                      rel="noreferrer"
                      tabIndex={i === index ? undefined : -1}
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden />
                      Watch highlights (YouTube)
                    </a>
                  </Button>
                </div>
              </CardContent>
            </div>
          ))}
        </div>
      </Card>
    </section>
  )
}
