import { beforeEach, describe, expect, it, vi } from 'vitest'

// Dataset v2 (96 teams, 2304 players) makes the analysis pages compute-heavy
// under jsdom; allow generous per-test timeouts.
vi.setConfig({ testTimeout: 30000 })
import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/react'
import { AppRoutes } from '@/App'
import { ComparisonPage } from '@/pages/ComparisonPage'
import { ContextualAnalysisPage } from '@/pages/ContextualAnalysisPage'
import { DiscussionsPage, DiscussionRoomPage } from '@/pages/DiscussionsPages'
import { MatchPreviewPage } from '@/pages/MatchPreviewPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { CompetitionsPage } from '@/pages/CompetitionsPage'
import { SimilaritySearchPage } from '@/pages/SimilaritySearchPage'
import { TacticalLabPage } from '@/pages/TacticalLabPage'
import { TopPerformersPage } from '@/pages/TopPerformersPage'
import { renderWithApp } from '@/test/test-utils'
import { settingsStore } from '@/state/settings'
import { scenarioStore } from '@/lib/store'
import { buildDemoDataset } from '@/data/generate'
import { buildDemoContent } from '@/data/content'

const ds = buildDemoDataset()
const content = buildDemoContent(ds)
const outfield = ds.players.filter((p) => p.position !== 'GK' && p.stats.minutes >= 400)
const topScorer = [...ds.players].sort((a, b) => b.stats.goals - a.stats.goals)[0]!
const lastName = (name: string) => name.split(' ').slice(-1)[0]!
// Two outfield players with different surnames (table columns use last names).
const [playerA, playerB] = [
  outfield[0]!,
  outfield.find((p) => lastName(p.name) !== lastName(outfield[0]!.name))!,
]

/** Open a Radix select and click one of its options. */
async function pickOption(
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  name: string | RegExp,
) {
  await user.click(trigger)
  const option = await screen.findByRole('option', { name })
  await user.click(option)
}

