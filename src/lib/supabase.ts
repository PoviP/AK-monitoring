import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'your_supabase_url_here' && supabaseAnonKey !== 'your_supabase_anon_key_here')

// Create a mock client if Supabase is not configured
const createMockClient = () => ({
  auth: {
    signUp: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    signOut: () => Promise.resolve({ error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
  },
  from: () => ({
    select: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    update: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    delete: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } })
  })
})

export const supabase = isSupabaseConfigured 
  ? createMockClient()
  : createMockClient()

export type Database = {
  public: {
    Tables: {
      mythic_keys: {
        Row: {
          id: string
          user_id: string
          character_name: string
          key_level: number
          dungeon_name: string
          dungeon_id: number
          last_updated: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          character_name: string
          key_level: number
          dungeon_name: string
          dungeon_id: number
          last_updated?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          character_name?: string
          key_level?: number
          dungeon_name?: string
          dungeon_id?: number
          last_updated?: string
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          user_id: string
          display_name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          display_name: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          display_name?: string
          created_at?: string
        }
      }
    }
  }
}