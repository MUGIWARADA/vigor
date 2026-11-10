import { describe, expect, it } from 'vitest'
import { MANAGER_MARKS, pickSubstitution, type BenchView, type StarterView, type SubContext } from '../subs'

const starter = (changes: Partial<StarterView> = {}): StarterView => ({
  id: 'starter',
  slotPosition: 'LB',
  load: 20,
  injured: false,
  yellowCards: 0,
  rating: 6.9,
  fitness: 90,
  ...changes,
})

const benchMan = (changes: Partial<BenchView> = {}): BenchView => ({
  id: 'bench',
  position: 'LB',
  overall: 78,
  load: 0,
  attack: 55,
  defence: 72,
  isKeeper: false,
  ...changes,
})

const context = (changes: Partial<SubContext> = {}): SubContext => ({
  minute: 60,
  losing: false,
  winning: false,
  drawn: true,
  subsUsed: 0,
  windowsLeft: 3,
  ...changes,
})

/** A full eleven in a 4-3-3, all fresh. */
const eleven = (): StarterView[] => [
  starter({ id: 'gk', slotPosition: 'GK' }),
  starter({ id: 'lb' }), starter({ id: 'lcb', slotPosition: 'LCB' }), starter({ id: 'rcb', slotPosition: 'RCB' }), starter({ id: 'rb', slotPosition: 'RB' }),
  starter({ id: 'dm', slotPosition: 'DM' }), starter({ id: 'lcm', slotPosition: 'LCM' }), starter({ id: 'rcm', slotPosition: 'RCM' }),
  starter({ id: 'lw', slotPosition: 'LW' }), starter({ id: 'st', slotPosition: 'ST' }), starter({ id: 'rw', slotPosition: 'RW' }),
]

