import { beforeEach, describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import { PlayerProfilePage } from '@/pages/PlayerProfilePage'
import { renderWithApp } from '@/test/test-utils'
import { settingsStore } from '@/state/settings'
import { buildDemoDataset } from '@/data/generate'
import { computePlayerPassMap } from '@/lib/playerMaps'

const ds = buildDemoDataset()
const player = ds.players.find((p) => p.stats.minutes > 300)!

describe('PlayerProfilePage', () => {
  beforeEach(() => {
    settingsStore.set({ demoMode: true, showMetricDefinitionsInline: false, realDataEnabled: false })
  })

  it('opens on the Performance tab and links to the action map on Tactical identity', async () => {
    const user = userEvent.setup()
    renderWithApp(<PlayerProfilePage />, { route: `/players/${player.id}`, path: '/players/:playerId' })

    // Profile header appears.
    expect(await screen.findByText(player.name)).toBeInTheDocument()

    // The Performance tab is active by default (metric cards are visible).
    expect(screen.getByRole('tab', { name: /Performance/i, selected: true })).toBeInTheDocument()

    // The quick link switches to Tactical identity, which contains the action map.
    await user.click(screen.getByRole('button', { name: /View demo action map & tactical identity/i }))
    expect(await screen.findByText('Position & action map')).toBeInTheDocument()
    expect(
      screen.getByText(/Demo spatial sample .* generated for this player's position, minutes and team style/i),
    ).toBeInTheDocument()
  })

  it('shows season pass & carry maps with the stored sample size disclosed', async () => {
    const user = userEvent.setup()
    const cmPlayer = ds.players.find((p) => p.position === 'CM' && p.stats.minutes > 700)!
    const passMap = computePlayerPassMap(ds.events, ds.matches, cmPlayer)
    renderWithApp(<PlayerProfilePage />, { route: `/players/${cmPlayer.id}`, path: '/players/:playerId' })

    await user.click(await screen.findByRole('tab', { name: /Tactical identity/i }))
    expect(await screen.findByText('Pass & carry maps — season')).toBeInTheDocument()
    // Arrows render inside the labelled pitch svg.
    const pitch = screen.getByRole('img', { name: /Season pass map/i })
    expect(pitch.querySelectorAll('line[marker-end]').length).toBe(passMap.sampleCompleted)
    // Honest sampling note with the actual counts.
    expect(screen.getByText(new RegExp(`${passMap.sampleCompleted} completed of`, 'i'))).toBeInTheDocument()

    // Switching to carries swaps the layer.
    await user.click(screen.getByRole('button', { name: 'Carries' }))
    expect(await screen.findByText('Total distance')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Season carry map/i })).toBeInTheDocument()
  })

  it('shows percentile bars, the shot map card and the export-card button', async () => {
    const user = userEvent.setup()
    const scorer = [...ds.players].sort((a, b) => b.stats.goals - a.stats.goals)[0]!
    renderWithApp(<PlayerProfilePage />, { route: `/players/${scorer.id}`, path: '/players/:playerId' })

    // Percentile bars on Performance + export action in the header.
    expect(await screen.findByText(/Percentile profile vs/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export card \(SVG\)/i })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Tactical identity/i }))
    expect(await screen.findByText('Shot map & shot quality — season')).toBeInTheDocument()
    const map = screen.getByRole('img', { name: /Season shot map/i })
    expect(map.querySelectorAll('circle').length).toBeGreaterThan(20)
    expect(screen.getByText('Big chances (xG≥.3)')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Shot quality distribution/i })).toBeInTheDocument()
  })
})
