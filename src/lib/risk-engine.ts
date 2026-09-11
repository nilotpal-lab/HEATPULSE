/**
 * HeatPulse — Thermal-Vulnerability Risk Engine
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 * 
 * Heuristic Integration:
 *   Composite Risk = alpha * thermalScore + beta * vulnerabilityScore
 *   alpha = 0.6 (Thermal biometeorological exposure dominates early warning)
 *   beta = 0.4 (Socio-ecological baseline vulnerability modulates resilience)
 * 
 * Scaling Correction:
 *   Thermal Score (0-100) maps Heat Index excess from 20°C to 54°C linearly:
 *   thermalScore = (heatIndex - 20) / 0.34
 *   Eliminates legacy deflation defect.
 */

import type {
  CompositeRisk,
  RiskLevel,
  Vulnerability,
  VulnerabilityProvenance,
  WardRiskAssessment,
} from '../types/thermal';
import { DISABLED_HEALTH_LAYER } from '../types/thermal';
import type { ForecastRunMetadata } from '../types/weather';
import { calculateThermalCalculations, type WbgtEnv } from './thermal-engine';
import { getWardCensusProfile, computeCensusVulnerabilityScore } from './census-data';
import {
  classifyVulnerabilityLevel,
  classifyCompositeRiskLevel,
  calculateThermalScore as calculateAuthoritativeThermalScore,
  calculateCompositeRiskScore as calculateAuthoritativeCompositeRiskScore,
  compositeLevelToLegacyRisk,
  RISK_WEIGHTS,
} from './threshold-config';
import {
  getBengaluruWardVulnerability,
  isBengaluru,
} from './bengaluru-density-vulnerability';

// Single authoritative re-export for consumers; implementations live in
// threshold-config.ts (never duplicated here).
export {
  classifyVulnerabilityLevel,
  classifyCompositeRiskLevel,
} from './threshold-config';

export const ALPHA = RISK_WEIGHTS.alpha;
export const BETA = RISK_WEIGHTS.beta;

/**
 * Calculates normalized thermal risk score (0-100) from NOAA Heat Index (°C).
 * Delegates to threshold-config.calculateThermalScore — single implementation.
 */
export function calculateThermalScore(heatIndex: number): number {
  return calculateAuthoritativeThermalScore(heatIndex);
}

/**
 * Classifies composite thermal-vulnerability risk level
 */
export function calculateCompositeRisk(
  thermalScore: number,
  vulnerabilityScore: number
): CompositeRisk {
  const compositeScore = calculateAuthoritativeCompositeRiskScore(
    thermalScore,
    vulnerabilityScore
  );
  const rawScore = ALPHA * thermalScore + BETA * vulnerabilityScore;
  const compositeLevel = classifyCompositeRiskLevel(compositeScore);

  let atmosphericPct: number;
  let vulnerabilityPct: number;
  let primaryDriver: string;

  if (rawScore <= 0) {
    atmosphericPct = 60;
    vulnerabilityPct = 40;
    primaryDriver = 'Baseline Normal';
  } else {
    atmosphericPct = Math.min(
      100,
      Math.max(0, Math.round(((ALPHA * thermalScore) / rawScore) * 100))
    );
    vulnerabilityPct = 100 - atmosphericPct;
    primaryDriver =
      thermalScore >= vulnerabilityScore
        ? 'Atmospheric Heat Stress'
        : 'Built Environment Vulnerability';
  }

  return {
    composite_score: compositeScore,
    composite_level: compositeLevel,
    thermal_score: thermalScore,
    vulnerability_score: vulnerabilityScore,
    alpha: ALPHA,
    beta: BETA,
    contributing_factors: {
      atmospheric_pct: atmosphericPct,
      vulnerability_pct: vulnerabilityPct,
      primary_driver: primaryDriver,
    },
  };
}

/**
 * Transparent baseline vulnerability database for Pune 15 administrative wards.
 * Derived from PMC infrastructure surveys, Census 2011 proxies, and NFHS-5 Maharashtra data.
 * Annotated strictly as "Estimated Baseline" — zero synthetic mortality figures.
 */
export const PUNE_BASELINE_VULNERABILITY: Record<
  string,
  { greenSpacePct: number; buildingDensity: number; outdoorWorkerDensity: number }
