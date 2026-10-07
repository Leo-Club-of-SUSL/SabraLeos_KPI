import { useState, useEffect } from 'react';
import { systemService } from '../services/system-service';
import { Plus, Trash2, Edit2, Check, X, GraduationCap, Calendar, FolderTree } from 'lucide-react';
import type { Faculty, Batch, Avenue } from '../types/database';
import { TierSettingsManagement } from './TierSettingsManagement';

export function SystemDataManagement() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [avenues, setAvenues] = useState<Avenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editing state
  const [editingFacultyId, setEditingFacultyId] = useState<string | null>(null);
  const [editFacultyName, setEditFacultyName] = useState('');
  const [newFacultyName, setNewFacultyName] = useState('');

  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editBatchName, setEditBatchName] = useState('');
  const [newBatchName, setNewBatchName] = useState('');

  const [editingAvenueId, setEditingAvenueId] = useState<string | null>(null);
  const [editAvenueName, setEditAvenueName] = useState('');
  const [newAvenueName, setNewAvenueName] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [fData, bData, aData] = await Promise.all([
        systemService.getFaculties(),
        systemService.getBatches(),
        systemService.getAvenues(),
      ]);
      setFaculties(fData);
      setBatches(bData);
      setAvenues(aData);
    } catch (err) {
      console.error('Error loading system data:', err);
      setError(`Failed to load system data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddFaculty = async () => {
    if (!newFacultyName.trim()) return;
    try {
      await systemService.createFaculty({ name: newFacultyName.trim() });
      setNewFacultyName('');
      loadData();
    } catch {
      alert('Failed to add faculty. It might already exist.');
    }
  };

  const handleUpdateFaculty = async (id: string) => {
    if (!editFacultyName.trim()) return;
    try {
      await systemService.updateFaculty(id, { name: editFacultyName.trim() });
      setEditingFacultyId(null);
      loadData();
    } catch {
      alert('Failed to update faculty.');
    }
  };

  const handleDeleteFaculty = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? Existing members with this faculty won't be affected, but you won't be able to select it for new members.`)) return;
    try {
      await systemService.deleteFaculty(id);
      loadData();
    } catch {
      alert('Failed to delete faculty.');
    }
  };

  const handleAddBatch = async () => {
    if (!newBatchName.trim()) return;
    try {
      await systemService.createBatch({ name: newBatchName.trim() });
      setNewBatchName('');
      loadData();
    } catch {
      alert('Failed to add batch. It might already exist.');
    }
  };

  const handleUpdateBatch = async (id: string) => {
    if (!editBatchName.trim()) return;
    try {
      await systemService.updateBatch(id, { name: editBatchName.trim() });
      setEditingBatchId(null);
      loadData();
    } catch {
      alert('Failed to update batch.');
    }
  };

  const handleDeleteBatch = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete batch "${name}"?`)) return;
    try {
      await systemService.deleteBatch(id);
      loadData();
    } catch {
      alert('Failed to delete batch.');
    }
  };

  const handleAddAvenue = async () => {
    if (!newAvenueName.trim()) return;
    try {
      await systemService.createAvenue({ name: newAvenueName.trim() });
      setNewAvenueName('');
      loadData();
    } catch {
      alert('Failed to add avenue. It might already exist.');
    }
  };

  const handleUpdateAvenue = async (id: string) => {
    if (!editAvenueName.trim()) return;
    try {
      await systemService.updateAvenue(id, { name: editAvenueName.trim() });
      setEditingAvenueId(null);
      loadData();
    } catch {
      alert('Failed to update avenue.');
    }
  };

  const handleDeleteAvenue = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete avenue "${name}"? Existing contributions with this avenue won't be affected, but you won't be able to select it for new projects.`)) return;
    try {
      await systemService.deleteAvenue(id);
      loadData();
    } catch {
      alert('Failed to delete avenue.');
    }
  };

  if (loading) {
    return (
      <div className="flex animate-pulse space-x-4 p-4">
        <div className="flex-1 space-y-4 py-1">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-red-600 dark:text-red-400 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Member Standing Tier Thresholds Configuration */}
      <TierSettingsManagement />

      {/* Grid of System Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Faculties Section */}
        <div className="glass-panel rounded-3xl overflow-hidden border border-gray-200/80 dark:border-white/10 shadow-lg flex flex-col">
          <div className="bg-gradient-to-r from-maroon-700 via-maroon-800 to-maroon-900 p-5 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-white shadow-md">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight">University Faculties</h3>
                <p className="text-xs text-maroon-200">Registered academic faculties</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-white/15 text-white">
              {faculties.length}
            </span>
          </div>

          <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {faculties.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-6">No faculties registered yet.</p>
              ) : (
                faculties.map((faculty) => (
                  <div
                    key={faculty.id}
                    className="flex items-center justify-between p-3.5 bg-gray-50/80 dark:bg-white/5 rounded-2xl border border-gray-200/80 dark:border-white/5 hover:border-maroon-300 dark:hover:border-neon-blue/30 transition-all group"
                  >
                    {editingFacultyId === faculty.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editFacultyName}
                          onChange={(e) => setEditFacultyName(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs font-medium border border-maroon-500 rounded-xl bg-white dark:bg-dark-bg text-gray-900 dark:text-white outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateFaculty(faculty.id)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingFacultyId(null)}
                          className="p-1.5 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate mr-2">
                          {faculty.name}
                        </span>
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingFacultyId(faculty.id);
                              setEditFacultyName(faculty.name);
                            }}
                            className="p-1.5 text-gray-500 hover:text-maroon-600 dark:hover:text-neon-blue hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors"
                            title="Edit Faculty"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteFaculty(faculty.id, faculty.name)}
                            className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                            title="Delete Faculty"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-white/10 flex gap-2">
              <input
                type="text"
                value={newFacultyName}
                onChange={(e) => setNewFacultyName(e.target.value)}
                placeholder="Add new faculty name..."
                className="flex-1 px-4 py-2.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500 outline-none"
              />
              <button
                onClick={handleAddFaculty}
                disabled={!newFacultyName.trim()}
                className="px-4 py-2.5 bg-maroon-600 hover:bg-maroon-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Avenues Section */}
        <div className="glass-panel rounded-3xl overflow-hidden border border-gray-200/80 dark:border-white/10 shadow-lg flex flex-col">
          <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-emerald-900 p-5 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-white shadow-md">
                <FolderTree className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight">Service Avenues</h3>
                <p className="text-xs text-emerald-200">Contribution & project categories</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-white/15 text-white">
              {avenues.length}
            </span>
          </div>

          <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {avenues.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-6">No avenues configured yet.</p>
              ) : (
                avenues.map((avenue) => (
                  <div
                    key={avenue.id}
                    className="flex items-center justify-between p-3.5 bg-gray-50/80 dark:bg-white/5 rounded-2xl border border-gray-200/80 dark:border-white/5 hover:border-emerald-300 dark:hover:border-emerald-400/30 transition-all group"
                  >
                    {editingAvenueId === avenue.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editAvenueName}
                          onChange={(e) => setEditAvenueName(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs font-medium border border-emerald-500 rounded-xl bg-white dark:bg-dark-bg text-gray-900 dark:text-white outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateAvenue(avenue.id)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingAvenueId(null)}
                          className="p-1.5 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate mr-2">
                          {avenue.name}
                        </span>
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingAvenueId(avenue.id);
                              setEditAvenueName(avenue.name);
                            }}
                            className="p-1.5 text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors"
                            title="Edit Avenue"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAvenue(avenue.id, avenue.name)}
                            className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                            title="Delete Avenue"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-white/10 flex gap-2">
              <input
                type="text"
                value={newAvenueName}
                onChange={(e) => setNewAvenueName(e.target.value)}
                placeholder="Add new avenue name..."
                className="flex-1 px-4 py-2.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button
                onClick={handleAddAvenue}
                disabled={!newAvenueName.trim()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Batches Section (Full Width) */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-gray-200/80 dark:border-white/10 shadow-lg">
        <div className="bg-gradient-to-r from-sky-700 via-blue-800 to-indigo-900 p-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-white shadow-md">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Academic Batches</h3>
              <p className="text-xs text-sky-200">Registered member intake years</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-white/15 text-white">
            {batches.length} Batches
          </span>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex gap-2 max-w-md">
            <input
              type="text"
              value={newBatchName}
              onChange={(e) => setNewBatchName(e.target.value)}
              placeholder="e.g. 2024/2025"
              className="flex-1 px-4 py-2.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
            />
            <button
              onClick={handleAddBatch}
              disabled={!newBatchName.trim()}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Batch
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {batches.map((batch) => (
              <div
                key={batch.id}
                className="flex items-center justify-between p-3.5 bg-gray-50/80 dark:bg-white/5 rounded-2xl border border-gray-200/80 dark:border-white/5 hover:border-sky-300 dark:hover:border-sky-400/30 transition-all group"
              >
                {editingBatchId === batch.id ? (
                  <div className="flex flex-col gap-1 w-full">
                    <input
                      type="text"
                      value={editBatchName}
                      onChange={(e) => setEditBatchName(e.target.value)}
                      className="w-full px-2 py-1 border border-sky-500 rounded-lg bg-white dark:bg-dark-bg text-xs font-bold"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1 pt-1">
                      <button onClick={() => handleUpdateBatch(batch.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingBatchId(null)} className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="font-bold text-xs text-gray-900 dark:text-white">{batch.name}</span>
                    <div className="flex gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingBatchId(batch.id);
                          setEditBatchName(batch.name);
                        }}
                        className="p-1 text-gray-500 hover:text-sky-600 dark:hover:text-sky-400 rounded-md"
                        title="Edit Batch"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(batch.id, batch.name)}
                        className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-md"
                        title="Delete Batch"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
