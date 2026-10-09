// @vitest-environment happy-dom
// src/components/__tests__/AdaptiveLearningSummary.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AdaptiveLearningSummary } from '../AdaptiveLearningSummary';
import { RetentionWindowMetrics } from '../../services/srsAnalytics';
import { WorkloadForecastResult } from '../../services/srsWorkloadForecast';
import { RetentionRecommendation } from '../../services/retentionRecommendation';

describe('PHASE 6: AdaptiveLearningSummary UI Component', () => {
  const mockMetrics: RetentionWindowMetrics = {
    windowDays: 30,
    totalReviews: 120,
    actualRetention: 0.89,
    desiredRetention: 0.90,
    retentionGap: -0.01,
    hasSufficientData: true,
    ratingDistribution: { again: 13, hard: 22, good: 65, easy: 20 },
    ratingPercentages: { again: 11, hard: 18, good: 54, easy: 17 },
  };

  const mockForecast: WorkloadForecastResult = {
    today: 14,
    tomorrow: 18,
    next7Days: 85,
    dailyCounts: {
      '2026-10-04': 14,
      '2026-10-05': 18,
    },
  };

  const mockRecommendation: RetentionRecommendation = {
    recommendedRetention: 0.88,
    currentRetention: 0.90,
    confidence: 'high',
    reasons: ['Tỷ lệ nhớ lại ổn định.'],
    estimatedWorkloadChangePercent: -17,
    isApplicable: true,
    algorithm: 'fsrs',
  };

  it('renders all 4 metric blocks with accurate calculations', () => {
    const onOpenDetailsMock = vi.fn();

    render(
      <AdaptiveLearningSummary
        metrics={mockMetrics}
        forecast={mockForecast}
        leechCount={3}
        recommendation={mockRecommendation}
        onOpenDetails={onOpenDetailsMock}
      />
    );

    // 1. Actual Retention block
    expect(screen.getByText('Ghi nhớ thực tế')).toBeDefined();
    expect(screen.getByText('89%')).toBeDefined();
    expect(screen.getByText(/Mục tiêu: 90%/i)).toBeDefined();

    // 2. Workload forecast block
    expect(screen.getByText('Hôm nay / 7 ngày')).toBeDefined();
    expect(screen.getByText('14')).toBeDefined();
    expect(screen.getByText(/\/ 85/i)).toBeDefined();

    // 3. Leech count block
    expect(screen.getByText('Từ hay quên (Leech)')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();

    // 4. Recommendation block
    expect(screen.getByText('Đề xuất Retention')).toBeDefined();
    expect(screen.getByText('88%')).toBeDefined();
    expect(screen.getByText(/Độ tin cậy: high/i)).toBeDefined();
  });

  it('triggers onOpenDetails callback when analytics button is clicked', () => {
    const onOpenDetailsMock = vi.fn();

    render(
      <AdaptiveLearningSummary
        metrics={mockMetrics}
        forecast={mockForecast}
        leechCount={3}
        recommendation={mockRecommendation}
        onOpenDetails={onOpenDetailsMock}
      />
    );

    const detailsButton = screen.getByText(/Chi tiết analytics/i);
    fireEvent.click(detailsButton);

    expect(onOpenDetailsMock).toHaveBeenCalledTimes(1);
  });

  it('safely handles null actualRetention without crashing', () => {
    const emptyMetrics: RetentionWindowMetrics = {
      ...mockMetrics,
      totalReviews: 0,
      actualRetention: null as any,
    };

    render(
      <AdaptiveLearningSummary
        metrics={emptyMetrics}
        forecast={mockForecast}
        leechCount={0}
        recommendation={mockRecommendation}
        onOpenDetails={vi.fn()}
      />
    );

    expect(screen.getByText('Chưa có')).toBeDefined();
  });

  it('gracefully renders SM-2 non-applicable recommendation state', () => {
    const sm2Recommendation: RetentionRecommendation = {
      recommendedRetention: 0.90,
      currentRetention: 0.90,
      confidence: 'low',
      reasons: ['SM-2 không dùng desired retention'],
      isApplicable: false,
      algorithm: 'sm2',
    };

    render(
      <AdaptiveLearningSummary
        metrics={mockMetrics}
        forecast={mockForecast}
        leechCount={0}
        recommendation={sm2Recommendation}
        onOpenDetails={vi.fn()}
      />
    );

    expect(screen.getByText('Cố định')).toBeDefined();
    expect(screen.getByText(/SM-2 dùng Ease Factor/i)).toBeDefined();
  });
});