> = {
  'Admin Ward 02 Ghole Road': { greenSpacePct: 7, buildingDensity: 0.92, outdoorWorkerDensity: 0.7 },
  'Admin Ward 05 Dhole Patil Rd': { greenSpacePct: 5, buildingDensity: 0.95, outdoorWorkerDensity: 0.5 },
  'Admin Ward 07 Nagar Road': { greenSpacePct: 4, buildingDensity: 0.96, outdoorWorkerDensity: 0.8 },
  'Admin Ward 08 KasbaVishrambaugwada': { greenSpacePct: 3, buildingDensity: 1.0, outdoorWorkerDensity: 0.85 },
  'Admin Ward 09 Tilak Road': { greenSpacePct: 5, buildingDensity: 0.92, outdoorWorkerDensity: 0.6 },
  'Admin Ward 12 Bhavani Peth': { greenSpacePct: 4, buildingDensity: 0.97, outdoorWorkerDensity: 0.75 },
  'Admin Ward 03 Kothrud Karveroad': { greenSpacePct: 10, buildingDensity: 0.82, outdoorWorkerDensity: 0.4 },
  'Admin Ward 06 Yerawda - Sangamwadi': { greenSpacePct: 7, buildingDensity: 0.88, outdoorWorkerDensity: 0.5 },
  'Admin Ward 11 Bibwewadi': { greenSpacePct: 8, buildingDensity: 0.78, outdoorWorkerDensity: 0.45 },
  'Admin Ward 13 Hadapsar': { greenSpacePct: 7, buildingDensity: 0.85, outdoorWorkerDensity: 0.55 },
  'Admin Ward 01 Aundh': { greenSpacePct: 18, buildingDensity: 0.58, outdoorWorkerDensity: 0.3 },
  'Admin Ward 04 Warje Karvenagar': { greenSpacePct: 14, buildingDensity: 0.68, outdoorWorkerDensity: 0.35 },
  'Admin Ward 10 Sahakarnagar': { greenSpacePct: 16, buildingDensity: 0.55, outdoorWorkerDensity: 0.25 },
  'Admin Ward 14 Dhankawadi': { greenSpacePct: 12, buildingDensity: 0.72, outdoorWorkerDensity: 0.3 },
  'Admin Ward 15 Kondhwa Wanavdi': { greenSpacePct: 13, buildingDensity: 0.65, outdoorWorkerDensity: 0.35 },
};

// ---------------------------------------------------------------------------
// Provenance constants — every vulnerability value must carry one of these.
// ---------------------------------------------------------------------------

const PUNE_CENSUS_PROVENANCE: VulnerabilityProvenance = {
  status: 'Estimated',
  source: 'Census of India 2011 (ward-level demographics) + NFHS-5 + PMC urban-form surveys',
  geography: 'Ward (Pune)',
  methodology:
    'Composite score from ward-level Census demographic proportions and PMC urban-form estimates; no ward-level climate or health measurements.',
};

const PUNE_BASELINE_PROVENANCE: VulnerabilityProvenance = {
  status: 'Baseline',
  source: 'PMC infrastructure surveys and Census 2011 proxies',
  geography: 'Ward (Pune)',
  methodology:
    'Uniform granularity estimates per administrative ward where ward-level Census digitised tables are not keyed by the ward name used at runtime.',
};

/**
 * Single constant for every unsupported city — score 0 with all component
 * variables undefined. This is NOT a zero-vulnerability claim; it means
 * "no defensible baseline exists" and the UI MUST render "Unavailable",
 * never a number.
 */
export const VULNERABILITY_UNAVAILABLE: Vulnerability = {
  score: 0,
  level: 'Low',
  // green_space_pct / building_density / outdoor_worker_density stay undefined
  is_estimated_baseline: false,
  data_source: 'No ward-level vulnerability data available for this city',
  provenance: {
    status: 'Unavailable',
    source: '—',
    geography: '—',
    methodology:
      'No Census-derived ward-level vulnerability dataset is available for this city. Vulnerability contributes no score until a real source is added.',
  },
};

/**
 * Retrieves socio-ecological baseline vulnerability for any ward.
 *
 * Policy (data honesty over fabrication):
 *   - Pune:      real ward-level Census 2011 + PMC urban form (Estimated) or
 *                documented PMC baseline (Baseline).
 *   - Bengaluru: real ward population/area → density proxy (Proxy).
 *   - every other city: VULNERABILITY_UNAVAILABLE — no fabricated per-ward
 *                differences; the UI shows "Unavailable".
 */
