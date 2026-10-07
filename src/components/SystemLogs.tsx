import { useState, useEffect, useMemo } from 'react';
import { logService } from '../services/log-service';
import { 
  Clock, User, FileText, Search, Loader2, ShieldAlert, 
  Activity, Shield, Filter, Download, X, AlertTriangle, CheckCircle2,
  Calendar, Layers, Eye
} from 'lucide-react';

export type LogStreamTab = 'all' | 'security' | 'activity';
export type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

export interface UnifiedLogEntry {
  id: string;
  source: 'security' | 'activity';
  timestamp: string;
  actor_name: string;
  actor_id?: string | null;
  action: string;
  category: 'auth' | 'member' | 'points' | 'tier' | 'system' | 'access' | 'other';
  severity: 'info' | 'warning' | 'high' | 'critical';
  entity_type?: string | null;
  entity_id?: string | null;
  ip_address?: string | null;
  details: Record<string, unknown> | null;
}

export function SystemLogs() {
  const [rawActivityLogs, setRawActivityLogs] = useState<Array<Record<string, unknown>>>([]);
  const [rawSecurityLogs, setRawSecurityLogs] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [activeTab, setActiveTab] = useState<LogStreamTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  
  // Modal detail view
  const [selectedLog, setSelectedLog] = useState<UnifiedLogEntry | null>(null);

  const loadAllLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const [activity, security] = await Promise.all([
        logService.getLogs().catch(() => []),
        logService.getSecurityEvents().catch(() => []),
      ]);
      setRawActivityLogs(activity as Array<Record<string, unknown>>);
      setRawSecurityLogs(security as Array<Record<string, unknown>>);
    } catch (err) {
      console.error('Error loading logs:', err);
      setError('Failed to load system logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllLogs();
  }, []);

  // Transform raw logs into normalized UnifiedLogEntry list
  const unifiedLogs: UnifiedLogEntry[] = useMemo(() => {
    const activityItems: UnifiedLogEntry[] = rawActivityLogs.map((item) => {
      const act = String(item.action || 'UNKNOWN');
      let cat: UnifiedLogEntry['category'] = 'other';
      let sev: UnifiedLogEntry['severity'] = 'info';

      if (act.includes('LOGIN')) cat = 'auth';
      else if (act.includes('MEMBER')) cat = 'member';
      else if (act.includes('CONTRIBUTION') || act.includes('POINT')) cat = 'points';
      else if (act.includes('TIER')) cat = 'tier';
      else if (act.includes('FACULTY') || act.includes('BATCH') || act.includes('AVENUE')) cat = 'system';
      else if (act.includes('USER') || act.includes('ROLE')) cat = 'access';

      if (act.includes('DELETE') || act.includes('REMOVE')) sev = 'warning';
      if (act.includes('DROP') || act.includes('PURGE')) sev = 'high';

      return {
        id: `act-${item.id || Math.random()}`,
        source: 'activity',
        timestamp: String(item.timestamp || item.created_at || new Date().toISOString()),
        actor_name: String(item.user_name || 'System Operator'),
        actor_id: (item.user_id as string) || null,
        action: act,
        category: cat,
        severity: sev,
        entity_type: (item.entity_type as string) || null,
        entity_id: (item.entity_id as string) || null,
        ip_address: (item.ip_address as string) || null,
        details: (item.details as Record<string, unknown>) || null,
      };
    });

    const securityItems: UnifiedLogEntry[] = rawSecurityLogs.map((item) => {
      const evt = String(item.event_type || 'SECURITY_EVENT');
      let sev: UnifiedLogEntry['severity'] = 'info';
      let cat: UnifiedLogEntry['category'] = 'auth';

      if (evt.includes('FAILED') || evt.includes('LOCKOUT') || evt.includes('SUSPEND') || evt.includes('SCHEMA')) {
        sev = 'warning';
      }
      if (evt.includes('PRIVILEGE') || evt.includes('BREACH') || evt.includes('CRITICAL') || evt.includes('ESCALATION')) {
        sev = 'critical';
      }
      if (evt.includes('DELETE') || evt.includes('REVOKE')) {
        sev = 'high';
      }

      if (evt.includes('TIER')) cat = 'tier';
      else if (evt.includes('ROLE') || evt.includes('PRIVILEGE') || evt.includes('USER')) cat = 'access';

      return {
        id: `sec-${item.id || Math.random()}`,
        source: 'security',
        timestamp: String(item.created_at || new Date().toISOString()),
        actor_name: (item.actor_id as string) ? `Officer (${String(item.actor_id).substring(0, 8)})` : 'Security Guardian',
        actor_id: (item.actor_id as string) || null,
        action: evt,
        category: cat,
        severity: sev,
        entity_type: 'Security Event',
        entity_id: (item.user_id as string) || null,
        ip_address: (item.ip_address as string) || null,
        details: (item.details as Record<string, unknown>) || null,
      };
    });

    // Merge and sort desc by timestamp
    return [...activityItems, ...securityItems].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [rawActivityLogs, rawSecurityLogs]);

  // Apply active stream tab, search, severity, and time filters
  const filteredLogs = useMemo(() => {
    return unifiedLogs.filter((log) => {
      // 1. Stream Tab Filter
      if (activeTab === 'security' && log.source !== 'security') return false;
      if (activeTab === 'activity' && log.source !== 'activity') return false;

      // 2. Severity Filter
      if (severityFilter === 'critical' && !(log.severity === 'critical' || log.severity === 'high')) return false;
      if (severityFilter === 'warning' && log.severity !== 'warning') return false;
      if (severityFilter === 'info' && log.severity !== 'info') return false;

      // 3. Time Filter
      if (timeFilter !== 'all') {
        const logTime = new Date(log.timestamp).getTime();
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        if (timeFilter === 'today' && now - logTime > dayMs) return false;
        if (timeFilter === '7days' && now - logTime > 7 * dayMs) return false;
        if (timeFilter === '30days' && now - logTime > 30 * dayMs) return false;
      }

      // 4. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const actorMatch = log.actor_name.toLowerCase().includes(query);
        const actionMatch = log.action.toLowerCase().includes(query);
        const entityMatch = log.entity_id?.toLowerCase().includes(query) || log.entity_type?.toLowerCase().includes(query);
        const detailsMatch = log.details ? JSON.stringify(log.details).toLowerCase().includes(query) : false;
        const ipMatch = log.ip_address?.toLowerCase().includes(query);

        if (!actorMatch && !actionMatch && !entityMatch && !detailsMatch && !ipMatch) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedLogs, activeTab, severityFilter, timeFilter, searchQuery]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Timestamp', 'Log Source', 'Severity', 'Category', 'Action/Event', 'Actor', 'Entity/Target', 'IP Address', 'Details'];
    const rows = filteredLogs.map((l) => [
      `"${new Date(l.timestamp).toISOString()}"`,
      `"${l.source}"`,
      `"${l.severity}"`,
      `"${l.category}"`,
      `"${l.action}"`,
      `"${l.actor_name.replace(/"/g, '""')}"`,
      `"${(l.entity_id || l.entity_type || 'N/A').replace(/"/g, '""')}"`,
      `"${l.ip_address || 'N/A'}"`,
      `"${(l.details ? JSON.stringify(l.details) : '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SabraLeos_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSeverityBadge = (severity: UnifiedLogEntry['severity'], source: UnifiedLogEntry['source']) => {
    if (severity === 'critical') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-sm animate-pulse">
          <AlertTriangle className="w-3 h-3" /> Critical
        </span>
      );
    }
    if (severity === 'high') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-600 text-white">
          <ShieldAlert className="w-3 h-3" /> High
        </span>
      );
    }
    if (severity === 'warning') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <AlertTriangle className="w-3 h-3" /> Warning
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
        source === 'security'
          ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
          : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10'
      }`}>
        {source === 'security' ? <Shield className="w-3 h-3 text-blue-500" /> : <Activity className="w-3 h-3 text-gray-400" />} Info
      </span>
    );
  };

  const getActionHighlight = (action: string, source: UnifiedLogEntry['source']) => {
    if (source === 'security') {
      return 'text-purple-600 dark:text-neon-blue font-mono font-bold';
    }
    if (action.includes('CREATE') || action.includes('ADD')) return 'text-emerald-600 dark:text-emerald-400 font-bold';
    if (action.includes('DELETE') || action.includes('REMOVE')) return 'text-red-600 dark:text-red-400 font-bold';
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'text-blue-600 dark:text-blue-400 font-bold';
    return 'text-gray-800 dark:text-gray-200 font-bold';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-10 h-10 animate-spin text-maroon-600 dark:text-neon-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Stream Tabs & Quick Action Bar */}
      <div className="glass-panel p-4 rounded-3xl border border-gray-200/80 dark:border-white/10 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Stream Segmented Controls */}
          <div className="flex bg-gray-100/90 dark:bg-black/40 p-1 rounded-2xl border border-gray-200/60 dark:border-white/5 gap-1 flex-wrap">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-200 ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-gray-800 text-maroon-600 dark:text-neon-blue shadow-md border border-gray-200/50 dark:border-white/10 scale-[1.02]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-white/5'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>All Logs</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-gray-200/80 dark:bg-white/10 text-gray-700 dark:text-gray-300">
                {unifiedLogs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-200 ${
                activeTab === 'security'
                  ? 'bg-white dark:bg-gray-800 text-maroon-600 dark:text-neon-blue shadow-md border border-gray-200/50 dark:border-white/10 scale-[1.02]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-white/5'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-purple-500" />
              <span>Security & Threats</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
                {rawSecurityLogs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('activity')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-200 ${
                activeTab === 'activity'
                  ? 'bg-white dark:bg-gray-800 text-maroon-600 dark:text-neon-blue shadow-md border border-gray-200/50 dark:border-white/10 scale-[1.02]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-white/5'
              }`}
            >
              <Activity className="w-4 h-4 text-emerald-500" />
              <span>User Activity</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                {rawActivityLogs.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              title="Download filtered logs as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            <button
              onClick={loadAllLogs}
              className="px-4 py-2.5 text-xs font-bold text-maroon-600 dark:text-neon-blue bg-maroon-50 dark:bg-neon-blue/10 hover:bg-maroon-100 dark:hover:bg-neon-blue/20 rounded-xl transition-all shadow-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-3 border-t border-gray-200/80 dark:border-white/10">
          <div className="lg:col-span-5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by action, user, entity ID, or details payload..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-maroon-500 bg-white/90 dark:bg-dark-bg text-gray-900 dark:text-white text-xs font-medium outline-none shadow-sm"
            />
          </div>

          <div className="lg:col-span-4 flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white/90 dark:bg-dark-bg text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-maroon-500 outline-none shadow-sm"
            >
              <option value="all">All Severity Levels</option>
              <option value="critical">🔴 Critical & High Threats</option>
              <option value="warning">🟡 Warnings & Lockouts</option>
              <option value="info">🟢 Standard Operational Info</option>
            </select>
          </div>

          <div className="lg:col-span-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as 'all' | 'today' | '7days' | '30days')}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white/90 dark:bg-dark-bg text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-maroon-500 outline-none shadow-sm"
            >
              <option value="all">All Time History</option>
              <option value="today">Today (Last 24h)</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-red-600 dark:text-red-400 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Logs Table Card */}
      <div className="glass-panel overflow-hidden rounded-3xl border border-gray-200/80 dark:border-white/10 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/90 dark:bg-white/5 border-b border-gray-200/80 dark:border-white/5">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stream & Severity</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action / Event</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actor</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target / Entity</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filteredLogs.map((log) => (
                <tr 
                  key={log.id} 
                  onClick={() => setSelectedLog(log)}
                  className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors duration-150 cursor-pointer group"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-xs font-mono text-gray-600 dark:text-gray-300">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getSeverityBadge(log.severity, log.source)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-xs ${getActionHighlight(log.action, log.source)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-900 dark:text-white">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate max-w-[160px]">{log.actor_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 font-mono">
                      <FileText className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate max-w-[180px]">
                        {log.entity_id || log.entity_type || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLog(log);
                      }}
                      className="p-1.5 text-gray-400 hover:text-maroon-600 dark:hover:text-neon-blue hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                      title="Inspect Event Payload"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-xs text-gray-500 dark:text-gray-400">
                    <CheckCircle2 className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-50" />
                    <p className="font-bold text-gray-700 dark:text-gray-300">No logs found matching your filter criteria</p>
                    <p className="text-[11px] mt-1">Try clearing your search query or adjusting the severity level.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Details Modal / Inspector */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-xl w-full border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-900 to-maroon-950 p-5 flex items-center justify-between text-white border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  {selectedLog.source === 'security' ? <ShieldAlert className="w-5 h-5 text-neon-blue" /> : <Activity className="w-5 h-5 text-emerald-400" />}
                </div>
                <div>
                  <h3 className="font-bold text-base">{selectedLog.action}</h3>
                  <p className="text-xs text-gray-300 font-mono">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 text-xs">
                <div>
                  <span className="text-gray-400 font-semibold uppercase text-[10px] block">Stream Type</span>
                  <span className="font-bold capitalize">{selectedLog.source} Log</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold uppercase text-[10px] block">Severity Level</span>
                  <div className="mt-0.5">{getSeverityBadge(selectedLog.severity, selectedLog.source)}</div>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold uppercase text-[10px] block">Actor</span>
                  <span className="font-bold">{selectedLog.actor_name}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold uppercase text-[10px] block">Target / Entity</span>
                  <span className="font-mono">{selectedLog.entity_id || selectedLog.entity_type || 'N/A'}</span>
                </div>
                {selectedLog.ip_address && (
                  <div className="col-span-2">
                    <span className="text-gray-400 font-semibold uppercase text-[10px] block">Source IP</span>
                    <span className="font-mono">{selectedLog.ip_address}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block mb-2">
                  Structured Payload Data
                </span>
                <pre className="p-4 bg-gray-900 text-emerald-400 rounded-2xl text-xs font-mono overflow-x-auto border border-gray-800 max-h-60 leading-relaxed">
                  {selectedLog.details ? JSON.stringify(selectedLog.details, null, 2) : '// No additional payload metadata provided'}
                </pre>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-xl text-xs transition-colors"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
