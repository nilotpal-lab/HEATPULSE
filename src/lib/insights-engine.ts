/**
 * HeatPulse — Non-Causal Descriptive Insights Engine
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 * 
 * Scientific Integrity & Data Honesty (Requirement R5):
 * - Analyzes NWP-projected meteorological patterns only (no field observations).
 * - Identifies diurnal trajectories, nocturnal cooling rates, and thermal stress persistence.
 * - Strictly non-causal: zero synthetic mortality figures, zero hospital casualty claims,
 *   and zero unsupported epidemiological causal assertions.
 */

import { WardWeatherForecast, CityForecastRun } from '../types/weather';
import { calculateHeatIndex, calculateWBGT } from './thermal-engine';
import { THERMAL_STRESS_THRESHOLDS } from './threshold-config';

export type InsightCategory =
  | 'diurnal_trajectory'
  | 'nocturnal_heat'
  | 'thermal_persistence'
  | 'humidity_amplification';

export type InsightSeverity = 'info' | 'advisory' | 'warning' | 'critical';

export interface DescriptiveInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  headline: string;
  summary: string;
  meteorological_evidence: string;
  affected_scope: string; // Ward or City
  observed_metric: {
    label: string;
    value: string | number;
    unit?: string;
  };
}

export interface DiurnalMetrics {
  date: string;
  peak_temp_c: number;
  peak_hour_ist: string;
  min_temp_c: number;
  diurnal_range_c: number;
  hours_above_35c: number;
  hours_above_40c: number;
  nighttime_min_c: number; // 22:00 - 06:00
  is_tropical_night: boolean; // Nighttime min >= 25°C
}

/**
 * Computes diurnal trajectory metrics across 24-hour daily segments from hourly weather
 */
export function analyzeDiurnalTrajectory(
  times: string[],
  temps: number[],
  humidities: number[]
): DiurnalMetrics[] {
  const dayGroups: Record<string, { times: string[]; temps: number[]; hums: number[] }> = {};

  for (let i = 0; i < times.length; i++) {
    const timeStr = times[i];
    const dateStr = timeStr.slice(0, 10);
    if (!dayGroups[dateStr]) {
      dayGroups[dateStr] = { times: [], temps: [], hums: [] };
    }
    dayGroups[dateStr].times.push(timeStr);
    dayGroups[dateStr].temps.push(temps[i]);
    dayGroups[dateStr].hums.push(humidities[i]);
  }

  const results: DiurnalMetrics[] = [];

  for (const [date, data] of Object.entries(dayGroups)) {
    if (data.temps.length === 0) continue;

    let peakTemp = -999;
    let peakHour = '';
    let minTemp = 999;
    let hoursAbove35 = 0;
    let hoursAbove40 = 0;
    let nighttimeMin = 999;

    for (let i = 0; i < data.temps.length; i++) {
      const t = data.temps[i];
      const time = data.times[i];
      const hour = parseInt(time.slice(11, 13), 10);

      if (t > peakTemp) {
        peakTemp = t;
        peakHour = `${String(hour).padStart(2, '0')}:00`;
      }
      if (t < minTemp) {
        minTemp = t;
      }
      if (t >= 35.0) hoursAbove35++;
      if (t >= 40.0) hoursAbove40++;

      // Nighttime window: 22:00 through 06:00
      if (hour >= 22 || hour <= 6) {
        if (t < nighttimeMin) nighttimeMin = t;
      }
    }

    const diurnalRange = Math.round((peakTemp - minTemp) * 10) / 10;

    results.push({
      date,
      peak_temp_c: Math.round(peakTemp * 10) / 10,
      peak_hour_ist: peakHour,
      min_temp_c: Math.round(minTemp * 10) / 10,
      diurnal_range_c: diurnalRange,
      hours_above_35c: hoursAbove35,
      hours_above_40c: hoursAbove40,
      nighttime_min_c: nighttimeMin === 999 ? minTemp : Math.round(nighttimeMin * 10) / 10,
      is_tropical_night: nighttimeMin >= 25.0,
    });
  }

  return results;
}

/**
 * Analyzes thermal stress persistence (consecutive hours with HI >= 32°C or WBGT >= 28°C)
 */
