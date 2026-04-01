import { useState, useEffect } from 'react';
import { contributionService } from '../services/contribution-service';
import { memberService } from '../services/member-service';
import { systemService } from '../services/system-service';
import { Loader2, Search, UserPlus, Trash2, Info } from 'lucide-react';
import { sanitizeTextInput, validatePoints } from '../lib/sanitize';
import type { Member, Avenue } from '../types/database';

interface BulkProjectContributionFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface SelectedMember {
  member: Member;
  position: string;
  points: number;
}

export function BulkProjectContributionForm({ onSuccess, onCancel }: BulkProjectContributionFormProps) {
  const [projectData, setProjectData] = useState({
    project_name: '',
    time_period: '',
    avenue: '',
    default_position: '',
    default_points: '10',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [avenues, setAvenues] = useState<Avenue[]>([]);

  useEffect(() => {
    systemService.getAvenues().then(setAvenues);
  }, []);

  // Search members when query changes
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const results = await memberService.search(searchQuery);
          // Filter out already selected members
          setSearchResults(results.filter(m => !selectedMembers.find(sm => sm.member.reg_no === m.reg_no)));
        } catch (err) {
          console.error('Search failed', err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedMembers]);

  const addMember = (member: Member) => {
    setSelectedMembers([
      ...selectedMembers,
      {
        member,
        position: projectData.default_position,
        points: parseInt(projectData.default_points) || 0,
      }
    ]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeMember = (regNo: string) => {
    setSelectedMembers(selectedMembers.filter(sm => sm.member.reg_no !== regNo));
  };

  const updateMemberDetail = (regNo: string, field: 'position' | 'points', value: string | number) => {
    setSelectedMembers(selectedMembers.map(sm => {
      if (sm.member.reg_no === regNo) {
        return { ...sm, [field]: value };
      }
      return sm;
    }));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!projectData.project_name.trim()) errors.project_name = 'Project Name is required';
    if (!projectData.time_period.trim()) errors.time_period = 'Time Period is required';
    if (selectedMembers.length === 0) errors.members = 'At least one member must be selected';

    selectedMembers.forEach((sm, index) => {
      if (!sm.position.trim()) {
        errors[`member_${index}_position`] = 'Position is required';
      }
      const pointsValidation = validatePoints(sm.points);
      if (!pointsValidation.valid) {
        errors[`member_${index}_points`] = pointsValidation.error || 'Invalid points';
      }
    });

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setError('');
    setLoading(true);

    try {
      const contributions = selectedMembers.map(sm => ({
        member_reg_no: sm.member.reg_no,
        project_name: sanitizeTextInput(projectData.project_name),
        time_period: projectData.time_period,
        position: sanitizeTextInput(sm.position),
        points: sm.points,
        avenue: projectData.avenue || null,
      }));

      await contributionService.createMany(contributions);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contributions');
    } finally {
      setLoading(false);
    }
  };

  const applyDefaults = () => {
    setSelectedMembers(selectedMembers.map(sm => ({
      ...sm,
      position: projectData.default_position || sm.position,
      points: parseInt(projectData.default_points) || sm.points,
    })));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Project Details Section */}
      <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-maroon-600 px-6 py-3">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Info className="w-5 h-5" />
            Project Details
          </h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={projectData.project_name}
              onChange={(e) => setProjectData({ ...projectData, project_name: e.target.value })}
              required
              placeholder="e.g., Annual Health Camp 2024"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {fieldErrors.project_name && <p className="mt-1 text-xs text-red-500">{fieldErrors.project_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time Period <span className="text-red-500">*</span>
            </label>
            <input
              type="month"
              value={projectData.time_period}
              onChange={(e) => setProjectData({ ...projectData, time_period: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Avenue / Category
            </label>
            <select
              value={projectData.avenue}
              onChange={(e) => setProjectData({ ...projectData, avenue: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select Avenue (Optional)</option>
              {avenues.map((avenue) => (
                <option key={avenue.id} value={avenue.name}>{avenue.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Defaults & Member Search Section */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-end bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
              Default Position
            </label>
            <input
              type="text"
              value={projectData.default_position}
              onChange={(e) => setProjectData({ ...projectData, default_position: e.target.value })}
              placeholder="e.g., Volunteer"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="w-full md:w-32">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
              Default Points
            </label>
            <input
              type="number"
              value={projectData.default_points}
              onChange={(e) => setProjectData({ ...projectData, default_points: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={applyDefaults}
            className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors whitespace-nowrap"
          >
            Apply to All
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search members by name or registration number..."
            className="w-full pl-10 pr-4 py-3 border-2 border-maroon-100 dark:border-maroon-900/30 rounded-xl focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          {isSearching && (
            <div className="absolute right-3 top-3">
              <Loader2 className="w-6 h-6 animate-spin text-maroon-600" />
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="absolute z-20 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
              {searchResults.map((member) => (
                <button
                  key={member.reg_no}
                  type="button"
                  onClick={() => addMember(member)}
                  className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b last:border-0 border-gray-100 dark:border-gray-700"
                >
                  <div className="w-8 h-8 rounded-full bg-maroon-100 dark:bg-maroon-900/40 flex items-center justify-center text-maroon-700 dark:text-maroon-300 font-bold text-xs">
                    {member.name_with_initials.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm text-gray-900 dark:text-white">{member.name_with_initials}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{member.reg_no} • {member.batch}</p>
                  </div>
                  <UserPlus className="ml-auto w-4 h-4 text-maroon-600" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Members Table */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center justify-between">
          <span>Target Members ({selectedMembers.length})</span>
          {fieldErrors.members && <span className="text-sm font-normal text-red-500">{fieldErrors.members}</span>}
        </h3>
        
        {selectedMembers.length === 0 ? (
          <div className="py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center text-gray-400">
            <UserPlus className="w-12 h-12 mb-2 opacity-20" />
            <p>Search and select members to add them to this project</p>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-left bg-white dark:bg-transparent">
              <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Member</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Role / Position</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Points</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {selectedMembers.map((sm, index) => (
                  <tr key={sm.member.reg_no} className="hover:bg-gray-50/50 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1">{sm.member.name_with_initials}</span>
                        <span className="text-xs text-gray-500">{sm.member.reg_no}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={sm.position}
                        onChange={(e) => updateMemberDetail(sm.member.reg_no, 'position', e.target.value)}
                        placeholder="Project Role"
                        className={`w-full px-3 py-1.5 text-sm border ${fieldErrors[`member_${index}_position`] ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} rounded bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={sm.points}
                        onChange={(e) => updateMemberDetail(sm.member.reg_no, 'points', parseInt(e.target.value) || 0)}
                        className={`w-full px-3 py-1.5 text-sm border ${fieldErrors[`member_${index}_points`] ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} rounded bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-center`}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeMember(sm.member.reg_no)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
           <Info className="w-4 h-4" />
           {error}
          </p>
        </div>
      )}

      <div className="flex gap-4 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || selectedMembers.length === 0}
          className="flex-[2] px-6 py-4 bg-maroon-600 hover:bg-maroon-700 disabled:bg-maroon-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-maroon-600/20 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Processing Bulk Addition...
            </>
          ) : (
            `Add Contributions to ${selectedMembers.length} Members`
          )}
        </button>
      </div>
    </form>
  );
}
