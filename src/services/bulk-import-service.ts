import { memberService } from './member-service';
import { systemService } from './system-service';
import { validatePhoneNumber, validateRegNo } from '../lib/sanitize';
import type { MemberInsert, Faculty, Batch as BatchType } from '../types/database';

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
    email?: string;
}

export interface StagedMemberRow {
    id: string;
    rowNumber: number;
    reg_no: string;
    full_name: string;
    name_with_initials: string;
    batch: string;
    faculty: string;
    whatsapp: string;
    my_lci_num: string;
    email: string;
    isValid: boolean;
    errors: string[];
    isDuplicateInFile?: boolean;
    existsInDb?: boolean;
}

/**
 * Normalizes Sri Lankan and international phone numbers.
 * e.g., converts '0771234567' -> '+94771234567'.
 */
export function normalizePhoneNumber(raw: string): string {
    const trimmed = (raw || '').trim();
    if (/^0\d{9}$/.test(trimmed)) {
        return '+94' + trimmed.slice(1);
    }
    return trimmed;
}

export const bulkImportService = {
    /**
     * Generate and download an enhanced template Excel file with:
     * 1. 'Members' data entry sheet with real sample data
     * 2. 'Valid_Selections' sheet listing active Faculties and Batches from DB with instructions
     */
    async downloadTemplate(): Promise<void> {
        const [faculties, batches, XLSX] = await Promise.all([
            systemService.getFaculties(),
            systemService.getBatches(),
            import('xlsx'),
        ]);

        const sampleFaculty = faculties[0]?.name || 'Faculty of Computing';
        const sampleBatch = batches[0]?.name || '2023/2024';

        // Sheet 1: Members Data Entry Template
        const templateData = [
            {
                reg_no: '22ABC1234',
                full_name: 'John Doe Smith',
                name_with_initials: 'J.D. Smith',
                batch: sampleBatch,
                faculty: sampleFaculty,
                whatsapp: '+94771234567',
                my_lci_num: '12345678',
                email: 'johndoe@example.com',
            },
            {
                reg_no: '22ABC1235',
                full_name: 'Jane Mary Johnson',
                name_with_initials: 'J.M. Johnson',
                batch: sampleBatch,
                faculty: sampleFaculty,
                whatsapp: '+94777654321',
                my_lci_num: '',
                email: 'jane@example.com',
            },
        ];

        const membersWorksheet = XLSX.utils.json_to_sheet(templateData);

        // Column widths for Members sheet
        membersWorksheet['!cols'] = [
            { wch: 18 }, // reg_no
            { wch: 28 }, // full_name
            { wch: 22 }, // name_with_initials
            { wch: 16 }, // batch
            { wch: 35 }, // faculty
            { wch: 18 }, // whatsapp
            { wch: 16 }, // my_lci_num
            { wch: 26 }, // email
        ];

        // Sheet 2: Reference & Valid Selections Sheet
        const maxRows = Math.max(faculties.length, batches.length, 8);
        const referenceData: Array<{
            'Available Faculties (Exact)': string;
            'Available Batches (Exact)': string;
            'Field Formatting Guidelines': string;
        }> = [];

        const guidelines = [
            'Registration Number: Minimum 3 characters (e.g. 22ABC1234). Must be unique.',
            'Full Name: Member full legal name.',
            'Name with Initials: Format with initials (e.g. J.D. Smith).',
            'Faculty: Must match an existing faculty or be selected in the Nexus KPI preview.',
            'Batch: Must match an existing batch or be selected in the Nexus KPI preview.',
            'WhatsApp Number: International (+9477...) or local format (077...).',
            'MyLCI Number: (Optional) Lions Club International ID if available.',
            'Email: (Optional) Used for Member Portal login access.',
        ];

        for (let i = 0; i < maxRows; i++) {
            referenceData.push({
                'Available Faculties (Exact)': faculties[i]?.name || '',
                'Available Batches (Exact)': batches[i]?.name || '',
                'Field Formatting Guidelines': guidelines[i] || '',
            });
        }

        const optionsWorksheet = XLSX.utils.json_to_sheet(referenceData);
        optionsWorksheet['!cols'] = [
            { wch: 36 }, // Faculties
            { wch: 22 }, // Batches
            { wch: 75 }, // Guidelines
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, membersWorksheet, 'Members');
        XLSX.utils.book_append_sheet(workbook, optionsWorksheet, 'Valid_Selections');

        // Download the file
        XLSX.writeFile(workbook, 'member_import_template.xlsx');
    },

    /**
     * Parse Excel file and extract normalized member data
     */
    async parseExcelFile(file: File): Promise<MemberImportRow[]> {
        const XLSX = await import('xlsx');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });

                    // Find first sheet that is not reference/options, or default to first sheet
                    const targetSheetName = workbook.SheetNames.find(
                        name => !name.toLowerCase().includes('option') && !name.toLowerCase().includes('valid') && !name.toLowerCase().includes('reference')
                    ) || workbook.SheetNames[0];

                    const worksheet = workbook.Sheets[targetSheetName];
                    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

                    const normalizedRows: MemberImportRow[] = rawData.map(raw => {
                        const findValue = (possibleKeys: string[]): string => {
                            for (const key of Object.keys(raw)) {
                                const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                                for (const pk of possibleKeys) {
                                    if (cleanKey === pk.toLowerCase().replace(/[^a-z0-9]/g, '')) {
                                        const val = raw[key];
                                        return val !== null && val !== undefined ? String(val).trim() : '';
                                    }
                                }
                            }
                            return '';
                        };

                        const rawWhatsapp = findValue(['whatsapp', 'whatsapp_number', 'phone', 'contact', 'mobile', 'whatsapp no', 'whatsapp number']);
                        const normalizedWhatsapp = normalizePhoneNumber(rawWhatsapp);

                        return {
                            reg_no: findValue(['reg_no', 'regno', 'registration_number', 'reg_number', 'reg no', 'registration number']),
                            full_name: findValue(['full_name', 'fullname', 'name', 'full name']),
                            name_with_initials: findValue(['name_with_initials', 'namewithinitials', 'initials', 'name with initials', 'name_initials']),
                            batch: findValue(['batch', 'academic_batch', 'academic batch']),
                            faculty: findValue(['faculty', 'department', 'faculty_name', 'faculty name']),
                            whatsapp: normalizedWhatsapp,
                            my_lci_num: findValue(['my_lci_num', 'mylci', 'lci_num', 'lci_number', 'mylci_num', 'my lci number', 'my lci num']),
                            email: findValue(['email', 'email_address', 'e-mail', 'email address']),
                        };
                    });

                    resolve(normalizedRows);
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
     * Validate a single member row (standalone check for backward compatibility)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validateMemberRow(row: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!row.reg_no || typeof row.reg_no !== 'string' || row.reg_no.trim() === '') {
            errors.push('Registration number is required');
        } else if (row.reg_no.trim().length < 3) {
            errors.push('Registration number must be at least 3 characters');
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
        } else if (!validatePhoneNumber(normalizePhoneNumber(row.whatsapp))) {
            errors.push('Invalid phone number format');
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    },

    /**
     * Staging & Validation Pipeline for Interactive Review:
     * Converts parsed rows into StagedMemberRows and performs batch DB duplicate checks.
     */
    async stageAndValidateRows(
        rows: MemberImportRow[],
        faculties: Faculty[],
        batches: BatchType[]
    ): Promise<{
        stagedRows: StagedMemberRow[];
        existingInDb: Set<string>;
        validFacultyNames: Set<string>;
        validBatchNames: Set<string>;
    }> {
        const validFacultyNames = new Set(faculties.map(f => f.name.toLowerCase().trim()));
        const validBatchNames = new Set(batches.map(b => b.name.toLowerCase().trim()));

        // Batch check existing registration numbers in DB (chunked by 100)
        const allRegNos = rows.map(r => (r.reg_no || '').trim().toUpperCase()).filter(Boolean);
        const existingInDb = new Set<string>();

        const CHUNK_SIZE = 100;
        for (let i = 0; i < allRegNos.length; i += CHUNK_SIZE) {
            const chunk = allRegNos.slice(i, i + CHUNK_SIZE);
            try {
                const found = await memberService.checkExistingRegNos(chunk);
                found.forEach(r => existingInDb.add(r));
            } catch (err) {
                console.warn('Batch DB check error:', err);
            }
        }

        // Initialize staged rows
        const initialStaged: StagedMemberRow[] = rows.map((row, index) => {
            const id = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `row-${index}-${Date.now()}`;

            return {
                id,
                rowNumber: index + 2, // Excel 1-indexed header + data
                reg_no: (row.reg_no || '').trim().toUpperCase(),
                full_name: (row.full_name || '').trim(),
                name_with_initials: (row.name_with_initials || '').trim(),
                batch: (row.batch || '').trim(),
                faculty: (row.faculty || '').trim(),
                whatsapp: normalizePhoneNumber(row.whatsapp || ''),
                my_lci_num: (row.my_lci_num || '').trim(),
                email: (row.email || '').trim(),
                isValid: true,
                errors: [],
                isDuplicateInFile: false,
                existsInDb: false,
            };
        });

        // Run validation rules
        const validatedStaged = this.revalidateStagedRows(
            initialStaged,
            validFacultyNames,
            validBatchNames,
            existingInDb
        );

        return {
            stagedRows: validatedStaged,
            existingInDb,
            validFacultyNames,
            validBatchNames,
        };
    },

    /**
     * Synchronous re-validation helper that updates row status in real time
     * as the user edits values or chooses dropdown selections.
     */
    revalidateStagedRows(
        rows: StagedMemberRow[],
        validFacultyNames: Set<string>,
        validBatchNames: Set<string>,
        existingInDb: Set<string>
    ): StagedMemberRow[] {
        // Count occurrences of each registration number in upload
        const regNoCounts = new Map<string, number>();
        for (const row of rows) {
            const clean = row.reg_no.trim().toUpperCase();
            if (clean) {
                regNoCounts.set(clean, (regNoCounts.get(clean) || 0) + 1);
            }
        }

        return rows.map(row => {
            const errors: string[] = [];
            const cleanRegNo = row.reg_no.trim().toUpperCase();

            // Registration number checks
            let isDuplicateInFile = false;
            let rowExistsInDb = false;

            if (!cleanRegNo) {
                errors.push('Registration number is required');
            } else if (!validateRegNo(cleanRegNo)) {
                errors.push('Registration number must be at least 3 characters');
            } else {
                if ((regNoCounts.get(cleanRegNo) || 0) > 1) {
                    isDuplicateInFile = true;
                    errors.push('Duplicate registration number in upload file');
                }
                if (existingInDb.has(cleanRegNo)) {
                    rowExistsInDb = true;
                    errors.push(`Registration number ${cleanRegNo} already exists in database`);
                }
            }

            // Full Name checks
            if (!row.full_name.trim()) {
                errors.push('Full name is required');
            }

            // Name with initials checks
            if (!row.name_with_initials.trim()) {
                errors.push('Name with initials is required');
            }

            // Batch selection check
            if (!row.batch.trim()) {
                errors.push('Batch is required');
            } else if (validBatchNames.size > 0 && !validBatchNames.has(row.batch.toLowerCase().trim())) {
                errors.push(`Batch "${row.batch}" does not match active batches`);
            }

            // Faculty selection check
            if (!row.faculty.trim()) {
                errors.push('Faculty is required');
            } else if (validFacultyNames.size > 0 && !validFacultyNames.has(row.faculty.toLowerCase().trim())) {
                errors.push(`Faculty "${row.faculty}" does not match active faculties`);
            }

            // Phone validation
            const cleanPhone = normalizePhoneNumber(row.whatsapp);
            if (!cleanPhone) {
                errors.push('WhatsApp number is required');
            } else if (!validatePhoneNumber(cleanPhone)) {
                errors.push('Invalid phone number format (e.g. +94771234567)');
            }

            // Optional email check
            if (row.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
                errors.push('Invalid email address format');
            }

            return {
                ...row,
                whatsapp: cleanPhone,
                isValid: errors.length === 0,
                errors,
                isDuplicateInFile,
                existsInDb: rowExistsInDb,
            };
        });
    },

    /**
     * Import members from parsed Excel data or StagedMemberRows in chunks of 100 rows per request,
     * with automatic row-by-row retry fallback if a chunk fails.
     */
    async importMembers(rows: MemberImportRow[] | StagedMemberRow[]): Promise<ImportResult> {
        const result: ImportResult = {
            success: 0,
            failed: 0,
            errors: [],
        };

        if (!rows || rows.length === 0) {
            return result;
        }

        // Check if rows are already staged
        const isStaged = (r: unknown): r is StagedMemberRow => (
            typeof r === 'object' && r !== null && 'id' in r && 'isValid' in r
        );

        const validCandidates: Array<{
            rowNumber: number;
            row: MemberImportRow | StagedMemberRow;
            memberData: MemberInsert;
        }> = [];

        const seenRegNos = new Set<string>();

        // Step 1: Filter and prepare valid candidates
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNumber = isStaged(row) ? row.rowNumber : i + 2;

            if (isStaged(row)) {
                if (!row.isValid) {
                    result.failed++;
                    result.errors.push({
                        row: rowNumber,
                        error: row.errors.join(', '),
                        data: row,
                    });
                    continue;
                }
            } else {
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
            }

            const cleanRegNo = row.reg_no.trim().toUpperCase();
            if (seenRegNos.has(cleanRegNo)) {
                result.failed++;
                result.errors.push({
                    row: rowNumber,
                    error: `Duplicate registration number ${row.reg_no} in upload file`,
                    data: row,
                });
                continue;
            }
            seenRegNos.add(cleanRegNo);

            const memberData: MemberInsert = {
                reg_no: cleanRegNo,
                full_name: row.full_name.trim(),
                name_with_initials: row.name_with_initials.trim(),
                batch: row.batch.toString().trim(),
                faculty: row.faculty.trim(),
                whatsapp: normalizePhoneNumber(row.whatsapp ? row.whatsapp.toString().trim() : ''),
                my_lci_num: row.my_lci_num ? row.my_lci_num.toString().trim() : null,
                email: (row as StagedMemberRow).email?.trim() || (row as MemberImportRow).email?.trim() || null,
                total_points: 0,
            };

            validCandidates.push({
                rowNumber,
                row,
                memberData,
            });
        }

        if (validCandidates.length === 0) {
            return result;
        }

        // Step 2: Batch duplicate check against database in chunks of 100
        const CHUNK_SIZE = 100;
        const existingInDb = new Set<string>();

        for (let i = 0; i < validCandidates.length; i += CHUNK_SIZE) {
            const chunk = validCandidates.slice(i, i + CHUNK_SIZE);
            const regNos = chunk.map(c => c.memberData.reg_no);
            try {
                const existing = await memberService.checkExistingRegNos(regNos);
                existing.forEach(r => existingInDb.add(r));
            } catch (err) {
                console.warn('Batch check error, falling back to individual checks for chunk:', err);
                for (const candidate of chunk) {
                    try {
                        const exists = await memberService.getByRegNo(candidate.memberData.reg_no);
                        if (exists) existingInDb.add(candidate.memberData.reg_no);
                    } catch {
                        // ignore and let insert handle it
                    }
                }
            }
        }

        // Filter out candidates that already exist in DB
        const toInsert: Array<{
            rowNumber: number;
            row: MemberImportRow | StagedMemberRow;
            memberData: MemberInsert;
        }> = [];

        for (const candidate of validCandidates) {
            if (existingInDb.has(candidate.memberData.reg_no)) {
                result.failed++;
                result.errors.push({
                    row: candidate.rowNumber,
                    error: `Member with registration number ${candidate.row.reg_no} already exists`,
                    data: candidate.row,
                });
            } else {
                toInsert.push(candidate);
            }
        }

        // Step 3: Insert valid new members in chunks of 100 with row-by-row fallback
        for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
            const chunk = toInsert.slice(i, i + CHUNK_SIZE);
            try {
                await memberService.createMany(chunk.map(c => c.memberData));
                result.success += chunk.length;
            } catch (chunkError) {
                console.warn('Chunk insert failed, retrying row-by-row to isolate failing records:', chunkError);
                // Fallback: retry only this chunk row-by-row
                for (const item of chunk) {
                    try {
                        await memberService.create(item.memberData);
                        result.success++;
                    } catch (rowError) {
                        result.failed++;
                        result.errors.push({
                            row: item.rowNumber,
                            error: rowError instanceof Error ? rowError.message : 'Failed to create member',
                            data: item.row,
                        });
                    }
                }
            }
        }

        return result;
    },
};