export function analyzeThermalPersistence(
  temps: number[],
  humidities: number[]
): {
  max_consecutive_hours_hi_32: number;
  max_consecutive_hours_hi_41: number;
  peak_heat_index: number;
  peak_wbgt: number;
  humidity_penalty_c: number; // Heat Index - Dry Bulb Temp difference
} {
  let curRun32 = 0;
  let maxRun32 = 0;
  let curRun41 = 0;
  let maxRun41 = 0;
  let peakHI = 0;
  let peakWbgt = 0;
  let maxPenalty = 0;

  const count = Math.min(temps.length, humidities.length);
  for (let i = 0; i < count; i++) {
    const t = temps[i];
    const rh = humidities[i];
    const hi = calculateHeatIndex(t, rh);
    const wbgt = calculateWBGT(t, rh);

    if (hi > peakHI) peakHI = hi;
    if (wbgt > peakWbgt) peakWbgt = wbgt;

    const penalty = hi - t;
    if (penalty > maxPenalty) maxPenalty = penalty;

    if (hi >= THERMAL_STRESS_THRESHOLDS.highHi) {
      curRun32++;
      if (curRun32 > maxRun32) maxRun32 = curRun32;
    } else {
      curRun32 = 0;
    }

    if (hi >= THERMAL_STRESS_THRESHOLDS.severeHi) {
      curRun41++;
      if (curRun41 > maxRun41) maxRun41 = curRun41;
    } else {
      curRun41 = 0;
    }
  }

  return {
    max_consecutive_hours_hi_32: maxRun32,
    max_consecutive_hours_hi_41: maxRun41,
    peak_heat_index: Math.round(peakHI * 10) / 10,
    peak_wbgt: Math.round(peakWbgt * 10) / 10,
    humidity_penalty_c: Math.round(maxPenalty * 10) / 10,
  };
}

/**
 * Synthesizes data-backed descriptive insights for a single ward forecast
 */
export function generateWardDescriptiveInsights(
  wardForecast: WardWeatherForecast
): DescriptiveInsight[] {
  const insights: DescriptiveInsight[] = [];
  const hourly = wardForecast.hourly;
  if (!hourly.time || hourly.time.length === 0) return insights;

  const diurnals = analyzeDiurnalTrajectory(
    hourly.time,
    hourly.temperature_2m,
    hourly.relative_humidity_2m
  );
  const persistence = analyzeThermalPersistence(
    hourly.temperature_2m,
    hourly.relative_humidity_2m
  );

  const today = diurnals[0];

  // 1. Diurnal Trajectory & Peak Window
  if (today) {
    const isHighPeak = today.peak_temp_c >= 38.0;
    insights.push({
      id: `${wardForecast.ward_id}-diurnal-peak`,
      category: 'diurnal_trajectory',
      severity: isHighPeak ? 'warning' : 'info',
      headline: `Diurnal Peak Temperature Projected at ${today.peak_hour_ist} IST`,
      summary: `Ambient 2m dry-bulb temperature peaks at ${today.peak_temp_c}°C with a diurnal range of ${today.diurnal_range_c}°C.`,
      meteorological_evidence: `Numerical weather prediction trajectory indicates ${today.hours_above_35c} hours with dry-bulb temperature >= 35°C on ${today.date}.`,
      affected_scope: wardForecast.ward_name,
      observed_metric: {
        label: 'Peak 2m Temperature',
        value: today.peak_temp_c,
        unit: '°C',
      },
    });

    // 2. Nocturnal Tropical Night Detection
    if (today.is_tropical_night) {
      insights.push({
        id: `${wardForecast.ward_id}-nocturnal-recovery`,
        category: 'nocturnal_heat',
        severity: 'advisory',
        headline: 'Tropical Night: Impaired Nocturnal Cooling Window',
        summary: `Minimum nocturnal temperature remains elevated at ${today.nighttime_min_c}°C (>= 25°C threshold), restricting physiological heat dissipation.`,
        meteorological_evidence: `Overnight thermal persistence projected by the NWP forecast between 22:00 and 06:00 IST where ambient air fails to drop below 25°C.`,
        affected_scope: wardForecast.ward_name,
        observed_metric: {
          label: 'Nocturnal Minimum',
          value: today.nighttime_min_c,
          unit: '°C',
        },
      });
    }
  }

  // 3. Atmospheric Humidity Amplification
  if (persistence.humidity_penalty_c >= 4.0) {
    insights.push({
      id: `${wardForecast.ward_id}-humidity-amplification`,
      category: 'humidity_amplification',
      severity: 'warning',
      headline: `Atmospheric Moisture Elevates Heat Index by +${persistence.humidity_penalty_c}°C`,
      summary: `High atmospheric water vapor pressure significantly elevates apparent physiological strain above forecast dry-bulb temperature.`,
      meteorological_evidence: `NOAA Rothfusz regression calculates peak Heat Index of ${persistence.peak_heat_index}°C compared to peak dry-bulb temperature.`,
      affected_scope: wardForecast.ward_name,
      observed_metric: {
        label: 'HI Humidity Departure',
        value: `+${persistence.humidity_penalty_c}`,
        unit: '°C',
      },
    });
  }

  // 4. Consecutive Thermal Stress Persistence
  if (persistence.max_consecutive_hours_hi_32 >= 4) {
    insights.push({
      id: `${wardForecast.ward_id}-stress-persistence`,
      category: 'thermal_persistence',
      severity: persistence.max_consecutive_hours_hi_41 > 0 ? 'critical' : 'advisory',
      headline: `Sustained Thermal Stress Duration: ${persistence.max_consecutive_hours_hi_32} Consecutive Hours`,
      summary: `Continuous heat stress exposure (Heat Index >= 32°C) sustained over an extended multi-hour afternoon corridor.`,
      meteorological_evidence: `Consecutive hourly forecast sequence demonstrates prolonged thermal load without intermediate cooling intervals.`,
      affected_scope: wardForecast.ward_name,
      observed_metric: {
        label: 'Consecutive Stress Hours',
        value: persistence.max_consecutive_hours_hi_32,
        unit: 'hrs',
      },
    });
  }

  return insights;
}

