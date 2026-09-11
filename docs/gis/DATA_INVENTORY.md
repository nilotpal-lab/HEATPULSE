# GIS Data Inventory

## User-Provided Shapefiles (SimplyGIS)

### 1. India Outline
| Property | Value |
|---|---|
| File | India_Outline(www.simplygis.in).rar |
| SHP Size | 8,753,280 bytes |
| Records | 256,064 |
| Geometry Type | Polygon (ShapeType 5) |
| CRS | PROJCS["LCC_WGS84"] — Lambert Conformal Conic, WGS84 datum |
| CRS Parameters | CM=80°, SP1=12.472944°, SP2=35.172806°, FE=4000000, FN=4000000, LatOrigin=24° |
| BBox (projected) | (2818364, 2177526) to (5679118, 5444563) meters |
| Encoding | UTF-8 |
| Attributes | STATE (string, 50 chars) |
| Source | www.simplygis.in |
| License | Unknown — likely public domain (Government of India data) |
| Administrative Level | Country outline |
| Potential Use | India boundary vector, country-level context |
| Limitations | Projected CRS requires transformation to EPSG:4326 |
| Status | ✅ Inspected, ready for processing |

### 2. Maharashtra State
| Property | Value |
|---|---|
| File | Maharashtra(www.simplygis.in).rar |
| SHP Size | 1,114,144 bytes |
| Records | 256,016 |
| Geometry Type | Polygon (ShapeType 5) |
| CRS | Same LCC_WGS84 as India |
| BBox (projected) | (3242642, 3099134) to (4092691, 3797212) meters |
| Encoding | UTF-8 |
| Attributes | STATE (string, 50), Slug (string, 50) |
| Source | www.simplygis.in |
| Potential Use | Maharashtra state boundary |
| Limitations | High record count suggests multi-part geometry or detailed coastline |
| Status | ✅ Inspected, ready for processing |

### 3. Maharashtra Districts
| Property | Value |
|---|---|
| File | Maharashtra_District(www.simplygis.in).rar |
| SHP Size | 5,967,260 bytes |
| Records | 256,206 |
| Geometry Type | Polygon (ShapeType 5) |
| CRS | Same LCC_WGS84 as India |
| BBox (projected) | (3242642, 3099134) to (4092691, 3797212) meters |
| Encoding | UTF-8 |
| Attributes | DISTRICT_L (50), District (254), STATE (254) |
| Source | www.simplygis.in |
| Potential Use | District-level boundaries within Maharashtra |
| Limitations | Very high record count — likely includes detailed district borders |
| Status | ✅ Inspected, ready for processing |

---

## GitHub-sourced GeoJSON

### 4. Pune Admin Wards (datameet)
| Property | Value |
|---|---|
| File | pune-admin-wards.geojson |
| Features | 15 |
| Geometry Type | Polygon (1 ring each) |
| CRS | urn:ogc:def:crs:OGC:1.3:CRS84 (WGS84 lat/lon) |
| BBox | (73.7516, 18.4288) to (73.9630, 18.6216) |
| Total Coords | 10,636 |
| Properties | name (e.g., "Admin Ward 01 Aundh") |
| Source | https://github.com/datameet/Pune_wards |
| License | CC BY-SA 2.5 India |
| Date | Unknown vintage |
| Operational Relevance | HIGH — 15 Kshetriya Karyalayas (ward offices) |
| Status | ✅ Validated, ready for use |

### 5. Pune Admin Wards 2017 (Municipal)
| Property | Value |
|---|---|
| File | pune-admin-wards_2017.geojson |
| Features | 15 |
| Geometry Type | Polygon |
| CRS | WGS84 |
| BBox | (73.7516, 18.4288) to (73.9630, 18.6216) |
| Total Coords | 10,636 |
| Properties | name (matches datameet exactly) |
| Source | https://github.com/datameet/Municipal_Spatial_Data |
| License | CC BY-SA 2.5 India |
| Status | ✅ Cross-validated with datameet source |

