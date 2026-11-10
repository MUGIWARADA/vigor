import { beforeEach, describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import { GameModePage } from '@/pages/GameModePage'
import { renderWithApp } from '@/test/test-utils'
import { DEFAULT_GAMEPLAY_SETTINGS } from '@/game/data'
import { EMPTY_GAME_RECORDS, gamePlansStore, gameRecordsStore, gameplaySettingsStore, gamePitchTemplateStore, gameRatingOverridesStore, lastGamePlansStore } from '@/game/storage'

describe('Community GameModePage', () => {
  beforeEach(() => {
    gamePlansStore.set([])
    gameRecordsStore.set({ ...EMPTY_GAME_RECORDS, trainingBadges: [] })
    gameplaySettingsStore.set(structuredClone(DEFAULT_GAMEPLAY_SETTINGS))
    gamePitchTemplateStore.set('volt-turf')
    gameRatingOverridesStore.set({})
    lastGamePlansStore.set({})
  })

  it('presents the fictional clubs and keeps Game Mode data clearly separate', async () => {
    renderWithApp(<GameModePage />, { route: '/game-mode' })
    expect(await screen.findByRole('heading', { name: 'Game Mode' })).toBeInTheDocument()
    expect(screen.getByText(/Fictional game content/i)).toBeInTheDocument()
    expect(screen.getAllByText('Bracelonia').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Banyarn Munic').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Kick off/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Pitch template')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Midnight Glass' })).toBeInTheDocument()
  })

  it('shows persistent EA FC-style Human and CPU gameplay sliders', async () => {
    const user = userEvent.setup()
    renderWithApp(<GameModePage />, { route: '/game-mode' })
    expect(await screen.findByText('Gameplay sliders')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Sprint Speed' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'First Touch Error' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Referee Strictness' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'CPU' }))
    expect(screen.getByRole('slider', { name: 'Shot Error' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Fullback Positioning' })).toBeInTheDocument()
  })

  it('shows checkable per-team game ratings with an editable PES sheet', async () => {
    const user = userEvent.setup()
    renderWithApp(<GameModePage />, { route: '/game-mode' })
    await user.click(await screen.findByRole('tab', { name: /Ratings/i }))
    expect(await screen.findByText('Team ratings')).toBeInTheDocument()
    expect(screen.getByText('Best XI OVR')).toBeInTheDocument()
    expect(screen.getByText('Squad OVR')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Search squad'), 'Pedri')
    await user.click(await screen.findByRole('button', { name: /Pedrilho/i }))
    expect(screen.getByText('Edit PES attributes')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Top Speed' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Short Pass Accuracy' })).toBeInTheDocument()
  })

  it('gives every shirt a role in one screen, without selecting a player first', async () => {
    const user = userEvent.setup()
    renderWithApp(<GameModePage />, { route: '/game-mode' })
    await user.click(await screen.findByRole('tab', { name: /Match Plan/i }))
    // Three units, the way a console management screen reads.
    expect(await screen.findByText('Defence')).toBeInTheDocument()
    expect(screen.getByText('Midfield')).toBeInTheDocument()
    expect(screen.getByText('Offence')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-testid^="plan-player-"]')).toHaveLength(11)
    // A role control on every starter, straight away.
    expect(screen.getAllByRole('combobox', { name: / role$/ })).toHaveLength(11)
    // Two dials, not eight sliders.
    expect(screen.getByRole('slider', { name: 'Defensive line' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Tempo' })).toBeInTheDocument()
    expect(screen.queryByRole('slider', { name: 'Compactness' })).not.toBeInTheDocument()
    // And the team style presets that set the rest.
    expect(screen.getByLabelText('Without the ball')).toBeInTheDocument()
    expect(screen.getByLabelText('With the ball')).toBeInTheDocument()
  })

  it('keeps set pieces and the squad one click away, not one long scroll', async () => {
    const user = userEvent.setup()
    renderWithApp(<GameModePage />, { route: '/game-mode' })
    await user.click(await screen.findByRole('tab', { name: /Match Plan/i }))
    await user.click(await screen.findByRole('tab', { name: 'Set pieces' }))
    expect(await screen.findByLabelText('Attacking corner')).toBeInTheDocument()
    expect(screen.getByLabelText('Defending corners')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Squad' }))
    expect(await screen.findByText('Starting XI')).toBeInTheDocument()
    expect(screen.getByText('Short Pass Accuracy')).toBeInTheDocument()
    expect(screen.getByText('Bench — 9')).toBeInTheDocument()
  })

  it('starts a live match with 22 numbered players and only one carrier name plate', async () => {
    const user = userEvent.setup()
    renderWithApp(<GameModePage />, { route: '/game-mode' })
    await user.click(await screen.findByRole('button', { name: /Kick off/i }))
    expect(await screen.findByText(/Circles r1.45m/i)).toBeInTheDocument()
    expect(document.querySelectorAll('[data-testid^="live-player-"]')).toHaveLength(22)
    expect(document.querySelectorAll('[data-testid="carrier-name-plate"]')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /Pause/i }))
    expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument()
  })

  it('runs the deterministic AI Test Bench with the current Match Plans', async () => {
    const user = userEvent.setup()
    renderWithApp(<GameModePage />, { route: '/game-mode' })
    await user.click(await screen.findByRole('tab', { name: /Watch AI \/ Test Bench/i }))
    await user.click(await screen.findByRole('button', { name: /Run 1 bench match/i }))
    expect(await screen.findByText(/Seed 1000 — BRA/i)).toBeInTheDocument()
  })
})
