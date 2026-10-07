import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTier,
  getTierProgress,
  getAllTiers,
  setCustomTierThresholds,
  resetTierThresholdsToDefault,
  getActiveTierThresholds,
  DEFAULT_TIER_THRESHOLDS,
} from '../tier-calculator';

describe('tier-calculator', () => {
  beforeEach(() => {
    resetTierThresholdsToDefault();
  });

  describe('getTier', () => {
    it('returns Prospect for 0 to 49 points', () => {
      expect(getTier(0).key).toBe('prospect');
      expect(getTier(25).key).toBe('prospect');
      expect(getTier(49).key).toBe('prospect');
    });

    it('returns Official Member for 50 to 149 points', () => {
      expect(getTier(50).key).toBe('official');
      expect(getTier(100).key).toBe('official');
      expect(getTier(149).key).toBe('official');
    });

    it('returns Bronze Leo for 150 to 299 points', () => {
      expect(getTier(150).key).toBe('bronze');
      expect(getTier(200).key).toBe('bronze');
      expect(getTier(299).key).toBe('bronze');
    });

    it('returns Silver Leo for 300 to 499 points', () => {
      expect(getTier(300).key).toBe('silver');
      expect(getTier(400).key).toBe('silver');
      expect(getTier(499).key).toBe('silver');
    });

    it('returns Gold Leo for 500 to 799 points', () => {
      expect(getTier(500).key).toBe('gold');
      expect(getTier(650).key).toBe('gold');
      expect(getTier(799).key).toBe('gold');
    });

    it('returns Platinum Leo for 800+ points', () => {
      expect(getTier(800).key).toBe('platinum');
      expect(getTier(1200).key).toBe('platinum');
    });

    it('handles negative or invalid points gracefully', () => {
      expect(getTier(-10).key).toBe('prospect');
      // @ts-expect-error test undefined
      expect(getTier(undefined).key).toBe('prospect');
    });
  });

  describe('custom tier thresholds', () => {
    it('allows updating point thresholds dynamically', () => {
      setCustomTierThresholds({
        official: 100,
        bronze: 250,
        silver: 500,
        gold: 750,
        platinum: 1000,
      });

      expect(getTier(50).key).toBe('prospect');
      expect(getTier(100).key).toBe('official');
      expect(getTier(200).key).toBe('official');
      expect(getTier(250).key).toBe('bronze');
      expect(getTier(1000).key).toBe('platinum');

      const active = getActiveTierThresholds();
      expect(active.official).toBe(100);
      expect(active.platinum).toBe(1000);
    });

    it('resets to default thresholds correctly', () => {
      setCustomTierThresholds({ official: 80, platinum: 1500 });
      resetTierThresholdsToDefault();
      expect(getActiveTierThresholds()).toEqual(DEFAULT_TIER_THRESHOLDS);
      expect(getTier(50).key).toBe('official');
    });
  });

  describe('getTierProgress', () => {
    it('calculates progress accurately within a tier', () => {
      const progress = getTierProgress(100);
      expect(progress.currentTier.key).toBe('official');
      expect(progress.nextTier?.key).toBe('bronze');
      expect(progress.pointsToNext).toBe(50); // 150 - 100
      expect(progress.progressPercent).toBe(50); // (100-50)/(150-50) = 50%
    });

    it('returns 100% progress for Platinum top tier', () => {
      const progress = getTierProgress(900);
      expect(progress.currentTier.key).toBe('platinum');
      expect(progress.nextTier).toBeNull();
      expect(progress.pointsToNext).toBe(0);
      expect(progress.progressPercent).toBe(100);
    });
  });

  describe('getAllTiers', () => {
    it('returns all 6 tiers in ascending order', () => {
      const tiers = getAllTiers();
      expect(tiers).toHaveLength(6);
      expect(tiers.map(t => t.key)).toEqual(['prospect', 'official', 'bronze', 'silver', 'gold', 'platinum']);
    });
  });
});

