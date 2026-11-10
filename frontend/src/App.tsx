import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SettingsProvider } from '@/state/settings'
import { FiltersProvider } from '@/state/filters'
import { DataProvider } from '@/state/data'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { OverviewPage } from '@/pages/OverviewPage'
import { PlayersPage } from '@/pages/PlayersPage'
import { PlayerProfilePage } from '@/pages/PlayerProfilePage'
import { ContextualAnalysisPage } from '@/pages/ContextualAnalysisPage'
import { ComparisonPage } from '@/pages/ComparisonPage'
import { SimilaritySearchPage } from '@/pages/SimilaritySearchPage'
import { TopPerformersPage } from '@/pages/TopPerformersPage'
import { TacticalLabPage } from '@/pages/TacticalLabPage'
import { MatchDetailPage } from '@/pages/MatchPages'
import { MatchPreviewPage } from '@/pages/MatchPreviewPage'
import { NewsPage } from '@/pages/NewsPage'
import { DiscussionsPage, DiscussionRoomPage } from '@/pages/DiscussionsPages'
import { AssistantPage } from '@/pages/AssistantPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { CompetitionsPage } from '@/pages/CompetitionsPage'
import { GameModePage } from '@/pages/GameModePage'

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-metric text-6xl font-bold text-accent-400">404</p>
      <h1 className="mt-3 text-lg font-semibold text-fg">Page not found</h1>
      <p className="mt-1 text-xs text-fg-muted">The page you requested does not exist in this build.</p>
      <Button asChild variant="outline" size="sm" className="mt-5">
        <Link to="/">Back to overview</Link>
      </Button>
    </div>
  )
}

/** All application routes (shared between the BrowserRouter build and preview builds). */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<OverviewPage />} />
      <Route path="/players" element={<PlayersPage />} />
      <Route path="/players/:playerId" element={<PlayerProfilePage />} />
      <Route path="/analysis" element={<ContextualAnalysisPage />} />
      <Route path="/compare" element={<ComparisonPage />} />
      <Route path="/similarity" element={<SimilaritySearchPage />} />
      <Route path="/rankings" element={<TopPerformersPage />} />
      <Route path="/competitions" element={<CompetitionsPage />} />
      <Route path="/tactical-lab" element={<TacticalLabPage />} />
      <Route path="/matches" element={<MatchPreviewPage />} />
      <Route path="/matches/:matchId" element={<MatchDetailPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/discussions" element={<DiscussionsPage />} />
      <Route path="/discussions/:playerId" element={<DiscussionRoomPage />} />
      <Route path="/assistant" element={<AssistantPage />} />
      <Route path="/game-mode" element={<GameModePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

/** Shared providers (settings, filters, data, tooltips). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <FiltersProvider>
        <DataProvider>
          <TooltipProvider delayDuration={200} skipDelayDuration={100}>
            {children}
          </TooltipProvider>
        </DataProvider>
      </FiltersProvider>
    </SettingsProvider>
  )
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </BrowserRouter>
    </AppProviders>
  )
}
