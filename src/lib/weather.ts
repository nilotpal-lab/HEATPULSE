/**
 * HeatPulse — Weather Service
 *
 * Fetches 5-day hourly forecast from Open-Meteo API for Pune.
 * No API key required. Returns parsed weather data.
 *
 * See: https://open-meteo.com/en/docs
 */

export interface HourlyWeather {
  time: string
  temperature_2m: number
  relative_humidity_2m: number
  apparent_temperature: number
  weather_code: number
}

export interface DailyWeather {
  time: string
  temperature_2m_max: number
  temperature_2m_min: number
  weather_code: number
}

export interface WeatherForecast {
  latitude: number
  longitude: number
  elevation: number
  timezone: string
  hourly: HourlyWeather[]
  daily: DailyWeather[]
  generated_at: string
}

// Pune centroid coordinates (from representative points)
export const PUNE_LAT = 18.5204
export const PUNE_LON = 73.8567
export const PUNE_TIMEZONE = 'Asia/Kolkata'

const OPEN_METEO_URL = process.env.NEXT_PUBLIC_OPEN_METEO_URL!

/**
 * Fetch 5-day weather forecast for Pune from Open-Meteo.
 * Uses the ward representative point if provided, otherwise uses Pune center.
 */
export async function fetchWeatherForecast(
  lat: number = PUNE_LAT,
  lon: number = PUNE_LON,
  forecastDays: number = 5
): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,weather_code',
    timezone: PUNE_TIMEZONE,
    forecast_days: forecastDays.toString(),
  })

  const response = await fetch(`${OPEN_METEO_URL}?${params}`)

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    elevation: data.elevation || 561,
    timezone: data.timezone,
    hourly: data.hourly.time.map((t: string, i: number) => ({
      time: t,
      temperature_2m: data.hourly.temperature_2m[i],
      relative_humidity_2m: data.hourly.relative_humidity_2m[i],
      apparent_temperature: data.hourly.apparent_temperature[i],
      weather_code: data.hourly.weather_code[i],
    })),
    daily: data.daily.time.map((t: string, i: number) => ({
      time: t,
      temperature_2m_max: data.daily.temperature_2m_max[i],
      temperature_2m_min: data.daily.temperature_2m_min[i],
      weather_code: data.daily.weather_code[i],
    })),
    generated_at: new Date().toISOString(),
  }
}

/**
 * WMO Weather Code interpretation
 * https://open-meteo.com/en/docs#weathervariables
 */
export function getWeatherDescription(code: number): string {
  const codes: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    66: 'Light freezing rain', 67: 'Heavy freezing rain',
    71: 'Slight snow fall', 73: 'Moderate snow fall', 75: 'Heavy snow fall',
    77: 'Snow grains', 80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
    85: 'Slight snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
  }
  return codes[code] ?? 'Unknown'
}

/**
 * Get current hour weather for a ward (nearest hour)
 */
export function getNowForecast(forecast: WeatherForecast): HourlyWeather | null {
  const now = new Date()
  const localNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const hourStr = localNow.toISOString().slice(0, 13) // 'YYYY-MM-DDTHH'
  return forecast.hourly.find((h) => h.time.startsWith(hourStr)) ?? null
}
