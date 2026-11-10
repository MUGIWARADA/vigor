import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { ProvenanceBadge, ProvenanceLegend } from '@/components/shared/provenance'
import { renderWithApp, Wrapper } from '@/test/test-utils'
import { render } from '@testing-library/react'

describe('ProvenanceBadge', () => {
  it('renders the provenance label', () => {
    renderWithApp(<ProvenanceBadge provenance="DEMO" />)
    expect(screen.getByText('DEMO')).toBeInTheDocument()
  })

  it('renders all six provenance levels in the legend', () => {
    render(
      <Wrapper>
        <ProvenanceLegend />
      </Wrapper>,
    )
    for (const label of ['DEMO', 'IMPORTED', 'CALCULATED', 'MODEL EST.', 'MANUAL', 'VERIFIED']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })
})
