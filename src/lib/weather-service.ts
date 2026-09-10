/**
 * HeatPulse — Server-Side Batched Weather Pipeline
 * Implements Milestone 3 / Requirement R3:
 *   - Multi-Ward Centroid Batched Pipeline (reads centroids from GIS GeoJSONs)
 *   - Multi-location Open-Meteo API requests (batches of 20-50 coordinates)
 *   - 120-hour (5-day) hourly meteorological variables:
 *       temperature_2m, relative_humidity_2m, apparent_temperature,
 *       wind_speed_10m, direct_normal_irradiance, surface_pressure
 *   - Separation of FORECAST_RUN_TIME vs FORECAST_VALID_TIME vs FETCHED_AT
 *   - Transparent fallback to last successful cached run (status: 'stale')
 *   - Honest HTTP 503 unavailable state if no prior run exists
 *   - Zero synthetic, hardcoded, or randomly fabricated metrics
 *   - Prohibits client-side request storms & single-center copying
 */

import {
  CityForecastRun,
  ForecastRunMetadata,
  WardCurrentWeather,
  WardHourlyWeather,
  WardWeatherForecast,
  WeatherForecast,
} from '../types/weather';
import {
  calculateNwpRunTime,
  calculateValidTime,
  DEFAULT_CACHE_TTL_MS,
  NWP_ATTRIBUTION,
  NWP_MODEL,
  NWP_PROVIDER,
  weatherCache,
} from './weather-cache';
import { loadCityGeoJson, getWardCentroid } from './gis-utils';
import { CityId, CITIES } from '../types/gis';

// Open-Meteo endpoint
const OPEN_METEO_BASE_URL =
  process.env.OPEN_METEO_URL ||
  process.env.NEXT_PUBLIC_OPEN_METEO_URL ||
  'https://api.open-meteo.com/v1/forecast';

// Coordinate batch size for multi-location queries (35 coords per batch keeps URLs concise and reliable)
const BATCH_SIZE = 35;
const REQUEST_TIMEOUT_MS = 12000; // 12 seconds per batch request

/**
 * Custom error class for upstream NWP failures without cached fallback
 */
export class WeatherUnavailableError extends Error {
  public statusCode: number;
  public status: 'unavailable';

  constructor(
    message: string = 'Weather data temporarily unavailable from NWP provider',
    statusCode: number = 503
  ) {
    super(message);
    this.name = 'WeatherUnavailableError';
    this.statusCode = statusCode;
    this.status = 'unavailable';
  }
}

interface OpenMeteoHourlyResponse {
  time: string[];
  temperature_2m: number[];
  relative_humidity_2m: number[];
  apparent_temperature: number[];
  wind_speed_10m?: number[];
  direct_normal_irradiance?: number[];
  surface_pressure?: number[];
  weather_code?: number[];
}

interface OpenMeteoLocationResponse {
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone?: string;
  hourly: OpenMeteoHourlyResponse;
}

interface WardCoordinateTarget {
  wardId: string;
  wardName: string;
  cityId: string;
  lon: number;
  lat: number;
}

/**
 * Executes a single multi-location Open-Meteo HTTP request for a batch of coordinates.
 */
async function fetchCoordinateBatch(
  targets: WardCoordinateTarget[],
  retries = 2
): Promise<OpenMeteoLocationResponse[]> {
  if (targets.length === 0) return [];

  const lats = targets.map((t) => t.lat.toFixed(4)).join(',');
  const lons = targets.map((t) => t.lon.toFixed(4)).join(',');

  const params = new URLSearchParams({
    latitude: lats,
    longitude: lons,
    hourly: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'wind_speed_10m',
      'direct_normal_irradiance',
      'surface_pressure',
      'weather_code',
    ].join(','),
    forecast_days: '5',
    timezone: 'Asia/Kolkata',
  });

  const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.status === 429 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `Open-Meteo HTTP error: ${response.status} ${response.statusText}`
        );
      }

      const json = await response.json();
      const results: OpenMeteoLocationResponse[] = Array.isArray(json)
        ? json
        : [json];

      if (results.length !== targets.length) {
        console.warn(
          `[WeatherService] Requested ${targets.length} coordinates, got ${results.length} results from Open-Meteo.`
        );
      }

      return results;
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return [];
}

/**
 * Loads ward coordinates for a city and queries the Open-Meteo NWP grid in batches.
 * Never copies a single city center reading to all wards.
 */
