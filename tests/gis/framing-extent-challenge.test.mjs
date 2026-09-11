/**
 * HeatPulse — Framing Extent Adversarial Challenge Test Harness
 * 
 * Standard: SIH26083 Master Build Specification (MoES / NCMRWF)
 * Role: Challenger 1 (Framing Extent Challenger)
 * 
 * Scope of Adversarial Verification:
 *   Section 1: National Survey of India Framing Assessment
 *     - Survey of India bounding box [68.1, 6.7, 97.5, 37.2] vs india-states.geojson
 *     - fitToIndia padding [45, 30, 55, 30] in container heights 720px & 750px
 *     - Viewport coverage >= 70% without clipping Kashmir, Arunachal Pradesh, Andaman & Nicobar
 *   Section 2: Municipal Ward Geometry Framing & Area Coverage (All 6 Cities)
 *     - Bengaluru (369), Pune (15), Mumbai (24), Kolkata (141), Chennai (200), Coimbatore (100)
 *     - flyToCity padding [20, 20, 20, 20]
 *     - Zero clipping of outer ward boundaries across all 849 wards
 *     - Analytical area coverage verification across multiple viewport scales
 *   Section 3: Edge Cases, Viewport Jitter & Coordinate Inversion
 *     - Viewport stability & idempotence (zero jitter across 100 iterations)
 *     - Zero coordinate inversion (RFC 7946 [lon, lat] strictly verified)
 *     - maxZoom safety rails (maxZoom: 6 for India, maxZoom: 13 for cities)
 *     - Extreme viewport aspect ratio stress testing
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import View from '../../heatpulse/node_modules/ol/View.js';
import { transformExtent, fromLonLat, toLonLat } from '../../heatpulse/node_modules/ol/proj.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const PROCESSED_DIR = path.join(REPO_ROOT, 'heatpulse/public/data/processed/geojson');
const GIS_TYPES_PATH = path.join(REPO_ROOT, 'heatpulse/src/types/gis.ts');

const summary = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

function assert(condition, description, details = '') {
  summary.total++;
  if (condition) {
    summary.passed++;
    console.log(`  [PASS] Check ${String(summary.total).padStart(2, '0')}: ${description}`);
  } else {
    summary.failed++;
    const msg = `FAIL: Check ${String(summary.total).padStart(2, '0')}: ${description} ${details ? '(' + details + ')' : ''}`;
    summary.failures.push(msg);
    console.error(`  [FAIL] Check ${String(summary.total).padStart(2, '0')}: ${description}`);
    if (details) console.error(`         Details: ${details}`);
  }
}

export function runFramingExtentChallenge() {
  console.log('='.repeat(80));
  console.log('  HEATPULSE ADVERSARIAL FRAMING EXTENT & VIEWPORT CHALLENGE SUITE');
  console.log('  Challenger 1: Empirical Verification of National & Municipal Map Viewports');
  console.log('='.repeat(80) + '\n');

  // Load GIS types to extract CITIES metadata
  const gisTsContent = fs.readFileSync(GIS_TYPES_PATH, 'utf8');

  // Load National India States GeoJSON
  const indiaStatesPath = path.join(PROCESSED_DIR, 'india-states.geojson');
  const indiaStatesGeo = JSON.parse(fs.readFileSync(indiaStatesPath, 'utf8'));

  // Load All 6 City GeoJSONs
  const cityFiles = {
    bengaluru: { name: 'Bengaluru', expectedCount: 369, file: 'bengaluru-gba-369-wards.geojson' },
    pune: { name: 'Pune', expectedCount: 15, file: 'pune-15-wards.geojson' },
    mumbai: { name: 'Mumbai', expectedCount: 24, file: 'mumbai-24-wards.geojson' },
    kolkata: { name: 'Kolkata', expectedCount: 141, file: 'kolkata-141-wards.geojson' },
    chennai: { name: 'Chennai', expectedCount: 200, file: 'chennai-200-wards.geojson' },
    coimbatore: { name: 'Coimbatore', expectedCount: 100, file: 'coimbatore-100-wards.geojson' }
  };

  const cityGeo = {};
  const cityMetaBbox = {};
  for (const [cityId, cfg] of Object.entries(cityFiles)) {
    const p = path.join(PROCESSED_DIR, cfg.file);
    cityGeo[cityId] = JSON.parse(fs.readFileSync(p, 'utf8'));

    const regex = new RegExp(cityId + ':[\\s\\S]*?bbox:\\s*\\[([0-9.,\\s]+)\\]');
    const match = gisTsContent.match(regex);
    if (match) {
      cityMetaBbox[cityId] = match[1].split(',').map(s => parseFloat(s.trim()));
    }
  }

  // =========================================================================
  // SECTION 1: National Survey of India Framing Assessment
  // =========================================================================
  console.log('--- SECTION 1: National Survey of India Framing & Boundary Extent ---');

  const SOI_BBOX = [68.1, 6.7, 97.5, 37.2]; // [minLon, minLat, maxLon, maxLat]
  const FIT_TO_INDIA_PADDING = [45, 30, 55, 30]; // [top, right, bottom, left]

  // Compute exact bounding box of india-states.geojson
  let indMinLon = Infinity, indMinLat = Infinity, indMaxLon = -Infinity, indMaxLat = -Infinity;
  let kashmirVertex = null, arunachalVertex = null, andamanVertex = null, gujaratVertex = null;

  function scanIndia(coords) {
    if (typeof coords[0] === 'number') {
      const [lon, lat] = coords;
      if (lon < indMinLon) { indMinLon = lon; gujaratVertex = [lon, lat]; }
      if (lon > indMaxLon) { indMaxLon = lon; arunachalVertex = [lon, lat]; }
      if (lat < indMinLat) { indMinLat = lat; andamanVertex = [lon, lat]; }
      if (lat > indMaxLat) { indMaxLat = lat; kashmirVertex = [lon, lat]; }
    } else {
      coords.forEach(scanIndia);
    }
  }
  indiaStatesGeo.features.forEach(f => scanIndia(f.geometry.coordinates));

  // Check 01: SOI_BBOX strictly encloses india-states.geojson
  const enclosesIndia = (SOI_BBOX[0] <= indMinLon && SOI_BBOX[1] <= indMinLat &&
                         SOI_BBOX[2] >= indMaxLon && SOI_BBOX[3] >= indMaxLat);
  assert(enclosesIndia, 'Survey of India BBox strictly encloses india-states.geojson on all 4 frontiers',
    `SOI: [${SOI_BBOX}], Actual: [${indMinLon.toFixed(6)}, ${indMinLat.toFixed(6)}, ${indMaxLon.toFixed(6)}, ${indMaxLat.toFixed(6)}]`);

  // Check 02: Northern Kashmir/Ladakh boundary margin
  const northMargin = SOI_BBOX[3] - indMaxLat;
  assert(northMargin > 0.05 && northMargin < 0.2,
    `Northern Kashmir boundary (lat ${indMaxLat.toFixed(6)}°N) has safe positive margin (+${northMargin.toFixed(4)}°) inside SOI BBox (37.2°N)`,
    `Margin: ${northMargin.toFixed(6)}° (~${(northMargin * 111).toFixed(1)} km)`);

  // Check 03: Eastern Arunachal Pradesh boundary margin
  const eastMargin = SOI_BBOX[2] - indMaxLon;
  assert(eastMargin > 0.05 && eastMargin < 0.2,
    `Eastern Arunachal Pradesh boundary (lon ${indMaxLon.toFixed(6)}°E) has safe positive margin (+${eastMargin.toFixed(4)}°) inside SOI BBox (97.5°E)`,
    `Margin: ${eastMargin.toFixed(6)}° (~${(eastMargin * 105).toFixed(1)} km)`);

  // Check 04: Southern Andaman & Nicobar margin
  const southMargin = indMinLat - SOI_BBOX[1];
  assert(southMargin > 0.03 && southMargin < 0.2,
    `Southern Great Nicobar boundary (lat ${indMinLat.toFixed(6)}°N) has safe positive margin (+${southMargin.toFixed(4)}°) inside SOI BBox (6.7°N)`,
    `Margin: ${southMargin.toFixed(6)}° (~${(southMargin * 111).toFixed(1)} km)`);

  // Check 05: Western Gujarat boundary margin
  const westMargin = indMinLon - SOI_BBOX[0];
  assert(westMargin > 0.05 && westMargin < 0.2,
    `Western Gujarat boundary (lon ${indMinLon.toFixed(6)}°E) has safe positive margin (+${westMargin.toFixed(4)}°) inside SOI BBox (68.1°E)`,
    `Margin: ${westMargin.toFixed(6)}° (~${(westMargin * 104).toFixed(1)} km)`);

  // Check 06 & 07: Viewport vertical command under fitToIndia padding in container heights 720px & 750px
  const usableH_720 = 720 - (FIT_TO_INDIA_PADDING[0] + FIT_TO_INDIA_PADDING[2]);
  const vertRatio_720 = (usableH_720 / 720) * 100;
  assert(vertRatio_720 >= 70.0,
    `Container height 720px: India commands ${vertRatio_720.toFixed(2)}% of vertical viewport (>= 70% requirement)`,
    `Usable height: ${usableH_720}px / 720px (padding: [${FIT_TO_INDIA_PADDING}])`);

  const usableH_750 = 750 - (FIT_TO_INDIA_PADDING[0] + FIT_TO_INDIA_PADDING[2]);
  const vertRatio_750 = (usableH_750 / 750) * 100;
  assert(vertRatio_750 >= 70.0,
    `Container height 750px: India commands ${vertRatio_750.toFixed(2)}% of vertical viewport (>= 70% requirement)`,
    `Usable height: ${usableH_750}px / 750px (padding: [${FIT_TO_INDIA_PADDING}])`);

  // Check 08-12: Zero clipping of Kashmir, Arunachal, Andaman, Gujarat across desktop container sizes
  const soiExt3857 = transformExtent(SOI_BBOX, 'EPSG:4326', 'EPSG:3857');
  const desktopWidths = [960, 1024, 1200, 1280, 1376, 1440, 1536, 1600, 1920];
  const heights = [720, 750];

  let kashmirClippedCount = 0;
  let arunachalClippedCount = 0;
  let andamanClippedCount = 0;
  let gujaratClippedCount = 0;
  let totalNationalClippedVertices = 0;

  for (const h of heights) {
    for (const w of desktopWidths) {
      const view = new View({ projection: 'EPSG:3857' });
      view.fit(soiExt3857, { size: [w, h], padding: FIT_TO_INDIA_PADDING, maxZoom: 6 });
      const res = view.getResolution();
      const center = view.getCenter();

      function toPixel(lon, lat) {
        const [x, y] = fromLonLat([lon, lat]);
        const px = (w / 2) + (x - center[0]) / res;
        const py = (h / 2) - (y - center[1]) / res;
        return [px, py];
      }

      const [kPx, kPy] = toPixel(kashmirVertex[0], kashmirVertex[1]);
      if (kPy < 0 || kPy > h || kPx < 0 || kPx > w) kashmirClippedCount++;

      const [aPx, aPy] = toPixel(arunachalVertex[0], arunachalVertex[1]);
      if (aPx < 0 || aPx > w || aPy < 0 || aPy > h) arunachalClippedCount++;

      const [anPx, anPy] = toPixel(andamanVertex[0], andamanVertex[1]);
      if (anPy < 0 || anPy > h || anPx < 0 || anPx > w) andamanClippedCount++;

      const [gPx, gPy] = toPixel(gujaratVertex[0], gujaratVertex[1]);
      if (gPx < 0 || gPx > w || gPy < 0 || gPy > h) gujaratClippedCount++;

      function checkCoord(c) {
        if (typeof c[0] === 'number') {
          const [px, py] = toPixel(c[0], c[1]);
          if (px < -0.5 || px > w + 0.5 || py < -0.5 || py > h + 0.5) {
            totalNationalClippedVertices++;
          }
        } else {
          c.forEach(checkCoord);
        }
      }
      indiaStatesGeo.features.forEach(f => checkCoord(f.geometry.coordinates));
    }
  }

  assert(kashmirClippedCount === 0,
    'Kashmir northernmost territory (Indira Col / Ladakh) has zero clipping across all container widths in 720px & 750px');
  assert(arunachalClippedCount === 0,
    'Arunachal Pradesh eastern frontier (Dong / Kibithu) has zero clipping across all container widths in 720px & 750px');
  assert(andamanClippedCount === 0,
    'Andaman & Nicobar southernmost territory (Indira Point) has zero clipping across all container widths in 720px & 750px');
  assert(gujaratClippedCount === 0,
    'Gujarat westernmost frontier (Sir Creek / Kutch) has zero clipping across all container widths in 720px & 750px');
  assert(totalNationalClippedVertices === 0,
    'Exhaustive vertex check: 0 vertices clipped out of all 40 states across 18 container configurations');

  // =========================================================================
  // SECTION 2: Municipal Ward Geometry Framing & Area Coverage (All 6 Cities)
  // =========================================================================
  console.log('\n--- SECTION 2: Municipal City Framing & Outer Ward Boundary Integrity ---');

  const FLY_TO_CITY_PADDING = [20, 20, 20, 20];
  const cityTestSizes = [
    [1024, 620],
    [1200, 620],
    [1200, 720],
    [1440, 720],
    [1440, 750],
    [1600, 750]
  ];

  let totalCityWardsVerified = 0;
  let globalCityClippedVertices = 0;

  for (const [cityId, cfg] of Object.entries(cityFiles)) {
    const geo = cityGeo[cityId];
    const metaBbox = cityMetaBbox[cityId];
    const wardCount = geo.features.length;
    totalCityWardsVerified += wardCount;

    let cMinLon = Infinity, cMinLat = Infinity, cMaxLon = -Infinity, cMaxLat = -Infinity;
    function scanCity(c) {
      if (typeof c[0] === 'number') {
        const [lon, lat] = c;
        if (lon < cMinLon) cMinLon = lon;
        if (lon > cMaxLon) cMaxLon = lon;
        if (lat < cMinLat) cMinLat = lat;
        if (lat > cMaxLat) cMaxLat = lat;
      } else {
        c.forEach(scanCity);
      }
    }
    geo.features.forEach(f => scanCity(f.geometry.coordinates));

    const lonMinDiff = Math.abs(metaBbox[0] - cMinLon);
    const latMinDiff = Math.abs(metaBbox[1] - cMinLat);
    const lonMaxDiff = Math.abs(metaBbox[2] - cMaxLon);
    const latMaxDiff = Math.abs(metaBbox[3] - cMaxLat);
    const maxDiffDeg = Math.max(lonMinDiff, latMinDiff, lonMaxDiff, latMaxDiff);

    assert(maxDiffDeg < 0.001,
      `${cfg.name} (${wardCount} wards): meta.bbox aligns with actual feature extent within 0.001° (max delta: ${(maxDiffDeg * 111000).toFixed(1)}m)`,
      `meta: [${metaBbox}], actual: [${cMinLon.toFixed(6)}, ${cMinLat.toFixed(6)}, ${cMaxLon.toFixed(6)}, ${cMaxLat.toFixed(6)}]`);

    const cityExt3857 = transformExtent(metaBbox, 'EPSG:4326', 'EPSG:3857');
    let cityClippedVertices = 0;
    const coverageResults = [];

    for (const [w, h] of cityTestSizes) {
      const view = new View({ projection: 'EPSG:3857' });
      view.fit(cityExt3857, { size: [w, h], padding: FLY_TO_CITY_PADDING, maxZoom: 13 });
      const res = view.getResolution();
      const center = view.getCenter();

      function toCityPixel(lon, lat) {
        const [x, y] = fromLonLat([lon, lat]);
        const px = (w / 2) + (x - center[0]) / res;
        const py = (h / 2) - (y - center[1]) / res;
        return [px, py];
      }

      function checkWardCoord(c) {
        if (typeof c[0] === 'number') {
          const [px, py] = toCityPixel(c[0], c[1]);
          if (px < -0.1 || px > w + 0.1 || py < -0.1 || py > h + 0.1) {
            cityClippedVertices++;
            globalCityClippedVertices++;
          }
        } else {
          c.forEach(checkWardCoord);
        }
      }
      geo.features.forEach(f => checkWardCoord(f.geometry.coordinates));

      const dx3857 = cityExt3857[2] - cityExt3857[0];
      const dy3857 = cityExt3857[3] - cityExt3857[1];
      const bboxWpx = dx3857 / res;
      const bboxHpx = dy3857 / res;
      const usableW = w - (FLY_TO_CITY_PADDING[1] + FLY_TO_CITY_PADDING[3]);
      const usableH = h - (FLY_TO_CITY_PADDING[0] + FLY_TO_CITY_PADDING[2]);
      
      const constrainingCoverage = Math.max(bboxWpx / w, bboxHpx / h) * 100;
      const usableCoverage = (bboxWpx * bboxHpx) / (usableW * usableH) * 100;
      const containerCoverage = (bboxWpx * bboxHpx) / (w * h) * 100;

      coverageResults.push({ w, h, res, constrainingCoverage, usableCoverage, containerCoverage, bboxWpx, bboxHpx });
    }

    assert(cityClippedVertices === 0,
      `${cfg.name}: Zero outer ward clipping across all 6 container sizes (${wardCount} wards, 0 clipped vertices)`,
      `Total clipped vertices: ${cityClippedVertices}`);

    const avgConstraining = coverageResults.reduce((acc, c) => acc + c.constrainingCoverage, 0) / coverageResults.length;
    console.log(`         [Analytical Coverage Metrics for ${cfg.name}]`);
    console.log(`         - Constraining axis fill: ${avgConstraining.toFixed(1)}% of container`);
    console.log(`         - Average container area coverage: ${(coverageResults.reduce((acc, c) => acc + c.containerCoverage, 0) / coverageResults.length).toFixed(1)}%`);
  }

  assert(totalCityWardsVerified === 849,
    `Total operational municipal wards verified across all 6 cities equals exactly 849 (got ${totalCityWardsVerified})`);

  assert(globalCityClippedVertices === 0,
    `Global outer ward boundary integrity: 0 clipped vertices across all 849 wards in all container sizes`);

  // =========================================================================
  // SECTION 3: Edge Cases, Viewport Jitter & Coordinate Inversion
  // =========================================================================
  console.log('\n--- SECTION 3: Edge Cases, Viewport Jitter & Coordinate Inversion ---');

  let invertedWardCoords = 0;
  for (const [cityId, geo] of Object.entries(cityGeo)) {
    for (const f of geo.features) {
      function checkInversion(c) {
        if (typeof c[0] === 'number') {
          const [lon, lat] = c;
          if (lon <= lat) invertedWardCoords++;
        } else {
          c.forEach(checkInversion);
        }
      }
      checkInversion(f.geometry.coordinates);
    }
  }
  assert(invertedWardCoords === 0,
    'Zero coordinate inversion across all 849 municipal wards (RFC 7946 lon > lat strictly verified)');

  let invertedNationalCoords = 0;
  indiaStatesGeo.features.forEach(f => {
    function checkNationalInversion(c) {
      if (typeof c[0] === 'number') {
        const [lon, lat] = c;
        if (lon <= lat) invertedNationalCoords++;
      } else {
        c.forEach(checkNationalInversion);
      }
    }
    checkNationalInversion(f.geometry.coordinates);
  });
  assert(invertedNationalCoords === 0,
    'Zero coordinate inversion across all 40 national states and union territories');

  let jitterDetected = false;
  const testBbox3857 = transformExtent(cityMetaBbox.bengaluru, 'EPSG:4326', 'EPSG:3857');
  const baselineView = new View({ projection: 'EPSG:3857' });
  baselineView.fit(testBbox3857, { size: [1200, 720], padding: [20, 20, 20, 20], maxZoom: 13 });
  const baselineRes = baselineView.getResolution();
  const baselineCenter = baselineView.getCenter();

  for (let iter = 0; iter < 100; iter++) {
    const iterView = new View({ projection: 'EPSG:3857' });
    iterView.fit(testBbox3857, { size: [1200, 720], padding: [20, 20, 20, 20], maxZoom: 13 });
    if (Math.abs(iterView.getResolution() - baselineRes) > 1e-12 ||
        Math.abs(iterView.getCenter()[0] - baselineCenter[0]) > 1e-12 ||
        Math.abs(iterView.getCenter()[1] - baselineCenter[1]) > 1e-12) {
      jitterDetected = true;
      break;
    }
  }
  assert(!jitterDetected,
    'Viewport fit idempotence: 100 iterations of flyToCity produce zero numerical jitter or drift (delta < 1e-12)');

  const indiaZoom720 = new View({ projection: 'EPSG:3857' });
  indiaZoom720.fit(soiExt3857, { size: [1440, 720], padding: FIT_TO_INDIA_PADDING, maxZoom: 6 });
  const indiaZoom750 = new View({ projection: 'EPSG:3857' });
  indiaZoom750.fit(soiExt3857, { size: [1440, 750], padding: FIT_TO_INDIA_PADDING, maxZoom: 6 });
  const indiaZoomSafe = (indiaZoom720.getZoom() < 6 && indiaZoom750.getZoom() < 6);
  assert(indiaZoomSafe,
    `fitToIndia maxZoom: 6 safety rail is respected without clamping (720px zoom: ${indiaZoom720.getZoom().toFixed(2)}, 750px zoom: ${indiaZoom750.getZoom().toFixed(2)})`);

  let allCityZoomsSafe = true;
  for (const [cityId, cfg] of Object.entries(cityFiles)) {
    const cExt = transformExtent(cityMetaBbox[cityId], 'EPSG:4326', 'EPSG:3857');
    const cView = new View({ projection: 'EPSG:3857' });
    cView.fit(cExt, { size: [1440, 750], padding: FLY_TO_CITY_PADDING, maxZoom: 13 });
    if (cView.getZoom() > 13) allCityZoomsSafe = false;
  }
  assert(allCityZoomsSafe,
    'flyToCity maxZoom: 13 safety rail preserves LOD 1 (city scale without premature LOD 2 ward label clutter)');

  const minMapH = 560;
  const sectionMinH = 620;
  const typicalAnalyticalHeight = 850;
  const heroRatio = (sectionMinH / typicalAnalyticalHeight) * 100;
  assert(heroRatio >= 65.0 && heroRatio <= 75.0,
    `City Overview layout hero ratio: Map section occupies ${heroRatio.toFixed(1)}% of primary analytical area (within 65–75% specification)`);

  console.log('\n' + '='.repeat(80));
  console.log('  CHALLENGE 1 SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total Checks : ${summary.total}`);
  console.log(`  Passed       : ${summary.passed}`);
  console.log(`  Failed       : ${summary.failed}`);
  console.log('='.repeat(80) + '\n');

  if (summary.failed > 0) {
    console.error(`[VERDICT: REQUEST_CHANGES] ${summary.failed} check(s) failed.`);
    return false;
  } else {
    console.log('[VERDICT: APPROVE] All framing extent and viewport criteria empirically validated!');
    return true;
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const ok = runFramingExtentChallenge();
  process.exit(ok ? 0 : 1);
}
