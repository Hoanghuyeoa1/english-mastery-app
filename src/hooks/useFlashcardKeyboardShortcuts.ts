import React, { useEffect, useRef } from 'react';
import type { SRSGrade, SRSReviewCard } from '../types';

export interface UseFlashcardKeyboardShortcutsParams {
  currentWord: SRSReviewCard | undefined;
  handleGrade: (grade: SRSGrade) => void;
  handlePlayAudio: (text: string, customSpeed?: number) => void;
  handlePracticePronunciation: (e?: React.MouseEvent) => void;
  handlePrev: () => void;
  handleNext: () => void;
  handleToggleFavorite: () => void;
  isMaskExample: boolean;
  setIsMaskExample: (val: boolean) => void;
  handleCycleAudioSpeed: () => void;
  isSessionCompleted: boolean;
  isSessionStarted: boolean;
  setIsFlipped: React.Dispatch<React.SetStateAction<boolean>>;
  setIsVoiceModalOpen: (val: boolean) => void;
  isReviewingRef: React.MutableRefObject<boolean>;
}

export function useFlashcardKeyboardShortcuts(params: UseFlashcardKeyboardShortcutsParams): void {
  const handlersRef = useRef(params);
  handlersRef.current = params;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const h = handlersRef.current;
      if (h.isSessionCompleted || h.isReviewingRef.current || !h.isSessionStarted) return;

      if (e.code === 'Space') {
        e.preventDefault();
        h.setIsFlipped((prev) => !prev);
        return;
      }

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        h.handlePrev();
        return;
      }

      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        h.handleNext();
        return;
      }

      if (e.code === 'KeyR') {
        e.preventDefault();
        if (h.currentWord) h.handlePlayAudio(h.currentWord.primaryText || h.currentWord.word || '');
        return;
      }

      if (e.code === 'KeyS') {
        e.preventDefault();
        h.handleCycleAudioSpeed();
        return;
      }

      // Phím B hoặc F: Gắn/bỏ sao (Bookmark / Favorite)
      if (e.code === 'KeyB' || e.code === 'KeyF') {
        e.preventDefault();
        h.handleToggleFavorite();
        return;
      }

      // Phím V hoặc P: Mở chấm điểm phát âm qua Micro
      if (e.code === 'KeyV' || e.code === 'KeyP') {
        e.preventDefault();
        h.handlePracticePronunciation();
        return;
      }

      // Phím M: Bật/Tắt che từ trong ví dụ (Mask mode)
      if (e.code === 'KeyM') {
        e.preventDefault();
        h.setIsMaskExample(!h.isMaskExample);
        return;
      }

      if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
        e.preventDefault();
        h.handleGrade(0);
      } else if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
        e.preventDefault();
        h.handleGrade(1);
      } else if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
        e.preventDefault();
        h.handleGrade(2);
      } else if (e.key === '4' || e.code === 'Digit4' || e.code === 'Numpad4') {
        e.preventDefault();
        h.handleGrade(3);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