async function fetchCityForecastFromProvider(
  cityId: string
): Promise<CityForecastRun> {
  const normalizedCityId = cityId.trim().toLowerCase() as CityId;
  const collection = await loadCityGeoJson(normalizedCityId);

  if (!collection?.features || collection.features.length === 0) {
    throw new Error(`No ward features found for city: ${cityId}`);
  }

  // Extract real calculated centroids for each ward
  const targets: WardCoordinateTarget[] = collection.features.map((feature) => {
    const centroid = getWardCentroid(feature);
    return {
      wardId: feature.properties.ward_id,
      wardName: feature.properties.ward_name || feature.properties.ward_id,
      cityId: normalizedCityId,
      lon: centroid[0],
      lat: centroid[1],
    };
  });

  // Divide into batches of BATCH_SIZE coordinates
  const batches: WardCoordinateTarget[][] = [];
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    batches.push(targets.slice(i, i + BATCH_SIZE));
  }

  // Execute batched queries sequentially with pacing to avoid 429 bursts
  const allResults: OpenMeteoLocationResponse[] = [];
  for (let i = 0; i < batches.length; i++) {
    const batchRes = await fetchCoordinateBatch(batches[i]);
    allResults.push(...batchRes);
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  if (allResults.length === 0) {
    throw new Error(`Received 0 forecast results for ${cityId}`);
  }

  const queryTime = new Date();
  const fetchedAt = queryTime.toISOString();
  const runTime = calculateNwpRunTime(queryTime);
  const sampleHourlyTimes = allResults[0]?.hourly?.time || [];
  const validTime = calculateValidTime(sampleHourlyTimes, queryTime);

  const metadata: ForecastRunMetadata = {
    run_time: runTime,
    fetched_at: fetchedAt,
    valid_time: validTime,
    provider: NWP_PROVIDER,
    model: NWP_MODEL,
    status: 'fresh',
    attribution: NWP_ATTRIBUTION,
  };

  const wardsMap: Record<string, WardWeatherForecast> = {};

  // Map results back to each target ward
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const raw = allResults[i];

    if (!raw || !raw.hourly) {
      continue;
    }

    const hourlyTimes = raw.hourly.time;
    // Match valid forecast hour
    let currentIdx = hourlyTimes.findIndex((t) => t === validTime || t.startsWith(validTime.slice(0, 13)));
    if (currentIdx === -1) currentIdx = 0;

    // Optional provider fields are passed through as undefined when absent —
    // never substituted with invented 0 km/h / 1013.25 hPa stand-ins. Consumers
    // render "unavailable" for missing values.
    const current: WardCurrentWeather = {
      time: hourlyTimes[currentIdx],
      temperature_2m: raw.hourly.temperature_2m[currentIdx],
      relative_humidity_2m: raw.hourly.relative_humidity_2m[currentIdx],
      apparent_temperature: raw.hourly.apparent_temperature[currentIdx],
      wind_speed_10m: raw.hourly.wind_speed_10m?.[currentIdx],
      direct_normal_irradiance: raw.hourly.direct_normal_irradiance?.[currentIdx],
      surface_pressure: raw.hourly.surface_pressure?.[currentIdx],
      weather_code: raw.hourly.weather_code?.[currentIdx],
    };

    const hourly: WardHourlyWeather = {
      time: raw.hourly.time,
      temperature_2m: raw.hourly.temperature_2m,
      relative_humidity_2m: raw.hourly.relative_humidity_2m,
      apparent_temperature: raw.hourly.apparent_temperature,
      wind_speed_10m: raw.hourly.wind_speed_10m ?? [],
      direct_normal_irradiance: raw.hourly.direct_normal_irradiance ?? [],
      surface_pressure: raw.hourly.surface_pressure ?? [],
      weather_code: raw.hourly.weather_code ?? [],
    };

    const wardForecast: WardWeatherForecast = {
      ward_id: target.wardId,
      ward_name: target.wardName,
      city_id: target.cityId,
      centroid: [target.lon, target.lat],
      elevation: raw.elevation,
      current,
      hourly,
      metadata: {
        ...metadata,
      },
      attribution: NWP_ATTRIBUTION,
    };

    wardsMap[target.wardId] = wardForecast;
  }

  const forecastRun: CityForecastRun = {
    city_id: normalizedCityId,
    run_time: runTime,
    fetched_at: fetchedAt,
    metadata,
    wards: wardsMap,
    cached_at: Date.now(),
    expires_at: Date.now() + DEFAULT_CACHE_TTL_MS,
  };

  return forecastRun;
}

/**
 * Retrieves full multi-ward forecast for a city.
 * Handles cache hits, fresh provider fetches, transparent stale fallback on failure,
 * and honest 503 error if no cached data exists.
 */
