/**
 * HeatPulse — Navigation, Store, and UI View Types
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 */

import { CityId, WardFeatureCollection } from './gis';
import { ForecastRunMetadata, WardWeatherForecast } from './weather';
import { WardRiskAssessment } from './thermal';
import { WardRisk } from './risk';
import { ImdDistrictWarning } from '@/lib/imd-service';

export type NavigationPage =
  | 'india'
  | 'city'
  | 'forecast'
  | 'risk-areas'
  | 'insights'
  | 'how-it-works'
  | 'demo';

export interface NavigationItem {
  id: NavigationPage;
  label: string;
  href: string;
  description: string;
  badge?: string;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'india',
    label: 'India Overview',
    href: '/india',
    description: 'National thermal overview and 6 monitored municipal cities',
  },
  {
    id: 'city',
    label: 'City Overview',
    href: '/',
    description: 'Primary operational screen: 3-block summary, ward map & 5-day outlook',
  },
  {
    id: 'forecast',
    label: 'Forecast',
    href: '/forecast',
    description: '120-hour timeline narrative with diurnal thermal curves',
  },
  {
    id: 'risk-areas',
    label: 'Risk Areas',
    href: '/risk-areas',
    description: 'Ranked priority ward table with search, sorting & map focus',
  },
  {
    id: 'insights',
    label: 'Insights',
    href: '/insights',
    description: 'Data-backed descriptive spatial patterns & persistence corridors',
  },
  {
    id: 'how-it-works',
    label: 'How It Works',
    href: '/how-it-works',
    description: 'Transparent scientific methodology, equations & data sources',
  },
  {
    id: 'demo',
    label: '⚡ Demo',
    href: '/demo',
    description: 'Twin ward comparison — why vulnerability-weighted risk matters',
    badge: 'SIH Demo',
  },
];

export type ThematicLayer = 'heat_conditions' | 'thermal_stress' | 'composite_risk' | 'health_impact';

export interface CityDataCache {
  geoJson: WardFeatureCollection | null;
  wardRisks: WardRisk[];
  assessments: WardRiskAssessment[];
  weatherForecasts: Record<string, WardWeatherForecast>;
  imdWarning: ImdDistrictWarning | null;
  forecastMetadata: ForecastRunMetadata | null;
  lastFetched: number | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  errorMessage?: string;
}

export interface HeatPulseStoreState {
  selectedCity: CityId;
  selectedWard: string | null;
  selectedWardId: string | null;
  activeLayer: ThematicLayer;
  isDrawerOpen: boolean;
  forecastRun: ForecastRunMetadata | null;
  cachedCityData: Record<CityId, CityDataCache>;
}
