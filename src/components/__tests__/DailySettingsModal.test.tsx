// @vitest-environment happy-dom
// src/components/__tests__/DailySettingsModal.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DailySettingsModal } from '../DailySettingsModal';
import { useAppStore } from '../../store/useAppStore';

describe('PHASE 4: DailySettingsModal Workload Indicator & Warning', () => {
  it('renders workload forecast preview in DailySettingsModal when FSRS is selected', () => {
    // Seed store with FSRS algorithm and a sample progress record
    useAppStore.setState({
      srsAlgorithm: 'fsrs',
      fsrsSettings: {
        desiredRetention: 0.90,
        maximumInterval: 36500,
        w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
      },
      srsProgressMap: {
        w1: {
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        },
      },
    });

    render(<DailySettingsModal isOpen={true} onClose={() => {}} />);

    // Forecast header should be present
    expect(screen.getByText('Dự báo 7 ngày tới (gồm hôm nay):')).toBeDefined();
    expect(screen.getByText('Mục Tiêu Ghi Nhớ (Desired Retention)')).toBeDefined();
  });

  it('triggers high-workload warning when user drags retention slider above 94%', () => {
    useAppStore.setState({
      srsAlgorithm: 'fsrs',
      fsrsSettings: {
        desiredRetention: 0.90,
        maximumInterval: 36500,
        w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
      },
      srsProgressMap: {
        w1: {
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        },
      },
    });

    render(<DailySettingsModal isOpen={true} onClose={() => {}} />);

    // Find the range slider
    const slider = screen.getByRole('slider');
    expect(slider).toBeDefined();

    // Adjust slider to 96% (+117% or higher workload change, which exceeds 40%)
    fireEvent.change(slider, { target: { value: '96' } });

    // Warning banner should appear
    expect(screen.getByText(/Cảnh báo tải học tập tăng cao/)).toBeDefined();
    expect(screen.getByText(/làm chu kỳ ôn tập ngắn lại đáng kể/)).toBeDefined();
  });

  it('hides FSRS Desired Retention slider and workload impact when SM-2 is chosen', () => {
    useAppStore.setState({
      srsAlgorithm: 'sm2',
    });

    render(<DailySettingsModal isOpen={true} onClose={() => {}} />);

    // Desired Retention slider should NOT be in the document
    expect(screen.queryByText('Mục Tiêu Ghi Nhớ (Desired Retention)')).toBeNull();
    expect(screen.queryByRole('slider')).toBeNull();
  });
});
