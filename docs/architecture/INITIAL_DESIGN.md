# HeatPulse — Initial Architecture Design

## 1. SIH Requirement Interpretation
Transform meteorological forecasts into localized human thermal stress and heat-health risk intelligence at the administrative operational level. Shift from "what will the weather be" to "what will the weather do to human health."

## 2. Product Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │   Map View   │  │ Intelligence │  │   Alerts      │ │
│  │  (OpenLayers)│  │    Panel     │  │   System      │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
│         │                 │                   │         │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌───────▼───────┐ │
│  │  Layer Mgr   │  │  Timeline    │  │  Risk Display │ │
│  └──────────────┘  └──────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    API Layer (Next.js)                   │
│  /api/geography  /api/weather  /api/thermal             │
│  /api/vulnerability /api/risk  /api/actions             │
└─────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Weather     │ │  Thermal     │ │  Risk        │
│  Service     │ │  Engine      │ │  Engine      │
│  (OpenMeteo) │ │  (HI/WBGT/   │ │  (Baseline)  │
│              │ │   UTCI)      │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
         │               │               │
         ▼               ▼               ▼
┌──────────────────────────────────────────────────────┐
│                   DATABASE (Supabase)                 │
│  admin_units, weather_forecasts, thermal_metrics,    │
│  vulnerability, predictions, risks, actions          │
└──────────────────────────────────────────────────────┘
```

## 3. Map Architecture
- **Context Layer**: Bhuvan WMS (LULC, flood hazard)
- **Country Layer**: India boundary (SimplyGIS, EPSG:4326)
- **State Layer**: Maharashtra boundary (SimplyGIS, EPSG:4326)
- **City Layer**: Pune boundaries (SimplyGIS MH_District, filtered)
- **Admin Layer**: 15 Administrative Wards (datameet, EPSG:4326)
- **Risk Layer**: Color-coded risk per admin unit
- **Secondary Layer**: Ward offices, hospitals (reference points)

## 4. Bhuvan Architecture
- WMS as contextual basemap (not authoritative)
- GetMap requests for Pune viewport
- Attribution: "© Bhuvan, NRSC, ISRO"
- Fallback: standard tile layer if Bhuvan unavailable

## 5. Map Engine Comparison

| Criteria | OpenLayers | MapLibre GL | Leaflet |
|---|---|---|---|
| Bhuvan WMS | ✅ Native OGC | ⚠️ Plugin needed | ✅ Plugin |
| Vector styling | ✅ Excellent | ✅ Excellent | ⚠️ Basic |
| Feature picking | ✅ WFS/getFeatureInfo | ✅ Native | ⚠️ Plugin |
| React integration | ⚠️ Complex | ✅ ol-react | ✅ Simple |
| Performance | ✅ Good | ✅ Excellent (GPU) | ✅ Good |
| Zoom/viewport | ✅ Full control | ✅ Full control | ⚠️ Limited |
| Maintainability | ⚠️ Steep learning | ✅ Modern API | ✅ Simple |

**Preliminary Choice**: OpenLayers — best OGC/WMS support for Bhuvan integration, robust feature picking.

## 6. India/Maharashtra GIS Strategy
- Convert LCC_WGS84 SHP → EPSG:4326 GeoJSON using ogr2ogr
- Store in data/processed/
- Clip to relevant viewport for performance
- Validate geometry (no self-intersections, valid rings)

## 7. Pune GIS Strategy
- Primary: 15 Admin Wards from datameet (cross-validated with municipal)
- CRS: EPSG:4326 (already in GeoJSON)
- Validate: topology, containment, representative points
- Secondary: 58 Electoral Wards 2022 as reference layer

## 8. Weather Architecture
- Open-Meteo API (free, no key)
- Representative point per admin ward (interior point, not centroid)
- Batch requests for 120h forecast
- Cache results, no weather-on-pan/zoom

## 9. Thermal Architecture
- Heat Index (Rogers formula, US NWS standard)
- WBGT approximation (radiation estimated from solar radiation)
- UTCI (simplified algorithm)
- All metrics with documented assumptions and limitations

## 10. Vulnerability Architecture
- Data sources: Census voter data (proxy), ward office locations
- Classification: REAL / DERIVED / ESTIMATED / PLACEHOLDER / UNKNOWN
- Factors: population density, elderly proxy, outdoor worker proxy
- No fabricated demographic data

## 11. Health-Risk Architecture
- Transparent baseline model (not claimed as ML-trained)
- ML-ready interface for future real data
- Risk = f(Thermal Stress, Vulnerability, Forecast Trajectory)
- Output: riskScore, riskLevel, drivers, confidence, recommendedAction

## 12. Database Schema (Supabase)
- states, cities, administrative_units (with geometry)
- weather_references, forecasts
- thermal_metrics, vulnerability_scores
- predictions, risks, action_recommendations
- alerts

## 13. API Design
- Clean service boundaries
- Server-side only for sensitive operations
- No secrets in client bundle
- CORS configured for Supabase

## 14. UI Layout
- Desktop-first
- Large map (left 70%)
- Intelligence panel (right 30%)
- Top bar: HeatPulse branding, geography, timestamp, status
- Timeline slider: T+0 to T+120h

## 15. Browser QA
- Playwright automation
- Click determinism tests
- Zoom/viewport tests
- Stale layer removal tests
- 25 required screenshots

## 16. Security
- .env.local for all secrets
- Service role key server-only
- Regular secret scans
- No secrets in git, logs, or screenshots

## 17. Unresolved Questions
1. Will OpenLayers handle Bhuvan WMS correctly at Indian map scales?
2. Is the 15-admin-ward geometry current enough (no 2024/2025 updates checked)?
3. What is the exact thermal stress formula to prioritize (HI vs UTCI vs WBGT)?
4. Can we access IMD heatwave warning data?
5. What are Pune's official heat action plan thresholds?
