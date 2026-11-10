import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithApp } from '@/test/test-utils'
import { createDefaultPlan } from '../data'
import { simulateMatch } from '../engine'
import { PostMatchReport } from '../PostMatchReport'

function finishedMatch() {
  return simulateMatch({
    homePlan: createDefaultPlan('bracelonia'),
    awayPlan: createDefaultPlan('banyarn'),
    difficulty: 'normal',
    rules: 'standard',
    halfSeconds: 24,
    humanTeams: [],
    seed: 4242,
  }, 48, 0.05)
}

describe('PostMatchReport', () => {
  it('shows full-time statistics with one pitch that switches team and map type', async () => {
    const user = userEvent.setup()
    renderWithApp(<PostMatchReport state={finishedMatch()} pitchTemplate="midnight-glass" />)
    expect(screen.getByTestId('post-match-report')).toBeInTheDocument()
    expect(screen.getByText('Full-time report')).toBeInTheDocument()
    expect(screen.getByText('Team statistics')).toBeInTheDocument()
    expect(screen.getByText('Possession')).toBeInTheDocument()
    expect(screen.getByText('Expected goals')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Average positions' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Heat maps' })).toBeInTheDocument()

    // The report now carries two diagrams by design: the shape panel and the
    // positions panel. This assertion is about the positions one being a single
    // pitch that switches team, so it is scoped to that pitch by its label.
    expect(screen.getAllByRole('img', { name: /average positions/i })).toHaveLength(1)
    const homeMarkers = document.querySelectorAll('[data-testid^="average-position-"]').length
    expect(homeMarkers).toBeGreaterThanOrEqual(10)

    await user.click(screen.getByRole('button', { name: 'Banyarn Munic' }))
    expect(document.querySelectorAll('[data-testid^="average-position-"]').length).toBeGreaterThanOrEqual(10)
    expect(screen.getByRole('img', { name: /Banyarn Munic average positions/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Heat maps' }))
    expect(document.querySelector('[data-testid="hex-heat-map-layer"]')).not.toBeNull()
    // Two diagrams exist now by design — shape and positions — so the "one
    // pitch" claim is scoped to the positions diagram itself.
    expect(screen.getAllByRole('img', { name: /average positions|hexagonal heat map/i })).toHaveLength(1)

    // Per-player heat maps are selectable from the pitch panel.
    const playerChips = screen.getAllByRole('button', { pressed: false }).filter((b) => /^#\d+/.test(b.textContent ?? ''))
    expect(playerChips.length).toBeGreaterThan(5)
    await user.click(playerChips[0]!)
    expect(document.querySelector('[data-testid="hex-heat-map-layer"]')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Whole team' }))
    expect(document.querySelector('[data-testid="hex-heat-map-layer"]')).not.toBeNull()
  })
})
