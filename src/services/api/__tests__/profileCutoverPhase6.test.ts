// @vitest-environment happy-dom
// src/services/api/__tests__/profileCutoverPhase6.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { profileApi, type UpdateProfilePayload, type UserProfileDto } from '../profileApi';
import {
  setAccessToken,
  setUnauthorizedHandler,
} from '../httpClient';
import {
  performFullSync,
  pushLocalToCloud,
  useCloudSyncStore,
  registerCloudSyncStoreGetter,
  clearSyncCoordinatorForTesting,
} from '../../cloudSyncService';
import { fetchRegisteredProfiles } from '../../adminVocabService';
import { applyCloudDataMerge } from '../../../store/cloudDataMerger';

describe('PHASE 6 — Profiles Domain Migration & Supabase Cutover', () => {
  const originalFetch = globalThis.fetch;
  let mockStoreResetFn: ReturnType<typeof vi.fn>;
  let mockStoreMergeFn: ReturnType<typeof vi.fn>;

  const mockProfileDto: UserProfileDto = {
    id: '11111111-2222-3333-4444-555555555555',
    email: 'learner@example.com',
    displayName: 'Hoang Master',
    avatarUrl: 'https://example.com/avatar.jpg',
    avatarSeed: 'seed_avatar',
    level: 5,
    xp: 1500,
    streak: 8,
    equippedFrame: 'champion_frame',
    hasLearnedNightOwl: true,
    targetGoal: 'toeic',
    targetDailyNewWords: 25,
    lastStudyDate: '2026-10-08',
    fourSkillsScoresJson: '{"listening":{"score":80}}',
    lastActiveAt: '2026-10-08T09:00:00Z',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-08T09:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearSyncCoordinatorForTesting();
    localStorage.clear();
    setAccessToken('valid-jwt-token');

    mockStoreResetFn = vi.fn();
    mockStoreMergeFn = vi.fn();

    registerCloudSyncStoreGetter(() => ({
      profile: {
        name: 'Hoang Master',
        level: 5,
        xp: 1500,
        streak: 8,
        equippedFrame: 'champion_frame',
        targetGoal: 'toeic',
        targetDailyNewWords: 25,
        lastStudyDate: '2026-10-08',
      },
      fourSkillsScores: { listening: { score: 80 } },
      hasLearnedNightOwl: true,
      completedListeningLessonIds: [],
      fourSkillsEvidence: {},
      fourSkillsCompletionProgress: {},
      levelCertifications: {},
      checkpointHistory: [],
      srsProgressMap: {},
      dailyHistory: {},
      resetToDefault: mockStoreResetFn,
      mergeCloudData: mockStoreMergeFn,
    }));

    useCloudSyncStore.setState({
      status: 'idle',
      user: { id: mockProfileDto.id, email: mockProfileDto.email },
      userId: mockProfileDto.id,
      userEmail: mockProfileDto.email,
      isOnline: true,
    });
  });

  afterEach(() => {
    clearSyncCoordinatorForTesting();
    globalThis.fetch = originalFetch;
    setUnauthorizedHandler(null);
  });

  describe('1. Profile API Client (profileApi)', () => {
    it('getMyProfile fetches current authenticated user profile', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toContain('/profile');
        expect(init?.method).toBe('GET');
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer valid-jwt-token');

        return Promise.resolve(
          new Response(JSON.stringify(mockProfileDto), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      const res = await profileApi.getMyProfile();
      expect(res.id).toBe(mockProfileDto.id);
      expect(res.displayName).toBe('Hoang Master');
      expect(res.targetGoal).toBe('toeic');
      expect(res.targetDailyNewWords).toBe(25);
      expect(res.equippedFrame).toBe('champion_frame');
    });

    it('updateMyProfile sends PUT request with updated payload', async () => {
      const updatePayload: UpdateProfilePayload = {
        displayName: 'New Display Name',
        targetGoal: 'ielts',
        targetDailyNewWords: 30,
        equippedFrame: 'elite_frame',
      };

      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toContain('/profile');
        expect(init?.method).toBe('PUT');
        const body = JSON.parse(init?.body as string);
        expect(body.displayName).toBe('New Display Name');
        expect(body.targetGoal).toBe('ielts');
        expect(body.targetDailyNewWords).toBe(30);

        return Promise.resolve(
          new Response(
            JSON.stringify({ ...mockProfileDto, ...updatePayload }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      });

      const res = await profileApi.updateMyProfile(updatePayload);
      expect(res.displayName).toBe('New Display Name');
      expect(res.targetGoal).toBe('ielts');
      expect(res.targetDailyNewWords).toBe(30);
    });

    it('getPublicProfile retrieves public profile without auth token', async () => {
      const publicDto = {
        id: 'user-public-guid',
        displayName: 'Public Student',
        avatarUrl: null,
        avatarSeed: 'seed',
        level: 3,
        xp: 900,
        streak: 5,
        equippedFrame: 'bronze-flame',
        lastActiveAt: '2026-10-08T08:00:00Z',
      };

      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toContain('/profile/user-public-guid');
        expect(init?.method).toBe('GET');
        // skipAuth should mean no Bearer token attached
        expect(new Headers(init?.headers).has('Authorization')).toBe(false);

        return Promise.resolve(
          new Response(JSON.stringify(publicDto), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      const res = await profileApi.getPublicProfile('user-public-guid');
      expect(res.id).toBe('user-public-guid');
      expect(res.displayName).toBe('Public Student');
      expect(res.level).toBe(3);
      expect((res as any).email).toBeUndefined();
    });

    it('getAllProfiles retrieves list of public profiles', async () => {
      const listDto = [
        {
          id: 'user-1',
          displayName: 'Learner 1',
          level: 2,
          xp: 400,
          streak: 2,
          lastActiveAt: '2026-10-08T00:00:00Z',
        },
      ];

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        expect(url).toContain('/profile/all');
        return Promise.resolve(
          new Response(JSON.stringify(listDto), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      const res = await profileApi.getAllProfiles();
      expect(res).toHaveLength(1);
      expect(res[0].displayName).toBe('Learner 1');
    });
  });

  describe('2. Cloud Sync Integration (Zero Supabase Profiles Dependency)', () => {
    it('pushLocalToCloud uploads profile through backend API without querying Supabase profiles', async () => {
      let backendApiCalled = false;
      let supabaseProfilesCalled = false;

      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes('/api/profile') || url.includes('/api/sync')) {
          backendApiCalled = true;
          return Promise.resolve(
            new Response(JSON.stringify(mockProfileDto), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }

        if (url.includes('supabase.co') && url.includes('/profiles')) {
          supabaseProfilesCalled = true;
        }

        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      });

      await pushLocalToCloud(mockProfileDto.id);

      expect(backendApiCalled).toBe(true);
      expect(supabaseProfilesCalled).toBe(false);
    });

    it('cloudDataMerger accurately ingests backend profile DTO properties', () => {
      const baseState: any = {
        profile: {
          name: '',
          level: 1,
          xp: 100,
          streak: 2,
          targetGoal: 'daily',
          targetDailyNewWords: 15,
          lastStudyDate: '2026-10-05',
          lastActiveDate: '2026-10-05',
        },
        fourSkillsScores: {},
      };

      const merged = applyCloudDataMerge(baseState, {
        cloudProfile: mockProfileDto,
      });

      expect(merged.profile?.name).toBe('Hoang Master');
      expect(merged.profile?.level).toBe(7);
      expect(merged.profile?.xp).toBe(1500);
      expect(merged.profile?.streak).toBe(8);
      expect(merged.profile?.targetGoal).toBe('toeic');
      expect(merged.profile?.targetDailyNewWords).toBe(25);
      expect(merged.profile?.equippedFrame).toBe('champion_frame');
      expect(merged.profile?.lastStudyDate).toBe('2026-10-08');
    });
  });

  describe('3. Admin Service Integration', () => {
    it('fetchRegisteredProfiles fetches profiles via profileApi without Supabase profiles table', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/profile/all')) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: 'admin-user-guid',
                  displayName: 'Admin User',
                  level: 10,
                  xp: 10000,
                  streak: 30,
                  lastActiveAt: '2026-10-08T09:00:00Z',
                },
              ]),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }

        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      });

      const result = await fetchRegisteredProfiles();
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('admin-user-guid');
      expect(result.data[0].display_name).toBe('Admin User');
      expect(result.data[0].level).toBe(10);
    });
  });
});
