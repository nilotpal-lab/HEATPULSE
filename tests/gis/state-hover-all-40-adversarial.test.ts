/**
 * HeatPulse — Challenger Empirical Test Harness:
 * State Hover Popover & Map Bounds Adversarial Challenge across All 40 Features
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 *
 * Scope:
 * 1. Comprehensive verification of all 40 features in public/data/processed/geojson/india-states.geojson
 * 2. Simulated hover across all 40 features under 3 layers (heat_conditions, thermal_stress, health_impact):
 *    - 4 Monitored States: Karnataka, Maharashtra, West Bengal, Tamil Nadu
 *    - 32 Unmonitored States/UTs: Bihar, UP, Rajasthan, Gujarat, Kerala, Punjab, etc.
 *    - 4 Disputed Border Region Slivers:
 *      * DISPUTED (MADHYA PRADESH & GUJARAT)
 *      * DISPUTED (MADHYA PRADESH & RAJASTHAN)
 *      * DISPUTED (RAJASTHAN & GUJARAT)
 *      * DISPUTED (WEST BENGAL, BIHAR & JHARKHAND)
 * 3. Exact Category, Metric, Badge, and Subtext congruence with visual OpenLayers vector styles
 * 4. Adversarial edge cases: malformed properties, extreme temperatures, zero metrics
 * 5. Bhuvan basemap layer routing: pan-India baseline vs 6 city LULC rasters
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
const STATES_GEOJSON_PATH = path.join(HEATPULSE_DIR, 'public/data/processed/geojson/india-states.geojson');

// Import map configuration and components
const {
  formatStateDisplayName,
  createNationalStatesLayer,
  BHUVAN_DEFAULT_LAYER,
  PAN_INDIA_BHUVAN_LAYER,
  LEGACY_BHUVAN_LAYER,
  BHUVAN_CITY_LAYERS,
  getBhuvanLayerForScope,
} = require(path.join(HEATPULSE_DIR, 'src/lib/map-config'));

const {
  DEFAULT_BHUVAN_LAYER,
} = require(path.join(HEATPULSE_DIR, 'src/components/map/BhuvanLayer'));

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

/**
 * Exact replica of the hover state resolution logic from MapContainer.tsx (lines 325-422).
 */
