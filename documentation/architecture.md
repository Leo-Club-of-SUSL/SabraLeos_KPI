# System Architecture

## 1. High-Level Architecture Overview

The **SabraLeos KPI System** (Nexus KPI) is built as an enterprise-grade Progressive Web Application (PWA) using a decoupled architecture. The frontend is a Single Page Application (SPA) powered by React 18 and Vite, communicating with a managed Supabase backend (PostgreSQL 15, PostgREST, Supabase GoTrue Auth, and Deno Edge Functions).

```mermaid
graph TD
    Client["React 18 + Vite PWA (Frontend)"] -->|HTTPS / REST (PostgREST)| PostgREST["PostgREST Engine"]
    Client -->|Session Auth (PKCE)| Auth["Supabase Auth (GoTrue)"]
    Client -->|Admin Actions & Provisioning| EdgeFunctions["Deno Edge Functions"]
    Client -->|Photo Blobs| Storage["Supabase Storage ('members' bucket)"]

    subgraph Client Application
        UI["UI Layer (Officer & Member Dashboards)"]
        Contexts["Contexts (AuthContext, ThemeContext)"]
        Hooks["Hooks (usePermissions)"]
        Services["Service Layer (member, contribution, user, system, log, bulk-import)"]
        Cache["In-Memory Static Cache (taxonomies)"]
        UI --> Contexts
        UI --> Hooks
        UI --> Services
        Services --> Cache
    end

    subgraph Supabase Platform
        EdgeFunctions -->|Service Role Key| DB[(PostgreSQL 15 Database)]
        PostgREST --> DB
        Auth --> DB
        
        subgraph Database Engine
            Tables["Tables (members, contributions, app_users, tier_settings, system_logs, security_events)"]
            RPCs["Stored Procedures (get_my_session_context, get_dashboard_stats)"]
            Triggers["Triggers (recalculate_member_points, updated_at)"]
            RLS["Fail-Closed Row Level Security (RLS)"]
            Indexes["B-Tree Indexes (FKs, filter fields, composite keys)"]
            
            RLS --> Tables
            Tables --> Triggers
            Tables --> Indexes
            RPCs --> Tables
        end
    end
```

---

## 2. Frontend Architecture (Client-Side)

### Technology Stack
- **Framework:** React 18.3+ with TypeScript
- **Build Tool & Bundler:** Vite 7+
- **Styling:** Tailwind CSS with custom maroon (`#800000`) and gold (`#FFD700`) brand palette, glassmorphism, and dark mode
- **Icons:** Lucide React
- **Document Processing:** SheetJS (`xlsx`) for Excel import/export; `jspdf` & `jspdf-autotable` for vector PDF generation
- **Security & Validation:** `zxcvbn` password strength scoring, PostgREST query sanitization

### Application Structure & Layers
1. **Pages** (`src/pages/`):
   - `OfficerDashboard.tsx`: High-level operational view for club leadership (metrics, top performers, monthly points, quick lookup).
   - `Dashboard.tsx`: Router/selector that dynamically renders `OfficerDashboard` or `MemberDashboard` based on the user's role.
   - `Members.tsx`: Member registry, All-Time and Monthly leaderboards, filter drawer, profile dossier, and timeline.
   - `Reports.tsx`: Advanced multi-criteria filtering, server-paginated tables, aggregation caching, and CSV/PDF export.
   - `UserManagement.tsx`: Super Admin control center featuring 5 tabs (User Accounts, Provision Members, System Data, Tier Settings, Audit Logs).
   - `SetPassword.tsx` & `ForgotPassword.tsx`: Secure password reset and recovery workflows.
2. **Components** (`src/components/`):
   - `MemberDashboard.tsx`: Dedicated member portal view (tier badge, progress to next tier, points by avenue, contribution timeline, club rank).
   - `TierBadge.tsx`, `TierProgressBar.tsx`, `TierOverviewCard.tsx`, `TierSettingsManagement.tsx`: Gamification and tier recognition engine.
   - `SystemLogs.tsx`: Audit logging viewer with actor resolution, severity badges, and JSON details modal.
   - `ChunkErrorBoundary.tsx` & `PageSkeleton.tsx`: Resilient code splitting and loading boundaries.
   - `Navbar.tsx` & `Layout.tsx`: Shell with responsive mobile drawer, role indicators, and dark mode toggle.
   - `ChangePasswordModal.tsx`: In-app password change modal with strength validation.
   - `AccountNotFound.tsx`: Diagnostic safety view for orphaned auth users.
3. **Services** (`src/services/`):
   - Encapsulates all PostgREST, RPC, and Edge Function calls, normalizing responses into clean TypeScript domain types.
4. **Contexts & Hooks** (`src/contexts/`, `src/hooks/`):
   - `AuthContext.tsx`: Tracks authenticated user, linked member record, permission flags, 15-minute inactivity auto-logout, and rate limiting.
   - `ThemeContext.tsx`: Manages dark/light theme persistence in `localStorage`.
   - `usePermissions.ts`: Role-Based Access Control helper functions (`canEdit`, `canManageUsers`, `isOfficer`, `isMember`, etc.).

