/**
 * HeatPulse Deterministic Test Suite — tests/run-all.mjs
 * SIH26083 MoES / NCMRWF Master Build Specification
 *
 * DIRECT PRODUCTION TESTING (R17):
 * The suite compiles the real production modules
 * (threshold-config, thermal-engine, temporal-modes, imd-service) to a
 * temp directory with tsc and imports the ACTUAL functions — no formula
 * reimplementation. A small static-source audit section remains for
 * single-source-of-truth regressions (grep-level guarantees that cannot
 * be expressed as runtime imports).
 *
 * Coverage:
 *  1. calculateHeatIndex / calculateWBGT — production formula behavior
 *  2. Classification boundaries — exact threshold edges from threshold-config
 *  3. calculateThermalScore / calculateCompositeRiskScore — production math
 *  4. calculateRelativeRisk — production RR incl. missing-input semantics
 *  5. Vulnerability classification boundaries
 *  6. Temporal modes — CURRENT / SELECTED FORECAST / PEAK resolve REAL data
 *     differently (mode changes data, not just a border)
 *  7. IMD criteria assessment — no-input yields explicit unavailable, never
 *     a fabricated GREEN from a substituted normal
 *  8. Nighttime semantics — 23:00 current vs next-day peak are distinct
 *  9. Static source audits — single threshold source, no ward-name hash,
 *     no fabricated fallback literals, IMD wording truth, cron disabled
 * 10. GIS integrity — 849 wards, no GeometryCollection
 * 11. ML model artifact schema + honest warning metadata
 *
 * Run: node tests/run-all.mjs
 */

import { readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BUILD = join(ROOT, '.test-build');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label, details = '') {
  if (condition) {
    console.log('  PASS: ' + label);
    passed++;
  } else {
    console.error('  FAIL: ' + label + (details ? ' -- ' + details : ''));
    failed++;
    failures.push({ label, details });
  }
}

function section(name) {
  console.log('\n' + '='.repeat(60));
  console.log('TEST GROUP: ' + name);
  console.log('='.repeat(60));
}

// ============================================================
// STEP 0: compile production modules for direct import
// ============================================================
const SRC_FILES = [
  'src/lib/threshold-config.ts',
  'src/lib/thermal-engine.ts',
  'src/lib/temporal-modes.ts',
  'src/lib/imd-service.ts',
  'src/types/thermal.ts',
  'src/types/weather.ts',
];

for (const rel of SRC_FILES) {
  if (!existsSync(join(ROOT, rel))) {
    console.error('Missing production source: ' + rel);
    process.exit(2);
  }
}

rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });

// Invoke the project-local TypeScript compiler directly through Node — avoids
// npx/shell quoting issues on Windows paths containing spaces. A temp tsconfig
// maps the project's "@/*" path alias to src so production files compile
// unmodified.
const tscEntry = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
if (!existsSync(tscEntry)) {
  console.error('Local TypeScript compiler not found at ' + tscEntry);
  process.exit(2);
}
const tsconfigContent = JSON.stringify({
  compilerOptions: {
    target: 'ES2020',
    module: 'ES2020',
    moduleResolution: 'node',
    skipLibCheck: true,
    strict: true,
    outDir: BUILD.replace(/\\/g, '/'),
    baseUrl: ROOT.replace(/\\/g, '/'),
    paths: { '@/*': ['src/*'] },
  },
  files: SRC_FILES.map((rel) => join(ROOT, rel).replace(/\\/g, '/')),
});
const tsconfigPath = join(BUILD, 'tsconfig.test.json');
const { writeFileSync } = await import('fs');
writeFileSync(tsconfigPath, tsconfigContent, 'utf-8');

const tsc = spawnSync(
  process.execPath,
  [tscEntry, '-p', tsconfigPath],
  { cwd: ROOT, encoding: 'utf-8', shell: false }
);

if (tsc.status !== 0) {
  console.error('tsc compile of production sources failed:\n' + tsc.stdout + tsc.stderr);
  process.exit(2);
}

