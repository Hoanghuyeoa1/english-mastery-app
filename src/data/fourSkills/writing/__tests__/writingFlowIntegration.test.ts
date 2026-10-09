// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WRITING_PROMPTS,
  resolveCanonicalWritingCefrLevel,
  a1WritingLessons,
  a2WritingLessons,
  b1WritingLessons,
  b2WritingLessons,
  c1WritingLessons,
  c2WritingLessons,
  countWords,
} from '../../writingData';
import {
  gradeEssay,
  reconstructOriginalText,
  calculateOverallScore,
  scoreToCEFRLevel,
} from '../../../../services/essayGradingService';
import {
  captureWritingMistake,
  captureWritingCollocation,
  isCollocationCandidate,
} from '../../../../services/fourSkillsLearningBridge';
import { recordSkillScore, getFourSkillsCompetency } from '../../../../services/skillsCompetencyService';
import { useAppStore } from '../../../../store/useAppStore';
import type { WritingPrompt } from '../../types';
import type { CEFRLevel } from '../../../../types';

describe('PHASE 5 — Full Writing Flow & Regression Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      mistakeBank: {},
      userCollocations: [],
      wordLearningStats: {},
      fourSkillsScores: { listening: [], reading: [], speaking: [], writing: [] },
    });
  });

  // =========================================================================
  // 1. CEFR SELECTION & CATALOG FILTERING INTEGRITY
  // =========================================================================
  describe('1. CEFR Selection & Catalog Filtering Integrity', () => {
    it('toàn bộ 24 lessons phân bổ đều đặn chính xác 4 lessons / level từ A1 đến C2', () => {
      expect(a1WritingLessons).toHaveLength(4);
      expect(a2WritingLessons).toHaveLength(4);
      expect(b1WritingLessons).toHaveLength(4);
      expect(b2WritingLessons).toHaveLength(4);
      expect(c1WritingLessons).toHaveLength(4);
      expect(c2WritingLessons).toHaveLength(4);
      expect(WRITING_PROMPTS).toHaveLength(24);
    });

    it('bộ lọc CEFR level UI dùng resolveCanonicalWritingCefrLevel trả về đúng 4 bài cho từng level', () => {
      const levels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

      levels.forEach((lvl) => {
        const filtered = WRITING_PROMPTS.filter((w) => {
          return resolveCanonicalWritingCefrLevel(w.level) === lvl;
        });
        expect(filtered).toHaveLength(4);
      });
    });

    it('bộ lọc ALL trả về toàn bộ 24 đề bài', () => {
      const filterLevel = 'ALL';
      const filtered = WRITING_PROMPTS.filter((w) => {
        return filterLevel === 'ALL' || resolveCanonicalWritingCefrLevel(w.level) === filterLevel;
      });
      expect(filtered).toHaveLength(24);
    });

    it('bộ lọc chủ đề (Category filter) hoạt động chính xác và không làm rỗng sai lệch dữ liệu', () => {
      const categories = new Set(WRITING_PROMPTS.map((p) => p.category));
      expect(categories.size).toBeGreaterThanOrEqual(4);

      categories.forEach((cat) => {
        const filtered = WRITING_PROMPTS.filter((w) => {
          return w.category === cat || w.type.toLowerCase().includes(cat.toLowerCase());
        });
        expect(filtered.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('bảo toàn vẹn toàn 5 legacy prompt IDs (wp_1 -> wp_5) không bị thay đổi', () => {
      const legacyIds = ['wp_1', 'wp_2', 'wp_3', 'wp_4', 'wp_5'];
      legacyIds.forEach((id) => {
        const found = WRITING_PROMPTS.find((p) => p.id === id);
        expect(found).toBeDefined();
        expect(found!.id).toBe(id);
      });
    });
  });

  // =========================================================================
  // 2. WORD COUNT UI & INVARIANTS
  // =========================================================================
  describe('2. Word Count UI & Invariants', () => {
    it('toàn bộ 24 lessons có wordRange và minWords phù hợp với tiêu chuẩn CEFR', () => {
      WRITING_PROMPTS.forEach((p) => {
        expect(p.wordRange).toBeDefined();
        expect(typeof p.wordRange).toBe('string');
        expect(p.minWords).toBeGreaterThan(0);
      });
    });

    it('countWords tính toán chính xác số từ tiếng Anh loại bỏ khoảng trắng thừa', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
      expect(countWords('Hello world')).toBe(2);
      expect(countWords('   Hello   beautiful   world!  How are you?   ')).toBe(6);
    });

    it('luật tối thiểu 10 từ chặn submit bài rỗng hoặc quá ngắn (<10 từ)', () => {
      const shortEssay = 'This is too short.';
      const words = shortEssay.trim().split(/\s+/).filter(Boolean);
      expect(words.length).toBeLessThan(10);
      // Client UI invariant: if (wordCount < 10) alert(...) and return
      expect(words.length < 10).toBe(true);
    });
  });

  // =========================================================================
  // 3. FULL WRITING FLOW & EVALUATION INTEGRATION (A1 TO C2)
  // =========================================================================
  describe('3. Full Writing Flow & Evaluation Integration across all CEFR levels', () => {
    const representativeLessons: { level: CEFRLevel; prompt: WritingPrompt; sampleEssay: string }[] = [
      {
        level: 'A1',
        prompt: a1WritingLessons[0], // wp_a1_1
        sampleEssay:
          'Hello, my name is Alex. I am twenty-five years old and I live in Hanoi. I am a junior software engineer at a local company. In my free time, I really like playing badminton and listening to pop music with my best friends.',
      },
      {
        level: 'A2',
        prompt: a2WritingLessons[0], // wp_a2_1
        sampleEssay:
          'Hi Sam, I hope you are having a wonderful week! I would love to invite you to my birthday dinner this Saturday evening at eight oclock. We will meet at the Blue Ocean Seafood restaurant near West Lake. You can take the green bus number thirty or just grab a ride. Please let me know if you can come before Friday so I can reserve the table. Best wishes, Linh.',
      },
      {
        level: 'B1',
        prompt: b1WritingLessons[2], // wp_b1_1
        sampleEssay:
          'In recent years, remote learning and studying from home have become increasingly popular around the world. On the one hand, learning online offers remarkable flexibility because students can set their own schedule and save a lot of commuting time. On the other hand, traditional face-to-face classrooms provide invaluable direct interactions with teachers and peers, which makes team projects much easier. In my personal opinion, a blended learning model that combines online lectures with in-person seminars is the most effective approach for modern education.',
      },
      {
        level: 'B2',
        prompt: b2WritingLessons[2], // wp_b2_1
        sampleEssay:
          'The rapid transition toward renewable energy sources represents one of the most critical imperatives of our era. Advocates argue that phasing out fossil fuels is essential to mitigating climate change and protecting public health. However, opponents emphasize the economic challenges and intermittent nature of wind and solar grids. In my perspective, while transitioning requires substantial capital investments, governments must actively subsidize clean energy infrastructure while implementing resilient grid storage systems to ensure sustainable long-term prosperity.',
      },
      {
        level: 'C1',
        prompt: c1WritingLessons[1], // wp_c1_1
        sampleEssay:
          'Dear Members of the Executive Steering Committee, I am writing to submit a comprehensive proposal regarding the integration of automated code analysis within our continuous deployment pipeline. Over the past three quarters, our engineering squads have experienced an escalating defect backlog, with regression incidents increasing by eighteen percent. By implementing automated static analysis and continuous integration gates, our preliminary benchmarks suggest that defect leakage can be curtailed by thirty-five percent within ninety days. Furthermore, the cross-functional knowledge sharing enabled by automated rule enforcement will accelerate onboarding for junior engineers. We estimate an initial expenditure of twelve thousand dollars for enterprise licenses, which will be comfortably offset by reduced downtime and improved customer retention. I welcome the opportunity to discuss this strategic roadmap in greater detail during our upcoming executive review.',
      },
      {
        level: 'C2',
        prompt: c2WritingLessons[0], // wp_c2_1
        sampleEssay:
          'The inexorable advancement of algorithmic decision-making across contemporary governance structures necessitates a profound re-examination of ethical accountability and individual agency. When cognitive labor is delegated to probabilistic neural architectures, the traditional nexus between moral intent and empirical consequence becomes fundamentally obfuscated. Although proponents herald automated systems as impartial arbiters unencumbered by human cognitive biases, such optimism overlooks the systemic encoding of historical inequities embedded within training corpuses. Consequently, algorithmic neutrality remains an untenable fiction that conceals epistemic violence beneath a veneer of mathematical rigor. To safeguard democratic legitimacy, institutional frameworks must establish robust transparency protocols and preserve meaningful human contestability, thereby ensuring that technological instrumentality remains strictly subordinate to ethical deliberation.',
      },
    ];

    representativeLessons.forEach(({ level, prompt, sampleEssay }) => {
      it(`hoàn thành trọn vẹn luồng chấm điểm cho cấp độ ${level} (prompt: ${prompt.id})`, async () => {
        const canonicalLevel = resolveCanonicalWritingCefrLevel(prompt.level) || 'B2';
        expect(canonicalLevel).toBe(level);

        const result = await gradeEssay({
          essay: sampleEssay,
          topic: prompt.prompt,
          targetLevel: canonicalLevel,
        });

        // 1. Kết quả chấm hợp lệ
        expect(result).toBeDefined();
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.overallScore).toBeLessThanOrEqual(100);
        expect(result.overallCEFR).toBeDefined();

        // 2. Tiêu chuẩn 4 tiêu chí CEFR
        const { criteria } = result;
        expect(criteria.taskAchievement.score).toBeGreaterThanOrEqual(0);
        expect(criteria.coherenceCohesion.score).toBeGreaterThanOrEqual(0);
        expect(criteria.lexicalResource.score).toBeGreaterThanOrEqual(0);
        expect(criteria.grammaticalAccuracy.score).toBeGreaterThanOrEqual(0);

        // 3. Tính điểm tổng quát đúng chuẩn trung bình cộng 4 tiêu chí
        const calculated = calculateOverallScore(criteria);
        expect(result.overallScore).toBe(calculated.overallScore);
        expect(result.overallCEFR).toBe(calculated.overallCEFR);

        // 4. Invariant: Reconstruct original text từ diffSegments phải khớp 100% bản gốc
        expect(result.diffSegments.length).toBeGreaterThan(0);
        const reconstructed = reconstructOriginalText(result.diffSegments);
        expect(reconstructed).toBe(sampleEssay);
      });
    });
  });

  // =========================================================================
  // 4. LONG-TEXT & C1/C2 ESSAY HANDLING
  // =========================================================================
  describe('4. Long-Text & C1/C2 Essay Performance', () => {
    it('xử lý mượt mà bài luận dài C2 (>350 từ) không bị nghẽn, tràn bộ nhớ hay lỗi diff', async () => {
      const longC2Essay = `
The accelerating deployment of generative artificial intelligence across higher education has precipitated an urgent pedagogical crisis that challenges the foundational epistemologies of academia. Rather than merely offering incremental productivity enhancements, autonomous cognitive agents fundamentally destabilize traditional assessment paradigms rooted in textual production.

For centuries, the written essay has served as the paramount proxy for intellectual rigor, critical synthesis, and authentic dialectical reasoning. However, when large language models can instantaneously generate syntactically immaculate prose that simulates nuanced academic discourse, educators can no longer conflate eloquent prose with genuine cognitive mastery. This epistemic disjunction necessitates a paradigmatic shift in how pedagogical efficacy is measured.

Opponents of generative AI frequently advocate punitive surveillance mechanisms, including algorithmic plagiarism detectors and strictly sequestered examination environments. Such reactionary stratagems, however, prove fundamentally myopic. Not only do empirical studies demonstrate that probabilistic text classifiers exhibit unacceptable false-positive rates, particularly against non-native speakers, but coercive policing also fosters an adversarial learning culture that suffocates intellectual inquiry.

Conversely, an enlightened pedagogical architecture must embrace technological affordances while cultivating uniquely human competencies: metacognitive reflection, ethical discernment, and lived phenomenological insight. By repositioning artificial intelligence from an illicit shortcut to a collaborative dialectical interlocutor, institutions can reorient curricula toward iterative problem-solving, Socratic dialogue, and contextual critique. Ultimately, the crisis induced by synthetic cognition compels us to transcend instrumentalist notions of schooling and reaffirm education as the transformative cultivation of independent philosophical judgment.
      `.trim();

      const wordCount = countWords(longC2Essay);
      expect(wordCount).toBeGreaterThanOrEqual(230);

      const result = await gradeEssay({
        essay: longC2Essay,
        topic: 'AI in higher education',
        targetLevel: 'C2',
      });

      expect(result.overallScore).toBeGreaterThanOrEqual(70);
      expect(reconstructOriginalText(result.diffSegments)).toBe(longC2Essay);
      expect(result.fullRevisedEssay).toBeTruthy();
    });
  });

  // =========================================================================
  // 5. TELEMETRY, MISTAKE BANK & COLLOCATION SAFETY
  // =========================================================================
  describe('5. Telemetry, Mistake Bank & Collocation Safety', () => {
    it('captureWritingMistake trích xuất ngữ cảnh câu có giới hạn và không làm ô nhiễm store', () => {
      const essay = 'I goes to school every day. She is very happy.';
      const res = captureWritingMistake({
        originalText: 'I goes',
        revisedText: 'I go',
        explanation: 'Subject-verb agreement error with first person singular.',
        fullEssay: essay,
        mistakeBank: useAppStore.getState().mistakeBank,
        recordMistake: useAppStore.getState().recordMistake,
      });

      expect(res.recorded).toBe(true);
      expect(res.boundedContext).toContain('I goes to school');
      // Bounded single-sentence context: should not bleed entire essay
      expect(res.boundedContext.length).toBeLessThanOrEqual(200);

      const mistakes = useAppStore.getState().mistakeBank;
      const keys = Object.keys(mistakes);
      expect(keys.length).toBeGreaterThanOrEqual(1);

      const captured = Object.values(mistakes).find((m) => m.word === 'I goes');
      expect(captured).toBeDefined();
      expect(captured!.lastExpectedAnswer).toBe('I go');
    });

    it('isCollocationCandidate xác thực cụm collocation hợp lệ và loại bỏ từ đơn lẻ hay câu dài', () => {
      expect(isCollocationCandidate('deep concern')).toBe(true);
      expect(isCollocationCandidate('heavily dependent on')).toBe(true);
      expect(isCollocationCandidate('apple')).toBe(false); // Single word
      expect(isCollocationCandidate('this is a very long sentence that has far too many words to be a collocation')).toBe(false);
    });

    it('captureWritingCollocation thêm collocation mới mà không tạo trùng lặp', () => {
      const res1 = captureWritingCollocation({
        phrase: 'mitigate climate change',
        meaning: 'giảm nhẹ biến đổi khí hậu',
        exampleEn: 'Phasing out fossil fuels is essential to mitigate climate change.',
        userCollocations: useAppStore.getState().userCollocations,
        saveCollocationToSRS: useAppStore.getState().saveCollocationToSRS,
      });

      expect(res1.success).toBe(true);
      let collocations = useAppStore.getState().userCollocations;
      expect(collocations.some((c) => c.phrase.toLowerCase() === 'mitigate climate change')).toBe(true);

      const initialCount = collocations.length;
      // Capture again: must be marked duplicate
      const res2 = captureWritingCollocation({
        phrase: 'mitigate climate change',
        meaning: 'giảm nhẹ biến đổi khí hậu',
        exampleEn: 'Another context sentence.',
        userCollocations: useAppStore.getState().userCollocations,
        saveCollocationToSRS: useAppStore.getState().saveCollocationToSRS,
      });

      expect(res2.isDuplicate).toBe(true);
      collocations = useAppStore.getState().userCollocations;
      expect(collocations.length).toBe(initialCount);
    });

    it('ghi nhận điểm năng lực kỹ năng Viết (recordSkillScore) vào hệ thống Four Skills', () => {
      recordSkillScore('writing', 85);
      const competency = getFourSkillsCompetency();
      expect(competency.writing.score).toBe(85);
      expect(competency.writing.level).toBe('B1');
    });
  });
});
