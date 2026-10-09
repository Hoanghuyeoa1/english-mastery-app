import { describe, it, expect } from 'vitest';
import {
  MOTION_DURATIONS,
  MOTION_EASINGS,
  MOTION_TRANSFORMS,
  INTERACTION_CLASSES,
  getMotionTransition,
  createModalVariants,
  createFadeInVariants,
} from '../motionTokens';

describe('motionTokens Foundation', () => {
  it('1. Enforces consistent timing hierarchy (INSTANT < FAST < NORMAL < SLOW)', () => {
    expect(MOTION_DURATIONS.INSTANT).toBe(0);
    expect(MOTION_DURATIONS.FAST).toBeLessThan(MOTION_DURATIONS.NORMAL);
    expect(MOTION_DURATIONS.NORMAL).toBeLessThan(MOTION_DURATIONS.SLOW);
    expect(MOTION_DURATIONS.FAST).toBe(150);
    expect(MOTION_DURATIONS.NORMAL).toBe(250);
    expect(MOTION_DURATIONS.SLOW).toBe(400);
  });

  it('2. Defines standard cubic-bezier curves for easings', () => {
    expect(MOTION_EASINGS.DEFAULT).toHaveLength(4);
    expect(MOTION_EASINGS.OUT).toEqual([0, 0, 0.2, 1]);
    expect(MOTION_EASINGS.IN).toEqual([0.4, 0, 1, 1]);
  });

  it('3. Defines subtle, non-disruptive transforms', () => {
    expect(MOTION_TRANSFORMS.HOVER_Y).toBe(-1); // Max 1-2px lift
    expect(MOTION_TRANSFORMS.PRESS_SCALE_BUTTON).toBeGreaterThanOrEqual(0.95);
    expect(MOTION_TRANSFORMS.PRESS_SCALE_BUTTON).toBeLessThan(1.0);
    expect(MOTION_TRANSFORMS.PRESS_SCALE_CARD).toBeGreaterThanOrEqual(0.97);
  });

  it('4. Interaction classes include focus-visible and motion-reduce utilities', () => {
    expect(INTERACTION_CLASSES.interactiveCard).toContain('motion-reduce:transform-none');
    expect(INTERACTION_CLASSES.interactiveCard).toContain('motion-reduce:transition-none');
    expect(INTERACTION_CLASSES.primaryButton).toContain('focus-visible:ring-2');
    expect(INTERACTION_CLASSES.primaryButton).toContain('motion-reduce:transform-none');
    expect(INTERACTION_CLASSES.secondaryButton).toContain('focus-visible:ring-2');
    expect(INTERACTION_CLASSES.focusVisibleRing).toContain('focus-visible:ring-2');
    expect(INTERACTION_CLASSES.progressBarFill).toContain('motion-reduce:transition-none');
  });

  describe('Reduced Motion Transitions & Variants', () => {
    it('5. Collapses Framer Motion transition duration to 0 when reducedMotion is true', () => {
      const normalTransition = getMotionTransition({ reducedMotion: false, duration: 250 });
      expect(normalTransition.duration).toBe(0.25);

      const reducedTransition = getMotionTransition({ reducedMotion: true, duration: 250 });
      expect(reducedTransition.duration).toBe(0);
      expect(reducedTransition.ease).toBe('linear');
    });

    it('6. Modal variants collapse scale and enter transforms when reducedMotion is true', () => {
      const normal = createModalVariants(false);
      expect(normal.hidden).toHaveProperty('scale', 0.96);
      expect(normal.hidden).toHaveProperty('y');

      const reduced = createModalVariants(true);
      expect(reduced.hidden).not.toHaveProperty('scale');
      expect(reduced.hidden).not.toHaveProperty('y');
      expect(reduced.visible.transition.duration).toBe(0);
      expect(reduced.exit.transition.duration).toBe(0);
    });

    it('7. Fade-in variants collapse Y translation when reducedMotion is true', () => {
      const normal = createFadeInVariants(false);
      expect(normal.hidden).toHaveProperty('y', MOTION_TRANSFORMS.ENTER_Y_OFFSET);

      const reduced = createFadeInVariants(true);
      expect(reduced.hidden).not.toHaveProperty('y');
      expect(reduced.visible.transition.duration).toBe(0);
      expect(reduced.exit.transition.duration).toBe(0);
    });
  });
});
