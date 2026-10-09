import { describe, it, expect, beforeEach } from 'vitest';
import { getDistractorMeanings } from '../quizDistractorEngine';
import { useAppStore } from '../../store/useAppStore';
import { VocabWord } from '../../types';

describe('Fallback Distractor Engine & Quiz Arena Source Tests', () => {
  beforeEach(() => {
    useAppStore.setState({
      mistakeBank: {},
      vocabularyList: [
        {
          id: 'v1',
          word: 'ubiquitous',
          ipa: '/juːˈbɪk.wə.təs/',
          partOfSpeech: 'adjective',
          meaning: 'có mặt ở khắp nơi',
          example: 'Smartphones are ubiquitous nowadays.',
          tag: 'Academic',
          srsLevel: 0,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        },
        {
          id: 'v2',
          word: 'resilient',
          ipa: '/rɪˈzɪl.jənt/',
          partOfSpeech: 'adjective',
          meaning: 'kiên cường, mau phục hồi',
          example: 'She is very resilient under pressure.',
          tag: 'Daily',
          srsLevel: 0,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        },
        {
          id: 'v3',
          word: 'pragmatic',
          ipa: '/præɡˈmæt.ɪk/',
          partOfSpeech: 'adjective',
          meaning: 'thực tế, thực dụng',
          example: 'We need a pragmatic solution.',
          tag: 'Business',
          srsLevel: 0,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        },
        {
          id: 'v4',
          word: 'meticulous',
          ipa: '/məˈtɪk.jə.ləs/',
          partOfSpeech: 'adjective',
          meaning: 'tỉ mỉ, cẩn thận',
          example: 'He is meticulous in his work.',
          tag: 'Academic',
          srsLevel: 0,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        },
        {
          id: 'v5',
          word: 'ambiguous',
          ipa: '/æmˈbɪɡ.ju.əs/',
          partOfSpeech: 'adjective',
          meaning: 'mơ hồ, đa nghĩa',
          example: 'The statement was ambiguous.',
          tag: 'IELTS',
          srsLevel: 0,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        },
      ],
    });
  });

  const mockTarget: VocabWord = {
    id: 'target_1',
    word: 'ubiquitous',
    ipa: '/juːˈbɪk.wə.təs/',
    partOfSpeech: 'adjective',
    meaning: 'có mặt ở khắp nơi',
    example: 'Smartphones are ubiquitous nowadays.',
    tag: 'Academic',
    srsLevel: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
  };

  it('1. Trích xuất đủ 3 đáp án sai khi primaryPool có đủ từ', () => {
    const primaryPool: VocabWord[] = [
      mockTarget,
      {
        id: 'p2',
        word: 'resilient',
        ipa: '',
        partOfSpeech: 'adj',
        meaning: 'kiên cường',
        example: '',
        tag: 'Daily',
        srsLevel: 0,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: '',
      },
      {
        id: 'p3',
        word: 'pragmatic',
        ipa: '',
        partOfSpeech: 'adj',
        meaning: 'thực tế',
        example: '',
        tag: 'Business',
        srsLevel: 0,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: '',
      },
      {
        id: 'p4',
        word: 'meticulous',
        ipa: '',
        partOfSpeech: 'adj',
        meaning: 'tỉ mỉ',
        example: '',
        tag: 'Academic',
        srsLevel: 0,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: '',
      },
    ];

    const distractors = getDistractorMeanings(mockTarget, primaryPool, [], 3);
    expect(distractors).toHaveLength(3);
    expect(distractors).not.toContain('có mặt ở khắp nơi');
    // Đảm bảo không trùng nhau
    const unique = new Set(distractors);
    expect(unique.size).toBe(3);
  });

  it('2. Fallback sang secondaryPool khi primaryPool bị thiếu số lượng từ', () => {
    // Primary pool chỉ có duy nhất 1 từ khác (thiếu 2 distractors)
    const primaryPool: VocabWord[] = [
      mockTarget,
      {
        id: 'p2',
        word: 'resilient',
        ipa: '',
        partOfSpeech: 'adj',
        meaning: 'kiên cường',
        example: '',
        tag: 'Daily',
        srsLevel: 0,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: '',
      },
    ];

    const secondaryPool: VocabWord[] = [
      {
        id: 's1',
        word: 'pragmatic',
        ipa: '',
        partOfSpeech: 'adj',
        meaning: 'thực tế',
        example: '',
        tag: 'Business',
        srsLevel: 0,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: '',
      },
      {
        id: 's2',
        word: 'meticulous',
        ipa: '',
        partOfSpeech: 'adj',
        meaning: 'tỉ mỉ',
        example: '',
        tag: 'Academic',
        srsLevel: 0,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: '',
      },
      {
        id: 's3',
        word: 'ambiguous',
        ipa: '',
        partOfSpeech: 'adj',
        meaning: 'mơ hồ',
        example: '',
        tag: 'IELTS',
        srsLevel: 0,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: '',
      },
    ];

    const distractors = getDistractorMeanings(mockTarget, primaryPool, secondaryPool, 3);
    expect(distractors).toHaveLength(3);
    expect(distractors).not.toContain('có mặt ở khắp nơi');
    expect(new Set(distractors).size).toBe(3);
  });

  it('3. Tuyệt đối không bao giờ chứa nghĩa của từ mục tiêu kể cả khi có trong secondaryPool', () => {
    const primaryPool: VocabWord[] = [mockTarget];
    const secondaryPool: VocabWord[] = [
      mockTarget, // Cùng từ và cùng nghĩa
      {
        id: 'dup_meaning',
        word: 'all_over',
        ipa: '',
        partOfSpeech: 'adv',
        meaning: 'có mặt ở khắp nơi', // Trùng nghĩa mục tiêu
        example: '',
        tag: 'Daily',
        srsLevel: 0,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: '',
      },
      {
        id: 'valid_1',
        word: 'word1',
        ipa: '',
        partOfSpeech: 'n',
        meaning: 'nghĩa phương án 1',
        example: '',
        tag: 'Daily',
        srsLevel: 0,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: '',
      },
      {
        id: 'valid_2',
        word: 'word2',
        ipa: '',
        partOfSpeech: 'n',
        meaning: 'nghĩa phương án 2',
        example: '',
        tag: 'Daily',
        srsLevel: 0,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: '',
      },
      {
        id: 'valid_3',
        word: 'word3',
        ipa: '',
        partOfSpeech: 'n',
        meaning: 'nghĩa phương án 3',
        example: '',
        tag: 'Daily',
        srsLevel: 0,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: '',
      },
    ];

    const distractors = getDistractorMeanings(mockTarget, primaryPool, secondaryPool, 3);
    expect(distractors).toHaveLength(3);
    expect(distractors).not.toContain('có mặt ở khắp nơi');
    expect(distractors).toContain('nghĩa phương án 1');
    expect(distractors).toContain('nghĩa phương án 2');
    expect(distractors).toContain('nghĩa phương án 3');
  });

  it('4. Kiểm tra ngưỡng Empty State: < 4 từ bẫy lỗi chưa giải quyết', () => {
    const store = useAppStore.getState();

    // Ban đầu không có lỗi nào
    expect(store.getUnresolvedMistakeWords()).toHaveLength(0);

    // Ghi 3 lỗi (< 4 từ)
    store.recordMistake({ word: 'word1', meaning: 'nghĩa 1' }, 'quiz');
    store.recordMistake({ word: 'word2', meaning: 'nghĩa 2' }, 'quiz');
    store.recordMistake({ word: 'word3', meaning: 'nghĩa 3' }, 'quiz');

    const unresolvedBefore = useAppStore.getState().getUnresolvedMistakeWords();
    expect(unresolvedBefore.length).toBe(3);
    expect(unresolvedBefore.length < 4).toBe(true); // Kích hoạt Empty State

    // Thêm lỗi thứ 4
    store.recordMistake({ word: 'word4', meaning: 'nghĩa 4' }, 'quiz');
    const unresolvedAfter = useAppStore.getState().getUnresolvedMistakeWords();
    expect(unresolvedAfter.length).toBe(4);
    expect(unresolvedAfter.length >= 4).toBe(true); // Đủ điều kiện chơi Phục Thù Bẫy Lỗi
  });
});
