/**
 * HeatPulse — 120h Thermal Forecast Timeline
 *
 * Renders an interactive sparkline-style chart of Heat Index,
 * WBGT, and UTCI across the full 5-day (120h) forecast window.
 * Clicking a point drills into that hour's thermal reading.
 *
 * No external chart library — pure CSS + SVG for minimal bundle.
 */
import { useEffect, useRef, useState } from 'react'
import { getRiskColor } from '@/lib/risk'
import type { RiskLevel } from '@/lib/thermal'

export interface ThermalHourlyPoint {
  time: string
  temperature: number
  humidity: number
  apparent_temperature: number
  heat_index: number
  wbgt_estimated: number
  utc_index: number
  risk_level: RiskLevel
  risk_label: string
  recommendations: string[]
  calculated_at: string
}

interface TimelineProps {
  data: ThermalHourlyPoint[]
  selectedPoint: ThermalHourlyPoint | null
  onPointSelect: (point: ThermalHourlyPoint) => void
}

const CHART_HEIGHT = 120
const PADDING_TOP = 10
const PADDING_BOTTOM = 24
const PADDING_LEFT = 8
const PADDING_RIGHT = 8

/** Extract date+time labels for every 6th hour */
function formatHourLabel(time: string): string {
  const d = new Date(time)
  const day = d.getDate()
  const month = d.toLocaleString('en-IN', { month: 'short' })
  const hour = d.getHours()
  const ampm = hour >= 12 ? 'P' : 'A'
  const h = hour % 12 || 12
  return `${day} ${month} ${h}${ampm}`
}

function isDayChange(times: string[], i: number): boolean {
  if (i === 0) return true
  const prev = new Date(times[i - 1])
  const curr = new Date(times[i])
  return prev.getDate() !== curr.getDate()
}

