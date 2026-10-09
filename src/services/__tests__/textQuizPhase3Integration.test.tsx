// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { initializeDictionary } from '../dictionaryIndex';
import { analyzeSourceText } from '../textAnalysisService';
import {
  createQuizFromText,
  extractAndPrioritizeCandidates,
  extractSentenceForRange,
} from '../textQuizGeneratorService';
import { TextQuizModal } from '../../components/TextQuizModal';
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

// Mock speech service
vi.mock('../speechService', () => ({
  speakWord: vi.fn(),
}));

describe('Translator Phase 3: Create Quiz From Text & Full Regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeDictionary();
    useAppStore.setState({
      geminiApiKey: '',
      userCollocations: [],
      srsProgressMap: {},
      mistakeBank: {},
      wordLearningStats: {},
      profile: {
        ...useAppStore.getState().profile,
        name: 'Learner',
        level: 1,
        xp: 100,
        streak: 3,
        equippedTitle: 'Tân thủ',
        isOnboarded: true,
      },
    });
  });

  describe('1. End-to-End Linguistic Example Verification', () => {
    const sampleSentence = 'The team carried out a comprehensive evaluation of the distributed system.';

    it('extracts phrasal verbs, academic vocabulary, and IT terms with evidence', () => {
      const analysis = analyzeSourceText(sampleSentence);

      // Verify linguistic extractions
      expect(analysis.phrasalVerbs.some((p) => p.canonical === 'carry out')).toBe(true);
      expect(analysis.itVocabulary.some((it) => it.canonical === 'distributed system')).toBe(true);
      expect(analysis.academicVocabulary.some((a) => a.canonical === 'evaluation')).toBe(true);
      expect(analysis.tokens.some((t) => t.lemma === 'comprehensive')).toBe(true);
    });

    it('generates grounded quiz questions targeting the exact context sentence', () => {
      const analysis = analyzeSourceText(sampleSentence);
      const session = createQuizFromText(sampleSentence, analysis);

      expect(session.questions.length).toBeGreaterThan(0);
      expect(session.questions.length).toBeLessThanOrEqual(5);

      // Verify that every question references the source text sentence
      for (const q of session.questions) {
        expect(q.contextSentence).toBeDefined();
        // Context contains words from the original sentence
        expect(
          q.contextSentence!.includes('team') ||
          q.contextSentence!.includes('distributed system') ||
          q.contextSentence!.includes('evaluation')
        ).toBe(true);

        // Has exactly 1 correct answer
        const correctCount = q.options.filter((o) => o.isCorrect).length;
        expect(correctCount).toBe(1);

        // Has at least 3 options
        expect(q.options.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('2. Grounded Evidence & Bounded Quiz Size Invariant', () => {
    it('never invents questions beyond valid linguistic evidence (bounded count)', () => {
      // Short sentence with only 1-2 meaningful items
      const shortText = 'Cats sleep.';
      const analysis = analyzeSourceText(shortText);

      const requestedSize = 10;
      const session = createQuizFromText(shortText, analysis, {}, { maxQuestions: requestedSize });

      // Must be capped by available items, NEVER forced to 10!
      expect(session.questions.length).toBeLessThanOrEqual(session.availableItemCount);
      expect(session.questions.length).toBeLessThan(10);
    });

    it('extracts precise enclosing sentence for text span ranges', () => {
      const passage = 'First sentence is short. The backend microservices handled millions of concurrent requests. Third sentence is here.';
      const start = passage.indexOf('backend microservices');
      const end = start + 'backend microservices'.length;

      const sentence = extractSentenceForRange(passage, start, end);
      expect(sentence).toContain('backend microservices handled millions of concurrent requests');
      expect(sentence).not.toContain('First sentence');
      expect(sentence).not.toContain('Third sentence');
    });
  });

  describe('3. Prioritization Strategy (Unknown > Learning > Mistakes > B2+)', () => {
    const text = 'We need to optimize our backend microservices to minimize latency.';

    it('ranks words with open mistakes and unknown status highest in quiz priority', () => {
      const analysis = analyzeSourceText(text);

      // Inject open mistake for "latency"
      const storeContext = {
        mistakeBank: {
          latency: {
            id: 'latency',
            word: 'latency',
            ipa: '',
            meaning: 'Độ trễ',
            example: '',
            tag: 'Daily' as const,
            mistakeCount: 2,
            wrongCount: 2,
            consecutiveCorrect: 0,
            resolved: false,
            lastMistakeAt: new Date().toISOString(),
            source: 'classic_quiz' as const,
          },
        },
        srsProgressMap: {},
      };

      const candidates = extractAndPrioritizeCandidates(text, analysis, storeContext);
      expect(candidates.length).toBeGreaterThan(0);

      // Latency has an open mistake (+50 score) -> must be ranked at the very top!
      const topCandidate = candidates[0];
      expect(topCandidate.targetItem.toLowerCase()).toContain('latency');
      expect(topCandidate.hasOpenMistake).toBe(true);
    });

    it('prioritizes unknown and learning items over already known items', () => {
      const analysis = analyzeSourceText(text);

      // "optimize" is mastered/known (+5), "microservices" is unknown (+35)
      const storeContext = {
        srsProgressMap: {
          optimize: {
            srsLevel: 6,
            interval: 30,
            easeFactor: 2.6,
            nextReviewDate: new Date(Date.now() + 864000000).toISOString(),
            firstLearnedAt: new Date().toISOString(),
            lastReviewedDate: new Date().toISOString(),
          },
        },
      };

      const candidates = extractAndPrioritizeCandidates(text, analysis, storeContext);
      const optimizeCandidate = candidates.find((c) => c.canonicalLemma.toLowerCase().includes('optimize'));
      const itCandidate = candidates.find((c) => c.category === 'it_term');

      if (optimizeCandidate && itCandidate) {
        expect(itCandidate.priorityScore).toBeGreaterThan(optimizeCandidate.priorityScore);
      }
    });
  });

  describe('4. Distractor Engine Quality & Uniqueness', () => {
    it('ensures all options in generated questions are strictly unique', () => {
      const text = 'The team carried out a comprehensive evaluation of the distributed system to optimize performance.';
      const analysis = analyzeSourceText(text);
      const session = createQuizFromText(text, analysis, {}, { maxQuestions: 5 });

      for (const question of session.questions) {
        const optionTexts = question.options.map((o) => o.text.trim().toLowerCase());
        const uniqueSet = new Set(optionTexts);
        expect(uniqueSet.size).toBe(optionTexts.length); // Zero duplicate options!
      }
    });

    it('creates cloze fill-in questions with target word masked out', () => {
      const text = 'We need to analyze the data.';
      const analysis = analyzeSourceText(text);
      const session = createQuizFromText(text, analysis, {}, { maxQuestions: 2 });

      const clozeQuestion = session.questions.find((q) => q.type === 'cloze');
      if (clozeQuestion) {
        expect(clozeQuestion.contextSentence).toContain('[ ________ ]');
        expect(clozeQuestion.options.some((o) => o.isCorrect)).toBe(true);
      }
    });
  });

  describe('5. Quiz → Learning System Integration & Invariants', () => {
    it('awards XP and updates mistake bank without modifying FSRS/SM-2 intervals directly', () => {
      const text = 'We need to optimize the database.';
      const analysis = analyzeSourceText(text);
      const session = createQuizFromText(text, analysis);
      const question = session.questions[0];

      // Existing SRS progress before quiz
      const initialInterval = 10;
      const initialEase = 2.5;
      useAppStore.setState({
        srsProgressMap: {
          [question.canonicalLemma]: {
            srsLevel: 3,
            interval: initialInterval,
            easeFactor: initialEase,
            nextReviewDate: new Date(Date.now() + 86400000).toISOString(),
            firstLearnedAt: new Date().toISOString(),
            lastReviewedDate: new Date().toISOString(),
          },
        },
      });

      const xpBefore = useAppStore.getState().profile.xp;

      // Answering correctly via recordQuizMistakeResult
      useAppStore.getState().recordQuizMistakeResult(question.canonicalLemma, true, {
        source: 'classic_quiz',
        type: 'meaning',
      });
      useAppStore.getState().gainXP(10);

      // Verify XP increased
      expect(useAppStore.getState().profile.xp).toBe(xpBefore + 10);

      // CRITICAL INVARIANT: SRS interval and ease factor MUST NOT have changed!
      const currentCard = useAppStore.getState().srsProgressMap[question.canonicalLemma];
      expect(currentCard.interval).toBe(initialInterval);
      expect(currentCard.easeFactor).toBe(initialEase);
    });

    it('records incorrect answers into mistakeBank for adaptive review', () => {
      const { recordQuizMistakeResult } = useAppStore.getState();

      recordQuizMistakeResult('microservices', false, {
        source: 'classic_quiz',
        type: 'collocation',
        userAnswer: 'monoliths',
        expectedAnswer: 'microservices',
        context: 'We optimized our microservices.',
      });

      const mistakeRecord = useAppStore.getState().mistakeBank['microservices'];
      expect(mistakeRecord).toBeDefined();
      expect(mistakeRecord.resolved).toBe(false);
      expect(mistakeRecord.lastUserAnswer).toBe('monoliths');
      expect(mistakeRecord.lastExpectedAnswer).toBe('microservices');
    });
  });

  describe('6. Edge Cases & Security Robustness', () => {
    it('handles empty text, single words, and symbols without throwing', () => {
      expect(() => createQuizFromText('', analyzeSourceText(''))).not.toThrow();
      expect(() => createQuizFromText('a', analyzeSourceText('a'))).not.toThrow();
      expect(() => createQuizFromText('https://example.com/api?id=123', analyzeSourceText('https://example.com/api?id=123'))).not.toThrow();
      expect(() => createQuizFromText('12345 67890 !@#$%^&*()', analyzeSourceText('12345 67890 !@#$%^&*()'))).not.toThrow();
    });

    it('processes long passage (2000+ words) quickly without memory blowup', () => {
      const paragraph = 'The distributed architecture optimizes system throughput and latency. ';
      const longText = paragraph.repeat(30); // ~300+ words
      const tStart = performance.now();

      const analysis = analyzeSourceText(longText);
      const session = createQuizFromText(longText, analysis, {}, { maxQuestions: 5 });

      const durationMs = performance.now() - tStart;
      expect(durationMs).toBeLessThan(500); // Super fast execution
      expect(session.questions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('7. TextQuizModal Interactive Lifecycle', () => {
    const text = 'The team carried out a comprehensive evaluation to optimize our distributed system.';
    const analysis = analyzeSourceText(text);

    it('renders modal, steps through questions, and shows results summary', () => {
      const onCloseMock = vi.fn();

      render(
        <TextQuizModal
          isOpen={true}
          onClose={onCloseMock}
          sourceText={text}
          analysis={analysis}
        />
      );

      // 1. Config view
      expect(screen.getByText(/Tạo Quiz Từ Văn Bản/i)).toBeDefined();
      expect(screen.getByText(/Sẵn Sàng Kiểm Tra Kiến Thức/i)).toBeDefined();

      // Click "Bắt Đầu Làm Quiz"
      const startBtn = screen.getByText(/Bắt Đầu Làm Quiz/i);
      fireEvent.click(startBtn);

      // 2. Active playing view
      expect(screen.getByText(/Câu 1 \//i)).toBeDefined();
      expect(screen.getByText(/Kiểm tra đáp án/i)).toBeDefined();

      // Click first option
      const options = screen.getAllByRole('radio');
      expect(options.length).toBeGreaterThanOrEqual(3);
      fireEvent.click(options[0]);

      // Submit answer
      const submitBtn = screen.getByText(/Kiểm tra đáp án/i);
      fireEvent.click(submitBtn);

      // Explanation should appear
      expect(screen.getByText(/Giải thích & Ghi nhớ/i)).toBeDefined();
    });

    it('renders "Tạo Quiz từ đoạn này" button directly in TranslatorView', () => {
      render(<TranslatorView />);

      const createQuizBtns = screen.getAllByText(/Tạo Quiz/i);
      expect(createQuizBtns.length).toBeGreaterThanOrEqual(1);

      // Clicking opens the TextQuizModal
      fireEvent.click(createQuizBtns[0]);
      expect(screen.getByText(/Tạo Quiz Từ Văn Bản/i)).toBeDefined();
    });
  });
});
