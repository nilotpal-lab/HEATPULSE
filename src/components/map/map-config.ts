/**
 * HeatPulse — Map Configuration, Unified Classification Engine & Dynamic Legends
 * Conforms to Requirement R2, R3, R8 & PROJECT.md § Basemap Engine & Visual Hierarchy
 *
 * Harmonizes thresholds across all thematic layers:
 * 1. Heat Conditions: Dry-bulb ambient temperature (Normal <32°C, Elevated 32–40°C, High 41–53°C, Extreme ≥54°C)
 * 2. Thermal Stress: Biometeorological WBGT / Heat Index (Low <28°C, Moderate 28–30°C, High 30–32°C, Severe ≥32°C)
 * 3. Health Impact: Epidemiological Relative Risk proxy (Baseline <1.15, Elevated 1.15–1.30, High 1.30–1.50, Critical ≥1.50)
 * 4. Composite Risk: Multi-criteria decision support index (Low, Moderate, High, Extreme, Critical)
 */

import {
  type ThematicLayerType,
  type WardRisk,
} from '@/lib/map-config';

// Re-export all existing map and GIS primitives from @/lib/map-config for seamless compatibility
export * from '@/lib/map-config';

export interface ThresholdItem {
  key: string;
  label: string;
  fill: string;
  stroke: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  desc: string;
  min?: number;
  max?: number;
  rangeText: string;
}

export interface ThematicLayerConfig {
  id: ThematicLayerType;
  title: string;
  metricLabel: string;
  unit: string;
  subtitle?: string;
  disclaimer?: string;
  disabledNotice?: string;
  items: ThresholdItem[];
}

/**
 * Authoritative, harmonized thematic layer configurations and thresholds.
 * Used identically by OpenLayers dynamic style functions and MapLegend UI.
 */
