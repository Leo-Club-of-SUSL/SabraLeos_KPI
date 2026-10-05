import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xfansfglsejyeyriexnj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmYW5zZmdsc2VqeWV5cmlleG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTUxNDEsImV4cCI6MjA4OTEzMTE0MX0.ns-T-5T19evzu_-MFbCrqU1OvCo4r_ONtUCWkqHE6Y0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectMembersSchema() {
  console.log('Inspecting members columns...');
  const columns = ['reg_no', 'full_name', 'name_with_initials', 'faculty', 'batch', 'whatsapp', 'email', 'member_status', 'leaderboard_opt_out', 'display_alias', 'photo_url', 'total_points', 'created_at', 'updated_at', 'deleted_at'];

  for (const col of columns) {
    const { data, error } = await supabase.from('members').select(col).limit(1);
    if (error) {
      console.log(`Column '${col}': ERROR -> ${error.message} (${error.code})`);
    } else {
      console.log(`Column '${col}': EXISTS`);
    }
  }
}

inspectMembersSchema();
