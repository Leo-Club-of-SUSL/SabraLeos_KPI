import { useState, useRef, useEffect } from 'react';
import { memberService } from '../services/member-service';
import { systemService } from '../services/system-service';
import { userService } from '../services/user-service';
import { Camera, Loader2, EyeOff, KeyRound, Copy, Check, Eye, RefreshCw, UserCheck } from 'lucide-react';
import { validatePhotoFile, validateRegNo, validatePhoneNumber, sanitizeTextInput } from '../lib/sanitize';
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
  const [mockPassword, setMockPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    member: Member;
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

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

  // Update default password suggestion when reg_no changes if user hasn't typed a custom one
  useEffect(() => {
    if (formData.reg_no && (!mockPassword || mockPassword.startsWith('Leo@'))) {
      const clean = formData.reg_no.replace(/[^a-zA-Z0-9]/g, '');
      setMockPassword(`Leo@${clean || 'Member'}2026!`);
    }
  }, [formData.reg_no]);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let res = 'Leo@';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setMockPassword(res);
  };

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
    if (createAccount && !formData.email) {
      errors.email = 'Email address is required to create member portal login account';
    }
    if (createAccount && mockPassword && mockPassword.length < 6) {
      errors.password = 'Temporary password must be at least 6 characters';
    }
    
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

      // Create portal account directly with mock password if selected
      if (formData.email && createAccount) {
        const passToUse = mockPassword || `Leo@${member.reg_no.replace(/[^a-zA-Z0-9]/g, '')}2026!`;
        try {
          const results = await userService.provisionMembers([member.reg_no], passToUse);
          const res = results[0];
          if (res?.status === 'failed') {
            alert(`Member profile created, but login account failed: ${res.message || 'Service unavailable'}`);
            onSuccess(member);
            return;
          }

          // Show manual credentials modal
          setCreatedCredentials({
            member,
            email: formData.email,
            password: passToUse,
          });
          return;
        } catch (accountErr) {
          console.warn('Member created, account error:', accountErr);
          alert(`Member created, but portal account setup encountered an issue: ${accountErr instanceof Error ? accountErr.message : 'Account service unavailable'}`);
          onSuccess(member);
          return;
        }
      }

      onSuccess(member);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create member');
    } finally {
      setLoading(false);
    }
  };

  const copyCredentialsToClipboard = () => {
    if (!createdCredentials) return;
    const text = `Leo Club SUSL - Portal Login Credentials\n\nMember: ${createdCredentials.member.name_with_initials} (${createdCredentials.member.reg_no})\nEmail: ${createdCredentials.email}\nTemporary Password: ${createdCredentials.password}\n\nLogin URL: ${window.location.origin}\n* Please change your password after logging in.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (createdCredentials) {
    return (
      <div className="p-6 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <UserCheck className="w-8 h-8" />
        </div>

        <div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white">
            Member & Login Account Created!
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Account created without sending emails. Hand over the credentials below directly to the member.
          </p>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl text-left space-y-3 font-mono text-xs">
          <div>
            <span className="text-gray-500 uppercase text-[10px] block font-sans font-bold">Member</span>
            <span className="text-gray-900 dark:text-white font-bold">{createdCredentials.member.name_with_initials} ({createdCredentials.member.reg_no})</span>
          </div>
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-gray-500 uppercase text-[10px] block font-sans font-bold">Login Email</span>
            <span className="text-gray-900 dark:text-white select-all">{createdCredentials.email}</span>
          </div>
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-gray-500 uppercase text-[10px] block font-sans font-bold">Temporary Password</span>
            <span className="text-maroon-600 dark:text-neon-blue font-bold select-all">{createdCredentials.password}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={copyCredentialsToClipboard}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied to Clipboard!' : 'Copy Credentials'}
          </button>
          <button
            type="button"
            onClick={() => onSuccess(createdCredentials.member)}
            className="flex-1 px-4 py-3 bg-maroon-600 hover:bg-maroon-700 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-maroon-600/20"
          >
            Done & Continue
          </button>
        </div>
      </div>
    );
  }

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
        <div className="md:col-span-2 p-5 rounded-2xl bg-maroon-50/70 dark:bg-maroon-950/30 border border-maroon-200 dark:border-maroon-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-maroon-600 dark:text-neon-blue" />
              <div>
                <span className="font-bold text-gray-900 dark:text-white text-sm">
                  Create Member Portal Login Account
                </span>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Set a mock password to hand over manually. The member can change their password after login.
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
            <div className="pt-3 border-t border-maroon-200/60 dark:border-maroon-800/60 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Temporary / Mock Password <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] font-bold text-maroon-600 dark:text-neon-blue hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Generate Random
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={mockPassword}
                    onChange={(e) => setMockPassword(e.target.value)}
                    placeholder="Enter temporary password (min 6 chars)"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>}
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Provide this password to the member manually along with their email address.
                </p>
              </div>

              {!formData.email && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                  ⚠️ Please also fill in the <strong>Email Address</strong> field above to enable portal login.
                </div>
              )}
            </div>
          )}
        </div>

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
