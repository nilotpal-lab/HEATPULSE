/**
 * HeatPulse — OpenLayers Map Configuration & LOD Engine
 * Conforms to Requirement R2 & PROJECT.md § Basemap Engine & Visual Hierarchy
 *
 * Basemap Architecture:
 * 1. Primary: ISRO NRSC Bhuvan WMS (lulc:BR_LULC50K_1112)
 * 2. Automatic Fallback: OpenStreetMap (OSM) on tile load failure/timeout
 *
 * Visual Hierarchy:
 * - Tier 1: Dimmed/muted basemap (opacity: 0.8) for spatial contrast
 * - Tier 2: Thematic Heat Choropleth (Heat Conditions / Thermal Stress / Risk)
 * - Tier 3: Crisp administrative ward boundaries (1.2px)
 * - Tier 4: Selected ward highlight (3.5px cyan/amber #00f2fe with z-index elevation)
 * - Tier 5: Hover state (subtle highlight + pointer cursor)
 *
 * Progressive Level of Detail (LOD):
 * - LOD 0: National Scale (zoom 4–7) — Suppresses municipal ward polygons, displays city markers
 * - LOD 1: City Scale (zoom 8–12) — Renders ward polygons with choropleth fill, suppresses text labels
 * - LOD 2: Ward Scale (zoom 13–18) — Renders ward polygons and readable ward name labels
 */

import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import { transform, transformExtent } from 'ol/proj';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import GeoJSON from 'ol/format/GeoJSON';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Fill, Stroke, Style, Text, Circle as CircleStyle } from 'ol/style';
import Zoom from 'ol/control/Zoom';
import ScaleLine from 'ol/control/ScaleLine';
import type { Extent } from 'ol/extent';
import { CITIES, CityId, CITY_LIST } from '@/types/gis';
import {
  classifyHeatCondition,
  classifyThermalStress,
  calculateRelativeRisk,
} from '@/lib/threshold-config';
import {
  createBhuvanBasemapController,
  createBhuvanLayer,
  createOsmFallbackLayer,
  createSatelliteLayer,
  DEFAULT_BHUVAN_WMS_URL,
  DEFAULT_BHUVAN_LAYER,
  PAN_INDIA_BHUVAN_LAYER,
  LEGACY_BHUVAN_LAYER,
  BHUVAN_CITY_LAYERS,
  getBhuvanLayerForScope,
  type BhuvanBasemapController,
  type BasemapStatus,
  type BasemapMode,
} from '@/components/map/BhuvanLayer';

export const BHUVAN_WMS_URL = DEFAULT_BHUVAN_WMS_URL;
export const BHUVAN_DEFAULT_LAYER = DEFAULT_BHUVAN_LAYER;
export {
  PAN_INDIA_BHUVAN_LAYER,
  LEGACY_BHUVAN_LAYER,
  BHUVAN_CITY_LAYERS,
  getBhuvanLayerForScope,
  createSatelliteLayer,
};
export type { BasemapMode };

export const PUNE_CENTER: [number, number] = [73.8567, 18.5204];
export const PUNE_ZOOM = 11;
export const BENGALURU_CENTER: [number, number] = [77.5946, 12.9716];
export const INDIA_CENTER: [number, number] = [78.9629, 20.5937];
export const INDIA_ZOOM = 5;

// Zoom bounds for Progressive Level of Detail (LOD)
export const MIN_MAP_ZOOM = 4;
export const MAX_MAP_ZOOM = 18;
export const LOD_NATIONAL_MAX_ZOOM = 7.99;
export const LOD_CITY_MIN_ZOOM = 8;
export const LOD_CITY_MAX_ZOOM = 12.99;
export const LOD_WARD_LABEL_MIN_ZOOM = 13;

export type ThematicLayerType = 'heat_conditions' | 'thermal_stress' | 'composite_risk' | 'health_impact';