function simulateStateHover(
  featureProps: Record<string, unknown>,
  activeLayer: 'heat_conditions' | 'thermal_stress' | 'health_impact' | 'composite_risk',
  stateMetrics: Record<string, any> = {},
  pixel: [number, number] = [400, 300],
  containerWidth: number = 800
) {
  const rawStateName = (
    featureProps.state_name ||
    featureProps.STATE ||
    featureProps.ST_NM ||
    featureProps.NAME_1 ||
    featureProps.name ||
    ''
  ) as string;

  const normState = String(rawStateName).toLowerCase().trim();
  const sMetrics = stateMetrics;
  const metric =
    sMetrics[normState] ||
    sMetrics[rawStateName] ||
    sMetrics[normState.replace(/[^a-z0-9]/g, '')] ||
    sMetrics[normState.replace(/ & /g, ' and ')];

  const displayName = metric?.stateName || formatStateDisplayName(rawStateName);
  const clampedX = Math.min(Math.max(pixel[0], 140), containerWidth - 140);

  let metricLabel: string | undefined = 'Peak Temperature';
  let metricValue: string | undefined = '--';
  let category = 'Regional Baseline / Unmonitored';
  let badgeBg = 'bg-slate-100';
  let badgeText = 'text-slate-700';
  let badgeBorder = 'border-slate-300';
  let subtext: string | undefined = undefined;

  if (metric) {
    if (activeLayer === 'heat_conditions') {
      metricLabel = 'Peak Temperature';
      const t = metric.temperature;
      metricValue = t !== undefined ? `${t}°C` : '--';
      let cond = metric.heatCondition;
      if (!cond && t !== undefined) {
        cond = t >= 54 ? 'Extreme' : t >= 41 ? 'High' : t >= 32 ? 'Elevated' : 'Normal';
      }
      category = cond || 'Normal';
      if (category === 'Extreme') {
        badgeBg = 'bg-rose-100'; badgeText = 'text-rose-900'; badgeBorder = 'border-rose-300';
      } else if (category === 'High') {
        badgeBg = 'bg-orange-100'; badgeText = 'text-orange-900'; badgeBorder = 'border-orange-300';
      } else if (category === 'Elevated') {
        badgeBg = 'bg-yellow-100'; badgeText = 'text-yellow-900'; badgeBorder = 'border-yellow-300';
      } else {
        badgeBg = 'bg-blue-50'; badgeText = 'text-blue-900'; badgeBorder = 'border-blue-200';
      }
    } else if (activeLayer === 'thermal_stress') {
      metricLabel = 'Peak WBGT';
      const wbgt = metric.wbgt;
      metricValue = wbgt !== undefined ? `${wbgt}°C` : '--';
      let stress = metric.thermalStress;
      if (!stress && wbgt !== undefined) {
        stress = wbgt >= 32 ? 'Severe' : wbgt >= 30 ? 'High' : wbgt >= 28 ? 'Moderate' : 'Low';
      }
      category = stress || 'Low';
      if (category === 'Severe') {
        badgeBg = 'bg-rose-100'; badgeText = 'text-rose-900'; badgeBorder = 'border-rose-300';
      } else if (category === 'High') {
        badgeBg = 'bg-orange-100'; badgeText = 'text-orange-900'; badgeBorder = 'border-orange-300';
      } else if (category === 'Moderate') {
        badgeBg = 'bg-yellow-100'; badgeText = 'text-yellow-900'; badgeBorder = 'border-yellow-300';
      } else {
        badgeBg = 'bg-emerald-50'; badgeText = 'text-emerald-900'; badgeBorder = 'border-emerald-200';
      }
    } else if (activeLayer === 'health_impact') {
      metricLabel = 'Health Impact';
      metricValue = 'Model In Development';
      category = 'Disabled (R5)';
      badgeBg = 'bg-slate-100'; badgeText = 'text-slate-700'; badgeBorder = 'border-slate-300';
    }
  } else {
    metricLabel = undefined;
    metricValue = undefined;
    category = 'Regional Baseline / Unmonitored';
    badgeBg = 'bg-slate-100';
    badgeText = 'text-slate-700';
    badgeBorder = 'border-slate-300';
    subtext = 'Regional baseline (unmonitored). Municipal telemetry active in 6 metro regions.';
  }

  return {
    type: 'state',
    x: clampedX,
    y: pixel[1],
    stateName: displayName,
    metricLabel,
    metricValue,
    category,
    badgeBg,
    badgeText,
    badgeBorder,
    subtext,
  };
}

