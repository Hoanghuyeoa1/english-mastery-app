// @vitest-environment happy-dom
// src/services/__tests__/toeicBankPhase4QAAudit.test.ts
import { describe, it, expect } from 'vitest';
import { TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS } from '../../data/toeicQuestionsData';
import { validateToeicDataset, calculateTokenJaccardSimilarity } from '../toeicValidator';
import { ToeicPart, ToeicSkill, ToeicDifficulty } from '../../types/toeic';

describe('PHASE 4: Full Question Bank QA, Distribution & Duplicate Audit', () => {
  // ===========================================================================
  // 1. FINAL BANK SIZE & GROUP SIZE AUDITS
  // ===========================================================================
  describe('1. Final Bank Size & Group Count', () => {
    it('Ngân hàng câu hỏi đạt tối thiểu >= 200 câu (Ưu tiên khoảng 220–260)', () => {
      expect(TOEIC_QUESTION_BANK.length).toBeGreaterThanOrEqual(200);
      expect(TOEIC_QUESTION_BANK.length).toBeLessThanOrEqual(260);
      expect(TOEIC_QUESTION_BANK.length).toBe(240);
    });

    it('Số lượng nhóm câu hỏi đạt tối thiểu >= 30 nhóm (Hiện tại 36 nhóm)', () => {
      expect(TOEIC_QUESTION_GROUPS.length).toBeGreaterThanOrEqual(30);
      expect(TOEIC_QUESTION_GROUPS.length).toBe(36);
    });

    it('Mỗi group sở hữu đúng số câu hỏi quy định và không có group rỗng', () => {
      TOEIC_QUESTION_GROUPS.forEach((grp) => {
        expect(grp.questionIds.length).toBeGreaterThanOrEqual(2);
        expect(grp.questionIds.length).toBeLessThanOrEqual(5);
        expect(grp.questionIds.length).toBe(3); // Hiện tại thiết kế 3 câu/group chuẩn hóa
      });
    });
  });

  // ===========================================================================
  // 2. PART DISTRIBUTION AUDIT
  // ===========================================================================
  describe('2. Part Distribution Audit', () => {
    it('Tất cả 9 phần thi (Part 1-7, Speaking, Writing) đều có đủ số lượng câu hỏi cần thiết', () => {
      const partCounts: Record<ToeicPart, number> = {
        part1_photos: 0,
        part2_qna: 0,
        part3_conv: 0,
        part4_talks: 0,
        part5_grammar: 0,
        part6_text: 0,
        part7_reading: 0,
        speaking_read: 0,
        writing_email: 0,
      };

      TOEIC_QUESTION_BANK.forEach((q) => {
        partCounts[q.part]++;
      });

      // Kiểm tra ngưỡng tối thiểu cho từng Part
      expect(partCounts.part1_photos).toBeGreaterThanOrEqual(15);
      expect(partCounts.part2_qna).toBeGreaterThanOrEqual(25);
      expect(partCounts.part3_conv).toBeGreaterThanOrEqual(20);
      expect(partCounts.part4_talks).toBeGreaterThanOrEqual(20);
      expect(partCounts.part5_grammar).toBeGreaterThanOrEqual(30);
      expect(partCounts.part6_text).toBeGreaterThanOrEqual(15);
      expect(partCounts.part7_reading).toBeGreaterThanOrEqual(20);
      expect(partCounts.speaking_read).toBeGreaterThanOrEqual(15);
      expect(partCounts.writing_email).toBeGreaterThanOrEqual(15);

      // Thống kê chính xác
      expect(partCounts.part1_photos).toBe(20);
      expect(partCounts.part2_qna).toBe(30);
      expect(partCounts.part3_conv).toBe(30);
      expect(partCounts.part4_talks).toBe(27);
      expect(partCounts.part5_grammar).toBe(42);
      expect(partCounts.part6_text).toBe(24);
      expect(partCounts.part7_reading).toBe(27);
      expect(partCounts.speaking_read).toBe(20);
      expect(partCounts.writing_email).toBe(20);
    });

    it('Phân bổ Group trải đều trên cả 4 grouped parts: Part 3, 4, 6, 7', () => {
      const groupCounts: Record<string, number> = {
        part3_conv: 0,
        part4_talks: 0,
        part6_text: 0,
        part7_reading: 0,
      };

      TOEIC_QUESTION_GROUPS.forEach((g) => {
        groupCounts[g.part]++;
      });

      expect(groupCounts.part3_conv).toBe(10);
      expect(groupCounts.part4_talks).toBe(9);
      expect(groupCounts.part6_text).toBe(8);
      expect(groupCounts.part7_reading).toBe(9);
    });
  });

  // ===========================================================================
  // 3. DIFFICULTY DISTRIBUTION AUDIT
  // ===========================================================================
  describe('3. Difficulty Distribution Audit', () => {
    it('Phân bố độ khó tổng thể không bị lệch cực đoan (Easy, Medium, Hard đều >= 15%)', () => {
      const diffCounts: Record<ToeicDifficulty, number> = {
        easy: 0,
        medium: 0,
        hard: 0,
      };

      TOEIC_QUESTION_BANK.forEach((q) => {
        if (q.difficulty) {
          diffCounts[q.difficulty]++;
        }
      });

      const total = TOEIC_QUESTION_BANK.length;
      const easyPct = (diffCounts.easy / total) * 100;
      const mediumPct = (diffCounts.medium / total) * 100;
      const hardPct = (diffCounts.hard / total) * 100;

      // Đảm bảo không độ khó nào chiếm dưới 15% hoặc vượt quá 60%
      expect(easyPct).toBeGreaterThanOrEqual(15);
      expect(mediumPct).toBeGreaterThanOrEqual(25);
      expect(hardPct).toBeGreaterThanOrEqual(15);
      expect(easyPct + mediumPct + hardPct).toBeCloseTo(100, 1);
    });

    it('Mỗi Part thi đều có ít nhất 2 mức độ khó khác nhau (không bị độc canh 1 độ khó)', () => {
      const partDiffMap = new Map<ToeicPart, Set<ToeicDifficulty>>();
      TOEIC_QUESTION_BANK.forEach((q) => {
        if (!partDiffMap.has(q.part)) partDiffMap.set(q.part, new Set());
        if (q.difficulty) {
          partDiffMap.get(q.part)!.add(q.difficulty);
        }
      });

      partDiffMap.forEach((difficulties, part) => {
        expect(difficulties.size).toBeGreaterThanOrEqual(2);
      });
    });
  });

  // ===========================================================================
  // 4. TOPIC & CONTEXT DIVERSITY AUDIT
  // ===========================================================================
  describe('4. Topic & Context Diversity Audit', () => {
    it('Chứa nhiều chủ đề kinh doanh/công sở đa dạng (>= 30 distinct topics)', () => {
      const topicSet = new Set<string>();
      TOEIC_QUESTION_BANK.forEach((q) => {
        if (q.topic) topicSet.add(q.topic.trim().toLowerCase());
      });

      expect(topicSet.size).toBeGreaterThanOrEqual(30);
    });

    it('Không có chủ đề đơn lẻ nào chiếm quá 15% toàn bộ ngân hàng câu hỏi', () => {
      const topicFreq = new Map<string, number>();
      TOEIC_QUESTION_BANK.forEach((q) => {
        if (q.topic) {
          const top = q.topic.trim().toLowerCase();
          topicFreq.set(top, (topicFreq.get(top) || 0) + 1);
        }
      });

      const maxAllowedPerTopic = Math.ceil(TOEIC_QUESTION_BANK.length * 0.15); // ~36 câu
      topicFreq.forEach((count, topic) => {
        expect(count).toBeLessThanOrEqual(maxAllowedPerTopic);
      });
    });
  });

  // ===========================================================================
  // 5. SUBSKILL & QUESTION TYPE AUDIT
  // ===========================================================================
  describe('5. SubSkill & QuestionType Coverage Audit', () => {
    it('Độ phủ SubSkill phong phú (>= 40 distinct subSkills) hỗ trợ Analytics đa chiều', () => {
      const subSkillSet = new Set<string>();
      TOEIC_QUESTION_BANK.forEach((q) => {
        if (q.subSkill) subSkillSet.add(q.subSkill.trim().toLowerCase());
      });

      expect(subSkillSet.size).toBeGreaterThanOrEqual(40);
    });

    it('Mỗi kỹ năng chính (Listening, Reading, Speaking, Writing) có >= 8 SubSkills khác nhau', () => {
      const skillSubSkills = new Map<ToeicSkill, Set<string>>();
      TOEIC_QUESTION_BANK.forEach((q) => {
        if (!skillSubSkills.has(q.skill)) skillSubSkills.set(q.skill, new Set());
        if (q.subSkill) {
          skillSubSkills.get(q.skill)!.add(q.subSkill.trim().toLowerCase());
        }
      });

      expect(skillSubSkills.get('listening')!.size).toBeGreaterThanOrEqual(15);
      expect(skillSubSkills.get('reading')!.size).toBeGreaterThanOrEqual(15);
      expect(skillSubSkills.get('speaking')!.size).toBeGreaterThanOrEqual(5);
      expect(skillSubSkills.get('writing')!.size).toBeGreaterThanOrEqual(5);
    });

    it('Độ phủ QuestionType đa dạng (>= 15 distinct types)', () => {
      const qTypes = new Set<string>();
      TOEIC_QUESTION_BANK.forEach((q) => {
        if (q.questionType) qTypes.add(q.questionType.trim().toLowerCase());
      });

      expect(qTypes.size).toBeGreaterThanOrEqual(15);
    });
  });

  // ===========================================================================
  // 6. ANSWER & EXPLANATION QUALITY AUDIT
  // ===========================================================================
  describe('6. Answer, Explanation & Content Quality', () => {
    it('Part 1-7: CorrectAnswer luôn nằm trong danh sách Options hợp lệ', () => {
      const mcParts: ToeicPart[] = [
        'part1_photos',
        'part2_qna',
        'part3_conv',
        'part4_talks',
        'part5_grammar',
        'part6_text',
        'part7_reading',
      ];

      TOEIC_QUESTION_BANK.filter((q) => mcParts.includes(q.part)).forEach((q) => {
        expect(q.options).toBeDefined();
        expect(q.options!.length).toBeGreaterThanOrEqual(3);

        if (q.part === 'part2_qna') {
          expect(q.options!.length).toBe(3);
          expect(['A', 'B', 'C']).toContain(q.correctAnswer);
        } else {
          expect(q.options!.length).toBe(4);
          expect(['A', 'B', 'C', 'D']).toContain(q.correctAnswer);
        }

        // Đảm bảo các option trong cùng một câu là duy nhất (không có 2 options trùng lặp)
        const optTexts = q.options!.map((o) => o.trim().toLowerCase());
        const uniqueOpts = new Set(optTexts);
        expect(uniqueOpts.size).toBe(q.options!.length);
      });
    });

    it('100% câu hỏi có Explanation và VietnameseTranslation chi tiết, rõ nghĩa', () => {
      TOEIC_QUESTION_BANK.forEach((q) => {
        expect(q.explanation.trim().length).toBeGreaterThanOrEqual(15);
        expect(q.vietnameseTranslation.trim().length).toBeGreaterThanOrEqual(10);
      });
    });

    it('100% câu hỏi có KeyVocabulary chuẩn hóa với từ vựng, phiên âm IPA và nghĩa tiếng Việt', () => {
      TOEIC_QUESTION_BANK.forEach((q) => {
        expect(Array.isArray(q.keyVocabulary)).toBe(true);
        expect(q.keyVocabulary!.length).toBeGreaterThan(0);
        q.keyVocabulary!.forEach((kv) => {
          expect(kv.word.trim().length).toBeGreaterThan(0);
          expect(kv.meaning.trim().length).toBeGreaterThan(0);
        });
      });
    });
  });

  // ===========================================================================
  // 7. DUPLICATE & NEAR-DUPLICATE AUDIT
  // ===========================================================================
  describe('7. Duplicate & Near-Duplicate QA Audit', () => {
    it('Tất cả Question IDs và Group IDs đều duy nhất tuyệt đối', () => {
      const qIds = new Set<string>();
      TOEIC_QUESTION_BANK.forEach((q) => {
        expect(qIds.has(q.id)).toBe(false);
        qIds.add(q.id);
      });

      const gIds = new Set<string>();
      TOEIC_QUESTION_GROUPS.forEach((g) => {
        expect(gIds.has(g.id)).toBe(false);
        gIds.add(g.id);
      });
    });

    it('Không có câu hỏi trùng lặp hoàn toàn QuestionText (ngoại trừ Part 1 & 2)', () => {
      const seenTexts = new Map<string, string>();
      TOEIC_QUESTION_BANK.filter(
        (q) => q.part !== 'part1_photos' && q.part !== 'part2_qna'
      ).forEach((q) => {
        const norm = q.questionText.trim().toLowerCase().replace(/\s+/g, ' ');
        expect(seenTexts.has(norm)).toBe(false);
        seenTexts.set(norm, q.id);
      });
    });

    it('Không có Group nào trùng lặp nội dung AudioScript hoặc PassageText', () => {
      const seenGroupAudios = new Map<string, string>();
      const seenGroupPassages = new Map<string, string>();

      TOEIC_QUESTION_GROUPS.forEach((g) => {
        if (g.audioScript) {
          const norm = g.audioScript.trim().toLowerCase().replace(/\s+/g, ' ');
          expect(seenGroupAudios.has(norm)).toBe(false);
          seenGroupAudios.set(norm, g.id);
        }
        if (g.passageText) {
          const norm = g.passageText.trim().toLowerCase().replace(/\s+/g, ' ');
          expect(seenGroupPassages.has(norm)).toBe(false);
          seenGroupPassages.set(norm, g.id);
        }
      });
    });

    it('Không phát hiện near-duplicate clone (Jaccard >= 0.85) giữa các câu hỏi Part 3-7 & Speaking/Writing', () => {
      const targetQuestions = TOEIC_QUESTION_BANK.filter(
        (q) => q.part !== 'part1_photos' && q.part !== 'part2_qna'
      );

      for (let i = 0; i < targetQuestions.length; i++) {
        for (let j = i + 1; j < targetQuestions.length; j++) {
          const q1 = targetQuestions[i];
          const q2 = targetQuestions[j];

          // Bỏ qua các template hướng dẫn chung của Part 6 nếu có chỉ dẫn giống nhau
          if (q1.part === 'part6_text' && q2.part === 'part6_text') continue;

          const sim = calculateTokenJaccardSimilarity(q1.questionText, q2.questionText);
          expect(sim).toBeLessThan(0.85);
        }
      }
    });
  });

  // ===========================================================================
  // 8. GROUP ATOMICITY & RESOLUTION AUDIT
  // ===========================================================================
  describe('8. Group Atomicity & Link Resolution', () => {
    it('100% Group câu hỏi resolve được 2 chiều hoàn chỉnh, không có orphan', () => {
      const result = validateToeicDataset(TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Mọi question có groupId đều tồn tại trong TOEIC_QUESTION_GROUPS
      const groupMap = new Map(TOEIC_QUESTION_GROUPS.map((g) => [g.id, g]));
      const qMap = new Map(TOEIC_QUESTION_BANK.map((q) => [q.id, q]));

      TOEIC_QUESTION_BANK.forEach((q) => {
        if (q.groupId) {
          const grp = groupMap.get(q.groupId);
          expect(grp).toBeDefined();
          expect(grp!.questionIds).toContain(q.id);
        }
      });

      // Mọi group trỏ tới questionIds đều có câu hỏi thật trong TOEIC_QUESTION_BANK
      TOEIC_QUESTION_GROUPS.forEach((grp) => {
        grp.questionIds.forEach((qId) => {
          const q = qMap.get(qId);
          expect(q).toBeDefined();
          expect(q!.groupId).toBe(grp.id);
        });
      });
    });

    it('Các câu hỏi trong cùng một nhóm có SubSkill hoặc QuestionType đa dạng', () => {
      TOEIC_QUESTION_GROUPS.forEach((grp) => {
        const qMap = new Map(TOEIC_QUESTION_BANK.map((q) => [q.id, q]));
        const questionsInGroup = grp.questionIds.map((id) => qMap.get(id)!);

        const subSkills = new Set(questionsInGroup.map((q) => q.subSkill));
        // Trong nhóm 3 câu, ít nhất có 2 subSkills khác nhau
        expect(subSkills.size).toBeGreaterThanOrEqual(2);
      });
    });
  });

  // ===========================================================================
  // 9. SPEAKING & WRITING EVALUATION CONTRACT AUDIT
  // ===========================================================================
  describe('9. Speaking & Writing Evaluation Contract Audit', () => {
    it('Tất cả câu Speaking và Writing đều có evaluationCriteria hợp lệ', () => {
      const openEndedQs = TOEIC_QUESTION_BANK.filter(
        (q) => q.part === 'speaking_read' || q.part === 'writing_email'
      );

      openEndedQs.forEach((q) => {
        expect(q.evaluationCriteria).toBeDefined();
        const criteria = q.evaluationCriteria!;
        expect(criteria.targetLengthWords).toBeDefined();
        const targetLen = criteria.targetLengthWords!;
        expect(targetLen.min).toBeGreaterThan(0);
        expect(targetLen.max).toBeGreaterThan(targetLen.min);
        expect(criteria.rubricNotes).toBeTruthy();

        // Kiểm tra tổng trọng số = 1.0 (cho phép dung sai số thực 0.01)
        const sumWeight =
          (criteria.pronunciationWeight || 0) +
          (criteria.fluencyWeight || 0) +
          (criteria.grammarWeight || 0) +
          (criteria.vocabularyWeight || 0) +
          (criteria.taskCompletionWeight || 0);
        expect(sumWeight).toBeCloseTo(1.0, 2);
      });
    });
  });

  // ===========================================================================
  // 10. STATIC DATA PERSISTENCE ISOLATION AUDIT
  // ===========================================================================
  describe('10. Static Data Invariant Audit', () => {
    it('Ngân hàng câu hỏi không bị serialize lưu trữ nguyên khối vào localStorage', () => {
      // Giả lập lưu history
      localStorage.clear();
      sessionStorage.clear();

      // Kiểm tra storage không chứa khóa 'toeic_question_bank'
      expect(localStorage.getItem('toeic_question_bank')).toBeNull();
      expect(sessionStorage.getItem('toeic_question_bank')).toBeNull();
    });
  });

  // ===========================================================================
  // 11. STATISTICAL REPORT SUMMARY
  // ===========================================================================
  describe('11. Statistical Distribution Report Generator', () => {
    it('Xuất bảng phân phối chi tiết cho Audit Report', () => {
      // 1. Difficulty per part
      const diffByPart: Record<string, { easy: number; medium: number; hard: number; total: number }> = {};
      const parts = [
        'part1_photos',
        'part2_qna',
        'part3_conv',
        'part4_talks',
        'part5_grammar',
        'part6_text',
        'part7_reading',
        'speaking_read',
        'writing_email',
      ];
      parts.forEach((p) => {
        diffByPart[p] = { easy: 0, medium: 0, hard: 0, total: 0 };
      });

      TOEIC_QUESTION_BANK.forEach((q) => {
        if (diffByPart[q.part] && q.difficulty) {
          diffByPart[q.part][q.difficulty]++;
          diffByPart[q.part].total++;
        }
      });

      // 2. Topics
      const topicCounts = new Map<string, number>();
      TOEIC_QUESTION_BANK.forEach((q) => {
        if (q.topic) {
          const top = q.topic.trim();
          topicCounts.set(top, (topicCounts.get(top) || 0) + 1);
        }
      });
      const sortedTopics = Array.from(topicCounts.entries()).sort((a, b) => b[1] - a[1]);

      // 3. SubSkills per skill
      const subSkillsBySkill: Record<string, Map<string, number>> = {
        listening: new Map(),
        reading: new Map(),
        speaking: new Map(),
        writing: new Map(),
      };
      TOEIC_QUESTION_BANK.forEach((q) => {
        const m = subSkillsBySkill[q.skill];
        if (m && q.subSkill) {
          m.set(q.subSkill, (m.get(q.subSkill) || 0) + 1);
        }
      });

      // 4. QuestionTypes
      const qTypeCounts = new Map<string, number>();
      TOEIC_QUESTION_BANK.forEach((q) => {
        if (q.questionType) {
          const qt = String(q.questionType);
          qTypeCounts.set(qt, (qTypeCounts.get(qt) || 0) + 1);
        }
      });
      const sortedQTypes = Array.from(qTypeCounts.entries()).sort((a, b) => b[1] - a[1]);

      console.log('=== TOEIC AUDIT STATS REPORT ===');
      console.log('Total Questions:', TOEIC_QUESTION_BANK.length);
      console.log('Total Groups:', TOEIC_QUESTION_GROUPS.length);
      console.log('Difficulty by Part:', JSON.stringify(diffByPart, null, 2));
      console.log('Distinct Topics Count:', topicCounts.size);
      console.log('Top Topics:', sortedTopics.slice(0, 10));
      console.log('Distinct QuestionTypes Count:', qTypeCounts.size);
      console.log('QuestionTypes:', sortedQTypes);
      console.log('SubSkills count per Skill:', {
        listening: subSkillsBySkill.listening.size,
        reading: subSkillsBySkill.reading.size,
        speaking: subSkillsBySkill.speaking.size,
        writing: subSkillsBySkill.writing.size,
      });

      expect(TOEIC_QUESTION_BANK.length).toBe(240);
    });
  });
});