export interface WardRisk {
  wardName?: string;
  ward_name?: string;
  wardId?: string;
  ward_id?: string;
  heatCondition?: string; // Normal | Elevated | High | Extreme
  heat_condition?: string;
  thermalStress?: string; // Low | Moderate | High | Severe
  thermal_stress?: string;
  compositeRisk?: number;
  composite_risk?: number;
  compositeRiskLevel?: string;
  composite_risk_level?: string;
  heatIndex?: number;
  wbgt?: number;
  lon?: number;
  lat?: number;
  currentTemp?: number;
  currentHumidity?: number;
  vulnerabilityScore?: number;
  recommendations?: string[];
  vulnerabilityGreenPct?: number;
  vulnerabilityBuildingDensity?: number;
  vulnerabilityWorkerDensity?: number;
  thermalRisk?: string;
  updated_at?: string;
}

export function toWebMercator(lon: number, lat: number): [number, number] {
  return transform([lon, lat], 'EPSG:4326', 'EPSG:3857') as [number, number];
}

export function fromWebMercator(x: number, y: number): [number, number] {
  return transform([x, y], 'EPSG:3857', 'EPSG:4326') as [number, number];
}

/**
 * Creates the OSM basemap layer (kept for backwards compatibility).
 */
export function createBaseLayer(opacity: number = 0.8) {
  return new TileLayer({
    source: new OSM({ attributions: '© OpenStreetMap contributors' }),
    opacity,
    zIndex: 0,
  });
}

// Re-export Bhuvan creator functions from BhuvanLayer
export { createBhuvanLayer, createOsmFallbackLayer, createBhuvanBasemapController };
export type { BhuvanBasemapController, BasemapStatus };

/**
 * Color scales for thematic layers (Requirement R2 / PROJECT.md § Visual Contrast)
 */
export const THEMATIC_COLORS = {
  // 1. Heat Conditions (Atmospheric state) — thresholds per threshold-config
  heat_conditions: {
    Normal: { fill: 'rgba(59, 130, 246, 0.45)', stroke: '#2563eb', label: 'Normal (<35°C)' },
    Elevated: { fill: 'rgba(234, 179, 8, 0.45)', stroke: '#ca8a04', label: 'Elevated (35–40°C)' },
    High: { fill: 'rgba(249, 115, 22, 0.48)', stroke: '#ea580c', label: 'High (40–45°C)' },
    Extreme: { fill: 'rgba(220, 38, 38, 0.52)', stroke: '#b91c1c', label: 'Extreme (≥45°C)' },
  },
  // 2. Thermal Stress (Human biometeorology)
  thermal_stress: {
    Low: { fill: 'rgba(34, 197, 94, 0.45)', stroke: '#16a34a', label: 'Low (<28°C WBGT)' },
    Moderate: { fill: 'rgba(250, 204, 21, 0.45)', stroke: '#eab308', label: 'Moderate (28–30°C WBGT)' },
    High: { fill: 'rgba(234, 88, 12, 0.48)', stroke: '#c2410c', label: 'High (30–32°C WBGT)' },
    Severe: { fill: 'rgba(153, 27, 27, 0.55)', stroke: '#7f1d1d', label: 'Severe (>32°C WBGT)' },
  },
  // 3. Composite Risk — keyed to the four engine levels (Low/Moderate/High/Severe).
// 'extreme'/'danger' legacy keys never matched engine output and miscolored
// highscores as green; kept 'severe' to reflect the authoritative level.
  composite_risk: {
    low: { fill: 'rgba(34, 197, 94, 0.40)', stroke: '#16a34a', label: 'Low Risk' },
    moderate: { fill: 'rgba(59, 130, 246, 0.40)', stroke: '#2563eb', label: 'Moderate Risk' },
    high: { fill: 'rgba(245, 158, 11, 0.45)', stroke: '#d97706', label: 'High Risk' },
    severe: { fill: 'rgba(220, 38, 38, 0.55)', stroke: '#dc2626', label: 'Severe Risk' },
  },
  // 4. Epidemiological Health Burden & Hospital Surge Index (Lancet/HAP Relative Risk Model)
  health_impact: {
    Baseline: { fill: 'rgba(34, 197, 94, 0.45)', stroke: '#16a34a', label: 'Baseline Load (RR < 1.15)' },
    Elevated: { fill: 'rgba(250, 204, 21, 0.48)', stroke: '#eab308', label: 'Elevated Burden (RR 1.15–1.30)' },
    High: { fill: 'rgba(234, 88, 12, 0.52)', stroke: '#c2410c', label: 'High Surge (RR 1.30–1.50)' },
    Critical: { fill: 'rgba(153, 27, 27, 0.60)', stroke: '#7f1d1d', label: 'Critical Emergency (RR > 1.50)' },
  },
};

