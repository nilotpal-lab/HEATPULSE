'use client';

/**
 * HeatPulse — Page 4: Ranked Risk Areas Table
 * Conforms to Requirement R6 & PROJECT.md § Page 4: Risk Areas
 *
 * Capabilities:
 * 1. Ranked priority ward table across all municipal wards in selected city
 * 2. Real-time search by ward name or ID
 * 3. Sorting by Composite Risk, Thermal Score, Vulnerability, or Ward Name
 * 4. Filtering by Risk Level (All, Severe, High, Moderate, Low)
 * 5. Synchronized selection opening the 8-Section Ward Detail Drawer
 * 6. Quick navigation to City Map Overview
 */

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Search,
  ArrowUpDown,
  ChevronRight,
} from 'lucide-react';
import { useHeatPulseStore, heatPulseActions, useActiveCityData } from '@/lib/store';
import { CITIES } from '@/types/gis';
import FreshnessBanner from '@/components/navigation/FreshnessBanner';
import WardDetailDrawer from '@/components/drawer/WardDetailDrawer';
import { CompositeRiskLevel } from '@/types/thermal';

type SortField = 'compositeRisk' | 'thermalScore' | 'vulnerabilityScore' | 'wardName' | 'heatIndex' | 'wbgt';
type SortDirection = 'asc' | 'desc';

interface TableWardRow {
  rank: number;
  wardId: string;
  wardName: string;
  heatIndex: number;
  wbgt: number;
  thermalScore: number;
  vulnerabilityScore: number;
  compositeRisk: number;
  compositeRiskScore: number;
  compositeRiskLevel: CompositeRiskLevel;
  primaryDriver: string;
}

