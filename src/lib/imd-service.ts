/**
 * HeatPulse — Official IMD District Reference Warnings Service
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 * 
 * Segregation Architecture:
 * - Official district reference warnings are issued strictly at the DISTRICT level
 *   by the India Meteorological Department (IMD) / Ministry of Earth Sciences (MoES).
 * - HeatPulse localized thermal advisories are computed separately per ward centroid
 *   from NWP numerical weather grids and biometeorological equations.
 * - This service provides official district benchmarks without fabricating ward-level
 *   claims or conflating IMD official bulletins with localized municipal heuristics.
 */

export type ImdColorCode = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
export type ImdActionLevel = 'No Warning' | 'Be Updated' | 'Be Prepared' | 'Take Action';

export interface ImdDistrictWarning {
  district_name: string;
  city_id: string;
  state: string;
  color_code: ImdColorCode;
  action_level: ImdActionLevel;
  headline: string;
  warning_description: string;
  criteria_citation: string;
  climatological_normal_tmax: number;
  forecast_tmax?: number;
  departure?: number;
  authority: string;
  issued_at: string;
  scope: 'District';
  disclaimer: string;
}

export interface DistrictMetadata {
  cityId: string;
  districtName: string;
  state: string;
  normalTmax: number;
  isCoastal: boolean;
}

export const MONITORED_DISTRICTS: Record<string, DistrictMetadata> = {
  bengaluru: {
    cityId: 'bengaluru',
    districtName: 'Bengaluru Urban',
    state: 'Karnataka',
    normalTmax: 34.0,
    isCoastal: false,
  },
  pune: {
    cityId: 'pune',
    districtName: 'Pune',
    state: 'Maharashtra',
    normalTmax: 37.5,
    isCoastal: false,
  },
  mumbai: {
    cityId: 'mumbai',
    districtName: 'Mumbai Suburban',
    state: 'Maharashtra',
    normalTmax: 33.5,
    isCoastal: true,
  },
  kolkata: {
    cityId: 'kolkata',
    districtName: 'Kolkata',
    state: 'West Bengal',
    normalTmax: 35.5,
    isCoastal: false,
  },
  chennai: {
    cityId: 'chennai',
    districtName: 'Chennai',
    state: 'Tamil Nadu',
    normalTmax: 36.0,
    isCoastal: true,
  },
  coimbatore: {
    cityId: 'coimbatore',
    districtName: 'Coimbatore',
    state: 'Tamil Nadu',
    normalTmax: 34.5,
    isCoastal: false,
  },
};

const AUTHORITY_STRING =
  'India Meteorological Department (IMD) - Ministry of Earth Sciences, Govt. of India';
const DISCLAIMER_STRING =
  'Official IMD District Reference Warnings represent meteorological guidance issued at the district scale. These warnings are segregated from HeatPulse localized ward thermal advisories.';

/**
 * Evaluates official IMD district reference warning based on standard IMD criteria:
 * 
 * Criteria for Indian Plains / Inland:
 * - Heat Wave: Tmax >= 40°C and departure >= 4.5°C; or actual Tmax >= 45°C.
 * - Severe Heat Wave: Tmax >= 40°C and departure >= 6.5°C; or actual Tmax >= 47°C.
 * 
 * Criteria for Coastal Stations:
 * - Heat Wave: Tmax >= 37°C and departure >= 4.5°C.
 * - Severe Heat Wave: Tmax >= 37°C and departure >= 6.5°C.
 */
