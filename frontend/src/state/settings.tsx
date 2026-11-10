import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { createLocalStore, useStore } from '@/lib/store'

/**
 * Application settings (persisted to localStorage).
 * Demo mode is the master switch for fictional demo data (spec §19):
 * when disabled, every data view shows an explicit empty state instead of
 * silently substituting sample values.
 */

export type Theme = 'dark' | 'light'

export interface Settings {
  demoMode: boolean
  showMetricDefinitionsInline: boolean
  /**
   * Real competition data via the backend's football-data.org proxy
   * (Phase 4a). Off by default: imported data is only fetched when the user
   * explicitly opts in, and every imported record is labelled with its
   * source and fetch time.
   */
  realDataEnabled: boolean
  /**
   * UI theme. Optional so settings objects persisted before theming existed
   * (and partial test fixtures) still type-check; resolved to 'dark' when absent.
   */
  theme?: Theme
}

const DEFAULT_SETTINGS: Settings = {
  demoMode: true,
  showMetricDefinitionsInline: false,
  realDataEnabled: false,
  theme: 'dark',
}

export const settingsStore = createLocalStore<Settings>('tiq.settings', DEFAULT_SETTINGS)

interface SettingsContextValue {
  settings: Settings
  /** Resolved theme (never undefined). */
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setDemoMode: (enabled: boolean) => void
  setShowMetricDefinitionsInline: (enabled: boolean) => void
  setRealDataEnabled: (enabled: boolean) => void
  reset: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useStore(settingsStore)
  const theme: Theme = settings.theme ?? 'dark'

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('light', theme === 'light')
    root.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    settingsStore.set((s) => ({ ...s, theme: next }))
  }, [])

  const toggleTheme = useCallback(() => {
    settingsStore.set((s) => ({ ...s, theme: (s.theme ?? 'dark') === 'dark' ? 'light' : 'dark' }))
  }, [])

  const setDemoMode = useCallback((enabled: boolean) => {
    settingsStore.set((s) => ({ ...s, demoMode: enabled }))
  }, [])

  const setShowMetricDefinitionsInline = useCallback((enabled: boolean) => {
    settingsStore.set((s) => ({ ...s, showMetricDefinitionsInline: enabled }))
  }, [])

  const setRealDataEnabled = useCallback((enabled: boolean) => {
    settingsStore.set((s) => ({ ...s, realDataEnabled: enabled }))
  }, [])

  const reset = useCallback(() => {
    settingsStore.set(DEFAULT_SETTINGS)
  }, [])

  const value = useMemo(
    () => ({ settings, theme, setTheme, toggleTheme, setDemoMode, setShowMetricDefinitionsInline, setRealDataEnabled, reset }),
    [settings, theme, setTheme, toggleTheme, setDemoMode, setShowMetricDefinitionsInline, setRealDataEnabled, reset],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
