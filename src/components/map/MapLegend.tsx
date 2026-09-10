'use client';

/**
 * HeatPulse — Map Legend Component
 * Conforms to Requirement R2, R3, R8 & PROJECT.md § Visual Hierarchy
 *
 * Dynamically displays color classifications directly bound to map-config.ts:
 * - Heat Conditions (Atmospheric state: Normal, Elevated, High, Extreme)
 * - Thermal Stress (Biometeorological WBGT: Low, Moderate, High, Severe)
 * - Health Impact (Relative Risk proxy — disabled / no synthetic clinical data)
 * - Composite Risk (Multi-criteria decision index)
 * - Visual indicators for Admin Boundaries, Selected Ward Highlight, and Unmonitored States
 */

import React, { useState } from 'react';
import { getLayerLegendConfig, type ThematicLayerType } from './map-config';

interface MapLegendProps {
  activeLayer: ThematicLayerType;
  className?: string;
}

export default function MapLegend({ activeLayer, className = '' }: MapLegendProps) {
  const [collapsed, setCollapsed] = useState(false);

  const layerConfig = getLayerLegendConfig(activeLayer);

  return (
    <div
      className={`bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-zinc-200/80 p-3 text-xs select-none transition-all duration-200 ${className}`}
      style={{ minWidth: collapsed ? 'auto' : '220px' }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-semibold text-zinc-900 tracking-tight flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          {layerConfig.title}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-zinc-400 hover:text-zinc-700 text-[10px] px-1 py-0.5 rounded hover:bg-zinc-100"
          title={collapsed ? 'Expand legend' : 'Collapse legend'}
        >
          {collapsed ? '▼' : '▲'}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-2">
          {/* Subtitle / Descriptor */}
          {layerConfig.subtitle && (
            <div className="text-[10px] text-zinc-500 font-medium">
              {layerConfig.subtitle}
            </div>
          )}

          {/* Honest disabled notice for health impact layer */}
          {activeLayer === 'health_impact' && (
            <div className="p-2 rounded-md bg-amber-50 border border-amber-200 text-[10px] text-amber-900 leading-tight space-y-0.5">
              <span className="font-semibold block text-amber-950">Layer Disabled</span>
              <span>Coming with validated health-outcome model. Relative Risk proxy only (No synthetic data).</span>
            </div>
          )}

          {/* Choropleth color swatches directly bound to map-config */}
          <div className="space-y-1">
            {layerConfig.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3.5 h-3 rounded-sm shrink-0 border border-black/10"
                    style={{ backgroundColor: item.stroke }}
                  />
                  <span className="text-zinc-700">{item.label}</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">{item.desc}</span>
              </div>
            ))}
          </div>

          {/* Boundaries & Selection Keys */}
          <div className="pt-2 border-t border-zinc-200/80 space-y-1 text-[10px] text-zinc-500">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-1 rounded bg-slate-400" />
              <span>Ward Boundary (LOD 8–18)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-1 rounded bg-[#00f2fe] ring-1 ring-[#00f2fe]/50" />
              <span className="font-medium text-cyan-800">Selected Ward (3.5px border)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-2.5 rounded-sm bg-[#f1f5f9] border border-[#cbd5e1]" />
              <span className="text-zinc-600">Unmonitored State (No Active Telemetry)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
