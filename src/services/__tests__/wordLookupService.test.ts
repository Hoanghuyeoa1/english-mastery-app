import { describe, it, expect } from 'vitest';
import { cleanWordToken, getStemCandidates, lookupContextWord } from '../wordLookupService';

describe('wordLookupService (Context Word Lookup & Morphological Stemming)', () => {
  describe('1. cleanWordToken - Complex Punctuation Stripping', () => {
    it('làm sạch dấu ngoặc và dấu chấm than: "(Technology)!" -> "technology"', () => {
      expect(cleanWordToken('"(Technology)!"')).toBe('technology');
    });

    it('làm sạch dấu nháy kép, nháy đơn và dấu phẩy: \'\"Awesome,\"\' -> "awesome"', () => {
      expect(cleanWordToken('\'"Awesome,"\'')).toBe('awesome');
    });

    it('làm sạch các dấu câu tiếng Việt và Unicode đặc biệt: «Bonjour», “Hello”, ‘World’, —test—', () => {
      expect(cleanWordToken('«Bonjour»')).toBe('bonjour');
      expect(cleanWordToken('“Hello”')).toBe('hello');
      expect(cleanWordToken('‘World’')).toBe('world');
      expect(cleanWordToken('—test—')).toBe('test');
    });

    it('giữ nguyên dấu nháy đơn và gạch ngang bên trong từ: it\'s, state-of-the-art', () => {
      expect(cleanWordToken("it's")).toBe("it's");
      expect(cleanWordToken('state-of-the-art')).toBe('state-of-the-art');
      expect(cleanWordToken('"(it\'s)!"')).toBe("it's");
    });

    it('xử lý an toàn khi đầu vào rỗng hoặc chỉ toàn khoảng trắng / dấu câu', () => {
      expect(cleanWordToken('')).toBe('');
      expect(cleanWordToken('   ')).toBe('');
      expect(cleanWordToken('.,!?;:"\'()[]{}«»“”‘’—–_')).toBe('');
    });
  });

  describe('2. getStemCandidates - Morphological Rules', () => {
    it('sinh biến thể số nhiều: -ies -> y, -es, -s', () => {
      const stemTech = getStemCandidates('technologies');
      expect(stemTech).toContain('technology');

      const stemBox = getStemCandidates('boxes');
      expect(stemBox).toContain('box');

      const stemDev = getStemCandidates('devices');
      expect(stemDev).toContain('device');
    });

    it('sinh biến thể quá khứ: -ied -> y, -ed, -d, gấp đôi phụ âm', () => {
      const stemStudied = getStemCandidates('studied');
      expect(stemStudied).toContain('study');

      const stemWorked = getStemCandidates('worked');
      expect(stemWorked).toContain('work');

      const stemCreated = getStemCandidates('created');
      expect(stemCreated).toContain('create');

      const stemStopped = getStemCandidates('stopped');
      expect(stemStopped).toContain('stop');
    });

    it('sinh biến thể tiếp diễn: -ing -> base, -ing -> e, gấp đôi phụ âm', () => {
      const stemPlaying = getStemCandidates('playing');
      expect(stemPlaying).toContain('play');

      const stemMaking = getStemCandidates('making');
      expect(stemMaking).toContain('make');

      const stemRunning = getStemCandidates('running');
      expect(stemRunning).toContain('run');
    });
  });

  describe('3. lookupContextWord - Exact Match & Morphological Stemming', () => {
    it('tra cứu từ gốc chính xác (Exact Match)', () => {
      const word = lookupContextWord('technology');
      expect(word).not.toBeNull();
      expect(word?.word.toLowerCase()).toBe('technology');
      expect(word?.meaning).toBeDefined();
    });

    it('tra cứu từ chứa dấu câu phức tạp bao bọc: "(Technology)!" -> tìm thấy technology', () => {
      const word = lookupContextWord('"(Technology)!"');
      expect(word).not.toBeNull();
      expect(word?.word.toLowerCase()).toBe('technology');
    });

    it('giải biến thể danh từ số nhiều: "technologies" -> tìm thấy technology', () => {
      const word = lookupContextWord('technologies');
      expect(word).not.toBeNull();
      // Khớp từ gốc technology
      expect(['technology', 'technologies']).toContain(word?.word.toLowerCase());
    });

    it('giải biến thể danh từ số nhiều: "boxes" -> tìm thấy box', () => {
      const word = lookupContextWord('boxes');
      expect(word).not.toBeNull();
      expect(['box', 'boxes']).toContain(word?.word.toLowerCase());
    });

    it('giải biến thể động từ quá khứ: "studied" -> tìm thấy study', () => {
      const word = lookupContextWord('studied');
      expect(word).not.toBeNull();
      expect(['study', 'studied']).toContain(word?.word.toLowerCase());
    });

    it('giải biến thể động từ quá khứ: "worked" -> tìm thấy work', () => {
      const word = lookupContextWord('worked');
      expect(word).not.toBeNull();
      expect(['work', 'worked']).toContain(word?.word.toLowerCase());
    });

    it('giải biến thể động từ có e câm: "created" -> tìm thấy create', () => {
      const word = lookupContextWord('created');
      expect(word).not.toBeNull();
      expect(['create', 'created']).toContain(word?.word.toLowerCase());
    });

    it('giải biến thể động từ tiếp diễn: "running" -> tìm thấy run', () => {
      const word = lookupContextWord('running');
      expect(word).not.toBeNull();
      expect(['run', 'running']).toContain(word?.word.toLowerCase());
    });
  });

  describe('4. lookupContextWord - Edge Cases & Resilience', () => {
    it('trả về null an toàn khi chuỗi rỗng hoặc chỉ có khoảng trắng', () => {
      expect(lookupContextWord('')).toBeNull();
      expect(lookupContextWord('   ')).toBeNull();
    });

    it('trả về null an toàn khi chỉ chứa dấu câu', () => {
      expect(lookupContextWord('...!?---')).toBeNull();
    });

    it('trả về null cho từ không tồn tại trong từ điển mà không crash', () => {
      expect(lookupContextWord('xyznonexistentword98765')).toBeNull();
      expect(lookupContextWord('UnknooownWord123')).toBeNull();
    });
  });

  describe('5. Performance Benchmark (< 2ms trên RAM)', () => {
    it('thời gian phản hồi trung bình < 2ms cho các lượt tra cứu liên tục trên RAM', () => {
      // Warm up
      lookupContextWord('technology');
      lookupContextWord('technologies');

      const testQueries = [
        'computer',
        'computers',
        'running',
        'created',
        '"(Technology)!"',
        'studied',
        'devices',
        'awesome',
        'nonexistentword',
      ];

      const iterations = 100;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        for (const q of testQueries) {
          lookupContextWord(q);
        }
      }
      const totalElapsed = performance.now() - start;
      const avgPerQuery = totalElapsed / (iterations * testQueries.length);

      expect(avgPerQuery).toBeLessThan(2.0);
    });
  });
});
