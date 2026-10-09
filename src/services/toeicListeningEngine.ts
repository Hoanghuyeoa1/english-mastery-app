// src/services/toeicListeningEngine.ts
import {
  NormalizedToeicListeningGroup,
  ListeningPlaybackPolicy,
  ToeicListeningEngineState,
  ToeicListeningEngineStatus,
  ToeicListeningStateListener,
  IToeicListeningEngine,
  ToeicListeningTranscriptSegment,
  DEFAULT_LISTENING_POLICIES,
} from '../types/toeicListening';
import { clampAudioVolume, findActiveAudioSegment } from './toeicAudioResolver';

/**
 * Factory for creating HTMLAudioElement, allowing easy mock injection in tests.
 */
export type AudioElementFactory = (src?: string) => HTMLAudioElement;

const defaultAudioFactory: AudioElementFactory = (src?: string) => {
  if (typeof window !== 'undefined' && typeof window.Audio !== 'undefined') {
    return new window.Audio(src);
  }
  if (typeof document !== 'undefined') {
    const el = document.createElement('audio');
    if (src) el.src = src;
    return el;
  }
  throw new Error('Audio element creation is not supported in this environment.');
};

/**
 * Global mutex reference to guarantee that at most ONE audio engine instance
 * or source is producing sound across the entire app at any time.
 */
let activeGlobalListeningEngine: ToeicListeningEngine | null = null;

/**
 * Global Set để giữ tham chiếu tới SpeechSynthesisUtterance,
 * ngăn chặn lỗi Garbage Collection trên Chrome / Safari.
 */
const activeListeningUtterances = new Set<SpeechSynthesisUtterance>();

/**
 * Helper trích xuất các bước đọc tuần tự cho Part 2 TTS (Prompt -> Pause -> A -> Pause -> B -> Pause -> C)
 */
export interface Part2SequenceStep {
  step: 'prompt' | 'option_a' | 'option_b' | 'option_c';
  text: string;
}

export function buildPart2TtsSequence(
  group: NormalizedToeicListeningGroup
): Part2SequenceStep[] {
  const steps: Part2SequenceStep[] = [];
  const fullScript = group.audioSource.audioScript || group.transcript.fullText || '';

  // 1. Thử bóc tách prompt và 3 options từ script theo mẫu chuẩn (A)... (B)... (C)...
  let match = fullScript.match(/(.*?)\s*\([Aa]\)\s*(.*?)\s*\([Bb]\)\s*(.*?)\s*\([Cc]\)\s*(.*)/s);
  if (!match) {
    match = fullScript.match(/(.*?)(?:\bA\.)\s*(.*?)(?:\bB\.)\s*(.*?)(?:\bC\.)\s*(.*)/s);
  }

  if (match) {
    const promptText = match[1].trim() || 'Question:';
    const optAText = match[2].trim();
    const optBText = match[3].trim();
    const optCText = match[4].trim();

    steps.push({ step: 'prompt', text: promptText });
    steps.push({ step: 'option_a', text: `(A) ${optAText}` });
    steps.push({ step: 'option_b', text: `(B) ${optBText}` });
    steps.push({ step: 'option_c', text: `(C) ${optCText}` });
    return steps;
  }

  // Fallback nếu không khớp regex: lấy từ group.questions[0].options nếu có
  const firstQ = group.questionIds.length > 0 ? (group as any).questions?.[0] : null;
  if (firstQ && Array.isArray(firstQ.options) && firstQ.options.length >= 3) {
    const prompt = firstQ.questionText || fullScript;
    steps.push({ step: 'prompt', text: prompt });
    steps.push({ step: 'option_a', text: `(A) ${firstQ.options[0]}` });
    steps.push({ step: 'option_b', text: `(B) ${firstQ.options[1]}` });
    steps.push({ step: 'option_c', text: `(C) ${firstQ.options[2]}` });
    return steps;
  }

  // Cuối cùng: fallback đọc nguyên văn bản
  steps.push({ step: 'prompt', text: fullScript });
  return steps;
}

