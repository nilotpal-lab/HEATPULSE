import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const inputPath = path.join(root, 'data', 'training', 'kaggle-rajasthan-heatwave', 'Rajasthan_Heatwave_2006_2025.csv');
const outputPath = path.join(root, 'data', 'training', 'kaggle-rajasthan-heatwave-model.json');
const featureNames = ['WIND_U10', 'WIND_V10', 'MSLP', 'BLH', 'GEOP', 'TEMP2M', 'TMAX', 'TMIN', 'DEW2M', 'CLOUD', 'RAIN', 'SRAD', 'EVAP', 'SOILT1', 'SOILM1', 'LAI', 'LAT', 'LON', 'MONTH', 'DAY'];

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  return lines.map((line) => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

const rawRows = parseCsv(fs.readFileSync(inputPath, 'utf8'));
const rows = rawRows.map((row) => Object.fromEntries([
  ...featureNames.map((name) => [name, Number(row[name])]),
  ['target', Number(row.HEATWAVE)],
  ['year', Number(row.YEAR)],
  ['district', row.DISTRICT],
]));
const trainRows = rows.filter((row) => row.year <= 2018);
const validationRows = rows.filter((row) => row.year >= 2019 && row.year <= 2021);
const testRows = rows.filter((row) => row.year >= 2022);
const positives = trainRows.filter((row) => row.target === 1).length;
const negatives = trainRows.length - positives;
const positiveWeight = negatives / positives;
const highestNormalTmax = Math.max(...trainRows.filter((row) => row.target === 0).map((row) => row.TMAX));
const lowestHeatwaveTmax = Math.min(...trainRows.filter((row) => row.target === 1).map((row) => row.TMAX));
const learnedTmaxThreshold = (highestNormalTmax + lowestHeatwaveTmax) / 2;
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
    const prediction = sigmoid(intercept + dot(features, weights));
    const error = (prediction - row.target) * (row.target === 1 ? positiveWeight : 1);
    features.forEach((value, index) => { gradients[index] += error * value; });
    interceptGradient += error;
  }
  weights = weights.map((weight, index) => weight - 0.035 * gradients[index] / trainRows.length);
  intercept -= 0.035 * interceptGradient / trainRows.length;
}

const confusion = { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 };
for (const row of testRows) {
  const probability = sigmoid(intercept + dot(vectorize(row), weights));
  const predicted = probability >= 0.5 ? 1 : 0;
  if (predicted === 1 && row.target === 1) confusion.truePositive += 1;
  if (predicted === 1 && row.target === 0) confusion.falsePositive += 1;
  if (predicted === 0 && row.target === 0) confusion.trueNegative += 1;
  if (predicted === 0 && row.target === 1) confusion.falseNegative += 1;
}
const precision = confusion.truePositive / Math.max(1, confusion.truePositive + confusion.falsePositive);
const recall = confusion.truePositive / Math.max(1, confusion.truePositive + confusion.falseNegative);
const f1 = (2 * precision * recall) / Math.max(1e-12, precision + recall);
function confusionAtThreshold(candidateRows, threshold) {
  const result = { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 };
  for (const row of candidateRows) {
    const predicted = sigmoid(intercept + dot(vectorize(row), weights)) >= threshold ? 1 : 0;
    if (predicted === 1 && row.target === 1) result.truePositive += 1;
    if (predicted === 1 && row.target === 0) result.falsePositive += 1;
    if (predicted === 0 && row.target === 0) result.trueNegative += 1;
    if (predicted === 0 && row.target === 1) result.falseNegative += 1;
  }
  return result;
}

function metricsFor(confusionResult, rowCount) {
  const precisionValue = confusionResult.truePositive / Math.max(1, confusionResult.truePositive + confusionResult.falsePositive);
  const recallValue = confusionResult.truePositive / Math.max(1, confusionResult.truePositive + confusionResult.falseNegative);
  const f1Value = (2 * precisionValue * recallValue) / Math.max(1e-12, precisionValue + recallValue);
  return { accuracy: (confusionResult.truePositive + confusionResult.trueNegative) / rowCount, precision: precisionValue, recall: recallValue, f1: f1Value };
}

const validationCandidates = Array.from({ length: 96 }, (_, index) => 0.04 + index * 0.01);
const selectedThreshold = validationCandidates
  .map((threshold) => ({ threshold, metrics: metricsFor(confusionAtThreshold(validationRows, threshold), validationRows.length) }))
  .filter((candidate) => candidate.metrics.recall >= 0.9)
  .sort((left, right) => right.metrics.f1 - left.metrics.f1 || right.metrics.precision - left.metrics.precision)[0]?.threshold ?? 0.5;
const selectedTestConfusion = confusionAtThreshold(testRows, selectedThreshold);
const selectedTestMetrics = metricsFor(selectedTestConfusion, testRows.length);
const accuracy = (confusion.truePositive + confusion.trueNegative) / testRows.length;
const thresholdConfusion = { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 };
for (const row of testRows) {
  const predicted = row.TMAX >= learnedTmaxThreshold ? 1 : 0;
  if (predicted === 1 && row.target === 1) thresholdConfusion.truePositive += 1;
  if (predicted === 1 && row.target === 0) thresholdConfusion.falsePositive += 1;
  if (predicted === 0 && row.target === 0) thresholdConfusion.trueNegative += 1;
  if (predicted === 0 && row.target === 1) thresholdConfusion.falseNegative += 1;
}
const thresholdAccuracy = (thresholdConfusion.truePositive + thresholdConfusion.trueNegative) / testRows.length;

fs.writeFileSync(outputPath, `${JSON.stringify({
  model_type: 'logistic_regression_heatwave_classifier',
  source_dataset: 'Kaggle: rupsarroy/heatwave-dataset-rajasthan-india-2006-2025',
  source_url: 'https://www.kaggle.com/datasets/rupsarroy/heatwave-dataset-rajasthan-india-2006-2025',
  source_license: 'CC BY-SA 4.0',
  target: 'HEATWAVE',
  target_meaning: 'Uploaded dataset binary label: 0 normal day, 1 heatwave event',
  health_outcome_model: false,
  rows: rows.length,
  train_rows: trainRows.length,
  validation_rows: validationRows.length,
  test_rows: testRows.length,
  train_years: '2006-2018',
  validation_years: '2019-2021',
  test_years: '2022-2025',
  districts: [...new Set(rows.map((row) => row.district))],
  class_weight_positive: positiveWeight,
  learned_tmax_threshold_kelvin: learnedTmaxThreshold,
  features: featureNames,
  means,
  scales,
  intercept,
  weights,
  metrics: { logistic_regression_default_threshold: { accuracy: Number(accuracy.toFixed(4)), precision: Number(precision.toFixed(4)), recall: Number(recall.toFixed(4)), f1: Number(f1.toFixed(4)), confusion }, logistic_regression_selected_threshold: { threshold: selectedThreshold, ...Object.fromEntries(Object.entries(selectedTestMetrics).map(([key, value]) => [key, Number(value.toFixed(4))])), confusion: selectedTestConfusion }, learned_temperature_threshold: { accuracy: Number(thresholdAccuracy.toFixed(4)), confusion: thresholdConfusion } },
  warning: 'Heatwave classifier only. This does not predict mortality, hospitalization, or clinical outcomes.',
}, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, rows: rows.length, trainRows: trainRows.length, testRows: testRows.length, metrics: { accuracy, precision, recall, f1 }, confusion }, null, 2));