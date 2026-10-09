// src/services/toeicPersistenceService.ts

import {
  ToeicTestSession,
  ToeicAttemptAnalytics,
  ToeicArchivedSummary,
  STORAGE_KEY_HISTORY,
  STORAGE_KEY_ARCHIVED_SUMMARY,
  ToeicExperienceMode,
  ToeicSkillScope,
} from '../types/toeic';

/**
 * Số lượng bài thi tối đa lưu trữ trong LocalStorage để kiểm soát ngân sách bộ nhớ (Storage Budget).
 * Ngăn chặn phình to LocalStorage vô hạn qua thời gian.
 */
export const MAX_PERSISTED_ATTEMPTS = 15;

/**
 * Fallback bộ nhớ RAM nếu môi trường không có hoặc bị khóa LocalStorage
 */
const inMemoryFallback = new Map<string, string>();

function safeGetStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {}
  return inMemoryFallback.get(key) ?? null;
}

function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch (err) {
    // QuotaExceededError handling: nếu bộ nhớ đầy, log cảnh báo và lưu vào memory fallback
    console.warn('[ToeicPersistence] LocalStorage write failed (possibly quota exceeded):', err);
  }
  inMemoryFallback.set(key, value);
}

/**
 * Helper thuần túy: Chuẩn hóa và làm sạch số thực, chống NaN, Infinity, số âm hoặc tràn ngưỡng.
 */
export function sanitizeNumeric(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
    return fallback;
  }
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

/**
 * Helper cho các điểm số optional (null hoặc undefined nếu chưa có).
 */
function sanitizeOptionalScore(val: unknown, min: number, max: number): number | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) return undefined;
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

/**
 * Chuẩn hóa một bản ghi bài thi trước khi lưu trữ:
 * - Loại bỏ toàn bộ Question Bank tĩnh, full Question objects nếu có
 * - Bảo đảm chỉ lưu trữ tóm tắt analytics nhẹ (bounded attempt summary)
 * - Zero division guards, NaN guards, negative number guards
 * - Speaking & Writing: Giữ accuracy = null cho bài tự luận mở
 */
