// @vitest-environment happy-dom
// src/components/__tests__/ContinueLearningPhase6.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContinueLearningSection, formatRelativeTimeVi, getProgressLabel } from '../ContinueLearningSection';
import { AITutorView } from '../AITutorView';
import { useAppStore } from '../../store/useAppStore';
import { generateTodayLearningPlan } from '../../services/todayLearningPlanService';
import { saveTutorSession, loadTutorSession, clearTutorSession } from '../../services/tutorSessionStorage';
import type { ResumableActivity } from '../../types/learningContinuity';
import { LISTENING_LESSONS } from '../../data/fourSkills/listeningData';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock confetti and speech
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../../services/speechService', () => ({
  speakWord: vi.fn(),
  createSpeechRecognizer: vi.fn(),
}));

// Mock geminiService
vi.mock('../../services/geminiService', () => ({
  ROLEPLAY_SCENARIOS: [
    {
      id: 'tech_interview',
      title: 'Phỏng vấn Tech Lead & System Design',
      role: 'Ứng viên (Senior Engineer)',
      aiRole: 'Hội đồng phỏng vấn (Interviewer)',
      badge: 'C1 Professional',
      level: 'C1',
      description: 'Thực hành trả lời câu hỏi System Design và leadership.',
      initialMessage: 'Welcome to our technical interview! Can you introduce yourself?',
      steps: ['Self-intro', 'Architecture', 'Trade-offs'],
      icon: '💼',
    },
    {
      id: 'daily_standup',
      title: 'Daily Standup Agile/Scrum',
      role: 'Software Developer',
      aiRole: 'Scrum Master',
      badge: 'B2 Intermediate',
      level: 'B2',
      description: 'Báo cáo 3 câu hỏi Daily Scrum.',
      initialMessage: 'Good morning! What did you work on yesterday?',
      steps: ['Yesterday', 'Today', 'Blockers'],
      icon: '☕',
    },
  ],
  generateAIResponse: vi.fn(),
}));

// Mock tutorFeedbackBridge to monitor anti-double-ingestion invariant
vi.mock('../../services/tutorFeedbackBridge', () => ({
  ingestTutorFeedback: vi.fn(),
}));

import { ingestTutorFeedback } from '../../services/tutorFeedbackBridge';

