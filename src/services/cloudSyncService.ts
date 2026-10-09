import { create } from 'zustand';
type AppStoreStateGetter = () => any;
let cloudSyncStoreGetter: AppStoreStateGetter | null = null;

export function registerCloudSyncStoreGetter(getter: AppStoreStateGetter): void {
  cloudSyncStoreGetter = getter;
}

export function getCloudSyncStoreState(): any {
  if (cloudSyncStoreGetter) {
    return cloudSyncStoreGetter();
  }
  if (typeof window !== 'undefined' && (window as any).__appStore) {
    return (window as any).__appStore.getState();
  }
  return null;
}

import type { SyncStatus, CloudSyncInfo, SRSProgress, DailyProgress } from '../types';
import {
  sanitizeLevelCertifications,
  sanitizeCheckpointHistory,
} from '../store/fourSkillsSanitizers';
import { authApi, type AuthResponse } from './api/authApi';
import { profileApi, type UpdateProfilePayload } from './api/profileApi';
import { cloudSyncApi, type SrsProgressItemDto, type DailyLogDto, type SyncStateResponse } from './api/cloudSyncApi';
import { getAccessToken, setAccessToken, setUnauthorizedHandler, ApiError } from './api/httpClient';
import {
  flushOutboxEventsThroughCoordinator,
  isEventSyncEnabled,
  getEventSyncTelemetry,
  resetEventSyncTelemetryForTesting,
  resetEventSyncConfigForTesting,
  getEventSyncConfig,
  setEventSyncConfig,
} from './cloudEventSyncService';
import {
  calculateWeeklyXpFromHistory,
  getAuthoritativeVietnamWeekId,
  syncUserScoreToLeaderboard,
  syncWeeklyLearningMetricsToServer,
  clearCachedLeaderboard,
  invalidateAuthLeaderboardCache,
  clearLeaderboardDebounce,
} from './leaderboardService';
import { restartHubConnectionIfActive } from './api/signalRService';
import { syncDerivedLearningMetrics } from './leaderboardLearningMetrics';
import {
  scheduleLearningEvidenceSubmission,
  flushLearningEvidence,
  hasPendingOfflineEvidence,
  onUserLogin,
  onUserLogout,
  onAccountSwitch,
  setAuthenticatedUserId,
} from './learningEvidenceTransport';
import { prepareDataSlotForUser, archiveCurrentDataSlot } from '../store/dataOwnershipManager';

const ACTIVE_USER_STORAGE_KEY = 'english_mastery_active_user_id';

export function getActiveSyncedUserId(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
    }
    return null;
  } catch {
    return null;
  }
}

export function setActiveSyncedUserId(userId: string | null): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (userId) {
        localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId);
      } else {
        localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
      }
    }
  } catch {}
}

export interface AppAuthUser {
  id: string;
  email?: string | null;
  displayName?: string | null;
  roles?: string[] | null;
  [key: string]: any;
}

export interface AppAuthSession {
  access_token?: string;
  user?: AppAuthUser | null;
  [key: string]: any;
}

interface CloudSyncStoreState extends CloudSyncInfo {
  user: AppAuthUser | null;
  session: AppAuthSession | any | null;
  isOnline: boolean;
  isAuthInitialized: boolean;
  isAuthUnavailable: boolean;
  setStatus: (status: SyncStatus, error?: string | null) => void;
  setSession: (session: AppAuthSession | any | null) => void;
  setUser: (user: AppAuthUser | null) => void;
  setIsOnline: (online: boolean) => void;
  setAuthInitialized: (initialized: boolean) => void;
  setAuthUnavailable: (unavailable: boolean) => void;
}

export const useCloudSyncStore = create<CloudSyncStoreState>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  errorMessage: null,
  userEmail: null,
  userId: null,
  user: null,
  session: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isAuthInitialized: false,
  isAuthUnavailable: false,

  setStatus: (status, errorMessage = null) =>
    set((state) => ({
      status,
      errorMessage,
      lastSyncedAt: status === 'synced' ? new Date().toISOString() : state.lastSyncedAt,
    })),

  setUser: (user) =>
    set({
      user,
      userEmail: user?.email || null,
      userId: user?.id || null,
    }),

  setSession: (session) =>
    set({
      session,
      user: session?.user || null,
      userEmail: session?.user?.email || null,
      userId: session?.user?.id || null,
    }),

  setIsOnline: (isOnline) =>
    set((state) => ({
      isOnline,
      status: isOnline ? (state.status === 'offline' ? 'idle' : state.status) : 'offline',
    })),

  setAuthInitialized: (isAuthInitialized) => set({ isAuthInitialized }),
  setAuthUnavailable: (isAuthUnavailable) => set({ isAuthUnavailable }),
}));

