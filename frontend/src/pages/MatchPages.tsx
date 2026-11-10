import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CalendarClock, ChevronLeft, ChevronRight, Crosshair, Download, FileText, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { InfoNote } from '@/components/shared/info-note'
import { ProvenanceBadge } from '@/components/shared/provenance'
import { Pitch, HexHeatPointLayer, toView } from '@/components/pitch/Pitch'
import { manualEventStore, matchNotesStore, newId, useStore } from '@/lib/store'
import { useData } from '@/state/data'
import { useSettings } from '@/state/settings'
import { averagePosition, eventHeatPoints, MIN_EVENTS_FOR_HEATMAP, type PitchPoint } from '@/lib/heatmap'
import type { MatchEvent, MatchEventType } from '@/types'
import { cn, fmtDate, GK_DOT_COLOR, readableTextOn } from '@/lib/utils'
import { DEMO_CUP_ID } from '@/data/generate'

/** Knockout round names for the demo cup (match.round 1–4). */
const CUP_ROUND_LABELS: Record<number, string> = {
  1: 'Round of 16',
  2: 'Quarter-final',
  3: 'Semi-final',
  4: 'Final',
}

const roundLabel = (match: { competitionId: string; round: number }): string =>
  match.competitionId === DEMO_CUP_ID ? CUP_ROUND_LABELS[match.round] ?? `Round ${match.round}` : `Matchday ${match.round}`

const EVENT_COLORS: Record<MatchEventType, string> = {
  goal: '#d4f93a',
  'own-goal': '#f2707f',
  'yellow-card': '#f5c445',
  'red-card': '#f2707f',
  substitution: '#5ca9f6',
  injury: '#fb923c',
  shot: '#8fdc2a',
  'chance-created': '#5ca9f6',
  turnover: '#f2707f',
  recovery: '#3ddc97',
  'progressive-carry': '#c084fc',
  pass: '#7cc0ff',
  'incomplete-pass': '#e08989',
}

const EVENT_LABELS: Record<MatchEventType, string> = {
  goal: 'Goal',
  'own-goal': 'Own goal',
  'yellow-card': 'Yellow card',
  'red-card': 'Red card',
  substitution: 'Substitution',
  injury: 'Injury',
  shot: 'Shot',
  'chance-created': 'Chance created',
  turnover: 'Turnover',
  recovery: 'Recovery',
  'progressive-carry': 'Progressive carry',
  pass: 'Pass (sample)',
  'incomplete-pass': 'Incomplete pass (sample)',
}

/* ------------------------------------------------------------------ */
/* Match detail                                                        */
/* ------------------------------------------------------------------ */

