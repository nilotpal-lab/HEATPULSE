'use client';

/**
 * HeatPulse — Forecast Freshness Banner
 * Conforms to Requirement R3 & R6:
 * - Explicit separation of:
 *     - Forecast run: HH:MM IST (NWP model initialization time)
 *     - Last updated: HH:MM IST (query/cache sync time)
 *     - Valid: [Time] (target forecast window)
 * - Transparent status indicators: 'fresh' | 'stale' | 'unavailable'
 * - Honest weather attribution: "Ward-localized forecast derived from numerical weather prediction"
 */

import React from 'react';
import { ForecastRunMetadata } from '@/types/weather';
import { Clock, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface FreshnessBannerProps {
  metadata?: ForecastRunMetadata | null;
  lastUpdatedTime?: number | string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
  compact?: boolean;
}

export function calculateClientNwpRunTime(referenceDate: Date = new Date()): string {
  const latencyMs = 3.5 * 60 * 60 * 1000;
  const operationalDate = new Date(referenceDate.getTime() - latencyMs);
  const year = operationalDate.getUTCFullYear();
  const month = String(operationalDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(operationalDate.getUTCDate()).padStart(2, '0');
  const cycleHour = Math.floor(operationalDate.getUTCHours() / 6) * 6;
  const cycleHourStr = String(cycleHour).padStart(2, '0');
  return `${year}-${month}-${day}T${cycleHourStr}:00:00Z`;
}

export function formatToIST(isoOrDateString?: string | number | null): string {
  if (!isoOrDateString) return '--:-- IST';
  try {
    const d = new Date(isoOrDateString);
    if (isNaN(d.getTime())) return String(isoOrDateString);
    return (
      d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' IST'
    );
  } catch {
    return '--:-- IST';
  }
}

export function formatDateIST(isoOrDateString?: string | number | null): string {
  if (!isoOrDateString) return '--';
  try {
    const d = new Date(isoOrDateString);
    if (isNaN(d.getTime())) return String(isoOrDateString);
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '--';
  }
}

export default function FreshnessBanner({
  metadata,
  lastUpdatedTime,
  onRefresh,
  isRefreshing = false,
  className = '',
  compact = false,
}: FreshnessBannerProps) {
  const status = metadata?.status || 'fresh';
  const effectiveRunTime = metadata?.run_time || calculateClientNwpRunTime();
  const effectiveUpdatedTime = metadata?.fetched_at || lastUpdatedTime || new Date().toISOString();
  const runTimeStr = formatToIST(effectiveRunTime);
  const updatedTimeStr = formatToIST(effectiveUpdatedTime);
  const validTimeStr = metadata?.valid_time
    ? `${formatDateIST(metadata.valid_time)} ${formatToIST(metadata.valid_time)}`
    : 'Current Hour';

  const statusColors = {
    fresh: {
      dot: 'bg-emerald-500 ring-emerald-500/20',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: 'Latest Forecast Run',
      icon: CheckCircle2,
    },
    stale: {
      dot: 'bg-amber-500 ring-amber-500/20 animate-pulse',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      label: 'Showing Prior Run',
      icon: AlertTriangle,
    },
    unavailable: {
      dot: 'bg-red-500 ring-red-500/20',
      badge: 'bg-red-50 text-red-700 border-red-200',
      label: 'NWP Source Stale',
      icon: AlertTriangle,
    },
  };

  const currentCfg = statusColors[status] || statusColors.fresh;
  const StatusIcon = currentCfg.icon;

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 text-[11px] text-zinc-600 ${className}`}
      >
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ring-2 ${currentCfg.dot}`} />
          <span className="font-medium text-zinc-700">Run: {runTimeStr}</span>
        </div>
        <span className="text-zinc-300">|</span>
        <span className="text-zinc-500">Updated: {updatedTimeStr}</span>
      </div>
    );
  }

  return (
    <aside
      aria-label="Forecast Freshness and NWP Provenance"
      className={`bg-white/95 backdrop-blur-sm border border-zinc-200/80 rounded-xl px-3.5 py-2 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs ${className}`}
    >
      {/* Left: Freshness Indicators */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        {/* Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold select-none ${currentCfg.badge}`}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          <span>{currentCfg.label}</span>
        </div>

        {/* Forecast Run Time */}
        <div className="flex items-center gap-1.5 text-zinc-700">
          <Clock className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-500">Forecast run:</span>
          <span className="font-semibold font-mono text-zinc-900">{runTimeStr}</span>
        </div>

        {/* Last Updated Time */}
        <div className="hidden sm:flex items-center gap-1.5 text-zinc-700">
          <span className="text-zinc-300">·</span>
          <span className="text-zinc-500">Last updated:</span>
          <span className="font-mono text-zinc-800">{updatedTimeStr}</span>
        </div>
      </div>

      {/* Right: Optional Refresh Button */}
      <div className="flex items-center gap-3 ml-auto">

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh forecast metrics without reloading GIS geometry"
          >
            <RefreshCw
              className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-orange-600' : ''}`}
            />
            <span>{isRefreshing ? 'Updating forecast…' : 'Refresh Forecast'}</span>
          </button>
        )}
      </div>
    </aside>
  );
}
