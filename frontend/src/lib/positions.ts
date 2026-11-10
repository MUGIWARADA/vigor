import type { Position, PositionGroup } from '@/types'

export const POSITION_GROUPS: Record<PositionGroup, Position[]> = {
  GK: ['GK'],
  CB: ['CB'],
  FB: ['LB', 'RB', 'WB'],
  DM: ['DM'],
  CM: ['CM'],
  WM: ['LMF', 'RMF'],
  AM: ['AM'],
  W: ['LW', 'RW'],
  ST: ['SS', 'CF', 'ST'],
}

export const POSITION_GROUP_ORDER: PositionGroup[] = [
  'GK', 'CB', 'FB', 'DM', 'CM', 'WM', 'AM', 'W', 'ST',
]

export const POSITION_GROUP_LABELS: Record<PositionGroup, string> = {
  GK: 'Goalkeepers',
  CB: 'Centre-backs',
  FB: 'Full-backs & wing-backs',
  DM: 'Defensive midfielders',
  CM: 'Central midfielders',
  WM: 'Wide midfielders',
  AM: 'Attacking midfielders',
  W: 'Wingers',
  ST: 'Strikers & forwards',
}

export const POSITION_GROUP_COLORS: Record<PositionGroup, string> = {
  GK: 'var(--color-pos-gk)',
  CB: 'var(--color-pos-df)',
  FB: 'var(--color-pos-df)',
  DM: 'var(--color-pos-mf)',
  CM: 'var(--color-pos-mf)',
  WM: 'var(--color-pos-mf)',
  AM: 'var(--color-pos-mf)',
  W: 'var(--color-pos-fw)',
  ST: 'var(--color-pos-fw)',
}

export function groupOf(position: Position): PositionGroup {
  for (const [group, positions] of Object.entries(POSITION_GROUPS) as [
    PositionGroup,
    Position[],
  ][]) {
    if (positions.includes(position)) return group
  }
  return 'CM'
}

export const POSITION_LABELS: Record<Position, string> = {
  GK: 'Goalkeeper',
  CB: 'Centre-back',
  LB: 'Left-back',
  RB: 'Right-back',
  WB: 'Wing-back',
  DM: 'Defensive midfield',
  CM: 'Central midfield',
  LMF: 'Left midfield',
  RMF: 'Right midfield',
  AM: 'Attacking midfield',
  LW: 'Left wing',
  RW: 'Right wing',
  SS: 'Second striker',
  CF: 'Centre forward',
  ST: 'Striker',
}

/** Short suffix used in tight UI spots (lineups, chips). */
export const POSITION_SHORT: Record<Position, string> = {
  GK: 'GK',
  CB: 'CB',
  LB: 'LB',
  RB: 'RB',
  WB: 'WB',
  DM: 'DM',
  CM: 'CM',
  LMF: 'LM',
  RMF: 'RM',
  AM: 'AM',
  LW: 'LW',
  RW: 'RW',
  SS: 'SS',
  CF: 'CF',
  ST: 'ST',
}
