import { describe, expect, it } from 'vitest'
import { circulationPenalty, flowVerdict, pickDropper, type FlowPicture } from '../passflow'

const picture = (changes: Partial<FlowPicture> = {}): FlowPicture => ({
  pressure: 8,
  localX: 55,
  spaceAhead: 4,
  bestLane: 1.2,
  bestGain: 1.5,
  dropComing: false,
  dropDistance: 99,
  joinArriving: false,
  progressiveOptions: 2,
  composure: 74,
  tempo: 52,
  carryLicence: 0.9,
  heldRecently: false,
  ...changes,
})

describe('pass flow', () => {
  it('drives when the grass ahead is clearly better than the pass', () => {
    const verdict = flowVerdict(picture({ spaceAhead: 16, bestLane: 2.0 }))
    expect(verdict.action).toBe('drive')
    expect(verdict.reason).toBe('space')
  })

  it('makes a centre-back need much more grass to step out than a winger', () => {
    const grass = { spaceAhead: 13, bestLane: 1.5 }
    expect(flowVerdict(picture({ ...grass, carryLicence: 1 })).action).toBe('drive')
    expect(flowVerdict(picture({ ...grass, carryLicence: 0.2 })).action).not.toBe('drive')
  })

  it('does not carry it out of his own six-yard box', () => {
    expect(flowVerdict(picture({ localX: 18, spaceAhead: 18 })).action).not.toBe('drive')
  })

  it('waits for a drop instead of passing into a crowd', () => {
    const verdict = flowVerdict(picture({ dropComing: true, dropDistance: 7, bestLane: 1.1 }))
    expect(verdict.action).toBe('wait')
    expect(verdict.reason).toBe('drop')
    expect(verdict.hold).toBeGreaterThan(0.3)
    expect(verdict.hold).toBeLessThanOrEqual(1.05)
  })

  it('waits for a runner to join when that is what is coming', () => {
    const verdict = flowVerdict(picture({ joinArriving: true }))
    expect(verdict.action).toBe('wait')
    expect(verdict.reason).toBe('join')
  })

  it('releases when the pass is actually on, even with a man dropping', () => {
    const verdict = flowVerdict(picture({ dropComing: true, bestLane: 6.4, bestGain: 9 }))
    expect(verdict.action).toBe('pass')
    expect(verdict.reason).toBe('release')
  })

  it('never stands on the ball twice in a row — the second hold is a stall', () => {
    const first = flowVerdict(picture({ dropComing: true, dropDistance: 6 }))
    const second = flowVerdict(picture({ dropComing: true, dropDistance: 6, heldRecently: true }))
    expect(first.action).toBe('wait')
    expect(second.action).toBe('pass')
  })

  it('does not wait with a defender breathing on him', () => {
    expect(flowVerdict(picture({ dropComing: true, dropDistance: 6, pressure: 1.4 })).action).not.toBe('wait')
  })

  it('a quick side holds for less time than a patient one', () => {
    const slow = flowVerdict(picture({ dropComing: true, dropDistance: 6, tempo: 20, composure: 85 }))
    const fast = flowVerdict(picture({ dropComing: true, dropDistance: 6, tempo: 95, composure: 85 }))
    expect(slow.hold).toBeGreaterThan(fast.hold)
  })

  it('does not wait for a man who is still twenty metres away', () => {
    expect(flowVerdict(picture({ dropComing: true, dropDistance: 18 })).action).toBe('pass')
  })

  it('labels a release with nobody ahead as circulation', () => {
    expect(flowVerdict(picture({ progressiveOptions: 0, bestLane: 4, bestGain: 5 })).reason).toBe('circulate')
  })
})

describe('centre-back circulation', () => {
  const pass = (changes: Partial<Parameters<typeof circulationPenalty>[0]> = {}) => circulationPenalty({
    passerRole: 'LCB',
    receiverRole: 'RCB',
    pressure: 12,
    receiverLocalX: 30,
    passerLocalX: 32,
    progressiveOptions: 3,
    ...changes,
  })

  it('marks down a square ball between centre-backs when there is time', () => {
    expect(pass()).toBeGreaterThan(8)
  })

  it('lets it go when the passer is actually pressed', () => {
    expect(pass({ pressure: 2.5 })).toBeLessThan(3)
  })

  it('lets it go when there is genuinely nothing ahead', () => {
    expect(pass({ progressiveOptions: 0 })).toBeLessThan(pass() - 2)
  })

  it('never penalises the keeper starting the move', () => {
    expect(pass({ passerRole: 'GK', pressure: 14 })).toBe(0)
  })

  it('does not penalise a pass to anybody else', () => {
    expect(pass({ receiverRole: 'LDM' })).toBe(0)
    expect(pass({ receiverRole: 'LB' })).toBe(0)
  })
})

describe('who drops in', () => {
  const man = (changes: Partial<Parameters<typeof pickDropper>[0][number]>) => ({
    id: 'p1',
    role: 'LDM',
    distance: 12,
    openness: 6,
    running: false,
    mentality: 74,
    ...changes,
  })

  it('asks the deep midfielder before a forward', () => {
    const picked = pickDropper([
      man({ id: 'dm', role: 'LDM', distance: 14 }),
      man({ id: 'st', role: 'ST', distance: 10, openness: 3 }),
    ])
    expect(picked?.id).toBe('dm')
  })

  it('never turns a runner into a dropper', () => {
    const picked = pickDropper([man({ id: 'runner', running: true, role: 'LDM' })])
    expect(picked).toBeUndefined()
  })

  it('ignores a team-mate who is already on top of the ball or miles away', () => {
    expect(pickDropper([man({ distance: 2.5 })])).toBeUndefined()
    expect(pickDropper([man({ distance: 30 })])).toBeUndefined()
  })

  it('prefers the man with room over a marked one', () => {
    const picked = pickDropper([
      man({ id: 'marked', openness: 1.2 }),
      man({ id: 'free', role: 'RB', openness: 8 }),
    ])
    expect(picked?.id).toBe('free')
  })
})