export const THEMATIC_LAYER_CONFIGS: Record<ThematicLayerType, ThematicLayerConfig> = {
  heat_conditions: {
    id: 'heat_conditions',
    title: 'Heat Conditions',
    metricLabel: 'Temperature',
    unit: '°C',
    subtitle: 'Atmospheric State',
    items: [
      {
        key: 'Normal',
        label: 'Normal (<32°C)',
        rangeText: '<32°C',
        fill: 'rgba(59, 130, 246, 0.45)',
        stroke: '#2563eb',
        badgeBg: 'bg-blue-50',
        badgeText: 'text-blue-700',
        badgeBorder: 'border-blue-200',
        desc: 'No advisory',
        max: 32,
      },
      {
        key: 'Elevated',
        label: 'Elevated (32–40°C)',
        rangeText: '32–40°C',
        fill: 'rgba(234, 179, 8, 0.45)',
        stroke: '#ca8a04',
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-800',
        badgeBorder: 'border-amber-300',
        desc: 'Caution',
        min: 32,
        max: 41,
      },
      {
        key: 'High',
        label: 'High (41–53°C)',
        rangeText: '41–53°C',
        fill: 'rgba(249, 115, 22, 0.48)',
        stroke: '#ea580c',
        badgeBg: 'bg-orange-100',
        badgeText: 'text-orange-800',
        badgeBorder: 'border-orange-300',
        desc: 'Extreme Caution',
        min: 41,
        max: 54,
      },
      {
        key: 'Extreme',
        label: 'Extreme (≥54°C)',
        rangeText: '≥54°C',
        fill: 'rgba(220, 38, 38, 0.52)',
        stroke: '#b91c1c',
        badgeBg: 'bg-red-100',
        badgeText: 'text-red-800',
        badgeBorder: 'border-red-300',
        desc: 'Danger',
        min: 54,
      },
    ],
  },
  thermal_stress: {
    id: 'thermal_stress',
    title: 'Thermal Stress (WBGT)',
    metricLabel: 'WBGT Stress',
    unit: '°C',
    subtitle: 'Human Biometeorology',
    items: [
      {
        key: 'Low',
        label: 'Low (<28°C WBGT)',
        rangeText: '<28°C WBGT',
        fill: 'rgba(34, 197, 94, 0.45)',
        stroke: '#16a34a',
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-700',
        badgeBorder: 'border-emerald-200',
        desc: 'Safe',
        max: 28,
      },
      {
        key: 'Moderate',
        label: 'Moderate (28–30°C WBGT)',
        rangeText: '28–30°C WBGT',
        fill: 'rgba(250, 204, 21, 0.45)',
        stroke: '#eab308',
        badgeBg: 'bg-yellow-100',
        badgeText: 'text-yellow-800',
        badgeBorder: 'border-yellow-300',
        desc: 'Moderate Stress',
        min: 28,
        max: 30,
      },
      {
        key: 'High',
        label: 'High (30–32°C WBGT)',
        rangeText: '30–32°C WBGT',
        fill: 'rgba(234, 88, 12, 0.48)',
        stroke: '#c2410c',
        badgeBg: 'bg-orange-100',
        badgeText: 'text-orange-800',
        badgeBorder: 'border-orange-300',
        desc: 'High Stress',
        min: 30,
        max: 32,
      },
      {
        key: 'Severe',
        label: 'Severe (≥32°C WBGT)',
        rangeText: '≥32°C WBGT',
        fill: 'rgba(153, 27, 27, 0.55)',
        stroke: '#7f1d1d',
        badgeBg: 'bg-rose-100',
        badgeText: 'text-rose-900',
        badgeBorder: 'border-rose-300',
        desc: 'Severe Hazard',
        min: 32,
      },
    ],
  },
  health_impact: {
    id: 'health_impact',
    title: 'Health Impact',
    metricLabel: 'Relative Risk (RR)',
    unit: 'RR',
    subtitle: 'Relative Risk Estimate',
    disclaimer: 'Biometeorological hazard proxy — not a clinical outcome prediction',
    disabledNotice: 'Layer Disabled: Coming with validated health-outcome model (No synthetic data)',
    items: [
      {
        key: 'Baseline',
        label: 'Baseline Load (RR < 1.15)',
        rangeText: 'RR < 1.15',
        fill: 'rgba(34, 197, 94, 0.45)',
        stroke: '#16a34a',
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-700',
        badgeBorder: 'border-emerald-200',
        desc: 'Baseline Risk',
        max: 1.15,
      },
      {
        key: 'Elevated',
        label: 'Elevated Burden (RR 1.15–1.30)',
        rangeText: 'RR 1.15–1.30',
        fill: 'rgba(250, 204, 21, 0.48)',
        stroke: '#eab308',
        badgeBg: 'bg-yellow-100',
        badgeText: 'text-yellow-800',
        badgeBorder: 'border-yellow-300',
        desc: 'Elevated Risk',
        min: 1.15,
        max: 1.3,
      },
      {
        key: 'High',
        label: 'High Hazard (RR 1.30–1.50)',
        rangeText: 'RR 1.30–1.50',
        fill: 'rgba(234, 88, 12, 0.52)',
        stroke: '#c2410c',
        badgeBg: 'bg-orange-100',
        badgeText: 'text-orange-800',
        badgeBorder: 'border-orange-300',
        desc: 'High Risk',
        min: 1.3,
        max: 1.5,
      },
      {
        key: 'Critical',
        label: 'Critical Hazard (RR ≥ 1.50)',
        rangeText: 'RR ≥ 1.50',
        fill: 'rgba(153, 27, 27, 0.60)',
        stroke: '#7f1d1d',
        badgeBg: 'bg-rose-100',
        badgeText: 'text-rose-900',
        badgeBorder: 'border-rose-300',
        desc: 'Critical Risk',
        min: 1.5,
      },
    ],
  },
  composite_risk: {
    id: 'composite_risk',
    title: 'Composite Risk',
    metricLabel: 'Composite Risk',
    unit: 'Score',
    subtitle: 'Decision Support Index',
    items: [
      {
        key: 'low',
        label: 'Low Risk',
        rangeText: '0–30',
        fill: 'rgba(34, 197, 94, 0.40)',
        stroke: '#16a34a',
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-700',
        badgeBorder: 'border-emerald-200',
        desc: 'LOW',
        max: 30,
      },
      {
        key: 'moderate',
        label: 'Moderate Risk',
        rangeText: '30–50',
        fill: 'rgba(59, 130, 246, 0.40)',
        stroke: '#2563eb',
        badgeBg: 'bg-blue-50',
        badgeText: 'text-blue-700',
        badgeBorder: 'border-blue-200',
        desc: 'MODERATE',
        min: 30,
        max: 50,
      },
      {
        key: 'high',
        label: 'High Risk',
        rangeText: '50–70',
        fill: 'rgba(245, 158, 11, 0.45)',
        stroke: '#d97706',
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-800',
        badgeBorder: 'border-amber-200',
        desc: 'HIGH',
        min: 50,
        max: 70,
      },
      {
        key: 'extreme',
        label: 'Extreme Risk',
        rangeText: '70–85',
        fill: 'rgba(234, 88, 12, 0.50)',
        stroke: '#ea580c',
        badgeBg: 'bg-orange-100',
        badgeText: 'text-orange-800',
        badgeBorder: 'border-orange-300',
        desc: 'EXTREME',
        min: 70,
        max: 85,
      },
      {
        key: 'danger',
        label: 'Critical Risk',
        rangeText: '85–100',
        fill: 'rgba(220, 38, 38, 0.55)',
        stroke: '#dc2626',
        badgeBg: 'bg-red-100',
        badgeText: 'text-red-800',
        badgeBorder: 'border-red-300',
        desc: 'CRITICAL',
        min: 85,
      },
    ],
  },
};

/**
 * Returns the layer legend configuration for any active thematic layer.
 */