/**
 * Resolves styling colors for a ward based on active thematic layer and ward risk data.
 * Dynamic calculation ensures zero fallback to static colors when valid data is present.
 */
export function getWardThematicColor(
  activeLayer: ThematicLayerType,
  wardRisk?: WardRisk
): { fill: string; stroke: string } {
  if (!wardRisk) {
    return { fill: 'rgba(148, 163, 184, 0.35)', stroke: 'rgba(255, 255, 255, 0.85)' };
  }

  if (activeLayer === 'heat_conditions') {
    // Classification delegated to threshold-config — no duplicate numerics here.
    let cond = wardRisk.heatCondition || wardRisk.heat_condition;
    if (!cond && wardRisk.currentTemp != null) {
      cond = classifyHeatCondition(wardRisk.currentTemp);
    }
    const validKey = (THEMATIC_COLORS.heat_conditions[cond as keyof typeof THEMATIC_COLORS.heat_conditions]
      ? cond
      : 'Normal') as keyof typeof THEMATIC_COLORS.heat_conditions;
    const c = THEMATIC_COLORS.heat_conditions[validKey];
    return { fill: c.fill, stroke: c.stroke };
  }

  if (activeLayer === 'thermal_stress') {
    let stress = wardRisk.thermalStress || wardRisk.thermal_stress;
    if (!stress && (wardRisk.wbgt != null || wardRisk.heatIndex != null)) {
      stress = classifyThermalStress(wardRisk.heatIndex ?? 0, wardRisk.wbgt);
    }
    const validKey = (THEMATIC_COLORS.thermal_stress[stress as keyof typeof THEMATIC_COLORS.thermal_stress]
      ? stress
      : 'Low') as keyof typeof THEMATIC_COLORS.thermal_stress;
    const c = THEMATIC_COLORS.thermal_stress[validKey];
    return { fill: c.fill, stroke: c.stroke };
  }

  if (activeLayer === 'health_impact') {
    // RR math delegated to threshold-config (onset WBGT 28.0). No fabricated
    // wbgt=28 / vuln=50 defaults: missing inputs resolve to baseline instead.
    const w = typeof wardRisk.wbgt === 'number' ? wardRisk.wbgt : undefined;
    const vuln = typeof wardRisk.vulnerabilityScore === 'number' ? wardRisk.vulnerabilityScore : undefined;
    const { band } = calculateRelativeRisk(w, vuln);
    const c = THEMATIC_COLORS.health_impact[band];
    return { fill: c.fill, stroke: c.stroke };
  }

  // Composite risk mode — composite_risk keyed to the four engine levels.
  const rawRisk = String(
    (wardRisk.compositeRiskLevel || wardRisk.composite_risk_level || 'low').toLowerCase()
  );
  const c =
    THEMATIC_COLORS.composite_risk[rawRisk as keyof typeof THEMATIC_COLORS.composite_risk] ||
    THEMATIC_COLORS.composite_risk.low;
  return { fill: c.fill, stroke: c.stroke };
}

/**
 * Formats a compact composite ward identifier across all 6 cities
 * (Bengaluru, Pune, Mumbai, Kolkata, Chennai, Coimbatore).
 * Examples: '142 · Rajajinagara', '01 · Aundh', '25 · Vinayaka Layout', 'Ward 12'
 */
