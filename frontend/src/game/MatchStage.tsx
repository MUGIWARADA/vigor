import { useEffect, useState } from 'react'
import { Pitch, type PitchTemplate } from '@/components/pitch/Pitch'
import { getTeam, type TeamId } from './data'
import { GOAL_PHASE_SECONDS, GOAL_PRESENTATION, attackDir, offsideLineX, type GoalRecord, type MatchState } from './engine'
import { circleScheme, gradientStops, resolveCircle, type CircleLook, type CircleScheme } from './circles'
import { ShapeOverlay, teamShape } from './ShapePanel'

/**
 * The goal beat, drawn in pitch coordinates so it scales with the pitch
 * itself: the celebration runs first (players sprinting for the flag, which
 * the engine drives), then the huge scoreline, then a three-second goal-mouth
 * view with the ball's path to the exact spot it crossed the line.
 */
function GoalPresentation({ goal, elapsed }: { goal: GoalRecord; elapsed: number }) {
  const showScoreline = elapsed >= GOAL_PRESENTATION.celebration
  const showNet = elapsed >= GOAL_PRESENTATION.celebration + GOAL_PRESENTATION.scoreline
  const home = goal.score.bracelonia
  const away = goal.score.banyarn
  const teamShort = goal.teamId === 'bracelonia' ? 'BRA' : 'BAM'
  // Goal-mouth frame, in metres: 7.32 m wide, 2.44 m high, posts at y = 34 ±
  // 3.66. The drawing is to scale, so a ball two inches inside the post
  // looks like a ball two inches inside the post.
  const mouthLeft = 37.5
  const mouthWidth = 30
  const ground = 33.4
  const mouthHeight = mouthWidth / 3
  const top = ground - mouthHeight
  // The replay camera stands behind the goal that was attacked. A goal at the
  // left-hand end is watched from the other side of the pitch, so the mouth
  // mirrors: a shot from the left of the pitch has to arrive from the right of
  // the frame, exactly as it does at the other end. Without this every away
  // goal was replayed from the home end and read backwards.
  const mirrored = goal.end === 'left'
  const toX = (worldY: number) => {
    const raw = (worldY - 30.34) / 7.32
    return mouthLeft + (mirrored ? 1 - raw : raw) * mouthWidth
  }
  const toY = (z: number) => ground - (Math.min(2.44, Math.max(0, z)) / 2.44) * mouthHeight
  const impact = { x: toX(goal.impactY), y: toY(goal.impactZ) }
  const from = { x: toX(goal.fromY), y: ground + 7.5 }
  const curveX = from.x + (impact.x - from.x) * 0.55
  const insidePost = Math.min(goal.impactY - 30.34, 37.66 - goal.impactY)
  return (
    <g data-testid="goal-presentation" pointerEvents="none">
      <style>{`
        @keyframes tiq-scoreline-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tiq-net-path { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes tiq-net-ball { 0% { opacity: 0; } 60% { opacity: 0; } 72% { opacity: 1; } 100% { opacity: 1; } }
        @keyframes tiq-net-pulse { 0%, 100% { r: 1.05; opacity: 0.9; } 50% { r: 1.9; opacity: 0.25; } }
      `}</style>
      {/* The celebration beat is played on a clear pitch - the players running
          for the flag are the shot. The scrim only arrives with the scoreline. */}
      {showScoreline && (
        <g aria-hidden>
          <rect x={0} y={0} width={105} height={68} fill="rgba(4,10,7,0.66)" />
          <rect x={0} y={19} width={105} height={26} fill="rgba(2,6,4,0.82)" />
          <line x1={0} y1={19} x2={105} y2={19} stroke="rgba(217,249,157,0.28)" strokeWidth={0.16} />
          <line x1={0} y1={45} x2={105} y2={45} stroke="rgba(217,249,157,0.28)" strokeWidth={0.16} />
        </g>
      )}
      {showScoreline && !showNet && (
        <g style={{ animation: 'tiq-scoreline-in 420ms ease-out both' }}>
          <text x={52.5} y={35.4} textAnchor="middle" fontSize={19} fontWeight={900} fill="#f8fafc" letterSpacing={2.4}>
            {home} — {away}
          </text>
          <text x={52.5} y={41.6} textAnchor="middle" fontSize={3.1} fontWeight={700} fill="#d9f99d" letterSpacing={1.6}>
            {goal.minute}&#39; #{goal.scorerNumber ?? ''} {displaySurname(goal.scorerName).toUpperCase()}
          </text>
          <text x={52.5} y={16.4} textAnchor="middle" fontSize={2.3} fill="rgba(248,250,252,0.8)" letterSpacing={3.2}>
            {goal.ownGoal ? 'OWN GOAL' : 'GOAL'} · {teamShort}
          </text>
        </g>
      )}
      {showNet && (
        <g>
          <rect x={0} y={0} width={105} height={68} fill="rgba(3,7,5,0.62)" />
          <rect x={19} y={10.5} width={67} height={43} rx={1.6} fill="rgba(3,7,5,0.95)" stroke="rgba(217,249,157,0.32)" strokeWidth={0.22} />
          <text x={52.5} y={15.2} textAnchor="middle" fontSize={2.7} fontWeight={800} fill="#d9f99d" letterSpacing={2.2}>GOAL MOUTH</text>
          <text x={52.5} y={19} textAnchor="middle" fontSize={1.8} fill="rgba(248,250,252,0.74)" letterSpacing={0.5}>
            {goal.minute}&#39; #{goal.scorerNumber ?? ''} {displaySurname(goal.scorerName)}
          </text>
          {/* net */}
          <g stroke="rgba(226,232,240,0.16)" strokeWidth={0.12}>
            {Array.from({ length: 13 }, (_, i) => {
              const x = mouthLeft + (i / 12) * mouthWidth
              return <line key={`v${i}`} x1={x} y1={top} x2={x} y2={ground} />
            })}
            {Array.from({ length: 7 }, (_, i) => {
              const y = top + (i / 6) * mouthHeight
              return <line key={`h${i}`} x1={mouthLeft} y1={y} x2={mouthLeft + mouthWidth} y2={y} />
            })}
          </g>
          {/* posts and bar */}
          <g stroke="#f8fafc" strokeWidth={0.55} strokeLinecap="round">
            <line x1={mouthLeft} y1={ground} x2={mouthLeft} y2={top} />
            <line x1={mouthLeft + mouthWidth} y1={ground} x2={mouthLeft + mouthWidth} y2={top} />
            <line x1={mouthLeft} y1={top} x2={mouthLeft + mouthWidth} y2={top} />
          </g>
          <line x1={mouthLeft} y1={ground} x2={mouthLeft + mouthWidth} y2={ground} stroke="rgba(248,250,252,0.42)" strokeWidth={0.3} />
          {/* keeper, beaten */}
          <g opacity={0.5}>
            <circle cx={52.5} cy={ground - 1.5} r={1.05} fill="rgba(248,250,252,0.5)" />
            <line x1={52.5} y1={ground} x2={52.5 - 1.9} y2={ground - 3.4} stroke="rgba(248,250,252,0.4)" strokeWidth={0.32} strokeLinecap="round" />
            <line x1={52.5} y1={ground} x2={52.5 + 2.1} y2={ground - 3.1} stroke="rgba(248,250,252,0.4)" strokeWidth={0.32} strokeLinecap="round" />
          </g>
          {/* the ball's path, drawn once when the replay opens */}
          <path
            d={`M ${from.x} ${from.y} Q ${curveX} ${(from.y + impact.y) / 2 - 2.4} ${impact.x} ${impact.y}`}
            fill="none"
            stroke="#d9f99d"
            strokeWidth={0.34}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            style={{ animation: 'tiq-net-path 1100ms ease-out forwards' }}
          />
          <circle cx={impact.x} cy={impact.y} fill="none" stroke="#d9f99d" strokeWidth={0.22} style={{ animation: 'tiq-net-pulse 1400ms ease-in-out infinite' }} />
          <circle cx={impact.x} cy={impact.y} r={0.72} fill="#f8fafc" stroke="rgba(15,23,42,0.8)" strokeWidth={0.16} style={{ animation: 'tiq-net-ball 1100ms ease-out forwards', opacity: 0 }} />
          <text x={52.5} y={42.6} textAnchor="middle" fontSize={1.7} fill="rgba(248,250,252,0.68)" letterSpacing={1.1}>
            {goal.impactZ < 0.35 ? 'ALONG THE FLOOR' : goal.impactZ > 1.9 ? 'TOP CORNER' : 'OFF THE GROUND'}
          </text>
          <text x={52.5} y={45.6} textAnchor="middle" fontSize={1.5} fill="rgba(248,250,252,0.5)" letterSpacing={1.1}>
            {insidePost.toFixed(1)} M INSIDE THE POST · {teamShort} {home}–{away}
          </text>
        </g>
      )}
    </g>
  )
}

