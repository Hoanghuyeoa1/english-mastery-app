import type {
  AppStoreState,
  VocabWord,
  MistakeRecord,
  MistakeType,
  CanonicalMistakeSource,
  MistakeResolutionEvent,
  MistakeSource,
} from '../../types';
import {
  toCanonicalSource,
  toCanonicalType,
  canonicalizeSourceCounts,
  updateTypeResolutionOnMistake,
  updateTypeResolutionOnCorrect,
} from '../../services/adaptiveMistakeService';
import { emitMistakeCreatedEvent } from '../../services/mistakeCreatedEventService';

export interface MistakeSlice {
  recordMistake: (
    word: Partial<VocabWord> & { word: string; meaning?: string },
    source?: MistakeSource,
    options?: {
      type?: MistakeType;
      userAnswer?: string;
      expectedAnswer?: string;
      context?: string;
      idempotencyKey?: string;
    }
  ) => void;
  recordMistakeCorrect: (wordIdOrText: string, options?: { type?: MistakeType }) => void;
  recordQuizMistakeResult: (
    wordId: string,
    isCorrect: boolean,
    details?: {
      source?: MistakeSource;
      type?: MistakeType;
      userAnswer?: string;
      expectedAnswer?: string;
      context?: string;
      idempotencyKey?: string;
    }
  ) => MistakeResolutionEvent;
  getUnresolvedMistakeWords: () => VocabWord[];
  removeMistake: (wordIdOrText: string) => void;
  clearResolvedMistakes: () => void;
  clearAllMistakes: () => void;
}

type SetState = (
  partial: Partial<AppStoreState> | ((state: AppStoreState) => Partial<AppStoreState>),
  replace?: boolean
) => void;
type GetState = () => AppStoreState;

