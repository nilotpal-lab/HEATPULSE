'use client';

/**
 * HeatPulse — Page 1: India Overview
 * Conforms to Requirement R6 & PROJECT.md § Page 1: India Overview
 *
 * Capabilities:
 * 1. National-scale thermal overview (LOD 0: no ward polygon clutter, city marker pins)
 * 2. 6 Monitored City Summary Cards (Bengaluru 369, Pune 15, Mumbai 24, Kolkata 141, Chennai 200, Coimbatore 100)
 * 3. Current NWP-derived atmospheric metrics per city (Dry-bulb, Heat Index, WBGT, UTCI Proxy)
 * 4. District Heat Evaluation status color codes (HeatPulse local IMD-criteria eval)
 * 5. One-click navigation to City Overview
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Globe2,
  Building,
  ArrowRight,
} from 'lucide-react';
import { CITY_LIST, type CityId } from '@/types/gis';
import { useHeatPulseStore, heatPulseActions } from '@/lib/store';
import { evaluateImdDistrictWarning, type ImdDistrictWarning } from '@/lib/imd-service';
import {
  classifyHeatCondition,
  classifyThermalStress,
} from '@/lib/threshold-config';
import FreshnessBanner from '@/components/navigation/FreshnessBanner';
import MapContainer from '@/components/map/MapContainer';
import type { StateThermalMetric } from '@/lib/map-config';
import type { StateThermalData } from '@/app/api/states/route';

interface CityCardMetrics {
  cityId: CityId;
  name: string;
  state: string;
  wardCount: number;
  /** Presence means a genuine city value; null = unavailable (never a fabricated peak). */
  temperature: number | null;
  humidity: number | null;
  heatIndex: number | null;
  wbgt: number | null;
  utciProxy: number | null;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Severe' | null;
  imdWarning: ImdDistrictWarning;
  status: 'fresh' | 'stale' | 'loading' | 'unavailable';
}

