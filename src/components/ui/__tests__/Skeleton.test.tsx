// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Skeleton, SkeletonText, SkeletonCard } from '../Skeleton';

describe('Skeleton Primitive Component', () => {
  it('1. Renders with role="status", aria-busy="true" and accessible label', () => {
    render(<Skeleton aria-label="Đang nạp dữ liệu thẻ..." />);
    const el = screen.getByRole('status');

    expect(el).toBeDefined();
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.getAttribute('aria-label')).toBe('Đang nạp dữ liệu thẻ...');
  });

  it('2. Includes animate-pulse and motion-reduce:animate-none classes', () => {
    render(<Skeleton />);
    const el = screen.getByRole('status');

    expect(el.className).toContain('animate-pulse');
    expect(el.className).toContain('motion-reduce:animate-none');
  });

  it('3. Respects animate=false for static skeleton placeholders', () => {
    render(<Skeleton animate={false} />);
    const el = screen.getByRole('status');

    expect(el.className).not.toContain('animate-pulse');
  });

  it('4. Preserves layout dimensions to prevent layout shifts', () => {
    render(<Skeleton width="200px" height="40px" className="custom-test-cls" />);
    const el = screen.getByRole('status');

    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('40px');
    expect(el.className).toContain('custom-test-cls');
  });

  it('5. SkeletonText renders text variant', () => {
    render(<SkeletonText />);
    const el = screen.getByRole('status');

    expect(el.className).toContain('h-4');
    expect(el.className).toContain('rounded-md');
  });

  it('6. SkeletonCard preserves multi-line card container dimensions', () => {
    render(<SkeletonCard lines={3} data-testid="card-skeleton" />);
    const card = screen.getByTestId('card-skeleton');

    expect(card.getAttribute('aria-busy')).toBe('true');
    // Finds inner skeleton elements
    const innerSkeletons = card.querySelectorAll('[role="status"]');
    // Header text + circular avatar + 3 lines = 5 placeholders
    expect(innerSkeletons.length).toBe(5);
  });
});
