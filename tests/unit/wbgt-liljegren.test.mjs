/**
 * Tier 3 Full-Physics WBGT Validation Suite (Liljegren et al. 2008)
 *
 * Standard: SIH26083 Master Build Specification (MoES / NCMRWF)
 * Scope: 10 Assertion Checks covering src/lib/wbgt-liljegren.ts
 *   1. Night convergence vs independent Stull (2011) shade estimate
 *   2-4. Deterministic regression locks (night / solar noon / humid morning)
 *   5. Monotonicity in temperature, humidity, solar (up) and wind (down)
 *   6. Null on invalid / non-physical inputs (never a guessed value)
 *   7. Solar geometry sanity (Pune June noon vs night zenith)
 *   8. Globe responds to sun (day Tg >> night Tg at same air temp)
 *   9. Integration wiring (thermal-engine imports full physics, keeps BoM fallback)
 *   10. Energy-balance identity WBGT = 0.7*Tnwb + 0.2*Tg + 0.1*Ta
 *
 * Strategy: compiles the dependency-free physics module standalone with tsc
 * into the OS temp dir, then asserts physics invariants. The night-convergence
 * check uses Stull (2011) psychrometric wet-bulb coded independently in this
 * file — not the module under test.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Location-agnostic: this suite lives in both root tests/ (canonical, paths
// resolve to the repo root) and heatpulse/tests/ (nested mirror). Detect the
// layout that actually contains src/lib.
function resolveHeatpulseDir(base) {
  if (fs.existsSync(path.join(base, 'src', 'lib', 'wbgt-liljegren.ts'))) return base;
  const nested = path.join(base, 'heatpulse');
  if (fs.existsSync(path.join(nested, 'src', 'lib', 'wbgt-liljegren.ts'))) return nested;
  return base;
}
const HEATPULSE_DIR = resolveHeatpulseDir(path.resolve(__dirname, '../..'));
const PHYSICS_SRC = path.join(HEATPULSE_DIR, 'src', 'lib', 'wbgt-liljegren.ts');
const THERMAL_ENGINE_SRC = path.join(HEATPULSE_DIR, 'src', 'lib', 'thermal-engine.ts');

/** Stull (2011) psychrometric wet-bulb, degC. Independent of the module. */
function stullWetBulb(tempC, rhPct) {
  const rh = Math.min(100, Math.max(0, rhPct));
  return (
    tempC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(tempC + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035
  );
}

async function loadPhysics() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'heatpulse-wbgt-'));
  const tscCandidates = [
    path.join(HEATPULSE_DIR, 'node_modules', 'typescript', 'lib', 'tsc.js'),
    path.join(HEATPULSE_DIR, 'heatpulse', 'node_modules', 'typescript', 'lib', 'tsc.js'),
  ];
  const tscJs = tscCandidates.find((p) => fs.existsSync(p));
  if (!tscJs) throw new Error('Local TypeScript compiler not found (node_modules/typescript)');
  execFileSync(
    process.execPath,
    [
      tscJs,
      PHYSICS_SRC,
      '--outDir', tmpDir,
      '--module', 'nodenext',
      '--target', 'es2020',
      '--moduleResolution', 'nodenext',
      '--strict',
      '--skipLibCheck',
    ],
    { cwd: HEATPULSE_DIR, stdio: 'pipe' }
  );
  const compiled = path.join(tmpDir, 'wbgt-liljegren.js');
  if (!fs.existsSync(compiled)) throw new Error('Standalone physics compile produced no output');
  return import(pathToFileURL(compiled).href);
}

