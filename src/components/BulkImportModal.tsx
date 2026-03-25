import { useState, useRef } from 'react';
import { X, Download, Upload, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { bulkImportService, type ImportResult } from '../services/bulk-import-service';

interface BulkImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkImportModal({ onClose, onSuccess }: BulkImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    try {
      await bulkImportService.downloadTemplate();
    } catch (error) {
      alert('Failed to download template. Please check your connection.');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];

      if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        alert('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }

      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    setImportResult(null);

    try {
      // Parse the Excel file
      const rows = await bulkImportService.parseExcelFile(selectedFile);

      if (rows.length === 0) {
        alert('The Excel file is empty. Please add member data and try again.');
        setImporting(false);
        return;
      }

      // Import the members
      const result = await bulkImportService.importMembers(rows);
      setImportResult(result);

      if (result.success > 0) {
        onSuccess();
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to import members');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Bulk Import Members
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Import multiple members at once using an Excel file
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
          >
            <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Step 1: Download Template */}
          <div className="bg-gradient-to-r from-maroon-50 to-maroon-100 dark:from-maroon-900/20 dark:to-maroon-800/20 rounded-lg p-6 border border-maroon-200 dark:border-maroon-700">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-maroon-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Download Template
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Download the Excel template file and fill it with member information. The template includes sample data to guide you.
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  <Download className="w-5 h-5" />
                  Download Template
                </button>
              </div>
            </div>
          </div>

          {/* Step 2: Upload File */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6 border border-blue-200 dark:border-blue-700">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Upload Filled Template
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  After filling the template with member data, upload it here to import the members.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="excel-file-input"
                />

                <div className="space-y-3">
                  {selectedFile ? (
                    <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                      <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                      <button
                        onClick={handleReset}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
                      >
                        <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="excel-file-input"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors duration-200"
                    >
                      <Upload className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                        Choose Excel File
                      </span>
                    </label>
                  )}

                  {selectedFile && !importResult && (
                    <button
                      onClick={handleImport}
                      disabled={importing}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors duration-200"
                    >
                      {importing ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          Import Members
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Import Results */}
          {importResult && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Import Results
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-300">
                      Successful
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {importResult.success}
                  </p>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <span className="text-sm font-medium text-red-800 dark:text-red-300">
                      Failed
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                    {importResult.failed}
                  </p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    Errors ({importResult.errors.length}):
                  </h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {importResult.errors.map((error, index) => (
                      <div
                        key={index}
                        className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"
                      >
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">
                          Row {error.row}: {error.error}
                        </p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(error.data as any) && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {JSON.stringify(error.data)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleReset}
                className="mt-4 w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors duration-200"
              >
                Import Another File
              </button>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
              Important Notes:
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li>All fields except MyLCI Number are required</li>
              <li>Registration numbers must be unique</li>
              <li>The system will skip rows with duplicate registration numbers</li>
              <li>Make sure to follow the template format exactly</li>
              <li>Remove the sample data rows before importing your actual data</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