/**
 * =============================================================================
 * SHARED TOEIC LISTENING ENGINE (PHASE 3)
 * =============================================================================
 * Engine quản lý vòng đời phát âm thanh độc lập, nhẹ và hướng Nhóm (Group Model).
 *
 * Các nguyên tắc kiến trúc:
 * 1. Zero Overlap: Tự động ngắt mọi nguồn âm thanh khác khi phát.
 * 2. Group Lifecycle Guard: Chỉ nạp lại khi groupId thay đổi, không reset khi đổi câu con.
 * 3. Behavioral Policy Enforcement: Từ chối seek, replay, pause tại tầng engine theo policy.
 * 4. Deterministic Part 2 Sequence: Hỗ trợ chuỗi phát Stem -> Pause -> A -> Pause -> B -> Pause -> C.
 * 5. Memory Safety: Dọn dẹp triệt để HTMLAudioElement và SpeechSynthesisUtterances.
 */
export class ToeicListeningEngine implements IToeicListeningEngine {
  private state: ToeicListeningEngineState;
  private listeners = new Set<ToeicListeningStateListener>();

  private currentGroup: NormalizedToeicListeningGroup | null = null;
  private currentPolicy: ListeningPlaybackPolicy = DEFAULT_LISTENING_POLICIES.practice;

  // Runtime elements
  private currentAudio: HTMLAudioElement | null = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private playRequestedWhileLoading = false;

  // Part 2 sequence controller
  private part2Steps: Part2SequenceStep[] = [];
  private part2CurrentStepIndex = -1;
  private part2StepTimer: any = null;

  // Native audio event listeners
  private boundOnLoadedMetadata: (() => void) | null = null;
  private boundOnCanPlay: (() => void) | null = null;
  private boundOnTimeUpdate: (() => void) | null = null;
  private boundOnEnded: (() => void) | null = null;
  private boundOnError: ((e: Event) => void) | null = null;
  private boundOnPause: (() => void) | null = null;
  private boundOnPlay: (() => void) | null = null;

  private audioFactory: AudioElementFactory;
  private lastTimeUpdateMs = 0;
  private playPromise: Promise<void> | null = null;

  constructor(options?: { audioFactory?: AudioElementFactory; initialVolume?: number }) {
    this.audioFactory = options?.audioFactory || defaultAudioFactory;
    const initialVol = clampAudioVolume(options?.initialVolume ?? 1.0, 1.0);

    this.state = {
      status: 'idle',
      currentGroupId: null,
      currentAudioGroupId: null,
      sourceType: 'none',
      audioUrl: null,
      currentTimeMs: 0,
      durationMs: 0,
      playbackRate: 1.0,
      volume: initialVol,
      isMuted: false,
      hasPlayed: false,
      playCount: 0,
      activeSegmentIndex: -1,
      activeSegment: null,
      isEligibleToPlay: true,
      errorMessage: undefined,
      part2SequenceStep: undefined,
    };
  }

  // ===========================================================================
  // SUBSCRIPTION & STATE EMISSION
  // ===========================================================================

  public subscribe(listener: ToeicListeningStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): Readonly<ToeicListeningEngineState> {
    return { ...this.state };
  }

