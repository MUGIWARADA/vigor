/**
 * Positional overlays for match analysis: average positions and heat maps.
 *
 * Everything here is a pure, deterministic CALCULATED transform of whatever
 * positioned event data is loaded (DEMO provider events and/or MANUAL tags).
 * Nothing is invented: sparse inputs produce small, honest outputs, and the
 * caller must disclose the sample size (see MIN_EVENTS_FOR_HEATMAP).
 *
 * Pitch convention (app-wide): x ∈ [0,100] along the length (home attacks
 * toward x=100), y ∈ [0,100] across the width (0 = top touchline).
 */

export interface PitchPoint {
  x: number
  y: number
  /** Optional density weight. Events normally weigh 1; interpolated carry
   * samples can use the same weight because the ball carrier occupied the
   * whole path, not only its first coordinate. */
  w?: number
}

/** Below this many positioned events a heat map is flagged as a small sample. */
export const MIN_EVENTS_FOR_HEATMAP = 6

/** Grid resolution for the density estimate (≈ 2.4 normalized units per cell). */
export const HEAT_GRID = { cols: 42, rows: 28 } as const

/** Pitch dimensions used to make the kernel isotropic in metres. Pitch y is
 * normalised over 68m while x is normalised over 105m, so using the same
 * numeric sigma on both axes would squash every blob vertically. */
const PITCH_LENGTH_M = 105
const PITCH_WIDTH_M = 68
const MIN_BANDWIDTH_M = 7
const MAX_BANDWIDTH_M = 13
const DEFAULT_BANDWIDTH_M = 8.5

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return sorted[base]! + ((sorted[base + 1] ?? sorted[base]!) - sorted[base]!) * rest
}

function robustScale(values: number[]): number {
  if (values.length < 2) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
  const iqrScale = (quantile(sorted, 0.75) - quantile(sorted, 0.25)) / 1.34
  if (sd > 0 && iqrScale > 0) return Math.min(sd, iqrScale)
  return sd || iqrScale
}

/**
 * Data-driven Gaussian bandwidth (Silverman's rule, clamped to a realistic
 * 7–13m event-localisation footprint), returned in normalised pitch units.
 * The y value is deliberately larger numerically because 100 y-units span
 * only 68m; after rendering, the kernel is round in metres rather than a
 * squashed horizontal smear.
 */
export function heatBandwidth(points: PitchPoint[]): { x: number; y: number } {
  const fallback = {
    x: DEFAULT_BANDWIDTH_M / (PITCH_LENGTH_M / 100),
    y: DEFAULT_BANDWIDTH_M / (PITCH_WIDTH_M / 100),
  }
  if (points.length < 2) return fallback
  const factor = Math.pow(points.length, -0.2)
  const bandwidthM = (values: number[]) => {
    const scale = robustScale(values)
    if (scale <= 0) return DEFAULT_BANDWIDTH_M
    return Math.min(MAX_BANDWIDTH_M, Math.max(MIN_BANDWIDTH_M, 0.9 * scale * factor))
  }
  return {
    x: bandwidthM(points.map((p) => p.x * (PITCH_LENGTH_M / 100))) / (PITCH_LENGTH_M / 100),
    y: bandwidthM(points.map((p) => p.y * (PITCH_WIDTH_M / 100))) / (PITCH_WIDTH_M / 100),
  }
}

export interface PositionedHeatEvent {
  x?: number
  y?: number
  endX?: number
  endY?: number
  type?: string
}

/**
 * Convert positioned events into the points a heat map should register.
 * Most actions register at their start point. A progressive carry registers
 * its start, midpoint and end because the player travelled through all three;
 * a pass endpoint is not credited to the passer (it is where the ball went,
 * not where that player was).
 */
export function eventHeatPoints(events: PositionedHeatEvent[]): PitchPoint[] {
  const points: PitchPoint[] = []
  for (const event of events) {
    if (event.x === undefined || event.y === undefined) continue
    points.push({ x: event.x, y: event.y })
    if (
      event.type === 'progressive-carry' &&
      event.endX !== undefined &&
      event.endY !== undefined
    ) {
      points.push({ x: (event.x + event.endX) / 2, y: (event.y + event.endY) / 2 })
      points.push({ x: event.endX, y: event.endY })
    }
  }
  return points
}

/**
 * Mean of a set of pitch points. Returns null for empty input — a missing
 * average is never reported as (0, 0).
 */
export function averagePosition(points: PitchPoint[]): PitchPoint | null {
  if (points.length === 0) return null
  let sx = 0
  let sy = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
  }
  return { x: sx / points.length, y: sy / points.length }
}

export interface HeatCell {
  /** Cell centre in normalized pitch coordinates. */
  x: number
  y: number
  /** Raw kernel density (unnormalised, > 0). */
  d: number
}

export interface HeatGrid {
  cells: HeatCell[]
  /** Maximum raw density across the grid (0 when there are no points). */
  max: number
  /** Kernel bandwidth in normalised pitch units on each axis. */
  bandwidth: { x: number; y: number }
  /** Share of pitch cells reaching at least 10% of peak density. */
  coverage: number
}

