/**
 * The AI manager's bench calls.
 *
 * Nobody makes substitutions at random, and nobody makes three. A real bench
 * is used for a handful of recognisable reasons — a knock, legs going, a
 * booking that is asking for trouble, chasing a game, seeing one out — and a
 * manager who has not used his allocation by the eightieth minute starts
 * spending it. Four changes is a quiet afternoon; five is normal.
 *
 * This module is deliberately pure: the engine hands over what it knows about
 * the eleven, the bench and the scoreline, and gets a decision back.
 */

export type SubReason = 'injury' | 'fatigue' | 'booking' | 'chasing' | 'seeing-out' | 'half-time' | 'legs'

export interface SubPlan {
  outId: string
  inId: string
  reason: SubReason
}

export const SUB_RULES = {
  /** Five from nine, in three windows, as the laws allow. */
  maxSubs: 5,
  windows: 3,
  /** No AI side should finish an ordinary match having used fewer than this. */
  minimumUsed: 4,
} as const

/** When a manager looks at the bench. 45 is half-time, a free change. */
export const MANAGER_MARKS = [45, 55, 62, 68, 74, 80, 85] as const

/** How much running a position can do before the legs are visibly gone. */
const LOAD_LIMIT: Record<string, number> = {
  GK: 999,
  LB: 58, RB: 58, LWB: 58, RWB: 58,
  LM: 58, RM: 58, LW: 58, RW: 58,
  LCM: 64, CM: 64, RCM: 64, DM: 66, LDM: 66, RDM: 66, CAM: 62,
  LCB: 72, CB: 72, RCB: 72,
  ST: 62, LST: 62, RST: 62,
}

export interface StarterView {
  id: string
  /** Position code of the slot he is filling. */
  slotPosition: string
  /** 0..100 accumulated running load this match. */
  load: number
  injured: boolean
  yellowCards: number
  /** 0..10 match rating so far. */
  rating: number
  /** 0..100 — how much he has left in the tank, from condition and stamina. */
  fitness: number
}

export interface BenchView {
  id: string
  /** His natural position, used to judge whether he can fill the slot. */
  position: string
  overall: number
  load: number
  /** 0..100 how attack-minded he is. */
  attack: number
  /** 0..100 how defensive he is. */
  defence: number
  isKeeper: boolean
}

export interface SubContext {
  minute: number
  losing: boolean
  winning: boolean
  drawn: boolean
  subsUsed: number
  windowsLeft: number
}

