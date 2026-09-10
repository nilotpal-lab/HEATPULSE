/**
 * HeatPulse — Official IMD District Reference Warnings API Route
 * GET /api/imd?city=pune
 * 
 * Returns official IMD district-scale reference warning bulletins.
 * Segregated from HeatPulse ward-localized thermal advisories.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  evaluateImdDistrictWarning,
  getAllImdDistrictWarnings,
  MONITORED_DISTRICTS,
} from '@/lib/imd-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cityParam = searchParams.get('city')?.toLowerCase().trim();
  const tmaxParam = searchParams.get('tmax');
  const tmax = tmaxParam ? parseFloat(tmaxParam) : undefined;

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

      const warning = evaluateImdDistrictWarning(cityParam, tmax);
      return NextResponse.json({
        success: true,
        data: warning,
      });
    }

    // Return all 6 districts
    const allWarnings = getAllImdDistrictWarnings();
    return NextResponse.json({
      success: true,
      count: Object.keys(allWarnings).length,
      districts: allWarnings,
    });
  } catch (err) {
    console.error('IMD District Warning API error:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve IMD district reference warnings' },
      { status: 500 }
    );
  }
}
