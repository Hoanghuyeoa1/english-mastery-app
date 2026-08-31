import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { FlashcardDeck } from './components/FlashcardDeck';
import { QuizArena } from './components/QuizArena';
import { PronunciationArena } from './components/PronunciationArena';
import { ToeicAssessmentView } from './components/ToeicAssessmentView';
import { AITutorView } from './components/AITutorView';
import { WordManager } from './components/WordManager';
import { DictionaryView } from './components/DictionaryView';
import { TranslatorView } from './components/TranslatorView';
import { AddWordModal } from './components/AddWordModal';
import { BulkImportModal } from './components/BulkImportModal';
import { BackupModal } from './components/BackupModal';
import { AchievementsModal } from './components/AchievementsModal';
import { DailySettingsModal } from './components/DailySettingsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { ProfileModal } from './components/ProfileModal';
import { useAppStore } from './store/useAppStore';
import type { ActiveTab } from './types';
import { ShieldCheck } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isAddWordOpen, setIsAddWordOpen] = useState(false);
  const [prefillWord, setPrefillWord] = useState('');
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [isDailySettingsOpen, setIsDailySettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const { checkAndUpdateStreak, checkDailyReset, profile, syncVocab5000 } = useAppStore();

  const handleOpenAddWord = (word = '') => {
    setPrefillWord(word);
    setIsAddWordOpen(true);
  };

  useEffect(() => {
    checkDailyReset();
    checkAndUpdateStreak();
    syncVocab5000();
  }, [checkDailyReset, checkAndUpdateStreak, syncVocab5000]);

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
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {activeTab === 'dashboard' && (
          <Dashboard 
            onNavigate={(tab) => setActiveTab(tab)} 
            onOpenAddWord={() => handleOpenAddWord('')} 
          />
        )}

        {activeTab === 'flashcards' && <FlashcardDeck />}

        {activeTab === 'toeic' && <ToeicAssessmentView />}

        {activeTab === 'quiz' && <QuizArena />}

        {activeTab === 'pronunciation' && <PronunciationArena />}

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

    </div>
  );
}

export default App;
