/**
 * HeatPulse — 120-Hour Per-Ward Risk-Spike Window
 * SIH26083 MoES / NCMRWF
 *
 * Answers the early-warning question the problem statement demands —
 * "what will the weather DO over the next 3-5 days" — without inventing a
 * single health outcome:
 *
 *   - Walks every ward's genuine 120-hour NWP arrays (temperature, humidity,
 *     apparent temperature, wind, solar irradiance, pressure).
 *   - Recomputes Heat Index (Rothfusz) + WBGT per hour. WBGT uses the full
 *     Liljegren physics when wind + solar are present and reports its method
 *     per hour; otherwise the transparent BoM simplified fallback.
 *   - Converts to thermal score -> composite risk with the ward's real
 *     vulnerability score (0.6/0.4 weights, single source of truth).
 *   - Groups hours by IST calendar day and reports per-day peaks plus the
 *     ward's worst day and the lead time (hours from the current valid hour)
 *     to the first warning-level exceedance.
 *
 * Explicitly NOT a mortality / hospitalization model: outputs are
 * biometeorological risk trajectories only. Zero death or casualty figures
 * anywhere in this module (Tier-2 CHECKs 3/4/14).
 */

import type { WardWeatherForecast } from '@/types/weather';
import {
  calculateHeatIndex,
  calculateWBGTDetailed,
  classifyThermalStress,
  wbgtEnvFromHourly,
} from '@/lib/thermal-engine';
import {
  ALERT_THRESHOLDS,
  calculateCompositeRiskScore,
  calculateThermalScore,
  classifyCompositeRiskLevel,
} from '@/lib/threshold-config';
import { classifyAdvisoryGrade, type AdvisoryGrade } from '@/lib/advisory-engine';
import { getWardVulnerability } from '@/lib/risk-engine';

export interface SpikeDay {
  date: string; // IST calendar date YYYY-MM-DD
  hours: number; // forecast hours covering this date
  max_heat_index: number | null;
  max_wbgt: number | null;
  max_composite_risk: number | null;
  worst_grade: AdvisoryGrade;
  warning_hours: number; // hours at warning level or worse
  critical_hours: number; // hours at critical level
  liljegren_hours: number; // hours computed with full physics
}

export interface WardSpikeWindow {
  ward_id: string;
  ward_name: string;
  city_id: string;
  vulnerability_score: number | null; // null when ward vulnerability unavailable
  vulnerability_available: boolean;
  peak_day: string | null; // date with highest composite risk
  peak_composite_risk: number | null;
  worst_grade: AdvisoryGrade;
  first_warning_lead_hours: number | null; // hours from current valid hour
  first_critical_lead_hours: number | null;
  wbgt_method_mix: { 'liljegren-full': number; 'bom-simplified': number };
  daily: SpikeDay[];
}

const GRADE_RANK: Record<AdvisoryGrade, number> = { green: 0, yellow: 1, orange: 2, red: 3 };

function isWarningHour(hi: number, wbgt: number): boolean {
  return hi >= ALERT_THRESHOLDS.warningHi || wbgt >= ALERT_THRESHOLDS.warningWbgt;
}

function isCriticalHour(hi: number, wbgt: number): boolean {
  return hi >= ALERT_THRESHOLDS.criticalHi || wbgt >= ALERT_THRESHOLDS.criticalWbgt;
}

/**
 * Resolves the index of the current valid hour inside a ward's hourly
 * arrays (same prefix rule as the weather pipeline).
 */
function currentHourIndex(times: string[], validTime: string | null): number {
  if (!times.length) return 0;
  if (validTime) {
    const exact = times.findIndex((t) => t === validTime);
    if (exact !== -1) return exact;
    const prefix = validTime.slice(0, 13);
    const byPrefix = times.findIndex((t) => t.startsWith(prefix));
    if (byPrefix !== -1) return byPrefix;
  }
  return 0;
}

