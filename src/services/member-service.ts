import { supabase } from '../lib/supabase';
import { db } from '../lib/supabase-helpers';
import { sanitizeSearchQuery } from '../lib/sanitize';
import type { Member, MemberInsert, MemberUpdate } from '../types/database';

// Projection column lists: avoid selecting sensitive/large contact fields (whatsapp, email, my_lci_num) in directory/lists
const MEMBER_LIST_COLUMNS = 'reg_no, full_name, name_with_initials, batch, faculty, total_points, member_status, photo_url, leaderboard_opt_out, display_alias, created_at, updated_at';
const MEMBER_DETAIL_COLUMNS = 'reg_no, full_name, name_with_initials, batch, faculty, whatsapp, email, my_lci_num, photo_url, total_points, leaderboard_opt_out, display_alias, member_status, created_at, updated_at';

export interface MemberPaginationOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  faculty?: string;
  batch?: string;
  tier?: string;
  sortBy?: 'total_points' | 'reg_no' | 'name_with_initials' | 'created_at';
  sortAscending?: boolean;
}

export interface PaginatedMembers {
  members: Member[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const memberService = {
  async getAll(): Promise<Member[]> {
    const { data, error } = await supabase
      .from('members')
      .select(MEMBER_LIST_COLUMNS)
      .is('deleted_at', null)
      .order('total_points', { ascending: false });

    if (error) throw error;
    return (data as unknown as Member[]) || [];
  },

  async getPaginated(options: MemberPaginationOptions = {}): Promise<PaginatedMembers> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.max(1, Math.min(100, options.pageSize || 25));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('members')
      .select(MEMBER_LIST_COLUMNS, { count: 'exact' })
      .is('deleted_at', null);

    if (options.faculty) {
      query = query.eq('faculty', options.faculty);
    }

    if (options.batch) {
      query = query.eq('batch', options.batch);
    }

    if (options.search) {
      const sanitized = sanitizeSearchQuery(options.search).replace(/[%_,]/g, '');
      if (sanitized) {
        query = query.or(`reg_no.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%,name_with_initials.ilike.%${sanitized}%`);
      }
    }

    const sortCol = options.sortBy || 'total_points';
    const isAsc = options.sortAscending ?? false;
    query = query.order(sortCol, { ascending: isAsc });

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    const totalCount = count || 0;
    return {
      members: (data as unknown as Member[]) || [],
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize) || 1,
    };
  },

  async getByRegNo(regNo: string): Promise<Member | null> {
    const { data, error } = await supabase
      .from('members')
      .select(MEMBER_DETAIL_COLUMNS)
      .ilike('reg_no', regNo)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return (data as unknown as Member) || null;
  },

  async getTopMembers(limit: number = 3): Promise<Member[]> {
    const { data, error } = await supabase
      .from('members')
      .select(MEMBER_LIST_COLUMNS)
      .is('deleted_at', null)
      .order('total_points', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as unknown as Member[]) || [];
  },

  async getByFaculty(faculty: string): Promise<Member[]> {
    const { data, error } = await supabase
      .from('members')
      .select(MEMBER_LIST_COLUMNS)
      .eq('faculty', faculty)
      .is('deleted_at', null)
      .order('total_points', { ascending: false });

    if (error) throw error;
    return (data as unknown as Member[]) || [];
  },

  async create(member: MemberInsert): Promise<Member> {
    const { data, error } = await db()
      .from('members')
      .insert({ ...member, reg_no: member.reg_no.toUpperCase() })
      .select(MEMBER_DETAIL_COLUMNS)
      .single();

    if (error) throw error;
    return data as unknown as Member;
  },

  async createMany(members: MemberInsert[]): Promise<Member[]> {
    if (members.length === 0) return [];
    const formatted = members.map(m => ({ ...m, reg_no: m.reg_no.toUpperCase() }));
    const { data, error } = await db()
      .from('members')
      .insert(formatted)
      .select(MEMBER_DETAIL_COLUMNS);

    if (error) throw error;
    return (data as unknown as Member[]) || [];
  },

  async checkExistingRegNos(regNos: string[]): Promise<Set<string>> {
    if (regNos.length === 0) return new Set();
    const uppercaseRegNos = regNos.map(r => r.toUpperCase());
    const { data, error } = await db()
      .from('members')
      .select('reg_no')
      .in('reg_no', uppercaseRegNos);

    if (error) throw error;
    return new Set((data || []).map((m: { reg_no: string }) => m.reg_no.toUpperCase()));
  },

  async update(regNo: string, updates: MemberUpdate): Promise<Member> {
    const { data, error } = await db()
      .from('members')
      .update(updates)
      .ilike('reg_no', regNo)
      .is('deleted_at', null)
      .select(MEMBER_DETAIL_COLUMNS)
      .single();

    if (error) throw error;
    return data as unknown as Member;
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

    const res = await supabase
      .from('members')
      .select(MEMBER_LIST_COLUMNS)
      .or(`reg_no.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%,name_with_initials.ilike.%${sanitized}%`)
      .is('deleted_at', null)
      .order('total_points', { ascending: false });

    if (res.error) {
      if (res.error.code === '42703') {
        const fallback = await supabase
          .from('members')
          .select(MEMBER_LIST_COLUMNS)
          .or(`reg_no.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%,name_with_initials.ilike.%${sanitized}%`)
          .order('total_points', { ascending: false });
        if (fallback.error) throw fallback.error;
        return (fallback.data as unknown as Member[]) || [];
      }
      throw res.error;
    }
    return (res.data as unknown as Member[]) || [];
  },

  async softDelete(regNo: string): Promise<void> {
    const res = await db()
      .from('members')
      .update({ deleted_at: new Date().toISOString() })
      .ilike('reg_no', regNo);

    if (res.error) {
      if (res.error.code === '42703') {
        return this.purge(regNo);
      }
      throw res.error;
    }
  },

  async restore(regNo: string): Promise<void> {
    const { error } = await db()
      .from('members')
      .update({ deleted_at: null })
      .ilike('reg_no', regNo);

    if (error && error.code !== '42703') throw error;
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
