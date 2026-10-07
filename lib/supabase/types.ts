export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Compatibility aliases retained for the existing application modules.
export type AccountStatus = Database["public"]["Enums"]["account_status"];
export type OrganizationRole = Database["public"]["Enums"]["organization_role"];
export type OrganizationMembershipStatus =
  Database["public"]["Enums"]["organization_membership_status"];
export type OrganizationInvitationStatus =
  Database["public"]["Enums"]["organization_invitation_status"];
export type ApiKeyStatus = Database["public"]["Enums"]["api_key_status"];
export type CampaignStatus = Database["public"]["Enums"]["campaign_status"];
export type CampaignSourceType =
  Database["public"]["Enums"]["campaign_source_type"];
export type CallDirection = Database["public"]["Enums"]["call_direction"];
export type CallStatus = Database["public"]["Enums"]["call_status"];
export type CallOutcome = Database["public"]["Enums"]["call_outcome"];
export type CallbackStatus = Database["public"]["Enums"]["callback_status"];
export type DncReason = Database["public"]["Enums"]["dnc_reason"];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          revoked_at: string | null
          scopes: string[]
          status: Database["public"]["Enums"]["api_key_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          revoked_at?: string | null
          scopes?: string[]
          status?: Database["public"]["Enums"]["api_key_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          revoked_at?: string | null
          scopes?: string[]
          status?: Database["public"]["Enums"]["api_key_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          business_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json
          new_values: Json | null
          old_values: Json | null
          outcome: string
          request_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          new_values?: Json | null
          old_values?: Json | null
          outcome?: string
          request_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          new_values?: Json | null
          old_values?: Json | null
          outcome?: string
          request_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_devices: {
        Row: {
          created_at: string
          device_hash: string
          id: string
          ip_hash: string | null
          label: string | null
          last_seen_at: string
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_hash: string
          id?: string
          ip_hash?: string | null
          label?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_hash?: string
          id?: string
          ip_hash?: string | null
          label?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_security_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_hash: string | null
          metadata: Json
          organization_id: string | null
          outcome: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          organization_id?: string | null
          outcome?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          organization_id?: string | null
          outcome?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_security_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_security_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          business_id: string
          created_at: string
          details: Json
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          business_id: string
          created_at?: string
          details?: Json
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          business_id?: string
          created_at?: string
          details?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          billing_state_code: string | null
          business_email: string | null
          business_name: string
          business_phone: string | null
          business_type: string | null
          city: string | null
          country: string
          created_at: string
          description: string | null
          gstin: string | null
          id: string
          is_tax_exempt: boolean | null
          logo_url: string | null
          owner_id: string
          state: string | null
          tax_exemption_reason: string | null
          timezone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          billing_state_code?: string | null
          business_email?: string | null
          business_name: string
          business_phone?: string | null
          business_type?: string | null
          city?: string | null
          country?: string
          created_at?: string
          description?: string | null
          gstin?: string | null
          id?: string
          is_tax_exempt?: boolean | null
          logo_url?: string | null
          owner_id: string
          state?: string | null
          tax_exemption_reason?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          billing_state_code?: string | null
          business_email?: string | null
          business_name?: string
          business_phone?: string | null
          business_type?: string | null
          city?: string | null
          country?: string
          created_at?: string
          description?: string | null
          gstin?: string | null
          id?: string
          is_tax_exempt?: boolean | null
          logo_url?: string | null
          owner_id?: string
          state?: string | null
          tax_exemption_reason?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_analysis: {
        Row: {
          analysis_version: number
          call_id: string
          created_at: string
          customer_intent: string | null
          id: string
          important_information: string[]
          interest_level: string | null
          objections: string[]
          outcome: Database["public"]["Enums"]["call_outcome"] | null
          questions_asked: string[]
          recommended_next_action: string | null
          requested_follow_up: string | null
          requirements: string[]
          short_summary: string
          updated_at: string
        }
        Insert: {
          analysis_version?: number
          call_id: string
          created_at?: string
          customer_intent?: string | null
          id?: string
          important_information?: string[]
          interest_level?: string | null
          objections?: string[]
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          questions_asked?: string[]
          recommended_next_action?: string | null
          requested_follow_up?: string | null
          requirements?: string[]
          short_summary: string
          updated_at?: string
        }
        Update: {
          analysis_version?: number
          call_id?: string
          created_at?: string
          customer_intent?: string | null
          id?: string
          important_information?: string[]
          interest_level?: string | null
          objections?: string[]
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          questions_asked?: string[]
          recommended_next_action?: string | null
          requested_follow_up?: string | null
          requirements?: string[]
          short_summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_analysis_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_attempts: {
        Row: {
          attempt_number: number
          call_id: string | null
          campaign_contact_id: string | null
          created_at: string
          duration_seconds: number
          ended_at: string | null
          failure_reason: string | null
          id: string
          provider_attempt_id: string | null
          provider_call_id: string | null
          retry_metadata: Json
          started_at: string | null
          status: string
        }
        Insert: {
          attempt_number: number
          call_id?: string | null
          campaign_contact_id?: string | null
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          failure_reason?: string | null
          id?: string
          provider_attempt_id?: string | null
          provider_call_id?: string | null
          retry_metadata?: Json
          started_at?: string | null
          status: string
        }
        Update: {
          attempt_number?: number
          call_id?: string | null
          campaign_contact_id?: string | null
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          failure_reason?: string | null
          id?: string
          provider_attempt_id?: string | null
          provider_call_id?: string | null
          retry_metadata?: Json
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_attempts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_attempts_campaign_contact_id_fkey"
            columns: ["campaign_contact_id"]
            isOneToOne: false
            referencedRelation: "campaign_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      call_recordings: {
        Row: {
          available_at: string
          call_id: string
          created_at: string
          duration_seconds: number
          expires_at: string
          file_size: number | null
          id: string
          mime_type: string | null
          provider_recording_id: string | null
          storage_path: string
        }
        Insert: {
          available_at?: string
          call_id: string
          created_at?: string
          duration_seconds?: number
          expires_at?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          provider_recording_id?: string | null
          storage_path: string
        }
        Update: {
          available_at?: string
          call_id?: string
          created_at?: string
          duration_seconds?: number
          expires_at?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          provider_recording_id?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_recordings_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          call_id: string
          created_at: string
          id: string
          language: string | null
          provider_transcript_id: string | null
          storage_path: string | null
          transcript_json: Json
          transcript_text: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          language?: string | null
          provider_transcript_id?: string | null
          storage_path?: string | null
          transcript_json?: Json
          transcript_text: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          language?: string | null
          provider_transcript_id?: string | null
          storage_path?: string | null
          transcript_json?: Json
          transcript_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      callbacks: {
        Row: {
          business_id: string
          call_id: string | null
          campaign_id: string | null
          completed_at: string | null
          contact_id: string
          created_at: string
          id: string
          notes: string | null
          requested_at: string
          scheduled_for: string
          status: Database["public"]["Enums"]["callback_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          business_id: string
          call_id?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          contact_id: string
          created_at?: string
          id?: string
          notes?: string | null
          requested_at?: string
          scheduled_for: string
          status?: Database["public"]["Enums"]["callback_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          call_id?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          requested_at?: string
          scheduled_for?: string
          status?: Database["public"]["Enums"]["callback_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "callbacks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callbacks_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callbacks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callbacks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          answered_at: string | null
          business_id: string
          campaign_contact_id: string | null
          campaign_id: string | null
          contact_id: string
          created_at: string
          direction: Database["public"]["Enums"]["call_direction"]
          duration_seconds: number
          ended_at: string | null
          id: string
          interest_level: string | null
          outcome: Database["public"]["Enums"]["call_outcome"] | null
          provider: string
          provider_attempt_id: string | null
          provider_call_id: string | null
          provider_campaign_id: string | null
          provider_interaction_id: string | null
          short_summary: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["call_status"]
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          business_id: string
          campaign_contact_id?: string | null
          campaign_id?: string | null
          contact_id: string
          created_at?: string
          direction?: Database["public"]["Enums"]["call_direction"]
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          interest_level?: string | null
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          provider?: string
          provider_attempt_id?: string | null
          provider_call_id?: string | null
          provider_campaign_id?: string | null
          provider_interaction_id?: string | null
          short_summary?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          business_id?: string
          campaign_contact_id?: string | null
          campaign_id?: string | null
          contact_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["call_direction"]
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          interest_level?: string | null
          outcome?: Database["public"]["Enums"]["call_outcome"] | null
          provider?: string
          provider_attempt_id?: string | null
          provider_call_id?: string | null
          provider_campaign_id?: string | null
          provider_interaction_id?: string | null
          short_summary?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_campaign_contact_id_fkey"
            columns: ["campaign_contact_id"]
            isOneToOne: false
            referencedRelation: "campaign_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_contacts: {
        Row: {
          attempt_count: number
          campaign_id: string
          contact_id: string
          created_at: string
          custom_variables: Json
          id: string
          import_batch_id: string | null
          import_source: string | null
          last_call_at: string | null
          next_call_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          campaign_id: string
          contact_id: string
          created_at?: string
          custom_variables?: Json
          id?: string
          import_batch_id?: string | null
          import_source?: string | null
          last_call_at?: string | null
          next_call_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          campaign_id?: string
          contact_id?: string
          created_at?: string
          custom_variables?: Json
          id?: string
          import_batch_id?: string | null
          import_source?: string | null
          last_call_at?: string | null
          next_call_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_sources: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          metadata: Json
          processing_status: string
          raw_text: string | null
          source_name: string
          source_type: Database["public"]["Enums"]["campaign_source_type"]
          source_url: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          metadata?: Json
          processing_status?: string
          raw_text?: string | null
          source_name: string
          source_type: Database["public"]["Enums"]["campaign_source_type"]
          source_url?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          processing_status?: string
          raw_text?: string | null
          source_name?: string
          source_type?: Database["public"]["Enums"]["campaign_source_type"]
          source_url?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sources_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_versions: {
        Row: {
          campaign_id: string
          configuration: Json
          created_at: string
          id: string
          knowledge_snapshot: Json
          published_at: string | null
          sarvam_agent_id: string | null
          sarvam_agent_version_id: string | null
          status: string
          system_instructions: string
          version_number: number
        }
        Insert: {
          campaign_id: string
          configuration?: Json
          created_at?: string
          id?: string
          knowledge_snapshot?: Json
          published_at?: string | null
          sarvam_agent_id?: string | null
          sarvam_agent_version_id?: string | null
          status?: string
          system_instructions: string
          version_number: number
        }
        Update: {
          campaign_id?: string
          configuration?: Json
          created_at?: string
          id?: string
          knowledge_snapshot?: Json
          published_at?: string | null
          sarvam_agent_id?: string | null
          sarvam_agent_version_id?: string | null
          status?: string
          system_instructions?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_versions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          active_version_id: string | null
          auto_complete: boolean
          business_id: string
          calling_days: number[]
          calling_end_time: string
          calling_start_time: string
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          enable_phone_rotation: boolean
          id: string
          industry: string | null
          max_attempts: number
          max_call_duration_seconds: number
          name: string
          objective: string | null
          offering_type: string | null
          paused_at: string | null
          retry_interval_minutes: number
          sarvam_agent_id: string | null
          sarvam_campaign_id: string | null
          sarvam_cohort_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          active_version_id?: string | null
          auto_complete?: boolean
          business_id: string
          calling_days?: number[]
          calling_end_time?: string
          calling_start_time?: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          enable_phone_rotation?: boolean
          id?: string
          industry?: string | null
          max_attempts?: number
          max_call_duration_seconds?: number
          name: string
          objective?: string | null
          offering_type?: string | null
          paused_at?: string | null
          retry_interval_minutes?: number
          sarvam_agent_id?: string | null
          sarvam_campaign_id?: string | null
          sarvam_cohort_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          active_version_id?: string | null
          auto_complete?: boolean
          business_id?: string
          calling_days?: number[]
          calling_end_time?: string
          calling_start_time?: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          enable_phone_rotation?: boolean
          id?: string
          industry?: string | null
          max_attempts?: number
          max_call_duration_seconds?: number
          name?: string
          objective?: string | null
          offering_type?: string | null
          paused_at?: string | null
          retry_interval_minutes?: number
          sarvam_agent_id?: string | null
          sarvam_campaign_id?: string | null
          sarvam_cohort_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_campaign_active_version"
            columns: ["active_version_id"]
            isOneToOne: false
            referencedRelation: "campaign_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_imports: {
        Row: {
          business_id: string
          column_mapping: Json
          completed_at: string | null
          created_at: string
          dnc_filtered_count: number
          duplicate_count: number
          error_summary: Json | null
          file_name: string
          id: string
          imported_count: number
          invalid_count: number
          source_type: string
          status: string
          storage_path: string | null
          total_rows: number
          user_id: string | null
          wrong_number_filtered_count: number
        }
        Insert: {
          business_id: string
          column_mapping?: Json
          completed_at?: string | null
          created_at?: string
          dnc_filtered_count?: number
          duplicate_count?: number
          error_summary?: Json | null
          file_name: string
          id?: string
          imported_count?: number
          invalid_count?: number
          source_type: string
          status?: string
          storage_path?: string | null
          total_rows?: number
          user_id?: string | null
          wrong_number_filtered_count?: number
        }
        Update: {
          business_id?: string
          column_mapping?: Json
          completed_at?: string | null
          created_at?: string
          dnc_filtered_count?: number
          duplicate_count?: number
          error_summary?: Json | null
          file_name?: string
          id?: string
          imported_count?: number
          invalid_count?: number
          source_type?: string
          status?: string
          storage_path?: string | null
          total_rows?: number
          user_id?: string | null
          wrong_number_filtered_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "contact_imports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          business_id: string
          city: string | null
          created_at: string
          custom_fields: Json
          email: string | null
          id: string
          import_id: string | null
          is_dnc: boolean
          is_wrong_number: boolean
          last_contacted_at: string | null
          name: string
          notes: string | null
          phone: string
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          business_id: string
          city?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          import_id?: string | null
          is_dnc?: boolean
          is_wrong_number?: boolean
          last_contacted_at?: string | null
          name: string
          notes?: string | null
          phone: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          business_id?: string
          city?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          import_id?: string | null
          is_dnc?: boolean
          is_wrong_number?: boolean
          last_contacted_at?: string | null
          name?: string
          notes?: string | null
          phone?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "contact_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      dnc_numbers: {
        Row: {
          business_id: string
          created_at: string
          id: string
          phone_number: string
          reason: Database["public"]["Enums"]["dnc_reason"]
          source_call_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          phone_number: string
          reason?: Database["public"]["Enums"]["dnc_reason"]
          source_call_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          phone_number?: string
          reason?: Database["public"]["Enums"]["dnc_reason"]
          source_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dnc_numbers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid_paise: number
          billing_address: Json | null
          business_id: string
          created_at: string
          customer_gstin: string | null
          id: string
          invoice_number: string
          paid_at: string | null
          payment_id: string | null
          pdf_url: string | null
          period_end: string
          period_start: string
          razorpay_invoice_id: string | null
          status: string
          subscription_id: string | null
          subtotal_paise: number
          tax_breakdown: Json
          tax_paise: number
          tax_rate_percent: number
          tax_type: string
          total_paise: number
        }
        Insert: {
          amount_paid_paise?: number
          billing_address?: Json | null
          business_id: string
          created_at?: string
          customer_gstin?: string | null
          id?: string
          invoice_number: string
          paid_at?: string | null
          payment_id?: string | null
          pdf_url?: string | null
          period_end: string
          period_start: string
          razorpay_invoice_id?: string | null
          status: string
          subscription_id?: string | null
          subtotal_paise: number
          tax_breakdown?: Json
          tax_paise?: number
          tax_rate_percent?: number
          tax_type?: string
          total_paise: number
        }
        Update: {
          amount_paid_paise?: number
          billing_address?: Json | null
          business_id?: string
          created_at?: string
          customer_gstin?: string | null
          id?: string
          invoice_number?: string
          paid_at?: string | null
          payment_id?: string | null
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          razorpay_invoice_id?: string | null
          status?: string
          subscription_id?: string | null
          subtotal_paise?: number
          tax_breakdown?: Json
          tax_paise?: number
          tax_rate_percent?: number
          tax_type?: string
          total_paise?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payment_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          status: Database["public"]["Enums"]["organization_invitation_status"]
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: Database["public"]["Enums"]["organization_invitation_status"]
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: Database["public"]["Enums"]["organization_invitation_status"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          status: Database["public"]["Enums"]["organization_membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: Database["public"]["Enums"]["organization_membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: Database["public"]["Enums"]["organization_membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount_inr: number | null
          amount_paise: number
          bank: string | null
          business_id: string
          contact: string | null
          created_at: string
          currency: string
          email: string | null
          error_code: string | null
          error_description: string | null
          error_reason: string | null
          error_source: string | null
          error_step: string | null
          id: string
          metadata: Json
          method: string | null
          razorpay_invoice_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string
          reconciled_at: string | null
          status: string
          subscription_id: string | null
          vpa: string | null
          wallet: string | null
        }
        Insert: {
          amount_inr?: number | null
          amount_paise: number
          bank?: string | null
          business_id: string
          contact?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          error_code?: string | null
          error_description?: string | null
          error_reason?: string | null
          error_source?: string | null
          error_step?: string | null
          id?: string
          metadata?: Json
          method?: string | null
          razorpay_invoice_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id: string
          reconciled_at?: string | null
          status: string
          subscription_id?: string | null
          vpa?: string | null
          wallet?: string | null
        }
        Update: {
          amount_inr?: number | null
          amount_paise?: number
          bank?: string | null
          business_id?: string
          contact?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          error_code?: string | null
          error_description?: string | null
          error_reason?: string | null
          error_source?: string | null
          error_step?: string | null
          id?: string
          metadata?: Json
          method?: string | null
          razorpay_invoice_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string
          reconciled_at?: string | null
          status?: string
          subscription_id?: string | null
          vpa?: string | null
          wallet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_numbers: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_default: boolean
          phone_number: string
          provider: string
          provider_connection_id: string | null
          provider_metadata: Json
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          phone_number: string
          provider?: string
          provider_connection_id?: string | null
          provider_metadata?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          phone_number?: string
          provider?: string
          provider_connection_id?: string | null
          provider_metadata?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_versions: {
        Row: {
          billing_interval: number
          billing_period: string
          contacts_limit: number
          created_at: string
          effective_from: string
          effective_until: string | null
          features: Json
          id: string
          max_active_campaigns: number
          outbound_calls_limit: number
          plan_id: string
          price_paise: number
          razorpay_plan_id: string | null
          version: number
          voice_minutes_limit: number
        }
        Insert: {
          billing_interval?: number
          billing_period: string
          contacts_limit?: number
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          features?: Json
          id?: string
          max_active_campaigns?: number
          outbound_calls_limit?: number
          plan_id: string
          price_paise: number
          razorpay_plan_id?: string | null
          version?: number
          voice_minutes_limit?: number
        }
        Update: {
          billing_interval?: number
          billing_period?: string
          contacts_limit?: number
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          features?: Json
          id?: string
          max_active_campaigns?: number
          outbound_calls_limit?: number
          plan_id?: string
          price_paise?: number
          razorpay_plan_id?: string | null
          version?: number
          voice_minutes_limit?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          account_status_changed_at: string
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          account_status_changed_at?: string
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          account_status_changed_at?: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quota_reservations: {
        Row: {
          business_id: string
          campaign_id: string
          created_at: string
          expires_at: string
          id: string
          reserved_calls: number
          reserved_minutes: number
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          campaign_id: string
          created_at?: string
          expires_at: string
          id?: string
          reserved_calls?: number
          reserved_minutes?: number
          status: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          campaign_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          reserved_calls?: number
          reserved_minutes?: number
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quota_reservations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quota_reservations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quota_reservations_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          expires_at: string
          key: string
          last_refill: string
          tokens: number
        }
        Insert: {
          expires_at: string
          key: string
          last_refill?: string
          tokens: number
        }
        Update: {
          expires_at?: string
          key?: string
          last_refill?: string
          tokens?: number
        }
        Relationships: []
      }
      refund_records: {
        Row: {
          amount_inr: number | null
          amount_paise: number
          business_id: string
          created_at: string
          currency: string
          id: string
          notes: Json
          payment_id: string
          razorpay_refund_id: string
          speed_processed: string | null
          status: string
        }
        Insert: {
          amount_inr?: number | null
          amount_paise: number
          business_id: string
          created_at?: string
          currency?: string
          id?: string
          notes?: Json
          payment_id: string
          razorpay_refund_id: string
          speed_processed?: string | null
          status: string
        }
        Update: {
          amount_inr?: number | null
          amount_paise?: number
          business_id?: string
          created_at?: string
          currency?: string
          id?: string
          notes?: Json
          payment_id?: string
          razorpay_refund_id?: string
          speed_processed?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_records_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payment_records"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission: string
          role: Database["public"]["Enums"]["organization_role"]
        }
        Insert: {
          created_at?: string
          permission: string
          role: Database["public"]["Enums"]["organization_role"]
        }
        Update: {
          created_at?: string
          permission?: string
          role?: Database["public"]["Enums"]["organization_role"]
        }
        Relationships: []
      }
      subscription_history: {
        Row: {
          actor_id: string | null
          business_id: string
          created_at: string
          event_id: string | null
          from_status: string | null
          id: string
          metadata: Json
          reason: string
          subscription_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          business_id: string
          created_at?: string
          event_id?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json
          reason: string
          subscription_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          business_id?: string
          created_at?: string
          event_id?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json
          reason?: string
          subscription_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "webhook_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_period: string
          business_id: string
          cancel_at_period_end: boolean
          cancel_requested_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          dunning_retries_count: number
          grace_period_ends_at: string | null
          id: string
          last_event_at: string | null
          limits: Json
          metadata: Json
          plan_id: string | null
          plan_name: string
          plan_version_id: string | null
          provider_status: string | null
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          status: string
          trial_ends_at: string | null
          trial_starts_at: string | null
          updated_at: string
        }
        Insert: {
          billing_period?: string
          business_id: string
          cancel_at_period_end?: boolean
          cancel_requested_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          dunning_retries_count?: number
          grace_period_ends_at?: string | null
          id?: string
          last_event_at?: string | null
          limits?: Json
          metadata?: Json
          plan_id?: string | null
          plan_name?: string
          plan_version_id?: string | null
          provider_status?: string | null
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_period?: string
          business_id?: string
          cancel_at_period_end?: boolean
          cancel_requested_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          dunning_retries_count?: number
          grace_period_ends_at?: string | null
          id?: string
          last_event_at?: string | null
          limits?: Json
          metadata?: Json
          plan_id?: string | null
          plan_name?: string
          plan_version_id?: string | null
          provider_status?: string | null
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          business_id: string
          call_id: string | null
          campaign_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          quantity: number
          unit: string
        }
        Insert: {
          business_id: string
          call_id?: string | null
          campaign_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          quantity: number
          unit: string
        }
        Update: {
          business_id?: string
          call_id?: string | null
          campaign_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          business_id: string | null
          event_type: string
          id: string
          payload: Json
          payload_hash: string | null
          processed: boolean
          processed_at: string | null
          processing_error: string | null
          processing_started_at: string | null
          provider: string
          provider_event_created_at: string | null
          provider_event_id: string | null
          received_at: string
          signature_provider: string | null
          signature_valid: boolean | null
          status: string
        }
        Insert: {
          business_id?: string | null
          event_type: string
          id?: string
          payload: Json
          payload_hash?: string | null
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          provider?: string
          provider_event_created_at?: string | null
          provider_event_id?: string | null
          received_at?: string
          signature_provider?: string | null
          signature_valid?: boolean | null
          status?: string
        }
        Update: {
          business_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payload_hash?: string | null
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          provider?: string
          provider_event_created_at?: string | null
          provider_event_id?: string | null
          received_at?: string
          signature_provider?: string | null
          signature_valid?: boolean | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organization_invitation: {
        Args: { p_token_hash: string; p_user_id: string }
        Returns: Json
      }
      acquire_campaign_launch_and_quota: {
        Args: {
          p_business_id: string
          p_campaign_id: string
          p_estimated_calls: number
          p_estimated_minutes: number
        }
        Returns: Json
      }
      auth_user_business_id: { Args: never; Returns: string }
      auth_user_business_ids: { Args: never; Returns: string[] }
      auth_user_can_administer_business: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      auth_user_can_read_business: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      auth_user_can_write_business: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      auth_user_is_active: { Args: never; Returns: boolean }
      auth_user_organization_ids: { Args: never; Returns: string[] }
      auth_user_role_for_business: {
        Args: { p_business_id: string }
        Returns: Database["public"]["Enums"]["organization_role"]
      }
      check_rate_limit: {
        Args: {
          p_capacity: number
          p_cost?: number
          p_key: string
          p_refill_rate: number
        }
        Returns: Json
      }
      get_business_usage_aggregates: {
        Args: {
          p_business_id: string
          p_from_date?: string
          p_to_date?: string
        }
        Returns: {
          event_type: string
          total_quantity: number
        }[]
      }
      release_quota_reservation: {
        Args: {
          p_business_id: string
          p_commit?: boolean
          p_reservation_id: string
        }
        Returns: Json
      }
      uuid_generate_v4: { Args: never; Returns: string }
    }
    Enums: {
      account_status:
        | "PENDING_VERIFICATION"
        | "ACTIVE"
        | "SUSPENDED"
        | "LOCKED"
        | "DEACTIVATED"
        | "DELETION_PENDING"
      api_key_status: "ACTIVE" | "REVOKED"
      call_direction: "OUTBOUND" | "INBOUND"
      call_outcome:
        | "INTERESTED"
        | "NOT_INTERESTED"
        | "CALLBACK"
        | "NO_ANSWER"
        | "BUSY"
        | "UNREACHABLE"
        | "WRONG_NUMBER"
        | "DO_NOT_CALL"
        | "INFORMATION_REQUESTED"
        | "OTHER"
      call_status:
        | "QUEUED"
        | "INITIATED"
        | "RINGING"
        | "ANSWERED"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "FAILED"
        | "NO_ANSWER"
        | "BUSY"
        | "CANCELLED"
      callback_status:
        | "SCHEDULED"
        | "QUEUED"
        | "CALLING"
        | "COMPLETED"
        | "CANCELLED"
        | "MISSED"
      campaign_source_type:
        | "manual"
        | "text"
        | "pdf"
        | "document"
        | "website"
        | "csv"
        | "excel"
        | "google_sheet"
      campaign_status: "DRAFT" | "READY" | "RUNNING" | "PAUSED" | "COMPLETED"
      dnc_reason: "customer_requested" | "wrong_number" | "manual" | "other"
      organization_invitation_status:
        | "PENDING"
        | "ACCEPTED"
        | "EXPIRED"
        | "REVOKED"
      organization_membership_status: "ACTIVE" | "INVITED" | "SUSPENDED"
      organization_role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_status: [
        "PENDING_VERIFICATION",
        "ACTIVE",
        "SUSPENDED",
        "LOCKED",
        "DEACTIVATED",
        "DELETION_PENDING",
      ],
      api_key_status: ["ACTIVE", "REVOKED"],
      call_direction: ["OUTBOUND", "INBOUND"],
      call_outcome: [
        "INTERESTED",
        "NOT_INTERESTED",
        "CALLBACK",
        "NO_ANSWER",
        "BUSY",
        "UNREACHABLE",
        "WRONG_NUMBER",
        "DO_NOT_CALL",
        "INFORMATION_REQUESTED",
        "OTHER",
      ],
      call_status: [
        "QUEUED",
        "INITIATED",
        "RINGING",
        "ANSWERED",
        "IN_PROGRESS",
        "COMPLETED",
        "FAILED",
        "NO_ANSWER",
        "BUSY",
        "CANCELLED",
      ],
      callback_status: [
        "SCHEDULED",
        "QUEUED",
        "CALLING",
        "COMPLETED",
        "CANCELLED",
        "MISSED",
      ],
      campaign_source_type: [
        "manual",
        "text",
        "pdf",
        "document",
        "website",
        "csv",
        "excel",
        "google_sheet",
      ],
      campaign_status: ["DRAFT", "READY", "RUNNING", "PAUSED", "COMPLETED"],
      dnc_reason: ["customer_requested", "wrong_number", "manual", "other"],
      organization_invitation_status: [
        "PENDING",
        "ACCEPTED",
        "EXPIRED",
        "REVOKED",
      ],
      organization_membership_status: ["ACTIVE", "INVITED", "SUSPENDED"],
      organization_role: ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
    },
  },
} as const
