import { useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Minus, MoveDiagonal, Shield, Sparkles, Swords } from 'lucide-react'
import { Pitch } from '@/components/pitch/Pitch'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { roleProfile, rolesForPosition, slotRole } from './roles'
import {
  FORMATIONS,
  PES_ATTRIBUTE_LABELS,
  effectiveAttribute,
  getPlayer,
  getTeam,
  positionOverall,
  rebuildPlanForFormation,
  withRatingOverrides,
  type GamePlayer,
  type RatingOverrides,
  type TeamPlan,
} from './data'

/**
 * The team screen, built the way a console management screen is built: the
 * shape on the left, three units of roles on the right, and everything else
 * that is genuinely a preference behind two dials. You never have to select a
 * player to give him a job, and nothing here needs a right-click or a second
 * page of scrolling to be understood.
 */

type UnitId = 'defence' | 'midfield' | 'offence'

const UNITS: Array<{ id: UnitId; label: string; note: string; positions: string[] }> = [
  { id: 'defence', label: 'Defence', note: 'CB · SW · FB', positions: ['GK', 'LCB', 'CB', 'RCB', 'LB', 'RB'] },
  { id: 'midfield', label: 'Midfield', note: 'CDM · WMF · CM · CAM · WB', positions: ['DM', 'LDM', 'RDM', 'LWB', 'RWB', 'LM', 'LCM', 'CM', 'RCM', 'RM', 'CAM'] },
  { id: 'offence', label: 'Offence', note: 'WW · SS · ST', positions: ['LW', 'RW', 'LST', 'ST', 'RST', 'SS'] },
]

const unitOf = (position: string): UnitId =>
  UNITS.find((u) => u.positions.includes(position))?.id ?? 'midfield'

/** Two dials, and they are the two a manager actually turns during a match. */
const DIALS: Array<{ key: 'lineHeight' | 'tempo'; label: string; help: string }> = [
  { key: 'lineHeight', label: 'Defensive line', help: 'How high the back line squeezes the pitch.' },
  { key: 'tempo', label: 'Tempo', help: 'Speed of circulation and restarts.' },
]

const DEFENSIVE_STYLES: Array<{ name: string; lineHeight: number; compactness: number; pressing: number }> = [
  { name: 'Deep block', lineHeight: 32, compactness: 84, pressing: 26 },
  { name: 'Mid block', lineHeight: 50, compactness: 66, pressing: 48 },
  { name: 'High press', lineHeight: 72, compactness: 56, pressing: 80 },
]

const ATTACKING_STYLES: Array<{ name: string; tempo: number; directness: number; width: number }> = [
  { name: 'Possession', tempo: 44, directness: 40, width: 62 },
  { name: 'Balanced', tempo: 56, directness: 54, width: 54 },
  { name: 'Direct', tempo: 76, directness: 74, width: 50 },
  { name: 'Counter', tempo: 64, directness: 70, width: 46 },
]

const nearestStyle = <T extends { name: string }>(styles: T[], score: (style: T) => number): T =>
  styles.reduce((best, style) => (score(style) < score(best) ? style : best), styles[0]!)

function FormIcon({ form }: { form: GamePlayer['form'] }) {
  if (form === 'top' || form === 'good') return <ArrowUp className={cn('size-3.5', form === 'top' ? 'text-accent-300' : 'text-emerald-300')} aria-label={`${form} form`} /> 
  if (form === 'poor' || form === 'terrible') return <ArrowDown className={cn('size-3.5', form === 'terrible' ? 'text-red-300' : 'text-amber-300')} aria-label={`${form} form`} />
  return <Minus className="size-3.5 text-fg-muted" aria-label="normal form" />
}

