/**
 * HeatPulse — Challenger 2 Basemap & Fallback Empirical Adversarial Stress Suite
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 * 
 * Scope:
 * 1. Pan-India Basemap Consistency:
 *    - PAN_INDIA_BHUVAN_LAYER = 'sisdp_base:sisdp_basemap'
 *    - Default layer binding & scope handling (isNational === true)
 * 2. Multi-City LULC Mapping & Edge Cases:
 *    - All 6 monitored cities (bengaluru, pune, mumbai, kolkata, chennai, coimbatore)
 *    - Case-insensitivity & unknown/undefined fallbacks
 * 3. Backward Compatibility:
 *    - LEGACY_BHUVAN_LAYER = 'lulc:BR_LULC50K_1112'
 * 4. Basemap Controller State Machine & Fallback Triggering:
 *    - Initial state: bhuvan_active
 *    - Progressive error accumulation & threshold trigger (tileloaderror)
 *    - Visibility inversion (bhuvanLayer false, osmLayer true)
 *    - Explicit fallback (switchToFallback)
 *    - Retry & state restoration (retryBhuvan)
 *    - Post-retry re-failure resilience
 *    - Dynamic layer switching (setLayer)
 *    - Timeout-based fallback trigger (tileloadstart -> timeoutMs)
 *    - Timeout cancellation on success (tileloadstart -> tileloadend)
 * 5. Map & LOD Integration:
 *    - initMap layer stack ordering (Bhuvan layer 0, OSM layer 1)
 *    - Controller binding to map instance
 *    - State polygon interaction isolation
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Suppress .css imports for Node runtime before requiring OpenLayers config
require.extensions['.css'] = () => {};

// Minimal DOM mock for OpenLayers controls in headless Node environment
if (typeof (global as any).document === 'undefined') {
  const createMockElement = (tag: string) => {
    const el: any = {
      tagName: tag.toUpperCase(),
      style: {},
      className: '',
      offsetWidth: 1000,
      offsetHeight: 800,
      clientWidth: 1000,
      clientHeight: 800,
      appendChild: () => {},
      insertBefore: () => {},
      removeChild: () => {},
      remove: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      getRootNode: () => (global as any).document,
      childNodes: [],
      title: '',
      type: '',
      innerHTML: '',
    };
    el.ownerDocument = (global as any).document;
    return el;
  };
  (global as any).document = {
    createElement: createMockElement,
    createTextNode: (text: string) => ({ textContent: text, nodeType: 3 }),
    getElementById: () => createMockElement('div'),
    addEventListener: () => {},
    removeEventListener: () => {},
    body: createMockElement('body'),
    head: createMockElement('head'),
    documentElement: createMockElement('html'),
  };
}

if (typeof (global as any).window === 'undefined') {
  (global as any).window = global;
  (global as any).window.addEventListener = () => {};
  (global as any).window.removeEventListener = () => {};
  (global as any).window.devicePixelRatio = 1;
  (global as any).window.requestAnimationFrame = (cb: Function) => setTimeout(cb, 0);
  (global as any).window.cancelAnimationFrame = (id: any) => clearTimeout(id);
}

const mockComputedStyle = () => ({
  getPropertyValue: () => '0px',
  width: '1000px',
  height: '800px',
  borderLeftWidth: '0px',
  borderRightWidth: '0px',
  borderTopWidth: '0px',
  borderBottomWidth: '0px',
  paddingLeft: '0px',
  paddingRight: '0px',
  paddingTop: '0px',
  paddingBottom: '0px',
  boxSizing: 'content-box',
});
(global as any).getComputedStyle = mockComputedStyle;
(global as any).window.getComputedStyle = mockComputedStyle;

if (typeof (global as any).ResizeObserver === 'undefined') {
  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof (global as any).ShadowRoot === 'undefined') {
  (global as any).ShadowRoot = class {};
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const HEATPULSE_DIR = path.join(REPO_ROOT, 'heatpulse');

// Import BhuvanLayer directly
const {
  PAN_INDIA_BHUVAN_LAYER,
  DEFAULT_BHUVAN_LAYER,
  LEGACY_BHUVAN_LAYER,
  BHUVAN_CITY_LAYERS,
  getBhuvanLayerForScope,
  createBhuvanBasemapController,
  createBhuvanLayer,
  createOsmFallbackLayer,
  DEFAULT_BHUVAN_WMS_URL,
} = require(path.join(HEATPULSE_DIR, 'src/components/map/BhuvanLayer'));

// Import map-config using require after css suppressor
const {
  initMap,
  BHUVAN_DEFAULT_LAYER,
  BHUVAN_WMS_URL,
  createNationalStatesLayer,
} = require(path.join(HEATPULSE_DIR, 'src/lib/map-config'));

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const failures: string[] = [];

function testAssert(condition: boolean, testId: string, description: string, details?: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  [PASS] #${String(totalChecks).padStart(3, '0')} [${testId}]: ${description}`);
  } else {
    failedChecks++;
    const errMsg = `FAIL #${String(totalChecks).padStart(3, '0')} [${testId}]: ${description}${details ? ` -> ${details}` : ''}`;
    failures.push(errMsg);
    console.error(`  [FAIL] #${String(totalChecks).padStart(3, '0')} [${testId}]: ${description}`);
    if (details) console.error(`         Detail: ${details}`);
  }
}

async function runBasemapFallbackAdversarialSuite() {
  console.log('='.repeat(80));
  console.log('  CHALLENGER 2: BASEMAP & FALLBACK EMPIRICAL ADVERSARIAL STRESS SUITE');
  console.log('  Testing Bhuvan Layer Consistency, Multi-City LULC, Tile Error Fallback & Controller');
  console.log('='.repeat(80) + '\n');

  // =========================================================================
  // SECTION 1: Pan-India Basemap Constants & Consistency
  // =========================================================================
  console.log('--- [SECTION 1] Pan-India Basemap Constants & Consistency ---');

  testAssert(
    PAN_INDIA_BHUVAN_LAYER === 'sisdp_base:sisdp_basemap',
    'PAN-01',
    "PAN_INDIA_BHUVAN_LAYER must strictly equal 'sisdp_base:sisdp_basemap'",
    `Actual: ${PAN_INDIA_BHUVAN_LAYER}`
  );

  testAssert(
    DEFAULT_BHUVAN_LAYER === PAN_INDIA_BHUVAN_LAYER,
    'PAN-02',
    'DEFAULT_BHUVAN_LAYER must point to PAN_INDIA_BHUVAN_LAYER',
    `Actual: ${DEFAULT_BHUVAN_LAYER}`
  );

  testAssert(
    BHUVAN_DEFAULT_LAYER === PAN_INDIA_BHUVAN_LAYER,
    'PAN-03',
    'BHUVAN_DEFAULT_LAYER in map-config must re-export PAN_INDIA_BHUVAN_LAYER',
    `Actual: ${BHUVAN_DEFAULT_LAYER}`
  );

  testAssert(
    LEGACY_BHUVAN_LAYER === 'lulc:BR_LULC50K_1112',
    'PAN-04',
    "LEGACY_BHUVAN_LAYER must strictly equal 'lulc:BR_LULC50K_1112' for backward compatibility",
    `Actual: ${LEGACY_BHUVAN_LAYER}`
  );

  testAssert(
    getBhuvanLayerForScope(true) === 'sisdp_base:sisdp_basemap',
    'PAN-05',
    "getBhuvanLayerForScope(true) must return 'sisdp_base:sisdp_basemap' for national scale",
    `Actual: ${getBhuvanLayerForScope(true)}`
  );

  testAssert(
    getBhuvanLayerForScope(true, 'bengaluru') === 'sisdp_base:sisdp_basemap',
    'PAN-06',
    'National scope override must prevail even if cityId is passed',
    `Actual: ${getBhuvanLayerForScope(true, 'bengaluru')}`
  );

  testAssert(
    getBhuvanLayerForScope(true, 'mumbai') === 'sisdp_base:sisdp_basemap',
    'PAN-07',
    'National scope override must prevail for Mumbai',
    `Actual: ${getBhuvanLayerForScope(true, 'mumbai')}`
  );

  // =========================================================================
  // SECTION 2: Monitored City LULC Mapping & Scope Resolution
  // =========================================================================
  console.log('\n--- [SECTION 2] Monitored City LULC Mapping & Scope Resolution ---');

  const expectedCityMappings: Record<string, string> = {
    bengaluru: 'lulc:KA_LULC50K_1112',
    pune: 'lulc:MH_LULC50K_1112',
    mumbai: 'lulc:MH_LULC50K_1112',
    kolkata: 'lulc:WB_LULC50K_1112',
    chennai: 'lulc:TN_LULC50K_1112',
    coimbatore: 'lulc:TN_LULC50K_1112',
  };

  for (const [city, expectedLayer] of Object.entries(expectedCityMappings)) {
    const directLookup = BHUVAN_CITY_LAYERS[city];
    testAssert(
      directLookup === expectedLayer,
      `CITY-MAP-${city.toUpperCase()}`,
      `BHUVAN_CITY_LAYERS['${city}'] must map to '${expectedLayer}'`,
      `Actual: ${directLookup}`
    );

    const scopeResolved = getBhuvanLayerForScope(false, city);
    testAssert(
      scopeResolved === expectedLayer,
      `SCOPE-${city.toUpperCase()}`,
      `getBhuvanLayerForScope(false, '${city}') must resolve to '${expectedLayer}'`,
      `Actual: ${scopeResolved}`
    );

    // Case-insensitivity test
    const upperScopeResolved = getBhuvanLayerForScope(false, city.toUpperCase());
    testAssert(
      upperScopeResolved === expectedLayer,
      `CASE-${city.toUpperCase()}`,
      `getBhuvanLayerForScope(false, '${city.toUpperCase()}') must resolve case-insensitively`,
      `Actual: ${upperScopeResolved}`
    );
  }

  // Edge cases for scope resolution
  testAssert(
    getBhuvanLayerForScope(false, undefined) === 'sisdp_base:sisdp_basemap',
    'EDGE-UNDEF',
    'getBhuvanLayerForScope with undefined cityId must fallback to PAN_INDIA_BHUVAN_LAYER',
    `Actual: ${getBhuvanLayerForScope(false, undefined)}`
  );

  testAssert(
    getBhuvanLayerForScope(false, '') === 'sisdp_base:sisdp_basemap',
    'EDGE-EMPTY',
    'getBhuvanLayerForScope with empty cityId must fallback to PAN_INDIA_BHUVAN_LAYER',
    `Actual: ${getBhuvanLayerForScope(false, '')}`
  );

  testAssert(
    getBhuvanLayerForScope(false, 'unknown_metro') === 'sisdp_base:sisdp_basemap',
    'EDGE-UNKNOWN',
    'getBhuvanLayerForScope with unknown cityId must fallback to PAN_INDIA_BHUVAN_LAYER',
    `Actual: ${getBhuvanLayerForScope(false, 'unknown_metro')}`
  );

  testAssert(
    getBhuvanLayerForScope(undefined, undefined) === 'sisdp_base:sisdp_basemap',
    'EDGE-ALL-UNDEF',
    'getBhuvanLayerForScope with both args undefined must fallback to PAN_INDIA_BHUVAN_LAYER',
    `Actual: ${getBhuvanLayerForScope(undefined, undefined)}`
  );

  // =========================================================================
  // SECTION 3: Basemap Controller Lifecycle, Tile Error Fallback & Recovery
  // =========================================================================
  console.log('\n--- [SECTION 3] Basemap Controller Lifecycle, Tile Error Fallback & Recovery ---');

  let lastReportedStatus = '';
  let lastReportedMessage = '';
  const controller = createBhuvanBasemapController({
    layerName: 'sisdp_base:sisdp_basemap',
    errorThreshold: 3,
    timeoutMs: 1000,
    onStatusChange: (status: string, message?: string) => {
      lastReportedStatus = status;
      if (message) lastReportedMessage = message;
    },
  });

  testAssert(
    controller.getStatus() === 'bhuvan_active',
    'CTRL-INIT-01',
    "Initial status must be 'bhuvan_active'",
    `Actual: ${controller.getStatus()}`
  );

  testAssert(
    controller.bhuvanLayer.getVisible() === true,
    'CTRL-INIT-02',
    'bhuvanLayer must initially be visible (true)',
    `Actual: ${controller.bhuvanLayer.getVisible()}`
  );

  testAssert(
    controller.osmLayer.getVisible() === false,
    'CTRL-INIT-03',
    'osmLayer must initially be hidden (false)',
    `Actual: ${controller.osmLayer.getVisible()}`
  );

  testAssert(
    lastReportedStatus === 'bhuvan_active',
    'CTRL-INIT-04',
    "onStatusChange must receive initial 'bhuvan_active' event",
    `Actual: ${lastReportedStatus}`
  );

  // Test setOpacity
  controller.setOpacity(0.65);
  testAssert(
    controller.bhuvanLayer.getOpacity() === 0.65 && controller.osmLayer.getOpacity() === 0.65,
    'CTRL-OPACITY',
    'setOpacity must synchronize opacity across both Bhuvan and OSM layers (0.65)',
    `Bhuvan: ${controller.bhuvanLayer.getOpacity()}, OSM: ${controller.osmLayer.getOpacity()}`
  );

  // Test setLayer dynamic param update
  controller.setLayer('lulc:KA_LULC50K_1112');
  const bhuvanSource = controller.bhuvanLayer.getSource();
  const sourceParams = bhuvanSource?.getParams();
  testAssert(
    sourceParams?.LAYERS === 'lulc:KA_LULC50K_1112',
    'CTRL-SETLAYER-01',
    "setLayer must update WMS params LAYERS to 'lulc:KA_LULC50K_1112'",
    `Actual: ${sourceParams?.LAYERS}`
  );
  testAssert(
    lastReportedMessage.includes('lulc:KA_LULC50K_1112'),
    'CTRL-SETLAYER-02',
    'setLayer must update status message with new layer name',
    `Message: ${lastReportedMessage}`
  );

  // Test tile load error threshold triggering
  console.log('\n  ... Simulating tileloaderror events ...');
  // Error 1
  bhuvanSource?.dispatchEvent('tileloaderror');
  testAssert(
    controller.getStatus() === 'bhuvan_active' && controller.bhuvanLayer.getVisible() === true,
    'ERR-TOLERANCE-1',
    '1st tileloaderror must not trigger fallback (under threshold 3)'
  );

  // Error 2
  bhuvanSource?.dispatchEvent('tileloaderror');
  testAssert(
    controller.getStatus() === 'bhuvan_active' && controller.bhuvanLayer.getVisible() === true,
    'ERR-TOLERANCE-2',
    '2nd tileloaderror must not trigger fallback (under threshold 3)'
  );

  // Error 3 (triggers threshold)
  bhuvanSource?.dispatchEvent('tileloaderror');
  testAssert(
    controller.getStatus() === 'osm_fallback',
    'ERR-FALLBACK-STATUS',
    "3rd tileloaderror must trigger transition to 'osm_fallback'",
    `Actual: ${controller.getStatus()}`
  );
  testAssert(
    controller.bhuvanLayer.getVisible() === false,
    'ERR-FALLBACK-BHUVAN-HIDDEN',
    'bhuvanLayer must be hidden (false) after fallback',
    `Actual: ${controller.bhuvanLayer.getVisible()}`
  );
  testAssert(
    controller.osmLayer.getVisible() === true,
    'ERR-FALLBACK-OSM-VISIBLE',
    'osmLayer must be visible (true) after fallback',
    `Actual: ${controller.osmLayer.getVisible()}`
  );
  testAssert(
    lastReportedStatus === 'osm_fallback',
    'ERR-FALLBACK-LISTENER',
    "onStatusChange must be notified of 'osm_fallback'",
    `Actual: ${lastReportedStatus}`
  );

  // Additional errors while in fallback must not throw or crash
  bhuvanSource?.dispatchEvent('tileloaderror');
  testAssert(
    controller.getStatus() === 'osm_fallback',
    'ERR-IDEMPOTENT',
    'Subsequent errors in fallback mode must maintain stable state without regression'
  );

  // Test retryBhuvan recovery
  console.log('\n  ... Testing retryBhuvan() recovery ...');
  controller.retryBhuvan();
  testAssert(
    controller.getStatus() === 'bhuvan_active',
    'RETRY-STATUS',
    "retryBhuvan must reset status to 'bhuvan_active'",
    `Actual: ${controller.getStatus()}`
  );
  testAssert(
    controller.bhuvanLayer.getVisible() === true,
    'RETRY-BHUVAN-VISIBLE',
    'retryBhuvan must restore bhuvanLayer visibility to true',
    `Actual: ${controller.bhuvanLayer.getVisible()}`
  );
  testAssert(
    controller.osmLayer.getVisible() === false,
    'RETRY-OSM-HIDDEN',
    'retryBhuvan must hide osmLayer (false)',
    `Actual: ${controller.osmLayer.getVisible()}`
  );

  // Verify post-retry error counter reset: 3 new errors trigger fallback again
  bhuvanSource?.dispatchEvent('tileloaderror');
  bhuvanSource?.dispatchEvent('tileloaderror');
  testAssert(
    controller.getStatus() === 'bhuvan_active',
    'POST-RETRY-RESET-1',
    'Post-retry error counter was reset; 2 errors do not trigger fallback'
  );
  bhuvanSource?.dispatchEvent('tileloaderror');
  testAssert(
    controller.getStatus() === 'osm_fallback',
    'POST-RETRY-RESET-2',
    'Post-retry 3rd error successfully triggers fallback again'
  );

  // Test explicit switchToFallback
  controller.retryBhuvan();
  controller.switchToFallback('Manual user toggle');
  testAssert(
    controller.getStatus() === 'osm_fallback' && controller.osmLayer.getVisible() === true,
    'EXPLICIT-FALLBACK',
    'switchToFallback must immediately switch to osm_fallback and show OSM layer'
  );

  controller.dispose();

  // =========================================================================
  // SECTION 4: Timeout Trigger & Cancellation Verification
  // =========================================================================
  console.log('\n--- [SECTION 4] Timeout Fallback Trigger & Cancellation ---');

  // 1. Timeout triggers fallback when no tiles load
  const timeoutCtrl = createBhuvanBasemapController({
    timeoutMs: 60,
    errorThreshold: 5,
  });
  const timeoutSrc = timeoutCtrl.bhuvanLayer.getSource();
  timeoutSrc?.dispatchEvent('tileloadstart');

  await new Promise((res) => setTimeout(res, 120));

  testAssert(
    timeoutCtrl.getStatus() === 'osm_fallback' && timeoutCtrl.osmLayer.getVisible() === true,
    'TIMEOUT-TRIGGER',
    'Timeout without tileloadend must trigger osm_fallback',
    `Actual: ${timeoutCtrl.getStatus()}`
  );
  timeoutCtrl.dispose();

  // 2. Tileloadend cancels timeout
  const successCtrl = createBhuvanBasemapController({
    timeoutMs: 100,
    errorThreshold: 5,
  });
  const successSrc = successCtrl.bhuvanLayer.getSource();
  successSrc?.dispatchEvent('tileloadstart');
  // Successful tile arrives at 30ms (before 100ms timeout)
  await new Promise((res) => setTimeout(res, 30));
  successSrc?.dispatchEvent('tileloadend');

  // Wait past the 100ms timeout window
  await new Promise((res) => setTimeout(res, 120));

  testAssert(
    successCtrl.getStatus() === 'bhuvan_active' && successCtrl.bhuvanLayer.getVisible() === true,
    'TIMEOUT-CANCELLED',
    'tileloadend must cancel the timeout and preserve bhuvan_active status',
    `Actual: ${successCtrl.getStatus()}`
  );
  successCtrl.dispose();

  // =========================================================================
  // SECTION 5: OpenLayers Map Integration & Layer Stack Hierarchy
  // =========================================================================
  console.log('\n--- [SECTION 5] OpenLayers Map Integration & Layer Stack Hierarchy ---');

  // Create virtual map instance to check layer stack order
  const dummyContainer = typeof document !== 'undefined' ? document.createElement('div') : 'map-dummy';
  const integratedCtrl = createBhuvanBasemapController({
    layerName: PAN_INDIA_BHUVAN_LAYER,
  });

  const mapInstance = initMap(dummyContainer, {
    initialCenter: [78.9629, 20.5937],
    initialZoom: 5,
    bhuvanController: integratedCtrl,
  });

  const mapLayers = mapInstance.getLayers().getArray();
  testAssert(
    mapLayers.length >= 2,
    'MAP-LAYER-COUNT',
    'Map must initialize with at least basemap layers',
    `Total layers: ${mapLayers.length}`
  );

  testAssert(
    mapLayers[0] === integratedCtrl.bhuvanLayer,
    'MAP-STACK-BHUVAN',
    'Layer 0 (bottom of stack) must be Bhuvan TileLayer',
    `Layer 0 id: ${mapLayers[0]?.get('id')}`
  );

  testAssert(
    mapLayers[1] === integratedCtrl.osmLayer,
    'MAP-STACK-OSM',
    'Layer 1 must be OSM TileLayer (fallback reserve)',
    `Layer 1 id: ${mapLayers[1]?.get('id')}`
  );

  testAssert(
    mapInstance.get('basemapController') === integratedCtrl,
    'MAP-CONTROLLER-PROP',
    "map.get('basemapController') must return the active BhuvanBasemapController"
  );

  // Test createNationalStatesLayer feature tagging
  const statesGeoJsonPath = path.join(HEATPULSE_DIR, 'public/data/processed/geojson/india-states.geojson');
  const statesRaw = JSON.parse(fs.readFileSync(statesGeoJsonPath, 'utf8'));
  const statesLayer = createNationalStatesLayer(statesRaw, {});
  const stateFeatures = statesLayer.getSource()?.getFeatures() || [];

  testAssert(
    stateFeatures.length > 0,
    'STATES-FEATURE-COUNT',
    'National states layer must parse features from india-states.geojson',
    `Feature count: ${stateFeatures.length}`
  );

  const sampleState = stateFeatures[0];
  testAssert(
    sampleState.get('isStateFeature') === true,
    'STATE-TAG-FEATURE',
    "National state features must be tagged with isStateFeature = true to prevent false ward clicks"
  );

  mapInstance.dispose();
  integratedCtrl.dispose();

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  console.log('  CHALLENGER 2 ADVERSARIAL STRESS TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total Checks : ${totalChecks}`);
  console.log(`  Passed       : ${passedChecks}`);
  console.log(`  Failed       : ${failedChecks}`);
  console.log(`  Success Rate : ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);
  console.log('='.repeat(80) + '\n');

  if (failedChecks > 0) {
    console.error(`[FAIL] ${failedChecks} checks failed:`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('[SUCCESS] All basemap and fallback empirical checks passed 100%!\n');
    process.exit(0);
  }
}

runBasemapFallbackAdversarialSuite().catch((err) => {
  console.error('Unhandled error in stress suite:', err);
  process.exit(1);
});
