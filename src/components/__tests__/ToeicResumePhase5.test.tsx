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

describe('PHASE 5: TOEIC Assessment Resume Continuity Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    useAppStore.getState().resetToDefault();
    useAppStore.setState({
      resumeActivities: {},
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.useRealTimers();
  });

  const createMockSnapshotMeta = (attemptId = 'attempt_test_phase5'): ToeicAttemptSnapshotMeta => ({
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

  it('1. renders toeic-resume-banner with resume and discard buttons when an incomplete attempt exists', () => {
    const meta = createMockSnapshotMeta();
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
        savedAt: Date.now() - 10000,
      })
    );

    render(<ToeicAssessmentView />);

    const banner = screen.getByTestId('toeic-resume-banner');
    expect(banner).toBeTruthy();
    expect(screen.getByTestId('btn-resume-toeic')).toBeTruthy();
    expect(screen.getByTestId('btn-discard-toeic')).toBeTruthy();
    expect(screen.getByText(/Bạn có bài thi chưa hoàn thành/i)).toBeTruthy();
  });

  it('2. restores exact question set and answered questions without re-generating from random seed', () => {
    const meta = createMockSnapshotMeta('attempt_exact_restore');
    sessionStorage.setItem(
      STORAGE_KEY_INPROGRESS,
      JSON.stringify({
        stage: 'testing',
        attemptId: meta.attemptId,
        snapshotMeta: meta,
        examMode: '2skills_mini',
        currentQuestionIdx: 1,
        timeLeft: 800,
        userAnswers: { toeic_p1_1: 'C', toeic_p1_2: 'A' },
        savedAt: Date.now() - 5000,
      })
    );

    render(<ToeicAssessmentView />);

    const resumeBtn = screen.getByTestId('btn-resume-toeic');
    fireEvent.click(resumeBtn);

    // Banner is dismissed
    expect(screen.queryByTestId('toeic-resume-banner')).toBeNull();

    // Check we entered testing stage and preserved questions
    const inProgressRaw = sessionStorage.getItem(STORAGE_KEY_INPROGRESS);
    expect(inProgressRaw).toBeTruthy();
    const inProgress = JSON.parse(inProgressRaw!);
    expect(inProgress.snapshotMeta.questionIds).toEqual(meta.questionIds);
    expect(inProgress.snapshotMeta.groupIds).toEqual(meta.groupIds);
    expect(inProgress.userAnswers['toeic_p1_1']).toBe('C');
  });

  it('3. calculates elapsed time and deducts it from timeLeft for unpaused timed exams', () => {
    const meta = createMockSnapshotMeta('attempt_timed_elapsed');
    const originalTimeLeft = 900; // 15 mins
    const elapsedSeconds = 120; // 2 mins passed while browser was closed
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
        userAnswers: {},
        savedAt,
        isPaused: false,
      })
    );

    render(<ToeicAssessmentView />);

    const resumeBtn = screen.getByTestId('btn-resume-toeic');
    fireEvent.click(resumeBtn);

    // Verify stored progress has subtracted elapsed time (approx 900 - 120 = 780s)
    const inProgressRaw = sessionStorage.getItem(STORAGE_KEY_INPROGRESS);
    const inProgress = JSON.parse(inProgressRaw!);
    expect(inProgress.timeLeft).toBeLessThanOrEqual(originalTimeLeft - elapsedSeconds + 1);
    expect(inProgress.timeLeft).toBeGreaterThanOrEqual(originalTimeLeft - elapsedSeconds - 5);
  });

  it('4. preserves exact timeLeft without deduction when test was paused before exit', () => {
    const meta = createMockSnapshotMeta('attempt_paused_timer');
    const originalTimeLeft = 650;
    const elapsedSeconds = 300; // 5 mins elapsed while tab closed
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
        userAnswers: {},
        savedAt,
        isPaused: true,
      })
    );

    render(<ToeicAssessmentView />);

    const resumeBtn = screen.getByTestId('btn-resume-toeic');
    fireEvent.click(resumeBtn);

    // Exact timeLeft must be preserved
    const inProgressRaw = sessionStorage.getItem(STORAGE_KEY_INPROGRESS);
    const inProgress = JSON.parse(inProgressRaw!);
    expect(inProgress.timeLeft).toBe(originalTimeLeft);
    expect(inProgress.isPaused).toBe(true);

    // Paused overlay is shown
    expect(screen.getByText(/Bài Thi Đang Tạm Dừng/i)).toBeTruthy();
  });

  it('5. clicking discard clears in-progress attempt from sessionStorage and resumeActivities', () => {
    const meta = createMockSnapshotMeta('attempt_discard_me');
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
        savedAt: Date.now() - 5000,
      })
    );

    // Also populate in zustand store
    useAppStore.getState().upsertResumeActivity({
      id: `toeic_${meta.attemptId}`,
      type: 'toeic',
      title: 'TOEIC Exam (2skills_mini)',
      startedAt: Date.now() - 5000,
      lastActiveAt: Date.now() - 5000,
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

    expect(screen.getByTestId('toeic-resume-banner')).toBeTruthy();

    const discardBtn = screen.getByTestId('btn-discard-toeic');
    fireEvent.click(discardBtn);

    // Banner should disappear
    expect(screen.queryByTestId('toeic-resume-banner')).toBeNull();

    // sessionStorage should be cleared
    expect(sessionStorage.getItem(STORAGE_KEY_INPROGRESS)).toBeNull();

    // resumeActivities should no longer have the activity
    const storeActivities = useAppStore.getState().resumeActivities;
    expect(storeActivities[`toeic_${meta.attemptId}`]).toBeUndefined();
  });

  it('6. submitting exam completes and cleans up resumeActivity and sessionStorage', () => {
    const meta = createMockSnapshotMeta('attempt_submit_clean');
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
        savedAt: Date.now() - 5000,
      })
    );

    render(<ToeicAssessmentView />);

    // Resume first
    fireEvent.click(screen.getByTestId('btn-resume-toeic'));

    // Click Nộp Bài button
    const submitBtn = screen.getByRole('button', { name: /Nộp Bài/i });
    fireEvent.click(submitBtn);

    // Confirmation modal should appear; confirm submission
    const confirmButtons = screen.getAllByRole('button', { name: /Nộp Bài/i });
    const modalConfirmBtn = confirmButtons[confirmButtons.length - 1];
    fireEvent.click(modalConfirmBtn);

    // Report stage should be rendered
    expect(screen.getByText(/Kết Quả Khảo Sát Năng Lực TOEIC/i)).toBeTruthy();

    // In-progress session should be cleared
    expect(sessionStorage.getItem(STORAGE_KEY_INPROGRESS)).toBeNull();

    // Resume activity in store should be completed
    const storeActivities = useAppStore.getState().resumeActivities;
    const act = storeActivities[`toeic_${meta.attemptId}`];
    if (act) {
      expect(act.completed).toBe(true);
    }
  });

  it('7. stale attempt (> 24 hours) is automatically discarded and banner is not shown', () => {
    const meta = createMockSnapshotMeta('attempt_stale');
    const staleTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago

    sessionStorage.setItem(
      STORAGE_KEY_INPROGRESS,
      JSON.stringify({
        stage: 'testing',
        attemptId: meta.attemptId,
        snapshotMeta: meta,
        examMode: '2skills_mini',
        currentQuestionIdx: 2,
        timeLeft: 600,
        userAnswers: {},
        savedAt: staleTime,
      })
    );

    render(<ToeicAssessmentView />);

    // Stale banner must not render
    expect(screen.queryByTestId('toeic-resume-banner')).toBeNull();

    // Storage must have been cleared
    expect(sessionStorage.getItem(STORAGE_KEY_INPROGRESS)).toBeNull();
  });
});
