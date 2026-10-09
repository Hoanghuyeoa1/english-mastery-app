// src/services/toeicAttemptManager.ts
import {
  ToeicQuestion,
  ToeicQuestionGroup,
  ToeicPart,
  ExamModeType,
  ToeicExamSnapshot,
  EXAM_MODE_CONFIGS,
  ToeicExperienceMode,
  ToeicSkillScope,
  ExamExperienceConfig,
  ToeicAdaptiveState,
  resolveExperienceAndSkillScope,
} from '../types/toeic';
import { toeicQuestionIndex } from './toeicIndex';
import { generateToeicExam } from './examGenerator';
import { INITIAL_ADAPTIVE_STATE } from './toeicDiagnosticEngine';

export const QUESTION_BANK_VERSION = '2026.1';

export const STORAGE_KEY_RECENT_HISTORY = 'english_mastery_toeic_recent_history';
export const STORAGE_KEY_INPROGRESS = 'english_mastery_toeic_inprogress';
export const STORAGE_KEY_HISTORY = 'english_mastery_toeic_history';

export const MAX_RECENT_QUESTIONS = 60;
export const MAX_RECENT_GROUPS = 15;

export interface CompactRecentHistory {
  recentQuestionIds: string[];
  recentGroupIds: string[];
  lastUpdated: string;
}

export interface ToeicAttemptSnapshotMeta {
  attemptId: string;
  mode: ExamModeType | string;
  experienceMode?: ToeicExperienceMode;
  skillScope?: ToeicSkillScope;
  experienceConfig?: ExamExperienceConfig;
  adaptiveState?: ToeicAdaptiveState;
  questionIds: string[];
  groupIds: string[];
  questionBankVersion: string;
  generatedAt: string;
  seed: number;
  totalQuestions: number;
  durationMinutes: number;
}

export interface InProgressAttemptState {
  stage: 'testing';
  attemptId?: string;
  snapshotMeta?: ToeicAttemptSnapshotMeta;
  examMode: ExamModeType | string;
  experienceMode?: ToeicExperienceMode;
  skillScope?: ToeicSkillScope;
  experienceConfig?: ExamExperienceConfig;
  adaptiveState?: ToeicAdaptiveState;
  currentQuestionIdx: number;
  userAnswers: Record<string, string>;
  firstAttemptAnswers?: Record<string, string>;
  bookmarkedQuestions?: Record<string, boolean>;
  retryCountMap?: Record<string, number>;
  masteredRetryMap?: Record<string, boolean>;
  speakingTranscript?: string;
  writingInput?: string;
  audioPlayedMap?: Record<string, boolean>;
  timeLeft: number;
  savedAt: number;
  isPaused?: boolean;
}

export interface RestoreSnapshotResult {
  snapshot: ToeicExamSnapshot;
  isFullyRestored: boolean;
  isIncompatible?: boolean;
  warnings: string[];
}

const inMemoryStorage = new Map<string, string>();

