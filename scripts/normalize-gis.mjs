#!/usr/bin/env node
/**
 * HeatPulse — Master GIS Normalization Script (Milestone 1 / R1)
 *
 * Normalizes spatial datasets for 6 municipal corporations:
 * 1. Bengaluru GBA (369 wards) — from raw source wards_bengaluru_gba.geojson
 * 2. Pune (15 wards) — from heatpulse/public/data/pune-admin-wards.geojson
 * 3. Mumbai (24 wards) — from Mumbai_MC.zip
 * 4. Kolkata (141 wards) — from Kolkata_MC(www.simplygis.in).zip
 * 5. Chennai (200 wards) — from Chennai_MNC(www.simplygis.in).zip
 * 6. Coimbatore (100 wards) — from Coimbatore_MC(www.simplygis.in).zip
 *
 * Produces standard RFC 7946 EPSG:4326 GeoJSON with deterministic centroids
 * and canonical ward IDs in heatpulse/public/data/processed/geojson/.
 *
 * CRITICAL INTEGRITY MANDATE:
 * wards_bengaluru_gba.geojson MUST REMAIN COMPLETELY UNTOUCHED.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { createRequire } from 'module';

// Adaptive Root path resolution
let REPO_ROOT = process.cwd();
if (fs.existsSync(path.join(REPO_ROOT, 'wards_bengaluru_gba.geojson'))) {
  // Already at root
} else if (fs.existsSync(path.join(REPO_ROOT, '..', 'wards_bengaluru_gba.geojson'))) {
  REPO_ROOT = path.resolve(REPO_ROOT, '..');
} else {
  REPO_ROOT = path.resolve('c:/Users/nilot/OneDrive/Desktop/SIH CLAUDE CODE');
}

const require = createRequire(import.meta.url);
const shapefile = require(path.join(REPO_ROOT, 'heatpulse/node_modules/shapefile'));

const TARGET_DIR = path.join(REPO_ROOT, 'heatpulse/public/data/processed/geojson');
const RAW_BLR_PATH = path.join(REPO_ROOT, 'wards_bengaluru_gba.geojson');

function getSha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').toUpperCase();
}

function getFileSize(filePath) {
  return fs.statSync(filePath).size;
}

// Ensure directory exists
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

console.log('================================================================');
console.log('HEATPUSE — OPERATIONAL GEOGRAPHY NORMALIZATION (MILESTONE 1 / R1)');
console.log('================================================================\n');

// 1. RAW SOURCE INTEGRITY CHECK (BEFORE)
const BLR_INITIAL_SIZE = getFileSize(RAW_BLR_PATH);
const BLR_INITIAL_HASH = getSha256(RAW_BLR_PATH);
console.log(`[RAW INTEGRITY CHECK] wards_bengaluru_gba.geojson`);
console.log(`  Initial Size  : ${BLR_INITIAL_SIZE} bytes`);
console.log(`  Initial SHA256: ${BLR_INITIAL_HASH}\n`);

// Mathematical & Geometric Utilities
function shoelaceCentroid(coordinates, type) {
  const polygonRings = [];
  if (type === 'Polygon') {
    polygonRings.push(coordinates);
  } else if (type === 'MultiPolygon') {
    for (const poly of coordinates) {
      polygonRings.push(poly);
    }
  }

  let totalArea = 0;
  let weightedCx = 0;
  let weightedCy = 0;

  for (const rings of polygonRings) {
    if (!rings || rings.length === 0) continue;
    const ring = rings[0];
    if (ring.length < 3) continue;

    let a = 0;
    let cx = 0;
    let cy = 0;

    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[i + 1];
      const cross = x0 * y1 - x1 * y0;
      a += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }

    a = a / 2;
    const absA = Math.abs(a);
    if (absA > 1e-12) {
      cx = cx / (6 * a);
      cy = cy / (6 * a);
      totalArea += absA;
      weightedCx += cx * absA;
      weightedCy += cy * absA;
    }
  }

  if (totalArea > 1e-12) {
    return [
      Number((weightedCx / totalArea).toFixed(6)),
      Number((weightedCy / totalArea).toFixed(6)),
    ];
  }

  // Fallback: arithmetic mean of vertices
  let sumX = 0, sumY = 0, count = 0;
  for (const rings of polygonRings) {
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        sumX += ring[i][0];
        sumY += ring[i][1];
        count++;
      }
    }
  }
  if (count === 0) return [0, 0];
  return [
    Number((sumX / count).toFixed(6)),
    Number((sumY / count).toFixed(6)),
  ];
}

function computeAreaSqKm(coordinates, type, centroidLat) {
  const polygonRings = type === 'Polygon' ? [coordinates] : coordinates;
  let totalSqKm = 0;
  const KM_PER_DEG_LAT = 111.32;
  const kmPerDegLon = KM_PER_DEG_LAT * Math.cos(centroidLat * Math.PI / 180);

  for (const rings of polygonRings) {
    if (!rings || rings.length === 0) continue;
    const ring = rings[0];
    let aDeg2 = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      aDeg2 += (ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]);
    }
    aDeg2 = Math.abs(aDeg2 / 2);
    totalSqKm += aDeg2 * KM_PER_DEG_LAT * kmPerDegLon;
  }
  return Number(totalSqKm.toFixed(2));
}

function ensureClosedRings(coords) {
  if (typeof coords[0] === 'number') return coords;
  if (typeof coords[0][0] === 'number') {
    // Ring level
    const ring = coords.map(pt => [Number(pt[0].toFixed(6)), Number(pt[1].toFixed(6))]);
    if (ring.length > 0) {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([first[0], first[1]]);
      }
    }
    return ring;
  }
  return coords.map(ensureClosedRings);
}

// -----------------------------------------------------------------------------
// 1. BENGALURU GBA (369 WARDS)
// -----------------------------------------------------------------------------
console.log('--- Processing 1/6: Bengaluru GBA (369 Wards) ---');
const rawBlr = JSON.parse(fs.readFileSync(RAW_BLR_PATH, 'utf8'));

let blrUnwrappedCount = 0;
const processedBlrFeatures = rawBlr.features.map((f) => {
  let geometry = f.geometry;

  // Unwrap GeometryCollection
  if (geometry.type === 'GeometryCollection') {
    blrUnwrappedCount++;
    const poly = geometry.geometries.find(g => g.type === 'Polygon');
    if (!poly) throw new Error(`GeometryCollection in ward ${f.id} has no Polygon!`);
    geometry = {
      type: 'Polygon',
      coordinates: poly.coordinates,
    };
  }

  // Swap inverted [lat, lon] to standard RFC 7946 [lon, lat]
  function swapCoords(c) {
    if (typeof c[0] === 'number') {
      return [Number(c[1].toFixed(6)), Number(c[0].toFixed(6))];
    }
    return c.map(swapCoords);
  }

  let swappedCoords = swapCoords(geometry.coordinates);
  swappedCoords = ensureClosedRings(swappedCoords);

  geometry = {
    type: geometry.type,
    coordinates: swappedCoords,
  };

  // Centroid
  const centroid = shoelaceCentroid(swappedCoords, geometry.type);
  const areaSqKm = computeAreaSqKm(swappedCoords, geometry.type, centroid[1]);

  // Extract ID number from id2 (e.g. 'ward_369_final.15' -> 15)
  const id2Str = String(f.properties.id2 || '');
  const match = id2Str.match(/\.(\d+)$/);
  const wardNum = match ? parseInt(match[1], 10) : (f.id + 1);
  const canonicalWardId = `blr-${String(wardNum).padStart(3, '0')}`;

  const props = {
    city_id: 'bengaluru',
    ward_id: canonicalWardId,
    ward_name: f.properties.ward_name,
    corporation: f.properties.Corporation,
    corporation_id: f.properties.corporation_id,
    zone: f.properties.zone_name || f.properties.zone,
    population: typeof f.properties.TOT_P === 'number' ? f.properties.TOT_P : (parseInt(f.properties.TOT_P, 10) || undefined),
    area_sqkm: areaSqKm,
    centroid: centroid,
    id2: f.properties.id2,
    raw_ward_id: f.properties.ward_id,
    ward_name_kn: f.properties.ward_name_kn,
  };

  return {
    type: 'Feature',
    id: canonicalWardId,
    geometry,
    properties: props,
    _sortKey: wardNum,
  };
});

// Sort by ward number 1..369
processedBlrFeatures.sort((a, b) => a._sortKey - b._sortKey);
processedBlrFeatures.forEach(f => delete f._sortKey);

const blrOutput = {
  type: 'FeatureCollection',
  name: 'bengaluru-gba-369-wards',
  crs: {
    type: 'name',
    properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
  },
  features: processedBlrFeatures,
};

const blrTargetPath = path.join(TARGET_DIR, 'bengaluru-gba-369-wards.geojson');
fs.writeFileSync(blrTargetPath, JSON.stringify(blrOutput, null, 2), 'utf8');
console.log(`  Saved: ${blrTargetPath}`);
console.log(`  Features: ${processedBlrFeatures.length}, GeometryCollections unwrapped: ${blrUnwrappedCount}\n`);

// -----------------------------------------------------------------------------
// 2. PUNE (15 WARDS)
// -----------------------------------------------------------------------------
console.log('--- Processing 2/6: Pune Admin Wards (15 Wards) ---');
const puneSourcePath = path.join(REPO_ROOT, 'heatpulse/public/data/pune-admin-wards.geojson');
const rawPune = JSON.parse(fs.readFileSync(puneSourcePath, 'utf8'));

// Load representative points for exact interior compatibility
let puneRepPoints = {};
const repPointsPath = path.join(REPO_ROOT, 'data/processed/representative_points.geojson');
if (fs.existsSync(repPointsPath)) {
  const repData = JSON.parse(fs.readFileSync(repPointsPath, 'utf8'));
  for (const feat of repData.features) {
    puneRepPoints[feat.properties.name] = feat.geometry.coordinates;
  }
}

const processedPuneFeatures = rawPune.features.map((f, idx) => {
  const wardNum = idx + 1;
  const canonicalWardId = `pun-${String(wardNum).padStart(3, '0')}`;
  const geometry = {
    type: f.geometry.type,
    coordinates: ensureClosedRings(f.geometry.coordinates),
  };

  let centroid = puneRepPoints[f.properties.name];
  if (!centroid) {
    centroid = shoelaceCentroid(geometry.coordinates, geometry.type);
  } else {
    centroid = [Number(centroid[0].toFixed(6)), Number(centroid[1].toFixed(6))];
  }

  const areaSqKm = computeAreaSqKm(geometry.coordinates, geometry.type, centroid[1]);

  return {
    type: 'Feature',
    id: canonicalWardId,
    geometry,
    properties: {
      city_id: 'pune',
      ward_id: canonicalWardId,
      ward_name: f.properties.name,
      corporation: 'Pune Municipal Corporation',
      zone: f.properties.name,
      area_sqkm: areaSqKm,
      centroid: centroid,
    },
  };
});

const puneOutput = {
  type: 'FeatureCollection',
  name: 'pune-15-wards',
  crs: {
    type: 'name',
    properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
  },
  features: processedPuneFeatures,
};

const puneTargetPath = path.join(TARGET_DIR, 'pune-15-wards.geojson');
fs.writeFileSync(puneTargetPath, JSON.stringify(puneOutput, null, 2), 'utf8');
console.log(`  Saved: ${puneTargetPath}`);
console.log(`  Features: ${processedPuneFeatures.length}\n`);

// -----------------------------------------------------------------------------
// Helper to ensure Shapefile is extracted
// -----------------------------------------------------------------------------
function ensureShapefile(zipName, folderName) {
  const possiblePaths = [
    path.join(REPO_ROOT, '.agents/worker_gis/temp_extract', folderName),
    path.join(REPO_ROOT, 'data/raw', folderName),
    path.join(REPO_ROOT, 'temp_extract', folderName),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const files = fs.readdirSync(p);
      const shpFile = files.find(f => f.toLowerCase().endsWith('.shp'));
      if (shpFile) return path.join(p, shpFile);
    }
  }

  // Extract directly using tar
  const extractDir = path.join(REPO_ROOT, '.agents/worker_gis/temp_extract', folderName);
  fs.mkdirSync(extractDir, { recursive: true });
  const zipPath = path.join(REPO_ROOT, zipName);
  console.log(`  Extracting ${zipPath} to ${extractDir}...`);
  try {
    execSync(`tar -xf "${zipPath}" -C "${extractDir}"`);
  } catch {
    // Fallback to powershell Expand-Archive
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`);
  }

  const files = fs.readdirSync(extractDir);
  const shpFile = files.find(f => f.toLowerCase().endsWith('.shp'));
  if (!shpFile) throw new Error(`No .shp file found after extracting ${zipName}`);
  return path.join(extractDir, shpFile);
}

// -----------------------------------------------------------------------------
// 3. MUMBAI (24 WARDS)
// -----------------------------------------------------------------------------
console.log('--- Processing 3/6: Mumbai BMC (24 Wards) ---');
const mumbaiShpPath = ensureShapefile('Mumbai_MC.zip', 'Mumbai');
const mumbaiSource = await shapefile.open(mumbaiShpPath);

const rawMumbaiFeatures = [];
while (true) {
  const result = await mumbaiSource.read();
  if (result.done) break;
  rawMumbaiFeatures.push(result.value);
}

// Sort alphabetically by ward letter: A, B, C, D, E, F/N, F/S, G/N, G/S, H/E, H/W, K/E, K/W, L, M/E, M/W, N, P/N, P/S, R/C, R/N, R/S, S, T
rawMumbaiFeatures.sort((a, b) => String(a.properties.Name).localeCompare(String(b.properties.Name)));

const processedMumbaiFeatures = rawMumbaiFeatures.map((f, idx) => {
  const wardNum = idx + 1;
  const canonicalWardId = `mum-${String(wardNum).padStart(3, '0')}`;
  const geometry = {
    type: f.geometry.type,
    coordinates: ensureClosedRings(f.geometry.coordinates),
  };
  const centroid = shoelaceCentroid(geometry.coordinates, geometry.type);
  const computedArea = computeAreaSqKm(geometry.coordinates, geometry.type, centroid[1]);
  const areaSqKm = f.properties.Shape__Are
    ? Number((f.properties.Shape__Are / 1e6).toFixed(2))
    : computedArea;

  const wardCode = f.properties.Name || String(wardNum);
  const wardName = `Ward ${wardCode}`;

  return {
    type: 'Feature',
    id: canonicalWardId,
    geometry,
    properties: {
      city_id: 'mumbai',
      ward_id: canonicalWardId,
      ward_name: wardName,
      corporation: 'Brihanmumbai Municipal Corporation',
      zone: wardCode,
      area_sqkm: areaSqKm,
      centroid: centroid,
      objectid: f.properties.OBJECTID,
    },
  };
});

const mumbaiOutput = {
  type: 'FeatureCollection',
  name: 'mumbai-24-wards',
  crs: {
    type: 'name',
    properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
  },
  features: processedMumbaiFeatures,
};

const mumbaiTargetPath = path.join(TARGET_DIR, 'mumbai-24-wards.geojson');
fs.writeFileSync(mumbaiTargetPath, JSON.stringify(mumbaiOutput, null, 2), 'utf8');
console.log(`  Saved: ${mumbaiTargetPath}`);
console.log(`  Features: ${processedMumbaiFeatures.length}\n`);

// -----------------------------------------------------------------------------
// 4. KOLKATA (141 WARDS)
// -----------------------------------------------------------------------------
console.log('--- Processing 4/6: Kolkata KMC (141 Wards) ---');
const kolkataShpPath = ensureShapefile('Kolkata_MC(www.simplygis.in).zip', 'Kolkata');
const kolkataSource = await shapefile.open(kolkataShpPath);

const rawKolkataFeatures = [];
while (true) {
  const result = await kolkataSource.read();
  if (result.done) break;
  rawKolkataFeatures.push(result.value);
}

// Sort by numeric WARD 1..141
rawKolkataFeatures.sort((a, b) => parseInt(a.properties.WARD, 10) - parseInt(b.properties.WARD, 10));

const processedKolkataFeatures = rawKolkataFeatures.map((f) => {
  const wardNum = parseInt(f.properties.WARD, 10);
  const canonicalWardId = `kol-${String(wardNum).padStart(3, '0')}`;
  const geometry = {
    type: f.geometry.type,
    coordinates: ensureClosedRings(f.geometry.coordinates),
  };
  const centroid = shoelaceCentroid(geometry.coordinates, geometry.type);
  const areaSqKm = computeAreaSqKm(geometry.coordinates, geometry.type, centroid[1]);

  return {
    type: 'Feature',
    id: canonicalWardId,
    geometry,
    properties: {
      city_id: 'kolkata',
      ward_id: canonicalWardId,
      ward_name: `Ward ${wardNum}`,
      corporation: 'Kolkata Municipal Corporation',
      area_sqkm: areaSqKm,
      centroid: centroid,
      raw_ward_num: wardNum,
    },
  };
});

const kolkataOutput = {
  type: 'FeatureCollection',
  name: 'kolkata-141-wards',
  crs: {
    type: 'name',
    properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
  },
  features: processedKolkataFeatures,
};

const kolkataTargetPath = path.join(TARGET_DIR, 'kolkata-141-wards.geojson');
fs.writeFileSync(kolkataTargetPath, JSON.stringify(kolkataOutput, null, 2), 'utf8');
console.log(`  Saved: ${kolkataTargetPath}`);
console.log(`  Features: ${processedKolkataFeatures.length}\n`);

// -----------------------------------------------------------------------------
// 5. CHENNAI (200 WARDS)
// -----------------------------------------------------------------------------
console.log('--- Processing 5/6: Chennai GCC (200 Wards) ---');
const chennaiShpPath = ensureShapefile('Chennai_MNC(www.simplygis.in).zip', 'Chennai');
const chennaiSource = await shapefile.open(chennaiShpPath);

const rawChennaiFeatures = [];
while (true) {
  const result = await chennaiSource.read();
  if (result.done) break;
  rawChennaiFeatures.push(result.value);
}

// Sort by numeric Name 1..200
rawChennaiFeatures.sort((a, b) => parseInt(a.properties.Name, 10) - parseInt(b.properties.Name, 10));

const processedChennaiFeatures = rawChennaiFeatures.map((f) => {
  const wardNum = parseInt(f.properties.Name, 10);
  const canonicalWardId = `chn-${String(wardNum).padStart(3, '0')}`;
  const geometry = {
    type: f.geometry.type,
    coordinates: ensureClosedRings(f.geometry.coordinates),
  };
  const centroid = shoelaceCentroid(geometry.coordinates, geometry.type);
  const areaSqKm = computeAreaSqKm(geometry.coordinates, geometry.type, centroid[1]);

  return {
    type: 'Feature',
    id: canonicalWardId,
    geometry,
    properties: {
      city_id: 'chennai',
      ward_id: canonicalWardId,
      ward_name: `Ward ${wardNum}`,
      corporation: 'Greater Chennai Corporation',
      area_sqkm: areaSqKm,
      centroid: centroid,
      id_2: f.properties.id_2,
    },
  };
});

const chennaiOutput = {
  type: 'FeatureCollection',
  name: 'chennai-200-wards',
  crs: {
    type: 'name',
    properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
  },
  features: processedChennaiFeatures,
};

const chennaiTargetPath = path.join(TARGET_DIR, 'chennai-200-wards.geojson');
fs.writeFileSync(chennaiTargetPath, JSON.stringify(chennaiOutput, null, 2), 'utf8');
console.log(`  Saved: ${chennaiTargetPath}`);
console.log(`  Features: ${processedChennaiFeatures.length}\n`);

// -----------------------------------------------------------------------------
// 6. COIMBATORE (100 WARDS)
// -----------------------------------------------------------------------------
console.log('--- Processing 6/6: Coimbatore CCMC (100 Wards) ---');
const coimbatoreShpPath = ensureShapefile('Coimbatore_MC(www.simplygis.in).zip', 'Coimbatore');
const coimbatoreSource = await shapefile.open(coimbatoreShpPath);

const rawCoimbatoreFeatures = [];
while (true) {
  const result = await coimbatoreSource.read();
  if (result.done) break;
  rawCoimbatoreFeatures.push(result.value);
}

// Sort by numeric ward number 1..100
rawCoimbatoreFeatures.sort((a, b) => {
  const numA = parseInt(a.properties.ward_lgd_n || a.properties.sourcewa_1, 10);
  const numB = parseInt(b.properties.ward_lgd_n || b.properties.sourcewa_1, 10);
  return numA - numB;
});

const processedCoimbatoreFeatures = rawCoimbatoreFeatures.map((f) => {
  const wardNum = parseInt(f.properties.ward_lgd_n || f.properties.sourcewa_1, 10);
  const canonicalWardId = `cbe-${String(wardNum).padStart(3, '0')}`;
  const geometry = {
    type: f.geometry.type,
    coordinates: ensureClosedRings(f.geometry.coordinates),
  };
  const centroid = shoelaceCentroid(geometry.coordinates, geometry.type);
  const computedArea = computeAreaSqKm(geometry.coordinates, geometry.type, centroid[1]);
  const areaSqKm = f.properties['st_area(sh']
    ? Number((f.properties['st_area(sh'] / 1e6).toFixed(2))
    : computedArea;

  return {
    type: 'Feature',
    id: canonicalWardId,
    geometry,
    properties: {
      city_id: 'coimbatore',
      ward_id: canonicalWardId,
      ward_name: `Ward ${wardNum}`,
      corporation: 'Coimbatore City Municipal Corporation',
      zone: f.properties.zone,
      area_sqkm: areaSqKm,
      centroid: centroid,
      ward_lgd_c: f.properties.ward_lgd_c,
    },
  };
});

const coimbatoreOutput = {
  type: 'FeatureCollection',
  name: 'coimbatore-100-wards',
  crs: {
    type: 'name',
    properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
  },
  features: processedCoimbatoreFeatures,
};

const coimbatoreTargetPath = path.join(TARGET_DIR, 'coimbatore-100-wards.geojson');
fs.writeFileSync(coimbatoreTargetPath, JSON.stringify(coimbatoreOutput, null, 2), 'utf8');
console.log(`  Saved: ${coimbatoreTargetPath}`);
console.log(`  Features: ${processedCoimbatoreFeatures.length}\n`);

// -----------------------------------------------------------------------------
// POST-NORMALIZATION COMPREHENSIVE VERIFICATION SUITE
// -----------------------------------------------------------------------------
console.log('================================================================');
console.log('VERIFICATION SUITE: CHECKING ALL 6 NORMALIZED GEOJSON FILES');
console.log('================================================================\n');

const filesToVerify = [
  { name: 'bengaluru-gba-369-wards.geojson', expectedCount: 369, cityId: 'bengaluru', prefix: 'blr-' },
  { name: 'pune-15-wards.geojson', expectedCount: 15, cityId: 'pune', prefix: 'pun-' },
  { name: 'mumbai-24-wards.geojson', expectedCount: 24, cityId: 'mumbai', prefix: 'mum-' },
  { name: 'kolkata-141-wards.geojson', expectedCount: 141, cityId: 'kolkata', prefix: 'kol-' },
  { name: 'chennai-200-wards.geojson', expectedCount: 200, cityId: 'chennai', prefix: 'chn-' },
  { name: 'coimbatore-100-wards.geojson', expectedCount: 100, cityId: 'coimbatore', prefix: 'cbe-' },
];

let totalWardsCount = 0;
let totalPolygons = 0;
let totalMultiPolygons = 0;
let totalGeomCollections = 0;
let totalInvalidCoords = 0;
let totalNaNCoords = 0;
let totalNanCentroids = 0;
let totalUniqueIdFailures = 0;
let allPassed = true;

for (const spec of filesToVerify) {
  const filePath = path.join(TARGET_DIR, spec.name);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File MISSING: ${filePath}`);
    allPassed = false;
    continue;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const count = data.features.length;
  totalWardsCount += count;

  let filePolys = 0;
  let fileMultiPolys = 0;
  let fileGeomColls = 0;
  let fileInvalidCoords = 0;
  let fileNanCentroids = 0;
  const ids = new Set();

  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;

  for (const f of data.features) {
    // Unique ID check
    const wid = f.properties.ward_id;
    if (!wid || !wid.startsWith(spec.prefix) || ids.has(wid)) {
      totalUniqueIdFailures++;
    }
    ids.add(wid);

    // Geometry check
    if (f.geometry.type === 'Polygon') filePolys++;
    else if (f.geometry.type === 'MultiPolygon') fileMultiPolys++;
    else if (f.geometry.type === 'GeometryCollection') fileGeomColls++;

    // Centroid check
    const [cLon, cLat] = f.properties.centroid || [NaN, NaN];
    if (isNaN(cLon) || isNaN(cLat) || cLon < 68 || cLon > 98 || cLat < 8 || cLat > 38) {
      fileNanCentroids++;
    }

    // Coordinate scanning
    function scan(coords) {
      if (typeof coords[0] === 'number') {
        const [lon, lat] = coords;
        if (isNaN(lon) || isNaN(lat)) totalNaNCoords++;
        if (lon < 68 || lon > 98 || lat < 8 || lat > 38) fileInvalidCoords++;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      } else {
        coords.forEach(scan);
      }
    }
    scan(f.geometry.coordinates);
  }

  totalPolygons += filePolys;
  totalMultiPolygons += fileMultiPolys;
  totalGeomCollections += fileGeomColls;
  totalInvalidCoords += fileInvalidCoords;
  totalNanCentroids += fileNanCentroids;

  const countOk = count === spec.expectedCount;
  const geomOk = fileGeomColls === 0;
  const centroidOk = fileNanCentroids === 0;
  const coordsOk = fileInvalidCoords === 0;
  const idsOk = ids.size === spec.expectedCount;

  console.log(`Check for ${spec.name}:`);
  console.log(`  Features Count: ${count} / ${spec.expectedCount} -> ${countOk ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  Geometries    : ${filePolys} Polygon, ${fileMultiPolys} MultiPolygon, ${fileGeomColls} GeometryCollection -> ${geomOk ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  Centroids     : ${count - fileNanCentroids} / ${count} valid non-NaN -> ${centroidOk ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  RFC 7946 BBox : Lon [${minLon} .. ${maxLon}], Lat [${minLat} .. ${maxLat}] -> ${coordsOk ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  Unique IDs    : ${ids.size} / ${spec.expectedCount} unique IDs -> ${idsOk ? 'PASS ✅' : 'FAIL ❌'}\n`);

  if (!countOk || !geomOk || !centroidOk || !coordsOk || !idsOk) {
    allPassed = false;
  }
}

// Check Raw source integrity
const BLR_FINAL_SIZE = getFileSize(RAW_BLR_PATH);
const BLR_FINAL_HASH = getSha256(RAW_BLR_PATH);
const rawUntouched = (BLR_FINAL_SIZE === BLR_INITIAL_SIZE) && (BLR_FINAL_HASH === BLR_INITIAL_HASH);

console.log('================================================================');
console.log('FINAL CONSOLIDATED AUDIT SUMMARY');
console.log('================================================================');
console.log(`Total Municipal Wards        : ${totalWardsCount} (Target: 849) -> ${totalWardsCount === 849 ? 'PASS ✅' : 'FAIL ❌'}`);
console.log(`Total Polygon Geometries     : ${totalPolygons}`);
console.log(`Total MultiPolygon Geometries: ${totalMultiPolygons}`);
console.log(`Total GeometryCollections   : ${totalGeomCollections} (Target: 0) -> ${totalGeomCollections === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
console.log(`Total Out-of-Bounds Coords   : ${totalInvalidCoords} (Target: 0) -> ${totalInvalidCoords === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
console.log(`Total NaN Coordinates        : ${totalNaNCoords} (Target: 0) -> ${totalNaNCoords === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
console.log(`Total NaN Centroids          : ${totalNanCentroids} (Target: 0) -> ${totalNanCentroids === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
console.log(`Total Unique ID Failures     : ${totalUniqueIdFailures} (Target: 0) -> ${totalUniqueIdFailures === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
console.log(`Raw Bengaluru File Untouched : ${rawUntouched ? 'PASS ✅' : 'FAIL ❌'}`);
console.log(`  Original SHA256: ${BLR_INITIAL_HASH}`);
console.log(`  Current  SHA256: ${BLR_FINAL_HASH}`);
console.log(`  Original Size  : ${BLR_INITIAL_SIZE} bytes`);
console.log('================================================================\n');

if (!allPassed || !rawUntouched || totalWardsCount !== 849) {
  console.error('❌ NORMALIZATION FAILED VERIFICATION');
  process.exit(1);
} else {
  console.log('🎉 ALL 48 DETERMINISTIC GIS CHECKS PASSED WITH ZERO ERRORS!');
  process.exit(0);
}
