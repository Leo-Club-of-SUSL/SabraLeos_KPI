import { useState, useEffect } from 'react';
import { logService } from '../services/log-service';
import { Clock, User, Info, FileText, Search, Loader2 } from 'lucide-react';

export function SystemLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await logService.getLogs();
      setLogs(data);
    } catch (err) {
      console.error('Error loading logs:', err);
      setError('Failed to load system logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.user_name?.toLowerCase().includes(filter.toLowerCase()) ||
    log.action?.toLowerCase().includes(filter.toLowerCase()) ||
    log.entity_id?.toLowerCase().includes(filter.toLowerCase())
  );

  const getActionColor = (action: string) => {
    if (action.includes('CREATE') || action.includes('ADD')) return 'text-green-600 dark:text-green-400';
    if (action.includes('DELETE') || action.includes('REMOVE')) return 'text-red-600 dark:text-red-400';
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'text-blue-600 dark:text-blue-400';
    if (action === 'LOGIN') return 'text-purple-600 dark:text-purple-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-maroon-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by user, action, or ID..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <button
          onClick={loadLogs}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
        >
          Refresh Logs
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50">
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timestamp</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entity</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors duration-200">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Clock className="w-4 h-4" />
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                    <User className="w-4 h-4 text-gray-400" />
                    {log.user_name || 'System'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-sm font-bold ${getActionColor(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <FileText className="w-4 h-4" />
                    {log.entity_type ? `${log.entity_type} [${log.entity_id || 'N/A'}]` : 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={JSON.stringify(log.details)}>
                    <Info className="w-4 h-4 flex-shrink-0" />
                    {log.details ? (typeof log.details === 'object' ? JSON.stringify(log.details) : log.details) : 'No details'}
                  </div>
                </td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No logs found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
