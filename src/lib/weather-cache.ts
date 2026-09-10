/**
 * HeatPulse — Weather Forecast Run Persistent Cache
 * Implements Milestone 3 / Requirement R3:
 *   - In-memory cache caching full multi-ward forecast runs with TTL (1 hour)
 *   - Cache key format: ${cityId}_${forecastRunTime} with an active pointer to the latest run
 *   - Separation of FORECAST_RUN_TIME (NWP initialization cycle) vs FORECAST_VALID_TIME (target hour) vs FETCHED_AT
 *   - Transparent stale fallback and honest unavailable status handling
 *   - Provenance metadata and attribution
 */

import fs from 'fs';
import path from 'path';
import {
  CityForecastRun,
  ForecastRunMetadata,
  ForecastStatus,
} from '../types/weather';

export const NWP_ATTRIBUTION =
  'Ward-localized forecast derived from numerical weather prediction';
export const NWP_PROVIDER = 'Open-Meteo NWP Grid';
export const NWP_MODEL = 'ECMWF IFS / GFS Seamless';

// Default TTL: 15 minutes (900 seconds) per Requirement R2 specification
export const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Calculates standard 6-hourly NWP model initialization cycle (00Z, 06Z, 12Z, 18Z)
 * accounting for assimilation and dissemination operational latency (~3.5 hours).
 */
export function calculateNwpRunTime(referenceDate: Date = new Date()): string {
  const latencyMs = 3.5 * 60 * 60 * 1000;
  const operationalDate = new Date(referenceDate.getTime() - latencyMs);
  const year = operationalDate.getUTCFullYear();
  const month = String(operationalDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(operationalDate.getUTCDate()).padStart(2, '0');
  const cycleHour = Math.floor(operationalDate.getUTCHours() / 6) * 6;
  const cycleHourStr = String(cycleHour).padStart(2, '0');
  return `${year}-${month}-${day}T${cycleHourStr}:00:00Z`;
}

/**
 * Calculates current valid forecast hour matching Open-Meteo IST timestamps.
 */
export function calculateValidTime(
  hourlyTimes?: string[],
  referenceDate: Date = new Date()
): string {
  try {
    const istDate = referenceDate.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    });
    const istHour = referenceDate.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hour12: false,
    });
    const targetPrefix = `${istDate}T${istHour}`;

    if (hourlyTimes && hourlyTimes.length > 0) {
      const match = hourlyTimes.find((t) => t.startsWith(targetPrefix));
      if (match) return match;
      return hourlyTimes[0];
    }

    return `${targetPrefix}:00`;
  } catch {
    return referenceDate.toISOString().slice(0, 13) + ':00';
  }
}

/**
 * Helper to create standard ForecastRunMetadata
 */
export function createForecastRunMetadata(params: {
  runTime?: string;
  fetchedAt?: string;
  validTime?: string;
  status?: ForecastStatus;
}): ForecastRunMetadata {
  const now = new Date();
  return {
    run_time: params.runTime || calculateNwpRunTime(now),
    fetched_at: params.fetchedAt || now.toISOString(),
    valid_time: params.validTime || calculateValidTime(undefined, now),
    provider: NWP_PROVIDER,
    model: NWP_MODEL,
    status: params.status || 'fresh',
    attribution: NWP_ATTRIBUTION,
  };
}

/**
 * In-Memory Forecast Run Cache
 * Supports cache key format `${cityId}_${forecastRunTime}`
 * and active pointer to the latest run per city.
 */
