import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ListOrdered, RefreshCw, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ProvenanceBadge } from '@/components/shared/provenance'
import { useSettings } from '@/state/settings'
import { useData } from '@/state/data'
import { isBackendConfigured } from '@/api/client'
import { DEMO_CUP_ID, DEMO_SOURCE_NAME } from '@/data/generate'
import { LEAGUES } from '@/data/reference'
import type { DemoDataset } from '@/data/generate'
import {
  CUP_ROUND_LABELS,
  computeCompetitionScorers,
  computeLeagueTable,
  groupMatchesByRound,
} from '@/lib/league-table'
import { computeAllRoundSeasonRatings, RATING_SYSTEM_VERSION } from '@/lib/ratings'
import { EstimateTag } from '@/components/shared/provenance'
import {
  FD_COMPETITIONS,
  fetchFixtures,
  fetchScorers,
  fetchStandings,
  mapFixtures,
  mapScorers,
  mapStandings,
  type FixtureView,
  type FdEnvelope,
  type RawMatchesData,
  type RawScorersData,
  type RawStandingsData,
  type ScorerView,
  type StandingsView,
} from '@/lib/footballData'

/**
 * Competitions — league tables, fixtures and top scorers.
 *
 * Real mode (Phase 4a): football-data.org via the backend proxy, gated behind
 * the Settings toggle, labelled with provenance/timestamp/cache.
 *
 * Demo mode: the five fictional leagues (Bremya, La Ligarse, Serie Ass,
 * Bundassliga, Ligue Stirfry) and the 16-team Atlantica Cup from the
 * deterministic demo dataset — tables and scorers are computed in the browser
 * from the stored matches and goal events, never fabricated.
 */

type TabId = 'standings' | 'fixtures' | 'scorers'

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

