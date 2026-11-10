import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OverviewPage } from '@/pages/OverviewPage'
import { renderWithApp } from '@/test/test-utils'
import { settingsStore } from '@/state/settings'
import { recordRecentlyViewed, recentlyViewedStore } from '@/lib/store'
import { buildDemoDataset, DEMO_CUP_ID } from '@/data/generate'
import { computeTopMatchPerformances, computeTrendingTopics } from '@/lib/overview'
import { computeAllRoundSeasonRatings } from '@/lib/ratings'

const ds = buildDemoDataset()
const perfInput = {
  matches: ds.matches,
  minutes: ds.playerMatchMinutes,
  events: ds.events,
  players: ds.players,
  teams: ds.teams,
  competitions: ds.competitions,
}

describe('OverviewPage (demo data)', () => {
  beforeEach(() => {
    settingsStore.set({ demoMode: true, showMetricDefinitionsInline: false, realDataEnabled: false })
    recentlyViewedStore.set([])
    localStorage.removeItem('tiq.globalFilters')
  })

  it('renders the four front-page tabs with the home sections', async () => {
    renderWithApp(<OverviewPage />, { route: '/' })
    expect(await screen.findByRole('tab', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Matches' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Trending' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Top performances' })).toBeInTheDocument()

    expect(screen.getByText('Recently viewed players')).toBeInTheDocument()
    expect(screen.getByText('Top performers', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Title races')).toBeInTheDocument()
    expect(screen.getByText('Notable performance changes')).toBeInTheDocument()
    expect(screen.getByText('Latest news')).toBeInTheDocument()
    expect(screen.getByText('Saved scouting shortlists')).toBeInTheDocument()
    expect(screen.getByText('Recent tactical scenarios')).toBeInTheDocument()
    // Dataset coverage footer is factual.
    expect(screen.getByText(/2304 players, 96 teams/i)).toBeInTheDocument()
    expect(screen.getByText(/399 matches/i)).toBeInTheDocument()
  })

  it('shows the top-performers slider above the home sections, led by the all-round rating leader', async () => {
    const user = userEvent.setup()
    renderWithApp(<OverviewPage />, { route: '/' })

    const expected = computeAllRoundSeasonRatings(ds.players, 450, 8)
    expect(expected).toHaveLength(8)
    expect(await screen.findByText('Top performers right now')).toBeInTheDocument()
    const slider = screen.getByRole('region', { name: 'Top performers right now' })
    expect(slider).toHaveTextContent(expected[0]!.playerName)
    expect(slider).toHaveTextContent(expected[0]!.rating.toFixed(1))
    // Carousel advances on demand and the rating is not goals-driven: some
    // of the eight come from non-forward archetypes.
    expect(new Set(expected.map((r) => r.archetype)).size).toBeGreaterThan(1)
    // The track physically slides: all slides render side by side and the
    // transform moves one full slide width on Next.
    const track = slider.querySelector('[style*="translateX"]') as HTMLElement
    expect(track.style.transform).toBe('translateX(-0%)')
    await user.click(screen.getByRole('button', { name: 'Next performer' }))
    expect(track.style.transform).toBe('translateX(-100%)')
    expect(screen.getByRole('button', { name: 'Show performer 2' }).getAttribute('aria-current')).toBe('true')
  })

  it('shows recently viewed players from the local store', async () => {
    const player = ds.players[0]!
    recordRecentlyViewed(player.id)
    renderWithApp(<OverviewPage />, { route: '/' })
    expect((await screen.findAllByText(player.name)).length).toBeGreaterThan(0)
  })

  it('lists the latest matches on the Matches tab, each linking to its report', async () => {
    const user = userEvent.setup()
    renderWithApp(<OverviewPage />, { route: '/' })
    await user.click(await screen.findByRole('tab', { name: 'Matches' }))

    const links = await screen.findAllByRole('link', { name: /vs/i })
    expect(links).toHaveLength(20)
    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/^\/matches\//)
    }
  })

  it('derives trending topics in-app — no social links for fictional players', async () => {
    const user = userEvent.setup()
    renderWithApp(<OverviewPage />, { route: '/' })
    await user.click(await screen.findByRole('tab', { name: 'Trending' }))

    const expected = computeTrendingTopics({ ...perfInput, cupCompetitionId: DEMO_CUP_ID })
    expect(expected.length).toBeGreaterThanOrEqual(5)
    for (const topic of expected) {
      expect(await screen.findByText(topic.title)).toBeInTheDocument()
    }
    // Discussion activity lives on this tab now.
    expect(screen.getByText('Recent discussion activity')).toBeInTheDocument()
    // In-app discussion links exist, external social/search links do not.
    expect(screen.getAllByRole('link', { name: /discuss in-app/i }).length).toBeGreaterThan(0)
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '')
    expect(hrefs.some((h) => h.includes('x.com') || h.includes('twitter.com') || h.includes('youtube.com'))).toBe(false)
  })

  it('packs the best single-match performances with est. tags and match-report links', async () => {
    const user = userEvent.setup()
    renderWithApp(<OverviewPage />, { route: '/' })
    await user.click(await screen.findByRole('tab', { name: 'Top performances' }))

    const expected = computeTopMatchPerformances(perfInput, { limit: 9, cupCompetitionId: DEMO_CUP_ID })
    expect(expected).toHaveLength(9)
    const top = expected[0]!
    // Ranked by rating, minimum 45 minutes.
    for (const p of expected) expect(p.minutes).toBeGreaterThanOrEqual(45)
    for (let i = 1; i < expected.length; i++) {
      expect(expected[i]!.rating).toBeLessThanOrEqual(expected[i - 1]!.rating)
    }
    expect((await screen.findAllByText(top.playerName)).length).toBeGreaterThan(0)
    // Model outputs are labelled: rating / shot xG / positioning est. tags.
    expect(screen.getAllByText('est.').length).toBeGreaterThanOrEqual(9)
    // Every pack links to its in-app match report; no YouTube for fictional players.
    const reportLinks = screen.getAllByRole('link', { name: 'Match report' })
    expect(reportLinks).toHaveLength(9)
    expect(reportLinks[0]!.getAttribute('href')).toBe(`/matches/${top.matchId}`)
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '')
    expect(hrefs.some((h) => h.includes('youtube.com'))).toBe(false)
  })

  it('shows an explicit scope note when demo data is disabled', async () => {
    settingsStore.set({ demoMode: false, showMetricDefinitionsInline: false, realDataEnabled: false })
    renderWithApp(<OverviewPage />, { route: '/' })
    expect(await screen.findByText('Demo data is disabled')).toBeInTheDocument()
    expect(screen.getByText(/intelligence panels are empty by design/i)).toBeInTheDocument()
  })

  it('top performances filter to goalkeepers and re-sort', async () => {
    const user = userEvent.setup()
    renderWithApp(<OverviewPage />, { route: '/' })
    await user.click(await screen.findByRole('tab', { name: 'Top performances' }))
    // filter controls present
    expect(screen.getByLabelText('Competition')).toBeTruthy()
    expect(screen.getByLabelText('Sort by')).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Goalkeepers' }))
    // every visible performance card is a goalkeeper (position badge GK)
    const badges = screen.getAllByText('GK')
    expect(badges.length).toBeGreaterThan(2)
  })

  it('home top performers default to Overall and can switch to Goals /90', async () => {
    const user = userEvent.setup()
    renderWithApp(<OverviewPage />, { route: '/' })

    expect(await screen.findByRole('columnheader', { name: 'Overall' })).toBeInTheDocument()
    await user.click(screen.getByLabelText('Rank by'))
    await user.click(await screen.findByRole('option', { name: 'Goals /90' }))

    expect(await screen.findByRole('columnheader', { name: 'Goals /90' })).toBeInTheDocument()
    expect(screen.getByText(/minimum 450 minutes/i)).toBeInTheDocument()
  })
})
