// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import confetti from 'canvas-confetti';
import { Dashboard } from '../Dashboard';
import { FlashcardDeck } from '../FlashcardDeck';
import { FourSkillsView } from '../FourSkillsView';
import { TodayLearningPlanWidget } from '../TodayLearningPlanWidget';
import { ContinueLearningSection } from '../ContinueLearningSection';
import { LearningJourneyProgressionMap } from '../fourSkills/LearningJourneyProgressionMap';
import { useAppStore, clearUnifiedCardsCache } from '../../store/useAppStore';
import { triggerCelebration } from '../../utils/confettiPolicy';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('PHASE 2: Core Learning UX Micro-Interaction & Motion Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    clearUnifiedCardsCache();

    useAppStore.setState({
      profile: {
        name: 'Hoang Learner',
        level: 5,
        xp: 1000,
        streak: 7,
        lastActiveDate: '2026-10-06',
        lastStudyDate: '2026-10-06',
        hearts: 5,
        maxHearts: 5,
        avatarSeed: 'Learner',
        targetDailyWords: 15,
        targetDailyNewWords: 15,
        extraNewWordsBonus: 0,
        isOnboarded: true,
        targetGoal: 'daily',
        geminiApiKey: '',
        equippedFrame: null,
        unlockedFrames: [],
      },
      vocabularyList: [
        {
          id: 'card-1',
          word: 'ubiquitous',
          meaning: 'phổ biến khắp nơi',
          ipa: '/juːˈbɪk.wɪ.təs/',
          partOfSpeech: 'adj',
          example: 'Smartphones are ubiquitous nowadays.',
          tag: 'Daily',
          srsLevel: 0,
          interval: 0,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-06',
        },
        {
          id: 'card-2',
          word: 'resilient',
          meaning: 'kiên cường',
          ipa: '/rɪˈzɪl.jənt/',
          partOfSpeech: 'adj',
          example: 'She is a resilient person.',
          tag: 'Daily',
          srsLevel: 0,
          interval: 0,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-06',
        },
      ],
      srsProgressMap: {},
      mistakeBank: {},
      dailyHistory: {
        '2026-10-06': {
          date: '2026-10-06',
          wordsReviewed: 25,
          newWordsLearned: 5,
          quizzesCompleted: 2,
          pronunciationsMastered: 1,
          xpGained: 150,
        },
      },
      activeFourSkill: 'listening',
      fourSkillsCompletionProgress: {
        reading: [],
        speaking: ['speak-1'],
        writing: [],
      },
      completedListeningLessonIds: ['listen-1'],
      resumeActivities: {},
      isHydrated: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Dashboard XP Delta Badge & Motion Safety', () => {
    it('does NOT render XP delta badge on initial mount or page reload', () => {
      render(<Dashboard onNavigate={vi.fn()} onOpenAddWord={vi.fn()} />);

      // Badge must be null on initial mount
      const badge = screen.queryByTestId('xp-delta-badge');
      expect(badge).toBeNull();
    });

    it('renders ephemeral +XP badge on XP gain and clears automatically after timeout', () => {
      render(<Dashboard onNavigate={vi.fn()} onOpenAddWord={vi.fn()} />);

      expect(screen.queryByTestId('xp-delta-badge')).toBeNull();

      // Trigger XP gain in store during the active user session
      act(() => {
        useAppStore.getState().gainXP(50);
      });

      const badge = screen.getByTestId('xp-delta-badge');
      expect(badge).toBeDefined();
      expect(badge.textContent).toMatch(/\+\d+\s*XP/);
      expect(badge.className).toContain('animate-fadeIn');
      expect(badge.className).toContain('motion-reduce:animate-none');

      // Fast-forward past timeout (2500ms)
      act(() => {
        vi.advanceTimersByTime(2600);
      });

      expect(screen.queryByTestId('xp-delta-badge')).toBeNull();
    });

    it('EXP progress bar and skill bars include motion-reduce:transition-none', () => {
      const { container } = render(<Dashboard onNavigate={vi.fn()} onOpenAddWord={vi.fn()} />);

      const progressBar = container.querySelector('.bg-gradient-to-r.from-amber-400.via-orange-400');
      expect(progressBar).toBeDefined();
      expect(progressBar?.className).toContain('motion-reduce:transition-none');
    });

    it('Daily Quests and Golden Chest claim buttons contain tactile active classes and motion-reduce', () => {
      render(<Dashboard onNavigate={vi.fn()} onOpenAddWord={vi.fn()} />);

      // Quest 1 is done in test state (quizzesCompleted: 2)
      const claimBtn = screen.getByText('Nhận +50 XP');
      expect(claimBtn.className).toContain('active:scale-[0.97]');
      expect(claimBtn.className).toContain('motion-reduce:transform-none');
      expect(claimBtn.className).toContain('focus-visible:ring-2');

      // Claiming quest triggers confetti via triggerCelebration policy
      fireEvent.click(claimBtn);
      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({
          disableForReducedMotion: true,
        })
      );
    });
  });

  describe('2. Flashcard Deck Tactile Feedback & Invariants', () => {
    it('maintains 3D flip architecture and backface visibility invariants', () => {
      const { container } = render(<FlashcardDeck onNavigate={vi.fn()} />);

      // Start session to reveal active card
      const startBtn = screen.getByTestId('btn-start-session');
      fireEvent.click(startBtn);

      const flipContainer = container.querySelector('.transform-style-3d');
      expect(flipContainer).toBeDefined();

      const backFace = container.querySelector('.backface-hidden.rotate-y-180');
      expect(backFace).toBeDefined();
    });

    it('navigation buttons have tactile press classes and reduced motion support', () => {
      render(<FlashcardDeck onNavigate={vi.fn()} />);

      // Start session
      const startBtn = screen.getByTestId('btn-start-session');
      fireEvent.click(startBtn);

      const flipBtn = screen.getByTestId('btn-flip-card');
      expect(flipBtn.className).toContain('active:scale-[0.98]');
      expect(flipBtn.className).toContain('motion-reduce:transform-none');

      const nextBtn = screen.getByTestId('btn-next-card');
      expect(nextBtn.className).toContain('active:scale-[0.98]');
      expect(nextBtn.className).toContain('motion-reduce:transform-none');
    });

    it('rating buttons appear on flip with tactile active classes and zero CLS layout consistency', () => {
      render(<FlashcardDeck onNavigate={vi.fn()} />);

      // Start session
      const startBtn = screen.getByTestId('btn-start-session');
      fireEvent.click(startBtn);

      // Initially front face, rating buttons not in document
      expect(screen.queryByTestId('btn-grade-again')).toBeNull();

      // Flip card
      const flipBtn = screen.getByTestId('btn-flip-card');
      fireEvent.click(flipBtn);

      const againBtn = screen.getByTestId('btn-grade-again');
      const hardBtn = screen.getByTestId('btn-grade-hard');
      const goodBtn = screen.getByTestId('btn-grade-good');
      const easyBtn = screen.getByTestId('btn-grade-easy');

      // Verify tactile press classes
      expect(againBtn.className).toContain('active:scale-[0.97]');
      expect(againBtn.className).toContain('motion-reduce:transform-none');
      expect(againBtn.className).toContain('min-h-[76px]'); // Zero CLS invariant

      expect(hardBtn.className).toContain('active:scale-[0.97]');
      expect(goodBtn.className).toContain('active:scale-[0.97]');
      expect(easyBtn.className).toContain('active:scale-[0.97]');
    });

    it('routine flashcard ratings do NOT trigger confetti (micro-tier celebration invariant)', () => {
      render(<FlashcardDeck onNavigate={vi.fn()} />);

      // Start session
      const startBtn = screen.getByTestId('btn-start-session');
      fireEvent.click(startBtn);

      const flipBtn = screen.getByTestId('btn-flip-card');
      fireEvent.click(flipBtn);

      const goodBtn = screen.getByTestId('btn-grade-good');
      fireEvent.click(goodBtn);

      // Single card rating should NOT trigger confetti
      expect(confetti).not.toHaveBeenCalled();
    });
  });

  describe('3. Four Skills Navigation & Micro-Action Celebration Protection', () => {
    it('four skill tabs contain tactile feedback and reduced-motion classes', () => {
      render(<FourSkillsView onNavigate={vi.fn()} />);

      const listeningTab = screen.getByText('🎧 Luyện Nghe').closest('button');
      const readingTab = screen.getByText('📖 Luyện Đọc').closest('button');
      const speakingTab = screen.getByText('🗣️ Luyện Nói').closest('button');
      const writingTab = screen.getByText('✍️ Luyện Viết').closest('button');

      expect(listeningTab?.className).toContain('active:scale-[0.98]');
      expect(listeningTab?.className).toContain('motion-reduce:transform-none');

      expect(readingTab?.className).toContain('active:scale-[0.98]');
      expect(speakingTab?.className).toContain('active:scale-[0.98]');
      expect(writingTab?.className).toContain('active:scale-[0.98]');
    });

    it('single word addition micro-action does NOT pop confetti per policy', () => {
      // Direct policy evaluation verifies that micro events block confetti
      const result = triggerCelebration('micro');
      expect(result).toBe(false);
      expect(confetti).not.toHaveBeenCalled();
    });
  });

  describe('4. Additional Core Learning UX Motion Standardizations', () => {
    it('TodayLearningPlanWidget review/nav buttons include tactile active classes and motion-reduce', () => {
      const mockPlan = {
        date: '2026-10-06',
        items: [
          {
            id: 'item-1',
            type: 'srs_due' as const,
            title: 'Ôn tập 15 thẻ',
            description: 'SRS flashcard due',
            count: 15,
            estimatedMinutes: 5,
            priority: 1,
            priorityScore: 100,
            tier: 'essential' as const,
            reason: 'SRS due',
            action: { tab: 'flashcards' as const },
            completed: false,
          },
        ],
        totalEstimatedMinutes: 5,
        totalTasks: 1,
        completedTasks: 0,
        progress: 0,
        workloadBand: 'normal' as const,
        isHeavyDay: false,
        allCompleted: false,
      };

      render(
        <TodayLearningPlanWidget
          plan={mockPlan}
          onNavigate={vi.fn()}
          onStartAdaptivePractice={vi.fn()}
          setActiveFourSkill={vi.fn()}
          userName="Hoang"
          isHydrated={true}
        />
      );

      const actionBtn = screen.getByText('Bắt đầu').closest('button');
      expect(actionBtn).toBeDefined();
      expect(actionBtn?.className).toContain('active:scale-[0.98]');
      expect(actionBtn?.className).toContain('motion-reduce:transform-none');
    });

    it('ContinueLearningSection resumable card buttons include active:scale-[0.98] and focus rings', () => {
      useAppStore.setState({
        resumeActivities: {
          flashcard_active: {
            id: 'flashcard_active',
            type: 'flashcard',
            title: 'Phiên ôn tập Flashcard',
            startedAt: Date.now() - 10000,
            lastActiveAt: Date.now() - 5000,
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              queueMode: 'DUE',
              progressPercent: 50,
              reviewedCount: 5,
              totalCards: 10,
              currentIndex: 5,
            },
          },
        },
      });

      render(
        <ContinueLearningSection
          onNavigate={vi.fn()}
          setActiveFourSkill={vi.fn()}
        />
      );

      const resumeBtn = screen.getByTestId('btn-continue-learning');
      expect(resumeBtn).toBeDefined();
      expect(resumeBtn.className).toContain('active:scale-[0.98]');
      expect(resumeBtn.className).toContain('motion-reduce:transform-none');
      expect(resumeBtn.className).toContain('focus-visible:ring-2');
    });

    it('LearningJourneyProgressionMap milestone buttons include tactile classes and motion-reduce', () => {
      render(
        <LearningJourneyProgressionMap
          onSelectLesson={vi.fn()}
        />
      );

      const heroBtn = screen.getByText(/Học tiếp bài này|Bắt đầu hành trình|Tiếp tục bài học/).closest('button');
      expect(heroBtn).toBeDefined();
      expect(heroBtn?.className).toContain('active:scale-[0.98]');
      expect(heroBtn?.className).toContain('motion-reduce:transform-none');
    });
  });
});
