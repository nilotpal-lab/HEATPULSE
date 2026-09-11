/**
 * HeatPulse — Full outdoor WBGT via Liljegren et al. (2008)
 * SIH26083 MoES / NCMRWF
 *
 * Upgrades the BoM simplified WBGT (air temperature + humidity only) to the
 * physics-based outdoor WBGT that additionally ingests WIND and SOLAR
 * RADIATION, as required by the SIH problem statement ("compounding effects
 * of relative humidity, wind speed, and solar radiation").
 *
 * Method (all equations per the cited references — no invented constants):
 *   WBGT = 0.7 * Tnwb + 0.2 * Tg + 0.1 * Ta
 *   - Tnwb: natural wet-bulb temperature from the wetted-wick energy balance
 *   - Tg:   150mm black-globe temperature from the globe energy balance
 *   Both are implicit equations solved by residual minimization over the same
 *   brackets as the reference implementation.
 *
 * References:
 *   [1] Liljegren, J.C. et al. (2008). "Modeling the Wet Bulb Globe
 *       Temperature Using Standard Meteorological Measurements."
 *       J. Occup. Environ. Hyg. 5(10):645-655. (reported bias < 1 degC)
 *   [2] Lemke, B. & Kjellstrom, T. (2012). "Calculating Workplace WBGT from
 *       Meteorological Data." Ind. Health 50:267-278. (recommends Liljegren
 *       for outdoor WBGT from met data)
 *   [3] Casanueva, A. / Lemke, B. HeatStress R package, functions fTnwb,
 *       fTg, calZenith + BSL/Bedingfield/Oke/Buck/Spencer sub-formulae.
 *       github.com/anacv/HeatStress (validation logic mirrored, code is an
 *       independent implementation of the published equations).
 *
 * Operational assumptions (documented, all visible in outputs/tests):
 *   - Wind: Open-Meteo 10 m NWP wind used directly as screen-level wind,
 *     following Brimicombe et al. (2023, ECMWF global WBGT grid). Converted
 *     km/h -> m/s. Floor 0.1 m/s per [3] (log-law guard).
 *   - Radiation: Open-Meteo `shortwave_radiation` (global horizontal
 *     irradiance, W/m2). Direct fraction 0.8 and surface albedo 0.4 per [3].
 *   - Pressure: observed `surface_pressure` when present, else 1010 hPa [3].
 *   - Night (GHI < 10 with sun below horizon): radiation forced to 0 [3].
 *
 * This module is intentionally dependency-free so the physics can be
 * unit-tested in isolation (compiled standalone with tsc).
 */

export interface LiljegrenInputs {
  tempC: number; // dry-bulb air temperature, degC
  humidityPct: number; // relative humidity, %
  windKmh: number; // 10 m wind from NWP, km/h
  solarGhiWm2: number; // global horizontal irradiance, W/m2
  latitude: number; // deg, ward centroid
  longitude: number; // deg, ward centroid
  timeIso: string; // hourly valid time, Asia/Kolkata wall time "YYYY-MM-DDTHH:MM"
  pressureHpa?: number; // surface pressure, hPa (default 1010)
}

export interface LiljegrenResult {
  wbgt: number; // full outdoor WBGT, degC
  tnwb: number; // natural wet-bulb temperature, degC
  tg: number; // globe temperature, degC
  zenithDeg: number; // solar zenith angle used, degrees
}

// --- Published physical constants (BSL / Liljegren 2008) -------------------
const STEFAN_BOLTZMANN = 0.000000056696; // W/(m2 K4)
const CP_AIR = 1003.5; // J/(kg K), heat capacity of dry air at constant pressure
const M_AIR = 28.97;
const M_H2O = 18.015;
const R_GAS = 8314.34;
const R_AIR = R_GAS / M_AIR;
const PRANDTL = CP_AIR / (CP_AIR + 1.25 * R_AIR);
const MASS_RATIO = (CP_AIR * M_AIR) / M_H2O;
const MIN_WIND_MS = 0.1;
const DEFAULT_PRESSURE_HPA = 1010;
const PROP_DIRECT = 0.8;
const SURFACE_ALBEDO = 0.4;
const EMIS_GLOBE = 0.95;
const ALB_GLOBE = 0.05;
const DIAM_GLOBE = 0.05; // 50 mm globe
const EMIS_WICK = 0.95;
const ALB_WICK = 0.4;
const DIAM_WICK = 0.007; // 7 mm wick cylinder
const LEN_WICK = 0.0254;
const EMIS_SFC = 0.999;
const OPT_TOL = 1e-4;
const OPT_MAX_ITER = 200;

