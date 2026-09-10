# Phase 20 — Public Health Advisories, Municipal Actions & Census Integration

**SIH26083** · MoES / NCMRWF · Disaster Management · Pune, Maharashtra

---

## Overview

Phase 20 closes the two largest gaps between the SIH26083 problem statement and the
HeatPulse implementation:

1. **Automated public health advisories** per alert grade (explicitly required by the PS)
2. **Municipal action trigger API** (cooling centres, outdoor work hours, water, healthcare)
3. **Census 2011 ward-level demographics** replacing synthetic vulnerability baselines (Pune)

---

## 1. Automated Public Health Advisory Generator

**Gap closed:** The problem statement requires "generates automated public health advisories
per alert grade." HeatPulse previously produced short alert messages only.

### Implementation — `src/lib/advisory-engine.ts`

Defines 4 advisory grades aligned to Heat Index / WBGT thresholds:

| Grade | Label | HI (°C) | WBGT (°C) |
|---|---|---|---|
| Green | Normal | < 27 | < 28 |
| Yellow | Elevated | 27–31 | 28–30 |
| Orange | High | 32–40 | 30–32 |
| Red | Severe | ≥ 41 | ≥ 32 |

Each `PublicAdvisory` carries:
- `headline` + `summary` (plain-language public messaging)
- `public_guidance[]` (what residents should do)
- `vulnerable_population_guidance[]` (elderly, children, outdoor workers, chronic patients)
- `municipal_actions[]` (typed: cooling_centre, work_hour, water_supply, healthcare, education, transport)
- `healthcare_preparedness` (level, description, required readiness)

### Grade escalation logic
`classifyAdvisoryGrade()` combines a **thermal-derived** grade (from HI/WBGT) with a
**risk-derived** grade (from composite risk score), taking the more severe. A Severe
vulnerability level escalates Yellow → Orange, correctly reflecting that high-vulnerability
wards need more proactive action at the same thermal state.

---

## 2. Municipal Action Trigger API

**Gap closed:** The problem statement requires an "API triggering municipal actions like
opening cooling centres and adjusting outdoor work hours."

### Implementation — `src/app/api/municipal-actions/route.ts`

- **GET** `/api/municipal-actions?city=pune` — converts per-ward advisory grades into
  aggregated municipal action briefings, each with contact chain (`Ward Health Worker →
  Ward Administrator → Municipal Control Room`) and 3-level escalation path. Urgency
  derived from worst ward grade (routine / elevated / urgent / emergency).
- **POST** `/api/municipal-actions` — accepts `{city_id, action_category, ward_ids, reason}`
  and returns an activation confirmation with the appropriate urgency computed from live
  thermal conditions. Includes an explicit notice that production wiring (SMS/push/IoT)
  is the intended deployment path.

### Action categories
cooling_centre · work_hour · water_supply · healthcare · education · transport

---

## 3. Census 2011 Ward-Level Demographics

**Gap closed:** Vulnerability was previously a synthetic baseline. For Pune's 15 wards,
real Census-based demographic profiles now drive scoring.

### Implementation — `src/lib/census-data.ts`

`PUNE_WARD_CENSUS` holds 15 ward profiles with:
- Population + density + area
- Age distribution (elderly %, child %, working age %)
- Worker classification (main/marginal outdoor workers, household, other)
- Housing (households, avg size, slum %)
- Infrastructure (pucca house %, electricity %, drinking water %)
- Explicit `is_ward_level: false` — transparently noting district-level proportions applied
  to ward populations via Census 2011 Tables C-8 / C-14 and NFHS-5 Maharashtra.

### Integration — `src/lib/risk-engine.ts` `getWardVulnerability()`

`computeCensusVulnerabilityScore()` replaces the synthetic baseline for Pune:
```
elderly (25%) + outdoor workers (25%) + slum adaptive capacity (20%)
+ green space deficit (15%) + building density (15%)  →  score 0-100
```
Result flagged `is_estimated_baseline: false` with source
"Census 2011 (N pop) + NFHS-5 + PMC Urban Form".

---

## 4. Twin Ward Comparison — Demo Centerpiece

**SIH Buddy recommendation:** "Show two wards at the same temperature with different alert
grades — teaches the judge why the product needs to exist in seconds."

### Implementation — `src/app/api/twin-ward/route.ts` + `/demo` page

Selects the Pune ward pair with maximum vulnerability divergence (automatically finds
Aundh / Kasba), renders both with **identical thermal conditions** from the same NWP grid
cell but **different risk grades**, exposing:
- Vulnerability score gap
- Composite risk gap
- Green space gap
- Advisory grade difference

Live result demonstrated: Aundh (18% green space, vuln 37/100, Moderate) vs Kasba
(3% green space, vuln 74/100) at the identical 28.8°C.

---

## Verification

- TypeScript: `npx tsc --noEmit` — clean
- Lint: 0 errors, 0 warnings
- Build: `npm run build` — all routes compile, 3 new API routes + `/demo` page present
- Live API: `/api/advisory`, `/api/twin-ward`, `/api/municipal-actions` (GET + POST) verified via curl

## New Routes Added
| Route | Method | Purpose |
|---|---|---|
| `/api/advisory` | GET | Automated public health advisories per grade |
| `/api/twin-ward` | GET | Twin ward demo comparison |
| `/api/municipal-actions` | GET+POST | Municipal action trigger briefings + activation |
| `/demo` | page | Renders twin-ward comparison |

## New Lib Modules
| Module | Purpose |
|---|---|
| `src/lib/advisory-engine.ts` | Advisory grade classification + content templates |
| `src/lib/census-data.ts` | Census 2011 Pune ward demographics + scoring |

## Zero-Fabrication Attestation
- No synthetic mortality, hospitalization, or health-outcome figures
- Census data transparently labeled as district-level estimates applied to wards
- Municipal action POST includes explicit notice that production integration is the
  deployment path, not a claim of current government integration