# Original User Request

## 2026-09-06T10:13:00Z

# Teamwork Project Prompt — HeatPulse Master Build Specification

> Status: Launched
> Goal: Execute HeatPulse Master Build Specification across all 55 sections with multi-agent teamwork architecture
> Requested team: Full multi-agent teamwork system (Architect, GIS Specialist, Weather Pipeline Engineer, Biometeorology/Thermal Specialist, Frontend/UX Engineer, QA/Data-Truth Auditor)

Rebuild, harden, and scientifically verify HeatPulse — an India-focused extreme-heat early-warning and human thermal-stress decision-support platform for Smart India Hackathon 2026 (SIH26083: Extreme Heatwave Early Warning and Human Thermal Stress Index for Ministry of Earth Sciences / NCMRWF).

Working directory: c:/Users/nilot/OneDrive/Desktop/SIH CLAUDE CODE/heatpulse
Integrity mode: development

## Requirements

### R0. Phase 0 Pre-Implementation Verification & Repository Audit
- Perform a complete, non-destructive audit of the existing repository tracing UI → State → API → Data Pipeline → Thermal Engine → Risk Engine → Alerts.
- Generate the PRE-IMPLEMENTATION VERIFICATION REPORT covering all 20 required points (stack, routes, map architecture, GIS files, 225 vs 369 ward counts, weather pipeline, thermal equations, alert logic, vulnerability, database, health/ML status, and scientific gaps) before modifying any code.

### R1. Operational Geography & GBA 369-Ward Migration
- Maintain the non-destructive normalized operational copy at `heatpulse/public/data/processed/geojson/bengaluru-gba-369-wards.geojson` with standard RFC 7946 `[lon, lat]` EPSG:4326 without altering or destroying the raw source file `wards_bengaluru_gba.geojson`.
- Ensure all 369 wards have valid geometries, unique unit identifiers, and calculated deterministic centroids.
- Keep legacy 225-ward BBMP data strictly segregated as historical reference (no silent cross-mapping).
- Maintain multi-city compatibility for Pune (15), Mumbai (24), Kolkata (141), Chennai (200), and Coimbatore (100) — total 849 municipal wards.

### R2. Primary ISRO Bhuvan Basemap & Spatial Contrast
- Maintain ISRO NRSC Bhuvan WMS (`bhuvan-vec2.nrsc.gov.in/bhuvan/wms`, layer `lulc:BR_LULC50K_1112`) as the primary spatial basemap in OpenLayers with OpenStreetMap (OSM) as a network fallback.
- Establish clear visual hierarchy: Basemap Context → Thematic Heat Choropleth → Administrative Boundaries → Selected Ward.
- Implement progressive level of detail (LOD): National India scale does NOT render municipal ward polygons; city zoom renders all ward boundaries.

### R3. Server-Side Batched Weather Pipeline with Forecast Run Persistence
- Implement server-side batched weather fetching based on ward centroids using Open-Meteo NWP grid.
- Prohibit client-side browser request storms and prohibit copying a single city center value to all wards.
- Build persistent forecast run architecture tracking `FORECAST_RUN_TIME` (model initialization) and `FORECAST_VALID_TIME` (target window) separately with memory caching on top.
- Label weather honestly as *"Ward-localized forecast derived from numerical weather prediction"*; handle upstream failures with transparent stale/unavailable status.

### R4. Thermal Engine & Strict Scientific Concept Separation
- Implement NOAA Rothfusz Heat Index ($T \ge 27^\circ\text{C}$ with dry/high-humidity adjustments), simplified outdoor WBGT ($0.567T + 0.393e + 3.94$), and designate apparent temperature as **UTCI Proxy**.
- Strictly segregate distinct scientific concepts across data models, APIs, and UI:
  1. `Heat Conditions` (Atmospheric state: Normal, Elevated, High, Extreme)
  2. `Thermal Stress` (Human biometeorology: Low, Moderate, High, Severe)
  3. `Vulnerability` (Socio-ecological baseline context: Census 2011 / survey)
  4. `Thermal-Vulnerability Risk` (Heuristic composite exposure: $\alpha=0.6, \beta=0.4$)
  5. `Health Impact` (Epidemiological clinical outcomes — strictly disabled/future architecture)
- Separate HeatPulse thermal advisories from official IMD district reference warnings; never fabricate IMD ward-level warnings or official heatwave claims.

### R5. Data Honesty & Zero Fake ML Claims
- Health layer is explicitly marked as `Coming with validated health-outcome model` with zero synthetic mortality or hospitalization numbers.
- Forbid hardcoding blueprint illustrative numbers into the codebase; all metrics must bind dynamically to pipeline data or display `Unavailable` / `Estimated Baseline`.
- Insights must describe data-backed patterns only without unsupported causal claims.

### R6. 6-Page Navigation Shell & Right-Side Ward Detail Drawer
- Build the 6-page navigation shell:
  1. **India Overview**: National scale thermal choropleth + monitored city cards (no ward clutter).
  2. **City Overview (PRIMARY SCREEN)**: City header + forecast freshness (`HH:MM IST`), 3-block summary (Heat Conditions, Thermal Stress, Official IMD Reference), Bhuvan ward map with layer switcher (`Heat Conditions`, `Thermal Stress`, `Health Impact [Disabled]`), 5-day forecast outlook.
  3. **Forecast**: 120-hour timeline narrative with diurnal thermal curves and expandable meteorological parameters.
  4. **Risk Areas**: Ranked priority ward table with search, sorting, and synchronized spatial focus.
  5. **Insights**: Non-causal spatial persistence patterns and compound exposure corridors.
  6. **How HeatPulse Works**: Transparent scientific methodology, formulas, active provider metadata, and explicit non-claims.
  7. **Right-Side Ward Detail Drawer**: Slides in on polygon click with 8-section content hierarchy (Ward Identity, Status, Peak Period, 24h Trajectory, Why This Ward, Vulnerability Context, Exposed Groups, Recommended Actions, Expandable Provenance).

## Acceptance Criteria

### GIS & Spatial Validation
- [ ] Operational copy `bengaluru-gba-369-wards.geojson` validated with standard `[lon, lat]` EPSG:4326 without altering source file.
- [ ] All 369 Bengaluru GBA wards render, highlight on hover/click, and have valid calculated centroids.
- [ ] Bhuvan/ISRO is active as primary basemap with OSM as graceful fallback.
- [ ] LOD zoom hierarchy functions properly (national overview vs city ward polygons).
- [ ] Companion cities (Pune 15, Mumbai 24, Kolkata 141, Chennai 200, Coimbatore 100) render accurately without regression.

### Weather, Thermal & Persistence
- [ ] Weather forecasts are localized per ward centroid via server-side batched processing.
- [ ] Persistent forecast run architecture tracks `run_time` and `valid_time` separately with memory caching on top.
- [ ] NOAA Heat Index, BoM WBGT, and UTCI Proxy are mathematically accurate, clearly labeled, and dynamically bound.
- [ ] Upstream weather failures display honest "Source Unavailable / Showing Last Run" states with zero synthetic data.
- [ ] Weather source is labeled as *"Ward-localized forecast derived from numerical weather prediction"*.

### Decision Support & Scientific Integrity
- [ ] Primary risk display uses meaningful categories (`LOW`, `MODERATE`, `HIGH`, `SEVERE`) with expandable explanations of contributing factors.
- [ ] Insights contain zero unsupported causal claims (describes observed/derived meteorological patterns only).
- [ ] Health Impact layer is explicitly marked as `Coming with validated health-outcome model` with zero synthetic mortality/hospitalization values.
- [ ] HeatPulse thermal advisories are strictly segregated from official IMD district reference warnings.
- [ ] Methodology page dynamically renders active configured provider and model metadata.

### User Experience & Pages
- [ ] All 6 primary pages (`India Overview`, `City Overview`, `Forecast`, `Risk Areas`, `Insights`, `How HeatPulse Works`) are fully functional via clean navigation.
- [ ] City Overview serves as the primary product screen with 3-block summary, Bhuvan map, and 5-day outlook.
- [ ] Ward detail opens in a right-side drawer preserving map visibility.
- [ ] Forecast freshness (`Forecast run: HH:MM IST`, `Last updated: HH:MM IST`, `Valid: [Time]`) is visible across all forecast screens.

### Testing & Verification
- [ ] Automated deterministic GIS test suite passes 100% for all 369 Bengaluru wards and all 5 companion cities (48/48 checks).
- [ ] Data-truth assertion tests pass verifying absence of fake ML, fake IMD ward warnings, hardcoded blueprint numbers, and unacknowledged proxies (15/15 checks).
- [ ] Production build (`npm run build`) and linter (`npm run lint`) pass cleanly with zero TypeScript errors and zero warnings.
- [ ] End-to-end user journey verified in browser.

## 2026-09-06T17:20:40Z

# Teamwork Project Prompt — HeatPulse Master Build & Hardening

> Status: Launched
> Goal: Execute HeatPulse Master Build & Hardening across full multi-agent teamwork system
> Requested team: Full multi-agent teamwork system (Architect, GIS Specialist, Weather Pipeline Engineer, Biometeorology/Thermal Specialist, Frontend/UX Engineer, QA/Data-Truth Auditor)

Rebuild, harden, and scientifically verify HeatPulse — an India-focused extreme-heat early-warning and human thermal-stress decision-support platform for Smart India Hackathon 2026 (SIH26083: Extreme Heatwave Early Warning and Human Thermal Stress Index for Ministry of Earth Sciences / NCMRWF).

Working directory: c:/Users/nilot/OneDrive/Desktop/SIH CLAUDE CODE/heatpulse
Integrity mode: development

## Baseline State (Phase 0 Audit Complete)
- **GIS Status**: 849 total municipal wards across 6 cities (Bengaluru 369 GBA, Pune 15, Mumbai 24, Kolkata 141, Chennai 200, Coimbatore 100). All coordinates verified in RFC 7946 `[lon, lat]` EPSG:4326.
- **Basemap Status**: ISRO NRSC Bhuvan WMS active with automated OSM fallback.
- **Biometeorology Status**: NOAA Rothfusz Heat Index, BoM simplified outdoor WBGT, and UTCI Proxy implemented with verified mathematical precision.
- **Data Truth Status**: Zero fake ML claims, zero synthetic clinical metrics, and strict segregation between official IMD district alerts and localized ward thermal stress advisories.
- **Automated Verification**: 63/63 deterministic test assertions passing (Tier 1: 48 GIS checks, Tier 2: 15 Data-truth checks).

