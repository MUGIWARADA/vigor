import type {
  Dimension,
  Phase,
  PlayerSeasonStats,
  PositionGroup,
  Provenance,
} from '@/types'

/**
 * Metric definitions registry (spec §8).
 *
 * Every metric shown anywhere in the platform is defined here with:
 *   - numerator / denominator
 *   - unit and ranking direction
 *   - data source and metric version
 *   - availability in the current dataset (missing metrics are gated,
 *     never zero-filled or fabricated)
 *   - applicable player groups
 */

export type MetricCategory =
  | 'output'
  | 'passing'
  | 'carrying'
  | 'possession'
  | 'defending'
  | 'duels'
  | 'goalkeeping'

export interface MetricDefinition {
  id: string
  label: string
  category: MetricCategory
  /** 'count' → per-90 applies; 'rate' → already a proportion (0–100); 'total' → raw season total. */
  kind: 'count' | 'rate' | 'total'
  unit: 'per 90' | '%' | 'total'
  direction: 'higher' | 'lower'
  phases: Phase[]
  dimensions: Dimension[]
  appliesTo: 'all' | 'outfield' | readonly PositionGroup[]
  numerator: string
  denominator: string
  definition: string
  available: boolean
  unavailableReason?: string
  sourceVersion: string
  provenance: Provenance
  decimals: number
  /** True for model-estimate metrics — the UI tags them "est." */
  estimate?: boolean
}

export const DATASET_VERSION = 'demo-dataset v0.2.0'

const d = (def: MetricDefinition): MetricDefinition => def

