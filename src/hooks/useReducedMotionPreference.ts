import { useState, useEffect } from 'react';

/**
 * Custom hook to detect user preference for reduced motion.
 * Safe for SSR, environments without window.matchMedia, and automated tests.
 */
export function useReducedMotionPreference(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    let mediaQueryList: MediaQueryList;
    try {
      mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return;
    }

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Initial sync
    setPrefersReducedMotion(mediaQueryList.matches);

    // Modern browsers
    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', listener);
      return () => {
        mediaQueryList.removeEventListener('change', listener);
      };
    }

    // Legacy Safari / Older browser fallback
    if (typeof mediaQueryList.addListener === 'function') {
      mediaQueryList.addListener(listener);
      return () => {
        mediaQueryList.removeListener(listener);
      };
    }
  }, []);

  return prefersReducedMotion;
}
