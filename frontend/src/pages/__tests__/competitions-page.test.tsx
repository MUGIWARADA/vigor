import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CompetitionsPage } from '@/pages/CompetitionsPage'
import { renderWithApp } from '@/test/test-utils'
import { settingsStore } from '@/state/settings'
import { buildDemoDataset, DEMO_CUP_ID } from '@/data/generate'
import { computeCompetitionScorers, computeLeagueTable } from '@/lib/league-table'
import { computeAllRoundSeasonRatings } from '@/lib/ratings'

/**
 * Demo competitions section: with real data off, the Competitions page shows
 * the fictional leagues — tables, fixtures and scorers — all labelled DEMO.
 */
describe('CompetitionsPage (demo data)', () => {
  const ds = buildDemoDataset()

  beforeEach(() => {
    settingsStore.set({ demoMode: true, showMetricDefinitionsInline: false, realDataEnabled: false })
  })

  it('renders the fictional league table for the primary league', async () => {
    renderWithApp(<CompetitionsPage />, { route: '/competitions' })

    // Default selection: the Bremya League with its full table.
    expect(await screen.findByRole('tab', { name: 'League table' })).toBeInTheDocument()

    // Table is sorted and complete: 20 Bremya sides, 8 matchdays played.
    const brmMatches = ds.matches.filter((m) => m.competitionId === 'c-brm')
    const brmTeams = ds.teams.filter((t) => t.id.startsWith('t-brm-'))
    const table = computeLeagueTable(brmMatches, brmTeams)
    expect(table.length).toBe(20)
    expect(table.reduce((min, r) => Math.min(min, r.played), 99)).toBe(8)
    expect(screen.getByText(table[0]!.teamName)).toBeInTheDocument()

    // Every Bremya side appears, provenance is labelled DEMO.
    for (const team of ds.teams.filter((t) => t.id.startsWith('t-brm-')).slice(0, 5)) {
      expect(screen.getByText(team.name)).toBeInTheDocument()
    }
    expect(screen.getByText(/Vigor demo dataset \(fictional\)/i)).toBeInTheDocument()
    expect(screen.getByText(/80 matches/)).toBeInTheDocument()
  })

  it('shows fixtures with scores that link to the match analysis pages', async () => {
    const user = userEvent.setup()
    renderWithApp(<CompetitionsPage />, { route: '/competitions' })
    await user.click(await screen.findByRole('tab', { name: 'Fixtures & results' }))

    const links = await screen.findAllByRole('link')
    const matchLinks = links.filter((a) => a.getAttribute('href')?.startsWith('/matches/'))
    // 80 Bremya league matches, each fixture row linked.
    expect(matchLinks.length).toBeGreaterThanOrEqual(80)
    // Scores are shown.
    expect(screen.getAllByText(/–/).length).toBeGreaterThan(20)
  })

  it('lists per-competition scorers counted from goal events', async () => {
    const user = userEvent.setup()
    renderWithApp(<CompetitionsPage />, { route: '/competitions' })
    await user.click(await screen.findByRole('tab', { name: 'Top scorers' }))

    const expected = computeCompetitionScorers(
      ds.matches.filter((m) => m.competitionId === 'c-brm'),
      ds.events,
      ds.players,
      ds.playerMatchMinutes,
      ds.teams,
    )
    expect(expected.length).toBeGreaterThan(0)
    // The leading scorer's name appears and links to their profile.
    expect(await screen.findByText(expected[0]!.playerName)).toBeInTheDocument()
    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/players/'))
    expect(links.length).toBeGreaterThan(0)
  })

  it('lists the per-competition assist leaders', async () => {
    const user = userEvent.setup()
    renderWithApp(<CompetitionsPage />, { route: '/competitions' })
    await user.click(await screen.findByRole('tab', { name: 'Top assists' }))

    const expected = computeCompetitionScorers(
      ds.matches.filter((m) => m.competitionId === 'c-brm'),
      ds.events,
      ds.players,
      ds.playerMatchMinutes,
      ds.teams,
      20,
      'assists',
    )
    expect(expected.length).toBeGreaterThan(0)
    expect(await screen.findByText(expected[0]!.playerName)).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Assists' })).toBeInTheDocument()
  })

  it('ranks top players by the all-round, position-tailored rating', async () => {
    const user = userEvent.setup()
    renderWithApp(<CompetitionsPage />, { route: '/competitions' })
    await user.click(await screen.findByRole('tab', { name: 'Top players' }))

    const expected = computeAllRoundSeasonRatings(ds.players, 450, 20)
    expect(expected.length).toBe(20)
    // Position-tailored: qualifiers need minutes, not goals — the board is
    // sorted by the all-round rating and is not strikers-only.
    for (const p of expected) expect(p.minutes).toBeGreaterThanOrEqual(450)
    for (let i = 1; i < expected.length; i++) {
      expect(expected[i]!.rating).toBeLessThanOrEqual(expected[i - 1]!.rating)
    }
    expect(new Set(expected.slice(0, 10).map((p) => p.archetype)).size).toBeGreaterThan(1)
    expect(await screen.findByText(expected[0]!.playerName)).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /all-round rating/i })).toBeInTheDocument()
    expect(screen.getByText(/minimum\s+450 minutes/i)).toBeInTheDocument()
  })

  it('shows the Atlantica Cup knockout rounds instead of a table', async () => {
    const user = userEvent.setup()
    renderWithApp(<CompetitionsPage />, { route: '/competitions' })
    await screen.findByRole('tab', { name: 'League table' })

    // Select the Atlantica Cup via the competition dropdown.
    await user.click(screen.getByRole('combobox', { name: 'Competition' }))
    await user.click(await screen.findByRole('option', { name: 'Atlantica Cup' }))

    expect(await screen.findByRole('tab', { name: 'Knockout' })).toBeInTheDocument()
    expect(screen.getByText('Round of 16')).toBeInTheDocument()
    expect(screen.getByText('Quarter-finals')).toBeInTheDocument()
    expect(screen.getByText('Semi-finals')).toBeInTheDocument()
    expect(screen.getByText('Final')).toBeInTheDocument()
    // 15 ties across the four rounds.
    const cupMatches = ds.matches.filter((m) => m.competitionId === DEMO_CUP_ID)
    expect(cupMatches.length).toBe(15)
  })
})
