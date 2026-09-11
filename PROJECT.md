# PROJECT.md — HeatPulse Master Build Specification

## Architecture
HeatPulse is an India-focused extreme-heat early-warning and human thermal-stress decision-support platform (SIH26083) for the Ministry of Earth Sciences / NCMRWF.
- **Frontend / UI**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons, OpenLayers v10.
- **State Management**: Centralized application store (`useHeatPulseStore`) managing `selectedCity`, `selectedWard`, `activeLayer`, `forecastRun`, and drawer state.
- **Spatial / GIS**: Normalized RFC 7946 EPSG:4326 GeoJSON assets across 6 cities (849 municipal wards total: Bengaluru 369, Pune 15, Mumbai 24, Kolkata 141, Chennai 200, Coimbatore 100).
- **Basemap Engine**: Primary ISRO NRSC Bhuvan WMS (`lulc:BR_LULC50K_1112`) with automatic OpenStreetMap (OSM) network fallback and zoom-dependent Level of Detail (LOD).
- **Weather Pipeline**: Server-side batched weather sampling per ward centroid from Open-Meteo NWP grid with separate `FORECAST_RUN_TIME` (model initialization) and `FORECAST_VALID_TIME` (forecast window), in-memory cache, and honest stale-fallback handling.
- **Thermal Biometeorology Engine**: Mathematically verified NOAA Rothfusz Heat Index ($T \ge 27^\circ\text{C}$ with low/high humidity adjustments), BoM outdoor WBGT ($0.567T + 0.393e + 3.94$), and UTCI Proxy.
- **Strict Concept Segregation**: 5 distinct concepts (Heat Conditions, Thermal Stress, Vulnerability, Composite Risk, Health Impact).
- **Data Honesty**: Zero synthetic mortality figures, zero fake ML models, disabled health layer, no hardcoded blueprint numbers.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Non-destructive Pre-Implementation Audit Report | Complete 20-point repository audit | M0 (Done) | R0 |
| 2 | Operational GBA 369-Ward GeoJSON | Normalized RFC 7946 `[lon, lat]` EPSG:4326 operational file | M1 | R1 |
| 3 | Bengaluru Ward Centroids | Deterministic centroid calculation for all 369 wards | M1 | R1 |
| 4 | Legacy BBMP 225-Ward Segregation | Keep 225-ward shapefile segregated as historical reference | M1 | R1 |
| 5 | Companion Cities Normalization | Pune (15), Mumbai (24), Kolkata (141), Chennai (200), Coimbatore (100) — 849 total wards | M1 | R1 |
| 6 | Primary ISRO Bhuvan WMS Basemap | NRSC Bhuvan WMS `lulc:BR_LULC50K_1112` as primary base layer | M2 | R2 |
| 7 | OSM Network Fallback | Automatic fallback to OpenStreetMap if Bhuvan tiles fail | M2 | R2 |
| 8 | LOD Zoom Hierarchy | National scale (zoom 4-7) vs City scale (8-12) vs Ward scale (13-18) | M2 | R2 |
| 9 | Spatial Layer Styling | Choropleth styling, hover highlight, and ward selection highlight | M2 | R2 |
| 10 | Server-Side Batched Weather Pipeline | Batch NWP weather queries per ward centroid via Open-Meteo | M3 | R3 |
| 11 | Persistent Forecast Run Architecture | Track `FORECAST_RUN_TIME` and `FORECAST_VALID_TIME` separately | M3 | R3 |
| 12 | In-Memory Cache & Stale Fallback | Cache forecast runs, transparent fallback to last run on failure | M3 | R3 |
| 13 | Honest Weather Labeling | Explicitly label source as ward-localized NWP forecast | M3 | R3 |
| 14 | NOAA Rothfusz Heat Index | Heat Index with low/high humidity adjustments for $T \ge 27^\circ\text{C}$ | M4 | R4 |
| 15 | BoM Simplified Outdoor WBGT | $0.567T + 0.393e + 3.94$ with correct vapor pressure | M4 | R4 |
| 16 | UTCI Proxy Designation | Transparently label apparent temperature as UTCI Proxy | M4 | R4 |
| 17 | Thermal Score Scaling Correction | Fix scaling divisor from 3.4 to 0.34 in composite risk | M4 | R4 |
| 18 | Strict 5-Concept Segregation | Segregate Heat Conditions, Thermal Stress, Vulnerability, Risk, Health Impact | M4 | R4 |
| 19 | Official IMD District Warning Segregation | Independent thermal advisories vs official IMD district warnings | M4 | R4 |
| 20 | Explicit Disabled Health Layer | Labeled "Coming with validated health-outcome model", zero fake casualties | M5 | R5 |
| 21 | Zero Hardcoded Blueprint Metrics | Dynamic binding or explicit "Estimated Baseline" labeling | M5 | R5 |
| 22 | Data-Backed Descriptive Insights | Meteorological patterns only without unsupported causal claims | M5 | R5 |
| 23 | Centralized Application State Store | Global store for city, ward, layer, and forecast state | M6 | R6 |
| 24 | 6-Page Navigation Shell | Header, tabs, city switcher, forecast freshness banner (`HH:MM IST`) | M6 | R6 |
| 25 | Page 1: India Overview | National thermal choropleth + monitored city cards | M6 | R6 |
| 26 | Page 2: City Overview (Primary Screen) | 3-block summary, Bhuvan map with layer switcher, 5-day outlook | M6 | R6 |
| 27 | Page 3: Forecast | 120-hour timeline narrative with diurnal curves | M6 | R6 |
| 28 | Page 4: Risk Areas | Ranked priority ward table with search, sorting, and map focus | M6 | R6 |
| 29 | Page 5: Insights | Non-causal spatial persistence patterns & compound corridors | M6 | R6 |
| 30 | Page 6: How HeatPulse Works | Scientific formulas, active provider metadata, non-claims | M6 | R6 |
| 31 | Right-Side Ward Detail Drawer | 8-section content hierarchy, slide-in animation | M6 | R6 |
| 32 | Automated GIS Test Suite | 48/48 deterministic checks across all 849 municipal wards | E2E | Acceptance |
| 33 | Data-Truth Assertion Suite | 15/15 checks (no fake ML, no fake IMD, no blueprint hardcoding) | E2E | Acceptance |
| 34 | Build & Lint Cleanliness | `npm run build` and `npm run lint` pass cleanly with zero errors | Final | Acceptance |
| 35 | Automated Public Health Advisory Generator | Per-grade (green/yellow/orange/red) advisories: public guidance, vulnerable pops, municipal actions, healthcare readiness | Phase 20 | R4 (SIH) |
| 36 | Municipal Action Trigger API | GET briefings + POST activation (cooling centres, work hours, water, healthcare, education, transport) | Phase 20 | SIH |
| 37 | Census 2011 Ward-Level Demographics | Real Census+NFHS-5 Pune ward profiles replace synthetic baseline (elderly, outdoor workers, slum %) | Phase 20 | R3 |
| 38 | Twin-Ward Demo Comparison | Same-temperature, different-risk ward pair (Aundh/Kasba) — SIH Buddy-recommended demo centerpiece | Phase 20 | SIH |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Phase 0 Pre-Implementation Audit | Non-destructive 20-point audit report | None | DONE |
| M1 | Operational Geography & Multi-City GIS | RFC 7946 369 Bengaluru wards + 5 companion cities (849 wards total) | M0 | DONE |
| M2 | Primary ISRO Bhuvan Basemap & LOD | Bhuvan WMS, OSM fallback, zoom-dependent rendering | M1 | DONE |
| M3 | Server-Side Batched Weather Pipeline | Centroid batching, forecast run persistence, memory cache | M1 | DONE |
| M4 | Biometeorological Thermal Engine | NOAA HI, BoM WBGT, UTCI proxy, scaling fix, IMD segregation | M3 | DONE |
| M5 | Data Honesty & Zero Fake ML | Disabled health layer, dynamic metrics, honest insights | M4 | DONE |
| M6 | 6-Page Navigation Shell & Ward Drawer | 6 screens, right-side 8-section drawer, city switcher | M2, M4, M5 | PLANNED |
| Phase 20 | Public Health Advisories & Municipal Actions | Advisory generator, Census 2011 demographic integration, municipal action API, twin-ward demo | M4, M5 | DONE |
| E2E | E2E Testing Track | GIS test suite (48 checks), Data-truth suite (15 checks) | M0 | IN_PROGRESS |
| Final | Final Verification & Hardening | 100% E2E tests passing, Tier 5 hardening, Forensic Audit | M6, E2E | PLANNED |

