import { NextRequest, NextResponse } from 'next/server';
import { getSubscribers, buildHeatAlertMessage, sendWhatsAppDirect } from '@/lib/whatsapp-service';
import { getCityForecast } from '@/lib/weather-service';
import { calculateThermalStress } from '@/lib/thermal-engine';
import { ALERT_THRESHOLDS } from '@/lib/threshold-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { cityId, simulate } = body;

    const subscribers = await getSubscribers();
    const activeSubscribers = subscribers.filter((s) => s.isActive && (!cityId || s.cityId === cityId.toLowerCase()));

    if (activeSubscribers.length === 0) {
      return NextResponse.json({
        message: 'No active subscribers found for the specified city/criteria.',
        dispatchedCount: 0,
      });
    }

    const dispatchLog: any[] = [];
    let sentCount = 0;

    for (const sub of activeSubscribers) {
      let shouldAlert = false;
      let alertLevel: 'watch' | 'warning' | 'critical' = 'warning';
      let heatIndex = 41.5;
      let wbgt = 30.2;
      let temperature = 38.0;
      let humidity = 55;

      if (simulate) {
        shouldAlert = true;
        alertLevel = 'critical';
        heatIndex = 43.5;
      } else {
        try {
          const { run } = await getCityForecast(sub.cityId);
          const wardForecast = Object.values(run.wards).find(
            (w) => w.ward_id === sub.wardId || w.ward_name.toLowerCase().includes(sub.wardName.toLowerCase())
          );

          if (wardForecast && wardForecast.current) {
            temperature = wardForecast.current.temperature_2m;
            humidity = wardForecast.current.relative_humidity_2m;
            const thermal = calculateThermalStress(
              temperature,
              humidity,
              wardForecast.current.apparent_temperature
            );
            heatIndex = thermal.heat_index;
            wbgt = thermal.wbgt_estimated;

            if (heatIndex >= ALERT_THRESHOLDS.criticalHi || wbgt >= ALERT_THRESHOLDS.criticalWbgt) {
              shouldAlert = true;
              alertLevel = 'critical';
            } else if (heatIndex >= ALERT_THRESHOLDS.warningHi || wbgt >= ALERT_THRESHOLDS.warningWbgt) {
              shouldAlert = true;
              alertLevel = 'warning';
            } else if (heatIndex >= ALERT_THRESHOLDS.watchHi) {
              shouldAlert = true;
              alertLevel = 'watch';
            }
          }
        } catch (err) {
          // In offline or fallback mode
          if (simulate) shouldAlert = true;
        }
      }

      if (shouldAlert) {
        const msg = buildHeatAlertMessage({
          wardName: sub.wardName,
          city: sub.cityId,
          level: alertLevel,
          heatIndex,
          wbgt,
          temperature,
          humidity,
          recommendations: [
            'Drink cool water or electrolytes every 20 minutes',
            'Avoid direct sun exposure between 12:00 PM and 3:30 PM',
            'Report heat exhaustion symptoms to local ward health centers',
          ],
        });

        const res = await sendWhatsAppDirect(sub.phone, msg);
        dispatchLog.push({
          phone: sub.phone,
          ward: sub.wardName,
          level: alertLevel,
          heatIndex,
          delivered: res.success,
          notice: res.error,
        });

        if (res.success) sentCount++;
      }
    }

    return NextResponse.json({
      success: true,
      totalEvaluated: activeSubscribers.length,
      dispatchedCount: dispatchLog.length,
      successfullyDelivered: sentCount,
      log: dispatchLog,
    });
  } catch (error: any) {
    console.error('[API /api/whatsapp/broadcast] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
