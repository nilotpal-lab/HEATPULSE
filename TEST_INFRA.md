# HeatPulse Test Infrastructure Specification

**Standard**: SIH26083 Master Build Specification (MoES / NCMRWF)  
**Version**: 1.0.0  
**Maintainer**: Teamwork E2E Test Writer (`test_writer_e2e`)  
**Scope**: Verification & Quality Assurance across all 55 sections of HeatPulse  

---

## 1. Executive Overview

The HeatPulse test infrastructure provides automated, deterministic, and adversarial verification for an India-focused extreme-heat early-warning and human thermal-stress decision-support system. It guarantees mathematical precision, spatial fidelity across 849 municipal wards in 6 major Indian metropolitan corporations, strict scientific concept segregation, and zero fake machine learning or synthetic casualty claims.

### Core Testing Pillars:
1. **Deterministic GIS & Spatial Validation**: 48 automated geometric, topological, coordinate-ordering, and centroid checks across all 849 municipal wards.
2. **Scientific & Data-Truth Assertions**: 15 rigorous assertion checks auditing algorithms, biometeorological formulations (NOAA Rothfusz HI, BoM WBGT, UTCI Proxy), scaling factors, and eliminating deceptive claims.
3. **Progressive Testability**: Self-contained test harnesses designed to run natively via Node.js without heavy external runners, providing crystal-clear diagnostics as milestones progress.
4. **Adversarial Hardening**: Stress tests targeting coordinate inversion, malformed geometry collections, unclosed polygon rings, floating-point NaN centroids, thermal score deflation bugs, and mock data leakage.

---

## 2. Test Runner & Execution Commands

The test suite runs natively on Node.js (ESM) with zero third-party testing framework dependencies, ensuring fast, cross-platform execution on Windows, Linux, and macOS.

### Primary Runner Commands

| Target | Command | Purpose |
|---|---|---|
| **Run All Test Suites** | `node tests/run-all.mjs` | Runs both GIS Validation (48 checks) and Data-Truth (15 checks) suites; exits `0` on pass, `1` on failure. |
| **Tier 1: GIS Validation Only** | `node tests/gis/gis-validation.test.mjs` | Executes the 48 deterministic GIS checks across 849 municipal wards. |
| **Tier 2: Data-Truth Only** | `node tests/data-truth/data-truth.test.mjs` | Executes the 15 scientific honesty and formula accuracy assertion checks. |
| **Node Native Test Runner** | `node --test tests/gis/gis-validation.test.mjs tests/data-truth/data-truth.test.mjs` | Runs test files using Node's built-in test runner. |
| **NPM Script (Project Root)** | `npm run test:e2e` | Convenience script invoking `node tests/run-all.mjs`. |

---

## 3. Test Tiers & Coverage Hierarchy

```
tests/
├── gis/
│   └── gis-validation.test.mjs       # Tier 1: 48 deterministic GIS checks (849 wards)
├── data-truth/
│   └── data-truth.test.mjs           # Tier 2: 15 Data-Truth & scientific formula assertions
├── unit/                             # Tier 3: Biometeorological & algorithmic unit tests
├── browser/                          # Tier 4: Playwright E2E browser & map journey tests
└── run-all.mjs                       # Unified master test harness runner
```

### Tier 1: Deterministic GIS Validation Suite (48 Checks)
Validates RFC 7946 compliance, geometry health, coordinate ordering, unique identifiers, and deterministic centroid validity across all 6 operational cities (total 849 municipal wards):

