import type {
  AppStoreState,
  VocabWord,
  CollocationItem,
  SRSReviewCard,
  SRSAlgorithmType,
  FSRSSettings,
  SRSReviewEvent,
  ActiveTab,
  RatingCountStats,
  SRSGrade,
  SRSProgress,
  DailyProgress,
  PracticeModuleId,
  MistakeType,
} from '../../types';
import { getModuleNavigationTarget } from '../../services/adaptivePracticeRouter';
import { DEFAULT_FSRS_SETTINGS } from '../../services/fsrsAlgorithm';
import { processCardReview, getRatingCounters } from '../../services/srsScheduler';
import { resolveCanonicalVocab } from '../../services/wordLookupService';
import { scheduleCloudSync } from '../../services/cloudSyncService';
import { emitReviewCardEvent } from '../../services/reviewCardEventService';
import { emitLearnWordEvent } from '../../services/learnWordEventService';
import { buildUnifiedSRSCards } from '../vocabularyComposer';
import { getVietnamDateString } from '../../services/leaderboardLearningMetrics';

export interface SrsSlice {
  startAdaptivePractice: (config: {
    module: PracticeModuleId;
    itemIds: string[];
    mistakeType?: MistakeType;
    planItemId?: string;
    planTitle?: string;
    planObjective?: string;
    estimatedMinutes?: number;
  }) => void;
  clearAdaptivePractice: () => void;
  navigateToTab: (tab: ActiveTab) => void;
  clearPendingNavigation: () => void;
  getRatingStats: (timeframe?: 7 | 30 | 'all') => RatingCountStats;
  setSRSAlgorithm: (algorithm: SRSAlgorithmType) => void;
  setFSRSSettings: (settings: Partial<FSRSSettings>) => void;
  saveCollocationToSRS: (
    item: Omit<CollocationItem, 'id' | 'createdAt'> & { source?: string; sources?: string[] }
  ) => { success: boolean; id: string; isDuplicate?: boolean };
  deleteCollocation: (id: string) => void;
  getUnifiedSRSCards: () => SRSReviewCard[];
  saveToSRS: (
    wordOrId: VocabWord | string,
    options?: { contextSentence?: string; meaning?: string; source?: string; sources?: string[] }
  ) => void;
  processReview: (
    wordId: string,
    grade: SRSGrade,
    reviewMode?: 'due_today' | 'today_learned' | 'all_learned' | boolean
  ) => void;
}

type SetState = (
  partial: Partial<AppStoreState> | ((state: AppStoreState) => Partial<AppStoreState>),
  replace?: boolean
) => void;
type GetState = () => AppStoreState;

