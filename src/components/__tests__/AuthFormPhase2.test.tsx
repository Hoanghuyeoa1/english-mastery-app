// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthForm } from '../auth/AuthForm';
import { classifyAuthError } from '../auth/classifyAuthError';
import { AuthSyncModal } from '../AuthSyncModal';
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

describe('PHASE 2 — Reusable AuthForm & Request Lifecycle Tests', () => {
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

  describe('1. Error Classification Unit Tests', () => {
    it('classifies 401 Unauthorized as authentication_error', () => {
      const err = new ApiError(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });
      const classified = classifyAuthError(err);
      expect(classified.lifecycle).toBe('authentication_error');
      expect(classified.message).toContain('không chính xác');
    });

    it('classifies 409 Conflict as validation_error with fieldErrors', () => {
      const err = new ApiError(409, { code: 'CONFLICT', message: 'Email đã tồn tại' });
      const classified = classifyAuthError(err);
      expect(classified.lifecycle).toBe('validation_error');
      expect(classified.message).toContain('đã được sử dụng');
      expect(classified.fieldErrors?.email).toContain('đã được sử dụng');
    });

    it('classifies 400 Validation as validation_error', () => {
      const err = new ApiError(400, { code: 'VALIDATION_FAILED', message: 'Mật khẩu thiếu chữ số' });
      const classified = classifyAuthError(err);
      expect(classified.lifecycle).toBe('validation_error');
      expect(classified.message).toBe('Mật khẩu thiếu chữ số');
    });

    it('classifies Network / 0 status as network_error', () => {
      const err = new ApiError(0, { code: 'NETWORK_ERROR', message: 'Failed to fetch' });
      const classified = classifyAuthError(err);
      expect(classified.lifecycle).toBe('network_error');
      expect(classified.message).toContain('kết nối mạng');
    });

    it('classifies 408 Timeout as network_error', () => {
      const err = new ApiError(408, { code: 'TIMEOUT', message: 'Timeout' });
      const classified = classifyAuthError(err);
      expect(classified.lifecycle).toBe('network_error');
      expect(classified.message).toContain('thời gian phản hồi');
    });

    it('classifies 500 / 503 Server / Database errors as server_unavailable', () => {
      const err500 = new ApiError(500, { code: 'SERVER_ERROR', message: 'Internal Server Error' });
      expect(classifyAuthError(err500).lifecycle).toBe('server_unavailable');

      const err503 = new ApiError(503, { code: 'DATABASE_ERROR', message: 'Database down' });
      expect(classifyAuthError(err503).lifecycle).toBe('server_unavailable');
    });
  });

  describe('2. Login Form Flow', () => {
    it('successfully logs in with valid credentials and invokes onSuccess', async () => {
      const onSuccess = vi.fn();
      const mockUser = { id: 'user-guid-1', email: 'test@example.com', displayName: 'Hoàng Anh' };

      vi.mocked(cloudSyncService.signInWithEmail).mockResolvedValueOnce({
        data: {
          user: mockUser,
          session: { access_token: 'fake-jwt-token', user: mockUser },
        },
        error: null,
      });

      render(<AuthForm initialMode="signin" onSuccess={onSuccess} />);

      fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'Password123!' },
      });

      const submitBtn = screen.getByTestId('auth-submit-btn');
      fireEvent.click(submitBtn);

      expect(cloudSyncService.signInWithEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Password123!'
      );
      expect(await screen.findByText('Đăng nhập thành công!')).toBeDefined();
      expect(onSuccess).toHaveBeenCalledWith(mockUser);
    });

    it('displays authentication_error when login credentials are wrong', async () => {
      const onSuccess = vi.fn();
      vi.mocked(cloudSyncService.signInWithEmail).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          message: 'Email hoặc mật khẩu không chính xác.',
          raw: new ApiError(401, { code: 'UNAUTHORIZED', message: 'Invalid credentials' }),
        },
      });

      render(<AuthForm initialMode="signin" onSuccess={onSuccess} />);

      fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
        target: { value: 'wrong@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'WrongPass123' },
      });

      fireEvent.click(screen.getByTestId('auth-submit-btn'));

      expect(await screen.findByText('Email hoặc mật khẩu không chính xác.')).toBeDefined();
      expect(onSuccess).not.toHaveBeenCalled();
      // Form values are preserved
      expect((screen.getByPlaceholderText('name@example.com') as HTMLInputElement).value).toBe(
        'wrong@example.com'
      );
    });

    it('handles network error during login without crashing', async () => {
      vi.mocked(cloudSyncService.signInWithEmail).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.',
          raw: new ApiError(0, { code: 'NETWORK_ERROR', message: 'Failed to fetch' }),
        },
      });

      render(<AuthForm initialMode="signin" />);

      fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
        target: { value: 'offline@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'Password123' },
      });

      fireEvent.click(screen.getByTestId('auth-submit-btn'));

      expect(
        await screen.findByText(
          'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.'
        )
      ).toBeDefined();
    });
  });

  describe('3. Register Form Flow & Validation', () => {
    it('successfully registers with confirm password enabled and calls signUpWithEmail', async () => {
      const onSuccess = vi.fn();
      const mockUser = { id: 'reg-guid-2', email: 'reg@example.com', displayName: 'Minh Tuấn' };

      vi.mocked(cloudSyncService.signUpWithEmail).mockResolvedValueOnce({
        data: {
          user: mockUser,
          session: { access_token: 'new-jwt-token', user: mockUser },
        },
        error: null,
      });

      render(<AuthForm initialMode="signup" includeConfirmPassword={true} onSuccess={onSuccess} />);

      fireEvent.change(screen.getByPlaceholderText('Ví dụ: Hoàng Anh'), {
        target: { value: 'Minh Tuấn' },
      });
      fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
        target: { value: 'reg@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'ValidPass123' },
      });
      fireEvent.change(screen.getByPlaceholderText('Nhập lại mật khẩu'), {
        target: { value: 'ValidPass123' },
      });

      const submitBtn = screen.getByTestId('auth-submit-btn');
      fireEvent.click(submitBtn);

      expect(cloudSyncService.signUpWithEmail).toHaveBeenCalledWith(
        'reg@example.com',
        'ValidPass123',
        'Minh Tuấn'
      );
      expect(
        await screen.findByText('Đăng ký tài khoản thành công! Bạn đã có thể bắt đầu học.')
      ).toBeDefined();
      expect(onSuccess).toHaveBeenCalledWith(mockUser);
    });

    it('rejects client validation when confirm password does not match', async () => {
      render(<AuthForm initialMode="signup" includeConfirmPassword={true} />);

      fireEvent.change(screen.getByPlaceholderText('Ví dụ: Hoàng Anh'), {
        target: { value: 'Test User' },
      });
      fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'Password123' },
      });
      fireEvent.change(screen.getByPlaceholderText('Nhập lại mật khẩu'), {
        target: { value: 'DifferentPass456' },
      });

      fireEvent.click(screen.getByTestId('auth-submit-btn'));

      expect(await screen.findByText('Mật khẩu xác nhận không trùng khớp.')).toBeDefined();
      expect(cloudSyncService.signUpWithEmail).not.toHaveBeenCalled();
    });

    it('rejects client validation when required fields are missing or invalid', async () => {
      render(<AuthForm initialMode="signup" includeConfirmPassword={true} />);

      const submitBtn = screen.getByTestId('auth-submit-btn');

      // 1. Missing email
      fireEvent.click(submitBtn);
      expect(await screen.findByText('Vui lòng nhập địa chỉ email.')).toBeDefined();
      expect(cloudSyncService.signUpWithEmail).not.toHaveBeenCalled();

      // 2. Invalid email format
      fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
        target: { value: 'invalid-email' },
      });
      fireEvent.click(submitBtn);
      expect(await screen.findByText('Định dạng email không hợp lệ.')).toBeDefined();

      // 3. Short password (< 6 chars)
      fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
        target: { value: 'valid@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: '123' },
      });
      fireEvent.click(submitBtn);
      expect(await screen.findByText('Mật khẩu phải có ít nhất 6 ký tự.')).toBeDefined();

      // 4. Missing display name
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'ValidPass1' },
      });
      fireEvent.click(submitBtn);
      expect(await screen.findByText('Vui lòng nhập tên hiển thị.')).toBeDefined();

      // 5. Missing digit in password
      fireEvent.change(screen.getByPlaceholderText('Ví dụ: Hoàng Anh'), {
        target: { value: 'Hoàng Anh' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'PasswordNoDigit' },
      });
      fireEvent.click(submitBtn);
      expect(
        await screen.findByText('Mật khẩu phải chứa ít nhất một chữ số (0-9).')
      ).toBeDefined();

      // 6. Missing confirm password
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'ValidPass1' },
      });
      fireEvent.click(submitBtn);
      expect(await screen.findByText('Vui lòng xác nhận mật khẩu.')).toBeDefined();
    });

    it('handles 409 Duplicate Email from backend gracefully without wiping inputs', async () => {
      vi.mocked(cloudSyncService.signUpWithEmail).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          message: 'Email này đã được sử dụng để đăng ký tài khoản.',
          raw: new ApiError(409, { code: 'CONFLICT', message: 'Email already exists' }),
        },
      });

      render(<AuthForm initialMode="signup" includeConfirmPassword={false} />);

      fireEvent.change(screen.getByPlaceholderText('Ví dụ: Hoàng Anh'), {
        target: { value: 'Nguyễn Văn A' },
      });
      fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
        target: { value: 'existing@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'Password123' },
      });

      fireEvent.click(screen.getByTestId('auth-submit-btn'));

      expect(
        await screen.findByText('Email này đã được sử dụng để đăng ký tài khoản.')
      ).toBeDefined();
      expect(
        (screen.getByPlaceholderText('name@example.com') as HTMLInputElement).value
      ).toBe('existing@example.com');
      expect(
        (screen.getByPlaceholderText('Ví dụ: Hoàng Anh') as HTMLInputElement).value
      ).toBe('Nguyễn Văn A');
    });

    it('handles 500 Backend Unavailable gracefully', async () => {
      vi.mocked(cloudSyncService.signUpWithEmail).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          message: 'Cơ sở dữ liệu tạm thời gián đoạn. Vui lòng thử lại sau.',
          raw: new ApiError(503, { code: 'DATABASE_ERROR', message: 'Service unavailable' }),
        },
      });

      render(<AuthForm initialMode="signup" includeConfirmPassword={false} />);

      fireEvent.change(screen.getByPlaceholderText('Ví dụ: Hoàng Anh'), {
        target: { value: 'User' },
      });
      fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'Password123' },
      });

      fireEvent.click(screen.getByTestId('auth-submit-btn'));

      expect(
        await screen.findByText(
          'Cơ sở dữ liệu hoặc máy chủ tạm thời gián đoạn. Vui lòng thử lại sau.'
        )
      ).toBeDefined();
    });
  });

  describe('4. Interactive Controls & State Transitions', () => {
    it('toggles password visibility between text and password types', () => {
      render(<AuthForm initialMode="signin" />);

      const passwordInput = screen.getByPlaceholderText('••••••••') as HTMLInputElement;
      expect(passwordInput.type).toBe('password');

      const toggleBtn = screen.getByTestId('toggle-password-visibility');
      fireEvent.click(toggleBtn);
      expect(passwordInput.type).toBe('text');

      fireEvent.click(toggleBtn);
      expect(passwordInput.type).toBe('password');
    });

    it('toggles confirm password visibility when confirm password is enabled', () => {
      render(<AuthForm initialMode="signup" includeConfirmPassword={true} />);

      const confirmInput = screen.getByPlaceholderText('Nhập lại mật khẩu') as HTMLInputElement;
      expect(confirmInput.type).toBe('password');

      const toggleConfirmBtn = screen.getByTestId('toggle-confirm-password-visibility');
      fireEvent.click(toggleConfirmBtn);
      expect(confirmInput.type).toBe('text');

      fireEvent.click(toggleConfirmBtn);
      expect(confirmInput.type).toBe('password');
    });

    it('switches between signin and signup modes via top tabs and footer links', () => {
      const onModeChange = vi.fn();
      render(<AuthForm initialMode="signin" onModeChange={onModeChange} />);

      // Initially in signin: no display name field
      expect(screen.queryByPlaceholderText('Ví dụ: Hoàng Anh')).toBeNull();

      // Switch to signup via tab
      const signupTab = screen.getByTestId('tab-signup');
      fireEvent.click(signupTab);
      expect(onModeChange).toHaveBeenCalledWith('signup');
      expect(screen.getByPlaceholderText('Ví dụ: Hoàng Anh')).toBeDefined();

      // Switch back via footer link
      const signinFooterLink = screen.getByRole('button', { name: 'Đăng nhập ngay' });
      fireEvent.click(signinFooterLink);
      expect(onModeChange).toHaveBeenCalledWith('signin');
      expect(screen.queryByPlaceholderText('Ví dụ: Hoàng Anh')).toBeNull();
    });

    it('preserves typed email when switching between signin and signup', () => {
      render(<AuthForm initialMode="signin" />);

      const emailInput = screen.getByPlaceholderText('name@example.com');
      fireEvent.change(emailInput, { target: { value: 'keepme@example.com' } });

      // Switch to signup
      fireEvent.click(screen.getByTestId('tab-signup'));
      expect((screen.getByPlaceholderText('name@example.com') as HTMLInputElement).value).toBe(
        'keepme@example.com'
      );
    });

    it('prevents double-submission with submit lock on rapid multiple clicks', async () => {
      let resolveSubmission: (val: any) => void;
      const delayedPromise = new Promise((resolve) => {
        resolveSubmission = resolve;
      });

      vi.mocked(cloudSyncService.signInWithEmail).mockImplementationOnce(
        () => delayedPromise as any
      );

      render(<AuthForm initialMode="signin" />);

      fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
        target: { value: 'rapid@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'Password123' },
      });

      const submitBtn = screen.getByTestId('auth-submit-btn');

      // Click 3 times rapidly
      fireEvent.click(submitBtn);
      fireEvent.click(submitBtn);
      fireEvent.click(submitBtn);

      expect(cloudSyncService.signInWithEmail).toHaveBeenCalledTimes(1);

      resolveSubmission!({
        data: {
          user: { id: 'u-1', email: 'rapid@example.com', displayName: 'Rapid' },
          session: { access_token: 'jwt', user: { id: 'u-1' } },
        },
        error: null,
      });

      await waitFor(() => {
        expect(cloudSyncService.signInWithEmail).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('5. Shared AuthSyncModal Integration Regression', () => {
    it('renders cleanly inside AuthSyncModal when user is not logged in', () => {
      render(<AuthSyncModal isOpen={true} onClose={() => {}} />);

      expect(screen.getByText('Tài khoản học viên')).toBeDefined();
      expect(screen.getByPlaceholderText('name@example.com')).toBeDefined();
      expect(screen.getByPlaceholderText('••••••••')).toBeDefined();
    });

    it('closes cleanly via close button on AuthSyncModal', () => {
      const onClose = vi.fn();
      render(<AuthSyncModal isOpen={true} onClose={onClose} />);

      const closeBtn = screen.getByTitle('Đóng');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
