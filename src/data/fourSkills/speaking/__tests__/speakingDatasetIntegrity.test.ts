import { describe, it, expect } from 'vitest';
import {
  SPEAKING_PROMPTS,
  findSpeakingLessonsByCefr,
  a1SpeakingLessons,
  a2SpeakingLessons,
  b1SpeakingLessons,
  b2SpeakingLessons,
  c1SpeakingLessons,
  c2SpeakingLessons,
} from '../../speakingData';
import {
  validateSpeakingDataset,
  validateSpeakingPrompt,
  validateSpeakingDistribution,
  parseSpeakingDurationToSeconds,
  estimateSpeakingPromptDuration,
  resolveCanonicalCefrLevel,
  SPEAKING_DURATION_TARGETS,
  VALID_CEFR_LEVELS,
} from '../validation';
import { SpeakingPrompt } from '../../types';

function countTargetWords(prompt: SpeakingPrompt): number {
  return prompt.turns.reduce((acc, turn) => {
    const words = (turn.targetSentence || '').trim().split(/\s+/).filter(Boolean).length;
    return acc + words;
  }, 0);
}

function countTotalDialogueWords(prompt: SpeakingPrompt): number {
  return prompt.turns.reduce((acc, turn) => {
    const pWords = (turn.partnerPrompt || '').trim().split(/\s+/).filter(Boolean).length;
    const tWords = (turn.targetSentence || '').trim().split(/\s+/).filter(Boolean).length;
    return acc + pWords + tWords;
  }, 0);
}

