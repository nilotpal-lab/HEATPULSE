/**
 * HeatPulse — Scheduled Thermal Data Refresh (Cron)
 *
 * Self-contained script that fetches Open-Meteo weather and computes
 * thermal stress for all 15 Pune wards. Outputs to data/runtime/.
 *
 * Usage:
 *   node scripts/cron-refresh.js           # Run once
 *   node scripts/cron-refresh.js --daemon  # Every 6 hours
 *
 * On Vercel: use the /api/thermal endpoint with cron triggers instead.
 * This script is for self-hosted or manual execution.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const https = require('https')

const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'runtime')
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000

// ─── Ward data (from data/processed/representative_points.geojson) ───
const WARD_POINTS = {
  'Admin Ward 01 Aundh': { lon: 73.794912, lat: 18.546629 },
  'Admin Ward 02 Ghole Road': { lon: 73.838754, lat: 18.528272 },
  'Admin Ward 03 Kothrud Karveroad': { lon: 73.791945, lat: 18.507793 },
  'Admin Ward 04 Warje Karvenagar': { lon: 73.801629, lat: 18.486947 },
  'Admin Ward 05 Dhole Patil Rd': { lon: 73.901619, lat: 18.524145 },
  'Admin Ward 06 Yerawda - Sangamwadi': { lon: 73.902004, lat: 18.581501 },
  'Admin Ward 07 Nagar Road': { lon: 73.920051, lat: 18.558605 },
  'Admin Ward 08 KasbaVishrambaugwada': { lon: 73.855316, lat: 18.510498 },
  'Admin Ward 09 Tilak Road': { lon: 73.822011, lat: 18.470012 },
  'Admin Ward 10 Sahakarnagar': { lon: 73.851231, lat: 18.488732 },
  'Admin Ward 11 Bibwewadi': { lon: 73.867769, lat: 18.478054 },
  'Admin Ward 12 Bhavani Peth': { lon: 73.867657, lat: 18.511321 },
  'Admin Ward 13 Hadapsar': { lon: 73.924187, lat: 18.483092 },
  'Admin Ward 14 Dhankawadi': { lon: 73.858523, lat: 18.446191 },
  'Admin Ward 15 Kondhwa Wanavdi': { lon: 73.896593, lat: 18.483268 },
}

// ─── Vulnerability baseline (transparent estimates, not fabricated health data) ───
const DEFAULT_VULNERABILITY = {
  'Admin Ward 01 Aundh': { greenSpacePct: 18, buildingDensity: 0.58, outdoorWorkerDensity: 0.3 },
  'Admin Ward 02 Ghole Road': { greenSpacePct: 7, buildingDensity: 0.92, outdoorWorkerDensity: 0.7 },
  'Admin Ward 03 Kothrud Karveroad': { greenSpacePct: 10, buildingDensity: 0.82, outdoorWorkerDensity: 0.4 },
  'Admin Ward 04 Warje Karvenagar': { greenSpacePct: 14, buildingDensity: 0.68, outdoorWorkerDensity: 0.35 },
  'Admin Ward 05 Dhole Patil Rd': { greenSpacePct: 5, buildingDensity: 0.95, outdoorWorkerDensity: 0.5 },
  'Admin Ward 06 Yerawda - Sangamwadi': { greenSpacePct: 7, buildingDensity: 0.88, outdoorWorkerDensity: 0.5 },
  'Admin Ward 07 Nagar Road': { greenSpacePct: 4, buildingDensity: 0.96, outdoorWorkerDensity: 0.8 },
  'Admin Ward 08 KasbaVishrambaugwada': { greenSpacePct: 3, buildingDensity: 1.0, outdoorWorkerDensity: 0.85 },
  'Admin Ward 09 Tilak Road': { greenSpacePct: 5, buildingDensity: 0.92, outdoorWorkerDensity: 0.6 },
  'Admin Ward 10 Sahakarnagar': { greenSpacePct: 16, buildingDensity: 0.55, outdoorWorkerDensity: 0.25 },
  'Admin Ward 11 Bibwewadi': { greenSpacePct: 8, buildingDensity: 0.78, outdoorWorkerDensity: 0.45 },
  'Admin Ward 12 Bhavani Peth': { greenSpacePct: 4, buildingDensity: 0.97, outdoorWorkerDensity: 0.75 },
  'Admin Ward 13 Hadapsar': { greenSpacePct: 7, buildingDensity: 0.85, outdoorWorkerDensity: 0.55 },
  'Admin Ward 14 Dhankawadi': { greenSpacePct: 12, buildingDensity: 0.72, outdoorWorkerDensity: 0.3 },
  'Admin Ward 15 Kondhwa Wanavdi': { greenSpacePct: 13, buildingDensity: 0.65, outdoorWorkerDensity: 0.35 },
}

// ─── Thermal formulas (same as src/lib/thermal.ts) ───
function calcHeatIndex(t, r) {
  if (t < 27) return t
  const T = t, R = r
  const hi = -8.7846947 + 1.61139411*T + 2.338549*R - 0.14611605*T*R
    - 0.012308094*T*T - 0.016424828*R*R + 0.002211732*T*T*R
    + 0.00072546*T*R*R - 0.000003582*T*T*R*R
  return Math.round(hi * 10) / 10
}

function calcWBGT(t, r) {
  const e = (r / 100) * 0.6108 * Math.exp((17.27 * t) / (237.3 + t)) * 10
  return Math.round((0.567 * t + 0.393 * e + 3.94) * 10) / 10
}

function classifyRisk(hi) {
  if (hi >= 54) return 'danger'
  if (hi >= 41) return 'extreme'
  if (hi >= 32) return 'high'
  if (hi >= 27) return 'moderate'
  return 'low'
}

// ─── HTTP helper ───
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

// ─── Main ───
async function refreshAll() {
  const now = new Date().toISOString()
  console.log(`[${now}] Starting thermal data refresh...`)

  const forecast = await httpGet(
    'https://api.open-meteo.com/v1/forecast'
    + '?latitude=18.5204&longitude=73.8567'
    + '&hourly=temperature_2m,relative_humidity_2m,apparent_temperature'
    + '&timezone=Asia/Kolkata&forecast_days=5'
  )

  const hourly = forecast.hourly.time.map((t, i) => ({
    time: t,
    temperature: forecast.hourly.temperature_2m[i],
    humidity: forecast.hourly.relative_humidity_2m[i],
    apparent_temperature: forecast.hourly.apparent_temperature[i],
    heat_index: calcHeatIndex(forecast.hourly.temperature_2m[i], forecast.hourly.relative_humidity_2m[i]),
    wbgt_estimated: calcWBGT(forecast.hourly.temperature_2m[i], forecast.hourly.relative_humidity_2m[i]),
    utc_index: forecast.hourly.apparent_temperature[i],
    risk_level: classifyRisk(calcHeatIndex(forecast.hourly.temperature_2m[i], forecast.hourly.relative_humidity_2m[i])),
    risk_label: classifyRisk(calcHeatIndex(forecast.hourly.temperature_2m[i], forecast.hourly.relative_humidity_2m[i])).charAt(0).toUpperCase()
      + classifyRisk(calcHeatIndex(forecast.hourly.temperature_2m[i], forecast.hourly.relative_humidity_2m[i])).slice(1),
    recommendations: [],
    calculated_at: now,
  }))

  const results = {
    generated_at: now,
    forecast_summary: {
      maxHeatIndex: Math.round(Math.max(...hourly.map((h) => h.heat_index)) * 10) / 10,
      minHeatIndex: Math.round(Math.min(...hourly.map((h) => h.heat_index)) * 10) / 10,
      currentRiskLevel: hourly[0].risk_level,
    },
    hourly,
    wards: [],
  }

  for (const [wardName, coords] of Object.entries(WARD_POINTS)) {
    const v = DEFAULT_VULNERABILITY[wardName] ?? {}
    const greenScore = Math.round((1 - (v.greenSpacePct ?? 10) / 25) * 35)
    const densityScore = Math.round((v.buildingDensity ?? 0.7) * 30)
    const workerScore = Math.round((v.outdoorWorkerDensity ?? 0.5) * 20)
    const vulnScore = Math.min(100, greenScore + densityScore + workerScore + 15)

    const c = hourly[0]
    const thermalScore = Math.min(100, Math.max(0, (c.heat_index - 20) / 3.4))
    const composite = Math.round(0.6 * thermalScore + 0.4 * vulnScore)
    const compLevel = composite >= 70 ? 'extreme' : composite >= 50 ? 'high' : composite >= 30 ? 'moderate' : 'low'

    const recs = []
    if (vulnScore > 60) recs.push('High vulnerability — prioritize elderly and low-income residents.')
    if ((v.greenSpacePct ?? 10) < 5) recs.push('Low green cover — urban heat island effect is elevated.')
    if (recs.length === 0) recs.push('No immediate action required. Monitor conditions.')

    results.wards.push({
      wardName,
      lon: coords.lon,
      lat: coords.lat,
      currentTemp: c.temperature,
      currentHumidity: c.humidity,
      heatIndex: c.heat_index,
      wbgt: c.wbgt_estimated,
      thermalRisk: c.risk_level,
      vulnerabilityScore: vulnScore,
      compositeRisk: composite,
      compositeRiskLevel: compLevel,
      recommendations: recs,
      updated_at: now,
    })
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const outFile = path.join(OUTPUT_DIR, 'thermal-refresh.json')
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2))

  console.log(`[${now}] Refresh complete.`)
  console.log(`  Wards: ${results.wards.length}`)
  console.log(`  Max HI: ${results.forecast_summary.maxHeatIndex}°C`)
  console.log(`  Min HI: ${results.forecast_summary.minHeatIndex}°C`)
  console.log(`  Saved: ${outFile}`)
  return results
}

async function daemon() {
  console.log('HeatPulse cron refresh — daemon mode (6h intervals)')
  console.log('Press Ctrl+C to stop')
  await refreshAll()
  setInterval(async () => {
    try { await refreshAll() }
    catch (err) { console.error('Refresh failed:', err.message) }
  }, REFRESH_INTERVAL_MS)
}

const args = process.argv.slice(2)
if (args.includes('--daemon')) {
  daemon()
} else {
  refreshAll().catch((err) => { console.error('Refresh failed:', err); process.exit(1) })
}
