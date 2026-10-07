import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { memberService } from '../services/member-service';
import { contributionService } from '../services/contribution-service';
import { systemService } from '../services/system-service';
import type { Member, Contribution, Faculty, Batch } from '../types/database';
import { TierBadge } from './TierBadge';
import { TierProgressBar } from './TierProgressBar';
import { TierOverviewCard } from './TierOverviewCard';
import { ChangePasswordModal } from './ChangePasswordModal';
import { getTier } from '../lib/tier-calculator';
import {
  Trophy,
  Award,
  KeyRound,
  Layers,
  Sparkles,
  Calendar,
  Search,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Hash,
  Activity,
  RefreshCw,
} from 'lucide-react';

export function MemberDashboard() {
  const { appUser } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [leaderboardMembers, setLeaderboardMembers] = useState<Member[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Tabs: 'contributions' | 'leaderboard' | 'tiers'
  const [activeTab, setActiveTab] = useState<'contributions' | 'leaderboard' | 'tiers'>('contributions');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Contribution filters
  const [contributionSearch, setContributionSearch] = useState('');
  const [selectedAvenueFilter, setSelectedAvenueFilter] = useState('');
  const [contributionSort, setContributionSort] = useState<'newest' | 'highest'>('newest');

  // Leaderboard state
  const [leaderboardType, setLeaderboardType] = useState<'all-time' | 'monthly'>('all-time');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [leaderboardFaculty, setLeaderboardFaculty] = useState('');
  const [leaderboardBatch, setLeaderboardBatch] = useState('');
  const [leaderboardTier, setLeaderboardTier] = useState('');
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Load Member & Personal Contributions
  const loadMemberData = async () => {
    try {
      setError(null);
      let memberRecord: Member | null = null;

      if (appUser?.linked_member_reg_no) {
        memberRecord = await memberService.getByRegNo(appUser.linked_member_reg_no);
      }

      // Fallback search by username if linked reg no is empty
      if (!memberRecord && appUser?.username) {
        memberRecord = await memberService.getByRegNo(appUser.username);
      }

      setMember(memberRecord);

      if (memberRecord) {
        const memberContributions = await contributionService.getByMember(memberRecord.reg_no);
        setContributions(memberContributions);
      }

      // Load taxonomy for filters
      const [facList, batchList] = await Promise.all([
        systemService.getFaculties().catch(() => []),
        systemService.getBatches().catch(() => []),
      ]);
      setFaculties(facList);
      setBatches(batchList);
    } catch (err) {
      console.error('Failed to load member portal data:', err);
      setError('Unable to load your member profile. Please try refreshing.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  // Load Leaderboard Data
  const loadLeaderboardData = async () => {
    try {
      setLoadingLeaderboard(true);
      let data = await memberService.getAll();

      if (leaderboardType === 'monthly') {
        const [year, month] = selectedMonth.split('-').map(Number);
        const monthlyStats = await contributionService.getMonthlyLeaderboard(year, month);

        const membersWithMonthlyPoints = data.map((m) => {
          const stat = monthlyStats.find((s) => s.reg_no === m.reg_no);
          return {
            ...m,
            total_points: stat ? stat.monthly_points : 0,
          };
        });

        data = membersWithMonthlyPoints.sort((a, b) => b.total_points - a.total_points);
      } else {
        data = data.sort((a, b) => b.total_points - a.total_points);
      }

      setLeaderboardMembers(data);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    loadMemberData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.linked_member_reg_no, appUser?.username]);

  useEffect(() => {
    loadLeaderboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderboardType, selectedMonth]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadMemberData(), loadLeaderboardData()]);
  };

  // Filtered Contributions
  const filteredContributions = useMemo(() => {
    let result = [...contributions];

    if (contributionSearch.trim()) {
      const q = contributionSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.project_name.toLowerCase().includes(q) ||
          c.position.toLowerCase().includes(q) ||
          (c.avenue && c.avenue.toLowerCase().includes(q))
      );
    }

    if (selectedAvenueFilter) {
      result = result.filter((c) => c.avenue === selectedAvenueFilter);
    }

    if (contributionSort === 'highest') {
      result.sort((a, b) => b.points - a.points);
    } else {
      result.sort((a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime());
    }

    return result;
  }, [contributions, contributionSearch, selectedAvenueFilter, contributionSort]);

  // Compute stats
  const memberPoints = member?.total_points ?? 0;
  const currentTier = getTier(memberPoints);

  // Compute Avenue Breakdown
  const avenueStats = useMemo(() => {
    const stats: Record<string, { points: number; count: number }> = {};
    contributions.forEach((c) => {
      const ave = c.avenue || 'General';
      if (!stats[ave]) {
        stats[ave] = { points: 0, count: 0 };
      }
      stats[ave].points += c.points;
      stats[ave].count += 1;
    });
    return Object.entries(stats).sort((a, b) => b[1].points - a[1].points);
  }, [contributions]);

  // Member's overall rank in all-time leaderboard
  const memberRank = useMemo(() => {
    if (!member || leaderboardMembers.length === 0) return null;
    const index = leaderboardMembers.findIndex((m) => m.reg_no === member.reg_no);
    return index !== -1 ? index + 1 : null;
  }, [member, leaderboardMembers]);

  // Filtered Leaderboard (Privacy Safe: only public attributes)
  const filteredLeaderboard = useMemo(() => {
    let result = [...leaderboardMembers];

    if (leaderboardSearch.trim()) {
      const q = leaderboardSearch.toLowerCase();
      result = result.filter(
        (m) =>
          m.name_with_initials.toLowerCase().includes(q) ||
          m.reg_no.toLowerCase().includes(q) ||
          (m.display_alias && m.display_alias.toLowerCase().includes(q))
      );
    }

    if (leaderboardFaculty) {
      result = result.filter((m) => m.faculty === leaderboardFaculty);
    }

    if (leaderboardBatch) {
      result = result.filter((m) => m.batch === leaderboardBatch);
    }

    if (leaderboardTier) {
      result = result.filter((m) => getTier(m.total_points).key === leaderboardTier);
    }

    return result;
  }, [leaderboardMembers, leaderboardSearch, leaderboardFaculty, leaderboardBatch, leaderboardTier]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon-600 dark:border-neon-blue"></div>
        <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">Loading your member portal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Hero / Member Profile Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-maroon-900 via-maroon-800 to-gray-900 text-white shadow-2xl p-6 sm:p-8 border border-maroon-700/30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-maroon-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-neon-blue/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Avatar & Personal Info */}
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              {member?.photo_url ? (
                <img
                  src={member.photo_url}
                  alt={member.full_name}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-4 ring-white/20 shadow-xl"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-maroon-700 to-maroon-500 flex items-center justify-center ring-4 ring-white/20 shadow-xl">
                  <span className="text-3xl font-black text-white">
                    {member?.name_with_initials?.charAt(0) || appUser?.username?.charAt(0) || 'L'}
                  </span>
                </div>
              )}
              <div className="absolute -bottom-2 -right-2">
                <TierBadge points={memberPoints} size="xs" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/10 text-maroon-200 border border-white/10 backdrop-blur-sm">
                  Member Portal
                </span>
                {memberRank && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-yellow-400" />
                    Club Rank #{memberRank}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {member?.name_with_initials || appUser?.username || 'Club Member'}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-maroon-100/90 font-medium">
                {member?.reg_no && (
                  <span className="flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-maroon-300" />
                    {member.reg_no}
                  </span>
                )}
                {member?.faculty && (
                  <span className="flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-maroon-300" />
                    {member.faculty} ({member.batch})
                  </span>
                )}
                {member?.my_lci_num && (
                  <span className="text-xs text-maroon-200/80">
                    MyLCI: {member.my_lci_num}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions & Points Counter */}
          <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end justify-between gap-4">
            <div className="text-left md:text-right">
              <p className="text-xs font-bold uppercase tracking-wider text-maroon-200">
                Total Service Points
              </p>
              <div className="flex items-baseline md:justify-end gap-1.5 mt-0.5">
                <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                  {memberPoints.toLocaleString()}
                </span>
                <span className="text-sm font-semibold text-maroon-200">pts</span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowPasswordModal(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-semibold text-xs transition-all duration-200 border border-white/10 shadow-sm"
              >
                <KeyRound className="w-4 h-4 text-maroon-200" />
                Change Password
              </button>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh portal"
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-all duration-200 border border-white/10"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Level & Tier Progress */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <TierProgressBar points={memberPoints} showSteps={true} />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200 flex items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-xs sm:text-sm font-semibold">{error}</p>
          </div>
          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-bold text-red-800 dark:text-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Profile Not Linked Warning */}
      {!member && !loading && !error && (
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-bold">Member Profile Link Pending</p>
            <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/80">
              Your account is not linked to a specific University Registration Number yet. Please inform the club executive committee or editor to link your registration number to display your personalized points.
            </p>
          </div>
        </div>
      )}


      {/* KPI Overview Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-gray-200/80 dark:border-white/10 hover:shadow-lg transition-all duration-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Standing Tier
            </p>
            <div className="w-9 h-9 rounded-xl bg-maroon-100 dark:bg-maroon-500/20 flex items-center justify-center">
              <Award className="w-4 h-4 text-maroon-600 dark:text-maroon-400" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
              {currentTier.name}
            </p>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            {currentTier.description}
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-gray-200/80 dark:border-white/10 hover:shadow-lg transition-all duration-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Activities & Roles
            </p>
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-neon-blue/20 flex items-center justify-center">
              <Layers className="w-4 h-4 text-blue-600 dark:text-neon-blue" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
              {contributions.length}
            </p>
            <span className="text-xs text-gray-500 dark:text-gray-400">records</span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Participations recorded
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-gray-200/80 dark:border-white/10 hover:shadow-lg transition-all duration-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Club Rank
            </p>
            <div className="w-9 h-9 rounded-xl bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
              {memberRank ? `#${memberRank}` : '-'}
            </p>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              of {leaderboardMembers.length}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Overall club leaderboard
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-gray-200/80 dark:border-white/10 hover:shadow-lg transition-all duration-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Top Avenue
            </p>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
              {avenueStats[0] ? avenueStats[0][0] : 'None yet'}
            </p>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            {avenueStats[0] ? `${avenueStats[0][1].points} pts earned` : 'Start contributing!'}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-white/10 space-x-1 sm:space-x-4">
        <button
          onClick={() => setActiveTab('contributions')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all duration-200 ${
            activeTab === 'contributions'
              ? 'border-maroon-600 text-maroon-600 dark:border-neon-blue dark:text-neon-blue'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>My Contributions</span>
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-white/10 font-mono">
            {contributions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all duration-200 ${
            activeTab === 'leaderboard'
              ? 'border-maroon-600 text-maroon-600 dark:border-neon-blue dark:text-neon-blue'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Club Leaderboard</span>
        </button>

        <button
          onClick={() => setActiveTab('tiers')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all duration-200 ${
            activeTab === 'tiers'
              ? 'border-maroon-600 text-maroon-600 dark:border-neon-blue dark:text-neon-blue'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Tiers & Badges Guide</span>
        </button>
      </div>

      {/* Tab 1: My Contributions */}
      {activeTab === 'contributions' && (
        <div className="space-y-6">
          {/* Avenue Breakdown Chips */}
          {avenueStats.length > 0 && (
            <div className="glass-panel p-5 rounded-2xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                Points by Service Avenue
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {avenueStats.map(([ave, stat]) => (
                  <button
                    key={ave}
                    onClick={() =>
                      setSelectedAvenueFilter(selectedAvenueFilter === ave ? '' : ave)
                    }
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-200 border ${
                      selectedAvenueFilter === ave
                        ? 'bg-maroon-600 text-white border-maroon-600 shadow-md shadow-maroon-600/20'
                        : 'bg-white/60 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-maroon-400 dark:hover:border-neon-blue'
                    }`}
                  >
                    <span>{ave}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                        selectedAvenueFilter === ave
                          ? 'bg-white/20 text-white'
                          : 'bg-maroon-50 dark:bg-maroon-500/20 text-maroon-700 dark:text-neon-blue'
                      }`}
                    >
                      {stat.points} pts
                    </span>
                  </button>
                ))}
                {selectedAvenueFilter && (
                  <button
                    onClick={() => setSelectedAvenueFilter('')}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white underline"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects or roles..."
                value={contributionSearch}
                onChange={(e) => setContributionSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-dark-bg/50 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-maroon-500"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sort:</span>
              </div>
              <select
                value={contributionSort}
                onChange={(e) => setContributionSort(e.target.value as 'newest' | 'highest')}
                className="px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-dark-surface text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-maroon-500"
              >
                <option value="newest">Most Recent</option>
                <option value="highest">Highest Points</option>
              </select>
            </div>
          </div>

          {/* Contributions List */}
          {filteredContributions.length === 0 ? (
            <div className="glass-panel p-12 text-center rounded-2xl border border-dashed border-gray-300 dark:border-white/10 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-maroon-100 dark:bg-maroon-500/20 flex items-center justify-center text-maroon-600 dark:text-maroon-400">
                <Activity className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-gray-900 dark:text-white">
                No Contributions Found
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                {contributionSearch || selectedAvenueFilter
                  ? 'No projects matched your search criteria. Try resetting filters.'
                  : 'Your project participation and KPI service records will appear here as soon as projects are logged by project chairs and committee officers.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredContributions.map((c) => (
                <div
                  key={c.id}
                  className="glass-card p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-white/10 hover:border-maroon-300 dark:hover:border-white/20 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-base text-gray-900 dark:text-white">
                        {c.project_name}
                      </h4>
                      {c.avenue && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-maroon-50 dark:bg-maroon-500/20 text-maroon-700 dark:text-neon-blue border border-maroon-100 dark:border-maroon-500/30">
                          {c.avenue}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Role: {c.position}
                      </span>
                      {c.time_period && (
                        <span>• Period: {c.time_period}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {new Date(c.date_added).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-white/5 flex-shrink-0">
                    <div className="flex items-baseline gap-1 text-emerald-600 dark:text-emerald-400">
                      <span className="text-xl sm:text-2xl font-black">+{c.points}</span>
                      <span className="text-xs font-bold uppercase">pts</span>
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Verified
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Club Leaderboard */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-6">
          {/* Leaderboard Controls */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Type Switcher */}
              <div className="flex p-1 bg-gray-100 dark:bg-dark-bg/80 rounded-xl border border-gray-200 dark:border-white/10 w-fit">
                <button
                  onClick={() => setLeaderboardType('all-time')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    leaderboardType === 'all-time'
                      ? 'bg-white dark:bg-dark-surface text-maroon-700 dark:text-neon-blue shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  All-Time Rankings
                </button>
                <button
                  onClick={() => setLeaderboardType('monthly')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    leaderboardType === 'monthly'
                      ? 'bg-white dark:bg-dark-surface text-maroon-700 dark:text-neon-blue shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Monthly Standings
                </button>
              </div>

              {leaderboardType === 'monthly' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Month:</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-dark-surface text-gray-900 dark:text-white outline-none"
                  />
                </div>
              )}
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name or reg no..."
                  value={leaderboardSearch}
                  onChange={(e) => setLeaderboardSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-dark-bg/50 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-maroon-500"
                />
              </div>

              <select
                value={leaderboardFaculty}
                onChange={(e) => setLeaderboardFaculty(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-dark-surface text-gray-800 dark:text-gray-200 outline-none"
              >
                <option value="">All Faculties</option>
                {faculties.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>

              <select
                value={leaderboardBatch}
                onChange={(e) => setLeaderboardBatch(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-dark-surface text-gray-800 dark:text-gray-200 outline-none"
              >
                <option value="">All Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>

              <select
                value={leaderboardTier}
                onChange={(e) => setLeaderboardTier(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-dark-surface text-gray-800 dark:text-gray-200 outline-none"
              >
                <option value="">All Tiers</option>
                <option value="platinum">Platinum (800+)</option>
                <option value="gold">Gold (500+)</option>
                <option value="silver">Silver (300+)</option>
                <option value="bronze">Bronze (150+)</option>
                <option value="official">Official (50+)</option>
                <option value="prospect">Prospect (&lt;50)</option>
              </select>
            </div>
          </div>

          {/* Leaderboard Table / Cards */}
          {loadingLeaderboard ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maroon-600"></div>
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div className="glass-panel p-10 text-center rounded-2xl">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No members matched the filter criteria.
              </p>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4 text-center w-16">Rank</th>
                      <th className="py-3.5 px-4">Member</th>
                      <th className="py-3.5 px-4">Faculty & Batch</th>
                      <th className="py-3.5 px-4 text-center">Standing Tier</th>
                      <th className="py-3.5 px-4 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                    {filteredLeaderboard.map((m, idx) => {
                      const isCurrentUser = member && m.reg_no === member.reg_no;
                      const rank = idx + 1;
                      return (
                        <tr
                          key={m.reg_no}
                          className={`transition-colors duration-150 ${
                            isCurrentUser
                              ? 'bg-maroon-500/10 dark:bg-neon-blue/10 border-l-4 border-l-maroon-600 dark:border-l-neon-blue font-semibold'
                              : 'hover:bg-gray-50/70 dark:hover:bg-white/5'
                          }`}
                        >
                          {/* Rank */}
                          <td className="py-3.5 px-4 text-center">
                            {rank === 1 ? (
                              <div className="w-8 h-8 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 text-white font-black text-xs flex items-center justify-center shadow-md">
                                🥇
                              </div>
                            ) : rank === 2 ? (
                              <div className="w-8 h-8 mx-auto rounded-full bg-gradient-to-br from-gray-300 to-gray-500 text-white font-black text-xs flex items-center justify-center shadow-md">
                                🥈
                              </div>
                            ) : rank === 3 ? (
                              <div className="w-8 h-8 mx-auto rounded-full bg-gradient-to-br from-orange-400 to-amber-700 text-white font-black text-xs flex items-center justify-center shadow-md">
                                🥉
                              </div>
                            ) : (
                              <span className="font-mono font-bold text-gray-600 dark:text-gray-400 text-xs">
                                #{rank}
                              </span>
                            )}
                          </td>

                          {/* Member Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              {m.photo_url ? (
                                <img
                                  src={m.photo_url}
                                  alt={m.full_name}
                                  className="w-9 h-9 rounded-full object-cover ring-1 ring-gray-200 dark:ring-white/10"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-maroon-100 dark:bg-maroon-500/20 text-maroon-600 dark:text-maroon-400 font-bold flex items-center justify-center text-xs">
                                  {m.name_with_initials.charAt(0)}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">
                                    {m.display_alias || m.name_with_initials}
                                  </p>
                                  {isCurrentUser && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-maroon-600 text-white dark:bg-neon-blue dark:text-black">
                                      You
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                                  {m.reg_no}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Faculty & Batch */}
                          <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-300">
                            <div>{m.faculty}</div>
                            <div className="text-[11px] text-gray-400 dark:text-gray-500">
                              Batch: {m.batch}
                            </div>
                          </td>

                          {/* Standing Tier */}
                          <td className="py-3.5 px-4 text-center">
                            <TierBadge points={m.total_points} size="xs" />
                          </td>

                          {/* Points */}
                          <td className="py-3.5 px-4 text-right font-mono">
                            <span className="text-base font-black text-maroon-600 dark:text-neon-blue">
                              {m.total_points.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-gray-400 ml-1">pts</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Recognition Tiers Guide */}
      {activeTab === 'tiers' && (
        <div className="space-y-6">
          <TierOverviewCard />
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
}
