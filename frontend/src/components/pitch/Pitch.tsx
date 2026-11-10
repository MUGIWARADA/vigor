import { useId, useMemo, type ReactNode } from 'react'
import type { TouchPoint } from '@/types'
import { cn, clamp } from '@/lib/utils'
import { computeHeatGrid, computeHexHeat, heatColor, HEX_RADIUS_M, HEAT_GRID, type PitchPoint } from '@/lib/heatmap'

/**
 * Interactive football pitch (SVG).
 *
 * Coordinate convention used across the whole app: x ∈ [0,100] along the
 * pitch length (0 = left goal line, 100 = right goal line), y ∈ [0,100]
 * across the width (0 = top touchline). The pitch is drawn at true 105×68
 * proportions; helpers convert between normalised and viewBox coordinates.
 */

export const PITCH_VIEW = { w: 105, h: 68 }

export type PitchTemplate =
  | 'glass-turf'
  | 'gloss-carbon'
  | 'floodlit-night'
  | 'bone-chalk'
  | 'volt-turf'
  | 'midnight-glass'
  | 'carbon-mono'
  | 'emerald-broadcast'

export const PITCH_TEMPLATES: Array<{ id: PitchTemplate; label: string; description: string }> = [
  { id: 'glass-turf', label: 'Glass Turf', description: 'Translucent glass panel with a soft specular sweep and hairline markings.' },
  { id: 'gloss-carbon', label: 'Gloss Carbon', description: 'Polished near-black slab, strong diagonal highlight, volt linework.' },
  { id: 'floodlit-night', label: 'Floodlit Night', description: 'Deep emerald night pitch lit by floodlight cones from both corners.' },
  { id: 'bone-chalk', label: 'Bone Chalk', description: 'Light board pitch with ink markings for the light theme.' },
  { id: 'volt-turf', label: 'Volt Turf', description: 'Vigor dark turf with a subtle technical grid.' },
  { id: 'midnight-glass', label: 'Midnight Glass', description: 'Translucent post-match glass over the platform ink background.' },
  { id: 'carbon-mono', label: 'Carbon Mono', description: 'Near-black monochrome analysis board with volt linework.' },
  { id: 'emerald-broadcast', label: 'Emerald Broadcast', description: 'Brighter striped broadcast turf with a chevron mow.' },
]

interface PitchSkin {
  outer: string
  from: string
  to: string
  fromOpacity: number
  toOpacity: number
  stripe: string
  stripeOpacity: number
  line: string
  grid: string
  gridOpacity: number
  /** Chevron mowing pattern instead of straight bands. */
  chevron?: number
  /** Diagonal specular band: 0 disables, 1 is a full-strength gloss sweep. */
  sheen?: number
  /** Floodlight glow in the corners, 0–1. */
  floodlights?: number
  /** Hairline inner edge and top-left highlight for a glass panel look. */
  glassEdge?: number
  /** Edge darkening, 0–1. */
  vignette?: number
  /** Fine grass-blade texture instead of technical dots. */
  blades?: boolean
}

