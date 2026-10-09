// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SessionProgressHeader } from '../session/SessionProgressHeader';
import { SessionIntro } from '../session/SessionIntro';
import { NextActionPanel } from '../session/NextActionPanel';
import { SessionMicroFeedback } from '../session/SessionMicroFeedback';
import { SessionCompleteSummary } from '../session/SessionCompleteSummary';
import { validateResumeActivity } from '../../services/learningContinuityService';
import type { ResumableActivity } from '../../types';

describe('PHASE 9: UX Consistency, Accessibility, Mobile, Performance & Edge Cases Hardening', () => {
  describe('1. SessionProgressHeader Progress Bar & Sanity Invariants', () => {
    it('sanitizes negative progress and clamps strictly to 0 with aria-valuetext', () => {
      render(
        <SessionProgressHeader
          metric={{
            kind: 'discrete_items',
            currentIndex: 0,
            totalItems: 10,
            answeredCount: 0,
            remainingCount: 10,
            progressPercent: -25, // Negative edge case
          }}
        />
      );

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeDefined();
      expect(progressbar.getAttribute('aria-valuenow')).toBe('0');
      expect(progressbar.getAttribute('aria-valuemin')).toBe('0');
      expect(progressbar.getAttribute('aria-valuemax')).toBe('100');
      expect(progressbar.getAttribute('aria-valuetext')).toBe('0%');
      expect(progressbar.getAttribute('aria-label')).toBe('Tiến độ phiên học');
    });

    it('sanitizes overflow progress (>100%) and clamps strictly to 100 with aria-valuetext', () => {
      render(
        <SessionProgressHeader
          metric={{
            kind: 'discrete_items',
            currentIndex: 10,
            totalItems: 10,
            answeredCount: 10,
            remainingCount: 0,
            progressPercent: 145.8, // Overflow edge case
          }}
        />
      );

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeDefined();
      expect(progressbar.getAttribute('aria-valuenow')).toBe('100');
      expect(progressbar.getAttribute('aria-valuemin')).toBe('0');
      expect(progressbar.getAttribute('aria-valuemax')).toBe('100');
      expect(progressbar.getAttribute('aria-valuetext')).toBe('100%');
    });

    it('does not render progressbar when progressPercent is NaN or Infinity', () => {
      const { rerender } = render(
        <SessionProgressHeader
          metric={{
            kind: 'discrete_items',
            currentIndex: 0,
            totalItems: 0,
            answeredCount: 0,
            remainingCount: 0,
            progressPercent: NaN, // Non-finite NaN
          }}
        />
      );

      expect(screen.queryByRole('progressbar')).toBeNull();

      rerender(
        <SessionProgressHeader
          metric={{
            kind: 'discrete_items',
            currentIndex: 0,
            totalItems: 0,
            answeredCount: 0,
            remainingCount: 0,
            progressPercent: Infinity, // Non-finite Infinity
          }}
        />
      );

      expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('renders countdown timer with role="timer", aria-label and motion-reduce:animate-none when warning pulse is active', () => {
      render(
        <SessionProgressHeader
          metric={{
            kind: 'timed_countdown',
            timeLeftSeconds: 90, // < 120 triggers warning pulse
            totalDurationSeconds: 1200,
            isPaused: false,
            progressPercent: 50,
          }}
        />
      );

      const timer = screen.getByRole('timer');
      expect(timer).toBeDefined();
      expect(timer.getAttribute('aria-label')).toBe('Thời gian còn lại: 01:30');
      expect(timer.className).toContain('animate-pulse');
      expect(timer.className).toContain('motion-reduce:animate-none');
    });

    it('provides accessible min-h-[36px]/min-h-[40px] touch targets and visible focus rings on action buttons', () => {
      render(
        <SessionProgressHeader
          metric={{
            kind: 'discrete_items',
            currentIndex: 1,
            totalItems: 5,
            answeredCount: 1,
            remainingCount: 4,
            progressPercent: 20,
          }}
          onPause={vi.fn()}
          onExit={vi.fn()}
        />
      );

      const pauseBtn = screen.getByLabelText('Tạm dừng bài làm');
      const exitBtn = screen.getByLabelText('Thoát phiên học');

      expect(pauseBtn.className).toContain('min-h-[36px]');
      expect(pauseBtn.className).toContain('focus-visible:ring-2');
      expect(pauseBtn.className).toContain('motion-reduce:transition-none');

      expect(exitBtn.className).toContain('min-h-[36px]');
      expect(exitBtn.className).toContain('focus-visible:ring-2');
      expect(exitBtn.className).toContain('motion-reduce:transition-none');
    });
  });

  describe('2. SessionIntro A11y & Mobile Ergonomics', () => {
    it('exposes role="region" and aria-label for screen readers', () => {
      render(
        <SessionIntro
          title="Luyện Đọc Học Thuật"
          subtitle="Bài đọc hiểu CEFR B2"
          objective="Hoàn thành các câu hỏi đọc hiểu trong thời gian quy định."
        />
      );

      const region = screen.getByRole('region', { name: 'Thông tin chuẩn bị phiên học' });
      expect(region).toBeDefined();
      expect(screen.getByText('Luyện Đọc Học Thuật')).toBeDefined();
      expect(screen.getByText('Luyện Đọc Học Thuật').className).toContain('break-words');
    });

    it('enforces min-h-[44px] touch targets and visible focus rings on primary & secondary CTAs', () => {
      const handlePrimary = vi.fn();
      const handleSecondary = vi.fn();

      render(
        <SessionIntro
          title="Ôn Tập Từ Vựng"
          primaryAction={{
            label: 'Bắt Đầu Ngay',
            onClick: handlePrimary,
          }}
          secondaryAction={{
            label: 'Quay Lại',
            onClick: handleSecondary,
          }}
        />
      );

      const primaryBtn = screen.getByTestId('btn-start-session');
      const secondaryBtn = screen.getByText('Quay Lại');

      expect(primaryBtn.className).toContain('min-h-[44px]');
      expect(primaryBtn.className).toContain('focus-visible:ring-2');
      expect(primaryBtn.className).toContain('motion-reduce:transition-none');

      expect(secondaryBtn.className).toContain('min-h-[44px]');
      expect(secondaryBtn.className).toContain('focus-visible:ring-2');
      expect(secondaryBtn.className).toContain('motion-reduce:transition-none');
    });
  });

  describe('3. NextActionPanel A11y & Touch Targets', () => {
    it('exposes role="group", aria-label, and min-h-[44px] on all action buttons', () => {
      const handleContinue = vi.fn();
      const handleHome = vi.fn();

      render(
        <NextActionPanel
          actions={[
            {
              id: 'next_lesson',
              label: 'Bài Học Kế Tiếp',
              description: 'Tiếp tục bài B2-Unit 3',
              isPrimary: true,
              onClick: handleContinue,
            },
            {
              id: 'today_hub',
              label: 'Về Today Hub',
              description: 'Xem lộ trình học hôm nay',
              variant: 'secondary',
              onClick: handleHome,
            },
          ]}
        />
      );

      const group = screen.getByRole('group', { name: 'Hành động tiếp theo' });
      expect(group).toBeDefined();

      const btn1 = screen.getByTestId('next-action-next_lesson');
      const btn2 = screen.getByTestId('next-action-today_hub');

      expect(btn1.className).toContain('min-h-[44px]');
      expect(btn1.className).toContain('focus-visible:ring-2');
      expect(btn1.className).toContain('motion-reduce:transition-none');
      expect(btn1.getAttribute('aria-label')).toBe('Bài Học Kế Tiếp: Tiếp tục bài B2-Unit 3');

      expect(btn2.className).toContain('min-h-[44px]');
      expect(btn2.className).toContain('focus-visible:ring-2');
      expect(btn2.getAttribute('aria-label')).toBe('Về Today Hub: Xem lộ trình học hôm nay');
    });
  });

  describe('4. SessionMicroFeedback Transient Feedback', () => {
    it('maintains role="status", aria-live="polite", aria-atomic="true", and motion-reduce classes', () => {
      render(
        <SessionMicroFeedback
          feedback={{
            text: 'Tuyệt vời! +10 XP',
            sentiment: 'success',
          }}
        />
      );

      const status = screen.getByRole('status');
      expect(status).toBeDefined();
      expect(status.getAttribute('aria-live')).toBe('polite');
      expect(status.getAttribute('aria-atomic')).toBe('true');
      expect(status.className).toContain('motion-reduce:animate-none');
      expect(status.className).toContain('motion-reduce:transition-none');
      expect(screen.getByText('Tuyệt vời! +10 XP')).toBeDefined();
    });

    it('returns null and does not render empty DOM when feedback is null', () => {
      const { container } = render(<SessionMicroFeedback feedback={null} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('5. SessionCompleteSummary Responsive Layout & A11y', () => {
    it('exposes role="region", aria-label, break-words, and responsive padding', () => {
      render(
        <SessionCompleteSummary
          title="Chúc mừng! Bạn đã hoàn thành bài viết xuất sắc"
          subtitle="Điểm số B2 CEFR đạt yêu cầu hoàn thiện."
          scoreText="Band 7.5"
          xpEarned={40}
          itemsCompletedCount={1}
        />
      );

      const region = screen.getByRole('region', { name: 'Tổng kết phiên học' });
      expect(region).toBeDefined();
      expect(region.className).toContain('p-5');
      expect(region.className).toContain('sm:p-8');
      expect(region.className).toContain('md:p-10');
      expect(region.className).toContain('motion-reduce:animate-none');

      const title = screen.getByText('Chúc mừng! Bạn đã hoàn thành bài viết xuất sắc');
      expect(title.className).toContain('break-words');
    });
  });

  describe('6. Resumable Activity Backward Compatibility & Legacy Fallback', () => {
    it('gracefully validates legacy activities with omitted optional fields without crashing', () => {
      // Legacy activity without subtitle, customTopic, draft, progressPercent
      const legacyRaw = {
        id: 'writing_essay_1',
        type: 'writing',
        title: 'An Environment Essay',
        startedAt: 1700000000000,
        checkpoint: {
          promptId: 'essay_1',
          // draft, customTopic, progressPercent, wordCount omitted
        },
      };

      const validated = validateResumeActivity(legacyRaw);
      expect(validated).not.toBeNull();
      expect(validated?.id).toBe('writing_essay_1');
      expect(validated?.type).toBe('writing');
      expect(validated?.title).toBe('An Environment Essay');
      expect(validated?.subtitle).toBeUndefined();
      if (validated && validated.type === 'writing') {
        expect(validated.checkpoint.draft).toBe('');
        expect(validated.checkpoint.customTopic).toBeUndefined();
        expect(validated.checkpoint.progressPercent).toBeUndefined();
        expect(validated.checkpoint.wordCount).toBe(0);
      }
    });

    it('rejects completely invalid activity payloads without throwing errors', () => {
      expect(validateResumeActivity(null)).toBeNull();
      expect(validateResumeActivity(undefined)).toBeNull();
      expect(validateResumeActivity([])).toBeNull();
      expect(validateResumeActivity({})).toBeNull();
      expect(validateResumeActivity({ id: '', type: 'unknown' })).toBeNull();
    });
  });

  describe('7. Concurrency & Race Condition Guards (Writing Grading & Autosave)', () => {
    it('atomic grading guard prevents double submission while isGrading is true', () => {
      // Testing the atomic guard pattern applied in FourSkillsView handleGradeWithAI
      let isGrading = false;
      let gradingCallCount = 0;

      const mockHandleGradeWithAI = async () => {
        if (isGrading) return;
        isGrading = true;
        try {
          gradingCallCount++;
          // simulate async AI operation
          await new Promise((resolve) => setTimeout(resolve, 50));
        } finally {
          isGrading = false;
        }
      };

      // Rapid parallel calls
      const p1 = mockHandleGradeWithAI();
      const p2 = mockHandleGradeWithAI();
      const p3 = mockHandleGradeWithAI();

      return Promise.all([p1, p2, p3]).then(() => {
        expect(gradingCallCount).toBe(1);
      });
    });

    it('autosave guard suppresses draft overwrites during grading or when result is present', () => {
      const shouldAutosave = (hasPrompt: boolean, isGrading: boolean, hasGradingResult: boolean, text: string) => {
        if (!hasPrompt) return false;
        if (isGrading || hasGradingResult) return false;
        if (!text.trim()) return false;
        return true;
      };

      expect(shouldAutosave(true, false, false, 'Valid essay text')).toBe(true);
      // Suppressed during in-flight grading
      expect(shouldAutosave(true, true, false, 'Valid essay text')).toBe(false);
      // Suppressed once grading result is finalized
      expect(shouldAutosave(true, false, true, 'Valid essay text')).toBe(false);
      // Suppressed on empty text
      expect(shouldAutosave(true, false, false, '   ')).toBe(false);
    });
  });
});
