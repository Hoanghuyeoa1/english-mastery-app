// src/services/toeicAudioEngine.ts
import {
  ToeicAudioTimingSegment,
  ToeicAudioTokenTiming,
  ToeicAudioAccent,
  ToeicQuestion,
  ToeicQuestionGroup,
} from '../types/toeic';
import {
  resolveToeicAudioSource,
  findActiveAudioSegment,
  clampAudioVolume,
  ResolveToeicAudioInput,
  ResolveToeicAudioOptions,
  ResolvedToeicAudioSource,
} from './toeicAudioResolver';

/**
 * =============================================================================
 * TOEIC AUDIO ENGINE TYPES & CONTRACTS (PHASE 2)
 * =============================================================================
 */

export type ToeicAudioStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export interface ToeicAudioEngineState {
  status: ToeicAudioStatus;
  sourceType: 'mp3' | 'tts' | 'none';
  audioUrl: string | null;
  textToSpeak: string | null;
  accent: ToeicAudioAccent;
  playbackRate: number;
  currentTimeMs: number;
  durationMs: number;
  volume: number;
  isMuted: boolean;
  hasValidTiming: boolean;
  timingSegments: ToeicAudioTimingSegment[];
  activeSegmentIndex: number;
  activeSegment: ToeicAudioTimingSegment | null;
  activeToken: ToeicAudioTokenTiming | null;
  hasPlaybackStarted: boolean;
  fallbackOccurred: boolean;
  fallbackReason?: string;
  errorMessage?: string;
  isInheritedFromGroup: boolean;
}

export type ToeicAudioStateListener = (state: ToeicAudioEngineState) => void;

/**
 * Global mutex reference to guarantee that at most ONE audio engine instance
 * or source is producing sound at any time across the entire app.
 */
let activeGlobalEngine: ToeicAudioEngine | null = null;

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
 * =============================================================================
 * TOEIC AUDIO ENGINE (PHASE 2)
 * =============================================================================
 */
export class ToeicAudioEngine {
  private state: ToeicAudioEngineState;
  private listeners = new Set<ToeicAudioStateListener>();

  private currentAudio: HTMLAudioElement | null = null;
  private ambientAudio: HTMLAudioElement | null = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;

  private timingSegments: ToeicAudioTimingSegment[] = [];
  private currentInput: ResolveToeicAudioInput | null = null;
  private resolvedSource: ResolvedToeicAudioSource | null = null;
  private playRequestedWhileLoading = false;

  private boundOnLoadedMetadata: (() => void) | null = null;
  private boundOnCanPlay: (() => void) | null = null;
  private boundOnTimeUpdate: (() => void) | null = null;
  private boundOnEnded: (() => void) | null = null;
  private boundOnError: ((e: Event) => void) | null = null;
  private boundOnPause: (() => void) | null = null;
  private boundOnPlay: (() => void) | null = null;

  private audioFactory: AudioElementFactory;

  constructor(options?: { audioFactory?: AudioElementFactory; initialVolume?: number }) {
    this.audioFactory = options?.audioFactory || defaultAudioFactory;
    const initialVol = clampAudioVolume(options?.initialVolume ?? 1.0, 1.0);

    this.state = {
      status: 'idle',
      sourceType: 'none',
      audioUrl: null,
      textToSpeak: null,
      accent: 'en-US',
      playbackRate: 1.0,
      currentTimeMs: 0,
      durationMs: 0,
      volume: initialVol,
      isMuted: false,
      hasValidTiming: false,
      timingSegments: [],
      activeSegmentIndex: -1,
      activeSegment: null,
      activeToken: null,
      hasPlaybackStarted: false,
      fallbackOccurred: false,
      isInheritedFromGroup: false,
    };
  }

