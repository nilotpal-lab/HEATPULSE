'use client';

/**
 * HeatPulse — Twin Ward Comparison Demo Component
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 *
 * The key demo moment: shows two wards at the same temperature with
 * dramatically different risk grades, demonstrating why vulnerability-
 * weighted assessment is essential for effective heat early warning.
 *
 * "The same temperature is survivable in dry air and lethal in humid air."
 * — equally, the same temperature is low-risk in a green suburb and
 * high-risk in a dense, elderly-heavy commercial ward with no tree cover.
 */

import { useState, useEffect } from 'react';

interface TwinWardData {
  ward_name: string;
  ward_id: string;
  thermal: {
    temperature: number;
    humidity: number;
    heat_index: number;
    wbgt: number;
    thermal_stress: string;
  };
  vulnerability: {
    score: number;
    level: string;
    green_space_pct: number;
    building_density: number;
    outdoor_worker_density: number;
    is_estimated_baseline: boolean;
    data_source: string;
    census?: {
      population: number;
      elderly_pct: number;
      outdoor_workers_pct: number;
      slum_pct: number;
    };
  };
  composite_risk: {
    score: number;
    level: string;
    contributing_factors: {
      atmospheric_pct: number;
      vulnerability_pct: number;
      primary_driver: string;
    };
  };
  advisory: {
    grade: string;
    headline: string;
    summary: string;
    public_guidance: string[];
    vulnerable_population_guidance: string[];
    municipal_actions_count: number;
    healthcare_level: string;
  };
}

interface TwinWardResponse {
  success: boolean;
  city_id: string;
  forecast_metadata?: {
    provider: string;
    run_time: string;
  };
  demonstration: {
    title: string;
    explanation: string;
    key_insight: string;
  };
  low_vulnerability_ward: TwinWardData;
  high_vulnerability_ward: TwinWardData;
  comparison_metrics: {
    vulnerability_score_gap: number;
    composite_risk_gap: number;
    green_space_gap: number;
    same_advisory_grade: boolean;
  };
}

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  green: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  yellow: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

const RISK_COLORS: Record<string, string> = {
  Low: '#22c55e',
  Moderate: '#3b82f6',
  High: '#ea580c',
  Severe: '#dc2626',
};

function GradeBadge({ grade, label }: { grade: string; label: string }) {
  const colors = GRADE_COLORS[grade] || GRADE_COLORS.green;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
      {grade === 'red' && '🔴 '}
      {grade === 'orange' && '🟠 '}
      {grade === 'yellow' && '🟡 '}
      {grade === 'green' && '🟢 '}
      {label}
    </span>
  );
}

