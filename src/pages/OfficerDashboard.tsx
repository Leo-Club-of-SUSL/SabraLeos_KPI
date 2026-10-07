import { useState, useEffect } from 'react';
import { memberService } from '../services/member-service';
import { contributionService } from '../services/contribution-service';
import { systemService } from '../services/system-service';
import { Trophy, Award, TrendingUp, Search, Plus } from 'lucide-react';
import type { Member } from '../types/database';
import { TierBadge } from '../components/TierBadge';
import { TierOverviewCard } from '../components/TierOverviewCard';
import { getTier, TIERS_CONFIG } from '../lib/tier-calculator';

interface OfficerDashboardProps {
  onNavigate?: (page: string, data?: unknown) => void;
}

export function OfficerDashboard({ onNavigate }: OfficerDashboardProps) {
  const [topMembers, setTopMembers] = useState<Member[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [monthlyProjects, setMonthlyProjects] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [tierDistribution, setTierDistribution] = useState<Record<string, number>>({});

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [members, stats, projects, all] = await Promise.all([
        memberService.getTopMembers(3),
        systemService.getDashboardStats().catch(async () => ({
          member_count: 0,
          total_points: await contributionService.getTotalPoints(),
        })),
        contributionService.getMonthlyStats(new Date().getFullYear(), new Date().getMonth() + 1),
        memberService.getAll(),
      ]);

      setTopMembers(members);
      setTotalPoints(stats.total_points);
      setMonthlyProjects(projects);
      setMemberCount(stats.member_count || all.length);

      const distribution = all.reduce((acc, m) => {
        const t = getTier(m.total_points).key;
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      setTierDistribution(distribution);
    } catch (error) {
      console.error('Error loading officer dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim() && onNavigate) {
      onNavigate('members', { search: searchQuery });
    }
  };

  const handleQuickAddPoints = () => {
    if (onNavigate) {
      onNavigate('members', { action: 'add-points' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Officer Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Executive overview & club KPI performance metrics
          </p>
        </div>

        <button
          onClick={handleQuickAddPoints}
          className="flex items-center gap-2 px-6 py-3 bg-maroon-600 hover:bg-maroon-700 dark:bg-maroon-600 dark:hover:bg-maroon-500 text-white rounded-lg font-medium transition-all duration-200 shadow-lg shadow-maroon-600/20 hover:shadow-maroon-600/40"
        >
          <Plus className="w-5 h-5" />
          Add Contribution
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Service Points
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {totalPoints.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-maroon-100 dark:bg-maroon-500/20 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-maroon-600 dark:text-maroon-400" />
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Projects This Month
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {monthlyProjects}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-neon-blue/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-neon-blue" />
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active Members
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {memberCount}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Quick Member Lookup
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter University Reg No (e.g., 22ABC1234)"
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white/50 dark:bg-dark-bg/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-500"
          />
          <button
            onClick={handleSearch}
            className="px-6 py-3 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2 shadow-lg shadow-maroon-600/20"
          >
            <Search className="w-5 h-5" />
            Search
          </button>
        </div>
      </div>

      {/* Top Contributors */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Top Contributors
            </h2>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('members')}
              className="text-xs font-bold text-maroon-600 dark:text-neon-blue hover:underline uppercase tracking-wider"
            >
              View Full Leaderboard →
            </button>
          )}
        </div>

        {topMembers.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No members found. Add members to see leaderboard.
          </p>
        ) : (
          <div className="space-y-4">
            {topMembers.map((member, index) => (
              <div
                key={member.reg_no}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200 border border-transparent hover:border-gray-200 dark:hover:border-white/10"
              >
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${
                    index === 0
                      ? 'bg-gradient-to-br from-yellow-400 to-yellow-600'
                      : index === 1
                      ? 'bg-gradient-to-br from-gray-300 to-gray-500'
                      : 'bg-gradient-to-br from-orange-400 to-orange-600'
                  }`}
                >
                  {index + 1}
                </div>

                <div className="flex-shrink-0">
                  {member.photo_url ? (
                    <img
                      src={member.photo_url}
                      alt={member.full_name}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-dark-border"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-maroon-100 dark:bg-maroon-500/20 flex items-center justify-center ring-2 ring-white dark:ring-dark-border">
                      <span className="text-lg font-bold text-maroon-600 dark:text-maroon-400">
                        {member.name_with_initials.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      {member.name_with_initials}
                    </p>
                    <TierBadge points={member.total_points} size="xs" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {member.reg_no} • {member.faculty}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-maroon-600 dark:text-neon-blue">
                    {member.total_points}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">points</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Member Standings Category Breakdown */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Member Standings & Recognition
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Current distribution across club standing tiers. Click any category to view members.
            </p>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('members')}
              className="text-xs font-bold text-maroon-600 dark:text-neon-blue hover:underline uppercase tracking-wider"
            >
              All Members →
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(['platinum', 'gold', 'silver', 'bronze', 'official', 'prospect'] as const).map((tKey) => {
            const t = TIERS_CONFIG[tKey];
            const count = tierDistribution[tKey] || 0;
            return (
              <button
                key={tKey}
                onClick={() => onNavigate && onNavigate('members', { tier: tKey })}
                className="p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-dark-surface/80 hover:border-maroon-400 dark:hover:border-neon-blue hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 group-hover:text-maroon-600 dark:group-hover:text-neon-blue truncate">
                    {t.shortName}
                  </span>
                  <TierBadge tierKey={tKey} size="xs" showIcon={false} />
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-black text-gray-900 dark:text-white">
                    {count}
                  </span>
                  <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                    {t.minPoints}+ pts
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Member Standings Guide & Recognition Categories */}
      <TierOverviewCard />
    </div>
  );
}
