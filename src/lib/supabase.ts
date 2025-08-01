import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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