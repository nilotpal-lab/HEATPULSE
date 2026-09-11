# SIH26083 Requirements Analysis

## Problem Statement ID
26083

## Title
Extreme Heatwave Early Warning and Human Thermal Stress Index

## Organization
Ministry of Earth Sciences (MoES)
National Centre for Medium Range Weather Forecasting (NCMRWF)

## Category
Software

## Theme
Disaster Management

---

## Required Functionality

### 1. Human Thermal Stress Index
- [ ] **Heat Index (HI)** — combines temperature + humidity
- [ ] **Wet-Bulb Globe Temperature (WBGT)** — combines temp + humidity + wind + radiation
- [ ] **Universal Thermal Climate Index (UTCI)** — comprehensive thermal stress metric
- Must NOT rely on temperature alone

### 2. Weather Data Integration
- [ ] Temperature (dry-bulb)
- [ ] Relative humidity
- [ ] Wind speed
- [ ] Solar radiation / surface pressure
- Source: Open-Meteo API (120h / 5-day forecast)

### 3. Spatial Localization
- [ ] GIS-mapped dashboard
- [ ] Color-coded alerts at Zone/Ward level
- [ ] Hyper-local (administrative operational unit level)
- [ ] Zoom hierarchy: India → State → City → Administrative Unit

### 4. Health Impact Prediction
- [ ] Mortality Risk Index
- [ ] Hospitalization spike prediction
- [ ] 3-5 day forecast horizon (T+0 to T+120h)
- [ ] Historical public health data integration
- [ ] Demographic vulnerability (elderly, outdoor workers)

### 5. Alert System
- [ ] Automated SMS/WhatsApp regional alerts (API-ready)
- [ ] Localized triggers for city administration
- [ ] In-app alerts (MVP)
- [ ] Heat Action Plan activation triggers

### 6. Action Recommendations
- [ ] Cooling center deployment
- [ ] Power grid adjustments
- [ ] Outdoor work hour shifts
- [ ] Hospital preparedness
- [ ] Public health advisories

### 7. API
- [ ] RESTful API for external integration
- [ ] Push capability for alerts
- [ ] Data export for disaster management authorities

---

## Intended Users
1. **Municipal Corporations** — Pune Municipal Corporation and similar
2. **Healthcare Systems** — hospitals, health departments
3. **Disaster Management Authorities** — state/national NDMA/SDMA
4. **Public** — general awareness and personal protection
5. **Outdoor Workers** — direct exposure risk alerts

---

## Expected Outputs
1. Real-time thermal stress dashboard (GIS map)
2. 3-5 day risk trajectory per administrative unit
3. Color-coded risk levels (LOW → EXTREME)
4. Automated alerts (in-app, API-ready for SMS/WhatsApp)
5. Actionable recommendations per risk level
6. API endpoints for integration

---

## Key Technical Requirements

| Requirement | Detail |
|---|---|
| Forecast horizon | 3-5 days (120 hours) |
| Spatial resolution | Zone/Ward (administrative operational unit) |
| Thermal metrics | HI, WBGT, UTCI |
| Risk model | Thermal stress × Vulnerability × Forecast trajectory |
| GIS engine | WMS-compatible (Bhuvan), vector polygons |
| Database | PostgreSQL/PostGIS (Supabase) |
| Frontend | Next.js/React/TypeScript |
| Weather source | Open-Meteo (free, no API key) |

---

## Constraints
- **Pune only** for initial implementation
- No fabricated health/demographic data
- Bhuvan usage must comply with terms (contextual only)
- Administrative boundaries must be real, not generated
- Desktop-first interface

---

## Success Criteria (SIH Evaluation)
1. System translates weather → human thermal stress → health risk
2. Localized to administrative units (not just points)
3. 3-5 day forecast with risk trajectory
4. Actionable recommendations tied to risk level
5. Professional GIS dashboard (not decorative map)
6. API-ready for SMS/WhatsApp integration
7. Handles data gaps honestly (no fabricated values)
