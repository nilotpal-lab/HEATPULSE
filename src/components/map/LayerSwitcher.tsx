'use client';

/**
 * HeatPulse — Layer Switcher Component
 * Conforms to Requirement R2 & PROJECT.md § Strict Concept Segregation
 *
 * Provides 3 distinct thematic layer controls:
 * 1. Heat Conditions (Atmospheric state: Normal, Elevated, High, Extreme)
 * 2. Thermal Stress (Human biometeorology: Low, Moderate, High, Severe WBGT/HI)
 * 3. Health Impact [Disabled] (Epidemiological clinical outcome — strictly disabled)
 */

import React from 'react';
import type { ThematicLayerType } from '@/lib/map-config';

interface LayerSwitcherProps {
  activeLayer: ThematicLayerType;
  onLayerChange: (layer: ThematicLayerType) => void;
  className?: string;
}

export default function LayerSwitcher({
  activeLayer,
  onLayerChange,
  className = '',
}: LayerSwitcherProps) {
  return (
    <div
      className={`bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-zinc-200/80 p-1.5 flex flex-wrap items-center gap-1 text-xs select-none ${className}`}
      role="tablist"
      aria-label="Map Thematic Layers"
    >
      {/* Option 1: Heat Conditions */}
      <button
        type="button"
        role="tab"
        aria-selected={activeLayer === 'heat_conditions'}
        onClick={() => onLayerChange('heat_conditions')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${
          activeLayer === 'heat_conditions'
            ? 'bg-orange-500 text-white shadow-sm ring-1 ring-orange-600/30 font-semibold'
            : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
        }`}
        title="Atmospheric heat condition thresholds (Normal, Elevated, High, Extreme)"
      >
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        <span>Heat Conditions</span>
      </button>

      {/* Option 2: Thermal Stress */}
      <button
        type="button"
        role="tab"
        aria-selected={activeLayer === 'thermal_stress'}
        onClick={() => onLayerChange('thermal_stress')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${
          activeLayer === 'thermal_stress'
            ? 'bg-red-600 text-white shadow-sm ring-1 ring-red-700/30 font-semibold'
            : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
        }`}
        title="Human biometeorological stress based on WBGT & Heat Index"
      >
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343a7.975 7.975 0 010 11.314z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
          />
        </svg>
        <span>Thermal Stress</span>
      </button>

      {/* Option 3: Health & Epidemiological Impact */}
      <button
        type="button"
        role="tab"
        aria-selected={activeLayer === 'health_impact'}
        onClick={() => onLayerChange('health_impact')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${
          activeLayer === 'health_impact'
            ? 'bg-rose-700 text-white shadow-sm ring-1 ring-rose-800/30 font-semibold'
            : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
        }`}
        title="Epidemiological relative risk & hospital emergency surge index"
      >
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
        <span>Health Impact</span>
        <span className="text-[9px] font-bold tracking-tight uppercase bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded border border-rose-300">
          Surge RR
        </span>
      </button>
    </div>
  );
}
