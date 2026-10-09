// src/components/ToeicAudioPlayer.tsx
import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  FileText,
  AlertCircle,
  Headphones,
  CheckCircle,
} from 'lucide-react';
import { ToeicAudioEngineState } from '../services/toeicAudioEngine';
import { formatAudioTime } from '../services/toeicAudioResolver';
import { ToeicAudioTimingSegment } from '../types/toeic';

export interface ToeicAudioPlayerProps {
  state: ToeicAudioEngineState;
  onPlay: () => void;
  onPause: () => void;
  onTogglePlay: () => void;
  onRestart: () => void;
  onSeek: (timeMs: number) => void;
  onToggleMute: () => void;
  onSetPlaybackRate?: (rate: number) => void;
  /**
   * Cho phép nghe lại (trong Mock ETS có thể bị khóa nếu đã phát 1 lần)
   */
  allowReplay?: boolean;
  /**
   * Cho phép hiển thị transcript bài nghe
   */
  allowTranscript?: boolean;
  /**
   * Script văn bản dự phòng nếu không có timing segments
   */
  fallbackTranscript?: string | null;
  /**
   * Danh sách các segments đồng bộ
   */
  timingSegments?: ToeicAudioTimingSegment[];
  /**
   * Tiêu đề hoặc nhãn mô tả audio (e.g. "Part 1: Photographs #1")
   */
  title?: string;
  className?: string;
}