## Requirements

### R1. Operational Geography & Spatial Visualization
- Ensure all 849 wards across the 6 metropolitan regions render crisply with high-contrast choropleth color scales.
- Maintain progressive Level of Detail (LOD): National scale overview (India LOD 0) vs city ward choropleth (LOD 2).
- Ensure hover tooltips, click selection, and bounds auto-fitting operate smoothly without viewport jitter.

### R2. Weather Pipeline & Forecast Run Synchronization
- Maintain server-side batched centroid NWP queries with `WeatherCache` (15-minute TTL).
- Preserve explicit tracking of `FORECAST_RUN_TIME` (model initialization) and `FORECAST_VALID_TIME` (target window).
- Maintain graceful degradation on upstream failures with honest stale-run badges.

### R3. Decision Support & Scientific Integrity
- Strictly maintain the 5-tier scientific separation:
  1. `Heat Conditions` (Synoptic atmospheric state: Normal, Elevated, High, Extreme)
  2. `Thermal Stress` (Human biometeorological load: Low, Moderate, High, Severe)
  3. `Vulnerability` (Socio-ecological baseline context: Census 2011 proxies)
  4. `Composite Risk` (Heuristic decision index: $\alpha=0.6, \beta=0.4$)
  5. `Health Impact` (Epidemiological outcomes: strictly disabled / future architecture)
- Keep official IMD district reference warnings segregated from HeatPulse localized advisories.

### R4. 6-Page Navigation Shell & Ward Detail Drawer
- Maintain seamless client-side navigation across all 6 pages:
  1. `/` (City Overview — Primary Screen with 3-block summary, Bhuvan map, 5-day outlook)
  2. `/india` (India Overview — National scale LOD 0 with 6 metro cards)
  3. `/forecast` (120-Hour Timeline Narrative with diurnal curves and expandable meteo params)
  4. `/risk-areas` (Ranked Risk Areas Table with search, sorting, and map focus sync)
  5. `/insights` (Descriptive Meteorological Insights explaining physical drivers)
  6. `/how-it-works` (Scientific Methodology, formulas, and non-claims)
- Maintain the 8-section right-side ward detail drawer preserving map visibility.

### R5. Deterministic Verification & Continuous Testing
- Execute automated regression test suites ensuring 100% pass rate across Tier 1 GIS and Tier 2 Data-Truth assertions.
- Maintain clean build (`npm run build`) and linting (`npm run lint`) with zero TypeScript errors.

## Acceptance Criteria

### GIS & Spatial
- [ ] Operational copy `bengaluru-gba-369-wards.geojson` and 5 companion city datasets render cleanly in OpenLayers.
- [ ] Bhuvan WMS is active as primary basemap with automated OSM network fallback.
- [ ] National LOD 0 overview hides ward polygons to prevent canvas lag.

### Biometeorology & Pipelines
- [ ] NOAA Rothfusz HI, BoM WBGT, and UTCI Proxy are mathematically accurate and dynamically bound.
- [ ] Weather forecasts are localized per ward centroid via server-side batching.
- [ ] Zero synthetic ML or fake clinical claims exist anywhere in the application.

### UI & User Journeys
- [ ] All 6 pages load and navigate cleanly with synchronized external store state.
- [ ] Right-side ward drawer slides in on polygon click with complete 8-section content hierarchy.
- [ ] Forecast freshness HUD accurately displays timestamps in Indian Standard Time (IST).

### Quality & Performance
- [ ] `node tests/run-all.mjs` passes 63/63 deterministic checks.
- [ ] `npm run build` compiles 16/16 routes cleanly with Turbopack.
- [ ] Zero TypeScript or linter errors.

## 2026-09-06T18:43:10Z

# Teamwork Project Prompt — HeatPulse Final Full Correction, GIS, Map, UI & Runtime QA

> Status: Launched
> Goal: Execute HeatPulse Master Correction, GIS Audit, Map Architecture, UI & Runtime QA
> Requested team: Full multi-agent teamwork system (Agent 1: Lead/Integration, Agent 2: GIS/National Map, Agent 3: OpenLayers/Bhuvan, Agent 4: Weather/Data Pipeline, Agent 5: Science/Data Truth, Agent 6: UI/UX, Agent 7: QA/Browser Verification)

Execute the comprehensive final correction, GIS dataset audit, spatial rendering, biometeorological integrity, and visual QA pass for **HeatPulse** — an India-focused extreme-heat early-warning and human thermal-stress decision-support platform for Smart India Hackathon 2026 (SIH26083: *Extreme Heatwave Early Warning and Human Thermal Stress Index* for Ministry of Earth Sciences / NCMRWF).

Working directory: `c:/Users/nilot/OneDrive/Desktop/SIH CLAUDE CODE/heatpulse`
Integrity mode: `development`

---

## Team Execution Architecture (7 Assigned Agents)

1. **AGENT 1 — LEAD / INTEGRATION**: Owns overall architecture, cross-agent integration, shared TypeScript interfaces, conflict resolution, and final acceptance.
2. **AGENT 2 — GIS / NATIONAL MAP**: Owns SimplyGIS archive inspection (`India_State_Boundary(www.simplygis.in).rar`, `India_Outline(www.simplygis.in).rar`), India boundary source audit, Kashmir/northern boundary verification, coordinate systems, national and city map extents.
3. **AGENT 3 — MAP / OPENLAYERS / BHUVAN**: Owns ISRO NRSC Bhuvan WMS integration, OSM network fallback detection, layer ordering, projection (EPSG:3857/4326), map initialization and resizing (`map.updateSize()`), and thematic vector layers.
4. **AGENT 4 — WEATHER / DATA PIPELINE**: Owns ward-centroid NWP localization, data flow, forecast run timestamps (run_time, fetched_at, valid_time), forecast source metadata, persistence status, and server cache.
5. **AGENT 5 — SCIENCE / DATA TRUTH**: Owns strict 5-concept scientific separation (Heat Conditions, Thermal Stress, Vulnerability, Composite Risk, Health Impact [Disabled]), NOAA Heat Index, BoM WBGT, UTCI Proxy designation, vulnerability provenance citations, and IMD district reference warning segregation.
6. **AGENT 6 — UI / UX**: Owns visual hierarchy (dominant map, compact summary cards), 6-page navigation shell, 8-section right-side ward detail drawer, typography, responsive layout (`max-w-[1600px]`), and forecast freshness HUD.
7. **AGENT 7 — QA / BROWSER AUDIT**: Owns runtime browser verification, network request inspection (Bhuvan vs OSM), Playwright screenshot capture (1600×960), interaction testing, regression test suite execution, and final acceptance matrix.

---

## Requirements

### R1. SimplyGIS National Boundary Audit & Kashmir Boundary Verification
- Locate and non-destructively inspect both local SimplyGIS archives:
  - `India_State_Boundary(www.simplygis.in).rar`
  - `India_Outline(www.simplygis.in).rar`
- Inspect `.shp`, `.shx`, `.dbf`, `.prj`, `.cpg`, CRS, feature count, bounding box, attributes, topology, and northern/Kashmir geometry representation.
- Compare SimplyGIS sources against the current GitHub-derived `india-states.geojson` and previous national geometry.
- Determine precisely which layer and dataset introduced any northern boundary change (Bhuvan basemap, OSM fallback, State GeoJSON, Outline GeoJSON, or vector styling).
- Select the authoritative national India geography dataset based on evidence without manual clipping, polygon deletion, or vertex altering.

### R2. Basemap Architecture & Bhuvan vs. OSM Runtime Verification
- Ensure ISRO NRSC Bhuvan WMS (`bhuvan-vec2.nrsc.gov.in/bhuvan/wms`, layer `lulc:BR_LULC50K_1112`) is the primary spatial basemap in OpenLayers.
- Ensure OSM is strictly a graceful network fallback only when Bhuvan tile requests fail.
- Inspect actual browser network traffic to confirm whether Bhuvan tile requests succeed and whether OSM is requested.
- Expose basemap status badge (`Basemap: ISRO Bhuvan WMS [Primary]` or `Basemap: OSM Fallback`) for transparent provenance.
- Enforce strict map layer stack:
  1. Base: ISRO Bhuvan WMS
  2. Thematic fill (transparent choropleth)
  3. Administrative boundaries (state / ward strokes)
  4. Selected ward / city highlight
  5. Interactive controls & popover tooltips

### R3. Data-Driven Thematic Coloring & Dynamic Layer Switching
- Thematic map fills must be strictly data-driven: $\text{Value} \to \text{Classification} \to \text{Color}$ with zero synthetic or random fills.
- **Heat Conditions Layer**: Classifies ambient dry-bulb temperature ($T_{\text{max}} < 32^\circ\text{C}$ Normal [Pale Blue], $32\text{--}40^\circ\text{C}$ Elevated [Amber], $41\text{--}53^\circ\text{C}$ High [Orange], $\ge 54^\circ\text{C}$ Extreme [Red]).
- **Thermal Stress Layer**: Classifies biometeorological WBGT ($\text{WBGT} < 28^\circ\text{C}$ Low [Green], $28\text{--}30^\circ\text{C}$ Moderate [Yellow], $30\text{--}32^\circ\text{C}$ High [Orange], $\ge 32^\circ\text{C}$ Severe [Red]).
- Layer toggling must dynamically switch metrics, classifications, polygon styles, and map legend.
- **Health Impact Layer**: Strictly disabled (`[Coming with validated health-outcome model]`) with zero synthetic clinical numbers.

### R4. Map Extent, Framing & Level of Detail (LOD)
- National India map (`/india`, LOD 0) must fit India's actual geometry extent with proper padding, avoiding excessive whitespace or ocean clipping.
- Monitored city markers (Bengaluru, Pune, Mumbai, Kolkata, Chennai, Coimbatore) must be clean and uncluttered, showing temperatures, ward counts, and thermal status on hover/click popovers.
- City Overview (`/`, LOD 1) must auto-fit to municipal ward polygons (Bengaluru 369, Pune 15, Mumbai 24, Kolkata 141, Chennai 200, Coimbatore 100) on city selection without viewport jitter.
- Map must occupy 65–75% of the primary analytical viewport.

