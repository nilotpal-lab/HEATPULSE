/**
 * HeatPulse — Seed Ward Data into Supabase
 *
 * Inserts the 15 Pune admin wards into the `wards` table.
 * Uses the service-role key (SERVER ONLY — never in browser).
 *
 * Usage:
 *   node scripts/seed-wards.js
 *
 * Prerequisites:
 *   - Supabase migration 001 already run
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('@supabase/supabase-js')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path')

// Load .env.local manually (Node.js doesn't auto-load it)
const dotenvPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(dotenvPath)) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require('dotenv')
  dotenv.config({ path: dotenvPath })
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SECRET) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in environment')
  console.error('Copy values from .env.local and run again.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET)

// Ward data from datameet/Pune_wards (CC BY-SA 2.5)
const WARD_DATA = {
  'Admin Ward 01 Aundh': { number: 1, centroid: [73.794912, 18.546629] },
  'Admin Ward 02 Ghole Road': { number: 2, centroid: [73.838754, 18.528272] },
  'Admin Ward 03 Kothrud Karveroad': { number: 3, centroid: [73.791945, 18.507793] },
  'Admin Ward 04 Warje Karvenagar': { number: 4, centroid: [73.801629, 18.486947] },
  'Admin Ward 05 Dhole Patil Rd': { number: 5, centroid: [73.901619, 18.524145] },
  'Admin Ward 06 Yerawda - Sangamwadi': { number: 6, centroid: [73.902004, 18.581501] },
  'Admin Ward 07 Nagar Road': { number: 7, centroid: [73.920051, 18.558605] },
  'Admin Ward 08 KasbaVishrambaugwada': { number: 8, centroid: [73.855316, 18.510498] },
  'Admin Ward 09 Tilak Road': { number: 9, centroid: [73.822011, 18.470012] },
  'Admin Ward 10 Sahakarnagar': { number: 10, centroid: [73.851231, 18.488732] },
  'Admin Ward 11 Bibwewadi': { number: 11, centroid: [73.867769, 18.478054] },
  'Admin Ward 12 Bhavani Peth': { number: 12, centroid: [73.867657, 18.511321] },
  'Admin Ward 13 Hadapsar': { number: 13, centroid: [73.924187, 18.483092] },
  'Admin Ward 14 Dhankawadi': { number: 14, centroid: [73.858523, 18.446191] },
  'Admin Ward 15 Kondhwa Wanavdi': { number: 15, centroid: [73.896593, 18.483268] },
}

async function seedWards() {
  console.log('HeatPulse — Ward Seeding')
  console.log(`Project: ${SUPABASE_URL}`)
  console.log('')

  // Load ward boundaries
  const geoPath = path.join(__dirname, '..', 'public', 'data', 'pune-admin-wards.geojson')
  if (!fs.existsSync(geoPath)) {
    console.error('ERROR: public/data/pune-admin-wards.geojson not found')
    process.exit(1)
  }

  const geo = JSON.parse(fs.readFileSync(geoPath, 'utf-8'))
  console.log(`Loaded ${geo.features.length} wards from GeoJSON`)

  // Check existing wards
  const { data: existing, error: fetchError } = await supabase
    .from('wards')
    .select('name')

  if (fetchError) {
    console.error('ERROR fetching existing wards:', fetchError.message)
    console.log('Run the migration first, then retry.')
    process.exit(1)
  }

  const existingNames = new Set((existing || []).map((w) => w.name))
  console.log(`Existing wards in DB: ${existingNames.size}`)

  // Insert missing wards
  let inserted = 0
  for (const feature of geo.features) {
    const name = feature.properties.name
    if (existingNames.has(name)) continue

    const centroid = WARD_DATA[name]?.centroid ?? [73.8567, 18.5204]
    const wardNumber = WARD_DATA[name]?.number ?? 0

    const { error: insertError } = await supabase
      .from('wards')
      .insert({
        name,
        ward_number: wardNumber,
        centroid: `POINT(${centroid[0]} ${centroid[1]})`,
        boundary: feature.geometry,
        source: 'datameet/Pune_wards',
        source_url: 'https://github.com/datameet/Pune_wards',
        verified_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error(`  ❌ Failed to insert ${name}: ${insertError.message}`)
    } else {
      console.log(`  ✅ Inserted: ${name}`)
      inserted++
    }
  }

  console.log('')
  console.log(`Seeding complete: ${inserted} new wards inserted`)
  console.log(`Total wards in DB: ${existingNames.size + inserted}`)
}

seedWards().catch((err) => {
  console.error('Seeding failed:', err.message)
  process.exit(1)
})