---

## Interface Contracts

### 1. GIS Engine ↔ Application State (`src/types/gis.ts`)
```typescript
export interface WardFeatureProperties {
  city_id: string; // 'bengaluru' | 'pune' | 'mumbai' | 'kolkata' | 'chennai' | 'coimbatore'
  ward_id: string; // canonical unique ID, e.g. 'blr-001' .. 'blr-369'
  ward_name: string;
  corporation?: string;
  zone?: string;
  population?: number;
  area_sqkm?: number;
  centroid: [number, number]; // [lon, lat] in EPSG:4326
}

export interface CityMetadata {
  id: string;
  name: string;
  state: string;
  wardCount: number;
  center: [number, number]; // [lon, lat]
  defaultZoom: number;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  dataPath: string;
}
```

### 2. Weather Pipeline ↔ Thermal Engine (`src/types/weather.ts`)
```typescript
export interface ForecastRunMetadata {
  run_time: string; // ISO UTC, model run initialization
  fetched_at: string; // ISO UTC, when server queried provider
  valid_time: string; // ISO UTC, current forecast hour
  provider: string; // 'Open-Meteo NWP Grid'
  model: string; // e.g. 'ECMWF IFS / GFS Seamless'
  status: 'fresh' | 'stale' | 'unavailable';
  attribution: string; // "Ward-localized forecast derived from numerical weather prediction"
}

export interface WardHourlyWeather {
  time: string[]; // ISO strings (120 hours)
  temperature_2m: number[]; // °C
  relative_humidity_2m: number[]; // %
  apparent_temperature: number[]; // °C (UTCI Proxy)
  wind_speed_10m?: number[]; // km/h
  direct_normal_irradiance?: number[]; // W/m²
}
```

