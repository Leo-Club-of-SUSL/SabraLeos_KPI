import { getTierProgress, getAllTiers } from '../lib/tier-calculator';
import { TierBadge } from './TierBadge';
import { Sparkles, Trophy } from 'lucide-react';

interface TierProgressBarProps {
  points: number;
  showSteps?: boolean;
  className?: string;
}

export function TierProgressBar({ points, showSteps = true, className = '' }: TierProgressBarProps) {
  const progress = getTierProgress(points);
  const allTiers = getAllTiers();

  return (
    <div className={`p-5 rounded-2xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 shadow-sm space-y-4 ${className}`}>
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <TierBadge tierKey={progress.currentTier.key} size="md" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Current Standing</span>
        </div>

        {progress.nextTier ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
            <span>Next:</span>
            <TierBadge tierKey={progress.nextTier.key} size="sm" />
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-300">
            <Trophy className="w-3.5 h-3.5 text-purple-600" /> Max Tier Achieved
          </span>
        )}
      </div>

      {/* Progress Track */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-bold">
          <span className="text-gray-700 dark:text-gray-300">
            {progress.currentPoints} <span className="font-normal text-gray-500">pts</span>
          </span>
          {progress.nextTier ? (
            <span className="text-maroon-600 dark:text-neon-blue">
              {progress.pointsToNext} pts to {progress.nextTier.name}
            </span>
          ) : (
            <span className="text-purple-600 dark:text-purple-400">Pinnacle Echelon</span>
          )}
        </div>

        {/* Bar */}
        <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden p-0.5 border border-gray-200 dark:border-gray-700">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${progress.currentTier.gradient} transition-all duration-700 shadow-sm`}
            style={{ width: `${progress.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Checkpoint Steps */}
      {showSteps && (
        <div className="pt-2 border-t border-gray-100 dark:border-white/5">
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-maroon-500" /> Tier Milestones
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {allTiers.map((t) => {
              const isAchieved = points >= t.minPoints;
              const isCurrent = progress.currentTier.key === t.key;
              return (
                <div
                  key={t.key}
                  className={`p-2 rounded-xl text-center border transition-all ${
                    isCurrent
                      ? 'bg-maroon-50/80 dark:bg-maroon-900/20 border-maroon-500 dark:border-neon-blue shadow-sm ring-1 ring-maroon-500/30'
                      : isAchieved
                      ? 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-gray-700 opacity-90'
                      : 'bg-gray-50/40 dark:bg-white/2 border-dashed border-gray-200 dark:border-gray-800 opacity-50'
                  }`}
                >
                  <p className={`text-[11px] font-bold truncate ${isCurrent ? 'text-maroon-700 dark:text-neon-blue' : 'text-gray-800 dark:text-gray-200'}`}>
                    {t.shortName}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                    {t.minPoints}+
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
