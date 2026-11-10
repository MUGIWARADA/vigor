import { useMemo, useState } from 'react'
import { Compass, Ruler } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pitch, type PitchTemplate } from '@/components/pitch/Pitch'
import { cn } from '@/lib/utils'
import { attackDir, type MatchState } from './engine'
import { getTeam, type TeamId } from './data'
import { tacticalProfile, type TacticalProfile } from './tactics'

/**
 * Shape panel — the average shape of a side, drawn to scale on the pitch.
 *
 * The idea comes from the `minimap_hud` stage of ai-football-analytics: a
 * top-down map with a line per unit, because a shape argument is impossible to
 * settle on a broadcast view and trivial on a diagram. The difference here is
 * that the underlying positions are exact — one sample per player per second,
 * recorded by the engine in the team's own attacking orientation — so the
 * bands, the gaps and the space behind are measured rather than drawn by eye.
 *
 * Everything is computed in *local* coordinates (x = 0 at the team's own goal,
 * growing toward the goal they attack) and only converted to world pixels at
 * the last moment, so the same panel works after the teams change ends.
 */

const W = 105
const H = 68

export type UnitKey = 'defence' | 'midfield' | 'attack'

export interface ShapeUnit {
  key: UnitKey
  label: string
  /** Players in the unit, by their match-average positions. */
  count: number
  /** Mean distance from the team's own goal, in metres. */
  line: number
  /** Nearest and furthest member of the unit from the team's own goal. */
  min: number
  max: number
  /** Lateral extent of the unit across the pitch, in metres. */
  width: number
  /** Mean lateral centre of the unit. */
  centre: number
}

export type ShapePhase = 'all' | 'in' | 'out'

export const PHASE_LABEL: Record<ShapePhase, string> = {
  all: 'Whole match',
  in: 'With the ball',
  out: 'Without the ball',
}

export interface TeamShape {
  teamId: TeamId
  phase: ShapePhase
  /** False until there are enough samples to mean anything. */
  ready: boolean
  units: ShapeUnit[]
  /** Whole outfield block: deepest and highest average position, local x. */
  blockMin: number
  blockMax: number
  /** Lateral extent of the block. */
  blockWidth: number
  blockCentreY: number
  /** Metres of pitch between the deepest player and the team's own goal. */
  spaceBehind: number
  /** Vertical gaps between consecutive unit lines, metres (defence→mid, mid→attack). */
  gaps: number[]
  /** Longest gap between any two adjacent average positions, in metres. */
  biggestGap: number
  /** Mean of each player's average position — the team's centre of gravity. */
  centroid: { x: number; y: number }
  /**
   * Where the opposition's back line stood, in this team's own frame (0 = this
   * team's goal). The front line cannot go higher than this: it is what pins
   * a striker, and it is why a side with no space in behind ends up with its
   * midfield level with its forwards.
   */
  opponentLine: number | null
  /** The centre-forward's average height, or the top of the front unit if there is no 9. */
  strikerLine: number | null
  /** The striker's line minus the opposition's. Negative = short of their line. */
  roomAhead: number | null
  players: Array<{ id: string; x: number; y: number; unit: UnitKey; number: number }>
}

const UNIT_OF = (slot: string): UnitKey => {
  if (['LB', 'RB', 'LWB', 'RWB', 'LCB', 'CB', 'RCB'].includes(slot)) return 'defence'
  if (['DM', 'LDM', 'RDM', 'LCM', 'CM', 'RCM', 'CAM'].includes(slot)) return 'midfield'
  return 'attack'
}

const UNIT_LABEL: Record<UnitKey, string> = { defence: 'Defence', midfield: 'Midfield', attack: 'Attack' }

/**
 * The measured shape, in metres, in the team's own frame. Pure: no React, no
 * DOM, so the numbers behind the diagram can be tested on their own.
 */
