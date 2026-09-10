/**
 * HeatPulse — Automated Public Health Advisory Generator
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 *
 * Generates structured, per-alert-grade public health advisories based on
 * biometeorological thermal stress indices and ward vulnerability profiles.
 *
 * Advisory Grades:
 *   - Green  (Normal):    HI < 27°C, WBGT < 28°C
 *   - Yellow (Elevated):  HI 27–32°C or WBGT 28–30°C
 *   - Orange (High):      HI 32–41°C or WBGT 30–32°C
 *   - Red    (Severe):    HI >= 41°C or WBGT >= 32°C
 *
 * Each advisory tier provides:
 *   1. Public messaging (plain language, multiple languages planned)
 *   2. Vulnerable population guidance (elderly, children, outdoor workers)
 *   3. Municipal action triggers (cooling centres, work-hour adjustments)
 *   4. Healthcare system preparedness level
 *
 * Strictly segregated from official IMD district warnings.
 * Zero synthetic health-outcome or mortality figures.
 */

import type { ThermalStressLevel, VulnerabilityLevel } from '../types/thermal';
import {
  THERMAL_STRESS_THRESHOLDS,
  COMPOSITE_RISK_THRESHOLDS,
} from './threshold-config';

// ============================================================================
// Advisory Types
// ============================================================================

export type AdvisoryGrade = 'green' | 'yellow' | 'orange' | 'red';

export interface MunicipalAction {
  action_id: string;
  category: 'cooling_centre' | 'work_hour' | 'water_supply' | 'healthcare' | 'education' | 'transport';
  title: string;
  description: string;
  urgency: 'routine' | 'elevated' | 'urgent' | 'emergency';
  target_audience: string[];
}

export interface PublicAdvisory {
  grade: AdvisoryGrade;
  grade_label: string;
  headline: string;
  summary: string;
  public_guidance: string[];
  vulnerable_population_guidance: string[];
  municipal_actions: MunicipalAction[];
  healthcare_preparedness: {
    level: string;
    description: string;
    required_readiness: string[];
  };
  valid_from: string;
  valid_until: string;
  generated_at: string;
  attribution: string;
}

// ============================================================================
// Advisory Grade Classification
// ============================================================================

/**
 * Classifies composite thermal-vulnerability state into an advisory grade.
 * Uses the more severe of thermal-stress-derived and risk-derived grades.
 */
export function classifyAdvisoryGrade(
  heatIndex: number,
  wbgt: number,
  compositeRiskScore: number,
  thermalStress: ThermalStressLevel,
  vulnerabilityLevel: VulnerabilityLevel
): AdvisoryGrade {
  // Thermal-derived grade — thresholds mirror threshold-config (single source).
  let thermalGrade: AdvisoryGrade;
  if (heatIndex >= THERMAL_STRESS_THRESHOLDS.severeHi || wbgt >= THERMAL_STRESS_THRESHOLDS.severeWbgt) {
    thermalGrade = 'red';
  } else if (heatIndex >= THERMAL_STRESS_THRESHOLDS.highHi || wbgt >= THERMAL_STRESS_THRESHOLDS.highWbgt) {
    thermalGrade = 'orange';
  } else if (heatIndex >= THERMAL_STRESS_THRESHOLDS.moderateHi || wbgt >= THERMAL_STRESS_THRESHOLDS.moderateWbgt) {
    thermalGrade = 'yellow';
  } else {
    thermalGrade = 'green';
  }

  // Risk-derived grade (thermal + vulnerability composite)
  let riskGrade: AdvisoryGrade;
  if (compositeRiskScore >= COMPOSITE_RISK_THRESHOLDS.severe) {
    riskGrade = 'red';
  } else if (compositeRiskScore >= COMPOSITE_RISK_THRESHOLDS.high) {
    riskGrade = 'orange';
  } else if (compositeRiskScore >= COMPOSITE_RISK_THRESHOLDS.moderate) {
    riskGrade = 'yellow';
  } else {
    riskGrade = 'green';
  }

  // Vulnerability escalation: high vulnerability + any thermal stress bumps grade up
  const gradeRank: Record<AdvisoryGrade, number> = { green: 0, yellow: 1, orange: 2, red: 3 };
  const maxGrade = gradeRank[thermalGrade] >= gradeRank[riskGrade] ? thermalGrade : riskGrade;

  // Vulnerability modifier: Severe vulnerability escalates yellow to orange
  if (vulnerabilityLevel === 'Severe' && maxGrade === 'yellow') {
    return 'orange';
  }

  return maxGrade;
}

