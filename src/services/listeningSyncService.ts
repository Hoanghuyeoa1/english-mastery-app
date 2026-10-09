import { ListeningLesson } from '../data/fourSkills/types';

export type HighlightMode = 'sentence' | 'word';
export type TrackingSource = 'native-boundary' | 'audio-time' | 'fallback';

export interface HighlightState {
  highlightMode: HighlightMode;
  activeSentenceIndex: number | null;
  activeWordIndex: number | null;
  trackingSource?: TrackingSource;
}

export interface TokenSpan {
  text: string;
  isWord: boolean;
  wordIndex: number | null; // 0-based index among words in sentence
  cleanWord: string | null; // normalized lexical identity for Dictionary/SRS
  startChar: number; // 0-based offset relative to sentence text
  endChar: number; // end offset relative to sentence text
}

export interface WordSyncSpan extends TokenSpan {
  wordStartMs: number; // offset in ms from sentence start
  wordEndMs: number; // offset in ms from sentence start
  estimatedDurationMs: number;
  audioStartChar: number; // offset in audioText
  audioEndChar: number;
  globalWordIndex: number; // 0-based word index across entire lesson
  globalStartMs: number; // offset in ms from beginning of lesson
  globalEndMs: number; // offset in ms from beginning of lesson
}

export interface SentenceSyncSpan {
  sentenceIndex: number;
  speaker?: string;
  text: string;
  audioStartChar: number; // 0-based start offset in lesson.audioText
  audioEndChar: number; // 0-based end offset in lesson.audioText
  coreTextStartChar: number; // start offset of actual sentence.en in lesson.audioText
  coreTextEndChar: number;
  estimatedDurationMs: number;
  estimatedStartMs: number;
  estimatedEndMs: number;
  tokens: TokenSpan[];
  words: WordSyncSpan[];
}

export interface LessonSyncMap {
  lessonId: string;
  speechRate: number;
  totalEstimatedMs: number;
  totalWords: number;
  sentences: SentenceSyncSpan[];
}

export interface PlaybackPosition {
  currentTimeMs: number;
  durationMs: number;
  progress: number; // 0.0 to 1.0 (clamped)
  sentenceIndex: number;
  wordIndex: number | null; // local word index within sentence
  charIndex: number; // global char offset in audioText
  globalWordIndex: number | null; // global word index in lesson
}

export interface SeekState {
  isSeeking: boolean;
  wasPlayingBeforeSeek: boolean;
  seekTarget: PlaybackPosition | null;
}

export interface LogicalSeekRequest {
  sessionId: number;
  playbackStartCharOffset: number;
  playbackStartWordIndex: number;
  textToSpeak: string;
  shouldPlay: boolean;
  position: PlaybackPosition;
}

export interface TranscriptSegmentSentence {
  sentence: ListeningLesson['sentences'][number];
  globalSentenceIndex: number;
}

export interface TranscriptBlock {
  id: string;
  speaker?: string;
  sentences: TranscriptSegmentSentence[];
  startSentenceIndex: number;
  endSentenceIndex: number;
}

/**
 * Tokenizes sentence text into a lossless list of tokens (words, whitespace, punctuation).
 * Preserves:
 * - whitespace
 * - punctuation
 * - apostrophe & contractions (e.g. don't, I'd, we're, it's)
 * - numbers (e.g. 24, 100, 3.14)
 * - hyphenated words (e.g. 24-hour, state-of-the-art)
 * - lexical identity cleanWord for Dictionary/SRS
 */
export function tokenizeSentence(text: string): TokenSpan[] {
  if (!text) return [];

  // Match words (including contractions and hyphens), whitespace, or punctuation
  const tokenRegex = /([a-zA-Z0-9]+(?:['’][a-zA-Z0-9]+)*(?:-[a-zA-Z0-9]+(?:['’][a-zA-Z0-9]+)*)*)|(\s+)|([^a-zA-Z0-9\s]+)/g;
  const tokens: TokenSpan[] = [];
  let wordCounter = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const rawText = match[0];
    const startChar = match.index;
    const endChar = startChar + rawText.length;

    if (match[1]) {
      // Word token
      // Clean word strips any trailing/leading apostrophes or edge quotes, keeps internal contractions
      const clean = rawText.toLowerCase().replace(/^['’]+|['’]+$/g, '').trim();
      tokens.push({
        text: rawText,
        isWord: true,
        wordIndex: wordCounter++,
        cleanWord: clean,
        startChar,
        endChar,
      });
    } else {
      // Whitespace or punctuation token
      tokens.push({
        text: rawText,
        isWord: false,
        wordIndex: null,
        cleanWord: null,
        startChar,
        endChar,
      });
    }
  }

  return tokens;
}

/**
 * Parses duration string (e.g., "1:50", "2:30", "45s", "0:45") into total seconds.
 */
export function parseDurationToSeconds(durationStr: string): number {
  if (!durationStr) return 0;
  const cleaned = durationStr.trim().toLowerCase();

  // Pattern MM:SS or HH:MM:SS
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').map((p) => parseFloat(p));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return Math.max(0, parts[0] * 60 + parts[1]);
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
    }
  }

  // Pattern "XXs"
  if (cleaned.endsWith('s')) {
    const sec = parseFloat(cleaned.replace('s', ''));
    if (!isNaN(sec)) return Math.max(0, sec);
  }

  const num = parseFloat(cleaned);
  return !isNaN(num) && num > 0 ? num : 0;
}

/**
 * Safely formats seconds into "M:SS" or "MM:SS" string.
 * Gracefully handles NaN, null, undefined, Infinity, and negative values.
 * If duration >= 3600 (1 hour+), formats as "H:MM:SS".
 */
