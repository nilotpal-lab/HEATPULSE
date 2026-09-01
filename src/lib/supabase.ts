/**
 * HeatPulse — Supabase client (server-side singleton)
 *
 * ⚠️ This file is imported ONLY from server-side code (API routes,
 * server components). The service-role key must NEVER reach the browser.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!

// Public client (anon key) — used in server components for read operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
})

// Service-role client — server-only, used for writes and privileged reads
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})
