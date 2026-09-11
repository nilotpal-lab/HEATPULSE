# GIS Source Comparison

## Pune Administrative Data

| Dataset | Publisher | Unit Type | Date | Geometry | Currentness | CRS | License | Operational Relevance | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| pune-admin-wards.geojson | DataMeet | 15 Admin Wards | Unknown | Polygon, 10,636 coords | ⚠️ Unknown | CRS84 | CC BY-SA 2.5 | HIGH | 🟡 MEDIUM |
| pune-admin-wards_2017.geojson | DataMeet/Municipal | 15 Admin Wards | 2017 | Polygon, 10,636 coords | ⚠️ Unknown | CRS84 | CC BY-SA 2.5 | HIGH | 🟡 MEDIUM |
| pune-electoral-wards_2022.geojson | DataMeet (PMC source) | 58 Electoral Wards | 2022 | MultiPolygon, 20,114 coords | ✅ Current | CRS84 | Unknown | MEDIUM | 🟢 HIGH |
| pune-electoral-wards_2012.geojson | DataMeet | 76 Electoral Wards | 2012 | Polygon, 14,710 coords | 🔴 Outdated | CRS84 | CC BY-SA 2.5 | LOW | 🟢 HIGH |
| pune-electoral-wards_2017.geojson | DataMeet | 41 Electoral Wards | 2017 | ~42 coords (points?) | 🔴 Outdated + broken | CRS84 | CC BY-SA 2.5 | LOW | 🔴 FAIL |

## India/Maharashtra Boundaries

| Dataset | Publisher | Level | Date | Geometry | CRS | License | Confidence |
|---|---|---|---|---|---|---|---|
| India_Outline.shp | SimplyGIS | Country | Unknown | Polygon, 256K records | LCC_WGS84 | Unknown | 🟡 MEDIUM |
| Maharashtra.shp | SimplyGIS | State | Unknown | Polygon, 256K records | LCC_WGS84 | Unknown | 🟡 MEDIUM |
| Maharashtra_District.shp | SimplyGIS | District | Unknown | Polygon, 256K records | LCC_WGS84 | Unknown | 🟡 MEDIUM |
| OVSF/1M/6 | Survey of India | Taluk | Unknown | Shapefile | Unknown | Free (login req) | ⚪ UNKNOWN |

## Disagreements

### QUESTION: Are the 15 admin wards from datameet and municipal identical?
- **Source A**: pune-admin-wards.geojson (datameet/Pune_wards)
- **Source B**: pune-admin-wards_2017.geojson (datameet/Municipal_Spatial_Data)
- **Difference**: Both have 15 features, same bbox, same coord count (10,636). Names match exactly.
- **Evidence**: Side-by-side comparison shows identical geometry
- **Decision**: Treat as same source, cross-validated
- **Remaining Uncertainty**: Exact vintage/date unknown

### QUESTION: Which electoral ward system is current?
- **Source A**: 76 wards (2012) — outdated
- **Source B**: 41 wards (2017) — broken geometry
- **Source C**: 58 wards (2022) — PMC official source
- **Evidence**: 2022 source explicitly cites PMC official PDF maps
- **Decision**: 2022 electoral wards are current; 15 admin wards are operationally relevant
- **Remaining Uncertainty**: Whether 58 electoral wards were updated after 2022

---

## Recommendation

| Use Case | Recommended Source |
|---|---|
| Primary operational geography | 15 Admin Wards (datameet + municipal cross-validated) |
| Reference/context layer | 58 Electoral Wards 2022 (PMC official) |
| India boundary | SimplyGIS India_Outline.shp (after CRS transformation) |
| Maharashtra boundary | SimplyGIS Maharashtra.shp (after CRS transformation) |
| District boundaries | SimplyGIS Maharashtra_District.shp (after CRS transformation) |
