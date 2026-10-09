// src/services/api/srsApi.ts
import { fetchApi } from './httpClient';

export interface SrsProgressItemDto {
  wordId: string;
  interval: number;
  easeFactor: number;
  repetition: number;
  nextReviewDate?: string | null;
  lastReviewedDate?: string | null;
  algorithm?: 'sm2' | 'fsrs' | string;
  stability?: number | null;
  difficulty?: number | null;
  state?: number | null;
  lapses?: number | null;
  reps?: number | null;
  isFavorite?: boolean;
  sources?: string[] | null;
}

export interface BatchUpsertSrsResponse {
  success: boolean;
  upsertedCount: number;
  processedAt: string;
}

export const srsApi = {
  /**
   * Lấy danh sách tiến trình SRS của người dùng hiện tại
   */
  async getSrsProgressList(options?: {
    algorithm?: string;
    dueBefore?: string;
  }): Promise<SrsProgressItemDto[]> {
    const params = new URLSearchParams();
    if (options?.algorithm) params.set('algorithm', options.algorithm);
    if (options?.dueBefore) params.set('dueBefore', options.dueBefore);

    const query = params.toString() ? `?${params.toString()}` : '';
    return await fetchApi<SrsProgressItemDto[]>(`/srs${query}`, {
      method: 'GET',
    });
  },

  /**
   * Lấy tiến trình SRS của một từ vựng cụ thể
   */
  async getWordSrsProgress(wordId: string): Promise<SrsProgressItemDto> {
    return await fetchApi<SrsProgressItemDto>(`/srs/${encodeURIComponent(wordId)}`, {
      method: 'GET',
    });
  },

  /**
   * Batch upsert danh sách tiến trình SRS với nguyên tắc Completed Always Wins
   */
  async batchUpsertSrs(items: SrsProgressItemDto[]): Promise<BatchUpsertSrsResponse> {
    return await fetchApi<BatchUpsertSrsResponse>('/srs/batch', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  /**
   * Xóa sạch tiến trình SRS của người dùng hiện tại (Local reset)
   */
  async resetUserSrsProgress(): Promise<{ success: boolean; message: string }> {
    return await fetchApi<{ success: boolean; message: string }>('/srs/user-progress', {
      method: 'DELETE',
    });
  },

  /**
   * Admin Reset: Xóa sạch tiến trình SRS của các tài khoản được chỉ định
   */
  async adminResetUsersSrs(userIds: string[]): Promise<{ success: boolean; message: string }> {
    return await fetchApi<{ success: boolean; message: string }>('/srs/admin-reset', {
      method: 'POST',
      body: JSON.stringify(userIds),
    });
  },
};
