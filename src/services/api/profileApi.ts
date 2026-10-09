// src/services/api/profileApi.ts
import { fetchApi } from './httpClient';

export interface UserProfileDto {
  id: string; // Canonical User.Id (Guid)
  email?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  avatarSeed?: string | null;
  level: number;
  xp: number;
  streak: number;
  equippedFrame?: string | null;
  hasLearnedNightOwl: boolean;
  targetGoal?: string | null;
  targetDailyNewWords: number;
  lastStudyDate?: string | null;
  fourSkillsScoresJson: string;
  lastActiveAt: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface PublicUserProfileDto {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  avatarSeed?: string | null;
  level: number;
  xp: number;
  streak: number;
  equippedFrame?: string | null;
  lastActiveAt: string;
}

export interface UpdateProfilePayload {
  displayName?: string;
  avatarUrl?: string | null;
  avatarSeed?: string | null;
  equippedFrame?: string | null;
  targetGoal?: string | null;
  targetDailyNewWords?: number;
  lastStudyDate?: string | null;
  hasLearnedNightOwl?: boolean;
  xp?: number;
  level?: number;
  streak?: number;
  fourSkillsScoresJson?: string;
}

export const profileApi = {
  /**
   * Lấy toàn bộ thông tin profile của người dùng hiện tại từ JWT session
   */
  async getMyProfile(): Promise<UserProfileDto> {
    return await fetchApi<UserProfileDto>('/profile', {
      method: 'GET',
    });
  },

  /**
   * Cập nhật các trường hồ sơ được phép của người dùng hiện tại
   */
  async updateMyProfile(payload: UpdateProfilePayload): Promise<UserProfileDto> {
    return await fetchApi<UserProfileDto>('/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Lấy hồ sơ công khai của một người học (không chứa email hay thông tin nhạy cảm)
   */
  async getPublicProfile(userId: string): Promise<PublicUserProfileDto> {
    return await fetchApi<PublicUserProfileDto>(`/profile/${encodeURIComponent(userId)}`, {
      method: 'GET',
      skipAuth: true,
    });
  },

  /**
   * Lấy danh sách hồ sơ công khai (cho màn hình admin hoặc bảng xếp hạng)
   */
  async getAllProfiles(): Promise<PublicUserProfileDto[]> {
    return await fetchApi<PublicUserProfileDto[]>('/profile/all', {
      method: 'GET',
      skipAuth: true,
    });
  },
};