// The emitted JS retains "@/*" path aliases (tsc does not rewrite imports).
// Rewrite them to relative paths within the emitted tree so Node can import
// the production modules directly.
{
  const { readdirSync, statSync } = await import('fs');
  const rewriteDir = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        rewriteDir(p);
        continue;
      }
      if (!p.endsWith('.js')) continue;
      let src = readFileSync(p, 'utf-8');
      // 1) Aliased imports "@/*" → relative paths within the emitted tree.
      // 2) Extensionless relative imports get ".js" appended for Node ESM.
      // Handles both single- and double-quoted emitted imports.
      src = src
        .replace(/from\s+'@\/lib\/([^']+)'/g, "from './$1.js'")
        .replace(/from\s+'@\/types\/([^']+)'/g, "from '../types/$1.js'")
        .replace(/from\s+"@\/lib\/([^"]+)"/g, 'from "./$1.js"')
        .replace(/from\s+"@\/types\/([^"]+)"/g, 'from "../types/$1.js"')
        .replace(/from\s+'(\.\/[^']+?)'/g, (m, p1) => (p1.endsWith('.js') ? m : `from '${p1}.js'`))
        .replace(/from\s+"(\.\/[^"]+?)"/g, (m, p1) => (p1.endsWith('.js') ? m : `from "${p1}.js"`));
      writeFileSync(p, src, 'utf-8');
    }
  };
  const libOut = join(BUILD, 'lib');
  const typesOut = join(BUILD, 'types');
  if (existsSync(libOut)) rewriteDir(libOut);
  if (existsSync(typesOut)) rewriteDir(typesOut);
}

const asFileUrl = (p) => 'file:///' + p.replace(/\\/g, '/');

const thermalEngine = await import(asFileUrl(join(BUILD, 'lib/thermal-engine.js')));
const { calculateHeatIndex, calculateWBGT } = thermalEngine;

const {
  classifyHeatCondition,
  classifyThermalStress,
  classifyCompositeRiskLevel,
  classifyVulnerabilityLevel,
  calculateThermalScore,
  calculateCompositeRiskScore,
  calculateRelativeRisk,
  RELATIVE_RISK_THRESHOLDS,
  THERMAL_STRESS_THRESHOLDS,
  HEAT_CONDITION_THRESHOLDS,
  COMPOSITE_RISK_THRESHOLDS,
  VULNERABILITY_THRESHOLDS,
  RISK_WEIGHTS,
} = await import(asFileUrl(join(BUILD, 'lib/threshold-config.js')));
const { resolveWardTemporalMetrics } = await import(asFileUrl(join(BUILD, 'lib/temporal-modes.js')));
const { evaluateImdDistrictWarning } = await import(asFileUrl(join(BUILD, 'lib/imd-service.js')));

const eps = (a, b, tol = 0.051) => Math.abs(a - b) <= tol;

// ============================================================
// SECTION 1: Production thermal formulas (calculateHeatIndex/WBGT)
// ============================================================
section('1. Production Thermal Formulas (direct import)');

// WBGT at night with very high RH must not be forced to green/Low:
const wbgtNight = calculateWBGT(26.7, 94);
assert(wbgtNight >= 28.0, 'WBGT(26.7C, 94% RH) >= 28 (night humidity keeps stress real)', 'Got ' + wbgtNight);

// Reference BoM simplified formula computed here only to CHECK the production
// function (the authoritative implementation remains in thermal-engine.ts).
const wbgtRef = (t, rh) => {
  const e = (rh / 100) * 0.6108 * Math.exp((17.27 * t) / (237.3 + t)) * 10;
  return Math.round((0.567 * t + 0.393 * e + 3.94) * 10) / 10;
};
assert(eps(calculateWBGT(32, 70), wbgtRef(32, 70), 0.0), 'calculateWBGT(32, 70) matches BoM formula', calculateWBGT(32, 70) + ' vs ' + wbgtRef(32, 70));
assert(eps(calculateWBGT(35, 40), wbgtRef(35, 40), 0.0), 'calculateWBGT(35, 40) matches BoM formula', '');

// Monotonicity with humidity
assert(
  calculateWBGT(32, 40) < calculateWBGT(32, 70) && calculateWBGT(32, 70) < calculateWBGT(32, 90),
  'WBGT increases monotonically with RH at 32C',
  [calculateWBGT(32, 40), calculateWBGT(32, 70), calculateWBGT(32, 90)].join(' < ')
);

// Heat Index production checks
const hi35 = calculateHeatIndex(35, 60);
assert(hi35 >= 40.0 && hi35 <= 55.0, 'HeatIndex(35C, 60%) in physiologically expected 40-55C band', 'Got ' + hi35);
assert(calculateHeatIndex(30, 60) < hi35 && hi35 < calculateHeatIndex(40, 60), 'HeatIndex monotonic in temperature at 60% RH', '');
assert(calculateHeatIndex(15, 60) === 15, 'HeatIndex below 20C returns ambient (no extrapolation)', 'Got ' + calculateHeatIndex(15, 60));