/** Buck (1981) saturation vapor pressure over liquid water, hPa. Tk Kelvin. */
export function esatBuck(Tk: number): number {
  const es = 6.1121 * Math.exp((17.502 * (Tk - 273.15)) / (Tk - 32.18));
  return 1.004 * es; // moist-air correction for p > 800 hPa
}

/** Atmospheric emissivity after Oke (RH as fraction). */
function emisAtm(Tk: number, rhFrac: number): number {
  const e = rhFrac * esatBuck(Tk);
  return 0.575 * Math.pow(e, 0.143);
}

/** Dynamic viscosity of air, kg/(m s). BSL p.23. */
function viscosityAir(Tk: number): number {
  const omega = (((Tk / 97 - 2.9) / 0.4) * -0.034 + 1.048);
  return (0.0000026693 * Math.sqrt(28.97 * Tk)) / (Math.pow(3.617, 2) * omega);
}

/** Thermal conductivity of air, W/(m K). BSL p.257. */
function thermalCondAir(Tk: number): number {
  return (CP_AIR + 1.25 * R_AIR) * viscosityAir(Tk);
}

/** Diffusivity of water vapor in air, m2/s. BSL p.505. */
function diffusivityH2o(Tk: number, pairHpa: number): number {
  const pcrit13 = Math.pow(36.4 * 218, 1 / 3);
  const tcrit512 = Math.pow(132 * 647.3, 5 / 12);
  const tcrit12 = Math.sqrt(132 * 647.3);
  const mmix = Math.sqrt(1 / 28.97 + 1 / 18.015);
  return (
    (0.000364 *
      Math.pow(Tk / tcrit12, 2.334) *
      pcrit13 *
      tcrit512 *
      mmix) /
    (pairHpa / 1013.25) *
    0.0001
  );
}

/** Heat of evaporation, J/kg, valid 283-313 K. Van Wylen & Sonntag. */
function heatEvap(Tk: number): number {
  return ((313.15 - Tk) / 30) * -71100 + 2407300;
}

/** Convective coefficient for a sphere in cross-flow, W/(m2 K). BSL p.409. */
function hSphere(Tk: number, pairHpa: number, windMs: number, diamM: number): number {
  const speed = windMs < MIN_WIND_MS ? MIN_WIND_MS : windMs;
  const density = (pairHpa * 100) / (R_AIR * Tk);
  const re = ((speed * density * diamM) / viscosityAir(Tk));
  const nu = 2 + 0.6 * Math.sqrt(re) * Math.pow(PRANDTL, 0.3333);
  return (nu * thermalCondAir(Tk)) / diamM;
}

/** Convective coefficient for a long cylinder in cross-flow. Bedingfield & Drew eq.32. */
function hCylinder(Tk: number, pairHpa: number, windMs: number, diamM: number): number {
  const speed = windMs < MIN_WIND_MS ? MIN_WIND_MS : windMs;
  const density = (pairHpa * 100) / (R_AIR * Tk);
  const re = ((speed * density * diamM) / viscosityAir(Tk));
  const nu = 0.281 * Math.pow(re, 0.6) * Math.pow(PRANDTL, 0.44);
  return (nu * thermalCondAir(Tk)) / diamM;
}

/**
 * Dew-point temperature (degC) from dry-bulb + RH via Magnus inversion
 * (Alduchov & Eskridge coefficients). Clamped to never exceed air temp.
 */
export function dewpointFromRh(tempC: number, rhPct: number): number {
  const rh = Math.min(100, Math.max(0.1, rhPct));
  const gamma = Math.log(rh / 100) + (17.67 * tempC) / (243.5 + tempC);
  const dewp = (243.5 * gamma) / (17.67 - gamma);
  return Math.min(dewp, tempC);
}

/** Leap-year predicate for the zenith day-count. */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Solar zenith angle (radians) for an instant + lon/lat.
 * Spencer/PSU fractional-year formulation for declination (as in
 * calZenith), BUT with the hour angle computed from true local solar time
 * (UTC + longitude + equation of time, NOAA formulation).
 *
 * Documented deviation: the HeatStress R calZenith(hour=TRUE) sets
 * TimeOffset = 0 and uses the UTC hour only, i.e. it assumes UTC ~ solar
 * time. That holds near Greenwich but is ~5.5 h wrong for IST, which would
 * place the sun below the horizon at Indian noon. True solar time keeps
 * day/night geometry correct for every ward centroid.
 */
