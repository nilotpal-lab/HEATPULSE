/**
 * HeatPulse — Milestone 6 Adversarial Stress & Edge-Case Verification Harness
 * Challenger 2 Test Suite
 * 
 * Focus Areas:
 * 1. Thermal Engine Boundary & Extreme Stress (T < 27°C, RH near 0% & 100%, adjustments, /0.34 scaling)
 * 2. Weather Fallback, Stale Cache & Upstream Failure Handling (503 unavailable, stale status, TTL)
 * 3. Ward Properties Edge Cases & GIS Fallbacks (missing centroid, invalid centroid, missing ward_name)
 * 4. Deterministic GeoJSON Integrity across 6 Cities (Bengaluru 369, Pune 15, Mumbai 24, Kolkata 141, Chennai 200, Coimbatore 100 = 849 wards)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  calculateHeatIndex,
  calculateWBGT,
  approximateUTCI,
  classifyHeatCondition,
  classifyThermalStress,
  calculateThermalCalculations,
  calculateThermalStress,
  calculateHourlyThermalForecast,
  getRecommendations,
} from '../heatpulse/src/lib/thermal-engine';

import {
  calculateThermalScore,
  calculateCompositeRisk,
  getWardVulnerability,
  assessWardRisk,
  classifyCompositeRiskLevel,
  classifyVulnerabilityLevel,
  ALPHA,
  BETA,
} from '../heatpulse/src/lib/risk-engine';

import {
  WeatherCache,
  calculateNwpRunTime,
  calculateValidTime,
  createForecastRunMetadata,
  NWP_ATTRIBUTION,
} from '../heatpulse/src/lib/weather-cache';

import {
  WeatherUnavailableError,
  getCityForecast,
  getWardForecast,
} from '../heatpulse/src/lib/weather-service';

import {
  loadCityGeoJson,
  getWardById,
  getWardByName,
  getWardCentroid,
  calculateCentroid,
  calculateBBox,
  calculateAreaSqKm,
  isValidRfc7946,
  getCityMetadata,
  getAllCities,
} from '../heatpulse/src/lib/gis-utils';

import { CityId, CITIES, WardFeature, WardFeatureCollection } from '../heatpulse/src/types/gis';
import { CityForecastRun, ForecastRunMetadata, WardWeatherForecast } from '../heatpulse/src/types/weather';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const HEATPULSE_DIR = path.join(REPO_ROOT, 'heatpulse');

async function runAdversarialStressSuite() {
  let passedChecks = 0;
  let failedChecks = 0;
  const failures: string[] = [];

  function assert(condition: boolean, testId: string, description: string, details?: string) {
    if (condition) {
      passedChecks++;
      console.log(`  [PASS] ${testId}: ${description}`);
    } else {
      failedChecks++;
      const msg = `  [FAIL] ${testId}: ${description}${details ? ` -> ${details}` : ''}`;
      console.error(msg);
      failures.push(msg);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('  HEATPULSE M6 ADVERSARIAL STRESS & DATA-TRUTH TEST HARNESS');
  console.log('  Challenger 2 Empirical Verification');
  console.log('='.repeat(80) + '\n');

  // ============================================================================
  // SECTION 1: THERMAL ENGINE BOUNDARY & EXTREME STRESS TESTING
  // ============================================================================
  console.log('--- SECTION 1: Thermal Engine Boundary & Extreme Stress Testing ---');

  // 1.1 Cold Temperature Boundaries (T < 20°C)
  {
    const coldTemps = [-50, -20, -5, 0, 5, 10, 15, 19.9];
    for (const tc of coldTemps) {
      const hi = calculateHeatIndex(tc, 50);
      const wbgt = calculateWBGT(tc, 50);
      const cond = classifyHeatCondition(tc);
      const stress = classifyThermalStress(hi);

      assert(
        hi === Math.round(tc * 10) / 10,
        `COLD-01-${tc}`,
        `At ${tc}°C, Heat Index directly returns ambient temperature (${hi}°C)`
      );
      assert(
        cond === 'Normal',
        `COLD-02-${tc}`,
        `At ${tc}°C, Heat Condition is 'Normal'`
      );
      assert(
        stress === 'Low',
        `COLD-03-${tc}`,
        `At ${tc}°C, Thermal Stress is 'Low'`
      );
      assert(
        !isNaN(wbgt) && isFinite(wbgt),
        `COLD-04-${tc}`,
        `At ${tc}°C, BoM WBGT yields finite number (${wbgt}°C)`
      );
    }
  }

  // 1.2 Intermediate Temperature Boundaries: 20°C <= T < 27°C (Steadman preliminary vs Rothfusz)
  {
    const testCases = [
      { t: 20.0, rh: 10 },
      { t: 20.0, rh: 90 },
      { t: 22.5, rh: 50 },
      { t: 25.0, rh: 40 },
      { t: 25.0, rh: 80 },
      { t: 26.5, rh: 50 },
      { t: 26.9, rh: 20 },
      { t: 26.9, rh: 95 },
    ];

    for (const { t, rh } of testCases) {
      const hi = calculateHeatIndex(t, rh);
      const wbgt = calculateWBGT(t, rh);
      const cond = classifyHeatCondition(t);
      const stress = classifyThermalStress(hi);

      assert(
        !isNaN(hi) && isFinite(hi),
        `SUB27-01-${t}-${rh}`,
        `At ${t}°C, ${rh}% RH: HI is finite (${hi}°C)`
      );
      assert(
        cond === 'Normal',
        `SUB27-02-${t}-${rh}`,
        `At ${t}°C (< 35°C), Heat Condition is 'Normal'`
      );
      assert(
        stress === 'Low' || stress === 'Moderate',
        `SUB27-03-${t}-${rh}`,
        `At ${t}°C (< 27°C ambient), Thermal Stress is '${stress}'`
      );
      assert(
        wbgt < t + 10,
        `SUB27-04-${t}-${rh}`,
        `At ${t}°C, ${rh}% RH: WBGT is sane (${wbgt}°C)`
      );
    }
  }

  // 1.3 Boundary Transition around 80°F (26.67°C)
  {
    const t_below = 26.6;
    const t_above = 26.8;
    const hi_below = calculateHeatIndex(t_below, 50);
    const hi_above = calculateHeatIndex(t_above, 50);
    assert(
      Math.abs(hi_above - hi_below) < 1.0,
      'TRANS-01',
      `Continuity across 80°F threshold: diff between ${t_below}°C (${hi_below}°C) and ${t_above}°C (${hi_above}°C) is smooth (< 1.0°C)`
    );
  }

  // 1.4 Extreme Low Relative Humidity Boundaries (RH near 0% and NWS Low-Humidity Adjustment)
  {
    const lowRhTemps = [27, 30, 35, 40, 44];
    for (const t of lowRhTemps) {
      const hi_0 = calculateHeatIndex(t, 0);
      const hi_5 = calculateHeatIndex(t, 5);
      const hi_12 = calculateHeatIndex(t, 12);

      assert(
        hi_0 < t,
        `LOWRH-01-${t}`,
        `At ${t}°C and 0% RH, dry air cooling reduces apparent heat index below ambient: ${hi_0}°C < ${t}°C`
      );
      assert(
        hi_0 <= hi_5 && hi_5 <= hi_12,
        `LOWRH-02-${t}`,
        `Monotonic increase with RH at ${t}°C: HI(0%) = ${hi_0} <= HI(5%) = ${hi_5} <= HI(12%) = ${hi_12}`
      );

      const wbgt_0 = calculateWBGT(t, 0);
      const expected_wbgt_0 = Math.round((0.567 * t + 3.94) * 10) / 10;
      assert(
        wbgt_0 === expected_wbgt_0,
        `LOWRH-03-${t}`,
        `At ${t}°C and 0% RH, BoM WBGT strictly equals 0.567*T + 3.94: ${wbgt_0}°C === ${expected_wbgt_0}°C`
      );
    }
  }

  // 1.5 Extreme High Relative Humidity Boundaries (RH near 100% and NWS High-Humidity Adjustment)
  {
    const highRhTemps = [27, 28, 29, 30];
    for (const t of highRhTemps) {
      const hi_85 = calculateHeatIndex(t, 85);
      const hi_95 = calculateHeatIndex(t, 95);
      const hi_100 = calculateHeatIndex(t, 100);

      assert(
        hi_100 > t + 3,
        `HIGHRH-01-${t}`,
        `At ${t}°C and 100% RH, intense sultriness drives HI significantly above ambient: ${hi_100}°C > ${t + 3}°C`
      );
      assert(
        hi_85 < hi_95 && hi_95 <= hi_100,
        `HIGHRH-02-${t}`,
        `Monotonic increase with humidity: HI(85%) = ${hi_85} < HI(95%) = ${hi_95} <= HI(100%) = ${hi_100}`
      );

      const wbgt_100 = calculateWBGT(t, 100);
      assert(
        wbgt_100 > t,
        `HIGHRH-03-${t}`,
        `At ${t}°C and 100% RH, saturated vapor pressure elevates BoM WBGT: ${wbgt_100}°C > ${t}°C`
      );
    }
  }

  // 1.6 Humidity Clamping (RH < 0% and RH > 100%)
  {
    const hi_neg = calculateHeatIndex(35, -25);
    const hi_zero = calculateHeatIndex(35, 0);
    assert(
      hi_neg === hi_zero,
      'CLAMP-01',
      `Negative humidity (-25%) is clamped to 0%: ${hi_neg}°C === ${hi_zero}°C`
    );

    const hi_overflow = calculateHeatIndex(35, 150);
    const hi_hundred = calculateHeatIndex(35, 100);
    assert(
      hi_overflow === hi_hundred,
      'CLAMP-02',
      `Overflow humidity (150%) is clamped to 100%: ${hi_overflow}°C === ${hi_hundred}°C`
    );

    const wbgt_neg = calculateWBGT(35, -20);
    const wbgt_zero = calculateWBGT(35, 0);
    assert(
      wbgt_neg === wbgt_zero,
      'CLAMP-03',
      `WBGT negative humidity clamped to 0%: ${wbgt_neg}°C === ${wbgt_zero}°C`
    );

    const wbgt_overflow = calculateWBGT(35, 130);
    const wbgt_hundred = calculateWBGT(35, 100);
    assert(
      wbgt_overflow === wbgt_hundred,
      'CLAMP-04',
      `WBGT overflow humidity clamped to 100%: ${wbgt_overflow}°C === ${wbgt_hundred}°C`
    );
  }

  // 1.7 Extreme Heatwave Conditions (T = 45°C, 50°C, 55°C)
  {
    const extremeTemps = [45, 48, 52, 55];
    for (const t of extremeTemps) {
      const calc = calculateThermalCalculations(t, 40, t + 4);
      assert(
        calc.heat_condition === 'Extreme',
        `EXTR-01-${t}`,
        `At ${t}°C, Heat Condition is 'Extreme'`
      );
      assert(
        calc.thermal_stress === 'Severe',
        `EXTR-02-${t}`,
        `At ${t}°C, Thermal Stress is 'Severe' (HI=${calc.heat_index}°C)`
      );

      const score = calculateThermalScore(calc.heat_index);
      assert(
        score === 100,
        `EXTR-03-${t}`,
        `At HI ${calc.heat_index}°C, thermal score safely saturates at 100`
      );
    }
  }

  // 1.8 Thermal Score Scaling Correction Verification (/ 0.34)
  {
    assert(calculateThermalScore(18) === 0, 'SCALE-01', 'Thermal score at HI <= 20°C is 0');
    assert(calculateThermalScore(20) === 0, 'SCALE-02', 'Thermal score at HI = 20°C is 0');

    // HI = 54°C (extreme danger): (54 - 20) / 0.34 = 34 / 0.34 = 100
    const score_54 = calculateThermalScore(54);
    assert(
      score_54 === 100,
      'SCALE-03',
      `Thermal score at HI 54°C is exactly 100 (got ${score_54}). Confirms / 0.34 fix (not / 3.4)`
    );

    // HI = 37°C (midpoint): (37 - 20) / 0.34 = 17 / 0.34 = 50
    const score_37 = calculateThermalScore(37);
    assert(
      score_37 === 50,
      'SCALE-04',
      `Thermal score at HI 37°C is exactly 50 (got ${score_37})`
    );

    // Check legacy bug would yield 10 instead of 100
    const legacyBugScore = (54 - 20) / 3.4;
    assert(
      legacyBugScore === 10 && score_54 === 100,
      'SCALE-05',
      'Confirms legacy / 3.4 deflation defect (yielding 10) is completely eliminated'
    );
  }

  // 1.9 Composite Risk Formula & Convex Combination
  {
    const cr1 = calculateCompositeRisk(100, 100);
    assert(
      cr1.composite_score === 100 && cr1.composite_level === 'Severe',
      'COMPOSITE-01',
      'Max risk: thermal 100 + vuln 100 => composite 100 (Severe)'
    );

    const cr2 = calculateCompositeRisk(0, 0);
    assert(
      cr2.composite_score === 0 && cr2.composite_level === 'Low',
      'COMPOSITE-02',
      'Min risk: thermal 0 + vuln 0 => composite 0 (Low)'
    );

    const cr3 = calculateCompositeRisk(80, 30);
    assert(
      cr3.composite_score === 60 && cr3.composite_level === 'High',
      'COMPOSITE-03',
      `Weighted risk: 0.6*80 + 0.4*30 = 60 (High, got ${cr3.composite_score})`
    );

    assert(
      cr3.contributing_factors.primary_driver === 'Atmospheric Heat Stress',
      'COMPOSITE-04',
      'Thermal 80 > Vuln 30 correctly identifies Atmospheric Heat Stress as primary driver'
    );

    const cr4 = calculateCompositeRisk(20, 80);
    assert(
      cr4.contributing_factors.primary_driver === 'Built Environment Vulnerability',
      'COMPOSITE-05',
      'Thermal 20 < Vuln 80 correctly identifies Built Environment Vulnerability as primary driver'
    );
  }

  // ============================================================================
  // SECTION 2: WEATHER FALLBACK, STALE CACHE & ERROR HANDLING
  // ============================================================================
  console.log('\n--- SECTION 2: Weather Fallback, Stale Cache & Error Handling ---');

  // 2.1 WeatherCache In-Memory Lifecycle & Stale Tracking
  {
    const testCache = new WeatherCache(1000);

    const dummyRun: CityForecastRun = {
      city_id: 'pune',
      run_time: '2026-09-06T06:00:00Z',
      fetched_at: '2026-09-06T09:30:00Z',
      metadata: {
        run_time: '2026-09-06T06:00:00Z',
        fetched_at: '2026-09-06T09:30:00Z',
        valid_time: '2026-09-06T15:00',
        provider: 'Open-Meteo NWP Grid',
        model: 'ECMWF IFS / GFS Seamless',
        status: 'fresh',
        attribution: NWP_ATTRIBUTION,
      },
      wards: {
        'pun-001': {
          ward_id: 'pun-001',
          ward_name: 'Admin Ward 01 Aundh',
          city_id: 'pune',
          centroid: [73.805, 18.558],
          current: {
            time: '2026-09-06T15:00',
            temperature_2m: 32.5,
            relative_humidity_2m: 55,
            apparent_temperature: 36.2,
            wind_speed_10m: 12,
            direct_normal_irradiance: 450,
            surface_pressure: 955,
            weather_code: 1,
          },
          hourly: {
            time: ['2026-09-06T15:00'],
            temperature_2m: [32.5],
            relative_humidity_2m: [55],
            apparent_temperature: [36.2],
          },
          metadata: {
            run_time: '2026-09-06T06:00:00Z',
            fetched_at: '2026-09-06T09:30:00Z',
            valid_time: '2026-09-06T15:00',
            provider: 'Open-Meteo NWP Grid',
            model: 'ECMWF IFS / GFS Seamless',
            status: 'fresh',
            attribution: NWP_ATTRIBUTION,
          },
          attribution: NWP_ATTRIBUTION,
        },
      },
      cached_at: Date.now(),
      expires_at: Date.now() + 50,
    };

    testCache.set('pune', dummyRun, 50);

    const freshResult = testCache.get('pune', { allowStale: false });
    assert(
      freshResult !== null && !freshResult.isStale,
      'CACHE-01',
      'Freshly stored cache entry is returned with isStale: false'
    );
    assert(
      testCache.hasFreshRun('pune') === true,
      'CACHE-02',
      'hasFreshRun() returns true for fresh cache entry'
    );

    // Busy wait 65ms
    const start = Date.now();
    while (Date.now() - start < 65) {}

    const expiredResultNoStale = testCache.get('pune', { allowStale: false });
    assert(
      expiredResultNoStale === null,
      'CACHE-03',
      'Expired entry returns null when allowStale is false'
    );

    const expiredResultWithStale = testCache.get('pune', { allowStale: true });
    assert(
      expiredResultWithStale !== null && expiredResultWithStale.isStale === true,
      'CACHE-04',
      'Expired entry returns entry with isStale: true when allowStale is true'
    );

    const latestRun = testCache.getLatest('pune');
    assert(
      latestRun !== null && latestRun.run_time === '2026-09-06T06:00:00Z',
      'CACHE-05',
      'getLatest() returns cached entry regardless of TTL expiry'
    );

    testCache.clear();
    assert(
      testCache.getLatest('pune') === null,
      'CACHE-06',
      'clear() removes all cached runs and city pointers'
    );
  }

  // 2.2 WeatherUnavailableError Construction & Properties
  {
    const err = new WeatherUnavailableError('Custom test unavailable message', 503);
    assert(
      err.name === 'WeatherUnavailableError',
      'ERR-01',
      'WeatherUnavailableError has correct name'
    );
    assert(
      err.statusCode === 503,
      'ERR-02',
      'WeatherUnavailableError status code is 503'
    );
    assert(
      err.status === 'unavailable',
      'ERR-03',
      'WeatherUnavailableError status field is "unavailable"'
    );
    assert(
      err.message === 'Custom test unavailable message',
      'ERR-04',
      'WeatherUnavailableError retains custom message'
    );
  }

  // 2.3 Unsupported City Error Handling
  {
    let errorCaught = false;
    try {
      await getCityForecast('atlantis');
    } catch (e: any) {
      errorCaught = true;
      assert(
        e.message.includes('Unsupported city: atlantis'),
        'CITY-ERR-01',
        `Querying unsupported city throws descriptive error: "${e.message}"`
      );
    }
    assert(errorCaught, 'CITY-ERR-02', 'Unsupported city lookup threw error as required');
  }

  // 2.4 NWP Run Time & Valid Time Calculations
  {
    const fixedDate = new Date('2026-09-06T15:45:00Z');
    const runTime = calculateNwpRunTime(fixedDate);
    assert(
      runTime === '2026-09-06T12:00:00Z',
      'NWP-TIME-01',
      `NWP initialization cycle calculation with 3.5h latency: expected 2026-09-06T12:00:00Z, got ${runTime}`
    );

    const validTime = calculateValidTime(['2026-09-06T21:00', '2026-09-06T22:00'], fixedDate);
    assert(
      validTime === '2026-09-06T21:00',
      'VALID-TIME-01',
      `Valid time calculation aligns with IST forecast hour: expected 2026-09-06T21:00, got ${validTime}`
    );
  }

  // 2.5 Empty and Single-Entry Hourly Weather Handling in Thermal Engine
  {
    const emptyHourlyResult = calculateHourlyThermalForecast({ hourly: [] });
    assert(
      Array.isArray(emptyHourlyResult) && emptyHourlyResult.length === 0,
      'HOURLY-EMPTY-01',
      'calculateHourlyThermalForecast handles empty array without crashing or throwing'
    );

    const singleHourly = calculateHourlyThermalForecast({
      hourly: [
        {
          time: '2026-09-06T12:00',
          temperature_2m: 35.0,
          relative_humidity_2m: 50.0,
          apparent_temperature: 39.5,
        },
      ],
    });
    assert(
      singleHourly.length === 1 && singleHourly[0].heat_condition === 'Elevated',
      'HOURLY-SINGLE-01',
      'calculateHourlyThermalForecast handles single-element array correctly'
    );
  }

  // ============================================================================
  // SECTION 3: WARD PROPERTIES EDGE CASES & GIS FALLBACKS
  // ============================================================================
  console.log('\n--- SECTION 3: Ward Properties Edge Cases & GIS Fallbacks ---');

  // 3.1 Missing centroid in properties falls back to calculateCentroid(geometry)
  {
    const mockFeatureWithoutCentroid: WardFeature = {
      type: 'Feature',
      id: 'blr-999',
      properties: {
        city_id: 'bengaluru',
        ward_id: 'blr-999',
        ward_name: 'Test Ward Without Centroid',
      } as any,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.5, 12.9],
            [77.6, 12.9],
            [77.6, 13.0],
            [77.5, 13.0],
            [77.5, 12.9],
          ],
        ],
      },
    };

    const centroid = getWardCentroid(mockFeatureWithoutCentroid);
    assert(
      Array.isArray(centroid) && centroid.length === 2,
      'GIS-FB-01',
      `Feature missing properties.centroid successfully falls back to calculateCentroid: [${centroid.join(', ')}]`
    );
    assert(
      Math.abs(centroid[0] - 77.55) < 0.001 && Math.abs(centroid[1] - 12.95) < 0.001,
      'GIS-FB-02',
      `Centroid computed via planar Shoelace formula is accurate: [${centroid[0]}, ${centroid[1]}] ~ [77.55, 12.95]`
    );
  }

  // 3.2 Invalid / Out-of-Bounds centroid falls back to geometry calculation
  {
    const mockFeatureWithInvalidCentroid: WardFeature = {
      type: 'Feature',
      id: 'blr-998',
      properties: {
        city_id: 'bengaluru',
        ward_id: 'blr-998',
        ward_name: 'Test Ward With Out of Bounds Centroid',
        centroid: [0, 0],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.5, 12.9],
            [77.6, 12.9],
            [77.6, 13.0],
            [77.5, 13.0],
            [77.5, 12.9],
          ],
        ],
      },
    };

    const centroid = getWardCentroid(mockFeatureWithInvalidCentroid);
    assert(
      centroid[0] >= 68 && centroid[0] <= 98 && centroid[1] >= 8 && centroid[1] <= 38,
      'GIS-FB-03',
      `Invalid [0, 0] centroid rejected by isValidRfc7946 and computed from geometry: [${centroid.join(', ')}]`
    );
  }

  // 3.3 Degenerate Geometry Fallback in Centroid Calculation
  {
    // Collinear/degenerate polygon with zero area: Shoelace yields 0, falls back to arithmetic mean
    const degenerateGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [77.5, 12.9],
          [77.6, 12.9],
          [77.5, 12.9],
        ],
      ],
    };
    const degenCentroid = calculateCentroid(degenerateGeometry);
    assert(
      !isNaN(degenCentroid[0]) && !isNaN(degenCentroid[1]),
      'DEGEN-01',
      `Degenerate zero-area polygon falls back to arithmetic vertex mean: [${degenCentroid.join(', ')}]`
    );

    // Unsupported geometry type throws descriptive error
    let unsupportedGeomCaught = false;
    try {
      calculateCentroid({ type: 'Point', coordinates: [77.5, 12.9] } as any);
    } catch (e: any) {
      unsupportedGeomCaught = true;
      assert(
        e.message.includes('Unsupported geometry type'),
        'DEGEN-02',
        `Unsupported geometry throws: "${e.message}"`
      );
    }
    assert(unsupportedGeomCaught, 'DEGEN-03', 'Unsupported geometry throws error as required');
  }

  // 3.4 getWardById and getWardByName Edge Cases
  {
    const blrGeoJson = await loadCityGeoJson('bengaluru', path.join(HEATPULSE_DIR, 'public'));
    
    const nonExistent = getWardById(blrGeoJson, 'blr-99999');
    assert(
      nonExistent === undefined,
      'GIS-LOOKUP-01',
      'getWardById with nonexistent ID safely returns undefined without throwing'
    );

    const emptyLookup = getWardById(blrGeoJson, '');
    assert(
      emptyLookup === undefined,
      'GIS-LOOKUP-02',
      'getWardById with empty string safely returns undefined'
    );

    const caseUpper = getWardById(blrGeoJson, 'BLR-001');
    const caseLower = getWardById(blrGeoJson, 'blr-001');
    assert(
      caseUpper !== undefined && caseUpper.properties.ward_id === 'blr-001',
      'GIS-LOOKUP-03',
      'getWardById is case-insensitive (BLR-001 resolves to blr-001)'
    );
    assert(
      caseUpper === caseLower,
      'GIS-LOOKUP-04',
      'getWardById yields identical feature regardless of case'
    );

    const firstName = blrGeoJson.features[0].properties.ward_name;
    const byNameTrimmed = getWardByName(blrGeoJson, `  ${firstName.toUpperCase()}  `);
    assert(
      byNameTrimmed !== undefined && byNameTrimmed.properties.ward_id === blrGeoJson.features[0].properties.ward_id,
      'GIS-LOOKUP-05',
      `getWardByName correctly handles whitespace trimming and case conversion for "${firstName}"`
    );
  }

  // 3.5 Missing Optional Properties in WardFeature
  {
    const minimalWard: WardFeature = {
      type: 'Feature',
      id: 'blr-997',
      properties: {
        city_id: 'bengaluru',
        ward_id: 'blr-997',
        ward_name: 'Minimal Ward',
        centroid: [77.55, 12.95],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.5, 12.9],
            [77.6, 12.9],
            [77.6, 13.0],
            [77.5, 13.0],
            [77.5, 12.9],
          ],
        ],
      },
    };

    const risk = assessWardRisk({
      ward_id: minimalWard.properties.ward_id,
      ward_name: minimalWard.properties.ward_name,
      city_id: minimalWard.properties.city_id,
      temperature: 33.0,
      humidity: 50.0,
      apparentTemperature: 36.0,
      forecast_metadata: createForecastRunMetadata({}),
    });

    assert(
      risk.composite_risk_score >= 0 && risk.composite_risk_score <= 100,
      'MINIMAL-WARD-01',
      'assessWardRisk succeeds on feature with only minimal required properties'
    );
    assert(
      risk.contributing_factors.atmospheric_pct + risk.contributing_factors.vulnerability_pct === 100,
      'MINIMAL-WARD-02',
      'Contributing factors sum to 100% on minimal feature'
    );
  }

  // 3.6 Baseline Vulnerability for Any Ward without Hardcoding
  {
    const puneVuln = getWardVulnerability('pune', 'Admin Ward 01 Aundh');
    assert(
      puneVuln.is_estimated_baseline === true,
      'VULN-01',
      'Pune vulnerability is explicitly tagged is_estimated_baseline: true'
    );
    assert(
      puneVuln.score >= 0 && puneVuln.score <= 100,
      'VULN-02',
      `Pune vulnerability score is bounded: ${puneVuln.score}`
    );

    const blrVuln = getWardVulnerability('bengaluru', 'blr-001');
    assert(
      blrVuln.is_estimated_baseline === true && blrVuln.score >= 0 && blrVuln.score <= 100,
      'VULN-03',
      `Bengaluru ward baseline vulnerability is bounded and transparent: score=${blrVuln.score}`
    );

    const blrVulnRepeat = getWardVulnerability('bengaluru', 'blr-001');
    assert(
      blrVuln.score === blrVulnRepeat.score,
      'VULN-04',
      'getWardVulnerability hash is 100% deterministic on repeated invocations'
    );
  }

  // ============================================================================
  // SECTION 4: DETERMINISTIC GEOJSON INTEGRITY ACROSS ALL 6 CITIES (849 WARDS)
  // ============================================================================
  console.log('\n--- SECTION 4: Deterministic GeoJSON Integrity across 6 Cities (849 Wards) ---');

  const EXPECTED_CITY_SPECS = [
    { id: 'bengaluru', expectedCount: 369, prefix: 'blr-', file: 'bengaluru-gba-369-wards.geojson' },
    { id: 'pune', expectedCount: 15, prefix: 'pun-', file: 'pune-15-wards.geojson' },
    { id: 'mumbai', expectedCount: 24, prefix: 'mum-', file: 'mumbai-24-wards.geojson' },
    { id: 'kolkata', expectedCount: 141, prefix: 'kol-', file: 'kolkata-141-wards.geojson' },
    { id: 'chennai', expectedCount: 200, prefix: 'chn-', file: 'chennai-200-wards.geojson' },
    { id: 'coimbatore', expectedCount: 100, prefix: 'cbe-', file: 'coimbatore-100-wards.geojson' },
  ];

  let globalTotalWards = 0;
  const allWardIds = new Set<string>();
  const allFeatureIds = new Set<string>();

  for (const city of EXPECTED_CITY_SPECS) {
    const geojson = await loadCityGeoJson(city.id as CityId, path.join(HEATPULSE_DIR, 'public'));
    
    assert(
      geojson.type === 'FeatureCollection',
      `GEO-${city.id}-01`,
      `${city.id} GeoJSON is a valid FeatureCollection`
    );

    assert(
      geojson.features.length === city.expectedCount,
      `GEO-${city.id}-02`,
      `${city.id} has exactly ${city.expectedCount} wards (got ${geojson.features.length})`
    );

    globalTotalWards += geojson.features.length;

    let cityRingCount = 0;
    let cityRingClosedCount = 0;
    let invalidCoordsCount = 0;
    let invertedCoordsCount = 0;
    let missingCentroidsCount = 0;

    for (const feature of geojson.features) {
      const wid = feature.properties.ward_id;
      const fid = String(feature.id ?? '');

      if (allWardIds.has(wid)) {
        failures.push(`Duplicate ward_id collision: ${wid}`);
      }
      allWardIds.add(wid);

      if (fid) {
        if (allFeatureIds.has(fid)) {
          failures.push(`Duplicate feature.id collision: ${fid}`);
        }
        allFeatureIds.add(fid);
      }

      if (!wid.startsWith(city.prefix)) {
        failures.push(`Ward ID ${wid} does not start with expected prefix ${city.prefix}`);
      }

      const geom = feature.geometry;
      if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') {
        failures.push(`Ward ${wid} has invalid geometry type: ${geom.type}`);
      }

      const polygons: number[][][][] = geom.type === 'Polygon' ? [geom.coordinates as any] : geom.coordinates as any;
      for (const poly of polygons) {
        for (const ring of poly) {
          cityRingCount++;
          const first = ring[0];
          const last = ring[ring.length - 1];
          if (first[0] === last[0] && first[1] === last[1]) {
            cityRingClosedCount++;
          }

          for (const coord of ring) {
            const [lon, lat] = coord;
            if (lon < 68 || lon > 98 || lat < 8 || lat > 38) {
              invalidCoordsCount++;
            }
            if (lon <= lat) {
              invertedCoordsCount++;
            }
          }
        }
      }

      const centroid = getWardCentroid(feature);
      if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) {
        missingCentroidsCount++;
      } else {
        if (centroid[0] < 68 || centroid[0] > 98 || centroid[1] < 8 || centroid[1] > 38) {
          missingCentroidsCount++;
        }
        if (centroid[0] <= centroid[1]) {
          missingCentroidsCount++;
        }
      }
    }

    assert(
      cityRingCount === cityRingClosedCount,
      `GEO-${city.id}-03`,
      `All ${cityRingCount} linear rings in ${city.id} are strictly closed (first === last vertex)`
    );
    assert(
      invalidCoordsCount === 0,
      `GEO-${city.id}-04`,
      `Zero coordinates outside India domain in ${city.id}`
    );
    assert(
      invertedCoordsCount === 0,
      `GEO-${city.id}-05`,
      `Zero coordinate inversions (lon > lat strictly maintained) in ${city.id}`
    );
    assert(
      missingCentroidsCount === 0,
      `GEO-${city.id}-06`,
      `All ${city.expectedCount} features in ${city.id} have valid, finite, non-NaN centroids`
    );
  }

  assert(
    globalTotalWards === 849,
    'GEO-GLOBAL-01',
    `Total municipal wards across all 6 cities equals exactly 849 (got ${globalTotalWards})`
  );

  assert(
    allWardIds.size === 849,
    'GEO-GLOBAL-02',
    `All 849 properties.ward_id values are globally unique (zero collisions)`
  );

  // Raw source file immutability check
  const rawGbaPath = path.join(REPO_ROOT, 'wards_bengaluru_gba.geojson');
  assert(
    fs.existsSync(rawGbaPath),
    'SOURCE-IMMUTABLE-01',
    'Source file wards_bengaluru_gba.geojson exists in root'
  );
  const rawStats = fs.statSync(rawGbaPath);
  assert(
    rawStats.size === 3052583,
    'SOURCE-IMMUTABLE-02',
    `Source file size is strictly 3,052,583 bytes (actual: ${rawStats.size})`
  );
  const rawSha256 = crypto.createHash('sha256').update(fs.readFileSync(rawGbaPath)).digest('hex');
  assert(
    rawSha256 === '6dff0924e3d938bfc63fc1ed292429ff41b95ed18459a3aa494b88a6be6691ce',
    'SOURCE-IMMUTABLE-03',
    `Source file SHA256 hash strictly matches original (6dff0924...)`
  );

  // ============================================================================
  // SUMMARY & VERDICT
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('  M6 ADVERSARIAL STRESS TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Passed Checks: ${passedChecks}`);
  console.log(`  Failed Checks: ${failedChecks}`);
  console.log(`  Total Checks:  ${passedChecks + failedChecks}`);
  console.log('='.repeat(80) + '\n');

  if (failedChecks > 0) {
    console.error(`FAILED: ${failedChecks} checks failed! Details:`);
    for (const f of failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  } else {
    console.log('SUCCESS: All M6 Adversarial Stress & Edge-Case Checks PASSED!\n');
    process.exit(0);
  }
}

runAdversarialStressSuite().catch((err) => {
  console.error('Unhandled error during test run:', err);
  process.exit(1);
});
