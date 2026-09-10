/**
 * HeatPulse — ISRO Bhuvan WMS Basemap & Automatic Network Fallback
 * Conforms to Requirement R2 & PROJECT.md § Basemap Engine
 *
 * Primary Basemap: ISRO NRSC Bhuvan WMS (lulc:BR_LULC50K_1112)
 * Graceful Network Fallback: OpenStreetMap (OSM) TileLayer
 *
 * Inverts the prior hierarchy by establishing Bhuvan WMS as the primary
 * base layer and attaching a resilient error detection listener that
 * activates OSM fallback automatically if Bhuvan tiles fail to load or timeout.
 */

import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';

export const DEFAULT_BHUVAN_WMS_URL =
  process.env.NEXT_PUBLIC_BHUVAN_WMS_URL || 'https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms';

export const PAN_INDIA_BHUVAN_LAYER = 'sisdp_base:sisdp_basemap';
export const DEFAULT_BHUVAN_LAYER = PAN_INDIA_BHUVAN_LAYER;
export const LEGACY_BHUVAN_LAYER = 'lulc:BR_LULC50K_1112';

export const BHUVAN_CITY_LAYERS: Record<string, string> = {
  bengaluru: 'lulc:KA_LULC50K_1112',
  pune: 'lulc:MH_LULC50K_1112',
  mumbai: 'lulc:MH_LULC50K_1112',
  kolkata: 'lulc:WB_LULC50K_1112',
  chennai: 'lulc:TN_LULC50K_1112',
  coimbatore: 'lulc:TN_LULC50K_1112',
};

export function getBhuvanLayerForScope(isNational?: boolean, cityId?: string): string {
  if (isNational) {
    return PAN_INDIA_BHUVAN_LAYER;
  }
  if (cityId && BHUVAN_CITY_LAYERS[cityId.toLowerCase()]) {
    return BHUVAN_CITY_LAYERS[cityId.toLowerCase()];
  }
  return PAN_INDIA_BHUVAN_LAYER;
}

export type BasemapMode = 'street' | 'satellite' | 'bhuvan';
export type BasemapStatus = 'bhuvan_active' | 'osm_fallback' | 'street_active' | 'satellite_active' | 'loading' | 'error';

export interface BhuvanBasemapOptions {
  layerName?: string;
  wmsUrl?: string;
  opacity?: number;
  initialMode?: BasemapMode;
  errorThreshold?: number; // Consecutive/total tile errors before activating fallback (default: 3)
  timeoutMs?: number; // Timeout in ms before fallback if no tiles load (default: 8000)
  onStatusChange?: (status: BasemapStatus, message?: string) => void;
}

export interface BhuvanBasemapController {
  bhuvanLayer: TileLayer<TileWMS>;
  osmLayer: TileLayer<OSM>;
  satelliteLayer: TileLayer<XYZ>;
  getStatus: () => BasemapStatus;
  getMode: () => BasemapMode;
  setBasemapMode: (mode: BasemapMode) => void;
  switchToFallback: (reason?: string) => void;
  retryBhuvan: () => void;
  setOpacity: (opacity: number) => void;
  setLayer: (layerName: string) => void;
  dispose: () => void;
}

/**
 * Creates the primary ISRO Bhuvan TileWMS layer.
 * Configured with slightly muted opacity (0.75-0.80) to establish visual contrast
 * so thematic choropleth layers pop prominently.
 */
export function createBhuvanLayer(
  layerName: string = DEFAULT_BHUVAN_LAYER,
  wmsUrl: string = DEFAULT_BHUVAN_WMS_URL,
  opacity: number = 0.8
): TileLayer<TileWMS> {
  const source = new TileWMS({
    url: wmsUrl,
    params: {
      LAYERS: layerName,
      TILED: true,
      VERSION: '1.1.1',
      FORMAT: 'image/png',
      SRS: 'EPSG:3857',
    },
    serverType: 'geoserver',
    crossOrigin: 'anonymous',
    attributions: '© Bhuvan, NRSC, ISRO',
    transition: 300,
  });

  return new TileLayer({
    source,
    opacity,
    zIndex: 0,
    visible: true,
    properties: { id: 'basemap-bhuvan', name: 'ISRO Bhuvan LULC 50K' },
  });
}

/**
 * Creates the OpenStreetMap (OSM) Street View TileLayer.
 * Held in reserve or activated seamlessly when Bhuvan tiles fail.
 */
export function createOsmFallbackLayer(
  opacity: number = 0.85,
  visible: boolean = true
): TileLayer<OSM> {
  const source = new OSM({
    attributions: '© OpenStreetMap contributors',
    crossOrigin: 'anonymous',
    transition: 300,
  });

  return new TileLayer({
    source,
    opacity,
    zIndex: 0,
    visible,
    properties: { id: 'basemap-osm', name: 'Street View (OpenStreetMap)' },
  });
}

/**
 * Creates the High-Resolution Optical Satellite TileLayer.
 */
export function createSatelliteLayer(
  opacity: number = 0.85,
  visible: boolean = false
): TileLayer<XYZ> {
  const source = new XYZ({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attributions: '© Esri, Maxar, Earthstar Geographics',
    crossOrigin: 'anonymous',
    maxZoom: 19,
    transition: 300,
  });

  return new TileLayer({
    source,
    opacity,
    zIndex: 0,
    visible,
    properties: { id: 'basemap-satellite', name: 'High-Resolution Satellite' },
  });
}

/**
 * Sets up the integrated Basemap Controller managing both Bhuvan (primary)
 * and OSM (fallback), including automatic tileloaderror listeners and timeout detection.
 */
