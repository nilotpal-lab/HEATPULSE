/**
 * HeatPulse Master Test Runner
 * 
 * Standard: SIH26083 Master Build Specification (MoES / NCMRWF)
 * Executes all automated test suites:
 *   - Tier 1: Deterministic GIS Validation Suite (62 checks across 849 municipal wards & national boundaries)
 *   - Tier 2: Scientific & Data-Truth Assertion Suite (15 checks)
 * 
 * Exit Codes:
 *   0: All checks passed (100% test success)
 *   1: One or more checks failed
 */

import { runGisValidationTests } from './gis/gis-validation.test.mjs';
import { runStateTooltipBasemapTests } from './gis/state-tooltip-basemap-consistency.test.mjs';
import { runDataTruthTests } from './data-truth/data-truth.test.mjs';

console.log('\n' + '#'.repeat(78));
console.log('  HEATPULSE E2E AUTOMATED DETERMINISTIC & DATA-TRUTH TEST RUNNER');
console.log('  Ministry of Earth Sciences / NCMRWF — SIH26083 Verification');
console.log('#'.repeat(78) + '\n');

const startTime = Date.now();

// 1. Run Tier 1: GIS Validation (62 checks)
const gisResults = runGisValidationTests();

console.log('\n');

// 2. Run Tier 1 Extension: State Tooltip & Basemap Consistency (8 checks)
const stateTooltipResults = runStateTooltipBasemapTests();

console.log('\n');

// 3. Run Tier 2: Data-Truth Assertions (15 checks)
const dataTruthResults = runDataTruthTests();

const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
const grandTotal = gisResults.total + stateTooltipResults.total + dataTruthResults.total;
const grandPassed = gisResults.passed + stateTooltipResults.passed + dataTruthResults.passed;
const grandFailed = gisResults.failed + stateTooltipResults.failed + dataTruthResults.failed;

console.log('\n' + '='.repeat(78));
console.log('  GRAND SUMMARY ACROSS ALL TIERS');
console.log('='.repeat(78));
console.log(`  Tier 1 (GIS & National Boundaries): ${gisResults.passed}/${gisResults.total} passed`);
console.log(`  Tier 1 Ext (State Tooltip/Basemap): ${stateTooltipResults.passed}/${stateTooltipResults.total} passed`);
console.log(`  Tier 2 (Scientific & Data-Truth)  : ${dataTruthResults.passed}/${dataTruthResults.total} passed`);
console.log('-'.repeat(78));
console.log(`  OVERALL TOTAL                     : ${grandPassed}/${grandTotal} passed (${grandFailed} failed)`);
console.log(`  EXECUTION DURATION                : ${totalDuration}s`);
console.log('='.repeat(78) + '\n');

if (grandFailed > 0) {
  console.error(`[TEST RUNNER] FAILED: ${grandFailed} check(s) did not pass. Inspect details above.\n`);
  process.exit(1);
} else {
  console.log(`[TEST RUNNER] SUCCESS: All ${grandTotal} deterministic checks passed with 100% fidelity!\n`);
  process.exit(0);
}
