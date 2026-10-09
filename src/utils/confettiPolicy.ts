import confetti from 'canvas-confetti';

/**
 * Celebration tiers aligned with UX Celebration Policy:
 * - 'micro': Single correct answer, routine flashcard rating, single word saved, small XP. (Confetti BLOCKED)
 * - 'completion': Entire exam/session completion, full review deck completed. (Controlled burst)
 * - 'major_milestone': CEFR level completion, weekly leaderboard podium, major streak milestone. (Full celebration)
 */
export type CelebrationTier = 'micro' | 'completion' | 'major_milestone';

export interface CelebrationOptions extends confetti.Options {
  tier?: CelebrationTier;
}

/**
 * Determines whether confetti celebration is permitted for a given event tier.
 */
export function isConfettiAllowedForTier(tier: CelebrationTier): boolean {
  return tier === 'completion' || tier === 'major_milestone';
}

/**
 * Policy-guarded confetti trigger.
 * Automatically injects disableForReducedMotion: true and blocks micro-event spam.
 */
export function triggerCelebration(
  tier: CelebrationTier,
  customOptions?: confetti.Options
): boolean {
  if (!isConfettiAllowedForTier(tier)) {
    // Micro success events are strictly prohibited from triggering full-screen confetti
    return false;
  }

  // Double check client-side prefers-reduced-motion media query if available
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return false;
  }

  const defaultParticleCounts: Record<CelebrationTier, number> = {
    micro: 0,
    completion: 35,
    major_milestone: 75,
  };

  const finalOptions: confetti.Options = {
    particleCount: defaultParticleCounts[tier],
    spread: tier === 'major_milestone' ? 70 : 50,
    origin: { y: 0.6 },
    disableForReducedMotion: true, // Always enforce WCAG 2.1 guideline
    ...customOptions,
  };

  try {
    confetti(finalOptions);
    return true;
  } catch {
    // Graceful fallback if canvas is unavailable or context failed
    return false;
  }
}
