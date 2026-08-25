export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
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
      channel_clone_plans: {
        Row: {
          analyzed_video_count: number
          avg_duration_seconds: number
          channel_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          error_message: string | null
          id: string
          source_channel_title: string
          source_youtube_channel_id: string
          status: string
          upload_cadence_per_week: number
        }
        Insert: {
          analyzed_video_count: number
          avg_duration_seconds: number
          channel_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          error_message?: string | null
          id?: string
          source_channel_title: string
          source_youtube_channel_id: string
          status?: string
          upload_cadence_per_week: number
        }
        Update: {
          analyzed_video_count?: number
          avg_duration_seconds?: number
          channel_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          error_message?: string | null
          id?: string
          source_channel_title?: string
          source_youtube_channel_id?: string
          status?: string
          upload_cadence_per_week?: number
        }
        Relationships: [
          {
            foreignKeyName: "channel_clone_plans_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_clone_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          brand_voice_id: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          niche: string
          target_country: string | null
          target_language: string
          thumbnail_template: Json
          updated_at: string
          variation_rules: string
          visual_style_reference: string | null
        }
        Insert: {
          brand_voice_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          niche: string
          target_country?: string | null
          target_language?: string
          thumbnail_template?: Json
          updated_at?: string
          variation_rules: string
          visual_style_reference?: string | null
        }
        Update: {
          brand_voice_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          niche?: string
          target_country?: string | null
          target_language?: string
          thumbnail_template?: Json
          updated_at?: string
          variation_rules?: string
          visual_style_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      clone_plan_items: {
        Row: {
          clone_plan_id: string
          created_at: string
          id: string
          proposed_angle: string
          proposed_topic: string
          source_video_title: string
          source_video_views: number
          status: string
        }
        Insert: {
          clone_plan_id: string
          created_at?: string
          id?: string
          proposed_angle: string
          proposed_topic: string
          source_video_title: string
          source_video_views: number
          status?: string
        }
        Update: {
          clone_plan_id?: string
          created_at?: string
          id?: string
          proposed_angle?: string
          proposed_topic?: string
          source_video_title?: string
          source_video_views?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clone_plan_items_clone_plan_id_fkey"
            columns: ["clone_plan_id"]
            isOneToOne: false
            referencedRelation: "channel_clone_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_results: {
        Row: {
          avg_recent_views: number
          channel_published_at: string
          channel_title: string
          created_at: string
          discovery_run_id: string
          id: string
          monetization_score: number
          recent_video_count: number
          shorts_ratio: number
          subscriber_count: number | null
          upload_velocity_per_week: number
          youtube_channel_id: string
        }
        Insert: {
          avg_recent_views: number
          channel_published_at: string
          channel_title: string
          created_at?: string
          discovery_run_id: string
          id?: string
          monetization_score: number
          recent_video_count: number
          shorts_ratio: number
          subscriber_count?: number | null
          upload_velocity_per_week: number
          youtube_channel_id: string
        }
        Update: {
          avg_recent_views?: number
          channel_published_at?: string
          channel_title?: string
          created_at?: string
          discovery_run_id?: string
          id?: string
          monetization_score?: number
          recent_video_count?: number
          shorts_ratio?: number
          subscriber_count?: number | null
          upload_velocity_per_week?: number
          youtube_channel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_results_discovery_run_id_fkey"
            columns: ["discovery_run_id"]
            isOneToOne: false
            referencedRelation: "discovery_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          error_message: string | null
          filters: Json
          id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          error_message?: string | null
          filters: Json
          id?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          error_message?: string | null
          filters?: Json
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["team_role"]
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: Database["public"]["Enums"]["team_role"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
        }
        Relationships: []
      }
      videos: {
        Row: {
          channel_id: string
          created_at: string
          created_by: string
          error_message: string | null
          id: string
          reference_transcript: string | null
          script_content: string | null
          seo_description: string | null
          seo_image_prompt: string | null
          seo_pinned_comment: string | null
          seo_tags: string[] | null
          seo_thumbnail_phrases: string[] | null
          status: string
          style: string
          target_character_count: number
          target_duration_seconds: number
          topic: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          created_by: string
          error_message?: string | null
          id?: string
          reference_transcript?: string | null
          script_content?: string | null
          seo_description?: string | null
          seo_image_prompt?: string | null
          seo_pinned_comment?: string | null
          seo_tags?: string[] | null
          seo_thumbnail_phrases?: string[] | null
          status?: string
          style?: string
          target_character_count: number
          target_duration_seconds: number
          topic: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          created_by?: string
          error_message?: string | null
          id?: string
          reference_transcript?: string | null
          script_content?: string | null
          seo_description?: string | null
          seo_image_prompt?: string | null
          seo_pinned_comment?: string | null
          seo_tags?: string[] | null
          seo_thumbnail_phrases?: string[] | null
          status?: string
          style?: string
          target_character_count?: number
          target_duration_seconds?: number
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_pace_calibration: {
        Row: {
          brand_voice_id: string
          chars_per_minute: number
          id: string
          target_language: string
          updated_at: string
        }
        Insert: {
          brand_voice_id: string
          chars_per_minute: number
          id?: string
          target_language: string
          updated_at?: string
        }
        Update: {
          brand_voice_id?: string
          chars_per_minute?: number
          id?: string
          target_language?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      team_role: "admin" | "investigador" | "guionista" | "editor" | "aprobador"
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
    Enums: {
      team_role: ["admin", "investigador", "guionista", "editor", "aprobador"],
    },
  },
} as const
