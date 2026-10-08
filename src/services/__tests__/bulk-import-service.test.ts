import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { bulkImportService, type MemberImportRow } from '../bulk-import-service';
import { memberService } from '../member-service';
import type { MemberInsert } from '../../types/database';

vi.mock('../member-service', () => ({
  memberService: {
    checkExistingRegNos: vi.fn(),
    createMany: vi.fn(),
    create: vi.fn(),
    getByRegNo: vi.fn(),
  },
}));

vi.mock('../system-service', () => ({
  systemService: {
    getFaculties: vi.fn().mockResolvedValue([{ name: 'Computing' }]),
    getBatches: vi.fn().mockResolvedValue([{ name: '2023' }]),
  },
}));

describe('bulkImportService Chunking & Batching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('batches a 200-row import into 2 chunked checks and 2 chunked inserts (4 total requests instead of 400)', async () => {
    // Generate 200 valid test rows
    const rows: MemberImportRow[] = Array.from({ length: 200 }, (_, i) => ({
      reg_no: `22ABC${String(i + 1).padStart(4, '0')}`,
      full_name: `Member Name ${i + 1}`,
      name_with_initials: `M.N. ${i + 1}`,
      batch: '2023',
      faculty: 'Computing',
      whatsapp: '+94771234567',
    }));

    (memberService.checkExistingRegNos as unknown as Mock).mockResolvedValue(new Set());
    (memberService.createMany as unknown as Mock).mockResolvedValue([]);

    const result = await bulkImportService.importMembers(rows);

    expect(result.success).toBe(200);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);

    // 2 checkExistingRegNos calls (100 rows each)
    expect(memberService.checkExistingRegNos).toHaveBeenCalledTimes(2);
    // 2 createMany calls (100 rows each)
    expect(memberService.createMany).toHaveBeenCalledTimes(2);
    // 0 individual create calls
    expect(memberService.create).not.toHaveBeenCalled();
    // 0 individual getByRegNo calls
    expect(memberService.getByRegNo).not.toHaveBeenCalled();
  });

  it('falls back to row-by-row retry when a batch chunk fails, isolating failing rows', async () => {
    const rows: MemberImportRow[] = Array.from({ length: 5 }, (_, i) => ({
      reg_no: `22ABC${String(i + 1).padStart(4, '0')}`,
      full_name: `Member Name ${i + 1}`,
      name_with_initials: `M.N. ${i + 1}`,
      batch: '2023',
      faculty: 'Computing',
      whatsapp: '+94771234567',
    }));

    (memberService.checkExistingRegNos as unknown as Mock).mockResolvedValue(new Set());
    // Simulate batch insertion failure on chunk
    (memberService.createMany as unknown as Mock).mockRejectedValueOnce(new Error('Batch constraint violation'));

    // In fallback, row 3 fails, rows 1, 2, 4, 5 succeed
    (memberService.create as unknown as Mock).mockImplementation((m: MemberInsert) => {
      if (m.reg_no === '22ABC0003') {
        throw new Error('Specific duplicate key error on row 3');
      }
      return Promise.resolve({ ...m, total_points: 0 });
    });

    const result = await bulkImportService.importMembers(rows);

    expect(result.success).toBe(4);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(4); // 1-indexed header + index 2 = row 4
    expect(result.errors[0].error).toContain('Specific duplicate key error on row 3');
    expect(memberService.create).toHaveBeenCalledTimes(5);
  });

  it('detects duplicate registration numbers within the same file client-side before sending', async () => {
    const rows: MemberImportRow[] = [
      {
        reg_no: '22ABC1001',
        full_name: 'First Entry',
        name_with_initials: 'F. Entry',
        batch: '2023',
        faculty: 'Computing',
        whatsapp: '+94771234567',
      },
      {
        reg_no: '22ABC1001', // duplicate
        full_name: 'Second Entry',
        name_with_initials: 'S. Entry',
        batch: '2023',
        faculty: 'Computing',
        whatsapp: '+94777654321',
      },
    ];

    (memberService.checkExistingRegNos as unknown as Mock).mockResolvedValue(new Set());
    (memberService.createMany as unknown as Mock).mockResolvedValue([]);

    const result = await bulkImportService.importMembers(rows);

    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0].error).toContain('Duplicate registration number 22ABC1001 in upload file');
  });

  it('normalizes Sri Lankan local phone numbers starting with 0', async () => {
    const { normalizePhoneNumber } = await import('../bulk-import-service');
    expect(normalizePhoneNumber('0771234567')).toBe('+94771234567');
    expect(normalizePhoneNumber('+94771234567')).toBe('+94771234567');
  });

  it('stages rows, flags DB duplicates, and highlights invalid faculties/batches', async () => {
    (memberService.checkExistingRegNos as unknown as Mock).mockResolvedValue(new Set(['22EXIST999']));

    const testRows: MemberImportRow[] = [
      {
        reg_no: '22NEW001',
        full_name: 'Valid Member',
        name_with_initials: 'V. Member',
        batch: '2023',
        faculty: 'Computing',
        whatsapp: '0771234567',
      },
      {
        reg_no: '22EXIST999',
        full_name: 'Existing Member',
        name_with_initials: 'E. Member',
        batch: '2023',
        faculty: 'Computing',
        whatsapp: '+94771234567',
      },
      {
        reg_no: '22WRONG02',
        full_name: 'Invalid Faculty Member',
        name_with_initials: 'I. Member',
        batch: 'NonExistentBatch',
        faculty: 'NonExistentFaculty',
        whatsapp: '+94771234567',
      },
    ];

    const { stagedRows } = await bulkImportService.stageAndValidateRows(
      testRows,
      [{ id: '1', name: 'Computing', created_at: '' }],
      [{ id: '1', name: '2023', created_at: '' }]
    );

    expect(stagedRows).toHaveLength(3);
    // Row 1 is valid, phone normalized
    expect(stagedRows[0].isValid).toBe(true);
    expect(stagedRows[0].whatsapp).toBe('+94771234567');

    // Row 2 exists in DB
    expect(stagedRows[1].isValid).toBe(false);
    expect(stagedRows[1].existsInDb).toBe(true);

    // Row 3 has invalid faculty and batch
    expect(stagedRows[2].isValid).toBe(false);
    expect(stagedRows[2].errors.some(e => e.includes('Faculty'))).toBe(true);
    expect(stagedRows[2].errors.some(e => e.includes('Batch'))).toBe(true);
  });

  it('re-validates staged rows dynamically when user corrects invalid fields', () => {
    const validFaculties = new Set(['computing']);
    const validBatches = new Set(['2023']);
    const existingInDb = new Set(['22EXIST999']);

    const staged = [
      {
        id: 'row-1',
        rowNumber: 2,
        reg_no: '22FIX001',
        full_name: 'Fix Member',
        name_with_initials: 'F. Member',
        batch: 'InvalidBatch',
        faculty: 'InvalidFaculty',
        whatsapp: '+94771234567',
        my_lci_num: '',
        email: '',
        isValid: false,
        errors: ['Faculty error', 'Batch error'],
      },
    ];

    // Revalidate before fix: invalid
    const beforeFix = bulkImportService.revalidateStagedRows(staged, validFaculties, validBatches, existingInDb);
    expect(beforeFix[0].isValid).toBe(false);

    // User selects valid faculty and batch in dropdown
    const fixedRows = [
      {
        ...staged[0],
        faculty: 'Computing',
        batch: '2023',
      },
    ];

    const afterFix = bulkImportService.revalidateStagedRows(fixedRows, validFaculties, validBatches, existingInDb);
    expect(afterFix[0].isValid).toBe(true);
    expect(afterFix[0].errors).toHaveLength(0);
  });
});
