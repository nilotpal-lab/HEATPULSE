# HeatPulse — CLAUDE.md

## Project Overview
**HeatPulse** — SIH26083: Extreme Heatwave Early Warning and Human Thermal Stress Index
Organization: MoES / NCMRWF | Theme: Disaster Management | City: Pune, Maharashtra

## Core Principles
1. **Real data over convenient data** — no fabricated geography or demographics
2. **Verified geometry over generated geometry** — every polygon must trace to a source
3. **Browser proof over AI claims** — verified = source + implementation + tests + browser + visual
4. **Pune first** — one city done correctly before expanding
5. **Bhuvan = context, verified vectors = truth**
6. **Administrative polygon is the analytical unit** — never circles, buffers, or synthetic boundaries

## Architecture
```
Bhuban (WMS context)
+ India/Maharashtra/Pune verified vectors
+ Open-Meteo weather
→ Heat Index / WBGT / UTCI (thermal stress)
→ Vulnerability baseline
→ 3-5 day risk trajectory
→ Administrative polygon risk map
→ Action recommendations
```

## Geographic Units
- **15 Administrative Wards** (Kshetriya Karyalayas) — PRIMARY operational unit
- **58 Electoral Wards** (2022 PMC) — secondary reference
- Source: datameet/Pune_wards + datameet/Municipal_Spatial_Data

## Tech Stack
- Frontend: Next.js + React + TypeScript
- Map: TBD after engine evaluation (OpenLayers preferred for Bhuvan WMS)
- Weather: Open-Meteo API
- Database: Supabase (PostgreSQL + PostGIS)
- Project ref: braiktcmrtvnlwsioxtm

## Data Directories
- `data/raw/` — immutable source shapefiles (India, Maharashtra, MH_District)
- `data/processed/` — validated/transformed data
- `data/runtime/` — application-used GeoJSON
- `data/validation/` — QA reports
- `data/metadata/` — source/license/provenance

## GIS Sources (Verified)
1. **India Outline** (SimplyGIS) — SHP, LCC_WGS84, 256064 records
2. **Maharashtra** (SimplyGIS) — SHP, LCC_WGS84, 256016 records
3. **Maharashtra District** (SimplyGIS) — SHP, LCC_WGS84, 256206 records
4. **Pune Admin Wards 15** (datameet) — GeoJSON, CRS84, 15 polygons
5. **Pune Electoral Wards 2022** (datameet/Municipal) — GeoJSON, CRS84, 58 polygons
6. **Pune Electoral Wards 2012** (datameet/Municipal) — GeoJSON, CRS84, 76 polygons

## Bhuvan WMS
- URL: `https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms`
- Version: 1.1.1
- CRS: EPSG:4326
- Format: image/png
- Layers: LULC, Wasteland, Geomorphology, Urban LULC, Flood Hazard, etc.
- Terms: Non-exclusive, non-transferable license. No redistribution, no bulk downloads.

## Phase Progress
- Phase 0: 🟡 In Progress — Project initialization
- Phase 1: ⚪ Unknown — SIH Requirements
- Phase 2: ⚪ Unknown — GIS Source Research
- Phase 3: ⚪ Unknown — Pune Admin Unit Research
- Phase 4: ⚪ Unknown — Bhuvan Prototype
- Phase 5: ⚪ Unknown — Map Engine Decision

## Critical Rules
- NEVER generate administrative boundaries from circles, buffers, or interpolation
- NEVER fabricate demographic or health data
- NEVER claim official government integration without evidence
- NEVER use weather points to define administrative geography
- If real geometry unavailable: show "Administrative boundary unavailable" + 🔴 UNSUPPORTED
- Unknown is better than fabricated

## Security
- All secrets in `.env.local` only
- `.env*` files gitignored
- Service-role key SERVER ONLY
- Regular secret scans before commits
