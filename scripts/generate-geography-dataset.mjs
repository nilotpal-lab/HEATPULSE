import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stateRegistryPath = path.join(root, 'src', 'lib', 'india-state-centroids.ts');
const outputPath = path.join(root, 'data', 'training', 'geography-registry.json');
const stateSource = fs.readFileSync(stateRegistryPath, 'utf8');

const states = [];
const statePattern = /stateKey:\s*'([^']+)'[\s\S]*?stateName:\s*'([^']+)'[\s\S]*?capital:\s*'([^']+)'[\s\S]*?coordinates:\s*\[([^,]+),\s*([^\]]+)\][\s\S]*?isoCode:\s*'([^']+)'/g;
for (const match of stateSource.matchAll(statePattern)) {
  states.push({
    record_type: 'state_or_union_territory',
    id: match[6].toLowerCase(),
    name: match[2],
    state_key: match[1],
    capital: match[3],
    coordinates: [Number(match[4]), Number(match[5])],
    iso_code: match[6],
    coordinate_role: 'capital_sampling_point',
    source: 'heatpulse/src/lib/india-state-centroids.ts',
    data_status: 'verified_registry_metadata',
  });
}

const districts = [
  ['bengaluru-urban', 'Bengaluru Urban', 'Karnataka', 'bengaluru'],
  ['pune', 'Pune', 'Maharashtra', 'pune'],
  ['mumbai-suburban', 'Mumbai Suburban', 'Maharashtra', 'mumbai'],
  ['kolkata', 'Kolkata', 'West Bengal', 'kolkata'],
  ['chennai', 'Chennai', 'Tamil Nadu', 'chennai'],
  ['coimbatore', 'Coimbatore', 'Tamil Nadu', 'coimbatore'],
].map(([id, name, state, cityId]) => ({
  record_type: 'monitored_district',
  id,
  name,
  state,
  city_id: cityId,
  source: 'heatpulse/src/lib/imd-service.ts',
  data_status: 'verified_registry_metadata',
  health_outcomes_present: false,
}));

if (states.length !== 36) {
  throw new Error(`Expected 36 canonical States/UTs, found ${states.length}.`);
}

const dataset = {
  dataset_name: 'HeatPulse Geography Registry',
  generated_at: '2026-09-08',
  purpose: 'Training-data geography join registry only',
  warning: 'This dataset contains geography metadata only. It contains no mortality, hospitalization, population, vulnerability, or synthetic health labels.',
  records: [...states, ...districts],
  counts: {
    states_and_union_territories: states.length,
    monitored_districts: districts.length,
    total_records: states.length + districts.length,
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, counts: dataset.counts }, null, 2));