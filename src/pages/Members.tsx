import { useState, useEffect } from 'react';
import { memberService } from '../services/member-service';
import { contributionService } from '../services/contribution-service';
import { Search, UserPlus, Award, User, X, FileDown, Pencil, Download, Trash2, Layers } from 'lucide-react';
import type { Member, Contribution } from '../types/database';
import { NewMemberForm } from '../components/NewMemberForm';
import { EditMemberForm } from '../components/EditMemberForm';
import { AddContributionForm } from '../components/AddContributionForm';
import { BulkImportModal } from '../components/BulkImportModal';
import { BulkProjectContributionForm } from '../components/BulkProjectContributionForm';
import { usePermissions } from '../hooks/usePermissions';
import { downloadImage } from '../lib/image-utils';

interface MembersProps {
  initialSearch?: string;
  initialAction?: string;
}

export function Members({ initialSearch, initialAction }: MembersProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearch || '');
  const [searchResult, setSearchResult] = useState<Member | null>(null);
  const [memberNotFound, setMemberNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showNewMemberForm, setShowNewMemberForm] = useState(false);
  const [showEditMemberForm, setShowEditMemberForm] = useState(false);
  const [showAddContribution, setShowAddContribution] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showBulkProjectContribution, setShowBulkProjectContribution] = useState(false);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const { canEdit } = usePermissions();

  const [leaderboardType, setLeaderboardType] = useState<'all-time' | 'monthly'>('all-time');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Filters
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<string>('');

  const loadMembers = async () => {
    try {
      setLoadingMembers(true);
      let data = await memberService.getAll();

      if (leaderboardType === 'monthly') {
        const [year, month] = selectedMonth.split('-').map(Number);
        const monthlyStats = await contributionService.getMonthlyLeaderboard(year, month);

        // Map monthly points to members
        const membersWithMonthlyPoints = data.map(member => {
          const stat = monthlyStats.find(s => s.reg_no === member.reg_no);
          return {
            ...member,
            total_points: stat ? stat.monthly_points : 0
          };
        });

        // Sort by monthly points desc
        data = membersWithMonthlyPoints.sort((a, b) => b.total_points - a.total_points);
      } else {
        // Ensure default sort is by total_points desc
        data = data.sort((a, b) => b.total_points - a.total_points);
      }

      setAllMembers(data);
    } catch (error) {
      console.error('Failed to load members', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSearch = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) return;

    setLoading(true);
    setMemberNotFound(false);
    setSearchResult(null);
    setContributions([]);

    try {
      const member = await memberService.getByRegNo(searchTerm.trim());

      if (member) {
        setSearchResult(member);
        const memberContributions = await contributionService.getByMember(member.reg_no);
        setContributions(memberContributions);
      } else {
        setMemberNotFound(true);
      }
    } catch (error) {
      console.error('Search error:', error);
      setMemberNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
    // loadMembers reads leaderboardType and selectedMonth from closure — intentional pattern
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderboardType, selectedMonth]);

  useEffect(() => {
    let result = [...allMembers];
    if (selectedFaculty) result = result.filter(m => m.faculty === selectedFaculty);
    if (selectedBatch) result = result.filter(m => m.batch === selectedBatch);
    setFilteredMembers(result);
  }, [allMembers, selectedFaculty, selectedBatch]);

  useEffect(() => {
    if (initialSearch) {
      handleSearch(initialSearch);
    }
    if (initialAction === 'add-points') {
      setShowAddContribution(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearch, initialAction]);



  const handleMemberCreated = (member: Member) => {
    setShowNewMemberForm(false);
    setSearchResult(member);
    setMemberNotFound(false);
    setSearchQuery(member.reg_no);
    loadMembers(); // Reload list to include new member
  };

  const handleMemberUpdated = (updatedMember: Member) => {
    setShowEditMemberForm(false);
    setSearchResult(updatedMember);
    loadMembers(); // Reload list to reflect changes
  };

  const handleContributionAdded = async () => {
    setShowAddContribution(false);
    if (searchResult) {
      const updatedMember = await memberService.getByRegNo(searchResult.reg_no);
      if (updatedMember) {
        setSearchResult(updatedMember);
      }
      const memberContributions = await contributionService.getByMember(searchResult.reg_no);
      setContributions(memberContributions);
      loadMembers(); // Reload list to update points or ensure leaderboard is current
    }
  };

  const handleBulkImportSuccess = () => {
    loadMembers(); // Reload list after bulk import
    if (searchResult) {
      handleSearch(searchResult.reg_no);
    }
  };



  const handleDeleteMember = async () => {
    if (!searchResult) return;
    
    if (!window.confirm(`Are you sure you want to delete ${searchResult.full_name} COMPLETELY? This action cannot be undone and will delete ALL their contribution history (points).`)) {
      return;
    }

    try {
      setLoading(true);
      await memberService.delete(searchResult.reg_no);
      setSearchResult(null);
      setSearchQuery('');
      loadMembers();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete member completely. You may not have sufficient permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewMember = (member: Member) => {
    setSearchResult(member);
    setSearchQuery(member.reg_no);
    setMemberNotFound(false);
    // Fetch contributions for the selected member
    contributionService.getByMember(member.reg_no).then(setContributions);
  };

  // Get unique faculties and batches for filters
  const uniqueFaculties = Array.from(new Set(allMembers.map(m => m.faculty))).sort();
  const uniqueBatches = Array.from(new Set(allMembers.map(m => m.batch))).sort();

  return (
    <div className="space-y-6 pb-20">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Member Lookup & Leaderboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Search for members or view monthly rankings
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-3">
              {canEdit && (
                <button
                  onClick={() => setShowBulkProjectContribution(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg font-medium transition-colors duration-200 shadow-md"
                >
                  <Layers className="w-5 h-5" />
                  Add Project Points
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => setShowBulkImport(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-200 shadow-md"
                >
                  <FileDown className="w-5 h-5" />
                  Bulk Import
                </button>
              )}
            </div>
          )}
        </div>
        {!canEdit && (
          <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 backdrop-blur-sm">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Viewer Mode:</strong> You have read-only access.
            </p>
          </div>
        )}
      </div>

      <div className="glass-panel rounded-xl p-6">
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
            onClick={() => handleSearch()}
            disabled={loading}
            className="px-6 py-3 bg-maroon-600 hover:bg-maroon-700 disabled:bg-maroon-400 text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-maroon-600/20"
          >
            <Search className="w-5 h-5" />
            Search
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon-600"></div>
        </div>
      )}

      {memberNotFound && !loading && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <User className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Member Not Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No member found with Registration Number "{searchQuery}". {canEdit ? 'Would you like to register this member?' : 'Please contact an admin or editor to register this member.'}
              </p>
              {canEdit && (
                <button
                  onClick={() => setShowNewMemberForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  <UserPlus className="w-5 h-5" />
                  Register New Member
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {searchResult && !loading ? (
        <div className="glass-panel rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-gradient-to-r from-maroon-600 to-maroon-700 p-6 relative overflow-hidden">
            {/* Background pattern for card */}
            <div className="absolute inset-0 opacity-10 bg-[url('/images/pattern.png')] bg-repeat mix-blend-overlay"></div>

            <div className="relative z-10 flex items-center gap-4">
              <button
                onClick={() => setSearchResult(null)}
                className="mr-2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                title="Back to list"
              >
                <X className="w-5 h-5" />
              </button>
              {searchResult.photo_url ? (
                <div className="relative group/photo">
                  <img
                    src={searchResult.photo_url}
                    alt={searchResult.full_name}
                    crossOrigin="anonymous"
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                    onError={(e) => {
                      // Hide broken image and show initials fallback
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const fallback = document.createElement('div');
                        fallback.className = 'w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-lg';
                        fallback.innerHTML = `<span style="font-size:2.25rem;font-weight:700;color:#7f1d1d">${searchResult.full_name.charAt(0)}</span>`;
                        parent.insertBefore(fallback, target);
                      }
                    }}
                  />
                  <button
                    onClick={() => downloadImage(searchResult.photo_url!, `${searchResult.reg_no.replace(/\//g, '_')}_photo.jpg`)}
                    className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity duration-200"
                    title="Download Photo"
                  >
                    <Download className="w-6 h-6 text-white" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-lg">
                  <span className="text-4xl font-bold text-maroon-600">
                    {searchResult.name_with_initials.charAt(0)}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-white tracking-tight">
                  {searchResult.name_with_initials}
                </h2>
                <p className="text-maroon-100 text-lg mt-1 font-medium">
                  {searchResult.full_name}
                </p>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-white/20 rounded text-xs text-white font-medium border border-white/20">
                    {searchResult.batch}
                  </span>
                  <span className="px-2 py-0.5 bg-white/20 rounded text-xs text-white font-medium border border-white/20">
                    {searchResult.faculty}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 shadow-lg">
                  <p className="text-5xl font-bold text-white drop-shadow-sm">
                    {searchResult.total_points}
                  </p>
                  <p className="text-maroon-100 text-sm font-medium uppercase tracking-wider">Service Points</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                  Member Details
                </h3>
                <div className="grid grid-cols-2 gap-y-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Registration No</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-lg">{searchResult.reg_no}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Batch</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-lg">{searchResult.batch}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Faculty</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-lg">{searchResult.faculty}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">WhatsApp</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-lg">{searchResult.whatsapp}</p>
                  </div>
                  {searchResult.my_lci_num && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">MyLCI Number</p>
                      <p className="font-semibold text-gray-900 dark:text-white text-lg">{searchResult.my_lci_num}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                  Actions
                </h3>
                {canEdit ? (
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => setShowAddContribution(true)}
                      className="flex items-center justify-center gap-3 px-6 py-4 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl font-bold text-lg transition-all duration-200 shadow-lg hover:shadow-maroon-600/30 transform hover:-translate-y-0.5"
                    >
                      <Award className="w-6 h-6" />
                      Add New Contribution
                    </button>
                    <button
                      onClick={() => setShowEditMemberForm(true)}
                      className="flex items-center justify-center gap-3 px-6 py-4 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl font-medium transition-all duration-200"
                    >
                      <Pencil className="w-5 h-5" />
                      Edit Member Details
                    </button>
                    <button
                      onClick={handleDeleteMember}
                      className="flex items-center justify-center gap-3 px-6 py-4 bg-white dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded-xl font-medium transition-all duration-200"
                    >
                      <Trash2 className="w-5 h-5" />
                      Delete Member Completely
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                    <p className="text-gray-500 dark:text-gray-400 text-center">
                      You are in viewer mode. Contact an admin to perform actions.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {contributions.length > 0 && (
              <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-8">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <Award className="w-5 h-5 text-maroon-600" />
                  Contribution History <span className="text-gray-400 font-normal ml-2">({contributions.length})</span>
                </h3>
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-gray-700"></div>

                  <div className="space-y-6">
                    {contributions.map((contribution) => (
                      <div
                        key={contribution.id}
                        className="relative pl-16 group"
                      >
                        {/* Timeline dot */}
                        <div className="absolute left-4 top-4 w-4 h-4 rounded-full bg-white dark:bg-dark-bg border-4 border-maroon-600 z-10"></div>

                        <div className="p-5 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 hover:border-maroon-200 dark:hover:border-maroon-500/30 transition-all hover:shadow-md">
                          <div className="flex flex-col sm:flex-row justify-between items-start mb-2 gap-2">
                            <div>
                              <h4 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-maroon-600 dark:group-hover:text-neon-blue transition-colors">
                                {contribution.project_name}
                              </h4>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <span className="text-xs font-bold px-2 py-0.5 bg-maroon-50 dark:bg-maroon-900/30 text-maroon-700 dark:text-maroon-300 rounded uppercase tracking-wide">
                                  {contribution.position}
                                </span>
                                {contribution.avenue && (
                                  <span className="text-xs font-medium px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded">
                                    {contribution.avenue}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-xl font-black text-maroon-600 dark:text-neon-blue bg-maroon-50 dark:bg-maroon-900/20 px-3 py-1 rounded-lg">
                              +{contribution.points}
                            </span>
                          </div>
                          <div className="flex flex-wrap justify-between items-end mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              <span className="font-medium text-gray-900 dark:text-white">Period:</span> {contribution.time_period}
                            </div>
                            <div className="text-xs text-gray-400">
                              Added: {new Date(contribution.date_added).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        !loading && !memberNotFound && (
          <div className="glass-panel rounded-xl overflow-hidden shadow-xl">
            {/* Header area with filters */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-white/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <Award className="w-7 h-7 text-maroon-600" />
                  Leaderboard
                </h2>

                {/* Leaderboard Type Toggle */}
                <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg self-start md:self-auto">
                  <button
                    onClick={() => setLeaderboardType('all-time')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${leaderboardType === 'all-time'
                      ? 'bg-white dark:bg-gray-600 text-maroon-600 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                  >
                    All Time
                  </button>
                  <button
                    onClick={() => setLeaderboardType('monthly')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${leaderboardType === 'monthly'
                      ? 'bg-white dark:bg-gray-600 text-maroon-600 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                {leaderboardType === 'monthly' && (
                  <div className="flex-none">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Month
                    </label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full md:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500 outline-none"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Filter by Faculty
                  </label>
                  <select
                    value={selectedFaculty}
                    onChange={(e) => setSelectedFaculty(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500 outline-none"
                  >
                    <option value="">All Faculties</option>
                    {uniqueFaculties.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Filter by Batch
                  </label>
                  <select
                    value={selectedBatch}
                    onChange={(e) => setSelectedBatch(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500 outline-none"
                  >
                    <option value="">All Batches</option>
                    {uniqueBatches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                {(selectedFaculty || selectedBatch) && (
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setSelectedFaculty('');
                        setSelectedBatch('');
                      }}
                      className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>

            {loadingMembers ? (
              <div className="p-12 flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon-600"></div>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <User className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No members found</h3>
                <p className="mt-1">Try adjusting your filters or search criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16 text-center">Rank</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Member</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Reg No</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Faculty / Batch</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Points</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {filteredMembers.map((member, index) => (
                      <tr
                        key={member.reg_no}
                        className={`
                            hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group
                            ${index < 3 ? 'bg-gradient-to-r from-transparent via-transparent' : ''}
                            ${index === 0 ? 'to-yellow-50/50 dark:to-yellow-500/5' : ''}
                            ${index === 1 ? 'to-gray-50/50 dark:to-gray-500/5' : ''}
                            ${index === 2 ? 'to-orange-50/50 dark:to-orange-500/5' : ''}
                        `}
                      >
                        <td className="px-6 py-4">
                          <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mx-auto
                            ${index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400 ring-2 ring-yellow-400/30' :
                              index === 1 ? 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300 ring-2 ring-gray-400/30' :
                                index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 ring-2 ring-orange-400/30' :
                                  'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5'}
                          `}>
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            {member.photo_url ? (
                              <img
                                src={member.photo_url}
                                alt={member.name_with_initials}
                                crossOrigin="anonymous"
                                className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-white/10 shadow-sm"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                {member.name_with_initials.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-gray-900 dark:text-white group-hover:text-maroon-600 dark:group-hover:text-neon-blue transition-colors">
                                {member.name_with_initials}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 lg:hidden">
                                {member.batch} • {member.faculty.split('of ').pop()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">
                          {member.reg_no}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                          <div className="flex flex-col">
                            <span className="font-medium">{member.faculty}</span>
                            <span className="text-xs text-gray-400">{member.batch}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-black text-lg ${index < 3 ? 'text-maroon-600 dark:text-neon-blue' : 'text-gray-700 dark:text-gray-300'}`}>
                            {member.total_points}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleViewMember(member)}
                            className="bg-white dark:bg-white/10 hover:bg-maroon-50 dark:hover:bg-maroon-900/40 text-gray-700 dark:text-gray-200 hover:text-maroon-700 dark:hover:text-white border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}

      {/* Forms and Modals remain identical ... just ensuring I don't delete them. */}
      {showNewMemberForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="glass-panel rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white/95 dark:bg-dark-surface/95 backdrop-blur border-b border-gray-200 dark:border-dark-border p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Register New Member
              </h2>
              <button
                onClick={() => setShowNewMemberForm(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <NewMemberForm
                initialRegNo={searchQuery}
                onSuccess={handleMemberCreated}
                onCancel={() => setShowNewMemberForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      {showEditMemberForm && searchResult && (
        <EditMemberForm
          member={searchResult}
          onSuccess={handleMemberUpdated}
          onCancel={() => setShowEditMemberForm(false)}
        />
      )}

      {showAddContribution && searchResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="glass-panel rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white/95 dark:bg-dark-surface/95 backdrop-blur border-b border-gray-200 dark:border-dark-border p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Add Contribution
              </h2>
              <button
                onClick={() => setShowAddContribution(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <AddContributionForm
                member={searchResult}
                onSuccess={handleContributionAdded}
                onCancel={() => setShowAddContribution(false)}
              />
            </div>
          </div>
        </div>
      )}

      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          onSuccess={handleBulkImportSuccess}
        />
      )}

      {showBulkProjectContribution && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="glass-panel rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white/95 dark:bg-dark-surface/95 backdrop-blur border-b border-gray-200 dark:border-dark-border p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Add Project Contributions (Bulk)
              </h2>
              <button
                onClick={() => setShowBulkProjectContribution(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <BulkProjectContributionForm
                onSuccess={() => {
                  setShowBulkProjectContribution(false);
                  loadMembers();
                }}
                onCancel={() => setShowBulkProjectContribution(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
