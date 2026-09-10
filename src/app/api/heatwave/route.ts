import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

const modelPath = path.join(process.cwd(), 'data', 'training', 'portable-heatwave-model.json');

async function loadModel() {
  return JSON.parse(await readFile(modelPath, 'utf8')) as {
    model_type: string;
    target: string;
    source_dataset: string;
    source_url: string;
    health_outcome_model: false;
    features: string[];
    means: Record<string, number>;
    scales: Record<string, number>;
    weights: number[];
    intercept: number;
    metrics: Record<string, unknown>;
    portable_across_cities: true;
    threshold: number;
    warning: string;
  };
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value))));
}

export async function GET() {
  const model = await loadModel();
  return NextResponse.json({
    connected: true,
    model_type: model.model_type,
    target: model.target,
    source_dataset: model.source_dataset,
    source_url: model.source_url,
    health_outcome_model: model.health_outcome_model,
    portable_across_cities: model.portable_across_cities,
    required_features: model.features,
    threshold: model.threshold,
    metrics: model.metrics,
    warning: model.warning,
  });
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as Record<string, unknown>;
    const model = await loadModel();
    const missing = model.features.filter((name) => typeof input[name] !== 'number' || !Number.isFinite(input[name]));
    if (missing.length > 0) {
      return NextResponse.json({ error: 'Missing or invalid portable weather features.', missing_features: missing }, { status: 400 });
    }

    const standardized = model.features.map((name) => (Number(input[name]) - model.means[name]) / model.scales[name]);
    const score = model.intercept + standardized.reduce((sum, value, index) => sum + value * model.weights[index], 0);
    const probability = sigmoid(score);
    return NextResponse.json({
      model_target: model.target,
      health_outcome_model: false,
      portable_across_cities: true,
      heatwave_probability: Number(probability.toFixed(4)),
      heatwave_prediction: probability >= model.threshold ? 1 : 0,
      threshold: model.threshold,
      warning: model.warning,
    });
  } catch {
    return NextResponse.json({ error: 'Unable to load or score the heatwave model.' }, { status: 500 });
  }
}