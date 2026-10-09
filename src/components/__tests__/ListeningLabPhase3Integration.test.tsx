// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import { FourSkillsView } from '../FourSkillsView';
import { MistakeBankView } from '../MistakeBankView';
import { LISTENING_LESSONS } from '../../data/fourSkills/listeningData';
import { resolveListeningQuestionTarget } from '../../services/adaptiveMistakeService';
import { captureListeningMistake } from '../../services/fourSkillsLearningBridge';
import { deriveTutorLearningContext, serializeTutorContextForPrompt } from '../../services/tutorLearningContext';
import type { MistakeRecord } from '../../types';

// Mock canvas-confetti for happy-dom environment
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('PHASE 3: Listening Learning-System Integration Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Reset store state cleanly
    useAppStore.setState({
      srsProgressMap: {},
      userCustomWords: [],
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      activePracticeConfig: null,
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      activeFourSkill: 'listening',
      userCollocations: [],
    });
  });

  // =========================================================================
  // 1. MISTAKE INTEGRATION (VOCAB VS GENERAL COMPREHENSION)
  // =========================================================================
  describe('1. Mistake Integration: Vocab vs General Comprehension', () => {
    it('vocab_context sai -> tạo vocabulary mistake hợp lệ trong Mistake Bank', () => {
      const store = useAppStore.getState();
      const vocabQuestion = {
        id: 'lq_vocab_test',
        type: 'vocab_context',
        question: 'What is the meaning of "resilience" in the audio?',
        options: ['Vulnerability', 'Ability to recover', 'Latency', 'Failure'],
        correctIndex: 1,
        explanation: 'Resilience means ability to recover.',
      };

      const res = captureListeningMistake({
        question: vocabQuestion,
        lessonTitle: 'Microservices Architecture',
        selectedOptIdx: 0, // Wrong answer
        vocabularyList: store.vocabularyList,
        recordMistake: store.recordMistake,
      });

      expect(res.recorded).toBe(true);
      expect(res.isVocabTarget).toBe(true);
      expect(res.targetWord.toLowerCase()).toBe('resilience');

      const state = useAppStore.getState();
      const mistakes = Object.values(state.mistakeBank);
      expect(mistakes.length).toBe(1);
      expect(mistakes[0].word.toLowerCase()).toBe('resilience');
      expect(mistakes[0].source).toBe('listening');
      expect(mistakes[0].primaryType).toBe('listening');
      expect(mistakes[0].resolved).toBe(false);
    });

    it('general comprehension sai -> KHÔNG tạo fake vocabulary word trong Mistake Bank', () => {
      const store = useAppStore.getState();
      const generalQuestion = {
        id: 'lq_general_test',
        type: 'main_idea',
        question: 'What is the primary architectural tradeoff discussed in the lecture?',
        options: ['Monolith vs microservices', 'SQL vs NoSQL', 'Frontend vs Backend', 'Cloud vs On-premise'],
        correctIndex: 0,
        explanation: 'Tradeoffs between monolith and distributed systems.',
      };

      const resolution = resolveListeningQuestionTarget(
        generalQuestion,
        'Architecture Lecture',
        store.vocabularyList
      );
      expect(resolution.isVocabTarget).toBe(false);
      expect(resolution.targetWord).toBe(''); // Never set full question string as targetWord

      const res = captureListeningMistake({
        question: generalQuestion,
        lessonTitle: 'Architecture Lecture',
        selectedOptIdx: 1, // Wrong answer
        vocabularyList: store.vocabularyList,
        recordMistake: store.recordMistake,
      });

      expect(res.recorded).toBe(false);
      expect(res.isVocabTarget).toBe(false);

      const state = useAppStore.getState();
      expect(Object.keys(state.mistakeBank).length).toBe(0);
      expect(state.mistakeBank['lq_general_test']).toBeUndefined();
    });

    it('làm đúng lại vocab target vẫn resolve theo consecutiveCorrect >= 2 như cũ', () => {
      const store = useAppStore.getState();
      const vocabQuestion = {
        id: 'lq_resolve_test',
        type: 'vocab_context',
        question: 'Select the definition of "scalability":',
        options: ['Shrinking', 'Ability to scale', 'Database lock', 'Network drop'],
        correctIndex: 1,
        explanation: 'Scalability is the ability to handle growth.',
      };

      // 1. Làm sai lần 1 -> tạo mistake
      captureListeningMistake({
        question: vocabQuestion,
        lessonTitle: 'Architecture Lecture',
        selectedOptIdx: 0,
        vocabularyList: store.vocabularyList,
        recordMistake: store.recordMistake,
      });

      let state = useAppStore.getState();
      const mistakeItem = Object.values(state.mistakeBank).find(
        (m) => m.word.toLowerCase() === 'scalability'
      )!;
      expect(mistakeItem).toBeDefined();
      expect(mistakeItem.resolved).toBe(false);
      expect(mistakeItem.consecutiveCorrect).toBe(0);

      // 2. Làm đúng lần 1 -> consecutiveCorrect = 1, resolved vẫn false
      useAppStore.getState().recordMistakeCorrect(mistakeItem.id, { type: 'listening' });
      state = useAppStore.getState();
      let updated = state.mistakeBank[mistakeItem.id.toLowerCase()];
      expect(updated.consecutiveCorrect).toBe(1);
      expect(updated.resolved).toBe(false);

      // 3. Làm đúng lần 2 -> consecutiveCorrect = 2 -> resolved = true
      useAppStore.getState().recordMistakeCorrect(mistakeItem.id, { type: 'listening' });
      state = useAppStore.getState();
      updated = state.mistakeBank[mistakeItem.id.toLowerCase()];
      expect(updated.consecutiveCorrect).toBe(2);
      expect(updated.resolved).toBe(true);
    });
  });

  // =========================================================================
  // 2. AI TUTOR CONTEXT: ZERO SYNTHETIC TARGETS & SKILL-LEVEL PRIORITY
  // =========================================================================
  describe('2. AI Tutor Context & Zero Synthetic Targets', () => {
    it('general comprehension question không xuất hiện thành lexical Focus Item trong AI Tutor prompt', () => {
      // Giả lập mistakeBank có 1 record comprehension cũ (hoặc id bắt đầu bằng lq_)
      const mockMistakes: Record<string, MistakeRecord> = {
        legacy_q: {
          id: 'lq_legacy_comp',
          word: 'What is the primary benefit of microservices mentioned in the audio?',
          meaning: 'Câu hỏi đọc hiểu',
          mistakeCount: 2,
          lastMistakeAt: new Date().toISOString(),
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'listening',
          source: 'listening',
        },
      };

      const context = deriveTutorLearningContext({
        mistakeBank: mockMistakes,
        fourSkillsScores: {
          listening: [40], // Kỹ năng nghe yếu < 60%
          reading: [],
          speaking: [],
          writing: [],
        },
      });

      const serialized = serializeTutorContextForPrompt(context);

      // Verify: câu hỏi dài KHÔNG ĐƯỢC xuất hiện trong [Focus: ...] của prompt
      expect(serialized).not.toContain('Focus: What is the primary benefit');

      // Verify: Nếu có priority cho listening, nó là skill-level priority với targetItems rỗng
      const listenPriority = context.learningPriorities.find((p) => p.domain === 'listening');
      if (listenPriority) {
        expect(listenPriority.targetItems).toEqual([]); // Zero synthetic targets!
      }
    });

    it('Listening skill weakness khi điểm < 60% nhưng không có lexical target tạo skill priority an toàn', () => {
      const context = deriveTutorLearningContext({
        mistakeBank: {}, // Không có từ vựng lỗi nào
        fourSkillsScores: {
          listening: [35], // Học viên đã làm bài và đạt 35%
          reading: [],
          speaking: [],
          writing: [],
        },
      });

      expect(context.competency.listening.totalAttempts).toBe(1);
      expect(context.competency.listening.score).toBe(35);

      const listenPriority = context.learningPriorities.find((p) => p.domain === 'listening');
      expect(listenPriority).toBeDefined();
      expect(listenPriority?.title).toBe('Củng cố phản xạ nghe hiểu tổng quát');
      expect(listenPriority?.targetItems).toEqual([]); // Zero synthetic targets!

      const serialized = serializeTutorContextForPrompt(context);
      expect(serialized).toContain('Củng cố phản xạ nghe hiểu tổng quát');
      expect(serialized).not.toContain('[Focus:'); // Không có thẻ Focus rác
    });
  });

  // =========================================================================
  // 3. ADAPTIVE NAVIGATION (CLOSED LOOP)
  // =========================================================================
  describe('3. Adaptive Navigation: Closed Loop & Fallback', () => {
    it('activePracticeConfig module=listening mở đúng bài nghe và clear config ngay lập tức', () => {
      // Đặt activePracticeConfig nhắm vào bài 2 bằng lesson id
      useAppStore.setState({
        activePracticeConfig: {
          module: 'listening',
          itemIds: ['listen_2'],
          startedAt: Date.now(),
        },
      });

      render(<FourSkillsView />);

      // Verify: FourSkillsView tự động mở bài 2
      expect(screen.getByText('Sprint Planning & Scope Negotiation in Agile Teams')).toBeTruthy();

      // Verify: config đã được clear ngay sau khi consume
      expect(useAppStore.getState().activePracticeConfig).toBeNull();
    });

    it('activePracticeConfig nhắm vào vocab target mở đúng bài học chứa từ vựng đó', () => {
      // 'scoping down' thuộc bài listen_2
      useAppStore.setState({
        activePracticeConfig: {
          module: 'listening',
          itemIds: ['scoping down'],
          startedAt: Date.now(),
        },
      });

      render(<FourSkillsView />);

      // Verify: Mở đúng bài 2
      expect(screen.getByText('Sprint Planning & Scope Negotiation in Agile Teams')).toBeTruthy();
      expect(useAppStore.getState().activePracticeConfig).toBeNull();
    });

    it('stale hoặc invalid itemIds fallback an toàn về danh sách bài nghe (catalog view)', () => {
      useAppStore.setState({
        activePracticeConfig: {
          module: 'listening',
          itemIds: ['non_existent_listening_item_xyz'],
          startedAt: Date.now(),
        },
      });

      render(<FourSkillsView />);

      // Verify: Rơi về danh sách bài nghe chung (hiển thị tiêu đề kho bài nghe)
      expect(screen.getByText(/Kho Bài Nghe Thực Tế/i)).toBeTruthy();

      // Verify: config được clear sạch
      expect(useAppStore.getState().activePracticeConfig).toBeNull();
    });

    it('normal navigation vào Four Skills không bị ảnh hưởng khi activePracticeConfig=null', () => {
      useAppStore.setState({
        activePracticeConfig: null,
      });

      render(<FourSkillsView />);

      // Verify: Catalog view bình thường
      expect(screen.getByText(/Kho Bài Nghe Thực Tế/i)).toBeTruthy();
      expect(useAppStore.getState().activePracticeConfig).toBeNull();
    });
  });

  // =========================================================================
  // 4. SOURCE LABEL FOR LISTENING
  // =========================================================================
  describe('4. Source Label for Listening', () => {
    it('render đúng nhãn "Listening Lab" cho source: listening trong MistakeBankView', () => {
      useAppStore.setState({
        mistakeBank: {
          listen_vocab_1: {
            id: 'listen_vocab_1',
            word: 'latency',
            meaning: 'Độ trễ mạng',
            mistakeCount: 2,
            lastMistakeAt: new Date().toISOString(),
            consecutiveCorrect: 0,
            resolved: false,
            primaryType: 'listening',
            source: 'listening',
          },
        },
      });

      render(<MistakeBankView />);

      // Verify: Hiển thị nhãn 'Listening Lab'
      expect(screen.getByText('Listening Lab')).toBeTruthy();

      // Verify: KHÔNG hiển thị nhãn fallback 'Tự ghi nhận'
      expect(screen.queryByText('Tự ghi nhận')).toBeNull();
    });
  });
});
