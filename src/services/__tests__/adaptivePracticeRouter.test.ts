// src/services/__tests__/adaptivePracticeRouter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  routeMistakeToModule,
  getAdaptivePracticeRecommendations,
  getModuleNavigationTarget,
  isValidPracticeModule,
  VALID_PRACTICE_MODULES,
} from '../adaptivePracticeRouter';
import { MistakeRecord, AdaptiveMistakeProfile, PracticeModuleId } from '../../types';
import { useAppStore } from '../../store/useAppStore';

describe('Phase 4: Adaptive Practice Router & Targeted Practice', () => {
  beforeEach(() => {
    useAppStore.setState({
      activePracticeConfig: null,
      pendingNavigationTab: null,
      mistakeBank: {},
    });
  });

  describe('1. Valid Real Practice Modules Contract', () => {
    it('only contains real codebase modules and rejects nonexistent modules', () => {
      // Danh sách các module thực sự
      expect(VALID_PRACTICE_MODULES).toContain('flashcard');
      expect(VALID_PRACTICE_MODULES).toContain('classic_quiz');
      expect(VALID_PRACTICE_MODULES).toContain('word_scramble');
      expect(VALID_PRACTICE_MODULES).toContain('dictation');
      expect(VALID_PRACTICE_MODULES).toContain('listening');
      expect(VALID_PRACTICE_MODULES).toContain('pronunciation');
      expect(VALID_PRACTICE_MODULES).toContain('shadowing');
      expect(VALID_PRACTICE_MODULES).toContain('collocation');
      expect(VALID_PRACTICE_MODULES).toContain('cloze');
      expect(VALID_PRACTICE_MODULES).toContain('reading');
      expect(VALID_PRACTICE_MODULES).toContain('writing');

      // Không chứa module ảo/bịa đặt
      expect(isValidPracticeModule('fake_module')).toBe(false);
      expect(isValidPracticeModule('vr_game')).toBe(false);
      expect(isValidPracticeModule('chat_bot')).toBe(false);
      expect(isValidPracticeModule(undefined)).toBe(false);
      expect(isValidPracticeModule('')).toBe(false);

      expect(isValidPracticeModule('word_scramble')).toBe(true);
      expect(isValidPracticeModule('dictation')).toBe(true);
      expect(isValidPracticeModule('pronunciation')).toBe(true);
    });

    it('maps every valid module to a real ActiveTab in navigation target', () => {
      for (const mod of VALID_PRACTICE_MODULES) {
        const target = getModuleNavigationTarget(mod);
        expect(target).toBeDefined();
        expect(target.tab).toBeDefined();
        expect(typeof target.description).toBe('string');
        expect(target.description.length).toBeGreaterThan(5);
      }
    });
  });

  describe('2. Core Routing Rules by Mistake Type', () => {
    it('routes spelling mistakes to word_scramble or dictation', () => {
      const spellingRecord: MistakeRecord = {
        id: 'w_spelling_1',
        word: 'accommodate',
        meaning: 'chứa chấp',
        mistakeCount: 3,
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'spelling',
        source: 'word_scramble',
        lastMistakeAt: new Date().toISOString(),
      };

      const rec = routeMistakeToModule(spellingRecord);
      expect(['word_scramble', 'dictation']).toContain(rec.recommendedModule);
      expect(rec.mistakeType).toBe('spelling');
      expect(rec.targetId).toBe('w_spelling_1');
    });

    it('routes listening mistakes to listening or dictation', () => {
      const listeningRecord: MistakeRecord = {
        id: 'w_listening_1',
        word: 'phenomenon',
        meaning: 'hiện tượng',
        mistakeCount: 2,
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'listening',
        source: 'listening',
        lastMistakeAt: new Date().toISOString(),
      };

      const rec = routeMistakeToModule(listeningRecord);
      expect(['listening', 'dictation']).toContain(rec.recommendedModule);
      expect(rec.mistakeType).toBe('listening');
    });

    it('routes pronunciation mistakes to pronunciation or shadowing', () => {
      const pronRecord: MistakeRecord = {
        id: 'w_pron_1',
        word: 'comfortable',
        meaning: 'thoải mái',
        mistakeCount: 4,
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'pronunciation',
        source: 'pronunciation',
        lastMistakeAt: new Date().toISOString(),
      };

      const rec = routeMistakeToModule(pronRecord);
      expect(['pronunciation', 'shadowing']).toContain(rec.recommendedModule);
      expect(rec.mistakeType).toBe('pronunciation');
    });

    it('routes meaning mistakes to flashcard or classic_quiz', () => {
      const meaningRecord: MistakeRecord = {
        id: 'w_meaning_1',
        word: 'ubiquitous',
        meaning: 'có mặt ở khắp nơi',
        mistakeCount: 3,
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'meaning',
        source: 'flashcard',
        lastMistakeAt: new Date().toISOString(),
      };

      const rec = routeMistakeToModule(meaningRecord);
      expect(['flashcard', 'classic_quiz']).toContain(rec.recommendedModule);
      expect(rec.mistakeType).toBe('meaning');
    });

    it('routes collocation mistakes to collocation or cloze', () => {
      const collocRecord: MistakeRecord = {
        id: 'w_colloc_1',
        word: 'make a decision',
        meaning: 'đưa ra quyết định',
        mistakeCount: 2,
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'collocation',
        source: 'collocation',
        lastMistakeAt: new Date().toISOString(),
      };

      const rec = routeMistakeToModule(collocRecord);
      expect(['collocation', 'cloze']).toContain(rec.recommendedModule);
      expect(rec.mistakeType).toBe('collocation');
    });

    it('routes reading mistakes to reading', () => {
      const readingRecord: MistakeRecord = {
        id: 'w_reading_1',
        word: 'hypothesis',
        meaning: 'giả thuyết',
        mistakeCount: 2,
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'reading',
        source: 'reading',
        lastMistakeAt: new Date().toISOString(),
      };

      const rec = routeMistakeToModule(readingRecord);
      expect(rec.recommendedModule).toBe('reading');
    });

    it('routes writing and grammar mistakes to writing', () => {
      const writingRecord: MistakeRecord = {
        id: 'w_grammar_1',
        word: 'nevertheless',
        meaning: 'tuy nhiên',
        mistakeCount: 2,
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'grammar',
        source: 'writing',
        lastMistakeAt: new Date().toISOString(),
      };

      const rec = routeMistakeToModule(writingRecord);
      expect(rec.recommendedModule).toBe('writing');
    });
  });

  describe('3. Context-Sensitive & Explainable Routing', () => {
    it('prioritizes dictation over word_scramble when spelling mistake originated from dictation', () => {
      const dictationMistake: MistakeRecord = {
        id: 'w_dict_spelling',
        word: 'silhouette',
        meaning: 'hình bóng',
        mistakeCount: 3,
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'spelling',
        source: 'dictation',
        lastMistakeAt: new Date().toISOString(),
      };

      const rec = routeMistakeToModule(dictationMistake);
      expect(rec.recommendedModule).toBe('dictation');
      expect(rec.secondaryModule).toBe('word_scramble');
      expect(rec.reason).toContain('Dictation');
    });

    it('prioritizes word_scramble over dictation when spelling mistake originated from scramble', () => {
      const scrambleMistake: MistakeRecord = {
        id: 'w_scramble_spelling',
        word: 'necessary',
        meaning: 'cần thiết',
        mistakeCount: 3,
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'spelling',
        source: 'word_scramble',
        lastMistakeAt: new Date().toISOString(),
      };

      const rec = routeMistakeToModule(scrambleMistake);
      expect(rec.recommendedModule).toBe('word_scramble');
      expect(rec.secondaryModule).toBe('dictation');
      expect(rec.reason).toContain('Word Scramble');
    });

    it('prioritizes classic_quiz when meaning mistake came from classic_quiz (distractor confusion)', () => {
      const quizMeaningMistake: MistakeRecord = {
        id: 'w_quiz_meaning',
        word: 'reluctant',
        meaning: 'miễn cưỡng',
        mistakeCount: 2,
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'meaning',
        source: 'classic_quiz',
        lastMistakeAt: new Date().toISOString(),
      };

      const rec = routeMistakeToModule(quizMeaningMistake);
      expect(rec.recommendedModule).toBe('classic_quiz');
      expect(rec.secondaryModule).toBe('flashcard');
      expect(rec.reason).toContain('Classic Quiz');
    });

    it('prioritizes flashcard when meaning mistake came from srs_again', () => {
      const flashcardMistake: MistakeRecord = {
        id: 'w_srs_meaning',
        word: 'meticulous',
        meaning: 'tỉ mỉ',
        mistakeCount: 2,
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'meaning',
        source: 'srs_again',
        lastMistakeAt: new Date().toISOString(),
      };

      const rec = routeMistakeToModule(flashcardMistake);
      expect(rec.recommendedModule).toBe('flashcard');
      expect(rec.secondaryModule).toBe('classic_quiz');
      expect(rec.reason).toContain('Flashcard');
    });

    it('prioritizes shadowing when pronunciation target is a long phrase or sentence', () => {
      const phraseMistake: MistakeRecord = {
        id: 'w_phrase_pron',
        word: 'take into consideration',
        meaning: 'cân nhắc kỹ lưỡng',
        mistakeCount: 3,
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'pronunciation',
        source: 'pronunciation',
        lastMistakeAt: new Date().toISOString(),
      };

      const rec = routeMistakeToModule(phraseMistake);
      expect(rec.recommendedModule).toBe('shadowing');
      expect(rec.reason).toContain('Shadowing');
    });
  });

  describe('4. Immutability, Target Preservation & Low-Data Safety', () => {
    it('does NOT mutate the input profile or record during routing', () => {
      const originalRecord: MistakeRecord = {
        id: 'w_immutability',
        word: 'resilient',
        meaning: 'kiên cường',
        mistakeCount: 3,
        consecutiveCorrect: 1,
        resolved: false,
        primaryType: 'spelling',
        source: 'dictation',
        lastMistakeAt: '2026-10-04T00:00:00.000Z',
      };

      const snapshotBefore = JSON.parse(JSON.stringify(originalRecord));
      const recommendation = routeMistakeToModule(originalRecord);

      expect(recommendation).toBeDefined();
      expect(originalRecord).toEqual(snapshotBefore);
    });

    it('preserves targetId accurately in recommendation', () => {
      const record: MistakeRecord = {
        id: 'custom_uuid_98765',
        word: 'perseverance',
        meaning: 'sự kiên trì',
        mistakeCount: 2,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date().toISOString(),
      };

      const rec = routeMistakeToModule(record);
      expect(rec.targetId).toBe('custom_uuid_98765');
      expect(rec.word).toBe('perseverance');
    });

    it('handles low-data profile safely without creating aggressive recommendations', () => {
      // Hồ sơ chỉ mới sai 1 lần (sample size nhỏ)
      const lowDataRecord: MistakeRecord = {
        id: 'w_low_data',
        word: 'novelty',
        meaning: 'sự mới lạ',
        mistakeCount: 1,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date().toISOString(),
      };

      const rec = routeMistakeToModule(lowDataRecord);
      expect(rec.metadata?.confidence).toBe('low');
      expect(rec.priority).toBeLessThanOrEqual(35);
      expect(rec.reason).toContain('Mới ghi nhận');

      // Hồ sơ không có lỗi nào (mistakeCount = 0)
      const zeroMistakeRecord: MistakeRecord = {
        id: 'w_zero',
        word: 'peace',
        meaning: 'hòa bình',
        mistakeCount: 0,
        consecutiveCorrect: 2,
        resolved: true,
        lastMistakeAt: new Date().toISOString(),
      };

      const zeroRec = routeMistakeToModule(zeroMistakeRecord);
      expect(zeroRec.priority).toBeLessThanOrEqual(10);
      expect(zeroRec.metadata?.confidence).toBe('low');
    });

    it('never recommends nonexistent modules across large batch of mistakes', () => {
      const mockBank: Record<string, MistakeRecord> = {
        m1: { id: 'm1', word: 'cat', meaning: 'mèo', mistakeCount: 2, consecutiveCorrect: 0, resolved: false, lastMistakeAt: new Date().toISOString() },
        m2: { id: 'm2', word: 'dog', meaning: 'chó', mistakeCount: 5, consecutiveCorrect: 0, resolved: false, primaryType: 'spelling', source: 'dictation', lastMistakeAt: new Date().toISOString() },
        m3: { id: 'm3', word: 'bird', meaning: 'chim', mistakeCount: 3, consecutiveCorrect: 0, resolved: false, primaryType: 'pronunciation', lastMistakeAt: new Date().toISOString() },
        m4: { id: 'm4', word: 'fish', meaning: 'cá', mistakeCount: 1, consecutiveCorrect: 0, resolved: false, primaryType: 'other', lastMistakeAt: new Date().toISOString() },
      };

      const recommendations = getAdaptivePracticeRecommendations(mockBank, { limit: 10 });
      expect(recommendations.length).toBe(4);

      for (const r of recommendations) {
        expect(isValidPracticeModule(r.recommendedModule)).toBe(true);
        if (r.secondaryModule) {
          expect(isValidPracticeModule(r.secondaryModule)).toBe(true);
        }
      }
    });
  });

  describe('5. Targeted Practice Lifecycle & Store Integration', () => {
    it('startAdaptivePractice in store sets activePracticeConfig and triggers pendingNavigationTab', () => {
      const store = useAppStore.getState();

      store.startAdaptivePractice({
        module: 'dictation',
        itemIds: ['accommodate', 'necessary'],
        mistakeType: 'spelling',
      });

      const updated = useAppStore.getState();
      expect(updated.activePracticeConfig).toBeDefined();
      expect(updated.activePracticeConfig?.module).toBe('dictation');
      expect(updated.activePracticeConfig?.itemIds).toEqual(['accommodate', 'necessary']);
      expect(updated.activePracticeConfig?.mistakeType).toBe('spelling');
      expect(updated.pendingNavigationTab).toBe('arcade');

      // Clear practice
      store.clearAdaptivePractice();
      expect(useAppStore.getState().activePracticeConfig).toBeNull();
    });

    it('navigates to flashcards when practicing collocation or cloze', () => {
      const store = useAppStore.getState();

      store.startAdaptivePractice({
        module: 'collocation',
        itemIds: ['make a decision'],
        mistakeType: 'collocation',
      });

      expect(useAppStore.getState().pendingNavigationTab).toBe('flashcards');
      store.clearPendingNavigation();
      expect(useAppStore.getState().pendingNavigationTab).toBeNull();
    });

    it('navigates to pronunciation when practicing pronunciation or shadowing', () => {
      const store = useAppStore.getState();

      store.startAdaptivePractice({
        module: 'pronunciation',
        itemIds: ['orchestra'],
        mistakeType: 'pronunciation',
      });

      expect(useAppStore.getState().pendingNavigationTab).toBe('pronunciation');
      store.clearPendingNavigation();
      expect(useAppStore.getState().pendingNavigationTab).toBeNull();
    });

    it('enforces ephemeral lifecycle: consumed config is cleared and does NOT leak into normal practice', () => {
      const store = useAppStore.getState();

      // 1. Khởi động phiên thích ứng mục tiêu
      store.startAdaptivePractice({
        module: 'word_scramble',
        itemIds: ['target_item_42'],
        mistakeType: 'spelling',
      });

      expect(useAppStore.getState().activePracticeConfig).not.toBeNull();
      expect(useAppStore.getState().activePracticeConfig?.itemIds).toEqual(['target_item_42']);

      // 2. Module consume target và xóa cấu hình tạm thời
      store.clearAdaptivePractice();
      expect(useAppStore.getState().activePracticeConfig).toBeNull();

      // 3. Các lượt tiếp theo hoàn toàn sạch sẽ, không bị khóa cứng vào targetItem cũ
      const stateAfter = useAppStore.getState();
      expect(stateAfter.activePracticeConfig).toBeNull();
    });

    it('ensures activePracticeConfig and pendingNavigationTab are NEVER persisted into storage (omitted from partialize)', () => {
      // Thiết lập state có activePracticeConfig và pendingNavigationTab
      useAppStore.setState({
        activePracticeConfig: {
          module: 'dictation',
          itemIds: ['ephemeral_1'],
          mistakeType: 'spelling',
          startedAt: Date.now(),
        },
        pendingNavigationTab: 'arcade',
      });

      // Lấy cấu hình persist partialize từ store options
      const persistOptions = (useAppStore as any).persist?.getOptions();
      if (persistOptions?.partialize) {
        const persisted = persistOptions.partialize(useAppStore.getState());
        expect((persisted as any).activePracticeConfig).toBeUndefined();
        expect((persisted as any).pendingNavigationTab).toBeUndefined();
      }

      // Kiểm tra trong exportBackupData cũng không xuất dữ liệu tạm
      const backupJson = useAppStore.getState().exportBackupData();
      const parsedBackup = JSON.parse(backupJson);
      expect(parsedBackup.activePracticeConfig).toBeUndefined();
      expect(parsedBackup.pendingNavigationTab).toBeUndefined();
    });

    it('prioritizes exact ID-first matching to prevent collision between homonyms or different items sharing the same word', () => {
      const mockPool: MistakeRecord[] = [
        {
          id: 'custom_lead_verb',
          word: 'lead',
          meaning: 'dẫn dắt (động từ)',
          mistakeCount: 3,
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'meaning',
          source: 'flashcard',
          lastMistakeAt: new Date().toISOString(),
        },
        {
          id: 'custom_lead_noun',
          word: 'lead',
          meaning: 'kim loại chì (danh từ)',
          mistakeCount: 1,
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'meaning',
          source: 'classic_quiz',
          lastMistakeAt: new Date().toISOString(),
        },
      ];

      // Đề xuất cho mục custom_lead_noun
      const recNoun = routeMistakeToModule(mockPool[1]);
      expect(recNoun.targetId).toBe('custom_lead_noun');
      expect(recNoun.word).toBe('lead');

      // Đề xuất cho mục custom_lead_verb
      const recVerb = routeMistakeToModule(mockPool[0]);
      expect(recVerb.targetId).toBe('custom_lead_verb');
      expect(recVerb.word).toBe('lead');
      expect(recVerb.priority).toBeGreaterThan(recNoun.priority);
    });

    it('enforces low-data guard: never declares chronic or dominant weakness when totalMistakes < 2', () => {
      const singleMistake: MistakeRecord = {
        id: 'item_single_err',
        word: 'tentative',
        meaning: 'dự kiến',
        mistakeCount: 1,
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'spelling',
        source: 'dictation',
        lastMistakeAt: new Date().toISOString(),
      };

      const rec = routeMistakeToModule(singleMistake);
      expect(rec.metadata?.confidence).toBe('low');
      expect(rec.priority).toBeLessThanOrEqual(35);
      expect(rec.reason).not.toContain('CẢNH BÁO: Lỗi kinh niên');
      expect(rec.reason).not.toContain('điểm yếu chính');
      expect(rec.metadata?.recurrenceLevel).not.toBe('chronic');
    });
  });
});
