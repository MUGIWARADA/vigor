import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookmarkPlus, Flag, MessagesSquare, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label, Textarea } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { InfoNote } from '@/components/shared/info-note'
import { ProvenanceBadge } from '@/components/shared/provenance'
import { PlayerAvatar, PositionBadge } from '@/components/shared/player-bits'
import { newId, savedResearchStore, useStore } from '@/lib/store'
import { useData } from '@/state/data'
import { useSettings } from '@/state/settings'
import type { DiscussionKind, DiscussionPost, DiscussionReply } from '@/types'
import { fmtDateTime } from '@/lib/utils'

const KIND_LABELS: Record<DiscussionKind, string> = {
  question: 'Question',
  observation: 'Tactical observation',
  comparison: 'Statistical comparison',
}

/* ------------------------------------------------------------------ */
/* Rooms list                                                          */
/* ------------------------------------------------------------------ */

export function DiscussionsPage() {
  const { data, playerById } = useData()
  const { settings } = useSettings()
  const saved = useStore(savedResearchStore)

  const rooms = useMemo(() => {
    const posts = data?.content.discussions ?? []
    const byPlayer = new Map<string, { posts: number; lastAt: string }>()
    for (const p of posts) {
      const entry = byPlayer.get(p.playerId) ?? { posts: 0, lastAt: p.publishedAt }
      entry.posts += 1 + p.replies.length
      if (p.publishedAt > entry.lastAt) entry.lastAt = p.publishedAt
      for (const r of p.replies) if (r.publishedAt > entry.lastAt) entry.lastAt = r.publishedAt
      byPlayer.set(p.playerId, entry)
    }
    return [...byPlayer.entries()]
      .map(([playerId, info]) => ({ player: playerById(playerId), info }))
      .filter((x): x is { player: NonNullable<ReturnType<typeof playerById>>; info: { posts: number; lastAt: string } } => !!x.player)
      .sort((a, b) => b.info.lastAt.localeCompare(a.info.lastAt))
  }, [data, playerById])

  const savedPosts = useMemo(() => {
    const posts = data?.content.discussions ?? []
    return saved
      .map((s) => ({ item: s, post: posts.find((p) => p.id === s.postId) }))
      .filter((x): x is { item: (typeof saved)[number]; post: DiscussionPost } => !!x.post)
      .sort((a, b) => b.item.savedAt.localeCompare(a.item.savedAt))
  }, [data, saved])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Player discussion rooms"
        description="One research room per player: questions, tactical observations and statistical comparisons that link back to profiles, metrics, matches and Tactical Lab scenarios."
      />

      {!data ? (
        <EmptyState
          icon={MessagesSquare}
          title="No discussions available"
          description={
            settings.demoMode
              ? 'Data is loading or unavailable.'
              : 'Demo data is disabled. Discussion posts need either demo data or authenticated users with the backend (Phase 2).'
          }
          showSettingsAction={!settings.demoMode}
        />
      ) : (
        <Tabs defaultValue="rooms">
          <TabsList>
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="saved">Saved research ({savedPosts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="rooms">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rooms.map(({ player, info }) => (
                <Card key={player.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar name={player.name} position={player.position} />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/discussions/${player.id}`}
                          className="text-[14px] font-semibold text-fg hover:text-accent-300"
                        >
                          {player.name}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <PositionBadge position={player.position} />
                          <span className="text-[10px] text-fg-faint">{info.posts} posts</span>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-fg-faint">Last activity {fmtDateTime(info.lastAt)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <InfoNote variant="scope" title="Authentication status">
              Posts shown are demo records with fictional authors. Real accounts, identity, server-side
              permission checks and moderation arrive with the Spring Boot backend (Phase 2+). Reporting
              flags content locally in this build.
            </InfoNote>
          </TabsContent>

          <TabsContent value="saved">
            {savedPosts.length === 0 ? (
              <EmptyState
                title="No saved research yet"
                description="Bookmark posts from any discussion room — saved items are stored locally in your browser."
              />
            ) : (
              <div className="space-y-3">
                {savedPosts.map(({ item, post }) => (
                  <Card key={item.id}>
                    <CardContent className="p-4">
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] text-fg-faint">
                        <Link to={`/discussions/${post.playerId}`} className="text-[11px] font-medium text-accent-300 hover:underline">
                          {playerById(post.playerId)?.name ?? post.playerId} room
                        </Link>
                        <span>· saved {fmtDateTime(item.savedAt)}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-fg-muted">{post.body}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Room                                                                */
/* ------------------------------------------------------------------ */

const MIN_BODY_LENGTH = 10

export function DiscussionRoomPage() {
  const { playerId } = useParams<{ playerId: string }>()
  const { data, playerById } = useData()
  const { settings } = useSettings()
  const saved = useStore(savedResearchStore)

  const [kind, setKind] = useState<DiscussionKind>('observation')
  const [body, setBody] = useState('')
  const [bodyError, setBodyError] = useState<string | null>(null)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replyErrors, setReplyErrors] = useState<Record<string, string>>({})
  const [reported, setReported] = useState<Record<string, boolean>>({})
  const [localPosts, setLocalPosts] = useState<DiscussionPost[]>([])
  /** Replies authored in this session, keyed by post id (works for demo posts too). */
  const [localReplies, setLocalReplies] = useState<Record<string, DiscussionReply[]>>({})
  const [notice, setNotice] = useState<string | null>(null)

  const player = playerId ? playerById(playerId) : undefined

  if (!data || !player) {
    return (
      <div className="space-y-5">
        <PageHeader title="Discussion room" />
        <EmptyState
          icon={MessagesSquare}
          title="Room not found or data unavailable"
          description={
            settings.demoMode
              ? 'This player has no discussion room in the loaded dataset.'
              : 'Demo data is disabled and no user-generated content platform is connected.'
          }
          showSettingsAction={!settings.demoMode}
        />
      </div>
    )
  }

  /** Merge session-authored replies into a post (demo or local). */
  const withLocalReplies = (p: DiscussionPost): DiscussionPost => {
    const extra = localReplies[p.id]
    return extra && extra.length > 0 ? { ...p, replies: [...p.replies, ...extra] } : p
  }

  // localPosts are filtered to this room — the route reuses the component when
  // the playerId param changes, so unfiltered state would leak across rooms.
  const posts = [
    ...localPosts.filter((p) => p.playerId === player.id).map(withLocalReplies),
    ...(data.content.discussions.filter((p) => p.playerId === player.id) ?? []).map(withLocalReplies),
  ].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  const validate = (text: string): string | null =>
    text.trim().length < MIN_BODY_LENGTH
      ? `Please write at least ${MIN_BODY_LENGTH} characters — research posts should carry substance.`
      : text.trim().length > 4000
        ? 'Posts are limited to 4000 characters.'
        : null

  const submitPost = () => {
    const error = validate(body)
    setBodyError(error)
    if (error) return
    const post: DiscussionPost = {
      id: newId('post'),
      playerId: player.id,
      kind,
      author: 'local_analyst (you)',
      authorBadge: 'Local user (Phase 1)',
      publishedAt: new Date().toISOString(),
      body: body.trim(),
      replies: [],
      provenance: 'MANUAL',
    }
    setLocalPosts((prev) => [post, ...prev])
    setBody('')
    setNotice('Post published locally. In Phase 2+ it will be sent to the API with authentication and server-side validation.')
  }

  const submitReply = (postId: string) => {
    const draft = replyDrafts[postId] ?? ''
    const error = validate(draft)
    setReplyErrors((prev) => ({ ...prev, [postId]: error ?? '' }))
    if (error) return
    const reply: DiscussionReply = {
      id: newId('reply'),
      author: 'local_analyst (you)',
      publishedAt: new Date().toISOString(),
      body: draft.trim(),
      provenance: 'MANUAL',
    }
    // Keyed by post id, so replies attach to demo posts as well as local ones.
    setLocalReplies((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), reply] }))
    setReplyDrafts((prev) => ({ ...prev, [postId]: '' }))
  }

  const isSaved = (postId: string) => saved.some((s) => s.postId === postId)

  const renderLink = (post: DiscussionPost) => {
    if (!post.link) return null
    const { type, targetId, label } = post.link
    const to =
      type === 'player'
        ? `/players/${targetId}`
        : type === 'match'
          ? `/matches/${targetId}`
          : type === 'scenario'
            ? `/tactical-lab?scenario=${targetId}`
            : '/analysis'
    return (
      <Link
        to={to}
        className="rounded border border-info/30 bg-info/10 px-2 py-1 text-[10px] font-medium text-info hover:bg-info/20"
      >
        ↗ {label}
      </Link>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${player.name} — research room`}
        description="Tactical observations, questions and comparisons. Posts can link to the player's profile, specific metrics, matches or Tactical Lab scenarios."
      />

      {/* New post */}
      <Card>
        <CardHeader>
          <CardTitle>Start a discussion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex w-56 flex-col gap-1">
            <Label htmlFor="dr-kind">Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as DiscussionKind)}>
              <SelectTrigger id="dr-kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABELS) as DiscussionKind[]).map((k) => (
                  <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="dr-body">Your post</Label>
            <Textarea
              id="dr-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`Ask a question about ${player.name}, share a tactical observation, or post a statistical comparison…`}
              aria-invalid={!!bodyError}
              aria-describedby={bodyError ? 'dr-body-error' : undefined}
            />
            {bodyError && (
              <p id="dr-body-error" role="alert" className="text-[11px] text-negative">
                {bodyError}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={submitPost}>
              <Send className="h-3.5 w-3.5" aria-hidden />
              Publish
            </Button>
            <span className="text-[10px] text-fg-faint">
              Stored locally in this build (MANUAL) — server-side accounts arrive in Phase 2.
            </span>
          </div>
          {notice && (
            <p role="status" className="rounded-md border border-positive/30 bg-positive/10 p-2 text-[11px] text-positive">
              {notice}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Posts */}
      {posts.length === 0 ? (
        <EmptyState title="No posts yet" description="Be the first to start this discussion." />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default" className="normal-case">{KIND_LABELS[post.kind]}</Badge>
                  <span className="text-xs font-semibold text-fg">{post.author}</span>
                  {post.authorBadge && <span className="text-[10px] text-fg-faint">({post.authorBadge})</span>}
                  <span className="text-[10px] text-fg-faint">{fmtDateTime(post.publishedAt)}</span>
                  <ProvenanceBadge provenance={post.provenance} />
                  <span className="ml-auto flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={isSaved(post.id) ? 'Saved' : 'Save post to research'}
                      title={isSaved(post.id) ? 'Saved' : 'Save to research'}
                      onClick={() =>
                        savedResearchStore.set((prev) =>
                          isSaved(post.id)
                            ? prev.filter((s) => s.postId !== post.id)
                            : [...prev, { id: newId('sr'), postId: post.id, playerId: post.playerId, savedAt: new Date().toISOString() }],
                        )
                      }
                    >
                      <BookmarkPlus className={isSaved(post.id) ? 'h-3.5 w-3.5 text-accent-400' : 'h-3.5 w-3.5'} aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Report post"
                      title="Report inappropriate content"
                      onClick={() => setReported((prev) => ({ ...prev, [post.id]: true }))}
                    >
                      <Flag className={reported[post.id] ? 'h-3.5 w-3.5 text-warning' : 'h-3.5 w-3.5'} aria-hidden />
                    </Button>
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-fg-muted">{post.body}</p>
                {post.link && <div className="mt-2">{renderLink(post)}</div>}
                {reported[post.id] && (
                  <p className="mt-2 rounded bg-warning/10 p-1.5 text-[10px] text-warning">
                    Reported — pending moderation. (Local flag in Phase 1; real moderation queues arrive with the backend.)
                  </p>
                )}

                {/* Replies */}
                {post.replies.length > 0 && (
                  <div className="mt-3 space-y-2 border-l-2 border-line pl-3">
                    {post.replies.map((reply) => (
                      <div key={reply.id}>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-fg">{reply.author}</span>
                          <span className="text-[10px] text-fg-faint">{fmtDateTime(reply.publishedAt)}</span>
                          <ProvenanceBadge provenance={reply.provenance} compact />
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{reply.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply form */}
                <div className="mt-3 flex flex-col gap-1.5">
                  <div className="flex gap-2">
                    <Textarea
                      value={replyDrafts[post.id] ?? ''}
                      onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                      placeholder="Reply with evidence or a counter-observation…"
                      className="min-h-[52px] text-xs"
                      aria-label={`Reply to ${post.author}`}
                      aria-invalid={!!replyErrors[post.id]}
                    />
                    <Button variant="secondary" size="sm" className="self-end" onClick={() => submitReply(post.id)}>
                      Reply
                    </Button>
                  </div>
                  {replyErrors[post.id] && (
                    <p role="alert" className="text-[11px] text-negative">{replyErrors[post.id]}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