export function solarZenithRad(utc: Date, lonDeg: number, latDeg: number): number {
  const year = utc.getUTCFullYear();
  const utcMinutes =
    utc.getUTCHours() * 60 + utc.getUTCMinutes() + utc.getUTCSeconds() / 60;
  const startOfYear = Date.UTC(year, 0, 1);
  const doy = Math.floor((utc.getTime() - startOfYear) / 86400000) + 1;
  const dpy = isLeapYear(year) ? 366 : 365;
  const radLat = (latDeg * Math.PI) / 180;
  const gamma = (2 * Math.PI * (doy - 1 + utcMinutes / 1440)) / dpy;
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const trueSolarMinutes = utcMinutes + eqTime + 4 * lonDeg;
  const haRad = (((trueSolarMinutes / 4 - 180) * Math.PI) / 180);
  let cosZen = Math.sin(radLat) * Math.sin(decl) + Math.cos(radLat) * Math.cos(decl) * Math.cos(haRad);
  if (cosZen > 1) cosZen = 1;
  if (cosZen < -1) cosZen = -1;
  return Math.acos(cosZen);
}

/** Golden-section residual minimizer over [a,b] (mirrors R stats::optimize use). */
function minimizeResidual(fn: (x: number) => number, a: number, b: number): number {
  const invPhi = (Math.sqrt(5) - 1) / 2;
  let lo = a;
  let hi = b;
  let c = hi - invPhi * (hi - lo);
  let d = lo + invPhi * (hi - lo);
  let fc = fn(c);
  let fd = fn(d);
  for (let i = 0; i < OPT_MAX_ITER && hi - lo > OPT_TOL; i++) {
    if (fc < fd) {
      hi = d;
      d = c;
      fd = fc;
      c = hi - invPhi * (hi - lo);
      fc = fn(c);
    } else {
      lo = c;
      c = d;
      fc = fd;
      d = lo + invPhi * (hi - lo);
      fd = fn(d);
    }
  }
  return (lo + hi) / 2;
}

interface GlobeState {
  tairK: number;
  rhFrac: number;
  pair: number;
  windMs: number;
  radiation: number;
  cza: number;
  emisAtmos: number;
}

/** Globe-temperature residual for a candidate globe temperature (Kelvin). */
function globeResidual(tGlobePrevK: number, s: GlobeState): number {
  const tRef = 0.5 * (tGlobePrevK + s.tairK);
  const h = hSphere(tRef, s.pair, s.windMs, DIAM_GLOBE);
  const tGlobe =
    Math.pow(
      0.5 * (s.emisAtmos * Math.pow(s.tairK, 4) + EMIS_SFC * Math.pow(s.tairK, 4)) -
        (h / (EMIS_GLOBE * STEFAN_BOLTZMANN)) * (tGlobePrevK - s.tairK) +
        (s.radiation / (2 * EMIS_GLOBE * STEFAN_BOLTZMANN)) *
          (1 - ALB_GLOBE) *
          (PROP_DIRECT * (1 / (2 * s.cza) - 1) + 1 + SURFACE_ALBEDO),
      0.25
    );
  return Math.abs(tGlobe - tGlobePrevK);
}

interface WickState {
  tairK: number;
  tdewK: number;
  rhFrac: number;
  pair: number;
  windMs: number;
  radiation: number;
  zenith: number;
  emisAtmos: number;
  eair: number;
  density: number;
}

/** Natural-wet-bulb residual for a candidate wick temperature (Kelvin). */
function wickResidual(tWbPrevK: number, s: WickState): number {
  const tRef = 0.5 * (tWbPrevK + s.tairK);
  const fatm =
    STEFAN_BOLTZMANN *
      EMIS_WICK *
      (0.5 * (s.emisAtmos * Math.pow(s.tairK, 4) + EMIS_SFC * Math.pow(s.tairK, 4)) -
        Math.pow(tWbPrevK, 4)) +
    (1 - ALB_WICK) *
      s.radiation *
      ((1 - PROP_DIRECT) * (1 + (0.25 * DIAM_WICK) / LEN_WICK) +
        (Math.tan(s.zenith) / Math.PI + (0.25 * DIAM_WICK) / LEN_WICK) * PROP_DIRECT +
        SURFACE_ALBEDO);
  const sc = viscosityAir(s.tairK) / (s.density * diffusivityH2o(tRef, s.pair));
  const h = hCylinder(tWbPrevK, s.pair, s.windMs, DIAM_WICK);
  const ewick = esatBuck(tWbPrevK);
  const evap = heatEvap(tWbPrevK);
  const twb =
    s.tairK -
    (evap / MASS_RATIO) *
      ((ewick - s.eair) / (s.pair - ewick)) *
      Math.pow(PRANDTL / sc, 0.56) +
    (fatm / h);
  return Math.abs(twb - tWbPrevK);
}

