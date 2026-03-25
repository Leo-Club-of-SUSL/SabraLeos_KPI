import { useState, useEffect } from 'react';
import { memberService } from '../services/member-service';
import { contributionService } from '../services/contribution-service';
import { systemService } from '../services/system-service';
import { Filter, Download, Calendar, Users as UsersIcon, TrendingUp } from 'lucide-react';
import type { Member, Contribution, Faculty } from '../types/database';
import { ExportOptionsModal, type ColumnOption } from '../components/ExportOptionsModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function Reports() {
  const [members, setMembers] = useState<Member[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    minProjects: '',
    faculty: '',
  });


  const loadData = async () => {
    try {
      const [membersData, contributionsData, facultiesData] = await Promise.all([
        memberService.getAll(),
        contributionService.getAll(),
        systemService.getFaculties(),
      ]);

      setMembers(membersData);
      setContributions(contributionsData);
      setFaculties(facultiesData);
      setFilteredMembers(membersData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadData();
  }, []);


  useEffect(() => {
    let filtered = [...members];

    if (filters.faculty) {
      filtered = filtered.filter((m) => m.faculty === filters.faculty);
    }

    if (filters.startDate || filters.endDate || filters.minProjects) {
      const memberContributions = new Map<string, Contribution[]>();

      contributions.forEach((contrib) => {
        if (!memberContributions.has(contrib.member_reg_no)) {
          memberContributions.set(contrib.member_reg_no, []);
        }
        memberContributions.get(contrib.member_reg_no)!.push(contrib);
      });

      filtered = filtered.filter((member) => {
        const memberContribs = memberContributions.get(member.reg_no) || [];

        let dateFiltered = memberContribs;
        if (filters.startDate) {
          dateFiltered = dateFiltered.filter(
            (c) => new Date(c.date_added) >= new Date(filters.startDate)
          );
        }
        if (filters.endDate) {
          dateFiltered = dateFiltered.filter(
            (c) => new Date(c.date_added) <= new Date(filters.endDate + 'T23:59:59')
          );
        }

        const projectCount = new Set(dateFiltered.map((c) => c.project_name)).size;

        if (filters.minProjects) {
          return projectCount >= parseInt(filters.minProjects, 10);
        }

        return true;
      });
    }

    setFilteredMembers(filtered);
  }, [filters, members, contributions]);





  const [showExportModal, setShowExportModal] = useState(false);

  const availableColumns: ColumnOption[] = [
    { key: 'reg_no', label: 'Reg No' },
    { key: 'name_with_initials', label: 'Name' },
    { key: 'faculty', label: 'Faculty' },
    { key: 'batch', label: 'Batch' },
    { key: 'total_points', label: 'Total Points' },
    { key: 'project_count', label: 'Project Count' },
    { key: 'whatsapp', label: 'WhatsApp' },
  ];

  const handleExport = (selectedColumns: string[], includeHeaders: boolean, format: 'csv' | 'pdf') => {
    const memberContributions = new Map<string, number>();
    contributions.forEach((contrib) => {
      const current = memberContributions.get(contrib.member_reg_no) || 0;
      memberContributions.set(contrib.member_reg_no, current + 1);
    });

    const headers = selectedColumns.map(key => availableColumns.find(c => c.key === key)?.label || key);

    const rows = filteredMembers.map((member) => {
      return selectedColumns.map(key => {
        if (key === 'project_count') return memberContributions.get(member.reg_no) || 0;
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
      // PDF Export
      const doc = new jsPDF();

      // Add Title
      doc.setFontSize(18);
      doc.setTextColor(128, 0, 0); // Maroon color
      doc.text('Nexus KPI - Member Report', 14, 22);

      // Add Date
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

      // Add Filters Info if any
      const activeFilters = [];
      if (filters.faculty) activeFilters.push(`Faculty: ${filters.faculty}`);
      if (filters.startDate) activeFilters.push(`Start: ${filters.startDate}`);
      if (filters.endDate) activeFilters.push(`End: ${filters.endDate}`);
      if (filters.minProjects) activeFilters.push(`Min Projects: ${filters.minProjects}`);

      if (activeFilters.length > 0) {
        doc.text(`Filters: ${activeFilters.join(', ')}`, 14, 36);
      }

      // Generate Table
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: activeFilters.length > 0 ? 42 : 36,
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [128, 0, 0], // Maroon
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [249, 245, 245], // Light maroon tint
        },
      });

      doc.save(`nexus-report-${new Date().toISOString().split('T')[0]}.pdf`);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  const getMemberProjectCount = (regNo: string): number => {
    const memberContribs = contributions.filter((c) => c.member_reg_no === regNo);
    return new Set(memberContribs.map((c) => c.project_name)).size;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Filter and analyze member contributions
          </p>
        </div>

        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg font-medium transition-colors duration-200 shadow-md"
        >
          <Download className="w-5 h-5" />
          Export to CSV
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-maroon-600 dark:text-maroon-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        </div>

        {(filters.startDate || filters.endDate || filters.minProjects || filters.faculty) && (
          <button
            onClick={() => setFilters({ startDate: '', endDate: '', minProjects: '', faculty: '' })}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Faculty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Batch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Projects
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Points
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {member.faculty}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {member.batch}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {getMemberProjectCount(member.reg_no)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-maroon-600 dark:text-maroon-400">
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
    </div >
  );
}