const PITCH_TEMPLATE_STYLES: Record<PitchTemplate, PitchSkin> = {
  'glass-turf': {
    outer: 'rgba(255,255,255,0.05)', from: '#a9f5cf', to: '#0a2a20', fromOpacity: 0.1, toOpacity: 0.34,
    stripe: '#ffffff', stripeOpacity: 0.05, line: 'rgba(255,255,255,0.72)', grid: '#ffffff', gridOpacity: 0.12,
    chevron: 8, sheen: 0.8, glassEdge: 1, vignette: 0.24,
  },
  'gloss-carbon': {
    outer: '#040706', from: '#1a2320', to: '#03080a', fromOpacity: 1, toOpacity: 1,
    stripe: '#ffffff', stripeOpacity: 0.02, line: 'rgba(217,249,157,0.82)', grid: '#d9f99d', gridOpacity: 0.1,
    chevron: 6, sheen: 1, glassEdge: 0.6, vignette: 0.5,
  },
  'floodlit-night': {
    outer: '#04120d', from: '#0f3f2e', to: '#04140f', fromOpacity: 1, toOpacity: 1,
    stripe: '#ffffff', stripeOpacity: 0.022, line: 'rgba(246,255,244,0.8)', grid: '#c9f7d8', gridOpacity: 0.08,
    chevron: 9, sheen: 0.28, floodlights: 1, vignette: 0.6,
  },
  'bone-chalk': {
    outer: '#cfd6cc', from: '#f1f4ee', to: '#dfe6da', fromOpacity: 1, toOpacity: 1,
    stripe: '#000000', stripeOpacity: 0.018, line: 'rgba(24,34,29,0.7)', grid: '#1a231e', gridOpacity: 0.12,
    chevron: 7, sheen: 0.45, glassEdge: 0.4, vignette: 0.12,
  },
  'volt-turf': {
    outer: '#0b2e22', from: '#134636', to: '#0d3528', fromOpacity: 1, toOpacity: 1,
    stripe: '#ffffff', stripeOpacity: 0.025, line: 'rgba(236,253,186,0.82)', grid: '#d9f99d', gridOpacity: 0.11,
    sheen: 0.22, vignette: 0.32,
  },
  'midnight-glass': {
    outer: 'rgba(7,12,10,0.72)', from: '#102a24', to: '#071510', fromOpacity: 0.72, toOpacity: 0.62,
    stripe: '#ffffff', stripeOpacity: 0.018, line: 'rgba(248,250,252,0.76)', grid: '#e9fbd0', gridOpacity: 0.1,
    sheen: 0.6, glassEdge: 1, vignette: 0.28,
  },
  'carbon-mono': {
    outer: '#050707', from: '#111816', to: '#050807', fromOpacity: 1, toOpacity: 1,
    stripe: '#ffffff', stripeOpacity: 0.016, line: 'rgba(217,249,157,0.78)', grid: '#d9f99d', gridOpacity: 0.13,
    sheen: 0.45, vignette: 0.34,
  },
  'emerald-broadcast': {
    outer: '#0a3d24', from: '#17693f', to: '#0e4429', fromOpacity: 1, toOpacity: 1,
    stripe: '#ffffff', stripeOpacity: 0.04, line: 'rgba(255,255,255,0.88)', grid: '#ffffff', gridOpacity: 0.06,
    chevron: 8, sheen: 0.35, vignette: 0.28,
  },
}

/** Alternating chevron mow bands, the pattern real groundskeepers cut. */
function chevronPaths(w: number, h: number, bands: number, skew: number): string[] {
  const step = w / bands
  const paths: string[] = []
  for (let i = 0; i < bands; i += 2) {
    const x0 = i * step
    const x1 = Math.min(w, x0 + step)
    const left0 = Math.max(0, x0 - skew)
    const left1 = Math.max(0, x1 - skew)
    paths.push(
      `M ${left0} 0 L ${x0} ${h / 2} L ${left0} ${h} L ${left1} ${h} L ${x1} ${h / 2} L ${left1} 0 Z`,
    )
  }
  return paths
}

export function toView(x: number, y: number): { x: number; y: number } {
  return { x: (x / 100) * PITCH_VIEW.w, y: (y / 100) * PITCH_VIEW.h }
}

/** Convert a pointer event position to normalised pitch coordinates. */
export function svgToPitch(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = pt.matrixTransform(ctm.inverse())
  return {
    x: clamp((p.x / PITCH_VIEW.w) * 100, 0, 100),
    y: clamp((p.y / PITCH_VIEW.h) * 100, 0, 100),
  }
}