### R5. Forecast Freshness, NWP Attribution & Scientific Honesty
- Remove all occurrences of "LIVE", "Live", or "Live / Fresh Run" for NWP forecast data.
- Standardize on `"Latest Forecast Run"` with explicit separation of `Forecast run: HH:MM IST`, `Last updated: HH:MM IST`, and `Valid: [Window] IST`.
- Verify ward localization across municipal centroids (confirming no broadcast cloning of single city-center values).
- Segregate HeatPulse thermal advisories from official IMD district reference warnings.
- Keep `devIndicators: false` to eliminate the Next.js floating red "1 Issue" dev overlay pill.

### R6. 6-Page Navigation & Responsive Layout Shell
- Maintain the 6-page navigation shell:
  1. `/` (City Overview — Map-dominant layout, 3-block summary, 5-day outlook, right-side ward detail drawer)
  2. `/india` (Pan-India Overview — National LOD 0 thermal choropleth + 6 metro cards)
  3. `/forecast` (120-Hour Timeline Narrative with interactive hour scrubber and expandable meteorological params)
  4. `/risk-areas` (Ranked Priority Risk Areas Table with multi-criteria scoring)
  5. `/insights` (Descriptive Meteorological Insights explaining physical drivers)
  6. `/how-it-works` (Scientific Methodology, formulas, active provider metadata, and explicit non-claims)
  - Layout containers must span `max-w-[1600px] mx-auto w-full px-4 sm:px-8` to eliminate excessive empty margins.

---

## Acceptance Criteria

### GIS & National Map Integrity
- [ ] SimplyGIS archives (`India_State_Boundary`, `India_Outline`) extracted, inspected, and compared against current `india-states.geojson`.
- [ ] Responsible layer and dataset for northern/Kashmir geometry representation precisely identified and documented.
- [ ] Authoritative India boundary dataset selected and integrated with verified RFC 7946 EPSG:4326 geometry.
- [ ] Pan-India map fits geometry cleanly with state boundaries, state thermal fills, readable labels, and 6 clean city markers.
- [ ] All 849 municipal wards across 6 cities (Bengaluru 369, Pune 15, Mumbai 24, Kolkata 141, Chennai 200, Coimbatore 100) render accurately.

### Basemap & OpenLayers Stack
- [ ] ISRO NRSC Bhuvan WMS is active as the primary basemap.
- [ ] OSM network fallback operates only upon upstream Bhuvan failure and is transparently badged.
- [ ] OpenLayers viewport initializes with non-zero dimensions and handles resize/route transitions cleanly.
- [ ] Thematic choropleth fills render above the basemap while preserving basemap context underneath.

### Data-Truth & Biometeorology
- [ ] NOAA Heat Index, BoM WBGT, and UTCI Proxy are mathematically accurate and dynamically bound.
- [ ] Switching between Heat Conditions and Thermal Stress dynamically updates polygon fills and legends.
- [ ] Weather forecasts are localized per ward centroid via server-side batching.
- [ ] Zero fake ML, synthetic mortality/hospitalization numbers, or fake IMD ward warnings exist.
- [ ] Official IMD district reference warnings remain strictly segregated from localized HeatPulse advisories.

### UI & User Experience
- [ ] No "1 Issue" floating Next.js dev overlay badge appears anywhere.
- [ ] No "Live / Fresh Run" misnomer appears; "Latest Forecast Run" used consistently.
- [ ] City Overview map dominates 65–75% of the viewport.
- [ ] Right-side ward detail drawer slides in smoothly on polygon click with complete 8-section content hierarchy.
- [ ] All 6 pages render cleanly at 1600×960 with full-width container utilization.

### QA & Verification
- [ ] Automated GIS test suite passes 100% (62/62 checks).
- [ ] Linter (`npm run lint`) passes with 0 errors and 0 warnings.
- [ ] Playwright screenshot captures at 1600×960 visually confirm all 6 platform views.

## 2026-09-07T05:33:46Z

# Teamwork Project Prompt — HeatPulse Final Map, GIS Visualization & Labeling Pass

> Status: Launched
> Goal: Execute Final Cartographic, Labeling, State Semantics & Map Framing Polish
> Requested team: Full multi-agent teamwork system (Agent 1: Lead/Integration, Agent 2: GIS/National Map, Agent 3: OpenLayers/Bhuvan, Agent 4: Weather/Data Pipeline, Agent 5: Science/Data Truth, Agent 6: UI/UX, Agent 7: QA/Browser Verification)

Execute the final cartographic refinement, intelligent ward labeling, state-vs-ward semantics documentation, Bhuvan basemap contrast tuning, and viewport framing pass for **HeatPulse** — an India-focused extreme-heat early-warning and human thermal-stress decision-support platform for Smart India Hackathon 2026 (SIH26083: *Extreme Heatwave Early Warning and Human Thermal Stress Index* for Ministry of Earth Sciences / NCMRWF).

Working directory: `c:/Users/nilot/OneDrive/Desktop/SIH CLAUDE CODE/heatpulse`
Integrity mode: `development`

---

## Key Diagnostic Findings

1. **Bihar Visual Appearance Diagnosis**:
   - The green appearance of Bihar in the national Thermal Stress view is **the underlying ISRO Bhuvan LULC (Land Use / Land Cover 1:50,000) raster layer** showing agricultural cropland through a transparent baseline.
   - West Bengal has a monitored metropolitan center (Kolkata, $\text{WBGT} \approx 33.2^\circ\text{C}$ Severe), rendering an active red/brown thermal choropleth overlay over Bhuvan.
   - Bihar currently has no monitored metropolitan center in the 6-metro telemetry feed, so no regional thermal choropleth was applied.
2. **National Overview vs. Ward-Localized NWP Semantics**:
   - India Overview displays macro-regional state context derived from monitored metropolitan hubs.
   - City Overview displays ward-localized numerical weather prediction (NWP) sampled per municipal centroid.
   - This distinction must be explicitly documented and communicated in the UI.

---

## Requirements

### R1. State Thematic Mapping & Data-to-Color Traceability
- Ensure state choropleths on `/india` are fully explainable: $\text{Value} \to \text{Classification} \to \text{Color}$.
- Document state vs ward NWP resolution semantics in the national overview.
- For states with monitored metros (Karnataka, Maharashtra, West Bengal, Tamil Nadu), apply data-driven regional choropleths.
- For unmonitored states, apply a consistent neutral/subtle basemap presentation that harmonizes with Bhuvan LULC context without creating false thermal anomaly impressions.

### R2. Intelligent Multi-Scale Ward Labeling
- Implement multi-scale OpenLayers vector text styling:
  - **City Scale (LOD 1, zoom 8–12)**: Render clean ward polygon boundaries with minimal/no permanent text clutter to maintain readability across 369 wards.
  - **Deep City Zoom (LOD 2, zoom 13+)**: Render compact ward identifiers (e.g. `142 · Rajajinagara`).
  - **Hover Tooltip**: Instant popover displaying Ward Number, Ward Name, Active Metric (Temperature / WBGT / Heat Index), and Thermal Stress Category.
  - **Click Selection**: Prominent boundary highlight stroke and slide-in of the 8-section Ward Detail Drawer.

### R3. Viewport-Dominant Map Framing & Geometry Extent Fitting
- **India Map (`/india`)**: Auto-fit to the full Survey of India bounding box with balanced padding (top/bottom/sides) so India commands 70%+ of the viewport without excessive ocean or whitespace.
- **City Maps (`/`)**: Auto-fit precisely to the operational boundary extent of each selected city (Bengaluru 369, Pune 15, Mumbai 24, Kolkata 141, Chennai 200, Coimbatore 100) with 20px padding so ward polygons fill the analytical canvas.
- Ensure the map is the hero component on City Overview, occupying 65–75% of the primary analytical area.

### R4. Refined Bhuvan Basemap Presentation & Clean Attribution
- Preserve ISRO NRSC Bhuvan WMS as the primary basemap without altering or obscuring embedded watermarks.
- Adjust thematic vector fill opacity ($\sim 0.45\text{--}0.55$) and stroke contrast so HeatPulse analytical signals pop cleanly over Bhuvan LULC terrain.
- Eliminate redundant repetitions of the word "Bhuvan" in UI badges; maintain a single, compact, professional attribution bar (`Basemap: ISRO NRSC Bhuvan WMS`).

### R5. Interactive City Markers & Layer Switcher Synchronization
- National city markers (6 cities) must feature compact, elegant pin styling with interactive hover/click tooltips showing city name, current temperature, WBGT, ward count, and quick jump action.
- Ensure switching between `Heat Conditions` ($T_{\text{max}}$) and `Thermal Stress` (WBGT) dynamically updates polygon styling, state fills, and legend keys across both national and city views.

---

## Acceptance Criteria

### Cartography & Labeling
- [ ] National India map fills 70%+ of the viewport with balanced Survey of India extent.
- [ ] City maps auto-fit to ward extents on city selection without clipping or excessive margins.
- [ ] Deep zoom (zoom 13+) renders compact ward labels (`142 · Rajajinagara`).
- [ ] Hover tooltips display Ward #, Ward Name, Metric, and Category cleanly.
- [ ] Selected ward displays clear highlight boundary stroke.

### Data Truth & Thematic Semantics
- [ ] State and ward color binding is 100% data-driven: $\text{Value} \to \text{Category} \to \text{Color}$.
- [ ] Switching between Heat Conditions and Thermal Stress dynamically updates colors and legends.
- [ ] State vs. Ward NWP resolution semantics are transparently documented on `/india` and `/how-it-works`.
- [ ] No "1 Issue" floating dev overlay badge.
- [ ] No "Live / Fresh Run" misnomers (standardized on "Latest Forecast Run").

### Basemap & Provenance
- [ ] ISRO NRSC Bhuvan WMS is active as the primary basemap.
- [ ] Redundant UI mentions of "Bhuvan" eliminated in favor of a single compact attribution element.
- [ ] Thematic choropleths maintain high visual contrast over Bhuvan terrain.

### QA & Verification
- [ ] Automated GIS test suite passes 100% (62/62 checks).
- [ ] ESLint passes with 0 errors and 0 warnings.
- [ ] Playwright screenshots captured at 1600×960 and 1920×1080 visually confirm all improvements.

## 2026-09-07T09:24:36Z

# Teamwork Project Prompt — State Tooltip Synchronization & Pan-India Basemap Consistency

> Status: Launched
> Goal: Resolve State Tooltip Mismatch on India Overview & Standardize Pan-India Basemap Rendering
> Requested team: Full multi-agent teamwork system (GIS Specialist, Map/OpenLayers Engineer, Frontend/UX Specialist, QA/Browser Auditor)

