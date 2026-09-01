// src/types/index.ts

export type SRSGrade = 0 | 1 | 2 | 3;
// 0: Again (Quên) | 1: Hard (Khó) | 2: Good (Tốt) | 3: Easy (Dễ)

export type VocabTag = 'IELTS' | 'TOEIC' | 'Business' | 'Academic' | 'Daily' | 'Idioms' | 'Tech';

export interface VocabWord {
  id: string;
  word: string;
  ipa: string;
  phonetic?: string;           // Phiên âm chuẩn IPA alias
  partOfSpeech: string;        // noun, verb, adjective, adverb, phrase, idiom
  meaning: string;
  definitionEn?: string;
  example: string;
  exampleMeaning?: string;
  exampleVi?: string;          // Nghĩa tiếng Việt của câu ví dụ
  category?: string;           // Danh mục chi tiết: 'IT / Tech', 'Academic / IELTS', 'Business / Workplace', 'TOEIC Core', 'Oxford Core'
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
  | 'translator';

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
