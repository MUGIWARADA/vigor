import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind class names (shadcn convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/* ------------------------------------------------------------------ */
/* Colour contrast helpers                                             */
/* ------------------------------------------------------------------ */

/** Keepers get their own dot colour so they read apart from both teams
    (white home / dark-blue away) — the SofaScore convention. */
export const GK_DOT_COLOR = '#fbbf24'

/** WCAG-style relative luminance of a #rrggbb colour (0 = black, 1 = white). */
export function colorLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 1
  const n = parseInt(m[1]!, 16)
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return (
    0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  )
}

/** Dark-on-light or light-on-dark text colour for a given background. */
export function readableTextOn(hex: string): string {
  return colorLuminance(hex) > 0.35 ? '#0d1424' : '#f2f5fa'
}

/* ------------------------------------------------------------------ */
/* Formatting helpers — tabular, analyst-friendly numbers.             */
/* ------------------------------------------------------------------ */

export function fmt(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toFixed(decimals)
}

export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return Math.round(value).toLocaleString('en-GB')
}

export function fmtPct(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toFixed(decimals)}%`
}

export function fmtSigned(value: number, decimals = 1): string {
  const s = value.toFixed(decimals)
  return value > 0 ? `+${s}` : s
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${fmtDate(iso)}, ${hh}:${mm}`
}

/** Age in completed years at the reference date. */
export function ageAt(dob: string, reference: Date | string = '2026-10-10'): number {
  const birth = new Date(dob)
  const ref = typeof reference === 'string' ? new Date(reference) : reference
  let age = ref.getFullYear() - birth.getFullYear()
  const m = ref.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age -= 1
  return age
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

/** Clamp helper used by pitch interactions. */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function pluralise(n: number, word: string, plural = `${word}s`): string {
  return `${n} ${n === 1 ? word : plural}`
}