Fix the state polygon hover tooltip synchronization on the Pan-India map (LOD 0) and resolve the isolated raster artifact where Bihar rendered textured satellite Land Use Land Cover (LULC) data while surrounding states rendered clean backgrounds.

Working directory: `c:/Users/nilot/OneDrive/Desktop/SIH CLAUDE CODE/heatpulse`
Integrity mode: `development`

---

## Technical Root Cause Analysis

1. **State Tooltip vs. Polygon Styling Contradiction**:
   - On the India Overview map (`/india`), state polygons (e.g., Maharashtra, West Bengal) dynamically receive choropleth fills derived from `stateMetrics` (e.g., Maharashtra colored Burgundy/Severe based on peak telemetry).
   - However, when the mouse hovers over a state polygon, `MapContainer.tsx` attempted to look up the state in `wardRiskMap` (which only contains municipal ward risks, not state telemetry).
   - Failing the lookup, the tooltip defaulted to `category = 'Low'` (with a green badge) and `metricValue = '--'`. This produced a direct visual contradiction: a Burgundy/Severe polygon displaying a Green "Low" tooltip.

2. **Bihar Isolated LULC Raster Artifact**:
   - The default Bhuvan WMS layer was set to `lulc:BR_LULC50K_1112`, where `BR` is ISRO's state code for **Bihar**.
   - As a result, ISRO NRSC Bhuvan WMS only served raster tiles within Bihar's boundaries (displaying 1:50,000 agricultural cropland, rivers, and terrain features), while returning completely empty/transparent tiles for all other 35 states and UTs in India.
   - This caused Bihar to appear abnormally textured and green/yellow compared to all surrounding states (Jharkhand, UP, West Bengal).
   - **ISRO Bhuvan WMS GetCapabilities Audit**: Verified that true Pan-India layers exist on `bhuvan-vec2.nrsc.gov.in` (such as `sisdp_base:sisdp_basemap` for the national basemap or `sisdp_phase2:lulc_phase2_india` / `sisdp_v2_india_lulc:sisdp_v2_india_lulc` for pan-India LULC), while state-specific layers exist per state (`_KA`, `_MH`, `_WB`, `_TN`, `_GJ`, `_UP`).

---

## Requirements

### R1. State Hover Popover & Telemetry Synchronization
- Update `MapContainer.tsx` pointermove handling so that hovering over state polygons on the National Overview (LOD 0) looks up `stateMetrics` directly.
- Display the actual state name, monitored peak metric value (e.g., `Peak WBGT: 28.5°C` or `Peak Temp: 34.0°C`), active classification category, and matching badge color (`bg-rose-100` / `text-rose-900` for Severe, `bg-orange-100` for High, `bg-yellow-100` for Moderate, `bg-emerald-50` for Low, or `bg-slate-100` for Unmonitored).
- For unmonitored states, display a clean `"Regional Baseline / Unmonitored"` badge without false `"Low"` or misleading numbers.

### R2. Pan-India Basemap & Raster Consistency
- Eliminate the single-state `lulc:BR_LULC50K_1112` layer restriction from the national basemap configuration.
- Implement a consistent Pan-India basemap treatment (such as `sisdp_base:sisdp_basemap` or `sisdp_phase2:lulc_phase2_india` / `sisdp_v2_india_lulc:sisdp_v2_india_lulc` or seamless city/state LULC mapping per active region) so that all 36 states and UTs share a uniform, clean cartographic background without isolated single-state raster artifacts.
- Ensure ISRO Bhuvan WMS remains active with graceful OSM fallback, preserving high contrast for thematic choropleth layers.

### R3. Automated Regression & Visual Verification
- Ensure the full test suite (`node tests/run-all.mjs`, 77+ assertions) continues to pass 100%.
- Capture high-resolution Playwright screenshots at 1600×960 and 1920×1080 of the Pan-India map, state hover tooltips (Maharashtra, West Bengal, Karnataka, Bihar), and city views.
- Confirm zero ESLint errors and clean Turbopack production compilation.

---

## Acceptance Criteria

### Tooltip & Map Synchronization
- [ ] Hovering over Maharashtra in Thermal Stress view displays matching category (Severe/High) and actual peak WBGT metric, matching the polygon fill color.
- [ ] Hovering over unmonitored states (e.g., Bihar, UP, MP) displays `"Unmonitored State"` or `"Regional Baseline"` with neutral styling instead of false `"Low"` or `--`.
- [ ] Hovering over national city markers continues to show city name, temperature, WBGT, and ward count.

### Cartography & Basemap Integrity
- [ ] Bihar renders uniformly with consistent cartographic styling, with zero isolated single-state raster bleed-through.
- [ ] ISRO Bhuvan WMS / Basemap is active with transparent status indicator.
- [ ] Thematic layer switching ($T_{\max} \leftrightarrow \text{WBGT}$) updates polygon colors, legends, and hover popovers consistently.

### Testing & QA
- [ ] `node tests/run-all.mjs` passes 100% of deterministic checks.
- [ ] `npm run lint` passes with 0 errors and 0 warnings.
- [ ] `npm run build` compiles cleanly with zero errors.
- [ ] Playwright screenshots verify fixed state tooltips and clean national map appearance.

## 2026-09-07T11:16:51Z

# Teamwork Project Prompt — Full Pan-India 36-State Telemetry & Complete GIS Choropleth Coverage

> Status: Launched
> Goal: Enable live biometeorological telemetry & data-driven choropleths across all 36 Indian States & UTs
> Requested team: Full multi-agent teamwork system (GIS Specialist, Weather Pipeline Engineer, Frontend/UX Specialist, QA/Browser Auditor)

Expand HeatPulse's national surveillance pipeline to calculate and render live, data-driven thermal and heat condition metrics for all 36 Indian States & Union Territories, eliminating all blank/white unmonitored masks and providing complete national GIS choropleth coverage with live state hover popovers.

Working directory: `c:/Users/nilot/OneDrive/Desktop/SIH CLAUDE CODE/heatpulse`
Integrity mode: `development`

---

## Technical Overview

Currently, `stateMetrics` on `/india` only populates values for the 4 states containing our 6 pilot municipal cities (Karnataka, Maharashtra, West Bengal, Tamil Nadu). The remaining 32 states and Union Territories receive an unmonitored fallback mask (`rgba(241, 245, 249, 0.72)`), which causes 90% of the national map to look blank/white during presentations.

Because `india-states.geojson` already contains the complete official Survey of India boundaries for all 36 States & UTs, we will wire a comprehensive national telemetry feed that samples Open-Meteo NWP forecasts for all 36 state capitals/centroids. Every state will be dynamically colored based on its real atmospheric and biometeorological data.

---

## Requirements

### R1. Pan-India 36-State Centroid Telemetry Pipeline
- Define canonical geographical coordinates (capital or geographic centroid) for all 36 Indian States & Union Territories in `src/lib/gis.ts` / `src/types/gis.ts`.
- Integrate server-side batched NWP queries and persistent caching for state-level telemetry in `weather-service.ts` / `weather-cache.ts` / `/api/weather` or a dedicated national summary endpoint.
- Compute dry-bulb temperature, relative humidity, NOAA Rothfusz Heat Index, BoM simplified outdoor WBGT, and UTCI Proxy for each state.

### R2. 100% Pan-India GIS Choropleth Coverage (Zero White Masks)
- Populate `stateMetrics` for all 36 States & UTs in `src/app/india/page.tsx` and pass them to `MapContainer.tsx`.
- **In Heat Conditions Layer**: Classify each state by dry-bulb temperature ($T_{\max} < 32^\circ\text{C}$ Normal [Pale Blue], $32\text{--}40^\circ\text{C}$ Elevated [Amber], $41\text{--}53^\circ\text{C}$ High [Orange], $\ge 54^\circ\text{C}$ Extreme [Red]).
- **In Thermal Stress Layer**: Classify each state by WBGT ($< 28^\circ\text{C}$ Low [Green], $28\text{--}30^\circ\text{C}$ Moderate [Yellow], $30\text{--}32^\circ\text{C}$ High [Orange], $\ge 32^\circ\text{C}$ Severe [Burgundy]).
- Ensure the entire national landmass from Ladakh to Kerala and Gujarat to Arunachal Pradesh is 100% covered with data-driven GIS choropleth fills with zero blank/white unmonitored masks.

### R3. Universal State Hover Popovers
- Ensure hovering over ANY state in India (e.g., Odisha, Rajasthan, Bihar, Uttar Pradesh, Gujarat, Ladakh, Assam, Kerala) displays its actual state name, real temperature, peak WBGT, and active classification category with matching badge color.

### R4. Automated Testing & Browser Verification
- Extend deterministic test suite (`node tests/run-all.mjs`) to verify 36-state telemetry completeness (85+ checks passing).
- Ensure ESLint passes with 0 errors and 0 warnings.
- Ensure Turbopack production build compiles cleanly.
- Capture high-resolution Playwright screenshots of the fully-colored national map in both Heat Conditions and Thermal Stress layers.

---

## Acceptance Criteria

### National Telemetry & Coverage
- [ ] Every one of the 36 Indian States & UTs has valid, non-null temperature, WBGT, and Heat Index telemetry.
- [ ] In Heat Conditions, all 36 states display active data-driven color fills (zero pale white masks).
- [ ] In Thermal Stress, all 36 states display active data-driven color fills (zero pale white masks).
- [ ] Hovering over any state in India (e.g., Odisha, Bihar, UP, Rajasthan) displays its live metrics and category badge.

### Layer Switching & Basemap Compatibility
- [ ] Switching between Heat Conditions and Thermal Stress dynamically updates all 36 state polygons and legend keys.
- [ ] Street View, Satellite, and ISRO Bhuvan basemap modes render underneath the full national choropleth cleanly.

### Quality & Performance
- [ ] `node tests/run-all.mjs` passes 100% of checks.
- [ ] `npm run lint` passes with 0 errors and 0 warnings.
- [ ] `npm run build` compiles cleanly.
- [ ] Playwright screenshots verify vibrant 100% national coverage.


## 2026-09-09T17:33:47Z

# Teamwork Project Prompt — HeatPulse Adversarial Evidence-Verification Pass & Forensic Codebase Audit

