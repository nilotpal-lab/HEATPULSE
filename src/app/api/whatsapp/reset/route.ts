import { NextResponse } from 'next/server';
import { resetGatewaySession } from '@/lib/whatsapp-service';

export async function POST() {
  try {
    const result = await resetGatewaySession();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await resetGatewaySession();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
