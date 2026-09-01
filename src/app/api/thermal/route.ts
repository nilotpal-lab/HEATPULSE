/**
 * HeatPulse — Thermal Stress API Route
 * GET /api/thermal?lat=18.52&lon=73.86
 */
import { NextRequest, NextResponse } from 'next/server'
import { fetchWeatherForecast } from '@/lib/weather'
import { calculateHourlyThermalForecast } from '@/lib/thermal'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') ?? '18.5204')
  const lon = parseFloat(searchParams.get('lon') ?? '73.8567')

  try {
    const forecast = await fetchWeatherForecast(lat, lon, 5)
    const thermalData = calculateHourlyThermalForecast(forecast)

    return NextResponse.json({
      location: { latitude: lat, longitude: lon },
      generated_at: forecast.generated_at,
      hourly: thermalData,
      summary: {
        maxHeatIndex: Math.round(Math.max(...thermalData.map((t) => t.heat_index)) * 10) / 10,
        minHeatIndex: Math.round(Math.min(...thermalData.map((t) => t.heat_index)) * 10) / 10,
        currentRiskLevel: thermalData[0]?.risk_level ?? 'low',
        peakHour: thermalData.reduce((max, t) => (t.heat_index > (max?.heat_index ?? 0) ? t : max), thermalData[0]),
      },
    })
  } catch (error) {
    console.error('Thermal API error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate thermal stress' },
      { status: 500 }
    )
  }
}