export function Pitch({
  children,
  className,
  ariaLabel = 'Football pitch',
  striped = true,
  template = 'volt-turf',
  innerRef,
  onBackgroundClick,
}: {
  children?: ReactNode
  className?: string
  ariaLabel?: string
  striped?: boolean
  template?: PitchTemplate
  innerRef?: React.Ref<SVGSVGElement>
  /** Fires when the turf itself is clicked (e.g. to dismiss an overlay);
      interactive layers should stopPropagation() on their own clicks. */
  onBackgroundClick?: () => void
}) {
  const { w, h } = PITCH_VIEW
  const style = PITCH_TEMPLATE_STYLES[template]
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gradientId = `pitch-sheen-${uid}`
  const gridId = `pitch-grid-${uid}`
  const glossId = `pitch-gloss-${uid}`
  const vignetteId = `pitch-vignette-${uid}`
  const clipId = `pitch-clip-${uid}`
  const floodId = `pitch-flood-${uid}`
  const chevrons = style.chevron ? chevronPaths(w, h, style.chevron, h * 0.22) : null
  return (
    <svg
      ref={innerRef}
      viewBox={`-2 -2 ${w + 4} ${h + 4}`}
      className={cn('block w-full select-none rounded-lg', className)}
      role="img"
      aria-label={ariaLabel}
      data-pitch-template={template}
      onClick={onBackgroundClick}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={style.from} stopOpacity={style.fromOpacity} />
          <stop offset="100%" stopColor={style.to} stopOpacity={style.toOpacity} />
        </linearGradient>
        <pattern id={gridId} width="5" height="4.857" patternUnits="userSpaceOnUse">
          <circle cx="0.35" cy="0.35" r="0.22" fill={style.grid} opacity={style.gridOpacity} />
        </pattern>
        {/* Specular sweep: a narrow band of light across the polished turf. */}
        <linearGradient id={glossId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="38%" stopColor="#ffffff" stopOpacity={(style.sheen ?? 0) * 0.035} />
          <stop offset="55%" stopColor="#ffffff" stopOpacity={(style.sheen ?? 0) * 0.075} />
          <stop offset="63%" stopColor="#ffffff" stopOpacity={(style.sheen ?? 0) * 0.14} />
          <stop offset="70%" stopColor="#ffffff" stopOpacity={(style.sheen ?? 0) * 0.05} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
        <radialGradient id={vignetteId} cx="50%" cy="50%" r="72%">
          <stop offset="55%" stopColor="#000000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={style.vignette ?? 0} />
        </radialGradient>
        <radialGradient id={floodId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbfff2" stopOpacity={(style.floodlights ?? 0) * 0.42} />
          <stop offset="40%" stopColor="#f2ffe4" stopOpacity={(style.floodlights ?? 0) * 0.16} />
          <stop offset="75%" stopColor="#eafce0" stopOpacity={(style.floodlights ?? 0) * 0.05} />
          <stop offset="100%" stopColor="#eafce0" stopOpacity={0} />
        </radialGradient>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={w} height={h} />
        </clipPath>
      </defs>
      {/* Turf */}
      <rect x={-2} y={-2} width={w + 4} height={h + 4} rx="3" fill={style.outer} />
      <rect x={0} y={0} width={w} height={h} fill={`url(#${gradientId})`} />
      <g clipPath={`url(#${clipId})`}>
        {chevrons
          ? chevrons.map((d, i) => (
              <path key={i} d={d} fill={style.stripe} opacity={style.stripeOpacity} />
            ))
          : striped &&
            Array.from({ length: 7 }, (_, i) => (
              <rect
                key={i}
                x={(i * w) / 7}
                y={0}
                width={w / 7}
                height={h}
                fill={i % 2 === 0 ? style.stripe : 'transparent'}
                opacity={style.stripeOpacity}
              />
            ))}
        <rect x={0} y={0} width={w} height={h} fill={`url(#${gridId})`} opacity={striped ? 1 : 0.7} />
        <rect x={0} y={0} width={w} height={h} fill={`url(#${vignetteId})`} />
        {style.floodlights ? (
          <>
            <ellipse cx={-2} cy={-4} rx={w * 0.62} ry={h * 1.05} fill={`url(#${floodId})`} />
            <ellipse cx={w + 2} cy={h + 4} rx={w * 0.62} ry={h * 1.05} fill={`url(#${floodId})`} />
            <ellipse cx={w / 2} cy={-h * 0.25} rx={w * 0.55} ry={h * 0.45} fill={`url(#${floodId})`} opacity={0.55} />
          </>
        ) : null}
        {style.sheen ? (
          <>
            {/* Two offset specular streaks: the leading edge plus a soft follow. */}
            <g transform={`rotate(-21 ${w / 2} ${h / 2})`}>
              <rect x={w * 0.1} y={-h} width={w * 0.3} height={h * 3} fill={`url(#${glossId})`} />
              <rect
                x={w * 0.44}
                y={-h}
                width={w * 0.16}
                height={h * 3}
                fill={`url(#${glossId})`}
                opacity={0.6}
              />
            </g>
          </>
        ) : null}
        {style.glassEdge ? (
          <rect
            x={0.4}
            y={0.4}
            width={w - 0.8}
            height={h - 0.8}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.16 * style.glassEdge}
            strokeWidth={0.9}
          />
        ) : null}
      </g>
      {/* Lines */}
      <g stroke={style.line} strokeWidth={0.55} fill="none">
        <rect x={0} y={0} width={w} height={h} />
        <line x1={w / 2} y1={0} x2={w / 2} y2={h} />
        <circle cx={w / 2} cy={h / 2} r={9.15} />
        <circle cx={w / 2} cy={h / 2} r={0.6} fill={style.line} stroke="none" />
        {/* Left penalty area */}
        <rect x={0} y={h / 2 - 20.16} width={16.5} height={40.32} />
        <rect x={0} y={h / 2 - 9.16} width={5.5} height={18.32} />
        <circle cx={11} cy={h / 2} r={0.5} fill={style.line} stroke="none" />
        <path d={`M 16.5 ${h / 2 - 9.15} A 9.15 9.15 0 0 1 16.5 ${h / 2 + 9.15}`} />
        {/* Right penalty area */}
        <rect x={w - 16.5} y={h / 2 - 20.16} width={16.5} height={40.32} />
        <rect x={w - 5.5} y={h / 2 - 9.16} width={5.5} height={18.32} />
        <circle cx={w - 11} cy={h / 2} r={0.5} fill={style.line} stroke="none" />
        <path d={`M ${w - 16.5} ${h / 2 - 9.15} A 9.15 9.15 0 0 0 ${w - 16.5} ${h / 2 + 9.15}`} />
        {/* Goals */}
        <rect x={-1.8} y={h / 2 - 3.66} width={1.8} height={7.32} />
        <rect x={w} y={h / 2 - 3.66} width={1.8} height={7.32} />
      </g>
      {children}
    </svg>
  )
}

/** Zone shading (e.g. build-up / final-third zones). */
export function ZoneOverlay({
  xFrom,
  xTo,
  color = 'rgba(183, 242, 68, 0.08)',
  label,
}: {
  xFrom: number
  xTo: number
  color?: string
  label?: string
}) {
  const a = toView(xFrom, 0)
  const b = toView(xTo, 100)
  return (
    <g>
      <rect
        x={a.x}
        y={a.y}
        width={b.x - a.x}
        height={b.y - a.y}
        fill={color}
        stroke="rgba(236,241,251,0.15)"
        strokeDasharray="2 2"
        strokeWidth={0.4}
      />
      {label && (
        <text
          x={a.x + 1.5}
          y={5}
          fontSize={3}
          fill="rgba(236,241,251,0.45)"
          style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          {label}
        </text>
      )}
    </g>
  )
}

/** Demo touch-map / action scatter layer. */
export function TouchMapLayer({
  points,
  color = 'rgba(183, 242, 68, 0.55)',
  maxWeight = 3,
}: {
  points: TouchPoint[]
  color?: string
  maxWeight?: number
}) {
  return (
    <g aria-hidden>
      {points.map((p, i) => {
        const v = toView(p.x, p.y)
        const r = 1.6 + (p.w / maxWeight) * 1.8
        return <circle key={i} cx={v.x} cy={v.y} r={r} fill={color} opacity={0.28} />
      })}
    </g>
  )
}

/**
 * Event-based heat map layer: a Gaussian kernel-density estimate of the given
 * positioned events, rendered as smoothed, colour-ramped cells. Deterministic
 * and honest — the caller is responsible for disclosing the sample size
 * (see MIN_EVENTS_FOR_HEATMAP).
 */
export function HeatMapLayer({ points }: { points: PitchPoint[] }) {
  const filterId = useId()
  const { cells, max } = useMemo(() => computeHeatGrid(points), [points])
  if (max <= 0) return null
  const cw = PITCH_VIEW.w / HEAT_GRID.cols
  const ch = PITCH_VIEW.h / HEAT_GRID.rows
  // Draw cool cells first so hot centres remain legible where cells overlap.
  const orderedCells = [...cells].sort((a, b) => a.d - b.d)
  return (
    <g aria-hidden data-testid="heat-map-layer" pointerEvents="none" opacity={0.98}>
      <defs>
        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={1.7} />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        {orderedCells.map((cell, i) => {
          const v = toView(cell.x, cell.y)
          // A square-root intensity curve makes the realistic mid-density
          // shoulder visible instead of only a tiny red bullseye. Cells also
          // overlap and blur into one continuous cloud, SofaScore-style.
          const intensity = Math.pow(Math.min(1, cell.d / max), 0.48)
          return (
            <rect
              key={i}
              x={v.x - cw * 0.78}
              y={v.y - ch * 0.78}
              width={cw * 1.56}
              height={ch * 1.56}
              rx={0.8}
              fill={heatColor(intensity)}
            />
          )
        })}
      </g>
    </g>
  )
}

/**
 * Hexagonal heat layer for normalised event/point data. This is the same
 * visual language as Game Mode's post-match map, so a heat map looks like a
 * heat map everywhere in the platform.
 */
export function HexHeatPointLayer({ points, radius = HEX_RADIUS_M.coarse }: { points: PitchPoint[]; radius?: number }) {
  const cells = useMemo(() => computeHexHeat(points, radius), [points, radius])
  if (!cells.length) return null
  return <HexHeatMapLayer cells={cells} radius={radius} />
}

export interface HexHeatCell {
  x: number
  y: number
  value: number
}

/**
 * Monochrome position-density layer in true pitch metres: small white
 * hexagons whose brightness and opacity rise with time spent in that cell.
 * Built from real one-second position samples (Game Mode) or positioned
 * events (platform match analysis) rather than a decorative cloud.
 */
export function HexHeatMapLayer({ cells, radius = HEX_RADIUS_M.fine }: { cells: HexHeatCell[]; radius?: number }) {
  const max = Math.max(0, ...cells.map((c) => c.value))
  if (max <= 0) return null
  const pointsFor = (x: number, y: number) => Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i)
    return `${(x + radius * Math.cos(angle)).toFixed(2)},${(y + radius * Math.sin(angle)).toFixed(2)}`
  }).join(' ')
  return (
    <g aria-hidden data-testid="hex-heat-map-layer" pointerEvents="none">
      {cells.filter((cell) => cell.value > 0).sort((a, b) => a.value - b.value).map((cell, i) => {
        const intensity = Math.pow(Math.min(1, cell.value / max), 0.62)
        return (
          <polygon
            key={i}
            points={pointsFor(cell.x, cell.y)}
            fill="#ffffff"
            fillOpacity={0.04 + intensity * 0.62}
            stroke="#ffffff"
            strokeOpacity={0.05 + intensity * 0.22}
            strokeWidth={0.07}
          />
        )
      })}
    </g>
  )
}

