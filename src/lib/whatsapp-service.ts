/**
 * HeatPulse — WhatsApp Alert & Signal Service
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 */

import fs from 'fs';
import path from 'path';

export interface WhatsAppSubscriber {
  id: string;
  phone: string;
  name?: string;
  cityId: string;
  wardId: string;
  wardName: string;
  language: 'en' | 'hi' | 'mr';
  isActive: boolean;
  createdAt: string;
  lastAlertSentAt?: string;
}

const SUBSCRIBERS_FILE = path.join(process.cwd(), 'data', 'whatsapp_subscribers.json');
const GATEWAY_URL = process.env.WHATSAPP_GATEWAY_URL || 'http://127.0.0.1:3001';

/**
 * Ensure storage directory and file exist
 */
function ensureStorage(): void {
  const dir = path.dirname(SUBSCRIBERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(SUBSCRIBERS_FILE)) {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

/**
 * Clean phone number to E.164 format without '+' or spaces (e.g. 919876543210)
 */
export function sanitizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^\d]/g, '');
  // If 10 digits (Indian mobile without prefix), prepend 91
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

/**
 * Retrieve all active subscribers
 */
export async function getSubscribers(): Promise<WhatsAppSubscriber[]> {
  ensureStorage();
  try {
    const raw = fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8');
    return JSON.parse(raw) as WhatsAppSubscriber[];
  } catch (error) {
    console.error('[WhatsApp Service] Error reading subscribers file:', error);
    return [];
  }
}

/**
 * Add or update a subscriber
 */
export async function saveSubscriber(sub: Omit<WhatsAppSubscriber, 'id' | 'createdAt' | 'isActive'>): Promise<WhatsAppSubscriber> {
  ensureStorage();
  const subscribers = await getSubscribers();
  const phone = sanitizePhoneNumber(sub.phone);

  const existingIndex = subscribers.findIndex((s) => s.phone === phone);
  
  const record: WhatsAppSubscriber = {
    id: existingIndex >= 0 ? subscribers[existingIndex].id : `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    phone,
    name: sub.name || 'Citizen',
    cityId: sub.cityId,
    wardId: sub.wardId,
    wardName: sub.wardName,
    language: sub.language || 'en',
    isActive: true,
    createdAt: existingIndex >= 0 ? subscribers[existingIndex].createdAt : new Date().toISOString(),
    lastAlertSentAt: existingIndex >= 0 ? subscribers[existingIndex].lastAlertSentAt : undefined,
  };

  if (existingIndex >= 0) {
    subscribers[existingIndex] = record;
  } else {
    subscribers.push(record);
  }

  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2), 'utf-8');
  return record;
}

/**
 * Send WhatsApp message through the local gateway service
 */
export async function sendWhatsAppDirect(phone: string, text: string): Promise<{ success: boolean; error?: string }> {
  const sanitized = sanitizePhoneNumber(phone);
  try {
    const res = await fetch(`${GATEWAY_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: sanitized, text }),
      // Timeout after 4 seconds
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const json = await res.json();
      return { success: json.success ?? true };
    } else {
      const errText = await res.text();
      return { success: false, error: `Gateway response ${res.status}: ${errText}` };
    }
  } catch (error: any) {
    console.warn(`[WhatsApp Service] Gateway not reachable on ${GATEWAY_URL} (${error.message}). Message recorded for simulation.`);
    return { success: false, error: 'Gateway offline. Start it with `npm run whatsapp`.' };
  }
}

/**
 * Check if the WhatsApp Gateway daemon is running and connected
 */
export async function getGatewayStatus(): Promise<{ online: boolean; authenticated: boolean; user?: string; qr?: string; error?: string }> {
  try {
    const res = await fetch(`${GATEWAY_URL}/status`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      return await res.json();
    }
    return { online: false, authenticated: false, error: `HTTP ${res.status}` };
  } catch (error: any) {
    return { online: false, authenticated: false, error: 'WhatsApp Gateway not running (run `npm run whatsapp`)' };
  }
}

/**
 * Reset WhatsApp Gateway auth session and trigger fresh QR code generation
 */
export async function resetGatewaySession(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${GATEWAY_URL}/reset`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      return await res.json();
    }
    return { success: false, error: `Gateway response ${res.status}` };
  } catch (error: any) {
    return { success: false, error: `Gateway not reachable: ${error.message}` };
  }
}

/**
 * Message Templates
 */

export function buildWelcomeMessage(subscriber: WhatsAppSubscriber): string {
  return `🚨 *HeatPulse — Thermal Alert Registration Confirmed* 🌡️

Hello *${subscriber.name || 'Citizen'}*,
You are now registered for real-time biometeorological heatwave warnings for:

📍 *Ward:* ${subscriber.wardName}
🏙️ *City:* ${subscriber.cityId.toUpperCase()}

━━━━━━━━━━━━━━━━━━━
✨ *What you will receive:*
• Instant early warnings when Heat Index exceeds *40°C*
• Wet Bulb Globe Temperature (WBGT) stress advisories
• Ward-specific hydration & municipal cooling guidance

💡 *Interactive Chat Commands:*
Send any of these to this number anytime:
• \`STATUS\` - Check your ward's current heat index
• \`HEAT PUNE\` - Live city summary
• \`COOLING\` - Find nearest water points & shelters

Stay hydrated and heat-safe!
_Powered by MoES / NCMRWF Biometeorological Decision Model_`;
}

export function buildHeatAlertMessage(data: {
  wardName: string;
  city: string;
  level: 'watch' | 'warning' | 'critical';
  heatIndex: number;
  wbgt: number;
  temperature: number;
  humidity: number;
  recommendations: string[];
}): string {
  const emoji = data.level === 'critical' ? '🔴 *CRITICAL HEAT EMERGENCY*' : data.level === 'warning' ? '🟠 *HEATWAVE WARNING*' : '🟡 *HEAT WATCH ADVISORY*';

  const recs = data.recommendations.map((r) => `• ${r}`).join('\n');

  return `${emoji}
📍 *Ward:* ${data.wardName} (${data.city.toUpperCase()})
⏰ *Issued:* ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST

━━━━━━━━━━━━━━━━━━━
🌡️ *Thermal Readings:*
• *Heat Index (Feels Like):* ${data.heatIndex.toFixed(1)}°C
• *Air Temperature:* ${data.temperature.toFixed(1)}°C
• *Relative Humidity:* ${data.humidity.toFixed(0)}%
• *WBGT Index:* ${data.wbgt.toFixed(1)}°C

⚠️ *Public Health Advisory:*
${recs || '• Drink ORS/water every 20 mins\n• Avoid direct sun between 12:00 - 15:30\n• Check on elderly and outdoor workers'}

🏥 *Emergency Help:* Dial 108 for medical heatstroke assistance.
_HeatPulse Early Warning System_`;
}
