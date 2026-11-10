import { beforeEach, describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen, within } from '@testing-library/react'
import { PlayersPage } from '@/pages/PlayersPage'
import { renderWithApp } from '@/test/test-utils'
import { settingsStore } from '@/state/settings'
import { buildDemoDataset } from '@/data/generate'

const ds = buildDemoDataset()
const anyPlayer = ds.players.find((p) => p.stats.minutes > 300)!

describe('PlayersPage', () => {
  beforeEach(() => {
    settingsStore.set({ demoMode: true, showMetricDefinitionsInline: false, realDataEnabled: false })
    localStorage.removeItem('tiq.globalFilters')
  })

  it('renders player rows from the demo dataset with a DEMO label', async () => {
    renderWithApp(<PlayersPage />, { route: '/players' })
    // Data loads asynchronously through the mock API provider.
    const rows = await screen.findAllByRole('row')
    expect(rows.length).toBeGreaterThan(5)
    // Every row carries a compact DEMO provenance dot (aria-label on the badge button).
    const demoLabels = screen.getAllByRole('button', { name: /Data provenance: DEMO/i })
    expect(demoLabels.length).toBeGreaterThan(5)
    // Pagination summary is present.
    expect(screen.getByText(/of 2304/i)).toBeInTheDocument()
  })

  it('filters by name search', async () => {
    const user = userEvent.setup()
    renderWithApp(<PlayersPage />, { route: '/players' })
    await screen.findAllByRole('row')
    const search = await screen.findByLabelText(/Search/i)
    await user.clear(search)
    await user.type(search, anyPlayer.name)
    // The matching player appears; row count shrinks to header + matches.
    const rows = await screen.findAllByRole('row')
    expect(rows.length).toBeLessThanOrEqual(13)
    expect(screen.getAllByText(anyPlayer.name).length).toBeGreaterThan(0)
  })

  it('shows a message when the search matches nobody', async () => {
    const user = userEvent.setup()
    renderWithApp(<PlayersPage />, { route: '/players' })
    await screen.findAllByRole('row')
    await user.type(await screen.findByLabelText(/Search/i), 'Zzzz No Such Player')
    expect(await screen.findByText(/No players match these filters/i)).toBeInTheDocument()
  })

  it('shows an explicit empty state when demo data is disabled (no silent substitution)', async () => {
    settingsStore.set({ demoMode: false, showMetricDefinitionsInline: false, realDataEnabled: false })
    renderWithApp(<PlayersPage />, { route: '/players' })
    expect(await screen.findByText(/No player data available/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open settings/i })).toBeInTheDocument()
    // No player rows sneak in.
    expect(screen.queryByRole('row')).not.toBeInTheDocument()
  })
})

describe('PlayersPage table content', () => {
  beforeEach(() => {
    settingsStore.set({ demoMode: true, showMetricDefinitionsInline: false, realDataEnabled: false })
  })

  it('shows the count of filtered players', async () => {
    renderWithApp(<PlayersPage />, { route: '/players' })
    await screen.findAllByRole('row')
    const badge = await screen.findByText(/2304 players/i)
    expect(badge).toBeInTheDocument()
    const firstRow = screen.getAllByRole('row')[1]!
    expect(within(firstRow).getAllByText(/GK|CB|LB|RB|DM|CM|AM|LW|RW|ST/).length).toBeGreaterThan(0)
  })
})
