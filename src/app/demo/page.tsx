'use client';

/**
 * HeatPulse — Demo Page: Twin Ward Comparison
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 *
 * The key demo moment for SIH26083: shows two wards at the same temperature
 * with dramatically different risk grades, demonstrating why vulnerability-
 * weighted assessment is essential for effective heat early warning.
 *
 * "Show two wards at the same temperature with different alert grades —
 * teaches the judge why the product needs to exist and demonstrates that
 * it works in seconds."
 */

import dynamic from 'next/dynamic';
import { AlertTriangle } from 'lucide-react';

const TwinWardComparison = dynamic(
  () => import('@/components/demo/TwinWardComparison'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-600">Loading twin ward comparison...</span>
      </div>
    ),
  }
);

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-zinc-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-8 py-6 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
              Demo: Why Vulnerability-Weighted Heat Risk Matters
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-600 max-w-4xl leading-relaxed">
            This demonstration shows two wards experiencing the <strong>identical temperature</strong> from
            the same NWP forecast grid, yet receiving <strong>different risk grades</strong> because
            thermal stress interacts with ward-level vulnerability — elderly density, outdoor worker
            concentration, green space deficit, and built environment. This is why a simple
            temperature-based heat warning system is insufficient for effective municipal response.
          </p>
        </div>
      </div>

      {/* Demo Content */}
      <div className="mt-6">
        <TwinWardComparison />
      </div>

      {/* Bottom Context */}
      <div className="max-w-6xl mx-auto px-6 mt-12">
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-zinc-900">About This Demonstration</h2>
          <div className="text-sm text-zinc-600 space-y-3 leading-relaxed">
            <p>
              <strong>The Problem:</strong> Current Indian heat warnings rely on air temperature alone,
              but &ldquo;the same temperature is survivable in dry air and lethal in humid air&rdquo; — the body&rsquo;s
              capacity to shed heat is impaired in humid conditions, and the same dry-bulb temperature
              produces vastly different physiological stress depending on vulnerability factors.
            </p>
            <p>
              <strong>HeatPulse&rsquo;s Solution:</strong> A composite risk system that combines biometeorological
              thermal stress (Heat Index, WBGT) with ward-level vulnerability (elderly density, outdoor
              worker exposure, green space deficit, building density) to produce differentiated risk grades
              and targeted municipal action briefings.
            </p>
            <p>
              <strong>Data Sources:</strong> Thermal stress computed from Open-Meteo NWP grid forecasts
              (ECMWF IFS / GFS seamless). Vulnerability derived from Census of India 2011 (district-level
              age/worker proportions applied to wards), PMC urban infrastructure surveys, and NFHS-5
              Maharashtra health indicators. All baselines transparently labeled.
            </p>
            <p className="text-xs text-zinc-400 pt-2">
              SIH26083 · Ministry of Earth Sciences (MoES) · National Centre for Medium Range Weather Forecasting (NCMRWF)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
