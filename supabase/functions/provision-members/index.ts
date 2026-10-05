// supabase/functions/provision-members/index.ts
// Invite-only member provisioning (super_admin only)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://nexus-kpi.pages.dev',
  'https://kpi.sapraleos.org',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.pages.dev');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401, corsHeaders);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1. Verify caller is super_admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerAuth }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerAuth) {
      return errorResponse('Unauthorized', 401, corsHeaders);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile, error: profileError } = await serviceClient
      .from('app_users')
      .select('role, status')
      .eq('id', callerAuth.id)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== 'super_admin' || callerProfile.status !== 'active') {
      return errorResponse('Forbidden: Only active super_admin can provision members', 403, corsHeaders);
    }

    // 2. Validate input
    const body = await req.json();
    const { reg_nos } = body;

    if (!Array.isArray(reg_nos) || reg_nos.length === 0) {
      return errorResponse('reg_nos array is required', 400, corsHeaders);
    }

    if (reg_nos.length > 100) {
      return errorResponse('Batch size cannot exceed 100 members', 400, corsHeaders);
    }

    const origin = req.headers.get('Origin') || 'https://nexus-kpi.pages.dev';
    const results: Array<{
      reg_no: string;
      status: 'invited' | 'already_provisioned' | 'no_email' | 'failed';
      message?: string;
    }> = [];

    for (const rawReg of reg_nos) {
      const reg_no = String(rawReg).trim().toUpperCase();

      // Fetch member
      const { data: member, error: memberError } = await serviceClient
        .from('members')
        .select('reg_no, full_name, name_with_initials, email, deleted_at')
        .ilike('reg_no', reg_no)
        .is('deleted_at', null)
        .maybeSingle();

      if (memberError || !member) {
        results.push({ reg_no, status: 'failed', message: 'Member not found' });
        continue;
      }

      if (!member.email || !member.email.includes('@')) {
        results.push({ reg_no, status: 'no_email', message: 'Member has no valid email on file' });
        continue;
      }

      // Check if already provisioned
      const { data: existingUser } = await serviceClient
        .from('app_users')
        .select('id, status')
        .eq('linked_member_reg_no', member.reg_no)
        .maybeSingle();

      if (existingUser) {
        results.push({ reg_no, status: 'already_provisioned', message: 'Account already exists' });
        continue;
      }

      // Invite user via email
      const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
        member.email,
        {
          redirectTo: `${origin}/auth/set-password`,
          data: {
            intended_role: 'member',
            linked_member_reg_no: member.reg_no,
          },
        }
      );

      if (inviteError || !inviteData?.user) {
        results.push({
          reg_no,
          status: 'failed',
          message: inviteError?.message || 'Failed to send invite',
        });
        continue;
      }

      const newUserId = inviteData.user.id;

      // Insert app_users profile
      const { error: insertError } = await serviceClient.from('app_users').insert({
        id: newUserId,
        username: member.name_with_initials || member.full_name,
        designation: 'Member',
        role: 'member',
        linked_member_reg_no: member.reg_no,
        status: 'active',
      });

      if (insertError) {
        // Compensating rollback: delete created auth user
        await serviceClient.auth.admin.deleteUser(newUserId);
        results.push({ reg_no, status: 'failed', message: 'Profile initialization failed (rolled back)' });
        continue;
      }

      results.push({ reg_no, status: 'invited' });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('Provisioning error:', err);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
});

function errorResponse(message: string, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...headers, 'Content-Type': 'application/json' },
    status,
  });
}