// ============================================================================
// Advisory Content Templates
// ============================================================================

const GRADE_CONFIG: Record<AdvisoryGrade, {
  label: string;
  headlineTemplate: string;
  summary: string;
  publicGuidance: string[];
  vulnerableGuidance: string[];
  municipalActions: Omit<MunicipalAction, 'action_id'>[];
  healthcare: { level: string; description: string; readiness: string[] };
}> = {
  green: {
    label: 'Normal',
    headlineTemplate: 'Thermal Conditions Normal — No Heat Stress Advisory',
    summary: 'Atmospheric and biometeorological conditions are within normal parameters. No physiological heat stress risk for the general population.',
    publicGuidance: [
      'Normal outdoor activities are safe for all age groups.',
      'Maintain regular hydration as a standard practice.',
      'Continue monitoring daily weather updates.',
    ],
    vulnerableGuidance: [
      'Standard care for elderly and chronically ill individuals.',
      'Outdoor workers may proceed with regular schedules.',
    ],
    municipalActions: [
      {
        category: 'healthcare',
        title: 'Routine Monitoring',
        description: 'No emergency activation required. Maintain standard heat-response readiness.',
        urgency: 'routine',
        target_audience: ['Municipal Health Officer', 'Ward Medical Officer'],
      },
    ],
    healthcare: {
      level: 'Normal',
      description: 'Standard emergency department staffing. No heat-specific surge preparation required.',
      readiness: ['Routine casualty operations', 'Standard pharmacy stock levels'],
    },
  },
  yellow: {
    label: 'Elevated',
    headlineTemplate: 'Heat Stress Advisory — Elevated Risk in {ward}',
    summary: 'Physiological heat stress indices indicate elevated risk. The combination of thermal exposure and ward vulnerability requires heightened awareness and precautionary measures.',
    publicGuidance: [
      'Reduce prolonged outdoor exertion between 12:00 PM and 4:00 PM.',
      'Drink water every 20 minutes even if not thirsty — dehydration precedes heat illness.',
      'Seek shade during peak afternoon hours. Wear light-coloured, loose-fitting clothing.',
      'Check on elderly neighbours and relatives — heat illness disproportionately affects those living alone.',
      'Keep curtains closed on sun-facing windows during peak hours.',
    ],
    vulnerableGuidance: [
      'Elderly residents (60+): Limit outdoor movement to early morning or evening hours.',
      'Outdoor workers (construction, vendors, delivery): Enforce 15-minute shade breaks every 90 minutes.',
      'Children: Ensure school outdoor activities are rescheduled to cooler hours.',
      'Pregnant women: Avoid direct sun exposure; maintain cool indoor environment.',
    ],
    municipalActions: [
      {
        category: 'cooling_centre',
        title: 'Pre-position Cooling Centre Staff',
        description: 'Alert cooling centre operators. Ensure water and shade provisions are stocked. Prepare for potential activation.',
        urgency: 'elevated',
        target_audience: ['Ward Administrator', 'Cooling Centre Operators'],
      },
      {
        category: 'work_hour',
        title: 'Issue Outdoor Work Advisory',
        description: 'Advisory to construction sites and outdoor employers: provide mandatory shade breaks and hydration during 12:00–16:00.',
        urgency: 'elevated',
        target_audience: ['Labour Inspector', 'Construction Site Managers', 'Street Vendors Association'],
      },
      {
        category: 'water_supply',
        title: 'Ensure Public Water Access',
        description: 'Verify functioning of public water fountains and tankers in high-vulnerability wards.',
        urgency: 'elevated',
        target_audience: ['Water Supply Department', 'Ward Health Worker'],
      },
      {
        category: 'education',
        title: 'School Heat Protocol',
        description: 'Advisory to schools: no outdoor sports between 12:00–3:30 PM; ensure drinking water availability.',
        urgency: 'elevated',
        target_audience: ['District Education Officer', 'School Principals'],
      },
    ],
    healthcare: {
      level: 'Elevated',
      description: 'Alert standby medical teams. Ensure oral rehydration salts (ORS) and IV fluids stocked at primary health centres.',
      readiness: ['Standby heat-exhaustion response teams', 'ORS stock verification at PHCs', 'Ambulance availability check'],
    },
  },
  orange: {
    label: 'High',
    headlineTemplate: 'Heat Warning — High Risk in {ward}',
    summary: 'Dangerous heat stress conditions detected. Composite thermal-vulnerability assessment indicates HIGH risk. Immediate protective actions required for outdoor workers and vulnerable populations.',
    publicGuidance: [
      'AVOID outdoor physical exertion between 11:00 AM and 5:00 PM.',
      'If you must go outside: wear a hat, use sunscreen (SPF 30+), carry water.',
      'Watch for heat illness symptoms: heavy sweating, weakness, dizziness, nausea. Seek shade immediately if these occur.',
      'Use fans and cross-ventilation; if no AC available, spend 2-3 hours in a cooled public space.',
      'Never leave children or pets in parked vehicles — cabin temperatures can exceed 60°C within minutes.',
      'Keep emergency contact numbers accessible. Know your nearest primary health centre.',
    ],
    vulnerableGuidance: [
      'Elderly (60+): STAY indoors during peak hours. Family members should check on elderly relatives at least twice daily.',
      'Outdoor workers: HALT strenuous activity between 11:00 AM and 5:00 PM. Employers MUST provide shade and hydration.',
      'Children: Cancel all outdoor school activities. Ensure adequate fluid intake.',
      'People with chronic conditions (diabetes, heart disease, respiratory illness): Keep medications accessible; heat can destabilize chronic conditions.',
      'Slum and informal settlement residents: Municipal cooling centres open for relief.',
    ],
    municipalActions: [
      {
        category: 'cooling_centre',
        title: 'ACTIVATE Cooling Centres',
        description: 'Open all designated cooling centres in affected wards. Ensure air-conditioned public buildings (libraries, community halls) are accessible.',
        urgency: 'urgent',
        target_audience: ['Municipal Commissioner', 'Ward Administrator', 'Cooling Centre Operators'],
      },
      {
        category: 'work_hour',
        title: 'ENFORCE Work Hour Restrictions',
        description: 'Mandatory halt of outdoor construction and manual labour between 11:00 AM and 5:00 PM. Deploy labour inspectors for compliance.',
        urgency: 'urgent',
        target_audience: ['Labour Commissioner', 'Municipal Labour Inspector', 'Construction Companies'],
      },
      {
        category: 'water_supply',
        title: 'Emergency Water Distribution',
        description: 'Deploy additional water tankers to high-vulnerability wards. Set up emergency water stations at major intersections.',
        urgency: 'urgent',
        target_audience: ['Water Supply Department', 'Fire Department', 'NGO Partners'],
      },
      {
        category: 'healthcare',
        title: 'Heat Surge Preparation',
        description: 'Activate heat-illness treatment protocols at all municipal hospitals. Ensure IV fluid stock, ice packs, and cooling equipment.',
        urgency: 'urgent',
        target_audience: ['Municipal Health Officer', 'Hospital Administrators', 'Emergency Services'],
      },
      {
        category: 'transport',
        title: 'Public Transit Heat Measures',
        description: 'Ensure AC buses operational. Provide water at major bus stops and railway stations.',
        urgency: 'elevated',
        target_audience: ['PMPML', 'Railway Station Masters'],
      },
    ],
    healthcare: {
      level: 'High',
      description: 'Activate heat-illness surge protocols. Ensure emergency departments are staffed and equipped for heat exhaustion and heat stroke cases.',
      readiness: [
        'Heat-illness treatment protocol activated at all PHCs and hospitals',
        'IV fluid and ORS stock replenished',
        'Ice packs and cooling blankets available',
        'Ambulance fleet on standby',
        'Heat stroke cooling stations at major hospitals',
      ],
    },
  },
  red: {
    label: 'Severe',
    headlineTemplate: 'EXTREME HEAT EMERGENCY — Severe Risk in {ward}',
    summary: 'CRITICAL heat stress emergency. Life-threatening thermal conditions combined with high vulnerability. Emergency-level municipal response required immediately.',
    publicGuidance: [
      '⚠ DO NOT leave your home between 10:00 AM and 6:00 PM unless absolutely necessary.',
      'IF YOU MUST GO OUTSIDE: Use extreme caution. Carry 3+ litres of water. Wear full-coverage light clothing and hat.',
      'Watch for heat stroke symptoms: HIGH BODY TEMPERATURE (>40°C), confusion, loss of consciousness. THIS IS A MEDICAL EMERGENCY — call 108 immediately.',
      'Keep your body cool: wet towels on neck and wrists, cold water baths, stay in lowest floor of building.',
      'If someone collapses from heat: move to shade, apply cold water to body, call 108. Do NOT give fluids if unconscious.',
      'Ensure all family members, especially elderly and children, are in cooled spaces.',
    ],
    vulnerableGuidance: [
      'Elderly (60+): You are at EXTREME RISK. Stay in coolest room of your home. If no cooling available, go to nearest cooling centre immediately.',
      'Outdoor workers: ALL outdoor work HALTED by municipal order. Employers face penalties for non-compliance.',
      'Children: ALL outdoor activities cancelled. Schools may shift to online/holiday mode.',
      'Chronic illness patients: Heat can be fatal. Ensure medication access; keep emergency contacts ready.',
      'Informal settlement residents: Municipal emergency shelters open. Relocate to nearest cooling centre if dwelling is not habitable.',
      'Homeless individuals: Emergency shelters activated. Outreach teams deployed.',
    ],
    municipalActions: [
      {
        category: 'cooling_centre',
        title: 'EMERGENCY Cooling Shelter Activation',
        description: 'All cooling centres and emergency shelters at FULL CAPACITY. Deploy additional temporary cooling stations. Ensure 24-hour operation.',
        urgency: 'emergency',
        target_audience: ['Municipal Commissioner', 'District Collector', 'All Ward Administrators'],
      },
      {
        category: 'work_hour',
        title: 'MANDATORY Outdoor Work Suspension',
        description: 'LEGAL ORDER: All outdoor construction, manual labour, and street vending HALTED between 10:00 AM and 6:00 PM. Penalties for violations.',
        urgency: 'emergency',
        target_audience: ['District Collector', 'Labour Commissioner', 'Police Commissioner', 'All Employers'],
      },
      {
        category: 'water_supply',
        title: 'EMERGENCY Water Supply',
        description: 'Deploy all available water tankers. Emergency water pipelines activated. Tanker scheduling extended to 24-hour operations.',
        urgency: 'emergency',
        target_audience: ['Municipal Commissioner', 'Water Supply Department', 'Fire Department', 'Army/NDRF if needed'],
      },
      {
        category: 'healthcare',
        title: 'HEAT EMERGENCY Medical Response',
        description: 'ALL hospitals on heat-emergency footing. Outdoor patient departments moved indoors. Heat stroke treatment teams on 24-hour standby.',
        urgency: 'emergency',
        target_audience: ['Municipal Health Officer', 'District Medical Officer', 'All Hospital Administrators'],
      },
      {
        category: 'education',
        title: 'SCHOOL CLOSURE ADVISORY',
        description: 'Close all schools and anganwadis during peak hours. Examinations rescheduled. Online classes activated where feasible.',
        urgency: 'emergency',
        target_audience: ['District Education Officer', 'School Management', 'Parents'],
      },
      {
        category: 'transport',
        title: 'Emergency Transit Protocol',
        description: 'Deploy additional AC buses on high-ridership routes. Provide water and shade at all transit stops. Air-conditioned metro/AC waiting rooms opened.',
        urgency: 'urgent',
        target_audience: ['Transport Commissioner', 'PMPML', 'Railway Authority'],
      },
    ],
    healthcare: {
      level: 'EMERGENCY',
      description: 'Full heat-emergency medical response activated. All healthcare facilities at surge capacity for heat-related illness.',
      readiness: [
        'Heat stroke treatment protocol at ALL hospitals — 24/7',
        'Dedicated heat-illness triage at emergency departments',
        'Maximum IV fluid and cooling equipment stock',
        'Ambulance fleet on maximum deployment',
        'Mobile medical units deployed to high-vulnerability wards',
        'Blood bank on standby for severe cases',
        'Coordination with NDRF for mass-casualty heat events',
      ],
    },
  },
};

