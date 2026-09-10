'use client';

/**
 * HeatPulse — Map Component
 * Conforms to Requirement R2 & PROJECT.md § Primary ISRO Bhuvan Basemap
 *
 * Renders the SSR-safe OpenLayers map with:
 * - Primary ISRO Bhuvan WMS basemap with automatic OSM network fallback
 * - 4-tier visual hierarchy & thematic choropleth layers
 * - Progressive Level of Detail (zoom 4 to 18)
 * - Multi-city dynamic spatial focus
 * - Integrated LayerSwitcher, MapLegend, and BasemapStatusIndicator
 */

import dynamic from 'next/dynamic';
import type { MapContainerProps } from './MapContainer';

// Dynamic import with SSR disabled to prevent server-side canvas/window errors
const MapContainer = dynamic(() => import('./MapContainer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[550px] bg-zinc-100 flex items-center justify-center">
      <div className="text-zinc-500 text-sm flex flex-col items-center gap-2">
        <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <span className="animate-pulse">Loading spatial map engine…</span>
      </div>
    </div>
  ),
});

export type MapComponentProps = MapContainerProps;

export default function MapComponent(props: MapComponentProps) {
  return <MapContainer {...props} />;
}