export function buildWardSpikeWindow(
  forecast: WardWeatherForecast,
  currentValidTime: string | null
): WardSpikeWindow | null {
  const hourly = forecast.hourly;
  const times = hourly?.time ?? [];
  if (!times.length) return null;

  const vulnerability = getWardVulnerability(forecast.city_id, forecast.ward_name);
  const vulnAvailable = vulnerability.provenance?.status !== 'Unavailable';
  const vulnScore = vulnAvailable ? vulnerability.score : null;

  const startIdx = currentValidTime ? currentHourIndex(times, currentValidTime) : 0;
  const dayMap = new Map<string, SpikeDay>();
  let firstWarning: number | null = null;
  let firstCritical: number | null = null;
  let worstGrade: AdvisoryGrade = 'green';
  let peakDay: string | null = null;
  let peakComposite: number | null = null;
  const methodMix = { 'liljegren-full': 0, 'bom-simplified': 0 };

  for (let i = startIdx; i < times.length; i++) {
    const t = hourly.temperature_2m?.[i];
    const rh = hourly.relative_humidity_2m?.[i];
    const apparent = hourly.apparent_temperature?.[i];
    if (
      typeof t !== 'number' || !Number.isFinite(t) ||
      typeof rh !== 'number' || !Number.isFinite(rh) ||
      typeof apparent !== 'number' || !Number.isFinite(apparent)
    ) {
      continue;
    }
    const env = wbgtEnvFromHourly(forecast.centroid, hourly, i);
    const hi = calculateHeatIndex(t, rh);
    const wbgtDetailed = calculateWBGTDetailed(t, rh, env);
    const wbgt = wbgtDetailed.value;
    methodMix[wbgtDetailed.method] += 1;

    const thermalScore = calculateThermalScore(hi);
    const composite =
      vulnScore !== null ? calculateCompositeRiskScore(thermalScore, vulnScore) : null;
    const stress = classifyThermalStress(hi, wbgt);
    const grade = classifyAdvisoryGrade(
      hi,
      wbgt,
      composite ?? thermalScore,
      stress,
      vulnerability.level
    );
    if (GRADE_RANK[grade] > GRADE_RANK[worstGrade]) worstGrade = grade;

    const leadHours = i - startIdx;
    if (isCriticalHour(hi, wbgt)) {
      if (firstCritical === null) firstCritical = leadHours;
      if (firstWarning === null) firstWarning = leadHours;
    } else if (isWarningHour(hi, wbgt)) {
      if (firstWarning === null) firstWarning = leadHours;
    }

    const date = times[i].slice(0, 10);
    let day = dayMap.get(date);
    if (!day) {
      day = {
        date,
        hours: 0,
        max_heat_index: null,
        max_wbgt: null,
        max_composite_risk: null,
        worst_grade: 'green',
        warning_hours: 0,
        critical_hours: 0,
        liljegren_hours: 0,
      };
      dayMap.set(date, day);
    }
    day.hours += 1;
    if (wbgtDetailed.method === 'liljegren-full') day.liljegren_hours += 1;
    if (day.max_heat_index === null || hi > day.max_heat_index) day.max_heat_index = hi;
    if (day.max_wbgt === null || wbgt > day.max_wbgt) day.max_wbgt = wbgt;
    if (composite !== null && (day.max_composite_risk === null || composite > day.max_composite_risk)) {
      day.max_composite_risk = composite;
    }
    if (GRADE_RANK[grade] > GRADE_RANK[day.worst_grade]) day.worst_grade = grade;
    if (isCriticalHour(hi, wbgt)) day.critical_hours += 1;
    else if (isWarningHour(hi, wbgt)) day.warning_hours += 1;

    if (composite !== null && (peakComposite === null || composite > peakComposite)) {
      peakComposite = composite;
      peakDay = date;
    }
  }

  if (dayMap.size === 0) return null;

  return {
    ward_id: forecast.ward_id,
    ward_name: forecast.ward_name,
    city_id: forecast.city_id,
    vulnerability_score: vulnScore,
    vulnerability_available: vulnAvailable,
    peak_day: peakDay,
    peak_composite_risk: peakComposite,
    worst_grade: worstGrade,
    first_warning_lead_hours: firstWarning,
    first_critical_lead_hours: firstCritical,
    wbgt_method_mix: methodMix,
    daily: [...dayMap.values()],
  };
}

/** Builds spike windows for every ward in a city forecast run. */
export function buildCitySpikeWindows(
  wards: Record<string, WardWeatherForecast>,
  currentValidTime: string | null
): WardSpikeWindow[] {
  const out: WardSpikeWindow[] = [];
  for (const forecast of Object.values(wards || {})) {
    const window = buildWardSpikeWindow(forecast, currentValidTime);
    if (window) out.push(window);
  }
  // Worst peak composite first; wards without composite sink to the end.
  out.sort((a, b) => (b.peak_composite_risk ?? -1) - (a.peak_composite_risk ?? -1));
  return out;
}

/** City-level roll-up: which day hits the most wards, earliest lead times. */
export function summarizeSpikeWindows(windows: WardSpikeWindow[]): {
  wards_with_warning: number;
  wards_with_critical: number;
  city_peak_day: string | null;
  earliest_warning_lead_hours: number | null;
  earliest_critical_lead_hours: number | null;
  composite_levels: Record<string, number>;
} {
  const perDayWarnings = new Map<string, number>();
  let warnings = 0;
  let criticals = 0;
  let earliestWarning: number | null = null;
  let earliestCritical: number | null = null;
  const levels: Record<string, number> = {};
  for (const w of windows) {
    if (w.first_warning_lead_hours !== null) {
      warnings += 1;
      if (earliestWarning === null || w.first_warning_lead_hours < earliestWarning) {
        earliestWarning = w.first_warning_lead_hours;
      }
    }
    if (w.first_critical_lead_hours !== null) {
      criticals += 1;
      if (earliestCritical === null || w.first_critical_lead_hours < earliestCritical) {
        earliestCritical = w.first_critical_lead_hours;
      }
    }
    for (const d of w.daily) {
      if (d.warning_hours > 0 || d.critical_hours > 0) {
        perDayWarnings.set(d.date, (perDayWarnings.get(d.date) ?? 0) + 1);
      }
    }
    const level = w.peak_composite_risk !== null ? classifyCompositeRiskLevel(w.peak_composite_risk) : 'Unknown';
    levels[level] = (levels[level] ?? 0) + 1;
  }
  let cityPeakDay: string | null = null;
  let cityPeakCount = -1;
  for (const [date, count] of perDayWarnings) {
    if (count > cityPeakCount) {
      cityPeakCount = count;
      cityPeakDay = date;
    }
  }
  return {
    wards_with_warning: warnings,
    wards_with_critical: criticals,
    city_peak_day: cityPeakDay,
    earliest_warning_lead_hours: earliestWarning,
    earliest_critical_lead_hours: earliestCritical,
    composite_levels: levels,
  };
}
