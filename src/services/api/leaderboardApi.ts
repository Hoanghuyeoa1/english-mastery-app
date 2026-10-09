// src/services/api/leaderboardApi.ts
import { fetchApi } from './httpClient';
import type { LeaderboardMetric } from '../../types';

export interface LeaderboardEntryDto {
  userId: string;
  rank: number;
  displayName: string;
  avatarUrl?: string;
  avatarSeed?: string;
  level: number;
  rankTitle: string;
  score: number;
  secondaryScore?: number;
  isCurrentUser: boolean;
  lastActiveAt?: string;
  equippedFrame?: string;
}

export interface LeaderboardPageResponse {
  success: boolean;
  category: LeaderboardMetric;
  weekId: string;
  serverWeekId: string;
  serverNow: string;
  page: number;
  pageSize: number;
  totalCount: number;
  entries: LeaderboardEntryDto[];
  currentUserEntry?: LeaderboardEntryDto | null;
}

export interface CurrentUserRankResponse {
  success: boolean;
  found: boolean;
  category: LeaderboardMetric;
  weekId: string;
  entry?: LeaderboardEntryDto | null;
}

export interface ServerTimeResponse {
  success: boolean;
  serverNow: string;
  weekId: string;
  weekStart: string;
  weekEnd: string;
  nextReset: string;
  timezone: string;
}

export interface SyncScorePayload {
  displayName?: string;
  avatarUrl?: string;
  avatarSeed?: string;
  level?: number;
  totalXp?: number;
  weeklyXp?: number;
  streak?: number;
  equippedFrame?: string | null;
}

export interface SyncScoreResponse {
  success: boolean;
  code: string;
  message: string;
}

export interface SyncWeeklyMetricsPayload {
  weekId?: string;
  weeklyXp?: number | null;
  vocabMastered?: number | null;
  reviewConsistency?: number | null;
  activeMinutes?: number | null;
  pronunciationGain?: number | null;
  toeicGain?: number | null;
  evidence?: Record<string, unknown>;
}

export interface SyncWeeklyMetricsResponse {
  success: boolean;
  code: string;
  message: string;
  weekId?: string;
  serverWeekId?: string;
  serverNow?: string;
  weeklyXp?: number;
  vocabMastered?: number;
  reviewConsistency?: number | null;
  activeMinutes?: number;
  pronunciationGain?: number | null;
  toeicGain?: number | null;
}

export const leaderboardApi = {
  /**
   * Lấy thời gian máy chủ chuẩn hóa theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
   */
  async fetchServerTime(): Promise<ServerTimeResponse> {
    return await fetchApi<ServerTimeResponse>('/leaderboard/server-time', {
      method: 'GET',
      skipAuth: true,
    });
  },

  /**
   * Lấy trang bảng xếp hạng theo category chuyên biệt (hỗ trợ phân trang)
   */
  async fetchLeaderboardPage(
    category: LeaderboardMetric,
    options?: {
      weekId?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<LeaderboardPageResponse> {
    const params = new URLSearchParams();
    if (options?.weekId) params.set('weekId', options.weekId);
    if (options?.page) params.set('page', String(options.page));
    if (options?.pageSize) params.set('pageSize', String(options.pageSize));

    const query = params.toString() ? `?${params.toString()}` : '';
    return await fetchApi<LeaderboardPageResponse>(`/leaderboard/${encodeURIComponent(category)}${query}`, {
      method: 'GET',
    });
  },

  /**
   * Lấy thứ hạng cá nhân của người học hiện tại
   */
  async fetchCurrentUserRank(
    category: LeaderboardMetric,
    weekId?: string
  ): Promise<CurrentUserRankResponse> {
    const params = new URLSearchParams();
    if (weekId) params.set('weekId', weekId);

    const query = params.toString() ? `?${params.toString()}` : '';
    return await fetchApi<CurrentUserRankResponse>(`/leaderboard/${encodeURIComponent(category)}/me${query}`, {
      method: 'GET',
    });
  },

  /**
   * Đồng bộ điểm số (XP, streak, level, profile presentation) lên bảng xếp hạng
   */
  async syncScore(payload: SyncScorePayload): Promise<SyncScoreResponse> {
    return await fetchApi<SyncScoreResponse>('/leaderboard/sync-score', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Đồng bộ chỉ số học tập tuần (Server-Authoritative)
   */
  async syncWeeklyMetrics(payload: SyncWeeklyMetricsPayload): Promise<SyncWeeklyMetricsResponse> {
    return await fetchApi<SyncWeeklyMetricsResponse>('/leaderboard/sync-metrics', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
