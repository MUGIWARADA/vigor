import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export interface RadarSeries {
  name: string
  color: string
  /** Values 0–100 (percentiles). */
  data: Record<string, number>
}

/**
 * Percentile radar (Recharts). Each series is one player; axes are metric
 * labels. Values are peer percentiles — never raw fabricated values.
 */
export function PercentileRadar({
  axes,
  series,
  height = 300,
  showLegend = true,
}: {
  axes: string[]
  series: RadarSeries[]
  height?: number
  showLegend?: boolean
}) {
  const data = axes.map((axis) => {
    const row: Record<string, string | number> = { axis }
    for (const s of series) row[s.name] = Math.round(s.data[axis] ?? 0)
    return row
  })

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="rgba(150,164,192,0.2)" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: '#96a4c0', fontSize: 10 }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#5e6d8e', fontSize: 9 }} angle={90} />
          {series.map((s) => (
            <Radar
              key={s.name}
              name={s.name}
              dataKey={s.name}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.18}
              strokeWidth={2}
              dot={{ r: 2, fill: s.color, strokeWidth: 0 }}
            />
          ))}
          {showLegend && series.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#96a4c0' }}
              iconSize={8}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
