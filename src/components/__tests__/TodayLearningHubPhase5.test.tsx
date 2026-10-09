// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TodayLearningPlanWidget } from '../TodayLearningPlanWidget';
import { Dashboard } from '../Dashboard';
import { useAppStore } from '../../store/useAppStore';
import { TodayLearningPlan } from '../../types';

describe('PHASE 5: Today Learning Hub UI, Visual Hierarchy, Hydration & Accessibility', () => {
  const basePlan: TodayLearningPlan = {
    date: '2026-10-06',
    items: [
      {
        id: 'primary-task',
        type: 'srs_due',
        title: 'Ôn tập 12 thẻ Flashcard đến hạn',
        description: 'Củng cố trí nhớ dài hạn theo chu kỳ tối ưu.',
        count: 12,
        estimatedMinutes: 5,
        timeBucket: '~5 phút',
        priority: 1,
        priorityScore: 95,
        tier: 'essential',
        reason: 'Ổn định đường cong quên lãng.',
        action: { tab: 'flashcards', params: { queueMode: 'DUE' } },
        completed: false,
      },
      {
        id: 'secondary-task-1',
        type: 'mistake_practice',
        title: 'Khắc phục 3 bẫy lỗi dai dẳng',
        description: 'Luyện tập tập trung các từ thường bấm Again.',
        count: 3,
        estimatedMinutes: 5,
        timeBucket: '~5 phút',
        priority: 2,
        priorityScore: 80,
        tier: 'recommended',
        reason: 'Xóa bỏ điểm yếu trước khi phát triển từ mới.',
        action: { tab: 'mistakes' },
        completed: false,
      },
      {
        id: 'secondary-task-2',
        type: 'curriculum_lesson',
        title: 'Bài đọc: Tech Workplace Culture',
        description: 'Nâng cao khả năng đọc hiểu chuẩn CEFR B2.',
        estimatedMinutes: 10,
        timeBucket: '~10 phút',
        priority: 3,
        priorityScore: 50,
        tier: 'recommended',
        reason: 'Tiếp tục lộ trình giáo trình 4 Kỹ Năng.',
        targetLessonId: 'read_b2_01',
        action: { tab: 'four_skills', subTab: 'reading', params: { lessonId: 'read_b2_01' } },
        completed: false,
      },
    ],
    totalEstimatedMinutes: 20,
    totalTasks: 3,
    completedTasks: 0,
    progress: 0,
    workloadBand: 'normal',
    isHeavyDay: false,
  };

  describe('1. Primary vs Secondary Visual Distinction & Cap 4 Cards', () => {
    it('renders 1 distinct primary action card and separate secondary action cards', () => {
      const onNavigate = vi.fn();
      render(<TodayLearningPlanWidget plan={basePlan} onNavigate={onNavigate} userName="Anh Quân" />);

      const primaryCard = screen.getByTestId('primary-action-card');
      expect(primaryCard).toBeDefined();
      expect(primaryCard.textContent).toContain('⭐ Trọng tâm #1');
      expect(primaryCard.textContent).toContain('Ôn tập 12 thẻ Flashcard đến hạn');
      expect(primaryCard.textContent).toContain('Ổn định đường cong quên lãng');

      const secondaryCards = screen.getAllByTestId('secondary-action-card');
      expect(secondaryCards.length).toBe(2);
      expect(secondaryCards[0].textContent).toContain('Khắc phục 3 bẫy lỗi dai dẳng');
      expect(secondaryCards[1].textContent).toContain('Bài đọc: Tech Workplace Culture');
    });

    it('strictly caps total displayed action cards to at most 4 when plan contains more candidates', () => {
      const crowdedPlan: TodayLearningPlan = {
        ...basePlan,
        items: [
          ...basePlan.items,
          {
            id: 'extra-task-1',
            type: 'daily_new_words',
            title: 'Từ mới hôm nay: 10 từ',
            description: 'Khám phá từ mới.',
            estimatedMinutes: 5,
            priority: 4,
            tier: 'optional',
            reason: 'Mở rộng vốn từ vựng tích lũy.',
            action: { tab: 'flashcards' },
            completed: false,
          },
          {
            id: 'extra-task-2',
            type: 'weak_skill_practice',
            title: 'Luyện Nói phát âm',
            description: 'Khắc phục phát âm.',
            estimatedMinutes: 5,
            priority: 5,
            tier: 'optional',
            reason: 'Cải thiện phản xạ phát âm.',
            action: { tab: 'four_skills' },
            completed: false,
          },
        ],
      };

      render(<TodayLearningPlanWidget plan={crowdedPlan} onNavigate={vi.fn()} />);

      const primaryCards = screen.getAllByTestId('primary-action-card');
      const secondaryCards = screen.getAllByTestId('secondary-action-card');

      expect(primaryCards.length).toBe(1);
      expect(secondaryCards.length).toBe(3); // items[1], items[2], items[3]
      expect(primaryCards.length + secondaryCards.length).toBe(4); // Capped at exactly 4!
    });
  });

  describe('2. Progress & Accessibility Invariants', () => {
    it('exposes accessible progress bar with accurate attributes and learner label', () => {
      const planWithProgress: TodayLearningPlan = {
        ...basePlan,
        progress: 67,
        completedTasks: 2,
      };

      render(<TodayLearningPlanWidget plan={planWithProgress} onNavigate={vi.fn()} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar.getAttribute('aria-valuenow')).toBe('67');
      expect(progressbar.getAttribute('aria-valuemin')).toBe('0');
      expect(progressbar.getAttribute('aria-valuemax')).toBe('100');
      expect(progressbar.getAttribute('aria-label')).toBe('Tiến độ học tập hôm nay');
    });

    it('supports prefers-reduced-motion via Tailwind utility classes', () => {
      const { container } = render(<TodayLearningPlanWidget plan={basePlan} onNavigate={vi.fn()} />);
      const html = container.innerHTML;

      // Checks for reduced-motion styling
      expect(html).toContain('motion-reduce:transition-none');
    });

    it('has semantic buttons with descriptive aria labels and visible focus rings', () => {
      render(<TodayLearningPlanWidget plan={basePlan} onNavigate={vi.fn()} />);

      const primaryBtn = screen.getByRole('button', { name: /Bắt đầu nhiệm vụ Ôn tập 12 thẻ Flashcard đến hạn/i });
      expect(primaryBtn).toBeDefined();
      expect(primaryBtn.className).toContain('focus-visible:ring-2');
    });
  });

  describe('3. Plan State Presentations (New User, Completed Day, Greeting)', () => {
    it('renders gentle greeting containing username', () => {
      render(<TodayLearningPlanWidget plan={basePlan} onNavigate={vi.fn()} userName="Hoang" />);
      expect(screen.getByText(/Hoang/i)).toBeDefined();
    });

    it('renders clean onboarding path for new users with zero tasks without showing zeroes spam', () => {
      const onNavigate = vi.fn();
      const emptyPlan: TodayLearningPlan = {
        date: '2026-10-06',
        items: [],
        totalEstimatedMinutes: 0,
        totalTasks: 0,
        completedTasks: 0,
        progress: 0,
        workloadBand: 'light',
        isHeavyDay: false,
      };

      render(<TodayLearningPlanWidget plan={emptyPlan} onNavigate={onNavigate} />);

      const emptyHub = screen.getByTestId('today-hub-empty');
      expect(emptyHub).toBeDefined();
      expect(emptyHub.textContent).toContain('Chào mừng bạn đến với ngày học mới!');
      expect(emptyHub.textContent).not.toContain('0 leech');
      expect(emptyHub.textContent).not.toContain('0 mistake');

      const newWordsBtn = screen.getByRole('button', { name: /Học từ mới ngay/i });
      fireEvent.click(newWordsBtn);
      expect(onNavigate).toHaveBeenCalledWith('flashcards');
    });

    it('renders completed day celebratory banner with optional continuation actions', () => {
      const onNavigate = vi.fn();
      const completedPlan: TodayLearningPlan = {
        ...basePlan,
        totalTasks: 3,
        completedTasks: 3,
        progress: 100,
        items: basePlan.items.map((i) => ({ ...i, completed: true })),
      };

      render(<TodayLearningPlanWidget plan={completedPlan} onNavigate={onNavigate} />);

      const completedHub = screen.getByTestId('today-hub-completed');
      expect(completedHub).toBeDefined();
      expect(completedHub.textContent).toContain('Bạn đã hoàn thành các mục quan trọng hôm nay 🎉');

      const exploreSkillsBtn = screen.getByRole('button', { name: /Luyện 4 Kỹ Năng mở rộng/i });
      fireEvent.click(exploreSkillsBtn);
      expect(onNavigate).toHaveBeenCalledWith('four_skills');

      const freeReviewBtn = screen.getByRole('button', { name: /Ôn tập tự do Flashcard/i });
      fireEvent.click(freeReviewBtn);
      expect(onNavigate).toHaveBeenCalledWith('flashcards');
    });
  });

  describe('4. Hydration & Offline Readiness', () => {
    it('renders hydration skeleton with aria-busy="true" when isHydrated is false', () => {
      render(<TodayLearningPlanWidget plan={basePlan} onNavigate={vi.fn()} isHydrated={false} />);

      const skeleton = screen.getByTestId('today-hub-skeleton');
      expect(skeleton).toBeDefined();
      expect(skeleton.getAttribute('aria-busy')).toBe('true');
      expect(skeleton.getAttribute('aria-label')).toBe('Đang nạp kế hoạch học tập...');

      // Does not show real cards yet while hydrating
      expect(screen.queryByTestId('primary-action-card')).toBeNull();
    });

    it('works 100% offline without network calls', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      render(<TodayLearningPlanWidget plan={basePlan} onNavigate={vi.fn()} />);

      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  describe('5. Dashboard Visual Hierarchy Regression', () => {
    beforeEach(() => {
      useAppStore.setState({
        profile: {
          name: 'Lan Anh',
          level: 4,
          xp: 800,
          streak: 5,
          lastActiveDate: '2026-10-06',
          lastStudyDate: '2026-10-06',
          hearts: 5,
          maxHearts: 5,
          avatarSeed: 'LanAnh',
          targetDailyWords: 15,
          targetDailyNewWords: 15,
          extraNewWordsBonus: 0,
          isOnboarded: true,
          targetGoal: 'daily',
          geminiApiKey: '',
          equippedFrame: null,
          unlockedFrames: [],
        },
        vocabularyList: [],
        srsProgressMap: {},
        mistakeBank: {},
        dailyHistory: {},
        isHydrated: true,
      });
    });

    it('hides empty Leech and Adaptive widgets for new users, avoiding zeroes clutter', () => {
      render(<Dashboard onNavigate={vi.fn()} onOpenAddWord={vi.fn()} />);

      // For a fresh user with 0 reviews/words, empty widgets should not clutter the screen
      expect(screen.queryByTestId('leech-widget-empty')).toBeNull();
      expect(screen.queryByTestId('adaptive-learning-summary')).toBeNull();

      // But core motivation & progress are still visible
      expect(screen.getAllByText(/Lan Anh/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Nhiệm Vụ Ngày & Rương Báu Hoàng Gia')).toBeDefined();
    });

    it('preserves all statistics (Heatmap, 4 Skills, Quests, Streaks) below Today Hub', () => {
      render(<Dashboard onNavigate={vi.fn()} onOpenAddWord={vi.fn()} />);

      expect(screen.getByText('Trọng Tâm Học Tập Ngày')).toBeDefined();
      expect(screen.getByText('Nhiệm Vụ Ngày & Rương Báu Hoàng Gia')).toBeDefined();
      expect(screen.getByText('Năng Lực 4 Kỹ Năng')).toBeDefined();
      expect(screen.getByText('Chuỗi Streak')).toBeDefined();
    });
  });
});
