// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
import { useCloudSyncStore } from '../cloudSyncService';
import * as leaderboardService from '../leaderboardService';
import { Dashboard } from '../../components/Dashboard';
import { App } from '../../App';

// Mock framer-motion to avoid Happy-DOM animation issues
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
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock virtual:pwa-register/react
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

// Mock confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('XP Reload & Idempotency Regression Audit', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetToDefault();
    vi.restoreAllMocks();
  });

  // 1. real streak_7 unlock lần đầu -> +150 đúng 1 lần
  it('1. real streak_7 unlock lần đầu -> +150 đúng 1 lần', () => {
    const store = useAppStore.getState();
    const initialXP = store.profile.xp; // 0
    expect(initialXP).toBe(0);

    // Set streak up to 6 on yesterday
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    useAppStore.setState({
      profile: {
        ...store.profile,
        lastActiveDate: yesterday,
        streak: 6,
      },
    });

    // Advance streak to 7 by updating streak on next day
    useAppStore.getState().checkAndUpdateStreak();

    const afterStreak7 = useAppStore.getState();
    expect(afterStreak7.profile.streak).toBe(7);
    expect(afterStreak7.profile.xp).toBe(150); // Rewarded +150 XP exactly once
    expect(afterStreak7.claimedAchievementIds).toContain('streak_7');
    const ach = afterStreak7.achievements.find((a) => a.id === 'streak_7');
    expect(ach?.unlockedAt).not.toBeNull();
  });

  // 2. achievement streak_7 đã được reward -> reload -> không +150 lần nữa
  it('2. achievement streak_7 đã được reward -> reload -> không +150 lần nữa', () => {
    // Simulate user who already unlocked streak_7 previously
    useAppStore.setState({
      profile: {
        ...useAppStore.getState().profile,
        name: 'Hoang Test',
        streak: 7,
        xp: 150,
      },
      claimedAchievementIds: ['streak_7'],
      achievements: useAppStore.getState().achievements.map((a) =>
        a.id === 'streak_7' ? { ...a, progress: 7, unlockedAt: '2026-10-06T00:00:00.000Z' } : a
      ),
    });

    const xpBeforeReload = useAppStore.getState().profile.xp;
    expect(xpBeforeReload).toBe(150);

    // Simulate reload sequence: checkDailyReset + checkAndUpdateStreak + checkAchievements
    useAppStore.getState().checkDailyReset();
    useAppStore.getState().checkAndUpdateStreak();
    useAppStore.getState().checkAchievements();

    const xpAfterReload = useAppStore.getState().profile.xp;
    expect(xpAfterReload).toBe(150); // XP must remain 150 (Delta = 0)
  });

  // 3. checkAndUpdateStreak() gọi 2 lần -> cùng achievement chỉ reward 1 lần
  it('3. checkAndUpdateStreak() gọi 2 lần -> cùng achievement chỉ reward 1 lần', () => {
    // Initial setup with streak 6 on yesterday
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    useAppStore.setState({
      profile: {
        ...useAppStore.getState().profile,
        lastActiveDate: yesterday,
        streak: 6,
        xp: 0,
      },
    });

    // Call 1: Unlocks streak_7 -> +150 XP
    useAppStore.getState().checkAndUpdateStreak();
    expect(useAppStore.getState().profile.xp).toBe(150);

    // Call 2: Streak already updated/checked today -> Must not reward again
    useAppStore.getState().checkAndUpdateStreak();
    expect(useAppStore.getState().profile.xp).toBe(150);

    // Call 3: Even with explicit checkAchievements -> Must not reward again
    useAppStore.getState().checkAchievements();
    expect(useAppStore.getState().profile.xp).toBe(150);
  });

  // 4. Daily Quest đã claim -> reload -> không claim lại
  it('4. Daily Quest đã claim -> reload -> không claim lại', () => {
    const today = new Date().toISOString().split('T')[0];
    useAppStore.setState({
      completedListeningLessonIds: ['lesson-1'],
      profile: {
        ...useAppStore.getState().profile,
        xp: 50,
      },
    });

    // Quest 1 marked as claimed in localStorage
    localStorage.setItem(`quest_1_claimed_${today}`, 'true');

    // Mount Dashboard
    const { unmount } = render(
      React.createElement(Dashboard, {
        onNavigate: () => {},
        onOpenAddWord: () => {},
      })
    );

    // Verify Quest 1 button shows "Đã nhận" and XP stays 50
    expect(screen.getByText('Đã nhận')).toBeDefined();
    expect(useAppStore.getState().profile.xp).toBe(50);

    // Simulate page reload (unmount + re-render)
    unmount();
    render(
      React.createElement(Dashboard, {
        onNavigate: () => {},
        onOpenAddWord: () => {},
      })
    );

    expect(useAppStore.getState().profile.xp).toBe(50);
  });

  // 5. 3 Daily Quests completed -> reload -> không tự sinh +150
  it('5. 3 Daily Quests completed -> reload -> không tự sinh +150', () => {
    const today = new Date().toISOString().split('T')[0];
    useAppStore.setState({
      completedListeningLessonIds: ['lesson-1'],
      dailyHistory: {
        [today]: {
          date: today,
          wordsReviewed: 25,
          newWordsLearned: 5,
          quizzesCompleted: 2,
          pronunciationsMastered: 2,
          xpGained: 0,
        },
      },
      profile: {
        ...useAppStore.getState().profile,
        xp: 100,
      },
    });
    localStorage.setItem('completed_speaking_prompts', JSON.stringify(['prompt-1']));

    // All 3 quests are done, but NONE are claimed yet
    const { unmount } = render(
      React.createElement(Dashboard, {
        onNavigate: () => {},
        onOpenAddWord: () => {},
      })
    );

    // Mount must NOT auto-claim quests
    expect(useAppStore.getState().profile.xp).toBe(100);

    // Reload 1
    unmount();
    const secondRender = render(
      React.createElement(Dashboard, {
        onNavigate: () => {},
        onOpenAddWord: () => {},
      })
    );
    expect(useAppStore.getState().profile.xp).toBe(100);

    // Reload 2
    secondRender.unmount();
    render(
      React.createElement(Dashboard, {
        onNavigate: () => {},
        onOpenAddWord: () => {},
      })
    );
    expect(useAppStore.getState().profile.xp).toBe(100);
  });

  // 6. weeklyXp sync -> dùng weekly XP thực tế -> không dùng lifetime profile.xp
  it('6. weeklyXp sync trong App.tsx dùng weekly XP thực tế, không dùng lifetime profile.xp', () => {
    const syncSpy = vi.spyOn(leaderboardService, 'syncUserScoreToLeaderboard').mockResolvedValue(undefined);

    // User has 10,000 lifetime XP, but only 200 XP earned this week
    const currentWeekDates = leaderboardService.getCurrentUtcWeekDates();
    const today = currentWeekDates[0]; // Monday of current week

    useCloudSyncStore.setState({
      user: { id: 'test-user-id', email: 'test@example.com' } as any,
      isAuthInitialized: true,
    });

    useAppStore.setState({
      isHydrated: true,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Hoang Champion',
        avatarSeed: 'Seed1',
        level: 25,
        xp: 10000, // Lifetime total_xp
        streak: 15,
      },
      dailyHistory: {
        // Last week (should NOT count in weekly XP)
        '2026-09-01': { date: '2026-09-01', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 5000 },
        // Current week Monday
        [today]: { date: today, wordsReviewed: 5, newWordsLearned: 2, quizzesCompleted: 1, pronunciationsMastered: 0, xpGained: 200 },
      },
    });

    render(React.createElement(App));

    expect(syncSpy).toHaveBeenCalled();
    const lastCall = syncSpy.mock.calls[syncSpy.mock.calls.length - 1][0];

    // totalXp is lifetime XP (10,000)
    expect(lastCall.totalXp).toBe(10000);
    // weeklyXp MUST BE 200 (from dailyHistory this week), NEVER 10,000 (profile.xp)
    expect(lastCall.weeklyXp).toBe(200);
    expect(lastCall.streak).toBe(15);
  });

  // 7. Multiple reloads test: 5 consecutive reloads produce Delta XP = 0
  it('7. 5 consecutive reloads produce Delta XP = 0', () => {
    useAppStore.setState({
      profile: {
        ...useAppStore.getState().profile,
        name: 'Learner',
        xp: 500,
        streak: 7,
      },
      claimedAchievementIds: ['streak_7'],
    });

    for (let i = 0; i < 5; i++) {
      useAppStore.getState().checkDailyReset();
      useAppStore.getState().checkAndUpdateStreak();
      useAppStore.getState().checkAchievements();
      expect(useAppStore.getState().profile.xp).toBe(500);
    }
  });

  // 8. Legitimate learning rewards still function correctly
  it('8. Legitimate learning rewards still award XP normally', () => {
    useAppStore.setState({
      profile: {
        ...useAppStore.getState().profile,
        xp: 500,
      },
    });

    useAppStore.getState().gainXP(25);
    expect(useAppStore.getState().profile.xp).toBe(525);
  });
});
