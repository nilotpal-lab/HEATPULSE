/**
 * HeatPulse — Risk Engine Data Types & Interface Contracts
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 */

import {
  CompositeRisk,
  CompositeRiskLevel,
  RiskLevel,
  ThermalCalculations,
  Vulnerability,
  VulnerabilityLevel,
  WardRiskAssessment,
} from './thermal';
import { ForecastRunMetadata } from './weather';

export type {
  CompositeRisk,
  CompositeRiskLevel,
  RiskLevel,
  ThermalCalculations,
  Vulnerability,
  VulnerabilityLevel,
  WardRiskAssessment,
};

/**
 * Baseline vulnerability indicators per ward
 */
export interface WardVulnerability {
  wardName: string;
  elderlyPopulationPct: number; // % population 65+
  lowIncomeHouseholdsPct: number; // % below poverty line
  outdoorWorkerDensity: number; // relative density (0-1)
  greenSpacePct: number; // % green cover
  buildingDensity: number; // relative density (0-1)
  vulnerabilityScore: number; // 0-100 baseline composite
  riskLevel: RiskLevel;
  isEstimatedBaseline?: boolean;
}

export interface WardRisk {
  wardId?: string;
  ward_id?: string;
  wardName: string;
  ward_name?: string;
  lon: number;
  lat: number;
  currentTemp: number;
  currentHumidity: number;
  heatIndex: number;
  wbgt: number;
  heatCondition?: 'Normal' | 'Elevated' | 'High' | 'Extreme' | string;
  heat_condition?: 'Normal' | 'Elevated' | 'High' | 'Extreme' | string;
  thermalStress?: 'Low' | 'Moderate' | 'High' | 'Severe' | string;
  thermal_stress?: 'Low' | 'Moderate' | 'High' | 'Severe' | string;
  thermalRisk: RiskLevel;
  vulnerabilityScore: number;
  compositeRisk: number; // 0-100
  compositeRiskLevel: RiskLevel;
  recommendations: string[];
  /** Component values are present ONLY when ward-level vulnerability data
   *  exists. Absent = unavailable (not zero). */
  vulnerabilityGreenPct?: number;
  vulnerabilityBuildingDensity?: number;
  vulnerabilityWorkerDensity?: number;
  /** Provenance of the vulnerability score; status 'Unavailable' means score is 0. */
  vulnerability_provenance?: {
    status: string;
    source: string;
    geography?: string;
    methodology?: string;
  };
  updated_at: string;
}

/**
 * City-wide multi-ward risk assessment summary
 */
export interface CityRiskSummary {
  city_id: string;
  forecast_metadata: ForecastRunMetadata;
  wards: WardRiskAssessment[];
  summary: {
    max_risk: number;
    min_risk: number;
    avg_risk: number;
    severe_count: number;
    high_count: number;
    moderate_count: number;
    low_count: number;
    peak_ward: {
      ward_id: string;
      ward_name: string;
      composite_risk_score: number;
      heat_index: number;
    } | null;
  };
}