export function MatchPlanEditor({ plan, onChange, ratingOverrides = {} }: {
  plan: TeamPlan
  onChange: (plan: TeamPlan) => void
  ratingOverrides?: RatingOverrides
}) {
  const team = getTeam(plan.teamId)
  const effectivePlayer = (id: string) => withRatingOverrides(getPlayer(id)!, ratingOverrides)
  const [hookSlotId, setSelectedSlotId] = useState(plan.slots[0]?.slotId ?? 'gk')
  const [selectedBenchId, setSelectedBenchId] = useState(plan.benchIds[0] ?? '')
  const [dragSlotId, setDragSlotId] = useState<string | null>(null)
  const [view, setView] = useState<'roles' | 'setPieces' | 'squad'>('roles')
  const svgRef = useRef<SVGSVGElement | null>(null)
  const slotsWithPlayers = useMemo(
    () => plan.slots.map((slot) => ({ slot, player: effectivePlayer(slot.playerId) })),
    // effectivePlayer is intentionally re-created from the current override map.
    [plan.slots, ratingOverrides],
  )
  const selected = slotsWithPlayers.find((x) => x.slot.slotId === hookSlotId) ?? slotsWithPlayers[0]
  const bench = plan.benchIds.map((id) => effectivePlayer(id)).filter(Boolean)
  const selectedIds = new Set([...plan.slots.map((s) => s.playerId), ...plan.benchIds])
  const reserves = team.players.filter((p) => !selectedIds.has(p.id)).map((p) => withRatingOverrides(p, ratingOverrides))
  const templateFor = (slotId: string) => FORMATIONS[plan.formation]?.find((s) => s.id === slotId)

  const update = (next: TeamPlan) => onChange(structuredClone(next))
  const updateSlot = (slotId: string, changes: Partial<TeamPlan['slots'][number]>) => {
    update({ ...plan, slots: plan.slots.map((s) => s.slotId === slotId ? { ...s, ...changes } : s) })
  }
  const swapStarterWithBench = (benchPlayerId: string) => {
    if (!selected) return
    const outId = selected.slot.playerId
    update({
      ...plan,
      slots: plan.slots.map((s) => s.slotId === selected.slot.slotId ? { ...s, playerId: benchPlayerId } : s),
      benchIds: plan.benchIds.map((id) => id === benchPlayerId ? outId : id),
    })
  }
  const swapBenchWithReserve = (reserveId: string) => {
    const benchId = plan.benchIds.includes(selectedBenchId) ? selectedBenchId : plan.benchIds[plan.benchIds.length - 1]
    if (!benchId) return
    update({ ...plan, benchIds: plan.benchIds.map((id) => id === benchId ? reserveId : id) })
    setSelectedBenchId(reserveId)
  }
  const pointerMove = (event: React.PointerEvent) => {
    if (!dragSlotId || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = -2 + ((event.clientX - rect.left) / rect.width) * 109
    const y = -2 + ((event.clientY - rect.top) / rect.height) * 72
    updateSlot(dragSlotId, { x: Math.min(102, Math.max(2, x)), y: Math.min(66, Math.max(2, y)) })
  }
  const autoSetPieces = () => {
    const fresh = rebuildPlanForFormation(plan, plan.formation)
    update({ ...plan, setPieces: { ...fresh.setPieces, attackingCorner: plan.setPieces.attackingCorner, defendingCorner: plan.setPieces.defendingCorner, assignmentMode: 'auto' } })
  }

  const defensiveStyle = nearestStyle(DEFENSIVE_STYLES, (style) =>
    Math.abs(style.lineHeight - plan.sliders.lineHeight)
    + Math.abs(style.compactness - plan.sliders.compactness) * 0.7
    + Math.abs(style.pressing - plan.sliders.pressing) * 0.7)
  const attackingStyle = nearestStyle(ATTACKING_STYLES, (style) =>
    Math.abs(style.tempo - plan.sliders.tempo)
    + Math.abs(style.directness - plan.sliders.directness) * 0.6
    + Math.abs(style.width - plan.sliders.width) * 0.4)

  const applyDefensiveStyle = (name: string) => {
    const style = DEFENSIVE_STYLES.find((x) => x.name === name)
    if (!style) return
    update({
      ...plan,
      sliders: { ...plan.sliders, lineHeight: style.lineHeight, compactness: style.compactness, pressing: style.pressing },
    })
  }
  const applyAttackingStyle = (name: string) => {
    const style = ATTACKING_STYLES.find((x) => x.name === name)
    if (!style) return
    update({
      ...plan,
      sliders: { ...plan.sliders, tempo: style.tempo, directness: style.directness, width: style.width },
    })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="space-y-4">
      {/* ---------------------------------------------------------------- */}
      {/* Shape                                                             */}
      {/* ---------------------------------------------------------------- */}
      <Card className="xl:self-start">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{team.name} — shape</CardTitle>
            <p className="mt-1 text-xs text-fg-muted">Drag any shirt to make a free shape. Attacks left to right.</p>
          </div>
          <div className="w-full sm:w-40">
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-fg-muted">Formation</span>
              <select
                id={`formation-${team.id}`}
                value={plan.formation}
                onChange={(e) => {
                  const next = rebuildPlanForFormation(plan, e.target.value)
                  setSelectedSlotId(next.slots[0]?.slotId ?? 'gk')
                  update(next)
                }}
                className="h-9 w-full min-w-0 rounded-md border border-line-strong bg-ink-900 px-2 text-sm text-fg outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30"
              >
                {Object.keys(FORMATIONS).map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <div onPointerMove={pointerMove} onPointerUp={() => setDragSlotId(null)} onPointerLeave={() => setDragSlotId(null)}>
            <Pitch innerRef={(el) => { svgRef.current = el }} ariaLabel={`${team.name} formation editor`}>
              {slotsWithPlayers.map(({ slot, player }) => {
                const isSelected = selected?.slot.slotId === slot.slotId
                const isGk = templateFor(slot.slotId)?.position === 'GK'
                return (
                  <g
                    key={slot.slotId}
                    data-testid={`plan-player-${player.id}`}
                    className="cursor-grab active:cursor-grabbing"
                    onPointerDown={(e) => { e.preventDefault(); setSelectedSlotId(slot.slotId); setDragSlotId(slot.slotId) }}
                  >
                    <circle cx={slot.x} cy={slot.y} r={isSelected ? 3.35 : 2.9} fill={isGk ? team.gkColor : team.color} stroke={isSelected ? '#d9f99d' : 'rgba(255,255,255,0.75)'} strokeWidth={isSelected ? 0.55 : 0.3} />
                    <text x={slot.x} y={slot.y + 0.72} textAnchor="middle" fontSize={2.25} fontWeight={800} fill={isGk ? '#111827' : team.textColor}>{player.number}</text>
                    <text x={slot.x} y={slot.y + 5.2} textAnchor="middle" fontSize={1.85} fill="rgba(250,250,250,0.88)">{player.name.split(' ').at(-1)}</text>
                  </g>
                )
              })}
            </Pitch>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            <MoveDiagonal className="size-3.5" /> Free dragging is saved in the plan.
            <Badge variant="outline">{plan.formation}</Badge>
          </div>
        </CardContent>
      </Card>

        <Card>
          <CardHeader><CardTitle>Team style</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-fg-muted">Without the ball</span>
                <select
                  id={`${team.id}-defensive-style`}
                  value={defensiveStyle.name}
                  onChange={(e) => applyDefensiveStyle(e.target.value)}
                  className="h-9 w-full min-w-0 rounded-md border border-line-strong bg-ink-900 px-2 text-sm text-fg outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30"
                >
                  {DEFENSIVE_STYLES.map((style) => <option key={style.name} value={style.name}>{style.name}</option>)}
                </select>
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-fg-muted">With the ball</span>
                <select
                  id={`${team.id}-attacking-style`}
                  value={attackingStyle.name}
                  onChange={(e) => applyAttackingStyle(e.target.value)}
                  className="h-9 w-full min-w-0 rounded-md border border-line-strong bg-ink-900 px-2 text-sm text-fg outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30"
                >
                  {ATTACKING_STYLES.map((style) => <option key={style.name} value={style.name}>{style.name}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {DIALS.map((dial) => (
                <div key={dial.key}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label htmlFor={`${team.id}-${dial.key}`} className="text-xs font-medium text-fg">{dial.label}</label>
                    <span className="text-metric text-xs text-accent-300">{plan.sliders[dial.key]}</span>
                  </div>
                  <Slider id={`${team.id}-${dial.key}`} aria-label={dial.label} min={0} max={100} step={1} value={[plan.sliders[dial.key]]} onValueChange={([v]) => update({ ...plan, sliders: { ...plan.sliders, [dial.key]: v } })} />
                  <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">{dial.help}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 flex gap-2 text-[11px] leading-relaxed text-fg-muted">
              <Shield className="mt-0.5 size-3.5 shrink-0" />
              <span>Everything else a player does — how deep he drops, which lane he takes, how hard he presses, whether he arrives in the box — comes from his role above, not from a slider.</span>
            </p>
            <p className="mt-2 flex gap-2 text-[11px] leading-relaxed text-fg-muted">
              <Swords className="mt-0.5 size-3.5 shrink-0" />
              <span>{team.identity.buildUp} {team.identity.press}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Roles by unit, and the two dials                                 */}
      {/* ---------------------------------------------------------------- */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Roles</CardTitle>
              <p className="mt-1 text-xs text-fg-muted">One job per shirt. Pick it here; the role decides where he goes.</p>
            </div>
            <div className="flex gap-1 rounded-md border border-line bg-ink-900 p-1" role="tablist" aria-label="Team screen">
              {([['roles', 'Roles'], ['setPieces', 'Set pieces'], ['squad', 'Squad']] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  onClick={() => setView(id)}
                  className={cn('rounded px-2.5 py-1 text-xs font-medium transition-colors', view === id ? 'bg-accent-400/15 text-fg ring-1 ring-inset ring-accent-500/50' : 'text-fg-muted hover:text-fg')}
                >{label}</button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {view === 'roles' && selected && (() => {
              const position = templateFor(selected.slot.slotId)?.position ?? selected.player.position
              const profile = roleProfile(slotRole(plan, selected.slot.slotId, position), position)
              return (
                <p className="mb-3 rounded-md border border-line bg-ink-900/60 px-2.5 py-2 text-[11px] leading-relaxed text-fg-muted">
                  <span className="font-medium text-fg">#{selected.player.number} {selected.player.name}</span>
                  {' — '}
                  <span data-testid="slot-role-help">{profile.description}</span>
                  <span className="ml-1.5 text-fg-faint">
                    Depth {profile.depth > 0 ? `+${profile.depth}` : profile.depth}m · {profile.lane} · press ×{profile.press.toFixed(2)}
                    {profile.supportOnly ? ' · holds behind the ball' : ''}
                  </span>
                </p>
              )
            })()}

            {view === 'roles' && (
              <div className="grid gap-4 sm:grid-cols-3">
                {UNITS.map((unit) => {
                  const rows = slotsWithPlayers.filter(({ slot }) => unitOf(templateFor(slot.slotId)?.position ?? 'CM') === unit.id)
                  return (
                    <div key={unit.id}>
                      <div className="mb-2 flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-fg">{unit.label}</span>
                        <span className="text-[10px] text-fg-faint">{unit.note}</span>
                      </div>
                      <div className="space-y-1.5">
                        {rows.map(({ slot, player }) => {
                          const position = templateFor(slot.slotId)?.position ?? player.position
                          const role = slotRole(plan, slot.slotId, position)
                          const profile = roleProfile(role, position)
                          return (
                            <div
                              key={slot.slotId}
                              className={cn('rounded-md border px-2 py-1.5', selected?.slot.slotId === slot.slotId ? 'border-accent-500/60 bg-accent-400/5' : 'border-line')}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedSlotId(slot.slotId)}
                                className="flex w-full items-center gap-1.5 text-left text-xs text-fg"
                              >
                                <span className="w-6 shrink-0 text-metric text-fg-muted">#{player.number}</span>
                                <span className="min-w-0 flex-1 truncate">{player.name}</span>
                                <span className="text-[10px] uppercase text-fg-faint">{position}</span>
                              </button>
                              <select
                                id={`role-${slot.slotId}`}
                                aria-label={`${player.name} role`}
                                title={profile.description}
                                value={role}
                                onChange={(e) => updateSlot(slot.slotId, { role: e.target.value })}
                                className="mt-1 h-7 w-full min-w-0 rounded border border-line-strong bg-ink-900 px-1.5 text-[11px] text-fg outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30"
                              >
                                {rolesForPosition(position).map((id) => (
                                  <option key={id} value={id}>{roleProfile(id, position).label}</option>
                                ))}
                              </select>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {view === 'setPieces' && (
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-fg-muted">Six-yard inswinger, screen, near-post flick, back-post runner, rest defence.</p>
                  <Button type="button" size="sm" variant="outline" onClick={autoSetPieces}><Sparkles /> Auto</Button>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {([['leftCorner', 'Left corner'], ['rightCorner', 'Right corner'], ['penalty', 'Penalty'], ['longFreeKick', 'Long free-kick'], ['shortFreeKick', 'Short free-kick'], ['primaryTarget', 'Aerial target'], ['secondaryTarget', 'Second target'], ['edgePlayer', 'Edge of box']] as const).map(([key, label]) => (
                    <label key={key} className="block min-w-0">
                      <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-fg-muted">{label}</span>
                      <select
                        id={`${team.id}-${key}`}
                        value={plan.setPieces[key]}
                        onChange={(e) => update({ ...plan, setPieces: { ...plan.setPieces, [key]: e.target.value, assignmentMode: 'manual' } })}
                        className="h-8 w-full min-w-0 rounded border border-line-strong bg-ink-900 px-1.5 text-[11px] text-fg outline-none focus:border-accent-500"
                      >
                        {slotsWithPlayers.map(({ player }) => <option key={player.id} value={player.id}>#{player.number} {player.name}</option>)}
                      </select>
                    </label>
                  ))}
                  <label className="block min-w-0">
                    <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-fg-muted">Attacking corner</span>
                    <select id={`${team.id}-attacking-corner`} value={plan.setPieces.attackingCorner} onChange={(e) => update({ ...plan, setPieces: { ...plan.setPieces, attackingCorner: e.target.value } })} className="h-8 w-full rounded border border-line-strong bg-ink-900 px-1.5 text-[11px] text-fg outline-none focus:border-accent-500">
                      {['Six-yard inswinger', 'Near-post flick', 'Back-post overload', 'Short corner', 'Edge-of-box cutback'].map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-fg-muted">Defending corners</span>
                    <select id={`${team.id}-defending-corner`} value={plan.setPieces.defendingCorner} onChange={(e) => update({ ...plan, setPieces: { ...plan.setPieces, defendingCorner: e.target.value } })} className="h-8 w-full rounded border border-line-strong bg-ink-900 px-1.5 text-[11px] text-fg outline-none focus:border-accent-500">
                      {['Hybrid', 'Zonal', 'Player marking', 'Near-post heavy'].map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            )}

            {view === 'squad' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg">Starting XI</div>
                  <div className="space-y-0.5">
                    {slotsWithPlayers.map(({ slot, player }) => {
                      const position = templateFor(slot.slotId)?.position ?? player.position
                      return (
                        <button key={slot.slotId} type="button" onClick={() => setSelectedSlotId(slot.slotId)} className={cn('flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs transition-colors', selected?.slot.slotId === slot.slotId ? 'bg-accent-400/10 text-fg ring-1 ring-inset ring-accent-500/60' : 'text-fg-muted hover:bg-ink-800 hover:text-fg')}>
                          <span className="w-6 shrink-0 text-metric">#{player.number}</span>
                          <span className="min-w-0 flex-1 truncate">{player.name}</span>
                          <span className="text-[10px] uppercase text-fg-faint">{position}</span>
                          <FormIcon form={player.form} />
                          <span className="w-6 text-right text-metric text-accent-300">{positionOverall(player, position)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg">Bench — 9</div>
                  <div className="space-y-0.5">
                    {bench.map((player) => (
                      <div key={player.id} className={cn('flex items-center gap-1.5 rounded px-1.5 py-1 text-xs', selectedBenchId === player.id ? 'bg-ink-800 ring-1 ring-inset ring-line-strong' : '')}>
                        <button type="button" onClick={() => setSelectedBenchId(player.id)} className="min-w-0 flex-1 truncate text-left text-fg-muted hover:text-fg">#{player.number} {player.name}</button>
                        <Button type="button" size="xs" variant="outline" onClick={() => swapStarterWithBench(player.id)}>Into XI</Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-fg-faint">Not in squad:</div>
                  <div className="mt-1 space-y-0.5">
                    {reserves.map((player) => (
                      <div key={player.id} className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] text-fg-muted">
                        <span className="min-w-0 flex-1 truncate">#{player.number} {player.name}</span>
                        <Button type="button" size="xs" variant="ghost" onClick={() => swapBenchWithReserve(player.id)}>To bench</Button>
                      </div>
                    ))}
                  </div>
                </div>
                {selected && (
                  <div className="sm:col-span-2 border-t border-line pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-fg">#{selected.player.number} {selected.player.name}</div>
                        <p className="mt-0.5 text-[11px] text-fg-muted">{selected.player.position} · {selected.player.age}y · {selected.player.heightCm}cm · {selected.player.foot === 'B' ? 'Both feet' : `${selected.player.foot} foot`}</p>
                      </div>
                      <Badge variant="outline" className="gap-1"><FormIcon form={selected.player.form} />{selected.player.form}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selected.player.stars.length ? selected.player.stars.map((s) => <Badge key={s} variant="accent">★ {s}</Badge>) : <span className="text-[11px] text-fg-muted">No special stars</span>}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                      {PES_ATTRIBUTE_LABELS.map(([key, label]) => {
                        const raw = selected.player.attributes[key]
                        const effective = typeof raw === 'number' ? Math.round(effectiveAttribute(selected.player, key)) : raw
                        return (
                          <div key={key} className="flex items-center justify-between gap-2 border-b border-line/60 pb-0.5">
                            <span className="text-fg-muted">{label}</span>
                            <span className="text-metric font-medium text-fg">{effective}{typeof raw === 'number' && effective !== raw ? <span className="ml-1 text-[10px] text-fg-muted">({raw})</span> : null}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