const isDefensive = (position: string) => ['GK', 'LCB', 'CB', 'RCB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'LDM', 'RDM'].includes(position)
const isAttacking = (position: string) => ['LW', 'RW', 'ST', 'LST', 'RST', 'CAM', 'LM', 'RM'].includes(position)
const isWideOrFullBack = (position: string) => ['LB', 'RB', 'LWB', 'RWB', 'LM', 'RM', 'LW', 'RW'].includes(position)

/** Can this bench player fill that slot without the shape falling apart? */
function fillScore(man: BenchView, slotPosition: string): number {
  if (slotPosition === 'GK') return man.isKeeper ? 100 : -100
  if (man.isKeeper) return -100
  const natural = man.position === slotPosition ? 18 : 0
  const sameUnit = isDefensive(man.position) === isDefensive(slotPosition)
    && isAttacking(man.position) === isAttacking(slotPosition)
  return man.overall * 0.7 + natural + (sameUnit ? 10 : -6)
}

function bestReplacement(bench: BenchView[], starter: StarterView, context: SubContext): BenchView | undefined {
  const usable = bench.filter((man) => man.load < 26 && fillScore(man, starter.slotPosition) > 0)
  if (!usable.length) return undefined
  const score = (man: BenchView) => {
    let value = fillScore(man, starter.slotPosition)
    // Fresh legs are the whole point of a substitution.
    value += (26 - man.load) * 0.8
    // Chasing a game means the attacking option; protecting a lead means the
    // defensive one. This is why benches are built the way they are.
    if (context.losing && context.minute >= 66) value += man.attack * 0.35
    if (context.winning && context.minute >= 74) value += man.defence * 0.35
    return value
  }
  return usable.sort((a, b) => score(b) - score(a))[0]
}

/**
 * One change, or none. Called at each manager mark; the engine applies what
 * comes back and calls again at the next mark.
 */
export function pickSubstitution(
  starters: StarterView[],
  bench: BenchView[],
  context: SubContext,
): SubPlan | null {
  if (!bench.length) return null
  if (context.subsUsed >= SUB_RULES.maxSubs) return null
  // Out of windows, but late enough that the manager is going to use the
  // changes he has rather than carry them home.
  const toppingUp = context.windowsLeft <= 0 && context.minute >= 78 && context.subsUsed < SUB_RULES.maxSubs
  if (context.windowsLeft <= 0 && !toppingUp) return null
  const outfield = starters.filter((s) => s.slotPosition !== 'GK')

  // 1. A knock. Nothing else matters.
  const injured = starters.find((s) => s.injured)
  if (injured) {
    const replacement = bestReplacement(bench, injured, context)
    if (replacement) return { outId: injured.id, inId: replacement.id, reason: 'injury' }
  }

  // 2. Legs. The wide players and full-backs go first, then midfield, then the
  //    centre-backs, who do the least running.
  const tired = outfield
    .filter(() => context.minute >= 54)
    .map((s) => ({ s, over: s.load - (LOAD_LIMIT[s.slotPosition] ?? 66) - (100 - s.fitness) * 0.12 }))
    .filter(({ over }) => over > 0)
    .sort((a, b) => b.over - a.over)[0]
  if (tired) {
    const replacement = bestReplacement(bench, tired.s, context)
    if (replacement) return { outId: tired.s.id, inId: replacement.id, reason: 'fatigue' }
  }

  // 3. A booking on a tiring legs in a side that is winning: take him off
  //    before he gives the referee a decision to make.
  const booked = outfield.find((s) => s.yellowCards > 0 && s.load > 45 && context.minute >= 62)
  if (booked) {
    const replacement = bestReplacement(bench, booked, context)
    if (replacement) return { outId: booked.id, inId: replacement.id, reason: 'booking' }
  }

  // 4. Chasing it: a defender off, a forward on.
  if (context.losing && context.minute >= 64 && context.subsUsed < 4) {
    const defensive = outfield
      .filter((s) => isDefensive(s.slotPosition) && s.slotPosition !== 'GK')
      .sort((a, b) => b.load - a.load)[0]
    if (defensive) {
      const attacker = bench
        .filter((man) => !man.isKeeper && isAttacking(man.position) && man.load < 26)
        .sort((a, b) => b.attack - a.attack)[0]
      if (attacker) return { outId: defensive.id, inId: attacker.id, reason: 'chasing' }
    }
  }

  // 5. Seeing it out: a winger off, a defender or a ball-winner on.
  if (context.winning && context.minute >= 74) {
    const attacker = outfield
      .filter((s) => isAttacking(s.slotPosition) && s.slotPosition !== 'ST' && s.slotPosition !== 'LST' && s.slotPosition !== 'RST')
      .sort((a, b) => b.load - a.load)[0]
    if (attacker) {
      const shield = bench
        .filter((man) => !man.isKeeper && isDefensive(man.position) && man.load < 26)
        .sort((a, b) => b.defence - a.defence)[0]
      if (shield) return { outId: attacker.id, inId: shield.id, reason: 'seeing-out' }
    }
  }

  // 6. Half-time: a change for a man who has been badly beaten, or to fix a
  //    shape that is not working while behind.
  if (context.minute >= 44 && context.minute <= 47) {
    const worst = outfield.slice().sort((a, b) => a.rating - b.rating)[0]
    if (worst && (worst.rating < 6.1 || context.losing)) {
      const replacement = bestReplacement(bench, worst, { ...context, minute: 60 })
      if (replacement) return { outId: worst.id, inId: replacement.id, reason: 'half-time' }
    }
  }

  // 7. The allocation is there to be used. Late on, the manager gets the tired
  //    legs off whether or not the game is in the balance.
  const lateTarget = context.minute >= 84 ? SUB_RULES.maxSubs : SUB_RULES.minimumUsed
  if (context.minute >= 72 && context.subsUsed < lateTarget) {
    // Not only the exhausted: the manager wants fresh legs on the pitch for
    // the last ten minutes whether or not anybody is out on his feet.
    const spent = outfield
      .slice()
      .sort((a, b) => (b.load - (LOAD_LIMIT[b.slotPosition] ?? 66) * 0.55) - (a.load - (LOAD_LIMIT[a.slotPosition] ?? 66) * 0.55))
      .find((s) => s.load >= 12)
    if (spent) {
      const replacement = bestReplacement(bench, spent, context)
      if (replacement) return { outId: spent.id, inId: replacement.id, reason: 'legs' }
    }
  }

  return null
}

/** How many more changes the AI still wants inside the last ten minutes. */
export function subsWanted(context: SubContext): number {
  if (context.subsUsed >= SUB_RULES.maxSubs || context.minute < 80) return 0
  return Math.max(0, SUB_RULES.minimumUsed - context.subsUsed)
}

export { isAttacking, isDefensive, isWideOrFullBack, LOAD_LIMIT }