function safeGetItem(storage: 'local' | 'session', key: string): string | null {
  try {
    if (storage === 'local' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    if (storage === 'session' && typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(key);
    }
  } catch {}
  return inMemoryStorage.get(`${storage}_${key}`) ?? null;
}

export function safeSetItem(storage: 'local' | 'session', key: string, value: string): void {
  try {
    if (storage === 'local' && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
    if (storage === 'session' && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(key, value);
      return;
    }
  } catch {}
  inMemoryStorage.set(`${storage}_${key}`, value);
}

function safeRemoveItem(storage: 'local' | 'session', key: string): void {
  try {
    if (storage === 'local' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
    if (storage === 'session' && typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(key);
      return;
    }
  } catch {}
  inMemoryStorage.delete(`${storage}_${key}`);
}

/**
 * Đọc lịch sử câu hỏi/nhóm đã gặp gần đây từ localStorage (bounded)
 */
export function getRecentHistory(): CompactRecentHistory {
  try {
    const raw = safeGetItem('local', STORAGE_KEY_RECENT_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.recentQuestionIds)) {
        return {
          recentQuestionIds: parsed.recentQuestionIds.slice(-MAX_RECENT_QUESTIONS),
          recentGroupIds: Array.isArray(parsed.recentGroupIds)
            ? parsed.recentGroupIds.slice(-MAX_RECENT_GROUPS)
            : [],
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        };
      }
    }
  } catch {}

  return {
    recentQuestionIds: [],
    recentGroupIds: [],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Ghi nhận các câu hỏi và nhóm vừa tham gia vào lịch sử chống lặp (bounded FIFO)
 */
export function recordAttemptQuestionsToHistory(
  questionIds: string[],
  groupIds: string[] = []
): CompactRecentHistory {
  const current = getRecentHistory();

  // Deduplicate và duy trì thứ tự recency (mới nhất ở cuối)
  const questionMap = new Map<string, boolean>();
  current.recentQuestionIds.forEach((id) => questionMap.set(id, true));
  questionIds.forEach((id) => questionMap.set(id, true));

  const updatedQIds = Array.from(questionMap.keys()).slice(-MAX_RECENT_QUESTIONS);

  const groupMap = new Map<string, boolean>();
  current.recentGroupIds.forEach((id) => groupMap.set(id, true));
  groupIds.forEach((id) => groupMap.set(id, true));

  const updatedGIds = Array.from(groupMap.keys()).slice(-MAX_RECENT_GROUPS);

  const updatedHistory: CompactRecentHistory = {
    recentQuestionIds: updatedQIds,
    recentGroupIds: updatedGIds,
    lastUpdated: new Date().toISOString(),
  };

  safeSetItem('local', STORAGE_KEY_RECENT_HISTORY, JSON.stringify(updatedHistory));

  return updatedHistory;
}

/**
 * Khởi tạo Attempt mới: Sinh đề đúng một lần duy nhất (Generate Once) và trích xuất Metadata gọn nhẹ
 */
export function createNewAttemptSnapshot(
  modeOrOptions:
    | ExamModeType
    | string
    | {
        mode?: ExamModeType | string;
        experienceMode?: ToeicExperienceMode;
        skillScope?: ToeicSkillScope;
        weakAreas?: Array<{
          part?: ToeicPart;
          topic?: string;
          grammarTag?: string;
        }>;
      },
  seed?: number | string
): { snapshot: ToeicExamSnapshot; meta: ToeicAttemptSnapshotMeta } {
  const recentHistory = getRecentHistory();

  let options: any;
  if (typeof modeOrOptions === 'string') {
    options = {
      mode: modeOrOptions,
      recentHistory,
      seed,
    };
  } else {
    options = {
      ...modeOrOptions,
      recentHistory,
      seed,
    };
  }

  const snapshot = generateToeicExam(options);

  const attemptId = `attempt_${snapshot.mode}_${snapshot.seed}_${Date.now()}`;

  const initialAdaptiveState =
    snapshot.adaptiveState ||
    (snapshot.experienceMode === 'diagnostic' ? { ...INITIAL_ADAPTIVE_STATE } : undefined);

  snapshot.adaptiveState = initialAdaptiveState;

  const meta: ToeicAttemptSnapshotMeta = {
    attemptId,
    mode: snapshot.mode,
    experienceMode: snapshot.experienceMode,
    skillScope: snapshot.skillScope,
    experienceConfig: snapshot.experienceConfig,
    adaptiveState: initialAdaptiveState,
    questionIds: snapshot.questions.map((q) => q.id),
    groupIds: snapshot.groups.map((g) => g.id),
    questionBankVersion: QUESTION_BANK_VERSION,
    generatedAt: snapshot.createdAt,
    seed: snapshot.seed,
    totalQuestions: snapshot.totalQuestions,
    durationMinutes: snapshot.durationMinutes,
  };

  return { snapshot, meta };
}

/**
 * Khôi phục ToeicExamSnapshot từ snapshotMeta khi người dùng F5 hoặc tiếp tục làm bài
 * Bảo đảm giải quyết an toàn các câu hỏi từ Static Question Bank mà không mutate.
 */
export function restoreSnapshotFromMeta(meta: ToeicAttemptSnapshotMeta): RestoreSnapshotResult {
  const warnings: string[] = [];
  const resolvedQuestions: ToeicQuestion[] = [];
  const missingQuestionIds: string[] = [];

  const rawQIds = Array.isArray(meta?.questionIds) ? meta.questionIds : [];
  const rawGIds = Array.isArray(meta?.groupIds) ? meta.groupIds : [];
  const targetTotal = typeof meta?.totalQuestions === 'number' && meta.totalQuestions > 0 ? meta.totalQuestions : 10;
  const safeMode = meta?.mode || '2skills_full';

  // 1. Resolve questions by ID
  for (const qId of rawQIds) {
    if (typeof qId !== 'string') continue;
    const q = toeicQuestionIndex.getQuestionById(qId);
    if (q) {
      resolvedQuestions.push(q);
    } else {
      missingQuestionIds.push(qId);
      warnings.push(
        `Question ID "${qId}" không tìm thấy trong Question Bank hiện tại (version: ${QUESTION_BANK_VERSION}).`
      );
    }
  }

  // 2. Resolve groups by ID
  const resolvedGroups: ToeicQuestionGroup[] = [];
  for (const gId of rawGIds) {
    if (typeof gId !== 'string') continue;
    const g = toeicQuestionIndex.getGroupById(gId);
    if (g) {
      resolvedGroups.push(g);
    } else {
      warnings.push(`Group ID "${gId}" không tìm thấy trong Question Groups hiện tại.`);
    }
  }

  // 3. Xử lý trường hợp Question Bank Version mismatch nặng hoặc metadata bị hỏng
  if (resolvedQuestions.length < targetTotal * 0.7 || resolvedQuestions.length === 0) {
    warnings.push(
      `Bank version mismatch nghiêm trọng: chỉ tìm thấy ${resolvedQuestions.length}/${targetTotal} câu hỏi từ bản ghi attempt cũ (version lưu: ${meta?.questionBankVersion || 'unknown'}, hiện tại: ${QUESTION_BANK_VERSION}). Đánh dấu không tương thích (isIncompatible: true) để giao diện hiển thị thông báo minh bạch, tránh âm thầm thay đổi câu hỏi.`
    );

    // Tái sinh với seed cũ nhưng bảo toàn tuyệt đối experienceMode và skillScope (không âm thầm biến Mock thành Practice)
    const freshSnapshot = generateToeicExam({
      mode: safeMode,
      experienceMode: meta?.experienceMode,
      skillScope: meta?.skillScope,
      seed: meta?.seed,
    });

    return {
      snapshot: freshSnapshot,
      isFullyRestored: false,
      isIncompatible: true,
      warnings,
    };
  }

  // 4. Tính toán lại thống kê thực tế cho snapshot khôi phục
  const actualPartCounts: Record<ToeicPart, number> = {
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

  const difficultyBreakdown = { easy: 0, medium: 0, hard: 0 };
  const skillBreakdown = { listening: 0, reading: 0, speaking: 0, writing: 0 };

  resolvedQuestions.forEach((q) => {
    actualPartCounts[q.part]++;
    const diff = q.difficulty || 'medium';
    difficultyBreakdown[diff]++;
    skillBreakdown[q.skill]++;
  });

  const resolved = resolveExperienceAndSkillScope({
    experienceMode: meta?.experienceMode,
    skillScope: meta?.skillScope,
    mode: safeMode,
  });

  const baseConfig = EXAM_MODE_CONFIGS[safeMode as ExamModeType] || EXAM_MODE_CONFIGS[resolved.resolvedExamMode];
  const title = baseConfig ? baseConfig.name : `TOEIC Exam (${safeMode})`;

  const restoredSnapshot: ToeicExamSnapshot = {
    id: meta?.attemptId || `restored_${Date.now()}`,
    mode: safeMode,
    experienceMode: resolved.experienceMode,
    skillScope: resolved.skillScope,
    experienceConfig: meta?.experienceConfig || resolved.experienceConfig,
    adaptiveState:
      meta?.adaptiveState ||
      (resolved.experienceMode === 'diagnostic' ? { ...INITIAL_ADAPTIVE_STATE } : undefined),
    title,
    seed: meta?.seed ?? 1337,
    totalQuestions: resolvedQuestions.length,
    durationMinutes: meta?.durationMinutes || 15,
    questions: resolvedQuestions,
    groups: resolvedGroups,
    partCounts: actualPartCounts,
    difficultyBreakdown,
    skillBreakdown,
    diagnostics: {
      relaxedHistory: false,
      relaxedDifficulty: false,
      warnings,
      selectedGroupIds: rawGIds,
      selectedQuestionIds: rawQIds,
    },
    createdAt: meta?.generatedAt || new Date().toISOString(),
  };

  return {
    snapshot: restoredSnapshot,
    isFullyRestored: missingQuestionIds.length === 0,
    warnings,
  };
}

/**
 * Lưu tiến độ bài thi dở dang vào sessionStorage
 */
export function saveInProgressAttempt(state: InProgressAttemptState): void {
  safeSetItem('session', STORAGE_KEY_INPROGRESS, JSON.stringify(state));
}

/**
 * Đọc tiến độ bài thi dở dang từ sessionStorage
 */
export function getInProgressAttempt(): InProgressAttemptState | null {
  try {
    const raw = safeGetItem('session', STORAGE_KEY_INPROGRESS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.stage === 'testing' && parsed.timeLeft > 0) {
        return parsed as InProgressAttemptState;
      }
    }
  } catch {}
  return null;
}

/**
 * Xóa tiến độ bài thi dở dang
 */
export function clearInProgressAttempt(): void {
  safeRemoveItem('session', STORAGE_KEY_INPROGRESS);
}
