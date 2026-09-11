/**
 * HeatPulse — Empirical Boundary & Performance Test Harness for Milestone 1
 * Standard: SIH26083 Master Build Specification (MoES / NCMRWF)
 * 
 * Tests gis-utils.ts:
 *   1. loadCityGeoJson() across all 6 cities with latency and parsing benchmarks.
 *   2. getWardById() exhaustive verification (849/849) + edge cases (nonexistent, invalid, empty).
 *   3. getWardByName() exhaustive verification + case/whitespace edge cases.
 *   4. getWardCentroid() and calculateCentroid() mathematical precision, fallbacks & degenerate geometries.
 *   5. calculateBBox() and calculateAreaSqKm() boundary integrity and sanity.
 *   6. isValidRfc7946() boundary assertion oracle.
 *   7. Performance stress harness: 50,000 lookup operations, throughput, memory impact.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadCityGeoJson,
  getWardById,
  getWardByName,
  getWardCentroid,
  getAllWardCentroids,
  calculateCentroid,
  calculateBBox,
  calculateAreaSqKm,
  isValidRfc7946,
  getCityMetadata,
  getAllCities,
} from '../../heatpulse/src/lib/gis-utils';
import { CITIES, CityId, WardFeature, WardFeatureCollection } from '../../heatpulse/src/types/gis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const HEATPULSE_DIR = path.join(REPO_ROOT, 'heatpulse');

interface BenchmarkResult {
  cityId: string;
  cityName: string;
  wardCount: number;
  fileSizeBytes: number;
  coldLoadMs: number;
  warmLoadMs: number;
  parseThroughputWardsPerSec: number;
}

interface TestSummary {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  errors: string[];
}

const summary: TestSummary = {
  totalChecks: 0,
  passedChecks: 0,
  failedChecks: 0,
  errors: [],
};

function assert(condition: boolean, description: string, details?: string) {
  summary.totalChecks++;
  if (condition) {
    summary.passedChecks++;
    console.log(`  [PASS] #${String(summary.totalChecks).padStart(3, '0')}: ${description}`);
  } else {
    summary.failedChecks++;
    const errMsg = `FAIL #${summary.totalChecks}: ${description}${details ? ` -> ${details}` : ''}`;
    summary.errors.push(errMsg);
    console.error(`  [FAIL] #${String(summary.totalChecks).padStart(3, '0')}: ${description}`);
    if (details) console.error(`         Details: ${details}`);
  }
}

async function runEmpiricalTests() {
  console.log('='.repeat(80));
  console.log('  HEATPULSE M1 EMPIRICAL BOUNDARY & PERFORMANCE CHALLENGE SUITE');
  console.log('  Testing: heatpulse/src/lib/gis-utils.ts & Operational GeoJSON Assets');
  console.log('='.repeat(80));

  const cityKeys = Object.keys(CITIES) as CityId[];
  const collections: Record<string, WardFeatureCollection> = {};
  const benchmarks: BenchmarkResult[] = [];

  // ---------------------------------------------------------------------------
  // SECTION 1: loadCityGeoJson() & Latency Benchmarks
  // ---------------------------------------------------------------------------
  console.log('\n--- [SECTION 1] loadCityGeoJson() Latency, Parsing Speed & Edge Cases ---');

  for (const cityId of cityKeys) {
    const meta = getCityMetadata(cityId);
    assert(meta !== undefined, `getCityMetadata('${cityId}') returns valid metadata`);

    // Cold load measurement
    const t0 = performance.now();
    const colCold = await loadCityGeoJson(cityId, path.join(HEATPULSE_DIR, 'public'));
    const t1 = performance.now();
    const coldMs = Number((t1 - t0).toFixed(2));

    // Warm load measurement (OS cache warm)
    const t2 = performance.now();
    const colWarm = await loadCityGeoJson(cityId, path.join(HEATPULSE_DIR, 'public'));
    const t3 = performance.now();
    const warmMs = Number((t3 - t2).toFixed(2));

    collections[cityId] = colWarm;

    const wardCount = colWarm.features.length;
    assert(
      wardCount === meta?.wardCount,
      `${meta?.name} feature count matches metadata (${wardCount} === ${meta?.wardCount})`
    );

    const jsonStr = JSON.stringify(colWarm);
    const fileSizeBytes = Buffer.byteLength(jsonStr, 'utf8');
    const throughput = warmMs > 0 ? Math.round((wardCount / warmMs) * 1000) : wardCount * 1000;

    benchmarks.push({
      cityId,
      cityName: meta?.name ?? cityId,
      wardCount,
      fileSizeBytes,
      coldLoadMs: coldMs,
      warmLoadMs: warmMs,
      parseThroughputWardsPerSec: throughput,
    });

    assert(
      coldMs < 500,
      `Cold load latency for ${meta?.name} (${(fileSizeBytes / 1024).toFixed(1)} KB) is within 500ms SLA (${coldMs}ms)`
    );
    assert(
      warmMs < 100,
      `Warm load latency for ${meta?.name} is sub-100ms (${warmMs}ms)`
    );
  }

  // Test loadCityGeoJson with case insensitivity
  try {
    const colUpper = await loadCityGeoJson('BENGALURU' as CityId, path.join(HEATPULSE_DIR, 'public'));
    assert(colUpper.features.length === 369, "loadCityGeoJson('BENGALURU') handles uppercase city ID");
  } catch (err: any) {
    assert(false, "loadCityGeoJson('BENGALURU') handles uppercase city ID", err.message);
  }

  // Test loadCityGeoJson with invalid city ID
  let thrownInvalidCity = false;
  try {
    await loadCityGeoJson('atlantis' as CityId, path.join(HEATPULSE_DIR, 'public'));
  } catch (err: any) {
    thrownInvalidCity = true;
    assert(
      err.message.includes('Unknown city ID: atlantis'),
      "loadCityGeoJson('atlantis') rejects with descriptive Unknown city ID error"
    );
  }
  assert(thrownInvalidCity, "loadCityGeoJson('atlantis') throws on invalid city ID");

  // Test loadCityGeoJson with missing file path
  let thrownMissingFile = false;
  try {
    await loadCityGeoJson('bengaluru', 'c:/nonexistent_dummy_folder/xyz');
  } catch (err: any) {
    thrownMissingFile = true;
    assert(
      err.message.includes('GeoJSON file not found at:'),
      'loadCityGeoJson rejects with descriptive GeoJSON file not found error'
    );
  }
  assert(thrownMissingFile, 'loadCityGeoJson throws when file path is nonexistent');

  // Empirical Challenge Test: loadCityGeoJson() with default parameter (no basePath argument)
  let defaultParamSucceeded = false;
  let defaultParamError = '';
  try {
    const colDefault = await loadCityGeoJson('bengaluru');
    defaultParamSucceeded = colDefault.features.length === 369;
  } catch (err: any) {
    defaultParamError = err.message;
  }
  assert(
    defaultParamSucceeded,
    "loadCityGeoJson('bengaluru') with default basePath='' loads successfully in Node.js",
    defaultParamError
  );

  // Print Latency Benchmark Table
  console.log('\n  LATENCY & PARSING BENCHMARK RESULTS:');
  console.log('  ' + '-'.repeat(76));
  console.log(
    '  ' +
      'City'.padEnd(14) +
      'Wards'.padStart(7) +
      'Size (KB)'.padStart(12) +
      'Cold (ms)'.padStart(12) +
      'Warm (ms)'.padStart(12) +
      'Speed (w/s)'.padStart(14)
  );
  console.log('  ' + '-'.repeat(76));
  for (const b of benchmarks) {
    console.log(
      '  ' +
        b.cityName.padEnd(14) +
        String(b.wardCount).padStart(7) +
        (b.fileSizeBytes / 1024).toFixed(1).padStart(12) +
        String(b.coldLoadMs).padStart(12) +
        String(b.warmLoadMs).padStart(12) +
        String(b.parseThroughputWardsPerSec).padStart(14)
    );
  }
  console.log('  ' + '-'.repeat(76));

  // ---------------------------------------------------------------------------
  // SECTION 2: Exhaustive & Adversarial getWardById() Testing
  // ---------------------------------------------------------------------------
  console.log('\n--- [SECTION 2] getWardById() Exhaustive & Adversarial Testing ---');

  let totalWardsChecked = 0;
  let allIdsFound = true;
  let caseInsensitiveFound = true;
  let whitespaceTrimFound = true;

  for (const cityId of cityKeys) {
    const col = collections[cityId];
    for (const feat of col.features) {
      totalWardsChecked++;
      const wardId = feat.properties.ward_id;

      // 1. Exact match
      const found = getWardById(col, wardId);
      if (!found || found.properties.ward_id !== wardId) {
        allIdsFound = false;
      }

      // 2. Case insensitive match (e.g. 'BLR-001')
      const foundUpper = getWardById(col, wardId.toUpperCase());
      if (!foundUpper || foundUpper.properties.ward_id !== wardId) {
        caseInsensitiveFound = false;
      }

      // 3. Whitespace padded match (e.g. '  blr-001  ')
      const foundPadded = getWardById(col, `  ${wardId}  `);
      if (!foundPadded || foundPadded.properties.ward_id !== wardId) {
        whitespaceTrimFound = false;
      }

      // 4. Feature.id match
      if (feat.id !== undefined) {
        const foundById = getWardById(col, String(feat.id));
        if (!foundById) {
          allIdsFound = false;
        }
      }
    }
  }

  assert(totalWardsChecked === 849, `Exhaustive verification covered all 849 wards (${totalWardsChecked}/849)`);
  assert(allIdsFound, 'getWardById() successfully resolves 100% of 849 canonical ward IDs');
  assert(caseInsensitiveFound, 'getWardById() is strictly case-insensitive across all 849 ward IDs');
  assert(whitespaceTrimFound, 'getWardById() correctly trims leading/trailing whitespace');

  // Edge cases: Nonexistent IDs return undefined gracefully WITHOUT throwing
  const nonexistentTestCases = [
    'blr-999',
    'blr-000',
    'blr-370',
    'pun-016',
    'mum-025',
    'kol-142',
    'chn-201',
    'cbe-101',
    'unknown-ward-id',
    '   ',
    '',
    'undefined',
    'null',
    '12345',
    '!@#$%^&*()',
  ];

  let allNonexistentReturnedUndefined = true;
  let nonexistentThrew = false;

  for (const invalidId of nonexistentTestCases) {
    try {
      const res = getWardById(collections.bengaluru, invalidId);
      if (res !== undefined) {
        allNonexistentReturnedUndefined = false;
        console.error(`Unexpected result for nonexistent ID '${invalidId}':`, res);
      }
    } catch (e) {
      nonexistentThrew = true;
      console.error(`Threw error on nonexistent ID '${invalidId}':`, e);
    }
  }

  assert(!nonexistentThrew, 'getWardById() NEVER throws on nonexistent or malformed IDs');
  assert(
    allNonexistentReturnedUndefined,
    'getWardById() returns undefined gracefully for all nonexistent test cases'
  );

  // ---------------------------------------------------------------------------
  // SECTION 3: Exhaustive & Adversarial getWardByName() Testing
  // ---------------------------------------------------------------------------
  console.log('\n--- [SECTION 3] getWardByName() Exhaustive & Adversarial Testing ---');

  let allNamesFound = true;
  let caseInsensitiveNamesFound = true;
  let paddedNamesFound = true;

  for (const cityId of cityKeys) {
    const col = collections[cityId];
    for (const feat of col.features) {
      const wardName = feat.properties.ward_name;
      if (!wardName) continue;

      const found = getWardByName(col, wardName);
      if (!found) {
        allNamesFound = false;
        console.error(`Failed to find ward by name: '${wardName}' in ${cityId}`);
      }

      // Case insensitivity
      const foundUpper = getWardByName(col, wardName.toUpperCase());
      if (!foundUpper) {
        caseInsensitiveNamesFound = false;
      }

      // Padded name
      const foundPadded = getWardByName(col, `  ${wardName}  `);
      if (!foundPadded) {
        paddedNamesFound = false;
      }
    }
  }

  assert(allNamesFound, 'getWardByName() resolves 100% of wards by exact name across all cities');
  assert(caseInsensitiveNamesFound, 'getWardByName() is case-insensitive across all ward names');
  assert(paddedNamesFound, 'getWardByName() trims leading/trailing whitespace');

  // Edge cases: Nonexistent ward names return undefined gracefully
  const invalidNames = [
    'Atlantis Central Ward',
    'Nonexistent Ward 99999',
    '',
    '    ',
    '###$$$%%%',
  ];

  let nameNonexistentThrew = false;
  let nameReturnedUndefined = true;

  for (const invalidName of invalidNames) {
    try {
      const res = getWardByName(collections.bengaluru, invalidName);
      if (res !== undefined) {
        nameReturnedUndefined = false;
      }
    } catch (e) {
      nameNonexistentThrew = true;
    }
  }

  assert(!nameNonexistentThrew, 'getWardByName() NEVER throws on nonexistent names');
  assert(nameReturnedUndefined, 'getWardByName() returns undefined gracefully for nonexistent names');

  // ---------------------------------------------------------------------------
  // SECTION 4: Centroid Mathematics, getWardCentroid() & Fallback Testing
  // ---------------------------------------------------------------------------
  console.log('\n--- [SECTION 4] Centroid Mathematics, getWardCentroid() & Fallbacks ---');

  let allCentroidsValid = true;
  let maxCentroidDiscrepancyKm = 0;

  for (const cityId of cityKeys) {
    const col = collections[cityId];
    const meta = getCityMetadata(cityId)!;

    for (const feat of col.features) {
      const centroid = getWardCentroid(feat);

      if (!isValidRfc7946(centroid)) {
        allCentroidsValid = false;
        console.error(`Invalid centroid for ${feat.properties.ward_id}:`, centroid);
      }

      // Check within city bbox
      const [lon, lat] = centroid;
      const [minLon, minLat, maxLon, maxLat] = meta.bbox;
      // Allow slight 0.05 deg margin for peripheral ward centroids
      if (
        lon < minLon - 0.05 ||
        lon > maxLon + 0.05 ||
        lat < minLat - 0.05 ||
        lat > maxLat + 0.05
      ) {
        allCentroidsValid = false;
        console.error(`Centroid outside city bbox for ${feat.properties.ward_id}: [${lon}, ${lat}]`);
      }

      // Compare properties.centroid with calculateCentroid(feat.geometry)
      if (feat.properties.centroid) {
        const computed = calculateCentroid(feat.geometry);
        const dLon = Math.abs(centroid[0] - computed[0]);
        const dLat = Math.abs(centroid[1] - computed[1]);
        const distKm = Math.sqrt(dLon * dLon + dLat * dLat) * 111.32;
        if (distKm > maxCentroidDiscrepancyKm) {
          maxCentroidDiscrepancyKm = distKm;
        }
      }
    }
  }

  assert(allCentroidsValid, 'All 849 ward centroids are RFC 7946 compliant and within city bounds');
  console.log(`  Max discrepancy between stored centroid and recomputed Shoelace centroid: ${maxCentroidDiscrepancyKm.toFixed(3)} km`);
  // For Pune, representative points were purposefully used for seed-wards compatibility, so discrepancy can be ~1-3km.
  // For Bengaluru, it should be 0.000 km.
  assert(maxCentroidDiscrepancyKm < 5.0, `Stored centroids match geometry center within tolerance (< 5km, actual: ${maxCentroidDiscrepancyKm.toFixed(3)} km)`);

  // Test getWardCentroid fallback when properties.centroid is absent or invalid
  const testFeatureWithoutCentroid: WardFeature = {
    type: 'Feature',
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
    properties: {
      city_id: 'bengaluru',
      ward_id: 'test-fallback',
      ward_name: 'Test Fallback Ward',
      centroid: [0, 0], // Invalid RFC 7946 for India
    },
  };

  const fallbackCentroid = getWardCentroid(testFeatureWithoutCentroid);
  assert(
    Math.abs(fallbackCentroid[0] - 77.55) < 0.001 && Math.abs(fallbackCentroid[1] - 12.95) < 0.001,
    `getWardCentroid() safely falls back to calculateCentroid() when properties.centroid is invalid [0,0] -> got [${fallbackCentroid}]`
  );

  // Test calculateCentroid on known geometric primitives
  // 1. Triangle: (0, 0), (6, 0), (0, 6) -> Centroid is (2, 2)
  const triangleGeom = {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [6, 0],
        [0, 6],
        [0, 0],
      ],
    ],
  };
  const triC = calculateCentroid(triangleGeom as any);
  assert(
    Math.abs(triC[0] - 2) < 0.001 && Math.abs(triC[1] - 2) < 0.001,
    `calculateCentroid() on triangle (0,0)-(6,0)-(0,6) yields analytical (2,2) -> got [${triC}]`
  );

  // 2. MultiPolygon: Two squares of equal area
  // Square 1: (0,0) to (2,2) -> Center (1,1), Area 4
  // Square 2: (4,0) to (6,2) -> Center (5,1), Area 4
  // Combined center should be (3, 1)
  const multiPolyGeom = {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ],
      ],
      [
        [
          [4, 0],
          [6, 0],
          [6, 2],
          [4, 2],
          [4, 0],
        ],
      ],
    ],
  };
  const multiC = calculateCentroid(multiPolyGeom as any);
  assert(
    Math.abs(multiC[0] - 3) < 0.001 && Math.abs(multiC[1] - 1) < 0.001,
    `calculateCentroid() area-weighted MultiPolygon yields exact center (3,1) -> got [${multiC}]`
  );

  // 3. Degenerate collinear ring (zero area planar polygon) -> fallback to vertex mean
  const degenerateGeom = {
    type: 'Polygon',
    coordinates: [
      [
        [10, 10],
        [20, 20],
        [30, 30],
        [10, 10],
      ],
    ],
  };
  const degenC = calculateCentroid(degenerateGeom as any);
  assert(
    Math.abs(degenC[0] - 20) < 0.001 && Math.abs(degenC[1] - 20) < 0.001,
    `calculateCentroid() degenerate collinear polygon falls back cleanly to vertex mean (20, 20) -> got [${degenC}]`
  );

  // 4. Invalid geometry input handling
  let threwOnInvalidGeom = false;
  try {
    calculateCentroid(null as any);
  } catch (e: any) {
    threwOnInvalidGeom = true;
    assert(e.message.includes('Invalid geometry'), 'calculateCentroid(null) throws descriptive error');
  }
  assert(threwOnInvalidGeom, 'calculateCentroid(null) throws instead of crashing unhandled');

  // 5. Unsupported geometry type handling
  let threwOnPoint = false;
  try {
    calculateCentroid({ type: 'Point', coordinates: [77, 12] } as any);
  } catch (e: any) {
    threwOnPoint = true;
    assert(e.message.includes('Unsupported geometry type'), 'calculateCentroid(Point) throws descriptive error');
  }
  assert(threwOnPoint, 'calculateCentroid(Point) throws on unsupported geometry');

  // Test getAllWardCentroids()
  for (const cityId of cityKeys) {
    const col = collections[cityId];
    const centroidMap = getAllWardCentroids(col);
    assert(
      centroidMap.size === col.features.length,
      `getAllWardCentroids('${cityId}') returns complete map of ${centroidMap.size} centroids`
    );
  }

  // ---------------------------------------------------------------------------
  // SECTION 5: calculateBBox() & calculateAreaSqKm()
  // ---------------------------------------------------------------------------
  console.log('\n--- [SECTION 5] calculateBBox() & calculateAreaSqKm() ---');

  for (const cityId of cityKeys) {
    const col = collections[cityId];
    const meta = getCityMetadata(cityId)!;
    const computedBBox = calculateBBox(col);

    assert(
      computedBBox[0] <= computedBBox[2] && computedBBox[1] <= computedBBox[3],
      `calculateBBox('${cityId}') produces valid min <= max extent: [${computedBBox.join(', ')}]`
    );

    // Verify computed bbox is within expected city domain
    assert(
      computedBBox[0] >= meta.bbox[0] - 0.1 &&
        computedBBox[2] <= meta.bbox[2] + 0.1 &&
        computedBBox[1] >= meta.bbox[1] - 0.1 &&
        computedBBox[3] <= meta.bbox[3] + 0.1,
      `calculateBBox('${cityId}') aligns with defined city bounding box`
    );

    // Area calculation check
    let cityTotalAreaSqKm = 0;
    for (const feat of col.features) {
      const area = calculateAreaSqKm(feat.geometry);
      assert(area > 0, `Ward ${feat.properties.ward_id} has positive surface area (${area} sq km)`);
      cityTotalAreaSqKm += area;
    }

    console.log(`    Total computed area for ${meta.name}: ${cityTotalAreaSqKm.toFixed(1)} sq km across ${col.features.length} wards`);
    assert(
      cityTotalAreaSqKm > 50 && cityTotalAreaSqKm < 2500,
      `Total surface area for ${meta.name} (${cityTotalAreaSqKm.toFixed(1)} sq km) is in realistic urban range`
    );
  }

  // ---------------------------------------------------------------------------
  // SECTION 6: isValidRfc7946() Boundary & Oracle Checks
  // ---------------------------------------------------------------------------
  console.log('\n--- [SECTION 6] isValidRfc7946() Boundary & Oracle Checks ---');

  assert(isValidRfc7946([77.5946, 12.9716]), 'Valid Bengaluru coordinate [77.5946, 12.9716] is true');
  assert(isValidRfc7946([73.8567, 18.5204]), 'Valid Pune coordinate is true');
  assert(isValidRfc7946([72.8777, 19.0760]), 'Valid Mumbai coordinate is true');
  assert(isValidRfc7946([88.3639, 22.5726]), 'Valid Kolkata coordinate is true');
  assert(isValidRfc7946([80.2707, 13.0827]), 'Valid Chennai coordinate is true');
  assert(isValidRfc7946([76.9558, 11.0168]), 'Valid Coimbatore coordinate is true');

  // Negative / Boundary conditions
  assert(!isValidRfc7946([12.9716, 77.5946]), 'Inverted [lat, lon] coordinate fails validation');
  assert(!isValidRfc7946([67.99, 20.0]), 'Lon 67.99 outside India west bound fails');
  assert(!isValidRfc7946([98.01, 20.0]), 'Lon 98.01 outside India east bound fails');
  assert(!isValidRfc7946([77.0, 7.99]), 'Lat 7.99 outside India south bound fails');
  assert(!isValidRfc7946([77.0, 38.01]), 'Lat 38.01 outside India north bound fails');
  assert(!isValidRfc7946([NaN, 12.0]), 'NaN coordinate fails');
  assert(!isValidRfc7946([77.0, NaN]), 'NaN coordinate fails');
  assert(!isValidRfc7946([] as any), 'Empty array fails');
  assert(!isValidRfc7946([77.0] as any), '1-element array fails');
  assert(!isValidRfc7946(null as any), 'null fails');
  assert(!isValidRfc7946('invalid' as any), 'string fails');

  // ---------------------------------------------------------------------------
  // SECTION 7: Performance Stress Harness & Throughput
  // ---------------------------------------------------------------------------
  console.log('\n--- [SECTION 7] High-Throughput Stress Harness & Memory Benchmark ---');

  const initialMemory = process.memoryUsage().heapUsed;
  const bcol = collections.bengaluru;

  // 1. 50,000 ward ID lookups
  const LOOKUP_ITERATIONS = 50000;
  const wardIds = bcol.features.map((f) => f.properties.ward_id);

  const tLookupStart = performance.now();
  let dummySum = 0;
  for (let i = 0; i < LOOKUP_ITERATIONS; i++) {
    const targetId = wardIds[i % wardIds.length];
    const found = getWardById(bcol, targetId);
    if (found) dummySum++;
  }
  const tLookupEnd = performance.now();
  const lookupElapsedMs = tLookupEnd - tLookupStart;
  const lookupsPerSec = Math.round((LOOKUP_ITERATIONS / lookupElapsedMs) * 1000);

  console.log(`    50,000 getWardById() lookups in ${lookupElapsedMs.toFixed(2)}ms`);
  console.log(`    Throughput: ${lookupsPerSec.toLocaleString()} ops/sec (Average: ${(lookupElapsedMs / LOOKUP_ITERATIONS * 1000).toFixed(2)} µs/op)`);

  assert(dummySum === LOOKUP_ITERATIONS, 'All 50,000 lookups resolved successfully');
  assert(
    lookupsPerSec > 5000,
    `Lookup throughput exceeds 5,000 ops/sec threshold (actual: ${lookupsPerSec.toLocaleString()} ops/sec)`
  );

  // 2. 10,000 ward Name lookups
  const NAME_ITERATIONS = 10000;
  const wardNames = bcol.features.map((f) => f.properties.ward_name);

  const tNameStart = performance.now();
  let dummyNameSum = 0;
  for (let i = 0; i < NAME_ITERATIONS; i++) {
    const targetName = wardNames[i % wardNames.length];
    const found = getWardByName(bcol, targetName);
    if (found) dummyNameSum++;
  }
  const tNameEnd = performance.now();
  const nameElapsedMs = tNameEnd - tNameStart;
  const namesPerSec = Math.round((NAME_ITERATIONS / nameElapsedMs) * 1000);

  console.log(`    10,000 getWardByName() lookups in ${nameElapsedMs.toFixed(2)}ms`);
  console.log(`    Throughput: ${namesPerSec.toLocaleString()} ops/sec`);

  assert(dummyNameSum === NAME_ITERATIONS, 'All 10,000 name lookups resolved successfully');

  // 3. Memory overhead measurement
  const finalMemory = process.memoryUsage().heapUsed;
  const memoryDeltaMb = Number(((finalMemory - initialMemory) / (1024 * 1024)).toFixed(2));
  console.log(`    Heap memory used delta after stress tests: ${memoryDeltaMb} MB`);

  assert(
    memoryDeltaMb < 150,
    `Memory footprint growth is well within acceptable budget (< 150MB, actual: ${memoryDeltaMb} MB)`
  );

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('  CHALLENGE SUITE SUMMARY RESULTS');
  console.log('='.repeat(80));
  console.log(`  Total Empirical Checks: ${summary.totalChecks}`);
  console.log(`  Passed:                 ${summary.passedChecks}`);
  console.log(`  Failed:                 ${summary.failedChecks}`);
  console.log(`  Success Rate:           ${((summary.passedChecks / summary.totalChecks) * 100).toFixed(1)}%`);
  console.log('='.repeat(80));

  if (summary.failedChecks > 0) {
    console.error('\nFAILURES ENCOUNTERED:');
    for (const err of summary.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  } else {
    console.log('\n>>> VERDICT: ALL EMPIRICAL CHALLENGER CHECKS PASSED WITH 100% FIDELITY <<<\n');
    process.exit(0);
  }
}

runEmpiricalTests().catch((err) => {
  console.error('Fatal unhandled rejection during empirical test run:', err);
  process.exit(1);
});