// ============================================================================
// Advisory Generation Engine
// ============================================================================

/**
 * Generates a complete public health advisory for a specific ward and thermal state.
 */
export function generateAdvisory(params: {
  ward_name: string;
  ward_id: string;
  city_id: string;
  heat_index: number;
  wbgt: number;
  composite_risk_score: number;
  thermal_stress: ThermalStressLevel;
  vulnerability_level: VulnerabilityLevel;
  valid_from: string;
  valid_until: string;
}): PublicAdvisory {
  const grade = classifyAdvisoryGrade(
    params.heat_index,
    params.wbgt,
    params.composite_risk_score,
    params.thermal_stress,
    params.vulnerability_level
  );

  const config = GRADE_CONFIG[grade];

  // Replace ward placeholder in headline
  const headline = config.headlineTemplate.replace('{ward}', params.ward_name);

  // Generate unique action IDs
  const municipalActions: MunicipalAction[] = config.municipalActions.map((action, index) => ({
    ...action,
    action_id: `${params.ward_id}-${grade}-${action.category}-${index}`,
  }));

  return {
    grade,
    grade_label: config.label,
    headline,
    summary: config.summary,
    public_guidance: config.publicGuidance,
    vulnerable_population_guidance: config.vulnerableGuidance,
    municipal_actions: municipalActions,
    healthcare_preparedness: {
      level: config.healthcare.level,
      description: config.healthcare.description,
      required_readiness: config.healthcare.readiness,
    },
    valid_from: params.valid_from,
    valid_until: params.valid_until,
    generated_at: new Date().toISOString(),
    attribution: 'HeatPulse Automated Public Health Advisory — Biometeorological Stress Assessment',
  };
}

