-- HeatPulse — Database Schema
-- Supabase PostgreSQL + PostGIS
-- Project: braiktcmrtvnlwsioxtm
-- Generated: 2026-09-01

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Wards table — administrative boundaries
CREATE TABLE IF NOT EXISTS wards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  ward_number INTEGER,
  centroid geometry(Point, 4326),
  boundary geometry(Polygon, 4326),
  source TEXT NOT NULL,
  source_url TEXT,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Weather readings — stored from Open-Meteo
CREATE TABLE IF NOT EXISTS weather_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  temperature_2m DOUBLE PRECISION,
  relative_humidity DOUBLE PRECISION,
  apparent_temperature DOUBLE PRECISION,
  weather_code INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  forecast_hour TIMESTAMPTZ
);

-- 3. Thermal stress readings
CREATE TABLE IF NOT EXISTS thermal_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
  weather_reading_id UUID REFERENCES weather_readings(id) ON DELETE SET NULL,
  heat_index DOUBLE PRECISION,
  wbgt_estimated DOUBLE PRECISION,
  utc_index DOUBLE PRECISION,
  risk_level TEXT CHECK (risk_level IN ('low', 'moderate', 'high', 'extreme', 'danger')),
  risk_label TEXT,
  recommendations TEXT[],
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Ward risk scores (daily composite)
CREATE TABLE IF NOT EXISTS ward_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id UUID REFERENCES wards(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  thermal_risk TEXT,
  vulnerability_score INTEGER,
  composite_risk INTEGER,
  composite_risk_level TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ward_id, date)
);

-- 5. Heat alerts
CREATE TABLE IF NOT EXISTS heat_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id UUID REFERENCES wards(id) ON DELETE CASCADE,
  alert_level TEXT CHECK (alert_level IN ('watch', 'warning', 'critical')),
  heat_index DOUBLE PRECISION,
  message TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  resolved_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- 6. Indexes
CREATE INDEX idx_weather_readings_ward_id ON weather_readings(ward_id);
CREATE INDEX idx_weather_readings_recorded_at ON weather_readings(recorded_at);
CREATE INDEX idx_weather_readings_forecast_hour ON weather_readings(forecast_hour);
CREATE INDEX idx_thermal_readings_ward_id ON thermal_readings(ward_id);
CREATE INDEX idx_thermal_readings_calculated_at ON thermal_readings(calculated_at);
CREATE INDEX idx_ward_risk_scores_ward_date ON ward_risk_scores(ward_id, date);
CREATE INDEX idx_heat_alerts_ward_id ON heat_alerts(ward_id);
CREATE INDEX idx_heat_alerts_active ON heat_alerts(is_active) WHERE is_active = true;

-- 7. Row Level Security (RLS)
ALTER TABLE wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE thermal_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ward_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE heat_alerts ENABLE ROW LEVEL SECURITY;

-- Public can read all tables
CREATE POLICY "Public read access" ON wards FOR SELECT USING (true);
CREATE POLICY "Public read access" ON weather_readings FOR SELECT USING (true);
CREATE POLICY "Public read access" ON thermal_readings FOR SELECT USING (true);
CREATE POLICY "Public read access" ON ward_risk_scores FOR SELECT USING (true);
CREATE POLICY "Public read access" ON heat_alerts FOR SELECT USING (true);

-- Service role can do everything (handled by Supabase service key)

-- 8. Function: Refresh updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_wards_updated_at BEFORE UPDATE ON wards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_thermal_readings_updated_at BEFORE UPDATE ON thermal_readings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ward_risk_scores_updated_at BEFORE UPDATE ON ward_risk_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Function: Generate daily thermal readings
-- Called by cron to populate the database
CREATE OR REPLACE FUNCTION generate_daily_thermal_readings()
RETURNS void AS $$
DECLARE
  ward RECORD;
  current_hour TIMESTAMPTZ;
BEGIN
  FOR ward IN SELECT id, name, centroid FROM wards LOOP
    -- Insert thermal readings for the current hour
    -- (In production, this would fetch from the weather API)
    NULL; -- Placeholder for cron job implementation
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 10. Seed data: 15 Pune administrative wards
-- Coordinates from data/processed/representative_points.geojson
INSERT INTO wards (name, ward_number, centroid, source, source_url) VALUES
('Admin Ward 01 Aundh', 1, ST_SetSRID(ST_MakePoint(73.794912, 18.546629), 4326), 'datameet', 'https://github.com/datameet/pune_wards'),
('Admin Ward 02 Ghole Road', 2, ST_SetSRID(ST_MakePoint(73.838754, 18.528272), 4326), 'datameet', 'https://github.com/datameet/pune_wards'),
('Admin Ward 03 Kothrud Karveroad', 3, ST_SetSRID(ST_MakePoint(73.791945, 18.507793), 4326), 'datameet', 'https://github.com/datameet/pune_wards'),
('Admin Ward 04 Warje Karvenagar', 4, ST_SetSRID(ST_MakePoint(73.801629, 18.486947), 4326), 'datameet', 'https://github.com/datameet/pune_wards'),
('Admin Ward 05 Dhole Patil Rd', 5, ST_SetSRID(ST_MakePoint(73.901619, 18.524145), 4326), 'datameet', 'https://github.com/datameet/pune_wards'),
('Admin Ward 06 Yerawda - Sangamwadi', 6, ST_SetSRID(ST_MakePoint(73.902004, 18.581501), 4326), 'datameet', 'https://github.com/datameet/pune_wards'),
('Admin Ward 07 Nagar Road', 7, ST_SetSRID(ST_MakePoint(73.920051, 18.558605), 4326), 'datameet', 'https://github.com/datameet/pune_wards'),
('Admin Ward 08 KasbaVishrambaugwada', 8, ST_SetSRID(ST_MakePoint(73.855316, 18.510498), 4326), 'datameet', 'https://github.com/datameet/pune_wards'),
('Admin Ward 09 Tilak Road', 9, ST_SetSRID(ST_MakePoint(73.822011, 18.470012), 4326), 'datameet', 'https://github.com/datameet/pune_wards'),
('Admin Ward 10 Sahakarnagar', 10, ST_SetSRID(ST_MakePoint(73.851231, 18.488732), 4326), 'datameet', 'https://github.com/datameet/pune_wards'),
('Admin Ward 11 Bibwewadi', 11, ST_SetSRID(ST_MakePoint(73.867769, 18.478054), 4326), 'datameet', 'https://github.com/datameet/pune_wards'),
('Admin Ward 12 Bhavani Peth', 12, ST_SetSRID(ST_MakePoint(73.867657, 18.511321), 4326), 'datameet', 'https://github.com/datameet/pune_wards'),
('Admin Ward 13 Hadapsar', 13, ST_SetSRID(ST_MakePoint(73.924187, 18.483092), 4326), 'datameet', 'https://github.com/datameet/pune_wards'),
('Admin Ward 14 Dhankawadi', 14, ST_SetSRID(ST_MakePoint(73.858523, 18.446191), 4326), 'datameet', 'https://github.com/datameet/pune_wards'),
('Admin Ward 15 Kondhwa Wanavdi', 15, ST_SetSRID(ST_MakePoint(73.896593, 18.483268), 4326), 'datameet', 'https://github.com/datameet/pune_wards')
ON CONFLICT (name) DO NOTHING;
