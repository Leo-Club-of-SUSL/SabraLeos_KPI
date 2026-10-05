# SabraLeos Nexus KPI — Corrective Security Audit Report

**Date**: 2026-10-06  
**Status**: All Corrective Actions Completed & Hardened  
**Architecture Model**: Fail-Closed, Zero-Knowledge Password Management, Invite-Only Account Provisioning

---

## 1. Summary of Corrective Remediations (A through G)

| Item | Action | Status | Key Implementations & Files |
| :--- | :--- | :---: | :--- |
| **A1** | Delete client-side `supabase.auth.signUp` | **DONE** | Removed from `user-service.ts`. Added ESLint rule `no-restricted-syntax` in `eslint.config.js` and static guard test `security-static.test.ts`. Fail-closed message: *"Account service unavailable. Nothing was created."* |
| **A2** | Delete `42703` silent-retry fallbacks | **DONE** | Removed column-stripping fallback in `member-service.ts`. Added `schema_meta` table & `get_schema_version()` RPC in migration `20261006000002`. Added `EXPECTED_SCHEMA_VERSION = '2026.10.06.1'` & admin mismatch warning banner. |
| **A3** | Delete `admin-update-user-password` & admin password controls | **DONE** | Deleted `supabase/functions/admin-update-user-password`. Removed initial password generation / setting from `NewMemberForm.tsx`, `EditMemberForm.tsx`, and `UserManagement.tsx`. Zero-knowledge password model enforced. |
| **A4** | Restrict provisioning/suspension/reset to `super_admin` | **DONE** | Enforced in Edge Functions, UI navigation/tabs, and PostgreSQL RLS. Editors cannot provision or suspend users. |
| **A5** | Harden `system_settings` & Tier management | **DONE** | RLS requires `get_my_role() IS NOT NULL`. Direct table writes revoked from `authenticated` & `anon`. Writes route exclusively through `update_tier_thresholds` RPC (validates ascending order, 5 keys) with `preview_tier_changes` impact modal. Trigger logs to `system_logs`. |
| **A6** | Clean scripts & verify no secrets | **DONE** | Verified `scripts/check-columns.js` and repo contain no service role key. `.env*` git-ignored. Added build-time static check for `service_role`. |
| **B1** | Invite-only member & officer provisioning | **DONE** | `provision-members` and `admin-create-user` Edge Functions created with automatic rollback, batch processing, and idempotent handling. |
| **B2** | `/auth/set-password` page | **DONE** | Created `src/pages/SetPassword.tsx` handling invite & recovery token exchange, zxcvbn evaluation (score >= 3), 10+ char policy, and k-anonymity HaveIBeenPwned range check. |
| **B3** | Hardened Login flow | **DONE** | Email & password only. Turnstile token integration, uniform error message, `get_my_session_context()` check, TOTP MFA challenge, idle timeout (15m officers, 30m members). |
| **B4** | Forgot Password | **DONE** | Created `src/pages/ForgotPassword.tsx` with uniform messaging ("If an account exists, a reset link has been sent"). |
| **B5** | Self-service Change Password | **DONE** | Updated `ChangePasswordModal.tsx`: requires current password re-auth, zxcvbn + HIBP check, `signOut({ scope: 'others' })`, logs `PASSWORD_CHANGED`. |
| **B6** | Admin password reset | **DONE** | `admin-send-password-reset` Edge Function sends recovery email directly to member's inbox only; revokes existing sessions; audited. |
| **B7/B8** | Edge function standards & Security Events | **DONE** | `verify_jwt = true` in `supabase/config.toml`, CORS allow-listing, Zod schemas. Created `security_events` table and `security_alerts` trigger. |
| **C** | Automated Tests | **DONE** | Created `src/lib/__tests__/security-static.test.ts` (static guard + password + EXIF tests). |
| **D** | Deployment Runbook | **DONE** | Created `docs/DEPLOYMENT_RUNBOOK.md`. |
| **E** | Manual Dashboard Steps | **DONE** | Created `docs/MANUAL_STEPS.md`. |
| **F1-F6** | CI, Dependabot, MFA, Photo Privacy, Incident Response | **DONE** | `.github/workflows/security.yml`, `.github/dependabot.yml`, `docs/INCIDENT_RESPONSE.md`, `docs/DATA_RETENTION.md`, EXIF stripping in `image-utils.ts`. |
| **F7/G** | Independent Verification Kit | **DONE** | Created `scripts/security-smoke.js`. |

---

## 2. Discrepancy & Verification Records
- **Client-side auth.signUp**: Completely eliminated across the entire `src/` codebase.
- **Admin Password Reset**: Admins can only trigger a reset email dispatched to the user's verified inbox.
- **Staging Verification**: Smoke test script `scripts/security-smoke.js` created and allow-listed for staging execution.