describe('AI substitutions', () => {
  it('takes an injured man off whatever the minute', () => {
    const starters = eleven()
    starters[6] = starter({ id: 'lcm', slotPosition: 'LCM', injured: true, load: 10 })
    const plan = pickSubstitution(starters, [benchMan({ id: 'cm', position: 'LCM' })], context({ minute: 22 }))
    expect(plan).toEqual({ outId: 'lcm', inId: 'cm', reason: 'injury' })
  })

  it('does not spend changes early for nothing', () => {
    const plan = pickSubstitution(eleven(), [benchMan()], context({ minute: 22 }))
    expect(plan).toBeNull()
  })

  it('gets the most tired man off once the legs start going', () => {
    const starters = eleven()
    // The wide players run the most, and this one is gone.
    starters[8] = starter({ id: 'lw', slotPosition: 'LW', load: 74, fitness: 40 })
    starters[1] = starter({ id: 'lb', load: 66, fitness: 55 })
    const plan = pickSubstitution(starters, [benchMan({ id: 'wide', position: 'LW' })], context({ minute: 62 }))
    expect(plan?.outId).toBe('lw')
    expect(plan?.reason).toBe('fatigue')
  })

  it('never asks a centre-forward to play in goal, or a keeper to play out', () => {
    const keeperHurt = eleven()
    keeperHurt[0] = starter({ id: 'gk', slotPosition: 'GK', injured: true })
    expect(pickSubstitution(keeperHurt, [benchMan({ id: 'st2', position: 'ST' })], context())).toBeNull()
    const withKeeper = pickSubstitution(keeperHurt, [benchMan({ id: 'gk2', position: 'GK', isKeeper: true })], context())
    expect(withKeeper?.inId).toBe('gk2')

    const tiredOutfielder = eleven()
    tiredOutfielder[1] = starter({ id: 'lb', load: 80, fitness: 30 })
    const plan = pickSubstitution(tiredOutfielder, [benchMan({ id: 'gk3', position: 'GK', isKeeper: true })], context({ minute: 70 }))
    expect(plan).toBeNull()
  })

  it('goes for it when a goal down late: defender off, forward on', () => {
    const plan = pickSubstitution(
      eleven(),
      [benchMan({ id: 'fwd', position: 'ST', attack: 88, defence: 30 }), benchMan({ id: 'dfb', position: 'LCB', attack: 30, defence: 86 })],
      context({ minute: 70, losing: true, drawn: false }),
    )
    expect(plan?.reason).toBe('chasing')
    expect(plan?.outId).toMatch(/^(lb|rb|lcb|rcb|dm)$/)
    expect(plan?.inId).toBe('fwd')
  })

  it('shuts up shop when protecting a lead', () => {
    const plan = pickSubstitution(
      eleven(),
      [benchMan({ id: 'fwd', position: 'ST', attack: 88, defence: 30 }), benchMan({ id: 'dfb', position: 'LCB', attack: 30, defence: 86 })],
      context({ minute: 78, winning: true, drawn: false }),
    )
    expect(plan?.reason).toBe('seeing-out')
    expect(plan?.outId).toBe('lw')
    expect(plan?.inId).toBe('dfb')
  })

  it('protects a booked, tiring player from a second yellow', () => {
    const starters = eleven()
    starters[5] = starter({ id: 'dm', slotPosition: 'DM', yellowCards: 1, load: 52, fitness: 60 })
    const plan = pickSubstitution(starters, [benchMan({ id: 'dm2', position: 'DM', defence: 80 })], context({ minute: 66 }))
    expect(plan?.outId).toBe('dm')
    expect(plan?.reason).toBe('booking')
  })

  it('uses the allocation: a quiet game still reaches four changes', () => {
    // Nobody gets injured, the score never changes — the manager just spends
    // the changes he has on tired legs as the second half wears on.
    let onPitch = eleven().map((s, i) => starter({ ...s, load: 30 + i * 3 }))
    let bench = ['LB', 'RCM', 'LW', 'ST', 'DM'].map((position, i) => benchMan({ id: `b${i}`, position, overall: 74 + i }))
    let used = 0
    for (let minute = 58; minute <= 88; minute += 2) {
      const plan = pickSubstitution(onPitch, bench, context({ minute, subsUsed: used, windowsLeft: 3 - Math.floor(used / 2) }))
      if (!plan) continue
      used += 1
      onPitch = onPitch.filter((s) => s.id !== plan.outId)
      bench = bench.filter((b) => b.id !== plan.inId)
      // The man coming on is fresh; the rest keep tiring.
      onPitch = onPitch.map((s) => starter({ ...s, load: s.load + 6 }))
    }
    expect(used).toBeGreaterThanOrEqual(4)
    expect(used).toBeLessThanOrEqual(5)
  })

  it('stops at five changes and three windows', () => {
    expect(pickSubstitution(eleven(), [benchMan()], context({ subsUsed: 5 }))).toBeNull()
    expect(pickSubstitution(eleven(), [benchMan()], context({ windowsLeft: 0 }))).toBeNull()
  })

  it('will not put on a player who is already knackered', () => {
    const starters = eleven()
    starters[8] = starter({ id: 'lw', slotPosition: 'LW', load: 80, fitness: 30 })
    const plan = pickSubstitution(starters, [benchMan({ id: 'tired', position: 'LW', load: 44 })], context({ minute: 70 }))
    expect(plan?.inId).not.toBe('tired')
  })

  it('makes a half-time change for a man who has been beaten all half', () => {
    const starters = eleven()
    starters[1] = starter({ id: 'lb', load: 30, rating: 5.2 })
    const plan = pickSubstitution(starters, [benchMan({ id: 'lb2', position: 'LB' })], context({ minute: 45 }))
    expect(plan?.outId).toBe('lb')
    expect(plan?.reason).toBe('half-time')
  })

  it('looks at the bench at sensible moments', () => {
    expect(MANAGER_MARKS[0]).toBe(45)
    expect(MANAGER_MARKS.length).toBeGreaterThanOrEqual(4)
    expect(Math.max(...MANAGER_MARKS)).toBeLessThanOrEqual(85)
  })
})