> Status: Launched  
> Goal: Conduct an uncompromising, code-level adversarial evidence audit of HeatPulse across the 5 disputed areas (ML Classifier, Health Layer, 480 Non-Bengaluru Wards GIS Provenance, NWP Weather Batching/Centroid Pipeline, and SIH Presentation Defense Guardrails) with line-by-line code proof and strict scientific factuality.  
> Requested team: Full multi-agent teamwork system (Lead Auditor, ML & Statistics Auditor, GIS & Spatial Data Auditor, Biometeorology & Weather Pipeline Auditor, SIH Presentation & Compliance Auditor)

Execute a rigorous, adversarial, evidence-backed forensic verification of **HeatPulse** — an India-focused extreme-heat early-warning and human thermal-stress decision-support platform for Smart India Hackathon 2026 (SIH26083: *Extreme Heatwave Early Warning and Human Thermal Stress Index* for Ministry of Earth Sciences / NCMRWF).

Working directory: `c:/Users/nilot/OneDrive/Desktop/SIH CLAUDE CODE/heatpulse`  
Integrity mode: `strict-verification / zero-assumptions audit`

---

## Background & Objective

The preliminary forensic audit established the baseline architecture of HeatPulse (Next.js 16, OpenLayers, 849 wards across 6 cities, NOAA Heat Index, BoM WBGT, UTCI Proxy). However, several critical claims must **not be accepted on faith** and require adversarial verification before being presented to Ministry of Earth Sciences (MoES) and NCMRWF judges:
1. The true nature, mathematical basis, and training provenance of the ML heatwave classifier (`/api/heatwave`).
2. The exact formulation and actual ingested data of the health impact layer (Relative Risk vs. clinical mortality claims).
3. The genuine GIS provenance of the 480 non-Bengaluru wards (Pune 15, Mumbai 24, Kolkata 141, Chennai 200, Coimbatore 100).
4. The exact server-side weather batching, centroid downscaling, and cache behavior.
5. A critical stress-test of the "no RED issues" conclusion to eliminate false confidence and equip the team with bulletproof pitch guardrails.

---

## Assigned Workstreams & Audit Mandates

### Workstream 1: ML Heatwave Classifier Provenance & Operational Reality
- **Files to Inspect:** `data/training/portable-heatwave-model.json`, `data/training/kaggle-rajasthan-heatwave/`, `src/app/api/heatwave/route.ts`, `src/app/api/heatwave-forecast/route.ts`, `src/lib/heatwave-ml.ts`.
- **Mandates:**
  - Dissect the exact mathematical model: weights, intercept, feature scaling, sigmoid activation function, and decision thresholds.
  - Audit the training source: trace the Kaggle Rajasthan dataset (features: $T_{\max}$, $T_{\min}$, $RH$, wind, pressure).
  - Prove conclusively whether this is a synoptic-scale atmospheric heatwave pattern detector or a localized ward-level deep learning predictor.
  - Determine whether the model was trained on localized municipal ward microclimates or regional meteorological stations.
  - Provide strict guardrails for SIH judges: how to pitch this accurately (e.g. *"Logistic regression pattern-recognition model for synoptic heatwave classification trained on historical Indian meteorological anomalies"*) without overclaiming AI capabilities.

### Workstream 2: Health Layer & Epidemiological Evidence Audit
- **Files to Inspect:** `src/lib/map-config.ts`, `src/lib/hybrid-health-model.ts`, `src/lib/advisory-engine.ts`, `src/app/api/advisory/route.ts`, `src/app/how-it-works/page.tsx`.
- **Mandates:**
  - Audit the Relative Risk ($RR$) and Excess Risk formulation: verify the mathematical equation ($RR = 1.0 + \text{excess } WBGT \times 0.12 + \text{vuln} \times 0.15$).
  - Confirm whether ANY real-time or historical mortality/hospitalization data is ingested at runtime, or whether it is purely a biometeorological hazard proxy derived from literature.
  - Verify UI compliance: ensure the Health Impact layer is explicitly marked as `[Coming with validated health-outcome model]` and contains zero synthetic mortality figures.
  - Establish the exact defense argument for SIH: why presenting relative vulnerability grading is scientifically valid, whereas claiming predicted mortality without hospital data would fail scrutiny.

### Workstream 3: GIS Dataset Provenance for All 849 Wards
- **Files to Inspect:** `public/data/processed/geojson/*.geojson`, `scripts/verify-gis.mjs`, `data/raw/`, root zip/rar archives (`Bengaluru_MC(www.simplygis.in).zip`, `Chennai_MNC(www.simplygis.in).zip`, `Coimbatore_MC(www.simplygis.in).zip`, `Kolkata_MC(www.simplygis.in).zip`, `Mumbai_MC.zip`).
- **Mandates:**
  - Establish the exact source hierarchy for each city:
    - **Bengaluru (369 wards):** Normalized from Greater Bengaluru Authority (GBA) delimitation GeoJSON (`wards_bengaluru_gba.geojson`).
    - **Pune (15 wards):** Administrative Kshetriya Karyalayas from DataMeet / PMC.
    - **Mumbai (24 wards):** BMC Administrative Wards from SimplyGIS / DataMeet.
    - **Kolkata (141 wards):** Kolkata Municipal Corporation wards from SimplyGIS / AMRUT West Bengal.
    - **Chennai (200 wards):** Greater Chennai Corporation wards from SimplyGIS.
    - **Coimbatore (100 wards):** Coimbatore City Municipal Corporation wards (5 zones × 20 wards) from SimplyGIS.
  - Verify that no dataset is falsely attributed to Survey of India if it originated from municipal open data or SimplyGIS extractions.

### Workstream 4: Weather Pipeline, Centroid Sampling & Server Batching Trace
- **Files to Inspect:** `src/lib/weather-service.ts`, `src/lib/weather-cache.ts`, `src/lib/open-meteo.ts`, `src/app/api/weather/route.ts`, `src/app/api/states/route.ts`.
- **Mandates:**
  - Trace the centroid coordinates for all 849 wards: confirm they are distinct geographic points and not cloned city centers.
  - Audit the chunking and rate-limiting strategy: how Open-Meteo multi-coordinate requests are batched (e.g. 50 locations per request) to prevent HTTP 429 errors.
  - Verify the caching lifecycle: in-memory `WeatherCache`, 15-minute TTL, and fallback handling when Open-Meteo is unreachable.
  - Audit forecast run timestamp segregation: `FORECAST_RUN_TIME` (model initialization) vs `FORECAST_VALID_TIME` (forecast target hour).

### Workstream 5: Forensic Red-Issue Elimination & SIH Pitch Defense Matrix
- **Mandates:**
  - Conduct an adversarial review of the codebase to identify every subtle vulnerability, limitation, or potential judge objection.
  - Produce the **Authoritative SIH26083 Defense Matrix**:
    - **Physical Truth:** Downscaled NWP biometeorology (Rothfusz HI, BoM WBGT, UTCI Proxy).
    - **Spatial Truth:** 849 verified administrative wards with Bhuvan WMS integration.
    - **ML Truth:** Lightweight logistic pattern classifier for synoptic heatwaves, clearly bounded.
    - **Health Truth:** Relative biometeorological hazard grading, avoiding fake mortality claims.
    - **Operational Truth:** Automated municipal triggers and public advisories.

---

## Deliverables & Acceptance Criteria

1. **Adversarial Evidence Audit Report:** A comprehensive markdown report citing exact file paths, line numbers, mathematical proofs, and data origins for all 5 workstreams.
2. **SIH26083 Pitch Guardrails & Defense FAQ:** A concise guide detailing exactly how to explain the architecture to MoES/NCMRWF evaluators without overclaiming or exposing vulnerabilities.
3. **Zero Code Regressions:** Maintain 100% pass rate across deterministic tests (`node scripts/verify-gis.mjs`, `node tests/run-all.mjs`) and clean build (`npm run build`).


## 2026-09-09T18:23:07Z

# Teamwork Project Prompt — HeatPulse Master Implementation & Correction (SIH26083)

> Status: Launched
> Goal: Transform HeatPulse into a technically defensible, scientifically transparent, highly usable municipal heat-health early-warning platform across 66 implementation phases.
> Requested team: Full multi-agent teamwork system (Architect, GIS Specialist, Weather Pipeline Engineer, Thermal/Biometeorology Specialist, Frontend/UX Engineer, QA/Data-Truth Auditor)

PROJECT: HEATPULSE
PROBLEM STATEMENT: SIH26083 — Extreme Heatwave Early Warning and Human Thermal Stress Index
ORGANIZATION: Ministry of Earth Sciences / NCMRWF

Working directory: `c:/Users/nilot/OneDrive/Desktop/SIH CLAUDE CODE/heatpulse`
Integrity mode: development

---

## MISSION

Transform the CURRENT HeatPulse implementation into a technically defensible, scientifically transparent, highly usable municipal heat-health early-warning platform.

THIS IS A MAJOR IMPLEMENTATION + CORRECTION TASK.

You MUST first inspect the CURRENT repository and CURRENT runtime behavior.

Do not assume the previous audit is correct.
Do not assume every current feature is correctly wired.
Do not blindly preserve current behavior.

The objective is:

1. Fix incorrect timing semantics.
2. Fix slow ward/weather/risk synchronization.
3. Make current-vs-forecast distinction unmistakable.
4. Make the forecast experience substantially better.
5. Introduce an explicit forecast simulation workflow.
6. Build a proper Forecast / Heatwave Prediction UX.
7. Make Health Impact understandable and scientifically honest.
8. Make vulnerability-data provenance visible.
9. Improve GIS interaction and fullscreen behavior.
10. Make map layers and colors semantically correct.
11. Make every visible number traceable to a real source/calculation.
12. Make the application feel like a serious scientific civic decision-support system rather than a generic dashboard.

---

## ABSOLUTE NON-NEGOTIABLE RULES

### RULE 1 — ZERO FABRICATION

Never create fake:
- mortality values
- hospitalization counts
- heatstroke admissions
- ward observations
- IoT readings
- clinical model accuracy
- epidemiological coefficients
- demographic percentages
- official IMD ward warnings
- satellite-derived values unless actually present
- ML performance claims
- historical values that do not exist

### RULE 2 — NEVER CONFUSE CURRENT CONDITIONS WITH FORECASTS

Every thermal/weather number must have an explicit temporal meaning.

Possible states: CURRENT | FORECAST | FORECAST PEAK | FORECAST WINDOW | HISTORICAL REFERENCE | MODEL OUTPUT

