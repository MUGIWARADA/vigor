/**
 * Player-circle colour schemes.
 *
 * The circles carry a lot of the match's readability at 105×68 metres: shape,
 * team, keeper and carrier all have to be legible at a glance and still look
 * like a broadcast graphic rather than a scatter plot. Instead of hard-coding
 * one look, every scheme here describes the same anatomy — body, rim, number,
 * carrier ring — in its own visual language, so the user can pick the one the
 * pitch template and their eyes prefer.
 *
 * All schemes are pure data + pure functions: no React, no randomness, so the
 * match view stays deterministic and the schemes can be unit tested.
 */

export interface CircleLook {
  color: string
  secondaryColor: string
  textColor: string
  gkColor: string
}

export type CircleGradient = 'none' | 'radial' | 'stripe' | 'glass'

export interface CircleScheme {
  id: string
  name: string
  description: string
  gradient: CircleGradient
  /** Solid body colour; unused when a gradient supplies the paint. */
  body: (look: CircleLook, isGk: boolean) => string
  bodyOpacity: number
  rim: (look: CircleLook, isGk: boolean) => { color: string; width: number }
  number: (look: CircleLook, isGk: boolean) => string
  /** Highlight ring drawn round the player currently on the ball. */
  carrierRing: string
  /** Small specular highlight that sells the disc as a bead. */
  gloss: boolean
  /** Optional halo behind the number, for schemes where it crosses two tones. */
  numberStroke?: { color: string; width: number }
  /** Number size, tuned per scheme so it stays inside the disc. */
  numberSize?: number
  swatch: { body: string; rim: string; number: string }
}

const WHITE = '#ffffff'
const INK = '#0b1220'
const VOLT = '#d9f99d'

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = Number.parseInt(full.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const part = (v: number) => Math.round(clamp255(v)).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v))
}

/** Mix a colour toward white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const target = amount >= 0 ? 255 : 0
  const t = Math.abs(amount)
  return rgbToHex(r + (target - r) * t, g + (target - g) * t, b + (target - b) * t)
}

export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Rough relative luminance, used to keep numbers readable on every scheme. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

function readableOn(background: string, preferred: string): string {
  const bg = luminance(background)
  const fg = luminance(preferred)
  return Math.abs(bg - fg) >= 0.32 ? preferred : bg > 0.5 ? INK : WHITE
}

const kitBody = (look: CircleLook, isGk: boolean) => (isGk ? look.gkColor : look.color)

export const CIRCLE_SCHEMES: CircleScheme[] = [
  {
    id: 'volt-halo',
    name: 'Volt halo',
    description: 'Flat club disc, hairline rim. Selection stays volt, nothing else competes with it.',
    gradient: 'none',
    body: kitBody,
    bodyOpacity: 1,
    rim: () => ({ color: 'rgba(8,12,10,0.65)', width: 0.2 }),
    number: (look, isGk) => readableOn(kitBody(look, isGk), look.textColor),
    carrierRing: WHITE,
    gloss: false,
    swatch: { body: '#2456a6', rim: '#0b1220', number: WHITE },
  },
  {
    id: 'chrome-bead',
    name: 'Chrome bead',
    description: 'Polished sphere: lit from the top left, club colour falling into shadow.',
    gradient: 'radial',
    body: kitBody,
    bodyOpacity: 1,
    rim: (look, isGk) => ({ color: rgba(shade(kitBody(look, isGk), 0.55), 0.55), width: 0.22 }),
    number: (look, isGk) => readableOn(shade(kitBody(look, isGk), -0.12), look.textColor),
    carrierRing: VOLT,
    gloss: true,
    swatch: { body: '#4f7fd0', rim: '#cfe0ff', number: WHITE },
  },
  {
    id: 'kit-stripe',
    name: 'Kit stripe',
    description: 'The shirt itself: club colour with the second colour banded down the middle.',
    gradient: 'stripe',
    body: kitBody,
    bodyOpacity: 1,
    rim: (look) => ({ color: rgba(shade(look.secondaryColor, -0.15), 0.7), width: 0.16 }),
    numberStroke: { color: 'rgba(6,10,18,0.55)', width: 0.34 },
    number: (look, isGk) => readableOn(mix(kitBody(look, isGk), look.secondaryColor, 0.5), look.textColor),
    carrierRing: VOLT,
    gloss: false,
    swatch: { body: '#2456a6', rim: '#ffffff', number: WHITE },
  },
  {
    id: 'ring-guard',
    name: 'Ring guard',
    description: 'Dark core inside a thick club-coloured hoop — the number reads like a badge.',
    gradient: 'none',
    body: () => INK,
    bodyOpacity: 0.92,
    rim: (look, isGk) => ({ color: kitBody(look, isGk), width: 0.5 }),
    numberSize: 1.16,
    number: (look, isGk) => mix(kitBody(look, isGk), WHITE, 0.34),
    carrierRing: WHITE,
    gloss: false,
    swatch: { body: '#0b1220', rim: '#2456a6', number: '#8eb3ec' },
  },
  {
    id: 'neon-glass',
    name: 'Neon glass',
    description: 'Translucent club colour with a bright rim and a soft glow — best on the dark skins.',
    gradient: 'glass',
    body: kitBody,
    bodyOpacity: 0.72,
    rim: (look, isGk) => ({ color: shade(kitBody(look, isGk), 0.42), width: 0.3 }),
    number: (look, isGk) => (luminance(kitBody(look, isGk)) > 0.42 ? INK : WHITE),
    carrierRing: WHITE,
    gloss: true,
    swatch: { body: '#2456a6', rim: '#a7c6f7', number: WHITE },
  },
  {
    id: 'ink-disc',
    name: 'Ink disc',
    description: 'Chalk-white disc with a club-coloured rim: quiet, editorial, best on dark turf.',
    gradient: 'none',
    body: () => '#f8fafc',
    bodyOpacity: 0.96,
    rim: (look, isGk) => ({ color: kitBody(look, isGk), width: 0.34 }),
    number: (look, isGk) => shade(kitBody(look, isGk), -0.28),
    carrierRing: VOLT,
    gloss: false,
    swatch: { body: '#f8fafc', rim: '#c8102e', number: '#8f0b21' },
  },
  {
    id: 'flood-gold',
    name: 'Flood gold',
    description: 'Warm two-tone: club colour under a gold rim, like a floodlit scoreboard bead.',
    gradient: 'radial',
    body: kitBody,
    bodyOpacity: 1,
    rim: () => ({ color: 'rgba(250,204,21,0.75)', width: 0.26 }),
    number: (look, isGk) => readableOn(kitBody(look, isGk), look.textColor),
    carrierRing: WHITE,
    gloss: false,
    swatch: { body: '#c8102e', rim: '#facc15', number: WHITE },
  },
]

export const DEFAULT_CIRCLE_SCHEME = 'volt-halo'

export function circleScheme(id: string | undefined): CircleScheme {
  return CIRCLE_SCHEMES.find((s) => s.id === id) ?? CIRCLE_SCHEMES[0]!
}

export interface ResolvedCircle {
  fill: string
  fillOpacity: number
  stroke: string
  strokeWidth: number
  numberFill: string
  carrierRing: string
  numberStroke?: { color: string; width: number }
  numberSize?: number
  /** id of the gradient definition that paints the body, when the scheme has one. */
  gradientId?: string
  gloss: boolean
}

