/**
 * HeatPulse — 120-Hour Risk-Spike Window API Route
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 *
 * GET /api/risk-spike?city=pune
 * GET /api/risk-spike?city=bengaluru&ward=blr-001
 *
 * Per-ward biometeorological risk trajectories across the full 120-hour NWP
 * window: daily peaks, worst advisory grade, and lead time (hours from the
 * current valid hour) to the first warning/critical exceedance.
 *
 * Full-physics WBGT (Liljegren 2008, wind + solar) is used wherever the NWP
 * run carries wind + irradiance; every ward reports its method mix honestly.
 * Zero mortality or hospitalization figures — trajectories only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCityForecast, WeatherUnavailableError } from '@/lib/weather-service';
import { buildCitySpikeWindows, summarizeSpikeWindows } from '@/lib/spike-window';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cityParam = (searchParams.get('city') || 'pune').toLowerCase().trim();
  const wardParam = searchParams.get('ward')?.trim();

  try {
    const { run, status } = await getCityForecast(cityParam);
    const validTime = run.metadata?.valid_time ?? null;

    let windows = buildCitySpikeWindows(run.wards, validTime);

    if (wardParam) {
      windows = windows.filter((w) => w.ward_name === wardParam || w.ward_id === wardParam);
    }

    const liljegrenHours = windows.reduce((s, w) => s + w.wbgt_method_mix['liljegren-full'], 0);
    const simplifiedHours = windows.reduce((s, w) => s + w.wbgt_method_mix['bom-simplified'], 0);

    return NextResponse.json({
      success: true,
      city_id: cityParam,
      generated_at: new Date().toISOString(),
      status,
      forecast_metadata: run.metadata,
      horizon_hours: 120,
      wbgt_physics: {
        full_physics_hours: liljegrenHours,
        simplified_fallback_hours: simplifiedHours,
        full_physics_note:
          'Liljegren et al. 2008 outdoor WBGT from NWP wind + solar irradiance; simplified BoM fallback where provider fields are absent.',
      },
      summary: summarizeSpikeWindows(windows),
      wards: windows,
      ward_count: windows.length,
      scope_note:
        'Biometeorological risk trajectories from numerical weather prediction. Not a mortality or hospitalization model.',
      attribution: 'Ward-localized forecast derived from numerical weather prediction',
    });
  } catch (error) {
    if (error instanceof WeatherUnavailableError) {
      return NextResponse.json(
        {
          error: error.message,
          status: 'unavailable',
          attribution: 'Ward-localized forecast derived from numerical weather prediction',
        },
        { status: error.statusCode }
      );
    }

    console.error('Risk-spike API error:', error);
    return NextResponse.json(
      { error: 'Failed to build risk-spike windows' },
      { status: 500 }
    );
  }
}
