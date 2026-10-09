// @vitest-environment happy-dom
// src/components/session/__tests__/SessionPrimitives.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  SessionIntro,
  SessionProgressHeader,
  SessionMicroFeedback,
  SessionCompleteSummary,
  NextActionPanel,
} from '../index';
import type { SessionProgressMetric, SessionActionDescriptor } from '../../../types/sessionExperience';

describe('SessionIntro UI Primitive', () => {
  it('renders title, subtitle, objective, and estimated time bucket', () => {
    render(
      <SessionIntro
        title="Luyện Đọc B1: Biến Đổi Khí Hậu"
        subtitle="Chủ đề Môi trường"
        badgeLabel="Reading B1"
        objective="Đọc hiểu tương tác và trích xuất từ vựng mới."
        estimatedDuration="~8 phút"
      />
    );

    expect(screen.getByText('Luyện Đọc B1: Biến Đổi Khí Hậu')).toBeTruthy();
    expect(screen.getByText('Chủ đề Môi trường')).toBeTruthy();
    expect(screen.getByText('Reading B1')).toBeTruthy();
    expect(screen.getByText('Đọc hiểu tương tác và trích xuất từ vựng mới.')).toBeTruthy();
    expect(screen.getByText('~8 phút')).toBeTruthy();
  });

  it('renders Today Plan source badge when routed from Today Plan', () => {
    render(
      <SessionIntro
        title="Ôn tập thẻ bẫy lỗi"
        sourceContext={{ todayPlanTaskId: 'task_mistake_01' }}
      />
    );

    expect(screen.getByText('Kế hoạch hôm nay')).toBeTruthy();
  });

  it('renders custom children slot and triggers primary action', () => {
    const handleStart = vi.fn();
    render(
      <SessionIntro
        title="Phiên Học Thẻ SRS"
        primaryAction={{ label: 'Bắt đầu ngay', onClick: handleStart }}
      >
        <div data-testid="custom-batch-selector">Batch Size: 25</div>
      </SessionIntro>
    );

    expect(screen.getByTestId('custom-batch-selector')).toBeTruthy();
    const btn = screen.getByText('Bắt đầu ngay');
    fireEvent.click(btn);
    expect(handleStart).toHaveBeenCalledTimes(1);
  });
});

