import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { Menu, Moon, Settings, Sun, X } from 'lucide-react'
import { NAV_SECTIONS } from './nav-items'
import { useSettings } from '@/state/settings'
import { ProvenanceBadge } from '@/components/shared/provenance'
import { DATASET_VERSION } from '@/lib/metrics'
import { cn } from '@/lib/utils'

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400" aria-label="Vigor home">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect x="1" y="1" width="30" height="30" rx="7" fill="#101012" stroke="#35353e" strokeWidth="1.5" />
        <path d="M16 5 L26 11 L26 21 L16 27 L6 21 L6 11 Z" fill="none" stroke="#d4f93a" strokeWidth="1.6" />
        <circle cx="16" cy="16" r="3.2" fill="#d4f93a" />
        <path d="M16 12.8 L19.2 16 L16 19.2 L12.8 16 Z" fill="#101012" />
      </svg>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight text-fg">
            Vig<span className="text-accent-400">or</span>
          </span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.22em] text-fg-faint">
            Football Intelligence
          </span>
        </span>
      )}
    </Link>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()
  return (
    <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className={`nav-hue-${section.hue}`}>
          <div className={`text-label nav-section-label nav-hue-${section.hue} px-2 pb-1.5`}>{section.label}</div>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400',
                      'border-l-2',
                      active
                        ? 'border-accent-400 bg-accent-400/10 text-accent-300 accent-glow'
                        : 'border-transparent text-fg-muted hover:bg-ink-800 hover:text-fg',
                    )}
                  >
                    <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-accent-400' : 'text-fg-faint')} aria-hidden />
                    {item.label}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function DataSourceFooter() {
  const { settings } = useSettings()
  return (
    <div className="border-t border-line px-4 py-3">
      <div className="flex items-center gap-1.5">
        {settings.demoMode ? (
          <>
            <ProvenanceBadge provenance="DEMO" />
            <span className="text-[10px] leading-tight text-fg-faint">
              Fictional dataset — {DATASET_VERSION}
            </span>
          </>
        ) : (
          <span className="text-[10px] leading-tight text-fg-faint">Demo data disabled — empty states shown</span>
        )}
      </div>
    </div>
  )
}

/** Which navigation section the current route belongs to; drives the daylight hue. */
function sectionForPath(pathname: string): string {
  for (const section of NAV_SECTIONS) {
    if (section.items.some((item) => (item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)))) {
      return section.label.toLowerCase().split(' ')[0]!
    }
  }
  return 'settings'
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const section = sectionForPath(location.pathname)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Expose the current section on <html> so the light-theme wash can be keyed
  // off it in CSS (Intelligence = mint/sky, Analysis = sky/lilac, …).
  useEffect(() => {
    document.documentElement.dataset.appSection = section
  }, [section])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Desktop sidebar */}
      <aside className="app-sidebar fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-ink-900 lg:flex">
        <div className="flex h-16 items-center border-b border-line px-4">
          <Logo />
        </div>
        <SidebarNav />
        <div className="border-t border-line p-2">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400',
                'border-l-2',
                isActive
                  ? 'border-accent-400 bg-accent-400/10 text-accent-300 accent-glow'
                  : 'border-transparent text-fg-muted hover:bg-ink-800 hover:text-fg',
              )
            }
          >
            <Settings className="h-4 w-4 text-fg-faint" aria-hidden />
            Account &amp; settings
          </NavLink>
        </div>
        <DataSourceFooter />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Main navigation">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="app-sidebar absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-ink-900 shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded p-1.5 text-fg-muted hover:bg-ink-800 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-line p-2">
              <NavLink
                to="/settings"
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-fg-muted hover:bg-ink-800 hover:text-fg"
              >
                <Settings className="h-4 w-4 text-fg-faint" aria-hidden />
                Account &amp; settings
              </NavLink>
            </div>
            <DataSourceFooter />
          </aside>
        </div>
      )}

      {/* Header */}
      <header className="app-header sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-ink-950/90 px-4 backdrop-blur lg:pl-[15.5rem] lg:pr-6">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded p-2 text-fg-muted hover:bg-ink-800 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <div className="lg:hidden">
          <Logo compact />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <HeaderDemoIndicator />
        </div>
      </header>

      {/* Page content */}
      <main className="px-4 py-6 lg:pl-[15.5rem] lg:pr-6">
        <div className="mx-auto w-full max-w-[1440px]">{children}</div>
      </main>
    </div>
  )
}

import { Link as RouterLink } from 'react-router-dom'
import { useData } from '@/state/data'
import { apiStatus } from '@/api/client'

function ThemeToggle() {
  const { theme, toggleTheme } = useSettings()
  const toLight = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={toLight ? 'Switch to light mode' : 'Switch to dark mode'}
      title={toLight ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center gap-1.5 rounded-md panel-border bg-ink-900 px-2.5 py-1.5 text-[11px] font-semibold text-accent-300 transition-colors hover:bg-accent-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
    >
      {toLight ? <Sun className="h-3.5 w-3.5" aria-hidden /> : <Moon className="h-3.5 w-3.5" aria-hidden />}
      {toLight ? 'Light' : 'Dark'}
    </button>
  )
}

function HeaderDemoIndicator() {
  const { settings } = useSettings()
  const { data } = useData()
  if (settings.demoMode && data) {
    return (
      <RouterLink
        to="/settings"
        className="flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-[11px] font-semibold text-warning transition-colors hover:bg-warning/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
        title="All statistics shown are fictional demo data"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
        DEMO DATA ACTIVE
      </RouterLink>
    )
  }
  if (!apiStatus.backendConfigured) {
    return (
      <RouterLink
        to="/settings"
        className="flex items-center gap-1.5 rounded-md border border-line-strong bg-ink-800 px-2.5 py-1.5 text-[11px] font-semibold text-fg-muted transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        title="Demo data is disabled and no data source is connected"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-negative" aria-hidden />
        NO DATA SOURCE
      </RouterLink>
    )
  }
  return null
}
