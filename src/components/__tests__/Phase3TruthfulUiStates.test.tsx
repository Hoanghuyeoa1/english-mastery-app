// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { LeaderboardView, formatMetricScore } from '../LeaderboardView';
import { FourSkillsView } from '../FourSkillsView';
import * as leaderboardService from '../../services/leaderboardService';
import { useCloudSyncStore } from '../../services/cloudSyncService';
import { useAppStore } from '../../store/useAppStore';
import type { LeaderboardEntry } from '../../types';

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
    span: ({ children, className, ...props }: any) => (
      <span className={className} {...props}>
        {children}
      </span>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('../../services/speechService', () => ({
  speakWord: vi.fn(),
  speakText: vi.fn(),
  cancelSpeech: vi.fn(),
  isSpeechRecognitionSupported: vi.fn().mockReturnValue(false),
}));

describe('PHASE 3 — Truthful UI States & Runtime Mock Removal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(leaderboardService, 'syncUserScoreToLeaderboard').mockResolvedValue();
    useCloudSyncStore.setState({
      isOnline: true,
      user: { id: 'legit_current_user', email: 'hoang@mastery.edu' } as any,
      userId: 'legit_current_user',
    });
    useAppStore.setState({
      profile: {
        name: 'Hoang Tester',
        level: 3,
        xp: 450,
        streak: 0, // Legitimate 0 streak
        avatarSeed: 'seed_real',
        lastActiveDate: '2026-10-08',
        lastStudyDate: '2026-10-08',
        hearts: 5,
        maxHearts: 5,
        targetDailyWords: 20,
        targetDailyNewWords: 15,
        extraNewWordsBonus: 0,
      },
      dailyHistory: {},
    });
  });

  it('1. Empty API Response: displays "Chưa có học viên nào trên bảng xếp hạng." with zero synthetic rows', async () => {
    vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
      entries: [],
      totalCount: 0,
      currentUserEntry: null,
      limit: 50,
      offset: 0,
      status: 'SUCCESS',
      error: null,
    });

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
    });

    // Exact required Vietnamese string
    expect(screen.getByText('Chưa có học viên nào trên bảng xếp hạng.')).toBeDefined();

    // Verify no demo/synthetic learners exist in the DOM
    expect(screen.queryByText(/Learner One/i)).toBeNull();
    expect(screen.queryByText(/Learner Two/i)).toBeNull();
    expect(screen.queryByText(/VIP Learner/i)).toBeNull();
    expect(screen.queryByText(/Alex Kim/i)).toBeNull();
  });

  it('2. API Failure: renders error state and retry button, never injects mock rows or cached demo users', async () => {
    vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
      entries: [],
      totalCount: 0,
      currentUserEntry: null,
      limit: 50,
      offset: 0,
      status: 'NETWORK_ERROR',
      error: 'Không thể kết nối đến máy chủ bảng xếp hạng.',
    });

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
    });

    // Error banner should be present
    expect(screen.getAllByText(/Không thể kết nối đến máy chủ bảng xếp hạng/i).length).toBeGreaterThanOrEqual(1);
    // Retry button should be available
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeDefined();

    // No fake rows generated
    expect(screen.queryByText(/Chưa có học viên nào trên bảng xếp hạng./i)).toBeNull();
    expect(screen.queryByText(/Learner Two/i)).toBeNull();
    expect(screen.queryByText(/VIP Learner/i)).toBeNull();
  });

  it('3. Legitimate Zero Score: renders 0 score honestly across metric types without hiding or inventing fake values', () => {
    expect(formatMetricScore(0, 'weekly_xp')).toBe('0 XP');
    expect(formatMetricScore(0, 'streak')).toBe('0 ngày');
    expect(formatMetricScore(0, 'vocab_mastered')).toBe('0 từ');
    expect(formatMetricScore(0, 'review_consistency')).toBe('0.0%');
    expect(formatMetricScore(0, 'active_minutes')).toBe('0 phút');
    expect(formatMetricScore(0, 'pronunciation_gain')).toBe('0.0 điểm');
    expect(formatMetricScore(0, 'toeic_gain')).toBe('0 LR');
  });

  it('4. Valid Backend Users: renders only authentic returned records without phantom filler rows', async () => {
    const realUsers: LeaderboardEntry[] = [
      {
        userId: 'user_alpha',
        displayName: 'Nguyễn Văn A',
        level: 5,
        rankTitle: 'Novice',
        score: 450,
        rank: 1,
        isCurrentUser: false,
      },
      {
        userId: 'user_beta',
        displayName: 'Trần Thị B',
        level: 8,
        rankTitle: 'Novice',
        score: 300,
        rank: 2,
        isCurrentUser: false,
      },
    ];

    vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
      entries: realUsers,
      totalCount: 2,
      currentUserEntry: null,
      limit: 50,
      offset: 0,
      status: 'SUCCESS',
      error: null,
    });

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn A')).toBeDefined();
      expect(screen.getByText('Trần Thị B')).toBeDefined();
    });

    // Top 3 pedestal shows only the 2 actual users; no 3rd phantom row
    expect(screen.queryByText(/Hạng #3/i)).toBeNull();
    expect(screen.queryByText(/Learner/i)).toBeNull();
  });

  it('5. Streak Integrity: streak of 0 is truthfully displayed as "0 ngày" in FourSkillsView and not coerced to 1', () => {
    useAppStore.setState({
      profile: {
        ...useAppStore.getState().profile,
        streak: 0,
      },
    });

    render(<FourSkillsView onNavigate={() => {}} />);

    // Should display "0 ngày", strictly NOT "1 ngày"
    expect(screen.getByText('0 ngày')).toBeDefined();
    expect(screen.queryByText('1 ngày')).toBeNull();
  });
});
