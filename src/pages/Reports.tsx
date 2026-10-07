import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { memberService } from '../services/member-service';
import { contributionService } from '../services/contribution-service';
import { systemService } from '../services/system-service';
import { logService } from '../services/log-service';
import { Filter, Download, Calendar, Users as UsersIcon, TrendingUp, Award, RefreshCw } from 'lucide-react';
import type { Member, Contribution, Faculty } from '../types/database';
import { ExportOptionsModal, type ColumnOption } from '../components/ExportOptionsModal';
import { TierBadge } from '../components/TierBadge';
import { getTier, TIERS_CONFIG } from '../lib/tier-calculator';

export function getCurrentRotaryYearRange(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const startYear = month >= 7 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    startDate: `${startYear}-07-01`,
    endDate: `${endYear}-06-30`,
    label: `${startYear}/${endYear} Rotary Year`,
  };
}

export function computeMemberProjectCounts(contributionsList: Contribution[]): Map<string, number> {
  const map = new Map<string, Set<string>>();
  for (const contrib of contributionsList) {
    let set = map.get(contrib.member_reg_no);
    if (!set) {
      set = new Set<string>();
      map.set(contrib.member_reg_no, set);
    }
    set.add(contrib.project_name);
  }
  const counts = new Map<string, number>();
  for (const [regNo, set] of map.entries()) {
    counts.set(regNo, set.size);
  }
  return counts;
}

