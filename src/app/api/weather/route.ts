/**
 * HeatPulse — Weather API Route
 * GET /api/weather?lat=18.52&lon=73.86&days=5
 */
import { NextRequest, NextResponse } from 'next/server'
import { fetchWeatherForecast } from '@/lib/weather'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') ?? '18.5204')
  const lon = parseFloat(searchParams.get('lon') ?? '73.8567')
  const days = parseInt(searchParams.get('days') ?? '5')

  try {
    const forecast = await fetchWeatherForecast(lat, lon, days)
    return NextResponse.json(forecast)
  } catch (error) {
    console.error('Weather API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    )
  }
}
