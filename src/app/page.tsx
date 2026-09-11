'use client';

/**
 * HeatPulse — Page 2: City Overview (PRIMARY PRODUCT SCREEN)
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 * Conforms to Requirement R6, R10, R11 & R12
 *
 * Core Layout & Architecture:
 * 1. City Header with active city name, ward count, and forecast freshness banner.
 * 2. Temporal Scope Control Strip (Consumes forecastContext from store: CURRENT vs PEAK).
 * 3. Standardized 3-Block Summary (Strict separation of CURRENT vs FORECAST PEAK):
 *    - Section A: CURRENT CONDITIONS displaying current-hour Air Temp, RH, Wind Speed, WBGT, and Thermal Status.
 *    - Section B: FORECAST PEAK (NEXT 120 HOURS) displaying Peak WBGT, Peak Date, Peak Time, and Count of affected wards.
 *    - Block 3: District Heat Evaluation — HeatPulse local evaluation of IMD criteria (color code, alert level). NOT an official IMD bulletin.
 * 4. OpenLayers MapContainer with primary ISRO NRSC Bhuvan WMS, OSM fallback, and LayerSwitcher.
 * 5. 3 to 5 Day Heat & Thermal Stress Outlook (threshold classification — not heatwave-day detection).
 * 6. Integrated Right-Side Ward Detail Drawer preserving map visibility.
 */

import React, { useEffect, useMemo } from 'react';
import {
  MapPin,
  ShieldAlert,
  CalendarDays,
  Layers,
  Thermometer,
  TrendingUp,
} from 'lucide-react';
import { useHeatPulseStore, heatPulseActions, useActiveCityData } from '@/lib/store';
import { CITIES } from '@/types/gis';
import FreshnessBanner, { formatToIST, formatDateIST } from '@/components/navigation/FreshnessBanner';
import MapContainer from '@/components/map/MapContainer';
import WardDetailDrawer from '@/components/drawer/WardDetailDrawer';
import { evaluateImdDistrictWarning } from '@/lib/imd-service';
import { calculateHeatIndex, calculateWBGT } from '@/lib/thermal-engine';
import {
  THERMAL_STRESS_THRESHOLDS,
  classifyThermalStress,
} from '@/lib/threshold-config';
import {
  resolveCityTemporalMetrics,
  temporalModeLabel as getTemporalModeLabel,
  type TemporalMode,
} from '@/lib/temporal-modes';
import HeatwaveModelStatus from '@/components/HeatwaveModelStatus';

/**
 * Resolves the reference valid-time for PEAK mode from real ward forecasts
 * (first ward's WBGT-peak hour). Returns null when no hourly data exists.
 */
function forecastPeakTimeLabel(
  data: { weatherForecasts?: Record<string, { hourly?: { time?: string[]; temperature_2m?: number[]; relative_humidity_2m?: number[] } }> }
): string | null {
  const first = Object.values(data.weatherForecasts || {})[0];
  const times = first?.hourly?.time;
  const temps = first?.hourly?.temperature_2m;
  const hums = first?.hourly?.relative_humidity_2m;
  if (!times?.length || !temps || !hums) return null;
  let bestIdx = -1;
  let bestWbgt = -Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = temps[i];
    const h = hums[i];
    if (typeof t !== 'number' || typeof h !== 'number') continue;
    const w = calculateWBGT(t, h);
    if (w > bestWbgt) {
      bestWbgt = w;
      bestIdx = i;
    }
  }
  return bestIdx >= 0 ? times[bestIdx] : null;
}

