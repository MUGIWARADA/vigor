/**
 * Tactical profile — what a team's shape actually did, measured.
 *
 * The method (and the discipline behind it) comes from the analytics layer of
 * `ai-football-analytics`: compute a small set of spatial statistics per frame,
 * aggregate them over the match, and turn each into a label that **carries its
 * number and a plain-language reason**. Nothing here is a guess about intent —
 * every word in the output is a threshold applied to a measurement, so two
 * people arguing about a team's block can argue about the same figure.
 *
 * Their version has to fight broadcast video: detection boxes, homography
 * error, swapped identities. Ours reads the simulation directly, in metres, in
 * each team's own attacking orientation, so the same maths is exact here.
 *
 * Positions are stored in *local* space: x = 0 is the team's own goal line,
 * x = 105 the goal they attack, y = 0..68 across the pitch. Sampling happens
 * once a second inside `stepMatch`, and only running sums are kept, so a
 * four-minute match costs a few dozen numbers rather than a few thousand
 * frames of history.
 */
import type { MatchState } from './engine'
import type { TeamId } from './data'

/**
 * Type-only import on purpose: the engine calls *into* this module, so a value
 * import back out of the engine would be a runtime cycle. Direction is passed
 * in instead of read back.
 */

const W = 105
const H = 68
const THIRD = H / 3

/** Running sums for one phase (in possession, out of possession, or all). */
export interface PhaseSample {
  frames: number
  /** Mean distance of the players from their own frame centroid, in metres. */
  sumSpread: number
  /** Sum of the per-frame population standard deviations, in metres. */
  sumWidthStd: number
  sumDepthStd: number
  sumCentroidX: number
  sumCentroidY: number
  /** Deepest and highest outfield player each frame, local x. */
  sumDeepestX: number
  sumHighestX: number
  /** Mean local x of the back line each frame. */
  sumBackLineX: number
  backLineFrames: number
  /** Mean local x of the midfield unit each frame. */
  sumMidfieldX: number
  midfieldFrames: number
  /** Sum of the players' speeds, and how many players were counted. */
  sumSpeed: number
  speedSamples: number
  /** Positions counted into each lateral third: left, centre, right. */
  thirds: [number, number, number]
  /**
   * Where the ball was, in the same local frame, counted only for the frames
   * this team had it. Summed separately from the players because a side's
   * possession is not located where its players are: a team can hold the ball
   * in its own third all day and still stand high.
   */
  sumBallX: number
  ballFrames: number
  /** In-possession frames by ball position: own third, middle third, final third. */
  possessionThirds: [number, number, number]
}

export interface TeamTactics {
  all: PhaseSample
  inPossession: PhaseSample
  outOfPossession: PhaseSample
}

const BACK_LINE = ['LB', 'RB', 'LCB', 'CB', 'RCB', 'LWB', 'RWB']
const MIDFIELD = ['DM', 'LDM', 'RDM', 'LCM', 'CM', 'RCM', 'CAM']

export function emptyPhaseSample(): PhaseSample {
  return {
    frames: 0,
    sumSpread: 0,
    sumWidthStd: 0,
    sumDepthStd: 0,
    sumCentroidX: 0,
    sumCentroidY: 0,
    sumDeepestX: 0,
    sumHighestX: 0,
    sumBackLineX: 0,
    backLineFrames: 0,
    sumMidfieldX: 0,
    midfieldFrames: 0,
    sumSpeed: 0,
    speedSamples: 0,
    thirds: [0, 0, 0],
    sumBallX: 0,
    ballFrames: 0,
    possessionThirds: [0, 0, 0],
  }
}

export function emptyTeamTactics(): TeamTactics {
  return { all: emptyPhaseSample(), inPossession: emptyPhaseSample(), outOfPossession: emptyPhaseSample() }
}

/** pstdev of a list, which is what "width" and "depth" are measured as. */
function stdev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Add one frame of one team's shape to its running totals.
 *
 * `players` must be outfield only and already in local coordinates — the
 * keeper is excluded because his position is dictated by the ball, and
 * including him would flatter every measure of compactness.
 */
