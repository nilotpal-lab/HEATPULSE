/**
 * HeatPulse — Single Source of Truth for Classification Thresholds
 * SIH26083 MoES / NCMRWF
 *
 * Every classification, map color band, legend label, alert level, and
 * relative-risk band in the application MUST be derived from this file.
 * No other module may define its own numeric thresholds for these concepts.
 *
 * Concept definitions and threshold rationale:
 *
 * HEAT CONDITIONS (atmospheric physical state, dry-bulb 2m temperature):
 *   Normal    < 35°C  — no atmospheric heat anomaly
 *   Elevated  35–40°C — elevated ambient heat
 *   High      40–45°C — high ambient heat (IMD heatwave-day range begins at 40°C plains)
 *   Extreme   ≥ 45°C  — extreme ambient heat (IMD severe heatwave absolute criterion)
 *
 * THERMAL STRESS (human biometeorology; NOAA Heat Index and BoM simplified
 * outdoor WBGT estimate — dual criteria, most severe wins):
 *   Low       WBGT < 28°C and HI < 27°C
 *   Moderate  WBGT ≥ 28°C or HI ≥ 27°C
 *   High      WBGT ≥ 30°C or HI ≥ 32°C
 *   Severe    WBGT ≥ 32°C or HI ≥ 41°C
 *   (WBGT bands follow standard occupational heat-stress screening bands;
 *    HI bands follow NOAA NWS danger categories.)
 *
 * COMPOSITE RISK (heuristic decision-support index, 0–100):
 *   Low < 30 · Moderate 30–50 · High 50–70 · Severe ≥ 70
 *
 * VULNERABILITY (socio-ecological baseline score, 0–100):
 *   Low < 30 · Moderate 30–50 · High 50–70 · Severe ≥ 70
 *
 * RELATIVE RISK ESTIMATE (non-clinical biometeorological proxy, see
 * calculateRelativeRisk below): Baseline < 1.15 · Elevated 1.15–1.30 ·
 * High 1.30–1.50 · Critical ≥ 1.50.
 *
 * ALERT LEVELS (HeatPulse localized advisories — not official IMD bulletins):
 *   watch:    HI ≥ 27 or composite ≥ 50
 *   warning:  HI ≥ 32 or WBGT ≥ 28
 *   critical: HI ≥ 41 or WBGT ≥ 32
 */

import type {
  CompositeRiskLevel,
  HeatConditionLevel,
  RiskLevel,
  ThermalStressLevel,
  VulnerabilityLevel,
} from '../types/thermal';

// ============================================================================
// Band definitions (single authoritative copy of every numeric threshold)
// ============================================================================

export const HEAT_CONDITION_THRESHOLDS = {
  elevated: 35,
  high: 40,
  extreme: 45,
} as const;

export const THERMAL_STRESS_THRESHOLDS = {
  moderateWbgt: 28,
  moderateHi: 27,
  highWbgt: 30,
  highHi: 32,
  severeWbgt: 32,
  severeHi: 41,
} as const;

export const COMPOSITE_RISK_THRESHOLDS = {
  moderate: 30,
  high: 50,
  severe: 70,
} as const;

export const VULNERABILITY_THRESHOLDS = {
  moderate: 30,
  high: 50,
  severe: 70,
} as const;

export const RELATIVE_RISK_THRESHOLDS = {
  onsetWbgt: 28, // WBGT above this adds excess-risk terms
  perDegreeWbgt: 0.12, // RR added per °C WBGT above onset
  vulnerabilityTerm: 0.15, // RR added at vulnerability score 100
  elevated: 1.15,
  high: 1.3,
  critical: 1.5,
} as const;

export const ALERT_THRESHOLDS = {
  watchHi: 27,
  warningHi: 32,
  warningWbgt: 28,
  criticalHi: 41,
  criticalWbgt: 32,
  compositeWatch: 50,
} as const;

/** Composite-risk weights: thermal exposure vs baseline vulnerability. */
export const RISK_WEIGHTS = { alpha: 0.6, beta: 0.4 } as const;

// ============================================================================
// Classification functions (consumed everywhere; never reimplemented)
// ============================================================================

/** Classifies dry-bulb 2m temperature into atmospheric Heat Conditions. */
export function classifyHeatCondition(tempC: number): HeatConditionLevel {
  if (tempC >= HEAT_CONDITION_THRESHOLDS.extreme) return 'Extreme';
  if (tempC >= HEAT_CONDITION_THRESHOLDS.high) return 'High';
  if (tempC >= HEAT_CONDITION_THRESHOLDS.elevated) return 'Elevated';
  return 'Normal';
}

