import { describe, it, expect } from 'vitest';
import { computeMemberProjectCounts, getCurrentRotaryYearRange } from '../Reports';
import type { Contribution } from '../../types/database';

// Legacy Oracle Function from Reports.tsx lines 202-205 (O(N*M) per frame)
function legacyGetMemberProjectCount(regNo: string, contributions: Contribution[]): number {
  const memberContribs = contributions.filter((c) => c.member_reg_no === regNo);
  return new Set(memberContribs.map((c) => c.project_name)).size;
}

describe('Reports Page Optimizations & Oracle Parity', () => {
  it('computes member project count Map with results identical to legacy O(N*M) oracle', () => {
    // Synthetic fixture dataset with multiple members, overlapping projects, repeated projects
    const fixtureContributions: Contribution[] = [
      { id: '1', member_reg_no: '20ABC001', project_name: 'Blood Donation', time_period: '2026-07', position: 'Chair', points: 50, avenue: 'Health', date_added: '2026-07-15T00:00:00Z', added_by: null },
      { id: '2', member_reg_no: '20ABC001', project_name: 'Blood Donation', time_period: '2026-07', position: 'Member', points: 20, avenue: 'Health', date_added: '2026-07-16T00:00:00Z', added_by: null }, // same project, distinct entry
      { id: '3', member_reg_no: '20ABC001', project_name: 'Tree Planting', time_period: '2026-08', position: 'Lead', points: 40, avenue: 'Environment', date_added: '2026-08-10T00:00:00Z', added_by: null },
      { id: '4', member_reg_no: '20ABC002', project_name: 'Blood Donation', time_period: '2026-07', position: 'Volunteer', points: 15, avenue: 'Health', date_added: '2026-07-15T00:00:00Z', added_by: null },
      { id: '5', member_reg_no: '20ABC002', project_name: 'Book Drive', time_period: '2026-09', position: 'Coordinator', points: 35, avenue: 'Education', date_added: '2026-09-01T00:00:00Z', added_by: null },
      { id: '6', member_reg_no: '20ABC002', project_name: 'Tech Workshop', time_period: '2026-09', position: 'Speaker', points: 50, avenue: 'Professional', date_added: '2026-09-20T00:00:00Z', added_by: null },
      { id: '7', member_reg_no: '20ABC003', project_name: 'Beach Cleanup', time_period: '2026-10', position: 'Volunteer', points: 20, avenue: 'Environment', date_added: '2026-10-05T00:00:00Z', added_by: null },
    ];

    const testMembers = ['20ABC001', '20ABC002', '20ABC003', '20ABC999']; // 999 has 0 contributions

    // Compute via new optimized Map function
    const optimizedMap = computeMemberProjectCounts(fixtureContributions);

    // Verify against Oracle for every member
    for (const regNo of testMembers) {
      const oracleCount = legacyGetMemberProjectCount(regNo, fixtureContributions);
      const optimizedCount = optimizedMap.get(regNo) || 0;

      expect(optimizedCount).toBe(oracleCount);
    }

    // Explicit checks
    expect(optimizedMap.get('20ABC001')).toBe(2); // Blood Donation (2x) + Tree Planting = 2 unique projects
    expect(optimizedMap.get('20ABC002')).toBe(3); // 3 unique projects
    expect(optimizedMap.get('20ABC003')).toBe(1); // 1 project
    expect(optimizedMap.get('20ABC999')).toBeUndefined(); // 0 projects
  });

  it('calculates the current Rotary Year date boundaries correctly', () => {
    // Test date in October 2026
    const octoberDate = new Date(2026, 9, 7); // month index 9 = October
    const range = getCurrentRotaryYearRange(octoberDate);

    expect(range.startDate).toBe('2026-07-01');
    expect(range.endDate).toBe('2027-06-30');
    expect(range.label).toBe('2026/2027 Rotary Year');

    // Test date in February 2027
    const febDate = new Date(2027, 1, 15); // month index 1 = February
    const febRange = getCurrentRotaryYearRange(febDate);

    expect(febRange.startDate).toBe('2026-07-01');
    expect(febRange.endDate).toBe('2027-06-30');
    expect(febRange.label).toBe('2026/2027 Rotary Year');
  });
});
