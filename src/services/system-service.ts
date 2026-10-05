import { supabase } from '../lib/supabase';
import type { Faculty, FacultyInsert, FacultyUpdate, Batch, BatchInsert, BatchUpdate, Avenue, AvenueInsert, AvenueUpdate } from '../types/database';

export const systemService = {
  // Faculties
  async getFaculties(): Promise<Faculty[]> {
    const { data, error } = await supabase
      .from('faculties')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data as Faculty[]) || [];
  },

  async createFaculty(faculty: FacultyInsert): Promise<Faculty> {
    const { data, error } = await supabase
      .from('faculties')
      .insert(faculty)
      .select()
      .single();

    if (error) throw error;
    return data as Faculty;
  },

  async updateFaculty(id: string, updates: FacultyUpdate): Promise<Faculty> {
    const { data, error } = await supabase
      .from('faculties')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Faculty;
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
    return (data as Batch[]) || [];
  },

  async createBatch(batch: BatchInsert): Promise<Batch> {
    const { data, error } = await supabase
      .from('batches')
      .insert(batch)
      .select()
      .single();

    if (error) throw error;
    return data as Batch;
  },

  async updateBatch(id: string, updates: BatchUpdate): Promise<Batch> {
    const { data, error } = await supabase
      .from('batches')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Batch;
  },

  async deleteBatch(id: string): Promise<void> {
    const { error } = await supabase
      .from('batches')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Avenues
  async getAvenues(): Promise<Avenue[]> {
    const { data, error } = await supabase
      .from('avenues')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data as Avenue[]) || [];
  },

  async createAvenue(avenue: AvenueInsert): Promise<Avenue> {
    const { data, error } = await supabase
      .from('avenues')
      .insert(avenue)
      .select()
      .single();

    if (error) throw error;
    return data as Avenue;
  },

  async updateAvenue(id: string, updates: AvenueUpdate): Promise<Avenue> {
    const { data, error } = await supabase
      .from('avenues')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Avenue;
  },

  async deleteAvenue(id: string): Promise<void> {
    const { error } = await supabase
      .from('avenues')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
