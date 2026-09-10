/**
 * HeatPulse — Localized Thermal Advisories API Route
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 * 
 * GET /api/alerts?city=pune
 * GET /api/alerts?city=bengaluru&ward=blr-001
 * 
 * Evaluates per-ward biometeorological stress across all centroids.
 * Strictly segregated from official IMD district reference warnings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCityForecast, WeatherUnavailableError } from '@/lib/weather-service';
import { calculateThermalStress } from '@/lib/thermal-engine';
import { assessWardRisk } from '@/lib/risk-engine';
import { ALERT_THRESHOLDS } from '@/lib/threshold-config';
import { evaluateImdDistrictWarning } from '@/lib/imd-service';
import { generateAdvisory } from '@/lib/advisory-engine';

export interface HeatAlert {
  ward: string;
  ward_id?: string;
  level: 'watch' | 'warning' | 'critical';
  heatIndex: number;
  wbgt: number;
  compositeRisk: number;
  timestamp: string;
  message: string;
  advisory_type: 'HeatPulse Localized Biometeorological Advisory';
  public_advisory?: {
    grade: string;
    headline: string;
    public_guidance: string[];
    vulnerable_population_guidance: string[];
    municipal_action_count: number;
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cityParam = (searchParams.get('city') || 'pune').toLowerCase().trim();
  const wardParam = searchParams.get('ward')?.trim();

  try {
    const { run, status } = await getCityForecast(cityParam);
    const wardEntries = Object.values(run.wards);

    const alerts: HeatAlert[] = [];
    let maxTemp = 0;

    for (const wardForecast of wardEntries) {
      if (wardParam && wardForecast.ward_name !== wardParam && wardForecast.ward_id !== wardParam) {
        continue;
      }

      const cur = wardForecast.current;
      if (cur.temperature_2m > maxTemp) {
        maxTemp = cur.temperature_2m;
      }

      const thermal = calculateThermalStress(
        cur.temperature_2m,
        cur.relative_humidity_2m,
        cur.apparent_temperature
      );

      const assessment = assessWardRisk({
        ward_id: wardForecast.ward_id,
        ward_name: wardForecast.ward_name,
        city_id: wardForecast.city_id,
        temperature: cur.temperature_2m,
        humidity: cur.relative_humidity_2m,
        apparentTemperature: cur.apparent_temperature,
        forecast_metadata: wardForecast.metadata,
      });

      let alertLevel: 'watch' | 'warning' | 'critical' | null = null;
      let message = '';

      if (thermal.heat_index >= ALERT_THRESHOLDS.criticalHi || thermal.wbgt_estimated >= ALERT_THRESHOLDS.criticalWbgt) {
        alertLevel = 'critical';
        message = `HeatPulse Localized Advisory: Critical Heat Index ${thermal.heat_index}°C in ${wardForecast.ward_name}. Strenuous outdoor labor should pause during peak hours.`;
      } else if (thermal.heat_index >= ALERT_THRESHOLDS.warningHi || thermal.wbgt_estimated >= ALERT_THRESHOLDS.warningWbgt) {
        alertLevel = 'warning';
        message = `HeatPulse Localized Advisory: Elevated Heat Index ${thermal.heat_index}°C in ${wardForecast.ward_name}. Reduce outdoor exertion and enforce regular hydration.`;
      } else if (thermal.heat_index >= ALERT_THRESHOLDS.watchHi || assessment.composite_risk_score >= ALERT_THRESHOLDS.compositeWatch) {
        alertLevel = 'watch';
        message = `HeatPulse Localized Advisory: Heat Index ${thermal.heat_index}°C in ${wardForecast.ward_name}. Monitor microclimate conditions and support vulnerable populations.`;
      }

      if (alertLevel) {
        // Generate structured public health advisory for this ward
        const publicAdvisory = generateAdvisory({
          ward_name: wardForecast.ward_name,
          ward_id: wardForecast.ward_id,
          city_id: wardForecast.city_id,
          heat_index: thermal.heat_index,
          wbgt: thermal.wbgt_estimated,
          composite_risk_score: assessment.composite_risk_score,
          thermal_stress: thermal.thermal_stress,
          vulnerability_level: assessment.vulnerability_level,
          valid_from: wardForecast.metadata.valid_time,
          valid_until: new Date(
            new Date(wardForecast.metadata.valid_time).getTime() + 24 * 60 * 60 * 1000
          ).toISOString(),
        });

        alerts.push({
          ward: wardForecast.ward_name,
          ward_id: wardForecast.ward_id,
          level: alertLevel,
          heatIndex: thermal.heat_index,
          wbgt: thermal.wbgt_estimated,
          compositeRisk: assessment.composite_risk_score,
          timestamp: wardForecast.metadata.valid_time,
          message,
          advisory_type: 'HeatPulse Localized Biometeorological Advisory',
          public_advisory: {
            grade: publicAdvisory.grade,
            headline: publicAdvisory.headline,
            public_guidance: publicAdvisory.public_guidance,
            vulnerable_population_guidance: publicAdvisory.vulnerable_population_guidance,
            municipal_action_count: publicAdvisory.municipal_actions.length,
          },
        });
      }
    }

    // Sort alerts by severity (critical first)
    const severityOrder = { critical: 0, warning: 1, watch: 2 };
    alerts.sort((a, b) => severityOrder[a.level] - severityOrder[b.level]);

    // Provide IMD-criteria district evaluation alongside (criteria-based, not an
    // official IMD bulletin — see imd-service.ts provenance note)
    const districtHeatEvaluation = evaluateImdDistrictWarning(cityParam, maxTemp);

    return NextResponse.json({
      success: true,
      city_id: cityParam,
      generated_at: run.metadata.fetched_at,
      status,
      forecast_metadata: run.metadata,
      district_heat_evaluation: districtHeatEvaluation,
      alerts,
      alertCount: alerts.length,
      summary: {
        maxHeatIndex: alerts.length > 0 ? Math.max(...alerts.map((a) => a.heatIndex)) : 0,
        maxCompositeRisk: alerts.length > 0 ? Math.max(...alerts.map((a) => a.compositeRisk)) : 0,
        criticalCount: alerts.filter((a) => a.level === 'critical').length,
        warningCount: alerts.filter((a) => a.level === 'warning').length,
        watchCount: alerts.filter((a) => a.level === 'watch').length,
      },
    });
  } catch (error) {
    if (error instanceof WeatherUnavailableError) {
      return NextResponse.json(
        {
          error: error.message,
          status: 'unavailable',
          attribution: 'Ward-localized forecast derived from numerical weather prediction',
        },
        { status: error.statusCode }
      );
    }

    console.error('Alerts API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate thermal advisories' },
      { status: 500 }
    );
  }
}
