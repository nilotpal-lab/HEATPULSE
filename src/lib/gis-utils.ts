/**
 * HeatPulse — GIS Utility Functions
 * Helper functions to load city GeoJSONs, look up wards, and retrieve ward centroids.
 * Conforms to RFC 7946 EPSG:4326 [lon, lat] standards.
 */

import {
  CityId,
  CityMetadata,
  CITIES,
  CITY_LIST,
  WardFeature,
  WardFeatureCollection,
  WardGeometry,
} from '../types/gis';

/**
 * Validates whether coordinates follow standard RFC 7946 EPSG:4326 [lon, lat]
 * and fall within mainland India's geographic bounding domain.
 */
export function isValidRfc7946(coord: [number, number]): boolean {
  if (!Array.isArray(coord) || coord.length < 2) return false;
  const [lon, lat] = coord;
  if (typeof lon !== 'number' || typeof lat !== 'number') return false;
  if (isNaN(lon) || isNaN(lat)) return false;
  return lon >= 68 && lon <= 98 && lat >= 8 && lat <= 38;
}

/**
 * Calculates a deterministic planar centroid [lon, lat] for a Polygon or MultiPolygon
 * using the Shoelace formula on exterior rings. Area-weighted for MultiPolygons.
 * Falls back to arithmetic vertex mean if planar area degenerates to zero.
 */
export function calculateCentroid(
  geometry: WardGeometry | { type: string; coordinates: unknown }
): [number, number] {
  if (!geometry || !geometry.coordinates) {
    throw new Error('Invalid geometry provided for centroid calculation');
  }

  const { type, coordinates } = geometry;

  // Normalize polygons list: Array of rings (each ring is [lon, lat][])
  const polygonRings: [number, number][][][] = [];

  if (type === 'Polygon') {
    polygonRings.push(coordinates as [number, number][][]);
  } else if (type === 'MultiPolygon') {
    for (const poly of coordinates as [number, number][][][]) {
      polygonRings.push(poly);
    }
  } else {
    throw new Error(`Unsupported geometry type for centroid: ${type}`);
  }

  let totalArea = 0;
  let weightedCx = 0;
  let weightedCy = 0;

  for (const rings of polygonRings) {
    if (!rings || rings.length === 0) continue;
    const exterior = rings[0];
    if (exterior.length < 3) continue;

    let a = 0;
    let cx = 0;
    let cy = 0;

    for (let i = 0; i < exterior.length - 1; i++) {
      const [x0, y0] = exterior[i];
      const [x1, y1] = exterior[i + 1];
      const cross = x0 * y1 - x1 * y0;
      a += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }

    a = a / 2;
    const absA = Math.abs(a);

    if (absA > 1e-12) {
      cx = cx / (6 * a);
      cy = cy / (6 * a);
      totalArea += absA;
      weightedCx += cx * absA;
      weightedCy += cy * absA;
    }
  }

  if (totalArea > 1e-12) {
    const finalLon = Number((weightedCx / totalArea).toFixed(6));
    const finalLat = Number((weightedCy / totalArea).toFixed(6));
    return [finalLon, finalLat];
  }

  // Fallback: arithmetic mean of all unique vertices
  let sumLon = 0;
  let sumLat = 0;
  let count = 0;

  for (const rings of polygonRings) {
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        sumLon += ring[i][0];
        sumLat += ring[i][1];
        count++;
      }
    }
  }

  if (count === 0) {
    throw new Error('Geometry has zero vertices');
  }

  return [
    Number((sumLon / count).toFixed(6)),
    Number((sumLat / count).toFixed(6)),
  ];
}

/**
 * Calculates geographic bounding box [minLon, minLat, maxLon, maxLat]
 * for any WardGeometry, WardFeature, or WardFeatureCollection.
 */
export function calculateBBox(
  target: WardGeometry | WardFeature | WardFeatureCollection
): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  function scanCoords(coords: unknown) {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number') {
      const lon = coords[0] as number;
      const lat = coords[1] as number;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else {
      for (const item of coords) {
        scanCoords(item);
      }
    }
  }

  if ('type' in target && target.type === 'FeatureCollection') {
    for (const feat of target.features) {
      scanCoords(feat.geometry.coordinates);
    }
  } else if ('geometry' in target) {
    scanCoords(target.geometry.coordinates);
  } else if ('coordinates' in target) {
    scanCoords(target.coordinates);
  }

  return [
    Number(minLon.toFixed(6)),
    Number(minLat.toFixed(6)),
    Number(maxLon.toFixed(6)),
    Number(maxLat.toFixed(6)),
  ];
}

/**
 * Computes approximate area in square kilometers for a polygon geometry
 * using spherical Earth surface projection.
 */