/** Applies the reference zenith/radiation guard rails (in radians). */
function guardZenithRadiation(zenith: number, radiation: number): { zenith: number; radiation: number } {
  let z = zenith;
  let r = radiation < 0 ? 0 : radiation;
  if (z <= 0) z = 0.0000000001;
  if (r > 0 && z > 1.57) z = 1.57;
  if (r > 15 && z > 1.54) z = 1.54;
  if (r > 900 && z > 1.52) z = 1.52;
  if (r < 10 && z === 1.57) r = 0;
  return { zenith: z, radiation: r };
}

function isValidInput(v: number): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Full outdoor WBGT (degC) with Tnwb/Tg components.
 * Returns null when any required input is missing or non-physical —
 * callers must fall back to the BoM simplified WBGT, never to a guess.
 */
export function wbgtLiljegrenFull(inputs: LiljegrenInputs): LiljegrenResult | null {
  const { tempC, humidityPct, windKmh, solarGhiWm2, latitude, longitude, timeIso } = inputs;
  if (
    !isValidInput(tempC) ||
    !isValidInput(humidityPct) ||
    !isValidInput(windKmh) ||
    !isValidInput(solarGhiWm2) ||
    !isValidInput(latitude) ||
    !isValidInput(longitude) ||
    typeof timeIso !== 'string' ||
    timeIso.length < 13
  ) {
    return null;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const pair = isValidInput(inputs.pressureHpa as number) ? (inputs.pressureHpa as number) : DEFAULT_PRESSURE_HPA;
  if (pair < 800 || pair > 1100) return null;

  const rh = Math.min(100, Math.max(0, humidityPct));
  const windMs = Math.max(0, windKmh / 3.6);
  const tairK = tempC + 273.15;
  const rhFrac = rh / 100;
  const tdewC = dewpointFromRh(tempC, rh);
  const tdewK = tdewC + 273.15;

  // Hourly valid times are Asia/Kolkata wall times ("YYYY-MM-DDTHH:MM").
  const utc = new Date(timeIso.length === 16 ? timeIso + ':00+05:30' : timeIso);
  if (Number.isNaN(utc.getTime())) return null;
  const guarded = guardZenithRadiation(solarZenithRad(utc, longitude, latitude), solarGhiWm2);

  const emisAtmos = emisAtm(tairK, rhFrac);
  const globe: GlobeState = {
    tairK,
    rhFrac,
    pair,
    windMs,
    radiation: guarded.radiation,
    cza: Math.cos(guarded.zenith),
    emisAtmos,
  };
  const tgK = minimizeResidual((x) => globeResidual(x, globe), tairK - 2, tairK + 10);

  const wick: WickState = {
    tairK,
    tdewK,
    rhFrac,
    pair,
    windMs,
    radiation: guarded.radiation,
    zenith: guarded.zenith,
    emisAtmos,
    eair: rhFrac * esatBuck(tairK),
    density: (pair * 100) / (tairK * R_AIR),
  };
  const tnwbK = minimizeResidual((x) => wickResidual(x, wick), tdewK - 1, tairK + 1);

  const tg = tgK - 273.15;
  const tnwb = tnwbK - 273.15;
  if (!isValidInput(tg) || !isValidInput(tnwb)) return null;
  const wbgt = 0.7 * tnwb + 0.2 * tg + 0.1 * tempC;
  if (!isValidInput(wbgt)) return null;
  return {
    wbgt: Math.round(wbgt * 10) / 10,
    tnwb: Math.round(tnwb * 10) / 10,
    tg: Math.round(tg * 10) / 10,
    zenithDeg: Math.round(((guarded.zenith * 180) / Math.PI) * 10) / 10,
  };
}
