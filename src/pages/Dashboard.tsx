import { lazy, Suspense } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { PageSkeleton } from '../components/PageSkeleton';

const OfficerDashboard = lazy(() =>
  import('./OfficerDashboard').then(m => ({ default: m.OfficerDashboard }))
);
const MemberDashboard = lazy(() =>
  import('../components/MemberDashboard').then(m => ({ default: m.MemberDashboard }))
);

interface DashboardProps {
  onNavigate?: (page: string, data?: unknown) => void;
}

/**
 * Dashboard Router Middleware
 * Automatically routes authenticated users to their corresponding dashboard:
 * - Members: Dedicated privacy-focused Member Portal (Personal Contributions, Rank, Leaderboard & Self-Service Password Change)
 * - Officers (Super Admin, Editor, Officer): Executive Overview (Club Statistics, Add Contributions, Management Breakdown)
 */
export function Dashboard({ onNavigate }: DashboardProps) {
  const { isMember } = usePermissions();

  return (
    <Suspense fallback={<PageSkeleton />}>
      {isMember ? <MemberDashboard /> : <OfficerDashboard onNavigate={onNavigate} />}
    </Suspense>
  );
}
