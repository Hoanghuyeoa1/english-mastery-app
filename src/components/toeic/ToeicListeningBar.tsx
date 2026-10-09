// src/components/toeic/ToeicListeningBar.tsx
import React from 'react';
import {
  Volume2,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
  Gauge,
  Headphones,
} from 'lucide-react';
import {
  ToeicListeningEngineState,
  ListeningPlaybackPolicy,
} from '../../types/toeicListening';
import { formatAudioTime } from '../../services/toeicAudioResolver';

export interface ToeicListeningBarProps {
  engineState: ToeicListeningEngineState;
  policy: ListeningPlaybackPolicy;
  onPlay: () => void;
  onPause: () => void;
  onRestart?: () => void;
  onSeek?: (timeMs: number) => void;
  onSetSpeed?: (speed: number) => void;
  onToggleTranscript?: () => void;
  isTranscriptVisible?: boolean;
  partLabel: string;
  hasAnswered?: boolean;
}

export const ToeicListeningBar: React.FC<ToeicListeningBarProps> = ({
  engineState,
  policy,
  onPlay,
  onPause,
  onRestart,
  onSeek,
  onSetSpeed,
  onToggleTranscript,
  isTranscriptVisible = false,
  partLabel,
  hasAnswered = false,
}) => {
  const isPlaying = engineState.status === 'playing';
  const isLoading = engineState.status === 'loading';
  const isError = engineState.status === 'error';

  // Trong Mock Exam: Nếu đã nghe 1 lần và allowReplay === false thì vô hiệu hóa
  const isSinglePlayLocked = !policy.allowReplay && engineState.playCount >= policy.maxPlayCount && !isPlaying;

  // Mô tả bước Part 2 đang phát
  const getPart2StepLabel = () => {
    switch (engineState.part2SequenceStep) {
      case 'prompt':
        return '🎙️ Đang đọc: Câu hỏi';
      case 'option_a':
        return '🔊 Đang đọc: Phương án (A)';
      case 'option_b':
        return '🔊 Đang đọc: Phương án (B)';
      case 'option_c':
        return '🔊 Đang đọc: Phương án (C)';
      case 'completed':
        return '✓ Đã đọc xong chuỗi';
      default:
        return null;
    }
  };

  const part2StepText = getPart2StepLabel();

  // Chuyển đổi tốc độ phát (chỉ khả dụng trong Practice khi policy cho phép)
  const handleCycleSpeed = () => {
    if (!policy.allowSpeedControl || !onSetSpeed) return;
    const current = engineState.playbackRate;
    const next = current === 1.0 ? 1.25 : current === 1.25 ? 0.85 : 1.0;
    onSetSpeed(next);
  };

  // Xử lý phím tắt Space để phát/dừng audio nếu không bị khóa theo quy chế
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (e.key === ' ' || e.code === 'Space') {
      if (!isSinglePlayLocked && !isLoading) {
        e.preventDefault();
        if (isPlaying) onPause();
        else onPlay();
      }
    }
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Khu vực điều khiển âm thanh bài nghe"
      className="p-4 bg-slate-850/90 border border-slate-750 rounded-2xl space-y-3 shadow-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50"
    >
      {/* Screen Reader Live Status Region */}
      <div className="sr-only" aria-live="polite" role="status">
        {isPlaying
          ? 'Đang phát âm thanh bài nghe'
          : isLoading
          ? 'Đang tải tệp âm thanh'
          : isError
          ? `Lỗi âm thanh: ${engineState.errorMessage || 'Không thể phát'}`
          : isSinglePlayLocked
          ? 'Đã hoàn thành lượt nghe duy nhất theo quy định phòng thi'
          : 'Sẵn sàng phát âm thanh'}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Info & Badges */}
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              isSinglePlayLocked
                ? 'bg-slate-800 text-slate-500'
                : isPlaying
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 animate-pulse'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-white block">
                Đoạn Audio Nghe ({partLabel === 'part1_photos' ? 'Part 1: Nghe 4 nhận định A, B, C, D' : partLabel})
              </span>

              {engineState.sourceType === 'recorded' && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Studio MP3
                </span>
              )}
              {engineState.sourceType === 'tts' && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Web Speech TTS
                </span>
              )}

              {/* Part 2 Active Step Badge */}
              {part2StepText && isPlaying && (
                <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-fade-in">
                  {part2StepText}
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5">
              {!policy.allowReplay
                ? 'Quy chế thi Mock Test ETS: Mỗi câu hỏi chỉ được nghe audio 1 lần duy nhất.'
                : 'Luyện nghe không giới hạn số lần phát audio (US / UK)'}
            </p>
          </div>
        </div>

        {/* Right: Play Controls */}
        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap sm:flex-nowrap">
          {/* Speed Toggle (Practice only) */}
          {policy.allowSpeedControl && onSetSpeed && (
            <button
              type="button"
              onClick={handleCycleSpeed}
              className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              title="Thay đổi tốc độ phát"
              aria-label={`Thay đổi tốc độ phát âm thanh, hiện tại là ${engineState.playbackRate} lần`}
            >
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              <span>{engineState.playbackRate}x</span>
            </button>
          )}

          {/* Replay Button (Practice only) */}
          {policy.allowReplay && onRestart && (
            <button
              type="button"
              onClick={onRestart}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              title="Nghe lại từ đầu"
              aria-label="Nghe lại từ đầu"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {/* Transcript Toggle (Practice only, governed by policy.showTranscript) */}
          {policy.showTranscript && onToggleTranscript && (
            <button
              type="button"
              onClick={onToggleTranscript}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                isTranscriptVisible
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
              }`}
              title={isTranscriptVisible ? 'Ẩn lời thoại kịch bản' : 'Xem lời thoại kịch bản'}
              aria-label={isTranscriptVisible ? 'Ẩn Script' : 'Xem Script'}
              aria-expanded={isTranscriptVisible}
            >
              {isTranscriptVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isTranscriptVisible ? 'Ẩn Script' : 'Xem Script'}</span>
            </button>
          )}

          {/* Main Play/Pause Button */}
          <button
            type="button"
            disabled={isSinglePlayLocked || isLoading}
            onClick={isPlaying ? onPause : onPlay}
            aria-label={
              isSinglePlayLocked
                ? 'Đã phát (1 lần)'
                : isLoading
                ? 'Đang tải...'
                : isPlaying
                ? 'Tạm dừng'
                : 'Phát Audio'
            }
            className={`min-h-[44px] min-w-[120px] px-5 py-2.5 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all select-none active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              isSinglePlayLocked
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750'
                : isLoading
                ? 'bg-amber-500/50 text-slate-900 cursor-wait'
                : isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg shadow-amber-500/20 hover:scale-105'
            }`}
            title={
              isSinglePlayLocked
                ? 'Bạn đã phát câu hỏi này theo quy chế phòng thi ETS'
                : isPlaying
                ? 'Tạm dừng bài nghe'
                : 'Phát âm thanh bài nghe'
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin fill-slate-950" />
                <span>Đang tải...</span>
              </>
            ) : isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-slate-950" />
                <span>Tạm dừng</span>
              </>
            ) : (
              <>
                <Play className={`w-3.5 h-3.5 ${isSinglePlayLocked ? 'fill-slate-500' : 'fill-slate-950'}`} />
                <span>{isSinglePlayLocked ? 'Đã phát (1 lần)' : 'Phát Audio'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress & Seek Bar (Chỉ hiện và cho phép kéo tua khi policy.allowSeek === true) */}
      {policy.allowSeek && engineState.durationMs > 0 && onSeek && (
        <div className="space-y-1 pt-1 border-t border-slate-800/80 animate-fade-in">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>{formatAudioTime(engineState.currentTimeMs)}</span>
            <span>{formatAudioTime(engineState.durationMs)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={engineState.durationMs}
            value={engineState.currentTimeMs}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            aria-label="Thanh tua thời gian bài nghe"
            aria-valuemin={0}
            aria-valuemax={engineState.durationMs}
            aria-valuenow={engineState.currentTimeMs}
            aria-valuetext={`${formatAudioTime(engineState.currentTimeMs)} trên ${formatAudioTime(engineState.durationMs)}`}
          />
        </div>
      )}

      {/* Error Callout */}
      {isError && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between text-xs text-red-300"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{engineState.errorMessage || 'Không thể phát bài nghe. Vui lòng thử lại.'}</span>
          </div>
          <button
            type="button"
            onClick={onPlay}
            className="min-h-[36px] px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-[11px] font-bold border border-red-500/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Thử lại
          </button>
        </div>
      )}
    </div>
  );
};
