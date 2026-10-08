# SabraLeos (Nexus KPI) — Project Summary

## Overview

**SabraLeos KPI System** (Nexus KPI) is an enterprise-grade Progressive Web App built for the **Leo Club of Sabaragamuwa University of Sri Lanka** (District 306). It automates member registry, service contribution tracking, and KPI point calculations in real time, replacing legacy spreadsheets with a secure, role-based, gamified platform.

---

## What Has Been Built

### Complete Application Stack

1. **Frontend Application**
   - React 18 with TypeScript (Strict mode)
   - Vite 7 build tooling and bundler
   - Tailwind CSS for styling with custom university maroon (`#800000`) and gold (`#FFD700`) brand palette
   - Lucide React for consistent UI iconography
   - Fully responsive, mobile-first design with PWA installation support
   - Dark/Light theme support with `localStorage` persistence
   - Route-level code splitting (`React.lazy`) with `ChunkErrorBoundary` and `PageSkeleton`

2. **Backend & Serverless Layer**
   - Supabase PostgreSQL 15 database
   - Fail-closed Row Level Security (RLS) policies with subquery wrapping
   - High-performance RPCs: `get_my_session_context` and `get_dashboard_stats`
   - Automatic PostgreSQL triggers for transaction-level point calculation
   - Supabase Storage bucket (`members`) for compressed profile photos
   - 8 Deno Edge Functions for administrative user actions, credentials overrides, and member provisioning

3. **5-Tier Role-Based Access Control (RBAC)**
   - **Super Admin**: Full system dominion, user management, password overrides, taxonomy & tier configuration.
   - **Admin**: Administrative user and system data management with safeguards against modifying super admins.
   - **Editor (Director / Officer)**: Member registration and editing, single/bulk point logging, audit log inspection.
   - **Viewer**: Read-only access to member directories, reports, and leaderboards.
   - **Member**: Dedicated Member Portal showing personal contributions, avenue breakdown, tier badges, and club rank.

4. **Gamification & Tier Recognition Engine**
   - 5-tier recognition system: Bronze, Silver, Gold, Platinum, and Diamond.
   - Dynamic tier calculation via `src/lib/tier-calculator.ts` with customizable thresholds stored in `tier_settings`.
   - Visual `TierBadge`, `TierProgressBar`, and `TierOverviewCard` components integrated across the application.

5. **Audit & Security Logging System**
   - `system_logs` and `security_events` tables recording entity mutations, logins, and logouts.
   - Actor name & email resolution displaying human-readable identities.
   - Deduplicated session logging and historical record backfills.
   - Officer-level log inspection with severity badges and JSON metadata viewer.

6. **High-Performance Data Architecture**
   - Consolidated startup request waterfalls via `get_my_session_context` RPC.
   - Server-side KPI aggregation via `get_dashboard_stats` RPC.
   - In-memory static data caching for taxonomies (faculties, batches, avenues).
   - Strategic B-tree database indexing on foreign keys and filter columns.
   - Batched bulk imports in chunks of 100 with row-by-row fallback.

---

## File Structure

### Source Code

**Pages (`src/pages/`)**
- `Dashboard.tsx` — Role-based router switching between Officer and Member views
- `OfficerDashboard.tsx` — Leadership dashboard with KPI cards, podium, and activity feed
- `Members.tsx` — Member registry, All-Time & Monthly leaderboards, and detailed dossiers
- `Reports.tsx` — Multi-criteria analytics table, server-side pagination, CSV/PDF export
- `UserManagement.tsx` — 5-tab admin control center (Users, Provisioning, System Data, Tiers, Audit Logs)
- `SetPassword.tsx` — Set password screen for invitations and password recovery
- `ForgotPassword.tsx` — Self-service password reset request form

