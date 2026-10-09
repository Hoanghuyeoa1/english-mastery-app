import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

export interface SuccessFeedbackProps {
  message?: string;
  autoDismissMs?: number;
  onDismiss?: () => void;
  className?: string;
  showIcon?: boolean;
}

/**
 * Lightweight micro-success feedback primitive.
 * Displays immediate visual confirmation (check icon + subtle emerald glow)
 * without resorting to intrusive confetti or screen-wide animations.
 */
export const SuccessFeedback: React.FC<SuccessFeedbackProps> = ({
  message = 'Thành công!',
  autoDismissMs,
  onDismiss,
  className = '',
  showIcon = true,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!autoDismissMs) return;

    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [autoDismissMs, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold shadow-sm transition-all duration-150 motion-reduce:transition-none ${className}`}
      data-testid="micro-success-feedback"
    >
      {showIcon && (
        <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
          <Check className="w-2.5 h-2.5 text-emerald-400 stroke-[3]" />
        </span>
      )}
      <span>{message}</span>
    </div>
  );
};
