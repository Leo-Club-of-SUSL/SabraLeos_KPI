export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
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
            foreignKeyName: "contributions_member_reg_no_fkey";
            columns: ["member_reg_no"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["reg_no"];
          }
        ];
      };
      app_users: {
        Row: AppUser;
        Insert: AppUserInsert;
        Update: AppUserUpdate;
        Relationships: [
          {
            foreignKeyName: "app_users_linked_member_reg_no_fkey";
            columns: ["linked_member_reg_no"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["reg_no"];
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
    };
    Views: {
      [_ in never]: never
    };
    Functions: {
      [_ in never]: never
    };
    Enums: {
      [_ in never]: never
    };
    CompositeTypes: {
      [_ in never]: never
    };
  };
}

export interface Member {
  reg_no: string;
  photo_url: string | null;
  full_name: string;
  name_with_initials: string;
  my_lci_num: string | null;
  batch: string;
  faculty: string;
  whatsapp: string;
  total_points: number;
  created_at: string;
  updated_at: string;
}

export interface MemberInsert {
  reg_no: string;
  photo_url?: string | null;
  full_name: string;
  name_with_initials: string;
  my_lci_num?: string | null;
  batch: string;
  faculty: string;
  whatsapp: string;
  total_points?: number;
}

export interface MemberUpdate {
  photo_url?: string | null;
  full_name?: string;
  name_with_initials?: string;
  my_lci_num?: string | null;
  batch?: string;
  faculty?: string;
  whatsapp?: string;
}

export interface Contribution {
  id: string;
  member_reg_no: string;
  project_name: string;
  time_period: string;
  position: string;
  points: number;
  avenue: string | null;
  date_added: string;
  added_by: string | null;
}

export interface ContributionInsert {
  member_reg_no: string;
  project_name: string;
  time_period: string;
  position: string;
  points: number;
  avenue?: string | null;
  added_by?: string | null;
}

export interface ContributionUpdate {
  project_name?: string;
  time_period?: string;
  position?: string;
  points?: number;
  avenue?: string | null;
}

export interface AppUser {
  id: string;
  username: string;
  designation: string;
  role: 'super_admin' | 'editor' | 'viewer';
  linked_member_reg_no: string | null;
  created_at: string;
}

export interface AppUserInsert {
  id: string;
  username: string;
  designation: string;
  role: 'super_admin' | 'editor' | 'viewer';
  linked_member_reg_no?: string | null;
}

export interface AppUserUpdate {
  username?: string;
  designation?: string;
  role?: 'super_admin' | 'editor' | 'viewer';
  linked_member_reg_no?: string | null;
}

export interface Faculty {
  id: string;
  name: string;
  created_at: string;
}

export interface FacultyInsert {
  name: string;
}

export interface FacultyUpdate {
  name?: string;
}

export interface Batch {
  id: string;
  name: string;
  created_at: string;
}

export interface BatchInsert {
  name: string;
}

export interface BatchUpdate {
  name?: string;
}

export interface Avenue {
  id: string;
  name: string;
  created_at: string;
}

export interface AvenueInsert {
  name: string;
}

export interface AvenueUpdate {
  name?: string;
}
