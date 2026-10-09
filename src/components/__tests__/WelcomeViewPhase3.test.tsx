// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { WelcomeView } from '../WelcomeView';

// Mock cloudSyncService to avoid network calls during render
vi.mock('../../services/cloudSyncService', () => ({
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  useCloudSyncStore: vi.fn((selector) => {
    const state = {
      user: null,
      userEmail: null,
      session: null,
      isOnline: true,
      status: 'idle',
    };
    return selector ? selector(state) : state;
  }),
}));

describe('WelcomeView (Phase 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders landing page brand, hero title, and subtitle correctly', () => {
    render(<WelcomeView />);

    expect(screen.getByText('English Mastery Hub')).toBeDefined();
    expect(screen.getByText('Local-First')).toBeDefined();
    expect(
      screen.getByText((content) => content.includes('Làm chủ tiếng Anh theo'))
    ).toBeDefined();
    expect(
      screen.getByText((content) => content.includes('cách của riêng bạn.'))
    ).toBeDefined();
    expect(
      screen.getByText((content) => content.includes('Four Skills (A1–C2)'))
    ).toBeDefined();
  });

  it('displays verified product metrics and highlights without fake statistics', () => {
    render(<WelcomeView />);

    // 10.381 words
    expect(screen.getByText('10.381 Từ vựng FSRS & SM-2')).toBeDefined();
    // 96 Four skills lessons
    expect(screen.getByText('96 Bài luyện Four Skills')).toBeDefined();
    // CEFR levels
    expect(screen.getByText('Luyện thi TOEIC Chuẩn ETS')).toBeDefined();
    // 7 leaderboard categories
    expect(screen.getByText('7 Danh mục Leaderboard & AI Tutor')).toBeDefined();
    // CEFR badges
    expect(screen.getByText('A1')).toBeDefined();
    expect(screen.getByText('C2')).toBeDefined();
    // Offline local assurance
    expect(
      screen.getByText((content) => content.includes('Kiến trúc Local-First:'))
    ).toBeDefined();
  });

  it('renders the real AuthForm with email, password, and submit button', () => {
    render(<WelcomeView />);

    expect(screen.getByPlaceholderText('name@example.com')).toBeDefined();
    expect(screen.getByPlaceholderText('••••••••')).toBeDefined();
    expect(screen.getByTestId('auth-submit-btn')).toBeDefined();
  });

  it('renders the Guest Mode CTA button and fires onContinueAsGuest on click', () => {
    const handleGuest = vi.fn();
    render(<WelcomeView onContinueAsGuest={handleGuest} />);

    const guestButton = screen.getByRole('button', {
      name: /Tiếp tục học mà không cần tài khoản/i,
    });
    expect(guestButton).toBeDefined();
    expect(
      screen.getByText('Bạn vẫn có thể học và lưu tiến trình ngay trên thiết bị này.')
    ).toBeDefined();

    fireEvent.click(guestButton);
    expect(handleGuest).toHaveBeenCalledTimes(1);
  });

  it('switches to register tab inside the landing page and shows confirm password', () => {
    render(<WelcomeView />);

    const registerTab = screen.getByTestId('tab-signup');
    fireEvent.click(registerTab);

    expect(screen.getByPlaceholderText('Ví dụ: Hoàng Anh')).toBeDefined();
    expect(screen.getByPlaceholderText('Nhập lại mật khẩu')).toBeDefined();
    expect(screen.getByTestId('auth-submit-btn')).toBeDefined();
  });
});
