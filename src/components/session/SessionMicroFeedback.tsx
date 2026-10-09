// src/components/session/SessionMicroFeedback.tsx
/**
 * Reusable Session Micro Feedback Primitive (During UX)
 * 
 * Lightweight, transient animated badge for real-time interaction feedback:
 * - Grade feedback (SRS Again / Hard / Good / Easy).
 * - Accuracy / pronunciation feedback.
 * - XP earned toast.
 */

import React from 'react';
import { CheckCircle2, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';
import type { SRSGrade } from '../../types';

export interface SessionMicroFeedbackProps {
  feedback: {
    text: string;
    grade?: SRSGrade;
    sentiment?: 'success' | 'warning' | 'info' | 'neutral';
    timestamp?: number;
  } | null;
  className?: string;
}

export const SessionMicroFeedback: React.FC<SessionMicroFeedbackProps> = React.memo(({
  feedback,
  className = '',
}) => {
  if (!feedback || !feedback.text) return null;

  // Resolve color and icon based on grade or sentiment
  let colorClasses = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
  let IconComponent = CheckCircle2;

  if (feedback.grade !== undefined) {
    switch (feedback.grade) {
      case 0:
        colorClasses = 'bg-rose-500/15 border-rose-500/40 text-rose-300';
        IconComponent = AlertCircle;
        break;
      case 1:
        colorClasses = 'bg-amber-500/15 border-amber-500/40 text-amber-300';
        IconComponent = HelpCircle;
        break;
      case 2:
        colorClasses = 'bg-teal-500/15 border-teal-500/40 text-teal-300';
        IconComponent = CheckCircle2;
        break;
      case 3:
        colorClasses = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
        IconComponent = Sparkles;
        break;
    }
  } else if (feedback.sentiment) {
    switch (feedback.sentiment) {
      case 'warning':
        colorClasses = 'bg-amber-500/15 border-amber-500/40 text-amber-300';
        IconComponent = AlertCircle;
        break;
      case 'info':
        colorClasses = 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300';
        IconComponent = Sparkles;
        break;
      case 'neutral':
        colorClasses = 'bg-slate-800 border-slate-700 text-slate-300';
        IconComponent = Sparkles;
        break;
      case 'success':
      default:
        colorClasses = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
        IconComponent = CheckCircle2;
        break;
    }
  }

  return (
    <div
      data-testid="session-micro-feedback"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold shadow-md animate-fadeIn motion-reduce:animate-none transition-all motion-reduce:transition-none ${colorClasses} ${className}`}
    >
      <IconComponent className="w-3.5 h-3.5 shrink-0" />
      <span>{feedback.text}</span>
    </div>
  );
});

SessionMicroFeedback.displayName = 'SessionMicroFeedback';