- **Bengaluru GBA (369 wards)**: Checks 1–12
  - Check 1: Existence of operational `bengaluru-gba-369-wards.geojson`
  - Check 2: Valid GeoJSON `FeatureCollection` schema
  - Check 3: Exactly 369 features present
  - Check 4: Zero `GeometryCollection` geometries (all unwrapped to `Polygon` or `MultiPolygon`)
  - Check 5: RFC 7946 coordinate ordering `[lon, lat]` (Easting first: 77.4°–77.8° E, Northing second: 12.8°–13.2° N)
  - Check 6: Bounding box containment within Greater Bengaluru Authority limits
  - Check 7: 369/369 unique ward identifiers (no duplicate IDs)
  - Check 8: Deterministic centroid presence on every feature
  - Check 9: Centroid coordinate validity (non-NaN, strictly inside bounding box)
  - Check 10: Immutability of raw source `wards_bengaluru_gba.geojson` (byte size: 3,052,583; SHA-256: `6dff0924e3d938bfc63fc1ed292429ff41b95ed18459a3aa494b88a6be6691ce`)
  - Check 11: Legacy 225-ward BBMP segregation (`Bengaluru_MC(www.simplygis.in).zip` intact, byte size: 717,939, SHA-256: `e5e5827d6f754a3e925a77cc6a40508fb557a235cd711c6eeaba7c1bc753114b`, unmixed)
  - Check 12: Linear ring closure (all polygon rings start and end at the exact same vertex)

- **Pune (15 wards)**: Checks 13–18
  - Check 13: Operational GeoJSON exists (`pune-15-wards.geojson` or operational copy)
  - Check 14: Exactly 15 administrative ward features
  - Check 15: RFC 7946 `[lon, lat]` coordinate order (Lon 73.75°–73.97°, Lat 18.42°–18.63°)
  - Check 16: Zero `GeometryCollection` geometries
  - Check 17: 15/15 unique ward identifiers
  - Check 18: Deterministic valid non-NaN centroids within Pune municipal bounds

- **Mumbai (24 wards)**: Checks 19–24
  - Check 19: Operational GeoJSON exists (`mumbai-24-wards.geojson`)
  - Check 20: Exactly 24 administrative ward features (A through T)
  - Check 21: RFC 7946 `[lon, lat]` coordinate order (Lon 72.77°–72.99°, Lat 18.89°–19.28°)
  - Check 22: Zero `GeometryCollection` geometries
  - Check 23: 24/24 unique ward identifiers
  - Check 24: Deterministic valid non-NaN centroids within Mumbai municipal bounds

- **Kolkata (141 wards)**: Checks 25–30
  - Check 25: Operational GeoJSON exists (`kolkata-141-wards.geojson`)
  - Check 26: Exactly 141 municipal ward features
  - Check 27: RFC 7946 `[lon, lat]` coordinate order (Lon 88.24°–88.46°, Lat 22.45°–22.64°)
  - Check 28: Zero `GeometryCollection` geometries
  - Check 29: 141/141 unique ward identifiers
  - Check 30: Deterministic valid non-NaN centroids within Kolkata municipal bounds

- **Chennai (200 wards)**: Checks 31–36
  - Check 31: Operational GeoJSON exists (`chennai-200-wards.geojson`)
  - Check 32: Exactly 200 municipal ward features
  - Check 33: RFC 7946 `[lon, lat]` coordinate order (Lon 80.13°–80.34°, Lat 12.85°–13.24°)
  - Check 34: Zero `GeometryCollection` geometries
  - Check 35: 200/200 unique ward identifiers
  - Check 36: Deterministic valid non-NaN centroids within Chennai municipal bounds

- **Coimbatore (100 wards)**: Checks 37–42
  - Check 37: Operational GeoJSON exists (`coimbatore-100-wards.geojson`)
  - Check 38: Exactly 100 municipal ward features
  - Check 39: RFC 7946 `[lon, lat]` coordinate order (Lon 76.85°–77.07°, Lat 10.91°–11.11°)
  - Check 40: Zero `GeometryCollection` geometries
  - Check 41: 100/100 unique ward identifiers
  - Check 42: Deterministic valid non-NaN centroids within Coimbatore municipal bounds

