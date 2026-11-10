import { useState } from 'react'
import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import {
  DEFAULT_GAMEPLAY_SETTINGS,
  normalizeGameplaySettings,
  type GameplaySettings,
  type GameplaySideSettings,
} from './data'

type SideKey = 'user' | 'cpu'
type SideField = keyof GameplaySideSettings

const SIDE_GROUPS: Array<{ title: string; fields: Array<{ key: SideField; label: string; help: string }> }> = [
  {
    title: 'Movement',
    fields: [
      { key: 'sprintSpeed', label: 'Sprint Speed', help: 'Top running speed with and without the BallState.' },
      { key: 'acceleration', label: 'Acceleration', help: 'How quickly players reach their intended speed.' },
    ],
  },
  {
    title: 'BallState & finishing',
    fields: [
      { key: 'passSpeed', label: 'Pass Speed', help: 'Ground-pass and cross velocity.' },
      { key: 'passError', label: 'Pass Error', help: 'Directional error on passes and crosses.' },
      { key: 'shotSpeed', label: 'Shot Speed', help: 'Strike velocity at the moment of the shot.' },
      { key: 'shotError', label: 'Shot Error', help: 'Lateral and height dispersion, especially beyond the box.' },
      { key: 'firstTouchError', label: 'First Touch Error', help: 'Touch distance, angle and loss of control when receiving.' },
    ],
  },
  {
    title: 'Defending',
    fields: [
      { key: 'goalkeeperAbility', label: 'Goalkeeper Ability', help: 'Save and clean-catch probability for this side’s keeper.' },
      { key: 'marking', label: 'Marking', help: 'How tightly defenders track nearby opponents and close the carrier.' },
      { key: 'tackleAggression', label: 'Tackle Aggression', help: 'Tackle commitment, AI attempt rate and foul risk.' },
    ],
  },
  {
    title: 'Positioning',
    fields: [
      { key: 'runFrequency', label: 'Run Frequency', help: 'How often attackers make forward/off-BallState runs.' },
      { key: 'lineHeight', label: 'Line Height', help: 'Additional height applied over the Match Plan defensive line.' },
      { key: 'lineLength', label: 'Line Length', help: 'Vertical distance between the defensive and forward units.' },
      { key: 'lineWidth', label: 'Line Width', help: 'Horizontal spread of the team shape.' },
      { key: 'fullbackPositioning', label: 'Fullback Positioning', help: 'How aggressively fullbacks advance, overlap and underlap.' },
    ],
  },
]

function SliderRow({ id, label, help, value, onChange }: {
  id: string
  label: string
  help: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-medium text-fg">{label}</label>
        <span className="text-metric min-w-8 text-right text-xs font-bold text-accent-300">{value}</span>
      </div>
      <Slider
        id={id}
        aria-label={label}
        min={0}
        max={100}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v ?? 50)}
      />
      <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">{help}</p>
    </div>
  )
}

export function GameplaySliders({ value, onChange }: {
  value: GameplaySettings
  onChange: (next: GameplaySettings) => void
}) {
  const settings = normalizeGameplaySettings(value)
  const [side, setSide] = useState<SideKey>('user')
  const sideSettings = settings[side]

  const updateSide = (key: SideField, nextValue: number) => {
    onChange(normalizeGameplaySettings({
      ...settings,
      [side]: { ...sideSettings, [key]: nextValue },
    }))
  }

  const resetSide = () => {
    onChange(normalizeGameplaySettings({
      ...settings,
      [side]: { ...DEFAULT_GAMEPLAY_SETTINGS[side] },
    }))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-accent-300" /> Gameplay sliders</CardTitle>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">
              EA FC-style Human/CPU tuning at 0–100. Fifty is the balanced simulation baseline. Changes save locally and apply from the next kick-off.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant={side === 'user' ? 'default' : 'outline'} onClick={() => setSide('user')}>Human</Button>
            <Button type="button" size="sm" variant={side === 'cpu' ? 'default' : 'outline'} onClick={() => setSide('cpu')}>CPU</Button>
            <Button type="button" size="sm" variant="ghost" onClick={resetSide}><RotateCcw /> Reset {side === 'user' ? 'Human' : 'CPU'}</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 md:grid-cols-2">
          {SIDE_GROUPS.map((group) => (
            <section key={group.title} className="space-y-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{group.title}</h4>
              {group.fields.map((field) => (
                <SliderRow
                  key={field.key}
                  id={`gameplay-${side}-${field.key}`}
                  label={field.label}
                  help={field.help}
                  value={sideSettings[field.key]}
                  onChange={(next) => updateSide(field.key, next)}
                />
              ))}
            </section>
          ))}
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Match officials & availability</h4>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange(normalizeGameplaySettings(DEFAULT_GAMEPLAY_SETTINGS))}
            >
              <RotateCcw /> Reset all gameplay sliders
            </Button>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <SliderRow
              id="gameplay-referee-strictness"
              label="Referee Strictness"
              help="Lower values tolerate more careless contact; higher values card borderline reckless and tactical fouls sooner."
              value={settings.refereeStrictness}
              onChange={(next) => onChange(normalizeGameplaySettings({ ...settings, refereeStrictness: next }))}
            />
            <SliderRow
              id="gameplay-injury-frequency"
              label="Injury Frequency"
              help="How often fouls leave the victim carrying a knock. Challenge force and Injury Tolerance still matter."
              value={settings.injuryFrequency}
              onChange={(next) => onChange(normalizeGameplaySettings({ ...settings, injuryFrequency: next }))}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
