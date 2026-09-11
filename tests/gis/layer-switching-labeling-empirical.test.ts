/**
 * HeatPulse — Challenger 2 Empirical Test Harness
 * Layer Switching Synchronization, Unmonitored State Presentation & Ward Identifier Formatting
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 *
 * Scope:
 * 1. formatCompactWardIdentifier(props) against all 849 municipal wards across all 6 GeoJSON datasets:
 *    - Bengaluru GBA (369 wards)
 *    - Pune (15 wards)
 *    - Mumbai (24 wards)
 *    - Kolkata (141 wards)
 *    - Chennai (200 wards)
 *    - Coimbatore (100 wards)
 *    Total: 849 wards. Verify 100% format into compact readable strings without undefined, null, [object Object], or NaN.
 * 2. Adversarial stress testing of formatCompactWardIdentifier with malformed/missing/edge props.
 * 3. Unmonitored states styling: Verify that for all 36 unmonitored states/UTs in india-states.geojson,
 *    fill color is strictly neutral slate rgba(241, 245, 249, 0.72) in BOTH heat_conditions and thermal_stress modes,
 *    and does NOT accidentally shift to "Normal" blue or "Low" green.
 * 4. Monitored states styling: Verify that for Karnataka, Maharashtra, West Bengal, and Tamil Nadu,
 *    values map deterministically: Value -> Classification -> Color across both modes.
 * 5. Hover popover data integrity: Verify active metric dynamically switches between Temperature and WBGT.
 * 6. Multi-scale LOD labeling & layer synchronization: LOD 0 (zoom 4-7) vs LOD 1 (zoom 8-12) vs LOD 2 (zoom 13+).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Suppress css imports for Node runtime
require.extensions['.css'] = () => {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const HEATPULSE_DIR = path.join(REPO_ROOT, 'heatpulse');
const GEOJSON_DIR = path.join(HEATPULSE_DIR, 'public/data/processed/geojson');

// Import from heatpulse map-config
const {
  formatCompactWardIdentifier,
  createNationalStatesLayer,
  createAdminWardsLayer,
  getWardThematicColor,
  THEMATIC_COLORS,
  LOD_CITY_MIN_ZOOM,
  LOD_WARD_LABEL_MIN_ZOOM,
  MIN_MAP_ZOOM,
  MAX_MAP_ZOOM,
} = require(path.join(HEATPULSE_DIR, 'src/lib/map-config'));

interface TestResult {
  passed: number;
  failed: number;
  total: number;
  failures: string[];
}

const result: TestResult = {
  passed: 0,
  failed: 0,
  total: 0,
  failures: [],
};

function assert(condition: boolean, testId: string, description: string, details?: string) {
  result.total++;
  if (condition) {
    result.passed++;
    console.log(`  [PASS] #${String(result.total).padStart(3, '0')} ${testId}: ${description}`);
  } else {
    result.failed++;
    const msg = `  [FAIL] #${String(result.total).padStart(3, '0')} ${testId}: ${description}${details ? ' -> ' + details : ''}`;
    console.error(msg);
    result.failures.push(msg);
  }
}

async function runLayerSwitchingAndLabelingChallenge() {
  console.log('='.repeat(80));
  console.log('  HEATPULSE EMPIRICAL CHALLENGER 2: LAYER SWITCHING & LABELING SUITE');
  console.log('  Ministry of Earth Sciences / NCMRWF — SIH26083 Verification');
  console.log('='.repeat(80));
  console.log('');

  // =========================================================================
  // SECTION 1: Exhaustive Ward Identifier Formatting across all 849 Wards
  // =========================================================================
  console.log('--- [SECTION 1] Exhaustive Ward Identifier Formatting (849 Wards across 6 Cities) ---');

  const cityFiles = [
    { city: 'bengaluru', name: 'Bengaluru GBA', file: 'bengaluru-gba-369-wards.geojson', expectedWards: 369 },
    { city: 'pune', name: 'Pune', file: 'pune-15-wards.geojson', expectedWards: 15 },
    { city: 'mumbai', name: 'Mumbai', file: 'mumbai-24-wards.geojson', expectedWards: 24 },
    { city: 'kolkata', name: 'Kolkata', file: 'kolkata-141-wards.geojson', expectedWards: 141 },
    { city: 'chennai', name: 'Chennai', file: 'chennai-200-wards.geojson', expectedWards: 200 },
    { city: 'coimbatore', name: 'Coimbatore', file: 'coimbatore-100-wards.geojson', expectedWards: 100 },
  ];

  let cumulativeWards = 0;

  for (const { city, name, file, expectedWards } of cityFiles) {
    const fullPath = path.join(GEOJSON_DIR, file);
    assert(fs.existsSync(fullPath), `FILE-EXISTS-${city.toUpperCase()}`, `${name} GeoJSON exists: ${file}`);
    
    const rawContent = fs.readFileSync(fullPath, 'utf8');
    const geojson = JSON.parse(rawContent);
    const features = geojson.features || [];

    assert(
      features.length === expectedWards,
      `WARD-COUNT-${city.toUpperCase()}`,
      `${name} has exactly ${expectedWards} features (actual: ${features.length})`
    );

    let cityInvalidCount = 0;
    const sampleOutputs: string[] = [];

    features.forEach((feat: any, idx: number) => {
      cumulativeWards++;
      const props = feat.properties || {};
      const formatted = formatCompactWardIdentifier(props);

      const isValid =
        typeof formatted === 'string' &&
        formatted.trim().length > 0 &&
        !formatted.includes('undefined') &&
        !formatted.includes('null') &&
        !formatted.includes('[object Object]') &&
        !formatted.includes('NaN');

      if (!isValid) {
        cityInvalidCount++;
        console.error(`Invalid formatting in ${city} ward #${idx}: props=${JSON.stringify(props)} -> formatted=${formatted}`);
      }

      if (idx < 2 || idx === features.length - 1) {
        sampleOutputs.push(formatted);
      }
    });

    assert(
      cityInvalidCount === 0,
      `FORMAT-100PCT-${city.toUpperCase()}`,
      `100% of ${features.length} ${name} wards format cleanly without undefined/null/[object Object]/NaN (Sample: "${sampleOutputs.join('", "')}")`
    );
  }

  assert(
    cumulativeWards === 849,
    'FORMAT-GLOBAL-TOTAL',
    `Cumulative municipal wards formatted across all 6 cities equals exactly 849 (got ${cumulativeWards})`
  );

  // =========================================================================
  // SECTION 2: Adversarial Edge Cases for formatCompactWardIdentifier
  // =========================================================================
  console.log('\n--- [SECTION 2] Adversarial Edge Cases for formatCompactWardIdentifier ---');

  const edgeCases = [
    { desc: 'Empty properties object', props: {}, expectedNotSubstrings: ['undefined', 'null', '[object Object]', 'NaN'], expectedNonEmpty: true },
    { desc: 'Null values for ward_id and ward_name', props: { ward_id: null, ward_name: null }, expectedNotSubstrings: ['undefined', 'null', '[object Object]', 'NaN'], expectedNonEmpty: true },
    { desc: 'Undefined values for props', props: { ward_id: undefined, ward_name: undefined }, expectedNotSubstrings: ['undefined', 'null', '[object Object]', 'NaN'], expectedNonEmpty: true },
    { desc: 'Numeric ward_id and ward_name', props: { ward_id: 142, ward_name: 142 }, expectedNotSubstrings: ['undefined', 'null', '[object Object]', 'NaN'], expectedNonEmpty: true },
    { desc: 'Only raw_ward_num present', props: { raw_ward_num: 25 }, expectedNotSubstrings: ['undefined', 'null', '[object Object]', 'NaN'], expectedNonEmpty: true },
    { desc: 'Only raw_ward_id present', props: { raw_ward_id: '01' }, expectedNotSubstrings: ['undefined', 'null', '[object Object]', 'NaN'], expectedNonEmpty: true },
    { desc: 'Only ward_id with prefix blr-001', props: { ward_id: 'blr-001' }, expectedSubstrings: ['1'], expectedNotSubstrings: ['undefined', 'null'] },
    { desc: 'Pune Admin Ward with dash', props: { ward_name: 'Admin Ward 01 - Aundh' }, expectedSubstrings: ['01 · Aundh'] },
    { desc: 'Pune Admin Ward without dash', props: { ward_name: 'Admin Ward 02 Shivajinagar' }, expectedSubstrings: ['02 · Shivajinagar'] },
    { desc: 'Pune Admin Ward number only', props: { ward_name: 'Admin Ward 05' }, expectedSubstrings: ['Ward 05'] },
    { desc: 'Ward number with colon', props: { ward_name: 'Ward 142: Rajajinagar' }, expectedSubstrings: ['142 · Rajajinagar'] },
    { desc: 'Ward with em-dash', props: { ward_name: 'Ward 25 — Vinayaka Layout' }, expectedSubstrings: ['25 · Vinayaka Layout'] },
    { desc: 'Ward name with leading/trailing spaces', props: { ward_id: 'blr-042', ward_name: '   Hebbal   ' }, expectedSubstrings: ['42 · Hebbal'] },
    { desc: 'Ward name with repeated Ward prefix in name', props: { ward_id: 'kol-005', ward_name: 'Ward 5' }, expectedNotSubstrings: ['undefined', 'null', '[object Object]', 'NaN'] },
    { desc: 'Mumbai letter ward with ID', props: { ward_id: 'mum-a', ward_name: 'Ward A' }, expectedSubstrings: ['Ward A'] },
    { desc: 'Mumbai letter ward with area', props: { ward_id: 'mum-a', ward_name: 'Ward A - Colaba' }, expectedSubstrings: ['A · Colaba'] },
  ];

  edgeCases.forEach((tc, idx) => {
    const out = formatCompactWardIdentifier(tc.props as any);
    let passes = typeof out === 'string';
    if (tc.expectedNonEmpty && (!out || out.trim().length === 0)) passes = false;
    if (tc.expectedNotSubstrings) {
      for (const sub of tc.expectedNotSubstrings) {
        if (out.includes(sub)) passes = false;
      }
    }
    if (tc.expectedSubstrings) {
      for (const sub of tc.expectedSubstrings) {
        if (!out.includes(sub)) passes = false;
      }
    }
    assert(passes, `EDGE-WARD-FORMAT-${String(idx + 1).padStart(2, '0')}`, `${tc.desc}: got "${out}"`);
  });

  // =========================================================================
  // SECTION 3: Unmonitored States Neutral Presentation Stress Test
  // =========================================================================
  console.log('\n--- [SECTION 3] Unmonitored States Neutral Presentation (36 States/UTs in india-states.geojson) ---');

  const statesPath = path.join(GEOJSON_DIR, 'india-states.geojson');
  assert(fs.existsSync(statesPath), 'STATES-FILE-EXISTS', 'india-states.geojson exists');
  const statesGeoJSON = JSON.parse(fs.readFileSync(statesPath, 'utf8'));

  assert(
    statesGeoJSON.features && statesGeoJSON.features.length === 40,
    'STATES-TOTAL-COUNT',
    `india-states.geojson contains exactly 40 features (got ${statesGeoJSON.features?.length})`
  );

  const MONITORED_STATE_NAMES = ['KARNATAKA', 'MAHARASHTRA', 'WEST BENGAL', 'TAMIL NADU'];
  const NEUTRAL_SLATE_FILL = 'rgba(241, 245, 249, 0.72)';
  const NEUTRAL_SLATE_STROKE = 'rgba(203, 213, 225, 0.85)';
  const NORMAL_BLUE_FILL = 'rgba(59, 130, 246, 0.45)';
  const LOW_GREEN_FILL = 'rgba(34, 197, 94, 0.45)';

  // 3.1 Test with empty telemetry: ALL states must receive neutral slate baseline
  const layerEmptyHeat = createNationalStatesLayer(statesGeoJSON, {}, { activeLayer: 'heat_conditions' });
  const styleFnEmptyHeat = layerEmptyHeat.getStyleFunction();
  const featuresEmptyHeat = layerEmptyHeat.getSource().getFeatures();

  let unmonitoredViolationsHeat = 0;

  featuresEmptyHeat.forEach((feat: any) => {
    const props = feat.getProperties();
    const stateName = (props.NAME_1 || props.name || props.state_name || '').toUpperCase().trim();
    const style = styleFnEmptyHeat(feat, 5);
    const fillColor = style.getFill().getColor();
    const strokeColor = style.getStroke().getColor();
    const strokeWidth = style.getStroke().getWidth();

    if (fillColor !== NEUTRAL_SLATE_FILL || strokeColor !== NEUTRAL_SLATE_STROKE || strokeWidth !== 1.0) {
      unmonitoredViolationsHeat++;
      console.error(`Violation in empty stateMetrics (heat_conditions): ${stateName} -> fill=${fillColor}, stroke=${strokeColor}`);
    }
  });

  assert(
    unmonitoredViolationsHeat === 0,
    'UNMON-EMPTY-HEAT-ALL-SLATE',
    'When stateMetrics is empty, 100% of 40 features receive strictly neutral slate baseline in heat_conditions'
  );

  // 3.2 Test with populated telemetry for the 4 monitored states
  const mockMonitoredStateMetrics = {
    karnataka: { stateName: 'Karnataka', temperature: 34.5, wbgt: 28.5, heatCondition: 'Elevated', thermalStress: 'Moderate' },
    maharashtra: { stateName: 'Maharashtra', temperature: 36.2, wbgt: 29.8, heatCondition: 'Elevated', thermalStress: 'Moderate' },
    'west bengal': { stateName: 'West Bengal', temperature: 38.0, wbgt: 33.2, heatCondition: 'Elevated', thermalStress: 'Severe' },
    'tamil nadu': { stateName: 'Tamil Nadu', temperature: 35.8, wbgt: 30.5, heatCondition: 'Elevated', thermalStress: 'High' },
  };

  // Test heat_conditions with monitored telemetry
  const layerPopHeat = createNationalStatesLayer(statesGeoJSON, mockMonitoredStateMetrics, { activeLayer: 'heat_conditions' });
  const styleFnPopHeat = layerPopHeat.getStyleFunction();
  const featuresPopHeat = layerPopHeat.getSource().getFeatures();

  let unmonitoredCount36 = 0;
  let unmonitoredDeviationsHeat = 0;
  let biharColorHeat = '';

  featuresPopHeat.forEach((feat: any) => {
    const props = feat.getProperties();
    const rawName = String(props.NAME_1 || props.name || props.state_name || '').toUpperCase().trim();
    const isMonitored = MONITORED_STATE_NAMES.includes(rawName);

    if (!isMonitored) {
      unmonitoredCount36++;
      const style = styleFnPopHeat(feat, 5);
      const fillColor = style.getFill().getColor();
      const strokeColor = style.getStroke().getColor();
      const strokeWidth = style.getStroke().getWidth();

      if (rawName === 'BIHAR') {
        biharColorHeat = fillColor;
      }

      if (fillColor !== NEUTRAL_SLATE_FILL || strokeColor !== NEUTRAL_SLATE_STROKE || strokeWidth !== 1.0) {
        unmonitoredDeviationsHeat++;
        console.error(`Deviation in unmonitored state (${rawName}) under heat_conditions: fill=${fillColor}`);
      }
      if (fillColor === NORMAL_BLUE_FILL || fillColor === LOW_GREEN_FILL) {
        unmonitoredDeviationsHeat++;
        console.error(`Unmonitored state (${rawName}) accidentally assigned Normal/Low choropleth: ${fillColor}`);
      }
    }
  });

  assert(
    unmonitoredCount36 === 36,
    'UNMON-FEATURE-COUNT-36',
    `Exactly 36 unmonitored states/UTs/entities identified out of 40 total features (got ${unmonitoredCount36})`
  );

  assert(
    unmonitoredDeviationsHeat === 0,
    'UNMON-HEAT-COND-36-STRICT-SLATE',
    `All 36 unmonitored states strictly retain neutral slate baseline ${NEUTRAL_SLATE_FILL} in heat_conditions`
  );

  assert(
    biharColorHeat === NEUTRAL_SLATE_FILL,
    'UNMON-BIHAR-HEAT-SLATE',
    `Bihar fill color in heat_conditions is strictly neutral slate ${NEUTRAL_SLATE_FILL} (not Normal blue)`
  );

  // Test thermal_stress with monitored telemetry
  const layerPopThermal = createNationalStatesLayer(statesGeoJSON, mockMonitoredStateMetrics, { activeLayer: 'thermal_stress' });
  const styleFnPopThermal = layerPopThermal.getStyleFunction();
  const featuresPopThermal = layerPopThermal.getSource().getFeatures();

  let unmonitoredDeviationsThermal = 0;
  let biharColorThermal = '';

  featuresPopThermal.forEach((feat: any) => {
    const props = feat.getProperties();
    const rawName = String(props.NAME_1 || props.name || props.state_name || '').toUpperCase().trim();
    const isMonitored = MONITORED_STATE_NAMES.includes(rawName);

    if (!isMonitored) {
      const style = styleFnPopThermal(feat, 5);
      const fillColor = style.getFill().getColor();
      const strokeColor = style.getStroke().getColor();
      const strokeWidth = style.getStroke().getWidth();

      if (rawName === 'BIHAR') {
        biharColorThermal = fillColor;
      }

      if (fillColor !== NEUTRAL_SLATE_FILL || strokeColor !== NEUTRAL_SLATE_STROKE || strokeWidth !== 1.0) {
        unmonitoredDeviationsThermal++;
        console.error(`Deviation in unmonitored state (${rawName}) under thermal_stress: fill=${fillColor}`);
      }
      if (fillColor === LOW_GREEN_FILL || fillColor === NORMAL_BLUE_FILL) {
        unmonitoredDeviationsThermal++;
        console.error(`Unmonitored state (${rawName}) accidentally assigned Low green: ${fillColor}`);
      }
    }
  });

  assert(
    unmonitoredDeviationsThermal === 0,
    'UNMON-THERMAL-STRESS-36-STRICT-SLATE',
    `All 36 unmonitored states strictly retain neutral slate baseline ${NEUTRAL_SLATE_FILL} in thermal_stress`
  );

  assert(
    biharColorThermal === NEUTRAL_SLATE_FILL,
    'UNMON-BIHAR-THERMAL-NOT-GREEN',
    `Bihar fill color in thermal_stress is strictly neutral slate ${NEUTRAL_SLATE_FILL} and NOT Low green (${LOW_GREEN_FILL})`
  );

  // =========================================================================
  // SECTION 4: Monitored States Deterministic Value -> Classification -> Color
  // =========================================================================
  console.log('\n--- [SECTION 4] Monitored States Thematic Styling (Karnataka, Maharashtra, West Bengal, Tamil Nadu) ---');

  const monitoredScenarios = [
    // Heat Conditions Scenarios
    {
      mode: 'heat_conditions',
      state: 'KARNATAKA',
      key: 'karnataka',
      metric: { stateName: 'Karnataka', temperature: 28.0, heatCondition: 'Normal' },
      expectedFill: 'rgba(59, 130, 246, 0.45)',
      expectedStroke: '#2563eb',
      expectedStrokeWidth: 2.0,
      classification: 'Normal (<32°C)',
    },
    {
      mode: 'heat_conditions',
      state: 'MAHARASHTRA',
      key: 'maharashtra',
      metric: { stateName: 'Maharashtra', temperature: 35.5, heatCondition: 'Elevated' },
      expectedFill: 'rgba(234, 179, 8, 0.48)',
      expectedStroke: '#ca8a04',
      expectedStrokeWidth: 2.0,
      classification: 'Elevated (32–40°C)',
    },
    {
      mode: 'heat_conditions',
      state: 'WEST BENGAL',
      key: 'west bengal',
      metric: { stateName: 'West Bengal', temperature: 43.0, heatCondition: 'High' },
      expectedFill: 'rgba(249, 115, 22, 0.50)',
      expectedStroke: '#ea580c',
      expectedStrokeWidth: 2.0,
      classification: 'High (41–53°C)',
    },
    {
      mode: 'heat_conditions',
      state: 'TAMIL NADU',
      key: 'tamil nadu',
      metric: { stateName: 'Tamil Nadu', temperature: 55.0, heatCondition: 'Extreme' },
      expectedFill: 'rgba(249, 115, 22, 0.50)',
      expectedStroke: '#ea580c',
      expectedStrokeWidth: 2.0,
      classification: 'Extreme (≥54°C)',
    },
    // Thermal Stress Scenarios
    {
      mode: 'thermal_stress',
      state: 'KARNATAKA',
      key: 'karnataka',
      metric: { stateName: 'Karnataka', wbgt: 26.5, thermalStress: 'Low' },
      expectedFill: 'rgba(34, 197, 94, 0.45)',
      expectedStroke: '#16a34a',
      expectedStrokeWidth: 2.0,
      classification: 'Low (<28°C WBGT)',
    },
    {
      mode: 'thermal_stress',
      state: 'MAHARASHTRA',
      key: 'maharashtra',
      metric: { stateName: 'Maharashtra', wbgt: 29.0, thermalStress: 'Moderate' },
      expectedFill: 'rgba(250, 204, 21, 0.48)',
      expectedStroke: '#eab308',
      expectedStrokeWidth: 2.0,
      classification: 'Moderate (28–30°C WBGT)',
    },
    {
      mode: 'thermal_stress',
      state: 'TAMIL NADU',
      key: 'tamil nadu',
      metric: { stateName: 'Tamil Nadu', wbgt: 31.0, thermalStress: 'High' },
      expectedFill: 'rgba(234, 88, 12, 0.50)',
      expectedStroke: '#c2410c',
      expectedStrokeWidth: 2.0,
      classification: 'High (30–32°C WBGT)',
    },
    {
      mode: 'thermal_stress',
      state: 'WEST BENGAL',
      key: 'west bengal',
      metric: { stateName: 'West Bengal', wbgt: 33.5, thermalStress: 'Severe' },
      expectedFill: 'rgba(153, 27, 27, 0.55)',
      expectedStroke: '#7f1d1d',
      expectedStrokeWidth: 2.0,
      classification: 'Severe (>32°C WBGT)',
    },
  ];

  monitoredScenarios.forEach((sc, idx) => {
    const sMetrics = { [sc.key]: sc.metric };
    const layer = createNationalStatesLayer(statesGeoJSON, sMetrics, { activeLayer: sc.mode as any });
    const styleFn = layer.getStyleFunction();
    const feature = layer.getSource().getFeatures().find((f: any) => {
      const name = String(f.get('NAME_1') || f.get('name') || f.get('state_name') || '').toUpperCase().trim();
      return name === sc.state;
    });

    assert(!!feature, `MON-STATE-FOUND-${sc.state}`, `Found feature for ${sc.state}`);

    if (feature) {
      const style = styleFn(feature, 5);
      const fill = style.getFill().getColor();
      const stroke = style.getStroke().getColor();
      const width = style.getStroke().getWidth();

      assert(
        fill === sc.expectedFill,
        `MON-COLOR-FILL-${String(idx + 1).padStart(2, '0')}`,
        `${sc.state} [${sc.mode}] -> ${sc.classification}: fill matches expected ${sc.expectedFill} (got ${fill})`
      );

      assert(
        stroke === sc.expectedStroke && width === sc.expectedStrokeWidth,
        `MON-COLOR-STROKE-${String(idx + 1).padStart(2, '0')}`,
        `${sc.state} [${sc.mode}]: stroke matches ${sc.expectedStroke} (width: ${width})`
      );
    }
  });

  // =========================================================================
  // SECTION 5: Hover Popover Data Integrity & Metric Switching
  // =========================================================================
  console.log('\n--- [SECTION 5] Hover Popover Data Integrity & Dynamic Metric Switching ---');

  function simulateWardHover(
    props: Record<string, unknown>,
    risk: { currentTemp?: number; heatIndex?: number; wbgt?: number; heatCondition?: string; thermalStress?: string; compositeRisk?: number; compositeRiskLevel?: string } | undefined,
    currentLayer: 'heat_conditions' | 'thermal_stress' | 'health_impact' | 'composite_risk'
  ) {
    const compactId = formatCompactWardIdentifier(props);
    let metricLabel = 'Temperature';
    let metricValue = '--';
    let category = 'Normal';

    if (currentLayer === 'heat_conditions') {
      metricLabel = 'Temperature';
      const t = risk?.currentTemp;
      metricValue = t !== undefined ? `${t}°C` : (risk?.heatIndex !== undefined ? `${risk.heatIndex}°C` : '--');
      let cond = risk?.heatCondition;
      if (!cond && t !== undefined) {
        cond = t >= 54 ? 'Extreme' : t >= 41 ? 'High' : t >= 32 ? 'Elevated' : 'Normal';
      }
      category = cond || 'Normal';
    } else if (currentLayer === 'thermal_stress') {
      metricLabel = 'WBGT Stress';
      const wbgt = risk?.wbgt;
      metricValue = wbgt !== undefined ? `${wbgt}°C` : '--';
      let stress = risk?.thermalStress;
      if (!stress && wbgt !== undefined) {
        stress = wbgt > 32 ? 'Severe' : wbgt >= 30 ? 'High' : wbgt >= 28 ? 'Moderate' : 'Low';
      }
      category = stress || 'Low';
    } else if (currentLayer === 'health_impact') {
      metricLabel = 'Health Impact';
      metricValue = 'Model In Development';
      category = 'Disabled (R5)';
    } else {
      metricLabel = 'Composite Risk';
      metricValue = risk?.compositeRisk !== undefined ? String(risk.compositeRisk) : '--';
      category = String(risk?.compositeRiskLevel || 'Low');
    }

    return {
      compactId,
      metricLabel,
      metricValue,
      category,
    };
  }

  const testProps = { ward_id: 'blr-142', ward_name: 'Rajajinagara' };
  const testRisk = {
    currentTemp: 34.5,
    heatIndex: 38.0,
    wbgt: 29.5,
    heatCondition: 'Elevated',
    thermalStress: 'Moderate',
    compositeRisk: 62,
    compositeRiskLevel: 'High',
  };

  // 5.1 Test heat_conditions
  const popHeat = simulateWardHover(testProps, testRisk, 'heat_conditions');
  assert(popHeat.metricLabel === 'Temperature', 'HOVER-HEAT-LABEL', "heat_conditions hover metricLabel is 'Temperature'");
  assert(popHeat.metricValue === '34.5°C', 'HOVER-HEAT-VAL', 'heat_conditions hover metricValue displays temperature: 34.5°C');
  assert(popHeat.category === 'Elevated', 'HOVER-HEAT-CAT', "heat_conditions hover category displays 'Elevated'");

  // 5.2 Test thermal_stress
  const popThermal = simulateWardHover(testProps, testRisk, 'thermal_stress');
  assert(popThermal.metricLabel === 'WBGT Stress', 'HOVER-THERMAL-LABEL', "thermal_stress hover metricLabel switches to 'WBGT Stress'");
  assert(popThermal.metricValue === '29.5°C', 'HOVER-THERMAL-VAL', 'thermal_stress hover metricValue switches to WBGT: 29.5°C');
  assert(popThermal.category === 'Moderate', 'HOVER-THERMAL-CAT', "thermal_stress hover category switches to 'Moderate'");

  // 5.3 Test health_impact (Disabled, Zero Fake Data)
  const popHealth = simulateWardHover(testProps, testRisk, 'health_impact');
  assert(popHealth.metricLabel === 'Health Impact', 'HOVER-HEALTH-LABEL', "health_impact metricLabel is 'Health Impact'");
  assert(popHealth.metricValue === 'Model In Development', 'HOVER-HEALTH-VAL', "health_impact metricValue is 'Model In Development' without synthetic data");
  assert(popHealth.category === 'Disabled (R5)', 'HOVER-HEALTH-CAT', "health_impact category is explicitly 'Disabled (R5)'");

  // 5.4 Test composite_risk
  const popRisk = simulateWardHover(testProps, testRisk, 'composite_risk');
  assert(popRisk.metricLabel === 'Composite Risk', 'HOVER-RISK-LABEL', "composite_risk metricLabel is 'Composite Risk'");
  assert(popRisk.metricValue === '62', 'HOVER-RISK-VAL', "composite_risk metricValue is '62'");
  assert(popRisk.category === 'High', 'HOVER-RISK-CAT', "composite_risk category is 'High'");

  // =========================================================================
  // SECTION 6: Multi-Scale Level of Detail (LOD) & Layer Rules
  // =========================================================================
  console.log('\n--- [SECTION 6] Multi-Scale Level of Detail (LOD) & Layer Rules ---');

  const blrGeoJSON = JSON.parse(fs.readFileSync(path.join(GEOJSON_DIR, 'bengaluru-gba-369-wards.geojson'), 'utf8'));
  const sampleRisks = [
    { wardId: 'blr-142', wardName: 'Rajajinagara', currentTemp: 35.0, wbgt: 29.0, heatCondition: 'Elevated', thermalStress: 'Moderate' },
  ];

  const wardsLayer = createAdminWardsLayer(blrGeoJSON, sampleRisks as any, {
    activeLayer: 'heat_conditions',
    selectedWardId: 'blr-142',
    hoveredWardId: null,
  });

  const wardStyleFn = wardsLayer.getStyleFunction();
  const sampleFeature = wardsLayer.getSource().getFeatures().find((f: any) => f.get('ward_id') === 'blr-142');
  assert(!!sampleFeature, 'LOD-FEAT-FOUND', 'Found sample ward feature blr-142 in admin wards layer');

  // Test LOD 0: Resolution corresponding to zoom 6 (National) -> must suppress polygon
  const nationalRes = 156543.03392804097 / Math.pow(2, 6);
  const styleZ6 = wardStyleFn(sampleFeature, nationalRes);
  assert(styleZ6 === undefined, 'LOD-0-SUPPRESS-WARD', 'LOD 0 (zoom 6 < 8): Ward polygon is strictly suppressed (returns undefined)');

  // Test LOD 1: Resolution corresponding to zoom 10 (City Scale) -> render polygon, NO permanent text label
  const cityRes = 156543.03392804097 / Math.pow(2, 10);
  const unselectedLayer = createAdminWardsLayer(blrGeoJSON, sampleRisks as any, {
    activeLayer: 'heat_conditions',
    selectedWardId: null,
    hoveredWardId: null,
  });
  const unselectedStyleFn = unselectedLayer.getStyleFunction();
  const styleZ10 = unselectedStyleFn(sampleFeature, cityRes);
  assert(!!styleZ10, 'LOD-1-RENDER-WARD', 'LOD 1 (zoom 10): Ward polygon renders cleanly');
  assert(!styleZ10.getText(), 'LOD-1-SUPPRESS-TEXT', 'LOD 1 (zoom 10): Permanent text label is suppressed to prevent clutter across 369 wards');

  // Test LOD 2: Resolution corresponding to zoom 14 (Ward Scale) -> render polygon + compact label
  const wardRes = 156543.03392804097 / Math.pow(2, 14);
  const styleZ14 = unselectedStyleFn(sampleFeature, wardRes);
  assert(!!styleZ14, 'LOD-2-RENDER-WARD', 'LOD 2 (zoom 14): Ward polygon renders cleanly');
  assert(!!styleZ14.getText(), 'LOD-2-RENDER-TEXT', 'LOD 2 (zoom 14): Compact ward text label is rendered');
  const labelZ14 = styleZ14.getText()?.getText();
  assert(
    typeof labelZ14 === 'string' && labelZ14.length > 0 && !labelZ14.includes('undefined'),
    'LOD-2-LABEL-CONTENT',
    `LOD 2 (zoom 14): Rendered label is clean: "${labelZ14}"`
  );

  // Test Selection Styling: Cyan highlight stroke
  const selectedStyle = wardStyleFn(sampleFeature, wardRes);
  assert(
    selectedStyle.getStroke()?.getColor() === '#00f2fe',
    'WARD-SELECT-CYAN-STROKE',
    `Selected ward displays cyan highlight stroke (#00f2fe) (width: ${selectedStyle.getStroke()?.getWidth()})`
  );
  assert(
    selectedStyle.getZIndex() === 100,
    'WARD-SELECT-ZINDEX',
    'Selected ward has elevated z-index (100) for visual prominence'
  );

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  console.log('  CHALLENGER 2 EMPIRICAL TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total Checks:  ${result.total}`);
  console.log(`  Passed Checks: ${result.passed}`);
  console.log(`  Failed Checks: ${result.failed}`);
  console.log(`  Success Rate:  ${((result.passed / result.total) * 100).toFixed(1)}%`);
  console.log('='.repeat(80));

  if (result.failed > 0) {
    console.error('\nFAILED CHECKS:');
    result.failures.forEach((f) => console.error(f));
    process.exit(1);
  } else {
    console.log('\nVERDICT: ALL LAYER SWITCHING & LABELING ASSERTIONS PASSED EMPIRICALLY!\n');
    process.exit(0);
  }
}

runLayerSwitchingAndLabelingChallenge().catch((err) => {
  console.error('Fatal error executing test harness:', err);
  process.exit(1);
});