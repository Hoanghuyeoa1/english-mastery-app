import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../useAppStore';

describe('useAppStore - SRS Review & Algorithm Switching Integration', () => {
  beforeEach(() => {
    useAppStore.getState().resetToDefault();
  });

  it('reviews words with default SM-2 algorithm correctly', () => {
    const store = useAppStore.getState();
    expect(store.srsAlgorithm).toBe('sm2');

    // Add a custom word to review
    store.addCustomWord({
      word: 'Ephemeral',
      ipa: '/ɪˈfem.ər.əl/',
      partOfSpeech: 'adjective',
      meaning: 'Phù du, chóng tàn',
      example: 'Fashions are ephemeral.',
      tag: 'Academic',
    });

    const addedWord = useAppStore.getState().userCustomWords[0];
    expect(addedWord).toBeDefined();

    // Perform review with grade 2 (Good)
    useAppStore.getState().processReview(addedWord.id, 2);

    const progress = useAppStore.getState().srsProgressMap[addedWord.id];
    expect(progress).toBeDefined();
    expect(progress.srsLevel).toBe(1);
    expect(progress.interval).toBe(1);
    expect(progress.easeFactor).toBe(2.5);
    expect(progress.nextReviewDate).toBeDefined();
  });

  it('reviews words with FSRS algorithm and creates FSRS memory state', () => {
    // Switch algorithm to FSRS
    useAppStore.getState().setSRSAlgorithm('fsrs');
    expect(useAppStore.getState().srsAlgorithm).toBe('fsrs');

    // Add a custom word
    useAppStore.getState().addCustomWord({
      word: 'Tenacious',
      ipa: '/təˈneɪ.ʃəs/',
      partOfSpeech: 'adjective',
      meaning: 'Kiên trì, dai dẳng',
      example: 'She is a tenacious advocate.',
      tag: 'Daily',
    });

    const addedWord = useAppStore.getState().userCustomWords[0];
    expect(addedWord).toBeDefined();

    // Perform review with grade 2 (Good)
    useAppStore.getState().processReview(addedWord.id, 2);

    const progress = useAppStore.getState().srsProgressMap[addedWord.id];
    expect(progress).toBeDefined();
    expect(progress.fsrs).toBeDefined();
    expect(progress.fsrs?.state).toBe(2); // Graduated to Review
    expect(progress.fsrs?.reps).toBe(1);
    expect(progress.fsrs?.stability).toBeCloseTo(3.7145, 2);
    expect(progress.interval).toBe(4);
    expect(progress.nextReviewDate).toBeDefined();
  });

  it('ensures partialize storage payload remains strictly lightweight (< 1.5MB)', () => {
    // Generate some state
    useAppStore.getState().setSRSAlgorithm('fsrs');
    useAppStore.getState().addCustomWord({
      word: 'Ubiquitous',
      ipa: '/juːˈbɪk.wɪ.təs/',
      partOfSpeech: 'adjective',
      meaning: 'Phổ biến, ở khắp mọi nơi',
      example: 'Smartphones are ubiquitous.',
      tag: 'Academic',
    });

    const state = useAppStore.getState();
    const serialized = JSON.stringify({
      profile: state.profile,
      userCustomWords: state.userCustomWords,
      userCollocations: state.userCollocations,
      srsProgressMap: state.srsProgressMap,
      mistakeBank: state.mistakeBank,
      dailyHistory: state.dailyHistory,
      achievements: state.achievements,
      srsAlgorithm: state.srsAlgorithm,
      fsrsSettings: state.fsrsSettings,
    });

    const sizeInBytes = new Blob([serialized]).size;
    const sizeInKb = sizeInBytes / 1024;

    // Must be well under 1500 KB (1.5 MB)
    expect(sizeInKb).toBeLessThan(100); // Usually < 5KB for normal personal state
  });

  it('ensures reviewCount and againCount strictly accumulate across repeated SM-2 Again resets', () => {
    const store = useAppStore.getState();
    expect(store.srsAlgorithm).toBe('sm2');

    store.addCustomWord({
      word: 'Resilient',
      ipa: '/rɪˈzɪl.jənt/',
      partOfSpeech: 'adj',
      meaning: 'Kiên cường',
      example: 'She is resilient.',
      tag: 'Academic',
    });

    const word = useAppStore.getState().userCustomWords[0];

    // Review 1: Good (2)
    useAppStore.getState().processReview(word.id, 2);
    let prog = useAppStore.getState().srsProgressMap[word.id];
    expect(prog.reviewCount).toBe(1);
    expect(prog.againCount).toBe(0);
    expect(prog.srsLevel).toBe(1);

    // Review 2: Good (2)
    useAppStore.getState().processReview(word.id, 2);
    prog = useAppStore.getState().srsProgressMap[word.id];
    expect(prog.reviewCount).toBe(2);
    expect(prog.againCount).toBe(0);
    expect(prog.srsLevel).toBe(2);

    // Review 3: Again (0) -> srsLevel resets to 0!
    useAppStore.getState().processReview(word.id, 0);
    prog = useAppStore.getState().srsProgressMap[word.id];
    expect(prog.reviewCount).toBe(3); // reviewCount still increments!
    expect(prog.againCount).toBe(1);  // againCount increments!
    expect(prog.srsLevel).toBe(0);    // srsLevel was reset!

    // Review 4: Good (2)
    useAppStore.getState().processReview(word.id, 2);
    prog = useAppStore.getState().srsProgressMap[word.id];
    expect(prog.reviewCount).toBe(4);
    expect(prog.againCount).toBe(1);
    expect(prog.srsLevel).toBe(1);

    // Review 5: Again (0) -> srsLevel resets to 0 again!
    useAppStore.getState().processReview(word.id, 0);
    prog = useAppStore.getState().srsProgressMap[word.id];
    expect(prog.reviewCount).toBe(5);
    expect(prog.againCount).toBe(2);
    expect(prog.srsLevel).toBe(0);
  });
});
