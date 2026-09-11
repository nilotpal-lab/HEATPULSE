'use client';

/**
 * HeatPulse — Central Application State Store
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 *
 * Implements lightweight, reactive global store via React's useSyncExternalStore.
 * Manages:
 * - selectedCity (default: 'bengaluru')
 * - selectedWard / selectedWardId
 * - activeLayer ('heat_conditions' | 'thermal_stress' | 'health_impact')
 * - isDrawerOpen (right-side ward detail drawer)
 * - forecastRun (NWP run_time, valid_time, provider, status)
 * - cachedCityData (GeoJSON, risks, assessments, weather forecasts, IMD warning)
 */

import { useSyncExternalStore, useCallback } from 'react';
import { CityId, CITIES, WardFeatureCollection } from '@/types/gis';
import { ForecastRunMetadata, WardWeatherForecast } from '@/types/weather';
import { WardRiskAssessment } from '@/types/thermal';
import { WardRisk } from '@/types/risk';
import { ImdDistrictWarning, evaluateImdDistrictWarning } from '@/lib/imd-service';
import { ThematicLayer, CityDataCache, HeatPulseStoreState } from '@/types/navigation';

export interface ForecastContext {
  forecastRunTime: string | null;
  fetchedAt: string | null;
  currentValidTime: string | null;
  selectedValidTime: string | null;
  horizonStart: string | null;
  horizonEnd: string | null;
  mode: 'CURRENT' | 'FORECAST' | 'PEAK';
}

declare module '@/types/navigation' {
  interface HeatPulseStoreState {
    forecastContext: ForecastContext;
    geojsonData: WardFeatureCollection | null;
  }
  interface CityDataCache {
    geojsonData?: WardFeatureCollection | null;
  }
}

export const initialForecastContext: ForecastContext = {
  forecastRunTime: null,
  fetchedAt: null,
  currentValidTime: null,
  selectedValidTime: null,
  horizonStart: null,
  horizonEnd: null,
  mode: 'CURRENT',
};

const createInitialCityCache = (): Record<CityId, CityDataCache> => ({
  bengaluru: {
    geoJson: null,
    geojsonData: null,
    wardRisks: [],
    assessments: [],
    weatherForecasts: {},
    imdWarning: null,
    forecastMetadata: null,
    lastFetched: null,
    status: 'idle',
  },
  pune: {
    geoJson: null,
    geojsonData: null,
    wardRisks: [],
    assessments: [],
    weatherForecasts: {},
    imdWarning: null,
    forecastMetadata: null,
    lastFetched: null,
    status: 'idle',
  },
  mumbai: {
    geoJson: null,
    geojsonData: null,
    wardRisks: [],
    assessments: [],
    weatherForecasts: {},
    imdWarning: null,
    forecastMetadata: null,
    lastFetched: null,
    status: 'idle',
  },
  kolkata: {
    geoJson: null,
    geojsonData: null,
    wardRisks: [],
    assessments: [],
    weatherForecasts: {},
    imdWarning: null,
    forecastMetadata: null,
    lastFetched: null,
    status: 'idle',
  },
  chennai: {
    geoJson: null,
    geojsonData: null,
    wardRisks: [],
    assessments: [],
    weatherForecasts: {},
    imdWarning: null,
    forecastMetadata: null,
    lastFetched: null,
    status: 'idle',
  },
  coimbatore: {
    geoJson: null,
    geojsonData: null,
    wardRisks: [],
    assessments: [],
    weatherForecasts: {},
    imdWarning: null,
    forecastMetadata: null,
    lastFetched: null,
    status: 'idle',
  },
});

