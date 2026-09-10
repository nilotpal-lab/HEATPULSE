import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const inputPath = path.join(root, 'data', 'training', 'kaggle-rajasthan-heatwave', 'Rajasthan_Heatwave_2006_2025.csv');
const outputPath = path.join(root, 'data', 'training', 'portable-heatwave-model.json');
const featureNames = ['temperature_c', 'tmax_c', 'tmin_c', 'dewpoint_c', 'wind_speed', 'radiation', 'latitude', 'longitude', 'month', 'day'];

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  return lines.map((line) => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function kelvinToCelsius(value) { return Number(value) - 273.15; }
function convert(row) {
  return {
    temperature_c: kelvinToCelsius(row.TEMP2M),
    tmax_c: kelvinToCelsius(row.TMAX),
    tmin_c: kelvinToCelsius(row.TMIN),
    dewpoint_c: kelvinToCelsius(row.DEW2M),
    wind_speed: Math.sqrt(Number(row.WIND_U10) ** 2 + Number(row.WIND_V10) ** 2),
    radiation: Number(row.SRAD),
    latitude: Number(row.LAT),
    longitude: Number(row.LON),
    month: Number(row.MONTH),
    day: Number(row.DAY),
    target: Number(row.HEATWAVE),
    year: Number(row.YEAR),
    district: row.DISTRICT,
  };
}
const rows = parseCsv(fs.readFileSync(inputPath, 'utf8')).map(convert);
const trainRows = rows.filter((row) => row.year <= 2018);
const validationRows = rows.filter((row) => row.year >= 2019 && row.year <= 2021);
const testRows = rows.filter((row) => row.year >= 2022);
const positives = trainRows.filter((row) => row.target === 1).length;
const positiveWeight = (trainRows.length - positives) / positives;
const means = Object.fromEntries(featureNames.map((name) => [name, trainRows.reduce((sum, row) => sum + row[name], 0) / trainRows.length]));
const scales = Object.fromEntries(featureNames.map((name) => [name, Math.sqrt(trainRows.reduce((sum, row) => sum + (row[name] - means[name]) ** 2, 0) / trainRows.length) || 1]));
const vectorize = (row) => featureNames.map((name) => (row[name] - means[name]) / scales[name]);
const sigmoid = (value) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value))));
const dot = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);
let weights = Array(featureNames.length).fill(0);
let intercept = 0;
for (let epoch = 0; epoch < 700; epoch += 1) {
  const gradients = Array(featureNames.length).fill(0);
  let interceptGradient = 0;
  for (const row of trainRows) {
    const features = vectorize(row);
    const error = (sigmoid(intercept + dot(features, weights)) - row.target) * (row.target === 1 ? positiveWeight : 1);
    features.forEach((value, index) => { gradients[index] += error * value; });
    interceptGradient += error;
  }
  weights = weights.map((weight, index) => weight - 0.035 * gradients[index] / trainRows.length);
  intercept -= 0.035 * interceptGradient / trainRows.length;
}
function metrics(inputRows, threshold) {
  const confusion = { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 };
  for (const row of inputRows) {
    const predicted = sigmoid(intercept + dot(vectorize(row), weights)) >= threshold ? 1 : 0;
    if (predicted === 1 && row.target === 1) confusion.truePositive += 1;
    if (predicted === 1 && row.target === 0) confusion.falsePositive += 1;
    if (predicted === 0 && row.target === 0) confusion.trueNegative += 1;
    if (predicted === 0 && row.target === 1) confusion.falseNegative += 1;
  }
  const precision = confusion.truePositive / Math.max(1, confusion.truePositive + confusion.falsePositive);
  const recall = confusion.truePositive / Math.max(1, confusion.truePositive + confusion.falseNegative);
  const f1 = (2 * precision * recall) / Math.max(1e-12, precision + recall);
  return { accuracy: (confusion.truePositive + confusion.trueNegative) / inputRows.length, precision, recall, f1, confusion };
}
const candidates = Array.from({ length: 96 }, (_, index) => 0.04 + index * 0.01);
const threshold = candidates.map((value) => ({ value, result: metrics(validationRows, value) })).filter((item) => item.result.recall >= 0.9).sort((a, b) => b.result.f1 - a.result.f1)[0]?.value ?? 0.5;
const output = {
  model_type: 'portable_logistic_regression_heatwave_classifier',
  source_dataset: 'Kaggle: rupsarroy/heatwave-dataset-rajasthan-india-2006-2025',
  source_url: 'https://www.kaggle.com/datasets/rupsarroy/heatwave-dataset-rajasthan-india-2006-2025',
  source_license: 'CC BY-SA 4.0',
  target: 'HEATWAVE',
  target_meaning: 'Uploaded dataset binary label: 0 normal day, 1 heatwave event',
  health_outcome_model: false,
  portable_across_cities: true,
  training_domain: 'Nine Rajasthan districts; transfer scoring for compatible meteorological inputs is indicative, not locally validated.',
  rows: rows.length,
  train_rows: trainRows.length,
  validation_rows: validationRows.length,
  test_rows: testRows.length,
  features: featureNames,
  input_units: { temperature_c: 'degC', tmax_c: 'degC', tmin_c: 'degC', dewpoint_c: 'degC', wind_speed: 'm/s', radiation: 'provider radiation units', latitude: 'deg', longitude: 'deg', month: '1-12', day: '1-31' },
  means,
  scales,
  intercept,
  weights,
  threshold,
  metrics: { validation: metrics(validationRows, threshold), test: metrics(testRows, threshold) },
  warning: 'Heatwave classifier only. Transfer predictions outside Rajasthan are indicative and not mortality, hospitalization, or clinical predictions.',
};
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, rows: rows.length, threshold, test: output.metrics.test }, null, 2));