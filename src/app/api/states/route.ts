/**
 * HeatPulse — Pan-India State Telemetry API Route
 * GET /api/states
 *
 * Fetches real-time NWP (Open-Meteo) weather data for all 36 Indian State &
 * UT capitals and computes thermal stress metrics for each state.
 *
 * Response shape:
 * {
 *   states: Record<stateKey, StateThermalData>,
 *   fetchedAt: ISO string,
 *   status: 'fresh' | 'stale',
 *   attribution: string
 * }
 *
 * Cache TTL: 15 minutes (900 seconds) — aligns with NWP analysis update cadence.
 * Falls back to last successful fetch on upstream failure (stale mode).
 */

import { NextRequest, NextResponse } from 'next/server';
import { INDIA_STATE_CAPITALS } from '../../../lib/india-state-centroids';

const OPEN_METEO_BASE_URL =
  process.env.OPEN_METEO_URL ||
  process.env.NEXT_PUBLIC_OPEN_METEO_URL ||
  'https://api.open-meteo.com/v1/forecast';

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REQUEST_TIMEOUT_MS = 15000; // 15 seconds

export interface StateThermalData {
  stateKey: string;
  stateName: string;
  capital: string;
  temperature: number;
  humidity: number;
  apparentTemperature: number;
  heatIndex: number;
  wbgt: number;
  heatCondition: 'Normal' | 'Elevated' | 'High' | 'Extreme';
  thermalStress: 'Low' | 'Moderate' | 'High' | 'Severe';
  fetchedAt: string;
  status: 'fresh' | 'stale';
}

interface CacheEntry {
  data: Record<string, StateThermalData>;
  fetchedAt: string;
  expiresAt: number;
}

// Module-level cache (server-side in-memory, resets on cold start)
let cache: CacheEntry | null = null;

/**
 * Compute Heat Index (HI) from temperature (°C) and relative humidity (%).
 * Uses the Rothfusz regression (NOAA) adapted for Celsius.
 */
function computeHeatIndex(tempC: number, rh: number): number {
  // Convert to Fahrenheit for the standard Rothfusz regression
  const T = (tempC * 9) / 5 + 32;
  const RH = rh;

  // Simple Steadman formula if T < 80°F
  if (T < 80) {
    const hiF = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + RH * 0.094);
    return ((hiF - 32) * 5) / 9;
  }

  let HI =
    -42.379 +
    2.04901523 * T +
    10.14333127 * RH -
    0.22475541 * T * RH -
    0.00683783 * T * T -
    0.05481717 * RH * RH +
    0.00122874 * T * T * RH +
    0.00085282 * T * RH * RH -
    0.00000199 * T * T * RH * RH;

  // Adjustment for low RH
  if (RH < 13 && T >= 80 && T <= 112) {
    HI -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  }
  // Adjustment for high RH
  if (RH > 85 && T >= 80 && T <= 87) {
    HI += ((RH - 85) / 10) * ((87 - T) / 5);
  }

  // Convert back to Celsius
  return ((HI - 32) * 5) / 9;
}

/**
 * Compute simplified WBGT (Wet-Bulb Globe Temperature) estimate.
 * Uses the Liljegren approximation for field use:
 * WBGT ≈ 0.567 × T_db + 0.393 × e + 3.94
 * where e = vapour pressure (kPa) ≈ 0.611 × exp(17.27 × T / (T + 237.3)) × (RH/100)
 */
function computeWbgt(tempC: number, rh: number): number {
  const e = 0.611 * Math.exp((17.27 * tempC) / (tempC + 237.3)) * (rh / 100);
  return 0.567 * tempC + 0.393 * e + 3.94;
}

function classifyHeatCondition(tempC: number, hi: number): 'Normal' | 'Elevated' | 'High' | 'Extreme' {
  const t = Math.max(tempC, hi);
  if (t >= 54) return 'Extreme';
  if (t >= 41) return 'High';
  if (t >= 32) return 'Elevated';
  return 'Normal';
}

function classifyThermalStress(wbgt: number): 'Low' | 'Moderate' | 'High' | 'Severe' {
  if (wbgt >= 32) return 'Severe';
  if (wbgt >= 30) return 'High';
  if (wbgt >= 28) return 'Moderate';
  return 'Low';
}

/**
 * Fetches Open-Meteo for all state capitals in a single batched request.
 */
