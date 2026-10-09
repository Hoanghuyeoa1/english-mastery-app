import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../useAppStore';
import type { VocabWord, CollocationItem, MistakeRecord, FourSkillsScores, FSRSMemoryState } from '../../types';

describe('useAppStore.mergeCloudData - 8 Conflict Resolution Scenarios Audit', () => {
  beforeEach(() => {
    // Reset Zustand store state to pristine default before each test case
    useAppStore.getState().resetToDefault();
    vi.restoreAllMocks();
  });

  // Scenario 1: Empty / Undefined Cloud Payload
  it('1. Empty / Undefined Cloud: should preserve local state 100% without throwing runtime errors', () => {
    // Setup initial local state
    useAppStore.setState({
      profile: {
        ...useAppStore.getState().profile,
        name: 'Local Hero',
        xp: 350,
        streak: 4,
      },
      hasLearnedNightOwl: true,
    });

    // Test with undefined
    expect(() => useAppStore.getState().mergeCloudData(undefined as any)).not.toThrow();
    expect(useAppStore.getState().profile.name).toBe('Local Hero');
    expect(useAppStore.getState().profile.xp).toBe(350);
    expect(useAppStore.getState().profile.streak).toBe(4);
    expect(useAppStore.getState().hasLearnedNightOwl).toBe(true);

    // Test with null
    expect(() => useAppStore.getState().mergeCloudData(null as any)).not.toThrow();
    expect(useAppStore.getState().profile.name).toBe('Local Hero');
    expect(useAppStore.getState().profile.xp).toBe(350);

    // Test with empty object {}
    expect(() => useAppStore.getState().mergeCloudData({})).not.toThrow();
    expect(useAppStore.getState().profile.name).toBe('Local Hero');
    expect(useAppStore.getState().profile.xp).toBe(350);
    expect(useAppStore.getState().profile.streak).toBe(4);
    expect(useAppStore.getState().hasLearnedNightOwl).toBe(true);
  });

  // Scenario 2: Fresh Install (Local empty)
  it('2. Fresh Install (Local rỗng): should load all cloud data (profile, SRS, words, collocations)', () => {
    // Local starts at pristine default
    expect(useAppStore.getState().profile.name).toBe('');
    expect(useAppStore.getState().userCustomWords).toHaveLength(0);
    expect(useAppStore.getState().userCollocations).toHaveLength(0);

    const cloudPayload = {
      cloudProfile: {
        id: 'usr_cloud_123',
        display_name: 'Minh Chau',
        level: 6,
        xp: 1200,
        streak: 14,
        has_learned_night_owl: true,
      },
      cloudSrsList: [
        {
          word_id: 'apple',
          repetition: 4,
          interval: 12,
          ease_factor: 2.6,
          next_review_date: '2026-10-15T00:00:00.000Z',
          is_favorite: true,
        },
      ],
      cloudCustomWords: [
        {
          id: 'cust_w1',
          word: 'Serendipity',
          meaning: 'Sự tình cờ may mắn',
          partOfSpeech: 'noun',
          example: 'Finding this was pure serendipity.',
          tag: 'Daily',
          srsLevel: 1,
          interval: 2,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-06T00:00:00.000Z',
        } as VocabWord,
      ],
      cloudCollocations: [
        {
          id: 'colloc_1',
          phrase: 'make headway',
          meaning: 'tiến bộ, đạt được bước tiến',
          exampleEn: 'We are making good headway with the project.',
          exampleVi: 'Chúng tôi đang đạt được bước tiến tốt với dự án.',
          createdAt: '2026-10-04T00:00:00.000Z',
        } as CollocationItem,
      ],
    };

    useAppStore.getState().mergeCloudData(cloudPayload);

    const state = useAppStore.getState();
    expect(state.profile.name).toBe('Minh Chau');
    expect(state.profile.xp).toBe(1200);
    expect(state.profile.streak).toBe(14);
    expect(state.profile.isOnboarded).toBe(true);
    expect(state.hasLearnedNightOwl).toBe(true);

    // SRS progress
    expect(state.srsProgressMap['apple']).toBeDefined();
    expect(state.srsProgressMap['apple'].srsLevel).toBe(4);
    expect(state.srsProgressMap['apple'].interval).toBe(12);
    expect(state.srsProgressMap['apple'].isFavorite).toBe(true);

    // Words & collocations loaded
    expect(state.userCustomWords).toHaveLength(1);
    expect(state.userCustomWords[0].word).toBe('Serendipity');
    expect(state.userCollocations).toHaveLength(1);
    expect(state.userCollocations[0].phrase).toBe('make headway');
  });

  // Scenario 3: Profile Conflict Resolution
  it('3. Profile Conflict Resolution: should take max(xp), max(streak) and preserve local secret API key', () => {
    // Setup Local state
    useAppStore.setState({
      profile: {
        ...useAppStore.getState().profile,
        name: 'Hoang Local',
        xp: 1500,
        streak: 10,
        geminiApiKey: 'local_secret_key',
      },
    });

    // Cloud has higher XP, lower streak, empty API key
    const cloudPayload = {
      cloudProfile: {
        id: 'usr_abc',
        display_name: 'Hoang Cloud',
        level: 3,
        xp: 2000,
        streak: 5,
        geminiApiKey: '',
      },
    };

    useAppStore.getState().mergeCloudData(cloudPayload);

    const state = useAppStore.getState();
    // Expected: xp = max(1500, 2000) = 2000
    expect(state.profile.xp).toBe(2000);
    // Expected: streak = max(10, 5) = 10
    expect(state.profile.streak).toBe(10);
    // Expected: geminiApiKey must preserve local key
    expect(state.profile.geminiApiKey).toBe('local_secret_key');
  });

  // Scenario 4: Custom Words & Collocations Deduplication
  it('4. Custom Words & Collocations Deduplication: should union lists by ID and normalized text without duplicate entries', () => {
    const existingWord: VocabWord = {
      id: 'cust_w1',
      word: 'Resilience',
      ipa: '/rɪˈzɪl.jəns/',
      phonetic: '/rɪˈzɪl.jəns/',
      meaning: 'Sự kiên cường',
      partOfSpeech: 'noun',
      example: 'Her resilience was admirable.',
      tag: 'Academic',
      srsLevel: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReviewDate: '2026-10-04T00:00:00.000Z',
    };

    const existingColloc: CollocationItem = {
      id: 'colloc_1',
      phrase: 'break a leg',
      meaning: 'Chúc may mắn',
      exampleEn: 'Break a leg tonight!',
      exampleVi: 'Chúc may mắn tối nay nhé!',
      createdAt: '2026-10-01T00:00:00.000Z',
    };

    useAppStore.setState({
      userCustomWords: [existingWord],
      userCollocations: [existingColloc],
    });

    const cloudPayload = {
      cloudCustomWords: [
        // Duplicate by ID
        { ...existingWord },
        // Duplicate by normalized word (" resilience ")
        {
          id: 'cust_w_dup',
          word: '  resilience  ',
          meaning: 'Khả năng phục hồi',
          partOfSpeech: 'noun',
          example: 'Resilience in tough times.',
          tag: 'Academic',
          srsLevel: 1,
          interval: 2,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-05T00:00:00.000Z',
        } as VocabWord,
        // Genuine new word
        {
          id: 'cust_w2',
          word: 'Perseverance',
          meaning: 'Sự kiên trì',
          partOfSpeech: 'noun',
          example: 'Perseverance leads to success.',
          tag: 'Academic',
          srsLevel: 0,
          interval: 0,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-04T00:00:00.000Z',
        } as VocabWord,
      ],
      cloudCollocations: [
        // Duplicate by ID
        { ...existingColloc },
        // Duplicate by case-insensitive phrase
        {
          id: 'colloc_dup',
          phrase: 'Break A Leg',
          meaning: 'May mắn nhé',
          exampleEn: 'Break a leg!',
          exampleVi: 'May mắn nhé!',
          createdAt: '2026-10-02T00:00:00.000Z',
        } as CollocationItem,
        // Genuine new collocation
        {
          id: 'colloc_2',
          phrase: 'piece of cake',
          meaning: 'Dễ như ăn kẹo',
          exampleEn: 'The test was a piece of cake.',
          exampleVi: 'Bài thi dễ như ăn kẹo.',
          createdAt: '2026-10-04T00:00:00.000Z',
        } as CollocationItem,
      ],
    };

    useAppStore.getState().mergeCloudData(cloudPayload);

    const state = useAppStore.getState();
    // Custom words must contain exactly 2 unique items
    expect(state.userCustomWords).toHaveLength(2);
    const wordNames = state.userCustomWords.map((w) => w.word.toLowerCase().trim());
    expect(wordNames).toContain('resilience');
    expect(wordNames).toContain('perseverance');

    // Collocations must contain exactly 2 unique items
    expect(state.userCollocations).toHaveLength(2);
    const phrases = state.userCollocations.map((c) => c.phrase.toLowerCase().trim());
    expect(phrases).toContain('break a leg');
    expect(phrases).toContain('piece of cake');
  });

  // Scenario 5: SRS Progress Map Reconcile
  it('5. SRS Progress Map Reconcile: should prioritize record with higher srsLevel or longer interval', () => {
    useAppStore.setState({
      srsProgressMap: {
        // Local has lower srsLevel
        word_lower_level: {
          srsLevel: 2,
          interval: 4,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-08T00:00:00.000Z',
          lastReviewedDate: '2026-10-04T00:00:00.000Z',
          isFavorite: false,
        },
        // Local has same srsLevel but longer interval
        word_longer_interval: {
          srsLevel: 3,
          interval: 15,
          easeFactor: 2.6,
          nextReviewDate: '2026-10-19T00:00:00.000Z',
          lastReviewedDate: '2026-10-04T00:00:00.000Z',
          isFavorite: true,
        },
        // Local has higher srsLevel than cloud
        word_higher_level: {
          srsLevel: 5,
          interval: 30,
          easeFactor: 2.8,
          nextReviewDate: '2026-11-04T00:00:00.000Z',
          lastReviewedDate: '2026-10-04T00:00:00.000Z',
          isFavorite: false,
        },
      },
    });

    const cloudPayload = {
      cloudSrsList: [
        // Cloud has higher srsLevel (3 > 2) -> Cloud wins
        {
          word_id: 'word_lower_level',
          repetition: 3,
          interval: 10,
          ease_factor: 2.7,
          next_review_date: '2026-10-14T00:00:00.000Z',
          is_favorite: true,
        },
        // Cloud has same srsLevel (3 == 3) but shorter interval (5 < 15) -> Local wins
        {
          word_id: 'word_longer_interval',
          repetition: 3,
          interval: 5,
          ease_factor: 2.5,
          next_review_date: '2026-10-09T00:00:00.000Z',
          is_favorite: false,
        },
        // Cloud has lower srsLevel (2 < 5) -> Local wins
        {
          word_id: 'word_higher_level',
          repetition: 2,
          interval: 6,
          ease_factor: 2.4,
          next_review_date: '2026-10-10T00:00:00.000Z',
          is_favorite: false,
        },
      ],
    };

    useAppStore.getState().mergeCloudData(cloudPayload);

    const srs = useAppStore.getState().srsProgressMap;

    // Word 1: Cloud won
    expect(srs['word_lower_level'].srsLevel).toBe(3);
    expect(srs['word_lower_level'].interval).toBe(10);
    expect(srs['word_lower_level'].isFavorite).toBe(true);

    // Word 2: Local won (retained interval 15)
    expect(srs['word_longer_interval'].srsLevel).toBe(3);
    expect(srs['word_longer_interval'].interval).toBe(15);
    expect(srs['word_longer_interval'].isFavorite).toBe(true);

    // Word 3: Local won (retained level 5, interval 30)
    expect(srs['word_higher_level'].srsLevel).toBe(5);
    expect(srs['word_higher_level'].interval).toBe(30);
  });

  // Scenario 6: Mistake Bank Resolution
  it('6. Mistake Bank Resolution: should prioritize resolved: true when local is false and cloud is true', () => {
    useAppStore.setState({
      mistakeBank: {
        accommodate: {
          id: 'mistake_accommodate',
          word: 'accommodate',
          meaning: 'cung cấp chỗ ở',
          consecutiveCorrect: 0,
          wrongCount: 3,
          resolved: false,
        } as MistakeRecord,
        necessary: {
          id: 'mistake_necessary',
          word: 'necessary',
          meaning: 'cần thiết',
          consecutiveCorrect: 2,
          wrongCount: 2,
          resolved: true,
          resolvedDate: '2026-10-02T00:00:00.000Z',
        } as MistakeRecord,
      },
    });

    const cloudPayload = {
      cloudMistakeBank: {
        // Cloud resolved accommodate!
        accommodate: {
          id: 'mistake_accommodate',
          word: 'accommodate',
          meaning: 'cung cấp chỗ ở',
          consecutiveCorrect: 2,
          wrongCount: 3,
          resolved: true,
          resolvedDate: '2026-10-03T12:00:00.000Z',
        } as MistakeRecord,
        // Cloud has not resolved necessary (outdated snapshot)
        necessary: {
          id: 'mistake_necessary',
          word: 'necessary',
          meaning: 'cần thiết',
          consecutiveCorrect: 0,
          wrongCount: 2,
          resolved: false,
        } as MistakeRecord,
      },
    };

    useAppStore.getState().mergeCloudData(cloudPayload);

    const bank = useAppStore.getState().mistakeBank;

    // Both should be resolved: true!
    expect(bank['accommodate'].resolved).toBe(true);
    expect(bank['accommodate'].consecutiveCorrect).toBe(2);

    expect(bank['necessary'].resolved).toBe(true);
  });

  // Scenario 7: Four Skills Scores Merge
  it('7. Four Skills Scores Merge: should safely merge score arrays without overwriting with empty arrays when cloud lacks data', () => {
    const initialScores: FourSkillsScores = {
      listening: [75, 80],
      reading: [90],
      speaking: [65, 70],
      writing: [85],
    };

    useAppStore.setState({ fourSkillsScores: initialScores });

    // Cloud has only new listening score; reading, speaking, writing are omitted/empty
    const cloudPayload = {
      cloudProfile: {
        id: 'usr_789',
        display_name: 'Test Learner',
        four_skills_scores: {
          listening: [85, 90],
          // reading, speaking, writing omitted
        } as any,
      },
    };

    useAppStore.getState().mergeCloudData(cloudPayload);

    const scores = useAppStore.getState().fourSkillsScores;

    // Listening must combine local and cloud scores
    expect(scores.listening).toEqual([75, 80, 85, 90]);
    // Other skills must NOT be overwritten with []
    expect(scores.reading).toEqual([90]);
    expect(scores.speaking).toEqual([65, 70]);
    expect(scores.writing).toEqual([85]);
  });

  // Scenario 8: Corrupted / Partial Payload Resilience
  it('8. Corrupted / Partial Payload Resilience: should catch malformed anomalies, log warning and not crash the app', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Set stable local profile
    useAppStore.setState({
      profile: {
        ...useAppStore.getState().profile,
        name: 'Stable User',
        xp: 800,
      },
    });

    const corruptedPayloads = [
      // 1. Primitive string instead of object
      'totally_broken_json_string',
      // 2. Corrupted fields: srs as string, profile as null, dailyLogs as number
      {
        cloudProfile: null,
        cloudSrsList: 'not_an_array_of_srs',
        cloudDailyLogs: 12345,
        four_skills_scores: 'corrupted_scores',
      },
      // 3. Object with corrupted internal items
      {
        cloudProfile: { xp: 'not_a_number' as any, streak: NaN },
        cloudSrsList: [null, undefined, { invalid_item: true }],
        cloudCustomWords: [null, 'invalid_word' as any],
        cloudCollocations: ['invalid_colloc' as any],
        cloudMistakeBank: 'invalid_bank' as any,
      },
    ];

    for (const badPayload of corruptedPayloads) {
      expect(() => {
        useAppStore.getState().mergeCloudData(badPayload as any);
      }).not.toThrow();
    }

    // Ensure store is still functional and local data is healthy
    const state = useAppStore.getState();
    expect(state.profile.name).toBe('Stable User');
    expect(state.profile.xp).toBe(800);
    expect(typeof state.profile.streak).toBe('number');

    warnSpy.mockRestore();
  });

  // Scenario 9: FSRS Memory State Reconciliation
  it('9. FSRS Memory State Reconciliation: should preserve and reconcile FSRS memory state without breaking SM-2 progress', () => {
    const localFsrs: FSRSMemoryState = {
      stability: 4.5,
      difficulty: 5.1,
      state: 2,
      reps: 2,
      lapses: 0,
      lastReview: '2026-10-01T00:00:00.000Z',
    };

    useAppStore.setState({
      srsProgressMap: {
        card_local_fsrs: {
          srsLevel: 2,
          interval: 5,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-06T00:00:00.000Z',
          fsrs: localFsrs,
        },
        card_sm2_only: {
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-05T00:00:00.000Z',
        },
      },
    });

    const cloudFsrsAdv: FSRSMemoryState = {
      stability: 12.0,
      difficulty: 4.2,
      state: 2,
      reps: 5,
      lapses: 0,
      lastReview: '2026-10-03T00:00:00.000Z',
    };

    const cloudPayload = {
      cloudSrsList: [
        // 1. Upgrades card_sm2_only with cloud FSRS data
        {
          word_id: 'card_sm2_only',
          repetition: 4,
          interval: 10,
          ease_factor: 2.6,
          fsrs: cloudFsrsAdv,
        },
        // 2. Cloud record for card_local_fsrs with lower progress: local should win and keep localFsrs
        {
          word_id: 'card_local_fsrs',
          repetition: 1,
          interval: 1,
          ease_factor: 2.4,
          fsrs: {
            stability: 1.0,
            difficulty: 6.0,
            state: 1,
            reps: 1,
            lapses: 0,
            lastReview: '2026-09-30T00:00:00.000Z',
          },
        },
      ],
    };

    useAppStore.getState().mergeCloudData(cloudPayload);

    const srsMap = useAppStore.getState().srsProgressMap;

    // card_sm2_only should now have cloud's higher reps and FSRS state
    expect(srsMap['card_sm2_only'].srsLevel).toBe(4);
    expect(srsMap['card_sm2_only'].interval).toBe(10);
    expect(srsMap['card_sm2_only'].fsrs?.reps).toBe(5);
    expect(srsMap['card_sm2_only'].fsrs?.stability).toBe(12.0);

    // card_local_fsrs should preserve local superior progress
    expect(srsMap['card_local_fsrs'].srsLevel).toBe(2);
    expect(srsMap['card_local_fsrs'].interval).toBe(5);
    expect(srsMap['card_local_fsrs'].fsrs?.reps).toBe(2);
    expect(srsMap['card_local_fsrs'].fsrs?.stability).toBe(4.5);
  });

  // Scenario 10: Algorithm Preference & FSRS Settings Merge
  it('10. Algorithm Preference & FSRS Settings: should merge algorithm choice and settings from cloud', () => {
    expect(useAppStore.getState().srsAlgorithm).toBe('sm2');

    useAppStore.getState().mergeCloudData({
      srsAlgorithm: 'fsrs',
      fsrsSettings: {
        desiredRetention: 0.85,
        maximumInterval: 7300,
      },
    });

    const state = useAppStore.getState();
    expect(state.srsAlgorithm).toBe('fsrs');
    expect(state.fsrsSettings.desiredRetention).toBe(0.85);
    expect(state.fsrsSettings.maximumInterval).toBe(7300);
    // 17 weights should remain intact
    expect(state.fsrsSettings.w).toHaveLength(17);
  });
});
