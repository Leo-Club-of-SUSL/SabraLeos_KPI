import { supabase } from '../lib/supabase';
import { validatePoints } from '../lib/sanitize';
import { logService } from './log-service';
import { userService } from './user-service';
import type { Contribution, ContributionInsert } from '../types/database';

export const contributionService = {
  async getAll(): Promise<Contribution[]> {
    const { data, error } = await supabase
      .from('contributions')
      .select('*')
      .order('date_added', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getByMember(memberRegNo: string): Promise<Contribution[]> {
    const { data, error } = await supabase
      .from('contributions')
      .select('*')
      .eq('member_reg_no', memberRegNo)
      .order('date_added', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(contribution: ContributionInsert): Promise<Contribution> {
    const pointsCheck = validatePoints(contribution.points);
    if (!pointsCheck.valid) throw new Error(pointsCheck.error);

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('contributions')
      .insert({
        ...contribution,
        added_by: user?.id || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select()
      .single();

    if (error) throw error;

    const authUser = await userService.getCurrentUser();
    await logService.log({
      user_id: authUser?.id,
      user_name: authUser?.username,
      action: 'CREATE_CONTRIBUTION',
      entity_type: 'contribution',
      entity_id: (data as any).id,
      details: { member: contribution.member_reg_no, points: contribution.points }
    });

    return data as unknown as Contribution;
  },

  async getByDateRange(startDate: string, endDate: string): Promise<Contribution[]> {
    const { data, error } = await supabase
      .from('contributions')
      .select('*')
      .gte('date_added', startDate)
      .lte('date_added', endDate)
      .order('date_added', { ascending: false });

    if (error) throw error;
    return (data as unknown as Contribution[]) || [];
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
    const { data, error } = await supabase
      .from('contributions')
      .select('points');

    if (error) throw error;
    // Cast data to ensure TS knows it has 'points'
    const contributions = (data as unknown as { points: number }[]) || [];
    return contributions.reduce((sum, c) => sum + c.points, 0);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('contributions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    const authUser = await userService.getCurrentUser();
    await logService.log({
      user_id: authUser?.id,
      user_name: authUser?.username,
      action: 'DELETE_CONTRIBUTION',
      entity_type: 'contribution',
      entity_id: id
    });
  },

  async getMonthlyLeaderboard(year: number, month: number): Promise<{ reg_no: string; monthly_points: number }[]> {
    // Format: YYYY-MM (e.g., 2024-02 for February)
    const monthStr = month.toString().padStart(2, '0');
    const timePeriod = `${year}-${monthStr}`;

    const { data, error } = await supabase
      .from('contributions')
      .select('member_reg_no, points')
      .eq('time_period', timePeriod);

    if (error) throw error;

    // Aggregate points by member
    const aggregations: Record<string, number> = {};
    const contributions = (data as unknown as { member_reg_no: string; points: number }[]) || [];

    contributions.forEach((c) => {
      aggregations[c.member_reg_no] = (aggregations[c.member_reg_no] || 0) + c.points;
    });

    return Object.entries(aggregations)
      .map(([reg_no, monthly_points]) => ({ reg_no, monthly_points }))
      .sort((a, b) => b.monthly_points - a.monthly_points);
  },
};