export function calculateAreaSqKm(
  geometry: WardGeometry | { type: string; coordinates: unknown }
): number {
  if (!geometry || !geometry.coordinates) return 0;
  const { type, coordinates } = geometry;
  const polygonRings: [number, number][][][] = [];

  if (type === 'Polygon') {
    polygonRings.push(coordinates as [number, number][][]);
  } else if (type === 'MultiPolygon') {
    for (const poly of coordinates as [number, number][][][]) {
      polygonRings.push(poly);
    }
  } else {
    return 0;
  }

  let totalSqKm = 0;
  const KM_PER_DEG_LAT = 111.32;

  for (const rings of polygonRings) {
    if (!rings || rings.length === 0) continue;
    const exterior = rings[0];
    if (exterior.length < 3) continue;

    let aDeg2 = 0;
    let latSum = 0;

    for (let i = 0; i < exterior.length - 1; i++) {
      const [x0, y0] = exterior[i];
      const [x1, y1] = exterior[i + 1];
      aDeg2 += x0 * y1 - x1 * y0;
      latSum += y0;
    }

    aDeg2 = Math.abs(aDeg2 / 2);
    const meanLat = (latSum / (exterior.length - 1)) * (Math.PI / 180);
    const kmPerDegLon = KM_PER_DEG_LAT * Math.cos(meanLat);
    const polySqKm = aDeg2 * KM_PER_DEG_LAT * kmPerDegLon;

    totalSqKm += polySqKm;
  }

  return Number(totalSqKm.toFixed(2));
}

/**
 * Returns metadata for a given city ID.
 */
export function getCityMetadata(cityId: string): CityMetadata | undefined {
  return CITIES[cityId.toLowerCase() as CityId];
}

/**
 * Returns metadata list for all 6 supported municipal corporations.
 */
export function getAllCities(): CityMetadata[] {
  return CITY_LIST;
}

/**
 * Loads a city's GeoJSON dataset.
 * Supports both browser fetch and Node.js filesystem reading.
 */
export async function loadCityGeoJson(
  cityId: CityId | string,
  basePath: string = ''
): Promise<WardFeatureCollection> {
  const meta = getCityMetadata(cityId);
  if (!meta) {
    throw new Error(`Unknown city ID: ${cityId}. Supported: ${Object.keys(CITIES).join(', ')}`);
  }

  const normalizedPath = basePath
    ? `${basePath.replace(/\/$/, '')}${meta.dataPath}`
    : meta.dataPath;

  if (typeof window === 'undefined') {
    // Node.js server environment
    const fs = await import('fs');
    const path = await import('path');
    let fullPath: string;
    if (basePath) {
      fullPath = path.isAbsolute(basePath)
        ? path.join(basePath, meta.dataPath.replace(/^\//, ''))
        : path.resolve(/*turbopackIgnore: true*/ process.cwd(), basePath, meta.dataPath.replace(/^\//, ''));
    } else {
      const candidates = [
        path.join(process.cwd(), 'public', meta.dataPath.replace(/^\//, '')),
        path.join(process.cwd(), 'heatpulse', 'public', meta.dataPath.replace(/^\//, '')),
      ];
      fullPath = candidates.find((p) => fs.existsSync(/*turbopackIgnore: true*/ p)) || candidates[0];
    }

    if (!fs.existsSync(/*turbopackIgnore: true*/ fullPath)) {
      throw new Error(`GeoJSON file not found at: ${fullPath}`);
    }

    const content = fs.readFileSync(/*turbopackIgnore: true*/ fullPath, 'utf-8');
    return JSON.parse(content) as WardFeatureCollection;
  } else {
    // Browser client environment
    const response = await fetch(normalizedPath);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${meta.dataPath}: ${response.status} ${response.statusText}`
      );
    }
    return (await response.json()) as WardFeatureCollection;
  }
}

/**
 * Retrieves a ward feature by its unique canonical ward ID (e.g. 'blr-001', 'pun-015').
 */
export function getWardById(
  collection: WardFeatureCollection,
  wardId: string
): WardFeature | undefined {
  if (!collection?.features || !wardId) return undefined;
  const normalizedId = wardId.trim().toLowerCase();
  if (!normalizedId) return undefined;
  return collection.features.find(
    (f) =>
      f.properties?.ward_id?.toLowerCase() === normalizedId ||
      String(f?.id ?? '').toLowerCase() === normalizedId
  );
}

/**
 * Retrieves a ward feature by its ward name (case-insensitive, exact or trimmed match).
 */
export function getWardByName(
  collection: WardFeatureCollection,
  wardName: string
): WardFeature | undefined {
  if (!collection?.features || !wardName) return undefined;
  const normalizedName = wardName.trim().toLowerCase();
  if (!normalizedName) return undefined;
  return collection.features.find(
    (f) => f.properties?.ward_name?.trim().toLowerCase() === normalizedName
  );
}

/**
 * Retrieves the deterministic centroid [lon, lat] of a ward.
 * Uses properties.centroid if valid, otherwise falls back to calculateCentroid(geometry).
 */
export function getWardCentroid(ward: WardFeature): [number, number] {
  if (ward.properties?.centroid && isValidRfc7946(ward.properties.centroid)) {
    return ward.properties.centroid;
  }
  return calculateCentroid(ward.geometry);
}

/**
 * Returns a Map of canonical ward_id to centroid [lon, lat] for all wards in a collection.
 */
export function getAllWardCentroids(
  collection: WardFeatureCollection
): Map<string, [number, number]> {
  const map = new Map<string, [number, number]>();
  for (const feature of collection.features) {
    const wardId = feature.properties.ward_id;
    const centroid = getWardCentroid(feature);
    map.set(wardId, centroid);
  }
  return map;
}
