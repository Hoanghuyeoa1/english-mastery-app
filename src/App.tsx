import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { FlashcardDeck } from './components/FlashcardDeck';
import { QuizArena } from './components/QuizArena';
import { PronunciationArena } from './components/PronunciationArena';
import { ToeicAssessmentView } from './components/ToeicAssessmentView';
import { AITutorView } from './components/AITutorView';
import { FourSkillsView } from './components/FourSkillsView';
import { WordManager } from './components/WordManager';
import { DictionaryView } from './components/DictionaryView';
import { TranslatorView } from './components/TranslatorView';
import { MistakeBankView } from './components/MistakeBankView';
import { AddWordModal } from './components/AddWordModal';
import { BulkImportModal } from './components/BulkImportModal';
import { BackupModal } from './components/BackupModal';
import { AchievementsModal } from './components/AchievementsModal';
import { DailySettingsModal } from './components/DailySettingsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { ProfileModal } from './components/ProfileModal';
import { AuthSyncModal } from './components/AuthSyncModal';
import { ReviewModal } from './components/ReviewModal';
import { MyVocabBankModal } from './components/MyVocabBankModal';
import { PWANotificationBanner } from './components/PWANotificationBanner';
import { LeaderboardView } from './components/LeaderboardView';
import { AdminView } from './components/AdminView';
import { WelcomeView } from './components/WelcomeView';
import { useAppStore } from './store/useAppStore';
import { initCloudSync, useCloudSyncStore, type AppAuthUser } from './services/cloudSyncService';
import { syncCloudVocabulariesToStore } from './services/adminVocabService';
import { syncUserScoreToLeaderboard, calculateWeeklyXpFromHistory } from './services/leaderboardService';
import {
  startActiveSession,
  endActiveSession,
  tabToActiveLearningModule,
} from './services/activeLearningTimeService';
import { ShieldCheck, UserCheck, Sparkles } from 'lucide-react';
import { useIsAdmin } from './utils/adminAuth';
import type { ActiveTab } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const isAdmin = useIsAdmin();
  const [isAddWordOpen, setIsAddWordOpen] = useState(false);
  const [prefillWord, setPrefillWord] = useState('');
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [isDailySettingsOpen, setIsDailySettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAuthSyncOpen, setIsAuthSyncOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isMyVocabBankOpen, setIsMyVocabBankOpen] = useState(false);
  const { 
    checkDailyReset, 
    profile, 
    dailyHistory,
    pendingNavigationTab, 
    clearPendingNavigation,
    isHydrated,
    isGuestMode,
    isLoggedOut,
    setGuestMode,
    setIsLoggedOut,
  } = useAppStore();

  const { user, isAuthInitialized } = useCloudSyncStore();

  const handleNavigate = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
  }, []);

  const handleContinueAsGuest = useCallback(() => {
    setIsLoggedOut?.(false);
    setGuestMode?.(true);
  }, [setGuestMode, setIsLoggedOut]);

  const handleAuthSuccess = useCallback((_authUser: AppAuthUser) => {
    setIsLoggedOut?.(false);
  }, [setIsLoggedOut]);

  // Active Learning Time Tracker: Tự động khởi động / kết thúc phiên học theo tab học tập
  useEffect(() => {
    const learningModule = tabToActiveLearningModule(activeTab);
    if (learningModule) {
      startActiveSession(learningModule);
    } else {
      endActiveSession();
    }

    return () => {
      endActiveSession();
    };
  }, [activeTab]);

  useEffect(() => {
    if (pendingNavigationTab) {
      setActiveTab(pendingNavigationTab);
      clearPendingNavigation();
    }
  }, [pendingNavigationTab, clearPendingNavigation]);

  // Role Revocation Security: Tự động chuyển hướng khỏi Admin nếu quyền ADMIN bị thu hồi
  useEffect(() => {
    if (activeTab === 'admin' && !isAdmin) {
      console.warn('[RBAC] Admin privileges missing or revoked. Expelling from admin screen to dashboard.');
      setActiveTab('dashboard');
    }
  }, [activeTab, isAdmin]);

  // Google OAuth Popup Child Relay
  useEffect(() => {
    if (typeof window !== 'undefined' && window.opener && window.opener !== window) {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('oauth_exchange_code');
      const oauthErr = searchParams.get('oauth_error');
      const oauthEmail = searchParams.get('email');
      const errorMsg = searchParams.get('message');

      if (code) {
        window.opener.postMessage({ type: 'GOOGLE_AUTH_EXCHANGE', code }, window.location.origin);
        window.close();
      } else if (oauthErr === 'email_collision' && oauthEmail) {
        window.opener.postMessage({ type: 'GOOGLE_AUTH_COLLISION', email: oauthEmail }, window.location.origin);
        window.close();
      } else if (oauthErr) {
        window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', message: errorMsg }, window.location.origin);
        window.close();
      }
    }
  }, []);

  const handleOpenAddWord = (word = '') => {
    setPrefillWord(word);
    setIsAddWordOpen(true);
  };

  useEffect(() => {
    checkDailyReset();
    syncCloudVocabulariesToStore();
    const cleanupSync = initCloudSync();

    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        checkDailyReset();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    const handleOpenAuthSyncEvent = () => setIsAuthSyncOpen(true);
    window.addEventListener('emh_open_auth_sync', handleOpenAuthSyncEvent);

    return () => {
      cleanupSync();
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('emh_open_auth_sync', handleOpenAuthSyncEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tự động đồng bộ điểm số học viên lên Leaderboard khi đạt XP / Streak mới (Chỉ cho Authenticated User)
  useEffect(() => {
    if (user && (profile.xp > 0 || profile.streak > 0)) {
      const currentWeeklyXp = calculateWeeklyXpFromHistory(dailyHistory);
      void syncUserScoreToLeaderboard({
        userId: user.id,
        displayName: profile.name,
        avatarSeed: profile.avatarSeed,
        level: profile.level,
        totalXp: profile.xp,
        weeklyXp: currentWeeklyXp,
        streak: profile.streak,
      });
    }
  }, [user, profile.xp, profile.streak, profile.level, profile.name, profile.avatarSeed, dailyHistory]);

  // Single Source of Truth for Routing Decision Matrix (Phases 1, 4, 5)
  const isStorageHydrated = isHydrated ?? false;
  const isAuthReady = isAuthInitialized ?? false;

  // 1. Initializing / Hydrating State: Neutral screen, no Welcome flicker, no redirect loop
  if (!isStorageHydrated || !isAuthReady) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Đang khởi tạo ứng dụng"
        className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/20 animate-pulse">
            <Sparkles className="w-6 h-6 text-slate-950" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-sm font-bold text-slate-300">Đang chuẩn bị không gian học tập...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Routing Decision: Authenticated vs Guest vs Welcome Landing
  const isAuthenticated = Boolean(user);
  const isReturningProfile = Boolean(profile.name && profile.isOnboarded && !isLoggedOut);
  const isGuest = Boolean((isGuestMode || isReturningProfile) && !isLoggedOut);
  const shouldShowWelcome = !isAuthenticated && !isGuest;

  if (shouldShowWelcome) {
    return (
      <>
        <PWANotificationBanner />
        <WelcomeView
          onContinueAsGuest={handleContinueAsGuest}
          onAuthSuccess={handleAuthSuccess}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      
      {/* PWA Offline Notification & Version Update Toast */}
      <PWANotificationBanner />

      {/* Fixed Sticky Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenBackup={() => setIsBackupOpen(true)}
        onOpenAchievements={() => setIsAchievementsOpen(true)}
        onOpenAddWord={() => handleOpenAddWord('')}
        onOpenDailySettings={() => setIsDailySettingsOpen(true)}
        onOpenAuthSync={() => setIsAuthSyncOpen(true)}
        onOpenReviewModal={() => setIsReviewModalOpen(true)}
        onOpenMyVocabBank={() => setIsMyVocabBankOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div key={activeTab} className="animate-fadeIn motion-reduce:animate-none">
          {activeTab === 'dashboard' && (
            <Dashboard 
              onNavigate={handleNavigate} 
              onOpenAddWord={() => handleOpenAddWord('')} 
            />
          )}

          {activeTab === 'flashcards' && <FlashcardDeck onNavigate={handleNavigate} />}

          {activeTab === 'mistakes' && <MistakeBankView onNavigate={handleNavigate} />}

          {activeTab === 'toeic' && <ToeicAssessmentView />}

          {(activeTab === 'quiz' || activeTab === 'arcade') && (
            <QuizArena onNavigate={handleNavigate} />
          )}

          {activeTab === 'pronunciation' && <PronunciationArena />}

          {activeTab === 'four_skills' && (
            <FourSkillsView 
              onNavigate={handleNavigate} 
              onOpenAddWord={(word) => handleOpenAddWord(word || '')} 
            />
          )}

          {activeTab === 'tutor' && <AITutorView />}

          {activeTab === 'vocabulary' && (
            <WordManager 
              onOpenAddWord={() => handleOpenAddWord('')} 
              onOpenBulkImport={() => setIsBulkImportOpen(true)}
            />
          )}

          {activeTab === 'dictionary' && (
            <DictionaryView 
              onOpenAddWord={(word) => handleOpenAddWord(word || '')} 
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'translator' && <TranslatorView />}

          {activeTab === 'leaderboard' && (
            <LeaderboardView onOpenAuthSync={() => setIsAuthSyncOpen(true)} />
          )}

          {activeTab === 'admin' && (
            <AdminView 
              onNavigate={handleNavigate} 
              onOpenAuth={() => setIsAuthSyncOpen(true)} 
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Hệ thống Học tiếng Anh Cá nhân hóa • <strong>{profile.name}</strong></span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsAuthSyncOpen(true)}
              className="hover:text-emerald-400 transition-colors flex items-center gap-1 text-emerald-400/90 font-medium"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Tài khoản</span>
            </button>
            <span>•</span>
            <button
              onClick={() => setIsBackupOpen(true)}
              className="hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Dữ liệu Cục bộ (LocalStorage)</span>
            </button>
            <span>•</span>
            <span>Spaced Repetition SM-2 & Web Speech API</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthSyncModal
        isOpen={isAuthSyncOpen}
        onClose={() => setIsAuthSyncOpen(false)}
      />

      <DailySettingsModal
        isOpen={isDailySettingsOpen}
        onClose={() => setIsDailySettingsOpen(false)}
      />

      <AddWordModal 
        isOpen={isAddWordOpen} 
        onClose={() => {
          setIsAddWordOpen(false);
          setPrefillWord('');
        }} 
        initialWord={prefillWord}
      />

      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
      />

      <BackupModal 
        isOpen={isBackupOpen} 
        onClose={() => setIsBackupOpen(false)} 
      />

      <AchievementsModal 
        isOpen={isAchievementsOpen} 
        onClose={() => setIsAchievementsOpen(false)} 
      />

      {/* First-time Onboarding Modal */}
      <OnboardingModal isOpen={!profile.isOnboarded || !profile.name} />

      {/* Profile Settings & Edit Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onOpenBackup={() => setIsBackupOpen(true)}
      />

      {/* Review Session Modal */}
      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
      />

      {/* Kho Từ Vựng Tích Lũy Modal */}
      <MyVocabBankModal
        isOpen={isMyVocabBankOpen}
        onClose={() => setIsMyVocabBankOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
      />

    </div>
  );
}

export default App;
