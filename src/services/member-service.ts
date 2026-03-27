import { supabase } from '../lib/supabase';
import { sanitizeSearchQuery } from '../lib/sanitize';
import { logService } from './log-service';
import { userService } from './user-service';
import type { Member, MemberInsert, MemberUpdate } from '../types/database';

export const memberService = {
  async getAll(): Promise<Member[]> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('total_points', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getByRegNo(regNo: string): Promise<Member | null> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .ilike('reg_no', regNo)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getTopMembers(limit: number = 3): Promise<Member[]> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('total_points', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async getByFaculty(faculty: string): Promise<Member[]> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('faculty', faculty)
      .order('total_points', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(member: MemberInsert): Promise<Member> {
    const { data, error } = await supabase
      .from('members')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({ ...member, reg_no: member.reg_no.toUpperCase() } as any)
      .select()
      .single() as any;

    if (error) throw error;

    const user = await userService.getCurrentUser();
    await logService.log({
      user_id: user?.id,
      user_name: user?.username,
      action: 'CREATE_MEMBER',
      entity_type: 'member',
      entity_id: data.reg_no,
      details: { name: data.full_name }
    });

    return data;
  },

  async update(regNo: string, updates: MemberUpdate): Promise<Member> {
    const { data, error } = await supabase
      .from('members')
      // @ts-expect-error: Suppress type mismatch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updates as any)
      .ilike('reg_no', regNo)
      .select()
      .single();

    if (error) throw error;

    const user = await userService.getCurrentUser();
    await logService.log({
      user_id: user?.id,
      user_name: user?.username,
      action: 'UPDATE_MEMBER',
      entity_type: 'member',
      entity_id: regNo,
      details: updates
    });

    return data;
  },

  async uploadPhoto(file: File, oldPhotoUrl?: string | null): Promise<string> {
    const { validatePhotoFile } = await import('../lib/sanitize');
    const { optimizeImage } = await import('../lib/image-utils');
    const validation = validatePhotoFile(file);
    if (!validation.valid) throw new Error(validation.error);

    // Optimize image before upload
    const optimizedBlob = await optimizeImage(file, { maxWidth: 1024, quality: 0.8 });
    const ext = 'jpg';
    const randomId = crypto.randomUUID();
    const filePath = `member-photos/${randomId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('members')
      .upload(filePath, optimizedBlob, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('members').getPublicUrl(filePath);

    // Delete old photo (best-effort)
    if (oldPhotoUrl) {
      try {
        const oldPath = oldPhotoUrl.split('/members/')[1];
        if (oldPath) await supabase.storage.from('members').remove([oldPath]);
      } catch { /* non-fatal */ }
    }

    return data.publicUrl;
  },

  async search(query: string): Promise<Member[]> {
    const sanitized = sanitizeSearchQuery(query);
    if (!sanitized) return [];

    const { data, error } = await supabase
      .from('members')
      .select('*')
      .or(`reg_no.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%,name_with_initials.ilike.%${sanitized}%`)
      .order('total_points', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async delete(regNo: string): Promise<void> {
    // 1. Delete all contributions for this member first to ensure complete deletion
    // and bypass foreign key constraints if they aren't ON DELETE CASCADE
    const { error: contributionError } = await supabase
      .from('contributions')
      .delete()
      .eq('member_reg_no', regNo);

    if (contributionError) throw contributionError;

    // 2. Delete the member record
    const { error: memberError } = await supabase
      .from('members')
      .delete()
      .ilike('reg_no', regNo);

    if (memberError) throw memberError;

    // 3. Log the action
    const user = await userService.getCurrentUser();
    await logService.log({
      user_id: user?.id,
      user_name: user?.username,
      action: 'DELETE_MEMBER',
      entity_type: 'member',
      entity_id: regNo,
      details: { note: 'Member and all contributions deleted completely' }
    });
  },
};
