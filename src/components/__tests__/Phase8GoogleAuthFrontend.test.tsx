// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthForm } from '../auth/AuthForm';
import { Navbar } from '../Navbar';
import { AdminView } from '../AdminView';
import { App } from '../../App';
import * as cloudSyncService from '../../services/cloudSyncService';
import { useCloudSyncStore } from '../../services/cloudSyncService';
import { useAppStore } from '../../store/useAppStore';
import { authApi } from '../../services/api/authApi';
import { ApiError } from '../../services/api/httpClient';

// Mock virtual:pwa-register/react for Navbar PWA button
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

// Mock PWANotificationBanner
vi.mock('../PWANotificationBanner', () => ({
  PWANotificationBanner: () => <div data-testid="pwa-banner" />,
}));

// Mock framer-motion to avoid Happy-DOM animation issues
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    button: ({ children, className, ...props }: any) => <button className={className} {...props}>{children}</button>,
    section: ({ children, className, ...props }: any) => <section className={className} {...props}>{children}</section>,
    span: ({ children, className, ...props }: any) => <span className={className} {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => true,
}));

// Mock audio & speech
vi.mock('../../services/speechService', () => ({
  speakWord: vi.fn(),
  cancelSpeech: vi.fn(),
}));

// Mock admin vocab service
vi.mock('../../services/adminVocabService', () => ({
  fetchCloudVocabularies: vi.fn().mockResolvedValue({ data: [], error: null }),
  fetchRegisteredProfiles: vi.fn().mockResolvedValue({ data: [], error: null }),
  addCloudVocabulary: vi.fn().mockResolvedValue({ success: true }),
  updateCloudVocabulary: vi.fn().mockResolvedValue({ success: true }),
  deleteCloudVocabulary: vi.fn().mockResolvedValue({ success: true }),
  resetAllUsersProgress: vi.fn().mockResolvedValue({ success: true }),
  resetTargetUsersProgress: vi.fn().mockResolvedValue({ success: true }),
  syncCloudVocabulariesToStore: vi.fn(),
}));

// Mock leaderboard service partially to preserve LEADERBOARD constants
vi.mock('../../services/leaderboardService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/leaderboardService')>();
  return {
    ...actual,
    syncUserScoreToLeaderboard: vi.fn().mockResolvedValue({ success: true }),
    calculateWeeklyXpFromHistory: vi.fn().mockReturnValue(0),
    clearCachedLeaderboard: vi.fn(),
    invalidateAuthLeaderboardCache: vi.fn(),
    clearLeaderboardDebounce: vi.fn(),
  };
});

// Mock active learning time
vi.mock('../../services/activeLearningTimeService', () => ({
  startActiveSession: vi.fn(),
  endActiveSession: vi.fn(),
  tabToActiveLearningModule: vi.fn().mockReturnValue(null),
}));

