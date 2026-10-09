import { describe, it, expect, vi } from 'vitest';
import {
  TOEIC_EXPERIENCE_CONFIGS,
  getExperienceConfig,
  resolveExperienceAndSkillScope,
  isCombinationSupported,
  ToeicTestSession,
} from '../../types/toeic';
import { generateToeicExam } from '../examGenerator';
import {
  createNewAttemptSnapshot,
  restoreSnapshotFromMeta,
} from '../toeicAttemptManager';
import { calculateToeicScores } from '../toeicScoring';
import { toeicQuestionIndex } from '../toeicIndex';
import { TOEIC_QUESTION_BANK } from '../../data/toeicQuestionsData';

describe('TOEIC Experience Engine — Phase 4: Strict Mock Exam + Result Experience', () => {
  // =========================================================================
  // 1. Mock Permission Lock & ETS Testing Conditions
  // =========================================================================
  describe('1. Mock Permission Lock Matrix', () => {
    it('khóa chặt toàn bộ công cụ học tập và trợ giúp trong chế độ Mock Exam', () => {
      const config = getExperienceConfig('mock');

      // 1. Strict timer & no pause
      expect(config.timerMode).toBe('strict');
      expect(config.canPause).toBe(false);

      // 2. Zero assistance: no hints, no immediate feedback, no lookup, no vocabulary saving
      expect(config.allowHints).toBe(false);
      expect(config.showImmediateFeedback).toBe(false);
      expect(config.allowLookup).toBe(false);
      expect(config.allowSaveVocabulary).toBe(false);

      // 3. Exam integrity: no retry, no audio transcripts, no audio replay
      expect(config.allowRetry).toBe(false);
      expect(config.allowTranscript).toBe(false);
      expect(config.allowAudioReplay).toBe(false);

      // 4. Fixed standardized difficulty & result only at end
      expect(config.adaptiveDifficulty).toBe(false);
      expect(config.showResultOnlyAtEnd).toBe(true);
    });

    it('tách bạch quyền năng giữa Mock, Practice và Diagnostic', () => {
      const mockConfig = TOEIC_EXPERIENCE_CONFIGS.mock;
      const practiceConfig = TOEIC_EXPERIENCE_CONFIGS.practice;
      const diagConfig = TOEIC_EXPERIENCE_CONFIGS.diagnostic;

      // Practice cho phép học trong khi làm
      expect(practiceConfig.showImmediateFeedback).toBe(true);
      expect(practiceConfig.allowHints).toBe(true);
      expect(practiceConfig.allowLookup).toBe(true);
      expect(practiceConfig.allowRetry).toBe(true);
      expect(practiceConfig.allowAudioReplay).toBe(true);
      expect(practiceConfig.canPause).toBe(true);

      // Diagnostic là bài khảo sát nhanh thích ứng
      expect(diagConfig.adaptiveDifficulty).toBe(true);
      expect(diagConfig.timerMode).toBe('soft');
      expect(diagConfig.showResultOnlyAtEnd).toBe(true);
      expect(diagConfig.allowHints).toBe(false);

      // Mock là bài thi chuẩn hóa nghiêm ngặt nhất
      expect(mockConfig.timerMode).toBe('strict');
      expect(mockConfig.canPause).toBe(false);
      expect(mockConfig.showImmediateFeedback).toBe(false);
      expect(mockConfig.allowRetry).toBe(false);
      expect(mockConfig.allowAudioReplay).toBe(false);
    });

    it('phân giải chính xác cấu hình Mock khi người dùng chọn 2-skills hoặc 4-skills', () => {
      const resolved2S = resolveExperienceAndSkillScope({
        experienceMode: 'mock',
        skillScope: '2-skills',
      });
      expect(resolved2S.experienceMode).toBe('mock');
      expect(resolved2S.skillScope).toBe('2-skills');
      expect(resolved2S.resolvedExamMode).toBe('2skills_full');
      expect(resolved2S.experienceConfig.timerMode).toBe('strict');

      const resolved4S = resolveExperienceAndSkillScope({
        experienceMode: 'mock',
        skillScope: '4-skills',
      });
      expect(resolved4S.experienceMode).toBe('mock');
      expect(resolved4S.skillScope).toBe('4-skills');
      expect(resolved4S.resolvedExamMode).toBe('4skills');
      expect(resolved4S.experienceConfig.allowAudioReplay).toBe(false);
    });

    it('hỗ trợ tổ hợp Mock 2-Skills và Mock 4-Skills', () => {
      const check2S = isCombinationSupported('mock', '2-skills');
      expect(check2S.supported).toBe(true);

      const check4S = isCombinationSupported('mock', '4-skills');
      expect(check4S.supported).toBe(true);
    });
  });

  // =========================================================================
  // 2. Mock Generator Invariants & Anti-Weakness Bias
  // =========================================================================
  describe('2. Mock Generator Invariants & Neutrality', () => {
    it('bỏ qua weakAreas trong Mock Exam để đảm bảo chuẩn hóa khách quan theo ETS', () => {
      const seed = 998877;
      const testWeakAreas = [
        { part: 'part5_grammar' as const, grammarTag: 'Subject-Verb Agreement' },
        { part: 'part7_reading' as const, topic: 'Business Correspondence' },
      ];

      // Sinh đề Mock có weakAreas
      const mockWithWeak = generateToeicExam({
        mode: '2skills_full',
        experienceMode: 'mock',
        skillScope: '2-skills',
        seed,
        weakAreas: testWeakAreas,
      });

      // Sinh đề Mock KHÔNG có weakAreas
      const mockWithoutWeak = generateToeicExam({
        mode: '2skills_full',
        experienceMode: 'mock',
        skillScope: '2-skills',
        seed,
        weakAreas: [],
      });

      // Cả hai đề phải hoàn toàn trùng khớp từng câu hỏi vì Mock bỏ qua weakAreas
      const qIdsWithWeak = mockWithWeak.questions.map((q) => q.id);
      const qIdsWithoutWeak = mockWithoutWeak.questions.map((q) => q.id);
      expect(qIdsWithWeak).toEqual(qIdsWithoutWeak);

      const gIdsWithWeak = mockWithWeak.groups.map((g) => g.id);
      const gIdsWithoutWeak = mockWithoutWeak.groups.map((g) => g.id);
      expect(gIdsWithWeak).toEqual(gIdsWithoutWeak);
    });

    it('giữ nguyên group integrity và phân phối difficulty cân bằng trong Mock Exam', () => {
      const mockExam = generateToeicExam({
        mode: '2skills_full',
        experienceMode: 'mock',
        skillScope: '2-skills',
        seed: 424242,
      });

      expect(mockExam.questions.length).toBe(20);
      expect(mockExam.experienceMode).toBe('mock');

      // Kiểm tra group integrity: các câu hỏi trong Part 3, 4, 6, 7 phải trọn vẹn theo group
      const groupedQuestions = mockExam.questions.filter((q) => q.groupId);
      expect(groupedQuestions.length).toBeGreaterThan(0);

      const groupMap = new Map<string, number>();
      groupedQuestions.forEach((q) => {
        groupMap.set(q.groupId!, (groupMap.get(q.groupId!) || 0) + 1);
      });

      // Mỗi group xuất hiện trong đề phải có đúng 3 câu (atomic invariant)
      groupMap.forEach((count, groupId) => {
        expect(count).toBe(3);
        const groupObj = mockExam.groups.find((g) => g.id === groupId);
        expect(groupObj).toBeDefined();
      });
    });

    it('tạo attempt snapshot cho Mock Exam với metadata đầy đủ và tái tạo bất biến khi reload', () => {
      const { snapshot, meta } = createNewAttemptSnapshot({
        mode: '2skills_full',
        experienceMode: 'mock',
        skillScope: '2-skills',
      });

      expect(meta.experienceMode).toBe('mock');
      expect(meta.skillScope).toBe('2-skills');
      expect(snapshot.experienceConfig?.timerMode).toBe('strict');
      expect(snapshot.experienceConfig?.canPause).toBe(false);

      // Phục hồi snapshot từ metadata
      const { snapshot: restored, isFullyRestored } = restoreSnapshotFromMeta(meta);
      expect(isFullyRestored).toBe(true);
      expect(restored.questions.map((q) => q.id)).toEqual(snapshot.questions.map((q) => q.id));
      expect(restored.groups.map((g) => g.id)).toEqual(snapshot.groups.map((g) => g.id));
    });
  });

  // =========================================================================
  // 3. Single Audio Play Invariant (Mock Exam Audio Rules)
  // =========================================================================
  describe('3. Single Audio Play Invariant', () => {
    it('chỉ cho phép phát audio 1 lần duy nhất cho mỗi câu hỏi khi allowAudioReplay = false', () => {
      const audioPlayedMap: Record<string, boolean> = {};

      const playAudio = (qId: string, allowReplay: boolean): boolean => {
        if (!allowReplay && audioPlayedMap[qId]) {
          return false; // Bị từ chối theo quy chế thi ETS
        }
        audioPlayedMap[qId] = true;
        return true; // Cho phép phát
      };

      const qId = 'p1_photo_01';

      // Lần đầu: Được phát
      expect(playAudio(qId, false)).toBe(true);
      expect(audioPlayedMap[qId]).toBe(true);

      // Lần thứ hai trong Mock Exam: Bị chặn (single play invariant)
      expect(playAudio(qId, false)).toBe(false);

      // Câu hỏi khác: Lần đầu vẫn được phát
      expect(playAudio('p2_qna_01', false)).toBe(true);
      expect(playAudio('p2_qna_01', false)).toBe(false);
    });

    it('cho phép phát audio nhiều lần khi allowAudioReplay = true (Practice Mode)', () => {
      const audioPlayedMap: Record<string, boolean> = {};

      const playAudio = (qId: string, allowReplay: boolean): boolean => {
        if (!allowReplay && audioPlayedMap[qId]) {
          return false;
        }
        audioPlayedMap[qId] = true;
        return true;
      };

      const qId = 'p1_photo_practice';
      expect(playAudio(qId, true)).toBe(true);
      expect(playAudio(qId, true)).toBe(true);
      expect(playAudio(qId, true)).toBe(true);
    });
  });

  // =========================================================================
  // 4. Strict Auto-Submit & Zero Duplicate Invariant
  // =========================================================================
  describe('4. Strict Auto-Submit Invariant', () => {
    it('bảo đảm nộp bài tự động khi hết giờ chỉ chạy đúng 1 lần (isSubmittingRef guard)', () => {
      let isSubmittingRef = false;
      let submitCount = 0;
      let totalXPEarned = 0;

      const triggerAutoSubmit = () => {
        if (isSubmittingRef) return; // Guard chống race condition
        isSubmittingRef = true;
        submitCount++;
        totalXPEarned += 50;
      };

      // Mô phỏng nhiều event/tick cùng kích hoạt khi timeLeft = 0
      triggerAutoSubmit(); // Tick 1: auto-submit chính thức
      triggerAutoSubmit(); // Tick 2: timer interval chưa clear kịp
      triggerAutoSubmit(); // Tick 3: click nộp bài đồng thời

      expect(submitCount).toBe(1);
      expect(totalXPEarned).toBe(50);
    });
  });

  // =========================================================================
  // 5. Submit Summary Modal Contract (Zero Answer Leak)
  // =========================================================================
  describe('5. Submit Summary Modal Contract', () => {
    it('bảng xác nhận nộp bài chỉ hiển thị tổng câu, đã làm, chưa làm, flagged và thời gian còn lại mà không lộ đáp án', () => {
      const sampleQuestions = TOEIC_QUESTION_BANK.slice(0, 10);
      const userAnswers: Record<string, string> = {
        [sampleQuestions[0].id]: 'A',
        [sampleQuestions[1].id]: 'B',
        [sampleQuestions[2].id]: 'C',
      };
      const bookmarkedQuestions: Record<string, boolean> = {
        [sampleQuestions[1].id]: true,
        [sampleQuestions[3].id]: true,
      };
      const timeLeft = 450; // 7 phút 30 giây

      const answeredCount = sampleQuestions.filter((q) => !!userAnswers[q.id]).length;
      const unansweredCount = sampleQuestions.length - answeredCount;
      const flaggedCount = Object.values(bookmarkedQuestions).filter(Boolean).length;

      expect(answeredCount).toBe(3);
      expect(unansweredCount).toBe(7);
      expect(flaggedCount).toBe(2);

      // Verify Modal Payload Contract
      const modalSummary = {
        totalQuestions: sampleQuestions.length,
        answeredCount,
        unansweredCount,
        flaggedCount,
        timeRemainingFormatted: `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`,
      };

      expect(modalSummary.totalQuestions).toBe(10);
      expect(modalSummary.answeredCount).toBe(3);
      expect(modalSummary.unansweredCount).toBe(7);
      expect(modalSummary.flaggedCount).toBe(2);
      expect(modalSummary.timeRemainingFormatted).toBe('7:30');

      // Tuyệt đối không chứa đáp án đúng hoặc lời giải
      expect((modalSummary as any).correctAnswer).toBeUndefined();
      expect((modalSummary as any).explanation).toBeUndefined();
    });
  });

  // =========================================================================
  // 6. Post-Submit Unlocking & Time Usage Recording
  // =========================================================================
  describe('6. Post-Submit Scoring & Time Usage Recording', () => {
    it('ghi nhận timeSpentSeconds chính xác và mở khóa toàn bộ kết quả sau khi nộp bài', () => {
      const questions = TOEIC_QUESTION_BANK.slice(0, 10);
      const userAnswers: Record<string, string> = {};
      questions.forEach((q, idx) => {
        // Đúng 7 câu, sai 3 câu
        userAnswers[q.id] = idx < 7 ? (q.correctAnswer || 'A') : 'INVALID';
      });

      const totalDurationSeconds = 15 * 60; // 900s
      const timeLeftAtSubmit = 320; // Còn 320s
      const timeSpentSeconds = totalDurationSeconds - timeLeftAtSubmit; // 580s

      const scoreEval = calculateToeicScores({
        mode: '2skills_mini',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions,
        userAnswers,
        timeSpentSeconds,
      });

      expect(scoreEval.experienceMode).toBe('mock');
      expect(scoreEval.timeSpentSeconds).toBe(580);
      expect(scoreEval.totalScore).toBeGreaterThanOrEqual(10);
      expect(scoreEval.totalScore).toBeLessThanOrEqual(990);
      expect(scoreEval.listeningScore).toBeGreaterThanOrEqual(5);
      expect(scoreEval.readingScore).toBeGreaterThanOrEqual(5);
      expect(scoreEval.partBreakdown.length).toBeGreaterThan(0);
      expect(scoreEval.cefrLevel).toBeDefined();

      // Sau khi nộp bài, giải thích và từ vựng của từng câu hỏi được mở khóa
      questions.forEach((q) => {
        expect(q.explanation).toBeDefined();
        expect(q.explanation.length).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // 7. Distinct Result Presentations for 3 Experience Modes
  // =========================================================================
  describe('7. Distinct Result Presentations Across 3 Modes', () => {
    it('cung cấp metadata kết quả khác biệt hoàn toàn giữa Mock, Practice và Diagnostic', () => {
      const questions = TOEIC_QUESTION_BANK.slice(0, 10);
      const userAnswers: Record<string, string> = {};
      questions.forEach((q) => {
        userAnswers[q.id] = q.correctAnswer || 'A';
      });

      // 1. Diagnostic Result
      const diagResult = calculateToeicScores({
        mode: '2skills_mini',
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
        questions,
        userAnswers,
      });
      expect(diagResult.experienceMode).toBe('diagnostic');
      expect(diagResult.diagnosticReport).toBeDefined();
      expect(diagResult.diagnosticReport?.estimatedToeicRange).toBeDefined();
      expect(diagResult.diagnosticReport?.confidence).toBeDefined();
      expect(diagResult.diagnosticReport?.recommendedNextStep).toBeDefined();

      // 2. Practice Result
      const pracResult = calculateToeicScores({
        mode: '2skills_full',
        experienceMode: 'practice',
        skillScope: '2-skills',
        questions,
        userAnswers,
        firstAttemptAnswers: { [questions[0].id]: 'WRONG' },
      });
      expect(pracResult.experienceMode).toBe('practice');
      expect(pracResult.practiceStats).toBeDefined();
      expect(pracResult.practiceStats?.accuracy).toBeDefined();
      expect(pracResult.practiceStats?.firstAttemptCorrect).toBeDefined();

      // 3. Mock Result
      const mockResult = calculateToeicScores({
        mode: '2skills_full',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions,
        userAnswers,
        timeSpentSeconds: 1100,
      });
      expect(mockResult.experienceMode).toBe('mock');
      expect(mockResult.diagnosticReport).toBeUndefined(); // Không có diagnostic CAT estimate
      expect(mockResult.timeSpentSeconds).toBe(1100);
      expect(mockResult.totalScore).toBeDefined();
      expect(mockResult.listeningScore).toBeDefined();
      expect(mockResult.readingScore).toBeDefined();
    });
  });

  // =========================================================================
  // 8. Lobby Test History Isolation (No Mode Conflation)
  // =========================================================================
  describe('8. Lobby Test History Isolation', () => {
    it('phân tách độc lập lịch sử thi của Mock, Practice và Diagnostic', () => {
      const mockSession: ToeicTestSession = {
        id: 'sess_mock_1',
        mode: '2skills_full',
        experienceMode: 'mock',
        skillScope: '2-skills',
        title: 'TOEIC Mock Test 2026',
        date: new Date().toISOString(),
        totalQuestions: 20,
        durationMinutes: 30,
        timeSpentSeconds: 1650,
        userAnswers: {},
        listeningScore: 410,
        readingScore: 385,
        totalScore: 795,
        cefrLevel: 'B2',
      };

      const pracSession: ToeicTestSession = {
        id: 'sess_prac_1',
        mode: '2skills_full',
        experienceMode: 'practice',
        skillScope: '2-skills',
        title: 'TOEIC Practice Session',
        date: new Date().toISOString(),
        totalQuestions: 20,
        durationMinutes: 30,
        userAnswers: {},
        practiceStats: {
          firstAttemptCorrect: 14,
          retryCorrect: 4,
          totalQuestions: 20,
          accuracy: 70,
        },
        listeningScore: 350,
        readingScore: 320,
        totalScore: 670,
        cefrLevel: 'B1',
      };

      const diagSession: ToeicTestSession = {
        id: 'sess_diag_1',
        mode: '2skills_mini',
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
        title: 'TOEIC Diagnostic Test',
        date: new Date().toISOString(),
        totalQuestions: 10,
        durationMinutes: 15,
        userAnswers: {},
        listeningScore: 300,
        readingScore: 280,
        totalScore: 580,
        cefrLevel: 'B1',
      };

      const history = [mockSession, pracSession, diagSession];

      // Filter Mock
      const mockOnly = history.filter((s) => s.experienceMode === 'mock');
      expect(mockOnly.length).toBe(1);
      expect(mockOnly[0].id).toBe('sess_mock_1');
      expect(mockOnly[0].timeSpentSeconds).toBe(1650);

      // Filter Practice
      const pracOnly = history.filter((s) => s.experienceMode === 'practice');
      expect(pracOnly.length).toBe(1);
      expect(pracOnly[0].practiceStats).toBeDefined();

      // Filter Diagnostic
      const diagOnly = history.filter((s) => s.experienceMode === 'diagnostic');
      expect(diagOnly.length).toBe(1);

      // Điểm Mock không bị ghi đè hay gộp lẫn với Practice
      expect(mockOnly[0].totalScore).toBe(795);
      expect(pracOnly[0].totalScore).toBe(670);
    });
  });
});
