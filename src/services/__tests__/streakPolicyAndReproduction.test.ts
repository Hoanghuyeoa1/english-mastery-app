// @vitest-environment happy-dom
// src/services/__tests__/streakPolicyAndReproduction.test.ts
// Targeted Regression & Reproduction Suite for Phase 2: Streak Policy & Root Cause

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { getVietnamDateString } from '../leaderboardLearningMetrics';
import { partializeAppStore, handleStoreRehydration } from '../../store/storeRehydration';
import { DEFAULT_PROFILE } from '../../store/initialDefaults';

// Mock cloud sync and external networks to keep tests isolated
vi.mock('../cloudSyncService', () => ({
  scheduleCloudSync: vi.fn(),
  getCloudSyncStoreState: () => useAppStore.getState(),
  useCloudSyncStore: () => useAppStore.getState(),
  registerCloudSyncStoreGetter: vi.fn(),
}));

describe('Phase 2 — Streak Policy & Root Cause Reproduction Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetToDefault();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // CASE 1: New user chưa học (Chỉ mở app)
  // Expected: Mở app chạy checkDailyReset() -> streak = 0, lastStudyDate = null
  // ==========================================================================
  it('Case 1: New user chưa học -> streak = 0, lastStudyDate = null, lastActiveDate = today', () => {
    const today = getVietnamDateString();
    
    // Simulate App.tsx mount
    useAppStore.getState().checkDailyReset();

    const { profile } = useAppStore.getState();
    expect(profile.streak).toBe(0);
    expect(profile.lastStudyDate).toBeNull();
    expect(profile.lastActiveDate).toBe(today);
  });

  // ==========================================================================
  // CASE 2: Qualifying activity ngày đầu tiên (CORE REPRODUCTION OF BUG!)
  // User mở app, sau đó học bài đầu tiên (ví dụ hoàn thành 10 flashcards = 150 XP).
  // Policy: Phải ghi nhận streak = 1, lastStudyDate = today.
  // Code hiện tại: Bị chặn bởi dòng 183 do (!lastStudyDate && lastActiveDate === today) -> BỊ FAIL!
  // ==========================================================================
  it('Case 2 [BUG REPRO]: Qualifying activity ngày đầu -> Streak phải là 1 và lastStudyDate = today', () => {
    const today = getVietnamDateString();

    // 1. App mở lên: checkDailyReset() thiết lập lastActiveDate = today, lastStudyDate = null
    useAppStore.getState().checkDailyReset();
    expect(useAppStore.getState().profile.lastActiveDate).toBe(today);
    expect(useAppStore.getState().profile.lastStudyDate).toBeNull();

    // 2. Học bài thực tế: nhận 150 XP từ flashcards
    useAppStore.getState().gainXP(150, {
      source: 'flashcard',
      metadata: { isNew: true },
    });

    const { profile, dailyHistory } = useAppStore.getState();

    // Xác minh Daily History ghi nhận 150 XP
    expect(profile.xp).toBe(150);

    // THE CORE ASSERTION:
    // Theo nghiệp vụ chuẩn: Ngày đầu học thật sự phải có Streak = 1 và lastStudyDate = today.
    // LỖI HIỆN TẠI: profile.streak vẫn bằng 0 và lastStudyDate vẫn null do bug dòng 183 trong createProfileSlice.ts
    expect(profile.streak).toBe(1);
    expect(profile.lastStudyDate).toBe(today);
  });

  // ==========================================================================
  // CASE 3: Nhiều activity cùng ngày (Idempotency)
  // Trong cùng 1 ngày, người dùng học thêm nhiều bài -> streak không được tăng lặp lại.
  // ==========================================================================
  it('Case 3: Nhiều activity cùng ngày -> Streak giữ nguyên (không tăng lặp lại)', () => {
    const today = getVietnamDateString();

    // Giả lập trạng thái đã học hôm nay thành công (streak = 1, lastStudyDate = today)
    useAppStore.setState({
      profile: {
        ...DEFAULT_PROFILE,
        streak: 1,
        lastStudyDate: today,
        lastActiveDate: today,
        xp: 15,
      },
    });

    // Học thêm 3 bài nữa trong ngày
    useAppStore.getState().gainXP(15, { source: 'flashcard' });
    useAppStore.getState().gainXP(20, { source: 'quiz' });
    useAppStore.getState().gainXP(25, { source: 'pronunciation' });

    const { profile } = useAppStore.getState();
    expect(profile.streak).toBe(1); // Không tăng lên 2, 3, 4
    expect(profile.lastStudyDate).toBe(today);
    expect(profile.xp).toBe(75);
  });

  // ==========================================================================
  // CASE 4: Hai ngày liên tiếp (Consecutive Study Days)
  // Ngày 1 đã học (lastStudyDate = yesterday, streak = 1).
  // Ngày 2 học tiếp -> Streak phải tăng lên 2.
  // ==========================================================================
  it('Case 4: Hai ngày liên tiếp -> Streak tăng từ 1 lên 2', () => {
    const today = getVietnamDateString();
    const todayDate = new Date();
    todayDate.setDate(todayDate.getDate() - 1);
    const yesterday = getVietnamDateString(todayDate);

    // Setup: Hôm qua đã học và có streak = 1
    useAppStore.setState({
      profile: {
        ...DEFAULT_PROFILE,
        streak: 1,
        lastStudyDate: yesterday,
        lastActiveDate: yesterday,
        xp: 50,
      },
    });

    // Mở app ngày mới: checkDailyReset()
    useAppStore.getState().checkDailyReset();
    // Streak ngày hôm qua vẫn được giữ trước khi học hôm nay:
    expect(useAppStore.getState().profile.streak).toBe(1);

    // Học bài hôm nay
    useAppStore.getState().gainXP(20, { source: 'flashcard' });

    const { profile } = useAppStore.getState();
    expect(profile.streak).toBe(2);
    expect(profile.lastStudyDate).toBe(today);
  });

  // ==========================================================================
  // CASE 5: Missed Day (Bỏ lỡ 2 ngày không học)
  // User học cách đây 2 ngày (streak = 5).
  // Mở app hôm nay: Streak bị đứt về 0. Khi học bài hôm nay: Streak bắt đầu lại từ 1.
  // ==========================================================================
  it('Case 5: Bỏ lỡ ngày học -> checkDailyReset reset streak về 0, học lại thì streak = 1', () => {
    const today = getVietnamDateString();
    const twoDaysAgoDate = new Date();
    twoDaysAgoDate.setDate(twoDaysAgoDate.getDate() - 2);
    const twoDaysAgo = getVietnamDateString(twoDaysAgoDate);

    useAppStore.setState({
      profile: {
        ...DEFAULT_PROFILE,
        streak: 5,
        lastStudyDate: twoDaysAgo,
        lastActiveDate: twoDaysAgo,
      },
    });

    // 1. Mở app hôm nay -> Đứt chuỗi, streak về 0
    useAppStore.getState().checkDailyReset();
    expect(useAppStore.getState().profile.streak).toBe(0);

    // 2. Học bài hôm nay -> Bắt đầu chuỗi mới từ 1
    useAppStore.getState().gainXP(20, { source: 'flashcard' });
    expect(useAppStore.getState().profile.streak).toBe(1);
    expect(useAppStore.getState().profile.lastStudyDate).toBe(today);
  });

  // ==========================================================================
  // CASE 6: Reload / Rehydration bảo toàn Streak
  // ==========================================================================
  it('Case 6: Reload & Store Rehydration bảo toàn nguyên vẹn streak và mốc ngày', () => {
    const today = getVietnamDateString();
    useAppStore.setState({
      profile: {
        ...DEFAULT_PROFILE,
        streak: 4,
        lastStudyDate: today,
        lastActiveDate: today,
        xp: 400,
      },
    });

    // Simulate partialize and rehydrate
    const partialized = partializeAppStore(useAppStore.getState());
    const mockState = { ...useAppStore.getState(), ...partialized };
    handleStoreRehydration(mockState);

    expect(mockState.profile.streak).toBe(4);
    expect(mockState.profile.lastStudyDate).toBe(today);
  });

  // ==========================================================================
  // CASE 7: Offline Guest
  // Người dùng Guest chưa đăng nhập vẫn phải tính Streak cục bộ khi học
  // ==========================================================================
  it('Case 7 [BUG REPRO]: Offline Guest hoàn thành bài học -> Streak phải là 1', () => {
    const today = getVietnamDateString();

    useAppStore.setState({
      isGuestMode: true,
      profile: {
        ...DEFAULT_PROFILE,
        streak: 0,
        lastStudyDate: null,
        lastActiveDate: null,
      },
    });

    useAppStore.getState().checkDailyReset();
    useAppStore.getState().gainXP(20, { source: 'quiz' });

    const { profile } = useAppStore.getState();
    // Kỳ vọng nghiệp vụ: Guest học vẫn phải có Streak = 1
    // Lỗi hiện tại: Bị chặn tương tự Case 2
    expect(profile.streak).toBe(1);
    expect(profile.lastStudyDate).toBe(today);
  });

  // ==========================================================================
  // CASE 8: Midnight Vietnam (Ranh giới 00:00 - 06:59 GMT+7)
  // Kiểm tra sự sai lệch giữa UTC Date và getVietnamDateString()
  // ==========================================================================
  it('Case 8: Midnight Vietnam Timezone consistency', () => {
    // Giả lập thời điểm 01:00 AM sáng tại Hà Nội ngày 2026-10-09 (tức 18:00 UTC ngày 2026-10-08)
    const midnightUtcMs = Date.parse('2026-10-08T18:00:00.000Z');
    const vnDate = getVietnamDateString(midnightUtcMs);
    const utcDate = new Date(midnightUtcMs).toISOString().split('T')[0];

    // Xác nhận tại thời điểm này VN là 09/10 còn UTC là 08/10
    expect(vnDate).toBe('2026-10-09');
    expect(utcDate).toBe('2026-10-08');

    // BUG CHECK: Trong createProfileSlice.ts line 267:
    // gainXP dùng new Date().toISOString().split('T')[0] (UTC)
    // trong khi checkDailyReset/checkAndUpdateStreak dùng getVietnamDateString() (VN)
    // Điều này chứng minh lỗ hổng chia rẽ ngày giữa Daily History và Streak!
    expect(vnDate).not.toBe(utcDate);
  });

  // ==========================================================================
  // CASE 9: XP Reward không phải là Learning Activity
  // Mở rương hoặc nhận thành tựu (+100 XP) không được coi là ngày học
  // ==========================================================================
  it('Case 9: XP reward từ rương/thành tựu không được kích hoạt tính Streak', () => {
    useAppStore.setState({
      profile: {
        ...DEFAULT_PROFILE,
        streak: 0,
        lastStudyDate: null,
        lastActiveDate: null,
        xp: 0,
      },
    });

    useAppStore.getState().checkDailyReset();

    // Giả lập nhận thưởng rương báu +100 XP (không có source learning)
    // Nghiệp vụ: Chỉ tăng XP, streak vẫn phải là 0, lastStudyDate vẫn null
    // (Lưu ý: Hiện tại code gọi checkAndUpdateStreak() vô điều kiện bên trong gainXP,
    // nhưng do dính bug line 183 nên streak tình cờ vẫn là 0)
    useAppStore.getState().gainXP(100);

    const { profile } = useAppStore.getState();
    expect(profile.xp).toBe(100);
    expect(profile.streak).toBe(0);
    expect(profile.lastStudyDate).toBeNull();
  });

  // ==========================================================================
  // CASE 10: Old Daily Activity có evidence thật (Quá khứ)
  // Heatmap có 1 ngày từ tuần trước nhưng hôm nay chưa học -> Current streak = 0
  // ==========================================================================
  it('Case 10: Heatmap có 1 ngày hoạt động trong quá khứ nhưng bỏ lỡ -> Streak hiện tại = 0', () => {
    const today = getVietnamDateString();
    const oldDate = '2026-10-01'; // 8 ngày trước

    useAppStore.setState({
      dailyHistory: {
        [oldDate]: {
          date: oldDate,
          wordsReviewed: 15,
          newWordsLearned: 5,
          quizzesCompleted: 1,
          pronunciationsMastered: 0,
          xpGained: 150,
        },
      },
      profile: {
        ...DEFAULT_PROFILE,
        streak: 1,
        lastStudyDate: oldDate,
        lastActiveDate: oldDate,
        xp: 150,
      },
    });

    // Mở app hôm nay
    useAppStore.getState().checkDailyReset();

    const { profile, dailyHistory } = useAppStore.getState();
    // Daily history vẫn giữ ngày cũ 150 XP
    expect(dailyHistory[oldDate].xpGained).toBe(150);
    // Nhưng streak hiện tại phải bị đứt về 0 vì đã bỏ lỡ nhiều ngày
    expect(profile.streak).toBe(0);
  });

  // ==========================================================================
  // CASE 11: Invalid timestamp resilience
  // ==========================================================================
  it('Case 11: lastStudyDate mang giá trị không hợp lệ -> Hệ thống phục hồi an toàn', () => {
    useAppStore.setState({
      profile: {
        ...DEFAULT_PROFILE,
        streak: 2,
        lastStudyDate: 'INVALID_TIMESTAMP',
        lastActiveDate: 'INVALID_TIMESTAMP',
      },
    });

    // Không được crash khi chạy checkDailyReset
    expect(() => {
      useAppStore.getState().checkDailyReset();
    }).not.toThrow();
  });

  // ==========================================================================
  // CASE 12: 5 activities cùng ngày -> Streak chỉ tính 1, DailyProgress tích lũy đúng
  // ==========================================================================
  it('Case 12: 5 activities cùng ngày -> Streak = 1, DailyProgress cộng dồn không nhân đôi', () => {
    const today = getVietnamDateString();
    useAppStore.getState().checkDailyReset();

    // 5 activities khác nhau trong ngày
    useAppStore.getState().gainXP(15, { source: 'flashcard' });
    useAppStore.getState().gainXP(15, { source: 'flashcard' });
    useAppStore.getState().gainXP(20, { source: 'quiz' });
    useAppStore.getState().gainXP(25, { source: 'pronunciation' });
    useAppStore.getState().gainXP(30, { source: 'four_skills' });

    const { profile, dailyHistory } = useAppStore.getState();
    expect(profile.streak).toBe(1);
    expect(profile.lastStudyDate).toBe(today);
    expect(profile.xp).toBe(105);
    expect(dailyHistory[today].xpGained).toBe(105);
  });

  // ==========================================================================
  // CASE 13: Current Streak vs Longest Streak
  // Học 3 ngày liên tiếp -> Streak = 3, Longest = 3. Bỏ 2 ngày -> Streak = 0, Longest = 3.
  // Học lại ngày tiếp theo -> Streak = 1, Longest = 3.
  // ==========================================================================
  it('Case 13: Current vs Longest Streak -> Longest được bảo lưu nguyên vẹn khi đứt chuỗi', () => {
    // Ngày 1
    useAppStore.setState({
      profile: {
        ...DEFAULT_PROFILE,
        streak: 1,
        longestStreak: 1,
        lastStudyDate: '2026-10-01',
        lastActiveDate: '2026-10-01',
      },
    });

    // Ngày 2: Học tiếp
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T10:00:00+07:00'));
    useAppStore.getState().checkDailyReset();
    useAppStore.getState().gainXP(20, { source: 'flashcard' });

    expect(useAppStore.getState().profile.streak).toBe(2);
    expect(useAppStore.getState().profile.longestStreak).toBe(2);

    // Ngày 3: Học tiếp
    vi.setSystemTime(new Date('2026-10-03T10:00:00+07:00'));
    useAppStore.getState().checkDailyReset();
    useAppStore.getState().gainXP(20, { source: 'flashcard' });

    expect(useAppStore.getState().profile.streak).toBe(3);
    expect(useAppStore.getState().profile.longestStreak).toBe(3);

    // Bỏ lỡ ngày 4 và 5: Đến ngày 6 mở app
    vi.setSystemTime(new Date('2026-10-06T10:00:00+07:00'));
    useAppStore.getState().checkDailyReset();

    // Streak bị reset về 0, nhưng longestStreak vẫn phải giữ kỷ lục 3
    expect(useAppStore.getState().profile.streak).toBe(0);
    expect(useAppStore.getState().profile.longestStreak).toBe(3);

    // Học bài trong ngày 6
    useAppStore.getState().gainXP(20, { source: 'flashcard' });
    expect(useAppStore.getState().profile.streak).toBe(1);
    expect(useAppStore.getState().profile.longestStreak).toBe(3);

    vi.useRealTimers();
  });

  // ==========================================================================
  // CASE 14: Duplicate Callback / Double-click Idempotency
  // ==========================================================================
  it('Case 14: Double-click cùng idempotencyKey -> Không double XP, không lặp lại ghi nhận', () => {
    const today = getVietnamDateString();
    useAppStore.getState().checkDailyReset();

    const idempotencyKey = 'unique_event_test_123';

    // Click lần 1
    useAppStore.getState().gainXP(50, {
      source: 'flashcard',
      idempotencyKey,
    });

    const state1 = useAppStore.getState();
    expect(state1.profile.xp).toBe(50);
    expect(state1.dailyHistory[today].xpGained).toBe(50);

    // Click lần 2 (nhanh, trùng key)
    useAppStore.getState().gainXP(50, {
      source: 'flashcard',
      idempotencyKey,
    });

    const state2 = useAppStore.getState();
    expect(state2.profile.xp).toBe(50); // Không bị tăng lên 100
    expect(state2.dailyHistory[today].xpGained).toBe(50); // Không bị cộng dồn lên 100
  });

  // ==========================================================================
  // CASE 15: Browser Timezone Difference with Frozen Clock
  // Browser ở múi giờ New York (UTC-4) nhưng mốc học tập chuẩn theo Việt Nam (UTC+7)
  // ==========================================================================
  it('Case 15: Browser timezone difference -> Learning date luôn khớp chuẩn Vietnam GMT+7', () => {
    vi.useFakeTimers();
    // Giả lập thời điểm 2026-10-09 lúc 02:00:00 sáng tại Hà Nội (UTC = 2026-10-08T19:00:00Z)
    vi.setSystemTime(new Date('2026-10-08T19:00:00.000Z'));

    const vnDate = getVietnamDateString();
    expect(vnDate).toBe('2026-10-09');

    useAppStore.getState().checkDailyReset();
    useAppStore.getState().gainXP(20, { source: 'flashcard' });

    const { profile, dailyHistory } = useAppStore.getState();
    expect(profile.streak).toBe(1);
    expect(profile.lastStudyDate).toBe('2026-10-09');
    expect(dailyHistory['2026-10-09']).toBeDefined();
    expect(dailyHistory['2026-10-09'].xpGained).toBe(20);

    vi.useRealTimers();
  });
});