import type { MapSegment } from '@/lib/playerMaps'

/**
 * Pass/carry arrows layer: two-point segments in attacking orientation.
 * Progressive segments (>= 10 units forward) draw in volt; the rest are
 * quiet. Optionally end dots are drawn (carries end where the dribble stops).
 */
export function SegmentsLayer({
  segments,
  showEndDots = false,
}: {
  segments: MapSegment[]
  showEndDots?: boolean
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const voltId = `seg-volt-${uid}`
  const faintId = `seg-faint-${uid}`
  const VOLT = '#d4f93a'
  const FAINT = 'rgba(250,250,250,0.55)'
  return (
    <g aria-hidden>
      <defs>
        <marker id={voltId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="2.4" markerHeight="2.4" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={VOLT} />
        </marker>
        <marker id={faintId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="2.2" markerHeight="2.2" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={FAINT} />
        </marker>
      </defs>
      {segments.map((s, i) => {
        const a = toView(s.x, s.y)
        const b = toView(s.endX, s.endY)
        const hot = s.progressive
        return (
          <g key={i}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={hot ? VOLT : FAINT}
              strokeWidth={hot ? 0.5 : 0.3}
              opacity={hot ? 0.85 : 0.4}
              markerEnd={`url(#${hot ? voltId : faintId})`}
            />
            <circle cx={a.x} cy={a.y} r={0.55} fill={hot ? VOLT : FAINT} opacity={0.8} />
            {showEndDots && <circle cx={b.x} cy={b.y} r={0.7} fill="#fafafa" opacity={0.85} />}
          </g>
        )
      })}
    </g>
  )
}
