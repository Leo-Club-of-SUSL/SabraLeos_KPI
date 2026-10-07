export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppUserRole = 'super_admin' | 'editor' | 'viewer' | 'member';
export type AppUserStatus = 'active' | 'suspended';
export type MemberStatus = 'active' | 'alumni';

export type Database = {
  public: {
    Tables: {
      members: {
        Row: Member;
        Insert: MemberInsert;
        Update: MemberUpdate;
        Relationships: [];
      };
      contributions: {
        Row: Contribution;
        Insert: ContributionInsert;
        Update: ContributionUpdate;
        Relationships: [
          {
            foreignKeyName: 'contributions_member_reg_no_fkey';
            columns: ['member_reg_no'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['reg_no'];
          }
        ];
      };
      app_users: {
        Row: AppUser;
        Insert: AppUserInsert;
        Update: AppUserUpdate;
        Relationships: [
          {
            foreignKeyName: 'app_users_linked_member_reg_no_fkey';
            columns: ['linked_member_reg_no'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['reg_no'];
          }
        ];
      };
      faculties: {
        Row: Faculty;
        Insert: FacultyInsert;
        Update: FacultyUpdate;
        Relationships: [];
      };
      batches: {
        Row: Batch;
        Insert: BatchInsert;
        Update: BatchUpdate;
        Relationships: [];
      };
      avenues: {
        Row: Avenue;
        Insert: AvenueInsert;
        Update: AvenueUpdate;
        Relationships: [];
      };
      system_logs: {
        Row: SystemLog;
        Insert: SystemLogInsert;
        Update: Record<string, never>;
        Relationships: [];
      };
      system_settings: {
        Row: SystemSetting;
        Insert: SystemSettingInsert;
        Update: SystemSettingUpdate;
        Relationships: [];
      };
      security_alerts: {
        Row: {
          id: string;
          alert_type: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          title: string;
          description: string | null;
          metadata: Json;
          is_resolved: boolean;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          alert_type: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          title: string;
          description?: string | null;
          metadata?: Json;
          is_resolved?: boolean;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          is_resolved: boolean;
          resolved_by: string | null;
          resolved_at: string | null;
        }>;
        Relationships: [];
      };
      security_events: {
        Row: {
          id: string;
          event_type: string;
          user_id: string | null;
          actor_id: string | null;
          ip_address: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          user_id?: string | null;
          actor_id?: string | null;
          ip_address?: string | null;
          details?: Json;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      schema_meta: {
        Row: {
          version: string;
          applied_at: string;
          description: string | null;
        };
        Insert: {
          version: string;
          applied_at?: string;
          description?: string | null;
        };
        Update: Partial<{
          description: string | null;
        }>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_schema_version: {
        Args: Record<never, never>;
        Returns: string;
      };
      get_dashboard_stats: {
        Args: Record<never, never>;
        Returns: Json;
      };
      get_my_session_context: {
        Args: Record<never, never>;
        Returns: Json;
      };
      update_tier_thresholds: {
        Args: { p_thresholds: Json };
        Returns: Json;
      };
      preview_tier_changes: {
        Args: { p_thresholds: Json };
        Returns: Json;
      };
      log_security_event: {
        Args: { p_event_type: string; p_target_user_id?: string | null; p_details?: Json };
        Returns: void;
      };
      get_my_role: {
        Args: Record<never, never>;
        Returns: string | null;
      };
      is_officer: {
        Args: Record<never, never>;
        Returns: boolean;
      };
      is_editor_or_above: {
        Args: Record<never, never>;
        Returns: boolean;
      };
      is_super_admin: {
        Args: Record<never, never>;
        Returns: boolean;
      };
      my_member_reg_no: {
        Args: Record<never, never>;
        Returns: string | null;
      };
      log_login: {
        Args: Record<never, never>;
        Returns: void;
      };
      log_export: {
        Args: { p_details: Json };
        Returns: void;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ============================================================
// Members
// ============================================================
export type Member = {
  reg_no: string;
  photo_url: string | null;
  full_name: string;
  name_with_initials: string;
  my_lci_num: string | null;
  batch: string;
  faculty: string;
  whatsapp: string;
  total_points: number;
  // Phase 1 additions
  deleted_at: string | null;
  email: string | null;
  leaderboard_opt_out: boolean;
  display_alias: string | null;
  member_status: MemberStatus;
  created_at: string;
  updated_at: string;
};

export type MemberInsert = {
  reg_no: string;
  photo_url?: string | null;
  full_name: string;
  name_with_initials: string;
  my_lci_num?: string | null;
  batch: string;
  faculty: string;
  whatsapp: string;
  email?: string | null;
  leaderboard_opt_out?: boolean;
  display_alias?: string | null;
  member_status?: MemberStatus;
  total_points?: number;
};

export type MemberUpdate = {
  photo_url?: string | null;
  full_name?: string;
  name_with_initials?: string;
  my_lci_num?: string | null;
  batch?: string;
  faculty?: string;
  whatsapp?: string;
  email?: string | null;
  leaderboard_opt_out?: boolean;
  display_alias?: string | null;
  member_status?: MemberStatus;
  deleted_at?: string | null;
};

// ============================================================
// Contributions
// ============================================================
export type Contribution = {
  id: string;
  member_reg_no: string;
  project_name: string;
  time_period: string;
  position: string;
  points: number;
  avenue: string | null;
  date_added: string;
  added_by: string | null;
};

export type ContributionInsert = {
  member_reg_no: string;
  project_name: string;
  time_period: string;
  position: string;
  points: number;
  avenue?: string | null;
  added_by?: string | null;
};

export type ContributionUpdate = {
  project_name?: string;
  time_period?: string;
  position?: string;
  points?: number;
  avenue?: string | null;
};

// ============================================================
// App Users
// ============================================================
export type AppUser = {
  id: string;
  username: string;
  designation: string;
  role: AppUserRole;
  status: AppUserStatus;
  linked_member_reg_no: string | null;
  created_at: string;
};

export type AppUserInsert = {
  id: string;
  username: string;
  designation: string;
  role: AppUserRole;
  status?: AppUserStatus;
  linked_member_reg_no?: string | null;
};

export type AppUserUpdate = {
  username?: string;
  designation?: string;
  role?: AppUserRole;
  status?: AppUserStatus;
  linked_member_reg_no?: string | null;
};

// ============================================================
// Taxonomy: Faculties, Batches, Avenues
// ============================================================
export type Faculty = {
  id: string;
  name: string;
  created_at: string;
};

export type FacultyInsert = {
  name: string;
};

export type FacultyUpdate = {
  name?: string;
};

export type Batch = {
  id: string;
  name: string;
  created_at: string;
};

export type BatchInsert = {
  name: string;
};

export type BatchUpdate = {
  name?: string;
};

export type Avenue = {
  id: string;
  name: string;
  created_at: string;
};

export type AvenueInsert = {
  name: string;
};

export type AvenueUpdate = {
  name?: string;
};

// ============================================================
// System Logs
// ============================================================
export type SystemLog = {
  id: string;
  timestamp: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  details: Json | null;
  entity_type: string | null;
  entity_id: string | null;
};

export type SystemLogInsert = {
  user_id?: string | null;
  user_name?: string | null;
  action: string;
  details?: Json | null;
  entity_type?: string | null;
  entity_id?: string | null;
};

// ============================================================
// System Settings
// ============================================================
export type SystemSetting = {
  key: string;
  value: Json;
  updated_at: string;
  updated_by?: string | null;
};

export type SystemSettingInsert = {
  key: string;
  value: Json;
  updated_at?: string;
  updated_by?: string | null;
};

export type SystemSettingUpdate = {
  key?: string;
  value?: Json;
  updated_at?: string;
  updated_by?: string | null;
};

