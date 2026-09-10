/**
 * HeatPulse — Biometeorological Thermal Engine
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 * 
 * Mathematical Implementations:
 * 1. NOAA Rothfusz Heat Index with full NOAA NWS adjustments:
 *    - Steadman preliminary formula for T < 80°F (26.7°C)
 *    - 9-term polynomial regression when preliminary HI >= 80°F
 *    - Low-humidity adjustment when RH < 13% and 80°F <= T <= 112°F
 *    - High-humidity adjustment when RH > 85% and 80°F <= T <= 87°F
 * 2. BoM Simplified Outdoor WBGT:
 *    - WBGT = 0.567 * T + 0.393 * e + 3.94
 *    - Magnus-Tetens saturation vapor pressure formulation
 * 3. Transparent UTCI Proxy (utci_proxy):
 *    - Apparent temperature biometeorological proxy
 * 4. Strict Scientific Classification:
 *    - Heat Conditions (Atmospheric state)
 *    - Thermal Stress (Human biometeorology)
 */

import {
  RiskLevel,
  ThermalCalculations,
  ThermalReadings,
  ThermalStressLevel,
} from '../types/thermal';
import {
  classifyHeatCondition,
  classifyThermalStress,
} from './threshold-config';

/**
 * Calculates NOAA Rothfusz Heat Index (°C) with mandatory NWS humidity adjustments.
 * References:
 * - Rothfusz, L.P. (1990). The heat index equation. NWS Technical Attachment SR 90-23.
 * - Steadman, R.G. (1979). The Assessment of Sultriness. Journal of Applied Meteorology.
 */
export function calculateHeatIndex(tempC: number, humidity: number): number {
  // Heat index is physiologically defined for temperatures >= 20°C
  if (tempC < 20) {
    return Math.round(tempC * 10) / 10;
  }

  // Convert ambient temperature to Fahrenheit for NWS Rothfusz baseline
  const tf = tempC * 1.8 + 32;
  const rh = Math.max(0, Math.min(100, humidity));

  // Steadman's preliminary Heat Index
  let hiF = 0.5 * (tf + 61.0 + (tf - 68.0) * 1.2 + rh * 0.094);

  // If preliminary HI is 80°F (26.7°C) or higher, apply full 9-term Rothfusz regression
  if ((hiF + tf) / 2 >= 80.0) {
    hiF =
      -42.379 +
      2.04901523 * tf +
      10.14333127 * rh -
      0.22475541 * tf * rh -
      0.00683783 * tf * tf -
      0.05481717 * rh * rh +
      0.00122874 * tf * tf * rh +
      0.00085282 * tf * rh * rh -
      0.00000199 * tf * tf * rh * rh;

    // NWS low-humidity adjustment: applied when RH < 13% and 80°F <= T <= 112°F
    if (rh < 13 && tf >= 80.0 && tf <= 112.0) {
      const lowHumidityAdjustment =
        -((13 - rh) / 4) * Math.sqrt((17 - Math.abs(tf - 95.0)) / 17);
      hiF += lowHumidityAdjustment;
    }

    // NWS high-humidity adjustment: applied when RH > 85% and 80°F <= T <= 87°F
    if (rh > 85 && tf >= 80.0 && tf <= 87.0) {
      const highHumidityAdjustment =
        ((rh - 85) / 10) * ((87.0 - tf) / 5);
      hiF += highHumidityAdjustment;
    }
  }

  // Convert resulting Heat Index in Fahrenheit back to Celsius
  const hiC = (hiF - 32) * (5 / 9);
  return Math.round(hiC * 10) / 10;
}

/**
 * Australian Bureau of Meteorology (BoM) Simplified Outdoor WBGT (°C)
 * Formula: WBGT = 0.567 * T + 0.393 * e + 3.94
 * Where e = water vapor pressure (hPa) computed via Magnus-Tetens formulation:
 * e = (RH / 100) * 0.6108 * exp((17.27 * T) / (237.3 + T)) * 10
 */
export function calculateWBGT(tempC: number, humidity: number): number {
  const rh = Math.max(0, Math.min(100, humidity));
  // Saturation vapor pressure in kPa multiplied by 10 to yield hPa
  const e = (rh / 100) * 0.6108 * Math.exp((17.27 * tempC) / (237.3 + tempC)) * 10;
  const wbgt = 0.567 * tempC + 0.393 * e + 3.94;
  return Math.round(wbgt * 10) / 10;
}

/**
 * UTCI Proxy (utci_proxy)
 * Transparently designates apparent temperature as an operational UTCI Proxy.
 * Full Universal Thermal Climate Index requires advanced Fiala multi-node thermoregulation
 * and mean radiant temperature (Tmrt) radiation modeling.
 */
export function approximateUTCI(
  tempC: number,
  humidity: number,
  apparentTemp: number
): number {
  // Apparent temperature approximation designated honestly as UTCI Proxy (utci_proxy)
  return Math.round(apparentTemp * 10) / 10;
}

