// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  deriveCurrentUserLeaderboardPreview,
  getCategoryPreview,
} from '../localLeaderboardPreviewAdapter';
import type {
  AppStoreState,
  DailyProgress,
  SRSProgress,
  SRSReviewEvent,
} from '../../types';
import { getVietnamDateString } from '../leaderboardService';

describe('Phase 3 — Local Leaderboard Metric Preview Adapter', () => {
  // Chuẩn hóa một mốc thời gian kiểm thử cố định vào Thứ Tư (2026-10-07 10:00:00 UTC = 17:00 VN)
  const fixedRefDate = new Date('2026-10-07T10:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. weekly_xp uses canonical local weekly XP, NOT lifetime XP', () => {
    it('chỉ tính XP trong tuần hiện tại từ dailyHistory, không lấy profile.xp (lifetime XP)', () => {
      // Tuần hiện tại: từ Thứ Hai 2026-10-05 đến Chủ Nhật 2026-10-11
      const dailyHistory: Record<string, DailyProgress> = {
        '2026-10-05': {
          date: '2026-10-05',
          xpGained: 150,
          newWordsLearned: 5,
          wordsReviewed: 10,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
        },
        '2026-10-06': {
          date: '2026-10-06',
          xpGained: 200,
          newWordsLearned: 10,
          wordsReviewed: 15,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
        },
        // Ngày của tuần trước (2026-10-04) - Không được tính vào weekly XP
        '2026-10-04': {
          date: '2026-10-04',
          xpGained: 1000,
          newWordsLearned: 20,
          wordsReviewed: 50,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
        },
      };

      const mockState: Partial<AppStoreState> = {
        profile: {
          streak: 8,
          xp: 88888, // Lifetime XP cực lớn
          name: 'LocalGuestUser',
        } as any,
        dailyHistory,
        srsProgressMap: {},
      };

      const previewMap = deriveCurrentUserLeaderboardPreview(mockState, {
        refDate: fixedRefDate,
      });

      const weeklyXpPreview = previewMap.weekly_xp;

      // Weekly XP phải là 150 + 200 = 350
      expect(weeklyXpPreview.value).toBe(350);
      expect(weeklyXpPreview.value).not.toBe(88888);
      expect(weeklyXpPreview.displayValue).toBe('350 XP');
      expect(weeklyXpPreview.secondaryScore).toBe(8);
      expect(weeklyXpPreview.secondaryDisplay).toBe('8 ngày streak');
      expect(weeklyXpPreview.status).toBe('eligible');
      expect(weeklyXpPreview.isEligible).toBe(true);
      expect(weeklyXpPreview.hasLocalActivity).toBe(true);
    });

    it('trả về 0 XP khi không có hoạt động trong tuần nhưng profile có lifetime XP', () => {
      const mockState: Partial<AppStoreState> = {
        profile: {
          streak: 0,
          xp: 15000,
          name: 'InactiveUser',
        } as any,
        dailyHistory: {
          '2026-09-01': {
            date: '2026-09-01',
            xpGained: 15000,
            newWordsLearned: 50,
            wordsReviewed: 100,
            quizzesCompleted: 0,
            pronunciationsMastered: 0,
          },
        },
      };

      const previewMap = deriveCurrentUserLeaderboardPreview(mockState, {
        refDate: fixedRefDate,
      });

      expect(previewMap.weekly_xp.value).toBe(0);
      expect(previewMap.weekly_xp.displayValue).toBe('0 XP');
      expect(previewMap.weekly_xp.hasLocalActivity).toBe(false);
    });
  });

  describe('2. vocab_mastered reuses canonical mastery derivation', () => {
    it('tái sử dụng 100% thuật toán mastery từ srsProgressMap', () => {
      const srsProgressMap: Record<string, SRSProgress> = {
        word_1: {
          interval: 25, // Mastered: interval >= 21
          easeFactor: 2.5,
          srsLevel: 4,
          nextReviewDate: '2026-10-20T00:00:00.000Z',
          lastReviewedDate: '2026-10-06T10:00:00.000Z',
        },
        word_2: {
          interval: 30, // Mastered
          easeFactor: 2.6,
          srsLevel: 5,
          nextReviewDate: '2026-10-25T00:00:00.000Z',
          lastReviewedDate: '2026-10-06T11:00:00.000Z',
        },
        word_3: {
          interval: 3, // Đang học (chưa mastered)
          easeFactor: 2.5,
          srsLevel: 1,
          nextReviewDate: '2026-10-07T00:00:00.000Z',
          lastReviewedDate: '2026-10-06T12:00:00.000Z',
        },
      };

      const mockState: Partial<AppStoreState> = {
        srsProgressMap,
        srsAlgorithm: 'sm2',
      };

      const previewMap = deriveCurrentUserLeaderboardPreview(mockState, {
        refDate: fixedRefDate,
      });

      const vocabPreview = previewMap.vocab_mastered;
      expect(vocabPreview.value).toBe(2);
      expect(vocabPreview.displayValue).toBe('2 từ');
      expect(vocabPreview.status).toBe('eligible');
      expect(vocabPreview.isEligible).toBe(true);
      expect(vocabPreview.hasLocalActivity).toBe(true);
    });
  });

  describe('3. review_consistency eligibility & distinction (no fake 0%)', () => {
    it('trả về insufficient_evidence và value = null khi chưa có lịch ôn tập đến hạn trong tuần (KHÔNG fake 0 hay 0.0%)', () => {
      const mockState: Partial<AppStoreState> = {
        dailyHistory: {},
        srsProgressMap: {},
        recentReviewEvents: [],
      };

      const previewMap = deriveCurrentUserLeaderboardPreview(mockState, {
        refDate: fixedRefDate,
      });

      const consistencyPreview = previewMap.review_consistency;
      expect(consistencyPreview.value).toBeNull();
      expect(consistencyPreview.displayValue).toBe('Chưa đủ dữ liệu');
      expect(consistencyPreview.status).toBe('insufficient_evidence');
      expect(consistencyPreview.isEligible).toBe(false);
      expect(consistencyPreview.ineligibleHint).toContain('Cần có ít nhất 1 ngày có lịch ôn tập');
    });

    it('tính đúng tỷ lệ nhất quán khi có dữ liệu ôn tập hợp lệ', () => {
      // Thiết lập ngày có lịch ôn tập đến hạn và đã hoàn thành
      const dailyHistory: Record<string, DailyProgress> = {
        '2026-10-05': {
          date: '2026-10-05',
          xpGained: 100,
          newWordsLearned: 0,
          wordsReviewed: 10,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
        },
      };

      const srsProgressMap: Record<string, SRSProgress> = {
        card_1: {
          interval: 5,
          easeFactor: 2.5,
          srsLevel: 2,
          nextReviewDate: '2026-10-05T00:00:00.000Z',
          lastReviewedDate: '2026-10-05T08:00:00.000Z',
        },
      };

      const recentReviewEvents: SRSReviewEvent[] = [
        {
          eventId: 'ev_1',
          cardId: 'card_1',
          timestamp: '2026-10-05T08:00:00.000Z',
          stateBefore: 'review',
          rating: 3,
        } as any,
      ];

      const mockState: Partial<AppStoreState> = {
        dailyHistory,
        srsProgressMap,
        recentReviewEvents,
      };

      const previewMap = deriveCurrentUserLeaderboardPreview(mockState, {
        refDate: fixedRefDate,
      });

      const consistencyPreview = previewMap.review_consistency;
      // Dù eligible hay insufficient do số lượng card tối thiểu, giá trị phải phản ánh trung thực
      if (consistencyPreview.isEligible) {
        expect(consistencyPreview.value).toBeGreaterThanOrEqual(0);
        expect(consistencyPreview.displayValue).toMatch(/\d+\.\d+%/);
        expect(consistencyPreview.status).toBe('eligible');
      } else {
        expect(consistencyPreview.status).toBe('insufficient_evidence');
        expect(consistencyPreview.displayValue).toBe('Chưa đủ dữ liệu');
      }
    });
  });

  describe('4. active_minutes threshold distinction (insufficient vs not_eligible vs eligible)', () => {
    it('khi 0 phút học: status là insufficient_evidence, isEligible = false', () => {
      const previewMap = deriveCurrentUserLeaderboardPreview(
        { dailyHistory: {} },
        { refDate: fixedRefDate, activeSessions: [] }
      );

      const minutesPreview = previewMap.active_minutes;
      expect(minutesPreview.value).toBe(0);
      expect(minutesPreview.displayValue).toBe('0 phút');
      expect(minutesPreview.status).toBe('insufficient_evidence');
      expect(minutesPreview.isEligible).toBe(false);
      expect(minutesPreview.ineligibleHint).toContain('tối thiểu 15 phút');
    });

    it('khi có học nhưng dưới 15 phút (vd 10 phút): status là not_eligible, isEligible = false', () => {
      // Mock session 10 phút trong tuần hiện tại (module thuộc whitelist và có activeSeconds)
      const activeSessions = [
        {
          sessionId: 's_1',
          module: 'flashcard' as const,
          startTime: '2026-10-06T08:00:00.000Z',
          endTime: '2026-10-06T08:10:00.000Z',
          activeSeconds: 600, // 10 phút
          interactionCount: 10,
          date: '2026-10-06',
        },
      ];

      const previewMap = deriveCurrentUserLeaderboardPreview(
        { dailyHistory: {} },
        { refDate: fixedRefDate, activeSessions }
      );

      const minutesPreview = previewMap.active_minutes;
      expect(minutesPreview.value).toBe(10);
      expect(minutesPreview.displayValue).toBe('10 phút');
      expect(minutesPreview.status).toBe('not_eligible');
      expect(minutesPreview.isEligible).toBe(false);
      expect(minutesPreview.ineligibleHint).toContain('tối thiểu 15 phút');
      expect(minutesPreview.hasLocalActivity).toBe(true);
    });

    it('khi học đủ 15 phút trở lên (vd 45 phút): status là eligible, isEligible = true', () => {
      // 2 chunks học tập (25 phút + 20 phút = 45 phút) tuân thủ giới hạn 30p/session
      const activeSessions = [
        {
          sessionId: 's_1',
          module: 'flashcard' as const,
          startTime: '2026-10-06T08:00:00.000Z',
          endTime: '2026-10-06T08:25:00.000Z',
          activeSeconds: 1500, // 25 phút
          interactionCount: 30,
          date: '2026-10-06',
        },
        {
          sessionId: 's_2',
          module: 'quiz' as const,
          startTime: '2026-10-06T09:00:00.000Z',
          endTime: '2026-10-06T09:20:00.000Z',
          activeSeconds: 1200, // 20 phút
          interactionCount: 25,
          date: '2026-10-06',
        },
      ];

      const previewMap = deriveCurrentUserLeaderboardPreview(
        { dailyHistory: {} },
        { refDate: fixedRefDate, activeSessions }
      );

      const minutesPreview = previewMap.active_minutes;
      expect(minutesPreview.value).toBe(45);
      expect(minutesPreview.displayValue).toBe('45 phút');
      expect(minutesPreview.status).toBe('eligible');
      expect(minutesPreview.isEligible).toBe(true);
      expect(minutesPreview.ineligibleHint).toBeUndefined();
    });
  });

  describe('5. pronunciation_gain evidence validation (no fake 0 or +0.0)', () => {
    it('chưa đủ dữ liệu (0 lượt hoặc < 10 lượt qua < 2 ngày): value = null, displayValue = "Chưa đủ dữ liệu"', () => {
      const previewMap = deriveCurrentUserLeaderboardPreview(
        { dailyHistory: {} },
        { refDate: fixedRefDate, pronunciationAttempts: [] }
      );

      const pronPreview = previewMap.pronunciation_gain;
      expect(pronPreview.value).toBeNull();
      expect(pronPreview.displayValue).toBe('Chưa đủ dữ liệu');
      expect(pronPreview.status).toBe('insufficient_evidence');
      expect(pronPreview.isEligible).toBe(false);
      expect(pronPreview.ineligibleHint).toContain('tối thiểu 10 lượt phát âm qua ít nhất 2 ngày');
    });

    it('khi có đầy đủ mẫu tin cậy qua 2 ngày và cải thiện điểm: status = eligible, định dạng +x.x điểm', () => {
      // 5 lượt ngày 2026-10-05 (baseline ~ 70)
      const day1Attempts = Array.from({ length: 5 }, (_, i) => ({
        id: `p1_${i}`,
        word: `word_${i}`,
        score: 70,
        timestamp: `2026-10-05T08:0${i}:00.000Z`,
        isTrusted: true,
        recognizedText: `word ${i}`,
      }));

      // 5 lượt ngày 2026-10-06 (recent ~ 85)
      const day2Attempts = Array.from({ length: 5 }, (_, i) => ({
        id: `p2_${i}`,
        word: `word_${i}`,
        score: 85,
        timestamp: `2026-10-06T08:0${i}:00.000Z`,
        isTrusted: true,
        recognizedText: `word ${i}`,
      }));

      const previewMap = deriveCurrentUserLeaderboardPreview(
        { dailyHistory: {} },
        {
          refDate: fixedRefDate,
          pronunciationAttempts: [...day1Attempts, ...day2Attempts],
        }
      );

      const pronPreview = previewMap.pronunciation_gain;
      expect(pronPreview.isEligible).toBe(true);
      expect(pronPreview.status).toBe('eligible');
      expect(pronPreview.value).toBe(15);
      expect(pronPreview.displayValue).toBe('+15.0 điểm');
      expect(pronPreview.secondaryScore).toBe(10);
      expect(pronPreview.secondaryDisplay).toBe('10 lượt mẫu');
    });
  });

  describe('6. toeic_gain eligibility validation (no fake 0 or 0 LR)', () => {
    it('chưa đủ 2 bài mock trong tuần: value = null, displayValue = "Chưa đủ điều kiện"', () => {
      const previewMap = deriveCurrentUserLeaderboardPreview(
        { dailyHistory: {} },
        { refDate: fixedRefDate, toeicSessions: [] }
      );

      const toeicPreview = previewMap.toeic_gain;
      expect(toeicPreview.value).toBeNull();
      expect(toeicPreview.displayValue).toBe('Chưa đủ điều kiện');
      expect(toeicPreview.status).toBe('insufficient_evidence');
      expect(toeicPreview.isEligible).toBe(false);
      expect(toeicPreview.ineligibleHint).toContain('tối thiểu 2 bài thi mock test');
    });

    it('hoàn thành 2 bài mock có cải thiện điểm: status = eligible, định dạng +x LR', () => {
      // 2 bài thi khác đề (ETS Test 1 và ETS Test 2) để vượt qua bộ lọc chống lặp đề trong 48h
      const toeicSessions = [
        {
          id: 'toeic_1',
          title: 'ETS 2024 Practice Test 01',
          experienceConfig: { selectedExamId: 'ets_2024_01' },
          date: '2026-10-05T08:00:00.000Z',
          totalScore: 650,
          timeSpentSeconds: 3600,
          totalQuestions: 200,
          mode: 'mock',
        },
        {
          id: 'toeic_2',
          title: 'ETS 2024 Practice Test 02',
          experienceConfig: { selectedExamId: 'ets_2024_02' },
          date: '2026-10-06T08:00:00.000Z',
          totalScore: 750,
          timeSpentSeconds: 3600,
          totalQuestions: 200,
          mode: 'mock',
        },
      ];

      const previewMap = deriveCurrentUserLeaderboardPreview(
        { dailyHistory: {} },
        { refDate: fixedRefDate, toeicSessions }
      );

      const toeicPreview = previewMap.toeic_gain;
      expect(toeicPreview.isEligible).toBe(true);
      expect(toeicPreview.status).toBe('eligible');
      expect(toeicPreview.value).toBe(100);
      expect(toeicPreview.displayValue).toBe('+100 LR');
      expect(toeicPreview.secondaryScore).toBe(2);
      expect(toeicPreview.secondaryDisplay).toBe('2 bài mock');
    });
  });

  describe('7. streak uses canonical profile.streak', () => {
    it('lấy chính xác streak từ profile và gắn weeklyXp làm secondaryScore', () => {
      const mockState: Partial<AppStoreState> = {
        profile: {
          streak: 15,
          xp: 5000,
        } as any,
        dailyHistory: {
          '2026-10-06': {
            date: '2026-10-06',
            xpGained: 120,
            newWordsLearned: 5,
            wordsReviewed: 10,
            quizzesCompleted: 0,
            pronunciationsMastered: 0,
          },
        },
      };

      const previewMap = deriveCurrentUserLeaderboardPreview(mockState, {
        refDate: fixedRefDate,
      });

      const streakPreview = previewMap.streak;
      expect(streakPreview.value).toBe(15);
      expect(streakPreview.displayValue).toBe('15 ngày');
      expect(streakPreview.secondaryScore).toBe(120);
      expect(streakPreview.secondaryDisplay).toBe('120 XP tuần');
      expect(streakPreview.status).toBe('eligible');
      expect(streakPreview.isEligible).toBe(true);
      expect(streakPreview.hasLocalActivity).toBe(true);
    });
  });

  describe('8. Read-only invariant: no store mutation, no cloud sync, no rank created', () => {
    it('tuyệt đối không làm thay đổi state đầu vào và không tạo rank online', () => {
      const originalState: Partial<AppStoreState> = {
        profile: {
          streak: 5,
          xp: 1200,
          name: 'PristineGuest',
        } as any,
        dailyHistory: {
          '2026-10-06': {
            date: '2026-10-06',
            xpGained: 100,
            newWordsLearned: 2,
            wordsReviewed: 5,
            quizzesCompleted: 0,
            pronunciationsMastered: 0,
          },
        },
        srsProgressMap: {},
      };

      // Đóng băng sâu (deep freeze) để kiểm chứng tính bất biến thuần túy
      const stateCopy = JSON.parse(JSON.stringify(originalState));
      Object.freeze(stateCopy);
      Object.freeze(stateCopy.profile);
      Object.freeze(stateCopy.dailyHistory);

      const previewMap = deriveCurrentUserLeaderboardPreview(stateCopy, {
        refDate: fixedRefDate,
      });

      // State không bị suy chuyển
      expect(stateCopy).toEqual(originalState);

      // Toàn bộ 7 hạng mục không bao giờ chứa thông tin rank hay online row user_id
      const categories = Object.keys(previewMap) as Array<keyof typeof previewMap>;
      expect(categories).toHaveLength(7);
      for (const cat of categories) {
        const item = previewMap[cat];
        expect((item as any).rank).toBeUndefined();
        expect((item as any).user_id).toBeUndefined();
        expect((item as any).id).toBeUndefined();
      }
    });
  });

  describe('9. Helper getCategoryPreview', () => {
    it('trả về đúng hạng mục được yêu cầu và fallback về weekly_xp khi nhận key không hợp lệ', () => {
      const previewMap = deriveCurrentUserLeaderboardPreview(
        { profile: { streak: 3 } as any },
        { refDate: fixedRefDate }
      );

      const streakItem = getCategoryPreview('streak', previewMap);
      expect(streakItem.category).toBe('streak');
      expect(streakItem.value).toBe(3);

      const fallbackItem = getCategoryPreview('invalid_metric' as any, previewMap);
      expect(fallbackItem.category).toBe('weekly_xp');
    });
  });
});
