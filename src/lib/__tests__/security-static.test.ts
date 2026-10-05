import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { validateStrongPassword } from '../password-validator';
import { stripExifMetadata } from '../image-utils';

function walkDir(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('dist') && !file.includes('.git') && file !== '__tests__') {
        walkDir(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

describe('A. Security Static Code Guard', () => {
  const srcDir = path.resolve(__dirname, '../../');

  it('fails if client-side supabase.auth.signUp exists anywhere in src/', () => {
    const srcFiles = walkDir(srcDir);
    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('.auth.signUp') || line.includes('auth.signUp(')) {
          violations.push({
            file: path.relative(srcDir, file),
            line: index + 1,
            text: line.trim(),
          });
        }
      });
    }

    expect(violations, `Found forbidden client auth.signUp calls: ${JSON.stringify(violations, null, 2)}`).toHaveLength(0);
  });

  it('fails if service_role key string appears anywhere in client src/', () => {
    const srcFiles = walkDir(srcDir);
    const violations: { file: string; line: number }[] = [];

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        // Exclude test assertions or comments describing service role
        if (line.includes('service_role') && !line.includes('//') && !line.includes('*') && !file.includes('security-static.test')) {
          violations.push({
            file: path.relative(srcDir, file),
            line: index + 1,
          });
        }
      });
    }

    expect(violations, `Found service_role reference in src: ${JSON.stringify(violations, null, 2)}`).toHaveLength(0);
  });
});

describe('B2. Password Policy & Strength Validation', () => {
  it('rejects passwords shorter than 10 characters', () => {
    const res = validateStrongPassword('Leo@123#');
    expect(res.isValid).toBe(false);
    expect(res.errors).toContain('Password must be at least 10 characters long.');
  });

  it('rejects common passwords or low entropy passwords', () => {
    const res = validateStrongPassword('Password123!@#');
    expect(res.isValid).toBe(false);
  });

  it('accepts strong, high-entropy passwords with 10+ chars', () => {
    const res = validateStrongPassword('K@v1ndu_Leo#2026!SUSL');
    expect(res.isValid).toBe(true);
    expect(res.strength).toBe('strong');
    expect(res.errors).toHaveLength(0);
  });
});

describe('F4. Photo Privacy & EXIF Stripping', () => {
  it('strips EXIF metadata and outputs clean image blob', async () => {
    // Mock FileReader & Image in jsdom environment
    const originalFileReader = globalThis.FileReader;
    const originalImage = globalThis.Image;

    class MockFileReader {
      onload: ((e: { target: { result: string } }) => void) | null = null;
      readAsDataURL() {
        setTimeout(() => {
          if (this.onload) this.onload({ target: { result: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' } });
        }, 10);
      }
    }

    class MockImage {
      width = 400;
      height = 400;
      onload: (() => void) | null = null;
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 10);
      }
    }

    // @ts-expect-error Mocking for test
    globalThis.FileReader = MockFileReader;
    // @ts-expect-error Mocking for test
    globalThis.Image = MockImage;

    // Mock HTMLCanvasElement
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    // @ts-expect-error Mocking for test
    HTMLCanvasElement.prototype.getContext = () => ({
      drawImage: () => {},
    });
    HTMLCanvasElement.prototype.toBlob = function(callback: (b: Blob | null) => void, type?: string) {
      callback(new Blob(['clean_jpeg_data'], { type: type || 'image/jpeg' }));
    };

    try {
      const mockFile = new File([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x16, 0x45, 0x78, 0x69, 0x66])], 'avatar.jpg', {
        type: 'image/jpeg',
      });

      const sanitized = await stripExifMetadata(mockFile);
      expect(sanitized).toBeInstanceOf(Blob);
      expect(sanitized.type).toBe('image/jpeg');
    } finally {
      globalThis.FileReader = originalFileReader;
      globalThis.Image = originalImage;
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
    }
  });
});
