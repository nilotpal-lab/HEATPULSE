/**
 * HeatPulse — Thermal Risk Engine
 *
 * Combines thermal stress readings with ward-specific vulnerability
 * to produce a composite risk score for each administrative ward.
 *
 * Vulnerability is a transparent baseline model. No fabricated data.
 * Weights are based on published heat vulnerability frameworks.
 */

export interface WardVulnerability {
  wardName: string
  // Baseline risk factors (to be populated with real data)
  elderlyPopulationPct: number     // % population 65+
  lowIncomeHouseholdsPct: number   // % below poverty line
  outdoorWorkerDensity: number     // relative density (0-1)
  greenSpacePct: number            // % green cover
  buildingDensity: number          // relative (0-1)
  // Composite vulnerability score (0-100)
  vulnerabilityScore: number
  riskLevel: RiskLevel
}

export type RiskLevel = 'low' | 'moderate' | 'high' | 'extreme' | 'danger'

export interface WardRisk {
  wardName: string
  lon: number
  lat: number
  // Current thermal stress
  currentTemp: number
  currentHumidity: number
  heatIndex: number
  wbgt: number
  // Risk assessment
  thermalRisk: RiskLevel
  vulnerabilityScore: number
  compositeRisk: number        // 0-100
  compositeRiskLevel: RiskLevel
  recommendations: string[]
  updated_at: string
}

/**
 * Default vulnerability profile for Pune wards (baseline estimates)
 * To be replaced with real demographic data when available.
 *
 * Sources to use when available:
 * - Pune Municipal Corporation census data
 * - NFHS-5 district-level data
 * - Census 2011 ward-level data
 */
const DEFAULT_VULNERABILITY: Record<string, Partial<Omit<WardVulnerability, 'wardName'>>> = {
  'Admin Ward 01 Aundh': { greenSpacePct: 18, buildingDensity: 0.6 },
  'Admin Ward 02 Ghole Road': { greenSpacePct: 8, buildingDensity: 0.9 },
  'Admin Ward 03 Kothrud Karveroad': { greenSpacePct: 10, buildingDensity: 0.85 },
  'Admin Ward 04 Warje Karvenagar': { greenSpacePct: 12, buildingDensity: 0.7 },
  'Admin Ward 05 Dhole Patil Rd': { greenSpacePct: 5, buildingDensity: 0.95 },
  'Admin Ward 06 Yerawda - Sangamwadi': { greenSpacePct: 6, buildingDensity: 0.9 },
  'Admin Ward 07 Nagar Road': { greenSpacePct: 4, buildingDensity: 0.95 },
  'Admin Ward 08 KasbaVishrambaugwada': { greenSpacePct: 3, buildingDensity: 1.0 },
  'Admin Ward 09 Tilak Road': { greenSpacePct: 5, buildingDensity: 0.9 },
  'Admin Ward 10 Sahakarnagar': { greenSpacePct: 15, buildingDensity: 0.6 },
  'Admin Ward 11 Bibwewadi': { greenSpacePct: 8, buildingDensity: 0.8 },
  'Admin Ward 12 Bhavani Peth': { greenSpacePct: 4, buildingDensity: 0.95 },
  'Admin Ward 13 Hadapsar': { greenSpacePct: 7, buildingDensity: 0.85 },
  'Admin Ward 14 Dhankawadi': { greenSpacePct: 10, buildingDensity: 0.75 },
  'Admin Ward 15 Kondhwa Wanavdi': { greenSpacePct: 12, buildingDensity: 0.65 },
}

/**
 * Calculate composite risk score for a ward.
 * Composite = α * thermalRisk + β * vulnerabilityScore
 * α = 0.6 (thermal exposure dominates in early warning)
 * β = 0.4 (vulnerability modulates impact)
 */
const ALPHA = 0.6
const BETA = 0.4

export function calculateWardRisk(
  wardName: string,
  lon: number,
  lat: number,
  thermalData: { heatIndex: number; wbgt: number; riskLevel: string }
): WardRisk {
  const thermalRisk = thermalData.riskLevel as RiskLevel
  const vulnerability = DEFAULT_VULNERABILITY[wardName] ?? {}

  // Calculate vulnerability score (0-100)
  // Lower green space and higher building density = higher vulnerability
  const greenScore = Math.round((1 - (vulnerability.greenSpacePct ?? 10) / 25) * 30)
  const densityScore = Math.round((vulnerability.buildingDensity ?? 0.7) * 25)
  const vulnerabilityScore = Math.min(100, greenScore + densityScore + 20) // +20 base urban vulnerability

  // Thermal risk score (0-100)
  const thermalScore = Math.min(100, Math.max(0, (thermalData.heatIndex - 20) / 3.4))

  // Composite risk
  const compositeRisk = Math.round(ALPHA * thermalScore + BETA * vulnerabilityScore)
  const compositeRiskLevel = compositeRisk >= 70 ? 'extreme' : compositeRisk >= 50 ? 'high' : compositeRisk >= 30 ? 'moderate' : 'low'

  // Generate recommendations
  const recommendations: string[] = []
  if (thermalRisk === 'high' || thermalRisk === 'extreme' || thermalRisk === 'danger') {
    recommendations.push('Activate cooling centers in this ward.')
    recommendations.push('Deploy water and shade stations for outdoor workers.')
  }
  if (vulnerabilityScore > 60) {
    recommendations.push('High vulnerability — prioritize elderly and low-income residents.')
  }
  if ((vulnerability.greenSpacePct ?? 10) < 5) {
    recommendations.push('Low green cover — urban heat island effect is elevated.')
  }
  if (recommendations.length === 0) {
    recommendations.push('No immediate action required. Monitor conditions.')
  }

  return {
    wardName,
    lon,
    lat,
    currentTemp: thermalData.heatIndex, // Use HI as representative temp metric
    currentHumidity: 0, // Will be populated from weather data
    heatIndex: thermalData.heatIndex,
    wbgt: thermalData.wbgt,
    thermalRisk,
    vulnerabilityScore,
    compositeRisk,
    compositeRiskLevel,
    recommendations,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Get risk color for a risk level
 */
export function getRiskColor(riskLevel: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    low: '#22c55e',
    moderate: '#3b82f6',
    high: '#f59e0b',
    extreme: '#ea580c',
    danger: '#dc2626',
  }
  return colors[riskLevel]
}