describe('PHASE 6: Continue Learning & AI Tutor Resume UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    useAppStore.getState().resetToDefault();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Part A: formatRelativeTimeVi & getProgressLabel', () => {
    it('formats relative time accurately in Vietnamese', () => {
      const now = 10000000;
      expect(formatRelativeTimeVi(now - 10000, now)).toBe('Vừa xong');
      expect(formatRelativeTimeVi(now - 120000, now)).toBe('Đã học 2 phút trước');
      expect(formatRelativeTimeVi(now - 3600000 * 3, now)).toBe('Đã học 3 giờ trước');
      expect(formatRelativeTimeVi(now - 86400000 * 2, now)).toBe('Đã học 2 ngày trước');
    });

    it('formats honest progress labels without fake percentages for open-ended sessions', () => {
      const tutorAct: ResumableActivity = {
        id: 'tutor_tech_interview',
        type: 'tutor',
        title: 'Tech Interview',
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          sessionId: 'tech_interview',
          scenarioId: 'tech_interview',
          turnCount: 7,
        },
      };
      expect(getProgressLabel(tutorAct)).toBe('7 lượt hội thoại');

      const flashcardAct: ResumableActivity = {
        id: 'flashcard_DUE',
        type: 'flashcard',
        title: 'Flashcard Review',
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          sessionId: 'sess_1',
          queueMode: 'DUE',
          orderedCardIds: ['w1', 'w2'],
          currentIndex: 1,
          reviewedCardIds: ['w1'],
          reviewedCount: 14,
          totalCards: 30,
        },
      };
      expect(getProgressLabel(flashcardAct)).toBe('14/30 thẻ đã học');

      const toeicAct: ResumableActivity = {
        id: 'toeic_exam_1',
        type: 'toeic',
        title: 'TOEIC Mini',
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          attemptId: 'att_1',
          examMode: '2skills_mini',
          experienceMode: 'diagnostic',
          skillScope: '2-skills',
          currentQuestionIdx: 5,
          totalQuestions: 20,
          answeredCount: 5,
          timeLeftSeconds: 600,
          userAnswers: {},
        },
      };
      expect(getProgressLabel(toeicAct)).toBe('5/20 câu đã làm');
    });
  });

  describe('Part B: ContinueLearningSection Dashboard Component', () => {
    it('returns null when there are zero resumable activities (Zero Empty Card Invariant)', () => {
      const onNavigate = vi.fn();
      const { container } = render(<ContinueLearningSection onNavigate={onNavigate} />);
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('continue-learning-section')).toBeNull();
    });

    it('renders primary card and secondary cards when activities exist', () => {
      const now = Date.now();
      useAppStore.setState({
        resumeActivities: {
          reading_b2_1: {
            id: 'reading_b2_1',
            type: 'reading',
            title: 'Remote Work Trends',
            subtitle: 'Reading B2',
            startedAt: now - 100000,
            lastActiveAt: now - 20000, // Most recent -> Primary
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              lessonId: 'b2_1',
              answers: {},
              totalQuestions: 4,
              progressPercent: 65,
            },
          },
          tutor_daily: {
            id: 'tutor_daily',
            type: 'tutor',
            title: 'Daily Standup Agile',
            subtitle: '3 lượt hội thoại',
            startedAt: now - 200000,
            lastActiveAt: now - 80000, // Secondary 1
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              sessionId: 'daily_standup',
              scenarioId: 'daily_standup',
              turnCount: 3,
            },
          },
        },
      });

      const onNavigate = vi.fn();
      const setActiveFourSkill = vi.fn();

      render(
        <ContinueLearningSection
          onNavigate={onNavigate}
          setActiveFourSkill={setActiveFourSkill}
        />
      );

      expect(screen.getByTestId('continue-learning-section')).toBeTruthy();
      expect(screen.getByTestId('btn-continue-learning')).toBeTruthy();
      expect(screen.getByText('Remote Work Trends')).toBeTruthy();
      expect(screen.getByText('65% hoàn thành')).toBeTruthy();

      // Click primary card
      fireEvent.click(screen.getByTestId('btn-continue-learning'));
      expect(setActiveFourSkill).toHaveBeenCalledWith('reading');
      expect(onNavigate).toHaveBeenCalledWith('four_skills');

      // Click secondary card
      const secondaryBtn = screen.getByTestId('btn-continue-tutor_daily');
      expect(secondaryBtn).toBeTruthy();
      fireEvent.click(secondaryBtn);
      expect(onNavigate).toHaveBeenCalledWith('tutor');
    });
  });

  describe('Part C & A: AI Tutor Continuity & Anti-Double-Ingestion Invariant', () => {
    it('restores previous conversation and memory on mount without calling ingestTutorFeedback or gainXP', () => {
      const savedMessages = [
        {
          id: 'ai_1',
          sender: 'ai' as const,
          text: 'Welcome to our interview!',
          timestamp: '09:00',
        },
        {
          id: 'user_1',
          sender: 'user' as const,
          text: 'Thank you, I have 8 years of experience.',
          timestamp: '09:01',
        },
        {
          id: 'ai_2',
          sender: 'ai' as const,
          text: 'Great! How do you handle database sharding?',
          timestamp: '09:02',
        },
      ];

      const initialXP = useAppStore.getState().profile.xp;

      // Seed session layer
      saveTutorSession('tech_interview', savedMessages, {
        turnCount: 2,
        targetPracticeCounts: { sharding: 1 },
        masteredTargets: [],
        recentMistakes: [],
        currentTarget: 'sharding',
      });

      render(<AITutorView />);

      // Should display saved messages
      expect(screen.getByText('Thank you, I have 8 years of experience.')).toBeTruthy();
      expect(screen.getByText('Great! How do you handle database sharding?')).toBeTruthy();

      // CRITICAL INVARIANT: Zero double-ingestion upon session restore!
      expect(ingestTutorFeedback).not.toHaveBeenCalled();
      expect(useAppStore.getState().profile.xp).toBe(initialXP);
    });

    it('renders resume banner when another scenario has an in-progress session and switches cleanly', async () => {
      // Seed an active tutor resume activity for daily_standup
      const now = Date.now();
      useAppStore.setState({
        resumeActivities: {
          tutor_daily_standup: {
            id: 'tutor_daily_standup',
            type: 'tutor',
            title: 'AI Tutor: Daily Standup Agile/Scrum',
            subtitle: '4 lượt hội thoại',
            startedAt: now - 30000,
            lastActiveAt: now - 10000,
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              sessionId: 'daily_standup',
              scenarioId: 'daily_standup',
              turnCount: 4,
              lastMessageSummary: 'I resolved the blocking issue yesterday.',
            },
          },
        },
      });

      saveTutorSession('daily_standup', [
        { id: 'u1', sender: 'user', text: 'I resolved the blocking issue yesterday.', timestamp: '10:00' },
      ], {
        turnCount: 1,
        targetPracticeCounts: {},
        masteredTargets: [],
        recentMistakes: [],
      });

      render(<AITutorView />);

      // Selected scenario is tech_interview by default, so banner for daily_standup should be visible
      expect(screen.getByTestId('tutor-resume-banner')).toBeTruthy();
      expect(screen.getAllByText(/Daily Standup Agile\/Scrum/i).length).toBeGreaterThan(0);

      // Click "Tiếp tục phiên này"
      fireEvent.click(screen.getByTestId('btn-resume-tutor'));

      // Should switch scenario and restore daily standup conversation
      await waitFor(() => {
        expect(screen.getByText('I resolved the blocking issue yesterday.')).toBeTruthy();
      });

      // Banner should disappear because we are now on daily_standup
      expect(screen.queryByTestId('tutor-resume-banner')).toBeNull();
    });

    it('handleResetChat clears tutor session and removes resume activity without destroying learning history', () => {
      saveTutorSession('tech_interview', [
        { id: 'u1', sender: 'user', text: 'Some text', timestamp: '10:00' },
      ], {
        turnCount: 1,
        targetPracticeCounts: {},
        masteredTargets: [],
        recentMistakes: [],
      });

      useAppStore.setState({
        resumeActivities: {
          tutor_tech_interview: {
            id: 'tutor_tech_interview',
            type: 'tutor',
            title: 'AI Tutor: Tech Interview',
            startedAt: Date.now(),
            lastActiveAt: Date.now(),
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              sessionId: 'tech_interview',
              scenarioId: 'tech_interview',
              turnCount: 1,
            },
          },
        },
        mistakeBank: {
          word_sharding: {
            id: 'word_sharding',
            word: 'sharding',
            ipa: '/ˈʃɑːrdɪŋ/',
            meaning: 'Phân mảnh dữ liệu',
            mistakeCount: 2,
            consecutiveCorrect: 0,
            resolved: false,
            tag: 'Daily',
            source: 'ai_tutor',
            primaryType: 'meaning',
            lastMistakeAt: new Date().toISOString(),
          },
        },
      });

      render(<AITutorView />);

      const resetBtn = screen.getByTitle('Bắt đầu lại cuộc trò chuyện này');
      fireEvent.click(resetBtn);

      // Session storage cleared
      expect(loadTutorSession('tech_interview')).toBeNull();

      // Resume activity removed
      expect(useAppStore.getState().resumeActivities['tutor_tech_interview']).toBeUndefined();

      // Learning history preserved!
      expect(useAppStore.getState().mistakeBank['word_sharding']).toBeDefined();
    });
  });

  describe('Part D: Today Hub Continuity Deduplication', () => {
    it('deduplicates active flashcard session with raw srs-due reviews', () => {
      const now = Date.now();
      const plan = generateTodayLearningPlan({
        now,
        srsProgressMap: {
          apple: {
            srsLevel: 2,
            nextReviewDate: new Date(now - 1000).toISOString(),
            reviewCount: 3,
            interval: 1,
            easeFactor: 2.5,
          },
          banana: {
            srsLevel: 2,
            nextReviewDate: new Date(now - 1000).toISOString(),
            reviewCount: 3,
            interval: 1,
            easeFactor: 2.5,
          },
        },
        resumeActivities: {
          flashcard_DUE: {
            id: 'flashcard_DUE',
            type: 'flashcard',
            title: 'Flashcards',
            startedAt: now - 30000,
            lastActiveAt: now - 5000,
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              sessionId: 'sess_due',
              queueMode: 'DUE',
              orderedCardIds: ['apple', 'banana'],
              currentIndex: 1,
              reviewedCardIds: ['apple'],
              reviewedCount: 1,
              totalCards: 2,
            },
          },
        },
      });

      // Should have only 1 srs review task
      const srsTasks = plan.items.filter((item) => item.type === 'srs_review');
      expect(srsTasks).toHaveLength(1);

      // The task should be labeled as continuation with priority 92
      const task = srsTasks[0];
      expect(task.title).toContain('Tiếp tục phiên Flashcard (1/2 thẻ)');
      expect(task.priorityScore).toBe(92);
      expect(task.action.params?.queueMode).toBe('DUE');
    });

    it('personalizes next reading lesson when user has an active reading session', () => {
      const now = Date.now();
      const plan = generateTodayLearningPlan({
        now,
        completedListeningLessonIds: LISTENING_LESSONS.map((l) => l.id),
        completedReadingLessonIds: [],
        resumeActivities: {
          reading_read_a1_1: {
            id: 'reading_read_a1_1',
            type: 'reading',
            title: 'My Daily Morning Routine',
            startedAt: now - 40000,
            lastActiveAt: now - 10000,
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              lessonId: 'read_a1_1',
              answers: {},
              totalQuestions: 4,
              progressPercent: 60,
            },
          },
        },
      });

      const readingTask = plan.items.find((item) => item.id.startsWith('skill-reading-read_a1_1'));
      expect(readingTask).toBeDefined();
      expect(readingTask?.title).toContain('Tiếp tục bài Đọc');
      expect(readingTask?.title).toContain('60%');
      expect(readingTask?.priorityScore).toBe(55);
    });
  });
});