export class WeatherCache {
  private cache = new Map<string, CityForecastRun>();
  private latestRunByCity = new Map<string, string>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs = DEFAULT_CACHE_TTL_MS) {
    this.defaultTtlMs = defaultTtlMs;
  }

  public getCacheKey(cityId: string, runTime: string): string {
    return `${cityId.trim().toLowerCase()}_${runTime.trim()}`;
  }

  private getDiskCachePath(cityId: string): string | null {
    if (typeof window !== 'undefined') return null;
    return path.join(process.cwd(), 'data', 'runtime', `forecast-${cityId.trim().toLowerCase()}.json`);
  }

  private loadFromDisk(cityId: string): CityForecastRun | null {
    if (typeof window !== 'undefined') return null;
    const filePath = this.getDiskCachePath(cityId);
    if (!filePath) return null;
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as CityForecastRun;
      }
    } catch (e) {
      console.warn(`[WeatherCache] Failed to load disk cache for ${cityId}:`, e);
    }
    return null;
  }

  private saveToDisk(cityId: string, run: CityForecastRun): void {
    if (typeof window !== 'undefined') return;
    const filePath = this.getDiskCachePath(cityId);
    if (!filePath) return;
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(run, null, 2), 'utf-8');
    } catch (e) {
      console.warn(`[WeatherCache] Failed to save disk cache for ${cityId}:`, e);
    }
  }

  /**
   * Retrieves a cached forecast run.
   * If expired but allowStale is true, returns run with isStale = true.
   */
  public get(
    cityId: string,
    options?: { allowStale?: boolean; bypassCache?: boolean }
  ): { run: CityForecastRun; isStale: boolean } | null {
    if (options?.bypassCache) return null;

    const normalizedCity = cityId.trim().toLowerCase();
    let latestKey = this.latestRunByCity.get(normalizedCity);
    let entry = latestKey ? this.cache.get(latestKey) : undefined;

    // Fallback: check disk cache if memory is empty
    if (!entry) {
      const diskEntry = this.loadFromDisk(normalizedCity);
      if (diskEntry) {
        this.set(normalizedCity, diskEntry);
        latestKey = this.latestRunByCity.get(normalizedCity);
        entry = diskEntry;
      }
    }

    if (!entry) return null;

    const now = Date.now();
    const isExpired = now > entry.expires_at;

    if (isExpired && !options?.allowStale) {
      return null;
    }

    return {
      run: entry,
      isStale: isExpired,
    };
  }

  /**
   * Stores a new forecast run in the cache and updates the active pointer.
   */
  public set(
    cityId: string,
    run: CityForecastRun,
    ttlMs?: number
  ): void {
    const normalizedCity = cityId.trim().toLowerCase();
    const key = this.getCacheKey(normalizedCity, run.run_time);
    const ttl = ttlMs ?? this.defaultTtlMs;
    const now = Date.now();

    const cachedRun: CityForecastRun = {
      ...run,
      city_id: normalizedCity,
      cached_at: now,
      expires_at: now + ttl,
    };

    this.cache.set(key, cachedRun);
    this.latestRunByCity.set(normalizedCity, key);
    this.saveToDisk(normalizedCity, cachedRun);
  }

  /**
   * Gets the last known successful run regardless of TTL expiration.
   */
  public getLatest(cityId: string): CityForecastRun | null {
    const normalizedCity = cityId.trim().toLowerCase();
    const latestKey = this.latestRunByCity.get(normalizedCity);
    if (latestKey) {
      const entry = this.cache.get(latestKey);
      if (entry) return entry;
    }
    // Check disk
    const diskEntry = this.loadFromDisk(normalizedCity);
    if (diskEntry) {
      this.set(normalizedCity, diskEntry);
      return diskEntry;
    }
    return null;
  }

  /**
   * Checks if an active unexpired run exists in cache.
   */
  public hasFreshRun(cityId: string): boolean {
    const res = this.get(cityId, { allowStale: false });
    return res !== null && !res.isStale;
  }

  /**
   * Clears the cache.
   */
  public clear(): void {
    this.cache.clear();
    this.latestRunByCity.clear();
  }

  /**
   * Returns cache stats for monitoring and health reporting.
   */
  public getStats(): {
    citiesTracked: number;
    totalRunsCached: number;
    entries: Array<{ city: string; run_time: string; isExpired: boolean }>;
  } {
    const now = Date.now();
    const entries: Array<{ city: string; run_time: string; isExpired: boolean }> = [];
    for (const v of this.cache.values()) {
      entries.push({
        city: v.city_id,
        run_time: v.run_time,
        isExpired: now > v.expires_at,
      });
    }
    return {
      citiesTracked: this.latestRunByCity.size,
      totalRunsCached: this.cache.size,
      entries,
    };
  }
}

// Global singleton instance across Next.js module reloads
const globalForCache = globalThis as unknown as {
  __heatpulse_weather_cache__?: WeatherCache;
};

export const weatherCache =
  globalForCache.__heatpulse_weather_cache__ ?? new WeatherCache();

if (process.env.NODE_ENV !== 'production') {
  globalForCache.__heatpulse_weather_cache__ = weatherCache;
}