// Coordinator state for cloud synchronization
export const MAX_SYNC_RETRY_ATTEMPTS = 3;
export const SYNC_RETRY_BASE_DELAY_MS = 1500;

let isSyncInProgress = false;
let hasPendingSyncRequest = false;
let syncRetryAttempt = 0;
let syncRetryTimer: ReturnType<typeof setTimeout> | null = null;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let activeSyncPromise: Promise<{ success: boolean; message?: string }> | null = null;
let pendingSyncPromise: Promise<{ success: boolean; message?: string }> | null = null;

export function getSyncCoordinatorStateForTesting() {
  return {
    isSyncInProgress,
    hasPendingSyncRequest,
    syncRetryAttempt,
    hasRetryTimer: syncRetryTimer !== null,
    hasDebounceTimer: syncDebounceTimer !== null,
  };
}

export function clearSyncCoordinatorForTesting(): void {
  if (syncRetryTimer) {
    clearTimeout(syncRetryTimer);
    syncRetryTimer = null;
  }
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
  }
  isSyncInProgress = false;
  hasPendingSyncRequest = false;
  syncRetryAttempt = 0;
  activeSyncPromise = null;
  pendingSyncPromise = null;
}

export function cancelSyncRetry(): void {
  if (syncRetryTimer) {
    clearTimeout(syncRetryTimer);
    syncRetryTimer = null;
  }
  syncRetryAttempt = 0;
}

export function isNetworkOrUnreachableError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === 'object' && err !== null && 'status' in err && typeof (err as any).status === 'number') {
    const status = (err as any).status;
    if (status >= 500 || status === 408 || status === 429) return true;
  }
  const msg = typeof err === 'object' && err !== null && 'message' in err
    ? String((err as any).message).toLowerCase()
    : String(err).toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('connection refused') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('offline') ||
    msg.includes('server error') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504')
  );
}

/**
 * Core internal execution of two-way synchronization
 */
