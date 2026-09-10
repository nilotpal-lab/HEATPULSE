/**
 * HeatPulse — Weather API Route Handler
 * Implements Milestone 3 / Requirement R3:
 *   - GET /api/weather?city=bengaluru&ward=blr-001 (single ward)
 *   - GET /api/weather?city=bengaluru&batch=true (all wards in city, per-ward current and 120h forecast)
 *   - GET /api/weather?city=bengaluru (defaults to all wards batch)
 *   - GET /api/weather?lat=18.52&lon=73.86&days=5 (legacy coordinate point query)
 *   - Supports cache bypass via header "Cache-Control: no-cache" or query "?refresh=true"
 *   - Transparent stale fallback (status: 'stale' and header 'X-Forecast-Status: stale')
 *   - Honest 503 unavailable on upstream failure without cached data
 *   - Attribution: "Ward-localized forecast derived from numerical weather prediction"
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCityForecast,
  getWardForecast,
  fetchPointWeatherForecast,
  WeatherUnavailableError,
} from '../../../lib/weather-service';
import { NWP_ATTRIBUTION } from '../../../lib/weather-cache';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const cityParam = searchParams.get('city');
  const wardParam = searchParams.get('ward') || searchParams.get('wardId');
  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');
  const daysParam = searchParams.get('days');

  // Cache bypass check: ?refresh=true or Cache-Control: no-cache
  const hasNoCacheHeader = request.headers
    .get('cache-control')
    ?.toLowerCase()
    .includes('no-cache');
  const isRefresh = searchParams.get('refresh') === 'true' || Boolean(hasNoCacheHeader);

  try {
    // 1. Single Ward query: ?city=...&ward=... (unless explicit batch=true)
    if (cityParam && wardParam && searchParams.get('batch') !== 'true') {
      const { forecast, status } = await getWardForecast(
        cityParam,
        wardParam,
        { refresh: isRefresh }
      );

      return NextResponse.json(forecast, {
        status: 200,
        headers: {
          'X-Forecast-Status': status,
          'X-Forecast-Run-Time': forecast.metadata.run_time,
          'X-Forecast-Valid-Time': forecast.metadata.valid_time,
          'X-Attribution': NWP_ATTRIBUTION,
          'Cache-Control': isRefresh
            ? 'no-cache, no-store'
            : 'public, max-age=300, stale-while-revalidate=1800',
        },
      });
    }

    // 2. City Batched query: ?city=... (with batch=true or default)
    if (cityParam) {
      const { run, status } = await getCityForecast(cityParam, {
        refresh: isRefresh,
      });

      const responsePayload = {
        city: cityParam,
        city_id: run.city_id,
        count: Object.keys(run.wards).length,
        metadata: {
          ...run.metadata,
          status,
        },
        attribution: NWP_ATTRIBUTION,
        wards: run.wards,
      };

      return NextResponse.json(responsePayload, {
        status: 200,
        headers: {
          'X-Forecast-Status': status,
          'X-Forecast-Run-Time': run.metadata.run_time,
          'X-Forecast-Valid-Time': run.metadata.valid_time,
          'X-Attribution': NWP_ATTRIBUTION,
          'Cache-Control': isRefresh
            ? 'no-cache, no-store'
            : 'public, max-age=300, stale-while-revalidate=1800',
        },
      });
    }

    // 3. Legacy coordinate query: ?lat=...&lon=...
    if (latParam && lonParam) {
      const lat = parseFloat(latParam);
      const lon = parseFloat(lonParam);
      const days = daysParam ? parseInt(daysParam, 10) : 5;

      if (isNaN(lat) || isNaN(lon)) {
        return NextResponse.json(
          { error: 'Invalid latitude or longitude parameters' },
          { status: 400 }
        );
      }

      const pointForecast = await fetchPointWeatherForecast(lat, lon, days);

      return NextResponse.json(pointForecast, {
        status: 200,
        headers: {
          'X-Forecast-Status': 'fresh',
          'X-Forecast-Run-Time': pointForecast.metadata?.run_time || '',
          'X-Forecast-Valid-Time': pointForecast.metadata?.valid_time || '',
          'X-Attribution': NWP_ATTRIBUTION,
          'Cache-Control': isRefresh
            ? 'no-cache, no-store'
            : 'public, max-age=300, stale-while-revalidate=1800',
        },
      });
    }

    // 4. Fallback default: Bengaluru city batch
    const defaultCity = 'bengaluru';
    const { run, status } = await getCityForecast(defaultCity, {
      refresh: isRefresh,
    });

    return NextResponse.json(
      {
        city: defaultCity,
        city_id: defaultCity,
        count: Object.keys(run.wards).length,
        metadata: {
          ...run.metadata,
          status,
        },
        attribution: NWP_ATTRIBUTION,
        wards: run.wards,
      },
      {
        status: 200,
        headers: {
          'X-Forecast-Status': status,
          'X-Forecast-Run-Time': run.metadata.run_time,
          'X-Forecast-Valid-Time': run.metadata.valid_time,
          'X-Attribution': NWP_ATTRIBUTION,
          'Cache-Control': isRefresh
            ? 'no-cache, no-store'
            : 'public, max-age=300, stale-while-revalidate=1800',
        },
      }
    );
  } catch (err: unknown) {
    if (err instanceof WeatherUnavailableError) {
      return NextResponse.json(
        {
          status: 'unavailable',
          error: err.message,
          message: err.message,
          attribution: NWP_ATTRIBUTION,
        },
        {
          status: 503,
          headers: {
            'X-Forecast-Status': 'unavailable',
            'X-Attribution': NWP_ATTRIBUTION,
          },
        }
      );
    }

    const message = err instanceof Error ? err.message : 'Unknown weather error';
    const isClientError =
      message.toLowerCase().includes('not found') ||
      message.toLowerCase().includes('unsupported city');

    return NextResponse.json(
      { error: message },
      { status: isClientError ? 404 : 500 }
    );
  }
}