export function teamShape(state: MatchState, teamId: TeamId, phase: ShapePhase = 'all', minSamples = 5): TeamShape {
  const count = (p: { samples: number; inCount: number; outCount: number }) =>
    phase === 'in' ? p.inCount : phase === 'out' ? p.outCount : p.samples
  const spot = (p: { avgX: number; avgY: number; inX: number; inY: number; outX: number; outY: number }) =>
    phase === 'in' ? { x: p.inX, y: p.inY } : phase === 'out' ? { x: p.outX, y: p.outY } : { x: p.avgX, y: p.avgY }
  // The eleven who actually played the shape: substitutes with a handful of
  // samples would otherwise drag a unit's average toward the bench. Taking the
  // ten outfield players with the most samples is the same rule the positions
  // panel uses, so the two views agree.
  const squad = state.players
    .filter((p) => p.teamId === teamId && count(p) >= minSamples && !p.sentOff && p.slotPosition !== 'GK')
    .sort((a, b) => count(b) - count(a))
    .slice(0, 10)
  const outfield = squad
  const empty: TeamShape = {
    teamId,
    phase,
    ready: false,
    units: [],
    blockMin: 0,
    blockMax: 0,
    blockWidth: 0,
    blockCentreY: H / 2,
    spaceBehind: 0,
    gaps: [],
    biggestGap: 0,
    centroid: { x: W / 2, y: H / 2 },
    opponentLine: null,
    strikerLine: null,
    roomAhead: null,
    players: [],
  }
  if (outfield.length < 6) return empty

  const points = outfield.map((p) => {
    const v = spot(p)
    return {
      id: p.id,
      x: v.x,
      y: v.y,
      unit: UNIT_OF(p.slotPosition),
      number: p.base.number,
    }
  })

  const units: ShapeUnit[] = (['defence', 'midfield', 'attack'] as UnitKey[])
    .map((key) => {
      const members = points.filter((p) => p.unit === key)
      if (!members.length) return null
      const xs = members.map((p) => p.x)
      const ys = members.map((p) => p.y)
      return {
        key,
        label: UNIT_LABEL[key],
        count: members.length,
        line: xs.reduce((a, b) => a + b, 0) / members.length,
        min: Math.min(...xs),
        max: Math.max(...xs),
        width: Math.max(...ys) - Math.min(...ys),
        centre: ys.reduce((a, b) => a + b, 0) / members.length,
      }
    })
    .filter((u): u is ShapeUnit => Boolean(u))

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const gaps = units.slice(1).map((u, i) => u.line - units[i]!.line)
  const sorted = [...xs].sort((a, b) => a - b)
  const biggestGap = sorted.slice(1).reduce((worst, value, i) => Math.max(worst, value - sorted[i]!), 0)

  // Where their back line stands, in our frame. Their centre-backs and
  // full-backs average in their own attacking orientation, so the distance
  // from the goal they defend is 105 minus that. This is the reading that
  // explains a flat shape: no room in behind is not a midfield problem.
  const theirBackLine = state.players
    .filter((p) => p.teamId !== teamId && count(p) >= minSamples && ['LB', 'RB', 'LCB', 'CB', 'RCB', 'LWB', 'RWB'].includes(p.slotPosition))
    .map((p) => spot(p).x)
  const opponentLine = theirBackLine.length
    ? Number((W - theirBackLine.reduce((a, b) => a + b, 0) / theirBackLine.length).toFixed(1))
    : null
  // The striker's line, not the front unit's mean: a winger tracking back must
  // not be allowed to make the centre-forward look pinned when he is ten
  // metres short of the last defender and standing in his own midfield.
  const strikers = points.filter((p) => ['ST', 'LST', 'RST'].includes(
    state.players.find((q) => q.id === p.id)?.slotPosition ?? '',
  ))
  const strikerXs = (strikers.length ? strikers : points.filter((p) => p.unit === 'attack')).map((p) => p.x).sort((a, b) => a - b)
  const frontLine = strikerXs.length ? strikerXs[Math.floor(strikerXs.length / 2)]! : null

  return {
    teamId,
    phase,
    ready: true,
    units,
    blockMin: Math.min(...xs),
    blockMax: Math.max(...xs),
    blockWidth: Math.max(...ys) - Math.min(...ys),
    blockCentreY: ys.reduce((a, b) => a + b, 0) / ys.length,
    spaceBehind: Math.min(...xs),
    gaps,
    biggestGap,
    centroid: { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length },
    opponentLine,
    strikerLine: frontLine !== null ? Number(frontLine.toFixed(1)) : null,
    roomAhead: opponentLine !== null && frontLine !== null ? Number((frontLine - opponentLine).toFixed(1)) : null,
    players: points,
  }
}

/** Local (own goal at 0) → world (goal at x = 0 is the left end). */
function toWorld(dir: 1 | -1, x: number, y: number) {
  return dir === 1 ? { x, y } : { x: W - x, y: H - y }
}

