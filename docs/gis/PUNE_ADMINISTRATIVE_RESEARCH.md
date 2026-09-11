# Pune Administrative Unit Research

## The 15 vs 58 Problem

Pune has multiple overlapping administrative subdivision systems. Understanding the distinction is critical for HeatPulse.

---

## System A: 15 Administrative Wards (Kshetriya Karyalayas)

### What They Are
- **Type**: Administrative governance units
- **Function**: Last-mile governance — first level of permanent administrative office for citizens
- **Administration**: Each ward has a Ward Office (Kshetriya Karyalaya) with dedicated staff
- **Purpose**: Local administrative services, grievance redressal, local development
- **Current**: Operational as of 2024-2025

### Evidence
- Source: DataMeet (cc-by-sa 2.5) + Municipal Spatial Data repository
- Both sources agree: exactly 15 wards
- Geometry: Detailed polygons (10,636 coordinate pairs total)
- Ward Offices CSV: 14 entries (one may be merged or the CSV is incomplete)

### Ward Names
1. Admin Ward 01 Aundh
2. Admin Ward 02 Ghole Road
3. Admin Ward 03 Kothrud (Karve Road)
4. Admin Ward 04 Warje Karvenagar
5. Admin Ward 05 Dhole Patil Rd
6. Admin Ward 06 Yerawda - Sangamwadi
7. Admin Ward 07 Nagar Road
8. Admin Ward 08 Kasba Vishrambaugwada
9. Admin Ward 09 Tilak Road
10. Admin Ward 10 Sahakarnagar
11. Admin Ward 11 Bibwewadi
12. Admin Ward 12 Bhavani Peth
13. Admin Ward 13 Hadapsar
14. Admin Ward 14 Dhankawadi
15. Admin Ward 15 Kondhwa Wanavdi

### Bounding Box
- Lon: 73.7516 to 73.9630
- Lat: 18.4288 to 18.6216

---

## System B: 58 Electoral Wards (2022)

### What They Are
- **Type**: Electoral voting boundaries
- **Function**: Municipal corporation elections
- **Administration**: Elected ward councilors
- **Purpose**: Voting, electoral representation
- **Source**: http://www.pmc.gov.in/sites/default/files/final_ward_maps/ (official PMC)

### Evidence
- 58 wards with detailed MultiPolygon geometry (20,114 coordinate pairs)
- Each ward has a Name1 (e.g., "01 Dhanori - Vishrantwadi") and Name2
- Origin explicitly cited as PMC official PDF maps

### Bounding Box
- Lon: 73.7319 to 74.0184
- Lat: 18.3854 to 18.6218

---

## System C: 76 Electoral Wards (2012)

### What They Are
- Older electoral ward boundaries
- Superseded by 2022 redistricting
- **Not recommended for use** — outdated

---

## System D: 41 Electoral Wards (2017)

### What They Are
- Extremely simplified geometry
- Only 42 coordinate pairs for 41 features
- Likely point-based, NOT polygon boundaries
- **Unusable for map rendering**

---

## Recommendation: 15 Administrative Wards

### Why 15 for HeatPulse

| Criterion | 15 Admin Wards | 58 Electoral Wards |
|---|---|---|
| Operational relevance for disaster management | ✅ HIGH — ward offices coordinate response | ⚠️ LOW — electoral, not operational |
| GIS geometry quality | ✅ Detailed polygons (10,636 coords) | ✅ Detailed polygons (20,114 coords) |
| Source authority | ✅ datameet + municipal cross-validated | ✅ PMC official |
| Heat action plan alignment | ✅ Ward offices are first responders | ⚠️ Different boundary logic |
| SIH requirement match | ✅ "Zone/Ward level" for municipal corporations | ⚠️ Electoral ≠ administrative |

### Decision
**PRIMARY**: 15 Administrative Wards (Kshetriya Karyalayas)
**SECONDARY**: 58 Electoral Wards (2022) — reference layer only

### Rationale
HeatPulse serves disaster management authorities who activate Heat Action Plans through **ward offices**, not electoral ward councilors. The 15 admin wards represent the actual operational geography for:
- Opening cooling centers
- Hospital preparedness coordination
- Outdoor worker precaution dissemination
- Public health advisory distribution

### Source Files
- Primary: `C:/Users/nilot/AppData/Local/Temp/pune_wards/GeoData/pune-admin-wards.geojson`
- Cross-validation: `C:/Users/nilot/AppData/Local/Temp/municipal_data/Pune/pune-admin-wards_2017.geojson`
- Ward offices: `C:/Users/nilot/AppData/Local/Temp/pune_wards/CSVs/pune-admin-ward-offices.csv`

### License
CC BY-SA 2.5 India (DataMeet Trust)