export function recordPhaseFrame(
  sample: PhaseSample,
  points: Array<{ x: number; y: number }>,
  speeds: number[],
  lineX: number[],
  midX: number[],
  ballX?: number,
): void {
  if (points.length < 4) return
  const n = points.length
  const cx = points.reduce((a, p) => a + p.x, 0) / n
  const cy = points.reduce((a, p) => a + p.y, 0) / n
  sample.frames += 1
  sample.sumSpread += points.reduce((a, p) => a + Math.hypot(p.x - cx, p.y - cy), 0) / n
  sample.sumWidthStd += stdev(points.map((p) => p.y))
  sample.sumDepthStd += stdev(points.map((p) => p.x))
  sample.sumCentroidX += cx
  sample.sumCentroidY += cy
  sample.sumDeepestX += Math.min(...points.map((p) => p.x))
  sample.sumHighestX += Math.max(...points.map((p) => p.x))
  if (lineX.length) {
    sample.sumBackLineX += lineX.reduce((a, b) => a + b, 0) / lineX.length
    sample.backLineFrames += 1
  }
  if (midX.length) {
    sample.sumMidfieldX += midX.reduce((a, b) => a + b, 0) / midX.length
    sample.midfieldFrames += 1
  }
  for (const s of speeds) {
    sample.sumSpeed += s
    sample.speedSamples += 1
  }
  for (const p of points) {
    sample.thirds[p.y < THIRD ? 0 : p.y >= 2 * THIRD ? 2 : 1] += 1
  }
  if (ballX !== undefined && Number.isFinite(ballX)) {
    sample.sumBallX += ballX
    sample.ballFrames += 1
    sample.possessionThirds[ballX < W / 3 ? 0 : ballX >= (2 * W) / 3 ? 2 : 1] += 1
  }
}

/** Called from the engine's once-a-second sampling pass. */
export function recordTacticalSample(state: MatchState, attackDir: Record<TeamId, 1 | -1>): void {
  const owner = state.ball.ownerId
    ? state.players.find((p) => p.id === state.ball.ownerId)
    : undefined
  const possessionTeam = owner?.teamId
    ?? (state.ball.kind === 'pass' || state.ball.kind === 'cross' ? state.ball.passTeamId : null)

  for (const teamId of ['bracelonia', 'banyarn'] as TeamId[]) {
    const bucket = (state.tactics[teamId] ??= emptyTeamTactics())
    const players = state.players.filter((p) => p.onPitch && !p.sentOff && p.teamId === teamId && p.slotPosition !== 'GK')
    if (players.length < 6) continue
    // Local orientation: our own goal at x = 0.
    const attackPositive = attackDir[teamId]
    const toLocal = (x: number, y: number) => (attackPositive === 1 ? { x, y } : { x: W - x, y: H - y })
    const points = players.map((p) => toLocal(p.pos.x, p.pos.y))
    const speeds = players.map((p) => Math.hypot(p.vel.x, p.vel.y))
    const lineX = players.filter((p) => BACK_LINE.includes(p.slotPosition)).map((p) => toLocal(p.pos.x, p.pos.y).x)
    const midX = players.filter((p) => MIDFIELD.includes(p.slotPosition)).map((p) => toLocal(p.pos.x, p.pos.y).x)

    // The ball, in this team's own frame. Only meaningful for the side that
    // has it, which is why it is passed to the in-possession bucket alone.
    const ballLocal = toLocal(state.ball.pos.x, state.ball.pos.y)
    // The ball goes into all three buckets, in this team's own frame: with the
    // ball it is where they attack from, without it where they are being
    // attacked, and the pair of them is the possession picture.
    recordPhaseFrame(bucket.all, points, speeds, lineX, midX, ballLocal.x)
    if (possessionTeam === teamId) recordPhaseFrame(bucket.inPossession, points, speeds, lineX, midX, ballLocal.x)
    else if (possessionTeam) recordPhaseFrame(bucket.outOfPossession, points, speeds, lineX, midX, ballLocal.x)
  }
}

/** One labelled, numbered, justified claim about a team. */
export interface TacticalReading {
  key: string
  label: string
  /** The measurement the label came from, already rounded for display. */
  value: number
  unit: string
  reason: string
}

