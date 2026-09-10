/**
 * HeatPulse — GIS & Operational Geography Types
 * Conforms to PROJECT.md § Interface Contracts (GIS Engine ↔ Application State)
 * Standard: RFC 7946 GeoJSON in EPSG:4326 [lon, lat]
 */

export type CityId =
  | 'bengaluru'
  | 'pune'
  | 'mumbai'
  | 'kolkata'
  | 'chennai'
  | 'coimbatore';

export interface WardFeatureProperties {
  city_id: string; // 'bengaluru' | 'pune' | 'mumbai' | 'kolkata' | 'chennai' | 'coimbatore'
  ward_id: string; // canonical unique ID, e.g. 'blr-001' .. 'blr-369'
  ward_name: string;
  corporation?: string;
  zone?: string;
  population?: number;
  area_sqkm?: number;
  centroid: [number, number]; // [lon, lat] in EPSG:4326
  // Additional optional properties for compatibility / provenance
  id2?: string;
  raw_ward_id?: string | number;
  ward_name_kn?: string;
  corporation_id?: number | string;
  [key: string]: unknown;
}

export interface CityMetadata {
  id: CityId;
  name: string;
  state: string;
  wardCount: number;
  center: [number, number]; // [lon, lat] in EPSG:4326
  defaultZoom: number;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  dataPath: string;
}

export type PolygonCoordinates = [number, number][][];
export type MultiPolygonCoordinates = [number, number][][][];

export interface WardGeometryPolygon {
  type: 'Polygon';
  coordinates: PolygonCoordinates;
}

export interface WardGeometryMultiPolygon {
  type: 'MultiPolygon';
  coordinates: MultiPolygonCoordinates;
}

export type WardGeometry = WardGeometryPolygon | WardGeometryMultiPolygon;

export interface WardFeature {
  type: 'Feature';
  id?: string | number;
  geometry: WardGeometry;
  properties: WardFeatureProperties;
}

export interface WardFeatureCollection {
  type: 'FeatureCollection';
  name?: string;
  crs?: {
    type: string;
    properties: Record<string, unknown>;
  };
  features: WardFeature[];
  bbox?: [number, number, number, number];
}

export const CITIES: Record<CityId, CityMetadata> = {
  bengaluru: {
    id: 'bengaluru',
    name: 'Bengaluru',
    state: 'Karnataka',
    wardCount: 369,
    center: [77.5946, 12.9716],
    defaultZoom: 11,
    bbox: [77.45988, 12.833491, 77.784064, 13.14262],
    dataPath: '/data/processed/geojson/bengaluru-gba-369-wards.geojson',
  },
  pune: {
    id: 'pune',
    name: 'Pune',
    state: 'Maharashtra',
    wardCount: 15,
    center: [73.8567, 18.5204],
    defaultZoom: 11,
    bbox: [73.751624, 18.428807, 73.962973, 18.621586],
    dataPath: '/data/processed/geojson/pune-15-wards.geojson',
  },
  mumbai: {
    id: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    wardCount: 24,
    center: [72.8777, 19.076],
    defaultZoom: 11,
    bbox: [72.776333, 18.893956, 72.980645, 19.270177],
    dataPath: '/data/processed/geojson/mumbai-24-wards.geojson',
  },
  kolkata: {
    id: 'kolkata',
    name: 'Kolkata',
    state: 'West Bengal',
    wardCount: 141,
    center: [88.3639, 22.5726],
    defaultZoom: 11,
    bbox: [88.242143, 22.450323, 88.458955, 22.632577],
    dataPath: '/data/processed/geojson/kolkata-141-wards.geojson',
  },
  chennai: {
    id: 'chennai',
    name: 'Chennai',
    state: 'Tamil Nadu',
    wardCount: 200,
    center: [80.2707, 13.0827],
    defaultZoom: 11,
    bbox: [80.134095, 12.852093, 80.331494, 13.235049],
    dataPath: '/data/processed/geojson/chennai-200-wards.geojson',
  },
  coimbatore: {
    id: 'coimbatore',
    name: 'Coimbatore',
    state: 'Tamil Nadu',
    wardCount: 100,
    center: [76.9558, 11.0168],
    defaultZoom: 11,
    bbox: [76.857656, 10.914371, 77.062892, 11.105467],
    dataPath: '/data/processed/geojson/coimbatore-100-wards.geojson',
  },
};

export const CITY_LIST: CityMetadata[] = Object.values(CITIES);
export const TOTAL_MUNICIPAL_WARDS = 849;

// Canonical 36 Indian States & Union Territories
export type IndianStateId =
  | 'andaman_and_nicobar'
  | 'andhra_pradesh'
  | 'arunachal_pradesh'
  | 'assam'
  | 'bihar'
  | 'chandigarh'
  | 'chhattisgarh'
  | 'dadra_and_nagar_haveli_and_daman_and_diu'
  | 'delhi'
  | 'goa'
  | 'gujarat'
  | 'haryana'
  | 'himachal_pradesh'
  | 'jammu_and_kashmir'
  | 'jharkhand'
  | 'karnataka'
  | 'kerala'
  | 'ladakh'
  | 'lakshadweep'
  | 'madhya_pradesh'
  | 'maharashtra'
  | 'manipur'
  | 'meghalaya'
  | 'mizoram'
  | 'nagaland'
  | 'odisha'
  | 'puducherry'
  | 'punjab'
  | 'rajasthan'
  | 'sikkim'
  | 'tamil_nadu'
  | 'telangana'
  | 'tripura'
  | 'uttar_pradesh'
  | 'uttarakhand'
  | 'west_bengal';

export type StateId = IndianStateId;
export type IndianStateType = 'state' | 'union_territory';

export interface IndianStateMetadata {
  id: IndianStateId;
  name: string;
  geoJsonState: string;
  lgdCode: number;
  type: IndianStateType;
  capital: {
    name: string;
    coordinates: [number, number]; // [lon, lat] EPSG:4326
  };
  centroid: [number, number]; // [lon, lat] EPSG:4326
  telemetryCoord: [number, number]; // [lon, lat] recommended NWP query coordinate
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  monitoredCityId?: CityId;
}

export type StateMetadata = IndianStateMetadata;
export const TOTAL_INDIAN_STATES_AND_UTS = 36;

export interface StateThermalMetric {
  stateName: string;
  temperature?: number;
  heatIndex?: number;
  wbgt?: number;
  heatCondition?: string;
  thermalStress?: string;
}

