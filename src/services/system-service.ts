import { supabase } from '../lib/supabase';
import type { Faculty, FacultyInsert, FacultyUpdate, Batch, BatchInsert, BatchUpdate, Avenue, AvenueInsert, AvenueUpdate, Json } from '../types/database';

export const EXPECTED_SCHEMA_VERSION = '2026.10.07.1';

export interface TierPreviewResult {
  promotions: number;
  demotions: number;
  unchanged: number;
  total_members: number;
}

export interface SecurityAlert {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  is_resolved: boolean;
  created_at: string;
}

export interface SecurityEvent {
  id: string;
  event_type: string;
  user_id: string | null;
  actor_id: string | null;
  ip_address: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export const systemService = {
  // Schema Version Check
  async checkSchemaVersion(): Promise<{ matches: boolean; current: string | null; expected: string }> {
    try {
      const { data, error } = await supabase.rpc('get_schema_version');
      if (error || !data) {
        return { matches: false, current: null, expected: EXPECTED_SCHEMA_VERSION };
      }
      return {
        matches: data === EXPECTED_SCHEMA_VERSION,
        current: data,
        expected: EXPECTED_SCHEMA_VERSION,
      };
    } catch {
      return { matches: false, current: null, expected: EXPECTED_SCHEMA_VERSION };
    }
  },

  // Security Alerts & Logs
  async getSecurityAlerts(unresolvedOnly = true): Promise<SecurityAlert[]> {
    let query = supabase
      .from('security_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (unresolvedOnly) {
      query = query.eq('is_resolved', false);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Error fetching security_alerts:', error.message);
      return [];
    }
    return (data as SecurityAlert[]) || [];
  },

  async resolveSecurityAlert(alertId: string): Promise<void> {
    const { error } = await supabase
      .from('security_alerts')
      .update({ is_resolved: true })
      .eq('id', alertId);

    if (error) throw error;
  },

  async getSecurityEvents(): Promise<SecurityEvent[]> {
    const { data, error } = await supabase
      .from('security_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('Error fetching security_events:', error.message);
      return [];
    }
    return (data as SecurityEvent[]) || [];
  },

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
        console.warn('Could not fetch tier_thresholds from database, using active defaults', error.message);
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

  // Preview Tier Changes (simulates impact on active members before committing)
  async previewTierChanges(thresholds: import('../lib/tier-calculator').TierThresholds): Promise<TierPreviewResult> {
    const { data, error } = await supabase.rpc('preview_tier_changes', {
      p_thresholds: thresholds as unknown as Json,
    });
    if (error) throw error;
    return data as unknown as TierPreviewResult;
  },

  // Update Tier Thresholds via Hardened SECURITY DEFINER RPC
  async updateTierThresholds(thresholds: import('../lib/tier-calculator').TierThresholds): Promise<import('../lib/tier-calculator').TierThresholds> {
    if (
      thresholds.official <= 0 ||
      thresholds.bronze <= thresholds.official ||
      thresholds.silver <= thresholds.bronze ||
      thresholds.gold <= thresholds.silver ||
      thresholds.platinum <= thresholds.gold
    ) {
      throw new Error('Tier thresholds must strictly increase: Prospect (0) < Official < Bronze < Silver < Gold < Platinum');
    }

    const { setCustomTierThresholds } = await import('../lib/tier-calculator');

    const { data, error } = await supabase.rpc('update_tier_thresholds', {
      p_thresholds: thresholds as unknown as Json,
    });

    if (error) throw error;

    const saved = data as unknown as import('../lib/tier-calculator').TierThresholds;
    setCustomTierThresholds(saved);
    return saved;
  },
};
