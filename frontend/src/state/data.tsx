import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Match, MatchEvent, Player, Team } from '@/types'
import type { PlatformData } from '@/data/platform'
import { apiStatus, loadPlatformData } from '@/api/client'
import { createMockAssistantProvider, type AssistantProvider } from '@/api/assistant'
import { useSettings } from './settings'

/**
 * Data provider — the single gateway between the UI and the (currently
 * mock) API layer. When demo mode is off and no real backend is configured,
 * `data` is null and every module must render an explicit empty state.
 */

interface DataContextValue {
  data: PlatformData | null
  loading: boolean
  apiStatus: typeof apiStatus
  players: Player[]
  teams: Team[]
  matches: Match[]
  events: MatchEvent[]
  playerById: (id: string) => Player | undefined
  teamById: (id: string) => Team | undefined
  assistant: AssistantProvider | null
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const [data, setData] = useState<PlatformData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadPlatformData({ includeDemoData: settings.demoMode }).then((result) => {
      if (cancelled) return
      setData(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [settings.demoMode])

  const value = useMemo<DataContextValue>(() => {
    const players = data?.dataset.players ?? []
    const teams = data?.dataset.teams ?? []
    const matches = data?.dataset.matches ?? []
    const events = data?.dataset.events ?? []
    const playersMap = new Map(players.map((p) => [p.id, p]))
    const teamsMap = new Map(teams.map((t) => [t.id, t]))
    return {
      data,
      loading,
      apiStatus,
      players,
      teams,
      matches,
      events,
      playerById: (id: string) => playersMap.get(id),
      teamById: (id: string) => teamsMap.get(id),
      assistant: data ? createMockAssistantProvider(data) : null,
    }
  }, [data, loading])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
