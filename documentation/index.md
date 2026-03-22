# SabraLeos KPI System - Documentation Hub

Welcome to the SabraLeos KPI System documentation repository. Here you will find all structural, architectural, and operational manuals required to understand, develop, and maintain the project.

## 1. System Architecture & Codebase Design

The core engineering breakdown detailing the application's underlying paradigms, database configuration, frontend flow, and API implementation.

- **[System Architecture](architecture.md)**
  High-level overview of the PWA React frontend + Supabase backend decoupled architecture, including build, continuous integration, security, and deployment paths.

- **[Database Schema & Security](database_schema.md)**
  Complete mapping of the PostgreSQL `members`, `contributions`, and `app_users` tables. Detailed definitions covering Row Level Security (RLS) policies and trigger calculations.

- **[API & Services Map](api_services.md)**
  A reference of the functions interacting with the database layer. Detailed coverage over Supabase connections regarding member registry operations and application user roles.

- **[Component Reference](components.md)**
  An exhaustive guide to the functional React components orchestrating the application. Outlines structural UI logic, dynamic contexts, and local component states.

## 2. Setup Guides & Operations

Project operations documents that illustrate installation, feature disabling, and quick-start methods.

- **[Developer Setup & Quick Start](QUICK_START.md)**
  If you are running the project locally for the first time, this is your complete 5-minute development server initiation guide.

- **[Database Setup & Migration](DATABASE_SETUP.md)**
  Step-by-step documentation detailing manual table configuration and the initial SQL execution map natively within the Supabase administration panel.

- **[Role Configuration & Emails](DISABLE_EMAIL_CONFIRMATION.md)**
  Technical details regarding the configuration of email verification flow and internal authorization overrides.

- **[Account & User Management](USER_DELETION_GUIDE.md)**
  Specific instructions encompassing deletion, un-linking, or archiving of application user accounts securely without breaking dependent system data.

## 3. High-Level Project Summary

- **[Project Summary Overview](PROJECT_SUMMARY.md)**
  The absolute top-down executive summary encompassing all critical features of the current project status.
