import { useState, useRef, useEffect } from 'react';
import { memberService } from '../services/member-service';
import { systemService } from '../services/system-service';
import { userService } from '../services/user-service';
import { Camera, Loader2, X, EyeOff, KeyRound, Copy, Check, Eye, RefreshCw, UserCheck, ShieldCheck } from 'lucide-react';
import { validatePhotoFile, validatePhoneNumber, sanitizeTextInput } from '../lib/sanitize';
import type { Member, Faculty, Batch as BatchType, MemberStatus, AppUser } from '../types/database';

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
    email: member.email || '',
    member_status: (member.member_status || 'active') as MemberStatus,
    leaderboard_opt_out: member.leaderboard_opt_out || false,
    display_alias: member.display_alias || '',
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

  // Portal login account state
  const [linkedUser, setLinkedUser] = useState<AppUser | null>(null);
  const [createAccount, setCreateAccount] = useState(false);
  const [mockPassword, setMockPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [showAdminNewPassword, setShowAdminNewPassword] = useState(false);
  const [passwordUpdateLoading, setPasswordUpdateLoading] = useState(false);
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState<string | null>(null);
  const [passwordUpdateError, setPasswordUpdateError] = useState<string | null>(null);

  const [credentialModal, setCredentialModal] = useState<{
    title: string;
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadSystemData = async () => {
      try {
        const [fData, bData, uData] = await Promise.all([
          systemService.getFaculties(),
          systemService.getBatches(),
          userService.getByLinkedMember(member.reg_no).catch(() => null),
        ]);
        setFaculties(fData);
        setBatches(bData);
        if (uData) {
          setLinkedUser(uData);
        }
      } catch (err) {
        console.error('Error loading form metadata:', err);
      } finally {
        setDataLoading(false);
      }
    };
    loadSystemData();
  }, [member.reg_no]);

  // Set default mock password for unlinked member
  useEffect(() => {
    if (!linkedUser && !mockPassword) {
      const clean = member.reg_no.replace(/[^a-zA-Z0-9]/g, '');
      setMockPassword(`Leo@${clean || 'Member'}2026!`);
    }
  }, [linkedUser, member.reg_no]);

  const generateRandomPassword = (forExisting = false) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let res = 'Leo@';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (forExisting) {
      setAdminNewPassword(res);
    } else {
      setMockPassword(res);
    }
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

  const handleAdminSetPassword = async () => {
    if (!linkedUser) return;
    if (!adminNewPassword || adminNewPassword.trim().length < 6) {
      setPasswordUpdateError('Password must be at least 6 characters');
      return;
    }

    setPasswordUpdateError(null);
    setPasswordUpdateSuccess(null);
    setPasswordUpdateLoading(true);

    try {
      await userService.adminSetUserPassword(linkedUser.id, adminNewPassword.trim());
      setPasswordUpdateSuccess('Temporary password set successfully!');
      setCredentialModal({
        title: 'Temporary Password Updated',
        email: formData.email || member.email || linkedUser.username,
        password: adminNewPassword.trim(),
      });
      setAdminNewPassword('');
    } catch (err) {
      setPasswordUpdateError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPasswordUpdateLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.full_name.trim()) errors.full_name = 'Full Name is required';
    if (!formData.name_with_initials.trim()) errors.name_with_initials = 'Name with Initials is required';
    if (!formData.batch) errors.batch = 'Batch selection is required';
    if (!formData.faculty) errors.faculty = 'Faculty selection is required';
    if (!validatePhoneNumber(formData.whatsapp)) errors.whatsapp = 'Invalid phone number format';
    if (formData.email && !formData.email.includes('@')) errors.email = 'Invalid email address';
    if (!linkedUser && createAccount && !formData.email) {
      errors.email = 'Email address is required to create portal login account';
    }
    if (!linkedUser && createAccount && mockPassword && mockPassword.length < 6) {
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
      let photoUrl = member.photo_url;

      if (photoFile) {
        try {
          photoUrl = await memberService.uploadPhoto(photoFile, member.photo_url);
        } catch (uploadError) {
          console.warn('Photo upload failed, keeping existing photo:', uploadError);
        }
      }

      const updated = await memberService.update(member.reg_no, {
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

      // If email changed on a linked user, update the auth email via Edge Function
      if (linkedUser && formData.email && formData.email !== member.email) {
        try {
          await userService.changeUserEmail(linkedUser.id, formData.email);
        } catch (emailErr) {
          console.warn('Member updated but auth email change failed:', emailErr);
          alert(`Member details updated, but auth email change encountered an issue: ${emailErr instanceof Error ? emailErr.message : 'Super admin required'}`);
        }
      }

      // Handle new account creation for unlinked member
      if (!linkedUser && createAccount && formData.email) {
        const passToUse = mockPassword || `Leo@${member.reg_no.replace(/[^a-zA-Z0-9]/g, '')}2026!`;
        try {
          const results = await userService.provisionMembers([member.reg_no], passToUse);
          const res = results[0];
          if (res?.status === 'failed') {
            alert(`Member updated, but account creation failed: ${res.message || 'Service unavailable'}`);
            onSuccess(updated);
            return;
          }

          setCredentialModal({
            title: 'Member Portal Account Created',
            email: formData.email,
            password: passToUse,
          });
          return;
        } catch (accErr) {
          console.error('Account creation failed:', accErr);
          alert(`Member details updated, but account setup encountered an issue: ${accErr instanceof Error ? accErr.message : 'Service unavailable'}`);
          onSuccess(updated);
          return;
        }
      }

      onSuccess(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member');
    } finally {
      setLoading(false);
    }
  };

  const copyCredentialsToClipboard = () => {
    if (!credentialModal) return;
    const text = `Leo Club SUSL - Portal Login Credentials\n\nMember: ${formData.name_with_initials || member.name_with_initials} (${member.reg_no})\nEmail: ${credentialModal.email}\nTemporary Password: ${credentialModal.password}\n\nLogin URL: ${window.location.origin}\n* Please change your password after logging in.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (credentialModal) {
    return (
      <div className="p-6 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <UserCheck className="w-8 h-8" />
        </div>

        <div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white">
            {credentialModal.title}
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manual credentials ready. Hand these over directly to the member.
          </p>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl text-left space-y-3 font-mono text-xs">
          <div>
            <span className="text-gray-500 uppercase text-[10px] block font-sans font-bold">Member</span>
            <span className="text-gray-900 dark:text-white font-bold">{formData.name_with_initials || member.name_with_initials} ({member.reg_no})</span>
          </div>
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-gray-500 uppercase text-[10px] block font-sans font-bold">Login Email</span>
            <span className="text-gray-900 dark:text-white select-all">{credentialModal.email}</span>
          </div>
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-gray-500 uppercase text-[10px] block font-sans font-bold">Temporary Password</span>
            <span className="text-maroon-600 dark:text-neon-blue font-bold select-all">{credentialModal.password}</span>
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
            onClick={() => onSuccess({ ...member, ...formData })}
            className="flex-1 px-4 py-3 bg-maroon-600 hover:bg-maroon-700 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-maroon-600/20"
          >
            Done & Close
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
            Click to change photo
          </p>
          {photoError && <p className="mt-1 text-xs text-red-500 text-center">{photoError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            University Reg No
          </label>
          <input
            type="text"
            value={formData.reg_no}
            disabled
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed uppercase font-mono"
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

        {/* Member Portal Login Account & Password Management */}
        <div className="md:col-span-2 p-5 rounded-2xl bg-maroon-50/70 dark:bg-maroon-950/30 border border-maroon-200 dark:border-maroon-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-maroon-600 dark:text-neon-blue" />
              <div>
                <span className="font-bold text-gray-900 dark:text-white text-sm">
                  {linkedUser ? 'Member Portal Account' : 'Create Member Portal Login Account'}
                </span>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {linkedUser
                    ? `Linked account (@${linkedUser.username || linkedUser.id.substring(0, 8)}) • Role: ${linkedUser.role} • Status: ${linkedUser.status}`
                    : 'Set mock credentials for this member to hand over manually'}
                </p>
              </div>
            </div>
            {!linkedUser && (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={createAccount}
                  onChange={(e) => setCreateAccount(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-maroon-600"></div>
              </label>
            )}
          </div>

          {/* If unlinked and creating account */}
          {!linkedUser && createAccount && (
            <div className="pt-3 border-t border-maroon-200/60 dark:border-maroon-800/60 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Temporary / Mock Password <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => generateRandomPassword(false)}
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
              </div>

              {!formData.email && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                  ⚠️ Please enter the member's <strong>Email Address</strong> above to create the portal login.
                </div>
              )}
            </div>
          )}

          {/* If linked: Set New Temporary Password Directly */}
          {linkedUser && (
            <div className="pt-3 border-t border-maroon-200/60 dark:border-maroon-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-700 dark:text-gray-300 font-bold">
                    Set New Temporary Password
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Directly updates the user's password so you can hand it over manually.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => generateRandomPassword(true)}
                  className="text-[11px] font-bold text-maroon-600 dark:text-neon-blue hover:underline flex items-center gap-1 shrink-0"
                >
                  <RefreshCw className="w-3 h-3" /> Generate Random
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type={showAdminNewPassword ? 'text' : 'password'}
                    value={adminNewPassword}
                    onChange={(e) => setAdminNewPassword(e.target.value)}
                    placeholder="Enter new temporary password"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminNewPassword(!showAdminNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showAdminNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAdminSetPassword}
                  disabled={passwordUpdateLoading || !adminNewPassword}
                  className="px-4 py-2 bg-maroon-600 hover:bg-maroon-700 disabled:bg-gray-400 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-sm"
                >
                  {passwordUpdateLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" /> Update Password
                    </>
                  )}
                </button>
              </div>

              {passwordUpdateSuccess && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                  ✓ {passwordUpdateSuccess}
                </div>
              )}
              {passwordUpdateError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-800 dark:text-red-300">
                  ⚠️ {passwordUpdateError}
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
          className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <X className="w-5 h-5" />
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
  );
}