export function formatPlaybackTime(seconds: number | null | undefined, padMinutes = false): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return padMinutes ? '00:00' : '0:00';
  }
  const totalSec = Math.floor(seconds);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const secStr = secs < 10 ? `0${secs}` : `${secs}`;

  if (hours > 0) {
    const minStr = mins < 10 ? `0${mins}` : `${mins}`;
    return `${hours}:${minStr}:${secStr}`;
  }

  const minStr = padMinutes && mins < 10 ? `0${mins}` : `${mins}`;
  return `${minStr}:${secStr}`;
}

/**
 * Builds a deterministic synchronization map for a lesson.
 * Precomputes character offsets in audioText, tokenized words, and timing estimates.
 * Result is deterministic and cached per lesson + rate.
 */
export function buildLessonSyncMap(lesson: ListeningLesson, speechRate = 1.0): LessonSyncMap {
  const rate = speechRate > 0 ? speechRate : 1.0;
  const sentences = lesson.sentences || [];
  const audioText = lesson.audioText || '';

  if (sentences.length === 0) {
    return {
      lessonId: lesson.id,
      speechRate: rate,
      totalEstimatedMs: 0,
      totalWords: 0,
      sentences: [],
    };
  }

  // 1. Calculate weights for each sentence based on content length and punctuation pause
  const weights: number[] = sentences.map((sent) => {
    const textLen = sent.en.length;
    const punctMatches = sent.en.match(/[.!?,;:—–]/g);
    const punctCount = punctMatches ? punctMatches.length : 0;
    const speakerBonus = sent.speaker ? 15 : 0;
    return Math.max(10, textLen + punctCount * 8 + speakerBonus);
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;

  // 2. Base duration from metadata or estimated at ~150 words/minute
  let totalDurationSec = parseDurationToSeconds(lesson.duration);
  if (totalDurationSec <= 0) {
    const totalWords = sentences.reduce(
      (sum, s) => sum + s.en.trim().split(/\s+/).filter(Boolean).length,
      0
    );
    totalDurationSec = Math.max(5, (totalWords / 2.5)); // ~2.5 words per second
  }

  // Duration scales inversely with speech rate
  const scaledTotalMs = (totalDurationSec / rate) * 1000;

  // 3. Map sentences to character spans in audioText
  let searchOffset = 0;
  let accumulatedMs = 0;
  let globalWordCounter = 0;
  const mappedSentences: SentenceSyncSpan[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const sent = sentences[i];
    const tokens = tokenizeSentence(sent.en);
    const rawWords = tokens.filter((t) => t.isWord);

    // Timing distribution proportional to content length
    const sentDurationMs = Math.max(400, Math.round((weights[i] / totalWeight) * scaledTotalMs));
    const startMs = accumulatedMs;
    const endMs = startMs + sentDurationMs;
    accumulatedMs = endMs;

    // Locate core text in audioText
    let matchIdx = audioText.indexOf(sent.en, searchOffset);
    if (matchIdx === -1) {
      // Fallback: search from beginning or normalized search
      matchIdx = audioText.indexOf(sent.en);
      if (matchIdx === -1) {
        // Last-resort fallback: sequential estimation
        matchIdx = searchOffset;
      }
    }

    const coreTextStartChar = matchIdx;
    const coreTextEndChar = coreTextStartChar + sent.en.length;

    // audioStartChar: For sentence 0, always 0. For i > 0, connects seamlessly to previous sentence end.
    let audioStartChar = 0;
    if (i > 0) {
      audioStartChar = mappedSentences[i - 1].audioEndChar;
    }

    // Precompute weighted word timing within sentence based on word length and punctuation
    const wordWeights: number[] = rawWords.map((w) => {
      const len = w.text.length;
      const nextToken = tokens.find((t) => t.startChar === w.endChar);
      const hasTrailingPunct = nextToken && !nextToken.isWord && nextToken.text.trim().length > 0;
      return Math.max(2, len + (hasTrailingPunct ? 4 : 0));
    });
    const totalWordWeight = wordWeights.reduce((sum, w) => sum + w, 0) || 1;

    let wordAccumMs = 0;
    const words: WordSyncSpan[] = rawWords.map((w, wIdx) => {
      const wordDuration = Math.round((wordWeights[wIdx] / totalWordWeight) * sentDurationMs);
      const wStartMs = wordAccumMs;
      const wEndMs = wIdx === rawWords.length - 1 ? sentDurationMs : wStartMs + wordDuration;
      wordAccumMs = wEndMs;
      const gIdx = globalWordCounter++;
      return {
        ...w,
        wordStartMs: wStartMs,
        wordEndMs: wEndMs,
        estimatedDurationMs: Math.max(50, wEndMs - wStartMs),
        audioStartChar: coreTextStartChar + w.startChar,
        audioEndChar: coreTextStartChar + w.endChar,
        globalWordIndex: gIdx,
        globalStartMs: startMs + wStartMs,
        globalEndMs: startMs + wEndMs,
      };
    });

    mappedSentences.push({
      sentenceIndex: i,
      speaker: sent.speaker,
      text: sent.en,
      audioStartChar,
      audioEndChar: coreTextEndChar, // temporary, will extend to next sentence start below
      coreTextStartChar,
      coreTextEndChar,
      estimatedDurationMs: sentDurationMs,
      estimatedStartMs: startMs,
      estimatedEndMs: endMs,
      tokens,
      words,
    });

    searchOffset = coreTextEndChar;
  }

  // Ensure seamless boundary coverage: each sentence's audioEndChar extends to next sentence's start
  for (let i = 0; i < mappedSentences.length; i++) {
    if (i < mappedSentences.length - 1) {
      // Next sentence's core text starts at mappedSentences[i + 1].coreTextStartChar
      const nextCoreStart = mappedSentences[i + 1].coreTextStartChar;
      const currentCoreEnd = mappedSentences[i].coreTextEndChar;

      // Check if next sentence has a speaker label in audioText before nextCoreStart
      const nextSpeaker = mappedSentences[i + 1].speaker;
      let nextSentenceActualStart = nextCoreStart;
      if (nextSpeaker && nextCoreStart > currentCoreEnd) {
        const gapText = audioText.substring(currentCoreEnd, nextCoreStart);
        const speakerIdx = gapText.indexOf(nextSpeaker);
        if (speakerIdx !== -1) {
          nextSentenceActualStart = currentCoreEnd + speakerIdx;
        }
      }

      if (nextSentenceActualStart > currentCoreEnd) {
        mappedSentences[i].audioEndChar = nextSentenceActualStart;
        mappedSentences[i + 1].audioStartChar = nextSentenceActualStart;
      } else {
        mappedSentences[i].audioEndChar = Math.max(currentCoreEnd, mappedSentences[i].audioStartChar);
        mappedSentences[i + 1].audioStartChar = mappedSentences[i].audioEndChar;
      }
    } else {
      // Last sentence extends to the end of audioText
      mappedSentences[i].audioEndChar = Math.max(audioText.length, mappedSentences[i].coreTextEndChar);
    }
  }

  return {
    lessonId: lesson.id,
    speechRate: rate,
    totalEstimatedMs: accumulatedMs,
    totalWords: globalWordCounter,
    sentences: mappedSentences,
  };
}

/**
 * Resolves active sentence and word indices given character offset in audioText.
 */
export function mapCharIndexToSync(
  syncMap: LessonSyncMap,
  charIndex: number
): { sentenceIndex: number; wordIndex: number | null } {
  const { sentences } = syncMap;
  if (!sentences || sentences.length === 0) {
    return { sentenceIndex: -1, wordIndex: null };
  }

  // Guard against invalid/NaN/missing charIndex
  if (typeof charIndex !== 'number' || isNaN(charIndex)) {
    return { sentenceIndex: -1, wordIndex: null };
  }

  // Clamp charIndex
  const safeChar = Math.max(0, charIndex);

  // Find sentence containing charIndex
  let foundSent: SentenceSyncSpan | null = null;
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (safeChar >= s.audioStartChar && safeChar < s.audioEndChar) {
      foundSent = s;
      break;
    }
  }

  // If past the end, clamp to last sentence
  if (!foundSent) {
    if (safeChar >= sentences[sentences.length - 1].audioEndChar) {
      foundSent = sentences[sentences.length - 1];
    } else {
      foundSent = sentences[0];
    }
  }

  // Find word index within found sentence using deterministic monotonic partition
  let activeWordIdx: number | null = null;
  const words = foundSent.words;

  if (words.length > 0) {
    if (safeChar < words[0].audioStartChar) {
      // Before first word (speaker prefix or leading whitespace), map to word 0
      activeWordIdx = words[0].wordIndex;
    } else if (safeChar >= words[words.length - 1].audioStartChar) {
      // Past or on the last word's start, map to last word
      activeWordIdx = words[words.length - 1].wordIndex;
    } else {
      // Half-open interval: words[w].audioStartChar <= safeChar < words[w + 1].audioStartChar
      for (let w = 0; w < words.length - 1; w++) {
        if (safeChar >= words[w].audioStartChar && safeChar < words[w + 1].audioStartChar) {
          activeWordIdx = words[w].wordIndex;
          break;
        }
      }
      if (activeWordIdx === null) {
        activeWordIdx = words[0].wordIndex;
      }
    }
  }

  return {
    sentenceIndex: foundSent.sentenceIndex,
    wordIndex: activeWordIdx,
  };
}

/**
 * Resolves active sentence and word indices given elapsed playback time in ms.
 */
export function mapTimeToSync(
  syncMap: LessonSyncMap,
  elapsedMs: number
): { sentenceIndex: number; wordIndex: number | null } {
  const { sentences, totalEstimatedMs } = syncMap;
  if (!sentences || sentences.length === 0) {
    return { sentenceIndex: -1, wordIndex: null };
  }

  const safeTime = Math.max(0, elapsedMs);

  let foundSent: SentenceSyncSpan | null = null;
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (safeTime >= s.estimatedStartMs && safeTime < s.estimatedEndMs) {
      foundSent = s;
      break;
    }
  }

  if (!foundSent) {
    if (safeTime >= totalEstimatedMs) {
      foundSent = sentences[sentences.length - 1];
    } else {
      foundSent = sentences[0];
    }
  }

  // Estimate word inside sentence using deterministic monotonic partition
  let activeWordIdx: number | null = null;
  const words = foundSent.words;
  if (words.length > 0) {
    const sentElapsed = safeTime - foundSent.estimatedStartMs;
    if (sentElapsed < words[0].wordStartMs) {
      activeWordIdx = words[0].wordIndex;
    } else if (sentElapsed >= words[words.length - 1].wordStartMs) {
      activeWordIdx = words[words.length - 1].wordIndex;
    } else {
      for (let w = 0; w < words.length - 1; w++) {
        if (sentElapsed >= words[w].wordStartMs && sentElapsed < words[w + 1].wordStartMs) {
          activeWordIdx = words[w].wordIndex;
          break;
        }
      }
      if (activeWordIdx === null) {
        activeWordIdx = words[0].wordIndex;
      }
    }
  }

  return {
    sentenceIndex: foundSent.sentenceIndex,
    wordIndex: activeWordIdx,
  };
}

