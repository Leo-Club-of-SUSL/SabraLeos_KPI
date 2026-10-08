# SabraLeos (Nexus KPI) Database Setup Guide

This guide provides the complete setup script and instructions to initialize the PostgreSQL database on Supabase for the SabraLeos KPI System.

---

## Prerequisites

- Active Supabase project (PostgreSQL 15)
- Access to the **SQL Editor** in the Supabase Dashboard

---

## Step 1: Execute Complete Migration Script

Open the **SQL Editor** in your Supabase Dashboard, create a **New Query**, paste the script below, and execute it:

```sql
-- 1. Create members table
CREATE TABLE IF NOT EXISTS public.members (
  reg_no text PRIMARY KEY,
  photo_url text,
  full_name text NOT NULL,
  name_with_initials text NOT NULL,
  my_lci_num text,
  batch text NOT NULL,
  faculty text NOT NULL,
  whatsapp text NOT NULL,
  total_points integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create contributions table
CREATE TABLE IF NOT EXISTS public.contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_reg_no text NOT NULL REFERENCES public.members(reg_no) ON DELETE CASCADE,
  project_name text NOT NULL,
  time_period text NOT NULL,
  position text NOT NULL,
  points integer NOT NULL CHECK (points BETWEEN 1 AND 1000),
  avenue text,
  date_added timestamptz DEFAULT now(),
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. Create app_users table (with 5 roles and status)
CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  designation text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'editor', 'viewer', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  linked_member_reg_no text REFERENCES public.members(reg_no) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 4. Taxonomy tables
CREATE TABLE IF NOT EXISTS public.faculties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.avenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. Tier settings table
CREATE TABLE IF NOT EXISTS public.tier_settings (
  id text PRIMARY KEY,
  name text NOT NULL,
  min_points integer NOT NULL DEFAULT 0,
  color text NOT NULL,
  badge_style text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Seed default tiers
INSERT INTO public.tier_settings (id, name, min_points, color, badge_style, sort_order)
VALUES 
  ('bronze', 'Bronze', 0, '#cd7f32', 'badge-bronze', 1),
  ('silver', 'Silver', 100, '#c0c0c0', 'badge-silver', 2),
  ('gold', 'Gold', 250, '#ffd700', 'badge-gold', 3),
  ('platinum', 'Platinum', 500, '#e5e4e2', 'badge-platinum', 4),
  ('diamond', 'Diamond', 1000, '#b9f2ff', 'badge-diamond', 5)
ON CONFLICT (id) DO NOTHING;

-- 6. Audit and security logging tables
CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  timestamp timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  user_name text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb
);

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('INFO', 'WARN', 'CRITICAL')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  actor_name text,
  details jsonb
);

-- 7. High-Performance B-Tree Indexes
CREATE INDEX IF NOT EXISTS idx_contributions_member_reg_no ON public.contributions (member_reg_no);
CREATE INDEX IF NOT EXISTS idx_contributions_added_by ON public.contributions (added_by);
CREATE INDEX IF NOT EXISTS idx_contributions_time_period ON public.contributions (time_period);
CREATE INDEX IF NOT EXISTS idx_contributions_date_added ON public.contributions (date_added DESC);
CREATE INDEX IF NOT EXISTS idx_app_users_linked_member ON public.app_users (linked_member_reg_no);
CREATE INDEX IF NOT EXISTS idx_members_total_points ON public.members (total_points DESC);
CREATE INDEX IF NOT EXISTS idx_members_faculty ON public.members (faculty);
CREATE INDEX IF NOT EXISTS idx_members_batch ON public.members (batch);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events (created_at DESC);

-- 8. Stored Procedures and Helper Functions
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE id = auth.uid() AND role = 'super_admin' AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin') AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_officer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'editor') AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE id = auth.uid() AND status = 'active'
  );
$$;

-- Consolidated Session Context RPC
CREATE OR REPLACE FUNCTION public.get_my_session_context()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user public.app_users%ROWTYPE;
  v_member public.members%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('authenticated', false);
  END IF;

  SELECT * INTO v_user FROM public.app_users WHERE id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('authenticated', true, 'profile_found', false);
  END IF;

  IF v_user.linked_member_reg_no IS NOT NULL THEN
    SELECT * INTO v_member FROM public.members WHERE reg_no = v_user.linked_member_reg_no;
  END IF;

  RETURN jsonb_build_object(
    'authenticated', true,
    'profile_found', true,
    'app_user', to_jsonb(v_user),
    'member', CASE WHEN v_member.reg_no IS NOT NULL THEN to_jsonb(v_member) ELSE NULL END
  );
END;
$$;

-- Automatic Point Recalculation Trigger Function
CREATE OR REPLACE FUNCTION public.recalculate_member_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE target_reg_no TEXT;
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

DROP TRIGGER IF EXISTS trg_recalculate_points ON public.contributions;
CREATE TRIGGER trg_recalculate_points
  AFTER INSERT OR UPDATE OR DELETE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_member_points();

-- 9. Row Level Security (RLS) Enablement
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies (Wrapped in subqueries for performance)
-- members
CREATE POLICY "members_select" ON public.members FOR SELECT TO authenticated USING ((SELECT public.is_member()));
CREATE POLICY "members_insert" ON public.members FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_officer()));
CREATE POLICY "members_update" ON public.members FOR UPDATE TO authenticated USING ((SELECT public.is_officer())) WITH CHECK ((SELECT public.is_officer()));
CREATE POLICY "members_delete" ON public.members FOR DELETE TO authenticated USING ((SELECT public.is_admin_or_super()));

-- contributions
CREATE POLICY "contributions_select" ON public.contributions FOR SELECT TO authenticated USING ((SELECT public.is_member()));
CREATE POLICY "contributions_insert" ON public.contributions FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_officer()));
CREATE POLICY "contributions_update" ON public.contributions FOR UPDATE TO authenticated USING ((SELECT public.is_admin_or_super()) OR ((SELECT public.is_officer()) AND added_by = (SELECT auth.uid())));
CREATE POLICY "contributions_delete" ON public.contributions FOR DELETE TO authenticated USING ((SELECT public.is_admin_or_super()));

-- app_users
CREATE POLICY "app_users_select" ON public.app_users FOR SELECT TO authenticated USING ((SELECT public.is_member()));
CREATE POLICY "app_users_update" ON public.app_users FOR UPDATE TO authenticated USING ((SELECT public.is_admin_or_super()) OR id = (SELECT auth.uid()));

-- taxonomies
CREATE POLICY "faculties_select" ON public.faculties FOR SELECT TO authenticated USING (true);
CREATE POLICY "faculties_manage" ON public.faculties FOR ALL TO authenticated USING ((SELECT public.is_admin_or_super()));

CREATE POLICY "batches_select" ON public.batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "batches_manage" ON public.batches FOR ALL TO authenticated USING ((SELECT public.is_admin_or_super()));

CREATE POLICY "avenues_select" ON public.avenues FOR SELECT TO authenticated USING (true);
CREATE POLICY "avenues_manage" ON public.avenues FOR ALL TO authenticated USING ((SELECT public.is_admin_or_super()));

-- tier_settings
CREATE POLICY "tier_settings_select" ON public.tier_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "tier_settings_manage" ON public.tier_settings FOR ALL TO authenticated USING ((SELECT public.is_super_admin()));

-- logs
CREATE POLICY "system_logs_select" ON public.system_logs FOR SELECT TO authenticated USING ((SELECT public.is_officer()));
CREATE POLICY "system_logs_insert" ON public.system_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "security_events_select" ON public.security_events FOR SELECT TO authenticated USING ((SELECT public.is_officer()));
CREATE POLICY "security_events_insert" ON public.security_events FOR INSERT TO authenticated WITH CHECK (true);
```

---

## Step 2: Storage Bucket Configuration

1. In Supabase Dashboard, navigate to **Storage**.
2. Create a bucket named `members`.
3. Set bucket to **Public** for avatar CDN URLs.
4. Add storage policies:
   - SELECT: Allow public read access to `members` bucket.
   - INSERT/UPDATE: Allow authenticated users where `public.is_officer()` is true.
   - DELETE: Allow authenticated users where `public.is_admin_or_super()` is true.

---

## Step 3: Create Initial Super Admin User

1. In Supabase Dashboard, go to **Authentication > Users**.
2. Click **Add User** (Create user with your admin email and a strong password).
3. Copy the generated User ID UUID.
4. In the SQL Editor, execute:

```sql
INSERT INTO public.app_users (id, username, designation, role, status)
VALUES ('PASTE_COPIED_USER_ID_HERE', 'superadmin', 'President / Administrator', 'super_admin', 'active');
```

---

## Step 4: Verification

1. Start your local dev server: `npm run dev`.
2. Log in using your Super Admin credentials.
3. Access the **User Management** page to verify the Users, Provisioning, System Data, Tier Settings, and Audit Logs tabs.

