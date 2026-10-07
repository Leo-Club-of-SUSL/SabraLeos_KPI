import { usePermissions } from '../hooks/usePermissions';
import { OfficerDashboard } from './OfficerDashboard';
import { MemberDashboard } from '../components/MemberDashboard';

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

  if (isMember) {
    return <MemberDashboard />;
  }

  return <OfficerDashboard onNavigate={onNavigate} />;
}
