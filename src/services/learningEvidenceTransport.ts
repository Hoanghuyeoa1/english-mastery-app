// src/services/learningEvidenceTransport.ts
/**
 * Minimal Authenticated Learning Evidence Transport (Phase 6)
 * 
 * Invariants & Architectural Rules:
 * 1. Local-First: Real learning actions ALWAYS commit to local state first.
 *    Evidence submission is asynchronous, non-blocking, and NEVER rolls back local state.
 * 2. Leaderboard Scope: Transports ONLY aggregate learning evidence and profile metrics
 *    (POST /api/leaderboard/sync-score and POST /api/leaderboard/sync-metrics).
 *    Zero dependency on full-state personal cloud sync (UserSrsProgresses / DailyLogs).
 * 3. Strict Account Boundary:
 *    - Anonymous learning is NEVER uploaded to an arbitrary or subsequent account.
 *    - Unauthenticated learning never fakes an online rank.
 *    - Account switching purges pending queues to prevent cross-account contamination.
 * 4. Resilient Offline & Reconnect:
 *    - When offline, valid evidence for the current authenticated user is kept pending.
 *    - When back online, pending evidence is automatically replayed and flushed.
 *    - Server validation ensures idempotency; duplicate submissions never duplicate rewards.
 * 5. Bounded Performance & Debounced Dispatch:
 *    - Rapid learning actions are coalesced with a configurable debounce (default 1500ms).
 *    - Never scans the full dictionary or triggers uploads on render/mount.
 */

import { getAccessToken } from './api/httpClient';
import { leaderboardApi } from './api/leaderboardApi';
import {
  calculateWeeklyXpFromHistory,
  syncUserScoreToLeaderboard,
  type LeaderboardProfilePayload,
} from './leaderboardService';
import { syncDerivedLearningMetrics } from './leaderboardLearningMetrics';
import {
  getCloudSyncStoreState,
  useCloudSyncStore,
} from './cloudSyncService';

export interface EvidenceTransportResult {
  success: boolean;
  code: string;
  message?: string;
  weeklyXp?: number;
  vocabMastered?: number;
}

// Internal State
let activeUserId: string | null = null;
let pendingEvidenceUserId: string | null = null;
let hasPendingEvidence = false;
let isSubmitting = false;
let hasFollowUpRequest = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isListenerInitialized = false;

// Observability Telemetry
let lastSyncedAt: string | null = null;
let lastSyncError: string | null = null;
let consecutiveFailures = 0;

/**
 * Lấy User ID được xác thực hiện tại.
 */
export function getAuthenticatedUserId(): string | null {
  if (activeUserId) return activeUserId;
  const storeUser = useCloudSyncStore.getState().userId;
  if (storeUser) {
    activeUserId = storeUser;
    return storeUser;
  }
  return null;
}

/**
 * Cập nhật User ID được xác thực.
 */
export function setAuthenticatedUserId(userId: string | null): void {
  activeUserId = userId;
}

/**
 * Kiểm tra xem có bằng chứng học tập đang chờ gửi lại sau khi offline không.
 */
export function hasPendingOfflineEvidence(): boolean {
  return hasPendingEvidence;
}

/**
 * Lấy User ID của bằng chứng đang chờ gửi.
 */
export function getPendingEvidenceUserId(): string | null {
  return pendingEvidenceUserId;
}

/**
 * Xử lý khi người dùng đăng nhập.
 * - Gán User ID hợp lệ.
 * - Nếu trước đó có bằng chứng pending của user khác: xóa bỏ để chống nhiễm chéo.
 */
export function onUserLogin(userId: string): void {
  if (!userId) return;

  if (pendingEvidenceUserId && pendingEvidenceUserId !== userId) {
    console.log(`[EvidenceTransport] Discarding pending evidence of previous user ${pendingEvidenceUserId} on login of ${userId}`);
    hasPendingEvidence = false;
    pendingEvidenceUserId = null;
  }

  activeUserId = userId;
  // Kích hoạt đồng bộ chỉ số tuần hiện tại một cách an toàn
  scheduleLearningEvidenceSubmission(500);
}

