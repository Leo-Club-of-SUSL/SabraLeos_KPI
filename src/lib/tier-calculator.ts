import { useState, useEffect } from 'react';

/**
 * Member Standing & Tier Calculation System
 *
 * Configurable Tiers:
 * - Prospect (< official threshold points)
 * - Official Member (default 50+ points)
 * - Bronze Leo (default 150+ points)
 * - Silver Leo (default 300+ points)
 * - Gold Leo (default 500+ points)
 * - Platinum Leo (default 800+ points)
 */

export type TierKey = 'prospect' | 'official' | 'bronze' | 'silver' | 'gold' | 'platinum';

export interface TierThresholds {
  prospect: number;
  official: number;
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}

export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  prospect: 0,
  official: 50,
  bronze: 150,
  silver: 300,
  gold: 500,
  platinum: 800,
};

const STORAGE_KEY = 'nexus_tier_thresholds';

function loadCachedThresholds(): TierThresholds {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          typeof parsed.official === 'number' &&
          typeof parsed.bronze === 'number' &&
          typeof parsed.silver === 'number' &&
          typeof parsed.gold === 'number' &&
          typeof parsed.platinum === 'number'
        ) {
          return {
            prospect: 0,
            official: parsed.official,
            bronze: parsed.bronze,
            silver: parsed.silver,
            gold: parsed.gold,
            platinum: parsed.platinum,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Failed to read cached tier thresholds', err);
  }
  return { ...DEFAULT_TIER_THRESHOLDS };
}

let activeThresholds: TierThresholds = loadCachedThresholds();
const listeners = new Set<() => void>();

export interface TierInfo {
  key: TierKey;
  name: string;
  shortName: string;
  minPoints: number;
  nextTierKey: TierKey | null;
  nextTierPoints: number | null;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  gradient: string;
  glowColor: string;
  description: string;
}

export const TIERS_CONFIG: Record<TierKey, TierInfo> = {
  prospect: {
    key: 'prospect',
    name: 'Prospect Leo',
    shortName: 'Prospect',
    minPoints: 0,
    nextTierKey: 'official',
    nextTierPoints: activeThresholds.official,
    badgeBg: 'bg-slate-100 dark:bg-slate-800/60',
    badgeText: 'text-slate-700 dark:text-slate-300',
    badgeBorder: 'border-slate-300 dark:border-slate-700',
    gradient: 'from-slate-500 to-slate-700',
    glowColor: 'shadow-slate-500/20',
    description: 'New applicant / prospective member completing initial service activities.',
  },
  official: {
    key: 'official',
    name: 'Official Member',
    shortName: 'Official',
    minPoints: activeThresholds.official,
    nextTierKey: 'bronze',
    nextTierPoints: activeThresholds.bronze,
    badgeBg: 'bg-sky-100 dark:bg-sky-950/50',
    badgeText: 'text-sky-800 dark:text-sky-300',
    badgeBorder: 'border-sky-300 dark:border-sky-800',
    gradient: 'from-sky-500 to-blue-600',
    glowColor: 'shadow-sky-500/25',
    description: 'Officially inducted Leo with active club participation.',
  },
  bronze: {
    key: 'bronze',
    name: 'Bronze Leo',
    shortName: 'Bronze',
    minPoints: activeThresholds.bronze,
    nextTierKey: 'silver',
    nextTierPoints: activeThresholds.silver,
    badgeBg: 'bg-amber-100 dark:bg-amber-950/50',
    badgeText: 'text-amber-800 dark:text-amber-300',
    badgeBorder: 'border-amber-300 dark:border-amber-800',
    gradient: 'from-amber-600 to-orange-700',
    glowColor: 'shadow-amber-600/30',
    description: 'Committed contributor demonstrating sustained project engagement.',
  },
  silver: {
    key: 'silver',
    name: 'Silver Leo',
    shortName: 'Silver',
    minPoints: activeThresholds.silver,
    nextTierKey: 'gold',
    nextTierPoints: activeThresholds.gold,
    badgeBg: 'bg-slate-200 dark:bg-slate-700/60',
    badgeText: 'text-slate-800 dark:text-slate-200',
    badgeBorder: 'border-slate-400 dark:border-slate-600',
    gradient: 'from-slate-400 to-zinc-600',
    glowColor: 'shadow-slate-400/30',
    description: 'High-performing Leo with distinguished leadership and service.',
  },
  gold: {
    key: 'gold',
    name: 'Gold Leo',
    shortName: 'Gold',
    minPoints: activeThresholds.gold,
    nextTierKey: 'platinum',
    nextTierPoints: activeThresholds.platinum,
    badgeBg: 'bg-yellow-100 dark:bg-yellow-950/60',
    badgeText: 'text-yellow-800 dark:text-yellow-300',
    badgeBorder: 'border-yellow-400 dark:border-yellow-700',
    gradient: 'from-amber-400 via-yellow-500 to-yellow-600',
    glowColor: 'shadow-yellow-500/40',
    description: 'Outstanding club pillar with exceptional dedication and impact.',
  },
  platinum: {
    key: 'platinum',
    name: 'Platinum Leo',
    shortName: 'Platinum',
    minPoints: activeThresholds.platinum,
    nextTierKey: null,
    nextTierPoints: null,
    badgeBg: 'bg-purple-100 dark:bg-purple-950/60',
    badgeText: 'text-purple-900 dark:text-purple-300',
    badgeBorder: 'border-purple-300 dark:border-purple-800',
    gradient: 'from-purple-500 via-fuchsia-500 to-indigo-600',
    glowColor: 'shadow-purple-500/40',
    description: 'Pinnacle standing — highest echelon of service excellence in SabraLeos.',
  },
};