async function fetchAllStateMetrics(): Promise<Record<string, StateThermalData>> {
  const lats = INDIA_STATE_CAPITALS.map((s) => s.coordinates[1].toFixed(4)).join(',');
  const lons = INDIA_STATE_CAPITALS.map((s) => s.coordinates[0].toFixed(4)).join(',');

  const params = new URLSearchParams({
    latitude: lats,
    longitude: lons,
    hourly: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
    ].join(','),
    forecast_days: '2',
    timezone: 'Asia/Kolkata',
  });

  const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let rawResults: Array<{
    latitude: number;
    longitude: number;
    hourly: {
      time: string[];
      temperature_2m: number[];
      relative_humidity_2m: number[];
      apparent_temperature: number[];
    };
  }>;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    rawResults = Array.isArray(json) ? json : [json];
  } finally {
    clearTimeout(timeoutId);
  }

  const now = new Date();
  // Find the current hour slot in Indian Standard Time (Asia/Kolkata / UTC+5:30)
  // Formats to 'YYYY-MM-DDTHH' in IST so at 23:30 IST it matches the 23:00 forecast hour (not 18:00 UTC)
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = istFormatter.formatToParts(now);
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const istHour = partMap.hour === '24' ? '00' : partMap.hour;
  const targetHour = `${partMap.year}-${partMap.month}-${partMap.day}T${istHour}`;

  const fetchedAt = now.toISOString();
  const result: Record<string, StateThermalData> = {};

  for (let i = 0; i < INDIA_STATE_CAPITALS.length; i++) {
    const state = INDIA_STATE_CAPITALS[i];
    const raw = rawResults[i];

    if (!raw || !raw.hourly) {
      continue;
    }

    const times = raw.hourly.time;
    let idx = times.findIndex((t) => t.startsWith(targetHour));
    if (idx === -1) {
      // Find the closest available time slot to the current timestamp instead of arbitrary noon
      let closestIdx = 0;
      let minDiff = Infinity;
      const nowMs = now.getTime();
      for (let t = 0; t < times.length; t++) {
        const slotMs = new Date(`${times[t]}:00+05:30`).getTime();
        const diff = Math.abs(nowMs - slotMs);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = t;
        }
      }
      idx = closestIdx;
    }

    const tempC = raw.hourly.temperature_2m[idx] ?? 30;
    const rh = raw.hourly.relative_humidity_2m[idx] ?? 50;
    const apparentTempC = raw.hourly.apparent_temperature[idx] ?? tempC;

    const hi = computeHeatIndex(tempC, rh);
    const wbgt = computeWbgt(tempC, rh);

    result[state.stateKey] = {
      stateKey: state.stateKey,
      stateName: state.stateName,
      capital: state.capital,
      temperature: Math.round(tempC * 10) / 10,
      humidity: Math.round(rh),
      apparentTemperature: Math.round(apparentTempC * 10) / 10,
      heatIndex: Math.round(hi * 10) / 10,
      wbgt: Math.round(wbgt * 10) / 10,
      heatCondition: classifyHeatCondition(tempC, hi),
      thermalStress: classifyThermalStress(wbgt),
      fetchedAt,
      status: 'fresh',
    };
  }

  return result;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isRefresh =
    searchParams.get('refresh') === 'true' ||
    request.headers.get('cache-control')?.toLowerCase().includes('no-cache');

  // 1. Serve cached data if still valid
  if (!isRefresh && cache && Date.now() < cache.expiresAt) {
    return NextResponse.json(
      {
        states: cache.data,
        fetchedAt: cache.fetchedAt,
        status: 'fresh',
        attribution: 'Open-Meteo NWP — state capital point forecast (ERA5 + ICON)',
        stateCount: Object.keys(cache.data).length,
      },
      {
        status: 200,
        headers: {
          'X-States-Status': 'fresh',
          'X-States-Count': String(Object.keys(cache.data).length),
          'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
        },
      }
    );
  }

  // 2. Fetch fresh data
  try {
    const data = await fetchAllStateMetrics();
    const fetchedAt = new Date().toISOString();

    cache = {
      data,
      fetchedAt,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return NextResponse.json(
      {
        states: data,
        fetchedAt,
        status: 'fresh',
        attribution: 'Open-Meteo NWP — state capital point forecast (ERA5 + ICON)',
        stateCount: Object.keys(data).length,
      },
      {
        status: 200,
        headers: {
          'X-States-Status': 'fresh',
          'X-States-Count': String(Object.keys(data).length),
          'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
        },
      }
    );
  } catch (err) {
    // 3. Stale fallback if we have prior cache
    if (cache) {
      console.warn(
        '[StatesAPI] Open-Meteo fetch failed; serving stale state cache:',
        err instanceof Error ? err.message : err
      );

      const staleData: Record<string, StateThermalData> = {};
      for (const key of Object.keys(cache.data)) {
        staleData[key] = { ...cache.data[key], status: 'stale' };
      }

      return NextResponse.json(
        {
          states: staleData,
          fetchedAt: cache.fetchedAt,
          status: 'stale',
          attribution: 'Open-Meteo NWP — stale cached state data',
          stateCount: Object.keys(staleData).length,
        },
        {
          status: 200,
          headers: {
            'X-States-Status': 'stale',
            'X-States-Count': String(Object.keys(staleData).length),
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          },
        }
      );
    }

    // 4. No cache available — 503
    console.error(
      '[StatesAPI] Open-Meteo fetch failed with zero fallback:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      {
        error: 'State telemetry temporarily unavailable',
        message: err instanceof Error ? err.message : 'Unknown upstream error',
      },
      { status: 503 }
    );
  }
}