export interface TacticalProfile {
  teamId: TeamId
  samples: number
  /** Mean distance of the outfield ten from their own centroid. */
  compactness: number
  /** Lateral standard deviation — how wide the block actually is. */
  width: number
  /** Vertical standard deviation — how long the block actually is. */
  depth: number
  /** Deepest outfield player to highest, averaged. */
  length: number
  /** Centroid distance from own goal. */
  blockHeight: number
  blockHeightInPossession: number
  blockHeightOutOfPossession: number
  /** Back line to own goal, and the space between the line and the midfield. */
  lineHeight: number
  lineToMidfield: number
  /** Mean player speed in and out of possession, km/h. */
  tempoInPossession: number
  tempoOutOfPossession: number
  /**
   * Territory: the mean position of the ball, in metres from own goal, over
   * the frames this team had it. This is the "where did you play" number that
   * possession percentage cannot give you — 60 % possession spent in your own
   * third is a different team from 60 % spent in theirs.
   */
  territory: number
  territoryOutOfPossession: number
  /** Share of in-possession frames in own / middle / final third, 0-100. */
  possessionThirds: [number, number, number]
  readings: TacticalReading[]
}

const average = (sum: number, n: number) => (n > 0 ? sum / n : 0)
const round = (v: number, places = 1) => Number(v.toFixed(places))

function phaseMetrics(sample: PhaseSample) {
  return {
    frames: sample.frames,
    compactness: average(sample.sumSpread, sample.frames),
    width: average(sample.sumWidthStd, sample.frames),
    depth: average(sample.sumDepthStd, sample.frames),
    length: average(sample.sumHighestX - sample.sumDeepestX, sample.frames),
    blockHeight: average(sample.sumCentroidX, sample.frames),
    deepest: average(sample.sumDeepestX, sample.frames),
    highest: average(sample.sumHighestX, sample.frames),
    lineHeight: average(sample.sumBackLineX, sample.backLineFrames),
    midfieldHeight: average(sample.sumMidfieldX, sample.midfieldFrames),
    tempo: average(sample.sumSpeed, sample.speedSamples) * 3.6,
    thirds: sample.thirds,
    territory: average(sample.sumBallX, sample.ballFrames),
    possessionThirds: sample.possessionThirds,
  }
}

function thirdLabel(thirds: [number, number, number]) {
  const total = thirds[0] + thirds[1] + thirds[2] || 1
  const shares = thirds.map((t) => t / total) as [number, number, number]
  const index = shares[0] >= shares[1] && shares[0] >= shares[2] ? 0 : shares[2] >= shares[1] ? 2 : 1
  const label = (['Left', 'Centre', 'Right'] as const)[index]!
  return { label, share: shares[index]! }
}

/**
 * The profile itself. Every label here is a threshold on a measured figure, and
 * the threshold is printed with it, so the reading can be checked rather than
 * merely believed.
 */
