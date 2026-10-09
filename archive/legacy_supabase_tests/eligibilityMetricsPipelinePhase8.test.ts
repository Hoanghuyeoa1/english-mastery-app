// @vitest-environment happy-dom
// src/services/__tests__/eligibilityMetricsPipelinePhase8.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  derivePronunciationImprovement,
  deriveToeicGain,
  deriveLeaderboardLearningMetrics,
  syncDerivedLearningMetrics,
  savePronunciationAttempt,
  loadPronunciationAttempts,
  clearPronunciationAttemptsForTesting,
  MIN_PRONUNCIATION_TOTAL_SAMPLES,
  MIN_PRONUNCIATION_WINDOW_SAMPLES,
  MIN_PRONUNCIATION_DISTINCT_DAYS,
  MIN_TOEIC_ATTEMPT_DURATION_SECONDS,
  TOEIC_REPEATED_TEST_COOLDOWN_HOURS,
  PronunciationEvidenceItem,
} from '../leaderboardLearningMetrics';
import {
  saveToeicAttempt,
  loadToeicHistory,
  clearToeicHistory,
} from '../toeicPersistenceService';
import {
  getVietnamWeekStart,
  getVietnamWeekEnd,
  getAuthoritativeVietnamWeekId,
  syncWeeklyLearningMetricsToServer,
} from '../leaderboardService';
import {
  formatMetricScore,
  formatSecondaryScore,
} from '../../components/LeaderboardView';
import { useCloudSyncStore } from '../cloudSyncService';
import { supabase } from '../../lib/supabaseClient';

