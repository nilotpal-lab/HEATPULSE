# HeatPulse — DECISIONS.md

## Decision Log

### D001: Pune Administrative Unit Selection
**Date**: 2026-09-01
**Question**: Which Pune administrative unit should HeatPulse use as its primary operational geography?
**Options**:
- A: 15 Administrative Wards (Kshetriya Karyalayas) — operational governance
- B: 58 Electoral Wards (2022 PMC) — electoral boundaries
- C: 76 Electoral Wards (2012) — outdated electoral
**Evidence**:
- 15 admin wards: Correspond to actual ward offices that coordinate disaster response. Geometry: 10,636 coord pairs across 15 detailed polygons. Source: datameet + municipal (both agree).
- 58 electoral wards: PMC 2022 official, detailed geometry (20,114 coords). Purpose: voting, not disaster response.
- SIH requirement: "Zone/Ward level" alerts for "municipal corporations, healthcare systems, and disaster management authorities"
**Decision**: **A — 15 Administrative Wards** as primary operational unit.
**Reason**: HeatPulse serves disaster management authorities who operate through ward offices, not electoral boundaries.
**Status**: 🟢 VERIFIED

---

### D002: Map Engine Selection
**Date**: 2026-09-01
**Question**: Which map library should power the HeatPulse GIS?
**Options**:
- A: OpenLayers — strong OGC/WMS support, complex API
- B: MapLibre GL — modern, performant, vector-first, weaker WMS
- C: Leaflet — simple, lightweight, plugin ecosystem
**Decision**: **A — OpenLayers v10**
**Reason**: Best OGC/WMS support for Bhuvan integration. Robust feature picking via `forEachFeatureAtPixel`. Full viewport control. Mature React ecosystem via ol-react if needed.
**Status**: 🟡 PARTIAL (pending browser test of Bhuvan WMS tiles)

---

### D003: CRS Strategy
**Date**: 2026-09-01
**Question**: How to handle the LCC_WGS84 projected CRS of SimplyGIS shapefiles?
**Decision**: Transform all shapefiles to EPSG:4326 (WGS84) during processing. Store in data/processed/ and data/runtime/.
**Reason**: Web maps require EPSG:4326. Open-Meteo API accepts lat/lon. Uniform CRS simplifies all downstream processing.
**Status**: 🟢 VERIFIED (accepted approach)

---

### D004: Bhuvan Usage
**Date**: 2026-09-01
**Question**: How to use Bhuvan in HeatPulse?
**Decision**: Bhuvan WMS as CONTEXTUAL basemap only. Verified vector geometry (India/MH/Pune) as the authoritative geographic truth.
**Reason**: Bhuvan terms prohibit redistribution. WMS is allowed as a live tile layer. Administrative boundaries must come from verified sources.
**Status**: 🟢 VERIFIED

---

### D005: Health Data Approach
**Date**: 2026-09-01
**Question**: How to handle mortality/hospitalization data?
**Decision**: Transparent baseline model. No fabricated data. Architecture ML-ready for when real data becomes available.
**Reason**: SIH requires mortality prediction but public health data is scarce/restricted. Honesty about limitations is critical.
**Status**: 🟢 VERIFIED

---

### D006: Secondard Reference Layer
**Date**: 2026-09-01
**Question**: Should electoral wards be shown as a reference layer?
**Decision**: Yes — 58 Electoral Wards (2022) as a secondary/toggleable reference layer.
**Reason**: Users may need to cross-reference electoral wards. Does not replace admin wards as the operational unit.
**Status**: 🟢 VERIFIED

---

## Outstanding Decisions
- Color scheme for risk levels
- Dashboard layout specifics
- Whether to include ward office points as markers
