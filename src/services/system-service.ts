import { supabase } from '../lib/supabase';
import type { Faculty, FacultyInsert, FacultyUpdate, Batch, BatchInsert, BatchUpdate, Avenue, AvenueInsert, AvenueUpdate, Json } from '../types/database';

export const EXPECTED_SCHEMA_VERSION = '2026.10.07.1';

export interface DashboardStats {
  member_count: number;
  total_points: number;
}

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

// In-memory session cache for static lookups
let facultiesCache: Faculty[] | null = null;
let batchesCache: Batch[] | null = null;
let avenuesCache: Avenue[] | null = null;
let tierThresholdsCache: import('../lib/tier-calculator').TierThresholds | null = null;

export const systemService = {
  // Clear static in-memory cache on sign-out or forced refresh
  clearStaticCache(): void {
    facultiesCache = null;
    batchesCache = null;
    avenuesCache = null;
    tierThresholdsCache = null;
  },

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

  // Dashboard Stats RPC (Single aggregate call computed on database)
  async getDashboardStats(): Promise<DashboardStats> {
    const { data, error } = await supabase.rpc('get_dashboard_stats');
    if (error) throw error;
    const res = data as { member_count: number; total_points: number };
    return {
      member_count: Number(res.member_count) || 0,
      total_points: Number(res.total_points) || 0,
    };
  },

  // Security Alerts & Logs
  async getSecurityAlerts(unresolvedOnly = true): Promise<SecurityAlert[]> {
    let query = supabase
      .from('security_alerts')
      .select('id, alert_type, severity, title, description, metadata, is_resolved, created_at')
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
      .select('id, event_type, user_id, actor_id, ip_address, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('Error fetching security_events:', error.message);
      return [];
    }
    return (data as SecurityEvent[]) || [];
  },

  // Faculties (Session Cached)
  async getFaculties(forceRefresh = false): Promise<Faculty[]> {
    if (!forceRefresh && facultiesCache) {
      return facultiesCache;
    }

    const { data, error } = await supabase
      .from('faculties')
      .select('id, name, created_at')
      .order('name', { ascending: true });

    if (error) throw error;
    const result = (data as Faculty[]) || [];
    facultiesCache = result;
    return result;
  },

  async createFaculty(faculty: FacultyInsert): Promise<Faculty> {
    facultiesCache = null;
    const { data, error } = await supabase
      .from('faculties')
      .insert(faculty)
      .select('id, name, created_at')
      .single();

    if (error) throw error;
    return data as Faculty;
  },

  async updateFaculty(id: string, updates: FacultyUpdate): Promise<Faculty> {
    facultiesCache = null;
    const { data, error } = await supabase
      .from('faculties')
      .update(updates)
      .eq('id', id)
      .select('id, name, created_at')
      .single();

    if (error) throw error;
    return data as Faculty;
  },

  async deleteFaculty(id: string): Promise<void> {
    facultiesCache = null;
    const { error } = await supabase
      .from('faculties')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Batches (Session Cached)
  async getBatches(forceRefresh = false): Promise<Batch[]> {
    if (!forceRefresh && batchesCache) {
      return batchesCache;
    }

    const { data, error } = await supabase
      .from('batches')
      .select('id, name, created_at')
      .order('name', { ascending: false });

    if (error) throw error;
    const result = (data as Batch[]) || [];
    batchesCache = result;
    return result;
  },

  async createBatch(batch: BatchInsert): Promise<Batch> {
    batchesCache = null;
    const { data, error } = await supabase
      .from('batches')
      .insert(batch)
      .select('id, name, created_at')
      .single();

    if (error) throw error;
    return data as Batch;
  },

  async updateBatch(id: string, updates: BatchUpdate): Promise<Batch> {
    batchesCache = null;
    const { data, error } = await supabase
      .from('batches')
      .update(updates)
      .eq('id', id)
      .select('id, name, created_at')
      .single();

    if (error) throw error;
    return data as Batch;
  },

  async deleteBatch(id: string): Promise<void> {
    batchesCache = null;
    const { error } = await supabase
      .from('batches')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Avenues (Session Cached)
  async getAvenues(forceRefresh = false): Promise<Avenue[]> {
    if (!forceRefresh && avenuesCache) {
      return avenuesCache;
    }

    const { data, error } = await supabase
      .from('avenues')
      .select('id, name, created_at')
      .order('name', { ascending: true });

    if (error) throw error;
    const result = (data as Avenue[]) || [];
    avenuesCache = result;
    return result;
  },

  async createAvenue(avenue: AvenueInsert): Promise<Avenue> {
    avenuesCache = null;
    const { data, error } = await supabase
      .from('avenues')
      .insert(avenue)
      .select('id, name, created_at')
      .single();

    if (error) throw error;
    return data as Avenue;
  },

  async updateAvenue(id: string, updates: AvenueUpdate): Promise<Avenue> {
    avenuesCache = null;
    const { data, error } = await supabase
      .from('avenues')
      .update(updates)
      .eq('id', id)
      .select('id, name, created_at')
      .single();

    if (error) throw error;
    return data as Avenue;
  },

  async deleteAvenue(id: string): Promise<void> {
    avenuesCache = null;
    const { error } = await supabase
      .from('avenues')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Tier Thresholds Settings (Session Cached)
  async getTierThresholds(forceRefresh = false): Promise<import('../lib/tier-calculator').TierThresholds> {
    if (!forceRefresh && tierThresholdsCache) {
      return tierThresholdsCache;
    }

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
        tierThresholdsCache = thresholds;
        return thresholds;
      }
    } catch (err) {
      console.warn('Error reading tier_thresholds from database:', err);
    }
    const defaults = getActiveTierThresholds();
    tierThresholdsCache = defaults;
    return defaults;
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

    tierThresholdsCache = null;
    const { setCustomTierThresholds } = await import('../lib/tier-calculator');

    const { data, error } = await supabase.rpc('update_tier_thresholds', {
      p_thresholds: thresholds as unknown as Json,
    });

    if (error) throw error;

    const saved = data as unknown as import('../lib/tier-calculator').TierThresholds;
    setCustomTierThresholds(saved);
    tierThresholdsCache = saved;
    return saved;
  },
};