describe('PHASE 8 — Fix Eligibility-Based Metrics: Pronunciation Gain & TOEIC Gain', () => {
  const MOCK_USER_ID = 'user-phase8-eligibility';
  const refDate = new Date('2026-10-07T10:00:00.000Z'); // Wednesday in Vietnam
  const weekStart = getVietnamWeekStart(refDate);
  const weekEnd = getVietnamWeekEnd(refDate);

  beforeEach(() => {
    vi.restoreAllMocks();
    clearPronunciationAttemptsForTesting();
    clearToeicHistory();
    localStorage.clear();

    useCloudSyncStore.setState({
      isOnline: true,
      user: { id: MOCK_USER_ID, email: 'learner@example.com' } as any,
    });
  });

  afterEach(() => {
    clearPronunciationAttemptsForTesting();
    clearToeicHistory();
    localStorage.clear();
  });

  // ==========================================================================
  // SECTION A: PRONUNCIATION GAIN PIPELINE
  // ==========================================================================
  describe('A. PRONUNCIATION_GAIN — Canonical Derivation & Evidence Audit', () => {
    it('Trường hợp chưa đủ 10 mẫu: isEligible: false, gainScore: null (không bao giờ fake thành 0%)', () => {
      // Chỉ có 6 mẫu qua 2 ngày
      const day1 = new Date(weekStart.getTime() + 10 * 3600 * 1000).toISOString();
      const day2 = new Date(weekStart.getTime() + 34 * 3600 * 1000).toISOString();

      const attempts: PronunciationEvidenceItem[] = [
        { id: 'p1', word: 'apple', score: 70, timestamp: day1, isTrusted: true, recognizedText: 'apple' },
        { id: 'p2', word: 'book', score: 75, timestamp: day1, isTrusted: true, recognizedText: 'book' },
        { id: 'p3', word: 'cat', score: 80, timestamp: day1, isTrusted: true, recognizedText: 'cat' },
        { id: 'p4', word: 'dog', score: 85, timestamp: day2, isTrusted: true, recognizedText: 'dog' },
        { id: 'p5', word: 'egg', score: 90, timestamp: day2, isTrusted: true, recognizedText: 'egg' },
        { id: 'p6', word: 'fish', score: 95, timestamp: day2, isTrusted: true, recognizedText: 'fish' },
      ];

      const result = derivePronunciationImprovement({
        attempts,
        weekStart,
        weekEnd,
      });

      expect(result.validSampleCount).toBe(6);
      expect(result.distinctDays).toBe(2);
      expect(result.isEligible).toBe(false);
      expect(result.gainScore).toBeNull();
      expect(result.baselineAvg).toBeNull();
      expect(result.recentAvg).toBeNull();
    });

    it('Trường hợp đủ 10 mẫu nhưng chỉ trong 1 ngày duy nhất: isEligible: false, gainScore: null', () => {
      const sameDay = new Date(weekStart.getTime() + 12 * 3600 * 1000).toISOString();
      const attempts: PronunciationEvidenceItem[] = Array.from({ length: 12 }, (_, i) => ({
        id: `p_${i}`,
        word: `word_${i}`,
        score: 70 + i,
        timestamp: sameDay,
        isTrusted: true,
        recognizedText: `word_${i}`,
      }));

      const result = derivePronunciationImprovement({
        attempts,
        weekStart,
        weekEnd,
      });

      expect(result.validSampleCount).toBe(12);
      expect(result.distinctDays).toBe(1); // Chỉ 1 ngày
      expect(result.isEligible).toBe(false);
      expect(result.gainScore).toBeNull();
    });

    it('Loại bỏ hoàn toàn speech giả mạo / fallback / untrusted / mic denied / transcript rỗng', () => {
      const day1 = new Date(weekStart.getTime() + 10 * 3600 * 1000).toISOString();
      const day2 = new Date(weekStart.getTime() + 34 * 3600 * 1000).toISOString();

      const taintedAttempts: PronunciationEvidenceItem[] = [
        // 4 mẫu hợp lệ
        { id: 'ok_1', word: 'sun', score: 70, timestamp: day1, isTrusted: true, recognizedText: 'sun' },
        { id: 'ok_2', word: 'moon', score: 75, timestamp: day1, isTrusted: true, recognizedText: 'moon' },
        { id: 'ok_3', word: 'star', score: 80, timestamp: day2, isTrusted: true, recognizedText: 'star' },
        { id: 'ok_4', word: 'sky', score: 85, timestamp: day2, isTrusted: true, recognizedText: 'sky' },
        // Các mẫu bị loại:
        { id: 'bad_untrusted', word: 'fake', score: 99, timestamp: day1, isTrusted: false, recognizedText: 'fake' },
        { id: 'bad_fallback', word: 'fail', score: 85, timestamp: day1, isFallback: true, recognizedText: 'fail' },
        { id: 'bad_empty', word: 'empty', score: 90, timestamp: day2, isTrusted: true, recognizedText: '' },
        { id: 'bad_whitespace', word: 'space', score: 90, timestamp: day2, isTrusted: true, recognizedText: '   ' },
        { id: 'bad_nan', word: 'nan', score: NaN, timestamp: day2, isTrusted: true, recognizedText: 'nan' },
        { id: 'bad_over100', word: 'over', score: 150, timestamp: day2, isTrusted: true, recognizedText: 'over' },
      ];

      const result = derivePronunciationImprovement({
        attempts: taintedAttempts,
        weekStart,
        weekEnd,
      });

      // Chỉ 4 mẫu vượt qua bộ lọc khắt khe
      expect(result.validSampleCount).toBe(4);
      expect(result.isEligible).toBe(false);
      expect(result.gainScore).toBeNull();
    });

    it('Trường hợp đủ điều kiện (>= 10 mẫu, >= 2 ngày, >= 4 baseline, >= 4 recent): tính đúng gainScore', () => {
      const day1 = new Date(weekStart.getTime() + 10 * 3600 * 1000).toISOString();
      const day2 = new Date(weekStart.getTime() + 34 * 3600 * 1000).toISOString();

      // 5 mẫu ngày 1: đều 70 điểm (baseline avg = 70.0)
      const baselineItems: PronunciationEvidenceItem[] = Array.from({ length: 5 }, (_, i) => ({
        id: `base_${i}`,
        word: `base_${i}`,
        score: 70,
        timestamp: new Date(Date.parse(day1) + i * 1000).toISOString(),
        isTrusted: true,
        recognizedText: `base_${i}`,
      }));

      // 5 mẫu ngày 2: đều 85 điểm (recent avg = 85.0)
      const recentItems: PronunciationEvidenceItem[] = Array.from({ length: 5 }, (_, i) => ({
        id: `recent_${i}`,
        word: `recent_${i}`,
        score: 85,
        timestamp: new Date(Date.parse(day2) + i * 1000).toISOString(),
        isTrusted: true,
        recognizedText: `recent_${i}`,
      }));

      const result = derivePronunciationImprovement({
        attempts: [...baselineItems, ...recentItems],
        weekStart,
        weekEnd,
      });

      expect(result.isEligible).toBe(true);
      expect(result.validSampleCount).toBe(10);
      expect(result.distinctDays).toBe(2);
      expect(result.baselineAvg).toBe(70.0);
      expect(result.recentAvg).toBe(85.0);
      expect(result.gainScore).toBe(15.0); // +15.0 điểm
    });

    it('Bảo toàn Zero Gain: học viên đủ điều kiện nhưng tiến bộ = 0 (80.0 -> 80.0) phải trả về score = 0, KHÔNG PHẢI NULL', () => {
      const day1 = new Date(weekStart.getTime() + 10 * 3600 * 1000).toISOString();
      const day2 = new Date(weekStart.getTime() + 34 * 3600 * 1000).toISOString();

      const items: PronunciationEvidenceItem[] = Array.from({ length: 10 }, (_, i) => ({
        id: `sample_${i}`,
        word: `word_${i}`,
        score: 80, // Điểm số không đổi giữa baseline và recent
        timestamp: i < 5 ? day1 : day2,
        isTrusted: true,
        recognizedText: `word_${i}`,
      }));

      const result = derivePronunciationImprovement({
        attempts: items,
        weekStart,
        weekEnd,
      });

      expect(result.isEligible).toBe(true);
      expect(result.gainScore).toBe(0); // Tuyệt đối là số 0, không phải null
      expect(result.gainScore).not.toBeNull();
    });

    it('Tiến bộ âm: Baseline 85.0 -> Recent 75.0 tính ra gainScore = -10.0 hợp lệ', () => {
      const day1 = new Date(weekStart.getTime() + 10 * 3600 * 1000).toISOString();
      const day2 = new Date(weekStart.getTime() + 34 * 3600 * 1000).toISOString();

      const items: PronunciationEvidenceItem[] = [
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `base_${i}`,
          word: `w_${i}`,
          score: 85,
          timestamp: day1,
          isTrusted: true,
          recognizedText: `w_${i}`,
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `rec_${i}`,
          word: `w2_${i}`,
          score: 75,
          timestamp: day2,
          isTrusted: true,
          recognizedText: `w2_${i}`,
        })),
      ];

      const result = derivePronunciationImprovement({
        attempts: items,
        weekStart,
        weekEnd,
      });

      expect(result.isEligible).toBe(true);
      expect(result.gainScore).toBe(-10.0);
    });

    it('Ranh giới tuần: bài luyện từ tuần trước không bị tính dính vào tuần này', () => {
      const lastWeekDate = new Date(weekStart.getTime() - 48 * 3600 * 1000).toISOString();
      const thisWeekDate = new Date(weekStart.getTime() + 12 * 3600 * 1000).toISOString();

      const items: PronunciationEvidenceItem[] = [
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `old_${i}`,
          word: `old_${i}`,
          score: 70,
          timestamp: lastWeekDate, // Tuần trước
          isTrusted: true,
          recognizedText: `old_${i}`,
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `new_${i}`,
          word: `new_${i}`,
          score: 90,
          timestamp: thisWeekDate, // Tuần này
          isTrusted: true,
          recognizedText: `new_${i}`,
        })),
      ];

      const result = derivePronunciationImprovement({
        attempts: items,
        weekStart,
        weekEnd,
      });

      // Tuần này chỉ có 4 mẫu
      expect(result.validSampleCount).toBe(4);
      expect(result.isEligible).toBe(false);
      expect(result.gainScore).toBeNull();
    });
  });

  // ==========================================================================
  // SECTION B: TOEIC GAIN PIPELINE
  // ==========================================================================
  describe('B. TOEIC_GAIN — Valid Mock Assessment & Category Isolation', () => {
    it('Chỉ có 1 bài thi: isEligible: false, toeicGain: null (yêu cầu tối thiểu 2 bài để so sánh)', () => {
      const sessions = [
        {
          id: 'exam_1',
          title: 'ETS 2024 Test 1',
          date: new Date(weekStart.getTime() + 10 * 3600 * 1000).toISOString(),
          totalScore: 650,
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
      ];

      const result = deriveToeicGain({
        sessions,
        weekStart,
        weekEnd,
      });

      expect(result.totalValidAttempts).toBe(1);
      expect(result.isEligible).toBe(false);
      expect(result.lrGain).toBeNull();
      expect(result.swGain).toBeNull();
    });

    it('Loại bỏ bài thi quá ngắn (< 60 giây / instant abandon) hoặc bài thi Practice', () => {
      const day1 = new Date(weekStart.getTime() + 10 * 3600 * 1000).toISOString();
      const day2 = new Date(weekStart.getTime() + 34 * 3600 * 1000).toISOString();

      const sessions = [
        // Bài thi hợp lệ 1
        {
          id: 'exam_valid',
          title: 'ETS 2024 Test 1',
          date: day1,
          totalScore: 700,
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
        // Bài thi quá ngắn (< 60s)
        {
          id: 'exam_short',
          title: 'ETS 2024 Test 2',
          date: day2,
          totalScore: 800,
          timeSpentSeconds: 45, // < 60s
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
        // Bài thi chế độ practice
        {
          id: 'exam_practice',
          title: 'Practice Mode Test',
          date: day2,
          totalScore: 850,
          timeSpentSeconds: 1800,
          experienceMode: 'practice',
          skillScope: '2-skills',
          totalQuestions: 50,
        },
      ];

      const result = deriveToeicGain({
        sessions,
        weekStart,
        weekEnd,
      });

      // Chỉ 1 bài hợp lệ
      expect(result.totalValidAttempts).toBe(1);
      expect(result.isEligible).toBe(false);
      expect(result.lrGain).toBeNull();
    });

    it('Anti-abuse Repeated-Test Cooldown (48 giờ): Cùng một bài thi lặp lại trong 48h bị loại khỏi Gain', () => {
      const examDate1 = new Date(weekStart.getTime() + 10 * 3600 * 1000);
      const examDate2Spam = new Date(examDate1.getTime() + 12 * 3600 * 1000); // 12h sau (trong 48h)
      const examDate3Valid = new Date(examDate1.getTime() + 50 * 3600 * 1000); // 50h sau (> 48h)

      const sessions = [
        {
          id: 'ets_1_first',
          title: 'ETS 2024 Test 1',
          date: examDate1.toISOString(),
          totalScore: 600,
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
        {
          id: 'ets_1_spam',
          title: 'ETS 2024 Test 1',
          date: examDate2Spam.toISOString(),
          totalScore: 850, // Cày điểm bài cũ trong 12h
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
        {
          id: 'ets_1_legit_later',
          title: 'ETS 2024 Test 1',
          date: examDate3Valid.toISOString(),
          totalScore: 720,
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
      ];

      const result = deriveToeicGain({
        sessions,
        weekStart,
        weekEnd,
      });

      // Bài spam bị loại, còn bài 1 (600) và bài 3 (720)
      expect(result.totalValidAttempts).toBe(2);
      expect(result.isEligible).toBe(true);
      expect(result.lrGain).toBe(120); // 720 - 600 = +120
    });

    it('Hai bài thi KHÁC NHAU trong cùng ngày đều được chấp nhận', () => {
      const examDate1 = new Date(weekStart.getTime() + 10 * 3600 * 1000);
      const examDate2 = new Date(examDate1.getTime() + 4 * 3600 * 1000); // 4h sau, nhưng là đề Test 2

      const sessions = [
        {
          id: 'test_1',
          title: 'ETS 2024 Test 1',
          date: examDate1.toISOString(),
          totalScore: 650,
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
        {
          id: 'test_2',
          title: 'ETS 2024 Test 2', // Đề khác hoàn toàn
          date: examDate2.toISOString(),
          totalScore: 750,
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
      ];

      const result = deriveToeicGain({
        sessions,
        weekStart,
        weekEnd,
      });

      expect(result.totalValidAttempts).toBe(2);
      expect(result.isEligible).toBe(true);
      expect(result.lrGain).toBe(100); // 750 - 650 = +100
    });

    it('Bảo toàn Zero Gain: thi 2 lần cùng điểm 720 -> toeicGain = 0 (KHÔNG PHẢI NULL)', () => {
      const sessions = [
        {
          id: 'exam_a',
          title: 'ETS 2024 Test 1',
          date: new Date(weekStart.getTime() + 10 * 3600 * 1000).toISOString(),
          totalScore: 720,
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
        {
          id: 'exam_b',
          title: 'ETS 2024 Test 2',
          date: new Date(weekStart.getTime() + 30 * 3600 * 1000).toISOString(),
          totalScore: 720,
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
      ];

      const result = deriveToeicGain({
        sessions,
        weekStart,
        weekEnd,
      });

      expect(result.isEligible).toBe(true);
      expect(result.lrGain).toBe(0); // Số 0 chuẩn xác
      expect(result.lrGain).not.toBeNull();
    });

    it('Tiến bộ âm: 800 -> 720 tính ra lrGain = -80 hợp lệ', () => {
      const sessions = [
        {
          id: 'exam_a',
          title: 'ETS 2024 Test 1',
          date: new Date(weekStart.getTime() + 10 * 3600 * 1000).toISOString(),
          totalScore: 800,
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
        {
          id: 'exam_b',
          title: 'ETS 2024 Test 2',
          date: new Date(weekStart.getTime() + 30 * 3600 * 1000).toISOString(),
          totalScore: 720,
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
      ];

      const result = deriveToeicGain({
        sessions,
        weekStart,
        weekEnd,
      });

      expect(result.isEligible).toBe(true);
      expect(result.lrGain).toBe(-80);
    });

    it('Cách ly tuyệt đối giữa LR (thang 990) và SW (thang 400), không trộn lẫn hay cộng dồn', () => {
      const sessions = [
        // 2 bài thi LR điểm thấp (350 điểm <= 400)
        {
          id: 'lr_1',
          title: 'LR Mini 1',
          date: new Date(weekStart.getTime() + 10 * 3600 * 1000).toISOString(),
          totalScore: 300,
          timeSpentSeconds: 1800,
          experienceMode: 'mock',
          skillScope: '2-skills',
          listeningScore: 160,
          readingScore: 140,
          totalQuestions: 60,
        },
        {
          id: 'lr_2',
          title: 'LR Mini 2',
          date: new Date(weekStart.getTime() + 30 * 3600 * 1000).toISOString(),
          totalScore: 350,
          timeSpentSeconds: 1800,
          experienceMode: 'mock',
          skillScope: '2-skills',
          listeningScore: 180,
          readingScore: 170,
          totalQuestions: 60,
        },
        // 1 bài thi SW (Speaking & Writing)
        {
          id: 'sw_1',
          title: 'SW Test 1',
          date: new Date(weekStart.getTime() + 40 * 3600 * 1000).toISOString(),
          totalScore: 240,
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '4-skills',
          speakingScore: 120,
          writingScore: 120,
          totalQuestions: 19,
        },
      ];

      const result = deriveToeicGain({
        sessions,
        weekStart,
        weekEnd,
      });

      // LR có 2 bài -> lrGain = 350 - 300 = +50
      expect(result.lrGain).toBe(50);
      // SW chỉ có 1 bài -> swGain = null (không bị gộp 2 bài LR vào)
      expect(result.swGain).toBeNull();
      expect(result.isEligible).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION C: SHARED DERIVATION & CLOUD INGESTION
  // ==========================================================================
  describe('C. Shared Derivation & Cloud Ingestion Contract', () => {
    it('deriveLeaderboardLearningMetrics bảo lưu chính xác giá trị null khi chưa đủ điều kiện', () => {
      const derived = deriveLeaderboardLearningMetrics(
        {},
        {
          refDate,
          pronunciationAttempts: [], // Không có mẫu nào
          toeicSessions: [], // Không có bài thi nào
        }
      );

      expect(derived.pronunciationGain).toBeNull();
      expect(derived.toeicGain).toBeNull();
      expect(derived.eligibility.pronunciation).toBe(false);
      expect(derived.eligibility.toeic).toBe(false);
      expect(derived.evidence.pronunciation_samples).toBe(0);
      expect(derived.evidence.toeic_attempts).toBe(0);
    });

    it('deriveLeaderboardLearningMetrics bảo lưu chính xác điểm 0 khi đủ điều kiện nhưng gain = 0', () => {
      const day1 = new Date(weekStart.getTime() + 10 * 3600 * 1000).toISOString();
      const day2 = new Date(weekStart.getTime() + 34 * 3600 * 1000).toISOString();

      const pronAttempts: PronunciationEvidenceItem[] = Array.from({ length: 10 }, (_, i) => ({
        id: `p_${i}`,
        word: `w_${i}`,
        score: 80,
        timestamp: i < 5 ? day1 : day2,
        isTrusted: true,
        recognizedText: `w_${i}`,
      }));

      const toeicSessions = [
        {
          id: 't_1',
          title: 'Test 1',
          date: day1,
          totalScore: 700,
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
        {
          id: 't_2',
          title: 'Test 2',
          date: day2,
          totalScore: 700,
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
      ];

      const derived = deriveLeaderboardLearningMetrics(
        {},
        {
          refDate,
          pronunciationAttempts: pronAttempts,
          toeicSessions,
        }
      );

      // Cả 2 đều đủ điều kiện và đều có gain = 0
      expect(derived.pronunciationGain).toBe(0);
      expect(derived.toeicGain).toBe(0);
      expect(derived.eligibility.pronunciation).toBe(true);
      expect(derived.eligibility.toeic).toBe(true);
      expect(derived.evidence.pronunciation_samples).toBe(10);
      expect(derived.evidence.toeic_attempts).toBe(2);
    });

    it('syncDerivedLearningMetrics gửi đúng null và secondary evidence lên cloud RPC', async () => {
      const rpcSpy = vi.fn().mockResolvedValue({
        data: { success: true, server_now: new Date().toISOString() },
        error: null,
      });
      (supabase.rpc as any) = rpcSpy;

      await syncDerivedLearningMetrics(MOCK_USER_ID, {
        refDate,
        pronunciationAttempts: [], // Không đủ điều kiện
        toeicSessions: [], // Không đủ điều kiện
      });

      expect(rpcSpy).toHaveBeenCalled();
      const callArgs = rpcSpy.mock.calls[0][1];

      // p_pronunciation_gain và p_toeic_gain phải là null
      expect(callArgs.p_pronunciation_gain).toBeNull();
      expect(callArgs.p_toeic_gain).toBeNull();
      expect(callArgs.p_evidence.pronunciation_samples).toBe(0);
      expect(callArgs.p_evidence.toeic_attempts).toBe(0);
    });

    it('syncDerivedLearningMetrics gửi đúng điểm số và evidence khi học viên đủ điều kiện', async () => {
      const rpcSpy = vi.fn().mockResolvedValue({
        data: { success: true, server_now: new Date().toISOString() },
        error: null,
      });
      (supabase.rpc as any) = rpcSpy;

      const day1 = new Date(weekStart.getTime() + 10 * 3600 * 1000).toISOString();
      const day2 = new Date(weekStart.getTime() + 34 * 3600 * 1000).toISOString();

      const pronAttempts: PronunciationEvidenceItem[] = [
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `p_b_${i}`,
          word: `w_${i}`,
          score: 70,
          timestamp: day1,
          isTrusted: true,
          recognizedText: `w_${i}`,
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `p_r_${i}`,
          word: `w2_${i}`,
          score: 85,
          timestamp: day2,
          isTrusted: true,
          recognizedText: `w2_${i}`,
        })),
      ];

      const toeicSessions = [
        {
          id: 't_1',
          title: 'Test 1',
          date: day1,
          totalScore: 600,
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
        {
          id: 't_2',
          title: 'Test 2',
          date: day2,
          totalScore: 750,
          timeSpentSeconds: 3600,
          experienceMode: 'mock',
          skillScope: '2-skills',
          totalQuestions: 200,
        },
      ];

      await syncDerivedLearningMetrics(MOCK_USER_ID, {
        refDate,
        pronunciationAttempts: pronAttempts,
        toeicSessions,
      });

      expect(rpcSpy).toHaveBeenCalled();
      const callArgs = rpcSpy.mock.calls[0][1];

      expect(callArgs.p_pronunciation_gain).toBe(15.0);
      expect(callArgs.p_toeic_gain).toBe(150);
      expect(callArgs.p_evidence.pronunciation_samples).toBe(10);
      expect(callArgs.p_evidence.pronunciation_days).toBe(2);
      expect(callArgs.p_evidence.toeic_attempts).toBe(2);
    });
  });

  // ==========================================================================
  // SECTION D: UI FORMATTING & SEMANTIC DISTINCTION
  // ==========================================================================
  describe('D. UI Semantics & Formatting Distinctions', () => {
    it('Phân biệt rõ ràng giữa điểm số = 0, điểm số dương, điểm số âm và secondary score', () => {
      // 1. Pronunciation Gain
      expect(formatMetricScore(0, 'pronunciation_gain')).toBe('0.0 điểm');
      expect(formatMetricScore(15, 'pronunciation_gain')).toBe('+15.0 điểm');
      expect(formatMetricScore(-8.5, 'pronunciation_gain')).toBe('-8.5 điểm');
      expect(formatSecondaryScore(12, 'pronunciation_gain')).toBe('12 lượt mẫu');

      // 2. TOEIC Gain
      expect(formatMetricScore(0, 'toeic_gain')).toBe('0 LR');
      expect(formatMetricScore(150, 'toeic_gain')).toBe('+150 LR');
      expect(formatMetricScore(-50, 'toeic_gain')).toBe('-50 LR');
      expect(formatSecondaryScore(3, 'toeic_gain')).toBe('3 bài mock');
    });

    it('Secondary score trả về null khi không có bằng chứng hợp lệ', () => {
      expect(formatSecondaryScore(0, 'pronunciation_gain')).toBeNull();
      expect(formatSecondaryScore(undefined, 'pronunciation_gain')).toBeNull();
      expect(formatSecondaryScore(0, 'toeic_gain')).toBeNull();
      expect(formatSecondaryScore(undefined, 'toeic_gain')).toBeNull();
    });
  });

  // ==========================================================================
  // SECTION E: LOCAL PERSISTENCE & LIFECYCLE
  // ==========================================================================
  describe('E. Local Persistence & Storage Lifecycle', () => {
    it('savePronunciationAttempt lưu trữ đúng và dedup theo ID', () => {
      const attempt1: PronunciationEvidenceItem = {
        id: 'p_persist_1',
        word: 'fantastic',
        score: 88,
        timestamp: new Date().toISOString(),
        isTrusted: true,
        recognizedText: 'fantastic',
      };

      savePronunciationAttempt(attempt1);
      const loaded = loadPronunciationAttempts();
      expect(loaded.length).toBe(1);
      expect(loaded[0].word).toBe('fantastic');
      expect(loaded[0].score).toBe(88);

      // Lưu lại cùng ID với score cập nhật -> dedup
      savePronunciationAttempt({ ...attempt1, score: 92 });
      const reloaded = loadPronunciationAttempts();
      expect(reloaded.length).toBe(1);
      expect(reloaded[0].score).toBe(92);
    });

    it('saveToeicAttempt lưu trữ đúng trong toeicPersistenceService', () => {
      const session = {
        id: 'toeic_persist_1',
        title: 'ETS 2024 Test 1',
        date: new Date().toISOString(),
        totalScore: 780,
        timeSpentSeconds: 3600,
        experienceMode: 'mock' as const,
        skillScope: '2-skills' as const,
        totalQuestions: 200,
        mode: '2skills_full',
        durationMinutes: 120,
        userAnswers: {},
        listeningScore: 400,
        readingScore: 380,
        cefrLevel: 'B2' as const,
      };

      saveToeicAttempt(session);
      const loaded = loadToeicHistory();
      expect(loaded.length).toBeGreaterThanOrEqual(1);
      const found = loaded.find((s) => s.id === 'toeic_persist_1');
      expect(found).toBeDefined();
      expect(found?.totalScore).toBe(780);
    });
  });
});