export function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data, teams, playerById } = useData()
  const { settings } = useSettings()

  const manualEvents = useStore(manualEventStore)
  const matchNotes = useStore(matchNotesStore)

  const [filterType, setFilterType] = useState<'all' | MatchEventType>('all')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [focusPlayerId, setFocusPlayerId] = useState<string>('none')

  /* Pitch view switch: raw events vs SofaScore-style average positions with
     per-player event-based heat maps on click. */
  const [pitchView, setPitchView] = useState<'events' | 'positions'>('events')
  const [heatPlayerId, setHeatPlayerId] = useState<string | null>(null)
  /* Average-positions view: starters by default; substitutes (with their own
     average positions) appear only when shown — the SofaScore convention. */
  const [showSubs, setShowSubs] = useState(false)

  /* Manual tagging form state */
  const [tagType, setTagType] = useState<MatchEventType>('turnover')
  const [tagMinute, setTagMinute] = useState(45)
  const [tagPlayer, setTagPlayer] = useState<string>('none')
  const [tagNote, setTagNote] = useState('')
  const [tagPos, setTagPos] = useState<{ x: number; y: number } | null>(null)

  const [notesDraft, setNotesDraft] = useState<string | null>(null)

  const match = data?.dataset.matches.find((m) => m.id === matchId)

  /* The route reuses this component when the matchId param changes (e.g. browser
     back/forward), so per-match working state must be reset — otherwise notes and
     tag drafts from one match can be saved against another. */
  useEffect(() => {
    setSelectedEventId(null)
    setFocusPlayerId('none')
    setPitchView('events')
    setHeatPlayerId(null)
    setShowSubs(false)
    setTagPos(null)
    setTagNote('')
    setNotesDraft(null)
  }, [matchId])

  const allEvents = useMemo(() => {
    if (!match) return []
    const provider = data?.dataset.events.filter((e) => e.matchId === match.id) ?? []
    const manual = manualEvents.filter((e) => e.matchId === match.id)
    return [...provider, ...manual].sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id))
  }, [match, data, manualEvents])

  const lineupPlayers = useMemo(() => {
    if (!match || !data) return []
    return data.dataset.playerMatchMinutes
      .filter((r) => r.matchId === match.id)
      .map((r) => ({ row: r, player: playerById(r.playerId) }))
      .filter((x): x is { row: (typeof data.dataset.playerMatchMinutes)[number]; player: NonNullable<ReturnType<typeof playerById>> } => !!x.player)
  }, [match, data, playerById])

  /* Positioned events (provider DEMO + your MANUAL tags) — the only honest
     basis for positional overlays in this phase (no tracking data exists). */
  const positionedEvents = useMemo(
    () => allEvents.filter((e) => e.x !== undefined && e.y !== undefined),
    [allEvents],
  )

  /* Per-player mean position of positioned events (SofaScore-style average
     positions). Players without positioned events simply have no dot. */
  const playerAverages = useMemo(() => {
    const pointsByPlayer = new Map<string, PitchPoint[]>()
    for (const e of positionedEvents) {
      if (!e.playerId) continue
      const list = pointsByPlayer.get(e.playerId)
      if (list) list.push({ x: e.x!, y: e.y! })
      else pointsByPlayer.set(e.playerId, [{ x: e.x!, y: e.y! }])
    }
    const averages = new Map<string, { avg: PitchPoint; n: number }>()
    for (const [pid, pts] of pointsByPlayer) {
      const avg = averagePosition(pts)
      if (avg) averages.set(pid, { avg, n: pts.length })
    }
    return averages
  }, [positionedEvents])

  const heatEvents = useMemo(
    () => (heatPlayerId ? positionedEvents.filter((e) => e.playerId === heatPlayerId) : []),
    [positionedEvents, heatPlayerId],
  )
  const heatPoints = useMemo(() => eventHeatPoints(heatEvents), [heatEvents])

  if (!data || !match) {
    return (
      <div className="space-y-5">
        <PageHeader title="Match analysis" />
        <EmptyState
          icon={CalendarClock}
          title="Match not found or data unavailable"
          description={settings.demoMode ? 'This match record does not exist in the loaded dataset.' : 'Demo data is disabled and no data source is connected.'}
          showSettingsAction={!settings.demoMode}
        />
      </div>
    )
  }

  const home = teams.find((t) => t.id === match.homeTeamId)!
  const away = teams.find((t) => t.id === match.awayTeamId)!
  const returnTo = searchParams.get('returnTo')
  const backToMatches = returnTo && returnTo.startsWith('/matches') ? returnTo : '/matches'
  const visibleEvents = allEvents.filter((e) => (filterType === 'all' ? true : e.type === filterType))
  const selectedEvent = allEvents.find((e) => e.id === selectedEventId) ?? null
  const focusedPlayer = focusPlayerId === 'none' ? null : playerById(focusPlayerId) ?? null
  const heatPlayer = heatPlayerId ? playerById(heatPlayerId) ?? null : null
  const focusedEvents = focusedPlayer
    ? visibleEvents.filter((e) => e.playerId === focusPlayerId || e.secondaryPlayerId === focusPlayerId)
    : visibleEvents

  /* Players with an average position, in lineup order — the cycling order for
     the heat map view's prev/next arrows (SofaScore-style player switcher). */
  /* Minute each substitute came on, from stored substitution events.
     Plain computation (not a hook) — this sits below the component's
     not-found early return, so hooks are not allowed here. */
  const subOnMinute = new Map<string, number>()
  for (const e of allEvents) if (e.type === 'substitution' && e.secondaryPlayerId) subOnMinute.set(e.secondaryPlayerId, e.minute)

  const heatCycle = lineupPlayers
    .filter(({ player, row }) => playerAverages.has(player.id) && (row.starter || showSubs))
    .map(({ player }) => player.id)
  const heatIndex = heatPlayerId ? heatCycle.indexOf(heatPlayerId) : -1
  const cycleHeat = (dir: 1 | -1) => {
    if (heatCycle.length === 0 || heatIndex < 0) return
    setHeatPlayerId(heatCycle[(heatIndex + dir + heatCycle.length) % heatCycle.length]!)
  }
  const heatPlayerColor = !heatPlayer
    ? home.color
    : heatPlayer.position === 'GK'
      ? GK_DOT_COLOR
      : heatPlayer.teamId === match.homeTeamId
        ? home.color
        : away.color

  const addManualEvent = () => {
    if (!tagPos) return
    const event: MatchEvent = {
      id: newId('me'),
      matchId: match.id,
      minute: Math.max(1, Math.min(90, tagMinute)),
      type: tagType,
      // Attribute the tag to the tagged player's team (home team as fallback) so
      // pitch rings and reports don't misattribute away-team players.
      teamId:
        tagPlayer !== 'none'
          ? playerById(tagPlayer)?.teamId ?? match.homeTeamId
          : match.homeTeamId,
      playerId: tagPlayer === 'none' ? undefined : tagPlayer,
      x: tagPos.x,
      y: tagPos.y,
      note: tagNote.trim() || undefined,
      provenance: 'MANUAL',
    }
    manualEventStore.set((prev) => [...prev, event])
    setTagNote('')
    setTagPos(null)
    setSelectedEventId(event.id)
  }

  const saveNotes = () => {
    matchNotesStore.set((prev) => ({ ...prev, [match.id]: notesDraft ?? '' }))
  }

  const exportReport = () => {
    const notes = (notesDraft ?? matchNotes[match.id] ?? '').trim()
    const lines = [
      `# Match report — ${home.name} ${match.homeGoals}–${match.awayGoals} ${away.name}`,
      '',
      `- Competition: ${data.dataset.competitions.find((c) => c.id === match.competitionId)?.name ?? data.dataset.competition.name} (demo) — ${data.dataset.seasons.find((s) => s.id === match.seasonId)?.label ?? data.dataset.season.label}`,
      `- ${roundLabel(match)} · ${fmtDate(match.kickoff)} · ${match.venue}`,
      `- Provenance: DEMO (fictional records)${manualEvents.some((e) => e.matchId === match.id) ? ' + MANUAL (your tags)' : ''}`,
      `- Possession: ${match.possessionHome}% – ${100 - match.possessionHome}% · Shots ${match.shotsHome}–${match.shotsAway}`,
      '',
      '## Events',
      ...allEvents.map(
        (e) =>
          `- ${e.minute}' [${EVENT_LABELS[e.type]}] ${teams.find((t) => t.id === e.teamId)?.shortName ?? ''}` +
          `${e.playerId ? ` ${playerById(e.playerId)?.name ?? ''}` : ''}` +
          `${e.secondaryPlayerId ? ` (→ ${playerById(e.secondaryPlayerId)?.name ?? ''})` : ''}` +
          `${e.value !== undefined ? ` · xG ${e.value.toFixed(2)}` : ''}` +
          `${e.note ? ` — ${e.note}` : ''} [${e.provenance}]`,
      ),
      '',
      ...(notes ? ['## Tactical notes', notes, ''] : []),
      '## Limitations',
      '- All records are fictional demo data; no video analysis pipeline exists in this phase.',
      '- Manual tags are stored locally in this browser and labelled MANUAL.',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `match-report-${match.id}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const notesValue = notesDraft ?? matchNotes[match.id] ?? ''

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${home.name} ${match.homeGoals}–${match.awayGoals} ${away.name}`}
        description={`${data.dataset.competitions.find((c) => c.id === match.competitionId)?.name ?? data.dataset.competition.name} · ${roundLabel(match)} · ${fmtDate(match.kickoff)} · ${match.venue}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to={backToMatches}>← Back to matches</Link>
            </Button>
            <Button size="sm" variant="secondary" onClick={exportReport}>
              <Download aria-hidden />
              Export report
            </Button>
          </div>
        }
      />

      {/* Metadata + possession */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
          <div>
            <div className="text-label">Possession (demo)</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-metric text-sm font-semibold" style={{ color: home.color }}>{match.possessionHome}%</span>
              <div className="h-2 w-40 overflow-hidden rounded-full bg-ink-700">
                <div className="h-full" style={{ width: `${match.possessionHome}%`, backgroundColor: home.color }} />
              </div>
              <span className="text-metric text-sm font-semibold" style={{ color: away.color }}>{100 - match.possessionHome}%</span>
            </div>
          </div>
          <div>
            <div className="text-label">Shots (demo)</div>
            <p className="text-metric mt-1 text-sm text-fg">{match.shotsHome} – {match.shotsAway}</p>
          </div>
          <div>
            <div className="text-label">Data provenance</div>
            <div className="mt-1 flex items-center gap-2">
              <ProvenanceBadge provenance="DEMO" />
              {manualEvents.some((e) => e.matchId === match.id) && <ProvenanceBadge provenance="MANUAL" />}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Event timeline</CardTitle>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={cn(
                'rounded px-2 py-1 text-[11px] font-medium',
                filterType === 'all' ? 'bg-accent-500 text-on-bright' : 'bg-ink-800 text-fg-muted hover:bg-ink-700',
              )}
            >
              All
            </button>
            {(Object.keys(EVENT_LABELS) as MatchEventType[])
              .filter((t) => allEvents.some((e) => e.type === t))
              .map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={cn(
                    'rounded px-2 py-1 text-[11px] font-medium',
                    filterType === t ? 'bg-accent-500 text-on-bright' : 'bg-ink-800 text-fg-muted hover:bg-ink-700',
                  )}
                >
                  {EVENT_LABELS[t]}
                </button>
              ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative h-14 rounded-md panel-border bg-ink-900/60">
            <div className="absolute left-1/2 top-0 h-full w-px bg-line-strong" />
            {visibleEvents.map((e) => {
              const dense = visibleEvents.length > 60
              const dot = dense ? 7 : 10
              return (
              <button
                key={e.id}
                type="button"
                title={`${e.minute}' ${EVENT_LABELS[e.type]}${e.playerId ? ` — ${playerById(e.playerId)?.name ?? ''}` : ''} [${e.provenance}]`}
                aria-label={`${e.minute} minutes, ${EVENT_LABELS[e.type]}`}
                onClick={() => setSelectedEventId(e.id)}
                className="absolute top-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
                style={{
                  left: `calc(${(e.minute / 90) * 100}% - ${dot / 2}px)`,
                  width: dot,
                  height: dot,
                  backgroundColor: EVENT_COLORS[e.type],
                  opacity: selectedEventId === e.id ? 1 : dense ? 0.55 : 0.75,
                  outline: e.provenance === 'MANUAL' ? '2px solid #d4f93a' : 'none',
                  outlineOffset: 1,
                }}
              />
              )
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-fg-faint">
            <span>0'</span><span>45'</span><span>90'</span>
          </div>
          <p className="mt-2 text-[11px] text-fg-faint">
            Home team events shown from the left. Green outline = your manual tags (MANUAL); all other events
            are demo provider events (DEMO). {visibleEvents.length} events shown.
          </p>

          {selectedEvent && (
            <div className="mt-3 rounded-md border border-line-strong bg-ink-900/70 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-metric font-semibold text-fg">{selectedEvent.minute}'</span>
                <Badge variant="default" className="normal-case">{EVENT_LABELS[selectedEvent.type]}</Badge>
                {selectedEvent.playerId && (
                  <button
                    type="button"
                    onClick={() => setFocusPlayerId(selectedEvent.playerId!)}
                    className="inline-flex items-center gap-1 font-medium text-accent-300 hover:underline"
                    title="Show this player's event positions on the pitch"
                  >
                    <Crosshair className="h-3 w-3" aria-hidden />
                    {playerById(selectedEvent.playerId)?.name}
                  </button>
                )}
                {selectedEvent.playerId && (
                  <Link
                    to={`/players/${selectedEvent.playerId}`}
                    className="text-fg-faint hover:text-accent-300 hover:underline"
                    title="Open the full player profile"
                  >
                    Profile →
                  </Link>
                )}
                {selectedEvent.secondaryPlayerId && (
                  <button
                    type="button"
                    onClick={() => setFocusPlayerId(selectedEvent.secondaryPlayerId!)}
                    className="inline-flex items-center gap-1 text-fg-muted hover:underline"
                    title="Show this player's event positions on the pitch"
                  >
                    → {playerById(selectedEvent.secondaryPlayerId)?.name}
                  </button>
                )}
                {selectedEvent.value !== undefined && (
                  <span className="text-metric text-fg-muted">xG {selectedEvent.value.toFixed(2)}</span>
                )}
                <ProvenanceBadge provenance={selectedEvent.provenance} />
                {selectedEvent.provenance === 'MANUAL' && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      manualEventStore.set((prev) => prev.filter((e) => e.id !== selectedEvent.id))
                      setSelectedEventId(null)
                    }}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                    Delete tag
                  </Button>
                )}
              </div>
              {selectedEvent.note && <p className="mt-1.5 text-xs text-fg-muted">{selectedEvent.note}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pitch visualisation */}
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Pitch visualisation</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="tablist"
                aria-label="Pitch view"
                className="flex rounded-md panel-border bg-ink-900 p-0.5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={pitchView === 'events'}
                  onClick={() => { setPitchView('events'); setHeatPlayerId(null) }}
                  className={cn(
                    'rounded px-2.5 py-1 text-[11px] font-medium',
                    pitchView === 'events' ? 'bg-accent-500 text-on-bright' : 'text-fg-muted hover:bg-ink-700',
                  )}
                >
                  Events
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={pitchView === 'positions'}
                  onClick={() => { setPitchView('positions'); setHeatPlayerId(null) }}
                  className={cn(
                    'rounded px-2.5 py-1 text-[11px] font-medium',
                    pitchView === 'positions' ? 'bg-accent-500 text-on-bright' : 'text-fg-muted hover:bg-ink-700',
                  )}
                >
                  Average positions
                </button>
              </div>
              {pitchView === 'positions' && (
                <button
                  type="button"
                  aria-pressed={showSubs}
                  onClick={() => setShowSubs((v) => !v)}
                  className={cn(
                    'rounded px-2.5 py-1.5 text-[11px] font-medium',
                    showSubs ? 'bg-accent-500 text-on-bright' : 'bg-ink-800 text-fg-muted hover:bg-ink-700',
                  )}
                >
                  {showSubs ? 'Hide subs' : 'Show subs'}
                </button>
              )}
              {pitchView === 'events' && (
                <div className="flex w-60 flex-col gap-1">
                  <Label htmlFor="mv-focus">Focus player</Label>
                  <Select value={focusPlayerId} onValueChange={setFocusPlayerId}>
                    <SelectTrigger id="mv-focus">
                      <SelectValue placeholder="All players" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All players</SelectItem>
                      {lineupPlayers.map(({ player }) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.name} · {player.position}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {pitchView === 'events' ? (
              <>
            <Pitch ariaLabel="Match event positions">
              {focusedPlayer &&
                focusedEvents
                  .filter((e) => e.x !== undefined && e.y !== undefined)
                  .map((e) => {
                    const v = toView(e.x!, e.y!)
                    return (
                      <g key={`heat-${e.id}`} aria-hidden>
                        <circle cx={v.x} cy={v.y} r={6} fill={EVENT_COLORS[e.type]} opacity={0.13} />
                        <circle cx={v.x} cy={v.y} r={3} fill={EVENT_COLORS[e.type]} opacity={0.22} />
                      </g>
                    )
                  })}
              {focusedEvents
                .filter((e) => e.x !== undefined && e.y !== undefined)
                .map((e) => {
                  const v = toView(e.x!, e.y!)
                  const isHome = e.teamId === match.homeTeamId
                  return (
                    <circle
                      key={e.id}
                      cx={v.x}
                      cy={v.y}
                      r={selectedEventId === e.id ? 2.4 : 1.5}
                      fill={EVENT_COLORS[e.type]}
                      opacity={selectedEventId === e.id ? 1 : 0.65}
                      stroke={isHome ? home.color : away.color}
                      strokeWidth={selectedEventId === e.id ? 0.8 : 0.4}
                      className="cursor-pointer"
                      onPointerDown={() => setSelectedEventId(e.id)}
                    />
                  )
                })}
            </Pitch>
            {focusedPlayer ? (
              <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
                Focused: <span className="font-medium text-fg-muted">{focusedPlayer.name}</span> —{' '}
                {focusedEvents.length} tagged events in this match (
                {focusedEvents.filter((e) => e.x !== undefined).length} with positions). This event-position
                map is built from demo provider events only: a true positional heat map requires tracking
                data, which no connected source currently provides.{' '}
                <ProvenanceBadge provenance="DEMO" compact />
              </p>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
                Event positions use normalised pitch coordinates (home team attacks left → right). Fill colour =
                event type; ring colour = team. Click a player name in an event, or select one above, to see
                their event positions for this match. Manual tags are highlighted in the timeline and carry the
                MANUAL provenance label.
              </p>
            )}
              </>
            ) : (
              <>
                <Pitch
                  ariaLabel={`Average positions of positioned events${
                    heatPlayer ? ` — showing heat map for ${heatPlayer.name}` : ''
                  }`}
                  onBackgroundClick={() => setHeatPlayerId(null)}
                >
                  {(['home', 'away'] as const).flatMap((side) =>
                    lineupPlayers
                      .filter(
                        ({ player, row }) =>
                          (side === 'home' ? player.teamId === match.homeTeamId : player.teamId === match.awayTeamId) &&
                          (row.starter || showSubs),
                      )
                      .map(({ player, row }) => {
                        const entry = playerAverages.get(player.id)
                        if (!entry) return null
                        const v = toView(entry.avg.x, entry.avg.y)
                        const isGk = player.position === 'GK'
                        const fill = isGk ? GK_DOT_COLOR : side === 'home' ? home.color : away.color
                        const selected = player.id === heatPlayerId
                        return (
                          <g
                            key={player.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`${player.name}${
                              row.starter ? '' : `, substitute, on at ${subOnMinute.get(player.id) ?? '—'} minutes`
                            }, average position from ${entry.n} positioned events — ${
                              selected ? 'hide' : 'show'
                            } heat map`}
                            className="cursor-pointer outline-none"
                            onClick={(e) => {
                              e.stopPropagation() // clicking a dot must not clear via the turf
                              setHeatPlayerId(selected ? null : player.id)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setHeatPlayerId(selected ? null : player.id)
                              }
                            }}
                          >
                            {/* Starters: plain team-colour dot, no ring. Substitutes:
                                slightly smaller with a dashed white ring (SofaScore-style). */}
                            <circle
                              cx={v.x}
                              cy={v.y}
                              r={row.starter ? 2.3 : 1.95}
                              fill={fill}
                              stroke={row.starter ? 'none' : '#ffffff'}
                              strokeWidth={row.starter ? 0 : 0.45}
                              strokeDasharray={row.starter ? undefined : '1.1 0.8'}
                              opacity={row.starter ? 1 : 0.95}
                            />
                            <text
                              x={v.x}
                              y={v.y + 0.1}
                              fontSize={row.starter ? 1.85 : 1.6}
                              fontWeight={800}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill={readableTextOn(fill)}
                              style={{ pointerEvents: 'none' }}
                            >
                              {player.shirtNumber ?? '–'}
                            </text>
                          </g>
                        )
                      }),
                  )}
                  {/* Same hexagonal density map as Game Mode's post-match
                      report: drawn above the average-position markers and
                      pointer-transparent, so the dots underneath stay
                      clickable while a genuinely broad event spread is
                      allowed to overshadow them. */}
                  <HexHeatPointLayer points={heatPoints} />
                  <g aria-hidden pointerEvents="none">
                    {heatEvents.map((e) => {
                      const v = toView(e.x!, e.y!)
                      return <circle key={e.id} cx={v.x} cy={v.y} r={0.62} fill={EVENT_COLORS[e.type]} />
                    })}
                  </g>
                  {heatPlayer && playerAverages.get(heatPlayer.id) && (
                    (() => {
                      const selectedAvg = playerAverages.get(heatPlayer.id)!.avg
                      const v = toView(selectedAvg.x, selectedAvg.y)
                      return (
                        <g aria-hidden pointerEvents="none">
                          <circle cx={v.x} cy={v.y} r={2.45} fill={heatPlayerColor} stroke="#ffffff" strokeWidth={0.45} />
                          <text
                            x={v.x}
                            y={v.y + 0.1}
                            fontSize={1.85}
                            fontWeight={800}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill={readableTextOn(heatPlayerColor)}
                          >
                            {heatPlayer.shirtNumber ?? '–'}
                          </text>
                        </g>
                      )
                    })()
                  )}
                </Pitch>

                {/* Selection bar replaces the legend while a player is selected */}
                {heatPlayer && heatPlayerId ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="xs" aria-label="Previous player" onClick={() => cycleHeat(-1)}>
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                      </Button>
                      <span
                        aria-hidden
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                        style={{ backgroundColor: heatPlayerColor, color: readableTextOn(heatPlayerColor) }}
                      >
                        {heatPlayer.shirtNumber ?? heatPlayer.position}
                      </span>
                      <div className="leading-tight">
                        <div className="text-sm font-medium text-fg">{heatPlayer.name}</div>
                        <div className="text-[11px] text-fg-faint">
                          {heatPlayer.position} ·{' '}
                          {lineupPlayers.find(({ player }) => player.id === heatPlayer.id)?.row.minutes ?? '—'}' ·{' '}
                          {heatEvents.length} positioned events
                        </div>
                      </div>
                      <Button variant="outline" size="xs" aria-label="Next player" onClick={() => cycleHeat(1)}>
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="xs"
                      aria-label="Close heat map"
                      onClick={() => setHeatPlayerId(null)}
                    >
                      ×
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-fg-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: home.color }} aria-hidden />
                      {home.name}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-fg-faint">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: GK_DOT_COLOR }} aria-hidden />
                      goalkeepers
                    </span>
                    {showSubs && (
                      <span className="inline-flex items-center gap-1.5 text-fg-faint">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full bg-transparent"
                          style={{ border: '1.5px dashed #ffffff' }}
                          aria-hidden
                        />
                        substitutes (dashed ring)
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      {away.name}
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: away.color }} aria-hidden />
                    </span>
                  </div>
                )}

                {/* Player lists — click a name to show or swap that player's heat map */}
                <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                  {(['home', 'away'] as const).map((side) => {
                    const color = side === 'home' ? home.color : away.color
                    const rows = lineupPlayers.filter(({ player }) =>
                      side === 'home' ? player.teamId === match.homeTeamId : player.teamId === match.awayTeamId,
                    )
                    return (
                      <div key={side}>
                        <div className="text-label mb-1">{side === 'home' ? home.shortName : away.shortName}</div>
                        <ul className="flex flex-col">
                          {rows.map(({ player, row }) => {
                            const entry = playerAverages.get(player.id)
                            const selected = player.id === heatPlayerId
                            return (
                              <li key={player.id}>
                                <button
                                  type="button"
                                  disabled={!entry}
                                  onClick={entry ? () => setHeatPlayerId(selected ? null : player.id) : undefined}
                                  aria-label={`${player.name}, ${
                                    entry
                                      ? `${entry.n} positioned events — ${selected ? 'hide' : 'show'} heat map`
                                      : 'no positioned events in this match'
                                  }`}
                                  className={cn(
                                    'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs',
                                    entry ? 'hover:bg-ink-800' : 'cursor-default opacity-45',
                                    selected && 'bg-ink-800',
                                  )}
                                >
                                  <span
                                    aria-hidden
                                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                                    style={{
                                      backgroundColor: player.position === 'GK' ? GK_DOT_COLOR : color,
                                      color: readableTextOn(player.position === 'GK' ? GK_DOT_COLOR : color),
                                    }}
                                  >
                                    {player.shirtNumber ?? '–'}
                                  </span>
                                  <span className={cn('truncate', selected ? 'text-fg' : 'text-fg-muted')}>
                                    {player.name}
                                  </span>
                                  <span className="ml-auto shrink-0 text-[10px] text-fg-faint">
                                    {player.position} · {row.minutes}'
                                    {!row.starter && subOnMinute.has(player.id)
                                      ? ` · on ${subOnMinute.get(player.id)}'`
                                      : ''}
                                  </span>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>

                {heatPlayer && heatPlayerId ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
                    Event-based heat map: hexagons in true pitch metres, binned over {heatEvents.length} positioned events
                    ({heatPoints.length} registered samples; progressive carries include their midpoint and end point) for{' '}
                    <span className="font-medium text-fg-muted">{heatPlayer.name}</span> — an approximation from
                    sparse event data, <span className="text-fg-muted">not player tracking data</span>. The
                    hexagonal layer is drawn above the other average-position markers, so a broad spread can
                    legitimately overshadow nearby players. Sample size: {heatEvents.length} events.{' '}
                    <ProvenanceBadge provenance="DEMO" compact />
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
                    Each dot marks a player's mean position across their positioned events ({playerAverages.size}{' '}
                    shown). Home attacks left → right. Click a dot or a name for that player's event-based heat
                    map — an estimate from event data, not player tracking data.{' '}
                    <ProvenanceBadge provenance="DEMO" compact />
                  </p>
                )}
                {heatPlayerId && heatEvents.length < MIN_EVENTS_FOR_HEATMAP && (
                  <p className="mt-1 text-[11px] font-medium text-[#f5c445]">
                    Small sample ({heatEvents.length} of {MIN_EVENTS_FOR_HEATMAP}+ events): this heat map is
                    indicative only — more events would be needed for a reliable density estimate.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Manual tagging */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-fg-faint" aria-hidden />
              Manual event tagging
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="mt-type">Event type</Label>
                <Select value={tagType} onValueChange={(v) => setTagType(v as MatchEventType)}>
                  <SelectTrigger id="mt-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(EVENT_LABELS) as MatchEventType[])
                      .filter((t) => t !== 'substitution' && t !== 'own-goal' && t !== 'pass' && t !== 'incomplete-pass')
                      .map((t) => <SelectItem key={t} value={t}>{EVENT_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="mt-minute">Minute</Label>
                <Input id="mt-minute" type="number" min={1} max={90} value={tagMinute}
                  onChange={(e) => setTagMinute(Number(e.target.value) || 1)} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="mt-player">Player (from this match)</Label>
              <Select value={tagPlayer} onValueChange={setTagPlayer}>
                <SelectTrigger id="mt-player"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {lineupPlayers.map(({ row, player }) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.name} · {player.position} · {row.minutes}'
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="mt-note">Note</Label>
              <Input id="mt-note" value={tagNote} onChange={(e) => setTagNote(e.target.value)}
                placeholder="What did you observe?" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Position — click the pitch below</Label>
              <div className="overflow-hidden rounded-md panel-border">
                <Pitch ariaLabel="Click to set the event position" striped={false}>
                  <rect
                    x={0} y={0} width={105} height={68} fill="transparent"
                    onPointerDown={(e) => {
                      const svg = (e.target as SVGRectElement).ownerSVGElement
                      if (!svg) return
                      const pt = svg.createSVGPoint()
                      pt.x = e.clientX
                      pt.y = e.clientY
                      const ctm = svg.getScreenCTM()
                      if (!ctm) return
                      const p = pt.matrixTransform(ctm.inverse())
                      setTagPos({ x: Math.max(0, Math.min(100, (p.x / 105) * 100)), y: Math.max(0, Math.min(100, (p.y / 68) * 100)) })
                    }}
                    style={{ cursor: 'crosshair' }}
                  />
                  {tagPos && (
                    <circle cx={toView(tagPos.x, tagPos.y).x} cy={toView(tagPos.x, tagPos.y).y} r={2.2}
                      fill="#d4f93a" stroke="#0d1424" strokeWidth={0.5} />
                  )}
                </Pitch>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-fg-faint">
                {tagPos ? `Position (${tagPos.x.toFixed(0)}, ${tagPos.y.toFixed(0)})` : 'No position selected yet.'}
              </span>
              <Button size="sm" onClick={addManualEvent} disabled={!tagPos}>
                Add manual tag
              </Button>
            </div>
            <InfoNote variant="scope">
              Manual tags are validated (minute 1–90, type, position) and stored locally with the MANUAL
              provenance label. They are visually distinct from provider events and can be deleted.
            </InfoNote>
          </CardContent>
        </Card>
      </div>

      {/* Tactical notes */}
      <Card>
        <CardHeader>
          <CardTitle>Tactical notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={notesValue}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Observations about structure, pressing triggers, set pieces…"
            aria-label="Tactical notes for this match"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-fg-faint">
              Saved locally per match (MANUAL). Included in the exported report.
            </span>
            <Button size="sm" onClick={saveNotes} disabled={notesDraft === null}>
              Save notes
            </Button>
          </div>
        </CardContent>
      </Card>

      <InfoNote variant="warning" title="Scope of this module in Phase 1">
        No automated video analysis exists: there is no video upload, frame extraction, player tracking or
        automatic event detection, and none is claimed. Event categories are: provider-supplied (DEMO in this
        build), manually tagged (MANUAL), and — from later phases — automatically detected and human-verified,
        each with distinct provenance labels.
      </InfoNote>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate(backToMatches)}>
          ← Back to matches
        </Button>
      </div>
    </div>
  )
}