export function Reports() {
  const rotaryYear = getCurrentRotaryYearRange();

  const [members, setMembers] = useState<Member[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filters, setFilters] = useState({
    startDate: rotaryYear.startDate,
    endDate: rotaryYear.endDate,
    minProjects: '',
    faculty: '',
    tier: '',
  });

  const deferredFilters = useDeferredValue(filters);

  const loadData = async (start = filters.startDate, end = filters.endDate) => {
    try {
      setRefreshing(true);
      const [membersData, contributionsData, facultiesData] = await Promise.all([
        memberService.getAll(),
        contributionService.getReportContributions(start, end),
        systemService.getFaculties(),
      ]);

      setMembers(membersData);
      setContributions(contributionsData);
      setFaculties(facultiesData);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(filters.startDate, filters.endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.startDate, filters.endDate]);

  // Memoized Map computed once per contributions dataset (O(N) instead of O(N*M))
  const memberProjectCounts = useMemo(() => {
    return computeMemberProjectCounts(contributions);
  }, [contributions]);

  // Filtered members list memoized
  const filteredMembers = useMemo(() => {
    let filtered = members;

    if (deferredFilters.faculty) {
      filtered = filtered.filter((m) => m.faculty === deferredFilters.faculty);
    }

    if (deferredFilters.tier) {
      filtered = filtered.filter((m) => getTier(m.total_points).key === deferredFilters.tier);
    }

    if (deferredFilters.minProjects) {
      const min = parseInt(deferredFilters.minProjects, 10);
      if (!isNaN(min) && min > 0) {
        filtered = filtered.filter((member) => {
          const count = memberProjectCounts.get(member.reg_no) || 0;
          return count >= min;
        });
      }
    }

    return filtered;
  }, [members, deferredFilters, memberProjectCounts]);

  const [showExportModal, setShowExportModal] = useState(false);

  const availableColumns: ColumnOption[] = [
    { key: 'reg_no', label: 'Reg No' },
    { key: 'name_with_initials', label: 'Name' },
    { key: 'tier', label: 'Standing Tier' },
    { key: 'faculty', label: 'Faculty' },
    { key: 'batch', label: 'Batch' },
    { key: 'total_points', label: 'Total Points' },
    { key: 'project_count', label: 'Project Count' },
    { key: 'whatsapp', label: 'WhatsApp' },
  ];

  const handleExport = async (selectedColumns: string[], includeHeaders: boolean, format: 'csv' | 'pdf') => {
    // Page through results in blocks of 1,000 for export accuracy
    const exportContribs = await contributionService.getPagedExportContributions(
      filters.startDate || undefined,
      filters.endDate || undefined
    );
    const exportProjectCounts = computeMemberProjectCounts(exportContribs);

    const headers = selectedColumns.map(key => availableColumns.find(c => c.key === key)?.label || key);

    const rows = filteredMembers.map((member) => {
      return selectedColumns.map(key => {
        if (key === 'project_count') return exportProjectCounts.get(member.reg_no) || 0;
        if (key === 'tier') return getTier(member.total_points).name;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (member as any)[key];
      });
    });

    if (format === 'csv') {
      let csvContent = '';
      if (includeHeaders) {
        csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';
      }
      csvContent += rows
        .map((row) => row.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexus-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.setTextColor(128, 0, 0);
      doc.text('Nexus KPI - Member Report', 14, 22);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

      const activeFilters = [];
      if (filters.faculty) activeFilters.push(`Faculty: ${filters.faculty}`);
      if (filters.tier) activeFilters.push(`Tier: ${TIERS_CONFIG[filters.tier as keyof typeof TIERS_CONFIG]?.name || filters.tier}`);
      if (filters.startDate) activeFilters.push(`Start: ${filters.startDate}`);
      if (filters.endDate) activeFilters.push(`End: ${filters.endDate}`);
      if (filters.minProjects) activeFilters.push(`Min Projects: ${filters.minProjects}`);

      if (activeFilters.length > 0) {
        doc.text(`Filters: ${activeFilters.join(', ')}`, 14, 36);
      }

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: activeFilters.length > 0 ? 42 : 36,
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [128, 0, 0],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [249, 245, 245],
        },
      });

      doc.save(`nexus-report-${new Date().toISOString().split('T')[0]}.pdf`);
    }

    // Log export event server-side
    void logService.logExport({
      report: 'Member Report',
      format,
      count: rows.length,
      columns: selectedColumns,
      filters: {
        faculty: filters.faculty || undefined,
        tier: filters.tier || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        minProjects: filters.minProjects || undefined,
      },
    });
  };

  // Tier counts
  const tierDistribution = useMemo(() => {
    return members.reduce((acc, m) => {
      const t = getTier(m.total_points).key;
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [members]);

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports & Standings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Filter and analyze member contributions and recognition tiers
          </p>
        </div>

        <div className="flex items-center gap-3">
          {refreshing && (
            <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
          )}
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg font-medium transition-colors duration-200 shadow-md"
          >
            <Download className="w-5 h-5" />
            Export Report
          </button>
        </div>
      </div>

      {/* Tier Distribution Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(['platinum', 'gold', 'silver', 'bronze', 'official', 'prospect'] as const).map((tKey) => {
          const t = TIERS_CONFIG[tKey];
          const count = tierDistribution[tKey] || 0;
          return (
            <div
              key={tKey}
              onClick={() => setFilters(f => ({ ...f, tier: f.tier === tKey ? '' : tKey }))}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                filters.tier === tKey
                  ? 'ring-2 ring-maroon-500 bg-maroon-50 dark:bg-maroon-950/40 border-maroon-400'
                  : 'bg-white dark:bg-dark-surface border-gray-200 dark:border-gray-800 hover:border-maroon-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {t.shortName}
                </span>
                <TierBadge tierKey={tKey} size="xs" showIcon={false} />
              </div>
              <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                {count}
              </p>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                {t.minPoints}+ pts
              </p>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-maroon-600 dark:text-maroon-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Presets:</span>
            <button
              onClick={() => setFilters(f => ({ ...f, startDate: rotaryYear.startDate, endDate: rotaryYear.endDate }))}
              className="px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-maroon-100 dark:hover:bg-maroon-950/40 text-gray-700 dark:text-gray-300 font-medium transition-colors"
            >
              Current Rotary Year
            </button>
            <button
              onClick={() => setFilters(f => ({ ...f, startDate: '', endDate: '' }))}
              className="px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-maroon-100 dark:hover:bg-maroon-950/40 text-gray-700 dark:text-gray-300 font-medium transition-colors"
            >
              All Time
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <TrendingUp className="w-4 h-4 inline mr-1" />
              Min Projects
            </label>
            <input
              type="number"
              value={filters.minProjects}
              onChange={(e) => setFilters({ ...filters, minProjects: e.target.value })}
              min="0"
              placeholder="e.g., 3"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <UsersIcon className="w-4 h-4 inline mr-1" />
              Faculty
            </label>
            <select
              value={filters.faculty}
              onChange={(e) => setFilters({ ...filters, faculty: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Faculties</option>
              {faculties.map((f) => (
                <option key={f.id} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Award className="w-4 h-4 inline mr-1" />
              Standing Tier
            </label>
            <select
              value={filters.tier}
              onChange={(e) => setFilters({ ...filters, tier: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Tiers</option>
              <option value="platinum">Platinum Leo (800+)</option>
              <option value="gold">Gold Leo (500+)</option>
              <option value="silver">Silver Leo (300+)</option>
              <option value="bronze">Bronze Leo (150+)</option>
              <option value="official">Official Member (50+)</option>
              <option value="prospect">Prospect (&lt;50)</option>
            </select>
          </div>
        </div>

        {(filters.startDate || filters.endDate || filters.minProjects || filters.faculty || filters.tier) && (
          <button
            onClick={() => setFilters({ startDate: '', endDate: '', minProjects: '', faculty: '', tier: '' })}
            className="mt-4 text-sm text-maroon-600 dark:text-maroon-400 hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Member Report ({filteredMembers.length} members)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Reg No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Standing Tier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Faculty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Batch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Projects
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Points
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No members found matching the filters
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr
                    key={member.reg_no}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {member.reg_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {member.name_with_initials}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <TierBadge points={member.total_points} size="xs" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {member.faculty}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {member.batch}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {memberProjectCounts.get(member.reg_no) || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-maroon-600 dark:text-maroon-400">
                      {member.total_points}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExportOptionsModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        availableColumns={availableColumns}
      />
    </div>
  );
}
