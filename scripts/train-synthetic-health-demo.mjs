import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const trainingDir = path.join(root, 'data', 'training');
const datasetPath = path.join(trainingDir, 'synthetic-health-demo.csv');
const modelPath = path.join(trainingDir, 'synthetic-health-demo-model.json');
const featureNames = ['temperature', 'humidity', 'heatIndex', 'wbgt', 'vulnerability', 'population'];
const rows = [];

for (let index = 0; index < 12000; index += 1) {
  const temperature = 28 + ((index * 19) % 170) / 10;
  const humidity = 35 + ((index * 31) % 610) / 10;
  const heatIndex = temperature + Math.max(0, humidity - 40) * 0.08;
  const wbgt = 0.567 * temperature + 0.393 * ((humidity / 100) * 6.108 * Math.exp((17.27 * temperature) / (237.3 + temperature))) + 3.94;
  const vulnerability = 15 + ((index * 23) % 800) / 10;
  const population = 10000 + ((index * 47) % 90000);
  const pressure = 0.045 * heatIndex + 0.035 * wbgt + 0.018 * vulnerability + 0.000002 * population;
  const mortalityProbability = 1 / (1 + Math.exp(-(pressure - 2.9)));
  const hospitalizationProbability = 1 / (1 + Math.exp(-(pressure - 2.45)));
  const deterministicNoise = (Math.sin(index * 12.9898) * 43758.5453) % 1;
  rows.push({ temperature, humidity, heatIndex, wbgt, vulnerability, population, syntheticMortalityEvent: mortalityProbability + deterministicNoise * 0.08 > 0.5 ? 1 : 0, syntheticHospitalizationEvent: hospitalizationProbability + deterministicNoise * 0.08 > 0.5 ? 1 : 0 });
}

const trainRows = rows.slice(0, 9600);
const testRows = rows.slice(9600);
const means = Object.fromEntries(featureNames.map((name) => [name, trainRows.reduce((sum, row) => sum + row[name], 0) / trainRows.length]));
const scales = Object.fromEntries(featureNames.map((name) => [name, Math.sqrt(trainRows.reduce((sum, row) => sum + (row[name] - means[name]) ** 2, 0) / trainRows.length) || 1]));
const vectorize = (row) => featureNames.map((name) => (row[name] - means[name]) / scales[name]);
const sigmoid = (value) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value))));
const dot = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);

function train(targetName) {
  let weights = Array(featureNames.length).fill(0);
  let intercept = 0;
  for (let epoch = 0; epoch < 450; epoch += 1) {
    const gradients = Array(featureNames.length).fill(0);
    let interceptGradient = 0;
    for (const row of trainRows) {
      const features = vectorize(row);
      const error = sigmoid(intercept + dot(features, weights)) - row[targetName];
      features.forEach((value, index) => { gradients[index] += error * value; });
      interceptGradient += error;
    }
    weights = weights.map((weight, index) => weight - 0.08 * gradients[index] / trainRows.length);
    intercept -= 0.08 * interceptGradient / trainRows.length;
  }
  const accuracy = testRows.reduce((correct, row) => correct + (Number(sigmoid(intercept + dot(vectorize(row), weights)) >= 0.5) === row[targetName] ? 1 : 0), 0) / testRows.length;
  return { target: targetName, intercept, weights, testAccuracy: Number(accuracy.toFixed(4)) };
}

const csv = [
  'temperature,humidity,heat_index,wbgt,vulnerability,population,synthetic_mortality_event,synthetic_hospitalization_event,label_source',
  ...rows.map((row) => [row.temperature, row.humidity, row.heatIndex, row.wbgt, row.vulnerability, row.population, row.syntheticMortalityEvent, row.syntheticHospitalizationEvent, 'synthetic_demo'].join(',')),
].join('\n');
fs.mkdirSync(trainingDir, { recursive: true });
fs.writeFileSync(datasetPath, `${csv}\n`, 'utf8');
fs.writeFileSync(modelPath, `${JSON.stringify({ model_type: 'synthetic_health_pipeline_demo', health_outcome_model: false, label_source: 'synthetic_demo', training_rows: trainRows.length, test_rows: testRows.length, time_split: 'first 80% train, final 20% test', features: featureNames, means, scales, models: { mortality: train('syntheticMortalityEvent'), hospitalization: train('syntheticHospitalizationEvent') }, warning: 'Synthetic clinical-like benchmark only. Not observed mortality or hospitalization data. Do not use for clinical, public-health, or production claims.' }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ datasetPath, modelPath, rows: rows.length, mortalityAccuracy: train('syntheticMortalityEvent').testAccuracy, hospitalizationAccuracy: train('syntheticHospitalizationEvent').testAccuracy }, null, 2));