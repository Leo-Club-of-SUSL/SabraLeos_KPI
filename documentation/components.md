# Component Documentation

The SabraLeos KPI System relies on modular, strictly typed React functional components styled with Tailwind CSS utility classes and Lucide React icons.

---

## 1. Pages Layer (`src/pages/`)

Pages represent top-level application views orchestrated by state-based routing in `App.tsx` and dynamically loaded on-demand via `React.lazy()`.

### 1.1 `Dashboard.tsx`
- Serves as the primary entry route after authentication.
- Dynamically inspects the user's role:
  - If role is `member`: renders `MemberDashboard.tsx`.
  - If role is `super_admin`, `admin`, `editor`, or `viewer`: renders `OfficerDashboard.tsx`.

### 1.2 `OfficerDashboard.tsx`
- Operational control center for club leadership.
- Displays high-level club metrics: Total Service Points, Projects This Month, Active Members.
- Podium Leaderboard: Top 3 contributors with gold, silver, and bronze gradient badges.
- Quick Member Lookup bar: Search by Reg No to jump directly into the member profile view.
- Recent contributions activity stream and quick "Add Contribution" action.

### 1.3 `Members.tsx`
- Complete member directory with dual-mode leaderboards:
  - **All-Time Leaderboard**: Ranks all members by all-time cumulative points.
  - **Monthly Leaderboard**: Ranks contributions earned within a chosen `YYYY-MM` month.
- Multi-factor filtering: Filter by Faculty and Academic Batch.
- Search bar: Case-insensitive search across Registration Number, Full Name, and Initials.
- Member Profile Dossier: Avatar with download action, personal details, contact link, tier badge, and chronological contribution timeline.

### 1.4 `Reports.tsx`
- Analytical reports engine.
- Multi-criteria filter options: Date Range (`date_added`), Minimum Project Count, Faculty filter.
- Server-side pagination with memoized aggregation maps.
- Trigger for `ExportOptionsModal.tsx` for generating customized CSV or branded vector PDF exports.

### 1.5 `UserManagement.tsx`
- Multi-tab administration center restricted to `super_admin` and `admin` roles:
  - **Tab 1 (Users)**: List, search, and edit system user accounts, change roles, trigger password resets via Edge Functions, toggle account status (`active`/`suspended`), and delete accounts.
  - **Tab 2 (Provision Members)**: Bulk-create system user accounts for registered members via `provision-members` Edge Function.
  - **Tab 3 (System Data)**: CRUD operations for university taxonomies (`SystemDataManagement.tsx`).
  - **Tab 4 (Tier Settings)**: Customize recognition tier point thresholds (`TierSettingsManagement.tsx`).
  - **Tab 5 (Audit Logs)**: Filter and inspect system and security audit trails (`SystemLogs.tsx`).

### 1.6 `SetPassword.tsx` & `ForgotPassword.tsx`
- `ForgotPassword.tsx`: Self-service password recovery request form with email input and rate limiting.
- `SetPassword.tsx`: Password setup screen accessed via recovery or invite link tokens; enforces strong password validation.

---

## 2. Gamification & Tier Recognition Components

Located in `src/components/` and powered by `src/lib/tier-calculator.ts`:

### 2.1 `TierBadge.tsx`
- Renders colored tier badges with icons:
  - **Bronze**: Default starting tier
  - **Silver**: Silver accent badge
  - **Gold**: Golden accent badge
  - **Platinum**: Platinum gradient badge
  - **Diamond**: Diamond blue gradient badge
- Accepts either `tierKey` directly or calculates the tier dynamically from total points.

### 2.2 `TierProgressBar.tsx`
- Visual progress bar illustrating points completed toward the next tier threshold and the remaining points needed.

### 2.3 `TierOverviewCard.tsx`
- Profile summary widget showcasing the member's current tier, badge, total points, and progress bar to the next tier rank.

### 2.4 `TierSettingsManagement.tsx`
- Administrative settings form allowing Super Admins to adjust minimum point thresholds for Bronze, Silver, Gold, Platinum, and Diamond tiers.

---

## 3. Dedicated Member Portal

