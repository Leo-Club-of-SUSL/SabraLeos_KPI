import { describe, it, expect } from 'vitest';
import { sanitizeSearchQuery, validatePassword, sanitizeTextInput } from '../sanitize';

// =========================================================
// sanitizeSearchQuery
// =========================================================
describe('sanitizeSearchQuery', () => {
    it('returns empty string for empty input', () => {
        expect(sanitizeSearchQuery('')).toBe('');
    });

    it('returns empty string for null/undefined', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(sanitizeSearchQuery(null as any)).toBe('');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(sanitizeSearchQuery(undefined as any)).toBe('');
    });

    it('preserves normal text', () => {
        expect(sanitizeSearchQuery('John Doe')).toBe('John Doe');
    });

    it('preserves alphanumeric registration numbers', () => {
        expect(sanitizeSearchQuery('S/2021/001')).toBe('S/2021/001');
    });

    it('strips commas that could break .or() filters', () => {
        expect(sanitizeSearchQuery('test,admin')).toBe('testadmin');
    });

    it('strips dots that could manipulate filter operators', () => {
        expect(sanitizeSearchQuery('test.eq.secret')).toBe('testeqsecret');
    });

    it('strips parentheses', () => {
        expect(sanitizeSearchQuery('test()')).toBe('test');
    });

    it('strips percent signs used in wildcards', () => {
        expect(sanitizeSearchQuery('100%')).toBe('100');
    });

    it('strips asterisks', () => {
        expect(sanitizeSearchQuery('admin*')).toBe('admin');
    });

    it('escapes single quotes for SQL safety', () => {
        expect(sanitizeSearchQuery("O'Brien")).toBe("O''Brien");
    });

    it('trims whitespace', () => {
        expect(sanitizeSearchQuery('  hello  ')).toBe('hello');
    });

    it('limits length to 100 characters', () => {
        const longInput = 'a'.repeat(200);
        expect(sanitizeSearchQuery(longInput).length).toBe(100);
    });

    it('handles an injection attempt gracefully', () => {
        const malicious = 'test),full_name.eq.admin';
        const result = sanitizeSearchQuery(malicious);
        // Should not contain commas, dots, or parentheses
        expect(result).not.toContain(',');
        expect(result).not.toContain('.');
        expect(result).not.toContain('(');
        expect(result).not.toContain(')');
    });
});

// =========================================================
// validatePassword
// =========================================================
describe('validatePassword', () => {
    it('rejects a short password (< 10 chars)', () => {
        const result = validatePassword('Ab1!5678');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least 10 characters');
    });

    it('rejects password without uppercase', () => {
        const result = validatePassword('abcdefgh1!');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least 1 uppercase letter');
    });

    it('rejects password without lowercase', () => {
        const result = validatePassword('ABCDEFGH1!');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least 1 lowercase letter');
    });

    it('rejects password without a number', () => {
        const result = validatePassword('Abcdefghij!');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least 1 number');
    });

    it('rejects password without a special character', () => {
        const result = validatePassword('Abcdefghi1');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least 1 special character (!@#$%^&*...)');
    });

    it('accepts a valid password (10+ chars)', () => {
        const result = validatePassword('Abcdefgh1!');
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.strength).toBe('fair');
    });

    it('rates a 12+ char valid password as strong', () => {
        const result = validatePassword('Abcdefghij1!');
        expect(result.isValid).toBe(true);
        expect(result.strength).toBe('strong');
    });

    it('rates a password missing some requirements as fair', () => {
        const result = validatePassword('abcdefghij');
        // Missing uppercase, number, special — 3 errors → weak
        expect(result.strength).toBe('weak');
    });

    it('rates a password with only 1-2 missing requirements as fair', () => {
        const result = validatePassword('Abcdefgh1');
        // Missing special char only — 1 error → fair
        expect(result.strength).toBe('fair');
    });
});

// =========================================================
// sanitizeTextInput
// =========================================================
describe('sanitizeTextInput', () => {
    it('returns empty string for empty input', () => {
        expect(sanitizeTextInput('')).toBe('');
    });

    it('strips HTML tags', () => {
        expect(sanitizeTextInput('<script>alert("xss")</script>')).toBe('alert("xss")');
    });

    it('strips nested HTML', () => {
        expect(sanitizeTextInput('<b><i>Hello</i></b>')).toBe('Hello');
    });

    it('trims whitespace', () => {
        expect(sanitizeTextInput('  hello  ')).toBe('hello');
    });

    it('preserves normal text', () => {
        expect(sanitizeTextInput('Normal text 123')).toBe('Normal text 123');
    });
});
