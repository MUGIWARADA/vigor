import { NEUTRAL_INPUT, type PlayerInput } from './engine'
import type { TeamId } from './data'

export type InputDevice = 'keyboard' | 'gamepad0' | 'gamepad1' | 'both' | 'none'

export interface InputMapping {
  home: InputDevice
  away: InputDevice
}

const pressed = new Set<string>()
const edge = new Set<string>()
const padEdge = new Map<string, boolean>()
let shootChargeStarted = 0
let crossChargeStarted = 0
let tackleChargeStarted = 0
let pendingShootPower: number | null = null
let pendingCrossPower: number | null = null
let pendingTacklePower: number | null = null
let lastKeyboardSprintTapAt = 0
let pendingKnockAhead = false
let lastPassTapAt = 0
let passTapStarted = 0
let pendingDrivenPass = false
let pendingDrivenPower = 0.6
const lastPadSprintTapAt = new Map<number, number>()
const lastPadPassTapAt = new Map<number, number>()

function keyEdge(code: string) {
  const was = edge.has(code)
  if (was) edge.delete(code)
  return was
}

function isFormTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  return Boolean(target && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable))
}

export function attachKeyboardInput(): () => void {
  const down = (event: KeyboardEvent) => {
    if (isFormTarget(event)) return
    const codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight']
    if (codes.includes(event.code)) event.preventDefault()
    const isNewPress = !pressed.has(event.code)
    if (isNewPress) edge.add(event.code)
    if (isNewPress && (event.code === 'ShiftLeft' || event.code === 'ShiftRight')) {
      const now = performance.now()
      if (now - lastKeyboardSprintTapAt <= 300) pendingKnockAhead = true
      lastKeyboardSprintTapAt = now
    }
    pressed.add(event.code)
    if (event.code === 'KeyK' && shootChargeStarted === 0) shootChargeStarted = performance.now()
    if (event.code === 'KeyL' && crossChargeStarted === 0) crossChargeStarted = performance.now()
    if (event.code === 'KeyJ' && tackleChargeStarted === 0) tackleChargeStarted = performance.now()
    if (isNewPress && event.code === 'KeyJ') {
      // Double-tap pass selects a low driven pass, PES-style.
      const now = performance.now()
      if (now - lastPassTapAt <= 300) pendingDrivenPass = true
      lastPassTapAt = now
      passTapStarted = now
    }
  }
  const up = (event: KeyboardEvent) => {
    pressed.delete(event.code)
    if (isFormTarget(event)) return
    if (event.code === 'KeyK' && shootChargeStarted) {
      pendingShootPower = Math.min(1, 0.28 + (performance.now() - shootChargeStarted) / 750)
      shootChargeStarted = 0
    }
    if (event.code === 'KeyL' && crossChargeStarted) {
      pendingCrossPower = Math.min(1, 0.3 + (performance.now() - crossChargeStarted) / 750)
      crossChargeStarted = 0
    }
    if (event.code === 'KeyJ' && pendingDrivenPass && passTapStarted) {
      pendingDrivenPower = Math.min(1, 0.5 + (performance.now() - passTapStarted) / 900)
    }
    if (event.code === 'KeyJ' && tackleChargeStarted) {
      pendingTacklePower = Math.min(1, 0.16 + (performance.now() - tackleChargeStarted) / 720)
      tackleChargeStarted = 0
    }
  }
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    pressed.clear()
    edge.clear()
    lastKeyboardSprintTapAt = 0
    pendingKnockAhead = false
  }
}

export function keyboardInput(): PlayerInput {
  const input: PlayerInput = {
    ...NEUTRAL_INPUT,
    move: {
      x: (pressed.has('KeyD') ? 1 : 0) - (pressed.has('KeyA') ? 1 : 0),
      y: (pressed.has('KeyS') ? 1 : 0) - (pressed.has('KeyW') ? 1 : 0),
    },
    sprint: pressed.has('ShiftLeft') || pressed.has('ShiftRight'),
    close: pressed.has('KeyE'),
    pass: keyEdge('KeyJ'),
    through: keyEdge('KeyI'),
    switchPlayer: keyEdge('KeyQ'),
    sendRun: keyEdge('Space'),
    callSupport: keyEdge('KeyR'),
    manual: pressed.has('KeyQ') && pressed.has('KeyJ'),
    lineStep: keyEdge('KeyC'),
    lineDrop: keyEdge('KeyZ'),
  }
  if (pendingShootPower !== null) {
    input.shoot = true
    input.shootPower = pendingShootPower
    pendingShootPower = null
  }
  input.shootHeld = pressed.has('KeyK')
  if (pendingCrossPower !== null) {
    input.cross = true
    input.crossPower = pendingCrossPower
    pendingCrossPower = null
  }
  input.tackleHeld = pressed.has('KeyJ')
  if (pendingTacklePower !== null) {
    input.tackle = true
    input.tacklePower = pendingTacklePower
    pendingTacklePower = null
  }
  if (pendingKnockAhead) {
    input.knockAhead = true
    pendingKnockAhead = false
  }
  if (pendingDrivenPass) {
    input.drivenPass = true
    input.drivenPower = pendingDrivenPower
    // The double tap is the driven ball, not two ordinary passes.
    input.pass = false
    pendingDrivenPass = false
  }
  return input
}

