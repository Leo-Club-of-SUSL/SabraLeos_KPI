# SabraLeos Nexus KPI — Incident Response Playbook

## 1. Roles & Incident Team
- **Incident Commander (IC)**: Club President / Lead Systems Architect
- **Database Administrator (DBA)**: Lead Super Admin
- **Communications Lead**: Club Secretary

---

## 2. Emergency Kill-Switches

### Immediate Revocation of All Member Access
If an active compromise or data harvesting attempt is suspected, execute the following SQL in the Supabase SQL Editor:

```sql
-- Disable member role access system-wide immediately
UPDATE system_settings
SET value = jsonb_build_object('member_access_enabled', false)
WHERE key = 'security_kill_switch';
```

*(This causes `get_my_session_context()` and `get_my_role()` to return NULL for all `member` roles, immediately rejecting all API and table access).*

### Suspending a Compromised Officer Account
1. Open **User Management -> User Accounts**.
2. Click the **UserX** (Suspend) icon next to the affected officer.
3. This revokes session validity immediately and prevents further API interaction.

---

## 3. Secret & Key Rotation Procedure

### Rotating Supabase Anon & Service Role Keys
1. In Supabase Dashboard -> **Project Settings -> API**:
2. Click **Generate new JWT Secret**.
3. Copy the newly generated `anon` key and `service_role` key.
4. Update hosting environment variables:
   - In Cloudflare Pages / Vercel: Update `VITE_SUPABASE_ANON_KEY` and trigger immediate redeployment.
   - In Supabase CLI: Execute `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<NEW_KEY>`.

### Rotating SMTP & Turnstile Keys
1. Generate new API keys in Cloudflare / SendGrid.
2. Update in Supabase Dashboard -> **Authentication -> SMTP Settings** & **Bot Protection**.

---

## 4. Post-Incident Review Checklist
- [ ] Verify all compromised sessions invalidated in `auth.sessions`.
- [ ] Review `system_logs` and `security_events` to determine breach extent.
- [ ] Export audit log records for archival.
- [ ] Notify affected club members in compliance with Sri Lanka PDPA guidelines.
- [ ] Document root cause and apply preventive code/migration patches.
