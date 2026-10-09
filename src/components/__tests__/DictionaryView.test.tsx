// @vitest-environment happy-dom
// src/components/__tests__/DictionaryView.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { DictionaryView } from '../DictionaryView';
import { useAppStore } from '../../store/useAppStore';
import { VocabWord, MistakeRecord, CollocationItem, SRSProgress, FSRSMemoryState } from '../../types';
import confetti from 'canvas-confetti';
import { translateText } from '../../services/translationService';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock speech service
vi.mock('../../services/speechService', () => ({
  speakWord: vi.fn(),
}));

// Mock translation service
vi.mock('../../services/translationService', () => ({
  translateText: vi.fn(async (word: string) => `Nghĩa dịch tự động của ${word}`),
}));

// Mock clipboard
const mockClipboardWrite = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockClipboardWrite,
  },
  writable: true,
  configurable: true,
});

function createTestWord(partial: Partial<VocabWord> & { id: string; word: string }): VocabWord {
  return {
    ipa: `/${partial.word}/`,
    partOfSpeech: 'noun',
    meaning: 'Nghĩa test',
    example: 'Sample test sentence.',
    tag: 'Daily',
    srsLevel: 0,
    interval: 0,
    easeFactor: 2.5,
    nextReviewDate: '',
    ...partial,
  };
}

function createTestCollocation(partial: Partial<CollocationItem> & { id: string; phrase: string; meaning: string }): CollocationItem {
  return {
    exampleEn: 'Sample collocation sentence.',
    exampleVi: 'Câu ví dụ mẫu.',
    createdAt: '2026-10-01T00:00:00.000Z',
    ...partial,
  };
}

