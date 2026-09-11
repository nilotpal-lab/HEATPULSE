import { NextRequest, NextResponse } from 'next/server';
import { saveSubscriber, buildWelcomeMessage, sendWhatsAppDirect, sanitizePhoneNumber } from '@/lib/whatsapp-service';
import { CITIES, CityId } from '@/types/gis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, name, cityId, wardId, wardName, language } = body;

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 });
    }

    if (!cityId || !wardId) {
      return NextResponse.json({ error: 'City and Ward selection are required' }, { status: 400 });
    }

    const sanitizedPhone = sanitizePhoneNumber(phone);
    if (sanitizedPhone.length < 10) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    const resolvedWardName = wardName || wardId;
    const subscriber = await saveSubscriber({
      phone: sanitizedPhone,
      name: name?.trim() || 'Citizen',
      cityId: cityId.toLowerCase(),
      wardId: wardId,
      wardName: resolvedWardName,
      language: language || 'en',
    });

    // Send immediate WhatsApp welcome confirmation message
    const welcomeMsg = buildWelcomeMessage(subscriber);
    const sendResult = await sendWhatsAppDirect(sanitizedPhone, welcomeMsg);

    return NextResponse.json({
      success: true,
      subscriber,
      whatsappSent: sendResult.success,
      gatewayNotice: sendResult.error || 'WhatsApp confirmation dispatched successfully',
    });
  } catch (error: any) {
    console.error('[API /api/whatsapp/subscribe] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
