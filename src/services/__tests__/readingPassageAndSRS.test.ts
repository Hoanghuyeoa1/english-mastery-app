import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import type { VocabWord } from '../../types';
import { extractSentenceContext, lookupContextWord } from '../wordLookupService';
import { getDictionaryWord } from '../dictionaryIndex';

describe('Phase 1: Reading -> SRS Integration & Deduplication Suite', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    useAppStore.setState({
      srsProgressMap: {},
      userCustomWords: [],
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
    });
  });

  describe('1. Reading unknown word -> Save to SRS -> word appears in Unified SRS', () => {
    it('lưu từ vựng mới chưa có trong từ điển từ Reading và từ xuất hiện ngay trong Unified SRS Deck', () => {
      const store = useAppStore.getState();
      const unknownWord: VocabWord = {
        id: 'vocab_photobiomodulation',
        word: 'photobiomodulation',
        ipa: '/ˌfoʊtoʊˌbaɪoʊˌmɑːdʒəˈleɪʃən/',
        phonetic: '/ˌfoʊtoʊˌbaɪoʊˌmɑːdʒəˈleɪʃən/',
        partOfSpeech: 'noun',
        pos: 'noun',
        meaning: 'liệu pháp ánh sáng sinh học',
        example: 'Photobiomodulation promotes cellular repair and reduces inflammation.',
        exampleEn: 'Photobiomodulation promotes cellular repair and reduces inflammation.',
        tag: 'Daily',
        srsLevel: 0,
        interval: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
      };

      store.saveToSRS(unknownWord);

      const stateAfter = useAppStore.getState();
      // srsProgressMap có bản ghi
      expect(stateAfter.srsProgressMap['vocab_photobiomodulation']).toBeDefined();
      expect(stateAfter.srsProgressMap['vocab_photobiomodulation'].interval).toBe(1);
      expect(stateAfter.srsProgressMap['vocab_photobiomodulation'].srsLevel).toBe(0);

      // Từ xuất hiện trong Unified SRS Deck
      const unifiedCards = stateAfter.getUnifiedSRSCards();
      const card = unifiedCards.find((c) => (c.word || c.primaryText).toLowerCase() === 'photobiomodulation');
      expect(card).toBeDefined();
      expect(card?.meaning).toBe('liệu pháp ánh sáng sinh học');
      expect(card?.exampleEn).toBe('Photobiomodulation promotes cellular repair and reduces inflammation.');
      expect(card?.srsLevel).toBe(0);
    });

    it('lưu từ vựng từ Reading có trong từ điển chuẩn và từ được map đúng canonical ID trong SRS', () => {
      const dictWord = getDictionaryWord('epiphany');
      expect(dictWord).toBeDefined();
      const canonicalId = dictWord!.id;

      useAppStore.getState().saveToSRS(dictWord!);

      const stateAfter = useAppStore.getState();
      expect(stateAfter.srsProgressMap[canonicalId]).toBeDefined();
      expect(stateAfter.srsProgressMap[canonicalId].interval).toBe(1);

      const card = stateAfter.getUnifiedSRSCards().find((c) => (c.word || c.primaryText).toLowerCase() === 'epiphany');
      expect(card).toBeDefined();
      expect(card?.id).toBe(canonicalId);
    });
  });

  describe('2. Save same word lần 2 -> không duplicate', () => {
    it('lưu cùng một từ nhiều lần (kể cả với ID khác) không sinh thêm thẻ duplicate trong Unified SRS', () => {
      const store = useAppStore.getState();
      const wordData: VocabWord = {
        id: 'vocab_serendipity',
        word: 'serendipity',
        ipa: '/ˌser.ənˈdɪp.ə.ti/',
        partOfSpeech: 'noun',
        meaning: 'sự tình cờ may mắn',
        example: 'Finding this was pure serendipity.',
        tag: 'Daily',
        srsLevel: 0,
        interval: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
      };

      // Lưu lần 1
      store.saveToSRS(wordData);
      let unifiedCards = useAppStore.getState().getUnifiedSRSCards();
      const matchingCards1 = unifiedCards.filter((c) => (c.word || c.primaryText).toLowerCase() === 'serendipity');
      expect(matchingCards1.length).toBe(1);

      // Lưu lần 2: truyền dạng string
      store.saveToSRS('serendipity');
      unifiedCards = useAppStore.getState().getUnifiedSRSCards();
      const matchingCards2 = unifiedCards.filter((c) => (c.word || c.primaryText).toLowerCase() === 'serendipity');
      expect(matchingCards2.length).toBe(1);

      // Lưu lần 3: truyền dạng object với ID khác
      store.saveToSRS({
        ...wordData,
        id: 'custom_duplicate_attempt',
      });
      unifiedCards = useAppStore.getState().getUnifiedSRSCards();
      const matchingCards3 = unifiedCards.filter((c) => (c.word || c.primaryText).toLowerCase() === 'serendipity');
      expect(matchingCards3.length).toBe(1);
    });

    it('không ghi đè tiến trình nếu từ đã có trong SRS', () => {
      useAppStore.setState({
        srsProgressMap: {
          vocab_resilient: {
            srsLevel: 3,
            interval: 12,
            easeFactor: 2.6,
            nextReviewDate: '2026-10-15T00:00:00.000Z',
            firstLearnedAt: '2026-08-01T00:00:00.000Z',
          },
        },
      });

      const store = useAppStore.getState();
      store.saveToSRS({
        id: 'vocab_resilient',
        word: 'resilient',
        ipa: '/rɪˈzɪl.i.ənt/',
        partOfSpeech: 'adjective',
        meaning: 'kiên cường',
        example: 'He is a resilient person.',
        tag: 'Daily',
        srsLevel: 0,
        interval: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
      });

      const srsEntry = useAppStore.getState().srsProgressMap['vocab_resilient'];
      expect(srsEntry.srsLevel).toBe(3);
      expect(srsEntry.interval).toBe(12);
      expect(srsEntry.easeFactor).toBe(2.6);
    });
  });

  describe('3. Saved word -> meaning đúng -> context được giữ nếu supported', () => {
    it('lưu từ vựng giữ đúng meaning từ từ điển và lưu trữ ngữ cảnh câu đang đọc trong exampleEn', () => {
      const store = useAppStore.getState();
      const passage = 'Artificial intelligence is transforming healthcare in profound ways. Doctors use neural networks to diagnose rare conditions accurately.';
      const sentenceContext = extractSentenceContext(passage, 'neural');
      expect(sentenceContext).toBe('Doctors use neural networks to diagnose rare conditions accurately.');

      const dictWord = lookupContextWord('neural') || {
        id: 'vocab_neural',
        word: 'neural',
        ipa: '/ˈnjʊə.rəl/',
        partOfSpeech: 'adjective',
        meaning: 'thuộc về hệ thần kinh',
        tag: 'Tech' as const,
        srsLevel: 0,
        interval: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
        example: sentenceContext,
      };

      store.saveToSRS(dictWord, { contextSentence: sentenceContext });

      const unifiedCards = useAppStore.getState().getUnifiedSRSCards();
      const card = unifiedCards.find((c) => (c.word || c.primaryText).toLowerCase() === 'neural');
      expect(card).toBeDefined();
      expect(card?.meaning).toBe(dictWord.meaning);
      expect(card?.exampleEn).toBe('Doctors use neural networks to diagnose rare conditions accurately.');
    });

    it('nếu từ đã có trong SRS, chỉ bổ sung context an toàn mà không làm xáo trộn tiến trình ôn tập', () => {
      useAppStore.setState({
        srsProgressMap: {
          vocab_epiphany: {
            srsLevel: 2,
            interval: 6,
            easeFactor: 2.5,
            nextReviewDate: '2026-10-10T00:00:00.000Z',
          },
        },
      });

      const store = useAppStore.getState();
      const newContext = 'The sudden breakthrough was a true epiphany for the entire lab team.';
      store.saveToSRS('epiphany', { contextSentence: newContext });

      const stateAfter = useAppStore.getState();
      // Tiến trình SRS không bị reset
      expect(stateAfter.srsProgressMap['vocab_epiphany'].srsLevel).toBe(2);
      expect(stateAfter.srsProgressMap['vocab_epiphany'].interval).toBe(6);

      // Ngữ cảnh mới được bổ sung
      const card = stateAfter.getUnifiedSRSCards().find((c) => (c.word || c.primaryText).toLowerCase() === 'epiphany');
      expect(card?.exampleEn).toBe(newContext);
    });
  });

  describe('4. Lookup word without wrong answer -> không tạo Mistake Bank entry', () => {
    it('tra cứu từ trong bài đọc (lookupContextWord) không tạo bất kỳ bản ghi nào trong Sổ Tay Bẫy Lỗi (mistakeBank)', () => {
      const store = useAppStore.getState();
      expect(Object.keys(store.mistakeBank).length).toBe(0);

      // Click tra cứu nhiều từ khác nhau
      const w1 = lookupContextWord('artificial');
      const w2 = lookupContextWord('transformation');
      const w3 = lookupContextWord('serendipity');

      expect(w1).toBeDefined();
      expect(w2).toBeDefined();

      // Lưu từ vào SRS sau khi tra cứu
      if (w1) store.saveToSRS(w1);
      if (w2) store.saveToSRS(w2);

      // mistakeBank vẫn tuyệt đối trống
      const stateAfter = useAppStore.getState();
      expect(Object.keys(stateAfter.mistakeBank).length).toBe(0);
    });
  });

  describe('5. Cross-Skill Vocabulary Identity & Canonical Deduplication', () => {
    it('cùng một từ xuất hiện từ Reading, Dictionary, Flashcard, Listening chia sẻ DUY NHẤT một canonical SRS identity', () => {
      const store = useAppStore.getState();
      const canonicalWord = getDictionaryWord('artificial');
      expect(canonicalWord).toBeDefined();
      const canonicalId = canonicalWord!.id;

      // 1. Reading: Click tra từ và Save to SRS
      store.saveToSRS(canonicalWord!);
      expect(useAppStore.getState().srsProgressMap[canonicalId]).toBeDefined();

      // 2. Dictionary: Lưu cùng từ bằng string
      store.saveToSRS('artificial');

      // 3. Listening: Lưu cùng từ với custom ID tạm thời
      store.saveToSRS({
        ...canonicalWord!,
        id: 'custom_listening_audio_word',
      });

      // 4. Flashcard: Unified Deck chỉ có đúng 1 thẻ duy nhất
      const stateAfter = useAppStore.getState();
      const cards = stateAfter.getUnifiedSRSCards().filter((c) => (c.word || c.primaryText).toLowerCase() === 'artificial');
      expect(cards.length).toBe(1);
      expect(cards[0].id).toBe(canonicalId);
    });
  });

  describe('6. Interactive Passage Tokenization & Sentence Context Extraction', () => {
    it('tách văn bản thành tokens bảo toàn mọi khoảng trắng và dấu xuống dòng \\n', () => {
      const text = 'Artificial intelligence is changing the world.\n\nIt enables innovation.';
      const tokens = text.split(/(\s+)/);

      expect(tokens).toContain('Artificial');
      expect(tokens).toContain('intelligence');
      expect(tokens).toContain('\n\n');
      expect(tokens).toContain('world.');
      expect(tokens.join('')).toBe(text);
    });

    it('extractSentenceContext trích xuất chính xác câu chứa từ kể cả khi có dấu chấm câu phức tạp', () => {
      const passage = 'Dr. Watson arrived early. Finding the missing manuscript was pure serendipity! He smiles.';
      const sentence = extractSentenceContext(passage, 'serendipity');
      expect(sentence).toBe('Finding the missing manuscript was pure serendipity!');
    });
  });

  describe('7. Hardened Canonical Vocabulary Identity Invariants', () => {
    it('1. Dictionary lưu từ trước -> Reading gặp lại từ đó: chỉ có 1 vocabulary identity và 1 SRS card', () => {
      const store = useAppStore.getState();
      const dictWord = getDictionaryWord('abandon');
      expect(dictWord).toBeDefined();
      const canonicalId = dictWord!.id;

      // Dictionary lưu trước
      store.saveToSRS(dictWord!, { meaning: 'Từ bỏ, ruồng bỏ' });
      expect(useAppStore.getState().srsProgressMap[canonicalId]).toBeDefined();

      // Reading gặp lại và lưu
      store.saveToSRS('abandon', { contextSentence: 'They had to abandon the sinking ship immediately.' });

      const stateAfter = useAppStore.getState();
      const cards = stateAfter.getUnifiedSRSCards().filter((c) => (c.word || c.primaryText).toLowerCase() === 'abandon');
      expect(cards.length).toBe(1);
      expect(cards[0].id).toBe(canonicalId);
      expect(cards[0].exampleEn).toBe('They had to abandon the sinking ship immediately.');
    });

    it('2. Reading lưu trước -> Dictionary lưu lại: không tạo thẻ duplicate và giữ nguyên canonical ID', () => {
      const store = useAppStore.getState();
      const canonicalWord = getDictionaryWord('meticulous');
      expect(canonicalWord).toBeDefined();
      const canonicalId = canonicalWord!.id;

      // Reading lưu trước với context
      store.saveToSRS('meticulous', { contextSentence: 'She was meticulous about keeping clean records.' });
      expect(useAppStore.getState().srsProgressMap[canonicalId]).toBeDefined();

      // Dictionary lưu lại với object đầy đủ
      store.saveToSRS(canonicalWord!, { meaning: 'Tỉ mỉ, cẩn thận' });

      const stateAfter = useAppStore.getState();
      const cards = stateAfter.getUnifiedSRSCards().filter((c) => (c.word || c.primaryText).toLowerCase() === 'meticulous');
      expect(cards.length).toBe(1);
      expect(cards[0].id).toBe(canonicalId);
    });

    it('3. Object mang random/custom ID nhưng text trùng static vocabulary -> ưu tiên canonical system ID', () => {
      const store = useAppStore.getState();
      const canonicalWord = getDictionaryWord('innovation');
      expect(canonicalWord).toBeDefined();
      const canonicalId = canonicalWord!.id;

      // Caller truyền object với random custom ID
      store.saveToSRS({
        id: 'custom_random_uuid_99999',
        word: 'Innovation',
        ipa: '/ˌɪn.əˈveɪ.ʃən/',
        partOfSpeech: 'noun',
        meaning: 'Sự đổi mới',
        example: 'Continuous innovation is key.',
        tag: 'Tech',
        srsLevel: 0,
        interval: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
      });

      const stateAfter = useAppStore.getState();
      // srsProgressMap phải lưu dưới canonicalId, KHÔNG lưu dưới random ID
      expect(stateAfter.srsProgressMap[canonicalId]).toBeDefined();
      expect(stateAfter.srsProgressMap['custom_random_uuid_99999']).toBeUndefined();

      const cards = stateAfter.getUnifiedSRSCards().filter((c) => (c.word || c.primaryText).toLowerCase() === 'innovation');
      expect(cards.length).toBe(1);
      expect(cards[0].id).toBe(canonicalId);
    });

    it('4. Hai nguồn gửi khác hoa/thường hoặc punctuation -> cùng map vào 1 canonical ID duy nhất', () => {
      const store = useAppStore.getState();
      const canonicalWord = getDictionaryWord('empathy');
      expect(canonicalWord).toBeDefined();
      const canonicalId = canonicalWord!.id;

      // Nguồn 1 gửi hoa và có dấu chấm câu
      store.saveToSRS('  "EMPATHY"!..  ');
      // Nguồn 2 gửi thường
      store.saveToSRS('empathy');

      const stateAfter = useAppStore.getState();
      expect(stateAfter.srsProgressMap[canonicalId]).toBeDefined();

      const cards = stateAfter.getUnifiedSRSCards().filter((c) => (c.word || c.primaryText).toLowerCase() === 'empathy');
      expect(cards.length).toBe(1);
      expect(cards[0].id).toBe(canonicalId);
    });

    it('5. Từ custom thực sự không tồn tại trong từ điển -> dùng canonical custom ID nhất quán', () => {
      const store = useAppStore.getState();
      const customWordText = 'quantumcomputronix';

      // Nguồn 1: lưu custom word
      store.saveToSRS(customWordText, { meaning: 'điện toán lượng tử giả tưởng' });

      const state1 = useAppStore.getState();
      const expectedCustomId = `custom_${customWordText}`;
      expect(state1.srsProgressMap[expectedCustomId]).toBeDefined();

      // Nguồn 2: gửi lại từ này dạng object
      store.saveToSRS({
        id: 'random_attempt_id',
        word: customWordText,
        meaning: 'điện toán lượng tử',
      } as any);

      const state2 = useAppStore.getState();
      const cards = state2.getUnifiedSRSCards().filter((c) => (c.word || c.primaryText).toLowerCase() === customWordText);
      expect(cards.length).toBe(1);
      expect(cards[0].id).toBe(expectedCustomId);
    });
  });

  describe('8. Context Reading Real Persistence & Store Rehydration Flow', () => {
    it('persist & rehydration cho từ custom: ngữ cảnh được lưu trong userCustomWords và giữ nguyên sau rehydrate', () => {
      const store = useAppStore.getState();
      const customWord = 'neuromorphics';
      const customContext = 'Neuromorphics chips mimic the biological structure of human neural circuits.';

      store.saveToSRS(customWord, {
        meaning: 'công nghệ chip thần kinh mô phỏng não bộ',
        contextSentence: customContext,
      });

      // Kiểm tra trước rehydration
      const stateBefore = useAppStore.getState();
      const cardBefore = stateBefore.getUnifiedSRSCards().find((c) => (c.word || c.primaryText).toLowerCase() === customWord);
      expect(cardBefore).toBeDefined();
      expect(cardBefore?.exampleEn).toBe(customContext);

      // Mô phỏng serialize theo partialize policy
      const persistedCustomWords = JSON.parse(JSON.stringify(stateBefore.userCustomWords));
      const persistedSrsMap = JSON.parse(JSON.stringify(stateBefore.srsProgressMap));

      // Rehydrate store từ dữ liệu persisted
      const rehydratedVocabList = composeVocabularyList(persistedSrsMap, persistedCustomWords);
      useAppStore.setState({
        userCustomWords: persistedCustomWords,
        srsProgressMap: persistedSrsMap,
        vocabularyList: rehydratedVocabList,
      });

      // Kiểm tra sau rehydration
      const stateAfter = useAppStore.getState();
      const cardAfter = stateAfter.getUnifiedSRSCards().find((c) => (c.word || c.primaryText).toLowerCase() === customWord);
      expect(cardAfter).toBeDefined();
      expect(cardAfter?.exampleEn).toBe(customContext);
      expect(cardAfter?.meaning).toBe('công nghệ chip thần kinh mô phỏng não bộ');
    });

    it('persist & rehydration cho từ tĩnh (static dictionary): ngữ cảnh reading được lưu trong userCustomWords và giữ nguyên sau rehydrate', () => {
      const store = useAppStore.getState();
      const staticWord = 'artificial';
      const readingContext = 'Artificial neural algorithms optimize quantum communications.';

      store.saveToSRS(staticWord, {
        contextSentence: readingContext,
      });

      // Kiểm tra trước rehydration
      const stateBefore = useAppStore.getState();
      const cardBefore = stateBefore.getUnifiedSRSCards().find((c) => (c.word || c.primaryText).toLowerCase() === staticWord);
      expect(cardBefore).toBeDefined();
      expect(cardBefore?.exampleEn).toBe(readingContext);

      // Mô phỏng serialize theo partialize policy
      const persistedCustomWords = JSON.parse(JSON.stringify(stateBefore.userCustomWords));
      const persistedSrsMap = JSON.parse(JSON.stringify(stateBefore.srsProgressMap));

      // Rehydrate store từ dữ liệu persisted
      const rehydratedVocabList = composeVocabularyList(persistedSrsMap, persistedCustomWords);
      useAppStore.setState({
        userCustomWords: persistedCustomWords,
        srsProgressMap: persistedSrsMap,
        vocabularyList: rehydratedVocabList,
      });

      // Sau rehydrate: từ tĩnh vẫn mang readingContext của user chứ không bị đè bởi static generic example
      const stateAfter = useAppStore.getState();
      const cardAfter = stateAfter.getUnifiedSRSCards().find((c) => (c.word || c.primaryText).toLowerCase() === staticWord);
      expect(cardAfter).toBeDefined();
      expect(cardAfter?.exampleEn).toBe(readingContext);
    });

    it('cập nhật context mới cho từ đã học KHÔNG được ghi đè scheduling progress', () => {
      const dictWord = getDictionaryWord('resilient');
      expect(dictWord).toBeDefined();
      const canonicalId = dictWord!.id;

      // Đặt sẵn tiến trình SRS nâng cao
      const matureProgress = {
        srsLevel: 4,
        interval: 25,
        easeFactor: 2.7,
        nextReviewDate: '2026-11-20T00:00:00.000Z',
        firstLearnedAt: '2026-07-15T00:00:00.000Z',
        lastReviewedDate: '2026-10-01T00:00:00.000Z',
        isFavorite: true,
      };

      useAppStore.setState({
        srsProgressMap: {
          [canonicalId]: matureProgress,
        },
      });

      // User đọc bài mới và bổ sung context mới
      const store = useAppStore.getState();
      const newContext = 'The microservices architecture proved resilient under peak traffic.';
      store.saveToSRS('resilient', { contextSentence: newContext });

      const stateAfter = useAppStore.getState();
      const progressAfter = stateAfter.srsProgressMap[canonicalId];

      // Tiến trình SRS phải hoàn toàn bất biến
      expect(progressAfter.srsLevel).toBe(4);
      expect(progressAfter.interval).toBe(25);
      expect(progressAfter.easeFactor).toBe(2.7);
      expect(progressAfter.nextReviewDate).toBe('2026-11-20T00:00:00.000Z');
      expect(progressAfter.firstLearnedAt).toBe('2026-07-15T00:00:00.000Z');
      expect(progressAfter.isFavorite).toBe(true);

      // Unified SRS card có context mới
      const card = stateAfter.getUnifiedSRSCards().find((c) => c.id === canonicalId);
      expect(card?.exampleEn).toBe(newContext);
    });
  });

  describe('9. Sentence Context Edge Cases Suite', () => {
    it('không ngắt câu nhầm tại các từ viết tắt phổ biến: Mr., Mrs., Dr.', () => {
      const passage = 'Yesterday, Dr. Smith met with Mr. Johnson to discuss the project. The discussion was very fruitful.';
      const sentence = extractSentenceContext(passage, 'Johnson');
      expect(sentence).toBe('Yesterday, Dr. Smith met with Mr. Johnson to discuss the project.');
    });

    it('nhận diện đúng ranh giới kết thúc câu bằng dấu chấm than (!) và hỏi chấm (?)', () => {
      const passage = 'How incredible is this technology? Everyone should study it! It works wonders.';
      
      const qSentence = extractSentenceContext(passage, 'technology');
      expect(qSentence).toBe('How incredible is this technology?');

      const exSentence = extractSentenceContext(passage, 'study');
      expect(exSentence).toBe('Everyone should study it!');
    });

    it('xử lý chính xác khi target nằm ở đầu hoặc cuối câu', () => {
      const passage = 'Artificial intelligence brings innovation to the world.';
      
      const startWordSentence = extractSentenceContext(passage, 'Artificial');
      expect(startWordSentence).toBe('Artificial intelligence brings innovation to the world.');

      const endWordSentence = extractSentenceContext(passage, 'world');
      expect(endWordSentence).toBe('Artificial intelligence brings innovation to the world.');
    });

    it('xử lý target khác hoa/thường so với văn bản gốc', () => {
      const passage = 'The company values INNOVATION above all else.';
      const sentence = extractSentenceContext(passage, 'innovation');
      expect(sentence).toBe('The company values INNOVATION above all else.');
    });

    it('xử lý dấu câu bám sát target token', () => {
      const passage = 'We must consider (adaptability), which is vital for survival.';
      const sentence = extractSentenceContext(passage, 'adaptability');
      expect(sentence).toBe('We must consider (adaptability), which is vital for survival.');
    });

    it('không tràn qua ranh giới đoạn văn (\\n\\n)', () => {
      const passage = 'This is paragraph one.\n\nThis is paragraph two containing the key insight.\n\nThis is paragraph three.';
      const sentence = extractSentenceContext(passage, 'insight');
      expect(sentence).toBe('This is paragraph two containing the key insight.');
    });

    it('trả về chuỗi rỗng an toàn và không throw khi từ không có trong văn bản', () => {
      const passage = 'Simple text without the requested word.';
      expect(() => extractSentenceContext(passage, 'nonexistent')).not.toThrow();
      expect(extractSentenceContext(passage, 'nonexistent')).toBe('');
      expect(extractSentenceContext('', 'word')).toBe('');
    });
  });
});


