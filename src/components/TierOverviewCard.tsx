import { getAllTiers } from '../lib/tier-calculator';
import { TierBadge } from './TierBadge';
import { Award, CheckCircle2 } from 'lucide-react';

export function TierOverviewCard() {
  const tiers = getAllTiers();

  return (
    <div className="glass-panel rounded-2xl p-6 border border-gray-200 dark:border-white/10 shadow-lg space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-maroon-600 to-amber-600 flex items-center justify-center text-white shadow-md">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Member Standing Categories
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Recognition tiers based on verified service and project contributions
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiers.map((tier) => (
          <div
            key={tier.key}
            className="p-4 rounded-xl bg-gray-50/70 dark:bg-white/5 border border-gray-200 dark:border-gray-700/80 hover:border-maroon-300 dark:hover:border-neon-blue/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <TierBadge tierKey={tier.key} size="sm" />
                <span className="text-xs font-mono font-bold text-maroon-600 dark:text-neon-blue">
                  {tier.minPoints}+ pts
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mt-2">
                {tier.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200/60 dark:border-gray-700/50 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                {tier.nextTierPoints
                  ? `Next Tier at ${tier.nextTierPoints} pts`
                  : 'Highest Echelon Standing'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
