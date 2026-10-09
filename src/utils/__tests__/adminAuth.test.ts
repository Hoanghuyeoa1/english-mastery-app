// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { isUserAdmin, useIsAdmin } from '../adminAuth';
import { useCloudSyncStore } from '../../services/cloudSyncService';

describe('adminAuth RBAC tests', () => {
  beforeEach(() => {
    useCloudSyncStore.getState().setUser(null);
  });

  it('does NOT grant admin to legacy hardcoded email addresses', () => {
    // Neither email strings nor users with legacy email get admin unless they have ADMIN role
    expect(isUserAdmin(null)).toBe(false);
    expect(isUserAdmin(undefined)).toBe(false);

    const legacyUser = {
      id: 'legacy-id',
      email: 'hoang2003oe@gmail.com',
      roles: ['USER'],
    };
    expect(isUserAdmin(legacyUser)).toBe(false);

    const legacyTypoUser = {
      id: 'legacy-typo-id',
      email: 'hoang2003eoe@gmail.com',
      roles: ['USER'],
    };
    expect(isUserAdmin(legacyTypoUser)).toBe(false);
  });

  it('correctly identifies user with ADMIN role', () => {
    const adminUser = {
      id: 'admin-id',
      email: 'operator@example.com',
      roles: ['USER', 'ADMIN'],
    };
    expect(isUserAdmin(adminUser)).toBe(true);
    expect(isUserAdmin(['ADMIN'])).toBe(true);
    expect(isUserAdmin(['USER', 'ADMIN'])).toBe(true);
  });

  it('correctly rejects user with only USER role', () => {
    const normalUser = {
      id: 'normal-id',
      email: 'student@example.com',
      roles: ['USER'],
    };
    expect(isUserAdmin(normalUser)).toBe(false);
    expect(isUserAdmin(['USER'])).toBe(false);
  });

  it('useIsAdmin reactive hook reflects Zustand user state', () => {
    // 1. Guest state
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(false);

    // 2. Normal user state
    act(() => {
      useCloudSyncStore.getState().setUser({
        id: 'user-1',
        email: 'hoang2003oe@gmail.com',
        displayName: 'Hoang',
        roles: ['USER'],
      });
    });
    expect(result.current).toBe(false);

    // 3. Admin user state
    act(() => {
      useCloudSyncStore.getState().setUser({
        id: 'admin-1',
        email: 'hoang2003oe@gmail.com',
        displayName: 'Hoang',
        roles: ['USER', 'ADMIN'],
      });
    });
    expect(result.current).toBe(true);
  });
});
