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

const WARD_POINTS: Record<string, { lon: number; lat: number }> = {
  'Admin Ward 01 Aundh': { lon: 73.794912, lat: 18.546629 },
  'Admin Ward 02 Ghole Road': { lon: 73.838754, lat: 18.528272 },
  'Admin Ward 03 Kothrud Karveroad': { lon: 73.791945, lat: 18.507793 },
  'Admin Ward 04 Warje Karvenagar': { lon: 73.801629, lat: 18.486947 },
  'Admin Ward 05 Dhole Patil Rd': { lon: 73.901619, lat: 18.524145 },
  'Admin Ward 06 Yerawda - Sangamwadi': { lon: 73.902004, lat: 18.581501 },
  'Admin Ward 07 Nagar Road': { lon: 73.920051, lat: 18.558605 },
  'Admin Ward 08 KasbaVishrambaugwada': { lon: 73.855316, lat: 18.510498 },
  'Admin Ward 09 Tilak Road': { lon: 73.822011, lat: 18.470012 },
  'Admin Ward 10 Sahakarnagar': { lon: 73.851231, lat: 18.488732 },
  'Admin Ward 11 Bibwewadi': { lon: 73.867769, lat: 18.478054 },
  'Admin Ward 12 Bhavani Peth': { lon: 73.867657, lat: 18.511321 },
  'Admin Ward 13 Hadapsar': { lon: 73.924187, lat: 18.483092 },
  'Admin Ward 14 Dhankawadi': { lon: 73.858523, lat: 18.446191 },
  'Admin Ward 15 Kondhwa Wanavdi': { lon: 73.896593, lat: 18.483268 },
}

export interface Alert {
  ward: string
  level: 'watch' | 'warning' | 'critical'
  heatIndex: number
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
    const alerts: Alert[] = []
    const now = new Date().toISOString().slice(0, 13)

    // Check current conditions and forecast for each ward
    const wardsToCheck = wardName ? [wardName] : Object.keys(WARD_POINTS)

    for (const name of wardsToCheck) {
      const point = WARD_POINTS[name]
      if (!point) continue

      const wardForecast = await fetchWeatherForecast(point.lat, point.lon, 5)
      const current = wardForecast.hourly.find((h) => String(h.time).startsWith(String(now)))

      if (!current) continue

      const thermal = calculateThermalStress(
        current.temperature_2m,
        current.relative_humidity_2m,
        current.apparent_temperature
      )

      // Determine alert level
      let level: 'watch' | 'warning' | 'critical' = 'watch'
      let message = ''

      if (thermal.risk_level === 'extreme' || thermal.risk_level === 'danger') {
        level = 'critical'
        message = `CRITICAL: Heat Index ${thermal.heat_index}°C in ${name}. All outdoor work should stop.`
      } else if (thermal.risk_level === 'high') {
        level = 'warning'
        message = `WARNING: Heat Index ${thermal.heat_index}°C in ${name}. Reduce outdoor exertion.`
      } else if (thermal.risk_level === 'moderate') {
        level = 'watch'
        message = `WATCH: Heat Index ${thermal.heat_index}°C in ${name}. Stay hydrated.`
      }

      if (level !== 'watch' || thermal.heat_index >= 32) {
        alerts.push({
          ward: name,
          level,
          heatIndex: thermal.heat_index,
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
    })
  } catch (error) {
    console.error('Alerts API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate alerts' },
      { status: 500 }
    )
  }
}
