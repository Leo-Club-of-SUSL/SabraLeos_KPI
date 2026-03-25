import { useState, useRef, useEffect } from 'react';
import { memberService } from '../services/member-service';
import { systemService } from '../services/system-service';
import { Camera, Loader2, X } from 'lucide-react';
import { validatePhotoFile, validatePhoneNumber, sanitizeTextInput } from '../lib/sanitize';
import type { Member, Faculty, Batch as BatchType } from '../types/database';

interface EditMemberFormProps {
  member: Member;
  onSuccess: (updatedMember: Member) => void;
  onCancel: () => void;
}

export function EditMemberForm({ member, onSuccess, onCancel }: EditMemberFormProps) {
  const [formData, setFormData] = useState({
    reg_no: member.reg_no,
    full_name: member.full_name,
    name_with_initials: member.name_with_initials,
    my_lci_num: member.my_lci_num || '',
    batch: member.batch,
    faculty: member.faculty,
    whatsapp: member.whatsapp,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(member.photo_url || '');
  const [photoError, setPhotoError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [batches, setBatches] = useState<BatchType[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadSystemData = async () => {
      try {
        const [fData, bData] = await Promise.all([
          systemService.getFaculties(),
          systemService.getBatches()
        ]);
        setFaculties(fData);
        setBatches(bData);
      } catch (err) {
        console.error('Error loading form metadata:', err);
      } finally {
        setDataLoading(false);
      }
    };
    loadSystemData();
  }, []);


  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError('');
    const file = e.target.files?.[0];
    if (file) {
      const validation = validatePhotoFile(file);
      if (!validation.valid) {
        setPhotoError(validation.error || 'Invalid photo');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoFile(null);
    setPhotoPreview('');
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.full_name.trim()) errors.full_name = 'Full Name is required';
    if (!formData.name_with_initials.trim()) errors.name_with_initials = 'Name with Initials is required';
    if (!formData.batch) errors.batch = 'Batch selection is required';
    if (!formData.faculty) errors.faculty = 'Faculty selection is required';
    if (!validatePhoneNumber(formData.whatsapp)) errors.whatsapp = 'Invalid phone number format';
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setError('');
    setLoading(true);

    try {
      let photoUrl = member.photo_url;

      if (photoFile) {
        try {
          photoUrl = await memberService.uploadPhoto(photoFile, member.photo_url);
        } catch (uploadError) {
          console.warn('Photo upload failed, continuing without photo update:', uploadError);
        }
      } else if (!photoPreview && !photoFile) {
        photoUrl = null;
      }


      const updatedMember = await memberService.update(member.reg_no, {
        full_name: sanitizeTextInput(formData.full_name),
        name_with_initials: sanitizeTextInput(formData.name_with_initials),
        my_lci_num: sanitizeTextInput(formData.my_lci_num),
        batch: sanitizeTextInput(formData.batch),
        faculty: formData.faculty,
        whatsapp: sanitizeTextInput(formData.whatsapp),
        photo_url: photoUrl,
      });

      onSuccess(updatedMember);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Edit Member Details</h2>

        {dataLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-maroon-600" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 overflow-hidden border-4 border-white dark:border-gray-600 shadow-lg"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-12 h-12 text-gray-400" />
                )}
              </div>
              <div className="absolute top-0 right-0">
                {photoPreview && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md"
                    title="Remove photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                Click to change photo
              </p>
              {photoError && <p className="mt-1 text-xs text-red-500 text-center">{photoError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                University Reg No <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.reg_no}
                disabled
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                title="Registration number cannot be changed"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {fieldErrors.full_name && <p className="mt-1 text-xs text-red-500">{fieldErrors.full_name}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name with Initials <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name_with_initials}
                onChange={(e) => setFormData({ ...formData, name_with_initials: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Batch <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.batch}
                onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Batch</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.name}>
                    {batch.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Faculty <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.faculty}
                onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Faculty</option>
                {faculties.map((faculty) => (
                  <option key={faculty.id} value={faculty.name}>
                    {faculty.name}
                  </option>
                ))}
              </select>
              {fieldErrors.faculty && <p className="mt-1 text-xs text-red-500">{fieldErrors.faculty}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                WhatsApp Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                MyLCI Number
              </label>
              <input
                type="text"
                value={formData.my_lci_num}
                onChange={(e) => setFormData({ ...formData, my_lci_num: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-maroon-600 hover:bg-maroon-700 disabled:bg-maroon-400 text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
