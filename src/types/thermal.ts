/**
 * HeatPulse — Thermal Biometeorology & Scientific Concept Types
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 * 
 * Strict 5-Concept Scientific Segregation:
 *   1. HeatCondition: Atmospheric physical state (Normal, Elevated, High, Extreme)
 *   2. ThermalStress: Human biometeorological response (Low, Moderate, High, Severe)
 *   3. Vulnerability: Socio-ecological baseline context (Low, Moderate, High, Severe)
 *   4. CompositeRisk: Thermal-Vulnerability integrated exposure (Low, Moderate, High, Severe)
 *   5. HealthImpact: Epidemiological clinical outcomes — strictly disabled pending validated model
 */

import { ForecastRunMetadata } from './weather';

// ============================================================================
// CONCEPT 1: Heat Condition (Physical Atmospheric State)
// ============================================================================
export type HeatConditionLevel = 'Normal' | 'Elevated' | 'High' | 'Extreme';

export interface HeatCondition {
  level: HeatConditionLevel;
  temperature_2m: number; // dry-bulb air temperature in °C
  threshold_description: string;
  is_extreme: boolean;
}

// ============================================================================
// CONCEPT 2: Thermal Stress (Human Biometeorological Physiological Strain)
// ============================================================================
export type ThermalStressLevel = 'Low' | 'Moderate' | 'High' | 'Severe';

export interface ThermalStress {
  level: ThermalStressLevel;
  heat_index: number; // NOAA Rothfusz (°C) with low/high humidity adjustments
  wbgt: number; // BoM simplified outdoor WBGT (°C)
  utci_proxy: number; // Apparent temperature (°C) designated as UTCI Proxy
  physiological_category: string;
  recommendations: string[];
}

export interface ThermalCalculations {
  heat_index: number; // NOAA Rothfusz °C with adjustments
  wbgt: number; // Full Liljegren (wind+solar) when env present, else BoM outdoor shade °C
  wbgt_method: 'liljegren-full' | 'bom-simplified'; // provenance of wbgt
  utci_proxy: number; // Apparent temperature °C (UTCI Proxy)
  heat_condition: HeatConditionLevel;
  thermal_stress: ThermalStressLevel;
}

// Legacy-compatible thermal readings structure
export interface ThermalReadings {
  temperature: number;
  humidity: number;
  apparent_temperature: number;
  heat_index: number;
  wbgt_estimated: number;
  wbgt_method?: 'liljegren-full' | 'bom-simplified'; // provenance of wbgt_estimated
  utci_proxy: number; // Transparent UTCI Proxy biometeorological labeling
  utc_index?: number; // Legacy field alias for backward compatibility (UTCI Proxy)
  risk_level: RiskLevel; // Legacy risk level string
  risk_label: string;
  heat_condition: HeatConditionLevel;
  thermal_stress: ThermalStressLevel;
  recommendations: string[];
  calculated_at: string;
}

// Legacy risk levels for existing UI components
export type RiskLevel = 'low' | 'moderate' | 'high' | 'extreme' | 'danger';

// ============================================================================
// CONCEPT 3: Vulnerability (Socio-Ecological Baseline Context)
// ============================================================================
export type VulnerabilityLevel = 'Low' | 'Moderate' | 'High' | 'Severe';

/**
 * Provenance classification for every vulnerability value surfaced in the UI.
 * - Observed:  directly measured at ward level
 * - Official:  published government statistic at the stated geography
 * - Estimated: derived/seeded from official statistics via documented assumptions
 * - Proxy:     derived from a genuine input via a transparent approximation
 * - Baseline:  uniform city-level constant where no ward-level data exists
 * - Unavailable: no defensible value; UI must show unavailable, never a number
 */
export type VulnerabilityProvenanceStatus =
  | 'Observed'
  | 'Official'
  | 'Estimated'
  | 'Proxy'
  | 'Baseline'
  | 'Unavailable';

export interface VulnerabilityProvenance {
  status: VulnerabilityProvenanceStatus;
  /** Named dataset or table the value derives from. */
  source: string;
  source_year?: number;
  /** Geography the underlying data actually resolves to (e.g. 'Ward (Pune)'). */
  geography: string;
  /** How the score/variables were computed from the source. */
  methodology: string;
}

export interface Vulnerability {
  score: number; // 0-100 baseline composite
  level: VulnerabilityLevel;
  // Component variables — present ONLY when the underlying dataset actually
  // supports them. Undefined means "no ward-level data"; UI shows unavailable.
  green_space_pct?: number;
  building_density?: number; // 0-1 relative density
  outdoor_worker_density?: number; // 0-1 relative density
  is_estimated_baseline: boolean;
  data_source: string;
  provenance: VulnerabilityProvenance;
}

// ============================================================================
// CONCEPT 4: Composite Risk (Thermal-Vulnerability Integrated Heuristic)
// ============================================================================
export type CompositeRiskLevel = 'Low' | 'Moderate' | 'High' | 'Severe';

export interface CompositeRisk {
  composite_score: number; // 0-100: alpha * thermalScore + beta * vulnerabilityScore
  composite_level: CompositeRiskLevel;
  thermal_score: number; // 0-100 scaled via (HI - 20) / 0.34
  vulnerability_score: number; // 0-100
  alpha: number; // 0.6 thermal weight
  beta: number; // 0.4 vulnerability weight
  contributing_factors: {
    atmospheric_pct: number;
    vulnerability_pct: number;
    primary_driver: string;
  };
}

export interface WardRiskAssessment {
  ward_id: string;
  ward_name: string;
  city_id: string;
  thermal: ThermalCalculations;
  vulnerability_score: number; // 0-100 (Census baseline); 0 when provenance is Unavailable
  vulnerability_level: VulnerabilityLevel;
  /** Proves the vulnerability figures; status Unavailable means score is 0. */
  vulnerability_provenance: VulnerabilityProvenance;
  composite_risk_score: number; // 0-100: (0.6 * thermalScore) + (0.4 * vulnerabilityScore)
  composite_risk_level: CompositeRiskLevel;
  forecast_metadata: ForecastRunMetadata;
  contributing_factors: {
    atmospheric_pct: number; // 60% weight contribution
    vulnerability_pct: number; // 40% weight contribution
    primary_driver: string;
  };
  recommendations: string[];
}

// ============================================================================
// CONCEPT 5: Health Impact (Epidemiological Clinical Outcomes — STRICTLY DISABLED)
// ============================================================================
export type HealthImpactStatus = 'disabled';

export interface HealthImpact {
  status: HealthImpactStatus;
  badge: 'Coming with validated health-outcome model';
  notice: string;
  is_active: false;
  synthetic_mortality_figures: null;
  synthetic_hospitalization_figures: null;
}

/**
 * Disabled Health Layer constant with mandatory compliance copy
 */
export const DISABLED_HEALTH_LAYER: HealthImpact = {
  status: 'disabled',
  badge: 'Coming with validated health-outcome model',
  notice:
    'Epidemiological health outcome and casualty attribution models are strictly disabled pending validated peer-reviewed clinical calibration. HeatPulse presents zero synthetic mortality or hospitalization figures.',
  is_active: false,
  synthetic_mortality_figures: null,
  synthetic_hospitalization_figures: null,
};
