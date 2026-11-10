import { beforeEach, describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import { AssistantPage } from '@/pages/AssistantPage'
import { renderWithApp } from '@/test/test-utils'
import { settingsStore } from '@/state/settings'
import { buildDemoDataset } from '@/data/generate'

const ds = buildDemoDataset()
const topScorer = [...ds.players].sort((a, b) => b.stats.goals - a.stats.goals)[0]!

describe('AssistantPage (deterministic mock provider)', () => {
  beforeEach(() => {
    settingsStore.set({ demoMode: true, showMetricDefinitionsInline: false, realDataEnabled: false })
  })

  it('clearly labels the provider as a demonstration, not a live AI', async () => {
    renderWithApp(<AssistantPage />, { route: '/assistant' })
    expect(await screen.findByText(/Demonstration provider — not a live AI/i)).toBeInTheDocument()
    expect(screen.getByText('Deterministic mock')).toBeInTheDocument()
  })

  it('answers a build-up question from retrieved demo data with citations', async () => {
    const user = userEvent.setup()
    renderWithApp(<AssistantPage />, { route: '/assistant' })
    const input = await screen.findByLabelText(/Research question/i)
    await user.type(input, `How does ${topScorer.name} perform during build-up?`)
    await user.click(screen.getByRole('button', { name: /^Ask$/i }))

    // The answer names the player and shows build-up metrics.
    expect((await screen.findAllByText(new RegExp(topScorer.name, 'i'))).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/Build-up receptions/i)).length).toBeGreaterThan(0)
    // The per-answer mock badge is shown.
    expect(screen.getByText(/MOCK · DEMONSTRATION/i)).toBeInTheDocument()
    // Citations link back to the player record (exact match: the label chip).
    expect(await screen.findByText('Cited records')).toBeInTheDocument()
    expect(
      screen.getAllByText(new RegExp(`Player record: ${topScorer.name} \\(DEMO\\)`, 'i')).length,
    ).toBeGreaterThan(0)
    // The mock disclosure is attached to every answer.
    expect(screen.getAllByText(/Deterministic mock response — demonstration only/i).length).toBeGreaterThan(0)
  })

  it('answers the limitations question with the gated metric list', async () => {
    const user = userEvent.setup()
    renderWithApp(<AssistantPage />, { route: '/assistant' })
    const input = await screen.findByLabelText(/Research question/i)
    await user.type(input, 'What are the main limitations of the available evidence?')
    await user.click(screen.getByRole('button', { name: /^Ask$/i }))
    expect(await screen.findByText(/Main limitations of the current evidence base/i)).toBeInTheDocument()
    expect(screen.getByText(/No video-processing pipeline exists/i)).toBeInTheDocument()
  })
})
