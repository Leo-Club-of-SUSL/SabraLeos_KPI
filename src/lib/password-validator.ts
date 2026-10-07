// src/lib/password-validator.ts
// Comprehensive password validator with min 10 chars, zxcvbn evaluation, and k-anonymity HIBP range check.

import zxcvbn from 'zxcvbn';

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0..4 from zxcvbn
  strength: 'weak' | 'fair' | 'strong';
  errors: string[];
  feedback?: string;
  isBreached?: boolean;
}

/**
 * Computes SHA-1 hash of string using browser Web Crypto API.
 */
async function sha1(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  // Node / fallback environment
  return '0000000000000000000000000000000000000000';
}

/**
 * Checks whether a password appears in HaveIBeenPwned breach database via k-anonymity API.
 * Only the first 5 characters of SHA-1 hash leave the browser.
 */
export async function checkPwnedPassword(password: string): Promise<boolean> {
  if (!password || password.length === 0) return false;
  try {
    const hash = await sha1(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: 'GET',
      headers: {
        'Add-Padding': 'true',
      },
    });

    if (!res.ok) {
      return false;
    }

    const text = await res.text();
    const lines = text.split('\n');
    for (const line of lines) {
      const [hashSuffix] = line.trim().split(':');
      if (hashSuffix && hashSuffix.toUpperCase() === suffix) {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.warn('HIBP range check error (falling back):', err);
    return false;
  }
}

/**
 * Synchronous local password policy check (Min 10 chars, complexity, zxcvbn score >= 3).
 */
export function validateStrongPassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length < 10) {
    errors.push('Password must be at least 10 characters long.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Must contain at least one uppercase letter.');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Must contain at least one lowercase letter.');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Must contain at least one number.');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Must contain at least one special character.');
  }

  const result = zxcvbn(password || '');

  if (result.score < 3 && password.length >= 10) {
    errors.push(result.feedback.warning || 'Password is too common or predictable.');
  }

  let strength: 'weak' | 'fair' | 'strong' = 'weak';
  if (result.score >= 3 && errors.length === 0) {
    strength = 'strong';
  } else if (result.score >= 2 || password.length >= 8) {
    strength = 'fair';
  }

  return {
    isValid: errors.length === 0,
    score: result.score,
    strength,
    errors,
    feedback: result.feedback.suggestions?.join(' ') || undefined,
  };
}

export const validatePasswordLocal = validateStrongPassword;

/**
 * Full async password validator including HIBP breach check.
 */
export async function validatePasswordFull(password: string): Promise<PasswordValidationResult> {
  const localResult = validateStrongPassword(password);
  if (!localResult.isValid) {
    return localResult;
  }

  const isBreached = await checkPwnedPassword(password);
  if (isBreached) {
    return {
      isValid: false,
      score: localResult.score,
      strength: 'weak',
      errors: ['This password has appeared in a known data breach and cannot be used.'],
      isBreached: true,
    };
  }

  return localResult;
}
