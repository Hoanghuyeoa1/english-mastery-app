// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeView } from '../WelcomeView';
import { AuthForm } from '../auth/AuthForm';

// Mock cloudSyncService to avoid network calls
vi.mock('../../services/cloudSyncService', () => ({
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  signInWithGoogleExchange: vi.fn(),
  useCloudSyncStore: vi.fn((selector) => {
    const state = {
      user: null,
      userEmail: null,
      session: null,
      isOnline: true,
      status: 'idle',
      errorMessage: null,
    };
    return selector ? selector(state) : state;
  }),
}));

describe('PHASE 5: Welcome & Auth Double Scrollbar Elimination & Layout Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Single Scroll Container Architecture', () => {
    it('ensures WelcomeView root region does NOT declare overflow-x-hidden (which triggers browser overflow-y: auto)', () => {
      const { container } = render(<WelcomeView />);
      const rootRegion = container.querySelector('[role="region"][aria-label="Welcome and Authentication Landing"]');

      expect(rootRegion).toBeDefined();
      expect(rootRegion?.className).not.toContain('overflow-x-hidden');
      expect(rootRegion?.className).not.toContain('overflow-y-auto');
      expect(rootRegion?.className).not.toContain('overflow-scroll');
    });

    it('contains background ambient glow circles inside an absolute inset-0 overflow-hidden wrapper', () => {
      const { container } = render(<WelcomeView />);
      const rootRegion = container.querySelector('[role="region"][aria-label="Welcome and Authentication Landing"]');
      
      // Look for the background container with overflow-hidden
      const glowContainer = rootRegion?.querySelector('.absolute.inset-0.overflow-hidden');
      expect(glowContainer).toBeDefined();
      expect(glowContainer?.getAttribute('aria-hidden')).toBe('true');
      expect(glowContainer?.className).toContain('pointer-events-none');
    });

    it('contains right panel card ambient glow decorations inside card-bounded overflow-hidden wrapper', () => {
      const { container } = render(<WelcomeView />);
      const authCard = container.querySelector('#welcome-auth-card');
      expect(authCard).toBeDefined();

      const cardGlowWrapper = authCard?.querySelector('.absolute.inset-0.overflow-hidden.rounded-3xl');
      expect(cardGlowWrapper).toBeDefined();
      expect(cardGlowWrapper?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('2. A11y & Skip Link Navigation', () => {
    it('maintains accessible skip-to-content anchor pointing directly to #welcome-auth-card', () => {
      render(<WelcomeView />);
      const skipLink = screen.getByRole('link', { name: /Chuyển đến phần Đăng nhập/i });
      expect(skipLink).toBeDefined();
      expect(skipLink.getAttribute('href')).toBe('#welcome-auth-card');
      expect(skipLink.className).toContain('sr-only');
      expect(skipLink.className).toContain('focus:not-sr-only');
    });
  });

  describe('3. Auth Interactions & Mode Switching Within Clean Layout', () => {
    it('switches seamlessly between Sign In and Sign Up tabs without adding scroll containers', () => {
      const { container } = render(<WelcomeView />);

      const signinTab = screen.getByTestId('tab-signin');
      const signupTab = screen.getByTestId('tab-signup');
      expect(signinTab.getAttribute('aria-selected')).toBe('true');

      // Switch to signup
      fireEvent.click(signupTab);
      expect(signupTab.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByPlaceholderText('Ví dụ: Hoàng Anh')).toBeDefined();
      expect(screen.getByPlaceholderText('Nhập lại mật khẩu')).toBeDefined();

      // Ensure no scroll classes were injected dynamically
      const form = container.querySelector('form');
      expect(form?.className).not.toContain('overflow-y-auto');
    });

    it('preserves password visibility toggles and focusable states', () => {
      render(<WelcomeView />);
      const passwordInput = screen.getByPlaceholderText('••••••••');
      expect(passwordInput.getAttribute('type')).toBe('password');

      const toggleBtn = screen.getByTestId('toggle-password-visibility');
      fireEvent.click(toggleBtn);
      expect(passwordInput.getAttribute('type')).toBe('text');
    });

    it('wires Guest CTA and triggers callback on click', () => {
      const handleGuest = vi.fn();
      render(<WelcomeView onContinueAsGuest={handleGuest} />);

      const guestBtn = screen.getByRole('button', { name: /Tiếp tục học mà không cần tài khoản/i });
      fireEvent.click(guestBtn);
      expect(handleGuest).toHaveBeenCalledTimes(1);
    });
  });
});
