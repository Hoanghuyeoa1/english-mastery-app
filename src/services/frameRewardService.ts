import {
  fetchMyFrameEntitlements,
  equipProfileFrame as equipProfileFrameApi,
} from './api/frameRewardApi';
import type { UserFrameEntitlement, EquipFrameResponse } from '../types';

export type FrameId = 'champion_frame' | 'elite_frame' | 'prestige_frame';

export interface FrameDefinition {
  id: FrameId;
  name: string;
  title: string;
  rank: 1 | 2 | 3;
  description: string;
  badgeText: string;
  avatarRingClass: string;
  borderClasses: string;
  haloClasses: string;
  isRotating: boolean;
}

export const LEADERBOARD_FRAMES: Record<FrameId, FrameDefinition> = {
  champion_frame: {
    id: 'champion_frame',
    name: 'Champion Frame',
    title: 'Khung Quán Quân Tuần',
    rank: 1,
    description: 'Phần thưởng vinh danh Quán quân Top 1 Bảng xếp hạng XP Tuần.',
    badgeText: 'TOP 1 QUÁN QUÂN',
    avatarRingClass: 'ring-2 ring-amber-400',
    borderClasses: 'border-2 border-amber-400 ring-2 ring-amber-400/70 shadow-lg shadow-amber-500/40',
    haloClasses: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 animate-pulse',
    isRotating: true,
  },
  elite_frame: {
    id: 'elite_frame',
    name: 'Elite Frame',
    title: 'Khung Tinh Anh Tuần',
    rank: 2,
    description: 'Phần thưởng vinh danh Á quân 1 Top 2 Bảng xếp hạng XP Tuần.',
    badgeText: 'TOP 2 TINH ANH',
    avatarRingClass: 'ring-2 ring-slate-300',
    borderClasses: 'border-2 border-slate-300 ring-2 ring-slate-300/60 shadow-lg shadow-slate-400/30',
    haloClasses: 'bg-gradient-to-r from-slate-200 via-slate-300 to-slate-400',
    isRotating: false,
  },
  prestige_frame: {
    id: 'prestige_frame',
    name: 'Prestige Frame',
    title: 'Khung Hoàng Gia Tuần',
    rank: 3,
    description: 'Phần thưởng vinh danh Á quân 2 Top 3 Bảng xếp hạng XP Tuần.',
    badgeText: 'TOP 3 HOÀNG GIA',
    avatarRingClass: 'ring-2 ring-amber-700',
    borderClasses: 'border-2 border-amber-700 ring-2 ring-amber-700/60 shadow-lg shadow-amber-800/30',
    haloClasses: 'bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800',
    isRotating: false,
  },
};

/**
 * Lấy định nghĩa chi tiết của khung avatar vinh danh.
 */
export function getFrameDefinition(frameId?: string | null): FrameDefinition | null {
  if (!frameId || !(frameId in LEADERBOARD_FRAMES)) return null;
  return LEADERBOARD_FRAMES[frameId as FrameId];
}

/**
 * Ánh xạ thứ hạng Top XP sang loại khung vinh danh tương ứng.
 * Chỉ Top 1, Top 2, Top 3 mới có khung; Rank >= 4 không có khung.
 */
export function getPodiumFrameByRank(rank: number): FrameId | null {
  if (rank === 1) return 'champion_frame';
  if (rank === 2) return 'elite_frame';
  if (rank === 3) return 'prestige_frame';
  return null;
}

/**
 * Kiểm tra tính hợp lệ về quyền sở hữu khung phía client:
 * Nếu frameId là null (tháo khung) -> luôn hợp lệ.
 * Nếu không nằm trong danh sách đã mở khóa -> từ chối.
 */
export function validateFrameOwnershipLocally(
  unlockedFrames: string[] = [],
  frameId: string | null
): boolean {
  if (frameId === null || frameId === '') return true;
  return unlockedFrames.includes(frameId);
}

/**
 * Tải danh sách quyền sở hữu khung vinh danh của người dùng từ ASP.NET Core API.
 */
export async function fetchUserFrameEntitlements(
  _userId?: string
): Promise<UserFrameEntitlement[]> {
  try {
    const list = await fetchMyFrameEntitlements();
    return list.map((item) => ({
      id: item.id,
      userId: item.userId,
      frameId: item.frameId as FrameId,
      source: item.source || 'weekly_xp_podium',
      weekId: item.weekId || '',
      timesWon: Number(item.timesWon) || 1,
      unlockedAt: item.unlockedAt || '',
    }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[FrameRewardService] Exception fetchUserFrameEntitlements:', msg);
    return [];
  }
}

/**
 * Lấy danh sách ID các khung avatar đã mở khóa của người dùng.
 */
export async function getUserUnlockedFrames(userId?: string): Promise<FrameId[]> {
  const entitlements = await fetchUserFrameEntitlements(userId);
  const uniqueFrames = new Set<FrameId>();
  for (const item of entitlements) {
    if (item.frameId in LEADERBOARD_FRAMES) {
      uniqueFrames.add(item.frameId);
    }
  }
  return Array.from(uniqueFrames);
}

/**
 * Trang bị hoặc gỡ bỏ khung avatar vinh danh qua ASP.NET Core API Server-Authoritative:
 * Xác thực sở hữu nghiêm ngặt tại tầng Backend, không để client tự gán khung chưa mở khóa.
 */
export async function equipProfileFrameOnServer(
  frameId: string | null
): Promise<EquipFrameResponse> {
  try {
    const res = await equipProfileFrameApi(frameId);
    const code = res.code === 'FRAME_NOT_OWNED' ? 'NOT_OWNED' : (res.code as EquipFrameResponse['code']);
    return {
      success: res.success,
      code,
      message: res.message,
      equippedFrame: res.equippedFrame,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[FrameRewardService] Exception equipProfileFrameOnServer:', msg);
    return {
      success: false,
      code: 'ERROR',
      message: msg,
    };
  }
}
