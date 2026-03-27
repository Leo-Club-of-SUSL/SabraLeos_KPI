import * as XLSX from 'xlsx';
import { memberService } from './member-service';
import { systemService } from './system-service';
import type { MemberInsert } from '../types/database';

export interface ImportResult {
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string; data?: unknown }>;
}

export interface MemberImportRow {
    reg_no: string;
    full_name: string;
    name_with_initials: string;
    batch: string;
    faculty: string;
    whatsapp: string;
    my_lci_num?: string;
}

export const bulkImportService = {
    /**
     * Generate and download a template Excel file
     */
    async downloadTemplate(): Promise<void> {
        const [faculties, batches] = await Promise.all([
            systemService.getFaculties(),
            systemService.getBatches(),
        ]);

        const sampleFaculty = faculties[0]?.name || 'Faculty of Computing';
        const sampleBatch = batches[0]?.name || '2023/2024';

        const templateData = [
            {
                reg_no: '22ABC1234',
                full_name: 'John Doe Smith',
                name_with_initials: 'J.D. Smith',
                batch: sampleBatch,
                faculty: sampleFaculty,
                whatsapp: '+94771234567',
                my_lci_num: '12345678',
            },
            {
                reg_no: '22ABC1235',
                full_name: 'Jane Mary Johnson',
                name_with_initials: 'J.M. Johnson',
                batch: sampleBatch,
                faculty: sampleFaculty,
                whatsapp: '+94777654321',
                my_lci_num: '',
            },
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);

        // Set column widths
        worksheet['!cols'] = [
            { wch: 15 }, // reg_no
            { wch: 25 }, // full_name
            { wch: 20 }, // name_with_initials
            { wch: 10 }, // batch
            { wch: 40 }, // faculty
            { wch: 15 }, // whatsapp
            { wch: 15 }, // my_lci_num
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Members');

        // Download the file
        XLSX.writeFile(workbook, 'member_import_template.xlsx');
    },

    /**
     * Parse Excel file and extract member data
     */
    async parseExcelFile(file: File): Promise<MemberImportRow[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json<MemberImportRow>(worksheet);

                    resolve(jsonData);
                } catch {
                    reject(new Error('Failed to parse Excel file. Please ensure it matches the template format.'));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsBinaryString(file);
        });
    },

    /**
     * Validate a single member row
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validateMemberRow(row: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!row.reg_no || typeof row.reg_no !== 'string' || row.reg_no.trim() === '') {
            errors.push('Registration number is required');
        }

        if (!row.full_name || typeof row.full_name !== 'string' || row.full_name.trim() === '') {
            errors.push('Full name is required');
        }

        if (!row.name_with_initials || typeof row.name_with_initials !== 'string' || row.name_with_initials.trim() === '') {
            errors.push('Name with initials is required');
        }

        if (!row.batch || typeof row.batch !== 'string' || row.batch.trim() === '') {
            errors.push('Batch is required');
        }

        if (!row.faculty || typeof row.faculty !== 'string' || row.faculty.trim() === '') {
            errors.push('Faculty is required');
        }

        if (!row.whatsapp || typeof row.whatsapp !== 'string' || row.whatsapp.trim() === '') {
            errors.push('WhatsApp number is required');
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    },

    /**
     * Import members from parsed Excel data
     */
    async importMembers(rows: MemberImportRow[]): Promise<ImportResult> {
        const result: ImportResult = {
            success: 0,
            failed: 0,
            errors: [],
        };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNumber = i + 2; // +2 because Excel is 1-indexed and has a header row

            // Validate row
            const validation = this.validateMemberRow(row);
            if (!validation.valid) {
                result.failed++;
                result.errors.push({
                    row: rowNumber,
                    error: validation.errors.join(', '),
                    data: row,
                });
                continue;
            }

            try {
                // Check if member already exists
                const existing = await memberService.getByRegNo(row.reg_no.trim());
                if (existing) {
                    result.failed++;
                    result.errors.push({
                        row: rowNumber,
                        error: `Member with registration number ${row.reg_no} already exists`,
                        data: row,
                    });
                    continue;
                }

                // Create member
                const memberData: MemberInsert = {
                    reg_no: row.reg_no.trim().toUpperCase(),
                    full_name: row.full_name.trim(),
                    name_with_initials: row.name_with_initials.trim(),
                    batch: row.batch.toString().trim(),
                    faculty: row.faculty.trim(),
                    whatsapp: row.whatsapp.toString().trim(),
                    my_lci_num: row.my_lci_num ? row.my_lci_num.toString().trim() : null,
                    total_points: 0,
                };

                await memberService.create(memberData);
                result.success++;
            } catch (error) {
                result.failed++;
                result.errors.push({
                    row: rowNumber,
                    error: error instanceof Error ? error.message : 'Unknown error occurred',
                    data: row,
                });
            }
        }

        return result;
    },
};
