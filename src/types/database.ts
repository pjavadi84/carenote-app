export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          type: "rcfe" | "home_care" | "other";
          timezone: string;
          email_from_name: string | null;
          email_reply_to: string | null;
          subscription_status: "trial" | "active" | "past_due" | "canceled";
          trial_ends_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: "rcfe" | "home_care" | "other";
          timezone?: string;
          email_from_name?: string | null;
          email_reply_to?: string | null;
          subscription_status?: "trial" | "active" | "past_due" | "canceled";
          trial_ends_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: "rcfe" | "home_care" | "other";
          timezone?: string;
          email_from_name?: string | null;
          email_reply_to?: string | null;
          subscription_status?: "trial" | "active" | "past_due" | "canceled";
          trial_ends_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          settings?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "";
            columns: [];
            isOneToOne: false;
            referencedRelation: "";
            referencedColumns: [];
          },
        ];
      };
      users: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          full_name: string;
          role: "admin" | "caregiver";
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          email: string;
          full_name: string;
          role?: "admin" | "caregiver";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          email?: string;
          full_name?: string;
          role?: "admin" | "caregiver";
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      residents: {
        Row: {
          id: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          date_of_birth: string | null;
          move_in_date: string | null;
          room_number: string | null;
          conditions: string | null;
          preferences: string | null;
          care_notes_context: string | null;
          status: "active" | "discharged" | "deceased";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          date_of_birth?: string | null;
          move_in_date?: string | null;
          room_number?: string | null;
          conditions?: string | null;
          preferences?: string | null;
          care_notes_context?: string | null;
          status?: "active" | "discharged" | "deceased";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          first_name?: string;
          last_name?: string;
          date_of_birth?: string | null;
          move_in_date?: string | null;
          room_number?: string | null;
          conditions?: string | null;
          preferences?: string | null;
          care_notes_context?: string | null;
          status?: "active" | "discharged" | "deceased";
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "residents_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      family_contacts: {
        Row: {
          id: string;
          resident_id: string;
          name: string;
          relationship: string;
          email: string | null;
          phone: string | null;
          is_primary: boolean;
          receives_updates: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          resident_id: string;
          name: string;
          relationship: string;
          email?: string | null;
          phone?: string | null;
          is_primary?: boolean;
          receives_updates?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          relationship?: string;
          email?: string | null;
          phone?: string | null;
          is_primary?: boolean;
          receives_updates?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "family_contacts_resident_id_fkey";
            columns: ["resident_id"];
            isOneToOne: false;
            referencedRelation: "residents";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          id: string;
          organization_id: string;
          resident_id: string;
          author_id: string;
          note_type: "shift_note" | "incident" | "observation" | "summary";
          raw_input: string;
          structured_output: string | null;
          is_structured: boolean;
          structuring_error: string | null;
          last_structuring_attempt_at: string | null;
          is_edited: boolean;
          edited_output: string | null;
          shift: "morning" | "afternoon" | "night" | null;
          flagged_as_incident: boolean;
          manually_flagged: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          resident_id: string;
          author_id: string;
          note_type: "shift_note" | "incident" | "observation" | "summary";
          raw_input: string;
          structured_output?: string | null;
          is_structured?: boolean;
          structuring_error?: string | null;
          last_structuring_attempt_at?: string | null;
          is_edited?: boolean;
          edited_output?: string | null;
          shift?: "morning" | "afternoon" | "night" | null;
          flagged_as_incident?: boolean;
          manually_flagged?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          structured_output?: string | null;
          is_structured?: boolean;
          structuring_error?: string | null;
          last_structuring_attempt_at?: string | null;
          is_edited?: boolean;
          edited_output?: string | null;
          flagged_as_incident?: boolean;
          manually_flagged?: boolean;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_resident_id_fkey";
            columns: ["resident_id"];
            isOneToOne: false;
            referencedRelation: "residents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      incident_reports: {
        Row: {
          id: string;
          note_id: string;
          organization_id: string;
          resident_id: string;
          report_text: string;
          incident_type: string;
          severity: "low" | "medium" | "high";
          status: "open" | "reviewed" | "closed";
          reviewed_by: string | null;
          reviewed_at: string | null;
          manager_notes: string | null;
          family_notified: boolean;
          family_notified_at: string | null;
          follow_up_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          organization_id: string;
          resident_id: string;
          report_text: string;
          incident_type: string;
          severity?: "low" | "medium" | "high";
          status?: "open" | "reviewed" | "closed";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          manager_notes?: string | null;
          family_notified?: boolean;
          family_notified_at?: string | null;
          follow_up_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          report_text?: string;
          incident_type?: string;
          severity?: "low" | "medium" | "high";
          status?: "open" | "reviewed" | "closed";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          manager_notes?: string | null;
          family_notified?: boolean;
          family_notified_at?: string | null;
          follow_up_date?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "incident_reports_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "incident_reports_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "incident_reports_resident_id_fkey";
            columns: ["resident_id"];
            isOneToOne: false;
            referencedRelation: "residents";
            referencedColumns: ["id"];
          },
        ];
      };
      family_communications: {
        Row: {
          id: string;
          organization_id: string;
          resident_id: string;
          generated_by: string;
          recipient_contact_id: string;
          subject: string;
          body: string;
          source_note_ids: string[];
          date_range_start: string;
          date_range_end: string;
          status: "draft" | "sent" | "failed";
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          resident_id: string;
          generated_by: string;
          recipient_contact_id: string;
          subject: string;
          body: string;
          source_note_ids?: string[];
          date_range_start: string;
          date_range_end: string;
          status?: "draft" | "sent" | "failed";
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          subject?: string;
          body?: string;
          source_note_ids?: string[];
          status?: "draft" | "sent" | "failed";
          sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "family_communications_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_communications_resident_id_fkey";
            columns: ["resident_id"];
            isOneToOne: false;
            referencedRelation: "residents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_communications_generated_by_fkey";
            columns: ["generated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_communications_recipient_contact_id_fkey";
            columns: ["recipient_contact_id"];
            isOneToOne: false;
            referencedRelation: "family_contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      weekly_summaries: {
        Row: {
          id: string;
          organization_id: string;
          resident_id: string;
          week_start: string;
          week_end: string;
          summary_text: string;
          key_trends: string[];
          concerns: string[];
          incidents_count: number;
          source_note_ids: string[];
          status: "pending_review" | "approved" | "regenerating";
          reviewed_by: string | null;
          reviewed_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          resident_id: string;
          week_start: string;
          week_end: string;
          summary_text: string;
          key_trends?: string[];
          concerns?: string[];
          incidents_count?: number;
          source_note_ids?: string[];
          status?: "pending_review" | "approved" | "regenerating";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          summary_text?: string;
          key_trends?: string[];
          concerns?: string[];
          incidents_count?: number;
          status?: "pending_review" | "approved" | "regenerating";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "weekly_summaries_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "weekly_summaries_resident_id_fkey";
            columns: ["resident_id"];
            isOneToOne: false;
            referencedRelation: "residents";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience types
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type User = Database["public"]["Tables"]["users"]["Row"];
export type Resident = Database["public"]["Tables"]["residents"]["Row"];
export type FamilyContact = Database["public"]["Tables"]["family_contacts"]["Row"];
export type Note = Database["public"]["Tables"]["notes"]["Row"];
export type IncidentReport = Database["public"]["Tables"]["incident_reports"]["Row"];
export type FamilyCommunication = Database["public"]["Tables"]["family_communications"]["Row"];
export type WeeklySummary = Database["public"]["Tables"]["weekly_summaries"]["Row"];
