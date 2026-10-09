// src/hooks/useToeicAudio.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ToeicAudioEngine,
  ToeicAudioEngineState,
  AudioElementFactory,
} from '../services/toeicAudioEngine';
import {
  ToeicQuestion,
  ToeicQuestionGroup,
} from '../types/toeic';
import {
  ResolveToeicAudioInput,
  ResolveToeicAudioOptions,
} from '../services/toeicAudioResolver';

export interface UseToeicAudioOptions {
  parentGroup?: ToeicQuestionGroup | null;
  resolverOptions?: ResolveToeicAudioOptions;
  initialVolume?: number;
  audioFactory?: AudioElementFactory;
}

export interface UseToeicAudioReturn {
  state: ToeicAudioEngineState;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  stop: () => void;
  restart: () => void;
  seek: (timeMs: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  load: (
    item: ToeicQuestion | ToeicQuestionGroup | ResolveToeicAudioInput,
    parentGroup?: ToeicQuestionGroup | null
  ) => void;
  engine: ToeicAudioEngine;
}

/**
 * Hook quản lý lifecycle phát âm thanh TOEIC (MP3 / TTS) an toàn trong React Component.
 * Tự động đồng bộ state, dọn dẹp tài nguyên và tắt audio khi component unmount.
 */
export function useToeicAudio(
  initialItem?: ToeicQuestion | ToeicQuestionGroup | ResolveToeicAudioInput | null,
  options?: UseToeicAudioOptions
): UseToeicAudioReturn {
  const engineRef = useRef<ToeicAudioEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new ToeicAudioEngine({
      audioFactory: options?.audioFactory,
      initialVolume: options?.initialVolume,
    });
  }

  const engine = engineRef.current;
  const [state, setState] = useState<ToeicAudioEngineState>(() => engine.getState());

  // Subscribe state updates
  useEffect(() => {
    const unsubscribe = engine.subscribe((nextState) => {
      setState(nextState);
    });

    return () => {
      unsubscribe();
    };
  }, [engine]);

  // Load item ban đầu hoặc khi item thay đổi
  const prevItemIdRef = useRef<string | null>(null);
  const currentItemId = (initialItem && 'id' in initialItem) ? (initialItem.id as string) : null;

  useEffect(() => {
    if (initialItem && currentItemId !== prevItemIdRef.current) {
      prevItemIdRef.current = currentItemId;
      engine.load(initialItem, options?.parentGroup, options?.resolverOptions);
    }
  }, [initialItem, currentItemId, engine, options?.parentGroup, options?.resolverOptions]);

  // Cleanup khi component unmount
  useEffect(() => {
    return () => {
      engine.dispose();
    };
  }, [engine]);

  const play = useCallback(() => engine.play(), [engine]);
  const pause = useCallback(() => engine.pause(), [engine]);
  const togglePlay = useCallback(() => engine.togglePlay(), [engine]);
  const stop = useCallback(() => engine.stop(), [engine]);
  const restart = useCallback(() => engine.restart(), [engine]);
  const seek = useCallback((timeMs: number) => engine.seek(timeMs), [engine]);
  const setVolume = useCallback((vol: number) => engine.setVolume(vol), [engine]);
  const toggleMute = useCallback(() => engine.toggleMute(), [engine]);
  const setPlaybackRate = useCallback((rate: number) => engine.setPlaybackRate(rate), [engine]);
  const load = useCallback(
    (
      item: ToeicQuestion | ToeicQuestionGroup | ResolveToeicAudioInput,
      parentGroup?: ToeicQuestionGroup | null
    ) => {
      engine.load(item, parentGroup, options?.resolverOptions);
    },
    [engine, options?.resolverOptions]
  );

  return {
    state,
    play,
    pause,
    togglePlay,
    stop,
    restart,
    seek,
    setVolume,
    toggleMute,
    setPlaybackRate,
    load,
    engine,
  };
}
