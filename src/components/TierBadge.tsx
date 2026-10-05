import { Shield, Sparkles, Award, Crown, Medal, UserCheck } from 'lucide-react';
import { getTier, type TierKey, type TierInfo } from '../lib/tier-calculator';

interface TierBadgeProps {
  points?: number;
  tierKey?: TierKey;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showPoints?: boolean;
  className?: string;
}

export function TierBadge({
  points,
  tierKey,
  size = 'md',
  showIcon = true,
  showPoints = false,
  className = '',
}: TierBadgeProps) {
  const tier: TierInfo = tierKey ? getTier(getMinPointsForTier(tierKey)) : getTier(points ?? 0);

  const getTierIcon = () => {
    const iconSize = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
    switch (tier.key) {
      case 'platinum':
        return <Crown className={`${iconSize} text-purple-600 dark:text-purple-400`} />;
      case 'gold':
        return <Award className={`${iconSize} text-yellow-600 dark:text-yellow-400`} />;
      case 'silver':
        return <Medal className={`${iconSize} text-slate-600 dark:text-slate-300`} />;
      case 'bronze':
        return <Shield className={`${iconSize} text-amber-700 dark:text-amber-400`} />;
      case 'official':
        return <UserCheck className={`${iconSize} text-sky-600 dark:text-sky-400`} />;
      case 'prospect':
      default:
        return <Sparkles className={`${iconSize} text-slate-500 dark:text-slate-400`} />;
    }
  };

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px] gap-1',
    sm: 'px-2.5 py-0.5 text-xs gap-1.5',
    md: 'px-3 py-1 text-xs gap-2 font-semibold',
    lg: 'px-4 py-1.5 text-sm gap-2.5 font-bold',
  };

  return (
    <span
      title={`${tier.name} (${tier.minPoints}+ points) — ${tier.description}`}
      className={`inline-flex items-center rounded-full border shadow-sm transition-all duration-200 ${tier.badgeBg} ${tier.badgeText} ${tier.badgeBorder} ${sizeClasses[size]} ${className}`}
    >
      {showIcon && getTierIcon()}
      <span>{tier.name}</span>
      {showPoints && (
        <span className="opacity-75 font-normal ml-0.5">({tier.minPoints}+ pts)</span>
      )}
    </span>
  );
}

function getMinPointsForTier(key: TierKey): number {
  switch (key) {
    case 'platinum': return 800;
    case 'gold': return 500;
    case 'silver': return 300;
    case 'bronze': return 150;
    case 'official': return 50;
    case 'prospect': return 0;
  }
}
