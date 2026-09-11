import { NextResponse } from 'next/server';
import { getGatewayStatus, getSubscribers } from '@/lib/whatsapp-service';

export async function GET() {
  try {
    const status = await getGatewayStatus();
    const subscribers = await getSubscribers();

    return NextResponse.json({
      gateway: status,
      totalSubscribers: subscribers.length,
      activeSubscribers: subscribers.filter((s) => s.isActive).length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      gateway: { online: false, authenticated: false, error: error.message },
      totalSubscribers: 0,
    });
  }
}