export function getLayerLegendConfig(layer: ThematicLayerType): ThematicLayerConfig {
  return THEMATIC_LAYER_CONFIGS[layer] || THEMATIC_LAYER_CONFIGS.heat_conditions;
}

/**
 * Classifies ambient dry-bulb temperature into harmonized Heat Conditions.
 */
export function classifyHeatConditionValue(temp?: number, heatIndex?: number): ThresholdItem {
  const cfg = THEMATIC_LAYER_CONFIGS.heat_conditions;
  const t = temp ?? heatIndex ?? 0;
  if (t >= 54) return cfg.items[3]; // Extreme
  if (t >= 41) return cfg.items[2]; // High
  if (t >= 32) return cfg.items[1]; // Elevated
  return cfg.items[0]; // Normal
}

/**
 * Classifies biometeorological WBGT and NOAA Heat Index into harmonized Thermal Stress.
 */
export function classifyThermalStressValue(wbgt?: number, heatIndex?: number): ThresholdItem {
  const cfg = THEMATIC_LAYER_CONFIGS.thermal_stress;
  const w = wbgt ?? 0;
  const hi = heatIndex ?? 0;
  if (w >= 32 || hi >= 41) return cfg.items[3]; // Severe
  if (w >= 30 || hi >= 32) return cfg.items[2]; // High
  if (w >= 28 || hi >= 27) return cfg.items[1]; // Moderate
  return cfg.items[0]; // Low
}

/**
 * Calculates Relative Risk proxy from WBGT and baseline vulnerability.
 * Formulation: RR = 1.0 + max(0, wbgt - 27.0)*0.12 + (vuln / 100)*0.15
 */
export function calculateRelativeRiskProxy(wbgt?: number, vulnScore?: number): {
  rr: number;
  item: ThresholdItem;
} {
  const cfg = THEMATIC_LAYER_CONFIGS.health_impact;
  const w = wbgt ?? 28;
  const vuln = vulnScore ?? 50;
  const excessWbgt = Math.max(0, w - 27.0);
  const rr = Number((1.0 + excessWbgt * 0.12 + (vuln / 100) * 0.15).toFixed(2));

  if (rr >= 1.5 || w >= 32) return { rr, item: cfg.items[3] }; // Critical
  if (rr >= 1.3 || w >= 30) return { rr, item: cfg.items[2] }; // High
  if (rr >= 1.15 || w >= 28) return { rr, item: cfg.items[1] }; // Elevated
  return { rr, item: cfg.items[0] }; // Baseline
}

/**
 * Resolves styling colors for a ward based on active thematic layer and ward risk data.
 * Zero fallback to static defaults when valid data is present.
 */
export function getWardThematicColor(
  activeLayer: ThematicLayerType,
  wardRisk?: WardRisk
): { fill: string; stroke: string } {
  if (!wardRisk) {
    return { fill: 'rgba(148, 163, 184, 0.35)', stroke: 'rgba(255, 255, 255, 0.85)' };
  }

  if (activeLayer === 'heat_conditions') {
    const cond = wardRisk.heatCondition || wardRisk.heat_condition;
    let item: ThresholdItem;
    if (cond) {
      const found = THEMATIC_LAYER_CONFIGS.heat_conditions.items.find(
        (i) => i.key.toLowerCase() === cond!.toLowerCase()
      );
      item = found || classifyHeatConditionValue(wardRisk.currentTemp, wardRisk.heatIndex);
    } else {
      item = classifyHeatConditionValue(wardRisk.currentTemp, wardRisk.heatIndex);
    }
    return { fill: item.fill, stroke: item.stroke };
  }

  if (activeLayer === 'thermal_stress') {
    const stress = wardRisk.thermalStress || wardRisk.thermal_stress;
    let item: ThresholdItem;
    if (stress) {
      const found = THEMATIC_LAYER_CONFIGS.thermal_stress.items.find(
        (i) => i.key.toLowerCase() === stress!.toLowerCase()
      );
      item = found || classifyThermalStressValue(wardRisk.wbgt, wardRisk.heatIndex);
    } else {
      item = classifyThermalStressValue(wardRisk.wbgt, wardRisk.heatIndex);
    }
    return { fill: item.fill, stroke: item.stroke };
  }

  if (activeLayer === 'health_impact') {
    const { item } = calculateRelativeRiskProxy(wardRisk.wbgt, wardRisk.vulnerabilityScore);
    return { fill: item.fill, stroke: item.stroke };
  }

  // Composite risk mode
  const rawRisk = String(
    wardRisk.compositeRiskLevel || wardRisk.composite_risk_level || 'low'
  ).toLowerCase();
  const found = THEMATIC_LAYER_CONFIGS.composite_risk.items.find(
    (i) => i.key.toLowerCase() === rawRisk
  );
  const item = found || THEMATIC_LAYER_CONFIGS.composite_risk.items[0];
  return { fill: item.fill, stroke: item.stroke };
}
