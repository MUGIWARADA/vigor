import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, GitCompareArrows, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { InfoNote } from '@/components/shared/info-note'
import { PlayerAvatar, PositionBadge } from '@/components/shared/player-bits'
import { ProvenanceBadge } from '@/components/shared/provenance'
import { MetricInfoTrigger, PercentileBar, SmallSampleWarning } from '@/components/shared/metric-widgets'
import { useData } from '@/state/data'
import { useSettings } from '@/state/settings'
import type { Dimension, Phase, Player, PlayerSeasonStats, TeamStyle } from '@/types'
import {
  DIMENSION_LABELS,
  METRICS,
  METRIC_CATEGORY_LABELS,
  PHASES,
  PHASE_ORDER,
  metricPer90Value,
  metricRawValue,
  type MetricCategory,
} from '@/lib/metrics'
import {
  buildPeerGroupWithContext,
  compositeScore,
  defaultWeightsForRole,
  percentile,
  playerAge,
} from '@/lib/analysis'
import { POSITION_GROUP_LABELS, POSITION_GROUP_ORDER, groupOf } from '@/lib/positions'
import { fmt } from '@/lib/utils'

const TEAM_STYLES: TeamStyle[] = ['Possession-oriented', 'Direct', 'Counterattacking', 'High-pressing']
const DIMENSIONS: Dimension[] = ['progression', 'retention', 'creation', 'defending', 'finishing', 'carrying']

interface RankingRow {
  player: Player
  value: number | null
  percentile: number | null
  composite: number | null
}

