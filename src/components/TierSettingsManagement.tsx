import { useState, useEffect } from 'react';
import { Award, Save, RotateCcw, AlertCircle, CheckCircle2, Shield, Crown, Medal, UserCheck } from 'lucide-react';
import { systemService } from '../services/system-service';
import {
  type TierThresholds,
  DEFAULT_TIER_THRESHOLDS,
  useTierThresholds,
  TIERS_CONFIG,
} from '../lib/tier-calculator';
import { TierBadge } from './TierBadge';

export function TierSettingsManagement() {
  const currentThresholds = useTierThresholds();
  const [formData, setFormData] = useState<TierThresholds>(currentThresholds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<import('../services/system-service').TierPreviewResult | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    setFormData(currentThresholds);
  }, [currentThresholds]);

  const handleChange = (key: keyof TierThresholds, value: string) => {
    const num = parseInt(value, 10);
    setFormData(prev => ({
      ...prev,
      [key]: isNaN(num) ? 0 : num,
    }));
    setError(null);
    setSuccess(null);
  };

  const handleRequestPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (formData.official <= 0) {
      setError('Official Member threshold must be greater than 0.');
      return;
    }
    if (formData.bronze <= formData.official) {
      setError('Bronze Leo threshold must be greater than Official Member threshold.');
      return;
    }
    if (formData.silver <= formData.bronze) {
      setError('Silver Leo threshold must be greater than Bronze Leo threshold.');
      return;
    }
    if (formData.gold <= formData.silver) {
      setError('Gold Leo threshold must be greater than Silver Leo threshold.');
      return;
    }
    if (formData.platinum <= formData.gold) {
      setError('Platinum Leo threshold must be greater than Gold Leo threshold.');
      return;
    }

    try {
      setSaving(true);
      const impact = await systemService.previewTierChanges(formData);
      setPreviewData(impact);
      setShowPreviewModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview impact of tier changes');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await systemService.updateTierThresholds(formData);
      setShowPreviewModal(false);
      setSuccess('Standing tier point thresholds updated successfully across the entire system!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tier thresholds');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all member standing tier thresholds to system defaults (50, 150, 300, 500, 800)?')) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await systemService.updateTierThresholds(DEFAULT_TIER_THRESHOLDS);
      setFormData(DEFAULT_TIER_THRESHOLDS);
      setSuccess('Standing tier thresholds have been reset to factory defaults.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset thresholds');
    } finally {
      setSaving(false);
    }
  };

  const tiersList = [
    {
      key: 'official' as const,
      label: 'Official Member',
      icon: UserCheck,
      iconColor: 'text-sky-500',
      badgeKey: 'official' as const,
      defaultVal: DEFAULT_TIER_THRESHOLDS.official,
      desc: 'Minimum points required for an applicant to attain Official Member standing.',
    },
    {
      key: 'bronze' as const,
      label: 'Bronze Leo',
      icon: Shield,
      iconColor: 'text-amber-600',
      badgeKey: 'bronze' as const,
      defaultVal: DEFAULT_TIER_THRESHOLDS.bronze,
      desc: 'Milestone points required for committed project participation recognition.',
    },
    {
      key: 'silver' as const,
      label: 'Silver Leo',
      icon: Medal,
      iconColor: 'text-slate-400',
      badgeKey: 'silver' as const,
      defaultVal: DEFAULT_TIER_THRESHOLDS.silver,
      desc: 'Milestone points required for distinguished leadership standing.',
    },
    {
      key: 'gold' as const,
      label: 'Gold Leo',
      icon: Award,
      iconColor: 'text-yellow-500',
      badgeKey: 'gold' as const,
      defaultVal: DEFAULT_TIER_THRESHOLDS.gold,
      desc: 'Milestone points required for pillar / executive contributor recognition.',
    },
    {
      key: 'platinum' as const,
      label: 'Platinum Leo',
      icon: Crown,
      iconColor: 'text-purple-500',
      badgeKey: 'platinum' as const,
      defaultVal: DEFAULT_TIER_THRESHOLDS.platinum,
      desc: 'Highest echelon milestone points for lifetime service excellence.',
    },
  ];

  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-xl">
      <div className="bg-gradient-to-r from-amber-600 via-yellow-600 to-maroon-700 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-white shadow-md">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Member Standing Tier Thresholds
            </h3>
            <p className="text-xs text-amber-100 font-medium">
              Configure points required for each standing category (Admin Only)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          disabled={saving}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold backdrop-blur border border-white/20 transition-all self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Defaults
        </button>
      </div>

      <form onSubmit={handleRequestPreview} className="p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3 text-emerald-700 dark:text-emerald-300 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Prospect Tier (Locked at 0) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex flex-col justify-between opacity-80">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {TIERS_CONFIG.prospect.name}
                </span>
                <TierBadge tierKey="prospect" size="xs" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Entry standing for all new prospective members. Starts at 0 points.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10 flex items-center justify-between">
              <span className="text-xs font-mono text-gray-400">Fixed Min Points</span>
              <span className="text-lg font-black text-gray-700 dark:text-gray-300 font-mono">0 pts</span>
            </div>
          </div>

          {/* Editable Tiers */}
          {tiersList.map((tier) => {
            const Icon = tier.icon;
            const currentVal = formData[tier.key];
            return (
              <div
                key={tier.key}
                className="p-4 rounded-xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 hover:border-maroon-300 dark:hover:border-neon-blue/40 transition-all flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${tier.iconColor}`} />
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {tier.label}
                      </span>
                    </div>
                    <TierBadge tierKey={tier.badgeKey} size="xs" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                    {tier.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={`threshold-${tier.key}`}
                      className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Min Points
                    </label>
                    <span className="text-[11px] text-gray-400">Default: {tier.defaultVal} pts</span>
                  </div>

                  <div className="relative">
                    <input
                      id={`threshold-${tier.key}`}
                      type="number"
                      min="1"
                      max="100000"
                      value={currentVal}
                      onChange={(e) => handleChange(tier.key, e.target.value)}
                      className="w-full px-3 py-2 pr-12 text-lg font-mono font-bold text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50/50 dark:bg-dark-bg focus:ring-2 focus:ring-maroon-500 focus:border-transparent outline-none transition-all"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-gray-400 font-mono">
                      PTS
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-white/10">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            * Threshold changes dynamically recalculate standings, badges, and milestone progress bars for all club members.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 py-3 bg-maroon-600 hover:bg-maroon-700 disabled:bg-maroon-400 text-white font-bold rounded-xl shadow-lg shadow-maroon-600/20 hover:shadow-maroon-600/40 transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Previewing Impact...' : 'Save Standing Thresholds'}
          </button>
        </div>
      </form>

      {/* Impact Confirmation Modal */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Confirm Tier Threshold Update</h3>
                  <p className="text-xs text-gray-500">Preview of impact on active club members</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
                <div>
                  <span className="text-[11px] font-semibold text-gray-500 uppercase">Promotions</span>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">+{previewData.promotions}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-gray-500 uppercase">Demotions</span>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">-{previewData.demotions}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-gray-500 uppercase">Unchanged</span>
                  <p className="text-xl font-bold text-gray-700 dark:text-gray-300">{previewData.unchanged}</p>
                </div>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-300">
                Total evaluated active members: <strong>{previewData.total_members}</strong>. Applying this change will update standing tiers immediately in the database and audit logs.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md"
                >
                  {saving ? 'Applying...' : 'Confirm & Apply'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
