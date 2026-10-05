# SabraLeos Nexus KPI — Mandatory Manual Steps & Dashboard Configuration

The following actions cannot be applied via automated SQL migrations or code scripts and **must be completed manually in the Supabase Dashboard and Cloudflare Console**.

---

## 1. Supabase Auth Configuration (Dashboard -> Authentication)

1. **Disable Public Sign-ups**:
   - Go to **Authentication -> Providers -> Email**.
   - Ensure **"Enable Signups" is turned OFF** (uncheck).
   - This guarantees fail-closed, invite-only account creation.

2. **Custom SMTP Server (SPF / DKIM)**:
   - Go to **Authentication -> Email Templates -> SMTP Settings**.
   - Configure your club's transactional SMTP provider (SendGrid, Mailgun, Amazon SES, or Postmark).
   - *Reason*: Supabase's default email service is rate-limited to ~3-4 emails per hour and lacks custom domain DKIM alignment.

3. **Secure Password Change**:
   - Go to **Authentication -> Advanced Settings**.
   - Enable **"Secure Password Change"** (requires re-authentication).

4. **Password Strength & Length Rules**:
   - Go to **Authentication -> Password Settings**.
   - Set **Minimum Password Length** to `10`.
   - Enable uppercase, lowercase, digit, and symbol character requirements.
   - Enable **HaveIBeenPwned Leaked Password Protection** (if on Supabase Pro plan).

5. **CAPTCHA & Bot Protection**:
   - Go to **Authentication -> Bot Protection**.
   - Enable **Cloudflare Turnstile** with Secret Key and Site Key.

6. **Link & OTP Expiration**:
   - Set Email OTP and Invite Link validity to **15 minutes** (900 seconds) or **1 hour max**.

7. **Redirect URLs**:
   - In **Authentication -> URL Configuration -> Redirect URLs**, add only:
     - `https://kpi.leoclubsusl.lk/#auth/set-password`
     - `https://staging-kpi.leoclubsusl.lk/#auth/set-password`
     - `http://localhost:5173/#auth/set-password` (development only)
   - Remove wildcard `*` entries.

8. **Clean Legacy Auth Users**:
   - Go to **Authentication -> Users**.
   - Inspect any user accounts created without an associated active member or official officer record and delete them.

---

## 2. Cloudflare Rate Limiting & WAF Rules (Cloudflare Dashboard)

1. **Auth & Login Rate Limiting**:
   - Create a WAF Rate Limiting Rule matching URI paths:
     - `/auth/*`
     - `*/functions/v1/*`
   - Set threshold: **10 requests per minute per IP**, Action: **Managed Challenge / Block**.

2. **DDoS & Managed Rules**:
   - Ensure Cloudflare Managed Ruleset and OWASP Core Ruleset are set to **Block / Challenge**.

---

## 3. Database Security Advisor & Realtime Cleanup

1. Go to **Database -> Security Advisor** in the Supabase Dashboard.
2. Confirm zero security findings (no public mutable search paths, all tables protected by RLS).
3. In **Database -> Publications**, ensure `supabase_realtime` only publishes tables with active client subscription needs (do NOT publish raw `system_logs` or sensitive PII).
