import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const trainingDir = path.join(root, 'data', 'training');
const registryPath = path.join(trainingDir, 'geography-registry.json');
const datasetPath = path.join(trainingDir, 'nasa-power-state-daily.jsonl');
const modelPath = path.join(trainingDir, 'nasa-power-thermal-model.json');
const start = '20000101';
const end = '20241231';
const parameters = ['T2M', 'RH2M', 'WS10M', 'ALLSKY_SFC_SW_DWN', 'PRECTOTCORR'];

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const locations = registry.records.filter((record) => record.record_type === 'state_or_union_territory');
const rows = [];

for (const location of locations) {
  const [longitude, latitude] = location.coordinates;
  const url = new URL('https://power.larc.nasa.gov/api/temporal/daily/point');
  url.search = new URLSearchParams({
    parameters: parameters.join(','),
    community: 'AG',
    longitude: String(longitude),
    latitude: String(latitude),
    start,
    end,
    format: 'JSON',
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`NASA POWER request failed for ${location.id}: ${response.status}`);
  const payload = await response.json();
  const values = payload.properties?.parameter ?? {};
  const dates = Object.keys(values.T2M ?? {});
  for (const date of dates) {
    const temperature = values.T2M[date];
    const humidity = values.RH2M?.[date];
    const wind = values.WS10M?.[date];
    const radiation = values.ALLSKY_SFC_SW_DWN?.[date];
    const rainfall = values.PRECTOTCORR?.[date];
    if (![temperature, humidity, wind, radiation, rainfall].every(Number.isFinite)) continue;
    const heatIndex = temperature + Math.max(0, humidity - 40) * 0.08;
    const wbgt = 0.567 * temperature + 0.393 * ((humidity / 100) * 6.108 * Math.exp((17.27 * temperature) / (237.3 + temperature))) + 3.94;
    const thermalScore = 0.65 * heatIndex + 0.35 * wbgt;
    rows.push({ date, location_id: location.id, state: location.name, temperature, humidity, wind, radiation, rainfall, heat_index: heatIndex, wbgt, thermal_score: thermalScore, thermal_stress_band: thermalScore >= 38 ? 1 : 0 });
  }
  console.log(`${location.name}: ${dates.length} daily records`);
}

rows.sort((left, right) => left.date.localeCompare(right.date) || left.location_id.localeCompare(right.location_id));
fs.mkdirSync(trainingDir, { recursive: true });
fs.writeFileSync(datasetPath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');

const featureNames = ['temperature', 'humidity', 'wind', 'radiation', 'rainfall', 'heat_index', 'wbgt'];
const trainCutoff = '2022-01-01';
const trainRows = rows.filter((row) => row.date < trainCutoff);
const testRows = rows.filter((row) => row.date >= trainCutoff);
const means = Object.fromEntries(featureNames.map((name) => [name, trainRows.reduce((sum, row) => sum + row[name], 0) / trainRows.length]));
const scales = Object.fromEntries(featureNames.map((name) => [name, Math.sqrt(trainRows.reduce((sum, row) => sum + (row[name] - means[name]) ** 2, 0) / trainRows.length) || 1]));
const vectorize = (row) => featureNames.map((name) => (row[name] - means[name]) / scales[name]);
const sigmoid = (value) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value))));
const dot = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);
let weights = Array(featureNames.length).fill(0);
let intercept = 0;
for (let epoch = 0; epoch < 350; epoch += 1) {
  const gradients = Array(featureNames.length).fill(0);
  let interceptGradient = 0;
  for (const row of trainRows) {
    const features = vectorize(row);
    const error = sigmoid(intercept + dot(features, weights)) - row.thermal_stress_band;
    features.forEach((value, index) => { gradients[index] += error * value; });
    interceptGradient += error;
  }
  weights = weights.map((weight, index) => weight - 0.05 * gradients[index] / trainRows.length);
  intercept -= 0.05 * interceptGradient / trainRows.length;
}
const accuracy = testRows.reduce((correct, row) => correct + (Number(sigmoid(intercept + dot(vectorize(row), weights)) >= 0.5) === row.thermal_stress_band ? 1 : 0), 0) / testRows.length;
fs.writeFileSync(modelPath, `${JSON.stringify({ model_type: 'logistic_regression_weather_benchmark', target: 'thermal_stress_band', label_source: 'derived_from_real_nasa_power_weather', health_outcome_model: false, source: 'NASA POWER daily point API', source_url: 'https://power.larc.nasa.gov/api/temporal/daily/point', date_range: { start, end }, locations: locations.length, rows: rows.length, train_rows: trainRows.length, test_rows: testRows.length, time_split: trainCutoff, test_accuracy: Number(accuracy.toFixed(4)), features: featureNames, means, scales, intercept, weights, warning: 'Weather/thermal benchmark only. This does not predict mortality, hospitalization, or heat illness.' }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ datasetPath, modelPath, rows: rows.length, testAccuracy: Number(accuracy.toFixed(4)) }, null, 2));