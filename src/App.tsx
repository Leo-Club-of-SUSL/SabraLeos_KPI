import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LoginScreen } from './components/LoginScreen';

import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Members } from './pages/Members';
import { Reports } from './pages/Reports';
import { UserManagement } from './pages/UserManagement';
import { AccountNotFound } from './components/AccountNotFound';
import { initializeDatabase, seedMockData } from './lib/db-init';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, appUser, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [pageData, setPageData] = useState<unknown>(null);
  const [dbInitialized, setDbInitialized] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);

  useEffect(() => {
    const initDB = async () => {
      const initialized = await initializeDatabase();
      setDbInitialized(initialized);

      if (initialized) {
        // await seedMockData();
      }

      setDbLoading(false);
    };

    initDB();
  }, []);

  const handleNavigate = (page: string, data?: unknown) => {
    setCurrentPage(page);
    setPageData(data);
  };

  if (loading || dbLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center glass-panel p-8 rounded-2xl">
          <Loader2 className="w-12 h-12 animate-spin text-maroon-600 dark:text-neon-blue mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300 font-medium">Loading SabraLeos...</p>
        </div>
      </div>
    );
  }

  if (!dbInitialized) {
    return (
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
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (!appUser) {
    return <AccountNotFound />;
  }

  return (
    <>
      <Navbar currentPage={currentPage} onNavigate={handleNavigate} />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {currentPage === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
        {currentPage === 'members' && (
          <Members
            initialSearch={(pageData as { search?: string })?.search}
            initialAction={(pageData as { action?: string })?.action}
          />
        )}
        {currentPage === 'reports' && <Reports />}
        {currentPage === 'users' && appUser.role === 'super_admin' && <UserManagement />}
      </main>
    </>
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
