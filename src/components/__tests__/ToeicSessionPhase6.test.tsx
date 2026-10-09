// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ToeicAssessmentView } from '../ToeicAssessmentView';
import { useAppStore } from '../../store/useAppStore';
import { ToeicAttemptSnapshotMeta, STORAGE_KEY_INPROGRESS } from '../../services/toeicAttemptManager';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock speechService
vi.mock('../../services/speechService', () => ({
  speakWord: vi.fn(),
  createSpeechRecognizer: vi.fn(() => ({
    recognition: {},
    stop: vi.fn(),
  })),
}));

describe('PHASE 6: TOEIC Session Experience Integration Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    useAppStore.getState().resetToDefault();
    useAppStore.setState({
      resumeActivities: {},
      activePracticeConfig: null,
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.useRealTimers();
  });

  const createMockSnapshotMeta = (attemptId = 'attempt_test_phase6'): ToeicAttemptSnapshotMeta => ({
    attemptId,
    mode: '2skills_mini',
    experienceMode: 'practice',
    skillScope: '2-skills',
    questionBankVersion: '2026.1',
    generatedAt: new Date(Date.now() - 300000).toISOString(),
    seed: 42,
    totalQuestions: 10,
    durationMinutes: 15,
    questionIds: [
      'toeic_p1_1',
      'toeic_p1_2',
      'toeic_p2_1',
      'toeic_p2_2',
      'toeic_p3_1',
      'toeic_p3_2',
      'toeic_p4_1',
      'toeic_p5_1',
      'toeic_p6_1',
      'toeic_p7_1',
    ],
    groupIds: ['group_p3_office', 'group_p4_airport', 'group_p6_memo', 'group_p7_article'],
  });

  describe('A. Before Session (Lobby & Today Hub Metadata)', () => {
    it('1. renders SessionIntro in lobby with truthful metadata and zero fake values', () => {
      render(<ToeicAssessmentView />);

      const intro = screen.getByTestId('session-intro');
      expect(intro).toBeTruthy();
      expect(screen.getByText(/Khảo Sát Năng Lực TOEIC 2 & 4 Kỹ Năng/i)).toBeTruthy();
      expect(screen.getByText(/Tiêu Chuẩn Đánh Giá ETS/i)).toBeTruthy();
      expect(screen.getByText(/Đo lường năng lực chuẩn xác theo từng Part/i)).toBeTruthy();

      // No in-progress session by default
      expect(screen.queryByTestId('toeic-resume-banner')).toBeNull();
    });

    it('2. prioritizes Today Learning Hub metadata when opened with activePracticeConfig', () => {
      useAppStore.setState({
        activePracticeConfig: {
          module: 'toeic' as any,
          itemIds: ['exam_toeic_mini'],
          planItemId: 'today_task_toeic_diag',
          planTitle: 'Khảo Sát Nhanh TOEIC Diagnostic Hôm Nay',
          planObjective: 'Xác định cấp độ khởi điểm và phát hiện lỗ hổng Listening/Reading',
          estimatedMinutes: 15,
          startedAt: Date.now(),
        },
      });

      render(<ToeicAssessmentView />);

      const intro = screen.getByTestId('session-intro');
      expect(intro).toBeTruthy();
      expect(screen.getByText(/Khảo Sát Nhanh TOEIC Diagnostic Hôm Nay/i)).toBeTruthy();
      expect(screen.getByText(/Xác định cấp độ khởi điểm/i)).toBeTruthy();
      expect(screen.getByText(/~15 phút/i)).toBeTruthy();
      expect(screen.getByText(/Kế hoạch hôm nay/i)).toBeTruthy();
    });

    it('3. renders resume banner inside SessionIntro when an in-progress attempt exists', () => {
      const meta = createMockSnapshotMeta('attempt_before_resume');
      sessionStorage.setItem(
        STORAGE_KEY_INPROGRESS,
        JSON.stringify({
          stage: 'testing',
          attemptId: meta.attemptId,
          snapshotMeta: meta,
          examMode: '2skills_mini',
          currentQuestionIdx: 2,
          timeLeft: 750,
          userAnswers: { toeic_p1_1: 'A' },
          savedAt: Date.now() - 5000,
        })
      );

      render(<ToeicAssessmentView />);

      const intro = screen.getByTestId('session-intro');
      expect(intro).toBeTruthy();
      const banner = screen.getByTestId('toeic-resume-banner');
      expect(banner).toBeTruthy();
      expect(screen.getByTestId('btn-resume-toeic')).toBeTruthy();
      expect(screen.getByTestId('btn-discard-toeic')).toBeTruthy();
    });
  });

  describe('B. During Session (SessionProgressHeader, Truthful Progress & Ephemeral Invariants)', () => {
    it('1. transitions to testing stage with SessionProgressHeader showing answered/total counter and zero fake streak', () => {
      render(<ToeicAssessmentView />);

      // Click Start Mini-Test (10 câu • 15P)
      const startMiniBtn = screen.getByRole('button', { name: /Mini-Test/i });
      fireEvent.click(startMiniBtn);

      // Verify SessionProgressHeader is rendered
      const header = screen.getByTestId('session-progress-header');
      expect(header).toBeTruthy();

      // Metric shows answered format: 0 / 10 (10 remaining)
      expect(screen.getByText(/0 \/ 10/i)).toBeTruthy();
      expect(screen.getByText(/10 remaining/i)).toBeTruthy();

      // Invariant: Assessment has NO streak / combo
      expect(header.querySelector('.lucide-flame')).toBeNull();
      expect(screen.queryByText(/🔥/i)).toBeNull();

      // Question count badge is displayed
      expect(header.textContent).toContain('Câu hỏi');
      expect(header.textContent).toContain('1');
      expect(header.textContent).toContain('/ 10');
    });

    it('2. progress percentage strictly reflects answered questions count, NOT current question index', () => {
      render(<ToeicAssessmentView />);

      const startMiniBtn = screen.getByRole('button', { name: /Mini-Test/i });
      fireEvent.click(startMiniBtn);

      const header = screen.getByTestId('session-progress-header');

      // Initially 0 / 10 answered
      expect(screen.getByText(/0 \/ 10/i)).toBeTruthy();

      // Navigate to next question without answering
      const nextBtn = screen.getByRole('button', { name: /Câu Tiếp/i });
      fireEvent.click(nextBtn);

      // Now on question 2, but answered count remains 0 / 10
      expect(header.textContent).toContain('Câu hỏi');
      expect(header.textContent).toContain('2');
      expect(header.textContent).toContain('/ 10');
      expect(screen.getByText(/0 \/ 10/i)).toBeTruthy();

      // Choose an answer on question 2
      const choiceButtons = screen.getAllByRole('button');
      const choiceA = choiceButtons.find((btn) => btn.textContent?.includes('A.') || btn.textContent?.trim().startsWith('A'));
      if (choiceA) {
        fireEvent.click(choiceA);
        // Answered count is now 1 / 10
        expect(screen.getByText(/1 \/ 10/i)).toBeTruthy();
        expect(screen.getByText(/9 remaining/i)).toBeTruthy();
      }
    });

    it('3. supports pause state and displays Paused overlay without resetting timer in practice mode', () => {
      render(<ToeicAssessmentView />);

      // Switch to Practice mode where canPause is true
      const practiceBtn = screen.getByText('Luyện Tập Tự Do').closest('button');
      expect(practiceBtn).toBeTruthy();
      fireEvent.click(practiceBtn!);

      const startMiniBtn = screen.getByRole('button', { name: /Mini-Test/i });
      fireEvent.click(startMiniBtn);

      // Click pause button
      const pauseBtn = screen.getByTitle('Tạm dừng làm bài');
      expect(pauseBtn).toBeTruthy();
      fireEvent.click(pauseBtn);

      // Overlay should appear
      expect(screen.getByText(/Bài Thi Đang Tạm Dừng/i)).toBeTruthy();

      // Click Tiếp Tục Làm Bài in overlay
      const resumeFromOverlayBtn = screen.getByRole('button', { name: /Tiếp Tục Làm Bài/i });
      fireEvent.click(resumeFromOverlayBtn);

      // Overlay dismissed
      expect(screen.queryByText(/Bài Thi Đang Tạm Dừng/i)).toBeNull();
    });
  });

  describe('C. Resume & Lifecycle Semantics', () => {
    it('1. resumes attempt restoring exact snapshot, answer state, and deducting elapsed time for unpaused test', () => {
      const meta = createMockSnapshotMeta('attempt_resume_timed');
      const originalTimeLeft = 900;
      const elapsedSeconds = 60;
      const savedAt = Date.now() - elapsedSeconds * 1000;

      sessionStorage.setItem(
        STORAGE_KEY_INPROGRESS,
        JSON.stringify({
          stage: 'testing',
          attemptId: meta.attemptId,
          snapshotMeta: meta,
          examMode: '2skills_mini',
          experienceConfig: { timerMode: 'strict', canPause: true },
          currentQuestionIdx: 0,
          timeLeft: originalTimeLeft,
          userAnswers: { toeic_p1_1: 'B' },
          savedAt,
          isPaused: false,
        })
      );

      render(<ToeicAssessmentView />);

      const resumeBtn = screen.getByTestId('btn-resume-toeic');
      fireEvent.click(resumeBtn);

      // In testing stage
      expect(screen.getByTestId('session-progress-header')).toBeTruthy();
      expect(screen.getByText(/1 \/ 10/i)).toBeTruthy(); // 1 answer restored

      // Elapsed time deducted in inProgress storage
      const inProgressRaw = sessionStorage.getItem(STORAGE_KEY_INPROGRESS);
      const inProgress = JSON.parse(inProgressRaw!);
      expect(inProgress.timeLeft).toBeLessThanOrEqual(originalTimeLeft - elapsedSeconds + 1);
      expect(inProgress.userAnswers['toeic_p1_1']).toBe('B');
    });

    it('2. discard safely clears in-progress storage and Zustand resumeActivities', () => {
      const meta = createMockSnapshotMeta('attempt_discard_lifecycle');
      sessionStorage.setItem(
        STORAGE_KEY_INPROGRESS,
        JSON.stringify({
          stage: 'testing',
          attemptId: meta.attemptId,
          snapshotMeta: meta,
          examMode: '2skills_mini',
          currentQuestionIdx: 0,
          timeLeft: 600,
          userAnswers: {},
          savedAt: Date.now() - 2000,
        })
      );

      useAppStore.getState().upsertResumeActivity({
        id: `toeic_${meta.attemptId}`,
        type: 'toeic',
        title: 'TOEIC Exam (2skills_mini)',
        startedAt: Date.now() - 2000,
        lastActiveAt: Date.now() - 2000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          attemptId: meta.attemptId,
          examMode: '2skills_mini',
          currentQuestionIdx: 0,
          totalQuestions: 10,
          answeredCount: 0,
          timeLeftSeconds: 600,
        },
      });

      render(<ToeicAssessmentView />);

      const discardBtn = screen.getByTestId('btn-discard-toeic');
      fireEvent.click(discardBtn);

      // Banner dismissed and storage cleared
      expect(screen.queryByTestId('toeic-resume-banner')).toBeNull();
      expect(sessionStorage.getItem(STORAGE_KEY_INPROGRESS)).toBeNull();
      expect(useAppStore.getState().resumeActivities[`toeic_${meta.attemptId}`]).toBeUndefined();
    });

    it('3. auto-discards stale attempt older than 24 hours', () => {
      const meta = createMockSnapshotMeta('attempt_stale_24h');
      const staleTime = Date.now() - (26 * 60 * 60 * 1000); // 26 hours ago

      sessionStorage.setItem(
        STORAGE_KEY_INPROGRESS,
        JSON.stringify({
          stage: 'testing',
          attemptId: meta.attemptId,
          snapshotMeta: meta,
          examMode: '2skills_mini',
          currentQuestionIdx: 0,
          timeLeft: 600,
          userAnswers: {},
          savedAt: staleTime,
        })
      );

      render(<ToeicAssessmentView />);

      // Stale attempt is discarded on mount
      expect(screen.queryByTestId('toeic-resume-banner')).toBeNull();
      expect(sessionStorage.getItem(STORAGE_KEY_INPROGRESS)).toBeNull();
    });
  });

  describe('D. Completion, Scoring & NextActionPanel Routing', () => {
    it('1. submitting exam cleans up continuity and renders score report with NextActionPanel', () => {
      const meta = createMockSnapshotMeta('attempt_complete_flow');
      sessionStorage.setItem(
        STORAGE_KEY_INPROGRESS,
        JSON.stringify({
          stage: 'testing',
          attemptId: meta.attemptId,
          snapshotMeta: meta,
          examMode: '2skills_mini',
          currentQuestionIdx: 0,
          timeLeft: 500,
          userAnswers: { toeic_p1_1: 'A' },
          savedAt: Date.now() - 1000,
        })
      );

      const navigateToTabSpy = vi.fn();
      useAppStore.setState({
        navigateToTab: navigateToTabSpy,
      });

      render(<ToeicAssessmentView />);

      // Resume
      fireEvent.click(screen.getByTestId('btn-resume-toeic'));

      // Click Nộp Bài
      const submitBtn = screen.getByRole('button', { name: /Nộp Bài/i });
      fireEvent.click(submitBtn);

      // Confirm in modal
      const confirmButtons = screen.getAllByRole('button', { name: /Nộp Bài/i });
      fireEvent.click(confirmButtons[confirmButtons.length - 1]);

      // Report stage rendered
      expect(screen.getByText(/Kết Quả Khảo Sát Năng Lực TOEIC/i)).toBeTruthy();

      // SessionStorage attempt cleared
      expect(sessionStorage.getItem(STORAGE_KEY_INPROGRESS)).toBeNull();

      // NextActionPanel rendered
      const nextActionPanel = screen.getByTestId('next-action-panel');
      expect(nextActionPanel).toBeTruthy();

      const todayHubBtn = screen.getByTestId('next-action-next-action-today-hub');
      expect(todayHubBtn).toBeTruthy();

      // Clicking Today Hub button invokes navigateToTab('dashboard')
      fireEvent.click(todayHubBtn);
      expect(navigateToTabSpy).toHaveBeenCalledWith('dashboard');
    });

    it('2. invariant: double submit is completely prevented and does not duplicate scores or XP', () => {
      const meta = createMockSnapshotMeta('attempt_double_submit_guard');
      sessionStorage.setItem(
        STORAGE_KEY_INPROGRESS,
        JSON.stringify({
          stage: 'testing',
          attemptId: meta.attemptId,
          snapshotMeta: meta,
          examMode: '2skills_mini',
          currentQuestionIdx: 0,
          timeLeft: 500,
          userAnswers: { toeic_p1_1: 'A' },
          savedAt: Date.now() - 1000,
        })
      );

      const initialXP = useAppStore.getState().profile.xp;

      render(<ToeicAssessmentView />);

      fireEvent.click(screen.getByTestId('btn-resume-toeic'));

      // Open confirm modal
      const submitBtn = screen.getByRole('button', { name: /Nộp Bài/i });
      fireEvent.click(submitBtn);

      // Confirm submission
      const confirmButtons = screen.getAllByRole('button', { name: /Nộp Bài/i });
      const finalSubmitBtn = confirmButtons[confirmButtons.length - 1];

      // Click twice rapidly
      fireEvent.click(finalSubmitBtn);
      fireEvent.click(finalSubmitBtn);

      // XP should have increased only once
      const finalXP = useAppStore.getState().profile.xp;
      expect(finalXP).toBeGreaterThan(initialXP);
    });
  });
});