/**
 * Xử lý khi người dùng đăng xuất.
 * - Hủy bỏ timer debounce.
 * - Xóa active user và pending evidence để tránh upload sang phiên khác.
 */
export function onUserLogout(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  activeUserId = null;
  hasPendingEvidence = false;
  pendingEvidenceUserId = null;
  isSubmitting = false;
  hasFollowUpRequest = false;
}

/**
 * Xử lý khi phát hiện chuyển đổi tài khoản (Account Switching).
 */
export function onAccountSwitch(newUserId: string | null): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (activeUserId && activeUserId !== newUserId) {
    console.log(`[EvidenceTransport] Account switch (${activeUserId} -> ${newUserId}). Purging pending evidence queue.`);
    hasPendingEvidence = false;
    pendingEvidenceUserId = null;
  }

  activeUserId = newUserId;
}

/**
 * Kiểm tra trạng thái trực tuyến của thiết bị.
 */
function isDeviceOnline(): boolean {
  const storeIsOnline = useCloudSyncStore.getState().isOnline;
  if (storeIsOnline === false) return false;
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

/**
 * Thực thi gửi bằng chứng học tập đã xác thực lên Leaderboard API.
 * Tuân thủ nghiêm ngặt Local-First: không bao giờ throw lỗi làm hỏng hoặc rollback tiến trình học cục bộ.
 */
export async function flushLearningEvidence(): Promise<EvidenceTransportResult> {
  const token = getAccessToken();
  const userId = getAuthenticatedUserId();

  // 1. Kiểm tra xác thực (Account Boundary)
  if (!token || !userId) {
    // Không có phiên đăng nhập -> Giữ hoàn toàn cục bộ, không gửi ra ngoài
    return {
      success: false,
      code: 'UNAUTHENTICATED',
      message: 'Chưa đăng nhập. Tiến trình học được bảo lưu an toàn cục bộ.',
    };
  }

  // 2. Kiểm tra kết nối mạng (Offline Resilience)
  if (!isDeviceOnline()) {
    hasPendingEvidence = true;
    pendingEvidenceUserId = userId;
    return {
      success: false,
      code: 'OFFLINE',
      message: 'Thiết bị đang ngoại tuyến. Bằng chứng học tập được lưu chờ kết nối lại.',
    };
  }

  // 3. Concurrency Coalescing: Nếu đang có request in-flight, đánh dấu cần chạy tiếp đợt sau
  if (isSubmitting) {
    hasFollowUpRequest = true;
    return {
      success: true,
      code: 'COALESCED',
      message: 'Yêu cầu được gộp vào đợt gửi đang thực thi.',
    };
  }

  isSubmitting = true;

  try {
    // 4. Lấy trạng thái hiện tại từ App Store
    const storeState = getCloudSyncStoreState ? getCloudSyncStoreState() : null;
    const profile = storeState?.profile || {};
    const dailyHistory = storeState?.dailyHistory || {};
    const currentWeeklyXp = calculateWeeklyXpFromHistory(dailyHistory);

    // 5. Gửi Profile Score (Level, Total XP, Weekly XP, Streak, Equipped Frame)
    await leaderboardApi.syncScore({
      displayName: profile.name,
      avatarSeed: profile.avatarSeed,
      level: profile.level || 1,
      totalXp: profile.xp || 0,
      weeklyXp: currentWeeklyXp,
      streak: profile.streak || 0,
      equippedFrame: profile.equippedFrame || null,
    });

    // 6. Gửi Derived Learning Metrics (7 categories & evidence)
    const metricsRes = await syncDerivedLearningMetrics(userId);

    if (metricsRes.success) {
      hasPendingEvidence = false;
      pendingEvidenceUserId = null;
      consecutiveFailures = 0;
      lastSyncedAt = new Date().toISOString();
      lastSyncError = null;

      return {
        success: true,
        code: 'SYNCED_SUCCESS',
        message: 'Đồng bộ bằng chứng học tập thành công.',
        weeklyXp: metricsRes.weekly_xp,
        vocabMastered: metricsRes.vocab_mastered,
      };
    } else {
      // Nếu server trả mã OFFLINE hoặc lỗi mạng có thể thử lại
      if (metricsRes.code === 'OFFLINE' || metricsRes.code === 'NETWORK_ERROR') {
        hasPendingEvidence = true;
        pendingEvidenceUserId = userId;
      }
      consecutiveFailures++;
      lastSyncError = metricsRes.message || metricsRes.code || null;

      return {
        success: false,
        code: metricsRes.code || 'METRICS_SYNC_FAILED',
        message: metricsRes.message,
      };
    }
  } catch (err: unknown) {
    consecutiveFailures++;
    const errMsg = err instanceof Error ? err.message : 'Lỗi gửi bằng chứng học tập';
    lastSyncError = errMsg;

    // Local-First: Đánh dấu pending để thử lại khi có mạng, tuyệt đối không rollback tiến trình
    hasPendingEvidence = true;
    pendingEvidenceUserId = userId;

    return {
      success: false,
      code: 'SUBMISSION_EXCEPTION',
      message: errMsg,
    };
  } finally {
    isSubmitting = false;

    // Nếu trong lúc gửi có thêm hành động học mới xảy ra, tiếp tục gửi đợt mới
    if (hasFollowUpRequest) {
      hasFollowUpRequest = false;
      void flushLearningEvidence();
    }
  }
}

/**
 * Debounced Dispatcher: Được gọi sau mỗi hành động học hợp lệ trong Domain (XP, SRS, TOEIC, Pronunciation).
 * Tránh gửi liên tục sau mỗi thao tác bàn phím hay render UI.
 */
export function scheduleLearningEvidenceSubmission(delayMs = 1500): void {
  const token = getAccessToken();
  const userId = getAuthenticatedUserId();

  // Nếu chưa đăng nhập: Tuyệt đối không lập lịch gửi
  if (!token || !userId) {
    return;
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flushLearningEvidence();
  }, delayMs);
}

