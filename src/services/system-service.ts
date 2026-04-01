import { supabase } from '../lib/supabase';
import type { Faculty, FacultyInsert, FacultyUpdate, Batch, BatchInsert, BatchUpdate, Avenue, AvenueInsert, AvenueUpdate } from '../types/database';

export const systemService = {
  // Faculties
  async getFaculties(): Promise<Faculty[]> {
    const { data, error } = await supabase
      .from('faculties' as any)
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createFaculty(faculty: FacultyInsert): Promise<Faculty> {
    const { data, error } = await supabase
      .from('faculties' as any)
      .insert(faculty as any)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateFaculty(id: string, updates: FacultyUpdate): Promise<Faculty> {
    const { data, error } = await supabase
      .from('faculties' as any)
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteFaculty(id: string): Promise<void> {
    const { error } = await supabase
      .from('faculties' as any)
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Batches
  async getBatches(): Promise<Batch[]> {
    const { data, error } = await supabase
      .from('batches' as any)
      .select('*')
      .order('name', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createBatch(batch: BatchInsert): Promise<Batch> {
    const { data, error } = await supabase
      .from('batches' as any)
      .insert(batch as any)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateBatch(id: string, updates: BatchUpdate): Promise<Batch> {
    const { data, error } = await supabase
      .from('batches' as any)
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteBatch(id: string): Promise<void> {
    const { error } = await supabase
      .from('batches' as any)
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Avenues
  async getAvenues(): Promise<Avenue[]> {
    const { data, error } = await supabase
      .from('avenues' as any)
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createAvenue(avenue: AvenueInsert): Promise<Avenue> {
    const { data, error } = await supabase
      .from('avenues' as any)
      .insert(avenue as any)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateAvenue(id: string, updates: AvenueUpdate): Promise<Avenue> {
    const { data, error } = await supabase
      .from('avenues' as any)
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteAvenue(id: string): Promise<void> {
    const { error } = await supabase
      .from('avenues')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