/**
 * Generates city-wide advisory summary aggregating per-ward advisories.
 */
export function generateCityAdvisorySummary(
  wardAdvisories: PublicAdvisory[]
): {
  city_wide_grade: AdvisoryGrade;
  city_wide_label: string;
  overall_summary: string;
  ward_count_by_grade: Record<AdvisoryGrade, number>;
  highest_urgency_municipal_actions: MunicipalAction[];
  total_wards_affected: number;
} {
  const gradeRank: Record<AdvisoryGrade, number> = { green: 0, yellow: 1, orange: 2, red: 3 };

  let worstGrade: AdvisoryGrade = 'green';
  const countByGrade: Record<AdvisoryGrade, number> = { green: 0, yellow: 0, orange: 0, red: 0 };
  const allActions: MunicipalAction[] = [];

  for (const advisory of wardAdvisories) {
    countByGrade[advisory.grade]++;
    if (gradeRank[advisory.grade] > gradeRank[worstGrade]) {
      worstGrade = advisory.grade;
    }
    allActions.push(...advisory.municipal_actions);
  }

  // Deduplicate municipal actions by category, keeping highest urgency
  const urgencyRank: Record<string, number> = { routine: 0, elevated: 1, urgent: 2, emergency: 3 };
  const actionByCategory = new Map<string, MunicipalAction>();
  for (const action of allActions) {
    const existing = actionByCategory.get(action.category);
    if (!existing || urgencyRank[action.urgency] > urgencyRank[existing.urgency]) {
      actionByCategory.set(action.category, action);
    }
  }
  const highestUrgencyActions = Array.from(actionByCategory.values())
    .sort((a, b) => urgencyRank[b.urgency] - urgencyRank[a.urgency]);

  const affectedWards = wardAdvisories.length;
  const config = GRADE_CONFIG[worstGrade];

  return {
    city_wide_grade: worstGrade,
    city_wide_label: config.label,
    overall_summary: `City-wide assessment: ${config.label} risk level across ${affectedWards} monitored wards. ` +
      `${countByGrade.red} at Severe, ${countByGrade.orange} at High, ` +
      `${countByGrade.yellow} at Elevated, ${countByGrade.green} at Normal.`,
    ward_count_by_grade: countByGrade,
    highest_urgency_municipal_actions: highestUrgencyActions,
    total_wards_affected: affectedWards,
  };
}