/**
 * Resolves unified PlaybackPosition from elapsed time in ms.
 */
export function resolvePositionFromTime(
  syncMap: LessonSyncMap,
  timeMs: number
): PlaybackPosition {
  if (!syncMap || !syncMap.sentences || syncMap.sentences.length === 0) {
    return {
      currentTimeMs: 0,
      durationMs: 0,
      progress: 0,
      sentenceIndex: -1,
      wordIndex: null,
      charIndex: 0,
      globalWordIndex: null,
    };
  }

  const durationMs = syncMap.totalEstimatedMs;
  const clampedTimeMs = Math.max(0, Math.min(durationMs, isNaN(timeMs) ? 0 : timeMs));
  const progress = durationMs > 0 ? clampedTimeMs / durationMs : 0;

  const mapped = mapTimeToSync(syncMap, clampedTimeMs);
  const sentenceIndex = mapped.sentenceIndex;
  const sent = syncMap.sentences[sentenceIndex];

  if (!sent) {
    return {
      currentTimeMs: clampedTimeMs,
      durationMs,
      progress,
      sentenceIndex: 0,
      wordIndex: null,
      charIndex: 0,
      globalWordIndex: null,
    };
  }

  let word: WordSyncSpan | undefined;
  if (mapped.wordIndex !== null && sent.words[mapped.wordIndex]) {
    word = sent.words[mapped.wordIndex];
  } else if (sent.words.length > 0) {
    word = sent.words[0];
  }

  return {
    currentTimeMs: clampedTimeMs,
    durationMs,
    progress,
    sentenceIndex,
    wordIndex: word ? word.wordIndex : null,
    charIndex: word ? word.audioStartChar : sent.audioStartChar,
    globalWordIndex: word ? word.globalWordIndex : null,
  };
}

