import { useState, useEffect } from 'react';
import { contributionService } from '../services/contribution-service';
import { systemService } from '../services/system-service';
import { Loader2 } from 'lucide-react';
import { sanitizeTextInput, validatePoints } from '../lib/sanitize';
import type { Member, Avenue } from '../types/database';

interface AddContributionFormProps {
  member: Member;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddContributionForm({ member, onSuccess, onCancel }: AddContributionFormProps) {
  const [formData, setFormData] = useState({
    project_name: '',
    time_period: '',
    position: '',
    points: '',
    avenue: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [avenues, setAvenues] = useState<Avenue[]>([]);

  useEffect(() => {
    systemService.getAvenues().then(setAvenues);
  }, []);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.project_name.trim()) errors.project_name = 'Project Name is required';
    if (!formData.time_period.trim()) errors.time_period = 'Time Period is required';
    if (!formData.position.trim()) errors.position = 'Position is required';
    
    const parsedPoints = parseInt(formData.points, 10);
    const pointsValidation = validatePoints(parsedPoints);
    if (!pointsValidation.valid) {
      errors.points = pointsValidation.error || 'Invalid points';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setError('');
    setLoading(true);

    try {
      await contributionService.create({
        member_reg_no: member.reg_no,
        project_name: sanitizeTextInput(formData.project_name),
        time_period: formData.time_period,
        position: sanitizeTextInput(formData.position),
        points: parseInt(formData.points, 10),
        avenue: formData.avenue || null,
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contribution');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-maroon-50 dark:bg-maroon-900/20 rounded-lg p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">Member</p>
        <p className="font-semibold text-gray-900 dark:text-white">
          {member.name_with_initials}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{member.reg_no}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Project Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.project_name}
          onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
          required
          placeholder="World Diabetes Day Campaign"
          maxLength={200}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        {fieldErrors.project_name && <p className="mt-1 text-xs text-red-500">{fieldErrors.project_name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Time Period <span className="text-red-500">*</span>
        </label>
        <input
          type="month"
          value={formData.time_period}
          onChange={(e) => setFormData({ ...formData, time_period: e.target.value })}
          required
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        {fieldErrors.time_period && <p className="mt-1 text-xs text-red-500">{fieldErrors.time_period}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Position / Role <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.position}
          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
          required
          placeholder="Project Coordinator"
          maxLength={100}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        {fieldErrors.position && <p className="mt-1 text-xs text-red-500">{fieldErrors.position}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Points <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          value={formData.points}
          onChange={(e) => setFormData({ ...formData, points: e.target.value })}
          required
          min="1"
          max="1000"
          placeholder="10"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        {fieldErrors.points && <p className="mt-1 text-xs text-red-500">{fieldErrors.points}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Avenue / Category
        </label>
        <select
          value={formData.avenue}
          onChange={(e) => setFormData({ ...formData, avenue: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">Select Avenue (Optional)</option>
          {avenues.map((avenue) => (
            <option key={avenue.id} value={avenue.name}>
              {avenue.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-6 py-3 bg-maroon-600 hover:bg-maroon-700 disabled:bg-maroon-400 text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Adding...
            </>
          ) : (
            'Add Contribution'
          )}
        </button>
      </div>
    </form>
  );
}