export function TopPerformersPage() {
  const { data, players, teams, teamById } = useData()
  const { settings } = useSettings()
  const navigate = useNavigate()

  const [metricId, setMetricId] = useState('xg')
  const [phaseFilter, setPhaseFilter] = useState<Phase | 'all'>('all')
  const [per90, setPer90] = useState(true)
  const [showPercentile, setShowPercentile] = useState(true)
  const [compositeMode, setCompositeMode] = useState(false)
  const [weights, setWeights] = useState<Record<Dimension, number>>(defaultWeightsForRole('advanced-playmaker'))
  const [positionGroup, setPositionGroup] = useState<string>('all')
  const [teamStyle, setTeamStyle] = useState<TeamStyle | 'all'>('all')
  const [ageMin, setAgeMin] = useState(16)
  const [ageMax, setAgeMax] = useState(40)
  const [minMinutes, setMinMinutes] = useState(270)
  const [compare, setCompare] = useState<string[]>([])
  const [sort, setSort] = useState<'value' | 'percentile' | 'composite'>('value')

  const def = METRICS[metricId]!

  const availableMetricIds = useMemo(
    () =>
      phaseFilter === 'all'
        ? Object.keys(METRICS).filter((id) => METRICS[id]!.available)
        : PHASES[phaseFilter].metricIds.filter((id) => METRICS[id]!.available),
    [phaseFilter],
  )

  const pool = useMemo(
    () =>
      buildPeerGroupWithContext(
        players,
        new Map(teams.map((t) => [t.id, t])),
        {
          positionGroup: positionGroup === 'all' ? 'all' : (positionGroup as never),
          teamStyle,
          minMinutes,
          ageMin,
          ageMax,
        },
      ),
    [players, teams, positionGroup, teamStyle, minMinutes, ageMin, ageMax],
  )

  /** Value on the display basis chosen by the per-90 toggle (totals or per 90; never zero-filled). */
  const valueFor = (stats: PlayerSeasonStats): number | null =>
    per90 ? metricPer90Value(stats, metricId) : metricRawValue(stats, metricId)

  const rows: RankingRow[] = useMemo(() => {
    const out = pool
      .filter((p) => {
        if (compositeMode) return true
        const g = groupOf(p.position)
        const applies =
          def.appliesTo === 'all' ||
          (def.appliesTo === 'outfield' ? g !== 'GK' : def.appliesTo.includes(g))
        return applies && valueFor(p.stats) !== null
      })
      .map((player) => {
        const value = valueFor(player.stats)
        const peerValues = pool
          .filter((peer) => {
            const g = groupOf(peer.position)
            const applies =
              def.appliesTo === 'all' ||
              (def.appliesTo === 'outfield' ? g !== 'GK' : def.appliesTo.includes(g))
            return applies && valueFor(peer.stats) !== null
          })
          .map((peer) => valueFor(peer.stats)!)
        return {
          player,
          value,
          percentile: value !== null ? percentile(value, peerValues, def.direction) : null,
          composite: compositeMode ? compositeScore(player, pool, weights) : null,
        }
      })
      .filter((r) => (compositeMode ? r.composite !== null : r.value !== null))

    out.sort((a, b) => {
      if (sort === 'percentile') return (b.percentile ?? 0) - (a.percentile ?? 0) || a.player.id.localeCompare(b.player.id)
      if (sort === 'composite') return (b.composite ?? 0) - (a.composite ?? 0) || a.player.id.localeCompare(b.player.id)
      return (b.value ?? 0) - (a.value ?? 0) || a.player.id.localeCompare(b.player.id)
    })
    return out
  }, [pool, metricId, def, compositeMode, weights, sort, per90])

  const exportCsv = () => {
    const header = compositeMode
      ? ['rank', 'player', 'team', 'position', 'age', 'minutes', 'composite_score', 'provenance']
      : ['rank', 'player', 'team', 'position', 'age', 'minutes', def.label, 'unit', 'percentile', 'provenance']
    const lines = [header.join(',')]
    rows.forEach((r, i) => {
      const team = teamById(r.player.teamId)?.name ?? ''
      const base = [
        i + 1, `"${r.player.name}"`, `"${team}"`, r.player.position, playerAge(r.player), r.player.stats.minutes,
      ]
      if (compositeMode) {
        lines.push([...base, r.composite, 'DEMO'].join(','))
      } else {
        const unit = def.unit === 'per 90' ? (per90 ? 'per 90' : 'total') : def.unit
        lines.push([...base, r.value ?? '', unit, r.percentile !== null ? Math.round(r.percentile) : '', 'DEMO'].join(','))
      }
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vigor-rankings-${compositeMode ? 'composite' : metricId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const weightSum = DIMENSIONS.reduce((s, d) => s + (weights[d] ?? 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Top performers"
        description="Sortable, filterable rankings. Composite scores are opt-in and always display their component dimensions and weighting — no hidden formula rankings."
        actions={
          <div className="flex items-center gap-2">
            {compare.length >= 2 && (
              <Button size="sm" onClick={() => navigate(`/compare?ids=${compare.join(',')}`)}>
                <GitCompareArrows aria-hidden />
                Compare {compare.length}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download aria-hidden />
              Export CSV
            </Button>
          </div>
        }
      />

      {!data ? (
        <EmptyState
          icon={Trophy}
          title="No data available"
          description={
            settings.demoMode
              ? 'Data is loading or unavailable.'
              : 'Demo data is disabled and no real data source is connected. Enable demo data in Settings.'
          }
          showSettingsAction={!settings.demoMode}
        />
      ) : (
        <>
          {/* Configuration */}
          <Card>
            <CardContent className="flex flex-wrap items-end gap-x-4 gap-y-3">
              <div className="flex w-64 flex-col gap-1">
                <Label htmlFor="tp-metric">Metric</Label>
                <Select value={metricId} onValueChange={setMetricId} disabled={compositeMode}>
                  <SelectTrigger id="tp-metric">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['output', 'passing', 'carrying', 'possession', 'defending', 'duels'] as MetricCategory[]).map(
                      (cat) => {
                        const ids = availableMetricIds.filter((id) => METRICS[id]!.category === cat)
                        if (ids.length === 0) return null
                        return (
                          <SelectGroup key={cat}>
                            <SelectLabel>{METRIC_CATEGORY_LABELS[cat]}</SelectLabel>
                            {ids.map((id) => (
                              <SelectItem key={id} value={id}>{METRICS[id]!.label}</SelectItem>
                            ))}
                          </SelectGroup>
                        )
                      },
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex w-44 flex-col gap-1">
                <Label htmlFor="tp-phase">Match phase filter</Label>
                <Select value={phaseFilter} onValueChange={(v) => setPhaseFilter(v as Phase | 'all')}>
                  <SelectTrigger id="tp-phase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All phases</SelectItem>
                    {PHASE_ORDER.map((p) => (
                      <SelectItem key={p} value={p}>{PHASES[p].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex w-44 flex-col gap-1">
                <Label htmlFor="tp-position">Position</Label>
                <Select value={positionGroup} onValueChange={setPositionGroup}>
                  <SelectTrigger id="tp-position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All positions</SelectItem>
                    {POSITION_GROUP_ORDER.map((g) => (
                      <SelectItem key={g} value={g}>{POSITION_GROUP_LABELS[g]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex w-44 flex-col gap-1">
                <Label htmlFor="tp-style">Team style</Label>
                <Select value={teamStyle} onValueChange={(v) => setTeamStyle(v as TeamStyle | 'all')}>
                  <SelectTrigger id="tp-style">
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

              <div className="flex w-24 flex-col gap-1">
                <Label htmlFor="tp-age-min">Age min</Label>
                <Input id="tp-age-min" type="number" min={16} max={40} value={ageMin}
                  onChange={(e) => setAgeMin(Number(e.target.value) || 16)} />
              </div>
              <div className="flex w-24 flex-col gap-1">
                <Label htmlFor="tp-age-max">Age max</Label>
                <Input id="tp-age-max" type="number" min={16} max={40} value={ageMax}
                  onChange={(e) => setAgeMax(Number(e.target.value) || 40)} />
              </div>

              <div className="flex w-48 flex-col gap-1">
                <Label>Min minutes</Label>
                <div className="flex items-center gap-2">
                  <Slider value={[minMinutes]} min={0} max={700} step={10}
                    onValueChange={([v]) => setMinMinutes(v ?? 0)} className="flex-1" aria-label="Minimum minutes" />
                  <span className="text-metric w-10 text-right text-xs text-fg">{minMinutes}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 pb-1">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-muted">
                  <Checkbox checked={per90} onCheckedChange={(v) => setPer90(v === true)} />
                  Per-90 values
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-muted">
                  <Checkbox checked={showPercentile} onCheckedChange={(v) => setShowPercentile(v === true)} />
                  Percentile column
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-muted">
                  <Checkbox checked={compositeMode} onCheckedChange={(v) => setCompositeMode(v === true)} />
                  Composite score mode
                </label>
              </div>

              <Badge variant="muted" className="mb-2 normal-case tracking-normal">
                {rows.length} players · pool {pool.length}
              </Badge>
            </CardContent>

            {compositeMode && (
              <CardContent className="border-t border-line pt-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-label">Composite weighting (visible by design)</span>
                  <span className="text-[11px] text-fg-faint">
                    Composite = weighted mean of peer percentiles across dimensions:
                    {DIMENSIONS.filter((d) => weights[d] > 0)
                      .map((d) => ` ${DIMENSION_LABELS[d]} ${Math.round((weights[d] / Math.max(1, weightSum)) * 100)}%`)
                      .join(' ·')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {DIMENSIONS.map((dim) => (
                    <div key={dim} className="flex items-center gap-2">
                      <span className="w-20 text-xs capitalize text-fg-muted">{DIMENSION_LABELS[dim]}</span>
                      <Slider
                        value={[weights[dim] ?? 0]}
                        min={0}
                        max={5}
                        step={1}
                        onValueChange={([v]) => setWeights({ ...weights, [dim]: v ?? 0 })}
                        className="w-28"
                        aria-label={`${DIMENSION_LABELS[dim]} composite weight`}
                      />
                      <span className="text-metric w-4 text-right text-xs text-fg">{weights[dim] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          {rows.length === 0 ? (
            <EmptyState icon={Trophy} title="No players match these filters" description="Adjust the position, minutes or phase filters." />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <span className="sr-only">Rank</span>
                      </TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="w-8">
                        <span className="sr-only">Compare</span>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-right"
                        onClick={() => setSort(compositeMode ? 'composite' : 'value')}
                      >
                        {compositeMode ? 'Composite score' : def.label}
                        {sort !== 'percentile' && ' ▾'}
                      </TableHead>
                      <TableHead>Unit</TableHead>
                      {showPercentile && (
                        <TableHead className="cursor-pointer" onClick={() => setSort('percentile')}>
                          Percentile in pool {sort === 'percentile' && ' ▾'}
                        </TableHead>
                      )}
                      <TableHead className="text-right">Minutes</TableHead>
                      <TableHead className="text-right">Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((r, i) => (
                      <TableRow key={r.player.id} className="cursor-pointer" onClick={() => navigate(`/players/${r.player.id}`)}>
                        <TableCell className="text-metric w-10 text-center text-xs font-bold text-fg-faint">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <PlayerAvatar name={r.player.name} position={r.player.position} size="sm" />
                            <div className="flex flex-col">
                              <span className="font-medium text-fg">{r.player.name}</span>
                              <span className="text-[10px] text-fg-faint">{playerAge(r.player)} yrs · {r.player.foot}</span>
                            </div>
                            <PositionBadge position={r.player.position} />
                            {r.player.stats.minutes < 270 && <SmallSampleWarning minutes={r.player.stats.minutes} />}
                          </div>
                        </TableCell>
                        <TableCell className="text-fg-muted">{teamById(r.player.teamId)?.shortName}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={compare.includes(r.player.id)}
                            onCheckedChange={() =>
                              setCompare((prev) =>
                                prev.includes(r.player.id)
                                  ? prev.filter((x) => x !== r.player.id)
                                  : prev.length < 3
                                    ? [...prev, r.player.id]
                                    : prev,
                              )
                            }
                            aria-label={`Select ${r.player.name} for comparison`}
                          />
                        </TableCell>
                        <TableCell className="text-metric text-right font-semibold text-fg">
                          {compositeMode ? fmt(r.composite, 0) : fmt(r.value, def.decimals)}
                        </TableCell>
                        <TableCell className="text-[11px] text-fg-faint">
                          {compositeMode ? (
                            '0–100'
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              {def.unit === 'per 90' ? (per90 ? '/90' : 'total') : def.unit}
                              <MetricInfoTrigger metricId={metricId} />
                            </span>
                          )}
                        </TableCell>
                        {showPercentile && (
                          <TableCell className="w-44">
                            {compositeMode ? (
                              <span className="text-[11px] text-fg-faint">— (components shown above)</span>
                            ) : (
                              <PercentileBar value={r.percentile} className="w-36" label={`${def.label} percentile in pool`} />
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-metric text-right text-fg-muted">{r.player.stats.minutes}</TableCell>
                        <TableCell className="text-right">
                          <ProvenanceBadge provenance="DEMO" compact />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              <div className="border-t border-line px-4 py-2 text-[11px] text-fg-faint">
                Showing top {Math.min(50, rows.length)} of {rows.length}.{' '}
                <Link to="/analysis" className="underline underline-offset-2 hover:text-fg-muted">
                  Analyse a specific phase in the contextual engine
                </Link>
                .
              </div>
            </Card>
          )}

          {!compositeMode && (
            <InfoNote variant="scope" title="Metric definition in use">
              {def.label}: numerator — {def.numerator} Denominator — {def.denominator}
              {def.direction === 'lower' ? ' Lower values are better.' : ''} Source: {def.sourceVersion}
              {def.provenance === 'MODEL_ESTIMATE' ? ' (model estimate).' : '.'}
            </InfoNote>
          )}
        </>
      )}
    </div>
  )
}
