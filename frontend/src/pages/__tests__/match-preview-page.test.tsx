import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MatchPreviewPage } from '@/pages/MatchPreviewPage'
import { renderWithApp } from '@/test/test-utils'
import { settingsStore } from '@/state/settings'
import { buildDemoDataset } from '@/data/generate'
import { resultForTeam, teamsInCompetition } from '@/lib/matchPreview'

const ds = buildDemoDataset()
const secondCompetition = ds.competitions[1]!
const secondLeagueTeams = teamsInCompetition(ds.matches, ds.teams, secondCompetition.id)
const team = secondLeagueTeams.find((candidate) => {
  const results = ds.matches
    .filter((match) => match.homeTeamId === candidate.id || match.awayTeamId === candidate.id)
    .map((match) => resultForTeam(match, candidate.id))
  return results.includes('W') && results.includes('L')
})!

async function pickOption(
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  name: string,
) {
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name }))
}

describe('MatchPreviewPage', () => {
  beforeEach(() => {
    settingsStore.set({ demoMode: true, showMetricDefinitionsInline: false, realDataEnabled: false })
  })

  it('flows league slab → team → right-side matches → preview → back to matches', async () => {
    const user = userEvent.setup()
    renderWithApp(<MatchPreviewPage />, { route: '/matches' })

    expect(await screen.findByRole('heading', { name: 'Match Preview' })).toBeInTheDocument()
    for (const competition of ds.competitions) {
      expect(screen.getByRole('button', { name: `Show teams in ${competition.name}` })).toBeInTheDocument()
    }

    await user.click(screen.getByRole('button', { name: `Show teams in ${secondCompetition.name}` }))
    expect(screen.getByRole('heading', { name: `Teams in ${secondCompetition.name}` })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `View matches for ${team.name}` }))
    const dialog = await screen.findByRole('dialog', { name: `${team.name} matches` })
    const panel = dialog.querySelector('.match-drawer-panel')
    expect(panel).not.toBeNull()
    expect(panel?.className).toContain('right-0')

    expect(screen.getByLabelText('Competition')).toBeInTheDocument()
    expect(screen.getByLabelText('Team faced')).toBeInTheDocument()
    expect(screen.getByLabelText('Season')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Won' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lost' })).toBeInTheDocument()

    const matchButtons = () => screen.getAllByRole('button', { name: /^(Won|Drew|Lost) \d+–\d+/ })
    expect(matchButtons().length).toBeGreaterThan(3)

    await user.click(screen.getByRole('button', { name: 'Won' }))
    expect(matchButtons().length).toBeGreaterThan(0)
    for (const button of matchButtons()) expect(button.getAttribute('aria-label')).toMatch(/^Won /)
    await user.click(screen.getByRole('button', { name: 'All' }))

    // The preview replaces the list inside the same right-hand panel and has
    // an immediately visible way back to the filtered matches.
    await user.click(matchButtons()[0]!)
    expect(await screen.findByRole('button', { name: 'Back to matches' })).toBeInTheDocument()
    expect(screen.getByText('Match numbers')).toBeInTheDocument()
    const averagePositions = screen.getByRole('img', { name: /average positions/i })
    expect(averagePositions).toBeInTheDocument()
    expect(averagePositions.querySelector('[data-testid="heat-map-layer"]')).toBeNull()
    expect(averagePositions.querySelector('[data-testid="hex-heat-map-layer"]')).toBeNull()
    expect(screen.getByText(/Open the full match analysis for individual player heat maps/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open full match analysis/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to matches' }))
    expect(await screen.findByLabelText('Team faced')).toBeInTheDocument()
    expect(matchButtons().length).toBeGreaterThan(3)
  })

  it('filters the sliding match list by opponent', async () => {
    const user = userEvent.setup()
    renderWithApp(<MatchPreviewPage />, {
      route: `/matches?league=${secondCompetition.id}&team=${team.id}`,
    })

    expect(await screen.findByRole('dialog', { name: `${team.name} matches` })).toBeInTheDocument()
    const firstMatch = ds.matches.find(
      (match) => match.homeTeamId === team.id || match.awayTeamId === team.id,
    )!
    const opponentId = firstMatch.homeTeamId === team.id ? firstMatch.awayTeamId : firstMatch.homeTeamId
    const opponent = ds.teams.find((candidate) => candidate.id === opponentId)!

    await pickOption(user, screen.getByLabelText('Team faced'), opponent.name)
    const visible = screen.getAllByRole('button', { name: /^(Won|Drew|Lost) \d+–\d+/ })
    expect(visible.length).toBeGreaterThan(0)
    for (const button of visible) expect(button.getAttribute('aria-label')).toContain(opponent.name)
  })
})
