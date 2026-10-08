# API & Services Map

The application interacts with its backend (Supabase PostgREST, PostgreSQL RPCs, Storage, and Deno Edge Functions) via a modular service layer located in `src/services/`. React components interface exclusively through this layer, ensuring separation of concerns, strict type validation, and centralized error normalization.

---

## 1. `member-service.ts`
Manages member registry lifecycles, photo uploads, and profile lookups.

- `getMembers(options)`: Fetches members with explicit column projection (`select('reg_no, full_name, name_with_initials, batch, faculty, total_points, photo_url, whatsapp')`), search filtering, and pagination.
- `getMemberByRegNo(regNo)`: Retrieves full member dossier with complete metadata.
- `createMember(memberData)`: Sanitizes input, inserts record into `members`, and triggers audit logging.
- `updateMember(regNo, updateData)`: Updates member fields, updates timestamp, and logs mutation.
- `deleteMember(regNo)`: Deletes member record (cascading contributions) and emits audit log.
- `uploadMemberPhoto(file)`: Validates file type/size, processes through canvas compressor, uploads to Supabase Storage `members` bucket, and returns public URL.
- `provisionMembers(members)`: Calls the `provision-members` Deno Edge Function to bulk-create system user accounts for registered members.

---

## 2. `contribution-service.ts`
Handles service point awards, project assignments, monthly leaderboard aggregations, and report exports.

- `getContributionsByMember(regNo)`: Retrieves chronological contribution timeline for a given member.
- `addContribution(contributionData)`: Logs a new service contribution. Triggers database trigger `trg_recalculate_points`. Emits audit log.
- `createMany(contributions)`: Batch inserts contributions for multiple members participating in the same project (`BulkProjectContributionForm`).
- `updateContribution(id, updateData)`: Modifies contribution record and updates points.
- `deleteContribution(id)`: Removes contribution and recalculates member points.
- `getMonthlyLeaderboard(year, month)`: Aggregates member points within specified `time_period` (`YYYY-MM`).
- `getAllContributionsForExport(filters)`: Paginates through contribution datasets in chunks to prevent browser memory exhaustion when generating extensive CSV/PDF exports.

---

## 3. `user-service.ts`
Manages system user accounts, credentials, and access roles. Leverages Supabase Edge Functions for secure administrative actions without exposing the service role key to the client.

- `getUsers()`: Retrieves all `app_users` rows along with linked member records.
- `createUser(userData)`: Invokes `admin-create-user` Edge Function to create `auth.users` identity and `app_users` profile atomically.
- `setUserPassword(userId, newPassword)`: Invokes `admin-set-user-password` Edge Function for administrative credential overrides.
- `sendPasswordReset(email)`: Invokes `admin-send-password-reset` Edge Function to trigger a recovery email.
- `deleteUser(userId)`: Invokes `admin-delete-user` Edge Function to permanently remove user from both `auth.users` and `app_users` (with guard preventing deletion of the last super admin).
- `setUserStatus(userId, status)`: Invokes `admin-set-user-status` Edge Function to activate or suspend accounts.
- `changeUserEmail(userId, newEmail)`: Invokes `admin-change-user-email` Edge Function.
- `resetMFA(userId)`: Invokes `admin-reset-mfa` Edge Function.
- `updateUserRole(userId, newRole)`: Modifies user RBAC role in `app_users`.
- `linkUserToMember(userId, regNo)`: Associates user profile with club member registry entry.

---

## 4. `system-service.ts`
Manages taxonomies (faculties, batches, avenues), tier configurations, and implements in-memory static data caching.

- `getFaculties()`, `getBatches()`, `getAvenues()`: Fetches taxonomies with in-memory caching to eliminate redundant database calls across view navigations.
- `createFaculty()`, `updateFaculty()`, `deleteFaculty()`: Faculty management (invalidates cache on mutation).
- `createBatch()`, `updateBatch()`, `deleteBatch()`: Batch management (invalidates cache on mutation).
- `createAvenue()`, `updateAvenue()`, `deleteAvenue()`: Avenue management (invalidates cache on mutation).
- `getTierSettings()`: Retrieves recognition tier thresholds (`bronze`, `silver`, `gold`, `platinum`, `diamond`).
- `updateTierSetting(id, updates)`: Updates point threshold and styling for a specific tier.
- `clearCache()`: Manually invalidates static data caches.

---

## 5. `log-service.ts`
Centralized service for recording and retrieving system audit trails and security events.

- `getLogs(filters)`: Retrieves `system_logs` with actor name resolution, filtering by entity, action, or date, supporting both `created_at` and legacy `timestamp` columns.
- `getSecurityLogs(filters)`: Retrieves `security_events` with severity classification (`INFO`, `WARN`, `CRITICAL`) and actor resolution.
- `logEvent(action, entityType, entityId, details)`: Dispatches system audit log entry.
- `logSecurityEvent(eventType, severity, details)`: Dispatches security event entry (login attempt, logout, lockout).

---

## 6. `bulk-import-service.ts`
Excel ingestion and interactive verification engine using SheetJS (`xlsx`).

- `downloadTemplate()`: Generates an enhanced Excel workbook (`member_import_template.xlsx`) featuring a `Members` entry sheet with sample data and a `Valid_Selections` reference sheet dynamically populated with all active faculties and batches from the database.
- `parseExcelFile(file)`: Parses `.xlsx` or `.xls` files, resiliently mapping various column header formats and auto-normalizing phone numbers.
- `stageAndValidateRows(rows, faculties, batches)`: Transforms parsed rows into staged entities, checks database duplicate registration numbers in chunks of 100, and verifies faculties, batches, and required fields.
- `revalidateStagedRows(rows, validFaculties, validBatches, existingInDb)`: High-performance synchronous validator that re-evaluates errors in real time as users edit cells or choose dropdown options.
- `normalizePhoneNumber(raw)`: Standardizes Sri Lankan and international numbers (e.g., `0771234567` -> `+94771234567`).
- `importMembers(rows)`: Batch inserts verified members in chunks of 100 with automatic row-by-row retry fallback to isolate failing records.

---

## 7. Supabase Database RPCs

- `supabase.rpc('get_my_session_context')`: Merged session context query returning caller profile, role, and linked member data in a single network trip.
- `supabase.rpc('get_dashboard_stats')`: Aggregates active member count, total points, monthly project volume, and avenue points breakdown directly in PostgreSQL.

---

## 8. Deno Edge Functions Reference

| Function Name | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `admin-create-user` | `/v1/functions/admin-create-user` | Bearer JWT (`super_admin`, `admin`) | Provisions user with credentials or invite |
| `admin-delete-user` | `/v1/functions/admin-delete-user` | Bearer JWT (`super_admin`) | Deletes user from auth and public tables |
| `admin-set-user-password` | `/v1/functions/admin-set-user-password` | Bearer JWT (`super_admin`) | Direct password override |
| `admin-send-password-reset`| `/v1/functions/admin-send-password-reset` | Bearer JWT (`super_admin`, `admin`) | Dispatches recovery email |
| `admin-set-user-status` | `/v1/functions/admin-set-user-status` | Bearer JWT (`super_admin`, `admin`) | Toggles `active` / `suspended` |
| `admin-change-user-email` | `/v1/functions/admin-change-user-email` | Bearer JWT (`super_admin`) | Updates user email in Auth |
| `admin-reset-mfa` | `/v1/functions/admin-reset-mfa` | Bearer JWT (`super_admin`) | Clears MFA factors |
| `provision-members` | `/v1/functions/provision-members` | Bearer JWT (`super_admin`, `admin`) | Bulk provisions member accounts |

