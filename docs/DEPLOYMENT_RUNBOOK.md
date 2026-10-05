# SabraLeos Nexus KPI — Deployment Runbook

## Deployment Prerequisites
- Supabase CLI installed and authenticated (`supabase login`)
- Project linked to Staging / Production (`supabase link --project-ref <PROJECT_REF>`)
- Required secrets configured in Supabase:
  - `APP_URL`: Production/Staging URL (e.g. `https://kpi.leoclubsusl.lk`)
  - `SUPABASE_SERVICE_ROLE_KEY`: Configured automatically in Edge runtime

---

## Deployment Order (Strict Sequence)

### 1. Database Backup
Before running migrations, export a database snapshot:
```bash
supabase db dump --data-only > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Apply Versioned Migrations
Apply migrations using the Supabase CLI (never execute ad-hoc SQL in production):
```bash
# Push migrations to staging, verify, then production
supabase db push
```

### 3. Deploy Edge Functions
Deploy all backend Edge Functions with JWT verification enforced:
```bash
# Verify config.toml has verify_jwt = true
supabase functions deploy provision-members
supabase functions deploy admin-create-user
supabase functions deploy admin-send-password-reset
supabase functions deploy admin-change-user-email
supabase functions deploy admin-reset-mfa
supabase functions deploy admin-set-user-status
supabase functions deploy admin-delete-user
```

### 4. Deploy Frontend Bundle
Build and deploy the frontend application:
```bash
npm run typecheck
npm run lint
npm test
npm run build
# Deploy dist/ to hosting provider (e.g. Cloudflare Pages / Vercel)
```

### 5. Automated Security Smoke Verification
Execute the automated smoke verification script against the deployment:
```bash
node scripts/security-smoke.js
```

---

## Rollback Procedures

### Database Rollback
If a migration fails or causes unexpected behavior:
1. Identify the previous stable migration timestamp.
2. Apply the compensating down migration script or restore from the pre-deployment database dump:
```bash
supabase db push --dry-run
```

### Edge Functions Rollback
Rollback to previous function version in Supabase Dashboard -> Edge Functions -> Deployments -> Rollback.

### Frontend Rollback
Revert the deployment commit in the Git repository or promote the previous successful release in Cloudflare Pages / Vercel.
