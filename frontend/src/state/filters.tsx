import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import type { GlobalFilters } from '@/types'
import { createLocalStore, useStore } from '@/lib/store'

/**
 * Global analysis filters shared across the app (spec §5: "Keep navigation
 * and shared filters consistent throughout the application"). Persisted to
 * localStorage. Individual modules may add further local filters, but they
 * start from these values.
 */

export const DEFAULT_GLOBAL_FILTERS: GlobalFilters = {
  competitionId: 'c-apl',
  seasonId: 's-2026-27',
  positionGroup: 'all',
  teamId: 'all',
  ageMin: 16,
  ageMax: 40,
  minMinutes: 0,
}

const filtersStore = createLocalStore<GlobalFilters>('tiq.globalFilters', DEFAULT_GLOBAL_FILTERS)

interface FiltersContextValue {
  filters: GlobalFilters
  setFilters: (patch: Partial<GlobalFilters>) => void
  reset: () => void
}

const FiltersContext = createContext<FiltersContextValue | null>(null)

export function FiltersProvider({ children }: { children: ReactNode }) {
  const filters = useStore(filtersStore)

  const setFilters = useCallback((patch: Partial<GlobalFilters>) => {
    filtersStore.set((prev) => ({ ...prev, ...patch }))
  }, [])

  const reset = useCallback(() => {
    filtersStore.set(DEFAULT_GLOBAL_FILTERS)
  }, [])

  const value = useMemo(() => ({ filters, setFilters, reset }), [filters, setFilters, reset])

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
}

export function useGlobalFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext)
  if (!ctx) throw new Error('useGlobalFilters must be used within FiltersProvider')
  return ctx
}
