/**
 * HeatPulse — OpenLayers map configuration helpers
 *
 * Bhuvan WMS is used as a CONTEXTUAL basemap only.
 * Authoritative geography comes from verified vector sources
 * (SimplyGIS + datameet), rendered as vector overlays.
 */
import 'ol/ol.css'
import Map from 'ol/Map'
import View from 'ol/View'
import { transform } from 'ol/proj'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM'
import GeoJSON from 'ol/format/GeoJSON'
import { Fill, Stroke, Style, Text } from 'ol/style'
import Zoom from 'ol/control/Zoom'
import ScaleLine from 'ol/control/ScaleLine'

export const BHUVAN_WMS_URL = process.env.NEXT_PUBLIC_BHUVAN_WMS_URL!
export const PUNE_CENTER: [number, number] = [73.8567, 18.5204]
export const PUNE_ZOOM = 11

export function toWebMercator(lon: number, lat: number): [number, number] {
  return transform([lon, lat], 'EPSG:4326', 'EPSG:3857') as [number, number]
}

export function createBaseLayer() {
  return new TileLayer({
    source: new OSM({ attributions: '© OpenStreetMap contributors' }),
  })
}

/**
 * Create a Bhuvan WMS tile layer.
 * The URL is computed from tile coordinates via WMS GetMap with BBOX in EPSG:4326.
 */
export function createBhuvanLayer(layerName: string) {
  // Use Ol UrlTile subclass for custom URL computation
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const UrlTile = require('ol/source/UrlTile').default
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const TileGrid = require('ol/tilegrid/TileGrid').default

  const extent = [-20037508.34, -20037508.34, 20037508.34, 20037508.34]
  const resolutions = Array.from({ length: 23 }, (_, z) =>
    (extent[2] - extent[0]) / (256 * Math.pow(2, z))
  )

  const tileGrid = new TileGrid({
    extent,
    resolutions,
    origin: [extent[0], extent[3]],
    tileSizes: [256],
  })

  const source = new UrlTile({
    tileGrid,
    getTileUrl: (tileCoord: import('ol/tilecoord').TileCoord) => {
      const [z, x, y] = tileCoord
      const resolution = resolutions[z]
      const minX = extent[0] + x * 256 * resolution
      const minY = extent[1] + (1 - y) * 256 * resolution // y is flipped in OGC
      const maxX = extent[0] + (x + 1) * 256 * resolution
      const maxY = extent[1] + (1 - (y + 1)) * 256 * resolution
      // Convert Web Mercator to EPSG:4326
      const ll = transform([minX, minY], 'EPSG:3857', 'EPSG:4326')
      const ur = transform([maxX, maxY], 'EPSG:3857', 'EPSG:4326')
      return `${BHUVAN_WMS_URL}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layerName}&SRS=EPSG:4326&WIDTH=256&HEIGHT=256&BBOX=${ll[0]},${ll[1]},${ur[0]},${ur[1]}`
    },
    crossOrigin: 'anonymous',
  })

  return new TileLayer({ source, visible: false, zIndex: 0 })
}

export function createAdminWardsLayer(geojsonData: GeoJSON.FeatureCollection): VectorLayer {
  const source = new VectorSource({
    features: new GeoJSON().readFeatures(geojsonData, { featureProjection: 'EPSG:3857' }),
  })
  return new VectorLayer({
    source,
    zIndex: 10,
    style: (feature) => {
      const name = (feature.get('Name') || feature.get('name') || 'Unknown') as string
      return new Style({
        fill: new Fill({ color: 'rgba(255, 100, 50, 0.12)' }),
        stroke: new Stroke({ color: 'rgba(255, 80, 30, 0.85)', width: 1.5 }),
        text: new Text({
          text: name.replace('Admin Ward ', ''),
          textAlign: 'center',
          overflow: true,
          scale: 0.9,
          fill: new Fill({ color: '#1a1a1a' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
        }),
      })
    },
  })
}

export function initMap(containerId: string, additionalLayers: import('ol/layer/Base').default[] = []): Map {
  const view = new View({
    center: toWebMercator(...PUNE_CENTER),
    zoom: PUNE_ZOOM,
    minZoom: 8,
    maxZoom: 18,
  })
  return new Map({
    target: containerId,
    layers: [createBaseLayer(), ...additionalLayers],
    view,
    controls: [new Zoom(), new ScaleLine()],
  })
}