async function executeSync(): Promise<{ success: boolean; message?: string }> {
  isSyncInProgress = true;
  useCloudSyncStore.getState().setStatus('syncing');

  const syncCore = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const { user } = useCloudSyncStore.getState();
      if (!user) {
        useCloudSyncStore.getState().setStatus('idle');
        return { success: false, message: 'Chưa đăng nhập tài khoản Cloud.' };
      }
      const userId = user.id;

      // Detect account switch: nếu user hiện tại khác user đã sync trước đó,
      // reset local Zustand store để ngăn chặn rò rỉ dữ liệu (Cross-user data contamination)
      const previousUserId = getActiveSyncedUserId();
      if (previousUserId && previousUserId !== userId) {
        console.log(`[CloudSync] Account switch detected (${previousUserId} -> ${userId}). Resetting local state to prevent data leakage.`);
        clearCachedLeaderboard();
        invalidateAuthLeaderboardCache(userId);
        const store = getCloudSyncStoreState();
        if (store?.resetToDefault) {
          store.resetToDefault();
        }
      }
      setActiveSyncedUserId(userId);

      // 0. Hybrid Event Sync: Drain pending local outbox events before fetching remote snapshot
      // Guarantees recent offline actions are ingested on server before state reconciliation.
      try {
        if (isEventSyncEnabled()) {
          const outboxResult = await flushOutboxEventsThroughCoordinator();
          if (outboxResult.error) {
            console.warn('[CloudSync] Outbox event flush warning:', outboxResult.error);
          }
        }
      } catch (eventFlushErr) {
        console.warn('[CloudSync] Non-blocking outbox flush error:', eventFlushErr);
      }

      // 1. Fetch remote snapshot atomically via ASP.NET Core Sync API
      const syncState = await cloudSyncApi.getSyncState();

      // Guard: Discard stale response if user logged out or switched while in flight
      const activeUser = useCloudSyncStore.getState().user;
      if (!activeUser || activeUser.id !== userId) {
        console.warn(`[CloudSync] Discarding stale syncState: active user (${activeUser?.id}) does not match sync request (${userId})`);
        return { success: false, message: 'Phiên người dùng đã thay đổi.' };
      }

      // 2. Transactional Merge: Nạp state mới nhất của Zustand store tại thời điểm commit
      const store = getCloudSyncStoreState();
      if (store?.mergeCloudData) {
        store.mergeCloudData({
          cloudProfile: syncState.profile || null,
          cloudSrsList: syncState.srsItems || [],
          cloudDailyLogs: syncState.dailyLogs || [],
        });
      }

      // 3. Now Push merged local data to ASP.NET Core Cloud Sync API
      await pushLocalToCloud(userId);

      // Thành công: Xóa retry timer và reset attempt counter
      syncRetryAttempt = 0;
      if (syncRetryTimer) {
        clearTimeout(syncRetryTimer);
        syncRetryTimer = null;
      }

      if (!useCloudSyncStore.getState().user) {
        useCloudSyncStore.getState().setStatus('idle');
        return { success: false, message: 'Người dùng đã đăng xuất.' };
      }

      useCloudSyncStore.getState().setStatus('synced');
      return { success: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi đồng bộ Cloud';
      console.error('[CloudSync] Sync error:', err);

      const isCurrentOnline = useCloudSyncStore.getState().isOnline;
      if (!isCurrentOnline) {
        useCloudSyncStore.getState().setStatus('offline');
        cancelSyncRetry();
        return { success: false, message: 'Thiết bị đang ngoại tuyến. Dữ liệu được lưu an toàn tại LocalStorage.' };
      }

      // Bounded Exponential Backoff Retry (Tối đa 3 lần)
      if (syncRetryAttempt < MAX_SYNC_RETRY_ATTEMPTS) {
        syncRetryAttempt++;
        const backoffDelay = SYNC_RETRY_BASE_DELAY_MS * Math.pow(2, syncRetryAttempt - 1);
        useCloudSyncStore.getState().setStatus(
          'error',
          `Chưa thể kết nối máy chủ. Đang thử lại lần ${syncRetryAttempt}/${MAX_SYNC_RETRY_ATTEMPTS}...`
        );

        if (syncRetryTimer) clearTimeout(syncRetryTimer);
        syncRetryTimer = setTimeout(() => {
          syncRetryTimer = null;
          void performFullSync({ isRetry: true });
        }, backoffDelay);

        return {
          success: false,
          message: `Lỗi kết nối. Sẽ tự động thử lại sau ${(backoffDelay / 1000).toFixed(1)}s.`,
        };
      } else {
        // Đã thử hết số lần cho phép
        syncRetryAttempt = 0;
        useCloudSyncStore.getState().setStatus(
          'error',
          'Chưa thể đồng bộ. Tiến độ vẫn được lưu trên thiết bị.'
        );
        return { success: false, message: errorMsg };
      }
    } finally {
      isSyncInProgress = false;
      activeSyncPromise = null;
    }
  };

  activeSyncPromise = syncCore();
  const res = await activeSyncPromise;
  pendingSyncPromise = null;
  return res;
}

/**
 * Perform a full two-way sync:
 * 1. Pull cloud data (profiles, user_srs_progress, daily_logs)
 * 2. Merge intelligently with LocalStorage / Zustand store
 * 3. Push merged state back to Cloud backend to ensure consistency
 * With reentrancy protection, request coalescing, and bounded exponential backoff retry.
 */
export async function performFullSync(options?: {
  isRetry?: boolean;
}): Promise<{ success: boolean; message?: string }> {
  const { user, isOnline } = useCloudSyncStore.getState();

  if (!isOnline) {
    cancelSyncRetry();
    useCloudSyncStore.getState().setStatus('offline');
    return { success: false, message: 'Thiết bị đang ngoại tuyến. Dữ liệu được lưu an toàn tại LocalStorage.' };
  }

  if (!user) {
    cancelSyncRetry();
    useCloudSyncStore.getState().setStatus('idle');
    return { success: false, message: 'Chưa đăng nhập tài khoản Cloud.' };
  }

  // Coalescing: Nếu đang có sync chạy dở, ghi nhận yêu cầu tiếp nối và kết nối promise
  if (isSyncInProgress) {
    hasPendingSyncRequest = true;
    if (!pendingSyncPromise) {
      pendingSyncPromise = (async () => {
        try {
          await activeSyncPromise;
        } catch {
          // Safe ignore
        }
        const { user: currentUser, isOnline: currentOnline } = useCloudSyncStore.getState();
        if (currentUser && currentOnline && hasPendingSyncRequest) {
          hasPendingSyncRequest = false;
          return executeSync();
        }
        return { success: true, message: 'Đồng bộ đã hoàn tất.' };
      })();
    }
    return pendingSyncPromise;
  }

  return executeSync();
}