Never show a forecast maximum without clearly labeling it as forecast maximum.

### RULE 3 — NEVER HIDE TIME

Every forecast-driven visualization must have:
- Forecast run: YYYY-MM-DD HH:MM IST
- Fetched: YYYY-MM-DD HH:MM IST
- Valid time: YYYY-MM-DD HH:MM IST

For current conditions: Observed / Model-valid timestamp must be clearly stated.

### RULE 4 — NEVER CALL NWP DATA "LIVE OBSERVATION"

Open-Meteo / NWP-derived data is forecast/model data. Use: "Ward-centroid NWP forecast", "Forecast-derived thermal conditions", "Model-derived temperature", "Forecast-valid thermal stress". Do NOT use "live sensor reading", "real-time IoT", "measured at ward" unless actual sensor data exists.

### RULE 5 — NEVER CALL THE CURRENT HEALTH LAYER A CLINICAL PREDICTION MODEL

If the active health system is the current Relative Risk / hazard estimator, label it clearly as: "Relative Risk Estimate", "Biometeorological Health Burden", "Hazard / Burden Indicator". Do not call it "predicted deaths", "predicted admissions", "clinical forecast" unless a validated health-outcome model actually exists.

### RULE 6 — UTCI PROXY MUST REMAIN A PROXY

If the implementation uses apparent temperature rather than complete UTCI physics, display "UTCI Proxy" not "UTCI".

### RULE 7 — DISTRICT IMD WARNING MUST REMAIN SEPARATE

IMD district bulletin = OFFICIAL EXTERNAL REFERENCE. HeatPulse ward analysis = LOCALIZED MODEL-DERIVED THERMAL / RISK OUTPUT. Never combine them into one warning source.

### RULE 8 — LOCAL GIS MUST LOAD INDEPENDENTLY OF WEATHER

Ward geometry must NOT wait for: Open-Meteo, thermal calculations, risk calculations, forecast API, ML API, advisory generation. The user must see the map and ward boundaries immediately. Then metrics populate asynchronously.

### RULE 9 — DO NOT BLOCK THE ENTIRE PAGE ON ONE SLOW REQUEST

PAGE LOAD ORDER: 1. Shell → 2. Map container → 3. Local ward geometry → 4. City labels/controls → 5. Forecast timestamp shell → 6. Weather data → 7. Thermal metrics → 8. Vulnerability → 9. Composite risk → 10. Advisories → 11. ML forecast output

---

## REQUIREMENTS

### R0. PHASE 0 — READ CURRENT SYSTEM BEFORE CHANGING IT

Inspect the CURRENT project. Do not rely only on previous audit reports. Trace:
- every page, every map component, every weather API, every risk API
- every thermal calculation, every forecast component, every synchronization mechanism
- every cache, every model, every vulnerability source, every health layer
- every GIS source, every loading state

Identify EXACTLY: WHERE is each feature implemented? WHY is it implemented there? WHAT data does it consume? WHEN does it run? WHAT causes it to rerender? WHAT causes the map to recolor? WHAT causes a ward to become "Severe"? WHAT timestamp is used? WHAT causes synchronization delays?

Do not make changes until this dependency chain is understood.

### R1. PHASE 1 — FIX CURRENT TIME VS FORECAST TIME

Determine EXACTLY why the UI shows severe thermal colors at night. Trace: current clock → forecast run → forecast-valid timestamp → selected forecast index → daily aggregation → thermal metric → classification → map color.

Find whether the map is currently using: current-hour WBGT, current-hour HI, daily maximum WBGT, daily maximum HI, maximum across 120h forecast, selected timeline hour, latest API record, stale cached record, or some combination. DO NOT GUESS.

THE CITY PAGE MUST HAVE TWO DISTINCT STATES:

CURRENT CONDITIONS (23:35 IST): Air Temperature, Relative Humidity, WBGT, Thermal Stress — all from current valid hour.

FORECAST PEAK (NEXT 120 HOURS): Peak WBGT, Peak Date, Peak Time, Peak Ward Count, Thermal Stress — clearly labeled as forecast.

Never mix these two concepts into one number.

### R2. PHASE 2 — BUILD A REAL TIME-CONTROL MODEL

Create one central forecast-time state:
```
forecastContext = {
  forecastRunTime, fetchedAt, currentValidTime, selectedValidTime,
  horizonStart, horizonEnd, mode  // CURRENT | FORECAST | PEAK
}
```
All pages must consume this shared temporal context. Do NOT allow individual components to independently decide which hour to display.

### R3. PHASE 3 — MAP SYNCHRONIZATION REWRITE

Current problem: Ward boundaries + coloring appear to synchronize slowly. THIS MUST BE RE-ARCHITECTED.

MAP INITIALIZATION MUST BE INDEPENDENT:
1. Immediately load local GeoJSON.
2. Render ward outlines.
3. Render default neutral fills.
4. Initialize map interaction.
5. Fetch weather/risk asynchronously.
6. Merge risk metrics into existing features.
7. Apply thematic colors.

The geometry itself should NEVER need to be refetched from the weather API. Do NOT recreate OpenLayers vector source unnecessarily. Do NOT recreate all features on every weather refresh. Do NOT destroy and recreate the map when metrics arrive. Use stable Feature IDs. Use a metric lookup map: wardId → metrics. Then update only the style/data properties required.

### R4. PHASE 4 — ELIMINATE SYNC BUTTON CONFUSION

Replace generic "SYNC" with "REFRESH FORECAST" or "UPDATE FORECAST". The button must NOT reload GIS geometry. Responsibility: fetch latest forecast, update timestamp, update metrics, update thermal calculations, update map values. Show state: "Updating forecast…" not "Syncing…". After completion: "Forecast updated 23:42 IST". If unavailable: "Forecast unavailable. Last successful forecast: 23:25 IST." Do NOT fabricate fallback values.

### R5. PHASE 5 — WEATHER CACHE ARCHITECTURE

Inspect current cache. Determine: memory cache, filesystem cache, TTL, cache key, city key, forecast-run key, valid-time key, stale behavior, concurrent request behavior.

Implement request deduplication. If 3 UI components request /api/weather?city=kolkata they must NOT trigger 3 separate provider calls. Use one shared request / cached result.

Prefer: ONE weather dataset → thermal derivation → risk derivation → UI

### R6. PHASE 6 — WARD DATA UPDATE ARCHITECTURE

Create an explicit architecture:

STATIC SPATIAL DATA (Ward geometry, ID, name, centroid, boundary): LOAD LOCAL / IMMEDIATE

DYNAMIC DATA (Temperature, RH, Wind, Radiation, HI, WBGT, UTCI Proxy, Risk, Alert): LOAD ASYNC / FORECAST API

STATIC VULNERABILITY DATA (Green space, Building density, Outdoor workers, Elderly population, Informal settlement indicators): LOAD LOCAL DATASET / BASELINE REGISTRY

Do NOT fetch static vulnerability repeatedly from the provider.

### R7. PHASE 7 — WEATHER → THERMAL → RISK PIPELINE

Create one clearly documented computational flow: WARD → CENTROID → NWP DATA → NORMALIZATION → THERMAL ENGINE → VULNERABILITY → COMPOSITE RISK → CLASSIFICATION → ADVISORY

For every ward-hour preserve: ward_id, valid_time, forecast_run, temperature, relative_humidity, wind_speed, radiation, heat_index, wbgt, utci_proxy, vulnerability_score, thermal_score, composite_risk, alert_level.

### R8. PHASE 8 — MAP LAYER SEMANTICS

Layer switcher: HEAT CONDITIONS | THERMAL STRESS | HEALTH IMPACT

HEAT CONDITIONS: Metric = Temperature. Legend must correspond EXACTLY to implemented thresholds.

THERMAL STRESS: Metric = WBGT / Heat Index. Legend must correspond EXACTLY to implemented thresholds.

HEALTH IMPACT: If current RR estimator is retained, label as "RELATIVE RISK". Subtitle: "Biometeorological estimate — not clinical outcome prediction". Do not show mortality colors without actual mortality model.

### R9. PHASE 9 — FIX THE CURRENT RED MAP PROBLEM

Pick 10 wards in Kolkata. For each record: Current time, Selected map time, Temperature, RH, WBGT, HI, Classification, Map color. Then compare map value against card value.

INVARIANT: MAP VALUE == API VALUE == DRAWER VALUE == SELECTED-TIME VALUE, unless explicitly showing a named aggregation like "DAILY MAX" or "5-DAY PEAK".

### R10. PHASES 10–18 — WARD INTERACTION, FULLSCREEN, MAP VISUAL DESIGN, COLOR SYSTEM, CITY HEADER, CITY SUMMARY, HEALTH IMPACT UX, VULNERABILITY PROVENANCE, VULNERABILITY PANEL

WARD HOVER: Ward name, Ward ID, Selected metric, Valid time. ON CLICK: Open Ward Detail Drawer with 8 sections (Ward identity, Current conditions, Forecast peak, Thermal stress, Vulnerability, Risk, Health burden/RR, Recommended action). Use compact typography — not 8 giant stacked cards.

FULLSCREEN MAP: Add real fullscreen control (top-right). Fullscreen = map fills entire viewport. Controls remain accessible. Add EXIT FULLSCREEN. Keyboard Esc exits. Ensure: map resizes correctly, OpenLayers viewport recalculates, popup positioning correct, drawer still works, attribution/legend/layer switcher visible.

MAP VISUAL DESIGN: Map height 620–700px desktop. Border radius 14–18px. Polygon fill opacity 0.35–0.55. Do NOT use excessive glow, neon, or glassmorphism. HeatPulse should feel like scientific infrastructure.

COLOR SYSTEM: NORMAL = muted green, LOW/CAUTION = yellow, MODERATE = amber, HIGH = orange, SEVERE = red. Never define a visual category without a computational category. Legend text must come directly from classification configuration — UI cannot drift from logic.

CITY HEADER: Clearly separate CITY, CURRENT TIME, FORECAST RUN, LAST FETCH, VALID PERIOD. No excessive tiny text.

CURRENT CITY SUMMARY: CURRENT CONDITIONS strip (Temperature, RH, Wind, WBGT, Thermal Status) + FORECAST PEAK block (Peak WBGT, Peak time, Affected wards). Never mix these two concepts.

