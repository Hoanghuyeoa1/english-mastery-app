// src/types/fourSkills.ts
/**
 * Four Skills (Listening, Reading, Speaking, Writing) Domain Types
 */
import type { CEFRLevel } from './cefr';

export interface ListeningSentence {
  en: string;
  vi: string;
  speaker?: string;
}

export interface ListeningQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  type?:
    | 'main_idea'
    | 'detail'
    | 'vocab_context'
    | 'negative_fact'
    | 'inference'
    | 'sequence'
    | 'cause_effect'
    | 'speaker_intention'
    | 'attitude';
}

export type ListeningFormat =
  | 'Conversation'
  | 'Dialogue'
  | 'Interview'
  | 'Announcement'
  | 'Lecture'
  | 'Presentation'
  | 'Story'
  | 'Podcast'
  | 'Documentary'
  | 'News Report';

export interface ListeningLesson {
  id: string;
  title: string;
  category: 'Tech' | 'Workplace' | 'Interview' | 'Daily Life' | 'Education' | 'Culture' | 'Environment' | 'Science' | 'Travel';
  format?: ListeningFormat;
  level: CEFRLevel;
  duration: string;
  description: string;
  audioText: string;
  sentences: ListeningSentence[];
  questions: ListeningQuestion[];
}

export interface ReadingLesson {
  id: string;
  title: string;
  category: 'Tech & AI' | 'Career & Business' | 'Science & Habit' | 'Workplace Culture' | 'Daily Life' | 'Culture & Society' | 'Environment' | 'Education';
  level: CEFRLevel;
  readTime: string;
  wordCount: number;
  summary: string;
  content: string[];
  keyVocab: { word: string; ipa: string; meaning: string }[];
  questions: {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    type?:
      | 'main_idea'
      | 'detail'
      | 'vocab_context'
      | 'negative_fact'
      | 'inference'
      | 'sequence'
      | 'author_purpose'
      | 'rhetorical_role';
  }[];
}

export interface SpeakingTurn {
  turnIndex: number;
  partnerPrompt: string;
  targetSentence: string;
  phonetic: string;
  meaningVi: string;
  keyKeywords: string[];
  sampleAudioText: string;
}

export type SpeakingCategory =
  | 'Agile Standup'
  | 'Job Interview'
  | 'Workplace Negotiation'
  | 'Daily Conversation'
  | 'Tech Support'
  | 'Academic & IELTS'
  | 'Social & Travel'
  | 'Business Meeting';

export interface SpeakingPrompt {
  id: string;
  title: string;
  category: SpeakingCategory;
  level: CEFRLevel | 'A2-B1' | 'B1-B2' | 'B2-C1';
  scenario: string;
  suggestedDuration?: string;
  talkingPoints?: string[];
  turns: SpeakingTurn[];
}

export type WritingTaskType =
  | 'Short Message'
  | 'Personal Note'
  | 'Informal Email'
  | 'Professional Email'
  | 'Technical Report'
  | 'Opinion Essay'
  | 'Argumentative Essay'
  | 'Analytical Report'
  | 'Discursive Essay'
  | 'Executive Summary';

export type WritingCategory =
  | 'Daily Life'
  | 'Social & Travel'
  | 'Tech / Workplace'
  | 'Career Development'
  | 'Academic / IELTS'
  | 'Culture & Society'
  | 'Science & Environment';

export interface WritingPrompt {
  id: string;
  title: string;
  type: WritingTaskType;
  category: WritingCategory;
  level: CEFRLevel | 'B1-B2' | 'B2-C1';
  minWords: number;
  maxWords?: number;
  wordRange?: string;
  prompt: string;
  guidelines: string[];
  recommendedVocab: { word: string; meaning: string }[];
  modelAnswer: string;
}