export function sanitizeSessionForPersistence(session: Partial<ToeicTestSession>): ToeicTestSession | null {
  if (!session || typeof session !== 'object') {
    return null;
  }

  // Yêu cầu tối thiểu ID để định danh attempt
  const id = typeof session.id === 'string' && session.id.trim() ? session.id.trim() : null;
  if (!id) {
    return null;
  }

  const rawExpMode = session.experienceMode;
  const experienceMode: ToeicExperienceMode =
    rawExpMode === 'mock' || rawExpMode === 'diagnostic' || rawExpMode === 'practice'
      ? rawExpMode
      : 'practice';

  const rawScope = session.skillScope;
  const skillScope: ToeicSkillScope = rawScope === '4-skills' ? '4-skills' : '2-skills';

  // Làm sạch các phần chi tiết trong analytics nếu có
  let cleanAnalytics: ToeicAttemptAnalytics | undefined = undefined;
  if (session.analytics && typeof session.analytics === 'object' && session.analytics.attemptId) {
    const rawO = session.analytics.overall || {};

    // 1. bySkill sanitization
    let cleanBySkill = session.analytics.bySkill;
    if (cleanBySkill && typeof cleanBySkill === 'object') {
      const sanitizedBySkill: Record<string, any> = {};
      for (const [skillKey, sVal] of Object.entries(cleanBySkill)) {
        if (!sVal || typeof sVal !== 'object') continue;
        const isSW = skillKey === 'speaking' || skillKey === 'writing';
        const rawAcc = (sVal as any).accuracy;
        const accuracy = isSW && (rawAcc === null || rawAcc === undefined)
          ? null
          : sanitizeNumeric(rawAcc, 0, 100, 0);

        sanitizedBySkill[skillKey] = {
          ...sVal,
          questionsSeen: sanitizeNumeric((sVal as any).questionsSeen, 0, 10000, 0),
          attempted: sanitizeNumeric((sVal as any).attempted, 0, 10000, 0),
          correct: sanitizeNumeric((sVal as any).correct, 0, 10000, 0),
          incorrect: sanitizeNumeric((sVal as any).incorrect, 0, 10000, 0),
          unanswered: sanitizeNumeric((sVal as any).unanswered, 0, 10000, 0),
          accuracy,
          evidenceCount: sanitizeNumeric((sVal as any).evidenceCount, 0, 10000, 0),
        };
      }
      cleanBySkill = sanitizedBySkill as any;
    }

    // 2. byPart sanitization
    let cleanByPart = session.analytics.byPart || {};
    if (typeof cleanByPart === 'object') {
      const sanitizedByPart: Record<string, any> = {};
      for (const [pKey, pVal] of Object.entries(cleanByPart)) {
        if (!pVal || typeof pVal !== 'object') continue;
        sanitizedByPart[pKey] = {
          ...pVal,
          questionsSeen: sanitizeNumeric((pVal as any).questionsSeen, 0, 10000, 0),
          attempted: sanitizeNumeric((pVal as any).attempted, 0, 10000, 0),
          correct: sanitizeNumeric((pVal as any).correct, 0, 10000, 0),
          incorrect: sanitizeNumeric((pVal as any).incorrect, 0, 10000, 0),
          accuracy: sanitizeNumeric((pVal as any).accuracy, 0, 100, 0),
          evidenceCount: sanitizeNumeric((pVal as any).evidenceCount, 0, 10000, 0),
        };
      }
      cleanByPart = sanitizedByPart;
    }

    // 3. bySubSkill sanitization
    let cleanBySubSkill = session.analytics.bySubSkill || {};
    if (typeof cleanBySubSkill === 'object') {
      const sanitizedBySubSkill: Record<string, any> = {};
      for (const [subKey, subVal] of Object.entries(cleanBySubSkill)) {
        if (!subVal || typeof subVal !== 'object') continue;
        sanitizedBySubSkill[subKey] = {
          ...subVal,
          questionsSeen: sanitizeNumeric((subVal as any).questionsSeen, 0, 10000, 0),
          attempted: sanitizeNumeric((subVal as any).attempted, 0, 10000, 0),
          correct: sanitizeNumeric((subVal as any).correct, 0, 10000, 0),
          incorrect: sanitizeNumeric((subVal as any).incorrect, 0, 10000, 0),
          accuracy: sanitizeNumeric((subVal as any).accuracy, 0, 100, 0),
          evidenceCount: sanitizeNumeric((subVal as any).evidenceCount, 0, 10000, 0),
        };
      }
      cleanBySubSkill = sanitizedBySubSkill;
    }

    cleanAnalytics = {
      attemptId: session.analytics.attemptId,
      experienceMode: session.analytics.experienceMode || experienceMode,
      skillScope: session.analytics.skillScope || skillScope,
      completedAt: sanitizeNumeric(session.analytics.completedAt, 0, Infinity, Date.now()),
      overall: {
        totalItems: sanitizeNumeric(rawO.totalItems, 0, 10000, 0),
        objectiveCount: sanitizeNumeric(rawO.objectiveCount, 0, 10000, 0),
        openEndedCount: sanitizeNumeric(rawO.openEndedCount, 0, 10000, 0),
        attemptedCount: sanitizeNumeric(rawO.attemptedCount, 0, 10000, 0),
        unansweredCount: sanitizeNumeric(rawO.unansweredCount, 0, 10000, 0),
        correctCount: sanitizeNumeric(rawO.correctCount, 0, 10000, 0),
        incorrectCount: sanitizeNumeric(rawO.incorrectCount, 0, 10000, 0),
        accuracy: sanitizeNumeric(rawO.accuracy, 0, 100, 0),
        scaledScoreLR: sanitizeOptionalScore(rawO.scaledScoreLR, 0, 990),
        scaledScoreSW: sanitizeOptionalScore(rawO.scaledScoreSW, 0, 400),
        listeningScore: sanitizeOptionalScore(rawO.listeningScore, 0, 495),
        readingScore: sanitizeOptionalScore(rawO.readingScore, 0, 495),
        speakingScore: sanitizeOptionalScore(rawO.speakingScore, 0, 200),
        writingScore: sanitizeOptionalScore(rawO.writingScore, 0, 200),
        totalScore: sanitizeOptionalScore(rawO.totalScore, 0, 990),
        durationSeconds: sanitizeNumeric(rawO.durationSeconds, 0, 86400, 0),
        timeSpentSeconds: sanitizeNumeric(rawO.timeSpentSeconds, 0, 86400, 0),
        completionRate: sanitizeNumeric(rawO.completionRate, 0, 100, 0),
      },
      bySkill: cleanBySkill,
      byPart: cleanByPart,
      bySubSkill: cleanBySubSkill,
      byDifficulty: session.analytics.byDifficulty,
      experienceSemantics: session.analytics.experienceSemantics || {
        experienceMode,
        evidenceSource:
          experienceMode === 'mock'
            ? 'strict_exam'
            : experienceMode === 'diagnostic'
            ? 'estimate_adaptive'
            : 'first_attempt_learning',
        isFirstAttemptEvidence: true,
      },
    };
  }

  return {
    id,
    mode: session.mode || '2skills_mini',
    experienceMode,
    skillScope,
    experienceConfig: session.experienceConfig,
    adaptiveState: session.adaptiveState,
    diagnosticReport: session.diagnosticReport,
    title: session.title || 'TOEIC Exam Session',
    date: session.date || new Date().toISOString(),
    totalQuestions: sanitizeNumeric(session.totalQuestions, 0, 10000, 0),
    durationMinutes: sanitizeNumeric(session.durationMinutes, 1, 300, 15),
    userAnswers: session.userAnswers && typeof session.userAnswers === 'object' ? session.userAnswers : {},
    firstAttemptAnswers:
      session.firstAttemptAnswers && typeof session.firstAttemptAnswers === 'object'
        ? session.firstAttemptAnswers
        : undefined,
    practiceStats: session.practiceStats,
    speakingTranscript: session.speakingTranscript,
    writingText: session.writingText,
    listeningScore: sanitizeNumeric(session.listeningScore, 0, 495, 0),
    readingScore: sanitizeNumeric(session.readingScore, 0, 495, 0),
    speakingScore: sanitizeOptionalScore(session.speakingScore, 0, 200),
    writingScore: sanitizeOptionalScore(session.writingScore, 0, 200),
    totalScore: sanitizeNumeric(session.totalScore, 0, 990, 0),
    cefrLevel: session.cefrLevel || 'A1/A2',
    analytics: cleanAnalytics,
    timeSpentSeconds:
      session.timeSpentSeconds !== undefined
        ? sanitizeNumeric(session.timeSpentSeconds, 0, 86400, 0)
        : undefined,
  };
}

