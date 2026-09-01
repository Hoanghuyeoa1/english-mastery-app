export interface ListeningLesson {
  id: string;
  title: string;
  category: 'Tech' | 'Workplace' | 'Interview' | 'Daily Life';
  level: 'A2' | 'B1' | 'B2' | 'C1';
  duration: string;
  description: string;
  audioText: string;
  sentences: {
    en: string;
    vi: string;
  }[];
  questions: {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    type?: 'main_idea' | 'detail' | 'vocab_context' | 'negative_fact' | 'inference';
  }[];
}

export interface ReadingLesson {
  id: string;
  title: string;
  category: 'Tech & AI' | 'Career & Business' | 'Science & Habit' | 'Workplace Culture';
  level: 'B1' | 'B2' | 'C1';
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
    type?: 'main_idea' | 'detail' | 'vocab_context' | 'negative_fact' | 'inference';
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

export interface SpeakingPrompt {
  id: string;
  title: string;
  category: 'Agile Standup' | 'Job Interview' | 'Workplace Negotiation' | 'Daily Conversation' | 'Tech Support';
  level: 'A2-B1' | 'B1-B2' | 'B2-C1';
  scenario: string;
  turns: SpeakingTurn[];
}

export interface WritingPrompt {
  id: string;
  title: string;
  type: 'Professional Email' | 'Technical Report' | 'Opinion Essay';
  category: 'Tech / Workplace' | 'Career Development' | 'Academic / IELTS';
  level: 'B1-B2' | 'B2-C1';
  minWords: number;
  prompt: string;
  guidelines: string[];
  recommendedVocab: { word: string; meaning: string }[];
  modelAnswer: string;
}