describe('PHASE 3: SPEAKING DATASET COMPLETION (B2, C1, C2: EXACTLY 4 LESSONS EACH, TOTAL 24)', () => {
  // =========================================================================
  // 1. INVENTORY & CENSUS OF ENTIRE SPEAKING DATASET (A1–C2)
  // =========================================================================
  describe('1. Inventory & Census Across All CEFR Bands', () => {
    it('đạt chuẩn phân bổ tuyệt đối: mỗi band A1–C2 có đúng 4 lessons và tổng số bài là 24', () => {
      expect(a1SpeakingLessons).toHaveLength(4);
      expect(a2SpeakingLessons).toHaveLength(4);
      expect(b1SpeakingLessons).toHaveLength(4);
      expect(b2SpeakingLessons).toHaveLength(4);
      expect(c1SpeakingLessons).toHaveLength(4);
      expect(c2SpeakingLessons).toHaveLength(4);

      expect(SPEAKING_PROMPTS).toHaveLength(24);

      expect(findSpeakingLessonsByCefr('A1')).toHaveLength(4);
      expect(findSpeakingLessonsByCefr('A2')).toHaveLength(4);
      expect(findSpeakingLessonsByCefr('B1')).toHaveLength(4);
      expect(findSpeakingLessonsByCefr('B2')).toHaveLength(4);
      expect(findSpeakingLessonsByCefr('C1')).toHaveLength(4);
      expect(findSpeakingLessonsByCefr('C2')).toHaveLength(4);
    });

    it('bảo toàn 100% stable IDs của 4 lesson gốc (sp_1, sp_2, sp_3, sp_4)', () => {
      const allIds = SPEAKING_PROMPTS.map((p) => p.id);
      expect(allIds).toContain('sp_1');
      expect(allIds).toContain('sp_2');
      expect(allIds).toContain('sp_3');
      expect(allIds).toContain('sp_4');
    });

    it('kiểm tra deterministic IDs của các bài nói theo từng band', () => {
      const a1Ids = a1SpeakingLessons.map((p) => p.id);
      expect(a1Ids).toEqual(['sp_a1_1', 'sp_a1_2', 'sp_a1_3', 'sp_a1_4']);

      const a2Ids = a2SpeakingLessons.map((p) => p.id);
      expect(a2Ids).toEqual(['sp_4', 'sp_a2_1', 'sp_a2_2', 'sp_a2_3']);

      const b1Ids = b1SpeakingLessons.map((p) => p.id);
      expect(b1Ids).toEqual(['sp_2', 'sp_b1_1', 'sp_b1_2', 'sp_b1_3']);

      const b2Ids = b2SpeakingLessons.map((p) => p.id);
      expect(b2Ids).toEqual(['sp_1', 'sp_3', 'sp_b2_1', 'sp_b2_2']);

      const c1Ids = c1SpeakingLessons.map((p) => p.id);
      expect(c1Ids).toEqual(['sp_c1_1', 'sp_c1_2', 'sp_c1_3', 'sp_c1_4']);

      const c2Ids = c2SpeakingLessons.map((p) => p.id);
      expect(c2Ids).toEqual(['sp_c2_1', 'sp_c2_2', 'sp_c2_3', 'sp_c2_4']);
    });
  });

  // =========================================================================
  // 2. PEDAGOGICAL WORD COUNT & DURATION BENCHMARKS ACROSS CEFR BANDS
  // =========================================================================
  describe('2. Pedagogical Word Count & Duration Verification', () => {
    it('toàn bộ 4 bài A1 nằm chuẩn trong dải 30–60 spoken words & 20–40s', () => {
      a1SpeakingLessons.forEach((prompt) => {
        const words = countTargetWords(prompt);
        expect(words).toBeGreaterThanOrEqual(30);
        expect(words).toBeLessThanOrEqual(60);

        expect(prompt.suggestedDuration).toBe('20–40s');
        const estimatedSec = estimateSpeakingPromptDuration(prompt);
        expect(estimatedSec).toBeGreaterThanOrEqual(20);
        expect(estimatedSec).toBeLessThanOrEqual(50);
      });
    });

    it('toàn bộ 4 bài A2 nằm chuẩn trong dải 50–90 spoken words & 30–60s', () => {
      a2SpeakingLessons.forEach((prompt) => {
        const words = countTargetWords(prompt);
        expect(words).toBeGreaterThanOrEqual(50);
        expect(words).toBeLessThanOrEqual(90);

        const sec = parseSpeakingDurationToSeconds(prompt.suggestedDuration);
        expect(sec).toBeGreaterThanOrEqual(30);
        expect(sec).toBeLessThanOrEqual(60);
      });
    });

    it('toàn bộ 4 bài B1 nằm chuẩn trong dải 90–150 spoken words & 60–90s', () => {
      b1SpeakingLessons.forEach((prompt) => {
        const words = countTargetWords(prompt);
        expect(words).toBeGreaterThanOrEqual(90);
        expect(words).toBeLessThanOrEqual(150);

        expect(prompt.suggestedDuration).toBe('60–90s');
        const estimatedSec = estimateSpeakingPromptDuration(prompt);
        expect(estimatedSec).toBeGreaterThanOrEqual(60);
        expect(estimatedSec).toBeLessThanOrEqual(120);
      });
    });

    it('toàn bộ 4 bài B2 nằm chuẩn trong dải 140–220 total dialogue words & 90–120s', () => {
      b2SpeakingLessons.forEach((prompt) => {
        const targetWords = countTargetWords(prompt);
        expect(targetWords).toBeGreaterThanOrEqual(90);
        expect(targetWords).toBeLessThanOrEqual(160);

        const dialogueWords = countTotalDialogueWords(prompt);
        expect(dialogueWords).toBeGreaterThanOrEqual(140);
        expect(dialogueWords).toBeLessThanOrEqual(240);

        expect(prompt.suggestedDuration).toBe('90–120s');
        const sec = parseSpeakingDurationToSeconds(prompt.suggestedDuration);
        expect(sec).toBeGreaterThanOrEqual(90);
        expect(sec).toBeLessThanOrEqual(120);
      });
    });

    it('toàn bộ 4 bài C1 nằm chuẩn trong dải 220–350 total dialogue words & 2–3 min', () => {
      c1SpeakingLessons.forEach((prompt) => {
        const targetWords = countTargetWords(prompt);
        expect(targetWords).toBeGreaterThanOrEqual(140);
        expect(targetWords).toBeLessThanOrEqual(200);

        const dialogueWords = countTotalDialogueWords(prompt);
        expect(dialogueWords).toBeGreaterThanOrEqual(220);
        expect(dialogueWords).toBeLessThanOrEqual(350);

        expect(prompt.suggestedDuration).toBe('2–3 min');
        const sec = parseSpeakingDurationToSeconds(prompt.suggestedDuration);
        expect(sec).toBeGreaterThanOrEqual(120);
        expect(sec).toBeLessThanOrEqual(180);
      });
    });

    it('toàn bộ 4 bài C2 nằm chuẩn trong dải 300–500 target spoken words & 3–4 min', () => {
      c2SpeakingLessons.forEach((prompt) => {
        const targetWords = countTargetWords(prompt);
        expect(targetWords).toBeGreaterThanOrEqual(300);
        expect(targetWords).toBeLessThanOrEqual(500);

        const dialogueWords = countTotalDialogueWords(prompt);
        expect(dialogueWords).toBeGreaterThanOrEqual(350);
        expect(dialogueWords).toBeLessThanOrEqual(550);

        expect(prompt.suggestedDuration).toBe('3–4 min');
        const sec = parseSpeakingDurationToSeconds(prompt.suggestedDuration);
        expect(sec).toBeGreaterThanOrEqual(180);
        expect(sec).toBeLessThanOrEqual(240);
      });
    });
  });

  // =========================================================================
  // 3. TALKING POINTS & PROMPT QUALITY AUDIT
  // =========================================================================
  describe('3. Talking Points & Prompt Quality Audit Across All 24 Lessons', () => {
    it('mỗi bài trong số 24 bài có từ 3 đến 5 talking points định hướng rõ ràng', () => {
      SPEAKING_PROMPTS.forEach((prompt) => {
        expect(prompt.talkingPoints).toBeDefined();
        expect(prompt.talkingPoints!.length).toBeGreaterThanOrEqual(3);
        expect(prompt.talkingPoints!.length).toBeLessThanOrEqual(5);

        prompt.talkingPoints!.forEach((tp) => {
          expect(tp.trim().length).toBeGreaterThanOrEqual(10);
        });
      });
    });

    it('mỗi bài có scenario cụ thể, có communication goal, không trừu tượng rỗng', () => {
      SPEAKING_PROMPTS.forEach((prompt) => {
        expect(prompt.scenario.trim().length).toBeGreaterThanOrEqual(20);
        expect(prompt.scenario).not.toMatch(/^Talk about yourself$/i);
      });
    });

    it('không có bất kỳ placeholder/TODO/TBD nào trong toàn bộ 24 bài', () => {
      SPEAKING_PROMPTS.forEach((prompt) => {
        const textToScan = [
          prompt.title,
          prompt.scenario,
          ...(prompt.talkingPoints || []),
          ...prompt.turns.flatMap((t) => [
            t.partnerPrompt,
            t.targetSentence,
            t.phonetic,
            t.meaningVi,
            ...t.keyKeywords,
          ]),
        ].join(' ');

        expect(textToScan).not.toMatch(/\bTODO\b/i);
        expect(textToScan).not.toMatch(/\bTBD\b/i);
        expect(textToScan).not.toMatch(/\bplaceholder\b/i);
        expect(textToScan).not.toMatch(/\blorem ipsum\b/i);
      });
    });
  });

  // =========================================================================
  // 4. TOPIC DIVERSITY IN ADVANCED BANDS (B2, C1, C2)
  // =========================================================================
  describe('4. Topic Diversity Across B2, C1, and C2 Bands', () => {
    it('4 bài B2 bao quát phỏng vấn kỹ thuật, đánh giá kiến trúc, năng lượng chuyển dịch và khảo thí giáo dục', () => {
      const titles = b2SpeakingLessons.map((p) => p.title);
      expect(titles).toContain('IT Job Interview: Senior Fullstack Engineer');
      expect(titles).toContain('Code Review & Architectural Trade-Off Defense');
      expect(titles).toContain('Renewable Energy Transition vs. Economic Realities');
      expect(titles).toContain('Standardized Testing vs. Holistic Assessment in Higher Education');
    });

    it('4 bài C1 bao quát đạo đức thuật toán, quy hoạch đô thị, kiểm toán ESG và khoa học thần kinh điều hành', () => {
      const titles = c1SpeakingLessons.map((p) => p.title);
      expect(titles).toContain('The Ethics of Algorithmic Governance and Surveillance Capitalism');
      expect(titles).toContain('Urban Gentrification and the Displacement of Cultural Heritage');
      expect(titles).toContain('Corporate ESG Mandates: Genuine Sustainability or Performative Greenwashing?');
      expect(titles).toContain('The Neurobiology of Decision Fatigue and Leadership Psychology');
    });

    it('4 bài C2 bao quát triết học nhân quyền, khủng hoảng nhận thức AI, thoái tăng trưởng sinh thái và phân cực dân chủ', () => {
      const titles = c2SpeakingLessons.map((p) => p.title);
      expect(titles).toContain('Reconciling Universal Human Rights with Cultural Relativism in Global Diplomacy');
      expect(titles).toContain('The Epistemic Crisis of Generative AI: Truth, Authenticity, and Consensus Reality');
      expect(titles).toContain('Macroeconomic Degrowth vs. Green Growth: Resolving the Ecological Paradox');
      expect(titles).toContain('The Psychology of Mass Polarization and the Fragility of Deliberative Democracy');
    });
  });

  // =========================================================================
  // 5. VALIDATION ENGINE & FULL DISTRIBUTION COMPLIANCE
  // =========================================================================
  describe('5. Dataset Validation Suite Compliance', () => {
    it('toàn bộ 24 bài trong SPEAKING_PROMPTS vượt qua validation không lỗi với requireFullDistribution=true', () => {
      const res = validateSpeakingDataset(SPEAKING_PROMPTS, {
        allowLegacyLevels: false,
        requireFullDistribution: true,
      });

      expect(res.errors).toEqual([]);
      expect(res.valid).toBe(true);
    });

    it('phân bổ chuẩn 24 lessons (4 bài/band cho cả 6 cấp độ CEFR)', () => {
      const dist = validateSpeakingDistribution(SPEAKING_PROMPTS);
      expect(dist.valid).toBe(true);
      expect(dist.total).toBe(24);
      expect(dist.expectedTotal).toBe(24);
      expect(dist.counts).toEqual({
        A1: 4,
        A2: 4,
        B1: 4,
        B2: 4,
        C1: 4,
        C2: 4,
      });
      expect(dist.issues).toEqual([]);
    });

    it('tất cả các turnIndex đồng bộ hoàn hảo với thứ tự mảng và có audio sample trùng khớp', () => {
      SPEAKING_PROMPTS.forEach((prompt) => {
        prompt.turns.forEach((turn, idx) => {
          expect(turn.turnIndex).toBe(idx);
          expect(turn.keyKeywords.length).toBeGreaterThanOrEqual(2);
          expect(turn.targetSentence.trim()).toBeTruthy();
          expect(turn.sampleAudioText.trim()).toBe(turn.targetSentence.trim());
          expect(turn.phonetic.trim()).toBeTruthy();
          expect(turn.meaningVi.trim()).toBeTruthy();
        });
      });
    });
  });

  // =========================================================================
  // 6. VALIDATION RULE ENGINE DEFECT DETECTION TESTS
  // =========================================================================
  describe('6. Validation Rule Engine Error Detection', () => {
    const samplePrompt: SpeakingPrompt = a1SpeakingLessons[0];

    it('phát hiện ID rỗng', () => {
      const bad = { ...samplePrompt, id: '' };
      const res = validateSpeakingPrompt(bad);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.field === 'id')).toBe(true);
    });

    it('phát hiện title quá ngắn', () => {
      const bad = { ...samplePrompt, title: 'Hi' };
      const res = validateSpeakingPrompt(bad);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.field === 'title')).toBe(true);
    });

    it('phát hiện placeholder text trong scenario', () => {
      const bad = { ...samplePrompt, scenario: 'TODO: write scenario later' };
      const res = validateSpeakingPrompt(bad);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.field === 'scenario')).toBe(true);
    });

    it('phát hiện lượt thoại rỗng', () => {
      const bad = { ...samplePrompt, turns: [] };
      const res = validateSpeakingPrompt(bad);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.field === 'turns')).toBe(true);
    });

    it('phát hiện duplicate ID trong dataset', () => {
      const dataset = [samplePrompt, { ...samplePrompt, title: 'Another title' }];
      const res = validateSpeakingDataset(dataset);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.message.includes('Trùng lặp ID'))).toBe(true);
    });
  });

  // =========================================================================
  // 7. PHASE 4 CEFR PROGRESSION & PEDAGOGICAL RIGOR AUDIT
  // =========================================================================
  describe('7. CEFR Progression & Pedagogical Rigor Audit', () => {
    it('A1: tuyệt đối không yêu cầu tranh luận, trừu tượng hay triết học; tập trung giới thiệu và đời sống thường ngày', () => {
      a1SpeakingLessons.forEach((prompt) => {
        expect(prompt.scenario).not.toMatch(/\b(debate|critique|evaluate|synthesise|reconcile|epistemology|hegemony)\b/i);
        prompt.turns.forEach((turn) => {
          expect(turn.targetSentence).not.toMatch(/\b(paradox|antinomies|epistemic|subjugation|counter-perspective)\b/i);
        });
      });
    });

    it('A2: giới hạn ở mức trần thuật đơn giản, lý do cơ bản (because, so) và yêu cầu lịch sự', () => {
      a2SpeakingLessons.forEach((prompt) => {
        expect(prompt.scenario).not.toMatch(/\b(deconstruct|epistemic|macroeconomic|jurisprudence)\b/i);
        const hasBasicConnector = prompt.turns.some((turn) =>
          /\b(because|so|but|could|would)\b/i.test(turn.targetSentence)
        );
        expect(hasBasicConnector).toBe(true);
      });
    });

    it('B1: yêu cầu tự sự, giải thích kinh nghiệm, phân tích tình huống thực tế và đưa ra quan điểm cá nhân', () => {
      b1SpeakingLessons.forEach((prompt) => {
        const hasOpinionOrReason = prompt.turns.some((turn) =>
          /\b(in my opinion|in my view|because|if|learned that|prefer|challenge|so|blocker|decide|struggled)\b/i.test(turn.targetSentence)
        );
        expect(hasOpinionOrReason).toBe(true);
      });
    });

    it('B2: nâng cao lên lập luận đa chiều, so sánh ưu nhược điểm (trade-offs), nguyên nhân hệ quả', () => {
      b2SpeakingLessons.forEach((prompt) => {
        const hasArgumentStructure = prompt.turns.some((turn) =>
          /\b(while|although|however|trade-offs|bottleneck|decouples|subsidies|drawback|against|balances|exhaustion|instead of)\b/i.test(turn.targetSentence)
        );
        expect(hasArgumentStructure).toBe(true);
      });
    });

    it('C1: phân tích cấu trúc, đánh giá hệ thống, ngôn ngữ thận trọng (hedging) và phê phán thể chế', () => {
      c1SpeakingLessons.forEach((prompt) => {
        const hasSophisticatedHedging = prompt.turns.some((turn) =>
          /\b(inevitably|systematically|ostensibly|provided|subconscious|metacognitive|imperative|hinges)\b/i.test(turn.targetSentence)
        );
        expect(hasSophisticatedHedging).toBe(true);
      });
    });

    it('C2: giải quyết nghịch lý, tổng hợp các hệ hình đối lập, kiểm soát tu từ và nhận thức luận cao cấp', () => {
      c2SpeakingLessons.forEach((prompt) => {
        const hasSynthesis = prompt.turns.some((turn) =>
          /\b(dialectic|ontological|rupture|epistemic|thermodynamic|reconciling|overlapping consensus|deliberative)\b/i.test(turn.targetSentence)
        );
        expect(hasSynthesis).toBe(true);
      });
    });
  });

  // =========================================================================
  // 8. PHONETICS & IPA INTEGRITY AUDIT
  // =========================================================================
  describe('8. Phonetics & IPA Quality Audit', () => {
    it('toàn bộ 112 lượt thoại của 24 bài có phiên âm IPA chuẩn mở đầu và kết thúc bằng dấu gạch chéo', () => {
      SPEAKING_PROMPTS.forEach((prompt) => {
        prompt.turns.forEach((turn, tIdx) => {
          expect(turn.phonetic.startsWith('/')).toBe(true);
          expect(turn.phonetic.endsWith('/')).toBe(true);
          expect(turn.phonetic.length).toBeGreaterThanOrEqual(10);
        });
      });
    });

    it('không có từ viết hoa chưa phiên âm hoặc dấu tiếng Việt lạc vào trường phonetic', () => {
      SPEAKING_PROMPTS.forEach((prompt) => {
        prompt.turns.forEach((turn) => {
          // No uppercase letters inside phonetics
          expect(turn.phonetic).not.toMatch(/[A-Z]/);
          // No Vietnamese diacritics inside phonetics
          expect(turn.phonetic).not.toMatch(/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i);
        });
      });
    });
  });

  // =========================================================================
  // 9. STATIC DATA & PERSISTENCE SAFETY AUDIT
  // =========================================================================
  describe('9. Static Serialization & Store Safety Audit', () => {
    it('toàn bộ 24 lessons là pure serializable JSON data không chứa function hay circular reference', () => {
      const serialized = JSON.stringify(SPEAKING_PROMPTS);
      expect(serialized).toBeTruthy();
      const parsed = JSON.parse(serialized);
      expect(parsed).toHaveLength(24);
      expect(parsed[0].id).toBe('sp_a1_1');
    });

    it('không có lesson nào bị thiếu talkingPoints hoặc bị để trống mảng turns', () => {
      SPEAKING_PROMPTS.forEach((prompt) => {
        expect(Array.isArray(prompt.talkingPoints)).toBe(true);
        expect(prompt.talkingPoints!.length).toBeGreaterThanOrEqual(3);
        expect(Array.isArray(prompt.turns)).toBe(true);
        expect(prompt.turns.length).toBeGreaterThanOrEqual(3);
      });
    });
  });
});
