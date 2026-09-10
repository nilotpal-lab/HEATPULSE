/**
 * HeatPulse — Thermal Stress API Route
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 * 
 * GET /api/thermal?city=pune&ward=pune-01
 * GET /api/thermal?lat=18.52&lon=73.86
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchPointWeatherForecast,
  getWardForecast,
  WeatherUnavailableError,
} from '@/lib/weather-service';
import {
  calculateHourlyThermalForecast,
  calculateThermalStress,
} from '@/lib/thermal-engine';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cityParam = searchParams.get('city')?.toLowerCase().trim();
  const wardParam = searchParams.get('ward')?.trim();
  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');

  try {
    // 1. If ward & city are provided, consume the batched NWP pipeline
    if (cityParam && wardParam) {
      const { forecast, status } = await getWardForecast(cityParam, wardParam);
      const thermalHourly = forecast.hourly.time.map((time, i) => {
        const temp = forecast.hourly.temperature_2m[i];
        const rh = forecast.hourly.relative_humidity_2m[i];
        const apparent = forecast.hourly.apparent_temperature[i];
        const stress = calculateThermalStress(temp, rh, apparent);
        return {
          ...stress,
          time,
        };
      });

      const current = calculateThermalStress(
        forecast.current.temperature_2m,
        forecast.current.relative_humidity_2m,
        forecast.current.apparent_temperature
      );

      const heatIndices = thermalHourly.map((t) => t.heat_index);
      const maxHI = Math.round(Math.max(...heatIndices) * 10) / 10;
      const minHI = Math.round(Math.min(...heatIndices) * 10) / 10;
      const peak = thermalHourly.reduce(
        (max, t) => (t.heat_index > (max?.heat_index ?? 0) ? t : max),
        thermalHourly[0]
      );

      return NextResponse.json({
        success: true,
        ward_id: forecast.ward_id,
        ward_name: forecast.ward_name,
        city_id: forecast.city_id,
        centroid: forecast.centroid,
        generated_at: forecast.metadata.fetched_at,
        forecast_metadata: forecast.metadata,
        status,
        current,
        hourly: thermalHourly,
        summary: {
          maxHeatIndex: maxHI,
          minHeatIndex: minHI,
          currentRiskLevel: current.risk_level,
          peakHour: peak,
        },
      });
    }

    // 2. Point forecast query (coordinates given or default Pune center)
    const lat = parseFloat(latParam ?? '18.5204');
    const lon = parseFloat(lonParam ?? '73.8567');

    const pointForecast = await fetchPointWeatherForecast(lat, lon, 5);
    const thermalData = calculateHourlyThermalForecast(pointForecast);

    const heatIndices = thermalData.map((t) => t.heat_index);
    const maxHI = Math.round(Math.max(...heatIndices) * 10) / 10;
    const minHI = Math.round(Math.min(...heatIndices) * 10) / 10;
    const peak = thermalData.reduce(
      (max, t) => (t.heat_index > (max?.heat_index ?? 0) ? t : max),
      thermalData[0]
    );

    return NextResponse.json({
      location: { latitude: lat, longitude: lon },
      generated_at: pointForecast.generated_at,
      forecast_metadata: pointForecast.metadata,
      hourly: thermalData,
      summary: {
        maxHeatIndex: maxHI,
        minHeatIndex: minHI,
        currentRiskLevel: thermalData[0]?.risk_level ?? 'low',
        peakHour: peak,
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

    console.error('Thermal API error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate thermal stress' },
      { status: 500 }
    );
  }
}
