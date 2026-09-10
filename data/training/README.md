# Hybrid Health Training Data

This directory is reserved for reviewed training data. No health-outcome data is
currently included.

## Required sources

- National mortality rate: prior only, with source URL and year
- Regional observed health outcomes: required target, with provenance
- Ward exposure features: forecast issue time, horizon, heat index, WBGT, and
  UTCI proxy
- Ward vulnerability features: population, age, worker, infrastructure, and
  environmental variables with source metadata

## Required target rule

Every health target must have `label_source=observed`. WHO or World Bank national
estimates must never be copied into an observed ward target column.

Training is blocked until the dataset contains verified regional observations and
supports both time-based and held-out-region validation.

## Non-clinical benchmark

`nasa-power-state-daily.jsonl` and `nasa-power-thermal-model.json` are a separate
weather/thermal benchmark built from NASA POWER daily data for 36 state-capital
sampling points from 2000 through 2024. Its target is a derived thermal-stress
band, not an observed health outcome. Its accuracy must not be reported as
 mortality, hospitalization, or clinical-model performance.