describe('PHASE 5: Learning Dictionary UI + Quick Actions Hardened Suite', () => {
  const initialStoreState = useAppStore.getState();

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState(initialStoreState, true);

    // Mock global fetch for Datamuse API & translation fallback
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('translate.googleapis.com')) {
        return {
          ok: true,
          json: async () => [[['Nghĩa dịch tự động của microservices']]],
        };
      }
      if (typeof url === 'string' && url.includes('api.datamuse.com')) {
        if (url.includes('rel_syn')) {
          return { ok: true, json: async () => [{ word: 'endurance' }, { word: 'toughness' }] };
        }
        if (url.includes('rel_trg')) {
          return { ok: true, json: async () => [{ word: 'stress' }, { word: 'adversity' }] };
        }
        return {
          ok: true,
          json: async () => [
            {
              word: 'test',
              tags: ['n'],
              defs: ['n\tthe capacity to recover quickly from difficulties'],
            },
          ],
        };
      }
      return { ok: false, json: async () => [] };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. NEW WORD UI
  it('1. New Word UI: renders classical dictionary header and elegant empty state for unstudied word', async () => {
    const sampleWord = createTestWord({
      id: 'vocab_resilience',
      word: 'resilience',
      ipa: '/rɪˈzɪliəns/',
      meaning: 'Khả năng phục hồi, kiên cường',
      example: 'Her resilience in facing challenges is remarkable.',
      exampleMeaning: 'Sự kiên cường khi đối mặt thử thách của cô ấy thật đáng nể.',
      tag: 'Academic',
      level: 'B2',
    });

    useAppStore.setState({
      vocabularyList: [sampleWord],
      srsProgressMap: {},
      mistakeBank: {},
      wordLearningStats: {},
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'resilience' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'resilience' })).toBeDefined();
    });

    expect(screen.getByText('Khả năng phục hồi, kiên cường')).toBeDefined();
    expect(screen.getByText(/Her resilience in facing challenges is remarkable/i)).toBeDefined();

    expect(screen.getByTestId('your-learning-section')).toBeDefined();
    expect(screen.getByTestId('learning-status-badge').textContent?.toLowerCase()).toContain('từ mới');
    expect(screen.getByTestId('new-word-learning-state')).toBeDefined();

    // Zero fake FSRS values
    expect(screen.queryByTestId('fsrs-retrievability')).toBeNull();
    expect(screen.queryByTestId('fsrs-difficulty')).toBeNull();

    // Button label is truthful and non-farmable
    const addButton = screen.getByTestId('add-to-srs-button');
    expect(addButton).toBeDefined();
    expect(addButton.textContent).toContain('+ Thêm Flashcard');
  });

  // 2. FSRS METRICS TRUTHFUL
  it('2. FSRS metrics truthful: renders verified FSRS retrievability, difficulty, and lapse count', async () => {
    const sampleWord = createTestWord({
      id: 'vocab_innovation',
      word: 'innovation',
      ipa: '/ˌɪnəˈveɪʃn/',
      meaning: 'Sự đổi mới, sáng tạo',
      example: 'Technological innovation drives economic growth.',
      tag: 'Academic',
      level: 'B2',
      srsLevel: 4,
      nextReviewDate: '2026-10-15T00:00:00.000Z',
      interval: 11,
      easeFactor: 2.2,
      fsrs: {
        state: 2,
        stability: 11.5,
        difficulty: 5.4,
        reps: 4,
        lapses: 1,
        lastReview: '2026-10-04T00:00:00.000Z',
      },
    });

    const srsProgress: SRSProgress = {
      srsLevel: 4,
      interval: 11,
      easeFactor: 2.2,
      nextReviewDate: '2026-10-15T00:00:00.000Z',
      lastReviewedDate: '2026-10-04T00:00:00.000Z',
      reviewCount: 4,
      againCount: 1,
      fsrs: {
        state: 2,
        stability: 11.5,
        difficulty: 5.4,
        reps: 4,
        lapses: 1,
        lastReview: '2026-10-04T00:00:00.000Z',
      },
    };

    useAppStore.setState({
      srsAlgorithm: 'fsrs',
      vocabularyList: [sampleWord],
      srsProgressMap: { vocab_innovation: srsProgress, innovation: srsProgress },
      mistakeBank: {},
      wordLearningStats: {
        innovation: { readingEncounters: 3, lastReadingSeenAt: '2026-10-04T10:00:00.000Z', writingUsages: 2, lastWritingUsedAt: '2026-10-04T11:00:00.000Z' },
      },
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'innovation' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'innovation' })).toBeDefined();
    });

    expect(screen.getByText('FSRS-4.5')).toBeDefined();
    const retrievabilityEl = screen.getByTestId('fsrs-retrievability');
    expect(retrievabilityEl).toBeDefined();
    expect(retrievabilityEl.textContent).toMatch(/%/);

    const difficultyEl = screen.getByTestId('fsrs-difficulty');
    expect(difficultyEl.textContent).toContain('5.4 / 10');

    const lapsesEl = screen.getByTestId('memory-lapses');
    expect(lapsesEl.textContent).toContain('1 lần');
    expect(lapsesEl.textContent).toContain('Lapses / Lần quên');

    expect(screen.getByTestId('reading-encounters-count').textContent).toContain('3 bài đọc');
    expect(screen.getByTestId('writing-usages-count').textContent).toContain('2 bài viết');
    expect(screen.getByTestId('in-srs-deck-indicator')).toBeDefined();
  });

  // 3. SM-2 HAS NO FAKE FSRS RETRIEVABILITY
  it('3. SM-2 has no fake FSRS retrievability: renders SM-2 repetitions and does NOT render FSRS metrics', async () => {
    const sampleWord = createTestWord({
      id: 'vocab_collaborate',
      word: 'collaborate',
      ipa: '/kəˈlæbəreɪt/',
      partOfSpeech: 'verb',
      meaning: 'Hợp tác, cộng tác',
      example: 'Teams collaborate effectively across borders.',
      tag: 'Academic',
      level: 'B2',
      srsLevel: 3,
      nextReviewDate: '2026-10-10T00:00:00.000Z',
      interval: 6,
      easeFactor: 2.5,
    });

    const srsProgress: SRSProgress = {
      srsLevel: 3,
      interval: 6,
      easeFactor: 2.5,
      nextReviewDate: '2026-10-10T00:00:00.000Z',
      lastReviewedDate: '2026-10-04T00:00:00.000Z',
      reviewCount: 3,
    };

    useAppStore.setState({
      srsAlgorithm: 'sm2',
      vocabularyList: [sampleWord],
      srsProgressMap: { vocab_collaborate: srsProgress, collaborate: srsProgress },
      mistakeBank: {},
      wordLearningStats: {},
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'collaborate' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'collaborate' })).toBeDefined();
    });

    expect(screen.getByText('SM-2')).toBeDefined();
    expect(screen.getByTestId('sm2-repetitions').textContent).toContain('3 lượt');
    expect(screen.queryByTestId('fsrs-retrievability')).toBeNull();
    expect(screen.queryByTestId('fsrs-difficulty')).toBeNull();
  });

  // 4. AGAIN VS LAPSE WORDING
  it('4. Again vs lapse wording: strictly distinguishes canonical lapses and actual Again rating count', async () => {
    const fsrsState: FSRSMemoryState = {
      state: 2,
      stability: 5.0,
      difficulty: 6.0,
      reps: 5,
      lapses: 1,
      lastReview: '2026-10-04T00:00:00.000Z',
    };

    const sampleWord = createTestWord({
      id: 'vocab_persistence',
      word: 'persistence',
      ipa: '/pərˈsɪstəns/',
      meaning: 'Sự kiên trì',
      srsLevel: 3,
      interval: 5,
      easeFactor: 2.1,
      againCount: 2,
      fsrs: fsrsState,
    });

    const srsProgress: SRSProgress = {
      srsLevel: 3,
      interval: 5,
      easeFactor: 2.1,
      nextReviewDate: '2026-10-10T00:00:00.000Z',
      againCount: 2,
      reviewCount: 5,
      fsrs: fsrsState,
    };

    useAppStore.setState({
      srsAlgorithm: 'fsrs',
      vocabularyList: [sampleWord],
      srsProgressMap: { vocab_persistence: srsProgress, persistence: srsProgress },
      mistakeBank: {},
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'persistence' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'persistence' })).toBeDefined();
    });

    const lapsesEl = screen.getByTestId('memory-lapses');
    expect(lapsesEl.textContent).toContain('Lapses / Lần quên:');
    expect(lapsesEl.textContent).toContain('1 lần');

    const againEl = screen.getByTestId('memory-again-count');
    expect(againEl.textContent).toContain('Đánh giá Again:');
    expect(againEl.textContent).toContain('2 lần');
  });

  // 5. CANONICAL SAVE FROM INFLECTED QUERY
  it('5. Canonical save from inflected query: saves canonical lemma when searching an inflected form', async () => {
    const canonicalWord = createTestWord({
      id: 'vocab_maintain',
      word: 'maintain',
      ipa: '/meɪnˈteɪn/',
      partOfSpeech: 'verb',
      meaning: 'Duy trì, giữ gìn',
      example: 'Maintain high standards.',
    });

    const saveToSRSSpy = vi.spyOn(useAppStore.getState(), 'saveToSRS');

    useAppStore.setState({
      vocabularyList: [canonicalWord],
      srsProgressMap: {},
      mistakeBank: {},
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'maintain' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'maintain' })).toBeDefined();
    });

    const addBtn = screen.getByTestId('add-to-srs-button');
    fireEvent.click(addBtn);

    expect(saveToSRSSpy).toHaveBeenCalledTimes(1);
    const savedArg = saveToSRSSpy.mock.calls[0][0];
    const savedWordName = typeof savedArg === 'string' ? savedArg : savedArg.word;
    expect(savedWordName.toLowerCase()).toBe('maintain');
  });

  // 6. DUPLICATE SAVE DOES NOT DUPLICATE CARD
  it('6. Duplicate save does not duplicate card: prevents duplicate save when word is already in deck', async () => {
    const sampleWord = createTestWord({
      id: 'vocab_adapt',
      word: 'adapt',
      ipa: '/əˈdæpt/',
      partOfSpeech: 'verb',
      meaning: 'Thích nghi',
      srsLevel: 1,
      nextReviewDate: '2026-10-10T00:00:00.000Z',
      interval: 1,
      easeFactor: 2.5,
    });

    const saveToSRSSpy = vi.spyOn(useAppStore.getState(), 'saveToSRS');

    useAppStore.setState({
      vocabularyList: [sampleWord],
      srsProgressMap: {
        vocab_adapt: { srsLevel: 1, interval: 1, easeFactor: 2.5, nextReviewDate: '2026-10-10T00:00:00.000Z' },
        adapt: { srsLevel: 1, interval: 1, easeFactor: 2.5, nextReviewDate: '2026-10-10T00:00:00.000Z' },
      },
      mistakeBank: {},
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'adapt' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'adapt' })).toBeDefined();
    });

    expect(screen.getByTestId('in-srs-deck-indicator')).toBeDefined();
    expect(screen.queryByTestId('add-to-srs-button')).toBeNull();
    expect(saveToSRSSpy).not.toHaveBeenCalled();
  });

  // 7. XP CANNOT DUPLICATE THROUGH SAME CANONICAL SAVE PATH
  it('7. XP cannot duplicate through same canonical save path: prevents farmable XP on duplicate save attempts', async () => {
    const sampleWord = createTestWord({
      id: 'vocab_resilience',
      word: 'resilience',
      ipa: '/rɪˈzɪliəns/',
      meaning: 'Kiên cường',
    });

    useAppStore.setState({
      vocabularyList: [sampleWord],
      srsProgressMap: {},
      mistakeBank: {},
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'resilience' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'resilience' })).toBeDefined();
    });

    const addBtn = screen.getByTestId('add-to-srs-button');
    expect(addBtn.textContent).toBe('+ Thêm Flashcard');
  });

  // 8. SAVE SUCCESS CONTROLS CONFETTI/REWARD
  it('8. Save success controls confetti/reward: triggers confetti only when save actually succeeds', async () => {
    const sampleWord = createTestWord({
      id: 'vocab_focus',
      word: 'focus',
      ipa: '/ˈfoʊkəs/',
      meaning: 'Sự tập trung',
    });

    useAppStore.setState({
      vocabularyList: [sampleWord],
      srsProgressMap: {},
      mistakeBank: {},
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'focus' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'focus' })).toBeDefined();
    });

    const addBtn = screen.getByTestId('add-to-srs-button');
    fireEvent.click(addBtn);

    expect(confetti).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Đã lưu "focus" vào Flashcard SRS!/i)).toBeDefined();
  });

  // 9. FUTURE REVIEW CARD DOES NOT SHOW REVIEW NOW
  it('9. Future Review card does not show Review Now: suppresses Review Now for cards due in the future', async () => {
    const sampleWord = createTestWord({
      id: 'vocab_future',
      word: 'future',
      ipa: '/ˈfjuːtʃər/',
      meaning: 'Tương lai',
      srsLevel: 3,
      nextReviewDate: new Date(Date.now() + 864000000).toISOString(),
      interval: 10,
      easeFactor: 2.5,
    });

    const srsProg: SRSProgress = {
      srsLevel: 3,
      interval: 10,
      easeFactor: 2.5,
      nextReviewDate: new Date(Date.now() + 864000000).toISOString(),
    };

    useAppStore.setState({
      vocabularyList: [sampleWord],
      srsProgressMap: { vocab_future: srsProg, future: srsProg },
      mistakeBank: {},
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'future' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'future' })).toBeDefined();
    });

    expect(screen.getByTestId('in-srs-deck-indicator')).toBeDefined();
    expect(screen.queryByTestId('review-now-button')).toBeNull();
  });

  // 10. DUE / RELEARNING SHOWS REVIEW ACTION
  it('10. Due / relearning shows Review action: renders Review Now when card is due or relearning', async () => {
    const onNavigateMock = vi.fn();
    const sampleWord = createTestWord({
      id: 'vocab_due',
      word: 'due',
      ipa: '/djuː/',
      partOfSpeech: 'adj',
      meaning: 'Đến hạn',
      srsLevel: 1,
      nextReviewDate: new Date(Date.now() - 3600000).toISOString(),
      interval: 1,
      easeFactor: 2.5,
    });

    const srsProg: SRSProgress = {
      srsLevel: 1,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: new Date(Date.now() - 3600000).toISOString(),
    };

    useAppStore.setState({
      vocabularyList: [sampleWord],
      srsProgressMap: { vocab_due: srsProg, due: srsProg },
      mistakeBank: {},
    });

    render(<DictionaryView onNavigate={onNavigateMock} />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'due' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'due' })).toBeDefined();
    });

    const reviewBtn = screen.getByTestId('review-now-button');
    expect(reviewBtn).toBeDefined();
    fireEvent.click(reviewBtn);
    expect(onNavigateMock).toHaveBeenCalledWith('flashcards');
  });

  // 11. PRACTICE MISTAKE TARGETS CURRENT WORD
  it('11. Practice Mistake targets current word: routes adaptive practice to the specific mistake item of current word', async () => {
    const onNavigateMock = vi.fn();
    const sampleWord = createTestWord({
      id: 'vocab_maintain',
      word: 'maintain',
      ipa: '/meɪnˈteɪn/',
      partOfSpeech: 'verb',
      meaning: 'Duy trì',
      srsLevel: 1,
      nextReviewDate: '',
      interval: 1,
      easeFactor: 2.5,
    });

    const mistakeRecord: MistakeRecord = {
      id: 'vocab_maintain',
      word: 'maintain',
      meaning: 'Duy trì',
      mistakeCount: 3,
      lastMistakeAt: new Date().toISOString(),
      consecutiveCorrect: 0,
      resolved: false,
    };

    const startAdaptivePracticeSpy = vi.spyOn(useAppStore.getState(), 'startAdaptivePractice');

    useAppStore.setState({
      vocabularyList: [sampleWord],
      srsProgressMap: { vocab_maintain: { srsLevel: 1, interval: 1, easeFactor: 2.5, nextReviewDate: '' } },
      mistakeBank: { vocab_maintain: mistakeRecord },
    });

    render(<DictionaryView onNavigate={onNavigateMock} />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'maintain' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'maintain' })).toBeDefined();
    });

    const practiceMistakeBtn = screen.getByTestId('practice-mistake-quick-button');
    fireEvent.click(practiceMistakeBtn);

    expect(startAdaptivePracticeSpy).toHaveBeenCalledWith({
      module: 'classic_quiz',
      itemIds: [expect.stringMatching(/v3k_1868|vocab_maintain/)],
    });
    expect(onNavigateMock).toHaveBeenCalledWith('quiz');
  });

  // 12. PRACTICE COLLOCATION TARGETS ACTUAL WEAK COLLOCATION
  it('12. Practice Collocation targets actual weak collocation: routes adaptive practice to the exact weak collocation phrase', async () => {
    const onNavigateMock = vi.fn();
    const sampleWord = createTestWord({
      id: 'vocab_maintain',
      word: 'maintain',
      ipa: '/meɪnˈteɪn/',
      partOfSpeech: 'verb',
      meaning: 'Duy trì',
      srsLevel: 1,
      nextReviewDate: '',
      interval: 1,
      easeFactor: 2.5,
    });

    const userColloc = createTestCollocation({
      id: 'colloc_maintain_standards',
      phrase: 'maintain standards',
      meaning: 'Duy trì tiêu chuẩn',
      exampleEn: 'Maintain standards.',
    });

    const collocMistake: MistakeRecord = {
      id: 'colloc_maintain_standards',
      word: 'maintain standards',
      meaning: 'Duy trì tiêu chuẩn',
      mistakeCount: 2,
      lastMistakeAt: '2026-10-04T10:00:00.000Z',
      consecutiveCorrect: 0,
      resolved: false,
      primaryType: 'collocation',
    };

    const startAdaptivePracticeSpy = vi.spyOn(useAppStore.getState(), 'startAdaptivePractice');

    useAppStore.setState({
      vocabularyList: [sampleWord],
      userCollocations: [userColloc],
      mistakeBank: { colloc_maintain_standards: collocMistake },
    });

    render(<DictionaryView onNavigate={onNavigateMock} />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'maintain' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'maintain' })).toBeDefined();
    });

    const practiceCollocBtn = screen.getByTestId('practice-collocation-quick-button');
    fireEvent.click(practiceCollocBtn);

    expect(startAdaptivePracticeSpy).toHaveBeenCalledWith({
      module: 'collocation',
      itemIds: ['maintain standards'],
    });
    expect(onNavigateMock).toHaveBeenCalledWith('quiz');
  });

  // 13. PAIR-SPECIFIC CONFUSION COUNT RENDERED EXACTLY
  it('13. Pair-specific confusion count rendered exactly: uses personalized confusion count instead of aggregate target mistakeCount', async () => {
    const sampleWord = createTestWord({
      id: 'vocab_maintain',
      word: 'maintain',
      ipa: '/meɪnˈteɪn/',
      partOfSpeech: 'verb',
      meaning: 'Duy trì',
      srsLevel: 0,
      nextReviewDate: '',
      interval: 1,
      easeFactor: 1.6,
    });

    // Aggregate mistakeCount = 5, but lastUserAnswer is sustain (pair count = 1)
    const mistakeRecord: MistakeRecord = {
      id: 'vocab_maintain',
      word: 'maintain',
      meaning: 'Duy trì',
      mistakeCount: 5,
      lastMistakeAt: '2026-10-04T12:00:00.000Z',
      consecutiveCorrect: 0,
      resolved: false,
      primaryType: 'meaning',
      source: 'classic_quiz',
      lastUserAnswer: 'sustain',
    };

    useAppStore.setState({
      vocabularyList: [sampleWord],
      mistakeBank: { vocab_maintain: mistakeRecord, maintain: mistakeRecord },
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'maintain' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'maintain' })).toBeDefined();
    });

    const confusionSec = screen.getByTestId('personalized-confused-words-section');
    expect(confusionSec.textContent).toContain('sustain');
    // Must render ×1 (pair-specific), NOT ×5 (target-level mistakeCount)
    expect(confusionSec.textContent).toContain('×1');
    expect(confusionSec.textContent).not.toContain('×5');
  });

  // 14. RELATED-WORD NAVIGATION UPDATES WHOLE PROFILE
  it('14. Related-word navigation updates whole profile: clicking related word navigates and updates all sections', async () => {
    const word1 = createTestWord({
      id: 'vocab_maintain',
      word: 'maintain',
      ipa: '/meɪnˈteɪn/',
      partOfSpeech: 'verb',
      meaning: 'Duy trì',
      synonyms: ['sustain'],
    });

    const word2 = createTestWord({
      id: 'vocab_sustain',
      word: 'sustain',
      ipa: '/səˈsteɪn/',
      partOfSpeech: 'verb',
      meaning: 'Chống đỡ, duy trì bền vững',
      synonyms: ['maintain'],
      srsLevel: 2,
      nextReviewDate: '2026-10-15T00:00:00.000Z',
      interval: 4,
      easeFactor: 2.5,
    });

    useAppStore.setState({
      vocabularyList: [word1, word2],
      srsProgressMap: {
        vocab_sustain: { srsLevel: 2, interval: 4, easeFactor: 2.5, nextReviewDate: '2026-10-15T00:00:00.000Z' },
        sustain: { srsLevel: 2, interval: 4, easeFactor: 2.5, nextReviewDate: '2026-10-15T00:00:00.000Z' },
      },
      mistakeBank: {},
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'maintain' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'maintain' })).toBeDefined();
    });

    // Click synonym "sustain"
    const synBtn = screen.getByRole('button', { name: 'sustain' });
    fireEvent.click(synBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'sustain' })).toBeDefined();
    });

    expect(screen.getByText('Chống đỡ, duy trì bền vững')).toBeDefined();
    expect(screen.getByTestId('in-srs-deck-indicator')).toBeDefined();
  });

  // 15. RAPID NAVIGATION HAS NO STALE DATA
  it('15. Rapid navigation has no stale data: rapidly selecting multiple words resolves to the last selection cleanly', async () => {
    const word1 = createTestWord({
      id: 'vocab_alpha',
      word: 'alpha',
      ipa: '/ˈælfə/',
      meaning: 'Ký tự alpha',
    });

    const word2 = createTestWord({
      id: 'vocab_beta',
      word: 'beta',
      ipa: '/ˈbeɪtə/',
      meaning: 'Ký tự beta',
      srsLevel: 1,
      nextReviewDate: '2026-10-20T00:00:00.000Z',
      interval: 1,
      easeFactor: 2.5,
    });

    useAppStore.setState({
      vocabularyList: [word1, word2],
      srsProgressMap: {},
      mistakeBank: {},
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);

    fireEvent.change(input, { target: { value: 'alpha' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'alpha' })).toBeDefined();
    });

    fireEvent.change(input, { target: { value: 'beta' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'beta' })).toBeDefined();
    });

    expect(screen.getByText('Ký tự beta')).toBeDefined();
    expect(screen.queryByText('Ký tự alpha')).toBeNull();
  });

  // 16. MISSING METADATA COPY CONTAINS NO UNDEFINED
  it('16. Missing metadata copy contains no undefined: copies text without undefined/null/NaN and omits missing example', async () => {
    const minimalWord = createTestWord({
      id: 'vocab_custombare',
      word: 'custombareword',
      ipa: '/kʌstəm/',
      partOfSpeech: 'adj',
      meaning: 'Từ vựng không có ví dụ',
      example: '',
    });

    useAppStore.setState({
      vocabularyList: [minimalWord],
      srsProgressMap: {},
      mistakeBank: {},
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'custombareword' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'custombareword' })).toBeDefined();
    });

    const copyBtn = screen.getByTestId('copy-dictionary-word-button');
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(mockClipboardWrite).toHaveBeenCalled();
    const copiedText = mockClipboardWrite.mock.calls[0][0];
    expect(copiedText).not.toContain('undefined');
    expect(copiedText).not.toContain('null');
    expect(copiedText).not.toContain('NaN');
    expect(copiedText).not.toContain('Ví dụ:');
  });

  // 17. UNAVAILABLE SPEECH APIS DEGRADE SAFELY
  it('17. Unavailable Speech APIs degrade safely: buttons are disabled gracefully when Speech APIs are absent', async () => {
    const sampleWord = createTestWord({
      id: 'vocab_silent',
      word: 'silent',
      ipa: '/ˈsaɪlənt/',
      partOfSpeech: 'adj',
      meaning: 'Im lặng',
    });

    useAppStore.setState({
      vocabularyList: [sampleWord],
      srsProgressMap: {},
      mistakeBank: {},
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'silent' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'silent' })).toBeDefined();
    });

    // In happy-dom, window.SpeechRecognition is absent
    const micBtn = screen.getByLabelText(/Chấm điểm phát âm qua Micro/i);
    expect(micBtn.getAttribute('aria-disabled')).toBe('true');
  });

  // 18. CEFR UNOBSERVED USER SHOWS "CHƯA ĐÁNH GIÁ"
  it('18. CEFR unobserved user shows "Chưa đánh giá": renders unobserved state when four skills scores are absent', async () => {
    const sampleWord = createTestWord({
      id: 'vocab_abstract',
      word: 'abstract',
      ipa: '/ˈæbstrækt/',
      partOfSpeech: 'adj',
      meaning: 'Trừu tượng',
      level: 'B2',
    });

    useAppStore.setState({
      vocabularyList: [sampleWord],
      srsProgressMap: {},
      mistakeBank: {},
      fourSkillsScores: {
        reading: [],
        listening: [],
        writing: [],
        speaking: [],
      },
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'abstract' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'abstract' })).toBeDefined();
    });

    const cefrBadge = screen.getByTestId('cefr-calibration-badge');
    expect(cefrBadge.textContent).toContain('Chưa đánh giá');
  });

  // 19. OFFLINE UNKNOWN WORD CLEARS STALE RESULT
  it('19. Offline unknown word clears stale result: clears previous entry when subsequent offline lookup fails', async () => {
    const sampleWord = createTestWord({
      id: 'vocab_offline_a',
      word: 'offlinealpha',
      ipa: '/ˈɒflaɪn/',
      meaning: 'Từ vựng có sẵn offline',
    });

    useAppStore.setState({
      vocabularyList: [sampleWord],
      srsProgressMap: {},
      mistakeBank: {},
    });

    render(<DictionaryView />);

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);

    // 1. Look up offline word A
    fireEvent.change(input, { target: { value: 'offlinealpha' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'offlinealpha' })).toBeDefined();
    });
    expect(screen.getByText('Từ vựng có sẵn offline')).toBeDefined();

    // 2. Search unknown word B while network is unavailable (fetch & translate fail)
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));
    vi.mocked(translateText).mockRejectedValueOnce(new Error('Translation offline'));

    fireEvent.change(input, { target: { value: 'unknownnonexistentword123' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByTestId('dictionary-not-found')).toBeDefined();
    });

    // Previous word A must be completely cleared
    expect(screen.queryByText('Từ vựng có sẵn offline')).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: 'offlinealpha' })).toBeNull();

    globalThis.fetch = originalFetch;
  });

  // 20. ALL DERIVED PROFILE INPUTS REMAIN MUTATION-FREE
  it('20. All derived profile inputs remain mutation-free: verifies profile arrays are never mutated in-place', async () => {
    const rawSynonyms = Object.freeze(['endure', 'persist', 'continue']);
    const rawAntonyms = Object.freeze(['quit', 'surrender']);
    const rawCollocs = Object.freeze(['maintain peace', 'maintain order']);

    const immutableWord = createTestWord({
      id: 'vocab_immutable',
      word: 'maintain',
      ipa: '/meɪnˈteɪn/',
      partOfSpeech: 'verb',
      meaning: 'Duy trì',
      synonyms: rawSynonyms as unknown as string[],
      antonyms: rawAntonyms as unknown as string[],
      collocations: rawCollocs as unknown as string[],
    });

    useAppStore.setState({
      vocabularyList: [immutableWord],
      srsProgressMap: {},
      mistakeBank: {},
    });

    // Rendering with frozen arrays will throw a TypeError if mutated in-place
    expect(() => {
      render(<DictionaryView />);
    }).not.toThrow();

    const input = screen.getByPlaceholderText(/Nhập từ tiếng Anh bất kỳ/i);
    fireEvent.change(input, { target: { value: 'maintain' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'maintain' })).toBeDefined();
    });

    expect(screen.getByTestId('word-network-section')).toBeDefined();
    expect(rawSynonyms.length).toBe(3);
    expect(rawAntonyms.length).toBe(2);
    expect(rawCollocs.length).toBe(2);
  });
});
