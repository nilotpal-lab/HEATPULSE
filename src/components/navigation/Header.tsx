'use client';

/**
 * HeatPulse — Global Navigation Shell & Header
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 *
 * Implements:
 * 1. HeatPulse Branding with MoES / NCMRWF SIH26083 Badge
 * 2. 6 Primary Navigation Tabs:
 *    - India Overview (/india)
 *    - City Overview (/ - Primary Screen)
 *    - Forecast (/forecast)
 *    - Risk Areas (/risk-areas)
 *    - Insights (/insights)
 *    - How HeatPulse Works (/how-it-works)
 * 3. City Switcher Dropdown supporting 6 cities (Bengaluru 369, Pune 15, Mumbai 24, Kolkata 141, Chennai 200, Coimbatore 100)
 * 4. Forecast Freshness Banner (Forecast run: HH:MM IST, Last updated: HH:MM IST, Valid: [Time])
 * 5. Responsive mobile menu
 */

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Flame,
  MapPin,
  ChevronDown,
  Menu,
  X,
  Layers,
  BarChart3,
  CalendarDays,
  Info,
  Globe2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { CITIES, CityId, CITY_LIST } from '@/types/gis';
import { NAVIGATION_ITEMS, NavigationPage } from '@/types/navigation';
import { useHeatPulseStore, heatPulseActions } from '@/lib/store';
import FreshnessBanner from './FreshnessBanner';

const PAGE_ICONS: Record<NavigationPage, React.ComponentType<{ className?: string }>> = {
  india: Globe2,
  city: Layers,
  forecast: CalendarDays,
  'risk-areas': BarChart3,
  'how-it-works': Info,
  demo: AlertTriangle,
};

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCity = useHeatPulseStore((s) => s.selectedCity);
  const activeCityData = useHeatPulseStore((s) => s.cachedCityData[selectedCity]);
  const currentCityMeta = CITIES[selectedCity] || CITIES.bengaluru;

  // Pre-load current city data if not yet loaded
  useEffect(() => {
    if (activeCityData && activeCityData.status === 'idle') {
      heatPulseActions.loadCityData(selectedCity);
    }
  }, [selectedCity, activeCityData]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setCityDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCitySelect = (cityId: CityId) => {
    heatPulseActions.setSelectedCity(cityId);
    setCityDropdownOpen(false);
    heatPulseActions.loadCityData(cityId);
  };

  const isTabActive = (href: string) => {
    if (href === '/') {
      return pathname === '/' || pathname === '';
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-zinc-200 shadow-xs">
      {/* Primary Header Row */}
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-8 flex items-center justify-between h-14 gap-2">
        {/* Brand & City Switcher */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-lg p-1"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
              <Flame className="w-5 h-5 fill-white/90 stroke-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-zinc-900 tracking-tight text-base leading-none">
                  HeatPulse
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-zinc-100 text-zinc-600 rounded">
                  India
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-none mt-0.5">
                Biometeorological Decision Support
              </p>
            </div>
          </Link>

          {/* Vertical divider */}
          <div className="h-6 w-px bg-zinc-200 hidden sm:block" />

          {/* City Switcher Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setCityDropdownOpen((prev) => !prev)}
              aria-expanded={cityDropdownOpen}
              aria-label="Select Monitored City"
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100/80 hover:bg-zinc-100 text-zinc-800 rounded-lg text-xs font-medium border border-zinc-200/80 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0" />
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-zinc-900">{currentCityMeta.name}</span>
                  <span className="text-[10px] text-zinc-500 bg-white px-1.5 py-0.2 rounded border border-zinc-200">
                    {currentCityMeta.wardCount} Wards
                  </span>
                </div>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${
                  cityDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* City Menu Dropdown */}
            {cityDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-zinc-200 py-1.5 z-50 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                <div className="px-3 py-1.5 border-b border-zinc-100 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Select Monitored City ({CITY_LIST.length})
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {CITY_LIST.map((city) => {
                    const isSelected = city.id === selectedCity;
                    return (
                      <button
                        key={city.id}
                        type="button"
                        onClick={() => handleCitySelect(city.id)}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors ${
                          isSelected
                            ? 'bg-orange-50/80 text-orange-950 font-semibold'
                            : 'text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        <div>
                          <div className="font-medium text-zinc-900">{city.name}</div>
                          <div className="text-[10px] text-zinc-500">
                            {city.state} · {city.wardCount} Municipal Wards
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-orange-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="px-3 py-1.5 border-t border-zinc-100 text-[10px] text-zinc-400">
                  Total 849 wards across 6 cities
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Navigation Tabs (6 Primary Pages) */}
        <nav
          className="hidden md:flex items-center gap-1 overflow-x-auto"
          aria-label="Main Navigation"
        >
          {NAVIGATION_ITEMS.map((item) => {
            const active = isTabActive(item.href);
            const Icon = PAGE_ICONS[item.id];
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                  active
                    ? 'bg-zinc-900 text-white font-semibold shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
                title={item.description}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-orange-400' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Mobile Hamburger Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle mobile menu"
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 focus:outline-none"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-200 bg-white px-4 py-3 space-y-1 shadow-lg animate-in slide-in-from-top-2">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 py-1">
            Navigation
          </div>
          {NAVIGATION_ITEMS.map((item) => {
            const active = isTabActive(item.href);
            const Icon = PAGE_ICONS[item.id];
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-orange-50 text-orange-950 font-semibold'
                    : 'text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-orange-600' : 'text-zinc-400'}`} />
                <div>
                  <div>{item.label}</div>
                  <div className="text-[11px] text-zinc-500 font-normal">{item.description}</div>
                </div>
              </Link>
            );
          })}
          <div className="pt-2 border-t border-zinc-100 mt-2">
            <FreshnessBanner
              metadata={activeCityData?.forecastMetadata}
              lastUpdatedTime={activeCityData?.lastFetched}
              compact
            />
          </div>
        </div>
      )}
    </header>
  );
}