// ============================================================
// SECTION 2: Classification boundaries (production functions)
// ============================================================
section('2. Classification Boundaries (threshold-config)');

// Heat conditions — boundary semantics: >= threshold enters the band
assert(classifyHeatCondition(34.99) === 'Normal', '34.99C is Normal', '');
assert(classifyHeatCondition(35) === 'Elevated', '35.0C boundary is Elevated (>=)', '');
assert(classifyHeatCondition(39.99) === 'Elevated', '39.99C is Elevated', '');
assert(classifyHeatCondition(40) === 'High', '40.0C boundary is High (>=)', '');
assert(classifyHeatCondition(45) === 'Extreme', '45.0C boundary is Extreme (>=)', '');

// Thermal stress — WBGT boundaries
assert(classifyThermalStress(undefined, 27.99) === 'Low', 'WBGT 27.99 is Low', '');
assert(classifyThermalStress(undefined, 28) === 'Moderate', 'WBGT 28.0 boundary is Moderate (>=)', '');
assert(classifyThermalStress(undefined, 30) === 'High', 'WBGT 30.0 boundary is High (>=)', '');
assert(classifyThermalStress(undefined, 32) === 'Severe', 'WBGT 32.0 boundary is Severe (>=)', '');
// Thermal stress — HI-only boundaries (no WBGT available)
assert(classifyThermalStress(26.99, undefined) === 'Low', 'HI 26.99 alone is Low', '');
assert(classifyThermalStress(27, undefined) === 'Moderate', 'HI 27.0 alone is Moderate (>=)', '');
assert(classifyThermalStress(32, undefined) === 'High', 'HI 32.0 alone is High (>=)', '');
assert(classifyThermalStress(41, undefined) === 'Severe', 'HI 41.0 alone is Severe (>=)', '');
// Dual criteria: most severe wins
assert(classifyThermalStress(20, 32) === 'Severe', 'Low HI but WBGT 32 → Severe (most severe wins)', '');

// Composite risk score bands (0-100)
assert(classifyCompositeRiskLevel(29.9) === 'Low', 'Composite 29.9 is Low', '');
assert(classifyCompositeRiskLevel(30) === 'Moderate', 'Composite 30 boundary is Moderate (>=)', '');
assert(classifyCompositeRiskLevel(50) === 'High', 'Composite 50 boundary is High (>=)', '');
assert(classifyCompositeRiskLevel(70) === 'Severe', 'Composite 70 boundary is Severe (>=)', '');

// Vulnerability bands
assert(classifyVulnerabilityLevel(29) === 'Low', 'Vulnerability 29 is Low', '');
assert(classifyVulnerabilityLevel(30) === 'Moderate', 'Vulnerability 30 is Moderate (>=)', '');
assert(classifyVulnerabilityLevel(50) === 'High', 'Vulnerability 50 is High (>=)', '');
assert(classifyVulnerabilityLevel(70) === 'Severe', 'Vulnerability 70 is Severe (>=)', '');

// Legend labels agree with the authoritative thresholds (presentation config
// must restate the same numbers the classifiers use)
const mapConfigSrc = readFileSync(join(ROOT, 'src/components/map/map-config.ts'), 'utf-8');
assert(
  mapConfigSrc.includes("'Normal (<35") && mapConfigSrc.includes('45'),
  'legend labels match HEAT_CONDITION thresholds (35/45)',
  ''
);
assert(
  mapConfigSrc.includes('28') && mapConfigSrc.includes('30') && mapConfigSrc.includes('32'),
  'legend labels match THERMAL_STRESS thresholds (28/30/32)',
  ''
);

// ============================================================
// SECTION 3: Risk math (production implementations)
// ============================================================
section('3. Composite Risk Math (production)');

assert(calculateThermalScore(20) === 0, 'ThermalScore(20C) = 0 (baseline)', 'Got ' + calculateThermalScore(20));
assert(calculateThermalScore(54) === 100, 'ThermalScore(54C) = 100 (NOAA extreme)', 'Got ' + calculateThermalScore(54));
assert(eps(calculateThermalScore(37), 50, 0.51), 'ThermalScore(37C) ≈ 50 (midpoint)', 'Got ' + calculateThermalScore(37));

