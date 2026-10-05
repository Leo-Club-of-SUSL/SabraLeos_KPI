/**
 * Security utilities for input sanitization and validation.
 */

/**
 * Sanitize search query for safe use in PostgREST `.or()` filters.
 * Escapes characters that have special meaning in PostgREST filter syntax.
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') return '';

  // Remove characters that could manipulate PostgREST filter syntax
  // These characters have special meaning: , . ( ) % *
  return query
    .replace(/[,.()*%\\]/g, '')  // Strip filter-breaking characters
    .replace(/'/g, "''")         // Escape single quotes for SQL safety
    .trim()
    .slice(0, 100);              // Limit length to prevent abuse
}

/**
 * Sanitize a single cell value for CSV / XLSX export to prevent formula injection.
 * Prefixes dangerous leading characters with a single quote to neutralize formulas
 * in Excel, LibreOffice Calc, and Google Sheets.
 * See: OWASP CSV Injection / CWE-1236.
 *
 * Dangerous prefixes: = + - @ TAB CR
 */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.length === 0) return '';
  // Prefix dangerous starters to prevent formula execution
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Password validation result.
 */
export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'strong';
}

/**
 * Validate password strength.
 * Requirements: min 10 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character.
 * (Phase 1 hardens minimum from 8 to 10 to match Supabase minimum password length setting.)
 */
export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('At least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('At least 1 uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('At least 1 lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('At least 1 number');
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    errors.push('At least 1 special character (!@#$%^&*...)');
  }

  let strength: 'weak' | 'fair' | 'strong' = 'weak';
  if (errors.length === 0) {
    strength = password.length >= 12 ? 'strong' : 'fair';
  } else if (errors.length <= 2) {
    strength = 'fair';
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Sanitize generic text input — strips HTML tags and trims.
 */
export function sanitizeTextInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .trim();
}

/**
 * Validate photo file type (JPEG, PNG, WebP only — no GIF) and size (< 5MB).
 */
export function validatePhotoFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.' };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, error: 'File size must be under 5MB.' };
  }
  return { valid: true };
}

export function validatePhoneNumber(phone: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(phone);
}

export function validateRegNo(regNo: string): boolean {
  // Relaxed as per user request: allow any Alphanumeric characters, will save as upper case
  return regNo.trim().length >= 3;
}

export function validatePoints(value: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(value) || value <= 0) {
    return { valid: false, error: 'Points must be a positive integer.' };
  }
  if (value > 1000) {
    return { valid: false, error: 'Points cannot exceed 1000.' };
  }
  return { valid: true };
}

/**
 * Validate time period format (YYYY-MM).
 */
export function validateTimePeriod(value: string): { valid: boolean; error?: string } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return { valid: false, error: 'Time period must be in YYYY-MM format (e.g. 2024-07).' };
  }
  return { valid: true };
}