/**
 * Resolves unified PlaybackPosition from progress (0.0 to 1.0).
 */
export function resolvePositionFromProgress(
  syncMap: LessonSyncMap,
  progress: number
): PlaybackPosition {
  const clampedProgress = Math.max(0, Math.min(1, isNaN(progress) ? 0 : progress));
  const targetMs = (syncMap?.totalEstimatedMs || 0) * clampedProgress;
  return resolvePositionFromTime(syncMap, targetMs);
}

/**
 * Resolves unified PlaybackPosition from character offset in audioText.
 */
export function resolvePositionFromCharIndex(
  syncMap: LessonSyncMap,
  charIndex: number
): PlaybackPosition {
  if (!syncMap || !syncMap.sentences || syncMap.sentences.length === 0) {
    return {
      currentTimeMs: 0,
      durationMs: 0,
      progress: 0,
      sentenceIndex: -1,
      wordIndex: null,
      charIndex: 0,
      globalWordIndex: null,
    };
  }

  const durationMs = syncMap.totalEstimatedMs;
  const mapped = mapCharIndexToSync(syncMap, charIndex);
  const sent = syncMap.sentences[mapped.sentenceIndex];
  if (!sent) {
    return resolvePositionFromTime(syncMap, 0);
  }

  let word: WordSyncSpan | undefined;
  if (mapped.wordIndex !== null && sent.words[mapped.wordIndex]) {
    word = sent.words[mapped.wordIndex];
  } else if (sent.words.length > 0) {
    word = sent.words[0];
  }

  const currentTimeMs = word ? word.globalStartMs : sent.estimatedStartMs;
  const progress = durationMs > 0 ? currentTimeMs / durationMs : 0;

  return {
    currentTimeMs,
    durationMs,
    progress,
    sentenceIndex: mapped.sentenceIndex,
    wordIndex: word ? word.wordIndex : null,
    charIndex: word ? word.audioStartChar : sent.audioStartChar,
    globalWordIndex: word ? word.globalWordIndex : null,
  };
}

/**
 * Resolves unified PlaybackPosition from sentenceIndex and optional wordIndex.
 */
export function resolvePositionFromSentence(
  syncMap: LessonSyncMap,
  sentenceIndex: number,
  wordIndex = 0
): PlaybackPosition {
  if (!syncMap || !syncMap.sentences || syncMap.sentences.length === 0) {
    return {
      currentTimeMs: 0,
      durationMs: 0,
      progress: 0,
      sentenceIndex: -1,
      wordIndex: null,
      charIndex: 0,
      globalWordIndex: null,
    };
  }

  const clampedSentIdx = Math.max(0, Math.min(syncMap.sentences.length - 1, sentenceIndex));
  const sent = syncMap.sentences[clampedSentIdx];
  const durationMs = syncMap.totalEstimatedMs;

  let word: WordSyncSpan | undefined;
  if (sent.words.length > 0) {
    const clampedWordIdx = Math.max(0, Math.min(sent.words.length - 1, wordIndex));
    word = sent.words[clampedWordIdx];
  }

  const currentTimeMs = word ? word.globalStartMs : sent.estimatedStartMs;
  const progress = durationMs > 0 ? currentTimeMs / durationMs : 0;

  return {
    currentTimeMs,
    durationMs,
    progress,
    sentenceIndex: clampedSentIdx,
    wordIndex: word ? word.wordIndex : null,
    charIndex: word ? word.audioStartChar : sent.audioStartChar,
    globalWordIndex: word ? word.globalWordIndex : null,
  };
}

/**
 * Resolves unified PlaybackPosition from 0-based global word index.
 */
