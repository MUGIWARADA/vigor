import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { NewsPage } from '@/pages/NewsPage'
import { renderWithApp } from '@/test/test-utils'
import { settingsStore } from '@/state/settings'

describe('NewsPage', () => {
  beforeEach(() => {
    settingsStore.set({ demoMode: true, showMetricDefinitionsInline: false, realDataEnabled: false })
  })

  it('renders fictional demo articles, each labelled DEMO with a demo source', async () => {
    renderWithApp(<NewsPage />, { route: '/news' })
    // Wait for async data load.
    expect(await screen.findAllByText(/Demo record — no external article exists/i)).not.toHaveLength(0)
    // Every visible provenance trigger mentions DEMO.
    const demoBadges = screen.getAllByRole('button', { name: /Data provenance: DEMO/i })
    expect(demoBadges.length).toBeGreaterThanOrEqual(10)
    // Fictional sources are named.
    expect(screen.getAllByText(/demo source/i).length).toBeGreaterThan(5)
  })

  it('states that no real feed is connected', async () => {
    renderWithApp(<NewsPage />, { route: '/news' })
    expect(await screen.findByText(/Sources policy/i)).toBeInTheDocument()
    expect(screen.getByText(/never scrape sites against\s+their terms of service/i)).toBeInTheDocument()
  })

  it('shows an explicit empty state when demo data is disabled', async () => {
    settingsStore.set({ demoMode: false, showMetricDefinitionsInline: false, realDataEnabled: false })
    renderWithApp(<NewsPage />, { route: '/news' })
    expect(await screen.findByText(/No news sources connected/i)).toBeInTheDocument()
  })
})
