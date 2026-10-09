// src/hooks/useToeicListeningEngine.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ToeicListeningEngine,
  AudioElementFactory,
} from '../services/toeicListeningEngine';
import {
  NormalizedToeicListeningGroup,
  ListeningPlaybackPolicy,
  ToeicListeningEngineState,
  DEFAULT_LISTENING_POLICIES,
} from '../types/toeicListening';

export interface UseToeicListeningEngineOptions {
  policy?: ListeningPlaybackPolicy;
  initialPlayCount?: number;
  initialVolume?: number;
  audioFactory?: AudioElementFactory;
}

export interface UseToeicListeningEngineReturn {
  state: ToeicListeningEngineState;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  seek: (timeMs: number) => void;
  restart: () => void;
  stop: () => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  loadGroup: (group: NormalizedToeicListeningGroup, policy?: ListeningPlaybackPolicy) => void;
  setPolicy: (policy: ListeningPlaybackPolicy) => void;
  engine: ToeicListeningEngine;
}

/**
 * React Hook quản lý vòng đời phát âm thanh TOEIC Listening Engine.
 * Tự động đồng bộ state qua event listener, giữ nguyên playback khi câu hỏi con trong
 * cùng một group thay đổi (Group Lifecycle Guard), và dọn dẹp bộ nhớ khi unmount.
 */
export function useToeicListeningEngine(
  initialGroup?: NormalizedToeicListeningGroup | null,
  options?: UseToeicListeningEngineOptions
): UseToeicListeningEngineReturn {
  const engineRef = useRef<ToeicListeningEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new ToeicListeningEngine({
      audioFactory: options?.audioFactory,
      initialVolume: options?.initialVolume,
    });
  }

  const engine = engineRef.current;
  const [state, setState] = useState<ToeicListeningEngineState>(() => engine.getState());

  // Đăng ký nhận cập nhật state
  useEffect(() => {
    const unsubscribe = engine.subscribe((nextState) => {
      setState(nextState);
    });

    return () => {
      unsubscribe();
    };
  }, [engine]);

  // Cập nhật policy khi options.policy thay đổi (chống leak Practice sang Mock)
  const currentPolicy = options?.policy;
  const prevPolicyRef = useRef<ListeningPlaybackPolicy | undefined>(currentPolicy);

  useEffect(() => {
    if (currentPolicy && currentPolicy !== prevPolicyRef.current) {
      prevPolicyRef.current = currentPolicy;
      engine.setPolicy(currentPolicy);
    }
  }, [currentPolicy, engine]);

  // Nạp group ban đầu hoặc khi group thay đổi hoặc khi initialPlayCount thay đổi
  const prevGroupIdRef = useRef<string | null>(null);
  const prevPlayCountRef = useRef<number | undefined>(options?.initialPlayCount);
  const currentGroupId = initialGroup?.id ?? null;
  const currentPlayCount = options?.initialPlayCount ?? 0;

  useEffect(() => {
    if (
      initialGroup &&
      (currentGroupId !== prevGroupIdRef.current || currentPlayCount !== prevPlayCountRef.current)
    ) {
      prevGroupIdRef.current = currentGroupId;
      prevPlayCountRef.current = currentPlayCount;
      engine.loadGroup(
        initialGroup,
        options?.policy || DEFAULT_LISTENING_POLICIES.practice,
        currentPlayCount
      );
    } else if (!initialGroup && prevGroupIdRef.current !== null) {
      prevGroupIdRef.current = null;
      prevPlayCountRef.current = undefined;
      engine.stop();
    }
  }, [initialGroup, currentGroupId, engine, options?.policy, currentPlayCount]);

  // Dọn dẹp engine khi component unmount
  useEffect(() => {
    return () => {
      engine.dispose();
    };
  }, [engine]);

  const play = useCallback(() => engine.play(), [engine]);
  const pause = useCallback(() => engine.pause(), [engine]);
  const togglePlay = useCallback(() => engine.togglePlay(), [engine]);
  const seek = useCallback((timeMs: number) => engine.seek(timeMs), [engine]);
  const restart = useCallback(() => engine.restart(), [engine]);
  const stop = useCallback(() => engine.stop(), [engine]);
  const setPlaybackRate = useCallback((rate: number) => engine.setPlaybackRate(rate), [engine]);
  const setVolume = useCallback((vol: number) => engine.setVolume(vol), [engine]);
  const toggleMute = useCallback(() => engine.toggleMute(), [engine]);
  const loadGroup = useCallback(
    (group: NormalizedToeicListeningGroup, policy?: ListeningPlaybackPolicy) => {
      engine.loadGroup(group, policy);
    },
    [engine]
  );
  const setPolicy = useCallback(
    (policy: ListeningPlaybackPolicy) => {
      engine.setPolicy(policy);
    },
    [engine]
  );

  return {
    state,
    play,
    pause,
    togglePlay,
    seek,
    restart,
    stop,
    setPlaybackRate,
    setVolume,
    toggleMute,
    loadGroup,
    setPolicy,
    engine,
  };
}