  /**
   * Đăng ký lắng nghe thay đổi trạng thái engine.
   * Trả về hàm hủy đăng ký (unsubscribe).
   */
  public subscribe(listener: ToeicAudioStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Lấy snapshot trạng thái hiện tại của engine
   */
  public getState(): Readonly<ToeicAudioEngineState> {
    return { ...this.state };
  }

  /**
   * Cập nhật partial state và thông báo tới tất cả subscribers
   */
  private updateState(partial: Partial<ToeicAudioEngineState>): void {
    this.state = { ...this.state, ...partial };
    const snapshot = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[ToeicAudioEngine] Error in state listener:', err);
      }
    });
  }

  /**
   * Tải nguồn âm thanh cho câu hỏi hoặc nhóm câu hỏi
   */
  public load(
    input: ToeicQuestion | ToeicQuestionGroup | ResolveToeicAudioInput,
    parentGroupOrOptions?: ToeicQuestionGroup | ResolveToeicAudioOptions | null,
    maybeOptions?: ResolveToeicAudioOptions
  ): void {
    // 1. Dừng triệt để mọi âm thanh cũ (MP3 + TTS + Ambient)
    this.stopAllPlayback();

    // 2. Dọn dẹp audio element và listeners cũ
    this.teardownCurrentAudio();
    this.teardownAmbientAudio();

    // 3. Phân giải nguồn audio qua Audio Source Resolver (Phase 1)
    const resolved = resolveToeicAudioSource(input, parentGroupOrOptions, maybeOptions);
    this.resolvedSource = resolved;
    this.currentInput = (input && 'part' in input) ? (input as any) : input;
    this.playRequestedWhileLoading = false;
    this.timingSegments = resolved.timingSegments || [];

    // =========================================================================
    // NGUỒN MP3
    // =========================================================================
    if (resolved.sourceType === 'mp3' && resolved.audioUrl) {
      this.updateState({
        status: 'loading',
        sourceType: 'mp3',
        audioUrl: resolved.audioUrl,
        textToSpeak: null,
        accent: resolved.accent,
        playbackRate: resolved.rate,
        currentTimeMs: 0,
        durationMs: resolved.durationMs || 0,
        hasValidTiming: resolved.hasValidTiming,
        timingSegments: this.timingSegments,
        activeSegmentIndex: -1,
        activeSegment: null,
        activeToken: null,
        hasPlaybackStarted: false,
        fallbackOccurred: false,
        fallbackReason: undefined,
        errorMessage: undefined,
        isInheritedFromGroup: Boolean(resolved.isInheritedFromGroup),
      });

      try {
        const audio = this.audioFactory(resolved.audioUrl);
        this.currentAudio = audio;

        // Cấu hình tải dữ liệu an toàn (không preload ồ ạt cả bank)
        audio.preload = 'metadata';
        audio.playbackRate = resolved.rate;
        audio.volume = this.state.isMuted ? 0 : this.state.volume;

        // Đính kèm các native event listeners
        this.boundOnLoadedMetadata = () => {
          const durSec = audio.duration;
          const durMs =
            Number.isFinite(durSec) && durSec > 0
              ? Math.round(durSec * 1000)
              : resolved.durationMs || 0;
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
          this.handleMp3Error(e);
        };

        this.boundOnPause = () => {
          if (this.state.status === 'playing') {
            this.updateState({ status: 'paused' });
            this.ambientAudio?.pause();
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

        // Khởi tạo Ambient Audio nếu được cấu hình
        if (resolved.ambientConfig?.enabled && resolved.ambientConfig.url) {
          try {
            const ambient = this.audioFactory(resolved.ambientConfig.url);
            ambient.loop = true;
            ambient.volume = clampAudioVolume(resolved.ambientConfig.volume ?? 0.15, 0.15);
            // Ambient failure không bao giờ làm crash hoặc block main audio
            ambient.addEventListener('error', () => {
              console.warn('[ToeicAudioEngine] Ambient track failed to load, ignored safely.');
            });
            this.ambientAudio = ambient;
          } catch {
            // Safe ignore
          }
        }
      } catch (err) {
        console.warn('[ToeicAudioEngine] Failed to instantiate audio element:', err);
        this.handleMp3Error(err as any);
      }
      return;
    }

    // =========================================================================
    // NGUỒN TTS (FALLBACK HOẶC LEGACY)
    // =========================================================================
    if (resolved.sourceType === 'tts' && resolved.textToSpeak) {
      this.updateState({
        status: 'ready',
        sourceType: 'tts',
        audioUrl: null,
        textToSpeak: resolved.textToSpeak,
        accent: resolved.accent,
        playbackRate: resolved.rate,
        currentTimeMs: 0,
        durationMs: 0,
        hasValidTiming: false,
        timingSegments: [],
        activeSegmentIndex: -1,
        activeSegment: null,
        activeToken: null,
        hasPlaybackStarted: false,
        fallbackOccurred: Boolean(resolved.fallbackReason?.includes('FALLBACK')),
        fallbackReason: resolved.fallbackReason,
        errorMessage: undefined,
        isInheritedFromGroup: Boolean(resolved.isInheritedFromGroup),
      });
      return;
    }

    // =========================================================================
    // NGUỒN RỖNG (NONE)
    // =========================================================================
    this.updateState({
      status: 'idle',
      sourceType: 'none',
      audioUrl: null,
      textToSpeak: null,
      accent: resolved.accent,
      playbackRate: 1.0,
      currentTimeMs: 0,
      durationMs: 0,
      hasValidTiming: false,
      timingSegments: [],
      activeSegmentIndex: -1,
      activeSegment: null,
      activeToken: null,
      hasPlaybackStarted: false,
      fallbackOccurred: false,
      fallbackReason: resolved.fallbackReason,
      errorMessage: resolved.fallbackReason,
      isInheritedFromGroup: false,
    });
  }

  /**
   * Bắt đầu hoặc tiếp tục phát âm thanh
   */
  public async play(): Promise<void> {
    // Thực thi Mutex toàn cục: chỉ cho phép 1 engine/source hoạt động tại một thời điểm
    if (activeGlobalEngine && activeGlobalEngine !== this) {
      activeGlobalEngine.pause();
    }
    activeGlobalEngine = this;

    // Ngắt TTS hiện tại trước khi MP3 chạy
    this.cancelTts();

    // Nếu đang loading MP3, lưu lại ý định người dùng muốn phát khi ready
    if (this.state.status === 'loading') {
      this.playRequestedWhileLoading = true;
      return;
    }

    // -----------------------------------------------------------------------
    // PHÁT MP3
    // -----------------------------------------------------------------------
    if (this.state.sourceType === 'mp3' && this.currentAudio) {
      try {
        this.updateState({ hasPlaybackStarted: true });

        // Chạy ambient song song nếu có
        if (this.ambientAudio) {
          this.ambientAudio.play().catch(() => {
            // Bỏ qua lỗi ambient autoplay / policy
          });
        }

        await this.currentAudio.play();
        this.updateState({ status: 'playing' });
      } catch (err: any) {
        // Nếu lỗi xảy ra khi play() trước khi playback thực sự bắt đầu
        if (!this.state.hasPlaybackStarted || (this.currentAudio?.currentTime || 0) === 0) {
          console.warn('[ToeicAudioEngine] MP3 play failed before playback started:', err);
          this.handleMp3Error(err);
        } else {
          this.updateState({
            status: 'error',
            errorMessage: err?.message || 'Lỗi khi phát tệp âm thanh.',
          });
        }
      }
      return;
    }

    // -----------------------------------------------------------------------
    // PHÁT TTS (Web Speech API)
    // -----------------------------------------------------------------------
    if (this.state.sourceType === 'tts' && this.state.textToSpeak) {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        this.updateState({
          status: 'error',
          errorMessage: 'Trình duyệt không hỗ trợ Web Speech API.',
        });
        return;
      }

      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }

      this.updateState({ status: 'playing', hasPlaybackStarted: true });

      const utterance = new SpeechSynthesisUtterance(this.state.textToSpeak);
      utterance.lang = this.state.accent;
      utterance.rate = this.state.playbackRate;
      utterance.volume = this.state.isMuted ? 0 : this.state.volume;

      // Tìm giọng đọc chuẩn
      try {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const selected = voices.find(
            (v) =>
              v.lang.includes(this.state.accent.replace('-', '_')) ||
              v.lang.includes(this.state.accent)
          );
          if (selected) utterance.voice = selected;
        }
      } catch {
        // ignore
      }

      utterance.onstart = () => {
        this.updateState({ status: 'playing' });
      };

      utterance.onend = () => {
        this.activeUtterance = null;
        this.handleEnded();
      };

      utterance.onerror = (e: any) => {
        // Nếu bị cancel chủ động bởi người dùng hoặc chuyển câu, không coi là fatal error
        if (e?.error === 'canceled' || e?.error === 'interrupted') {
          return;
        }
        this.activeUtterance = null;
        this.updateState({
          status: 'error',
          errorMessage: e?.error || 'Lỗi đọc phát âm TTS.',
        });
      };

      this.activeUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    }
  }

  /**
   * Tạm dừng phát âm thanh
   */
  public pause(): void {
    if (this.state.sourceType === 'mp3' && this.currentAudio) {
      try {
        this.currentAudio.pause();
      } catch {
        // ignore
      }
      try {
        this.ambientAudio?.pause();
      } catch {
        // ignore
      }
      this.updateState({ status: 'paused' });
      return;
    }

    if (this.state.sourceType === 'tts') {
      this.cancelTts();
      this.updateState({ status: 'paused' });
    }
  }

  /**
   * Chuyển đổi giữa Phát và Tạm dừng
   */
  public togglePlay(): void {
    if (this.state.status === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Dừng hẳn âm thanh và đưa về đầu
   */
  public stop(): void {
    this.stopAllPlayback();
    this.updateState({
      status: this.state.sourceType !== 'none' ? 'ready' : 'idle',
      currentTimeMs: 0,
      activeSegmentIndex: -1,
      activeSegment: null,
      activeToken: null,
    });
  }

  /**
   * Phát lại từ đầu (0ms)
   */
  public restart(): void {
    this.seek(0);
    this.play();
  }

  /**
   * Tua đến thời điểm xác định (mili-giây)
   */
  public seek(timeMs: number): void {
    const clampedMs = Math.max(0, Math.min(this.state.durationMs || Infinity, timeMs));

    if (this.state.sourceType === 'mp3' && this.currentAudio) {
      try {
        this.currentAudio.currentTime = clampedMs / 1000;
      } catch {
        // ignore
      }
      this.handleTimeUpdate(clampedMs);
    } else {
      this.updateState({ currentTimeMs: clampedMs });
    }
  }

  /**
   * Điều chỉnh âm lượng [0.0, 1.0]
   */
  public setVolume(vol: number): void {
    const clamped = clampAudioVolume(vol, 1.0);
    if (this.currentAudio) {
      this.currentAudio.volume = this.state.isMuted ? 0 : clamped;
    }
    this.updateState({ volume: clamped });
  }

  /**
   * Bật / tắt tắt tiếng (Mute)
   */
  public toggleMute(): void {
    const nextMuted = !this.state.isMuted;
    if (this.currentAudio) {
      this.currentAudio.volume = nextMuted ? 0 : this.state.volume;
    }
    this.updateState({ isMuted: nextMuted });
  }

  /**
   * Cập nhật tốc độ phát âm thanh (0.5x - 2.0x)
   */
  public setPlaybackRate(rate: number): void {
    const clamped = Math.max(0.5, Math.min(2.0, rate));
    if (this.currentAudio) {
      this.currentAudio.playbackRate = clamped;
    }
    this.updateState({ playbackRate: clamped });
  }

  /**
   * Xử lý đồng bộ hóa Transcript & Token theo thời gian phát hiện tại
   */
  private handleTimeUpdate(currentTimeMs: number): void {
    if (!this.state.hasValidTiming || this.timingSegments.length === 0) {
      this.updateState({ currentTimeMs });
      return;
    }

    const { segment, segmentIndex, activeToken } = findActiveAudioSegment(
      this.timingSegments,
      currentTimeMs
    );

    // Chỉ trigger update nếu vị trí segment/token thay đổi hoặc độ chênh lệch thời gian >= 250ms
    const segmentChanged = this.state.activeSegmentIndex !== segmentIndex;
    const tokenChanged = this.state.activeToken !== activeToken;
    const timeDeltaSignificant = Math.abs(this.state.currentTimeMs - currentTimeMs) >= 250;

    if (segmentChanged || tokenChanged || timeDeltaSignificant) {
      this.updateState({
        currentTimeMs,
        activeSegmentIndex: segmentIndex,
        activeSegment: segment,
        activeToken,
      });
    }
  }

  /**
   * Xử lý sự kiện kết thúc bài nghe
   */
  private handleEnded(): void {
    try {
      this.ambientAudio?.pause();
    } catch {
      // ignore
    }
    this.updateState({
      status: 'ended',
      activeSegmentIndex: -1,
      activeSegment: null,
      activeToken: null,
    });
  }

  /**
   * Xử lý lỗi MP3 với Graceful Fallback sang TTS
   */
  private handleMp3Error(err: any): void {
    // -----------------------------------------------------------------------
    // CASE A: MP3 lỗi TRƯỚC KHI playback thực sự bắt đầu
    // -> Fallback an toàn sang TTS Web Speech API
    // -----------------------------------------------------------------------
    if (!this.state.hasPlaybackStarted) {
      const fallbackScript =
        this.resolvedSource?.textToSpeak ||
        this.currentInput?.audioScript ||
        this.currentInput?.questionText;

      if (fallbackScript && fallbackScript.trim().length > 0) {
        this.teardownCurrentAudio();
        this.teardownAmbientAudio();

        this.updateState({
          status: 'ready',
          sourceType: 'tts',
          audioUrl: null,
          textToSpeak: fallbackScript.trim(),
          fallbackOccurred: true,
          fallbackReason: 'MP3_LOAD_FAILURE_FALLBACK_TTS',
          hasValidTiming: false,
          timingSegments: [],
          activeSegmentIndex: -1,
          activeSegment: null,
          activeToken: null,
          errorMessage: undefined,
        });

        // Nếu người dùng đã bấm play trong lúc load, tự động kích hoạt TTS ngay
        if (this.playRequestedWhileLoading) {
          this.playRequestedWhileLoading = false;
          this.play();
        }
        return;
      }
    }

    // -----------------------------------------------------------------------
    // CASE B: MP3 lỗi SAU KHI đã phát một phần
    // -> Dừng an toàn, KHÔNG đọc lại từ đầu bằng TTS, giữ nguyên state bài thi
    // -----------------------------------------------------------------------
    this.teardownAmbientAudio();
    this.updateState({
      status: 'error',
      errorMessage: err?.message || 'Quá trình phát audio MP3 gặp lỗi và đã dừng an toàn.',
    });
  }

  /**
   * Dừng triệt để tất cả nguồn âm thanh đang chạy
   */
  private stopAllPlayback(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {
        // ignore
      }
    }

    if (this.ambientAudio) {
      try {
        this.ambientAudio.pause();
        this.ambientAudio.currentTime = 0;
      } catch {
        // ignore
      }
    }

    this.cancelTts();
  }

  /**
   * Hủy bỏ SpeechSynthesisUtterance đang đọc
   */
  private cancelTts(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    this.activeUtterance = null;
  }

  /**
   * Gỡ bỏ các event listeners và tham chiếu của currentAudio
   */
  private teardownCurrentAudio(): void {
    if (this.currentAudio) {
      if (this.boundOnLoadedMetadata) {
        this.currentAudio.removeEventListener('loadedmetadata', this.boundOnLoadedMetadata);
      }
      if (this.boundOnCanPlay) {
        this.currentAudio.removeEventListener('canplay', this.boundOnCanPlay);
      }
      if (this.boundOnTimeUpdate) {
        this.currentAudio.removeEventListener('timeupdate', this.boundOnTimeUpdate);
      }
      if (this.boundOnEnded) {
        this.currentAudio.removeEventListener('ended', this.boundOnEnded);
      }
      if (this.boundOnError) {
        this.currentAudio.removeEventListener('error', this.boundOnError);
      }
      if (this.boundOnPause) {
        this.currentAudio.removeEventListener('pause', this.boundOnPause);
      }
      if (this.boundOnPlay) {
        this.currentAudio.removeEventListener('play', this.boundOnPlay);
      }

      try {
        this.currentAudio.pause();
        this.currentAudio.src = '';
        this.currentAudio.load();
      } catch {
        // ignore
      }
      this.currentAudio = null;
    }
  }

  /**
   * Gỡ bỏ Ambient Audio
   */
  private teardownAmbientAudio(): void {
    if (this.ambientAudio) {
      try {
        this.ambientAudio.pause();
        this.ambientAudio.src = '';
      } catch {
        // ignore
      }
      this.ambientAudio = null;
    }
  }

  /**
   * Giải phóng hoàn toàn engine khi component unmount
   */
  public dispose(): void {
    if (activeGlobalEngine === this) {
      activeGlobalEngine = null;
    }
    this.stopAllPlayback();
    this.teardownCurrentAudio();
    this.teardownAmbientAudio();
    this.listeners.clear();
  }
}
