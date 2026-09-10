/**
 * HeatPulse — District Heat Warning Evaluation (IMD-criteria based)
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 *
 * Honest provenance: this module does NOT fetch or relay IMD bulletins. IMD does
 * not expose a public warning API consumed here. HeatPulse applies IMD's published
 * heat-wave criteria (Maximum Temperature and departure-from-normal thresholds) to
 * locally-fetched NWP forecast data and evaluates the resulting alert color locally.
 *
 * Segregation:
 * - District-scale evaluation: this module (IMD criteria applied to NWP forecasts).
 * - Ward-localized thermal advisories: computed separately per ward centroid.
 * The output is a HeatPulse evaluation PARAPHRASING IMD criteria — it is NOT an
 * official IMD-issued product, and is labeled as such in `authority` / `disclaimer`.
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
  /**
   * Local computation timestamp — explicitly NOT an IMD issuance time.
   * Renamed from issued_at so it can never be mistaken for bulletin metadata.
   */
  computed_at: string;
  scope: 'District';
  disclaimer: string;
  /** true when a real forecast Tmax was evaluated; false = no input data. */
  has_forecast_input: boolean;
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

// Authority / disclaimer are HONEST: HeatPulse evaluates IMD's published criteria
// against local NWP data. The IMD itself has not issued these — no official
// integration claim is made anywhere.
const AUTHORITY_STRING =
  'HeatPulse local evaluation applying India Meteorological Department (IMD) published heat-wave criteria — not an IMD-issued product';
const DISCLAIMER_STRING =
  'This district heat evaluation is computed locally by HeatPulse from numerical weather forecast data using IMD’s published heat-wave threshold criteria. It is NOT an official IMD / MoES bulletin. For official warnings, refer to IMD / MoES channels directly.';

/**
 * Evaluates district-level heat warning color by applying IMD's published criteria
 * to a locally-provided temperature (observed or forecast). Output is labeled as a
 * HeatPulse evaluation — not an official IMD-issued warning.
 *
 * Criteria for Indian Plains / Inland:
 * - Heat Wave: Tmax >= 40°C and departure >= 4.5°C; or actual Tmax >= 45°C.
 * - Severe Heat Wave: Tmax >= 40°C and departure >= 6.5°C; or actual Tmax >= 47°C.
 *
 * Criteria for Coastal Stations:
 * - Heat Wave: Tmax >= 37°C and departure >= 4.5°C.
 * - Severe Heat Wave: Tmax >= 37°C and departure >= 6.5°C.
 *
 * NOTE: `normalTmax` values are climatological-reference constants supplied by
 * HeatPulse (no live IMD normals API). They may drift from IMD's current normals.
 */
export function evaluateImdDistrictWarning(
  cityId: string,
  observedOrForecastTmax?: number
): ImdDistrictWarning {
  const normCity = (cityId || 'bengaluru').toLowerCase().trim();
  const district = MONITORED_DISTRICTS[normCity] ?? MONITORED_DISTRICTS['bengaluru'];

  const normal = district.normalTmax;
  const hasInput =
    typeof observedOrForecastTmax === 'number' && !isNaN(observedOrForecastTmax);
  const tmax = hasInput ? (observedOrForecastTmax as number) : normal;
  const departure = Math.round((tmax - normal) * 10) / 10;

  // No-data path: never substitute the climatological normal as if it were a
  // real forecast reading and produce a confident color. The evaluation is
  // marked as having no forecast input so the UI can render "unavailable".
  if (!hasInput) {
    return {
      district_name: district.districtName,
      city_id: district.cityId,
      state: district.state,
      color_code: 'GREEN',
      action_level: 'No Warning',
      headline: `Assessment unavailable for ${district.districtName} District — no forecast temperature input`,
      warning_description:
        'HeatPulse could not evaluate IMD heat-wave criteria because no forecast maximum temperature was available for this district.',
      criteria_citation:
        'IMD Standard Criteria: evaluation requires a forecast Tmax and climatological normal.',
      climatological_normal_tmax: normal,
      forecast_tmax: undefined,
      departure: undefined,
      authority: AUTHORITY_STRING,
      computed_at: new Date().toISOString(),
      scope: 'District',
      disclaimer: DISCLAIMER_STRING,
      has_forecast_input: false,
    };
  }

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
    computed_at: new Date().toISOString(),
    scope: 'District',
    disclaimer: DISCLAIMER_STRING,
    has_forecast_input: true,
  };
}

/**
 * Retrieves HeatPulse IMD-criteria evaluations for all 6 monitored city districts.
 * A city without a forecast temperature (absent key) evaluates to the explicit
 * "no forecast input" unavailable assessment — never a substituted normal.
 */
export function getAllImdDistrictWarnings(
  cityTemps?: Record<string, number | undefined>
): Record<string, ImdDistrictWarning> {
  const result: Record<string, ImdDistrictWarning> = {};
  for (const cityId of Object.keys(MONITORED_DISTRICTS)) {
    const tmax = cityTemps?.[cityId];
    result[cityId] = evaluateImdDistrictWarning(
      cityId,
      typeof tmax === 'number' && Number.isFinite(tmax) ? tmax : undefined
    );
  }
  return result;
}
