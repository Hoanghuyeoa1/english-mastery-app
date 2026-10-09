// src/services/__tests__/toeicAudioResolver.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateToeicAudioMetadata,
  resolveToeicAudioSource,
  isToeicAudioPlayable,
  formatAudioTime,
  findActiveAudioSegment,
  clampAudioVolume,
  SUPPORTED_AUDIO_FORMATS,
} from '../toeicAudioResolver';
import {
  ToeicAudioMetadata,
  ToeicQuestion,
  ToeicQuestionGroup,
} from '../../types/toeic';
import { TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS } from '../../data/toeicQuestionsData';

describe('TOEIC Audio Resolver & Validation Suite (Phase 1)', () => {
  // =========================================================================
  // 1. PURE VALIDATION SUITE (validateToeicAudioMetadata)
  // =========================================================================
  describe('1. Audio Metadata Pure Validation', () => {
    it('handles undefined, null or primitive metadata safely without throwing', () => {
      const resUndef = validateToeicAudioMetadata(undefined);
      expect(resUndef.isValid).toBe(false);
      expect(resUndef.hasAudioUrl).toBe(false);
      expect(resUndef.issues.some((i) => i.code === 'MISSING_METADATA')).toBe(true);

      const resNull = validateToeicAudioMetadata(null);
      expect(resNull.isValid).toBe(false);

      const resString = validateToeicAudioMetadata('invalid-string');
      expect(resString.isValid).toBe(false);
    });

    it('rejects empty or whitespace audio URL', () => {
      const res = validateToeicAudioMetadata({ url: '   ' });
      expect(res.isValid).toBe(false);
      expect(res.issues.some((i) => i.code === 'EMPTY_URL' && i.severity === 'error')).toBe(true);
    });

    it('rejects unsafe URL protocols (e.g. javascript: or dangerous schemes)', () => {
      const res = validateToeicAudioMetadata({ url: 'javascript:alert(1)' });
      expect(res.isValid).toBe(false);
      expect(res.issues.some((i) => i.code === 'UNSAFE_URL_PROTOCOL')).toBe(true);
    });

    it('rejects unsupported non-audio file extensions (e.g. .exe, .pdf)', () => {
      const resExe = validateToeicAudioMetadata({ url: 'https://cdn.example.com/audio/malware.exe' });
      expect(resExe.isValid).toBe(false);
      expect(resExe.issues.some((i) => i.code === 'UNSUPPORTED_EXTENSION')).toBe(true);

      const resPdf = validateToeicAudioMetadata({ url: '/assets/document.pdf' });
      expect(resPdf.isValid).toBe(false);
      expect(resPdf.issues.some((i) => i.code === 'UNSUPPORTED_EXTENSION')).toBe(true);
    });

    it('validates supported audio formats and URLs cleanly', () => {
      for (const fmt of SUPPORTED_AUDIO_FORMATS) {
        const res = validateToeicAudioMetadata({
          url: `/audio/test.${fmt}`,
          format: fmt,
          durationMs: 45000,
          accent: 'en-US',
        });
        expect(res.isValid).toBe(true);
        expect(res.isTimingValid).toBe(true);
        expect(res.issues.length).toBe(0);
      }
    });

    it('flags explicit unsupported format as error', () => {
      const res = validateToeicAudioMetadata({
        url: '/audio/test.flac',
        format: 'flac' as any,
      });
      expect(res.isValid).toBe(false);
      expect(res.issues.some((i) => i.code === 'UNSUPPORTED_FORMAT')).toBe(true);
    });

    it('warns on negative or NaN durationMs', () => {
      const resNeg = validateToeicAudioMetadata({
        url: '/audio/test.mp3',
        durationMs: -5000,
      });
      expect(resNeg.isValid).toBe(true); // Still playable!
      expect(resNeg.issues.some((i) => i.code === 'INVALID_DURATION')).toBe(true);

      const resNaN = validateToeicAudioMetadata({
        url: '/audio/test.mp3',
        durationMs: Number.NaN,
      });
      expect(resNaN.issues.some((i) => i.code === 'INVALID_DURATION')).toBe(true);
    });

    it('validates timing segments: catches negative timing, reversed intervals, and NaN', () => {
      // Reversed interval: endMs < startMs
      const resReversed = validateToeicAudioMetadata({
        url: '/audio/p1_01.mp3',
        durationMs: 10000,
        segments: [
          { text: 'A man is typing.', startMs: 5000, endMs: 2000 },
        ],
      });
      expect(resReversed.isValid).toBe(true); // MP3 URL is valid!
      expect(resReversed.isTimingValid).toBe(false); // Timing is corrupted!
      expect(resReversed.issues.some((i) => i.code === 'REVERSED_INTERVAL')).toBe(true);

      // Negative startMs
      const resNegative = validateToeicAudioMetadata({
        url: '/audio/p1_01.mp3',
        segments: [
          { text: 'Hello', startMs: -100, endMs: 1500 },
        ],
      });
      expect(resNegative.isTimingValid).toBe(false);
      expect(resNegative.issues.some((i) => i.code === 'NEGATIVE_START_TIMING')).toBe(true);
    });

    it('validates token-level timings within segments', () => {
      const resBadTokens = validateToeicAudioMetadata({
        url: '/audio/p3_01.mp3',
        segments: [
          {
            text: 'Hello world',
            startMs: 0,
            endMs: 3000,
            tokens: [
              { text: 'Hello', startMs: 0, endMs: 1500 },
              { text: 'world', startMs: 2000, endMs: 1000 }, // endMs < startMs
            ],
          },
        ],
      });
      expect(resBadTokens.isValid).toBe(true);
      expect(resBadTokens.isTimingValid).toBe(false);
      expect(resBadTokens.issues.some((i) => i.code === 'INVALID_TOKEN_TIMING')).toBe(true);
    });

    it('validates ambient noise configurations (volume boundaries and url presence)', () => {
      const resBadVol = validateToeicAudioMetadata({
        url: '/audio/p4_01.mp3',
        ambient: {
          enabled: true,
          type: 'test_center',
          volume: 2.5, // > 1.0
          url: '/audio/ambient/ets_room.mp3',
        },
      });
      expect(resBadVol.issues.some((i) => i.code === 'INVALID_AMBIENT_VOLUME')).toBe(true);

      const resMissingUrl = validateToeicAudioMetadata({
        url: '/audio/p4_01.mp3',
        ambient: {
          enabled: true,
          type: 'office',
          url: '',
        },
      });
      expect(resMissingUrl.issues.some((i) => i.code === 'MISSING_AMBIENT_URL')).toBe(true);
    });

    it('CRUCIAL GRACEFUL DEGRADATION: Valid MP3 with corrupted timing preserves playable MP3 but disables timing sync', () => {
      const metadataWithBadTiming: ToeicAudioMetadata = {
        url: 'https://storage.googleapis.com/english-mastery/toeic/audio/p3_conv_1.mp3',
        durationMs: 32000,
        accent: 'en-US',
        segments: [
          { text: 'Segment 1', startMs: 0, endMs: 5000 },
          { text: 'Segment 2 Corrupted', startMs: 6000, endMs: 3000 }, // reversed
        ],
      };

      const result = validateToeicAudioMetadata(metadataWithBadTiming);
      // Playable URL exists -> isValid must be TRUE
      expect(result.isValid).toBe(true);
      // But timing is NOT safe -> isTimingValid must be FALSE
      expect(result.isTimingValid).toBe(false);
    });
  });

  // =========================================================================
  // 2. AUDIO SOURCE RESOLVER SUITE (resolveToeicAudioSource)
  // =========================================================================
  describe('2. Audio Source Resolver Decisions & Invariants', () => {
    it('Legacy Question (No audioMetadata): resolves smoothly to TTS with audioScript', () => {
      const legacyQuestion: Partial<ToeicQuestion> = {
        id: 'toeic_p1_legacy_01',
        part: 'part1_photos',
        skill: 'listening',
        audioScript: '(A) He is walking in the park. (B) He is riding a bicycle.',
        questionText: 'Look at the photograph and choose the statement that best describes what you see.',
      };

      const resolved = resolveToeicAudioSource(legacyQuestion as ToeicQuestion);

      expect(resolved.sourceType).toBe('tts');
      expect(resolved.textToSpeak).toBe('(A) He is walking in the park. (B) He is riding a bicycle.');
      expect(resolved.accent).toBe('en-US');
      expect(resolved.rate).toBe(0.85); // Standard TTS speed
      expect(resolved.hasValidTiming).toBe(false);
      expect(resolved.fallbackReason).toBe('NO_AUDIO_METADATA_LEGACY_TTS');
    });

    it('Legacy Question without audioScript: falls back to questionText TTS', () => {
      const legacyNoScript: Partial<ToeicQuestion> = {
        id: 'toeic_p2_legacy_02',
        part: 'part2_qna',
        skill: 'listening',
        audioScript: undefined,
        questionText: 'Where did you leave the financial report?',
      };

      const resolved = resolveToeicAudioSource(legacyNoScript as ToeicQuestion);

      expect(resolved.sourceType).toBe('tts');
      expect(resolved.textToSpeak).toBe('Where did you leave the financial report?');
    });

    it('Question with Valid MP3 Metadata: resolves to MP3 with full metadata & timings', () => {
      const modernQuestion: Partial<ToeicQuestion> = {
        id: 'toeic_p1_mp3_01',
        part: 'part1_photos',
        skill: 'listening',
        audioMetadata: {
          url: 'https://cdn.example.com/toeic/p1_01.mp3',
          format: 'mp3',
          durationMs: 14500,
          accent: 'en-GB',
          segments: [
            { text: '(A) A man is loading boxes.', startMs: 0, endMs: 3200 },
            { text: '(B) A man is driving a forklift.', startMs: 3500, endMs: 6800 },
          ],
        },
        audioScript: '(A) A man is loading boxes. (B) A man is driving a forklift.',
        questionText: 'Choose the statement.',
      };

      const resolved = resolveToeicAudioSource(modernQuestion as ToeicQuestion);

      expect(resolved.sourceType).toBe('mp3');
      expect(resolved.audioUrl).toBe('https://cdn.example.com/toeic/p1_01.mp3');
      expect(resolved.durationMs).toBe(14500);
      expect(resolved.accent).toBe('en-GB');
      expect(resolved.rate).toBe(1.0);
      expect(resolved.hasValidTiming).toBe(true);
      expect(resolved.timingSegments).toHaveLength(2);
      expect(resolved.isInheritedFromGroup).toBe(false);
    });

    it('Question with Valid MP3 but corrupted timing: resolves to MP3 with timing sync disabled', () => {
      const corruptTimingQuestion: Partial<ToeicQuestion> = {
        id: 'toeic_p1_corrupt_timing',
        part: 'part1_photos',
        skill: 'listening',
        audioMetadata: {
          url: 'https://cdn.example.com/toeic/p1_02.mp3',
          format: 'mp3',
          durationMs: 12000,
          segments: [
            { text: 'Statement A', startMs: 4000, endMs: 1000 }, // reversed timing!
          ],
        },
        audioScript: 'Statement A',
        questionText: 'Question',
      };

      const resolved = resolveToeicAudioSource(corruptTimingQuestion as ToeicQuestion);

      // Playable audio is preserved!
      expect(resolved.sourceType).toBe('mp3');
      expect(resolved.audioUrl).toBe('https://cdn.example.com/toeic/p1_02.mp3');
      // Timing segments stripped and flag set to false to prevent highlight crashes
      expect(resolved.hasValidTiming).toBe(false);
      expect(resolved.timingSegments).toBeUndefined();
      expect(resolved.validationIssues.some((i) => i.code === 'REVERSED_INTERVAL')).toBe(true);
    });

    it('Question with Broken MP3 URL: gracefully falls back to TTS', () => {
      const brokenUrlQuestion: Partial<ToeicQuestion> = {
        id: 'toeic_p2_broken_url',
        part: 'part2_qna',
        skill: 'listening',
        audioMetadata: {
          url: '   ', // Empty URL
        },
        audioScript: 'When does the board meeting start?',
        questionText: 'When does the board meeting start?',
      };

      const resolved = resolveToeicAudioSource(brokenUrlQuestion as ToeicQuestion);

      expect(resolved.sourceType).toBe('tts');
      expect(resolved.textToSpeak).toBe('When does the board meeting start?');
      expect(resolved.fallbackReason).toBe('INVALID_AUDIO_METADATA_FALLBACK_TTS');
      expect(resolved.validationIssues.some((i) => i.code === 'EMPTY_URL')).toBe(true);
    });

    it('Group-based question inherits MP3 audio from parent ToeicQuestionGroup', () => {
      const groupQuestion: Partial<ToeicQuestion> = {
        id: 'toeic_p3_1_a',
        part: 'part3_conv',
        skill: 'listening',
        groupId: 'toeic_grp_p3_1',
        audioScript: 'Man: Hello, how can I help? Woman: I need a return form.',
        questionText: 'What is the woman asking for?',
      };

      const parentGroup: Partial<ToeicQuestionGroup> = {
        id: 'toeic_grp_p3_1',
        part: 'part3_conv',
        skill: 'listening',
        type: 'audio_conversation',
        questionIds: ['toeic_p3_1_a', 'toeic_p3_1_b', 'toeic_p3_1_c'],
        audioMetadata: {
          url: 'https://cdn.example.com/toeic/p3_grp_1.mp3',
          format: 'mp3',
          durationMs: 38000,
          accent: 'en-US',
        },
      };

      const resolved = resolveToeicAudioSource(
        groupQuestion as ToeicQuestion,
        parentGroup as ToeicQuestionGroup
      );

      expect(resolved.sourceType).toBe('mp3');
      expect(resolved.audioUrl).toBe('https://cdn.example.com/toeic/p3_grp_1.mp3');
      expect(resolved.isInheritedFromGroup).toBe(true);
      expect(resolved.durationMs).toBe(38000);
    });

    it('Group inheritance can be explicitly disabled via options', () => {
      const groupQuestion: Partial<ToeicQuestion> = {
        id: 'toeic_p3_1_a',
        part: 'part3_conv',
        skill: 'listening',
        audioScript: 'Question audio prompt only',
      };

      const parentGroup: Partial<ToeicQuestionGroup> = {
        id: 'toeic_grp_p3_1',
        questionIds: ['toeic_p3_1_a'],
        audioMetadata: {
          url: 'https://cdn.example.com/toeic/p3_grp_1.mp3',
        },
      };

      const resolved = resolveToeicAudioSource(
        groupQuestion as ToeicQuestion,
        parentGroup as ToeicQuestionGroup,
        { inheritFromGroup: false }
      );

      expect(resolved.sourceType).toBe('tts');
      expect(resolved.textToSpeak).toBe('Question audio prompt only');
      expect(resolved.isInheritedFromGroup).toBeFalsy();
    });

    it('Forced TTS Mode overrides valid MP3 audio', () => {
      const questionWithMp3: Partial<ToeicQuestion> = {
        id: 'toeic_forced_tts',
        part: 'part1_photos',
        skill: 'listening',
        audioMetadata: {
          url: 'https://cdn.example.com/toeic/sample.mp3',
        },
        audioScript: 'Testing forced TTS mode script',
      };

      const resolved = resolveToeicAudioSource(questionWithMp3 as ToeicQuestion, {
        forcedSource: 'tts',
      });

      expect(resolved.sourceType).toBe('tts');
      expect(resolved.textToSpeak).toBe('Testing forced TTS mode script');
      expect(resolved.fallbackReason).toBe('FORCED_TTS');
    });

    it('Forced MP3 Mode yields sourceType: "none" when no valid MP3 is available', () => {
      const questionNoMp3: Partial<ToeicQuestion> = {
        id: 'toeic_no_mp3',
        part: 'part2_qna',
        skill: 'listening',
        audioScript: 'Where is the meeting?',
      };

      const resolved = resolveToeicAudioSource(questionNoMp3 as ToeicQuestion, {
        forcedSource: 'mp3',
      });

      expect(resolved.sourceType).toBe('none');
      expect(resolved.fallbackReason).toBe('FORCED_MP3_UNAVAILABLE');
    });

    it('Respects preferredAccent when metadata does not specify one', () => {
      const q: Partial<ToeicQuestion> = {
        id: 'q_acc',
        audioScript: 'Good morning',
      };

      const resolved = resolveToeicAudioSource(q as ToeicQuestion, {
        preferredAccent: 'en-AU',
      });

      expect(resolved.accent).toBe('en-AU');
    });

    it('Returns sourceType: "none" when neither audio nor script is present', () => {
      const emptyItem = {};
      const resolved = resolveToeicAudioSource(emptyItem);

      expect(resolved.sourceType).toBe('none');
      expect(resolved.fallbackReason).toBe('NO_AUDIO_OR_SCRIPT_AVAILABLE');
    });
  });

  // =========================================================================
  // 3. UTILITY FUNCTIONS SUITE
  // =========================================================================
  describe('3. Utility Functions (format, playback check, segment search)', () => {
    it('isToeicAudioPlayable correctly identifies playable vs non-playable sources', () => {
      expect(isToeicAudioPlayable({ sourceType: 'mp3', audioUrl: '/audio/test.mp3', accent: 'en-US', rate: 1.0, hasValidTiming: false, validationIssues: [] })).toBe(true);
      expect(isToeicAudioPlayable({ sourceType: 'mp3', audioUrl: '', accent: 'en-US', rate: 1.0, hasValidTiming: false, validationIssues: [] })).toBe(false);
      expect(isToeicAudioPlayable({ sourceType: 'tts', textToSpeak: 'Hello', accent: 'en-US', rate: 0.85, hasValidTiming: false, validationIssues: [] })).toBe(true);
      expect(isToeicAudioPlayable({ sourceType: 'tts', textToSpeak: '', accent: 'en-US', rate: 0.85, hasValidTiming: false, validationIssues: [] })).toBe(false);
      expect(isToeicAudioPlayable({ sourceType: 'none', accent: 'en-US', rate: 1.0, hasValidTiming: false, validationIssues: [] })).toBe(false);
    });

    it('formatAudioTime formats milliseconds to MM:SS with zero padding', () => {
      expect(formatAudioTime(0)).toBe('00:00');
      expect(formatAudioTime(45000)).toBe('00:45');
      expect(formatAudioTime(65000)).toBe('01:05');
      expect(formatAudioTime(3600000)).toBe('60:00');
      expect(formatAudioTime(-100)).toBe('00:00');
      expect(formatAudioTime(Number.NaN)).toBe('00:00');
    });

    it('findActiveAudioSegment identifies active segment and token by currentTimeMs', () => {
      const segments = [
        {
          id: 'seg_1',
          text: 'Good morning everyone.',
          startMs: 0,
          endMs: 3000,
          tokens: [
            { text: 'Good', startMs: 0, endMs: 800 },
            { text: 'morning', startMs: 801, endMs: 1800 },
            { text: 'everyone.', startMs: 1801, endMs: 3000 },
          ],
        },
        {
          id: 'seg_2',
          text: 'Welcome to the annual conference.',
          startMs: 3500,
          endMs: 7000,
        },
      ];

      // At 1000ms: in seg_1, word "morning"
      const res1 = findActiveAudioSegment(segments, 1000);
      expect(res1.segmentIndex).toBe(0);
      expect(res1.segment?.id).toBe('seg_1');
      expect(res1.activeToken?.text).toBe('morning');

      // At 3200ms: pause between segments
      const resPause = findActiveAudioSegment(segments, 3200);
      expect(resPause.segmentIndex).toBe(-1);
      expect(resPause.segment).toBeNull();

      // At 5000ms: in seg_2
      const res2 = findActiveAudioSegment(segments, 5000);
      expect(res2.segmentIndex).toBe(1);
      expect(res2.segment?.id).toBe('seg_2');

      // Negative or undefined
      expect(findActiveAudioSegment(undefined, 1000).segmentIndex).toBe(-1);
      expect(findActiveAudioSegment(segments, -50).segmentIndex).toBe(-1);
    });

    it('clampAudioVolume keeps volume safely inside [0.0, 1.0]', () => {
      expect(clampAudioVolume(0.5)).toBe(0.5);
      expect(clampAudioVolume(-0.2)).toBe(0);
      expect(clampAudioVolume(1.8)).toBe(1);
      expect(clampAudioVolume('invalid', 0.7)).toBe(0.7);
    });
  });

  // =========================================================================
  // 4. BACKWARD COMPATIBILITY WITH PRODUCTION QUESTION BANK & GROUPS
  // =========================================================================
  describe('4. Dataset Backward Compatibility Verification', () => {
    it('resolves 100% of Listening questions in production TOEIC_QUESTION_BANK cleanly without throwing', () => {
      const listeningQuestions = TOEIC_QUESTION_BANK.filter((q) => q.skill === 'listening');
      expect(listeningQuestions.length).toBeGreaterThan(0);

      const groupMap = new Map<string, ToeicQuestionGroup>();
      TOEIC_QUESTION_GROUPS.forEach((g) => groupMap.set(g.id, g));

      let resolvedCount = 0;
      for (const q of listeningQuestions) {
        const parentGroup = q.groupId ? groupMap.get(q.groupId) || null : null;
        const resolved = resolveToeicAudioSource(q, parentGroup);

        expect(isToeicAudioPlayable(resolved)).toBe(true);
        expect(['mp3', 'tts']).toContain(resolved.sourceType);
        expect(resolved.accent).toBeDefined();
        resolvedCount++;
      }

      expect(resolvedCount).toBe(listeningQuestions.length);
    });

    it('resolves 100% of production TOEIC_QUESTION_GROUPS cleanly', () => {
      const listeningGroups = TOEIC_QUESTION_GROUPS.filter((g) => g.skill === 'listening');
      expect(listeningGroups.length).toBeGreaterThan(0);

      for (const g of listeningGroups) {
        const resolved = resolveToeicAudioSource(g);
        expect(isToeicAudioPlayable(resolved)).toBe(true);
        expect(['mp3', 'tts']).toContain(resolved.sourceType);
      }
    });
  });
});
