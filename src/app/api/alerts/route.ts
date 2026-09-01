/**
 * HeatPulse — Alerts API Route
 * GET /api/alerts?ward=Admin%20Ward%2001%20Aundh
 *
 * Returns active heat alerts for a ward based on risk thresholds.
 */
import { NextRequest, NextResponse } from 'next/server'
import { fetchWeatherForecast } from '@/lib/weather'
import { calculateThermalStress } from '@/lib/thermal'
import { PUNE_CENTER } from '@/lib/map-config'
import { WARD_POINTS, calculateWardRisk } from '@/lib/risk'

export interface Alert {
  ward: string
  level: 'watch' | 'warning' | 'critical'
  heatIndex: number
  compositeRisk: number
  timestamp: string
  message: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const wardName = String(searchParams.get('ward') ?? '')
  const lat = parseFloat(searchParams.get('lat') ?? String(PUNE_CENTER[1]))
  const lon = parseFloat(searchParams.get('lon') ?? String(PUNE_CENTER[0]))

  try {
    const forecast = await fetchWeatherForecast(lat, lon, 5)

    // Open-Meteo returns hourly times in Asia/Kolkata (IST).
    // Compute IST now for matching; fall back to UTC prefix.
    const utcNow = new Date().toISOString().slice(0, 13)
    const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 13)

    const currentReading =
      forecast.hourly.find((h) => h.time.startsWith(istNow)) ??
      forecast.hourly.find((h) => h.time.startsWith(utcNow)) ??
      forecast.hourly[0]

    if (!currentReading) {
      return NextResponse.json({ error: 'No weather data available' }, { status: 502 })
    }

    const thermal = calculateThermalStress(
      currentReading.temperature_2m,
      currentReading.relative_humidity_2m,
      currentReading.apparent_temperature
    )

    const wardsToCheck = wardName ? [wardName] : Object.keys(WARD_POINTS)
    const alerts: Alert[] = []

    for (const name of wardsToCheck) {
      const point = WARD_POINTS[name]
      if (!point) continue

      const risk = calculateWardRisk(name, point.lon, point.lat, {
        heatIndex: thermal.heat_index,
        wbgt: thermal.wbgt_estimated,
        riskLevel: thermal.risk_level,
      })

      // Map thermal risk_level to alert level
      let level: 'watch' | 'warning' | 'critical' = 'watch'
      let message = ''

      if (thermal.risk_level === 'extreme' || thermal.risk_level === 'danger') {
        level = 'critical'
        message = `CRITICAL: Heat Index ${thermal.heat_index}°C in ${name}. All outdoor work should stop immediately.`
      } else if (thermal.risk_level === 'high') {
        level = 'warning'
        message = `WARNING: Heat Index ${thermal.heat_index}°C in ${name}. Reduce outdoor exertion and stay hydrated.`
      } else if (thermal.risk_level === 'moderate') {
        level = 'watch'
        message = `WATCH: Heat Index ${thermal.heat_index}°C in ${name}. Monitor conditions and limit prolonged outdoor exposure.`
      }

      // Always include if risk >= moderate, or if composite risk >= 50
      if (thermal.heat_index >= 27 || risk.compositeRisk >= 50) {
        alerts.push({
          ward: name,
          level,
          heatIndex: thermal.heat_index,
          compositeRisk: risk.compositeRisk,
          timestamp: thermal.calculated_at,
          message,
        })
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, watch: 2 }
    alerts.sort((a, b) => severityOrder[a.level] - severityOrder[b.level])

    return NextResponse.json({
      generated_at: forecast.generated_at,
      alerts,
      alertCount: alerts.length,
      summary: {
        maxHeatIndex: thermal.heat_index,
        maxCompositeRisk: Math.max(...alerts.map((a) => a.compositeRisk), 0),
        criticalCount: alerts.filter((a) => a.level === 'critical').length,
        warningCount: alerts.filter((a) => a.level === 'warning').length,
        watchCount: alerts.filter((a) => a.level === 'watch').length,
      },
    })
  } catch (error) {
    console.error('Alerts API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate alerts' },
      { status: 500 }
    )
  }
}