/**
 * Resolve one player's circle paint. `teamKey` scopes the gradient ids so the
 * two sides never share a definition.
 */
export function resolveCircle(
  scheme: CircleScheme,
  look: CircleLook,
  teamKey: string,
  opts: { isGk: boolean; isCarrier: boolean },
): ResolvedCircle {
  const rim = scheme.rim(look, opts.isGk)
  return {
    fill: scheme.body(look, opts.isGk),
    fillOpacity: scheme.bodyOpacity,
    stroke: opts.isCarrier && scheme.id === 'volt-halo' ? WHITE : rim.color,
    strokeWidth: opts.isCarrier ? Math.max(rim.width, 0.3) : rim.width,
    numberFill: scheme.number(look, opts.isGk),
    carrierRing: scheme.carrierRing,
    numberStroke: scheme.numberStroke,
    numberSize: scheme.numberSize,
    gradientId: scheme.gradient === 'none' ? undefined : `tiq-circle-${scheme.id}-${teamKey}${opts.isGk ? '-gk' : ''}`,
    gloss: scheme.gloss,
  }
}

export interface GradientStop {
  offset: number
  color: string
  opacity?: number
}

/** Stops for the scheme's body gradient, in club colours. */
export function gradientStops(scheme: CircleScheme, look: CircleLook, isGk: boolean): GradientStop[] {
  const base = scheme.body(look, isGk)
  if (scheme.gradient === 'radial') {
    return [
      { offset: 0, color: shade(base, 0.42) },
      { offset: 0.52, color: base },
      { offset: 1, color: shade(base, -0.36) },
    ]
  }
  if (scheme.gradient === 'stripe') {
    const accent = isGk ? shade(look.gkColor, -0.25) : look.secondaryColor
    return [
      { offset: 0, color: base },
      { offset: 0.34, color: base },
      { offset: 0.42, color: accent },
      { offset: 0.58, color: accent },
      { offset: 0.66, color: base },
      { offset: 1, color: base },
    ]
  }
  if (scheme.gradient === 'glass') {
    return [
      { offset: 0, color: shade(base, 0.5), opacity: 0.95 },
      { offset: 0.68, color: base, opacity: 0.78 },
      { offset: 1, color: shade(base, -0.2), opacity: 0.86 },
    ]
  }
  return [{ offset: 0, color: base }]
}
