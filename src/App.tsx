import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Navbar } from './components/Navbar';
import { initializeDatabase } from './lib/db-init';
import { Loader2 } from 'lucide-react';
import { usePermissions } from './hooks/usePermissions';
import { ChunkErrorBoundary } from './components/ChunkErrorBoundary';
import { PageSkeleton } from './components/PageSkeleton';

// Page-level and modal components lazy loaded
const LoginScreen = lazy(() =>
  import('./components/LoginScreen').then(m => ({ default: m.LoginScreen }))
);
const SetPassword = lazy(() =>
  import('./pages/SetPassword').then(m => ({ default: m.SetPassword }))
);
const ForgotPassword = lazy(() =>
  import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword }))
);
const Dashboard = lazy(() =>
  import('./pages/Dashboard').then(m => ({ default: m.Dashboard }))
);
const Members = lazy(() =>
  import('./pages/Members').then(m => ({ default: m.Members }))
);
const Reports = lazy(() =>
  import('./pages/Reports').then(m => ({ default: m.Reports }))
);
const UserManagement = lazy(() =>
  import('./pages/UserManagement').then(m => ({ default: m.UserManagement }))
);
const AccountNotFound = lazy(() =>
  import('./components/AccountNotFound').then(m => ({ default: m.AccountNotFound }))
);

function AppContent() {
  const { user, appUser, loading } = useAuth();
  const { isMember } = usePermissions();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [pageData, setPageData] = useState<unknown>(null);

  const [dbInitialized, setDbInitialized] = useState(true);
  const [schemaMismatch, setSchemaMismatch] = useState<string | null>(null);

  // Check URL hash, path, or search query for auth routes (invite acceptance, password reset, PKCE auth codes)
  const isAuthRoute = () => {
    const hash = window.location.hash || '';
    const path = window.location.pathname || '';
    const search = window.location.search || '';

    if (
      hash.includes('set-password') ||
      path.includes('/auth/set-password') ||
      path.includes('set-password') ||
      hash.includes('type=recovery') ||
      hash.includes('type=invite') ||
      hash.includes('type=signup') ||
      hash.includes('access_token=') ||
      search.includes('type=recovery') ||
      search.includes('type=invite') ||
      search.includes('type=signup') ||
      search.includes('token_hash') ||
      search.includes('code=')
    ) {
      return 'set-password';
    }
    if (hash.includes('forgot-password') || path.includes('/auth/forgot-password') || search.includes('forgot-password')) {
      return 'forgot-password';
    }
    return null;
  };

  const [authRoute, setAuthRoute] = useState<string | null>(isAuthRoute());

  useEffect(() => {
    const handleUrlChange = () => {
      setAuthRoute(isAuthRoute());
    };
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Post-render background initialization (db check, tier thresholds, schema check)
  useEffect(() => {
    const initStartup = async () => {
      try {
        const [initialized, { systemService }] = await Promise.all([
          initializeDatabase(),
          import('./services/system-service'),
        ]);
        setDbInitialized(initialized);

        if (initialized) {
          const [, schemaStatus] = await Promise.all([
            systemService.getTierThresholds().catch(e => {
              console.warn('Could not load tier thresholds on init:', e);
            }),
            systemService.checkSchemaVersion().catch(() => ({ matches: true, current: null, expected: '' })),
          ]);

          if (schemaStatus && !schemaStatus.matches && schemaStatus.current) {
            setSchemaMismatch(`Database schema version mismatch (current: ${schemaStatus.current}, expected: ${schemaStatus.expected}). Please apply latest migrations.`);
          }
        }
      } catch (e) {
        console.warn('Startup background initialization note:', e);
      }
    };

    initStartup();
  }, []);

  // Prefetch landing page chunk after login based on role
  useEffect(() => {
    if (user && appUser) {
      if (appUser.role === 'member') {
        import('./components/MemberDashboard').catch(() => {});
      } else {
        import('./pages/OfficerDashboard').catch(() => {});
      }
    }
  }, [user, appUser]);

  const handleNavigate = (page: string, data?: unknown) => {
    setCurrentPage(page);
    setPageData(data);
  };

  return (
    <ChunkErrorBoundary>
      {schemaMismatch && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-xs font-medium text-amber-700 dark:text-amber-400">
          {schemaMismatch}
        </div>
      )}
      {authRoute === 'set-password' ? (
        <Suspense fallback={<PageSkeleton />}>
          <SetPassword />
        </Suspense>
      ) : authRoute === 'forgot-password' ? (
        <Suspense fallback={<PageSkeleton />}>
          <ForgotPassword />
        </Suspense>
      ) : loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center glass-panel p-8 rounded-2xl">
            <Loader2 className="w-12 h-12 animate-spin text-maroon-600 dark:text-neon-blue mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300 font-medium">Loading SabraLeos...</p>
          </div>
        </div>
      ) : !dbInitialized ? (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="glass-panel rounded-xl p-8 max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Database Setup Required
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              The database tables have not been set up yet. Please run the SQL migration script in
              your Supabase SQL Editor.
            </p>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-700">
              <code className="text-sm text-neon-blue">
                Check the supabase/migrations folder for the SQL script
              </code>
            </div>
          </div>
        </div>
      ) : !user ? (
        <Suspense fallback={<PageSkeleton />}>
          <LoginScreen />
        </Suspense>
      ) : !appUser ? (
        <Suspense fallback={<PageSkeleton />}>
          <AccountNotFound />
        </Suspense>
      ) : (
        <>
          <Navbar currentPage={currentPage} onNavigate={handleNavigate} />
          <main className="container mx-auto px-4 py-6 max-w-7xl">
            <Suspense fallback={<PageSkeleton />}>
              {(currentPage === 'dashboard' || (isMember && currentPage !== 'dashboard')) && (
                <Dashboard onNavigate={handleNavigate} />
              )}
              {currentPage === 'members' && !isMember && (
                <Members
                  initialSearch={(pageData as { search?: string })?.search}
                  initialAction={(pageData as { action?: string })?.action}
                  initialTier={(pageData as { tier?: string })?.tier}
                />
              )}
              {currentPage === 'reports' && !isMember && <Reports />}
              {currentPage === 'users' && appUser.role === 'super_admin' && <UserManagement />}
            </Suspense>
          </main>
        </>
      )}
    </ChunkErrorBoundary>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