export function getWardVulnerability(
  cityId: string,
  wardIdOrName: string
): Vulnerability {
  const normCity = (cityId || '').toLowerCase().trim();
  const normWard = (wardIdOrName || '').trim();

  // 1. Pune — Census-enhanced, else documented PMC baseline
  if (normCity === 'pune') {
    const census = getWardCensusProfile(normWard);
    const raw = PUNE_BASELINE_VULNERABILITY[normWard];

    if (census && raw) {
      const score = computeCensusVulnerabilityScore(census, raw.greenSpacePct, raw.buildingDensity);
      return {
        score,
        level: classifyVulnerabilityLevel(score),
        green_space_pct: raw.greenSpacePct,
        building_density: raw.buildingDensity,
        outdoor_worker_density: raw.outdoorWorkerDensity,
        is_estimated_baseline: false,
        data_source: `Census 2011 (${census.total_population.toLocaleString('en-IN')} pop) + NFHS-5 + PMC Urban Form`,
        provenance: PUNE_CENSUS_PROVENANCE,
        census_population: census.total_population,
        census_elderly_pct: census.elderly_population_pct,
        census_outdoor_workers_pct: census.main_outdoor_workers_pct + census.marginal_outdoor_workers_pct,
        census_slum_pct: census.slum_household_pct,
      } as Vulnerability & {
        census_population: number;
        census_elderly_pct: number;
        census_outdoor_workers_pct: number;
        census_slum_pct: number;
      };
    }

    if (raw) {
      const greenScore = Math.round((1 - raw.greenSpacePct / 25) * 35);
      const densityScore = Math.round(raw.buildingDensity * 30);
      const workerScore = Math.round(raw.outdoorWorkerDensity * 20);
      const score = Math.min(100, Math.max(0, greenScore + densityScore + workerScore + 15));
      return {
        score,
        level: classifyVulnerabilityLevel(score),
        green_space_pct: raw.greenSpacePct,
        building_density: raw.buildingDensity,
        outdoor_worker_density: raw.outdoorWorkerDensity,
        is_estimated_baseline: true,
        data_source: 'PMC Ward Surveys & Census 2011 Proxies (Estimated Baseline)',
        provenance: PUNE_BASELINE_PROVENANCE,
      };
    }
  }

  // 2. Bengaluru — real population-density proxy (no fabricated components)
  if (isBengaluru(normCity)) {
    const bengaluru = getBengaluruWardVulnerability(normWard);
    if (bengaluru) return bengaluru;
    // Ward not found in the genuine lookup → unavailable, never a hash guess.
    const missing: Vulnerability = { ...VULNERABILITY_UNAVAILABLE };
    missing.data_source = `No density record for Bengaluru ward "${normWard || '(blank)'}" — vulnerability unavailable`;
    return missing;
  }

  // 3. All other cities — NO FABRICATED VULNERABILITY. The UI renders this
  //    as "Unavailable", not as a score.
  return VULNERABILITY_UNAVAILABLE;
}

/**
 * Assesses complete multi-factor risk for a ward conforming to PROJECT.md § Interface Contracts
 */
export function assessWardRisk(params: {
  ward_id: string;
  ward_name: string;
  city_id: string;
  temperature: number;
  humidity: number;
  apparentTemperature: number;
  forecast_metadata: ForecastRunMetadata;
  env?: WbgtEnv; // wind+solar context for full-physics WBGT (optional fallback)
}): WardRiskAssessment {
  const thermal = calculateThermalCalculations(
    params.temperature,
    params.humidity,
    params.apparentTemperature,
    params.env
  );

  const vulnerability = getWardVulnerability(params.city_id, params.ward_name || params.ward_id);
  const thermalScore = calculateThermalScore(thermal.heat_index);
  const composite = calculateCompositeRisk(thermalScore, vulnerability.score);

  // Recommendations based on combined thermal and vulnerability factors
  const recommendations: string[] = [];
  if (thermal.thermal_stress === 'Severe' || thermal.thermal_stress === 'High') {
    recommendations.push('Activate municipal shaded cooling shelters and water distribution.');
    recommendations.push('Enforce mandatory rest breaks for construction and outdoor laborers.');
  }
  if (vulnerability.provenance.status !== 'Unavailable' &&
      (vulnerability.level === 'Severe' || vulnerability.level === 'High')) {
    recommendations.push('Prioritize high-vulnerability informal settlements and elderly outreach.');
  }
  if (vulnerability.green_space_pct !== undefined && vulnerability.green_space_pct < 6) {
    recommendations.push('Low vegetation cover intensifies local urban heat island exposure.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Conditions within normal parameters. Continue standard monitoring.');
  }

  return {
    ward_id: params.ward_id,
    ward_name: params.ward_name,
    city_id: params.city_id,
    thermal,
    vulnerability_score: vulnerability.score,
    vulnerability_level: vulnerability.level,
    vulnerability_provenance: vulnerability.provenance,
    composite_risk_score: composite.composite_score,
    composite_risk_level: composite.composite_level,
    forecast_metadata: params.forecast_metadata,
    contributing_factors: composite.contributing_factors,
    recommendations,
  };
}

