import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ListeningSyncController, formatPlaybackTime } from '../services/listeningSyncService';

export interface ListeningSeekBarProps {
  controller: ListeningSyncController | null;
  isPlaying: boolean;
  onSeek: (progress: number) => void;
  onSeekingChange?: (isSeeking: boolean) => void;
  durationMs?: number;
  disabled?: boolean;
  className?: string;
}

export const ListeningSeekBar: React.FC<ListeningSeekBarProps> = ({
  controller,
  isPlaying,
  onSeek,
  onSeekingChange,
  durationMs: externalDurationMs,
  disabled = false,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(externalDurationMs || 0);

  const isDraggingRef = useRef(false);
  isDraggingRef.current = isDragging;
  const dragProgressRef = useRef(0);

  // Poll controller playback position when playing and not dragging
  useEffect(() => {
    if (!controller) return;

    const updatePosition = () => {
      if (isDraggingRef.current) return;
      const pos = controller.getCurrentPosition();
      setPlaybackProgress(pos.progress);
      setCurrentTimeMs(pos.currentTimeMs);
      if (pos.durationMs > 0) {
        setDurationMs(pos.durationMs);
      }
    };

    // Immediate initial sync
    updatePosition();

    if (!isPlaying) return;

    // Smooth ~200ms ticker for progress bar
    const intervalId = setInterval(updatePosition, 200);
    return () => clearInterval(intervalId);
  }, [controller, isPlaying]);

  // Sync duration whenever controller changes, lesson changes, or externalDurationMs updates
  useEffect(() => {
    if (externalDurationMs && externalDurationMs > 0) {
      setDurationMs(externalDurationMs);
      return;
    }
    if (!controller) return;
    const dur = controller.getDurationMs();
    if (dur > 0) {
      setDurationMs(dur);
    }
  }, [controller, externalDurationMs]);

  const effectiveDurationMs = (externalDurationMs && externalDurationMs > 0)
    ? externalDurationMs
    : (durationMs > 0 ? durationMs : (controller?.getDurationMs() ?? 0));

  const activeProgress = isDragging ? dragProgress : playbackProgress;
  const activeTimeSec = isDragging
    ? (dragProgress * effectiveDurationMs) / 1000
    : currentTimeMs / 1000;
  const durationSec = effectiveDurationMs / 1000;

  const commitSeek = useCallback(
    (targetProgress: number) => {
      setIsDragging(false);
      isDraggingRef.current = false;
      onSeekingChange?.(false);
      setPlaybackProgress(targetProgress);
      setCurrentTimeMs(targetProgress * effectiveDurationMs);
      onSeek(targetProgress);
    },
    [effectiveDurationMs, onSeek, onSeekingChange]
  );

  const handlePointerDown = () => {
    if (disabled) return;
    setIsDragging(true);
    isDraggingRef.current = true;
    dragProgressRef.current = playbackProgress;
    setDragProgress(playbackProgress);
    onSeekingChange?.(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const newProgress = Math.max(0, Math.min(1, parseFloat(e.target.value) / 1000));
    dragProgressRef.current = newProgress;
    setDragProgress(newProgress);
  };

  const handlePointerUp = (e: React.SyntheticEvent<HTMLInputElement>) => {
    if (disabled) return;
    const targetProgress = Math.max(0, Math.min(1, parseFloat((e.target as HTMLInputElement).value) / 1000));
    commitSeek(targetProgress);
  };

  // Window release listeners while dragging outside the slider input
  useEffect(() => {
    if (!isDragging) return;
    const handleGlobalRelease = () => {
      if (isDraggingRef.current) {
        commitSeek(dragProgressRef.current);
      }
    };
    window.addEventListener('pointerup', handleGlobalRelease);
    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('touchend', handleGlobalRelease);
    return () => {
      window.removeEventListener('pointerup', handleGlobalRelease);
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('touchend', handleGlobalRelease);
    };
  }, [isDragging, commitSeek]);

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
      const newProgress = Math.max(0, Math.min(1, parseFloat((e.target as HTMLInputElement).value) / 1000));
      commitSeek(newProgress);
    }
  };

  const displayProgressPct = Math.round(activeProgress * 100);

  return (
    <div
      className={`bg-slate-950/70 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-2 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
      data-testid="listening-seek-bar"
    >
      <div className="flex items-center gap-3">
        {/* Current Time Display */}
        <span
          className="font-mono text-xs font-bold text-cyan-400 shrink-0 w-12 text-right select-none"
          data-testid="seek-current-time"
        >
          {formatPlaybackTime(activeTimeSec, true)}
        </span>

        {/* Range Slider Track */}
        <div className="relative flex-1 flex items-center group">
          <input
            type="range"
            min="0"
            max="1000"
            step="1"
            disabled={disabled}
            value={Math.round(activeProgress * 1000)}
            onPointerDown={handlePointerDown}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            onChange={handleChange}
            onPointerUp={handlePointerUp}
            onMouseUp={handlePointerUp}
            onTouchEnd={handlePointerUp}
            onKeyUp={handleKeyUp}
            aria-label="Thanh tua bài nghe"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={displayProgressPct}
            aria-valuetext={`${formatPlaybackTime(activeTimeSec, true)} trên ${formatPlaybackTime(durationSec, true)}`}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all"
            style={{
              background: `linear-gradient(to right, rgb(34 211 238) 0%, rgb(34 211 238) ${
                activeProgress * 100
              }%, rgb(30 41 59) ${activeProgress * 100}%, rgb(30 41 59) 100%)`,
            }}
          />
        </div>

        {/* Total Duration Display */}
        <span
          className="font-mono text-xs font-bold text-slate-400 shrink-0 w-12 text-left select-none"
          data-testid="seek-duration"
        >
          {formatPlaybackTime(durationSec, true)}
        </span>
      </div>
    </div>
  );
};
