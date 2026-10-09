// @vitest-environment happy-dom
// src/services/api/__tests__/authCutoverPhase5.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchApi,
  getAccessToken,
  setAccessToken,
  setUnauthorizedHandler,
  setRefreshHandler,
  getApiBaseUrl,
  ApiError,
} from '../httpClient';
import { authApi } from '../authApi';
import {
  signInWithEmail,
  signUpWithEmail,
  signOutCloud,
  useCloudSyncStore,
  getActiveSyncedUserId,
  setActiveSyncedUserId,
  registerCloudSyncStoreGetter,
  initCloudSync,
  clearSyncCoordinatorForTesting,
} from '../../cloudSyncService';

describe('PHASE 5 — Frontend API Client Foundation & Authentication Cutover', () => {
  const originalFetch = globalThis.fetch;
  let mockStoreResetFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearSyncCoordinatorForTesting();
    localStorage.clear();
    setAccessToken(null);
    setActiveSyncedUserId(null);

    mockStoreResetFn = vi.fn();
    registerCloudSyncStoreGetter(() => ({
      profile: { name: 'Test Learner', xp: 100, level: 1, streak: 1 },
      dailyHistory: {},
      srsProgressMap: {},
      userCollocations: [],
      recentReviewEvents: [],
      resetToDefault: mockStoreResetFn,
      mergeCloudData: vi.fn(),
    }));

    useCloudSyncStore.setState({
      status: 'idle',
      user: null,
      session: null,
      userId: null,
      userEmail: null,
      errorMessage: null,
      isOnline: true,
    });
  });

  afterEach(() => {
    clearSyncCoordinatorForTesting();
    globalThis.fetch = originalFetch;
    setUnauthorizedHandler(null);
  });

  describe('1. HTTP Client & Base Configuration', () => {
    it('uses configured VITE_API_BASE_URL or default fallback', () => {
      const baseUrl = getApiBaseUrl();
      expect(baseUrl).toBeDefined();
      expect(baseUrl.endsWith('/')).toBe(false);
    });

    it('attaches Bearer token to authenticated requests', async () => {
      setAccessToken('test-jwt-access-token');

      let capturedHeaders: any = null;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const res = await fetchApi<{ ok: boolean }>('/test-endpoint');
      expect(res.ok).toBe(true);
      expect(capturedHeaders?.get('Authorization')).toBe('Bearer test-jwt-access-token');
      expect(capturedHeaders?.get('Content-Type')).toBe('application/json');
    });

    it('throws normalized ApiError on HTTP 400/500 responses', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              code: 'INVALID_CREDENTIALS',
              message: 'Email hoặc mật khẩu không chính xác',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        )
      );

      await expect(fetchApi('/test-error')).rejects.toThrow(ApiError);
      try {
        await fetchApi('/test-error');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(400);
        expect(apiErr.code).toBe('INVALID_CREDENTIALS');
        expect(apiErr.message).toBe('Email hoặc mật khẩu không chính xác');
      }
    });

    it('parses ASP.NET Core ValidationProblemDetails (RFC 7807) with field errors and category', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
              title: 'One or more validation errors occurred.',
              status: 400,
              errors: { Password: ['Mật khẩu phải có ít nhất 6 ký tự.'] },
              traceId: '00-trace-12345',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        )
      );

      try {
        await fetchApi('/test-validation-error');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(400);
        expect(apiErr.code).toBe('VALIDATION_FAILED');
        expect(apiErr.category).toBe('VALIDATION');
        expect(apiErr.message).toContain('Mật khẩu phải có ít nhất 6 ký tự.');
        expect(apiErr.details).toContain('Password: Mật khẩu phải có ít nhất 6 ký tự.');
        expect(apiErr.traceId).toBe('00-trace-12345');
      }
    });

    it('differentiates canonical error categories: FORBIDDEN, CONFLICT, RATE_LIMIT, DATABASE_ERROR', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Forbidden access' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
      );
      await expect(fetchApi('/403')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN', category: 'FORBIDDEN' });

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Email in use' }), { status: 409, headers: { 'Content-Type': 'application/json' } })
      );
      await expect(fetchApi('/409')).rejects.toMatchObject({ status: 409, code: 'CONFLICT', category: 'CONFLICT' });

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Too many requests' }), { status: 429, headers: { 'Content-Type': 'application/json' } })
      );
      await expect(fetchApi('/429')).rejects.toMatchObject({ status: 429, code: 'RATE_LIMIT', category: 'RATE_LIMIT' });

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Database unreachable' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
      );
      await expect(fetchApi('/503')).rejects.toMatchObject({ status: 503, code: 'DATABASE_ERROR', category: 'DATABASE_ERROR' });
    });
  });

  describe('2. Authentication API (authApi)', () => {
    it('registers user and persists access token', async () => {
      const mockResponse = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        expiresInSeconds: 900,
        user: {
          id: 'user-guid-0001',
          email: 'test@example.com',
          displayName: 'Test Learner',
        },
      };

      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      const result = await authApi.register({
        email: 'test@example.com',
        password: 'Password123!',
        displayName: 'Test Learner',
      });

      expect(result.user.id).toBe('user-guid-0001');
      expect(result.accessToken).toBe('access-token-123');
      expect(getAccessToken()).toBe('access-token-123');
      expect(localStorage.getItem('emh_access_token')).toBe('access-token-123');
    });

    it('logs in user and stores token in memory and localStorage', async () => {
      const mockResponse = {
        accessToken: 'login-token-789',
        expiresInSeconds: 900,
        user: {
          id: 'user-guid-0002',
          email: 'login@example.com',
          displayName: 'Logged In User',
        },
      };

      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      const result = await authApi.login({
        email: 'login@example.com',
        password: 'Password123!',
      });

      expect(result.user.id).toBe('user-guid-0002');
      expect(getAccessToken()).toBe('login-token-789');
    });

    it('logs out and clears access token', async () => {
      setAccessToken('pre-existing-token');
      expect(getAccessToken()).toBe('pre-existing-token');

      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 204 }))
      );

      await authApi.logout();

      expect(getAccessToken()).toBeNull();
      expect(localStorage.getItem('emh_access_token')).toBeNull();
    });

    it('gets current user details with getMe()', async () => {
      const meResponse = {
        id: 'user-guid-0003',
        email: 'me@example.com',
        displayName: 'Learner Me',
        level: 5,
        xp: 1250,
        streak: 7,
        equippedFrame: 'bronze-flame',
        createdAt: '2026-10-01T00:00:00Z',
      };

      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(meResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      const me = await authApi.getMe();
      expect(me.id).toBe('user-guid-0003');
      expect(me.level).toBe(5);
      expect(me.xp).toBe(1250);
    });
  });

  describe('3. Auto-Refresh on 401 Interception', () => {
    it('seamlessly refreshes token and retries request upon 401', async () => {
      setAccessToken('expired-access-token');

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/auth/refresh')) {
          return new Response(
            JSON.stringify({
              accessToken: 'refreshed-fresh-token',
              expiresInSeconds: 900,
              user: { id: 'user-guid-refresh', email: 'ref@test.com', displayName: 'Ref' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        callCount++;
        if (callCount === 1) {
          // First call: 401 Unauthorized
          return new Response(
            JSON.stringify({ code: 'UNAUTHORIZED', message: 'Token expired' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Retry call: 200 OK
        return new Response(
          JSON.stringify({ data: 'recovered-data' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const data = await fetchApi<{ data: string }>('/protected-resource');
      expect(data.data).toBe('recovered-data');
      expect(getAccessToken()).toBe('refreshed-fresh-token');
      expect(callCount).toBe(2);
    });

    it('triggers unauthorizedHandler when refresh fails', async () => {
      setAccessToken('invalid-token');
      const mockUnauthorized = vi.fn();
      setUnauthorizedHandler(mockUnauthorized);

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/auth/refresh')) {
          return new Response(
            JSON.stringify({ code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token invalid' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ code: 'UNAUTHORIZED', message: 'Token expired' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      });

      await expect(fetchApi('/protected-resource')).rejects.toThrow();
      expect(mockUnauthorized).toHaveBeenCalled();
      expect(getAccessToken()).toBeNull();
    });
  });

  describe('4. Frontend Auth Cutover (cloudSyncService)', () => {
    it('signs in with email, establishes user in store, and sets active user ID', async () => {
      const mockAuthRes = {
        accessToken: 'signed-in-jwt',
        expiresInSeconds: 900,
        user: {
          id: 'user-guid-999',
          email: 'student@example.com',
          displayName: 'Student Nine',
        },
      };

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/auth/login')) {
          return new Response(JSON.stringify(mockAuthRes), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      const { data, error } = await signInWithEmail('student@example.com', 'SecureP@ss123');

      expect(error).toBeNull();
      expect(data?.user?.id).toBe('user-guid-999');
      expect(getActiveSyncedUserId()).toBe('user-guid-999');

      const storeState = useCloudSyncStore.getState();
      expect(storeState.user?.id).toBe('user-guid-999');
      expect(storeState.user?.email).toBe('student@example.com');
      expect(storeState.userId).toBe('user-guid-999');
    });

    it('signs out and purges active user, store credentials, and triggers reset', async () => {
      setActiveSyncedUserId('user-guid-logout');
      setAccessToken('token-to-logout');
      useCloudSyncStore.setState({
        user: { id: 'user-guid-logout', email: 'logout@test.com' },
        userId: 'user-guid-logout',
      });

      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 204 }))
      );

      await signOutCloud();

      expect(getAccessToken()).toBeNull();
      expect(getActiveSyncedUserId()).toBeNull();
      expect(useCloudSyncStore.getState().user).toBeNull();
      expect(useCloudSyncStore.getState().userId).toBeNull();
      expect(mockStoreResetFn).toHaveBeenCalled();
    });

    it('detects Account Switch and resets local state to prevent data leakage', async () => {
      // User A previously synced
      setActiveSyncedUserId('user-A-guid');

      // User B logs in
      const mockUserB = {
        accessToken: 'token-user-B',
        expiresInSeconds: 900,
        user: {
          id: 'user-B-guid',
          email: 'userb@test.com',
          displayName: 'User B',
        },
      };

      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockUserB), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      await signInWithEmail('userb@test.com', 'PassB123!');

      // Should have triggered resetToDefault to prevent User A data contaminating User B
      expect(mockStoreResetFn).toHaveBeenCalled();
      expect(getActiveSyncedUserId()).toBe('user-B-guid');
      expect(useCloudSyncStore.getState().user?.id).toBe('user-B-guid');
    });
  });

  describe('5. Guest Learner Semantics (Local-First Invariant)', () => {
    it('maintains null user state for guests without network failure', () => {
      const state = useCloudSyncStore.getState();
      expect(state.user).toBeNull();
      expect(state.userId).toBeNull();
      expect(state.status).toBe('idle');
    });

    it('initCloudSync handles unauthenticated guest smoothly', async () => {
      // Mock refresh failure (e.g., no cookie exists for guest)
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ code: 'UNAUTHORIZED', message: 'No valid refresh token' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          )
        )
      );

      const cleanup = initCloudSync();

      // Wait a tick for promises in initCloudSync
      await new Promise((resolve) => setTimeout(resolve, 50));

      const state = useCloudSyncStore.getState();
      expect(state.user).toBeNull();
      expect(state.status).toBe('idle');

      cleanup();
    });
  });
});
