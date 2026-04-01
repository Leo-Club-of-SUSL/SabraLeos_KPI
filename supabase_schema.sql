-- Nexus KPI System - Complete Supabase Schema
-- This script sets up the tables, triggers, and Row Level Security (RLS) policies.

-- 1. Create Tables
-- ==========================================

-- Members Table
CREATE TABLE IF NOT EXISTS public.members (
    reg_no TEXT PRIMARY KEY,
    photo_url TEXT,
    full_name TEXT NOT NULL,
    name_with_initials TEXT NOT NULL,
    my_lci_num TEXT,
    batch TEXT NOT NULL,
    faculty TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    total_points INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contributions Table
CREATE TABLE IF NOT EXISTS public.contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_reg_no TEXT REFERENCES public.members(reg_no) ON DELETE CASCADE NOT NULL,
    project_name TEXT NOT NULL,
    time_period TEXT NOT NULL, -- Format: YYYY-MM
    position TEXT NOT NULL,
    points INTEGER NOT NULL,
    avenue TEXT,
    date_added TIMESTAMPTZ DEFAULT NOW(),
    added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- App Users Table (Profiles)
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    designation TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'editor', 'viewer')),
    linked_member_reg_no TEXT REFERENCES public.members(reg_no) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faculties Table
CREATE TABLE IF NOT EXISTS public.faculties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batches Table
CREATE TABLE IF NOT EXISTS public.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Avenues Table
CREATE TABLE IF NOT EXISTS public.avenues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Logs Table
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id),
    user_name TEXT,
    action TEXT NOT NULL,
    details JSONB,
    entity_type TEXT,
    entity_id TEXT
);

-- 2. Security Setup (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get the current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role::text FROM public.app_users WHERE id = auth.uid();
$$;

-- Members Policies
CREATE POLICY "members_select" ON public.members FOR SELECT TO authenticated USING (true);
CREATE POLICY "members_insert" ON public.members FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('super_admin','editor'));
CREATE POLICY "members_update" ON public.members FOR UPDATE TO authenticated USING (public.get_my_role() IN ('super_admin','editor')) WITH CHECK (public.get_my_role() IN ('super_admin','editor'));
CREATE POLICY "members_delete" ON public.members FOR DELETE TO authenticated USING (public.get_my_role() IN ('super_admin','editor'));

-- Contributions Policies
CREATE POLICY "contributions_select" ON public.contributions FOR SELECT TO authenticated USING (true);
CREATE POLICY "contributions_insert" ON public.contributions FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('super_admin','editor'));
CREATE POLICY "contributions_update" ON public.contributions FOR UPDATE TO authenticated USING (public.get_my_role() = 'super_admin' OR (public.get_my_role() = 'editor' AND added_by = auth.uid())) WITH CHECK (public.get_my_role() = 'super_admin' OR (public.get_my_role() = 'editor' AND added_by = auth.uid()));
CREATE POLICY "contributions_delete" ON public.contributions FOR DELETE TO authenticated USING (public.get_my_role() = 'super_admin');

-- App Users Policies
CREATE POLICY "app_users_select" ON public.app_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_users_insert" ON public.app_users FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'super_admin');
CREATE POLICY "app_users_update" ON public.app_users FOR UPDATE TO authenticated USING (public.get_my_role() = 'super_admin' OR id = auth.uid()) WITH CHECK (public.get_my_role() = 'super_admin' OR id = auth.uid());
CREATE POLICY "app_users_delete" ON public.app_users FOR DELETE TO authenticated USING (public.get_my_role() = 'super_admin');

-- Faculties Policies
CREATE POLICY "faculties_select" ON public.faculties FOR SELECT TO authenticated USING (true);
CREATE POLICY "faculties_all" ON public.faculties FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin','editor')) WITH CHECK (public.get_my_role() IN ('super_admin','editor'));

-- Batches Policies
CREATE POLICY "batches_select" ON public.batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "batches_all" ON public.batches FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin','editor')) WITH CHECK (public.get_my_role() IN ('super_admin','editor'));

-- Avenues Policies
CREATE POLICY "avenues_select" ON public.avenues FOR SELECT TO authenticated USING (true);
CREATE POLICY "avenues_all" ON public.avenues FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin','editor')) WITH CHECK (public.get_my_role() IN ('super_admin','editor'));

-- System Logs Policies
CREATE POLICY "system_logs_select" ON public.system_logs FOR SELECT TO authenticated USING (public.get_my_role() IN ('super_admin', 'editor'));
CREATE POLICY "system_logs_insert" ON public.system_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Storage Policies
-- IMPORTANT: The 'members' bucket MUST be set to PUBLIC in the Supabase dashboard
--   Storage → Buckets → members → Edit → toggle "Public bucket" ON
-- Then run the following SQL to set the correct RLS policies on storage.objects:

-- Allow anyone (including anonymous) to VIEW photos (required for img src / getPublicUrl)
CREATE POLICY "storage_members_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'members');

-- Allow authenticated editors/super_admins to UPLOAD photos
CREATE POLICY "storage_members_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'members' AND public.get_my_role() IN ('super_admin', 'editor'));

-- Allow authenticated editors/super_admins to UPDATE (replace) photos
CREATE POLICY "storage_members_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'members' AND public.get_my_role() IN ('super_admin', 'editor'));

-- Allow super_admins to DELETE photos
CREATE POLICY "storage_members_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'members' AND public.get_my_role() = 'super_admin');

-- 3. Triggers & Functions
-- ==========================================

-- Function to recalculate total points for a member
CREATE OR REPLACE FUNCTION public.recalculate_member_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
    target_reg_no TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN 
        target_reg_no := OLD.member_reg_no;
    ELSE 
        target_reg_no := NEW.member_reg_no; 
    END IF;

    UPDATE public.members
    SET total_points = COALESCE((SELECT SUM(points) FROM public.contributions WHERE member_reg_no = target_reg_no), 0),
        updated_at = NOW()
    WHERE reg_no = target_reg_no;

    RETURN COALESCE(NEW, OLD);
END; 
$$;

-- Trigger to recalculate points after contribution changes
DROP TRIGGER IF EXISTS trg_recalculate_points ON public.contributions;
CREATE TRIGGER trg_recalculate_points
  AFTER INSERT OR UPDATE OR DELETE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_member_points();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at on members
CREATE TRIGGER update_members_updated_at
    BEFORE UPDATE ON public.members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