export const METRICS: Record<string, MetricDefinition> = {
  /* ---------------------------- Output ---------------------------- */
  goals: d({
    id: 'goals', label: 'Goals', category: 'output', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['final-third'], dimensions: ['finishing'], appliesTo: 'outfield',
    numerator: 'Goals scored in the selected competition and season.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Goals scored per 90 minutes of team possession-independent playing time.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  assists: d({
    id: 'assists', label: 'Assists', category: 'output', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['final-third'], dimensions: ['creation'], appliesTo: 'outfield',
    numerator: 'Assists credited to the player.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Assists per 90 minutes. An assist is the final pass before a goal scored by a teammate.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  shots: d({
    id: 'shots', label: 'Shots', category: 'output', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['final-third'], dimensions: ['finishing'], appliesTo: 'outfield',
    numerator: 'Shots attempted (open play and set pieces).',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Total shots attempted per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  xg: d({
    id: 'xg', label: 'Expected goals (xG)', category: 'output', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['final-third'], dimensions: ['finishing'], appliesTo: 'outfield',
    numerator: 'Sum of expected-goals values of shots taken.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Expected goals per 90 minutes. xG is a model estimate of goal probability per shot — it is an interpretation layer on top of shot events, not a measured fact.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'MODEL_ESTIMATE', decimals: 2,
  }),
  xa: d({
    id: 'xa', label: 'Expected assists (xA)', category: 'output', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['final-third'], dimensions: ['creation'], appliesTo: 'outfield',
    numerator: 'Sum of expected-assist values of passes that set up shots.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Expected assists per 90 minutes. xA is a model estimate of the goal probability of shots created — an interpretation layer, not a measured fact.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'MODEL_ESTIMATE', decimals: 2,
  }),

  /* ---------------------------- Passing ---------------------------- */
  passes_attempted: d({
    id: 'passes_attempted', label: 'Passes attempted', category: 'passing', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['build-up', 'progression'], dimensions: [], appliesTo: 'all',
    numerator: 'Passes attempted.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Passes attempted per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 1,
  }),
  passes_completed: d({
    id: 'passes_completed', label: 'Passes completed', category: 'passing', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['build-up'], dimensions: [], appliesTo: 'all',
    numerator: 'Passes completed to a teammate.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Completed passes per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 1,
  }),
  pass_completion: d({
    id: 'pass_completion', label: 'Pass completion', category: 'passing', kind: 'rate', unit: '%',
    direction: 'higher', phases: ['build-up', 'progression'], dimensions: ['retention'], appliesTo: 'all',
    numerator: 'Passes completed.',
    denominator: 'Passes attempted.',
    definition: 'Share of attempted passes that reached a teammate. Computed from attempts and successes — never as a per-90 count.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 1,
  }),
  forward_passes_attempted: d({
    id: 'forward_passes_attempted', label: 'Forward passes attempted', category: 'passing', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['progression'], dimensions: [], appliesTo: 'outfield',
    numerator: 'Passes attempted with a positive end-to-start gain in pitch length.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Forward passes attempted per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 1,
  }),
  forward_pass_completion: d({
    id: 'forward_pass_completion', label: 'Forward-pass completion', category: 'passing', kind: 'rate', unit: '%',
    direction: 'higher', phases: ['progression', 'build-up'], dimensions: ['progression', 'retention'], appliesTo: 'outfield',
    numerator: 'Forward passes completed.',
    denominator: 'Forward passes attempted.',
    definition: 'Share of forward passes that reached a teammate. Computed from attempts and successes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 1,
  }),
  progressive_passes: d({
    id: 'progressive_passes', label: 'Progressive passes', category: 'passing', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['build-up', 'progression'], dimensions: ['progression'], appliesTo: 'all',
    numerator: 'Completed passes that move the ball ≥25% closer to the opponent goal-line (or any pass into the final third).',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Progressive passes per 90 minutes — completed passes that meaningfully advance the ball toward the opponent goal.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  passes_final_third: d({
    id: 'passes_final_third', label: 'Passes into the final third', category: 'passing', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['progression', 'final-third'], dimensions: ['progression'], appliesTo: 'all',
    numerator: 'Completed passes whose end point is in the attacking final third.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Passes received in the attacking final third per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  line_breaking_passes: d({
    id: 'line_breaking_passes', label: 'Line-breaking passes', category: 'passing', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['build-up', 'progression'], dimensions: ['progression'], appliesTo: 'all',
    numerator: 'Completed forward passes that cross at least one horizontal line of the organised opponent block.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Line-breaking passes per 90 minutes. "Lines" are approximated from opponent block depth at pass time in the demo dataset.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),

  /* ---------------------------- Carrying --------------------------- */
  carries: d({
    id: 'carries', label: 'Carries', category: 'carrying', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['build-up', 'transition'], dimensions: [], appliesTo: 'outfield',
    numerator: 'Possessions where the player moves the ball ≥5m with the ball under control.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Ball carries per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 1,
  }),
  progressive_carries: d({
    id: 'progressive_carries', label: 'Progressive carries', category: 'carrying', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['progression', 'transition'], dimensions: ['progression', 'carrying'], appliesTo: 'outfield',
    numerator: 'Carries that move the ball ≥25% closer to the opponent goal-line.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Progressive ball carries per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  carries_final_third: d({
    id: 'carries_final_third', label: 'Carries into the final third', category: 'carrying', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['progression', 'final-third', 'transition'], dimensions: ['carrying'], appliesTo: 'outfield',
    numerator: 'Carries whose end point is in the attacking final third.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Carries into the attacking final third per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  dribbles_attempted: d({
    id: 'dribbles_attempted', label: 'Take-ons attempted', category: 'carrying', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['final-third', 'transition'], dimensions: ['carrying'], appliesTo: 'outfield',
    numerator: 'Attempted take-ons against an opponent.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Take-ons attempted per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  dribbles_completed: d({
    id: 'dribbles_completed', label: 'Take-ons completed', category: 'carrying', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['final-third', 'transition'], dimensions: ['carrying'], appliesTo: 'outfield',
    numerator: 'Take-ons where the player retains possession past the opponent.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Successful take-ons per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  dribble_success: d({
    id: 'dribble_success', label: 'Take-on success', category: 'carrying', kind: 'rate', unit: '%',
    direction: 'higher', phases: ['final-third'], dimensions: ['carrying'], appliesTo: 'outfield',
    numerator: 'Take-ons completed.',
    denominator: 'Take-ons attempted.',
    definition: 'Share of take-ons completed. Computed from attempts and successes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 1,
  }),

  /* --------------------------- Possession -------------------------- */
  touches: d({
    id: 'touches', label: 'Touches', category: 'possession', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['build-up'], dimensions: [], appliesTo: 'all',
    numerator: 'Ball touches.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Ball touches per 90 minutes — a proxy for involvement in possession.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 1,
  }),
  turnovers: d({
    id: 'turnovers', label: 'Turnovers', category: 'possession', kind: 'count', unit: 'per 90',
    direction: 'lower', phases: ['build-up', 'transition'], dimensions: ['retention'], appliesTo: 'outfield',
    numerator: 'Miscontrols plus dispossessions.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Times the player lost possession due to a miscontrol or being dispossessed, per 90 minutes. Lower is better.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  build_up_receptions: d({
    id: 'build_up_receptions', label: 'Build-up receptions', category: 'possession', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['build-up'], dimensions: ['retention'], appliesTo: 'outfield',
    numerator: 'Passes received during build-up possessions (see build-up possession definition).',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Passes received during build-up possessions per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  build_up_turnovers: d({
    id: 'build_up_turnovers', label: 'Build-up turnovers', category: 'possession', kind: 'count', unit: 'per 90',
    direction: 'lower', phases: ['build-up'], dimensions: ['retention'], appliesTo: 'outfield',
    numerator: 'Miscontrols and dispossessions during build-up possessions.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Possession lost during build-up possessions per 90 minutes. Lower is better.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),

  /* --------------------------- Defending --------------------------- */
  tackles: d({
    id: 'tackles', label: 'Tackles', category: 'defending', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['defensive', 'pressing'], dimensions: ['defending'], appliesTo: 'outfield',
    numerator: 'Tackles attempted against an opponent in possession.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Tackles per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  interceptions: d({
    id: 'interceptions', label: 'Interceptions', category: 'defending', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['defensive', 'transition'], dimensions: ['defending'], appliesTo: 'outfield',
    numerator: 'Balls intercepted.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Interceptions per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  recoveries: d({
    id: 'recoveries', label: 'Ball recoveries', category: 'defending', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['defensive', 'transition', 'pressing'], dimensions: ['defending'], appliesTo: 'outfield',
    numerator: 'Loose balls recovered.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Ball recoveries per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  recoveries_final_third: d({
    id: 'recoveries_final_third', label: 'Recoveries in the final third', category: 'defending', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['pressing'], dimensions: ['defending'], appliesTo: 'outfield',
    numerator: 'Loose balls recovered in the attacking final third.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Recoveries in the attacking final third per 90 minutes — an event-data proxy for high pressing (see limitations note).',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  clearances: d({
    id: 'clearances', label: 'Clearances', category: 'defending', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['defensive'], dimensions: ['defending'], appliesTo: ['GK', 'CB', 'FB', 'DM'],
    numerator: 'Defensive clearances under pressure.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Clearances per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),

  /* ----------------------------- Duels ----------------------------- */
  aerials_won: d({
    id: 'aerials_won', label: 'Aerials won', category: 'duels', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['defensive'], dimensions: ['defending'], appliesTo: 'all',
    numerator: 'Aerial duels won.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Aerial duels won per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  aerial_duel_rate: d({
    id: 'aerial_duel_rate', label: 'Aerial duel rate', category: 'duels', kind: 'rate', unit: '%',
    direction: 'higher', phases: ['defensive'], dimensions: ['defending'], appliesTo: 'all',
    numerator: 'Aerial duels won.',
    denominator: 'Aerial duels contested.',
    definition: 'Share of aerial duels won. Computed from duels contested and won.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 1,
  }),

  /* ------------------- v0.2: goalkeeping ---------------------------- */
  gk_saves: d({
    id: 'gk_saves', label: 'Saves', category: 'goalkeeping', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['defensive'], dimensions: ['defending'], appliesTo: ['GK'],
    numerator: 'Shots stopped (on-target shots faced minus goals conceded).',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Saves per 90 minutes. Demo values are approximated from team shots faced scaled by the keeper\u2019s minute share.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'DEMO', decimals: 2,
  }),
  gk_xg_prevented: d({
    id: 'gk_xg_prevented', label: 'xG prevented', category: 'goalkeeping', kind: 'total', unit: 'total',
    direction: 'higher', phases: ['defensive'], dimensions: ['defending'], appliesTo: ['GK'],
    numerator: 'Saves above expectation (shots stopped minus expected stops).',
    denominator: '— (season total; can be negative).',
    definition: 'Goals prevented above expectation across the season. Negative values mean the keeper underperformed the expected save rate.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'MODEL_ESTIMATE', decimals: 1,
  }),
  gk_penalties_stopped: d({
    id: 'gk_penalties_stopped', label: 'Penalties stopped', category: 'goalkeeping', kind: 'total', unit: 'total',
    direction: 'higher', phases: ['defensive'], dimensions: ['defending'], appliesTo: ['GK'],
    numerator: 'Penalties faced that were not converted.',
    denominator: '— (season total).',
    definition: 'Penalties saved this season, with penalties faced shown for context.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'DEMO', decimals: 0,
  }),
  gk_pen_save_rate: d({
    id: 'gk_pen_save_rate', label: 'Penalty stop rate', category: 'goalkeeping', kind: 'rate', unit: '%',
    direction: 'higher', phases: ['defensive'], dimensions: ['defending'], appliesTo: ['GK'],
    numerator: 'Penalties stopped.',
    denominator: 'Penalties faced.',
    definition: 'Share of penalties faced that were saved. Only shown when at least one penalty was faced.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'DEMO', decimals: 0,
  }),

  /* ------------------- v0.2: pass split ----------------------------- */
  long_pass_accuracy: d({
    id: 'long_pass_accuracy', label: 'Long pass accuracy', category: 'passing', kind: 'rate', unit: '%',
    direction: 'higher', phases: ['build-up', 'progression'], dimensions: ['progression'], appliesTo: 'all',
    numerator: 'Long passes completed.',
    denominator: 'Long passes attempted.',
    definition: 'Share of long passes (as classified in the dataset) completed. Long + short passes sum exactly to total passes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'DEMO', decimals: 1,
  }),
  short_pass_accuracy: d({
    id: 'short_pass_accuracy', label: 'Short pass accuracy', category: 'passing', kind: 'rate', unit: '%',
    direction: 'higher', phases: ['build-up'], dimensions: ['retention'], appliesTo: 'all',
    numerator: 'Short passes completed.',
    denominator: 'Short passes attempted.',
    definition: 'Share of short passes completed.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'DEMO', decimals: 1,
  }),
  long_passes: d({
    id: 'long_passes', label: 'Long passes', category: 'passing', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['progression'], dimensions: ['progression'], appliesTo: 'all',
    numerator: 'Long passes attempted.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Long passes attempted per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'DEMO', decimals: 2,
  }),

  /* ------------------- v0.2: creation & carrying --------------------- */
  chances_created: d({
    id: 'chances_created', label: 'Chances created', category: 'output', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['final-third'], dimensions: ['creation'], appliesTo: 'outfield',
    numerator: 'Passes that led directly to a teammate shot (key passes).',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Chances created per 90 minutes — a shooting chance created for a teammate.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'DEMO', decimals: 2,
  }),
  carry_distance: d({
    id: 'carry_distance', label: 'Carry distance', category: 'carrying', kind: 'total', unit: 'total',
    direction: 'higher', phases: ['progression', 'transition'], dimensions: ['progression'], appliesTo: 'outfield',
    numerator: 'Total distance carried with the ball, in metres.',
    denominator: '— (season total, metres).',
    definition: 'Total metres progressed with the ball at feet across the season.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'DEMO', decimals: 0,
  }),

  /* ------------------- v0.2: duels & blocks -------------------------- */
  tackles_won: d({
    id: 'tackles_won', label: 'Tackles won', category: 'defending', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['pressing', 'defensive'], dimensions: ['defending'], appliesTo: 'outfield',
    numerator: 'Tackles that won possession.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Tackles won per 90 minutes (tackles attempted are shown separately).',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'DEMO', decimals: 2,
  }),
  duels_won: d({
    id: 'duels_won', label: 'Duels won', category: 'duels', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['defensive'], dimensions: ['defending'], appliesTo: 'all',
    numerator: 'Ground and aerial duels won.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Total duels won per 90 minutes (ground + aerial).',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'DEMO', decimals: 2,
  }),
  duels_won_rate: d({
    id: 'duels_won_rate', label: 'Duel win rate', category: 'duels', kind: 'rate', unit: '%',
    direction: 'higher', phases: ['defensive'], dimensions: ['defending'], appliesTo: 'all',
    numerator: 'Duels won (ground + aerial).',
    denominator: 'Duels contested (ground + aerial).',
    definition: 'Share of all duels contested that were won.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'DEMO', decimals: 1,
  }),
  shots_blocked: d({
    id: 'shots_blocked', label: 'Shots blocked', category: 'defending', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['defensive'], dimensions: ['defending'], appliesTo: ['GK', 'CB', 'FB', 'DM'],
    numerator: 'Opponent shots blocked without the keeper making the stop.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Shots blocked per 90 minutes.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'DEMO', decimals: 2,
  }),
  aerials_attacking_won: d({
    id: 'aerials_attacking_won', label: 'Aerials won (attack)', category: 'duels', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['final-third'], dimensions: ['finishing'], appliesTo: 'outfield',
    numerator: 'Aerials won in the attacking third.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Aerials won in the attacking third per 90 minutes (aerial threat from crosses and set pieces).',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'DEMO', decimals: 2,
  }),
  aerials_defensive_won: d({
    id: 'aerials_defensive_won', label: 'Aerials won (defence)', category: 'duels', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['defensive'], dimensions: ['defending'], appliesTo: 'all',
    numerator: 'Aerials won outside the attacking third.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Aerials won in own territory per 90 minutes. Attacking + defensive aerials sum to total aerials won.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'DEMO', decimals: 2,
  }),

  /* ------------- v0.2: positioning intelligence (est.) --------------- */
  positioning_attack: d({
    id: 'positioning_attack', label: 'Positioning (attack)', category: 'possession', kind: 'rate', unit: '%',
    direction: 'higher', phases: ['progression', 'final-third'], dimensions: ['creation'], appliesTo: 'all',
    numerator: 'Model estimate of attacking positioning intelligence (0–100).',
    denominator: '— (0–100 scale).',
    definition: 'Model estimate of how well the player finds and occupies space in attack. DEMO-only estimate — never fabricated for real data.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'MODEL_ESTIMATE', decimals: 0,
    estimate: true,
  }),
  positioning_defense: d({
    id: 'positioning_defense', label: 'Positioning (defence)', category: 'defending', kind: 'rate', unit: '%',
    direction: 'higher', phases: ['pressing', 'defensive'], dimensions: ['defending'], appliesTo: 'all',
    numerator: 'Model estimate of defensive positioning intelligence (0–100).',
    denominator: '— (0–100 scale).',
    definition: 'Model estimate of defensive shape, marking and cover awareness. DEMO-only estimate — never fabricated for real data.',
    available: true, sourceVersion: DATASET_VERSION, provenance: 'MODEL_ESTIMATE', decimals: 0,
    estimate: true,
  }),


  /* ----------------- Metrics NOT in dataset v0.1 -------------------- */
  pass_completion_under_pressure: d({
    id: 'pass_completion_under_pressure', label: 'Pass completion under pressure', category: 'passing', kind: 'rate', unit: '%',
    direction: 'higher', phases: ['build-up', 'progression'], dimensions: ['retention'], appliesTo: 'outfield',
    numerator: 'Passes completed while an opponent was within pressing distance of the receiver.',
    denominator: 'Passes attempted while an opponent was within pressing distance of the receiver.',
    definition: 'Pass reliability when receiving under opponent pressure.',
    available: false,
    unavailableReason:
      'Requires opponent-pressure event data (defender proximity at reception). The demo dataset v0.1 does not contain pressure frames, so this metric is gated rather than approximated.',
    sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 1,
  }),
  receptions_under_pressure: d({
    id: 'receptions_under_pressure', label: 'Receptions under pressure', category: 'possession', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['build-up'], dimensions: ['retention'], appliesTo: 'outfield',
    numerator: 'Passes received while an opponent was within pressing distance.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Receptions under opponent pressure per 90 minutes.',
    available: false,
    unavailableReason: 'Requires opponent-pressure event data, which the demo dataset v0.1 does not contain.',
    sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  passes_between_lines: d({
    id: 'passes_between_lines', label: 'Passes between the lines', category: 'passing', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['progression'], dimensions: ['progression'], appliesTo: 'outfield',
    numerator: 'Completed passes that end between the opponent midfield and defensive lines.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Passes completed between opponent lines per 90 minutes.',
    available: false,
    unavailableReason: 'Requires spatial data on the opponent block structure (line positions at pass time), which event-only demo data cannot identify reliably.',
    sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  receipts_between_lines: d({
    id: 'receipts_between_lines', label: 'Receipts between the lines', category: 'possession', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['build-up', 'progression'], dimensions: ['progression'], appliesTo: 'outfield',
    numerator: 'Passes received between the opponent midfield and defensive lines.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Receipts between opponent lines per 90 minutes.',
    available: false,
    unavailableReason: 'Requires spatial data on the opponent block structure, which event-only demo data cannot identify reliably.',
    sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  pressures_applied: d({
    id: 'pressures_applied', label: 'Pressures applied', category: 'defending', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['pressing'], dimensions: ['defending'], appliesTo: 'outfield',
    numerator: 'Defensive actions or proximity events where the player presses the ball-carrier.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Pressures applied per 90 minutes.',
    available: false,
    unavailableReason: 'Requires pressure event data (defender within a defined radius of the ball-carrier). The demo dataset v0.1 does not include it; recoveries in the final third are offered as the stated proxy instead.',
    sourceVersion: DATASET_VERSION, provenance: 'CALCULATED', decimals: 2,
  }),
  xt_added: d({
    id: 'xt_added', label: 'Expected threat added (xT)', category: 'output', kind: 'count', unit: 'per 90',
    direction: 'higher', phases: ['progression', 'final-third'], dimensions: ['progression', 'creation'], appliesTo: 'outfield',
    numerator: 'Change in expected threat from the start to the end point of the player\'s passes and carries.',
    denominator: 'Minutes played ÷ 90.',
    definition: 'Expected threat added per 90 minutes — a model estimate of how much a player\'s actions increase goal-scoring probability.',
    available: false,
    unavailableReason: 'Requires an expected-threat (xT) grid model over spatial event data. Planned for a later phase; not available in dataset v0.1.',
    sourceVersion: DATASET_VERSION, provenance: 'MODEL_ESTIMATE', decimals: 3,
  }),
}

export const METRIC_IDS = Object.keys(METRICS)

export function getMetric(id: string): MetricDefinition | undefined {
  return METRICS[id]
}

export const METRIC_CATEGORY_LABELS: Record<MetricCategory, string> = {
  output: 'Output',
  passing: 'Passing',
  carrying: 'Carrying & take-ons',
  possession: 'Possession & retention',
  defending: 'Defending',
  duels: 'Duels',
  goalkeeping: 'Goalkeeping',
}

/* ------------------------------------------------------------------ */
/* Phases                                                              */
/* ------------------------------------------------------------------ */

export const BUILD_UP_POSSESSION_DEFINITION =
  'A build-up possession is defined (demo dataset v0.1) as: a team possession that begins in the team\'s own third and has not yet entered the middle third, or any possession beginning from a goal kick, within the first 10 seconds or 4 passes — whichever comes first. Counter-attacks (possessions won in the defensive third that enter the final third within 10 seconds) are explicitly excluded from build-up and counted as transition possessions. Phase rules are configurable in the analysis engine; this is the default rule set.'

export interface PhaseDefinition {
  id: Phase
  label: string
  description: string
  metricIds: string[]
}

export const PHASES: Record<Phase, PhaseDefinition> = {
  'build-up': {
    id: 'build-up',
    label: 'Build-up',
    description: 'Establishing possession from the back against an organised opponent.',
    metricIds: [
      'build_up_receptions', 'pass_completion', 'long_pass_accuracy', 'short_pass_accuracy', 'long_passes',
      'progressive_passes', 'forward_pass_completion',
      'line_breaking_passes', 'carries', 'build_up_turnovers', 'passes_between_lines',
      'receptions_under_pressure', 'pass_completion_under_pressure',
    ],
  },
  progression: {
    id: 'progression',
    label: 'Progression',
    description: 'Moving the ball from the first and second thirds into advanced areas.',
    metricIds: [
      'progressive_passes', 'progressive_carries', 'passes_final_third', 'line_breaking_passes',
      'forward_pass_completion', 'carries_final_third', 'passes_between_lines',
      'receipts_between_lines', 'carry_distance', 'positioning_attack', 'xt_added',
    ],
  },
  'final-third': {
    id: 'final-third',
    label: 'Final third',
    description: 'Chance creation and finishing in advanced areas.',
    metricIds: [
      'goals', 'xg', 'xa', 'assists', 'chances_created', 'shots', 'carries_final_third', 'passes_final_third',
      'dribbles_attempted', 'dribble_success', 'aerials_attacking_won', 'positioning_attack', 'xt_added',
    ],
  },
  pressing: {
    id: 'pressing',
    label: 'Pressing',
    description: 'Regaining the ball high up the pitch. Event-data proxies only — see limitations.',
    metricIds: ['recoveries_final_third', 'pressures_applied', 'tackles', 'tackles_won', 'interceptions', 'positioning_defense'],
  },
  defensive: {
    id: 'defensive',
    label: 'Defensive phase',
    description: 'Defending an organised opponent in own half.',
    metricIds: ['tackles', 'tackles_won', 'interceptions', 'recoveries', 'clearances', 'shots_blocked', 'aerial_duel_rate', 'aerials_defensive_won', 'duels_won_rate', 'positioning_defense', 'gk_saves', 'gk_xg_prevented', 'gk_penalties_stopped', 'build_up_turnovers'],
  },
  transition: {
    id: 'transition',
    label: 'Transition',
    description: 'The moments immediately after winning or losing possession.',
    metricIds: ['recoveries', 'progressive_carries', 'carry_distance', 'dribbles_attempted', 'turnovers', 'carries_final_third'],
  },
}

export const PHASE_ORDER: Phase[] = [
  'build-up', 'progression', 'final-third', 'pressing', 'defensive', 'transition',
]

/* ------------------------------------------------------------------ */
/* Similarity / composite dimensions                                   */
/* ------------------------------------------------------------------ */

export const DIMENSION_METRICS: Record<Dimension, string[]> = {
  progression: ['progressive_passes', 'progressive_carries', 'passes_final_third', 'line_breaking_passes'],
  retention: ['pass_completion', 'turnovers', 'build_up_turnovers', 'build_up_receptions'],
  creation: ['xa', 'assists'],
  defending: ['tackles', 'interceptions', 'recoveries', 'clearances', 'aerial_duel_rate'],
  finishing: ['goals', 'xg', 'shots'],
  carrying: ['progressive_carries', 'carries_final_third', 'dribble_success', 'dribbles_completed'],
}

export const DIMENSION_LABELS: Record<Dimension, string> = {
  progression: 'Progression',
  retention: 'Retention',
  creation: 'Creation',
  defending: 'Defending',
  finishing: 'Finishing',
  carrying: 'Carrying',
}

/** Minimum minutes before percentile comparisons are considered stable. */
export const MIN_MINUTES_FOR_PERCENTILE = 270

/* ------------------------------------------------------------------ */
/* Value accessors                                                     */
/* ------------------------------------------------------------------ */

function appliesToGroup(def: MetricDefinition, group: PositionGroup): boolean {
  if (def.appliesTo === 'all') return true
  if (def.appliesTo === 'outfield') return group !== 'GK'
  return def.appliesTo.includes(group)
}

/**
 * Season-total (for count/total) or rate (0–100) value of a metric.
 * Returns null when the metric is unavailable in the dataset or not
 * applicable — callers must never substitute zero for null.
 */
export function metricRawValue(stats: PlayerSeasonStats, id: string): number | null {
  const def = METRICS[id]
  if (!def || !def.available) return null
  const s = stats
  switch (id) {
    case 'goals': return s.goals
    case 'assists': return s.assists
    case 'shots': return s.shots
    case 'xg': return s.xg
    case 'xa': return s.xa
    case 'passes_attempted': return s.passesAttempted
    case 'passes_completed': return s.passesCompleted
    case 'pass_completion': return s.passesAttempted > 0 ? (s.passesCompleted / s.passesAttempted) * 100 : null
    case 'forward_passes_attempted': return s.forwardPassesAttempted
    case 'forward_pass_completion':
      return s.forwardPassesAttempted > 0 ? (s.forwardPassesCompleted / s.forwardPassesAttempted) * 100 : null
    case 'progressive_passes': return s.progressivePasses
    case 'passes_final_third': return s.passesFinalThird
    case 'line_breaking_passes': return s.lineBreakingPasses
    case 'carries': return s.carries
    case 'progressive_carries': return s.progressiveCarries
    case 'carries_final_third': return s.carriesFinalThird
    case 'dribbles_attempted': return s.dribblesAttempted
    case 'dribbles_completed': return s.dribblesCompleted
    case 'dribble_success': return s.dribblesAttempted > 0 ? (s.dribblesCompleted / s.dribblesAttempted) * 100 : null
    case 'touches': return s.touches
    case 'turnovers': return s.turnovers
    case 'build_up_receptions': return s.buildUpReceptions
    case 'build_up_turnovers': return s.buildUpTurnovers
    case 'tackles': return s.tackles
    case 'interceptions': return s.interceptions
    case 'recoveries': return s.recoveries
    case 'recoveries_final_third': return s.recoveriesFinalThird
    case 'clearances': return s.clearances
    case 'aerials_won': return s.aerialsWon
    case 'aerial_duel_rate': return s.aerialsContested > 0 ? (s.aerialsWon / s.aerialsContested) * 100 : null
    case 'gk_saves': return s.saves ?? null
    case 'gk_xg_prevented': return s.xgPrevented ?? null
    case 'gk_penalties_stopped': return s.penaltiesStopped ?? null
    case 'gk_pen_save_rate': return (s.penaltiesFaced ?? 0) > 0 ? ((s.penaltiesStopped ?? 0) / (s.penaltiesFaced ?? 1)) * 100 : null
    case 'long_pass_accuracy': return (s.longPassesAttempted ?? 0) > 0 ? ((s.longPassesCompleted ?? 0) / s.longPassesAttempted!) * 100 : null
    case 'short_pass_accuracy': return (s.shortPassesAttempted ?? 0) > 0 ? ((s.shortPassesCompleted ?? 0) / s.shortPassesAttempted!) * 100 : null
    case 'long_passes': return s.longPassesAttempted ?? null
    case 'chances_created': return s.chancesCreated ?? null
    case 'carry_distance': return s.carryDistance ?? null
    case 'tackles_won': return s.tacklesWon ?? null
    case 'duels_won': return s.duelsWon ?? null
    case 'duels_won_rate': return (s.duelsContested ?? 0) > 0 ? ((s.duelsWon ?? 0) / s.duelsContested!) * 100 : null
    case 'shots_blocked': return s.shotsBlocked ?? null
    case 'aerials_attacking_won': return s.aerialsWonAttacking ?? null
    case 'aerials_defensive_won': return s.aerialsWonDefensive ?? null
    case 'positioning_attack': return s.positioningAttack ?? null
    case 'positioning_defense': return s.positioningDefense ?? null
    default: return null
  }
}

/** Per-90 value; rates pass through; null when unavailable or minutes = 0. */
export function metricPer90Value(stats: PlayerSeasonStats, id: string): number | null {
  const def = METRICS[id]
  if (!def || !def.available) return null
  const raw = metricRawValue(stats, id)
  if (raw === null) return null
  if (def.kind === 'count') {
    if (stats.minutes <= 0) return null
    return raw / (stats.minutes / 90)
  }
  return raw
}

/** Metric value for a specific player, respecting position applicability. */
export function metricValueForPlayer(
  player: { stats: PlayerSeasonStats },
  id: string,
  group: PositionGroup,
  per90 = true,
): number | null {
  const def = METRICS[id]
  if (!def || !def.available) return null
  if (!appliesToGroup(def, group)) return null
  return per90 ? metricPer90Value(player.stats, id) : metricRawValue(player.stats, id)
}

export function metricAppliesTo(id: string, group: PositionGroup): boolean {
  const def = METRICS[id]
  return !!def && appliesToGroup(def, group)
}
