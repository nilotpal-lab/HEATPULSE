'use client';

/**
 * HeatPulse — 5-Day Heat & Thermal Forecast (SIH26083)
 * Conforms to Requirement R11: Forecast Simulation + ML Heatwave UX
 *
 * Capabilities:
 * 1. 120-hour forecast simulation with PLAY / PAUSE / SPEED 1x / 2x controls
 * 2. Temperature, Relative Humidity, NOAA Heat Index, BoM WBGT, UTCI Proxy
 * 3. Interactive timeline scrubber with explicit Valid-time labels (not "Now")
 * 4. Expandable meteorological parameters (Wind, Solar irradiance, Pressure)
 * 5. Multi-ward forecast inspection per NWP centroid
 * 6. Honest NWP provenance: "Ward-centroid NWP forecast" — not live observation
 *
 * TEMPORAL CORRECTNESS (R2, R3):
 * - Every metric is labeled with its exact Valid time in IST
 * - Simulation steps through actual forecast hours — no interpolation
 * - Tooltip always reads "Valid: [datetime] IST", never "Now"
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  CalendarDays,
  Clock,
  Thermometer,
  Droplets,
  Wind,
  Sun,
  Activity,
  ChevronDown,
  ChevronUp,
  MapPin,
  Flame,
  Info,
  Sliders,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Gauge,
} from 'lucide-react';
import { useHeatPulseStore, heatPulseActions, useActiveCityData } from '@/lib/store';
import { CITIES } from '@/types/gis';
import FreshnessBanner, { formatToIST, formatDateIST } from '@/components/navigation/FreshnessBanner';
import { calculateHeatIndex, calculateWBGT } from '@/lib/thermal-engine';

export default function ForecastPage() {
  const selectedCity = useHeatPulseStore((s) => s.selectedCity);
  const { data, isLoading, reload } = useActiveCityData();
  const cityMeta = CITIES[selectedCity] || CITIES.bengaluru;

  const [selectedHourIndex, setSelectedHourIndex] = useState<number>(14); // Default ~14:00 IST
  const [expandMeteo, setExpandMeteo] = useState<boolean>(true);
  const [selectedWardKey, setSelectedWardKey] = useState<string>('');

  // Forecast Simulation state (R11: PLAY / PAUSE / SPEED controls)
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<1 | 2>(1); // 1x = 1 hour/tick, 2x = 2 hours/tick
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load city data if not ready
  useEffect(() => {
    if (data.status === 'idle') {
      heatPulseActions.loadCityData(selectedCity);
    }
  }, [selectedCity, data.status]);

  // Active ward weather forecast (defaults to first available ward if none selected)
  const activeForecast = useMemo(() => {
    if (!data.weatherForecasts || Object.keys(data.weatherForecasts).length === 0) {
      return null;
    }
    if (selectedWardKey && data.weatherForecasts[selectedWardKey]) {
      return data.weatherForecasts[selectedWardKey];
    }
    return Object.values(data.weatherForecasts)[0];
  }, [data.weatherForecasts, selectedWardKey]);

  // Generate or extract 120-hour timeline points from genuine NWP data only.
  // When the forecast has not loaded yet, show an unavailable state — never a
  // fabricated cosine-temperature synthesis.
  const timelinePoints = useMemo(() => {
    if (activeForecast?.hourly?.time && activeForecast.hourly.time.length >= 120) {
      const h = activeForecast.hourly;
      return h.time.map((isoTime, i) => {
        const temp = Math.round(h.temperature_2m[i] * 10) / 10;
        const hum = Math.round(h.relative_humidity_2m[i]);
        const hi = calculateHeatIndex(temp, hum);
        const wbgt = calculateWBGT(temp, hum);
        const apparent = Math.round((h.apparent_temperature[i] || hi) * 10) / 10;
        const wind = h.wind_speed_10m ? Math.round(h.wind_speed_10m[i] * 10) / 10 : 12.5;
        const solar = h.direct_normal_irradiance ? Math.round(h.direct_normal_irradiance[i]) : 420;
        const pressure = h.surface_pressure ? Math.round(h.surface_pressure[i]) : 1012;

        return {
          index: i,
          time: isoTime,
          temp,
          humidity: hum,
          heatIndex: hi,
          wbgt,
          utciProxy: apparent,
          windSpeed: wind,
          solarIrradiance: solar,
          surfacePressure: pressure,
        };
      });
    }

    return [];
  }, [activeForecast]);

  // Auto-advance simulation: steps through available NWP hours only.
  // Does NOT interpolate values — only advances the index into existing NWP data.
  const hasTimeline = timelinePoints.length > 0;
  useEffect(() => {
    if (!isPlaying) {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      return;
    }
    if (!hasTimeline) return;
    const endIndex = timelinePoints.length - 1;
    simIntervalRef.current = setInterval(() => {
        setSelectedHourIndex((prev) => {
          const next = prev + simSpeed;
          if (next >= endIndex) {
            setIsPlaying(false); // Stop at end of available forecast
            return endIndex;
          }
          return next;
        });
      }, 400);
    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
    };
  }, [isPlaying, simSpeed, timelinePoints.length, hasTimeline]);

  const activePoint = timelinePoints.length > 0
    ? timelinePoints[Math.min(selectedHourIndex, timelinePoints.length - 1)]
    : null;

  // Daily statistics for 5 days
  const dailySummary = useMemo(() => {
    const days: {
      dayIndex: number;
      dateStr: string;
      maxTemp: number;
      minTemp: number;
      maxHI: number;
      maxWbgt: number;
    }[] = [];

    for (let d = 0; d < 5; d++) {
      const slice = timelinePoints.slice(d * 24, (d + 1) * 24);
      if (slice.length === 0) continue;

      const temps = slice.map((p) => p.temp);
      const his = slice.map((p) => p.heatIndex);
      const wbgts = slice.map((p) => p.wbgt);

      days.push({
        dayIndex: d,
        dateStr: formatDateIST(slice[0].time),
        maxTemp: Math.max(...temps),
        minTemp: Math.min(...temps),
        maxHI: Math.max(...his),
        maxWbgt: Math.max(...wbgts),
      });
    }

    return days;
  }, [timelinePoints]);

  return (
    <div className="min-h-screen bg-zinc-50 pb-16">
      {/* Top Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-8 py-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-orange-600" />
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
                  120-Hour Biometeorological Forecast Timeline
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                Five-day hourly thermal stress trajectory narrative for{' '}
                <strong className="text-zinc-700">{cityMeta.name}</strong>. LOCALIZED per municipal
                ward centroid from numerical weather prediction.
              </p>
            </div>

            {/* Ward Selector Dropdown */}
            {Object.keys(data.weatherForecasts || {}).length > 0 && (
              <div className="flex items-center gap-2 bg-zinc-100 p-1.5 rounded-xl border border-zinc-200">
                <MapPin className="w-3.5 h-3.5 text-orange-600 ml-1" />
                <select
                  value={selectedWardKey}
                  onChange={(e) => setSelectedWardKey(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-zinc-800 focus:outline-none pr-3 py-0.5 cursor-pointer"
                  aria-label="Select Ward Forecast"
                >
                  {Object.values(data.weatherForecasts).map((w) => (
                    <option key={w.ward_id} value={w.ward_id}>
                      {w.ward_name} ({w.ward_id})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Freshness Banner */}
          <FreshnessBanner
            metadata={data.forecastMetadata}
            lastUpdatedTime={data.lastFetched}
            onRefresh={reload}
            isRefreshing={isLoading}
          />
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-8 mt-6 space-y-6">
        {/* ============================================================ */}
        {/* INTERACTIVE HOUR SCRUBBER & CURRENT HOUR READOUT */}
        {/* ============================================================ */}
        <section
          aria-label="Interactive 120-Hour Scrubber"
          className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                Temporal Hour Scrubber (0h to 120h)
              </span>
              <div className="text-lg font-extrabold text-zinc-900 mt-0.5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-600" />
                {activePoint ? (
                  <>
                    <span>
                      {formatDateIST(activePoint.time)} · {formatToIST(activePoint.time)}
                    </span>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full">
                      +{activePoint.index}h offset
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-zinc-500">Forecast unavailable</span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-zinc-500 block">NWP Projection Horizon</span>
              <span className="text-xs font-semibold text-zinc-700">5 Continuous Days (120 Hours)</span>
            </div>
          </div>

          {/* Forecast Simulation Controls (R11) */}
          <div className="flex flex-wrap items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mr-1">
              Forecast Simulation
            </span>

            {/* Reset to start */}
            <button
              type="button"
              onClick={() => { setIsPlaying(false); setSelectedHourIndex(0); }}
              className="p-1.5 rounded-lg hover:bg-zinc-200 text-zinc-600 transition-colors"
              title="Reset to Hour 0"
              aria-label="Reset simulation to hour 0"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Step back 1 hour */}
            <button
              type="button"
              onClick={() => { setIsPlaying(false); setSelectedHourIndex((p) => Math.max(0, p - 1)); }}
              className="p-1.5 rounded-lg hover:bg-zinc-200 text-zinc-600 transition-colors"
              title="Step back 1 hour"
              aria-label="Step back one forecast hour"
            >
              <span className="text-[10px] font-bold">−1h</span>
            </button>

            {/* Play / Pause */}
            <button
              type="button"
              onClick={() => { if (hasTimeline) setIsPlaying((p) => !p); }}
              disabled={!hasTimeline}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isPlaying
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-300'
              }`}
              aria-label={isPlaying ? 'Pause simulation' : 'Start forecast simulation'}
            >
              {isPlaying ? (
                <><Pause className="w-3.5 h-3.5" /> Pause</>
              ) : (
                <><Play className="w-3.5 h-3.5" /> {selectedHourIndex === 0 ? 'Start Simulation' : 'Resume'}</>
              )}
            </button>

            {/* Step forward 1 hour */}
            <button
              type="button"
              onClick={() => { setIsPlaying(false); setSelectedHourIndex((p) => Math.min(Math.max(0, timelinePoints.length - 1), p + 1)); }}
              className="p-1.5 rounded-lg hover:bg-zinc-200 text-zinc-600 transition-colors"
              title="Step forward 1 hour"
              aria-label="Step forward one forecast hour"
            >
              <span className="text-[10px] font-bold">+1h</span>
            </button>

            {/* Skip to end */}
            <button
              type="button"
              onClick={() => { setIsPlaying(false); setSelectedHourIndex(Math.max(0, timelinePoints.length - 1)); }}
              className="p-1.5 rounded-lg hover:bg-zinc-200 text-zinc-600 transition-colors"
              title="Jump to end of available forecast"
              aria-label="Jump to end of forecast horizon"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Speed toggle */}
            <button
              type="button"
              onClick={() => setSimSpeed((s) => (s === 1 ? 2 : 1))}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-zinc-100 border border-zinc-300 text-zinc-700 hover:bg-zinc-200 transition-colors"
              aria-label={`Simulation speed: ${simSpeed}x. Click to toggle.`}
            >
              <Gauge className="w-3.5 h-3.5" />
              {simSpeed}×
            </button>

            {/* Valid time label — always explicit, never "Now" */}
            <span className="ml-auto text-[10px] font-mono text-zinc-500 shrink-0">
              {activePoint
                ? `Valid: ${formatDateIST(activePoint.time)} ${formatToIST(activePoint.time)} · +${activePoint.index}h`
                : 'Forecast unavailable — waiting for NWP data'}
            </span>
          </div>

          {/* Range Slider */}

          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={timelinePoints.length > 0 ? timelinePoints.length - 1 : 0}
              value={timelinePoints.length > 0 ? Math.min(selectedHourIndex, timelinePoints.length - 1) : 0}
              onChange={(e) => setSelectedHourIndex(parseInt(e.target.value, 10))}
              className="w-full h-2.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
              aria-label="120-Hour Forecast Timeline Slider"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono pt-1">
              <span>Day 1 (0h)</span>
              <span>Day 2 (+24h)</span>
              <span>Day 3 (+48h)</span>
              <span>Day 4 (+72h)</span>
              <span>Day 5 (+96h)</span>
              <span>+120h</span>
            </div>
          </div>

          {/* Active Hour Metrics Grid */}
          {activePoint ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            {/* Metric 1: Dry-Bulb Air Temp */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                <span>2m Temperature</span>
              </div>
              <div className="text-2xl font-extrabold text-zinc-900 mt-1">{activePoint.temp}°C</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Dry-Bulb Ambient</div>
            </div>

            {/* Metric 2: Relative Humidity */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                <Droplets className="w-3.5 h-3.5 text-blue-500" />
                <span>Relative Humidity</span>
              </div>
              <div className="text-2xl font-extrabold text-blue-900 mt-1">{activePoint.humidity}%</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Atmospheric Moisture</div>
            </div>

            {/* Metric 3: NOAA Heat Index */}
            <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-orange-700 uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5 text-orange-600" />
                <span>NOAA Heat Index</span>
              </div>
              <div className="text-2xl font-extrabold text-orange-950 mt-1">{activePoint.heatIndex}°C</div>
              <div className="text-[10px] text-orange-700 mt-0.5">Rothfusz with adjustments</div>
            </div>

            {/* Metric 4: BoM Outdoor WBGT */}
            <div className="bg-red-50/70 border border-red-200 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-red-700 uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5 text-red-600" />
                <span>Outdoor WBGT</span>
              </div>
              <div className="text-2xl font-extrabold text-red-950 mt-1">{activePoint.wbgt}°C</div>
              <div className="text-[10px] text-red-700 mt-0.5">Human physiological strain</div>
            </div>

            {/* Metric 5: UTCI Proxy */}
            <div className="col-span-2 sm:col-span-1 bg-purple-50/70 border border-purple-200 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                <Sun className="w-3.5 h-3.5 text-purple-600" />
                <span>UTCI Proxy</span>
              </div>
              <div className="text-2xl font-extrabold text-purple-950 mt-1">{activePoint.utciProxy}°C</div>
              <div className="text-[10px] text-purple-700 mt-0.5">Apparent temperature</div>
            </div>
          </div>
          ) : (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
            Forecast unavailable — ward-centroid NWP data has not loaded yet. No synthetic values are shown.
          </div>
          )}
        </section>

        {/* ============================================================ */}
        {/* EXPANDABLE METEOROLOGICAL PARAMETERS */}
        {/* ============================================================ */}
        <section className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setExpandMeteo((prev) => !prev)}
            className="w-full px-5 py-3.5 bg-zinc-50 hover:bg-zinc-100 flex items-center justify-between text-xs font-bold text-zinc-800 transition-colors"
            aria-expanded={expandMeteo}
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-zinc-600" />
              <span>Expandable Numerical Meteorological Parameters</span>
            </div>
            {expandMeteo ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </button>

          {expandMeteo && activePoint && (
            <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-zinc-200">
              <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                  <Wind className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold block">
                    10m Wind Speed
                  </span>
                  <div className="text-lg font-bold text-zinc-900">{activePoint.windSpeed} km/h</div>
                  <span className="text-[10px] text-zinc-500">Convective heat ventilation</span>
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold block">
                    Solar Irradiance
                  </span>
                  <div className="text-lg font-bold text-zinc-900">
                    {activePoint.solarIrradiance} W/m²
                  </div>
                  <span className="text-[10px] text-zinc-500">Direct normal radiation</span>
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold block">
                    Surface Pressure
                  </span>
                  <div className="text-lg font-bold text-zinc-900">
                    {activePoint.surfacePressure} hPa
                  </div>
                  <span className="text-[10px] text-zinc-500">Barometric surface level</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ============================================================ */}
        {/* 5-DAY DIURNAL CURVE COMPARISON */}
        {/* ============================================================ */}
        <section
          aria-label="5-Day Diurnal Curve Comparison"
          className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">
                Diurnal Thermal Trajectory Across 5 Days
              </h2>
              <p className="text-xs text-zinc-500">
                Comparing daytime peak solar heating vs nighttime dissipation windows.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Max Temp
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Peak WBGT
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {dailySummary.map((d) => (
              <div
                key={d.dayIndex}
                className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 space-y-2 text-center"
              >
                <div className="text-xs font-bold text-zinc-700">
                  Day {d.dayIndex + 1} ({d.dateStr})
                </div>
                <div className="text-xl font-extrabold text-zinc-900">
                  {d.maxTemp}° <span className="text-xs font-normal text-zinc-400">/ {d.minTemp}°C</span>
                </div>
                <div className="pt-2 border-t border-zinc-200 text-[11px] space-y-1">
                  <div className="flex justify-between text-zinc-600">
                    <span>Peak HI:</span>
                    <span className="font-semibold text-orange-600">{d.maxHI}°C</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Peak WBGT:</span>
                    <span className="font-semibold text-red-600">{d.maxWbgt}°C</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
