/**
 * HeatPulse — Vercel Cron: Thermal Data Refresh
 *
 * Scheduled by vercel.json cron config: runs every 6 hours
 * Fetches live weather, recalculates thermal stress for all 15 wards,
 * and returns the updated risk summary.
 *
 * Called by Vercel cron — no user-facing response needed.
 */
import { fetchWeatherForecast } from '@/lib/weather'
import { calculateHourlyThermalForecast } from '@/lib/thermal'
import { calculateWardRisk, WARD_POINTS } from '@/lib/risk'

export const maxDuration = 60 // Vercel cron timeout (seconds)

export async function GET() {
  try {
    const forecast = await fetchWeatherForecast(18.5204, 73.8567, 5)
    const thermalForecast = calculateHourlyThermalForecast(forecast)
    const nowStr = new Date().toISOString().slice(0, 13)
    const currentReading = thermalForecast.find((t) => t.time.startsWith(nowStr)) ?? thermalForecast[0]

    const wards = Object.entries(WARD_POINTS).map(([name, coords]) => {
      return calculateWardRisk(name, coords.lon, coords.lat, {
        heatIndex: currentReading.heat_index,
        wbgt: currentReading.wbgt_estimated,
        riskLevel: currentReading.risk_level,
      })
    })

    const maxRisk = Math.max(...wards.map((w) => w.compositeRisk))
    const minRisk = Math.min(...wards.map((w) => w.compositeRisk))
    const avgRisk = Math.round((wards.reduce((s, w) => s + w.compositeRisk, 0) / wards.length) * 10) / 10

    console.log(`[cron] Thermal refresh complete: ${wards.length} wards | Max: ${maxRisk} | Min: ${minRisk} | Avg: ${avgRisk}`)

    return Response.json({
      ok: true,
      generated_at: new Date().toISOString(),
      wards_count: wards.length,
      max_risk: maxRisk,
      min_risk: minRisk,
      avg_risk: avgRisk,
    })
  } catch (error) {
    console.error('[cron] Thermal refresh failed:', error)
    return Response.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
