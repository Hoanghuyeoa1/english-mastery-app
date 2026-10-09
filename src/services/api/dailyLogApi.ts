// src/services/api/dailyLogApi.ts
import { fetchApi } from './httpClient';

export interface DailyLogDto {
  date: string; // YYYY-MM-DD
  wordsLearned: number;
  xpEarned: number;
  wordsReviewed?: number;
  quizzesCompleted?: number;
}

export interface BatchUpsertDailyLogsResponse {
  success: boolean;
  upsertedCount: number;
  processedAt: string;
}

export const dailyLogApi = {
  /**
   * Lấy lịch sử học tập hàng ngày của người dùng hiện tại (hỗ trợ lọc theo khoảng ngày)
   */
  async getDailyLogs(options?: {
    fromDate?: string;
    toDate?: string;
  }): Promise<DailyLogDto[]> {
    const params = new URLSearchParams();
    if (options?.fromDate) params.set('fromDate', options.fromDate);
    if (options?.toDate) params.set('toDate', options.toDate);

    const query = params.toString() ? `?${params.toString()}` : '';
    return await fetchApi<DailyLogDto[]>(`/dailylogs${query}`, {
      method: 'GET',
    });
  },

  /**
   * Batch upsert danh sách DailyLogs với nguyên tắc Monotonic Max Values
   */
  async batchUpsertDailyLogs(logs: DailyLogDto[]): Promise<BatchUpsertDailyLogsResponse> {
    return await fetchApi<BatchUpsertDailyLogsResponse>('/dailylogs/batch', {
      method: 'POST',
      body: JSON.stringify({ logs }),
    });
  },

  /**
   * Xóa sạch lịch sử học tập hàng ngày của người dùng hiện tại
   */
  async resetUserDailyLogs(): Promise<{ success: boolean; message: string }> {
    return await fetchApi<{ success: boolean; message: string }>('/dailylogs/user-history', {
      method: 'DELETE',
    });
  },

  /**
   * Admin Reset: Xóa sạch lịch sử học tập hàng ngày của các tài khoản được chỉ định
   */
  async adminResetUsersDailyLogs(userIds: string[]): Promise<{ success: boolean; message: string }> {
    return await fetchApi<{ success: boolean; message: string }>('/dailylogs/admin-reset', {
      method: 'POST',
      body: JSON.stringify(userIds),
    });
  },
};