/**
 * Khởi tạo listener lắng nghe sự kiện mạng (Reconnect Listener).
 * Tự động gửi lại bằng chứng khi thiết bị có mạng trở lại.
 */
export function initConnectivityListener(): () => void {
  if (isListenerInitialized || typeof window === 'undefined') {
    return () => {};
  }

  isListenerInitialized = true;

  const handleOnline = () => {
    console.log('[EvidenceTransport] Device came online. Checking pending learning evidence...');
    const userId = getAuthenticatedUserId();
    if (hasPendingEvidence && pendingEvidenceUserId && pendingEvidenceUserId === userId) {
      void flushLearningEvidence();
    }
  };

  window.addEventListener('online', handleOnline);

  return () => {
    window.removeEventListener('online', handleOnline);
    isListenerInitialized = false;
  };
}

// Tự động khởi tạo listener trong môi trường trình duyệt
if (typeof window !== 'undefined') {
  initConnectivityListener();
}

/**
 * Helpers phục vụ kiểm thử đơn vị
 */
export function getEvidenceTransportStateForTesting() {
  return {
    activeUserId,
    pendingEvidenceUserId,
    hasPendingEvidence,
    isSubmitting,
    hasFollowUpRequest,
    hasDebounceTimer: debounceTimer !== null,
    consecutiveFailures,
    lastSyncedAt,
    lastSyncError,
  };
}

export function resetEvidenceTransportStateForTesting(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  activeUserId = null;
  pendingEvidenceUserId = null;
  hasPendingEvidence = false;
  isSubmitting = false;
  hasFollowUpRequest = false;
  consecutiveFailures = 0;
  lastSyncedAt = null;
  lastSyncError = null;
}