/**
 * Push current local progress to Cloud backend
 */
export async function pushLocalToCloud(userId?: string): Promise<void> {
  const currentUserId = userId || useCloudSyncStore.getState().userId;
  const isOnline = useCloudSyncStore.getState().isOnline;

  if (!currentUserId || !isOnline) return;

  const store = getCloudSyncStoreState();
  if (!store) return;

  const {
    profile,
    srsProgressMap,
    dailyHistory,
    fourSkillsScores,
    fourSkillsEvidence,
    hasLearnedNightOwl,
    completedListeningLessonIds,
    fourSkillsCompletionProgress,
    levelCertifications,
    checkpointHistory,
  } = store;

  // 1. Build Profile payload
  const profilePayload: UpdateProfilePayload = {
    displayName: profile.name || userEmailToName(useCloudSyncStore.getState().userEmail),
    level: profile.level || 1,
    xp: profile.xp || 0,
    streak: typeof profile.streak === 'number' ? profile.streak : 0,
    targetGoal: profile.targetGoal || 'daily',
    targetDailyNewWords: profile.targetDailyNewWords || 15,
    lastStudyDate: profile.lastStudyDate || undefined,
    equippedFrame: profile.equippedFrame || null,
    hasLearnedNightOwl: Boolean(hasLearnedNightOwl),
    fourSkillsScoresJson: JSON.stringify({
      ...fourSkillsScores,
      completed_listening_lessons: completedListeningLessonIds || [],
      four_skills_evidence: fourSkillsEvidence,
      four_skills_completion_progress: fourSkillsCompletionProgress,
      completed_reading_lessons: fourSkillsCompletionProgress?.reading || [],
      completed_speaking_prompts: fourSkillsCompletionProgress?.speaking || [],
      completed_writing_prompts: fourSkillsCompletionProgress?.writing || [],
      level_certifications: sanitizeLevelCertifications(levelCertifications),
      checkpoint_history: sanitizeCheckpointHistory(checkpointHistory),
    }),
  };

  // 2. Build SRS payload (only active/reviewed items)
  const srsEntries = Object.entries(srsProgressMap || {}) as [string, SRSProgress][];
  let srsPayload: SrsProgressItemDto[] = [];
  if (srsEntries.length > 0) {
    srsPayload = srsEntries
      .filter(([_, prog]) => (prog.srsLevel && prog.srsLevel > 0) || (prog.interval && prog.interval > 0) || prog.lastReviewedDate || prog.fsrs)
      .map(([wordId, prog]) => {
        const isFsrs = Boolean(prog.fsrs);
        return {
          wordId,
          interval: Number(prog.interval || 0),
          easeFactor: Number(prog.easeFactor || 2.5),
          repetition: Number(prog.srsLevel || 0),
          nextReviewDate: prog.nextReviewDate || new Date().toISOString(),
          lastReviewedDate: prog.lastReviewedDate || new Date().toISOString(),
          algorithm: isFsrs ? 'fsrs' : 'sm2',
          stability: isFsrs ? prog.fsrs?.stability : undefined,
          difficulty: isFsrs ? prog.fsrs?.difficulty : undefined,
          state: isFsrs ? prog.fsrs?.state : undefined,
          reps: isFsrs ? (prog.fsrs?.reps ?? prog.reviewCount) : prog.reviewCount,
          lapses: isFsrs ? (prog.fsrs?.lapses ?? prog.againCount) : prog.againCount,
          isFavorite: Boolean(prog.isFavorite),
          sources: prog.sources || undefined,
        };
      });
  }

  // 3. Build Daily Logs payload
  const logEntries = Object.entries(dailyHistory || {}) as [string, DailyProgress][];
  let logsPayload: DailyLogDto[] = [];
  if (logEntries.length > 0) {
    logsPayload = logEntries.map(([date, hist]) => {
      const rawWords = (hist.newWordsLearned || 0) + (hist.wordsReviewed || 0);
      const safeWords = rawWords > 100 ? 0 : Math.max(0, rawWords);
      return {
        date,
        wordsLearned: safeWords,
        wordsReviewed: Math.max(0, hist.wordsReviewed || 0),
        quizzesCompleted: Math.max(0, hist.quizzesCompleted || 0),
        xpEarned: Math.min(2000, hist.xpGained || 0),
      };
    });
  }

  // 4. Atomic upload via ASP.NET Core Sync API
  try {
    await cloudSyncApi.uploadSync({
      profile: profilePayload,
      srsItems: srsPayload,
      dailyLogs: logsPayload,
    });
  } catch (syncErr: unknown) {
    console.error('[CloudSync] Push sync snapshot error:', syncErr);
    throw syncErr instanceof Error ? syncErr : new Error('Không thể đồng bộ dữ liệu lên máy chủ');
  }

  // 4. Sync Leaderboard Profile & Weekly Learning Metrics
  const currentWeeklyXp = calculateWeeklyXpFromHistory(dailyHistory);
  const currentWeekId = getAuthoritativeVietnamWeekId();

  // 4a. Sync to leaderboard_profiles (legacy view & profile ranking)
  try {
    await syncUserScoreToLeaderboard({
      userId: currentUserId,
      displayName: profile.name || userEmailToName(useCloudSyncStore.getState().userEmail),
      avatarSeed: profile.avatarSeed,
      level: profile.level || 1,
      totalXp: profile.xp || 0,
      weeklyXp: currentWeeklyXp,
      streak: profile.streak || 0,
      equippedFrame: profile.equippedFrame || null,
    });
  } catch (leaderboardSyncErr) {
    console.warn('[CloudSync] Non-blocking leaderboard profile sync error:', leaderboardSyncErr);
  }

  // 4b. Sync to weekly_learning_metrics (Server-authoritative category rankings & sticky rank)
  try {
    const metricsRes = await syncDerivedLearningMetrics(currentUserId);
    if (!metricsRes.success && metricsRes.code !== 'OFFLINE') {
      console.warn('[CloudSync] Weekly learning metrics sync notice:', metricsRes.message || metricsRes.code);
    }
  } catch (metricsSyncErr) {
    console.warn('[CloudSync] Non-blocking weekly learning metrics sync error:', metricsSyncErr);
  }
}

