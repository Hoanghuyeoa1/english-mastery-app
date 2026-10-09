// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import confetti from 'canvas-confetti';
import { Navbar } from '../Navbar';
import { AITutorView } from '../AITutorView';
import { DictionaryQuickActions } from '../dictionary/DictionaryQuickActions';
import { ProfileModal } from '../ProfileModal';
import { BackupModal } from '../BackupModal';
import { GeminiKeyModal } from '../GeminiKeyModal';
import { SRSAnalyticsModal } from '../SRSAnalyticsModal';
import { triggerCelebration, isConfettiAllowedForTier } from '../../utils/confettiPolicy';
import { useAppStore } from '../../store/useAppStore';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock virtual:pwa-register/react for Navbar PWA button
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

// Mock speech service
vi.mock('../../services/speechService', () => ({
  speakWord: vi.fn(),
  isSpeechRecognitionSupported: vi.fn(() => true),
  startShadowingSession: vi.fn(),
  stopShadowingSession: vi.fn(),
}));

// Mock frame reward service
vi.mock('../../services/frameRewardService', () => ({
  LEADERBOARD_FRAMES: {},
  getUserUnlockedFrames: vi.fn().mockResolvedValue([]),
  equipProfileFrameOnServer: vi.fn().mockResolvedValue({ success: true }),
}));

