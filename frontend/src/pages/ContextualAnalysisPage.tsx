import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crosshair } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input, Label } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { InfoNote } from '@/components/shared/info-note'
import { PlayerSelect } from '@/components/shared/player-select'
import { ProvenanceBadge } from '@/components/shared/provenance'
import { PlayerAvatar, PositionBadge } from '@/components/shared/player-bits'
import {
  MetricInfoTrigger,
  PercentileBar,
  SmallSampleWarning,
} from '@/components/shared/metric-widgets'
import { PercentileRadar } from '@/components/charts/percentile-radar'
import { useData } from '@/state/data'
import { useSettings } from '@/state/settings'
import type { Phase, PositionGroup, TeamStyle } from '@/types'
import {
  BUILD_UP_POSSESSION_DEFINITION,
  METRICS,
  PHASES,
  PHASE_ORDER,
} from '@/lib/metrics'
import {
  buildPeerGroupWithContext,
  playerAge,
} from '@/lib/analysis'
import {
  buildEventMetrics,
  computePhaseAnalysisWithEvents,
} from '@/lib/eventMetrics'
import { POSITION_GROUP_LABELS, POSITION_GROUP_ORDER, groupOf } from '@/lib/positions'
import { fmt } from '@/lib/utils'

const TEAM_STYLES: TeamStyle[] = [
  'Possession-oriented', 'Direct', 'Counterattacking', 'High-pressing',
]