describe('route audit — every route renders its core content', () => {
  beforeEach(() => {
    settingsStore.set({ demoMode: true, showMetricDefinitionsInline: false, realDataEnabled: false })
    scenarioStore.set([])
  })

  it('/matches renders Match Preview league slabs and teams', async () => {
    renderWithApp(<MatchPreviewPage />, { route: '/matches' })
    expect(await screen.findByRole('heading', { name: 'Match Preview' })).toBeInTheDocument()
    expect(screen.getByText('Leagues & competitions')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Show teams in / }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /^View matches for / }).length).toBeGreaterThan(0)
  })

  it('/competitions shows the fictional demo leagues when real data is off', async () => {
    renderWithApp(<CompetitionsPage />, { route: '/competitions' })
    expect(await screen.findByRole('tab', { name: 'League table' })).toBeInTheDocument()
    expect(screen.getByText(/Vigor demo dataset \(fictional\)/i)).toBeInTheDocument()
  })

  it('/competitions flags missing real data but still shows the demo leagues', async () => {
    settingsStore.set((s) => ({ ...s, realDataEnabled: true }))
    renderWithApp(<CompetitionsPage />, { route: '/competitions' })
    expect(await screen.findByText('Real data is enabled but no backend is connected')).toBeInTheDocument()
    expect(await screen.findByRole('tab', { name: 'League table' })).toBeInTheDocument()
    settingsStore.set((s) => ({ ...s, realDataEnabled: false }))
  })

  it('/analysis renders the configuration panel and waits for a player', async () => {
    renderWithApp(<ContextualAnalysisPage />, { route: '/analysis' })
    expect(await screen.findByText('Analysis context')).toBeInTheDocument()
    expect(screen.getByText('Select a player to analyse')).toBeInTheDocument()
  })

  it('/compare without ids shows the explicit empty state', async () => {
    renderWithApp(<ComparisonPage />, { route: '/compare' })
    expect(await screen.findByText('Select at least two players')).toBeInTheDocument()
  })

  it('/similarity waits for a target player', async () => {
    renderWithApp(<SimilaritySearchPage />, { route: '/similarity' })
    expect(await screen.findByText('Choose a target player')).toBeInTheDocument()
  })

  it('/rankings renders the leaderboard with filters and CSV export', async () => {
    renderWithApp(<TopPerformersPage />, { route: '/rankings' })
    expect(await screen.findByText('Top performers')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument()
    // Once the dataset loads, the default metric (xG) is shown in the selector/table.
    expect((await screen.findAllByText(/Expected goals/i)).length).toBeGreaterThan(0)
  })

  it('/tactical-lab renders the tool palette and scenario browser', async () => {
    renderWithApp(<TacticalLabPage />, { route: '/tactical-lab' })
    expect(await screen.findByRole('button', { name: 'New' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Drawing tool' })).toBeInTheDocument()
    expect(screen.getByText(/planning tool — not a simulation/i)).toBeInTheDocument()
  })

  it('/tactical-lab team colours recolour the tokens and persist', async () => {
    const user = userEvent.setup()
    const { tacticalColorsStore, DEFAULT_TACTICAL_COLORS } = await import('@/lib/store')
    tacticalColorsStore.set(DEFAULT_TACTICAL_COLORS)
    const demo = content.demoScenarios[0]!
    const { container } = renderWithApp(<TacticalLabPage />, {
      route: `/tactical-lab?scenario=${demo.id}`,
    })
    expect(await screen.findByDisplayValue(demo.name)).toBeInTheDocument()
    expect(await screen.findByLabelText('Attacking colour')).toBeInTheDocument()
    // Player tokens are the smaller 90% circles (r=2.07).
    expect(container.querySelectorAll('circle[r="2.07"]').length).toBeGreaterThan(0)
    // Recolour the attacking team red via the preset swatch.
    await user.click(screen.getByRole('button', { name: 'Set Attacking colour to #ef4444' }))
    expect(tacticalColorsStore.get().attack).toBe('#ef4444')
    expect(container.querySelectorAll('circle[fill="#ef4444"]').length).toBeGreaterThan(0)
    // Clash guard: same colour on both teams warns.
    await user.click(screen.getByRole('button', { name: 'Set Defending colour to #ef4444' }))
    expect(await screen.findByText(/hard to tell apart/i)).toBeInTheDocument()
    tacticalColorsStore.set(DEFAULT_TACTICAL_COLORS)
  })

  it('/discussions renders the rooms list', async () => {
    renderWithApp(<DiscussionsPage />, { route: '/discussions' })
    expect(await screen.findByText('Rooms')).toBeInTheDocument()
    expect(screen.getByText(/Saved research/i)).toBeInTheDocument()
  })

  it('/settings renders data source controls and the provenance legend', async () => {
    renderWithApp(<SettingsPage />, { route: '/settings' })
    expect(await screen.findByText('Data sources')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Enable demo data/i })).toBeInTheDocument()
    // The dataset card appears once the async data load completes.
    expect(await screen.findByText('Active dataset')).toBeInTheDocument()
  })

  it('unknown routes render the 404 page with a way back', async () => {
    renderWithApp(<AppRoutes />, { route: '/nowhere' })
    expect(await screen.findByText('Page not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to overview/i })).toBeInTheDocument()
  })
})

describe('route audit — interactive controls do real work', () => {
  beforeEach(() => {
    settingsStore.set({ demoMode: true, showMetricDefinitionsInline: false, realDataEnabled: false })
    scenarioStore.set([])
  })

  it('/analysis: selecting a player computes the phase metric table', async () => {
    const user = userEvent.setup()
    const target = outfield[0]!
    renderWithApp(<ContextualAnalysisPage />, { route: '/analysis' })
    await screen.findByText('Analysis context')
    // Player options are labelled "Name · Position".
    await pickOption(user, screen.getAllByRole('combobox')[0]!, new RegExp(target.name))
    expect(await screen.findByText(new RegExp(`Build-up metrics — ${target.name}`))).toBeInTheDocument()
    // Peer group sample is live: shows a candidate count.
    expect(screen.getByText(/players ·/i)).toBeInTheDocument()
  })

  it('/compare: two ids produce the shared-metric table with both players', async () => {
    renderWithApp(<ComparisonPage />, {
      route: `/compare?ids=${playerA.id},${playerB.id}`,
      path: '/compare',
    })
    expect(await screen.findByText(/Reading this comparison/i)).toBeInTheDocument()
    // The page renders one table per metric category — each has both players.
    expect(screen.getAllByRole('columnheader', { name: lastName(playerA.name) }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('columnheader', { name: lastName(playerB.name) }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('columnheader', { name: 'Best' }).length).toBeGreaterThan(0)
  })

  it('/similarity: selecting a target produces ranked, explainable results', async () => {
    const user = userEvent.setup()
    const target = outfield[1]!
    renderWithApp(<SimilaritySearchPage />, { route: '/similarity' })
    await screen.findByText('Choose a target player')
    await pickOption(user, screen.getAllByRole('combobox')[0]!, new RegExp(target.name))
    expect(await screen.findByText(new RegExp(`Most similar to ${target.name}`))).toBeInTheDocument()
    expect(screen.getByText(/How this score is calculated/i)).toBeInTheDocument()
  })

  it('/rankings: per-90 toggle switches displayed values to season totals (regression)', async () => {
    const user = userEvent.setup()
    renderWithApp(<TopPerformersPage />, { route: '/rankings' })
    await screen.findByText('Top performers')

    // Switch the metric to Goals.
    await pickOption(user, screen.getAllByRole('combobox')[0]!, 'Goals')

    const rowFor = (playerName: string) => {
      const row = screen.getByText(playerName).closest('tr')!
      expect(row).not.toBeNull()
      return {
        value: () => Number(row.querySelector('td.font-semibold')?.textContent ?? NaN),
        unit: () => row.querySelector('td')?.textContent ?? '',
      }
    }

    // The top scorer by total goals must be present; default view is per-90.
    let cell = rowFor(topScorer.name)
    await waitFor(() => expect(cell.value()).toBeGreaterThan(0))
    const per90 = cell.value()
    expect(per90).toBeCloseTo(topScorer.stats.goals / (topScorer.stats.minutes / 90), 1)
    expect(screen.getAllByText('/90').length).toBeGreaterThan(0)

    // Toggle off per-90: the same row must now show the season total.
    await user.click(screen.getByRole('checkbox', { name: 'Per-90 values' }))
    cell = rowFor(topScorer.name)
    await waitFor(() => expect(cell.value()).toBe(topScorer.stats.goals))
    expect(screen.getAllByText('total').length).toBeGreaterThan(0)
  })

  it('/tactical-lab: saving a loaded demo seed creates your own copy, not an id collision (regression)', async () => {
    const user = userEvent.setup()
    const demo = content.demoScenarios[0]!
    renderWithApp(<TacticalLabPage />, { route: `/tactical-lab?scenario=${demo.id}` })
    expect(await screen.findByDisplayValue(demo.name)).toBeInTheDocument()
    expect(screen.getByText(/demo seed — Save creates your own copy/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Save$/i }))

    // The user's copy appears in the list under a distinct name.
    expect(await screen.findByText(/\(my copy\)/)).toBeInTheDocument()
    // And is stored under a NEW id — the demo seed is never shadowed.
    const stored = scenarioStore.get()
    expect(stored).toHaveLength(1)
    expect(stored[0]!.id).not.toBe(demo.id)
    expect(stored[0]!.name).toContain('(my copy)')
  })

  it('/tactical-lab: user scenarios autosave edits (no silent data loss)', async () => {
    const user = userEvent.setup()
    renderWithApp(<TacticalLabPage />, { route: '/tactical-lab' })
    await user.click(await screen.findByRole('button', { name: 'New' }))
    const nameInput = await screen.findByDisplayValue('Untitled scenario')
    await user.clear(nameInput)
    await user.type(nameInput, 'My pressing trap')

    // Debounced autosave (400 ms) persists the edit without clicking Save.
    await waitFor(
      () => {
        const stored = scenarioStore.get()
        expect(stored).toHaveLength(1)
        expect(stored[0]!.name).toBe('My pressing trap')
      },
      { timeout: 4000 },
    )
  })

  /* jsdom has no SVG layout: stub the screen-CTM conversion so pitch clicks
     map clientX/Y straight to pitch coordinates (x/105*100, y/68*100). */
  const stubSvgCoords = (container: HTMLElement) => {
    // Target the pitch svg specifically — lucide toolbar icons are svgs too.
    const svg = container.querySelector('svg[aria-label="Tactical scenario pitch"]') as SVGSVGElement
    expect(svg).toBeTruthy()
    const pt = { x: 0, y: 0, matrixTransform: () => ({ x: pt.x, y: pt.y }) }
    svg.createSVGPoint = () => pt as unknown as SVGPoint
    svg.getScreenCTM = () => ({ inverse: () => ({}) }) as unknown as DOMMatrix
    return (el: Element, clientX: number, clientY: number) =>
      userEvent
        .setup()
        .pointer({ target: el, coords: { x: clientX, y: clientY }, keys: '[MouseLeft]' })
  }

  it('/tactical-lab: drawing a pass on the open pitch works and the ball travels with it', async () => {
    const user = userEvent.setup()
    const demo = content.demoScenarios[0]!
    const { container } = renderWithApp(<TacticalLabPage />, {
      route: `/tactical-lab?scenario=${demo.id}`,
    })
    expect(await screen.findByDisplayValue(demo.name)).toBeInTheDocument()

    // The ball is visible from the start (end of the demo's last pass).
    expect(screen.getByRole('img', { name: /^Ball at x 63, y 87/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pass' }))
    const pitchClick = stubSvgCoords(container)
    const hit = container.querySelector('[data-testid="tl-pitch-hit"]')!

    // Click the open turf (not a token) for start and end — this used to be a
    // no-op because the drawing layer had no hit area.
    await pitchClick(hit, 52.5, 34)
    await pitchClick(hit, 84, 34)

    // A fifth numbered action exists…
    expect(await screen.findByText('Actions (5)')).toBeInTheDocument()
    // …and the ball has travelled to the pass destination.
    expect(screen.getByRole('img', { name: /^Ball at x 80, y 50/ })).toBeInTheDocument()
  })

  it('/tactical-lab: movement is off-ball — the action draws but the ball stays', async () => {
    const user = userEvent.setup()
    const demo = content.demoScenarios[0]!
    const { container } = renderWithApp(<TacticalLabPage />, {
      route: `/tactical-lab?scenario=${demo.id}`,
    })
    expect(await screen.findByDisplayValue(demo.name)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Movement' }))
    const pitchClick = stubSvgCoords(container)
    const hit = container.querySelector('[data-testid="tl-pitch-hit"]')!

    await pitchClick(hit, 52.5, 34)
    await pitchClick(hit, 52.5, 10)

    expect(await screen.findByText('Actions (5)')).toBeInTheDocument()
    // Still at the end of the demo's last pass — movements don't carry the ball.
    expect(screen.getByRole('img', { name: /^Ball at x 63, y 87/ })).toBeInTheDocument()
  })

  it('/tactical-lab: dragging a player moves it live and commits on release', async () => {
    const user = userEvent.setup()
    const demo = content.demoScenarios[0]!
    const { container } = renderWithApp(<TacticalLabPage />, {
      route: `/tactical-lab?scenario=${demo.id}`,
    })
    await screen.findByDisplayValue(demo.name)
    stubSvgCoords(container) // mock only; the drag uses its own user instance

    // The attacking keeper's token (first amber circle — attack renders first).
    const gkCircle = container.querySelector('circle[fill="#fbbf24"]')!
    expect(gkCircle).toBeTruthy()
    expect(parseFloat(gkCircle.getAttribute('cx')!)).toBeCloseTo(6.3, 1)
    const gkToken = gkCircle.closest('g')!
    const hit = container.querySelector('[data-testid="tl-pitch-hit"]')!

    // Press on the keeper, drag right, release.
    await user.pointer([
      { target: gkToken, coords: { x: 50, y: 34 }, keys: '[MouseLeft>]' },
      { target: hit, coords: { x: 70, y: 34 } },
      { keys: '[/MouseLeft]' },
    ])

    // Committed: the token re-rendered at the dragged position (pitch x 6 → ~25,
    // i.e. view x ≈ 26.3) and the transient transform was cleaned up.
    expect(parseFloat(gkCircle.getAttribute('cx')!)).toBeCloseTo(26.3, 1)
    expect(gkToken.getAttribute('transform')).toBeNull()

    // A grab without movement is a no-op (no accidental repositioning).
    await user.pointer([
      { target: gkToken, coords: { x: 60, y: 40 }, keys: '[MouseLeft>]' },
      { keys: '[/MouseLeft]' },
    ])
    expect(parseFloat(gkCircle.getAttribute('cx')!)).toBeCloseTo(26.3, 1)
  })

  it('/discussions/:id: publishing a post works and replies attach to demo posts (regression)', async () => {
    const user = userEvent.setup()
    const roomPlayerId = content.discussions[0]!.playerId
    renderWithApp(<DiscussionRoomPage />, {
      route: `/discussions/${roomPlayerId}`,
      path: '/discussions/:playerId',
    })
    expect(await screen.findByText('Start a discussion')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Reply' }).length).toBeGreaterThan(0)

    // Reply to the first (demo) post — previously this was silently discarded.
    const replyBox = screen.getAllByLabelText(/Reply to /i)[0]!
    await user.type(replyBox, 'Counter-point: his pressing numbers say otherwise.')
    const replyButtons = screen.getAllByRole('button', { name: 'Reply' })
    await user.click(replyButtons[0]!)
    expect(
      await screen.findByText('Counter-point: his pressing numbers say otherwise.'),
    ).toBeInTheDocument()

    // Publish a new local post.
    await user.type(screen.getByLabelText('Your post'), 'Observation: he drops into the left half-space in build-up.')
    await user.click(screen.getByRole('button', { name: /Publish/i }))
    expect(
      await screen.findByText(/stored locally in this build/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Observation: he drops into the left half-space in build-up.'),
    ).toBeInTheDocument()
  })

  it('/settings: turning demo data off removes the dataset without silent substitution', async () => {
    const user = userEvent.setup()
    renderWithApp(<SettingsPage />, { route: '/settings' })
    expect(await screen.findByText('Active dataset')).toBeInTheDocument()

    const demoSwitch = screen.getByRole('switch', { name: /Enable demo data/i })
    await user.click(demoSwitch)
    await waitFor(() => expect(screen.queryByText('Active dataset')).toBeNull(), { timeout: 4000 })
    expect(demoSwitch).toHaveAttribute('aria-checked', 'false')
  })

  it('replies attach to the exact post they were written on (per-post drafts)', async () => {
    const user = userEvent.setup()
    const roomPlayerId = content.discussions[0]!.playerId
    renderWithApp(<DiscussionRoomPage />, {
      route: `/discussions/${roomPlayerId}`,
      path: '/discussions/:playerId',
    })
    await screen.findByText('Start a discussion')
    const boxes = screen.getAllByLabelText(/Reply to /i)
    expect(boxes.length).toBeGreaterThan(1)

    // Type into the second post's draft only.
    await user.type(boxes[1]!, 'Second post reply checking per-post drafts.')
    expect((boxes[0]! as HTMLTextAreaElement).value).toBe('')

    const buttons = screen.getAllByRole('button', { name: 'Reply' })
    await user.click(buttons[1]!)
    const replyText = await screen.findByText('Second post reply checking per-post drafts.')

    // The reply must land inside the card that owns the second textarea.
    let card: HTMLElement | null = replyText
    while (card && !card.querySelector('textarea[aria-label^="Reply to"]')) {
      card = card.parentElement
    }
    expect(card).not.toBeNull()
    const textareasInCard = card!.querySelectorAll('textarea[aria-label^="Reply to"]')
    expect(textareasInCard).toHaveLength(1)
    expect(textareasInCard[0]).toBe(boxes[1])
  })
})
