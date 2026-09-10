/**
 * HeatPulse — Multi-Ward Risk Assessment API Route
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 * 
 * GET /api/risk?city=pune
 * GET /api/risk?city=bengaluru&ward=blr-001
 * 
 * Consumes server-side batched weather pipeline (weather-service.ts).
 * Samples NWP weather per ward centroid — eliminates single-point cloning.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCityForecast, getWardForecast, WeatherUnavailableError } from '@/lib/weather-service';
import {
  assessWardRisk,
  calculateWardRisk,
  getWardVulnerability,
  WARD_POINTS,
} from '@/lib/risk-engine';
import { WardRiskAssessment } from '@/types/thermal';
import { WardRisk } from '@/types/risk';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cityParam = (searchParams.get('city') || 'pune').toLowerCase().trim();
  const wardParam = searchParams.get('ward')?.trim();

  try {
    // 1. Specific single-ward request
    if (wardParam) {
      try {
        const { forecast, status } = await getWardForecast(cityParam, wardParam);
        const assessment = assessWardRisk({
          ward_id: forecast.ward_id,
          ward_name: forecast.ward_name,
          city_id: forecast.city_id,
          temperature: forecast.current.temperature_2m,
          humidity: forecast.current.relative_humidity_2m,
          apparentTemperature: forecast.current.apparent_temperature,
          forecast_metadata: forecast.metadata,
        });

        const vuln = getWardVulnerability(cityParam, forecast.ward_name);

        // Merge modern assessment with legacy format for seamless UI compatibility
        const legacyRisk: WardRisk = {
          wardId: forecast.ward_id,
          ward_id: forecast.ward_id,
          wardName: forecast.ward_name,
          ward_name: forecast.ward_name,
          lon: forecast.centroid[0],
          lat: forecast.centroid[1],
          currentTemp: forecast.current.temperature_2m,
          currentHumidity: forecast.current.relative_humidity_2m,
          heatIndex: assessment.thermal.heat_index,
          wbgt: assessment.thermal.wbgt,
          heatCondition: assessment.thermal.heat_condition,
          heat_condition: assessment.thermal.heat_condition,
          thermalStress: assessment.thermal.thermal_stress,
          thermal_stress: assessment.thermal.thermal_stress,
          thermalRisk: assessment.thermal.thermal_stress === 'Severe'
            ? 'danger'
            : assessment.thermal.thermal_stress === 'High'
            ? 'high'
            : assessment.thermal.thermal_stress === 'Moderate'
            ? 'moderate'
            : 'low',
          vulnerabilityScore: assessment.vulnerability_score,
          compositeRisk: assessment.composite_risk_score,
          compositeRiskLevel: assessment.composite_risk_level === 'Severe'
            ? 'extreme'
            : assessment.composite_risk_level === 'High'
            ? 'high'
            : assessment.composite_risk_level === 'Moderate'
            ? 'moderate'
            : 'low',
          recommendations: assessment.recommendations,
          vulnerabilityGreenPct: vuln.green_space_pct,
          vulnerabilityBuildingDensity: vuln.building_density,
          vulnerabilityWorkerDensity: vuln.outdoor_worker_density,
          vulnerability_provenance: {
            status: vuln.provenance.status,
            source: vuln.provenance.source,
            geography: vuln.provenance.geography,
            methodology: vuln.provenance.methodology,
          },
          updated_at: new Date().toISOString(),
        };

        return NextResponse.json({
          ...legacyRisk,
          assessment,
          status,
        });
      } catch (err) {
        // Fallback for Pune legacy ward names if not found by id
        if (cityParam === 'pune' && WARD_POINTS[wardParam]) {
          const point = WARD_POINTS[wardParam];
          const legacyFallback = calculateWardRisk(wardParam, point.lon, point.lat, {
            heatIndex: 35,
            wbgt: 28,
            riskLevel: 'moderate',
          });
          return NextResponse.json(legacyFallback);
        }
        throw err;
      }
    }

    // 2. City-wide multi-ward risk assessment (per-ward NWP sampling)
    const { run, status } = await getCityForecast(cityParam);
    const wardEntries = Object.values(run.wards);

    const assessments: WardRiskAssessment[] = [];
    const legacyWards: WardRisk[] = [];

    for (const wardForecast of wardEntries) {
      const assessment = assessWardRisk({
        ward_id: wardForecast.ward_id,
        ward_name: wardForecast.ward_name,
        city_id: wardForecast.city_id,
        temperature: wardForecast.current.temperature_2m,
        humidity: wardForecast.current.relative_humidity_2m,
        apparentTemperature: wardForecast.current.apparent_temperature,
        forecast_metadata: wardForecast.metadata,
      });

      assessments.push(assessment);

      const vuln = getWardVulnerability(cityParam, wardForecast.ward_name);
      legacyWards.push({
        wardId: wardForecast.ward_id,
        ward_id: wardForecast.ward_id,
        wardName: wardForecast.ward_name,
        ward_name: wardForecast.ward_name,
        lon: wardForecast.centroid[0],
        lat: wardForecast.centroid[1],
        currentTemp: wardForecast.current.temperature_2m,
        currentHumidity: wardForecast.current.relative_humidity_2m,
        heatIndex: assessment.thermal.heat_index,
        wbgt: assessment.thermal.wbgt,
        heatCondition: assessment.thermal.heat_condition,
        heat_condition: assessment.thermal.heat_condition,
        thermalStress: assessment.thermal.thermal_stress,
        thermal_stress: assessment.thermal.thermal_stress,
        thermalRisk: assessment.thermal.thermal_stress === 'Severe'
          ? 'danger'
          : assessment.thermal.thermal_stress === 'High'
          ? 'high'
          : assessment.thermal.thermal_stress === 'Moderate'
          ? 'moderate'
          : 'low',
        vulnerabilityScore: assessment.vulnerability_score,
        compositeRisk: assessment.composite_risk_score,
        compositeRiskLevel: assessment.composite_risk_level === 'Severe'
          ? 'extreme'
          : assessment.composite_risk_level === 'High'
          ? 'high'
          : assessment.composite_risk_level === 'Moderate'
          ? 'moderate'
          : 'low',
        recommendations: assessment.recommendations,
        vulnerabilityGreenPct: vuln.green_space_pct,
        vulnerabilityBuildingDensity: vuln.building_density,
        vulnerabilityWorkerDensity: vuln.outdoor_worker_density,
        vulnerability_provenance: {
          status: vuln.provenance.status,
          source: vuln.provenance.source,
          geography: vuln.provenance.geography,
          methodology: vuln.provenance.methodology,
        },
        updated_at: run.fetched_at,
      });
    }

    const compositeScores = assessments.map((a) => a.composite_risk_score);
    const maxRisk = compositeScores.length > 0 ? Math.max(...compositeScores) : 0;
    const minRisk = compositeScores.length > 0 ? Math.min(...compositeScores) : 0;
    const avgRisk =
      compositeScores.length > 0
        ? Math.round((compositeScores.reduce((s, c) => s + c, 0) / compositeScores.length) * 10) / 10
        : 0;

    return NextResponse.json({
      success: true,
      city_id: cityParam,
      generated_at: run.fetched_at,
      forecast_metadata: run.metadata,
      status,
      wards: legacyWards,
      assessments,
      wardCount: assessments.length,
      maxRisk,
      minRisk,
      avgRisk,
      summary: {
        max_risk: maxRisk,
        min_risk: minRisk,
        avg_risk: avgRisk,
        severe_count: assessments.filter((a) => a.composite_risk_level === 'Severe').length,
        high_count: assessments.filter((a) => a.composite_risk_level === 'High').length,
        moderate_count: assessments.filter((a) => a.composite_risk_level === 'Moderate').length,
        low_count: assessments.filter((a) => a.composite_risk_level === 'Low').length,
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

    console.error('Risk API error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate risk assessment' },
      { status: 500 }
    );
  }
}
