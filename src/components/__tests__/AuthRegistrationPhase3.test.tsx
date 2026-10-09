// @vitest-environment happy-dom
// src/components/__tests__/AuthRegistrationPhase3.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthSyncModal } from '../AuthSyncModal';
import * as cloudSyncService from '../../services/cloudSyncService';
import { useCloudSyncStore } from '../../services/cloudSyncService';

vi.mock('../../services/cloudSyncService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/cloudSyncService')>();
  return {
    ...actual,
    signUpWithEmail: vi.fn(),
    signInWithEmail: vi.fn(),
    signOutCloud: vi.fn(),
  };
});

describe('PHASE 3 — Auth Registration End-to-End Client Tests', () => {
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

  it('renders "Tạo tài khoản" tab with policy hint and display name field', () => {
    render(<AuthSyncModal isOpen={true} onClose={() => {}} />);

    const signupTab = screen.getByTestId('tab-signup');
    fireEvent.click(signupTab);

    expect(screen.getByText('Tên hiển thị')).toBeDefined();
    expect(screen.getByPlaceholderText('Ví dụ: Hoàng Anh')).toBeDefined();
    expect(screen.getByPlaceholderText('name@example.com')).toBeDefined();
    expect(screen.getByPlaceholderText('••••••••')).toBeDefined();
    expect(screen.getByText('Mật khẩu tối thiểu 6 ký tự, gồm ít nhất 1 chữ số (0-9).')).toBeDefined();
  });

  it('rejects invalid inputs on client side without calling API', async () => {
    const { container } = render(<AuthSyncModal isOpen={true} onClose={() => {}} />);

    const signupTab = screen.getByTestId('tab-signup');
    fireEvent.click(signupTab);

    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    // 1. Missing email
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Vui lòng nhập địa chỉ email.')).toBeDefined();
    expect(cloudSyncService.signUpWithEmail).not.toHaveBeenCalled();

    // 2. Invalid email format
    const emailInput = screen.getByPlaceholderText('name@example.com');
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Định dạng email không hợp lệ.')).toBeDefined();
    expect(cloudSyncService.signUpWithEmail).not.toHaveBeenCalled();

    // 3. Valid email, missing password
    fireEvent.change(emailInput, { target: { value: 'student@example.com' } });
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Vui lòng nhập mật khẩu.')).toBeDefined();

    // 4. Password too short (< 6 chars)
    const passwordInput = screen.getByPlaceholderText('••••••••');
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Mật khẩu phải có ít nhất 6 ký tự.')).toBeDefined();

    // 5. Missing display name
    fireEvent.change(passwordInput, { target: { value: 'ValidPass1' } });
    const nameInput = screen.getByPlaceholderText('Ví dụ: Hoàng Anh');
    fireEvent.change(nameInput, { target: { value: '   ' } });
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Vui lòng nhập tên hiển thị.')).toBeDefined();

    // 6. Password lacks digit
    fireEvent.change(nameInput, { target: { value: 'Hoàng Anh' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPasswordNoDigit' } });
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Mật khẩu phải chứa ít nhất một chữ số (0-9).')).toBeDefined();
    expect(cloudSyncService.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('displays truthful backend error message without swallowing into "Đã có lỗi xảy ra"', async () => {
    vi.mocked(cloudSyncService.signUpWithEmail).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Email này đã được sử dụng để đăng ký tài khoản.', raw: null },
    });

    const { container } = render(<AuthSyncModal isOpen={true} onClose={() => {}} />);

    const signupTab = screen.getByTestId('tab-signup');
    fireEvent.click(signupTab);

    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Hoàng Anh'), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), { target: { value: 'dup@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'Password123!' } });

    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Email này đã được sử dụng để đăng ký tài khoản.')).toBeDefined();
    expect(screen.queryByText('Đã có lỗi xảy ra')).toBeNull();
  });

  it('prevents duplicate submissions with submit lock when user clicks repeatedly', async () => {
    let resolvePromise: (value: any) => void;
    const slowPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(cloudSyncService.signUpWithEmail).mockImplementationOnce(() => slowPromise as any);

    const { container } = render(<AuthSyncModal isOpen={true} onClose={() => {}} />);

    const signupTab = screen.getByTestId('tab-signup');
    fireEvent.click(signupTab);

    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Hoàng Anh'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), { target: { value: 'rapid@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'Secret123!' } });

    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    // First click initiates submission
    fireEvent.click(submitBtn);
    // Rapid duplicate clicks
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    expect(cloudSyncService.signUpWithEmail).toHaveBeenCalledTimes(1);

    // Complete the call
    resolvePromise!({
      data: {
        user: { id: 'guid-123', email: 'rapid@example.com', displayName: 'Test User' },
        session: { access_token: 'fake-jwt', user: { id: 'guid-123' } },
      },
      error: null,
    });

    await waitFor(() => {
      expect(cloudSyncService.signUpWithEmail).toHaveBeenCalledTimes(1);
    });
  });

  it('displays success feedback upon successful registration', async () => {
    vi.mocked(cloudSyncService.signUpWithEmail).mockResolvedValueOnce({
      data: {
        user: { id: 'new-user-guid', email: 'success@example.com', displayName: 'Học Viên Mới' },
        session: { access_token: 'mock-jwt-token', user: { id: 'new-user-guid' } },
      },
      error: null,
    });

    const { container } = render(<AuthSyncModal isOpen={true} onClose={() => {}} />);

    const signupTab = screen.getByTestId('tab-signup');
    fireEvent.click(signupTab);

    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Hoàng Anh'), { target: { value: 'Học Viên Mới' } });
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), { target: { value: 'success@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'Password123' } });

    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Đăng ký tài khoản thành công! Bạn đã có thể bắt đầu học.')).toBeDefined();
  });
});