export function displaySurname(name: string): string {
  const parts = name.split(' ')
  if (name.startsWith('Kim Min')) return 'Kim Min-Jae'
  return parts.at(-1) ?? name
}

/**
 * Live match pitch.
 *
 * Deliberately strict name rule: all 22 circles show numbers only. The one
 * current BallState carrier (and nobody else) receives a small fading surname.
 */
export function MatchStage({ state, showOffsideLine = true, pitchTemplate = 'volt-turf', circleSchemeId = 'volt-halo', shapeTeam = null }: {
  state: MatchState
  showOffsideLine?: boolean
  pitchTemplate?: PitchTemplate
  /** Player-circle design. See `CIRCLE_SCHEMES` for the options. */
  circleSchemeId?: string
  /** Draw that side's average shape beneath the players, or null for off. */
  shapeTeam?: TeamId | null
}) {
  const scheme: CircleScheme = circleScheme(circleSchemeId)
  const players = state.players.filter((p) => p.onPitch && !p.sentOff)
  const carrier = state.ball.ownerId ? players.find((p) => p.id === state.ball.ownerId) : undefined
  const [lastCarrierId, setLastCarrierId] = useState<string | undefined>(carrier?.id)
  useEffect(() => {
    if (carrier?.id) setLastCarrierId(carrier.id)
  }, [carrier?.id])
  const displayCarrier = carrier ?? players.find((p) => p.id === lastCarrierId)
  const attackingTeam: TeamId | null = carrier?.teamId ?? state.ball.passTeamId
  const offsideX = attackingTeam ? offsideLineX(state, attackingTeam) : null
  const ballVisual = {
    x: state.ball.pos.x + state.ball.z * 0.22,
    y: state.ball.pos.y - state.ball.z * 0.48,
  }
  const carrierName = displayCarrier ? displaySurname(displayCarrier.base.name) : ''
  const nameX = displayCarrier ? Math.min(101, Math.max(4, displayCarrier.pos.x)) : 0
  const nameY = displayCarrier ? (displayCarrier.pos.y < 9 ? displayCarrier.pos.y + 4.15 : displayCarrier.pos.y - 2.35) : 0

  return (
    <Pitch ariaLabel="Live 11 versus 11 full-pitch match" className="w-full" template={pitchTemplate}>
      <style>{`
        @keyframes tiq-carrier-name-in { from { opacity: 0; } to { opacity: 0.94; } }
        @keyframes tiq-carrier-name-out { from { opacity: 0.94; } to { opacity: 0; } }
      `}</style>
      {scheme.gradient !== 'none' && (
        <defs aria-hidden>
          {(['bracelonia', 'banyarn'] as TeamId[]).flatMap((teamId) => {
            const team = getTeam(teamId)
            const look: CircleLook = team
            return [false, true].map((isGk) => {
              const id = `tiq-circle-${scheme.id}-${teamId}${isGk ? '-gk' : ''}`
              const stops = gradientStops(scheme, look, isGk)
              return scheme.gradient === 'radial' || scheme.gradient === 'glass' ? (
                <radialGradient key={id} id={id} cx="34%" cy="28%" r="78%">
                  {stops.map((stop, i) => (
                    <stop key={i} offset={`${stop.offset * 100}%`} stopColor={stop.color} stopOpacity={stop.opacity ?? 1} />
                  ))}
                </radialGradient>
              ) : (
                <linearGradient key={id} id={id} x1="0" y1="0" x2="1" y2="0">
                  {stops.map((stop, i) => (
                    <stop key={i} offset={`${stop.offset * 100}%`} stopColor={stop.color} stopOpacity={stop.opacity ?? 1} />
                  ))}
                </linearGradient>
              )
            })
          })}
        </defs>
      )}

      {shapeTeam && (
        <ShapeOverlay shape={teamShape(state, shapeTeam)} dir={attackDir(state, shapeTeam)} />
      )}

      {showOffsideLine && attackingTeam && offsideX !== null && state.phase === 'play' && (
        <g aria-hidden>
          <line x1={offsideX} y1={0} x2={offsideX} y2={68} stroke="rgba(217,249,157,0.42)" strokeWidth={0.28} strokeDasharray="1.2 1.2" />
          <text x={offsideX + (attackDir(state, attackingTeam) === 1 ? 0.7 : -0.7)} y={3.2} fontSize={1.65} fill="rgba(236,253,186,0.72)" textAnchor={attackDir(state, attackingTeam) === 1 ? 'start' : 'end'}>OFFSIDE LINE</text>
        </g>
      )}

      {/* BallState ground shadow is the true x/y; the raised BallState is offset for the 2.5D aerial read. */}
      <g aria-hidden>
        <ellipse cx={state.ball.pos.x} cy={state.ball.pos.y} rx={0.72 + state.ball.z * 0.1} ry={0.32 + state.ball.z * 0.045} fill="rgba(0,0,0,0.42)" />
        {state.ball.z > 0.25 && (
          <g>
            {Array.from({ length: Math.min(4, Math.ceil(state.ball.z / 0.8)) }, (_, i) => (
              <line key={i} x1={state.ball.pos.x - 0.75} y1={state.ball.pos.y - i * 0.55} x2={state.ball.pos.x - 0.35} y2={state.ball.pos.y - i * 0.55} stroke="rgba(255,255,255,0.55)" strokeWidth={0.16} />
            ))}
            <circle cx={state.ball.pos.x} cy={state.ball.pos.y} r={1.15} fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth={0.18} strokeDasharray="0.45 0.45" />
          </g>
        )}
      </g>

      {players.map((p) => {
        const team = getTeam(p.teamId)
        const isGk = p.slotPosition === 'GK'
        const isCarrier = carrier?.id === p.id
        const isControlled = state.controlled[p.teamId] === p.id && state.config.humanTeams.includes(p.teamId)
        const isIntended = state.ball.intendedReceiverId === p.id
        const speed = Math.hypot(p.vel.x, p.vel.y)
        const paint = resolveCircle(scheme, team, p.teamId, { isGk, isCarrier })
        const stride = Math.sin(p.distance * 2.55) * Math.min(1, speed / 6.5)
        const perp = { x: -p.facing.y, y: p.facing.x }
        const bootA = {
          x: p.pos.x + perp.x * 0.68 + p.facing.x * (-0.72 + stride * 0.34),
          y: p.pos.y + perp.y * 0.68 + p.facing.y * (-0.72 + stride * 0.34),
        }
        const bootB = {
          x: p.pos.x - perp.x * 0.68 + p.facing.x * (-0.72 - stride * 0.34),
          y: p.pos.y - perp.y * 0.68 + p.facing.y * (-0.72 - stride * 0.34),
        }
        return (
          <g key={p.id} data-testid={`live-player-${p.id}`} aria-label={`Number ${p.base.number}`}>
            {isControlled && <circle cx={p.pos.x} cy={p.pos.y} r={1.86} fill="none" stroke="#d9f99d" strokeWidth={0.35} />}
            {isIntended && !isControlled && <circle cx={p.pos.x} cy={p.pos.y} r={1.74} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={0.2} strokeDasharray="0.6 0.6" />}
            {speed > 1.05 && p.slideTimer <= 0 && (
              <g aria-hidden>
                <circle cx={bootA.x} cy={bootA.y} r={0.23} fill="rgba(3,7,5,0.72)" />
                <circle cx={bootB.x} cy={bootB.y} r={0.23} fill="rgba(3,7,5,0.72)" />
              </g>
            )}
            {p.slideTimer > 0 && <line x1={p.pos.x - p.facing.x * 1.8} y1={p.pos.y - p.facing.y * 1.8} x2={p.pos.x + p.facing.x * 2.1} y2={p.pos.y + p.facing.y * 2.1} stroke="rgba(255,255,255,0.6)" strokeWidth={0.55} strokeLinecap="round" />}
            {isCarrier && (
              <circle cx={p.pos.x} cy={p.pos.y} r={1.62} fill="none" stroke={paint.carrierRing} strokeWidth={0.24} opacity={0.9} />
            )}
            <circle
              cx={p.pos.x}
              cy={p.pos.y}
              r={1.18 + (speed > 1.05 ? stride * 0.035 : 0)}
              fill={paint.gradientId ? `url(#${paint.gradientId})` : paint.fill}
              fillOpacity={paint.fillOpacity}
              stroke={paint.stroke}
              strokeWidth={paint.strokeWidth}
            />
            {paint.gloss && (
              <ellipse
                cx={p.pos.x - 0.42}
                cy={p.pos.y - 0.5}
                rx={0.62}
                ry={0.42}
                fill="rgba(255,255,255,0.34)"
                transform={`rotate(-24 ${p.pos.x - 0.42} ${p.pos.y - 0.5})`}
              />
            )}
            <text
              x={p.pos.x}
              y={p.pos.y + (paint.numberSize ? paint.numberSize * 0.32 : 0.48)}
              textAnchor="middle"
              fontSize={paint.numberSize ?? 1.48}
              fontWeight={800}
              fill={paint.numberFill}
              stroke={paint.numberStroke?.color}
              strokeWidth={paint.numberStroke?.width}
              paintOrder="stroke"
            >{p.base.number}</text>
            {p.yellowCards > 0 && <rect x={p.pos.x + 1.15} y={p.pos.y - 1.75} width={0.72} height={1.05} rx={0.12} fill="#facc15" stroke="rgba(0,0,0,0.35)" strokeWidth={0.08} />}
            {p.injured && <circle cx={p.pos.x - 1.3} cy={p.pos.y - 1.3} r={0.38} fill="#f87171" />}
          </g>
        )
      })}

      <g aria-hidden data-testid="match-ball">
        <circle cx={ballVisual.x} cy={ballVisual.y} r={0.5 + Math.min(0.28, state.ball.z * 0.06)} fill="#f8fafc" stroke="rgba(15,23,42,0.75)" strokeWidth={0.12} />
        {[0, 1, 2].map((i) => {
          const roll = state.ball.pos.x * 1.7 + state.ball.pos.y * 1.25 + i * ((Math.PI * 2) / 3)
          return (
            <circle
              key={i}
              cx={ballVisual.x + Math.cos(roll) * 0.2}
              cy={ballVisual.y + Math.sin(roll) * 0.16}
              r={i === 0 ? 0.1 : 0.065}
              fill="#111827"
              opacity={i === 0 ? 0.58 : 0.34}
            />
          )
        })}
      </g>

      {displayCarrier && (
        <text
          key={`${carrier ? 'in' : 'out'}-${displayCarrier.id}`}
          data-testid="carrier-name-plate"
          pointerEvents="none"
          x={nameX}
          y={nameY}
          textAnchor="middle"
          fontFamily="'Times New Roman', Times, serif"
          fontSize={1.42}
          fontWeight={400}
          fill="rgba(255,255,255,0.94)"
          stroke="rgba(0,0,0,0.38)"
          strokeWidth={0.14}
          paintOrder="stroke"
          style={{
            letterSpacing: '0.015em',
            opacity: carrier ? undefined : 0,
            animation: carrier
              ? 'tiq-carrier-name-in 180ms ease-out forwards'
              : 'tiq-carrier-name-out 260ms ease-in forwards',
          }}
        >
          {carrierName}
        </text>
      )}

      {/* Drawn last: after a goal the presentation owns the pitch. */}
      {state.phase === 'goal' && state.lastGoal && (
        <GoalPresentation goal={state.lastGoal} elapsed={GOAL_PHASE_SECONDS - state.phaseTimer} />
      )}
    </Pitch>
  )
}
