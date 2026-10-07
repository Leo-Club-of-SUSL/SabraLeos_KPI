import { supabase } from '../lib/supabase';
import type { AppUser, AppUserRole } from '../types/database';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/**
 * Calls an Edge Function with the current user's JWT.
 * Throws "Account service unavailable. Nothing was created." if unreachable (fail closed).
 */
async function callEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) {
    throw new Error('Not authenticated');
  }

  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`Edge Function ${functionName} fetch error:`, err);
    throw new Error('Account service unavailable. Nothing was created.');
  }

  if (!res.ok) {
    let errorMsg = `Account service unavailable (status ${res.status}). Nothing was created.`;
    try {
      const json = await res.json();
      if (json?.error) errorMsg = json.error;
    } catch {
      // Non-JSON response
    }
    throw new Error(errorMsg);
  }

  return res.json() as Promise<T>;
}

export interface SessionContext {
  valid: boolean;
  reason?: string;
  id?: string;
  username?: string;
  designation?: string;
  role?: AppUserRole;
  status?: 'active' | 'suspended';
  linked_member_reg_no?: string | null;
  aal?: string;
  require_mfa?: boolean;
}

export interface ProvisionResult {
  reg_no: string;
  status: 'provisioned' | 'invited' | 'already_provisioned' | 'no_email' | 'failed';
  email?: string;
  temporaryPassword?: string;
  message?: string;
}

export const userService = {
  async getCurrentUser(): Promise<AppUser | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data as AppUser | null;
  },

  async getSessionContext(): Promise<SessionContext | null> {
    const { data, error } = await supabase.rpc('get_my_session_context');
    if (error || !data) return null;
    return (data as unknown) as SessionContext;
  },

  async getAll(): Promise<AppUser[]> {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as AppUser[]) || [];
  },

  async getByLinkedMember(regNo: string): Promise<AppUser | null> {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('linked_member_reg_no', regNo)
      .maybeSingle();

    if (error) throw error;
    return data as AppUser | null;
  },

  /**
   * Direct batch member provisioning with temporary password (admin/editor).
   */
  async provisionMembers(
    regNos: string[],
    defaultPassword?: string,
    passwords?: Record<string, string>
  ): Promise<ProvisionResult[]> {
    const data = await callEdgeFunction<{ success: boolean; results: ProvisionResult[] }>(
      'provision-members',
      { reg_nos: regNos, default_password: defaultPassword, passwords }
    );
    return data.results || [];
  },

  /**
   * Create an officer user account directly with temporary password (admin/editor).
   */
  async createOfficer(
    email: string,
    userData: {
      username: string;
      designation: string;
      role: 'super_admin' | 'editor' | 'viewer';
      linked_member_reg_no?: string | null;
    },
    password?: string,
  ): Promise<{ user: AppUser; temporaryPassword?: string }> {
    const data = await callEdgeFunction<{
      success: boolean;
      user: AppUser;
      temporaryPassword?: string;
    }>('admin-create-user', {
      email,
      username: userData.username,
      designation: userData.designation,
      role: userData.role,
      linked_member_reg_no: userData.linked_member_reg_no ?? null,
      password: password || undefined,
    });
    return { user: data.user, temporaryPassword: data.temporaryPassword };
  },

  /**
   * Create adapter with optional manual/temporary password.
   */
  async create(
    email: string,
    userData: {
      username: string;
      designation: string;
      role: AppUserRole;
      linked_member_reg_no?: string | null;
    },
    password?: string,
  ): Promise<AppUser> {
    if (userData.role === 'member' && userData.linked_member_reg_no) {
      const results = await this.provisionMembers([userData.linked_member_reg_no], password);
      const res = results[0];
      if (res && res.status === 'failed') {
        throw new Error(res.message || 'Failed to provision member account');
      }
      const created = await this.getByLinkedMember(userData.linked_member_reg_no);
      if (!created) {
        throw new Error('Account creation processed, profile initializing.');
      }
      return created;
    }

    const result = await this.createOfficer(
      email,
      {
        username: userData.username,
        designation: userData.designation,
        role: userData.role as 'super_admin' | 'editor' | 'viewer',
        linked_member_reg_no: userData.linked_member_reg_no,
      },
      password
    );
    return result.user;
  },

  /**
   * Update non-privileged profile fields.
   */
  async update(
    id: string,
    updates: Partial<Pick<AppUser, 'username' | 'designation' | 'role' | 'linked_member_reg_no'>>,
  ): Promise<AppUser> {
    const { data, error } = await supabase
      .from('app_users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as AppUser;
  },

  /**
   * Admin / Editor directly sets a temporary / mock password for a user.
   */
  async adminSetUserPassword(
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string; temporaryPassword: string }> {
    return callEdgeFunction<{ success: boolean; message: string; temporaryPassword: string }>(
      'admin-set-user-password',
      { user_id: userId, new_password: newPassword }
    );
  },

  /**
   * Super Admin sends a password reset email directly to the member's verified on-file inbox (if needed).
   */
  async sendPasswordResetEmail(userId: string): Promise<void> {
    await callEdgeFunction('admin-send-password-reset', { user_id: userId });
  },

  /**
   * Super Admin updates an on-file email for an existing user account.
   */
  async changeUserEmail(userId: string, newEmail: string): Promise<void> {
    await callEdgeFunction('admin-change-user-email', { user_id: userId, new_email: newEmail });
  },

  /**
   * Super Admin resets an officer's MFA factors.
   */
  async resetUserMfa(userId: string): Promise<void> {
    await callEdgeFunction('admin-reset-mfa', { user_id: userId });
  },

  async resetMfa(userId: string): Promise<void> {
    return this.resetUserMfa(userId);
  },

  /**
   * Delete a user account via Edge Function.
   */
  async delete(userId: string): Promise<void> {
    await callEdgeFunction('admin-delete-user', { user_id: userId });
  },

  /**
   * Suspend or reactivate a user via Edge Function.
   */
  async setStatus(userId: string, action: 'suspend' | 'reactivate'): Promise<void> {
    await callEdgeFunction('admin-set-user-status', { user_id: userId, action });
  },

  /**
   * Self-service password change:
   * 1. Re-verifies user with current password
   * 2. Updates password via Supabase Auth
   * 3. Invalidates all other active sessions
   * 4. Logs security event
   */
  async changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      throw new Error('Not authenticated');
    }

    // 1. Re-authenticate
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) {
      throw new Error('Current password verification failed');
    }

    // 2. Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) throw updateError;

    // 3. Invalidate other sessions
    try {
      await supabase.auth.signOut({ scope: 'others' });
    } catch {
      // Non-fatal if unsupported by server configuration
    }

    // 4. Log security event
    try {
      await supabase.rpc('log_security_event', {
        p_event_type: 'PASSWORD_CHANGED',
        p_target_user_id: user.id,
        p_details: { scope: 'self_service' },
      });
    } catch {
      // Non-fatal
    }
  },
};
