/**
 * HeatPulse — Prototype Dashboard Page
 *
 * Phase 4: Bhuvan Prototype
 * Loads Pune admin wards + Bhuvan WMS contextual layer.
 * No weather/thermal data yet — map shell only.
 */
import MapComponent from '@/components/map/MapComponent'

// Prototype GeoJSON — inline 15 administrative wards
// (In production, this comes from data/raw/processed/pune-admin-wards.geojson)
const PROTOTYPE_WARDS: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { Name: 'Admin Ward 01 Aundh' }, geometry: { type: 'Polygon', coordinates: [[[73.83, 18.54], [73.86, 18.54], [73.86, 18.57], [73.83, 18.57], [73.83, 18.54]]] } },
    { type: 'Feature', properties: { Name: 'Admin Ward 02 Ghole Road' }, geometry: { type: 'Polygon', coordinates: [[[73.80, 18.50], [73.83, 18.50], [73.83, 18.54], [73.80, 18.54], [73.80, 18.50]]] } },
    { type: 'Feature', properties: { Name: 'Admin Ward 03 Kothrud' }, geometry: { type: 'Polygon', coordinates: [[[73.80, 18.50], [73.83, 18.50], [73.83, 18.54], [73.80, 18.54], [73.80, 18.50]]] } },
    { type: 'Feature', properties: { Name: 'Admin Ward 04 Warje' }, geometry: { type: 'Polygon', coordinates: [[[73.77, 18.48], [73.80, 18.48], [73.80, 18.50], [73.77, 18.50], [73.77, 18.48]]] } },
    { type: 'Feature', properties: { Name: 'Admin Ward 05 Dhole Patil' }, geometry: { type: 'Polygon', coordinates: [[[73.83, 18.50], [73.86, 18.50], [73.86, 18.54], [73.83, 18.54], [73.83, 18.50]]] } },
    { type: 'Feature', properties: { Name: 'Admin Ward 06 Yerawda' }, geometry: { type: 'Polygon', coordinates: [[[73.84, 18.54], [73.87, 18.54], [73.87, 18.57], [73.84, 18.57], [73.84, 18.54]]] } },
    { type: 'Feature', properties: { Name: 'Admin Ward 07 Nagar Road' }, geometry: { type: 'Polygon', coordinates: [[[73.85, 18.51], [73.88, 18.51], [73.88, 18.54], [73.85, 18.54], [73.85, 18.51]]] } },
    { type: 'Feature', properties: { Name: 'Admin Ward 08 Kasba' }, geometry: { type: 'Polygon', coordinates: [[[73.86, 18.51], [73.89, 18.51], [73.89, 18.54], [73.86, 18.54], [73.86, 18.51]]] } },
    { type: 'Feature', properties: { Name: 'Admin Ward 09 Tilak Road' }, geometry: { type: 'Polygon', coordinates: [[[73.84, 18.51], [73.86, 18.51], [73.86, 18.53], [73.84, 18.53], [73.84, 18.51]]] } },
    { type: 'Feature', properties: { Name: 'Admin Ward 10 Sahakarnagar' }, geometry: { type: 'Polygon', coordinates: [[[73.86, 18.53], [73.89, 18.53], [73.89, 18.56], [73.86, 18.56], [73.86, 18.53]]] } },
    { type: 'Feature', properties: { Name: 'Admin Ward 11 Bibwewadi' }, geometry: { type: 'Polygon', coordinates: [[[73.78, 18.48], [73.82, 18.48], [73.82, 18.51], [73.78, 18.51], [73.78, 18.48]]] } },
    { type: 'Feature', properties: { Name: 'Admin Ward 12 Bhavani Peth' }, geometry: { type: 'Polygon', coordinates: [[[73.85, 18.50], [73.87, 18.50], [73.87, 18.52], [73.85, 18.52], [73.85, 18.50]]] } },
    { type: 'Feature', properties: { Name: 'Admin Ward 13 Hadapsar' }, geometry: { type: 'Polygon', coordinates: [[[73.88, 18.48], [73.92, 18.48], [73.92, 18.52], [73.88, 18.52], [73.88, 18.48]]] } },
    { type: 'Feature', properties: { Name: 'Admin Ward 14 Dhankawadi' }, geometry: { type: 'Polygon', coordinates: [[[73.82, 18.46], [73.86, 18.46], [73.86, 18.48], [73.82, 18.48], [73.82, 18.46]]] } },
    { type: 'Feature', properties: { Name: 'Admin Ward 15 Kondhwa' }, geometry: { type: 'Polygon', coordinates: [[[73.88, 18.44], [73.92, 18.44], [73.92, 18.48], [73.88, 18.48], [73.88, 18.44]]] } },
  ],
}

export default function HomePage() {
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
            <span className="text-zinc-400">Prototype Phase</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>System Ready</span>
          </div>
          <span className="text-zinc-300">|</span>
          <span>Mock Data · No Weather yet</span>
        </div>
      </header>

      {/* Main content: map + panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map area */}
        <div className="flex-1 relative">
          <MapComponent
            adminWardsGeoJSON={PROTOTYPE_WARDS}
            bhuvanLayer="lulc:BR_LULC50K_1112"
          />
        </div>

        {/* Right intelligence panel */}
        <aside className="w-80 bg-white border-l border-zinc-200 flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b border-zinc-100">
            <h2 className="font-semibold text-zinc-900 text-sm">Intelligence Panel</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Phase 4 prototype — map shell with Bhuvan WMS context layer.
              Thermal stress, weather, and risk engines to follow.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Ward selector */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                Administrative Ward
              </h3>
              <div className="space-y-1">
                {PROTOTYPE_WARDS.features.map((f) => (
                  <div
                    key={f.properties!.Name}
                    className="px-2 py-1.5 text-xs text-zinc-600 rounded hover:bg-zinc-50 cursor-pointer transition-colors"
                  >
                    {f.properties!.Name}
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
                  <span className="text-zinc-600">Geography</span>
                  <span className="text-green-600 font-medium">✅ Loaded</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-50">
                  <span className="text-zinc-600">Bhuvan WMS</span>
                  <span className="text-green-600 font-medium">✅ Ready</span>
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
                <li>Attribution: © OpenStreetMap, © Bhuvan NRSC ISRO</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-zinc-100 text-[10px] text-zinc-400 text-center">
            HeatPulse v0.4.0 · SIH26083 · MoES/NCMRWF · Pune
          </div>
        </aside>
      </div>
    </div>
  )
}
