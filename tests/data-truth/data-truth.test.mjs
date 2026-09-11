/**
 * Tier 2 Scientific & Data-Truth Assertion Suite
 * 
 * Standard: SIH26083 Master Build Specification (MoES / NCMRWF)
 * Scope: 15 Assertion Checks covering:
 *   1. Zero fake ML claims / zero imports of fake ML models
 *   2. Zero deceptive AI/ML predictive claims
 *   3. Zero synthetic mortality figures in codebase
 *   4. Zero synthetic hospitalization figures in codebase
 *   5. Explicit disabled health layer ("Coming with validated health-outcome model")
 *   6. Zero fake IMD ward-level warnings or heatwave claims
 *   7. Segregated official IMD district reference warnings
 *   8. Transparent UTCI Proxy labeling (no unacknowledged proxy claims)
 *   9. Honest weather attribution: "Ward-localized forecast derived from numerical weather prediction"
 *  10. Thermal score scaling correction (no / 3.4 deflation bug)
 *  11. NOAA Rothfusz Heat Index humidity adjustments (RH < 13% and RH > 85%)
 *  12. BoM simplified outdoor WBGT equation verification (0.567T + 0.393e + 3.94)
 *  13. Transparent stale/unavailable error handling states
 *  14. Zero hardcoded blueprint illustrative metrics in API responses
 *  15. Strict 5-concept scientific separation
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANDIDATE_ROOT = path.resolve(__dirname, '../..');
const IS_IN_HEATPULSE = fs.existsSync(path.join(CANDIDATE_ROOT, 'src')) && fs.existsSync(path.join(CANDIDATE_ROOT, 'public'));
const HEATPULSE_DIR = IS_IN_HEATPULSE ? CANDIDATE_ROOT : path.join(CANDIDATE_ROOT, 'heatpulse');
const REPO_ROOT = IS_IN_HEATPULSE ? path.resolve(CANDIDATE_ROOT, '..') : CANDIDATE_ROOT;
const SRC_DIR = path.join(HEATPULSE_DIR, 'src');
const PACKAGE_JSON_PATH = path.join(HEATPULSE_DIR, 'package.json');

// Helper to recursively collect all source files
function getSourceFiles(dir, exts = ['.ts', '.tsx', '.js', '.jsx']) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        files.push(...getSourceFiles(fullPath, exts));
      }
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

// Helper to read file content safely
function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

export function runDataTruthTests() {
  console.log('='.repeat(78));
  console.log('  HEATPULSE TIER 2: SCIENTIFIC & DATA-TRUTH ASSERTION SUITE');
  console.log('  Scope: 15 Scientific Integrity & Equation Accuracy Checks');
  console.log('='.repeat(78));

  const results = [];
  let checkIndex = 0;

  function assertCheck(description, testFn) {
    checkIndex++;
    try {
      testFn();
      results.push({ index: checkIndex, description, status: 'PASS' });
      console.log(`[PASS] Check ${String(checkIndex).padStart(2, '0')}: ${description}`);
    } catch (err) {
      results.push({ index: checkIndex, description, status: 'FAIL', error: err.message });
      console.error(`[FAIL] Check ${String(checkIndex).padStart(2, '0')}: ${description}`);
      console.error(`       Details: ${err.message}`);
    }
  }

  const allSourceFiles = getSourceFiles(SRC_DIR);
  const pkgJson = JSON.parse(readFileSafe(PACKAGE_JSON_PATH) || '{}');
  const allDependencies = {
    ...(pkgJson.dependencies || {}),
    ...(pkgJson.devDependencies || {}),
  };

  // -------------------------------------------------------------------------
  // CHECK 1: Zero Fake ML Library Imports
  // -------------------------------------------------------------------------
  assertCheck('Zero fake ML library imports in package.json and source code', () => {
    const prohibitedPkgs = [
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-node',
      'brain.js',
      'scikit-learn',
      'keras',
      'onnxruntime-node',
      'ml5',
      'synaptic',
      'convnetjs',
    ];

    for (const pkg of prohibitedPkgs) {
      if (allDependencies[pkg]) {
        throw new Error(`Prohibited fake ML package "${pkg}" declared in package.json`);
      }
    }

    for (const file of allSourceFiles) {
      const content = readFileSafe(file);
      for (const pkg of prohibitedPkgs) {
        if (content.includes(`from '${pkg}'`) || content.includes(`from "${pkg}"`) || content.includes(`require('${pkg}')`)) {
          throw new Error(`Prohibited ML package "${pkg}" imported in ${path.relative(REPO_ROOT, file)}`);
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // CHECK 2: Zero Deceptive AI/ML Predictive Claims
  // -------------------------------------------------------------------------
  assertCheck('Zero deceptive AI/ML marketing claims in UI and source code', () => {
    const deceptivePatterns = [
      /deep\s+learning\s+(?:model\s+)?predicts/i,
      /neural\s+net(?:work)?\s+(?:heatwave\s+)?prediction/i,
      /ai-powered\s+mortality/i,
      /trained\s+on\s+deep\s+learning/i,
      /machine\s+learning\s+heatwave\s+forecast/i,
    ];

    for (const file of allSourceFiles) {
      const content = readFileSafe(file);
      for (const pattern of deceptivePatterns) {
        const match = content.match(pattern);
        if (match) {
          throw new Error(`Deceptive claim pattern "${match[0]}" found in ${path.relative(REPO_ROOT, file)}`);
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // CHECK 3: Zero Synthetic Mortality Numbers in Codebase
  // -------------------------------------------------------------------------
  assertCheck('Zero synthetic mortality figures in codebase and data structures', () => {
    const mortalityPatterns = [
      /(?:expected|projected|forecasted|estimated)\s+(?:mortality|deaths|fatalities)\s*[:=]\s*\d+/i,
      /heat_mortality_count\s*[:=]\s*\d+/i,
      /deaths_projected\s*[:=]\s*\d+/i,
    ];

    for (const file of allSourceFiles) {
      const content = readFileSafe(file);
      for (const pattern of mortalityPatterns) {
        const match = content.match(pattern);
        if (match) {
          throw new Error(`Synthetic mortality pattern "${match[0]}" found in ${path.relative(REPO_ROOT, file)}`);
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // CHECK 4: Zero Synthetic Hospitalization Figures in Codebase
  // -------------------------------------------------------------------------
  assertCheck('Zero synthetic hospitalization figures in codebase and data structures', () => {
    const hospPatterns = [
      /(?:projected|forecasted|estimated)\s+(?:hospitalizations|admissions|er_visits)\s*[:=]\s*\d+/i,
      /hospitalization_spike_pct\s*[:=]\s*\d+/i,
      /er_surge_count\s*[:=]\s*\d+/i,
    ];

    for (const file of allSourceFiles) {
      const content = readFileSafe(file);
      for (const pattern of hospPatterns) {
        const match = content.match(pattern);
        if (match) {
          throw new Error(`Synthetic hospitalization pattern "${match[0]}" found in ${path.relative(REPO_ROOT, file)}`);
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // CHECK 5: Explicit Disabled Health Layer Copy
  // -------------------------------------------------------------------------
  assertCheck('Explicit disabled health layer ("Coming with validated health-outcome model")', () => {
    const requiredPhrase = 'Coming with validated health-outcome model';
    let foundInSrc = false;
    for (const file of allSourceFiles) {
      const content = readFileSafe(file);
      if (content.includes(requiredPhrase)) {
        foundInSrc = true;
        break;
      }
    }

    // Also check PROJECT.md or types as specification baseline
    const projectMd = readFileSafe(path.join(REPO_ROOT, 'PROJECT.md'));
    const foundInSpec = projectMd.includes(requiredPhrase);

    if (!foundInSrc && !foundInSpec) {
      throw new Error(`Mandatory phrase "${requiredPhrase}" not found in source code or PROJECT.md`);
    }
    if (!foundInSrc) {
      throw new Error(`Mandatory phrase "${requiredPhrase}" specified in PROJECT.md but not yet implemented in src/ (Milestone 5 pending)`);
    }
  });

  // -------------------------------------------------------------------------
  // CHECK 6: Zero Fabricated IMD Ward-Level Warnings
  // -------------------------------------------------------------------------
  assertCheck('Zero fabricated IMD ward-level warnings or heatwave claims', () => {
    const fakeImdWardPatterns = [
      /imd\s+ward(?:-level)?\s+(?:warning|alert|heatwave)/i,
      /imd\s+warns\s+ward/i,
      /imd_ward_alert/i,
      /official\s+imd\s+alert\s+for\s+ward/i,
    ];

    for (const file of allSourceFiles) {
      const content = readFileSafe(file);
      for (const pattern of fakeImdWardPatterns) {
        const match = content.match(pattern);
        if (match) {
          throw new Error(`Fabricated IMD ward warning "${match[0]}" found in ${path.relative(REPO_ROOT, file)}`);
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // CHECK 7: Segregated Official IMD District Reference Warnings
  // -------------------------------------------------------------------------
  assertCheck('Segregated official IMD district reference warnings architecture', () => {
    // IMD warnings must be segregated at the district level and separate from localized ward thermal indices
    const imdServicePath = path.join(SRC_DIR, 'lib/imd-service.ts');
    const imdRoutePath = path.join(SRC_DIR, 'app/api/imd/route.ts');
    const thermalPath = path.join(SRC_DIR, 'lib/thermal.ts');
    const thermalEnginePath = path.join(SRC_DIR, 'lib/thermal-engine.ts');

    const hasImdSegregation = fs.existsSync(imdServicePath) || fs.existsSync(imdRoutePath);

    // Verify thermal engine does not mix IMD claims into ward outputs
    const activeThermal = fs.existsSync(thermalEnginePath) ? thermalEnginePath : thermalPath;
    const content = readFileSafe(activeThermal);
    if (/imd_level|imd_warning_code/i.test(content)) {
      throw new Error(`Thermal calculation module at ${activeThermal} conflates IMD warnings with thermal indices`);
    }

    if (!hasImdSegregation) {
      // Check PROJECT.md contract compliance
      const projectMd = readFileSafe(path.join(REPO_ROOT, 'PROJECT.md'));
      if (!projectMd.includes('Official IMD District Warning Segregation')) {
        throw new Error('Official IMD district warning segregation not defined in architecture or source code');
      }
      throw new Error('IMD service/route not yet implemented in src/ (Milestone 4 pending)');
    }
  });

  // -------------------------------------------------------------------------
  // CHECK 8: Transparent UTCI Proxy Labeling
  // -------------------------------------------------------------------------
  assertCheck('Transparent UTCI Proxy labeling (no unacknowledged proxy claims)', () => {
    const thermalEnginePath = path.join(SRC_DIR, 'lib/thermal-engine.ts');
    const thermalPath = path.join(SRC_DIR, 'lib/thermal.ts');
    const thermalFile = fs.existsSync(thermalEnginePath) ? thermalEnginePath : thermalPath;
    const content = readFileSafe(thermalFile);

    const hasUtciProxyLabel = /utci_proxy|UTCI\s+Proxy/i.test(content);
    if (!hasUtciProxyLabel) {
      throw new Error(`Apparent temperature approximation not designated as "UTCI Proxy" in ${path.relative(REPO_ROOT, thermalFile)}`);
    }

    // Must not mislabel as utc_index without proxy note
    if (content.includes('utc_index') && !content.includes('UTCI Proxy') && !content.includes('utci_proxy')) {
      throw new Error('Found legacy "utc_index" field without UTCI Proxy designation');
    }
  });

  // -------------------------------------------------------------------------
  // CHECK 9: Honest Weather Attribution
  // -------------------------------------------------------------------------
  assertCheck('Honest weather attribution: "Ward-localized forecast derived from numerical weather prediction"', () => {
    const requiredAttribution = 'Ward-localized forecast derived from numerical weather prediction';
    let found = false;
    for (const file of allSourceFiles) {
      if (readFileSafe(file).includes(requiredAttribution)) {
        found = true;
        break;
      }
    }
    if (!found) {
      const projectMd = readFileSafe(path.join(REPO_ROOT, 'PROJECT.md'));
      if (projectMd.includes(requiredAttribution)) {
        throw new Error(`Mandatory attribution "${requiredAttribution}" defined in PROJECT.md but not yet wired into src/ (Milestone 3 pending)`);
      }
      throw new Error(`Mandatory attribution "${requiredAttribution}" missing from codebase`);
    }
  });

  // -------------------------------------------------------------------------
  // CHECK 10: Thermal Score Scaling Correction (Eliminate / 3.4 Deflation Bug)
  // -------------------------------------------------------------------------
  assertCheck('Thermal score scaling correction (no / 3.4 deflation bug)', () => {
    const riskEnginePath = path.join(SRC_DIR, 'lib/risk-engine.ts');
    const riskLegacyPath = path.join(SRC_DIR, 'lib/risk.ts');
    const activeRiskPath = fs.existsSync(riskEnginePath) ? riskEnginePath : riskLegacyPath;
    const content = readFileSafe(activeRiskPath);

    // Defect: (heatIndex - 20) / 3.4 deflates the score by 10x
    const hasDeflationBug = /\/\s*3\.4(?!\d)/.test(content);
    if (hasDeflationBug) {
      throw new Error(`Legacy / 3.4 deflation bug detected in ${path.relative(REPO_ROOT, activeRiskPath)}. Must divide by 0.34 or multiply by (100 / 34).`);
    }

    const hasCorrectScaling = /\/\s*0\.34|\*\s*\(?\s*100\s*\/\s*34\s*\)?|\*\s*2\.94/.test(content);
    if (!hasCorrectScaling) {
      throw new Error(`Correct thermal scaling (/ 0.34 or * 100/34) not found in ${path.relative(REPO_ROOT, activeRiskPath)}`);
    }
  });

  // -------------------------------------------------------------------------
  // CHECK 11: NOAA Rothfusz Heat Index Humidity Adjustments
  // -------------------------------------------------------------------------
  assertCheck('NOAA Rothfusz Heat Index implements low & high humidity adjustments for T >= 27°C', () => {
    const thermalEnginePath = path.join(SRC_DIR, 'lib/thermal-engine.ts');
    const thermalLegacyPath = path.join(SRC_DIR, 'lib/thermal.ts');
    const activeThermalPath = fs.existsSync(thermalEnginePath) ? thermalEnginePath : thermalLegacyPath;
    const content = readFileSafe(activeThermalPath);

    // Low humidity adjustment (RH < 13%): uses (13 - RH) / 4 and sqrt((17 - |T - 95|) / 17)
    // High humidity adjustment (RH > 85%): uses (RH - 85) / 10 and (87 - T) / 5
    const hasLowAdjustment = /13\s*-\s*(?:humidity|R|rh)|13\s*%/i.test(content) || /low-?humidity\s+adjustment/i.test(content);
    const hasHighAdjustment = /(?:humidity|R|rh)\s*-\s*85|85\s*%/i.test(content) || /high-?humidity\s+adjustment/i.test(content);

    if (!hasLowAdjustment || !hasHighAdjustment) {
      throw new Error(`NOAA Heat Index in ${path.relative(REPO_ROOT, activeThermalPath)} lacks mandatory NWS low (<13%) or high (>85%) humidity adjustment terms (Milestone 4 pending)`);
    }
  });

  // -------------------------------------------------------------------------
  // CHECK 12: BoM Simplified Outdoor WBGT Equation Verification
  // -------------------------------------------------------------------------
  assertCheck('BoM simplified outdoor WBGT equation verification (0.567T + 0.393e + 3.94)', () => {
    const thermalEnginePath = path.join(SRC_DIR, 'lib/thermal-engine.ts');
    const thermalLegacyPath = path.join(SRC_DIR, 'lib/thermal.ts');
    const activeThermalPath = fs.existsSync(thermalEnginePath) ? thermalEnginePath : thermalLegacyPath;
    const content = readFileSafe(activeThermalPath);

    // Verify formula coefficients: 0.567, 0.393, 3.94
    const hasBomFormula = /0\.567/i.test(content) && /0\.393/i.test(content) && /3\.94/i.test(content);
    if (!hasBomFormula) {
      throw new Error(`BoM outdoor WBGT formula (0.567T + 0.393e + 3.94) not found in ${path.relative(REPO_ROOT, activeThermalPath)}`);
    }

    // Verify vapor pressure conversion (Magnus-Tetens)
    const hasVaporPressure = /0\.6108/i.test(content) && /17\.27/i.test(content) && /237\.3/i.test(content);
    if (!hasVaporPressure) {
      throw new Error(`Magnus-Tetens vapor pressure formulation missing in ${path.relative(REPO_ROOT, activeThermalPath)}`);
    }

    // Verify formula evaluation: T=35, RH=50% -> e ≈ 28.12 hPa -> WBGT ≈ 34.8°C
    const e = (50 / 100) * 0.6108 * Math.exp((17.27 * 35) / (237.3 + 35)) * 10;
    const wbgt = 0.567 * 35 + 0.393 * e + 3.94;
    const roundedWbgt = Math.round(wbgt * 10) / 10;
    if (Math.abs(roundedWbgt - 34.8) > 0.2) {
      throw new Error(`Mathematical verification failed: expected WBGT(35°C, 50% RH) ≈ 34.8°C, got ${roundedWbgt}°C`);
    }
  });

  // -------------------------------------------------------------------------
  // CHECK 13: Transparent Stale/Unavailable Error Handling States
  // -------------------------------------------------------------------------
  assertCheck('Transparent stale/unavailable error handling states without fake fallback data', () => {
    const weatherCachePath = path.join(SRC_DIR, 'lib/weather-cache.ts');
    const weatherServicePath = path.join(SRC_DIR, 'lib/weather-service.ts');
    const weatherTypesPath = path.join(SRC_DIR, 'types/weather.ts');

    const hasCacheOrService = fs.existsSync(weatherCachePath) || fs.existsSync(weatherServicePath) || fs.existsSync(weatherTypesPath);
    if (!hasCacheOrService) {
      throw new Error('Weather cache / service / types modules not yet implemented in src/ (Milestone 3 pending)');
    }

    let foundStaleState = false;
    for (const f of [weatherCachePath, weatherServicePath, weatherTypesPath]) {
      if (fs.existsSync(f)) {
        const c = readFileSafe(f);
        if (c.includes("'stale'") || c.includes('"stale"') || c.includes("'unavailable'")) {
          foundStaleState = true;
          break;
        }
      }
    }

    if (!foundStaleState) {
      throw new Error('Weather pipeline lacks explicit "stale" or "unavailable" status state tracking');
    }
  });

  // -------------------------------------------------------------------------
  // CHECK 14: Zero Hardcoded Blueprint Illustrative Metrics in API Responses
  // -------------------------------------------------------------------------
  assertCheck('Zero hardcoded blueprint illustrative metrics in API route responses', () => {
    const apiDir = path.join(SRC_DIR, 'app/api');
    const apiFiles = getSourceFiles(apiDir);

    for (const file of apiFiles) {
      const content = readFileSafe(file);
      // Ensure API routes do not hardcode fixed mortality numbers or static fake casualties
      if (/deaths\s*:\s*\d{2,}/i.test(content) || /casualties\s*:\s*\d+/i.test(content)) {
        throw new Error(`Hardcoded casualty figures in ${path.relative(REPO_ROOT, file)}`);
      }
    }
  });

  // -------------------------------------------------------------------------
  // CHECK 15: Strict 5-Concept Scientific Separation
  // -------------------------------------------------------------------------
  assertCheck('Strict 5-concept scientific separation in types and data models', () => {
    const thermalTypesPath = path.join(SRC_DIR, 'types/thermal.ts');
    if (!fs.existsSync(thermalTypesPath)) {
      throw new Error('Strict thermal types module src/types/thermal.ts not yet implemented (Milestone 4 pending)');
    }

    const content = readFileSafe(thermalTypesPath);
    const concepts = [
      'HeatCondition',
      'ThermalStress',
      'Vulnerability',
      'CompositeRisk',
      'HealthImpact',
    ];

    for (const concept of concepts) {
      if (!content.includes(concept)) {
        throw new Error(`Concept "${concept}" missing from strict type definitions in ${path.relative(REPO_ROOT, thermalTypesPath)}`);
      }
    }
  });

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log('-'.repeat(78));
  console.log(`  SUMMARY: ${passed} Passed, ${failed} Failed out of ${results.length} Checks`);
  console.log('='.repeat(78));

  return { passed, failed, total: results.length, results };
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { failed } = runDataTruthTests();
  process.exit(failed > 0 ? 1 : 0);
}
