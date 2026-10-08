# SabraLeos - Leo Club Points Tracker (Nexus KPI)

A production-ready Progressive Web App (PWA) for tracking member contributions and service points for the Leo Club of Sabaragamuwa University of Sri Lanka.

## 🚀 Quick Overview

SabraLeos is a centralized system designed to automate KPI and service point tracking for club members. It replaces manual spreadsheets with a modern, role-based platform calculating points in real-time.

### Core Capabilities
- **Member Registry & Profiles**: Profiles with photos, contact details, academic batch, faculty, and automatic point totals.
- **Dedicated Member Portal**: Personalized member dashboard with club rank, individual tier progression, avenue breakdown, and activity log.
- **Tier Recognition Engine**: Dynamic tier badges (Bronze, Silver, Gold, Platinum, Diamond) based on customizable point thresholds.
- **Project Points & Bulk Operations**: Add contributions individually or in **Bulk** by project name, or onboard members via Excel (`.xlsx`).
- **Real-time Leaderboard**: Instant rankings based on all-time or monthly performance with podium view.
- **Advanced Filtering & Multi-Format Exports**: Export customized CSV and branded vector PDF reports by faculty, batch, avenue, or date range.
- **System Taxonomies & Tier Settings**: Dynamically manage Faculties, Batches, Avenues, and Tier thresholds from the admin panel.
- **Comprehensive Audit & Security Logging**: Full audit trail recording entity mutations, logins, and security events with actor name resolution.
- **High-Performance Architecture**: Database RPCs (`get_my_session_context`, `get_dashboard_stats`), DB indexes, static caching, code splitting, and chunk error boundaries.

---

## 🛠️ Tech Stack
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons
- **Backend/DB**: Supabase (PostgreSQL 15), Row Level Security (RLS), Supabase Storage
- **Serverless API**: Supabase Edge Functions (Deno) for administrative user operations and provisioning
- **Security**: Fail-closed RLS, PKCE session storage isolation, zxcvbn password policy, Gitleaks CI scanning
- **Document Processing**: SheetJS (xlsx), jsPDF & AutoTable
- **Deployment**: Cloudflare Pages / Static CDN, GitHub Actions CI/CD

---

## 📖 Documentation Index

For detailed guides and technical information, please refer to the following documents:

| Topic | Document |
| :--- | :--- |
| **Documentation Hub** | [documentation/index.md](documentation/index.md) |
| **Comprehensive Architecture & Technical Specification** | [PROJECT_OVERVIEW.md](documentation/PROJECT_OVERVIEW.md) |
| **System Architecture Guide** | [architecture.md](documentation/architecture.md) |
| **Database Schema & Relational Models** | [database_schema.md](documentation/database_schema.md) |
| **API & Services Layer Reference** | [api_services.md](documentation/api_services.md) |
| **UI Components & Pages Reference** | [components.md](documentation/components.md) |
| **Getting Started (5-Minute Quick Start)** | [QUICK_START.md](documentation/QUICK_START.md) |
| **Database Setup & Migrations** | [DATABASE_SETUP.md](documentation/DATABASE_SETUP.md) |
| **Supabase Security Setup & Hardening** | [SUPABASE_SECURITY_SETUP.md](documentation/SUPABASE_SECURITY_SETUP.md) |
| **User Deletion & Account Lifecycle Guide** | [USER_DELETION_GUIDE.md](documentation/USER_DELETION_GUIDE.md) |
| **Project Summary & Milestones** | [PROJECT_SUMMARY.md](documentation/PROJECT_SUMMARY.md) |
| **Performance Implementation Report** | [docs/perf/IMPLEMENTATION_REPORT.md](docs/perf/IMPLEMENTATION_REPORT.md) |
| **Security Audit Report** | [docs/AUDIT_REPORT.md](docs/AUDIT_REPORT.md) |
| **Deployment Runbook** | [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) |

---

## 💻 Local Development

### 1. Prerequisites
- Node.js 18+
- Supabase Project

### 2. Setup
```bash
npm install
# Copy .env.example to .env and add your Supabase credentials
npm run dev
```

### 3. Commands
- `npm run dev`: Launch Vite local development server
- `npm run build`: Production bundle compilation
- `npm run typecheck`: TypeScript verification
- `npm run lint`: ESLint code quality inspection
- `npm run test`: Run Vitest unit & integration test suite

---

## 🔒 Security & Role-Based Access Control (RBAC)

The system uses **fail-closed Row Level Security (RLS)** to enforce 5 distinct access levels:
- **Super Admin**: Complete administrative dominion, user creation/deletion, password overrides, taxonomy and tier setting management.
- **Admin**: System management and user administration rights with safeguards against modifying super admins.
- **Editor (Director / Officer)**: Register and edit members, log project contributions, bulk import, and review system audit logs.
- **Viewer**: Read-only access to member directories, reports, and leaderboards.
- **Member**: Access to the dedicated Member Portal showing personal contributions, tier badge, and club rank.

---

## 📱 Progressive Web App

This application is fully PWA-ready. Open the application in any mobile browser and select **"Add to Home Screen"** for an app-like standalone experience.

---

## 📝 Acknowledgments & License
Created for the **Leo Club of Sabaragamuwa University of Sri Lanka**.  
Built with React, Supabase, TypeScript, and Tailwind CSS.

