export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          username: string
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          website: string | null
          suburb: string | null
          city: string | null
          country: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          website?: string | null
          suburb?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          website?: string | null
          suburb?: string | null
          city?: string | null
          country?: string | null
          updated_at?: string
        }
      }
      restaurants: {
        Row: {
          id: string
          name: string
          address: string | null
          city: string | null
          country: string | null
          latitude: number | null
          longitude: number | null
          google_place_id: string | null
          cuisine_type: string | null
          price_range: number | null
          google_rating: number | null
          google_review_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          city?: string | null
          country?: string | null
          latitude?: number | null
          longitude?: number | null
          google_place_id?: string | null
          cuisine_type?: string | null
          price_range?: number | null
          google_rating?: number | null
          google_review_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          city?: string | null
          country?: string | null
          latitude?: number | null
          longitude?: number | null
          google_place_id?: string | null
          cuisine_type?: string | null
          price_range?: number | null
          google_rating?: number | null
          google_review_count?: number | null
          updated_at?: string
        }
      }
      analytics_events: {
        Row: {
          id: string
          user_id: string | null
          event_type: string
          entity_type: string | null
          entity_id: string | null
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          event_type: string
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          event_type?: string
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Record<string, unknown> | null
        }
      }
      posts: {
        Row: {
          id: string
          user_id: string
          restaurant_id: string | null
          caption: string | null
          rating: number | null
          food_rating: number | null
          vibe_rating: number | null
          cost_rating: number | null
          cuisine_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          restaurant_id?: string | null
          caption?: string | null
          rating?: number | null
          food_rating?: number | null
          vibe_rating?: number | null
          cost_rating?: number | null
          cuisine_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          restaurant_id?: string | null
          caption?: string | null
          rating?: number | null
          food_rating?: number | null
          vibe_rating?: number | null
          cost_rating?: number | null
          cuisine_type?: string | null
          updated_at?: string
        }
      }
      post_photos: {
        Row: {
          id: string
          post_id: string
          url: string
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          url: string
          order_index?: number
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          url?: string
          order_index?: number
        }
      }
      hashtags: {
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
        }
      }
      post_hashtags: {
        Row: {
          post_id: string
          hashtag_id: string
        }
        Insert: {
          post_id: string
          hashtag_id: string
        }
        Update: {
          post_id?: string
          hashtag_id?: string
        }
      }
      likes: {
        Row: {
          id: string
          user_id: string
          post_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          post_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          post_id?: string
        }
      }
      saves: {
        Row: {
          id: string
          user_id: string
          post_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          post_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          post_id?: string
        }
      }
      saved_locations: {
        Row: {
          id: string
          user_id: string
          restaurant_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          restaurant_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          restaurant_id?: string
        }
      }
      follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          id?: string
          follower_id?: string
          following_id?: string
        }
      }
      comments: {
        Row: {
          id: string
          user_id: string
          post_id: string
          parent_comment_id: string | null
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          post_id: string
          parent_comment_id?: string | null
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          post_id?: string
          parent_comment_id?: string | null
          content?: string
          updated_at?: string
        }
      }
      user_settings: {
        Row: {
          id: string
          notif_likes: boolean
          notif_comments: boolean
          notif_followers: boolean
          notif_mentions: boolean
          private_account: boolean
          allow_comments: boolean
          allow_tags: boolean
          dark_mode: boolean
          updated_at: string
        }
        Insert: {
          id: string
          notif_likes?: boolean
          notif_comments?: boolean
          notif_followers?: boolean
          notif_mentions?: boolean
          private_account?: boolean
          allow_comments?: boolean
          allow_tags?: boolean
          dark_mode?: boolean
          updated_at?: string
        }
        Update: {
          notif_likes?: boolean
          notif_comments?: boolean
          notif_followers?: boolean
          notif_mentions?: boolean
          private_account?: boolean
          allow_comments?: boolean
          allow_tags?: boolean
          dark_mode?: boolean
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