export function formatCompactWardIdentifier(props: Record<string, unknown>): string {
  const wardId = String(props.ward_id || props.id2 || props.id || '');
  const rawWardId = props.raw_ward_id || props.raw_ward_num;
  const wardName = String(props.ward_name || props.name || props.Name || wardId || '').trim();

  let numStr = rawWardId ? String(rawWardId).trim() : '';
  if (!numStr) {
    const matchId = wardId.match(/^[a-z]+-0*([0-9]+[a-z0-9/_-]*)/i);
    if (matchId) {
      numStr = matchId[1];
    }
  }

  // Handle Pune style: "Admin Ward 01 Aundh" or "Admin Ward 01 - Aundh"
  const adminMatch = wardName.match(/^Admin Ward\s*([0-9A-Za-z]+)\s*[-–—·:]*\s*(.*)$/i);
  if (adminMatch) {
    const num = adminMatch[1];
    const name = adminMatch[2].trim();
    return name ? `${num} · ${name}` : `Ward ${num}`;
  }

  // Handle "Ward 12" or "Ward 12 - Name" or "Ward A"
  const wardNumMatch = wardName.match(/^Ward\s*([0-9A-Za-z/_-]+)\s*[-–—·:]*\s*(.*)$/i);
  if (wardNumMatch) {
    const num = wardNumMatch[1];
    const name = wardNumMatch[2].trim();
    return name ? `${num} · ${name}` : `Ward ${num}`;
  }

  // Strip prefixes if present
  const cleanName = wardName
    .replace(/^Admin Ward\s*[0-9A-Za-z]+\s*[-–—·:]*\s*/i, '')
    .replace(/^Ward\s*[0-9A-Za-z/_-]+\s*[-–—·:]*\s*/i, '')
    .trim();

  if (numStr && cleanName && !cleanName.toLowerCase().startsWith('ward')) {
    return `${numStr} · ${cleanName}`;
  }

  return cleanName || wardName || (numStr ? `Ward ${numStr}` : 'Ward');
}

export interface StateThermalMetric {
  stateName: string;
  capital?: string;
  temperature?: number;
  humidity?: number;
  heatIndex?: number;
  wbgt?: number;
  heatCondition?: string;
  thermalStress?: string;
  source?: 'metro_ward_peak' | 'state_capital_nwp';
  monitoredCities?: string[];
}

