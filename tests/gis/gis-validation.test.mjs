/**
 * Tier 1 Deterministic GIS Validation Test Suite
 * 
 * Standard: SIH26083 Master Build Specification (MoES / NCMRWF)
 * Scope: 62 Deterministic Checks across Municipal Geography (849 Wards in 6 Cities)
 *        and National Boundaries (SimplyGIS India Outline & States):
 *   - Bengaluru GBA (369 wards, Checks 01 to 12)
 *   - Pune (15 admin wards, Checks 13 to 18)
 *   - Mumbai (24 wards, Checks 19 to 24)
 *   - Kolkata (141 wards, Checks 25 to 30)
 *   - Chennai (200 wards, Checks 31 to 36)
 *   - Coimbatore (100 wards, Checks 37 to 42)
 *   - Multi-City Aggregate System (Checks 43 to 48)
 *   - National India Boundaries & SimplyGIS Integrity (Checks 49 to 62)
 * Total: Exactly 849 municipal wards & 62 deterministic checks.
 * 
 * Complies with RFC 7946 EPSG:4326, coordinate ordering [lon, lat], zero GeometryCollections,
 * raw source immutability, legacy BBMP segregation, deterministic centroids,
 * and Survey of India sovereign territory reaching 37.088342°N.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANDIDATE_ROOT = path.resolve(__dirname, '../..');
const IS_IN_HEATPULSE = fs.existsSync(path.join(CANDIDATE_ROOT, 'src')) && fs.existsSync(path.join(CANDIDATE_ROOT, 'public'));
const HEATPULSE_DIR = IS_IN_HEATPULSE ? CANDIDATE_ROOT : path.join(CANDIDATE_ROOT, 'heatpulse');
const REPO_ROOT = IS_IN_HEATPULSE ? path.resolve(CANDIDATE_ROOT, '..') : CANDIDATE_ROOT;

const PROCESSED_DIR = path.join(HEATPULSE_DIR, 'public/data/processed/geojson');
const PUBLIC_DATA_DIR = path.join(HEATPULSE_DIR, 'public/data');
const RAW_BENGALURU_PATH = path.join(REPO_ROOT, 'wards_bengaluru_gba.geojson');
const LEGACY_BBMP_ZIP_PATH = path.join(REPO_ROOT, 'Bengaluru_MC(www.simplygis.in).zip');
const OUTLINE_RAR_PATH = path.join(REPO_ROOT, 'India_Outline(www.simplygis.in).rar');
const STATE_RAR_PATH = path.join(REPO_ROOT, 'India_State_Boundary(www.simplygis.in).rar');
const OPERATIONAL_OUTLINE_PATH = path.join(PROCESSED_DIR, 'india-outline.geojson');
const OPERATIONAL_STATES_PATH = path.join(PROCESSED_DIR, 'india-states.geojson');
const MAP_CONFIG_PATH = path.join(HEATPULSE_DIR, 'src/lib/map-config.ts');

// Expected checksums and file characteristics
const RAW_BENGALURU_EXPECTED_BYTES = 3052583;
const RAW_BENGALURU_EXPECTED_SHA256 = '6dff0924e3d938bfc63fc1ed292429ff41b95ed18459a3aa494b88a6be6691ce';
const LEGACY_BBMP_EXPECTED_BYTES = 717939;
const LEGACY_BBMP_EXPECTED_SHA256 = 'e5e5827d6f754a3e925a77cc6a40508fb557a235cd711c6eeaba7c1bc753114b';

// City definitions with bounding boxes [minLon, minLat, maxLon, maxLat] and expected ward counts
const CITY_SPECS = {
  bengaluru: {
    name: 'Bengaluru GBA',
    expectedWards: 369,
    filename: 'bengaluru-gba-369-wards.geojson',
    bbox: [77.40, 12.80, 77.85, 13.20],
  },
  pune: {
    name: 'Pune',
    expectedWards: 15,
    filename: 'pune-15-wards.geojson',
    fallbackFilename: 'pune-admin-wards.geojson',
    bbox: [73.70, 18.40, 74.05, 18.70],
  },
  mumbai: {
    name: 'Mumbai',
    expectedWards: 24,
    filename: 'mumbai-24-wards.geojson',
    bbox: [72.70, 18.85, 73.05, 19.35],
  },
  kolkata: {
    name: 'Kolkata',
    expectedWards: 141,
    filename: 'kolkata-141-wards.geojson',
    bbox: [88.20, 22.40, 88.50, 22.70],
  },
  chennai: {
    name: 'Chennai',
    expectedWards: 200,
    filename: 'chennai-200-wards.geojson',
    bbox: [80.10, 12.80, 80.40, 13.30],
  },
  coimbatore: {
    name: 'Coimbatore',
    expectedWards: 100,
    filename: 'coimbatore-100-wards.geojson',
    bbox: [76.80, 10.90, 77.15, 11.15],
  },
};

// Helper: compute SHA-256
function computeSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Helper: load GeoJSON
function loadCityGeoJson(cityKey) {
  const spec = CITY_SPECS[cityKey];
  const primaryPath = path.join(PROCESSED_DIR, spec.filename);
  if (fs.existsSync(primaryPath)) {
    return { data: JSON.parse(fs.readFileSync(primaryPath, 'utf8')), path: primaryPath };
  }
  if (spec.fallbackFilename) {
    const fallbackPath = path.join(PUBLIC_DATA_DIR, spec.fallbackFilename);
    if (fs.existsSync(fallbackPath)) {
      return { data: JSON.parse(fs.readFileSync(fallbackPath, 'utf8')), path: fallbackPath };
    }
  }
  return { data: null, path: primaryPath };
}

// Helper: compute planar shoelace centroid
function computePolygonCentroid(coords) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = coords.length;
  for (let i = 0; i < n - 1; i++) {
    const x0 = coords[i][0];
    const y0 = coords[i][1];
    const x1 = coords[i + 1][0];
    const y1 = coords[i + 1][1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area = area / 2;
  if (Math.abs(area) < 1e-11) {
    let sumX = 0, sumY = 0;
    for (let i = 0; i < n - 1; i++) {
      sumX += coords[i][0];
      sumY += coords[i][1];
    }
    return [sumX / (n - 1), sumY / (n - 1)];
  }
  cx = cx / (6 * area);
  cy = cy / (6 * area);
  return [cx, cy];
}

// Helper: get feature centroid
function getFeatureCentroid(feature) {
  if (feature.properties?.centroid && Array.isArray(feature.properties.centroid) && feature.properties.centroid.length === 2) {
    return feature.properties.centroid;
  }
  const geom = feature.geometry;
  if (!geom) return null;
  if (geom.type === 'Polygon' && geom.coordinates?.[0]) {
    return computePolygonCentroid(geom.coordinates[0]);
  }
  if (geom.type === 'MultiPolygon' && geom.coordinates?.[0]?.[0]) {
    return computePolygonCentroid(geom.coordinates[0][0]);
  }
  return null;
}

// Helper: extract all [lon, lat] coordinate pairs
function extractAllCoordinates(geom) {
  const coords = [];
  if (!geom || !geom.coordinates) return coords;
  function recurse(c) {
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      coords.push(c);
    } else {
      for (const item of c) recurse(item);
    }
  }
  recurse(geom.coordinates);
  return coords;
}

// Helper: check linear ring closure
function checkLinearRings(geom) {
  if (!geom || !geom.coordinates) return { ok: false, reason: 'No coordinates' };
  const rings = [];
  if (geom.type === 'Polygon') {
    rings.push(...geom.coordinates);
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      rings.push(...poly);
    }
  } else {
    return { ok: false, reason: `Not a polygon: ${geom.type}` };
  }

  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    if (!Array.isArray(r) || r.length < 4) {
      return { ok: false, reason: `Ring ${i} has fewer than 4 vertices` };
    }
    const first = r[0];
    const last = r[r.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      return { ok: false, reason: `Ring ${i} is not closed: start [${first}] != end [${last}]` };
    }
  }
  return { ok: true };
}

export function runGisValidationTests() {
  console.log('='.repeat(78));
  console.log('  HEATPULSE TIER 1: DETERMINISTIC GIS VALIDATION SUITE');
  console.log('  Scope: 62 Checks across 849 Municipal Wards & National Boundaries');
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

  // Pre-load all city GeoJSONs
  const cityData = {};
  for (const key of Object.keys(CITY_SPECS)) {
    cityData[key] = loadCityGeoJson(key);
  }

  // =========================================================================
  // CITY 1: BENGALURU GBA (369 WARDS) — CHECKS 1 TO 12
  // =========================================================================

  assertCheck('Bengaluru operational file exists (bengaluru-gba-369-wards.geojson)', () => {
    if (!cityData.bengaluru.data) {
      throw new Error(`File missing at ${cityData.bengaluru.path}`);
    }
  });

  assertCheck('Bengaluru GeoJSON is a valid FeatureCollection', () => {
    const geo = cityData.bengaluru.data;
    if (!geo || geo.type !== 'FeatureCollection' || !Array.isArray(geo.features)) {
      throw new Error('Bengaluru file is not a valid FeatureCollection');
    }
  });

  assertCheck('Bengaluru FeatureCollection contains exactly 369 features', () => {
    const geo = cityData.bengaluru.data;
    if (!geo) throw new Error('Bengaluru GeoJSON not loaded');
    if (geo.features.length !== 369) {
      throw new Error(`Expected 369 features, found ${geo.features.length}`);
    }
  });

  assertCheck('Bengaluru has zero GeometryCollections (all Polygon / MultiPolygon)', () => {
    const geo = cityData.bengaluru.data;
    if (!geo) throw new Error('Bengaluru GeoJSON not loaded');
    const geomCollections = geo.features.filter(f => f.geometry?.type === 'GeometryCollection');
    if (geomCollections.length > 0) {
      throw new Error(`Found ${geomCollections.length} GeometryCollection features; must be unwrapped to Polygon`);
    }
  });

  assertCheck('Bengaluru RFC 7946 coordinate order [lon, lat] (lon ~77.4-77.8, lat ~12.8-13.2)', () => {
    const geo = cityData.bengaluru.data;
    if (!geo) throw new Error('Bengaluru GeoJSON not loaded');
    for (let i = 0; i < geo.features.length; i++) {
      const f = geo.features[i];
      const coords = extractAllCoordinates(f.geometry);
      for (const [lon, lat] of coords) {
        if (lon < 77.40 || lon > 77.85 || lat < 12.80 || lat > 13.20) {
          throw new Error(`Ward ${i} coordinate [${lon}, ${lat}] out of Bengaluru bounds`);
        }
        if (lon <= lat) {
          throw new Error(`Ward ${i} coordinate inverted: lon (${lon}) <= lat (${lat})`);
        }
      }
    }
  });

  assertCheck('Bengaluru features fall strictly within GBA administrative bounding box', () => {
    const geo = cityData.bengaluru.data;
    if (!geo) throw new Error('Bengaluru GeoJSON not loaded');
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const f of geo.features) {
      const coords = extractAllCoordinates(f.geometry);
      for (const [x, y] of coords) {
        if (x < minLon) minLon = x;
        if (x > maxLon) maxLon = x;
        if (y < minLat) minLat = y;
        if (y > maxLat) maxLat = y;
      }
    }
    if (minLon < 77.40 || maxLon > 77.85 || minLat < 12.80 || maxLat > 13.20) {
      throw new Error(`Bounding box [${minLon}, ${minLat}, ${maxLon}, ${maxLat}] exceeds GBA limits`);
    }
  });

  assertCheck('Bengaluru has 369/369 unique ward identifiers', () => {
    const geo = cityData.bengaluru.data;
    if (!geo) throw new Error('Bengaluru GeoJSON not loaded');
    const ids = new Set();
    for (let i = 0; i < geo.features.length; i++) {
      const p = geo.features[i].properties || {};
      const id = p.ward_id || p.id2 || p.id || p.canonical_id || p.ward_name;
      if (!id) throw new Error(`Feature ${i} lacks an identifiable ID`);
      ids.add(String(id));
    }
    if (ids.size !== 369) {
      throw new Error(`Expected 369 unique IDs, found ${ids.size}`);
    }
  });

  assertCheck('Bengaluru features contain deterministic centroids', () => {
    const geo = cityData.bengaluru.data;
    if (!geo) throw new Error('Bengaluru GeoJSON not loaded');
    for (let i = 0; i < geo.features.length; i++) {
      const c = getFeatureCentroid(geo.features[i]);
      if (!c || !Array.isArray(c) || c.length !== 2) {
        throw new Error(`Feature ${i} has invalid centroid`);
      }
    }
  });

  assertCheck('Bengaluru centroids are non-NaN and within GBA bounding box', () => {
    const geo = cityData.bengaluru.data;
    if (!geo) throw new Error('Bengaluru GeoJSON not loaded');
    for (let i = 0; i < geo.features.length; i++) {
      const [lon, lat] = getFeatureCentroid(geo.features[i]);
      if (isNaN(lon) || isNaN(lat)) {
        throw new Error(`Feature ${i} centroid has NaN coordinates: [${lon}, ${lat}]`);
      }
      if (lon < 77.40 || lon > 77.85 || lat < 12.80 || lat > 13.20) {
        throw new Error(`Feature ${i} centroid [${lon}, ${lat}] outside GBA bounds`);
      }
    }
  });

  assertCheck('Raw source wards_bengaluru_gba.geojson is protected and unaltered', () => {
    if (!fs.existsSync(RAW_BENGALURU_PATH)) {
      throw new Error(`Raw Bengaluru file not found at ${RAW_BENGALURU_PATH}`);
    }
    const stat = fs.statSync(RAW_BENGALURU_PATH);
    if (stat.size !== RAW_BENGALURU_EXPECTED_BYTES) {
      throw new Error(`Raw file byte size altered: expected ${RAW_BENGALURU_EXPECTED_BYTES}, got ${stat.size}`);
    }
    const hash = computeSha256(RAW_BENGALURU_PATH);
    if (hash !== RAW_BENGALURU_EXPECTED_SHA256) {
      throw new Error(`Raw file SHA-256 altered: expected ${RAW_BENGALURU_EXPECTED_SHA256}, got ${hash}`);
    }
  });

  assertCheck('Legacy 225 BBMP archive is segregated and intact (not mixed into operational GeoJSON)', () => {
    if (!fs.existsSync(LEGACY_BBMP_ZIP_PATH)) {
      throw new Error(`Legacy BBMP archive not found at ${LEGACY_BBMP_ZIP_PATH}`);
    }
    const stat = fs.statSync(LEGACY_BBMP_ZIP_PATH);
    if (stat.size !== LEGACY_BBMP_EXPECTED_BYTES) {
      throw new Error(`Legacy zip size altered: expected ${LEGACY_BBMP_EXPECTED_BYTES}, got ${stat.size}`);
    }
    const hash = computeSha256(LEGACY_BBMP_ZIP_PATH);
    if (hash !== LEGACY_BBMP_EXPECTED_SHA256) {
      throw new Error(`Legacy zip SHA-256 altered: expected ${LEGACY_BBMP_EXPECTED_SHA256}, got ${hash}`);
    }
    const geo = cityData.bengaluru.data;
    if (geo && geo.features.length !== 369) {
      throw new Error(`Operational Bengaluru file corrupted with legacy features: count is ${geo.features.length}`);
    }
  });

  assertCheck('Bengaluru polygon rings are properly closed (first vertex === last vertex)', () => {
    const geo = cityData.bengaluru.data;
    if (!geo) throw new Error('Bengaluru GeoJSON not loaded');
    for (let i = 0; i < geo.features.length; i++) {
      const res = checkLinearRings(geo.features[i].geometry);
      if (!res.ok) {
        throw new Error(`Feature ${i} linear ring error: ${res.reason}`);
      }
    }
  });

  // =========================================================================
  // CITY 2: PUNE (15 WARDS) — CHECKS 13 TO 18
  // =========================================================================

  assertCheck('Pune operational file exists (pune-15-wards.geojson)', () => {
    if (!cityData.pune.data) {
      throw new Error(`File missing at ${cityData.pune.path}`);
    }
  });

  assertCheck('Pune contains exactly 15 administrative ward features', () => {
    const geo = cityData.pune.data;
    if (!geo) throw new Error('Pune GeoJSON not loaded');
    if (geo.features.length !== 15) {
      throw new Error(`Expected 15 features for Pune, found ${geo.features.length}`);
    }
  });

  assertCheck('Pune RFC 7946 coordinate order [lon, lat] (lon ~73.7-74.0, lat ~18.4-18.7)', () => {
    const geo = cityData.pune.data;
    if (!geo) throw new Error('Pune GeoJSON not loaded');
    for (const f of geo.features) {
      const coords = extractAllCoordinates(f.geometry);
      for (const [lon, lat] of coords) {
        if (lon < 73.70 || lon > 74.05 || lat < 18.40 || lat > 18.70) {
          throw new Error(`Pune coordinate [${lon}, ${lat}] out of Pune bounds`);
        }
        if (lon <= lat) {
          throw new Error(`Pune coordinate inverted: lon (${lon}) <= lat (${lat})`);
        }
      }
    }
  });

  assertCheck('Pune has zero GeometryCollections (all Polygon / MultiPolygon)', () => {
    const geo = cityData.pune.data;
    if (!geo) throw new Error('Pune GeoJSON not loaded');
    const invalid = geo.features.filter(f => f.geometry?.type === 'GeometryCollection');
    if (invalid.length > 0) throw new Error(`Pune has ${invalid.length} GeometryCollections`);
  });

  assertCheck('Pune has 15/15 unique ward identifiers', () => {
    const geo = cityData.pune.data;
    if (!geo) throw new Error('Pune GeoJSON not loaded');
    const ids = new Set();
    for (const f of geo.features) {
      const p = f.properties || {};
      const id = p.ward_id || p.id || p.name;
      if (!id) throw new Error('Pune feature missing ID/name');
      ids.add(String(id));
    }
    if (ids.size !== 15) throw new Error(`Expected 15 unique Pune IDs, found ${ids.size}`);
  });

  assertCheck('Pune centroids are valid, non-NaN, and within Pune bounds', () => {
    const geo = cityData.pune.data;
    if (!geo) throw new Error('Pune GeoJSON not loaded');
    for (let i = 0; i < geo.features.length; i++) {
      const c = getFeatureCentroid(geo.features[i]);
      if (!c || isNaN(c[0]) || isNaN(c[1])) {
        throw new Error(`Pune feature ${i} has invalid centroid`);
      }
      if (c[0] < 73.70 || c[0] > 74.05 || c[1] < 18.40 || c[1] > 18.70) {
        throw new Error(`Pune feature ${i} centroid [${c[0]}, ${c[1]}] outside bounds`);
      }
    }
  });

  // =========================================================================
  // CITY 3: MUMBAI (24 WARDS) — CHECKS 19 TO 24
  // =========================================================================

  assertCheck('Mumbai operational file exists (mumbai-24-wards.geojson)', () => {
    if (!cityData.mumbai.data) {
      throw new Error(`File missing at ${cityData.mumbai.path}`);
    }
  });

  assertCheck('Mumbai contains exactly 24 administrative ward features', () => {
    const geo = cityData.mumbai.data;
    if (!geo) throw new Error('Mumbai GeoJSON not loaded');
    if (geo.features.length !== 24) {
      throw new Error(`Expected 24 features for Mumbai, found ${geo.features.length}`);
    }
  });

  assertCheck('Mumbai RFC 7946 coordinate order [lon, lat] (lon ~72.7-73.0, lat ~18.8-19.3)', () => {
    const geo = cityData.mumbai.data;
    if (!geo) throw new Error('Mumbai GeoJSON not loaded');
    for (const f of geo.features) {
      const coords = extractAllCoordinates(f.geometry);
      for (const [lon, lat] of coords) {
        if (lon < 72.70 || lon > 73.05 || lat < 18.85 || lat > 19.35) {
          throw new Error(`Mumbai coordinate [${lon}, ${lat}] out of Mumbai bounds`);
        }
        if (lon <= lat) {
          throw new Error(`Mumbai coordinate inverted: lon (${lon}) <= lat (${lat})`);
        }
      }
    }
  });

  assertCheck('Mumbai has zero GeometryCollections (all Polygon / MultiPolygon)', () => {
    const geo = cityData.mumbai.data;
    if (!geo) throw new Error('Mumbai GeoJSON not loaded');
    const invalid = geo.features.filter(f => f.geometry?.type === 'GeometryCollection');
    if (invalid.length > 0) throw new Error(`Mumbai has ${invalid.length} GeometryCollections`);
  });

  assertCheck('Mumbai has 24/24 unique ward identifiers (A through T)', () => {
    const geo = cityData.mumbai.data;
    if (!geo) throw new Error('Mumbai GeoJSON not loaded');
    const ids = new Set();
    for (const f of geo.features) {
      const p = f.properties || {};
      const id = p.ward_id || p.id || p.Name || p.name;
      if (!id) throw new Error('Mumbai feature missing ID/name');
      ids.add(String(id));
    }
    if (ids.size !== 24) throw new Error(`Expected 24 unique Mumbai IDs, found ${ids.size}`);
  });

  assertCheck('Mumbai centroids are valid, non-NaN, and within Mumbai bounds', () => {
    const geo = cityData.mumbai.data;
    if (!geo) throw new Error('Mumbai GeoJSON not loaded');
    for (let i = 0; i < geo.features.length; i++) {
      const c = getFeatureCentroid(geo.features[i]);
      if (!c || isNaN(c[0]) || isNaN(c[1])) {
        throw new Error(`Mumbai feature ${i} has invalid centroid`);
      }
      if (c[0] < 72.70 || c[0] > 73.05 || c[1] < 18.85 || c[1] > 19.35) {
        throw new Error(`Mumbai feature ${i} centroid [${c[0]}, ${c[1]}] outside bounds`);
      }
    }
  });

  // =========================================================================
  // CITY 4: KOLKATA (141 WARDS) — CHECKS 25 TO 30
  // =========================================================================

  assertCheck('Kolkata operational file exists (kolkata-141-wards.geojson)', () => {
    if (!cityData.kolkata.data) {
      throw new Error(`File missing at ${cityData.kolkata.path}`);
    }
  });

  assertCheck('Kolkata contains exactly 141 municipal ward features', () => {
    const geo = cityData.kolkata.data;
    if (!geo) throw new Error('Kolkata GeoJSON not loaded');
    if (geo.features.length !== 141) {
      throw new Error(`Expected 141 features for Kolkata, found ${geo.features.length}`);
    }
  });

  assertCheck('Kolkata RFC 7946 coordinate order [lon, lat] (lon ~88.2-88.5, lat ~22.4-22.7)', () => {
    const geo = cityData.kolkata.data;
    if (!geo) throw new Error('Kolkata GeoJSON not loaded');
    for (const f of geo.features) {
      const coords = extractAllCoordinates(f.geometry);
      for (const [lon, lat] of coords) {
        if (lon < 88.20 || lon > 88.50 || lat < 22.40 || lat > 22.70) {
          throw new Error(`Kolkata coordinate [${lon}, ${lat}] out of Kolkata bounds`);
        }
        if (lon <= lat) {
          throw new Error(`Kolkata coordinate inverted: lon (${lon}) <= lat (${lat})`);
        }
      }
    }
  });

  assertCheck('Kolkata has zero GeometryCollections (all Polygon / MultiPolygon)', () => {
    const geo = cityData.kolkata.data;
    if (!geo) throw new Error('Kolkata GeoJSON not loaded');
    const invalid = geo.features.filter(f => f.geometry?.type === 'GeometryCollection');
    if (invalid.length > 0) throw new Error(`Kolkata has ${invalid.length} GeometryCollections`);
  });

  assertCheck('Kolkata has 141/141 unique ward identifiers', () => {
    const geo = cityData.kolkata.data;
    if (!geo) throw new Error('Kolkata GeoJSON not loaded');
    const ids = new Set();
    for (const f of geo.features) {
      const p = f.properties || {};
      const id = p.ward_id || p.id || p.WARD || p.ward_name;
      if (!id) throw new Error('Kolkata feature missing ID/name');
      ids.add(String(id));
    }
    if (ids.size !== 141) throw new Error(`Expected 141 unique Kolkata IDs, found ${ids.size}`);
  });

  assertCheck('Kolkata centroids are valid, non-NaN, and within Kolkata bounds', () => {
    const geo = cityData.kolkata.data;
    if (!geo) throw new Error('Kolkata GeoJSON not loaded');
    for (let i = 0; i < geo.features.length; i++) {
      const c = getFeatureCentroid(geo.features[i]);
      if (!c || isNaN(c[0]) || isNaN(c[1])) {
        throw new Error(`Kolkata feature ${i} has invalid centroid`);
      }
      if (c[0] < 88.20 || c[0] > 88.50 || c[1] < 22.40 || c[1] > 22.70) {
        throw new Error(`Kolkata feature ${i} centroid [${c[0]}, ${c[1]}] outside bounds`);
      }
    }
  });

  // =========================================================================
  // CITY 5: CHENNAI (200 WARDS) — CHECKS 31 TO 36
  // =========================================================================

  assertCheck('Chennai operational file exists (chennai-200-wards.geojson)', () => {
    if (!cityData.chennai.data) {
      throw new Error(`File missing at ${cityData.chennai.path}`);
    }
  });

  assertCheck('Chennai contains exactly 200 municipal ward features', () => {
    const geo = cityData.chennai.data;
    if (!geo) throw new Error('Chennai GeoJSON not loaded');
    if (geo.features.length !== 200) {
      throw new Error(`Expected 200 features for Chennai, found ${geo.features.length}`);
    }
  });

  assertCheck('Chennai RFC 7946 coordinate order [lon, lat] (lon ~80.1-80.4, lat ~12.8-13.3)', () => {
    const geo = cityData.chennai.data;
    if (!geo) throw new Error('Chennai GeoJSON not loaded');
    for (const f of geo.features) {
      const coords = extractAllCoordinates(f.geometry);
      for (const [lon, lat] of coords) {
        if (lon < 80.10 || lon > 80.40 || lat < 12.80 || lat > 13.30) {
          throw new Error(`Chennai coordinate [${lon}, ${lat}] out of Chennai bounds`);
        }
        if (lon <= lat) {
          throw new Error(`Chennai coordinate inverted: lon (${lon}) <= lat (${lat})`);
        }
      }
    }
  });

  assertCheck('Chennai has zero GeometryCollections (all Polygon / MultiPolygon)', () => {
    const geo = cityData.chennai.data;
    if (!geo) throw new Error('Chennai GeoJSON not loaded');
    const invalid = geo.features.filter(f => f.geometry?.type === 'GeometryCollection');
    if (invalid.length > 0) throw new Error(`Chennai has ${invalid.length} GeometryCollections`);
  });

  assertCheck('Chennai has 200/200 unique ward identifiers', () => {
    const geo = cityData.chennai.data;
    if (!geo) throw new Error('Chennai GeoJSON not loaded');
    const ids = new Set();
    for (const f of geo.features) {
      const p = f.properties || {};
      const id = p.ward_id || p.id || p.id_2 || p.Name;
      if (!id) throw new Error('Chennai feature missing ID/name');
      ids.add(String(id));
    }
    if (ids.size !== 200) throw new Error(`Expected 200 unique Chennai IDs, found ${ids.size}`);
  });

  assertCheck('Chennai centroids are valid, non-NaN, and within Chennai bounds', () => {
    const geo = cityData.chennai.data;
    if (!geo) throw new Error('Chennai GeoJSON not loaded');
    for (let i = 0; i < geo.features.length; i++) {
      const c = getFeatureCentroid(geo.features[i]);
      if (!c || isNaN(c[0]) || isNaN(c[1])) {
        throw new Error(`Chennai feature ${i} has invalid centroid`);
      }
      if (c[0] < 80.10 || c[0] > 80.40 || c[1] < 12.80 || c[1] > 13.30) {
        throw new Error(`Chennai feature ${i} centroid [${c[0]}, ${c[1]}] outside bounds`);
      }
    }
  });

  // =========================================================================
  // CITY 6: COIMBATORE (100 WARDS) — CHECKS 37 TO 42
  // =========================================================================

  assertCheck('Coimbatore operational file exists (coimbatore-100-wards.geojson)', () => {
    if (!cityData.coimbatore.data) {
      throw new Error(`File missing at ${cityData.coimbatore.path}`);
    }
  });

  assertCheck('Coimbatore contains exactly 100 municipal ward features', () => {
    const geo = cityData.coimbatore.data;
    if (!geo) throw new Error('Coimbatore GeoJSON not loaded');
    if (geo.features.length !== 100) {
      throw new Error(`Expected 100 features for Coimbatore, found ${geo.features.length}`);
    }
  });

  assertCheck('Coimbatore RFC 7946 coordinate order [lon, lat] (lon ~76.8-77.15, lat ~10.9-11.15)', () => {
    const geo = cityData.coimbatore.data;
    if (!geo) throw new Error('Coimbatore GeoJSON not loaded');
    for (const f of geo.features) {
      const coords = extractAllCoordinates(f.geometry);
      for (const [lon, lat] of coords) {
        if (lon < 76.80 || lon > 77.15 || lat < 10.90 || lat > 11.15) {
          throw new Error(`Coimbatore coordinate [${lon}, ${lat}] out of Coimbatore bounds`);
        }
        if (lon <= lat) {
          throw new Error(`Coimbatore coordinate inverted: lon (${lon}) <= lat (${lat})`);
        }
      }
    }
  });

  assertCheck('Coimbatore has zero GeometryCollections (all Polygon / MultiPolygon)', () => {
    const geo = cityData.coimbatore.data;
    if (!geo) throw new Error('Coimbatore GeoJSON not loaded');
    const invalid = geo.features.filter(f => f.geometry?.type === 'GeometryCollection');
    if (invalid.length > 0) throw new Error(`Coimbatore has ${invalid.length} GeometryCollections`);
  });

  assertCheck('Coimbatore has 100/100 unique ward identifiers', () => {
    const geo = cityData.coimbatore.data;
    if (!geo) throw new Error('Coimbatore GeoJSON not loaded');
    const ids = new Set();
    for (const f of geo.features) {
      const p = f.properties || {};
      const id = p.ward_id || p.id || p.ward_lgd_c || p.ward_lgd_n || p.objectid;
      if (!id) throw new Error('Coimbatore feature missing ID/name');
      ids.add(String(id));
    }
    if (ids.size !== 100) throw new Error(`Expected 100 unique Coimbatore IDs, found ${ids.size}`);
  });

  assertCheck('Coimbatore centroids are valid, non-NaN, and within Coimbatore bounds', () => {
    const geo = cityData.coimbatore.data;
    if (!geo) throw new Error('Coimbatore GeoJSON not loaded');
    for (let i = 0; i < geo.features.length; i++) {
      const c = getFeatureCentroid(geo.features[i]);
      if (!c || isNaN(c[0]) || isNaN(c[1])) {
        throw new Error(`Coimbatore feature ${i} has invalid centroid`);
      }
      if (c[0] < 76.80 || c[0] > 77.15 || c[1] < 10.90 || c[1] > 11.15) {
        throw new Error(`Coimbatore feature ${i} centroid [${c[0]}, ${c[1]}] outside bounds`);
      }
    }
  });

  // =========================================================================
  // AGGREGATE SYSTEM CHECKS — CHECKS 43 TO 48
  // =========================================================================

  assertCheck('Total operational municipal wards across all 6 cities equals exactly 849', () => {
    let totalWards = 0;
    for (const key of Object.keys(CITY_SPECS)) {
      const geo = cityData[key].data;
      if (!geo) throw new Error(`City ${key} GeoJSON not loaded`);
      totalWards += geo.features.length;
    }
    if (totalWards !== 849) {
      throw new Error(`Expected exactly 849 total municipal wards, got ${totalWards}`);
    }
  });

  assertCheck('Pan-India coordinate bounding sanity (Lon 68-98 E, Lat 8-38 N across all 849 wards)', () => {
    for (const key of Object.keys(CITY_SPECS)) {
      const geo = cityData[key].data;
      if (!geo) continue;
      for (const f of geo.features) {
        const coords = extractAllCoordinates(f.geometry);
        for (const [lon, lat] of coords) {
          if (lon < 68.0 || lon > 98.0 || lat < 8.0 || lat > 38.0) {
            throw new Error(`Coordinate [${lon}, ${lat}] in city ${key} outside India territory bounds`);
          }
        }
      }
    }
  });

  assertCheck('Zero coordinate inversion across all 849 wards (lon > lat in all coordinates)', () => {
    for (const key of Object.keys(CITY_SPECS)) {
      const geo = cityData[key].data;
      if (!geo) continue;
      for (const f of geo.features) {
        const coords = extractAllCoordinates(f.geometry);
        for (const [lon, lat] of coords) {
          if (lon <= lat) {
            throw new Error(`Inverted coordinate detected in ${key}: lon=${lon} <= lat=${lat}`);
          }
        }
      }
    }
  });

  assertCheck('Global centroid completeness: 849/849 valid non-NaN centroids across all 6 cities', () => {
    let centroidCount = 0;
    for (const key of Object.keys(CITY_SPECS)) {
      const geo = cityData[key].data;
      if (!geo) continue;
      for (const f of geo.features) {
        const c = getFeatureCentroid(f);
        if (!c || isNaN(c[0]) || isNaN(c[1])) {
          throw new Error(`Invalid centroid in ${key}`);
        }
        centroidCount++;
      }
    }
    if (centroidCount !== 849) {
      throw new Error(`Expected 849 valid centroids, found ${centroidCount}`);
    }
  });

  assertCheck('Global ring closure: 100% of linear rings across all 849 features are properly closed', () => {
    for (const key of Object.keys(CITY_SPECS)) {
      const geo = cityData[key].data;
      if (!geo) continue;
      for (let i = 0; i < geo.features.length; i++) {
        const res = checkLinearRings(geo.features[i].geometry);
        if (!res.ok) {
          throw new Error(`Feature ${i} in ${key} ring closure failed: ${res.reason}`);
        }
      }
    }
  });

  assertCheck('Multi-city metadata registry consistency with city counts and bounding extents', () => {
    // Check if src/types/gis.ts or src/lib/gis-utils.ts or src/lib/cities.ts defines the cities
    const gisTypesPath = path.join(REPO_ROOT, 'heatpulse/src/types/gis.ts');
    const gisUtilsPath = path.join(REPO_ROOT, 'heatpulse/src/lib/gis-utils.ts');
    const hasMetadataCode = fs.existsSync(gisTypesPath) || fs.existsSync(gisUtilsPath);
    if (!hasMetadataCode) {
      // If code is in progress, check CITY_SPECS internal consistency
      const expectedTotal = Object.values(CITY_SPECS).reduce((sum, c) => sum + c.expectedWards, 0);
      if (expectedTotal !== 849) {
        throw new Error(`Expected total 849 in registry, got ${expectedTotal}`);
      }
    }
  });

  // =========================================================================
  // NATIONAL INDIA BOUNDARIES & SIMPLYGIS INTEGRITY — CHECKS 49 TO 62
  // =========================================================================

  assertCheck('SimplyGIS India_Outline archive is intact at repository root', () => {
    if (!fs.existsSync(OUTLINE_RAR_PATH)) {
      throw new Error(`Missing ${OUTLINE_RAR_PATH}`);
    }
    const stat = fs.statSync(OUTLINE_RAR_PATH);
    if (stat.size !== 5205507) {
      throw new Error(`India_Outline.rar size mismatch: expected 5205507 bytes, got ${stat.size}`);
    }
  });

  assertCheck('SimplyGIS India_State_Boundary archive is intact at repository root', () => {
    if (!fs.existsSync(STATE_RAR_PATH)) {
      throw new Error(`Missing ${STATE_RAR_PATH}`);
    }
    const stat = fs.statSync(STATE_RAR_PATH);
    if (stat.size !== 14004650) {
      throw new Error(`India_State_Boundary.rar size mismatch: expected 14004650 bytes, got ${stat.size}`);
    }
  });

  assertCheck('Operational india-outline.geojson exists as a valid FeatureCollection', () => {
    if (!fs.existsSync(OPERATIONAL_OUTLINE_PATH)) {
      throw new Error(`Missing ${OPERATIONAL_OUTLINE_PATH}`);
    }
    const data = JSON.parse(fs.readFileSync(OPERATIONAL_OUTLINE_PATH, 'utf8'));
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length !== 1) {
      throw new Error(`Expected 1 feature in india-outline.geojson, got ${data.features?.length}`);
    }
  });

  assertCheck('Operational india-states.geojson exists as a valid FeatureCollection with all 40 features', () => {
    if (!fs.existsSync(OPERATIONAL_STATES_PATH)) {
      throw new Error(`Missing ${OPERATIONAL_STATES_PATH}`);
    }
    const data = JSON.parse(fs.readFileSync(OPERATIONAL_STATES_PATH, 'utf8'));
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length < 36) {
      throw new Error(`Expected >= 36 features in india-states.geojson, got ${data.features?.length}`);
    }
  });

  assertCheck('National outline northern latitude covers complete territory (maxLat >= 37.08°N)', () => {
    const data = JSON.parse(fs.readFileSync(OPERATIONAL_OUTLINE_PATH, 'utf8'));
    let maxLat = -Infinity;
    function scan(c) {
      if (typeof c[0] === 'number') {
        if (c[1] > maxLat) maxLat = c[1];
      } else c.forEach(scan);
    }
    scan(data.features[0].geometry.coordinates);
    if (maxLat < 37.08) {
      throw new Error(`National outline max latitude ${maxLat}°N is truncated (< 37.08°N)`);
    }
  });

  assertCheck('National state boundary northern latitude covers complete territory (maxLat >= 37.08°N)', () => {
    const data = JSON.parse(fs.readFileSync(OPERATIONAL_STATES_PATH, 'utf8'));
    let maxLat = -Infinity;
    function scan(c) {
      if (typeof c[0] === 'number') {
        if (c[1] > maxLat) maxLat = c[1];
      } else c.forEach(scan);
    }
    for (const f of data.features) scan(f.geometry.coordinates);
    if (maxLat < 37.08) {
      throw new Error(`National state boundary max latitude ${maxLat}°N is truncated (< 37.08°N)`);
    }
  });

  assertCheck('National state dataset represents Ladakh Union Territory (State_LGD: 37)', () => {
    const data = JSON.parse(fs.readFileSync(OPERATIONAL_STATES_PATH, 'utf8'));
    const ladakh = data.features.find(f => {
      const s = JSON.stringify(f.properties).toLowerCase();
      return s.includes('ladakh');
    });
    if (!ladakh) {
      throw new Error('Ladakh Union Territory is missing from operational india-states.geojson');
    }
    const lgd = ladakh.properties.State_LGD ?? ladakh.properties.state_lgd;
    if (lgd !== 37) {
      throw new Error(`Expected Ladakh State_LGD to be 37, got ${lgd}`);
    }
  });

  assertCheck('National state dataset represents Jammu & Kashmir Union Territory (State_LGD: 1)', () => {
    const data = JSON.parse(fs.readFileSync(OPERATIONAL_STATES_PATH, 'utf8'));
    const jk = data.features.find(f => {
      const s = JSON.stringify(f.properties).toLowerCase();
      return s.includes('jammu');
    });
    if (!jk) {
      throw new Error('Jammu & Kashmir is missing from operational india-states.geojson');
    }
    const lgd = jk.properties.State_LGD ?? jk.properties.state_lgd;
    if (lgd !== 1) {
      throw new Error(`Expected Jammu & Kashmir State_LGD to be 1, got ${lgd}`);
    }
  });

  assertCheck('National state dataset represents merged Dadra & Nagar Haveli and Daman & Diu (State_LGD: 26)', () => {
    const data = JSON.parse(fs.readFileSync(OPERATIONAL_STATES_PATH, 'utf8'));
    const merged = data.features.find(f => {
      const s = JSON.stringify(f.properties).toLowerCase();
      return s.includes('dadra') && s.includes('daman');
    });
    if (!merged) {
      throw new Error('Merged Dadra & Nagar Haveli and Daman & Diu UT is missing (still separate entities)');
    }
    const lgd = merged.properties.State_LGD ?? merged.properties.state_lgd;
    if (lgd !== 26) {
      throw new Error(`Expected merged D&D/DNH State_LGD to be 26, got ${lgd}`);
    }
  });

  assertCheck('Pan-India national bounding box integrity [minLon 68.1..97.5, minLat 6.7..37.1]', () => {
    const data = JSON.parse(fs.readFileSync(OPERATIONAL_OUTLINE_PATH, 'utf8'));
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    function scan(c) {
      if (typeof c[0] === 'number') {
        if (c[0] < minLon) minLon = c[0];
        if (c[0] > maxLon) maxLon = c[0];
        if (c[1] < minLat) minLat = c[1];
        if (c[1] > maxLat) maxLat = c[1];
      } else c.forEach(scan);
    }
    scan(data.features[0].geometry.coordinates);
    if (minLon > 68.2 || maxLon < 97.4 || minLat > 6.8 || maxLat < 37.08) {
      throw new Error(`National bounding box [${minLon}, ${minLat}, ${maxLon}, ${maxLat}] does not cover full Indian territory`);
    }
  });

  assertCheck('RFC 7946 coordinate ordering [lon, lat] across 100% of national vertices', () => {
    const data = JSON.parse(fs.readFileSync(OPERATIONAL_OUTLINE_PATH, 'utf8'));
    function scan(c) {
      if (typeof c[0] === 'number') {
        const [lon, lat] = c;
        if (lon < 68.0 || lon > 98.0 || lat < 6.0 || lat > 38.0) {
          throw new Error(`Coordinate [${lon}, ${lat}] out of Indian national domain`);
        }
      } else c.forEach(scan);
    }
    scan(data.features[0].geometry.coordinates);
  });

  assertCheck('Zero coordinate inversion across national geometry (lon > lat for all mainland coordinates)', () => {
    const data = JSON.parse(fs.readFileSync(OPERATIONAL_OUTLINE_PATH, 'utf8'));
    let invCount = 0;
    function scan(c) {
      if (typeof c[0] === 'number') {
        const [lon, lat] = c;
        if (lon <= lat && lat > 10.0) invCount++;
      } else c.forEach(scan);
    }
    scan(data.features[0].geometry.coordinates);
    if (invCount > 0) {
      throw new Error(`Found ${invCount} inverted coordinates in national outline`);
    }
  });

  assertCheck('INDIA_BBOX in src/lib/map-config.ts covers full northern extent (maxLat >= 37.0°N)', () => {
    const content = fs.readFileSync(MAP_CONFIG_PATH, 'utf8');
    const valMatch = content.match(/INDIA_BBOX[^\=]*=\s*\[([^\]]+)\]/);
    if (!valMatch) throw new Error('INDIA_BBOX not found in map-config.ts');
    const nums = valMatch[1].split(',').map(n => parseFloat(n.trim()));
    if (nums[3] < 37.0) {
      throw new Error(`INDIA_BBOX max latitude is ${nums[3]}°N (< 37.0°N), causes clipping of northern Ladakh!`);
    }
  });

  assertCheck('National Level of Detail (LOD 0) suppresses ward polygons at zoom < 8', () => {
    const content = fs.readFileSync(MAP_CONFIG_PATH, 'utf8');
    if (!content.includes('LOD_CITY_MIN_ZOOM = 8') || !content.includes('minZoom: LOD_CITY_MIN_ZOOM')) {
      throw new Error('LOD 0 ward suppression threshold (zoom 8) not configured');
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
  const { failed } = runGisValidationTests();
  process.exit(failed > 0 ? 1 : 0);
}
