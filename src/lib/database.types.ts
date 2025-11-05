export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      papers: {
        Row: {
          id: string
          title: string
          abstract: string | null
          authors: string[]
          published_date: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          abstract?: string | null
          authors?: string[]
          published_date: string
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          abstract?: string | null
          authors?: string[]
          published_date?: string
          created_at?: string
        }
        Relationships: []
      }
      paper_analysis: {
        Row: {
          id: string
          paper_id: string
          title_cn: string | null
          abstract_cn: string | null
          main_institutions: string[] | null
          insights: string | null
          solutions: string | null
          limitations: string | null
          prospects: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          paper_id: string
          title_cn?: string | null
          abstract_cn?: string | null
          main_institutions?: string[] | null
          insights?: string | null
          solutions?: string | null
          limitations?: string | null
          prospects?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          paper_id?: string
          title_cn?: string | null
          abstract_cn?: string | null
          main_institutions?: string[] | null
          insights?: string | null
          solutions?: string | null
          limitations?: string | null
          prospects?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          id: string
          user_id: string
          paper_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          paper_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          paper_id?: string
          created_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      paper_tags: {
        Row: {
          id: string
          paper_id: string
          tag_id: string
          created_at: string
        }
        Insert: {
          id?: string
          paper_id: string
          tag_id: string
          created_at?: string
        }
        Update: {
          id?: string
          paper_id?: string
          tag_id?: string
          created_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          setting_key: string
          setting_value: string | null
          label: string | null
          description: string | null
          type: 'text' | 'textarea' | 'url' | string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          setting_key: string
          setting_value?: string | null
          label?: string | null
          description?: string | null
          type?: 'text' | 'textarea' | 'url' | string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          setting_key?: string
          setting_value?: string | null
          label?: string | null
          description?: string | null
          type?: 'text' | 'textarea' | 'url' | string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {
      get_popular_tags: {
        Args: { limit_count: number }
        Returns: { name: string; count: number }[]
      }
    }
    Enums: {}
    CompositeTypes: {}
  }
}