import { describe, expect, it } from 'vitest'
import { SET_PIECE_DATA, cornerAttackShape, cornerDefenceShape, setPieceSetupSeconds, wideFreeKickAttackShape } from '../setpieces'

const shape = { width: 50, compactness: 50, lineHeight: 50 }

describe('set-piece shapes', () => {
  it('commits a full box group to an attacking corner', () => {
    const points = cornerAttackShape('Six-yard inswinger', -1, shape)
    const inBox = points.filter((p) => p.duty !== 'rest' && p.duty !== 'short')
    expect(inBox.length).toBeGreaterThanOrEqual(SET_PIECE_DATA.boxCommitment - 1)
    // The jobs modern corners are actually built on.
    expect(points.some((p) => p.duty === 'screen')).toBe(true)
    expect(points.some((p) => p.duty === 'near-post')).toBe(true)
    expect(points.some((p) => p.duty === 'back-post')).toBe(true)
    // Rest defence stays behind the ball.
    expect(points.filter((p) => p.duty === 'rest').every((p) => p.x < 80)).toBe(true)
  })

  it('lets the team attacking shape stretch the box group', () => {
    const narrow = cornerAttackShape('Six-yard inswinger', -1, { ...shape, width: 10 })
    const wide = cornerAttackShape('Six-yard inswinger', -1, { ...shape, width: 90 })
    const spreadOf = (points: typeof narrow) => {
      const ys = points.filter((p) => p.duty === 'near-post' || p.duty === 'back-post').map((p) => p.y)
      return Math.max(...ys) - Math.min(...ys)
    }
    expect(spreadOf(wide)).toBeGreaterThan(spreadOf(narrow))
  })

  it('builds the modern hybrid defence and leaves two up for the counter', () => {
    const points = cornerDefenceShape('Hybrid', -1, shape)
    expect(points.filter((p) => p.duty === 'zone').length).toBe(SET_PIECE_DATA.hybridZonalLine)
    expect(points.some((p) => p.duty === 'near-post-guard')).toBe(true)
    expect(points.filter((p) => p.duty === 'mark').length).toBe(2)
    const counters = points.filter((p) => p.duty === 'counter')
    expect(counters.length).toBe(SET_PIECE_DATA.counterLeave)
    expect(counters.every((p) => p.x < 70)).toBe(true)
  })

  it('uses each side own defensive shape, not the attacker’s', () => {
    const compact = cornerDefenceShape('Hybrid', -1, { ...shape, compactness: 90 })
    const loose = cornerDefenceShape('Hybrid', -1, { ...shape, compactness: 10 })
    const zonalX = (points: typeof compact) => points.filter((p) => p.duty === 'zone').map((p) => p.x).sort((a, b) => a - b)[0]!
    expect(zonalX(compact)).toBeGreaterThan(zonalX(loose))
    // The attacking side's own shape never enters the defending skeleton.
    expect(cornerDefenceShape('Hybrid', -1, { ...shape, width: 99 })).toEqual(cornerDefenceShape('Hybrid', -1, shape))
  })

  it('gives a wide free kick a near post, a far post and a screen', () => {
    const points = wideFreeKickAttackShape(-1, shape)
    for (const duty of ['near-post', 'back-post', 'penalty-spot', 'edge', 'screen'] as const) {
      expect(points.some((p) => p.duty === duty)).toBe(true)
    }
  })

  it('waits longer for a tired, slow side that has further to walk', () => {
    const base = setPieceSetupSeconds('corner', { meanLoad: 0, meanSpeed: 88, travel: 0, jitter: 0 })
    const tired = setPieceSetupSeconds('corner', { meanLoad: 95, meanSpeed: 55, travel: 45, jitter: 0 })
    expect(tired).toBeGreaterThan(base * 1.4)
    // A corner is a set-up; a throw-in is not.
    expect(setPieceSetupSeconds('corner', { meanLoad: 0, meanSpeed: 88, travel: 0, jitter: 0 }))
      .toBeGreaterThan(setPieceSetupSeconds('throw', { meanLoad: 0, meanSpeed: 88, travel: 0, jitter: 0 }))
  })
})
