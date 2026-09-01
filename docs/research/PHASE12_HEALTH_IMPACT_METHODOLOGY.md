# Phase 12: Health Impact Prediction Methodology

**Date**: 2026-09-02
**Status**: Phase 12 — Methodology Documentation

---

## Objective

Document the scientific methodology for heat-health impact prediction. This is a
**research framework** — not a clinical diagnostic tool. All predictions are
statistical associations, not medical advice.

---

## Thermal Stress Indices Used

### 1. Heat Index (HI) — Rothfusz Regression
**Formula**: Empirical equation from NOAA / NWS
**Valid for**: T ≥ 27°C, RH ≥ 40%
**Application**: General population risk assessment

```
HI = -8.7846947 + 1.61139411·T + 2.338549·R - 0.14611605·T·R
     - 0.012308094·T² - 0.016424828·R² + 0.002211732·T²·R
     + 0.00072546·T·R² - 0.000003582·T²·R²
```

### 2. Wet Bulb Globe Temperature (WBGT) — Simplified Outdoor
**Formula**: Nolet & Brown (1973), adapted for India
**Valid for**: Outdoor conditions, sunny exposure
**Application**: Occupational heat stress (workers)

```
WBGT = 0.567·T + 0.393·e + 3.94
where e = vapor pressure (hPa) = (RH/100) × 0.6108 × exp(17.27·T/(237.3+T)) × 10
```

### 3. Universal Thermal Climate Index (UTCI) — Simplified
**Approximation**: Apparent temperature from Open-Meteo
**Note**: Full UTCI requires radiation, wind speed, humidity — approximated
here as apparent temperature for operational simplicity.

---

## Risk Classification Framework

### Thermal Risk (HI-based)

| HI (°C) | Risk Level | Health Impact |
|---|---|---|
| < 27 | Low | Normal outdoor activity safe |
| 27–32 | Moderate | Some discomfort; prolonged outdoor exertion possible |
| 32–41 | High | Fatigue possible; heat cramps/heat exhaustion likely |
| 41–54 | Extreme | Heat stroke likely; life-threatening |
| ≥ 54 | Danger | Heat stroke imminent; life-threatening |

### Composite Risk (Thermal + Vulnerability)

| Score | Level | Action |
|---|---|---|
| 0–30 | Low | Monitor |
| 31–50 | Moderate | Precautionary measures |
| 51–70 | High | Activate cooling centers |
| 71–100 | Extreme | Emergency response |

---

## Vulnerability Modifiers

The composite risk model adjusts thermal exposure by ward-level vulnerability:

```
compositeRisk = 0.6 × thermalScore + 0.4 × vulnerabilityScore
```

### Vulnerability Factors

| Factor | Description | Data Source |
|---|---|---|
| Green space scarcity | Lack of trees/shade → urban heat island | PMC green cover, NDVI |
| Building density | Impervious surfaces → heat retention | Census built-up area |
| Outdoor worker density | Exposure duration | PLFS, PMC vendor data |
| Elderly population | Physiological vulnerability | Census 2011 age distribution |
| Low-income housing | AC access, building quality | NFHS-5, census housing |

---

## Prediction Limitations

### What We CAN Say
- Current heat stress conditions in each ward
- 3–5 day thermal risk trajectory
- Relative risk ranking across wards
- Population groups most affected (by vulnerability proxy)

### What We CANNOT Say
- Exact number of heat-related illnesses
- Individual health outcomes
- Causal attribution of specific events
- Clinical diagnosis or treatment advice

### Disclaimer

> This system provides **early warning** based on meteorological and
> demographic indicators. It is NOT a medical device. Health impact
> predictions are statistical associations, not diagnoses. Always consult
> healthcare professionals for medical advice.

---

## Research References

1. **Rothfusz, L.P. (1990)** — The Heat Index "Equation" (or: Why Muggles Fail to
   Explain the Heat Index). NWS Southern Region Headquarters, Fort Worth, TX.
2. **Nolet, G.E., Brown, R.P. (1973)** — A simplified method for determining
   wet-bulb globe temperature. USAERSDEC Technical Note 73-8.
3. **Stanforth, J. et al. (2018)** — Heat-related illness and mortality among
   construction workers in India. Occupational and Environmental Medicine.
4. **McGregor, G. et al. (2016)** — The Universal Thermal Climate Index (UTCI):
   a international standard for thermal comfort assessment. International Journal
   of Biometeorology.
5. **PMC Pune (2018)** — Heat Action Plan for Pune City.
6. **IMD (2019)** — Heat Health Warning System guidelines for India.

---

## Output Format

```json
{
  "ward": "Admin Ward 02 Ghole Road",
  "heat_index": 38.5,
  "wbgt": 28.3,
  "utc_index": 36.0,
  "thermal_risk_level": "high",
  "vulnerability_score": 82,
  "composite_risk": 58,
  "composite_risk_level": "high",
  "recommendations": [
    "Activate cooling centers in this ward.",
    "Deploy water and shade stations for outdoor workers.",
    "High vulnerability — prioritize elderly and low-income residents."
  ]
}
```
