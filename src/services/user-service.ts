import { supabase } from '../lib/supabase';
import type { AppUser } from '../types/database';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/**
 * Calls an Edge Function with the current user's JWT.
 */
async function callEdgeFunction(
  functionName: string,
  body: Record<string, unknown>,
): Promise<{ data: unknown; error: string | null }> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) {
    return { data: null, error: 'Not authenticated' };
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    return { data: null, error: (json as { error?: string }).error ?? 'Request failed' };
  }
  return { data: json, error: null };
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

  async getAll(): Promise<AppUser[]> {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as AppUser[]) || [];
  },

  /**
   * Create a new user account via Edge Function (server-side, uses service role key).
   * Sends an invite email; the user sets their password via the invite link.
   */
  async create(
    email: string,
    userData: {
      username: string;
      designation: string;
      role: 'super_admin' | 'editor' | 'viewer' | 'member';
      linked_member_reg_no?: string | null;
      password?: string;
    },
  ): Promise<AppUser> {
    // Client-side role check (UX only — real check is server-side in the Edge Function)
    const currentUser = await this.getCurrentUser();
    const isSuperAdmin = currentUser?.role === 'super_admin';
    const isEditorCreatingMember = currentUser?.role === 'editor' && userData.role === 'member';
    if (!currentUser || (!isSuperAdmin && !isEditorCreatingMember)) {
      throw new Error('Unauthorized: Insufficient permissions to create user.');
    }

    const { data, error } = await callEdgeFunction('admin-create-user', {
      email,
      password: userData.password,
      username: userData.username,
      designation: userData.designation,
      role: userData.role,
      linked_member_reg_no: userData.linked_member_reg_no ?? null,
    });

    if (error) throw new Error(error);
    return (data as { user: AppUser }).user;
  },

  /**
   * Update a user's non-privileged fields (username, designation, linked_member_reg_no).
   * Role changes go through super_admin direct update (RLS enforced).
   * NOTE: role, status changes require super_admin — enforced by DB trigger.
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
   * Send a password reset email.
   */
  async resetPassword(email: string): Promise<void> {
    // Use a generic redirect — don't expose account existence in error messages
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    // Do not throw on error — prevents account enumeration
    if (error) console.warn('Password reset request processed (details suppressed).');
  },

  /**
   * Delete a user account via Edge Function.
   * Deletes from auth.users (cascades to app_users). Refuses last super_admin.
   */
  async delete(userId: string): Promise<void> {
    const { error } = await callEdgeFunction('admin-delete-user', { user_id: userId });
    if (error) throw new Error(error);
  },

  /**
   * Admin sets or resets another user's password directly via Edge Function.
   */
  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    const { error } = await callEdgeFunction('admin-update-user-password', {
      user_id: userId,
      password: newPassword,
    });
    if (error) throw new Error(error);
  },

  /**
   * Any authenticated user changes their own password.
   */
  async changeOwnPassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  },

  /**
   * Suspend or reactivate a user via Edge Function.
   * Bans in Auth + updates app_users.status.
   */
  async setStatus(userId: string, action: 'suspend' | 'reactivate'): Promise<void> {
    const { error } = await callEdgeFunction('admin-set-user-status', {
      user_id: userId,
      action,
    });
    if (error) throw new Error(error);
  },
};
