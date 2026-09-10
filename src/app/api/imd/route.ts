/**
 * HeatPulse — District Heat Evaluation API Route (IMD-criteria based)
 * GET /api/imd?city=pune
 *
 * Returns district-scale heat evaluations computed locally by HeatPulse using
 * IMD's published threshold criteria. NOT official IMD bulletins — see
 * src/lib/imd-service.ts provenance note.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  evaluateImdDistrictWarning,
  getAllImdDistrictWarnings,
  MONITORED_DISTRICTS,
} from '@/lib/imd-service';
import { getCityForecast, WeatherUnavailableError } from '@/lib/weather-service';

/**
 * Resolves the district forecast Tmax from the real ward-centroid NWP run
 * (city-wide maximum across ward current temperatures). Returns undefined
 * when no live ward data exists — the evaluation then reports "no forecast
 * input" rather than substituting a climatology normal.
 */
async function resolveCityPeakTmax(cityId: string): Promise<number | undefined> {
  try {
    const { run } = await getCityForecast(cityId);
    const temps = Object.values(run.wards)
      .map((w) => w.current?.temperature_2m)
      .filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
    return temps.length > 0 ? Math.max(...temps) : undefined;
  } catch (err) {
    if (err instanceof WeatherUnavailableError) {
      console.warn(`[IMD] Ward forecast unavailable for ${cityId} — district evaluation has no forecast input`);
      return undefined;
    }
    throw err;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cityParam = searchParams.get('city')?.toLowerCase().trim();
  const tmaxParam = searchParams.get('tmax');
  const explicitTmax = tmaxParam ? parseFloat(tmaxParam) : undefined;

  try {
    if (cityParam && cityParam !== 'all') {
      if (!MONITORED_DISTRICTS[cityParam]) {
        return NextResponse.json(
          {
            error: `Unsupported city: "${cityParam}". Supported cities: ${Object.keys(
              MONITORED_DISTRICTS
            ).join(', ')}`,
          },
          { status: 400 }
        );
      }

      // Prefer an explicit tmax; otherwise derive the real ward-pipe maximum.
      const tmax =
        typeof explicitTmax === 'number' && Number.isFinite(explicitTmax)
          ? explicitTmax
          : await resolveCityPeakTmax(cityParam);

      const warning = evaluateImdDistrictWarning(cityParam, tmax);
      // Canonical response shape: { success, data } for single-district queries.
      return NextResponse.json({
        success: true,
        data: warning,
      });
    }

    // Return all 6 districts — keep the { success, data } shape so API and
    // store consumers agree (previously { districts } mismatched the store).
    // Each city's evaluation uses its real ward-pipe peak where available.
    const cityPeakTmax: Record<string, number | undefined> = {};
    for (const cityId of Object.keys(MONITORED_DISTRICTS)) {
      cityPeakTmax[cityId] = await resolveCityPeakTmax(cityId);
    }
    const allWarnings = getAllImdDistrictWarnings(cityPeakTmax);
    return NextResponse.json({
      success: true,
      data: allWarnings,
      count: Object.keys(allWarnings).length,
    });
  } catch (err) {
    console.error('IMD District Warning API error:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve IMD district reference warnings' },
      { status: 500 }
    );
  }
}
