'use client';

import { useEffect, useState } from 'react';

interface HeatwaveModelMetadata {
  connected: boolean;
  source_dataset: string;
  source_url: string;
  target: string;
  health_outcome_model: false;
}

interface PortableFeatures {
  temperature_c: number;
  tmax_c: number;
  tmin_c: number;
  dewpoint_c: number;
  wind_speed: number;
  radiation: number;
  latitude: number;
  longitude: number;
  month: number;
  day: number;
}

export default function HeatwaveModelStatus({ features }: { features: PortableFeatures | null }) {
  const [metadata, setMetadata] = useState<HeatwaveModelMetadata | null>(null);
  const [score, setScore] = useState<{ heatwave_probability: number; heatwave_prediction: number } | null>(null);

  useEffect(() => {
    fetch('/api/heatwave')
      .then((response) => response.ok ? response.json() : null)
      .then((value) => setMetadata(value))
      .catch(() => setMetadata(null));
  }, []);

  useEffect(() => {
    if (!features) return;
    fetch('/api/heatwave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(features) })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => setScore(value))
      .catch(() => setScore(null));
  }, [features]);

  return (
    <section aria-label="Heatwave model status" className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">ML Heatwave Pattern Classifier</p>
          <h2 className="mt-1 text-sm font-bold text-sky-950">{metadata?.connected ? 'Logistic Regression — Model Connected' : 'Loading model…'}</h2>
        </div>
          <span className="rounded-full border border-sky-300 bg-white px-2 py-1 text-[10px] font-bold text-sky-800">Transfer: ERA5 / Rajasthan</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-sky-900">
        Portable logistic regression trained on ERA5-derived Rajasthan heatwave data (2006-2025, Kaggle CC BY-SA 4.0). NWP ward-centroid forecasts are converted to the training schema for inference. Transfer scores outside Rajasthan are <strong>indicative only</strong> — not locally validated.
      </p>
      {metadata && (
        <p className="mt-2 text-[10px] text-sky-700">
          Target: <strong>{metadata.target}</strong> &nbsp;·&nbsp; Clinical model: <strong>false</strong> &nbsp;·&nbsp; Relative risk proxy only
        </p>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-sky-200 pt-3 text-xs text-sky-900">
        <span>NWP-derived transfer probability</span>
        <strong>{score ? `${(score.heatwave_probability * 100).toFixed(1)}% · ${score.heatwave_prediction ? 'Pattern signal detected' : 'No pattern signal'}` : 'Awaiting NWP forecast data'}</strong>
      </div>
    </section>
  );
}