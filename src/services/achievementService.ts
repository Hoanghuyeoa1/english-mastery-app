/**
 * Service Quản Lý Danh Hiệu & Thành Tựu Toàn Diện (Achievement & Badge System)
 * Tự động tính toán tiến độ dựa trên dữ liệu học tập thực tế (Single Source of Truth).
 */

import { getSRSMasteryStatus } from './srsAlgorithm';
import { useAppStore } from '../store/useAppStore';
import type { UserProfile, DailyProgress } from '../types';

export type AchievementCategory = 'streak' | 'vocab' | 'skills';

export interface SystemAchievement {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  categoryName: string;
  icon: string;
  target: number;
  progress: number;
  isUnlocked: boolean;
  xpReward: number;
}

/**
 * Kiểm tra xem người dùng có hoàn thành bài học trong khung giờ 23h - 5h sáng chưa
 */
export function checkAndRecordNightOwl(): boolean {
  try {
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 5) {
      useAppStore.getState().setHasLearnedNightOwl(true);
      return true;
    }
  } catch {
    // fallback
  }
  return false;
}

/**
 * Đánh giá tiến độ và trạng thái mở khóa của toàn bộ 12 Danh Hiệu & Thành Tựu
 */
export function evaluateUserAchievements(params: {
  profile: UserProfile;
  srsProgressMap: Record<string, any>;
  dailyHistory: Record<string, DailyProgress>;
}): SystemAchievement[] {
  const { profile, srsProgressMap = {}, dailyHistory = {} } = params;

  // 1. Dữ liệu từ vựng & SRS
  const srsEntries = Object.values(srsProgressMap || {});
  const coreWordsCount = srsEntries.filter(
    (p: any) =>
      (p.srsLevel && p.srsLevel > 0) ||
      (p.interval && p.interval > 0) ||
      Boolean(p.lastReviewedDate) ||
      Boolean(p.firstLearnedAt)
  ).length;

  // Đếm số từ đã đạt "Đã khắc sâu" (repetitions >= 5 || interval >= 21)
  const masteredWordsCount = srsEntries.filter((p: any) => {
    const hasBeenStudied =
      (p.srsLevel && p.srsLevel > 0) ||
      (p.interval && p.interval > 0) ||
      Boolean(p.lastReviewedDate) ||
      Boolean(p.firstLearnedAt);
    if (!hasBeenStudied) return false;
    return (
      getSRSMasteryStatus({
        repetitions: p.srsLevel,
        srsLevel: p.srsLevel,
        interval: p.interval,
      }) === 'mastered'
    );
  }).length;

  // 2. Tổng số lượt ôn Flashcard
  const totalReviewsCount = Object.values(dailyHistory || {}).reduce(
    (sum, d) => sum + (d.wordsReviewed || 0),
    0
  );

  // 3. Dữ liệu điểm 4 kỹ năng & Night Owl từ Zustand store
  const { fourSkillsScores, hasLearnedNightOwl } = useAppStore.getState();

  const listenScores = fourSkillsScores?.listening || [];
  const readScores = fourSkillsScores?.reading || [];
  const speakScores = fourSkillsScores?.speaking || [];
  const writeScores = fourSkillsScores?.writing || [];

  const perfectListeningCount = listenScores.filter((s) => s >= 100).length;
  const perfectReadingCount = readScores.filter((s) => s >= 100).length;
  const perfectSpeakingCount = speakScores.filter((s) => s >= 90).length;
  const goodWritingCount = writeScores.filter((s) => s >= 70).length;

  const isNightLearned = Boolean(hasLearnedNightOwl);

  const anyLessonDone =
    coreWordsCount > 0 ||
    totalReviewsCount > 0 ||
    listenScores.length > 0 ||
    readScores.length > 0 ||
    speakScores.length > 0 ||
    writeScores.length > 0;

  // Danh mục 12 Danh Hiệu Chuẩn
  const list: SystemAchievement[] = [
    // -------------------------------------------------------------------------
    // Nhóm 1: Khởi Đầu & Chuyên Cần (Streak & Thời gian)
    // -------------------------------------------------------------------------
    {
      id: 'first_lesson',
      title: 'Tân Thủ Tiên Phong',
      description: 'Hoàn thành bài học hoặc ôn tập từ vựng đầu tiên',
      category: 'streak',
      categoryName: 'Khởi Đầu & Chuyên Cần',
      icon: '🚀',
      target: 1,
      progress: anyLessonDone ? 1 : 0,
      isUnlocked: anyLessonDone,
      xpReward: 50,
    },
    {
      id: 'streak_7',
      title: 'Ngọn Lửa Bất Diệt',
      description: 'Đạt chuỗi Streak 7 ngày học liên tục',
      category: 'streak',
      categoryName: 'Khởi Đầu & Chuyên Cần',
      icon: '🔥',
      target: 7,
      progress: Math.min(7, profile.streak || 0),
      isUnlocked: (profile.streak || 0) >= 7,
      xpReward: 150,
    },
    {
      id: 'streak_30',
      title: 'Kỷ Luật Thép',
      description: 'Đạt chuỗi Streak 30 ngày học liên tục',
      category: 'streak',
      categoryName: 'Khởi Đầu & Chuyên Cần',
      icon: '🛡️',
      target: 30,
      progress: Math.min(30, profile.streak || 0),
      isUnlocked: (profile.streak || 0) >= 30,
      xpReward: 350,
    },
    {
      id: 'night_owl',
      title: 'Cú Đêm Chăm Chỉ',
      description: 'Hoàn thành bài học trong khung giờ 23h - 5h sáng',
      category: 'streak',
      categoryName: 'Khởi Đầu & Chuyên Cần',
      icon: '🦉',
      target: 1,
      progress: isNightLearned ? 1 : 0,
      isUnlocked: isNightLearned,
      xpReward: 100,
    },

    // -------------------------------------------------------------------------
    // Nhóm 2: Bậc Thầy Từ Vựng (SRS & Số lượng từ)
    // -------------------------------------------------------------------------
    {
      id: 'vocab_50',
      title: 'Kẻ Săn Từ Vựng',
      description: 'Tích lũy được 50 từ vựng vào kho cá nhân',
      category: 'vocab',
      categoryName: 'Bậc Thầy Từ Vựng',
      icon: '🏹',
      target: 50,
      progress: Math.min(50, coreWordsCount),
      isUnlocked: coreWordsCount >= 50,
      xpReward: 120,
    },
    {
      id: 'vocab_200',
      title: 'Bách Khoa Toàn Thư',
      description: 'Tích lũy được 200 từ vựng vào kho cá nhân',
      category: 'vocab',
      categoryName: 'Bậc Thầy Từ Vựng',
      icon: '📖',
      target: 200,
      progress: Math.min(200, coreWordsCount),
      isUnlocked: coreWordsCount >= 200,
      xpReward: 300,
    },
    {
      id: 'flashcard_100',
      title: 'Chiến Thần Phản Xạ',
      description: 'Hoàn thành 100 lượt ôn tập Flashcard chuẩn xác',
      category: 'vocab',
      categoryName: 'Bậc Thầy Từ Vựng',
      icon: '⚡',
      target: 100,
      progress: Math.min(100, totalReviewsCount),
      isUnlocked: totalReviewsCount >= 100,
      xpReward: 200,
    },
    {
      id: 'mastery_50',
      title: 'Trí Nhớ Siêu Phàm',
      description: 'Có ít nhất 50 từ đạt cấp độ SRS "Đã khắc sâu" (Mastered)',
      category: 'vocab',
      categoryName: 'Bậc Thầy Từ Vựng',
      icon: '🧠',
      target: 50,
      progress: Math.min(50, masteredWordsCount),
      isUnlocked: masteredWordsCount >= 50,
      xpReward: 250,
    },

    // -------------------------------------------------------------------------
    // Nhóm 3: Đột Phá 4 Kỹ Năng (CEFR)
    // -------------------------------------------------------------------------
    {
      id: 'listen_master',
      title: 'Đôi Tai Thấu Suốt',
      description: 'Đạt điểm tuyệt đối 100% trong 5 bài Luyện Nghe',
      category: 'skills',
      categoryName: 'Đột Phá 4 Kỹ Năng',
      icon: '🎧',
      target: 5,
      progress: Math.min(5, perfectListeningCount),
      isUnlocked: perfectListeningCount >= 5,
      xpReward: 140,
    },
    {
      id: 'native_accent',
      title: 'Giọng Chuẩn Bản Xứ',
      description: 'Đạt điểm phát âm AI ≥ 90% ở 10 bài/câu luyện nói',
      category: 'skills',
      categoryName: 'Đột Phá 4 Kỹ Năng',
      icon: '🗣️',
      target: 10,
      progress: Math.min(10, perfectSpeakingCount),
      isUnlocked: perfectSpeakingCount >= 10,
      xpReward: 160,
    },
    {
      id: 'reading_ace',
      title: 'Bậc Thầy Đọc Hiểu',
      description: 'Hoàn thành trọn vẹn 10 bài đọc hiểu không sai câu nào',
      category: 'skills',
      categoryName: 'Đột Phá 4 Kỹ Năng',
      icon: '🧐',
      target: 10,
      progress: Math.min(10, perfectReadingCount),
      isUnlocked: perfectReadingCount >= 10,
      xpReward: 180,
    },
    {
      id: 'writing_pro',
      title: 'Ngòi Bút Sắc Bén',
      description: 'Hoàn thành 5 bài viết luận đạt mức CEFR B2 trở lên (≥ 70 điểm)',
      category: 'skills',
      categoryName: 'Đột Phá 4 Kỹ Năng',
      icon: '✍️',
      target: 5,
      progress: Math.min(5, goodWritingCount),
      isUnlocked: goodWritingCount >= 5,
      xpReward: 200,
    },
  ];

  return list;
}

/**
 * Xóa sạch toàn bộ dữ liệu thành tựu/danh hiệu
 */
export function clearAllAchievements(): void {
  const keys = [
    'unlocked_achievements',
    'equipped_title',
    'user_badges',
  ];
  keys.forEach((k) => localStorage.removeItem(k));
  useAppStore.getState().setHasLearnedNightOwl(false);
}
