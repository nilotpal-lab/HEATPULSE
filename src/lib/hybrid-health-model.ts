export type HealthLabelSource = 'observed' | 'estimated' | 'unknown';

export interface NationalMortalityPrior {
  country: string;
  year: number;
  crudeDeathRatePerThousand: number;
  source: string;
  sourceUrl: string;
}

export interface RegionalHealthObservation {
  locationId: string;
  locationLevel: 'state' | 'district' | 'city' | 'ward';
  date: string;
  observedOutcome: number;
  outcomeType: 'hospitalization' | 'mortality' | 'heat_illness';
  source: string;
  labelSource: HealthLabelSource;
}

export interface WardExposureFeatures {
  wardId: string;
  date: string;
  forecastIssueTime: string;
  forecastHorizonDays: number;
  population: number;
  heatIndex: number;
  wbgt: number;
  utciProxy: number;
  vulnerabilityScore: number;
}

export interface HybridTrainingRow extends WardExposureFeatures {
  regionalLocationId: string;
  observedOutcome: number;
  outcomeType: RegionalHealthObservation['outcomeType'];
  labelSource: 'observed';
  nationalPriorRatePerThousand: number;
  nationalPriorSource: string;
}

export interface TrainingReadiness {
  ready: boolean;
  errors: string[];
  warnings: string[];
}

export function validateHybridTrainingRows(rows: HybridTrainingRow[]): TrainingReadiness {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (rows.length === 0) {
    errors.push('No training rows were supplied.');
    return { ready: false, errors, warnings };
  }

  for (const [index, row] of rows.entries()) {
    if (row.labelSource !== 'observed') {
      errors.push(`Row ${index} has a non-observed health label.`);
    }
    if (!row.regionalLocationId) {
      errors.push(`Row ${index} is missing a regional health location.`);
    }
    if (!Number.isFinite(row.observedOutcome) || row.observedOutcome < 0) {
      errors.push(`Row ${index} has an invalid observed health outcome.`);
    }
    if (!Number.isFinite(row.nationalPriorRatePerThousand) || row.nationalPriorRatePerThousand < 0) {
      errors.push(`Row ${index} has an invalid national prior rate.`);
    }
    if (row.forecastHorizonDays < 1 || row.forecastHorizonDays > 5) {
      errors.push(`Row ${index} has a forecast horizon outside the supported 1-5 day range.`);
    }
  }

  const locations = new Set(rows.map((row) => row.regionalLocationId));
  if (locations.size < 2) {
    warnings.push('Only one regional location is present; spatial generalization cannot be evaluated.');
  }

  const dates = new Set(rows.map((row) => row.date));
  if (dates.size < 30) {
    warnings.push('Fewer than 30 dates are present; temporal validation will be weak.');
  }

  return { ready: errors.length === 0, errors, warnings };
}

export function annualPriorToDailyWardBaseline(
  population: number,
  prior: NationalMortalityPrior,
): number {
  if (!Number.isFinite(population) || population < 0) {
    throw new Error('Population must be a non-negative finite number.');
  }
  if (!Number.isFinite(prior.crudeDeathRatePerThousand) || prior.crudeDeathRatePerThousand < 0) {
    throw new Error('National mortality prior must be a non-negative finite rate.');
  }

  // This is a prior baseline only. It is never an observed ward mortality label.
  return (population * prior.crudeDeathRatePerThousand) / 1000 / 365;
}