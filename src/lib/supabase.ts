import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and Anon Key must be defined in .env file')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

export type Paper = Database['public']['tables']['papers']['Row']
export type PaperAnalysis = Database['public']['tables']['paper_analysis']['Row']
export type UserFavorite = Database['public']['tables']['user_favorites']['Row']

export async function getPaperAnalysis(paperId: string): Promise<PaperAnalysis | null> {
  const { data, error } = await supabase
    .from('paper_analysis')
    .select('*')
    .eq('paper_id', paperId)
    .single()

  if (error && error.code !== 'PGRST116') { // Ignore 'exact one row expected' error
    console.error('Error fetching paper analysis:', error)
    return null
  }

  return data
}

export async function addFavorite(userId: string, paperId: string) {
  const { data, error } = await supabase
    .from('user_favorites')
    .insert([{ user_id: userId, paper_id: paperId }])

  if (error) {
    console.error('Error adding favorite:', error)
    throw error
  }
  return data
}

export async function removeFavorite(userId: string, paperId: string) {
  const { data, error } = await supabase
    .from('user_favorites')
    .delete()
    .match({ user_id: userId, paper_id: paperId })

  if (error) {
    console.error('Error removing favorite:', error)
    throw error
  }
  return data
}

export interface Profile {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  created_at: string
  updated_at: string
}

export interface UserCollection {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  name: string
  created_at: string
}

export interface PaperTag {
  id: string
  paper_id: string
  tag_id: string
  created_at: string
}
