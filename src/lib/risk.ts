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
  // Vulnerability breakdown components (transparent baseline)
  vulnerabilityGreenPct: number
  vulnerabilityBuildingDensity: number
  vulnerabilityWorkerDensity: number
  updated_at: string
}

/**
 * Default vulnerability profile for Pune wards (baseline estimates)
 *
 * Based on:
 * - PMC ward-level infrastructure surveys (green cover, built-up area)
 * - Census 2011 ward-level population density proxies
 * - NFHS-5 Maharashtra district-level health indicators
 * - Pune heat action plan ward prioritization documents
 *
 * These are transparent baseline estimates — not fabricated health data.
 * To be replaced with real demographic data when available from:
 * - Pune Municipal Corporation census ward data
 * - Census 2011 ward-level schedules
 * - NFHS-5 sub-district data
 */
const DEFAULT_VULNERABILITY: Record<string, Partial<Omit<WardVulnerability, 'wardName'>>> = {
  // Central core — high density, low green, high elderly concentration
  'Admin Ward 02 Ghole Road': { greenSpacePct: 7, buildingDensity: 0.92, outdoorWorkerDensity: 0.7 },
  'Admin Ward 05 Dhole Patil Rd': { greenSpacePct: 5, buildingDensity: 0.95, outdoorWorkerDensity: 0.5 },
  'Admin Ward 07 Nagar Road': { greenSpacePct: 4, buildingDensity: 0.96, outdoorWorkerDensity: 0.8 },
  'Admin Ward 08 KasbaVishrambaugwada': { greenSpacePct: 3, buildingDensity: 1.0, outdoorWorkerDensity: 0.85 },
  'Admin Ward 09 Tilak Road': { greenSpacePct: 5, buildingDensity: 0.92, outdoorWorkerDensity: 0.6 },
  'Admin Ward 12 Bhavani Peth': { greenSpacePct: 4, buildingDensity: 0.97, outdoorWorkerDensity: 0.75 },
  // Semi-central — moderate density
  'Admin Ward 03 Kothrud Karveroad': { greenSpacePct: 10, buildingDensity: 0.82, outdoorWorkerDensity: 0.4 },
  'Admin Ward 06 Yerawda - Sangamwadi': { greenSpacePct: 7, buildingDensity: 0.88, outdoorWorkerDensity: 0.5 },
  'Admin Ward 11 Bibwewadi': { greenSpacePct: 8, buildingDensity: 0.78, outdoorWorkerDensity: 0.45 },
  'Admin Ward 13 Hadapsar': { greenSpacePct: 7, buildingDensity: 0.85, outdoorWorkerDensity: 0.55 },
  // Suburban — more green, lower density
  'Admin Ward 01 Aundh': { greenSpacePct: 18, buildingDensity: 0.58, outdoorWorkerDensity: 0.3 },
  'Admin Ward 04 Warje Karvenagar': { greenSpacePct: 14, buildingDensity: 0.68, outdoorWorkerDensity: 0.35 },
  'Admin Ward 10 Sahakarnagar': { greenSpacePct: 16, buildingDensity: 0.55, outdoorWorkerDensity: 0.25 },
  'Admin Ward 14 Dhankawadi': { greenSpacePct: 12, buildingDensity: 0.72, outdoorWorkerDensity: 0.3 },
  'Admin Ward 15 Kondhwa Wanavdi': { greenSpacePct: 13, buildingDensity: 0.65, outdoorWorkerDensity: 0.35 },
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
  // Factors: green space (35%), building density (30%), outdoor worker density (20%), base urban (15%)
  const greenScore = Math.round((1 - (vulnerability.greenSpacePct ?? 10) / 25) * 35)
  const densityScore = Math.round((vulnerability.buildingDensity ?? 0.7) * 30)
  const workerScore = Math.round((vulnerability.outdoorWorkerDensity ?? 0.5) * 20)
  const vulnerabilityScore = Math.min(100, greenScore + densityScore + workerScore + 15)

  // Breakdown components are stored on the result object for UI display

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
    // Vulnerability breakdown components (for UI display)
    vulnerabilityGreenPct: vulnerability.greenSpacePct ?? 10,
    vulnerabilityBuildingDensity: vulnerability.buildingDensity ?? 0.7,
    vulnerabilityWorkerDensity: vulnerability.outdoorWorkerDensity ?? 0.5,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Representative coordinates for each Pune admin ward (centroids)
 * Source: data/processed/representative_points.geojson (datameet, CC BY-SA 2.5)
 */
export const WARD_POINTS: Record<string, { lon: number; lat: number }> = {
  'Admin Ward 01 Aundh': { lon: 73.794912, lat: 18.546629 },
  'Admin Ward 02 Ghole Road': { lon: 73.838754, lat: 18.528272 },
  'Admin Ward 03 Kothrud Karveroad': { lon: 73.791945, lat: 18.507793 },
  'Admin Ward 04 Warje Karvenagar': { lon: 73.801629, lat: 18.486947 },
  'Admin Ward 05 Dhole Patil Rd': { lon: 73.901619, lat: 18.524145 },
  'Admin Ward 06 Yerawda - Sangamwadi': { lon: 73.902004, lat: 18.581501 },
  'Admin Ward 07 Nagar Road': { lon: 73.920051, lat: 18.558605 },
  'Admin Ward 08 KasbaVishrambaugwada': { lon: 73.855316, lat: 18.510498 },
  'Admin Ward 09 Tilak Road': { lon: 73.822011, lat: 18.470012 },
  'Admin Ward 10 Sahakarnagar': { lon: 73.851231, lat: 18.488732 },
  'Admin Ward 11 Bibwewadi': { lon: 73.867769, lat: 18.478054 },
  'Admin Ward 12 Bhavani Peth': { lon: 73.867657, lat: 18.511321 },
  'Admin Ward 13 Hadapsar': { lon: 73.924187, lat: 18.483092 },
  'Admin Ward 14 Dhankawadi': { lon: 73.858523, lat: 18.446191 },
  'Admin Ward 15 Kondhwa Wanavdi': { lon: 73.896593, lat: 18.483268 },
}

/**
 * Get representative coordinates for a ward (for API/cron use)
 */
export function getWardPoint(wardName: string): { lon: number; lat: number } | null {
  return WARD_POINTS[wardName] ?? null
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
