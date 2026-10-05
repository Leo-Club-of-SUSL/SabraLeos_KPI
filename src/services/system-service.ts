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

  // Tier Thresholds Settings
  async getTierThresholds(): Promise<import('../lib/tier-calculator').TierThresholds> {
    const { getActiveTierThresholds, setCustomTierThresholds } = await import('../lib/tier-calculator');
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'tier_thresholds')
        .maybeSingle();

      if (error) {
        console.warn('Could not fetch tier_thresholds from database, using cached/default values', error.message);
      }

      if (data && data.value && typeof data.value === 'object') {
        const val = data.value as Record<string, unknown>;
        const thresholds = {
          prospect: 0,
          official: typeof val.official === 'number' ? val.official : 50,
          bronze: typeof val.bronze === 'number' ? val.bronze : 150,
          silver: typeof val.silver === 'number' ? val.silver : 300,
          gold: typeof val.gold === 'number' ? val.gold : 500,
          platinum: typeof val.platinum === 'number' ? val.platinum : 800,
        };
        setCustomTierThresholds(thresholds);
        return thresholds;
      }
    } catch (err) {
      console.warn('Error reading tier_thresholds from database:', err);
    }
    return getActiveTierThresholds();
  },

  async updateTierThresholds(thresholds: import('../lib/tier-calculator').TierThresholds): Promise<import('../lib/tier-calculator').TierThresholds> {
    // Validate ascending order
    if (
      thresholds.official <= 0 ||
      thresholds.bronze <= thresholds.official ||
      thresholds.silver <= thresholds.bronze ||
      thresholds.gold <= thresholds.silver ||
      thresholds.platinum <= thresholds.gold
    ) {
      throw new Error('Tier thresholds must strictly increase: Official < Bronze < Silver < Gold < Platinum');
    }

    const { setCustomTierThresholds } = await import('../lib/tier-calculator');

    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert(
          {
            key: 'tier_thresholds',
            value: thresholds as unknown as import('../types/database').Json,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );

      if (error) {
        console.warn('Database upsert for tier_thresholds failed, updating locally:', error.message);
      }
    } catch (err) {
      console.warn('Database error while saving tier_thresholds:', err);
    }

    setCustomTierThresholds(thresholds);
    return thresholds;
  },
};