const comp = calculateCompositeRiskScore(100, 100);
assert(comp === 100, 'Composite(100, 100) = 100 (clipped at max)', 'Got ' + comp);
assert(eps(calculateCompositeRiskScore(80, 60), 0.6 * 80 + 0.4 * 60, 0.51), 'Composite honors alpha/beta weights', 'Got ' + calculateCompositeRiskScore(80, 60));
assert(eps(RISK_WEIGHTS.alpha + RISK_WEIGHTS.beta, 1.0, 0.0001), 'Weights sum to 1.0', '');
assert(calculateCompositeRiskScore(-5, 200) === 77, 'Composite mixes raw then clamps OUTPUT to [0,100] (raw 77 stays 77)', 'Got ' + calculateCompositeRiskScore(-5, 200));
assert(calculateCompositeRiskScore(150, 100) === 100, 'Composite clips above 100', 'Got ' + calculateCompositeRiskScore(150, 100));

// ============================================================
// SECTION 4: Relative Risk (single authoritative implementation)
// ============================================================
section('4. Relative Risk Estimate (production)');

const rrBaseline = calculateRelativeRisk(20, 0);
assert(rrBaseline.rr === 1.0 && rrBaseline.band === 'Baseline', 'RR below onset = 1.00 Baseline', JSON.stringify(rrBaseline));
assert(calculateRelativeRisk(28, 0).rr === 1.0, 'RR at onset WBGT 28 is still 1.00 (excess starts above onset)', 'Got ' + calculateRelativeRisk(28, 0).rr);
assert(calculateRelativeRisk(30, 0).rr === 1.24, 'RR(30C, vuln 0) = 1.24 (2deg * 0.12)', 'Got ' + calculateRelativeRisk(30, 0).rr);
assert(
  eps(calculateRelativeRisk(30, 100).rr, 1.0 + 2 * 0.12 + 0.15, 0.011),
  'RR(30C, vuln 100) = 1 + 0.24 + 0.15',
  'Got ' + calculateRelativeRisk(30, 100).rr
);
assert(calculateRelativeRisk(undefined, undefined).rr === 1.0, 'RR with no inputs = baseline 1.00 (never fabricated)', 'Got ' + calculateRelativeRisk(undefined, undefined).rr);
assert(calculateRelativeRisk(32, 50).rr > calculateRelativeRisk(28, 50).rr, 'RR increases with WBGT above onset', '');
assert(calculateRelativeRisk(30, 80).rr > calculateRelativeRisk(30, 20).rr, 'RR increases with vulnerability', '');
const rrCritical = calculateRelativeRisk(35, 100);
assert(rrCritical.band === 'Critical', 'RR(35, 100) is Critical band', JSON.stringify(rrCritical));
assert(rrCritical.excessPct === Math.round((rrCritical.rr - 1) * 100), 'Excess pct = (rr-1)*100', JSON.stringify(rrCritical));

// ============================================================
// SECTION 5: Temporal modes change actual data (production resolver)
// ============================================================
section('5. Temporal Modes: CURRENT / SELECTED FORECAST / PEAK');

// Genuine-shaped hourly arrays (the resolver is pure — it receives the same
// array shapes the Open-Meteo pipeline produces).
const hours = 48;
const times = [];
const temps = [];
const hums = [];
const apparents = [];
for (let i = 0; i < hours; i++) {
  const h = i % 24;
  // cool night, hot afternoon peak near hour 14
  const diurnal = 24 + 12 * Math.exp(-Math.pow(h - 14, 2) / 18);
  const d = new Date('2026-09-10T00:00:00+05:30');
  d.setHours(d.getHours() + i);
  times.push(d.toISOString().slice(0, 16));
  temps.push(Math.round(diurnal * 10) / 10);
  hums.push(h >= 10 && h <= 16 ? 45 : 85);
  apparents.push(Math.round(diurnal * 10) / 10);
}
const wardForecast = {
  ward_id: 'test-ward-01',
  ward_name: 'Test Ward',
  city_id: 'test',
  centroid: [77.59, 12.97],
  current: { time: times[0], temperature_2m: temps[0], relative_humidity_2m: hums[0], apparent_temperature: apparents[0] },
  hourly: { time: times, temperature_2m: temps, relative_humidity_2m: hums, apparent_temperature: apparents },
  metadata: { run_time: '2026-09-10T00:00:00Z', fetched_at: '2026-09-10T00:00:00Z', valid_time: times[0], provider: 'Open-Meteo NWP Grid', model: 'test', status: 'fresh', attribution: 'test' },
  attribution: 'test',
};

