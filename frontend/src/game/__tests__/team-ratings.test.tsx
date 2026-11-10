import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createDefaultPlan, getTeam, type RatingOverrides, type TeamId, type TeamPlan } from '../data'
import { TeamRatings } from '../TeamRatings'

function Harness({ onChange }: { onChange: (next: RatingOverrides) => void }) {
  const [overrides, setOverrides] = useState<RatingOverrides>({})
  return (
    <TeamRatings
      plans={{ bracelonia: createDefaultPlan('bracelonia'), banyarn: createDefaultPlan('banyarn') } as Record<TeamId, TeamPlan>}
      overrides={overrides}
      onChange={(next) => { setOverrides(next); onChange(next) }}
    />
  )
}

describe('TeamRatings weak foot', () => {
  it('switches the preferred foot and shows what the wrong foot costs', async () => {
    const user = userEvent.setup()
    let last: RatingOverrides = {}
    render(<Harness onChange={(next) => { last = next }} />)

    expect(screen.getByTestId('weak-foot-editor')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Preferred foot' })).toBeInTheDocument()
    expect(screen.getByTestId('weak-foot-readout').textContent).toMatch(/Left|Right|Two-footed/)

    // The editor opens on the squad's best player; switch him to the other foot.
    const left = screen.getByRole('button', { name: 'Left' })
    await user.click(left)
    await user.click(left)
    const player = getTeam('bracelonia').players.find((p) => p.id === Object.keys(last)[0])
    expect(player).toBeDefined()
    expect(Object.values(last)[0]?.foot).toBe('L')

    // Setting it back to his natural foot clears the override entirely.
    const right = screen.getByRole('button', { name: 'Right' })
    await user.click(right)
    expect(Object.values(last)[0]?.foot).toBeUndefined()
  })

  it('switches special abilities on and off from the ratings sheet', async () => {
    const user = userEvent.setup()
    let last: RatingOverrides = {}
    render(<Harness onChange={(next) => { last = next }} />)

    const group = screen.getByRole('group', { name: 'Special abilities' })
    expect(group).toBeInTheDocument()
    const scoring = screen.getByRole('button', { name: 'Scoring' })
    const wasOn = scoring.getAttribute('aria-pressed') === 'true'
    await user.click(scoring)
    const playerId = Object.keys(last)[0]!
    const stars = last[playerId]?.stars
    expect(stars).toBeDefined()
    expect(stars!.includes('Scoring')).toBe(!wasOn)
    expect(screen.getByRole('button', { name: 'Scoring' }).getAttribute('aria-pressed')).toBe(String(!wasOn))
  })
})
