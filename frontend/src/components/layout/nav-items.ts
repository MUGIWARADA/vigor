import {
  Bot,
  CalendarDays,
  ClipboardPen,
  Crosshair,
  Gamepad2,
  GitCompareArrows,
  LayoutDashboard,
  ListOrdered,
  MessagesSquare,
  Newspaper,
  Scale,
  Trophy,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  description: string
}

export type NavHue = 'mint' | 'sky' | 'amber' | 'lilac' | 'rose'

export interface NavSection {
  label: string
  /** Section colour: shown as a dot in the heading and on hovered icons. */
  hue: NavHue
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Intelligence',
    hue: 'mint',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard, description: 'Front page: matches, trending, top performances' },
      { to: '/players', label: 'Player database', icon: Users, description: 'Browse and filter all players' },
      { to: '/analysis', label: 'Contextual analysis', icon: Crosshair, description: 'Phase-specific metric analysis' },
      { to: '/compare', label: 'Comparison', icon: GitCompareArrows, description: 'Compare players side by side' },
      { to: '/similarity', label: 'Similarity search', icon: Scale, description: 'Find statistically similar players' },
      { to: '/rankings', label: 'Top performers', icon: Trophy, description: 'League rankings by metric' },
      { to: '/competitions', label: 'Competitions', icon: ListOrdered, description: 'League tables, fixtures and scorers' },
    ],
  },
  {
    label: 'Analysis tools',
    hue: 'sky',
    items: [
      { to: '/tactical-lab', label: 'Tactical Lab', icon: ClipboardPen, description: 'Interactive pitch planning' },
      { to: '/matches', label: 'Match Preview', icon: CalendarDays, description: 'Leagues, teams, match previews and full reports' },
    ],
  },
  {
    label: 'Community',
    hue: 'amber',
    items: [
      { to: '/news', label: 'Football news', icon: Newspaper, description: 'News feed from configured sources' },
      { to: '/discussions', label: 'Discussion rooms', icon: MessagesSquare, description: 'Per-player research discussions' },
      { to: '/assistant', label: 'AI research assistant', icon: Bot, description: 'Ask questions about the data' },
      { to: '/game-mode', label: 'Game Mode', icon: Gamepad2, description: 'Playable fictional 11v11 Community game' },
    ],
  },
]