### 3. Thermal Engine ↔ Risk Models (`src/types/thermal.ts`)
```typescript
export type HeatConditionLevel = 'Normal' | 'Elevated' | 'High' | 'Extreme';
export type ThermalStressLevel = 'Low' | 'Moderate' | 'High' | 'Severe';
export type VulnerabilityLevel = 'Low' | 'Moderate' | 'High' | 'Severe';
export type CompositeRiskLevel = 'Low' | 'Moderate' | 'High' | 'Severe';

export interface ThermalCalculations {
  heat_index: number; // NOAA Rothfusz °C with adjustments
  wbgt: number; // BoM outdoor shade °C
  utci_proxy: number; // Apparent temperature °C
  heat_condition: HeatConditionLevel;
  thermal_stress: ThermalStressLevel;
}

export interface WardRiskAssessment {
  ward_id: string;
  ward_name: string;
  city_id: string;
  thermal: ThermalCalculations;
  vulnerability_score: number; // 0-100 (Census baseline)
  vulnerability_level: VulnerabilityLevel;
  composite_risk_score: number; // 0-100: (0.6 * thermalScore) + (0.4 * vulnerabilityScore)
  composite_risk_level: CompositeRiskLevel;
  forecast_metadata: ForecastRunMetadata;
  contributing_factors: {
    atmospheric_pct: number; // 60% weight contribution
    vulnerability_pct: number; // 40% weight contribution
    primary_driver: string;
  };
}
```

---

## Code Layout
```
heatpulse/
├── public/
│   └── data/
│       ├── processed/
│       │   └── geojson/
│       │       ├── bengaluru-gba-369-wards.geojson  # Operational normalized RFC 7946
│       │       ├── pune-15-wards.geojson
│       │       ├── mumbai-24-wards.geojson
│       │       ├── kolkata-141-wards.geojson
│       │       ├── chennai-200-wards.geojson
│       │       └── coimbatore-100-wards.geojson
│       └── raw/                                     # Raw legacy references
├── src/
│   ├── app/
│   │   ├── layout.tsx                               # Global shell layout
│   │   ├── page.tsx                                 # City Overview (Primary Screen)
│   │   ├── india/page.tsx                           # Page 1: India Overview
│   │   ├── forecast/page.tsx                        # Page 3: 120-hour Forecast Narrative
│   │   ├── risk-areas/page.tsx                      # Page 4: Ranked Risk Areas Table
│   │   ├── insights/page.tsx                        # Page 5: Descriptive Insights
│   │   ├── how-it-works/page.tsx                    # Page 6: Scientific Methodology
│   │   └── api/
│   │       ├── weather/route.ts                     # Batched per-ward weather pipeline
│   │       ├── thermal/route.ts                     # Strict thermal calculations
│   │       ├── risk/route.ts                        # Multi-ward risk assessment
│   │       └── imd/route.ts                         # Official IMD district reference
│   ├── components/
│   │   ├── navigation/
│   │   │   ├── Header.tsx                           # Global navigation shell & city switcher
│   │   │   └── FreshnessBanner.tsx                  # Forecast run freshness (HH:MM IST)
│   │   ├── map/
│   │   │   ├── MapContainer.tsx                     # OpenLayers map wrapper
│   │   │   ├── BhuvanLayer.ts                       # Primary ISRO Bhuvan WMS + OSM fallback
│   │   │   └── LayerSwitcher.tsx                    # Heat Condition, Thermal Stress, Health (Disabled)
│   │   ├── drawer/
│   │   │   └── WardDetailDrawer.tsx                 # 8-section slide-in drawer
│   │   └── ui/                                      # Reusable cards, badges, tables
│   ├── lib/
│   │   ├── gis-utils.ts                             # Centroid, coordinate & GeoJSON normalization
│   │   ├── weather-service.ts                       # Open-Meteo multi-coordinate batched pipeline
│   │   ├── weather-cache.ts                         # Memory cache & run_time vs valid_time persistence
│   │   ├── thermal-engine.ts                        # NOAA Rothfusz, BoM WBGT, UTCI proxy
│   │   ├── risk-engine.ts                           # Composite risk (alpha=0.6, beta=0.4, /0.34 fix)
│   │   ├── imd-service.ts                           # Official district alerts reference
│   │   └── store.ts                                 # Centralized application state
│   └── types/
│       ├── gis.ts
│       ├── weather.ts
│       ├── thermal.ts
│       └── navigation.ts
└── tests/
    ├── gis/                                         # 48 deterministic GIS checks (849 wards)
    └── data-truth/                                  # 15 data-truth assertion checks
```
