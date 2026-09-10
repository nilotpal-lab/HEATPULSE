/**
 * HeatPulse — Twin Ward Comparison API Route
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 *
 * GET /api/twin-ward?city=pune
 *
 * The key demo moment: shows two wards at the same temperature with different
 * risk grades, demonstrating why vulnerability-weighted assessment matters.
 *
 * "The same temperature is survivable in dry air and lethal in humid air"
 * — equally, the same temperature is low-risk in a green suburb and high-risk
 * in a dense, elderly-heavy commercial ward with no tree cover.
 *
 * Selects the optimal twin pair from Pune's 15 wards:
 * - Lowest vulnerability ward (e.g., Aundh — 18% green space)
 * - Highest vulnerability ward (e.g., Kasba — 3% green space, 14% elderly)
 * Both receive identical weather from the same NWP grid cell.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCityForecast, WeatherUnavailableError } from '@/lib/weather-service';
import { calculateThermalCalculations, classifyThermalStress } from '@/lib/thermal-engine';
import { calculateThermalScore } from '@/lib/threshold-config';
import { assessWardRisk, getWardVulnerability } from '@/lib/risk-engine';
import { generateAdvisory } from '@/lib/advisory-engine';
import { getWardCensusProfile } from '@/lib/census-data';

// ============================================================================
// Types
// ============================================================================

interface TwinWardData {
  ward_name: string;
  ward_id: string;
  city_id: string;
  thermal: {
    temperature: number;
    humidity: number;
    heat_index: number;
    wbgt: number;
    utci_proxy: number;
    thermal_stress: string;
  };
  vulnerability: {
    score: number;
    level: string;
    /** Present ONLY when ward-level data exists; absent = unavailable. */
    green_space_pct?: number;
    building_density?: number;
    outdoor_worker_density?: number;
    is_estimated_baseline: boolean;
    data_source: string;
    provenance: {
      status: string;
      source: string;
      geography?: string;
      methodology?: string;
    };
    census?: {
      population: number;
      elderly_pct: number;
      outdoor_workers_pct: number;
      slum_pct: number;
    };
  };
  composite_risk: {
    score: number;
    level: string;
    thermal_score: number;
    contributing_factors: {
      atmospheric_pct: number;
      vulnerability_pct: number;
      primary_driver: string;
    };
  };
  advisory: {
    grade: string;
    headline: string;
    summary: string;
    public_guidance: string[];
    vulnerable_population_guidance: string[];
    municipal_actions_count: number;
    healthcare_level: string;
  };
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cityParam = (searchParams.get('city') || 'pune').toLowerCase().trim();

  try {
    const { run, status } = await getCityForecast(cityParam);
    const wardEntries = Object.values(run.wards);

    if (wardEntries.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 wards for twin comparison' },
        { status: 400 }
      );
    }

    // Compute risk for all wards
    const wardRisks: Array<{
      wardName: string;
      wardId: string;
      vulnerabilityScore: number;
      compositeRisk: number;
      vulnerabilityLevel: string;
    }> = [];

    for (const wardForecast of wardEntries) {
      const cur = wardForecast.current;

      const assessment = assessWardRisk({
        ward_id: wardForecast.ward_id,
        ward_name: wardForecast.ward_name,
        city_id: wardForecast.city_id,
        temperature: cur.temperature_2m,
        humidity: cur.relative_humidity_2m,
        apparentTemperature: cur.apparent_temperature,
        forecast_metadata: wardForecast.metadata,
      });

      wardRisks.push({
        wardName: wardForecast.ward_name,
        wardId: wardForecast.ward_id,
        vulnerabilityScore: assessment.vulnerability_score,
        compositeRisk: assessment.composite_risk_score,
        vulnerabilityLevel: assessment.vulnerability_level,
      });
    }

    // Find the pair with maximum vulnerability divergence
    // This creates the most compelling demo: same temperature, very different risk
    let bestPair = { lowIdx: 0, highIdx: 1, gap: 0 };
    for (let i = 0; i < wardRisks.length; i++) {
      for (let j = i + 1; j < wardRisks.length; j++) {
        const gap = Math.abs(wardRisks[i].vulnerabilityScore - wardRisks[j].vulnerabilityScore);
        if (gap > bestPair.gap) {
          bestPair = { lowIdx: i, highIdx: j, gap };
        }
      }
    }

    // Ensure low-vulnerability is first, high-vulnerability second
    const lowVulnIdx = wardRisks[bestPair.lowIdx].vulnerabilityScore < wardRisks[bestPair.highIdx].vulnerabilityScore
      ? bestPair.lowIdx : bestPair.highIdx;
    const highVulnIdx = lowVulnIdx === bestPair.lowIdx ? bestPair.highIdx : bestPair.lowIdx;

    // Get full data for both wards
    const buildTwinData = (wardForecast: typeof wardEntries[0]): TwinWardData => {
      const cur = wardForecast.current;
      const thermal = calculateThermalCalculations(
        cur.temperature_2m,
        cur.relative_humidity_2m,
        cur.apparent_temperature
      );
      const thermalStress = classifyThermalStress(thermal.heat_index, thermal.wbgt);
      const vulnerability = getWardVulnerability(wardForecast.city_id, wardForecast.ward_name);
      const assessment = assessWardRisk({
        ward_id: wardForecast.ward_id,
        ward_name: wardForecast.ward_name,
        city_id: wardForecast.city_id,
        temperature: cur.temperature_2m,
        humidity: cur.relative_humidity_2m,
        apparentTemperature: cur.apparent_temperature,
        forecast_metadata: wardForecast.metadata,
      });

      const advisory = generateAdvisory({
        ward_name: wardForecast.ward_name,
        ward_id: wardForecast.ward_id,
        city_id: wardForecast.city_id,
        heat_index: thermal.heat_index,
        wbgt: thermal.wbgt,
        composite_risk_score: assessment.composite_risk_score,
        thermal_stress: thermalStress,
        vulnerability_level: vulnerability.level,
        valid_from: wardForecast.metadata.valid_time,
        valid_until: new Date(
          new Date(wardForecast.metadata.valid_time).getTime() + 24 * 60 * 60 * 1000
        ).toISOString(),
      });

      // Get Census data if available
      const census = getWardCensusProfile(wardForecast.ward_name);

      return {
        ward_name: wardForecast.ward_name,
        ward_id: wardForecast.ward_id,
        city_id: wardForecast.city_id,
        thermal: {
          temperature: cur.temperature_2m,
          humidity: cur.relative_humidity_2m,
          heat_index: thermal.heat_index,
          wbgt: thermal.wbgt,
          utci_proxy: thermal.utci_proxy,
          thermal_stress: thermalStress,
        },
        vulnerability: {
          score: vulnerability.score,
          level: vulnerability.level,
          // Component fields are undefined when no ward-level data exists —
          // the demo text below reads them via optional chaining.
          green_space_pct: vulnerability.green_space_pct,
          building_density: vulnerability.building_density,
          outdoor_worker_density: vulnerability.outdoor_worker_density,
          is_estimated_baseline: vulnerability.is_estimated_baseline,
          data_source: vulnerability.data_source,
          provenance: {
            status: vulnerability.provenance.status,
            source: vulnerability.provenance.source,
            geography: vulnerability.provenance.geography,
            methodology: vulnerability.provenance.methodology,
          },
          ...(census ? {
            census: {
              population: census.total_population,
              elderly_pct: census.elderly_population_pct,
              outdoor_workers_pct: census.main_outdoor_workers_pct + census.marginal_outdoor_workers_pct,
              slum_pct: census.slum_household_pct,
            },
          } : {}),
        },
        composite_risk: {
          score: assessment.composite_risk_score,
          level: assessment.composite_risk_level,
          thermal_score: calculateThermalScore(thermal.heat_index),
          contributing_factors: assessment.contributing_factors,
        },
        advisory: {
          grade: advisory.grade,
          headline: advisory.headline,
          summary: advisory.summary,
          public_guidance: advisory.public_guidance,
          vulnerable_population_guidance: advisory.vulnerable_population_guidance,
          municipal_actions_count: advisory.municipal_actions.length,
          healthcare_level: advisory.healthcare_preparedness.level,
        },
      };
    };

    const lowVulnerabilityWard = buildTwinData(wardEntries[lowVulnIdx]);
    const highVulnerabilityWard = buildTwinData(wardEntries[highVulnIdx]);

    return NextResponse.json({
      success: true,
      city_id: cityParam,
      generated_at: new Date().toISOString(),
      status,
      forecast_metadata: run.metadata,
      demonstration: {
        title: 'Why Vulnerability-Weighted Heat Risk Matters',
        explanation: `Both wards experience the identical temperature of ${lowVulnerabilityWard.thermal.temperature}°C from the same NWP forecast grid, yet their risk levels differ significantly because thermal stress interacts with ward-level vulnerability factors.`,
        key_insight: `Ward A (${lowVulnerabilityWard.ward_name}) has ${
          lowVulnerabilityWard.vulnerability.green_space_pct !== undefined
            ? `${lowVulnerabilityWard.vulnerability.green_space_pct}% green space`
            : 'no ward-level green-space data'
        } and a vulnerability score of ${lowVulnerabilityWard.vulnerability.score}/100, yielding ${lowVulnerabilityWard.composite_risk.level} risk. ` +
          `Ward B (${highVulnerabilityWard.ward_name}) has ${
          highVulnerabilityWard.vulnerability.green_space_pct !== undefined
            ? `${highVulnerabilityWard.vulnerability.green_space_pct}% green space`
            : 'no ward-level green-space data'
        } and a vulnerability score of ${highVulnerabilityWard.vulnerability.score}/100, yielding ${highVulnerabilityWard.composite_risk.level} risk.`,
      },
      low_vulnerability_ward: lowVulnerabilityWard,
      high_vulnerability_ward: highVulnerabilityWard,
      comparison_metrics: {
        temperature_difference: Math.abs(lowVulnerabilityWard.thermal.temperature - highVulnerabilityWard.thermal.temperature),
        heat_index_difference: Math.abs(lowVulnerabilityWard.thermal.heat_index - highVulnerabilityWard.thermal.heat_index),
        vulnerability_score_gap: Math.abs(lowVulnerabilityWard.vulnerability.score - highVulnerabilityWard.vulnerability.score),
        composite_risk_gap: Math.abs(lowVulnerabilityWard.composite_risk.score - highVulnerabilityWard.composite_risk.score),
        green_space_gap: Math.abs((lowVulnerabilityWard.vulnerability.green_space_pct ?? 0) - (highVulnerabilityWard.vulnerability.green_space_pct ?? 0)),
        same_advisory_grade: lowVulnerabilityWard.advisory.grade === highVulnerabilityWard.advisory.grade,
      },
      attribution: 'HeatPulse Twin Ward Comparison — Demonstrating Vulnerability-Weighted Risk Assessment',
    });
  } catch (error) {
    if (error instanceof WeatherUnavailableError) {
      return NextResponse.json(
        { error: error.message, status: 'unavailable' },
        { status: error.statusCode }
      );
    }

    console.error('Twin Ward API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate twin ward comparison' },
      { status: 500 }
    );
  }
}
