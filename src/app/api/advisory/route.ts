/**
 * HeatPulse — Automated Public Health Advisory API Route
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 *
 * GET /api/advisory?city=pune
 * GET /api/advisory?city=pune&ward=Admin Ward 08 KasbaVishrambaugwada
 *
 * Generates structured, per-alert-grade public health advisories for each ward
 * based on biometeorological thermal stress and vulnerability profiles.
 *
 * Strictly segregated from official IMD district reference warnings.
 * Zero synthetic mortality or health-outcome figures.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCityForecast, WeatherUnavailableError } from '@/lib/weather-service';
import { calculateThermalCalculations, classifyThermalStress } from '@/lib/thermal-engine';
import { assessWardRisk, getWardVulnerability } from '@/lib/risk-engine';
import {
  generateAdvisory,
  generateCityAdvisorySummary,
  PublicAdvisory,
} from '@/lib/advisory-engine';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cityParam = (searchParams.get('city') || 'pune').toLowerCase().trim();
  const wardParam = searchParams.get('ward')?.trim();

  try {
    const { run, status } = await getCityForecast(cityParam);
    const wardEntries = Object.values(run.wards);

    const wardAdvisories: PublicAdvisory[] = [];

    for (const wardForecast of wardEntries) {
      // Filter to specific ward if requested
      if (wardParam && wardForecast.ward_name !== wardParam && wardForecast.ward_id !== wardParam) {
        continue;
      }

      const cur = wardForecast.current;

      // Calculate thermal stress
      const thermal = calculateThermalCalculations(
        cur.temperature_2m,
        cur.relative_humidity_2m,
        cur.apparent_temperature
      );

      const thermalStress = classifyThermalStress(thermal.heat_index, thermal.wbgt);

      // Get full risk assessment (includes vulnerability)
      const riskAssessment = assessWardRisk({
        ward_id: wardForecast.ward_id,
        ward_name: wardForecast.ward_name,
        city_id: wardForecast.city_id,
        temperature: cur.temperature_2m,
        humidity: cur.relative_humidity_2m,
        apparentTemperature: cur.apparent_temperature,
        forecast_metadata: wardForecast.metadata,
      });

      // Get vulnerability classification
      const vulnerability = getWardVulnerability(wardForecast.city_id, wardForecast.ward_name);

      // Generate advisory for this ward
      const advisory = generateAdvisory({
        ward_name: wardForecast.ward_name,
        ward_id: wardForecast.ward_id,
        city_id: wardForecast.city_id,
        heat_index: thermal.heat_index,
        wbgt: thermal.wbgt,
        composite_risk_score: riskAssessment.composite_risk_score,
        thermal_stress: thermalStress,
        vulnerability_level: vulnerability.level,
        valid_from: wardForecast.metadata.valid_time,
        valid_until: new Date(
          new Date(wardForecast.metadata.valid_time).getTime() + 24 * 60 * 60 * 1000
        ).toISOString(),
      });

      wardAdvisories.push(advisory);
    }

    // Generate city-wide summary
    const citySummary = generateCityAdvisorySummary(wardAdvisories);

    return NextResponse.json({
      success: true,
      city_id: cityParam,
      generated_at: new Date().toISOString(),
      status,
      forecast_metadata: run.metadata,
      city_summary: citySummary,
      ward_advisories: wardAdvisories,
      advisory_count: wardAdvisories.length,
      attribution: 'HeatPulse Automated Public Health Advisory — Biometeorological Stress Assessment',
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

    console.error('Advisory API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate public health advisories' },
      { status: 500 }
    );
  }
}
