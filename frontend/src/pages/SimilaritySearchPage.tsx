import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GitCompareArrows, Scale } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { InfoNote } from '@/components/shared/info-note'
import { PlayerSelect } from '@/components/shared/player-select'
import { ProvenanceBadge } from '@/components/shared/provenance'
import { PlayerAvatar, PositionBadge } from '@/components/shared/player-bits'
import { useData } from '@/state/data'
import { useSettings } from '@/state/settings'
import type { Dimension, TeamStyle } from '@/types'
import { DIMENSION_LABELS, METRICS } from '@/lib/metrics'
import {
  buildPeerGroupWithContext,
  computeSimilarity,
  defaultWeightsForRole,
  playerAge,
} from '@/lib/analysis'
import { ROLES } from '@/lib/roles'
import { groupOf } from '@/lib/positions'

const DIMENSIONS: Dimension[] = ['progression', 'retention', 'creation', 'defending', 'finishing', 'carrying']
const TEAM_STYLES: TeamStyle[] = ['Possession-oriented', 'Direct', 'Counterattacking', 'High-pressing']

export function SimilaritySearchPage() {
  const { data, players, teams, playerById } = useData()
  const { settings } = useSettings()
  const [searchParams] = useSearchParams()

  const initial = searchParams.get('player') ?? undefined
  const [targetId, setTargetId] = useState<string | undefined>(initial || undefined)
  const [weights, setWeights] = useState<Record<Dimension, number> | null>(null)
  const [minMinutes, setMinMinutes] = useState(270)
  const [ageMin, setAgeMin] = useState(16)
  const [ageMax, setAgeMax] = useState(40)
  const [teamStyle, setTeamStyle] = useState<TeamStyle | 'all'>('all')
  const [samePositionOnly, setSamePositionOnly] = useState(true)

  const target = targetId ? playerById(targetId) : undefined
  const effectiveWeights: Record<Dimension, number> = useMemo(() => {
    if (weights) return weights
    return target ? defaultWeightsForRole(target.role) : defaultWeightsForRole('box-to-box')
  }, [weights, target])

  const candidates = useMemo(() => {
    if (!target) return []
    return buildPeerGroupWithContext(
      players,
      new Map(teams.map((t) => [t.id, t])),
      {
        positionGroup: samePositionOnly ? groupOf(target.position) : 'all',
        teamStyle,
        minMinutes,
        ageMin,
        ageMax,
      },
    ).filter((p) => p.id !== target.id)
  }, [target, players, teams, samePositionOnly, teamStyle, minMinutes, ageMin, ageMax])

  const results = useMemo(
    () => (target ? computeSimilarity(target, { weights: effectiveWeights, candidates }).slice(0, 12) : []),
    [target, effectiveWeights, candidates],
  )

  const setWeight = (dim: Dimension, value: number) => {
    setWeights({ ...effectiveWeights, [dim]: value })
  }

  const weightsCustomised = weights !== null

  return (
    <div className="space-y-5">
      <PageHeader
        title="Similarity search"
        description="Deterministic, explainable player similarity. Scores are computed from real metric values via z-score distances weighted by tactical dimensions — never invented by a language model."
      />

      {!data ? (
        <EmptyState
          icon={Scale}
          title="No data available"
          description={
            settings.demoMode
              ? 'Data is loading or unavailable.'
              : 'Demo data is disabled and no real data source is connected. Enable demo data in Settings.'
          }
          showSettingsAction={!settings.demoMode}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
          {/* Config */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Search configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ss-target">Target player</Label>
                <PlayerSelect
                  id="ss-target"
                  value={targetId}
                  onChange={(v) => {
                    setTargetId(v)
                    setWeights(null)
                  }}
                />
                {target && (
                  <p className="text-[11px] text-fg-faint">
                    Weights default to the {ROLES[target.role].label.toLowerCase()} role profile
                    {weightsCustomised ? ' (customised)' : ''}.
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                <Label>Dimension weights (0–5)</Label>
                {DIMENSIONS.map((dim) => (
                  <div key={dim} className="flex items-center gap-3">
                    <span className="w-20 text-xs capitalize text-fg-muted">{DIMENSION_LABELS[dim]}</span>
                    <Slider
                      value={[effectiveWeights[dim] ?? 0]}
                      min={0}
                      max={5}
                      step={1}
                      onValueChange={([v]) => setWeight(dim, v ?? 0)}
                      className="flex-1"
                      aria-label={`${DIMENSION_LABELS[dim]} weight`}
                      disabled={!target}
                    />
                    <span className="text-metric w-4 text-right text-xs text-fg">{effectiveWeights[dim] ?? 0}</span>
                  </div>
                ))}
                {weightsCustomised && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setWeights(null)}
                    disabled={!target}
                  >
                    Reset to role defaults
                  </Button>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-muted">
                <Checkbox
                  checked={samePositionOnly}
                  onCheckedChange={(v) => setSamePositionOnly(v === true)}
                  disabled={!target}
                />
                Same position group only
              </label>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ss-style">Team style</Label>
                <Select value={teamStyle} onValueChange={(v) => setTeamStyle(v as TeamStyle | 'all')} disabled={!target}>
                  <SelectTrigger id="ss-style">
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
                <Label>Minimum minutes</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[minMinutes]}
                    min={0}
                    max={700}
                    step={10}
                    onValueChange={([v]) => setMinMinutes(v ?? 0)}
                    className="flex-1"
                    aria-label="Minimum minutes"
                    disabled={!target}
                  />
                  <span className="text-metric w-10 text-right text-xs text-fg">{minMinutes}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="ss-age-min">Age min</Label>
                  <Input id="ss-age-min" type="number" min={16} max={40} value={ageMin}
                    onChange={(e) => setAgeMin(Number(e.target.value) || 16)} disabled={!target} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="ss-age-max">Age max</Label>
                  <Input id="ss-age-max" type="number" min={16} max={40} value={ageMax}
                    onChange={(e) => setAgeMax(Number(e.target.value) || 40)} disabled={!target} />
                </div>
              </div>

              <div className="rounded-md panel-border bg-ink-900/60 p-3 text-[11px] leading-relaxed text-fg-muted">
                <p className="mb-1 font-semibold text-fg">Comparison sample</p>
                <p>{candidates.length} candidates · {teamStyle === 'all' ? 'all styles' : teamStyle} · ≥{minMinutes} min · ages {ageMin}–{ageMax}</p>
                <p className="mt-1 text-fg-faint">Metrics missing for either player are excluded pair-wise and reported, never zero-filled.</p>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="space-y-4">
            {!target ? (
              <EmptyState
                icon={Scale}
                title="Choose a target player"
                description="Select a player and adjust the dimension weights — progression, retention, creation, defending, finishing and carrying — to define what 'similar' means for your question."
              />
            ) : results.length === 0 ? (
              <EmptyState title="No candidates match the filters" description="Widen the age range, minutes or style filter." />
            ) : (
              <>
                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle>Most similar to {target.name}</CardTitle>
                    <ProvenanceBadge provenance="DEMO" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {results.map((r, i) => (
                      <div
                        key={r.player.id}
                        className="flex flex-wrap items-center gap-3 rounded-md panel-border bg-ink-900/50 p-3"
                      >
                        <span className="text-metric w-6 text-center text-xs font-bold text-fg-faint">{i + 1}</span>
                        <PlayerAvatar name={r.player.name} position={r.player.position} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link to={`/players/${r.player.id}`} className="text-[13px] font-medium text-fg hover:text-accent-300">
                              {r.player.name}
                            </Link>
                            <PositionBadge position={r.player.position} />
                            <span className="text-[10px] text-fg-faint">
                              {teams.find((t) => t.id === r.player.teamId)?.shortName} · {playerAge(r.player)} yrs · {r.player.stats.minutes} min
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="text-[10px] text-fg-faint">Biggest gaps:</span>
                            {r.contributions.map((c) => (
                              <Badge key={`${r.player.id}-${c.metricId}`} variant="muted" className="normal-case">
                                {METRICS[c.metricId]?.label ?? c.metricId}
                                <span className="text-metric ml-1 text-fg-faint">{c.distance.toFixed(1)}σ</span>
                              </Badge>
                            ))}
                          </div>
                          {r.excludedMetrics.length > 0 && (
                            <p className="mt-0.5 text-[10px] text-fg-faint">
                              Excluded (missing data): {r.excludedMetrics.map((m) => METRICS[m]?.label ?? m).join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="text-metric text-lg font-bold text-accent-300">{r.score}</span>
                            <span className="text-xs text-fg-faint">/100</span>
                            <p className="text-[10px] text-fg-faint">dist {r.weightedDistance.toFixed(2)}σ</p>
                          </div>
                          <Button asChild variant="outline" size="xs">
                            <Link to={`/compare?ids=${target.id},${r.player.id}`}>
                              <GitCompareArrows aria-hidden />
                              Compare
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <InfoNote title="How this score is calculated">
                  <ol className="ml-3.5 list-decimal space-y-0.5">
                    <li>Each metric is converted to a z-score within the candidate pool ∪ target.</li>
                    <li>Per dimension, the mean absolute z-distance across metrics available for both players.</li>
                    <li>Dimensions are combined with your weights into an overall weighted distance D (σ units).</li>
                    <li>Score = 100 × (1 − D/3), clamped to 0–100. Fully identical = 100.</li>
                  </ol>
                  Results are reproducible: the same inputs always produce the same ranking — no
                  randomness is involved. Values come from the fictional demo dataset.
                </InfoNote>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
