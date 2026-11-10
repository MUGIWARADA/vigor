import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithApp } from '@/test/test-utils'
import { createDefaultPlan } from '../data'
import { simulateMatch } from '../engine'
import { ShapeOverlay, ShapePanel, teamShape } from '../ShapePanel'

function played(seed = 4242) {
  return simulateMatch({
    homePlan: createDefaultPlan('bracelonia'),
    awayPlan: createDefaultPlan('banyarn'),
    difficulty: 'normal',
    rules: 'standard',
    halfSeconds: 48,
    humanTeams: [],
    seed,
  }, 96, 0.05)
}

describe('shape panel', () => {
  it('measures units, block and space behind from average positions', () => {
    const state = played()
    for (const teamId of ['bracelonia', 'banyarn'] as const) {
      const shape = teamShape(state, teamId)
      expect(shape.ready).toBe(true)
      // Three units, always reported in the same order. Their heights are NOT
      // asserted to ascend, because in this engine they genuinely do not: over
      // a short passage Bracelonia's front line averaged 58.2 m from its own
      // goal against the midfield's 60.4 m. That is a measurement the panel
      // exists to expose, not a bug to hide behind an assertion.
      expect(shape.units.map((u) => u.key)).toEqual(['defence', 'midfield', 'attack'])
      // Every unit is inside the block, and the block is inside the pitch.
      for (const unit of shape.units) {
        expect(unit.min).toBeGreaterThanOrEqual(0)
        expect(unit.max).toBeLessThanOrEqual(105)
        expect(unit.min).toBeLessThanOrEqual(unit.line)
        expect(unit.max).toBeGreaterThanOrEqual(unit.line)
        expect(unit.count).toBeGreaterThan(0)
      }
      expect(shape.blockMin).toBeLessThan(shape.blockMax)
      expect(shape.spaceBehind).toBe(shape.blockMin)
      // Eleven outfield players minus anyone sent off.
      expect(shape.players.length).toBeGreaterThanOrEqual(9)
      expect(shape.players.length).toBeLessThanOrEqual(10)
      // Gaps between consecutive unit lines are positive when the side is spread.
      expect(shape.gaps).toHaveLength(2)
      for (const gap of shape.gaps) expect(Number.isFinite(gap)).toBe(true)
      expect(shape.biggestGap).toBeGreaterThanOrEqual(0)
    }
  })

  it('splits the shape by possession phase instead of blending the two', () => {
    const state = played(4242)
    const all = teamShape(state, 'bracelonia')
    const withBall = teamShape(state, 'bracelonia', 'in')
    const withoutBall = teamShape(state, 'bracelonia', 'out')
    for (const shape of [all, withBall, withoutBall]) expect(shape.ready).toBe(true)

    // The split is real: the same eleven average different heights and widths
    // with the ball than without it, and each phase is measured from its own
    // samples rather than being a scaled copy of the whole match.
    const inLine = withBall.units[0]!.line
    const outLine = withoutBall.units[0]!.line
    expect(inLine).not.toBeCloseTo(outLine, 1)
    expect(all.units[0]!.line).toBeGreaterThan(Math.min(inLine, outLine) - 0.001)
    expect(all.units[0]!.line).toBeLessThan(Math.max(inLine, outLine) + 0.001)

    // The per-phase counts have to add up to the whole-match samples.
    const keeperOutfield = state.players.filter((p) => p.teamId === 'bracelonia' && p.slotPosition !== 'GK')
    for (const p of keeperOutfield.slice(0, 5)) {
      expect(p.inCount + p.outCount).toBeGreaterThanOrEqual(Math.floor(p.samples * 0.9))
    }
  })

  it('reports the opposition line and how much room that leaves the striker', () => {
    const state = played(8762)
    const shape = teamShape(state, 'bracelonia', 'in')
    expect(shape.opponentLine).not.toBeNull()
    expect(shape.strikerLine).not.toBeNull()
    expect(shape.opponentLine!).toBeGreaterThan(0)
    expect(shape.opponentLine!).toBeLessThan(105)
    // The room reading is exactly the striker's line against theirs, so the two
    // numbers on screen can always be checked against each other.
    expect(shape.roomAhead!).toBeCloseTo(shape.strikerLine! - shape.opponentLine!, 1)
  })

  it('switches phase from the panel without losing the diagram', async () => {
    const user = userEvent.setup()
    renderWithApp(<ShapePanel state={played(4242)} pitchTemplate="midnight-glass" />)
    expect(screen.getByRole('button', { name: 'Whole match' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'With the ball' }))
    expect(screen.getByRole('img', { name: /average shape with the ball/i })).toBeInTheDocument()
    expect(document.querySelectorAll('[data-testid^="shape-unit-"]')).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: 'Without the ball' }))
    expect(screen.getByRole('img', { name: /average shape without the ball/i })).toBeInTheDocument()
  })

  it('does not invent a shape before the match has been sampled', () => {
    const state = played()
    const fresh = { ...state, players: state.players.map((p) => ({ ...p, samples: 0, avgX: 0, avgY: 0 })) }
    const shape = teamShape(fresh, 'bracelonia')
    expect(shape.ready).toBe(false)
    expect(shape.units).toHaveLength(0)
    expect(shape.players).toHaveLength(0)
    expect(Number.isNaN(shape.spaceBehind)).toBe(false)
  })

  it('draws one band per unit and one marker per player, at the right end of the pitch', () => {
    const state = played(777)
    const shape = teamShape(state, 'bracelonia')
    const { container } = render(
      <svg>
        <ShapeOverlay shape={shape} dir={1} />
      </svg>,
    )
    expect(container.querySelectorAll('[data-testid^="shape-unit-"]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-testid^="shape-player-"]')).toHaveLength(shape.players.length)
    expect(screen.getByText(/BEHIND THE LINE/i)).toBeInTheDocument()

    // The overlay follows the team's attacking direction: the space-behind band
    // must sit at the goal being defended, which is the opposite end.
    const behindRight = container.querySelector('rect[stroke-dasharray="1.4 1.2"]')!.getAttribute('x')
    const { container: flipped } = render(
      <svg>
        <ShapeOverlay shape={shape} dir={-1} />
      </svg>,
    )
    const behindLeft = flipped.querySelector('rect[stroke-dasharray="1.4 1.2"]')!.getAttribute('x')
    // Attacking right, the space behind starts at the left goal line; attacking
    // left, it starts a pitch-length minus the same distance from the left.
    expect(Number(behindRight)).toBeCloseTo(0, 1)
    expect(Number(behindLeft)).toBeCloseTo(105 - shape.spaceBehind, 1)
  })

  it('shows the readings with their numbers and reasons, and switches team', async () => {
    const user = userEvent.setup()
    renderWithApp(<ShapePanel state={played(991)} pitchTemplate="midnight-glass" />)
    expect(screen.getByTestId('shape-panel')).toBeInTheDocument()
    expect(screen.getByText('Shape')).toBeInTheDocument()
    expect(screen.getByText('Space behind the line')).toBeInTheDocument()
    expect(screen.getByText('Block length')).toBeInTheDocument()
    // Every reading carries a reason, not just a figure.
    const readings = screen.getAllByTestId('shape-reading')
    expect(readings.length).toBeGreaterThanOrEqual(4)
    for (const row of readings) expect(row.textContent!.length).toBeGreaterThan(40)
    expect(screen.getByRole('img', { name: /Bracelonia average shape/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'BAM' }))
    expect(screen.getByRole('img', { name: /Banyarn Munic average shape/i })).toBeInTheDocument()
  })
})
