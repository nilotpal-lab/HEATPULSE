/**
 * HeatPulse — Temporal Mode Resolution (CURRENT / SELECTED_FORECAST / FORECAST_PEAK)
 * SIH26083 MoES / NCMRWF
 *
 * The application supports three REAL temporal data modes:
 *
 *   CURRENT          — values at the current valid forecast hour
 *   FORECAST         — values at a user-selected forecast hour (selectedValidTime)
 *   PEAK             — per-ward maximum across the full available forecast window
 *
 * The mode changes the underlying numbers (temperature, RH, WBGT, HI,
 * classifications, composite risk) — it is not a visual highlight. Map, cards,
 * drawer, tooltips, and RR all consume mode-resolved values so a single
 * classification concept cannot disagree across surfaces.
 *
 * All classification math delegates to threshold-config / thermal-engine
 * (single sources of truth). Nothing here invents values: a ward without
 * hourly forecast data resolves to null metrics and renders "unavailable".
 */

import type { ForecastRunMetadata, WardWeatherForecast } from '@/types/weather';
import {
  calculateHeatIndex,
  calculateWBGT,
  wbgtEnvFromHourly,
  type WbgtEnv,
} from '@/lib/thermal-engine';
import {
  classifyHeatCondition,
  classifyThermalStress,
  calculateThermalScore,
  calculateCompositeRiskScore,
  compositeLevelToLegacyRisk,
  classifyCompositeRiskLevel,
} from '@/lib/threshold-config';

export type TemporalMode = 'CURRENT' | 'FORECAST' | 'PEAK';

/** Metrics resolved for one ward at one temporal mode. */
export interface TemporalWardMetrics {
  wardId: string;
  wardName: string;
  /** ISO time the values are valid at (peak time for PEAK mode). */
  validTime: string | null;
  temperature: number | null;
  humidity: number | null;
  heatIndex: number | null;
  wbgt: number | null;
  heatCondition: 'Normal' | 'Elevated' | 'High' | 'Extreme' | null;
  thermalStress: 'Low' | 'Moderate' | 'High' | 'Severe' | null;
  /** Composite risk using the ward's real vulnerability score (may be null). */
  compositeRisk: number | null;
  compositeRiskLevel: string | null;
  /** Vulnerability score carried through from the risk pipeline (may be null). */
  vulnerabilityScore: number | null;
}

interface HourSlot {
  temp: number;
  rh: number;
  apparent: number | null;
  time: string;
}

/** Finds the index of the current valid hour inside the ward's hourly arrays. */
function currentHourIndex(times: string[], currentValidTime: string | null): number {
  if (!times.length) return -1;
  if (currentValidTime) {
    const prefix = currentValidTime.slice(0, 13);
    const exact = times.findIndex((t) => t === currentValidTime);
    if (exact !== -1) return exact;
    const byPrefix = times.findIndex((t) => t.startsWith(prefix));
    if (byPrefix !== -1) return byPrefix;
  }
  return 0;
}

function readSlot(
  forecast: WardWeatherForecast,
  idx: number
): HourSlot | null {
  const t = forecast.hourly.temperature_2m?.[idx];
  const rh = forecast.hourly.relative_humidity_2m?.[idx];
  if (typeof t !== 'number' || !Number.isFinite(t) ||
      typeof rh !== 'number' || !Number.isFinite(rh)) {
    return null;
  }
  const apparent = forecast.hourly.apparent_temperature?.[idx];
  return {
    temp: t,
    rh,
    apparent: typeof apparent === 'number' && Number.isFinite(apparent) ? apparent : null,
    time: forecast.hourly.time[idx],
  };
}

function metricsFromSlot(
  forecast: WardWeatherForecast,
  slot: HourSlot,
  vulnerabilityScore: number | null,
  env?: WbgtEnv
): TemporalWardMetrics {
  const hi = calculateHeatIndex(slot.temp, slot.rh);
  const wbgt = calculateWBGT(slot.temp, slot.rh, env);
  const compositeRisk =
    vulnerabilityScore != null
      ? calculateCompositeRiskScore(calculateThermalScore(hi), vulnerabilityScore)
      : null;
  const compositeLevel = compositeRisk != null ? compositeLevelToLegacyRisk(classifyCompositeRiskLevel(compositeRisk)) : null;

  return {
    wardId: forecast.ward_id,
    wardName: forecast.ward_name,
    validTime: slot.time ?? null,
    temperature: slot.temp,
    humidity: slot.rh,
    heatIndex: hi,
    wbgt,
    heatCondition: classifyHeatCondition(slot.temp),
    thermalStress: classifyThermalStress(hi, wbgt),
    compositeRisk,
    compositeRiskLevel: compositeLevel,
    vulnerabilityScore,
  };
}

