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
      // Canonical response shape: { success, data } for single-district queries.
      return NextResponse.json({
        success: true,
        data: warning,
      });
    }

    // Return all 6 districts — keep the { success, data } shape so API and
    // store consumers agree (previously { districts } mismatched the store).
    const allWarnings = getAllImdDistrictWarnings();
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