export function tacticalProfile(state: MatchState, teamId: TeamId): TacticalProfile {
  const bucket = state.tactics[teamId] ?? emptyTeamTactics()
  const all = phaseMetrics(bucket.all)
  const inPoss = phaseMetrics(bucket.inPossession)
  const outPoss = phaseMetrics(bucket.outOfPossession)
  const zone = thirdLabel(bucket.all.thirds)

  const compactLabel = all.compactness < 15 ? 'Compact' : all.compactness > 20 ? 'Stretched' : 'Balanced'
  const widthLabel = all.width < 11 ? 'Narrow' : all.width > 15 ? 'Wide' : 'Balanced'
  const pressure = outPoss.blockHeight > 52 ? 'High press' : outPoss.blockHeight < 38 ? 'Low block' : 'Mid block'
  const transition = outPoss.tempo > 12 ? 'Fast' : outPoss.tempo < 8 ? 'Slow' : 'Medium'
  const buildUp = all.depth > 15 && inPoss.tempo > 11
    ? 'Direct'
    : all.depth < 11 && inPoss.tempo < 10 ? 'Short passing' : 'Mixed'
  const gap = outPoss.midfieldHeight - outPoss.lineHeight
  const teamName = teamId === 'bracelonia' ? 'Bracelonia' : 'Banyarn Munic'
  const territoryLabel = inPoss.territory > 66 ? 'High territory' : inPoss.territory < 46 ? 'Deep territory' : 'Middle territory'
  const possessionTotal = inPoss.possessionThirds[0] + inPoss.possessionThirds[1] + inPoss.possessionThirds[2] || 1
  const [ownThirdShare, midThirdShare, finalThirdShare] = inPoss.possessionThirds.map((t) => (t / possessionTotal) * 100) as [number, number, number]

  const readings: TacticalReading[] = [
    {
      key: 'compactness',
      label: compactLabel,
      value: round(all.compactness),
      unit: 'm',
      reason: `players sit an average of ${round(all.compactness)} m from the team centroid (compact under 15, stretched over 20)`,
    },
    {
      key: 'width',
      label: widthLabel,
      value: round(all.width),
      unit: 'm',
      reason: `lateral spread of ${round(all.width)} m (narrow under 11, wide over 15)`,
    },
    {
      key: 'depth',
      label: `${round(all.depth)} m deep`,
      value: round(all.depth),
      unit: 'm',
      reason: `the side covers ${round(all.length)} m from deepest to highest player`,
    },
    {
      key: 'block',
      label: pressure,
      value: round(outPoss.blockHeight),
      unit: 'm',
      reason: `defending, the block's centre sits ${round(outPoss.blockHeight)} m from its own goal (high above 52, low below 38); with the ball it sits ${round(inPoss.blockHeight)} m`,
    },
    {
      key: 'line',
      label: `${round(outPoss.lineHeight)} m line`,
      value: round(outPoss.lineHeight),
      unit: 'm',
      reason: `the back line defends ${round(outPoss.lineHeight)} m up the pitch, ${round(outPoss.lineHeight - outPoss.deepest)} m ahead of the deepest defender and ${round(gap)} m behind the midfield`,
    },
    {
      key: 'zone',
      label: `${zone.label} side`,
      value: round(zone.share * 100, 0),
      unit: '%',
      reason: `${round(zone.share * 100, 0)} % of all outfield positions fall in the ${zone.label.toLowerCase()} channel`,
    },
    {
      key: 'territory',
      label: territoryLabel,
      value: round(inPoss.territory),
      unit: 'm',
      reason: `the ball's average position while ${teamName} had it was ${round(inPoss.territory)} m from their own goal — ${round((inPoss.territory / W) * 100, 0)} % of the pitch — against ${round(outPoss.territory)} m while the opposition had it`,
    },
    {
      key: 'possession-thirds',
      label: `${round(ownThirdShare, 0)} / ${round(midThirdShare, 0)} / ${round(finalThirdShare, 0)}`,
      value: round(finalThirdShare, 0),
      unit: '% in the final third',
      reason: `${round(ownThirdShare, 0)} % of possession was spent in their own third, ${round(midThirdShare, 0)} % in the middle and ${round(finalThirdShare, 0)} % in the final third`,
    },
    {
      key: 'tempo',
      label: `${transition} transitions`,
      value: round(outPoss.tempo),
      unit: 'km/h',
      reason: `average player speed is ${round(outPoss.tempo)} km/h without the ball and ${round(inPoss.tempo)} km/h with it`,
    },
    {
      key: 'buildup',
      label: `${buildUp} build-up`,
      value: round(all.depth),
      unit: 'm',
      reason: `building from a ${round(all.depth)} m deep block at ${round(inPoss.tempo)} km/h`,
    },
  ]

  return {
    teamId,
    samples: bucket.all.frames,
    compactness: round(all.compactness),
    width: round(all.width),
    depth: round(all.depth),
    length: round(all.length),
    blockHeight: round(all.blockHeight),
    blockHeightInPossession: round(inPoss.blockHeight),
    blockHeightOutOfPossession: round(outPoss.blockHeight),
    lineHeight: round(outPoss.lineHeight || all.lineHeight),
    lineToMidfield: round(gap),
    tempoInPossession: round(inPoss.tempo),
    territory: round(inPoss.territory),
    territoryOutOfPossession: round(outPoss.territory),
    possessionThirds: [round(ownThirdShare, 0), round(midThirdShare, 0), round(finalThirdShare, 0)],
    tempoOutOfPossession: round(outPoss.tempo),
    readings,
  }
}
