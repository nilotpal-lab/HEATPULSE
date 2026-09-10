'use client';

/**
 * HeatPulse — Right-Side Ward Detail Drawer
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 * Conforms to Requirement R6, R10 & R11
 *
 * Mandatory 8-Section Content Hierarchy with Compact Typography & Temporal Labels:
 * 1. Identity (Name, Unit ID, City, Corporation, Population, Centroid, Area)
 * 2. Current Conditions (Air Temp, RH, Wind Speed, Heat Condition; Explicit: Current Valid Time)
 * 3. Forecast Peak (Peak WBGT, Peak HI, Peak Temp, Duration; Explicit: Forecast Peak Window)
 * 4. Thermal Stress (Biometeorological WBGT, NOAA Heat Index, UTCI Proxy; Explicit: Assessment Window)
 * 5. Vulnerability (Census 2011 baseline proxies: Green deficit, Building density, Outdoor workers, Elderly)
 * 6. Risk (Thermal-Vulnerability Composite: alpha=0.6, beta=0.4 with Primary Driver diagnosis)
 * 7. Health Burden / RR (Relative Risk literature estimate, excess risk %, zero synthetic mortality disclaimer)
 * 8. Recommended Action (Actionable decision support window + Expandable Provenance & Attribution)
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  MapPin,
  TrendingUp,
  PieChart,
  Users,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Database,
  Trees,
  Building2,
  HardHat,
  Thermometer,
  Activity,
  HeartPulse,
} from 'lucide-react';
import { useHeatPulseStore, heatPulseActions } from '@/lib/store';
import { CITIES } from '@/types/gis';
import { formatToIST, formatDateIST } from '@/components/navigation/FreshnessBanner';
import { calculateHeatIndex, calculateWBGT } from '@/lib/thermal-engine';
import {
  classifyHeatCondition,
  classifyThermalStress,
  classifyVulnerabilityLevel,
  calculateRelativeRisk,
  RELATIVE_RISK_THRESHOLDS,
} from '@/lib/threshold-config';

export default function WardDetailDrawer() {
  const isOpen = useHeatPulseStore((s) => s.isDrawerOpen);
  const selectedCity = useHeatPulseStore((s) => s.selectedCity);
  const selectedWard = useHeatPulseStore((s) => s.selectedWard);
  const selectedWardId = useHeatPulseStore((s) => s.selectedWardId);
  const activeCityData = useHeatPulseStore((s) => s.cachedCityData[selectedCity]);
  const forecastContext = useHeatPulseStore(
    (s) => (s as { forecastContext?: { currentValidTime?: string | null; selectedValidTime?: string | null; mode?: string } }).forecastContext
  );

  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const cityMeta = CITIES[selectedCity] || CITIES.bengaluru;

  // Handle ESC key to close drawer
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        heatPulseActions.closeWardDrawer();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Find matching Ward Feature from GeoJSON
  const wardFeature = useMemo(() => {
    if (!activeCityData?.geoJson?.features || (!selectedWard && !selectedWardId)) return null;
    return activeCityData.geoJson.features.find((f) => {
      const p = f.properties;
      return (
        p.ward_id === selectedWardId ||
        p.ward_name === selectedWard ||
        p.ward_id === selectedWard ||
        p.ward_name === selectedWardId ||
        p.name === selectedWard ||
        p.id2 === selectedWardId
      );
    });
  }, [activeCityData, selectedWard, selectedWardId]);

  // Find matching Ward Risk Assessment
  const assessment = useMemo(() => {
    if (!activeCityData?.assessments || (!selectedWard && !selectedWardId)) return null;
    return activeCityData.assessments.find(
      (a) =>
        a.ward_id === selectedWardId ||
        a.ward_name === selectedWard ||
        a.ward_id === selectedWard ||
        a.ward_name === selectedWardId
    );
  }, [activeCityData, selectedWard, selectedWardId]);

  // Find matching legacy ward risk
  const legacyRisk = useMemo(() => {
    if (!activeCityData?.wardRisks) return null;
    return activeCityData.wardRisks.find(
      (w) =>
        w.wardId === selectedWardId ||
        w.ward_id === selectedWardId ||
        w.wardName === selectedWard ||
        w.wardName === selectedWardId
    );
  }, [activeCityData, selectedWard, selectedWardId]);

  // Find matching Weather Forecast
  const weatherForecast = useMemo(() => {
    if (!activeCityData?.weatherForecasts) return null;
    const key = selectedWardId || selectedWard || '';
    return (
      activeCityData.weatherForecasts[key] ||
      Object.values(activeCityData.weatherForecasts).find(
        (w) => w.ward_id === key || w.ward_name === selectedWard || w.ward_id === selectedWard
      ) ||
      null
    );
  }, [activeCityData, selectedWard, selectedWardId]);

  // Ward Identity Properties
  const wardName =
    assessment?.ward_name ||
    (wardFeature?.properties.ward_name as string) ||
    selectedWard ||
    'Selected Ward';

  const wardId =
    assessment?.ward_id ||
    (wardFeature?.properties.ward_id as string) ||
    selectedWardId ||
    '--';

  const corporation =
    (wardFeature?.properties.corporation as string) ||
    (wardFeature?.properties.zone as string) ||
    `${cityMeta.name} Municipal Corporation`;

  const population =
    (wardFeature?.properties.population as number) ||
    (wardFeature?.properties.TOT_P as number) ||
    null;

  const areaSqKm =
    (wardFeature?.properties.area_sqkm as number) ||
    (wardFeature?.properties.area as number) ||
    null;

  const centroid = wardFeature?.properties.centroid ||
    (legacyRisk ? [legacyRisk.lon, legacyRisk.lat] : cityMeta.center);

  // SECTION 2: Current meteorological values (GENUINE DATA ONLY — ZERO HARDCODED SUMMER FALLBACKS)
  const currentTemp =
    legacyRisk?.currentTemp != null
      ? Math.round(legacyRisk.currentTemp * 10) / 10
      : weatherForecast?.current?.temperature_2m != null
      ? Math.round(weatherForecast.current.temperature_2m * 10) / 10
      : (assessment as unknown as { temperature?: number })?.temperature != null
      ? Math.round((assessment as unknown as { temperature: number }).temperature * 10) / 10
      : null;

  const currentHumidity =
    legacyRisk?.currentHumidity != null
      ? Math.round(legacyRisk.currentHumidity)
      : weatherForecast?.current?.relative_humidity_2m != null
      ? Math.round(weatherForecast.current.relative_humidity_2m)
      : null;

  const currentWindSpeed =
    weatherForecast?.current?.wind_speed_10m != null
      ? Math.round(weatherForecast.current.wind_speed_10m * 10) / 10
      : null;
  // SECTION 4: Biometeorological metrics
  const heatIndex =
    assessment?.thermal?.heat_index != null
      ? Math.round(assessment.thermal.heat_index * 10) / 10
      : legacyRisk?.heatIndex != null
      ? Math.round(legacyRisk.heatIndex * 10) / 10
      : currentTemp != null && currentHumidity != null
      ? calculateHeatIndex(currentTemp, currentHumidity)
      : null;

  const wbgt =
    assessment?.thermal?.wbgt != null
      ? Math.round(assessment.thermal.wbgt * 10) / 10
      : legacyRisk?.wbgt != null
      ? Math.round(legacyRisk.wbgt * 10) / 10
      : currentTemp != null && currentHumidity != null
      ? calculateWBGT(currentTemp, currentHumidity)
      : null;

  const utciProxy =
    assessment?.thermal?.utci_proxy != null
      ? Math.round(assessment.thermal.utci_proxy * 10) / 10
      : weatherForecast?.current?.apparent_temperature != null
      ? Math.round(weatherForecast.current.apparent_temperature * 10) / 10
      : null;

  // Classification derived exclusively from threshold-config (single source of truth).
  const heatCondition: 'Normal' | 'Elevated' | 'High' | 'Extreme' =
    assessment?.thermal?.heat_condition ||
    (currentTemp != null ? classifyHeatCondition(currentTemp) : 'Normal');

  const thermalStress: 'Low' | 'Moderate' | 'High' | 'Severe' =
    assessment?.thermal?.thermal_stress ||
    (heatIndex != null || wbgt != null
      ? classifyThermalStress(heatIndex ?? 0, wbgt ?? undefined)
      : 'Low');

  // SECTION 3: Forecast Peak Period (Derived from genuine 120-hour NWP trajectory)
  const peakPeriodInfo = useMemo(() => {
    if (weatherForecast?.hourly?.time && weatherForecast.hourly.time.length > 0) {
      const times = weatherForecast.hourly.time;
      const temps = weatherForecast.hourly.temperature_2m;
      const hums = weatherForecast.hourly.relative_humidity_2m;

      let maxWbgt = -999;
      let maxHI = -999;
      let peakTemp = -999;
      let peakIsoTime = times[0];
      let hoursAbove30 = 0;

      for (let i = 0; i < times.length; i++) {
        const t = temps[i];
        const h = hums[i];
        const w = calculateWBGT(t, h);
        const hi = calculateHeatIndex(t, h);

        if (w >= 30.0) hoursAbove30++;

        if (w > maxWbgt) {
          maxWbgt = w;
          maxHI = hi;
          peakTemp = t;
          peakIsoTime = times[i];
        }
      }

      const peakDate = formatDateIST(peakIsoTime);
      const peakHourFormatted = formatToIST(peakIsoTime);
      const hourPart = parseInt(peakHourFormatted.slice(0, 2), 10);
      const startH = isNaN(hourPart) ? 13 : Math.max(0, hourPart - 1);
      const endH = Math.min(23, startH + 3);

      return {
        hasData: true,
        peakWbgt: Math.round(maxWbgt * 10) / 10,
        peakHeatIndex: Math.round(maxHI * 10) / 10,
        peakTemp: Math.round(peakTemp * 10) / 10,
        date: peakDate,
        window: `${String(startH).padStart(2, '0')}:00 – ${String(endH).padStart(2, '0')}:00 IST`,
        hoursAbove30,
      };
    }

    // No synthetic peak injection: without a 120h NWP trajectory the peak is
    // simply unavailable (never current + fabricated offset).
    return {
      hasData: false,
      peakWbgt: null,
      peakHeatIndex: null,
      peakTemp: null,
      date: '--',
      window: 'Awaiting NWP Grid',
      hoursAbove30: 0,
    };
  }, [weatherForecast]);

  // SECTION 5 & 6: Vulnerability & Composite Risk
  //
  // Data-honesty rules from PROJECT.md: never fabricate ward differences.
  // - Score and component fields are present ONLY when real ward-level data
  //   exists (provenance not 'Unavailable'). Otherwise they are null and the
  //   UI renders a clear "unavailable" state — never a made-up number.
  const vulnerabilityProvenance =
    assessment?.vulnerability_provenance ||
    (legacyRisk?.vulnerability_provenance as
      | { status: string; source?: string }
      | undefined) ||
    null;

  const vulnerabilityAvailable =
    vulnerabilityProvenance !== null &&
    vulnerabilityProvenance.status !== 'Unavailable';

  const vulnerabilityScore =
    assessment?.vulnerability_score ??
    legacyRisk?.vulnerabilityScore ??
    (vulnerabilityAvailable
      ? (wardFeature?.properties.vulnerability_score as number)
      : null) ??
    null;

  const vulnerabilityLevel =
    assessment?.vulnerability_level ||
    (vulnerabilityScore != null ? classifyVulnerabilityLevel(vulnerabilityScore) : 'Low');

  const greenCover: number | null =
    legacyRisk?.vulnerabilityGreenPct ??
    (wardFeature?.properties.green_space_pct as number) ??
    null;

  const buildingDensity: number | null =
    legacyRisk?.vulnerabilityBuildingDensity ??
    (wardFeature?.properties.building_density as number) ??
    null;

  const workerDensity: number | null =
    legacyRisk?.vulnerabilityWorkerDensity ??
    (wardFeature?.properties.outdoor_worker_density as number) ??
    null;

  const elderlyPct: number | null =
    (legacyRisk as { elderlyPopulationPct?: number })?.elderlyPopulationPct ??
    (wardFeature?.properties.elderly_pct as number) ??
    null;

  // A ward feature may carry GeoJSON attributes even when the assessment is
  // unavailable — those are only surfaced when provenance confirms real data.
  const componentDataAvailable = vulnerabilityAvailable;

  const compositeRiskScore =
    assessment?.composite_risk_score ?? legacyRisk?.compositeRisk ?? null;

  const compositeRiskLevel =
    assessment?.composite_risk_level ||
    (compositeRiskScore != null
      ? compositeRiskScore >= 70
        ? 'Severe'
        : compositeRiskScore >= 50
        ? 'High'
        : compositeRiskScore >= 30
        ? 'Moderate'
        : 'Low'
      : 'Low');

  // SECTION 7: Health Burden / Relative Risk (RR) Formulation
  // Single authoritative RR math lives in threshold-config.calculateRelativeRisk.
  const healthRelativeRisk = useMemo(() => {
    const effectiveWbgt = wbgt ?? null;
    if (effectiveWbgt == null) return null;

    const est = calculateRelativeRisk(
      effectiveWbgt,
      componentDataAvailable && vulnerabilityScore != null ? vulnerabilityScore : undefined
    );
    return {
      rr: est.rr,
      excessPct: est.excessPct,
      thresholdExceeded: effectiveWbgt > RELATIVE_RISK_THRESHOLDS.onsetWbgt,
      baseWbgt: effectiveWbgt,
    };
  }, [wbgt, componentDataAvailable, vulnerabilityScore]);

  // Temporal Labels
  const metadata =
    assessment?.forecast_metadata ||
    weatherForecast?.metadata ||
    activeCityData?.forecastMetadata;

  const currentValidTimeFormatted =
    forecastContext?.currentValidTime ||
    (metadata?.valid_time ? formatToIST(metadata.valid_time) : formatToIST(new Date().toISOString()));

  const forecastPeakWindowFormatted = `${peakPeriodInfo.date} · ${peakPeriodInfo.window}`;

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
      {/* Semi-transparent Backdrop: click to dismiss */}
      <div
        className="absolute inset-0 bg-zinc-900/30 backdrop-blur-[2px] pointer-events-auto transition-opacity duration-300"
        onClick={() => heatPulseActions.closeWardDrawer()}
        aria-hidden="true"
      />

      {/* Slide-In Drawer Panel with Compact Typography */}
      <aside
        aria-label={`Ward Intelligence: ${wardName}`}
        className="absolute top-0 right-0 h-full w-full sm:w-[460px] lg:w-[480px] bg-white shadow-2xl border-l border-zinc-200 pointer-events-auto flex flex-col z-10 transform transition-transform duration-300 ease-out"
      >
        {/* Drawer Sticky Top Header */}
        <div className="px-4 py-3 border-b border-zinc-200 bg-white/95 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-100 border border-orange-200 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-orange-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-zinc-900 truncate leading-tight">
                {wardName}
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="font-mono font-semibold text-zinc-700">{wardId}</span>
                <span>·</span>
                <span className="capitalize">{cityMeta.name}</span>
                <span>·</span>
                <span className="truncate max-w-[160px]">{corporation}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => heatPulseActions.closeWardDrawer()}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors shrink-0"
            aria-label="Close Ward Detail Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable 8-Section Hierarchy with Compact Typography & Temporal Badges */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-zinc-800 text-xs">
          {/* ============================================================ */}
          {/* SECTION 1: WARD IDENTITY */}
          {/* ============================================================ */}
          <section className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              <span>Section 1 · Ward Identity</span>
              <span className="text-[10px] font-mono text-zinc-400">EPSG:4326</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2 rounded-lg border border-zinc-200/60">
                <span className="text-[10px] text-zinc-400 block">Unit Identifier</span>
                <span className="font-mono font-bold text-zinc-900">{wardId}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-zinc-200/60">
                <span className="text-[10px] text-zinc-400 block">Corporation / Zone</span>
                <span className="font-semibold text-zinc-800 truncate block" title={corporation}>
                  {corporation}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-zinc-200/60">
                <span className="text-[10px] text-zinc-400 block">Baseline Population</span>
                <span className="font-semibold text-zinc-800">
                  {population ? population.toLocaleString('en-IN') : 'Not available'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-zinc-200/60">
                <span className="text-[10px] text-zinc-400 block">Centroid Coordinates</span>
                <span className="font-mono text-[11px] text-zinc-800">
                  {centroid[0].toFixed(4)}, {centroid[1].toFixed(4)}
                </span>
              </div>
              {areaSqKm != null && (
                <div className="col-span-2 bg-white px-2 py-1.5 rounded-lg border border-zinc-200/60 text-[11px] flex justify-between text-zinc-600">
                  <span>Administrative Geographic Area:</span>
                  <span className="font-semibold text-zinc-800">{areaSqKm.toFixed(2)} km²</span>
                </div>
              )}
            </div>
          </section>

          {/* ============================================================ */}
          {/* SECTION 2: CURRENT CONDITIONS */}
          {/* ============================================================ */}
          <section className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-zinc-700">
                <Thermometer className="w-3.5 h-3.5 text-orange-600" />
                <span>Section 2 · Current Conditions</span>
              </span>
              <span className="text-[10px] font-mono font-medium text-zinc-600 bg-zinc-200/70 px-1.5 py-0.5 rounded border border-zinc-300/40">
                Valid: {currentValidTimeFormatted}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="bg-white p-2 rounded-lg border border-zinc-200/60">
                <span className="text-[9px] text-zinc-400 block uppercase">Air Temp</span>
                <span className="text-base font-bold text-zinc-900 font-mono">
                  {currentTemp != null ? `${currentTemp}°C` : '--'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-zinc-200/60">
                <span className="text-[9px] text-zinc-400 block uppercase">Humidity</span>
                <span className="text-base font-bold text-zinc-900 font-mono">
                  {currentHumidity != null ? `${currentHumidity}%` : '--'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-zinc-200/60">
                <span className="text-[9px] text-zinc-400 block uppercase">Wind</span>
                <span className="text-base font-bold text-zinc-900 font-mono">
                  {currentWindSpeed != null ? `${currentWindSpeed}k` : '--'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-zinc-200/60 flex flex-col justify-center items-center">
                <span className="text-[9px] text-zinc-400 block uppercase">Status</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                    heatCondition === 'Extreme'
                      ? 'bg-red-100 text-red-800 border-red-200'
                      : heatCondition === 'High'
                      ? 'bg-orange-100 text-orange-800 border-orange-200'
                      : heatCondition === 'Elevated'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {heatCondition}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 italic">
              Atmospheric physical state sampled at ward centroid 2m AGL.
            </p>
          </section>

          {/* ============================================================ */}
          {/* SECTION 3: FORECAST PEAK */}
          {/* ============================================================ */}
          <section className="bg-orange-50/50 border border-orange-200/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-orange-800 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-orange-600" />
                <span>Section 3 · Forecast Peak (120 Hours)</span>
              </span>
              <span className="text-[10px] font-mono font-medium text-orange-900 bg-orange-200/70 px-1.5 py-0.5 rounded border border-orange-300/40">
                Window: {forecastPeakWindowFormatted}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2 rounded-lg border border-orange-200/60">
                <span className="text-[10px] text-zinc-500 block">Peak WBGT</span>
                <span className="text-base font-bold text-red-600 font-mono">
                  {peakPeriodInfo.peakWbgt != null ? `${peakPeriodInfo.peakWbgt}°C` : '--'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-orange-200/60">
                <span className="text-[10px] text-zinc-500 block">Peak Heat Index</span>
                <span className="text-base font-bold text-orange-600 font-mono">
                  {peakPeriodInfo.peakHeatIndex != null ? `${peakPeriodInfo.peakHeatIndex}°C` : '--'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-orange-200/60">
                <span className="text-[10px] text-zinc-500 block">Peak Air Temp</span>
                <span className="text-base font-bold text-zinc-800 font-mono">
                  {peakPeriodInfo.peakTemp != null ? `${peakPeriodInfo.peakTemp}°C` : '--'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-orange-100 text-[11px] text-zinc-700">
              <span>Projected Hours with WBGT ≥ 30°C:</span>
              <span className="font-bold text-orange-700 font-mono">{peakPeriodInfo.hoursAbove30} Hours</span>
            </div>
          </section>

          {/* ============================================================ */}
          {/* SECTION 4: THERMAL STRESS */}
          {/* ============================================================ */}
          <section className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-zinc-700">
                <Activity className="w-3.5 h-3.5 text-red-500" />
                <span>Section 4 · Human Thermal Stress</span>
              </span>
              <span className="text-[10px] font-mono font-medium text-zinc-600 bg-zinc-200/70 px-1.5 py-0.5 rounded border border-zinc-300/40">
                Assessment: {currentValidTimeFormatted}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2 rounded-lg border border-zinc-200/60">
                <span className="text-[10px] text-zinc-400 block">BoM WBGT</span>
                <span className="text-base font-bold text-red-600 font-mono">
                  {wbgt != null ? `${wbgt}°C` : '--'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-zinc-200/60">
                <span className="text-[10px] text-zinc-400 block">NOAA HI</span>
                <span className="text-base font-bold text-orange-600 font-mono">
                  {heatIndex != null ? `${heatIndex}°C` : '--'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-zinc-200/60">
                <span className="text-[10px] text-zinc-400 block">UTCI Proxy</span>
                <span className="text-base font-bold text-zinc-800 font-mono">
                  {utciProxy != null ? `${utciProxy}°C` : '--'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-zinc-200/60 text-[11px]">
              <span className="text-zinc-600">Active Thermal Classification:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded-full border text-[10px] uppercase ${
                  thermalStress === 'Severe'
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : thermalStress === 'High'
                    ? 'bg-orange-100 text-orange-800 border-orange-200'
                    : thermalStress === 'Moderate'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}
              >
                {thermalStress} Stress
              </span>
            </div>
          </section>
          {/* ============================================================ */}
          {/* SECTION 5: VULNERABILITY */}
          {/* ============================================================ */}
          <section className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-zinc-700">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                <span>Section 5 · Socio-Ecological Vulnerability</span>
              </span>
              <span className={`text-[10px] font-semibold ${
                vulnerabilityAvailable
                  ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                  : 'text-zinc-500 bg-zinc-100 border-zinc-200'
              } px-1.5 py-0.5 rounded border`}>
                {vulnerabilityAvailable
                  ? (vulnerabilityProvenance?.status === 'Proxy' ? 'Density Proxy' : 'Census 2011 Baseline')
                  : 'Unavailable'}
              </span>
            </div>

            {vulnerabilityAvailable ? (
              <>
                {componentDataAvailable ? (
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-white p-2 rounded-lg border border-zinc-200/60 flex items-center gap-2">
                      <Trees className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="text-[10px] text-zinc-400 block">Green Space Cover</span>
                        <span className="font-semibold text-zinc-900">
                          {greenCover != null ? `${greenCover}%` : '--'}
                        </span>
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-zinc-200/60 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-zinc-600 shrink-0" />
                      <div>
                        <span className="text-[10px] text-zinc-400 block">Building Density</span>
                        <span className="font-semibold text-zinc-900">
                          {buildingDensity != null ? `${Math.round(buildingDensity * 100)}%` : '--'}
                        </span>
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-zinc-200/60 flex items-center gap-2">
                      <HardHat className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="text-[10px] text-zinc-400 block">Outdoor Workers</span>
                        <span className="font-semibold text-zinc-900">
                          {workerDensity != null ? `${Math.round(workerDensity * 100)}%` : '--'}
                        </span>
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-zinc-200/60 flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <span className="text-[10px] text-zinc-400 block">Older Cohort (65+)</span>
                        <span className="font-semibold text-zinc-900">
                          {elderlyPct != null ? `${elderlyPct}%` : '--'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-zinc-500 italic">No ward-level component data.</p>
                )}

                <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-zinc-200/60 text-[11px]">
                  <span className="text-zinc-600">Baseline Vulnerability Score:</span>
                  <span className="font-mono font-bold text-zinc-900">
                    {vulnerabilityScore != null ? `${vulnerabilityScore} / 100 (${vulnerabilityLevel})` : '--'}
                  </span>
                </div>
                {vulnerabilityProvenance?.status === 'Proxy' ? (
                  <p className="text-[10px] text-zinc-500 italic leading-snug">
                    Population-density proxy from real ward population &amp; area data. No claim about green
                    space, housing quality, or health.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="bg-white p-3 rounded-lg border border-zinc-200/60 text-[11px] text-zinc-500 leading-snug">
                <span className="font-semibold text-zinc-700 block">Vulnerability data unavailable</span>
                No ward-level demographic baseline exists for this city. HeatPulse does not fabricate
                ward differences — vulnerability is omitted until a real source is added.
              </div>
            )}
          </section>

          {/* ============================================================ */}
          {/* SECTION 6: RISK */}
          {/* ============================================================ */}
          <section className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-zinc-700">
                <PieChart className="w-3.5 h-3.5 text-amber-500" />
                <span>Section 6 · Thermal-Vulnerability Composite Risk</span>
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  compositeRiskLevel === 'Severe'
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : compositeRiskLevel === 'High'
                    ? 'bg-orange-100 text-orange-800 border-orange-200'
                    : compositeRiskLevel === 'Moderate'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}
              >
                {compositeRiskLevel} Risk
              </span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between text-zinc-600">
                <span>Atmospheric Thermal Hazard (60% weight, α=0.6)</span>
                <span className="font-mono font-semibold text-zinc-900">
                  {heatIndex != null ? `${Math.round(heatIndex * 0.6)} pts` : '--'}
                </span>
              </div>
              <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-orange-500 h-full rounded-full" style={{ width: '60%' }} />
              </div>

              <div className="flex justify-between text-zinc-600 pt-1">
                <span>Baseline Socio-Ecological Vulnerability (40% weight, β=0.4)</span>
                <span className="font-mono font-semibold text-zinc-900">
                  {componentDataAvailable && vulnerabilityScore != null
                    ? `${Math.round(vulnerabilityScore * 0.4)} pts`
                    : 'unavailable'}
                </span>
              </div>
              <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full" style={{ width: componentDataAvailable ? '40%' : '0%' }} />
              </div>
            </div>

            <div className="p-2 bg-white rounded-lg border border-zinc-200/60 text-[11px] leading-snug text-zinc-600">
              <strong className="text-zinc-800">Primary Ward Driver: </strong>
              {componentDataAvailable && buildingDensity != null && buildingDensity >= 0.8
                ? 'High built-up density and structural thermal mass prolong nocturnal heat accumulation.'
                : componentDataAvailable && greenCover != null && greenCover < 10
                ? 'Critically low vegetative canopy reduces evaporative cooling efficiency during afternoon hours.'
                : vulnerabilityAvailable
                ? 'Composite risk driven primarily by elevated atmospheric heat hazard.'
                : 'Vulnerability data unavailable — composite is driven by atmospheric heat hazard only.'}
            </div>
          </section>

          {/* ============================================================ */}
          {/* SECTION 7: HEALTH BURDEN / RR */}
          {/* ============================================================ */}
          <section className="bg-rose-50/50 border border-rose-200/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-rose-800 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-rose-600" />
                <span>Section 7 · Health Burden (Relative Risk / RR)</span>
              </span>
              <span className="text-[10px] font-semibold text-rose-700 bg-rose-100/70 px-1.5 py-0.5 rounded border border-rose-200">
                Literature Proxy
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-white p-2 rounded-lg border border-rose-200/60">
                <span className="text-[10px] text-zinc-500 block">Relative Risk (RR)</span>
                <span className="text-base font-bold text-rose-700 font-mono">
                  {healthRelativeRisk ? `${healthRelativeRisk.rr}×` : '--'}
                </span>
                <span className="text-[9px] text-zinc-400 block">vs. Baseline (1.00×)</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-rose-200/60">
                <span className="text-[10px] text-zinc-500 block">Excess Risk Load</span>
                <span className="text-base font-bold text-orange-600 font-mono">
                  {healthRelativeRisk ? `+${healthRelativeRisk.excessPct}%` : '--'}
                </span>
                <span className="text-[9px] text-zinc-400 block">Above Baseline</span>
              </div>
            </div>

            <div className="p-2 bg-white/90 rounded-lg border border-rose-200/60 text-[10px] text-zinc-600 leading-snug">
              <strong>Epidemiological Disclosure: </strong>
              Relative-risk estimate derived from biometeorological exposure (excess WBGT &gt; 28°C)
              {componentDataAvailable ? ' and baseline vulnerability' : ' (vulnerability unavailable — omitted from formula)'}.
              Zero synthetic mortality or hospitalization figures. (Health outcome model strictly pending clinical validation).
            </div>
          </section>

          {/* ============================================================ */}
          {/* SECTION 8: RECOMMENDED ACTION */}
          {/* ============================================================ */}
          <section className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-zinc-700">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
                <span>Section 8 · Recommended Action</span>
              </span>
              <span className="text-[10px] font-mono font-medium text-emerald-800 bg-emerald-100/70 px-1.5 py-0.5 rounded border border-emerald-200">
                Action Window: 11:30 – 16:00 IST
              </span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 flex items-start gap-1.5">
                <span className="font-bold text-emerald-700 shrink-0">1.</span>
                <span>
                  <strong>Municipal Hydration & Misting:</strong> Deploy mobile drinking water tankers and shaded hydration kiosks near high-traffic labor corridors.
                </span>
              </div>
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 flex items-start gap-1.5">
                <span className="font-bold text-emerald-700 shrink-0">2.</span>
                <span>
                  <strong>Shift Outdoor Work Hours:</strong> Mandate shaded rest breaks (12:30–16:00 IST) for construction and field personnel.
                </span>
              </div>
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 flex items-start gap-1.5">
                <span className="font-bold text-emerald-700 shrink-0">3.</span>
                <span>
                  <strong>Community Cooling Shelters:</strong> Activate air-cooled community centers and primary health facilities for vulnerable seniors and children.
                </span>
              </div>
            </div>

            {/* Expandable Provenance Accordion */}
            <div className="border border-zinc-200 rounded-lg overflow-hidden mt-2 bg-white">
              <button
                type="button"
                onClick={() => setProvenanceOpen((prev) => !prev)}
                className="w-full px-2.5 py-1.5 bg-zinc-50 hover:bg-zinc-100 flex items-center justify-between text-[11px] font-semibold text-zinc-700 transition-colors"
                aria-expanded={provenanceOpen}
              >
                <div className="flex items-center gap-1.5">
                  <Database className="w-3 h-3 text-zinc-500" />
                  <span>Expandable Provenance & Attribution</span>
                </div>
                {provenanceOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </button>

              {provenanceOpen && (
                <div className="p-2.5 text-[10px] space-y-1.5 border-t border-zinc-200 text-zinc-600 font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">NWP Provider:</span>
                    <span className="text-zinc-800 font-semibold">{metadata?.provider || 'Open-Meteo NWP Grid'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Model Pipeline:</span>
                    <span className="text-zinc-800">{metadata?.model || 'ECMWF IFS / GFS Seamless'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Model Run Cycle:</span>
                    <span className="text-zinc-800">
                      {formatToIST(metadata?.run_time)} ({metadata?.run_time || '00Z/06Z/12Z/18Z'})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Target Valid Window:</span>
                    <span className="text-zinc-800">{formatToIST(metadata?.valid_time)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Sync Status:</span>
                    <span className="text-emerald-700 font-bold uppercase">{metadata?.status || 'fresh'}</span>
                  </div>
                  <div className="pt-1 border-t border-zinc-100 text-[10px] text-zinc-500 italic font-sans">
                    &ldquo;Ward-localized forecast derived from numerical weather prediction&rdquo;
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
