import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/** Public Supabase demo anon key — only used when env is missing so createClient never receives invalid URLs. */
const PLACEHOLDER_URL = 'https://demo.supabase.co'
const PLACEHOLDER_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase env vars are missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Auth and data features are disabled until then.',
  )
}

const authOptions = isSupabaseConfigured
  ? {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  : {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    }

export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? (supabaseUrl as string) : PLACEHOLDER_URL,
  isSupabaseConfigured ? (supabaseAnonKey as string) : PLACEHOLDER_KEY,
  {
    auth: authOptions,
    realtime: { params: { eventsPerSecond: 10 } },
  },
)