const currentMetrics = resolveWardTemporalMetrics({
  forecast: wardForecast,
  mode: 'CURRENT',
  currentValidTime: times[23], // 23:00 IST — nighttime
  selectedValidTime: null,
  vulnerabilityScore: 50,
});
assert(currentMetrics != null, 'CURRENT mode resolves', '');
assert(eps(currentMetrics.temperature, temps[23], 0.0), 'CURRENT mode returns the 23:00 hour value, not the peak', JSON.stringify(currentMetrics));

const peakMetrics = resolveWardTemporalMetrics({
  forecast: wardForecast,
  mode: 'PEAK',
  currentValidTime: times[23],
  selectedValidTime: null,
  vulnerabilityScore: 50,
});
assert(peakMetrics != null, 'PEAK mode resolves', '');
assert(peakMetrics.temperature > currentMetrics.temperature, 'PEAK temperature > CURRENT(23:00) temperature — modes change data', `${peakMetrics.temperature} vs ${currentMetrics.temperature}`);
assert(peakMetrics.validTime !== currentMetrics.validTime, 'PEAK valid time differs from CURRENT valid time', `${peakMetrics.validTime} vs ${currentMetrics.validTime}`);
assert(peakMetrics.wbgt > currentMetrics.wbgt, 'PEAK WBGT > night CURRENT WBGT (night not forced green)', `${peakMetrics.wbgt} vs ${currentMetrics.wbgt}`);
assert(peakMetrics.thermalStress !== 'Low', 'PEAK mode classifies the hot afternoon, not the cool night', peakMetrics.thermalStress);

// SELECTED FORECAST: pick the next-day 14:00 hour explicitly
const selected = times[14 + 24];
const selectedMetrics = resolveWardTemporalMetrics({
  forecast: wardForecast,
  mode: 'FORECAST',
  currentValidTime: times[23],
  selectedValidTime: selected,
  vulnerabilityScore: 50,
});
assert(selectedMetrics != null, 'SELECTED FORECAST mode resolves', '');
assert(eps(selectedMetrics.temperature, temps[14 + 24], 0.0), 'SELECTED FORECAST returns the user-selected hour', JSON.stringify(selectedMetrics));
assert(selectedMetrics.validTime === selected, 'SELECTED FORECAST valid time is the selection', '');

// Mode-resolved composite uses authoritative weights
assert(
  eps(selectedMetrics.compositeRisk, calculateCompositeRiskScore(calculateThermalScore(selectedMetrics.heatIndex), 50), 0.51),
  'Mode-resolved composite uses authoritative weights',
  `${selectedMetrics.compositeRisk}`
);

// No-data honesty
assert(
  resolveWardTemporalMetrics({ forecast: null, mode: 'PEAK', currentValidTime: null, selectedValidTime: null }) === null,
  'No forecast data → null metrics (never invented)',
  ''
);
const emptyForecast = { ...wardForecast, hourly: { ...wardForecast.hourly, time: [], temperature_2m: [], relative_humidity_2m: [] } };
assert(
  resolveWardTemporalMetrics({ forecast: emptyForecast, mode: 'CURRENT', currentValidTime: null, selectedValidTime: null }) === null,
  'Empty hourly arrays → null metrics',
  ''
);

// ============================================================
// SECTION 6: Nighttime semantics (the 23:00 problem)
// ============================================================
section('6. Nighttime Semantics (23:00 current vs next-day peak)');

assert(eps(currentMetrics.temperature, temps[23], 0.0) && temps[23] < 30, '23:00 current is the cool night value', `${currentMetrics.temperature}C`);
assert(classifyThermalStress(currentMetrics.heatIndex, currentMetrics.wbgt) === currentMetrics.thermalStress, 'Night classification uses real production thresholds (not forced green)', currentMetrics.thermalStress);
assert(peakMetrics.wbgt !== currentMetrics.wbgt, 'CURRENT night WBGT and FORECAST PEAK WBGT are distinct values', `${currentMetrics.wbgt} vs ${peakMetrics.wbgt}`);
// times[] are UTC ISO strings (as Open-Meteo emits); 23:00 IST = 17:30 UTC.
assert(times[23].startsWith('2026-09-10T17:30'), '23:00 IST slot maps to the 23:00 forecast hour (17:30 UTC)', times[23]);