### Code Splitting & Performance
- **Lazy Loading**: Major routes (`OfficerDashboard`, `Members`, `Reports`, `UserManagement`) are loaded on-demand via `React.lazy()` and wrapped in `Suspense` with `PageSkeleton`.
- **Dynamic Library Imports**: Bulky libraries (`xlsx`, `jspdf`, `jspdf-autotable`) are dynamically imported only when an export or import modal is opened, reducing the initial JavaScript bundle footprint.
- **Chunk Error Boundary**: `ChunkErrorBoundary` catches dynamic import failures (e.g., from network hiccups or new deployments) and provides a graceful retry button.

---

## 3. Backend Architecture (Supabase Layer)

### Database Layer (PostgreSQL 15)
The system leverages native PostgreSQL capabilities to enforce data integrity and deliver fast response times:
- **Automatic Point Recalculation Trigger**: `trg_recalculate_points` runs `AFTER INSERT, UPDATE, OR DELETE` on `contributions`, recalculating and updating `members.total_points` transactionally.
- **Optimized Stored Procedures (RPCs)**:
  - `get_my_session_context`: Combines auth check, `app_users` profile lookup, and linked `members` record into a single roundtrip with resilient fallback to direct queries.
  - `get_dashboard_stats`: Aggregates active members, total points, monthly projects, and avenue distributions directly in the database engine, avoiding large data transfers to the browser.
- **B-Tree Database Indexes**:
  - Foreign keys (`contributions.member_reg_no`, `contributions.added_by`, `app_users.linked_member_reg_no`).
  - Common filter columns (`contributions.time_period`, `contributions.date_added`, `members.faculty`, `members.batch`).
  - Audit logging composite indexes (`system_logs(created_at DESC)`).

### Serverless Layer: Deno Edge Functions
Sensitive operations that require the Supabase Service Role Key are strictly encapsulated in Deno Edge Functions under `supabase/functions/`:
1. `admin-create-user`: Provisions users with pre-set credentials or invite links and links them to member profiles.
2. `admin-delete-user`: Permanently removes users from both `auth.users` and `app_users` with safeguards against deleting the last remaining super admin.
3. `admin-set-user-status`: Activates or deactivates user accounts.
4. `admin-set-user-password`: Administrative password override with validation.
5. `admin-send-password-reset`: Triggers recovery emails.
6. `admin-change-user-email`: Updates authentication emails.
7. `admin-reset-mfa`: Resets multi-factor authentication factors.
8. `provision-members`: Bulk provisions club members into application user accounts.

---

## 4. Security & Access Control Architecture

### 5-Tier Role-Based Access Control (RBAC)
The platform defines 5 distinct user roles:
1. **`super_admin`**: Full system dominion. Manages users, resets passwords, configures taxonomies, modifies tier thresholds, and views all logs.
2. **`admin`**: System administrator. Can manage user accounts and system data, with safeguards against modifying super admins.
3. **`editor`**: Club director / officer. Can register and edit members, log individual and bulk contributions, import Excel files, and view audit logs.
4. **`viewer`**: Read-only access to member directories, reports, and leaderboards.
5. **`member`**: General club member. Routed to the dedicated Member Portal; can inspect personal KPI points, tier badge, avenue breakdown, and activity history.

### Fail-Closed Row Level Security (RLS)
- All tables enforce RLS with default-deny policies.
- Policies utilize helper functions: `is_super_admin()`, `is_admin_or_super()`, `is_officer()`, and `is_member()`.
- **Subquery Wrapping**: Helper calls and `auth.uid()` calls in RLS policies are wrapped in subqueries (e.g., `(SELECT auth.uid())`), instructing PostgreSQL to evaluate the user identity once per query instead of per row, eliminating performance penalties.

### Session Security & Client Hardening
- **Session Storage Isolation**: Supabase client uses `window.sessionStorage`. Closing the browser or tab immediately terminates the session, protecting shared university workstations.
- **Inactivity Timeout**: Global user activity listeners enforce a 15-minute auto-logout.
- **Brute Force Protection**: 5 consecutive failed login attempts trigger a 60-second lockout timer.
- **Password Strength**: Client enforces zxcvbn complexity rules (minimum length, mixed case, numbers, special characters).

---

## 5. Audit & Security Logging Architecture

The platform maintains two dedicated audit tables:
- **`system_logs`**: Tracks data operations (`CREATE_MEMBER`, `UPDATE_MEMBER`, `DELETE_MEMBER`, `CREATE_CONTRIBUTION`, `BULK_CREATE_CONTRIBUTIONS`, `EXPORT_REPORT`, etc.) with action types, target entity IDs, and JSON metadata.
- **`security_events`**: Tracks authentication events (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `PASSWORD_RESET`, `LOCKOUT`) with severity classifications (`INFO`, `WARN`, `CRITICAL`).
- **Actor Resolution**: Both tables capture and resolve actor names and emails, ensuring audit logs display recognizable identities even if the user profile undergoes updates.

---

## 6. Build, Deployment & CI/CD

- **Hosting**: Cloudflare Pages / Static CDN.
- **Continuous Integration**: GitHub Actions workflows run on pull requests and pushes:
  - TypeScript type-checking (`npm run typecheck`)
  - ESLint checks (`npm run lint`)
  - Vitest test suites (`npm run test`)
  - Security audit and Gitleaks secret scanner (`.github/workflows/security.yml`)

