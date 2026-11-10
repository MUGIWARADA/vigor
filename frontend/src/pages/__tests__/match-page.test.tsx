import { beforeEach, describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import { MatchDetailPage } from '@/pages/MatchPages'
import { renderWithApp } from '@/test/test-utils'
import { settingsStore } from '@/state/settings'
import { buildDemoDataset } from '@/data/generate'

const ds = buildDemoDataset()
const match = ds.matches[0]!

describe('MatchDetailPage', () => {
  beforeEach(() => {
    settingsStore.set({ demoMode: true, showMetricDefinitionsInline: false, realDataEnabled: false })
  })

  it('renders the match header and event timeline', async () => {
    renderWithApp(<MatchDetailPage />, { route: `/matches/${match.id}`, path: '/matches/:matchId' })
    expect(await screen.findByText(new RegExp(`Matchday ${match.round}`, 'i'))).toBeInTheDocument()
    expect(screen.getByText('Event timeline')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Back to matches' }).getAttribute('href')).toBe('/matches')
    expect(screen.getByText('Pitch visualisation')).toBeInTheDocument()
    expect(screen.getByText('Manual event tagging')).toBeInTheDocument()
  })

  it('focuses a player by clicking their name in the event panel and shows their event-position map', async () => {
    const user = userEvent.setup()
    renderWithApp(<MatchDetailPage />, { route: `/matches/${match.id}`, path: '/matches/:matchId' })
    await screen.findByText(new RegExp(`Matchday ${match.round}`, 'i'))

    // Click timeline markers until one with a linked player is selected, then
    // click the player's name (a focus button, not a navigation link).
    const markers = screen.getAllByRole('button', { name: /minutes/i })
    let focused = false
    for (const marker of markers.slice(0, 8)) {
      await user.click(marker)
      const nameBtns = screen.queryAllByTitle("Show this player's event positions on the pitch")
      if (nameBtns.length > 0) {
        await user.click(nameBtns[0]!)
        focused = true
        break
      }
    }
    expect(focused).toBe(true)

    // The player-focus note appears with the honest data caveat.
    expect(await screen.findByText(/tagged events in this match/i)).toBeInTheDocument()
    expect(screen.getByText(/true positional heat map requires tracking/i)).toBeInTheDocument()
    // The focus selector is visible in the pitch card header.
    expect(screen.getByLabelText(/Focus player/i)).toBeInTheDocument()
    // Profile navigation is still available as an explicit link.
    expect(screen.getByRole('link', { name: /profile →/i })).toBeInTheDocument()
  })

  it('shows average positions and a per-player heat map on click', async () => {
    const user = userEvent.setup()
    renderWithApp(<MatchDetailPage />, { route: `/matches/${match.id}`, path: '/matches/:matchId' })
    await screen.findByText(new RegExp(`Matchday ${match.round}`, 'i'))

    // Switch to the average-positions view.
    await user.click(screen.getByRole('tab', { name: 'Average positions' }))
    expect(screen.getByRole('img', { name: /average positions of positioned events/i })).toBeInTheDocument()

    // Player dots are interactive buttons with their sample size in the label.
    const dots = screen.getAllByRole('button', { name: /average position from \d+ positioned events/i })
    expect(dots.length).toBeGreaterThan(0)

    // Clicking a dot overlays that player's heat map without leaving the view.
    await user.click(dots[0]!)
    expect(await screen.findByText(/Event-based heat map/i)).toBeInTheDocument()
    const pitchSvg = screen.getByRole('img', { name: /showing heat map for /i })
    const heatLayer = pitchSvg.querySelector('[data-testid="hex-heat-map-layer"]')
    expect(heatLayer).not.toBeNull()
    // The heat cloud is later in SVG order than the player dots, so it can
    // dominate/overshadow them, while remaining pointer-transparent.
    expect(dots[0]!.compareDocumentPosition(heatLayer!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close heat map' })).toBeInTheDocument()
    expect(screen.getByText(/not player tracking data/i)).toBeInTheDocument()

    // The dots stay mounted — a second player can be clicked directly (swap).
    const dotsAfter = screen.getAllByRole('button', { name: /average position from \d+ positioned events/i })
    expect(dotsAfter.length).toBe(dots.length)
    await user.click(dotsAfter[1]!)
    expect(screen.getByText(/Event-based heat map/i)).toBeInTheDocument()

    // Clicking the open turf (not a player) also clears the heat map.
    await user.click(screen.getByRole('img', { name: /showing heat map for /i }))
    expect(screen.queryByText(/hexagons in true pitch metres/i)).not.toBeInTheDocument()

    // Re-open, then clicking the selected player again clears it too (the
    // heat-map caption is replaced by the plain average-positions caption).
    await user.click(dots[0]!)
    expect(await screen.findByText(/hexagons in true pitch metres/i)).toBeInTheDocument()
    const hideButtons = screen.getAllByRole('button', { name: /hide heat map/i })
    await user.click(hideButtons[0]!)
    expect(screen.queryByText(/hexagons in true pitch metres/i)).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /average positions of positioned events/i })).toBeInTheDocument()
  })

  it('opens heat maps from the player list and cycles players with the arrows', async () => {
    const user = userEvent.setup()
    renderWithApp(<MatchDetailPage />, { route: `/matches/${match.id}`, path: '/matches/:matchId' })
    await screen.findByText(new RegExp(`Matchday ${match.round}`, 'i'))
    await user.click(screen.getByRole('tab', { name: 'Average positions' }))

    // The roster list rows below the pitch open heat maps too (the dot labels
    // say "average position from N …", so this pattern targets list rows only).
    const listRows = screen.getAllByRole('button', { name: /, \d+ positioned events — show heat map$/i })
    expect(listRows.length).toBeGreaterThan(0)
    await user.click(listRows[0]!)
    expect(await screen.findByText(/Event-based heat map/i)).toBeInTheDocument()

    // The pitch names the selected player; the arrows swap players seamlessly.
    const pitch = () => screen.getByRole('img', { name: /Average positions of positioned events/i })
    const firstLabel = pitch().getAttribute('aria-label')
    expect(firstLabel).toMatch(/showing heat map for /)
    await user.click(screen.getByRole('button', { name: 'Next player' }))
    expect(screen.getByText(/Event-based heat map/i)).toBeInTheDocument()
    expect(pitch().getAttribute('aria-label')).not.toBe(firstLabel)
    await user.click(screen.getByRole('button', { name: 'Previous player' }))
    expect(screen.getByText(/Event-based heat map/i)).toBeInTheDocument()
    expect(pitch().getAttribute('aria-label')).toBe(firstLabel)

    // Roster rows for players without positioned events render disabled (none
    // exist in this fixture — every participant has positioned events).
    const disabled = screen.queryAllByRole('button', { name: /no positioned events in this match/i })
    for (const btn of disabled) expect(btn).toBeDisabled()
  })

  it('keeps the events view as the default with the focus selector present', async () => {
    renderWithApp(<MatchDetailPage />, { route: `/matches/${match.id}`, path: '/matches/:matchId' })
    await screen.findByText(new RegExp(`Matchday ${match.round}`, 'i'))
    expect(screen.getByRole('img', { name: 'Match event positions' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Focus player/i)).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /average positions/i })).not.toBeInTheDocument()
  })

  it('average positions hide substitutes until Show subs is pressed', async () => {
    const user = userEvent.setup()
    // find a match with the most substitutions
    const subCount = new Map<string, number>()
    for (const e of ds.events) if (e.type === 'substitution') subCount.set(e.matchId, (subCount.get(e.matchId) ?? 0) + 1)
    const matchId = [...subCount.entries()].sort((a, b) => b[1] - a[1])[0]![0]
    renderWithApp(<MatchDetailPage />, { route: `/matches/${matchId}`, path: '/matches/:matchId' })
    await screen.findByText(/Event timeline/)
    await user.click(screen.getByRole('tab', { name: 'Average positions' }))
    const before = screen.queryAllByLabelText(/substitute, on at/)
    expect(before.length).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Show subs' }))
    const after = await screen.findAllByLabelText(/substitute, on at/)
    expect(after.length).toBeGreaterThan(2)
    expect(screen.getByRole('button', { name: 'Hide subs' })).toBeTruthy()
  })
})
