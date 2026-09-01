'use client'

/**
 * HeatPulse — OpenLayers Map Container
 *
 * SSR-safe: map initialization happens in useEffect.
 * Supports risk-based ward coloring and selection.
 */
import { useEffect, useRef, useState } from 'react'
import { initMap, createAdminWardsLayer, createBhuvanLayer } from '@/lib/map-config'
import type { Map as OlMap } from 'ol'
import { getRiskColor } from '@/lib/risk'

interface WardRisk {
  wardName: string
  lon: number
  lat: number
  compositeRisk: number
  compositeRiskLevel: string
}

interface Props {
  adminWardsGeoJSON?: GeoJSON.FeatureCollection
  bhuvanLayer?: string
  wardRisks?: WardRisk[]
  onWardSelect?: (ward: string | null) => void
}

export default function MapContainer({
  adminWardsGeoJSON,
  bhuvanLayer,
  wardRisks = [],
  onWardSelect,
}: Props) {
  const mapRef = useRef<OlMap | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mapReady, setMapReady] = useState(false)
  const [bhuvanVisible, setBhuvanVisible] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    const map = initMap(containerRef.current.id || 'map-container', [])
    mapRef.current = map
    setMapReady(true)

    // Add Bhuvan layer if configured
    if (bhuvanLayer) {
      const bhuvanL = createBhuvanLayer(bhuvanLayer)
      map.addLayer(bhuvanL)
    }

    // Click handler — identify ward on click
    map.on('singleclick', (event) => {
      const feature = map.forEachFeatureAtPixel(event.pixel, (f) => f)
      if (feature) {
        const name = feature.get('name') || feature.get('Name') || 'Unknown'
        if (onWardSelect) onWardSelect(name as string)
      } else {
        if (onWardSelect) onWardSelect(null)
      }
    })

    // Hover cursor
    map.on('pointermove', (event) => {
      const hit = map.hasFeatureAtPixel(event.pixel)
      map.getTargetElement().style.cursor = hit ? 'pointer' : ''
    })

    return () => {
      map.dispose()
      mapRef.current = null
    }
  }, [bhuvanLayer, onWardSelect])

  // Re-add admin wards when data arrives
  useEffect(() => {
    if (!mapRef.current || !adminWardsGeoJSON) return
    const wardsLayer = createAdminWardsLayer(adminWardsGeoJSON, wardRisks)
    mapRef.current.addLayer(wardsLayer)
  }, [adminWardsGeoJSON, wardRisks])

  // Toggle Bhuvan visibility
  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.getLayers().forEach((layer) => {
      if (layer.getVisible() === false && layer.getZIndex() === 0) {
        layer.setVisible(bhuvanVisible)
      }
    })
  }, [bhuvanVisible])

  return (
    <div className="relative w-full h-full">
      <div
        id="map-container"
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '600px' }}
      />

      {!mapReady && (
        <div className="absolute inset-0 bg-zinc-100 flex items-center justify-center z-50">
          <div className="text-zinc-500 text-sm flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-zinc-400 border-t-zinc-700 rounded-full animate-spin" />
            <span>Initializing map…</span>
          </div>
        </div>
      )}

      {bhuvanLayer && (
        <div className="absolute bottom-4 right-4 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-2 flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={bhuvanVisible}
              onChange={(e) => setBhuvanVisible(e.target.checked)}
              className="accent-orange-600"
            />
            <span>Bhuvan LULC</span>
          </label>
          <span className="text-[10px] text-zinc-400">© Bhuvan, NRSC, ISRO</span>
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs">
        <div className="font-semibold text-zinc-700 mb-2">HeatPulse Dashboard</div>
        <div className="space-y-1 text-zinc-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-orange-400/30 border border-orange-500" />
            <span>Admin Ward Boundary</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-zinc-300" />
            <span>OSM Basemap</span>
          </div>
          {bhuvanLayer && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-emerald-400/30 border border-emerald-500" />
              <span>Bhuvan LULC (toggle)</span>
            </div>
          )}
          {wardRisks.length > 0 && (
            <div className="flex items-center gap-2 mt-1 pt-1 border-t border-zinc-100">
              <div className="flex gap-1">
                {['low', 'moderate', 'high', 'extreme', 'danger'].map((level) => (
                  <div
                    key={level}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getRiskColor(level as 'low'|'moderate'|'high'|'extreme'|'danger') }}
                    title={level}
                  />
                ))}
              </div>
              <span className="text-zinc-400">Risk levels</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
