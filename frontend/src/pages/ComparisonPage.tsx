import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GitCompareArrows, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { InfoNote } from '@/components/shared/info-note'
import { PlayerSelect } from '@/components/shared/player-select'
import { ProvenanceBadge } from '@/components/shared/provenance'
import { PlayerAvatar, PositionBadge } from '@/components/shared/player-bits'
import { MetricInfoTrigger, SmallSampleWarning } from '@/components/shared/metric-widgets'
import { PercentileRadar } from '@/components/charts/percentile-radar'
import { useData } from '@/state/data'
import { useSettings } from '@/state/settings'
import {
  METRICS,
  METRIC_CATEGORY_LABELS,
  metricValueForPlayer,
  type MetricCategory,
} from '@/lib/metrics'
import { buildPeerGroupWithContext, playerAge } from '@/lib/analysis'
import { groupOf } from '@/lib/positions'
import { fmt } from '@/lib/utils'
import type { Player } from '@/types'

const SLOTS = [0, 1, 2] as const

export function ComparisonPage() {
  const { data, players, teams, playerById } = useData()
  const { settings } = useSettings()
  const [searchParams, setSearchParams] = useSearchParams()

  const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? []
  const setIds = (next: (string | undefined)[]) => {
    const clean = next.filter((x): x is string => !!x)
    setSearchParams(clean.length > 0 ? { ids: clean.join(',') } : {})
  }

  const selected: Player[] = useMemo(
    () => ids.map((id) => playerById(id)).filter((p): p is Player => !!p),
    [ids, playerById],
  )

  const peersByPlayer = useMemo(() => {
    const map = new Map<string, Player[]>()
    for (const p of selected) {
      map.set(
        p.id,
        buildPeerGroupWithContext(
          players,
          new Map(teams.map((t) => [t.id, t])),
          { positionGroup: groupOf(p.position), minMinutes: 270 },
        ),
      )
    }
    return map
  }, [selected, players, teams])

  /** Metrics applicable to every selected player (intersection). */
  const sharedMetrics = useMemo(() => {
    if (selected.length === 0) return []
    return (Object.keys(METRICS) as string[]).filter((id) =>
      selected.every(
        (p) => metricValueForPlayer(p, id, groupOf(p.position)) !== null,
      ),
    )
  }, [selected])

  const radarAxes = sharedMetrics
    .filter((id) => ['progressive_passes', 'progressive_carries', 'passes_final_third', 'pass_completion', 'goals', 'assists', 'tackles', 'recoveries', 'aerial_duel_rate', 'dribble_success'].includes(id))
    .slice(0, 8)
    .map((id) => METRICS[id]!.label)

  const radarSeries = selected.map((p) => ({
    name: p.name.split(' ').slice(-1)[0] ?? p.name,
    color: teams.find((t) => t.id === p.teamId)?.color ?? '#d4f93a',
    data: Object.fromEntries(
      radarAxes
        .map((axis) => {
          const id = sharedMetrics.find((m) => METRICS[m]!.label === axis)!
          const value = metricValueForPlayer(p, id, groupOf(p.position))
          if (value === null) return null
          const peers = peersByPlayer.get(p.id) ?? []
          const peerValues = peers
            .map((peer) => metricValueForPlayer(peer, id, groupOf(peer.position)))
            .filter((v): v is number => v !== null)
          if (peerValues.length < 5) return null
          let beaten = 0
          for (const pv of peerValues) if (pv < value) beaten += 1
          return [axis, (100 * beaten) / peerValues.length]
        })
        .filter((x): x is [string, number] => x !== null),
    ),
  }))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Player comparison"
        description="Compare up to three players metric by metric. Values are per 90 (or rates) from the demo dataset; the best value in each row is highlighted, honouring each metric's ranking direction."
      />

      {!data ? (
        <EmptyState
          icon={Users}
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
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3">
              {SLOTS.map((slot, i) => (
                <div key={slot} className="flex w-64 flex-col gap-1">
                  <PlayerSelect
                    value={ids[i]}
                    onChange={(v) => {
                      const next = [...ids]
                      next[i] = v
                      setIds(next)
                    }}
                    placeholder={`Player ${i + 1}${i === 0 ? ' (required)' : ' (optional)'}`}
                  />
                </div>
              ))}
              {selected.length >= 2 && (
                <Button variant="outline" size="sm" onClick={() => setIds([])}>
                  Clear
                </Button>
              )}
            </CardContent>
          </Card>

          {selected.length < 2 ? (
            <EmptyState
              icon={GitCompareArrows}
              title="Select at least two players"
              description="Use the pickers above, or select players in the database and rankings tables. Tip: the URL carries your selection (?ids=…), so comparisons can be shared."
            />
          ) : (
            <>
              <Card>
                <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
                  {selected.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-md panel-border bg-ink-900/50 p-3">
                      <PlayerAvatar name={p.name} position={p.position} />
                      <div className="min-w-0 flex-1">
                        <Link to={`/players/${p.id}`} className="text-[13px] font-semibold text-fg hover:text-accent-300">
                          {p.name}
                        </Link>
                        <p className="text-[10px] text-fg-faint">
                          {teams.find((t) => t.id === p.teamId)?.shortName} · {playerAge(p)} yrs · {p.stats.minutes} min
                        </p>
                      </div>
                      <PositionBadge position={p.position} />
                      {p.stats.minutes < 270 && <SmallSampleWarning minutes={p.stats.minutes} />}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {radarAxes.length >= 3 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Percentile profile vs each player's position peers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PercentileRadar axes={radarAxes} series={radarSeries} height={320} />
                    <p className="mt-1 text-[11px] text-fg-faint">
                      Percentiles computed against same-position peers with ≥270 minutes in the demo dataset.
                    </p>
                  </CardContent>
                </Card>
              )}

              {(['output', 'passing', 'carrying', 'possession', 'defending', 'duels'] as MetricCategory[]).map(
                (cat) => {
                  const catMetrics = sharedMetrics.filter((id) => METRICS[id]!.category === cat)
                  if (catMetrics.length === 0) return null
                  return (
                    <Card key={cat}>
                      <CardHeader>
                        <CardTitle>{METRIC_CATEGORY_LABELS[cat]}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <table className="w-full text-[13px]">
                          <thead>
                            <tr className="text-label border-b border-line">
                              <th className="px-4 py-2 text-left font-semibold">Metric</th>
                              {selected.map((p) => (
                                <th key={p.id} className="py-2 pr-4 text-right font-semibold">
                                  {p.name.split(' ').slice(-1)}
                                </th>
                              ))}
                              <th className="px-4 py-2 text-left font-semibold">Best</th>
                            </tr>
                          </thead>
                          <tbody>
                            {catMetrics.map((id) => {
                              const def = METRICS[id]!
                              const values = selected.map((p) => metricValueForPlayer(p, id, groupOf(p.position)))
                              const valid = values.filter((v): v is number => v !== null)
                              const bestValue =
                                valid.length > 0
                                  ? def.direction === 'higher'
                                    ? Math.max(...valid)
                                    : Math.min(...valid)
                                  : null
                              const bestPlayer = values.findIndex((v) => v === bestValue)
                              return (
                                <tr key={id} className="border-b border-line/40">
                                  <td className="px-4 py-2">
                                    <span className="flex items-center gap-1.5">
                                      <span className="font-medium text-fg">{def.label}</span>
                                      <MetricInfoTrigger metricId={id} />
                                      <ProvenanceBadge provenance={def.provenance} compact />
                                    </span>
                                    <span className="text-[10px] text-fg-faint">
                                      {def.unit === 'per 90' ? 'per 90' : def.unit} · {def.direction === 'higher' ? 'higher better' : 'lower better'}
                                    </span>
                                  </td>
                                  {values.map((v, i) => (
                                    <td
                                      key={i}
                                      className={
                                        'text-metric py-2 pr-4 text-right ' +
                                        (i === bestPlayer && valid.length > 1
                                          ? 'font-bold text-accent-300'
                                          : 'text-fg-muted')
                                      }
                                    >
                                      {fmt(v, def.decimals)}
                                    </td>
                                  ))}
                                  <td className="px-4 py-2 text-[11px] text-fg-faint">
                                    {bestPlayer >= 0 ? selected[bestPlayer]?.name : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  )
                },
              )}

              <InfoNote variant="scope" title="Reading this comparison">
                Different position groups have different peer baselines — the radar uses each player's own
                position peers. Metrics unavailable for any selected player are excluded from the table
                (shown only when shared), never zero-filled. All records are fictional demo data.
              </InfoNote>
            </>
          )}
        </>
      )}
    </div>
  )
}
