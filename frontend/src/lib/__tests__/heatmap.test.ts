import { describe, expect, it } from 'vitest'
import {
  averagePosition,
  computeHeatGrid,
  computeHexHeat,
  eventHeatPoints,
  heatBandwidth,
  heatColor,
  HEAT_GRID,
  MIN_EVENTS_FOR_HEATMAP,
} from '@/lib/heatmap'

describe('averagePosition', () => {
  it('returns null for no points — never (0, 0)', () => {
    expect(averagePosition([])).toBeNull()
  })

  it('returns the point itself for a single point', () => {
    expect(averagePosition([{ x: 20, y: 80 }])).toEqual({ x: 20, y: 80 })
  })

  it('returns the arithmetic mean for multiple points', () => {
    expect(averagePosition([{ x: 0, y: 0 }, { x: 100, y: 100 }])).toEqual({ x: 50, y: 50 })
    expect(averagePosition([{ x: 10, y: 20 }, { x: 30, y: 60 }, { x: 20, y: 40 }])).toEqual({
      x: 20,
      y: 40,
    })
  })
})

describe('computeHeatGrid', () => {
  it('returns an empty grid for no points', () => {
    const grid = computeHeatGrid([])
    expect(grid.cells).toHaveLength(0)
    expect(grid.max).toBe(0)
  })

  it('produces cells across the grid with a positive max for real points', () => {
    const grid = computeHeatGrid([
      { x: 50, y: 50 },
      { x: 52, y: 48 },
      { x: 55, y: 55 },
    ])
    expect(grid.max).toBeGreaterThan(0)
    expect(grid.cells.length).toBeGreaterThan(10)
    // Every cell centre lies inside the pitch.
    for (const cell of grid.cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0)
      expect(cell.x).toBeLessThanOrEqual(100)
      expect(cell.y).toBeGreaterThanOrEqual(0)
      expect(cell.y).toBeLessThanOrEqual(100)
    }
  })

  it('peaks near the cluster centre', () => {
    const grid = computeHeatGrid([{ x: 50, y: 50 }])
    const best = grid.cells.reduce((a, b) => (b.d > a.d ? b : a))
    expect(best.x).toBeGreaterThan(40)
    expect(best.x).toBeLessThan(60)
    expect(best.y).toBeGreaterThan(40)
    expect(best.y).toBeLessThan(60)
    expect(best.d).toBeCloseTo(grid.max, 10)
  })

  it('is deterministic', () => {
    const points = [
      { x: 12, y: 34 },
      { x: 56, y: 78 },
      { x: 90, y: 10 },
    ]
    expect(computeHeatGrid(points)).toEqual(computeHeatGrid(points))
  })

  it('uses a grid matching the documented resolution', () => {
    expect(HEAT_GRID.cols * HEAT_GRID.rows).toBe(42 * 28)
  })
})

describe('heatColor', () => {
  it('is fully transparent at density zero', () => {
    expect(heatColor(0)).toBe('rgba(212, 249, 58, 0.000)')
  })

  it('is the hottest red at density one', () => {
    expect(heatColor(1)).toBe('rgba(185, 28, 28, 0.900)')
  })

  it('returns valid rgba strings across the ramp and clamps out-of-range input', () => {
    for (const t of [-0.5, 0, 0.2, 0.45, 0.7, 0.9, 1, 1.7]) {
      expect(heatColor(t)).toMatch(/^rgba\(\d+, \d+, \d+, \d+\.\d{3}\)$/)
    }
  })

  it('exposes a small-sample threshold for honest captions', () => {
    expect(MIN_EVENTS_FOR_HEATMAP).toBeGreaterThan(0)
  })
})
describe('realistic heat registration', () => {
  it('uses a larger numeric y bandwidth so the rendered kernel is round in metres', () => {
    const bandwidth = heatBandwidth([{ x: 50, y: 50 }])
    expect(bandwidth.y).toBeGreaterThan(bandwidth.x * 1.45)
  })

  it('gives a genuinely wide event spread greater pitch coverage than a tight cluster', () => {
    const tight = computeHeatGrid([
      { x: 50, y: 50 }, { x: 51, y: 49 }, { x: 49, y: 51 }, { x: 50, y: 48 },
    ])
    const wide = computeHeatGrid([
      { x: 20, y: 25 }, { x: 38, y: 65 }, { x: 55, y: 35 }, { x: 72, y: 70 },
      { x: 84, y: 45 }, { x: 45, y: 82 }, { x: 65, y: 18 }, { x: 30, y: 48 },
    ])
    expect(wide.coverage).toBeGreaterThan(tight.coverage)
  })

  it('keeps touchline density hot by reflecting kernels back into the pitch', () => {
    const grid = computeHeatGrid([{ x: 50, y: 4 }, { x: 52, y: 5 }, { x: 48, y: 6 }])
    const best = grid.cells.reduce((a, b) => (b.d > a.d ? b : a))
    expect(best.y).toBeLessThan(12)
    expect(best.d).toBeCloseTo(grid.max, 10)
  })

  it('registers carry paths but does not credit a pass endpoint to the passer', () => {
    expect(eventHeatPoints([
      { type: 'progressive-carry', x: 40, y: 50, endX: 60, endY: 40 },
      { type: 'pass', x: 30, y: 30, endX: 70, endY: 70 },
    ])).toEqual([
      { x: 40, y: 50 },
      { x: 50, y: 45 },
      { x: 60, y: 40 },
      { x: 30, y: 30 },
    ])
  })
})

describe('computeHexHeat', () => {
  it('bins points into metre-scaled hexagons and weights repeats', () => {
    const cells = computeHexHeat([
      { x: 50, y: 50 },
      { x: 50.2, y: 50.2 },
      { x: 90, y: 10 },
    ], 3.4)
    expect(cells.length).toBe(2)
    const hot = cells.find((c) => c.value > 1)!
    expect(hot.value).toBe(2)
    // Cell centres are in pitch metres, not normalised units.
    expect(hot.x).toBeGreaterThan(40)
    expect(hot.x).toBeLessThan(60)
    expect(hot.y).toBeGreaterThan(25)
    expect(hot.y).toBeLessThan(45)
  })

  it('is deterministic and empty-safe', () => {
    expect(computeHexHeat([])).toEqual([])
    const points = [{ x: 30, y: 40 }, { x: 31, y: 41 }, { x: 32, y: 42 }]
    expect(computeHexHeat(points)).toEqual(computeHexHeat(points))
    // A finer radius resolves more distinct cells than a coarse one.
    const fine = computeHexHeat(points, 1.72)
    expect(fine.length).toBeGreaterThanOrEqual(computeHexHeat(points, 3.4).length)
  })
})