/**
 * Classifies physical atmospheric Heat Conditions based on 2m dry-bulb air temperature.
 * Thresholds live in threshold-config.ts (single source of truth).
 */
export { classifyHeatCondition };

/**
 * Classifies human biometeorological Thermal Stress based on NOAA Heat Index and BoM WBGT.
 * Thresholds live in threshold-config.ts (single source of truth).
 */
export { classifyThermalStress };

/**
 * Legacy risk level classification mapping for backward compatibility with existing UI components
 */
export function classifyRisk(heatIndex: number): {
  level: RiskLevel;
  label: string;
  color: string;
} {
  if (heatIndex >= 54) return { level: 'danger', label: 'Danger', color: '#dc2626' };
  if (heatIndex >= 41) return { level: 'extreme', label: 'Extreme Danger', color: '#ea580c' };
  if (heatIndex >= 32) return { level: 'high', label: 'High Danger', color: '#f59e0b' };
  if (heatIndex >= 27) return { level: 'moderate', label: 'Moderate', color: '#3b82f6' };
  return { level: 'low', label: 'Low', color: '#22c55e' };
}

/**
 * Generates actionable biometeorological recommendations based on thermal stress
 */
export function getRecommendations(
  thermalStress: ThermalStressLevel | RiskLevel,
  tempC: number,
  humidity: number
): string[] {
  const recs: string[] = [];
  const normalized =
    thermalStress === 'Severe' || thermalStress === 'danger' || thermalStress === 'extreme'
      ? 'Severe'
      : thermalStress === 'High' || thermalStress === 'high'
      ? 'High'
      : thermalStress === 'Moderate' || thermalStress === 'moderate'
      ? 'Moderate'
      : 'Low';

  switch (normalized) {
    case 'Low':
      recs.push('Normal outdoor activity is safe.');
      break;
    case 'Moderate':
      recs.push('Outdoor activities are generally safe.');
      recs.push('Maintain regular hydration, especially for sensitive groups.');
      break;
    case 'High':
      recs.push('Reduce prolonged outdoor physical exertion during peak afternoon hours.');
      recs.push('Ensure outdoor workers have shaded rest breaks every 20-30 minutes.');
      recs.push('Provide hydration checkpoints and monitor vulnerable individuals.');
      break;
    case 'Severe':
      recs.push('URGENT: Hazardous heat stress conditions.');
      recs.push('Halt non-essential strenuous outdoor labor between 11:00 AM and 4:00 PM.');
      recs.push('Activate municipal shaded cooling shelters and public water distribution.');
      recs.push('Ensure emergency first-responders and clinics are prepared for heat exhaustion cases.');
      break;
  }

  if (humidity > 70 && tempC > 30) {
    recs.push(
      'High relative humidity impairs evaporative perspiration — physiological cooling capacity is reduced.'
    );
  }

  return recs;
}

/**
 * Calculates strict ThermalCalculations conforming to PROJECT.md § Interface Contracts
 */
export function calculateThermalCalculations(
  temperature: number,
  humidity: number,
  apparentTemperature: number
): ThermalCalculations {
  const hi = calculateHeatIndex(temperature, humidity);
  const wbgt = calculateWBGT(temperature, humidity);
  const utciProxy = approximateUTCI(temperature, humidity, apparentTemperature);
  const heatCondition = classifyHeatCondition(temperature);
  const thermalStress = classifyThermalStress(hi, wbgt);

  return {
    heat_index: hi,
    wbgt,
    utci_proxy: utciProxy,
    heat_condition: heatCondition,
    thermal_stress: thermalStress,
  };
}

/**
 * Computes complete ThermalReadings object for a single time point
 */
export function calculateThermalStress(
  temperature: number,
  humidity: number,
  apparentTemperature: number
): ThermalReadings {
  const calculations = calculateThermalCalculations(
    temperature,
    humidity,
    apparentTemperature
  );
  const { level, label } = classifyRisk(calculations.heat_index);
  const recs = getRecommendations(calculations.thermal_stress, temperature, humidity);

  return {
    temperature,
    humidity,
    apparent_temperature: apparentTemperature,
    heat_index: calculations.heat_index,
    wbgt_estimated: calculations.wbgt,
    utci_proxy: calculations.utci_proxy,
    utc_index: calculations.utci_proxy, // Legacy alias for UTCI Proxy
    risk_level: level,
    risk_label: label,
    heat_condition: calculations.heat_condition,
    thermal_stress: calculations.thermal_stress,
    recommendations: recs,
    calculated_at: new Date().toISOString(),
  };
}

/**
 * Computes thermal stress readings across all hourly forecast time points
 */
export function calculateHourlyThermalForecast(forecast: {
  hourly: Array<{
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
  }>;
}): Array<ThermalReadings & { time: string }> {
  return forecast.hourly.map((h) => ({
    ...calculateThermalStress(
      h.temperature_2m,
      h.relative_humidity_2m,
      h.apparent_temperature
    ),
    time: h.time,
  }));
}
