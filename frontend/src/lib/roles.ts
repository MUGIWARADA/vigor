import type { Dimension, RoleId } from '@/types'

export interface RoleDefinition {
  id: RoleId
  label: string
  description: string
  /** Default similarity/composite weights per dimension (0–5 scale). */
  defaultWeights: Record<Dimension, number>
}

const w = (
  progression: number,
  retention: number,
  creation: number,
  defending: number,
  finishing: number,
  carrying: number,
): Record<Dimension, number> => ({ progression, retention, creation, defending, finishing, carrying })

export const ROLES: Record<RoleId, RoleDefinition> = {
  goalkeeper: {
    id: 'goalkeeper',
    label: 'Goalkeeper',
    description: 'Shot-stopper and first line of build-up.',
    defaultWeights: w(1, 2, 0, 4, 0, 1),
  },
  'ball-playing-cb': {
    id: 'ball-playing-cb',
    label: 'Ball-playing centre-back',
    description: 'Progresses play from the back with line-breaking passing.',
    defaultWeights: w(5, 4, 1, 4, 0, 2),
  },
  'aggressive-cb': {
    id: 'aggressive-cb',
    label: 'Aggressive centre-back',
    description: 'Front-foot defender; duels, interceptions and clearances.',
    defaultWeights: w(2, 3, 0, 5, 0, 1),
  },
  'attacking-fb': {
    id: 'attacking-fb',
    label: 'Attacking full-back',
    description: 'Overlaps and carries into the final third.',
    defaultWeights: w(4, 3, 3, 3, 1, 4),
  },
  'defensive-fb': {
    id: 'defensive-fb',
    label: 'Defensive full-back',
    description: 'Holds the line, defends the channel and supports retention.',
    defaultWeights: w(2, 3, 1, 5, 0, 2),
  },
  'deep-lying-playmaker': {
    id: 'deep-lying-playmaker',
    label: 'Deep-lying playmaker',
    description: 'Controls tempo from deep; progression and retention hub.',
    defaultWeights: w(5, 5, 3, 2, 0, 1),
  },
  'ball-winner': {
    id: 'ball-winner',
    label: 'Ball-winning midfielder',
    description: 'Regains possession and protects the back line.',
    defaultWeights: w(2, 3, 1, 5, 0, 1),
  },
  'box-to-box': {
    id: 'box-to-box',
    label: 'Box-to-box midfielder',
    description: 'Contributes in all phases across both boxes.',
    defaultWeights: w(3, 3, 2, 3, 2, 3),
  },
  'advanced-playmaker': {
    id: 'advanced-playmaker',
    label: 'Advanced playmaker',
    description: 'Creates between the lines in the final third.',
    defaultWeights: w(4, 4, 5, 1, 3, 3),
  },
  winger: {
    id: 'winger',
    label: 'Winger',
    description: 'Wide creator; 1-v-1 carrying and service.',
    defaultWeights: w(3, 2, 4, 1, 4, 5),
  },
  'inverted-winger': {
    id: 'inverted-winger',
    label: 'Inverted winger',
    description: 'Cuts inside onto strong foot to create and shoot.',
    defaultWeights: w(3, 3, 5, 1, 4, 4),
  },
  'target-forward': {
    id: 'target-forward',
    label: 'Target forward',
    description: 'Reference point; aerial duels and box presence.',
    defaultWeights: w(1, 2, 2, 3, 5, 1),
  },
  'mobile-striker': {
    id: 'mobile-striker',
    label: 'Mobile striker',
    description: 'Runs the channels, attacks depth, finishes moves.',
    defaultWeights: w(2, 1, 3, 1, 5, 4),
  },
}

export const ROLE_IDS = Object.keys(ROLES) as RoleId[]
