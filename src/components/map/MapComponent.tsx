'use client'

/**
 * HeatPulse — Map Component
 *
 * Renders the OpenLayers map with:
 * - OSM basemap (fallback)
 * - Bhuvan WMS layer (contextual, toggleable)
 * - Pune 15 administrative wards overlay with risk-based coloring
 *
 * SSR-safe: map initialization happens in useEffect.
 */
import dynamic from 'next/dynamic'

interface WardRisk {
  wardName: string
  lon: number
  lat: number
  compositeRisk: number
  compositeRiskLevel: string
}

// Dynamic import to avoid SSR issues with OpenLayers
const MapContainer = dynamic(() => import('./MapContainer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
      <div className="text-zinc-500 text-sm animate-pulse">Loading map…</div>
    </div>
  ),
})

interface MapComponentProps {
  adminWardsGeoJSON?: GeoJSON.FeatureCollection
  bhuvanLayer?: string // WMS layer name (e.g. 'lulc:BR_LULC50K_1112')
  wardRisks?: WardRisk[]
  selectedWard?: string | null
  onWardSelect?: (ward: string | null) => void
}

export default function MapComponent({
  adminWardsGeoJSON,
  bhuvanLayer,
  wardRisks,
  selectedWard,
  onWardSelect,
}: MapComponentProps) {
  return (
    <MapContainer
      adminWardsGeoJSON={adminWardsGeoJSON}
      bhuvanLayer={bhuvanLayer}
      wardRisks={wardRisks}
      selectedWard={selectedWard}
      onWardSelect={onWardSelect}
    />
  )
}