export async function runWbgtLiljegrenTests() {
  const results = [];
  const check = (name, fn) => {
    try {
      fn();
      results.push({ name, status: 'PASS' });
      console.log(`  [PASS] ${name}`);
    } catch (err) {
      results.push({ name, status: 'FAIL', error: err && err.message });
      console.error(`  [FAIL] ${name}: ${err && err.message}`);
    }
  };
  const approx = (actual, expected, tol, label) => {
    if (Math.abs(actual - expected) > tol) {
      throw new Error(`${label}: expected ${expected}±${tol}, got ${actual}`);
    }
  };

  let phys = null;
  try {
    phys = await loadPhysics();
    console.log('  [INFO] Physics module compiled standalone OK');
  } catch (err) {
    console.error(`  [FAIL] Standalone compile: ${err && err.message}`);
    return { passed: 0, failed: 1, total: 1, results };
  }
  const { wbgtLiljegrenFull, solarZenithRad, dewpointFromRh } = phys;

  const PUNE = { latitude: 18.52, longitude: 73.85 };
  const night = { tempC: 30, humidityPct: 60, windKmh: 7.2, solarGhiWm2: 0, timeIso: '2026-06-15T02:00', ...PUNE };
  const noon = { tempC: 38, humidityPct: 45, windKmh: 10.8, solarGhiWm2: 800, timeIso: '2026-06-15T12:00', ...PUNE };
  const morning = { tempC: 33, humidityPct: 75, windKmh: 5, solarGhiWm2: 350, timeIso: '2026-06-15T09:00', ...PUNE };

  // 1. Night convergence vs independent Stull shade estimate
  check('Night full-WBGT converges to Stull shade estimate (<=1.5C)', () => {
    const r = wbgtLiljegrenFull(night);
    if (!r) throw new Error('null result for valid night inputs');
    const shade = 0.7 * stullWetBulb(night.tempC, night.humidityPct) + 0.3 * night.tempC;
    approx(r.wbgt, shade, 1.5, 'night WBGT vs Stull shade');
  });

  // 2-4. Deterministic regression locks (verified against invariants above)
  check('Regression lock: night case', () => {
    const r = wbgtLiljegrenFull(night);
    approx(r.wbgt, 25.5, 0.15, 'wbgt');
    approx(r.tnwb, 23.7, 0.15, 'tnwb');
    approx(r.tg, 29.3, 0.3, 'tg');
  });
  check('Regression lock: solar-noon case', () => {
    const r = wbgtLiljegrenFull(noon);
    approx(r.wbgt, 33.3, 0.2, 'wbgt');
    approx(r.tnwb, 28.5, 0.2, 'tnwb');
    if (!(r.tg > noon.tempC + 5)) throw new Error(`globe must exceed air temp in sun, tg=${r.tg}`);
  });
  check('Regression lock: humid-morning case', () => {
    const r = wbgtLiljegrenFull(morning);
    approx(r.wbgt, 32.4, 0.2, 'wbgt');
    approx(r.tnwb, 30.0, 0.2, 'tnwb');
  });

  // 5. Monotonicity
  check('Monotonicity: T/RH/solar up, wind down', () => {
    const base = wbgtLiljegrenFull(noon).wbgt;
    if (!(wbgtLiljegrenFull({ ...noon, tempC: noon.tempC + 2 }).wbgt > base)) throw new Error('T+');
    if (!(wbgtLiljegrenFull({ ...noon, humidityPct: noon.humidityPct + 10 }).wbgt > base)) throw new Error('RH+');
    if (!(wbgtLiljegrenFull({ ...noon, solarGhiWm2: noon.solarGhiWm2 + 100 }).wbgt > base)) throw new Error('S+');
    if (!(wbgtLiljegrenFull({ ...noon, windKmh: noon.windKmh + 20 }).wbgt < base)) throw new Error('W-');
  });

  // 6. Null on invalid inputs
  check('Null on invalid inputs (never guesses)', () => {
    const bad = [
      { ...noon, tempC: NaN },
      { ...noon, windKmh: undefined },
      { ...noon, solarGhiWm2: undefined },
      { ...noon, timeIso: 'bad' },
      { ...noon, latitude: 91 },
      { ...noon, pressureHpa: 500 },
    ];
    for (const b of bad) {
      if (wbgtLiljegrenFull(b) !== null) throw new Error(`expected null for ${JSON.stringify(b)}`);
    }
  });

  // 7. Solar geometry sanity
  check('Solar geometry: noon low zenith, night below horizon', () => {
    const noonZ = (solarZenithRad(new Date('2026-06-15T12:00:00+05:30'), 73.85, 18.52) * 180) / Math.PI;
    const nightZ = (solarZenithRad(new Date('2026-06-15T02:00:00+05:30'), 73.85, 18.52) * 180) / Math.PI;
    if (!(noonZ < 20)) throw new Error(`noon zenith ${noonZ}`);
    if (!(nightZ > 90)) throw new Error(`night zenith ${nightZ}`);
  });

  // 8. Globe responds to sun
  check('Globe hotter under sun than at night (same air temp)', () => {
    const dayTg = wbgtLiljegrenFull(noon).tg;
    const nightTg = wbgtLiljegrenFull({ ...night, tempC: noon.tempC, humidityPct: noon.humidityPct }).tg;
    if (!(dayTg > nightTg + 5)) throw new Error(`day tg=${dayTg} night tg=${nightTg}`);
  });

  // 9. Integration wiring present, BoM fallback retained
  check('thermal-engine wires full physics + keeps BoM fallback', () => {
    const src = fs.readFileSync(THERMAL_ENGINE_SRC, 'utf8');
    if (!src.includes('wbgt-liljegren')) throw new Error('missing wbgt-liljegren import');
    if (!src.includes('liljegren-full') || !src.includes('bom-simplified')) throw new Error('missing method provenance');
    for (const coef of ['0.567', '0.393', '3.94', '0.6108', '17.27', '237.3']) {
      if (!src.includes(coef)) throw new Error(`BoM coefficient ${coef} removed (Tier-2 CHECK 12)`);
    }
  });

  // 10. Energy-balance identity
  check('Identity WBGT = 0.7*Tnwb + 0.2*Tg + 0.1*Ta', () => {
    for (const c of [night, noon, morning]) {
      const r = wbgtLiljegrenFull(c);
      approx(r.wbgt, Math.round((0.7 * r.tnwb + 0.2 * r.tg + 0.1 * c.tempC) * 10) / 10, 0.11, c.timeIso);
    }
  });

  // Dewpoint helper sanity (Magnus inversion round-trips RH)
  check('Dewpoint helper never exceeds air temp', () => {
    const d = dewpointFromRh(38, 95);
    if (!(d <= 38 && d > 30)) throw new Error(`dewp=${d}`);
    if (dewpointFromRh(30, 100) !== 30) throw new Error('saturated dewp must equal air temp');
  });

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log('-'.repeat(78));
  console.log(`  WBGT PHYSICS SUMMARY: ${passed} Passed, ${failed} Failed out of ${results.length} Checks`);
  return { passed, failed, total: results.length, results };
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runWbgtLiljegrenTests().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
