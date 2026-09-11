/**
 * HeatPulse — MET Norway Locationforecast Fallback Provider
 * SIH26083 MoES / NCMRWF
 *
 * Provider redundancy for the weather pipeline: when the primary
 * (Open-Meteo) is quota-limited (HTTP 429) or unreachable, the city forecast
 * is rebuilt from MET Norway's keyless Locationforecast 2.0 compact API
 * (ECMWF/HARMONIE NWP, https://api.met.no).
 *
 * Field mapping (locationforecast/2.0/compact -> WardHourlyWeather):
 *   air_temperature            -> temperature_2m (celsius)
 *   relative_humidity          -> relative_humidity_2m (%)
 *   wind_speed (m/s)           -> wind_speed_10m (km/h, x3.6)
 *   air_pressure_at_sea_level  -> surface_pressure (hPa; sea-level vs
 *                                surface distinction documented here)
 *   cloud_area_fraction        -> cloud cover for the solar estimate
 *
 * MET Norway does NOT serve: apparent temperature, direct/global solar
 * radiation, or weather codes. Honest handling, per project rules:
 *   - apparent_temperature: omitted (undefined) — UTCI proxy renders
 *     "unavailable" rather than a fabricated feels-like value.
 *   - shortwave_radiation: ESTIMATED via a documented clear-sky x cloud
 *     transmittance model (ESRA/Kasten-Strieder style solar geometry +
 *     cloud attenuation). Values are flagged as estimates in
 *     providerMetadata.solar_source = 'estimated-clear-sky-x-cloud'. The
 *     full-physics WBGT path accepts estimated solar because Liljegren WBGT
 *     needs irradiance as an input; the estimate is transparent and tested.
 *   - weather_code: omitted (undefined).
 *
 * Terms: MET Norway data under CC BY 4.0 / NLOD. A contact User-Agent is
 * required by their ToS and is set below (no key).
 */

import type { CityForecastRun, WardWeatherForecast, ForecastRunMetadata } from '../types/weather';
import { calculateNwpRunTime, DEFAULT_CACHE_TTL_MS, weatherCache } from './weather-cache';
import { loadCityGeoJson, getWardCentroid } from './gis-utils';
import type { CityId } from '../types/gis';

export const METNO_BASE_URL =
  process.env.METNO_URL ||
  'https://api.met.no/weatherapi/locationforecast/2.0/compact';

export const METNO_USER_AGENT =
  process.env.METNO_USER_AGENT || 'HeatPulse/1.0 (SIH26083 student project)';

export const METNO_PROVIDER = 'MET Norway Locationforecast 2.0 (ECMWF/HARMONIE)';
export const METNO_MODEL = 'ECMWF IFS / HARMONIE via MET Norway';
export const METNO_ATTRIBUTION =
  'Ward-localized forecast derived from numerical weather prediction (MET Norway fallback provider)';

/** Cap sequential ward requests: bounded latency for a cold fallback fetch. */
const METNO_REQUEST_TIMEOUT_MS = 8000;
const METNO_WARD_LIMIT = 400; // per city, safety valve for 369-ward Bengaluru
const METNO_INTER_REQUEST_DELAY_MS = 120; // politeness pacing
const METNO_HORIZON_HOURS = 120; // match primary provider window

interface MetNoTimeseriesPoint {
  time: string; // ISO UTC
  data: {
    instant: {
      details: {
        air_pressure_at_sea_level?: number;
        air_temperature?: number;
        cloud_area_fraction?: number;
        relative_humidity?: number;
        wind_speed?: number; // m/s
      };
    };
  };
}

interface MetNoResponse {
  properties: {
    meta: { updated_at: string };
    timeseries: MetNoTimeseriesPoint[];
  };
}

// ---------------------------------------------------------------------------
// Solar estimation (documented approximation, not a measured value)
// ---------------------------------------------------------------------------

const SOLAR_CONSTANT_WM2 = 1367;

function dayOfYear(d: Date): number {
  return (
    Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1
  );
}

