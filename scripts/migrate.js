/**
 * HeatPulse — Supabase Migration Runner
 *
 * Runs the initial schema migration against the Supabase project.
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local
 *
 * Run: node scripts/migrate.js
 *
 * Prerequisites:
 *   - Docker Desktop or Podman installed (for local Supabase)
 *   - OR access to the Supabase dashboard SQL editor
 *
 * If Docker is unavailable, run the SQL manually at:
 *   https://app.supabase.com/project/braiktcmrtvnlwsioxtm/sql/new
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('@supabase/supabase-js')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SECRET) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in environment')
  console.error('Copy .env.local values and run again, or use the Supabase dashboard.')
  process.exit(1)
}

// Supabase client created for future use (migration runs via REST API)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET)

async function runMigration() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  console.log('HeatPulse — Supabase Migration Runner')
  console.log(`Project: ${SUPABASE_URL}`)
  console.log(`SQL file: ${sqlPath}`)
  console.log(`SQL length: ${sql.length} characters`)
  console.log('')

  // The Supabase JS client cannot execute raw SQL directly.
  // We provide the SQL for manual execution via the dashboard.
  console.log('The Supabase JS client does not support raw SQL execution.')
  console.log('Please copy the SQL below and run it in the Supabase dashboard:')
  console.log(`  ${SUPABASE_URL.replace('/rest/v1', '')}/sql/new`)
  console.log('')
  console.log('--- MIGRATION SQL ---')
  console.log(sql)
  console.log('--- END SQL ---')
  console.log('')
  console.log('After running the migration, verify with:')
  console.log(`  SELECT COUNT(*) FROM wards;`)
  console.log(`  SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';`)
}

runMigration()
