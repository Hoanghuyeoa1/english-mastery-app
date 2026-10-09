// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { SuccessFeedback } from '../SuccessFeedback';

describe('SuccessFeedback Primitive Component', () => {
  it('1. Renders with role="status" and aria-live="polite" for assistive technology', () => {
    render(<SuccessFeedback message="Đã lưu thành công" />);
    const feedback = screen.getByRole('status');

    expect(feedback).toBeDefined();
    expect(feedback.getAttribute('aria-live')).toBe('polite');
    expect(feedback.textContent).toContain('Đã lưu thành công');
  });

  it('2. Includes motion-reduce:transition-none for accessible transition safety', () => {
    render(<SuccessFeedback />);
    const feedback = screen.getByTestId('micro-success-feedback');

    expect(feedback.className).toContain('motion-reduce:transition-none');
    expect(feedback.className).toContain('bg-emerald-500/15');
  });

  it('3. Auto dismisses after autoDismissMs timer expires', () => {
    vi.useFakeTimers();
    const onDismissMock = vi.fn();

    render(<SuccessFeedback message="Done!" autoDismissMs={1500} onDismiss={onDismissMock} />);
    expect(screen.getByText('Done!')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.queryByText('Done!')).toBeNull();
    expect(onDismissMock).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
