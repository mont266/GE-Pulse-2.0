import { createClient } from '@supabase/supabase-js';
import type { AppStats, LeaderboardEntry, LeaderboardTimeRange, StatsTimeRange, Achievement, ProgressionNotificationData } from '../types';

// The 'Json' type is not directly exported from '@supabase/supabase-js' in v2.
// This is the standard definition required for the Database type.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// --- Database Type Definition ---
// This Database type definition has been corrected to fix type inference issues.
// The relationships between tables are now correctly defined, which is crucial
// for the Supabase client to understand the data model and provide accurate types
// for queries, inserts, and updates.
export type Database = {
  public: {
    Tables: {
      achievements: {
        Row: {
          id: number
          name: string
          description: string
          icon_name: string
          xp_reward: number
          type: string | null
          threshold: number | null
        }
        Insert: {
          id?: number
          name: string
          description: string
          icon_name: string
          xp_reward: number
          type?: string | null
          threshold?: number | null
        }
        Update: {
          id?: number
          name?: string
          description?: string
          icon_name?: string
          xp_reward?: number
          type?: string | null
          threshold?: number | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      investments: {
        Row: {
          created_at: string
          id: string
          item_id: number
          purchase_date: string
          purchase_price: number
          quantity: number
          sell_date: string | null
          sell_price: number | null
          tax_paid: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: number
          purchase_date: string
          purchase_price: number
          quantity: number
          sell_date?: string | null
          sell_price?: number | null
          tax_paid?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: number
          purchase_date?: string
          purchase_price?: number
          quantity?: number
          sell_date?: string | null
          sell_price?: number | null
          tax_paid?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      posts: {
        Row: {
          content: string | null
          created_at: string
          flip_data: Json | null
          id: string
          title: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          flip_data?: Json | null
          id?: string
          title?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          flip_data?: Json | null
          id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          username: string | null
          developer: boolean
          beta_tester: boolean
          banned: boolean
          // FIX: Add missing 'premium' column to align with application types and queries.
          premium: boolean
          xp: number
          level: number
          login_streak: number
          last_login_date: string | null
          daily_activity_counts: Json | null
          tokens: number
        }
        Insert: {
          id: string
          username?: string | null
          developer?: boolean
          beta_tester?: boolean
          banned?: boolean
          // FIX: Add missing 'premium' column to align with application types and queries.
          premium?: boolean
          xp?: number
          level?: number
          login_streak?: number
          last_login_date?: string | null
          daily_activity_counts?: Json | null
          tokens?: number
        }
        Update: {
          id?: string
          username?: string | null
          developer?: boolean
          beta_tester?: boolean
          banned?: boolean
          // FIX: Add missing 'premium' column to align with application types and queries.
          premium?: boolean
          xp?: number
          level?: number
          login_streak?: number
          last_login_date?: string | null
          daily_activity_counts?: Json | null
          tokens?: number
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          user_id: string
          achievement_id: number
          earned_at: string
        }
        Insert: {
          user_id: string
          achievement_id: number
          earned_at?: string
        }
        Update: {
          user_id?: string
          achievement_id?: number
          earned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      watchlists: {
        Row: {
          created_at: string
          id: number
          item_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          item_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          item_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlists_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_app_stats: {
        Args: {
          time_range: StatsTimeRange
        }
        Returns: {
            totalUsers: number
            newUsers: number
            totalInvestments: number
            closedTrades: number
            totalProfit: number
            totalTax: number
            totalWatchlistItems: number
        }
      }
      get_leaderboard: {
        Args: {
          time_range: LeaderboardTimeRange
        }
        Returns: {
            rank: number
            username: string
            total_profit: number
        }[]
      }
      get_user_achievement_progress: {
        Args: {
          p_user_id: string
        }
        Returns: Json
      }
      set_user_role: {
        Args: {
          target_user_id: string
          role: "developer" | "beta_tester"
          status: boolean
        }
        Returns: void
      }
      ban_user: {
        Args: {
          target_user_id: string
        }
        Returns: void
      }
      record_daily_login: {
          Args: { p_user_id: string }
          Returns: Json
      }
      record_activity: {
          Args: { p_user_id: string, p_activity_type: 'watchlist_add' | 'alert_set_high' | 'alert_set_low' }
          Returns: Json
      }
      process_closed_trade: {
          Args: { p_user_id: string, p_profit: number, p_trade_value: number }
          Returns: Json
      }
      spend_ai_token: {
          Args: { p_user_id: string }
          Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}


// --- IMPORTANT ---
// 1. Create a project at https://supabase.com/
// 2. Go to your project's "Project Settings"
// 3. Go to the "API" section
// 4. Find your "Project URL" and "anon" "public" key
// 5. Paste them as strings into the variables below

const supabaseUrl = 'https://ascgkrirlbrffbuizgnm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY2drcmlybGJyZmZidWl6Z25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MjMyNTAsImV4cCI6MjA2ODE5OTI1MH0.XWpApEJMRK7czCU-3y5OmFhH2qjjOUU2N8hv7Ss8udg';

// --- END OF CONFIG  ---

if (supabaseUrl === 'https://ascgkrirlbrffbuizgnm.supabase.co' || supabaseAnonKey === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY2drcmlybGJyZmZidWl6Z25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MjMyNTAsImV4cCI6MjA2ODE5OTI1MH0.XWpApEJMRK7czCU-3y5OmFhH2qjjOUU2N8hv7Ss8udg') {
    console.warn("Supabase credentials are not set. Please update services/supabase.ts. Authentication will not work.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