async function runAdversarialStateHoverChallenge() {
  console.log('='.repeat(80));
  console.log('  HEATPULSE ADVERSARIAL CHALLENGER: STATE HOVER & MAP BOUNDS SUITE');
  console.log('  Ministry of Earth Sciences / NCMRWF — SIH26083 Verification');
  console.log('='.repeat(80));
  console.log('');

  // -------------------------------------------------------------------------
  // SECTION 1: GeoJSON Loading & Feature Cataloging (40 Features)
  // -------------------------------------------------------------------------
  console.log('--- [SECTION 1] GeoJSON Loading & Feature Cataloging (40 Features) ---');

  assert(fs.existsSync(STATES_GEOJSON_PATH), 'GEOJSON-01', 'india-states.geojson exists on filesystem');
  const rawGeoJson = fs.readFileSync(STATES_GEOJSON_PATH, 'utf8');
  const geojson = JSON.parse(rawGeoJson);

  assert(geojson.type === 'FeatureCollection', 'GEOJSON-02', 'GeoJSON root type is FeatureCollection');
  assert(geojson.features && geojson.features.length === 40, 'GEOJSON-03', `Features count is exactly 40 (got ${geojson.features?.length})`);

  const features = geojson.features;
  const featureNames = features.map((f: any) => f.properties?.state_name || f.properties?.STATE || f.properties?.name);

  // Verify all 40 features have non-empty names
  const allNamed = featureNames.every((n: any) => typeof n === 'string' && n.trim().length > 0);
  assert(allNamed, 'GEOJSON-04', '100% of 40 features possess a valid non-empty state name attribute');

  // Verify specific critical entities exist in dataset
  const monitoredEntities = ['KARNATAKA', 'MAHARASHTRA', 'WEST BENGAL', 'TAMIL NADU'];
  monitoredEntities.forEach((state) => {
    assert(featureNames.includes(state), `CATALOG-${state}`, `Monitored state ${state} found in GeoJSON features`);
  });

  const disputedEntities = [
    'DISPUTED (MADHYA PRADESH & GUJARAT)',
    'DISPUTED (MADHYA PRADESH & RAJASTHAN)',
    'DISPUTED (RAJASTHAN & GUJARAT)',
    'DISPUTED (WEST BENGAL, BIHAR & JHARKHAND)',
  ];
  disputedEntities.forEach((sliver) => {
    assert(featureNames.includes(sliver), `CATALOG-SLIVER`, `Disputed border sliver '${sliver}' found in GeoJSON features`);
  });

  // -------------------------------------------------------------------------
  // SECTION 2: Simulated Realistic Telemetry Setup
  // -------------------------------------------------------------------------
  console.log('\n--- [SECTION 2] Setting up Multi-Metro Telemetry Mapping ---');

  const realisticStateMetrics: Record<string, any> = {
    'karnataka': {
      stateName: 'Karnataka',
      temperature: 31.5,
      heatIndex: 33.0,
      wbgt: 26.5,
      heatCondition: 'Normal',
      thermalStress: 'Low',
    },
    'maharashtra': {
      stateName: 'Maharashtra',
      temperature: 38.0,
      heatIndex: 43.5,
      wbgt: 30.8,
      heatCondition: 'Elevated',
      thermalStress: 'High',
    },
    'west bengal': {
      stateName: 'West Bengal',
      temperature: 42.5,
      heatIndex: 49.0,
      wbgt: 33.4,
      heatCondition: 'High',
      thermalStress: 'Severe',
    },
    'tamil nadu': {
      stateName: 'Tamil Nadu',
      temperature: 36.0,
      heatIndex: 40.0,
      wbgt: 29.5,
      heatCondition: 'Elevated',
      thermalStress: 'Moderate',
    },
  };

  console.log('  Configured 4 monitored state telemetry profiles:');
  console.log('  - Karnataka:    T=31.5°C (Normal),   WBGT=26.5°C (Low)');
  console.log('  - Maharashtra:  T=38.0°C (Elevated), WBGT=30.8°C (High)');
  console.log('  - West Bengal:  T=42.5°C (High),     WBGT=33.4°C (Severe)');
  console.log('  - Tamil Nadu:   T=36.0°C (Elevated), WBGT=29.5°C (Moderate)');

  // -------------------------------------------------------------------------
  // SECTION 3: Exhaustive Hover Simulation Across All 40 Features under heat_conditions
  // -------------------------------------------------------------------------
  console.log('\n--- [SECTION 3] Exhaustive Hover Simulation under heat_conditions (All 40 Features) ---');

  let nullTooltipsHeat = 0;
  let crashCountHeat = 0;

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const rawName = f.properties.state_name;
    const isMonitored = monitoredEntities.includes(rawName);

    try {
      const tooltip = simulateStateHover(f.properties, 'heat_conditions', realisticStateMetrics, [300, 200]);
      if (!tooltip) {
        nullTooltipsHeat++;
        continue;
      }

      if (isMonitored) {
        const expected = realisticStateMetrics[rawName.toLowerCase()];
        assert(
          tooltip.stateName === expected.stateName &&
          tooltip.metricLabel === 'Peak Temperature' &&
          tooltip.metricValue === `${expected.temperature}°C` &&
          tooltip.category === expected.heatCondition &&
          tooltip.subtext === undefined,
          `HOVER-HEAT-${rawName}`,
          `Monitored ${rawName}: got ${tooltip.category} (${tooltip.metricValue})`
        );
      } else {
        // Unmonitored
        const isSlate = tooltip.badgeBg === 'bg-slate-100';
        const isUnmonCat = tooltip.category === 'Regional Baseline / Unmonitored';
        const noFakeVal = tooltip.metricValue === undefined && tooltip.metricLabel === undefined;
        const hasSubtext = typeof tooltip.subtext === 'string' && tooltip.subtext.includes('Regional baseline');

        if (!isSlate || !isUnmonCat || !noFakeVal || !hasSubtext) {
          assert(false, `HOVER-HEAT-UNMON-${i}`, `Unmonitored feature #${i} (${rawName}) failed baseline invariants`);
        }
      }
    } catch (e: any) {
      crashCountHeat++;
      console.error(`  Crash on feature ${rawName}:`, e.message);
    }
  }

  assert(nullTooltipsHeat === 0, 'HOVER-HEAT-NO-NULL', `100% of 40 features produced non-null tooltips under heat_conditions`);
  assert(crashCountHeat === 0, 'HOVER-HEAT-NO-CRASH', `Zero crashes or unhandled exceptions across all 40 features under heat_conditions`);

  // -------------------------------------------------------------------------
  // SECTION 4: Exhaustive Hover Simulation Across All 40 Features under thermal_stress
  // -------------------------------------------------------------------------
  console.log('\n--- [SECTION 4] Exhaustive Hover Simulation under thermal_stress (All 40 Features) ---');

  let nullTooltipsThermal = 0;
  let crashCountThermal = 0;

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const rawName = f.properties.state_name;
    const isMonitored = monitoredEntities.includes(rawName);

    try {
      const tooltip = simulateStateHover(f.properties, 'thermal_stress', realisticStateMetrics, [300, 200]);
      if (!tooltip) {
        nullTooltipsThermal++;
        continue;
      }

      if (isMonitored) {
        const expected = realisticStateMetrics[rawName.toLowerCase()];
        assert(
          tooltip.stateName === expected.stateName &&
          tooltip.metricLabel === 'Peak WBGT' &&
          tooltip.metricValue === `${expected.wbgt}°C` &&
          tooltip.category === expected.thermalStress &&
          tooltip.subtext === undefined,
          `HOVER-THERMAL-${rawName}`,
          `Monitored ${rawName}: got ${tooltip.category} (${tooltip.metricValue})`
        );
      } else {
        // Unmonitored
        const isSlate = tooltip.badgeBg === 'bg-slate-100';
        const isUnmonCat = tooltip.category === 'Regional Baseline / Unmonitored';
        const noFakeVal = tooltip.metricValue === undefined && tooltip.metricLabel === undefined;

        if (!isSlate || !isUnmonCat || !noFakeVal) {
          assert(false, `HOVER-THERMAL-UNMON-${i}`, `Unmonitored feature #${i} (${rawName}) failed baseline invariants`);
        }
      }
    } catch (e: any) {
      crashCountThermal++;
      console.error(`  Crash on feature ${rawName}:`, e.message);
    }
  }

  assert(nullTooltipsThermal === 0, 'HOVER-THERMAL-NO-NULL', `100% of 40 features produced non-null tooltips under thermal_stress`);
  assert(crashCountThermal === 0, 'HOVER-THERMAL-NO-CRASH', `Zero crashes or unhandled exceptions across all 40 features under thermal_stress`);

  // -------------------------------------------------------------------------
  // SECTION 5: Exhaustive Hover Simulation Across All 40 Features under health_impact
  // -------------------------------------------------------------------------
  console.log('\n--- [SECTION 5] Exhaustive Hover Simulation under health_impact (All 40 Features) ---');

  let nullTooltipsHealth = 0;
  let crashCountHealth = 0;

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const rawName = f.properties.state_name;
    const isMonitored = monitoredEntities.includes(rawName);

    try {
      const tooltip = simulateStateHover(f.properties, 'health_impact', realisticStateMetrics, [300, 200]);
      if (!tooltip) {
        nullTooltipsHealth++;
        continue;
      }

      if (isMonitored) {
        assert(
          tooltip.metricLabel === 'Health Impact' &&
          tooltip.metricValue === 'Model In Development' &&
          tooltip.category === 'Disabled (R5)' &&
          tooltip.badgeBg === 'bg-slate-100',
          `HOVER-HEALTH-${rawName}`,
          `Monitored ${rawName}: displays honest 'Model In Development' & 'Disabled (R5)'`
        );
      } else {
        // Unmonitored state remains Regional Baseline
        assert(
          tooltip.category === 'Regional Baseline / Unmonitored' &&
          tooltip.badgeBg === 'bg-slate-100',
          `HOVER-HEALTH-UNMON-${i}`,
          `Unmonitored #${i} (${rawName}): displays Regional Baseline`
        );
      }
    } catch (e: any) {
      crashCountHealth++;
      console.error(`  Crash on feature ${rawName}:`, e.message);
    }
  }

  assert(nullTooltipsHealth === 0, 'HOVER-HEALTH-NO-NULL', `100% of 40 features produced non-null tooltips under health_impact`);
  assert(crashCountHealth === 0, 'HOVER-HEALTH-NO-CRASH', `Zero crashes or unhandled exceptions across all 40 features under health_impact`);

  // -------------------------------------------------------------------------
  // SECTION 6: Disputed Border Slivers & Naming Verification
  // -------------------------------------------------------------------------
  console.log('\n--- [SECTION 6] Disputed Border Slivers & Special Naming Cases ---');

  // Test 4 disputed slivers
  const sliverTestCases = [
    {
      raw: 'DISPUTED (MADHYA PRADESH & GUJARAT)',
      expectedName: 'Madhya Pradesh & Gujarat (Border Region)',
    },
    {
      raw: 'DISPUTED (MADHYA PRADESH & RAJASTHAN)',
      expectedName: 'Madhya Pradesh & Rajasthan (Border Region)',
    },
    {
      raw: 'DISPUTED (RAJASTHAN & GUJARAT)',
      expectedName: 'Rajasthan & Gujarat (Border Region)',
    },
    {
      raw: 'DISPUTED (WEST BENGAL, BIHAR & JHARKHAND)',
      expectedName: 'West Bengal, Bihar & Jharkhand (Border Region)',
    },
  ];

  sliverTestCases.forEach((tc) => {
    const formatted = formatStateDisplayName(tc.raw);
    assert(formatted === tc.expectedName, `SLIVER-FORMAT`, `Formatted '${tc.raw}' -> '${formatted}'`);

    // Verify hover does not mistakenly bind West Bengal telemetry to the disputed tri-state sliver
    const tooltip = simulateStateHover({ state_name: tc.raw }, 'thermal_stress', realisticStateMetrics);
    assert(
      tooltip.stateName === tc.expectedName &&
      tooltip.category === 'Regional Baseline / Unmonitored' &&
      tooltip.metricValue === undefined,
      `SLIVER-UNMON`,
      `Sliver '${tc.raw}' stays neutral unmonitored baseline, zero accidental bleed of WB telemetry`
    );
  });

  // Test Special spelling / casing
  assert(formatStateDisplayName('CHHAtTISGARH') === 'Chhattisgarh', 'NAME-CHHATTISGARH', 'CHHAtTISGARH formatted as Chhattisgarh');
  assert(formatStateDisplayName('DADRA & NAGAR HAVELI & DAMAN & DIU') === 'Dadra & Nagar Haveli & Daman & Diu', 'NAME-DNHDD', 'Dadra & Nagar Haveli & Daman & Diu formatted cleanly');
  assert(formatStateDisplayName('JAMMU AND KASHMIR') === 'Jammu and Kashmir', 'NAME-J&K', 'JAMMU AND KASHMIR formatted as Jammu and Kashmir');
  assert(formatStateDisplayName('ANDAMAN & NICOBAR') === 'Andaman & Nicobar', 'NAME-A&N', 'ANDAMAN & NICOBAR formatted cleanly');

  // -------------------------------------------------------------------------
  // SECTION 7: OpenLayers Vector Layer & Style Congruence across Layers
  // -------------------------------------------------------------------------
  console.log('\n--- [SECTION 7] OpenLayers Vector Layer & Style Congruence ---');

  // Create OpenLayers layer in thermal_stress mode
  const statesLayerThermal = createNationalStatesLayer(geojson, realisticStateMetrics, {
    activeLayer: 'thermal_stress',
  });

  const olFeaturesThermal = statesLayerThermal.getSource()?.getFeatures() || [];
  assert(olFeaturesThermal.length === 40, 'OL-COUNT-THERMAL', `OpenLayers loaded all 40 features in thermal_stress mode`);

  const allTagged = olFeaturesThermal.every((f: any) => f.get('isStateFeature') === true);
  assert(allTagged, 'OL-TAG-IS-STATE', `100% of 40 OpenLayers features have isStateFeature = true flag`);

  const styleFnThermal = statesLayerThermal.getStyleFunction();
  assert(typeof styleFnThermal === 'function', 'OL-STYLE-FN-EXISTS', 'Style function exists on vector layer');

  if (styleFnThermal) {
    // Check West Bengal: should be Severe -> rgba(153, 27, 27, 0.55), stroke: #7f1d1d
    const wbFeature = olFeaturesThermal.find((f: any) => f.get('state_name') === 'WEST BENGAL');
    const wbStyle = (styleFnThermal(wbFeature, 1) as any);
    const wbFill = wbStyle.getFill()?.getColor();
    const wbStroke = wbStyle.getStroke()?.getColor();
    assert(wbFill === 'rgba(153, 27, 27, 0.55)', 'STYLE-WB-FILL', `West Bengal fill is Severe Burgundy (${wbFill})`);
    assert(wbStroke === '#7f1d1d', 'STYLE-WB-STROKE', `West Bengal stroke is Severe dark red (${wbStroke})`);

    // Check Maharashtra: should be High -> rgba(234, 88, 12, 0.50), stroke: #c2410c
    const mhFeature = olFeaturesThermal.find((f: any) => f.get('state_name') === 'MAHARASHTRA');
    const mhStyle = (styleFnThermal(mhFeature, 1) as any);
    const mhFill = mhStyle.getFill()?.getColor();
    assert(mhFill === 'rgba(234, 88, 12, 0.50)', 'STYLE-MH-FILL', `Maharashtra fill is High orange (${mhFill})`);

    // Check Bihar: unmonitored -> neutral slate rgba(241, 245, 249, 0.72)
    const biharFeature = olFeaturesThermal.find((f: any) => f.get('state_name') === 'BIHAR');
    const biharStyle = (styleFnThermal(biharFeature, 1) as any);
    const biharFill = biharStyle.getFill()?.getColor();
    assert(biharFill === 'rgba(241, 245, 249, 0.72)', 'STYLE-BIHAR-FILL', `Bihar fill is strictly neutral slate (${biharFill})`);

    // Check Disputed Sliver: unmonitored -> neutral slate rgba(241, 245, 249, 0.72)
    const sliverFeature = olFeaturesThermal.find((f: any) => f.get('state_name') === 'DISPUTED (WEST BENGAL, BIHAR & JHARKHAND)');
    const sliverStyle = (styleFnThermal(sliverFeature, 1) as any);
    const sliverFill = sliverStyle.getFill()?.getColor();
    assert(sliverFill === 'rgba(241, 245, 249, 0.72)', 'STYLE-SLIVER-FILL', `Disputed sliver fill is strictly neutral slate (${sliverFill})`);
  }

  // Switch to heat_conditions mode
  const statesLayerHeat = createNationalStatesLayer(geojson, realisticStateMetrics, {
    activeLayer: 'heat_conditions',
  });
  const olFeaturesHeat = statesLayerHeat.getSource()?.getFeatures() || [];
  const styleFnHeat = statesLayerHeat.getStyleFunction();

  if (styleFnHeat) {
    // West Bengal: High (42.5°C) -> rgba(249, 115, 22, 0.50), stroke: #ea580c
    const wbFeature = olFeaturesHeat.find((f: any) => f.get('state_name') === 'WEST BENGAL');
    const wbStyle = (styleFnHeat(wbFeature, 1) as any);
    const wbFill = wbStyle.getFill()?.getColor();
    assert(wbFill === 'rgba(249, 115, 22, 0.50)', 'STYLE-HEAT-WB-FILL', `West Bengal switched to High heat fill (${wbFill})`);

    // Karnataka: Normal (31.5°C) -> rgba(59, 130, 246, 0.45), stroke: #2563eb
    const kaFeature = olFeaturesHeat.find((f: any) => f.get('state_name') === 'KARNATAKA');
    const kaStyle = (styleFnHeat(kaFeature, 1) as any);
    const kaFill = kaStyle.getFill()?.getColor();
    assert(kaFill === 'rgba(59, 130, 246, 0.45)', 'STYLE-HEAT-KA-FILL', `Karnataka switched to Normal heat fill (${kaFill})`);
  }

  // -------------------------------------------------------------------------
  // SECTION 8: Adversarial Edge Cases & Crash Immunity Stress Testing
  // -------------------------------------------------------------------------
  console.log('\n--- [SECTION 8] Adversarial Edge Cases & Crash Immunity Stress Testing ---');

  // Case 1: Empty properties object
  const edge1 = simulateStateHover({}, 'thermal_stress', realisticStateMetrics);
  assert(edge1.stateName === 'Unknown Region', 'EDGE-EMPTY-PROPS-NAME', 'Empty props returns Unknown Region without crashing');
  assert(edge1.category === 'Regional Baseline / Unmonitored', 'EDGE-EMPTY-PROPS-CAT', 'Empty props returns Regional Baseline');

  // Case 2: Null / undefined state name values
  const edge2 = simulateStateHover({ state_name: null, STATE: undefined }, 'heat_conditions');
  assert(edge2.stateName === 'Unknown Region', 'EDGE-NULL-NAME', 'Null/undefined state name handled gracefully');

  // Case 3: Empty metrics dictionary
  const edge3 = simulateStateHover({ state_name: 'MAHARASHTRA' }, 'thermal_stress', {});
  assert(edge3.category === 'Regional Baseline / Unmonitored', 'EDGE-EMPTY-METRICS', 'Empty metrics defaults to unmonitored baseline');

  // Case 4: Extreme temperature values in metric (60°C Extreme, -10°C Normal)
  const edge4a = simulateStateHover({ state_name: 'TEST_EXTREME' }, 'heat_conditions', {
    test_extreme: { stateName: 'Test Extreme', temperature: 60.0 },
  });
  assert(edge4a.category === 'Extreme', 'EDGE-60C-EXTREME', '60°C temperature triggers Extreme category');

  const edge4b = simulateStateHover({ state_name: 'TEST_COLD' }, 'heat_conditions', {
    test_cold: { stateName: 'Test Cold', temperature: -10.0 },
  });
  assert(edge4b.category === 'Normal', 'EDGE-COLD-NORMAL', '-10°C temperature triggers Normal category');

  // Case 5: Extreme WBGT values (40°C Severe, 15°C Low)
  const edge5a = simulateStateHover({ state_name: 'TEST_WBGT_HOT' }, 'thermal_stress', {
    test_wbgt_hot: { stateName: 'Test WBGT Hot', wbgt: 40.0 },
  });
  assert(edge5a.category === 'Severe', 'EDGE-40WBGT-SEVERE', '40°C WBGT triggers Severe category');

  const edge5b = simulateStateHover({ state_name: 'TEST_WBGT_MILD' }, 'thermal_stress', {
    test_wbgt_mild: { stateName: 'Test WBGT Mild', wbgt: 15.0 },
  });
  assert(edge5b.category === 'Low', 'EDGE-15WBGT-LOW', '15°C WBGT triggers Low category');

  // Case 6: Clamped cursor coordinates at boundary edges
  const edge6Left = simulateStateHover({ state_name: 'BIHAR' }, 'heat_conditions', realisticStateMetrics, [10, 200], 800);
  assert(edge6Left.x === 140, 'EDGE-CLAMP-LEFT', `Left boundary clamped at 140px (got ${edge6Left.x})`);

  const edge6Right = simulateStateHover({ state_name: 'BIHAR' }, 'heat_conditions', realisticStateMetrics, [790, 200], 800);
  assert(edge6Right.x === 660, 'EDGE-CLAMP-RIGHT', `Right boundary clamped at containerWidth - 140 = 660px (got ${edge6Right.x})`);

  // -------------------------------------------------------------------------
  // SECTION 9: Bhuvan Basemap Layer Routing Verification
  // -------------------------------------------------------------------------
  console.log('\n--- [SECTION 9] Bhuvan Basemap Layer Routing Verification ---');

  assert(PAN_INDIA_BHUVAN_LAYER === 'sisdp_base:sisdp_basemap', 'BHUVAN-PAN-LAYER', 'PAN_INDIA_BHUVAN_LAYER is sisdp_base:sisdp_basemap');
  assert(DEFAULT_BHUVAN_LAYER === 'sisdp_base:sisdp_basemap', 'BHUVAN-DEF-LAYER', 'DEFAULT_BHUVAN_LAYER defaults to pan-India layer');
  assert(BHUVAN_DEFAULT_LAYER === 'sisdp_base:sisdp_basemap', 'BHUVAN-MAP-CONFIG-DEF-LAYER', 'BHUVAN_DEFAULT_LAYER in map-config defaults to pan-India layer');
  assert(LEGACY_BHUVAN_LAYER === 'lulc:BR_LULC50K_1112', 'BHUVAN-LEGACY-LAYER', 'LEGACY_BHUVAN_LAYER is preserved for backward compatibility');

  // Scope routing
  assert(getBhuvanLayerForScope(true) === 'sisdp_base:sisdp_basemap', 'ROUTE-NATIONAL', 'National scope routes to pan-India basemap');
  assert(getBhuvanLayerForScope(false, 'bengaluru') === 'lulc:KA_LULC50K_1112', 'ROUTE-BLR', 'Bengaluru routes to KA LULC');
  assert(getBhuvanLayerForScope(false, 'pune') === 'lulc:MH_LULC50K_1112', 'ROUTE-PUNE', 'Pune routes to MH LULC');
  assert(getBhuvanLayerForScope(false, 'mumbai') === 'lulc:MH_LULC50K_1112', 'ROUTE-MUMBAI', 'Mumbai routes to MH LULC');
  assert(getBhuvanLayerForScope(false, 'kolkata') === 'lulc:WB_LULC50K_1112', 'ROUTE-KOLKATA', 'Kolkata routes to WB LULC');
  assert(getBhuvanLayerForScope(false, 'chennai') === 'lulc:TN_LULC50K_1112', 'ROUTE-CHENNAI', 'Chennai routes to TN LULC');
  assert(getBhuvanLayerForScope(false, 'coimbatore') === 'lulc:TN_LULC50K_1112', 'ROUTE-CBE', 'Coimbatore routes to TN LULC');
  assert(getBhuvanLayerForScope(false, 'patna') === 'sisdp_base:sisdp_basemap', 'ROUTE-UNMON', 'Unmonitored city routes cleanly to pan-India basemap');

  // -------------------------------------------------------------------------
  // FINAL REPORT
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('  CHALLENGER 1 EMPIRICAL ADVERSARIAL TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total Assertions: ${result.total}`);
  console.log(`  Passed Checks:    ${result.passed}`);
  console.log(`  Failed Checks:    ${result.failed}`);
  console.log(`  Success Rate:     ${((result.passed / result.total) * 100).toFixed(1)}%`);
  console.log('='.repeat(80) + '\n');

  if (result.failed > 0) {
    console.error('FAILURES DETECTED:');
    result.failures.forEach((f) => console.error(f));
    process.exit(1);
  } else {
    console.log('VERDICT: ALL 40 GEOJSON FEATURES & ADVERSARIAL HARNESS CHECKS PASSED EMPIRICALLY!\n');
    process.exit(0);
  }
}

runAdversarialStateHoverChallenge().catch((err) => {
  console.error('Unhandled fatal error in test suite:', err);
  process.exit(1);
});