**Components (`src/components/`)**
- `MemberDashboard.tsx` — Dedicated member portal dashboard
- `TierBadge.tsx` — Colored tier indicator badge
- `TierProgressBar.tsx` — Progress toward the next recognition tier
- `TierOverviewCard.tsx` — Profile tier summary card
- `TierSettingsManagement.tsx` — Admin panel for tier threshold configuration
- `SystemLogs.tsx` — System audit and security event log viewer
- `SystemDataManagement.tsx` — Dynamic management of Faculties, Batches, and Avenues
- `AddContributionForm.tsx` — Single-member point entry form
- `BulkProjectContributionForm.tsx` — Multi-member project points assignment modal
- `BulkImportModal.tsx` — Excel member onboarding modal
- `NewMemberForm.tsx` — Member registration form with canvas photo compressor
- `EditMemberForm.tsx` — Member profile editing form
- `ExportOptionsModal.tsx` — Report export customizer (CSV/PDF)
- `ChangePasswordModal.tsx` — In-app password change dialog with strength indicator
- `AccountNotFound.tsx` — Diagnostic fallback for orphaned auth accounts
- `ChunkErrorBoundary.tsx` — Error boundary for network chunk load failures
- `PageSkeleton.tsx` — Animated loading skeleton
- `Navbar.tsx` & `Layout.tsx` — Application shell with mobile drawer and theme toggle
- `LoginScreen.tsx` — Branded login screen with brute-force lockout timer

**Contexts & Hooks (`src/contexts/`, `src/hooks/`)**
- `AuthContext.tsx` — User session, RPC hydration, 15m idle auto-logout
- `ThemeContext.tsx` — Dark/light theme management
- `usePermissions.ts` — RBAC permission checks

**Services (`src/services/`)**
- `member-service.ts` — Member CRUD and profile operations
- `contribution-service.ts` — Contribution points and leaderboard aggregations
- `user-service.ts` — User management and Edge Functions integration
- `system-service.ts` — Taxonomy CRUD, tier settings, in-memory cache
- `log-service.ts` — System and security audit log recording & retrieval
- `bulk-import-service.ts` — Excel parsing and 100-row batching

**Libraries & Utilities (`src/lib/`)**
- `supabase.ts` — Supabase client instantiated with `sessionStorage`
- `tier-calculator.ts` — Recognition tier calculation logic
- `image-utils.ts` — Off-screen HTML5 canvas image compressor & downloader
- `sanitize.ts` — PostgREST query escape, HTML tag stripping, regex checks
- `password-validator.ts` — Password complexity rules with `zxcvbn`
- `db-init.ts` — Database connectivity verification and seeding

**Deno Edge Functions (`supabase/functions/`)**
- `admin-create-user` — Provisions new users
- `admin-delete-user` — Deletes user from auth and public tables
- `admin-set-user-status` — Toggles active/suspended account state
- `admin-set-user-password` — Administrative password override
- `admin-send-password-reset` — Dispatches password reset emails
- `admin-change-user-email` — Updates user email in auth
- `admin-reset-mfa` — Resets multi-factor authentication
- `provision-members` — Bulk provisions members as users

---

## Production Readiness & Metrics

### ✅ Verification Status
- **Type Checking**: PASSED (`tsc --noEmit`, 0 errors)
- **Unit & Integration Tests**: 7 test suites, 59 tests PASSED
- **Security Audit**: Fail-closed RLS, CI vulnerability scan passing
- **Code Splitting**: Dynamic chunks for routes and export libraries (`xlsx`, `jspdf`)

---

## Support & Documentation Hub

For exhaustive technical specifics, refer to:
1. [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) — Comprehensive Architecture & Technical Specification
2. [architecture.md](architecture.md) — High-Level Architecture
3. [database_schema.md](database_schema.md) — Database Models & RLS
4. [api_services.md](api_services.md) — Service Layer & Edge Functions
5. [components.md](components.md) — Component Catalog
6. [DATABASE_SETUP.md](DATABASE_SETUP.md) — Database Setup & Migrations
7. [QUICK_START.md](QUICK_START.md) — Quick Start Guide
8. [USER_DELETION_GUIDE.md](USER_DELETION_GUIDE.md) — User Lifecycle & Deletion Guide

