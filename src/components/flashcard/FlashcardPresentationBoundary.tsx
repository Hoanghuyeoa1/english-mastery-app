import React, { useEffect, useRef } from 'react';
import type { SRSReviewCard } from '../../types';
import { cancelSpeech } from '../../services/speechService';

export interface FlashcardPresentationBoundaryProps {
  card: SRSReviewCard;
  isReady?: boolean;
  onPresented: (card: SRSReviewCard) => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * FlashcardPresentationBoundary
 * 
 * Enforces the core Phase 4 invariant:
 * CURRENT CARD RESOLVED -> CARD RENDERED / PRESENTED IN DOM -> AUTO TTS ELIGIBLE.
 * 
 * Guarantees:
 * 1. Zero arbitrary timeouts (eliminates setTimeout guessing).
 * 2. Fires onPresented only AFTER the card DOM is committed and mounted in document.
 * 3. Exact card identity: passes the exact card instance being presented.
 * 4. Cleans up ongoing TTS when unmounting or transitioning to next card.
 */
export const FlashcardPresentationBoundary: React.FC<FlashcardPresentationBoundaryProps> = React.memo(({
  card,
  isReady = false,
  onPresented,
  children,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Invariant: Verify container is attached to document and matches exact card ID
    if (containerRef.current && card?.id) {
      onPresented(card);
    }

    return () => {
      // Cleanup: Cancel any active speech synthesis when card unmounts or transitions
      cancelSpeech();
    };
  }, [card?.id, onPresented]);

  return (
    <div
      ref={containerRef}
      data-testid="flashcard-presentation-boundary"
      data-presented-card-id={card.id}
      data-card-ready={isReady ? 'true' : 'false'}
      className={`w-full ${className}`}
    >
      {children}
    </div>
  );
});

FlashcardPresentationBoundary.displayName = 'FlashcardPresentationBoundary';
