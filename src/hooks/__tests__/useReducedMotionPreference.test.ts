// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotionPreference } from '../useReducedMotionPreference';

describe('useReducedMotionPreference Hook', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('1. Returns false when prefers-reduced-motion does not match', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useReducedMotionPreference());
    expect(result.current).toBe(false);
  });

  it('2. Returns true when prefers-reduced-motion matches', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useReducedMotionPreference());
    expect(result.current).toBe(true);
  });

  it('3. Safely falls back to false when matchMedia is unavailable', () => {
    // @ts-expect-error simulating legacy/unsupported environment
    window.matchMedia = undefined;

    const { result } = renderHook(() => useReducedMotionPreference());
    expect(result.current).toBe(false);
  });

  it('4. Responds dynamically to preference change events and unbinds on unmount', () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | null = null;
    const removeEventListenerMock = vi.fn();

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') changeHandler = handler;
      }),
      removeEventListener: removeEventListenerMock,
      dispatchEvent: vi.fn(),
    }));

    const { result, unmount } = renderHook(() => useReducedMotionPreference());
    expect(result.current).toBe(false);
    expect(changeHandler).not.toBeNull();

    // Trigger media query change event
    act(() => {
      changeHandler?.({ matches: true } as MediaQueryListEvent);
    });
    expect(result.current).toBe(true);

    // Unmount hook
    unmount();
    expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
