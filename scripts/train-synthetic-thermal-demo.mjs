import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const trainingDir = path.join(root, 'data', 'training');
const datasetPath = path.join(trainingDir, 'synthetic-thermal-demo.csv');
const modelPath = path.join(trainingDir, 'synthetic-thermal-demo-model.json');

fs.mkdirSync(trainingDir, { recursive: true });

const rows = [];
for (let index = 0; index < 240; index += 1) {
  const temperature = 28 + ((index * 7) % 150) / 10;
  const humidity = 38 + ((index * 13) % 520) / 10;
  const heatIndex = temperature + Math.max(0, humidity - 45) * 0.08;
  const wbgt = 0.567 * temperature + 0.393 * (humidity / 10) + 3.94;
  const vulnerability = 20 + ((index * 17) % 700) / 10;
  const stress = 0.55 * heatIndex + 0.25 * wbgt + 0.2 * vulnerability;
  const syntheticEvent = stress >= 44 ? 1 : 0;
  rows.push({ temperature, humidity, heatIndex, wbgt, vulnerability, syntheticEvent });
}

const featureNames = ['temperature', 'humidity', 'heatIndex', 'wbgt', 'vulnerability'];
const means = Object.fromEntries(featureNames.map((name) => [name, rows.reduce((sum, row) => sum + row[name], 0) / rows.length]));
const scales = Object.fromEntries(featureNames.map((name) => [name, Math.sqrt(rows.reduce((sum, row) => sum + (row[name] - means[name]) ** 2, 0) / rows.length) || 1]));
const vectorize = (row) => featureNames.map((name) => (row[name] - means[name]) / scales[name]);
const sigmoid = (value) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value))));
const dot = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);

const split = Math.floor(rows.length * 0.8);
const trainRows = rows.slice(0, split);
const testRows = rows.slice(split);
let weights = Array(featureNames.length).fill(0);
let intercept = 0;
const learningRate = 0.08;

for (let epoch = 0; epoch < 1200; epoch += 1) {
  const gradients = Array(featureNames.length).fill(0);
  let interceptGradient = 0;
  for (const row of trainRows) {
    const prediction = sigmoid(intercept + dot(vectorize(row), weights));
    const error = prediction - row.syntheticEvent;
    const features = vectorize(row);
    features.forEach((value, index) => { gradients[index] += error * value; });
    interceptGradient += error;
  }
  weights = weights.map((weight, index) => weight - learningRate * gradients[index] / trainRows.length);
  intercept -= learningRate * interceptGradient / trainRows.length;
}

const accuracy = testRows.reduce((correct, row) => {
  const probability = sigmoid(intercept + dot(vectorize(row), weights));
  return correct + (Number(probability >= 0.5) === row.syntheticEvent ? 1 : 0);
}, 0) / testRows.length;

const csv = [
  'temperature,humidity,heat_index,wbgt,vulnerability,synthetic_thermal_stress_event,label_source',
  ...rows.map((row) => [row.temperature, row.humidity, row.heatIndex, row.wbgt, row.vulnerability, row.syntheticEvent, 'synthetic_demo'].join(',')),
].join('\n');
fs.writeFileSync(datasetPath, `${csv}\n`, 'utf8');
fs.writeFileSync(modelPath, `${JSON.stringify({
  model_type: 'logistic_regression_demo',
  target: 'synthetic_thermal_stress_event',
  label_source: 'synthetic_demo',
  health_outcome_model: false,
  training_rows: trainRows.length,
  test_rows: testRows.length,
  test_accuracy: Number(accuracy.toFixed(4)),
  features: featureNames,
  means,
  scales,
  intercept,
  weights,
  warning: 'Synthetic pipeline fixture only. Not mortality, hospitalization, or clinical evidence.',
}, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ datasetPath, modelPath, testAccuracy: Number(accuracy.toFixed(4)), trainingRows: trainRows.length, testRows: testRows.length }, null, 2));