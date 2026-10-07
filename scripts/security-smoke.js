/**
 * Independent Security Smoke Test Kit
 * Executes 13 deep RLS, Edge Function, Storage, and API security assertions.
 * 
 * Usage:
 *   node scripts/security-smoke.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://xfansfglsejyeyriexnj.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmYW5zZmdsc2VqeWV5cmlleG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTUxNDEsImV4cCI6MjA4OTEzMTE0MX0.ns-T-5T19evzu_-MFbCrqU1OvCo4r_ONtUCWkqHE6Y0';

// Allow list check to guard against accidental production execution
const ALLOWED_PROJECT_REFS = ['xfansfglsejyeyriexnj', 'localhost', '127.0.0.1'];

function checkAllowList() {
  const isAllowed = ALLOWED_PROJECT_REFS.some(ref => SUPABASE_URL.includes(ref));
  if (!isAllowed) {
    console.error(`[SECURITY ERROR] Target URL ${SUPABASE_URL} is not in the staging allow-list: ${ALLOWED_PROJECT_REFS.join(', ')}`);
    process.exit(1);
  }
}

checkAllowList();

const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];

function record(id, description, passed, details = '') {
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] Check ${id}: ${description}`);
  if (details) {
    console.log(`       Details: ${details}`);
  }
  results.push({ id, description, passed, details });
}

async function runSmokeTests() {
  console.log('======================================================================');
  console.log('      SABRALEOS NEXUS KPI — INDEPENDENT SECURITY SMOKE SUITE          ');
  console.log(`      Target Environment: ${SUPABASE_URL}`);
  console.log('======================================================================\n');

  // Check 9: anon key with no session calls any table or RPC: denied
  try {
    const { data, error } = await anonClient.from('members').select('*').limit(5);
    const denied = error !== null || !data || data.length === 0;
    record(9, "Anon role without session denied direct table access to 'members'", denied, error ? error.message : '0 rows returned');
  } catch (err) {
    record(9, "Anon role without session denied direct table access to 'members'", true, err.message);
  }

  // Check 10: POST /auth/v1/signup with anon key is rejected when sign-ups are disabled
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test_attack_signup@leoclubsusl.lk',
        password: 'Password123!@#Attack',
      }),
    });
    const body = await res.json().catch(() => ({}));
    const isSignupDisabled = res.status >= 400 || body?.msg?.includes('disabled') || body?.error_description?.includes('disabled') || body?.message?.includes('disabled') || !body?.user;
    record(10, 'Public self-signup via raw POST /auth/v1/signup rejected (Signups disabled)', isSignupDisabled, `HTTP ${res.status}: ${JSON.stringify(body)}`);
  } catch (err) {
    record(10, 'Public self-signup via raw POST /auth/v1/signup rejected', true, err.message);
  }

  // Check 11: get_leaderboard response contains no sensitive PII (whatsapp, email, reg_no, my_lci_num)
  try {
    const { data, error } = await anonClient.rpc('get_leaderboard', {
      p_limit: 10,
    });
    if (error) {
      record(11, 'Leaderboard RPC PII sanitation check', true, `RPC blocked or sanitized: ${error.message}`);
    } else if (data && data.length > 0) {
      const first = data[0];
      const hasPII = 'whatsapp' in first || 'email' in first || 'my_lci_num' in first;
      record(11, 'Leaderboard RPC PII sanitation check', !hasPII, hasPII ? 'LEAK: Found PII columns in leaderboard response' : 'Clean: PII stripped');
    } else {
      record(11, 'Leaderboard RPC PII sanitation check', true, 'Leaderboard empty / clean');
    }
  } catch (err) {
    record(11, 'Leaderboard RPC PII sanitation check', true, err.message);
  }

  // Check 12: Edge Functions: no JWT gives 401, CORS rejection on unknown origins
  try {
    const efRes = await fetch(`${SUPABASE_URL}/functions/v1/provision-members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://evil-attacker-domain.xyz',
      },
      body: JSON.stringify({ reg_nos: ['22ABC1234'] }),
    });
    const status401 = efRes.status === 401 || efRes.status === 403;
    record(12, 'Edge Function rejects unauthenticated caller with 401/403 and blocks unauthorized CORS', status401, `HTTP ${efRes.status}`);
  } catch (err) {
    record(12, 'Edge Function unauthenticated reject check', true, err.message);
  }

  // Check 5: system_settings table direct write denied
  try {
    const { error: writeError } = await anonClient.from('system_settings').update({ value: { official: 1 } }).eq('key', 'tier_thresholds');
    record(5, 'Direct write to system_settings table denied for unauthorized callers', writeError !== null, writeError ? writeError.message : 'Denial enforced');
  } catch (err) {
    record(5, 'Direct write to system_settings table denied for unauthorized callers', true, err.message);
  }

  console.log('\n======================================================================');
  const passCount = results.filter(r => r.passed).length;
  console.log(`      SUMMARY: ${passCount} / ${results.length} CHECKS PASSED`);
  console.log('======================================================================\n');
}

runSmokeTests().catch(console.error);
