import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ClipboardCopy,
  Download,
  Gamepad2,
  GraduationCap,
  Pause,
  Play,
  RotateCcw,
  Save,
  Square,
  Star,
  Trophy,
  Upload,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { PageHeader, SectionLabel } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input, Textarea } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useStore } from '@/lib/store'
import { PITCH_TEMPLATES, type PitchTemplate } from '@/components/pitch/Pitch'
import { GameplaySliders } from '@/game/GameplaySliders'
import { MatchPlanEditor } from '@/game/MatchPlanEditor'
import { MatchStage } from '@/game/MatchStage'
import { PostMatchReport } from '@/game/PostMatchReport'
import { TeamRatings } from '@/game/TeamRatings'
import {
  GAME_TEAMS,
  createDefaultPlan,
  decodePlan,
  encodePlan,
  getPlayer,
  getTeam,
  normalizeGameplaySettings,
  normalizeRatingOverrides,
  type TeamId,
  type TeamPlan,
} from '@/game/data'
import {
  applySubstitution,
  clockLabel,
  createMatch,
  matchMinute,
  playerRating,
  restartSetupComplete,
  restartTakerReady,
  resumeSecondHalf,
  shapeMetrics,
  simulateMatch,
  stepMatch,
  type Difficulty,
  type MatchState,
  type PlayerInput,
  type RulesProfile,
} from '@/game/engine'
import { CIRCLE_SCHEMES, DEFAULT_CIRCLE_SCHEME } from '@/game/circles'
import { attachKeyboardInput, connectedGamepads, readInputs, type InputDevice, type InputMapping } from '@/game/input'
import {
  awardTrainingBadge,
  gamePlansStore,
  gameRecordsStore,
  gameplaySettingsStore,
  gamePitchTemplateStore,
  gameCircleSchemeStore,
  gameRatingOverridesStore,
  lastGamePlansStore,
  recordHumanResult,
} from '@/game/storage'

type PlayMode = 'pvai' | 'pvp' | 'watch'

interface ActiveContext {
  mode: PlayMode
  humanTeam: TeamId | null
  trainingId: string | null
}

const MATCH_LENGTHS: Record<string, { label: string; halfSeconds: number }> = {
  quick: { label: 'Quick — 2 × 4 min', halfSeconds: 240 },
  standard: { label: 'Standard — 2 × 6 min', halfSeconds: 360 },
  long: { label: 'Long — 2 × 8 min', halfSeconds: 480 },
  real: { label: 'Real Like Football — 2 × 10 min', halfSeconds: 600 },
}

const TRAINING_DRILLS = [
  { id: 'first-touch', title: 'First Touch / Passing', objective: 'Complete 12 passes in a quick Easy match.', check: (s: MatchState, team: TeamId) => s.stats[team].completedPasses >= 12 },
  { id: 'moving-ball', title: 'Moving the BallState', objective: 'Attempt 25 passes and keep the team moving.', check: (s: MatchState, team: TeamId) => s.stats[team].passes >= 25 },
  { id: 'scoring', title: 'Scoring', objective: 'Score a goal.', check: (s: MatchState, team: TeamId) => s.score[team] >= 1 },
  { id: 'defending', title: 'Defending', objective: 'Win 4 tackles.', check: (s: MatchState, team: TeamId) => s.stats[team].tackles >= 4 },
  { id: 'set-pieces', title: 'Set Pieces', objective: 'Win a corner and deliver it with Circle/B or L.', check: (s: MatchState, team: TeamId) => s.stats[team].corners >= 1 },
  { id: 'match-iq', title: 'Match IQ', objective: 'Make a substitution during the match.', check: (s: MatchState, team: TeamId) => s.substitutions[team].used >= 1 },
]

function NativeSelect({ label, value, onChange, children, id }: {
  label: string
  value: string
  id: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-fg-muted">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full min-w-0 rounded-md border border-line-strong bg-ink-900 px-2 text-sm text-fg outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30">
        {children}
      </select>
    </label>
  )
}

function neutralEdges(inputs: Partial<Record<TeamId, PlayerInput>>): Partial<Record<TeamId, PlayerInput>> {
  const out: Partial<Record<TeamId, PlayerInput>> = {}
  for (const [team, input] of Object.entries(inputs) as Array<[TeamId, PlayerInput]>) {
    out[team] = { ...input, pass: false, through: false, cross: false, shoot: false, tackle: false, knockAhead: false, switchPlayer: false, sendRun: false, callSupport: false, lineStep: false, lineDrop: false }
  }
  return out
}

const otherTeam = (team: TeamId): TeamId => team === 'bracelonia' ? 'banyarn' : 'bracelonia'

