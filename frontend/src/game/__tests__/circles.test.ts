import { describe, expect, it } from 'vitest'
import { CIRCLE_SCHEMES, DEFAULT_CIRCLE_SCHEME, circleScheme, gradientStops, luminance, mix, resolveCircle, shade } from '../circles'

const bracelonia = { color: '#2456a6', secondaryColor: '#a50044', textColor: '#ffffff', gkColor: '#f5a524' }
const banyarn = { color: '#c8102e', secondaryColor: '#ffffff', textColor: '#ffffff', gkColor: '#f5a524' }

describe('player circle schemes', () => {
  it('offers a real choice of distinct, selectable designs', () => {
    expect(CIRCLE_SCHEMES.length).toBeGreaterThanOrEqual(6)
    expect(new Set(CIRCLE_SCHEMES.map((s) => s.id)).size).toBe(CIRCLE_SCHEMES.length)
    for (const scheme of CIRCLE_SCHEMES) {
      expect(scheme.name.length).toBeGreaterThan(2)
      expect(scheme.description.length).toBeGreaterThan(10)
    }
    expect(CIRCLE_SCHEMES.map((s) => s.id)).toContain(DEFAULT_CIRCLE_SCHEME)
    // An unknown stored id falls back to the default rather than breaking the pitch.
    expect(circleScheme('not-a-scheme').id).toBe(DEFAULT_CIRCLE_SCHEME)
  })

  it('keeps the number readable on every scheme for both teams and keepers', () => {
    for (const scheme of CIRCLE_SCHEMES) {
      for (const look of [bracelonia, banyarn]) {
        for (const isGk of [false, true]) {
          const paint = resolveCircle(scheme, look, 'bracelonia', { isGk, isCarrier: false })
          expect(paint.numberFill).toMatch(/^#[0-9a-f]{6}$/i)
          const body = paint.fill
          expect(Math.abs(luminance(body) - luminance(paint.numberFill))).toBeGreaterThan(0.3)
        }
      }
    }
  })

  it('gives the carrier a ring and scopes gradients per team', () => {
    const chrome = circleScheme('chrome-bead')
    const home = resolveCircle(chrome, bracelonia, 'bracelonia', { isGk: false, isCarrier: true })
    const away = resolveCircle(chrome, banyarn, 'banyarn', { isGk: false, isCarrier: true })
    expect(home.carrierRing).toBeTruthy()
    expect(home.gradientId).not.toBe(away.gradientId)
    expect(resolveCircle(chrome, bracelonia, 'bracelonia', { isGk: true, isCarrier: false }).gradientId)
      .toContain('-gk')
    const flat = resolveCircle(circleScheme('volt-halo'), bracelonia, 'bracelonia', { isGk: false, isCarrier: false })
    expect(flat.gradientId).toBeUndefined()
    expect(flat.fill).toBe(bracelonia.color)
  })

  it('derives gradient stops from the club kit instead of hard-coded colours', () => {
    const stripe = circleScheme('kit-stripe')
    const stops = gradientStops(stripe, bracelonia, false)
    expect(stops.map((s) => s.color)).toContain(bracelonia.secondaryColor)
    expect(stops[0]!.color).toBe(bracelonia.color)
    const radial = gradientStops(circleScheme('chrome-bead'), banyarn, false)
    expect(radial).toHaveLength(3)
    expect(luminance(radial[0]!.color)).toBeGreaterThan(luminance(banyarn.color))
    expect(luminance(radial[2]!.color)).toBeLessThan(luminance(banyarn.color))
    expect(shade('#000000', 0.5)).toBe('#808080')
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff')
  })
})