  private updateState(partial: Partial<ToeicListeningEngineState>): void {
    this.state = { ...this.state, ...partial };
    const snapshot = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[ToeicListeningEngine] Listener error:', err);
      }
    });
  }

  // ===========================================================================
  // GROUP LIFECYCLE MANAGEMENT
  // ===========================================================================

  /**
   * Nạp nhóm bài nghe.
   * Group Lifecycle Guard: Chỉ khởi tạo lại khi groupId thay đổi.
   * Nếu cùng groupId (chuyển đổi giữa các câu hỏi con của Part 3/4), bảo toàn nguyên vẹn state.
   */
  public loadGroup(
    group: NormalizedToeicListeningGroup,
    policy?: ListeningPlaybackPolicy,
    initialPlayCount = 0
  ): void {
    this.currentPolicy = policy || this.currentPolicy;

    // GUARD: Nếu cùng nhóm đang được nạp, không reset engine
    if (
      this.currentGroup &&
      this.currentGroup.id === group.id &&
      this.state.currentGroupId === group.id &&
      this.state.currentAudioGroupId === group.audioGroupId
    ) {
      const nextPlayCount = Math.max(this.state.playCount, initialPlayCount);
      const eligible = this.currentPolicy.allowReplay || nextPlayCount < this.currentPolicy.maxPlayCount;
      const updates: Partial<ToeicListeningEngineState> = {};
      if (nextPlayCount !== this.state.playCount) {
        updates.playCount = nextPlayCount;
        updates.hasPlayed = nextPlayCount > 0;
      }
      if (this.state.isEligibleToPlay !== eligible) {
        updates.isEligibleToPlay = eligible;
      }
      if (Object.keys(updates).length > 0) {
        this.updateState(updates);
      }
      return;
    }

    // 1. Dừng triệt để toàn bộ playback của nhóm trước
    this.stopAllPlayback();
    this.teardownCurrentAudio();

    this.currentGroup = group;
    this.playRequestedWhileLoading = false;
    this.part2Steps = [];
    this.part2CurrentStepIndex = -1;

    const playCount = initialPlayCount;
    const hasPlayed = playCount > 0;
    const isEligible = this.currentPolicy.allowReplay || playCount < this.currentPolicy.maxPlayCount;

    // Chuẩn bị kịch bản chuỗi cho Part 2 nếu cần
    if (group.part === 'part2_qna' && group.audioSource.sourceType === 'tts') {
      this.part2Steps = buildPart2TtsSequence(group);
    }

    // =========================================================================
    // CASE A: RECORDED AUDIO (MP3 / CDN)
    // =========================================================================
    if (group.audioSource.sourceType === 'recorded' && group.audioSource.audioUrl) {
      this.updateState({
        status: 'loading',
        currentGroupId: group.id,
        currentAudioGroupId: group.audioGroupId,
        sourceType: 'recorded',
        audioUrl: group.audioSource.audioUrl,
        currentTimeMs: 0,
        durationMs: group.audioSource.durationMs || 0,
        playbackRate: this.state.playbackRate,
        hasPlayed,
        playCount,
        activeSegmentIndex: -1,
        activeSegment: null,
        isEligibleToPlay: isEligible,
        errorMessage: undefined,
        part2SequenceStep: undefined,
      });

      try {
        const audio = this.audioFactory(group.audioSource.audioUrl);
        this.currentAudio = audio;
        audio.preload = 'metadata';
        audio.playbackRate = this.state.playbackRate;
        audio.volume = this.state.isMuted ? 0 : this.state.volume;

        this.boundOnLoadedMetadata = () => {
          const durSec = audio.duration;
          const durMs =
            Number.isFinite(durSec) && durSec > 0
              ? Math.round(durSec * 1000)
              : group.audioSource.durationMs || 0;
          this.updateState({
            durationMs: durMs,
            status: this.state.status === 'loading' ? 'ready' : this.state.status,
          });
        };

        this.boundOnCanPlay = () => {
          if (this.state.status === 'loading') {
            this.updateState({ status: 'ready' });
          }
          if (this.playRequestedWhileLoading) {
            this.playRequestedWhileLoading = false;
            this.play();
          }
        };

        this.boundOnTimeUpdate = () => {
          const currentMs = Math.round((audio.currentTime || 0) * 1000);
          this.handleTimeUpdate(currentMs);
        };

        this.boundOnEnded = () => {
          this.handleEnded();
        };

        this.boundOnError = (e: Event) => {
          this.handleAudioError(e);
        };

        this.boundOnPause = () => {
          if (this.state.status === 'playing') {
            this.updateState({ status: 'paused' });
          }
        };

        this.boundOnPlay = () => {
          this.updateState({ status: 'playing' });
        };

        audio.addEventListener('loadedmetadata', this.boundOnLoadedMetadata);
        audio.addEventListener('canplay', this.boundOnCanPlay);
        audio.addEventListener('timeupdate', this.boundOnTimeUpdate);
        audio.addEventListener('ended', this.boundOnEnded);
        audio.addEventListener('error', this.boundOnError);
        audio.addEventListener('pause', this.boundOnPause);
        audio.addEventListener('play', this.boundOnPlay);
      } catch (err) {
        console.warn('[ToeicListeningEngine] Audio factory failed, falling back to TTS:', err);
        this.fallbackToTts(group);
      }
      return;
    }

    // =========================================================================
    // CASE B: TTS FALLBACK
    // =========================================================================
    if (group.audioSource.sourceType === 'tts' && group.audioSource.audioScript) {
      this.updateState({
        status: 'ready',
        currentGroupId: group.id,
        currentAudioGroupId: group.audioGroupId,
        sourceType: 'tts',
        audioUrl: null,
        currentTimeMs: 0,
        durationMs: group.audioSource.durationMs || 0,
        hasPlayed,
        playCount,
        activeSegmentIndex: -1,
        activeSegment: null,
        isEligibleToPlay: isEligible,
        errorMessage: undefined,
        part2SequenceStep: group.part === 'part2_qna' ? 'prompt' : undefined,
      });
      return;
    }

    // =========================================================================
    // CASE C: NONE
    // =========================================================================
    this.updateState({
      status: 'idle',
      currentGroupId: group.id,
      currentAudioGroupId: group.audioGroupId,
      sourceType: 'none',
      audioUrl: null,
      currentTimeMs: 0,
      durationMs: 0,
      hasPlayed,
      playCount,
      activeSegmentIndex: -1,
      activeSegment: null,
      isEligibleToPlay: false,
      errorMessage: 'Không tìm thấy nguồn âm thanh cho nhóm câu hỏi này.',
      part2SequenceStep: undefined,
    });
  }

  /**
   * Cập nhật Central Playback Policy (Mock vs Practice) linh hoạt theo runtime.
   * Ngăn chặn hoàn toàn việc rò rỉ highlight/transcript từ Practice sang Mock.
   */
  public setPolicy(policy: ListeningPlaybackPolicy): void {
    this.currentPolicy = policy;
    const eligible = policy.allowReplay || this.state.playCount < policy.maxPlayCount;
    const updates: Partial<ToeicListeningEngineState> = {
      isEligibleToPlay: eligible,
    };
    if (!policy.showHighlight && !policy.showTranscript) {
      updates.activeSegment = null;
      updates.activeSegmentIndex = -1;
    }
    this.updateState(updates);
  }

  // ===========================================================================
  // PLAYBACK CONTROL & POLICY ENFORCEMENT
  // ===========================================================================

  public async play(): Promise<void> {
    // POLICY CHECK: Kiểm tra quyền phát âm thanh
    if (!this.currentPolicy.allowReplay && this.state.playCount >= this.currentPolicy.maxPlayCount) {
      console.warn('[ToeicListeningEngine] Play rejected by Policy: Single replay limit reached.');
      return;
    }

    if (this.state.status === 'playing' || this.playPromise) {
      return; // Chống repeated Play tạo duplicate hoặc race condition
    }

    // THỰC THI MUTEX TOÀN CỤC: Ngắt mọi engine khác đang phát
    if (activeGlobalListeningEngine && activeGlobalListeningEngine !== this) {
      activeGlobalListeningEngine.stopAllPlayback();
    }
    activeGlobalListeningEngine = this;

    // Hủy mọi âm thanh speech cũ
    this.cancelTts();

    // Nếu đang tải audio recorded, đánh dấu sẽ phát ngay khi ready
    if (this.state.status === 'loading') {
      this.playRequestedWhileLoading = true;
      return;
    }

    // Tăng playCount nếu là lần phát mới (không phải tiếp tục sau pause)
    const isNewPlaySession = this.state.status === 'ready' || this.state.status === 'ended';
    const nextPlayCount = isNewPlaySession ? this.state.playCount + 1 : this.state.playCount;
    const isEligible = this.currentPolicy.allowReplay || nextPlayCount < this.currentPolicy.maxPlayCount;

    // -------------------------------------------------------------------------
    // 1. PHÁT RECORDED AUDIO
    // -------------------------------------------------------------------------
    if (this.state.sourceType === 'recorded' && this.currentAudio) {
      try {
        this.updateState({
          hasPlayed: true,
          playCount: nextPlayCount,
          isEligibleToPlay: isEligible,
        });
        this.playPromise = this.currentAudio.play();
        await this.playPromise;
        this.updateState({ status: 'playing' });
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          // Lệnh play bị hủy do gọi pause() hoặc stop() sớm, an toàn bỏ qua
          return;
        }
        console.warn('[ToeicListeningEngine] Recorded play error:', err);
        if (this.currentGroup && this.currentPolicy.mode === 'practice' && (this.currentGroup.audioSource.audioScript || this.currentGroup.transcript.fullText)) {
          this.fallbackToTts(this.currentGroup);
          this.play();
        } else {
          this.updateState({
            status: 'error',
            errorMessage: 'Không thể phát tệp âm thanh bài thi. Vui lòng kiểm tra kết nối mạng.',
          });
        }
      } finally {
        this.playPromise = null;
      }
      return;
    }

    // -------------------------------------------------------------------------
    // 2. PHÁT TTS (WEB SPEECH API)
    // -------------------------------------------------------------------------
    if (this.state.sourceType === 'tts') {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        this.updateState({
          status: 'error',
          errorMessage: 'Trình duyệt không hỗ trợ Web Speech API.',
        });
        return;
      }

      this.updateState({
        hasPlayed: true,
        playCount: nextPlayCount,
        isEligibleToPlay: isEligible,
        status: 'playing',
      });

      // Nếu là Part 2 và có cấu trúc sequence bước:
      if (this.currentGroup?.part === 'part2_qna' && this.part2Steps.length > 0) {
        this.playPart2Step(0);
        return;
      }

      // Phát văn bản thông thường
      const textToSpeak =
        this.currentGroup?.audioSource.audioScript ||
        this.currentGroup?.transcript.fullText ||
        '';

      this.speakText(textToSpeak, () => {
        this.handleEnded();
      });
    }
  }

  /**
   * Tạm dừng phát âm thanh
   * POLICY ENFORCEMENT: Nếu allowPause === false (như bài thi Mock chuẩn ETS), lệnh bị từ chối.
   */
  public pause(): void {
    if (!this.currentPolicy.allowPause) {
      console.warn('[ToeicListeningEngine] Pause rejected by Policy: Pausing is disabled in strict mode.');
      return;
    }

    if (this.state.status !== 'playing') return;

    if (this.state.sourceType === 'recorded' && this.currentAudio) {
      try {
        this.currentAudio.pause();
      } catch {}
      this.updateState({ status: 'paused' });
      return;
    }

    if (this.state.sourceType === 'tts') {
      this.cancelTts();
      if (this.part2StepTimer) {
        clearTimeout(this.part2StepTimer);
        this.part2StepTimer = null;
      }
      this.updateState({ status: 'paused' });
    }
  }

  public togglePlay(): void {
    if (this.state.status === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Tua thời gian bài nghe
   * POLICY ENFORCEMENT: Nếu allowSeek === false, lệnh bị từ chối hoàn toàn.
   */
  public seek(timeMs: number): void {
    if (!this.currentPolicy.allowSeek) {
      console.warn('[ToeicListeningEngine] Seek rejected by Policy: Seeking is disabled in this mode.');
      return;
    }

    const clampedMs = Math.max(0, Math.min(this.state.durationMs || Infinity, timeMs));

    if (this.state.sourceType === 'recorded' && this.currentAudio) {
      try {
        this.currentAudio.currentTime = clampedMs / 1000;
      } catch {}
      this.handleTimeUpdate(clampedMs);
    } else {
      this.updateState({ currentTimeMs: clampedMs });
    }
  }

  /**
   * Nghe lại từ đầu (0ms)
   * POLICY ENFORCEMENT: Nếu allowReplay === false, lệnh bị từ chối.
   */
  public restart(): void {
    if (!this.currentPolicy.allowReplay) {
      console.warn('[ToeicListeningEngine] Restart rejected by Policy: Replay is disabled in this mode.');
      return;
    }

    this.seek(0);
    this.play();
  }

  /**
   * Dừng hẳn bài nghe và đưa về đầu
   */
  public stop(): void {
    this.stopAllPlayback();
    this.updateState({
      status: this.state.sourceType !== 'none' ? 'ready' : 'idle',
      currentTimeMs: 0,
      activeSegmentIndex: -1,
      activeSegment: null,
      part2SequenceStep: this.currentGroup?.part === 'part2_qna' ? 'prompt' : undefined,
    });
  }

  /**
   * Thay đổi tốc độ phát
   * POLICY ENFORCEMENT: Nếu allowSpeedControl === false, lệnh bị từ chối.
   */
  public setPlaybackRate(rate: number): void {
    if (!this.currentPolicy.allowSpeedControl) {
      console.warn('[ToeicListeningEngine] Speed change rejected by Policy.');
      return;
    }

    const clamped = Math.max(0.5, Math.min(2.0, rate));
    if (this.currentAudio) {
      this.currentAudio.playbackRate = clamped;
    }
    this.updateState({ playbackRate: clamped });
  }

  public setVolume(vol: number): void {
    const clamped = clampAudioVolume(vol, 1.0);
    if (this.currentAudio) {
      this.currentAudio.volume = this.state.isMuted ? 0 : clamped;
    }
    this.updateState({ volume: clamped });
  }

  public toggleMute(): void {
    const nextMuted = !this.state.isMuted;
    if (this.currentAudio) {
      this.currentAudio.volume = nextMuted ? 0 : this.state.volume;
    }
    this.updateState({ isMuted: nextMuted });
  }

  // ===========================================================================
  // PART 2 DETERMINISTIC SEQUENCE CONTROLLER
  // ===========================================================================

  /**
   * Chạy bước trong chuỗi Part 2: Prompt -> Pause 600ms -> A -> Pause 600ms -> B -> Pause 600ms -> C -> End
   */
  private playPart2Step(stepIndex: number): void {
    if (stepIndex >= this.part2Steps.length) {
      this.updateState({ part2SequenceStep: 'completed' });
      this.handleEnded();
      return;
    }

    this.part2CurrentStepIndex = stepIndex;
    const currentStep = this.part2Steps[stepIndex];
    this.updateState({ part2SequenceStep: currentStep.step });

    this.speakText(currentStep.text, () => {
      // Khi đọc xong 1 bước, tạm dừng 600ms trước khi đọc phương án tiếp theo
      this.part2StepTimer = setTimeout(() => {
        this.playPart2Step(stepIndex + 1);
      }, 600);
    });
  }

  // ===========================================================================
  // SPEECH SYNTHESIS HELPER (REUSE STANDARD)
  // ===========================================================================

  private speakText(text: string, onEndCallback: () => void): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onEndCallback();
      return;
    }

    this.cancelTts();

    const utterance = new SpeechSynthesisUtterance(text);
    const accent = this.currentGroup?.audioSource.accent || 'en-US';
    utterance.lang = accent;
    utterance.rate = this.state.playbackRate;
    utterance.volume = this.state.isMuted ? 0 : this.state.volume;

    // Tìm giọng chuẩn nếu có
    try {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const selected = voices.find(
          (v) =>
            v.lang.includes(accent.replace('-', '_')) ||
            v.lang.includes(accent)
        );
        if (selected) utterance.voice = selected;
      }
    } catch {}

    // Lưu tham chiếu chống Garbage Collection
    activeListeningUtterances.add(utterance);

    utterance.onend = () => {
      activeListeningUtterances.delete(utterance);
      if (this.activeUtterance === utterance) {
        this.activeUtterance = null;
      }
      onEndCallback();
    };

    utterance.onerror = (e: any) => {
      activeListeningUtterances.delete(utterance);
      if (this.activeUtterance === utterance) {
        this.activeUtterance = null;
      }
      if (e?.error === 'canceled' || e?.error === 'interrupted') return;
      this.updateState({
        status: 'error',
        errorMessage: e?.error || 'Lỗi phát âm TTS.',
      });
    };

    this.activeUtterance = utterance;
    try {
      window.speechSynthesis.speak(utterance);
    } catch (err: any) {
      activeListeningUtterances.delete(utterance);
      this.activeUtterance = null;
      this.updateState({
        status: 'error',
        errorMessage: err?.message || 'Lỗi gọi Web Speech API.',
      });
    }
  }

  // ===========================================================================
  // TIMING & TRANSCRIPT SYNCHRONIZATION
  // ===========================================================================

  /**
   * Cập nhật thời gian và tính toán active transcript segment.
   * POLICY ENFORCEMENT & PERFORMANCE OPTIMIZATION:
   * 1. Validate finite và >= 0 ms.
   * 2. Nếu ở Mock Exam (cấm highlight, transcript và seek), cập nhật nội bộ mà không
   *    kích hoạt React re-render qua updateState mỗi 200ms -> Tiết kiệm 100% render CPU.
   * 3. Trong Practice, throttle tối đa 200ms giữa các lần update để bảo vệ hiệu năng.
   */
  private handleTimeUpdate(currentTimeMs: number): void {
    if (!Number.isFinite(currentTimeMs) || currentTimeMs < 0) {
      return;
    }

    // Throttle tối đa 200ms giữa các lần update để bảo vệ hiệu năng React render
    if (Math.abs(currentTimeMs - this.lastTimeUpdateMs) < 200) {
      return;
    }
    this.lastTimeUpdateMs = currentTimeMs;

    const canShowHighlight = Boolean(this.currentPolicy.showHighlight ?? this.currentPolicy.allowHighlight);
    const canShowTranscript = Boolean(this.currentPolicy.showTranscript ?? this.currentPolicy.allowTranscript);
    const canSeek = Boolean(this.currentPolicy.allowSeek);

    // MOCK EXAM / STRICT MODE PERFORMANCE OPTIMIZATION:
    // Cập nhật giá trị vào state trực tiếp mà KHÔNG kích hoạt updateState()
    // để loại bỏ hoàn toàn hiện tượng re-render liên tục root component.
    if (!canShowHighlight && !canShowTranscript && !canSeek) {
      this.state.currentTimeMs = currentTimeMs;
      return;
    }

    // POLICY GUARD: Không tính toán segment nếu policy cấm transcript & highlight
    if (!canShowHighlight && !canShowTranscript) {
      this.updateState({ currentTimeMs, activeSegmentIndex: -1, activeSegment: null });
      return;
    }

    const segments = this.currentGroup?.transcript.segments;
    const { segment, segmentIndex } = findActiveAudioSegment(segments as any, currentTimeMs);

    if (this.state.activeSegmentIndex !== segmentIndex) {
      this.updateState({
        currentTimeMs,
        activeSegmentIndex: segmentIndex,
        activeSegment: (segment as ToeicListeningTranscriptSegment) || null,
      });
    } else {
      this.updateState({ currentTimeMs });
    }
  }

  private handleEnded(): void {
    this.updateState({
      status: 'ended',
      activeSegmentIndex: -1,
      activeSegment: null,
    });
  }

  private handleAudioError(e: Event): void {
    console.warn('[ToeicListeningEngine] Native Audio error event:', e);
    // Nếu trong Practice mode và có kịch bản script, tự động fallback TTS
    if (
      this.currentGroup &&
      this.currentPolicy.mode === 'practice' &&
      (this.currentGroup.audioSource.audioScript || this.currentGroup.transcript?.fullText)
    ) {
      this.fallbackToTts(this.currentGroup);
    } else {
      this.updateState({
        status: 'error',
        errorMessage: 'Không thể tải file âm thanh. Vui lòng kiểm tra kết nối mạng.',
      });
    }
  }

  private fallbackToTts(group: NormalizedToeicListeningGroup): void {
    this.teardownCurrentAudio();
    this.updateState({
      status: 'ready',
      sourceType: 'tts',
      audioUrl: null,
      errorMessage: undefined,
    });
  }

  // ===========================================================================
  // CLEANUP & DISPOSAL
  // ===========================================================================

  private stopAllPlayback(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
    }
    this.cancelTts();
    if (this.part2StepTimer) {
      clearTimeout(this.part2StepTimer);
      this.part2StepTimer = null;
    }
    if (this.state.status === 'playing') {
      this.updateState({ status: 'paused' });
    }
  }

  private cancelTts(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.activeUtterance = null;
    activeListeningUtterances.clear();
  }

  private teardownCurrentAudio(): void {
    if (this.currentAudio) {
      if (this.boundOnLoadedMetadata) this.currentAudio.removeEventListener('loadedmetadata', this.boundOnLoadedMetadata);
      if (this.boundOnCanPlay) this.currentAudio.removeEventListener('canplay', this.boundOnCanPlay);
      if (this.boundOnTimeUpdate) this.currentAudio.removeEventListener('timeupdate', this.boundOnTimeUpdate);
      if (this.boundOnEnded) this.currentAudio.removeEventListener('ended', this.boundOnEnded);
      if (this.boundOnError) this.currentAudio.removeEventListener('error', this.boundOnError);
      if (this.boundOnPause) this.currentAudio.removeEventListener('pause', this.boundOnPause);
      if (this.boundOnPlay) this.currentAudio.removeEventListener('play', this.boundOnPlay);

      try {
        this.currentAudio.pause();
        this.currentAudio.src = '';
        this.currentAudio.load();
      } catch {}
      this.currentAudio = null;
    }
  }

  public dispose(): void {
    if (activeGlobalListeningEngine === this) {
      activeGlobalListeningEngine = null;
    }
    this.stopAllPlayback();
    this.teardownCurrentAudio();
    this.listeners.clear();
  }
}