export default function IndiaOverviewPage() {
  const router = useRouter();
  const selectedCity = useHeatPulseStore((s) => s.selectedCity);

  const [cityMetrics, setCityMetrics] = useState<CityCardMetrics[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  // State-capital telemetry for all 36 States/UTs (fetched from /api/states)
  const [stateApiData, setStateApiData] = useState<Record<string, StateThermalData>>({});

  // Initialize and load all 6 cities data
  useEffect(() => {
    let isMounted = true;

    async function loadAllCities() {
      setLoading(true);

      const promises = CITY_LIST.map(async (city) => {
        try {
          // Check if already in cache or fetch
          const res = await fetch(`/api/risk?city=${city.id}`);
          if (!res.ok) throw new Error(`Failed to fetch ${city.id}`);
          const data = await res.json();

          const legacyWards = data.wards || [];
          const assessments = data.assessments || [];

          // Derive city-wide peak thermal metrics — genuine values only. When a city
          // has no ward telemetry the fields are null (rendered as '--'), never
          // a fabricated 34.0/37.0/28.5 placeholder.
          const validTemps = (legacyWards as Array<{ currentTemp?: number }>)
            .map((w) => w.currentTemp).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
          const validHis = (legacyWards as Array<{ heatIndex?: number }>)
            .map((w) => w.heatIndex).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
          const validWbgts = (legacyWards as Array<{ wbgt?: number }>)
            .map((w) => w.wbgt).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
          const validUtci = (assessments as Array<{ thermal?: { utci_proxy?: number } }>)
            .map((a) => a.thermal?.utci_proxy).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

          const peakTemp = validTemps.length > 0 ? Math.max(...validTemps) : null;
          const peakHI = validHis.length > 0 ? Math.max(...validHis) : null;
          const peakWbgt = validWbgts.length > 0 ? Math.max(...validWbgts) : null;
          const peakUtci = validUtci.length > 0 ? Math.max(...validUtci) : null;

          let maxRiskLevel: 'Low' | 'Moderate' | 'High' | 'Severe' | null = null;
          if (assessments.length > 0) {
            const hasSevere = assessments.some(
              (a: { composite_risk_level: string }) => a.composite_risk_level === 'Severe'
            );
            const hasHigh = assessments.some(
              (a: { composite_risk_level: string }) => a.composite_risk_level === 'High'
            );
            const hasModerate = assessments.some(
              (a: { composite_risk_level: string }) => a.composite_risk_level === 'Moderate'
            );
            maxRiskLevel = hasSevere ? 'Severe' : hasHigh ? 'High' : hasModerate ? 'Moderate' : 'Low';
          }

          // IMD evaluation uses the real peak temperature when available; with
          // no telemetry it renders an explicit unavailable assessment.
          const imdWarning = evaluateImdDistrictWarning(city.id, peakTemp ?? undefined);

          return {
            cityId: city.id,
            name: city.name,
            state: city.state,
            wardCount: city.wardCount,
            temperature: peakTemp != null ? Math.round(peakTemp * 10) / 10 : null,
            humidity: null,
            heatIndex: peakHI != null ? Math.round(peakHI * 10) / 10 : null,
            wbgt: peakWbgt != null ? Math.round(peakWbgt * 10) / 10 : null,
            utciProxy: peakUtci != null ? Math.round(peakUtci * 10) / 10 : null,
            riskLevel: maxRiskLevel,
            imdWarning,
            status: legacyWards.length > 0 ? ('fresh' as const) : ('unavailable' as const),
          };
        } catch {
          // No fabricated fallback numbers: mark the city unavailable; the IMD
          // evaluation also renders as unavailable without a real temperature.
          const imd = evaluateImdDistrictWarning(city.id, undefined);
          return {
            cityId: city.id,
            name: city.name,
            state: city.state,
            wardCount: city.wardCount,
            temperature: null,
            humidity: null,
            heatIndex: null,
            wbgt: null,
            utciProxy: null,
            riskLevel: null,
            imdWarning: imd,
            status: 'unavailable' as const,
          };
        }
      });

      const results = await Promise.all(promises);
      if (isMounted) {
        setCityMetrics(results);
        setLoading(false);
        setLastFetched(Date.now());
      }
    }

    loadAllCities();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeLayer = useHeatPulseStore((s) => s.activeLayer);
  const [indiaGeoJson, setIndiaGeoJson] = useState<GeoJSON.FeatureCollection | undefined>(undefined);

  // Load India States GeoJSON
  useEffect(() => {
    fetch('/data/processed/geojson/india-states.geojson')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setIndiaGeoJson(data);
      })
      .catch((err) => console.error('Failed to load India states GeoJSON:', err));
  }, []);

  // Fetch state-capital NWP telemetry for all 36 States & UTs
  useEffect(() => {
    let isMounted = true;
    fetch('/api/states')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.states && isMounted) {
          setStateApiData(data.states as Record<string, StateThermalData>);
        }
      })
      .catch((err) => console.warn('[IndiaPage] /api/states fetch failed:', err));
    return () => { isMounted = false; };
  }, []);

  // Derive state metrics and city telemetry for national choropleth layer.
  // Priority: city ward data (more granular) > state capital NWP data.
  const { stateMetrics, cityTelemetry } = React.useMemo(() => {
    const sMetrics: Record<string, StateThermalMetric> = {};
    const cTelem: Record<string, { temp?: number; heatIndex?: number; wbgt?: number; risk?: string }> = {};

    // 1. Seed all states from state-capital NWP data (fills all 36 states & UTs)
    Object.values(stateApiData).forEach((s) => {
      sMetrics[s.stateKey] = {
        stateName: s.stateName,
        capital: s.capital,
        temperature: s.temperature,
        humidity: s.humidity,
        heatIndex: s.heatIndex,
        wbgt: s.wbgt,
        heatCondition: s.heatCondition,
        thermalStress: s.thermalStress,
        source: 'state_capital_nwp',
      };
    });

    // 2. Override with city ward data (peak aggregated, more granular)
    cityMetrics.forEach((c) => {
      cTelem[c.cityId] = {
        temp: c.temperature ?? undefined,
        heatIndex: c.heatIndex ?? undefined,
        wbgt: c.wbgt ?? undefined,
        risk: c.riskLevel ?? undefined,
      };

      // Map city metrics to their respective states with multi-city peak aggregation
      const stateKey = c.state.toLowerCase();
      const existing = sMetrics[stateKey];

      const tempArr = [existing?.temperature, c.temperature].filter((v): v is number => v != null && Number.isFinite(v));
      const hiArr = [existing?.heatIndex, c.heatIndex].filter((v): v is number => v != null && Number.isFinite(v));
      const wbgtArr = [existing?.wbgt, c.wbgt].filter((v): v is number => v != null && Number.isFinite(v));
      const maxTemp = tempArr.length > 0 ? Math.max(...tempArr) : undefined;
      const maxHI = hiArr.length > 0 ? Math.max(...hiArr) : undefined;
      const maxWbgt = wbgtArr.length > 0 ? Math.max(...wbgtArr) : undefined;

      const prevCities = existing?.monitoredCities || [];
      const updatedCities = prevCities.includes(c.name) ? prevCities : [...prevCities, c.name];

      sMetrics[stateKey] = {
        stateName: c.state,
        capital: existing?.capital,
        temperature: maxTemp != null ? Math.round(maxTemp * 10) / 10 : undefined,
        humidity: c.humidity ?? undefined,
        heatIndex: maxHI != null ? Math.round(maxHI * 10) / 10 : undefined,
        wbgt: maxWbgt != null ? Math.round(maxWbgt * 10) / 10 : undefined,
        heatCondition: maxTemp != null ? classifyHeatCondition(maxTemp) : undefined,
        thermalStress: maxWbgt != null ? classifyThermalStress(undefined, maxWbgt) : undefined,
        source: 'metro_ward_peak',
        monitoredCities: updatedCities,
      };
    });

    return { stateMetrics: sMetrics, cityTelemetry: cTelem };
  }, [cityMetrics, stateApiData]);

  const handleCityClick = (cityId: CityId) => {
    heatPulseActions.setSelectedCity(cityId);
    heatPulseActions.loadCityData(cityId);
    router.push('/');
  };

  const cityTemps = cityMetrics.map((c) => c.temperature).filter((v): v is number => v != null && Number.isFinite(v));
  const highestTemp = cityTemps.length > 0 ? Math.max(...cityTemps) : null;
  const imdAlertsCount = cityMetrics.filter(
    (c) => c.imdWarning.has_forecast_input && (c.imdWarning.color_code === 'ORANGE' || c.imdWarning.color_code === 'RED')
  ).length;

  return (
    <div className="flex-1 min-h-screen bg-zinc-50 pb-12">
      {/* Page Header & Stats Banner */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-8 py-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Globe2 className="w-5 h-5 text-orange-600" />
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
                  Pan-India Thermal Surveillance Overview
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1 max-w-3xl">
                National early warning and biometeorological monitoring across 6 key municipal corporations
                covering 849 administrative wards. Level of Detail (LOD 0) renders state boundaries and monitored city hubs.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <span>Launch City View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                Monitored Metros
              </span>
              <div className="text-2xl font-extrabold text-zinc-900 mt-0.5">6 Cities</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Bengaluru, Pune, Mumbai, Kolkata, Chennai, Coimbatore</div>
            </div>

            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                Operational Wards
              </span>
              <div className="text-2xl font-extrabold text-zinc-900 mt-0.5">849 Wards</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">100% Deterministic GIS Validation</div>
            </div>

            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                National Peak Temp
              </span>
              <div className="text-2xl font-extrabold text-orange-600 mt-0.5">
                {highestTemp != null ? `${highestTemp}°C` : '--°C'}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Across monitored municipal centroids</div>
            </div>

            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                IMD District Alerts
              </span>
              <div className="text-2xl font-extrabold text-zinc-900 mt-0.5">
                {imdAlertsCount > 0 ? (
                  <span className="text-amber-600">{imdAlertsCount} Active</span>
                ) : (
                  <span className="text-emerald-600">All Normal</span>
                )}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">IMD Criteria Assessment (computed locally; not an official bulletin)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-8 mt-6 space-y-6">
        {/* Freshness Banner */}
        <FreshnessBanner compact={false} lastUpdatedTime={lastFetched} />

        {/* National GIS Basemap Container (DOMINANT POSITION) */}
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs flex flex-col min-h-[760px]">
          <div className="p-4 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2 bg-white">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-orange-600" />
                <span>Pan-India Thermal & Biometeorological Overview (LOD 0)</span>
              </h3>
              <p className="text-xs text-zinc-500">
                Pan-India state boundaries, national heat distribution, and monitored city markers. Click any city marker to fly down to ward level.
              </p>
            </div>
            <div className="text-[11px] text-zinc-500 font-medium bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200">
              36 States & UTs · Synoptic Scale
            </div>
          </div>
          <div className="h-[720px] lg:h-[750px] w-full relative flex-1">
            <MapContainer
              indiaStatesGeoJSON={indiaGeoJson}
              stateMetrics={stateMetrics}
              cityTelemetry={cityTelemetry}
              isNational={true}
              selectedCity={selectedCity}
              activeLayer={activeLayer}
              onCitySelect={(cityId) => handleCityClick(cityId)}
              onLayerChange={(layer) => heatPulseActions.setActiveLayer(layer)}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* 6 Monitored City Summary Cards Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-orange-600" />
              <span>Monitored Municipal Centers (6 Cities · 849 Wards)</span>
            </h2>
            <span className="text-xs text-zinc-500">
              {loading ? 'Refreshing metro NWP forecasts...' : 'Click any card to inspect ward polygons'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CITY_LIST.map((city) => {
              const metrics = cityMetrics.find((m) => m.cityId === city.id);
              const isSelected = city.id === selectedCity;
              const imdColor = metrics?.imdWarning.color_code || 'GREEN';

              const imdBadges = {
                GREEN: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                YELLOW: 'bg-amber-50 text-amber-800 border-amber-200',
                ORANGE: 'bg-orange-50 text-orange-800 border-orange-200',
                RED: 'bg-red-50 text-red-800 border-red-200',
              };

              return (
                <div
                  key={city.id}
                  onClick={() => handleCityClick(city.id)}
                  className={`bg-white rounded-xl border p-4 shadow-xs hover:shadow-md transition-all cursor-pointer relative group ${
                    isSelected
                      ? 'border-orange-500 ring-2 ring-orange-500/20'
                      : 'border-zinc-200/80 hover:border-zinc-300'
                  }`}
                >
                  {/* City Title & Wards */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-zinc-900 group-hover:text-orange-600 transition-colors">
                          {city.name}
                        </h3>
                        {isSelected && (
                          <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.2 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">
                        {city.state} · {city.wardCount} Municipal Wards
                      </p>
                    </div>

                    {/* IMD District Badge (HeatPulse-applied criteria — not a bulletin) */}
                    <div
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        metrics && metrics.imdWarning.has_forecast_input
                          ? imdBadges[imdColor]
                          : 'bg-zinc-50 text-zinc-400 border-zinc-200'
                      }`}
                      title={metrics?.imdWarning.headline}
                    >
                      {metrics && metrics.imdWarning.has_forecast_input
                        ? `IMD Criteria: ${imdColor}`
                        : 'IMD Criteria: N/A'}
                    </div>
                  </div>

                  {/* Core Thermal Indicators */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-zinc-100 text-center">
                    <div className="bg-zinc-50 rounded-lg p-2">
                      <span className="text-[10px] text-zinc-500 block">Dry-Bulb Temp</span>
                      <span className="text-base font-bold text-zinc-900">
                        {metrics?.temperature ? `${metrics.temperature}°C` : '--'}
                      </span>
                    </div>

                    <div className="bg-orange-50/60 rounded-lg p-2">
                      <span className="text-[10px] text-orange-700 block">Heat Index</span>
                      <span className="text-base font-bold text-orange-950">
                        {metrics?.heatIndex ? `${metrics.heatIndex}°C` : '--'}
                      </span>
                    </div>

                    <div className="bg-red-50/60 rounded-lg p-2">
                      <span className="text-[10px] text-red-700 block">Outdoor WBGT</span>
                      <span className="text-base font-bold text-red-950">
                        {metrics?.wbgt ? `${metrics.wbgt}°C` : '--'}
                      </span>
                    </div>
                  </div>

                  {/* Footer Bar */}
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                    <span className="text-[11px]">
                      Apparent Temp: <strong className="text-zinc-700">{metrics?.utciProxy != null ? `${metrics.utciProxy}°C` : '--'}</strong> (UTCI Proxy)
                    </span>
                    <span className="flex items-center gap-1 text-orange-600 font-semibold group-hover:translate-x-0.5 transition-transform text-[11px]">
                      <span>Open City</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
