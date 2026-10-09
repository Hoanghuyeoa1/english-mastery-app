// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { FourSkillsView } from '../FourSkillsView';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import { READING_LESSONS } from '../../data/fourSkills/readingData';
import { LISTENING_LESSONS } from '../../data/fourSkills/listeningData';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
    button: ({ children, className, ...props }: any) => (
      <button className={className} {...props}>
        {children}
      </button>
    ),
    span: ({ children, className, ...props }: any) => (
      <span className={className} {...props}>
        {children}
      </span>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

class MockSpeechSynthesisUtterance {
  text: string;
  lang = 'en-US';
  rate = 1.0;
  volume = 1.0;
  pitch = 1.0;
  voice = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((err: any) => void) | null = null;
  onboundary: ((evt: any) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

describe('PHASE 4: Reading & Listening Session Experience Integration Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    const mockSpeak = vi.fn();
    const mockCancel = vi.fn();
    (window as any).speechSynthesis = {
      speak: mockSpeak,
      cancel: mockCancel,
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: () => [],
      speaking: false,
      paused: false,
      pending: false,
    };
    (window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    (window as any).alert = vi.fn();
    window.scrollTo = vi.fn();

    useAppStore.setState({
      srsProgressMap: {},
      userCustomWords: [],
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      activeFourSkill: 'reading',
      activePracticeConfig: null,
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      profile: {
        ...useAppStore.getState().profile,
        name: 'Learner',
        level: 1,
        xp: 0,
        streak: 5, // App-level streak
      },
      resumeActivities: {},
      completedListeningLessonIds: [],
    });
  });

  describe('1. Reading Before Session & Intro UX', () => {
    it('renders truthful dataset values in SessionIntro (CEFR, title, readTime, question count)', () => {
      render(<FourSkillsView />);

      const firstLesson = READING_LESSONS[0];
      const lessonCard = screen.getByText(firstLesson.title).closest('.group');
      expect(lessonCard).not.toBeNull();
      fireEvent.click(lessonCard!);

      // Verify SessionIntro renders
      const intro = screen.getByTestId('session-intro');
      expect(intro).toBeTruthy();

      // Title & badge
      expect(within(intro).getByText(firstLesson.title)).toBeTruthy();
      expect(within(intro).getByText(new RegExp(`Reading ${firstLesson.level}`, 'i'))).toBeTruthy();
      expect(within(intro).getByText(firstLesson.readTime)).toBeTruthy();
      expect(within(intro).getByText(firstLesson.summary)).toBeTruthy();
      expect(within(intro).getByText(new RegExp(`${firstLesson.questions.length} câu trắc nghiệm`))).toBeTruthy();
    });

    it('prioritizes Today Hub plan metadata when launched via activePracticeConfig', () => {
      useAppStore.setState({ activeFourSkill: 'reading' });
      useAppStore.getState().startAdaptivePractice({
        module: 'reading',
        itemIds: [READING_LESSONS[0].id],
        planTitle: 'Kế Hoạch Đọc Hiểu B2 Mục Tiêu',
        planObjective: 'Đọc văn bản chuyên ngành và trả lời trắc nghiệm nhanh.',
        estimatedMinutes: 8,
        planItemId: 'today_task_reading_1',
      });

      render(<FourSkillsView />);

      const intro = screen.getByTestId('session-intro');
      expect(within(intro).getByText('Kế Hoạch Đọc Hiểu B2 Mục Tiêu')).toBeTruthy();
      expect(within(intro).getByText('Đọc văn bản chuyên ngành và trả lời trắc nghiệm nhanh.')).toBeTruthy();
      expect(within(intro).getByText('~10 phút')).toBeTruthy();
      expect(within(intro).getByText('Kế hoạch hôm nay')).toBeTruthy();

      // Config should be consumed immediately
      expect(useAppStore.getState().activePracticeConfig).toBeNull();
    });

    it('renders truthful resume banner when prior unfinished activity is resumed', () => {
      const lesson = READING_LESSONS[0];
      useAppStore.setState({
        activeFourSkill: 'reading',
        resumeActivities: {
          [`reading_${lesson.id}`]: {
            id: `reading_${lesson.id}`,
            type: 'reading',
            title: lesson.title,
            startedAt: Date.now() - 5000,
            lastActiveAt: Date.now() - 1000,
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              lessonId: lesson.id,
              answers: { [lesson.questions[0].id]: lesson.questions[0].correctIndex },
              totalQuestions: lesson.questions.length,
              progressPercent: Math.round((1 / lesson.questions.length) * 100),
            },
          },
        },
      });

      render(<FourSkillsView />);

      // Click resume button from catalog top banner
      const resumeBtn = screen.getByTestId('btn-resume-activity');
      expect(resumeBtn).toBeTruthy();
      fireEvent.click(resumeBtn);

      const resumeBanner = screen.getByTestId('reading-resume-banner');
      expect(resumeBanner).toBeTruthy();
      expect(within(resumeBanner).getByText('Tiếp tục bài học')).toBeTruthy();
      expect(within(resumeBanner).getByText(new RegExp(`Đã làm 1 / ${lesson.questions.length} câu`))).toBeTruthy();
    });
  });

  describe('2. Reading During Session (Progress Header & Ephemeral Streak)', () => {
    it('progress header reflects actual answered questions (counterFormat: answered)', () => {
      render(<FourSkillsView />);
      const lesson = READING_LESSONS[0];
      const lessonCard = screen.getByText(lesson.title).closest('.group');
      fireEvent.click(lessonCard!);

      const header = screen.getByTestId('session-progress-header');
      expect(within(header).getByText(`0 / ${lesson.questions.length}`)).toBeTruthy();

      // Answer question 0
      const q0 = lesson.questions[0];
      const optBtn = screen.getByText(q0.options[q0.correctIndex]);
      fireEvent.click(optBtn);

      // Now 1 / total answered
      expect(within(header).getByText(`1 / ${lesson.questions.length}`)).toBeTruthy();
    });

    it('displays micro-feedback toast upon answering a question', () => {
      render(<FourSkillsView />);
      const lesson = READING_LESSONS[0];
      const lessonCard = screen.getByText(lesson.title).closest('.group');
      fireEvent.click(lessonCard!);

      const q0 = lesson.questions[0];
      fireEvent.click(screen.getByText(q0.options[q0.correctIndex]));

      const microFeedback = screen.getByTestId('session-micro-feedback');
      expect(microFeedback).toBeTruthy();
      expect(microFeedback.textContent).toContain('Đã chọn đáp án');
    });

    it('correctness streak is strictly ephemeral on completion and never mutates profile.streak', () => {
      const initialProfileStreak = useAppStore.getState().profile.streak;
      expect(initialProfileStreak).toBe(5);

      render(<FourSkillsView />);
      const lesson = READING_LESSONS[0];
      const lessonCard = screen.getByText(lesson.title).closest('.group');
      fireEvent.click(lessonCard!);

      // Answer all correctly
      lesson.questions.forEach((q) => {
        fireEvent.click(screen.getByText(q.options[q.correctIndex]));
      });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Nộp Bài Đọc Hiểu/i });
      fireEvent.click(submitBtn);

      // Ephemeral streak inside SessionProgressHeader shows correct count
      const streakEl = screen.getByTestId('session-streak-badge');
      expect(streakEl.textContent).toContain(`Streak ${lesson.questions.length}`);

      // Crucial invariant: profile.streak must remain untouched
      expect(useAppStore.getState().profile.streak).toBe(5);
    });
  });

  describe('3. Reading Completion, Summary & Next Action Routing', () => {
    it('submits quiz, displays SessionCompleteSummary with real metrics, and cleans up continuity', () => {
      const mockNavigate = vi.fn();
      render(<FourSkillsView onNavigate={mockNavigate} />);
      const lesson = READING_LESSONS[0];
      const lessonCard = screen.getByText(lesson.title).closest('.group');
      fireEvent.click(lessonCard!);

      // Answer all questions correctly
      lesson.questions.forEach((q) => {
        fireEvent.click(screen.getByText(q.options[q.correctIndex]));
      });

      // Submit quiz
      const submitBtn = screen.getByRole('button', { name: /Nộp Bài Đọc Hiểu/i });
      fireEvent.click(submitBtn);

      // Summary should appear
      const summary = screen.getByTestId('session-complete-summary');
      expect(summary).toBeTruthy();

      // Truthful metrics
      expect(within(summary).getByText(new RegExp(`Chính xác \\(${lesson.questions.length}/${lesson.questions.length} câu\\)`))).toBeTruthy();
      expect(within(summary).getAllByText('100%').length).toBeGreaterThan(0);

      // Continuity activity should be marked completed / cleaned up
      const resumeAct = useAppStore.getState().resumeActivities[`reading_${lesson.id}`];
      expect(!resumeAct || resumeAct.completed).toBe(true);

      // Next Action: Quay lại kế hoạch hôm nay
      const nextActionBtn = screen.getByRole('button', { name: /Tiếp tục Kế Hoạch Hôm Nay/i });
      expect(nextActionBtn).toBeTruthy();
      fireEvent.click(nextActionBtn);
      expect(mockNavigate).toHaveBeenCalledWith('dashboard');
    });
  });

  describe('4. Listening Before Session & Audio Preservation', () => {
    beforeEach(() => {
      useAppStore.setState({ activeFourSkill: 'listening' });
    });

    it('renders truthful dataset values in SessionIntro for listening lesson', () => {
      render(<FourSkillsView />);
      const lesson = LISTENING_LESSONS[0];
      const lessonCard = screen.getByText(lesson.title).closest('.group');
      expect(lessonCard).not.toBeNull();
      fireEvent.click(lessonCard!);

      const intro = screen.getByTestId('session-intro');
      expect(intro).toBeTruthy();
      expect(within(intro).getByText(lesson.title)).toBeTruthy();
      expect(within(intro).getByText(new RegExp(`Listening ${lesson.level}`, 'i'))).toBeTruthy();
      expect(within(intro).getByText(lesson.description)).toBeTruthy();
      expect(within(intro).getByText(`${lesson.duration} audio`)).toBeTruthy();
    });

    it('does not persist runtime audio objects or elements to resume state', () => {
      render(<FourSkillsView />);
      const lesson = LISTENING_LESSONS[0];
      const lessonCard = screen.getByText(lesson.title).closest('.group');
      fireEvent.click(lessonCard!);

      // Select an answer
      const q0 = lesson.questions[0];
      const optBtn = screen.getByText(q0.options[q0.correctIndex]);
      fireEvent.click(optBtn);

      // Inspect persisted checkpoint in store
      const act = useAppStore.getState().resumeActivities[`listening_${lesson.id}`];
      expect(act).toBeTruthy();
      const cp = act.checkpoint as any;
      expect(cp.lessonId).toBe(lesson.id);
      // Ensure only serializable primitives are stored (no Audio objects, no DOM elements)
      expect(cp.audioElement).toBeUndefined();
      expect(cp.speechUtterance).toBeUndefined();
      expect(Object.keys(cp.answers).length).toBe(1);
      expect(typeof cp.progressPercent).toBe('number');
    });

    it('progress header updates with answeredCount and provides Next Action on completion', () => {
      const mockNavigate = vi.fn();
      render(<FourSkillsView onNavigate={mockNavigate} />);
      const lesson = LISTENING_LESSONS[0];
      const lessonCard = screen.getByText(lesson.title).closest('.group');
      fireEvent.click(lessonCard!);

      const header = screen.getByTestId('session-progress-header');
      expect(within(header).getByText(`0 / ${lesson.questions.length}`)).toBeTruthy();

      // Answer all questions
      lesson.questions.forEach((q) => {
        const btn = screen.getByText(q.options[q.correctIndex]);
        fireEvent.click(btn);
      });

      // Header shows all answered
      expect(within(header).getByText(`${lesson.questions.length} / ${lesson.questions.length}`)).toBeTruthy();

      // Submit
      const submitBtn = screen.getByText('Nộp Bài Kiểm Tra (+30 XP)');
      fireEvent.click(submitBtn);

      // Result summary with Next Action to Today Hub
      const todayHubBtn = screen.getByTestId('btn-next-action-today-hub');
      expect(todayHubBtn).toBeTruthy();
      fireEvent.click(todayHubBtn);
      expect(mockNavigate).toHaveBeenCalledWith('dashboard');
    });
  });
});
