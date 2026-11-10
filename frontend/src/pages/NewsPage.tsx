import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Newspaper } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { InfoNote } from '@/components/shared/info-note'
import { ProvenanceBadge } from '@/components/shared/provenance'
import { PlayerAvatar } from '@/components/shared/player-bits'
import { useData } from '@/state/data'
import { useSettings } from '@/state/settings'
import type { NewsCategory } from '@/types'
import { cn, fmtDateTime } from '@/lib/utils'

const CATEGORIES: NewsCategory[] = ['match-report', 'transfer', 'injury', 'tactical', 'analysis', 'general']

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  'match-report': 'Match report',
  transfer: 'Transfer',
  injury: 'Injury',
  tactical: 'Tactical',
  analysis: 'Analysis',
  general: 'General',
}

export function NewsPage() {
  const { data, playerById, teamById } = useData()
  const { settings } = useSettings()
  const [category, setCategory] = useState<NewsCategory | 'all'>('all')

  const articles = (data?.content.news ?? [])
    .filter((n) => (category === 'all' ? true : n.category === category))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Football news"
        description="News feed with source, date, related team/player, category and a link to the original article where one exists. Phase 1 ships clearly-labelled fictional articles; real feeds require official or licensed sources (Phase 7)."
      />

      {!data ? (
        <EmptyState
          icon={Newspaper}
          title="No news sources connected"
          description={
            settings.demoMode
              ? 'Data is loading or unavailable.'
              : 'Demo data is disabled and no news provider is configured. Real feeds will use official RSS/licensed APIs with per-article provenance. Enable demo data in Settings to see the interface with fictional records.'
          }
          showSettingsAction={!settings.demoMode}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={cn(
                'rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
                category === 'all' ? 'bg-accent-500 text-on-bright' : 'bg-ink-800 text-fg-muted hover:bg-ink-700 hover:text-fg',
              )}
            >
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  'rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
                  category === c ? 'bg-accent-500 text-on-bright' : 'bg-ink-800 text-fg-muted hover:bg-ink-700 hover:text-fg',
                )}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {articles.map((article) => {
              const player = article.playerId ? playerById(article.playerId) : undefined
              const team = article.teamId ? teamById(article.teamId) : undefined
              return (
                <Card key={article.id}>
                  <CardContent className="p-4">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant="default" className="normal-case">{CATEGORY_LABELS[article.category]}</Badge>
                      <ProvenanceBadge provenance={article.provenance} />
                      <span className="ml-auto text-[10px] text-fg-faint">{fmtDateTime(article.publishedAt)}</span>
                    </div>
                    <h2 className="text-[15px] font-semibold leading-snug text-fg">{article.title}</h2>
                    <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{article.summary}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
                      {player && (
                        <Link
                          to={`/players/${player.id}`}
                          className="flex items-center gap-1.5 rounded bg-ink-800 px-2 py-1 text-[11px] text-fg-muted hover:text-accent-300"
                        >
                          <PlayerAvatar name={player.name} position={player.position} size="sm" />
                          {player.name}
                        </Link>
                      )}
                      {team && (
                        <span
                          className="rounded px-2 py-1 text-[11px]"
                          style={{ color: team.color, backgroundColor: `${team.color}18` }}
                        >
                          {team.name}
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-1 text-[10px] text-fg-faint">
                        {article.source}
                      </span>
                    </div>
                    {!article.externalUrl && (
                      <p className="mt-2 flex items-center gap-1 text-[10px] text-fg-faint">
                        <ExternalLink className="h-3 w-3" aria-hidden />
                        Demo record — no external article exists. Real articles will link to the original
                        source with attribution.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {articles.length === 0 && (
            <EmptyState icon={Newspaper} title="No articles in this category" description="Try another category filter." />
          )}

          <InfoNote variant="scope" title="Sources policy">
            All outlets and headlines above are fictional (DEMO). The platform will never scrape sites against
            their terms of service or present generated summaries as verified reporting. When real feeds are
            connected, each article will record its source, fetch time and attribution requirements, and be
            labelled IMPORTED.
          </InfoNote>
        </>
      )}
    </div>
  )
}
