// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import confetti from 'canvas-confetti';
import {
  isConfettiAllowedForTier,
  triggerCelebration,
} from '../confettiPolicy';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('Celebration & Confetti Policy', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    vi.clearAllMocks();
    window.matchMedia = originalMatchMedia;
  });

  it('1. Blocks confetti for micro events according to policy', () => {
    expect(isConfettiAllowedForTier('micro')).toBe(false);

    const triggered = triggerCelebration('micro');
    expect(triggered).toBe(false);
    expect(confetti).not.toHaveBeenCalled();
  });

  it('2. Permits celebration for completion and major_milestone tiers', () => {
    expect(isConfettiAllowedForTier('completion')).toBe(true);
    expect(isConfettiAllowedForTier('major_milestone')).toBe(true);

    const triggeredCompletion = triggerCelebration('completion');
    expect(triggeredCompletion).toBe(true);
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 35,
        disableForReducedMotion: true,
      })
    );

    const triggeredMilestone = triggerCelebration('major_milestone');
    expect(triggeredMilestone).toBe(true);
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 75,
        disableForReducedMotion: true,
      })
    );
  });

  it('3. Suppresses celebration when user prefers reduced motion', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const triggered = triggerCelebration('major_milestone');
    expect(triggered).toBe(false);
    expect(confetti).not.toHaveBeenCalled();
  });
});
