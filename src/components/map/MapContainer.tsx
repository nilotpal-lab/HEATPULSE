'use client';

/**
 * HeatPulse — OpenLayers Map Container
 * Conforms to Requirement R2 & PROJECT.md § Basemap Engine & Spatial Contrast
 *
 * Core Capabilities:
 * 1. Primary ISRO NRSC Bhuvan WMS basemap with automatic OSM network error fallback
 * 2. Visual Hierarchy:
 *    - Dimmed basemap context
 *    - Thematic heat choropleth (Heat Conditions / Thermal Stress)
 *    - Crisp administrative ward boundaries
 *    - Distinctive cyan highlight on selected ward (#00f2fe, 3.5px border, elevated z-index)
 *    - Hover stroke highlight and pointer cursor
 * 3. Progressive Level of Detail (LOD):
 *    - Zoom 4–7: National scale (suppresses municipal ward polygons, displays city markers)
 *    - Zoom 8–12: City scale (renders ward polygons with fill and stroke, suppresses labels)
 *    - Zoom 13–18: Ward scale (renders ward polygons, borders, and haloed text labels)
 * 4. Multi-City Dynamic Spatial Focus:
 *    - Dynamic bbox fitting across all 6 cities (Bengaluru, Pune, Mumbai, Kolkata, Chennai, Coimbatore)
 *    - Bidirectional ward selection synchronization
 * 5. Controls:
 *    - LayerSwitcher: Heat Conditions, Thermal Stress, Health Impact [Disabled]
 *    - MapLegend: Active layer color swatches & visual keys
 *    - BasemapStatusIndicator: ISRO Bhuvan WMS vs OSM Fallback status
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as OlMap } from 'ol';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Fill, Stroke, Style, Text } from 'ol/style';
import type { FeatureLike } from 'ol/Feature';
import {
  initMap,
  createNationalStatesLayer,
  createNationalCityMarkersLayer,
  flyToCity,
  fitToIndia,
  formatCompactWardIdentifier,
  formatStateDisplayName,
  lookupStateMetric,
  BENGALURU_CENTER,
  INDIA_CENTER,
  INDIA_ZOOM,
  LOD_CITY_MIN_ZOOM,
  LOD_WARD_LABEL_MIN_ZOOM,
  MAX_MAP_ZOOM,
  getWardThematicColor,
  classifyHeatConditionValue,
  classifyThermalStressValue,
  calculateRelativeRiskProxy,
  type WardRisk,
  type ThematicLayerType,
  type BhuvanBasemapController,
  type BasemapStatus,
  type StateThermalMetric,
} from './map-config';
import {
  createBhuvanBasemapController,
  getBhuvanLayerForScope,
  type BasemapMode,
} from './BhuvanLayer';
import { CITIES, CityId, CITY_LIST } from '@/types/gis';
import LayerSwitcher from './LayerSwitcher';
import MapLegend from './MapLegend';
import BasemapStatusIndicator from './BasemapStatusIndicator';
 
export interface HoverTooltipState {
  type: 'ward' | 'city' | 'state';
  x: number;
  y: number;
  wardNumber?: string;
  wardName?: string;
  metricLabel?: string;
  metricValue?: string;
  category?: string;
  badgeBg?: string;
  badgeText?: string;
  badgeBorder?: string;
  cityName?: string;
  stateName?: string;
  temperature?: string;
  wbgt?: string;
  wardCount?: number;
  subtext?: string;
}

export interface MapContainerProps {
  adminWardsGeoJSON?: GeoJSON.FeatureCollection;
  indiaStatesGeoJSON?: GeoJSON.FeatureCollection;
  stateMetrics?: Record<string, StateThermalMetric>;
  cityTelemetry?: Record<string, { temp?: number; heatIndex?: number; wbgt?: number; risk?: string }>;
  isNational?: boolean;
  bhuvanLayer?: string; // e.g. 'lulc:BR_LULC50K_1112'
  wardRisks?: WardRisk[];
  selectedWard?: string | null;
  selectedWardId?: string | null;
  selectedCity?: CityId | string;
  activeLayer?: ThematicLayerType;
  onWardSelect?: (ward: string | null) => void;
  onSelectWard?: (wardId: string | null) => void;
  onCitySelect?: (cityId: CityId) => void;
  onLayerChange?: (layer: ThematicLayerType) => void;
  className?: string;
}

export default function MapContainer({
  adminWardsGeoJSON,
  indiaStatesGeoJSON,
  stateMetrics = {},
  cityTelemetry,
  isNational = false,
  bhuvanLayer: propBhuvanLayer,
  wardRisks = [],
  selectedWard = null,
  selectedWardId: propSelectedWardId,
  selectedCity = 'pune',
  activeLayer: propActiveLayer,
  onWardSelect,
  onSelectWard,
  onCitySelect,
  onLayerChange,
  className = '',
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const wardsLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const wardsSourceRef = useRef<VectorSource | null>(null);
  const loadedGeoJSONRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const statesLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const cityMarkersLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const basemapControllerRef = useRef<BhuvanBasemapController | null>(null);

  // Stable callback refs for OpenLayers event listeners
  const onWardSelectRef = useRef(onWardSelect);
  const onSelectWardRef = useRef(onSelectWard);
  const onCitySelectRef = useRef(onCitySelect);
  const prevCityRef = useRef<string>(selectedCity);

  const [mapReady, setMapReady] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(isNational ? INDIA_ZOOM : 11);
  const [activeCityId, setActiveCityId] = useState<string>(selectedCity);
  const [localActiveLayer, setLocalActiveLayer] = useState<ThematicLayerType>(
    propActiveLayer || 'heat_conditions'
  );
  const [basemapMode, setBasemapMode] = useState<BasemapMode>('street');
  const [basemapStatus, setBasemapStatus] = useState<BasemapStatus>('street_active');
  const [basemapStatusMessage, setBasemapStatusMessage] = useState<string>('');
  const [hoveredWard, setHoveredWard] = useState<string | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipState | null>(null);
  const [localSelectedWard, setLocalSelectedWard] = useState<string | null>(null);

  const handleBasemapModeChange = (mode: BasemapMode) => {
    setBasemapMode(mode);
    if (basemapControllerRef.current) {
      basemapControllerRef.current.setBasemapMode(mode);
      setBasemapStatus(basemapControllerRef.current.getStatus());
    }
  };

  // Resolved active layer
  const effectiveActiveLayer = propActiveLayer || localActiveLayer;
  // Resolved selected ward identifier (matches name or ID)
  const effectiveSelectedWard = propSelectedWardId || selectedWard || localSelectedWard;

  // Memoized ward risk lookup index for O(1) hover lookups
  const wardRiskMap = React.useMemo(() => {
    const map: Record<string, WardRisk> = {};
    wardRisks.forEach((r) => {
      const name = r.wardName || r.ward_name || '';
      const id = r.wardId || r.ward_id || '';
      if (name) {
        const lower = name.toLowerCase().trim();
        map[lower] = r;
        map[lower.replace(/^admin ward \d+\s*/i, '')] = r;
        map[lower.replace(/[^a-z0-9]/g, '')] = r;
      }
      if (id) {
        const lowerId = id.toLowerCase().trim();
        map[lowerId] = r;
        map[lowerId.replace(/[^a-z0-9]/g, '')] = r;
      }
    });
    return map;
  }, [wardRisks]);

  const wardRiskMapRef = useRef(wardRiskMap);
  const activeLayerRef = useRef(effectiveActiveLayer);
  const stateMetricsRef = useRef(stateMetrics);
  const selectedWardRef = useRef<string | null>(effectiveSelectedWard);
  const hoveredWardRef = useRef<string | null>(hoveredWard);
  const adminWardsGeoJSONRef = useRef(adminWardsGeoJSON);
  const getDynamicWardStyleRef = useRef<(feature: FeatureLike, resolution: number) => Style | Style[] | undefined>(() => undefined);

  useEffect(() => {
    onWardSelectRef.current = onWardSelect;
    onSelectWardRef.current = onSelectWard;
    onCitySelectRef.current = onCitySelect;
    wardRiskMapRef.current = wardRiskMap;
    activeLayerRef.current = effectiveActiveLayer;
    stateMetricsRef.current = stateMetrics;
    selectedWardRef.current = effectiveSelectedWard;
    hoveredWardRef.current = hoveredWard;
    adminWardsGeoJSONRef.current = adminWardsGeoJSON;
  });

  // Dynamic OpenLayers style function reading ward metrics in O(1)
  const getDynamicWardStyle = useCallback((feature: FeatureLike, resolution: number) => {
    const zoom = Math.round(Math.log2(156543.03392804097 / resolution));
    const props = feature.getProperties();
    const wardId = String(props.ward_id || props.id2 || props.id || feature.getId() || '');
    const wardName = String(props.ward_name || props.name || props.Name || wardId || 'Unknown');

    const normId = wardId.toLowerCase().trim();
    const normName = wardName.toLowerCase().trim();
    const cleanName = normName.replace(/^admin ward \d+\s*/i, '');
    const alphaId = normId.replace(/[^a-z0-9]/g, '');
    const alphaName = normName.replace(/[^a-z0-9]/g, '');

    const rMap = wardRiskMapRef.current;
    const risk =
      rMap[normId] ||
      rMap[normName] ||
      rMap[cleanName] ||
      rMap[alphaId] ||
      rMap[alphaName];

    const currentLayer = activeLayerRef.current;
    const colors = getWardThematicColor(currentLayer, risk);

    const sel = selectedWardRef.current;
    const isSelected = Boolean(
      sel &&
      (normId === sel.toLowerCase().trim() ||
        normName === sel.toLowerCase().trim() ||
        cleanName === sel.toLowerCase().trim() ||
        alphaId === sel.toLowerCase().replace(/[^a-z0-9]/g, ''))
    );

    const hov = hoveredWardRef.current;
    const isHovered = Boolean(
      hov &&
      (normId === hov.toLowerCase().trim() ||
        normName === hov.toLowerCase().trim() ||
        cleanName === hov.toLowerCase().trim() ||
        alphaId === hov.toLowerCase().replace(/[^a-z0-9]/g, ''))
    );

    if (isSelected) {
      return new Style({
        zIndex: 100,
        fill: new Fill({
          color: colors.fill.replace(/0\.\d+/, '0.65'),
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

    if (zoom < LOD_WARD_LABEL_MIN_ZOOM) {
      return new Style({
        fill: new Fill({ color: colors.fill }),
        stroke: new Stroke({
          color: 'rgba(255, 255, 255, 0.85)',
          width: 1.2,
        }),
      });
    }

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
  }, []);
  getDynamicWardStyleRef.current = getDynamicWardStyle;

  // Handle layer switch
  const handleLayerChange = useCallback(
    (layer: ThematicLayerType) => {
      setLocalActiveLayer(layer);
      if (onLayerChange) onLayerChange(layer);
    },
    [onLayerChange]
  );

  // Initialize OpenLayers Map (SSR-Safe)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let initialCenter: [number, number];
    let initialZoom: number;

    if (isNational) {
      initialCenter = INDIA_CENTER;
      initialZoom = INDIA_ZOOM;
    } else {
      const initialCityMeta = CITIES[selectedCity.toLowerCase() as CityId] || CITIES.bengaluru;
      initialCenter = initialCityMeta?.center || BENGALURU_CENTER;
      initialZoom = initialCityMeta?.defaultZoom || 11;
    }

    const targetBhuvanLayer = propBhuvanLayer || getBhuvanLayerForScope(isNational, selectedCity);
    const controller = createBhuvanBasemapController({
      layerName: targetBhuvanLayer,
      initialMode: 'street',
      onStatusChange: (status, message) => {
        setBasemapStatus(status);
        if (message) setBasemapStatusMessage(message);
      },
    });
    basemapControllerRef.current = controller;

    const map = initMap(containerRef.current, {
      initialCenter,
      initialZoom,
      bhuvanController: controller,
    });

    mapRef.current = map;
    if (typeof window !== 'undefined') {
      (window as unknown as { __olMap?: OlMap }).__olMap = map;
    }

    // Administrative Wards Vector Source & Layer (Persistent single instance per city)
    const wardsSource = new VectorSource();
    wardsSourceRef.current = wardsSource;

    const wardsLayer = new VectorLayer({
      source: wardsSource,
      zIndex: 10,
      minZoom: LOD_CITY_MIN_ZOOM,
      maxZoom: MAX_MAP_ZOOM,
      style: (feature, resolution) => getDynamicWardStyleRef.current(feature, resolution),
      properties: { id: 'admin-wards-layer', name: 'Administrative Wards' },
    });
    wardsLayerRef.current = wardsLayer;
    map.addLayer(wardsLayer);

    const initialGeoJSON = adminWardsGeoJSONRef.current;
    if (initialGeoJSON) {
      const features = new GeoJSON().readFeatures(initialGeoJSON, {
        featureProjection: 'EPSG:3857',
      });
      wardsSource.addFeatures(features);
      loadedGeoJSONRef.current = initialGeoJSON;
    }

    // Geometry Auto-Fit:
    // In National mode: call fitToIndia with calibrated asymmetric padding [45, 30, 55, 30]
    // In City mode: execute flyToCity(map, selectedCity, { duration: 600, padding: [20, 20, 20, 20] })
    if (isNational) {
      setTimeout(() => {
        fitToIndia(map, { duration: 600, padding: [45, 30, 55, 30] });
      }, 100);
    } else {
      setTimeout(() => {
        flyToCity(map, selectedCity, { duration: 600, padding: [20, 20, 20, 20] });
      }, 100);
    }

    // Monitor Zoom for LOD display
    map.on('moveend', () => {
      const view = map.getView();
      const zoom = view.getZoom();
      if (zoom !== undefined) {
        setCurrentZoom(Math.round(zoom * 10) / 10);
      }
    });

    // Single Click Handler: Handles ward clicks and national city marker clicks
    map.on('singleclick', (event) => {
      const feature = map.forEachFeatureAtPixel(event.pixel, (f) => f);

      if (feature) {
        // 1. National City Marker Click: Fly smoothly to city
        if (feature.get('isCityMarker')) {
          const clickedCityId = feature.get('city_id') as CityId;
          if (clickedCityId) {
            flyToCity(map, clickedCityId, { duration: 600, padding: [20, 20, 20, 20] });
            setActiveCityId(clickedCityId);
            onCitySelectRef.current?.(clickedCityId);
          }
          return;
        }

        // 2. State Polygon Click: Ignore clicks on state polygons to prevent false ward selection
        if (feature.get('isStateFeature') || (isNational && !feature.get('ward_id'))) {
          return;
        }

        // 3. Ward Polygon Click
        const props = feature.getProperties();
        const wardId = (props.ward_id || props.id2 || props.id || feature.getId() || '') as string;
        const wardName = (props.ward_name || props.name || props.Name || wardId || 'Unknown') as string;

        const newSelected = wardId || wardName;
        setLocalSelectedWard(newSelected);
        if (selectedWardRef.current !== newSelected) {
          selectedWardRef.current = newSelected;
          wardsLayerRef.current?.changed();
        }
        onWardSelectRef.current?.(wardName);
        onSelectWardRef.current?.(wardId || wardName);
      } else {
        // Deselect when clicking outside
        setLocalSelectedWard(null);
        if (selectedWardRef.current !== null) {
          selectedWardRef.current = null;
          wardsLayerRef.current?.changed();
        }
        onWardSelectRef.current?.(null);
        onSelectWardRef.current?.(null);
      }
    });

    // Pointer Move Handler: Instant floating Hover Tooltip popover & pointer cursor
    map.on('pointermove', (event) => {
      if (event.dragging) {
        setHoverTooltip(null);
        return;
      }

      const pixel = event.pixel;
      const hit = map.forEachFeatureAtPixel(pixel, (f) => f);
      const targetElement = map.getTargetElement();

      if (hit) {
        targetElement.style.cursor = 'pointer';
        const props = hit.getProperties();
        const containerWidth = targetElement.clientWidth || 800;
        const clampedX = Math.min(Math.max(pixel[0], 140), containerWidth - 140);

        // 1. National City Marker Hover
        if (hit.get('isCityMarker')) {
          const cityName = hit.get('city_name') as string;
          const state = hit.get('state') as string;
          const wardCount = hit.get('ward_count') as number;
          const tempVal = hit.get('temp_val') as number | undefined;
          const tempStr = hit.get('temp') as string;
          const wbgtVal = hit.get('wbgt') as number | undefined;

          setHoveredWard(null);
          setHoverTooltip({
            type: 'city',
            x: clampedX,
            y: pixel[1],
            cityName,
            stateName: state,
            wardCount,
            temperature: tempVal !== undefined ? `${tempVal}°C` : (tempStr || 'N/A'),
            wbgt: wbgtVal !== undefined ? `${wbgtVal}°C` : 'N/A',
          });
          return;
        }

        // 2. National State Polygon Hover (LOD 0)
        const isState = hit.get('isStateFeature') || (isNational && !props.ward_id && !props.ward_name);
        if (isState) {
          const rawStateName = (
            props.state_name ||
            props.STATE ||
            props.ST_NM ||
            props.NAME_1 ||
            props.name ||
            ''
          ) as string;
          const sMetrics = stateMetricsRef.current;
          const metric = lookupStateMetric(sMetrics, rawStateName);

          const displayName = metric?.stateName || formatStateDisplayName(rawStateName);
          const currentLayer = activeLayerRef.current;
          setHoveredWard(null);

          let metricLabel: string | undefined = 'Peak Temperature';
          let metricValue: string | undefined = '--';
          let category = 'Regional Baseline / Unmonitored';
          let badgeBg = 'bg-slate-100';
          let badgeText = 'text-slate-700';
          let badgeBorder = 'border-slate-300';
          let subtext: string | undefined = undefined;

          if (metric) {
            if (metric.source === 'metro_ward_peak' && metric.monitoredCities && metric.monitoredCities.length > 0) {
              subtext = `Monitored Metros: ${metric.monitoredCities.join(', ')} (Peak Ward Telemetry)`;
            } else if (metric.capital) {
              subtext = `State Capital NWP Telemetry (${metric.capital})`;
            }

            if (currentLayer === 'heat_conditions') {
              metricLabel = metric.source === 'metro_ward_peak' ? 'Peak Temperature' : 'Capital Temperature';
              const t = metric.temperature;
              metricValue = t !== undefined ? `${t}°C` : '--';
              let cond = metric.heatCondition;
              if (!cond && t !== undefined) {
                cond = t >= 54 ? 'Extreme' : t >= 41 ? 'High' : t >= 32 ? 'Elevated' : 'Normal';
              }
              category = cond || 'Normal';
              if (category === 'Extreme') {
                badgeBg = 'bg-rose-100'; badgeText = 'text-rose-900'; badgeBorder = 'border-rose-300';
              } else if (category === 'High') {
                badgeBg = 'bg-orange-100'; badgeText = 'text-orange-900'; badgeBorder = 'border-orange-300';
              } else if (category === 'Elevated') {
                badgeBg = 'bg-yellow-100'; badgeText = 'text-yellow-900'; badgeBorder = 'border-yellow-300';
              } else {
                badgeBg = 'bg-blue-50'; badgeText = 'text-blue-900'; badgeBorder = 'border-blue-200';
              }
            } else if (currentLayer === 'thermal_stress') {
              metricLabel = metric.source === 'metro_ward_peak' ? 'Peak WBGT' : 'Capital WBGT';
              const wbgt = metric.wbgt;
              metricValue = wbgt !== undefined ? `${wbgt}°C` : '--';
              let stress = metric.thermalStress;
              if (!stress && wbgt !== undefined) {
                stress = wbgt >= 32 ? 'Severe' : wbgt >= 30 ? 'High' : wbgt >= 28 ? 'Moderate' : 'Low';
              }
              category = stress || 'Low';
              if (category === 'Severe') {
                badgeBg = 'bg-rose-100'; badgeText = 'text-rose-900'; badgeBorder = 'border-rose-300';
              } else if (category === 'High') {
                badgeBg = 'bg-orange-100'; badgeText = 'text-orange-900'; badgeBorder = 'border-orange-300';
              } else if (category === 'Moderate') {
                badgeBg = 'bg-yellow-100'; badgeText = 'text-yellow-900'; badgeBorder = 'border-yellow-300';
              } else {
                badgeBg = 'bg-emerald-50'; badgeText = 'text-emerald-900'; badgeBorder = 'border-emerald-200';
              }
            } else if (currentLayer === 'health_impact') {
              metricLabel = 'Health Impact';
              metricValue = 'Model In Development';
              category = 'Disabled (R5)';
              badgeBg = 'bg-slate-100'; badgeText = 'text-slate-700'; badgeBorder = 'border-slate-300';
            }
          } else {
            metricLabel = undefined;
            metricValue = undefined;
            category = 'Regional Baseline / Unmonitored';
            badgeBg = 'bg-slate-100';
            badgeText = 'text-slate-700';
            badgeBorder = 'border-slate-300';
            subtext = 'Regional baseline (unmonitored). Municipal telemetry active in 6 metro regions.';
          }

          setHoverTooltip({
            type: 'state',
            x: clampedX,
            y: pixel[1],
            stateName: displayName,
            metricLabel,
            metricValue,
            category,
            badgeBg,
            badgeText,
            badgeBorder,
            subtext,
          });
          return;
        }

        // 3. Ward Polygon Hover
        const wardId = (props.ward_id || props.id2 || props.id || hit.getId() || '') as string;
        const rawWardName = (props.ward_name || props.name || props.Name || wardId || 'Unknown') as string;
        const normId = String(wardId).toLowerCase().trim();
        const normName = rawWardName.toLowerCase().trim();
        const cleanName = normName.replace(/^admin ward \d+\s*/i, '');
        const alphaId = normId.replace(/[^a-z0-9]/g, '');
        const alphaName = normName.replace(/[^a-z0-9]/g, '');

        const rMap = wardRiskMapRef.current;
        const risk =
          rMap[normId] ||
          rMap[normName] ||
          rMap[cleanName] ||
          rMap[alphaId] ||
          rMap[alphaName];

        const compactId = formatCompactWardIdentifier(props);
        const newHoveredWard = wardId || rawWardName;
        if (hoveredWardRef.current !== newHoveredWard) {
          hoveredWardRef.current = newHoveredWard;
          setHoveredWard(newHoveredWard);
          wardsLayerRef.current?.changed();
        }

        const currentLayer = activeLayerRef.current;
        let metricLabel = 'Temperature';
        let metricValue = '--';
        let category = 'Normal';
        let badgeBg = 'bg-blue-50';
        let badgeText = 'text-blue-700';
        let badgeBorder = 'border-blue-200';

        if (currentLayer === 'heat_conditions') {
          metricLabel = 'Temperature';
          const t = risk?.currentTemp;
          metricValue = t !== undefined ? `${t}°C` : (risk?.heatIndex !== undefined ? `${risk.heatIndex}°C` : '--');
          const cond = risk?.heatCondition || risk?.heat_condition;
          const item = classifyHeatConditionValue(t, risk?.heatIndex);
          category = cond || item.key;
          badgeBg = item.badgeBg;
          badgeText = item.badgeText;
          badgeBorder = item.badgeBorder;
        } else if (currentLayer === 'thermal_stress') {
          metricLabel = 'WBGT Stress';
          const wbgt = risk?.wbgt;
          metricValue = wbgt !== undefined ? `${wbgt}°C` : '--';
          const stress = risk?.thermalStress || risk?.thermal_stress;
          const item = classifyThermalStressValue(wbgt, risk?.heatIndex);
          category = stress || item.key;
          badgeBg = item.badgeBg;
          badgeText = item.badgeText;
          badgeBorder = item.badgeBorder;
        } else if (currentLayer === 'health_impact') {
          const { rr, item } = calculateRelativeRiskProxy(risk?.wbgt, risk?.vulnerabilityScore);
          metricLabel = 'Relative Risk (RR)';
          metricValue = `${rr}x (${rr > 1.0 ? `+${Math.round((rr - 1.0) * 100)}%` : 'Baseline'})`;
          category = item.label;
          badgeBg = item.badgeBg;
          badgeText = item.badgeText;
          badgeBorder = item.badgeBorder;
        } else {
          metricLabel = 'Composite Risk';
          metricValue = risk?.compositeRisk !== undefined ? String(risk.compositeRisk) : '--';
          category = String(risk?.compositeRiskLevel || 'Low');
          badgeBg = 'bg-amber-50'; badgeText = 'text-amber-800'; badgeBorder = 'border-amber-200';
        }

        const parts = compactId.split('·').map((s) => s.trim());
        let wardNumStr = '';
        let wardNameStr = compactId;
        if (parts.length >= 2) {
          wardNumStr = parts[0];
          wardNameStr = parts.slice(1).join(' · ');
        } else if (props.raw_ward_id || props.raw_ward_num) {
          wardNumStr = String(props.raw_ward_id || props.raw_ward_num);
        }

        setHoverTooltip({
          type: 'ward',
          x: clampedX,
          y: pixel[1],
          wardNumber: wardNumStr ? `Ward ${wardNumStr}` : (compactId.startsWith('Ward') ? compactId : undefined),
          wardName: wardNameStr,
          metricLabel,
          metricValue,
          category,
          badgeBg,
          badgeText,
          badgeBorder,
        });
      } else {
        targetElement.style.cursor = '';
        if (hoveredWardRef.current !== null) {
          hoveredWardRef.current = null;
          setHoveredWard(null);
          wardsLayerRef.current?.changed();
        }
        setHoverTooltip(null);
      }
    });

    const targetEl = map.getTargetElement();
    const handleMouseLeave = () => {
      setHoverTooltip(null);
      if (hoveredWardRef.current !== null) {
        hoveredWardRef.current = null;
        setHoveredWard(null);
        wardsLayerRef.current?.changed();
      }
    };
    if (targetEl) {
      targetEl.addEventListener('mouseleave', handleMouseLeave);
    }

    setMapReady(true);

    // Resize observer to ensure map canvas updates size cleanly
    const resizeObserver = new ResizeObserver(() => {
      map.updateSize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (targetEl) {
        targetEl.removeEventListener('mouseleave', handleMouseLeave);
      }
      resizeObserver.disconnect();
      basemapControllerRef.current?.dispose();
      map.dispose();
      mapRef.current = null;
      if (typeof window !== 'undefined') {
        delete (window as unknown as { __olMap?: OlMap }).__olMap;
      }
      wardsLayerRef.current = null;
      wardsSourceRef.current = null;
      loadedGeoJSONRef.current = null;
      statesLayerRef.current = null;
      cityMarkersLayerRef.current = null;
    };
  }, [propBhuvanLayer, selectedCity, isNational]);

  // Synchronize Bhuvan WMS layer when scope/city changes
  useEffect(() => {
    const targetLayer = propBhuvanLayer || getBhuvanLayerForScope(isNational, selectedCity);
    basemapControllerRef.current?.setLayer(targetLayer);
  }, [propBhuvanLayer, isNational, selectedCity]);

  // Synchronize GeoJSON features into the single persistent VectorSource (Only when GeoJSON reference changes)
  useEffect(() => {
    const source = wardsSourceRef.current;
    if (!source) return;

    if (adminWardsGeoJSON && adminWardsGeoJSON !== loadedGeoJSONRef.current) {
      loadedGeoJSONRef.current = adminWardsGeoJSON;
      const features = new GeoJSON().readFeatures(adminWardsGeoJSON, {
        featureProjection: 'EPSG:3857',
      });
      source.clear();
      source.addFeatures(features);
      wardsLayerRef.current?.changed();
    } else if (!adminWardsGeoJSON && loadedGeoJSONRef.current) {
      loadedGeoJSONRef.current = null;
      source.clear();
      wardsLayerRef.current?.changed();
    }
  }, [adminWardsGeoJSON]);

  // Trigger fast style re-render (~16ms) on selection changes
  useEffect(() => {
    selectedWardRef.current = effectiveSelectedWard;
    wardsLayerRef.current?.changed();
  }, [effectiveSelectedWard]);

  // Trigger fast style re-render (~16ms) on layer mode switch
  useEffect(() => {
    activeLayerRef.current = effectiveActiveLayer;
    wardsLayerRef.current?.changed();
  }, [effectiveActiveLayer]);

  // Trigger fast style re-render (~16ms) on ward risk metric updates
  useEffect(() => {
    wardRiskMapRef.current = wardRiskMap;
    wardsLayerRef.current?.changed();
  }, [wardRiskMap]);

  // Update National States Layer (LOD 0)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !indiaStatesGeoJSON) return;

    if (statesLayerRef.current) {
      map.removeLayer(statesLayerRef.current);
      statesLayerRef.current = null;
    }

    const newStatesLayer = createNationalStatesLayer(indiaStatesGeoJSON, stateMetrics, {
      activeLayer: effectiveActiveLayer,
    });

    statesLayerRef.current = newStatesLayer;
    map.addLayer(newStatesLayer);
  }, [indiaStatesGeoJSON, stateMetrics, effectiveActiveLayer]);

  // Update City Markers Layer with live telemetry
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (cityMarkersLayerRef.current) {
      map.removeLayer(cityMarkersLayerRef.current);
      cityMarkersLayerRef.current = null;
    }

    const newMarkersLayer = createNationalCityMarkersLayer(cityTelemetry);
    cityMarkersLayerRef.current = newMarkersLayer;
    map.addLayer(newMarkersLayer);
  }, [cityTelemetry]);

  // Handle City Switch from prop: Fly to city bounding box when prop changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCity || isNational) return;

    if (prevCityRef.current !== selectedCity) {
      prevCityRef.current = selectedCity;
      flyToCity(map, selectedCity, { duration: 600, padding: [20, 20, 20, 20] });
      setActiveCityId(selectedCity);
    }
  }, [selectedCity, isNational]);

  // Handle Basemap Retry
  const handleRetryBhuvan = () => {
    if (basemapControllerRef.current) {
      basemapControllerRef.current.retryBhuvan();
      setBasemapStatus(basemapControllerRef.current.getStatus());
      setBasemapStatusMessage('Reconnecting to ISRO Bhuvan WMS...');
    }
  };

  // Handle Manual Basemap Toggle (Bhuvan <-> OSM)
  const handleToggleBasemap = () => {
    if (basemapControllerRef.current) {
      if (basemapStatus === 'bhuvan_active') {
        basemapControllerRef.current.switchToFallback('User manually selected OpenStreetMap');
        setBasemapStatus('osm_fallback');
        setBasemapStatusMessage('OpenStreetMap basemap active');
      } else {
        basemapControllerRef.current.retryBhuvan();
        setBasemapStatus('bhuvan_active');
        setBasemapStatusMessage('ISRO Bhuvan WMS active');
      }
    }
  };

  // Dynamic LOD scale badge label
  const getLodBadge = () => {
    if (currentZoom < 8) return { label: 'National Overview (LOD 0)', color: 'bg-indigo-100 text-indigo-700' };
    if (currentZoom < 13) return { label: 'City Scale (LOD 1)', color: 'bg-emerald-100 text-emerald-700' };
    return { label: 'Ward Scale (LOD 2)', color: 'bg-amber-100 text-amber-700' };
  };

  const lodInfo = getLodBadge();

  return (
    <div className={`relative w-full h-full min-h-[550px] overflow-hidden ${className}`}>
      {/* OpenLayers Map Canvas */}
      <div
        id="heatpulse-map-container"
        ref={containerRef}
        className="w-full h-full absolute inset-0 focus:outline-none"
      />

      {/* Floating Hover Tooltip Popover */}
      {hoverTooltip && (
        <div
          className="absolute z-40 pointer-events-none transition-all duration-75 ease-out shadow-2xl rounded-xl border border-zinc-200/90 bg-white/95 backdrop-blur-md p-3 text-xs"
          style={{
            left: hoverTooltip.x,
            top: hoverTooltip.y < 120 ? hoverTooltip.y + 18 : hoverTooltip.y - 12,
            transform: hoverTooltip.y < 120 ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            minWidth: '220px',
            maxWidth: '280px',
          }}
        >
          {hoverTooltip.type === 'ward' ? (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-1.5">
                <div>
                  {hoverTooltip.wardNumber && (
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      {hoverTooltip.wardNumber}
                    </span>
                  )}
                  <h4 className="font-bold text-zinc-900 text-sm leading-tight">
                    {hoverTooltip.wardName}
                  </h4>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${hoverTooltip.badgeBg} ${hoverTooltip.badgeText} ${hoverTooltip.badgeBorder}`}
                >
                  {hoverTooltip.category}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <span className="text-zinc-500 font-medium">{hoverTooltip.metricLabel}:</span>
                <span className="font-bold text-zinc-900 font-mono text-xs">
                  {hoverTooltip.metricValue}
                </span>
              </div>
            </div>
          ) : hoverTooltip.type === 'state' ? (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-1.5">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    State / UT
                  </span>
                  <h4 className="font-bold text-zinc-900 text-sm leading-tight">
                    {hoverTooltip.stateName}
                  </h4>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${hoverTooltip.badgeBg} ${hoverTooltip.badgeText} ${hoverTooltip.badgeBorder}`}
                >
                  {hoverTooltip.category}
                </span>
              </div>
              {hoverTooltip.metricValue ? (
                <div className="flex items-center justify-between text-[11px] pt-0.5">
                  <span className="text-zinc-500 font-medium">{hoverTooltip.metricLabel}:</span>
                  <span className="font-bold text-zinc-900 font-mono text-xs">
                    {hoverTooltip.metricValue}
                  </span>
                </div>
              ) : (
                <div className="text-[11px] text-zinc-500 pt-0.5 leading-snug">
                  <span>{hoverTooltip.subtext || 'Regional baseline (unmonitored). Municipal telemetry active in 6 metro regions.'}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-1.5">
                <div>
                  <h4 className="font-bold text-zinc-900 text-sm leading-tight">
                    {hoverTooltip.cityName}
                  </h4>
                  <span className="text-[10px] font-medium text-zinc-500">
                    {hoverTooltip.stateName} · {hoverTooltip.wardCount} wards
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-zinc-50 rounded-lg p-1.5 border border-zinc-100">
                  <span className="text-[10px] text-zinc-400 block font-medium">Temperature</span>
                  <span className="font-bold text-zinc-900 font-mono">{hoverTooltip.temperature}</span>
                </div>
                <div className="bg-zinc-50 rounded-lg p-1.5 border border-zinc-100">
                  <span className="text-[10px] text-zinc-400 block font-medium">WBGT Stress</span>
                  <span className="font-bold text-amber-700 font-mono">{hoverTooltip.wbgt}</span>
                </div>
              </div>
              <div className="text-[10px] font-semibold text-blue-600 flex items-center gap-1 pt-0.5">
                <span>Quick jump to inspect wards →</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {!mapReady && (
        <div className="absolute inset-0 bg-zinc-100/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-zinc-600 text-sm flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">Initializing ISRO Bhuvan Basemap…</span>
          </div>
        </div>
      )}

      {/* Top Controls Overlay: City Quick Jump & Layer Switcher */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: City Quick Navigation Pills */}
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-zinc-200/80 p-1 flex items-center gap-1 overflow-x-auto max-w-[calc(100vw-360px)]">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 select-none">
            City
          </span>
          {CITY_LIST.map((city) => {
            const isActive = city.id === (activeCityId || selectedCity).toLowerCase();
            return (
              <button
                key={city.id}
                type="button"
                onClick={() => {
                  if (mapRef.current) {
                    flyToCity(mapRef.current, city.id, { duration: 600, padding: [20, 20, 20, 20] });
                  }
                  setActiveCityId(city.id);
                  if (onCitySelect) onCitySelect(city.id);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 shrink-0 select-none ${
                  isActive
                    ? 'bg-zinc-900 text-white shadow-sm font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
                title={`Focus ${city.name} (${city.wardCount} municipal wards)`}
              >
                {city.name}
              </button>
            );
          })}
        </div>

        {/* Right: Basemap Mode Switcher & Thematic Layer Switcher */}
        <div className="pointer-events-auto flex items-center gap-2 flex-wrap justify-end">
          {/* Basemap Mode Selector */}
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-zinc-200/80 p-1 flex items-center gap-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 select-none">
              Map Style
            </span>
            <button
              type="button"
              onClick={() => handleBasemapModeChange('street')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 select-none ${
                basemapMode === 'street'
                  ? 'bg-zinc-900 text-white shadow-sm font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title="Clean Street View (OpenStreetMap)"
            >
              Street View
            </button>
            <button
              type="button"
              onClick={() => handleBasemapModeChange('satellite')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 select-none ${
                basemapMode === 'satellite'
                  ? 'bg-zinc-900 text-white shadow-sm font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title="High-Resolution Optical Satellite Imagery"
            >
              Satellite
            </button>
            <button
              type="button"
              onClick={() => handleBasemapModeChange('bhuvan')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 select-none ${
                basemapMode === 'bhuvan'
                  ? 'bg-zinc-900 text-white shadow-sm font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title="ISRO NRSC Bhuvan WMS"
            >
              ISRO Bhuvan
            </button>
          </div>

          <LayerSwitcher
            activeLayer={effectiveActiveLayer}
            onLayerChange={handleLayerChange}
          />
        </div>
      </div>

      {/* Bottom-Left Controls: Legend & LOD Zoom Status */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-2 pointer-events-none">
        {/* LOD Zoom Badge */}
        <div className="pointer-events-auto self-start bg-white/95 backdrop-blur-md rounded-lg shadow border border-zinc-200/80 px-2.5 py-1 flex items-center gap-2 text-[11px] select-none">
          <span className="font-mono text-zinc-600 font-semibold">Z{currentZoom}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${lodInfo.color}`}>
            {lodInfo.label}
          </span>
          {currentZoom < 8 && (
            <span className="text-[10px] text-zinc-400">(Zoom in to see ward boundaries)</span>
          )}
        </div>

        {/* Thematic Legend */}
        <div className="pointer-events-auto">
          <MapLegend activeLayer={effectiveActiveLayer} />
        </div>
      </div>

      {/* Bottom-Right Controls: Basemap Status Indicator */}
      <div className="absolute bottom-3 right-3 z-10 pointer-events-auto flex items-center gap-2">
        <BasemapStatusIndicator
          status={basemapStatus}
          statusMessage={basemapStatusMessage}
          onRetryBhuvan={handleRetryBhuvan}
          onToggleFallback={handleToggleBasemap}
        />
      </div>
    </div>
  );
}