### 3.1 `MemberDashboard.tsx`
- Tailored dashboard for standard club members (`role = 'member'`).
- Displays personal club rank, current tier badge, total points, and progress to next tier.
- Interactive breakdown of points earned across different service avenues (Health, Environment, Education, etc.).
- Personal contribution history timeline with details of all attended projects and awarded points.

---

## 4. Modals & Data Forms

### 4.1 `NewMemberForm.tsx` & `EditMemberForm.tsx`
- Registration and editing forms for club members.
- Validates student registration numbers, names, batch, faculty, and WhatsApp phone numbers.
- Integrated photo upload with client-side canvas compression (`image-utils.ts`) before uploading to Supabase Storage.

### 4.2 `AddContributionForm.tsx`
- Single contribution form to award points to a specific member with position, avenue, project name, and points validation (1–1000).

### 4.3 `BulkProjectContributionForm.tsx`
- Multi-member project points assignment modal.
- Sets project details (name, month, avenue) and allows adding multiple participants from a live search roster with individual position and point overrides.

### 4.4 `BulkImportModal.tsx`
- Comprehensive Excel member onboarding modal featuring an interactive data verification staging screen.
- Downloads `member_import_template.xlsx` containing live `Members` and `Valid_Selections` sheets populated with active faculties and batches from the database.
- Immediately parses uploaded spreadsheets and presents a widescreen editable staging table with real-time validation badges (**Ready to Add** vs. **Needs Attention**).
- Supports **live in-table editing**: edit registration numbers, full names, phone numbers, and select active **Faculties** and **Batches** directly via dropdown selects (`<select>`).
- Live re-validation resolves errors dynamically as values are corrected or selected.
- Features quick error discarding, filter tabs (*All*, *Ready*, *Issues*), live search, and chunked 100-record execution with progress tracking.

### 4.5 `ExportOptionsModal.tsx`
- Modal for customizing report exports.
- Select format (CSV or PDF) and customize columns to include (Reg No, Name, Faculty, Batch, Total Points, Project Count, WhatsApp).

### 4.6 `ChangePasswordModal.tsx`
- In-app password update dialog with interactive password strength meter (`zxcvbn`).

---

## 5. System Administration & Logging

### 5.1 `SystemLogs.tsx`
- Audit and security log viewer.
- Displays actor names, action types (`CREATE_MEMBER`, `LOGIN`, `BULK_IMPORT`, etc.), target entities, and timestamps.
- Features search filtering, severity badges, and a JSON modal for inspecting event payload metadata.

### 5.2 `SystemDataManagement.tsx`
- Management panels for Faculties, Academic Batches, and Service Avenues with add, edit, and delete actions.

---

## 6. Structural & Foundational Components

### 6.1 `Navbar.tsx` & `Layout.tsx`
- Top navigation bar featuring brand identity, page route buttons, role badge, dark mode toggle, and mobile responsive drawer.

### 6.2 `LoginScreen.tsx`
- Branded authentication interface with brute-force lockout protection (5 failed attempts locks for 60 seconds).

### 6.3 `AccountNotFound.tsx`
- Fallback diagnostic screen displayed when an authenticated user lacks an `app_users` profile row.

### 6.4 `ChunkErrorBoundary.tsx` & `PageSkeleton.tsx`
- `ChunkErrorBoundary.tsx`: Error boundary wrapping lazy-loaded pages to recover gracefully from network chunk load errors.
- `PageSkeleton.tsx`: Polished animated loading placeholder displayed during page transitions.

---

## 7. Global Contexts & Custom Hooks

### 7.1 `AuthContext.tsx`
- Manages authentication state, user session in `sessionStorage`, permissions, and 15-minute inactivity timeout.
- Uses `get_my_session_context` RPC for fast single-trip session hydration.

### 7.2 `ThemeContext.tsx`
- Manages light/dark mode preference persisted in `localStorage`.

### 7.3 `usePermissions.ts`
- Custom hook providing Role-Based Access Control flags:
  - `canEdit`: `true` for `super_admin`, `admin`, `editor`.
  - `canManageUsers`: `true` for `super_admin`, `admin`.
  - `isSuperAdmin`: `true` for `super_admin`.
  - `isOfficer`: `true` for `super_admin`, `admin`, `editor`.
  - `isViewer`: `true` for `viewer`.
  - `isMember`: `true` for `member`.

