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
      community_emails: {
        Row: {
          company_domain: string
          company_name: string | null
          contributed_by: string | null
          created_at: string | null
          email: string
          email_type: Database["public"]["Enums"]["email_type"]
          failed_count: number | null
          id: string
          updated_at: string | null
          verified_count: number | null
        }
        Insert: {
          company_domain: string
          company_name?: string | null
          contributed_by?: string | null
          created_at?: string | null
          email: string
          email_type?: Database["public"]["Enums"]["email_type"]
          failed_count?: number | null
          id?: string
          updated_at?: string | null
          verified_count?: number | null
        }
        Update: {
          company_domain?: string
          company_name?: string | null
          contributed_by?: string | null
          created_at?: string | null
          email?: string
          email_type?: Database["public"]["Enums"]["email_type"]
          failed_count?: number | null
          id?: string
          updated_at?: string | null
          verified_count?: number | null
        }
        Relationships: []
      }
      email_verifications: {
        Row: {
          community_email_id: string
          created_at: string | null
          id: string
          user_id: string
          worked: boolean
        }
        Insert: {
          community_email_id: string
          created_at?: string | null
          id?: string
          user_id: string
          worked: boolean
        }
        Update: {
          community_email_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
          worked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "email_verifications_community_email_id_fkey"
            columns: ["community_email_id"]
            isOneToOne: false
            referencedRelation: "community_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      emails_sent: {
        Row: {
          body: string
          clicked_at: string | null
          created_at: string | null
          id: string
          job_id: string
          opened_at: string | null
          replied_at: string | null
          sent_at: string | null
          subject: string
          to_email: string
          tracking_id: string
          user_id: string
        }
        Insert: {
          body: string
          clicked_at?: string | null
          created_at?: string | null
          id?: string
          job_id: string
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          subject: string
          to_email: string
          tracking_id: string
          user_id: string
        }
        Update: {
          body?: string
          clicked_at?: string | null
          created_at?: string | null
          id?: string
          job_id?: string
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          subject?: string
          to_email?: string
          tracking_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_sent_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_reminders: {
        Row: {
          created_at: string | null
          email_sent_id: string | null
          followup_number: number
          id: string
          job_id: string
          scheduled_for: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_sent_id?: string | null
          followup_number: number
          id?: string
          job_id: string
          scheduled_for: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_sent_id?: string | null
          followup_number?: number
          id?: string
          job_id?: string
          scheduled_for?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_reminders_email_sent_id_fkey"
            columns: ["email_sent_id"]
            isOneToOne: false
            referencedRelation: "emails_sent"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_reminders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          device_name: string | null
          last_used_at: string | null
          created_at: string
          expires_at: string
          revoked: boolean
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          device_name?: string | null
          last_used_at?: string | null
          created_at?: string
          expires_at?: string
          revoked?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          device_name?: string | null
          last_used_at?: string | null
          created_at?: string
          expires_at?: string
          revoked?: boolean
        }
        Relationships: []
      }
      jobs: {
        Row: {
          applied_at: string | null
          company_domain: string | null
          company_name: string
          created_at: string | null
          email_source: Database["public"]["Enums"]["email_source"] | null
          email_type: Database["public"]["Enums"]["email_type"] | null
          hr_email: string | null
          hr_name: string | null
          id: string
          job_description: string | null
          job_title: string
          job_url: string
          location: string | null
          salary: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          company_domain?: string | null
          company_name: string
          created_at?: string | null
          email_source?: Database["public"]["Enums"]["email_source"] | null
          email_type?: Database["public"]["Enums"]["email_type"] | null
          hr_email?: string | null
          hr_name?: string | null
          id?: string
          job_description?: string | null
          job_title: string
          job_url: string
          location?: string | null
          salary?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          company_domain?: string | null
          company_name?: string
          created_at?: string | null
          email_source?: Database["public"]["Enums"]["email_source"] | null
          email_type?: Database["public"]["Enums"]["email_type"] | null
          hr_email?: string | null
          hr_name?: string | null
          id?: string
          job_description?: string | null
          job_title?: string
          job_url?: string
          location?: string | null
          salary?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      link_clicks: {
        Row: {
          click_count: number
          clicked_at: string | null
          created_at: string | null
          email_sent_id: string | null
          id: string
          ip_address: string | null
          job_id: string | null
          link_type: string
          original_url: string
          tracking_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          click_count?: number
          clicked_at?: string | null
          created_at?: string | null
          email_sent_id?: string | null
          id?: string
          ip_address?: string | null
          job_id?: string | null
          link_type: string
          original_url: string
          tracking_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          click_count?: number
          clicked_at?: string | null
          created_at?: string | null
          email_sent_id?: string | null
          id?: string
          ip_address?: string | null
          job_id?: string | null
          link_type?: string
          original_url?: string
          tracking_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_clicks_email_sent_id_fkey"
            columns: ["email_sent_id"]
            isOneToOne: false
            referencedRelation: "emails_sent"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_clicks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          apollo_api_key: string | null
          auto_followup_enabled: boolean | null
          created_at: string | null
          email_provider: string | null
          followup_delay_days: number | null
          gmail_access_token: string | null
          gmail_refresh_token: string | null
          hunter_api_key: string | null
          id: string
          linkedin_url: string | null
          updated_at: string | null
          user_id: string
          yahoo_email: string | null
          yahoo_password_encrypted: string | null
        }
        Insert: {
          apollo_api_key?: string | null
          auto_followup_enabled?: boolean | null
          created_at?: string | null
          email_provider?: string | null
          followup_delay_days?: number | null
          gmail_access_token?: string | null
          gmail_refresh_token?: string | null
          hunter_api_key?: string | null
          id?: string
          linkedin_url?: string | null
          updated_at?: string | null
          user_id: string
          yahoo_email?: string | null
          yahoo_password_encrypted?: string | null
        }
        Update: {
          apollo_api_key?: string | null
          auto_followup_enabled?: boolean | null
          created_at?: string | null
          email_provider?: string | null
          followup_delay_days?: number | null
          gmail_access_token?: string | null
          gmail_refresh_token?: string | null
          hunter_api_key?: string | null
          id?: string
          linkedin_url?: string | null
          updated_at?: string | null
          user_id?: string
          yahoo_email?: string | null
          yahoo_password_encrypted?: string | null
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          created_at: string | null
          emails_contributed: number | null
          emails_verified: number | null
          helped_users_count: number | null
          id: string
          reputation_score: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emails_contributed?: number | null
          emails_verified?: number | null
          helped_users_count?: number | null
          id?: string
          reputation_score?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          emails_contributed?: number | null
          emails_verified?: number | null
          helped_users_count?: number | null
          id?: string
          reputation_score?: number | null
          updated_at?: string | null
          user_id?: string
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
      email_source: "community" | "pattern" | "hunter" | "apollo" | "manual"
      email_type: "generic" | "personal"
      job_status:
        | "captured"
        | "email_found"
        | "email_sent"
        | "interview"
        | "offer"
        | "rejected"
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
  public: {
    Enums: {
      email_source: ["community", "pattern", "hunter", "apollo", "manual"],
      email_type: ["generic", "personal"],
      job_status: [
        "captured",
        "email_found",
        "email_sent",
        "interview",
        "offer",
        "rejected",
      ],
    },
  },
} as const
