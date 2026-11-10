import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithApp } from '@/test/test-utils'
import { AppShell } from '@/components/layout/app-shell'
import { NAV_SECTIONS } from '@/components/layout/nav-items'

function renderShell(route: string) {
  return renderWithApp(<AppShell><div>page body</div></AppShell>, { route })
}

describe('AppShell daylight theming', () => {
  it('tags every navigation section with a colour hue', () => {
    const hues = NAV_SECTIONS.map((section) => section.hue)
    expect(hues).toHaveLength(NAV_SECTIONS.length)
    // Every section carries a hue, and they are not all the same colour.
    expect(hues.every(Boolean)).toBe(true)
    expect(new Set(hues).size).toBeGreaterThanOrEqual(3)
  })

  it('marks the sidebar and header so the light wash can tint them', () => {
    const { container } = renderShell('/')
    expect(container.querySelector('.app-sidebar')).not.toBeNull()
    expect(container.querySelector('.app-header')).not.toBeNull()
    // Section headings carry the hue class that colours their dot. The
    // desktop and mobile sidebars both render, so match on presence.
    expect(container.querySelector('.nav-section-label.nav-hue-mint')).not.toBeNull()
    expect(container.querySelectorAll('.nav-section-label').length).toBeGreaterThanOrEqual(NAV_SECTIONS.length)
  })

  it('exposes the current section on the document for section-keyed colour', async () => {
    renderShell('/competitions')
    await waitFor(() => {
      expect(document.documentElement.dataset.appSection).toBe('intelligence')
    })
    screen.getByRole('navigation', { name: 'Main navigation' })
  })
})
