import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CalendarDays,
  Footprints,
  Gauge,
  Map as MapIcon,
  Ruler,
  ShieldQuestion,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DEMO_CUP_ID, datasetScopeLabel } from '@/data/generate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ProvenanceBadge } from '@/components/shared/provenance'
import { PlayerAvatar, PositionBadge } from '@/components/shared/player-bits'
import {
  MetricInfoTrigger,
  PercentileBar,
  SmallSampleWarning,
  StatValue,
} from '@/components/shared/metric-widgets'
import { InfoNote } from '@/components/shared/info-note'
import { Pitch, SegmentsLayer, TouchMapLayer } from '@/components/pitch/Pitch'
import { computePlayerCarryMap, computePlayerPassMap } from '@/lib/playerMaps'
import { computePeerBandShares, computePlayerShotMap, XG_BANDS, xgColor, type ShotPoint } from '@/lib/playerShots'
import { computeAllRoundSeasonRatings } from '@/lib/ratings'
import { downloadPlayerCard } from '@/lib/playerCard'
import { Download } from 'lucide-react'
import { PercentileRadar } from '@/components/charts/percentile-radar'
import { useData } from '@/state/data'
import { useSettings } from '@/state/settings'
import { recordRecentlyViewed, scenarioStore, useStore } from '@/lib/store'
import {
  DIMENSION_LABELS,
  DIMENSION_METRICS,
  METRICS,
  METRIC_CATEGORY_LABELS,
  PHASES,
  PHASE_ORDER,
  metricValueForPlayer,
  type MetricCategory,
} from '@/lib/metrics'
import {
  buildPeerGroupWithContext,
  computeSimilarity,
  computeMetricRow,
  computePhaseAnalysis,
  defaultWeightsForRole,
  playerAge,
} from '@/lib/analysis'
import { ROLES } from '@/lib/roles'
import { groupOf } from '@/lib/positions'
import { fmt, fmtDate } from '@/lib/utils'

