# Map Engine Decision — Phase 5

**Date**: 2026-09-01
**Decision**: OpenLayers v10

---

## Evaluation Criteria

| Criteria | OpenLayers v10 | MapLibre GL | Leaflet |
|---|---|---|---|
| Bhuvan WMS support | ✅ Native OGC GetMap | ⚠️ Requires custom tile source | ✅ Plugin available |
| Feature picking | ✅ `forEachFeatureAtPixel` | ✅ Native | ⚠️ Plugin needed |
| Vector styling | ✅ Excellent | ✅ Excellent (GPU) | ⚠️ Basic |
| React integration | ✅ Direct (no wrapper needed) | ✅ ol-react exists | ✅ react-leaflet |
| Performance | ✅ Good (Canvas renderer) | ✅ Excellent (WebGL) | ✅ Good |
| Zoom/viewport control | ✅ Full control | ✅ Full control | ✅ Full control |
| SSR compatibility | ✅ `dynamic({ ssr: false })` | ⚠️ Needs wrapper | ✅ Works |
| Bundle size | ~120KB gzipped | ~80KB gzipped | ~40KB gzipped |
| Learning curve | Steep | Moderate | Gentle |
| Community | Large, mature | Growing | Largest |

## Evidence from Prototype

Phase 4 prototype tested OpenLayers with:
- ✅ OSM basemap loads correctly
- ✅ Vector layer (admin wards) renders with labels
- ✅ Click-to-select feature works
- ✅ Hover cursor changes on ward hover
- ✅ Bhuvan WMS URL template generated correctly
- ✅ SSR-safe via `next/dynamic` with `ssr: false`
- ✅ Build passes with 0 TypeScript errors
- ✅ No console errors at runtime

## Decision

**OpenLayers v10** is the map engine for HeatPulse.

### Rationale
1. **Bhuvan WMS** — OpenLayers has native `UrlTile` support for custom WMS URL generation with BBOX calculation. No plugins needed.
2. **Feature picking** — `map.forEachFeatureAtPixel` is robust and well-documented for ward identification on click.
3. **SSR compatibility** — Works cleanly with Next.js `dynamic({ ssr: false })`. No wrapper library dependency.
4. **Build quality** — v10 is the latest stable, tree-shakeable, with good TypeScript support.

### Known Limitations
- Larger bundle than Leaflet (~120KB vs ~40KB gzipped). Mitigated by code-splitting.
- Steeper learning curve. Mitigated by documented patterns in `src/lib/map-config.ts`.
- No built-in WebGL vector rendering. For future high-density data, consider MapLibre as secondary engine.

## Files
- `src/lib/map-config.ts` — Map initialization, layer factory functions
- `src/components/map/MapContainer.tsx` — SSR-safe map component
- `src/components/map/MapComponent.tsx` — Dynamic import wrapper
