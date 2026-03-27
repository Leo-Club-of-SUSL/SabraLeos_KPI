import { useState, useEffect } from 'react';
import { memberService } from '../services/member-service';
import { contributionService } from '../services/contribution-service';
import { Trophy, Award, TrendingUp, Search, Plus } from 'lucide-react';
import type { Member } from '../types/database';

interface DashboardProps {
  onNavigate?: (page: string, data?: unknown) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [topMembers, setTopMembers] = useState<Member[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [monthlyProjects, setMonthlyProjects] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [members, points, projects, count] = await Promise.all([
        memberService.getTopMembers(3),
        contributionService.getTotalPoints(),
        contributionService.getMonthlyStats(new Date().getFullYear(), new Date().getMonth() + 1),
        memberService.getAll().then(m => m.length)
      ]);

      setTopMembers(members);
      setTotalPoints(points);
      setMonthlyProjects(projects);
      setMemberCount(count);
    } catch (error) {
      console.error('Error loading dashboard:', error);
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Welcome back! Here's your overview
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
            <div className="w-12 h-12 bg-gold-100 dark:bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-gold-600 dark:text-yellow-400" />
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

      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-6 h-6 text-gold-600 dark:text-yellow-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Top Contributors
          </h2>
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
                className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200 border border-transparent hover:border-gray-200 dark:hover:border-white/10"
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${
                  index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' : 
                  index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' : 
                  'bg-gradient-to-br from-orange-400 to-orange-600'
                }`}>
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
                  <p className="font-semibold text-gray-900 dark:text-white truncate">
                    {member.name_with_initials}
                  </p>
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
    </div>
  );
}