/** A local rectangle → the world rect SVG needs, whichever end is being attacked. */
function worldRect(dir: 1 | -1, x0: number, x1: number, y0: number, y1: number) {
  const a = toWorld(dir, x0, y0)
  const b = toWorld(dir, x1, y1)
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

/**
 * The diagram itself: one band per unit, the block outline, and the space
 * behind the line. Drawn as an SVG group so it can sit over any `Pitch`.
 */
export function ShapeOverlay({ shape, dir, tint = '#d9f99d' }: {
  shape: TeamShape
  dir: 1 | -1
  tint?: string
}) {
  if (!shape.ready) return null
  const behind = worldRect(dir, 0, shape.spaceBehind, 2, H - 2)
  const block = worldRect(dir, shape.blockMin, shape.blockMax, shape.blockCentreY - shape.blockWidth / 2, shape.blockCentreY + shape.blockWidth / 2)
  const labelAnchor = (localX: number) => {
    const w = toWorld(dir, localX, H / 2)
    return { x: w.x, textAnchor: dir === 1 ? ('start' as const) : ('end' as const), dx: dir === 1 ? 1.2 : -1.2 }
  }

  return (
    <g data-testid="shape-overlay" aria-hidden>
      {/* The space behind the line: the thing a "high block" claims not to give away. */}
      <rect
        x={behind.x} y={behind.y} width={behind.width} height={behind.height}
        fill="rgba(255,92,108,0.14)" stroke="rgba(255,92,108,0.5)" strokeWidth={0.18} strokeDasharray="1.4 1.2"
      />
      <text
        x={behind.x + behind.width / 2} y={behind.y + 3.4}
        textAnchor="middle" fontSize={1.7} fill="rgba(255,150,160,0.95)" letterSpacing={0.8}
      >
        {shape.spaceBehind.toFixed(1)} M BEHIND THE LINE
      </text>

      {/* The block outline, drawn to the measured extent of the outfield ten. */}
      <rect
        x={block.x} y={block.y} width={block.width} height={block.height}
        fill="rgba(217,249,157,0.06)" stroke={tint} strokeWidth={0.22} strokeDasharray="2 1.4"
      />

      {shape.units.map((unit) => {
        const band = worldRect(dir, unit.min, unit.max, 4, H - 4)
        const spine = toWorld(dir, unit.line, H / 2)
        const tag = labelAnchor(unit.max)
        return (
          <g key={unit.key} data-testid={`shape-unit-${unit.key}`}>
            <rect
              x={band.x} y={band.y} width={band.width} height={band.height}
              fill={`${tint}1f`} stroke="none"
            />
            <line
              x1={spine.x} y1={4} x2={spine.x} y2={H - 4}
              stroke={tint} strokeWidth={0.22} strokeDasharray="0.9 0.9" opacity={0.9}
            />
            <text
              x={tag.x} y={band.y + (unit.key === 'defence' ? 4.4 : unit.key === 'midfield' ? 9.4 : 55.6)}
              textAnchor={tag.textAnchor} dx={tag.dx}
              fontSize={1.7} fontWeight={700} fill={tint} letterSpacing={0.7}
            >
              {unit.label.toUpperCase()} {unit.line.toFixed(0)}M
            </text>
          </g>
        )
      })}

      {/* Player average positions, so the bands can be checked against the men. */}
      {shape.players.map((p) => {
        const w = toWorld(dir, p.x, p.y)
        return (
          <g key={p.id} data-testid={`shape-player-${p.id}`}>
            <circle cx={w.x} cy={w.y} r={0.62} fill="rgba(4,10,7,0.55)" stroke={tint} strokeWidth={0.16} />
            <text x={w.x} y={w.y + 0.28} textAnchor="middle" fontSize={0.86} fontWeight={700} fill={tint}>
              {p.number}
            </text>
          </g>
        )
      })}

      {/* Centre of gravity. */}
      <g opacity={0.85}>
        <circle cx={toWorld(dir, shape.centroid.x, shape.centroid.y).x} cy={toWorld(dir, shape.centroid.x, shape.centroid.y).y} r={1.5} fill="none" stroke={tint} strokeWidth={0.16} strokeDasharray="0.5 0.5" />
      </g>
    </g>
  )
}

function ReadingRow({ label, value, unit, reason }: { label: string; value: number; unit: string; reason: string }) {
  return (
    <div className="rounded-md border border-line/60 bg-ink-900/40 px-2.5 py-2" data-testid="shape-reading">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{label}</span>
        <span className="text-metric text-sm font-semibold text-fg">{value}<span className="ml-0.5 text-[11px] font-normal text-fg-muted">{unit}</span></span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">{reason}</p>
    </div>
  )
}

/**
 * Post-match (or live) shape card: the diagram plus the readings behind it.
 * Every figure in the list is a threshold applied to a measurement, which is
 * the whole point — the picture and the number have to agree.
 */
export function ShapePanel({ state, pitchTemplate, initialTeam = 'bracelonia' }: {
  state: MatchState
  pitchTemplate: PitchTemplate
  initialTeam?: TeamId
}) {
  const [teamId, setTeamId] = useState<TeamId>(initialTeam)
  const [phase, setPhase] = useState<ShapePhase>('all')
  const dir = attackDir(state, teamId)
  const shape = useMemo(() => teamShape(state, teamId, phase), [state, teamId, phase])
  const profile: TacticalProfile = useMemo(() => tacticalProfile(state, teamId), [state, teamId])
  const team = getTeam(teamId)

  const unitRows = shape.ready
    ? [
        ...(shape.roomAhead !== null && shape.opponentLine !== null
          ? [{
              label: 'Room ahead of the front line',
              value: shape.roomAhead,
              unit: 'm',
              reason: shape.roomAhead < 0
                ? `their back line stands at ${shape.opponentLine.toFixed(0)} m in the same direction and ${team.shortName}'s front line at ${(shape.opponentLine + shape.roomAhead).toFixed(0)} m — there is nothing to run into, so the units stack on each other`
                : `${team.shortName}'s front line is ${shape.roomAhead.toFixed(1)} m beyond a back line that stands ${shape.opponentLine.toFixed(0)} m from the goal they defend`,
            }]
          : []),
        { label: 'Space behind the line', value: Number(shape.spaceBehind.toFixed(1)), unit: 'm', reason: `the deepest average position is ${shape.spaceBehind.toFixed(1)} m from ${team.shortName}'s own goal` },
        { label: 'Block length', value: Number((shape.blockMax - shape.blockMin).toFixed(1)), unit: 'm', reason: `from the deepest average position to the highest: ${(shape.blockMax - shape.blockMin).toFixed(1)} m` },
        { label: 'Block width', value: Number(shape.blockWidth.toFixed(1)), unit: 'm', reason: `the outfield ten span ${shape.blockWidth.toFixed(1)} m across the pitch` },
        { label: 'Biggest gap', value: Number(shape.biggestGap.toFixed(1)), unit: 'm', reason: `the widest space between two adjacent average positions is ${shape.biggestGap.toFixed(1)} m` },
      ]
    : []

  return (
    <Card data-testid="shape-panel">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Compass className="size-4 text-accent-300" /> Shape</CardTitle>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">
              Average positions, drawn to scale in {team.name}&rsquo;s own attacking direction. Bands are each unit&rsquo;s spread; the dashed box is the block; the red end is the ground behind the deepest player.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['bracelonia', 'banyarn'] as TeamId[]).map((id) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={teamId === id ? 'default' : 'outline'}
                aria-pressed={teamId === id}
                onClick={() => setTeamId(id)}
              >
                {getTeam(id).shortName}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Phase</span>
          {(['all', 'in', 'out'] as ShapePhase[]).map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={phase === key ? 'default' : 'outline'}
              aria-pressed={phase === key}
              onClick={() => setPhase(key)}
            >
              {PHASE_LABEL[key]}
            </Button>
          ))}
          <span className="ml-auto text-[11px] uppercase tracking-wide text-fg-muted">
            {phase === 'all' ? 'Whole match' : phase === 'in' ? 'In possession' : 'Out of possession'}
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div>
            <Pitch ariaLabel={`${team.name} average shape ${PHASE_LABEL[phase].toLowerCase()}`} className="w-full" template={pitchTemplate}>
              <ShapeOverlay shape={shape} dir={dir} />
            </Pitch>
            {!shape.ready && (
              <p className="mt-2 text-[11px] text-fg-muted">Not enough samples yet — the shape appears once the match has been played for a few seconds.</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-fg-muted">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-[1px] bg-accent-300/30" /> unit spread</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-[1px] border border-dashed border-accent-300/80" /> block</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-[1px] bg-[rgba(255,92,108,0.3)]" /> space behind</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
              <Ruler className="size-3.5" /> What the diagram is measuring
            </h4>
            {unitRows.map((row) => <ReadingRow key={row.label} {...row} />)}
            {profile.samples > 0 && (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {profile.readings.slice(0, 4).map((reading) => (
                  <div key={reading.key} className="rounded-md border border-line/60 bg-ink-800/40 px-2.5 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{reading.label}</span>
                      <span className="text-metric text-sm font-semibold text-accent-300">{reading.value}<span className="ml-0.5 text-[11px] font-normal text-fg-muted">{reading.unit}</span></span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">{reading.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export const shapePanelClasses = cn('space-y-1.5')