export function resolvePositionFromGlobalWord(
  syncMap: LessonSyncMap,
  globalWordIndex: number
): PlaybackPosition {
  if (!syncMap || !syncMap.sentences || syncMap.sentences.length === 0 || syncMap.totalWords === 0) {
    return {
      currentTimeMs: 0,
      durationMs: 0,
      progress: 0,
      sentenceIndex: -1,
      wordIndex: null,
      charIndex: 0,
      globalWordIndex: null,
    };
  }

  const clampedGIdx = Math.max(0, Math.min(syncMap.totalWords - 1, globalWordIndex));

  for (const sent of syncMap.sentences) {
    for (const word of sent.words) {
      if (word.globalWordIndex === clampedGIdx) {
        return resolvePositionFromSentence(syncMap, sent.sentenceIndex, word.wordIndex ?? 0);
      }
    }
  }

  return resolvePositionFromSentence(syncMap, 0, 0);
}

export interface ListeningSyncControllerOptions {
  onHighlightChange: (state: HighlightState) => void;
  onPlaybackEnd?: () => void;
}

/**
 * ListeningSyncController: Single source of truth for audio playback synchronization.
 * Handles:
 * - Native boundary events (charIndex)
 * - Deterministic fallback estimation (content-length weighted)
 * - Pause / Resume / Seek / Restart
 * - Runtime mode switching (Sentence <-> Word) without audio restart
 * - Lesson switching & unmount lifecycle cleanup
 * - Zero redundant setStates
 */
export class ListeningSyncController {
  private syncMap: LessonSyncMap | null = null;
  private currentLesson: ListeningLesson | null = null;
  private speechRate = 1.0;
  private highlightMode: HighlightMode = 'sentence';

  private activeSentenceIndex: number | null = null;
  private activeWordIndex: number | null = null;

  private isPlaying = false;
  private isPaused = false;
  private startTime = 0;
  private pausedOffsetMs = 0;
  private lastNativeBoundaryTime = 0;
  private lastCharIndex: number | null = null;

  private isSeeking = false;
  private wasPlayingBeforeSeek = false;
  private seekTarget: PlaybackPosition | null = null;
  private playbackStartCharOffset = 0;
  private playbackStartWordIndex = 0;
  private audioElement: HTMLAudioElement | null = null;

  private trackingSource: TrackingSource = 'fallback';
  private allowBackwardMovement = false;

  private timerId: ReturnType<typeof setInterval> | null = null;
  private sessionId = 0; // Incremented on start/reset to invalidate old async callbacks

  private onHighlightChange: (state: HighlightState) => void;
  private onPlaybackEnd?: () => void;

  constructor(options: ListeningSyncControllerOptions) {
    this.onHighlightChange = options.onHighlightChange;
    this.onPlaybackEnd = options.onPlaybackEnd;
  }

  public getTrackingSource(): TrackingSource {
    return this.trackingSource;
  }

  public getSeekState(): SeekState {
    return {
      isSeeking: this.isSeeking,
      wasPlayingBeforeSeek: this.wasPlayingBeforeSeek,
      seekTarget: this.seekTarget ? { ...this.seekTarget } : null,
    };
  }

  public isCurrentlySeeking(): boolean {
    return this.isSeeking;
  }

  public setAudioElement(el: HTMLAudioElement | null): void {
    this.audioElement = el;
  }

  public getAudioElement(): HTMLAudioElement | null {
    return this.audioElement;
  }

  public getPlaybackStartOffset(): { charOffset: number; wordIndex: number } {
    return {
      charOffset: this.playbackStartCharOffset,
      wordIndex: this.playbackStartWordIndex,
    };
  }

  public getCurrentPosition(): PlaybackPosition {
    if (!this.syncMap || this.syncMap.sentences.length === 0) {
      return {
        currentTimeMs: 0,
        durationMs: 0,
        progress: 0,
        sentenceIndex: -1,
        wordIndex: null,
        charIndex: 0,
        globalWordIndex: null,
      };
    }
    const now = Date.now();
    const elapsedMs =
      this.pausedOffsetMs + (this.isPlaying && !this.isPaused ? now - this.startTime : 0);
    return resolvePositionFromTime(this.syncMap, elapsedMs);
  }

  public getCurrentTimeMs(): number {
    return this.getCurrentPosition().currentTimeMs;
  }

  public getDurationMs(): number {
    return this.syncMap?.totalEstimatedMs || 0;
  }

  public getProgress(): number {
    return this.getCurrentPosition().progress;
  }

  public setLesson(lesson: ListeningLesson | null, speed = 1.0): void {
    if (this.currentLesson?.id === lesson?.id && this.speechRate === speed) {
      return;
    }

    this.stop();
    this.currentLesson = lesson;
    this.speechRate = speed;
    this.syncMap = lesson ? buildLessonSyncMap(lesson, speed) : null;
  }

  public setSpeed(speed: number): void {
    if (this.speechRate === speed) return;
    this.speechRate = speed;
    if (this.currentLesson) {
      this.syncMap = buildLessonSyncMap(this.currentLesson, speed);
    }
  }

  public setHighlightMode(mode: HighlightMode): void {
    if (this.highlightMode === mode) return;
    this.highlightMode = mode;

    if (this.syncMap) {
      // Derive active position immediately from current playback position (without restarting audio)
      let targetSentenceIdx = this.activeSentenceIndex;
      let targetWordIdx = this.activeWordIndex;

      const now = Date.now();
      const hasRecentBoundary =
        this.lastCharIndex !== null &&
        this.lastNativeBoundaryTime > 0 &&
        now - this.lastNativeBoundaryTime < 800;

      if (hasRecentBoundary && this.lastCharIndex !== null) {
        const mapped = mapCharIndexToSync(this.syncMap, this.lastCharIndex);
        if (mapped.sentenceIndex >= 0) {
          targetSentenceIdx = mapped.sentenceIndex;
          targetWordIdx = mapped.wordIndex;
        }
      } else {
        const elapsedMs =
          this.pausedOffsetMs + (this.isPlaying && !this.isPaused ? now - this.startTime : 0);
        const mapped = mapTimeToSync(this.syncMap, elapsedMs);
        if (mapped.sentenceIndex >= 0) {
          targetSentenceIdx = mapped.sentenceIndex;
          targetWordIdx = mapped.wordIndex;
        }
      }

      this.activeSentenceIndex = targetSentenceIdx;
      this.activeWordIndex = targetWordIdx;
    }

    this.notifyState();
  }

