# User Deletion & Lifecycle Guide

This guide documents how user deletions are processed within the **SabraLeos KPI System** (Nexus KPI), covering the automated serverless Edge Function workflow, safeguard rules, and manual recovery options.

---

## 1. Automated Deletion via Edge Function (`admin-delete-user`)

User deletion is fully automated and secure via the `admin-delete-user` Deno Edge Function.

### How It Works:
1. A **Super Admin** clicks the **Delete User** action in the **User Management** interface (`src/pages/UserManagement.tsx`).
2. The client calls `userService.deleteUser(userId)` (`src/services/user-service.ts`).
3. The request invokes `supabase.functions.invoke('admin-delete-user', { body: { user_id } })` with the authenticated caller's JWT.
4. The Edge Function runs on Deno with server-side access to the `SUPABASE_SERVICE_ROLE_KEY`:
   - Verifies the caller is an active `super_admin`.
   - **Self-Deletion Guard**: Refuses to delete the caller's own account.
   - **Last Super Admin Guard**: Checks whether the target is a `super_admin`; if it is the only remaining super admin in the system, deletion is rejected with a `400 Bad Request`.
   - Deletes the identity from `auth.users` via `supabaseAdmin.auth.admin.deleteUser(user_id)`.
   - `ON DELETE CASCADE` cascades deletion to `public.app_users`.
   - Emits an audit log entry into `system_logs`.

---

## 2. Safeguard Rules

| Rule | Enforcement Location | Behavior |
| :--- | :--- | :--- |
| **Caller Authorization** | `admin-delete-user` Edge Function | Only active `super_admin` can execute. |
| **Prevent Self-Deletion** | Edge Function & UI | Caller cannot delete their own account. |
| **Last Super Admin Protection** | Edge Function | Prevents accidental lockout of the system by refusing deletion of the final remaining super admin. |
| **Member Record Integrity** | Database Schema (`ON DELETE SET NULL`) | Deleting an `app_user` does **not** delete the linked Leo Club member or their points in `members`. |

---

## 3. Manual Fallback: Supabase Dashboard

If an account needs manual deletion or in the event of an orphaned authentication record:

1. Log into your [Supabase Project Dashboard](https://supabase.com/dashboard).
2. Navigate to **Authentication > Users**.
3. Search for the user by email or User ID.
4. Click the three dots (⋮) and select **Delete user**.
5. The `ON DELETE CASCADE` rule will automatically clean up the corresponding profile row in `public.app_users`.

---

## 4. Manual Fallback: SQL Query (Service Role)

In the Supabase SQL Editor:

```sql
-- Deleting from auth.users cascades to app_users
DELETE FROM auth.users WHERE email = 'target_user@example.com';
```

---

## 5. Account Suspension vs Permanent Deletion

Instead of permanently deleting users, administrators can toggle user status to **`suspended`**:
- In **User Management**, set status to **Suspended**.
- Suspended users are immediately denied access across all RLS policies via fail-closed checks (`status = 'active'`).
- The `AuthContext` detects suspended accounts upon login/refresh and terminates the session automatically.