/**
 * Synthesizes city-wide descriptive insights across all wards without causal assertions
 */
export function generateCityDescriptiveInsights(
  cityRun: CityForecastRun
): DescriptiveInsight[] {
  const insights: DescriptiveInsight[] = [];
  const wardEntries = Object.values(cityRun.wards);
  if (wardEntries.length === 0) return insights;

  // City-wide peak temperature
  let cityPeakTemp = -999;
  let cityPeakWard = '';
  let wardsAbove38 = 0;
  let tropicalNightCount = 0;

  for (const w of wardEntries) {
    const curTemp = w.current.temperature_2m;
    if (curTemp > cityPeakTemp) {
      cityPeakTemp = curTemp;
      cityPeakWard = w.ward_name;
    }
    if (curTemp >= 38.0) {
      wardsAbove38++;
    }

    const diurnals = analyzeDiurnalTrajectory(
      w.hourly.time.slice(0, 24),
      w.hourly.temperature_2m.slice(0, 24),
      w.hourly.relative_humidity_2m.slice(0, 24)
    );
    if (diurnals[0]?.is_tropical_night) {
      tropicalNightCount++;
    }
  }

  // Summary insight: Spatial Thermal Gradient
  insights.push({
    id: `${cityRun.city_id}-city-gradient`,
    category: 'diurnal_trajectory',
    severity: wardsAbove38 > 0 ? 'warning' : 'info',
    headline: `City-Wide Thermal Assessment Across ${wardEntries.length} Monitored Wards`,
    summary: `Localized NWP centroid sampling captures peak current temperature of ${cityPeakTemp}°C in ${cityPeakWard}.`,
    meteorological_evidence: `Derived from server-side batched numerical weather prediction model run ${cityRun.run_time}.`,
    affected_scope: `${cityRun.city_id.toUpperCase()} Municipal Area`,
    observed_metric: {
      label: 'Monitored Wards',
      value: wardEntries.length,
    },
  });

  if (tropicalNightCount > 0) {
    insights.push({
      id: `${cityRun.city_id}-city-tropical-nights`,
      category: 'nocturnal_heat',
      severity: 'advisory',
      headline: `${tropicalNightCount} of ${wardEntries.length} Wards Exhibit Tropical Night Patterns`,
      summary: `Local night-time temperatures stay at or above 25°C, reducing night-time physiological cooling for residents.`,
      meteorological_evidence: `Minimum temperatures in the 22:00-06:00 window sustained at >= 25°C across urban core centroids.`,
      affected_scope: `${cityRun.city_id.toUpperCase()} Urban Core`,
      observed_metric: {
        label: 'Wards with Nocturnal Heat',
        value: `${tropicalNightCount}/${wardEntries.length}`,
      },
    });
  }

  return insights;
}