/**
 * Gaussian kernel density estimate over the pitch. Cells with zero density
 * are omitted. Deterministic: same points → same grid.
 */
export function computeHeatGrid(points: PitchPoint[]): HeatGrid {
  const { cols, rows } = HEAT_GRID
  const bandwidth = heatBandwidth(points)
  const allCells: HeatCell[] = []
  let max = 0
  if (points.length === 0) return { cells: [], max, bandwidth, coverage: 0 }

  // Reflect kernels over all four pitch edges. Without this, a winger living
  // on the touchline loses half of every kernel outside the pitch and looks
  // artificially cold; reflection folds that density back into play.
  const kernels = points.flatMap((p) => {
    const weight = p.w ?? 1
    return [p.x, -p.x, 200 - p.x].flatMap((x) =>
      [p.y, -p.y, 200 - p.y].map((y) => ({ x, y, w: weight })),
    )
  })
  const twoSigmaXSq = 2 * bandwidth.x * bandwidth.x
  const twoSigmaYSq = 2 * bandwidth.y * bandwidth.y

  for (let r = 0; r < rows; r++) {
    const y = ((r + 0.5) / rows) * 100
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) / cols) * 100
      let d = 0
      for (const p of kernels) {
        const dx = p.x - x
        const dy = p.y - y
        d += p.w * Math.exp(-(dx * dx) / twoSigmaXSq - (dy * dy) / twoSigmaYSq)
      }
      allCells.push({ x, y, d })
      if (d > max) max = d
    }
  }
  const threshold = max * 0.025
  const cells = allCells.filter((cell) => cell.d >= threshold)
  const coverage = max > 0 ? allCells.filter((cell) => cell.d >= max * 0.1).length / allCells.length : 0
  return { cells, max, bandwidth, coverage }
}

/**
 * Hexagonal position-density grid, the same visual language as Game Mode's
 * post-match heat map: flat-top hexagons in true pitch metres, brightness
 * rising with how much time (or how many events) sat in that cell.
 *
 * The grid is built in metres so a hexagon is a hexagon on a 105x68 pitch
 * rather than a squashed shape in normalised coordinates.
 */
export const HEX_RADIUS_M: { fine: number; coarse: number } = { fine: 1.72, coarse: 3.4 }

export interface HexHeatCell {
  /** Cell centre in pitch metres. */
  x: number
  y: number
  value: number
}

/**
 * Bin normalised pitch points into flat-top hexagons of `radiusM` metres.
 * Deterministic: same points and radius always give the same cells.
 */
export function computeHexHeat(points: PitchPoint[], radiusM = HEX_RADIUS_M.coarse): HexHeatCell[] {
  if (!points.length) return []
  const radius = Math.max(0.5, radiusM)
  const colStep = radius * 1.5
  const rowStep = Math.sqrt(3) * radius
  const buckets = new Map<string, HexHeatCell>()
  for (const point of points) {
    const px = (point.x / 100) * PITCH_LENGTH_M
    const py = (point.y / 100) * PITCH_WIDTH_M
    // Flat-top axial rounding: work out the nearest hex centre.
    const col = Math.round(px / colStep)
    const offset = col % 2 !== 0 ? rowStep / 2 : 0
    const row = Math.round((py - offset) / rowStep)
    const cx = col * colStep
    const cy = row * rowStep + offset
    if (cx < -radius || cx > PITCH_LENGTH_M + radius || cy < -radius || cy > PITCH_WIDTH_M + radius) continue
    const key = `${col}:${row}`
    const weight = point.w ?? 1
    const bucket = buckets.get(key)
    if (bucket) bucket.value += weight
    else buckets.set(key, { x: cx, y: cy, value: weight })
  }
  return [...buckets.values()]
}

interface Stop {
  t: number
  rgb: [number, number, number]
  a: number
}

/** Colour ramp for normalized density (cool → hot), tuned for the dark pitch. */
const RAMP: Stop[] = [
  { t: 0.0, rgb: [212, 249, 58], a: 0.0 },
  { t: 0.12, rgb: [163, 230, 53], a: 0.16 },
  { t: 0.32, rgb: [250, 204, 21], a: 0.38 },
  { t: 0.55, rgb: [249, 115, 22], a: 0.58 },
  { t: 0.78, rgb: [239, 68, 68], a: 0.76 },
  { t: 1.0, rgb: [185, 28, 28], a: 0.9 },
]

/** RGBA colour for a normalized density t ∈ [0,1]. Deterministic. */
export function heatColor(t: number): string {
  const v = Math.min(1, Math.max(0, t))
  for (let i = 1; i < RAMP.length; i++) {
    const a = RAMP[i - 1]!
    const b = RAMP[i]!
    if (v <= b.t) {
      const span = b.t - a.t
      const f = span <= 0 ? 0 : (v - a.t) / span
      const rgb = a.rgb.map((c, j) => Math.round(c + (b.rgb[j]! - c) * f)) as [number, number, number]
      const alpha = a.a + (b.a - a.a) * f
      return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`
    }
  }
  const last = RAMP[RAMP.length - 1]!
  return `rgba(${last.rgb[0]}, ${last.rgb[1]}, ${last.rgb[2]}, ${last.a})`
}