HEALTH IMPACT UX: Dedicated explanation panel. Layer title "HEALTH IMPACT", Subtitle "Relative Risk Estimate". WHAT THIS MEANS panel. HOW IT IS CALCULATED. DATA USED (Environmental + Vulnerability). NOT CURRENTLY AVAILABLE (Clinical calibration, Hospitalization target model, Mortality prediction).

VULNERABILITY DATA PROVENANCE: Every vulnerability variable must have provenance: {variable, value, unit, geography, source, source_year, methodology, confidence, status}. NEVER display "Outdoor Workers: 38%" without explaining what 38% represents.

VULNERABILITY PANEL: Compact visual bars for Outdoor exposure, Built density, Green-space deficit, Older population, Informal settlement exposure. Each expandable to show SOURCE, YEAR, GEOGRAPHY, PROXY STATUS.

### R11. PHASES 19–28 — FORECAST PAGE, SIMULATION, CHARTS, ML UX, HEATWAVE PREDICTION, ADVISORY, IMD PANEL

FORECAST PAGE: Header "5-DAY HEAT & THERMAL FORECAST". [START FORECAST SIMULATION] button = interactive replay/exploration of forecast trajectory (NOT inventing weather). Sections: Forecast Summary, Interactive Timeline, Thermal Forecast Chart, Heatwave Pattern Prediction, Peak Risk Period, Top Affected Wards, Methodology/Limitations.

FORECAST SIMULATION: On click, animate through 09 Sep 23:00 → ... → 14 Sep 22:00. Map updates selected forecast hour. Controls: PLAY, PAUSE, ←, →, SPEED 1×, SPEED 2×. Timeline slider: 0h, 24h, 48h, 72h, 96h, 120h. Do NOT rebuild map on every step. Only update metric styling.

THERMAL FORECAST CHART: One strong chart. X-axis = Time. Lines: Temperature, WBGT, optional HI. Vertical markers: CURRENT TIME and PEAK STRESS. Allow toggles. Avoid 10 different charts.

ML HEATWAVE PREDICTION UI: Dedicated section "HEATWAVE PATTERN MODEL". Model type = Logistic Regression. Training basis = ERA5-derived historical heatwave dataset. Clearly state it is a pattern classifier and that transfer outside training geography is indicative. Display: Heatwave Pattern Probability (%), Status (No Signal / Watch / Elevated / High). Feature contribution horizontal bars. If attribution unavailable: "Feature contribution visualization not currently implemented." DO NOT INVENT IT.

HEATWAVE PREDICTION CARD: 5-DAY HEATWAVE OUTLOOK. Each day: Peak temperature, Peak WBGT, Thermal stress duration, Heatwave model probability. Classification must come from actual model/calculation logic.

FORECAST PEAK DETECTION: Implement findForecastPeak(), findPeakWBGT(), findPeakHI(), findPeakTemperature(), countAffectedWardsAtTime(), countAffectedWardsDuringWindow(). Each must specify aggregation: MAX_OVER_NEXT_120H, MAX_DAILY, CURRENT_HOUR, SELECTED_HOUR.

WARD FORECAST DETAIL DRAWER: Ward identity, Current (temp, RH, WBGT, stress), Forecast Peak (WBGT, date, time, duration above threshold), Heatwave Model probability, Health Burden (RR), Vulnerability (baseline Census/proxy), Recommended Action.

ADVISORY SYSTEM: Tied to conditions. Show TRIGGER, REASON, ACTION, TIME WINDOW, TARGET GROUP. Avoid mandatory government mandates. Prefer "Recommended action window". Do not sound like a government declaration unless HeatPulse has that authority.

IMD PANEL: Keep completely separate. OFFICIAL IMD DISTRICT BULLETIN (Source, Scope, Issued, Status). Then separate HEATPULSE LOCALIZED ASSESSMENT (Scope: 141 municipal wards, Metric: Forecast thermal stress). Never visually merge these.

### R12. PHASES 29–30 — CITY PAGE STRUCTURE & NAVIGATION

CITY PAGE ORDER: 1. City + Timestamp Header, 2. Current Conditions compact strip, 3. Forecast Peak / 5-Day Outlook, 4. Official IMD District Bulletin, 5. Heatwave Pattern Model, 6. Large Map, 7. Map Controls/Layers, 8. Selected Ward Drawer, 9. Quick Actions. Map remains the hero visualization.

NAVIGATION: India Overview, City Overview, Forecast, Risk Areas, Insights, How It Works, Demo. Keep Demo (explains "SAME TEMPERATURE, DIFFERENT RISK").

### R13. PHASES 31–32 — RISK AREAS & INSIGHTS PAGES

RISK AREAS: Municipal triage page. Header "PRIORITY RISK AREAS". Top section: Critical / High / Moderate / Low. Ranked table: Rank, Ward, WBGT, Thermal Stress, Vulnerability, Composite Risk, Peak Time, Recommended Action, View on Map. Selecting a row: focuses map + selects ward + opens drawer.

INSIGHTS: Sections: Night-time recovery, Humidity burden, Thermal persistence, Outdoor exposure, Built environment. Each section: OBSERVED/FORECAST PATTERN, WHY IT MATTERS, DATA USED, LIMITATION. No unsupported causal claims.

### R14. PHASES 33–36 — DATA PROVENANCE, API CONTRACT, ERROR STATES, PARTIAL DATA

DATA PROVENANCE PANEL: Reusable panel for any selected value. Temperature → Source, Type, Coordinate, Valid time, Fetched, Resolution. WBGT → Derived from Temperature+RH, Method. Vulnerability → Source Census 2011/proxy, Status. Risk → Method, Weights.

API CONTRACT: Every forecast-derived response must have meta: {city, forecastRunTime, fetchedAt, validFrom, validTo, source, status}. No endpoint invents its own timestamp semantics.

ERROR STATES: Every major area must have loading / success / stale / unavailable / partial states. Do not show fake colors for unavailable data. Use neutral gray.

PARTIAL DATA: If 830/849 wards succeed, show "830 / 849 wards updated, 19 awaiting forecast." Updated wards colored, pending wards neutral. Never classify missing wards as Low.

### R15. PHASES 37–39 — PERFORMANCE, CLIENT/SERVER RESPONSIBILITIES, FULLSCREEN UX

MAP COLORING PERFORMANCE: Do NOT regenerate GeoJSON, recreate vector source, recreate map, or rebuild all features every time weather changes. Use stable source, stable feature IDs, style function/cached styles, metric lookup, minimal updates. Ward geometry visible nearly immediately. Metrics progressively populate.

CLIENT RESPONSIBILITIES: map rendering, controls, timeline, interactions, display state. SERVER RESPONSIBILITIES: provider requests, weather normalization, thermal calculations, risk calculations, ML inference, advisory generation, caching.

FULLSCREEN UX: Map toolbar: Layers, Fullscreen, Legend, Locate City, Reset View. Fullscreen button icon: Maximize. Active: Minimize/Exit Fullscreen. Keyboard Esc. No clipping.

### R16. PHASES 40–55 — RESPONSIVE DESIGN, TYPOGRAPHY, CARDS, VISUAL HIERARCHY, SCIENTIFIC TERMINOLOGY, CITY SWITCHING, LEGEND, MAP MODE INDICATOR

RESPONSIVE DESIGN: Desktop = map dominant + drawer right + charts wide. Mobile = map large top block + ward details bottom sheet + controls compact + timeline horizontal scroll.

TYPOGRAPHY: Page title 24–30px, Section 16–20px, Metric 28–38px, Supporting 12–14px, Metadata 11–12px. Avoid excessive uppercase.

CARD DESIGN: Not every component is a floating card. Card radius 12–16px, border 1px, shadow subtle only. Avoid huge shadows, glassmorphism everywhere, neon gradients, oversized badges. HeatPulse = scientific infrastructure.

VISUAL HIERARCHY: WHERE → CITY → WHAT → CURRENT HEAT → WHEN → FORECAST → WHERE EXACTLY → WARD MAP → WHY → THERMAL + VULNERABILITY → WHO → VULNERABLE GROUPS → WHAT NEXT → ACTION.

REMOVE AMBIGUOUS LABELS: "Live" (unless truly live), "Extreme" (unless classification supports it), "Health Impact" (if user cannot understand), "Sync" (replace with Refresh Forecast), "Peak" (without defined aggregation window), "AI" (unless model actually involved).

ADD EXPLANATORY MICROCOPY: Ward weather: "Forecast sampled at this ward's representative centroid." Thermal: "Thermal stress combines temperature and atmospheric moisture to estimate human heat burden." Risk: "Composite indicator combining forecast thermal load and baseline vulnerability." Health: "Relative-risk estimate; not a clinical prediction." ML: "Pattern classifier trained on historical reanalysis data; local transfer requires validation."

CITY SWITCHING (Kolkata → Bengaluru): Show Bengaluru geometry immediately, then "Loading forecast metrics…". Clear stale metric values during transition, preserve layout.

LEGEND: Dynamic by active layer. Values come from actual classification config. Never hardcode separate legend thresholds in UI.

MAP MODE INDICATOR: Compact chip inside map showing CURRENT, SELECTED FORECAST (11 Sep · 14:00), or 5-DAY PEAK.

FORECAST SIMULATION MAP UX: Map transitions between selected hours. Do NOT interpolate values unless scientifically justified. Tooltip shows "Valid: 11 Sep 14:00 IST" not "Now".

### R17. PHASES 56–64 — NIGHTTIME UX, SCIENTIFIC TERMINOLOGY AUDIT, DATA SOURCE DISCLOSURE, TESTING, VISUAL QA, EXTREME SCENARIOS

NIGHTTIME UX: At night, explicitly show CURRENT NIGHT CONDITIONS and NEXT DAY PEAK. "CURRENT 23:35 IST WBGT 24.8°C Low" then "NEXT PEAK 10 Sep 14:00 WBGT 31.9°C High".

SCIENTIFIC TERMINOLOGY AUDIT: Search repository for: live, real-time, observed, measured, microclimate, UTCI, WBGT, heatwave, AI, ML, mortality, hospitalization, prediction, official, warning, extreme, sensor, IoT. For every occurrence determine if terminology is scientifically justified. Correct where necessary.

DATA SOURCE DISCLOSURE: Create a reusable DATA SOURCES page/panel documenting Weather (Open-Meteo/NWP), GIS (source per city), Bhuvan (ISRO NRSC WMS), Demographics (Census/source-year), Vulnerability (proxy methodology), ML (training dataset and years), Health (Relative Risk methodology). For each: Source, Year, Spatial scale, Temporal scale, Role, Limitations.

