// src/services/api/frameRewardApi.ts
import { fetchApi } from './httpClient';

export interface UserFrameEntitlementDto {
  id: string;
  userId: string;
  frameId: string;
  source: string;
  weekId: string;
  timesWon: number;
  unlockedAt: string;
}

export interface EquipFrameResponse {
  success: boolean;
  code: 'EQUIPPED_SUCCESS' | 'UNEQUIPPED_SUCCESS' | 'FRAME_NOT_OWNED' | 'ERROR';
  message: string;
  equippedFrame?: string | null;
}

/**
 * Tải danh sách quyền sở hữu khung avatar của người dùng hiện tại từ ASP.NET Core API
 */
export async function fetchMyFrameEntitlements(): Promise<UserFrameEntitlementDto[]> {
  try {
    return await fetchApi<UserFrameEntitlementDto[]>('/frames/my-entitlements', {
      method: 'GET',
    });
  } catch (error) {
    console.warn('[FrameRewardApi] Lỗi fetchMyFrameEntitlements:', error);
    return [];
  }
}

/**
 * Trang bị hoặc gỡ bỏ khung avatar qua ASP.NET Core API (Server-Authoritative ownership verification)
 */
export async function equipProfileFrame(
  frameId: string | null
): Promise<EquipFrameResponse> {
  try {
    return await fetchApi<EquipFrameResponse>('/frames/equip', {
      method: 'POST',
      body: JSON.stringify({
        frameId: frameId ? frameId.trim() : null,
      }),
    });
  } catch (error: any) {
    console.warn('[FrameRewardApi] Lỗi equipProfileFrame:', error);
    const code = error?.data?.code || error?.code || (error?.status === 400 ? 'FRAME_NOT_OWNED' : 'ERROR');
    return {
      success: false,
      code: code as EquipFrameResponse['code'],
      message: error?.message || 'Lỗi trang bị khung avatar.',
    };
  }
}
