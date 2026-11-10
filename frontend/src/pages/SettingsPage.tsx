import { useState } from 'react'
import { Database, Settings2, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/page-header'
import { InfoNote } from '@/components/shared/info-note'
import { ProvenanceBadge, ProvenanceLegend } from '@/components/shared/provenance'
import { useSettings } from '@/state/settings'
import { useData } from '@/state/data'
import { apiStatus } from '@/api/client'
import { datasetScopeLabel } from '@/data/generate'
import {
  manualEventStore,
  matchNotesStore,
  recentlyViewedStore,
  savedResearchStore,
  scenarioStore,
  useStore,
} from '@/lib/store'
import { DATASET_VERSION, METRICS } from '@/lib/metrics'

export function SettingsPage() {
  const { theme, setTheme, settings, setDemoMode, setShowMetricDefinitionsInline, setRealDataEnabled, reset } = useSettings()
  const { data } = useData()

  const scenarios = useStore(scenarioStore)
  const manualEvents = useStore(manualEventStore)
  const savedResearch = useStore(savedResearchStore)
  const recentlyViewed = useStore(recentlyViewedStore)
  const matchNotes = useStore(matchNotesStore)

  const [confirmReset, setConfirmReset] = useState(false)

  const availableMetrics = Object.values(METRICS).filter((m) => m.available).length
  const unavailableMetrics = Object.values(METRICS).filter((m) => !m.available).length

  const clearLocalContent = () => {
    scenarioStore.set([])
    manualEventStore.set([])
    savedResearchStore.set([])
    recentlyViewedStore.set([])
    matchNotesStore.set({})
    setConfirmReset(false)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Account & settings"
        description="Manage data sources, demo mode and local content. User accounts arrive with the Spring Boot backend and Spring Security in Phase 2."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Data sources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4 text-fg-faint" aria-hidden />
              Data sources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-md border border-warning/25 bg-warning/[0.06] p-3">
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="demo-mode" className="text-fg">Demo data</Label>
                  <ProvenanceBadge provenance="DEMO" />
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
                  Master switch for the fictional demonstration dataset. When disabled, every data view shows
                  an explicit empty state — sample values are never silently substituted.
                </p>
              </div>
              <Switch
                id="demo-mode"
                checked={settings.demoMode}
                onCheckedChange={setDemoMode}
                aria-label="Enable demo data"
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="real-data" className="text-fg">Real competition data</Label>
                  <ProvenanceBadge provenance="IMPORTED" />
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
                  Fetch real league tables, fixtures and top scorers (top-5 leagues + Champions
                  League) from football-data.org through the backend proxy. Off by default; every
                  imported value is labelled with its source and fetch time. Requires the backend
                  running with FOOTBALL_DATA_TOKEN set.
                </p>
              </div>
              <Switch
                id="real-data"
                checked={settings.realDataEnabled}
                onCheckedChange={setRealDataEnabled}
                aria-label="Enable real competition data"
              />
            </div>

            <div className="rounded-md panel-border bg-ink-900/60 p-3 text-[11px] leading-relaxed text-fg-muted">
              <p className="mb-1 font-semibold text-fg">Connection status</p>
              <p>Backend API configured: {apiStatus.backendConfigured ? 'yes' : 'no'} (VITE_API_BASE_URL)</p>
              <p>Backend reachable: {apiStatus.backendReachable ? 'yes' : 'no'}</p>
              {apiStatus.lastError && <p className="text-negative">Last error: {apiStatus.lastError}</p>}
              <p className="mt-1 text-fg-faint">
                Without VITE_API_BASE_URL the app runs entirely on the in-browser demo dataset. The
                Java/Spring Boot backend (see backend/README.md) serves the REST API and proxies
                real data with the API key kept server-side.
              </p>
            </div>

            {data && (
              <div className="rounded-md panel-border bg-ink-900/60 p-3 text-[11px] leading-relaxed text-fg-muted">
                <p className="mb-1 font-semibold text-fg">Active dataset</p>
                <p>{datasetScopeLabel(data.dataset)} · {data.dataset.season.label} · {DATASET_VERSION}</p>
                <p>
                  {data.dataset.players.length} players · {data.dataset.teams.length} teams ·{' '}
                  {data.dataset.matches.length} matches · {data.dataset.events.length} events
                </p>
                <p className="mt-1 text-fg-faint">
                  Metric registry: {availableMetrics} available, {unavailableMetrics} gated with documented
                  reasons (never zero-filled).
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Provenance legend */}
        <Card>
          <CardHeader>
            <CardTitle>Data provenance labels</CardTitle>
          </CardHeader>
          <CardContent>
            <ProvenanceLegend />
            <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">
              Every statistic, article and scenario in the app carries one of these labels. Hover any label in
              the interface for its meaning.
            </p>
          </CardContent>
        </Card>

        {/* Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-fg-faint" aria-hidden />
              Display
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-md panel-border bg-ink-900/60 p-3">
              <div>
                <Label htmlFor="light-mode" className="text-fg">Light mode</Label>
                <p className="mt-1 text-[11px] text-fg-muted">
                  Daylight colour scheme. The volt accent (selected tabs, active navigation,
                  focus rings) is the same in both modes, deepened one step so it stays readable
                  on white. You can also switch any time with the header button.
                </p>
              </div>
              <Switch
                id="light-mode"
                checked={theme === 'light'}
                onCheckedChange={(v) => setTheme(v ? 'light' : 'dark')}
                aria-label="Light mode"
              />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-md panel-border bg-ink-900/60 p-3">
              <div>
                <Label htmlFor="inline-defs" className="text-fg">Inline metric definitions</Label>
                <p className="mt-1 text-[11px] text-fg-muted">
                  Show numerator/denominator hints directly under metric tables (tooltips are always available
                  via the ⓘ icon).
                </p>
              </div>
              <Switch
                id="inline-defs"
                checked={settings.showMetricDefinitionsInline}
                onCheckedChange={setShowMetricDefinitionsInline}
                aria-label="Show inline metric definitions"
              />
            </div>
            <Button variant="outline" size="sm" onClick={reset}>
              Reset app settings
            </Button>
          </CardContent>
        </Card>

        {/* Local content */}
        <Card>
          <CardHeader>
            <CardTitle>Local content (MANUAL)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1.5 text-[13px] text-fg-muted">
              <li className="flex justify-between"><span>Tactical Lab scenarios</span><Badge variant="muted">{scenarios.length}</Badge></li>
              <li className="flex justify-between"><span>Manual match tags</span><Badge variant="muted">{manualEvents.length}</Badge></li>
              <li className="flex justify-between"><span>Saved research items</span><Badge variant="muted">{savedResearch.length}</Badge></li>
              <li className="flex justify-between"><span>Match note documents</span><Badge variant="muted">{Object.keys(matchNotes).length}</Badge></li>
              <li className="flex justify-between"><span>Recently viewed players</span><Badge variant="muted">{recentlyViewed.length}</Badge></li>
            </ul>
            {confirmReset ? (
              <div className="flex items-center gap-2">
                <Button variant="destructive" size="sm" onClick={clearLocalContent}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Confirm: delete all local content
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)} disabled={
                scenarios.length + manualEvents.length + savedResearch.length + recentlyViewed.length + Object.keys(matchNotes).length === 0
              }>
                Clear all local content
              </Button>
            )}
            <p className="text-[11px] leading-relaxed text-fg-faint">
              This content lives in your browser's localStorage only. Phase 2 moves it to the API with
              authentication and server-side permission checks.
            </p>
          </CardContent>
        </Card>

        {/* Account */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-fg-faint" aria-hidden />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InfoNote icon={ShieldCheck} variant="scope" title="Accounts are not implemented in Phase 1">
              Authentication, authorisation, role-based permissions and server-side validation are planned for
              Phase 2 with the Spring Boot backend (Spring Security). No passwords or personal data are
              collected in this build, and no secrets are stored in the frontend — only non-secret public
              configuration (see frontend/.env.example).
            </InfoNote>
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-fg-faint">
        Vigor — Football Intelligence Platform · Phase 1 (frontend shell) · All statistics fictional
        demo data unless provenance states otherwise.
      </p>
    </div>
  )
}
