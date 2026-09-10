/**
 * HeatPulse — Municipal Action Trigger API Route
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 *
 * GET /api/municipal-actions?city=pune
 * POST /api/municipal-actions (activate/deactivate actions)
 *
 * Demonstrates municipal action triggers: cooling centre activation,
 * outdoor work hour restrictions, water supply alerts, healthcare preparedness.
 *
 * In production, POST endpoint would trigger real municipal systems via webhooks/SMS APIs.
 * Current implementation generates actionable briefings for municipal decision-makers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCityForecast, WeatherUnavailableError } from '@/lib/weather-service';
import { calculateThermalCalculations, classifyThermalStress } from '@/lib/thermal-engine';
import { assessWardRisk, getWardVulnerability } from '@/lib/risk-engine';
import { classifyAdvisoryGrade } from '@/lib/advisory-engine';

// ============================================================================
// Types
// ============================================================================

export type ActionCategory = 'cooling_centre' | 'work_hour' | 'water_supply' | 'healthcare' | 'education' | 'transport';
export type ActionUrgency = 'routine' | 'elevated' | 'urgent' | 'emergency';
export type ActionStatus = 'standby' | 'activated' | 'completed' | 'expired';

export interface MunicipalActionBriefing {
  action_id: string;
  category: ActionCategory;
  title: string;
  description: string;
  urgency: ActionUrgency;
  status: ActionStatus;
  target_wards: string[];
  city_id: string;
  triggered_at: string;
  valid_until: string;
  estimated_impact: {
    population_affected: number;
    wards_affected: number;
  };
  contact_chain: string[];
  escalation_path: string[];
}

export interface ActivationRequest {
  city_id: string;
  action_category: ActionCategory;
  ward_ids?: string[];
  override_urgency?: ActionUrgency;
  reason: string;
}

// ============================================================================
// Action Category Metadata
// ============================================================================

const ACTION_CATEGORIES: Record<ActionCategory, {
  title: string;
  description: string;
  contact_chain: string[];
  escalation_path: string[];
}> = {
  cooling_centre: {
    title: 'Cooling Centre Activation',
    description: 'Activate designated cooling shelters and air-conditioned public buildings for heat relief.',
    contact_chain: [
      'Ward Health Worker → Ward Administrator → Municipal Control Room',
    ],
    escalation_path: [
      'Level 1: Ward-level community halls and libraries',
      'Level 2: Zonal municipal buildings with AC',
      'Level 3: Emergency shelters with full cooling infrastructure',
    ],
  },
  work_hour: {
    title: 'Outdoor Work Hour Restriction',
    description: 'Issue advisory or mandate restricting outdoor labour during peak heat hours.',
    contact_chain: [
      'Labour Inspector → Labour Commissioner → District Collector',
    ],
    escalation_path: [
      'Level 1: Advisory — recommend shade breaks every 90 minutes',
      'Level 2: Mandatory — halt outdoor work 12:00–16:00 PM',
      'Level 3: Legal order — halt outdoor work 10:00–18:00 PM with penalties',
    ],
  },
  water_supply: {
    title: 'Emergency Water Distribution',
    description: 'Deploy additional water tankers and set up emergency water stations in affected wards.',
    contact_chain: [
      'Ward Health Worker → Water Supply Engineer → Municipal Commissioner',
    ],
    escalation_path: [
      'Level 1: Verify public fountains and standposts operational',
      'Level 2: Deploy 2–4 additional tankers per ward',
      'Level 3: 24-hour water tanker operations with fire department support',
    ],
  },
  healthcare: {
    title: 'Heat Emergency Medical Preparedness',
    description: 'Activate heat-illness treatment protocols at hospitals and primary health centres.',
    contact_chain: [
      'PHC Medical Officer → Municipal Health Officer → District Medical Officer',
    ],
    escalation_path: [
      'Level 1: Ensure ORS and IV fluid stock at all PHCs',
      'Level 2: Activate heat-illness surge protocol at municipal hospitals',
      'Level 3: Full heat-emergency medical response — all facilities at surge capacity',
    ],
  },
  education: {
    title: 'School Heat Protocol',
    description: 'Implement heat safety measures at schools and educational institutions.',
    contact_chain: [
      'School Principal → District Education Officer → Municipal Commissioner',
    ],
    escalation_path: [
      'Level 1: No outdoor sports 12:00–3:30 PM, ensure water availability',
      'Level 2: Shift to indoor-only activities, reschedule examinations',
      'Level 3: Close schools during peak hours, activate online classes',
    ],
  },
  transport: {
    title: 'Public Transit Heat Measures',
    description: 'Ensure adequate cooling and hydration infrastructure at transit points.',
    contact_chain: [
      'Station Master → Transport Commissioner → Municipal Commissioner',
    ],
    escalation_path: [
      'Level 1: Ensure water and shade at major bus stops',
      'Level 2: Deploy additional AC buses on high-ridership routes',
      'Level 3: Open AC waiting rooms at all transit hubs, extended water supply',
    ],
  },
};

// ============================================================================
// GET Handler — Generate Municipal Action Briefings
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cityParam = (searchParams.get('city') || 'pune').toLowerCase().trim();
  const categoryParam = searchParams.get('category')?.trim() as ActionCategory | null;

  try {
    const { run, status } = await getCityForecast(cityParam);
    const wardEntries = Object.values(run.wards);

    const briefings: MunicipalActionBriefing[] = [];
    const categoryTriggerLevels: Partial<Record<ActionCategory, ActionUrgency>> = {};

    for (const wardForecast of wardEntries) {
      const cur = wardForecast.current;
      const thermal = calculateThermalCalculations(
        cur.temperature_2m,
        cur.relative_humidity_2m,
        cur.apparent_temperature
      );

      const thermalStress = classifyThermalStress(thermal.heat_index, thermal.wbgt);
      const vulnerability = getWardVulnerability(wardForecast.city_id, wardForecast.ward_name);
      const risk = assessWardRisk({
        ward_id: wardForecast.ward_id,
        ward_name: wardForecast.ward_name,
        city_id: wardForecast.city_id,
        temperature: cur.temperature_2m,
        humidity: cur.relative_humidity_2m,
        apparentTemperature: cur.apparent_temperature,
        forecast_metadata: wardForecast.metadata,
      });

      const grade = classifyAdvisoryGrade(
        thermal.heat_index,
        thermal.wbgt,
        risk.composite_risk_score,
        thermalStress,
        vulnerability.level
      );

      // Determine action urgency from grade
      const urgency: ActionUrgency =
        grade === 'red' ? 'emergency' :
        grade === 'orange' ? 'urgent' :
        grade === 'yellow' ? 'elevated' : 'routine';

      // Track highest urgency per category
      const categories: ActionCategory[] = categoryParam ? [categoryParam] : [
        'cooling_centre', 'work_hour', 'water_supply', 'healthcare', 'education', 'transport'
      ];

      for (const cat of categories) {
        const current = categoryTriggerLevels[cat];
        const rank = { routine: 0, elevated: 1, urgent: 2, emergency: 3 };
        if (!current || rank[urgency] > rank[current]) {
          categoryTriggerLevels[cat] = urgency;
        }
      }

      // Generate briefings for categories that need action
      if (grade !== 'green' || categoryParam) {
        const cats: ActionCategory[] = categoryParam ? [categoryParam] : [
          'cooling_centre', 'work_hour', 'water_supply', 'healthcare', 'education', 'transport'
        ];

        for (const cat of cats) {
          if (urgency === 'routine' && !categoryParam) continue;

          const meta = ACTION_CATEGORIES[cat];
          const existing = briefings.find(b => b.category === cat);

          if (existing) {
            // Add ward to existing briefing
            if (!existing.target_wards.includes(wardForecast.ward_name)) {
              existing.target_wards.push(wardForecast.ward_name);
            }
            existing.estimated_impact.wards_affected = existing.target_wards.length;
          } else {
            briefings.push({
              action_id: `muni-${cityParam}-${cat}-${Date.now()}`,
              category: cat,
              title: meta.title,
              description: meta.description,
              urgency,
              status: urgency === 'routine' ? 'standby' : 'activated',
              target_wards: [wardForecast.ward_name],
              city_id: cityParam,
              triggered_at: new Date().toISOString(),
              valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              estimated_impact: {
                population_affected: 0, // No fabricated population numbers
                wards_affected: 1,
              },
              contact_chain: meta.contact_chain,
              escalation_path: meta.escalation_path,
            });
          }
        }
      }
    }

    // Sort briefings by urgency
    const urgencyOrder: Record<ActionUrgency, number> = { emergency: 0, urgent: 1, elevated: 2, routine: 3 };
    briefings.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return NextResponse.json({
      success: true,
      city_id: cityParam,
      generated_at: new Date().toISOString(),
      status,
      forecast_metadata: run.metadata,
      action_briefings: briefings,
      briefing_count: briefings.length,
      trigger_summary: categoryTriggerLevels,
      attribution: 'HeatPulse Municipal Action Trigger System — Operational Briefing Generator',
    });
  } catch (error) {
    if (error instanceof WeatherUnavailableError) {
      return NextResponse.json(
        {
          error: error.message,
          status: 'unavailable',
        },
        { status: error.statusCode }
      );
    }

    console.error('Municipal Actions API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate municipal action briefings' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler — Simulate Action Activation
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ActivationRequest;
    const { city_id, action_category, ward_ids, override_urgency, reason } = body;

    if (!city_id || !action_category) {
      return NextResponse.json(
        { error: 'city_id and action_category are required' },
        { status: 400 }
      );
    }

    const meta = ACTION_CATEGORIES[action_category];
    if (!meta) {
      return NextResponse.json(
        { error: `Invalid action category: ${action_category}` },
        { status: 400 }
      );
    }

    // Get current thermal conditions to determine urgency
    let urgency: ActionUrgency = override_urgency || 'elevated';

    if (!override_urgency) {
      try {
        const { run } = await getCityForecast(city_id);
        const wards = ward_ids
          ? Object.values(run.wards).filter(w => ward_ids.includes(w.ward_id))
          : Object.values(run.wards);

        let worstGrade = 'green';
        const gradeRank: Record<string, number> = { green: 0, yellow: 1, orange: 2, red: 3 };

        for (const ward of wards) {
          const thermal = calculateThermalCalculations(
            ward.current.temperature_2m,
            ward.current.relative_humidity_2m,
            ward.current.apparent_temperature
          );
          const stress = classifyThermalStress(thermal.heat_index, thermal.wbgt);
          const vulnerability = getWardVulnerability(ward.city_id, ward.ward_name);
          const risk = assessWardRisk({
            ward_id: ward.ward_id,
            ward_name: ward.ward_name,
            city_id: ward.city_id,
            temperature: ward.current.temperature_2m,
            humidity: ward.current.relative_humidity_2m,
            apparentTemperature: ward.current.apparent_temperature,
            forecast_metadata: ward.metadata,
          });

          const grade = classifyAdvisoryGrade(
            thermal.heat_index, thermal.wbgt, risk.composite_risk_score,
            stress, vulnerability.level
          );
          if (gradeRank[grade] > gradeRank[worstGrade]) {
            worstGrade = grade;
          }
        }

        urgency =
          worstGrade === 'red' ? 'emergency' :
          worstGrade === 'orange' ? 'urgent' :
          worstGrade === 'yellow' ? 'elevated' : 'routine';
      } catch {
        // Weather unavailable — default to elevated
        urgency = 'elevated';
      }
    }

    // Generate activation confirmation
    const activation = {
      action_id: `act-${city_id}-${action_category}-${Date.now()}`,
      category: action_category,
      title: meta.title,
      description: meta.description,
      urgency,
      status: 'activated' as const,
      city_id,
      target_wards: ward_ids || ['all'],
      reason: reason || 'Municipal action activation requested via HeatPulse API',
      activated_at: new Date().toISOString(),
      valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      contact_chain: meta.contact_chain,
      escalation_path: meta.escalation_path,
      notice: 'In production, this endpoint would trigger SMS/push notifications to municipal officials, activate IoT cooling systems, and log to the municipal emergency management system.',
    };

    return NextResponse.json({
      success: true,
      activation,
      attribution: 'HeatPulse Municipal Action Trigger System',
    });
  } catch (error) {
    console.error('Municipal Action activation error:', error);
    return NextResponse.json(
      { error: 'Failed to process activation request' },
      { status: 500 }
    );
  }
}
