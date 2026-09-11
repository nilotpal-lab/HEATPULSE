#!/usr/bin/env node
/**
 * HeatPulse — Independent GIS Verification Script
 * Conforms to SIH26083 Master Build Specification (MoES / NCMRWF)
 *
 * Executes the authoritative Tier 1 GIS validation suite covering all 62 checks:
 * - Checks 01 to 12: Bengaluru GBA (369 wards)
 * - Checks 13 to 18: Pune (15 admin wards)
 * - Checks 19 to 24: Mumbai (24 wards)
 * - Checks 25 to 30: Kolkata (141 wards)
 * - Checks 31 to 36: Chennai (200 wards)
 * - Checks 37 to 42: Coimbatore (100 wards)
 * - Checks 43 to 48: Multi-City Aggregate System (849 municipal wards)
 * - Checks 49 to 62: National India Boundaries & SimplyGIS Integrity
 */

import { runGisValidationTests } from '../tests/gis/gis-validation.test.mjs';

const { passed, failed, total } = runGisValidationTests();

if (failed > 0) {
  console.error(`\n❌ VERIFICATION FAILED: ${failed}/${total} checks failed.`);
  process.exit(1);
} else {
  console.log(`\n🎉 100% SUCCESS: ALL ${passed}/${total} GIS VERIFICATION CHECKS PASSED!`);
  process.exit(0);
}
