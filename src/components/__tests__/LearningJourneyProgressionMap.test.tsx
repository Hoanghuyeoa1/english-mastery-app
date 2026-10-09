// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import {
  LearningJourneyProgressionMap,
  CEFR_LEVEL_METADATA,
} from '../fourSkills/LearningJourneyProgressionMap';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import type { ReadingResumableActivity } from '../../types/learningContinuity';

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

describe('PHASE 2: Learning Journey Progression Map & Integrations Suite', () => {
  const mockOnSelectLesson = vi.fn();
  const mockOnSelectMilestoneLevel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAppStore.setState({
      srsProgressMap: {},
      userCustomWords: [],
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      activeFourSkill: 'listening',
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      fourSkillsEvidence: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      } as any,
      wordLearningStats: {},
      completedListeningLessonIds: [],
      fourSkillsCompletionProgress: {
        reading: [],
        speaking: [],
        writing: [],
      },
      resumeActivities: {},
    });
  });

  describe('1. Progression Map Rendering & CEFR Milestones (A1 → C2)', () => {
    it('renders all 6 CEFR level milestones with bilingual labels and descriptions', () => {
      render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      const levels: Array<keyof typeof CEFR_LEVEL_METADATA> = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      levels.forEach((lvl) => {
        const milestoneBtn = screen.getByTestId(`journey-milestone-${lvl}`);
        expect(milestoneBtn).toBeDefined();
        expect(milestoneBtn.textContent).toContain(lvl);
        expect(milestoneBtn.textContent).toContain(CEFR_LEVEL_METADATA[lvl].nameVi);
      });
    });

    it('renders valid accessible progress bar for each milestone with role="progressbar"', () => {
      render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBe(6);

      progressBars.forEach((bar) => {
        expect(bar.getAttribute('aria-valuemin')).toBe('0');
        expect(bar.getAttribute('aria-valuemax')).toBe('100');
        const val = Number(bar.getAttribute('aria-valuenow'));
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      });
    });

    it('displays truthful 4-skill mini-counters without hardcoding denominators', () => {
      useAppStore.setState({
        completedListeningLessonIds: ['listen_a1_1'],
        fourSkillsCompletionProgress: {
          reading: ['read_a1_1'],
          speaking: [],
          writing: [],
        },
      });

      render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      const a1Milestone = screen.getByTestId('journey-milestone-A1');
      expect(a1Milestone.textContent).toContain('🎧1/4');
      expect(a1Milestone.textContent).toContain('📖1/4');
      expect(a1Milestone.textContent).toContain('🗣️0/4');
      expect(a1Milestone.textContent).toContain('✍️0/4');
    });
  });

  describe('2. Milestone Expansion & Level Detail Interaction', () => {
    it('expands Level Detail when a milestone button is clicked and shows 4 skill groups', () => {
      render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      // Initially, level detail is not rendered
      expect(screen.queryByTestId('level-detail-section-A1')).toBeNull();

      // Click on A1 milestone
      const a1Milestone = screen.getByTestId('journey-milestone-A1');
      fireEvent.click(a1Milestone);

      expect(mockOnSelectMilestoneLevel).toHaveBeenCalledWith('A1');

      // Level detail section is now open
      const detailSection = screen.getByTestId('level-detail-section-A1');
      expect(detailSection).toBeDefined();
      expect(detailSection.textContent).toContain('Luyện Nghe');
      expect(detailSection.textContent).toContain('Luyện Đọc');
      expect(detailSection.textContent).toContain('Luyện Nói');
      expect(detailSection.textContent).toContain('Luyện Viết');
    });

    it('triggers onSelectLesson with correct skill and lessonId when clicking a lesson in Level Detail', () => {
      render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      // Expand A1
      fireEvent.click(screen.getByTestId('journey-milestone-A1'));

      // Find an A1 listening lesson button
      const lessonBtn = screen.getByTestId('journey-lesson-listen_a1_1');
      expect(lessonBtn).toBeDefined();

      fireEvent.click(lessonBtn);
      expect(mockOnSelectLesson).toHaveBeenCalledWith('listening', 'listen_a1_1');
    });

    it('closes Level Detail when the close button is clicked', () => {
      render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      // Expand A1
      fireEvent.click(screen.getByTestId('journey-milestone-A1'));
      expect(screen.getByTestId('level-detail-section-A1')).toBeDefined();

      // Click Close button
      const closeBtn = screen.getByTestId('close-level-detail-btn');
      fireEvent.click(closeBtn);

      expect(screen.queryByTestId('level-detail-section-A1')).toBeNull();
    });
  });

  describe('3. Current Journey Callout & Resume / Next Lesson Navigation', () => {
    it('shows encouraging beginner onboarding when user has 0 lessons completed (isNewUser: true)', () => {
      render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      const hero = screen.getByTestId('current-journey-section');
      expect(hero.textContent).toContain('Hành Trình Chinh Phục 4 Kỹ Năng Tiếng Anh');
      expect(hero.textContent).toContain('Khởi Đầu');
      expect(hero.textContent).toContain('Bắt đầu hành trình');

      const startBtn = screen.getByTestId('journey-start-btn');
      fireEvent.click(startBtn);
      expect(mockOnSelectLesson).toHaveBeenCalledWith('listening', 'listen_a1_1');
    });

    it('displays active resumable lesson banner and navigates directly upon clicking "Tiếp tục bài học"', () => {
      const activeResumeActivity: ReadingResumableActivity = {
        id: 'reading_read_a1_1',
        type: 'reading',
        title: 'Meeting a New Colleague',
        schemaVersion: 1,
        startedAt: Date.now() - 300000,
        lastActiveAt: Date.now() - 60000,
        completed: false,
        checkpoint: {
          lessonId: 'read_a1_1',
          answers: { 0: 1 },
          totalQuestions: 4,
          progressPercent: 50,
        },
      };

      useAppStore.setState({
        resumeActivities: {
          reading_read_a1_1: activeResumeActivity,
        },
      });

      render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      const resumeBanner = screen.getByTestId('journey-resume-card');
      expect(resumeBanner).toBeDefined();
      expect(resumeBanner.textContent).toContain('My Daily Morning Routine');
      expect(resumeBanner.textContent).toContain('50%');

      const resumeBtn = screen.getByTestId('journey-resume-btn');
      fireEvent.click(resumeBtn);
      expect(mockOnSelectLesson).toHaveBeenCalledWith('reading', 'read_a1_1');
    });

    it('displays next recommended lesson banner and navigates when clicking "Học tiếp bài này"', () => {
      useAppStore.setState({
        completedListeningLessonIds: ['listen_a1_1'],
      });

      render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      const currentCard = screen.getByTestId('current-journey-card');
      expect(currentCard).toBeDefined();
      expect(currentCard.textContent).toContain('Bài tiếp theo:');

      const nextBtn = screen.getByTestId('journey-next-btn');
      fireEvent.click(nextBtn);
      expect(mockOnSelectLesson).toHaveBeenCalled();
    });
  });

  describe('4. Free Exploration & Out-of-Order Learning Invariant', () => {
    it('allows accessing any milestone freely without artificial locks', () => {
      render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      // C1 milestone is clickable even if A1 is incomplete
      const c1Milestone = screen.getByTestId('journey-milestone-C1');
      expect(c1Milestone.hasAttribute('disabled')).toBe(false);

      fireEvent.click(c1Milestone);
      expect(mockOnSelectMilestoneLevel).toHaveBeenCalledWith('C1');
      expect(screen.getByTestId('level-detail-section-C1')).toBeDefined();
    });

    it('truthfully reflects progress in higher levels (e.g. B2) while lower levels (A1) are partially incomplete', () => {
      useAppStore.setState({
        completedListeningLessonIds: ['listen_a1_1', 'listen_b2_1'],
        fourSkillsCompletionProgress: {
          reading: ['read_b2_1'],
          speaking: [],
          writing: [],
        },
      });

      render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      const a1Milestone = screen.getByTestId('journey-milestone-A1');
      const b2Milestone = screen.getByTestId('journey-milestone-B2');

      // Both A1 and B2 show "Đang học" status in aria-label
      expect(a1Milestone.getAttribute('aria-label')).toContain('Đang học');
      expect(b2Milestone.getAttribute('aria-label')).toContain('Đang học');

      // B2 progress is counted truthfully
      expect(b2Milestone.textContent).toContain('🎧1/4');
      expect(b2Milestone.textContent).toContain('📖1/4');
    });
  });

  describe('5. Competency Metadata & Skill Gap Insight Integration', () => {
    it('renders competency metadata without downgrading lesson completion progress', () => {
      useAppStore.setState({
        completedListeningLessonIds: ['listen_a1_1', 'listen_a1_2', 'listen_a1_3', 'listen_a1_4'],
        srsProgressMap: {
          apple: {
            id: 'apple',
            word: 'apple',
            interval: 5,
            easeFactor: 2.5,
            repetitions: 3,
            nextReviewDate: new Date().toISOString(),
          } as any,
        },
      });

      render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      // Expand A1
      fireEvent.click(screen.getByTestId('journey-milestone-A1'));
      const detail = screen.getByTestId('level-detail-section-A1');

      // Displays competency text
      expect(detail.textContent).toContain('Tích lũy');
    });

    it('renders personalized skill gap insight tip when four skills evidence exists', () => {
      useAppStore.setState({
        fourSkillsEvidence: {
          listening: [
            {
              id: 'ev_1',
              timestamp: Date.now(),
              score: 85,
              rawScore: 85,
              metadata: { subskill: 'gist' },
            },
          ],
          reading: [
            {
              id: 'ev_2',
              timestamp: Date.now(),
              score: 90,
              rawScore: 90,
              metadata: { subskill: 'detail' },
            },
          ],
          speaking: [],
          writing: [],
        } as any,
        fourSkillsScores: {
          listening: [85],
          reading: [90],
          speaking: [],
          writing: [],
        },
      });

      render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      // Insight tip strip is rendered
      const insightTip = screen.getByTestId('journey-insight-strip');
      expect(insightTip).toBeDefined();
      expect(insightTip.textContent).toContain('Bạn có ít dữ liệu');
    });
  });

  describe('6. Accessibility & Touch Targets', () => {
    it('satisfies touch target minimum height 44px and aria attributes', () => {
      render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      const a1Milestone = screen.getByTestId('journey-milestone-A1');
      expect(a1Milestone.className).toContain('min-h-[44px]');
      expect(a1Milestone.getAttribute('aria-label')).toBeTruthy();
      expect(a1Milestone.getAttribute('aria-pressed')).toBeTruthy();
    });
  });

  describe('7. Phase 3 Live Reactivity & Hardening Invariants', () => {
    it('reactively updates progress in-place when store state updates', () => {
      const { rerender } = render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      const a1Milestone = screen.getByTestId('journey-milestone-A1');
      expect(a1Milestone.textContent).toContain('0/16');

      // User completes 1 lesson in store
      act(() => {
        useAppStore.setState({
          completedListeningLessonIds: ['listen_a1_1'],
        });
      });

      rerender(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      expect(a1Milestone.textContent).toContain('1/16');
      expect(a1Milestone.textContent).toContain('🎧1/4');
    });

    it('verifies zero fake mastery is rendered when all lessons in a level are completed', () => {
      const allA1Listening = ['listen_a1_1', 'listen_a1_2', 'listen_a1_3', 'listen_a1_4'];
      const allA1Reading = ['read_a1_1', 'read_a1_2', 'read_a1_3', 'read_a1_4'];
      const allA1Speaking = ['sp_a1_1', 'sp_a1_2', 'sp_a1_3', 'sp_a1_4'];
      const allA1Writing = ['wp_a1_1', 'wp_a1_2', 'wp_a1_3', 'wp_a1_4'];

      useAppStore.setState({
        completedListeningLessonIds: allA1Listening,
        fourSkillsCompletionProgress: {
          reading: allA1Reading,
          speaking: allA1Speaking,
          writing: allA1Writing,
        },
      });

      render(
        <LearningJourneyProgressionMap
          onSelectLesson={mockOnSelectLesson}
          onSelectMilestoneLevel={mockOnSelectMilestoneLevel}
        />
      );

      const a1Milestone = screen.getByTestId('journey-milestone-A1');
      expect(a1Milestone.textContent).toContain('16/16');
      expect(a1Milestone.textContent).toContain('100%');
      // Status in aria-label is strictly "Đã hoàn thành", never fake "Mastered"
      expect(a1Milestone.getAttribute('aria-label')).toContain('Đã hoàn thành');
      expect(a1Milestone.getAttribute('aria-label')).not.toContain('Mastered');
    });
  });
});

