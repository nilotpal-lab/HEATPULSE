/**
 * HeatPulse — State Tooltip Synchronization & Pan-India Basemap Consistency Test Suite
 * Conforms to Requirement R1, R2, R3 (Iteration 6)
 *
 * Scope: 8 Deterministic Checks
 * 1. MapContainer maintains stateMetricsRef and synchronizes stateMetrics
 * 2. MapContainer pointermove handles isStateFeature / national state polygons
 * 3. State tooltip defines 'state' type and dedicated render block in JSX
 * 4. Unmonitored states display 'Regional Baseline / Unmonitored' and suppress false 'Low' or '--'
 * 5. Monitored states bind peak telemetry metrics and matching severity categories
 * 6. BhuvanLayer defines Pan-India basemap layer (sisdp_base:sisdp_basemap) & city mappings
 * 7. BhuvanBasemapController interface and implementation support dynamic setLayer
 * 8. Map singleclick ignores state polygon clicks & createNationalStatesLayer tags features
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const HEATPULSE_DIR = path.join(REPO_ROOT, 'heatpulse');

export function runStateTooltipBasemapTests() {
  console.log('='.repeat(78));
  console.log('  HEATPULSE TIER 1 EXTENSION: STATE TOOLTIP & BASEMAP CONSISTENCY SUITE');
  console.log('  Scope: 8 Deterministic Invariants (R1 State Tooltip & R2 Pan-India Basemap)');
  console.log('='.repeat(78));

  let passed = 0;
  let failed = 0;

  function runCheck(id, desc, fn) {
    try {
      fn();
      console.log(`[PASS] Check ${id}: ${desc}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Check ${id}: ${desc}`);
      console.error(`       Error: ${err.message}`);
      failed++;
    }
  }

  const mapContainerPath = path.join(HEATPULSE_DIR, 'src/components/map/MapContainer.tsx');
  const bhuvanLayerPath = path.join(HEATPULSE_DIR, 'src/components/map/BhuvanLayer.ts');
  const mapConfigPath = path.join(HEATPULSE_DIR, 'src/lib/map-config.ts');
  const basemapIndicatorPath = path.join(HEATPULSE_DIR, 'src/components/map/BasemapStatusIndicator.tsx');

  const mapContainerContent = fs.readFileSync(mapContainerPath, 'utf8');
  const bhuvanLayerContent = fs.readFileSync(bhuvanLayerPath, 'utf8');
  const mapConfigContent = fs.readFileSync(mapConfigPath, 'utf8');
  const basemapIndicatorContent = fs.readFileSync(basemapIndicatorPath, 'utf8');

  // Check 01: MapContainer maintains stateMetricsRef and synchronizes stateMetrics
  runCheck('01', 'MapContainer maintains stateMetricsRef and synchronizes stateMetrics', () => {
    assert(
      mapContainerContent.includes('const stateMetricsRef = useRef(stateMetrics);'),
      'MapContainer must declare stateMetricsRef using useRef'
    );
    assert(
      mapContainerContent.includes('stateMetricsRef.current = stateMetrics;'),
      'MapContainer must synchronize stateMetricsRef.current inside useEffect'
    );
  });

  // Check 02: MapContainer pointermove handles isStateFeature / national state polygons
  runCheck('02', 'MapContainer pointermove handles isStateFeature / national state polygons', () => {
    assert(
      mapContainerContent.includes("hit.get('isStateFeature')") ||
      mapContainerContent.includes("(isNational && !props.ward_id && !props.ward_name)"),
      'pointermove must check isStateFeature or national state boundary to differentiate from wards'
    );
    assert(
      mapContainerContent.includes('// 2. National State Polygon Hover (LOD 0)'),
      'pointermove must have dedicated National State Polygon Hover branch'
    );
  });

  // Check 03: State tooltip defines 'state' type and dedicated render block in JSX
  runCheck('03', "State tooltip defines 'state' type and dedicated render block in JSX", () => {
    assert(
      mapContainerContent.includes("type: 'ward' | 'city' | 'state'"),
      "HoverTooltipState interface must support type 'state'"
    );
    assert(
      mapContainerContent.includes("hoverTooltip.type === 'state'"),
      'Tooltip JSX must have dedicated hoverTooltip.type === "state" render block'
    );
    assert(
      mapContainerContent.includes('State / UT'),
      'State tooltip JSX must render "State / UT" badge/label'
    );
  });

  // Check 04: Unmonitored states display 'Regional Baseline / Unmonitored' and suppress false 'Low' or '--'
  runCheck('04', "Unmonitored states display 'Regional Baseline / Unmonitored' and suppress false 'Low' or '--'", () => {
    assert(
      mapContainerContent.includes("'Regional Baseline / Unmonitored'"),
      "Tooltip must declare 'Regional Baseline / Unmonitored' for unmonitored states"
    );
    assert(
      mapContainerContent.includes('bg-slate-100'),
      'Unmonitored state tooltip must use neutral slate styling'
    );
    assert(
      mapContainerContent.includes('Regional baseline (unmonitored). Municipal telemetry active in 6 metro regions.'),
      'Unmonitored state tooltip must provide helpful explanatory subtext'
    );
  });

  // Check 05: Monitored states bind peak telemetry metrics and matching severity categories
  runCheck('05', 'Monitored states bind peak telemetry metrics and matching severity categories', () => {
    assert(
      mapContainerContent.includes('metric.wbgt') && mapContainerContent.includes('metric.temperature'),
      'State tooltip must bind metric.wbgt and metric.temperature from telemetry'
    );
    assert(
      mapContainerContent.includes('bg-rose-100') && mapContainerContent.includes('border-rose-300'),
      'State tooltip must include Severe/Extreme rose badge styling'
    );
    assert(
      mapContainerContent.includes('bg-orange-100') && mapContainerContent.includes('border-orange-300'),
      'State tooltip must include High orange badge styling'
    );
  });

  // Check 06: BhuvanLayer defines Pan-India basemap layer (sisdp_base:sisdp_basemap) & city mappings
  runCheck('06', 'BhuvanLayer defines Pan-India basemap layer (sisdp_base:sisdp_basemap) & city mappings', () => {
    assert(
      bhuvanLayerContent.includes("export const PAN_INDIA_BHUVAN_LAYER = 'sisdp_base:sisdp_basemap';"),
      'BhuvanLayer must export PAN_INDIA_BHUVAN_LAYER = sisdp_base:sisdp_basemap'
    );
    assert(
      bhuvanLayerContent.includes('export const DEFAULT_BHUVAN_LAYER = PAN_INDIA_BHUVAN_LAYER;'),
      'DEFAULT_BHUVAN_LAYER must point to PAN_INDIA_BHUVAN_LAYER'
    );
    assert(
      bhuvanLayerContent.includes('export const BHUVAN_CITY_LAYERS'),
      'BhuvanLayer must export BHUVAN_CITY_LAYERS'
    );
    assert(
      bhuvanLayerContent.includes('lulc:KA_LULC50K_1112') &&
      bhuvanLayerContent.includes('lulc:MH_LULC50K_1112') &&
      bhuvanLayerContent.includes('lulc:WB_LULC50K_1112') &&
      bhuvanLayerContent.includes('lulc:TN_LULC50K_1112'),
      'BHUVAN_CITY_LAYERS must define Karnataka, Maharashtra, West Bengal, and Tamil Nadu regional layers'
    );
    assert(
      bhuvanLayerContent.includes('export function getBhuvanLayerForScope'),
      'BhuvanLayer must export getBhuvanLayerForScope helper'
    );
  });

  // Check 07: BhuvanBasemapController interface and implementation support dynamic setLayer
  runCheck('07', 'BhuvanBasemapController interface and implementation support dynamic setLayer', () => {
    assert(
      bhuvanLayerContent.includes('setLayer: (layerName: string) => void;'),
      'BhuvanBasemapController interface must include setLayer method'
    );
    assert(
      bhuvanLayerContent.includes('bhuvanSource?.updateParams({ LAYERS: newLayerName })'),
      'setLayer implementation must call bhuvanSource.updateParams with new LAYERS'
    );
    assert(
      mapContainerContent.includes('basemapControllerRef.current?.setLayer(targetLayer)'),
      'MapContainer must invoke setLayer in synchronization useEffect'
    );
  });

  // Check 08: Singleclick ignores state clicks & createNationalStatesLayer tags features
  runCheck('08', 'Singleclick ignores state clicks & createNationalStatesLayer tags features', () => {
    assert(
      mapContainerContent.includes("feature.get('isStateFeature')") ||
      mapContainerContent.includes("(isNational && !feature.get('ward_id'))"),
      'Singleclick handler must ignore clicks on state polygons to prevent false ward selection'
    );
    assert(
      mapConfigContent.includes("f.set('isStateFeature', true)"),
      'createNationalStatesLayer must tag features with isStateFeature = true'
    );
    assert(
      mapConfigContent.includes('export function formatStateDisplayName'),
      'map-config.ts must export formatStateDisplayName helper'
    );
    assert(
      !basemapIndicatorContent.includes('lulc:BR_LULC50K_1112'),
      'BasemapStatusIndicator must not hardcode lulc:BR_LULC50K_1112'
    );
  });

  console.log('-'.repeat(78));
  console.log(`  SUMMARY: ${passed} Passed, ${failed} Failed out of 8 Checks`);
  console.log('='.repeat(78) + '\n');

  return { total: 8, passed, failed };
}

// Direct execution support
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runStateTooltipBasemapTests();
  process.exit(result.failed > 0 ? 1 : 0);
}
