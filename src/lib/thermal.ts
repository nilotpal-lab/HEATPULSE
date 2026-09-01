/**
 * HeatPulse — Thermal Stress Engine
 *
 * Calculates Heat Index (HI), Wet-Bulb Globe Temperature (WBGT),
 * and Universal Thermal Climate Index (UTCI) from weather data.
 *
 * All formulas are standard meteorological equations.
 * No fabricated health data — transparent baseline model only.
 */

export interface ThermalReadings {
  temperature: number
  humidity: number
  apparent_temperature: number
  heat_index: number
  wbgt_estimated: number
  utc_index: number
  risk_level: RiskLevel
  risk_label: string
  recommendations: string[]
  calculated_at: string
}

export type RiskLevel = 'low' | 'moderate' | 'high' | 'extreme' | 'danger'

/**
 * Heat Index (HI) — Rothfusz Regression
 * https://www.weather.gov/htx/heatindex
 * Valid for T >= 27°C (80°F) and RH >= 40%
 * For lower temperatures, HI ≈ temperature
 */
export function calculateHeatIndex(tempC: number, humidity: number): number {
  if (tempC < 27) return tempC

  const T = tempC
  const R = humidity

  const HI =
    -8.7846947 +
    1.61139411 * T +
    2.338549 * R +
    -0.14611605 * T * R +
    -0.012308094 * T * T +
    -0.016424828 * R * R +
    0.002211732 * T * T * R +
    0.00072546 * T * R * R +
    -0.000003582 * T * T * R * R

  return Math.round(HI * 10) / 10
}

/**
 * Estimated WBGT (Wet-Bulb Globe Temperature)
 * Simplified outdoor formula (Nolet & Brown, 1973):
 *   WBGT = 0.567 * T + 0.393 * e + 3.94
 * where e = vapor pressure (hPa) = RH * 0.6108 * exp(17.27*T/(237.3+T))
 *
 * This is an estimate — real WBGT requires globe thermometer measurement.
 */
export function calculateWBGT(
  tempC: number,
  humidity: number
): number {
  const e = (humidity / 100) * 0.6108 * Math.exp((17.27 * tempC) / (237.3 + tempC)) * 10
  const wbgt = 0.567 * tempC + 0.393 * e + 3.94
  return Math.round(wbgt * 10) / 10
}

/**
 * Simplified UTCI approximation
 * UTCI requires complex radiation and wind modeling.
 * This is a first-order approximation using apparent temperature.
 * Real UTCI requires the USEK model with solar radiation.
 */
export function approximateUTCI(tempC: number, humidity: number, apparentTemp: number): number {
  // UTCI ≈ apparent temperature (simplified)
  // The relationship between apparent temp and UTCI is strong in urban environments
  return Math.round(apparentTemp * 10) / 10
}

/**
 * Classify thermal risk based on Heat Index
 */
export function classifyRisk(heatIndex: number): { level: RiskLevel; label: string; color: string } {
  if (heatIndex >= 54) return { level: 'danger', label: 'Danger', color: '#dc2626' }
  if (heatIndex >= 41) return { level: 'extreme', label: 'Extreme Danger', color: '#ea580c' }
  if (heatIndex >= 32) return { level: 'high', label: 'High Danger', color: '#f59e0b' }
  if (heatIndex >= 27) return { level: 'moderate', label: 'Moderate', color: '#3b82f6' }
  return { level: 'low', label: 'Low', color: '#22c55e' }
}

/**
 * Generate actionable recommendations based on risk level
 */
export function getRecommendations(riskLevel: RiskLevel, tempC: number, humidity: number): string[] {
  const recs: string[] = []

  switch (riskLevel) {
    case 'low':
      recs.push('Normal outdoor activity is safe.')
      break
    case 'moderate':
      recs.push('Outdoor activities are generally safe.')
      recs.push('Stay hydrated, especially for sensitive groups.')
      break
    case 'high':
      recs.push('Reduce prolonged outdoor exertion.')
      recs.push('Ensure outdoor workers have shade breaks every 20 minutes.')
      recs.push('Check on elderly, children, and outdoor workers.')
      break
    case 'extreme':
      recs.push('Avoid all unnecessary outdoor exertion.')
      recs.push('Open cooling centers in affected areas.')
      recs.push('Activate heat action plan protocols.')
      recs.push('Deploy water stations for outdoor workers.')
      break
    case 'danger':
      recs.push('EMERGENCY: Life-threatening heat conditions.')
      recs.push('All outdoor work should STOP immediately.')
      recs.push('Alert all cooling centers to full capacity.')
      recs.push('Coordinate with hospitals for heat-related admissions.')
      recs.push('Broadcast emergency advisories via all channels.')
      break
  }

  // Additional humidity-specific advice
  if (humidity > 70 && tempC > 30) {
    recs.push('High humidity is reducing evaporative cooling — risk is higher than temperature alone suggests.')
  }

  return recs
}

/**
 * Main thermal stress calculation for a single time point
 */
export function calculateThermalStress(
  temperature: number,
  humidity: number,
  apparentTemperature: number
): ThermalReadings {
  const hi = calculateHeatIndex(temperature, humidity)
  const wbgt = calculateWBGT(temperature, humidity)
  const utc = approximateUTCI(temperature, humidity, apparentTemperature)
  const { level, label, color } = classifyRisk(hi)
  const recommendations = getRecommendations(level, temperature, humidity)

  return {
    temperature,
    humidity,
    apparent_temperature: apparentTemperature,
    heat_index: hi,
    wbgt_estimated: wbgt,
    utc_index: utc,
    risk_level: level,
    risk_label: label,
    recommendations,
    calculated_at: new Date().toISOString(),
  }
}

/**
 * Calculate thermal stress for all hourly readings
 */
export function calculateHourlyThermalForecast(forecast: {
  hourly: Array<{ time: string; temperature_2m: number; relative_humidity_2m: number; apparent_temperature: number }>
}): Array<ThermalReadings & { time: string }> {
  return forecast.hourly.map((h) => ({
    ...calculateThermalStress(h.temperature_2m, h.relative_humidity_2m, h.apparent_temperature),
    time: h.time,
  }))
}
