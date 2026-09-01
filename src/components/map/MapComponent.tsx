'use client'

/**
 * HeatPulse — Map Component
 *
 * Renders the OpenLayers map with:
 * - OSM basemap (fallback)
 * - Bhuvan WMS layer (contextual, toggleable)
 * - Pune 15 administrative wards overlay
 *
 * SSR-safe: map initialization happens in useEffect.
 */
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { initMap, createAdminWardsLayer, createBhuvanLayer } from '@/lib/map-config'
import type { Map as OlMap } from 'ol'

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
}

export default function MapComponent({ adminWardsGeoJSON, bhuvanLayer }: MapComponentProps) {
  return <MapContainer adminWardsGeoJSON={adminWardsGeoJSON} bhuvanLayer={bhuvanLayer} />
}
