/**
 * Shared Motion & Micro-Interaction Tokens
 * English Mastery Hub - UI Motion Foundation (Phase 1)
 *
 * Principles:
 * - Presentation-only: Zero business logic or persistent state mutation.
 * - Performance: Animate transform & opacity only; avoid layout thrashing.
 * - Reduced Motion: First-class citizen via prefers-reduced-motion fallbacks.
 * - Consistency: Standardized FAST, NORMAL, SLOW timing hierarchy.
 */

export const MOTION_DURATIONS = {
  INSTANT: 0,
  FAST: 150,     // Micro-interactions, button hover/press, quick toggles (0.15s)
  NORMAL: 250,   // Modals, card appearance, dropdowns, expand/collapse (0.25s)
  SLOW: 400,     // Major celebrations, milestone transitions, multi-stage flows (0.4s)
} as const;

export type MotionDurationKey = keyof typeof MOTION_DURATIONS;

export const MOTION_EASINGS = {
  // Standard material-style cubic-bezier curves
  DEFAULT: [0.4, 0, 0.2, 1] as const,     // ease-in-out
  OUT: [0, 0, 0.2, 1] as const,           // decelerate (entering elements)
  IN: [0.4, 0, 1, 1] as const,            // accelerate (exiting elements)
  SPRING: [0.16, 1, 0.3, 1] as const,     // snappy natural response
} as const;

export const MOTION_TRANSFORMS = {
  HOVER_Y: -1,                            // Subtle 1px lift for clickable cards
  PRESS_SCALE_BUTTON: 0.97,               // Instant tactile feedback on button press
  PRESS_SCALE_CARD: 0.98,                 // Subtle tactile feedback on card press
  ENTER_Y_OFFSET: 6,                      // Gentle 6px slide for entering elements
} as const;

/**
 * Common Tailwind CSS class compositions for interaction states.
 * Fully compatible with Tailwind v4 and prefers-reduced-motion.
 */
export const INTERACTION_CLASSES = {
  // Clickable interactive card: 1px lift on hover, scale on press, reduced motion safe
  interactiveCard:
    'transition-all duration-200 hover:translate-y-[-1px] active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none cursor-pointer',

  // Primary interactive button: border/gradient shift, tactile press, ring focus-visible
  primaryButton:
    'transition-all duration-150 hover:scale-[1.02] active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',

  // Secondary/Ghost button: subtle background shift, focus-visible
  secondaryButton:
    'transition-all duration-150 hover:bg-slate-800 active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',

  // Standard keyboard focus ring (WCAG 2.1 AA compliant)
  focusVisibleRing:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',

  // Smooth progress bar fill
  progressBarFill:
    'transition-all duration-300 ease-out motion-reduce:transition-none',
} as const;

/**
 * Generates Framer Motion transition config taking reduced-motion into account.
 */
export function getMotionTransition(options?: {
  reducedMotion?: boolean;
  duration?: number;
  ease?: readonly [number, number, number, number] | string;
}) {
  if (options?.reducedMotion) {
    return {
      duration: MOTION_DURATIONS.INSTANT,
      ease: 'linear',
    };
  }

  return {
    duration: (options?.duration ?? MOTION_DURATIONS.NORMAL) / 1000,
    ease: options?.ease ?? MOTION_EASINGS.OUT,
  };
}

/**
 * Lightweight Framer Motion variants generator for entering modals/drawers.
 */
export function createModalVariants(reducedMotion = false) {
  if (reducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0 } },
      exit: { opacity: 0, transition: { duration: 0 } },
    };
  }

  return {
    hidden: { opacity: 0, scale: 0.96, y: MOTION_TRANSFORMS.ENTER_Y_OFFSET },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: MOTION_DURATIONS.NORMAL / 1000,
        ease: MOTION_EASINGS.OUT,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      y: MOTION_TRANSFORMS.ENTER_Y_OFFSET,
      transition: {
        duration: MOTION_DURATIONS.FAST / 1000,
        ease: MOTION_EASINGS.IN,
      },
    },
  };
}

/**
 * Lightweight Framer Motion variants generator for list item / card entry.
 */
export function createFadeInVariants(reducedMotion = false) {
  if (reducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0 } },
      exit: { opacity: 0, transition: { duration: 0 } },
    };
  }

  return {
    hidden: { opacity: 0, y: MOTION_TRANSFORMS.ENTER_Y_OFFSET },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: MOTION_DURATIONS.FAST / 1000,
        ease: MOTION_EASINGS.OUT,
      },
    },
    exit: {
      opacity: 0,
      y: -MOTION_TRANSFORMS.ENTER_Y_OFFSET,
      transition: {
        duration: MOTION_DURATIONS.FAST / 1000,
        ease: MOTION_EASINGS.IN,
      },
    },
  };
}
