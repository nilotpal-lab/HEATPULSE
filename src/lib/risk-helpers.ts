/**
 * HeatPulse — Client-Safe Risk Helpers
 * SIH26083 MoES / NCMRWF
 *
 * Pure lookups and color mappings used by client components. This module MUST
 * stay free of server-only imports (fs, path, process.cwd) so it can be bundled
 * for the browser. The heavy risk engine lives in risk-engine.ts and is only
 * imported by server routes.
 */

import type { CompositeRiskLevel, RiskLevel } from '../types/thermal';

/**
 * Representative coordinates for Pune administrative wards
 */
export const WARD_POINTS: Record<string, { lon: number; lat: number }> = {
  'Admin Ward 01 Aundh': { lon: 73.794912, lat: 18.546629 },
  'Admin Ward 02 Ghole Road': { lon: 73.838754, lat: 18.528272 },
  'Admin Ward 03 Kothrud Karveroad': { lon: 73.791945, lat: 18.507793 },
  'Admin Ward 04 Warje Karvenagar': { lon: 73.801629, lat: 18.486947 },
  'Admin Ward 05 Dhole Patil Rd': { lon: 73.901619, lat: 18.524145 },
  'Admin Ward 06 Yerawda - Sangamwadi': { lon: 73.902004, lat: 18.581501 },
  'Admin Ward 07 Nagar Road': { lon: 73.920051, lat: 18.558605 },
  'Admin Ward 08 KasbaVishrambaugwada': { lon: 73.855316, lat: 18.510498 },
  'Admin Ward 09 Tilak Road': { lon: 73.822011, lat: 18.470012 },
  'Admin Ward 10 Sahakarnagar': { lon: 73.851231, lat: 18.488732 },
  'Admin Ward 11 Bibwewadi': { lon: 73.867769, lat: 18.478054 },
  'Admin Ward 12 Bhavani Peth': { lon: 73.867657, lat: 18.511321 },
  'Admin Ward 13 Hadapsar': { lon: 73.924187, lat: 18.483092 },
  'Admin Ward 14 Dhankawadi': { lon: 73.858523, lat: 18.446191 },
  'Admin Ward 15 Kondhwa Wanavdi': { lon: 73.896593, lat: 18.483268 },
};

/**
 * Looks up the representative coordinate for a ward
 */
export function getWardPoint(
  wardName: string
): { lon: number; lat: number } | null {
  return WARD_POINTS[wardName] ?? null;
}

/**
 * Returns the hex color code for a risk level
 */
export function getRiskColor(
  riskLevel: RiskLevel | CompositeRiskLevel
): string {
  const normalized = (riskLevel || '').toLowerCase();
  switch (normalized) {
    case 'severe':
    case 'danger':
      return '#dc2626'; // Red-600
    case 'high':
    case 'extreme':
      return '#ea580c'; // Orange-600
    case 'moderate':
      return '#3b82f6'; // Blue-500
    case 'low':
    default:
      return '#22c55e'; // Green-500
  }
}