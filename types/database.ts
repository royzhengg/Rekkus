export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          event_version: number
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          event_version?: number
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          event_version?: number
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_audit_events: {
        Row: {
          context: Json | null
          created_at: string
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_audit_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_audit_events: {
        Row: {
          collection_id: string
          context: Json | null
          created_at: string
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          collection_id: string
          context?: Json | null
          created_at?: string
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          collection_id?: string
          context?: Json | null
          created_at?: string
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_audit_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          curator_note: string | null
          description: string | null
          display_order: number
          id: string
          is_staff_pick: boolean
          name: string
          share_slug: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          curator_note?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_staff_pick?: boolean
          name: string
          share_slug?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          curator_note?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_staff_pick?: boolean
          name?: string
          share_slug?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          deleted_reason: string | null
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_lifecycle_events: {
        Row: {
          context: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_lifecycle_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          priority: string
          reason: string
          report_type: string
          reporter_id: string | null
          shadow_mode: boolean
          source_surface: string
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          priority?: string
          reason: string
          report_type?: string
          reporter_id?: string | null
          shadow_mode?: boolean
          source_surface?: string
          status?: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          priority?: string
          reason?: string
          report_type?: string
          reporter_id?: string | null
          shadow_mode?: boolean
          source_surface?: string
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          archived_at: string | null
          conversation_id: string
          created_at: string
          id: string
          is_admin: boolean
          last_read_at: string | null
          last_read_message_id: string | null
          muted_until: string | null
          pinned_at: string | null
          request_decided_at: string | null
          request_status: string
          requested_at: string | null
          requested_by: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_admin?: boolean
          last_read_at?: string | null
          last_read_message_id?: string | null
          muted_until?: string | null
          pinned_at?: string | null
          request_decided_at?: string | null
          request_status?: string
          requested_at?: string | null
          requested_by?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          last_read_at?: string | null
          last_read_message_id?: string | null
          muted_until?: string | null
          pinned_at?: string | null
          request_decided_at?: string | null
          request_status?: string
          requested_at?: string | null
          requested_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_last_read_message_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_pinned_messages: {
        Row: {
          conversation_id: string
          id: string
          message_id: string
          pinned_at: string
          pinned_by: string | null
        }
        Insert: {
          conversation_id: string
          id?: string
          message_id: string
          pinned_at?: string
          pinned_by?: string | null
        }
        Update: {
          conversation_id?: string
          id?: string
          message_id?: string
          pinned_at?: string
          pinned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_pinned_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_pinned_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_pinned_messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          conversation_type: string
          created_at: string
          created_by: string | null
          direct_user_high: string | null
          direct_user_low: string | null
          id: string
          name: string | null
          pinned_message_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          conversation_type?: string
          created_at?: string
          created_by?: string | null
          direct_user_high?: string | null
          direct_user_low?: string | null
          id?: string
          name?: string | null
          pinned_message_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          conversation_type?: string
          created_at?: string
          created_by?: string | null
          direct_user_high?: string | null
          direct_user_low?: string | null
          id?: string
          name?: string | null
          pinned_message_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_direct_user_high_fkey"
            columns: ["direct_user_high"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_direct_user_low_fkey"
            columns: ["direct_user_low"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_pinned_message_id_fkey"
            columns: ["pinned_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      cuisine_aliases: {
        Row: {
          alias: string
          created_at: string
          cuisine_type: string
        }
        Insert: {
          alias: string
          created_at?: string
          cuisine_type: string
        }
        Update: {
          alias?: string
          created_at?: string
          cuisine_type?: string
        }
        Relationships: []
      }
      data_repair_events: {
        Row: {
          actor_id: string | null
          after_summary: Json
          audit_event_id: string | null
          before_summary: Json
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          issue_summary: string
          repair_type: string
          restaurant_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_type: string
          status: string
        }
        Insert: {
          actor_id?: string | null
          after_summary?: Json
          audit_event_id?: string | null
          before_summary?: Json
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          issue_summary: string
          repair_type: string
          restaurant_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type?: string
          status?: string
        }
        Update: {
          actor_id?: string | null
          after_summary?: Json
          audit_event_id?: string | null
          before_summary?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          issue_summary?: string
          repair_type?: string
          restaurant_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_repair_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_repair_events_audit_event_id_fkey"
            columns: ["audit_event_id"]
            isOneToOne: false
            referencedRelation: "restaurant_audit_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_repair_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_repair_events_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dish_audit_events: {
        Row: {
          context: Json | null
          created_at: string
          dish_id: string
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          dish_id: string
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          dish_id?: string
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dish_audit_events_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_audit_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes: {
        Row: {
          created_at: string
          created_by: string | null
          cuisine_type: string | null
          id: string
          name: string
          name_normalized: string | null
          restaurant_id: string | null
          search_tsv: unknown
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cuisine_type?: string | null
          id?: string
          name: string
          name_normalized?: string | null
          restaurant_id?: string | null
          search_tsv?: unknown
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cuisine_type?: string | null
          id?: string
          name?: string
          name_normalized?: string | null
          restaurant_id?: string | null
          search_tsv?: unknown
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dishes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dishes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag_audit_events: {
        Row: {
          context: Json
          created_at: string
          event_type: string
          flag_name: string
          id: string
          user_id: string | null
        }
        Insert: {
          context: Json
          created_at?: string
          event_type: string
          flag_name: string
          id?: string
          user_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          event_type?: string
          flag_name?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flag_audit_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag_overrides: {
        Row: {
          enabled: boolean
          expires_at: string | null
          flag_name: string
          reason: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled: boolean
          expires_at?: string | null
          flag_name: string
          reason: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          expires_at?: string | null
          flag_name?: string
          reason?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flag_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hashtags: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_deliveries: {
        Row: {
          delivered_at: string | null
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          delivered_at?: string | null
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          delivered_at?: string | null
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_deliveries_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_metadata: Json | null
          attachment_url: string | null
          body: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          id: string
          message_type: string
          reply_to_message_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_metadata?: Json | null
          attachment_url?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          message_type?: string
          reply_to_message_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_metadata?: Json | null
          attachment_url?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          message_type?: string
          reply_to_message_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action_type: string
          actor_id: string | null
          actor_type: string
          created_at: string
          id: string
          metadata: Json
          reason: string
          report_id: string | null
          reversible: boolean
          shadow_mode: boolean
          target_id: string
          target_type: string
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          reason: string
          report_id?: string | null
          reversible?: boolean
          shadow_mode?: boolean
          target_id: string
          target_type: string
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string
          report_id?: string | null
          reversible?: boolean
          shadow_mode?: boolean
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "content_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_appeals: {
        Row: {
          action_id: string | null
          appellant_id: string | null
          created_at: string
          id: string
          reason: string
          report_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_id?: string | null
          appellant_id?: string | null
          created_at?: string
          id?: string
          reason: string
          report_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_id?: string | null
          appellant_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          report_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_appeals_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "moderation_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_appeals_appellant_id_fkey"
            columns: ["appellant_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_appeals_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "content_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      post_draft_media: {
        Row: {
          created_at: string
          draft_id: string
          duration_ms: number | null
          height: number | null
          id: string
          is_cover: boolean
          local_id: string
          media_type: string
          mime_type: string | null
          order_index: number
          processing_error: string | null
          processing_status: string
          public_preview_url: string | null
          size_bytes: number | null
          storage_path: string
          thumbnail_url: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          draft_id: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          is_cover?: boolean
          local_id: string
          media_type: string
          mime_type?: string | null
          order_index?: number
          processing_error?: string | null
          processing_status?: string
          public_preview_url?: string | null
          size_bytes?: number | null
          storage_path: string
          thumbnail_url?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          draft_id?: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          is_cover?: boolean
          local_id?: string
          media_type?: string
          mime_type?: string | null
          order_index?: number
          processing_error?: string | null
          processing_status?: string
          public_preview_url?: string | null
          size_bytes?: number | null
          storage_path?: string
          thumbnail_url?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_draft_media_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "post_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_draft_media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_drafts: {
        Row: {
          best_dish: string
          body: string
          cost_rating: number
          created_at: string
          cuisine_type: string
          dish_tags: Json
          food_rating: number
          hashtag_input: string
          hashtags: string[]
          id: string
          last_saved_at: string | null
          occasion_tags: string[]
          restaurant_id: string | null
          selected_place: Json | null
          status: string
          taste_verdict: string | null
          title: string
          updated_at: string
          user_id: string
          value_verdict: string | null
          vibe_rating: number
        }
        Insert: {
          best_dish?: string
          body?: string
          cost_rating?: number
          created_at?: string
          cuisine_type?: string
          dish_tags?: Json
          food_rating?: number
          hashtag_input?: string
          hashtags?: string[]
          id?: string
          last_saved_at?: string | null
          occasion_tags?: string[]
          restaurant_id?: string | null
          selected_place?: Json | null
          status?: string
          taste_verdict?: string | null
          title?: string
          updated_at?: string
          user_id: string
          value_verdict?: string | null
          vibe_rating?: number
        }
        Update: {
          best_dish?: string
          body?: string
          cost_rating?: number
          created_at?: string
          cuisine_type?: string
          dish_tags?: Json
          food_rating?: number
          hashtag_input?: string
          hashtags?: string[]
          id?: string
          last_saved_at?: string | null
          occasion_tags?: string[]
          restaurant_id?: string | null
          selected_place?: Json | null
          status?: string
          taste_verdict?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          value_verdict?: string | null
          vibe_rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_drafts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_edit_events: {
        Row: {
          changed_field_count: number
          changed_fields: string[]
          created_at: string
          event_type: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          changed_field_count?: number
          changed_fields?: string[]
          created_at?: string
          event_type: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          changed_field_count?: number
          changed_fields?: string[]
          created_at?: string
          event_type?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_edit_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_edit_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_hashtags: {
        Row: {
          hashtag_id: string
          post_id: string
        }
        Insert: {
          hashtag_id: string
          post_id: string
        }
        Update: {
          hashtag_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_photos: {
        Row: {
          created_at: string
          deleted_at: string | null
          duration_ms: number | null
          height: number | null
          id: string
          media_type: string
          mime_type: string | null
          order_index: number
          original_url: string | null
          post_id: string
          processed_url: string | null
          processing_error: string | null
          processing_status: string
          size_bytes: number | null
          thumbnail_url: string | null
          url: string
          width: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          height?: number | null
          id?: string
          media_type?: string
          mime_type?: string | null
          order_index?: number
          original_url?: string | null
          post_id: string
          processed_url?: string | null
          processing_error?: string | null
          processing_status?: string
          size_bytes?: number | null
          thumbnail_url?: string | null
          url: string
          width?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          height?: number | null
          id?: string
          media_type?: string
          mime_type?: string | null
          order_index?: number
          original_url?: string | null
          post_id?: string
          processed_url?: string | null
          processing_error?: string | null
          processing_status?: string
          size_bytes?: number | null
          thumbnail_url?: string | null
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_photos_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          best_dish: string | null
          caption: string | null
          cost_rating: number | null
          created_at: string
          cuisine_type: string | null
          deleted_at: string | null
          deleted_reason: string | null
          dish_id: string | null
          dish_tags: Json | null
          edit_count: number
          embedding: string | null
          food_rating: number | null
          id: string
          last_edited_at: string | null
          occasion_tags: string[]
          rating: number | null
          restaurant_id: string | null
          taste_verdict: string | null
          updated_at: string
          user_id: string
          value_verdict: string | null
          vibe_rating: number | null
        }
        Insert: {
          best_dish?: string | null
          caption?: string | null
          cost_rating?: number | null
          created_at?: string
          cuisine_type?: string | null
          deleted_at?: string | null
          deleted_reason?: string | null
          dish_id?: string | null
          dish_tags?: Json | null
          edit_count?: number
          embedding?: string | null
          food_rating?: number | null
          id?: string
          last_edited_at?: string | null
          occasion_tags?: string[]
          rating?: number | null
          restaurant_id?: string | null
          taste_verdict?: string | null
          updated_at?: string
          user_id: string
          value_verdict?: string | null
          vibe_rating?: number | null
        }
        Update: {
          best_dish?: string | null
          caption?: string | null
          cost_rating?: number | null
          created_at?: string
          cuisine_type?: string | null
          deleted_at?: string | null
          deleted_reason?: string | null
          dish_id?: string | null
          dish_tags?: Json | null
          edit_count?: number
          embedding?: string | null
          food_rating?: number | null
          id?: string
          last_edited_at?: string | null
          occasion_tags?: string[]
          rating?: number | null
          restaurant_id?: string | null
          taste_verdict?: string | null
          updated_at?: string
          user_id?: string
          value_verdict?: string | null
          vibe_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_requests: {
        Row: {
          audit_reference: string | null
          completed_at: string | null
          created_at: string
          due_at: string | null
          id: string
          request_payload: Json
          request_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audit_reference?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          request_payload?: Json
          request_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audit_reference?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          request_payload?: Json
          request_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      restaurant_aliases: {
        Row: {
          alias_address: string | null
          alias_name: string | null
          confidence: number
          created_at: string
          created_by: string | null
          id: string
          provider: string | null
          provider_place_id: string | null
          reason: string
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          alias_address?: string | null
          alias_name?: string | null
          confidence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          provider?: string | null
          provider_place_id?: string | null
          reason: string
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          alias_address?: string | null
          alias_name?: string | null
          confidence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          provider?: string | null
          provider_place_id?: string | null
          reason?: string
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_aliases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_aliases_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          after_summary: Json | null
          before_summary: Json | null
          compliance_category: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          job_id: string | null
          reason: string | null
          request_id: string | null
          restaurant_id: string | null
          rollback_reference: string | null
          source_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          after_summary?: Json | null
          before_summary?: Json | null
          compliance_category?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          job_id?: string | null
          reason?: string | null
          request_id?: string | null
          restaurant_id?: string | null
          rollback_reference?: string | null
          source_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          after_summary?: Json | null
          before_summary?: Json | null
          compliance_category?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          job_id?: string | null
          reason?: string | null
          request_id?: string | null
          restaurant_id?: string | null
          rollback_reference?: string | null
          source_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_audit_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_merge_events: {
        Row: {
          actor_id: string | null
          after_summary: Json
          audit_event_id: string | null
          before_summary: Json
          canonical_restaurant_id: string
          confidence: number
          created_at: string
          id: string
          merged_restaurant_id: string | null
          reason: string
          rollback_reference: string | null
        }
        Insert: {
          actor_id?: string | null
          after_summary?: Json
          audit_event_id?: string | null
          before_summary?: Json
          canonical_restaurant_id: string
          confidence?: number
          created_at?: string
          id?: string
          merged_restaurant_id?: string | null
          reason: string
          rollback_reference?: string | null
        }
        Update: {
          actor_id?: string | null
          after_summary?: Json
          audit_event_id?: string | null
          before_summary?: Json
          canonical_restaurant_id?: string
          confidence?: number
          created_at?: string
          id?: string
          merged_restaurant_id?: string | null
          reason?: string
          rollback_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_merge_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_merge_events_audit_event_id_fkey"
            columns: ["audit_event_id"]
            isOneToOne: false
            referencedRelation: "restaurant_audit_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_merge_events_canonical_restaurant_id_fkey"
            columns: ["canonical_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_merge_events_merged_restaurant_id_fkey"
            columns: ["merged_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_observations: {
        Row: {
          confidence: number
          created_at: string
          id: string
          observation_type: string
          observed_value: Json
          restaurant_id: string | null
          retention_policy: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_entity_id: string | null
          source_entity_type: string | null
          source_type: string
          status: string
          user_id: string | null
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          observation_type: string
          observed_value: Json
          restaurant_id?: string | null
          retention_policy?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_type?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          observation_type?: string
          observed_value?: Json
          restaurant_id?: string | null
          retention_policy?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_type?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_observations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_observations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_observations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_ownership_events: {
        Row: {
          actor_id: string | null
          audit_event_id: string | null
          created_at: string
          event_type: string
          evidence_summary: Json
          id: string
          new_owner_id: string | null
          previous_owner_id: string | null
          reason: string | null
          restaurant_id: string
          source_type: string
          status: string
        }
        Insert: {
          actor_id?: string | null
          audit_event_id?: string | null
          created_at?: string
          event_type: string
          evidence_summary?: Json
          id?: string
          new_owner_id?: string | null
          previous_owner_id?: string | null
          reason?: string | null
          restaurant_id: string
          source_type?: string
          status?: string
        }
        Update: {
          actor_id?: string | null
          audit_event_id?: string | null
          created_at?: string
          event_type?: string
          evidence_summary?: Json
          id?: string
          new_owner_id?: string | null
          previous_owner_id?: string | null
          reason?: string | null
          restaurant_id?: string
          source_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_ownership_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_ownership_events_audit_event_id_fkey"
            columns: ["audit_event_id"]
            isOneToOne: false
            referencedRelation: "restaurant_audit_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_ownership_events_new_owner_id_fkey"
            columns: ["new_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_ownership_events_previous_owner_id_fkey"
            columns: ["previous_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_ownership_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_popularity_cache: {
        Row: {
          avg_food_rating: number | null
          food_rating_count: number
          interaction_count_30d: number
          post_count: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          avg_food_rating?: number | null
          food_rating_count?: number
          interaction_count_30d?: number
          post_count?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          avg_food_rating?: number | null
          food_rating_count?: number
          interaction_count_30d?: number
          post_count?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_popularity_cache_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_provider_cache: {
        Row: {
          attribution_required: boolean
          attribution_text: string | null
          cacheability: string
          created_at: string
          expires_at: string | null
          fetched_at: string
          field_mask: string[] | null
          freshness_state: string
          id: string
          last_refresh_error: string | null
          normalized_payload: Json
          raw_payload: Json | null
          restaurant_id: string | null
          retention_policy: string
          source_id: string
          source_type: string
          stale_at: string | null
          updated_at: string
        }
        Insert: {
          attribution_required?: boolean
          attribution_text?: string | null
          cacheability: string
          created_at?: string
          expires_at?: string | null
          fetched_at?: string
          field_mask?: string[] | null
          freshness_state?: string
          id?: string
          last_refresh_error?: string | null
          normalized_payload?: Json
          raw_payload?: Json | null
          restaurant_id?: string | null
          retention_policy: string
          source_id: string
          source_type: string
          stale_at?: string | null
          updated_at?: string
        }
        Update: {
          attribution_required?: boolean
          attribution_text?: string | null
          cacheability?: string
          created_at?: string
          expires_at?: string | null
          fetched_at?: string
          field_mask?: string[] | null
          freshness_state?: string
          id?: string
          last_refresh_error?: string | null
          normalized_payload?: Json
          raw_payload?: Json | null
          restaurant_id?: string | null
          retention_policy?: string
          source_id?: string
          source_type?: string
          stale_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_provider_cache_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_sources: {
        Row: {
          attribution_required: boolean
          cacheability: string
          confidence: number
          created_at: string
          created_by: string | null
          id: string
          restaurant_id: string
          retention_policy: string
          source_id: string | null
          source_payload: Json | null
          source_rights: string
          source_type: string
          updated_at: string
        }
        Insert: {
          attribution_required?: boolean
          cacheability?: string
          confidence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          restaurant_id: string
          retention_policy?: string
          source_id?: string | null
          source_payload?: Json | null
          source_rights?: string
          source_type: string
          updated_at?: string
        }
        Update: {
          attribution_required?: boolean
          cacheability?: string
          confidence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          restaurant_id?: string
          retention_policy?: string
          source_id?: string | null
          source_payload?: Json | null
          source_rights?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_sources_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          canonical_source: string
          city: string | null
          community_verification_score: number
          community_verified_at: string | null
          country: string | null
          created_at: string
          created_by: string | null
          cuisine_type: string | null
          embedding: string | null
          google_business_status: string | null
          google_details_fetched_at: string | null
          google_details_fields: string[] | null
          google_opening_hours: Json | null
          google_phone: string | null
          google_photo_refs: string[] | null
          google_place_id: string | null
          google_price_level: number | null
          google_rating: number | null
          google_review_count: number | null
          google_types: string[] | null
          google_website: string | null
          id: string
          latitude: number | null
          longitude: number | null
          metadata_confidence: number
          metadata_source_priority: string
          name: string
          open_now: boolean | null
          open_now_checked_at: string | null
          owner_content_status: string
          price_range: number | null
          primary_photo_source: string
          restaurant_geog: unknown
          suburb: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          address?: string | null
          canonical_source?: string
          city?: string | null
          community_verification_score?: number
          community_verified_at?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          cuisine_type?: string | null
          embedding?: string | null
          google_business_status?: string | null
          google_details_fetched_at?: string | null
          google_details_fields?: string[] | null
          google_opening_hours?: Json | null
          google_phone?: string | null
          google_photo_refs?: string[] | null
          google_place_id?: string | null
          google_price_level?: number | null
          google_rating?: number | null
          google_review_count?: number | null
          google_types?: string[] | null
          google_website?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadata_confidence?: number
          metadata_source_priority?: string
          name: string
          open_now?: boolean | null
          open_now_checked_at?: string | null
          owner_content_status?: string
          price_range?: number | null
          primary_photo_source?: string
          restaurant_geog?: unknown
          suburb?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          address?: string | null
          canonical_source?: string
          city?: string | null
          community_verification_score?: number
          community_verified_at?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          cuisine_type?: string | null
          embedding?: string | null
          google_business_status?: string | null
          google_details_fetched_at?: string | null
          google_details_fields?: string[] | null
          google_opening_hours?: Json | null
          google_phone?: string | null
          google_photo_refs?: string[] | null
          google_place_id?: string | null
          google_price_level?: number | null
          google_rating?: number | null
          google_review_count?: number | null
          google_types?: string[] | null
          google_website?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadata_confidence?: number
          metadata_source_priority?: string
          name?: string
          open_now?: boolean | null
          open_now_checked_at?: string | null
          owner_content_status?: string
          price_range?: number | null
          primary_photo_source?: string
          restaurant_geog?: unknown
          suburb?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_dishes: {
        Row: {
          created_at: string
          dish_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dish_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dish_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_dishes_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_dishes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_locations: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          save_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          save_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          save_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_locations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      suburb_aliases: {
        Row: {
          alias: string
          canonical_name: string
          id: number
          lat: number | null
          lng: number | null
        }
        Insert: {
          alias: string
          canonical_name: string
          id?: number
          lat?: number | null
          lng?: number | null
        }
        Update: {
          alias?: string
          canonical_name?: string
          id?: number
          lat?: number | null
          lng?: number | null
        }
        Relationships: []
      }
      suburb_lookups: {
        Row: {
          id: number
          lat: number | null
          lng: number | null
          name: string
          postcode: string | null
          state: string | null
        }
        Insert: {
          id?: number
          lat?: number | null
          lng?: number | null
          name: string
          postcode?: string | null
          state?: string | null
        }
        Update: {
          id?: number
          lat?: number | null
          lng?: number | null
          name?: string
          postcode?: string | null
          state?: string | null
        }
        Relationships: []
      }
      trending_searches: {
        Row: {
          id: number
          query: string
          score: number
          search_count: number
          updated_at: string
        }
        Insert: {
          id?: number
          query: string
          score?: number
          search_count?: number
          updated_at?: string
        }
        Update: {
          id?: number
          query?: string
          score?: number
          search_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profile_audit_events: {
        Row: {
          context: Json | null
          created_at: string
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profile_audit_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          allow_comments: boolean
          allow_tags: boolean
          autoplay_videos: boolean
          dark_mode: boolean
          id: string
          notif_comments: boolean
          notif_followers: boolean
          notif_likes: boolean
          notif_mentions: boolean
          notif_messages: boolean
          private_account: boolean
          show_activity_status: boolean
          theme_mode: string | null
          updated_at: string
        }
        Insert: {
          allow_comments?: boolean
          allow_tags?: boolean
          autoplay_videos?: boolean
          dark_mode?: boolean
          id: string
          notif_comments?: boolean
          notif_followers?: boolean
          notif_likes?: boolean
          notif_mentions?: boolean
          notif_messages?: boolean
          private_account?: boolean
          show_activity_status?: boolean
          theme_mode?: string | null
          updated_at?: string
        }
        Update: {
          allow_comments?: boolean
          allow_tags?: boolean
          autoplay_videos?: boolean
          dark_mode?: boolean
          id?: string
          notif_comments?: boolean
          notif_followers?: boolean
          notif_likes?: boolean
          notif_mentions?: boolean
          notif_messages?: boolean
          private_account?: boolean
          show_activity_status?: boolean
          theme_mode?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_topic_follows: {
        Row: {
          created_at: string
          id: string
          source: string
          topic: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source?: string
          topic: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source?: string
          topic?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_topic_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_trust_profiles: {
        Row: {
          last_reviewed_at: string | null
          reason_summary: string | null
          score: number
          trust_level: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_reviewed_at?: string | null
          reason_summary?: string | null
          score?: number
          trust_level?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_reviewed_at?: string | null
          reason_summary?: string | null
          score?: number
          trust_level?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_trust_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          last_seen_at: string | null
          suburb: string | null
          updated_at: string
          username: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          last_seen_at?: string | null
          suburb?: string | null
          updated_at?: string
          username: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          suburb?: string | null
          updated_at?: string
          username?: string
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      platform_audit_events_view: {
        Row: {
          context: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string | null
          id: string | null
          source_table: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_message_request: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      add_saved_target_to_collection: {
        Args: {
          p_collection_id: string
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      create_group_conversation: {
        Args: { p_avatar_url?: string; p_member_ids: string[]; p_name: string }
        Returns: string
      }
      create_user_restaurant: {
        Args: {
          p_address?: string
          p_city?: string
          p_country?: string
          p_cuisine_type?: string
          p_latitude?: number
          p_longitude?: number
          p_name: string
        }
        Returns: string
      }
      current_user_in_conversation: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      decline_message_request: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      delete_comment: { Args: { p_comment_id: string }; Returns: undefined }
      delete_message: { Args: { p_message_id: string }; Returns: undefined }
      delete_own_account: { Args: never; Returns: undefined }
      delete_post: { Args: { p_post_id: string }; Returns: undefined }
      expand_search_cuisines: {
        Args: { max_cuisines?: number; query_text: string }
        Returns: {
          cuisine_type: string
          match_count: number
        }[]
      }
      find_or_create_dish: {
        Args: {
          p_context?: Json
          p_created_by?: string
          p_cuisine_type?: string
          p_name: string
          p_restaurant_id: string
        }
        Returns: string
      }
      get_or_create_direct_conversation: {
        Args: { target_user_id: string }
        Returns: string
      }
      get_recent_search_history: {
        Args: { lookback_days?: number; max_results?: number }
        Returns: {
          last_searched_at: string
          query: string
          search_count: number
        }[]
      }
      leave_group: { Args: { p_conversation_id: string }; Returns: undefined }
      match_embeddings: {
        Args: {
          match_count?: number
          match_type: string
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          id: string
          similarity: number
        }[]
      }
      pin_message: { Args: { p_message_id: string }; Returns: undefined }
      purge_soft_deleted_content: {
        Args: { batch_size?: number }
        Returns: number
      }
      record_auth_audit_event: {
        Args: { p_context?: Json; p_event_type: string }
        Returns: undefined
      }
      record_auth_audit_event_server: {
        Args: { p_context?: Json; p_event_type: string; p_user_id: string }
        Returns: undefined
      }
      record_collection_audit_event: {
        Args: {
          p_collection_id: string
          p_context?: Json
          p_event_type: string
        }
        Returns: undefined
      }
      record_content_lifecycle_event: {
        Args: {
          p_context?: Json
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
        }
        Returns: undefined
      }
      record_profile_audit_event: {
        Args: { p_context?: Json; p_event_type: string }
        Returns: undefined
      }
      record_restaurant_provider_snapshot: {
        Args: {
          p_attribution_required: boolean
          p_attribution_text: string
          p_cacheability: string
          p_field_mask: string[]
          p_normalized_payload: Json
          p_restaurant_id: string
          p_retention_policy: string
          p_source_id: string
          p_source_type: string
          p_stale_at: string
        }
        Returns: undefined
      }
      refresh_restaurant_popularity_cache: { Args: never; Returns: undefined }
      refresh_trending_queries: { Args: never; Returns: undefined }
      resolve_suburb_query: {
        Args: { input_text: string }
        Returns: {
          canonical_suburb: string
          confidence: number
          lat: number
          lng: number
        }[]
      }
      restaurants_in_bounding_box: {
        Args: {
          max_lat: number
          max_lng: number
          max_results?: number
          min_lat: number
          min_lng: number
        }
        Returns: {
          address: string
          city: string
          cuisine_type: string
          google_place_id: string
          google_rating: number
          google_review_count: number
          id: string
          latitude: number
          longitude: number
          name: string
          open_now: boolean
        }[]
      }
      restore_comment: { Args: { p_comment_id: string }; Returns: undefined }
      restore_post: { Args: { p_post_id: string }; Returns: undefined }
      search_posts_by_dish: {
        Args: {
          dish_query: string
          max_results?: number
          near_lat?: number
          near_lng?: number
        }
        Returns: {
          id: string
          match_source: string
          rank: number
        }[]
      }
      search_posts_full_text: {
        Args: {
          max_results?: number
          near_lat?: number
          near_lng?: number
          offset_val?: number
          query_text: string
        }
        Returns: {
          id: string
          rank: number
        }[]
      }
      search_restaurants_full_text: {
        Args: {
          max_results?: number
          near_lat?: number
          near_lng?: number
          query_text: string
          suburb_filter?: string
        }
        Returns: {
          address: string
          city: string
          cuisine_type: string
          google_place_id: string
          google_rating: number
          google_review_count: number
          id: string
          latitude: number
          longitude: number
          name: string
          open_now: boolean
          rank: number
          suburb: string
        }[]
      }
      send_direct_message: {
        Args: {
          p_attachment_metadata?: Json
          p_attachment_url?: string
          p_body?: string
          p_conversation_id: string
          p_message_type?: string
          p_reply_to_message_id?: string
        }
        Returns: {
          attachment_metadata: Json | null
          attachment_url: string | null
          body: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          id: string
          message_type: string
          reply_to_message_id: string | null
          sender_id: string
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suggest_searches: {
        Args: {
          limit_per_type?: number
          near_lat?: number
          near_lng?: number
          prefix_query: string
        }
        Returns: {
          display_text: string
          entity_id: string
          score: number
          secondary_text: string
          suggestion_type: string
        }[]
      }
      unpin_message: { Args: { p_message_id: string }; Returns: undefined }
      unsave_target: {
        Args: {
          p_remove_collection_memberships?: boolean
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
