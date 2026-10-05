# SabraLeos Nexus KPI — Data Retention & Member Privacy Policy

## 1. Scope & Principles
The SabraLeos Nexus KPI system processes member data for tracking volunteer participation, leadership development, point standings, and project contributions. Data processing adheres to the principles of data minimization and security in line with Sri Lanka Personal Data Protection Act (PDPA) No. 9 of 2022 (pending formal legal counsel verification).

---

## 2. Personal Data Stored
- **Active Member Records**: Full name, name with initials, university registration number, faculty, batch, WhatsApp contact, email, avatar photo, standing tier.
- **Contribution Records**: Project name, avenue, dates, point awards, reviewer approvals.
- **Authentication Records**: Encrypted auth user ID, hashed password (managed exclusively within Supabase Auth; never visible to admins), session audit logs.

---

## 3. Retention Periods
- **Active Undergraduates**: Maintained for the duration of university enrollment.
- **Graduated Alumni**: Personal contact info (WhatsApp, email, photo) may be archived or anonymized after **24 months** of inactivity. Contribution statistics and cumulative club KPI points are retained indefinitely in anonymized form to maintain club historical records.

---

## 4. Member Rights & Self-Service
- **Leaderboard Privacy**: Members can opt-out of public leaderboards or set an alias at any time via their profile settings.
- **Data Subject Export**: Super Admins can export all records associated with a member via the Members page export functionality.
- **Right to Erasure (Anonymization)**: On verified written request, a Super Admin can execute the member anonymization routine, clearing PII (`name`, `email`, `whatsapp`, `photo_url`) while preserving project point totals.
