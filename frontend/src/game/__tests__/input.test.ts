import { afterEach, describe, expect, it } from 'vitest'
import { attachKeyboardInput, clearTransientInput, keyboardInput } from '../input'

describe('keyboard sprint double-tap', () => {
  let detach: (() => void) | undefined

  afterEach(() => {
    detach?.()
    detach = undefined
    clearTransientInput()
  })

  it('emits knockAhead on the second Shift tap', () => {
    detach = attachKeyboardInput()
    clearTransientInput()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }))
    expect(keyboardInput().knockAhead).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }))
    const second = keyboardInput()
    expect(second.sprint).toBe(true)
    expect(second.knockAhead).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }))
  })

  it('emits drivenPass instead of pass on the second J tap', () => {
    detach = attachKeyboardInput()
    clearTransientInput()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }))
    expect(keyboardInput().drivenPass).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }))
    const second = keyboardInput()
    expect(second.drivenPass).toBe(true)
    // A double tap is one driven ball, not an ordinary pass followed by one.
    expect(second.pass).toBe(false)
    expect(second.drivenPower).toBeGreaterThanOrEqual(0.5)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ' }))
  })
})
