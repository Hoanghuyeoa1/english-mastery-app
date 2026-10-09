// src/services/nextActionResolver.ts
/**
 * Unified Next Best Action Resolver (Phase 8)
 * 
 * Orchestration & Routing Loop across all 9 Learning Modules:
 * SESSION COMPLETE → SUMMARY → NEXT BEST ACTION → TODAY HUB / NEXT SESSION
 * 
 * Architectural Invariants:
 * 1. Exactly at most 1 primary action and 1 optional secondary action.
 * 2. Deterministic 4-level priority cascade:
 *    - Priority 1: Weakness just discovered with credible, trusted evidence.
 *    - Priority 2: Current curriculum continuation (next lesson / prompt).
 *    - Priority 3: Next uncompleted item in Today Learning Plan.
 *    - Priority 4: Fallback to Today Learning Hub ('dashboard').
 * 3. Never invent weaknesses or actions without evidence.
 * 4. Strictly ignore AI fallback or untrusted telemetry for Priority 1.
 * 5. Side-effect free: Zero mutation of scheduler, FSRS/SM-2, XP, or persistence.
 * 6. Zero duplicate recommendation engine: pure derivation over existing state.
 */

import type {
  ActivePracticeConfig,
  ActiveTab,
  ArcadeMode,
  EssayGradingResult,
  PracticeModuleId,
  TodayLearningPlan,
} from '../types';
import type { SessionActionDescriptor, SessionFlowType } from '../types/sessionExperience';
import type {
  CefrLevel,
  CertificationEvaluationResult,
  CertificationEvaluationFailed,
} from '../types/levelCertification';
import { READING_LESSONS } from '../data/fourSkills/readingData';
import { LISTENING_LESSONS } from '../data/fourSkills/listeningData';
import { SPEAKING_PROMPTS } from '../data/fourSkills/speakingData';
import { WRITING_PROMPTS } from '../data/fourSkills/writingData';
import { executeLearningPlanAction } from './todayLearningPlanService';

export const TODAY_HUB_ACTION_ID = 'next-action-today-hub';
export const TODAY_HUB_ACTION_LABEL = 'Tiếp tục Kế Hoạch Hôm Nay';

export interface NextActionDispatchContext {
  navigateToTab: (tab: ActiveTab) => void;
  startAdaptivePractice?: (config: {
    module: PracticeModuleId;
    itemIds: string[];
    mistakeType?: any;
    startedAt?: number;
    planItemId?: string;
    planTitle?: string;
    planObjective?: string;
    estimatedMinutes?: number;
  }) => void;
  setActiveFourSkill?: (skill: 'reading' | 'listening' | 'speaking' | 'writing') => void;
  onCustomRetry?: () => void;
  onCustomCatalog?: () => void;
}

export interface SessionCompletionContext {
  flowType: SessionFlowType;

  // Checkpoint evidence (Phase 10)
  checkpoint?: {
    attemptId: string;
    level: CefrLevel;
    evaluation: CertificationEvaluationResult;
  };

  // Reading evidence
  reading?: {
    lessonId: string;
    incorrectQuestionCount?: number;
    scorePercent?: number;
  };

  // Listening evidence
  listening?: {
    lessonId: string;
    incorrectQuestionCount?: number;
    scorePercent?: number;
  };

  // Speaking evidence
  speaking?: {
    promptId: string;
    hasValidAudioEvidence?: boolean;
    averageScore?: number | null;
    weakWords?: string[];
  };

  // Writing evidence
  writing?: {
    promptId: string;
    gradingResult?: EssayGradingResult | null;
    detectedCollocations?: string[];
    detectedMistakes?: string[];
    isFallback?: boolean;
  };

  // Flashcard evidence
  flashcard?: {
    queueMode?: string;
    hardestCardCount?: number;
    hardestCardIds?: string[];
  };

  // TOEIC evidence
  toeic?: {
    examId?: string;
    weakestPart?: number;
    weakestPartScorePct?: number;
  };

  // Quiz evidence
  quiz?: {
    mode: ArcadeMode;
    score?: number;
    unresolvedMistakeIds?: string[];
  };

  // Pronunciation evidence
  pronunciation?: {
    word: string;
    accuracyScore: number | null;
    isSupported: boolean;
    isPermissionDenied: boolean;
  };

  // AI Tutor evidence
  tutor?: {
    scenarioId: string;
    userTurns?: number;
    detectedMistakeCount?: number;
  };