export default function CityOverviewPage() {
  const selectedCity = useHeatPulseStore((s) => s.selectedCity);
  const selectedWard = useHeatPulseStore((s) => s.selectedWard);
  const selectedWardId = useHeatPulseStore((s) => s.selectedWardId);
  const activeLayer = useHeatPulseStore((s) => s.activeLayer);
  const forecastContext = useHeatPulseStore(
    (s) => (s as { forecastContext?: { currentValidTime?: string | null; selectedValidTime?: string | null; forecastRunTime?: string | null; mode?: 'CURRENT' | 'FORECAST' | 'PEAK' } }).forecastContext
  );
  const { data, isLoading, reload } = useActiveCityData();

  const cityMeta = CITIES[selectedCity] || CITIES.bengaluru;

  // Active temporal mode (CURRENT | FORECAST | PEAK) — drives real data below.
  const temporalMode: TemporalMode =
    (forecastContext?.mode as TemporalMode | undefined) || 'CURRENT';
  const activeModeLabel = getTemporalModeLabel(temporalMode);
  const activeModeValidTime =
    temporalMode === 'FORECAST'
      ? forecastContext?.selectedValidTime ?? null
      : temporalMode === 'PEAK'
      ? forecastPeakTimeLabel(data)
      : forecastContext?.currentValidTime ?? null;
  const activeModeValidTimeFormatted = activeModeValidTime
    ? `${formatDateIST(activeModeValidTime)} · ${formatToIST(activeModeValidTime)}`
    : null;

  // Load city data on mount or city switch
  useEffect(() => {
    if (data.status === 'idle') {
      heatPulseActions.loadCityData(selectedCity);
    }
  }, [selectedCity, data.status]);

  const isDataReady = Boolean(
    data.status === 'success' &&
    ((data.wardRisks && data.wardRisks.length > 0) || (data.assessments && data.assessments.length > 0))
  );

  // Mode-resolved per-ward metrics: the temporal mode changes the actual data
  // feeding the map, tooltip, and drawer — not just a card border.
  const temporalMetrics = useMemo(() => {
    if (!data.weatherForecasts || Object.keys(data.weatherForecasts).length === 0) {
      return null;
    }
    const vulnerabilityByWard: Record<string, number> = {};
    (data.wardRisks || []).forEach((w) => {
      if (typeof w.vulnerabilityScore === 'number' && Number.isFinite(w.vulnerabilityScore)) {
        if (w.wardId || w.ward_id) vulnerabilityByWard[w.wardId || w.ward_id || ''] = w.vulnerabilityScore;
        if (w.wardName || w.ward_name) vulnerabilityByWard[w.wardName || w.ward_name || ''] = w.vulnerabilityScore;
      }
    });
    return resolveCityTemporalMetrics({
      forecasts: data.weatherForecasts,
      mode: temporalMode,
      currentValidTime: forecastContext?.currentValidTime ?? null,
      selectedValidTime: forecastContext?.selectedValidTime ?? null,
      vulnerabilityByWard,
    });
  }, [data.weatherForecasts, data.wardRisks, temporalMode, forecastContext?.currentValidTime, forecastContext?.selectedValidTime]);

  // SECTION A: CONDITIONS AT THE ACTIVE TEMPORAL MODE (aggregated city means — ZERO HARDCODED SUMMER FALLBACKS)
  // In CURRENT mode this is the current forecast hour; the mode-resolved
  // temporalMetrics feed the value when FORECAST/PEAK is active so this card
  // never disagrees with the map.
  const currentConditions = useMemo(() => {
    if (!isDataReady) {
      return null;
    }

    // Mode-resolved values take precedence when the active mode is not CURRENT.
    if (temporalMetrics && temporalMode !== 'CURRENT') {
      const all = Object.values(temporalMetrics);
      if (all.length > 0) {
        const temps = all.map((m) => m.temperature).filter((t): t is number => t != null);
        const hums = all.map((m) => m.humidity).filter((h): h is number => h != null);
        const wbgts = all.map((m) => m.wbgt).filter((w): w is number => w != null);
        const airTemp = temps.length ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : null;
        const rh = hums.length ? Math.round(hums.reduce((a, b) => a + b, 0) / hums.length) : null;
        const currentWbgt = wbgts.length ? Math.round((wbgts.reduce((a, b) => a + b, 0) / wbgts.length) * 10) / 10 : null;

        // Classification delegated to threshold-config (single source of truth).
        const stressLevel = currentWbgt != null
          ? classifyThermalStress(undefined, currentWbgt)
          : null;
        let thermalStatus = 'Low Stress';
        let statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (stressLevel === 'Severe') {
          thermalStatus = 'Severe Stress';
          statusBadge = 'bg-red-100 text-red-800 border-red-300';
        } else if (stressLevel === 'High') {
          thermalStatus = 'High Stress';
          statusBadge = 'bg-orange-100 text-orange-800 border-orange-300';
        } else if (stressLevel === 'Moderate') {
          thermalStatus = 'Moderate Stress';
          statusBadge = 'bg-amber-100 text-amber-800 border-amber-300';
        }

        const winds = Object.values(data.weatherForecasts || {})
          .map((f) => (temporalMode === 'PEAK' ? undefined : f.current?.wind_speed_10m))
          .filter((w): w is number => typeof w === 'number' && w >= 0);
        const windSpeed = winds.length ? Math.round((winds.reduce((a, b) => a + b, 0) / winds.length) * 10) / 10 : null;

        return { airTemp, rh, windSpeed, currentWbgt, thermalStatus, statusBadge };
      }
    }

    const legacyWards = data.wardRisks || [];
    const forecastList = Object.values(data.weatherForecasts || {});

    const temps = legacyWards.map((w) => w.currentTemp).filter((t): t is number => typeof t === 'number' && t > 0);
    const hums = legacyWards.map((w) => w.currentHumidity).filter((h): h is number => typeof h === 'number' && h > 0);
    const wbgts = legacyWards.map((w) => w.wbgt).filter((w): w is number => typeof w === 'number' && w > 0);

    let airTemp = temps.length > 0 ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : null;
    let rh = hums.length > 0 ? Math.round(hums.reduce((a, b) => a + b, 0) / hums.length) : null;
    let currentWbgt = wbgts.length > 0 ? Math.round((wbgts.reduce((a, b) => a + b, 0) / wbgts.length) * 10) / 10 : null;

    let windSpeed: number | null = null;
    if (forecastList.length > 0) {
      const winds = forecastList
        .map((f) => f.current?.wind_speed_10m)
        .filter((w): w is number => typeof w === 'number' && w >= 0);
      if (winds.length > 0) {
        windSpeed = Math.round((winds.reduce((a, b) => a + b, 0) / winds.length) * 10) / 10;
      }
    }

    if (airTemp == null && forecastList.length > 0) {
      const fTemps = forecastList.map((f) => f.current?.temperature_2m).filter((t): t is number => typeof t === 'number');
      if (fTemps.length > 0) airTemp = Math.round((fTemps.reduce((a, b) => a + b, 0) / fTemps.length) * 10) / 10;
    }

    if (rh == null && forecastList.length > 0) {
      const fHums = forecastList.map((f) => f.current?.relative_humidity_2m).filter((h): h is number => typeof h === 'number');
      if (fHums.length > 0) rh = Math.round(fHums.reduce((a, b) => a + b, 0) / fHums.length);
    }

    if (currentWbgt == null && airTemp != null && rh != null) {
      currentWbgt = calculateWBGT(airTemp, rh);
    }

    // Classification delegated to threshold-config (single source of truth).
    const stressLevel = currentWbgt != null
      ? classifyThermalStress(undefined, currentWbgt)
      : null;
    let thermalStatus = 'Low Stress';
    let statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';

    if (stressLevel === 'Severe') {
      thermalStatus = 'Severe Stress';
      statusBadge = 'bg-red-100 text-red-800 border-red-300';
    } else if (stressLevel === 'High') {
      thermalStatus = 'High Stress';
      statusBadge = 'bg-orange-100 text-orange-800 border-orange-300';
    } else if (stressLevel === 'Moderate') {
      thermalStatus = 'Moderate Stress';
      statusBadge = 'bg-amber-100 text-amber-800 border-amber-300';
    }

    return {
      airTemp,
      rh,
      windSpeed,
      currentWbgt,
      thermalStatus,
      statusBadge,
    };
  }, [isDataReady, data, temporalMetrics, temporalMode]);
  // SECTION B: FORECAST PEAK (NEXT 120 HOURS — Strict temporal separation from current hour)
  const forecastPeak = useMemo(() => {
    if (!isDataReady) {
      return null;
    }

    const forecastList = Object.values(data.weatherForecasts || {});
    const totalWards = cityMeta.wardCount;

    if (forecastList.length > 0 && forecastList[0].hourly?.time?.length > 0) {
      const times = forecastList[0].hourly.time;
      let globalMaxWbgt = -999;
      let peakHourIdx = 0;

      // Scan through all 120 hours to find peak diurnal thermal burden
      for (let h = 0; h < times.length; h++) {
        let hourMaxWbgt = -999;
        for (const wf of forecastList) {
          const t = wf.hourly.temperature_2m[h];
          const rh = wf.hourly.relative_humidity_2m[h];
          if (t != null && rh != null) {
            const w = calculateWBGT(t, rh);
            if (w > hourMaxWbgt) hourMaxWbgt = w;
          }
        }
        if (hourMaxWbgt > globalMaxWbgt) {
          globalMaxWbgt = hourMaxWbgt;
          peakHourIdx = h;
        }
      }

      const peakIsoTime = times[peakHourIdx];
      const peakDate = formatDateIST(peakIsoTime);
      const peakHourStr = formatToIST(peakIsoTime);

      // Count affected wards at peak hour (WBGT at/above the High band onset)
      let affectedWardsCount = 0;
      for (const wf of forecastList) {
        const t = wf.hourly.temperature_2m[peakHourIdx];
        const rh = wf.hourly.relative_humidity_2m[peakHourIdx];
        if (t != null && rh != null) {
          const w = calculateWBGT(t, rh);
          if (w >= THERMAL_STRESS_THRESHOLDS.highWbgt) affectedWardsCount++;
        }
      }

      let severityBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      let severityLabel = 'Low Load';
      if (globalMaxWbgt >= THERMAL_STRESS_THRESHOLDS.severeWbgt) {
        severityBadge = 'bg-red-100 text-red-800 border-red-300';
        severityLabel = 'Severe Peak';
      } else if (globalMaxWbgt >= THERMAL_STRESS_THRESHOLDS.highWbgt) {
        severityBadge = 'bg-orange-100 text-orange-800 border-orange-300';
        severityLabel = 'High Peak';
      } else if (globalMaxWbgt >= THERMAL_STRESS_THRESHOLDS.moderateWbgt) {
        severityBadge = 'bg-amber-100 text-amber-800 border-amber-300';
        severityLabel = 'Moderate Peak';
      }

      return {
        peakWbgt: Math.round(globalMaxWbgt * 10) / 10,
        peakDate,
        peakTime: peakHourStr,
        affectedCount: affectedWardsCount,
        totalWards,
        severityLabel,
        severityBadge,
      };
    }

    // Fallback using assessments if weatherForecasts hourly not yet available
    const assessments = data.assessments || [];
    if (assessments.length > 0) {
      const wbgts = assessments.map((a) => a.thermal.wbgt).filter((w) => w > 0);
      const peakWbgt = wbgts.length > 0 ? Math.round(Math.max(...wbgts) * 10) / 10 : null;
      const affectedCount = assessments.filter(
        (a) => a.composite_risk_level === 'High' || a.composite_risk_level === 'Severe'
      ).length;

      return {
        peakWbgt,
        peakDate: 'Forward 24–48h',
        peakTime: '14:00 – 16:00 IST',
        affectedCount,
        totalWards,
        severityLabel: peakWbgt && peakWbgt >= THERMAL_STRESS_THRESHOLDS.highWbgt ? 'High Peak' : 'Moderate Peak',
        severityBadge:
          peakWbgt && peakWbgt >= THERMAL_STRESS_THRESHOLDS.highWbgt
            ? 'bg-orange-100 text-orange-800 border-orange-300'
            : 'bg-amber-100 text-amber-800 border-amber-300',
      };
    }

    return null;
  }, [isDataReady, data, cityMeta]);

  // Valid Time Label formatted for Section A
  const currentValidTimeFormatted =
    forecastContext?.currentValidTime ||
    (data.forecastMetadata?.valid_time
      ? formatToIST(data.forecastMetadata.valid_time)
      : formatToIST(new Date().toISOString()));

  // District heat evaluation — HeatPulse applies IMD criteria to local forecast data (not an IMD bulletin)
  const imdWarning = useMemo(() => {
    return (
      data.imdWarning ||
      evaluateImdDistrictWarning(selectedCity, currentConditions?.airTemp ?? undefined)
    );
  }, [data.imdWarning, selectedCity, currentConditions?.airTemp]);

  const portableHeatwaveFeatures = useMemo(() => {
    const forecast = Object.values(data.weatherForecasts || {})[0];
    if (!forecast || forecast.hourly.time.length === 0) return null;
    const temperatures = forecast.hourly.temperature_2m.filter(Number.isFinite);
    const humidities = forecast.hourly.relative_humidity_2m.filter(Number.isFinite);
    if (temperatures.length === 0 || humidities.length === 0) return null;
    const temperature = temperatures[0];
    const humidity = humidities[0];
    const gamma = Math.log(Math.max(1, humidity) / 100) + (17.27 * temperature) / (237.3 + temperature);
    const dewpoint = (237.3 * gamma) / (17.27 - gamma);
    // Optional provider fields pass through as 0 only when genuinely absent —
    // the model schema requires numbers, and 0 is the honest "no radiation /
    // calm wind" value when the provider omitted the field.
    const radiation = forecast.hourly.direct_normal_irradiance?.find(Number.isFinite) ?? 0;
    const windKmh = forecast.hourly.wind_speed_10m?.find(Number.isFinite) ?? 0;
    const firstDate = new Date(forecast.hourly.time[0]);
    return {
      temperature_c: temperature,
      tmax_c: Math.max(...temperatures),
      tmin_c: Math.min(...temperatures),
      dewpoint_c: dewpoint,
      wind_speed: windKmh / 3.6,
      radiation,
      latitude: forecast.centroid[1],
      longitude: forecast.centroid[0],
      month: firstDate.getUTCMonth() + 1,
      day: firstDate.getUTCDate(),
    };
  }, [data.weatherForecasts]);

  // 5-Day Outlook Data Synthesizer from genuine ward forecasts
  const fiveDayOutlook = useMemo(() => {
    if (!isDataReady) return [];

    const forecastList = Object.values(data.weatherForecasts || {});
    if (forecastList.length > 0 && forecastList[0].hourly?.time?.length >= 24) {
      const days = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5'];
      return days.map((dayLabel, idx) => {
        const startH = idx * 24;
        const endH = Math.min((idx + 1) * 24, forecastList[0].hourly.time.length);

        let maxT = -999;
        let minT = 999;
        let maxWbgt = -999;
        let maxHI = -999;

        for (const wf of forecastList) {
          const temps = wf.hourly.temperature_2m.slice(startH, endH);
          const hums = wf.hourly.relative_humidity_2m.slice(startH, endH);
          for (let i = 0; i < temps.length; i++) {
            const t = temps[i];
            const h = hums[i];
            if (t > maxT) maxT = t;
            if (t < minT) minT = t;
            const wb = calculateWBGT(t, h);
            const hi = calculateHeatIndex(t, h);
            if (wb > maxWbgt) maxWbgt = wb;
            if (hi > maxHI) maxHI = hi;
          }
        }

        const tmax = Math.round(maxT * 10) / 10;
        const tmin = Math.round(minT * 10) / 10;
        const wbgt = Math.round(maxWbgt * 10) / 10;
        const heatIndex = Math.round(maxHI * 10) / 10;

        let alertLevel: 'Severe Alert' | 'High Watch' | 'Moderate' | 'Normal' = 'Normal';
        let alertBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (wbgt >= THERMAL_STRESS_THRESHOLDS.severeWbgt || heatIndex >= THERMAL_STRESS_THRESHOLDS.severeHi) {
          alertLevel = 'Severe Alert';
          alertBadge = 'bg-red-100 text-red-800 border-red-300';
        } else if (wbgt >= THERMAL_STRESS_THRESHOLDS.highWbgt || heatIndex >= THERMAL_STRESS_THRESHOLDS.highHi) {
          alertLevel = 'High Watch';
          alertBadge = 'bg-orange-100 text-orange-800 border-orange-300';
        } else if (wbgt >= THERMAL_STRESS_THRESHOLDS.moderateWbgt || heatIndex >= THERMAL_STRESS_THRESHOLDS.moderateHi) {
          alertLevel = 'Moderate';
          alertBadge = 'bg-amber-100 text-amber-800 border-amber-300';
        }

        return {
          day: dayLabel,
          tmax,
          tmin,
          heatIndex,
          wbgt,
          isTropicalNight: tmin >= 25.0,
          risk: wbgt >= THERMAL_STRESS_THRESHOLDS.highWbgt ? 'High' : wbgt >= THERMAL_STRESS_THRESHOLDS.moderateWbgt ? 'Moderate' : 'Low',
          alertLevel,
          alertBadge,
        };
      });
    }

    if (data.wardRisks && data.wardRisks.length > 0) {
      // No genuine hourly NWP data on this path — keep the outlook unavailable
      // rather than inventing a deterministic temperature drift.
      return [];
    }

    return [];
  }, [isDataReady, data.weatherForecasts, data.wardRisks]);

  // Nighttime detection — IST 20:00 to 06:00 (nocturnal window where WBGT remains elevated due to humidity)
  // This determines whether to show the "CURRENT NIGHT CONDITIONS · NEXT DAY PEAK" context banner.
  const isNighttimeIST = useMemo(() => {
    const now = new Date();
    const istHour = parseInt(
      now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }),
      10
    );
    return istHour >= 20 || istHour < 6;
  }, []);


  const imdColorStyles = {
    GREEN: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-900',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
    YELLOW: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-900',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    ORANGE: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-900',
      badge: 'bg-orange-100 text-orange-800 border-orange-300',
    },
    RED: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-900',
      badge: 'bg-red-100 text-red-800 border-red-300',
    },
  };

  const activeImdStyle = imdColorStyles[imdWarning.color_code] || imdColorStyles.GREEN;
  return (
    <div className="flex flex-col min-h-screen bg-zinc-100/70">
      {/* Top City Header Strip */}
      <div className="bg-white border-b border-zinc-200 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-[1600px] mx-auto w-full flex flex-wrap items-center justify-between gap-3">
          {/* City Identifier & Monitored Wards */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 shadow-xs">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-zinc-900 tracking-tight">
                  {cityMeta.name}
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-full">
                  {cityMeta.state}
                </span>
                <span className="text-xs text-zinc-400">·</span>
                <span className="text-xs font-medium text-zinc-600">
                  {cityMeta.wardCount} Administrative Wards
                </span>
              </div>
            </div>
          </div>

          {/* Forecast Freshness Banner */}
          <div className="ml-auto w-full md:w-auto">
            <FreshnessBanner
              metadata={data.forecastMetadata}
              lastUpdatedTime={data.lastFetched}
              onRefresh={reload}
              isRefreshing={isLoading}
              compact={false}
            />
          </div>
        </div>
      </div>

      {/* Main Operational Container */}
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-8 py-5 space-y-5 flex-1 flex flex-col">
        {/* Temporal Scope Control Strip (Consumes forecastContext from store) */}
        <div className="flex flex-wrap items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-zinc-200 shadow-2xs text-xs gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Temporal Scope:
            </span>
            <div className="inline-flex rounded-lg p-0.5 bg-zinc-100 border border-zinc-200">
              <button
                type="button"
                onClick={() => heatPulseActions.setForecastMode('CURRENT')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  temporalMode === 'CURRENT'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                ● Current
              </button>
              <button
                type="button"
                onClick={() => heatPulseActions.setForecastMode('FORECAST')}
                disabled={!forecastContext?.selectedValidTime}
                title={
                  forecastContext?.selectedValidTime
                    ? 'Inspect the forecast hour selected on /forecast'
                    : 'Select a forecast hour on the Forecast page first'
                }
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  temporalMode === 'FORECAST'
                    ? 'bg-white text-indigo-800 shadow-xs'
                    : forecastContext?.selectedValidTime
                    ? 'text-zinc-600 hover:text-zinc-900'
                    : 'text-zinc-300 cursor-not-allowed'
                }`}
              >
                ◷ Selected Forecast
              </button>
              <button
                type="button"
                onClick={() => heatPulseActions.setForecastMode('PEAK')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  temporalMode === 'PEAK'
                    ? 'bg-white text-red-700 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                ▲ Peak
              </button>
            </div>
            {activeModeValidTimeFormatted && (
              <span className="text-[10px] font-mono text-zinc-600 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded">
                {activeModeLabel}: {activeModeValidTimeFormatted}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-[11px] text-zinc-500">
            <span>
              Current Valid Time: <strong className="text-zinc-800 font-mono">{currentValidTimeFormatted}</strong>
            </span>
            {forecastContext?.forecastRunTime && (
              <span className="hidden sm:inline border-l border-zinc-200 pl-3">
                Run: <strong className="text-zinc-700 font-mono">{formatToIST(forecastContext.forecastRunTime)}</strong>
              </span>
            )}
          </div>
        </div>


        {/* ============================================================ */}
        {/* NIGHTTIME CONTEXT BANNER (Visible 20:00–06:00 IST only)      */}
        {/* Shows current NIGHT conditions + next-day forecast peak ref   */}
        {/* ============================================================ */}
        {isNighttimeIST && currentConditions && (
          <div className="flex flex-wrap items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 gap-3" role="status" aria-label="Nighttime thermal context">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🌙</span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                  CURRENT NIGHT CONDITIONS (IST 20:00–06:00)
                </span>
                <span className="text-sm font-bold text-indigo-950">
                  WBGT&nbsp;
                  <span className="font-mono">{currentConditions.currentWbgt != null ? `${currentConditions.currentWbgt}°C` : '--'}</span>
                  &nbsp;·&nbsp;
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${currentConditions.statusBadge}`}>
                    {currentConditions.thermalStatus}
                  </span>
                </span>
              </div>
            </div>
            {forecastPeak && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider">Next-Day Peak →</span>
                <span className="text-sm font-bold text-indigo-900 font-mono">
                  {forecastPeak.peakWbgt != null ? `${forecastPeak.peakWbgt}°C WBGT` : '--'}
                </span>
                <span className="text-[10px] text-indigo-600">
                  {forecastPeak.peakDate} · {forecastPeak.peakTime}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${forecastPeak.severityBadge}`}>
                  {forecastPeak.severityLabel}
                </span>
              </div>
            )}
            <span className="text-[10px] text-indigo-400 italic shrink-0">Ward-centroid NWP forecast — not a physical sensor reading</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* 3-BLOCK SUMMARY: Strict separation of CURRENT vs FORECAST PEAK */}
        {/* ============================================================ */}
        <section
          aria-label="Thermal Decision Support 3-Block Summary"
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {/* SECTION A: CURRENT CONDITIONS */}
          <div
            className={`bg-white rounded-2xl p-4 border shadow-xs flex flex-col justify-between relative overflow-hidden transition-all ${
              temporalMode === 'CURRENT'
                ? 'border-orange-300 ring-2 ring-orange-400/20'
                : temporalMode === 'FORECAST'
                ? 'border-indigo-300 ring-2 ring-indigo-400/20'
                : 'border-red-300 ring-2 ring-red-400/20'
            }`}
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-amber-500" />
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                    CONDITIONS ({activeModeLabel})
                  </span>
                </div>
                {currentConditions ? (
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${currentConditions.statusBadge}`}
                  >
                    {currentConditions.thermalStatus}
                  </span>
                ) : (
                  <span className="h-5 w-20 bg-zinc-100 rounded-full animate-pulse" />
                )}
              </div>

              {currentConditions ? (
                <>
                  <div className="mt-3 flex items-baseline gap-2">
                    <div className="text-3xl font-extrabold text-zinc-900 tracking-tight font-mono">
                      {currentConditions.airTemp != null ? `${currentConditions.airTemp}°C` : '--'}
                    </div>
                    <span className="text-xs text-zinc-500 font-medium">City Mean Air Temp (2m)</span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-zinc-50 rounded-xl p-2 border border-zinc-100">
                      <span className="text-[10px] text-zinc-500 block">Current WBGT</span>
                      <span className="text-sm font-bold text-zinc-900 font-mono">
                        {currentConditions.currentWbgt != null ? `${currentConditions.currentWbgt}°C` : '--'}
                      </span>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-2 border border-zinc-100">
                      <span className="text-[10px] text-zinc-500 block">Relative Humidity</span>
                      <span className="text-sm font-bold text-zinc-900 font-mono">
                        {currentConditions.rh != null ? `${currentConditions.rh}%` : '--'}
                      </span>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-2 border border-zinc-100">
                      <span className="text-[10px] text-zinc-500 block">Wind Speed</span>
                      <span className="text-sm font-bold text-zinc-900 font-mono">
                        {currentConditions.windSpeed != null ? `${currentConditions.windSpeed} km/h` : '--'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-600 mt-2.5 leading-relaxed">
                    NWP forecast-derived atmospheric state at ward centroids for the current observation hour.
                  </p>
                </>
              ) : (
                <div className="space-y-3 mt-3 animate-pulse">
                  <div className="h-9 w-28 bg-zinc-100 rounded-lg" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-12 bg-zinc-100 rounded-xl" />
                    <div className="h-12 bg-zinc-100 rounded-xl" />
                    <div className="h-12 bg-zinc-100 rounded-xl" />
                  </div>
                  <div className="h-8 bg-zinc-50 rounded-lg" />
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
              <span>
                Temporal Scope: {activeModeLabel === 'CURRENT' ? 'Current Hour' : activeModeLabel === 'FORECAST' ? 'Selected Forecast Hour' : 'Max over forecast window'}
              </span>
              <span className="font-mono text-zinc-700">
                Valid: {activeModeValidTimeFormatted || currentValidTimeFormatted}
              </span>
            </div>
          </div>

          {/* SECTION B: FORECAST PEAK (NEXT 120 HOURS) */}
          <div
            className={`bg-white rounded-2xl p-4 border shadow-xs flex flex-col justify-between relative overflow-hidden transition-all ${
              temporalMode === 'PEAK'
                ? 'border-red-400 ring-2 ring-red-400/20'
                : 'border-zinc-200/90'
            }`}
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-600" />
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                    FORECAST PEAK (NEXT 120 HOURS)
                  </span>
                </div>
                {forecastPeak ? (
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${forecastPeak.severityBadge}`}
                  >
                    {forecastPeak.severityLabel}
                  </span>
                ) : (
                  <span className="h-5 w-20 bg-zinc-100 rounded-full animate-pulse" />
                )}
              </div>

              {forecastPeak ? (
                <>
                  <div className="mt-3 flex items-baseline gap-2">
                    <div className="text-3xl font-extrabold text-red-600 tracking-tight font-mono">
                      {forecastPeak.peakWbgt != null ? `${forecastPeak.peakWbgt}°C` : '--'}
                    </div>
                    <span className="text-xs text-zinc-500 font-medium">Projected Peak WBGT</span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-zinc-50 rounded-xl p-2 border border-zinc-100">
                      <span className="text-[10px] text-zinc-500 block">Peak Date</span>
                      <span className="text-xs font-bold text-zinc-900 font-mono">
                        {forecastPeak.peakDate}
                      </span>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-2 border border-zinc-100">
                      <span className="text-[10px] text-zinc-500 block">Peak Time</span>
                      <span className="text-xs font-bold text-zinc-900 font-mono">
                        {forecastPeak.peakTime}
                      </span>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-2 border border-zinc-100">
                      <span className="text-[10px] text-zinc-500 block">Affected Wards</span>
                      <span className="text-xs font-bold text-red-600 font-mono">
                        {forecastPeak.affectedCount} / {forecastPeak.totalWards}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-600 mt-2.5 leading-relaxed">
                    Maximum biometeorological stress projected across the 120-hour numerical weather forecast horizon.
                  </p>
                </>
              ) : (
                <div className="space-y-3 mt-3 animate-pulse">
                  <div className="h-9 w-28 bg-zinc-100 rounded-lg" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-12 bg-zinc-100 rounded-xl" />
                    <div className="h-12 bg-zinc-100 rounded-xl" />
                    <div className="h-12 bg-zinc-100 rounded-xl" />
                  </div>
                  <div className="h-8 bg-zinc-50 rounded-lg" />
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Aggregation: MAX_OVER_NEXT_120H</span>
              <span className="font-semibold text-red-600">
                {forecastPeak ? `${forecastPeak.affectedCount} High/Severe Wards` : 'Calculating...'}
              </span>
            </div>
          </div>

          {/* BLOCK 3: DISTRICT HEAT EVALUATION (HeatPulse-applied IMD criteria — NOT an official IMD/MoES bulletin) */}
          <div
            className={`rounded-2xl p-4 border shadow-xs flex flex-col justify-between relative overflow-hidden ${activeImdStyle.bg} ${activeImdStyle.border}`}
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-zinc-700 to-zinc-900" />
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-zinc-800" />
                  <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                    3. District Heat Evaluation
                  </span>
                </div>
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${activeImdStyle.badge}`}
                >
                  {imdWarning.has_forecast_input
                    ? `${imdWarning.color_code} · ${imdWarning.action_level}`
                    : 'Assessment Unavailable'}
                </span>
              </div>

              <div className="mt-3">
                <div className="text-base font-bold text-zinc-900 leading-snug">
                  {imdWarning.headline}
                </div>
                <p className="text-xs text-zinc-700 mt-1.5 leading-relaxed">
                  {imdWarning.warning_description}
                </p>
                {!imdWarning.has_forecast_input && (
                  <p className="text-[10px] text-zinc-500 mt-1.5 italic">
                    No forecast temperature input available — criteria not evaluated.
                  </p>
                )}
              </div>

              <div className="mt-2 text-[10px] text-zinc-600 bg-white/70 rounded-lg p-2 border border-zinc-200/60 leading-tight">
                <strong>Criteria: </strong> {imdWarning.criteria_citation}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-zinc-300/60 flex items-center justify-between text-[10px] text-zinc-500">
              <span className="italic">HeatPulse criteria-based evaluation — not an official IMD bulletin</span>
              <span className="font-medium text-zinc-700">See IMD / MoES channels for official warnings</span>
            </div>
          </div>
        </section>
        <HeatwaveModelStatus features={portableHeatwaveFeatures} />

        {/* ============================================================ */}
        {/* SPATIAL MAP CONTAINER: ISRO Bhuvan WMS + OSM Fallback */}
        {/* ============================================================ */}
        <section
          aria-label="Spatial Ward Choropleth Map"
          className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs flex flex-col flex-1 min-h-[620px]"
        >
          {/* Map Header Controls */}
          <div className="px-4 py-3 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-600" />
              <h2 className="text-sm font-bold text-zinc-900">
                Spatial Thermal Choropleth · {cityMeta.name} ({cityMeta.wardCount} Wards)
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>Click any ward polygon to open the 8-section intelligence drawer</span>
            </div>
          </div>

          {/* Interactive OpenLayers Map */}
          <div className="relative flex-1 w-full min-h-[560px]">
            <MapContainer
              adminWardsGeoJSON={data.geoJson || undefined}
              wardRisks={data.wardRisks}
              temporalMetrics={temporalMetrics ?? undefined}
              temporalModeLabel={activeModeLabel}
              selectedWard={selectedWard}
              selectedWardId={selectedWardId}
              selectedCity={selectedCity}
              activeLayer={activeLayer}
              onWardSelect={(name) => heatPulseActions.openWardDrawer(name || '')}
              onSelectWard={(id) => heatPulseActions.openWardDrawer(id || '')}
              onCitySelect={(cityId) => {
                heatPulseActions.setSelectedCity(cityId);
                heatPulseActions.loadCityData(cityId);
              }}
              onLayerChange={(layer) => heatPulseActions.setActiveLayer(layer)}
              className="w-full h-full"
            />
          </div>
        </section>

        {/* ============================================================ */}
        {/* 3 TO 5 DAY HEAT & THERMAL STRESS OUTLOOK (threshold classification, not heatwave-day detection) */}
        {/* ============================================================ */}
        <section
          aria-label="3 to 5 Day Heat and Thermal Stress Outlook"
          className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-orange-600" />
              <h2 className="text-sm font-bold text-zinc-900">
                3 to 5 Day Heat &amp; Thermal Stress Outlook ({cityMeta.name})
              </h2>
            </div>
            <span className="text-xs text-zinc-500">
              Ward-localized 120h NWP grid forecast & biometeorological alert trajectory
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-1">
            {!isDataReady || fiveDayOutlook.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 h-36 flex flex-col justify-between animate-pulse"
                >
                  <div className="space-y-2">
                    <div className="h-3 w-16 bg-zinc-200 rounded" />
                    <div className="h-7 w-20 bg-zinc-200 rounded mt-2" />
                    <div className="h-4 w-14 bg-zinc-200 rounded-full mt-2" />
                  </div>
                  <div className="h-3 w-full bg-zinc-200 rounded" />
                </div>
              ))
            ) : (
              fiveDayOutlook.map((day, idx) => (
                <div
                  key={day.day}
                  className={`rounded-xl border p-3 text-center transition-all flex flex-col justify-between ${
                    idx === 0
                      ? 'bg-orange-50/60 border-orange-200 ring-1 ring-orange-500/20'
                      : 'bg-zinc-50 border-zinc-200/80 hover:bg-zinc-100/70'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 font-semibold mb-1">
                      <span>{day.day}</span>
                      {idx === 0 && (
                        <span className="text-[9px] font-bold bg-orange-600 text-white px-1.5 py-0.2 rounded">
                          TODAY
                        </span>
                      )}
                    </div>

                    <div className="text-2xl font-extrabold text-zinc-900 mt-2">
                      {day.tmax}°
                      <span className="text-xs font-normal text-zinc-400 ml-1">/ {day.tmin}°C</span>
                    </div>

                    <div className="mt-2">
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${day.alertBadge}`}
                      >
                        {day.alertLevel}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-zinc-200/60 space-y-1 text-[11px]">
                    <div className="flex justify-between text-zinc-600">
                      <span>Peak WBGT:</span>
                      <span className="font-semibold text-red-600">{day.wbgt}°C</span>
                    </div>
                    <div className="flex justify-between text-zinc-600">
                      <span>Heat Index:</span>
                      <span className="font-semibold text-orange-600">{day.heatIndex}°C</span>
                    </div>
                    {day.isTropicalNight && (
                      <div className="mt-1 text-[9px] font-semibold text-amber-800 bg-amber-100/70 px-1 py-0.5 rounded text-center">
                        Tropical Night (≥25°C)
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Mandatory Right-Side 8-Section Ward Detail Drawer */}
      <WardDetailDrawer />
    </div>
  );
}