### 6. Pune Electoral Wards 2022 (Municipal)
| Property | Value |
|---|---|
| File | pune-electoral-wards_2022.geojson |
| Features | 58 |
| Geometry Type | MultiPolygon |
| CRS | WGS84 (CRS84) |
| BBox | (73.7319, 18.3854) to (74.0184, 18.6218) |
| Total Coords | 20,114 |
| Properties | wardnum, Name1, Name2, origin (PMC PDF) |
| Source | http://www.pmc.gov.in/sites/default/files/final_ward_maps/ |
| License | Unknown — scraped from PMC |
| Operational Relevance | MEDIUM — electoral, not disaster management |
| Status | ✅ Validated, detailed geometry |

### 7. Pune Electoral Wards 2012 (Municipal)
| Property | Value |
|---|---|
| File | pune-electoral-wards_2012.geojson |
| Features | 76 |
| Geometry Type | Polygon |
| CRS | WGS84 |
| Total Coords | 14,710 |
| Properties | name, wardnum |
| Status | ⚠️ Outdated (2012), 76 wards vs current 58 |

### 8. Pune Electoral Wards 2017
| Property | Value |
|---|---|
| File | pune-electoral-wards_2017.geojson |
| Features | 41 |
| Geometry Type | MultiPolygon |
| Total Coords | 42 (EXTREMELY SIMPLIFIED — likely points, NOT polygons) |
| Properties | name-mr (Kannada script), ward |
| Status | 🔴 UNUSABLE — geometry is insufficient for polygon rendering |

### 9. PCMC Electoral Wards
| Property | Value |
|---|---|
| File | pcmc-electoral-wards.geojson |
| Features | 66 |
| Geometry Type | Polygon |
| Total Coords | 5,809 |
| Status | ⚪ Out of scope (Pimpri-Chinchwad, not Pune city) |

---

## CSV Supporting Data

### 10. Pune Admin Ward Offices
| Property | Value |
|---|---|
| File | pune-admin-ward-offices.csv |
| Records | 14 |
| Columns | name, description, lon, lat |
| Source | punecorporation.org (official PMC) |
| Status | ✅ Reference points for 15 admin wards |

### 11. Pune Wards Info
| Property | Value |
|---|---|
| File | pune-wards-info.csv |
| Records | 77 |
| Columns | name, wardnum, title, adminward, ER_A, ER_B, voters, male_voters, female_voters, polling data, areas |
| Source | Pooled from multiple published sources |
| Status | ✅ Demographic reference (voter data, not population) |

---

## External Sources to Research

### 12. Bhuvan WMS (NRSC/ISRO)
| Property | Value |
|---|---|
| URL | https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms |
| Version | 1.1.1 |
| CRS | EPSG:4326 |
| Format | image/png |
| Layers | LULC, Wasteland, Geomorphology, Urban LULC, Flood Hazard, etc. |
| License | Non-exclusive, non-transferable. No redistribution. |
| Status | ✅ Research complete, ready for prototype |

### 13. Survey of India Digital Products
| Property | Value |
|---|---|
| URL | https://onlinemaps.surveyofindia.gov.in/Digital_Products.aspx |
| Product OVSF/1M/6 | Entire country up to Taluk level with HQ (SHAPEFILE, free) |
| Login Required | Yes |
| Status | ⚪ Requires account creation for download |

### 14. Open-Meteo API
| Property | Value |
|---|---|
| URL | https://open-meteo.com/ |
| Key Required | No |
| Forecast | Up to 120 hours (5 days) |
| Variables | Temperature, humidity, wind, radiation, pressure |
| Status | ✅ Ready for integration |

---

## CRS Transformation Plan
All SimplyGIS shapefiles use **LCC_WGS84** (Lambert Conformal Conic, WGS84 datum).
Target CRS for web mapping: **EPSG:4326** (WGS84 geographic).

Transformation pipeline:
```
SHP (LCC_WGS84) → ogr2ogr → GeoJSON (EPSG:4326) → data/processed/
```

Tools needed: GDAL/ogr2ogr or Node.js projection library (proj4js).