function TeamStatRows({ state }: { state: MatchState }) {
  const home = state.stats.bracelonia
  const away = state.stats.banyarn
  const totalPossession = home.possessionSeconds + away.possessionSeconds
  const rows: Array<[string, string | number, string | number]> = [
    ['Possession', `${totalPossession ? Math.round((home.possessionSeconds / totalPossession) * 100) : 50}%`, `${totalPossession ? Math.round((away.possessionSeconds / totalPossession) * 100) : 50}%`],
    ['xG', home.xg.toFixed(2), away.xg.toFixed(2)],
    ['Shots (on target)', `${home.shots} (${home.shotsOnTarget})`, `${away.shots} (${away.shotsOnTarget})`],
    ['Passes completed', `${home.completedPasses}/${home.passes}`, `${away.completedPasses}/${away.passes}`],
    ['Corners', home.corners, away.corners],
    ['Saves', home.saves, away.saves],
    ['Fouls', home.fouls, away.fouls],
    ['Offsides', home.offsides, away.offsides],
    ['Tackles won', home.tackles, away.tackles],
  ]
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Metric</TableHead><TableHead>BRA</TableHead><TableHead>BAM</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map(([label, h, a]) => <TableRow key={label}><TableCell>{label}</TableCell><TableCell className="text-metric">{h}</TableCell><TableCell className="text-metric">{a}</TableCell></TableRow>)}</TableBody>
    </Table>
  )
}

