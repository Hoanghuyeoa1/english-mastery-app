import { fetchApi } from './httpClient';
import type { UserProfileDto, UpdateProfilePayload } from './profileApi';
import type { SrsProgressItemDto } from './srsApi';
import type { DailyLogDto } from './dailyLogApi';
import type { DomainEvent } from '../../types/learningEvents';

export type { SrsProgressItemDto, DailyLogDto };

export type IngestEventStatus = 'applied' | 'already_processed' | 'rejected' | 'retryable_error';

export interface IngestEventItemResult {
  event_id: string;
  status: IngestEventStatus;
  code: string;
  message?: string;
}

export interface IngestLearningEventsResponse {
  success: boolean;
  code?: string;
  message?: string;
  received_count?: number;
  applied_count?: number;
  duplicate_count?: number;
  rejected_count?: number;
  server_now?: string;
  results?: IngestEventItemResult[];
}

export interface SyncStateResponse {
  profile: UserProfileDto | null;
  srsItems: SrsProgressItemDto[];
  dailyLogs: DailyLogDto[];
  serverTime: string;
}

export interface SyncUploadPayload {
  profile?: UpdateProfilePayload;
  srsItems?: SrsProgressItemDto[];
  dailyLogs?: DailyLogDto[];
}

export interface SyncUploadResponse {
  success: boolean;
  syncedAt: string;
  srsItemsUpserted: number;
  dailyLogsUpserted: number;
}

export const cloudSyncApi = {
  /**
   * Lấy toàn bộ snapshot học tập từ Cloud (Profile, SRS, DailyLogs, ServerTime)
   */
  async getSyncState(): Promise<SyncStateResponse> {
    return await fetchApi<SyncStateResponse>('/sync/state', {
      method: 'GET',
    });
  },

  /**
   * Tải lên snapshot tiến trình học tập lên Cloud trong một transaction nguyên tử
   */
  async uploadSync(payload: SyncUploadPayload): Promise<SyncUploadResponse> {
    return await fetchApi<SyncUploadResponse>('/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Gửi lô Domain Events từ Local Outbox lên ASP.NET Core API (/sync/events)
   */
  async ingestEvents(events: DomainEvent[]): Promise<IngestLearningEventsResponse> {
    return await fetchApi<IngestLearningEventsResponse>('/sync/events', {
      method: 'POST',
      body: JSON.stringify({ events }),
    });
  },
};