export default function RiskAreasPage() {
  const selectedCity = useHeatPulseStore((s) => s.selectedCity);
  const { data, isLoading, reload } = useActiveCityData();
  const cityMeta = CITIES[selectedCity] || CITIES.bengaluru;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('compositeRisk');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Load city data if idle
  useEffect(() => {
    if (data.status === 'idle') {
      heatPulseActions.loadCityData(selectedCity);
    }
  }, [selectedCity, data.status]);

  // Transform assessments and legacy wards into table rows
  const tableRows: TableWardRow[] = useMemo(() => {
    const assessments = data.assessments || [];
    const legacyWards = data.wardRisks || [];

    if (assessments.length > 0) {
      return assessments.map((a, i) => {
        const hi = a.thermal.heat_index;
        const wbgt = a.thermal.wbgt;
        const tScore = Math.max(0, Math.min(100, Math.round(((hi - 20) / 0.34) * 10) / 10));
        return {
          rank: i + 1,
          wardId: a.ward_id,
          wardName: a.ward_name,
          heatIndex: hi,
          wbgt,
          thermalScore: tScore,
          vulnerabilityScore: a.vulnerability_score,
          compositeRisk: a.composite_risk_score,
          compositeRiskScore: a.composite_risk_score,
          compositeRiskLevel: a.composite_risk_level,
          primaryDriver: a.contributing_factors.primary_driver || 'Atmospheric Heat Hazard',
        };
      });
    }

    if (legacyWards.length > 0) {
      return legacyWards.map((w, i) => {
        const levelMap: Record<string, CompositeRiskLevel> = {
          extreme: 'Severe',
          danger: 'Severe',
          high: 'High',
          moderate: 'Moderate',
          low: 'Low',
        };
        const level = levelMap[w.compositeRiskLevel.toLowerCase()] || 'Moderate';
        const tScore = Math.max(0, Math.min(100, Math.round(((w.heatIndex - 20) / 0.34) * 10) / 10));
        return {
          rank: i + 1,
          wardId: w.wardId || w.ward_id || `w-${String(i + 1).padStart(3, '0')}`,
          wardName: w.wardName || w.ward_name || `Ward ${i + 1}`,
          heatIndex: w.heatIndex,
          wbgt: w.wbgt,
          thermalScore: tScore,
          vulnerabilityScore: w.vulnerabilityScore || 50,
          compositeRisk: w.compositeRisk,
          compositeRiskScore: w.compositeRisk,
          compositeRiskLevel: level,
          primaryDriver: 'Atmospheric Heat Hazard',
        };
      });
    }

    // Return empty array while loading or if data is not yet available (prevent fake placeholder numbers)
    return [];
  }, [data]);

  // Filter & Sort rows
  const filteredAndSortedRows = useMemo(() => {
    let result = [...tableRows];

    // 1. Text Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.wardName.toLowerCase().includes(q) ||
          r.wardId.toLowerCase().includes(q)
      );
    }

    // 2. Risk Level filter
    if (filterLevel !== 'all') {
      result = result.filter(
        (r) => r.compositeRiskLevel.toLowerCase() === filterLevel.toLowerCase()
      );
    }

    // 3. Sorting
    result.sort((a, b) => {
      let aVal: number | string = a[sortField];
      let bVal: number | string = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    // Re-index ranks after sorting
    return result.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [tableRows, searchQuery, filterLevel, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleWardClick = (ward: TableWardRow) => {
    heatPulseActions.openWardDrawer(ward.wardName, ward.wardId);
  };

  const severeCount = tableRows.filter((r) => r.compositeRiskLevel === 'Severe').length;
  const highCount = tableRows.filter((r) => r.compositeRiskLevel === 'High').length;
  const moderateCount = tableRows.filter((r) => r.compositeRiskLevel === 'Moderate').length;
  const lowCount = tableRows.filter((r) => r.compositeRiskLevel === 'Low').length;

  const levelBadges: Record<CompositeRiskLevel, string> = {
    Severe: 'bg-red-100 text-red-800 border-red-200',
    High: 'bg-orange-100 text-orange-800 border-orange-200',
    Moderate: 'bg-amber-100 text-amber-800 border-amber-200',
    Low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  };

  return (
    <div className="min-h-screen bg-zinc-50 pb-16">
      {/* Top Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-8 py-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-600" />
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
                  Ranked Priority Risk Areas ({cityMeta.name})
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                Multi-criteria ranked prioritization across all {cityMeta.wardCount} administrative wards.
                Formula: <code className="text-zinc-700 bg-zinc-100 px-1 py-0.5 rounded font-mono text-xs">Risk = 0.6 × Thermal + 0.4 × Vulnerability</code>.
              </p>
            </div>

            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <span>View On City Map</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
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

      {/* Main Table Container */}
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-8 mt-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-red-200 rounded-xl p-3 shadow-xs">
            <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider block">
              Severe Priority
            </span>
            <div className="text-2xl font-extrabold text-red-950 mt-1">{severeCount} Wards</div>
            <div className="text-[10px] text-red-600 mt-0.5">Requires immediate municipal action</div>
          </div>

          <div className="bg-white border border-orange-200 rounded-xl p-3 shadow-xs">
            <span className="text-[11px] font-bold text-orange-700 uppercase tracking-wider block">
              High Priority
            </span>
            <div className="text-2xl font-extrabold text-orange-950 mt-1">{highCount} Wards</div>
            <div className="text-[10px] text-orange-600 mt-0.5">Hydration kiosks & cooling points</div>
          </div>

          <div className="bg-white border border-amber-200 rounded-xl p-3 shadow-xs">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
              Moderate Load
            </span>
            <div className="text-2xl font-extrabold text-amber-950 mt-1">{moderateCount} Wards</div>
            <div className="text-[10px] text-amber-600 mt-0.5">Advisory alerts for outdoor workers</div>
          </div>

          <div className="bg-white border border-emerald-200 rounded-xl p-3 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
              Low / Normal
            </span>
            <div className="text-2xl font-extrabold text-emerald-950 mt-1">{lowCount} Wards</div>
            <div className="text-[10px] text-emerald-600 mt-0.5">Within tolerable baseline ranges</div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ward name or ID (e.g. Aundh, blr-001)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-zinc-50 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-zinc-800"
            />
          </div>

          {/* Level Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-[11px] text-zinc-400 font-semibold px-1">Filter:</span>
            {['all', 'Severe', 'High', 'Moderate', 'Low'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setFilterLevel(lvl)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filterLevel.toLowerCase() === lvl.toLowerCase()
                    ? 'bg-zinc-900 text-white font-semibold'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {lvl === 'all' ? 'All Levels' : lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold text-zinc-500 uppercase tracking-wider select-none">
                  <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-zinc-900"
                    onClick={() => handleSort('wardName')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Ward Name & ID</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-zinc-900"
                    onClick={() => handleSort('heatIndex')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Heat Index (°C)</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-zinc-900"
                    onClick={() => handleSort('wbgt')}
                  >
                    <div className="flex items-center gap-1">
                      <span>WBGT (°C)</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-zinc-900"
                    onClick={() => handleSort('thermalScore')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Thermal (60%)</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-zinc-900"
                    onClick={() => handleSort('vulnerabilityScore')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Vuln (40%)</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-zinc-900"
                    onClick={() => handleSort('compositeRisk')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Composite Risk</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {isLoading || data.status === 'loading' ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={`skel-${idx}`} className="animate-pulse">
                      <td className="py-4 px-4 text-center">
                        <div className="h-4 w-6 bg-zinc-200 rounded mx-auto" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-32 bg-zinc-200 rounded mb-1" />
                        <div className="h-2.5 w-16 bg-zinc-100 rounded" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-12 bg-zinc-200 rounded" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-12 bg-zinc-200 rounded" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-10 bg-zinc-200 rounded" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-10 bg-zinc-200 rounded" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-5 w-20 bg-zinc-200 rounded-full" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 w-12 bg-zinc-200 rounded ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : data.status === 'error' && tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500 text-sm">
                      <div className="max-w-md mx-auto space-y-3">
                        <p className="text-zinc-700 font-medium">
                          Unable to retrieve live risk assessments for {cityMeta.name}.
                        </p>
                        <p className="text-xs text-zinc-400">
                          {data.errorMessage || 'Upstream numerical weather prediction data was temporarily unavailable.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => reload()}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                        >
                          Retry Telemetry Fetch
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredAndSortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-400 text-sm">
                      No wards match your search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedRows.map((row) => (
                    <tr
                      key={row.wardId}
                      onClick={() => handleWardClick(row)}
                      className="hover:bg-orange-50/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-zinc-500">
                        #{row.rank}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-zinc-900 group-hover:text-orange-600 transition-colors">
                          {row.wardName}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">{row.wardId}</div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-orange-600">
                        {row.heatIndex}°C
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-red-600">
                        {row.wbgt}°C
                      </td>

                      <td className="py-3.5 px-4 text-zinc-700">
                        <span className="font-medium">{row.thermalScore}</span>
                        <span className="text-[10px] text-zinc-400 block">Atmospheric</span>
                      </td>

                      <td className="py-3.5 px-4 text-zinc-700">
                        <span className="font-medium">{row.vulnerabilityScore}</span>
                        <span className="text-[10px] text-zinc-400 block">Baseline</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-zinc-900">
                            {row.compositeRiskScore}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              levelBadges[row.compositeRiskLevel]
                            }`}
                          >
                            {row.compositeRiskLevel}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className="text-orange-600 font-semibold inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform text-[11px]">
                          <span>Inspect</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide-In Ward Detail Drawer */}
      <WardDetailDrawer />
    </div>
  );
}
