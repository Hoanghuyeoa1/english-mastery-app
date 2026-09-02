import { useState, useEffect } from 'react';
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
import { AdminView } from './components/AdminView';
import { useAppStore } from './store/useAppStore';
import { initCloudSync } from './services/cloudSyncService';
import { syncCloudVocabulariesToStore } from './services/adminVocabService';
import type { ActiveTab } from './types';
import { ShieldCheck, Cloud } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
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

  const { checkAndUpdateStreak, checkDailyReset, profile, syncVocab5000 } = useAppStore();

  const handleOpenAddWord = (word = '') => {
    setPrefillWord(word);
    setIsAddWordOpen(true);
  };

  useEffect(() => {
    checkDailyReset();
    checkAndUpdateStreak();
    syncVocab5000();
    syncCloudVocabulariesToStore();
    const cleanupSync = initCloudSync();
    return () => {
      cleanupSync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      
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
        {activeTab === 'dashboard' && (
          <Dashboard 
            onNavigate={(tab) => setActiveTab(tab)} 
            onOpenAddWord={() => handleOpenAddWord('')} 
          />
        )}

        {activeTab === 'flashcards' && <FlashcardDeck onNavigate={(tab) => setActiveTab(tab)} />}

        {activeTab === 'mistakes' && <MistakeBankView onNavigate={(tab) => setActiveTab(tab)} />}

        {activeTab === 'toeic' && <ToeicAssessmentView />}

        {(activeTab === 'quiz' || activeTab === 'arcade') && <QuizArena />}

        {activeTab === 'pronunciation' && <PronunciationArena />}

        {activeTab === 'four_skills' && (
          <FourSkillsView 
            onNavigate={(tab) => setActiveTab(tab)} 
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
          />
        )}

        {activeTab === 'translator' && <TranslatorView />}

        {activeTab === 'admin' && (
          <AdminView 
            onNavigate={(tab) => setActiveTab(tab)} 
            onOpenAuth={() => setIsAuthSyncOpen(true)} 
          />
        )}
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
              <Cloud className="w-3.5 h-3.5" />
              <span>Cloud Sync (Supabase)</span>
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