/**
 * Legacy calculateWardRisk function for backward compatibility with existing routes and pages.
 * Incorporates the corrected / 0.34 scaling.
 */
export function calculateWardRisk(
  wardName: string,
  lon: number,
  lat: number,
  thermalData: { heatIndex: number; wbgt: number; riskLevel: string }
): {
  wardName: string;
  lon: number;
  lat: number;
  currentTemp: number;
  currentHumidity: number;
  heatIndex: number;
  wbgt: number;
  thermalRisk: RiskLevel;
  vulnerabilityScore: number;
  compositeRisk: number;
  compositeRiskLevel: RiskLevel;
  recommendations: string[];
  vulnerabilityGreenPct: number;
  vulnerabilityBuildingDensity: number;
  vulnerabilityWorkerDensity: number;
  updated_at: string;
} {
  const thermalRisk = (thermalData.riskLevel || 'low') as RiskLevel;
  const vulnerability = getWardVulnerability('pune', wardName);

  // Corrected thermal score scaling via the single authoritative implementation.
  const thermalScore = calculateAuthoritativeThermalScore(thermalData.heatIndex);

  // Composite risk via the single authoritative implementation.
  const compositeRisk = calculateAuthoritativeCompositeRiskScore(
    thermalScore,
    vulnerability.score
  );

  const compositeRiskLevel: RiskLevel = compositeLevelToLegacyRisk(
    classifyCompositeRiskLevel(compositeRisk)
  );

  const recommendations: string[] = [];
  if (thermalRisk === 'high' || thermalRisk === 'extreme' || thermalRisk === 'danger') {
    recommendations.push('Activate cooling centers in this ward.');
    recommendations.push('Deploy water and shade stations for outdoor workers.');
  }
  if (vulnerability.score > 60) {
    recommendations.push('High vulnerability — prioritize elderly and low-income residents.');
  }
  if (vulnerability.green_space_pct !== undefined && vulnerability.green_space_pct < 5) {
    recommendations.push('Low green cover — urban heat island effect is elevated.');
  }
  if (recommendations.length === 0) {
    recommendations.push('No immediate action required. Monitor conditions.');
  }

  return {
    wardName,
    lon,
    lat,
    currentTemp: thermalData.heatIndex,
    currentHumidity: 0,
    heatIndex: thermalData.heatIndex,
    wbgt: thermalData.wbgt,
    thermalRisk,
    vulnerabilityScore: vulnerability.score,
    compositeRisk,
    compositeRiskLevel,
    recommendations,
    // calculateWardRisk is Pune-only (wardName always resolves to a real
    // PUNE_BASELINE_VULNERABILITY record), so the optional component fields
    // are always present on this path. No fabricated fallbacks are used.
    vulnerabilityGreenPct: vulnerability.green_space_pct!,
    vulnerabilityBuildingDensity: vulnerability.building_density!,
    vulnerabilityWorkerDensity: vulnerability.outdoor_worker_density!,
    updated_at: new Date().toISOString(),
  };
}

/**
 * WARD_POINTS, getWardPoint and getRiskColor are pure lookups used by client
 * components (TimelineSlider). They live in risk-helpers.ts — a fs-free,
 * client-safe module — and are re-exported here for server-route convenience.
 */
export {
  WARD_POINTS,
  getWardPoint,
  getRiskColor,
} from './risk-helpers';

export { DISABLED_HEALTH_LAYER };
