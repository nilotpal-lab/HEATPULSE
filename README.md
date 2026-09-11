# HeatPulse 🔥

> **Extreme-Heat Early-Warning & Human Thermal-Stress Decision-Support Platform**  
> *Smart India Hackathon (SIH 2024 / SIH26083) — Ministry of Earth Sciences (MoES) / NCMRWF / IMD*

[![Next.js](https://img.shields.io/badge/Next.js-16.3.4-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![OpenLayers](https://img.shields.io/badge/OpenLayers-v10-1f6feb)](https://openlayers.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com/)

---

## 📌 Overview

**HeatPulse** is an advanced biometeorological and geospatial intelligence system designed for Indian municipal corporations, disaster management authorities, and public health officials. It bridges the gap between macro-scale Numerical Weather Prediction (NWP) models and hyper-local, ward-level heat vulnerability.

### 🌟 Key Capabilities
- 🗺️ **High-Resolution Multi-City GIS**: 849 municipal wards across 6 major Indian metropolitan regions (Bengaluru 369, Pune 15, Mumbai 24, Kolkata 141, Chennai 200, Coimbatore 100) normalized to RFC 7946 EPSG:4326.
- 🛰️ **Dual-Engine Basemap**: Primary ISRO NRSC Bhuvan WMS (`lulc:BR_LULC50K_1112`) satellite tiles with automated zero-latency OpenStreetMap (OSM) fallback.
- 🌡️ **Rigorous Thermal Biometeorology**: Mathematically verified NOAA Rothfusz Heat Index, BoM Simplified Outdoor Wet-Bulb Globe Temperature (WBGT), and UTCI Proxy.
- 🚨 **Automated Public Health Advisories**: Per-tier actionable advisories (Green, Yellow, Orange, Red) with vulnerable population guidance and hospital surge protocols.
- 🏛️ **Municipal Action Trigger API**: Rapid activation of cooling shelters, drinking water stations, adjusted outdoor labor hours, and emergency medical services.
- 🔬 **Twin-Ward Demographic Contrast Demo**: Direct side-by-side comparison of wards with identical temperatures but diverging vulnerability profiles (e.g., Aundh vs. Kasba).
- ⏱️ **Server-Side NWP Weather Pipeline**: Ward centroid weather sampling with separate `FORECAST_RUN_TIME` and `FORECAST_VALID_TIME`, in-memory cache, and honest stale-fallback handling.

---

## 🚀 Live Demo & Navigation

| Route | Page | Description |
|---|---|---|
| `/` | **City Overview** | Interactive Bhuvan/OSM map, layer switcher, 5-day thermal outlook, and ward drawer |
| `/india` | **National Overview** | National thermal choropleth with monitored city index cards |
| `/forecast` | **120-Hour Timeline** | Diurnal temperature/humidity curves with heat wave severity badges |
| `/risk-areas` | **Priority Risk Areas** | Searchable, ranked municipal ward risk matrix with direct map framing |
| `/demo` | **Twin-Ward Comparison** | Vulnerability-driven risk divergence demonstration |
| `/how-it-works` | **Methodology** | Mathematical formulas, data source provenance, and non-claims transparency |

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **UI Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Mapping**: [OpenLayers v10](https://openlayers.org/) + Proj4js
- **Icons**: [Lucide React](https://lucide.dev/)
- **Weather Provider**: Open-Meteo NWP Grid (ECMWF IFS / GFS Seamless)
- **Basemaps**: ISRO NRSC Bhuvan WMS & OpenStreetMap (OSM)

---

## 📦 Getting Started

### Prerequisites
- Node.js 18.18+ or 20+
- npm, yarn, or pnpm

### 1. Clone the Repository
```bash
git clone https://github.com/nilotpal-lab/HEATPULSE.git
cd HEATPULSE
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup (Optional)
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for Production
```bash
npm run build
npm run start
```

---

## ☁️ Deployment on Vercel

HeatPulse is pre-configured for one-click deployment on [Vercel](https://vercel.com):

1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Import the `nilotpal-lab/HEATPULSE` GitHub repository.
3. Keep default settings (`Framework Preset: Next.js`, `Root Directory: ./`).
4. Click **Deploy**.

---

## 📄 Documentation

For deep-dive documentation, architectural specifications, and test reports:
- [`PROJECT.md`](./PROJECT.md) — Master build specification and architectural inventory
- [`PROGRESS.md`](./PROGRESS.md) — Feature delivery & phase completion tracking
- [`DECISIONS.md`](./DECISIONS.md) — Architectural decision records (ADRs)
- [`docs/`](./docs/) — GIS research, Bhuvan WMS specs, and health models
- [`SIH26083_PITCH_GUARDRAILS_AND_DEFENSE_FAQ.md`](./SIH26083_PITCH_GUARDRAILS_AND_DEFENSE_FAQ.md) — SIH defense & jury FAQ

---

## 🛡️ License

MIT License. Developed for SIH 2024 (Problem Statement SIH26083).

