# Hybrid Health Model Contract

## Purpose

HeatPulse may combine national mortality estimates with regional observed health
outcomes and ward-level exposure features. This is a hierarchical downscaling
design, not a method for converting national rates into observed ward deaths.

## Data roles

| Data | Role | Allowed as training target? |
| --- | --- | --- |
| WHO or World Bank national mortality rate | Annual prior or baseline constraint | No |
| State, district, city, hospital, or surveillance records | Observed regional health outcome | Yes, when provenance is documented |
| Ward weather and thermal stress | Exposure features | No |
| Census, NFHS, land, infrastructure data | Vulnerability features | No |

National mortality is used only to establish a population-scaled prior baseline:

```text
daily_prior = population × annual_rate_per_1000 / 1000 / 365
```

This value is explicitly a model prior. It must never be written to an observed
mortality target column or displayed as measured ward mortality.

## Required training row

Each row must contain:

- ward identifier and date
- forecast issue time and horizon from 1 to 5 days
- heat index, WBGT, UTCI proxy, and vulnerability features
- parent state, district, or city health location
- observed health outcome and its source
- national prior rate and source metadata
- `label_source = observed`

Rows with estimated, national-only, or missing health labels are rejected by the
training-readiness validator.

## Validation requirements

- Time-based train/validation/test split
- Held-out regional locations for spatial generalization
- No random row split
- Classification metrics: PR-AUC, recall, precision, F1, Brier score
- Regression metrics: MAE, RMSE, and calibration checks
- Prediction intervals or uncertainty bounds for ward outputs

Until verified regional health observations are available, the model remains
blocked. The existing thermal-vulnerability score is not a health-outcome model.