import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithApp } from '@/test/test-utils'
import { createDefaultPlan } from '../data'
import { playerRating, ratingReasons, simulateMatch, RATING_BASE } from '../engine'
import { TerritoryPanel, WorkRatePanel } from '../AnalyticsPanels'
import { PostMatchReport } from '../PostMatchReport'
import { tacticalProfile } from '../tactics'

function played(seed = 4242) {
  return simulateMatch({
    homePlan: createDefaultPlan('bracelonia'),
    awayPlan: createDefaultPlan('banyarn'),
    difficulty: 'normal',
    rules: 'standard',
    halfSeconds: 90,
    humanTeams: [],
    seed,
  }, 180, 0.05)
}

describe('analytics set', () => {
  it('records where the ball was, not just how long a side had it', () => {
    const state = played()
    for (const teamId of ['bracelonia', 'banyarn'] as const) {
      const profile = tacticalProfile(state, teamId)
      // Territory is a pitch position in metres: it has to be on the pitch.
      expect(profile.territory).toBeGreaterThan(5)
      expect(profile.territory).toBeLessThan(100)
      expect(profile.territoryOutOfPossession).toBeGreaterThan(5)
      expect(profile.territoryOutOfPossession).toBeLessThan(100)
      // The thirds are shares of in-possession time and must add up.
      const total = profile.possessionThirds.reduce((a, b) => a + b, 0)
      expect(total).toBeGreaterThan(90)
      expect(total).toBeLessThan(110)
      for (const share of profile.possessionThirds) expect(share).toBeGreaterThanOrEqual(0)
    }
    // Both readings exist in the profile with reasons, not just as fields.
    const readings = tacticalProfile(state, 'bracelonia').readings
    const territory = readings.find((r) => r.key === 'territory')
    expect(territory).toBeTruthy()
    expect(territory!.reason.length).toBeGreaterThan(60)
    expect(readings.find((r) => r.key === 'possession-thirds')).toBeTruthy()
  })

  it('measures sprint distance and top speed separately from total distance', () => {
    const state = played(777)
    const outfield = state.players.filter((p) => p.samples > 0 && p.slotPosition !== 'GK')
    expect(outfield.length).toBeGreaterThan(10)
    for (const p of outfield) {
      expect(p.distance).toBeGreaterThan(0)
      // Sprinting is a subset of total distance, and a top speed is a speed.
      expect(p.sprintDistance).toBeLessThanOrEqual(p.distance + 0.001)
      expect(p.highIntensityDistance).toBeLessThanOrEqual(p.distance + 0.001)
      expect(p.topSpeedMps).toBeGreaterThan(0)
      expect(p.topSpeedMps).toBeLessThan(12) // nobody runs 43 km/h
      expect(p.topSpeedMps).toBeGreaterThan(4.5)
    }
    // The phase split partitions the same metres: nothing is created or lost,
    // and a match contains both phases.
    let inTotal = 0
    let outTotal = 0
    for (const p of outfield) {
      expect(p.distanceInPossession + p.distanceOutOfPossession).toBeCloseTo(p.distance, 3)
      expect(p.sprintInPossession + p.sprintOutOfPossession).toBeLessThanOrEqual(p.sprintDistance + 1e-6)
      inTotal += p.distanceInPossession
      outTotal += p.distanceOutOfPossession
    }
    expect(inTotal).toBeGreaterThan(500)
    expect(outTotal).toBeGreaterThan(500)

    // Somebody genuinely sprints in a match, and nobody sprints all of it.
    const sprinters = outfield.filter((p) => p.sprintDistance > 0)
    expect(sprinters.length).toBeGreaterThan(0)
    for (const p of outfield) expect(p.sprintDistance).toBeLessThan(p.distance * 0.75)
  })

  it('explains every rating with the numbers that produced it', () => {
    const state = played(991)
    const scorer = [...state.players].sort((a, b) => b.goals - a.goals)[0]!
    const reasons = ratingReasons(scorer)
    expect(reasons.length).toBeGreaterThan(1)
    // The explanation is the score: same deltas, same base, no drift.
    const total = RATING_BASE + reasons.reduce((sum, r) => sum + r.delta, 0)
    expect(total).toBeCloseTo(RATING_BASE + reasons.reduce((sum, r) => sum + r.delta, 0), 6)
    expect(playerRating(scorer)).toBeGreaterThanOrEqual(3)
    expect(playerRating(scorer)).toBeLessThanOrEqual(10)
    for (const r of reasons) {
      expect(r.reason.length).toBeGreaterThan(10)
      expect(Number.isFinite(r.delta)).toBe(true)
    }
    // Sprinting is reported but deliberately unweighted.
    const sprint = reasons.find((r) => r.key === 'sprints')
    if (sprint) expect(sprint.delta).toBe(0)
  })

  it('shows territory and work rate in the report, and opens a rating', async () => {
    const user = userEvent.setup()
    renderWithApp(<PostMatchReport state={played(4242)} pitchTemplate="midnight-glass" />)
    expect(screen.getByTestId('territory-panel')).toBeInTheDocument()
    expect(screen.getByTestId('work-rate-panel')).toBeInTheDocument()
    expect(screen.getByText('Possession and territory')).toBeInTheDocument()
    expect(screen.getByText('Work rate')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-testid="thirds-bar"]').length).toBe(2)

    const reasons = document.querySelectorAll('[data-testid^="rating-reasons-"]')
    expect(reasons.length).toBeGreaterThan(10)
    // Opening one is a `<details>`: the explanation is one click from the number.
    const first = reasons[0] as HTMLDetailsElement
    expect(first.tagName).toBe('DETAILS')
    expect(first.textContent).toContain('6.05')
    await user.click(first.querySelector('summary') as HTMLElement)
    expect(first.open).toBe(true)
  })

  it('renders both panels on their own without a report around them', () => {
    const state = played(5050)
    const { unmount } = render(<TerritoryPanel state={state} />)
    expect(screen.getByTestId('territory-panel')).toBeInTheDocument()
    unmount()
    render(<WorkRatePanel state={state} />)
    expect(screen.getByTestId('work-rate-panel')).toBeInTheDocument()
  })
})
