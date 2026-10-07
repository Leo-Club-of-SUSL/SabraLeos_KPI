import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bulkImportService, type MemberImportRow } from '../bulk-import-service';
import { memberService } from '../member-service';

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

    (memberService.checkExistingRegNos as any).mockResolvedValue(new Set());
    (memberService.createMany as any).mockResolvedValue([]);

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

    (memberService.checkExistingRegNos as any).mockResolvedValue(new Set());
    // Simulate batch insertion failure on chunk
    (memberService.createMany as any).mockRejectedValueOnce(new Error('Batch constraint violation'));

    // In fallback, row 3 fails, rows 1, 2, 4, 5 succeed
    (memberService.create as any).mockImplementation((m: any) => {
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

    (memberService.checkExistingRegNos as any).mockResolvedValue(new Set());
    (memberService.createMany as any).mockResolvedValue([]);

    const result = await bulkImportService.importMembers(rows);

    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0].error).toContain('Duplicate registration number 22ABC1001 in upload file');
  });
});
