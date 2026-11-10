import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ClipboardPen,
  Copy,
  Footprints,
  Move,
  Save,
  Trash2,
} from 'lucide-react'
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
import { Tooltip as RadixTooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { PageHeader } from '@/components/shared/page-header'
import { InfoNote } from '@/components/shared/info-note'
import { ProvenanceBadge } from '@/components/shared/provenance'
import { PITCH_VIEW, Pitch, svgToPitch, toView } from '@/components/pitch/Pitch'
import { DEFAULT_TACTICAL_COLORS, newId, scenarioStore, tacticalColorsStore, useStore } from '@/lib/store'
import { useData } from '@/state/data'
import { FORMATIONS, FORMATION_SLOTS } from '@/data/reference'
import type {
  Position,
  ScenarioAction,
  ScenarioPlayer,
  TacticalActionType,
  TacticalScenario,
} from '@/types'
import { cn, readableTextOn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Formation presets                                                   */
/* ------------------------------------------------------------------ */

/**
 * Formation layout follows the match-analysis average-position concept
 * (SofaScore-style): keeper on the goal line, banks spread across the width,
 * the outfield block compact around the middle third of the pitch.
 * `spread` separates players fielded in the same position (CB pair, midfield
 * three, strike pair) into distinct banks instead of one blob.
 */
const LAB_BASE: Record<Position, { x: number; y: number; spread: number }> = {
  GK: { x: 6, y: 50, spread: 0 },
  CB: { x: 33, y: 50, spread: 13 },
  LB: { x: 45, y: 81, spread: 0 },
  RB: { x: 45, y: 19, spread: 0 },
  WB: { x: 50, y: 84, spread: 0 },
  DM: { x: 43, y: 50, spread: 9 },
  CM: { x: 51, y: 50, spread: 13 },
  LMF: { x: 51, y: 86, spread: 0 },
  RMF: { x: 51, y: 14, spread: 0 },
  AM: { x: 58, y: 50, spread: 13 },
  LW: { x: 63, y: 87, spread: 0 },
  RW: { x: 63, y: 13, spread: 0 },
  SS: { x: 62, y: 50, spread: 0 },
  CF: { x: 66, y: 50, spread: 0 },
  ST: { x: 67, y: 50, spread: 13 },
}

/** The defending block sits this much deeper (toward its own goal) than a
    straight mirror, so the two teams' lines engage instead of printing on
    top of each other. */
const DEFENCE_OFFSET = 8

function formationPlayers(formation: string, side: 'attack' | 'defence'): ScenarioPlayer[] {
  const slots = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS['4-3-3']!
  const totals = new Map<Position, number>()
  const seen = new Map<Position, number>()
  for (const s of slots) totals.set(s, (totals.get(s) ?? 0) + 1)

  return slots.map((slot, i) => {
    const occ = seen.get(slot) ?? 0
    seen.set(slot, occ + 1)
    const total = totals.get(slot) ?? 1
    const base = LAB_BASE[slot]
    const defence = side === 'defence'
    // Defenders attack the other way: a full 180° rotation (like real match
    // maps), so their right-back shares a flank with the opposing left-back.
    // The outfield also sits slightly deeper so the blocks engage, not stack.
    const x = defence && slot !== 'GK'
      ? Math.min(96, 100 - base.x + DEFENCE_OFFSET)
      : base.x
    const yRaw = base.y + (occ - (total - 1) / 2) * base.spread
    return {
      id: `${side}-${i}`,
      label: slot,
      x,
      y: defence ? 100 - yRaw : yRaw,
    }
  })
}

/* Token colours are user-configurable (Team colours section, persisted):
   defaults — attacking white, defending dark blue, keepers amber. */

const ACTION_STYLES: Record<TacticalActionType, { stroke: string; dash?: string; label: string }> = {
  pass: { stroke: '#d4f93a', label: 'Pass' },
  carry: { stroke: '#8fdc2a', dash: '4 2.5', label: 'Carry' },
  run: { stroke: '#ecf1fb', dash: '1.5 2.5', label: 'Run' },
  movement: { stroke: '#8b97ad', dash: '0.5 2', label: 'Movement' },
}

/** Classic-football read: a tiny pentagon for the ball's centre. */
function pentagonPath(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`
  })
  return `M ${pts.join(' L ')} z`
}

type Tool = 'select' | TacticalActionType

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function TacticalLabPage() {
  const { data, playerById } = useData()
  const colors = useStore(tacticalColorsStore)
  const [searchParams, setSearchParams] = useSearchParams()
  const userScenarios = useStore(scenarioStore)
  const demoScenarios = data?.content.demoScenarios ?? []

  const allScenarios = [...demoScenarios, ...userScenarios]

  const [working, setWorking] = useState<TacticalScenario | null>(null)
  const [workingIsUserOwned, setWorkingIsUserOwned] = useState(false)
  const [tool, setTool] = useState<Tool>('select')
  const [pendingStart, setPendingStart] = useState<{ x: number; y: number } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)
  const [ghostScenarioId, setGhostScenarioId] = useState<string>('none')

  const svgRef = useRef<SVGSVGElement | null>(null)
  const previewRef = useRef<SVGLineElement | null>(null)
  /* Live drag bookkeeping. While a token is grabbed we never touch React
     state at pointer-move frequency — the token is translated directly via
     its transform attribute (zero re-renders), and the final position is
     committed in a single state update on release. */
  const dragRef = useRef<{
    kind: 'player' | 'ball'
    id: string
    el: SVGGElement
    startX: number
    startY: number
    origX: number
    origY: number
    lastX?: number
    lastY?: number
  } | null>(null)

  /* Load scenario from query param. Re-runs when the dataset arrives, because on
     a cold load the data (and its demo scenarios) is still null at mount time —
     but only while nothing is open, so it never clobbers the working copy. */
  useEffect(() => {
    const id = searchParams.get('scenario')
    if (!id || working !== null) return
    const found = [...demoScenarios, ...userScenarios].find((sc) => sc.id === id)
    if (!found) return
    setWorking(structuredClone(found))
    setWorkingIsUserOwned(userScenarios.some((sc) => sc.id === id))
  }, [searchParams, demoScenarios, userScenarios, working])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingStart(null)
        setSelectedActionId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* Auto-save edits to user-owned scenarios (debounced) so navigating away never
     silently loses work. Demo seeds keep the explicit Save-creates-your-copy flow. */
  useEffect(() => {
    if (!working || !workingIsUserOwned) return
    const t = window.setTimeout(() => {
      scenarioStore.set((prev) => {
        const exists = prev.some((sc) => sc.id === working.id)
        return exists
          ? prev.map((sc) => (sc.id === working.id ? { ...working, updatedAt: new Date().toISOString() } : sc))
          : [...prev, working]
      })
    }, 400)
    return () => window.clearTimeout(t)
  }, [working, workingIsUserOwned])

  /* The ball sits at the end of the last ball-moving action (pass / carry),
     otherwise at the attacking keeper's feet. Dragging it, or finishing a
     pass / carry, stores an explicit position on the scenario. */
  const ballPos = useMemo(() => {
    if (!working) return null
    if (working.ball) return working.ball
    const lastBallAction = [...working.actions]
      .sort((a, b) => a.order - b.order)
      .filter((a) => a.type === 'pass' || a.type === 'carry')
      .pop()
    if (lastBallAction) return lastBallAction.to
    const gk = working.attack.players.find((pl) => pl.label.includes('GK'))
    return gk ? { x: Math.min(98, gk.x + 3.2), y: gk.y - 2 } : { x: 50, y: 50 }
  }, [working])

  const ghostScenario = useMemo(
    () => (ghostScenarioId === 'none' ? null : allScenarios.find((sc) => sc.id === ghostScenarioId) ?? null),
    [ghostScenarioId, allScenarios],
  )

  /* ------------------------- scenario actions ------------------------ */

  const newScenario = () => {
    const sc: TacticalScenario = {
      id: newId('sc'),
      name: 'Untitled scenario',
      description: '',
      provenance: 'MANUAL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attack: { formation: '4-3-3', players: formationPlayers('4-3-3', 'attack') },
      defence: { formation: '4-4-2', players: formationPlayers('4-4-2', 'defence') },
      actions: [],
    }
    setWorking(sc)
    setWorkingIsUserOwned(true)
    setSelectedActionId(null)
  }

  const loadScenario = (id: string) => {
    const found = allScenarios.find((sc) => sc.id === id)
    if (!found) return
    setWorking(structuredClone(found))
    setWorkingIsUserOwned(userScenarios.some((sc) => sc.id === id))
    setSelectedActionId(null)
    setPendingStart(null)
    setSearchParams({ scenario: id })
  }

  const saveScenario = () => {
    if (!working) return
    // Saving a loaded demo seed creates the user's own copy under a fresh id —
    // it never collides with (or shadows) the demo scenario list.
    const updated: TacticalScenario = workingIsUserOwned
      ? { ...working, updatedAt: new Date().toISOString(), provenance: 'MANUAL' }
      : {
          ...structuredClone(working),
          id: newId('sc'),
          name: working.name.startsWith('Untitled') ? working.name : `${working.name} (my copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          provenance: 'MANUAL',
        }
    scenarioStore.set((prev) => {
      const exists = prev.some((sc) => sc.id === updated.id)
      return exists ? prev.map((sc) => (sc.id === updated.id ? updated : sc)) : [...prev, updated]
    })
    setWorking(updated)
    setWorkingIsUserOwned(true)
    setSearchParams({ scenario: updated.id })
  }

  const duplicateScenario = () => {
    if (!working) return
    const copy: TacticalScenario = {
      ...structuredClone(working),
      id: newId('sc'),
      name: `${working.name} (copy)`,
      provenance: 'MANUAL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    scenarioStore.set((prev) => [...prev, copy])
    setWorking(copy)
    setWorkingIsUserOwned(true)
    setSearchParams({ scenario: copy.id })
  }

  const deleteScenario = () => {
    if (!working || !workingIsUserOwned) return
    scenarioStore.set((prev) => prev.filter((sc) => sc.id !== working.id))
    setWorking(null)
    setWorkingIsUserOwned(false)
  }

  const setFormation = (side: 'attack' | 'defence', formation: string) => {
    setWorking((prev) =>
      prev
        ? {
            ...prev,
            [side]: {
              formation,
              players: formationPlayers(formation, side).map((p, i) => ({
                ...p,
                // keep linked players where the slot position matches
                linkedPlayerId: prev[side].players[i]?.label === p.label ? prev[side].players[i]?.linkedPlayerId : undefined,
                role: p.label,
              })),
            },
          }
        : prev,
    )
  }

  const movePlayer = (id: string, x: number, y: number) => {
    setWorking((prev) =>
      prev
        ? {
            ...prev,
            attack: prev.attack.players.some((p) => p.id === id)
              ? { ...prev.attack, players: prev.attack.players.map((p) => (p.id === id ? { ...p, x, y } : p)) }
              : prev.attack,
            defence: prev.defence.players.some((p) => p.id === id)
              ? { ...prev.defence, players: prev.defence.players.map((p) => (p.id === id ? { ...p, x, y } : p)) }
              : prev.defence,
          }
        : prev,
    )
  }

  const moveBall = (x: number, y: number) => {
    setWorking((prev) => (prev ? { ...prev, ball: { x, y } } : prev))
  }

  const addAction = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    setWorking((prev) => {
      if (!prev) return prev
      const action: ScenarioAction = {
        id: newId('ac'),
        order: prev.actions.length + 1,
        type: tool === 'select' ? 'pass' : tool,
        from,
        to,
      }
      // The ball travels with passes and carries; runs and movements are
      // off-ball actions, so it stays put.
      const ballMoves = action.type === 'pass' || action.type === 'carry'
      return { ...prev, actions: [...prev.actions, action], ...(ballMoves ? { ball: to } : {}) }
    })
  }

  const updateAction = (id: string, patch: Partial<ScenarioAction>) => {
    setWorking((prev) =>
      prev ? { ...prev, actions: prev.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)) } : prev,
    )
  }

  const deleteAction = (id: string) => {
    setWorking((prev) => {
      if (!prev) return prev
      const next = prev.actions.filter((a) => a.id !== id)
      return { ...prev, actions: next.map((a, i) => ({ ...a, order: i + 1 })) }
    })
    if (selectedActionId === id) setSelectedActionId(null)
  }

  const moveAction = (id: string, dir: -1 | 1) => {
    setWorking((prev) => {
      if (!prev) return prev
      const idx = prev.actions.findIndex((a) => a.id === id)
      const swapIdx = idx + dir
      if (idx < 0 || swapIdx < 0 || swapIdx >= prev.actions.length) return prev
      const actions = [...prev.actions]
      ;[actions[idx], actions[swapIdx]] = [actions[swapIdx]!, actions[idx]!]
      return { ...prev, actions: actions.map((a, i) => ({ ...a, order: i + 1 })) }
    })
  }

  /* --------------------------- pitch events -------------------------- */

  const pitchCoords = (e: React.PointerEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null
    return svgToPitch(svgRef.current, e.clientX, e.clientY)
  }

  /* Snap a click to the nearest player token or the ball when close, so
     actions start and land exactly on a player instead of a vague pitch
     point. Falls back to the raw click position. */
  const snapToToken = (coords: { x: number; y: number }): { x: number; y: number } => {
    if (!working || !ballPos) return coords
    const tokens: Array<{ x: number; y: number }> = [
      ...working.attack.players,
      ...working.defence.players,
      { x: ballPos.x, y: ballPos.y },
    ]
    let best = coords
    let bestD = 3
    for (const tk of tokens) {
      const d = Math.hypot(tk.x - coords.x, tk.y - coords.y)
      if (d < bestD) {
        bestD = d
        best = { x: tk.x, y: tk.y }
      }
    }
    return best
  }

  const onPitchPointerDown = (e: React.PointerEvent) => {
    if (tool === 'select' || !working) return
    const coords = pitchCoords(e)
    if (!coords) return
    const snapped = snapToToken(coords)
    if (!pendingStart) {
      setPendingStart(snapped)
    } else {
      if (Math.hypot(snapped.x - pendingStart.x, snapped.y - pendingStart.y) > 1.5) {
        addAction(pendingStart, snapped)
      }
      setPendingStart(null)
    }
  }

  const onPitchPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragMove(e)
      return
    }
    // Rubber-band preview while drawing: update the line's endpoints directly
    // instead of re-rendering the page on every mouse move.
    if (!pendingStart) return
    const coords = pitchCoords(e)
    const line = previewRef.current
    if (!coords || !line) return
    const v = toView(coords.x, coords.y)
    line.setAttribute('x2', String(v.x))
    line.setAttribute('y2', String(v.y))
    line.setAttribute('opacity', '0.7')
  }

  const beginDrag = (
    e: React.PointerEvent,
    kind: 'player' | 'ball',
    id: string,
    orig: { x: number; y: number },
  ) => {
    e.stopPropagation()
    const el = e.currentTarget as SVGGElement
    // Pointer capture keeps every subsequent event glued to the grabbed token
    // even if the cursor outruns it or leaves the pitch.
    try { el.setPointerCapture?.(e.pointerId) } catch { /* not supported */ }
    const coords = pitchCoords(e)
    dragRef.current = {
      kind,
      id,
      el,
      startX: coords?.x ?? orig.x,
      startY: coords?.y ?? orig.y,
      origX: orig.x,
      origY: orig.y,
    }
    el.style.cursor = 'grabbing'
    setDraggingId(id) // one render at grab (cursor + tooltip suppression)
  }

  const dragMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const coords = pitchCoords(e)
    if (!coords) return
    // Direct attribute update — no setState, no re-render, native smoothness.
    drag.lastX = drag.origX + (coords.x - drag.startX)
    drag.lastY = drag.origY + (coords.y - drag.startY)
    const vx = ((drag.lastX - drag.origX) / 100) * PITCH_VIEW.w
    const vy = ((drag.lastY - drag.origY) / 100) * PITCH_VIEW.h
    drag.el.setAttribute('transform', `translate(${vx.toFixed(3)} ${vy.toFixed(3)})`)
  }

  const dragEnd = () => {
    const drag = dragRef.current
    dragRef.current = null
    setDraggingId(null)
    if (!drag || drag.lastX === undefined || drag.lastY === undefined) return // grabbed, never moved
    const x = Math.min(100, Math.max(0, drag.lastX))
    const y = Math.min(100, Math.max(0, drag.lastY))
    drag.el.removeAttribute('transform')
    drag.el.style.cursor = 'grab'
    if (drag.kind === 'ball') moveBall(x, y)
    else movePlayer(drag.id, x, y)
  }

  const onPlayerPointerDown = (e: React.PointerEvent, id: string, orig: { x: number; y: number }) => {
    if (tool !== 'select') return // drawing: let the click reach the pitch handler, which snaps to this player
    beginDrag(e, 'player', id, orig)
  }

  const onBallPointerDown = (e: React.PointerEvent) => {
    if (tool !== 'select') return // drawing: click near the ball starts the action there
    if (!ballPos) return
    beginDrag(e, 'ball', 'ball', ballPos)
  }

  /* ------------------------------ render ----------------------------- */

  const sortedActions = working
    ? [...working.actions].sort((a, b) => a.order - b.order)
    : []

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tactical Lab"
        description="Interactive top-down pitch for tactical planning: formations, draggable players, passes, carries, runs and movement paths with numbered, annotated actions. This is a planning and visualisation tool — drawn arrows are not a validated match simulation."
        actions={
          working ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={saveScenario}>
                <Save aria-hidden />
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={duplicateScenario}>
                <Copy aria-hidden />
                Duplicate
              </Button>
              {workingIsUserOwned && (
                <Button size="sm" variant="destructive" onClick={deleteScenario}>
                  <Trash2 aria-hidden />
                  Delete
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        {/* Pitch column */}
        <div className="space-y-3">
          {/* Toolbar */}
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 py-3">
              <div className="flex flex-col gap-1">
                <Label>Tool</Label>
                <div className="flex overflow-hidden rounded-md border border-line-strong" role="group" aria-label="Drawing tool">
                  {(
                    [
                      ['select', 'Move players', Move],
                      ['pass', 'Pass', ClipboardPen],
                      ['carry', 'Carry', Footprints],
                      ['run', 'Run (off-ball)', Move],
                      ['movement', 'Movement', Move],
                    ] as [Tool, string, typeof Move][]
                  ).map(([t, label, Icon]) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTool(t)
                        setPendingStart(null)
                      }}
                      aria-pressed={tool === t}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400',
                        tool === t ? 'bg-accent-500 text-on-bright' : 'bg-ink-900 text-fg-muted hover:bg-ink-700 hover:text-fg',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex w-40 flex-col gap-1">
                <Label htmlFor="tl-formation-a">Attacking team</Label>
                <Select
                  value={working?.attack.formation ?? '4-3-3'}
                  onValueChange={(v) => setFormation('attack', v)}
                  disabled={!working}
                >
                  <SelectTrigger id="tl-formation-a"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMATIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex w-40 flex-col gap-1">
                <Label htmlFor="tl-formation-d">Defending team</Label>
                <Select
                  value={working?.defence.formation ?? '4-4-2'}
                  onValueChange={(v) => setFormation('defence', v)}
                  disabled={!working}
                >
                  <SelectTrigger id="tl-formation-d"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMATIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex w-52 flex-col gap-1">
                <Label htmlFor="tl-ghost">Compare overlay (ghost)</Label>
                <Select value={ghostScenarioId} onValueChange={setGhostScenarioId} disabled={!working}>
                  <SelectTrigger id="tl-ghost"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {allScenarios
                      .filter((sc) => sc.id !== working?.id)
                      .map((sc) => (
                        <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="mb-1.5 text-[11px] text-fg-faint">
                {tool === 'select'
                  ? 'Drag players or the ball to reposition them.'
                  : `Click a player or the pitch to start the ${tool}, then click where it goes. Esc cancels.`}
              </p>

              {/* Team colours — recolour tokens so kits never clash with the
                  turf, arrows or each other. Persisted as a UI preference. */}
              <div className="w-full border-t border-line pt-3">
                <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
                    Team colours
                  </span>
                  {(
                    [
                      ['attack', 'Attacking'],
                      ['defence', 'Defending'],
                      ['goalkeeper', 'Goalkeepers'],
                      ['ball', 'Ball'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-fg-muted">{label}</span>
                      <span className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={colors[key]}
                          aria-label={`${label} colour`}
                          onChange={(e) =>
                            tacticalColorsStore.set((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          className="h-8 w-11 cursor-pointer rounded border border-line-strong bg-transparent p-0.5"
                        />
                        <span className="flex gap-1">
                          {['#ffffff', '#d4f93a', '#facc15', '#f97316', '#ef4444', '#38bdf8', '#1e40af', '#22c55e', '#111827'].map(
                            (preset) => (
                              <button
                                key={preset}
                                type="button"
                                aria-label={`Set ${label} colour to ${preset}`}
                                aria-pressed={colors[key].toLowerCase() === preset}
                                onClick={() =>
                                  tacticalColorsStore.set((prev) => ({ ...prev, [key]: preset }))
                                }
                                className={
                                  colors[key].toLowerCase() === preset
                                    ? 'h-4 w-4 rounded-full ring-2 ring-accent-400 ring-offset-1 ring-offset-ink-900'
                                    : 'h-4 w-4 rounded-full border border-line-strong hover:ring-1 hover:ring-line-strong'
                                }
                                style={{ backgroundColor: preset }}
                              />
                            ),
                          )}
                        </span>
                      </span>
                    </label>
                  ))}
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => tacticalColorsStore.set(DEFAULT_TACTICAL_COLORS)}
                  >
                    Reset colours
                  </Button>
                </div>
                {colors.attack.toLowerCase() === colors.defence.toLowerCase() && (
                  <p className="mt-2 text-[11px] font-medium text-warning">
                    Attacking and defending colours are identical — the two teams will be hard to tell apart.
                  </p>
                )}
                {colors.attack.toLowerCase() === colors.ball.toLowerCase() && (
                  <p className="mt-2 text-[11px] font-medium text-warning">
                    The attacking colour matches the ball — the ball will disappear inside their tokens.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pitch */}
          <TooltipProvider delayDuration={80}>
            <div className="rounded-lg panel-border bg-ink-900/40 p-2">
              <Pitch ariaLabel="Tactical scenario pitch" innerRef={svgRef}>
                <g
                  onPointerDown={onPitchPointerDown}
                  onPointerMove={onPitchPointerMove}
                  onPointerUp={dragEnd}
                  onPointerCancel={dragEnd}
                  onPointerLeave={() => previewRef.current?.setAttribute('opacity', '0')}
                  style={{
                    cursor: tool === 'select' ? 'default' : 'crosshair',
                    touchAction: tool === 'select' ? 'auto' : 'none',
                  }}
                >
                  {/* Invisible hit area. SVG groups only receive pointer
                      events on drawn geometry, so without this rect clicks on
                      the open turf never reach the drawing/drag handlers. */}
                  <rect data-testid="tl-pitch-hit" x={-2} y={-2} width={109} height={72} fill="transparent" />

                  {/* Ghost scenario actions */}
                  {ghostScenario?.actions.map((a) => {
                    const from = toView(a.from.x, a.from.y)
                    const to = toView(a.to.x, a.to.y)
                    return (
                      <line
                        key={`ghost-${a.id}`}
                        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                        stroke="#5e6d8e" strokeWidth={0.7} strokeDasharray="3 2" opacity={0.55}
                      />
                    )
                  })}

                  {/* Current actions */}
                  {sortedActions.map((a) => {
                    const style = ACTION_STYLES[a.type]
                    const from = toView(a.from.x, a.from.y)
                    const to = toView(a.to.x, a.to.y)
                    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
                    return (
                      <g key={a.id} className="cursor-pointer" onPointerDown={() => setSelectedActionId(a.id)}>
                        <line
                          x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                          stroke={style.stroke}
                          strokeWidth={selectedActionId === a.id ? 1.3 : 0.72}
                          strokeDasharray={style.dash}
                          strokeLinecap="round"
                          markerEnd={`url(#arrow-${a.type})`}
                        />
                        <circle cx={mid.x} cy={mid.y} r={1.85} fill="#0d1424" stroke={style.stroke} strokeWidth={0.45} />
                        <text x={mid.x} y={mid.y + 0.75} textAnchor="middle" fontSize={2.4} fill={style.stroke} className="font-bold">
                          {a.order}
                        </text>
                      </g>
                    )
                  })}

                  {/* Pending draw preview — endpoints updated via direct DOM
                      (see onPitchPointerMove) so drawing never stutters. */}
                  {pendingStart && (
                    <line
                      ref={previewRef}
                      x1={toView(pendingStart.x, pendingStart.y).x}
                      y1={toView(pendingStart.x, pendingStart.y).y}
                      x2={toView(pendingStart.x, pendingStart.y).x}
                      y2={toView(pendingStart.x, pendingStart.y).y}
                      stroke={ACTION_STYLES[tool === 'select' ? 'pass' : tool].stroke}
                      strokeWidth={0.65} strokeDasharray="2 2" opacity={0}
                    />
                  )}
                  {pendingStart && (
                    <g aria-hidden>
                      <circle
                        cx={toView(pendingStart.x, pendingStart.y).x}
                        cy={toView(pendingStart.x, pendingStart.y).y}
                        r={1.7}
                        fill="none"
                        stroke={ACTION_STYLES[tool === 'select' ? 'pass' : tool].stroke}
                        strokeWidth={0.55}
                      />
                      <circle
                        cx={toView(pendingStart.x, pendingStart.y).x}
                        cy={toView(pendingStart.x, pendingStart.y).y}
                        r={0.45}
                        fill={ACTION_STYLES[tool === 'select' ? 'pass' : tool].stroke}
                      />
                    </g>
                  )}

                  {/* Players — same token design as the match-analysis
                      average-position view (SofaScore-style) */}
                  {working &&
                    (
                      [
                        ['attack', working.attack.players] as const,
                        ['defence', working.defence.players] as const,
                      ]
                    ).flatMap(([side, players]) =>
                      players.map((p) => {
                        const v = toView(p.x, p.y)
                        const linked = p.linkedPlayerId ? playerById(p.linkedPlayerId) : undefined
                        const isGk = p.label.includes('GK')
                        const fill = isGk ? colors.goalkeeper : side === 'attack' ? colors.attack : colors.defence
                        const dragging = draggingId === p.id
                        return (
                          <RadixTooltip key={p.id} open={dragging ? false : undefined}>
                            <TooltipTrigger asChild>
                              <g
                                onPointerDown={(e) => onPlayerPointerDown(e, p.id, { x: p.x, y: p.y })}
                                style={{
                                  cursor: tool === 'select' ? 'grab' : 'pointer',
                                  touchAction: 'none',
                                }}
                              >
                                {/* Plain solid token — no ring, halo or border. */}
                                <circle cx={v.x} cy={v.y} r={2.07} fill={fill} />
                                <text
                                  x={v.x} y={v.y + 0.1}
                                  fontSize={1.7} fontWeight={800}
                                  textAnchor="middle" dominantBaseline="central"
                                  fill={readableTextOn(fill)}
                                  style={{ pointerEvents: 'none' }}
                                >
                                  {linked?.shirtNumber ?? p.label}
                                </text>
                              </g>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-semibold text-fg">{p.label}{side === 'defence' ? ' (defending)' : ''}</p>
                              {linked && <p>Linked player: <Link className="underline" to={`/players/${linked.id}`}>{linked.name}</Link></p>}
                              <p className="text-fg-faint">Drag with the Move tool · x {p.x.toFixed(0)} / y {p.y.toFixed(0)}</p>
                            </TooltipContent>
                          </RadixTooltip>
                        )
                      }),
                    )}

                  {/* The ball — on top of every token. It sits at the end of the
                      last pass / carry (or the keeper's feet), travels with new
                      passes and carries, and can be dragged with the Move tool. */}
                  {working && ballPos && (() => {
                    const v = toView(ballPos.x, ballPos.y)
                    return (
                      <g
                        onPointerDown={onBallPointerDown}
                        role="img"
                        aria-label={`Ball at x ${ballPos.x.toFixed(0)}, y ${ballPos.y.toFixed(0)} — drag with the Move tool`}
                        style={{
                          cursor: tool === 'select' ? 'grab' : 'pointer',
                          touchAction: 'none',
                        }}
                      >
                        <circle cx={v.x} cy={v.y} r={1.5} fill={colors.ball} stroke={readableTextOn(colors.ball)} strokeWidth={0.3} />
                        <path d={pentagonPath(v.x, v.y, 0.55)} fill={readableTextOn(colors.ball)} />
                      </g>
                    )
                  })()}
                </g>
                <defs>
                  {(Object.keys(ACTION_STYLES) as TacticalActionType[]).map((type) => (
                    <marker
                      key={type}
                      id={`arrow-${type}`}
                      viewBox="0 0 8 8"
                      refX="6"
                      refY="4"
                      markerWidth="4"
                      markerHeight="4"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 8 4 L 0 8 z" fill={ACTION_STYLES[type].stroke} />
                    </marker>
                  ))}
                </defs>
              </Pitch>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-fg-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.attack }} aria-hidden />
                  Attacking team
                </span>
                <span className="inline-flex items-center gap-1.5 text-fg-faint">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.goalkeeper }} aria-hidden />
                  goalkeepers
                </span>
                <span className="inline-flex items-center gap-1.5">
                  Defending team
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.defence }} aria-hidden />
                </span>
              </div>
            </div>
          </TooltipProvider>

          <InfoNote variant="warning" title="Planning tool — not a simulation">
            Drawn sequences represent coach intent only. A rules-based simulator (passing options, occupied
            spaces, defensive lines, lane obstructions, turnover risk) is planned for a later phase and its
            outputs will be labelled as estimates. Linking a scenario to a real player profile or match event
            provides context, not validation.
          </InfoNote>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          {/* Scenario browser */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Scenarios</CardTitle>
              <Button size="xs" onClick={newScenario}>
                New
              </Button>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {allScenarios.length === 0 && (
                <p className="text-xs text-fg-faint">
                  No scenarios yet. Create one — scenarios are stored locally in your browser.
                </p>
              )}
              {allScenarios.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => loadScenario(sc.id)}
                  className={cn(
                    'w-full rounded-md border p-2.5 text-left transition-colors',
                    working?.id === sc.id
                      ? 'border-accent-700 bg-accent-400/10'
                      : 'border-line bg-ink-900/50 hover:border-line-strong',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-fg">{sc.name}</span>
                    <ProvenanceBadge provenance={sc.provenance} compact />
                  </div>
                  <p className="mt-0.5 text-[10px] text-fg-faint">
                    {sc.attack.formation} vs {sc.defence.formation} · {sc.actions.length} actions
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Scenario meta */}
          {working && (
            <Card>
              <CardHeader>
                <CardTitle>Scenario details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="tl-name">Name</Label>
                  <Input
                    id="tl-name"
                    value={working.name}
                    onChange={(e) => setWorking({ ...working, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="tl-desc">Description / coaching notes</Label>
                  <Textarea
                    id="tl-desc"
                    value={working.description ?? ''}
                    onChange={(e) => setWorking({ ...working, description: e.target.value })}
                    placeholder="What is this sequence trying to achieve?"
                  />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-fg-faint">
                  <span>Provenance:</span>
                  <ProvenanceBadge provenance={working.provenance} />
                  {workingIsUserOwned ? '(your local copy — autosaved)' : '(demo seed — Save creates your own copy)'}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action list */}
          {working && (
            <Card>
              <CardHeader>
                <CardTitle>Actions ({working.actions.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sortedActions.length === 0 && (
                  <p className="text-xs text-fg-faint">
                    Pick a tool (pass, carry, run, movement) and click two points on the pitch to build the
                    sequence. Every action is numbered and can carry a note and a linked player.
                  </p>
                )}
                {sortedActions.map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      'rounded-md border p-2.5',
                      selectedActionId === a.id ? 'border-accent-700 bg-accent-400/5' : 'border-line bg-ink-900/50',
                    )}
                    onPointerDown={() => setSelectedActionId(a.id)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-metric flex h-5 w-5 items-center justify-center rounded-full border border-line-strong text-[10px] font-bold text-fg-muted">
                        {a.order}
                      </span>
                      <Badge variant="default" className="normal-case">{ACTION_STYLES[a.type].label}</Badge>
                      <span className="text-[10px] text-fg-faint">
                        ({a.from.x.toFixed(0)},{a.from.y.toFixed(0)}) → ({a.to.x.toFixed(0)},{a.to.y.toFixed(0)})
                      </span>
                      <span className="ml-auto flex items-center gap-0.5">
                        <Button variant="ghost" size="icon-sm" aria-label="Move earlier" onClick={() => moveAction(a.id, -1)}>
                          ↑
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Move later" onClick={() => moveAction(a.id, 1)}>
                          ↓
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Delete action" onClick={() => deleteAction(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="col-span-2 flex flex-col gap-1">
                        <Label htmlFor={`note-${a.id}`}>Note</Label>
                        <Input
                          id={`note-${a.id}`}
                          value={a.note ?? ''}
                          onChange={(e) => updateAction(a.id, { note: e.target.value })}
                          placeholder="Why this action happens…"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-2 flex flex-col gap-1">
                        <Label htmlFor={`link-${a.id}`}>Link player (evidence)</Label>
                        <Select
                          value={a.linkedPlayerId ?? 'none'}
                          onValueChange={(v) => updateAction(a.id, { linkedPlayerId: v === 'none' ? undefined : v })}
                        >
                          <SelectTrigger id={`link-${a.id}`} className="h-8 text-xs">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {data?.dataset.players
                              .filter((p) => p.stats.minutes > 400)
                              .slice(0, 60)
                              .map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name} · {p.position}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {a.linkedPlayerId && playerById(a.linkedPlayerId) && (
                          <Link
                            to={`/players/${a.linkedPlayerId}`}
                            className="text-[10px] text-accent-300 underline underline-offset-2"
                          >
                            {playerById(a.linkedPlayerId)!.name} — open profile
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
