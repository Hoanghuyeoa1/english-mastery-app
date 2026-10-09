// src/services/__tests__/leechDetector.test.ts
import { describe, it, expect } from 'vitest';
import { 
  analyzeCardLeechStatus, 
  detectDeckLeeches, 
  LeechCardInput,
  LEECH_DETECTOR_RULES 
} from '../leechDetector';
import { VocabWord, SRSProgress } from '../../types';

describe('PHASE 5: Leech Detection Engine Audit', () => {
  describe('1. New & Low-Review Cards (Zero False Positives)', () => {
    it('does not flag brand new unreviewed cards as leeches', () => {
      const card: LeechCardInput = {
        reps: 0,
        lapses: 0,
        difficulty: 5,
      };

      const result = analyzeCardLeechStatus(card);

      expect(result.isLeech).toBe(false);
      expect(result.score).toBe(0);
      expect(result.againRate).toBe(0);
      expect(result.reasons.length).toBe(0);
    });

    it('does not flag early learning cards with 1 minor lapse', () => {
      const card: LeechCardInput = {
        reps: 3,
        lapses: 1,
        difficulty: 5.5,
      };

      const result = analyzeCardLeechStatus(card);

      expect(result.isLeech).toBe(false);
      expect(result.score).toBe(0);
    });

    it('does not flag mature cards with normal forgetting rate (e.g. 4 lapses over 30 reviews)', () => {
      // 4 lapses out of 30 reviews = 13.3% lapse rate (< 35%) with normal difficulty (5.0)
      const card: LeechCardInput = {
        reps: 30,
        lapses: 4,
        difficulty: 5.0,
      };

      const result = analyzeCardLeechStatus(card);

      // Score = 40 (only lapse >= 4 triggered, but not againRate >= 35% or difficulty >= 8.5)
      expect(result.score).toBe(40);
      expect(result.isLeech).toBe(false); // 40 < 50
    });

    it('does NOT classify high difficulty alone as a leech', () => {
      // Single factor: difficulty = 9.8/10, but 0 lapses and normal reps
      const card: LeechCardInput = {
        reps: 5,
        lapses: 0,
        difficulty: 9.8,
      };

      const result = analyzeCardLeechStatus(card);

      expect(result.score).toBe(LEECH_DETECTOR_RULES.difficultyScoreWeight); // 25
      expect(result.score).toBeLessThan(LEECH_DETECTOR_RULES.leechCutoffScore); // 25 < 50
      expect(result.isLeech).toBe(false);
      expect(result.reasons).toEqual(['Độ khó FSRS cao (9.8/10)']);
    });
  });

  describe('2. Legacy SM-2 Card Behavior & Denominator Safety (No srsLevel Misuse)', () => {
    it('does NOT use srsLevel as lifetime reviewCount for legacy SM-2 cards', () => {
      // In SM-2: User reviews 6 times, presses Again -> srsLevel resets to 1, againCount is 2
      // If srsLevel was used as reviewCount: againRate would falsely be 2/1 = 200%!
      // Without reviewCount: safeReps defaults to 0, againRate remains 0, avoiding false positive!
      const legacyCard: LeechCardInput = {
        againCount: 2,
        // no reviewCount, no fsrs, srsLevel should NOT be used!
      };

      const result = analyzeCardLeechStatus(legacyCard);

      expect(result.againRate).toBe(0);
      expect(result.score).toBe(0);
      expect(result.isLeech).toBe(false);
    });

    it('handles legacy SM-2 card with lapses >= 4 conservatively', () => {
      // Legacy SM-2 card with 5 lapses but no reviewCount recorded:
      // Gets 40 points for lapses, but againRate condition does NOT falsely trigger without proof of safeReps >= 6
      const legacyCard: LeechCardInput = {
        againCount: 5,
      };

      const result = analyzeCardLeechStatus(legacyCard);

      expect(result.score).toBe(40);
      expect(result.isLeech).toBe(false); // 40 < 50, conservative!
      expect(result.reasons[0]).toContain('Đã quên (lapse) 5 lần');
    });

    it('reviewCount = 0 + againCount > 0 strictly avoids Infinity and NaN', () => {
      const corruptCard: LeechCardInput = {
        reviewCount: 0,
        againCount: 5,
      };

      const result = analyzeCardLeechStatus(corruptCard);

      expect(Number.isFinite(result.againRate)).toBe(true);
      expect(Number.isNaN(result.againRate)).toBe(false);
      expect(result.againRate).toBe(0);
      expect(result.score).toBe(40);
    });
  });

  describe('3. Robust Input Sanitization (Corrupted & Negative Values)', () => {
    it('sanitizes negative or malformed counters cleanly without throwing', () => {
      const malformedCard: LeechCardInput = {
        reps: -10,
        lapses: -4,
        againCount: -5,
        difficulty: -2,
      };

      const result = analyzeCardLeechStatus(malformedCard);

      expect(result.againRate).toBe(0);
      expect(result.score).toBe(0);
      expect(result.isLeech).toBe(false);
      expect(result.lapseCount).toBe(0);
      expect(result.againCount).toBe(0);
    });

    it('clamps difficulty cleanly between 1 and 10', () => {
      const extremeCard: LeechCardInput = {
        reps: 8,
        lapses: 4,
        difficulty: 999, // Should clamp to 10
      };

      const result = analyzeCardLeechStatus(extremeCard);

      expect(result.isLeech).toBe(true);
      expect(result.reasons).toContain('Độ khó FSRS cao (10.0/10)');
    });

    it('never mutates input card reference', () => {
      const originalCard: LeechCardInput = {
        reps: 8,
        lapses: 4,
        difficulty: 9.0,
      };
      const snapshot = JSON.stringify(originalCard);

      analyzeCardLeechStatus(originalCard);

      expect(JSON.stringify(originalCard)).toBe(snapshot);
    });
  });

  describe('4. Deterministic Multi-Factor Scoring Model', () => {
    it('flags card as leech when lapses >= 4 AND againRate >= 35% (Score: 75)', () => {
      const card: LeechCardInput = {
        reviewCount: 8,
        againCount: 4,
        difficulty: 5.0, // againRate = 4 / 8 = 50%
      };

      const result = analyzeCardLeechStatus(card);

      expect(result.isLeech).toBe(true);
      expect(result.score).toBe(75); // 40 (lapses) + 35 (againRate >= 35% & reps >= 6)
      expect(result.againRate).toBe(0.5);
      expect(result.reasons).toContain('Đã quên (lapse) 4 lần');
      expect(result.reasons.some((r) => r.includes('Tỷ lệ bấm "Again" cao (50%)'))).toBe(true);
    });

    it('flags card as leech when lapses >= 4 AND difficulty >= 8.5 (Score: 65)', () => {
      const card: LeechCardInput = {
        reviewCount: 4, // reps < 6 so againRate condition does not trigger
        againCount: 4,
        difficulty: 8.8,
      };

      const result = analyzeCardLeechStatus(card);

      expect(result.isLeech).toBe(true);
      expect(result.score).toBe(65); // 40 (lapses) + 25 (difficulty >= 8.5)
      expect(result.reasons).toContain('Đã quên (lapse) 4 lần');
      expect(result.reasons).toContain('Độ khó FSRS cao (8.8/10)');
    });

    it('flags card as leech when againRate >= 35% AND difficulty >= 8.5 (Score: 60)', () => {
      const card: LeechCardInput = {
        reviewCount: 10,
        lapses: 2,
        againCount: 4, // againRate = 4 / 10 = 40%
        difficulty: 9.0,
      };

      const result = analyzeCardLeechStatus(card);

      expect(result.isLeech).toBe(true);
      expect(result.score).toBe(60); // 35 (againRate >= 35%) + 25 (difficulty >= 8.5)
      expect(result.reasons).toContain('Tỷ lệ bấm "Again" cao (40%)');
      expect(result.reasons).toContain('Độ khó FSRS cao (9.0/10)');
    });

    it('caps total score at 100 when all three risk conditions trigger simultaneously', () => {
      const card: LeechCardInput = {
        reviewCount: 10,
        lapses: 5,
        againCount: 5,
        difficulty: 9.5, // 40 + 35 + 25 = 100
      };

      const result = analyzeCardLeechStatus(card);

      expect(result.isLeech).toBe(true);
      expect(result.score).toBe(100);
      expect(result.reasons.length).toBe(3);
    });
  });

  describe('5. FSRS Memory State Compatibility', () => {
    it('correctly parses nested FSRS memory state', () => {
      const card: LeechCardInput = {
        fsrs: {
          reps: 8,
          lapses: 4,
          difficulty: 7.2,
        },
      };

      const result = analyzeCardLeechStatus(card);

      expect(result.isLeech).toBe(true);
      expect(result.score).toBe(75);
    });
  });

  describe('6. detectDeckLeeches Deck Scanning', () => {
    it('correctly filters deck and returns leeches sorted descending by score', () => {
      const mockWords: VocabWord[] = [
        {
          id: 'w1_healthy',
          word: 'resilient',
          ipa: 'rɪˈzɪl.jənt',
          partOfSpeech: 'adj',
          meaning: 'kiên cường',
          example: 'She is resilient.',
          tag: 'Academic',
          srsLevel: 5,
          nextReviewDate: new Date().toISOString(),
          interval: 10,
          easeFactor: 2.5,
          reviewCount: 15,
          againCount: 1, // healthy card
        },
        {
          id: 'w2_severe_leech',
          word: 'ambiguous',
          ipa: 'æmˈbɪɡ.ju.əs',
          partOfSpeech: 'adj',
          meaning: 'mơ hồ',
          example: 'His answer was ambiguous.',
          tag: 'IELTS',
          srsLevel: 1,
          nextReviewDate: new Date().toISOString(),
          interval: 1,
          easeFactor: 1.5,
          fsrs: {
            reps: 10,
            lapses: 5,
            difficulty: 9.2,
            stability: 1.5,
            state: 3,
            lastReview: new Date().toISOString(),
          },
        },
        {
          id: 'w3_moderate_leech',
          word: 'meticulous',
          ipa: 'məˈtɪk.jə.ləs',
          partOfSpeech: 'adj',
          meaning: 'tỉ mỉ',
          example: 'He is meticulous.',
          tag: 'Academic',
          srsLevel: 2,
          nextReviewDate: new Date().toISOString(),
          interval: 2,
          easeFactor: 1.8,
          fsrs: {
            reps: 8,
            lapses: 4,
            difficulty: 6.0,
            stability: 2.0,
            state: 2,
            lastReview: new Date().toISOString(),
          },
        },
        {
          id: 'w4_unreviewed',
          word: 'ubiquitous',
          ipa: 'juːˈbɪk.wɪ.təs',
          partOfSpeech: 'adj',
          meaning: 'phổ biến',
          example: 'Smartphones are ubiquitous.',
          tag: 'Academic',
          srsLevel: 0,
          nextReviewDate: new Date().toISOString(),
          interval: 0,
          easeFactor: 2.5,
        },
      ];

      const leeches = detectDeckLeeches(mockWords);

      // Should only find w2 (score 100) and w3 (score 75)
      expect(leeches.length).toBe(2);
      expect(leeches[0].word).toBe('ambiguous');
      expect(leeches[0].analysis.score).toBe(100);
      expect(leeches[1].word).toBe('meticulous');
      expect(leeches[1].analysis.score).toBe(75);
    });

    it('integrates srsProgressMap overrides seamlessly', () => {
      const mockWords: VocabWord[] = [
        {
          id: 'w_override',
          word: 'perseverance',
          ipa: 'ˌpɜː.sɪˈvɪə.rəns',
          partOfSpeech: 'n',
          meaning: 'sự kiên trì',
          example: 'Success requires perseverance.',
          tag: 'Daily',
          srsLevel: 0,
          nextReviewDate: new Date().toISOString(),
          interval: 0,
          easeFactor: 2.5,
        },
      ];

      const mockProgressMap: Record<string, SRSProgress> = {
        w_override: {
          srsLevel: 1,
          nextReviewDate: new Date().toISOString(),
          interval: 1,
          easeFactor: 1.4,
          fsrs: {
            reps: 7,
            lapses: 4,
            difficulty: 8.8,
            stability: 1.2,
            state: 3,
            lastReview: new Date().toISOString(),
          },
        },
      };

      const leeches = detectDeckLeeches(mockWords, mockProgressMap);

      expect(leeches.length).toBe(1);
      expect(leeches[0].word).toBe('perseverance');
      expect(leeches[0].analysis.isLeech).toBe(true);
    });
  });
});