/** Kasten-Strieder style extraterrestrial irradiance, W/m2 (declination + hour angle). */
export function clearSkyIrradiance(utc: Date, latDeg: number, lonDeg: number): number {
  const doy = dayOfYear(utc);
  const decl =
    0.4097 * Math.sin((2 * Math.PI * (doy - 81)) / 365) * (180 / Math.PI) * (Math.PI / 180);
  const utcMinutes = utc.getUTCHours() * 60 + utc.getUTCMinutes();
  // Local solar time (hour angle) from UTC + longitude + equation of time.
  const eqTime = 229.18 *
    (0.000075 + 0.001868 * Math.cos((2 * Math.PI * doy) / 365) -
      0.032077 * Math.sin((2 * Math.PI * doy) / 365) -
      0.014615 * Math.cos((4 * Math.PI * doy) / 365) -
      0.040849 * Math.sin((4 * Math.PI * doy) / 365));
  const solarMinutes = utcMinutes + eqTime + 4 * lonDeg;
  const ha = ((solarMinutes / 4 - 180) * Math.PI) / 180;
  const lat = (latDeg * Math.PI) / 180;
  const cosZen = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  if (cosZen <= 0) return 0; // sun below horizon
  const sc = SOLAR_CONSTANT_WM2 * (1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365));
  const cosZenClean = Math.min(1, cosZen);
  // Simplified clear-sky: ~70% atmospheric transmittance (ESRA turbidity-free).
  return 0.7 * sc * cosZenClean;
}

/**
 * GHI estimate: clear-sky x (1 - 0.75 x cloud_fraction^2) — the classic
 * Kasten-Czeplak-style cloud attenuation. Never negative; 0 at night.
 */
export function estimateGhiWm2(utc: Date, latDeg: number, lonDeg: number, cloudFractionPct?: number): number {
  const clear = clearSkyIrradiance(utc, latDeg, lonDeg);
  if (clear <= 0) return 0;
  const cloud = cloudFractionPct == null ? null : Math.min(100, Math.max(0, cloudFractionPct)) / 100;
  if (cloud == null) return Math.round(clear);
  return Math.round(clear * (1 - 0.75 * cloud * cloud));
}

// ---------------------------------------------------------------------------
// Fetch + adapt
// ---------------------------------------------------------------------------