/**
 * Debounced sync trigger called after study actions (gainXP, SRS review, etc.)
 * Routes directly to Minimal Authenticated Learning Evidence Transport (Phase 6),
 * bypassing heavy full-state cloud database uploads.
 */
export function scheduleCloudSync(delayMs = 1500): void {
  scheduleLearningEvidenceSubmission(delayMs);
}

/**
 * Kiểm tra xem có đồng bộ nào đang bị hoãn (debounced) hoặc đang chạy ngầm hay không
 */
export function hasPendingCloudSync(): boolean {
  return hasPendingOfflineEvidence() || isSyncInProgress;
}

/**
 * Flush toàn bộ các đồng bộ đang chờ (pending / debounced) lên Cloud ngay lập tức.
 * Dùng khi học viên vừa học xong và bấm chuyển sang Bảng Xếp Hạng.
 */
export async function flushPendingCloudSync(): Promise<{ success: boolean; message?: string }> {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
  }
  const { user, isOnline } = useCloudSyncStore.getState();
  if (!user || !isOnline) {
    return { success: false, message: 'Offline hoặc chưa đăng nhập' };
  }
  const res = await flushLearningEvidence();
  return { success: res.success, message: res.message };
}

function userEmailToName(email: string | null): string {
  if (!email) return 'Học viên';
  return email.split('@')[0];
}

let authVerificationGeneration = 0;

export function getAuthVerificationGeneration(): number {
  return authVerificationGeneration;
}

export function invalidateInFlightAuthChecks(): void {
  authVerificationGeneration++;
  useCloudSyncStore.getState().setAuthInitialized(true);
}

/**
 * Global initialization for Cloud auth listener and network status
 * Duy nhất 1 listener toàn cục cho toàn ứng dụng, có cleanup hoàn chỉnh
 */