export function PlayerProfilePage() {
  const { playerId } = useParams<{ playerId: string }>()
  const { data, playerById, teamById, players, teams, events, matches } = useData()
  const { settings } = useSettings()
  const userScenarios = useStore(scenarioStore)

  const player = playerId ? playerById(playerId) : undefined

  const [activeTab, setActiveTab] = useState('performance')
  const [mapKind, setMapKind] = useState<'passes' | 'carries'>('passes')
  const [passFilter, setPassFilter] = useState<'all' | 'progressive' | 'final-third'>('all')

  useEffect(() => {
    if (player) recordRecentlyViewed(player.id)
  }, [player])

  const passMap = useMemo(
    () => (player ? computePlayerPassMap(events, matches, player) : null),
    [player, events, matches],
  )
  const carryMap = useMemo(
    () => (player ? computePlayerCarryMap(events, matches, player) : null),
    [player, events, matches],
  )

  const shotMap = useMemo(
    () => (player ? computePlayerShotMap(events, matches, player) : null),
    [player, events, matches],
  )
  const peerBands = useMemo(
    () => (player ? computePeerBandShares(events, matches, players, groupOf(player.position)) : null),
    [player, events, matches, players],
  )
  const playerRating = useMemo(
    () => (player ? computeAllRoundSeasonRatings(players, 450).find((r) => r.playerId === player.id) ?? null : null),
    [player, players],
  )

  const peers = useMemo(() => {
    if (!player || !data) return []
    return buildPeerGroupWithContext(
      players,
      new Map(teams.map((t) => [t.id, t])),
      { positionGroup: groupOf(player.position), minMinutes: 270 },
    )
  }, [player, players, teams, data])

  if (!data || !player) {
    return (
      <div className="space-y-5">
        <PageHeader title="Player profile" />
        <EmptyState
          icon={Users}
          title="Player not found or data unavailable"
          description={
            settings.demoMode
              ? 'This player record does not exist in the loaded dataset.'
              : 'Demo data is disabled and no real data source is connected. Enable demo data in Settings to view profiles of fictional players.'
          }
          showSettingsAction={!settings.demoMode}
        />
      </div>
    )
  }

  const team = teamById(player.teamId)
  const group = groupOf(player.position)
  const role = ROLES[player.role]
  const smallSample = player.stats.minutes < 270

  const applicableMetrics = (Object.keys(METRICS) as string[]).filter((id) =>
    metricValueForPlayer(player, id, group) !== null,
  )

  const byCategory = new Map<MetricCategory, string[]>()
  for (const id of applicableMetrics) {
    const cat = METRICS[id]!.category
    const list = byCategory.get(cat) ?? []
    list.push(id)
    byCategory.set(cat, list)
  }

  /* Tactical identity: percentile strengths/weaknesses vs position peers */
  const dimensionRows = (Object.keys(DIMENSION_METRICS) as (keyof typeof DIMENSION_METRICS)[])
    .map((dim) => {
      const rows = DIMENSION_METRICS[dim]
        .map((id) => computeMetricRow(player, peers, id))
        .filter((r): r is NonNullable<typeof r> => r !== null && r.value !== null && r.percentile !== null)
      if (rows.length === 0) return null
      const avg = rows.reduce((s, r) => s + (r.percentile ?? 0), 0) / rows.length
      return { dim, avg, rows }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.avg - a.avg)

  const radarAxes = dimensionRows.flatMap((d) => d.rows.slice(0, 1).map((r) => METRICS[r.metricId]!.label))
  const radarSeries = [
    {
      name: player.name,
      color: team?.color ?? '#d4f93a',
      data: Object.fromEntries(
        dimensionRows.flatMap((d) =>
          d.rows.slice(0, 1).map((r) => [METRICS[r.metricId]!.label, r.percentile ?? 0]),
        ),
      ),
    },
  ]

  /* Match evidence */
  const playerMatches = data.dataset.playerMatchMinutes
    .filter((r) => r.playerId === player.id)
    .map((r) => ({ row: r, match: data.dataset.matches.find((m) => m.id === r.matchId)! }))
    .sort((a, b) => b.match.kickoff.localeCompare(a.match.kickoff))
  const playerGoals = events.filter((e) => e.type === 'goal' && e.playerId === player.id)
  const playerAssists = events.filter((e) => e.type === 'goal' && e.secondaryPlayerId === player.id)

  /* Similar players */
  const similar = computeSimilarity(player, {
    weights: defaultWeightsForRole(player.role),
    candidates: peers,
  }).slice(0, 3)

  /* Related intelligence */
  const relatedNews = data.content.news.filter(
    (n) => n.playerId === player.id || n.teamId === player.teamId,
  )
  const roomPosts = data.content.discussions.filter((p) => p.playerId === player.id)
  const relatedScenarios = [...data.content.demoScenarios, ...userScenarios].filter((sc) =>
    [...sc.attack.players, ...sc.defence.players].some((sp) => sp.linkedPlayerId === player.id),
  )

  return (
    <div className="space-y-5">
      {/* Identity header */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start gap-5">
            <PlayerAvatar name={player.name} position={player.position} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-fg">{player.name}</h1>
                <PositionBadge position={player.position} />
                {player.secondaryPosition && <PositionBadge position={player.secondaryPosition} className="opacity-60" />}
                <ProvenanceBadge provenance={player.provenance} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-muted">
                <span className="font-medium text-fg">{team?.name}</span>
                <span className="flex items-center gap-1"><Gauge className="h-3.5 w-3.5 text-fg-faint" aria-hidden />{role.label}</span>
                <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-fg-faint" aria-hidden />{playerAge(player)} yrs ({fmtDate(player.dob)})</span>
                <span className="flex items-center gap-1"><Footprints className="h-3.5 w-3.5 text-fg-faint" aria-hidden />{player.foot}-footed</span>
                {player.heightCm && (
                  <span className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5 text-fg-faint" aria-hidden />{player.heightCm} cm</span>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
                {datasetScopeLabel(data.dataset)} · {data.dataset.season.label} · Source: {player.sourceName} ·
                Coverage: matchdays 1–8. All statistics are fictional demo records.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <StatValue label="Appearances" value={player.stats.appearances} />
              <StatValue label="Minutes" value={player.stats.minutes} className="value-lg" />
              <StatValue label="Starts" value={player.stats.starts} />
              {smallSample && <SmallSampleWarning minutes={player.stats.minutes} />}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadPlayerCard({
                    player,
                    team,
                    rating: playerRating,
                    shotPoints: shotMap?.points ?? [],
                    seasonLabel: data.dataset.season.label,
                  })
                }
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Export card (SVG)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="tactical">Tactical identity</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="related">Related intelligence</TabsTrigger>
        </TabsList>

        {/* ---------------- Performance ---------------- */}
        <TabsContent value="performance">
          <PercentileBarsCard dimensionRows={dimensionRows} group={group} />

          {(['output', 'passing', 'carrying', 'possession', 'defending', 'duels'] as MetricCategory[]).map(
            (cat) => {
              const ids = byCategory.get(cat)
              if (!ids || ids.length === 0) return null
              return (
                <Card key={cat} className="mb-4">
                  <CardHeader>
                    <CardTitle>{METRIC_CATEGORY_LABELS[cat]}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
                    {ids.map((id) => {
                      const def = METRICS[id]!
                      const value = metricValueForPlayer(player, id, group)
                      return (
                        <StatValue
                          key={id}
                          label={def.label}
                          value={value}
                          unit={def.unit === 'per 90' ? '/90' : def.unit === '%' ? '%' : undefined}
                          metricId={id}
                          provenance={def.provenance}
                          warning={
                            player.stats.minutes < 270
                              ? `Sample: ${player.stats.minutes} min`
                              : undefined
                          }
                        />
                      )
                    })}
                  </CardContent>
                </Card>
              )
            },
          )}
          <InfoNote variant="scope" title="Measured facts vs interpretation">
            Counts and rates above are measured (demo) aggregates. xG and xA are model estimates
            (provenance: MODEL EST.). Metrics not applicable to this position group are omitted rather
            than shown as zero.
          </InfoNote>
          <div className="mt-3">
            <Button
              variant="link"
              size="sm"
              className="px-0"
              onClick={() => setActiveTab('tactical')}
            >
              <MapIcon className="h-3.5 w-3.5" aria-hidden />
              View demo action map &amp; tactical identity →
            </Button>
          </div>
        </TabsContent>

        {/* ---------------- Tactical identity ---------------- */}
        <TabsContent value="tactical">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Role profile vs {group} peers</CardTitle>
              </CardHeader>
              <CardContent>
                <PercentileRadar axes={radarAxes} series={radarSeries} height={280} showLegend={false} />
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2">
                  {dimensionRows.map((d) => (
                    <div key={d.dim} className="flex items-center justify-between gap-3 text-xs">
                      <span className="capitalize text-fg-muted">{d.dim}</span>
                      <PercentileBar value={d.avg} label={`${d.dim} percentile`} className="w-28" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Position &amp; action map</CardTitle>
              </CardHeader>
              <CardContent>
                <Pitch ariaLabel={`Demo touch map for ${player.name}`}>
                  <TouchMapLayer points={player.touchMap} />
                </Pitch>
                <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
                  Demo spatial sample ({player.touchMap.length} fictional touch locations) generated for this
                  player's position, minutes and team style. Real positional data requires tracking or
                  event coordinates from a licensed provider. <ProvenanceBadge provenance="DEMO" compact />
                </p>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>Pass &amp; carry maps — season</CardTitle>
                <div className="flex rounded-md border border-line-strong p-0.5" role="group" aria-label="Map type">
                  {(['passes', 'carries'] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setMapKind(kind)}
                      aria-pressed={mapKind === kind}
                      className={
                        mapKind === kind
                          ? 'rounded bg-accent-400/15 px-2.5 py-1 text-[11px] font-semibold text-accent-300'
                          : 'rounded px-2.5 py-1 text-[11px] font-medium text-fg-muted hover:text-fg'
                      }
                    >
                      {kind === 'passes' ? 'Passes' : 'Carries'}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {mapKind === 'passes' ? (
                  passMap && passMap.completed.length > 0 ? (
                    <>
                      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Pass filter">
                        {([
                          { id: 'all', label: `All completed (${passMap.sampleCompleted})` },
                          { id: 'progressive', label: `Progressive (${passMap.progressiveCount})` },
                          { id: 'final-third', label: `Final-third entries (${passMap.finalThirdEntries})` },
                        ] as const).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setPassFilter(f.id)}
                            aria-pressed={passFilter === f.id}
                            className={
                              passFilter === f.id
                                ? 'rounded-md bg-accent-500 px-2.5 py-1 text-[11px] font-semibold text-on-bright'
                                : 'rounded-md bg-ink-800 px-2.5 py-1 text-[11px] font-medium text-fg-muted hover:bg-ink-700 hover:text-fg'
                            }
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                      <Pitch ariaLabel={`Season pass map for ${player.name} (attacking right)`}>
                        <SegmentsLayer
                          segments={
                            passFilter === 'progressive'
                              ? passMap.completed.filter((s) => s.progressive)
                              : passFilter === 'final-third'
                                ? passMap.completed.filter((s) => s.finalThirdEntry)
                                : passMap.completed
                          }
                        />
                      </Pitch>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
                        {[
                          { label: 'Sample passes', value: String(passMap.sampleCompleted + passMap.sampleIncomplete) },
                          { label: 'Completion (sample)', value: passMap.completionPct !== null ? `${passMap.completionPct}%` : '—' },
                          { label: 'Progressive share', value: passMap.progressiveSharePct !== null ? `${passMap.progressiveSharePct}%` : '—' },
                          { label: 'Avg progression', value: `${passMap.avgProgression}` },
                          { label: 'Avg start x', value: `${passMap.avgStartX}` },
                        ].map((stat) => (
                          <div key={stat.label} className="rounded-md bg-ink-800/70 px-1 py-1.5">
                            <div className="text-metric text-[15px] font-semibold text-fg">{stat.value}</div>
                            <div className="text-[9px] uppercase tracking-wide text-fg-faint">{stat.label}</div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
                        Origins by channel — left {passMap.channels.left}% · central {passMap.channels.central}% ·
                        right {passMap.channels.right}%. Volt arrows are progressive (≥10 units toward goal).
                        Drawn from the stored pass sample ({passMap.sampleCompleted} completed of{' '}
                        {passMap.sampleCompleted + passMap.sampleIncomplete} sampled over {passMap.matchesSampled}{' '}
                        matches) — a sample of his passing, not every pass. Away matches rotated so he always
                        attacks right. <ProvenanceBadge provenance="DEMO" compact />
                      </p>
                    </>
                  ) : (
                    <p className="py-8 text-center text-sm text-fg-muted">
                      No sampled pass events stored for this player.
                    </p>
                  )
                ) : carryMap && carryMap.count > 0 ? (
                  <>
                    <Pitch ariaLabel={`Season carry map for ${player.name} (attacking right)`}>
                      <SegmentsLayer segments={carryMap.carries} showEndDots />
                    </Pitch>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
                      {[
                        { label: 'Progressive carries', value: String(carryMap.count) },
                        { label: 'Total distance', value: `${carryMap.totalDistance}u` },
                        { label: 'Avg distance', value: `${carryMap.avgDistance}u` },
                        { label: 'Into final third', value: String(carryMap.intoFinalThird) },
                        { label: 'Avg end x', value: `${carryMap.avgEndX}` },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-md bg-ink-800/70 px-1 py-1.5">
                          <div className="text-metric text-[15px] font-semibold text-fg">{stat.value}</div>
                          <div className="text-[9px] uppercase tracking-wide text-fg-faint">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
                      Origins by channel — left {carryMap.channels.left}% · central {carryMap.channels.central}% ·
                      right {carryMap.channels.right}%. White dots mark where carries ended; distances are pitch
                      units from event coordinates (a sample of events, not tracking data).{' '}
                      <ProvenanceBadge provenance="DEMO" compact />
                    </p>
                  </>
                ) : (
                  <p className="py-8 text-center text-sm text-fg-muted">
                    No progressive-carry events stored for this player.
                  </p>
                )}
              </CardContent>
            </Card>

            {shotMap && shotMap.attempts > 0 && (
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle>Shot map &amp; shot quality — season</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div>
                      <ShotMapSvg points={shotMap.points} playerName={player.name} />
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-fg-faint">
                        <span className="flex items-center gap-1">
                          xG
                          <span className="inline-block h-2 w-20 rounded" style={{ background: 'linear-gradient(90deg,#3e8fbf,#63c5b5,#a8dd70,#f2d13c,#f4902a,#e53a2e)' }} />
                          low → high
                        </span>
                        <span>○ white ring = goal</span>
                        <span>Final third shown, attacking right</span>
                      </div>
                    </div>
                    <div>
                      {peerBands && (
                        <ShotBandsChart shares={peerBands.shares} ownShares={shotMap.bandShares} peerCount={peerBands.peerCount} />
                      )}
                      <p className="mt-1 text-[11px] leading-relaxed text-fg-faint">
                        Share of attempts in each xG band vs {group} peers (dots) — dashed line is the peer median,
                        volt dot is {player.name}. A right-shifted profile means better chances, not just more shots.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
                    {[
                      { label: 'Attempts', value: String(shotMap.attempts) },
                      { label: 'Goals', value: String(shotMap.goals) },
                      { label: 'Conversion', value: shotMap.conversionPct !== null ? `${shotMap.conversionPct}%` : '—' },
                      { label: 'xG / shot (est.)', value: fmt(shotMap.avgXgPerShot, 2) },
                      { label: 'Goals − xG (est.)', value: fmt(shotMap.goalsMinusXg, 2) },
                      { label: 'Big chances (xG≥.3)', value: String(shotMap.bigChances) },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-md bg-ink-800/70 px-1 py-1.5">
                        <div className="text-metric text-[15px] font-semibold text-fg">{stat.value}</div>
                        <div className="text-[9px] uppercase tracking-wide text-fg-faint">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
                    {shotMap.insideBoxSharePct !== null && `${shotMap.insideBoxSharePct}% of attempts from inside the box. `}
                    From stored shot + goal events ({shotMap.attempts} attempts); outcomes beyond goal/no-goal and
                    body part are not in the event feed, so they are not shown. xG values are model estimates.{' '}
                    <ProvenanceBadge provenance="DEMO" compact />
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Phase contributions &amp; tactical suitability</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
                {PHASE_ORDER.map((phase) => {
                  const phaseRows = computePhaseAnalysis(player, peers, phase).rows.filter(
                    (r) => r.value !== null,
                  )
                  return (
                    <div key={phase}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-label">{PHASES[phase].label.toLowerCase()} contribution</span>
                      </div>
                      <div className="space-y-1.5">
                        {phaseRows.slice(0, 3).map((row) => (
                          <div key={row.metricId} className="flex items-center gap-2 text-xs">
                            <span className="w-40 shrink-0 truncate text-fg-muted">
                              {METRICS[row.metricId]!.label}
                            </span>
                            <span className="text-metric w-14 shrink-0 text-fg">
                              {fmt(row.value, METRICS[row.metricId]!.decimals)}
                              <span className="text-[9px] text-fg-faint">
                                {METRICS[row.metricId]!.unit === '%' ? '%' : '/90'}
                              </span>
                            </span>
                            <PercentileBar value={row.percentile} className="flex-1" label={`${METRICS[row.metricId]!.label} percentile`} />
                            <MetricInfoTrigger metricId={row.metricId} />
                          </div>
                        ))}
                        {phaseRows.length === 0 && (
                          <p className="text-[11px] text-fg-faint">No applicable metrics for this position group.</p>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div className="md:col-span-2">
                  <InfoNote variant="scope" title="Suitability interpretation">
                    Best-fit dimensions: {dimensionRows.slice(0, 2).map((d) => d.dim).join(' and ')}. This is a
                    model-generated interpretation of measured percentiles against same-position peers — not a
                    measured fact. Passing networks and between-the-lines receipts require data not present in
                    dataset v0.1.
                  </InfoNote>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------- Evidence ---------------- */}
        <TabsContent value="evidence">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Match-by-match record (demo)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-label border-b border-line">
                      <th className="px-4 py-2 text-left font-semibold">Match</th>
                      <th className="py-2 text-right font-semibold">Min</th>
                      <th className="py-2 text-right font-semibold">G</th>
                      <th className="py-2 text-right font-semibold">A</th>
                      <th className="px-4 py-2 text-right font-semibold">Rating (demo)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerMatches.map(({ row, match }) => {
                      const home = teamById(match.homeTeamId)
                      const away = teamById(match.awayTeamId)
                      const g = playerGoals.filter((e) => e.matchId === match.id).length
                      const a = playerAssists.filter((e) => e.matchId === match.id).length
                      return (
                        <tr key={match.id} className="border-b border-line/40">
                          <td className="px-4 py-2">
                            <Link to={`/matches/${match.id}`} className="text-fg hover:text-accent-300">
                              {home?.shortName} {match.homeGoals}–{match.awayGoals} {away?.shortName}
                            </Link>
                            <span className="ml-2 text-[10px] text-fg-faint">
                              {match.competitionId === DEMO_CUP_ID
                                ? match.round === 1 ? 'Cup QF' : match.round === 2 ? 'Cup SF' : 'Cup final'
                                : `MD${match.round}`}
                            </span>
                          </td>
                          <td className="text-metric py-2 text-right text-fg-muted">{row.minutes}</td>
                          <td className="text-metric py-2 text-right text-fg">{g}</td>
                          <td className="text-metric py-2 text-right text-fg">{a}</td>
                          <td className="text-metric px-4 py-2 text-right text-fg-muted">{fmt(row.rating, 1)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldQuestion className="h-4 w-4 text-fg-faint" aria-hidden />
                  Evidence &amp; limitations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs leading-relaxed text-fg-muted">
                <div>
                  <p className="mb-1 font-semibold text-fg">Sample</p>
                  <p>
                    {player.stats.appearances} appearances · {player.stats.minutes} minutes ·
                    {smallSample ? ' below the 270-minute stability threshold — percentiles carry a small-sample warning.' : ' above the 270-minute stability threshold.'}
                  </p>
                </div>
                <div>
                  <p className="mb-1 font-semibold text-fg">Event evidence</p>
                  <p>
                    {playerGoals.length} goal events and {playerAssists.length} assist events in the demo
                    event store support the goal/assist aggregates. Other aggregates (passing, carrying,
                    defending) are season totals without per-event breakdowns in dataset v0.1.
                  </p>
                </div>
                <div>
                  <p className="mb-1 font-semibold text-fg">Not available</p>
                  <p>
                    No video footage or authorised clips are linked, so no video-based observations are
                    claimed. Opponent-pressure metrics, between-the-lines receipts and passing networks are
                    gated until the data exists.
                  </p>
                </div>
                <div className="rounded-md panel-border bg-ink-900/60 p-2.5">
                  <p className="text-[11px]">
                    <span className="font-semibold text-fg">Measured:</span> counts &amp; rates from stored demo records.
                    <br />
                    <span className="font-semibold text-fg">Interpreted:</span> percentile bands, role fit,
                    strengths/weaknesses wording.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------- Related intelligence ---------------- */}
        <TabsContent value="related">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Similar players</CardTitle>
                <Button asChild variant="ghost" size="xs">
                  <Link to={`/similarity?player=${player.id}`}>Open in Similarity Search</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {similar.map((s) => (
                  <div key={s.player.id} className="flex items-center gap-3 rounded-md panel-border bg-ink-900/50 p-2.5">
                    <PlayerAvatar name={s.player.name} position={s.player.position} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link to={`/players/${s.player.id}`} className="text-[13px] font-medium text-fg hover:text-accent-300">
                        {s.player.name}
                      </Link>
                      <p className="text-[10px] text-fg-faint">
                        {teamById(s.player.teamId)?.shortName} · biggest gap: {METRICS[s.contributions[0]?.metricId ?? 'pass_completion']?.label}
                      </p>
                    </div>
                    <Badge variant="accent" className="text-metric">{s.score}/100</Badge>
                  </div>
                ))}
                <p className="text-[10px] text-fg-faint">
                  Deterministic engine — z-score distance across role-weighted dimensions vs same-position peers (≥270 min).
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Discussion room</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {roomPosts.length === 0 ? (
                  <p className="text-xs text-fg-faint">No discussions yet for this player.</p>
                ) : (
                  roomPosts.slice(0, 2).map((post) => (
                    <div key={post.id} className="rounded-md panel-border bg-ink-900/50 p-2.5">
                      <p className="line-clamp-2 text-xs leading-relaxed text-fg-muted">{post.body}</p>
                      <p className="mt-1 text-[10px] text-fg-faint">{post.author} · {fmtDate(post.publishedAt)}</p>
                    </div>
                  ))
                )}
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to={`/discussions/${player.id}`}>Open room</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Related news</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {relatedNews.length === 0 ? (
                  <p className="text-xs text-fg-faint">No related demo articles.</p>
                ) : (
                  relatedNews.slice(0, 4).map((n) => (
                    <Link key={n.id} to="/news" className="block rounded-md panel-border bg-ink-900/50 p-2.5 hover:border-line-strong">
                      <p className="text-xs font-medium leading-snug text-fg">{n.title}</p>
                      <p className="mt-1 text-[10px] text-fg-faint">{n.source} · {fmtDate(n.publishedAt)}</p>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tactical Lab scenarios involving this player</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {relatedScenarios.length === 0 ? (
                  <p className="text-xs text-fg-faint">
                    No scenarios link this player. Link players to scenarios from the Tactical Lab.
                  </p>
                ) : (
                  relatedScenarios.map((sc) => (
                    <Link key={sc.id} to={`/tactical-lab?scenario=${sc.id}`} className="block rounded-md panel-border bg-ink-900/50 p-2.5 hover:border-line-strong">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-fg">{sc.name}</span>
                        <ProvenanceBadge provenance={sc.provenance} compact />
                      </div>
                      <p className="mt-1 text-[10px] text-fg-faint">
                        {sc.attack.formation} vs {sc.defence.formation} · {sc.actions.length} actions
                      </p>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ScoutLab-inspired visuals: percentile bars, shot map, xG profile    */
/* ------------------------------------------------------------------ */

function percentileBandColor(pct: number): string {
  if (pct >= 75) return '#2ee06f'
  if (pct >= 50) return '#d4f93a'
  if (pct >= 25) return '#ffb020'
  return '#f97316'
}

function PercentileBarsCard({
  dimensionRows,
  group,
}: {
  dimensionRows: {
    dim: keyof typeof DIMENSION_LABELS
    rows: { metricId: string; label: string; percentile: number | null; value: number | null; unit: string }[]
  }[]
  group: string
}) {
  const total = dimensionRows.reduce((n, d) => n + d.rows.filter((r) => r.percentile !== null).length, 0)
  if (total === 0) return null
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Percentile profile vs {group} peers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-10 gap-y-5 lg:grid-cols-2">
          {dimensionRows.map((d) => (
            <div key={d.dim}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
                {DIMENSION_LABELS[d.dim]}
              </p>
              <ul className="space-y-1.5">
                {d.rows
                  .filter((r) => r.percentile !== null && r.value !== null)
                  .map((r) => {
                    const pct = Math.round(r.percentile!)
                    const def = METRICS[r.metricId]
                    return (
                      <li key={r.metricId} className="grid grid-cols-[150px_1fr_84px] items-center gap-3 text-xs">
                        <span className="truncate text-fg-muted">{r.label}</span>
                        <span className="relative h-4 overflow-hidden rounded bg-ink-700">
                          <span
                            className="flex h-full items-center justify-end rounded pr-1.5 text-[10px] font-bold text-black/80"
                            style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: percentileBandColor(pct) }}
                          >
                            {pct}
                          </span>
                        </span>
                        <span className="text-metric text-right text-fg-faint">
                          {fmt(r.value!, def?.decimals ?? 2)} {r.unit === 'per 90' ? 'p90' : r.unit}
                        </span>
                      </li>
                    )
                  })}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 flex flex-wrap gap-x-4 text-[10px] text-fg-faint">
          <span><span className="mr-1 inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: '#2ee06f' }} />75+</span>
          <span><span className="mr-1 inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: '#d4f93a' }} />50–74</span>
          <span><span className="mr-1 inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: '#ffb020' }} />25–49</span>
          <span><span className="mr-1 inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: '#f97316' }} />under 25</span>
          <span>Percentile within the player's position group (270+ min); values per 90 unless a rate.</span>
        </p>
      </CardContent>
    </Card>
  )
}

/** Final-third shot map: xG-coloured dots, goals ringed white. */
function ShotMapSvg({ points, playerName }: { points: ShotPoint[]; playerName: string }) {
  const X = (x: number) => ((Math.min(100, Math.max(52, x)) - 52) / 48) * 100
  const Y = (y: number) => (y / 100) * 68
  return (
    <svg viewBox="0 0 100 68" className="block w-full rounded-lg" role="img" aria-label={`Season shot map for ${playerName}`}>
      <rect x="0" y="0" width="100" height="68" fill="#0b2e22" />
      <g stroke="rgba(250,250,250,0.45)" strokeWidth="0.45" fill="none">
        <rect x="0" y="0" width="100" height="68" />
        {/* penalty box (x>=83.5), six-yard (x>=94.5), spot x=89 in data coords */}
        <rect x={X(83.5)} y={Y(20.4)} width={X(100) - X(83.5)} height={Y(79.6) - Y(20.4)} />
        <rect x={X(94.5)} y={Y(36.8)} width={X(100) - X(94.5)} height={Y(63.2) - Y(36.8)} />
        <circle cx={X(89)} cy={Y(50)} r="0.5" fill="rgba(250,250,250,0.45)" />
        <line x1={X(66.7)} y1="0" x2={X(66.7)} y2="68" strokeDasharray="2 2" opacity="0.6" />
      </g>
      {points.map((p, i) => (
        <circle
          key={i}
          cx={X(p.x)}
          cy={Y(p.y)}
          r={p.goal ? 1.7 : 1.15 + p.xg * 1.6}
          fill={xgColor(p.xg)}
          opacity={p.goal ? 1 : 0.85}
          stroke={p.goal ? '#ffffff' : 'none'}
          strokeWidth={p.goal ? 0.45 : 0}
        />
      ))}
    </svg>
  )
}

/** xG-per-shot profile: peer share beeswarm per xG band + the player's dot. */
function ShotBandsChart({
  shares,
  ownShares,
  peerCount,
}: {
  shares: number[][]
  ownShares: number[]
  peerCount: number
}) {
  const W = 340
  const H = 200
  const top = 18
  const bottom = 34
  const plotH = H - top - bottom
  const maxShare = Math.max(30, ...shares.flat(), ...ownShares)
  const yMax = Math.ceil(maxShare / 10) * 10
  const colW = W / XG_BANDS.length
  const yOf = (v: number) => top + plotH - (v / yMax) * plotH
  const median = (vals: number[]) => {
    if (!vals.length) return null
    const sorted = [...vals].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]!
  }
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
        xG per shot profile · {peerCount} peers
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Shot quality distribution versus positional peers">
        {[0, 0.5, 1].map((f) => {
          const v = Math.round(yMax * f)
          const y = yOf(v)
          return (
            <g key={f}>
              <line x1="26" y1={y} x2={W} y2={y} stroke="#232329" strokeWidth="0.7" />
              <text x="22" y={y + 3} textAnchor="end" fontSize="8" fill="#71717a">{v}%</text>
            </g>
          )
        })}
        {XG_BANDS.map((band, bi) => {
          const cx = 26 + colW * bi + colW / 2 - 4
          const vals = shares[bi] ?? []
          const med = median(vals)
          const own = ownShares[bi] ?? 0
          return (
            <g key={band.label}>
              {vals.map((v, i) => (
                <circle
                  key={i}
                  cx={cx + (((i * 37) % 21) - 10) * 0.9}
                  cy={yOf(v)}
                  r="1.5"
                  fill="#8b98ad"
                  opacity="0.55"
                />
              ))}
              {med !== null && (
                <line x1={cx - colW / 2 + 6} y1={yOf(med)} x2={cx + colW / 2 - 6} y2={yOf(med)} stroke="#f4902a" strokeWidth="1.2" strokeDasharray="3 2" />
              )}
              <circle cx={cx} cy={yOf(own)} r="3.6" fill="#d4f93a" stroke="#0a0a0b" strokeWidth="1" />
              <text x={cx} y={yOf(own) - 6} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fafafa">
                {fmt(own, 0)}%
              </text>
              <text x={cx} y={H - 20} textAnchor="middle" fontSize="8" fill="#71717a">{band.label}</text>
              <text x={cx} y={H - 9} textAnchor="middle" fontSize="7" fill="#52525b">xG</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
