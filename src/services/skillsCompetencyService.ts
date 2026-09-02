/**
 * Service tính toán Năng Lực 4 Kỹ Năng (CEFR) & Kho Từ Vựng Tích Lũy
 * Single Source of Truth: Lấy dữ liệu điểm thực tế từ bài tập của học viên,
 * không dùng mock data hay gán cứng.
 */

export interface SkillCompetency {
  score: number; // 0 - 100%
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  totalAttempts: number;
}

export interface FourSkillsCompetency {
  listening: SkillCompetency;
  reading: SkillCompetency;
  speaking: SkillCompetency;
  writing: SkillCompetency;
  accumulatedCoreWords: number;
}

/**
 * Quy đổi điểm % sang thang đo chuẩn CEFR
 */
export function getCefrLevelFromScore(score: number): 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' {
  if (score <= 0) return 'A1';
  if (score < 30) return 'A1';
  if (score < 50) return 'A2';
  if (score < 70) return 'B1';
  if (score < 85) return 'B2';
  if (score < 95) return 'C1';
  return 'C2';
}

/**
 * Ghi nhận điểm số của một bài luyện tập kỹ năng
 */
export function recordSkillScore(
  skill: 'listening' | 'reading' | 'speaking' | 'writing',
  score: number
): void {
  try {
    const key = `four_skills_${skill}_scores`;
    const raw = localStorage.getItem(key);
    const scores: number[] = raw ? JSON.parse(raw) : [];
    const validScore = Math.max(0, Math.min(100, Math.round(score)));
    scores.push(validScore);
    // Lưu tối đa 50 lượt kiểm tra gần nhất
    const trimmed = scores.slice(-50);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[SkillService] recordSkillScore error:', err);
  }
}

/**
 * Lấy báo cáo năng lực 4 kỹ năng thực tế của người dùng
 */
export function getFourSkillsCompetency(
  srsProgressMap: Record<string, any> = {}
): FourSkillsCompetency {
  const getSkill = (skill: 'listening' | 'reading' | 'speaking' | 'writing'): SkillCompetency => {
    try {
      const key = `four_skills_${skill}_scores`;
      const raw = localStorage.getItem(key);
      const scores: number[] = raw ? JSON.parse(raw) : [];

      if (!scores || scores.length === 0) {
        return { score: 0, level: 'A1', totalAttempts: 0 };
      }

      const sum = scores.reduce((acc, curr) => acc + curr, 0);
      const avg = Math.round(sum / scores.length);
      return {
        score: avg,
        level: getCefrLevelFromScore(avg),
        totalAttempts: scores.length,
      };
    } catch {
      return { score: 0, level: 'A1', totalAttempts: 0 };
    }
  };

  // Đếm chính xác số lượng bản ghi thực tế của user trong SRS Progress
  // Chỉ đếm những từ đã từng học (srsLevel > 0 hoặc đã có lastReviewedDate hoặc firstLearnedAt)
  const coreWordsCount = Object.values(srsProgressMap || {}).filter(
    (p: any) =>
      (p.srsLevel && p.srsLevel > 0) ||
      (p.interval && p.interval > 0) ||
      Boolean(p.lastReviewedDate) ||
      Boolean(p.firstLearnedAt)
  ).length;

  return {
    listening: getSkill('listening'),
    reading: getSkill('reading'),
    speaking: getSkill('speaking'),
    writing: getSkill('writing'),
    accumulatedCoreWords: coreWordsCount,
  };
}

/**
 * Xóa sạch toàn bộ dữ liệu lịch sử và điểm số của 4 kỹ năng
 */
export function clearAllSkillsData(): void {
  const keys = [
    'completed_listening_lessons',
    'completed_reading_lessons',
    'completed_speaking_prompts',
    'completed_writing_prompts',
    'four_skills_listening_scores',
    'four_skills_reading_scores',
    'four_skills_speaking_scores',
    'four_skills_writing_scores',
  ];
  keys.forEach((k) => localStorage.removeItem(k));
}
