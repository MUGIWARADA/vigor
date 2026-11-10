import { createLocalStore } from '@/lib/store'
import { DEFAULT_GAMEPLAY_SETTINGS, type GameplaySettings, type RatingOverrides, type TeamId, type TeamPlan } from './data'

export interface SavedGamePlan {
  id: string
  savedAt: string
  plan: TeamPlan
}

export interface GameRecords {
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  trainingBadges: string[]
}

export const EMPTY_GAME_RECORDS: GameRecords = {
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  trainingBadges: [],
}

/** Community Game Mode stores are deliberately local-only in v1. */
export const gamePlansStore = createLocalStore<SavedGamePlan[]>('tiq.gameMode.plans', [])
export const gameRecordsStore = createLocalStore<GameRecords>('tiq.gameMode.records', EMPTY_GAME_RECORDS)
export const lastGamePlansStore = createLocalStore<Partial<Record<TeamId, TeamPlan>>>('tiq.gameMode.lastPlans', {})
export const gameplaySettingsStore = createLocalStore<GameplaySettings>('tiq.gameMode.gameplaySettings', DEFAULT_GAMEPLAY_SETTINGS)
export const gamePitchTemplateStore = createLocalStore<string>('tiq.gameMode.pitchTemplate', 'volt-turf')
export const gameCircleSchemeStore = createLocalStore<string>('tiq.gameMode.circleScheme', 'volt-halo')
export const gameRatingOverridesStore = createLocalStore<RatingOverrides>('tiq.gameMode.ratingOverrides', {})

export function recordHumanResult(forGoals: number, againstGoals: number) {
  gameRecordsStore.set((r) => ({
    ...r,
    wins: r.wins + (forGoals > againstGoals ? 1 : 0),
    draws: r.draws + (forGoals === againstGoals ? 1 : 0),
    losses: r.losses + (forGoals < againstGoals ? 1 : 0),
    goalsFor: r.goalsFor + forGoals,
    goalsAgainst: r.goalsAgainst + againstGoals,
  }))
}

export function awardTrainingBadge(id: string) {
  gameRecordsStore.set((r) => r.trainingBadges.includes(id) ? r : { ...r, trainingBadges: [...r.trainingBadges, id] })
}
