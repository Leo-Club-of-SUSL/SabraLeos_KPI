import { useState, useEffect } from 'react';
import { systemService } from '../services/system-service';
import { Plus, Trash2, Edit2, Check, X, GraduationCap, Calendar } from 'lucide-react';
import type { Faculty, Batch } from '../types/database';

export function SystemDataManagement() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editing state
  const [editingFacultyId, setEditingFacultyId] = useState<string | null>(null);
  const [editFacultyName, setEditFacultyName] = useState('');
  const [newFacultyName, setNewFacultyName] = useState('');

  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editBatchName, setEditBatchName] = useState('');
  const [newBatchName, setNewBatchName] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [fData, bData] = await Promise.all([
        systemService.getFaculties(),
        systemService.getBatches(),
      ]);
      setFaculties(fData);
      setBatches(bData);
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
    } catch (err) {
      alert('Failed to add faculty. It might already exist.');
    }
  };

  const handleUpdateFaculty = async (id: string) => {
    if (!editFacultyName.trim()) return;
    try {
      await systemService.updateFaculty(id, { name: editFacultyName.trim() });
      setEditingFacultyId(null);
      loadData();
    } catch (err) {
      alert('Failed to update faculty.');
    }
  };

  const handleDeleteFaculty = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? Existing members with this faculty won't be affected, but you won't be able to select it for new members.`)) return;
    try {
      await systemService.deleteFaculty(id);
      loadData();
    } catch (err) {
      alert('Failed to delete faculty.');
    }
  };

  const handleAddBatch = async () => {
    if (!newBatchName.trim()) return;
    try {
      await systemService.createBatch({ name: newBatchName.trim() });
      setNewBatchName('');
      loadData();
    } catch (err) {
      alert('Failed to add batch. It might already exist.');
    }
  };

  const handleUpdateBatch = async (id: string) => {
    if (!editBatchName.trim()) return;
    try {
      await systemService.updateBatch(id, { name: editBatchName.trim() });
      setEditingBatchId(null);
      loadData();
    } catch (err) {
      alert('Failed to update batch.');
    }
  };

  const handleDeleteBatch = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete batch "${name}"?`)) return;
    try {
      await systemService.deleteBatch(id);
      loadData();
    } catch (err) {
      alert('Failed to delete batch.');
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
    <div className="space-y-8 animate-in fade-in duration-500">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-600">
          {error}
        </div>
      )}

      {/* Faculties Section */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-maroon-600 to-maroon-700 p-4 flex items-center gap-3">
          <GraduationCap className="w-6 h-6 text-white" />
          <h3 className="text-xl font-bold text-white uppercase tracking-wider">Manage Faculties</h3>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newFacultyName}
              onChange={(e) => setNewFacultyName(e.target.value)}
              placeholder="New Faculty Name..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
            />
            <button
              onClick={handleAddFaculty}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {faculties.map((faculty) => (
              <div
                key={faculty.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10"
              >
                {editingFacultyId === faculty.id ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={editFacultyName}
                      onChange={(e) => setEditFacultyName(e.target.value)}
                      className="flex-1 px-2 py-1 border border-maroon-500 rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
                      autoFocus
                    />
                    <button onClick={() => handleUpdateFaculty(faculty.id)} className="text-green-600"><Check className="w-5 h-5" /></button>
                    <button onClick={() => setEditingFacultyId(null)} className="text-red-600"><X className="w-5 h-5" /></button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium text-gray-900 dark:text-white">{faculty.name}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingFacultyId(faculty.id);
                          setEditFacultyName(faculty.name);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteFaculty(faculty.id, faculty.name)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Batches Section */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 flex items-center gap-3">
          <Calendar className="w-6 h-6 text-white" />
          <h3 className="text-xl font-bold text-white uppercase tracking-wider">Manage Batches</h3>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newBatchName}
              onChange={(e) => setNewBatchName(e.target.value)}
              placeholder="e.g. 2024"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white"
            />
            <button
              onClick={handleAddBatch}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {batches.map((batch) => (
              <div
                key={batch.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10"
              >
                {editingBatchId === batch.id ? (
                  <div className="flex flex-col gap-1 w-full">
                    <input
                      type="text"
                      value={editBatchName}
                      onChange={(e) => setEditBatchName(e.target.value)}
                      className="w-full px-2 py-1 border border-blue-500 rounded bg-white dark:bg-dark-bg text-xs font-bold"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1">
                      <button onClick={() => handleUpdateBatch(batch.id)} className="text-green-600"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingBatchId(null)} className="text-red-600"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="font-bold text-gray-900 dark:text-white">{batch.name}</span>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => {
                          setEditingBatchId(batch.id);
                          setEditBatchName(batch.name);
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(batch.id, batch.name)}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