export function createBhuvanBasemapController(
  options: BhuvanBasemapOptions = {}
): BhuvanBasemapController {
  const {
    layerName = DEFAULT_BHUVAN_LAYER,
    wmsUrl = DEFAULT_BHUVAN_WMS_URL,
    opacity = 0.85,
    initialMode = 'street',
    errorThreshold = 3,
    timeoutMs = 8000,
    onStatusChange,
  } = options;

  let currentMode: BasemapMode = initialMode;
  let currentStatus: BasemapStatus = initialMode === 'street' ? 'street_active' : initialMode === 'satellite' ? 'satellite_active' : 'bhuvan_active';
  let errorCount = 0;
  let successfulTiles = 0;
  let hasFallenBack = false;
  let timeoutTimer: NodeJS.Timeout | null = null;

  const bhuvanLayer = createBhuvanLayer(layerName, wmsUrl, opacity);
  const osmLayer = createOsmFallbackLayer(opacity, initialMode === 'street');
  const satelliteLayer = createSatelliteLayer(opacity, initialMode === 'satellite');

  // Set initial visibility
  bhuvanLayer.setVisible(initialMode === 'bhuvan');
  osmLayer.setVisible(initialMode === 'street');
  satelliteLayer.setVisible(initialMode === 'satellite');

  const bhuvanSource = bhuvanLayer.getSource();

  const updateStatus = (status: BasemapStatus, message?: string) => {
    currentStatus = status;
    if (onStatusChange) {
      onStatusChange(status, message);
    }
  };

  const setBasemapMode = (mode: BasemapMode) => {
    currentMode = mode;
    if (mode === 'street') {
      osmLayer.setVisible(true);
      satelliteLayer.setVisible(false);
      bhuvanLayer.setVisible(false);
      updateStatus('street_active', 'Basemap: Street View (OpenStreetMap)');
    } else if (mode === 'satellite') {
      satelliteLayer.setVisible(true);
      osmLayer.setVisible(false);
      bhuvanLayer.setVisible(false);
      updateStatus('satellite_active', 'Basemap: High-Resolution Satellite');
    } else if (mode === 'bhuvan') {
      bhuvanLayer.setVisible(true);
      osmLayer.setVisible(false);
      satelliteLayer.setVisible(false);
      updateStatus('bhuvan_active', `Basemap: ISRO NRSC Bhuvan WMS (${layerName})`);
    }
  };

  const activateFallback = (reason: string = 'Tile load error threshold exceeded') => {
    if (hasFallenBack || currentMode !== 'bhuvan') return;
    hasFallenBack = true;

    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }

    // Seamless swap: hide Bhuvan, show OSM
    bhuvanLayer.setVisible(false);
    osmLayer.setVisible(true);
    currentMode = 'street';

    updateStatus(
      'osm_fallback',
      `ISRO Bhuvan WMS unavailable (${reason}). Seamlessly switched to Street View fallback.`
    );
  };

  const retryBhuvan = () => {
    hasFallenBack = false;
    errorCount = 0;
    successfulTiles = 0;

    setBasemapMode('bhuvan');
    bhuvanSource?.refresh();

    updateStatus('bhuvan_active', 'Retrying connection to ISRO Bhuvan WMS...');

    startTimeout();
  };

  const startTimeout = () => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    timeoutTimer = setTimeout(() => {
      if (!hasFallenBack && successfulTiles === 0 && currentMode === 'bhuvan') {
        activateFallback(`Server connection timed out after ${timeoutMs / 1000}s`);
      }
    }, timeoutMs);
  };

  if (bhuvanSource) {
    bhuvanSource.on('tileloaderror', () => {
      if (currentMode === 'bhuvan') {
        errorCount++;
        if (errorCount >= errorThreshold && !hasFallenBack) {
          activateFallback(`Failed loading ${errorCount} tiles from Bhuvan GeoServer`);
        }
      }
    });

    bhuvanSource.on('tileloadend', () => {
      successfulTiles++;
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      if (!hasFallenBack && currentStatus !== 'bhuvan_active' && currentMode === 'bhuvan') {
        updateStatus('bhuvan_active', 'Connected to ISRO Bhuvan WMS');
      }
    });

    bhuvanSource.on('tileloadstart', () => {
      if (successfulTiles === 0 && !hasFallenBack && currentMode === 'bhuvan') {
        startTimeout();
      }
    });
  }

  // Initial status notification
  if (initialMode === 'street') {
    updateStatus('street_active', 'Basemap: Street View (OpenStreetMap)');
  } else if (initialMode === 'satellite') {
    updateStatus('satellite_active', 'Basemap: High-Resolution Satellite');
  } else {
    updateStatus('bhuvan_active', `Primary basemap: ISRO NRSC Bhuvan WMS (${layerName})`);
  }

  return {
    bhuvanLayer,
    osmLayer,
    satelliteLayer,
    getStatus: () => currentStatus,
    getMode: () => currentMode,
    setBasemapMode,
    switchToFallback: (reason?: string) => activateFallback(reason || 'User requested fallback'),
    retryBhuvan,
    setOpacity: (newOpacity: number) => {
      bhuvanLayer.setOpacity(newOpacity);
      osmLayer.setOpacity(newOpacity);
      satelliteLayer.setOpacity(newOpacity);
    },
    setLayer: (newLayerName: string) => {
      bhuvanSource?.updateParams({ LAYERS: newLayerName });
      if (currentMode === 'bhuvan') {
        updateStatus('bhuvan_active', `Primary basemap: ISRO NRSC Bhuvan WMS (${newLayerName})`);
      }
    },
    dispose: () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    },
  };
}