describe('PHASE 3: Remaining Modules & Micro-Interaction Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    useAppStore.setState({
      profile: {
        name: 'Hoang Learner',
        level: 5,
        xp: 1000,
        streak: 7,
        lastActiveDate: '2026-10-06',
        lastStudyDate: '2026-10-06',
        hearts: 5,
        maxHearts: 5,
        avatarSeed: 'Learner',
        targetDailyWords: 15,
        targetDailyNewWords: 15,
        extraNewWordsBonus: 0,
        isOnboarded: true,
        targetGoal: 'daily',
        geminiApiKey: 'test-api-key',
        equippedFrame: null,
        unlockedFrames: [],
      },
      vocabularyList: [
        {
          id: 'card-1',
          word: 'ubiquitous',
          meaning: 'phổ biến khắp nơi',
          ipa: '/juːˈbɪk.wɪ.təs/',
          partOfSpeech: 'adj',
          example: 'Smartphones are ubiquitous nowadays.',
          tag: 'Daily',
          srsLevel: 0,
          interval: 0,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-06',
        },
      ],
      srsProgressMap: {},
      mistakeBank: {},
      resumeActivities: {},
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      fourSkillsCompletionProgress: {
        reading: [],
        speaking: [],
        writing: [],
      },
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('1. Navbar Micro-Interactions & Tactile Tokens', () => {
    it('applies tactile tokens and reduced-motion classes to navigation triggers', () => {
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

      // Dashboard button
      const dashBtn = screen.getByRole('button', { name: /Tổng Quan/i });
      expect(dashBtn.className).toContain('active:scale-[0.98]');
      expect(dashBtn.className).toContain('duration-150');
      expect(dashBtn.className).toContain('motion-reduce:transform-none');
      expect(dashBtn.className).toContain('focus-visible:ring-2');

      // Leaderboard button
      const rankBtns = screen.getAllByRole('button', { name: /Xếp Hạng/i });
      expect(rankBtns.length).toBeGreaterThanOrEqual(1);
      rankBtns.forEach((btn) => {
        expect(btn.className).toContain('active:scale-[0.98]');
        expect(btn.className).toContain('duration-150');
        expect(btn.className).toContain('motion-reduce:transform-none');
      });
    });
  });

  describe('2. AI Tutor Micro-Interactions & Tactile Responsiveness', () => {
    it('provides tactile send button with loading state attributes', () => {
      render(<AITutorView />);

      const sendBtn = screen.getByTestId('tutor-send-btn');
      expect(sendBtn).toBeDefined();
      expect(sendBtn.className).toContain('active:scale-[0.98]');
      expect(sendBtn.className).toContain('duration-150');
      expect(sendBtn.className).toContain('motion-reduce:transform-none');
      expect(sendBtn.className).toContain('focus-visible:ring-2');
      // When not loading, aria-busy should be false
      expect(sendBtn.getAttribute('aria-busy')).toBe('false');
    });

    it('renders scenario selector pills with tactile scaling and focus rings', () => {
      render(<AITutorView />);

      const scenarios = screen.getAllByRole('button');
      const interviewBtn = scenarios.find((btn) => btn.textContent?.includes('Phỏng Vấn'));
      expect(interviewBtn).toBeDefined();
      expect(interviewBtn?.className).toContain('active:scale-[0.98]');
      expect(interviewBtn?.className).toContain('duration-150');
      expect(interviewBtn?.className).toContain('motion-reduce:transform-none');
    });
  });

  describe('3. Dictionary Quick Actions Tactile Standardization', () => {
    it('applies tactile and focus-visible tokens to all 7 quick action buttons', () => {
      render(
        <DictionaryQuickActions
          word="resilient"
          isInDeck={false}
          isDue={true}
          hasUnresolvedMistakes={true}
          hasWeakCollocations={true}
          onSaveToDeck={vi.fn()}
          onReviewNow={vi.fn()}
          onPracticeMistake={vi.fn()}
          onPracticeCollocation={vi.fn()}
          onSpeak={vi.fn()}
          onCheckVoice={vi.fn()}
          onCopy={vi.fn()}
          isCopied={false}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(4);

      buttons.forEach((btn) => {
        expect(btn.className).toContain('active:scale-[0.98]');
        expect(btn.className).toContain('duration-150');
        expect(btn.className).toContain('motion-reduce:transform-none');
        expect(btn.className).toContain('focus-visible:ring-2');
      });
    });
  });

  describe('4. Accessible Modals (Dialog attributes, Escape key, and Animations)', () => {
    it('ProfileModal has role="dialog", aria-modal="true", and closes on Escape', () => {
      const handleClose = vi.fn();
      render(<ProfileModal isOpen={true} onClose={handleClose} onOpenBackup={vi.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeDefined();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.className).toContain('animate-scaleIn');
      expect(dialog.className).toContain('motion-reduce:animate-none');

      // Test Escape key press
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('BackupModal has role="dialog", aria-modal="true", and closes on Escape', () => {
      const handleClose = vi.fn();
      render(<BackupModal isOpen={true} onClose={handleClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeDefined();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.className).toContain('animate-scaleIn');
      expect(dialog.className).toContain('motion-reduce:animate-none');

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('GeminiKeyModal has role="dialog", aria-modal="true", and closes on Escape', () => {
      const handleClose = vi.fn();
      render(<GeminiKeyModal isOpen={true} onClose={handleClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeDefined();
      expect(dialog.getAttribute('aria-modal')).toBe('true');

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('SRSAnalyticsModal has role="dialog", aria-modal="true", and closes on Escape', () => {
      const handleClose = vi.fn();
      render(<SRSAnalyticsModal isOpen={true} onClose={handleClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeDefined();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.className).toContain('animate-scaleIn');
      expect(dialog.className).toContain('motion-reduce:animate-none');

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. UX Celebration Policy & Confetti Suppression Enforcement', () => {
    it('strictly suppresses confetti on micro actions (returns false without invoking confetti)', () => {
      const result = triggerCelebration('micro');
      expect(result).toBe(false);
      expect(confetti).not.toHaveBeenCalled();
    });

    it('permits celebration on session/exam completion and milestone tiers', () => {
      expect(isConfettiAllowedForTier('micro')).toBe(false);
      expect(isConfettiAllowedForTier('completion')).toBe(true);
      expect(isConfettiAllowedForTier('major_milestone')).toBe(true);

      const completionResult = triggerCelebration('completion');
      expect(completionResult).toBe(true);
      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({
          disableForReducedMotion: true,
          particleCount: 35,
        })
      );
    });
  });
});
