import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsPage } from '@/pages/SettingsPage'
import { renderWithApp } from '@/test/test-utils'
import { settingsStore } from '@/state/settings'

describe('Theme (light / dark)', () => {
  beforeEach(() => {
    settingsStore.set({
      demoMode: true,
      showMetricDefinitionsInline: false,
      realDataEnabled: false,
      theme: 'dark',
    })
    document.documentElement.classList.remove('light')
    document.documentElement.classList.add('dark')
  })

  afterEach(() => {
    settingsStore.set((s) => ({ ...s, theme: 'dark' }))
    document.documentElement.classList.remove('light')
    document.documentElement.classList.add('dark')
  })

  it('defaults to dark and toggles the html class + persisted setting', async () => {
    const user = userEvent.setup()
    renderWithApp(<SettingsPage />, { route: '/settings' })

    const toggle = await screen.findByRole('switch', { name: 'Light mode' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)

    await user.click(toggle)
    expect(settingsStore.get().theme).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    await user.click(toggle)
    expect(settingsStore.get().theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })

  it('treats a missing theme (pre-theming stored settings) as dark', async () => {
    settingsStore.set({ demoMode: true, showMetricDefinitionsInline: false, realDataEnabled: false })
    renderWithApp(<SettingsPage />, { route: '/settings' })
    const toggle = await screen.findByRole('switch', { name: 'Light mode' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
