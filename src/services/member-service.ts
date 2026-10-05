import { supabase } from '../lib/supabase';
import { db } from '../lib/supabase-helpers';
import { sanitizeSearchQuery } from '../lib/sanitize';
import type { Member, MemberInsert, MemberUpdate } from '../types/database';

export const memberService = {
  async getAll(): Promise<Member[]> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .is('deleted_at', null)
      .order('total_points', { ascending: false });

    if (error) throw error;
    return (data as Member[]) || [];
  },

  async getByRegNo(regNo: string): Promise<Member | null> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .ilike('reg_no', regNo)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return data as Member | null;
  },

  async getTopMembers(limit: number = 3): Promise<Member[]> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .is('deleted_at', null)
      .order('total_points', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as Member[]) || [];
  },

  async getByFaculty(faculty: string): Promise<Member[]> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('faculty', faculty)
      .is('deleted_at', null)
      .order('total_points', { ascending: false });

    if (error) throw error;
    return (data as Member[]) || [];
  },

  async create(member: MemberInsert): Promise<Member> {
    const { data, error } = await db()
      .from('members')
      .insert({ ...member, reg_no: member.reg_no.toUpperCase() })
      .select()
      .single();

    if (error) throw error;
    return data as Member;
  },

  async update(regNo: string, updates: MemberUpdate): Promise<Member> {
    const { data, error } = await db()
      .from('members')
      .update(updates)
      .ilike('reg_no', regNo)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    return data as Member;
  },

  async uploadPhoto(file: File, oldPhotoUrl?: string | null): Promise<string> {
    const { validatePhotoFile } = await import('../lib/sanitize');
    const { optimizeImage } = await import('../lib/image-utils');
    const validation = validatePhotoFile(file);
    if (!validation.valid) throw new Error(validation.error);

    const optimizedBlob = await optimizeImage(file, { maxWidth: 1024, quality: 0.8 });
    const ext = 'jpg';
    const randomId = crypto.randomUUID();
    const filePath = `member-photos/${randomId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('members')
      .upload(filePath, optimizedBlob, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) throw uploadError;

    if (oldPhotoUrl) {
      try {
        const oldPath = oldPhotoUrl.includes('/members/')
          ? oldPhotoUrl.split('/members/')[1]?.split('?')[0]
          : oldPhotoUrl;
        if (oldPath) await supabase.storage.from('members').remove([oldPath]);
      } catch { /* non-fatal */ }
    }

    return filePath;
  },

  async getPhotoSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('members')
      .createSignedUrl(storagePath, 3600);

    if (error) throw error;
    return data.signedUrl;
  },

  async search(query: string): Promise<Member[]> {
    const sanitized = sanitizeSearchQuery(query);
    if (!sanitized) return [];

    const { data, error } = await supabase
      .from('members')
      .select('*')
      .or(`reg_no.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%,name_with_initials.ilike.%${sanitized}%`)
      .is('deleted_at', null)
      .order('total_points', { ascending: false });

    if (error) throw error;
    return (data as Member[]) || [];
  },

  async softDelete(regNo: string): Promise<void> {
    const { error } = await db()
      .from('members')
      .update({ deleted_at: new Date().toISOString() })
      .ilike('reg_no', regNo);

    if (error) throw error;
  },

  async restore(regNo: string): Promise<void> {
    const { error } = await db()
      .from('members')
      .update({ deleted_at: null })
      .ilike('reg_no', regNo);

    if (error) throw error;
  },

  async purge(regNo: string): Promise<void> {
    const { error } = await supabase
      .from('members')
      .delete()
      .ilike('reg_no', regNo);

    if (error) throw error;
  },

  /** @deprecated Use softDelete() instead. */
  async delete(regNo: string): Promise<void> {
    return this.softDelete(regNo);
  },
};
