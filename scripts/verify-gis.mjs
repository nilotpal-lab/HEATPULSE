#!/usr/bin/env node
/**
 * HeatPulse — Independent GIS Verification Script (Milestone 1 / R1)
 *
 * Verifies:
 * 1. Exactly 849 total municipal wards across 6 cities (369 + 15 + 24 + 141 + 200 + 100).
 * 2. RFC 7946 EPSG:4326 coordinate ordering [lon, lat] across all coordinates.
 * 3. 0 GeometryCollection instances remaining (100% Polygon / MultiPolygon).
 * 4. Deterministic non-NaN valid centroids for all 849 wards.
 * 5. Unique canonical IDs for all wards with city prefix.
 * 6. Closed rings for all polygon boundaries.
 * 7. Segregation of legacy BBMP 225 wards.
 * 8. Unaltered raw source wards_bengaluru_gba.geojson (SHA256 & byte size).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Adaptive root
let REPO_ROOT = process.cwd();
if (!fs.existsSync(path.join(REPO_ROOT, 'wards_bengaluru_gba.geojson'))) {
  if (fs.existsSync(path.join(REPO_ROOT, '..', 'wards_bengaluru_gba.geojson'))) {
    REPO_ROOT = path.resolve(REPO_ROOT, '..');
  } else {
    REPO_ROOT = path.resolve('c:/Users/nilot/OneDrive/Desktop/SIH CLAUDE CODE');
  }
}

const TARGET_DIR = path.join(REPO_ROOT, 'heatpulse/public/data/processed/geojson');
const RAW_BLR = path.join(REPO_ROOT, 'wards_bengaluru_gba.geojson');
const LEGACY_ZIP = path.join(REPO_ROOT, 'Bengaluru_MC(www.simplygis.in).zip');

console.log('================================================================');
console.log('HEATPUSE — DETERMINISTIC GIS VERIFICATION (MILESTONE 1 / R1)');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, description) {
  if (condition) {
    console.log(`  [PASS] ✅ ${description}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ❌ ${description}`);
    failCount++;
  }
}

// 1. Raw Source Integrity Check
console.log('--- 1. Raw Source File Integrity ---');
const EXPECTED_HASH = '6DFF0924E3D938BFC63FC1ED292429FF41B95ED18459A3AA494B88A6BE6691CE';
const EXPECTED_SIZE = 3052583;

const rawBuffer = fs.readFileSync(RAW_BLR);
const actualHash = crypto.createHash('sha256').update(rawBuffer).digest('hex').toUpperCase();
const actualSize = fs.statSync(RAW_BLR).size;

assert(actualHash === EXPECTED_HASH, `Raw source SHA256 is unaltered (${actualHash})`);
assert(actualSize === EXPECTED_SIZE, `Raw source size is unaltered (${actualSize} bytes)`);

// 2. Legacy BBMP Segregation
console.log('\n--- 2. Legacy BBMP 225-Ward Segregation ---');
assert(fs.existsSync(LEGACY_ZIP), 'Legacy Bengaluru_MC zip file exists at repo root');
const processedFiles = fs.readdirSync(TARGET_DIR);
assert(!processedFiles.includes('Bengaluru_MC.geojson'), 'No unsegregated legacy Bengaluru_MC.geojson in processed/');
assert(!processedFiles.includes('bbmp-225-wards.geojson'), 'No legacy 225 wards merged into processed/');

// 3. City-by-City Spatial Verification
console.log('\n--- 3. City-by-City Dataset Verification ---');

const CITIES = [
  { name: 'bengaluru-gba-369-wards.geojson', count: 369, cityId: 'bengaluru', prefix: 'blr-', lonRange: [77.4, 77.9], latRange: [12.8, 13.2] },
  { name: 'pune-15-wards.geojson', count: 15, cityId: 'pune', prefix: 'pun-', lonRange: [73.7, 74.1], latRange: [18.4, 18.7] },
  { name: 'mumbai-24-wards.geojson', count: 24, cityId: 'mumbai', prefix: 'mum-', lonRange: [72.7, 73.1], latRange: [18.8, 19.4] },
  { name: 'kolkata-141-wards.geojson', count: 141, cityId: 'kolkata', prefix: 'kol-', lonRange: [88.2, 88.6], latRange: [22.4, 22.7] },
  { name: 'chennai-200-wards.geojson', count: 200, cityId: 'chennai', prefix: 'chn-', lonRange: [80.1, 80.4], latRange: [12.8, 13.3] },
  { name: 'coimbatore-100-wards.geojson', count: 100, cityId: 'coimbatore', prefix: 'cbe-', lonRange: [76.8, 77.2], latRange: [10.9, 11.2] },
];

let grandTotalWards = 0;
let grandTotalPolygons = 0;
let grandTotalMultiPolygons = 0;
let grandTotalGeometryCollections = 0;

for (const city of CITIES) {
  console.log(`\n  Validating ${city.name} (${city.cityId}):`);
  const filePath = path.join(TARGET_DIR, city.name);
  assert(fs.existsSync(filePath), `File exists: ${city.name}`);
  if (!fs.existsSync(filePath)) continue;

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert(data.type === 'FeatureCollection', `Root is FeatureCollection`);
  assert(data.features.length === city.count, `Feature count is exactly ${city.count}`);
  grandTotalWards += data.features.length;

  let validGeom = true;
  let validCentroids = true;
  let validRfc7946 = true;
  let validRingsClosed = true;
  let uniqueIds = true;
  const seenIds = new Set();
  const seenNames = new Set();

  for (let i = 0; i < data.features.length; i++) {
    const f = data.features[i];

    // Feature type
    if (f.type !== 'Feature') validGeom = false;

    // Geometry type
    if (f.geometry.type === 'Polygon') grandTotalPolygons++;
    else if (f.geometry.type === 'MultiPolygon') grandTotalMultiPolygons++;
    else if (f.geometry.type === 'GeometryCollection') {
      grandTotalGeometryCollections++;
      validGeom = false;
    }

    // Properties check
    const p = f.properties;
    if (!p || p.city_id !== city.cityId) validGeom = false;
    if (!p.ward_id || !p.ward_id.startsWith(city.prefix)) uniqueIds = false;
    if (seenIds.has(p.ward_id)) uniqueIds = false;
    seenIds.add(p.ward_id);
    if (p.ward_name) seenNames.add(p.ward_name);

    // Centroid check
    const c = p.centroid;
    if (!Array.isArray(c) || c.length !== 2) validCentroids = false;
    else if (isNaN(c[0]) || isNaN(c[1])) validCentroids = false;
    else if (c[0] < city.lonRange[0] || c[0] > city.lonRange[1] || c[1] < city.latRange[0] || c[1] > city.latRange[1]) {
      validCentroids = false;
    }

    // Coordinate scanning & ring closed check
    function scanCoords(geomType, coords) {
      const rings = geomType === 'Polygon' ? coords : coords.flat(1);
      for (const ring of rings) {
        if (!Array.isArray(ring) || ring.length < 4) validRingsClosed = false;
        else {
          const first = ring[0];
          const last = ring[ring.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) validRingsClosed = false;
        }
        for (const pt of ring) {
          if (typeof pt[0] !== 'number' || typeof pt[1] !== 'number') validRfc7946 = false;
          else if (isNaN(pt[0]) || isNaN(pt[1])) validRfc7946 = false;
          // RFC 7946 India check: Lon between 68 and 98, Lat between 8 and 38
          else if (pt[0] < 68 || pt[0] > 98 || pt[1] < 8 || pt[1] > 38) validRfc7946 = false;
        }
      }
    }

    if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
      scanCoords(f.geometry.type, f.geometry.coordinates);
    }
  }

  assert(validGeom, `All features have valid Polygon/MultiPolygon geometry and properties`);
  assert(uniqueIds, `All ${city.count} wards have unique IDs with prefix '${city.prefix}'`);
  assert(validCentroids, `All ${city.count} centroids are non-NaN and within city bounds [${city.lonRange}, ${city.latRange}]`);
  assert(validRfc7946, `All coordinates follow RFC 7946 [lon, lat] within Indian domain (lon 68..98, lat 8..38)`);
  assert(validRingsClosed, `All polygon rings are closed (first == last coordinate)`);
  assert(seenNames.size > 0, `Recorded ${seenNames.size} distinct ward names for ${city.cityId}`);
}

// 4. Grand Totals Verification
console.log('\n--- 4. Grand Totals Across All Cities ---');
assert(grandTotalWards === 849, `Total municipal wards across all 6 cities: ${grandTotalWards} == 849`);
assert(grandTotalGeometryCollections === 0, `Total GeometryCollections remaining: ${grandTotalGeometryCollections} == 0`);
assert(grandTotalPolygons + grandTotalMultiPolygons === 849, `Total clean polygons: ${grandTotalPolygons + grandTotalMultiPolygons} == 849 (${grandTotalPolygons} Polygon + ${grandTotalMultiPolygons} MultiPolygon)`);

// Summary
console.log('\n================================================================');
console.log(`VERIFICATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================\n');

if (failCount > 0) {
  console.error('❌ VERIFICATION FAILED');
  process.exit(1);
} else {
  console.log('🎉 100% SUCCESS: ALL OPERATIONAL GEOGRAPHY CHECKS PASSED!');
  process.exit(0);
}
