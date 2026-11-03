import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { memberService } from '../member-service';
import { userService } from '../user-service';
import { supabase } from '../../lib/supabase';
import { db } from '../../lib/supabase-helpers';

vi.mock('../user-service', () => ({
  userService: {
    deleteByLinkedMember: vi.fn(),
    cleanupOrphanedMemberAccounts: vi.fn(),
    delete: vi.fn(),
    getByLinkedMember: vi.fn(),
  },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock('../../lib/supabase-helpers', () => ({
  db: vi.fn(),
}));

describe('Member Account Automatic Deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('automatically triggers userService.deleteByLinkedMember when a member is soft-deleted', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      ilike: vi.fn().mockResolvedValue({ error: null }),
    });

    (db as unknown as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: mockUpdate,
      }),
    });

    (userService.deleteByLinkedMember as unknown as Mock).mockResolvedValue({
      success: true,
      deleted_count: 1,
    });

    await memberService.softDelete('leo/2024/001');

    // Verification 1: Soft-delete in database
    expect(db).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: expect.any(String),
      })
    );

    // Verification 2: Automatic account deletion called with sanitized uppercase registration number
    expect(userService.deleteByLinkedMember).toHaveBeenCalledWith('LEO/2024/001');
  });

  it('automatically triggers userService.deleteByLinkedMember when a member is permanently purged', async () => {
    const mockDelete = vi.fn().mockReturnValue({
      ilike: vi.fn().mockResolvedValue({ error: null }),
    });

    (supabase.from as unknown as Mock).mockReturnValue({
      delete: mockDelete,
    });

    (userService.deleteByLinkedMember as unknown as Mock).mockResolvedValue({
      success: true,
      deleted_count: 1,
    });

    await memberService.purge('leo/2024/002');

    // Verification 1: Automatic account deletion called first
    expect(userService.deleteByLinkedMember).toHaveBeenCalledWith('LEO/2024/002');

    // Verification 2: Hard delete performed in Supabase
    expect(supabase.from).toHaveBeenCalledWith('members');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('continues soft-delete even if user account service reports non-fatal error', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      ilike: vi.fn().mockResolvedValue({ error: null }),
    });

    (db as unknown as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: mockUpdate,
      }),
    });

    // Simulate account deletion service warning/failure (e.g. member had no portal account)
    (userService.deleteByLinkedMember as unknown as Mock).mockRejectedValue(
      new Error('Account service unavailable')
    );

    // Should not throw unhandled exception
    await expect(memberService.softDelete('LEO/2024/003')).resolves.not.toThrow();

    expect(userService.deleteByLinkedMember).toHaveBeenCalledWith('LEO/2024/003');
  });
});

