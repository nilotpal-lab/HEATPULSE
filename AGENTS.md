<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# HeatPulse — Agent Conventions

## Project
- **SIH26083**: Extreme Heatwave Early Warning and Human Thermal Stress Index
- **Organization**: MoES / NCMRWF | **Theme**: Disaster Management | **City**: Pune, Maharashtra
- **Next.js 16.3.4** + Turbopack | TypeScript | Tailwind v4 | OpenLayers v10 | Supabase

## Critical Rules
- NEVER generate administrative boundaries from circles, buffers, or interpolation
- NEVER fabricate demographic or health data
- NEVER claim official government integration without evidence
- Real data over convenient data; verified geometry over generated geometry
- Pune first — one city done correctly before expanding

## Build Commands
```bash
npm run dev       # Start dev server (port 3000)
npm run build     # Production build (Turbopack)
npm run lint      # ESLint + TypeScript type check
```

## Tech Stack
- **Frontend**: Next.js 16.3.4, React 19, TypeScript, Tailwind v4
- **Map**: OpenLayers v10 (SSR-safe via `dynamic({ ssr: false })`)
- **Weather**: Open-Meteo API (free, no key, 120h forecast)
- **Database**: Supabase (PostgreSQL + PostGIS) — project ref: `braiktcmrtvnlwsioxtm`
- **Thermal**: Heat Index (Rothfusz), WBGT (simplified outdoor), UTCI (apparent temp approx)

## API Inventory (all verified, 0 TypeScript errors)
| Route | Method | Description | Status |
|---|---|---|---|
| `/` | GET | Dashboard page | Live |
| `/api/weather` | GET | Open-Meteo 5-day forecast (120h) | Live |
| `/api/thermal` | GET | Thermal stress calculations (HI/WBGT/UTCI) | Live |
| `/api/risk` | GET | Ward risk assessment (15 wards, composite score) | Live |
| `/api/alerts` | GET | Active heat alerts with timezone fix (IST) | Live |
| `/api/geography` | GET | Ward boundaries + metadata + points (3 query modes) | Live |
| `/api/cron/thermal` | GET | Scheduled thermal refresh (Vercel cron) | Live |

## Data Sources
| Data | Source | License | Location |
|---|---|---|---|
| Pune Admin Wards (15) | datameet/Pune_wards | CC BY-SA 2.5 | `public/data/` |
| Pune Electoral Wards (58) | datameet/Municipal_Spatial_Data | CC BY-SA 2.5 | `data/raw/` |
| Weather | Open-Meteo API | Free, no key | Live API |
| Bhuvan LULC | NRSC/ISRO | Contextual use only | WMS endpoint |

## Key Formulas
- **Composite Risk**: `0.6 × thermalScore + 0.4 × vulnerabilityScore`
- **Heat Index**: Rothfusz Regression (valid T≥27°C, RH≥40%)
- **WBGT**: `0.567×T + 0.393×e + 3.94` (simplified outdoor)
- **Vulnerability**: green space (35%) + building density (30%) + outdoor worker density (20%) + base urban (15%)

## File Conventions
- All secrets in `.env.local` only — never commit
- `.env*` files gitignored
- GeoJSON served via `fs.readFileSync` from `public/data/` (Turbopack can't bundle .geojson)
- Map components wrapped in `dynamic({ ssr: false })`
- All API routes in `src/app/api/`

## Vulnerability Baseline (current, transparent estimates)
- Green space %: PMC surveys + Bhuvan LULC (real source, baseline values)
- Building density: Census 2011 + NFHS-5 (real source, baseline values)
- Outdoor worker density: NFHS-5 + PMC infrastructure (real source, baseline values)
- All baseline values labeled "not fabricated health data" in UI