describe('SessionProgressHeader UI Primitive', () => {
  it('renders discrete_items progress truthfully with progress bar', () => {
    const metric: SessionProgressMetric = {
      kind: 'discrete_items',
      currentIndex: 3,
      totalItems: 10,
      answeredCount: 4,
      remainingCount: 6,
      progressPercent: 40,
    };

    render(
      <SessionProgressHeader
        metric={metric}
        streakCount={4}
      />
    );

    expect(screen.getByText('4 / 10')).toBeTruthy();
    expect(screen.getByText('(6 remaining)')).toBeTruthy();
    expect(screen.getByText('Streak 4')).toBeTruthy();

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar.getAttribute('aria-valuenow')).toBe('40');
  });

  it('handles single item queue (1 / 1) and empty queue (0 / 0) without errors', () => {
    const singleMetric: SessionProgressMetric = {
      kind: 'discrete_items',
      currentIndex: 0,
      totalItems: 1,
      answeredCount: 1,
      remainingCount: 0,
      progressPercent: 100,
    };

    const { rerender } = render(<SessionProgressHeader metric={singleMetric} />);
    expect(screen.getByText('1 / 1')).toBeTruthy();

    const emptyMetric: SessionProgressMetric = {
      kind: 'discrete_items',
      currentIndex: 0,
      totalItems: 0,
      answeredCount: 0,
      remainingCount: 0,
      progressPercent: 0,
    };

    rerender(<SessionProgressHeader metric={emptyMetric} />);
    expect(screen.getByText('0 / 0')).toBeTruthy();
  });

  it('renders target_words metric for writing studio', () => {
    const metric: SessionProgressMetric = {
      kind: 'target_words',
      currentWordCount: 85,
      minWords: 150,
      targetRange: '150 - 200 từ',
      progressPercent: 57,
    };

    render(<SessionProgressHeader metric={metric} />);

    expect(screen.getByText('85 / 150 từ')).toBeTruthy();
    expect(screen.getByText('(Khung: 150 - 200 từ)')).toBeTruthy();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar.getAttribute('aria-valuenow')).toBe('57');
  });

  it('renders timed_countdown metric for TOEIC exam and handles pause indicator', () => {
    const metric: SessionProgressMetric = {
      kind: 'timed_countdown',
      timeLeftSeconds: 540, // 09:00
      totalDurationSeconds: 900,
      isPaused: true,
      progressPercent: 40,
    };

    render(<SessionProgressHeader metric={metric} isPaused={true} />);

    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.getByText('Tạm dừng')).toBeTruthy();
  });

  it('renders open_turns metric for AI Tutor and NEVER renders progress bar', () => {
    const metric: SessionProgressMetric = {
      kind: 'open_turns',
      turnCount: 7,
    };

    render(<SessionProgressHeader metric={metric} />);

    expect(screen.getByText('7 lượt hội thoại')).toBeTruthy();
    // Strict Invariant: No progress bar for open conversations
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('renders unbounded metric for Arcade Quiz / Pronunciation and NEVER renders progress bar', () => {
    const metric: SessionProgressMetric = {
      kind: 'unbounded',
      completedCount: 14,
    };

    render(<SessionProgressHeader metric={metric} streakCount={5} />);

    expect(screen.getByText('14 đã hoàn thành')).toBeTruthy();
    expect(screen.getByText('Streak 5')).toBeTruthy();
    // Strict Invariant: No fake progress bar for endless sessions
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('calls onPause and onExit handlers when clicked', () => {
    const handlePause = vi.fn();
    const handleExit = vi.fn();

    const metric: SessionProgressMetric = {
      kind: 'discrete_items',
      currentIndex: 1,
      totalItems: 5,
      answeredCount: 2,
      remainingCount: 3,
      progressPercent: 40,
    };

    render(
      <SessionProgressHeader
        metric={metric}
        onPause={handlePause}
        onExit={handleExit}
      />
    );

    const pauseBtn = screen.getByLabelText(/Tạm dừng/i);
    fireEvent.click(pauseBtn);
    expect(handlePause).toHaveBeenCalledTimes(1);

    const exitBtn = screen.getByLabelText(/Thoát phiên/i);
    fireEvent.click(exitBtn);
    expect(handleExit).toHaveBeenCalledTimes(1);
  });
});

describe('SessionMicroFeedback UI Primitive', () => {
  it('returns null when feedback is null', () => {
    const { container } = render(<SessionMicroFeedback feedback={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders feedback badge with appropriate text for SRS grades', () => {
    const { rerender } = render(
      <SessionMicroFeedback feedback={{ text: 'Strong memory!', grade: 3 }} />
    );
    expect(screen.getByText('Strong memory!')).toBeTruthy();

    rerender(
      <SessionMicroFeedback feedback={{ text: "We'll reinforce this one.", grade: 0 }} />
    );
    expect(screen.getByText("We'll reinforce this one.")).toBeTruthy();
  });

  it('renders feedback badge with sentiment styling', () => {
    render(
      <SessionMicroFeedback feedback={{ text: 'Phát âm chuẩn xác (+20 XP)', sentiment: 'success' }} />
    );
    expect(screen.getByText('Phát âm chuẩn xác (+20 XP)')).toBeTruthy();
  });
});

describe('NextActionPanel UI Primitive', () => {
  it('renders action buttons with primary and secondary variants', () => {
    const handleNext = vi.fn();
    const handleRetry = vi.fn();

    const actions: SessionActionDescriptor[] = [
      {
        id: 'next_lesson',
        label: 'Bài học tiếp theo',
        isPrimary: true,
        onClick: handleNext,
      },
      {
        id: 'retry_difficult',
        label: 'Luyện lại câu khó',
        variant: 'secondary',
        onClick: handleRetry,
      },
    ];

    render(<NextActionPanel actions={actions} />);

    const nextBtn = screen.getByText('Bài học tiếp theo');
    fireEvent.click(nextBtn);
    expect(handleNext).toHaveBeenCalledTimes(1);

    const retryBtn = screen.getByText('Luyện lại câu khó');
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('handles disabled action buttons', () => {
    const handleClick = vi.fn();
    const actions: SessionActionDescriptor[] = [
      {
        id: 'disabled_btn',
        label: 'Đang tải...',
        disabled: true,
        onClick: handleClick,
      },
    ];

    render(<NextActionPanel actions={actions} />);
    const btn = screen.getByText('Đang tải...');
    expect(btn.closest('button')?.disabled).toBe(true);
    fireEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });
});

describe('SessionCompleteSummary UI Primitive', () => {
  it('renders summary title, score, accuracy, and XP earned', () => {
    render(
      <SessionCompleteSummary
        title="Xuất Sắc! Bạn Đã Hoàn Thành Bài Nghe!"
        subtitle="Tổng kết phiên nghe hiểu chủ đề Sân bay."
        itemsCompletedCount={5}
        itemsCompletedLabel="Số câu đã làm"
        scoreText="4/5 câu"
        accuracyRate={80}
        xpEarned={45}
      />
    );

    expect(screen.getByText('Xuất Sắc! Bạn Đã Hoàn Thành Bài Nghe!')).toBeTruthy();
    expect(screen.getByText('5 mục')).toBeTruthy();
    expect(screen.getByText('4/5 câu')).toBeTruthy();
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByText('+45 XP')).toBeTruthy();
  });

  it('renders breakdownSlot, reviewSlot, and embedded actions', () => {
    const handleFinish = vi.fn();
    const actions: SessionActionDescriptor[] = [
      {
        id: 'finish_btn',
        label: 'Về Bảng Điều Khiển',
        isPrimary: true,
        onClick: handleFinish,
      },
    ];

    render(
      <SessionCompleteSummary
        breakdownSlot={<div data-testid="custom-breakdown">Breakdown: 4 Good, 1 Again</div>}
        reviewSlot={<div data-testid="custom-review">Review List: 1 Hard Word</div>}
        actions={actions}
      >
        <div data-testid="custom-child-section">Custom Extra Details</div>
      </SessionCompleteSummary>
    );

    expect(screen.getByTestId('custom-breakdown')).toBeTruthy();
    expect(screen.getByTestId('custom-review')).toBeTruthy();
    expect(screen.getByTestId('custom-child-section')).toBeTruthy();

    const finishBtn = screen.getByText('Về Bảng Điều Khiển');
    fireEvent.click(finishBtn);
    expect(handleFinish).toHaveBeenCalledTimes(1);
  });
});
