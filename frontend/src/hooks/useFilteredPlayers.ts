import { useMemo } from 'react'
import type { Player } from '@/types'
import { useData } from '@/state/data'
import { useGlobalFilters } from '@/state/filters'
import { playerAge } from '@/lib/analysis'
import { groupOf } from '@/lib/positions'

/**
 * Applies the global filters (position group, team, age range, minimum
 * minutes) to the player pool. Modules add their own local filters on top.
 */
export function useFilteredPlayers(): Player[] {
  const { players } = useData()
  const { filters } = useGlobalFilters()

  return useMemo(
    () =>
      players.filter((p) => {
        if (filters.positionGroup !== 'all' && groupOf(p.position) !== filters.positionGroup) return false
        if (filters.teamId !== 'all' && p.teamId !== filters.teamId) return false
        const age = playerAge(p)
        if (age < filters.ageMin || age > filters.ageMax) return false
        if (p.stats.minutes < filters.minMinutes) return false
        return true
      }),
    [players, filters],
  )
}
