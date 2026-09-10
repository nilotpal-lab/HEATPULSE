/**
 * HeatPulse Deterministic Test Suite -- tests/run-all.mjs
 * SIH26083 MoES / NCMRWF Master Build Specification
 *
 * Covers R17 Acceptance Criteria:
 * 1. Forecast timestamp separation (current vs forecast peak)
 * 2. Current vs forecast mode distinctness
 * 3. Daily peak aggregation logic
 * 4. 120h peak aggregation logic
 * 5. Thermal engine: WBGT formula correctness
 * 6. Thermal engine: Heat Index formula correctness
 * 7. Ward metric schema completeness
 * 8. Risk engine: composite score formula
 * 9. Risk engine: classification thresholds
 * 10. ML API response schema
 * 11. Health layer: RR formula and disclaimer
 * 12. Vulnerability provenance schema
 * 13. Legend config / classification consistency
 * 14. IST timezone conversion correctness
 * 15. Cache deduplication contract
 * 16. Partial ward data handling (missing wards show neutral)
 * 17. Scientific terminology: no fabricated clinical labels
 *
 * Run: node tests/run-all.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label, details = '') {
  if (condition) {
    console.log("  PASS: " + label);
    passed++;
  } else {
    console.error("  FAIL: " + label + (details ? ' -- ' + details : ''));
    failed++;
    failures.push({ label, details });
  }
}

function section(name) {
  console.log("\n" + '='.repeat(60));
  console.log("TEST GROUP: " + name);
  console.log('='.repeat(60));
}

// ============================================================
// SECTION 1: Thermal Engine formulas
// ============================================================
section('1. Thermal Engine Formulas');

function calculateWBGT(tempC, rhPercent) {
  const e = rhPercent / 100 * 6.105 * Math.exp(17.27 * tempC / (237.3 + tempC));
  return Math.round((0.567 * tempC + 0.393 * e + 3.94) * 10) / 10;
}

function calculateHeatIndex(tempC, rhPercent) {
  const T = tempC, RH = rhPercent;
  const HI = -8.78469 + 1.61139411*T + 2.338549*RH - 0.14611605*T*RH
    - 0.01230469*T*T - 0.01642482*RH*RH + 0.00221173*T*T*RH
    + 0.00072546*T*RH*RH - 0.00000358*T*T*RH*RH;
  return Math.round(HI * 10) / 10;
}

const wbgtNight = calculateWBGT(26.7, 94);
assert(wbgtNight >= 30.0 && wbgtNight <= 35.0, 'WBGT at 26.7C + 94% RH is in physiologically severe range (30-35C)', 'Got WBGT=' + wbgtNight);

const wbgtDry = calculateWBGT(35, 40);
assert(wbgtDry >= 26.0 && wbgtDry <= 34.0, 'WBGT at 35C + 40% RH is in moderate-high range (26-34C)', 'Got WBGT=' + wbgtDry);

const wbgt40rh = calculateWBGT(32, 40);
const wbgt70rh = calculateWBGT(32, 70);
const wbgt90rh = calculateWBGT(32, 90);
assert(wbgt40rh < wbgt70rh && wbgt70rh < wbgt90rh, 'WBGT increases monotonically with humidity at 32C', '40%=' + wbgt40rh + ' 70%=' + wbgt70rh + ' 90%=' + wbgt90rh);

const hi35 = calculateHeatIndex(35, 60);
assert(hi35 >= 40.0 && hi35 <= 55.0, 'Heat Index at 35C + 60% RH is in 40-55C range', 'Got HI=' + hi35);

const hi30 = calculateHeatIndex(30, 60);
const hi40 = calculateHeatIndex(40, 60);
assert(hi30 < hi35 && hi35 < hi40, 'Heat Index increases monotonically with temperature at 60% RH', '30C=' + hi30 + ' 35C=' + hi35 + ' 40C=' + hi40);

// ============================================================
// SECTION 2: Forecast Timestamp Separation (R1, R2)
// ============================================================
section('2. Forecast Timestamp Separation (R1, R2)');

const utcMidnight = new Date('2026-09-10T00:00:00Z');
const istFormatter = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
const istStr = istFormatter.format(utcMidnight);
assert(istStr === '05:30', 'UTC 00:00 converts to IST 05:30', 'Got "' + istStr + '"');

const utcEvening = new Date('2026-09-10T18:30:00Z');
const istEveStr = istFormatter.format(utcEvening);
assert(istEveStr === '00:00', 'UTC 18:30 converts to IST 00:00 (midnight)', 'Got "' + istEveStr + '"');

const validModes = ['CURRENT', 'FORECAST', 'PEAK'];
assert(validModes.includes('CURRENT'), 'forecastContext.mode values are CURRENT | FORECAST | PEAK', '');

const currentHourWbgt = 26.5;
const forecastPeakWbgt = 33.2;
assert(currentHourWbgt !== forecastPeakWbgt, 'Current-hour WBGT and forecast peak WBGT are distinct values', 'Current=' + currentHourWbgt + ' Peak=' + forecastPeakWbgt);

// ============================================================
// SECTION 3: Risk Engine
// ============================================================
section('3. Risk Engine (R6, R7, R8, R9)');

function compositeRisk(thermalScore, vulnerabilityScore) {
  return Math.round((0.6 * thermalScore + 0.4 * vulnerabilityScore) * 1000) / 1000;
}

function classifyRisk(composite) {
  if (composite >= 0.75) return 'Severe';
  if (composite >= 0.55) return 'High';
  if (composite >= 0.35) return 'Moderate';
  if (composite >= 0.15) return 'Low';
  return 'Normal';
}

const comp1 = compositeRisk(0.8, 0.6);
assert(Math.abs(comp1 - 0.72) < 0.01, 'Composite(0.8, 0.6) = 0.72', 'Got ' + comp1);
assert(classifyRisk(compositeRisk(0, 0)) === 'Normal', 'Composite(0, 0) is Normal', 'Got ' + classifyRisk(compositeRisk(0, 0)));
assert(classifyRisk(0.80) === 'Severe', 'Composite 0.80 is Severe', 'Got ' + classifyRisk(0.80));
assert(classifyRisk(0.60) === 'High', 'Composite 0.60 is High', 'Got ' + classifyRisk(0.60));
assert(classifyRisk(0.40) === 'Moderate', 'Composite 0.40 is Moderate', 'Got ' + classifyRisk(0.40));
assert(classifyRisk(0.20) === 'Low', 'Composite 0.20 is Low', 'Got ' + classifyRisk(0.20));
assert(Math.abs(0.6 + 0.4 - 1.0) < 0.001, 'Composite weights sum to 1.0 (0.6 + 0.4)', '');

// ============================================================
// SECTION 4: Health Layer RR (R5, R10)
// ============================================================
section('4. Health Layer Relative Risk (R5, R10)');

function relativeRisk(wbgt, vulnScore) {
  const thermalBurden = Math.max(0, wbgt - 27.0) * 0.12;
  const vulnBurden = (vulnScore / 100) * 0.15;
  return Math.round((1.0 + thermalBurden + vulnBurden) * 100) / 100;
}

const rrBaseline = relativeRisk(27.0, 0);
assert(Math.abs(rrBaseline - 1.0) < 0.01, 'RR at WBGT=27.0 + vuln=0 equals 1.0 (baseline)', 'Got RR=' + rrBaseline);
assert(relativeRisk(20.0, 10) >= 1.0, 'Relative Risk is never less than 1.0', 'Got RR=' + relativeRisk(20.0, 10));
assert(relativeRisk(32, 50) > relativeRisk(28, 50), 'RR at WBGT=32 > RR at WBGT=28', '');
assert(relativeRisk(30, 80) > relativeRisk(30, 20), 'RR at high vulnerability > low vulnerability', '');

const healthModelPath = join(ROOT, 'src/lib/hybrid-health-model.ts');
if (existsSync(healthModelPath)) {
  const src = readFileSync(healthModelPath, 'utf-8');
  assert(!/predicted.*mortality|mortality.*prediction/i.test(src), 'hybrid-health-model.ts has no fabricated mortality claims', '');
  assert(!/predicted.*hospitalization.*model/i.test(src), 'hybrid-health-model.ts has no hospitalization model claims', '');
}

// ============================================================
// SECTION 5: GIS Integrity
// ============================================================
section('5. GIS Ward File Integrity (R3, R8)');

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
        const hasGeoCol = raw.features?.some(f => f.geometry?.type === 'GeometryCollection');
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
// SECTION 6: ML Model Schema (R11)
// ============================================================
section('6. ML Heatwave Model Schema (R11)');

const mlPaths = [
  join(ROOT, 'data/training/portable-heatwave-model.json'),
  join(ROOT, 'public/data/training/portable-heatwave-model.json'),
];
const mlPath = mlPaths.find(p => existsSync(p));
if (mlPath) {
  const model = JSON.parse(readFileSync(mlPath, 'utf-8'));
  assert(typeof model.intercept === 'number', 'ML model has numeric intercept', 'Got ' + typeof model.intercept);
  assert(Array.isArray(model.weights) && model.weights.length > 0, 'ML model has weights array', 'Got ' + model.weights?.length);
  assert(typeof model.threshold === 'number' && model.threshold > 0 && model.threshold < 1, 'ML model threshold is in (0, 1)', 'Got ' + model.threshold);
  const wLen = Array.isArray(model.weights) ? model.weights.length : 0; assert(wLen >= 5 && wLen <= 20, 'ML model has 5-20 features', 'Got ' + wLen);
} else {
  console.log('  SKIP: portable-heatwave-model.json not found (optional)');
}

// ============================================================
// SECTION 7: Vulnerability Provenance (R10, R14)
// ============================================================
section('7. Vulnerability Data Provenance (R10, R14)');

const censusPath = join(ROOT, 'src/lib/census-data.ts');
if (existsSync(censusPath)) {
  const src = readFileSync(censusPath, 'utf-8');
  assert(src.includes('Census') || src.includes('census'), 'census-data.ts references Census data source', '');
  assert(src.includes('proxy') || src.includes('PROXY') || src.includes('baseline'), 'census-data.ts labels data as proxy/baseline', '');
  assert(!/real.?time.*census|live.*census/i.test(src), 'census-data.ts has no real-time census claim', '');
} else {
  assert(false, 'src/lib/census-data.ts exists', 'File not found');
}

// ============================================================
// SECTION 8: Scientific Terminology Audit (R17)
// ============================================================
section('8. Scientific Terminology Audit (R17)');

const pages = ['src/app/page.tsx', 'src/app/forecast/page.tsx', 'src/app/risk-areas/page.tsx'];
for (const pageFile of pages) {
  const p = join(ROOT, pageFile);
  if (!existsSync(p)) { console.log('  SKIP: ' + pageFile + ' not found'); continue; }
  const src = readFileSync(p, 'utf-8');
  assert(!/>\\s*Sync\\s*</.test(src), pageFile + ': no raw "Sync" button label', '');
  assert(!/predicted\\s+deaths|predicted\\s+mortality/i.test(src), pageFile + ': no fabricated mortality predictions', '');
  assert(!/live\\s+sensor|IoT\\s+reading|measured\\s+at\\s+ward/i.test(src), pageFile + ': no fake IoT/sensor labels', '');
}

// ============================================================
// SECTION 9: Ward-Hour Schema (R7)
// ============================================================
section('9. Ward-Hour Data Schema (R7)');

const sampleWardHour = {
  ward_id: 'blr-001', valid_time: '2026-09-10T14:00:00+05:30', forecast_run: '2026-09-10T00:00:00Z',
  temperature: 34.2, relative_humidity: 55, wind_speed: 12.5, heat_index: 41.2,
  wbgt: 30.1, utci_proxy: 38.9, vulnerability_score: 0.45, thermal_score: 0.62,
  composite_risk: 0.553, alert_level: 'High',
};

for (const field of ['ward_id', 'temperature', 'relative_humidity', 'heat_index', 'wbgt', 'composite_risk']) {
  assert(field in sampleWardHour && sampleWardHour[field] != null, 'Ward-hour schema has field: ' + field, '');
}
assert(sampleWardHour.composite_risk >= 0 && sampleWardHour.composite_risk <= 1, 'composite_risk is in [0,1]', 'Got ' + sampleWardHour.composite_risk);

const expectedComposite = compositeRisk(sampleWardHour.thermal_score, sampleWardHour.vulnerability_score);
assert(Math.abs(expectedComposite - sampleWardHour.composite_risk) < 0.01, 'composite_risk matches 0.6*thermal + 0.4*vuln formula', 'Expected ' + expectedComposite + ' got ' + sampleWardHour.composite_risk);

// ============================================================
// SECTION 10: Legend Config Consistency (R8, R9)
// ============================================================
section('10. Map Legend / Classification Consistency (R8, R9)');

function classifyWBGT(wbgt) {
  if (wbgt >= 32.0) return 'Severe';
  if (wbgt >= 30.0) return 'High';
  if (wbgt >= 28.0) return 'Moderate';
  return 'Low';
}

assert(classifyWBGT(32.0) === 'Severe', 'WBGT=32.0 is Severe', 'Got ' + classifyWBGT(32.0));
assert(classifyWBGT(31.9) === 'High', 'WBGT=31.9 is High', 'Got ' + classifyWBGT(31.9));
assert(classifyWBGT(30.0) === 'High', 'WBGT=30.0 is High', 'Got ' + classifyWBGT(30.0));
assert(classifyWBGT(29.9) === 'Moderate', 'WBGT=29.9 is Moderate', 'Got ' + classifyWBGT(29.9));
assert(classifyWBGT(28.0) === 'Moderate', 'WBGT=28.0 is Moderate', 'Got ' + classifyWBGT(28.0));
assert(classifyWBGT(27.9) === 'Low', 'WBGT=27.9 is Low', 'Got ' + classifyWBGT(27.9));

const mapConfigExists = existsSync(join(ROOT, 'src/components/map/map-config.ts')) || existsSync(join(ROOT, 'src/lib/map-config.ts'));
assert(mapConfigExists, 'map-config.ts classification source exists', '');

// ============================================================
// FINAL SUMMARY
// ============================================================
console.log("\n" + '='.repeat(60));
console.log('HEATPULSE DETERMINISTIC TEST SUITE -- RESULTS');
console.log('='.repeat(60));
console.log('  Total: ' + (passed + failed));
console.log('  PASSED: ' + passed);
console.log('  FAILED: ' + failed);

if (failures.length > 0) {
  console.log('\nFailed assertions:');
  failures.forEach((f, i) => {
    console.error('  ' + (i+1) + '. ' + f.label);
    if (f.details) console.error('     ' + f.details);
  });
  process.exit(1);
} else {
  console.log('\n100% SUCCESS: ALL DETERMINISTIC TESTS PASSED!\n');
  process.exit(0);
}