// IST conversion sanity
const istFormatter = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
assert(istFormatter.format(new Date('2026-09-10T00:00:00Z')) === '05:30', 'UTC 00:00 → IST 05:30', istFormatter.format(new Date('2026-09-10T00:00:00Z')));
assert(istFormatter.format(new Date('2026-09-10T18:30:00Z')) === '00:00', 'UTC 18:30 → IST 00:00 midnight', '');

// ============================================================
// SECTION 7: IMD criteria assessment truth (production service)
// ============================================================
section('7. IMD Criteria Assessment Truth (production)');

const imdNoInput = evaluateImdDistrictWarning('pune', undefined);
assert(imdNoInput.has_forecast_input === false, 'No temperature input → has_forecast_input=false', '');
assert(imdNoInput.forecast_tmax === undefined, 'No input → no fabricated forecast_tmax', JSON.stringify(imdNoInput.forecast_tmax));
assert(imdNoInput.departure === undefined, 'No input → no fabricated departure', '');
assert(!/GREEN: No Warning/.test(imdNoInput.headline), 'No input → not a confident GREEN headline', imdNoInput.headline);
assert(imdNoInput.computed_at !== undefined, 'computed_at present (renamed from issued_at)', '');
assert(!('issued_at' in imdNoInput), 'issued_at field no longer exists', '');

const imdHot = evaluateImdDistrictWarning('pune', 42);
assert(imdHot.has_forecast_input === true, 'Real tmax 42C → has_forecast_input=true', '');
assert(imdHot.color_code === 'ORANGE', 'Pune 42C (dep +4.5 from 37.5 normal) → ORANGE per IMD criteria', imdHot.color_code + ' dep=' + imdHot.departure);
assert(imdHot.authority.toLowerCase().includes('not an imd-issued product'), 'authority string disclaims IMD issuance', imdHot.authority);
assert(imdHot.disclaimer.toLowerCase().includes('not an official'), 'disclaimer states not official', '');

// ============================================================
// SECTION 8: Static source audits (single-source + no fabrication)
// ============================================================
section('8. Source Audits: Single Source of Truth & No Fabrication');

const thresholdSrc = readFileSync(join(ROOT, 'src/lib/threshold-config.ts'), 'utf-8');
function parseConst(src, name) {
  const m = src.match(new RegExp(name + '\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)'));
  return m ? parseFloat(m[1]) : null;
}
// Runtime constants match the source exactly
assert(THERMAL_STRESS_THRESHOLDS.moderateWbgt === parseConst(thresholdSrc, 'moderateWbgt'), 'runtime moderateWbgt matches source', '');
assert(HEAT_CONDITION_THRESHOLDS.extreme === 45, 'HEAT_CONDITION extreme is 45', '');
assert(COMPOSITE_RISK_THRESHOLDS.severe === 70, 'COMPOSITE severe is 70', '');
assert(VULNERABILITY_THRESHOLDS.severe === 70, 'VULNERABILITY severe is 70', '');
assert(RELATIVE_RISK_THRESHOLDS.onsetWbgt === 28, 'RR onset WBGT is 28', '');

// Every production consumer imports threshold-config
const singleSourceConsumers = [
  'src/lib/thermal-engine.ts',
  'src/lib/risk-engine.ts',
  'src/lib/advisory-engine.ts',
  'src/lib/map-config.ts',
  'src/components/map/map-config.ts',
  'src/app/api/alerts/route.ts',
  'src/app/api/states/route.ts',
  'src/app/page.tsx',
  'src/app/india/page.tsx',
  'src/components/drawer/WardDetailDrawer.tsx',
  'src/components/map/MapContainer.tsx',
];
for (const rel of singleSourceConsumers) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { console.log('  SKIP: ' + rel + ' not found'); continue; }
  const src = readFileSync(p, 'utf-8');
  assert(/threshold-config/.test(src), rel + ' imports the single threshold source', '');
}

// No duplicate Rothfusz/BoM numerics outside thermal-engine
const engineFiles = ['src/app/api/states/route.ts', 'src/lib/risk-engine.ts', 'src/lib/map-config.ts', 'src/components/map/map-config.ts'];
for (const rel of engineFiles) {
  const src = readFileSync(join(ROOT, rel), 'utf-8');
  assert(!/2\.04901523/.test(src), rel + ' has no duplicate Rothfusz regression', '');
  assert(!/0\.567\s*\*\s*\w+/.test(src), rel + ' has no duplicate BoM WBGT formula', '');
}

