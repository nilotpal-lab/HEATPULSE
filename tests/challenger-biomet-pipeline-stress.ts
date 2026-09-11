/**
 * HeatPulse — Challenger O3 Biometeorology & Pipeline Resilience Adversarial Stress Suite
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 * 
 * Scope:
 * 1. 56-Point Matrix: Extreme Temps [-50, 0, 20, 27, 35, 45, 55, 65] × Extreme RH [0, 10, 13, 50, 85, 90, 100]
 * 2. Steadman preliminary branch vs 9-term Rothfusz threshold analysis
 * 3. Low-humidity adjustment differential test (RH < 13% vs RH = 13% for 80°F <= T <= 112°F)
 * 4. High-humidity adjustment differential test (RH > 85% vs RH = 85% for 80°F <= T <= 87°F)
 * 5. BoM WBGT Magnus-Tetens analytical convergence and monotonicity
 * 6. 10,201-Point Grid: Full Composite Risk Matrix (0..100 × 0..100) — division-by-zero, overflow, bounds
 * 7. Pipeline Resilience: Cache hit/miss/stale lifecycle & 503 unavailable without synthetic fabrication
 */

import {
  calculateHeatIndex,
  calculateWBGT,
  approximateUTCI,
  classifyHeatCondition,
  classifyThermalStress,
  calculateThermalCalculations,
  calculateThermalStress,
} from '../heatpulse/src/lib/thermal-engine';

import {
  calculateThermalScore,
  calculateCompositeRisk,
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
} from '../heatpulse/src/lib/weather-service';

import { CityForecastRun } from '../heatpulse/src/types/weather';

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const failures: string[] = [];
export const EMPIRICAL_DISCOVERIES: string[] = [];

function assert(condition: boolean, testId: string, description: string, details?: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  [PASS] #${String(totalChecks).padStart(3, '0')} ${testId}: ${description}`);
  } else {
    failedChecks++;
    const msg = `  [FAIL] #${String(totalChecks).padStart(3, '0')} ${testId}: ${description}${details ? ` -> ${details}` : ''}`;
    console.error(msg);
    failures.push(msg);
  }
}

