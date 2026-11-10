import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Send, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { InfoNote } from '@/components/shared/info-note'
import { useData } from '@/state/data'
import { useSettings } from '@/state/settings'
import type { AssistantAnswer } from '@/api/assistant'
import { cn, fmtDateTime } from '@/lib/utils'

const SUGGESTIONS = [
  'How does the league top scorer perform during build-up?',
  'Which players have a similar statistical profile to the top creator?',
  'What evidence supports the best centre-back\'s strengths?',
  'What are the main limitations of the available evidence?',
]

/** Minimal renderer for the mock answers: bullets and **bold** segments. */
function AnswerBody({ text }: { text: string }) {
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, i) => {
        if (line.trim() === '') return <div key={i} className="h-1" />
        const isBullet = line.trimStart().startsWith('•')
        const content = isBullet ? line.trimStart().slice(1).trim() : line
        const parts = content.split(/(\*\*[^*]+\*\*)/g)
        return (
          <p
            key={i}
            className={cn(
              'text-[13px] leading-relaxed text-fg-muted',
              isBullet && 'pl-3.5 -indent-3.5',
            )}
          >
            {isBullet && <span className="text-accent-400">• </span>}
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**') ? (
                <strong key={j} className="font-semibold text-fg">{part.slice(2, -2)}</strong>
              ) : (
                <span key={j}>{part}</span>
              ),
            )}
          </p>
        )
      })}
    </div>
  )
}

export function AssistantPage() {
  const { data, assistant, playerById } = useData()
  const { settings } = useSettings()

  const [question, setQuestion] = useState('')
  const [answers, setAnswers] = useState<AssistantAnswer[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Guarded: jsdom and some embedded contexts do not implement scrollIntoView.
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }, [answers, busy])

  const ask = async (q: string) => {
    if (!assistant || !q.trim()) return
    setBusy(true)
    setError(null)
    try {
      const answer = await assistant.answer(q.trim())
      setAnswers((prev) => [...prev, answer])
      setQuestion('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The assistant failed to answer.')
    } finally {
      setBusy(false)
    }
  }

  const citationLink = (refType: string, refId: string) => {
    switch (refType) {
      case 'player': return `/players/${refId}`
      case 'match': return `/matches/${refId}`
      case 'scenario': return `/tactical-lab?scenario=${refId}`
      default: return '/analysis'
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI research assistant"
        description="Ask research questions about players, phases and evidence. The assistant answers from retrieved application data and cites records — it never invents statistics, matches or video observations."
      />

      {!data || !assistant ? (
        <EmptyState
          icon={Bot}
          title="No data foundation available"
          description={
            settings.demoMode
              ? 'Data is loading or unavailable.'
              : 'The assistant grounds every answer in application data. Demo data is disabled and no real source is connected, so there is nothing to retrieve from. Enable demo data in Settings.'
          }
          showSettingsAction={!settings.demoMode}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <InfoNote variant="warning" title="Demonstration provider — not a live AI">
              This build uses a deterministic mock provider. Answers are template-generated from real
              (demo-dataset) records so you can evaluate the interaction pattern. No AI API is connected in
              Phase 1, and nothing here should be read as a live AI integration. Provider keys will remain
              server-side when a real provider is connected.
            </InfoNote>

            {/* Conversation */}
            <Card>
              <CardContent className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
                {answers.length === 0 && (
                  <div className="py-8 text-center">
                    <Sparkles className="mx-auto mb-2 h-6 w-6 text-accent-400/70" aria-hidden />
                    <p className="text-sm font-medium text-fg">Ask a research question</p>
                    <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-fg-muted">
                      e.g. "How does [player] perform during build-up?", "Which same-league players have a
                      similar statistical profile?", "What are the main limitations of the available evidence?"
                    </p>
                  </div>
                )}

                {answers.map((answer) => (
                  <div key={answer.id} className="space-y-2">
                    <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm border border-line-strong bg-ink-700/60 px-3 py-2">
                      <p className="text-[13px] text-fg">{answer.question}</p>
                    </div>
                    <div className="max-w-[92%] rounded-lg rounded-bl-sm panel-border bg-ink-850 p-3.5">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Bot className="h-3.5 w-3.5 text-accent-400" aria-hidden />
                        <Badge variant="warning" className="font-mono">MOCK · DEMONSTRATION</Badge>
                        <span className="text-[10px] text-fg-faint">{fmtDateTime(answer.createdAt)}</span>
                      </div>
                      <AnswerBody text={answer.body} />
                      {answer.citations.length > 0 && (
                        <div className="mt-3 border-t border-line pt-2">
                          <p className="text-label mb-1">Cited records</p>
                          <div className="flex flex-wrap gap-1.5">
                            {answer.citations.map((c, i) => (
                              <Link
                                key={`${answer.id}-c${i}`}
                                to={citationLink(c.refType, c.refId)}
                                className="rounded border border-info/30 bg-info/10 px-2 py-1 text-[10px] text-info hover:bg-info/20"
                              >
                                ↗ {c.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      <ul className="mt-3 space-y-0.5 border-t border-line pt-2">
                        {answer.limitations.map((lim, i) => (
                          <li key={i} className="text-[10px] leading-snug text-fg-faint">· {lim}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}

                {busy && (
                  <p className="text-xs text-fg-faint" role="status">Retrieving data and composing an answer…</p>
                )}
                {error && (
                  <p role="alert" className="rounded-md border border-negative/40 bg-negative/10 p-2 text-xs text-negative">
                    {error}
                  </p>
                )}
                <div ref={bottomRef} />
              </CardContent>
            </Card>

            {/* Input */}
            <div className="flex gap-2">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void ask(question)
                  }
                }}
                placeholder="Ask about a player's build-up play, similar profiles, supporting evidence, data limitations…"
                className="min-h-[52px]"
                aria-label="Research question"
              />
              <Button onClick={() => void ask(question)} disabled={busy || !question.trim()} className="self-end">
                <Send className="h-4 w-4" aria-hidden />
                Ask
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-label mb-2">Try asking</p>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void ask(s)}
                      disabled={busy}
                      className="w-full rounded-md panel-border bg-ink-900/60 p-2.5 text-left text-[11px] leading-snug text-fg-muted transition-colors hover:border-line-strong hover:text-fg disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-fg-faint">
                  Suggested questions reference real demo-dataset players: the top scorer is{' '}
                  <span className="text-fg-muted">
                    {[...data.dataset.players].sort((a, b) => b.stats.goals - a.stats.goals)[0]?.name}
                  </span>{' '}
                  and the top creator is{' '}
                  <span className="text-fg-muted">
                    {playerById([...data.dataset.players].sort((a, b) => b.stats.assists - a.stats.assists)[0]?.id ?? '')?.name}
                  </span>.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-label mb-2">Provider</p>
                <p className="text-xs font-medium text-fg">Deterministic mock</p>
                <p className="mt-1 text-[10px] leading-relaxed text-fg-faint">
                  {assistant.isMock
                    ? 'Answers are computed by rule-based retrieval over application data. A real provider (LLM with retrieval) will be connected through the backend, with keys stored server-side and every answer still grounded in cited records.'
                    : 'Live provider.'}
                </p>
                <ul className="mt-2 space-y-1 text-[10px] text-fg-faint">
                  <li>· Uses retrieved data as its factual foundation</li>
                  <li>· Distinguishes measured statistics from interpretation</li>
                  <li>· States when data is unavailable</li>
                  <li>· Never claims video analysis</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