// No ward-name hash vulnerability anywhere in production
{
  const listSrc = spawnSync(
    process.platform === 'win32' ? 'cmd.exe' : 'sh',
    process.platform === 'win32'
      ? ['/c', `dir /s /b "${join(ROOT, 'src')}"`]
      : ['-c', `find "${join(ROOT, 'src')}" -name "*.ts" -o -name "*.tsx"`],
    { encoding: 'utf-8' }
  );
  const list = listSrc.stdout.split(/\r?\n/).filter((f) => f && /\.(ts|tsx)$/.test(f));
  for (const f of list) {
    const src = readFileSync(f, 'utf-8');
    assert(!/charCodeAt\s*\(/.test(src), f + ' has no charCodeAt hash (ward-name hashing removed)', '');
  }
}

// No known fabricated fallback literals in production runtime paths
const fallbackPatterns = [
  { re: /\?\?\s*1013\.25/, label: '?? 1013.25 pressure substitution' },
  { re: /heatIndex:\s*35,/, label: 'heatIndex: 35 placeholder' },
  { re: /wbgt:\s*28,/, label: 'wbgt: 28 placeholder' },
  { re: /baseTemp\s*=\s*34/, label: 'baseTemp = 34 synthetic trajectory' },
];
const prodFiles = [
  'src/app/page.tsx',
  'src/app/india/page.tsx',
  'src/app/forecast/page.tsx',
  'src/app/api/risk/route.ts',
  'src/app/api/alerts/route.ts',
  'src/app/api/states/route.ts',
  'src/lib/weather-service.ts',
  'src/lib/risk-engine.ts',
  'src/lib/store.ts',
  'src/components/drawer/WardDetailDrawer.tsx',
];
for (const rel of prodFiles) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) continue;
  const src = readFileSync(p, 'utf-8');
  for (const { re, label } of fallbackPatterns) {
    assert(!re.test(src), rel + ' free of ' + label, '');
  }
}

// IMD truth wording: production never presents official bulletin claims.
// Negated disclaimers ("NOT official IMD bulletins") are stripped before
// matching so honest disclaimers don't fail the audit.
const imdFiles = ['src/lib/imd-service.ts', 'src/app/api/imd/route.ts', 'src/app/page.tsx', 'src/app/india/page.tsx'];
const stripNegations = (s) => s
  .replace(/\b(?:not|never)\s+an?\s+official\s+IMD\s+(?:district\s+)?(?:bulletins?|warnings?|product)/gi, '')
  .replace(/\bnot\s+official\s+IMD\s+(?:district\s+)?(?:bulletins?|warnings?)/gi, '');
for (const rel of imdFiles) {
  const src = readFileSync(join(ROOT, rel), 'utf-8');
  const lines = stripNegations(src).split(/\r?\n/).filter((l) => /OFFICIAL IMD DISTRICT|Official IMD Bulletin|IMD Issued Warning/i.test(l));
  assert(lines.length === 0, rel + ' has no official-IMD-bulletin claim', lines[0] || '');
}

// Health honesty: no clinical outcome prediction claims in production pages
const healthFiles = ['src/app/page.tsx', 'src/app/risk-areas/page.tsx', 'src/components/drawer/WardDetailDrawer.tsx'];
for (const rel of healthFiles) {
  const src = readFileSync(join(ROOT, rel), 'utf-8');
  assert(!/predicted\s+deaths|predicted\s+mortality|hospital\s+admissions?\s+forecast/i.test(src), rel + ' has no mortality/hospitalization prediction', '');
}

// Legacy cron is disabled and registers no schedule
const vercelSrc = existsSync(join(ROOT, 'vercel.json')) ? readFileSync(join(ROOT, 'vercel.json'), 'utf-8') : '{}';
const cronSrc = readFileSync(join(ROOT, 'src/app/api/cron/thermal/route.ts'), 'utf-8');
assert(!/crons/.test(vercelSrc), 'vercel.json registers no cron schedule', vercelSrc);
assert(/disabled/.test(cronSrc) || /410/.test(cronSrc), 'legacy cron route is a disabled 410 stub', '');

