import { useState, useRef, useEffect } from 'react';
import { memberService } from '../services/member-service';
import { systemService } from '../services/system-service';
import { userService } from '../services/user-service';
import { Camera, Loader2, EyeOff, KeyRound, RefreshCw, Eye } from 'lucide-react';
import { validatePhotoFile, validateRegNo, validatePhoneNumber, sanitizeTextInput, validatePassword } from '../lib/sanitize';
import type { Member, Faculty, Batch as BatchType, MemberStatus } from '../types/database';

interface NewMemberFormProps {
  initialRegNo?: string;
  onSuccess: (member: Member) => void;
  onCancel: () => void;
}

export function NewMemberForm({ initialRegNo, onSuccess, onCancel }: NewMemberFormProps) {
  const [formData, setFormData] = useState({
    reg_no: initialRegNo || '',
    full_name: '',
    name_with_initials: '',
    my_lci_num: '',
    batch: '',
    faculty: '',
    whatsapp: '',
    email: '',
    member_status: 'active' as MemberStatus,
    leaderboard_opt_out: false,
    display_alias: '',
  });

  const [createAccount, setCreateAccount] = useState(true);
  const [accountPassword, setAccountPassword] = useState('Leo@2024#');
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
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

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!validateRegNo(formData.reg_no)) errors.reg_no = 'Registration Number is required and should be at least 3 characters';
    if (!formData.full_name.trim()) errors.full_name = 'Full Name is required';
    if (!formData.name_with_initials.trim()) errors.name_with_initials = 'Name with Initials is required';
    if (!formData.batch) errors.batch = 'Batch selection is required';
    if (!formData.faculty) errors.faculty = 'Faculty selection is required';
    if (!validatePhoneNumber(formData.whatsapp)) errors.whatsapp = 'Invalid phone number format';
    if (formData.email && !formData.email.includes('@')) errors.email = 'Invalid email address';
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setError('');
    setLoading(true);

    try {
      let photoUrl = null;

      if (photoFile) {
        try {
          photoUrl = await memberService.uploadPhoto(photoFile);
        } catch (uploadError) {
          console.warn('Photo upload failed, continuing without photo:', uploadError);
        }
      }

      const member = await memberService.create({
        reg_no: sanitizeTextInput(formData.reg_no),
        full_name: sanitizeTextInput(formData.full_name),
        name_with_initials: sanitizeTextInput(formData.name_with_initials),
        my_lci_num: sanitizeTextInput(formData.my_lci_num) || null,
        batch: sanitizeTextInput(formData.batch),
        faculty: formData.faculty,
        whatsapp: sanitizeTextInput(formData.whatsapp),
        email: formData.email ? sanitizeTextInput(formData.email) : null,
        member_status: formData.member_status,
        leaderboard_opt_out: formData.leaderboard_opt_out,
        display_alias: formData.display_alias ? sanitizeTextInput(formData.display_alias) : null,
        photo_url: photoUrl,
      });

      // Optionally create portal login account if email is provided
      if (formData.email && createAccount && accountPassword) {
        try {
          await userService.create(formData.email, {
            username: formData.name_with_initials,
            designation: 'Member',
            role: 'member',
            linked_member_reg_no: member.reg_no,
            password: accountPassword,
          });
        } catch (accountErr) {
          console.warn('Member created successfully, but portal login account creation failed:', accountErr);
        }
      }

      onSuccess(member);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create member');
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-maroon-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-center">
        <div className="relative">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 overflow-hidden"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-12 h-12 text-gray-400" />
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            className="hidden"
          />
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
            Click to add photo
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
            onChange={(e) => setFormData({ ...formData, reg_no: e.target.value.toUpperCase() })}
            required
            placeholder="e.g. 22ABC1234"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white uppercase"
          />
          {fieldErrors.reg_no && <p className="mt-1 text-xs text-red-500">{fieldErrors.reg_no}</p>}
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
            placeholder="Saman Kumara Perera"
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
            placeholder="S. K. Perera"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {fieldErrors.name_with_initials && <p className="mt-1 text-xs text-red-500">{fieldErrors.name_with_initials}</p>}
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
          {fieldErrors.batch && <p className="mt-1 text-xs text-red-500">{fieldErrors.batch}</p>}
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
            placeholder="+94771234567"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {fieldErrors.whatsapp && <p className="mt-1 text-xs text-red-500">{fieldErrors.whatsapp}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="member@example.com"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {fieldErrors.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Member Status
          </label>
          <select
            value={formData.member_status}
            onChange={(e) => setFormData({ ...formData, member_status: e.target.value as MemberStatus })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="active">Active Member</option>
            <option value="alumni">Alumni</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            MyLCI Number
          </label>
          <input
            type="text"
            value={formData.my_lci_num}
            onChange={(e) => setFormData({ ...formData, my_lci_num: e.target.value })}
            placeholder="LCI123456"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Member Portal Login Account Section */}
        {formData.email && (
          <div className="md:col-span-2 p-5 rounded-xl bg-maroon-50/70 dark:bg-maroon-950/30 border border-maroon-200 dark:border-maroon-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-maroon-600 dark:text-neon-blue" />
                <div>
                  <span className="font-bold text-gray-900 dark:text-white text-sm">
                    Create Member Login Account
                  </span>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Allows this member to log into their portal with their email and an assigned password
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={createAccount}
                  onChange={(e) => setCreateAccount(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-maroon-600"></div>
              </label>
            </div>

            {createAccount && (
              <div className="pt-2 border-t border-maroon-200/60 dark:border-maroon-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Assigned Initial Password <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const cleanReg = (formData.reg_no || 'Leo').replace(/[^a-zA-Z0-9]/g, '');
                      setAccountPassword(`Leo@${cleanReg}#${Math.floor(10 + Math.random() * 90)}`);
                    }}
                    className="text-xs text-maroon-600 dark:text-neon-blue font-semibold hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Generate Password
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showAccountPassword ? 'text' : 'password'}
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    required={createAccount}
                    minLength={8}
                    placeholder="Min 8 chars, uppercase, number, special"
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccountPassword(!showAccountPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showAccountPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {accountPassword && (() => {
                  const v = validatePassword(accountPassword);
                  return (
                    <p className={`text-[11px] ${v.isValid ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-500'}`}>
                      {v.isValid ? '✓ Valid password (member can change this after logging in)' : v.errors.join(' • ')}
                    </p>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Privacy Section */}
        <div className="md:col-span-2 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              <div>
                <span className="font-medium text-gray-900 dark:text-white text-sm">Leaderboard Opt-Out</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Hide real identity or appear anonymously on public leaderboards</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.leaderboard_opt_out}
                onChange={(e) => setFormData({ ...formData, leaderboard_opt_out: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-maroon-600"></div>
            </label>
          </div>

          {formData.leaderboard_opt_out && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Display Alias (Optional)
              </label>
              <input
                type="text"
                value={formData.display_alias}
                onChange={(e) => setFormData({ ...formData, display_alias: e.target.value })}
                placeholder="e.g. Anonymous Leo"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
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
              Creating...
            </>
          ) : (
            'Create Member'
          )}
        </button>
      </div>
    </form>
  );
}