/**
 * Pure function: Khử trùng lặp (Deduplication) danh sách bài thi dựa trên attemptId.
 * Quy tắc:
 * 1. Mỗi attemptId chỉ xuất hiện duy nhất 1 lần.
 * 2. Nếu có trùng lặp, ưu tiên bản ghi có analytics đầy đủ hơn hoặc có completedAt mới hơn.
 * 3. Sắp xếp thứ tự thời gian mới nhất lên đầu.
 * 4. Giới hạn số lượng bản ghi tối đa theo maxLimit.
 */
export function deduplicateToeicSessions(
  sessions: (ToeicTestSession | null | undefined)[],
  maxLimit: number = MAX_PERSISTED_ATTEMPTS
): ToeicTestSession[] {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return [];
  }

  const sessionMap = new Map<string, ToeicTestSession>();

  for (const raw of sessions) {
    const sanitized = sanitizeSessionForPersistence(raw as Partial<ToeicTestSession>);
    if (!sanitized) continue;

    const existing = sessionMap.get(sanitized.id);
    if (!existing) {
      sessionMap.set(sanitized.id, sanitized);
    } else {
      // Conflict Resolution: Ưu tiên bản ghi có analytics
      const existingHasAnalytics = Boolean(existing.analytics && existing.analytics.overall);
      const incomingHasAnalytics = Boolean(sanitized.analytics && sanitized.analytics.overall);

      if (!existingHasAnalytics && incomingHasAnalytics) {
        sessionMap.set(sanitized.id, sanitized);
      } else if (existingHasAnalytics && incomingHasAnalytics) {
        // Cả 2 đều có analytics -> so sánh completedAt hoặc date
        const existingTime = existing.analytics?.completedAt || new Date(existing.date).getTime() || 0;
        const incomingTime = sanitized.analytics?.completedAt || new Date(sanitized.date).getTime() || 0;
        if (incomingTime >= existingTime) {
          sessionMap.set(sanitized.id, sanitized);
        }
      }
    }
  }

  // Sắp xếp thời gian mới nhất lên đầu
  const result = Array.from(sessionMap.values()).sort((a, b) => {
    const timeA = a.analytics?.completedAt || new Date(a.date).getTime() || 0;
    const timeB = b.analytics?.completedAt || new Date(b.date).getTime() || 0;
    return timeB - timeA;
  });

  return Number.isFinite(maxLimit) ? result.slice(0, maxLimit) : result;
}

