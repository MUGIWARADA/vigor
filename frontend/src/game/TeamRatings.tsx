import { useMemo, useState } from 'react'
import { Footprints, RotateCcw, SlidersHorizontal, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  ENGINE_ATTRIBUTES,
  FORMATIONS,
  PES_ATTRIBUTE_LABELS,
  PES_STARS,
  averageGameRatings,
  effectiveAttribute,
  getTeam,
  normalizeRatingOverrides,
  playerGameRatings,
  weakFootPenalty,
  withRatingOverrides,
  type Foot,
  type PesAttributes,
  type PesStar,
  type PositionCode,
  type RatingOverrides,
  type TeamId,
  type TeamPlan,
} from './data'

const EIGHT_KEYS = new Set<keyof PesAttributes>(['consistency', 'condition', 'weakFootAccuracy', 'weakFootFrequency'])
const CATEGORY_ROWS: Array<{ key: 'overall' | 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical' | 'goalkeeping'; label: string }> = [
  { key: 'overall', label: 'Overall' },
  { key: 'pace', label: 'Pace' },
  { key: 'shooting', label: 'Shooting' },
  { key: 'passing', label: 'Passing' },
  { key: 'dribbling', label: 'Dribbling' },
  { key: 'defending', label: 'Defending' },
  { key: 'physical', label: 'Physical' },
  { key: 'goalkeeping', label: 'Goalkeeping' },
]

function slotPosition(plan: TeamPlan, slotId: string): PositionCode {
  return FORMATIONS[plan.formation]?.find((s) => s.id === slotId)?.position ?? 'CM'
}

