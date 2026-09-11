-- HeatPulse — WhatsApp Alert Subscribers Table
-- Supabase PostgreSQL

CREATE TABLE IF NOT EXISTS whatsapp_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100),
  city_id VARCHAR(50) NOT NULL,
  ward_id VARCHAR(100) NOT NULL,
  ward_name VARCHAR(100) NOT NULL,
  language VARCHAR(10) DEFAULT 'en', -- 'en' | 'hi' | 'mr'
  is_active BOOLEAN DEFAULT true,
  last_alert_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_subscribers_city ON whatsapp_subscribers(city_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_subscribers_ward ON whatsapp_subscribers(ward_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_subscribers_active ON whatsapp_subscribers(is_active) WHERE is_active = true;

ALTER TABLE whatsapp_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read/write access for whatsapp subscribers" 
  ON whatsapp_subscribers FOR ALL USING (true);
