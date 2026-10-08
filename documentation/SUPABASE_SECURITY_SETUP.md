# Supabase Security & Hardening Setup

This document specifies the fail-closed security configuration, Row Level Security (RLS) policies, and environment configurations for production deployment.

---

## 1. Fail-Closed Role Helper Functions

To avoid recursive lookups and guarantee fail-closed security, execute these functions in the Supabase SQL Editor:

```sql
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
```

---

## 2. Row Level Security (RLS) Policies with Subquery Optimization

Wrap all security helper calls in subqueries (`(SELECT public.is_officer())`). This instructs PostgreSQL to evaluate caller permissions once per query rather than per row scanned.

### `members` Table
```sql
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select" ON public.members 
  FOR SELECT TO authenticated USING ((SELECT public.is_member()));

CREATE POLICY "members_insert" ON public.members 
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_officer()));

CREATE POLICY "members_update" ON public.members 
  FOR UPDATE TO authenticated USING ((SELECT public.is_officer())) WITH CHECK ((SELECT public.is_officer()));

CREATE POLICY "members_delete" ON public.members 
  FOR DELETE TO authenticated USING ((SELECT public.is_admin_or_super()));
```

### `contributions` Table
```sql
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contributions_select" ON public.contributions 
  FOR SELECT TO authenticated USING ((SELECT public.is_member()));

CREATE POLICY "contributions_insert" ON public.contributions 
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_officer()));

CREATE POLICY "contributions_update" ON public.contributions 
  FOR UPDATE TO authenticated 
  USING ((SELECT public.is_admin_or_super()) OR ((SELECT public.is_officer()) AND added_by = (SELECT auth.uid())));

CREATE POLICY "contributions_delete" ON public.contributions 
  FOR DELETE TO authenticated USING ((SELECT public.is_admin_or_super()));
```

### `app_users` Table
```sql
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_users_select" ON public.app_users 
  FOR SELECT TO authenticated USING ((SELECT public.is_member()));

CREATE POLICY "app_users_update" ON public.app_users 
  FOR UPDATE TO authenticated 
  USING ((SELECT public.is_admin_or_super()) OR id = (SELECT auth.uid()));
-- Note: app_users INSERT and DELETE are reserved exclusively for service_role (Edge Functions).
```

### `system_logs` & `security_events` Tables
```sql
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_logs_select" ON public.system_logs 
  FOR SELECT TO authenticated USING ((SELECT public.is_officer()));
CREATE POLICY "system_logs_insert" ON public.system_logs 
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "security_events_select" ON public.security_events 
  FOR SELECT TO authenticated USING ((SELECT public.is_officer()));
CREATE POLICY "security_events_insert" ON public.security_events 
  FOR INSERT TO authenticated WITH CHECK (true);
```

### Storage: `members` Bucket Policies
```sql
CREATE POLICY "storage_members_select" ON storage.objects 
  FOR SELECT USING (bucket_id = 'members');

CREATE POLICY "storage_members_insert" ON storage.objects 
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'members' AND (SELECT public.is_officer()));

CREATE POLICY "storage_members_update" ON storage.objects 
  FOR UPDATE TO authenticated USING (bucket_id = 'members' AND (SELECT public.is_officer()));

CREATE POLICY "storage_members_delete" ON storage.objects 
  FOR DELETE TO authenticated USING (bucket_id = 'members' AND (SELECT public.is_admin_or_super()));
```

---

## 3. Deno Edge Functions Deployment

Deploy the serverless functions with administrative service role permissions:

```bash
supabase functions deploy admin-create-user
supabase functions deploy admin-delete-user
supabase functions deploy admin-set-user-status
supabase functions deploy admin-set-user-password
supabase functions deploy admin-send-password-reset
supabase functions deploy admin-change-user-email
supabase functions deploy admin-reset-mfa
supabase functions deploy provision-members
```

Ensure the following secrets are accessible in Supabase Edge Functions:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

---

## 4. Frontend Environment Variables

Configure on Cloudflare Pages / hosting provider:
```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```
> [!CAUTION]
> **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` in frontend environment variables. All administrative operations must flow through Deno Edge Functions.

