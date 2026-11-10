import { describe, it } from 'vitest'
import { createMatch, simulateMatch, stepMatch, type MatchState } from '../engine'
import { createDefaultPlan } from '../data'
import { emptyPhaseSample, recordPhaseFrame, tacticalProfile } from '../tactics'

/**
 * The tactical profile exists so an argument about shape is an argument about
 * a number. These tests therefore check two different things: that the maths is
 * right on data whose answer is known, and that the measurement actually moves
 * when a manager moves the dial that is supposed to move it.
 */
const plan = (sliders?: Record<string, number>) => {
  const base = createDefaultPlan('bracelonia')
  if (!sliders) return base
  return { ...base, sliders: { ...base.sliders, ...sliders } }
}

function playMatch(homeSliders?: Record<string, number>, seed = 8100, frames = 7200) {
  const state = createMatch({
    homePlan: plan(homeSliders),
    awayPlan: createDefaultPlan('banyarn'),
    difficulty: 'normal',
    rules: 'standard',
    halfSeconds: 360,
    humanTeams: [],
    seed,
  })
  for (let f = 0; f < frames; f++) {
    stepMatch(state, {}, 0.05)
    if (state.phase === 'fulltime') break
  }
  return state as MatchState
}

describe('tactical profile', () => {
  it('measures a known shape exactly', () => {
    // Ten players in two rows: 4 defenders 30 m from goal, 6 midfield/forwards
    // 60 m from goal, all on the centre line. Width 0, depth pstdev 15, and a
    // centroid of 48 m — all three are checkable by hand.
    const sample = emptyPhaseSample()
    const points = [
      ...Array.from({ length: 4 }, () => ({ x: 30, y: 34 })),
      ...Array.from({ length: 6 }, () => ({ x: 60, y: 34 })),
    ]
    recordPhaseFrame(sample, points, points.map(() => 2), [30, 30, 30, 30], [60, 60, 60])
    const p = tacticalProfile({ tactics: { bracelonia: { all: sample, inPossession: sample, outOfPossession: sample }, banyarn: { all: emptyPhaseSample(), inPossession: emptyPhaseSample(), outOfPossession: emptyPhaseSample() } } } as unknown as MatchState, 'bracelonia')
    expect(p.samples).toBe(1)
    expect(p.compactness).toBeCloseTo(14.4, 1) // 0.4 × |48−30| + 0.6 × |48−60|
    expect(p.width).toBe(0)
    expect(p.depth).toBeCloseTo(14.7, 1) // pstdev of 30,30,30,30,60,60,60,60,60,60
    expect(p.blockHeight).toBeCloseTo(48, 1)
    expect(p.length).toBe(30)
    expect(p.lineHeight).toBeCloseTo(30, 1)
    expect(p.lineToMidfield).toBeCloseTo(30, 1)
    expect(p.tempoInPossession).toBeCloseTo(7.2, 1) // 2 m/s
  })

  it('every reading carries its number and a reason', () => {
    const state = playMatch(undefined, 8431, 3600)
    for (const teamId of ['bracelonia', 'banyarn'] as const) {
      const profile = tacticalProfile(state, teamId)
      expect(profile.samples).toBeGreaterThan(10)
      expect(profile.readings.length).toBeGreaterThanOrEqual(8)
      for (const reading of profile.readings) {
        expect(reading.label.length).toBeGreaterThan(0)
        expect(reading.reason.length).toBeGreaterThan(20)
        expect(Number.isFinite(reading.value)).toBe(true)
      }
      expect(Number.isFinite(profile.compactness)).toBe(true)
      expect(Number.isFinite(profile.blockHeightOutOfPossession)).toBe(true)
    }
  }, 240000)

  it('a compact side measures narrower than a stretched one', () => {
    // Two dials that are supposed to move the same shape in opposite
    // directions. Averaged over three seeds rather than trusting one, because
    // a single seed was enough to pass this test while the half of it that was
    // false went unnoticed: see the note on depth below.
    const seeds = [8762, 8100, 9093]
    const compact = seeds.map((seed) => tacticalProfile(playMatch({ compactness: 100, width: 20 }, seed, 3600), 'bracelonia'))
    const stretched = seeds.map((seed) => tacticalProfile(playMatch({ compactness: 4, width: 80 }, seed, 3600), 'bracelonia'))
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    for (const p of [...compact, ...stretched]) expect(p.samples).toBeGreaterThan(10)
    // Measured: ~9.5 m compact against ~14.5 m stretched, on every seed.
    expect(mean(stretched.map((p) => p.width))).toBeGreaterThan(mean(compact.map((p) => p.width)) + 3)
    // Depth is deliberately NOT asserted. The compactness and width dials move
    // width and leave team depth alone: measured across four seeds the same
    // change moved depth by 0.0-1.8 m, which is within match-to-match noise,
    // while it moved width by five metres every time. The previous version of
    // this test asserted a 1.5 m depth gain and passed on one seed by luck.
    // Depth is a line-length and line-height question, and it needs its own
    // measurement before anything is claimed about it.
  }, 600000)

  it('separates the two phases and measures both', () => {
    // The obvious assertion here — a side sits higher with the ball than
    // without it — does NOT hold in this engine, and the honest thing is to
    // record that rather than assert around it. Measured: Bracelonia's block
    // centroid sits at 47.8 m when attacking and 51.8 m when defending. Two
    // real effects pull that way: a lot of possession is deep build-up, which
    // drags the attacking shape back, and a lot of defending starts from a
    // high turnover, which leaves the block up the pitch. Whether that is a
    // defect or a style is the next question, and the profile is the
    // instrument for answering it — see docs/two-repos-assessment.md.
    const state = playMatch(undefined, 9093, 3600)
    for (const teamId of ['bracelonia', 'banyarn'] as const) {
      const profile = tacticalProfile(state, teamId)
      const bucket = state.tactics[teamId]!
      expect(profile.blockHeightOutOfPossession).toBeGreaterThan(10)
      expect(profile.blockHeightOutOfPossession).toBeLessThan(80)
      expect(profile.blockHeightInPossession).toBeGreaterThan(10)
      expect(profile.blockHeightInPossession).toBeLessThan(80)
      // Both phases are genuinely sampled, so the split is a measurement and
      // not one phase quietly swallowing the other.
      expect(bucket.inPossession.frames).toBeGreaterThan(20)
      expect(bucket.outOfPossession.frames).toBeGreaterThan(20)
      expect(bucket.all.frames).toBeGreaterThan(bucket.inPossession.frames)
    }
  }, 240000)

  it('does not invent numbers before a ball is kicked', () => {
    const state = createMatch({
      homePlan: plan(),
      awayPlan: createDefaultPlan('banyarn'),
      difficulty: 'normal',
      rules: 'standard',
      halfSeconds: 360,
      humanTeams: [],
      seed: 1,
    })
    for (const teamId of ['bracelonia', 'banyarn'] as const) {
      const profile = tacticalProfile(state, teamId)
      expect(profile.samples).toBe(0)
      expect(Number.isFinite(profile.compactness)).toBe(true)
      expect(Number.isNaN(profile.compactness)).toBe(false)
    }
  })

  it('fills in over a simulated match', () => {
    const state = simulateMatch({
      homePlan: plan(),
      awayPlan: createDefaultPlan('banyarn'),
      difficulty: 'normal',
      rules: 'standard',
      halfSeconds: 360,
      humanTeams: [],
      seed: 8100,
    }, 7200, 0.05)
    const home = tacticalProfile(state, 'bracelonia')
    const away = tacticalProfile(state, 'banyarn')
    expect(home.samples).toBeGreaterThan(100)
    expect(away.samples).toBeGreaterThan(100)
    expect(home.width).toBeGreaterThan(5)
      expect(home.width).toBeLessThan(30)
    expect(home.lineToMidfield).toBeGreaterThan(-20)
  }, 240000)
})