export const ToeicAudioPlayer: React.FC<ToeicAudioPlayerProps> = ({
  state,
  onTogglePlay,
  onRestart,
  onSeek,
  onToggleMute,
  onSetPlaybackRate,
  allowReplay = true,
  allowTranscript = true,
  fallbackTranscript,
  timingSegments,
  title = 'Bài nghe TOEIC',
  className = '',
}) => {
  const [showTranscript, setShowTranscript] = useState(false);

  const isPlaying = state.status === 'playing';
  const isEnded = state.status === 'ended';
  const isLoading = state.status === 'loading';
  const isError = state.status === 'error';
  const isPlayDisabled = !allowReplay && state.hasPlaybackStarted && !isPlaying;

  const durationMs = state.durationMs || 1;
  const currentTimeMs = Math.min(state.currentTimeMs, durationMs);
  const progressPercent = Math.min(100, Math.max(0, (currentTimeMs / durationMs) * 100));

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (!Number.isNaN(val)) {
      onSeek(val);
    }
  };

  return (
    <div
      role="region"
      aria-label={`Bộ điều khiển âm thanh: ${title}`}
      className={`p-4 sm:p-5 bg-slate-900 border border-slate-750 rounded-2xl space-y-4 shadow-xl ${className}`}
    >
      {/* Header Info & Source Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-wide">{title}</h4>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Giọng: {state.accent}</span>
              {state.sourceType === 'mp3' && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Studio MP3
                </span>
              )}
              {state.sourceType === 'tts' && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {state.fallbackOccurred ? 'TTS Fallback' : 'Web Speech TTS'}
                </span>
              )}
              {state.isInheritedFromGroup && (
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  Đoạn hội thoại nhóm
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Speed Selector (nếu MP3 và có handler) */}
        {onSetPlaybackRate && state.sourceType === 'mp3' && (
          <div className="flex items-center gap-1 bg-slate-850 p-1 rounded-xl border border-slate-750">
            {[0.85, 1.0, 1.15].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => onSetPlaybackRate(rate)}
                aria-label={`Tốc độ phát ${rate}x`}
                className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  state.playbackRate === rate
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Progress Bar & Seek Slider (Only for MP3 with duration) */}
      {state.sourceType === 'mp3' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>{formatAudioTime(currentTimeMs)}</span>
            <span>{formatAudioTime(durationMs)}</span>
          </div>

          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={durationMs}
              value={currentTimeMs}
              onChange={handleSliderChange}
              disabled={isPlayDisabled || isLoading}
              aria-label="Thanh trượt thời gian bài nghe"
              aria-valuemin={0}
              aria-valuemax={durationMs}
              aria-valuenow={currentTimeMs}
              aria-valuetext={`${formatAudioTime(currentTimeMs)} trên ${formatAudioTime(durationMs)}`}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      )}

      {/* Primary Control Buttons */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          {/* Play / Pause Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={isPlayDisabled || isLoading}
            aria-label={
              isPlaying
                ? 'Tạm dừng bài nghe'
                : isEnded
                ? 'Phát lại bài nghe'
                : 'Phát âm thanh bài nghe'
            }
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              isPlayDisabled
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 hover:scale-105 active:scale-95'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-slate-950" />
                <span>Tạm dừng</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950" />
                <span>{isEnded ? 'Nghe lại' : isLoading ? 'Đang nạp...' : 'Phát Audio'}</span>
              </>
            )}
          </button>

          {/* Restart Button */}
          {allowReplay && (
            <button
              type="button"
              onClick={onRestart}
              disabled={isLoading || (!state.hasPlaybackStarted && currentTimeMs === 0)}
              aria-label="Phát lại từ đầu"
              title="Phát lại từ đầu"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {/* Mute / Unmute Button */}
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={state.isMuted ? 'Bật âm lượng' : 'Tắt tiếng'}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {state.isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Transcript Toggle Button */}
        {allowTranscript && (fallbackTranscript || (timingSegments && timingSegments.length > 0)) && (
          <button
            type="button"
            onClick={() => setShowTranscript(!showTranscript)}
            aria-expanded={showTranscript}
            aria-label={showTranscript ? 'Ẩn lời thoại bài nghe' : 'Xem lời thoại bài nghe'}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              showTranscript
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{showTranscript ? 'Ẩn lời thoại' : 'Xem Transcript'}</span>
          </button>
        )}
      </div>

      {/* Error Notice */}
      {isError && (
        <div
          role="alert"
          className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2 animate-fade-in"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Lỗi phát âm thanh</p>
            <p className="text-rose-400/90 text-[11px]">
              {state.errorMessage || 'Không thể phát file âm thanh. Trình duyệt đã chuyển về chế độ an toàn.'}
            </p>
          </div>
        </div>
      )}

      {/* Transcript Container with Synchronized Highlight (ZERO dangerouslySetInnerHTML) */}
      {allowTranscript && showTranscript && (
        <div
          role="region"
          aria-label="Văn bản lời thoại"
          className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 space-y-2 animate-fade-in max-h-60 overflow-y-auto leading-relaxed font-serif"
        >
          {timingSegments && timingSegments.length > 0 && state.hasValidTiming ? (
            <div className="space-y-2">
              {timingSegments.map((seg, sIdx) => {
                const isActiveSegment = state.activeSegmentIndex === sIdx;
                return (
                  <p
                    key={seg.id || `seg_${sIdx}`}
                    className={`transition-colors p-1.5 rounded-lg ${
                      isActiveSegment ? 'bg-amber-500/10 border border-amber-500/20 text-white' : 'text-slate-300'
                    }`}
                  >
                    {seg.speaker && (
                      <span className="font-sans font-bold text-amber-400 mr-2 text-[11px] uppercase tracking-wider block sm:inline">
                        {seg.speaker}:
                      </span>
                    )}

                    {/* Token-level rendering with safe text spans */}
                    {seg.tokens && seg.tokens.length > 0 ? (
                      seg.tokens.map((tok, tIdx) => {
                        const isActiveToken =
                          isActiveSegment &&
                          state.activeToken &&
                          state.activeToken.startMs === tok.startMs &&
                          state.activeToken.endMs === tok.endMs;

                        return (
                          <span
                            key={`tok_${sIdx}_${tIdx}`}
                            className={`transition-all rounded px-0.5 ${
                              isActiveToken
                                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm ring-2 ring-amber-400'
                                : ''
                            }`}
                          >
                            {tok.text}{' '}
                          </span>
                        );
                      })
                    ) : (
                      <span>{seg.text}</span>
                    )}
                  </p>
                );
              })}
            </div>
          ) : (
            /* Safe Fallback Static Transcript */
            <p className="whitespace-pre-line text-slate-300 italic">
              {fallbackTranscript || state.textToSpeak || 'Không có văn bản lời thoại.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