export function ContextualAnalysisPage() {
  const { data, players, teams, playerById } = useData()
  const { settings } = useSettings()

  const [playerId, setPlayerId] = useState<string | undefined>(undefined)
  const [phase, setPhase] = useState<Phase>('build-up')
  const [positionGroup, setPositionGroup] = useState<PositionGroup | 'all'>('all')
  const [teamStyle, setTeamStyle] = useState<TeamStyle | 'all'>('all')
  const [minMinutes, setMinMinutes] = useState(270)
  const [ageMin, setAgeMin] = useState(16)
  const [ageMax, setAgeMax] = useState(40)
  const [competitionId, setCompetitionId] = useState<string>('all')
  const [seasonId, setSeasonId] = useState<string>('all')

  const player = playerId ? playerById(playerId) : undefined

  const peers = useMemo(() => {
    if (!player) return []
    return buildPeerGroupWithContext(
      players,
      new Map(teams.map((t) => [t.id, t])),
      {
        positionGroup: positionGroup === 'all' ? groupOf(player.position) : positionGroup,
        teamStyle,
        minMinutes,
        ageMin,
        ageMax,
      },
    )
  }, [player, players, teams, positionGroup, teamStyle, minMinutes, ageMin, ageMax])

  // Event-derived metrics from the stored, source-attributed event records,
  // scoped to the selected competition / season filters.
  const eventSource = useMemo(
    () => (data
      ? buildEventMetrics(
          data.dataset.events,
          data.dataset.matches,
          data.dataset.playerMatchMinutes,
          { competitionId, seasonId },
        )
      : new Map<string, never>()),
    [data, competitionId, seasonId],
  )

  const analysis = useMemo(
    () => (player ? computePhaseAnalysisWithEvents(player, peers, phase, eventSource) : null),
    [player, peers, phase, eventSource],
  )

  const radarAxes = analysis
    ? analysis.rows.filter((r) => r.percentile !== null).slice(0, 7).map((r) => r.label)
    : []
  const radarSeries = player && analysis
    ? [
        {
          name: player.name,
          color: teams.find((t) => t.id === player.teamId)?.color ?? '#d4f93a',
          data: Object.fromEntries(
            analysis.rows
              .filter((r) => r.percentile !== null && radarAxes.includes(r.label))
              .map((r) => [r.label, r.percentile ?? 0]),
          ),
        },
      ]
    : []

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contextual analysis"
        description="Evaluate a player for a specific role, match phase, peer group and team style. Every metric shows its definition, raw value, sample size and percentile against the selected peers — nothing is fabricated or zero-filled."
      />

      {!data ? (
        <EmptyState
          icon={Crosshair}
          title="No data available for analysis"
          description={
            settings.demoMode
              ? 'Data is loading or unavailable.'
              : 'Demo data is disabled and no real data source is connected. Enable demo data in Settings to explore the analysis engine on fictional records.'
          }
          showSettingsAction={!settings.demoMode}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
          {/* ---------------- Configuration ---------------- */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Analysis context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ca-player">Player</Label>
                <PlayerSelect id="ca-player" value={playerId} onChange={setPlayerId} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ca-phase">Match phase</Label>
                <Select value={phase} onValueChange={(v) => setPhase(v as Phase)}>
                  <SelectTrigger id="ca-phase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHASE_ORDER.map((p) => (
                      <SelectItem key={p} value={p}>{PHASES[p].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] leading-relaxed text-fg-faint">{PHASES[phase].description}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ca-competition">Competition</Label>
                <Select value={competitionId} onValueChange={setCompetitionId}>
                  <SelectTrigger id="ca-competition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All competitions</SelectItem>
                    {data.dataset.competitions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ca-season">Season</Label>
                <Select value={seasonId} onValueChange={setSeasonId}>
                  <SelectTrigger id="ca-season">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All seasons</SelectItem>
                    {data.dataset.seasons.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] leading-relaxed text-fg-faint">
                  Filters scope the stored event sample and the minutes denominators used for
                  event-derived metrics.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ca-position">Position / role group</Label>
                <Select value={positionGroup} onValueChange={(v) => setPositionGroup(v as PositionGroup | 'all')}>
                  <SelectTrigger id="ca-position">
                    <SelectValue placeholder="Player's own position group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Player's own position group</SelectItem>
                    {POSITION_GROUP_ORDER.map((g) => (
                      <SelectItem key={g} value={g}>{POSITION_GROUP_LABELS[g]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ca-style">Team style</Label>
                <Select value={teamStyle} onValueChange={(v) => setTeamStyle(v as TeamStyle | 'all')}>
                  <SelectTrigger id="ca-style">
                    <SelectValue placeholder="All styles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All styles</SelectItem>
                    {TEAM_STYLES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Comparison group: same league, minimum minutes</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[minMinutes]}
                    min={0}
                    max={700}
                    step={10}
                    onValueChange={([v]) => setMinMinutes(v ?? 0)}
                    className="flex-1"
                    aria-label="Minimum minutes for peer group"
                  />
                  <span className="text-metric w-10 text-right text-xs text-fg">{minMinutes}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="ca-age-min">Age min</Label>
                  <Input
                    id="ca-age-min"
                    type="number"
                    min={16}
                    max={40}
                    value={ageMin}
                    onChange={(e) => setAgeMin(Number(e.target.value) || 16)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="ca-age-max">Age max</Label>
                  <Input
                    id="ca-age-max"
                    type="number"
                    min={16}
                    max={40}
                    value={ageMax}
                    onChange={(e) => setAgeMax(Number(e.target.value) || 40)}
                  />
                </div>
              </div>

              <div className="rounded-md panel-border bg-ink-900/60 p-3 text-[11px] leading-relaxed text-fg-muted">
                <p className="mb-1 font-semibold text-fg">Peer group</p>
                <p>
                  {peers.length} players ·{' '}
                  {positionGroup === 'all'
                    ? player
                      ? `${POSITION_GROUP_LABELS[groupOf(player.position)]} (player's group)`
                      : 'select a player'
                    : POSITION_GROUP_LABELS[positionGroup]}
                  {teamStyle !== 'all' && ` · ${teamStyle} teams`}
                  {` · ≥${minMinutes} min · ages ${ageMin}–${ageMax}`}
                </p>
                <p className="mt-1 text-fg-faint">
                  Competition:{' '}
                  {competitionId === 'all'
                    ? 'all (league + cup demo competitions)'
                    : data.dataset.competitions.find((c) => c.id === competitionId)?.name}
                  {seasonId === 'all'
                    ? ' · all seasons'
                    : ` · ${data.dataset.seasons.find((s) => s.id === seasonId)?.label ?? ''}`}
                  .
                </p>
              </div>

              {player && (
                <div className="flex items-center gap-2.5 rounded-md panel-border bg-ink-900/60 p-2.5">
                  <PlayerAvatar name={player.name} position={player.position} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-fg">{player.name}</p>
                    <p className="text-[10px] text-fg-faint">
                      {player.stats.appearances} apps · {player.stats.minutes} min · {playerAge(player)} yrs
                    </p>
                  </div>
                  <PositionBadge position={player.position} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ---------------- Results ---------------- */}
          <div className="space-y-4">
            {!player ? (
              <EmptyState
                icon={Crosshair}
                title="Select a player to analyse"
                description="Configure the analysis context on the left. The example configuration from the specification: Attacking midfielder → Build-up → Same league → Possession-oriented."
              />
            ) : !analysis ? (
              <EmptyState title="Analysis unavailable" description="The analysis could not be computed for this configuration." />
            ) : (
              <>
                {phase === 'build-up' && (
                  <InfoNote title="Build-up possession definition (configurable)">
                    {BUILD_UP_POSSESSION_DEFINITION}
                  </InfoNote>
                )}

                {radarAxes.length >= 3 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Phase percentile profile</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PercentileRadar axes={radarAxes} series={radarSeries} height={300} showLegend={false} />
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle>
                      {PHASES[phase].label} metrics — {player.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {player.stats.minutes < 270 && <SmallSampleWarning minutes={player.stats.minutes} />}
                      <ProvenanceBadge provenance="DEMO" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-label border-b border-line">
                          <th className="px-4 py-2 text-left font-semibold">Metric</th>
                          <th className="py-2 text-right font-semibold">Value</th>
                          <th className="py-2 text-right font-semibold">Unit</th>
                          <th className="py-2 text-right font-semibold">Sample</th>
                          <th className="py-2 text-left font-semibold">Percentile vs peers</th>
                          <th className="px-4 py-2 text-left font-semibold">Interpretation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.rows.map((row) => {
                          const def = METRICS[row.metricId]!
                          return (
                            <tr key={row.metricId} className="border-b border-line/40 align-top">
                              <td className="px-4 py-2.5">
                                <span className="flex items-center gap-1.5">
                                  <span className="font-medium text-fg">{def.label}</span>
                                  <MetricInfoTrigger metricId={row.metricId} />
                                  {def.direction === 'lower' && (
                                    <Badge variant="muted" className="normal-case">lower is better</Badge>
                                  )}
                                  {row.source === 'EVENTS' && (
                                    <Badge variant="outline" className="normal-case text-[9px]">
                                      CALCULATED
                                    </Badge>
                                  )}
                                </span>
                              </td>
                              <td className="text-metric py-2.5 text-right font-semibold text-fg">
                                {fmt(row.value, def.decimals)}
                              </td>
                              <td className="py-2.5 text-right text-[11px] text-fg-faint">
                                {def.unit === 'per 90' ? '/ 90' : def.unit}
                              </td>
                              <td className="text-metric py-2.5 text-right text-[11px] text-fg-muted">
                                {row.minutes} min
                                {row.source === 'EVENTS' && (
                                  <span className="block text-fg-faint">from {row.sampleEvents} events</span>
                                )}
                                {row.peerCount < 5 && (
                                  <span className="block text-warning">n={row.peerCount} peers</span>
                                )}
                              </td>
                              <td className="py-2.5">
                                <PercentileBar value={row.percentile} className="w-40" label={`${def.label} percentile`} />
                              </td>
                              <td className="px-4 py-2.5 text-[11px] leading-snug text-fg-muted">
                                {row.interpretation}
                                {row.peerMedian !== null && row.value !== null && (
                                  <span className="block text-fg-faint">
                                    Peer median {fmt(row.peerMedian, def.decimals)} · best {fmt(row.peerBest, def.decimals)} (n={row.peerCount})
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                {analysis.unavailableRows.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Not available for this phase in the current dataset</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {analysis.unavailableRows.map((row) => {
                        const def = METRICS[row.metricId]!
                        return (
                          <div key={row.metricId} className="flex items-start gap-2 rounded-md panel-border bg-ink-900/50 p-2.5">
                            <span className="flex items-center gap-1.5 text-[13px] font-medium text-fg-faint">
                              {def.label}
                              <MetricInfoTrigger metricId={row.metricId} />
                            </span>
                            <p className="text-[11px] leading-relaxed text-fg-faint">{def.unavailableReason}</p>
                          </div>
                        )
                      })}
                      <InfoNote variant="scope">
                        Unavailable metrics are gated rather than approximated. They will unlock when the
                        required data (pressure events, spatial opponent-block frames, xT model) is imported.
                      </InfoNote>
                    </CardContent>
                  </Card>
                )}

                <InfoNote variant="scope" title="Facts vs interpretation">
                  Values, samples and percentiles are computed from stored records (demo dataset v0.1.0,
                  fictional). Rows marked <strong>CALCULATED</strong> are derived from the stored event
                  sample for the selected competition/season — a stratified demo sample, not a full
                  match feed, so counts are indicative rather than exhaustive; the event count behind
                  each value is shown next to the minutes. Unmarked rows use provider-style season
                  aggregates. Line-breaking passes stay provider-based because they need tracking
                  data. The percentile bands and wording ("strong", "elite") are rule-based
                  interpretations of those numbers.{' '}
                  <Link to={`/players/${player.id}`} className="underline underline-offset-2 hover:text-fg">
                    Open {player.name}'s full profile
                  </Link>
                </InfoNote>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
