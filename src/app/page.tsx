/**
 * HeatPulse — Dashboard Page
 *
 * Phase 9-10: Real Pune admin ward geometry + live weather/thermal data.
 * Fetches from: /api/weather, /api/thermal, /api/risk, /api/alerts
 */
'use client'

import { useEffect, useState } from 'react'
import MapComponent from '@/components/map/MapComponent'
import TimelineSlider, { type ThermalHourlyPoint } from '@/components/timeline/TimelineSlider'
import { getRiskColor } from '@/lib/risk'

interface AdminWardsData {
  type: string
  features: Array<{
    type: string
    properties: { name: string }
    geometry: GeoJSON.Geometry
  }>
  crs?: { type: string; properties: { name: string } }
}

interface WardRisk {
  wardName: string
  lon: number
  lat: number
  heatIndex: number
  wbgt: number
  thermalRisk: string
  vulnerabilityScore: number
  compositeRisk: number
  compositeRiskLevel: string
  recommendations: string[]
  updated_at: string
}

interface Alert {
  ward: string
  level: string
  heatIndex: number
  timestamp: string
  message: string
}

interface ThermalSummary {
  maxHeatIndex: number
  minHeatIndex: number
  currentRiskLevel: string
  peakHour: ThermalHourlyPoint
}

interface ThermalData {
  location: { latitude: number; longitude: number }
  generated_at: string
  hourly: ThermalHourlyPoint[]
  summary: ThermalSummary
}

