import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { Pitch, PITCH_TEMPLATES, PITCH_VIEW, TouchMapLayer, HeatMapLayer, HexHeatMapLayer, toView } from '@/components/pitch/Pitch'
import { renderWithApp } from '@/test/test-utils'

describe('Pitch', () => {
  it('renders an accessible SVG pitch', () => {
    renderWithApp(<Pitch ariaLabel="Test pitch" />)
    const svg = screen.getByRole('img', { name: 'Test pitch' })
    expect(svg).toBeInTheDocument()
    expect(svg.getAttribute('viewBox')).toBe(`-2 -2 ${PITCH_VIEW.w + 4} ${PITCH_VIEW.h + 4}`)
  })

  it('renders touch map points as circles', () => {
    renderWithApp(
      <Pitch ariaLabel="Touch map">
        <TouchMapLayer points={[{ x: 50, y: 50, w: 2 }, { x: 80, y: 20, w: 1 }]} />
      </Pitch>,
    )
    const circles = screen.getByRole('img', { name: 'Touch map' }).querySelectorAll('circle[fill]')
    // 2 touch points + centre spot + 2 penalty spots = at least 5 filled circles
    expect(circles.length).toBeGreaterThanOrEqual(5)
  })

  it('renders a heat map layer as coloured density cells', () => {
    renderWithApp(
      <Pitch ariaLabel="Heat map">
        <HeatMapLayer points={[{ x: 30, y: 70 }, { x: 33, y: 66 }, { x: 75, y: 25 }]} />
      </Pitch>,
    )
    const svg = screen.getByRole('img', { name: 'Heat map' })
    const cells = svg.querySelectorAll('rect[fill^="rgba("]')
    expect(cells.length).toBeGreaterThan(20)
    // The blur filter definition is present for smoothing.
    expect(svg.querySelector('filter')).not.toBeNull()
    const layer = svg.querySelector('[data-testid="heat-map-layer"]')
    expect(layer?.getAttribute('pointer-events')).toBe('none')
  })

  it('renders pitch templates and a hexagonal heat layer', () => {
    renderWithApp(
      <Pitch ariaLabel="Glass hex pitch" template="midnight-glass">
        <HexHeatMapLayer cells={[{ x: 25, y: 34, value: 4 }, { x: 30, y: 34, value: 12 }, { x: 80, y: 20, value: 2 }]} />
      </Pitch>,
    )
    const svg = screen.getByRole('img', { name: 'Glass hex pitch' })
    expect(svg.getAttribute('data-pitch-template')).toBe('midnight-glass')
    const layer = svg.querySelector('[data-testid="hex-heat-map-layer"]')
    expect(layer).not.toBeNull()
    expect(layer?.querySelectorAll('polygon')).toHaveLength(3)
  })

  it('offers glossy, translucent and light pitch designs alongside the dark ones', () => {
    const ids = PITCH_TEMPLATES.map((t) => t.id)
    expect(ids).toEqual(expect.arrayContaining([
      'glass-turf', 'gloss-carbon', 'floodlit-night', 'bone-chalk',
      'volt-turf', 'midnight-glass', 'carbon-mono', 'emerald-broadcast',
    ]))
    // Every design renders as a pitch, and the glossy ones carry their extra
    // light layers: chevron mow bands, specular streaks and floodlight glow.
    for (const template of PITCH_TEMPLATES) {
      const { container, unmount } = renderWithApp(<Pitch ariaLabel={`Pitch ${template.id}`} template={template.id} />)
      const svg = container.querySelector('svg')!
      expect(svg.getAttribute('data-pitch-template')).toBe(template.id)
      expect(svg.querySelectorAll('path').length).toBeGreaterThan(0)
      unmount()
    }
    const { container } = renderWithApp(<Pitch ariaLabel="Gloss" template="gloss-carbon" />)
    // Chevron bands plus the two streaks.
    expect(container.querySelectorAll('path').length).toBeGreaterThanOrEqual(3)
    expect(container.querySelectorAll('linearGradient').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelectorAll('radialGradient').length).toBeGreaterThanOrEqual(2)
  })

  it('renders no heat cells when there are no points', () => {
    renderWithApp(
      <Pitch ariaLabel="Empty heat map">
        <HeatMapLayer points={[]} />
      </Pitch>,
    )
    const svg = screen.getByRole('img', { name: 'Empty heat map' })
    expect(svg.querySelectorAll('rect[fill^="rgba("]')).toHaveLength(0)
  })
})

describe('toView', () => {
  it('maps normalised 0–100 coordinates onto 105×68 view coordinates', () => {
    expect(toView(0, 0)).toEqual({ x: 0, y: 0 })
    expect(toView(100, 100)).toEqual({ x: 105, y: 68 })
    expect(toView(50, 50)).toEqual({ x: 52.5, y: 34 })
  })
})
