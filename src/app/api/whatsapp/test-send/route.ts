import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppDirect, buildHeatAlertMessage, sanitizePhoneNumber } from '@/lib/whatsapp-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, wardName, city, level } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const testAlertMsg = buildHeatAlertMessage({
      wardName: wardName || 'Admin Ward 01 Aundh',
      city: city || 'Pune',
      level: (level as any) || 'critical',
      heatIndex: 43.8,
      wbgt: 31.4,
      temperature: 39.5,
      humidity: 58,
      recommendations: [
        'Pause heavy outdoor construction labor between 12:00 - 15:30',
        'Consume cold ORS water and electrolyte fluids frequently',
        'Cooling shelter activated at Ward Municipal Health Center #4',
        'Check on elderly individuals and infants'
      ],
    });

    const result = await sendWhatsAppDirect(phone, testAlertMsg);

    return NextResponse.json({
      success: result.success,
      phone: sanitizePhoneNumber(phone),
      notice: result.error || 'Test alert message successfully delivered to WhatsApp',
      preview: testAlertMsg,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
