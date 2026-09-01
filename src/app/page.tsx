/**
 * HeatPulse — Prototype Dashboard Page
 *
 * Phase 6: Loads real Pune admin ward geometry from verified source.
 * CRS: EPSG:4326. All 15 wards validated (closed rings, no self-intersections).
 * Geography is fetched at runtime (public/data/) to keep the JS bundle small.
 */
'use client'

import { useEffect, useState } from 'react'
import MapComponent from '@/components/map/MapComponent'

interface AdminWardsData {
  type: string
  features: Array<{
    type: string
    properties: { name: string }
    geometry: GeoJSON.Geometry
  }>
  crs?: { type: string; properties: { name: string } }
}

export default function HomePage() {
  const [adminWardsGeoJSON, setAdminWardsGeoJSON] =
    useState<GeoJSON.FeatureCollection | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/data/pune-admin-wards.geojson')
      .then((r) => r.json())
      .then((data: AdminWardsData) => {
        setAdminWardsGeoJSON(data as unknown as GeoJSON.FeatureCollection)
        setLoading(false)
      })
      .catch(() => {
        console.error('Failed to load admin wards GeoJSON')
        setLoading(false)
      })
  }, [])

  const adminWards = adminWardsGeoJSON?.features ?? []

  return (
    <div className="flex flex-col h-screen bg-zinc-50">
      {/* Top bar */}
      <header className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">H</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 leading-none">HeatPulse</h1>
              <p className="text-[10px] text-zinc-500 leading-none mt-0.5">SIH26083 · Pune Heatwave Early Warning</p>
            </div>
          </div>
          <div className="h-6 w-px bg-zinc-200 mx-1" />
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">Pune</span>
            <span>·</span>
            <span>15 Admin Wards</span>
            <span>·</span>
            <span className="text-zinc-400">Phase 6 — Real Geometry</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>System Ready</span>
          </div>
          <span className="text-zinc-300">|</span>
          <span>Real Geography · No Weather yet</span>
        </div>
      </header>

      {/* Main content: map + panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map area */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center bg-zinc-100">
              <div className="text-zinc-500 text-sm flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-zinc-400 border-t-zinc-700 rounded-full animate-spin" />
                <span>Loading ward geometry…</span>
              </div>
            </div>
          ) : adminWardsGeoJSON ? (
            <MapComponent
              adminWardsGeoJSON={adminWardsGeoJSON}
              bhuvanLayer="lulc:BR_LULC50K_1112"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-red-50">
              <div className="text-red-500 text-sm">Failed to load ward geometry</div>
            </div>
          )}
        </div>

        {/* Right intelligence panel */}
        <aside className="w-80 bg-white border-l border-zinc-200 flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b border-zinc-100">
            <h2 className="font-semibold text-zinc-900 text-sm">Intelligence Panel</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Phase 6 — Real Pune admin ward geometry loaded from verified source.
              Thermal stress, weather, and risk engines to follow in Phase 9+.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Ward selector */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                Administrative Ward ({adminWards.length})
              </h3>
              <div className="space-y-1">
                {adminWards.map((f) => (
                  <div
                    key={f.properties!.name}
                    className="px-2 py-1.5 text-xs text-zinc-600 rounded hover:bg-zinc-50 cursor-pointer transition-colors"
                  >
                    {f.properties!.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Data status */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                Data Status
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-zinc-50">
                  <span className="text-zinc-600">Geography (15 wards)</span>
                  <span className="text-green-600 font-medium">✅ Real Data</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-50">
                  <span className="text-zinc-600">Geometry QA</span>
                  <span className="text-green-600 font-medium">✅ Valid</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-50">
                  <span className="text-zinc-600">Bhuvan WMS</span>
                  <span className="text-green-600 font-medium">✅ Ready</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-50">
                  <span className="text-zinc-600">Representative Points</span>
                  <span className="text-green-600 font-medium">✅ 15 pts</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-50">
                  <span className="text-zinc-600">Weather (OpenMeteo)</span>
                  <span className="text-zinc-400">⏳ Pending</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-50">
                  <span className="text-zinc-600">Thermal Stress (HI/WBGT/UTCI)</span>
                  <span className="text-zinc-400">⏳ Pending</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-50">
                  <span className="text-zinc-600">Vulnerability</span>
                  <span className="text-zinc-400">⏳ Pending</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-50">
                  <span className="text-zinc-600">Risk Engine</span>
                  <span className="text-zinc-400">⏳ Pending</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-zinc-600">Alert System</span>
                  <span className="text-zinc-400">⏳ Pending</span>
                </div>
              </div>
            </div>

            {/* Map controls info */}
            <div className="bg-zinc-50 rounded-lg p-3 text-xs text-zinc-500">
              <div className="font-medium text-zinc-700 mb-1">Map Controls</div>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>Click a ward to select</li>
                <li>Toggle Bhuvan LULC layer</li>
                <li>Zoom: 8–18</li>
                <li>Attribution: © OSM, © Bhuvan NRSC ISRO</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-zinc-100 text-[10px] text-zinc-400 text-center">
            HeatPulse v0.6.0 · SIH26083 · MoES/NCMRWF · Pune
          </div>
        </aside>
      </div>
    </div>
  )
}
