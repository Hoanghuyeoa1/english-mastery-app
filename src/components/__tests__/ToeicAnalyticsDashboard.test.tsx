// @vitest-environment happy-dom
// src/components/__tests__/ToeicAnalyticsDashboard.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ToeicAnalyticsDashboard } from '../ToeicAnalyticsDashboard';
import {
  ToeicWeaknessProfile,
  ToeicAttemptAnalytics,
  ToeicInsight,
} from '../../types/toeic';

describe('TOEIC Phase 4 — Analytics Dashboard UI Component', () => {
  const createMockProfile = (overrides?: Partial<ToeicWeaknessProfile>): ToeicWeaknessProfile => ({
    profileId: 'test_profile_123',
    generatedAt: Date.now(),
    confidence: 'high',
    evidenceSummary: {
      totalAttempts: 4,
      totalQuestionsEvaluated: 60,
      objectiveEvaluated: 56,
      openEndedEvaluated: 4,
      modeBreakdown: {
        mock: 2,
        diagnostic: 1,
        practice: 1,
      },
      scopeBreakdown: {
        '2-skills': 3,
        '4-skills': 1,
      },
      firstAttemptAnswerGuaranteed: true,
      dateRange: {
        earliest: Date.now() - 86400000 * 7,
        latest: Date.now(),
      },
    },
    aggregates: {
      bySkill: {
        listening: {
          skill: 'listening',
          isObjective: true,
          totalSeen: 30,
          totalAttempted: 30,
          totalCorrect: 22,
          totalIncorrect: 8,
          totalUnanswered: 0,
          accuracy: 73,
          evidenceCount: 30,
          attemptsCount: 4,
          scaledScoreAvg: 360,
        },
        reading: {
          skill: 'reading',
          isObjective: true,
          totalSeen: 26,
          totalAttempted: 26,
          totalCorrect: 12,
          totalIncorrect: 14,
          totalUnanswered: 0,
          accuracy: 46,
          evidenceCount: 26,
          attemptsCount: 4,
          scaledScoreAvg: 230,
        },
        speaking: {
          skill: 'speaking',
          isObjective: false,
          totalSeen: 2,
          evidenceCount: 2,
          attemptsCount: 1,
          averageScore: 140,
          averageWordCount: 85,
          accuracy: null,
        },
        writing: {
          skill: 'writing',
          isObjective: false,
          totalSeen: 2,
          evidenceCount: 2,
          attemptsCount: 1,
          averageScore: 150,
          averageWordCount: 120,
          accuracy: null,
        },
      },
      byPart: {
        part1_photos: {
          part: 'part1_photos',
          partName: 'Part 1: Photographs',
          skill: 'listening',
          isObjective: true,
          totalSeen: 6,
          totalAttempted: 6,
          totalCorrect: 5,
          totalIncorrect: 1,
          totalUnanswered: 0,
          accuracy: 83,
          evidenceCount: 6,
          attemptsCount: 3,
          averageDifficultyLevel: 1.5,
          averageEstimatedDifficulty: 1.5,
        },
        part2_qna: {
          part: 'part2_qna',
          partName: 'Part 2: Question & Response',
          skill: 'listening',
          isObjective: true,
          totalSeen: 8,
          totalAttempted: 8,
          totalCorrect: 6,
          totalIncorrect: 2,
          totalUnanswered: 0,
          accuracy: 75,
          evidenceCount: 8,
          attemptsCount: 3,
          averageDifficultyLevel: 2,
          averageEstimatedDifficulty: 2,
        },
        part3_conv: {
          part: 'part3_conv',
          partName: 'Part 3: Short Conversations',
          skill: 'listening',
          isObjective: true,
          totalSeen: 8,
          totalAttempted: 8,
          totalCorrect: 3,
          totalIncorrect: 5,
          totalUnanswered: 0,
          accuracy: 38,
          evidenceCount: 8,
          attemptsCount: 3,
          averageDifficultyLevel: 2.2,
          averageEstimatedDifficulty: 2.2,
        },
        part4_talks: {
          part: 'part4_talks',
          partName: 'Part 4: Short Talks',
          skill: 'listening',
          isObjective: true,
          totalSeen: 8,
          totalAttempted: 8,
          totalCorrect: 6,
          totalIncorrect: 2,
          totalUnanswered: 0,
          accuracy: 75,
          evidenceCount: 8,
          attemptsCount: 3,
          averageDifficultyLevel: 2.3,
          averageEstimatedDifficulty: 2.3,
        },
        part5_grammar: {
          part: 'part5_grammar',
          partName: 'Part 5: Incomplete Sentences',
          skill: 'reading',
          isObjective: true,
          totalSeen: 12,
          totalAttempted: 12,
          totalCorrect: 10,
          totalIncorrect: 2,
          totalUnanswered: 0,
          accuracy: 83,
          evidenceCount: 12,
          attemptsCount: 4,
          averageDifficultyLevel: 1.8,
          averageEstimatedDifficulty: 1.8,
        },
        part6_text: {
          part: 'part6_text',
          partName: 'Part 6: Text Completion',
          skill: 'reading',
          isObjective: true,
          totalSeen: 6,
          totalAttempted: 6,
          totalCorrect: 3,
          totalIncorrect: 3,
          totalUnanswered: 0,
          accuracy: 50,
          evidenceCount: 6,
          attemptsCount: 2,
          averageDifficultyLevel: 2.1,
          averageEstimatedDifficulty: 2.1,
        },
        part7_reading: {
          part: 'part7_reading',
          partName: 'Part 7: Reading Comprehension',
          skill: 'reading',
          isObjective: true,
          totalSeen: 8,
          totalAttempted: 8,
          totalCorrect: 3,
          totalIncorrect: 5,
          totalUnanswered: 0,
          accuracy: 38,
          evidenceCount: 8,
          attemptsCount: 3,
          averageDifficultyLevel: 2.6,
          averageEstimatedDifficulty: 2.6,
        },
      },
      bySubSkill: {},
      byDifficulty: {
        easy: { difficulty: 'easy', difficultyLevel: 1, totalSeen: 15, totalAttempted: 15, totalCorrect: 12, totalIncorrect: 3, totalUnanswered: 0, accuracy: 80, evidenceCount: 15 },
        medium: { difficulty: 'medium', difficultyLevel: 2, totalSeen: 25, totalAttempted: 25, totalCorrect: 16, totalIncorrect: 9, totalUnanswered: 0, accuracy: 64, evidenceCount: 25 },
        hard: { difficulty: 'hard', difficultyLevel: 3, totalSeen: 16, totalAttempted: 16, totalCorrect: 6, totalIncorrect: 10, totalUnanswered: 0, accuracy: 38, evidenceCount: 16 },
      },
    },
    strengths: [
      {
        type: 'part',
        key: 'part5_grammar',
        displayName: 'Part 5: Incomplete Sentences',
        skill: 'reading',
        classification: 'strength',
        severity: 0,
        priorityScore: 0,
        accuracy: 83,
        weightedAccuracy: 85,
        evidenceCount: 12,
        attemptsSeen: 4,
        correctCount: 10,
        incorrectCount: 2,
        unansweredCount: 0,
        averageDifficultyLevel: 1.8,
        confidence: 'high',
        trend: 'improving',
        recommendation: 'Phong độ xuất sắc!',
        sourceBreakdown: {
          diagnostic: { attempts: 1, evidenceCount: 3, correct: 2 },
          practice: { attempts: 1, evidenceCount: 3, correct: 3 },
          mock: { attempts: 2, evidenceCount: 6, correct: 5 },
        },
      },
    ],
    weaknesses: [
      {
        type: 'subSkill',
        key: 'inference_author',
        displayName: 'Part 7 — Inference (Suy luận ý đồ)',
        skill: 'reading',
        classification: 'weakness',
        severity: 65,
        priorityScore: 82,
        accuracy: 38,
        weightedAccuracy: 35,
        evidenceCount: 8,
        attemptsSeen: 3,
        correctCount: 3,
        incorrectCount: 5,
        unansweredCount: 0,
        averageDifficultyLevel: 2.6,
        confidence: 'high',
        trend: 'declining',
        recommendation: 'Rèn luyện kỹ năng đọc câu hỏi và xác định từ khóa định vị trong đoạn văn.',
        sourceBreakdown: {
          diagnostic: { attempts: 1, evidenceCount: 2, correct: 1 },
          practice: { attempts: 0, evidenceCount: 0, correct: 0 },
          mock: { attempts: 2, evidenceCount: 6, correct: 2 },
        },
      },
    ],
    priorities: [
      {
        type: 'subSkill',
        key: 'inference_author',
        displayName: 'Part 7 — Inference (Suy luận ý đồ)',
        skill: 'reading',
        classification: 'weakness',
        severity: 65,
        priorityScore: 82,
        accuracy: 38,
        weightedAccuracy: 35,
        evidenceCount: 8,
        attemptsSeen: 3,
        correctCount: 3,
        incorrectCount: 5,
        unansweredCount: 0,
        averageDifficultyLevel: 2.6,
        confidence: 'high',
        trend: 'declining',
        recommendation: 'Rèn luyện kỹ năng đọc câu hỏi và xác định từ khóa định vị trong đoạn văn.',
        sourceBreakdown: {
          diagnostic: { attempts: 1, evidenceCount: 2, correct: 1 },
          practice: { attempts: 0, evidenceCount: 0, correct: 0 },
          mock: { attempts: 2, evidenceCount: 6, correct: 2 },
        },
      },
    ],
    neutralOrInsufficient: [],
    ...overrides,
  });

  describe('1. Dashboard with Sufficient Data', () => {
    it('renders Overall Profile header with confidence badge and source breakdown', () => {
      const profile = createMockProfile();
      render(<ToeicAnalyticsDashboard profile={profile} />);

      expect(screen.getByText('Hồ Sơ Năng Lực & Điểm Yếu TOEIC')).toBeDefined();
      expect(screen.getAllByText('Độ tin cậy: Cao').length).toBeGreaterThan(0);
      expect(screen.getByText('60')).toBeDefined(); // total questions
      expect(screen.getAllByText(/2 bài/i).length).toBeGreaterThan(0); // mock count and open-ended count
    });

    it('renders Skills Overview without fake accuracy for Speaking and Writing', () => {
      const profile = createMockProfile();
      render(<ToeicAnalyticsDashboard profile={profile} />);

      // Listening & Reading have percentage accuracy
      expect(screen.getByText('73%')).toBeDefined();
      expect(screen.getByText('46%')).toBeDefined();

      // Speaking & Writing display score /200 and 'Tự luận mở' label
      expect(screen.getByText('140/200')).toBeDefined();
      expect(screen.getByText('150/200')).toBeDefined();
      const openEndedLabels = screen.getAllByText('Tự luận mở');
      expect(openEndedLabels.length).toBe(2);
    });

    it('renders Part Breakdown with accuracy percentages and question counts', () => {
      const profile = createMockProfile();
      render(<ToeicAnalyticsDashboard profile={profile} />);

      expect(screen.getByText('Part 1: Photographs')).toBeDefined();
      expect(screen.getAllByText('83%').length).toBeGreaterThan(0);
      expect(screen.getByText('Part 7: Reading Comprehension')).toBeDefined();
      expect(screen.getAllByText('38%').length).toBeGreaterThan(0);
    });

    it('renders Weakness cards and Strength cards distinctly', () => {
      const profile = createMockProfile();
      render(<ToeicAnalyticsDashboard profile={profile} />);

      // Weakness section
      expect(screen.getByText(/Điểm Yếu Đã Xác Nhận/i)).toBeDefined();
      expect(screen.getAllByText('Part 7 — Inference (Suy luận ý đồ)').length).toBeGreaterThan(0);

      // Strength section
      expect(screen.getByText(/Điểm Mạnh Vững Vàng/i)).toBeDefined();
      expect(screen.getAllByText('Part 5: Incomplete Sentences').length).toBeGreaterThan(0);
    });

    it('renders Top Priorities with rank badge (#1) and triggers onExecuteAction when clicked', () => {
      const profile = createMockProfile();
      const onExecuteMock = vi.fn();
      render(<ToeicAnalyticsDashboard profile={profile} onExecuteAction={onExecuteMock} />);

      expect(screen.getByText('#1')).toBeDefined();

      // Click primary action button in top priority
      const actionButtons = screen.getAllByRole('button');
      const practiceButton = actionButtons.find((btn) => btn.textContent?.includes('Luyện'));
      expect(practiceButton).toBeDefined();

      fireEvent.click(practiceButton!);
      expect(onExecuteMock).toHaveBeenCalled();
    });
  });

  describe('2. Low-data State', () => {
    it('displays caution banner and avoids fake weaknesses when data is insufficient', () => {
      const lowProfile = createMockProfile({
        confidence: 'insufficient',
        evidenceSummary: {
          totalAttempts: 1,
          totalQuestionsEvaluated: 3,
          objectiveEvaluated: 3,
          openEndedEvaluated: 0,
          modeBreakdown: { mock: 0, diagnostic: 1, practice: 0 },
          scopeBreakdown: { '2-skills': 1, '4-skills': 0 },
          firstAttemptAnswerGuaranteed: true,
          dateRange: { earliest: Date.now(), latest: Date.now() },
        },
        weaknesses: [],
        priorities: [],
      });

      render(<ToeicAnalyticsDashboard profile={lowProfile} />);

      expect(screen.getByText('Cần thêm dữ liệu để xác định điểm yếu ổn định.')).toBeDefined();
      expect(screen.getByText(/tránh kết luận sai lệch khi học viên chỉ mới làm vài câu/i)).toBeDefined();
      expect(screen.queryByText(/Your weakness is Part/i)).toBeNull();
    });

    it('renders separate Current Attempt Observations when currentAttempt is provided during low-data state', () => {
      const lowProfile = createMockProfile({
        confidence: 'insufficient',
        evidenceSummary: {
          totalAttempts: 1,
          totalQuestionsEvaluated: 2,
          objectiveEvaluated: 2,
          openEndedEvaluated: 0,
          modeBreakdown: { mock: 0, diagnostic: 1, practice: 0 },
          scopeBreakdown: { '2-skills': 1, '4-skills': 0 },
          firstAttemptAnswerGuaranteed: true,
          dateRange: { earliest: Date.now(), latest: Date.now() },
        },
      });

      const mockAttempt: ToeicAttemptAnalytics = {
        attemptId: 'att_123',
        completedAt: Date.now(),
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
        overall: {
          totalItems: 10,
          objectiveCount: 10,
          openEndedCount: 0,
          attemptedCount: 10,
          unansweredCount: 0,
          correctCount: 6,
          incorrectCount: 4,
          accuracy: 60,
          durationSeconds: 900,
          timeSpentSeconds: 420,
          completionRate: 100,
        },
        bySkill: {
          listening: {
            skill: 'listening',
            isObjective: true,
            questionsSeen: 5,
            attempted: 5,
            correct: 3,
            incorrect: 2,
            unanswered: 0,
            accuracy: 60,
            evidenceCount: 5,
          },
          reading: {
            skill: 'reading',
            isObjective: true,
            questionsSeen: 5,
            attempted: 5,
            correct: 3,
            incorrect: 2,
            unanswered: 0,
            accuracy: 60,
            evidenceCount: 5,
          },
          speaking: {
            skill: 'speaking',
            isObjective: false,
            questionsSeen: 0,
            hasEvidence: false,
            evidenceCount: 0,
            accuracy: null,
          },
          writing: {
            skill: 'writing',
            isObjective: false,
            questionsSeen: 0,
            hasEvidence: false,
            evidenceCount: 0,
            accuracy: null,
          },
        },
        byPart: {},
        bySubSkill: {},
        byDifficulty: {
          easy: { difficulty: 'easy', difficultyLevel: 1, questionsSeen: 3, attempted: 3, correct: 2, incorrect: 1, unanswered: 0, accuracy: 67 },
          medium: { difficulty: 'medium', difficultyLevel: 2, questionsSeen: 4, attempted: 4, correct: 3, incorrect: 1, unanswered: 0, accuracy: 75 },
          hard: { difficulty: 'hard', difficultyLevel: 3, questionsSeen: 3, attempted: 3, correct: 1, incorrect: 2, unanswered: 0, accuracy: 33 },
        },
        experienceSemantics: {
          experienceMode: 'diagnostic',
          evidenceSource: 'estimate_adaptive',
          isFirstAttemptEvidence: true,
        },
      };

      render(<ToeicAnalyticsDashboard profile={lowProfile} currentAttempt={mockAttempt} />);

      expect(screen.getByText(/Quan sát từ lượt thi hiện tại/i)).toBeDefined();
      expect(screen.getByText('60%')).toBeDefined();
      expect(screen.getByText(/Đây là kết quả tức thời của bài thi vừa nộp/i)).toBeDefined();
    });
  });

  describe('3. Trend UI Behavior', () => {
    it('renders Insufficient Data label and NEVER defaults to Stable when trend is insufficient', () => {
      const profile = createMockProfile({
        priorities: [
          {
            type: 'subSkill',
            key: 'inference_author',
            displayName: 'Part 7 — Inference',
            skill: 'reading',
            classification: 'weakness',
            severity: 60,
            priorityScore: 70,
            accuracy: 40,
            evidenceCount: 5,
            attemptsSeen: 1,
            correctCount: 2,
            incorrectCount: 3,
            unansweredCount: 0,
            averageDifficultyLevel: 2,
            confidence: 'low',
            trend: 'insufficient_data',
            sourceBreakdown: {
              diagnostic: { attempts: 1, evidenceCount: 5, correct: 2 },
              practice: { attempts: 0, evidenceCount: 0, correct: 0 },
              mock: { attempts: 0, evidenceCount: 0, correct: 0 },
            },
          },
        ],
      });

      render(<ToeicAnalyticsDashboard profile={profile} />);

      expect(screen.getAllByText('Chưa đủ dữ liệu (cần ≥ 3 bài)').length).toBeGreaterThan(0);
    });

    it('renders Improving and Declining trends with explicit semantic labels', () => {
      const profile = createMockProfile({
        weaknesses: [
          {
            type: 'subSkill',
            key: 'item_declining',
            displayName: 'Declining Skill',
            skill: 'reading',
            classification: 'weakness',
            severity: 70,
            priorityScore: 80,
            accuracy: 30,
            evidenceCount: 15,
            attemptsSeen: 3,
            correctCount: 4,
            incorrectCount: 11,
            unansweredCount: 0,
            averageDifficultyLevel: 2,
            confidence: 'high',
            trend: 'declining',
            sourceBreakdown: {
              diagnostic: { attempts: 1, evidenceCount: 5, correct: 1 },
              practice: { attempts: 0, evidenceCount: 0, correct: 0 },
              mock: { attempts: 2, evidenceCount: 10, correct: 3 },
            },
          },
        ],
        strengths: [
          {
            type: 'subSkill',
            key: 'item_improving',
            displayName: 'Improving Skill',
            skill: 'listening',
            classification: 'strength',
            severity: 0,
            priorityScore: 0,
            accuracy: 85,
            evidenceCount: 15,
            attemptsSeen: 3,
            correctCount: 13,
            incorrectCount: 2,
            unansweredCount: 0,
            averageDifficultyLevel: 2,
            confidence: 'high',
            trend: 'improving',
            sourceBreakdown: {
              diagnostic: { attempts: 1, evidenceCount: 5, correct: 4 },
              practice: { attempts: 0, evidenceCount: 0, correct: 0 },
              mock: { attempts: 2, evidenceCount: 10, correct: 9 },
            },
          },
        ],
      });

      render(<ToeicAnalyticsDashboard profile={profile} />);

      expect(screen.getAllByText('Đang sụt giảm (-10%)').length).toBeGreaterThan(0);
    });
  });

  describe('4. Accessibility', () => {
    it('has semantic role="region" and aria-label', () => {
      const profile = createMockProfile();
      render(<ToeicAnalyticsDashboard profile={profile} />);

      const dashboardRegion = screen.getByRole('region', {
        name: 'Bảng phân tích năng lực và điểm yếu TOEIC',
      });
      expect(dashboardRegion).toBeDefined();
    });
  });
});