export async function getCityForecast(
  cityId: string,
  options?: { refresh?: boolean }
): Promise<{ run: CityForecastRun; status: 'fresh' | 'stale' }> {
  const normalizedCityId = cityId.trim().toLowerCase();

  // 1. Verify city ID is valid
  if (!CITIES[normalizedCityId as CityId]) {
    throw new Error(
      `Unsupported city: ${cityId}. Supported: ${Object.keys(CITIES).join(', ')}`
    );
  }

  // 2. Check cache if refresh is not requested
  if (!options?.refresh) {
    const cached = weatherCache.get(normalizedCityId, { allowStale: false });
    if (cached && !cached.isStale) {
      return { run: cached.run, status: 'fresh' };
    }
  }

  // 3. Query Open-Meteo NWP grid with error fallback
  try {
    const freshRun = await fetchCityForecastFromProvider(normalizedCityId);
    weatherCache.set(normalizedCityId, freshRun);
    return { run: freshRun, status: 'fresh' };
  } catch (err) {
    // 4. Transparent Fallback: serve last successful run from cache with status: 'stale'
    const lastRun = weatherCache.getLatest(normalizedCityId);
    if (lastRun) {
      console.warn(
        `[WeatherService] Open-Meteo failure for ${normalizedCityId}; serving last successful cached run (stale):`,
        err instanceof Error ? err.message : err
      );
      const staleRun: CityForecastRun = {
        ...lastRun,
        metadata: {
          ...lastRun.metadata,
          status: 'stale',
        },
      };
      return { run: staleRun, status: 'stale' };
    }

    // 5. Honest 503 state: no prior run available
    console.error(
      `[WeatherService] Open-Meteo failure for ${normalizedCityId} with zero cached fallback:`,
      err instanceof Error ? err.message : err
    );
    throw new WeatherUnavailableError(
      'Weather data temporarily unavailable from NWP provider',
      503
    );
  }
}

/**
 * Retrieves weather forecast for a specific ward in a city.
 */
export async function getWardForecast(
  cityId: string,
  wardId: string,
  options?: { refresh?: boolean }
): Promise<{ forecast: WardWeatherForecast; status: 'fresh' | 'stale' }> {
  const { run, status } = await getCityForecast(cityId, options);
  const normalizedWardId = wardId.trim().toLowerCase();

  // Lookup ward case-insensitively
  let ward = run.wards[wardId];
  if (!ward) {
    const matchKey = Object.keys(run.wards).find(
      (k) => k.toLowerCase() === normalizedWardId
    );
    if (matchKey) ward = run.wards[matchKey];
  }

  if (!ward) {
    throw new Error(`Ward "${wardId}" not found in city "${cityId}".`);
  }

  return {
    forecast: {
      ...ward,
      metadata: {
        ...ward.metadata,
        status,
      },
    },
    status,
  };
}

/**
 * Fetches a point forecast for specific coordinates (for backward compatibility).
 */
export async function fetchPointWeatherForecast(
  lat: number,
  lon: number,
  forecastDays: number = 5
): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'wind_speed_10m',
      'direct_normal_irradiance',
      'surface_pressure',
      'weather_code',
    ].join(','),
    daily: 'temperature_2m_max,temperature_2m_min,weather_code',
    timezone: 'Asia/Kolkata',
    forecast_days: forecastDays.toString(),
  });

  const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Weather API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const queryTime = new Date();
  const runTime = calculateNwpRunTime(queryTime);
  const validTime = calculateValidTime(data.hourly.time, queryTime);

  const metadata: ForecastRunMetadata = {
    run_time: runTime,
    fetched_at: queryTime.toISOString(),
    valid_time: validTime,
    provider: NWP_PROVIDER,
    model: NWP_MODEL,
    status: 'fresh',
    attribution: NWP_ATTRIBUTION,
  };

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    elevation: data.elevation || 0,
    timezone: data.timezone,
    hourly: data.hourly.time.map((t: string, i: number) => ({
      time: t,
      temperature_2m: data.hourly.temperature_2m[i],
      relative_humidity_2m: data.hourly.relative_humidity_2m[i],
      apparent_temperature: data.hourly.apparent_temperature[i],
      weather_code: data.hourly.weather_code[i],
      wind_speed_10m: data.hourly.wind_speed_10m?.[i],
      direct_normal_irradiance: data.hourly.direct_normal_irradiance?.[i],
      surface_pressure: data.hourly.surface_pressure?.[i],
    })),
    daily: data.daily.time.map((t: string, i: number) => ({
      time: t,
      temperature_2m_max: data.daily.temperature_2m_max[i],
      temperature_2m_min: data.daily.temperature_2m_min[i],
      weather_code: data.daily.weather_code[i],
    })),
    generated_at: queryTime.toISOString(),
    metadata,
    attribution: NWP_ATTRIBUTION,
  };
}
