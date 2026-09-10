/**
 * HeatPulse — Weather Service & API Entry Point
 * Implements Milestone 3 / Requirement R3:
 *   - Unified weather module for HeatPulse
 *   - Re-exports persistent cache, batched service, and types
 *   - Backward compatible with existing route consumers
 */

export * from '../types/weather';
export * from './weather-cache';
export * from './weather-service';

import {
  WeatherForecast,
  HourlyWeather,
} from '../types/weather';
import { fetchPointWeatherForecast } from './weather-service';

// Pune centroid coordinates (from representative points)
export const PUNE_LAT = 18.5204;
export const PUNE_LON = 73.8567;
export const PUNE_TIMEZONE = 'Asia/Kolkata';

/**
 * Fetch 5-day weather forecast from Open-Meteo with NWP run metadata and attribution.
 * Backward compatible with existing route consumers.
 */
export async function fetchWeatherForecast(
  lat: number = PUNE_LAT,
  lon: number = PUNE_LON,
  forecastDays: number = 5
): Promise<WeatherForecast> {
  return fetchPointWeatherForecast(lat, lon, forecastDays);
}

/**
 * WMO Weather Code interpretation
 * https://open-meteo.com/en/docs#weathervariables
 */
export function getWeatherDescription(code: number): string {
  const codes: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  return codes[code] ?? 'Unknown';
}

/**
 * Get current hour weather for a forecast (nearest active hour in IST)
 */
export function getNowForecast(forecast: WeatherForecast): HourlyWeather | null {
  if (!forecast?.hourly || forecast.hourly.length === 0) return null;

  try {
    const now = new Date();
    const istDate = now.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    });
    const istHour = now.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hour12: false,
    });
    const targetPrefix = `${istDate}T${istHour}`;

    const match = forecast.hourly.find((h) => h.time.startsWith(targetPrefix));
    if (match) return match;

    const utcPrefix = now.toISOString().slice(0, 13);
    const utcMatch = forecast.hourly.find((h) => h.time.startsWith(utcPrefix));
    if (utcMatch) return utcMatch;

    return forecast.hourly[0];
  } catch {
    return forecast.hourly[0] ?? null;
  }
}