/**
 * Resolves a single ward's metrics for the active temporal mode.
 * Returns null when no genuine hourly data exists for the ward — callers
 * render "unavailable" rather than substituting values.
 */
export function resolveWardTemporalMetrics(params: {
  forecast: WardWeatherForecast | null | undefined;
  mode: TemporalMode;
  currentValidTime: string | null;
  selectedValidTime: string | null;
  vulnerabilityScore?: number | null;
}): TemporalWardMetrics | null {
  const { forecast, mode, currentValidTime, selectedValidTime } = params;
  if (!forecast || !forecast.hourly?.time?.length) return null;

  const times = forecast.hourly.time;
  const vulnerability = params.vulnerabilityScore ?? null;

  if (mode === 'PEAK') {
    let best: HourSlot | null = null;
    let bestIdx = -1;
    let bestWbgt = -Infinity;
    for (let i = 0; i < times.length; i++) {
      const slot = readSlot(forecast, i);
      if (!slot) continue;
      const w = calculateWBGT(slot.temp, slot.rh, wbgtEnvFromHourly(forecast.centroid, forecast.hourly, i));
      if (w > bestWbgt) {
        bestWbgt = w;
        best = slot;
        bestIdx = i;
      }
    }
    return best
      ? metricsFromSlot(forecast, best, vulnerability, wbgtEnvFromHourly(forecast.centroid, forecast.hourly, bestIdx))
      : null;
  }

  let idx: number;
  if (mode === 'FORECAST' && selectedValidTime) {
    const prefix = selectedValidTime.slice(0, 13);
    idx = times.findIndex((t: string) => t === selectedValidTime || t.startsWith(prefix));
    if (idx === -1) return null; // selected hour not in this ward's window
  } else {
    idx = currentHourIndex(times, currentValidTime);
  }
  if (idx === -1) return null;

  const slot = readSlot(forecast, idx);
  return slot
    ? metricsFromSlot(forecast, slot, vulnerability, wbgtEnvFromHourly(forecast.centroid, forecast.hourly, idx))
    : null;
}

/**
 * Resolves temporal metrics for every ward in the city forecast map.
 * Keyed the same way MapContainer looks up ward risk: lowercase id and name
 * variants for robust GeoJSON matching.
 */
export function resolveCityTemporalMetrics(params: {
  forecasts: Record<string, WardWeatherForecast>;
  mode: TemporalMode;
  currentValidTime: string | null;
  selectedValidTime: string | null;
  /** ward key → vulnerability score from the risk pipeline (optional). */
  vulnerabilityByWard?: Record<string, number>;
}): Record<string, TemporalWardMetrics> {
  const out: Record<string, TemporalWardMetrics> = {};
  for (const forecast of Object.values(params.forecasts || {})) {
    const vuln = params.vulnerabilityByWard?.[forecast.ward_id];
    const resolved = resolveWardTemporalMetrics({
      forecast,
      mode: params.mode,
      currentValidTime: params.currentValidTime,
      selectedValidTime: params.selectedValidTime,
      vulnerabilityScore: typeof vuln === 'number' && Number.isFinite(vuln) ? vuln : null,
    });
    if (!resolved) continue;
    if (forecast.ward_id) out[forecast.ward_id] = resolved;
    if (forecast.ward_name) out[forecast.ward_name] = resolved;
  }
  return out;
}

/** Human label describing what a mode's values mean. */
export function temporalModeLabel(mode: TemporalMode): string {
  switch (mode) {
    case 'FORECAST':
      return 'SELECTED FORECAST';
    case 'PEAK':
      return 'FORECAST PEAK';
    default:
      return 'CURRENT';
  }
}

/** Valid-time label for the active mode (null when not yet known). */
export function temporalModeValidTime(params: {
  mode: TemporalMode;
  currentValidTime: string | null;
  selectedValidTime: string | null;
  forecasts: Record<string, WardWeatherForecast>;
}): string | null {
  const { mode, currentValidTime, selectedValidTime, forecasts } = params;
  if (mode === 'FORECAST') return selectedValidTime;
  if (mode === 'CURRENT') return currentValidTime;
  // PEAK — the earliest ward's peak time is used as the window reference;
  // per-ward exact peak times are shown individually (drawer/tooltip).
  const first = Object.values(forecasts || {})[0];
  if (!first?.hourly?.time?.length) return null;
  const resolved = resolveWardTemporalMetrics({
    forecast: first,
    mode: 'PEAK',
    currentValidTime,
    selectedValidTime,
  });
  return resolved?.validTime ?? null;
}

/** Peak aggregation window descriptor for labeling (uses real metadata). */
export function peakWindowLabel(metadata: ForecastRunMetadata | null | undefined): string {
  if (!metadata) return 'forecast window';
  return '120-hour forecast window';
}