export const createSrsSlice = (set: SetState, get: GetState): SrsSlice => ({
  startAdaptivePractice: (config) => {
    const targetNav = getModuleNavigationTarget(config.module);
    set({
      activePracticeConfig: {
        module: config.module,
        itemIds: config.itemIds || [],
        mistakeType: config.mistakeType,
        startedAt: Date.now(),
        planItemId: config.planItemId,
        planTitle: config.planTitle,
        planObjective: config.planObjective,
        estimatedMinutes: config.estimatedMinutes,
      },
      pendingNavigationTab: targetNav.tab,
    });
  },

  clearAdaptivePractice: () => {
    set({ activePracticeConfig: null });
  },

  navigateToTab: (tab: ActiveTab) => {
    set({ pendingNavigationTab: tab });
  },

  clearPendingNavigation: () => {
    set({ pendingNavigationTab: null });
  },

  getRatingStats: (timeframe: 7 | 30 | 'all' = 'all') =>
    getRatingCounters(get().dailyHistory, timeframe),

  setSRSAlgorithm: (algorithm: SRSAlgorithmType) => set({ srsAlgorithm: algorithm }),
  setFSRSSettings: (settings: Partial<FSRSSettings>) =>
    set((state) => ({ fsrsSettings: { ...state.fsrsSettings, ...settings } })),

  saveCollocationToSRS: (item: Omit<CollocationItem, 'id' | 'createdAt'> & { source?: string; sources?: string[] }) => {
    const raw = (item.phrase || '').trim();
    const stripped = raw
      .replace(/^[\s"'“‘([<«\-—.,;:!?]+/, '')
      .replace(/[\s"'”’)\]>»\-—.,;:!?]+$/, '');
    const normalizedPhrase = (stripped || raw).replace(/\s+/g, ' ');
    const cleanPhrase = normalizedPhrase.toLowerCase();
    if (!cleanPhrase) {
      return { success: false, id: '' };
    }

    // Determine incoming sources
    const incomingSources: string[] = [];
    if (item.sources && Array.isArray(item.sources)) {
      incomingSources.push(...item.sources);
    }
    if (item.source && typeof item.source === 'string') {
      incomingSources.push(item.source);
    }
    if (item.tags && Array.isArray(item.tags)) {
      if (item.tags.some((t) => t.toLowerCase() === 'writing')) incomingSources.push('writing');
      if (item.tags.some((t) => t.toLowerCase() === 'translator')) incomingSources.push('translator');
    }
    const cleanIncomingSources = Array.from(
      new Set(incomingSources.map((s) => s.toLowerCase().trim()).filter(Boolean))
    );

    const state = get();
    const currentList = state.userCollocations || [];
    const existingColloc = currentList.find((c) => {
      const cRaw = (c.phrase || '').trim();
      const cStripped = cRaw
        .replace(/^[\s"'“‘([<«\-—.,;:!?]+/, '')
        .replace(/[\s"'”’)\]>»\-—.,;:!?]+$/, '');
      return (cStripped || cRaw).replace(/\s+/g, ' ').toLowerCase() === cleanPhrase;
    });

    if (existingColloc) {
      // If already exists, union sources if new provenance arrived without creating duplicate
      const existingSources = existingColloc.sources || (existingColloc.tags?.includes('writing') ? ['writing'] : []);
      const mergedSources = Array.from(new Set([...existingSources, ...cleanIncomingSources]));
      if (mergedSources.length > existingSources.length) {
        set((prevState) => {
          const updatedCollocs = (prevState.userCollocations || []).map((c) =>
            c.id === existingColloc.id ? { ...c, sources: mergedSources } : c
          );
          const prevSRS = prevState.srsProgressMap[existingColloc.id];
          const updatedSRS = prevSRS ? { ...prevSRS, sources: mergedSources } : undefined;
          return {
            userCollocations: updatedCollocs,
            ...(updatedSRS ? { srsProgressMap: { ...prevState.srsProgressMap, [existingColloc.id]: updatedSRS } } : {}),
          };
        });
      }
      return { success: false, id: existingColloc.id, isDuplicate: true };
    }

    let collocTimestamp = Date.now();
    const existingIds = new Set((state.userCollocations || []).map((c) => c.id));
    while (existingIds.has(`colloc_${collocTimestamp}`)) {
      collocTimestamp++;
    }
    const id = `colloc_${collocTimestamp}`;
    const newCollocation: CollocationItem = {
      ...item,
      phrase: normalizedPhrase,
      id,
      createdAt: new Date().toISOString(),
      sources: cleanIncomingSources.length > 0 ? cleanIncomingSources : undefined,
    };

    const initialSRS: SRSProgress = {
      srsLevel: 0,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
      firstLearnedAt: new Date().toISOString(),
      lastReviewedDate: new Date().toISOString(),
      sources: cleanIncomingSources.length > 0 ? cleanIncomingSources : undefined,
    };

    set((prevState) => ({
      userCollocations: [newCollocation, ...(prevState.userCollocations || [])],
      srsProgressMap: {
        ...(prevState.srsProgressMap || {}),
        [id]: initialSRS,
      },
      profile: {
        ...prevState.profile,
        xp: (prevState.profile?.xp || 0) + 15,
      },
    }));

    scheduleCloudSync(2000);
    return { success: true, id, isDuplicate: false };
  },

  deleteCollocation: (id: string) => {
    set((prevState) => {
      const updatedSRS = { ...(prevState.srsProgressMap || {}) };
      delete updatedSRS[id];

      return {
        userCollocations: (prevState.userCollocations || []).filter((c) => c.id !== id),
        srsProgressMap: updatedSRS,
      };
    });
    scheduleCloudSync(2000);
  },

  getUnifiedSRSCards: (): SRSReviewCard[] => {
    const state = get();
    return buildUnifiedSRSCards(
      state.vocabularyList || [],
      state.userCollocations || [],
      state.srsProgressMap || {}
    );
  },

  saveToSRS: (
    wordOrId: VocabWord | string,
    options?: { contextSentence?: string; meaning?: string; source?: string; sources?: string[] }
  ) => {
    const state = get();
    const resolution = resolveCanonicalVocab(wordOrId, state.vocabularyList);
    if (!resolution) return;

    const { canonicalId, canonicalWord, isExistingInBank } = resolution;
    const cleanWord = canonicalWord.word.toLowerCase().trim();

    // Xác định ngữ cảnh đọc hiểu (Context Sentence)
    const readingContext = options?.contextSentence?.trim() || 
      (typeof wordOrId !== 'string' ? (wordOrId.exampleEn || wordOrId.example) : undefined);
    const customMeaning = options?.meaning?.trim() || 
      (typeof wordOrId !== 'string' ? wordOrId.meaning : undefined);

    // Determine incoming sources
    const incomingSources: string[] = [];
    if (options?.sources && Array.isArray(options.sources)) {
      incomingSources.push(...options.sources);
    }
    if (options?.source && typeof options.source === 'string') {
      incomingSources.push(options.source);
    }
    if (typeof wordOrId !== 'string') {
      if (Array.isArray(wordOrId.sources)) {
        incomingSources.push(...wordOrId.sources);
      }
      if ((wordOrId as any).source && typeof (wordOrId as any).source === 'string') {
        incomingSources.push((wordOrId as any).source);
      }
    }
    const existingCustomWord = state.userCustomWords.find(
      (w) => w.id === canonicalId || w.word.toLowerCase().trim() === cleanWord
    );
    if (existingCustomWord && Array.isArray(existingCustomWord.sources)) {
      incomingSources.push(...existingCustomWord.sources);
    }
    if (canonicalWord && Array.isArray(canonicalWord.sources)) {
      incomingSources.push(...canonicalWord.sources);
    }
    const cleanIncomingSources = Array.from(
      new Set(incomingSources.map((s) => s.toLowerCase().trim()).filter(Boolean))
    );

    // 2. Kiểm tra nếu từ đã có trong SRS (kiểm tra canonicalId trước, fallback sang cleanWord)
    const existingSRS = state.srsProgressMap[canonicalId] || state.srsProgressMap[cleanWord];

    if (existingSRS) {
      // NẾU TỪ ĐÃ CÓ TRONG SRS:
      // - Tuyệt đối không tạo card mới / duplicate.
      // - Giữ nguyên toàn bộ tiến trình SRS: srsLevel, interval, easeFactor, nextReviewDate, firstLearnedAt, fsrs state.
      // - Hợp nhất nguồn provenance (multi-source union, không làm mất nguồn cũ)
      const currentSources = existingSRS.sources || existingCustomWord?.sources || [];
      const mergedSources = Array.from(new Set([...currentSources, ...cleanIncomingSources]));
      const hasNewSources = mergedSources.length > currentSources.length;

      if (readingContext || hasNewSources) {
        set((prevState) => {
          const prevSRS = prevState.srsProgressMap[canonicalId] || prevState.srsProgressMap[cleanWord] || existingSRS;
          const updatedSRS: SRSProgress = {
            ...prevSRS,
            ...(mergedSources.length > 0 ? { sources: mergedSources } : {}),
          };

          const updatedWord: VocabWord = {
            ...canonicalWord,
            id: canonicalId,
            ...(readingContext ? {
              example: readingContext,
              exampleEn: readingContext,
              example_en: readingContext,
            } : {}),
            meaning: customMeaning || canonicalWord.meaning,
            ...updatedSRS,
            ...(mergedSources.length > 0 ? { sources: mergedSources } : {}),
          };

          const existsInCustom = prevState.userCustomWords.some(
            (w) => w.id === canonicalId || w.word.toLowerCase().trim() === cleanWord
          );

          const nextCustomWords = existsInCustom
            ? prevState.userCustomWords.map((w) =>
                w.id === canonicalId || w.word.toLowerCase().trim() === cleanWord
                  ? {
                      ...w,
                      ...(readingContext ? { example: readingContext, exampleEn: readingContext, example_en: readingContext } : {}),
                      ...(customMeaning ? { meaning: customMeaning } : {}),
                      ...(mergedSources.length > 0 ? { sources: mergedSources } : {}),
                    }
                  : w
              )
            : (readingContext || !isExistingInBank
                ? [updatedWord, ...prevState.userCustomWords]
                : prevState.userCustomWords);

          const nextVocabList = prevState.vocabularyList.map((w) =>
            w.id === canonicalId || w.word.toLowerCase().trim() === cleanWord
              ? {
                  ...w,
                  ...(readingContext ? { example: readingContext, exampleEn: readingContext, example_en: readingContext } : {}),
                  ...(customMeaning ? { meaning: customMeaning } : {}),
                  ...(mergedSources.length > 0 ? { sources: mergedSources } : {}),
                }
              : w
          );

          return {
            srsProgressMap: {
              ...prevState.srsProgressMap,
              [canonicalId]: updatedSRS,
            },
            userCustomWords: nextCustomWords,
            vocabularyList: nextVocabList,
          };
        });
      }
      return;
    }

    // 3. TỪ CHƯA CÓ TRONG SRS: TẠO MỚI TIẾN TRÌNH SRS
    const nowIso = new Date().toISOString();
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 1);

    const newProg: SRSProgress = {
      srsLevel: 0,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: nextDate.toISOString(),
      firstLearnedAt: nowIso,
      lastReviewedDate: nowIso,
      isFavorite: canonicalWord.isFavorite || false,
      ...(cleanIncomingSources.length > 0 ? { sources: cleanIncomingSources } : {}),
    };

    const resolvedWord: VocabWord = {
      ...canonicalWord,
      id: canonicalId,
      meaning: customMeaning || canonicalWord.meaning || 'Từ vựng đã lưu vào SRS',
      example: readingContext || canonicalWord.example || canonicalWord.exampleEn || `Example with ${cleanWord}`,
      exampleEn: readingContext || canonicalWord.exampleEn || canonicalWord.example || `Example with ${cleanWord}`,
      example_en: readingContext || canonicalWord.example_en || canonicalWord.example || `Example with ${cleanWord}`,
      ...newProg,
      ...(cleanIncomingSources.length > 0 ? { sources: cleanIncomingSources } : {}),
    };

    set((prevState) => {
      // Nếu có readingContext hoặc là từ custom (không nằm trong static bank):
      // Luôn lưu vào userCustomWords để LocalStorage persistence bảo toàn ngữ cảnh vĩnh viễn
      const shouldPersistInCustom = Boolean(readingContext) || !isExistingInBank;

      let nextCustomWords = prevState.userCustomWords;
      if (shouldPersistInCustom) {
        const existsInCustom = prevState.userCustomWords.some(
          (c) => c.id === canonicalId || c.word.toLowerCase().trim() === cleanWord
        );
        if (!existsInCustom) {
          nextCustomWords = [resolvedWord, ...prevState.userCustomWords];
        } else {
          nextCustomWords = prevState.userCustomWords.map((c) =>
            c.id === canonicalId || c.word.toLowerCase().trim() === cleanWord
              ? { ...c, ...resolvedWord }
              : c
          );
        }
      }

      let foundInList = false;
      const nextVocabList = prevState.vocabularyList.map((w) => {
        if (w.id === canonicalId || w.word.toLowerCase().trim() === cleanWord) {
          foundInList = true;
          return { ...w, ...resolvedWord };
        }
        return w;
      });

      if (!foundInList) {
        nextVocabList.unshift(resolvedWord);
      }

      return {
        srsProgressMap: {
          ...prevState.srsProgressMap,
          [canonicalId]: newProg,
        },
        userCustomWords: nextCustomWords,
        vocabularyList: nextVocabList,
      };
    });
    scheduleCloudSync(2000);

    // Phase 6: Emit Domain Event for learn_word
    // Executed only AFTER local SRS creation has safely committed.
    emitLearnWordEvent({
      wordId: canonicalId,
      word: canonicalWord.word,
      meaning: customMeaning || canonicalWord.meaning,
      contextSentence: readingContext,
      source: cleanIncomingSources[0] || options?.source || 'dictionary',
      sources: cleanIncomingSources.length > 0 ? cleanIncomingSources : ['dictionary'],
      isCustom: !isExistingInBank,
      occurredAt: nowIso,
    });
  },

  processReview: (
    wordId: string, 
    grade: SRSGrade, 
    reviewMode?: 'due_today' | 'today_learned' | 'all_learned' | boolean
  ) => {
    const state = get();
    const word = state.vocabularyList.find((v) => v.id === wordId);
    const colloc = !word ? (state.userCollocations || []).find((c) => c.id === wordId) : undefined;
    if (!word && !colloc) return;

    const isReviewSession = !!reviewMode;
    const existingProgress = state.srsProgressMap[wordId];
    const hasBeenLearnedBefore = word
      ? (word.srsLevel && word.srsLevel > 0) || !!word.lastReviewedDate || !!word.firstLearnedAt || !!existingProgress
      : !!existingProgress;
    const isActuallyNewWord = !isReviewSession && !hasBeenLearnedBefore;

    const nowIso = new Date().toISOString();

    // XÁC ĐỊNH firstLearnedAt (CHỈ GHI 1 LẦN DUY NHẤT, KHÔNG ĐÈ KHI ÔN):
    let firstLearnedAt = word?.firstLearnedAt || existingProgress?.firstLearnedAt;
    if (!firstLearnedAt) {
      if (isActuallyNewWord) {
        firstLearnedAt = nowIso;
      } else {
        // Từ cũ nhưng chưa có trường firstLearnedAt -> lấy mốc quá khứ
        firstLearnedAt = word?.lastReviewedDate || existingProgress?.lastReviewedDate || '2026-08-01T00:00:00.000Z';
      }
    }

    const baseInterval = word ? (word.interval || 0) : (existingProgress?.interval || 1);
    const baseSrsLevel = word ? (word.srsLevel || 0) : (existingProgress?.srsLevel || 0);
    const baseEaseFactor = word ? (word.easeFactor || 2.5) : (existingProgress?.easeFactor || 2.5);
    const existingFsrs = word?.fsrs || existingProgress?.fsrs;

    const currentAlgorithm = state.srsAlgorithm || 'sm2';
    const cardForReview: SRSReviewCard = {
      id: wordId,
      type: word ? 'single_word' : 'collocation',
      primaryText: word ? word.word : wordId,
      meaning: word ? word.meaning : '',
      exampleEn: word ? (word.exampleEn || word.example || '') : '',
      srsLevel: baseSrsLevel,
      interval: baseInterval,
      easeFactor: baseEaseFactor,
      nextReviewDate: word?.nextReviewDate || existingProgress?.nextReviewDate || nowIso,
      isFavorite: word?.isFavorite || existingProgress?.isFavorite || false,
      fsrs: existingFsrs,
      againCount: existingProgress?.againCount ?? (word ? word.againCount : 0) ?? 0,
      reviewCount: existingProgress?.reviewCount ?? (word ? word.reviewCount : 0) ?? 0,
    };

    const reviewResult = processCardReview(
      cardForReview,
      grade,
      {
        algorithm: currentAlgorithm,
        desiredRetention: state.fsrsSettings?.desiredRetention ?? DEFAULT_FSRS_SETTINGS.desiredRetention,
      },
      new Date()
    );
    
    // CÁC TRƯỜNG ĐÁNH DẤU CHO TỪNG CHẾ ĐỘ:
    let todayNewReviewedAt = word?.todayNewReviewedAt || existingProgress?.todayNewReviewedAt;
    let todayPoolReviewedAt = word?.todayPoolReviewedAt || existingProgress?.todayPoolReviewedAt;
    let nextReviewDate = reviewResult.nextReview;

    if (reviewMode === 'today_learned') {
      // Ôn ở Chế độ 2 (Từ mới học hôm nay):
      // Khi bấm Khó (1), Tốt (2), hoặc Dễ (3) -> đánh dấu hoàn thành ôn củng cố hôm nay -> trừ khỏi Chế độ 2
      if (grade >= 1) {
        todayNewReviewedAt = nowIso;
      }
      nextReviewDate = reviewResult.nextReview;
    } else if (reviewMode === 'all_learned') {
      // Ôn ở Chế độ 3 (Toàn bộ kho từ):
      // Khi bấm Khó (1), Tốt (2), hoặc Dễ (3) -> đánh dấu hoàn thành luyện kho hôm nay -> trừ khỏi Chế độ 3
      if (grade >= 1) {
        todayPoolReviewedAt = nowIso;
      }
      // THEO YÊU CẦU USER: "Không làm giảm số lượng ở mục Đến hạn ôn hôm nay"
      // Ta GIỮ NGUYÊN nextReviewDate của từ đó, không làm thay đổi trạng thái đến hạn của Chế độ 1!
      nextReviewDate = word?.nextReviewDate || reviewResult.nextReview;
    } else {
      // Chế độ 1 ('due_today') hoặc học thông thường:
      // Cập nhật nextReviewDate -> từ đó không còn đến hạn -> trừ khỏi Chế độ 1!
      nextReviewDate = reviewResult.nextReview;
    }

    const isReinforcement = reviewMode === 'today_learned' || (typeof reviewMode === 'string' && reviewMode.includes('reinforce'));
    const isDrill = reviewMode === 'all_learned' || (typeof reviewMode === 'string' && reviewMode.includes('drill'));

    const reviewEvent: SRSReviewEvent = {
      id: `rev_${Date.now()}_${wordId}`,
      cardId: wordId,
      rating: reviewResult.stringRating,
      grade: reviewResult.sm2Grade,
      algorithm: currentAlgorithm,
      timestamp: nowIso,
      stateBefore: reviewResult.stateBefore,
      stateAfter: reviewResult.stateAfter,
      interval: reviewResult.intervalDays,
      stability: reviewResult.updatedFsrsState?.stability,
      difficulty: reviewResult.updatedFsrsState?.difficulty,
      retrievability: reviewResult.retrievability,
      reviewMode: typeof reviewMode === 'string' ? reviewMode : undefined,
      isReinforcement,
      isDrill,
    };
    const updatedRecentEvents = [reviewEvent, ...(state.recentReviewEvents || [])].slice(0, 200);

    const newProgress: SRSProgress = {
      srsLevel: reviewResult.updatedSm2Progress?.srsLevel ?? baseSrsLevel + 1,
      nextReviewDate,
      interval: reviewResult.intervalDays,
      easeFactor: reviewResult.updatedSm2Progress?.easeFactor ?? baseEaseFactor,
      firstLearnedAt,
      lastReviewedDate: nowIso,
      todayNewReviewedAt,
      todayPoolReviewedAt,
      isFavorite: word?.isFavorite || existingProgress?.isFavorite || false,
      fsrs: reviewResult.updatedFsrsState,
      againCount: (existingProgress?.againCount || (word ? word.againCount : 0) || 0) + (reviewResult.sm2Grade === 0 ? 1 : 0),
      reviewCount: (existingProgress?.reviewCount ?? (word ? word.reviewCount : 0) ?? 0) + 1,
    };

    const today = getVietnamDateString();
    const currentDaily = state.dailyHistory[today] || {
      date: today,
      wordsReviewed: 0,
      newWordsLearned: 0,
      quizzesCompleted: 0,
      pronunciationsMastered: 0,
      xpGained: 0,
    };

    const updatedDaily: DailyProgress = {
      ...currentDaily,
      wordsReviewed: isActuallyNewWord ? currentDaily.wordsReviewed : currentDaily.wordsReviewed + 1,
      newWordsLearned: isActuallyNewWord ? currentDaily.newWordsLearned + 1 : currentDaily.newWordsLearned,
      againCount: (currentDaily.againCount || 0) + (reviewResult.sm2Grade === 0 ? 1 : 0),
      hardCount: (currentDaily.hardCount || 0) + (reviewResult.sm2Grade === 1 ? 1 : 0),
      goodCount: (currentDaily.goodCount || 0) + (reviewResult.sm2Grade === 2 ? 1 : 0),
      easyCount: (currentDaily.easyCount || 0) + (reviewResult.sm2Grade === 3 ? 1 : 0),
    };

    if (word) {
      const updatedWord: VocabWord = {
        ...word,
        ...newProgress,
      };

      // TỰ ĐỘNG GHI NHẬN VÀO SỔ BẪY LỖI KHI BẤM AGAIN (0) HOẶC SỬA LỖI (2, 3)
      if (grade === 0) {
        get().recordMistake(word, 'flashcard', {
          type: 'meaning',
          idempotencyKey: `idemp_mistake_review_${reviewEvent.id}`,
        });
      } else if (grade >= 2) {
        get().recordMistakeCorrect(word.id);
        get().recordMistakeCorrect(word.word);
      }

      set((currentState) => {
        const wordIdx = currentState.vocabularyList.findIndex((v) => v.id === wordId);
        let nextVocabList = currentState.vocabularyList;
        if (wordIdx !== -1) {
          nextVocabList = [...currentState.vocabularyList];
          nextVocabList[wordIdx] = updatedWord;
        }

        return {
          srsProgressMap: {
            ...currentState.srsProgressMap,
            [wordId]: newProgress,
          },
          vocabularyList: nextVocabList,
          dailyHistory: {
            ...currentState.dailyHistory,
            [today]: updatedDaily,
          },
          recentReviewEvents: updatedRecentEvents,
        };
      });
    } else {
      // Collocation item
      set((currentState) => ({
        srsProgressMap: {
          ...currentState.srsProgressMap,
          [wordId]: newProgress,
        },
        dailyHistory: {
          ...currentState.dailyHistory,
          [today]: updatedDaily,
        },
        recentReviewEvents: updatedRecentEvents,
      }));
    }

    const xpReward = grade === 3 ? 15 : grade === 2 ? 10 : grade === 1 ? 5 : 2;
    get().gainXP(xpReward, {
      source: 'flashcard',
      idempotencyKey: reviewEvent.id,
      metadata: {
        isDue: reviewMode === 'due_today' || (!reviewMode && (cardForReview.nextReviewDate ? new Date(cardForReview.nextReviewDate).getTime() <= Date.now() : true)),
        isNew: isActuallyNewWord,
        wordId,
      },
    });

    // Phase 5: Emit Domain Event for review_card
    // Executed only AFTER local review logic (FSRS/SM-2, XP, Mistake Bank) has safely committed.
    emitReviewCardEvent({
      cardId: wordId,
      wordText: word ? word.word : wordId,
      grade,
      rating: reviewResult.stringRating,
      algorithm: currentAlgorithm,
      reviewMode: typeof reviewMode === 'string' ? reviewMode : undefined,
      intervalBefore: baseInterval,
      intervalAfter: reviewResult.intervalDays,
      repetitionBefore: baseSrsLevel,
      repetitionAfter: reviewResult.updatedSm2Progress?.srsLevel ?? baseSrsLevel + 1,
      easeFactorBefore: baseEaseFactor,
      easeFactorAfter: reviewResult.updatedSm2Progress?.easeFactor ?? baseEaseFactor,
      stability: reviewResult.updatedFsrsState?.stability,
      difficulty: reviewResult.updatedFsrsState?.difficulty,
      retrievability: reviewResult.retrievability,
      nextReviewDate,
      occurredAt: nowIso,
      idempotencyKey: reviewEvent.id,
    });

    // Bắt buộc lập lịch cloud sync để bảo toàn tiến trình ôn tập và chỉ số Leaderboard
    // ngay cả khi XP bị chặn bởi cơ chế giới hạn anti-spam
    scheduleCloudSync(1500);
  },
});