/**
 * Tải lịch sử thi TOEIC từ LocalStorage với cơ chế phòng vệ Zero-crash Rehydration:
 * - Xử lý an toàn khi payload bị rỗng, null, hoặc lỗi cú pháp JSON.
 * - Xử lý bản ghi cũ thiếu trường (old schema compatibility).
 * - Tự động dedup và giới hạn số lượng.
 */
export function loadToeicHistory(storageKey: string = STORAGE_KEY_HISTORY): ToeicTestSession[] {
  try {
    const raw = safeGetStorage(storageKey);
    if (!raw || !raw.trim()) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('[ToeicPersistence] Malformed history payload (not an array), falling back to empty.');
      return [];
    }

    return deduplicateToeicSessions(parsed);
  } catch (err) {
    console.warn('[ToeicPersistence] Failed to parse TOEIC history from storage, returning empty list:', err);
    return [];
  }
}

/**
 * Tải bản tổng kết lưu trữ dài hạn (Archived Summary) cho các bài thi vượt quá ngân sách MAX_PERSISTED_ATTEMPTS.
 */
export function loadToeicArchivedSummary(
  storageKey: string = STORAGE_KEY_ARCHIVED_SUMMARY
): ToeicArchivedSummary | null {
  try {
    const raw = safeGetStorage(storageKey);
    if (!raw || !raw.trim()) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.totalArchivedAttempts !== 'number') {
      return null;
    }
    return {
      totalArchivedAttempts: sanitizeNumeric(parsed.totalArchivedAttempts, 0, 100000, 0),
      totalQuestions: sanitizeNumeric(parsed.totalQuestions, 0, 1000000, 0),
      bySkill: parsed.bySkill && typeof parsed.bySkill === 'object' ? parsed.bySkill : {},
      byPart: parsed.byPart && typeof parsed.byPart === 'object' ? parsed.byPart : {},
      bySubSkill: parsed.bySubSkill && typeof parsed.bySubSkill === 'object' ? parsed.bySubSkill : {},
      lastUpdated: sanitizeNumeric(parsed.lastUpdated, 0, Infinity, Date.now()),
    };
  } catch (err) {
    console.warn('[ToeicPersistence] Failed to parse archived summary:', err);
    return null;
  }
}

/**
 * Lưu bản tổng kết lưu trữ dài hạn vào Storage.
 */
export function saveToeicArchivedSummary(
  summary: ToeicArchivedSummary,
  storageKey: string = STORAGE_KEY_ARCHIVED_SUMMARY
): void {
  try {
    safeSetStorage(storageKey, JSON.stringify(summary));
  } catch (err) {
    console.warn('[ToeicPersistence] Failed to persist archived summary:', err);
  }
}

/**
 * Pure function: Gộp (Archive) các session bị cắt tỉa (pruned) vượt quá MAX_PERSISTED_ATTEMPTS
 * vào một bản ghi thống kê ToeicArchivedSummary siêu nhẹ (~1KB) để không mất dữ liệu dài hạn.
 */
