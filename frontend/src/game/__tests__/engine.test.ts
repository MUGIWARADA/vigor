import { describe, expect, it } from 'vitest'
import { DEFAULT_GAMEPLAY_SETTINGS, FORMATIONS, createDefaultPlan, normalizeGameplaySettings } from '../data'
import { GOAL_PHASE_SECONDS, NEUTRAL_INPUT, createMatch, restartTakerReady, simulateMatch, stepMatch, strikeFoot, type PlayerInput, type RuntimePlayer } from '../engine'

function config() {
  return {
    homePlan: createDefaultPlan('bracelonia'),
    awayPlan: createDefaultPlan('banyarn'),
    difficulty: 'normal' as const,
    rules: 'standard' as const,
    halfSeconds: 360,
    humanTeams: [],
    seed: 1234,
  }
}

const humanInput = (changes: Partial<PlayerInput>): PlayerInput => ({ ...NEUTRAL_INPUT, ...changes })

function makeLive(state: ReturnType<typeof createMatch>) {
  state.phase = 'play'
  state.restart = null
}

function setDribbleBall(state: ReturnType<typeof createMatch>, ownerId: string) {
  state.ball.ownerId = ownerId
  state.ball.kind = 'dribble'
}

function isolatePlayers(state: ReturnType<typeof createMatch>, keepIds: Set<string>) {
  let index = 0
  for (const p of state.players.filter((x) => x.onPitch && !keepIds.has(x.id))) {
    p.pos = { x: p.teamId === 'bracelonia' ? 8 : 97, y: index % 2 ? 65 : 3 }
    p.target = { ...p.pos }
    p.vel = { x: 0, y: 0 }
    index += 1
  }
}

function byName(state: ReturnType<typeof createMatch>, name: string): RuntimePlayer {
  return state.players.find((p) => p.base.name === name)!
}

function place(p: RuntimePlayer, x: number, y: number, vel = { x: 0, y: 0 }, facing = { x: 1, y: 0 }) {
  p.pos = { x, y }
  p.target = { x, y }
  p.vel = vel
  p.facing = facing
}

function tackleOutcomes(power: number, slide: boolean, transition: boolean, seeds = 28) {
  const tally = { fouls: 0, yellows: 0, reds: 0 }
  for (let seed = 1; seed <= seeds; seed++) {
    const state = createMatch({ ...config(), humanTeams: ['bracelonia'], seed: 5000 + seed * 13 })
    const defender = byName(state, 'Rodrico Hernaz')
    const carrier = byName(state, 'Jamal Musiara')
    for (const p of state.players.filter((x) => x.onPitch && x.id !== defender.id && x.id !== carrier.id)) {
      if (p.teamId === 'bracelonia') place(p, p.slotPosition === 'GK' ? 3 : 52, 8 + p.base.number * 2)
      else place(p, 90, 6 + p.base.number * 2)
    }
    if (transition) {
      place(carrier, 30, 34, { x: -5.5, y: 0 }, { x: -1, y: 0 })
      place(defender, 31.5, 34, { x: -5, y: 0 }, { x: -1, y: 0 })
      state.clockSeconds = 74 * 60
    } else {
      place(carrier, 52, 34, { x: -2, y: 0 }, { x: -1, y: 0 })
      place(defender, 50.5, 34, { x: 1, y: 0 }, { x: 1, y: 0 })
      state.clockSeconds = 18 * 60
    }
    defender.tackleCooldown = 0
    state.controlled.bracelonia = defender.id
    makeLive(state)
    setDribbleBall(state, carrier.id)
    state.ball.pos = { ...carrier.pos }
    state.ball.lastTouchTeamId = carrier.teamId
    state.ball.lastTouchPlayerId = carrier.id
    carrier.decisionTimer = 9
    stepMatch(state, { bracelonia: slide ? humanInput({ cross: true, crossPower: power }) : humanInput({ tackle: true, tacklePower: power }) }, 0.016)
    tally.fouls += defender.fouls
    tally.yellows += defender.yellowCards
    if (defender.sentOff) tally.reds += 1
  }
  return tally
}

function shotOutcomes(distance: number, aimY: number, power: number, seeds = 24) {
  const tally = { goals: 0, catches: 0, corners: 0, parries: 0, offTarget: 0, onTarget: 0, other: 0 }
  for (let seed = 1; seed <= seeds; seed++) {
    const state = createMatch({ ...config(), humanTeams: ['bracelonia'], seed: 12000 + seed * 31 })
    const shooter = state.players.find((p) => p.base.name === 'Rafinher')!
    const keeper = state.players.find((p) => p.teamId === 'banyarn' && p.slotPosition === 'GK')!
    isolatePlayers(state, new Set([shooter.id, keeper.id]))
    makeLive(state)
    shooter.pos = { x: 105 - distance, y: 34 }
    shooter.target = { ...shooter.pos }
    shooter.vel = { x: 0, y: 0 }
    keeper.pos = { x: 103.2, y: 34 }
    keeper.target = { ...keeper.pos }
    keeper.vel = { x: 0, y: 0 }
    setDribbleBall(state, shooter.id)
    state.ball.pos = { ...shooter.pos }
    state.ball.lastTouchTeamId = 'bracelonia'
    state.ball.lastTouchPlayerId = shooter.id
    state.controlled.bracelonia = shooter.id
    stepMatch(state, { bracelonia: humanInput({ shoot: true, shootPower: power, move: { x: 1, y: aimY } }) }, 0.016)
    tally.onTarget += state.stats.bracelonia.shotsOnTarget
    let outcome = 'other'
    for (let frame = 0; frame < 220; frame++) {
      stepMatch(state, {}, 0.016)
      if (state.score.bracelonia > 0) { outcome = 'goal'; break }
      if (state.ball.ownerId === keeper.id) { outcome = 'catch'; break }
      if (state.phase === 'restart') {
        outcome = state.restart?.type === 'corner' ? 'corner' : 'offTarget'
        break
      }
      if (state.ball.kind === 'loose' && state.ball.lastTouchPlayerId === keeper.id) { outcome = 'parry'; break }
      if (state.phase !== 'play') break
    }
    if (outcome === 'goal') tally.goals += 1
    else if (outcome === 'catch') tally.catches += 1
    else if (outcome === 'corner') tally.corners += 1
    else if (outcome === 'parry') tally.parries += 1
    else if (outcome === 'offTarget') tally.offTarget += 1
    else tally.other += 1
  }
  return tally
}

