# Survey of India — Data Research

## Official Portal
- Main: https://onlinemaps.surveyofindia.gov.in/
- Digital Products: https://onlinemaps.surveyofindia.gov.in/Digital_Products.aspx
- About: https://onlinemaps.surveyofindia.gov.in/AboutPortal.aspx

## Organization
- Under: Department of Science and Technology, Government of India
- Role: Production and maintenance of topographical, geographical, and requirement-specific maps
- Alignment: New Geospatial Policy of India

## Administrative Boundary Products

### Product OVSF/1M/6
| Property | Value |
|---|---|
| Code | OVSF/1M/6 |
| Price | ₹0/- (Free) |
| Type | SHAPEFILE |
| Content | Entire country up to Taluk level with HQ |
| Status | Available for download (requires login) |

### Product OVSF/1M/8
| Property | Value |
|---|---|
| Code | OVSF/1M/8 |
| Price | ₹0/- (Free) |
| Type | SHAPEFILE |
| Content | State up to Taluk level with HQ |
| Status | Available for download (requires login) |

## Other Digital Products
- **Topographical Maps (1:50K)**: Shapefile, GDB, TIFF, PDF, DTM
- **Digital Vector Data (1:1M)**: Nationwide generalized data with administrative, drainage, transportation, population layers
- **Digital Geographical Maps**: Railway (1:3.5M), Political (1:4M), Road (1:2.5M), Physical (1:4.5M)
- **Free PDF Maps**: Political, Physical, Road, Railway, State, Tourist, Antique, Guide

## Limitations for HeatPulse
1. **Login Required** — Download buttons use JavaScript postbacks and require account login
2. **No CRS Information** — Product pages do not specify coordinate reference systems
3. **Taluk Level** — Finest granularity is taluk/subdistrict, which is COARSER than Pune's ward level
4. **Not Municipal** — Survey of India boundaries are government administrative divisions, NOT municipal ward boundaries

## Recommendation
Survey of India data is useful for:
- India country boundary (cross-validation)
- Maharashtra state boundary (cross-validation)
- District boundaries (contextual)

NOT suitable for:
- Pune municipal ward-level boundaries (too coarse, different administrative system)

## Action
- Create SoI account if taluk-level data would add value
- Use SimplyGIS data as primary India/Maharashtra source (already obtained, no login needed)
- Use datameet data for Pune ward boundaries (already obtained, detailed)