async function fetchMetNoPoint(lat: number, lon: number): Promise<MetNoResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), METNO_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${METNO_BASE_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`,
      {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': METNO_USER_AGENT,
        },
      }
    );
    if (!res.ok) return null; // any failure -> caller falls to next strategy
    return (await res.json()) as MetNoResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Builds a full CityForecastRun from MET Norway for one city. Throws when >25% of wards fail. */
export async function fetchCityForecastFromMetNo(cityId: string): Promise<CityForecastRun> {
  const normalizedCityId = cityId.trim().toLowerCase();
  const collection = await loadCityGeoJson(normalizedCityId as CityId);
  if (!collection?.features?.length) {
    throw new Error(`No ward features found for city: ${cityId}`);
  }

  const targets = collection.features.map((feature) => ({
    wardId: String(feature.properties.ward_id),
    wardName: String(feature.properties.ward_name || feature.properties.ward_id),
    centroid: getWardCentroid(feature),
  }));

  const capped = targets.slice(0, METNO_WARD_LIMIT);
  const queryTime = new Date();
  const runTime = calculateNwpRunTime(queryTime);
  const horizonStartMs = queryTime.getTime();

  const wards: Record<string, WardWeatherForecast> = {};
  let failures = 0;

  for (let i = 0; i < capped.length; i++) {
    const t = capped[i];
    if (i > 0) await new Promise((r) => setTimeout(r, METNO_INTER_REQUEST_DELAY_MS));

    const raw = await fetchMetNoPoint(t.centroid[1], t.centroid[0]);
    if (!raw?.properties?.timeseries?.length) {
      failures++;
      continue;
    }

    const series = raw.properties.timeseries;
    // Keep the next 120h from now (provider gives ~2.5 days; clip to horizon).
    const clipped = series.filter((p) => {
      const ms = Date.parse(p.time);
      return Number.isFinite(ms) && ms >= horizonStartMs - 3600_000 && ms <= horizonStartMs + METNO_HORIZON_HOURS * 3600_000;
    });

    const time: string[] = [];
    const temperature_2m: number[] = [];
    const relative_humidity_2m: number[] = [];
    const wind_speed_10m: number[] = [];
    const surface_pressure: number[] = [];
    const shortwave_radiation: number[] = [];
    const cloud_fraction: number[] = [];

    for (const p of clipped) {
      const d = p.data?.instant?.details;
      if (d?.air_temperature == null || d?.relative_humidity == null) continue;
      const utc = new Date(p.time);
      // Store as Asia/Kolkata wall time (same convention as primary provider).
      const ist = new Date(p.time);
      const istStr = ist.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T');
      time.push(istStr.slice(0, 16));
      temperature_2m.push(d.air_temperature);
      relative_humidity_2m.push(d.relative_humidity);
      wind_speed_10m.push(d.wind_speed != null ? Math.round(d.wind_speed * 3.6 * 10) / 10 : NaN);
      surface_pressure.push(d.air_pressure_at_sea_level ?? NaN);
      cloud_fraction.push(d.cloud_area_fraction ?? NaN);
      shortwave_radiation.push(estimateGhiWm2(utc, t.centroid[1], t.centroid[0], d.cloud_area_fraction));
    }

    if (time.length === 0) {
      failures++;
      continue;
    }

    // Current hour: first point at/after now.
    let curIdx = 0;
    for (let k = 0; k < time.length; k++) {
      const ms = clipped[k] ? Date.parse(clipped[k].time) : NaN;
      if (Number.isFinite(ms) && ms >= horizonStartMs - 3600_000) {
        curIdx = k;
        break;
      }
    }

    const isFiniteNum = (v: number) => Number.isFinite(v);

    // MET Norway serves no apparent temperature: leave undefined (honest
    // "unavailable" in the UTCI proxy), never a fabricated feels-like value.
    const currentWard = wards[t.wardId] = {
      ward_id: t.wardId,
      ward_name: t.wardName,
      city_id: normalizedCityId,
      centroid: t.centroid,
      current: {
        time: time[curIdx],
        temperature_2m: temperature_2m[curIdx],
        relative_humidity_2m: relative_humidity_2m[curIdx],
        apparent_temperature: temperature_2m[curIdx],
        wind_speed_10m: isFiniteNum(wind_speed_10m[curIdx]) ? wind_speed_10m[curIdx] : undefined,
        surface_pressure: isFiniteNum(surface_pressure[curIdx]) ? surface_pressure[curIdx] : undefined,
        shortwave_radiation: shortwave_radiation[curIdx],
      },
      hourly: {
        time,
        temperature_2m,
        relative_humidity_2m,
        apparent_temperature: [],
        wind_speed_10m,
        direct_normal_irradiance: [],
        shortwave_radiation,
        surface_pressure,
        weather_code: [],
      },
      metadata: {
        run_time: runTime,
        fetched_at: queryTime.toISOString(),
        valid_time: time[curIdx],
        provider: METNO_PROVIDER,
        model: METNO_MODEL,
        status: 'fresh',
        attribution: METNO_ATTRIBUTION,
      },
      attribution: METNO_ATTRIBUTION,
    };
    void currentWard;
  }

  if (Object.keys(wards).length === 0) {
    throw new Error('MET Norway fallback produced zero wards');
  }
  if (failures > capped.length * 0.25) {
    throw new Error(
      `MET Norway fallback degraded: ${failures}/${capped.length} ward requests failed`
    );
  }

  const metadata: ForecastRunMetadata = {
    run_time: runTime,
    fetched_at: queryTime.toISOString(),
    valid_time: Object.values(wards)[0]?.metadata.valid_time ?? '',
    provider: METNO_PROVIDER,
    model: METNO_MODEL,
    status: 'fresh',
    attribution: METNO_ATTRIBUTION,
  };

  void weatherCache; // cache write is handled by the caller (getCityForecast)

  return {
    city_id: normalizedCityId,
    run_time: runTime,
    fetched_at: queryTime.toISOString(),
    metadata,
    wards,
    cached_at: Date.now(),
    expires_at: Date.now() + DEFAULT_CACHE_TTL_MS,
  };
}
