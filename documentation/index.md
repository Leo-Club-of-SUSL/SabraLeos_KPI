# SabraLeos KPI System - Documentation Hub

Welcome to the SabraLeos KPI System (Nexus KPI) documentation repository. Here you will find all structural, architectural, operational, and security manuals required to understand, develop, and maintain the project.

## 1. System Architecture & Codebase Design

The core engineering breakdown detailing the application's underlying paradigms, database configuration, frontend flow, and API implementation.

- **[System Architecture](architecture.md)**  
  High-level overview of the PWA React frontend + Supabase backend decoupled architecture, including Deno Edge Functions, 5-role RBAC model, dual dashboard routing (Officer vs Member), and performance optimizations.

- **[Database Schema & Security](database_schema.md)**  
  Complete mapping of PostgreSQL tables (`members`, `contributions`, `app_users`, `faculties`, `batches`, `avenues`, `tier_settings`, `system_logs`, `security_events`), B-tree indexes, RLS subquery optimizations, and stored procedures/RPCs.

- **[API & Services Map](api_services.md)**  
  Reference of client services (`member`, `contribution`, `user`, `system`, `log`, `bulk-import`), Supabase RPCs (`get_my_session_context`, `get_dashboard_stats`), and Deno Edge Functions (`admin-create-user`, `admin-delete-user`, `admin-set-user-password`, `provision-members`, etc.).

- **[Component Reference](components.md)**  
  Exhaustive guide to functional React components: dual Dashboards (`OfficerDashboard`, `MemberDashboard`), Tier badges & progress calculators, auth modals, code-split lazy routes, and administrative controls.

## 2. Setup Guides & Operations

Project operations documents that illustrate installation, configuration, user lifecycles, and security controls.

- **[Developer Setup & Quick Start](QUICK_START.md)**  
  Step-by-step local development setup, environment variables, test data seeding, and 5-minute initial launch guide.

- **[Database Setup & Migration](DATABASE_SETUP.md)**  
  Comprehensive SQL execution plan detailing full table schemas, constraints, RLS policies, performance indexes, and administrative helper functions.

- **[Supabase Security Setup & Hardening](SUPABASE_SECURITY_SETUP.md)**  
  Detailed instructions for configuring fail-closed Row Level Security (RLS) policies, storage bucket protections, and session isolation.

- **[User Deletion & Account Lifecycle Guide](USER_DELETION_GUIDE.md)**  
  Operational guide for automated user deletion via Edge Functions (`admin-delete-user`), safeguard rules (preventing deletion of the last super admin), and manual fallbacks.

- **[Role Configuration & Emails](DISABLE_EMAIL_CONFIRMATION.md)**  
  Configuration steps for email verification settings, invite flows, and Supabase Auth overrides.

## 3. High-Level Technical Specifications & Performance

- **[Comprehensive Technical Specification & Architecture](PROJECT_OVERVIEW.md)**  
  The exhaustive, all-in-one specification detailing the full codebase architecture, ERD, feature catalog, and design decisions (primary reference for AI agents and engineering teams).

- **[Project Summary Overview](PROJECT_SUMMARY.md)**  
  Executive summary encompassing project milestones, completed modules, and roadmap status.

- **[Performance Implementation Report](../docs/perf/IMPLEMENTATION_REPORT.md)**  
  Technical retrospective on startup request consolidation, RPC aggregations, B-tree indexing, and code splitting.

- **[Performance Diagnostic Report](../docs/perf/PERFORMANCE_DIAGNOSTIC_REPORT.md)**  
  In-depth query profiling, latency benchmarks, and architectural bottleneck root-cause analysis.

- **[Security Audit Report](../docs/AUDIT_REPORT.md)**  
  Vulnerability assessment, fail-closed RLS validation, input sanitization rules, and CI security scanner configurations.

- **[Deployment Runbook](../docs/DEPLOYMENT_RUNBOOK.md)**  
  Production deployment guide for Cloudflare Pages, Supabase migrations, and GitHub Actions automation.

