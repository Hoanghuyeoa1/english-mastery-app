// src/services/api/weeklyFinalizationApi.ts
import { fetchApi } from './httpClient';
import type { LeaderboardMetric } from '../../types';

export interface WeeklySnapshotEntryDto {
  id?: string;
  weekId: string;
  category: LeaderboardMetric | string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  level: number;
  rank: number;
  score: number;
  secondaryScore: number;
  frameAwarded?: string;
  finalizedAt: string;
}

export interface WeeklyFinalizationRecordDto {
  weekId: string;
  weekStart: string;
  weekEnd: string;
  finalizedAt: string;
  totalParticipants: number;
  isFinalized: boolean;
  metadataJson?: string;
}

export interface WeeklyFinalizationResponse {
  success: boolean;
  code: 'FINALIZED_SUCCESS' | 'ALREADY_FINALIZED' | 'WEEK_STILL_ACTIVE' | 'PERMISSION_DENIED' | 'ERROR';
  message: string;
  weekId?: string;
  weekStart?: string;
  weekEnd?: string;
  finalizedAt?: string;
  totalParticipants?: number;
  isIdempotent?: boolean;
  serverNow?: string;
  snapshotsCreated?: WeeklySnapshotEntryDto[];
}

export interface PendingCeremonyResponse {
  hasPending: boolean;
  ceremony?: {
    weekId: string;
    rank: number;
    frameId: string;
    score: number;
    displayName: string;
    finalizedAt: string;
  } | null;
}

/**
 * Gọi backend ASP.NET Core API để chốt bảng xếp hạng tuần (Server-Authoritative)
 */
export async function finalizeWeeklyLeaderboard(
  weekId?: string,
  topLimit = 3
): Promise<WeeklyFinalizationResponse> {
  try {
    return await fetchApi<WeeklyFinalizationResponse>('/leaderboard/finalization/finalize', {
      method: 'POST',
      body: JSON.stringify({
        weekId: weekId ? weekId.trim() : null,
        topLimit,
      }),
    });
  } catch (error: any) {
    const isPermissionDenied = error?.status === 403 ||
      String(error?.message || '').toLowerCase().includes('permission') ||
      error?.code === 'PERMISSION_DENIED';

    return {
      success: false,
      code: isPermissionDenied ? 'PERMISSION_DENIED' : 'ERROR',
      message: error?.message || 'Lỗi khi gọi API chốt tuần.',
    };
  }
}

/**
 * Tải danh sách ảnh chụp kết quả tuần từ ASP.NET Core API
 */
export async function fetchWeeklySnapshots(
  weekId: string,
  category: LeaderboardMetric = 'weekly_xp'
): Promise<WeeklySnapshotEntryDto[]> {
  try {
    const query = new URLSearchParams({
      weekId: weekId.trim(),
      category: category.trim(),
    });

    return await fetchApi<WeeklySnapshotEntryDto[]>(
      `/leaderboard/finalization/results?${query.toString()}`,
      { method: 'GET' }
    );
  } catch (error) {
    console.warn('[WeeklyFinalizationApi] Lỗi fetchWeeklySnapshots:', error);
    return [];
  }
}

/**
 * Tải danh sách các tuần đã chốt trong lịch sử từ ASP.NET Core API
 */
export async function fetchFinalizedWeeks(
  limit = 10
): Promise<WeeklyFinalizationRecordDto[]> {
  try {
    const query = new URLSearchParams({ limit: String(limit) });
    return await fetchApi<WeeklyFinalizationRecordDto[]>(
      `/leaderboard/finalization/history?${query.toString()}`,
      { method: 'GET' }
    );
  } catch (error) {
    console.warn('[WeeklyFinalizationApi] Lỗi fetchFinalizedWeeks:', error);
    return [];
  }
}

/**
 * Kiểm tra lễ vinh danh đang chờ xác nhận cho tài khoản hiện tại từ ASP.NET Core API
 */
export async function fetchPendingCeremony(
  weekId?: string
): Promise<PendingCeremonyResponse> {
  try {
    const query = weekId ? `?weekId=${encodeURIComponent(weekId.trim())}` : '';
    return await fetchApi<PendingCeremonyResponse>(
      `/leaderboard/ceremony/pending${query}`,
      { method: 'GET' }
    );
  } catch (error) {
    console.warn('[WeeklyFinalizationApi] Lỗi fetchPendingCeremony:', error);
    return { hasPending: false, ceremony: null };
  }
}