export function formatStateDisplayName(rawName: string): string {
  if (!rawName) return 'Unknown Region';
  if (rawName.toUpperCase().startsWith('DISPUTED')) {
    const match = rawName.match(/DISPUTED\s*\((.*?)\)/i);
    if (match) return formatStateDisplayName(match[1]) + ' (Border Region)';
  }
  return rawName
    .toLowerCase()
    .split(' ')
    .map((w) => {
      if (w === '&') return '&';
      if (w === 'and') return 'and';
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

/**
 * Robust matching between GeoJSON state feature names and stateMetrics dictionary keys.
 * Handles casing, '&' vs 'and', whitespace, punctuation, and disputed border regions.
 */
export function lookupStateMetric(
  stateMetrics: Record<string, StateThermalMetric> | undefined,
  rawStateName: string
): StateThermalMetric | undefined {
  if (!rawStateName || !stateMetrics) return undefined;

  // 1. Direct key match (case-sensitive or lowercase)
  const direct = stateMetrics[rawStateName] || stateMetrics[rawStateName.toLowerCase()];
  if (direct) return direct;

  // 2. Normalized alphanumeric comparison
  const norm = rawStateName.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');

  for (const [key, val] of Object.entries(stateMetrics)) {
    const keyNorm = key.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
    if (keyNorm === norm) return val;

    // Substring contains for variants like "Andaman and Nicobar" vs "Andaman & Nicobar Islands"
    if (norm.length >= 6 && keyNorm.length >= 6) {
      if (keyNorm.includes(norm) || norm.includes(keyNorm)) return val;
    }

    // Disputed border regions (e.g., "Disputed (Madhya Pradesh & Gujarat)" -> match first state)
    if (norm.startsWith('disputed') && (norm.includes(keyNorm) || keyNorm.includes(norm.replace('disputed', '')))) {
      return val;
    }
  }

  return undefined;
}

/**
 * Creates the National States vector layer for LOD 0 (zoom 4 to 7).
 * Displays all 36 Indian States & UTs with high-contrast boundaries and thematic thermal fill.
 * Unmonitored states receive a neutral slate baseline to attenuate Bhuvan LULC green cropland bleed-through.
 */
export function createNationalStatesLayer(
  geojsonData: GeoJSON.FeatureCollection,
  stateMetrics: Record<string, StateThermalMetric> = {},
  options: {
    activeLayer?: ThematicLayerType;
    maxZoom?: number;
  } = {}
): VectorLayer<VectorSource> {
  const { activeLayer = 'heat_conditions', maxZoom = MAX_MAP_ZOOM } = options;

  const features = new GeoJSON().readFeatures(geojsonData, { featureProjection: 'EPSG:3857' });
  features.forEach((f) => {
    f.set('isStateFeature', true);
  });

  const source = new VectorSource({
    features,
  });

  return new VectorLayer({
    source,
    zIndex: 5,
    minZoom: MIN_MAP_ZOOM,
    maxZoom, // Allows continuous zooming without disappearing
    style: (feature) => {
      const props = feature.getProperties();
      const stateName = (
        props.state_name ||
        props.STATE ||
        props.ST_NM ||
        props.NAME_1 ||
        props.name ||
        ''
      ) as string;
      const metric = lookupStateMetric(stateMetrics, stateName);

      // Unmonitored states: neutral slate baseline attenuates Bhuvan LULC green cropland bleed-through
      let fillColor = 'rgba(241, 245, 249, 0.72)';
      let strokeColor = 'rgba(203, 213, 225, 0.85)';
      let strokeWidth = 1.0;

      if (metric) {
        // Monitored states: thematic fills (~0.50 opacity) with high-visibility 2.0px stroke matching classification
        strokeWidth = 2.0;
        if (activeLayer === 'heat_conditions') {
          // Classification delegated to threshold-config (single source) —
          // the previous inline 54/41/32 ladder disagreed with the
          // authoritative 45/40/35 bands at every boundary.
          let cond = metric.heatCondition;
          if (!cond && metric.temperature != null) {
            cond = classifyHeatCondition(metric.temperature);
          }
          if (cond === 'High' || cond === 'Extreme') {
            fillColor = 'rgba(249, 115, 22, 0.50)';
            strokeColor = '#ea580c';
          } else if (cond === 'Elevated') {
            fillColor = 'rgba(234, 179, 8, 0.48)';
            strokeColor = '#ca8a04';
          } else {
            fillColor = 'rgba(59, 130, 246, 0.45)';
            strokeColor = '#2563eb';
          }
        } else if (activeLayer === 'thermal_stress') {
          // Delegated to threshold-config — no inline band duplication.
          let stress = metric.thermalStress;
          if (!stress && metric.wbgt != null) {
            stress = classifyThermalStress(undefined, metric.wbgt);
          }
          if (stress === 'Severe') {
            fillColor = 'rgba(153, 27, 27, 0.55)';
            strokeColor = '#7f1d1d';
          } else if (stress === 'High') {
            fillColor = 'rgba(234, 88, 12, 0.50)';
            strokeColor = '#c2410c';
          } else if (stress === 'Moderate') {
            fillColor = 'rgba(250, 204, 21, 0.48)';
            strokeColor = '#eab308';
          } else {
            fillColor = 'rgba(34, 197, 94, 0.45)';
            strokeColor = '#16a34a';
          }
        }
      }

      return new Style({
        fill: new Fill({ color: fillColor }),
        stroke: new Stroke({ color: strokeColor, width: strokeWidth }),
        text: new Text({
          text: metric?.stateName || formatStateDisplayName(stateName),
          font: '600 10px system-ui, -apple-system, sans-serif',
          fill: new Fill({ color: '#1e293b' }),
          stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
          overflow: false,
        }),
      });
    },
    properties: { id: 'national-states-layer', name: 'Indian States & UTs' },
  });
}

/**
 * Creates the National City Markers vector layer for LOD 0 (zoom 4 to 7).
 * Monitored city centroid points are rendered with compact anchor styling and telemetry properties.
 */
export function createNationalCityMarkersLayer(
  cityTelemetry?: Record<string, { temp?: number; heatIndex?: number; wbgt?: number; risk?: string }>
): VectorLayer<VectorSource> {
  const source = new VectorSource();

  for (const city of CITY_LIST) {
    const [lon, lat] = city.center;
    const telem = cityTelemetry?.[city.id];
    const tempStr = telem?.temp ? `${telem.temp}°C` : '';
    const feature = new Feature({
      geometry: new Point(toWebMercator(lon, lat)),
      city_id: city.id,
      city_name: city.name,
      ward_count: city.wardCount,
      state: city.state,
      temp: tempStr,
      temp_val: telem?.temp,
      heatIndex: telem?.heatIndex,
      wbgt: telem?.wbgt,
      risk: telem?.risk,
      isCityMarker: true,
    });
    source.addFeature(feature);
  }

  const layer = new VectorLayer({
    source,
    zIndex: 30, // Elevated above states layer and basemap
    minZoom: MIN_MAP_ZOOM,
    maxZoom: LOD_CITY_MIN_ZOOM, // Visible only up to zoom 8
    style: (feature) => {
      const name = feature.get('city_name') as string;

      return [
        // Outer glowing pulse ring
        new Style({
          image: new CircleStyle({
            radius: 12,
            fill: new Fill({ color: 'rgba(234, 88, 12, 0.22)' }),
            stroke: new Stroke({ color: 'rgba(234, 88, 12, 0.75)', width: 1.5 }),
          }),
        }),
        // Inner anchor point with compact city label
        new Style({
          image: new CircleStyle({
            radius: 5.5,
            fill: new Fill({ color: '#ea580c' }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
          text: new Text({
            text: name,
            offsetY: 18,
            textAlign: 'center',
            font: '600 11px system-ui, -apple-system, sans-serif',
            fill: new Fill({ color: '#0f172a' }),
            stroke: new Stroke({ color: '#ffffff', width: 3 }),
          }),
        }),
      ];
    },
    properties: { id: 'national-city-markers', name: 'Monitored Cities' },
  });

  return layer;
}

/**
 * Creates the administrative wards VectorLayer with Progressive LOD and visual hierarchy.
 * - Zoom 4–7: Suppressed (returns null / empty style)
 * - Zoom 8–12: Rendered with choropleth fill and crisp boundaries (no text labels)
 * - Zoom 13–18: Rendered with choropleth fill, crisp boundaries, and compact haloed ward identifiers
 * - Distinctive highlight styling on selected ward (3.5px #00f2fe with z-index elevation)
 * - Distinctive hover styling on hovered ward
 */
export function createAdminWardsLayer(
  geojsonData: GeoJSON.FeatureCollection,
  wardRisks: WardRisk[] = [],
  options: {
    activeLayer?: ThematicLayerType;
    selectedWardId?: string | null;
    hoveredWardId?: string | null;
  } = {}
): VectorLayer<VectorSource> {
  const { activeLayer = 'heat_conditions', selectedWardId = null, hoveredWardId = null } = options;

  // Build lookup index: supports lookup by ward_id, ward_name, and id2
  const riskMap: Record<string, WardRisk> = {};
  wardRisks.forEach((r) => {
    const name = r.wardName || r.ward_name || '';
    const id = r.wardId || r.ward_id || '';
    if (name) {
      const lower = name.toLowerCase().trim();
      riskMap[lower] = r;
      riskMap[lower.replace(/^admin ward \d+\s*/i, '')] = r;
      riskMap[lower.replace(/[^a-z0-9]/g, '')] = r;
    }
    if (id) {
      const lowerId = id.toLowerCase().trim();
      riskMap[lowerId] = r;
      riskMap[lowerId.replace(/[^a-z0-9]/g, '')] = r;
    }
  });

  const source = new VectorSource({
    features: new GeoJSON().readFeatures(geojsonData, { featureProjection: 'EPSG:3857' }),
  });

  return new VectorLayer({
    source,
    zIndex: 10,
    minZoom: LOD_CITY_MIN_ZOOM, // Suppressed at National LOD (zoom 4-7)
    maxZoom: MAX_MAP_ZOOM,
    style: (feature, resolution) => {
      // Approximate zoom level from resolution
      const zoom = Math.round(Math.log2(156543.03392804097 / resolution));

      const props = feature.getProperties();
      const wardId = (props.ward_id || props.id2 || props.id || feature.getId() || '') as string;
      const wardName = (props.ward_name || props.name || props.Name || wardId || 'Unknown') as string;

      const normId = String(wardId).toLowerCase().trim();
      const normName = wardName.toLowerCase().trim();
      const cleanName = normName.replace(/^admin ward \d+\s*/i, '');
      const alphaId = normId.replace(/[^a-z0-9]/g, '');
      const alphaName = normName.replace(/[^a-z0-9]/g, '');

      const risk =
        riskMap[normId] ||
        riskMap[normName] ||
        riskMap[cleanName] ||
        riskMap[alphaId] ||
        riskMap[alphaName];

      const colors = getWardThematicColor(activeLayer, risk);

      const isSelected =
        selectedWardId &&
        (normId === selectedWardId.toLowerCase().trim() ||
          normName === selectedWardId.toLowerCase().trim() ||
          cleanName === selectedWardId.toLowerCase().trim());

      const isHovered =
        hoveredWardId &&
        (normId === hoveredWardId.toLowerCase().trim() ||
          normName === hoveredWardId.toLowerCase().trim() ||
          cleanName === hoveredWardId.toLowerCase().trim());

      // 2. Selected Ward: Distinctive cyan highlight border (#00f2fe, 3.5px width) with z-index elevation
      if (isSelected) {
        return new Style({
          zIndex: 100,
          fill: new Fill({
            color: colors.fill.replace(/0\.\d+/, '0.65'), // Richer fill opacity
          }),
          stroke: new Stroke({
            color: '#00f2fe',
            width: 3.5,
          }),
          text: new Text({
            text: formatCompactWardIdentifier(props),
            textAlign: 'center',
            overflow: true,
            font: 'bold 12px system-ui, -apple-system, sans-serif',
            fill: new Fill({ color: '#0f172a' }),
            stroke: new Stroke({ color: '#ffffff', width: 3.5 }),
          }),
        });
      }

      // 3. Hovered Ward: Subtle stroke highlight and brightened fill
      if (isHovered) {
        return new Style({
          zIndex: 50,
          fill: new Fill({
            color: colors.fill.replace(/0\.\d+/, '0.55'),
          }),
          stroke: new Stroke({
            color: '#ffffff',
            width: 2.5,
          }),
          text:
            zoom >= LOD_WARD_LABEL_MIN_ZOOM
              ? new Text({
                  text: formatCompactWardIdentifier(props),
                  textAlign: 'center',
                  overflow: true,
                  font: 'bold 11px system-ui, -apple-system, sans-serif',
                  fill: new Fill({ color: '#0f172a' }),
                  stroke: new Stroke({ color: '#ffffff', width: 3 }),
                })
              : undefined,
        });
      }

      // 4. City Scale (zoom 8–12): Choropleth fill + crisp boundary stroke (no text labels)
      if (zoom < LOD_WARD_LABEL_MIN_ZOOM) {
        return new Style({
          fill: new Fill({ color: colors.fill }),
          stroke: new Stroke({
            color: 'rgba(255, 255, 255, 0.85)',
            width: 1.2,
          }),
        });
      }

      // 5. Ward Scale (zoom 13–18): Choropleth fill + crisp boundary stroke + compact ward identifiers
      return new Style({
        fill: new Fill({ color: colors.fill }),
        stroke: new Stroke({
          color: 'rgba(255, 255, 255, 0.9)',
          width: 1.5,
        }),
        text: new Text({
          text: formatCompactWardIdentifier(props),
          textAlign: 'center',
          overflow: true,
          font: '600 10px system-ui, -apple-system, sans-serif',
          scale: 0.95,
          fill: new Fill({ color: '#0f172a' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
        }),
      });
    },
    properties: { id: 'admin-wards-layer', name: 'Administrative Wards' },
  });
}

export const INDIA_BBOX: [number, number, number, number] = [68.1, 6.7, 97.5, 37.2];

/**
 * Fits the OpenLayers view smoothly to India national extent.
 */
export function fitToIndia(
  map: Map,
  options: { duration?: number; padding?: [number, number, number, number] } = {}
): boolean {
  const { duration = 800, padding = [20, 20, 20, 20] } = options;
  const view = map.getView();
  const extent3857 = transformExtent(INDIA_BBOX, 'EPSG:4326', 'EPSG:3857');

  view.fit(extent3857 as Extent, {
    padding,
    duration,
    maxZoom: 6,
  });

  return true;
}

/**
 * Fits the OpenLayers view smoothly to the bounding box of a specified city.
 */
export function flyToCity(
  map: Map,
  cityId: CityId | string,
  options: { duration?: number; padding?: [number, number, number, number] } = {}
): boolean {
  const meta = CITIES[cityId.toLowerCase() as CityId];
  if (!meta || !meta.bbox) return false;

  const { duration = 800, padding = [20, 20, 20, 20] } = options;
  const view = map.getView();

  // BBox in EPSG:4326: [minLon, minLat, maxLon, maxLat]
  const [minLon, minLat, maxLon, maxLat] = meta.bbox;
  const extent3857 = transformExtent([minLon, minLat, maxLon, maxLat], 'EPSG:4326', 'EPSG:3857');

  view.fit(extent3857 as Extent, {
    padding,
    duration,
    maxZoom: 13,
  });

  return true;
}

export interface InitMapOptions {
  initialCenter?: [number, number]; // [lon, lat]
  initialZoom?: number;
  bhuvanController?: BhuvanBasemapController;
  additionalLayers?: import('ol/layer/Base').default[];
}

/**
 * Initializes the OpenLayers map with Bhuvan WMS as the primary basemap,
 * OpenStreetMap (OSM) as automatic fallback, and progressive LOD configuration.
 *
 * Fully backwards compatible: accepts either an options object or an array of additional layers.
 */
export function initMap(
  containerId: string | HTMLElement,
  optionsOrLayers?: import('ol/layer/Base').default[] | InitMapOptions
): Map {
  let initialCenter = BENGALURU_CENTER;
  let initialZoom = 11;
  let bhuvanController: BhuvanBasemapController | undefined;
  let additionalLayers: import('ol/layer/Base').default[] = [];

  if (Array.isArray(optionsOrLayers)) {
    additionalLayers = optionsOrLayers;
  } else if (optionsOrLayers && typeof optionsOrLayers === 'object') {
    if (optionsOrLayers.initialCenter) initialCenter = optionsOrLayers.initialCenter;
    if (optionsOrLayers.initialZoom !== undefined) initialZoom = optionsOrLayers.initialZoom;
    if (optionsOrLayers.bhuvanController) bhuvanController = optionsOrLayers.bhuvanController;
    if (optionsOrLayers.additionalLayers) additionalLayers = optionsOrLayers.additionalLayers;
  }

  const controller = bhuvanController || createBhuvanBasemapController();

  const view = new View({
    center: toWebMercator(...initialCenter),
    zoom: initialZoom,
    minZoom: MIN_MAP_ZOOM,
    maxZoom: MAX_MAP_ZOOM,
  });

  const cityMarkersLayer = createNationalCityMarkersLayer();

  const map = new Map({
    target: containerId,
    layers: [
      controller.bhuvanLayer,
      controller.osmLayer,
      controller.satelliteLayer,
      cityMarkersLayer,
      ...additionalLayers,
    ],
    view,
    controls: [
      new Zoom(),
      new ScaleLine({ units: 'metric' }),
    ],
  });

  // Store controller on map instance for easy retrieval
  map.set('basemapController', controller);

  return map;
}