- **Cross-City & Aggregate System Checks**: Checks 43–48
  - Check 43: Exact total operational municipal ward count: $369 + 15 + 24 + 141 + 200 + 100 = \mathbf{849}$
  - Check 44: Pan-India coordinate bounding sanity: All coordinates across all 849 features fall within Indian territory (Lon 68°–98° E, Lat 8°–38° N)
  - Check 45: Zero coordinate inversion across all 849 wards ($\text{lon} > \text{lat}$ validated for all points)
  - Check 46: Global centroid completeness: 849/849 valid non-NaN centroids across all 6 cities
  - Check 47: Global ring closure: 100% of linear rings across all 849 features are closed
  - Check 48: Multi-city metadata registry consistency with city coordinates, ward counts, and extents

---

### Tier 2: Scientific & Data-Truth Assertion Suite (15 Checks)
Validates compliance with MoES / NCMRWF scientific principles and eliminates deceptive claims:

1. **Check 1: Zero Fake ML Library Imports**:
   Scans `package.json` and all source files in `heatpulse/src/` for prohibited fake ML libraries (`@tensorflow/tfjs`, `scikit-learn`, `brain.js`, `keras`, `onnxruntime`, `ml5`).
2. **Check 2: Zero Deceptive AI/ML Marketing Claims**:
   Scans code and UI components to verify absence of misleading claims (e.g., "AI predicts", "ML neural net", "trained on deep learning").
3. **Check 3: Zero Synthetic Mortality Numbers**:
   Scans codebase and mock files to guarantee absence of fabricated death counts, fatal casualties, or projected mortality numbers.
4. **Check 4: Zero Synthetic Hospitalization Statistics**:
   Scans codebase to guarantee absence of fabricated hospital admissions, emergency room surges, or patient casualty counts.
5. **Check 5: Explicit Disabled Health Layer Copy**:
   Verifies that the exact copy `"Coming with validated health-outcome model"` is present in layer definitions, UI, and documentation.
6. **Check 6: Zero Fabricated IMD Ward-Level Warnings**:
   Verifies that the system never fabricates ward-level IMD warnings (IMD issues district warnings only; ward alerts must be HeatPulse localized thermal advisories).
7. **Check 7: Segregation of Official IMD District Reference Warnings**:
   Verifies structural segregation between official IMD district reference warnings and HeatPulse localized thermal advisories.
8. **Check 8: Transparent UTCI Proxy Labeling**:
   Verifies that apparent temperature is explicitly labeled and documented as `"UTCI Proxy"` with clear methodology notes.
9. **Check 9: Honest Weather Attribution**:
   Verifies presence of the mandatory attribution: `"Ward-localized forecast derived from numerical weather prediction"`.
10. **Check 10: Thermal Score Scaling Correction**:
    Audits risk engine equations to verify that thermal score is scaled by dividing by `0.34` (or multiplying by $100/34$), eliminating the legacy `/ 3.4` 10x deflation bug.
11. **Check 11: NOAA Rothfusz Heat Index Adjustments**:
    Verifies that the Heat Index calculation implements both the low-humidity adjustment ($RH < 13\%$) and high-humidity adjustment ($RH > 85\%$) for $T \ge 27^\circ\text{C}$.
12. **Check 12: BoM Simplified Outdoor WBGT Equation**:
    Verifies that the WBGT calculation follows the Australian Bureau of Meteorology shade formula ($0.567 T + 0.393 e + 3.94$) with correct Magnus-Tetens vapor pressure.
13. **Check 13: Transparent Stale/Unavailable Error Handling**:
    Verifies that weather pipeline and API routes provide explicit `status: 'stale' | 'unavailable'` fallback states instead of masked mock data or 500 crashes.
14. **Check 14: Zero Hardcoded Blueprint Illustrative Metrics**:
    Verifies that API route handlers dynamically compute metrics or return transparent baseline estimates rather than hardcoded blueprint numbers.
15. **Check 15: Strict 5-Concept Scientific Segregation**:
    Verifies distinct models, types, and labels for the 5 fundamental concepts: `Heat Conditions`, `Thermal Stress`, `Vulnerability`, `Thermal-Vulnerability Risk`, and `Health Impact`.

---

## 4. Expected Output Derivation & Authoritative Sources