// Storage truth: no dead database client remains
assert(!existsSync(join(ROOT, 'src/lib/supabase.ts')), 'unused supabase client removed (no database-backed implication)', '');
const pkgSrc = readFileSync(join(ROOT, 'package.json'), 'utf-8');
assert(!/@supabase/.test(pkgSrc), 'no supabase dependency remains', '');

// ============================================================
// SECTION 9: GIS integrity
// ============================================================
section('9. GIS Ward File Integrity (R3, R8)');

const gisFiles = [
  { city: 'Bengaluru', count: 369, names: ['bengaluru-gba-369-wards.geojson', 'bengaluru_wards.geojson'] },
  { city: 'Pune', count: 15, names: ['pune-15-wards.geojson', 'pune_wards.geojson'] },
  { city: 'Mumbai', count: 24, names: ['mumbai-24-wards.geojson', 'mumbai_wards.geojson'] },
  { city: 'Kolkata', count: 141, names: ['kolkata-141-wards.geojson', 'kolkata_wards.geojson'] },
  { city: 'Chennai', count: 200, names: ['chennai-200-wards.geojson', 'chennai_wards.geojson'] },
  { city: 'Coimbatore', count: 100, names: ['coimbatore-100-wards.geojson', 'coimbatore_wards.geojson'] },
];
const searchDirs = ['public/data/processed/geojson', 'public/data/processed', 'data/processed/geojson'];
let totalWards = 0;
for (const { city, count, names } of gisFiles) {
  let found = false;
  for (const dir of searchDirs) {
    for (const name of names) {
      const p = join(ROOT, dir, name);
      if (existsSync(p)) {
        const raw = JSON.parse(readFileSync(p, 'utf-8'));
        const actual = raw.features?.length ?? 0;
        assert(actual === count, city + ' GeoJSON has exactly ' + count + ' ward features', 'Got ' + actual);
        const hasGeoCol = raw.features?.some((f) => f.geometry?.type === 'GeometryCollection');
        assert(!hasGeoCol, city + ' GeoJSON has NO GeometryCollection', hasGeoCol ? 'Found GeometryCollection' : '');
        totalWards += actual;
        found = true;
        break;
      }
    }
    if (found) break;
  }
  if (!found) {
    assert(false, city + ' GeoJSON file found', 'Not found in ' + searchDirs.join(', '));
  }
}
assert(totalWards === 849, 'Total wards across 6 cities = 849', 'Got ' + totalWards);

// ============================================================
// SECTION 10: ML model artifact schema & honest metadata
// ============================================================
section('10. ML Heatwave Model Artifact (R11)');

const mlPaths = [
  join(ROOT, 'data/training/portable-heatwave-model.json'),
  join(ROOT, 'public/data/training/portable-heatwave-model.json'),
];
const mlPath = mlPaths.find((p) => existsSync(p));
if (mlPath) {
  const model = JSON.parse(readFileSync(mlPath, 'utf-8'));
  assert(typeof model.intercept === 'number', 'ML model has numeric intercept', '');
  assert(Array.isArray(model.weights) && model.weights.length === model.features.length, 'ML weights align with features', '');
  assert(typeof model.threshold === 'number' && model.threshold > 0 && model.threshold < 1, 'ML threshold in (0,1)', 'Got ' + model.threshold);
  assert(model.health_outcome_model === false, 'ML artifact declares health_outcome_model=false', '');
  assert(/Rajasthan/i.test(model.training_domain || ''), 'ML training domain discloses Rajasthan', model.training_domain);
  assert(/indicative/i.test(model.warning || model.training_domain || ''), 'ML warning marks transfer as indicative', '');
} else {
  console.log('  SKIP: portable-heatwave-model.json not found (optional)');
}

// Cleanup temp build
rmSync(BUILD, { recursive: true, force: true });

// ============================================================
// FINAL SUMMARY
// ============================================================
console.log('\n' + '='.repeat(60));
console.log('HEATPULSE DETERMINISTIC TEST SUITE -- RESULTS');
console.log('='.repeat(60));
console.log('  Total: ' + (passed + failed));
console.log('  PASSED: ' + passed);
console.log('  FAILED: ' + failed);

if (failures.length > 0) {
  console.log('\nFailed assertions:');
  failures.forEach((f, i) => {
    console.error('  ' + (i + 1) + '. ' + f.label);
    if (f.details) console.error('     ' + f.details);
  });
  process.exit(1);
} else {
  console.log('\n100% SUCCESS: ALL DETERMINISTIC TESTS PASSED!\n');
  process.exit(0);
}
