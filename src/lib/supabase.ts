import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://scqsayezaiiqfwqbrsef.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcXNheWV6YWlpcWZ3cWJyc2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNDEzNjAsImV4cCI6MjA3NzYxNzM2MH0.0Ot6l8PL3hAtFhrfaiLysDIBVD9ErUx2yjs-wrcJDXU";

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types
export interface Paper {
  id: string
  title: string
  authors: string[]
  abstract: string
  pdf_url: string
  published_date: string
  doi: string | null
  source_url: string
  created_at: string
  updated_at: string
}

export interface PaperAnalysis {
  id: string
  paper_id: string
  title_cn: string | null
  main_institutions: string[] | null
  abstract_cn: string | null
  insights: string | null
  solutions: string | null
  limitations: string | null
  prospects: string | null
  analyzed_at: string
  created_at: string
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
