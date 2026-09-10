'use client';

/**
 * HeatPulse — Basemap Status Indicator Component
 * Conforms to Requirement R2 & PROJECT.md § Primary ISRO Bhuvan Basemap
 *
 * Displays the real-time operational status of the OpenLayers basemap:
 * - Green indicator: "Basemap: ISRO Bhuvan WMS" (Primary active)
 * - Amber indicator: "Basemap: OSM Fallback" (Automatic fallback active)
 * - Allows manual retry / switch between Bhuvan WMS and OpenStreetMap.
 */

import React, { useState } from 'react';
import type { BasemapStatus } from './BhuvanLayer';

interface BasemapStatusIndicatorProps {
  status: BasemapStatus;
  statusMessage?: string;
  onRetryBhuvan?: () => void;
  onToggleFallback?: () => void;
  className?: string;
}

export default function BasemapStatusIndicator({
  status,
  statusMessage,
  onRetryBhuvan,
  onToggleFallback,
  className = '',
}: BasemapStatusIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);

  const isBhuvan = status === 'bhuvan_active';
  const isFallback = status === 'osm_fallback';
  const isSatellite = status === 'satellite_active';

  const getStatusLabel = () => {
    if (isBhuvan) return 'ISRO NRSC Bhuvan WMS';
    if (isSatellite) return 'High-Res Satellite';
    if (isFallback) return 'Street View (OSM Fallback)';
    return 'Street View (OpenStreetMap)';
  };

  const getDotColor = () => {
    if (isBhuvan) return 'bg-emerald-500';
    if (isSatellite) return 'bg-sky-500';
    if (isFallback) return 'bg-amber-500';
    return 'bg-blue-500';
  };

  return (
    <div
      className={`relative inline-flex flex-col select-none ${className}`}
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <div className="bg-white/95 backdrop-blur-md rounded-lg shadow-md border border-zinc-200/80 px-2.5 py-1.5 flex items-center gap-2 text-xs">
        {/* Status Indicator Dot */}
        <span className="relative flex h-2.5 w-2.5">
          {isBhuvan && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${getDotColor()}`} />
        </span>

        {/* Status Label */}
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-zinc-800">
            Basemap:{' '}
            <span className={isBhuvan ? 'text-emerald-700' : isSatellite ? 'text-sky-700' : 'text-blue-700'}>
              {getStatusLabel()}
            </span>
          </span>
        </div>

        {/* Quick Action button */}
        {isFallback && onRetryBhuvan && (
          <button
            type="button"
            onClick={onRetryBhuvan}
            className="ml-1 text-[10px] font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200"
            title="Attempt reconnecting to ISRO Bhuvan WMS"
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </button>
        )}
      </div>

      {/* Popover Details on Hover */}
      {showDetails && (
        <div className="absolute bottom-full mb-1.5 right-0 w-64 p-2.5 bg-zinc-900/95 text-white text-[11px] rounded-lg shadow-xl z-50 leading-relaxed border border-zinc-700">
          <div className="font-semibold text-zinc-100 mb-1 flex items-center justify-between">
            <span>Basemap Diagnostic</span>
            <span className="text-[9px] text-zinc-400">OpenLayers v10</span>
          </div>

          <p className="text-zinc-300 text-[10px] mb-1.5">
            {statusMessage ||
              (isBhuvan
                ? 'Active: ISRO NRSC Bhuvan WMS. Automatic tile error listeners active.'
                : 'Active: OpenStreetMap TileLayer due to Bhuvan network unavailability.')}
          </p>

          <div className="text-[9px] text-zinc-400 border-t border-zinc-800 pt-1.5 flex items-center justify-between">
            <span>Provider: {isBhuvan ? 'ISRO / NRSC' : 'OpenStreetMap'}</span>
            {onToggleFallback && (
              <button
                type="button"
                onClick={onToggleFallback}
                className="text-cyan-400 hover:underline"
              >
                {isBhuvan ? 'Switch to OSM' : 'Switch to Bhuvan'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
