import { supabase } from '../lib/supabase';
import { logService } from './log-service';
import { userService } from './user-service';
import type { Faculty, FacultyInsert, FacultyUpdate, Batch, BatchInsert, BatchUpdate } from '../types/database';

export const systemService = {
  // Faculties
  async getFaculties(): Promise<Faculty[]> {
    const { data, error } = await supabase
      .from('faculties')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createFaculty(faculty: FacultyInsert): Promise<Faculty> {
    const { data, error } = await supabase
      .from('faculties')
      .insert(faculty as any)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateFaculty(id: string, updates: FacultyUpdate): Promise<Faculty> {
    const { data, error } = await supabase
      .from('faculties')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteFaculty(id: string): Promise<void> {
    const { error } = await supabase
      .from('faculties')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Batches
  async getBatches(): Promise<Batch[]> {
    const { data, error } = await supabase
      .from('batches')
      .select('*')
      .order('name', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createBatch(batch: BatchInsert): Promise<Batch> {
    const { data, error } = await supabase
      .from('batches')
      .insert(batch as any)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateBatch(id: string, updates: BatchUpdate): Promise<Batch> {
    const { data, error } = await supabase
      .from('batches')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteBatch(id: string): Promise<void> {
    const { error } = await supabase
      .from('batches')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
