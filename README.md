# SabraLeos - Leo Club Points Tracker

A production-ready Progressive Web App (PWA) for tracking member contributions and service points for the Leo Club of Sabaragamuwa University.

## 🚀 Quick Overview

SabraLeos is a centralized system designed to automate the KPI tracking for club members. It replaces tiresome manual spreadsheets with a modern, role-based platform that calculates points in real-time.

### Core Capabilities
- **Member Registry**: Profiles with photos, contact info, and automatic point totals.
- **Project Points**: Add contributions individually or in **Bulk** by project name.
- **Real-time Leaderboard**: Instant rankings based on all-time or monthly performance.
- **Advanced Filtering**: Export customized CSV reports by faculty, batch, or date range.
- **System Setup**: Dynamically manage Faculties, Batches, and Service Avenues.

---

## 🛠️ Tech Stack
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Backend/DB**: Supabase (Postgres), Row Level Security (RLS)
- **Deployment**: Cloudflare Pages (Frontend), GitHub Actions (Automation)

---

## 📖 Documentation Index

For detailed guides and technical information, please refer to the following documents:

| Topic | Document |
| :--- | :--- |
| **Getting Started** | [QUICK_START.md](documentation/QUICK_START.md) |
| **User Roles & Access** | [PROJECT_SUMMARY.md#user-roles](documentation/PROJECT_SUMMARY.md) |
| **Database Migration** | [DATABASE_SETUP.md](documentation/DATABASE_SETUP.md) |
| **System Architecture** | [architecture.md](documentation/architecture.md) |
| **Database Schema** | [database_schema.md](documentation/database_schema.md) |
| **API & Services** | [api_services.md](documentation/api_services.md) |
| **User Deletion Guide** | [USER_DELETION_GUIDE.md](documentation/USER_DELETION_GUIDE.md) |

---

## 💻 Local Development

### 1. Prerequisites
- Node.js 18+
- Supabase Project

### 2. Setup
```bash
npm install
# Copy .env.example to .env and add your Supabase keys
npm run dev
```

### 3. Commands
- `npm run build`: Production build
- `npm run typecheck`: TypeScript verification
- `npm run lint`: Code quality check

---

## 🔒 Security & Roles
The system uses **Row Level Security (RLS)** to enforce three access levels:
- **Super Admin**: Full system control and user management.
- **Editor (Director)**: Manage members and log project points.
- **Viewer**: Read-only access to leaderboard and reports.

---

## 📱 Progressive Web App
This application can be installed on mobile devices. Open the site in your mobile browser and select **"Add to Home Screen"** for a native-like standalone experience.

---

## 📝 Acknowledgments & License
Created for the **Leo Club of Sabaragamuwa University**.  
Built with React, Supabase, and Tailwind CSS.