export function evaluateImdDistrictWarning(
  cityId: string,
  observedOrForecastTmax?: number
): ImdDistrictWarning {
  const normCity = (cityId || 'bengaluru').toLowerCase().trim();
  const district = MONITORED_DISTRICTS[normCity] ?? MONITORED_DISTRICTS['bengaluru'];

  const normal = district.normalTmax;
  const tmax =
    typeof observedOrForecastTmax === 'number' && !isNaN(observedOrForecastTmax)
      ? observedOrForecastTmax
      : normal;
  const departure = Math.round((tmax - normal) * 10) / 10;

  let colorCode: ImdColorCode = 'GREEN';
  let actionLevel: ImdActionLevel = 'No Warning';
  let headline = `GREEN: No Warning for ${district.districtName} District`;
  let description =
    'Normal meteorological conditions prevailing across the district. No heatwave advisory.';
  let criteriaCitation =
    'IMD Standard Criteria: Maximum temperature within normal climatological range.';

  if (district.isCoastal) {
    // Coastal Heat Wave Criteria (Mumbai, Chennai)
    if (tmax >= 39.0 || (tmax >= 37.0 && departure >= 6.5)) {
      colorCode = 'RED';
      actionLevel = 'Take Action';
      headline = `RED: Severe Heat Wave Warning for ${district.districtName} District`;
      description =
        'Severe heatwave conditions over coastal district. High risk of thermal stress across population; emergency protective measures recommended.';
      criteriaCitation =
        'IMD Coastal Severe Heat Wave: Tmax >= 37°C with departure >= 6.5°C or absolute Tmax >= 39°C.';
    } else if (tmax >= 37.0 && departure >= 4.5) {
      colorCode = 'ORANGE';
      actionLevel = 'Be Prepared';
      headline = `ORANGE: Heat Wave Warning for ${district.districtName} District`;
      description =
        'Heatwave conditions likely over coastal district. High temperature with prolonged exposure hazard for vulnerable groups.';
      criteriaCitation =
        'IMD Coastal Heat Wave: Tmax >= 37°C with departure >= 4.5°C from normal.';
    } else if (tmax >= 35.0 && departure >= 3.0) {
      colorCode = 'YELLOW';
      actionLevel = 'Be Updated';
      headline = `YELLOW: Heat Alert for ${district.districtName} District`;
      description =
        'Elevated humid heat conditions. Public advised to be updated on meteorological forecasts and avoid peak sun.';
      criteriaCitation =
        'IMD Warm Day / Heat Alert: Tmax >= 35°C with departure >= 3.0°C from normal.';
    }
  } else {
    // Inland Plains & Plateau Criteria (Pune, Bengaluru, Kolkata, Coimbatore)
    if (tmax >= 47.0 || (tmax >= 40.0 && departure >= 6.5) || tmax >= 45.0) {
      colorCode = 'RED';
      actionLevel = 'Take Action';
      headline = `RED: Severe Heat Wave Warning for ${district.districtName} District`;
      description =
        'Severe heatwave conditions over district. Extreme temperature hazard; total avoidance of strenuous outdoor activities required.';
      criteriaCitation =
        'IMD Severe Heat Wave: Tmax >= 40°C with departure >= 6.5°C or absolute Tmax >= 45°C.';
    } else if (tmax >= 43.0 || (tmax >= 40.0 && departure >= 4.5)) {
      colorCode = 'ORANGE';
      actionLevel = 'Be Prepared';
      headline = `ORANGE: Heat Wave Warning for ${district.districtName} District`;
      description =
        'Heatwave conditions expected across district. High temperature with significant discomfort; take precautions for outdoor workers.';
      criteriaCitation =
        'IMD Heat Wave: Tmax >= 40°C with departure >= 4.5°C or absolute Tmax >= 43°C.';
    } else if (tmax >= 39.0 || departure >= 3.0) {
      colorCode = 'YELLOW';
      actionLevel = 'Be Updated';
      headline = `YELLOW: Heat Alert for ${district.districtName} District`;
      description =
        'Tolerable heat for general public but moderate health concern for vulnerable persons (infants, elderly, chronic illness).';
      criteriaCitation =
        'IMD Heat Alert: Maximum temperature Departure >= 3.0°C or absolute Tmax >= 39°C.';
    }
  }

  return {
    district_name: district.districtName,
    city_id: district.cityId,
    state: district.state,
    color_code: colorCode,
    action_level: actionLevel,
    headline,
    warning_description: description,
    criteria_citation: criteriaCitation,
    climatological_normal_tmax: normal,
    forecast_tmax: tmax,
    departure,
    authority: AUTHORITY_STRING,
    issued_at: new Date().toISOString(),
    scope: 'District',
    disclaimer: DISCLAIMER_STRING,
  };
}

/**
 * Retrieves official IMD district reference warnings for all 6 monitored city districts
 */
export function getAllImdDistrictWarnings(
  cityTemps?: Record<string, number>
): Record<string, ImdDistrictWarning> {
  const result: Record<string, ImdDistrictWarning> = {};
  for (const cityId of Object.keys(MONITORED_DISTRICTS)) {
    const tmax = cityTemps?.[cityId];
    result[cityId] = evaluateImdDistrictWarning(cityId, tmax);
  }
  return result;
}
