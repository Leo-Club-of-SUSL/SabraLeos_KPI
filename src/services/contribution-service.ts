import { supabase } from '../lib/supabase';
import { db } from '../lib/supabase-helpers';
import { validatePoints } from '../lib/sanitize';
import type { Contribution, ContributionInsert } from '../types/database';

export const contributionService = {
  async getAll(): Promise<Contribution[]> {
    const { data, error } = await supabase
      .from('contributions')
      .select('*')
      .order('date_added', { ascending: false });

    if (error) throw error;
    return (data as Contribution[]) || [];
  },

  async getByMember(memberRegNo: string): Promise<Contribution[]> {
    const { data, error } = await supabase
      .from('contributions')
      .select('*')
      .eq('member_reg_no', memberRegNo)
      .order('date_added', { ascending: false });

    if (error) throw error;
    return (data as Contribution[]) || [];
  },

  async create(contribution: ContributionInsert): Promise<Contribution> {
    const pointsCheck = validatePoints(contribution.points);
    if (!pointsCheck.valid) throw new Error(pointsCheck.error);

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await db()
      .from('contributions')
      .insert({
        ...contribution,
        added_by: user?.id ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Contribution;
  },

  async createMany(contributions: ContributionInsert[]): Promise<Contribution[]> {
    if (contributions.length === 0) return [];

    const { data: { user } } = await supabase.auth.getUser();

    const toInsert = contributions.map((c) => ({
      ...c,
      added_by: user?.id ?? null,
    }));

    const { data, error } = await db()
      .from('contributions')
      .insert(toInsert)
      .select();

    if (error) throw error;
    return (data as Contribution[]) || [];
  },

  async getByDateRange(startDate: string, endDate: string): Promise<Contribution[]> {
    const { data, error } = await supabase
      .from('contributions')
      .select('*')
      .gte('date_added', startDate)
      .lte('date_added', endDate)
      .order('date_added', { ascending: false });

    if (error) throw error;
    return (data as Contribution[]) || [];
  },

  async getReportContributions(startDate?: string, endDate?: string): Promise<Contribution[]> {
    let query = supabase
      .from('contributions')
      .select('id, member_reg_no, project_name, time_period, position, points, avenue, date_added, added_by')
      .order('date_added', { ascending: false });

    if (startDate) {
      query = query.gte('date_added', startDate);
    }
    if (endDate) {
      query = query.lte('date_added', endDate.includes('T') ? endDate : `${endDate}T23:59:59`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as Contribution[]) || [];
  },

  async getPagedExportContributions(startDate?: string, endDate?: string): Promise<Contribution[]> {
    const allResults: Contribution[] = [];
    const PAGE_SIZE = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('contributions')
        .select('id, member_reg_no, project_name, time_period, position, points, avenue, date_added, added_by')
        .order('date_added', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (startDate) {
        query = query.gte('date_added', startDate);
      }
      if (endDate) {
        query = query.lte('date_added', endDate.includes('T') ? endDate : `${endDate}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data as Contribution[]) || [];
      allResults.push(...rows);

      if (rows.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        from += PAGE_SIZE;
      }
    }

    return allResults;
  },

  async getMonthlyStats(year: number, month: number): Promise<number> {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    const { count, error } = await supabase
      .from('contributions')
      .select('project_name', { count: 'exact', head: true })
      .gte('date_added', startDate)
      .lte('date_added', endDate);

    if (error) throw error;
    return count ?? 0;
  },

  async getTotalPoints(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      if (!error && data) {
        return Number((data as { total_points: number }).total_points) || 0;
      }
    } catch {
      // Fallback if RPC is not available yet
    }

    const { data, error } = await supabase
      .from('contributions')
      .select('points');

    if (error) throw error;
    const contributions = (data as { points: number }[]) || [];
    return contributions.reduce((sum, c) => sum + c.points, 0);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('contributions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getMonthlyLeaderboard(year: number, month: number): Promise<{ reg_no: string; monthly_points: number }[]> {
    const monthStr = month.toString().padStart(2, '0');
    const timePeriod = `${year}-${monthStr}`;

    const { data, error } = await supabase
      .from('contributions')
      .select('member_reg_no, points')
      .eq('time_period', timePeriod);

    if (error) throw error;

    const aggregations: Record<string, number> = {};
    const contributions = (data as { member_reg_no: string; points: number }[]) || [];

    contributions.forEach((c) => {
      aggregations[c.member_reg_no] = (aggregations[c.member_reg_no] || 0) + c.points;
    });

    return Object.entries(aggregations)
      .map(([reg_no, monthly_points]) => ({ reg_no, monthly_points }))
      .sort((a, b) => b.monthly_points - a.monthly_points);
  },
};
