/**
 * Four Skills Competency Model v2 — Evidence Data Model
 * 
 * Defines atomic competency evidence items with provenance metadata:
 * source tracking, CEFR task difficulty, timestamping, quality weighting,
 * and extensible context payloads.
 */

export type CompetencySkill = 'listening' | 'reading' | 'speaking' | 'writing';

export type CompetencyEvidenceSource =
  | 'four-skills'
  | 'toeic'
  | 'shadowing'
  | 'writing-ai'
  | 'writing-offline'
  | 'legacy';

import type { CEFRLevel } from './cefr';
export type { CEFRLevel };

export interface CompetencyEvidence {
  id: string;
  skill: CompetencySkill;
  score: number; // Normalized integer 0 - 100
  source: CompetencyEvidenceSource;
  cefrDifficulty?: CEFRLevel; // Undefined for legacy or unrated sources
  createdAt: number; // Unix epoch ms. 0 indicates legacy unknown timestamp
  quality?: number; // Normalized confidence weight: 0.0 - 1.0 (default: 1.0)
  metadata?: Record<string, unknown>; // Extensible context (e.g. lessonId, examId, duration)
}

export type CompetencyEvidenceInput = Omit<CompetencyEvidence, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: number;
};

export interface FourSkillsEvidenceStore {
  listening: CompetencyEvidence[];
  reading: CompetencyEvidence[];
  speaking: CompetencyEvidence[];
  writing: CompetencyEvidence[];
}