export function GameModePage() {
  const records = useStore(gameRecordsStore)
  const storedGameplaySettings = useStore(gameplaySettingsStore)
  const gameplaySettings = useMemo(() => normalizeGameplaySettings(storedGameplaySettings), [storedGameplaySettings])
  const storedPitchTemplate = useStore(gamePitchTemplateStore)
  const pitchTemplate: PitchTemplate = PITCH_TEMPLATES.some((t) => t.id === storedPitchTemplate)
    ? storedPitchTemplate as PitchTemplate
    : 'volt-turf'
  const storedCircleScheme = useStore(gameCircleSchemeStore)
  const circleSchemeId = CIRCLE_SCHEMES.some((s) => s.id === storedCircleScheme) ? storedCircleScheme : DEFAULT_CIRCLE_SCHEME
  const storedRatingOverrides = useStore(gameRatingOverridesStore)
  const ratingOverrides = useMemo(() => normalizeRatingOverrides(storedRatingOverrides), [storedRatingOverrides])
  const savedPlans = useStore(gamePlansStore)
  const [homePlan, setHomePlan] = useState<TeamPlan>(() => lastGamePlansStore.get().bracelonia ?? createDefaultPlan('bracelonia'))
  const [awayPlan, setAwayPlan] = useState<TeamPlan>(() => lastGamePlansStore.get().banyarn ?? createDefaultPlan('banyarn'))
  const [planTeam, setPlanTeam] = useState<TeamId>('bracelonia')
  const [activeTab, setActiveTab] = useState('play')
  const [playMode, setPlayMode] = useState<PlayMode>('pvai')
  const [selectedSide, setSelectedSide] = useState<TeamId>('bracelonia')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [rules, setRules] = useState<RulesProfile>('standard')
  const [matchLength, setMatchLength] = useState('standard')
  const [inputDevice, setInputDevice] = useState<InputDevice>('both')
  const [match, setMatch] = useState<MatchState | null>(null)
  const [, setFrame] = useState(0)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [soundOn, setSoundOn] = useState(true)
  const [showOffsideLine, setShowOffsideLine] = useState(true)
  // The shape overlay is the same measurement the post-match panel draws, live:
  // unit lines, block extent and the ground behind the deepest average position.
  const [showShape, setShowShape] = useState(false)
  const [shapeTeam, setShapeTeam] = useState<TeamId>('bracelonia')
  const [pads, setPads] = useState<string[]>([])
  const [activeContext, setActiveContext] = useState<ActiveContext>({ mode: 'pvai', humanTeam: 'bracelonia', trainingId: null })
  const [importCode, setImportCode] = useState('')
  const [shareMessage, setShareMessage] = useState('')
  const [testResults, setTestResults] = useState<MatchState[]>([])
  const [subTeam, setSubTeam] = useState<TeamId>('bracelonia')
  const [subOut, setSubOut] = useState('')
  const [subIn, setSubIn] = useState('')

  const matchRef = useRef<MatchState | null>(null)
  const pausedRef = useRef(false)
  const speedRef = useRef(1)
  const soundRef = useRef(true)
  const mappingRef = useRef<InputMapping>({ home: 'both', away: 'none' })
  const contextRef = useRef<ActiveContext>(activeContext)
  const previousGoalsRef = useRef(0)
  const audioRef = useRef<AudioContext | null>(null)

  const currentPlan = planTeam === 'bracelonia' ? homePlan : awayPlan
  const exportCode = useMemo(() => encodePlan(currentPlan), [currentPlan])

  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { speedRef.current = speed }, [speed])
  useEffect(() => { soundRef.current = soundOn }, [soundOn])
  useEffect(() => attachKeyboardInput(), [])
  useEffect(() => {
    const update = () => setPads(connectedGamepads())
    update()
    const id = window.setInterval(update, 1500)
    return () => window.clearInterval(id)
  }, [])

  const playSound = useCallback((kind: 'whistle' | 'goal') => {
    if (!soundRef.current || typeof window === 'undefined') return
    try {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtor) return
      audioRef.current ??= new AudioCtor()
      const ctx = audioRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      if (kind === 'whistle') {
        osc.type = 'square'
        osc.frequency.value = 2150
        gain.gain.setValueAtTime(0.035, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
        osc.start()
        osc.stop(ctx.currentTime + 0.24)
      } else {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(523, ctx.currentTime)
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.14)
        gain.gain.setValueAtTime(0.055, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42)
        osc.start()
        osc.stop(ctx.currentTime + 0.44)
      }
    } catch {
      // Sound is an enhancement only; gameplay never depends on it.
    }
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now
      const state = matchRef.current
      if (!state || pausedRef.current) return
      const inputs = readInputs(mappingRef.current)
      const steps = Math.max(1, Math.round(speedRef.current))
      for (let i = 0; i < steps; i++) stepMatch(state, i === 0 ? inputs : neutralEdges(inputs), dt)
      const goals = state.score.bracelonia + state.score.banyarn
      if (goals !== previousGoalsRef.current) {
        previousGoalsRef.current = goals
        playSound('goal')
      }
      const ctx = contextRef.current
      if (ctx.trainingId && ctx.humanTeam) {
        const drill = TRAINING_DRILLS.find((d) => d.id === ctx.trainingId)
        if (drill?.check(state, ctx.humanTeam)) awardTrainingBadge(drill.id)
      }
      if (state.phase === 'fulltime' && !state.resultRecorded) {
        state.resultRecorded = true
        playSound('whistle')
        if (ctx.mode === 'pvai' && ctx.humanTeam && !ctx.trainingId) {
          recordHumanResult(state.score[ctx.humanTeam], state.score[otherTeam(ctx.humanTeam)])
        }
      }
      setFrame((f) => f + 1)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playSound])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (!matchRef.current) return
      if (event.code === 'Escape' || event.code === 'KeyP') setPaused((p) => !p)
      if (event.code === 'KeyM') setPaused(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const updatePlan = (plan: TeamPlan) => {
    if (plan.teamId === 'bracelonia') setHomePlan(plan)
    else setAwayPlan(plan)
    lastGamePlansStore.set((prev) => ({ ...prev, [plan.teamId]: plan }))
  }

  const startMatch = (mode: PlayMode = playMode, trainingId: string | null = null) => {
    const humanTeam: TeamId | null = mode === 'watch' ? null : mode === 'pvai' ? selectedSide : null
    const humanTeams: TeamId[] = mode === 'pvp' ? ['bracelonia', 'banyarn'] : humanTeam ? [humanTeam] : []
    const mapping: InputMapping = mode === 'pvp'
      ? (inputDevice === 'gamepad0' ? { home: 'gamepad0', away: 'gamepad1' } : { home: 'keyboard', away: 'gamepad0' })
      : {
          home: humanTeam === 'bracelonia' ? inputDevice : 'none',
          away: humanTeam === 'banyarn' ? inputDevice : 'none',
        }
    mappingRef.current = mapping
    const ctx: ActiveContext = { mode, humanTeam: mode === 'pvp' ? null : humanTeam, trainingId }
    contextRef.current = ctx
    setActiveContext(ctx)
    setSubTeam(humanTeam ?? 'bracelonia')
    previousGoalsRef.current = 0
    const state = createMatch({
      homePlan: structuredClone(homePlan),
      awayPlan: structuredClone(awayPlan),
      difficulty: trainingId ? 'easy' : difficulty,
      rules,
      halfSeconds: trainingId ? 240 : MATCH_LENGTHS[matchLength]!.halfSeconds,
      humanTeams,
      mode: trainingId ? 'training' : mode === 'watch' ? 'watch' : 'match',
      gameplay: structuredClone(gameplaySettings),
      ratingOverrides: structuredClone(ratingOverrides),
      seed: Date.now() % 2147483647,
    })
    matchRef.current = state
    setMatch(state)
    setPaused(false)
    setSpeed(1)
    setActiveTab('play')
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    playSound('whistle')
  }

  const endMatch = () => {
    matchRef.current = null
    setMatch(null)
    setPaused(false)
  }

  const saveCurrentPlan = () => {
    gamePlansStore.set((prev) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, savedAt: new Date().toISOString(), plan: structuredClone(currentPlan) }, ...prev])
    setShareMessage('Match Plan saved locally.')
  }

  const importPlan = () => {
    const decoded = decodePlan(importCode)
    if (!decoded) {
      setShareMessage('That code could not be read. Paste a complete Vigor Match Plan code.')
      return
    }
    updatePlan(decoded)
    setPlanTeam(decoded.teamId)
    setShareMessage(`${getTeam(decoded.teamId).name} Match Plan imported.`)
  }

  const runTestBench = (count: number) => {
    const results: MatchState[] = []
    for (let i = 0; i < count; i++) {
      results.push(simulateMatch({
        homePlan: structuredClone(homePlan),
        awayPlan: structuredClone(awayPlan),
        difficulty,
        rules,
        halfSeconds: 48,
        humanTeams: [],
        mode: 'watch',
        gameplay: structuredClone(gameplaySettings),
        ratingOverrides: structuredClone(ratingOverrides),
        seed: 1000 + i * 7919,
      }, 96, 0.05))
    }
    setTestResults(results)
  }

  const applyOrQueueSub = () => {
    if (!match) return
    const outId = subOut || match.players.find((p) => p.teamId === subTeam && p.onPitch)?.id
    const inId = subIn || match.players.find((p) => p.teamId === subTeam && !p.onPitch && !p.sentOff)?.id
    if (!outId || !inId) return
    if (match.phase === 'restart' || match.phase === 'halftime') {
      applySubstitution(match, subTeam, outId, inId, match.phase !== 'halftime')
    } else if (!match.pendingSubs.some((s) => s.outId === outId || s.inId === inId)) {
      match.pendingSubs.push({ teamId: subTeam, outId, inId })
    }
    setFrame((f) => f + 1)
  }

  const adjustLiveSlider = (teamId: TeamId, key: keyof TeamPlan['sliders'], delta: number) => {
    if (!match) return
    const plan = teamId === 'bracelonia' ? match.config.homePlan : match.config.awayPlan
    plan.sliders[key] = Math.min(100, Math.max(0, plan.sliders[key] + delta))
    setFrame((f) => f + 1)
  }

  const humanTeamsInMatch = match?.config.humanTeams ?? []
  const subOutOptions = match ? match.players.filter((p) => p.teamId === subTeam && p.onPitch && !p.sentOff) : []
  const subInOptions = match ? match.players.filter((p) => p.teamId === subTeam && !p.onPitch && !p.sentOff) : []
  const effectiveSubOut = subOutOptions.some((p) => p.id === subOut) ? subOut : (subOutOptions[0]?.id ?? '')
  const effectiveSubIn = subInOptions.some((p) => p.id === subIn) ? subIn : (subInOptions[0]?.id ?? '')
  const sortedRatings = match ? [...match.players].filter((p) => p.samples > 0 || p.touches > 0).sort((a, b) => playerRating(b) - playerRating(a)) : []
  const activeDrill = TRAINING_DRILLS.find((d) => d.id === activeContext.trainingId)

  return (
    <div>
      <PageHeader
        title="Game Mode"
        description="A full-pitch 11v11 Community game built inside Vigor: PES PS2-style attributes and Match Plans, keyboard/controller parity, offside on, and only the BallState carrier named live."
        actions={(
          <>
            <Badge variant="accent"><Trophy className="size-3" /> Local record {records.wins}W · {records.draws}D · {records.losses}L</Badge>
            <Button type="button" size="sm" variant="outline" onClick={() => setSoundOn((s) => !s)}>{soundOn ? <Volume2 /> : <VolumeX />}{soundOn ? 'Sound on' : 'Muted'}</Button>
          </>
        )}
      />

      <div className="mb-4 rounded-lg panel-border bg-ink-900 px-3 py-2 text-xs leading-relaxed text-fg-muted">
        <strong className="text-fg">Fictional game content:</strong> Bracelonia and Banyarn Munic exist only in Community Game Mode. Their attributes are original game-balance conversions from observable playing profiles, never copied ratings and never part of the real/demo football database.
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="play"><Gamepad2 className="size-3.5" /> Play</TabsTrigger>
          <TabsTrigger value="plan"><Users className="size-3.5" /> Match Plan</TabsTrigger>
          <TabsTrigger value="ratings"><Star className="size-3.5" /> Ratings</TabsTrigger>
          <TabsTrigger value="training"><GraduationCap className="size-3.5" /> Training Ground</TabsTrigger>
          <TabsTrigger value="bench"><Play className="size-3.5" /> Watch AI / Test Bench</TabsTrigger>
        </TabsList>

        <TabsContent value="play">
          {!match ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <div className="space-y-4">
                <Card>
                  <CardHeader><CardTitle>Match setup</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <NativeSelect id="game-mode-play-mode" label="Mode" value={playMode} onChange={(v) => setPlayMode(v as PlayMode)}>
                        <option value="pvai">Player vs AI</option>
                        <option value="pvp">Local Player vs Player</option>
                        <option value="watch">Watch AI Match</option>
                      </NativeSelect>
                      {playMode === 'pvai' && (
                        <NativeSelect id="game-mode-side" label="Your team" value={selectedSide} onChange={(v) => setSelectedSide(v as TeamId)}>
                          {GAME_TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </NativeSelect>
                      )}
                      <NativeSelect id="game-mode-difficulty" label="Difficulty" value={difficulty} onChange={(v) => setDifficulty(v as Difficulty)}>
                        <option value="easy">Easy</option>
                        <option value="normal">Normal</option>
                        <option value="hard">Hard</option>
                        <option value="real">Real Like Football</option>
                      </NativeSelect>
                      <NativeSelect id="game-mode-length" label="Match length" value={matchLength} onChange={setMatchLength}>
                        {Object.entries(MATCH_LENGTHS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                      </NativeSelect>
                      <NativeSelect id="game-mode-rules" label="Rules profile" value={rules} onChange={(v) => setRules(v as RulesProfile)}>
                        <option value="arcade">Arcade — forgiving</option>
                        <option value="standard">Standard — playable Laws</option>
                        <option value="current">Current Laws profile</option>
                      </NativeSelect>
                      <NativeSelect id="game-mode-input" label="Human input" value={inputDevice} onChange={(v) => setInputDevice(v as InputDevice)}>
                        <option value="both">Keyboard + controller (hot-swap)</option>
                        <option value="keyboard">Keyboard</option>
                        <option value="gamepad0">Controller 1</option>
                        <option value="gamepad1">Controller 2</option>
                      </NativeSelect>
                      <NativeSelect id="game-mode-pitch-template" label="Pitch template" value={pitchTemplate} onChange={(v) => gamePitchTemplateStore.set(v)}>
                        {PITCH_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </NativeSelect>
                      <NativeSelect id="game-mode-circle-scheme" label="Player circles" value={circleSchemeId} onChange={(v) => gameCircleSchemeStore.set(v)}>
                        {CIRCLE_SCHEMES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </NativeSelect>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button type="button" onClick={() => startMatch()}><Play /> Kick off</Button>
                      <Button type="button" variant="outline" onClick={() => { setPlanTeam(selectedSide); setActiveTab('plan') }}>Edit Match Plans</Button>
                      <span className="text-xs text-fg-muted">{pads.length ? `Controllers detected: ${pads.join('; ')}` : 'No controller detected yet — keyboard is fully playable.'}</span>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  {GAME_TEAMS.map((team) => {
                    const plan = team.id === 'bracelonia' ? homePlan : awayPlan
                    return (
                      <Card key={team.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between gap-3">
                            <CardTitle>{team.name}</CardTitle>
                            <span className="flex size-9 items-center justify-center rounded-full text-xs font-black" style={{ background: team.color, color: team.textColor }}>{team.shortName}</span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-xs leading-relaxed text-fg-muted">
                            <p><strong className="text-fg">Shape:</strong> {plan.formation} · {plan.name}</p>
                            <p><strong className="text-fg">In possession:</strong> {team.identity.buildUp}</p>
                            <p><strong className="text-fg">Press:</strong> {team.identity.press}</p>
                            <p><strong className="text-fg">Out of possession:</strong> {team.identity.defensiveShape}</p>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <Badge variant="outline">Line {plan.sliders.lineHeight}</Badge>
                            <Badge variant="outline">Press {plan.sliders.pressing}</Badge>
                            <Badge variant="outline">Direct {plan.sliders.directness}</Badge>
                            <Badge variant="outline">Trap {plan.sliders.offsideTrap}</Badge>
                          </div>
                          <div className="mt-3 text-xs text-fg-muted">
                            XI: {plan.slots.map((s) => `#${getPlayer(s.playerId)?.number}`).join(' ')}
                          </div>
                          <Button type="button" size="sm" variant="outline" className="mt-4" onClick={() => { setPlanTeam(team.id); setActiveTab('plan') }}>Plan {team.shortName}</Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                <GameplaySliders value={gameplaySettings} onChange={(next) => gameplaySettingsStore.set(next)} />
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader><CardTitle>Controls</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-xs leading-relaxed text-fg-muted">
                      <p><strong className="text-fg">Keyboard:</strong> WASD move/aftertouch · Shift sprint (hold to push the dribble a little further out; double-tap Shift to knock the BallState well ahead and chase it) · E close control · J pass; without the BallState, hold J to pressure and release to tackle—the longer the hold, the harder the challenge · hold-release K shoot/clear · hold-release L cross/long or charged slide · I through/GK rush · Q switch · Space send a runner · R call support · Z/C line · Esc/P pause · M Match Plan pause.</p>
                      <p><strong className="text-fg">Controller:</strong> Left stick move/aftertouch · R1/RB sprint (double-tap R1/RB to knock the BallState ahead) · R2/RT close control · Cross/A pass; defensively, hold Cross/A to pressure and release to tackle · Square/X shoot/clear · Circle/B cross/long or charged slide · Triangle/Y through/GK rush · L1/LB switch · R3 send run · L3 support.</p>
                      <p><strong className="text-fg">Local PvP:</strong> keyboard vs controller 1, or controller 1 vs controller 2 if Controller 1 is selected above.</p>
                      <p>After shooting or crossing, keep steering to bend the BallState. The ground shadow is the BallState’s true position; the raised BallState and pips show height.</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Your local record</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {([['W', records.wins], ['D', records.draws], ['L', records.losses], ['GF', records.goalsFor]] as const).map(([label, value]) => (
                        <div key={label} className="rounded-md bg-ink-900 px-2 py-3"><div className="text-metric text-xl font-bold text-fg">{value}</div><div className="text-[10px] uppercase tracking-wide text-fg-muted">{label}</div></div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-fg-muted">Only Player vs AI results count. No match history or replay archive is stored in v1.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="text-right"><div className="text-xs font-semibold text-fg">Bracelonia</div><div className="text-[10px] uppercase text-fg-muted">BRA</div></div>
                      <div className="text-metric text-3xl font-black text-fg">{match.score.bracelonia} — {match.score.banyarn}</div>
                      <div><div className="text-xs font-semibold text-fg">Banyarn Munic</div><div className="text-[10px] uppercase text-fg-muted">BAM</div></div>
                    </div>
                    <div className="text-center">
                      <div className="text-metric text-xl font-bold text-accent-300">{clockLabel(match)}</div>
                      <div className="text-[11px] text-fg-muted">
                        {match.phase === 'fulltime' ? 'Full-time' : match.phase === 'halftime' ? 'Half-time' : `${match.half === 1 ? '1st' : '2nd'} half`}
                        {' · '}
                        {match.phase === 'restart' ? 'Clock stopped' : match.message}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {match.phase === 'halftime' ? <Button type="button" size="sm" onClick={() => { resumeSecondHalf(match); playSound('whistle'); setFrame((f) => f + 1) }}><Play /> Second half</Button> : null}
                      {match.phase === 'fulltime' ? <Button type="button" size="sm" onClick={() => startMatch(activeContext.mode, activeContext.trainingId)}><RotateCcw /> Rematch</Button> : (
                        <Button type="button" size="sm" variant="outline" onClick={() => setPaused((p) => !p)}>{paused ? <Play /> : <Pause />}{paused ? 'Resume' : 'Pause'}</Button>
                      )}
                      {activeContext.mode === 'watch' && (
                        <div className="flex gap-1">
                          {[1, 2, 4].map((s) => <Button key={s} type="button" size="sm" variant={speed === s ? 'default' : 'outline'} onClick={() => setSpeed(s)}>{s}×</Button>)}
                        </div>
                      )}
                      <Button type="button" size="sm" variant="ghost" onClick={endMatch}><Square /> Exit</Button>
                    </div>
                  </div>
                  {activeDrill && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-accent-400/10 px-3 py-2 text-xs text-fg">
                      <GraduationCap className="size-4 text-accent-300" />
                      <strong>{activeDrill.title}:</strong> {activeDrill.objective}
                      {records.trainingBadges.includes(activeDrill.id) && <Badge variant="accent">Badge earned</Badge>}
                    </div>
                  )}
                </CardContent>
              </Card>

              {match.phase === 'fulltime' && <PostMatchReport state={match} pitchTemplate={pitchTemplate} />}

              {match.phase !== 'fulltime' && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
                <div className="space-y-4">
                  <Card><CardContent className="pt-4">
                    <MatchStage
                      state={match}
                      showOffsideLine={showOffsideLine}
                      pitchTemplate={pitchTemplate}
                      circleSchemeId={circleSchemeId}
                      shapeTeam={showShape ? shapeTeam : null}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                      <Badge variant="outline">105 × 68m</Badge>
                      <Badge variant="outline">Circles r1.45m — 70%</Badge>
                      <Badge variant="outline">Offside on</Badge>
                      {match.phase === 'restart' && match.restart && humanTeamsInMatch.includes(match.restart.teamId) && (
                        !restartTakerReady(match)
                          ? <span className="font-medium text-accent-300">Run to the BallState — the restart unlocks when you reach it</span>
                          : restartSetupComplete(match)
                            ? <span className="font-medium text-accent-300">
                                {match.restart.quick ? 'Quick restart on' : 'Your restart'}: J / Cross to pass · I / Triangle for through BallState
                                {match.restart.autoTake && (
                                  <span className="text-fg-muted">
                                    {' '}— team-mate takes it in {Math.max(0, Math.ceil((match.restart.arrivedAt ?? 0) + match.restart.setup + 2.5 - match.restart.timer))}s
                                  </span>
                                )}
                              </span>
                            : <span className="font-medium text-accent-300">
                                {match.restart.quick ? 'Quick throw available — ' : 'Setting up — '}
                                {match.restart.buffered
                                  ? 'releasing the moment the side is set'
                                  : 'press J / Cross and it releases the moment the side is set'}
                              </span>
                      )}
                      <label className="ml-auto flex items-center gap-2">
                        Pitch
                        <select value={pitchTemplate} onChange={(e) => gamePitchTemplateStore.set(e.target.value)} className="h-7 rounded-md border border-line-strong bg-ink-900 px-1.5 text-xs text-fg" aria-label="Live pitch template">
                          {PITCH_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                      </label>
                      <label className="flex items-center gap-2">
                        Circles
                        <select value={circleSchemeId} onChange={(e) => gameCircleSchemeStore.set(e.target.value)} className="h-7 rounded-md border border-line-strong bg-ink-900 px-1.5 text-xs text-fg" aria-label="Player circle design">
                          {CIRCLE_SCHEMES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={showOffsideLine} onChange={(e) => setShowOffsideLine(e.target.checked)} /> Offside line</label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={showShape} onChange={(e) => setShowShape(e.target.checked)} /> Shape
                      </label>
                      {showShape && (
                        <label className="flex items-center gap-2">
                          <select
                            value={shapeTeam}
                            onChange={(e) => setShapeTeam(e.target.value as TeamId)}
                            className="h-7 rounded-md border border-line-strong bg-ink-900 px-1.5 text-xs text-fg"
                            aria-label="Shape overlay team"
                          >
                            <option value="bracelonia">BRA shape</option>
                            <option value="banyarn">BAM shape</option>
                          </select>
                        </label>
                      )}
                    </div>
                  </CardContent></Card>

                  {match.phase === 'halftime' && (
                    <Card>
                      <CardHeader><CardTitle>Half-time player ratings</CardTitle></CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader><TableRow><TableHead>Player</TableHead><TableHead>Team</TableHead><TableHead>Pos</TableHead><TableHead>G</TableHead><TableHead>Pass</TableHead><TableHead>Tck</TableHead><TableHead>Rating</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {sortedRatings.slice(0, 22).map((p) => (
                              <TableRow key={p.id}><TableCell>#{p.base.number} {p.base.name}</TableCell><TableCell>{getTeam(p.teamId).shortName}</TableCell><TableCell>{p.slotPosition}</TableCell><TableCell>{p.goals}</TableCell><TableCell>{p.completedPasses}/{p.passes}</TableCell><TableCell>{p.tackles}</TableCell><TableCell className="text-metric font-semibold text-accent-300">{playerRating(p).toFixed(1)}</TableCell></TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="space-y-4">
                  <Card><CardHeader><CardTitle>Match stats</CardTitle></CardHeader><CardContent><TeamStatRows state={match} /></CardContent></Card>

                  {humanTeamsInMatch.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle>Substitutions & live tactics</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid gap-3">
                          {humanTeamsInMatch.length > 1 && (
                            <NativeSelect id="sub-team" label="Team" value={subTeam} onChange={(v) => setSubTeam(v as TeamId)}>
                              {humanTeamsInMatch.map((t) => <option key={t} value={t}>{getTeam(t).name}</option>)}
                            </NativeSelect>
                          )}
                          <NativeSelect id="sub-out" label="Player off" value={effectiveSubOut} onChange={setSubOut}>
                            {subOutOptions.map((p) => <option key={p.id} value={p.id}>#{p.base.number} {p.slotPosition} · load {Math.round(p.load)}%</option>)}
                          </NativeSelect>
                          <NativeSelect id="sub-in" label="Player on" value={effectiveSubIn} onChange={setSubIn}>
                            {subInOptions.map((p) => <option key={p.id} value={p.id}>#{p.base.number} {p.base.position} · fresh</option>)}
                          </NativeSelect>
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" onClick={applyOrQueueSub} disabled={!effectiveSubOut || !effectiveSubIn || match.substitutions[subTeam].used >= 5}>{match.phase === 'restart' || match.phase === 'halftime' ? 'Make substitution' : 'Queue for next stoppage'}</Button>
                            <Badge variant="outline">Used {match.substitutions[subTeam].used}/5 · windows {match.substitutions[subTeam].windows}/3</Badge>
                          </div>
                          {match.pendingSubs.filter((s) => s.teamId === subTeam).length > 0 && <p className="text-xs text-fg-muted">Queued and will enter at the next stoppage.</p>}
                          <div className="border-t border-line pt-3">
                            <SectionLabel>Live shape — {getTeam(subTeam).shortName}</SectionLabel>
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => adjustLiveSlider(subTeam, 'lineHeight', 6)}>Line +</Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => adjustLiveSlider(subTeam, 'lineHeight', -6)}>Line −</Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => adjustLiveSlider(subTeam, 'pressing', 6)}>Press +</Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => adjustLiveSlider(subTeam, 'pressing', -6)}>Press −</Button>
                            </div>
                            <p className="mt-2 text-[11px] text-fg-muted">Line {(subTeam === 'bracelonia' ? match.config.homePlan : match.config.awayPlan).sliders.lineHeight} · Press {(subTeam === 'bracelonia' ? match.config.homePlan : match.config.awayPlan).sliders.pressing}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader><CardTitle>Match events</CardTitle></CardHeader>
                    <CardContent>
                      {match.events.length ? (
                        <div className="space-y-2">
                          {match.events.slice(0, 14).map((e, index) => (
                            <div key={`${e.minute}-${index}`} className="flex gap-2 text-xs leading-relaxed">
                              <span className="w-8 shrink-0 text-metric text-accent-300">{e.minute}′</span>
                              <span className="text-fg-muted">{e.text}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-fg-muted">No goals, cards or substitutions yet. Minute {matchMinute(match)}.</p>}
                    </CardContent>
                  </Card>
                </div>
              </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="plan">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex gap-2">
                    {GAME_TEAMS.map((team) => <Button key={team.id} type="button" variant={planTeam === team.id ? 'default' : 'outline'} onClick={() => setPlanTeam(team.id)}>{team.name}</Button>)}
                  </div>
                  <label className="min-w-56 flex-1">
                    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-fg-muted">Plan name</span>
                    <Input value={currentPlan.name} onChange={(e) => updatePlan({ ...currentPlan, name: e.target.value })} />
                  </label>
                  <Button type="button" variant="outline" onClick={saveCurrentPlan}><Save /> Save locally</Button>
                  <Button type="button" variant="ghost" onClick={() => updatePlan(createDefaultPlan(planTeam))}><RotateCcw /> Club default</Button>
                </div>
                {shareMessage && <p className="mt-3 text-xs text-accent-300" role="status">{shareMessage}</p>}
              </CardContent>
            </Card>

            <MatchPlanEditor plan={currentPlan} onChange={updatePlan} ratingOverrides={ratingOverrides} />

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Saved Match Plans</CardTitle></CardHeader>
                <CardContent>
                  {savedPlans.length ? (
                    <div className="space-y-2">
                      {savedPlans.map((saved) => (
                        <div key={saved.id} className="flex flex-wrap items-center gap-2 rounded-md bg-ink-900 px-3 py-2 text-sm">
                          <span className="min-w-0 flex-1 truncate text-fg">{saved.plan.name} <span className="text-xs text-fg-muted">· {getTeam(saved.plan.teamId).shortName} · {saved.plan.formation} · {new Date(saved.savedAt).toLocaleDateString()}</span></span>
                          <Button type="button" size="sm" variant="outline" onClick={() => { updatePlan(structuredClone(saved.plan)); setPlanTeam(saved.plan.teamId) }}><Download /> Load</Button>
                          <Button type="button" size="sm" variant="ghost" aria-label={`Delete ${saved.plan.name}`} onClick={() => gamePlansStore.set((prev) => prev.filter((x) => x.id !== saved.id))}><X /></Button>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-fg-muted">No locally saved plans yet.</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Share / import by code</CardTitle></CardHeader>
                <CardContent>
                  <SectionLabel>Export — {currentPlan.name}</SectionLabel>
                  <Textarea value={exportCode} readOnly rows={4} className="break-all text-[11px]" aria-label="Export Match Plan code" />
                  <div className="mt-2 flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(exportCode); setShareMessage('Match Plan code copied.') } catch { setShareMessage('Copy the code from the export box.') } }}><ClipboardCopy /> Copy code</Button>
                  </div>
                  <div className="mt-4">
                    <SectionLabel>Import</SectionLabel>
                    <Textarea value={importCode} onChange={(e) => setImportCode(e.target.value)} rows={4} placeholder="Paste a Vigor Match Plan code…" aria-label="Import Match Plan code" />
                    <Button type="button" size="sm" className="mt-2" onClick={importPlan}><Upload /> Import plan</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ratings">
          <TeamRatings
            plans={{ bracelonia: homePlan, banyarn: awayPlan }}
            overrides={ratingOverrides}
            onChange={(next) => gameRatingOverridesStore.set(next)}
          />
        </TabsContent>

        <TabsContent value="training">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {TRAINING_DRILLS.map((drill, index) => (
              <Card key={drill.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{index + 1}. {drill.title}</CardTitle>
                    {records.trainingBadges.includes(drill.id) ? <Badge variant="accent">Badge earned</Badge> : <Badge variant="outline">Not yet</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="min-h-10 text-xs leading-relaxed text-fg-muted">{drill.objective}</p>
                  <p className="mt-2 text-[11px] text-fg-muted">Launches a Quick 2×4 Easy match with {getTeam(selectedSide).name}. Keyboard and controller both work.</p>
                  <Button type="button" size="sm" className="mt-4" onClick={() => startMatch('pvai', drill.id)}><Play /> Start drill</Button>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardHeader><CardTitle>Free Training</CardTitle></CardHeader>
              <CardContent>
                <p className="min-h-10 text-xs leading-relaxed text-fg-muted">An Easy quick match with no badge target — use it to learn switching, directed runs, aftertouch and set-piece timing.</p>
                <Button type="button" size="sm" variant="outline" className="mt-4" onClick={() => startMatch('pvai', 'free-training')}><Play /> Free training</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bench">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Watch AI / tactical Test Bench</CardTitle></CardHeader>
              <CardContent>
                <p className="max-w-3xl text-xs leading-relaxed text-fg-muted">Run the current two Match Plans against each other with no hidden attribute boosts. The shortened bench run maps to a full 90-minute clock, making it useful for comparing shape, line height, pressing and set-piece defaults before you play.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" onClick={() => startMatch('watch')}><Play /> Watch live AI match</Button>
                  <Button type="button" variant="outline" onClick={() => runTestBench(1)}>Run 1 bench match</Button>
                  <Button type="button" variant="outline" onClick={() => runTestBench(3)}>Run 3 seeds</Button>
                </div>
              </CardContent>
            </Card>
            {testResults.length > 0 && (
              <div className="grid gap-4 xl:grid-cols-3">
                {testResults.map((result, index) => {
                  const homeShape = shapeMetrics(result, 'bracelonia')
                  const awayShape = shapeMetrics(result, 'banyarn')
                  return (
                    <Card key={index}>
                      <CardHeader><CardTitle>Seed {result.config.seed} — BRA {result.score.bracelonia}–{result.score.banyarn} BAM</CardTitle></CardHeader>
                      <CardContent>
                        <TeamStatRows state={result} />
                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-fg-muted">
                          <div className="rounded-md bg-ink-900 p-2"><strong className="text-fg">BRA shape</strong><br />Width {homeShape.width.toFixed(1)}m<br />Length {homeShape.length.toFixed(1)}m<br />Line {homeShape.lineHeight.toFixed(1)}m</div>
                          <div className="rounded-md bg-ink-900 p-2"><strong className="text-fg">BAM shape</strong><br />Width {awayShape.width.toFixed(1)}m<br />Length {awayShape.length.toFixed(1)}m<br />Line {awayShape.lineHeight.toFixed(1)}m</div>
                        </div>
                        <div className="mt-3 space-y-1 text-[11px] text-fg-muted">
                          {result.events.filter((e) => e.kind === 'goal').slice(0, 5).map((e, i) => <p key={i}>{e.minute}′ {e.text}</p>)}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