export function archiveDroppedSessions(
  droppedSessions: (ToeicTestSession | null | undefined)[],
  existingArchived?: ToeicArchivedSummary | null
): ToeicArchivedSummary {
  const summary: ToeicArchivedSummary = existingArchived
    ? {
        totalArchivedAttempts: existingArchived.totalArchivedAttempts || 0,
        totalQuestions: existingArchived.totalQuestions || 0,
        bySkill: { ...existingArchived.bySkill },
        byPart: { ...existingArchived.byPart },
        bySubSkill: { ...existingArchived.bySubSkill },
        lastUpdated: Date.now(),
      }
    : {
        totalArchivedAttempts: 0,
        totalQuestions: 0,
        bySkill: {},
        byPart: {},
        bySubSkill: {},
        lastUpdated: Date.now(),
      };

  for (const raw of droppedSessions) {
    if (!raw) continue;
    const session = sanitizeSessionForPersistence(raw as Partial<ToeicTestSession>);
    if (!session || !session.analytics) continue;
    const a = session.analytics;

    summary.totalArchivedAttempts += 1;
    summary.totalQuestions += (a.overall?.totalItems || session.totalQuestions || 0);

    // Gộp theo Skill
    if (a.bySkill) {
      for (const [skill, stats] of Object.entries(a.bySkill)) {
        if (!stats) continue;
        if (!summary.bySkill[skill]) {
          summary.bySkill[skill] = { totalSeen: 0, totalCorrect: 0, totalAttempted: 0 };
        }
        const sAny = stats as any;
        summary.bySkill[skill].totalSeen += (sAny.questionsSeen || sAny.evidenceCount || 0);
        summary.bySkill[skill].totalCorrect += (sAny.correct || 0);
        summary.bySkill[skill].totalAttempted += (sAny.attempted || sAny.evidenceCount || 0);
      }
    }

    // Gộp theo Part
    if (a.byPart) {
      for (const [part, stats] of Object.entries(a.byPart)) {
        if (!stats) continue;
        if (!summary.byPart[part]) {
          summary.byPart[part] = { totalSeen: 0, totalCorrect: 0, totalAttempted: 0 };
        }
        const pAny = stats as any;
        summary.byPart[part].totalSeen += (pAny.questionsSeen || 0);
        summary.byPart[part].totalCorrect += (pAny.correct || 0);
        summary.byPart[part].totalAttempted += (pAny.attempted || 0);
      }
    }

    // Gộp theo SubSkill
    if (a.bySubSkill) {
      for (const [subSkill, stats] of Object.entries(a.bySubSkill)) {
        if (!stats) continue;
        if (!summary.bySubSkill[subSkill]) {
          summary.bySubSkill[subSkill] = { totalSeen: 0, totalCorrect: 0, totalAttempted: 0, questionTypes: [] };
        }
        const subAny = stats as any;
        summary.bySubSkill[subSkill].totalSeen += (subAny.questionsSeen || 0);
        summary.bySubSkill[subSkill].totalCorrect += (subAny.correct || 0);
        summary.bySubSkill[subSkill].totalAttempted += (subAny.attempted || 0);
        if (Array.isArray(stats.questionTypes)) {
          const set = new Set([...summary.bySubSkill[subSkill].questionTypes, ...stats.questionTypes]);
          summary.bySubSkill[subSkill].questionTypes = Array.from(set);
        }
      }
    }
  }

  summary.lastUpdated = Date.now();
  return summary;
}

/**
 * Lưu một bài thi mới vào lịch sử với cơ chế Deduplication, Bounded Budget và Archiving:
 * - Bảo đảm attemptId chỉ ingest một lần duy nhất.
 * - Loại bỏ các dữ liệu rác trước khi ghi vào storage.
 * - Nếu số lượng session vượt quá MAX_PERSISTED_ATTEMPTS (15), các bài cũ nhất được tự động archive.
 * - Trả về mảng lịch sử đã được cập nhật chuẩn hóa.
 */