let currentState: HeatPulseStoreState = {
  selectedCity: 'bengaluru',
  selectedWard: null,
  selectedWardId: null,
  activeLayer: 'heat_conditions',
  isDrawerOpen: false,
  forecastRun: null,
  cachedCityData: createInitialCityCache(),
  forecastContext: initialForecastContext,
  geojsonData: null,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function updateState(updater: (prev: HeatPulseStoreState) => HeatPulseStoreState) {
  currentState = updater(currentState);
  notify();
}

export const heatPulseActions = {
  setSelectedCity(cityId: CityId) {
    updateState((prev) => {
      if (prev.selectedCity === cityId) return prev;
      const nextGeo = prev.cachedCityData[cityId]?.geoJson || null;
      return {
        ...prev,
        selectedCity: cityId,
        selectedWard: null,
        selectedWardId: null,
        geojsonData: nextGeo,
        isDrawerOpen: false,
      };
    });
  },

  setSelectedWard(wardName: string | null, wardId?: string | null) {
    updateState((prev) => ({
      ...prev,
      selectedWard: wardName,
      selectedWardId: wardId !== undefined ? wardId : wardName,
      isDrawerOpen: Boolean(wardName || wardId),
    }));
  },

  openWardDrawer(wardIdOrName: string, wardId?: string) {
    updateState((prev) => ({
      ...prev,
      selectedWard: wardIdOrName,
      selectedWardId: wardId || wardIdOrName,
      isDrawerOpen: true,
    }));
  },

  closeWardDrawer() {
    updateState((prev) => ({
      ...prev,
      isDrawerOpen: false,
      selectedWard: null,
      selectedWardId: null,
    }));
  },

  setDrawerOpen(isOpen: boolean) {
    updateState((prev) => ({
      ...prev,
      isDrawerOpen: isOpen,
    }));
  },

  setActiveLayer(layer: ThematicLayer) {
    updateState((prev) => ({
      ...prev,
      activeLayer: layer,
    }));
  },

  setForecastRun(metadata: ForecastRunMetadata) {
    updateState((prev) => ({
      ...prev,
      forecastRun: metadata,
    }));
  },

  setForecastMode(mode: 'CURRENT' | 'FORECAST' | 'PEAK') {
    updateState((prev) => ({
      ...prev,
      forecastContext: {
        ...prev.forecastContext,
        mode,
      },
    }));
  },

  setSelectedValidTime(time: string | null) {
    updateState((prev) => ({
      ...prev,
      forecastContext: {
        ...prev.forecastContext,
        selectedValidTime: time,
        mode: time ? 'FORECAST' : prev.forecastContext.mode,
      },
    }));
  },

  setForecastContext(patch: Partial<ForecastContext>) {
    updateState((prev) => ({
      ...prev,
      forecastContext: {
        ...prev.forecastContext,
        ...patch,
      },
    }));
  },

  setCityCacheData(cityId: CityId, patch: Partial<CityDataCache>) {
    updateState((prev) => {
      const existing = prev.cachedCityData[cityId] || {
        geoJson: null,
        geojsonData: null,
        wardRisks: [],
        assessments: [],
        weatherForecasts: {},
        imdWarning: null,
        forecastMetadata: null,
        lastFetched: null,
        status: 'idle',
      };
      const updatedCity = { ...existing, ...patch };
      const isSelected = prev.selectedCity === cityId;
      const newGeo =
        patch.geoJson !== undefined
          ? patch.geoJson
          : patch.geojsonData !== undefined
          ? patch.geojsonData
          : undefined;

      return {
        ...prev,
        geojsonData: isSelected && newGeo !== undefined ? newGeo : prev.geojsonData,
        cachedCityData: {
          ...prev.cachedCityData,
          [cityId]: updatedCity,
        },
        forecastRun: patch.forecastMetadata || prev.forecastRun,
      };
    });
  },

  /**
   * Fetches GeoJSON, Risk Assessments, Weather, and IMD warning for a city.
   * Immediately fetches and sets local GeoJSON so the map renders in <1s,
   * while weather and risk assessments are fetched asynchronously.
   */
  async loadCityData(cityId: CityId, force = false): Promise<void> {
    const cached = currentState.cachedCityData[cityId];
    if (!force && cached && cached.status === 'success' && cached.geoJson && cached.assessments?.length > 0) {
      return;
    }

    const cityMeta = CITIES[cityId] || CITIES.bengaluru;

    // 1. Immediately ensure GeoJSON is in store before or independently of network API calls
    const existingGeo = cached?.geoJson;
    if (existingGeo) {
      // Already cached in memory — keep it, set active geojsonData immediately
      if (currentState.selectedCity === cityId && !currentState.geojsonData) {
        updateState((prev) => ({
          ...prev,
          geojsonData: existingGeo,
        }));
      }
    } else {
      // Mark loading status
      heatPulseActions.setCityCacheData(cityId, { status: 'loading' });

      // Fetch static local GeoJSON immediately from local processed geojson path
      fetch(cityMeta.dataPath)
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to load GeoJSON: ${res.statusText}`);
          return res.json() as Promise<WardFeatureCollection>;
        })
        .then((geoJson) => {
          if (geoJson) {
            heatPulseActions.setCityCacheData(cityId, {
              geoJson,
              geojsonData: geoJson,
            });
            if (currentState.selectedCity === cityId) {
              updateState((prev) => ({
                ...prev,
                geojsonData: geoJson,
              }));
            }
          }
        })
        .catch((err) => {
          console.warn(`GeoJSON fetch error for ${cityId}:`, err);
        });
    }

    // Set status to loading for visual feedback and state tracking
    heatPulseActions.setCityCacheData(cityId, { status: 'loading' });

    // 2. Independently and asynchronously fetch weather, risk assessments, and IMD warning
    try {
      const cacheBuster = force ? `&refresh=true&_t=${Date.now()}` : '';
      const riskPromise = fetch(`/api/risk?city=${cityId}${cacheBuster}`)
        .then((res) => {
          if (!res.ok) {
            console.warn(`Risk endpoint warning for ${cityId}: ${res.statusText}`);
            return null;
          }
          return res.json();
        })
        .catch((err) => {
          console.warn(`Risk fetch error for ${cityId}:`, err);
          return null;
        });

      const imdPromise = fetch(`/api/imd?city=${cityId}${cacheBuster}`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);

      const weatherPromise = fetch(`/api/weather?city=${cityId}${cacheBuster}`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);

      const [riskData, imdData, weatherData] = await Promise.all([
        riskPromise,
        imdPromise,
        weatherPromise,
      ]);

      const assessments: WardRiskAssessment[] = riskData?.assessments || [];
      const wardRisks: WardRisk[] = riskData?.wards || [];
      const forecastMetadata: ForecastRunMetadata | null =
        riskData?.forecast_metadata || weatherData?.metadata || null;

      const weatherForecasts: Record<string, WardWeatherForecast> =
        weatherData?.wards || {};

      // Calculate or extract IMD-criteria evaluation. The canonical /api/imd
      // shape is { success, data }; accept the legacy { warning } alias too.
      let imdWarning: ImdDistrictWarning | null =
        (imdData?.data as ImdDistrictWarning | undefined) ||
        (imdData?.warning as ImdDistrictWarning | undefined) ||
        null;
      if (!imdWarning) {
        // Local fallback evaluation: only supply a temperature when ward
        // telemetry genuinely exists — never a fabricated 0/35 stand-in.
        const temps = wardRisks
          .map((w) => w.currentTemp)
          .filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
        const peakTemp = temps.length > 0 ? Math.max(...temps) : undefined;
        imdWarning = evaluateImdDistrictWarning(cityId, peakTemp);
      }

      const nowIso = new Date().toISOString();
      const rawMeta = forecastMetadata as (ForecastRunMetadata & { valid_from?: string; valid_to?: string }) | null;
      const runTime = rawMeta?.run_time || null;
      const validTime = rawMeta?.valid_time || null;
      const firstWard = Object.values(weatherForecasts)[0];
      const validFrom = rawMeta?.valid_from || (firstWard?.hourly?.time ? firstWard.hourly.time[0] : validTime);
      const validTo = rawMeta?.valid_to || (firstWard?.hourly?.time ? firstWard.hourly.time[firstWard.hourly.time.length - 1] : null);

      updateState((prev) => {
        const existingCity = prev.cachedCityData[cityId];
        const activeGeo = existingCity?.geoJson || prev.geojsonData;
        return {
          ...prev,
          forecastRun: forecastMetadata || prev.forecastRun,
          forecastContext: {
            ...prev.forecastContext,
            forecastRunTime: runTime || prev.forecastContext.forecastRunTime,
            fetchedAt: forecastMetadata?.fetched_at || nowIso,
            currentValidTime: validTime || prev.forecastContext.currentValidTime,
            selectedValidTime: prev.forecastContext.selectedValidTime || validTime,
            horizonStart: validFrom || prev.forecastContext.horizonStart,
            horizonEnd: validTo || prev.forecastContext.horizonEnd,
          },
          cachedCityData: {
            ...prev.cachedCityData,
            [cityId]: {
              ...existingCity,
              geoJson: activeGeo,
              geojsonData: activeGeo,
              wardRisks,
              assessments,
              weatherForecasts,
              imdWarning,
              forecastMetadata,
              lastFetched: Date.now(),
              status: assessments.length > 0 ? 'success' : 'error',
              errorMessage: assessments.length === 0 ? 'Failed to retrieve ward risk assessments' : undefined,
            },
          },
        };
      });
    } catch (err: unknown) {
      console.error(`Error loading forecast/risk data for ${cityId}:`, err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      heatPulseActions.setCityCacheData(cityId, {
        status: 'error',
        errorMessage: msg,
      });
    }
  },

  /**
   * Refreshes forecast metrics for the city without reloading GIS geometry
   */
  async refreshForecastMetrics(cityId?: CityId): Promise<void> {
    const targetCity = cityId || currentState.selectedCity;
    return heatPulseActions.loadCityData(targetCity, true);
  },
};

// Store subscription getter
function getSnapshot(): HeatPulseStoreState {
  return currentState;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Universal hook to access HeatPulse global store
 */
export function useHeatPulseStore<T>(selector?: (state: HeatPulseStoreState) => T): T {
  const state = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot // SSR snapshot
  );
  return selector ? selector(state) : (state as unknown as T);
}

/**
 * Hook to access active city data cache
 */
export function useActiveCityData(): {
  selectedCity: CityId;
  data: CityDataCache;
  isLoading: boolean;
  reload: () => Promise<void>;
  refreshForecast: () => Promise<void>;
} {
  const selectedCity = useHeatPulseStore((s) => s.selectedCity);
  const data = useHeatPulseStore(
    (s) =>
      s.cachedCityData[selectedCity] || {
        geoJson: null,
        geojsonData: null,
        wardRisks: [],
        assessments: [],
        weatherForecasts: {},
        imdWarning: null,
        forecastMetadata: null,
        lastFetched: null,
        status: 'idle',
      }
  );

  const reload = useCallback(() => {
    return heatPulseActions.loadCityData(selectedCity, true);
  }, [selectedCity]);

  const refreshForecast = useCallback(() => {
    return heatPulseActions.refreshForecastMetrics(selectedCity);
  }, [selectedCity]);

  return {
    selectedCity,
    data,
    isLoading: data.status === 'loading',
    reload,
    refreshForecast,
  };
}

/**
 * Hook to access and control forecast timing context
 */
export function useForecastContext(): {
  forecastContext: ForecastContext;
  setMode: (mode: 'CURRENT' | 'FORECAST' | 'PEAK') => void;
  setSelectedValidTime: (time: string | null) => void;
  setForecastContext: (patch: Partial<ForecastContext>) => void;
} {
  const forecastContext = useHeatPulseStore((s) => s.forecastContext);
  return {
    forecastContext,
    setMode: heatPulseActions.setForecastMode,
    setSelectedValidTime: heatPulseActions.setSelectedValidTime,
    setForecastContext: heatPulseActions.setForecastContext,
  };
}

if (typeof window !== 'undefined') {
  (window as unknown as { __heatPulseActions?: typeof heatPulseActions }).__heatPulseActions = heatPulseActions;
}
