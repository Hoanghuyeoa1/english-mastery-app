// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TodayLearningPlanWidget } from '../TodayLearningPlanWidget';
import { TodayLearningPlan } from '../../types';

describe('PHASE 5: TodayLearningPlanWidget Component', () => {
  const mockPlan: TodayLearningPlan = {
    date: '2026-10-06',
    items: [
      {
        id: 'srs-due-2026-10-06',
        type: 'srs_due',
        title: 'Ôn tập 15 thẻ Flashcard đến hạn',
        description: 'Củng cố trí nhớ cho 15 từ vựng đến hạn hôm nay.',
        count: 15,
        estimatedMinutes: 5,
        priority: 2,
        priorityScore: 105,
        tier: 'essential',
        reason: 'Thuật toán SRS đã tính toán chu kỳ tối ưu.',
        action: { tab: 'flashcards', params: { queueMode: 'DUE' } },
        completed: false,
      },
      {
        id: 'mistake-practice-2026-10-06',
        type: 'mistake_practice',
        title: 'Khắc phục 4 bẫy lỗi đang chờ',
        description: 'Luyện tập tập trung 4 từ vựng thường mắc lỗi.',
        count: 4,
        estimatedMinutes: 3,
        priority: 5,
        priorityScore: 80,
        tier: 'recommended',
        reason: 'Xóa bỏ điểm yếu dai dẳng.',
        action: { tab: 'mistakes' },
        completed: false,
      },
      {
        id: 'new-words-2026-10-06',
        type: 'daily_new_words',
        title: 'Mục tiêu học từ mới: 10 từ',
        description: 'Khám phá và tiếp nạp 10 từ vựng mới.',
        count: 10,
        estimatedMinutes: 5,
        priority: 9,
        priorityScore: 40,
        tier: 'optional',
        reason: 'Mở rộng vốn từ vựng chủ động.',
        action: { tab: 'flashcards' },
        completed: true,
      },
    ],
    totalEstimatedMinutes: 13,
    totalTasks: 3,
    completedTasks: 1,
    progress: 33,
    workloadBand: 'normal',
    isHeavyDay: false,
    totalDueCount: 15,
    remainingDueCount: 0,
    sessionChunkCount: 15,
  };

  it('renders plan header, estimated time, and progress bar correctly', () => {
    const onNavigate = vi.fn();
    render(<TodayLearningPlanWidget plan={mockPlan} onNavigate={onNavigate} />);

    expect(screen.getByText('Trọng Tâm Học Tập Ngày')).toBeDefined();
    expect(screen.getByText('~13 phút')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText(/hoàn thành/i)).toBeDefined();

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.getAttribute('aria-valuenow')).toBe('33');
  });

  it('renders all task cards with titles, reasons, tier badges and estimated minutes', () => {
    const onNavigate = vi.fn();
    render(<TodayLearningPlanWidget plan={mockPlan} onNavigate={onNavigate} />);

    expect(screen.getByText('Ôn tập 15 thẻ Flashcard đến hạn')).toBeDefined();
    expect(screen.getByText('Khắc phục 4 bẫy lỗi đang chờ')).toBeDefined();
    expect(screen.getByText('Mục tiêu học từ mới: 10 từ')).toBeDefined();

    // Tier badges
    expect(screen.getByText('Ưu tiên cao')).toBeDefined();
    expect(screen.getByText('Khuyến nghị')).toBeDefined();
    expect(screen.getByText('Mở rộng')).toBeDefined();

    // Estimated minutes
    expect(screen.getAllByText('~5p').length).toBe(2);
    expect(screen.getByText('~3p')).toBeDefined();
  });

  it('renders completed tasks with distinct completed styling and "Xem lại" button', () => {
    const onNavigate = vi.fn();
    render(<TodayLearningPlanWidget plan={mockPlan} onNavigate={onNavigate} />);

    const reviewButton = screen.getByRole('button', { name: /Xem lại nhiệm vụ Mục tiêu học từ mới: 10 từ/i });
    expect(reviewButton).toBeDefined();

    fireEvent.click(reviewButton);
    expect(onNavigate).toHaveBeenCalledWith('flashcards');
  });

  it('triggers CTA action when clicking "Bắt đầu"', () => {
    const onNavigate = vi.fn();
    render(<TodayLearningPlanWidget plan={mockPlan} onNavigate={onNavigate} />);

    const startMistakeButton = screen.getByRole('button', { name: /Bắt đầu nhiệm vụ Khắc phục 4 bẫy lỗi đang chờ/i });
    expect(startMistakeButton).toBeDefined();

    fireEvent.click(startMistakeButton);
    expect(onNavigate).toHaveBeenCalledWith('mistakes');
  });

  it('handles Heavy Day UX without overwhelming the user', () => {
    const onNavigate = vi.fn();
    const heavyPlan: TodayLearningPlan = {
      ...mockPlan,
      isHeavyDay: true,
      totalDueCount: 180,
      sessionChunkCount: 30,
      remainingDueCount: 150,
      totalTasks: 2,
      completedTasks: 0,
      progress: 0,
    };

    render(<TodayLearningPlanWidget plan={heavyPlan} onNavigate={onNavigate} />);

    expect(screen.getByText(/Khối lượng ôn tập hôm nay lớn \(180 thẻ đến hạn\)/i)).toBeDefined();
    expect(screen.getByText('Chia nhỏ phiên')).toBeDefined();
    expect(screen.getByText('30 thẻ')).toBeDefined();
    expect(screen.getByText('150 thẻ')).toBeDefined();
  });

  it('renders all completed celebratory banner when all tasks are done', () => {
    const onNavigate = vi.fn();
    const completedPlan: TodayLearningPlan = {
      ...mockPlan,
      totalTasks: 3,
      completedTasks: 3,
      progress: 100,
      items: mockPlan.items.map((it) => ({ ...it, completed: true })),
    };

    render(<TodayLearningPlanWidget plan={completedPlan} onNavigate={onNavigate} />);

    expect(screen.getByText('Bạn đã hoàn thành các mục quan trọng hôm nay 🎉')).toBeDefined();
    expect(screen.getByText(/Tuyệt vời! Bạn đã hoàn thành toàn bộ nhiệm vụ cốt lõi hôm nay./i)).toBeDefined();
  });

  it('renders clean empty state for new users with zero tasks', () => {
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

    expect(screen.getByText('Chào mừng bạn đến với ngày học mới!')).toBeDefined();
    expect(screen.getByText('Học từ mới ngay')).toBeDefined();
    expect(screen.getByText('Khám phá 4 Kỹ Năng')).toBeDefined();

    fireEvent.click(screen.getByText('Học từ mới ngay'));
    expect(onNavigate).toHaveBeenCalledWith('flashcards');
  });
});
