/**
 * HeatPulse — Thermal Risk Engine Interface
 * Standard: SIH26083 MoES / NCMRWF Master Build Specification
 *
 * Client-safe surface. The heavy risk engine (risk-engine.ts) imports server
 * modules (fs-backed vulnerability lookup) and must NOT be bundled for the
 * browser, so client components re-exported through this module can only
 * access the pure helpers here. Server routes import risk-engine directly.
 */

export * from '../types/risk';
export * from './risk-helpers';
