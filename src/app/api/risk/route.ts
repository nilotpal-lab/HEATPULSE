/**
 * HeatPulse — Ward Risk API Route
 * GET /api/risk?lat=18.52&lon=73.86&ward=Admin%20Ward%2001%20Aundh
 */
import { NextRequest, NextResponse } from 'next/server'
import { fetchWeatherForecast } from '@/lib/weather'
import { calculateThermalStress } from '@/lib/thermal'
import { calculateWardRisk } from '@/lib/risk'
import { PUNE_CENTER } from '@/lib/map-config'

// Ward representative points from data/processed/
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const wardName = String(searchParams.get('ward') ?? '')
  const lat = parseFloat(searchParams.get('lat') ?? String(PUNE_CENTER[1]))
  const lon = parseFloat(searchParams.get('lon') ?? String(PUNE_CENTER[0]))

  try {
    const forecast = await fetchWeatherForecast(lat, lon, 5)

    if (wardName && WARD_POINTS[wardName]) {
      // Single ward risk
      const point = WARD_POINTS[wardName]
      const wardForecast = await fetchWeatherForecast(point.lat, point.lon, 5)
      const thermalNow = forecast.hourly.find((h) => h.time.startsWith(new Date().toISOString().slice(0, 13)))

      if (!thermalNow) {
        return NextResponse.json({ error: 'No current weather data available' }, { status: 400 })
      }

      const thermal = calculateThermalStress(
        thermalNow.temperature_2m,
        thermalNow.relative_humidity_2m,
        thermalNow.apparent_temperature
      )

      const risk = calculateWardRisk(wardName, point.lon, point.lat, {
        heatIndex: thermal.heat_index,
        wbgt: thermal.wbgt_estimated,
        riskLevel: thermal.risk_level,
      })

      return NextResponse.json(risk)
    }

    // All wards risk summary
    const allRisk = Object.entries(WARD_POINTS).map(([name, point]) => {
      // Use city-wide forecast as baseline (ward-level would need per-ward weather)
      const thermalNow = forecast.hourly.find((h) => h.time.startsWith(new Date().toISOString().slice(0, 13)))
      if (!thermalNow) return null

      const thermal = calculateThermalStress(
        thermalNow.temperature_2m,
        thermalNow.relative_humidity_2m,
        thermalNow.apparent_temperature
      )

      return calculateWardRisk(name, point.lon, point.lat, {
        heatIndex: thermal.heat_index,
        wbgt: thermal.wbgt_estimated,
        riskLevel: thermal.risk_level,
      })
    }).filter(Boolean)

    return NextResponse.json({
      generated_at: forecast.generated_at,
      wards: allRisk,
      maxRisk: Math.max(...(allRisk.map((r) => r!.compositeRisk))),
      minRisk: Math.min(...(allRisk.map((r) => r!.compositeRisk))),
      avgRisk: Math.round((allRisk.reduce((s, r) => s + r!.compositeRisk, 0) / allRisk.length) * 10) / 10,
    })
  } catch (error) {
    console.error('Risk API error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate risk' },
      { status: 500 }
    )
  }
}
