// supabase/functions/provision-members/index.ts
// Direct member portal account provisioning with manual mock/temporary credentials — no email sending required

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1. Verify caller is super_admin or editor
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerAuth }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerAuth) {
      return errorResponse('Unauthorized', 401);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile, error: profileError } = await serviceClient
      .from('app_users')
      .select('role, status')
      .eq('id', callerAuth.id)
      .single();

    if (
      profileError ||
      !callerProfile ||
      !['super_admin', 'editor'].includes(callerProfile.role) ||
      callerProfile.status !== 'active'
    ) {
      return errorResponse('Forbidden: Active Super Admin or Editor access required', 403);
    }

    // 2. Validate input
    const body = await req.json();
    const { reg_nos, default_password, passwords } = body;

    if (!Array.isArray(reg_nos) || reg_nos.length === 0) {
      return errorResponse('reg_nos array is required', 400);
    }

    if (reg_nos.length > 100) {
      return errorResponse('Batch size cannot exceed 100 members', 400);
    }

    const results: Array<{
      reg_no: string;
      status: 'provisioned' | 'already_provisioned' | 'no_email' | 'failed';
      email?: string;
      temporaryPassword?: string;
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
        results.push({ reg_no, status: 'failed', message: 'Member not found in database' });
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

      // Determine mock password
      const cleanReg = member.reg_no.replace(/[^a-zA-Z0-9]/g, '');
      const memberPassword = (passwords && passwords[reg_no])
        ? String(passwords[reg_no]).trim()
        : (default_password && default_password.trim().length >= 6)
          ? default_password.trim()
          : `Leo@${cleanReg || 'Member'}2026!`;

      // Create auth user directly with confirmed email
      const { data: authData, error: createError } = await serviceClient.auth.admin.createUser({
        email: member.email.trim().toLowerCase(),
        password: memberPassword,
        email_confirm: true,
        user_metadata: {
          intended_role: 'member',
          linked_member_reg_no: member.reg_no,
          created_by: callerAuth.id,
        },
      });

      if (createError || !authData?.user) {
        results.push({
          reg_no,
          status: 'failed',
          message: createError?.message || 'Failed to create auth user',
        });
        continue;
      }

      const newUserId = authData.user.id;

      // Determine unique username
      let chosenUsername = (member.name_with_initials || member.full_name || `Member_${member.reg_no}`).trim();
      const { data: existingName } = await serviceClient
        .from('app_users')
        .select('id')
        .eq('username', chosenUsername)
        .maybeSingle();

      if (existingName) {
        chosenUsername = `${chosenUsername} (${member.reg_no})`;
      }

      // Insert app_users profile (try 'member', fallback to 'viewer' if DB constraint has ('super_admin','editor','viewer'))
      let roleToUse: string = 'member';
      let insertResult = await serviceClient.from('app_users').insert({
        id: newUserId,
        username: chosenUsername,
        designation: 'Member',
        role: roleToUse,
        linked_member_reg_no: member.reg_no,
        status: 'active',
      });

      if (insertResult.error && insertResult.error.message.includes('app_users_role_check')) {
        roleToUse = 'viewer';
        insertResult = await serviceClient.from('app_users').insert({
          id: newUserId,
          username: chosenUsername,
          designation: 'Member',
          role: roleToUse,
          linked_member_reg_no: member.reg_no,
          status: 'active',
        });
      }

      if (insertResult.error) {
        console.error('Failed to create app_users record for', reg_no, insertResult.error);
        // Compensating rollback: delete created auth user
        await serviceClient.auth.admin.deleteUser(newUserId);
        results.push({ 
          reg_no, 
          status: 'failed', 
          message: `Profile initialization failed: ${insertResult.error.message}` 
        });
        continue;
      }

      results.push({
        reg_no,
        status: 'provisioned',
        email: member.email.trim().toLowerCase(),
        temporaryPassword: memberPassword,
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('Provisioning error:', err);
    return errorResponse('Internal server error', 500);
  }
});

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