export function saveToeicAttempt(
  newSession: ToeicTestSession,
  existingHistory?: ToeicTestSession[],
  storageKey: string = STORAGE_KEY_HISTORY,
  archiveKey: string = STORAGE_KEY_ARCHIVED_SUMMARY
): ToeicTestSession[] {
  const current = existingHistory || loadToeicHistory(storageKey);
  // Lấy toàn bộ danh sách đã dedup không giới hạn để kiểm tra vượt budget
  const allDeduplicated = deduplicateToeicSessions([newSession, ...current], Number.MAX_SAFE_INTEGER);

  let kept = allDeduplicated;
  if (allDeduplicated.length > MAX_PERSISTED_ATTEMPTS) {
    kept = allDeduplicated.slice(0, MAX_PERSISTED_ATTEMPTS);
    const dropped = allDeduplicated.slice(MAX_PERSISTED_ATTEMPTS);
    // Lưu trữ dài hạn các bài thi bị loại bỏ
    const currentArchived = loadToeicArchivedSummary(archiveKey);
    const updatedArchived = archiveDroppedSessions(dropped, currentArchived);
    saveToeicArchivedSummary(updatedArchived, archiveKey);
  }

  try {
    safeSetStorage(storageKey, JSON.stringify(kept));
  } catch (err) {
    console.warn('[ToeicPersistence] Failed to persist TOEIC history:', err);
  }

  return kept;
}

/**
 * Pure function: Hợp nhất lịch sử thi giữa Local và Cloud (Deterministic Cloud Merge):
 * - Hợp nhất dựa trên unique attemptId.
 * - Tuyệt đối không cộng dồn các aggregates của hai thiết bị (tránh double-counting khi cùng bài thi xuất hiện ở cả hai).
 * - Ưu tiên bản ghi có đầy đủ analytics hoặc timestamp mới nhất.
 * - Đảm bảo tính giao hoán và kết hợp: merge(A, B) === merge(B, A).
 */
export function mergeToeicHistories(
  localSessions: (ToeicTestSession | null | undefined)[],
  remoteSessions: (ToeicTestSession | null | undefined)[],
  maxLimit: number = MAX_PERSISTED_ATTEMPTS
): ToeicTestSession[] {
  const combined = [
    ...(Array.isArray(localSessions) ? localSessions : []),
    ...(Array.isArray(remoteSessions) ? remoteSessions : []),
  ];

  return deduplicateToeicSessions(combined, maxLimit);
}

/**
 * Pure function: Trích xuất danh sách Attempt Analytics chuẩn hóa để đưa vào Historical Aggregator:
 * - Bỏ qua các session không có analytics hoặc bị corrupted.
 * - Khử trùng lặp theo attemptId một lần nữa ở tầng analytics.
 */
export function extractAttemptAnalyticsList(sessions: ToeicTestSession[]): ToeicAttemptAnalytics[] {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return [];
  }

  const analyticsMap = new Map<string, ToeicAttemptAnalytics>();

  for (const sess of sessions) {
    if (sess.analytics && typeof sess.analytics === 'object' && sess.analytics.attemptId) {
      if (!analyticsMap.has(sess.analytics.attemptId)) {
        analyticsMap.set(sess.analytics.attemptId, sess.analytics);
      }
    }
  }

  return Array.from(analyticsMap.values());
}

/**
 * Đồng bộ hóa lịch sử thi TOEIC nhận từ Cloud vào kho lưu trữ Local:
 * - Sử dụng deterministic cloud merge theo attemptId
 * - Đảm bảo không trùng lặp, giữ lại session hợp lệ và mới nhất
 * - Lưu lại vào LocalStorage và trả về danh sách đã hợp nhất
 */
export function syncToeicCloudHistory(
  remoteSessions: (ToeicTestSession | null | undefined)[],
  storageKey: string = STORAGE_KEY_HISTORY
): ToeicTestSession[] {
  const localSessions = loadToeicHistory(storageKey);
  const merged = mergeToeicHistories(localSessions, remoteSessions);
  try {
    safeSetStorage(storageKey, JSON.stringify(merged));
  } catch (err) {
    console.warn('[ToeicPersistence] Failed to persist merged cloud history:', err);
  }
  return merged;
}

/**
 * Xóa sạch lịch sử thi TOEIC và bản lưu trữ tóm tắt dài hạn.
 */
export function clearToeicHistory(
  storageKey: string = STORAGE_KEY_HISTORY,
  archiveKey: string = STORAGE_KEY_ARCHIVED_SUMMARY
): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(archiveKey);
    }
  } catch {}
  inMemoryFallback.delete(storageKey);
  inMemoryFallback.delete(archiveKey);
}

export { STORAGE_KEY_HISTORY, STORAGE_KEY_ARCHIVED_SUMMARY };