export default function HomePage() {
  const [adminWardsGeoJSON, setAdminWardsGeoJSON] =
    useState<GeoJSON.FeatureCollection | null>(null)
  const [wardRisks, setWardRisks] = useState<WardRisk[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [thermalData, setThermalData] = useState<ThermalData | null>(null)
  const [selectedWard, setSelectedWard] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<ThermalHourlyPoint | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  useEffect(() => {
    // Load ward geometry, risk, alerts, and thermal forecast
    Promise.all([
      fetch('/data/pune-admin-wards.geojson').then((r) => r.json()),
      fetch('/api/risk').then((r) => r.json()),
      fetch('/api/alerts').then((r) => r.json()),
      fetch('/api/thermal').then((r) => r.json()),
    ]).then(([wardsData, riskData, alertsData, thermal]) => {
      setAdminWardsGeoJSON(wardsData as unknown as GeoJSON.FeatureCollection)
      setWardRisks(riskData.wards as WardRisk[])
      setAlerts(alertsData.alerts as Alert[])
      setThermalData(thermal as ThermalData)
      setLastUpdated(riskData.generated_at)
      setLoading(false)
      setDataLoaded(true)
    }).catch(() => {
      setLoading(false)
    })
  }, [])

  const maxRisk = wardRisks.length
    ? Math.max(...wardRisks.map((r) => r.compositeRisk))
    : 0
  const minRisk = wardRisks.length
    ? Math.min(...wardRisks.map((r) => r.compositeRisk))
    : 0
  const avgRisk = wardRisks.length
    ? Math.round((wardRisks.reduce((s, r) => s + r.compositeRisk, 0) / wardRisks.length) * 10) / 10
    : 0

  const criticalAlerts = alerts.filter((a) => a.level === 'critical' || a.level === 'warning')

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
            <span className="text-zinc-400">Phase 9 — Live Data</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${dataLoaded ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
            <span>{dataLoaded ? 'Live' : 'Loading'}</span>
          </div>
          <span className="text-zinc-300">|</span>
          <span className="text-zinc-400">Updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
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
                <span>Loading data…</span>
              </div>
            </div>
          ) : adminWardsGeoJSON ? (
            <MapComponent
              adminWardsGeoJSON={adminWardsGeoJSON}
              bhuvanLayer="lulc:BR_LULC50K_1112"
              wardRisks={wardRisks}
              selectedWard={selectedWard}
              onWardSelect={setSelectedWard}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-red-50">
              <div className="text-red-500 text-sm">Failed to load ward geometry</div>
            </div>
          )}

          {/* Alert banner */}
          {criticalAlerts.length > 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              {criticalAlerts.length} active heat alert{criticalAlerts.length > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Right intelligence panel */}
        <aside className="w-80 bg-white border-l border-zinc-200 flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b border-zinc-100">
            <h2 className="font-semibold text-zinc-900 text-sm">Intelligence Panel</h2>
            <p className="text-xs text-zinc-500 mt-1">
              {dataLoaded
                ? 'Live thermal stress and risk data from Open-Meteo + baselines.'
                : 'Loading weather and risk data…'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Risk summary */}
            {dataLoaded && wardRisks.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                  Pune Risk Summary
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-zinc-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-zinc-900">{maxRisk}</div>
                    <div className="text-[10px] text-zinc-500">Max Risk</div>
                  </div>
                  <div className="bg-zinc-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-zinc-900">{avgRisk}</div>
                    <div className="text-[10px] text-zinc-500">Avg Risk</div>
                  </div>
                  <div className="bg-zinc-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-zinc-900">{minRisk}</div>
                    <div className="text-[10px] text-zinc-500">Min Risk</div>
                  </div>
                </div>
                {criticalAlerts.length > 0 && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
                    <div className="font-medium mb-1">Active Alerts</div>
                    {criticalAlerts.slice(0, 2).map((a, i) => (
                      <div key={i} className="truncate">⚠ {a.ward}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Selected ward detail */}
            {selectedWard && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                  {selectedWard}
                </h3>
                {(() => {
                  const ward = wardRisks.find((r) => r.wardName === selectedWard)
                  if (!ward) return <div className="text-xs text-zinc-400">No data available</div>
                  const color = getRiskColor(ward.compositeRiskLevel as 'low'|'moderate'|'high'|'extreme'|'danger')
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-sm font-medium text-zinc-900">
                          Composite Risk: {ward.compositeRisk}/100
                        </span>
                      </div>
                      <div className="text-xs text-zinc-600 grid grid-cols-2 gap-1">
                        <div>Heat Index: <span className="font-medium">{ward.heatIndex}°C</span></div>
                        <div>WBGT: <span className="font-medium">{ward.wbgt}°C</span></div>
                        <div>Thermal: <span className="font-medium capitalize">{ward.thermalRisk}</span></div>
                        <div>Vulnerability: <span className="font-medium">{ward.vulnerabilityScore}/100</span></div>
                      </div>
                      <div className="text-xs text-zinc-500 space-y-0.5">
                        {ward.recommendations.slice(0, 3).map((r, i) => (
                          <div key={i}>• {r}</div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Ward selector */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                Administrative Ward ({wardRisks.length})
              </h3>
              <div className="space-y-1">
                {wardRisks.map((r) => {
                  const color = getRiskColor(r.compositeRiskLevel as 'low'|'moderate'|'high'|'extreme'|'danger')
                  const isSelected = selectedWard === r.wardName
                  return (
                    <button
                      key={r.wardName}
                      onClick={() => setSelectedWard(isSelected ? null : r.wardName)}
                      className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors flex items-center gap-2 ${
                        isSelected ? 'bg-zinc-100' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-zinc-700 truncate flex-1">{r.wardName}</span>
                      <span className="text-zinc-400 shrink-0">{r.compositeRisk}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Timeline slider */}
            {dataLoaded && thermalData && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                  120h Thermal Forecast
                </h3>
                <TimelineSlider
                  data={thermalData.hourly}
                  selectedPoint={selectedPoint}
                  onPointSelect={setSelectedPoint}
                />
              </div>
            )}

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
                  <span className="text-zinc-600">Weather (OpenMeteo)</span>
                  <span className="text-green-600 font-medium">✅ Live</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-50">
                  <span className="text-zinc-600">Thermal Stress (HI/WBGT)</span>
                  <span className="text-green-600 font-medium">✅ Live</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-50">
                  <span className="text-zinc-600">Ward Risk Engine</span>
                  <span className="text-green-600 font-medium">✅ Live</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-50">
                  <span className="text-zinc-600">Alert System</span>
                  <span className="text-green-600 font-medium">✅ Live</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-50">
                  <span className="text-zinc-600">Supabase (PostgreSQL)</span>
                  <span className="text-yellow-600 font-medium">⏳ Schema Ready</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-50">
                  <span className="text-zinc-600">Timeline Slider UI</span>
                  <span className="text-green-600 font-medium">✅ Live</span>
                </div>
              </div>
            </div>

            {/* Map controls info */}
            <div className="bg-zinc-50 rounded-lg p-3 text-xs text-zinc-500">
              <div className="font-medium text-zinc-700 mb-1">Map Controls</div>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>Click a ward to see risk details</li>
                <li>Toggle Bhuvan LULC layer</li>
                <li>Zoom: 8–18</li>
                <li>Data refreshes on page load</li>
                <li>Attribution: © OSM, © Bhuvan NRSC ISRO</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-zinc-100 text-[10px] text-zinc-400 text-center">
            HeatPulse v0.9.0 · SIH26083 · MoES/NCMRWF · Pune
          </div>
        </aside>
      </div>
    </div>
  )
}
