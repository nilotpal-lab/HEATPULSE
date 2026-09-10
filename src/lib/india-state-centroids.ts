/**
 * HeatPulse — Pan-India State & UT Capital Centroid Registry
 *
 * Static registry of all 36 Indian States & Union Territories with their
 * state-capital geographic coordinates [longitude, latitude] (WGS84 / EPSG:4326).
 *
 * These coordinates are used as the NWP sampling point for state-level
 * thermal surveillance when no ward-level city data is available.
 *
 * Data basis: Official Indian government administrative records, IMD stations.
 * Coordinates are capital-city centroids (not geographic state centroids) to
 * align with the IMD/NCMRWF station network.
 */

export interface StateCapital {
  /** Unique state key — lowercase, matches GeoJSON property state_name (normalized) */
  stateKey: string;
  /** Display name for UI */
  stateName: string;
  /** Capital city name */
  capital: string;
  /** [longitude, latitude] WGS84 */
  coordinates: [number, number];
  /** ISO 3166-2 code */
  isoCode: string;
  /** Whether this state also has city-level ward data (skip as redundant source) */
  hasCityData?: boolean;
}

/** All 28 States and 8 Union Territories of India */
export const INDIA_STATE_CAPITALS: StateCapital[] = [
  // ─── 28 STATES ────────────────────────────────────────────────
  {
    stateKey: 'andhra pradesh',
    stateName: 'Andhra Pradesh',
    capital: 'Amaravati',
    coordinates: [80.5518, 16.5154],
    isoCode: 'IN-AP',
  },
  {
    stateKey: 'arunachal pradesh',
    stateName: 'Arunachal Pradesh',
    capital: 'Itanagar',
    coordinates: [93.6053, 27.0844],
    isoCode: 'IN-AR',
  },
  {
    stateKey: 'assam',
    stateName: 'Assam',
    capital: 'Dispur',
    coordinates: [91.7898, 26.1445],
    isoCode: 'IN-AS',
  },
  {
    stateKey: 'bihar',
    stateName: 'Bihar',
    capital: 'Patna',
    coordinates: [85.1376, 25.5941],
    isoCode: 'IN-BR',
  },
  {
    stateKey: 'chhattisgarh',
    stateName: 'Chhattisgarh',
    capital: 'Raipur',
    coordinates: [81.6296, 21.2514],
    isoCode: 'IN-CG',
  },
  {
    stateKey: 'goa',
    stateName: 'Goa',
    capital: 'Panaji',
    coordinates: [73.8278, 15.4909],
    isoCode: 'IN-GA',
  },
  {
    stateKey: 'gujarat',
    stateName: 'Gujarat',
    capital: 'Gandhinagar',
    coordinates: [72.6369, 23.2156],
    isoCode: 'IN-GJ',
  },
  {
    stateKey: 'haryana',
    stateName: 'Haryana',
    capital: 'Chandigarh',
    coordinates: [76.7794, 30.7333],
    isoCode: 'IN-HR',
  },
  {
    stateKey: 'himachal pradesh',
    stateName: 'Himachal Pradesh',
    capital: 'Shimla',
    coordinates: [77.1734, 31.1048],
    isoCode: 'IN-HP',
  },
  {
    stateKey: 'jharkhand',
    stateName: 'Jharkhand',
    capital: 'Ranchi',
    coordinates: [85.3096, 23.3441],
    isoCode: 'IN-JH',
  },
  {
    stateKey: 'karnataka',
    stateName: 'Karnataka',
    capital: 'Bengaluru',
    coordinates: [77.5946, 12.9716],
    isoCode: 'IN-KA',
    hasCityData: true, // Bengaluru has ward-level data
  },
  {
    stateKey: 'kerala',
    stateName: 'Kerala',
    capital: 'Thiruvananthapuram',
    coordinates: [76.9366, 8.5241],
    isoCode: 'IN-KL',
  },
  {
    stateKey: 'madhya pradesh',
    stateName: 'Madhya Pradesh',
    capital: 'Bhopal',
    coordinates: [77.4126, 23.2599],
    isoCode: 'IN-MP',
  },
  {
    stateKey: 'maharashtra',
    stateName: 'Maharashtra',
    capital: 'Mumbai',
    coordinates: [72.8777, 19.076],
    isoCode: 'IN-MH',
    hasCityData: true, // Mumbai & Pune have ward-level data
  },
  {
    stateKey: 'manipur',
    stateName: 'Manipur',
    capital: 'Imphal',
    coordinates: [93.9368, 24.817],
    isoCode: 'IN-MN',
  },
  {
    stateKey: 'meghalaya',
    stateName: 'Meghalaya',
    capital: 'Shillong',
    coordinates: [91.8933, 25.5788],
    isoCode: 'IN-ML',
  },
  {
    stateKey: 'mizoram',
    stateName: 'Mizoram',
    capital: 'Aizawl',
    coordinates: [92.7176, 23.7271],
    isoCode: 'IN-MZ',
  },
  {
    stateKey: 'nagaland',
    stateName: 'Nagaland',
    capital: 'Kohima',
    coordinates: [94.1086, 25.6647],
    isoCode: 'IN-NL',
  },
  {
    stateKey: 'odisha',
    stateName: 'Odisha',
    capital: 'Bhubaneswar',
    coordinates: [85.8245, 20.2961],
    isoCode: 'IN-OR',
  },
  {
    stateKey: 'punjab',
    stateName: 'Punjab',
    capital: 'Chandigarh',
    coordinates: [76.7794, 30.7333],
    isoCode: 'IN-PB',
  },
  {
    stateKey: 'rajasthan',
    stateName: 'Rajasthan',
    capital: 'Jaipur',
    coordinates: [75.7873, 26.9124],
    isoCode: 'IN-RJ',
  },
  {
    stateKey: 'sikkim',
    stateName: 'Sikkim',
    capital: 'Gangtok',
    coordinates: [88.6065, 27.3389],
    isoCode: 'IN-SK',
  },
  {
    stateKey: 'tamil nadu',
    stateName: 'Tamil Nadu',
    capital: 'Chennai',
    coordinates: [80.2707, 13.0827],
    isoCode: 'IN-TN',
    hasCityData: true, // Chennai & Coimbatore have ward-level data
  },
  {
    stateKey: 'telangana',
    stateName: 'Telangana',
    capital: 'Hyderabad',
    coordinates: [78.4867, 17.385],
    isoCode: 'IN-TG',
  },
  {
    stateKey: 'tripura',
    stateName: 'Tripura',
    capital: 'Agartala',
    coordinates: [91.2868, 23.8315],
    isoCode: 'IN-TR',
  },
  {
    stateKey: 'uttar pradesh',
    stateName: 'Uttar Pradesh',
    capital: 'Lucknow',
    coordinates: [80.9462, 26.8467],
    isoCode: 'IN-UP',
  },
  {
    stateKey: 'uttarakhand',
    stateName: 'Uttarakhand',
    capital: 'Dehradun',
    coordinates: [78.0322, 30.3165],
    isoCode: 'IN-UT',
  },
  {
    stateKey: 'west bengal',
    stateName: 'West Bengal',
    capital: 'Kolkata',
    coordinates: [88.3639, 22.5726],
    isoCode: 'IN-WB',
    hasCityData: true, // Kolkata has ward-level data
  },

  // ─── 8 UNION TERRITORIES ──────────────────────────────────────
  {
    stateKey: 'andaman and nicobar islands',
    stateName: 'Andaman & Nicobar Islands',
    capital: 'Port Blair',
    coordinates: [92.7265, 11.6234],
    isoCode: 'IN-AN',
  },
  {
    stateKey: 'chandigarh',
    stateName: 'Chandigarh',
    capital: 'Chandigarh',
    coordinates: [76.7794, 30.7333],
    isoCode: 'IN-CH',
  },
  {
    stateKey: 'dadra and nagar haveli and daman and diu',
    stateName: 'Dadra & Nagar Haveli and Daman & Diu',
    capital: 'Daman',
    coordinates: [72.8328, 20.3974],
    isoCode: 'IN-DH',
  },
  {
    stateKey: 'delhi',
    stateName: 'Delhi',
    capital: 'New Delhi',
    coordinates: [77.209, 28.6139],
    isoCode: 'IN-DL',
  },
  {
    stateKey: 'jammu and kashmir',
    stateName: 'Jammu & Kashmir',
    capital: 'Srinagar',
    coordinates: [74.7973, 34.0837],
    isoCode: 'IN-JK',
  },
  {
    stateKey: 'ladakh',
    stateName: 'Ladakh',
    capital: 'Leh',
    coordinates: [77.5772, 34.1526],
    isoCode: 'IN-LA',
  },
  {
    stateKey: 'lakshadweep',
    stateName: 'Lakshadweep',
    capital: 'Kavaratti',
    coordinates: [72.6358, 10.5669],
    isoCode: 'IN-LD',
  },
  {
    stateKey: 'puducherry',
    stateName: 'Puducherry',
    capital: 'Puducherry',
    coordinates: [79.8083, 11.9416],
    isoCode: 'IN-PY',
  },
];

/** Lookup map: stateKey → StateCapital (for O(1) access) */
export const STATE_CAPITALS_BY_KEY: Record<string, StateCapital> = Object.fromEntries(
  INDIA_STATE_CAPITALS.map((s) => [s.stateKey, s])
);

/** All states that do NOT have city-level ward monitoring (need capital-point NWP) */
export const UNMONITORED_STATES = INDIA_STATE_CAPITALS.filter((s) => !s.hasCityData);

/** All 36 states/UTs that should receive some form of telemetry */
export const ALL_STATES_COUNT = INDIA_STATE_CAPITALS.length;