| Metric / Check | Authoritative Source | Derivation Method | Expected Value |
|---|---|---|---|
| Bengaluru Ward Count | Greater Bengaluru Governance Bill / Delimitation Map | Feature counting in authoritative GBA GeoJSON | Exactly 369 features |
| Raw GBA File Immutability | SHA-256 cryptographic digest of root `wards_bengaluru_gba.geojson` | Cryptographic SHA-256 hash | `6dff0924e3d938bfc63fc1ed292429ff41b95ed18459a3aa494b88a6be6691ce` (3,052,583 bytes) |
| Legacy BBMP Archive | SimplyGIS archive `Bengaluru_MC(www.simplygis.in).zip` | Cryptographic SHA-256 hash & record count | `e5e5827d6f754a3e925a77cc6a40508fb557a235cd711c6eeaba7c1bc753114b` (225 records) |
| Coordinate System Order | IETF RFC 7946 Section 3.1.1 | Spatial bounding box check | Longitude first ($72^\circ\text{--}89^\circ\text{ E}$), Latitude second ($10^\circ\text{--}23^\circ\text{ N}$) |
| Companion Cities Counts | Municipal Corporation Records (PMC, MCGM, KMC, GCC, CCMC) | Shapefile and GeoJSON record verification | Pune: 15, Mumbai: 24, Kolkata: 141, Chennai: 200, Coimbatore: 100 |
| Total Municipal Wards | Sum of 6 operational municipal jurisdictions | $369 + 15 + 24 + 141 + 200 + 100$ | Exactly 849 municipal wards |
| NOAA Heat Index | NOAA NWS Technical Attachment SR 90-23 (Rothfusz 1990) | 9-parameter polynomial with low/high RH adjustments | $HI(35^\circ\text{C}, 60\% RH) \approx 45.4^\circ\text{C}$; adjustments apply for $RH < 13\%$ and $RH > 85\%$ |
| BoM Outdoor WBGT | Australian Bureau of Meteorology (Nolet & Brown 1973) | $0.567 T + 0.393 e + 3.94$ | $WBGT(35^\circ\text{C}, 50\% RH) \approx 34.8^\circ\text{C}$ |
| Thermal Scaling | Linear normalization from $20^\circ\text{C}$ (0) to $54^\circ\text{C}$ (100) | $\text{score} = (HI - 20) / 0.34$ | At $HI = 54^\circ\text{C}$, $\text{score} = 100.0$ |

---

## 5. Adversarial Verification Cases

1. **Inverted Coordinates Detector**: Injects swapped `[lat, lon]` pairs to verify that the test runner immediately flags any feature where latitude appears in the first position.
2. **CAD GeometryCollection Stress Test**: Scans features for residual CAD drafting line segments, requiring pure `Polygon` or `MultiPolygon` geometries.
3. **Centroid Boundary Inaccessibility Check**: Validates that all ward centroids are strictly non-NaN and fall within the bounding box of their respective municipal jurisdiction.
4. **Thermal Deflation Vulnerability Check**: Evaluates composite risk at $HI = 50^\circ\text{C}$; if thermal contribution is $< 50$ points, the test fails, preventing regression of the `/ 3.4` bug.
5. **Synthetic Casualty Scanner**: Rigorous AST and text scanner searching for synthetic death tolls, hospital overload numbers, and mock mortality data.

---

## 6. Progressive Testability & Diagnostic Output

When executed during development or milestone transitions, the test runner provides progressive, human-readable diagnostics:
- **Pass (`PASS`)**: Green indicator with execution timing and check details.
- **Pending/Prerequisite (`SKIP` / `PENDING`)**: Identifies milestones not yet landed without crashing the harness.
- **Defect (`FAIL`)**: Red indicator with full assertion diff, file path, line reference, expected value, and actual value.

Exit Codes:
- `0`: All required checks for the active milestone passed 100%.
- `1`: One or more assertion failures, data honesty violations, or geometry corruptions detected.