export default function TimelineSlider({ data, selectedPoint, onPointSelect }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.floor(entry.contentRect.width))
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (!data.length) {
    return (
      <div className="h-32 flex items-center justify-center text-zinc-400 text-xs">
        No thermal forecast data
      </div>
    )
  }

  const width = containerWidth || 600
  const chartW = width - PADDING_LEFT - PADDING_RIGHT
  const chartH = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const n = data.length

  // Y scale: heat index range mapped to chart height
  const hiValues = data.map((d) => d.heat_index)
  const hiMin = Math.min(...hiValues) - 2
  const hiMax = Math.max(...hiValues) + 2
  const hiRange = hiMax - hiMin || 1

  const yScale = (val: number) => PADDING_TOP + chartH - ((val - hiMin) / hiRange) * chartH

  // Build SVG path for heat index line
  const points = data.map((d, i) => {
    const x = PADDING_LEFT + (i / (n - 1)) * chartW
    const y = yScale(d.heat_index)
    return { x, y, ...d, index: i }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  // Area fill under the line
  const areaPath =
    linePath +
    ` L ${points[points.length - 1]?.x.toFixed(1) ?? 0} ${PADDING_TOP + chartH} L ${points[0]?.x.toFixed(1) ?? 0} ${PADDING_TOP + chartH} Z`

  // Risk band colors for background
  const riskBandColors: Record<string, string> = {
    low: 'rgba(34,197,94,0.06)',
    moderate: 'rgba(59,130,246,0.08)',
    high: 'rgba(245,158,11,0.12)',
    extreme: 'rgba(234,88,12,0.18)',
    danger: 'rgba(220,38,38,0.25)',
  }

  // Day separator lines
  const daySeparators = data
    .map((d, i) => ({ ...d, index: i }))
    .filter((d) => isDayChange(data.map((x) => x.time), d.index))

  // Y-axis labels
  const ySteps = 5
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const val = hiMin + (hiRange * i) / ySteps
    return { y: yScale(val), label: `${Math.round(val)}°C` }
  })

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null
  const displayPoint = selectedPoint ?? hoveredPoint

  // Aggregate stats
  const maxHI = Math.max(...hiValues)
  const minHI = Math.min(...hiValues)
  const avgHI = Math.round((hiValues.reduce((a, b) => a + b, 0) / n) * 10) / 10
  const peakPoint = data[hiValues.indexOf(maxHI)]

  return (
    <div className="space-y-2">
      {/* Stats row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500">Peak HI:</span>
          <span className="text-sm font-bold text-zinc-900">{maxHI.toFixed(1)}°C</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: getRiskColor(peakPoint.risk_level),
              color: '#fff',
            }}
          >
            {peakPoint.risk_label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span>Min: {minHI.toFixed(1)}°C</span>
          <span>·</span>
          <span>Avg: {avgHI.toFixed(1)}°C</span>
        </div>
        {displayPoint && (
          <div className="ml-auto text-xs text-zinc-600">
            <span className="font-medium">{formatHourLabel(displayPoint.time)}</span>
            <span className="text-zinc-400"> · HI </span>
            <span className="font-bold">{displayPoint.heat_index.toFixed(1)}°C</span>
            <span className="text-zinc-400"> WBGT </span>
            <span className="font-medium">{displayPoint.wbgt_estimated.toFixed(1)}°C</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        className="relative select-none cursor-crosshair"
        style={{ height: CHART_HEIGHT + PADDING_BOTTOM + 4 }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <svg
          width={width}
          height={CHART_HEIGHT + PADDING_BOTTOM}
          className="block"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const mx = e.clientX - rect.left - PADDING_LEFT
            const idx = Math.round((mx / chartW) * (n - 1))
            setHoveredIndex(Math.max(0, Math.min(n - 1, idx)))
          }}
        >
          {/* Risk background bands */}
          {points.map((p, i) => {
            const color = riskBandColors[p.risk_level] ?? 'transparent'
            const x = p.x
            const w = i < n - 1 ? Math.max(points[i + 1].x - x, 1) : chartW / n
            return <rect key={`band-${i}`} x={x} y={PADDING_TOP} width={w} height={chartH} fill={color} />
          })}

          {/* Day separators */}
          {daySeparators.map((d) => (
            <line
              key={`day-${d.index}`}
              x1={points[d.index]?.x ?? 0}
              y1={PADDING_TOP}
              x2={points[d.index]?.x ?? 0}
              y2={PADDING_TOP + chartH}
              stroke="rgba(0,0,0,0.12)"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          ))}

          {/* Y-axis grid lines */}
          {yLabels.map((label, i) => (
            <g key={`grid-${i}`}>
              <line
                x1={PADDING_LEFT}
                y1={label.y}
                x2={width - PADDING_RIGHT}
                y2={label.y}
                stroke="rgba(0,0,0,0.06)"
                strokeWidth={1}
              />
              <text
                x={PADDING_LEFT - 3}
                y={label.y + 3}
                textAnchor="end"
                fontSize={8}
                fill="rgba(0,0,0,0.4)"
              >
                {label.label}
              </text>
            </g>
          ))}

          {/* Area fill */}
          <path d={areaPath} fill="url(#hi-gradient)" opacity={0.5} />

          {/* HI line */}
          <path d={linePath} fill="none" stroke="url(#hi-line-gradient)" strokeWidth={1.8} strokeLinejoin="round" />

          {/* Hovered point indicator */}
          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1={PADDING_TOP}
                x2={hoveredPoint.x}
                y2={PADDING_TOP + chartH}
                stroke="rgba(0,0,0,0.25)"
                strokeWidth={1}
                strokeDasharray="2,2"
              />
              <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r={4} fill={getRiskColor(hoveredPoint.risk_level)} stroke="#fff" strokeWidth={1.5} />
            </g>
          )}

          {/* Selected point indicator */}
          {selectedPoint && (() => {
            const idx = data.indexOf(selectedPoint)
            if (idx < 0 || !points[idx]) return null
            const sp = points[idx]
            return (
              <g>
                <circle cx={sp.x} cy={sp.y} r={5} fill={getRiskColor(sp.risk_level)} stroke="#fff" strokeWidth={2} />
              </g>
            )
          })()}

          {/* X-axis labels (every 24h) */}
          {data
            .map((d, i) => ({ ...d, index: i }))
            .filter((d) => d.index % 24 === 0)
            .map((d) => {
              const p = points[d.index]
              if (!p) return null
              return (
                <text
                  key={`xl-${d.index}`}
                  x={p.x}
                  y={CHART_HEIGHT + PADDING_BOTTOM - 2}
                  textAnchor="middle"
                  fontSize={8}
                  fill="rgba(0,0,0,0.5)"
                >
                  {formatHourLabel(d.time)}
                </text>
              )
            })}

          {/* Gradients */}
          <defs>
            <linearGradient id="hi-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(234,88,12,0.3)" />
              <stop offset="100%" stopColor="rgba(234,88,12,0.02)" />
            </linearGradient>
            <linearGradient id="hi-line-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="30%" stopColor="#3b82f6" />
              <stop offset="60%" stopColor="#f59e0b" />
              <stop offset="85%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
          </defs>
        </svg>

        {/* Legend strip */}
        <div className="flex items-center gap-2 mt-1 px-1">
          {(['low', 'moderate', 'high', 'extreme', 'danger'] as RiskLevel[]).map((level) => (
            <div key={level} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getRiskColor(level) }} />
              <span className="text-[9px] text-zinc-500 capitalize">{level}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip detail for hovered/selected point */}
      {displayPoint && (
        <div className="bg-zinc-50 rounded-lg p-3 text-xs space-y-1.5 border border-zinc-100">
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-700">{formatHourLabel(displayPoint.time)}</span>
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: getRiskColor(displayPoint.risk_level) }}
            >
              {displayPoint.risk_label}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-zinc-600">
            <div>
              <span className="text-zinc-400">Temp</span>{' '}
              <span className="font-medium text-zinc-900">{displayPoint.temperature.toFixed(1)}°C</span>
            </div>
            <div>
              <span className="text-zinc-400">HI</span>{' '}
              <span className="font-medium text-zinc-900">{displayPoint.heat_index.toFixed(1)}°C</span>
            </div>
            <div>
              <span className="text-zinc-400">WBGT</span>{' '}
              <span className="font-medium text-zinc-900">{displayPoint.wbgt_estimated.toFixed(1)}°C</span>
            </div>
            <div>
              <span className="text-zinc-400">UTCI</span>{' '}
              <span className="font-medium text-zinc-900">{displayPoint.utc_index.toFixed(1)}°C</span>
            </div>
            <div>
              <span className="text-zinc-400">Humidity</span>{' '}
              <span className="font-medium text-zinc-900">{displayPoint.humidity}%</span>
            </div>
            <div>
              <span className="text-zinc-400">Apparent</span>{' '}
              <span className="font-medium text-zinc-900">{displayPoint.apparent_temperature.toFixed(1)}°C</span>
            </div>
          </div>
          <div className="pt-1 border-t border-zinc-200 space-y-0.5">
            {displayPoint.recommendations.map((r, i) => (
              <div key={i} className="text-zinc-500 flex items-start gap-1">
                <span className="text-zinc-400 shrink-0">·</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