function button(pad: Gamepad, index: number) { return pad.buttons[index]?.pressed ?? false }
function buttonEdge(pad: Gamepad, index: number, padIndex: number) {
  const key = `${padIndex}:${index}`
  const now = button(pad, index)
  const before = padEdge.get(key) ?? false
  padEdge.set(key, now)
  return now && !before
}
const padCharge = new Map<string, number>()
const padPending = new Map<string, number>()
function charged(pad: Gamepad, index: number, padIndex: number, fallback: number, minimum = 0.28): { fired: boolean; power: number } {
  const key = `${padIndex}:${index}`
  const down = button(pad, index)
  if (down && !padCharge.has(key)) padCharge.set(key, performance.now())
  if (!down && padCharge.has(key)) {
    const power = Math.min(1, minimum + (performance.now() - padCharge.get(key)!) / 750)
    padCharge.delete(key)
    return { fired: true, power }
  }
  return { fired: false, power: fallback }
}

export function gamepadInput(padIndex: number): PlayerInput {
  const pad = navigator.getGamepads?.()[padIndex]
  if (!pad) return { ...NEUTRAL_INPUT }
  const dead = (v: number) => Math.abs(v) < 0.16 ? 0 : v
  const shoot = charged(pad, 2, padIndex, 0.62)
  const cross = charged(pad, 1, padIndex, 0.62)
  const tackle = charged(pad, 0, padIndex, 0.25, 0.16)
  const passEdge = buttonEdge(pad, 0, padIndex)
  let drivenPass = false
  if (passEdge) {
    const now = performance.now()
    drivenPass = now - (lastPadPassTapAt.get(padIndex) ?? -1000) <= 300
    lastPadPassTapAt.set(padIndex, now)
  }
  const sprintEdge = buttonEdge(pad, 5, padIndex)
  let knockAhead = false
  if (sprintEdge) {
    const now = performance.now()
    knockAhead = now - (lastPadSprintTapAt.get(padIndex) ?? -1000) <= 300
    lastPadSprintTapAt.set(padIndex, now)
  }
  const dpadX = (button(pad, 15) ? 1 : 0) - (button(pad, 14) ? 1 : 0)
  const dpadY = (button(pad, 13) ? 1 : 0) - (button(pad, 12) ? 1 : 0)
  return {
    ...NEUTRAL_INPUT,
    move: { x: dead(pad.axes[0] ?? 0) + dpadX, y: dead(pad.axes[1] ?? 0) + dpadY },
    sprint: button(pad, 5),
    close: button(pad, 7),
    pass: passEdge && !drivenPass,
    drivenPass,
    drivenPower: 0.62,
    through: buttonEdge(pad, 3, padIndex),
    cross: cross.fired,
    crossPower: cross.power,
    shoot: shoot.fired,
    shootHeld: button(pad, 2),
    shootPower: shoot.power,
    tackle: tackle.fired,
    tackleHeld: button(pad, 0),
    tacklePower: tackle.power,
    knockAhead,
    switchPlayer: buttonEdge(pad, 4, padIndex),
    sendRun: buttonEdge(pad, 11, padIndex),
    callSupport: buttonEdge(pad, 10, padIndex),
    manual: button(pad, 4) && button(pad, 0),
    lineStep: buttonEdge(pad, 15, padIndex),
    lineDrop: buttonEdge(pad, 14, padIndex),
  }
}

function mergeInputs(a: PlayerInput, b: PlayerInput): PlayerInput {
  const move = Math.hypot(a.move.x, a.move.y) > 0.05 ? a.move : b.move
  return {
    ...a,
    move,
    sprint: a.sprint || b.sprint,
    close: a.close || b.close,
    pass: a.pass || b.pass,
    drivenPass: a.drivenPass || b.drivenPass,
    drivenPower: a.drivenPass ? a.drivenPower : b.drivenPower,
    through: a.through || b.through,
    cross: a.cross || b.cross,
    crossPower: a.cross ? a.crossPower : b.crossPower,
    shoot: a.shoot || b.shoot,
    shootHeld: a.shootHeld || b.shootHeld,
    shootPower: a.shoot ? a.shootPower : b.shootPower,
    tackle: a.tackle || b.tackle,
    tackleHeld: a.tackleHeld || b.tackleHeld,
    tacklePower: a.tackle ? a.tacklePower : b.tacklePower,
    knockAhead: a.knockAhead || b.knockAhead,
    switchPlayer: a.switchPlayer || b.switchPlayer,
    sendRun: a.sendRun || b.sendRun,
    callSupport: a.callSupport || b.callSupport,
    manual: a.manual || b.manual,
    lineStep: a.lineStep || b.lineStep,
    lineDrop: a.lineDrop || b.lineDrop,
  }
}

export function readInputs(mapping: InputMapping): Partial<Record<TeamId, PlayerInput>> {
  const read = (device: InputDevice): PlayerInput | undefined => {
    if (device === 'keyboard') return keyboardInput()
    if (device === 'gamepad0') return gamepadInput(0)
    if (device === 'gamepad1') return gamepadInput(1)
    if (device === 'both') return mergeInputs(keyboardInput(), gamepadInput(0))
    return undefined
  }
  const home = read(mapping.home)
  const away = read(mapping.away)
  return {
    ...(home ? { bracelonia: home } : {}),
    ...(away ? { banyarn: away } : {}),
  }
}

export function connectedGamepads(): string[] {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return []
  return Array.from(navigator.getGamepads()).filter(Boolean).map((p) => p!.id)
}

export function clearTransientInput() {
  edge.clear()
  pendingShootPower = null
  pendingCrossPower = null
  pendingTacklePower = null
  pendingKnockAhead = false
  lastKeyboardSprintTapAt = 0
  lastPadSprintTapAt.clear()
  padPending.clear()
}
