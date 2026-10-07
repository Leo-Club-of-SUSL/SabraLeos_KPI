import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xfansfglsejyeyriexnj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmYW5zZmdsc2VqeWV5cmlleG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTUxNDEsImV4cCI6MjA4OTEzMTE0MX0.ns-T-5T19evzu_-MFbCrqU1OvCo4r_ONtUCWkqHE6Y0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runAudit() {
  console.log('--- SUPABASE DB CONNECTION & RLS AUDIT ---');
  console.log(`Connecting to: ${SUPABASE_URL}`);

  const tables = [
    'members',
    'contributions',
    'app_users',
    'faculties',
    'batches',
    'avenues',
    'positions',
    'system_settings',
    'system_logs'
  ];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`[TABLE] ${table.padEnd(16)} -> Status: Error/Denied (${error.code || error.message}) [RLS Enforcing Default-Deny or Missing Table]`);
      } else {
        console.log(`[TABLE] ${table.padEnd(16)} -> Status: OK | Count accessible: ${count ?? 0}`);
      }
    } catch (err) {
      console.log(`[TABLE] ${table.padEnd(16)} -> Status: Exception: ${err.message}`);
    }
  }

  console.log('\nTesting Auth Endpoint...');
  const { data: authData, error: authError } = await supabase.auth.getSession();
  if (authError) {
    console.log(`Auth Endpoint: ERROR - ${authError.message}`);
  } else {
    console.log(`Auth Endpoint: REACHABLE - Current anon session: ${authData.session ? 'Active' : 'None (Anonymous)'}`);
  }
}

runAudit();
