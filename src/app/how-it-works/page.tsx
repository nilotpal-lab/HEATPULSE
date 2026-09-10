'use client';

/**
 * HeatPulse — Page 6: How HeatPulse Works (Scientific Methodology)
 * Conforms to Requirement R4, R5, R6 & PROJECT.md § Page 6: How HeatPulse Works
 *
 * Capabilities:
 * 1. Transparent scientific methodology and biometeorological foundation
 * 2. Strict 5-Concept Scientific Separation
 * 3. Mathematical formula specifications:
 *    - NOAA Rothfusz Heat Index with low/high humidity adjustments
 *    - BoM Simplified Outdoor WBGT with Magnus-Tetens vapor pressure
 *    - UTCI Proxy apparent temperature designation
 *    - Composite Risk formula (alpha=0.6, beta=0.4, / 0.34 scaling)
 * 4. Active data provider metadata and runtime architecture
 * 5. Explicit non-claims & data-truth attestations
 */

import React from 'react';
import {
  Info,
  Calculator,
  Database,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Globe2,
} from 'lucide-react';

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-zinc-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-8 py-6 space-y-4">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-orange-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
              How HeatPulse Works · Scientific Methodology & Transparency
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-600 max-w-4xl leading-relaxed">
            HeatPulse is an India-focused extreme heat early-warning and human thermal-stress
            decision-support platform engineered for Smart India Hackathon 2026 (SIH26083) under the
            auspices of the Ministry of Earth Sciences (MoES) and NCMRWF. This document transparently
            details all equations, biometeorological parameters, data sources, and strict non-claims.
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-8 mt-6 space-y-8">
        {/* ============================================================ */}
        {/* SECTION 1: STRICT 5-CONCEPT SCIENTIFIC SEPARATION */}
        {/* ============================================================ */}
        <section className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange-600" />
            <h2 className="text-base font-bold text-zinc-900">
              1. Strict 5-Concept Scientific Separation (Requirement R4)
            </h2>
          </div>

          <p className="text-xs text-zinc-600 leading-relaxed">
            Conflating atmospheric physics with human physiology or socio-economic vulnerability
            undermines early warning efficacy. HeatPulse strictly segregates five distinct scientific
            domains across data models, backend pipelines, and UI interfaces:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2 text-xs">
            <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-3.5 space-y-1.5">
              <span className="font-mono text-[10px] font-bold text-orange-700 uppercase">Concept 1</span>
              <h3 className="font-bold text-orange-950">Heat Conditions</h3>
              <p className="text-zinc-600 text-[11px] leading-relaxed">
                Atmospheric physical state: dry-bulb 2m air temperature (°C), diurnal range, and
                synoptic advection. (Normal, Elevated, High, Extreme).
              </p>
            </div>

            <div className="bg-red-50/70 border border-red-200 rounded-xl p-3.5 space-y-1.5">
              <span className="font-mono text-[10px] font-bold text-red-700 uppercase">Concept 2</span>
              <h3 className="font-bold text-red-950">Thermal Stress</h3>
              <p className="text-zinc-600 text-[11px] leading-relaxed">
                Human biometeorology: physiological strain combining heat, humidity, radiation, and
                evaporative sweat limits via NOAA HI, BoM WBGT, and UTCI Proxy.
              </p>
            </div>

            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-1.5">
              <span className="font-mono text-[10px] font-bold text-indigo-700 uppercase">Concept 3</span>
              <h3 className="font-bold text-indigo-950">Vulnerability</h3>
              <p className="text-zinc-600 text-[11px] leading-relaxed">
                Socio-ecological baseline context: Census 2011 proxies, outdoor labor density, built-up
                materials, and urban tree canopy coverage.
              </p>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-1.5">
              <span className="font-mono text-[10px] font-bold text-amber-700 uppercase">Concept 4</span>
              <h3 className="font-bold text-amber-950">Composite Risk</h3>
              <p className="text-zinc-600 text-[11px] leading-relaxed">
                Heuristic decision support index combining atmospheric thermal hazard (60%) and
                baseline vulnerability (40%) to prioritize municipal response.
              </p>
            </div>

            <div className="bg-zinc-100 border border-dashed border-zinc-300 rounded-xl p-3.5 space-y-1.5 opacity-90">
              <span className="font-mono text-[10px] font-bold text-zinc-500 uppercase">Concept 5</span>
              <h3 className="font-bold text-zinc-700 line-through">Health Impact</h3>
              <p className="text-zinc-500 text-[11px] leading-relaxed">
                Epidemiological clinical outcome modeling (hospitalizations, mortality) is{' '}
                <strong>strictly disabled</strong> pending peer-reviewed medical calibration.
              </p>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION 2: MATHEMATICAL EQUATIONS & THERMAL ENGINE */}
        {/* ============================================================ */}
        <section className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-orange-600" />
            <h2 className="text-base font-bold text-zinc-900">
              2. Biometeorological Equations & Formulations
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* Formula 1: NOAA Rothfusz Heat Index */}
            <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-zinc-900 text-sm">NOAA Rothfusz Heat Index (HI)</h3>
                <span className="text-[10px] font-mono bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-semibold">
                  T ≥ 27°C (80°F)
                </span>
              </div>
              <p className="text-zinc-600 leading-relaxed">
                Calculates apparent temperature incorporating evaporative cooling suppression. Uses the full
                9-term Rothfusz polynomial regression with National Weather Service (NWS) corrections:
              </p>
              <div className="bg-white p-3 rounded-lg border border-zinc-200 font-mono text-[11px] text-zinc-800 overflow-x-auto leading-loose">
                HI = -42.379 + 2.04901523·T + 10.14333127·R - 0.22475541·T·R<br />
                &nbsp;&nbsp;&nbsp;&nbsp; - 0.00683783·T² - 0.05481717·R² + 0.00122874·T²·R<br />
                &nbsp;&nbsp;&nbsp;&nbsp; + 0.00085282·T·R² - 0.00000199·T²·R²
              </div>
              <div className="text-[11px] text-zinc-600 space-y-1">
                <div>
                  <strong>Low-Humidity Adjustment (R &lt; 13%):</strong> Subtracts{' '}
                  <code className="bg-zinc-100 px-1 py-0.5 rounded">((13 - R)/4) · √((17 - |T - 95|)/17)</code>
                </div>
                <div>
                  <strong>High-Humidity Adjustment (R &gt; 85%):</strong> Adds{' '}
                  <code className="bg-zinc-100 px-1 py-0.5 rounded">((R - 85)/10) · ((87 - T)/5)</code>
                </div>
              </div>
            </div>

            {/* Formula 2: BoM Simplified Outdoor WBGT */}
            <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-zinc-900 text-sm">BoM Simplified Outdoor WBGT</h3>
                <span className="text-[10px] font-mono bg-red-100 text-red-800 px-2 py-0.5 rounded font-semibold">
                  ISO 7243 Standard
                </span>
              </div>
              <p className="text-zinc-600 leading-relaxed">
                The Australian Bureau of Meteorology (BoM) shade formula computes Wet Bulb Globe
                Temperature from dry-bulb temperature and ambient water vapor pressure:
              </p>
              <div className="bg-white p-3 rounded-lg border border-zinc-200 font-mono text-[11px] text-zinc-800 overflow-x-auto leading-loose">
                WBGT = 0.567 · T + 0.393 · e + 3.94<br />
                e = (RH / 100) · 6.108 · exp((17.27 · T) / (237.3 + T))
              </div>
              <div className="text-[11px] text-zinc-600 leading-relaxed">
                Where <code className="bg-zinc-100 px-1 py-0.5 rounded">e</code> is water vapor pressure
                in hPa via the Magnus-Tetens relation. Verifiable benchmark:{' '}
                <em>T = 35°C, RH = 50% → e ≈ 28.12 hPa → WBGT ≈ 34.8°C</em>.
              </div>
            </div>

            {/* Formula 3: UTCI Proxy Designation */}
            <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-zinc-900 text-sm">UTCI Proxy Designation</h3>
                <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-semibold">
                  Biometeorological Labeling
                </span>
              </div>
              <p className="text-zinc-600 leading-relaxed">
                Full 6th-order UTCI polynomial calculations require mean radiant temperature (Tmrt) and
                detailed solar geometry. In HeatPulse, the apparent temperature approximation is
                transparently labeled as <strong>UTCI Proxy</strong> without unacknowledged claims of
                being a full physical pyranometer radiation model.
              </p>
            </div>

            {/* Formula 4: Composite Risk & Scaling Divisor Correction */}
            <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-zinc-900 text-sm">Composite Exposure Risk Engine</h3>
                <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">
                  α = 0.6 · β = 0.4
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-zinc-200 font-mono text-[11px] text-zinc-800 overflow-x-auto leading-loose">
                Composite Risk = (0.6 · ThermalScore) + (0.4 · VulnerabilityScore)<br />
                ThermalScore = clamp((HeatIndex - 20) / 0.34, 0, 100)
              </div>
              <p className="text-zinc-600 text-[11px] leading-relaxed">
                <strong>Scaling Divisor Correction:</strong> The divisor is calibrated to{' '}
                <code className="bg-zinc-100 px-1 py-0.5 rounded">0.34</code> (mapping 20°C–54°C to
                0–100), eliminating the legacy <code className="line-through text-red-500">/ 3.4</code>{' '}
                deflation error that previously compressed scores by 10x.
              </p>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION 3: ACTIVE DATA PROVIDERS & ARCHITECTURE */}
        {/* ============================================================ */}
        <section className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-orange-600" />
            <h2 className="text-base font-bold text-zinc-900">
              3. Active Configured Data Providers & Ingestion Architecture
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="border border-zinc-200 rounded-xl p-4 space-y-2 bg-zinc-50/50">
              <div className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-orange-600" />
                <span>Open-Meteo NWP Grid</span>
              </div>
              <p className="text-zinc-600 leading-relaxed">
                Server-side batched queries sampling 120-hour forecast horizons per ward centroid.
                Integrates seamless high-resolution ECMWF IFS and GFS model cycles (00Z, 06Z, 12Z, 18Z).
              </p>
              <div className="text-[11px] font-mono text-zinc-500 pt-1 border-t border-zinc-200">
                Attribution: &ldquo;Ward-localized forecast derived from numerical weather prediction&rdquo;
              </div>
            </div>

            <div className="border border-zinc-200 rounded-xl p-4 space-y-2 bg-zinc-50/50">
              <div className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>ISRO NRSC Bhuvan WMS (selectable basemap)</span>
              </div>
              <p className="text-zinc-600 leading-relaxed">
                The map opens on the street basemap (OpenStreetMap) by default. ISRO National Remote
                Sensing Centre (NRSC) Bhuvan WMS
                (<code className="bg-zinc-100 px-1 rounded font-mono text-[11px]">sisdp_base:sisdp_basemap</code> for
                Pan-India, with regional LULC 1:50K layers per city) is available as a selectable basemap
                alongside high-resolution satellite imagery. Bhuvan attribution is preserved on every render.
              </p>
              <div className="text-[11px] font-mono text-zinc-500 pt-1 border-t border-zinc-200">
                Spatial Standard: RFC 7946 EPSG:4326
              </div>
            </div>

            <div className="border border-zinc-200 rounded-xl p-4 space-y-2 bg-zinc-50/50">
              <div className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>IMD Criteria Assessment (computed locally)</span>
              </div>
              <p className="text-zinc-600 leading-relaxed">
                HeatPulse applies the India Meteorological Department&apos;s (IMD) published heat-wave
                criteria to locally-fetched NWP forecast data and evaluates the resulting district color
                code itself. It does <strong>not</strong> fetch or relay IMD / MoES bulletins — for
                official warnings, refer to IMD / MoES channels directly.
              </p>
              <div className="text-[11px] font-mono text-zinc-500 pt-1 border-t border-zinc-200">
                Scope: District Climatological Departure · Not an official IMD product
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION 4: DATA-TRUTH MANDATE & EXPLICIT NON-CLAIMS */}
        {/* ============================================================ */}
        <section className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-zinc-900">
              4. Data-Truth Attestations & Explicit Non-Claims (Requirement R5)
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Zero Fake ML or Neural Network Claims:</strong>
                HeatPulse uses genuine, verified biometeorological equations and NWP grid models. We
                prohibit deceptive claims of deep learning predictive models trained on synthetic heat
                casualty data.
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Explicit Disabled Health Layer:</strong>
                Epidemiological clinical outcome modeling (hospitalizations, mortality) is explicitly
                labeled <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono">&ldquo;Coming with validated health-outcome model&rdquo;</code>.
                The system outputs zero synthetic deaths or simulated ER visits.
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">District Heat Evaluation (IMD criteria):</strong>
                We never fabricate official IMD bulletins. The district-level heat evaluation applies IMD&apos;s published
                criteria to local forecast data and is labeled as a HeatPulse evaluation — it is never presented as an
                official IMD / MoES product. For official warnings, see IMD / MoES channels directly.
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION 5: MULTI-SCALE SPATIAL ARCHITECTURE & CARTOGRAPHIC TRUTH */}
        {/* ============================================================ */}
        <section className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-orange-600" />
            <h2 className="text-base font-bold text-zinc-900">
              5. Multi-Scale Spatial Architecture &amp; Cartographic Truth
            </h2>
          </div>

          <p className="text-xs text-zinc-600 leading-relaxed">
            Early warning systems must balance national strategic oversight with hyper-local municipal interventions.
            HeatPulse enforces a deterministic, multi-scale spatial hierarchy that transitions between Level of Detail
            (LOD) regimes without data fabrication or artificial spatial interpolation.
          </p>

          {/* Multi-Scale Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-zinc-200 rounded-xl overflow-hidden">
              <thead className="bg-zinc-100 text-zinc-800 font-bold border-b border-zinc-200">
                <tr>
                  <th className="p-3">Level of Detail (LOD)</th>
                  <th className="p-3">Spatial Boundary Unit</th>
                  <th className="p-3">Data Sampling Mechanism</th>
                  <th className="p-3">Decision Objective</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-600">
                <tr className="hover:bg-zinc-50/70">
                  <td className="p-3 font-semibold text-zinc-900">
                    <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono text-[10px] mr-1.5">
                      LOD 0
                    </span>
                    Macro-Regional State Context
                  </td>
                  <td className="p-3">
                    36 States &amp; Union Territories (Survey of India / SimplyGIS boundary)
                  </td>
                  <td className="p-3">
                    Monitored metropolitan hubs (Bengaluru, Pune, Mumbai, Kolkata, Chennai, Coimbatore) aggregated via peak telemetry (<code className="bg-zinc-100 px-1 py-0.5 rounded font-mono">Math.max</code>) per state
                  </td>
                  <td className="p-3">
                    National synoptic coordination, inter-state disaster preparedness, and macro-regional resource mobilization
                  </td>
                </tr>
                <tr className="hover:bg-zinc-50/70">
                  <td className="p-3 font-semibold text-zinc-900">
                    <span className="inline-block px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded font-mono text-[10px] mr-1.5">
                      LOD 1 / 2
                    </span>
                    Ward-Localized Municipal GIS
                  </td>
                  <td className="p-3">
                    849 Administrative Municipal Wards across 6 corporations (e.g. 369 in Bengaluru GBA, 141 in Kolkata)
                  </td>
                  <td className="p-3">
                    Discrete Numerical Weather Prediction (NWP) 120-hour forecast grid sampled per municipal polygon centroid
                  </td>
                  <td className="p-3">
                    Tactical municipal heat action dispatch: hydration points, cooling shelters, vulnerable labor shifts, and emergency medical deployment
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Deep-Dive: Bihar Cartographic Case Study */}
          <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-4 sm:p-5 space-y-3 text-xs text-zinc-600">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <h3 className="font-bold text-zinc-900 text-sm">
                Cartographic Case Study: The Bihar vs. West Bengal Visual Diagnosis
              </h3>
            </div>

            <p className="leading-relaxed">
              When inspecting the national Thermal Stress layer on the Pan-India map, an analytical observer might note
              the relationship between regional telemetry coverage and basemap cartography across monitored states (e.g., <strong>West Bengal</strong>{' '}
              with active Kolkata thermal choropleths) versus baseline states like <strong>Bihar</strong>. This demonstrates the integrity of HeatPulse&apos;s
              cartographic layer stack:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              <div className="bg-white/90 rounded-lg p-3 border border-amber-100 space-y-1.5">
                <strong className="text-zinc-900 font-semibold block">
                  1. Selectable ISRO Bhuvan Pan-India Basemap & Regional LULC
                </strong>
                <p className="leading-relaxed">
                  When the Bhuvan basemap style is selected, the map loads ISRO NRSC&apos;s Pan-India layer{' '}
                  <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono text-[11px] text-zinc-800">sisdp_base:sisdp_basemap</code>,
                  providing uniform nationwide cartography across all 36 states and UTs. At municipal zoom, the controller dynamically switches
                  to regional 1:50,000 Land Use / Land Cover (LULC) rasters (such as <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono text-[11px] text-zinc-800">lulc:KA_LULC50K_1112</code> for Bengaluru or <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono text-[11px] text-zinc-800">lulc:MH_LULC50K_1112</code> for Pune/Mumbai).
                  The default street basemap is OpenStreetMap; Bhuvan is chosen per user preference from the Map Style switcher.
                </p>
              </div>

              <div className="bg-white/90 rounded-lg p-3 border border-amber-100 space-y-1.5">
                <strong className="text-zinc-900 font-semibold block">
                  2. Regional Baseline vs. Monitored Telemetry
                </strong>
                <p className="leading-relaxed">
                  States without monitored metropolitan telemetry receive an honest regional baseline with neutral styling.
                  States with monitored metropolitan centers (e.g., Kolkata in West Bengal — current WBGT per live forecast)
                  render data-driven thermal choropleths and telemetry popovers, ensuring complete cartographic truth across the nation.
                </p>
              </div>
            </div>

            <div className="bg-white/95 rounded-lg p-3 border border-amber-200/80 text-[11px] text-zinc-700 leading-relaxed">
              <strong>Zero Synthetic Interpolation Mandate: </strong>
              Rather than fabricating synthetic thermal values or interpolating unmonitored regions with unverified machine learning,
              HeatPulse maintains complete cartographic and scientific truth: only actively monitored territories receive thermal choropleths,
              while unmonitored regions display neutral baseline boundaries with honest status indicators.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
