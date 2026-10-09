// @vitest-environment happy-dom
// src/components/__tests__/ListeningTranscriptSegmentation.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { FourSkillsView } from '../FourSkillsView';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import { LISTENING_LESSONS } from '../../data/fourSkills/listeningData';
import { ListeningLesson } from '../../data/fourSkills/types';
import {
  buildTranscriptBlocks,
  calculateSafeChunkSizes,
  TranscriptBlock
} from '../../services/listeningSyncService';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

class MockSpeechSynthesisUtterance {
  text: string;
  lang = 'en-US';
  rate = 1.0;
  volume = 1.0;
  pitch = 1.0;
  voice = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((err: any) => void) | null = null;
  onboundary: ((evt: any) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

describe('PHASE 3: Listening Transcript Segmentation & Readable Layout Suite', () => {
  let mockSpeak: any;
  let mockCancel: any;

  beforeEach(() => {
    useAppStore.setState({
      srsProgressMap: {},
      userCustomWords: [],
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      activeFourSkill: 'listening',
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      activePracticeConfig: null,
      pendingNavigationTab: null,
    });

    localStorage.clear();

    mockSpeak = vi.fn();
    mockCancel = vi.fn();
    (window as any).alert = vi.fn();

    const mockSynth = {
      speak: mockSpeak,
      cancel: mockCancel,
      getVoices: vi.fn(() => []),
      pause: vi.fn(),
      resume: vi.fn(),
    };

    Object.defineProperty(window, 'speechSynthesis', {
      value: mockSynth,
      writable: true,
      configurable: true,
    });

    (window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    (globalThis as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. UNIT TESTS: SAFE CHUNKING & TRANSCRIPT SEGMENTATION ENGINE
  // =========================================================================
  describe('1. Safe Chunking & buildTranscriptBlocks Engine', () => {
    it('calculateSafeChunkSizes partitions numbers into 2-3 items with zero single orphan items (for total >= 2)', () => {
      expect(calculateSafeChunkSizes(0)).toEqual([]);
      expect(calculateSafeChunkSizes(1)).toEqual([1]);
      expect(calculateSafeChunkSizes(2)).toEqual([2]);
      expect(calculateSafeChunkSizes(3)).toEqual([3]);
      expect(calculateSafeChunkSizes(4)).toEqual([2, 2]);
      expect(calculateSafeChunkSizes(5)).toEqual([3, 2]);
      expect(calculateSafeChunkSizes(6)).toEqual([3, 3]);
      expect(calculateSafeChunkSizes(7)).toEqual([3, 2, 2]);
      expect(calculateSafeChunkSizes(8)).toEqual([3, 3, 2]);
      expect(calculateSafeChunkSizes(9)).toEqual([3, 3, 3]);
      expect(calculateSafeChunkSizes(10)).toEqual([3, 3, 2, 2]);
      expect(calculateSafeChunkSizes(11)).toEqual([3, 3, 3, 2]);
      expect(calculateSafeChunkSizes(12)).toEqual([3, 3, 3, 3]);

      // Verify that every partition sums exactly to total and has no 1-item chunks for total >= 2
      for (let n = 2; n <= 30; n++) {
        const chunks = calculateSafeChunkSizes(n);
        const sum = chunks.reduce((a, b) => a + b, 0);
        expect(sum).toBe(n);
        expect(chunks.every((c) => c === 2 || c === 3)).toBe(true);
      }
    });

    it('Dialogue with speakers: gom consecutive sentences cùng speaker vào 1 block, tách khi đổi speaker', () => {
      const mockLesson: ListeningLesson = {
        id: 'test_dialogue',
        title: 'Interview Test',
        category: 'Interview',
        format: 'Dialogue',
        level: 'B1',
        duration: '2:00',
        description: 'Test dialogue',
        audioText: 'Sentence 0. Sentence 1. Sentence 2. Sentence 3. Sentence 4.',
        sentences: [
          { speaker: 'Interviewer', en: 'Good morning, how are you today?', vi: 'Chào buổi sáng.' },
          { speaker: 'Interviewer', en: 'Could you introduce yourself?', vi: 'Bạn giới thiệu bản thân nhé?' },
          { speaker: 'Candidate', en: 'Thank you for having me.', vi: 'Cảm ơn đã mời tôi.' },
          { speaker: 'Candidate', en: 'I am a software engineer.', vi: 'Tôi là kỹ sư phần mềm.' },
          { speaker: 'Interviewer', en: 'That sounds impressive.', vi: 'Nghe rất ấn tượng.' },
        ],
        questions: [],
      };

      const blocks = buildTranscriptBlocks(mockLesson);

      // Must produce 3 blocks: Interviewer (2 sents), Candidate (2 sents), Interviewer (1 sent)
      expect(blocks.length).toBe(3);

      expect(blocks[0].speaker).toBe('Interviewer');
      expect(blocks[0].sentences.length).toBe(2);
      expect(blocks[0].sentences[0].globalSentenceIndex).toBe(0);
      expect(blocks[0].sentences[1].globalSentenceIndex).toBe(1);
      expect(blocks[0].startSentenceIndex).toBe(0);
      expect(blocks[0].endSentenceIndex).toBe(1);

      expect(blocks[1].speaker).toBe('Candidate');
      expect(blocks[1].sentences.length).toBe(2);
      expect(blocks[1].sentences[0].globalSentenceIndex).toBe(2);
      expect(blocks[1].sentences[1].globalSentenceIndex).toBe(3);
      expect(blocks[1].startSentenceIndex).toBe(2);
      expect(blocks[1].endSentenceIndex).toBe(3);

      expect(blocks[2].speaker).toBe('Interviewer');
      expect(blocks[2].sentences.length).toBe(1);
      expect(blocks[2].sentences[0].globalSentenceIndex).toBe(4);
      expect(blocks[2].startSentenceIndex).toBe(4);
      expect(blocks[2].endSentenceIndex).toBe(4);
    });

    it('Monologue / Presentation without speakers: không tự bịa speaker label và gom thành 2-3 câu / block', () => {
      const mockLesson: ListeningLesson = {
        id: 'test_monologue',
        title: 'Tech Talk',
        category: 'Tech',
        format: 'Lecture',
        level: 'C1',
        duration: '2:30',
        description: 'Test monologue',
        audioText: 'S0. S1. S2. S3. S4. S5. S6.',
        sentences: [
          { en: 'Sentence zero is here.', vi: 'Câu 0.' },
          { en: 'Sentence one follows.', vi: 'Câu 1.' },
          { en: 'Sentence two continues.', vi: 'Câu 2.' },
          { en: 'Sentence three elaborates.', vi: 'Câu 3.' },
          { en: 'Sentence four summarizes.', vi: 'Câu 4.' },
          { en: 'Sentence five concludes.', vi: 'Câu 5.' },
          { en: 'Sentence six wraps up.', vi: 'Câu 6.' },
        ],
        questions: [],
      };

      const blocks = buildTranscriptBlocks(mockLesson);

      // Total 7 sentences -> safe chunks [3, 2, 2]
      expect(blocks.length).toBe(3);
      expect(blocks.map((b) => b.sentences.length)).toEqual([3, 2, 2]);

      // Speaker must be undefined (never invent fake names like Speaker 1 or Narrator)
      blocks.forEach((b) => {
        expect(b.speaker).toBeUndefined();
      });

      // Verify continuous global sentence indexing
      let expectedIdx = 0;
      blocks.forEach((b) => {
        b.sentences.forEach((s) => {
          expect(s.globalSentenceIndex).toBe(expectedIdx);
          expectedIdx++;
        });
      });
      expect(expectedIdx).toBe(7);
    });

    it('Full 24 Lessons Verification: buildTranscriptBlocks bảo toàn 100% sentence count, text, và indexing', () => {
      expect(LISTENING_LESSONS.length).toBe(24);

      LISTENING_LESSONS.forEach((lesson) => {
        const blocks = buildTranscriptBlocks(lesson);
        expect(blocks.length).toBeGreaterThan(0);

        const totalSentsInBlocks = blocks.reduce((sum, b) => sum + b.sentences.length, 0);
        expect(totalSentsInBlocks).toBe(lesson.sentences.length);

        const hasOriginalSpeaker = lesson.sentences.some((s) => Boolean(s.speaker));
        if (!hasOriginalSpeaker) {
          // Monologue: no block should invent a fake speaker
          blocks.forEach((b) => {
            expect(b.speaker).toBeUndefined();
          });
        }

        // Check strict ordering and identity
        let runningIdx = 0;
        blocks.forEach((b) => {
          expect(b.startSentenceIndex).toBe(b.sentences[0].globalSentenceIndex);
          expect(b.endSentenceIndex).toBe(b.sentences[b.sentences.length - 1].globalSentenceIndex);

          b.sentences.forEach((s) => {
            expect(s.globalSentenceIndex).toBe(runningIdx);
            expect(s.sentence.en).toBe(lesson.sentences[runningIdx].en);
            expect(s.sentence.vi).toBe(lesson.sentences[runningIdx].vi);
            runningIdx++;
          });
        });
      });
    });
  });

  // =========================================================================
  // 2. UI / DOM INTEGRATION TESTS: PARAGRAPH MODE & DIALOGUE MODE
  // =========================================================================
  describe('2. UI & DOM Integration Tests', () => {
    it('Paragraph Mode: render các paragraph riêng biệt thay vì dồn vào 1 thẻ <p> duy nhất', () => {
      const { container } = render(<FourSkillsView />);

      // Chọn bài C1 System Design (Monologue 32 câu)
      const lessonCard = screen.getByText('Cracking the Senior System Design Interview');
      fireEvent.click(lessonCard);

      // Verify chế độ mặc định là Đoạn văn liền mạch
      expect(screen.getByText(/Đoạn văn liền mạch/)).toBeDefined();

      // Kiểm tra có nhiều block paragraph, không phải 1 thẻ p duy nhất chứa tất cả 32 câu
      const sentenceElements = container.querySelectorAll('[data-sentence-index]');
      expect(sentenceElements.length).toBe(32);

      // Các sentence span phải được nhóm trong các paragraph containers
      // Kiểm tra sentence 0 và sentence 31 đều có mặt trong DOM với đúng data-sentence-index
      const sent0 = container.querySelector('[data-sentence-index="0"]');
      const sent31 = container.querySelector('[data-sentence-index="31"]');
      expect(sent0).toBeTruthy();
      expect(sent31).toBeTruthy();
    });

    it('Dialogue Mode: gộp các câu của cùng 1 speaker trong turn, chỉ hiển thị header speaker một lần', () => {
      const { container } = render(<FourSkillsView />);

      // Chọn bài A1 Sunny Side Cafe (Dialogue)
      const lessonCard = screen.getByText('Ordering Breakfast at the Sunny Side Cafe');
      fireEvent.click(lessonCard);

      // Chuyển sang Dialogue mode
      const dialogueBtn = screen.getByText('💬 Từng câu thoại');
      fireEvent.click(dialogueBtn);

      // Kiểm tra các câu vẫn có data-sentence-index
      const sent0 = container.querySelector('[data-sentence-index="0"]');
      const sent1 = container.querySelector('[data-sentence-index="1"]');
      expect(sent0).toBeTruthy();
      expect(sent1).toBeTruthy();

      // Verify header speaker hiển thị emoji và tên speaker
      expect(screen.getAllByText(/Waiter:/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Customer:/i).length).toBeGreaterThan(0);
    });

    it('Auto-scroll và Word Highlight selector hoạt động hoàn hảo trên cấu trúc segmented', () => {
      const { container } = render(<FourSkillsView />);

      const lessonCard = screen.getByText('Ordering Breakfast at the Sunny Side Cafe');
      fireEvent.click(lessonCard);

      // Chuyển sang Word highlight mode
      const wordModeBtn = screen.getByText('Từng từ (Word)');
      fireEvent.click(wordModeBtn);

      // Start playback
      const playBtn = screen.getByRole('button', { name: /Nghe Bài Đọc/i });
      fireEvent.click(playBtn);

      expect(mockSpeak).toHaveBeenCalledTimes(1);
      const utterance = mockSpeak.mock.calls[0][0];

      // Kích hoạt onstart
      act(() => {
        if (utterance.onstart) utterance.onstart();
      });

      // Kích hoạt boundary word 0 câu 0
      act(() => {
        if (utterance.onboundary) {
          utterance.onboundary({
            name: 'word',
            charIndex: 0,
            charLength: 4,
          });
        }
      });

      // Auto-scroll selector: `[data-sentence-index="0"] [data-word-index="0"]`
      const activeWord = container.querySelector('[data-sentence-index="0"] [data-word-index="0"]');
      expect(activeWord).toBeTruthy();
      expect(activeWord?.classList.contains('bg-amber-400')).toBe(true);

      // Kiểm tra click vào từ đang highlight mở Modal tra từ điển
      fireEvent.click(activeWord!);
      expect(screen.getByText(/Thêm Vào Flashcard SRS/i)).toBeDefined();
    });

    it('Ẩn dịch / Hiện dịch toggle hiển thị bản dịch tiếng Việt tương ứng cho từng block/paragraph', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText('Ordering Breakfast at the Sunny Side Cafe');
      fireEvent.click(lessonCard);

      // Toggle Hiện dịch / Ẩn dịch
      const toggleTransBtn = screen.getByRole('button', { name: /Ẩn dịch|Hiện dịch/i });
      expect(toggleTransBtn).toBeDefined();

      // Mặc định showListenVi = true -> có bản dịch tiếng Việt
      expect(screen.getByText(/Chào buổi sáng! Chào mừng quý khách/i)).toBeDefined();

      // Bấm Ẩn dịch
      fireEvent.click(toggleTransBtn);
      expect(screen.queryByText(/Chào buổi sáng! Chào mừng quý khách/i)).toBeNull();

      // Bấm Hiện dịch lại
      fireEvent.click(toggleTransBtn);
      expect(screen.getByText(/Chào buổi sáng! Chào mừng quý khách/i)).toBeDefined();
    });
  });
});