function ScoreBar({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium" style={{ color }}>{value.toFixed(1)}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function WardCard({ ward, label }: { ward: TwinWardData; label: string }) {
  const gradeColors = GRADE_COLORS[ward.advisory.grade] || GRADE_COLORS.green;

  return (
    <div className={`rounded-xl border-2 p-6 space-y-4 ${gradeColors.border} ${gradeColors.bg}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</div>
          <h3 className="text-lg font-bold text-gray-900">{ward.ward_name}</h3>
        </div>
        <GradeBadge grade={ward.advisory.grade} label={ward.advisory.healthcare_level} />
      </div>

      {/* Thermal Conditions (identical) */}
      <div className="bg-white/60 rounded-lg p-4 space-y-2">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          🌡️ Thermal Conditions
          <span className="text-xs font-normal text-gray-400">(identical NWP forecast)</span>
        </h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Temperature</span>
            <p className="font-bold text-lg">{ward.thermal.temperature}°C</p>
          </div>
          <div>
            <span className="text-gray-500">Humidity</span>
            <p className="font-bold text-lg">{ward.thermal.humidity}%</p>
          </div>
          <div>
            <span className="text-gray-500">Heat Index</span>
            <p className="font-bold text-lg">{ward.thermal.heat_index}°C</p>
          </div>
          <div>
            <span className="text-gray-500">WBGT</span>
            <p className="font-bold text-lg">{ward.thermal.wbgt}°C</p>
          </div>
        </div>
      </div>

      {/* Vulnerability Profile (different) */}
      <div className="bg-white/60 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          🏘️ Vulnerability Profile
          <span className="text-xs font-normal text-gray-400">(ward-specific)</span>
        </h4>
        <div className="space-y-2">
          <ScoreBar label="Vulnerability Score" value={ward.vulnerability.score} color={RISK_COLORS[ward.vulnerability.level] || '#888'} />
          <ScoreBar label="Green Space" value={ward.vulnerability.green_space_pct} max={25} color="#22c55e" />
          <ScoreBar label="Building Density" value={ward.vulnerability.building_density * 100} color="#f59e0b" />
          <ScoreBar label="Outdoor Worker Density" value={ward.vulnerability.outdoor_worker_density * 100} color="#ef4444" />
        </div>
        {ward.vulnerability.census && (
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 pt-2 border-t border-gray-200">
            <div>Population: <span className="font-medium">{ward.vulnerability.census.population.toLocaleString('en-IN')}</span></div>
            <div>Elderly (60+): <span className="font-medium">{ward.vulnerability.census.elderly_pct}%</span></div>
            <div>Outdoor Workers: <span className="font-medium">{ward.vulnerability.census.outdoor_workers_pct}%</span></div>
            <div>Slum Households: <span className="font-medium">{ward.vulnerability.census.slum_pct}%</span></div>
          </div>
        )}
        <div className="text-xs text-gray-400 pt-1">{ward.vulnerability.data_source}</div>
      </div>

      {/* Composite Risk */}
      <div className="bg-white/60 rounded-lg p-4 space-y-2">
        <h4 className="text-sm font-semibold text-gray-700">⚡ Composite Risk</h4>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold" style={{ color: RISK_COLORS[ward.composite_risk.level] || '#888' }}>
            {ward.composite_risk.score}
          </span>
          <span className="text-sm text-gray-500">/100</span>
          <GradeBadge grade={ward.advisory.grade} label={ward.composite_risk.level} />
        </div>
        <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-gray-100">
          <div
            className="bg-blue-500 transition-all"
            style={{ width: `${ward.composite_risk.contributing_factors.atmospheric_pct}%` }}
            title={`Atmospheric: ${ward.composite_risk.contributing_factors.atmospheric_pct}%`}
          />
          <div
            className="bg-orange-500 transition-all"
            style={{ width: `${ward.composite_risk.contributing_factors.vulnerability_pct}%` }}
            title={`Vulnerability: ${ward.composite_risk.contributing_factors.vulnerability_pct}%`}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>Atmospheric {ward.composite_risk.contributing_factors.atmospheric_pct}%</span>
          <span>Vulnerability {ward.composite_risk.contributing_factors.vulnerability_pct}%</span>
        </div>
        <p className="text-xs text-gray-600 italic">{ward.composite_risk.contributing_factors.primary_driver}</p>
      </div>

      {/* Advisory */}
      <div className="bg-white/60 rounded-lg p-4 space-y-2">
        <h4 className="text-sm font-semibold text-gray-700">📋 Health Advisory</h4>
        <p className="text-sm font-medium text-gray-800">{ward.advisory.headline}</p>
        <p className="text-xs text-gray-600">{ward.advisory.summary}</p>
        <div className="text-xs text-gray-500">
          {ward.advisory.municipal_actions_count} municipal actions • Healthcare level: {ward.advisory.healthcare_level}
        </div>
      </div>
    </div>
  );
}

export default function TwinWardComparison() {
  const [data, setData] = useState<TwinWardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/twin-ward?city=pune');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load twin ward data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-600">Loading twin ward comparison...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg">⚠️ {error || 'No data available'}</p>
        <p className="text-sm mt-2">Ensure weather forecasts are available for Pune.</p>
      </div>
    );
  }

  const { low_vulnerability_ward: low, high_vulnerability_ward: high, comparison_metrics: metrics, demonstration } = data;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">{demonstration.title}</h1>
        <p className="text-gray-600 max-w-3xl mx-auto">{demonstration.explanation}</p>
      </div>

      {/* Twin Ward Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <WardCard ward={low} label="Lower Vulnerability Ward" />
        <WardCard ward={high} label="Higher Vulnerability Ward" />
      </div>

      {/* Key Insight */}
      <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-xl p-6 border border-blue-100">
        <h3 className="text-lg font-bold text-gray-900 mb-3">💡 Key Insight</h3>
        <p className="text-gray-700 leading-relaxed">{demonstration.key_insight}</p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{metrics.vulnerability_score_gap.toFixed(0)}</div>
            <div className="text-xs text-gray-500">Vulnerability Gap</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{metrics.composite_risk_gap.toFixed(0)}</div>
            <div className="text-xs text-gray-500">Risk Score Gap</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{metrics.green_space_gap.toFixed(0)}%</div>
            <div className="text-xs text-gray-500">Green Space Gap</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{metrics.same_advisory_grade ? 'Same' : 'Different'}</div>
            <div className="text-xs text-gray-500">Advisory Grade</div>
          </div>
        </div>
      </div>

      {/* Attribution */}
      <div className="text-center text-xs text-gray-400">
        {data.forecast_metadata && (
          <p>Forecast: {data.forecast_metadata.provider} | Run: {new Date(data.forecast_metadata.run_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
        )}
        <p className="mt-1">{demonstration.title}</p>
      </div>
    </div>
  );
}
