# HeatPulse — TASKS.md

## Phase 0: Project Initialization
- [x] Create project directory structure
- [x] Extract user-provided RAR shapefiles (India, Maharashtra, MH_District)
- [x] Clone GitHub repos (datameet/Pune_wards, datameet/Municipal_Spatial_Data)
- [x] Inspect shapefile metadata (CRS, records, attributes, bbox)
- [x] Inspect GeoJSON sources (feature counts, properties, geometry quality)
- [x] Create CLAUDE.md
- [ ] Create .env.local with Supabase credentials
- [ ] Create .gitignore
- [ ] Initialize npm/Next.js project

## Phase 1: SIH Requirements Analysis
- [ ] Study SIH26083 problem statement thoroughly
- [ ] Extract all functional requirements
- [ ] Extract non-functional requirements
- [ ] Create docs/research/SIH26083_REQUIREMENTS.md
- [ ] Create requirement traceability matrix

## Phase 2: GIS Source Research
- [ ] Research Bhuvan WMS/WMTS capabilities in depth
- [ ] Read Bhuvan terms of use thoroughly
- [ ] Research Survey of India administrative boundary products
- [ ] Research Pune GIS (PMC, Maharashtra GIS portal)
- [ ] Research Open-Meteo API capabilities
- [ ] Create docs/gis/BHUVAN_RESEARCH.md
- [ ] Create docs/gis/SOI_DATA_RESEARCH.md
- [ ] Create docs/gis/DATA_INVENTORY.md
- [ ] Create docs/gis/SOURCES.md

## Phase 3: Pune Administrative Unit Research
- [ ] Resolve 15 vs 58 ward issue
- [ ] Determine operational vs electoral semantics
- [ ] Validate geometry quality of both sources
- [ ] Cross-reference with Bharatlas and PMC sources
- [ ] Create docs/gis/PUNE_ADMINISTRATIVE_RESEARCH.md
- [ ] Create docs/gis/SOURCE_COMPARISON.md

## Phase 4: Bhuvan Prototype
- [ ] Create prototype/map/ with minimal Bhuvan WMS integration
- [ ] Prove WMS layer renders correctly
- [ ] Prove CRS transformation works
- [ ] Prove attribution displays correctly
- [ ] Test J&K/Ladakh boundary presentation
- [ ] Document results

## Phase 5: Map Engine Decision
- [ ] Evaluate OpenLayers vs MapLibre vs Leaflet
- [ ] Test Bhuvan WMS compatibility with top candidates
- [ ] Create docs/architecture/MAP_ENGINE_DECISION.md
- [ ] Get approval before proceeding

## Phase 6-8: Geometry Extraction & QA
- [ ] Convert India/Maharashtra SHP to GeoJSON (EPSG:4326)
- [ ] Validate Pune admin ward geometry
- [ ] Check topology (overlaps, gaps, slivers)
- [ ] Generate representative points for weather API
- [ ] Create docs/gis/GIS_GEOMETRY_QA.md

## Phase 9-16: Full Implementation
- [ ] Implement map shell with zoom/viewport/click
- [ ] Integrate Open-Meteo weather API
- [ ] Implement Heat Index, WBGT, UTCI calculations
- [ ] Build vulnerability baseline
- [ ] Implement risk model (transparent baseline)
- [ ] Build 3-5 day forecast trajectory
- [ ] Build dashboard with intelligence panel
- [ ] Implement action recommendations

## Phase 17-19: QA & Final Audit
- [ ] Browser automation tests (Playwright)
- [ ] Visual QA screenshots (25 required)
- [ ] Final audit document
- [ ] Security scan
- [ ] Performance check

## Decision Points (Awaiting Approval)
1. Map engine selection (Phase 5)
2. Pune administrative unit choice (Phase 3)
3. Proceed to implementation (after Phase 5 approval)