export function CompetitionsPage() {
  const { settings } = useSettings()
  const { data } = useData()
  const [code, setCode] = useState<string>('PL')
  const [tab, setTab] = useState<TabId>('standings')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Bumped after every fetch or refresh so derived state recomputes. */
  const [version, setVersion] = useState(0)
  /** Session-level cache: switching tabs back and forth does not re-fetch. */
  const cacheRef = useRef(new Map<string, FdEnvelope>())

  const dateFrom = useMemo(() => isoDay(-7), [version])
  const dateTo = useMemo(() => isoDay(14), [version])
  const cacheKey = `${code}:${tab}`

  useEffect(() => {
    if (!settings.realDataEnabled || !isBackendConfigured()) return
    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    const run = async () => {
      try {
        const env = tab === 'standings'
          ? await fetchStandings(code)
          : tab === 'fixtures'
            ? await fetchFixtures(code, dateFrom, dateTo)
            : await fetchScorers(code)
        if (cancelled) return
        cacheRef.current.set(cacheKey, env)
        setVersion((v) => v + 1)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Request failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.realDataEnabled, code, tab, dateFrom, dateTo, version])

  const envelope = cacheRef.current.get(cacheKey)

  const standings: StandingsView | null = useMemo(
    () => (envelope && tab === 'standings' ? mapStandings(envelope as FdEnvelope<RawStandingsData>) : null),
    [envelope, tab, version],
  )
  const fixtures: FixtureView[] = useMemo(
    () => (envelope && tab === 'fixtures' ? mapFixtures(envelope as FdEnvelope<RawMatchesData>) : []),
    [envelope, tab, version],
  )
  const scorers: ScorerView[] = useMemo(
    () => (envelope && tab === 'scorers' ? mapScorers(envelope as FdEnvelope<RawScorersData>) : []),
    [envelope, tab, version],
  )

  const refresh = useCallback(() => {
    cacheRef.current.clear()
    setVersion((v) => v + 1)
  }, [])

  const comp = FD_COMPETITIONS.find((c) => c.code === code)

  /* ---------------- Gates ----------------
   * Real section wins only when the user turned real data on AND a backend
   * is configured. Otherwise the fictional demo leagues render here whenever
   * the demo dataset is loaded; with everything off, an explicit empty state.
   */
  const realActive = settings.realDataEnabled && isBackendConfigured()

  if (!realActive && !data) {
    const backendMissing = settings.realDataEnabled && !isBackendConfigured()
    return (
      <div className="space-y-5">
        <PageHeader
          title="Competitions"
          description="League tables, fixtures and top scorers — real competition data (football-data.org) or the fictional demo leagues."
        />
        {backendMissing ? (
          <EmptyState
            icon={Trophy}
            title="Backend not connected"
            description="Real data is fetched through the Spring Boot backend (never directly from the provider, so the API key stays server-side). Start the backend with FOOTBALL_DATA_TOKEN set and point the frontend at it via VITE_API_BASE_URL — see the backend README. The fictional demo leagues appear here instead when the demo dataset is enabled in Settings."
          />
        ) : (
          <EmptyState
            icon={Trophy}
            title="No competition data"
            description="This section shows real tables through the backend's football-data.org proxy (Settings → Real data), or the five fictional demo leagues when the demo dataset is enabled. Nothing is fetched and nothing is fabricated until then."
            showSettingsAction
          />
        )}
      </div>
    )
  }

  if (!realActive && data) {
    return <DemoCompetitions dataset={data.dataset} />
  }

  /* ---------------- Real data section ---------------- */

  return (
    <div className="space-y-5">
      <PageHeader
        title="Competitions"
        description="League tables, fixtures and top scorers from real competition data (football-data.org free tier)."
        actions={
          <Button size="sm" variant="secondary" onClick={refresh} disabled={loading}>
            <RefreshCw aria-hidden className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-60 flex-col gap-1">
          <Label htmlFor="comp-select">Competition</Label>
          <Select value={code} onValueChange={setCode}>
            <SelectTrigger id="comp-select">
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
          Free tier covers the top-5 leagues and the Champions League. The Europa and Conference
          Leagues are paid-only there. Data is delayed, not live.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-negative/40 bg-negative/10 p-3 text-[12px] leading-relaxed text-fg">
          <p className="font-semibold">Could not load {tab}</p>
          <p className="mt-0.5 text-fg-muted">{error}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={refresh}>
            Try again
          </Button>
        </div>
      )}

      {loading && !envelope && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-fg-muted">
            Loading {comp?.name} from football-data.org…
          </CardContent>
        </Card>
      )}

      {envelope && (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-md panel-border bg-ink-900/60 px-3 py-2 text-[11px] text-fg-muted">
            <ProvenanceBadge provenance="IMPORTED" />
            <span className="font-medium text-fg">{comp?.name}</span>
            <span>· {envelope.source}</span>
            <span>· fetched {fmtDay(envelope.fetchedAt)} {fmtTime(envelope.fetchedAt)}</span>
            {envelope.cached && <Badge variant="muted" className="normal-case">cached</Badge>}
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
            <TabsList>
              <TabsTrigger value="standings">
                {comp?.code === 'CL' ? 'League phase table' : 'League table'}
              </TabsTrigger>
              <TabsTrigger value="fixtures">Fixtures &amp; results</TabsTrigger>
              <TabsTrigger value="scorers">Top scorers</TabsTrigger>
            </TabsList>

            {/* ---------------- Standings ---------------- */}
            <TabsContent value="standings" className="mt-4">
              {standings && (
                <Card>
                  <CardContent className="p-0">
                    <p className="px-4 pt-3 text-[11px] text-fg-faint">
                      {standings.competitionName} · {standings.stageLabel}
                      {standings.currentMatchday !== null && ` · matchday ${standings.currentMatchday}`}
                    </p>
                    <table className="mt-1 w-full text-[13px]">
                      <thead>
                        <tr className="text-label border-b border-line">
                          <th className="px-4 py-2 text-left font-semibold">#</th>
                          <th className="py-2 text-left font-semibold">Team</th>
                          <th className="py-2 text-right font-semibold">P</th>
                          <th className="py-2 text-right font-semibold">W</th>
                          <th className="py-2 text-right font-semibold">D</th>
                          <th className="py-2 text-right font-semibold">L</th>
                          <th className="py-2 text-right font-semibold">GF</th>
                          <th className="py-2 text-right font-semibold">GA</th>
                          <th className="py-2 text-right font-semibold">GD</th>
                          <th className="px-4 py-2 text-right font-semibold">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.rows.map((r) => (
                          <tr key={r.position} className="border-b border-line/40">
                            <td className="px-4 py-2 text-fg-faint">{r.position}</td>
                            <td className="py-2">
                              <span className="flex items-center gap-2">
                                <TlaBadge tla={r.teamTla} />
                                <span className="font-medium text-fg">{r.teamName}</span>
                              </span>
                            </td>
                            <td className="text-metric py-2 text-right text-fg-muted">{r.played}</td>
                            <td className="text-metric py-2 text-right text-fg-muted">{r.won}</td>
                            <td className="text-metric py-2 text-right text-fg-muted">{r.drawn}</td>
                            <td className="text-metric py-2 text-right text-fg-muted">{r.lost}</td>
                            <td className="text-metric py-2 text-right text-fg-muted">{r.goalsFor}</td>
                            <td className="text-metric py-2 text-right text-fg-muted">{r.goalsAgainst}</td>
                            <td className="text-metric py-2 text-right text-fg-muted">
                              {r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}
                            </td>
                            <td className="text-metric px-4 py-2 text-right font-semibold text-fg">{r.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ---------------- Fixtures & results ---------------- */}
            <TabsContent value="fixtures" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <p className="flex items-center gap-1.5 px-4 pt-3 text-[11px] text-fg-faint">
                    <CalendarDays className="h-3 w-3" aria-hidden />
                    Window: past 7 days → next 14 days
                  </p>
                  <table className="mt-1 w-full text-[13px]">
                    <thead>
                      <tr className="text-label border-b border-line">
                        <th className="px-4 py-2 text-left font-semibold">Kick-off</th>
                        <th className="py-2 text-left font-semibold">Fixture</th>
                        <th className="py-2 text-center font-semibold">Score</th>
                        <th className="px-4 py-2 text-right font-semibold">Round</th>
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
                            {f.finished
                              ? `${f.homeGoals}–${f.awayGoals}`
                              : <span className="font-normal text-fg-faint">{f.status === 'TIMED' ? '—' : f.status}</span>}
                          </td>
                          <td className="px-4 py-2 text-right text-[11px] text-fg-faint">
                            {f.matchday !== null && `MD ${f.matchday}`}
                            {f.stageLabel && f.stageLabel !== 'Regular season' && (
                              <span className="block">{f.stageLabel}{f.groupLabel ? ` · ${f.groupLabel}` : ''}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {fixtures.length === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-fg-muted">
                      No matches in this window.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---------------- Top scorers ---------------- */}
            <TabsContent value="scorers" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <p className="flex items-center gap-1.5 px-4 pt-3 text-[11px] text-fg-faint">
                    <ListOrdered className="h-3 w-3" aria-hidden />
                    Sorted by goals (provider order)
                  </p>
                  <table className="mt-1 w-full text-[13px]">
                    <thead>
                      <tr className="text-label border-b border-line">
                        <th className="px-4 py-2 text-left font-semibold">#</th>
                        <th className="py-2 text-left font-semibold">Player</th>
                        <th className="py-2 text-left font-semibold">Team</th>
                        <th className="py-2 text-right font-semibold">Apps</th>
                        <th className="py-2 text-right font-semibold">Goals</th>
                        <th className="py-2 text-right font-semibold">Assists</th>
                        <th className="px-4 py-2 text-right font-semibold">Pens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scorers.map((s, i) => (
                        <tr key={`${s.playerName}-${i}`} className="border-b border-line/40">
                          <td className="px-4 py-2 text-fg-faint">{i + 1}</td>
                          <td className="py-2">
                            <span className="font-medium text-fg">{s.playerName}</span>
                            {s.nationality && (
                              <span className="block text-[11px] text-fg-faint">{s.nationality}</span>
                            )}
                          </td>
                          <td className="py-2">
                            <span className="flex items-center gap-2">
                              <TlaBadge tla={s.teamTla} />
                              <span className="text-fg-muted">{s.teamName}</span>
                            </span>
                          </td>
                          <td className="text-metric py-2 text-right text-fg-muted">{s.playedMatches ?? '—'}</td>
                          <td className="text-metric py-2 text-right font-semibold text-fg">{s.goals}</td>
                          <td className="text-metric py-2 text-right text-fg-muted">{s.assists ?? '—'}</td>
                          <td className="text-metric px-4 py-2 text-right text-fg-muted">{s.penalties ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Demo section — the five fictional leagues + the Atlantica Cup      */
/* ------------------------------------------------------------------ */

function DemoCompetitions({ dataset }: { dataset: DemoDataset }) {
  const { settings } = useSettings()
  const [competitionId, setCompetitionId] = useState<string>(dataset.competition.id)
  const [tab, setTab] = useState<'table' | 'fixtures' | 'scorers' | 'assists' | 'players'>('table')
  /** Real data requested but no backend: say so instead of silently substituting. */
  const realPending = settings.realDataEnabled && !isBackendConfigured()

  const selected = dataset.competitions.find((c) => c.id === competitionId) ?? dataset.competition
  const isCup = selected.id === DEMO_CUP_ID

  const compMatches = useMemo(
    () => dataset.matches.filter((m) => m.competitionId === selected.id),
    [dataset, selected.id],
  )
  const compTeams = useMemo(() => {
    const ids = new Set<string>()
    for (const m of compMatches) {
      ids.add(m.homeTeamId)
      ids.add(m.awayTeamId)
    }
    return dataset.teams.filter((t) => ids.has(t.id))
  }, [compMatches, dataset.teams])
  const table = useMemo(() => computeLeagueTable(compMatches, compTeams), [compMatches, compTeams])
  const scorers = useMemo(
    () => computeCompetitionScorers(compMatches, dataset.events, dataset.players, dataset.playerMatchMinutes, dataset.teams),
    [compMatches, dataset, selected.id],
  )
  const assistsBoard = useMemo(
    () => computeCompetitionScorers(compMatches, dataset.events, dataset.players, dataset.playerMatchMinutes, dataset.teams, 20, 'assists'),
    [compMatches, dataset, selected.id],
  )
  /** All-round rating board is global (league + cup minutes combined):
   *  position-tailored percentiles need the whole snapshot's peer groups. */
  const topRated = useMemo(() => {
    const teamLookup = new Map(dataset.teams.map((t) => [t.id, t]))
    const playerLookup = new Map(dataset.players.map((p) => [p.id, p]))
    return computeAllRoundSeasonRatings(dataset.players, 450, 20).map((r) => {
      const player = playerLookup.get(r.playerId)
      const team = player ? teamLookup.get(player.teamId) : undefined
      return {
        ...r,
        teamName: team?.name ?? '—',
        teamTla: team?.shortName ?? '—',
        goals: player?.stats.goals ?? 0,
        assists: player?.stats.assists ?? 0,
      }
    })
  }, [dataset])
  const rounds = useMemo(() => {
    const grouped = groupMatchesByRound(compMatches)
    return isCup
      ? grouped.map((g) => ({ ...g, label: CUP_ROUND_LABELS[g.round] ?? `Round ${g.round}` }))
      : grouped
  }, [compMatches, isCup])

  const league = LEAGUES.find((l) => l.id === selected.id)
  const teamById = useMemo(() => new Map(dataset.teams.map((t) => [t.id, t])), [dataset.teams])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Competitions"
        description="League tables, fixtures and top scorers for the five fictional demo leagues (Bremya, La Ligarse, Serie Ass, Bundassliga, Ligue Stirfry) and the 16-team Atlantica Cup. All fictional, all DEMO."
      />

      {realPending && (
        <div className="rounded-md panel-border bg-accent-500/10 p-3 text-[12px] leading-relaxed text-fg">
          <p className="font-semibold">Real data is enabled but no backend is connected</p>
          <p className="mt-0.5 text-fg-muted">
            The fictional demo leagues are shown below. Start the Spring Boot backend with
            FOOTBALL_DATA_TOKEN set to load real tables instead — see the backend README.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-60 flex-col gap-1">
          <Label htmlFor="demo-comp-select">Competition</Label>
          <Select value={selected.id} onValueChange={setCompetitionId}>
            <SelectTrigger id="demo-comp-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dataset.competitions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="flex-1 text-[11px] leading-relaxed text-fg-faint">
          {isCup
            ? 'Single-leg knockout: each league\u2019s top three sides plus the best remaining team, seeded so the strongest cannot meet in the Round of 16.'
            : `First 8 of ${league ? league.totalRounds : 38} matchdays played in this demo snapshot. Tables, fixtures and scorers are computed in the browser from the stored matches and goal events.`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md panel-border bg-ink-900/60 px-3 py-2 text-[11px] text-fg-muted">
        <ProvenanceBadge provenance="DEMO" />
        <span className="font-medium text-fg">{selected.name}</span>
        <span>· {DEMO_SOURCE_NAME}</span>
        <span>· deterministic snapshot</span>
        <span>· {compMatches.length} matches</span>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="table">{isCup ? 'Knockout' : 'League table'}</TabsTrigger>
          <TabsTrigger value="fixtures">Fixtures &amp; results</TabsTrigger>
          <TabsTrigger value="scorers">Top scorers</TabsTrigger>
          <TabsTrigger value="assists">Top assists</TabsTrigger>
          <TabsTrigger value="players">Top players</TabsTrigger>
        </TabsList>

        {/* ---------------- League table / cup knockout ---------------- */}
        <TabsContent value="table" className="mt-4">
          {isCup ? (
            <div className="space-y-3">
              {rounds.map((r) => (
                <Card key={r.round}>
                  <CardContent className="p-0">
                    <p className="px-4 pt-3 text-[11px] text-fg-faint">{r.label}</p>
                    <table className="mt-1 w-full text-[13px]">
                      <tbody>
                        {r.matches.map((m) => {
                          const home = teamById.get(m.homeTeamId)
                          const away = teamById.get(m.awayTeamId)
                          const homeWon = m.homeGoals > m.awayGoals
                          return (
                            <tr key={m.id} className="border-b border-line/40">
                              <td className="px-4 py-2">
                                <span className="flex items-center gap-2">
                                  <TlaBadge tla={home?.shortName ?? '—'} />
                                  <Link
                                    to={`/matches/${m.id}`}
                                    className={homeWon ? 'font-semibold text-fg' : 'text-fg-muted hover:text-fg'}
                                  >
                                    {home?.name ?? m.homeTeamId}
                                  </Link>
                                </span>
                              </td>
                              <td className="text-metric py-2 text-center font-semibold text-fg">
                                {m.homeGoals}–{m.awayGoals}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <span className="flex items-center justify-end gap-2">
                                  <Link
                                    to={`/matches/${m.id}`}
                                    className={!homeWon ? 'font-semibold text-fg' : 'text-fg-muted hover:text-fg'}
                                  >
                                    {away?.name ?? m.awayTeamId}
                                  </Link>
                                  <TlaBadge tla={away?.shortName ?? '—'} />
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <p className="px-4 pt-3 text-[11px] text-fg-faint">
                  {selected.name} · {selected.shortName} · matchdays 1–8
                </p>
                <table className="mt-1 w-full text-[13px]">
                  <thead>
                    <tr className="text-label border-b border-line">
                      <th className="px-4 py-2 text-left font-semibold">#</th>
                      <th className="py-2 text-left font-semibold">Team</th>
                      <th className="py-2 text-right font-semibold">P</th>
                      <th className="py-2 text-right font-semibold">W</th>
                      <th className="py-2 text-right font-semibold">D</th>
                      <th className="py-2 text-right font-semibold">L</th>
                      <th className="py-2 text-right font-semibold">GF</th>
                      <th className="py-2 text-right font-semibold">GA</th>
                      <th className="py-2 text-right font-semibold">GD</th>
                      <th className="px-4 py-2 text-right font-semibold">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((r) => (
                      <tr key={r.teamId} className="border-b border-line/40">
                        <td className="px-4 py-2 text-fg-faint">{r.position}</td>
                        <td className="py-2">
                          <span className="flex items-center gap-2">
                            <TlaBadge tla={r.teamTla} />
                            <span className="font-medium text-fg">{r.teamName}</span>
                          </span>
                        </td>
                        <td className="text-metric py-2 text-right text-fg-muted">{r.played}</td>
                        <td className="text-metric py-2 text-right text-fg-muted">{r.won}</td>
                        <td className="text-metric py-2 text-right text-fg-muted">{r.drawn}</td>
                        <td className="text-metric py-2 text-right text-fg-muted">{r.lost}</td>
                        <td className="text-metric py-2 text-right text-fg-muted">{r.goalsFor}</td>
                        <td className="text-metric py-2 text-right text-fg-muted">{r.goalsAgainst}</td>
                        <td className="text-metric py-2 text-right text-fg-muted">
                          {r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}
                        </td>
                        <td className="text-metric px-4 py-2 text-right font-semibold text-fg">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ---------------- Fixtures & results ---------------- */}
        <TabsContent value="fixtures" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <p className="flex items-center gap-1.5 px-4 pt-3 text-[11px] text-fg-faint">
                <CalendarDays className="h-3 w-3" aria-hidden />
                All {selected.name} matches in the snapshot — click a match for the full analysis
              </p>
              <table className="mt-1 w-full text-[13px]">
                <thead>
                  <tr className="text-label border-b border-line">
                    <th className="px-4 py-2 text-left font-semibold">Kick-off</th>
                    <th className="py-2 text-left font-semibold">Fixture</th>
                    <th className="py-2 text-center font-semibold">Score</th>
                    <th className="px-4 py-2 text-right font-semibold">Round</th>
                  </tr>
                </thead>
                <tbody>
                  {compMatches.map((m) => {
                    const home = teamById.get(m.homeTeamId)
                    const away = teamById.get(m.awayTeamId)
                    return (
                      <tr key={m.id} className="border-b border-line/40">
                        <td className="px-4 py-2 text-fg-muted">
                          {fmtDay(m.kickoff)}
                          <span className="block text-[11px] text-fg-faint">{fmtTime(m.kickoff)}</span>
                        </td>
                        <td className="py-2">
                          <Link
                            to={`/matches/${m.id}`}
                            className="flex items-center gap-2 rounded hover:text-fg"
                          >
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
                          {isCup ? CUP_ROUND_LABELS[m.round] ?? `Round ${m.round}` : `MD ${m.round}`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Top scorers ---------------- */}
        <TabsContent value="scorers" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <p className="flex items-center gap-1.5 px-4 pt-3 text-[11px] text-fg-faint">
                <ListOrdered className="h-3 w-3" aria-hidden />
                {selected.name} only — counted from the stored goal events, not the cross-competition season aggregates
              </p>
              <table className="mt-1 w-full text-[13px]">
                <thead>
                  <tr className="text-label border-b border-line">
                    <th className="px-4 py-2 text-left font-semibold">#</th>
                    <th className="py-2 text-left font-semibold">Player</th>
                    <th className="py-2 text-left font-semibold">Team</th>
                    <th className="py-2 text-right font-semibold">Apps</th>
                    <th className="py-2 text-right font-semibold">Goals</th>
                    <th className="px-4 py-2 text-right font-semibold">Assists</th>
                  </tr>
                </thead>
                <tbody>
                  {scorers.map((s, i) => (
                    <tr key={s.playerId} className="border-b border-line/40">
                      <td className="px-4 py-2 text-fg-faint">{i + 1}</td>
                      <td className="py-2">
                        <Link to={`/players/${s.playerId}`} className="font-medium text-fg hover:text-accent-300">
                          {s.playerName}
                        </Link>
                      </td>
                      <td className="py-2">
                        <span className="flex items-center gap-2">
                          <TlaBadge tla={s.teamTla} />
                          <span className="text-fg-muted">{s.teamName}</span>
                        </span>
                      </td>
                      <td className="text-metric py-2 text-right text-fg-muted">{s.appearances}</td>
                      <td className="text-metric py-2 text-right font-semibold text-fg">{s.goals}</td>
                      <td className="text-metric px-4 py-2 text-right text-fg-muted">{s.assists}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
        {/* ---------------- Top assists ---------------- */}
        <TabsContent value="assists" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <p className="flex items-center gap-1.5 px-4 pt-3 text-[11px] text-fg-faint">
                <ListOrdered className="h-3 w-3" aria-hidden />
                {selected.name} only — assists counted from the stored goal events (the pass before the goal)
              </p>
              <table className="mt-1 w-full text-[13px]">
                <thead>
                  <tr className="text-label border-b border-line">
                    <th className="px-4 py-2 text-left font-semibold">#</th>
                    <th className="py-2 text-left font-semibold">Player</th>
                    <th className="py-2 text-left font-semibold">Team</th>
                    <th className="py-2 text-right font-semibold">Apps</th>
                    <th className="py-2 text-right font-semibold">Assists</th>
                    <th className="px-4 py-2 text-right font-semibold">Goals</th>
                  </tr>
                </thead>
                <tbody>
                  {assistsBoard.map((s, i) => (
                    <tr key={s.playerId} className="border-b border-line/40">
                      <td className="px-4 py-2 text-fg-faint">{i + 1}</td>
                      <td className="py-2">
                        <Link to={`/players/${s.playerId}`} className="font-medium text-fg hover:text-accent-300">
                          {s.playerName}
                        </Link>
                      </td>
                      <td className="py-2">
                        <span className="flex items-center gap-2">
                          <TlaBadge tla={s.teamTla} />
                          <span className="text-fg-muted">{s.teamName}</span>
                        </span>
                      </td>
                      <td className="text-metric py-2 text-right text-fg-muted">{s.appearances}</td>
                      <td className="text-metric py-2 text-right font-semibold text-fg">{s.assists}</td>
                      <td className="text-metric px-4 py-2 text-right text-fg-muted">{s.goals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {assistsBoard.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-fg-muted">No assists recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Top players (rating board) ---------------- */}
        <TabsContent value="players" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <p className="flex items-center gap-1.5 px-4 pt-3 text-[11px] text-fg-faint">
                <Trophy className="h-3 w-3" aria-hidden />
                All-round rating ({RATING_SYSTEM_VERSION}, est.) — finishing, creation, passing,
                carrying, defending, duels, goalkeeping and positioning, percentile-scored
                against each player's own position group and weighted for their role · minimum
                450 minutes · never a strikers-only board
              </p>
              <table className="mt-1 w-full text-[13px]">
                <thead>
                  <tr className="text-label border-b border-line">
                    <th className="px-4 py-2 text-left font-semibold">#</th>
                    <th className="py-2 text-left font-semibold">Player</th>
                    <th className="py-2 text-left font-semibold">Team</th>
                    <th className="py-2 text-right font-semibold">Apps</th>
                    <th className="py-2 text-right font-semibold">Min</th>
                    <th className="py-2 text-right font-semibold">G</th>
                    <th className="py-2 text-right font-semibold">A</th>
                    <th className="py-2 text-left font-semibold">Strongest</th>
                    <th className="px-4 py-2 text-right font-semibold">All-round rating</th>
                  </tr>
                </thead>
                <tbody>
                  {topRated.map((p, i) => (
                    <tr key={p.playerId} className="border-b border-line/40">
                      <td className="px-4 py-2 text-fg-faint">{i + 1}</td>
                      <td className="py-2">
                        <Link to={`/players/${p.playerId}`} className="font-medium text-fg hover:text-accent-300">
                          {p.playerName}
                        </Link>
                        <span className="ml-1.5 text-[11px] text-fg-faint">{p.position}</span>
                      </td>
                      <td className="py-2">
                        <span className="flex items-center gap-2">
                          <TlaBadge tla={p.teamTla} />
                          <span className="text-fg-muted">{p.teamName}</span>
                        </span>
                      </td>
                      <td className="text-metric py-2 text-right text-fg-muted">{p.appearances}</td>
                      <td className="text-metric py-2 text-right text-fg-muted">{p.minutes}</td>
                      <td className="text-metric py-2 text-right text-fg-muted">{p.goals}</td>
                      <td className="text-metric py-2 text-right text-fg-muted">{p.assists}</td>
                      <td className="py-2 text-fg-muted">
                        {p.topCategory ? (
                          <span className="flex items-center gap-1">
                            {p.topCategory.label}
                            <span className="text-metric text-[11px] text-fg-faint">
                              {Math.round(p.topCategory.score ?? 0)}
                            </span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className="text-metric px-4 py-2 text-right font-semibold text-fg">
                        <span className="inline-flex items-center gap-1.5">
                          {p.rating.toFixed(1)}
                          <EstimateTag />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {topRated.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-fg-muted">
                  No player has 450 minutes yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
