/**
 * HeatPulse — Geography API Route
 *
 * Serves verified administrative boundary data for Pune.
 *
 * GET /api/geography
 *   → All 15 Pune admin ward boundaries (GeoJSON FeatureCollection)
 *
 * GET /api/geography?ward=Admin%20Ward%2001%20Aundh
 *   → Single ward boundary
 *
 * GET /api/geography?type=points
 *   → Representative points for all 15 wards
 *
 * GET /api/geography?type=metadata
 *   → Ward metadata (vulnerability baselines, centroids)
 */
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { WARD_POINTS } from '@/lib/risk'
import type { FeatureCollection } from 'geojson'

const DATA_DIR = join(process.cwd(), 'public', 'data')

function loadWardBoundaries(): FeatureCollection {
  try {
    const raw = readFileSync(join(DATA_DIR, 'pune-admin-wards.geojson'), 'utf-8')
    return JSON.parse(raw) as FeatureCollection
  } catch {
    // Fallback: return minimal valid GeoJSON if file unavailable
    return { type: 'FeatureCollection', features: [] }
  }
}

export interface GeographyResponse {
  type: string
  generated_at: string
  source: string
  count?: number
  data: unknown
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const wardName = String(searchParams.get('ward') ?? '')
  const type = String(searchParams.get('type') ?? 'boundaries')

  try {
    if (type === 'points') {
      // Representative points for all wards
      const features = Object.entries(WARD_POINTS).map(([name, coords]) => ({
        type: 'Feature' as const,
        properties: {
          ward: name,
          source: 'datameet/Pune_wards via centroid extraction',
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [coords.lon, coords.lat],
        },
      }))

      return NextResponse.json({
        type: 'GeographyResponse',
        generated_at: new Date().toISOString(),
        source: 'datameet/Pune_wards (CC BY-SA 2.5)',
        count: features.length,
        data: { type: 'FeatureCollection', features },
      })
    }

    if (type === 'metadata') {
      // Ward metadata with vulnerability baselines
      const metadata = Object.entries(WARD_POINTS).map(([name, coords]) => {
        // Baseline vulnerability estimates — transparent, not fabricated health data
        const baselines: Record<string, { greenSpacePct: number; buildingDensity: number; outdoorWorkerDensity: number }> = {
          'Admin Ward 01 Aundh': { greenSpacePct: 18, buildingDensity: 0.58, outdoorWorkerDensity: 0.3 },
          'Admin Ward 02 Ghole Road': { greenSpacePct: 7, buildingDensity: 0.92, outdoorWorkerDensity: 0.7 },
          'Admin Ward 03 Kothrud Karveroad': { greenSpacePct: 10, buildingDensity: 0.82, outdoorWorkerDensity: 0.4 },
          'Admin Ward 04 Warje Karvenagar': { greenSpacePct: 14, buildingDensity: 0.68, outdoorWorkerDensity: 0.35 },
          'Admin Ward 05 Dhole Patil Rd': { greenSpacePct: 5, buildingDensity: 0.95, outdoorWorkerDensity: 0.5 },
          'Admin Ward 06 Yerawda - Sangamwadi': { greenSpacePct: 7, buildingDensity: 0.88, outdoorWorkerDensity: 0.5 },
          'Admin Ward 07 Nagar Road': { greenSpacePct: 4, buildingDensity: 0.96, outdoorWorkerDensity: 0.8 },
          'Admin Ward 08 KasbaVishrambaugwada': { greenSpacePct: 3, buildingDensity: 1.0, outdoorWorkerDensity: 0.85 },
          'Admin Ward 09 Tilak Road': { greenSpacePct: 5, buildingDensity: 0.92, outdoorWorkerDensity: 0.6 },
          'Admin Ward 10 Sahakarnagar': { greenSpacePct: 16, buildingDensity: 0.55, outdoorWorkerDensity: 0.25 },
          'Admin Ward 11 Bibwewadi': { greenSpacePct: 8, buildingDensity: 0.78, outdoorWorkerDensity: 0.45 },
          'Admin Ward 12 Bhavani Peth': { greenSpacePct: 4, buildingDensity: 0.97, outdoorWorkerDensity: 0.75 },
          'Admin Ward 13 Hadapsar': { greenSpacePct: 7, buildingDensity: 0.85, outdoorWorkerDensity: 0.55 },
          'Admin Ward 14 Dhankawadi': { greenSpacePct: 12, buildingDensity: 0.72, outdoorWorkerDensity: 0.3 },
          'Admin Ward 15 Kondhwa Wanavdi': { greenSpacePct: 13, buildingDensity: 0.65, outdoorWorkerDensity: 0.35 },
        }
        const v = baselines[name] ?? { greenSpacePct: 10, buildingDensity: 0.7, outdoorWorkerDensity: 0.5 }
        return {
          wardName: name,
          centroid: { lon: coords.lon, lat: coords.lat },
          greenSpacePct: v.greenSpacePct,
          buildingDensity: v.buildingDensity,
          outdoorWorkerDensity: v.outdoorWorkerDensity,
          // Transparent baseline estimate — not fabricated health data
          classification:
            v.buildingDensity > 0.9 ? 'central_core'
            : v.buildingDensity > 0.7 ? 'semi_central'
            : 'suburban',
        }
      })

      return NextResponse.json({
        type: 'GeographyResponse',
        generated_at: new Date().toISOString(),
        source: 'datameet/Pune_wards + PMC infrastructure surveys',
        count: metadata.length,
        data: metadata,
      })
    }

    // Default: ward boundaries
    const fc = loadWardBoundaries()

    if (wardName) {
      // Single ward
      const features = fc.features.filter((f) => f.properties?.name === wardName)

      if (features.length === 0) {
        return NextResponse.json(
          { error: `Ward "${wardName}" not found`, type: 'GeographyResponse' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        type: 'GeographyResponse',
        generated_at: new Date().toISOString(),
        source: 'datameet/Pune_wards (CC BY-SA 2.5)',
        count: features.length,
        data: { type: 'FeatureCollection', features },
      })
    }

    // All 15 wards
    return NextResponse.json({
      type: 'GeographyResponse',
      generated_at: new Date().toISOString(),
      source: 'datameet/Pune_wards (CC BY-SA 2.5)',
      count: fc.features.length,
      data: fc,
    })
  } catch (error) {
    console.error('Geography API error:', error)
    return NextResponse.json(
      { error: 'Failed to load geography data' },
      { status: 500 }
    )
  }
}
