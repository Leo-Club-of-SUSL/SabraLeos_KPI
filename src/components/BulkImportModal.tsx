import { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  Trash2,
  Search,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Check,
} from 'lucide-react';
import {
  bulkImportService,
  type ImportResult,
  type StagedMemberRow,
} from '../services/bulk-import-service';
import { systemService } from '../services/system-service';
import type { Faculty, Batch as BatchType } from '../types/database';

interface BulkImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type ModalStep = 'SELECT_FILE' | 'REVIEW_STAGED' | 'IMPORTING' | 'COMPLETE';
type FilterTab = 'all' | 'valid' | 'errors';

export function BulkImportModal({ onClose, onSuccess }: BulkImportModalProps) {
  const [step, setStep] = useState<ModalStep>('SELECT_FILE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Metadata for faculty and batch dropdown selections
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [batches, setBatches] = useState<BatchType[]>([]);
  const [existingInDb, setExistingInDb] = useState<Set<string>>(new Set());

  // Staged rows & review state
  const [stagedRows, setStagedRows] = useState<StagedMemberRow[]>([]);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load system faculties and batches on mount
  useEffect(() => {
    const loadSystemData = async () => {
      try {
        const [fList, bList] = await Promise.all([
          systemService.getFaculties(),
          systemService.getBatches(),
        ]);
        setFaculties(fList);
        setBatches(bList);
      } catch (err) {
        console.error('Failed to load system taxonomy for bulk import:', err);
      }
    };
    loadSystemData();
  }, []);

  const validFacultyNames = useMemo(
    () => new Set(faculties.map((f) => f.name.toLowerCase().trim())),
    [faculties]
  );

  const validBatchNames = useMemo(
    () => new Set(batches.map((b) => b.name.toLowerCase().trim())),
    [batches]
  );

  // Download template with live faculties and batches reference sheet
  const handleDownloadTemplate = async () => {
    try {
      await bulkImportService.downloadTemplate();
    } catch {
      alert('Failed to download template. Please check your connection.');
    }
  };

  // Handle file selection and initiate parsing & staging
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validExtensions = ['.xlsx', '.xls'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      alert('Please select a valid Excel file (.xlsx or .xls)');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    setParseError(null);
    setParsing(true);

    try {
      // 1. Ensure latest system taxonomies are loaded
      let currentFaculties = faculties;
      let currentBatches = batches;
      if (currentFaculties.length === 0 || currentBatches.length === 0) {
        const [fList, bList] = await Promise.all([
          systemService.getFaculties(),
          systemService.getBatches(),
        ]);
        currentFaculties = fList;
        currentBatches = bList;
        setFaculties(fList);
        setBatches(bList);
      }

      // 2. Parse Excel file into normalized rows
      const rawRows = await bulkImportService.parseExcelFile(file);
      if (rawRows.length === 0) {
        throw new Error('The uploaded Excel file contains no data rows. Please add member data and try again.');
      }

      // 3. Stage and validate all rows against DB and schema
      const { stagedRows: staged, existingInDb: dbSet } = await bulkImportService.stageAndValidateRows(
        rawRows,
        currentFaculties,
        currentBatches
      );

      setExistingInDb(dbSet);
      setStagedRows(staged);
      setStep('REVIEW_STAGED');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse Excel file');
      setSelectedFile(null);
    } finally {
      setParsing(false);
    }
  };

  // Re-validate staged rows helper
  const revalidate = (updatedRows: StagedMemberRow[]) => {
    return bulkImportService.revalidateStagedRows(
      updatedRows,
      validFacultyNames,
      validBatchNames,
      existingInDb
    );
  };

  // Handle cell edit in the staging table
  const handleFieldChange = (
    id: string,
    field: keyof Omit<StagedMemberRow, 'id' | 'rowNumber' | 'isValid' | 'errors' | 'isDuplicateInFile' | 'existsInDb'>,
    value: string
  ) => {
    setStagedRows((prev) => {
      const updated = prev.map((row) => {
        if (row.id !== id) return row;
        let formattedValue = value;
        if (field === 'reg_no') {
          formattedValue = value.toUpperCase();
        }
        return {
          ...row,
          [field]: formattedValue,
        };
      });
      return revalidate(updated);
    });
  };

  // Remove individual staged row
  const handleDeleteRow = (id: string) => {
    setStagedRows((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      return revalidate(filtered);
    });
  };

  // Discard all rows that have errors
  const handleDiscardAllErrors = () => {
    if (!confirm('Are you sure you want to remove all rows with errors?')) return;
    setStagedRows((prev) => {
      const validOnly = prev.filter((r) => r.isValid);
      return revalidate(validOnly);
    });
    setFilterTab('all');
  };

  // Count summaries
  const totalCount = stagedRows.length;
  const validCount = stagedRows.filter((r) => r.isValid).length;
  const errorCount = stagedRows.filter((r) => !r.isValid).length;

  // Filtered rows for the view
  const displayedRows = useMemo(() => {
    let list = stagedRows;

    if (filterTab === 'valid') {
      list = list.filter((r) => r.isValid);
    } else if (filterTab === 'errors') {
      list = list.filter((r) => !r.isValid);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.reg_no.toLowerCase().includes(query) ||
          r.full_name.toLowerCase().includes(query) ||
          r.name_with_initials.toLowerCase().includes(query) ||
          r.faculty.toLowerCase().includes(query) ||
          r.batch.toLowerCase().includes(query) ||
          r.whatsapp.toLowerCase().includes(query)
      );
    }

    return list;
  }, [stagedRows, filterTab, searchQuery]);

  // Execute import
  const executeImport = async () => {
    setShowSkipConfirm(false);
    const validRowsToImport = stagedRows.filter((r) => r.isValid);
    if (validRowsToImport.length === 0) return;

    setStep('IMPORTING');
    try {
      const result = await bulkImportService.importMembers(validRowsToImport);
      setImportResult(result);
      setStep('COMPLETE');
      if (result.success > 0) {
        onSuccess();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred during import');
      setStep('REVIEW_STAGED');
    }
  };

  const handleStartImport = () => {
    if (validCount === 0) {
      alert('There are no valid members to import. Please resolve the errors or add valid data.');
      return;
    }

    if (errorCount > 0) {
      setShowSkipConfirm(true);
    } else {
      executeImport();
    }
  };

  const handleResetToUpload = () => {
    setSelectedFile(null);
    setStagedRows([]);
    setParseError(null);
    setImportResult(null);
    setFilterTab('all');
    setSearchQuery('');
    setStep('SELECT_FILE');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 z-50 animate-in fade-in duration-200">
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full flex flex-col transition-all duration-300 max-h-[92vh] ${
          step === 'REVIEW_STAGED' ? 'max-w-7xl' : 'max-w-3xl'
        }`}
      >
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            {step === 'REVIEW_STAGED' && (
              <button
                onClick={handleResetToUpload}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                title="Back to file selection"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6 text-maroon-600 dark:text-maroon-400" />
                {step === 'REVIEW_STAGED'
                  ? 'Review & Verify Member Data'
                  : step === 'IMPORTING'
                  ? 'Importing Members...'
                  : step === 'COMPLETE'
                  ? 'Import Results'
                  : 'Bulk Import Members'}
              </h2>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {step === 'REVIEW_STAGED'
                  ? `Extracted from ${selectedFile?.name}. Resolve any flagged issues or edit fields directly before adding.`
                  : step === 'IMPORTING'
                  ? 'Batching and inserting verified records into the database...'
                  : step === 'COMPLETE'
                  ? 'Review the import outcome below.'
                  : 'Onboard multiple Leo members at once using an Excel template with live Faculty & Batch options.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: SELECT FILE */}
          {step === 'SELECT_FILE' && (
            <div className="space-y-6">
              {/* Step 1: Download Template */}
              <div className="bg-gradient-to-r from-maroon-50 to-maroon-100 dark:from-maroon-900/20 dark:to-maroon-800/20 rounded-xl p-6 border border-maroon-200 dark:border-maroon-700 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-maroon-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      Download Official Excel Template
                    </h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      Includes pre-configured columns and a dedicated <strong>Valid_Selections</strong> sheet populated with all active <strong>Faculties</strong> and <strong>Batches</strong> currently registered in Nexus KPI.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-2 px-4 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow"
                      >
                        <Download className="w-4 h-4" />
                        Download Template (.xlsx)
                      </button>
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-gray-800/70 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700">
                        {faculties.length} Faculties • {batches.length} Batches Included
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Upload File */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      Upload Filled Excel Sheet
                    </h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                      Upload your populated spreadsheet. The system will parse the records and present an <strong>interactive verification screen</strong> so you can inspect, edit, or resolve errors before importing.
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="excel-file-upload-input"
                    />

                    {parsing ? (
                      <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-xl border border-blue-300 dark:border-blue-700">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                        <p className="font-semibold text-gray-900 dark:text-white">
                          Extracting & Validating Records...
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Checking for existing members and verifying faculties/batches
                        </p>
                      </div>
                    ) : (
                      <label
                        htmlFor="excel-file-upload-input"
                        className="flex flex-col items-center justify-center gap-3 p-8 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all text-center group"
                      >
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-base font-semibold text-gray-800 dark:text-gray-200 block">
                            Click to browse or drag and drop Excel file
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 block">
                            Supports .xlsx and .xls formats
                          </span>
                        </div>
                      </label>
                    )}

                    {parseError && (
                      <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                            Failed to read Excel file
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                            {parseError}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Guidelines */}
              <div className="bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  Helpful Import Tips:
                </h4>
                <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                  <li>Registration number, Full name, Name with initials, Batch, Faculty, and WhatsApp are required.</li>
                  <li>WhatsApp numbers are automatically standardized (e.g. <code>0771234567</code> becomes <code>+94771234567</code>).</li>
                  <li>Any duplicate registration numbers or typos can be edited directly on the next screen before importing.</li>
                  <li>You do not need to delete sample rows manually if you update their values.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW & EDIT STAGED DATA */}
          {step === 'REVIEW_STAGED' && (
            <div className="space-y-4">
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
                      Total Extracted
                    </span>
                    <span className="text-2xl font-black text-blue-900 dark:text-blue-100">
                      {totalCount}
                    </span>
                  </div>
                  <FileSpreadsheet className="w-8 h-8 text-blue-500 opacity-60" />
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                      Ready to Add
                    </span>
                    <span className="text-2xl font-black text-emerald-900 dark:text-emerald-100">
                      {validCount}
                    </span>
                  </div>
                  <CheckCircle className="w-8 h-8 text-emerald-500 opacity-60" />
                </div>

                <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-wider block">
                      Needs Attention
                    </span>
                    <span className="text-2xl font-black text-rose-900 dark:text-rose-100">
                      {errorCount}
                    </span>
                  </div>
                  <AlertCircle className="w-8 h-8 text-rose-500 opacity-60" />
                </div>
              </div>

              {/* Status Banner */}
              {errorCount > 0 ? (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl flex items-center justify-between text-amber-800 dark:text-amber-200 text-sm">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span>
                      <strong>{errorCount} {errorCount === 1 ? 'row has issues' : 'rows have issues'}.</strong> Review the highlighted fields below, use the dropdowns to correct them, or delete rows you do not want to import.
                    </span>
                  </div>
                  <button
                    onClick={handleDiscardAllErrors}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/60 rounded-lg transition-colors flex-shrink-0 ml-3"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Discard All Errors ({errorCount})
                  </button>
                </div>
              ) : (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2.5 text-emerald-800 dark:text-emerald-200 text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>
                    <strong>All {totalCount} records are verified and valid.</strong> Ready to be imported directly into Nexus KPI.
                  </span>
                </div>
              )}

              {/* Toolbar & Filter Tabs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                {/* Tabs */}
                <div className="flex bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl">
                  <button
                    onClick={() => setFilterTab('all')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      filterTab === 'all'
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    All Records ({totalCount})
                  </button>
                  <button
                    onClick={() => setFilterTab('valid')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      filterTab === 'valid'
                        ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400'
                    }`}
                  >
                    Ready ({validCount})
                  </button>
                  <button
                    onClick={() => setFilterTab('errors')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      filterTab === 'errors'
                        ? 'bg-white dark:bg-gray-800 text-rose-600 dark:text-rose-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-rose-600 dark:hover:text-rose-400'
                    }`}
                  >
                    Issues ({errorCount})
                  </button>
                </div>

                {/* Search */}
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search extracted rows..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Editable Staging Table */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-800">
                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 font-semibold sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 backdrop-blur">
                      <tr>
                        <th className="py-2.5 px-3 w-16 text-center">Status</th>
                        <th className="py-2.5 px-2 w-12 text-center">Row</th>
                        <th className="py-2.5 px-3 min-w-[130px]">Reg No *</th>
                        <th className="py-2.5 px-3 min-w-[160px]">Full Name *</th>
                        <th className="py-2.5 px-3 min-w-[140px]">Name with Initials *</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Faculty *</th>
                        <th className="py-2.5 px-3 min-w-[130px]">Batch *</th>
                        <th className="py-2.5 px-3 min-w-[130px]">WhatsApp *</th>
                        <th className="py-2.5 px-3 min-w-[110px]">MyLCI No</th>
                        <th className="py-2.5 px-2 w-12 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700/60">
                      {displayedRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-gray-500 dark:text-gray-400">
                            No records match the current filter.
                          </td>
                        </tr>
                      ) : (
                        displayedRows.map((row) => {
                          const hasRegError = row.errors.some((e) => e.toLowerCase().includes('registration'));
                          const hasNameError = row.errors.some((e) => e.toLowerCase().includes('full name'));
                          const hasInitialsError = row.errors.some((e) => e.toLowerCase().includes('initials'));
                          const hasFacultyError = row.errors.some((e) => e.toLowerCase().includes('faculty'));
                          const hasBatchError = row.errors.some((e) => e.toLowerCase().includes('batch'));
                          const hasPhoneError = row.errors.some((e) => e.toLowerCase().includes('whatsapp') || e.toLowerCase().includes('phone'));

                          return (
                            <tr
                              key={row.id}
                              className={`transition-colors ${
                                row.isValid
                                  ? 'hover:bg-gray-50/80 dark:hover:bg-gray-700/40'
                                  : 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70 dark:hover:bg-rose-950/30'
                              }`}
                            >
                              {/* Status Badge */}
                              <td className="py-2 px-3 text-center align-top">
                                {row.isValid ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                    title="Verified: Ready to import"
                                  >
                                    <Check className="w-3 h-3" />
                                    Ready
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 cursor-help"
                                    title={row.errors.join(' • ')}
                                  >
                                    <AlertCircle className="w-3 h-3" />
                                    Issue
                                  </span>
                                )}
                              </td>

                              {/* Row Number */}
                              <td className="py-2 px-2 text-center text-gray-500 dark:text-gray-400 font-mono text-[11px] align-top pt-2.5">
                                #{row.rowNumber}
                              </td>

                              {/* Registration Number */}
                              <td className="py-2 px-3 align-top">
                                <input
                                  type="text"
                                  value={row.reg_no}
                                  onChange={(e) => handleFieldChange(row.id, 'reg_no', e.target.value)}
                                  placeholder="e.g. 22ABC1234"
                                  className={`w-full px-2.5 py-1 text-xs rounded-md bg-white dark:bg-gray-800 border font-mono uppercase focus:ring-1 focus:ring-maroon-500 focus:outline-none ${
                                    hasRegError
                                      ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50/30'
                                      : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'
                                  }`}
                                />
                                {hasRegError && (
                                  <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 leading-tight">
                                    {row.errors.find((e) => e.toLowerCase().includes('registration'))}
                                  </p>
                                )}
                              </td>

                              {/* Full Name */}
                              <td className="py-2 px-3 align-top">
                                <input
                                  type="text"
                                  value={row.full_name}
                                  onChange={(e) => handleFieldChange(row.id, 'full_name', e.target.value)}
                                  placeholder="Full Name"
                                  className={`w-full px-2.5 py-1 text-xs rounded-md bg-white dark:bg-gray-800 border focus:ring-1 focus:ring-maroon-500 focus:outline-none ${
                                    hasNameError
                                      ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50/30'
                                      : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'
                                  }`}
                                />
                                {hasNameError && (
                                  <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 leading-tight">
                                    Full name required
                                  </p>
                                )}
                              </td>

                              {/* Name with Initials */}
                              <td className="py-2 px-3 align-top">
                                <input
                                  type="text"
                                  value={row.name_with_initials}
                                  onChange={(e) => handleFieldChange(row.id, 'name_with_initials', e.target.value)}
                                  placeholder="e.g. J.D. Smith"
                                  className={`w-full px-2.5 py-1 text-xs rounded-md bg-white dark:bg-gray-800 border focus:ring-1 focus:ring-maroon-500 focus:outline-none ${
                                    hasInitialsError
                                      ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50/30'
                                      : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'
                                  }`}
                                />
                                {hasInitialsError && (
                                  <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 leading-tight">
                                    Initials required
                                  </p>
                                )}
                              </td>

                              {/* Faculty (Dropdown Selection) */}
                              <td className="py-2 px-3 align-top">
                                <select
                                  value={
                                    faculties.some(
                                      (f) => f.name.toLowerCase().trim() === row.faculty.toLowerCase().trim()
                                    )
                                      ? faculties.find(
                                          (f) => f.name.toLowerCase().trim() === row.faculty.toLowerCase().trim()
                                        )?.name
                                      : ''
                                  }
                                  onChange={(e) => handleFieldChange(row.id, 'faculty', e.target.value)}
                                  className={`w-full px-2 py-1 text-xs rounded-md bg-white dark:bg-gray-800 border focus:ring-1 focus:ring-maroon-500 focus:outline-none ${
                                    hasFacultyError
                                      ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50/40 font-semibold'
                                      : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'
                                  }`}
                                >
                                  {/* If the current value is not in active faculties, show it as invalid option */}
                                  {!faculties.some(
                                    (f) => f.name.toLowerCase().trim() === row.faculty.toLowerCase().trim()
                                  ) && (
                                    <option value="" disabled>
                                      {row.faculty ? `⚠️ Invalid: "${row.faculty}" (Select below)` : '-- Select Faculty --'}
                                    </option>
                                  )}
                                  {faculties.map((f) => (
                                    <option key={f.id} value={f.name}>
                                      {f.name}
                                    </option>
                                  ))}
                                </select>
                                {hasFacultyError && (
                                  <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 leading-tight">
                                    Please select an active faculty
                                  </p>
                                )}
                              </td>

                              {/* Batch (Dropdown Selection) */}
                              <td className="py-2 px-3 align-top">
                                <select
                                  value={
                                    batches.some(
                                      (b) => b.name.toLowerCase().trim() === row.batch.toLowerCase().trim()
                                    )
                                      ? batches.find(
                                          (b) => b.name.toLowerCase().trim() === row.batch.toLowerCase().trim()
                                        )?.name
                                      : ''
                                  }
                                  onChange={(e) => handleFieldChange(row.id, 'batch', e.target.value)}
                                  className={`w-full px-2 py-1 text-xs rounded-md bg-white dark:bg-gray-800 border focus:ring-1 focus:ring-maroon-500 focus:outline-none ${
                                    hasBatchError
                                      ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50/40 font-semibold'
                                      : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'
                                  }`}
                                >
                                  {!batches.some(
                                    (b) => b.name.toLowerCase().trim() === row.batch.toLowerCase().trim()
                                  ) && (
                                    <option value="" disabled>
                                      {row.batch ? `⚠️ Invalid: "${row.batch}" (Select below)` : '-- Select Batch --'}
                                    </option>
                                  )}
                                  {batches.map((b) => (
                                    <option key={b.id} value={b.name}>
                                      {b.name}
                                    </option>
                                  ))}
                                </select>
                                {hasBatchError && (
                                  <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 leading-tight">
                                    Please select an active batch
                                  </p>
                                )}
                              </td>

                              {/* WhatsApp */}
                              <td className="py-2 px-3 align-top">
                                <input
                                  type="text"
                                  value={row.whatsapp}
                                  onChange={(e) => handleFieldChange(row.id, 'whatsapp', e.target.value)}
                                  placeholder="+94771234567"
                                  className={`w-full px-2.5 py-1 text-xs rounded-md bg-white dark:bg-gray-800 border font-mono focus:ring-1 focus:ring-maroon-500 focus:outline-none ${
                                    hasPhoneError
                                      ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50/30'
                                      : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'
                                  }`}
                                />
                                {hasPhoneError && (
                                  <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 leading-tight">
                                    Valid phone required
                                  </p>
                                )}
                              </td>

                              {/* MyLCI Number */}
                              <td className="py-2 px-3 align-top">
                                <input
                                  type="text"
                                  value={row.my_lci_num}
                                  onChange={(e) => handleFieldChange(row.id, 'my_lci_num', e.target.value)}
                                  placeholder="(Optional)"
                                  className="w-full px-2.5 py-1 text-xs rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-1 focus:ring-maroon-500 focus:outline-none font-mono"
                                />
                              </td>

                              {/* Delete Row Button */}
                              <td className="py-2 px-2 text-center align-top pt-2">
                                <button
                                  onClick={() => handleDeleteRow(row.id)}
                                  className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Discard this row"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: IMPORTING SPINNER */}
          {step === 'IMPORTING' && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-maroon-50 dark:bg-maroon-900/30 border border-maroon-200 dark:border-maroon-700 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-maroon-600 dark:text-maroon-400 animate-spin" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Importing Members into Nexus KPI
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-md mx-auto">
                  Adding verified member records in chunked batches and calculating initial points...
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORT COMPLETE */}
          {step === 'COMPLETE' && importResult && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                    Successfully Added
                  </span>
                  <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {importResult.success}
                  </span>
                </div>

                <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-5 text-center">
                  <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto mb-2" />
                  <span className="text-xs font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wider block">
                    Failed Records
                  </span>
                  <span className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-1 block">
                    {importResult.failed}
                  </span>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
                    Failed Row Errors ({importResult.errors.length}):
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs text-rose-800 dark:text-rose-300">
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="p-2 bg-white dark:bg-gray-800 rounded border border-rose-200 dark:border-rose-900/40">
                        <strong>Row {err.row}:</strong> {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700/60 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-b-2xl">
          {step === 'SELECT_FILE' && (
            <div className="w-full flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {step === 'REVIEW_STAGED' && (
            <>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <span>
                  Ready to add: <strong className="text-emerald-600 dark:text-emerald-400">{validCount}</strong> of <strong>{totalCount}</strong> records
                </span>
                {errorCount > 0 && (
                  <span className="text-rose-500 ml-2">
                    ({errorCount} will be skipped unless fixed)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  onClick={handleResetToUpload}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Choose Different File
                </button>
                <button
                  onClick={handleStartImport}
                  disabled={validCount === 0}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold shadow-md hover:shadow transition-all disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  Import {validCount} {validCount === 1 ? 'Member' : 'Members'}
                </button>
              </div>
            </>
          )}

          {step === 'COMPLETE' && (
            <div className="w-full flex justify-end gap-3">
              <button
                onClick={handleResetToUpload}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Import Another File
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg text-sm font-bold shadow-md transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Skipping Erroneous Rows */}
      {showSkipConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-60 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-7 h-7" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Proceed with Import?
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              There {errorCount === 1 ? 'is' : 'are'} <strong>{errorCount} {errorCount === 1 ? 'row' : 'rows'} with unresolved issues</strong> in your upload.
              If you proceed now, only the <strong>{validCount} valid {validCount === 1 ? 'member' : 'members'}</strong> will be imported, and problematic rows will be skipped.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSkipConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Go Back & Fix
              </button>
              <button
                onClick={executeImport}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-md transition-colors"
              >
                Yes, Import {validCount} Members
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
