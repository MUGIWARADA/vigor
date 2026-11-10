import { useSyncExternalStore } from 'react'

/**
 * Tiny localStorage-backed store for user-created content (provenance MANUAL):
 * tactical scenarios, match notes, manually tagged match events, saved
 * research and recently viewed players.
 *
 * In Phase 2+ this content moves to the Spring Boot API; the store interface
 * is deliberately shaped so components will not need to change.
 */

export interface LocalStore<T> {
  get: () => T
  set: (next: T | ((prev: T) => T)) => void
  subscribe: (listener: () => void) => () => void
}

export function createLocalStore<T>(key: string, initial: T): LocalStore<T> {
  const listeners = new Set<() => void>()
  let state: T = initial
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) state = JSON.parse(raw) as T
  } catch {
    // corrupted or unavailable storage — start from initial value
  }

  const persist = () => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // storage full or unavailable — keep in-memory state
    }
  }

  return {
    get: () => state,
    set: (next) => {
      state = typeof next === 'function' ? (next as (prev: T) => T)(state) : next
      persist()
      listeners.forEach((l) => l())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function useStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/* ------------------------------------------------------------------ */
/* Concrete stores                                                     */
/* ------------------------------------------------------------------ */

import type { MatchEvent, TacticalScenario } from '@/types'

/** Tactical Lab token colours (UI preference, MANUAL) — persisted so a
 *  clash-free palette survives reloads; applies to every scenario. */
export interface TacticalColors {
  attack: string
  defence: string
  goalkeeper: string
  ball: string
}

export const DEFAULT_TACTICAL_COLORS: TacticalColors = {
  attack: '#ffffff',
  defence: '#1e40af',
  goalkeeper: '#fbbf24',
  ball: '#f8fafc',
}

export const tacticalColorsStore = createLocalStore<TacticalColors>(
  'tiq.tacticalColors',
  DEFAULT_TACTICAL_COLORS,
)

export interface SavedResearchItem {
  id: string
  postId: string
  playerId: string
  savedAt: string
}

export interface RecentlyViewedEntry {
  playerId: string
  viewedAt: string
}

export const scenarioStore = createLocalStore<TacticalScenario[]>('tiq.scenarios', [])
export const matchNotesStore = createLocalStore<Record<string, string>>('tiq.matchNotes', {})
export const manualEventStore = createLocalStore<MatchEvent[]>('tiq.manualEvents', [])
export const savedResearchStore = createLocalStore<SavedResearchItem[]>('tiq.savedResearch', [])
export const recentlyViewedStore = createLocalStore<RecentlyViewedEntry[]>('tiq.recentlyViewed', [])

export function recordRecentlyViewed(playerId: string): void {
  const now = new Date().toISOString()
  recentlyViewedStore.set((prev) =>
    [{ playerId, viewedAt: now }, ...prev.filter((e) => e.playerId !== playerId)].slice(0, 12),
  )
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
