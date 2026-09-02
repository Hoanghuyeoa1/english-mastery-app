// src/types/index.ts

export type SRSGrade = 0 | 1 | 2 | 3;
// 0: Again (Quên) | 1: Hard (Khó) | 2: Good (Tốt) | 3: Easy (Dễ)

export type VocabTag = 'IELTS' | 'TOEIC' | 'Business' | 'Academic' | 'Daily' | 'Idioms' | 'Tech' | 'Travel' | 'Emotions';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface VocabWord {
  id: string;
  word: string;
  ipa: string;
  phonetic?: string;           // Phiên âm chuẩn IPA alias
  partOfSpeech: string;        // noun, verb, adjective, adverb, phrase, idiom
  meaning: string;
  definitionEn?: string;
  example: string;
  exampleEn?: string;          // Câu ví dụ tiếng Anh
  exampleMeaning?: string;
  exampleVi?: string;          // Nghĩa tiếng Việt của câu ví dụ
  category?: string;           // Danh mục chi tiết: 'IT / Tech', 'Academic / IELTS', 'Business / Workplace', 'TOEIC Core', 'Oxford Core'
  topic?: string;              // Chủ đề tiếng Việt: 'Công việc', 'Công nghệ', 'Giao tiếp hàng ngày', 'Du lịch', 'Học thuật', 'Cảm xúc'
  level?: string;              // Cấp độ CEFR: A1, A2, B1, B2, C1, C2
  collocations?: string[];
  synonyms?: string[];
  tag: VocabTag;
  isFavorite?: boolean;        // Đánh dấu từ yêu thích / từ khó cần chú ý
  
  // SRS SM-2 Fields
  srsLevel: number;            // Số lần ôn tập thành công liên tiếp (repetition)
  nextReviewDate: string;      // ISO Date string: '2026-08-31T06:00:00.000Z'
  interval: number;            // Khoảng cách ngày đến lần ôn tiếp theo
  easeFactor: number;          // Hệ số dễ (Default: 2.5, min: 1.3)
  lastReviewedDate?: string;
  firstLearnedAt?: string;     // Mốc thời gian ĐẦU TIÊN học từ này (CHỈ GHI 1 LẦN DUY NHẤT)
  todayNewReviewedAt?: string; // Mốc thời gian hoàn thành ôn tập ở Chế độ 2 (Từ mới hôm nay)
  todayPoolReviewedAt?: string;// Mốc thời gian hoàn thành ôn tập ở Chế độ 3 (Toàn bộ kho)
}

export interface UserProfile {
  name: string;
  level: number;
  xp: number;
  streak: number;
  lastActiveDate: string | null; // ISO Date YYYY-MM-DD
  lastStudyDate: string | null;  // ISO Date YYYY-MM-DD (dùng reset hạn mức ngày)
  hearts: number;               // Current hearts (0-5)
  maxHearts: number;
  avatarSeed: string;
  targetDailyWords: number;      // Tổng mục tiêu từ cần tương tác / ngày
  targetDailyNewWords: number;   // Mục tiêu từ mới mỗi ngày (mặc định: 15)
  extraNewWordsBonus: number;    // Số từ mới nạp thêm tạm thời trong ngày hôm nay
  isOnboarded?: boolean;         // Đã hoàn thành nhập tên lần đầu chưa
  targetGoal?: 'ielts' | 'toeic' | 'tech' | 'business' | 'daily';
  equippedTitle?: string;        // Danh hiệu đang trang bị (mặc định: Tân thủ)
  unlockedTitles?: string[];     // Danh sách ID các danh hiệu đã mở khóa
}

export interface DailyProgress {
  date: string;                  // YYYY-MM-DD
  wordsReviewed: number;         // Số lượt ôn từ cũ đến hạn
  newWordsLearned: number;       // Số từ mới bắt đầu học trong ngày
  quizzesCompleted: number;
  pronunciationsMastered: number;
  xpGained: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
  category: 'streak' | 'vocab' | 'xp' | 'quiz' | 'arcade';
  target: number;
  progress: number;
}

export interface MistakeRecord {
  id: string; // ID hoặc normalized word
  word: string;
  ipa?: string;
  meaning: string;
  example?: string;
  tag?: VocabTag;
  mistakeCount: number;
  lastMistakeAt: string; // ISO string
  consecutiveCorrect: number; // Đếm số lần ôn đúng liên tiếp (khi đạt 2 -> tự động resolved)
  resolved: boolean;
  source?: 'srs_again' | 'quiz' | 'scramble' | 'dictation' | 'speed_match' | 'pronunciation' | 'custom';
}

export type ActiveTab = 
  | 'dashboard' 
  | 'flashcards' 
  | 'mistakes'
  | 'four_skills'
  | 'quiz' 
  | 'arcade'
  | 'pronunciation' 
  | 'toeic' 
  | 'tutor' 
  | 'vocabulary' 
  | 'dictionary' 
  | 'translator'
  | 'admin';

export type ToeicSkill = 'listening' | 'reading' | 'speaking' | 'writing';
export type ToeicPart = 
  | 'part1_photos' 
  | 'part2_qna' 
  | 'part3_conv' 
  | 'part4_talks' 
  | 'part5_grammar' 
  | 'part6_text' 
  | 'part7_reading' 
  | 'speaking_read' 
  | 'writing_email';

export interface ToeicVocabularyItem {
  word: string;
  ipa: string;
  meaning: string;
}

export interface ToeicQuestion {
  id: string;
  part: ToeicPart;
  skill: ToeicSkill;
  imageUrl?: string; // Hình ảnh trực quan cho Part 1 Photographs
  audioScript?: string;
  passage?: string;
  questionText: string;
  options?: string[]; // 4 choices: A, B, C, D
  correctAnswer?: string; // 'A' | 'B' | 'C' | 'D'
  explanation: string;
  vietnameseTranslation: string;
  keyVocabulary?: ToeicVocabularyItem[];
}

export interface ToeicTestSession {
  id: string;
  mode: '2skills_mini' | '2skills_full' | '4skills';
  title: string;
  date: string;
  totalQuestions: number;
  durationMinutes: number;
  userAnswers: Record<string, string>;
  speakingTranscript?: string;
  writingText?: string;
  listeningScore: number;
  readingScore: number;
  speakingScore?: number;
  writingScore?: number;
  totalScore: number;
  cefrLevel: 'A1/A2' | 'B1' | 'B2' | 'C1';
}

export interface ChatFeedback {
  original: string;
  correction: string;
  explanation: string;
  betterPhrasing?: string;
  vocabularyTips?: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  feedback?: ChatFeedback;
}

export interface RoleplayScenario {
  id: string;
  title: string;
  role: string;
  aiRole: string;
  icon: string;
  badge: string;
  description: string;
  initialMessage: string;
  systemPrompt: string;
  suggestedPrompts?: string[];
  steps?: string[];
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface CloudSyncInfo {
  status: SyncStatus;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  userEmail: string | null;
  userId: string | null;
}

export interface CloudVocabulary {
  id: string;
  word: string;
  phonetic?: string;
  ipa?: string;
  part_of_speech?: string;
  meaning: string;
  example?: string;
  example_en?: string;
  example_vi?: string;
  category?: string;
  topic?: string;
  level?: string;
  created_at?: string;
}

export interface AdminUserProfile {
  id: string;
  display_name: string | null;
  level: number;
  xp: number;
  streak: number;
  updated_at: string | null;
}