export function initCloudSync(): () => void {
  const currentGeneration = ++authVerificationGeneration;

  // 1. Initial auth check via ASP.NET Core API
  if (getAccessToken()) {
    const mePromise = authApi.getMe();
    if (mePromise && typeof mePromise.then === 'function') {
      mePromise
        .then((me) => {
          if (currentGeneration !== authVerificationGeneration) return;
          const appStore = getCloudSyncStoreState();
          if (appStore?.isLoggedOut) return;
          if (appStore?.isGuestMode) return;

          const user: AppAuthUser = {
            id: me.id,
            email: me.email,
            displayName: me.displayName,
            roles: me.roles || [],
          };

          const previousUserId = getActiveSyncedUserId();
          if (previousUserId && previousUserId !== user.id) {
            console.log(`[CloudSync] Account switch detected (${previousUserId} -> ${user.id}).`);
            clearCachedLeaderboard();
            invalidateAuthLeaderboardCache(user.id);
            onAccountSwitch(user.id);
          }
          prepareDataSlotForUser(user.id, appStore);

          useCloudSyncStore.getState().setUser(user);
          useCloudSyncStore.getState().setSession({ access_token: getAccessToken(), user });
          useCloudSyncStore.getState().setAuthUnavailable(false);
          setAuthenticatedUserId(user.id);
          setActiveSyncedUserId(user.id);
          onUserLogin(user.id);
        })
        .catch(async (meErr) => {
          if (currentGeneration !== authVerificationGeneration) return;
          const appStore = getCloudSyncStoreState();
          if (appStore?.isLoggedOut) return;
          if (appStore?.isGuestMode) return;

          if (isNetworkOrUnreachableError(meErr)) {
            console.warn('[CloudSync] Server unreachable during getMe check, preserving existing credentials');
            useCloudSyncStore.getState().setAuthUnavailable(true);
            return;
          }

          try {
            const res = await authApi.refresh();
            if (currentGeneration !== authVerificationGeneration) return;
            const currentStore = getCloudSyncStoreState();
            if (currentStore?.isLoggedOut) return;
            if (currentStore?.isGuestMode) return;

            const user = applySuccessfulAuthResponse(res);
            useCloudSyncStore.getState().setUser(user);
            useCloudSyncStore.getState().setSession({ access_token: res.accessToken, user });
            useCloudSyncStore.getState().setAuthUnavailable(false);
            setAuthenticatedUserId(user.id);
          } catch (refreshErr) {
            if (currentGeneration !== authVerificationGeneration) return;
            const currentStore = getCloudSyncStoreState();
            if (currentStore?.isLoggedOut) return;
            if (currentStore?.isGuestMode) return;

            if (isNetworkOrUnreachableError(refreshErr)) {
              useCloudSyncStore.getState().setAuthUnavailable(true);
            } else {
              setAccessToken(null);
              useCloudSyncStore.getState().setUser(null);
              useCloudSyncStore.getState().setSession(null);
              useCloudSyncStore.getState().setAuthUnavailable(false);
              setAuthenticatedUserId(null);
            }
          }
        })
        .finally(() => {
          if (currentGeneration !== authVerificationGeneration) return;
          useCloudSyncStore.getState().setAuthInitialized(true);
        });
    } else {
      useCloudSyncStore.getState().setAuthInitialized(true);
    }
  } else {
    // Thử khôi phục session qua HttpOnly refresh token cookie khi chưa có access token
    const refreshPromise = authApi.refresh();
    if (refreshPromise && typeof refreshPromise.then === 'function') {
      refreshPromise
        .then((res) => {
          if (currentGeneration !== authVerificationGeneration) return;
          const appStore = getCloudSyncStoreState();
          if (appStore?.isLoggedOut) return;
          if (appStore?.isGuestMode) return;

          const user = applySuccessfulAuthResponse(res);
          useCloudSyncStore.getState().setUser(user);
          useCloudSyncStore.getState().setSession({ access_token: res.accessToken, user });
          useCloudSyncStore.getState().setAuthUnavailable(false);
          setAuthenticatedUserId(user.id);
        })
        .catch((err) => {
          if (currentGeneration !== authVerificationGeneration) return;
          // Người dùng Guest chưa đăng nhập hoặc không có refresh cookie
          useCloudSyncStore.getState().setUser(null);
          useCloudSyncStore.getState().setSession(null);
          useCloudSyncStore.getState().setAuthUnavailable(false);
          setAuthenticatedUserId(null);
        })
        .finally(() => {
          if (currentGeneration !== authVerificationGeneration) return;
          useCloudSyncStore.getState().setAuthInitialized(true);
        });
    } else {
      useCloudSyncStore.getState().setAuthInitialized(true);
    }
  }

  // 2. Set unauthorized handler
  setUnauthorizedHandler(() => {
    setActiveSyncedUserId(null);
    setAuthenticatedUserId(null);
    clearCachedLeaderboard();
    invalidateAuthLeaderboardCache(null);
    useCloudSyncStore.getState().setUser(null);
    useCloudSyncStore.getState().setSession(null);
    useCloudSyncStore.getState().setStatus('idle');
    const store = getCloudSyncStoreState();
    if (store?.setIsLoggedOut) {
      store.setIsLoggedOut(true);
    }
    if (store?.setGuestMode) {
      store.setGuestMode(false);
    }
  });

  // 3. Online/Offline events
  const handleOnline = () => {
    useCloudSyncStore.getState().setIsOnline(true);
  };

  const handleOffline = () => {
    useCloudSyncStore.getState().setIsOnline(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    authVerificationGeneration++;
    setUnauthorizedHandler(null);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Centralized authentication state sync helper
 */
function applySuccessfulAuthResponse(res: AuthResponse): AppAuthUser {
  if (res.accessToken) {
    setAccessToken(res.accessToken);
  }

  const user: AppAuthUser = {
    id: res.user.id,
    email: res.user.email,
    displayName: res.user.displayName,
    roles: res.user.roles || [],
  };

  const previousUserId = getActiveSyncedUserId();
  if (previousUserId && previousUserId !== user.id) {
    console.log(`[CloudSync] Account switch detected (${previousUserId} -> ${user.id}).`);
    clearCachedLeaderboard();
    invalidateAuthLeaderboardCache(user.id);
    onAccountSwitch(user.id);
  }
  const storeState = getCloudSyncStoreState();
  prepareDataSlotForUser(user.id, storeState);
  setActiveSyncedUserId(user.id);
  setAuthenticatedUserId(user.id);
  onUserLogin(user.id);

  // Synchronize display name to local store if provided
  if (user.displayName) {
    const store = getCloudSyncStoreState();
    if (store?.setProfileName) {
      store.setProfileName(user.displayName);
    }
  }

  const store = getCloudSyncStoreState();
  if (store?.setGuestMode) {
    store.setGuestMode(false);
  }
  if (store?.setIsLoggedOut) {
    store.setIsLoggedOut(false);
  }

  useCloudSyncStore.getState().setUser(user);
  useCloudSyncStore.getState().setSession({ access_token: res.accessToken, user });
  useCloudSyncStore.getState().setStatus('idle');
  useCloudSyncStore.getState().setAuthUnavailable(false);
  invalidateAuthLeaderboardCache(user.id);
  scheduleLearningEvidenceSubmission(0);
  clearLeaderboardDebounce();
  void restartHubConnectionIfActive();

  return user;
}

/**
 * Authentication Helpers via ASP.NET Core Backend
 */
export async function signInWithEmail(email: string, password: string) {
  try {
    const res = await authApi.login({ email, password });
    const user = applySuccessfulAuthResponse(res);

    return {
      data: { user, session: { access_token: res.accessToken, user } },
      error: null,
    };
  } catch (err: unknown) {
    let message = 'Đăng nhập không thành công';
    if (err instanceof ApiError) {
      if (err.category === 'AUTH' || err.status === 401 || err.code === 'UNAUTHORIZED') {
        message = 'Email hoặc mật khẩu không chính xác.';
      } else if (err.category === 'NETWORK' || err.code === 'NETWORK_ERROR') {
        message = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.';
      } else if (err.category === 'TIMEOUT' || err.code === 'TIMEOUT') {
        message = 'Yêu cầu quá thời gian phản hồi (Timeout). Vui lòng thử lại sau.';
      } else if (err.category === 'DATABASE_ERROR') {
        message = 'Cơ sở dữ liệu tạm thời gián đoạn. Vui lòng thử lại sau.';
      } else {
        message = err.message || 'Lỗi máy chủ khi đăng nhập.';
      }
    } else if (err instanceof Error) {
      message = err.message;
    }
    return { data: { user: null, session: null }, error: { message, raw: err } };
  }
}

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  try {
    const res = await authApi.register({ email, password, displayName });
    const user = applySuccessfulAuthResponse(res);

    return {
      data: { user, session: { access_token: res.accessToken, user } },
      error: null,
    };
  } catch (err: unknown) {
    let message = 'Đăng ký không thành công';
    if (err instanceof ApiError) {
      if (err.category === 'CONFLICT' || err.code === 'CONFLICT') {
        message = 'Email này đã được sử dụng để đăng ký tài khoản.';
      } else if (err.category === 'NETWORK' || err.code === 'NETWORK_ERROR') {
        message = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.';
      } else if (err.category === 'TIMEOUT' || err.code === 'TIMEOUT') {
        message = 'Yêu cầu quá thời gian phản hồi (Timeout). Vui lòng thử lại sau.';
      } else if (err.category === 'VALIDATION' || err.code === 'VALIDATION_FAILED') {
        message = err.message || err.details || 'Thông tin đăng ký không hợp lệ.';
      } else if (err.category === 'DATABASE_ERROR') {
        message = 'Cơ sở dữ liệu tạm thời gián đoạn. Vui lòng thử lại sau.';
      } else {
        message = err.message || 'Lỗi máy chủ khi đăng ký.';
      }
    } else if (err instanceof Error) {
      message = err.message;
    }
    return { data: { user: null, session: null }, error: { message, raw: err } };
  }
}

export async function signInWithGoogleExchange(exchangeCode: string) {
  try {
    const res = await authApi.exchangeGoogleCode(exchangeCode);
    const user = applySuccessfulAuthResponse(res);
    return {
      data: { user, session: { access_token: res.accessToken, user } },
      error: null,
    };
  } catch (err: unknown) {
    let message = 'Đăng nhập Google thất bại.';
    if (err instanceof ApiError) {
      message = err.message || 'Mã xác thực Google không hợp lệ hoặc đã hết hạn.';
    } else if (err instanceof Error) {
      message = err.message;
    }
    return { data: { user: null, session: null }, error: { message, raw: err } };
  }
}

export async function signInWithGoogleDirect(code: string, state: string) {
  try {
    const res = await authApi.directGoogleCallback(code, state);
    const user = applySuccessfulAuthResponse(res);
    return {
      data: { user, session: { access_token: res.accessToken, user } },
      error: null,
    };
  } catch (err: unknown) {
    let message = 'Đăng nhập Google thất bại.';
    if (err instanceof ApiError) {
      message = err.message || 'Xác thực Google trực tiếp không thành công.';
    } else if (err instanceof Error) {
      message = err.message;
    }
    return { data: { user: null, session: null }, error: { message, raw: err } };
  }
}

export async function linkGoogleWithCredentials(email: string, password: string, code?: string, state?: string, idToken?: string) {
  try {
    const res = await authApi.linkGoogleWithCredentials({ email, password, code, state, idToken });
    const user = applySuccessfulAuthResponse(res);
    return {
      data: { user, session: { access_token: res.accessToken, user } },
      error: null,
    };
  } catch (err: unknown) {
    let message = 'Liên kết tài khoản Google thất bại.';
    if (err instanceof ApiError) {
      if (err.category === 'AUTH' || err.status === 401 || err.code === 'UNAUTHORIZED') {
        message = 'Mật khẩu tài khoản hiện tại không chính xác.';
      } else {
        message = err.message || 'Không thể liên kết tài khoản Google.';
      }
    } else if (err instanceof Error) {
      message = err.message;
    }
    return { data: { user: null, session: null }, error: { message, raw: err } };
  }
}

export async function signInWithOtp(email: string) {
  return {
    data: null,
    error: { message: 'Đăng nhập OTP qua Magic Link hiện không được hỗ trợ trong môi trường này. Vui lòng đăng nhập bằng Mật khẩu.' },
  };
}

export async function signOutCloud() {
  authVerificationGeneration++;
  try {
    await authApi.logout();
  } catch (err) {
    console.warn('[CloudSync] Remote logout notice:', err);
  } finally {
    const currentUserId = getActiveSyncedUserId();
    if (currentUserId) {
      archiveCurrentDataSlot(currentUserId);
    }
    setAccessToken(null);
    setAuthenticatedUserId(null);
    onUserLogout();
    useCloudSyncStore.getState().setUser(null);
    useCloudSyncStore.getState().setSession(null);
    useCloudSyncStore.getState().setStatus('idle');
    setActiveSyncedUserId(null);
    clearCachedLeaderboard();
    invalidateAuthLeaderboardCache(null);
    clearLeaderboardDebounce();
    void restartHubConnectionIfActive();
    const store = getCloudSyncStoreState();
    if (store?.setIsLoggedOut) {
      store.setIsLoggedOut(true);
    }
    if (store?.setGuestMode) {
      store.setGuestMode(false);
    }
    useCloudSyncStore.getState().setAuthUnavailable(false);
    useCloudSyncStore.getState().setAuthInitialized(true);
  }
  return { error: null };
}

/**
 * Manually retry authentication check (e.g. from auth_unavailable gate)
 */
export function retryAuthCheck(): void {
  useCloudSyncStore.getState().setAuthInitialized(false);
  useCloudSyncStore.getState().setAuthUnavailable(false);
  initCloudSync();
}

/**
 * Event Sync & Outbox Helpers re-exported through coordinator facade
 */
export {
  flushOutboxEventsThroughCoordinator,
  isEventSyncEnabled,
  getEventSyncTelemetry,
  resetEventSyncTelemetryForTesting,
  resetEventSyncConfigForTesting,
  getEventSyncConfig,
  setEventSyncConfig,
  syncDerivedLearningMetrics,
};
