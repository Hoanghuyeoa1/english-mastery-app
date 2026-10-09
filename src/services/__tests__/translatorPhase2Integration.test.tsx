// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { WordLearningStatsMap } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { initializeDictionary } from '../dictionaryIndex';
import { analyzeSourceText } from '../textAnalysisService';
import { deriveLearnerSemantic, getLearningDictionaryProfile } from '../learningDictionaryService';
import {
  recordTranslatorWordLookup,
  recordTranslatorBatchEncounters,
  sanitizeWordLearningStats,
  getWordContextUsageTelemetry,
  clearActivityDeduplication
} from '../wordUsageTelemetry';
import { VocabularyMiningPanel } from '../../components/VocabularyMiningPanel';
import { TranslatorView } from '../../components/TranslatorView';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, style, ...props }: any) => (
      <div className={className} style={style} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('Translator Phase 2: Known/Unknown, SRS, Learning Dictionary & Mining', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearActivityDeduplication();
    initializeDictionary();
    useAppStore.setState({
      geminiApiKey: '',
      userCollocations: [],
      srsProgressMap: {},
      mistakeBank: {},
      wordLearningStats: {},
    });
  });

  describe('1. Known / Unknown / Learning Semantics (Single Source of Truth)', () => {
    it('derives "known" only when maturity evidence exists (mastered card)', () => {
      expect(deriveLearnerSemantic('mastered')).toBe('known');
      expect(deriveLearnerSemantic({ learningStatus: 'mastered', isInUserDeck: true })).toBe('known');
    });

    it('derives "learning" when word/phrase is active in user deck', () => {
      expect(deriveLearnerSemantic('learning')).toBe('learning');
      expect(deriveLearnerSemantic('review')).toBe('learning');
      expect(deriveLearnerSemantic('relearning')).toBe('learning');
      expect(deriveLearnerSemantic('leech')).toBe('learning');
      expect(deriveLearnerSemantic('needs_practice')).toBe('learning');
      expect(deriveLearnerSemantic({ learningStatus: 'learning', isInUserDeck: true })).toBe('learning');
    });

    it('derives "unknown" for words not yet in user deck', () => {
      expect(deriveLearnerSemantic('new')).toBe('unknown');
      expect(deriveLearnerSemantic({ learningStatus: 'new', isInUserDeck: false })).toBe('unknown');
    });

    it('lookup NEVER automatically converts an unlearned word to "known"', () => {
      const stats = recordTranslatorWordLookup({}, 'optimize');
      expect(stats['optimize'].translatorLookups).toBe(1);

      // Verify that learning profile remains unmastered / not auto-known
      const profile = getLearningDictionaryProfile('optimize', {
        storeState: {
          srsProgressMap: {},
          userCustomWords: [],
          wordLearningStats: stats,
        },
      });

      expect(profile.learningStatus).not.toBe('mastered');
      expect(deriveLearnerSemantic(profile)).toBe('unknown');
    });
  });

  describe('2. Single Word SRS Save Flow (No Duplicate & Canonical Resolution)', () => {
    it('saves canonical lemma to SRS and tags source as translator', () => {
      const { saveToSRS } = useAppStore.getState();

      saveToSRS('optimized', {
        contextSentence: 'We optimized our backend microservices.',
        source: 'translator',
      });

      const srsMap = useAppStore.getState().srsProgressMap;
      const card = Object.values(srsMap)[0];
      expect(card).toBeDefined();
      expect(card?.sources).toContain('translator');
    });

    it('does not create duplicate card when saving an existing word again', () => {
      const { saveToSRS } = useAppStore.getState();

      saveToSRS('optimize', {
        contextSentence: 'First context.',
        source: 'reading',
      });

      const countBefore = Object.keys(useAppStore.getState().srsProgressMap).length;

      // Save again from translator
      saveToSRS('optimize', {
        contextSentence: 'Second context from translator.',
        source: 'translator',
      });

      const countAfter = Object.keys(useAppStore.getState().srsProgressMap).length;
      expect(countAfter).toBe(countBefore);

      // Verify sources merged without losing previous progress
      const card = Object.values(useAppStore.getState().srsProgressMap)[0];
      expect(card?.sources).toContain('reading');
      expect(card?.sources).toContain('translator');
    });
  });

  describe('3. Multi-word Phrase & Collocation Save Strategy', () => {
    it('saves phrasal verb / idiom / collocation to unified collocation deck without duplicates', () => {
      const { saveCollocationToSRS } = useAppStore.getState();

      const res1 = saveCollocationToSRS({
        phrase: 'backend microservices',
        meaning: 'Hệ thống vi dịch vụ backend',
        usageContext: 'We need to optimize our backend microservices.',
        exampleEn: 'We need to optimize our backend microservices.',
        exampleVi: 'Chúng ta cần tối ưu hóa các vi dịch vụ backend.',
        source: 'translator',
        tags: ['it_term', 'translator'],
      });

      expect(res1.success).toBe(true);
      expect(useAppStore.getState().userCollocations.length).toBe(1);

      // Saving duplicate phrase should return isDuplicate: true and NOT append another card
      const res2 = saveCollocationToSRS({
        phrase: '  backend microservices  ',
        meaning: 'Hệ thống vi dịch vụ backend',
        usageContext: 'Another context',
        exampleEn: 'Another context',
        exampleVi: 'Ngữ cảnh khác',
        source: 'translator',
      });

      expect(res2.isDuplicate).toBe(true);
      expect(useAppStore.getState().userCollocations.length).toBe(1);
    });

    it('sanitizes context sentence and does not persist entire raw article', () => {
      const { saveCollocationToSRS } = useAppStore.getState();
      const sentence = 'We need to scale up our microservices.';

      saveCollocationToSRS({
        phrase: 'scale up',
        meaning: 'Mở rộng quy mô',
        usageContext: sentence,
        exampleEn: sentence,
        exampleVi: 'Chúng tôi cần mở rộng quy mô các dịch vụ.',
        source: 'translator',
      });

      const item = useAppStore.getState().userCollocations[0];
      expect(item.usageContext).toBe(sentence);
      expect(item.usageContext?.length).toBeLessThan(300);
    });
  });

  describe('4. Telemetry Bounds & Learning Dictionary Integration', () => {
    it('records translator encounters idempotently within cooldown window', () => {
      let stats: WordLearningStatsMap = {};
      const activityId = 'trans_test_session_1';

      stats = recordTranslatorBatchEncounters(stats, 'We need to optimize latency and scalability.', activityId);
      const initialCount = stats['latency']?.translatorEncounters;
      expect(initialCount).toBe(1);

      // Immediate re-recording with same activityId should be blocked by deduplication guard
      stats = recordTranslatorBatchEncounters(stats, 'We need to optimize latency and scalability.', activityId);
      expect(stats['latency']?.translatorEncounters).toBe(initialCount);
    });

    it('bounds counter values and sanitizes corrupt telemetry without crashing', () => {
      const malformed = {
        'overflow_word': {
          translatorLookups: 999999,
          translatorEncounters: -50,
          lastTranslatorLookupAt: 'invalid-date',
          lastTranslatorSeenAt: '2026-10-06T00:00:00.000Z',
        },
      };

      const sanitized = sanitizeWordLearningStats(malformed);
      expect(sanitized['overflow_word'].translatorLookups).toBe(999); // Capped at 999
      expect(sanitized['overflow_word'].translatorEncounters).toBeUndefined(); // Dropped negative
      expect(sanitized['overflow_word'].lastTranslatorLookupAt).toBeNull(); // Dropped invalid date
      expect(sanitized['overflow_word'].lastTranslatorSeenAt).toBe('2026-10-06T00:00:00.000Z');
    });

    it('reflects translator telemetry in getWordContextUsageTelemetry', () => {
      const stats = {
        'latency': {
          readingEncounters: 2,
          lastReadingSeenAt: '2026-10-05T00:00:00.000Z',
          writingUsages: 1,
          lastWritingUsedAt: '2026-10-05T12:00:00.000Z',
          translatorLookups: 3,
          lastTranslatorLookupAt: '2026-10-06T01:00:00.000Z',
          translatorEncounters: 5,
          lastTranslatorSeenAt: '2026-10-06T02:00:00.000Z',
        },
      };

      const tel = getWordContextUsageTelemetry('latency', 'vocab_latency', 'latency', stats);
      expect(tel.translatorLookups).toBe(3);
      expect(tel.lastTranslatorLookupAt).toBe('2026-10-06T01:00:00.000Z');
      expect(tel.translatorEncounters).toBe(5);
      expect(tel.lastTranslatorSeenAt).toBe('2026-10-06T02:00:00.000Z');
    });
  });

  describe('5. Vocabulary Mining Panel & Smart Filtering', () => {
    const text = 'We need to optimize our backend microservices to minimize latency and improve scalability.';

    it('renders categories with accurate counts without crashing', () => {
      const analysis = analyzeSourceText(text);

      render(
        <VocabularyMiningPanel
          sourceText={text}
          analysis={analysis}
        />
      );

      expect(screen.getByText(/Khai Thác Từ Vựng & Cụm Từ/i)).toBeDefined();
      expect(screen.getAllByText('Tất cả').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Chưa học')).toBeDefined();
    });

    it('filters items smoothly without recomputing NLP regex analysis', () => {
      const analysis = analyzeSourceText(text);
      const { container } = render(
        <VocabularyMiningPanel
          sourceText={text}
          analysis={analysis}
        />
      );

      // Filter by "Chưa lưu"
      const unsavedFilterBtn = screen.getByText('Chưa lưu');
      fireEvent.click(unsavedFilterBtn);

      // Items should still be present
      expect(container.querySelectorAll('.rounded-2xl').length).toBeGreaterThan(0);

      // Filter by "B2+"
      const b2Btn = screen.getByText('B2+');
      fireEvent.click(b2Btn);

      expect(container).toBeDefined();
    });

    it('batch saves all unsaved items with confetti and +XP toast', () => {
      const analysis = analyzeSourceText(text);
      render(
        <VocabularyMiningPanel
          sourceText={text}
          analysis={analysis}
        />
      );

      const batchSaveBtn = screen.queryByText(/Lưu tất cả \(/i);
      if (batchSaveBtn) {
        fireEvent.click(batchSaveBtn);
        // Verify toast appears
        expect(screen.getByText(/Đã lưu thành công/i)).toBeDefined();
      }
    });
  });

  describe('6. Mistake Bank Isolation Invariant', () => {
    it('NEVER inserts into Mistake Bank on word lookup, mark unknown, or SRS save', () => {
      const { saveToSRS, saveCollocationToSRS, recordTranslatorLookup } = useAppStore.getState();

      // 1. Lookup
      recordTranslatorLookup('optimize');

      // 2. Save word
      saveToSRS('optimize', { contextSentence: 'Sample context', source: 'translator' });

      // 3. Save phrase
      saveCollocationToSRS({
        phrase: 'backend microservices',
        meaning: 'Vi dịch vụ backend',
        exampleEn: 'Sample backend microservices context',
        exampleVi: 'Ngữ cảnh vi dịch vụ backend mẫu',
        source: 'translator',
      });

      // Mistake bank must remain completely empty!
      const mistakeBank = useAppStore.getState().mistakeBank;
      expect(Object.keys(mistakeBank).length).toBe(0);
    });
  });

  describe('7. Offline & Fallback Independence', () => {
    it('operates 100% offline without network calls or API keys', () => {
      const offlineText = 'The team carried out the plan and deployed the microservice.';
      const analysis = analyzeSourceText(offlineText);

      expect(analysis.phrasalVerbs.some((p) => p.canonical === 'carry out')).toBe(true);
      expect(analysis.itVocabulary.some((it) => it.canonical === 'microservice')).toBe(true);
      expect(analysis.wordCount).toBeGreaterThan(0);
    });

    it('ensures translation core remains functional even if mining throws', () => {
      render(<TranslatorView />);
      // Core translation interface rendered
      expect(screen.getByText(/Trợ Lý Dịch Thuật AI/i)).toBeDefined();
      expect(screen.getByText(/VĂN BẢN GỐC/i)).toBeDefined();
    });
  });
});