/** Classifies human biometeorological Thermal Stress from HI (and WBGT when available). */
export function classifyThermalStress(heatIndex?: number, wbgt?: number): ThermalStressLevel {
  const t = THERMAL_STRESS_THRESHOLDS;
  const hi = heatIndex ?? 0;
  if (wbgt !== undefined) {
    if (wbgt >= t.severeWbgt || hi >= t.severeHi) return 'Severe';
    if (wbgt >= t.highWbgt || hi >= t.highHi) return 'High';
    if (wbgt >= t.moderateWbgt || hi >= t.moderateHi) return 'Moderate';
    return 'Low';
  }
  if (hi >= t.severeHi) return 'Severe';
  if (hi >= t.highHi) return 'High';
  if (hi >= t.moderateHi) return 'Moderate';
  return 'Low';
}

/** Classifies composite risk score (0–100). */
export function classifyCompositeRiskLevel(score: number): CompositeRiskLevel {
  if (score >= COMPOSITE_RISK_THRESHOLDS.severe) return 'Severe';
  if (score >= COMPOSITE_RISK_THRESHOLDS.high) return 'High';
  if (score >= COMPOSITE_RISK_THRESHOLDS.moderate) return 'Moderate';
  return 'Low';
}

/** Classifies vulnerability score (0–100). */
export function classifyVulnerabilityLevel(score: number): VulnerabilityLevel {
  if (score >= VULNERABILITY_THRESHOLDS.severe) return 'Severe';
  if (score >= VULNERABILITY_THRESHOLDS.high) return 'High';
  if (score >= VULNERABILITY_THRESHOLDS.moderate) return 'Moderate';
  return 'Low';
}

/** Maps a CompositeRiskLevel to the legacy UI RiskLevel vocabulary. */
export function compositeLevelToLegacyRisk(level: CompositeRiskLevel): RiskLevel {
  switch (level) {
    case 'Severe':
      return 'extreme';
    case 'High':
      return 'high';
    case 'Moderate':
      return 'moderate';
    default:
      return 'low';
  }
}

// ============================================================================
// Risk score math (single authoritative implementation)
// ============================================================================

/**
 * Normalized thermal score (0–100): linear mapping of NOAA Heat Index across
 * the 20°C (baseline) to 54°C (NOAA extreme danger) span.
 */
export function calculateThermalScore(heatIndex: number): number {
  if (heatIndex <= 20) return 0;
  const score = (heatIndex - 20) / 0.34;
  return Math.min(100, Math.max(0, Math.round(score * 10) / 10));
}

/**
 * Composite heuristic risk: alpha·thermal + beta·vulnerability, clipped 0–100.
 * This is a transparent weighted-sum decision-support heuristic — NOT an
 * epidemiological or machine-learning model.
 */
export function calculateCompositeRiskScore(
  thermalScore: number,
  vulnerabilityScore: number
): number {
  const raw =
    RISK_WEIGHTS.alpha * thermalScore + RISK_WEIGHTS.beta * vulnerabilityScore;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

// ============================================================================
// Relative Risk Estimate (single authoritative implementation)
// ============================================================================

export type RelativeRiskBand = 'Baseline' | 'Elevated' | 'High' | 'Critical';

export interface RelativeRiskEstimate {
  /** Multiplicative risk ratio vs baseline (1.0 = baseline). */
  rr: number;
  band: RelativeRiskBand;
  /** Excess risk percentage above baseline, rounded to integer. */
  excessPct: number;
}

/**
 * Relative Risk Estimate — a NON-CLINICAL biometeorological proxy:
 *
 *   RR = 1 + max(0, WBGT − 28)·0.12 + (vulnerability/100)·0.15
 *
 * It linearly scales excess heat-stress exposure and baseline vulnerability
 * into a relative-risk ratio. It is NOT calibrated on observed mortality or
 * hospitalization data and is NOT a clinical outcome prediction.
 */
export function calculateRelativeRisk(wbgt?: number, vulnerabilityScore?: number): RelativeRiskEstimate {
  const rr = RELATIVE_RISK_THRESHOLDS;
  const w = wbgt ?? 0;
  const vuln = vulnerabilityScore ?? 0;
  const excessWbgt = Math.max(0, w - rr.onsetWbgt);
  const value = 1 + excessWbgt * rr.perDegreeWbgt + (vuln / 100) * rr.vulnerabilityTerm;
  const rounded = Math.round(value * 100) / 100;

  let band: RelativeRiskBand = 'Baseline';
  if (rounded >= rr.critical) band = 'Critical';
  else if (rounded >= rr.high) band = 'High';
  else if (rounded >= rr.elevated) band = 'Elevated';

  return { rr: rounded, band, excessPct: Math.round((rounded - 1) * 100) };
}
