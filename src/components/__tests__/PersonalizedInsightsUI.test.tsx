// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { PersonalizedInsightsSection } from '../PersonalizedInsightsSection';
import { WordPersonalizedInsightBanner } from '../dictionary/WordPersonalizedInsightBanner';
import { FourSkillsAdaptiveSummary } from '../FourSkillsAdaptiveSummary';
import { AITutorView } from '../AITutorView';
import {
  deriveWordPersonalizedInsight,
} from '../../services/personalizedInsightService';
import type { LearningDictionaryProfile } from '../../types';

describe('PHASE 3: Personalized Learning Insights UI & Integration', () => {
  beforeEach(() => {
    useAppStore.getState().resetToDefault?.();
    useAppStore.setState({
      srsProgressMap: {},
      mistakeBank: {},
      userCollocations: [],
      wordLearningStats: {},
      dailyHistory: {},
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      fourSkillsEvidence: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      recentReviewEvents: [],
      srsAlgorithm: 'fsrs',
    });
  });

  describe('1. Dashboard: PersonalizedInsightsSection', () => {
    it('renders null for brand-new learner (Clean Empty State, zero fake cards)', () => {
      const onNavigate = vi.fn();
      const { container } = render(
        <PersonalizedInsightsSection onNavigate={onNavigate} />
      );

      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('personalized-insights-section')).toBeNull();
      expect(screen.queryByText('0 nhận định')).toBeNull();
    });

    it('renders top insight cards when learner has genuine evidence', () => {
      // Simulate genuine learner data: confusion pair
      useAppStore.setState({
        mistakeBank: {
          mst_maintain: {
            id: 'mst_maintain',
            word: 'maintain',
            meaning: 'Duy trì',
            mistakeCount: 2,
            lastMistakeAt: '2026-10-06T10:00:00Z',
            consecutiveCorrect: 0,
            resolved: false,
            primaryType: 'meaning',
            lastUserAnswer: 'sustain',
          },
          mst_sustain: {
            id: 'mst_sustain',
            word: 'sustain',
            meaning: 'Chống đỡ, duy trì',
            mistakeCount: 2,
            lastMistakeAt: '2026-10-06T11:00:00Z',
            consecutiveCorrect: 0,
            resolved: false,
            primaryType: 'meaning',
            lastUserAnswer: 'maintain',
          },
        },
        srsProgressMap: {
          w_maintain: {
            srsLevel: 1,
            nextReviewDate: new Date(Date.now() - 3600000).toISOString(),
            interval: 1,
            easeFactor: 2.5,
            reviewCount: 3,
            againCount: 1,
          },
        },
      });

      const onNavigate = vi.fn();
      const onStartAdaptivePractice = vi.fn();

      render(
        <PersonalizedInsightsSection
          onNavigate={onNavigate}
          onStartAdaptivePractice={onStartAdaptivePractice}
        />
      );

      const section = screen.getByTestId('personalized-insights-section');
      expect(section).toBeDefined();
      expect(screen.getByText('Insights For You')).toBeDefined();
      expect(screen.getByText('Gợi Ý & Nhận Định Học Tập')).toBeDefined();

      // Check card presence
      const confusionCard = screen.getByTestId('insight-card-confusion');
      expect(confusionCard).toBeDefined();
      expect(screen.getAllByText(/maintain/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/sustain/i).length).toBeGreaterThan(0);
    });

    it('triggers adaptive practice or navigation on action button click', () => {
      useAppStore.setState({
        mistakeBank: {
          mst_affect: {
            id: 'mst_affect',
            word: 'affect',
            meaning: 'Ảnh hưởng',
            mistakeCount: 2,
            lastMistakeAt: '2026-10-06T10:00:00Z',
            consecutiveCorrect: 0,
            resolved: false,
            primaryType: 'meaning',
            lastUserAnswer: 'effect',
          },
          mst_effect: {
            id: 'mst_effect',
            word: 'effect',
            meaning: 'Hiệu quả, tác động',
            mistakeCount: 2,
            lastMistakeAt: '2026-10-06T11:00:00Z',
            consecutiveCorrect: 0,
            resolved: false,
            primaryType: 'meaning',
            lastUserAnswer: 'affect',
          },
        },
        srsProgressMap: {
          w1: { srsLevel: 1, nextReviewDate: '2026-10-06', interval: 1, easeFactor: 2.5, reviewCount: 2 },
        },
      });

      const onNavigate = vi.fn();
      const onStartAdaptivePractice = vi.fn();

      render(
        <PersonalizedInsightsSection
          onNavigate={onNavigate}
          onStartAdaptivePractice={onStartAdaptivePractice}
        />
      );

      const actionBtn = screen.getByTestId('btn-insight-action-confusion');
      fireEvent.click(actionBtn);

      // Verify adaptive practice router dispatch with correct target parameters
      expect(onStartAdaptivePractice).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'flashcard',
          itemIds: expect.arrayContaining(['mst_affect']),
        })
      );
      expect(onNavigate).toHaveBeenCalledWith('flashcards');
    });
  });

  describe('2. Learning Dictionary: WordPersonalizedInsightBanner', () => {
    it('returns null when word profile has no evidence or is brand new', () => {
      const cleanProfile: LearningDictionaryProfile = {
        queriedToken: 'innovative',
        canonicalId: 'w_innovative',
        word: 'innovative',
        normalizedKey: 'innovative',
        isExistingInDictionary: true,
        isStemmedMatch: false,
        ipa: '/ˈɪnəvətɪv/',
        partOfSpeech: 'adj',
        meaning: 'Sáng tạo',
        synonyms: [],
        antonyms: [],
        collocations: [],
        commonCollocations: [],
        staticEntry: null,
        confusion: { commonlyConfused: [], personalizedConfusedWith: [] },
        wordFamily: { root: 'innovate', members: [] },
        isInUserDeck: false,
        isCustomWord: false,
        isFavorite: false,
        memory: {
          cardState: 'new',
          srsLevel: 0,
          interval: 0,
          lapsesCount: 0,
          againCount: 0,
          isDue: false,
          algorithm: 'fsrs',
          reviewCount: 0,
          easeFactor: 2.5,
          stability: null,
          difficulty: null,
          retrievability: null,
          daysUntilDue: null,
          elapsedDaysSinceReview: null,
          lastReviewedDate: null,
          nextReviewDate: null,
          firstLearnedAt: null,
        },
        mistakeSummary: {
          hasMistakeRecord: false,
          mistakeCount: 0,
          unresolved: false,
          resolved: true,
          consecutiveCorrect: 0,
          lastMistakeAt: null,
          primaryType: null,
          source: null,
          typeBreakdown: {},
          sourceBreakdown: {},
          confusedWith: [],
        },
        leechStatus: { isLeech: false, score: 0, reasons: [], againRate: 0, lapseCount: 0 },
        cefrCalibration: { learnerLevel: null, isObservedLearnerLevel: false, difficultyComparison: 'unknown', comparisonLabel: 'Uncalibrated' },
        associatedCollocations: [],
        weakCollocations: [],
        contextUsage: { readingEncounters: 0, writingUsages: 0, lastReadingSeenAt: null, lastWritingUsedAt: null },
        learningStatus: 'new',
      };

      const { container } = render(
        <WordPersonalizedInsightBanner profile={cleanProfile} />
      );

      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('word-personalized-insight-banner')).toBeNull();
    });

    it('renders evidence bullets for troubled word (leech, confusion, weak collocation)', () => {
      const troubledProfile: LearningDictionaryProfile = {
        queriedToken: 'maintain',
        canonicalId: 'w_maintain',
        word: 'maintain',
        normalizedKey: 'maintain',
        isExistingInDictionary: true,
        isStemmedMatch: false,
        ipa: '/meɪnˈteɪn/',
        partOfSpeech: 'verb',
        meaning: 'Duy trì',
        synonyms: [],
        antonyms: [],
        collocations: [],
        commonCollocations: ['maintain consistency', 'maintain standards'],
        staticEntry: null,
        confusion: {
          commonlyConfused: ['sustain'],
          personalizedConfusedWith: [{ word: 'sustain', count: 3, lastOccurredAt: null, source: 'test' }],
        },
        wordFamily: { root: 'maintain', members: [] },
        isInUserDeck: true,
        isCustomWord: false,
        isFavorite: false,
        memory: {
          cardState: 'relearning',
          srsLevel: 1,
          interval: 1,
          lapsesCount: 4,
          againCount: 5,
          isDue: true,
          algorithm: 'fsrs',
          retrievability: 0.62,
          reviewCount: 8,
          easeFactor: 2.1,
          stability: 0.8,
          difficulty: 7.2,
          daysUntilDue: 0,
          elapsedDaysSinceReview: 2,
          lastReviewedDate: '2026-10-04T10:00:00Z',
          nextReviewDate: '2026-10-06T10:00:00Z',
          firstLearnedAt: '2026-09-01T10:00:00Z',
        },
        mistakeSummary: {
          hasMistakeRecord: true,
          mistakeCount: 2,
          unresolved: true,
          resolved: false,
          consecutiveCorrect: 0,
          lastMistakeAt: '2026-10-06T10:00:00Z',
          primaryType: 'meaning',
          source: 'flashcard',
          typeBreakdown: { meaning: 2 },
          sourceBreakdown: { flashcard: 2 },
          confusedWith: ['sustain'],
        },
        leechStatus: { isLeech: true, score: 68, reasons: ['High lapse count (4)'], againRate: 0.6, lapseCount: 4 },
        cefrCalibration: { learnerLevel: 'B2', isObservedLearnerLevel: true, difficultyComparison: 'at_level', comparisonLabel: 'At your level' },
        associatedCollocations: [],
        weakCollocations: [
          {
            phrase: 'maintain consistency',
            meaning: 'Duy trì sự nhất quán',
            isUserSaved: true,
            isInDeck: true,
            hasMistakes: true,
            isWeak: true,
            mistakeCount: 2,
            weaknessEvidence: 'mistake_bank',
          },
        ],
        contextUsage: { readingEncounters: 4, writingUsages: 0, lastReadingSeenAt: '2026-10-05T10:00:00Z', lastWritingUsedAt: null },
        learningStatus: 'relearning',
      };

      const onPracticeMistake = vi.fn();
      const onPracticeCollocation = vi.fn();
      const onReviewNow = vi.fn();

      render(
        <WordPersonalizedInsightBanner
          profile={troubledProfile}
          onPracticeMistake={onPracticeMistake}
          onPracticeCollocation={onPracticeCollocation}
          onReviewNow={onReviewNow}
        />
      );

      const banner = screen.getByTestId('word-personalized-insight-banner');
      expect(banner).toBeDefined();
      expect(screen.getByText('Bạn đang gặp khó khăn với từ này')).toBeDefined();

      // Check evidence bullets
      expect(screen.getByText(/Từ khó \(Leech\)/i)).toBeDefined();
      expect(screen.getByText(/Hay nhầm với sustain/i)).toBeDefined();
      expect(screen.getByText(/Collocation cần củng cố: maintain consistency/i)).toBeDefined();
      expect(screen.getByText(/Có 2 lỗi sai cần luyện lại/i)).toBeDefined();
      expect(screen.getByText(/Xác suất ghi nhớ đang giảm/i)).toBeDefined();
      expect(screen.getByText(/Đã gặp 4 lần khi Đọc nhưng chưa dùng trong Viết/i)).toBeDefined();

      // Check CTA action click
      const ctaBtn = screen.getByTestId('btn-word-insight-action');
      expect(ctaBtn).toBeDefined();
      fireEvent.click(ctaBtn);
      expect(onPracticeMistake).toHaveBeenCalledWith('maintain');
    });

    it('enforces FSRS vs SM-2 semantic isolation (NEVER fakes retrievability for SM-2)', () => {
      const sm2Profile: LearningDictionaryProfile = {
        queriedToken: 'sustain',
        canonicalId: 'w_sustain',
        word: 'sustain',
        normalizedKey: 'sustain',
        isExistingInDictionary: true,
        isStemmedMatch: false,
        ipa: '/səˈsteɪn/',
        partOfSpeech: 'verb',
        meaning: 'Chống đỡ, duy trì',
        synonyms: [],
        antonyms: [],
        collocations: [],
        commonCollocations: [],
        staticEntry: null,
        confusion: { commonlyConfused: [], personalizedConfusedWith: [] },
        wordFamily: { root: 'sustain', members: [] },
        isInUserDeck: true,
        isCustomWord: false,
        isFavorite: false,
        memory: {
          cardState: 'review',
          srsLevel: 2,
          interval: 6,
          lapsesCount: 0,
          againCount: 0,
          isDue: true,
          algorithm: 'sm2', // SM-2 card!
          retrievability: 0.55 as any, // Even if something illegally attached this, engine must IGNORE
          reviewCount: 2,
          easeFactor: 2.5,
          stability: null,
          difficulty: null,
          daysUntilDue: 0,
          elapsedDaysSinceReview: 6,
          lastReviewedDate: '2026-09-30T10:00:00Z',
          nextReviewDate: '2026-10-06T10:00:00Z',
          firstLearnedAt: '2026-09-24T10:00:00Z',
        },
        mistakeSummary: {
          hasMistakeRecord: false,
          mistakeCount: 0,
          unresolved: false,
          resolved: true,
          consecutiveCorrect: 0,
          lastMistakeAt: null,
          primaryType: null,
          source: null,
          typeBreakdown: {},
          sourceBreakdown: {},
          confusedWith: [],
        },
        leechStatus: { isLeech: false, score: 0, reasons: [], againRate: 0, lapseCount: 0 },
        cefrCalibration: { learnerLevel: null, isObservedLearnerLevel: false, difficultyComparison: 'unknown', comparisonLabel: 'Uncalibrated' },
        associatedCollocations: [],
        weakCollocations: [],
        contextUsage: { readingEncounters: 0, writingUsages: 0, lastReadingSeenAt: null, lastWritingUsedAt: null },
        learningStatus: 'review',
      };

      const result = deriveWordPersonalizedInsight(sm2Profile);
      // Because lapsesCount=0, againCount=0, confusion=0, weakColloc=0, unresolved=false, usageGap=0
      // And retrievability MUST be ignored for SM-2
      // Result must NOT have retrievability bullet!
      expect(result).toBeNull();
    });

    it('renders positive headline for mastered word with 0 mistakes', () => {
      const masteredProfile: LearningDictionaryProfile = {
        queriedToken: 'meticulous',
        canonicalId: 'w_meticulous',
        word: 'meticulous',
        normalizedKey: 'meticulous',
        isExistingInDictionary: true,
        isStemmedMatch: false,
        ipa: '/məˈtɪkjələs/',
        partOfSpeech: 'adj',
        meaning: 'Tỉ mỉ, cẩn thận',
        synonyms: [],
        antonyms: [],
        collocations: [],
        commonCollocations: [],
        staticEntry: null,
        confusion: { commonlyConfused: [], personalizedConfusedWith: [] },
        wordFamily: { root: 'meticulous', members: [] },
        isInUserDeck: true,
        isCustomWord: false,
        isFavorite: false,
        memory: {
          cardState: 'review',
          srsLevel: 6,
          interval: 45,
          lapsesCount: 0,
          againCount: 0,
          isDue: false,
          algorithm: 'fsrs',
          retrievability: 0.96,
          reviewCount: 12,
          easeFactor: 2.8,
          stability: 45,
          difficulty: 3.1,
          daysUntilDue: 30,
          elapsedDaysSinceReview: 15,
          lastReviewedDate: '2026-09-20T10:00:00Z',
          nextReviewDate: '2026-11-05T10:00:00Z',
          firstLearnedAt: '2026-07-01T10:00:00Z',
        },
        mistakeSummary: {
          hasMistakeRecord: false,
          mistakeCount: 0,
          unresolved: false,
          resolved: true,
          consecutiveCorrect: 4,
          lastMistakeAt: null,
          primaryType: null,
          source: null,
          typeBreakdown: {},
          sourceBreakdown: {},
          confusedWith: [],
        },
        leechStatus: { isLeech: false, score: 0, reasons: [], againRate: 0, lapseCount: 0 },
        cefrCalibration: { learnerLevel: 'B2', isObservedLearnerLevel: true, difficultyComparison: 'at_level', comparisonLabel: 'At your level' },
        associatedCollocations: [],
        weakCollocations: [],
        contextUsage: { readingEncounters: 3, writingUsages: 2, lastReadingSeenAt: '2026-10-01T10:00:00Z', lastWritingUsedAt: '2026-10-02T10:00:00Z' },
        learningStatus: 'mastered',
      };

      render(<WordPersonalizedInsightBanner profile={masteredProfile} />);

      expect(screen.getByText('Từ vựng đã ghi nhớ vững vàng')).toBeDefined();
      expect(screen.getByText(/Ghi nhớ ổn định và không còn lỗi sai/i)).toBeDefined();
    });
  });

  describe('3. Four Skills: FourSkillsAdaptiveSummary Integration', () => {
    it('renders skill gap insight when significant competency disparity exists across assessed skills', () => {
      useAppStore.setState({
        fourSkillsEvidence: {
          reading: [
            { id: 'ev_r1', skill: 'reading', score: 95, source: 'four-skills', createdAt: Date.now() },
            { id: 'ev_r2', skill: 'reading', score: 90, source: 'four-skills', createdAt: Date.now() },
            { id: 'ev_r3', skill: 'reading', score: 92, source: 'four-skills', createdAt: Date.now() },
            { id: 'ev_r4', skill: 'reading', score: 94, source: 'four-skills', createdAt: Date.now() },
          ],
          listening: [
            { id: 'ev_l1', skill: 'listening', score: 40, source: 'four-skills', createdAt: Date.now() },
            { id: 'ev_l2', skill: 'listening', score: 42, source: 'four-skills', createdAt: Date.now() },
            { id: 'ev_l3', skill: 'listening', score: 45, source: 'four-skills', createdAt: Date.now() },
            { id: 'ev_l4', skill: 'listening', score: 44, source: 'four-skills', createdAt: Date.now() },
          ],
          speaking: [
            { id: 'ev_s1', skill: 'speaking', score: 88, source: 'four-skills', createdAt: Date.now() },
            { id: 'ev_s2', skill: 'speaking', score: 85, source: 'four-skills', createdAt: Date.now() },
            { id: 'ev_s3', skill: 'speaking', score: 86, source: 'four-skills', createdAt: Date.now() },
            { id: 'ev_s4', skill: 'speaking', score: 87, source: 'four-skills', createdAt: Date.now() },
          ],
          writing: [
            { id: 'ev_w1', skill: 'writing', score: 90, source: 'four-skills', createdAt: Date.now() },
            { id: 'ev_w2', skill: 'writing', score: 92, source: 'four-skills', createdAt: Date.now() },
            { id: 'ev_w3', skill: 'writing', score: 89, source: 'four-skills', createdAt: Date.now() },
            { id: 'ev_w4', skill: 'writing', score: 91, source: 'four-skills', createdAt: Date.now() },
          ],
        },
      });

      const onNavigate = vi.fn();
      render(<FourSkillsAdaptiveSummary onNavigate={onNavigate} />);

      const strip = screen.getByTestId('four-skills-insight-strip');
      expect(strip).toBeDefined();
      expect(screen.getByText(/Chênh lệch kỹ năng/i)).toBeDefined();
      expect(screen.getAllByText(/Listening/i).length).toBeGreaterThan(0);

      const btn = screen.getByTestId('btn-practice-skill-insight');
      expect(btn).toBeDefined();
      fireEvent.click(btn);
      expect(onNavigate).toHaveBeenCalledWith('four_skills');
      expect(useAppStore.getState().activeFourSkill).toBe('listening');
    });

    it('renders missing sample guidance when a skill has zero attempts', () => {
      useAppStore.setState({
        fourSkillsEvidence: {
          reading: [
            { id: 'ev_r1', skill: 'reading', score: 85, source: 'four-skills', createdAt: Date.now() },
            { id: 'ev_r2', skill: 'reading', score: 88, source: 'four-skills', createdAt: Date.now() },
          ],
          listening: [],
          speaking: [],
          writing: [],
        },
      });

      render(<FourSkillsAdaptiveSummary />);

      const strip = screen.getByTestId('four-skills-insight-strip');
      expect(strip).toBeDefined();
      expect(screen.getByText(/Cần thêm dữ liệu/i)).toBeDefined();
      expect(screen.getByText(/ít dữ liệu/i)).toBeDefined();
    });
  });

  describe('4. AI Tutor: Today Focus Insight Explanation', () => {
    it('renders tutor insight explanation when learner history is present', () => {
      useAppStore.setState({
        mistakeBank: {
          mst_maintain: {
            id: 'mst_maintain',
            word: 'maintain',
            meaning: 'Duy trì',
            mistakeCount: 2,
            lastMistakeAt: '2026-10-06T10:00:00Z',
            consecutiveCorrect: 0,
            resolved: false,
            primaryType: 'meaning',
            lastUserAnswer: 'sustain',
          },
          mst_sustain: {
            id: 'mst_sustain',
            word: 'sustain',
            meaning: 'Chống đỡ',
            mistakeCount: 2,
            lastMistakeAt: '2026-10-06T11:00:00Z',
            consecutiveCorrect: 0,
            resolved: false,
            primaryType: 'meaning',
            lastUserAnswer: 'maintain',
          },
        },
        srsProgressMap: {
          w_maintain: {
            srsLevel: 1,
            nextReviewDate: '2026-10-06T10:00:00Z',
            interval: 1,
            easeFactor: 2.5,
            reviewCount: 3,
            againCount: 1,
          },
        },
      });

      render(<AITutorView />);

      const tutorInsight = screen.getByTestId('tutor-personalized-insight');
      expect(tutorInsight).toBeDefined();
      expect(screen.getByText(/Gợi ý phản hồi/i)).toBeDefined();
      expect(screen.getAllByText(/nhầm lẫn/i).length).toBeGreaterThan(0);
    });
  });

  describe('5. deriveWordPersonalizedInsight Edge Cases', () => {
    it('returns null on undefined or empty profile', () => {
      expect(deriveWordPersonalizedInsight(null)).toBeNull();
      expect(deriveWordPersonalizedInsight(undefined)).toBeNull();
      expect(deriveWordPersonalizedInsight({ word: '' } as any)).toBeNull();
    });

    it('assigns critical severity for leech card', () => {
      const profile = {
        word: 'unprecedented',
        leechStatus: { isLeech: true, leechScore: 75, reasons: ['High lapse rate'] },
      } as any;

      const res = deriveWordPersonalizedInsight(profile);
      expect(res).not.toBeNull();
      expect(res?.severity).toBe('critical');
      expect(res?.bullets[0]).toContain('Từ khó (Leech)');
    });

    it('creates weak collocation bullet and collocation action', () => {
      const profile = {
        word: 'acquire',
        weakCollocations: [
          { phrase: 'acquire knowledge', isWeakCollocation: true, mistakeCount: 2 },
        ],
      } as any;

      const res = deriveWordPersonalizedInsight(profile);
      expect(res).not.toBeNull();
      expect(res?.bullets[0]).toContain('Collocation cần củng cố: acquire knowledge');
      expect(res?.suggestedAction?.type).toBe('collocation');
      expect(res?.suggestedAction?.targetPhrase).toBe('acquire knowledge');
    });

    it('handles reading/writing passive usage gap', () => {
      const profile = {
        word: 'ubiquitous',
        contextUsage: { readingEncounters: 5, writingUsages: 0 },
      } as any;

      const res = deriveWordPersonalizedInsight(profile);
      expect(res).not.toBeNull();
      expect(res?.bullets[0]).toContain('Đã gặp 5 lần khi Đọc nhưng chưa dùng trong Viết');
    });
  });
});