export const createMistakeSlice = (set: SetState, get: GetState): MistakeSlice => ({
  recordMistake: (wordItem, source = 'custom', options) => {
    const cleanWord = wordItem.word.trim();
    if (!cleanWord) return;
    const key = (wordItem.id || cleanWord).toLowerCase();

    // Idempotency guard: prevent duplicate recording of the exact same mistake evidence
    const idempKey = options?.idempotencyKey;
    if (idempKey && get().processedMistakeKeys?.includes(idempKey)) {
      return;
    }

    const nowIso = new Date().toISOString();
    let updatedRecordToEmit: MistakeRecord | null = null;
    let emittedSource = 'custom';
    let emittedType = 'meaning';

    set((state) => {
      const currentRecord = state.mistakeBank[key] || state.mistakeBank[cleanWord.toLowerCase()];
      const canonicalSource = toCanonicalSource(source || currentRecord?.source || 'custom');
      const canonicalType = toCanonicalType(options?.type, canonicalSource);
      emittedSource = canonicalSource;
      emittedType = canonicalType;

      const isReopen = Boolean(currentRecord && currentRecord.resolved);
      const nextReopenCount = (currentRecord?.reopenCount || 0) + (isReopen ? 1 : 0);

      const nextTypeCounts: Partial<Record<MistakeType, number>> = {
        ...(currentRecord?.typeCounts || {}),
      };
      nextTypeCounts[canonicalType] = (nextTypeCounts[canonicalType] || 0) + 1;

      // Merge & canonicalize source counts to prevent split legacy/modern counters
      const nextSourceCounts = canonicalizeSourceCounts(currentRecord?.sourceCounts);
      nextSourceCounts[canonicalSource] = (nextSourceCounts[canonicalSource] || 0) + 1;

      // Update per-type resolution state
      const nextTypeResolutionMap = updateTypeResolutionOnMistake(
        currentRecord?.typeResolutionMap,
        canonicalType,
        nowIso
      );

      const updatedRecord: MistakeRecord = {
        id: wordItem.id || currentRecord?.id || `mistake_${cleanWord.toLowerCase()}`,
        word: cleanWord,
        ipa: wordItem.ipa || currentRecord?.ipa,
        meaning: wordItem.meaning || currentRecord?.meaning || '',
        example: wordItem.example || currentRecord?.example,
        tag: (wordItem.tag as any) || currentRecord?.tag || 'Daily',
        mistakeCount: (currentRecord?.mistakeCount || 0) + 1,
        wrongCount: ((currentRecord?.wrongCount ?? currentRecord?.mistakeCount) || 0) + 1,
        consecutiveCorrect: 0, // Reset chuỗi trả lời đúng về 0
        resolved: false,
        lastMistakeAt: nowIso,
        source: canonicalSource,
        primaryType: canonicalType,
        typeCounts: nextTypeCounts,
        sourceCounts: nextSourceCounts,
        firstSeenAt: currentRecord?.firstSeenAt || currentRecord?.lastMistakeAt || nowIso,
        lastCorrectAt: currentRecord?.lastCorrectAt,
        reopenCount: nextReopenCount,
        lastUserAnswer: options?.userAnswer ? options.userAnswer.slice(0, 100) : currentRecord?.lastUserAnswer,
        lastExpectedAnswer: options?.expectedAnswer ? options.expectedAnswer.slice(0, 100) : currentRecord?.lastExpectedAnswer,
        lastContext: options?.context ? options.context.slice(0, 150) : currentRecord?.lastContext,
        typeResolutionMap: nextTypeResolutionMap,
      };

      updatedRecordToEmit = updatedRecord;

      const nextProcessedKeys = idempKey
        ? [...(state.processedMistakeKeys || []), idempKey].slice(-200)
        : state.processedMistakeKeys || [];

      return {
        mistakeBank: {
          ...state.mistakeBank,
          [key]: updatedRecord,
        },
        processedMistakeKeys: nextProcessedKeys,
      };
    });

    // Phase 8: Emit mistake_created domain event AFTER local state has committed
    if (updatedRecordToEmit) {
      const rec: MistakeRecord = updatedRecordToEmit;
      emitMistakeCreatedEvent({
        mistakeId: rec.id,
        wordId: wordItem.id || rec.id,
        word: rec.word,
        source: emittedSource,
        mistakeType: emittedType,
        userAnswer: options?.userAnswer,
        expectedAnswer: options?.expectedAnswer,
        context: options?.context,
        occurredAt: nowIso,
        idempotencyKey: idempKey,
      });
    }
  },

  recordMistakeCorrect: (wordIdOrText: string, options) => {
    if (!wordIdOrText) return;
    const key = wordIdOrText.trim().toLowerCase();

    set((state) => {
      // Deterministic resolution: Ưu tiên tìm chính xác theo ID (key hoặc item.id), sau đó fallback sang normalized word
      const matchedEntry =
        Object.entries(state.mistakeBank).find(([k, item]) => k.toLowerCase() === key || item.id === wordIdOrText) ||
        Object.entries(state.mistakeBank).find(([_, item]) => item.word.toLowerCase() === key);

      if (!matchedEntry) return state;
      const [foundKey, currentRecord] = matchedEntry;

      const nowIso = new Date().toISOString();
      const targetType = options?.type ? toCanonicalType(options.type) : undefined;

      // Cập nhật typeResolutionMap theo từng loại lỗi
      const resolutionResult = updateTypeResolutionOnCorrect(
        currentRecord.typeResolutionMap,
        targetType,
        { nowIso }
      );

      const nextConsecutive = (currentRecord.consecutiveCorrect || 0) + 1;
      const willResolveByCount = nextConsecutive >= 2;
      const willResolveByMap = resolutionResult.allResolved;
      const wasResolved = Boolean(currentRecord.resolved);

      // Nếu có targetType cụ thể và record có typeResolutionMap với nhiều hơn 1 loại:
      // Bản ghi tổng thể được coi là resolved khi tất cả các lỗi con đã resolved, hoặc nếu không có type nào khác thì theo nextConsecutive >= 2.
      let isResolved = false;
      if (targetType && currentRecord.typeResolutionMap && Object.keys(currentRecord.typeResolutionMap).length > 0) {
        isResolved = willResolveByMap || wasResolved;
      } else {
        isResolved = willResolveByCount || wasResolved;
      }

      const updatedRecord: MistakeRecord = {
        ...currentRecord,
        consecutiveCorrect: nextConsecutive,
        resolved: isResolved,
        resolvedDate: (isResolved && !wasResolved)
          ? (currentRecord.resolvedDate || nowIso)
          : currentRecord.resolvedDate,
        lastCorrectAt: nowIso,
        typeResolutionMap: resolutionResult.updatedMap,
      };

      return {
        mistakeBank: {
          ...state.mistakeBank,
          [foundKey]: updatedRecord,
        },
      };
    });
  },

  recordQuizMistakeResult: (wordId: string, isCorrect: boolean, details) => {
    let newlyResolved = false;
    let eventResult: MistakeResolutionEvent = {
      wordId: wordId || '',
      word: wordId || '',
      resolved: false,
      consecutiveCorrect: 0,
      newlyResolved: false,
    };

    if (!wordId) return eventResult;
    const cleanKey = wordId.trim().toLowerCase();

    // Idempotency guard for mistake creation: prevent duplicate recording if !isCorrect
    const idempKey = details?.idempotencyKey;
    if (!isCorrect && idempKey && get().processedMistakeKeys?.includes(idempKey)) {
      const existing = Object.values(get().mistakeBank).find(
        (m) => m.id.toLowerCase() === cleanKey || m.word.toLowerCase() === cleanKey
      );
      return {
        wordId: existing?.id || wordId,
        word: existing?.word || wordId,
        resolved: existing?.resolved || false,
        consecutiveCorrect: existing?.consecutiveCorrect || 0,
        newlyResolved: false,
      };
    }

    let updatedRecordToEmit: MistakeRecord | null = null;
    let emittedSource = 'classic_quiz';
    let emittedType = 'meaning';
    const nowIso = new Date().toISOString();

    set((state) => {
      // Tìm bản ghi tương ứng trong mistakeBank theo key, id hoặc word
      const matchedEntry = Object.entries(state.mistakeBank).find(
        ([k, item]) =>
          k.toLowerCase() === cleanKey ||
          item.id.toLowerCase() === cleanKey ||
          item.word.toLowerCase().trim() === cleanKey
      );

      if (!matchedEntry) {
        // Nếu chưa có trong mistakeBank và người học trả lời sai, tự động ghi nhận bẫy lỗi mới
        if (!isCorrect) {
          const vocabWord = state.vocabularyList.find(
            (w) =>
              w.id.toLowerCase() === cleanKey ||
              w.word.toLowerCase().trim() === cleanKey
          );
          const canonicalSource = toCanonicalSource(details?.source || 'classic_quiz');
          const canonicalType = toCanonicalType(details?.type, canonicalSource);
          emittedSource = canonicalSource;
          emittedType = canonicalType;

          const newRecord: MistakeRecord = {
            id: vocabWord?.id || wordId,
            word: (vocabWord?.word || wordId).toLowerCase().trim(),
            ipa: vocabWord?.ipa || vocabWord?.phonetic || '',
            meaning: vocabWord?.meaning || '',
            example: vocabWord?.example || vocabWord?.example_en || '',
            tag: (vocabWord?.tag as any) || 'Daily',
            mistakeCount: 1,
            wrongCount: 1,
            consecutiveCorrect: 0,
            resolved: false,
            lastMistakeAt: nowIso,
            source: canonicalSource,
            primaryType: canonicalType,
            typeCounts: { [canonicalType]: 1 },
            sourceCounts: { [canonicalSource]: 1 },
            firstSeenAt: nowIso,
            reopenCount: 0,
            lastUserAnswer: details?.userAnswer ? details.userAnswer.slice(0, 100) : undefined,
            lastExpectedAnswer: details?.expectedAnswer ? details.expectedAnswer.slice(0, 100) : undefined,
            lastContext: details?.context ? details.context.slice(0, 150) : undefined,
            typeResolutionMap: {
              [canonicalType]: {
                mistakeCount: 1,
                consecutiveCorrect: 0,
                resolved: false,
                reopenCount: 0,
                lastMistakeAt: nowIso,
              },
            },
          };

          eventResult = {
            wordId: newRecord.id,
            word: newRecord.word,
            resolved: false,
            consecutiveCorrect: 0,
            newlyResolved: false,
          };

          updatedRecordToEmit = newRecord;

          const nextProcessedKeys = idempKey
            ? [...(state.processedMistakeKeys || []), idempKey].slice(-200)
            : state.processedMistakeKeys || [];

          return {
            mistakeBank: {
              ...state.mistakeBank,
              [cleanKey]: newRecord,
            },
            processedMistakeKeys: nextProcessedKeys,
          };
        }
        return state;
      }

      const [foundKey, currentRecord] = matchedEntry;

      if (isCorrect) {
        const canonicalSource = toCanonicalSource(details?.source || currentRecord.source);
        const targetType = details?.type ? toCanonicalType(details.type, canonicalSource) : undefined;

        const resolutionResult = updateTypeResolutionOnCorrect(
          currentRecord.typeResolutionMap,
          targetType,
          { nowIso }
        );

        const nextConsecutive = (currentRecord.consecutiveCorrect || 0) + 1;
        const willResolveByCount = nextConsecutive >= 2;
        const willResolveByMap = resolutionResult.allResolved;
        const wasResolved = Boolean(currentRecord.resolved);

        let willBeResolved = false;
        if (targetType && currentRecord.typeResolutionMap && Object.keys(currentRecord.typeResolutionMap).length > 0) {
          willBeResolved = willResolveByMap || wasResolved;
        } else {
          willBeResolved = willResolveByCount || wasResolved;
        }
        newlyResolved = willBeResolved && !wasResolved;

        const updatedRecord: MistakeRecord = {
          ...currentRecord,
          consecutiveCorrect: nextConsecutive,
          resolved: willBeResolved,
          resolvedDate: (willBeResolved && !wasResolved)
            ? nowIso
            : currentRecord.resolvedDate,
          lastCorrectAt: nowIso,
          typeResolutionMap: resolutionResult.updatedMap,
        };

        eventResult = {
          wordId: updatedRecord.id || wordId,
          word: updatedRecord.word,
          resolved: updatedRecord.resolved,
          consecutiveCorrect: updatedRecord.consecutiveCorrect,
          newlyResolved,
        };

        return {
          mistakeBank: {
            ...state.mistakeBank,
            [foundKey]: updatedRecord,
          },
        };
      } else {
        // isCorrect === false
        const isReopen = Boolean(currentRecord.resolved);
        const currentWrong = currentRecord.wrongCount ?? currentRecord.mistakeCount ?? 0;
        const canonicalSource = toCanonicalSource(details?.source || currentRecord.source || 'classic_quiz');
        const canonicalType = toCanonicalType(details?.type, canonicalSource);
        emittedSource = canonicalSource;
        emittedType = canonicalType;

        const nextTypeCounts: Partial<Record<MistakeType, number>> = {
          ...(currentRecord.typeCounts || {}),
        };
        nextTypeCounts[canonicalType] = (nextTypeCounts[canonicalType] || 0) + 1;

        const nextSourceCounts = canonicalizeSourceCounts(currentRecord.sourceCounts);
        nextSourceCounts[canonicalSource] = (nextSourceCounts[canonicalSource] || 0) + 1;

        const nextTypeResolutionMap = updateTypeResolutionOnMistake(
          currentRecord.typeResolutionMap,
          canonicalType,
          nowIso
        );

        const updatedRecord: MistakeRecord = {
          ...currentRecord,
          consecutiveCorrect: 0,
          wrongCount: currentWrong + 1,
          mistakeCount: (currentRecord.mistakeCount || 0) + 1,
          resolved: false,
          lastMistakeAt: nowIso,
          source: canonicalSource,
          primaryType: canonicalType,
          typeCounts: nextTypeCounts,
          sourceCounts: nextSourceCounts,
          typeResolutionMap: nextTypeResolutionMap,
          reopenCount: (currentRecord.reopenCount || 0) + (isReopen ? 1 : 0),
          lastUserAnswer: details?.userAnswer ? details.userAnswer.slice(0, 100) : currentRecord.lastUserAnswer,
          lastExpectedAnswer: details?.expectedAnswer ? details.expectedAnswer.slice(0, 100) : currentRecord.lastExpectedAnswer,
          lastContext: details?.context ? details.context.slice(0, 150) : currentRecord.lastContext,
        };

        eventResult = {
          wordId: updatedRecord.id || wordId,
          word: updatedRecord.word,
          resolved: false,
          consecutiveCorrect: 0,
          newlyResolved: false,
        };

        updatedRecordToEmit = updatedRecord;

        const nextProcessedKeys = idempKey
          ? [...(state.processedMistakeKeys || []), idempKey].slice(-200)
          : state.processedMistakeKeys || [];

        return {
          mistakeBank: {
            ...state.mistakeBank,
            [foundKey]: updatedRecord,
          },
          processedMistakeKeys: nextProcessedKeys,
        };
      }
    });

    // Nếu vừa phục thù thành công (consecutiveCorrect >= 2):
    // Cộng thưởng phục thù: profile.xp += 25 (sử dụng gainXP(25))
    if (newlyResolved) {
      get().gainXP(25);
    }

    // Phase 8: Emit mistake_created domain event only when !isCorrect and committed
    if (!isCorrect && updatedRecordToEmit) {
      const rec: MistakeRecord = updatedRecordToEmit;
      emitMistakeCreatedEvent({
        mistakeId: rec.id,
        wordId: rec.id,
        word: rec.word,
        source: emittedSource,
        mistakeType: emittedType,
        userAnswer: details?.userAnswer,
        expectedAnswer: details?.expectedAnswer,
        context: details?.context,
        occurredAt: nowIso,
        idempotencyKey: idempKey,
      });
    }

    return eventResult;
  },

  getUnresolvedMistakeWords: () => {
    const state = get();
    const mistakeEntries = Object.values(state.mistakeBank || {});
    const unresolved = mistakeEntries.filter((m) => m && m.resolved === false);

    if (unresolved.length === 0) return [];

    const vocabList = state.vocabularyList || [];

    // Tạo map tra cứu nhanh theo ID và theo từ (lowercase)
    const idMap = new Map<string, VocabWord>();
    const wordMap = new Map<string, VocabWord>();
    for (let i = 0; i < vocabList.length; i++) {
      const item = vocabList[i];
      if (item.id) idMap.set(item.id.toLowerCase(), item);
      if (item.word) wordMap.set(item.word.toLowerCase().trim(), item);
    }

    return unresolved.map((m) => {
      const cleanWord = m.word?.toLowerCase().trim();
      const cleanId = m.id?.toLowerCase();

      const matched = (cleanId ? idMap.get(cleanId) : undefined) || (cleanWord ? wordMap.get(cleanWord) : undefined);
      if (matched) {
        return matched;
      }

      // Fallback nếu từ được lưu tự do từ nguồn khác
      const fallback: VocabWord = {
        id: m.id || `mistake_${cleanWord}`,
        word: m.word,
        ipa: m.ipa || '',
        phonetic: m.ipa || '',
        meaning: m.meaning || 'Từ vựng trong sổ tay bẫy lỗi',
        partOfSpeech: 'noun',
        pos: 'noun',
        example: m.example || '',
        example_en: m.example || '',
        example_vi: '',
        tag: (m.tag as any) || 'Daily',
        srsLevel: 0,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
      };
      return fallback;
    });
  },

  removeMistake: (wordIdOrText: string) => {
    if (!wordIdOrText) return;
    const key = wordIdOrText.trim().toLowerCase();

    set((state) => {
      const nextBank = { ...state.mistakeBank };
      Object.keys(nextBank).forEach((k) => {
        if (k === key || nextBank[k].id === wordIdOrText || nextBank[k].word.toLowerCase() === key) {
          delete nextBank[k];
        }
      });
      return { mistakeBank: nextBank };
    });
  },

  clearResolvedMistakes: () => {
    set((state) => {
      const nextBank: Record<string, MistakeRecord> = {};
      Object.entries(state.mistakeBank).forEach(([k, v]) => {
        if (!v.resolved) {
          nextBank[k] = v;
        }
      });
      return { mistakeBank: nextBank };
    });
  },

  clearAllMistakes: () => {
    set({ mistakeBank: {} });
  },
});