  public getSessionId(): number {
    return this.sessionId;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying && !this.isPaused;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public start(lesson?: ListeningLesson, speed?: number): number {
    this.sessionId++;
    const currentSession = this.sessionId;

    if (lesson) {
      this.currentLesson = lesson;
      if (speed) this.speechRate = speed;
      this.syncMap = buildLessonSyncMap(lesson, this.speechRate);
    }

    if (!this.syncMap || this.syncMap.sentences.length === 0) {
      this.stop();
      return currentSession;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.isSeeking = false;
    this.wasPlayingBeforeSeek = false;
    this.seekTarget = null;
    this.playbackStartCharOffset = 0;
    this.playbackStartWordIndex = 0;
    this.trackingSource = 'fallback';
    this.startTime = Date.now();
    this.pausedOffsetMs = 0;
    this.lastNativeBoundaryTime = 0;
    this.lastCharIndex = 0;

    // Immediately start at Sentence 0, Word 0 with backward movement allowed
    this.allowBackwardMovement = true;
    this.updateHighlight(0, 0, 'fallback');
    this.allowBackwardMovement = false;

    // Start deterministic interval ticker (runs every 60ms)
    this.startEstimationTicker(currentSession);

    return currentSession;
  }

  public onBoundary(charIndex?: number, name?: string, callbackSessionId?: number): void {
    if (!this.isPlaying || this.isPaused) return;
    if (callbackSessionId !== undefined && callbackSessionId !== this.sessionId) return;
    if (!this.syncMap) return;

    // Guard against invalid/missing charIndex
    if (typeof charIndex !== 'number' || isNaN(charIndex) || charIndex < 0) {
      return;
    }

    // Map local charIndex of current utterance slice to global audioText charIndex
    const globalChar = this.playbackStartCharOffset + charIndex;

    this.trackingSource = 'native-boundary';
    this.lastCharIndex = globalChar;
    this.lastNativeBoundaryTime = Date.now();
    const mapped = mapCharIndexToSync(this.syncMap, globalChar);

    if (mapped.sentenceIndex >= 0) {
      // If browser fires 'sentence' boundary, default to word 0 of that sentence
      const targetWordIdx = name === 'sentence' ? 0 : mapped.wordIndex;
      this.updateHighlight(mapped.sentenceIndex, targetWordIdx, 'native-boundary');
    }
  }

  public pause(): void {
    if (!this.isPlaying || this.isPaused) return;
    this.isPaused = true;
    this.clearEstimationTicker();
    this.pausedOffsetMs += Date.now() - this.startTime;
  }

  public resume(callbackSessionId?: number): void {
    if (!this.isPlaying || !this.isPaused) return;
    if (callbackSessionId !== undefined && callbackSessionId !== this.sessionId) return;

    this.isPaused = false;
    this.startTime = Date.now();
    this.startEstimationTicker(this.sessionId);
  }

  public seekToPosition(pos: PlaybackPosition): LogicalSeekRequest | null {
    if (!this.syncMap || this.syncMap.sentences.length === 0) return null;

    // 1. Mark seeking and record whether audio was playing prior to seeking
    this.isSeeking = true;
    const shouldResume = this.isPlaying && !this.isPaused;
    this.wasPlayingBeforeSeek = shouldResume;
    this.seekTarget = pos;

    // 2. Invalidate previous session callbacks
    this.sessionId++;
    const newSession = this.sessionId;

    // 3. Clear existing ticker
    this.clearEstimationTicker();

    // 4. Update internal timeline and global offsets
    this.pausedOffsetMs = pos.currentTimeMs;
    this.startTime = Date.now();
    this.lastCharIndex = pos.charIndex;
    this.playbackStartCharOffset = pos.charIndex;
    this.playbackStartWordIndex = pos.globalWordIndex ?? 0;

    // 5. If HTMLAudioElement is attached, seek it natively
    if (this.audioElement) {
      try {
        this.audioElement.currentTime = pos.currentTimeMs / 1000;
      } catch {
        // Safe fallback if audio element is not ready
      }
    }

    // 6. Update highlight immediately with backward movement allowed
    this.allowBackwardMovement = true;
    const targetWordIdx = this.highlightMode === 'word' ? (pos.wordIndex ?? 0) : null;
    this.updateHighlight(pos.sentenceIndex, targetWordIdx, this.trackingSource);
    this.allowBackwardMovement = false;

    // 7. Prepare text slice for SpeechSynthesisUtterance starting from pos.charIndex
    const fullAudioText = this.currentLesson?.audioText || '';
    const textToSpeak = fullAudioText.slice(pos.charIndex);

    // 8. Restore playback / ticker state
    if (shouldResume) {
      this.isPlaying = true;
      this.isPaused = false;
      this.startEstimationTicker(newSession);
    } else {
      // Remain paused
      this.isPaused = true;
    }

    // 9. Exit seeking state
    this.isSeeking = false;

    return {
      sessionId: newSession,
      playbackStartCharOffset: pos.charIndex,
      playbackStartWordIndex: pos.globalWordIndex ?? 0,
      textToSpeak,
      shouldPlay: shouldResume,
      position: pos,
    };
  }

  public seekToProgress(progress: number): LogicalSeekRequest | null {
    if (!this.syncMap) return null;
    const pos = resolvePositionFromProgress(this.syncMap, progress);
    return this.seekToPosition(pos);
  }

  public seekToTimeMs(timeMs: number): LogicalSeekRequest | null {
    if (!this.syncMap) return null;
    const pos = resolvePositionFromTime(this.syncMap, timeMs);
    return this.seekToPosition(pos);
  }

  public seekToSentence(sentenceIndex: number, wordIndex = 0): LogicalSeekRequest | null {
    if (!this.syncMap) return null;
    const pos = resolvePositionFromSentence(this.syncMap, sentenceIndex, wordIndex);
    return this.seekToPosition(pos);
  }

  public seekToWord(globalWordIndex: number): LogicalSeekRequest | null {
    if (!this.syncMap) return null;
    const pos = resolvePositionFromGlobalWord(this.syncMap, globalWordIndex);
    return this.seekToPosition(pos);
  }

  public seek(sentenceIndex: number, wordIndex = 0): LogicalSeekRequest | null {
    return this.seekToSentence(sentenceIndex, wordIndex);
  }

  public handleEnd(callbackSessionId?: number): void {
    if (callbackSessionId !== undefined && callbackSessionId !== this.sessionId) return;
    this.stop();
    this.onPlaybackEnd?.();
  }

  public stop(): void {
    this.sessionId++;
    this.isPlaying = false;
    this.isPaused = false;
    this.isSeeking = false;
    this.wasPlayingBeforeSeek = false;
    this.seekTarget = null;
    this.playbackStartCharOffset = 0;
    this.playbackStartWordIndex = 0;
    this.trackingSource = 'fallback';
    this.clearEstimationTicker();
    this.startTime = 0;
    this.pausedOffsetMs = 0;
    this.lastNativeBoundaryTime = 0;
    this.lastCharIndex = null;
    this.allowBackwardMovement = true;
    this.updateHighlight(null, null, 'native-boundary');
    this.allowBackwardMovement = false;
  }

  public getState(): HighlightState {
    return {
      highlightMode: this.highlightMode,
      activeSentenceIndex: this.activeSentenceIndex,
      activeWordIndex: this.highlightMode === 'word' ? this.activeWordIndex : null,
      trackingSource: this.trackingSource,
    };
  }

  public destroy(): void {
    this.stop();
    this.syncMap = null;
    this.currentLesson = null;
  }

  private updateHighlight(
    sentenceIdx: number | null,
    wordIdx: number | null,
    source: TrackingSource = 'native-boundary'
  ): void {
    // 1. Authoritative source precedence: if native boundary is active, reject fallback updates
    if (source === 'fallback' && this.trackingSource === 'native-boundary') {
      return;
    }

    // 2. Monotonic protection during normal playback
    if (!this.allowBackwardMovement && this.isPlaying && !this.isPaused) {
      if (this.activeSentenceIndex !== null && sentenceIdx !== null) {
        // Prevent backward sentence jump
        if (sentenceIdx < this.activeSentenceIndex) {
          return;
        }
        // Prevent backward word jump within the same sentence
        if (sentenceIdx === this.activeSentenceIndex && this.activeWordIndex !== null && wordIdx !== null) {
          if (wordIdx < this.activeWordIndex) {
            return;
          }
        }
      }
    }

    const sentenceChanged = this.activeSentenceIndex !== sentenceIdx;
    const wordChanged = this.activeWordIndex !== wordIdx;

    if (this.highlightMode === 'sentence') {
      // In sentence mode, internal word changes must NOT trigger state updates
      if (!sentenceChanged) {
        this.activeWordIndex = wordIdx;
        return;
      }
    } else {
      // In word mode, update if either sentence or word changed
      if (!sentenceChanged && !wordChanged) {
        return;
      }
    }

    this.activeSentenceIndex = sentenceIdx;
    this.activeWordIndex = wordIdx;
    this.notifyState();
  }

  private notifyState(): void {
    this.onHighlightChange({
      highlightMode: this.highlightMode,
      activeSentenceIndex: this.activeSentenceIndex,
      activeWordIndex: this.highlightMode === 'word' ? this.activeWordIndex : null,
      trackingSource: this.trackingSource,
    });
  }

  private startEstimationTicker(session: number): void {
    this.clearEstimationTicker();

    this.timerId = setInterval(() => {
      if (session !== this.sessionId || !this.isPlaying || this.isPaused || !this.syncMap) {
        this.clearEstimationTicker();
        return;
      }

      // If native boundary has taken over as authoritative tracking source, fallback is strictly muted
      if (this.trackingSource === 'native-boundary') {
        return;
      }

      const now = Date.now();
      const elapsedMs = this.pausedOffsetMs + (now - this.startTime);
      if (elapsedMs >= this.syncMap.totalEstimatedMs) {
        // Natural end of estimated duration
        this.handleEnd(session);
        return;
      }

      const mapped = mapTimeToSync(this.syncMap, elapsedMs);
      if (mapped.sentenceIndex >= 0) {
        this.updateHighlight(mapped.sentenceIndex, mapped.wordIndex, 'fallback');
      }
    }, 60);
  }

  private clearEstimationTicker(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}

/**
 * Returns lossless token spans for a given sentence in a lesson.
 */
export function getSentenceTokens(lesson: ListeningLesson | null, sentenceIndex: number): TokenSpan[] {
  const sent = lesson?.sentences?.[sentenceIndex];
  if (!sent || !sent.en) return [];
  return tokenizeSentence(sent.en);
}

/**
 * Calculates balanced chunk sizes of 2–3 items per group.
 * Prevents single trailing orphan items when total >= 2.
 */
export function calculateSafeChunkSizes(total: number): number[] {
  if (total <= 0) return [];
  if (total <= 3) return [total];

  const sizes: number[] = [];
  let rem = total;

  while (rem > 0) {
    if (rem === 4) {
      sizes.push(2, 2);
      rem -= 4;
    } else if (rem === 2) {
      sizes.push(2);
      rem -= 2;
    } else if (rem === 1) {
      if (sizes.length > 0) {
        const last = sizes.pop()!;
        if (last === 2) {
          sizes.push(3);
        } else {
          sizes.push(2, 2);
        }
      } else {
        sizes.push(1);
      }
      rem -= 1;
    } else {
      sizes.push(3);
      rem -= 3;
    }
  }

  return sizes;
}

/**
 * Segments a listening lesson into coherent, readable transcript blocks.
 * 
 * Grouping priority:
 * 1. Speaker turns: Consecutive sentences by the same speaker are grouped into a turn.
 * 2. Paragraph breaks in audioText: When no speaker metadata is present, if audioText
 *    contains double newlines (\n\n), sentences are grouped according to those paragraphs.
 * 3. Safe grouping fallback: If no speaker or paragraph breaks are present, sentences
 *    are grouped into natural, balanced blocks of 2–3 sentences.
 * 
 * Invariants:
 * - 100% text, order, and sentence fidelity preserved.
 * - Global sentence indices are strictly preserved.
 * - Does NOT invent fake speaker names when absent.
 */
export function buildTranscriptBlocks(lesson: ListeningLesson): TranscriptBlock[] {
  if (!lesson || !Array.isArray(lesson.sentences) || lesson.sentences.length === 0) {
    return [];
  }

  const sentences = lesson.sentences;
  const hasSpeaker = sentences.some(
    (s) => typeof s.speaker === 'string' && s.speaker.trim().length > 0
  );

  // 1. Group by speaker turns if speaker metadata exists
  if (hasSpeaker) {
    const blocks: TranscriptBlock[] = [];
    let currentBlock: TranscriptBlock | null = null;

    for (let i = 0; i < sentences.length; i++) {
      const sent = sentences[i];
      const speaker = sent.speaker?.trim() || undefined;

      if (currentBlock && currentBlock.speaker === speaker) {
        currentBlock.sentences.push({ sentence: sent, globalSentenceIndex: i });
        currentBlock.endSentenceIndex = i;
      } else {
        currentBlock = {
          id: `block-${blocks.length}-${speaker ? encodeURIComponent(speaker) : 'anon'}`,
          speaker,
          sentences: [{ sentence: sent, globalSentenceIndex: i }],
          startSentenceIndex: i,
          endSentenceIndex: i,
        };
        blocks.push(currentBlock);
      }
    }

    return blocks;
  }

  // 2. Monologue / Presentation: Check for paragraph breaks in audioText
  const audioText = lesson.audioText || '';
  const rawParagraphs = audioText
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (rawParagraphs.length > 1) {
    // Map sentences to audioText paragraphs
    const blocks: TranscriptBlock[] = [];
    let currentParaIdx = 0;
    let currentBlock: TranscriptBlock | null = null;

    for (let i = 0; i < sentences.length; i++) {
      const sent = sentences[i];
      const sentSnippet = sent.en.trim().slice(0, 30);

      // Check if this sentence starts in a later paragraph
      let matchedParaIdx = currentParaIdx;
      for (let p = currentParaIdx; p < rawParagraphs.length; p++) {
        if (rawParagraphs[p].includes(sentSnippet)) {
          matchedParaIdx = p;
          break;
        }
      }

      if (matchedParaIdx !== currentParaIdx || !currentBlock) {
        currentParaIdx = matchedParaIdx;
        currentBlock = {
          id: `block-${blocks.length}-para-${currentParaIdx}`,
          sentences: [{ sentence: sent, globalSentenceIndex: i }],
          startSentenceIndex: i,
          endSentenceIndex: i,
        };
        blocks.push(currentBlock);
      } else {
        currentBlock.sentences.push({ sentence: sent, globalSentenceIndex: i });
        currentBlock.endSentenceIndex = i;
      }
    }

    // Split any paragraph blocks that exceed 4 sentences using safe chunking
    const finalBlocks: TranscriptBlock[] = [];
    for (const b of blocks) {
      if (b.sentences.length <= 4) {
        finalBlocks.push({
          ...b,
          id: `block-${finalBlocks.length}`,
        });
      } else {
        const chunkSizes = calculateSafeChunkSizes(b.sentences.length);
        let offset = 0;
        for (const size of chunkSizes) {
          const chunkSents = b.sentences.slice(offset, offset + size);
          finalBlocks.push({
            id: `block-${finalBlocks.length}`,
            sentences: chunkSents,
            startSentenceIndex: chunkSents[0].globalSentenceIndex,
            endSentenceIndex: chunkSents[chunkSents.length - 1].globalSentenceIndex,
          });
          offset += size;
        }
      }
    }

    return finalBlocks;
  }

  // 3. Fallback: Safe grouping into 2–3 sentences per block
  const chunkSizes = calculateSafeChunkSizes(sentences.length);
  const blocks: TranscriptBlock[] = [];
  let sOffset = 0;

  for (const size of chunkSizes) {
    const chunkSents: TranscriptSegmentSentence[] = [];
    for (let i = 0; i < size; i++) {
      const idx = sOffset + i;
      chunkSents.push({
        sentence: sentences[idx],
        globalSentenceIndex: idx,
      });
    }

    blocks.push({
      id: `block-${blocks.length}`,
      sentences: chunkSents,
      startSentenceIndex: chunkSents[0].globalSentenceIndex,
      endSentenceIndex: chunkSents[chunkSents.length - 1].globalSentenceIndex,
    });

    sOffset += size;
  }

  return blocks;
}