TESTING: Add deterministic tests for: forecast timestamp separation, current vs forecast mode, daily peak, 120h peak, ward metric consistency, map/API consistency, missing ward weather, stale weather, cache reuse, duplicate requests, city switching, fullscreen, map layer switching, ML response schema, health layer disclaimer, vulnerability provenance, legend/config consistency.

VISUAL QA: Actually open/render the application. Check all 7 pages: City Page (forecast timing, map colors, ward boundaries, legend, drawer, fullscreen, layers, IMD panel, ML panel), Forecast Page (play button, timeline, chart, ML prediction, peak period, top wards), Risk Areas (ranking, filtering, map sync), Insights (clarity), How It Works (scientific transparency), Demo.

EXTREME SCENARIOS: Test 23:35 at night, early morning, forecast peak afternoon, all wards low, many wards severe, partial API failure, complete API failure, stale cache, city switch, rapid city switching, fullscreen, mobile viewport, slow network.

---

## Acceptance Criteria

### R0 — Phase 0 Audit Complete
- [ ] Complete dependency trace of every data flow path (clock → weather → thermal → risk → color) documented before any code changes.
- [ ] Exact aggregation used for map coloring identified (current-hour vs daily max vs 120h max vs selected hour).

### R1 — Timing Semantics Fixed
- [ ] Current time is NEVER confused with forecast peak on any page.
- [ ] Every map value has a clearly defined valid time shown in the UI.
- [ ] City page shows two distinct sections: CURRENT CONDITIONS and FORECAST PEAK, never merged.
- [ ] At 23:35 local time, selecting "Current" mode shows current-hour WBGT, not tomorrow's peak.

### R2 — Time-Control Model
- [ ] One shared forecastContext object consumed by all pages.
- [ ] No individual component independently decides which forecast hour to display.
- [ ] Mode switching (CURRENT / FORECAST / PEAK) updates the entire UI consistently.

### R3 — Map Synchronization
- [ ] Ward geometry appears within 1–2 seconds of page load, independent of weather data.
- [ ] Weather/risk metrics populate asynchronously into existing geometry without recreating it.
- [ ] No GeoJSON reload occurs on forecast refresh.
- [ ] No GeoJSON reload occurs on layer switching.
- [ ] No GeoJSON reload occurs on opening ward drawer.
- [ ] Stable Feature IDs used throughout.

### R4 — Sync Button Eliminated
- [ ] No generic "Sync" button exists.
- [ ] "Refresh Forecast" / "Update Forecast" button does not reload GIS geometry.
- [ ] Forecast update state shown correctly ("Updating forecast…", "Forecast updated 23:42 IST", "Forecast unavailable").

### R5 — Cache & Request Deduplication
- [ ] Multiple UI components requesting /api/weather?city=X trigger only one upstream call.
- [ ] Cache TTL and stale/unavailable states are correctly handled.

### R6–R7 — Data Architecture
- [ ] Static spatial data loads immediately from local files.
- [ ] Static vulnerability data does not reload from provider on every weather refresh.
- [ ] Ward-hour data object includes all required fields (ward_id, valid_time, forecast_run, temperature, RH, wind, radiation, HI, WBGT, utci_proxy, vulnerability_score, thermal_score, composite_risk, alert_level).

### R8–R9 — Map Layer Semantics & Map/API Consistency
- [ ] Heat Conditions, Thermal Stress, Health Impact layers use correct metrics.
- [ ] Legend thresholds come directly from classification config — no separate hardcoded UI values.
- [ ] MAP VALUE == API VALUE == DRAWER VALUE == SELECTED-TIME VALUE for any given ward and valid time.
- [ ] If daily max or 5-day peak is displayed, it is labeled as such.

### R10 — Interaction, Fullscreen, Visual Design
- [ ] Ward hover shows name, ID, metric value, and valid time.
- [ ] Ward click opens Drawer with all 8 sections using compact typography.
- [ ] Fullscreen map control exists in top-right.
- [ ] Escape key exits fullscreen.
- [ ] OpenLayers viewport recalculates correctly on fullscreen toggle.
- [ ] Map fill opacity is 0.35–0.55, no neon glow or excessive glassmorphism.
- [ ] Color system: Normal=green, Low=yellow, Moderate=amber, High=orange, Severe=red, exactly matches classification logic.

### R11 — Forecast Page & ML UX
- [ ] Forecast page has [START FORECAST] / [PLAY] button that animates through 120h forecast timeline updating map.
- [ ] Play/Pause/Speed controls functional.
- [ ] Thermal Forecast Chart with Temperature and WBGT lines, CURRENT TIME and PEAK STRESS vertical markers.
- [ ] ML HEATWAVE PATTERN MODEL section exists with: model type labeled as Logistic Regression, training basis visible (ERA5/Rajasthan), transfer-validity disclaimer shown, probability output shown.
- [ ] Feature contribution bars shown ONLY if actual values exist; if not, "Feature contribution visualization not currently implemented" is displayed.
- [ ] 5-DAY HEATWAVE OUTLOOK showing each day's classification from actual model logic.
- [ ] findForecastPeak(), findPeakWBGT(), findPeakHI() functions exist with explicit aggregation labels.
- [ ] Advisory shows TRIGGER, REASON, ACTION, WINDOW, TARGET with recommended (not mandatory) framing.
- [ ] IMD panel completely visually separate from HeatPulse localized assessment.

### R12–R13 — City Page Structure, Navigation, Risk Areas, Insights
- [ ] City page order: Header → Current Conditions → Forecast Peak → IMD Panel → Heatwave Model → Map → Map Controls → Ward Drawer → Quick Actions.
- [ ] Map is the hero visualization, not pushed far down.
- [ ] Risk Areas page acts as municipal triage table with map synchronization on row selection.
- [ ] Each Insights section has: Observed/Forecast Pattern, Why It Matters, Data Used, Limitation.

### R14 — Data Provenance
- [ ] Data Provenance panel exists and shows source for Temperature, WBGT, Vulnerability, Risk.
- [ ] All API responses include meta: {city, forecastRunTime, fetchedAt, validFrom, validTo, source, status}.
- [ ] Every major area has loading / success / stale / unavailable / partial states.
- [ ] Missing wards shown as neutral, never classified as Low.

### R15–R16 — Performance, Labels, Microcopy
- [ ] Ward geometry visible near-immediately on page load.
- [ ] Layer switching is instant (no GeoJSON reload).
- [ ] No "Live", "AI", "Extreme", "Sync", or "measured at ward" labels remain without justification.
- [ ] Explanatory microcopy present for weather, thermal, risk, health, and ML sections.
- [ ] City switching: new city geometry appears immediately, stale metrics cleared.
- [ ] Legend is dynamic and values come from classification config.
- [ ] Map mode indicator chip (CURRENT / SELECTED FORECAST / 5-DAY PEAK) visible inside map.

### R17 — Nighttime UX, Terminology, Tests, Visual QA
- [ ] At nighttime, page shows "CURRENT NIGHT CONDITIONS" and "NEXT DAY PEAK" — never a confusing red map without explanation.
- [ ] Scientific terminology audit complete — no unjustified use of "live", "real-time", "measured", "clinical", "mortality", "observed", "microclimate" without qualification.
- [ ] DATA SOURCES page/panel documents all 7 source categories.
- [ ] Deterministic test suite covers all 17 test scenarios listed.
- [ ] All 7 pages visually QA'd with actual browser rendering.
- [ ] Extreme scenarios tested (night, early morning, partial API failure, rapid city switching, fullscreen, mobile viewport).

### Final Acceptance
- [ ] `node scripts/verify-gis.mjs`: 62/62 PASSED
- [ ] `node tests/run-all.mjs`: 100% PASSED (85+ assertions)
- [ ] `npm run build`: all routes compile cleanly with 0 TypeScript/ESLint errors
- [ ] Zero fabricated mortality, hospitalization, IoT, or sensor values remain in codebase
- [ ] Health Impact layer explicitly labeled as Relative Risk Estimate, not clinical prediction
- [ ] Bhuvan WMS attribution remains compliant
- [ ] All vulnerability values labeled as proxies/baselines with Census year
- [ ] ML model labeled as Logistic Regression / synoptic pattern classifier with Rajasthan/ERA5 training basis
- [ ] No fake performance metrics (accuracy %, F1) shown unless documented in training artifacts

---

## PHASE 66 — FINAL FORENSIC REPORT

After implementation, produce a comprehensive `IMPLEMENTATION_REPORT.md` covering:
1. WHAT WAS BROKEN
2. WHY IT WAS BROKEN
3. WHAT WAS CHANGED (with exact files and line numbers)
4. WHERE IT WAS CHANGED
5. HOW DATA FLOWS NOW
6. HOW CURRENT VS FORECAST TIME WORKS
7. HOW MAP SYNCHRONIZATION WORKS
8. HOW FORECAST SIMULATION WORKS
9. HOW ML HEATWAVE PREDICTION WORKS
10. HOW HEALTH IMPACT WORKS
11. WHERE EACH VULNERABILITY DATASET COMES FROM
12. PERFORMANCE IMPROVEMENTS
13. TEST RESULTS
14. VISUAL QA RESULTS
15. REMAINING LIMITATIONS
16. SIH-SAFE CLAIMS
17. CLAIMS WE MUST NOT MAKE

---

## FINAL RULE

Do NOT optimize for making screenshots look impressive.

Optimize for: SCIENTIFIC CORRECTNESS · TEMPORAL CORRECTNESS · DATA TRACEABILITY · GIS CORRECTNESS · PERFORMANCE · EXPLAINABILITY · MUNICIPAL USEFULNESS · SIH DEFENSIBILITY

Every number must have a provenance. Every color must have a classification. Every classification must have a rule. Every forecast must have a valid time. Every model must have a known training basis. Every vulnerability value must have a source/status. Every health output must state its limitations. Every map interaction must remain fast. Every UI element must have a purpose.

DO NOT fabricate anything to make the system appear more complete.
DO NOT claim validation that does not exist.
DO NOT silently substitute datasets.
DO NOT silently change scientific formulas.
DO NOT remove Bhuvan attribution.
DO NOT remove limitations.

FIRST inspect. THEN implement. THEN test. THEN visually verify. THEN perform a final data-truth audit.


