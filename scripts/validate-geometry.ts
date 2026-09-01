/**
 * HeatPulse — GeoJSON Validation Script
 *
 * Validates all GeoJSON files in data/raw/ and data/processed/.
 * Checks: structure, CRS, polygon validity, feature counts.
 *
 * Usage:
 *   node scripts/validate-geometry.ts
 *   node scripts/validate-geometry.ts data/raw/pune_wards/pune-admin-wards.geojson
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

type GeoJsonType = 'FeatureCollection' | 'Feature' | 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon' | 'GeometryCollection'

interface ValidationResult {
  file: string
  valid: boolean
  errors: string[]
  warnings: string[]
  stats: Record<string, unknown>
}

function validateFeatureCollection(data: unknown, filePath: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const stats: Record<string, unknown> = {}

  if (!data || typeof data !== 'object') {
    return { file: filePath, valid: false, errors: ['Not a valid JSON object'], warnings: [], stats: {} }
  }

  const obj = data as Record<string, unknown>

  // Check type
  if (obj.type !== 'FeatureCollection') {
    errors.push(`Expected type "FeatureCollection", got "${obj.type}"`)
  }

  // Check features
  if (!Array.isArray(obj.features)) {
    errors.push('Missing "features" array')
    return { file: filePath, valid: false, errors, warnings, stats }
  }

  stats.featureCount = obj.features.length

  for (let i = 0; i < obj.features.length; i++) {
    const feature = obj.features[i] as Record<string, unknown>

    if (feature.type !== 'Feature') {
      errors.push(`Feature ${i}: expected type "Feature", got "${feature.type}"`)
    }

    if (!feature.geometry) {
      errors.push(`Feature ${i}: missing geometry`)
      continue
    }

    const geom = feature.geometry as Record<string, unknown>
    const geomType = geom.type as GeoJsonType

    // Validate coordinates exist
    if (!Array.isArray(geom.coordinates)) {
      errors.push(`Feature ${i}: coordinates is not an array`)
      continue
    }

    // Polygon-specific validation
    if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
      const coords = geom.coordinates as unknown[][][]
      const rings = geomType === 'Polygon' ? [coords] : coords

      for (let r = 0; r < rings.length; r++) {
        for (let ringIdx = 0; ringIdx < rings[r].length; ringIdx++) {
          const ring = rings[r][ringIdx] as [number, number][]
          if (ring.length < 4) {
            errors.push(`Feature ${i}, ring ${r},${ringIdx}: fewer than 4 coordinates (need闭合 ring)`)
          }
          if (ring.length > 0) {
            const first = ring[0]
            const last = ring[ring.length - 1]
            if (first[0] !== last[0] || first[1] !== last[1]) {
              errors.push(`Feature ${i}, ring ${r},${ringIdx}: ring not closed (first != last)`)
            }
          }
          // Check for valid lat/lon range
          for (let c = 0; c < ring.length; c++) {
            const [lon, lat] = ring[c]
            if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
              errors.push(`Feature ${i}, coord ${c}: out of range ([${lon}, ${lat}])`)
            }
          }
        }
      }
    }

    // Check properties
    if (!feature.properties) {
      warnings.push(`Feature ${i}: missing properties`)
    }
  }

  // Check CRS if present
  if (obj.crs) {
    const crs = obj.crs as Record<string, unknown>
    const crsProps = crs.properties as Record<string, unknown> | undefined
    if (crs.type === 'name' && crsProps?.name === 'EPSG:4326') {
      stats.crs = 'EPSG:4326'
    } else {
      warnings.push(`Unexpected CRS: ${JSON.stringify(crs)}`)
    }
  } else {
    warnings.push('No CRS defined — assuming EPSG:4326 (WGS 84)')
  }

  return { file: filePath, valid: errors.length === 0, errors, warnings, stats }
}

function validateFile(filePath: string): ValidationResult {
  if (!existsSync(filePath)) {
    return { file: filePath, valid: false, errors: [`File not found: ${filePath}`], warnings: [], stats: {} }
  }

  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    return validateFeatureCollection(data, filePath)
  } catch (e) {
    return { file: filePath, valid: false, errors: [`JSON parse error: ${String(e)}`], warnings: [], stats: {} }
  }
}

function main() {
  const args = process.argv.slice(2)
  const targets = args.length > 0 ? args : [
    'data/raw',
    'data/processed',
    'public/data',
  ]

  const results: ValidationResult[] = []
  let totalFiles = 0
  let validFiles = 0

  for (const target of targets) {
    const fullPath = join(process.cwd(), target)
    if (!existsSync(fullPath)) {
      console.warn(`Warning: ${fullPath} does not exist`)
      continue
    }

    if (target.endsWith('.geojson') || target.endsWith('.json')) {
      results.push(validateFile(fullPath))
      totalFiles++
    } else {
      // Recurse into directory
      const files = readdirSync(fullPath).filter(f => f.endsWith('.geojson') || f.endsWith('.json'))
      for (const file of files) {
        const filePath = join(fullPath, file)
        const result = validateFile(filePath)
        results.push(result)
        totalFiles++
      }
    }
  }

  // Report
  console.log('HeatPulse — GeoJSON Validation Report')
  console.log('=====================================')
  console.log(`Scanned: ${totalFiles} files`)
  console.log('')

  for (const r of results) {
    const status = r.valid ? '✅ PASS' : '❌ FAIL'
    console.log(`${status} ${r.file}`)
    if (r.stats.featureCount) console.log(`  Features: ${r.stats.featureCount}`)
    if (r.stats.crs) console.log(`  CRS: ${r.stats.crs}`)
    for (const w of r.warnings) {
      console.log(`  ⚠️  ${w}`)
    }
    for (const e of r.errors) {
      console.log(`  ❌ ${e}`)
    }
    console.log('')
    if (r.valid) validFiles++
  }

  console.log(`Results: ${validFiles}/${totalFiles} valid`)

  if (validFiles !== totalFiles) {
    process.exit(1)
  }
}

main()
