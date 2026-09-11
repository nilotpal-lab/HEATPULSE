/**
 * HeatPulse — Weather Data Types & Interface Contracts
 * Conforms to PROJECT.md § Interface Contracts (Weather Pipeline ↔ Thermal Engine)
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 */

export type ForecastStatus = 'fresh' | 'stale' | 'unavailable';

/**
 * Metadata capturing NWP model initialization cycle vs valid target time
 * and operational query provenance.
 */
export interface ForecastRunMetadata {
  run_time: string; // ISO UTC, model run initialization (e.g. 00Z, 06Z, 12Z, 18Z)
  fetched_at: string; // ISO UTC, when server queried provider
  valid_time: string; // ISO UTC or IST string, current forecast hour
  provider: string; // 'Open-Meteo NWP Grid'
  model: string; // e.g. 'ECMWF IFS / GFS Seamless'
  status: ForecastStatus;
  attribution: string; // "Ward-localized forecast derived from numerical weather prediction"
}

/**
 * Hourly meteorological variables across 120 forecast hours (5 days)
 */
export interface WardHourlyWeather {
  time: string[]; // ISO strings (120 hours)
  temperature_2m: number[]; // °C
  relative_humidity_2m: number[]; // %
  apparent_temperature: number[]; // °C (UTCI Proxy)
  wind_speed_10m?: number[]; // km/h
  direct_normal_irradiance?: number[]; // W/m²
  shortwave_radiation?: number[]; // W/m² global horizontal (Liljegren solar input)
  surface_pressure?: number[]; // hPa
  weather_code?: number[];
}

/**
 * Current reading for the active forecast hour
 */
export interface WardCurrentWeather {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  wind_speed_10m?: number;
  direct_normal_irradiance?: number;
  shortwave_radiation?: number;
  surface_pressure?: number;
  weather_code?: number;
}

/**
 * Complete ward-level weather forecast
 */
export interface WardWeatherForecast {
  ward_id: string;
  ward_name: string;
  city_id: string;
  centroid: [number, number]; // [lon, lat] in EPSG:4326
  elevation?: number;
  current: WardCurrentWeather;
  hourly: WardHourlyWeather;
  metadata: ForecastRunMetadata;
  attribution: string;
}

/**
 * Complete city-wide multi-ward forecast run stored in persistent cache
 */
export interface CityForecastRun {
  city_id: string;
  run_time: string; // NWP cycle
  fetched_at: string;
  metadata: ForecastRunMetadata;
  wards: Record<string, WardWeatherForecast>;
  cached_at: number; // epoch ms
  expires_at: number; // epoch ms
}

/**
 * Legacy-compatible types for backward compatibility across existing endpoints
 */
export interface HourlyWeather {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  weather_code: number;
  wind_speed_10m?: number;
  direct_normal_irradiance?: number;
  shortwave_radiation?: number;
  surface_pressure?: number;
}

export interface DailyWeather {
  time: string;
  temperature_2m_max: number;
  temperature_2m_min: number;
  weather_code: number;
}

export interface WeatherForecast {
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  hourly: HourlyWeather[];
  daily: DailyWeather[];
  generated_at: string;
  metadata?: ForecastRunMetadata;
  attribution?: string;
}