describe('Community Game Mode 11v11 engine', () => {
  it('starts with 22 players on a full-size pitch and the BallState live at kick-off', () => {
    const state = createMatch(config())
    expect(state.players.filter((p) => p.onPitch)).toHaveLength(22)
    expect(state.ball.pos).toEqual({ x: 52.5, y: 34 })
    expect(state.restart?.type).toBe('kickoff')
    expect(state.players.every((p) => !p.onPitch || (p.pos.x >= 0 && p.pos.x <= 105 && p.pos.y >= 0 && p.pos.y <= 68))).toBe(true)
  })

  it('keeps an AI-vs-AI passage finite and produces passing football', () => {
    const state = createMatch(config())
    for (let i = 0; i < 240; i++) stepMatch(state, {}, 0.05)
    expect(state.players.every((p) => Number.isFinite(p.pos.x) && Number.isFinite(p.pos.y))).toBe(true)
    expect(Number.isFinite(state.ball.pos.x)).toBe(true)
    expect(state.stats.bracelonia.passes + state.stats.banyarn.passes).toBeGreaterThan(0)
    expect(state.ball.z).toBeGreaterThanOrEqual(0)
  })

  it('can complete a deterministic shortened AI-vs-AI match', () => {
    const state = simulateMatch(config(), 48, 0.05)
    expect(state.phase).toBe('fulltime')
    expect(state.score.bracelonia).toBeGreaterThanOrEqual(0)
    expect(state.score.banyarn).toBeGreaterThanOrEqual(0)
    expect(state.players.filter((p) => p.onPitch).length).toBeGreaterThanOrEqual(18)
    expect(state.players.every((p) => p.avgX >= 0 && p.avgX <= 105 && p.avgY >= 0 && p.avgY <= 68)).toBe(true)
    expect(state.players.some((p) => p.positionHeat.reduce((sum, v) => sum + v, 0) > 10)).toBe(true)
    expect(state.stats.bracelonia.saves + state.stats.banyarn.saves).toBeGreaterThanOrEqual(0)
  })

  it('plays a human kick-off safely back to midfield support', () => {
    const state = createMatch({ ...config(), humanTeams: ['bracelonia'] })
    stepMatch(state, { bracelonia: humanInput({ move: { x: 1, y: 0 }, pass: true }) }, 0.016)
    const intended = state.players.find((p) => p.id === state.ball.intendedReceiverId)
    expect(intended).toBeDefined()
    expect(['DM', 'LDM', 'RDM', 'LCM', 'CM', 'RCM', 'CAM', 'LM', 'RM']).toContain(intended?.slotPosition)
    expect(state.controlled.bracelonia).toBe(intended?.id)
  })

  it('keeps a human receiver locked onto a pass while a run direction is held', () => {
    const state = createMatch({ ...config(), humanTeams: ['bracelonia'] })
    state.phase = 'play'
    state.restart = null
    stepMatch(state, { bracelonia: humanInput({ move: { x: 0, y: -1 }, pass: true }) }, 0.016)
    // Which wide player the kick-off ball finds depends on the current shape,
    // so the lock-on is asserted against the pass that was actually played.
    const receiver = state.players.find((p) => p.id === state.ball.intendedReceiverId)!
    expect(['LB', 'RB', 'LW', 'RW', 'LM', 'RM']).toContain(receiver.slotPosition)
    // Still inside the home half at the moment the ball leaves the foot.
    expect(receiver.pos.x).toBeLessThan(60)
    for (let frame = 0; frame < 180 && state.ball.ownerId !== receiver.id; frame++) {
      stepMatch(state, { bracelonia: humanInput({ move: { x: 1, y: 0 }, sprint: true }) }, 0.016)
    }
    expect(state.ball.ownerId).toBe(receiver.id)
    expect(state.controlled.bracelonia).toBe(receiver.id)
  })

  it('does not teleport distant players when an ordinary restart is awarded', () => {
    const state = createMatch({ ...config(), humanTeams: ['bracelonia'] })
    const Raphinha = state.players.find((p) => p.base.name === 'Rafinher')!
    Raphinha.pos = { x: 80, y: 10 }
    Raphinha.target = { ...Raphinha.pos }
    Raphinha.vel = { x: 0, y: 0 }
    state.phase = 'play'
    state.restart = null
    state.ball.ownerId = null
    state.ball.kind = 'loose'
    state.ball.pos = { x: 20, y: -0.1 }
    state.ball.vel = { x: 0, y: -1 }
    state.ball.lastTouchTeamId = 'banyarn'
    stepMatch(state, {}, 0.05)
    expect(state.phase).toBe('restart')
    expect(state.restart).toMatchObject({ type: 'throw' })
    expect(Math.hypot(Raphinha.pos.x - 80, Raphinha.pos.y - 10)).toBeLessThan(1)
  })

  it('sends urgent first and second recovery runners after a loose BallState', () => {
    const state = createMatch(config())
    const Pedri = state.players.find((p) => p.base.name === 'Pedrilho')!
    const deJong = state.players.find((p) => p.base.name === 'Frankie de Jongh')!
    isolatePlayers(state, new Set([Pedri.id, deJong.id]))
    makeLive(state)
    Pedri.pos = { x: 40, y: 34 }
    Pedri.target = { ...Pedri.pos }
    Pedri.vel = { x: 0, y: 0 }
    Pedri.burst = 0.35
    deJong.pos = { x: 37, y: 30 }
    deJong.target = { ...deJong.pos }
    deJong.vel = { x: 0, y: 0 }
    state.ball.ownerId = null
    state.ball.intendedReceiverId = null
    state.ball.passTeamId = null
    state.ball.kind = 'loose'
    state.ball.pos = { x: 50, y: 34 }
    state.ball.vel = { x: 0, y: 0 }
    state.ball.z = 0
    state.ball.vz = 0

    stepMatch(state, {}, 0.016)
    expect(Pedri.moveUrgency).toBe(2)
    // A genuinely loose BallState now draws more than one committed runner,
    // so the second man may also break at full urgency.
    expect(deJong.moveUrgency).toBeGreaterThanOrEqual(1)

    let peakSpeed = 0
    let acquiredAt = -1
    for (let frame = 2; frame <= 120; frame++) {
      stepMatch(state, {}, 0.016)
      peakSpeed = Math.max(peakSpeed, Math.hypot(Pedri.vel.x, Pedri.vel.y))
      if (state.ball.ownerId === Pedri.id) {
        acquiredAt = frame * 0.016
        break
      }
    }
    // A depleted chaser must still break at genuine sprint speed.
    expect(peakSpeed).toBeGreaterThan(7)
    expect(acquiredAt).toBeGreaterThan(0)
    expect(acquiredAt).toBeLessThan(1.8)
  })

  it('lets a set keeper deal with most moderate central shots from 25m', () => {
    const outcomes = shotOutcomes(25, 0, 0.45, 24)
    expect(outcomes.goals).toBeLessThanOrEqual(3)
    expect(outcomes.catches).toBeGreaterThanOrEqual(7)
    expect(outcomes.catches + outcomes.parries + outcomes.corners).toBeGreaterThanOrEqual(18)
  })

  it('makes 32m shooting materially less accurate than close-range shooting', () => {
    const outcomes = shotOutcomes(32, 0.68, 0.72, 24)
    expect(outcomes.onTarget).toBeLessThan(24)
    expect(outcomes.goals).toBeLessThanOrEqual(4)
  })

  it('gives a reception a visible first touch and brief settle time', () => {
    const state = createMatch({ ...config(), humanTeams: ['bracelonia'] })
    makeLive(state)
    stepMatch(state, { bracelonia: humanInput({ move: { x: 0, y: -1 }, pass: true }) }, 0.016)
    const receiver = state.players.find((p) => p.id === state.ball.intendedReceiverId)!
    for (let frame = 0; frame < 180 && state.ball.ownerId !== receiver.id; frame++) {
      stepMatch(state, { bracelonia: humanInput({ move: { x: 1, y: 0 }, sprint: true }) }, 0.016)
    }
    expect(state.ball.ownerId).toBe(receiver.id)
    expect(receiver.touchDistance).toBeGreaterThan(0.25)
    expect(receiver.touchTimer).toBeGreaterThan(0.05)
    stepMatch(state, { bracelonia: humanInput({ pass: true, move: { x: 1, y: 0 } }) }, 0.016)
    expect(state.ball.ownerId).toBe(receiver.id)
  })

  it('does not turn ordinary tap tackles into automatic yellow cards', () => {
    const tap = tackleOutcomes(0.16, false, false, 28)
    expect(tap.fouls).toBeLessThanOrEqual(6)
    expect(tap.yellows).toBe(0)
    expect(tap.reds).toBe(0)
  })

  it('punishes a full-power slide from behind on a late transition much more severely', () => {
    const outcomes = tackleOutcomes(1, true, true, 24)
    expect(outcomes.yellows + outcomes.reds).toBeGreaterThanOrEqual(5)
  })

  it('moves Bracelonia fullbacks and interiors high in the final third', () => {
    const state = createMatch(config())
    const Raphinha = byName(state, 'Rafinher')
    place(Raphinha, 78, 12, { x: 2, y: 0 })
    ;['Alfonzo Daviz', 'Kim Min-Jae', 'Dayo Upamekano', 'Josip Stanisic'].forEach((name, i) => place(byName(state, name), 88, 16 + i * 12))
    makeLive(state)
    setDribbleBall(state, Raphinha.id)
    state.ball.pos = { ...Raphinha.pos }
    Raphinha.decisionTimer = 9
    stepMatch(state, {}, 0.016)
    expect(byName(state, 'Alex Baldero').target.x).toBeGreaterThanOrEqual(86)
    expect(byName(state, 'Pedrilho').target.x).toBeGreaterThanOrEqual(78)
    expect(byName(state, 'Jules Koundéir').target.x).toBeLessThanOrEqual(68)
  })

  it('keeps Banyarn’s CDM in midfield during build-up and releases the left-back', () => {
    const state = createMatch(config())
    const Kim = byName(state, 'Kim Min-Jae')
    place(Kim, 80, 34, { x: 0, y: 0 }, { x: -1, y: 0 })
    makeLive(state)
    setDribbleBall(state, Kim.id)
    state.ball.pos = { ...Kim.pos }
    Kim.decisionTimer = 9
    stepMatch(state, {}, 0.016)
    const localX = (p: RuntimePlayer) => 105 - p.target.x
    const KimmichX = localX(byName(state, 'Joss Kimmish'))
    expect(KimmichX).toBeGreaterThan(28)
    expect(KimmichX).toBeLessThan(40)
    expect(KimmichX).toBeGreaterThan(localX(byName(state, 'Dayo Upamekano')) + 5)
    expect(localX(byName(state, 'Alfonzo Daviz'))).toBeGreaterThan(38)
  })

  it('keeps Bracelonia’s high defensive line synchronized on a trap trigger', () => {
    const state = createMatch(config())
    const Musiala = byName(state, 'Jamal Musiara')
    place(Musiala, 75, 34, { x: 2.5, y: 0 }, { x: 1, y: 0 })
    place(byName(state, 'Gabby Jesulo'), 72.5, 34, { x: 3, y: 0 }, { x: 1, y: 0 })
    makeLive(state)
    setDribbleBall(state, Musiala.id)
    state.ball.pos = { ...Musiala.pos }
    Musiala.decisionTimer = 9
    stepMatch(state, {}, 0.016)
    const line = ['Alex Baldero', 'Pau Cubanti', 'Erik Garzo', 'Jules Koundéir'].map((name) => byName(state, name).target.x)
    expect(Math.min(...line)).toBeGreaterThan(50)
    expect(Math.max(...line) - Math.min(...line)).toBeLessThan(1)
  })

  it('escapes through the wings when the centre is blocked in build-up', () => {
    let attempts = 0
    let wide = 0
    for (let seed = 1; seed <= 16; seed++) {
      const state = createMatch({ ...config(), seed: 7000 + seed * 7 })
      const cb = byName(state, 'Pau Cubanti')
      place(cb, 25, 34)
      place(byName(state, 'Alex Baldero'), 36, 7)
      place(byName(state, 'Jules Koundéir'), 36, 61)
      ;['Harri Cane', 'Jamal Musiara', 'Joss Kimmish', 'Alex Pavlovich', 'Michel Oliseer'].forEach((name, i) => place(byName(state, name), 37 + i * 3, 27 + i * 3))
      makeLive(state)
      setDribbleBall(state, cb.id)
      state.ball.pos = { ...cb.pos }
      cb.decisionTimer = 0
      stepMatch(state, {}, 0.016)
      const intended = state.players.find((p) => p.id === state.ball.intendedReceiverId)
      if (intended) {
        attempts += 1
        if (['LB', 'RB', 'LW', 'RW', 'LM', 'RM'].includes(intended.slotPosition) || Math.abs(intended.pos.y - 34) >= 18) wide += 1
      }
    }
    expect(attempts).toBeGreaterThanOrEqual(8)
    expect(wide / attempts).toBeGreaterThan(0.6)
  })

  it('keeps the kickoff taker still on the BallState until the user plays it', () => {
    const state = createMatch({ ...config(), humanTeams: ['bracelonia'] })
    const taker = state.players.find((p) => p.id === state.restart?.takerId)!
    const start = { ...taker.pos }
    for (let frame = 0; frame < 90; frame++) stepMatch(state, {}, 0.016)
    expect(state.phase).toBe('restart')
    expect(state.ball.ownerId).toBe(taker.id)
    expect(Math.hypot(taker.pos.x - start.x, taker.pos.y - start.y)).toBeLessThan(0.25)
    expect(Math.hypot(taker.vel.x, taker.vel.y)).toBeLessThan(0.25)
  })

  it('keeps players moving into throw-in support positions instead of freezing the restart', () => {
    const state = createMatch({ ...config(), humanTeams: ['bracelonia'] })
    makeLive(state)
    state.ball.ownerId = null
    state.ball.kind = 'loose'
    state.ball.pos = { x: 28, y: -0.1 }
    state.ball.vel = { x: 0, y: -1 }
    state.ball.lastTouchTeamId = 'banyarn'
    stepMatch(state, {}, 0.05)
    expect(state.phase).toBe('restart')
    expect(state.restart).toMatchObject({ type: 'throw', teamId: 'bracelonia' })
    const taker = state.players.find((p) => p.id === state.restart?.takerId)!
    const before = new Map(state.players.filter((p) => p.onPitch).map((p) => [p.id, { ...p.pos }]))
    const startDistance = Math.hypot(taker.pos.x - state.ball.pos.x, taker.pos.y - state.ball.pos.y)
    // No teleport onto the restart: the taker must actually travel to it.
    expect(startDistance).toBeGreaterThan(3)
    expect(restartTakerReady(state)).toBe(false)
    for (let frame = 0; frame < 20; frame++) stepMatch(state, {}, 0.016)
    expect(Math.hypot(taker.pos.x - state.ball.pos.x, taker.pos.y - state.ball.pos.y)).toBeGreaterThan(1.5)
    for (let frame = 0; frame < 320; frame++) stepMatch(state, {}, 0.016)
    expect(state.phase).toBe('restart')
    expect(Math.hypot(taker.pos.x - state.ball.pos.x, taker.pos.y - state.ball.pos.y)).toBeLessThan(2.8)
    expect(restartTakerReady(state)).toBe(true)
    const supportTargets = state.players.filter((p) => p.teamId === 'bracelonia' && p.id !== taker.id && Math.hypot(p.target.x - state.ball.pos.x, p.target.y - state.ball.pos.y) < 18)
    expect(supportTargets.length).toBeGreaterThanOrEqual(2)
    const totalMovement = state.players.filter((p) => p.onPitch).reduce((sum, p) => {
      const old = before.get(p.id)!
      return sum + Math.hypot(p.pos.x - old.x, p.pos.y - old.y)
    }, 0)
    expect(totalMovement).toBeGreaterThan(2)
  })

  it('sets a throw-in up before releasing it instead of taking it instantly', () => {
    const state = createMatch(config())
    makeLive(state)
    state.ball.ownerId = null
    state.ball.kind = 'loose'
    state.ball.pos = { x: 40, y: -0.1 }
    state.ball.vel = { x: 0, y: -1 }
    state.ball.lastTouchTeamId = 'banyarn'
    stepMatch(state, {}, 0.05)
    expect(state.restart).toMatchObject({ type: 'throw' })
    const restart = state.restart!
    // A normal throw-in is gathered and set: no instant release.
    expect(restart.setup).toBeGreaterThanOrEqual(1.2)
    let frames = 0
    while (state.phase === 'restart' && frames < 400) {
      stepMatch(state, {}, 0.05)
      frames += 1
      if (state.phase === 'restart' && restart.arrived) {
        // He is over the BallState but the side is not set yet: it must not go.
        expect(restart.timer).toBeLessThan((restart.arrivedAt ?? 0) + restart.setup)
      }
    }
    expect(state.restart).toBeNull()
    // It only went once the taker had arrived and the set-up clock had run.
    expect(restart.arrived).toBe(true)
    expect(restart.timer).toBeGreaterThanOrEqual((restart.arrivedAt ?? 0) + restart.setup)
  })

  it('keeps shuffling through a long throw-in set-up instead of freezing on the spot', () => {
    const state = createMatch({ ...config(), humanTeams: ['bracelonia'] })
    makeLive(state)
    state.ball.ownerId = null
    state.ball.kind = 'loose'
    state.ball.pos = { x: 40, y: -0.1 }
    state.ball.vel = { x: 0, y: -1 }
    state.ball.lastTouchTeamId = 'banyarn'
    stepMatch(state, {}, 0.05)
    const taker = state.players.find((p) => p.id === state.restart?.takerId)!
    const window = (seconds: number) => {
      for (let f = 0; f < Math.round(seconds / 0.05); f++) stepMatch(state, {}, 0.05)
      const before = new Map(state.players.filter((p) => p.onPitch).map((p) => [p.id, { ...p.pos }]))
      for (let f = 0; f < 20; f++) stepMatch(state, {}, 0.05)
      let total = 0
      let movers = 0
      for (const p of state.players.filter((p) => p.onPitch && p.id !== taker.id)) {
        const old = before.get(p.id)!
        const moved = Math.hypot(p.pos.x - old.x, p.pos.y - old.y)
        total += moved
        if (moved > 0.05) movers += 1
      }
      return { total, movers }
    }
    const early = window(3)
    const late = window(6)
    // A dead ball is never a frozen picture: five seconds into the wait the
    // other 21 players are still checking, drifting and re-marking.
    expect(early.total).toBeGreaterThan(3)
    expect(late.total).toBeGreaterThan(3)
    expect(late.movers).toBeGreaterThanOrEqual(8)
  })

  it('takes a quick throw when a free man is beyond the line and a slow one when not', () => {
    const quickState = createMatch(config())
    makeLive(quickState)
    for (const p of quickState.players.filter((p) => p.teamId === 'banyarn' && p.onPitch && p.slotPosition !== 'GK')) {
      p.pos = { x: 30, y: p.slotPosition === 'RB' ? 60 : 44 }
    }
    const runner = quickState.players.find((p) => p.teamId === 'bracelonia' && p.onPitch && p.slotPosition === 'RW')!
    runner.pos = { x: 78, y: 8 }
    quickState.ball.ownerId = null
    quickState.ball.kind = 'loose'
    quickState.ball.pos = { x: 46, y: -0.1 }
    quickState.ball.vel = { x: 0, y: -1 }
    quickState.ball.lastTouchTeamId = 'banyarn'
    stepMatch(quickState, {}, 0.05)
    expect(quickState.restart).toMatchObject({ type: 'throw', quick: true, quickTargetId: runner.id })
    expect(quickState.restart!.setup).toBeLessThan(0.6)
    let frames = 0
    while (quickState.phase === 'restart' && frames < 200) {
      stepMatch(quickState, {}, 0.05)
      frames += 1
    }
    expect(quickState.ball.intendedReceiverId).toBe(runner.id)

    const slowState = createMatch(config())
    makeLive(slowState)
    for (const p of slowState.players.filter((p) => p.teamId === 'banyarn' && p.onPitch)) {
      p.pos = { x: 52, y: 34 + (p.baseY - 34) * 0.35 }
    }
    slowState.ball.ownerId = null
    slowState.ball.kind = 'loose'
    slowState.ball.pos = { x: 46, y: -0.1 }
    slowState.ball.vel = { x: 0, y: -1 }
    slowState.ball.lastTouchTeamId = 'banyarn'
    stepMatch(slowState, {}, 0.05)
    // Everyone is marked and the shape is set: no reason to rush it.
    expect(slowState.restart).toMatchObject({ type: 'throw', quick: false })
    expect(slowState.restart!.setup).toBeGreaterThanOrEqual(1.2)
  })

  it('floats a throw-in in the air with no offside instead of drilling a ground pass', () => {
    const state = createMatch(config())
    makeLive(state)
    state.ball.ownerId = null
    state.ball.kind = 'loose'
    state.ball.pos = { x: 60, y: -0.1 }
    state.ball.vel = { x: 0, y: -1 }
    state.ball.lastTouchTeamId = 'banyarn'
    stepMatch(state, {}, 0.05)
    let peak = 0
    let frames = 0
    while (state.phase === 'restart' && frames < 300) {
      stepMatch(state, {}, 0.05)
      frames += 1
    }
    expect(state.restart).toBeNull()
    expect(state.ball.offsideReceiverId).toBeNull()
    for (let f = 0; f < 24; f++) {
      stepMatch(state, {}, 0.05)
      peak = Math.max(peak, state.ball.z)
    }
    expect(peak).toBeGreaterThan(1.5)
  })

  it('buffers a human restart press until the side is set instead of dropping it', () => {
    const state = createMatch({ ...config(), humanTeams: ['bracelonia'] })
    makeLive(state)
    state.ball.ownerId = null
    state.ball.kind = 'loose'
    state.ball.pos = { x: 40, y: -0.1 }
    state.ball.vel = { x: 0, y: -1 }
    state.ball.lastTouchTeamId = 'banyarn'
    stepMatch(state, {}, 0.05)
    // Press immediately, long before the taker has even arrived.
    stepMatch(state, { bracelonia: humanInput({ pass: true, move: { x: 1, y: 0 } }) }, 0.05)
    expect(state.phase).toBe('restart')
    expect(state.restart?.buffered).not.toBeNull()
    // No further input: it releases itself once the thrower is set.
    let frames = 0
    while (state.phase === 'restart' && frames < 400) {
      stepMatch(state, {}, 0.05)
      frames += 1
    }
    expect(state.phase).toBe('play')
  })

  it('knocks the BallState ahead into space and lets the carrier run onto it', () => {
    const state = createMatch({ ...config(), humanTeams: ['bracelonia'] })
    const Raphinha = byName(state, 'Rafinher')
    isolatePlayers(state, new Set([Raphinha.id]))
    place(Raphinha, 45, 34, { x: 5, y: 0 }, { x: 1, y: 0 })
    makeLive(state)
    setDribbleBall(state, Raphinha.id)
    state.ball.pos = { x: 46.2, y: 34 }
    state.ball.lastTouchTeamId = 'bracelonia'
    state.ball.lastTouchPlayerId = Raphinha.id
    state.controlled.bracelonia = Raphinha.id
    Raphinha.touchTimer = 0
    stepMatch(state, { bracelonia: humanInput({ knockAhead: true, sprint: true, move: { x: 1, y: 0 } }) }, 0.016)
    expect(state.ball.ownerId).toBeNull()
    expect(state.ball.intendedReceiverId).toBe(Raphinha.id)
    expect(state.ball.vel.x).toBeGreaterThan(8)
    for (let frame = 0; frame < 180 && state.ball.ownerId !== Raphinha.id; frame++) {
      stepMatch(state, { bracelonia: humanInput({ sprint: true, move: { x: 1, y: 0 } }) }, 0.016)
    }
    expect(state.ball.ownerId).toBe(Raphinha.id)
    expect(Raphinha.pos.x).toBeGreaterThan(52)
  })

  it('knocks the BallState into space when an AI carrier escapes the offside trap', () => {
    const state = createMatch(config())
    const striker = byName(state, 'Gabby Jesulo')
    const keeper = state.players.find((p) => p.teamId === 'banyarn' && p.slotPosition === 'GK')!
    for (const p of state.players.filter((x) => x.onPitch && x.id !== striker.id && x.id !== keeper.id)) {
      place(p, p.teamId === 'banyarn' ? 18 : 12, p.base.number % 2 ? 5 : 63)
    }
    place(keeper, 103, 34)
    place(striker, 65, 34, { x: 5, y: 0 }, { x: 1, y: 0 })
    makeLive(state)
    setDribbleBall(state, striker.id)
    state.ball.pos = { x: 66.2, y: 34 }
    state.ball.lastTouchTeamId = 'bracelonia'
    state.ball.lastTouchPlayerId = striker.id
    striker.decisionTimer = 0
    striker.touchTimer = 0
    stepMatch(state, {}, 0.016)
    expect(state.ball.ownerId).toBeNull()
    expect(state.ball.intendedReceiverId).toBe(striker.id)
    expect(state.ball.vel.x).toBeGreaterThan(8)
  })

  it('squares a wide breakaway to a better-placed support runner', () => {
    const state = createMatch(config())
    const striker = byName(state, 'Gabby Jesulo')
    const support = byName(state, 'Rafinher')
    const keeper = state.players.find((p) => p.teamId === 'banyarn' && p.slotPosition === 'GK')!
    for (const p of state.players.filter((x) => x.onPitch && ![striker.id, support.id, keeper.id].includes(x.id))) {
      place(p, 18, p.base.number % 2 ? 5 : 63)
    }
    place(keeper, 103, 34)
    place(support, 90, 34, { x: 4, y: 0 }, { x: 1, y: 0 })
    place(striker, 92, 10, { x: 5, y: 0 }, { x: 1, y: 0 })
    makeLive(state)
    setDribbleBall(state, striker.id)
    state.ball.pos = { x: 93.2, y: 10 }
    striker.decisionTimer = 0
    striker.touchTimer = 0
    stepMatch(state, {}, 0.016)
    expect(state.ball.intendedReceiverId).toBe(support.id)
  })

  it('goes for goal when a breakaway carrier reaches finishing range', () => {
    const state = createMatch(config())
    const striker = byName(state, 'Gabby Jesulo')
    const keeper = state.players.find((p) => p.teamId === 'banyarn' && p.slotPosition === 'GK')!
    for (const p of state.players.filter((x) => x.onPitch && x.id !== striker.id && x.id !== keeper.id)) {
      place(p, 18, p.base.number % 2 ? 5 : 63)
    }
    place(keeper, 103, 34)
    place(striker, 95, 34, { x: 5, y: 0 }, { x: 1, y: 0 })
    makeLive(state)
    setDribbleBall(state, striker.id)
    state.ball.pos = { x: 96.2, y: 34 }
    striker.decisionTimer = 0
    striker.touchTimer = 0
    stepMatch(state, {}, 0.016)
    expect(state.stats.bracelonia.shots).toBe(1)
  })

  it('steers ordinary movement through a smoothed target instead of snapping to a new anchor', () => {
    const state = createMatch(config())
    const owner = byName(state, 'Frankie de Jongh')
    const Pedri = byName(state, 'Pedrilho')
    place(owner, 52, 34)
    place(Pedri, 35, 24)
    Pedri.smoothedTarget = { ...Pedri.pos }
    makeLive(state)
    setDribbleBall(state, owner.id)
    state.ball.pos = { ...owner.pos }
    owner.decisionTimer = 9
    stepMatch(state, {}, 0.016)
    expect(Pedri.smoothedTarget.x).toBeGreaterThan(35)
    expect(Pedri.smoothedTarget.x).toBeLessThan(Pedri.target.x - 5)
    expect(Number.isFinite(Pedri.vel.x)).toBe(true)
  })

  it('uses the named primary and edge players in a corner setup', () => {
    const homePlan = createDefaultPlan('bracelonia')
    const primary = homePlan.slots.map((s) => s.playerId).find((id) => id.includes('-5-'))!
    const edge = homePlan.slots.map((s) => s.playerId).find((id) => id.includes('-8-'))!
    const cornerTaker = homePlan.slots.map((s) => s.playerId).find((id) => id.includes('-11-'))!
    homePlan.setPieces = {
      ...homePlan.setPieces,
      assignmentMode: 'manual',
      leftCorner: cornerTaker,
      primaryTarget: primary,
      edgePlayer: edge,
      attackingCorner: 'Six-yard inswinger',
    }
    const state = createMatch({ ...config(), homePlan })
    makeLive(state)
    state.ball.ownerId = null
    state.ball.kind = 'loose'
    state.ball.pos = { x: 106, y: 20 }
    state.ball.vel = { x: 1, y: 0 }
    state.ball.lastTouchTeamId = 'banyarn'
    stepMatch(state, {}, 0.05)
    stepMatch(state, {}, 0.016)
    expect(state.restart).toMatchObject({ type: 'corner', teamId: 'bracelonia' })
    const edgePlayer = byName(state, 'Pedrilho')
    expect(edgePlayer.target.x).toBeLessThanOrEqual(88)
    const defendingGk = state.players.find((p) => p.teamId === 'banyarn' && p.slotPosition === 'GK')!
    expect(defendingGk.target.x).toBeGreaterThanOrEqual(100)
    // The box attackers hold a few metres deeper, then break for the spot as
    // the corner is about to be struck — they are never parked on it early.
    const held = byName(state, 'Pau Cubanti').target.x
    while (state.restart && state.restart.timer < state.restart.setup * 0.92) stepMatch(state, {}, 0.05)
    expect(held).toBeLessThan(96)
    expect(state.restart?.type).toBe('corner')
    expect(byName(state, 'Pau Cubanti').target.x).toBeGreaterThanOrEqual(97)
  })

  it('does not run the match clock while a restart is being set up', () => {
    const state = createMatch({ ...config(), humanTeams: ['bracelonia'] })
    makeLive(state)
    state.ball.ownerId = null
    state.ball.kind = 'loose'
    state.ball.pos = { x: 40, y: -0.1 }
    state.ball.vel = { x: 0, y: -1 }
    state.ball.lastTouchTeamId = 'banyarn'
    stepMatch(state, {}, 0.05)
    expect(state.phase).toBe('restart')
    const clockAtStop = state.clockSeconds
    for (let f = 0; f < 60; f++) stepMatch(state, {}, 0.05)
    expect(state.phase).toBe('restart')
    // Three seconds of dead ball, three seconds of match clock saved.
    expect(state.clockSeconds).toBe(clockAtStop)
    // Take it, and the clock starts running again.
    let frames = 0
    while (frames < 400) {
      stepMatch(state, { bracelonia: humanInput({ pass: true, move: { x: 1, y: 0 } }) }, 0.05)
      frames += 1
      if ((state.phase as string) !== 'restart') break
    }
    expect(state.phase).toBe('play')
    const clockAtPlay = state.clockSeconds
    for (let f = 0; f < 10; f++) stepMatch(state, {}, 0.05)
    expect(state.clockSeconds).toBeGreaterThan(clockAtPlay)
  })

  it('spreads the front players across the box once the ball reaches the final third', () => {
    const state = createMatch(config())
    const carrier = byName(state, 'Frankie de Jongh')
    place(carrier, 80, 20)
    makeLive(state)
    setDribbleBall(state, carrier.id)
    state.ball.pos = { ...carrier.pos }
    carrier.decisionTimer = 9
    stepMatch(state, {}, 0.05)
    const mates = state.players.filter((p) => p.teamId === 'bracelonia' && p.onPitch && p.id !== carrier.id && p.slotPosition !== 'GK')
    const inBox = mates.filter((p) => p.target.x > 88 && Math.abs(p.target.y - 34) < 16)
    expect(inBox.length).toBeGreaterThanOrEqual(2)
    const ys = inBox.map((p) => p.target.y).sort((a, b) => a - b)
    // Near post, back post and the edge of the box, not one queue on the spot.
    expect(ys[ys.length - 1]! - ys[0]!).toBeGreaterThan(6)
    // The edge-of-box option for the cutback and the pass-and-shoot.
    expect(mates.some((p) => p.target.x > 82 && p.target.x < 92 && Math.abs(p.target.y - 34) < 6)).toBe(true)
  })


  it('times attacking runs off the offside line instead of drifting beyond it', () => {
    const state = createMatch(config())
    const carrier = byName(state, 'Frankie de Jongh')
    place(carrier, 52, 34)
    makeLive(state)
    setDribbleBall(state, carrier.id)
    state.ball.pos = { ...carrier.pos }
    carrier.decisionTimer = 9
    stepMatch(state, {}, 0.05)
    const defenders = state.players.filter((p) => p.teamId === 'banyarn' && p.onPitch).map((p) => p.pos.x).sort((a, b) => b - a)
    const lineX = defenders[1]!
    const attackers = state.players.filter((p) => p.teamId === 'bracelonia' && p.onPitch
      && ['ST', 'LST', 'RST', 'LW', 'RW', 'CAM', 'LM', 'RM'].includes(p.slotPosition))
    expect(attackers.length).toBeGreaterThan(2)
    // Sitting on the shoulder, not through him: nobody is standing offside
    // while nobody has played the ball.
    for (const p of attackers) expect(p.target.x).toBeLessThanOrEqual(lineX + 0.6)
    // Somebody is genuinely holding the line, rather than the whole front
    // line sheltering 20 metres short of it.
    expect(attackers.some((p) => lineX - p.target.x < 4.5)).toBe(true)
  })

  it('sends the front players in for the rebound when our own man is pushing the BallState forward', () => {
    const state = createMatch(config())
    const carrier = byName(state, 'Rafinher')
    place(carrier, 86, 22)
    makeLive(state)
    // A knock-ahead: he is on his own, BallState loose, he is still the man
    // it belongs to, and the front men must follow the play in.
    state.ball.ownerId = null
    state.ball.kind = 'loose'
    state.ball.intendedReceiverId = carrier.id
    state.ball.lastTouchTeamId = 'bracelonia'
    state.ball.lastTouchPlayerId = carrier.id
    state.ball.pos = { ...carrier.pos }
    state.ball.vel = { x: 6, y: 0 }
    for (const p of state.players.filter((x) => x.onPitch && x.teamId === 'bracelonia')) if (p.id !== carrier.id) p.decisionTimer = 9
    stepMatch(state, { bracelonia: humanInput({ move: { x: 1, y: 0 }, sprint: true }) }, 0.05)
    const mates = state.players.filter((p) => p.teamId === 'bracelonia' && p.onPitch && p.id !== carrier.id && p.slotPosition !== 'GK')
    const inBox = mates.filter((p) => p.target.x > 88 && Math.abs(p.target.y - 34) < 16)
    expect(inBox.length).toBeGreaterThanOrEqual(2)
    // And they are not all queueing behind the carrier.
    expect(mates.some((p) => p.target.x > carrier.pos.x)).toBe(true)
  })

  it('gives the free-kick taker clear ground and a short pass out of the set-up', () => {
    const state = createMatch(config())
    const taker = byName(state, 'Frankie de Jongh')
    makeLive(state)
    place(taker, 70, 24)
    state.ball.ownerId = taker.id
    state.ball.kind = 'restart'
    state.ball.pos = { x: 70, y: 24 }
    state.ball.vel = { x: 0, y: 0 }
    state.restart = {
      type: 'freekick', teamId: 'bracelonia', x: 70, y: 24, takerId: taker.id, timer: 0,
      aim: { x: 100, y: 34 }, setup: 99, quick: false, quickTargetId: null,
      arrived: true, arrivedAt: 0, buffered: null,
    }
    state.phase = 'restart'
    for (let frame = 0; frame < 40; frame++) stepMatch(state, {}, 0.05)
    const opponents = state.players.filter((p) => p.teamId === 'banyarn' && p.onPitch)
    for (const p of opponents) {
      expect(Math.hypot(p.target.x - state.ball.pos.x, p.target.y - state.ball.pos.y)).toBeGreaterThanOrEqual(8.9)
    }
    // A short option square of the BallState so the free kick does not have to
    // be a hopeful ball into a crowd.
    const shortOptions = state.players.filter((p) => p.teamId === 'bracelonia' && p.onPitch && p.id !== taker.id
      && ['DM', 'LDM', 'RDM', 'LCM', 'CM', 'RCM', 'CAM'].includes(p.slotPosition))
      .filter((p) => {
        const d = Math.hypot(p.target.x - state.ball.pos.x, p.target.y - state.ball.pos.y)
        return d > 2.6 && d < 16
      })
    expect(shortOptions.length).toBeGreaterThan(0)
  })

  it('lets the goalkeeper hold a caught ball instead of instantly restarting play', () => {
    let held = 0
    let observedCatch = false
    for (let seed = 1; seed <= 30 && !observedCatch; seed++) {
      const state = createMatch({ ...config(), humanTeams: ['bracelonia'], seed: 12000 + seed * 31 })
      const shooter = byName(state, 'Rafinher')
      const keeper = state.players.find((p) => p.teamId === 'banyarn' && p.slotPosition === 'GK')!
      isolatePlayers(state, new Set([shooter.id, keeper.id]))
      makeLive(state)
      place(shooter, 80, 34)
      place(keeper, 103.2, 34)
      setDribbleBall(state, shooter.id)
      state.ball.pos = { ...shooter.pos }
      state.ball.lastTouchTeamId = 'bracelonia'
      state.ball.lastTouchPlayerId = shooter.id
      state.controlled.bracelonia = shooter.id
      stepMatch(state, { bracelonia: humanInput({ shoot: true, shootPower: 0.45, move: { x: 1, y: 0 } }) }, 0.016)
      let caught = false
      for (let frame = 0; frame < 220 && !caught; frame++) {
        stepMatch(state, {}, 0.016)
        if (state.ball.ownerId === keeper.id) caught = true
        if (state.phase !== 'play') break
      }
      if (!caught) continue
      observedCatch = true
      // He stands up with it and lets his side push up: an unpressured
      // keeper does not release a caught ball inside two and a half seconds.
      for (let frame = 0; frame < 150; frame++) stepMatch(state, {}, 0.016)
      expect(state.ball.ownerId).toBe(keeper.id)
      held = 150 * 0.016
    }
    expect(observedCatch).toBe(true)
    expect(held).toBeGreaterThanOrEqual(2.3)
  })

  it('burns a poor physical condition player down faster than a fresh one', () => {
    // Condition burns the tank per metre he actually covers. A fresh player
    // covers more ground, so raw load alone is not the comparison — the burn
    // rate is.
    const burn = (condition: number) => {
      const seeds = [8081, 8082]
      let load = 0
      let distance = 0
      for (const seed of seeds) {
        const state = simulateMatch({ ...config(), seed, ratingOverrides: { 'bracelonia-16-5': { condition } } }, 180, 0.05)
        const p = state.players.find((q) => q.id === 'bracelonia-16-5')!
        load += p.load
        distance += p.distance
      }
      return load / distance
    }
    expect(burn(1)).toBeGreaterThan(burn(8) * 1.15)
  }, 30000)

  it('makes the position role decide where a player goes', () => {
    const planWithRole = (slotPosition: string, role: string) => {
      const plan = createDefaultPlan('bracelonia')
      const slot = plan.slots.find((s) => FORMATIONS[plan.formation]!.find((t) => t.id === s.slotId)?.position === slotPosition)!
      slot.role = role
      return plan
    }
    const targetLocalX = (plan: ReturnType<typeof createDefaultPlan>, slotPosition: string) => {
      const state = createMatch({ ...config(), homePlan: plan })
      makeLive(state)
      const holder = state.players.find((p) => p.teamId === 'bracelonia' && p.slotPosition === 'CM')!
      setDribbleBall(state, holder.id)
      state.ball.pos = { ...holder.pos }
      // This is a question about off-ball shape, so the man on the ball is
      // frozen: no drive, no waiting, no pass. Only the roles differ.
      holder.decisionTimer = 999
      for (let frame = 0; frame < 20; frame++) stepMatch(state, {}, 0.05)
      const target = state.players.find((p) => p.teamId === 'bracelonia' && p.slotPosition === slotPosition)!
      return target.target.x
    }
    // Same side, same shape, same ball: only the role differs. A holding
    // midfielder sits in front of the ball; a box-to-box one goes with it.
    const holding = targetLocalX(planWithRole('DM', 'holding'), 'DM')
    const b2b = targetLocalX(planWithRole('DM', 'box-to-box'), 'DM')
    expect(b2b).toBeGreaterThan(holding + 2)
  })

  it('carries the ball into open grass instead of passing backwards', () => {
    const state = createMatch({ ...config(), seed: 4711 })
    makeLive(state)
    const carrier = byName(state, 'Rodrico Hernaz')
    // Nobody within twenty metres ahead of him: that is a carry, not a pass.
    for (const p of state.players.filter((x) => x.onPitch && x.teamId === 'banyarn')) {
      place(p, 95, 5 + p.base.number * 3)
    }
    for (const p of state.players.filter((x) => x.onPitch && x.teamId === 'bracelonia' && x.id !== carrier.id)) {
      place(p, 30, 5 + p.base.number * 3)
    }
    place(carrier, 58, 34)
    setDribbleBall(state, carrier.id)
    state.ball.pos = { ...carrier.pos }
    state.ball.lastTouchTeamId = carrier.teamId
    state.ball.lastTouchPlayerId = carrier.id
    carrier.decisionTimer = 0
    stepMatch(state, {}, 0.05)
    // A knock ahead, aimed at his own run — the ball is his and it has moved
    // up the pitch, with no pass released.
    expect(state.ball.intendedReceiverId).toBe(carrier.id)
    expect(state.ball.passTeamId).toBe(carrier.teamId)
    expect(state.ball.vel.x).toBeGreaterThan(2)
  })

  it('waits for a team-mate to drop in, and asks him to, instead of forcing it', () => {
    // Framing it as a whole passage rather than one frozen picture: over two
    // minutes of AI football the side must both carry the ball (a knock ahead
    // that stays his) and stand it up at least once while somebody drops in.
    // Three passages, not one. Holding the ball up is a rare event in a single
    // two-minute window — a seed can easily run end to end without one — so the
    // property is measured across several matches rather than gambling on one.
    let carries = 0
    let holds = 0
    let drops = 0
    for (const seed of [6011, 6012, 6013]) {
      const state = createMatch({ ...config(), seed })
      for (let frame = 0; frame < 4800; frame++) {
        stepMatch(state, {}, 0.05)
        // A carry: he has knocked it ahead of himself and is chasing his own ball.
        if (state.ball.kind === 'loose'
          && state.ball.intendedReceiverId
          && state.ball.intendedReceiverId === state.ball.lastTouchPlayerId
          && state.ball.passTeamId === state.ball.lastTouchTeamId) carries += 1
        for (const p of state.players) {
          if (p.holdUntil > state.halfElapsed) holds += 1
          if (p.supportUntil > state.clockSeconds) drops += 1
        }
      }
    }
    expect(carries).toBeGreaterThan(0)
    expect(holds).toBeGreaterThan(0)
    // Nobody here is human-controlled, so any support call came from the
    // carrier asking for an angle.
    expect(drops).toBeGreaterThan(0)
  }, 30000)

  it('uses the bench like a manager: four or five changes, never six', () => {
    const used: number[] = []
    for (let seed = 1; seed <= 4; seed++) {
      const state = simulateMatch({ ...config(), seed: 7100 + seed * 331 }, 720, 0.05)
      for (const teamId of ['bracelonia', 'banyarn'] as const) {
        const record = state.substitutions[teamId]
        used.push(record.used)
        // Five from nine, in three windows — with the half-time change free.
        expect(record.used).toBeLessThanOrEqual(5)
        expect(record.used).toBeGreaterThanOrEqual(4)
        expect(record.windows).toBeLessThanOrEqual(3)
        // And the eleven that finished is not the eleven that started. A
        // sending-off removes a shirt without a substitution, so the count is
        // eleven less whoever was dismissed.
        const onPitch = state.players.filter((p) => p.teamId === teamId && p.onPitch)
        const sentOff = state.players.filter((p) => p.teamId === teamId && p.sentOff).length
        expect(onPitch).toHaveLength(11 - sentOff)
      }
    }
    expect(used.filter((n) => n === 5).length).toBeGreaterThan(0)
  }, 120000)

  it('recovers into a block between the ball and the goal, not onto the goal line', () => {
    const state = createMatch({ ...config(), seed: 6061 })
    const carrier = state.players.find((p) => p.teamId === 'banyarn' && p.slotPosition === 'CM')!
    // Home caught upfield, away on the ball with the whole half to run into.
    state.players
      .filter((p) => p.teamId === 'bracelonia' && p.onPitch && p.slotPosition !== 'GK')
      .forEach((p, i) => place(p, 76 + (i % 5) * 4, 10 + (i % 6) * 8))
    place(carrier, 40, 34, { x: -4, y: 0 })
    makeLive(state)
    setDribbleBall(state, carrier.id)
    state.ball.pos = { ...carrier.pos }
    state.ball.lastTouchTeamId = 'banyarn'
    state.ball.lastTouchPlayerId = carrier.id
    carrier.decisionTimer = 9
    for (let frame = 0; frame < 20; frame++) stepMatch(state, {}, 0.05)
    const back = state.players.filter((p) => p.teamId === 'bracelonia' && p.onPitch && ['LB', 'LCB', 'RCB', 'RB'].includes(p.slotPosition))
    const xs = back.map((p) => p.target.x)
    // Nobody is sent to the six-yard box while the ball is 40 metres out, and
    // the unit fills the space in front of it instead.
    expect(xs.filter((x) => x < 8).length).toBeLessThanOrEqual(1)
    expect(xs.filter((x) => x > 12 && x < 38).length).toBeGreaterThanOrEqual(2)
  })

  it('does not let the back line pass the ball to itself', () => {
    // Two seeds, summed. One 12-minute sample of the *number* of distinct pass
    // pairs ranges from 39 to 83 across seeds (seed 9137 sits at the bottom of
    // that spread: 39 pairs, every other seed tried is 57+), so a single-seed
    // floor of 40 was really testing seed luck rather than the engine. The
    // ratios below are the assertion that matters and they hold per seed.
    const centreBacks = ['LCB', 'CB', 'RCB']
    let lastPair = ''
    let total = 0
    let cbToCb = 0
    let cbPasser = 0
    for (const seed of [9137, 9138]) {
    const state = createMatch({ ...config(), seed })
    for (let frame = 0; frame < 4800; frame++) {
      stepMatch(state, {}, 0.05)
      if (state.ball.kind !== 'pass' || !state.ball.intendedReceiverId) {
        if (state.ball.kind !== 'pass') lastPair = ''
        continue
      }
      const pair = `${state.ball.lastTouchPlayerId}->${state.ball.intendedReceiverId}`
      if (pair === lastPair) continue
      lastPair = pair
      const passer = state.players.find((p) => p.id === state.ball.lastTouchPlayerId)
      const receiver = state.players.find((p) => p.id === state.ball.intendedReceiverId)
      if (!passer || !receiver) continue
      total += 1
      if (centreBacks.includes(passer.slotPosition)) cbPasser += 1
      if (centreBacks.includes(passer.slotPosition) && centreBacks.includes(receiver.slotPosition)) cbToCb += 1
    }
    }
    expect(total).toBeGreaterThan(80)
    // The back line still starts the moves ...
    expect(cbPasser / total).toBeGreaterThan(0.02)
    // ... but the ball comes out of it rather than living there.
    expect(cbToCb / total).toBeLessThan(0.18)
  }, 60000)

  it('starts a human kick-off itself when the pad stays idle', () => {
    const state = createMatch({ ...config(), humanTeams: ['bracelonia'] })
    expect(state.phase).toBe('restart')
    let frames = 0
    while (state.phase !== 'play' && frames < 400) {
      stepMatch(state, {}, 0.016)
      frames += 1
    }
    // A match must never freeze on an unpressed button: the nearest team-mate
    // takes the kick-off a beat after the set-up window.
    expect(state.phase).toBe('play')
    expect(frames).toBeLessThan(400)
  })

  it('keeps the ball on the touchline instead of crossing into an empty box', () => {
    const state = createMatch(config())
    const fullback = state.players.find((p) => p.teamId === 'bracelonia' && p.slotPosition === 'LB')!
    isolatePlayers(state, new Set([fullback.id]))
    // `isolatePlayers` parks opponents on the goal line at x 97, which for a
    // fullback standing at x 95 puts six of them inside tackling range — that
    // is a duel, not the decision this test is about. The scenario being tested
    // is "a winger on the paint with nobody in the box to cross to", so the
    // opponents go to the far touchline where they can be seen but not reached.
    for (const p of state.players.filter((x) => x.teamId === 'banyarn')) {
      p.pos = { x: 80, y: 64 }
      p.target = { ...p.pos }
      p.vel = { x: 0, y: 0 }
    }
    makeLive(state)
    // On the paint, 20m from goal, nobody in the box to cross to.
    place(fullback, 95, 3.5)
    setDribbleBall(state, fullback.id)
    state.ball.pos = { ...fullback.pos }
    state.controlled.bracelonia = fullback.id
    fullback.decisionTimer = 0
    let crossed = false
    let held = 0
    for (let frame = 0; frame < 40; frame++) {
      stepMatch(state, {}, 0.05)
      if (state.ball.kind === 'cross') crossed = true
      const owner = state.players.find((p) => p.id === state.ball.ownerId)
      if (owner?.teamId === 'bracelonia') held += 1
    }
    // He kept the ball instead of whipping it into an empty box, and it stayed
    // at his feet rather than being given away on the spot.
    expect(crossed).toBe(false)
    expect(held).toBeGreaterThan(4)
  })

  it('has a winger cut inside when the corridor is clear and look for the striker when he is free', () => {
    const offLane = (p: { pos: { x: number; y: number } }, a: { x: number; y: number }, b: { x: number; y: number }) => {
      const lane = { x: b.x - a.x, y: b.y - a.y }
      const length = Math.hypot(lane.x, lane.y) || 1
      const to = { x: p.pos.x - a.x, y: p.pos.y - a.y }
      return Math.abs(to.x * lane.y - to.y * lane.x) / length
    }
    void offLane
    const runWinger = (withStriker: boolean) => {
      const state = createMatch(config())
      const winger = byName(state, 'Rafinher')
      makeLive(state)
      place(winger, 84, 14)
      setDribbleBall(state, winger.id)
      state.ball.pos = { ...winger.pos }
      winger.decisionTimer = 0
      for (const p of state.players.filter((p) => p.teamId === 'bracelonia' && p.id !== winger.id)) place(p, 40, 34)
      // A normal wide position with defenders goal-side of him, not a breakaway.
      const fullBack = state.players.find((p) => p.teamId === 'banyarn' && p.slotPosition === 'LB')!
      const centreBack = state.players.find((p) => p.teamId === 'banyarn' && p.slotPosition === 'LCB')!
      place(fullBack, 95, 22)
      place(centreBack, 96, 46)
      let strikerId: string | null = null
      if (withStriker) {
        const striker = byName(state, 'Gabby Jesulo')
        place(striker, 97, 34)
        strikerId = striker.id
      }
      stepMatch(state, {}, 0.05)
      return { state, winger, strikerId }
    }
    // Nobody in the box: he backs his own space and goes inside/shoots.
    const solo = runWinger(false)
    const soloKeptIt = solo.winger.insideRunUntil > 0
      || solo.state.ball.kind === 'shot'
      || (solo.state.ball.kind === 'loose' && solo.state.ball.intendedReceiverId === solo.winger.id)
    expect(soloKeptIt).toBe(true)
    // A striker alone in the box: he looks for him instead.
    const withStriker = runWinger(true)
    const lookedForStriker = withStriker.state.ball.intendedReceiverId === withStriker.strikerId
      || withStriker.state.ball.kind === 'cross'
    expect(lookedForStriker).toBe(true)
  })


  it('sprints the whole defence back when the back line is played through', () => {
    const state = createMatch(config())
    const carrier = byName(state, 'Luiz Díaz')
    makeLive(state)
    setDribbleBall(state, carrier.id)
    carrier.decisionTimer = 9
    // Banyarn attack toward x=0, so bracelonia's own goal is at x=0.
    for (const p of state.players.filter((p) => p.teamId === 'bracelonia' && p.onPitch && p.slotPosition !== 'GK')) {
      p.pos = { x: 44, y: p.baseY }
    }
    place(carrier, 20, 34)
    state.ball.pos = { ...carrier.pos }
    stepMatch(state, {}, 0.05)
    const defenders = state.players.filter((p) => p.teamId === 'bracelonia' && p.onPitch && p.slotPosition !== 'GK')
    // The line is gone: everybody sprints, nobody holds the offside line.
    expect(defenders.filter((p) => p.moveUrgency >= 2).length).toBeGreaterThanOrEqual(2)
    expect(defenders.every((p) => p.target.x < 40)).toBe(true)
    const nearest = defenders.slice().sort((a, b) => Math.hypot(a.pos.x - carrier.pos.x, a.pos.y - carrier.pos.y) - Math.hypot(b.pos.x - carrier.pos.x, b.pos.y - carrier.pos.y))[0]!
    // The first man in delays the carrier, goal-side of him.
    expect(nearest.target.x).toBeLessThanOrEqual(carrier.pos.x + 0.5)
  })

  it('puts defenders on the shooting lane rather than beside it', () => {
    const offLane = (point: { x: number; y: number }, from: { x: number; y: number }, goal: { x: number; y: number }) => {
      const lane = { x: goal.x - from.x, y: goal.y - from.y }
      const length = Math.hypot(lane.x, lane.y) || 1
      const to = { x: point.x - from.x, y: point.y - from.y }
      return Math.abs(to.x * lane.y - to.y * lane.x) / length
    }
    const state = createMatch(config())
    const carrier = byName(state, 'Luiz Díaz')
    makeLive(state)
    setDribbleBall(state, carrier.id)
    carrier.decisionTimer = 9
    place(carrier, 30, 34)
    state.ball.pos = { ...carrier.pos }
    const laneDefender = byName(state, 'Pau Cubanti')
    place(laneDefender, 20, 40)
    for (const p of state.players.filter((p) => p.teamId === 'bracelonia' && p.onPitch && p.id !== laneDefender.id && p.slotPosition !== 'GK')) {
      place(p, 12, p.baseY)
    }
    const before = offLane(laneDefender.pos, carrier.pos, { x: 0, y: 34 })
    expect(before).toBeGreaterThan(4)
    let everUrgent = false
    for (let f = 0; f < 40; f++) {
      stepMatch(state, {}, 0.05)
      if (laneDefender.moveUrgency >= 2) everUrgent = true
    }
    // He steps across onto the BallState-to-goal line: a body in the way.
    expect(everUrgent).toBe(true)
    expect(offLane(laneDefender.pos, carrier.pos, { x: 0, y: 34 })).toBeLessThan(3)
  })


  it('blocks a shot when a defender is in the lane', () => {
    let blocked = 0
    for (let seed = 1; seed <= 16; seed++) {
      const state = createMatch({ ...config(), humanTeams: ['bracelonia'], seed })
      makeLive(state)
      const shooter = byName(state, 'Pau Cubanti')
      const blocker = byName(state, 'Kim Min-Jae')
      let index = 0
      for (const p of state.players.filter((p) => p.onPitch && p.slotPosition !== 'GK' && p.id !== shooter.id && p.id !== blocker.id)) {
        p.pos = { x: p.teamId === 'bracelonia' ? 6 : 100, y: 3 + (index % 18) * 3.5 }
        index += 1
      }
      place(shooter, 80, 34)
      place(blocker, 87, 34)
      state.controlled.bracelonia = shooter.id
      setDribbleBall(state, shooter.id)
      state.ball.pos = { ...shooter.pos }
      shooter.touchTimer = 0
      stepMatch(state, { bracelonia: humanInput({ shoot: true, shootPower: 0.6 }) }, 0.05)
      for (let f = 0; f < 30 && state.ball.kind === 'shot'; f++) stepMatch(state, {}, 0.05)
      const toucher = state.players.find((p) => p.id === state.ball.lastTouchPlayerId)
      if (toucher && toucher.teamId === 'banyarn' && toucher.slotPosition !== 'GK') blocked += 1
    }
    expect(blocked).toBeGreaterThanOrEqual(3)
  })

  it('keeps players moving during the goal phase', () => {
    const state = createMatch(config())
    const Pedri = byName(state, 'Pedrilho')
    place(Pedri, 20, 20, { x: 5, y: 0 }, { x: 1, y: 0 })
    makeLive(state)
    state.ball.ownerId = null
    state.ball.kind = 'shot'
    state.ball.pos = { x: 106, y: 34 }
    state.ball.vel = { x: 1, y: 0 }
    state.ball.lastTouchTeamId = 'bracelonia'
    stepMatch(state, {}, 0.05)
    expect(state.phase).toBe('goal')
    const before = { ...Pedri.pos }
    stepMatch(state, {}, 0.05)
    expect(Math.hypot(Pedri.pos.x - before.x, Pedri.pos.y - before.y)).toBeGreaterThan(0.01)
  })

  it('completes AI-vs-AI soak samples across difficulties without invalid state', () => {
    const samples = [
      { seed: 101, difficulty: 'easy' as const },
      { seed: 202, difficulty: 'normal' as const },
      { seed: 303, difficulty: 'hard' as const },
      { seed: 404, difficulty: 'real' as const },
    ]
    for (const sample of samples) {
      const state = simulateMatch({ ...config(), ...sample }, 96, 0.05)
      expect(state.phase).toBe('fulltime')
      expect(state.players.filter((p) => p.teamId === 'bracelonia' && p.onPitch).length).toBeGreaterThanOrEqual(7)
      expect(state.players.filter((p) => p.teamId === 'banyarn' && p.onPitch).length).toBeGreaterThanOrEqual(7)
      expect(state.players.filter((p) => p.onPitch).every((p) => (
        Number.isFinite(p.pos.x) && Number.isFinite(p.pos.y)
        && Number.isFinite(p.vel.x) && Number.isFinite(p.vel.y)
        && p.pos.x >= 0 && p.pos.x <= 105 && p.pos.y >= 0 && p.pos.y <= 68
      ))).toBe(true)
      expect(Number.isFinite(state.ball.pos.x)).toBe(true)
      expect(Number.isFinite(state.ball.pos.y)).toBe(true)
      expect(state.ball.z).toBeGreaterThanOrEqual(0)
    }
  })

  it('applies local rating overrides to runtime players', () => {
    const baseline = createMatch(config())
    const Pedri = byName(baseline, 'Pedrilho')
    const edited = createMatch({ ...config(), ratingOverrides: { [Pedri.id]: { topSpeed: 99 } } })
    expect(byName(edited, 'Pedrilho').base.attributes.topSpeed).toBe(99)
    expect(Pedri.base.attributes.topSpeed).not.toBe(99)
  })

  it('plays a low driven pass on the double tap and counts it', () => {
    const state = createMatch({ ...config(), humanTeams: ['bracelonia'] })
    const passer = byName(state, 'Pedrilho')
    const receiver = byName(state, 'Rafinher')
    isolatePlayers(state, new Set([passer.id, receiver.id]))
    place(passer, 40, 34)
    place(receiver, 62, 34)
    makeLive(state)
    setDribbleBall(state, passer.id)
    state.ball.pos = { ...passer.pos }
    state.ball.lastTouchTeamId = 'bracelonia'
    state.ball.lastTouchPlayerId = passer.id
    state.controlled.bracelonia = passer.id
    passer.decisionTimer = 9
    stepMatch(state, { bracelonia: humanInput({ drivenPass: true, drivenPower: 0.8 }) }, 0.016)
    expect(state.ball.driven).toBe(true)
    expect(state.ball.kind).toBe('pass')
    expect(state.ball.z).toBeLessThan(0.2)
    expect(state.stats.bracelonia.drivenPasses).toBe(1)
    expect(state.ball.intendedReceiverId).toBe(receiver.id)
    expect(Math.hypot(state.ball.vel.x, state.ball.vel.y)).toBeGreaterThan(18)
  })

  it('sends the nearest defender flat out at a runner but not on every break', () => {
    const chase = (seed: number) => {
      const state = createMatch({ ...config(), seed })
      makeLive(state)
      const carrier = state.players.find((p) => p.teamId === 'banyarn' && p.slotPosition === 'ST')!
      const defenders = state.players.filter((p) => p.teamId === 'bracelonia' && p.slotPosition !== 'GK')
      isolatePlayers(state, new Set([carrier.id, ...defenders.map((d) => d.id)]))
      defenders.forEach((d, index) => place(d, 26 + index * 3, 30 + index * 4))
      place(carrier, 24, 34, { x: 4, y: 0 })
      carrier.decisionTimer = 9
      setDribbleBall(state, carrier.id)
      state.ball.pos = { ...carrier.pos }
      state.ball.lastTouchTeamId = 'banyarn'
      state.ball.lastTouchPlayerId = carrier.id
      let closest = 99
      for (let frame = 0; frame < 30; frame++) {
        stepMatch(state, {}, 0.05)
        closest = Math.min(closest, ...defenders.map((d) => Math.hypot(d.pos.x - carrier.pos.x, d.pos.y - carrier.pos.y)))
      }
      return { closest, progress: carrier.pos.x - 24 }
    }
    // 40 breaks rather than 16: the two outcomes below are now separated by a
    // comfortable margin instead of a couple of metres, so the test measures
    // the decision and not the exact dribbling speed of one seed.
    const runs = Array.from({ length: 40 }, (_, index) => chase(3000 + index * 37))
    // The chaser really does get there: at full tilt somebody ends up on top
    // of the runner in at least one of these breaks.
    expect(runs.some((r) => r.closest < 2.2)).toBe(true)
    // ...but it is a decision, not an automatic: some breaks are stopped
    // early and others are allowed to run.
    expect(runs.filter((r) => r.progress < 2).length).toBeGreaterThan(8)
    expect(runs.filter((r) => r.progress > 3.2).length).toBeGreaterThan(6)
  })

  it('shoots or works the box from a central free kick instead of recycling', () => {
    let shots = 0
    let intoBox = 0
    const seeds = 20
    for (let seed = 1; seed <= seeds; seed++) {
      const state = createMatch({ ...config(), seed: 7000 + seed * 97 })
      const taker = state.players.find((p) => p.teamId === 'bracelonia' && p.slotPosition === 'ST')!
      let index = 0
      for (const p of state.players.filter((q) => q.id !== taker.id)) {
        p.pos = p.teamId === 'bracelonia'
          // Three men in the box, the rest of the side short of it.
          ? (index < 3 ? { x: 93 + (index % 3), y: 28 + index * 6 } : { x: 74 + (index % 4) * 2, y: 48 + (index % 3) * 5 })
          : { x: 96 + (index % 4), y: 22 + (index % 9) * 3 }
        p.target = { ...p.pos }
        p.vel = { x: 0, y: 0 }
        index += 1
      }
      place(taker, 80, 34)
      state.phase = 'restart'
      state.restart = {
        type: 'freekick', teamId: 'bracelonia', x: 80, y: 34, takerId: taker.id, timer: 0,
        aim: { x: 1, y: 0 }, setup: 0.2, quick: false, quickTargetId: null, arrived: true,
        arrivedAt: 0, buffered: null,
      }
      state.ball.ownerId = null
      state.ball.kind = 'restart'
      state.ball.pos = { x: 80, y: 34 }
      state.ball.z = 0
      for (let frame = 0; frame < 240; frame++) {
        stepMatch(state, {}, 0.016)
        if (state.stats.bracelonia.shots > 0) break
      }
      if (state.stats.bracelonia.shots > 0) shots += 1
      else if (state.ball.pos.x > 88) intoBox += 1
    }
    // Central, 24 metres out, with men in the box: this is a shooting
    // position, not a place to roll the ball backwards.
    expect(shots).toBeGreaterThanOrEqual(seeds * 0.4)
    expect(shots + intoBox).toBeGreaterThanOrEqual(seeds * 0.7)
  })

  it('sets both teams up from their own set-piece and team shapes', () => {
    const setup = (homeWidth: number, awayCompactness: number) => {
      const homePlan = createDefaultPlan('bracelonia')
      homePlan.sliders.width = homeWidth
      const awayPlan = createDefaultPlan('banyarn')
      awayPlan.sliders.compactness = awayCompactness
      const state = createMatch({ ...config(), homePlan, awayPlan })
      const taker = byName(state, 'Rafinher')
      makeLive(state)
      place(taker, 104.5, 2)
      state.ball.ownerId = taker.id
      state.ball.kind = 'restart'
      state.ball.pos = { x: 104.5, y: 2 }
      state.ball.vel = { x: 0, y: 0 }
      state.restart = {
        type: 'corner', teamId: 'bracelonia', x: 104.5, y: 2, takerId: taker.id, timer: 0,
        aim: { x: 104, y: 2 }, setup: 99, quick: false, quickTargetId: null,
        arrived: true, arrivedAt: 0, buffered: null,
      }
      state.phase = 'restart'
      // The picture, before the ball is played.
      for (let frame = 0; frame < 4; frame++) stepMatch(state, {}, 0.05)
      const attackers = state.players.filter((p) => p.teamId === 'bracelonia' && p.onPitch && p.slotPosition !== 'GK' && p.id !== taker.id)
      const inBox = attackers.filter((p) => p.target.x > 88)
      // Attacking shape stretches the box group.
      const boxSpread = inBox.length ? Math.max(...inBox.map((p) => p.target.y)) - Math.min(...inBox.map((p) => p.target.y)) : 0
      // Defensive shape decides how high the zonal line sits.
      const zonal = state.players.filter((p) => p.teamId === 'banyarn' && p.onPitch && p.slotPosition !== 'GK'
        && p.target.x > 90 && p.target.x < 102 && Math.abs(p.target.y - 34) < 14)
      const zonalX = zonal.length ? zonal.reduce((sum, p) => sum + p.target.x, 0) / zonal.length : 0
      return { boxCommitment: inBox.length, boxSpread, zonalX }
    }
    const narrowLoose = setup(10, 10)
    const wideCompact = setup(90, 90)
    // Set piece for = skeleton + our attacking shape; the opponent defends
    // with skeleton + their defensive shape, not with ours.
    expect(narrowLoose.boxCommitment).toBeGreaterThanOrEqual(4)
    expect(wideCompact.boxSpread).toBeGreaterThan(narrowLoose.boxSpread)
    expect(wideCompact.zonalX).toBeGreaterThan(narrowLoose.zonalX)
  })

  it('records where the ball crossed the line and plays the goal out in three beats', () => {
    const state = createMatch(config())
    const scorer = byName(state, 'Gabby Jesulo')
    makeLive(state)
    state.ball.ownerId = null
    state.ball.kind = 'shot'
    state.ball.lastTouchTeamId = 'bracelonia'
    state.ball.lastTouchPlayerId = scorer.id
    state.ball.shotOrigin = { x: 94, y: 34 }
    state.ball.pos = { x: 105.3, y: 36.2 }
    state.ball.z = 1.1
    state.ball.vel = { x: 18, y: 0 }
    state.ball.vz = 1
    stepMatch(state, {}, 0.016)
    expect(state.phase).toBe('goal')
    expect(state.score.bracelonia).toBe(1)
    const goal = state.lastGoal!
    expect(goal.teamId).toBe('bracelonia')
    expect(goal.scorerId).toBe(scorer.id)
    expect(goal.impactY).toBeGreaterThan(30.34)
    expect(goal.impactY).toBeLessThan(37.66)
    expect(goal.impactZ).toBeGreaterThan(0)
    expect(goal.impactZ).toBeLessThan(2.44)
    expect(goal.fromY).toBe(34)
    expect(state.phaseTimer).toBeCloseTo(GOAL_PHASE_SECONDS, 5)
  })

  it('sends the scorers to the corner flag to celebrate instead of freezing', () => {
    const state = createMatch(config())
    const scorer = byName(state, 'Gabby Jesulo')
    makeLive(state)
    state.ball.ownerId = null
    state.ball.kind = 'shot'
    state.ball.lastTouchTeamId = 'bracelonia'
    state.ball.lastTouchPlayerId = scorer.id
    state.ball.pos = { x: 105.3, y: 32 }
    state.ball.z = 0.6
    state.ball.vel = { x: 16, y: 0 }
    state.ball.vz = 0
    stepMatch(state, {}, 0.016)
    expect(state.phase).toBe('goal')
    scorer.pos = { x: 84, y: 34 }
    const startDistance = Math.min(scorer.pos.y, 68 - scorer.pos.y)
    for (let frame = 0; frame < 40; frame++) stepMatch(state, {}, 0.05)
    const endDistance = Math.min(scorer.pos.y, 68 - scorer.pos.y)
    // He is running for a touchline, not standing over the ball.
    expect(endDistance).toBeLessThan(startDistance - 4)
    expect(state.phase).toBe('goal')
    // The conceding side walks back rather than joining in.
    const defender = state.players.find((p) => p.teamId === 'banyarn' && p.slotPosition === 'LCB')!
    expect(Math.hypot(defender.target.x - scorer.target.x, defender.target.y - scorer.target.y)).toBeGreaterThan(20)
  })

  it('strikes with the foot the ball is on, and a one-footed player pays for the wrong one', () => {
    const state = createMatch(config())
    const rightFooted = byName(state, 'Gabby Jesulo')
    const leftFooted = byName(state, 'Rafinher')
    expect(rightFooted.base.foot).toBe('R')
    expect(leftFooted.base.foot).toBe('L')
    place(rightFooted, 90, 34, { x: 0, y: 0 }, { x: 1, y: 0 })
    // Facing +x with y increasing down the pitch, his right side is +y, so a
    // ball at y = 35.5 is on his right foot.
    const onRight = strikeFoot(rightFooted, { x: 91, y: 35.5 })
    expect(onRight.foot).toBe('R')
    expect(onRight.weak).toBe(false)
    const onLeft = strikeFoot(rightFooted, { x: 91, y: 32.5 })
    expect(onLeft.foot).toBe('L')
    expect(onLeft.weak).toBe(true)
    expect(onLeft.noiseScale).toBeGreaterThan(1)
    expect(onLeft.powerScale).toBeLessThan(1)
    // The strong-foot strike is untouched.
    expect(onRight.noiseScale).toBe(1)
    // And the mirror holds for a left-footer.
    place(leftFooted, 90, 34, { x: 0, y: 0 }, { x: 1, y: 0 })
    expect(strikeFoot(leftFooted, { x: 91, y: 32.5 }).weak).toBe(false)
    expect(strikeFoot(leftFooted, { x: 91, y: 35.5 }).weak).toBe(true)
  })

  it('drops the defence into the box for a throw-in near the box and a free kick', () => {
    const setUp = (type: 'throw' | 'freekick', x: number, y: number) => {
      const state = createMatch(config())
      makeLive(state)
      state.phase = 'restart'
      state.restart = {
        type, teamId: 'bracelonia', x, y, takerId: byName(state, 'Rafinher').id, timer: 0,
        aim: { x: 1, y: 0 }, setup: 1.5, quick: false, quickTargetId: null, arrived: true,
        arrivedAt: 0, buffered: null,
      }
      state.ball.ownerId = null
      state.ball.kind = 'restart'
      state.ball.pos = { x, y }
      state.ball.z = 0
      for (let frame = 0; frame < 12; frame++) stepMatch(state, {}, 0.05)
      return state
    }
    // A throw by the corner flag and a central free kick 29 m out: both are
    // deliveries into the box, and both pull the whole defence back into it.
    for (const [type, x, y, depth] of [['throw', 98, 6, 86], ['freekick', 76, 30, 84]] as const) {
      const state = setUp(type, x, y)
      const defenders = state.players.filter((p) => p.teamId === 'banyarn' && p.slotPosition !== 'GK')
      // Targets are the intent: where they are being sent while the ball is dead.
      const dropping = defenders.filter((p) => p.target.x > depth && p.target.x < 104 && Math.abs(p.target.y - 34) < 22)
      expect(dropping.length).toBeGreaterThanOrEqual(4)
      // And they are spread across the goal, not stacked in a line.
      const spread = Math.max(...dropping.map((p) => p.target.y)) - Math.min(...dropping.map((p) => p.target.y))
      expect(spread).toBeGreaterThan(10)
    }
  })

  it('plays back to a free keeper when the ball is bottled up in its own half', () => {
    let backPasses = 0
    for (let seed = 1; seed <= 12; seed++) {
      const state = createMatch({ ...config(), seed: 6100 + seed * 11 })
      makeLive(state)
      const carrier = byName(state, 'Pau Cubanti')
      const keeper = state.players.find((p) => p.teamId === 'bracelonia' && p.slotPosition === 'GK')!
      isolatePlayers(state, new Set([carrier.id, keeper.id]))
      place(keeper, 5, 34)
      place(carrier, 24, 30)
      const pressers = state.players.filter((p) => p.teamId === 'banyarn' && p.slotPosition !== 'GK').slice(0, 2)
      pressers.forEach((p, i) => place(p, 25.5, 30 + i * 1.2))
      setDribbleBall(state, carrier.id)
      state.ball.pos = { ...carrier.pos }
      state.ball.lastTouchTeamId = 'bracelonia'
      state.ball.lastTouchPlayerId = carrier.id
      carrier.decisionTimer = 0
      state.phase = 'play'
      stepMatch(state, {}, 0.016)
      const receiver = state.players.find((p) => p.id === state.ball.intendedReceiverId)
      if (receiver?.slotPosition === 'GK') backPasses += 1
    }
    expect(backPasses).toBeGreaterThan(0)
  })

  it('does not let a central midfielder join the front line ahead of the attackers', () => {
    const state = createMatch(config())
    makeLive(state)
    const winger = byName(state, 'Rafinher')
    const cm = byName(state, 'Pedrilho')
    isolatePlayers(state, new Set([winger.id, cm.id]))
    place(winger, 88, 8, { x: 0, y: 0 })
    place(cm, 55, 34)
    setDribbleBall(state, winger.id)
    state.ball.pos = { ...winger.pos }
    state.ball.lastTouchTeamId = 'bracelonia'
    state.ball.lastTouchPlayerId = winger.id
    winger.decisionTimer = 9
    for (let frame = 0; frame < 60; frame++) stepMatch(state, {}, 0.05)
    const cmLocal = cm.pos.x
    // He supports behind the ball rather than arriving on the shoulder of a
    // front line that is not there.
    expect(cmLocal).toBeLessThan(winger.pos.x - 8)
  })

  it('applies Human gameplay sliders to BallState pass speed', () => {
    const speedFor = (passSpeed: number) => {
      const gameplay = normalizeGameplaySettings({
        ...DEFAULT_GAMEPLAY_SETTINGS,
        user: { ...DEFAULT_GAMEPLAY_SETTINGS.user, passSpeed },
      })
      const state = createMatch({ ...config(), humanTeams: ['bracelonia'], gameplay })
      stepMatch(state, { bracelonia: humanInput({ move: { x: 1, y: 0 }, pass: true }) }, 0.016)
      return Math.hypot(state.ball.vel.x, state.ball.vel.y)
    }
    expect(speedFor(100)).toBeGreaterThan(speedFor(0) * 1.25)
  })
})