  // Task id in Today Learning Plan if current session was launched from one
  currentPlanItemId?: string;
}

export interface ResolvedNextActions {
  primaryAction: SessionActionDescriptor;
  secondaryAction?: SessionActionDescriptor;
  resolvedPriority: 1 | 2 | 3 | 4;
  rationale: string;
}

/**
 * Resolves the deterministic Next Best Actions for a completed session.
 * 
 * Always guarantees at most 1 primary action and 1 optional secondary action.
 */
export function resolveNextBestActions(
  completionContext: SessionCompletionContext,
  dispatchContext: NextActionDispatchContext,
  todayPlan?: TodayLearningPlan
): ResolvedNextActions {
  const { navigateToTab, startAdaptivePractice, setActiveFourSkill, onCustomRetry, onCustomCatalog } = dispatchContext;

  // -------------------------------------------------------------------------
  // 1. PRIORITY 1: Weakness vừa phát hiện có evidence đáng tin cậy
  // -------------------------------------------------------------------------

  // Checkpoint: Authentic CEFR Checkpoint Exam outcome (Phase 10)
  if (completionContext.flowType === 'checkpoint' && completionContext.checkpoint) {
    const chk = completionContext.checkpoint;
    const evaluation = chk.evaluation;

    if (!evaluation.isPassed) {
      const failed = evaluation as CertificationEvaluationFailed;
      const routes = failed.reinforcementRoutes || [];
      const primaryRoute = routes[0];

      if (primaryRoute) {
        const skillNameVi = getSkillVi(primaryRoute.skill);
        return {
          resolvedPriority: 1,
          rationale: `Bài kiểm định CEFR ${chk.level} chưa đạt do kỹ năng ${skillNameVi} (${primaryRoute.currentScore}%) dưới ngưỡng sàn (${primaryRoute.requiredFloor}%).`,
          primaryAction: {
            id: `next-action-reinforce-${primaryRoute.skill}`,
            label: `Củng Cố Kỹ Năng ${skillNameVi} ${chk.level}`,
            description: primaryRoute.description,
            isPrimary: true,
            variant: 'primary',
            onClick: () => {
              setActiveFourSkill?.(primaryRoute.skill);
              if (primaryRoute.sampleLessonOrPromptId && startAdaptivePractice) {
                startAdaptivePractice({
                  module: primaryRoute.skill,
                  itemIds: [primaryRoute.sampleLessonOrPromptId],
                  startedAt: Date.now(),
                });
              }
              navigateToTab('four_skills');
            },
          },
          secondaryAction: {
            id: 'next-action-today-hub',
            label: TODAY_HUB_ACTION_LABEL,
            variant: 'secondary',
            onClick: () => navigateToTab('dashboard'),
          },
        };
      }
    } else {
      // Passed / Certified
      return {
        resolvedPriority: 2,
        rationale: `Chúc mừng bạn đã đạt chứng chỉ CEFR ${chk.level}! Tiếp tục phát huy năng lực tiếng Anh toàn diện.`,
        primaryAction: {
          id: 'next-action-checkpoint-certified',
          label: 'Xem Chứng Chỉ & Lộ Trình Mới',
          description: `Bạn đã chính thức được chứng nhận đạt trình độ CEFR ${chk.level}`,
          isPrimary: true,
          variant: 'primary',
          onClick: () => navigateToTab('four_skills'),
        },
        secondaryAction: {
          id: 'next-action-today-hub',
          label: TODAY_HUB_ACTION_LABEL,
          variant: 'secondary',
          onClick: () => navigateToTab('dashboard'),
        },
      };
    }
  }

  // A. Writing: Real collocation / grammar feedback (strictly not fallback)
  if (completionContext.flowType === 'writing' && completionContext.writing) {
    const w = completionContext.writing;
    const isTrustedGrading = (w.gradingResult ? !w.gradingResult.isFallback : true) && !w.isFallback;

    if (isTrustedGrading) {
      const collocations = w.detectedCollocations || w.gradingResult?.criteria?.lexicalResource?.feedback ? [] : [];
      const weakCols = w.detectedCollocations && w.detectedCollocations.length > 0
        ? w.detectedCollocations
        : [];

      if (weakCols.length > 0) {
        return {
          resolvedPriority: 1,
          rationale: 'Phát hiện cụm từ (collocations) cần cải thiện từ kết quả chấm bài luận thực tế.',
          primaryAction: {
            id: 'next-action-weakness-collocations',
            label: 'Luyện Cụm Từ Cần Cải Thiện',
            description: `Ôn tập ${weakCols.length} cụm từ được phát hiện trong bài viết`,
            isPrimary: true,
            variant: 'primary',
            onClick: () => {
              startAdaptivePractice?.({
                module: 'flashcard',
                mistakeType: 'collocation',
                itemIds: weakCols,
                startedAt: Date.now(),
              });
              navigateToTab('flashcards');
            },
          },
          secondaryAction: {
            id: 'next-action-today-hub',
            label: TODAY_HUB_ACTION_LABEL,
            variant: 'secondary',
            onClick: () => navigateToTab('dashboard'),
          },
        };
      }

      if (w.detectedMistakes && w.detectedMistakes.length > 0) {
        return {
          resolvedPriority: 1,
          rationale: 'Phát hiện lỗi ngữ pháp/từ vựng cần khắc phục từ bài luận.',
          primaryAction: {
            id: 'next-action-weakness-mistakes',
            label: 'Khắc Phục Bẫy Lỗi Bài Viết',
            description: `Xem lại ${w.detectedMistakes.length} lỗi trong Sổ Tay Bẫy Lỗi`,
            isPrimary: true,
            variant: 'primary',
            onClick: () => navigateToTab('mistakes'),
          },
          secondaryAction: {
            id: 'next-action-today-hub',
            label: TODAY_HUB_ACTION_LABEL,
            variant: 'secondary',
            onClick: () => navigateToTab('dashboard'),
          },
        };
      }
    }
  }

  // B. Pronunciation Arena: Real speech evidence with accuracy < 75%
  if (completionContext.flowType === 'pronunciation' && completionContext.pronunciation) {
    const p = completionContext.pronunciation;
    const hasValidEvidence = p.isSupported && !p.isPermissionDenied && p.accuracyScore !== null;

    if (hasValidEvidence && p.accuracyScore! < 75) {
      return {
        resolvedPriority: 1,
        rationale: `Phát âm từ "${p.word}" đạt ${p.accuracyScore}%, cần rèn luyện thêm.`,
        primaryAction: {
          id: 'next-action-weakness-pronunciation',
          label: `Luyện Lại Từ Chưa Đạt (${p.word})`,
          description: `Độ chính xác ${p.accuracyScore}% cần cải thiện âm vị`,
          isPrimary: true,
          variant: 'primary',
          onClick: () => {
            if (onCustomRetry) {
              onCustomRetry();
            } else {
              navigateToTab('mistakes');
            }
          },
        },
        secondaryAction: {
          id: 'next-action-today-hub',
          label: TODAY_HUB_ACTION_LABEL,
          variant: 'secondary',
          onClick: () => navigateToTab('dashboard'),
        },
      };
    }
  }

  // C. Speaking in Four Skills: Valid audio evidence with weak words
  if (completionContext.flowType === 'speaking' && completionContext.speaking) {
    const s = completionContext.speaking;
    if (s.hasValidAudioEvidence && s.weakWords && s.weakWords.length > 0) {
      return {
        resolvedPriority: 1,
        rationale: 'Phát hiện các từ phát âm chưa chuẩn qua nhận diện giọng nói thực tế.',
        primaryAction: {
          id: 'next-action-weakness-speaking-words',
          label: 'Luyện Lại Từ Phát Âm Yếu',
          description: `Tập trung vào ${s.weakWords.length} từ cần phát âm chuẩn`,
          isPrimary: true,
          variant: 'primary',
          onClick: () => {
            startAdaptivePractice?.({
              module: 'pronunciation',
              itemIds: s.weakWords || [],
              startedAt: Date.now(),
            });
            navigateToTab('pronunciation');
          },
        },
        secondaryAction: {
          id: 'next-action-today-hub',
          label: TODAY_HUB_ACTION_LABEL,
          variant: 'secondary',
          onClick: () => navigateToTab('dashboard'),
        },
      };
    }
  }

  // D. Reading: Incorrect answers evidence
  if (completionContext.flowType === 'reading' && completionContext.reading) {
    const r = completionContext.reading;
    if (typeof r.incorrectQuestionCount === 'number' && r.incorrectQuestionCount > 0) {
      return {
        resolvedPriority: 1,
        rationale: `Có ${r.incorrectQuestionCount} câu đọc hiểu chưa chính xác cần rà soát lại.`,
        primaryAction: {
          id: 'next-action-weakness-reading-mistakes',
          label: 'Rà Soát Câu Hỏi Chưa Đúng',
          description: `Xem lại giải thích cho ${r.incorrectQuestionCount} câu trắc nghiệm`,
          isPrimary: true,
          variant: 'primary',
          onClick: () => {
            if (onCustomRetry) onCustomRetry();
            else navigateToTab('mistakes');
          },
        },
        secondaryAction: {
          id: 'next-action-today-hub',
          label: TODAY_HUB_ACTION_LABEL,
          variant: 'secondary',
          onClick: () => navigateToTab('dashboard'),
        },
      };
    }
  }

  // E. Listening: Incorrect answers evidence
  if (completionContext.flowType === 'listening' && completionContext.listening) {
    const l = completionContext.listening;
    if (typeof l.incorrectQuestionCount === 'number' && l.incorrectQuestionCount > 0) {
      return {
        resolvedPriority: 1,
        rationale: `Có ${l.incorrectQuestionCount} câu nghe chưa chính xác cần xem lại giải thích.`,
        primaryAction: {
          id: 'next-action-weakness-listening-mistakes',
          label: 'Xem Giải Thích Chi Tiết Câu Sai',
          description: `Rà soát ${l.incorrectQuestionCount} câu hỏi nghe hiểu`,
          isPrimary: true,
          variant: 'primary',
          onClick: () => {
            if (onCustomRetry) onCustomRetry();
            else navigateToTab('mistakes');
          },
        },
        secondaryAction: {
          id: 'next-action-today-hub',
          label: TODAY_HUB_ACTION_LABEL,
          variant: 'secondary',
          onClick: () => navigateToTab('dashboard'),
        },
      };
    }
  }

  // F. Flashcard: Hard cards in session
  if (completionContext.flowType === 'flashcard' && completionContext.flashcard) {
    const f = completionContext.flashcard;
    if (typeof f.hardestCardCount === 'number' && f.hardestCardCount > 0) {
      return {
        resolvedPriority: 1,
        rationale: `Có ${f.hardestCardCount} thẻ đánh giá Khó/Quên trong phiên ôn tập.`,
        primaryAction: {
          id: 'next-action-weakness-flashcards',
          label: `Ôn Lại ${f.hardestCardCount} Thẻ Khó Vừa Gặp`,
          description: 'Củng cố ngay các từ vựng chưa vững',
          isPrimary: true,
          variant: 'primary',
          onClick: () => {
            if (onCustomRetry) onCustomRetry();
            else navigateToTab('flashcards');
          },
        },
        secondaryAction: {
          id: 'next-action-today-hub',
          label: TODAY_HUB_ACTION_LABEL,
          variant: 'secondary',
          onClick: () => navigateToTab('dashboard'),
        },
      };
    }
  }

  // G. TOEIC: Low section score
  if (completionContext.flowType === 'toeic' && completionContext.toeic) {
    const t = completionContext.toeic;
    if (typeof t.weakestPart === 'number' && typeof t.weakestPartScorePct === 'number' && t.weakestPartScorePct < 70) {
      return {
        resolvedPriority: 1,
        rationale: `Part ${t.weakestPart} có tỷ lệ đúng thấp (${Math.round(t.weakestPartScorePct)}%).`,
        primaryAction: {
          id: 'next-action-weakness-toeic-part',
          label: `Luyện Tập Bổ Trợ Part ${t.weakestPart}`,
          description: `Tăng cường độ chính xác cho Part ${t.weakestPart} (${Math.round(t.weakestPartScorePct)}%)`,
          isPrimary: true,
          variant: 'primary',
          onClick: () => {
            navigateToTab('toeic');
          },
        },
        secondaryAction: {
          id: 'next-action-today-hub',
          label: TODAY_HUB_ACTION_LABEL,
          variant: 'secondary',
          onClick: () => navigateToTab('dashboard'),
        },
      };
    }
  }

  // H. AI Tutor: Real detected mistakes
  if (completionContext.flowType === 'tutor' && completionContext.tutor) {
    const tu = completionContext.tutor;
    if (typeof tu.detectedMistakeCount === 'number' && tu.detectedMistakeCount > 0) {
      return {
        resolvedPriority: 1,
        rationale: `Phát hiện ${tu.detectedMistakeCount} điểm cần lưu ý trong lượt hội thoại gia sư.`,
        primaryAction: {
          id: 'next-action-weakness-tutor-mistakes',
          label: 'Xem Lại Bẫy Lỗi Hội Thoại',
          description: `Rà soát ${tu.detectedMistakeCount} từ vựng/ngữ pháp trong Sổ Tay Bẫy Lỗi`,
          isPrimary: true,
          variant: 'primary',
          onClick: () => navigateToTab('mistakes'),
        },
        secondaryAction: {
          id: 'next-action-today-hub',
          label: TODAY_HUB_ACTION_LABEL,
          variant: 'secondary',
          onClick: () => navigateToTab('dashboard'),
        },
      };
    }
  }

  // -------------------------------------------------------------------------
  // 2. PRIORITY 2: Curriculum Continuation hiện tại
  // -------------------------------------------------------------------------

  // A. Reading next lesson
  if (completionContext.flowType === 'reading' && completionContext.reading?.lessonId) {
    const currentId = completionContext.reading.lessonId;
    const idx = READING_LESSONS.findIndex((l) => l.id === currentId);
    if (idx >= 0 && idx < READING_LESSONS.length - 1) {
      const nextLesson = READING_LESSONS[idx + 1];
      return {
        resolvedPriority: 2,
        rationale: `Tiếp tục bài đọc kế tiếp trong lộ trình: ${nextLesson.title}.`,
        primaryAction: {
          id: 'next-action-curriculum-reading',
          label: `Bài Đọc Kế Tiếp: ${nextLesson.title}`,
          description: `Chủ đề ${nextLesson.category} • CEFR ${nextLesson.level}`,
          isPrimary: true,
          variant: 'primary',
          onClick: () => {
            setActiveFourSkill?.('reading');
            startAdaptivePractice?.({
              module: 'reading',
              itemIds: [nextLesson.id],
              startedAt: Date.now(),
            });
            navigateToTab('four_skills');
          },
        },
        secondaryAction: {
          id: 'next-action-today-hub',
          label: TODAY_HUB_ACTION_LABEL,
          variant: 'secondary',
          onClick: () => navigateToTab('dashboard'),
        },
      };
    }
  }

  // B. Listening next lesson
  if (completionContext.flowType === 'listening' && completionContext.listening?.lessonId) {
    const currentId = completionContext.listening.lessonId;
    const idx = LISTENING_LESSONS.findIndex((l) => l.id === currentId);
    if (idx >= 0 && idx < LISTENING_LESSONS.length - 1) {
      const nextLesson = LISTENING_LESSONS[idx + 1];
      return {
        resolvedPriority: 2,
        rationale: `Tiếp tục bài nghe kế tiếp trong lộ trình: ${nextLesson.title}.`,
        primaryAction: {
          id: 'next-action-curriculum-listening',
          label: `Bài Nghe Kế Tiếp: ${nextLesson.title}`,
          description: `Chủ đề ${nextLesson.category} • CEFR ${nextLesson.level}`,
          isPrimary: true,
          variant: 'primary',
          onClick: () => {
            setActiveFourSkill?.('listening');
            startAdaptivePractice?.({
              module: 'listening',
              itemIds: [nextLesson.id],
              startedAt: Date.now(),
            });
            navigateToTab('four_skills');
          },
        },
        secondaryAction: {
          id: 'next-action-today-hub',
          label: TODAY_HUB_ACTION_LABEL,
          variant: 'secondary',
          onClick: () => navigateToTab('dashboard'),
        },
      };
    }
  }

  // C. Speaking next prompt
  if (completionContext.flowType === 'speaking' && completionContext.speaking?.promptId) {
    const currentId = completionContext.speaking.promptId;
    const idx = SPEAKING_PROMPTS.findIndex((p) => p.id === currentId);
    if (idx >= 0 && idx < SPEAKING_PROMPTS.length - 1) {
      const nextPrompt = SPEAKING_PROMPTS[idx + 1];
      return {
        resolvedPriority: 2,
        rationale: `Tiếp tục chủ đề nói kế tiếp: ${nextPrompt.title}.`,
        primaryAction: {
          id: 'next-action-curriculum-speaking',
          label: `Chủ Đề Nói Tiếp: ${nextPrompt.title}`,
          description: `Cấp độ ${nextPrompt.level} • Dạng bài ${nextPrompt.category}`,
          isPrimary: true,
          variant: 'primary',
          onClick: () => {
            setActiveFourSkill?.('speaking');
            startAdaptivePractice?.({
              module: 'speaking',
              itemIds: [nextPrompt.id],
              startedAt: Date.now(),
            });
            navigateToTab('four_skills');
          },
        },
        secondaryAction: {
          id: 'next-action-today-hub',
          label: TODAY_HUB_ACTION_LABEL,
          variant: 'secondary',
          onClick: () => navigateToTab('dashboard'),
        },
      };
    }
  }

  // D. Writing next prompt
  if (completionContext.flowType === 'writing' && completionContext.writing?.promptId) {
    const currentId = completionContext.writing.promptId;
    const idx = WRITING_PROMPTS.findIndex((p) => p.id === currentId);
    if (idx >= 0 && idx < WRITING_PROMPTS.length - 1) {
      const nextPrompt = WRITING_PROMPTS[idx + 1];
      return {
        resolvedPriority: 2,
        rationale: `Tiếp tục đề viết kế tiếp: ${nextPrompt.title}.`,
        primaryAction: {
          id: 'next-action-curriculum-writing',
          label: `Đề Bài Kế Tiếp: ${nextPrompt.title}`,
          description: `Dạng bài ${nextPrompt.type} • CEFR ${nextPrompt.level}`,
          isPrimary: true,
          variant: 'primary',
          onClick: () => {
            setActiveFourSkill?.('writing');
            startAdaptivePractice?.({
              module: 'writing',
              itemIds: [nextPrompt.id],
              startedAt: Date.now(),
            });
            navigateToTab('four_skills');
          },
        },
        secondaryAction: {
          id: 'next-action-today-hub',
          label: TODAY_HUB_ACTION_LABEL,
          variant: 'secondary',
          onClick: () => navigateToTab('dashboard'),
        },
      };
    }
  }

  // -------------------------------------------------------------------------
  // 3. PRIORITY 3: Item tiếp theo trong Today Learning Plan
  // -------------------------------------------------------------------------
  if (todayPlan && Array.isArray(todayPlan.items) && todayPlan.items.length > 0) {
    const remainingTasks = todayPlan.items.filter(
      (it) => !it.completed && it.id !== completionContext.currentPlanItemId
    );

    if (remainingTasks.length > 0) {
      const nextTask = remainingTasks[0];
      return {
        resolvedPriority: 3,
        rationale: `Thực hiện nhiệm vụ tiếp theo trong Kế Hoạch Hôm Nay: ${nextTask.title}.`,
        primaryAction: {
          id: 'next-action-today-plan-task',
          label: `Nhiệm Vụ Tiếp Theo: ${nextTask.title}`,
          description: nextTask.description || nextTask.reason || `Dự kiến: ~${nextTask.estimatedMinutes} phút`,
          isPrimary: true,
          variant: 'primary',
          onClick: () => {
            executeLearningPlanAction(nextTask.action, {
              navigateToTab,
              startAdaptivePractice,
              setActiveFourSkill,
            });
          },
        },
        secondaryAction: {
          id: 'next-action-today-hub',
          label: TODAY_HUB_ACTION_LABEL,
          variant: 'secondary',
          onClick: () => navigateToTab('dashboard'),
        },
      };
    }
  }

  // -------------------------------------------------------------------------
  // 4. PRIORITY 4: Fallback về Today Hub ('dashboard')
  // -------------------------------------------------------------------------
  return {
    resolvedPriority: 4,
    rationale: 'Đã hoàn thành phiên học xuất sắc, quay về Today Learning Hub để theo dõi tiến độ ngày.',
    primaryAction: {
      id: 'next-action-today-hub',
      label: TODAY_HUB_ACTION_LABEL,
      description: 'Theo dõi tổng kết ngày và duy trì chuỗi học tập',
      isPrimary: true,
      variant: 'primary',
      onClick: () => navigateToTab('dashboard'),
    },
    secondaryAction: onCustomCatalog
      ? {
          id: 'secondary-catalog',
          label: 'Quay Lại Danh Mục',
          variant: 'secondary',
          onClick: onCustomCatalog,
        }
      : onCustomRetry
      ? {
          id: 'secondary-retry',
          label: 'Luyện Tập Lại',
          variant: 'secondary',
          onClick: onCustomRetry,
        }
      : undefined,
  };
}

function getSkillVi(skill: string): string {
  switch (skill) {
    case 'listening':
      return 'Nghe';
    case 'reading':
      return 'Đọc';
    case 'speaking':
      return 'Nói';
    case 'writing':
      return 'Viết';
    default:
      return skill;
  }
}
