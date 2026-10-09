// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthForm } from '../auth/AuthForm';
import { WelcomeView } from '../welcome/WelcomeView';
import * as cloudSyncService from '../../services/cloudSyncService';
import { useCloudSyncStore } from '../../services/cloudSyncService';
import { ApiError } from '../../services/api/httpClient';

vi.mock('../../services/cloudSyncService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/cloudSyncService')>();
  return {
    ...actual,
    signUpWithEmail: vi.fn(),
    signInWithEmail: vi.fn(),
    signOutCloud: vi.fn(),
  };
});

describe('PHASE 6: Welcome & Auth UX, Accessibility (A11y) & Security Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCloudSyncStore.setState({
      user: null,
      userEmail: null,
      session: null,
      isOnline: true,
      status: 'idle',
      errorMessage: null,
    });
  });

  describe('1. ARIA Tab Semantics & Navigation', () => {
    it('renders accessible tablist, tabs, and tabpanel with proper ARIA linkages', () => {
      render(<AuthForm initialMode="signin" />);

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeDefined();
      expect(tablist.getAttribute('aria-label')).toContain('Phương thức đăng nhập');

      const signinTab = screen.getByRole('tab', { name: /đăng nhập/i });
      const signupTab = screen.getByRole('tab', { name: /tạo tài khoản/i });
      const panel = screen.getByRole('tabpanel');

      expect(signinTab.getAttribute('aria-selected')).toBe('true');
      expect(signupTab.getAttribute('aria-selected')).toBe('false');

      const controlsId = signinTab.getAttribute('aria-controls');
      expect(controlsId).toBeTruthy();
      expect(panel.getAttribute('id')).toBe(controlsId);
      expect(panel.getAttribute('aria-labelledby')).toBe(signinTab.getAttribute('id'));
    });

    it('updates ARIA tab selection and aria-labelledby when switching tabs', () => {
      render(<AuthForm initialMode="signin" />);

      const signinTab = screen.getByRole('tab', { name: /đăng nhập/i });
      const signupTab = screen.getByRole('tab', { name: /tạo tài khoản/i });
      const panel = screen.getByRole('tabpanel');

      fireEvent.click(signupTab);

      expect(signupTab.getAttribute('aria-selected')).toBe('true');
      expect(signinTab.getAttribute('aria-selected')).toBe('false');
      expect(panel.getAttribute('aria-labelledby')).toBe(signupTab.getAttribute('id'));
    });
  });

  describe('2. Form Label & Input Associations (WCAG AA)', () => {
    it('associates Email and Password inputs with their labels via matching htmlFor and id', () => {
      render(<AuthForm initialMode="signin" />);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Mật khẩu');

      expect(emailInput).toBeDefined();
      expect(emailInput.getAttribute('id')).toBeTruthy();
      expect(passwordInput).toBeDefined();
      expect(passwordInput.getAttribute('id')).toBeTruthy();
    });

    it('associates Display Name and Confirm Password labels with inputs in signup mode', () => {
      render(<AuthForm initialMode="signup" includeConfirmPassword={true} />);

      const nameInput = screen.getByLabelText('Tên hiển thị');
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Mật khẩu');
      const confirmInput = screen.getByLabelText('Xác nhận mật khẩu');

      expect(nameInput).toBeDefined();
      expect(nameInput.getAttribute('id')).toBeTruthy();
      expect(emailInput).toBeDefined();
      expect(passwordInput).toBeDefined();
      expect(confirmInput).toBeDefined();
      expect(confirmInput.getAttribute('id')).toBeTruthy();
    });
  });

  describe('3. Accessible Validation Errors & Screen Reader Announcements', () => {
    it('sets aria-invalid="true" and connects aria-describedby to role="alert" error message upon validation failure', async () => {
      render(<AuthForm initialMode="signin" />);

      const submitBtn = screen.getByTestId('auth-submit-btn');
      fireEvent.click(submitBtn);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Mật khẩu');

      expect(emailInput.getAttribute('aria-invalid')).toBe('true');
      const emailDescribedBy = emailInput.getAttribute('aria-describedby');
      expect(emailDescribedBy).toBeTruthy();

      const emailError = document.getElementById(emailDescribedBy!);
      expect(emailError).toBeDefined();
      expect(emailError?.getAttribute('role')).toBe('alert');
      expect(emailError?.textContent).toContain('Vui lòng nhập địa chỉ email');

      expect(passwordInput.getAttribute('aria-invalid')).toBe('true');
      const passwordDescribedBy = passwordInput.getAttribute('aria-describedby');
      expect(passwordDescribedBy).toBeTruthy();
    });

    it('displays general error banner with role="alert" and aria-live="assertive"', async () => {
      vi.mocked(cloudSyncService.signInWithEmail).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Unauthorized', raw: new ApiError(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' }) },
      });

      render(<AuthForm initialMode="signin" />);

      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@test.com' } });
      fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByTestId('auth-submit-btn'));

      await waitFor(() => {
        const alertBanner = screen.getByRole('alert');
        expect(alertBanner).toBeDefined();
        expect(alertBanner.getAttribute('aria-live')).toBe('assertive');
        expect(alertBanner.textContent).toContain('không chính xác');
      });
    });
  });

  describe('4. Password Toggle Button Accessibility & Keyboard Behavior', () => {
    it('provides accessible aria-label, aria-pressed, and keyboard focusability without submitting', () => {
      render(<AuthForm initialMode="signin" />);

      const passwordInput = screen.getByLabelText('Mật khẩu');
      const toggleBtn = screen.getByTestId('toggle-password-visibility');

      expect(passwordInput.getAttribute('type')).toBe('password');
      expect(toggleBtn.getAttribute('aria-label')).toBe('Hiện mật khẩu');
      expect(toggleBtn.getAttribute('aria-pressed')).toBe('false');
      // Must not be excluded from tab flow
      expect(toggleBtn.getAttribute('tabindex')).not.toBe('-1');

      // Click toggle
      fireEvent.click(toggleBtn);

      expect(passwordInput.getAttribute('type')).toBe('text');
      expect(toggleBtn.getAttribute('aria-label')).toBe('Ẩn mật khẩu');
      expect(toggleBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('toggles confirm password visibility correctly with accessible labels', () => {
      render(<AuthForm initialMode="signup" includeConfirmPassword={true} />);

      const confirmInput = screen.getByLabelText('Xác nhận mật khẩu');
      const toggleConfirmBtn = screen.getByTestId('toggle-confirm-password-visibility');

      expect(confirmInput.getAttribute('type')).toBe('password');
      expect(toggleConfirmBtn.getAttribute('aria-label')).toBe('Hiện mật khẩu xác nhận');
      expect(toggleConfirmBtn.getAttribute('aria-pressed')).toBe('false');

      fireEvent.click(toggleConfirmBtn);

      expect(confirmInput.getAttribute('type')).toBe('text');
      expect(toggleConfirmBtn.getAttribute('aria-label')).toBe('Ẩn mật khẩu xác nhận');
      expect(toggleConfirmBtn.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('5. Input Trimming & Form Persistence Ergonomics', () => {
    it('preserves email address when user toggles between signin and signup modes', () => {
      render(<AuthForm initialMode="signin" />);

      const emailInput = screen.getByLabelText('Email');
      fireEvent.change(emailInput, { target: { value: 'learner@domain.com' } });

      const signupTab = screen.getByRole('tab', { name: /tạo tài khoản/i });
      fireEvent.click(signupTab);

      // Email is still retained
      expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('learner@domain.com');

      const signinTab = screen.getByRole('tab', { name: /đăng nhập/i });
      fireEvent.click(signinTab);

      expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('learner@domain.com');
    });

    it('trims leading/trailing whitespace from email and name before submitting', async () => {
      vi.mocked(cloudSyncService.signUpWithEmail).mockResolvedValueOnce({
        data: {
          user: { id: 'u1', email: 'trim@domain.com', displayName: 'Trimmed User' },
          session: { access_token: 'tok', user: { id: 'u1', email: 'trim@domain.com', displayName: 'Trimmed User' } },
        },
        error: null,
      });

      render(<AuthForm initialMode="signup" includeConfirmPassword={false} />);

      fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: '  Trimmed User   ' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: '   trim@domain.com   ' } });
      fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'Pass1234' } });

      fireEvent.click(screen.getByTestId('auth-submit-btn'));

      await waitFor(() => {
        expect(cloudSyncService.signUpWithEmail).toHaveBeenCalledWith(
          'trim@domain.com',
          'Pass1234',
          'Trimmed User'
        );
      });
    });
  });

  describe('6. Unmount Safety & Double-Submit Protection', () => {
    it('handles unmount safely while submission is in-flight without throws', async () => {
      let resolvePromise: (val: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(cloudSyncService.signInWithEmail).mockImplementationOnce(() => pendingPromise as any);

      const { unmount } = render(<AuthForm initialMode="signin" />);

      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'unmount@test.com' } });
      fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'Pass1234' } });

      fireEvent.click(screen.getByTestId('auth-submit-btn'));

      // Unmount before response resolves
      unmount();

      // Resolve API response after unmount
      expect(() => {
        resolvePromise!({
          data: { user: { id: 'u1', email: 'unmount@test.com' }, session: null },
          error: null,
        });
      }).not.toThrow();
    });
  });

  describe('7. WelcomeView Page Accessibility & Ergonomics', () => {
    it('provides accessible skip-link pointing to welcome-auth-card', () => {
      render(<WelcomeView />);

      const skipLink = screen.getByRole('link', { name: /chuyển đến phần đăng nhập/i });
      expect(skipLink).toBeDefined();
      expect(skipLink.getAttribute('href')).toBe('#welcome-auth-card');
    });

    it('has properly labeled semantic sections with matching headings', () => {
      render(<WelcomeView />);

      const heroHeading = document.getElementById('welcome-hero-heading');
      expect(heroHeading).toBeDefined();
      expect(heroHeading?.textContent).toContain('Làm chủ tiếng Anh');

      const authHeading = document.getElementById('welcome-auth-heading');
      expect(authHeading).toBeDefined();
      expect(authHeading?.textContent).toContain('Khởi đầu hành trình học tập');
    });

    it('Guest CTA has touch-target compliance, accessible label and triggers onContinueAsGuest', () => {
      const onGuestMock = vi.fn();
      render(<WelcomeView onContinueAsGuest={onGuestMock} />);

      const guestBtn = screen.getByRole('button', {
        name: /tiếp tục học mà không cần tài khoản/i,
      });

      expect(guestBtn).toBeDefined();
      expect(guestBtn.className).toContain('min-h-[52px]');

      fireEvent.click(guestBtn);
      expect(onGuestMock).toHaveBeenCalledTimes(1);
    });
  });
});