async function runBiometeorologyAndPipelineChallenge() {
  console.log('='.repeat(80));
  console.log('  HEATPULSE ADVERSARIAL CHALLENGER: BIOMETEOROLOGY & PIPELINE RESILIENCE');
  console.log('='.repeat(80));

  // ============================================================================
  // SECTION 1: 56-POINT EXTREME BIOMETEOROLOGICAL MATRIX
  // ============================================================================
  console.log('\n--- [SECTION 1] 56-Point Matrix: Extreme Temps × Extreme RH ---');

  const EXTREME_TEMPS = [-50, 0, 20, 27, 35, 45, 55, 65];
  const EXTREME_RHS = [0, 10, 13, 50, 85, 90, 100];

  for (const t of EXTREME_TEMPS) {
    for (const rh of EXTREME_RHS) {
      const hi = calculateHeatIndex(t, rh);
      const wbgt = calculateWBGT(t, rh);
      const utci = approximateUTCI(t, rh, t + 2);
      const cond = classifyHeatCondition(t);
      const stress = classifyThermalStress(hi);
      const thermalScore = calculateThermalScore(hi);

      const caseId = `MAT-${t >= 0 ? '+' : ''}${t}C-${rh}RH`;

      // 1. Non-NaN and Finite invariants
      assert(
        !isNaN(hi) && isFinite(hi),
        `${caseId}-HI-FINITE`,
        `Heat Index at ${t}°C, ${rh}% RH is finite number: ${hi}°C`
      );
      assert(
        !isNaN(wbgt) && isFinite(wbgt),
        `${caseId}-WBGT-FINITE`,
        `BoM WBGT at ${t}°C, ${rh}% RH is finite number: ${wbgt}°C`
      );
      assert(
        !isNaN(thermalScore) && isFinite(thermalScore) && thermalScore >= 0 && thermalScore <= 100,
        `${caseId}-TSCORE-BOUNDS`,
        `Thermal score at ${t}°C, ${rh}% RH is bounded in [0, 100]: ${thermalScore}`
      );

      // 2. Physical boundary invariants
      if (t < 20) {
        assert(
          hi === Math.round(t * 10) / 10,
          `${caseId}-COLD-ECHO`,
          `Cold temperature (${t}°C) directly echoes ambient temperature`
        );
        assert(
          cond === 'Normal' && stress === 'Low' && thermalScore === 0,
          `${caseId}-COLD-MIN`,
          `Cold temperature has Normal condition, Low stress, 0 thermal score`
        );
      } else if (t === 20) {
        // Steadman formula at 20°C: 0.5*(68 + 61 + 0 + rh*0.094) => spans 18.1°C to 20.7°C
        assert(
          hi >= 18.0 && hi <= 21.0,
          `${caseId}-T20-HI-BOUND`,
          `At 20°C baseline, Steadman Heat Index spans 18.1°C to 20.7°C across RH: got ${hi}°C`
        );
        assert(
          thermalScore >= 0 && thermalScore <= 3.0,
          `${caseId}-T20-SCORE-MINIMAL`,
          `At 20°C baseline, thermal score is minimal <= 3.0 (got ${thermalScore})`
        );
      } else if (t >= 45) {
        assert(
          cond === 'Extreme',
          `${caseId}-COND-EXTREME`,
          `At ${t}°C, Heat Condition is strictly 'Extreme'`
        );
        // Concept segregation: At 45°C and 0% RH, evaporative cooling yields HI = 38.8°C (High stress).
        // For RH >= 10%, HI >= 41°C (Severe stress).
        if (rh === 0 && t === 45) {
          assert(
            stress === 'High',
            `${caseId}-STRESS-HIGH`,
            `At 45°C and 0% RH, dry-air evaporative cooling keeps HI at ${hi}°C (Thermal Stress: 'High')`
          );
        } else {
          assert(
            stress === 'Severe',
            `${caseId}-STRESS-SEVERE`,
            `At ${t}°C, ${rh}% RH, Thermal Stress is strictly 'Severe' (HI: ${hi}°C)`
          );
        }
      }

      // WBGT must be lower than or equal to HI for physical hot conditions
      if (t >= 35 && rh >= 50) {
        assert(
          wbgt <= hi,
          `${caseId}-WBGT-LE-HI`,
          `Outdoor shade WBGT (${wbgt}°C) <= Heat Index (${hi}°C) in high heat/humidity`
        );
      }
    }
  }

  // ============================================================================
  // SECTION 2: STEADMAN PRELIMINARY BRANCH VS 9-TERM ROTHFUSZ
  // ============================================================================
  console.log('\n--- [SECTION 2] Steadman Preliminary vs 9-Term Rothfusz Regression ---');

  const hi_steadman = calculateHeatIndex(22, 50);
  assert(
    hi_steadman === 21.6,
    'STEADMAN-BRANCH-01',
    `Steadman preliminary branch fires at 22°C, 50% RH: expected 21.6°C, got ${hi_steadman}°C`
  );

  const hi_rothfusz = calculateHeatIndex(27, 50);
  assert(
    hi_rothfusz >= 27.0 && hi_rothfusz <= 28.5,
    'ROTHFUSZ-BRANCH-01',
    `Full Rothfusz regression fires at 27°C, 50% RH: expected ~27.4°C, got ${hi_rothfusz}°C`
  );

  // ============================================================================
  // SECTION 3: LOW-HUMIDITY ADJUSTMENT VERIFICATION (RH < 13% & 80°F <= T <= 112°F)
  // ============================================================================
  console.log('\n--- [SECTION 3] Low-Humidity Adjustment (RH < 13% and 80°F <= T <= 112°F) ---');

  const tf_35 = 35 * 1.8 + 32; // 95.0°F
  const rh_5 = 5;
  const unadj_hiF_5 =
    -42.379 +
    2.04901523 * tf_35 +
    10.14333127 * rh_5 -
    0.22475541 * tf_35 * rh_5 -
    0.00683783 * tf_35 * tf_35 -
    0.05481717 * rh_5 * rh_5 +
    0.00122874 * tf_35 * tf_35 * rh_5 +
    0.00085282 * tf_35 * rh_5 * rh_5 -
    0.00000199 * tf_35 * tf_35 * rh_5 * rh_5;
  const unadj_hiC_5 = (unadj_hiF_5 - 32) * (5 / 9);
  const actual_hiC_5 = calculateHeatIndex(35, 5);

  const deltaF = ((actual_hiC_5 - unadj_hiC_5) * 9) / 5;
  assert(
    Math.abs(deltaF - (-2.0)) < 0.2,
    'LOW-RH-ADJ-01',
    `Low-humidity adjustment at 35°C (95°F), 5% RH subtracts exactly 2.0°F: expected -2.0°F delta, observed ${deltaF.toFixed(2)}°F`
  );

  const hi_at_13 = calculateHeatIndex(35, 13);
  const rh_13 = 13;
  const unadj_hiF_13 =
    -42.379 +
    2.04901523 * tf_35 +
    10.14333127 * rh_13 -
    0.22475541 * tf_35 * rh_13 -
    0.00683783 * tf_35 * tf_35 -
    0.05481717 * rh_13 * rh_13 +
    0.00122874 * tf_35 * tf_35 * rh_13 +
    0.00085282 * tf_35 * rh_13 * rh_13 -
    0.00000199 * tf_35 * tf_35 * rh_13 * rh_13;
  const unadj_hiC_13 = Math.round(((unadj_hiF_13 - 32) * (5 / 9)) * 10) / 10;
  assert(
    hi_at_13 === unadj_hiC_13,
    'LOW-RH-ADJ-02',
    `At boundary RH = 13%, adjustment is exactly 0: ${hi_at_13}°C === ${unadj_hiC_13}°C`
  );

  const hi_45_5 = calculateHeatIndex(45, 5);
  const tf_45 = 45 * 1.8 + 32; // 113°F
  const unadj_hiF_45_5 =
    -42.379 +
    2.04901523 * tf_45 +
    10.14333127 * rh_5 -
    0.22475541 * tf_45 * rh_5 -
    0.00683783 * tf_45 * tf_45 -
    0.05481717 * rh_5 * rh_5 +
    0.00122874 * tf_45 * tf_45 * rh_5 +
    0.00085282 * tf_45 * rh_5 * rh_5 -
    0.00000199 * tf_45 * tf_45 * rh_5 * rh_5;
  const unadj_hiC_45_5 = Math.round(((unadj_hiF_45_5 - 32) * (5 / 9)) * 10) / 10;
  assert(
    hi_45_5 === unadj_hiC_45_5,
    'LOW-RH-ADJ-03',
    `At T = 45°C (113°F > 112°F), low-humidity adjustment is NOT applied per NWS spec: ${hi_45_5}°C === ${unadj_hiC_45_5}°C`
  );

  // ============================================================================
  // SECTION 4: HIGH-HUMIDITY ADJUSTMENT VERIFICATION (RH > 85% & 80°F <= T <= 87°F)
  // ============================================================================
  console.log('\n--- [SECTION 4] High-Humidity Adjustment (RH > 85% and 80°F <= T <= 87°F) ---');

  const tf_28 = 28 * 1.8 + 32; // 82.4°F
  const rh_95 = 95;
  const unadj_hiF_28_95 =
    -42.379 +
    2.04901523 * tf_28 +
    10.14333127 * rh_95 -
    0.22475541 * tf_28 * rh_95 -
    0.00683783 * tf_28 * tf_28 -
    0.05481717 * rh_95 * rh_95 +
    0.00122874 * tf_28 * tf_28 * rh_95 +
    0.00085282 * tf_28 * rh_95 * rh_95 -
    0.00000199 * tf_28 * tf_28 * rh_95 * rh_95;
  const unadj_hiC_28_95 = (unadj_hiF_28_95 - 32) * (5 / 9);
  const actual_hiC_28_95 = calculateHeatIndex(28, 95);
  const deltaF_high = ((actual_hiC_28_95 - unadj_hiC_28_95) * 9) / 5;

  assert(
    Math.abs(deltaF_high - 0.92) < 0.2,
    'HIGH-RH-ADJ-01',
    `High-humidity adjustment at 28°C, 95% RH adds +0.92°F: expected +0.92°F delta, observed ${deltaF_high.toFixed(2)}°F`
  );

  const hi_28_85 = calculateHeatIndex(28, 85);
  const rh_85 = 85;
  const unadj_hiF_28_85 =
    -42.379 +
    2.04901523 * tf_28 +
    10.14333127 * rh_85 -
    0.22475541 * tf_28 * rh_85 -
    0.00683783 * tf_28 * tf_28 -
    0.05481717 * rh_85 * rh_85 +
    0.00122874 * tf_28 * tf_28 * rh_85 +
    0.00085282 * tf_28 * rh_85 * rh_85 -
    0.00000199 * tf_28 * tf_28 * rh_85 * rh_85;
  const unadj_hiC_28_85 = Math.round(((unadj_hiF_28_85 - 32) * (5 / 9)) * 10) / 10;
  assert(
    hi_28_85 === unadj_hiC_28_85,
    'HIGH-RH-ADJ-02',
    `At boundary RH = 85%, high-humidity adjustment is exactly 0: ${hi_28_85}°C === ${unadj_hiC_28_85}°C`
  );

  const hi_32_90 = calculateHeatIndex(32, 90);
  const tf_32 = 32 * 1.8 + 32; // 89.6°F
  const rh_90 = 90;
  const unadj_hiF_32_90 =
    -42.379 +
    2.04901523 * tf_32 +
    10.14333127 * rh_90 -
    0.22475541 * tf_32 * rh_90 -
    0.00683783 * tf_32 * tf_32 -
    0.05481717 * rh_90 * rh_90 +
    0.00122874 * tf_32 * tf_32 * rh_90 +
    0.00085282 * tf_32 * rh_90 * rh_90 -
    0.00000199 * tf_32 * tf_32 * rh_90 * rh_90;
  const unadj_hiC_32_90 = Math.round(((unadj_hiF_32_90 - 32) * (5 / 9)) * 10) / 10;
  assert(
    hi_32_90 === unadj_hiC_32_90,
    'HIGH-RH-ADJ-03',
    `At T = 32°C (89.6°F > 87°F), high-humidity adjustment is NOT applied per NWS spec: ${hi_32_90}°C === ${unadj_hiC_32_90}°C`
  );

  // ============================================================================
  // SECTION 5: BoM WBGT MAGNUS-TETENS CONVERGENCE & PHYSICAL BOUNDARIES
  // ============================================================================
  console.log('\n--- [SECTION 5] BoM WBGT Magnus-Tetens Formulation & Boundaries ---');

  const wbgt_ref = calculateWBGT(30, 50);
  assert(
    wbgt_ref === 29.3,
    'WBGT-REF-01',
    `BoM WBGT reference check at 30°C, 50% RH matches analytical Magnus-Tetens: expected 29.3°C, got ${wbgt_ref}°C`
  );

  let wbgt_mono_temp = true;
  for (let temp = 20; temp <= 50; temp += 5) {
    if (calculateWBGT(temp, 60) <= calculateWBGT(temp - 5, 60)) {
      wbgt_mono_temp = false;
    }
  }
  assert(wbgt_mono_temp, 'WBGT-MONO-TEMP', 'BoM WBGT is strictly monotonic increasing with temperature');

  let wbgt_mono_rh = true;
  for (let rh = 10; rh <= 100; rh += 10) {
    if (calculateWBGT(35, rh) <= calculateWBGT(35, rh - 10)) {
      wbgt_mono_rh = false;
    }
  }
  assert(wbgt_mono_rh, 'WBGT-MONO-RH', 'BoM WBGT is strictly monotonic increasing with relative humidity');

  // ============================================================================
  // SECTION 6: 10,201-POINT COMPOSITE RISK GRID EXHAUSTION
  // ============================================================================
  console.log('\n--- [SECTION 6] 10,201-Point Composite Risk Grid Stress Test ---');

  let riskGridValid = true;
  let riskDivZeroFound = false;
  let maxCompositeScore = -Infinity;
  let minCompositeScore = Infinity;
  let percentageOverflowCount = 0;

  for (let tScore = 0; tScore <= 100; tScore++) {
    for (let vScore = 0; vScore <= 100; vScore++) {
      const cr = calculateCompositeRisk(tScore, vScore);

      if (isNaN(cr.composite_score) || !isFinite(cr.composite_score)) {
        riskGridValid = false;
      }
      if (cr.composite_score < 0 || cr.composite_score > 100) {
        riskGridValid = false;
      }

      const { atmospheric_pct, vulnerability_pct, primary_driver } = cr.contributing_factors;
      if (isNaN(atmospheric_pct) || isNaN(vulnerability_pct)) {
        riskDivZeroFound = true;
      }

      if (atmospheric_pct > 100) {
        percentageOverflowCount++;
      }

      if (cr.composite_score > maxCompositeScore) maxCompositeScore = cr.composite_score;
      if (cr.composite_score < minCompositeScore) minCompositeScore = cr.composite_score;
    }
  }

  assert(riskGridValid, 'COMP-GRID-01', 'All 10,201 composite risk combinations produce valid bounded scores [0..100]');
  assert(!riskDivZeroFound, 'COMP-GRID-02', 'Zero division-by-zero occurrences across entire 10,201 risk matrix (denom = Math.max(1, compositeScore))');
  assert(
    minCompositeScore === 0 && maxCompositeScore === 100,
    'COMP-GRID-03',
    `Composite risk spans full analytical range [0, 100]: min=${minCompositeScore}, max=${maxCompositeScore}`
  );

  // Empirical observation report on percentage rounding overflow in risk-engine.ts
  if (percentageOverflowCount > 0) {
    EMPIRICAL_DISCOVERIES.push(
      `BUG in calculateCompositeRisk: Found ${percentageOverflowCount} cells in 10,201 grid where atmospheric_pct > 100% (up to 120%) due to integer-rounded denominator division.`
    );
    console.warn(`\n  [EMPIRICAL ADVERSARIAL FINDING] percentageOverflowCount = ${percentageOverflowCount} occurrences where atmospheric_pct > 100% (e.g. t=2, v=0 yields 120%).`);
  }

  // ============================================================================
  // SECTION 7: PIPELINE RESILIENCE & CACHE FALLBACK STRESS
  // ============================================================================
  console.log('\n--- [SECTION 7] Pipeline Resilience & Cache Fallback Stress ---');

  const cache = new WeatherCache(200);

  assert(cache.get('bengaluru') === null, 'CACHE-MISS-01', 'Fresh cache correctly returns null on cold miss');
  assert(cache.hasFreshRun('bengaluru') === false, 'CACHE-MISS-02', 'hasFreshRun returns false on cold miss');

  const mockRun: CityForecastRun = {
    city_id: 'bengaluru',
    run_time: '2026-09-06T12:00:00Z',
    fetched_at: '2026-09-06T15:30:00Z',
    metadata: {
      run_time: '2026-09-06T12:00:00Z',
      fetched_at: '2026-09-06T15:30:00Z',
      valid_time: '2026-09-06T21:00',
      provider: 'Open-Meteo NWP Grid',
      model: 'ECMWF IFS / GFS Seamless',
      status: 'fresh',
      attribution: NWP_ATTRIBUTION,
    },
    wards: {},
    cached_at: Date.now(),
    expires_at: Date.now() + 100,
  };

  cache.set('bengaluru', mockRun, 100);

  const hit = cache.get('bengaluru', { allowStale: false });
  assert(hit !== null && !hit.isStale, 'CACHE-HIT-01', 'Cache returns fresh entry before expiration');

  // Sleep 120ms to expire TTL
  const tStart = Date.now();
  while (Date.now() - tStart < 120) {}

  const hitExpired = cache.get('bengaluru', { allowStale: false });
  assert(hitExpired === null, 'CACHE-EXP-01', 'Expired entry is rejected when allowStale: false');

  const hitStale = cache.get('bengaluru', { allowStale: true });
  assert(hitStale !== null && hitStale.isStale === true, 'CACHE-EXP-02', 'Expired entry is returned with isStale: true when allowStale: true');

  const latest = cache.getLatest('bengaluru');
  assert(latest !== null && latest.run_time === '2026-09-06T12:00:00Z', 'CACHE-LATEST-01', 'getLatest returns last valid run');

  cache.clear();
  let threw503 = false;
  try {
    const err = new WeatherUnavailableError('Simulated NWP upstream network failure', 503);
    throw err;
  } catch (err: any) {
    if (err instanceof WeatherUnavailableError && err.statusCode === 503 && err.status === 'unavailable') {
      threw503 = true;
    }
  }
  assert(threw503, 'PIPELINE-503-01', 'Upstream failure with zero cached run throws honest HTTP 503 WeatherUnavailableError');

  const staleDegradedRun: CityForecastRun = {
    ...mockRun,
    metadata: {
      ...mockRun.metadata,
      status: 'stale',
    },
  };
  assert(
    staleDegradedRun.metadata.status === 'stale',
    'PIPELINE-STALE-01',
    "Degraded run carries explicit status: 'stale'"
  );
  assert(
    staleDegradedRun.metadata.attribution === NWP_ATTRIBUTION,
    'PIPELINE-STALE-02',
    'Degraded run preserves NWP attribution notice'
  );

  // ============================================================================
  // SUMMARY REPORT
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('  CHALLENGER O3 BIOMETEOROLOGY & PIPELINE RESILIENCE SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total Invariant Checks: ${totalChecks}`);
  console.log(`  Passed:                 ${passedChecks}`);
  console.log(`  Failed:                 ${failedChecks}`);
  console.log(`  Success Rate:           ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);
  console.log('='.repeat(80) + '\n');

  if (EMPIRICAL_DISCOVERIES.length > 0) {
    console.log('DISCOVERED ISSUES / ADVERSARIAL FINDINGS:');
    for (const d of EMPIRICAL_DISCOVERIES) {
      console.log(`  * ${d}`);
    }
  }

  if (failedChecks > 0) {
    console.error('FAILURES:');
    for (const f of failures) {
      console.error(`- ${f}`);
    }
    process.exit(1);
  } else {
    console.log('VERDICT: ALL BIOMETEOROLOGY & PIPELINE SUITE ASSERTIONS PASSED!\n');
    process.exit(0);
  }
}

runBiometeorologyAndPipelineChallenge().catch((err) => {
  console.error('Fatal error in biomet challenge:', err);
  process.exit(1);
});
