import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { gradeEssay, scoreToCEFRLevel } from '../essayGradingService';
import { recordSkillScore, getFourSkillsCompetency } from '../skillsCompetencyService';

describe('Essay Grading Integration & State Synchronization Audit', () => {
  beforeEach(() => {
    // Reset Zustand store state before test
    useAppStore.setState({
      geminiApiKey: '',
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
    });
  });

  it('1. Đấu nối chấm bài luận với Fallback Engine (Zero-Crash) và kiểm tra schema đầy đủ', async () => {
    const testEssay = 'In my opinion, technology is very important for education. It helps students learn effectively.';
    const result = await gradeEssay({
      essay: testEssay,
      topic: 'Technology in Education',
      targetLevel: 'B2',
    });

    expect(result).toBeDefined();
    expect(result.isFallback).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.overallCEFR).toBe(scoreToCEFRLevel(result.overallScore));

    // Kiểm tra đủ 4 tiêu chí CEFR
    expect(result.criteria.taskAchievement).toBeDefined();
    expect(result.criteria.coherenceCohesion).toBeDefined();
    expect(result.criteria.lexicalResource).toBeDefined();
    expect(result.criteria.grammaticalAccuracy).toBeDefined();

    // Kiểm tra danh sách phân đoạn diffSegments
    expect(Array.isArray(result.diffSegments)).toBe(true);
    expect(result.diffSegments.length).toBeGreaterThan(0);

    // Kiểm tra tính toàn vẹn 100% văn bản
    const reconstructed = result.diffSegments.map((s) => s.originalText || '').join('');
    expect(reconstructed).toBe(testEssay);
  });

  it('2. Đồng bộ điểm số vào useAppStore & skillsCompetencyService khi người học bấm Lưu Điểm Năng Lực', () => {
    // Ban đầu điểm writing rỗng
    const initialCompetency = getFourSkillsCompetency({});
    expect(initialCompetency.writing.score).toBe(0);
    expect(initialCompetency.writing.totalAttempts).toBe(0);

    // Giả lập lưu điểm chấm bài luận lần 1: 82 điểm
    recordSkillScore('writing', 82);

    let storeScores = useAppStore.getState().fourSkillsScores;
    expect(storeScores.writing).toContain(82);

    let competency = getFourSkillsCompetency({});
    expect(competency.writing.score).toBe(82);
    // Attempt 1: Capped at B1 by promotion gate (B2 requires >= 2 attempts)
    expect(competency.writing.level).toBe('B1');
    expect(competency.writing.totalAttempts).toBe(1);

    // Giả lập lưu điểm bài luận lần 2: 90 điểm
    recordSkillScore('writing', 90);
    storeScores = useAppStore.getState().fourSkillsScores;
    expect(storeScores.writing).toEqual([82, 90]);

    competency = getFourSkillsCompetency({});
    // Trung bình (82 + 90) / 2 = 86 -> B2 (C1 requires >= 3 attempts with task evidence)
    expect(competency.writing.score).toBe(86);
    expect(competency.writing.level).toBe('B2');
    expect(competency.writing.totalAttempts).toBe(2);
  });
});
