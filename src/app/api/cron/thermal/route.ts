/**
 * HeatPulse — Vercel Cron: Thermal Data Refresh (DISABLED LEGACY PATH)
 *
 * The legacy implementation fetched a single Pune coordinate and copied that
 * one weather reading to every ward. That is no longer a production pipeline.
 * The endpoint is kept as a disabled stub so any stale trigger fails loudly
 * instead of silently writing cloned data; per-ward centroid forecasting is
 * served by the modern weather-service pipeline.
 */
import { NextResponse } from 'next/server';

export const maxDuration = 60; // Vercel cron timeout (seconds)

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      message:
        'Legacy /api/cron/thermal is disabled: it cloned a single Pune coordinate to all wards. ' +
        'Use the modern per-ward centroid weather pipeline instead.',
    },
    { status: 410 }
  );
}