function groupOf(pos: PositionCode): 'GK' | 'DF' | 'MF' | 'FW' {
  if (pos === 'GK') return 'GK'
  if (['LB', 'LCB', 'CB', 'RCB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'DF'
  if (['LW', 'RW', 'ST', 'LST', 'RST'].includes(pos)) return 'FW'
  return 'MF'
}

function ratingBar(label: string, value: number) {
  return (
    <div key={label}>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-fg-muted">{label}</span>
        <span className="text-metric font-semibold text-fg">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
        <div className="h-full rounded-full bg-accent-500" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export function TeamRatings({ plans, overrides, onChange }: {
  plans: Record<TeamId, TeamPlan>
  overrides: RatingOverrides
  onChange: (next: RatingOverrides) => void
}) {
  const cleanOverrides = useMemo(() => normalizeRatingOverrides(overrides), [overrides])
  const [teamId, setTeamId] = useState<TeamId>('bracelonia')
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [positionFilter, setPositionFilter] = useState<'ALL' | 'GK' | 'DF' | 'MF' | 'FW'>('ALL')
  const [sortBy, setSortBy] = useState<'overall' | 'number' | 'pace' | 'passing' | 'shooting'>('overall')
  const [search, setSearch] = useState('')

  const team = getTeam(teamId)
  const plan = plans[teamId]
  const effectivePlayers = useMemo(
    () => team.players.map((p) => withRatingOverrides(p, cleanOverrides)),
    [team.players, cleanOverrides],
  )
  const effectiveById = useMemo(() => new Map(effectivePlayers.map((p) => [p.id, p])), [effectivePlayers])
  const xi = plan.slots.map((slot) => ({
    slot,
    player: effectiveById.get(slot.playerId)!,
    position: slotPosition(plan, slot.slotId),
  })).filter((x) => x.player)
  const squadAverage = averageGameRatings(effectivePlayers)
  const xiAverage = averageGameRatings(xi.map((x) => x.player))
  const unit = (predicate: (pos: PositionCode) => boolean, key: 'shooting' | 'passing' | 'defending' | 'goalkeeping' | 'overall') => {
    const values = xi.filter((x) => predicate(x.position)).map((x) => playerGameRatings(x.player, x.position)[key])
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0
  }

  const visiblePlayers = effectivePlayers
    .filter((p) => positionFilter === 'ALL' || groupOf(p.position) === positionFilter)
    .filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'number') return a.number - b.number
      return playerGameRatings(b)[sortBy] - playerGameRatings(a)[sortBy]
    })
  const selected = effectiveById.get(selectedPlayerId)
    ?? [...effectivePlayers].sort((a, b) => playerGameRatings(b).overall - playerGameRatings(a).overall)[0]!
  const selectedOriginal = team.players.find((p) => p.id === selected.id)!
  const selectedRatings = playerGameRatings(selected)
  const selectedOverride = cleanOverrides[selected.id] ?? {}
  const modifiedCount = Object.keys(cleanOverrides).length

  const updateAttribute = (key: keyof PesAttributes, value: number | 'A' | 'B' | 'C') => {
    const nextForPlayer: Partial<PesAttributes> = { ...selectedOverride }
    if (value === selectedOriginal.attributes[key]) delete nextForPlayer[key]
    else nextForPlayer[key] = value as never
    const next = { ...cleanOverrides }
    if (Object.keys(nextForPlayer).length) next[selected.id] = nextForPlayer
    else delete next[selected.id]
    onChange(normalizeRatingOverrides(next))
  }

  // Special abilities are a per-player edit too, and they are read directly by
  // the engine (Middle Shooting, Scoring, 1-on-1 Stopper, Covering ...).
  const toggleStar = (star: PesStar) => {
    const original = selectedOriginal.stars
    const current = selectedOverride.stars ?? original
    const nextStars = current.includes(star) ? current.filter((x) => x !== star) : [...current, star]
    const next = { ...cleanOverrides }
    const rest = { ...(next[selected.id] ?? {}) }
    if (nextStars.length === original.length && nextStars.every((x) => original.includes(x))) delete rest.stars
    else rest.stars = nextStars
    if (Object.keys(rest).length) next[selected.id] = rest
    else delete next[selected.id]
    onChange(normalizeRatingOverrides(next))
  }

  const updateFoot = (foot: Foot) => {
    const next = { ...cleanOverrides }
    if (foot === selectedOriginal.foot) {
      const { foot: _drop, ...rest } = next[selected.id] ?? {}
      if (Object.keys(rest).length) next[selected.id] = rest
      else delete next[selected.id]
    } else {
      next[selected.id] = { ...(next[selected.id] ?? {}), foot }
    }
    onChange(normalizeRatingOverrides(next))
  }

  const resetPlayer = () => {
    const next = { ...cleanOverrides }
    delete next[selected.id]
    onChange(normalizeRatingOverrides(next))
  }
  const resetTeam = () => {
    const next = { ...cleanOverrides }
    for (const p of team.players) delete next[p.id]
    onChange(normalizeRatingOverrides(next))
  }

  return (
    <div className="space-y-4" data-testid="team-ratings">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Star className="size-4 text-accent-300" /> Team ratings</CardTitle>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-fg-muted">
                Video-game category ratings derived from each fictional player’s real-life role/performance profile and full PES PS2-style sheet. Overall is position-specific and form-adjusted. Any edits below are local overrides for future matches and Test Bench runs—they do not rewrite the base database.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['bracelonia', 'banyarn'] as TeamId[]).map((id) => (
                <Button key={id} type="button" variant={teamId === id ? 'default' : 'outline'} onClick={() => { setTeamId(id); setSelectedPlayerId('') }}>
                  {getTeam(id).name}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {[
              ['Best XI OVR', xiAverage.overall], ['Squad OVR', squadAverage.overall],
              ['Attack', unit((pos) => ['CAM', 'LW', 'RW', 'ST', 'LST', 'RST'].includes(pos), 'shooting')],
              ['Midfield', unit((pos) => groupOf(pos) === 'MF', 'passing')],
              ['Defence', unit((pos) => groupOf(pos) === 'DF', 'defending')],
              ['Goalkeeper', unit((pos) => pos === 'GK', 'goalkeeping')],
              ['Team pace', xiAverage.pace], ['Team passing', xiAverage.passing],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-ink-900 px-3 py-2 text-center">
                <div className="text-metric text-xl font-bold text-accent-300">{value}</div>
                <div className="text-[10px] uppercase tracking-wide text-fg-muted">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            <Badge variant={modifiedCount ? 'accent' : 'outline'}>{modifiedCount} edited player{modifiedCount === 1 ? '' : 's'}</Badge>
            <span>Current Match Plan: {plan.name} · {plan.formation}</span>
            <span className="ml-auto flex gap-1.5">
              <Button type="button" size="sm" variant="ghost" onClick={resetTeam}><RotateCcw /> Reset {team.shortName}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange({})}><RotateCcw /> Reset all ratings</Button>
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-44 flex-1">
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-fg-muted" htmlFor="ratings-search">Search squad</label>
                <Input id="ratings-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Player name…" />
              </div>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-fg-muted">Unit</span>
                <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value as typeof positionFilter)} className="h-9 rounded-md border border-line-strong bg-ink-900 px-2 text-sm text-fg" aria-label="Ratings position filter">
                  <option value="ALL">All players</option><option value="GK">Goalkeepers</option><option value="DF">Defenders</option><option value="MF">Midfielders</option><option value="FW">Forwards</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-fg-muted">Sort</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="h-9 rounded-md border border-line-strong bg-ink-900 px-2 text-sm text-fg" aria-label="Ratings sort">
                  <option value="overall">Overall</option><option value="pace">Pace</option><option value="passing">Passing</option><option value="shooting">Shooting</option><option value="number">Shirt number</option>
                </select>
              </label>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Player</TableHead><TableHead>Pos</TableHead><TableHead>OVR</TableHead><TableHead>PAC</TableHead><TableHead>SHO</TableHead><TableHead>PAS</TableHead><TableHead>DRI</TableHead><TableHead>DEF</TableHead><TableHead>PHY</TableHead><TableHead>GK</TableHead></TableRow></TableHeader>
              <TableBody>
                {visiblePlayers.map((player) => {
                  const r = playerGameRatings(player)
                  const inXi = plan.slots.some((s) => s.playerId === player.id)
                  const edited = Boolean(cleanOverrides[player.id])
                  return (
                    <TableRow key={player.id} className={cn(selected.id === player.id && 'bg-accent-400/10')}>
                      <TableCell>
                        <button type="button" onClick={() => setSelectedPlayerId(player.id)} className="text-left hover:text-accent-300">
                          <span className="font-medium text-fg">#{player.number} {player.name}</span>
                          <span className="block text-[10px] text-fg-muted">{inXi ? 'Starting XI' : plan.benchIds.includes(player.id) ? 'Bench' : 'Reserve'}{edited ? ' · edited' : ''}</span>
                        </button>
                      </TableCell>
                      <TableCell>{player.position}</TableCell>
                      <TableCell className="text-metric font-bold text-accent-300">{r.overall}</TableCell>
                      <TableCell className="text-metric">{r.pace}</TableCell><TableCell className="text-metric">{r.shooting}</TableCell>
                      <TableCell className="text-metric">{r.passing}</TableCell><TableCell className="text-metric">{r.dribbling}</TableCell>
                      <TableCell className="text-metric">{r.defending}</TableCell><TableCell className="text-metric">{r.physical}</TableCell>
                      <TableCell className="text-metric">{r.goalkeeping}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {!visiblePlayers.length && <p className="py-4 text-xs text-fg-muted">No players match that filter.</p>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>#{selected.number} {selected.name}</CardTitle>
                  <p className="mt-1 text-xs text-fg-muted">{selected.position}{selected.secondaryPositions.length ? ` · also ${selected.secondaryPositions.join('/')}` : ''} · Age {selected.age} · {selected.heightCm}cm · {selected.foot === 'B' ? 'Both feet' : `${selected.foot} foot`} · Form {selected.form}</p>
                </div>
                <div className="rounded-md bg-ink-900 px-3 py-2 text-center">
                  <div className="text-metric text-2xl font-black text-accent-300">{selectedRatings.overall}</div>
                  <div className="text-[9px] uppercase tracking-wide text-fg-muted">OVR</div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {selected.stars.length ? selected.stars.map((s) => <Badge key={s} variant="accent">★ {s}</Badge>) : <span className="text-xs text-fg-muted">No special stars</span>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                {CATEGORY_ROWS.filter((row) => row.key !== 'overall').map((row) => ratingBar(row.label, selectedRatings[row.key]))}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="weak-foot-editor">
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2"><Footprints className="size-4 text-accent-300" /> Weak foot</CardTitle>
                <p className="mt-1 text-xs text-fg-muted">
                  The ball is carried on one side of the body, and that side decides the striking foot. Preferred foot sets which
                  one he wants it on; Weak Foot Accuracy is what the wrong one costs him.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-fg-muted">Preferred foot</span>
                <div className="flex gap-1.5" role="group" aria-label="Preferred foot">
                  {([['L', 'Left'], ['R', 'Right'], ['B', 'Both']] as const).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={selected.foot === value ? 'default' : 'outline'}
                      aria-pressed={selected.foot === value}
                      onClick={() => updateFoot(value)}
                    >
                      {label}
                    </Button>
                  ))}
                  {selectedOverride.foot !== undefined && <Badge variant="accent" className="self-center">edited</Badge>}
                </div>
              </div>
              {(['weakFootAccuracy', 'weakFootFrequency'] as const).map((key) => {
                const label = key === 'weakFootAccuracy' ? 'Weak Foot Accuracy' : 'Weak Foot Frequency'
                const value = Number(selected.attributes[key])
                const edited = selectedOverride[key] !== undefined
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="text-fg-muted">{label}{edited ? <span className="text-accent-300"> · edited</span> : ''}</span>
                      <span className="text-metric text-fg">
                        {value}/8
                        <span className="ml-1 text-[10px] text-fg-muted">base {String(selectedOriginal.attributes[key])}</span>
                      </span>
                    </div>
                    <Slider aria-label={label} min={1} max={8} step={1} value={[value]} onValueChange={([v]) => updateAttribute(key, v ?? value)} />
                  </div>
                )
              })}
              <div className="rounded-md bg-ink-900 px-3 py-2 text-[11px] leading-relaxed text-fg-muted" data-testid="weak-foot-readout">
                {selected.foot === 'B'
                  ? 'Two-footed: strikes with whichever foot the ball is on, with no penalty either way.'
                  : selected.foot === 'L'
                    ? 'Left-footed. Right-foot strikes are '
                    : 'Right-footed. Left-foot strikes are '}
                {selected.foot !== 'B' && (
                  <>
                    <strong className="text-fg">{Math.round((weakFootPenalty(Number(selected.attributes.weakFootAccuracy)).noiseScale - 1) * 100)}%</strong> wider
                    {' and '}
                    <strong className="text-fg">{Math.round((1 - weakFootPenalty(Number(selected.attributes.weakFootAccuracy)).powerScale) * 100)}%</strong> slower
                  </>
                )}
                {selected.foot !== 'B' && `; he looks to roll it onto his ${selected.foot === 'L' ? 'left' : 'right'} whenever he has the room.`}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-accent-300" /> Edit PES attributes</CardTitle>
                  <p className="mt-1 text-xs text-fg-muted">Changes save locally and apply from the next kick-off. The number in brackets is the form-adjusted in-match value.</p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={resetPlayer}><RotateCcw /> Reset player</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[620px] space-y-3 overflow-auto pr-1">
                {PES_ATTRIBUTE_LABELS.filter(([key]) => ENGINE_ATTRIBUTES.includes(key)).map(([key, label]) => {
                  const original = selectedOriginal.attributes[key]
                  const current = selected.attributes[key]
                  if (key === 'injuryTolerance') {
                    return (
                      <label key={key} className="block">
                        <span className="mb-1 block text-xs text-fg-muted">{label}</span>
                        <select value={String(current)} onChange={(e) => updateAttribute(key, e.target.value as 'A' | 'B' | 'C')} className="h-9 w-full rounded-md border border-line-strong bg-ink-900 px-2 text-sm text-fg" aria-label={label}>
                          <option value="A">A — robust</option><option value="B">B — normal</option><option value="C">C — fragile</option>
                        </select>
                      </label>
                    )
                  }
                  const numeric = Number(current)
                  const effective = Math.round(effectiveAttribute(selected, key))
                  return (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="text-fg-muted">{label}{selectedOverride[key] !== undefined ? <span className="text-accent-300"> · edited</span> : ''}</span>
                        <span className="text-metric text-fg">{numeric}{effective !== numeric ? <span className="ml-1 text-[10px] text-fg-muted">({effective})</span> : null}<span className="ml-1 text-[10px] text-fg-muted">base {String(original)}</span></span>
                      </div>
                      <Slider
                        aria-label={label}
                        min={1}
                        max={EIGHT_KEYS.has(key) ? 8 : 99}
                        step={1}
                        value={[numeric]}
                        onValueChange={([v]) => updateAttribute(key, v ?? numeric)}
                      />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2"><Star className="size-4 text-accent-300" /> Special abilities</CardTitle>
                <p className="mt-1 text-xs text-fg-muted">PES PS2 starred abilities. Tap to switch one on or off; the engine reads them for shooting, heading, marking, keeping and long throws.</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Special abilities">
                {PES_STARS.map((star) => {
                  const on = (selectedOverride.stars ?? selectedOriginal.stars).includes(star)
                  return (
                    <button
                      key={star}
                      type="button"
                      aria-pressed={on}
                      aria-label={star}
                      onClick={() => toggleStar(star)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                        on ? 'border-accent-500/70 bg-accent-400/15 text-accent-200' : 'border-line-strong text-fg-muted hover:border-accent-500/40 hover:text-fg',
                      )}
                    >
                      {on ? '★ ' : ''}{star}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
