# Bhuvan Research

## Overview
Bhuvan is the geospatial portal of NRSC (National Remote Sensing Centre), ISRO, under the Department of Space, Government of India.

## Official URLs
- Portal: https://bhuvan.nrsc.gov.in/
- WMS Docs: https://bhuvan.nrsc.gov.in/wiki/index.php/How_to_use_WMS_services
- Service Catalogue: https://bhuvan-app1.nrsc.gov.in/2dresources/bhuvanstore.php
- Terms: https://bhuvan.nrsc.gov.in/terms.php

## WMS Service

### Endpoint
```
https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms
```

### Capabilities
| Property | Value |
|---|---|
| Version | 1.1.1 |
| CRS | EPSG:4326 |
| Format | image/png |
| SRS Support | EPSG:4326 |

### Available Layers
1. **lulc:BR_LULC50K_1112** — Land Use Land Cover 1:50,000
2. **Wasteland** — Wasteland mapping
3. **Geomorphology** — Landform features
4. **Lineament** — Linear geological features
5. **Urban LULC** — Urban land use
6. **Erosion** — Soil erosion zones
7. **Water Bodies** — Surface water
8. **Salt Affected & Water Logged Area**
9. **Flood Hazard** — Flood risk zones
10. **Flood Annual Layers** — Annual flood extent

### WMS Request Example
```
https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms?
  SERVICE=WMS&
  VERSION=1.1.1&
  REQUEST=GetMap&
  LAYERS=lulc:BR_LULC50K_1112&
  SRS=EPSG:4326&
  WIDTH=800&HEIGHT=600&
  BBOX=73.7,18.4,74.0,18.7
```

## WMTS Service
```
http://bhuvan3.nrsc.gov.in/cgi-bin/bhuvan_islands_mha.exe
```

## Terms of Use (Critical)

### Permitted
- Access and view content through the Bhuvan portal
- Use for non-commercial purposes

### Prohibited
- ❌ Access via any technology other than Bhuvan portal interfaces
- ❌ Copy, translate, modify, or make derivative works
- ❌ Redistribute, sublicense, rent, publish, sell, assign, lease, market, transfer
- ❌ Reverse engineer, decompile
- ❌ Mass downloads or bulk feeds of any content
- ❌ Delete or alter warnings/notices
- ❌ Real-time navigation or autonomous vehicle control

### Attribution
- DOS/ISRO/NRSC retains all ownership rights
- Users may be held liable for unauthorized copying/disclosure

### Key Implication for HeatPulse
Bhuvan can be used as a **live contextual WMS layer** (embedded in the map).
We CANNOT:
- Download and rehost Bhuvan tiles
- Bulk-download Bhuvan data
- Modify Bhuvan content
- Use Bhuvan as the authoritative boundary source

## Recommended Usage
- **Bhuvan WMS** → Contextual basemap (LULC, flood hazard layers)
- **Verified vectors** (SimplyGIS + datameet) → Authoritative administrative boundaries
- **Composition**: Bhuvan context + HeatPulse analysis on top

## Attribution String
When using Bhuvan WMS:
```
© Bhuvan, NRSC, ISRO
```