describe('PHASE 8 — Google Login UI & Role-Aware Frontend Tests', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    useCloudSyncStore.setState({
      user: null,
      userEmail: null,
      session: null,
      isOnline: true,
      status: 'idle',
      errorMessage: null,
      isAuthInitialized: true,
    });

    useAppStore.setState({
      profile: {
        name: 'Test Student',
        level: 1,
        xp: 100,
        streak: 3,
        avatarSeed: 'seed',
        isOnboarded: true,
      } as any,
      isHydrated: true,
      isGuestMode: false,
      isLoggedOut: false,
    });
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  describe('1. Google Login Button Render & Interaction', () => {
    it('renders "Tiếp tục với Google" button with SVG icon and divider', () => {
      render(<AuthForm />);

      const googleBtn = screen.getByTestId('google-signin-btn');
      expect(googleBtn).toBeDefined();
      expect(googleBtn.textContent).toContain('Tiếp tục với Google');
      expect(screen.getByText(/HOẶC SỬ DỤNG EMAIL/i)).toBeDefined();
    });

    it('requests auth URL and opens popup on click', async () => {
      const getGoogleAuthUrlSpy = vi.spyOn(authApi, 'getGoogleAuthUrl').mockResolvedValueOnce({
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?test=1',
        state: 'test-state',
        nonce: 'test-nonce',
        codeChallenge: 'test-challenge',
      });

      const openSpy = vi.spyOn(window, 'open').mockReturnValueOnce({
        closed: false,
        close: vi.fn(),
      } as any);

      render(<AuthForm />);
      const googleBtn = screen.getByTestId('google-signin-btn');
      fireEvent.click(googleBtn);

      await waitFor(() => {
        expect(getGoogleAuthUrlSpy).toHaveBeenCalled();
        expect(openSpy).toHaveBeenCalledWith(
          'https://accounts.google.com/o/oauth2/v2/auth?test=1',
          'google_oauth_popup',
          expect.stringContaining('width=500')
        );
      });
    });

    it('handles popup blocked by falling back to window.location.assign', async () => {
      vi.spyOn(authApi, 'getGoogleAuthUrl').mockResolvedValueOnce({
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?fallback=1',
        state: 'test-state',
        nonce: 'test-nonce',
        codeChallenge: 'test-challenge',
      });

      // Window.open returns null when blocked
      vi.spyOn(window, 'open').mockReturnValueOnce(null);
      const assignMock = vi.fn();
      delete (window as any).location;
      window.location = { ...originalLocation, assign: assignMock } as any;

      render(<AuthForm />);
      const googleBtn = screen.getByTestId('google-signin-btn');
      fireEvent.click(googleBtn);

      await waitFor(() => {
        expect(assignMock).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?fallback=1');
      });

      (window as any).location = originalLocation;
    });

    it('displays Vietnamese error when backend OAuth endpoint fails', async () => {
      vi.spyOn(authApi, 'getGoogleAuthUrl').mockRejectedValueOnce(
        new ApiError(0, { code: 'NETWORK_ERROR', message: 'Network offline' })
      );

      render(<AuthForm />);
      const googleBtn = screen.getByTestId('google-signin-btn');
      fireEvent.click(googleBtn);

      await waitFor(() => {
        expect(screen.getByText(/Không thể kết nối đến máy chủ xác thực/i)).toBeDefined();
      });
    });
  });

  describe('2. OAuth Callback & Redirect Processing', () => {
    it('processes oauth_exchange_code on mount and triggers onSuccess', async () => {
      const onSuccess = vi.fn();
      window.history.replaceState({}, '', '/?oauth_exchange_code=TICKET_123');

      const mockExchange = vi.spyOn(cloudSyncService, 'signInWithGoogleExchange').mockResolvedValueOnce({
        data: {
          user: {
            id: 'google-usr-1',
            email: 'google@test.com',
            displayName: 'Google User',
            roles: ['USER'],
          },
          session: { access_token: 'jwt-token', user: {} as any },
        },
        error: null,
      });

      render(<AuthForm onSuccess={onSuccess} />);

      await waitFor(() => {
        expect(mockExchange).toHaveBeenCalledWith('TICKET_123');
        expect(onSuccess).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'google-usr-1',
            email: 'google@test.com',
            roles: ['USER'],
          })
        );
      });

      // Query param must be cleanly scrubbed
      expect(window.location.search).toBe('');
    });

    it('displays Vietnamese cancellation notice when user denied oauth request', async () => {
      window.history.replaceState({}, '', '/?oauth_error=access_denied');

      render(<AuthForm />);

      await waitFor(() => {
        expect(screen.getByText(/Bạn đã hủy yêu cầu đăng nhập bằng Google/i)).toBeDefined();
      });

      expect(window.location.search).toBe('');
    });
  });

  describe('3. Account Collision & Secure Linking UX', () => {
    it('renders collision linking card when oauth_error=email_collision is in URL', async () => {
      window.history.replaceState({}, '', '/?oauth_error=email_collision&email=existing%40test.com');

      render(<AuthForm />);

      await waitFor(() => {
        expect(screen.getByTestId('collision-linking-card')).toBeDefined();
        expect(screen.getByText(/existing@test.com/)).toBeDefined();
        expect(screen.getByText(/Yêu cầu xác nhận liên kết tài khoản/i)).toBeDefined();
      });
    });

    it('successfully links collision account upon correct password entry', async () => {
      const onSuccess = vi.fn();
      window.history.replaceState({}, '', '/?oauth_error=email_collision&email=user%40test.com');

      const mockLink = vi.spyOn(cloudSyncService, 'linkGoogleWithCredentials').mockResolvedValueOnce({
        data: {
          user: {
            id: 'usr-linked-1',
            email: 'user@test.com',
            displayName: 'Linked User',
            roles: ['USER'],
          },
          session: { access_token: 'jwt-linked-token', user: {} as any },
        },
        error: null,
      });

      render(<AuthForm onSuccess={onSuccess} />);

      const passwordInput = await screen.findByPlaceholderText(/Nhập mật khẩu tài khoản hiện tại/i);
      fireEvent.change(passwordInput, { target: { value: 'SecretPassword123' } });

      const linkBtn = screen.getByText(/Xác nhận liên kết & Đăng nhập/i);
      fireEvent.click(linkBtn);

      await waitFor(() => {
        expect(mockLink).toHaveBeenCalledWith('user@test.com', 'SecretPassword123');
        expect(onSuccess).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'usr-linked-1',
            email: 'user@test.com',
          })
        );
      });
    });

    it('displays error if wrong password is submitted during collision linking', async () => {
      window.history.replaceState({}, '', '/?oauth_error=email_collision&email=user%40test.com');

      vi.spyOn(cloudSyncService, 'linkGoogleWithCredentials').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Mật khẩu tài khoản hiện tại không chính xác.', raw: new Error('bad password') },
      });

      render(<AuthForm />);

      const passwordInput = await screen.findByPlaceholderText(/Nhập mật khẩu tài khoản hiện tại/i);
      fireEvent.change(passwordInput, { target: { value: 'WrongPassword' } });

      const linkBtn = screen.getByText(/Xác nhận liên kết & Đăng nhập/i);
      fireEvent.click(linkBtn);

      await waitFor(() => {
        expect(screen.getByText(/Mật khẩu tài khoản hiện tại không chính xác/i)).toBeDefined();
      });
    });
  });

  describe('4. Role-Aware Navigation (USER vs ADMIN vs Guest)', () => {
    it('Guest does not see "Quản Trị 🛡️" tab in Navbar', () => {
      useCloudSyncStore.setState({ user: null });
      render(
        <Navbar
          activeTab="dashboard"
          setActiveTab={vi.fn()}
          onOpenProfile={vi.fn()}
          onOpenBackup={vi.fn()}
          onOpenAchievements={vi.fn()}
          onOpenAddWord={vi.fn()}
          onOpenDailySettings={vi.fn()}
          onOpenAuthSync={vi.fn()}
          onOpenReviewModal={vi.fn()}
          onOpenMyVocabBank={vi.fn()}
        />
      );

      expect(screen.queryByText(/Quản Trị 🛡️/i)).toBeNull();
    });

    it('Regular USER (roles: ["USER"]) does not see "Quản Trị 🛡️" tab in Navbar', () => {
      useCloudSyncStore.setState({
        user: {
          id: 'u-reg',
          email: 'student@example.com',
          displayName: 'Normal Student',
          roles: ['USER'],
        },
      });

      render(
        <Navbar
          activeTab="dashboard"
          setActiveTab={vi.fn()}
          onOpenProfile={vi.fn()}
          onOpenBackup={vi.fn()}
          onOpenAchievements={vi.fn()}
          onOpenAddWord={vi.fn()}
          onOpenDailySettings={vi.fn()}
          onOpenAuthSync={vi.fn()}
          onOpenReviewModal={vi.fn()}
          onOpenMyVocabBank={vi.fn()}
        />
      );

      expect(screen.queryByText(/Quản Trị 🛡️/i)).toBeNull();
    });

    it('ADMIN (roles: ["ADMIN"]) sees "Quản Trị 🛡️" tab in Navbar', () => {
      useCloudSyncStore.setState({
        user: {
          id: 'u-adm',
          email: 'admin@example.com',
          displayName: 'Administrator',
          roles: ['ADMIN'],
        },
      });

      render(
        <Navbar
          activeTab="dashboard"
          setActiveTab={vi.fn()}
          onOpenProfile={vi.fn()}
          onOpenBackup={vi.fn()}
          onOpenAchievements={vi.fn()}
          onOpenAddWord={vi.fn()}
          onOpenDailySettings={vi.fn()}
          onOpenAuthSync={vi.fn()}
          onOpenReviewModal={vi.fn()}
          onOpenMyVocabBank={vi.fn()}
        />
      );

      expect(screen.getByText(/Quản Trị 🛡️/i)).toBeDefined();
    });

    it('Direct navigation to AdminView by non-admin shows access denied message', () => {
      useCloudSyncStore.setState({
        user: {
          id: 'u-reg',
          email: 'user@example.com',
          roles: ['USER'],
        },
        userEmail: 'user@example.com',
      });

      render(<AdminView onNavigate={vi.fn()} onOpenAuth={vi.fn()} />);

      expect(screen.getByText(/Không Có Quyền Truy Cập/i)).toBeDefined();
      expect(screen.getByText(/chỉ dành riêng cho tài khoản được cấp quyền Quản Trị Viên/i)).toBeDefined();
    });
  });

  describe('5. Role Revocation & Redirection Guard in App', () => {
    it('redirects user out of admin tab if user is not ADMIN', async () => {
      useCloudSyncStore.setState({
        user: {
          id: 'u-reg',
          email: 'hacker@example.com',
          roles: ['USER'], // Revoked or regular user
        },
      });

      useAppStore.setState({
        isHydrated: true,
        pendingNavigationTab: 'admin', // Attempted direct navigation to admin
      });

      render(<App />);

      // App effect expels user from admin to dashboard
      await waitFor(() => {
        expect(screen.queryByText(/Không Có Quyền Truy Cập/i)).toBeNull();
      });
    });
  });

  describe('6. Account Switching State Isolation', () => {
    it('resets local state and invalidates caches when switching accounts', async () => {
      const resetToDefault = vi.fn();
      const setProfileName = vi.fn();

      // Register store mock
      cloudSyncService.registerCloudSyncStoreGetter(() => ({
        resetToDefault,
        setProfileName,
      }));

      // 1. Login user A
      vi.spyOn(authApi, 'login').mockResolvedValueOnce({
        accessToken: 'token-a',
        refreshToken: 'rf-a',
        expiresInSeconds: 3600,
        user: { id: 'usr-AAA', email: 'a@test.com', displayName: 'User A', roles: ['USER'] },
      });
      await cloudSyncService.signInWithEmail('a@test.com', 'Pass123');
      expect(cloudSyncService.getActiveSyncedUserId()).toBe('usr-AAA');

      // 2. Login user B (Account Switch)
      vi.spyOn(authApi, 'login').mockResolvedValueOnce({
        accessToken: 'token-b',
        refreshToken: 'rf-b',
        expiresInSeconds: 3600,
        user: { id: 'usr-BBB', email: 'b@test.com', displayName: 'User B', roles: ['USER'] },
      });
      await cloudSyncService.signInWithEmail('b@test.com', 'Pass456');

      // Assert resetToDefault was triggered on account switch
      expect(resetToDefault).toHaveBeenCalled();
      expect(cloudSyncService.getActiveSyncedUserId()).toBe('usr-BBB');
    });
  });
});