function syncTiersConfig() {
  TIERS_CONFIG.prospect.nextTierPoints = activeThresholds.official;
  TIERS_CONFIG.official.minPoints = activeThresholds.official;
  TIERS_CONFIG.official.nextTierPoints = activeThresholds.bronze;
  TIERS_CONFIG.bronze.minPoints = activeThresholds.bronze;
  TIERS_CONFIG.bronze.nextTierPoints = activeThresholds.silver;
  TIERS_CONFIG.silver.minPoints = activeThresholds.silver;
  TIERS_CONFIG.silver.nextTierPoints = activeThresholds.gold;
  TIERS_CONFIG.gold.minPoints = activeThresholds.gold;
  TIERS_CONFIG.gold.nextTierPoints = activeThresholds.platinum;
  TIERS_CONFIG.platinum.minPoints = activeThresholds.platinum;
}

export function getActiveTierThresholds(): TierThresholds {
  return { ...activeThresholds };
}

export function setCustomTierThresholds(thresholds: Partial<TierThresholds>): void {
  activeThresholds = {
    prospect: 0,
    official: typeof thresholds.official === 'number' ? thresholds.official : activeThresholds.official,
    bronze: typeof thresholds.bronze === 'number' ? thresholds.bronze : activeThresholds.bronze,
    silver: typeof thresholds.silver === 'number' ? thresholds.silver : activeThresholds.silver,
    gold: typeof thresholds.gold === 'number' ? thresholds.gold : activeThresholds.gold,
    platinum: typeof thresholds.platinum === 'number' ? thresholds.platinum : activeThresholds.platinum,
  };

  syncTiersConfig();

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activeThresholds));
    }
  } catch (err) {
    console.warn('Failed to cache tier thresholds in localStorage', err);
  }

  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error executing tier threshold listener', e);
    }
  });
}

export function resetTierThresholdsToDefault(): void {
  setCustomTierThresholds(DEFAULT_TIER_THRESHOLDS);
}

export function onTierThresholdsChange(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function useTierThresholds(): TierThresholds {
  const [thresholds, setThresholds] = useState<TierThresholds>(() => getActiveTierThresholds());

  useEffect(() => {
    return onTierThresholdsChange(() => {
      setThresholds(getActiveTierThresholds());
    });
  }, []);

  return thresholds;
}

export const TIERS_ORDER: TierKey[] = ['prospect', 'official', 'bronze', 'silver', 'gold', 'platinum'];

/**
 * Calculates current tier from points.
 */
export function getTier(points: number): TierInfo {
  const pts = Math.max(0, points || 0);
  if (pts >= activeThresholds.platinum) return TIERS_CONFIG.platinum;
  if (pts >= activeThresholds.gold) return TIERS_CONFIG.gold;
  if (pts >= activeThresholds.silver) return TIERS_CONFIG.silver;
  if (pts >= activeThresholds.bronze) return TIERS_CONFIG.bronze;
  if (pts >= activeThresholds.official) return TIERS_CONFIG.official;
  return TIERS_CONFIG.prospect;
}

export interface TierProgress {
  currentTier: TierInfo;
  nextTier: TierInfo | null;
  pointsToNext: number;
  currentPoints: number;
  progressPercent: number;
}

/**
 * Calculates progress towards the next tier.
 */
export function getTierProgress(points: number): TierProgress {
  const pts = Math.max(0, points || 0);
  const current = getTier(pts);

  if (!current.nextTierKey) {
    // Top tier
    return {
      currentTier: current,
      nextTier: null,
      pointsToNext: 0,
      currentPoints: pts,
      progressPercent: 100,
    };
  }

  const next = TIERS_CONFIG[current.nextTierKey];
  const pointsInCurrentTier = pts - current.minPoints;
  const tierSpan = next.minPoints - current.minPoints;
  const pointsToNext = Math.max(0, next.minPoints - pts);
  const progressPercent = tierSpan > 0
    ? Math.min(100, Math.max(0, Math.round((pointsInCurrentTier / tierSpan) * 100)))
    : 100;

  return {
    currentTier: current,
    nextTier: next,
    pointsToNext,
    currentPoints: pts,
    progressPercent,
  };
}

/**
 * Returns all tiers in ascending order.
 */
export function getAllTiers(): TierInfo[] {
  return TIERS_ORDER.map((k) => TIERS_CONFIG[k]);
}

