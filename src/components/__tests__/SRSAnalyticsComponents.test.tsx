// @vitest-environment happy-dom
// src/components/__tests__/SRSAnalyticsComponents.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { RetentionChart } from '../RetentionChart';
import { SRSAnalyticsPanel } from '../SRSAnalyticsPanel';
import { SRSReviewEvent, DailyProgress } from '../../types';

describe('PHASE 3: Retention UI Components (Semantic Invariants Audit)', () => {
  describe('RetentionChart', () => {
    it('renders clean fallback empty-state text when data is empty', () => {
      render(<RetentionChart data={[]} />);
      expect(
        screen.getByText('Chưa có dữ liệu ôn tập trong giai đoạn này.')
      ).toBeDefined();
    });

    it('renders SVG polyline, circles, and legend with sample size data points', () => {
      const mockData = [
        { date: '01/10', actual: 0.85, target: 0.90, reviewCount: 20 },
        { date: '02/10', actual: 0.92, target: 0.90, reviewCount: 15 },
        { date: '03/10', actual: 0.88, target: 0.90, reviewCount: 25 },
      ];

      const { container } = render(<RetentionChart data={mockData} />);

      // Verify SVG element is rendered
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();

      // Verify polylines for target and actual
      const polylines = container.querySelectorAll('polyline');
      expect(polylines.length).toBe(2);

      // Verify circles for 3 data points
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThanOrEqual(3);

      // Verify legend text
      expect(screen.getByText('Thực tế (Observed)')).toBeDefined();
      expect(screen.getByText('Mục tiêu (Target)')).toBeDefined();

      // Verify date labels
      expect(screen.getByText('01/10')).toBeDefined();
      expect(screen.getByText('03/10')).toBeDefined();
    });
  });

  describe('SRSAnalyticsPanel', () => {
    const fixedNow = new Date('2026-10-04T12:00:00.000Z').getTime();

    const mockHistory: SRSReviewEvent[] = [
      {
        id: 'rev_1',
        cardId: 'c1',
        rating: 'good',
        grade: 2,
        algorithm: 'fsrs',
        timestamp: new Date(fixedNow - 1 * 86400000).toISOString(),
        stateBefore: 'learning',
        stateAfter: 'review',
        interval: 3,
      },
      {
        id: 'rev_2',
        cardId: 'c2',
        rating: 'easy',
        grade: 3,
        algorithm: 'fsrs',
        timestamp: new Date(fixedNow - 2 * 86400000).toISOString(),
        stateBefore: 'learning',
        stateAfter: 'review',
        interval: 5,
      },
      {
        id: 'rev_3',
        cardId: 'c3',
        rating: 'again',
        grade: 0,
        algorithm: 'fsrs',
        timestamp: new Date(fixedNow - 3 * 86400000).toISOString(),
        stateBefore: 'review',
        stateAfter: 'relearning',
        interval: 1,
      },
    ];

    const mockDailyHistory: Record<string, DailyProgress> = {
      '2026-10-01': {
        date: '2026-10-01',
        wordsReviewed: 1,
        newWordsLearned: 0,
        quizzesCompleted: 0,
        pronunciationsMastered: 0,
        xpGained: 5,
        againCount: 1,
      },
      '2026-10-02': {
        date: '2026-10-02',
        wordsReviewed: 1,
        newWordsLearned: 0,
        quizzesCompleted: 0,
        pronunciationsMastered: 0,
        xpGained: 5,
        easyCount: 1,
      },
      '2026-10-03': {
        date: '2026-10-03',
        wordsReviewed: 1,
        newWordsLearned: 0,
        quizzesCompleted: 0,
        pronunciationsMastered: 0,
        xpGained: 5,
        goodCount: 1,
      },
    };

    it('renders "Chưa có dữ liệu" when there are 0 reviews instead of false 0%', () => {
      render(
        <SRSAnalyticsPanel
          history={[]}
          desiredRetention={0.90}
          dailyHistory={{}}
          algorithm="fsrs"
        />
      );

      // Must display "Chưa có dữ liệu" rather than "0%"
      expect(screen.getByText('Chưa có dữ liệu')).toBeDefined();
      expect(screen.getByText('Chưa có lượt ôn tập nào')).toBeDefined();
    });

    it('renders FSRS metrics and target retention when algorithm is fsrs', () => {
      render(
        <SRSAnalyticsPanel
          history={mockHistory}
          desiredRetention={0.90}
          dailyHistory={mockDailyHistory}
          algorithm="fsrs"
        />
      );

      // Header and badge
      expect(screen.getByText('Hiệu Suất Ghi Nhớ & Phản Xạ SRS')).toBeDefined();
      expect(screen.getByText('FSRS v4.5')).toBeDefined();

      // Target retention display: 90%
      expect(screen.getByText('90%')).toBeDefined();

      // Rating breakdowns
      expect(screen.getByText('Quên (Again)')).toBeDefined();
      expect(screen.getByText('Khó (Hard)')).toBeDefined();
      expect(screen.getByText('Tốt (Good)')).toBeDefined();
      expect(screen.getByText('Dễ (Easy)')).toBeDefined();
    });

    it('renders "Không áp dụng" and "N/A" for Target Retention and Gap when algorithm is sm2', () => {
      render(
        <SRSAnalyticsPanel
          history={mockHistory}
          desiredRetention={0.90}
          dailyHistory={mockDailyHistory}
          algorithm="sm2"
        />
      );

      expect(screen.getByText('SM-2 Standard')).toBeDefined();
      expect(screen.getByText('Không áp dụng')).toBeDefined();
      expect(screen.getByText('N/A')).toBeDefined();
    });

    it('allows switching window tabs between 7 ngày, 30 ngày, and Đã ghi nhận', () => {
      render(
        <SRSAnalyticsPanel
          history={mockHistory}
          desiredRetention={0.90}
          dailyHistory={mockDailyHistory}
          algorithm="fsrs"
        />
      );

      const tab30d = screen.getByText('30 ngày');
      const tabRecorded = screen.getByText('Đã ghi nhận');

      fireEvent.click(tab30d);
      expect(tab30d.className).toContain('bg-blue-600');

      fireEvent.click(tabRecorded);
      expect(tabRecorded.className).toContain('bg-blue-600');
    });
  });
});
