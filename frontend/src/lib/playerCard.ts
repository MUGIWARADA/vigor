import type { Player, Team } from '@/types'
import type { AllRoundSeasonRating } from './ratings'
import { xgColor, type ShotPoint } from './playerShots'
import { initials } from './utils'

/**
 * Shareable player card (SVG) — a single self-contained graphic in the
 * Volt Monochrome identity: kit panel, all-round rating, category bars,
 * season output and a mini shot map. Generated in the browser from the same
 * computed values the profile shows; fictional demo cards are watermarked
 * DEMO so a shared image can never pass as real scouting intel.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function bandColor(pct: number): string {
  if (pct >= 75) return '#2ee06f'
  if (pct >= 50) return '#d4f93a'
  if (pct >= 25) return '#ffb020'
  return '#f97316'
}

export interface PlayerCardInput {
  player: Player
  team: Team | undefined
  rating: AllRoundSeasonRating | null
  shotPoints: ShotPoint[]
  seasonLabel: string
}

export function buildPlayerCardSvg({ player, team, rating, shotPoints, seasonLabel }: PlayerCardInput): string {
  const W = 1200
  const H = 675
  const s = player.stats
  const cats = (rating?.categories ?? [])
    .filter((c) => c.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5)

  const bars = cats
    .map((c, i) => {
      const y = 462 + i * 33
      const w = Math.round(((c.score ?? 0) / 100) * 300)
      return [
        `<text x="470" y="${y + 4}" font-size="19" fill="#a1a1aa">${esc(c.label)}</text>`,
        `<rect x="640" y="${y - 12}" width="300" height="16" rx="8" fill="#232329"/>`,
        `<rect x="640" y="${y - 12}" width="${w}" height="16" rx="8" fill="${bandColor(c.score ?? 0)}"/>`,
        `<text x="955" y="${y + 4}" font-size="19" font-weight="700" fill="#fafafa">${Math.round(c.score ?? 0)}</text>`,
      ].join('')
    })
    .join('')

  // Mini shot map: final third (x 55–100) → panel x 470–1140, y → 70–300.
  const mapX = (x: number) => 470 + ((Math.max(55, x) - 55) / 45) * 670
  const mapY = (y: number) => 205 + (y / 100) * 195
  const dots = shotPoints
    .map(
      (p) =>
        `<circle cx="${mapX(p.x).toFixed(1)}" cy="${mapY(p.y).toFixed(1)}" r="${p.goal ? 6 : 4}" fill="${xgColor(p.xg)}" ${p.goal ? 'stroke="#ffffff" stroke-width="2"' : 'opacity="0.85"'}/>`,
    )
    .join('')

  const output = [
    `${s.appearances} apps`,
    `${s.minutes} mins`,
    `${s.goals} goals`,
    `${s.assists} assists`,
    `${s.chancesCreated} chances created`,
  ].join('  ·  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, system-ui, sans-serif">
  <rect width="${W}" height="${H}" fill="#0a0a0b"/>
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="18" fill="none" stroke="#2a2a30" stroke-width="2"/>

  <!-- Kit panel -->
  <defs>
    <linearGradient id="kit" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${team?.color ?? '#3a3a42'}"/>
      <stop offset="100%" stop-color="#101012"/>
    </linearGradient>
  </defs>
  <rect x="40" y="40" width="380" height="${H - 80}" rx="14" fill="url(#kit)"/>
  <text x="395" y="215" text-anchor="end" font-size="230" font-weight="900" fill="rgba(255,255,255,0.14)">${player.shirtNumber ?? ''}</text>
  <circle cx="110" cy="115" r="46" fill="rgba(0,0,0,0.35)" stroke="#ffffff" stroke-width="2.5"/>
  <text x="110" y="128" text-anchor="middle" font-size="36" font-weight="800" fill="#ffffff">${esc(initials(player.name))}</text>
  <text x="65" y="${H - 120}" font-size="30" font-weight="800" fill="#ffffff">${esc(team?.shortName ?? '')} · ${esc(player.position)}</text>

  <!-- Identity -->
  <text x="470" y="105" font-size="46" font-weight="800" fill="#fafafa">${esc(player.name)}</text>
  <text x="470" y="140" font-size="22" fill="#a1a1aa">${esc(team?.name ?? '')} · ${esc(seasonLabel)}</text>
  <text x="470" y="172" font-size="20" fill="#d4f93a">${esc(output)}</text>

  <!-- Rating -->
  ${
    rating
      ? `<rect x="1010" y="48" width="140" height="112" rx="12" fill="rgba(212,249,58,0.10)" stroke="#94c40b" stroke-width="2"/>
  <text x="1080" y="115" text-anchor="middle" font-size="56" font-weight="900" fill="#fafafa">${rating.rating.toFixed(1)}</text>
  <text x="1080" y="145" text-anchor="middle" font-size="15" fill="#a1a1aa">ALL-ROUND (EST.)</text>`
      : ''
  }

  <!-- Mini shot map -->
  <g opacity="0.9">
    <rect x="${mapX(83.5).toFixed(1)}" y="${mapY(20.4).toFixed(1)}" width="${(mapX(100) - mapX(83.5)).toFixed(1)}" height="${(mapY(79.6) - mapY(20.4)).toFixed(1)}" fill="none" stroke="rgba(250,250,250,0.35)" stroke-width="1.5"/>
    <rect x="${mapX(94.5).toFixed(1)}" y="${mapY(36.8).toFixed(1)}" width="${(mapX(100) - mapX(94.5)).toFixed(1)}" height="${(mapY(63.2) - mapY(36.8)).toFixed(1)}" fill="none" stroke="rgba(250,250,250,0.35)" stroke-width="1.5"/>
    ${dots}
  </g>
  <text x="470" y="428" font-size="16" fill="#71717a">Shot map (final third, colour = xG, white ring = goal) · ${shotPoints.length} attempts</text>

  <!-- Category bars -->
  ${bars}

  <!-- Footer -->
  <text x="470" y="${H - 36}" font-size="19" font-weight="700" fill="#fafafa">Vig<tspan fill="#d4f93a">or</tspan></text>
  <text x="${W - 40}" y="${H - 36}" text-anchor="end" font-size="17" fill="#ffb020">DEMO — fictional data</text>
</svg>`
}

/** Trigger a browser download of the card SVG. */
export function downloadPlayerCard(input: PlayerCardInput): void {
  const svg = buildPlayerCardSvg(input)
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${input.player.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-vigor-card.svg`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
