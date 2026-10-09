// src/components/toeic/ToeicListeningGroupView.tsx
import React, { useState } from 'react';
import {
  Headphones,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Users,
  MessageSquare,
  Volume2,
} from 'lucide-react';
import { ToeicQuestion } from '../../types/toeic';
import {
  NormalizedToeicListeningGroup,
  ToeicListeningEngineState,
  ListeningPlaybackPolicy,
} from '../../types/toeicListening';
import { ToeicListeningBar } from './ToeicListeningBar';

export interface ToeicListeningGroupViewProps {
  /** Nhóm Listening chuẩn hóa (Part 3 Conversation hoặc Part 4 Talk) */
  group: NormalizedToeicListeningGroup;
  /** Câu hỏi con đang active hiển thị */
  currentQuestion: ToeicQuestion;
  /** Danh sách toàn bộ các câu hỏi con thuộc nhóm này trong bài thi */
  childQuestions: ToeicQuestion[];
  /** Chỉ số của câu hỏi con trong nhóm (0-indexed: 0, 1, 2) */
  questionIndexWithinGroup: number;
  /** Số thứ tự toàn cục của câu hỏi trong đề thi (1-indexed: e.g. 41) */
  globalQuestionNumber: number;
  /** Tổng số câu hỏi trong bài thi */
  totalExamQuestions: number;
  /** Từ điển đáp án người dùng đã chọn: { [questionId]: 'A' | 'B' | 'C' | 'D' } */
  userAnswers: Record<string, string>;
  /** Callback khi người dùng chọn đáp án cho câu hỏi hiện tại */
  onSelectAnswer: (choiceLetter: string) => void;
  /** Callback điều hướng giữa các câu hỏi con trong nhóm */
  onNavigateToChildQuestion: (indexInGroup: number) => void;
  /** Central Playback Policy (Mock vs Practice) */
  policy: ListeningPlaybackPolicy;
  /** State máy trạng thái âm thanh từ ToeicListeningEngine */
  engineState: ToeicListeningEngineState;
  /** Các hành động điều khiển âm thanh */
  onPlay: () => void;
  onPause: () => void;
  onRestart?: () => void;
  onSeek?: (timeMs: number) => void;
  onSetSpeed?: (speed: number) => void;
  /** Trạng thái hiển thị transcript kịch bản */
  revealedTranscript: boolean;
  onToggleTranscript: () => void;
  /** Cho phép thử lại câu hỏi trong chế độ Practice */
  isRetryAllowed?: boolean;
  onRetry?: (questionId: string) => void;
}

/**
 * Component hiển thị giao diện nhóm câu hỏi TOEIC Part 3 (Short Conversations)
 * và Part 4 (Short Talks) theo kiến trúc chuẩn Group-Based Audio:
 * - 1 Group -> 1 Shared Audio -> Multiple Questions (thường là 3 câu).
 * - Điều hướng giữa các câu con Q1 -> Q2 -> Q3 HOÀN TOÀN KHÔNG reload hay restart audio.
 * - Quy chế Mock Exam: phát tối đa 1 lần cho cả cụm nhóm, cấm leak transcript vào DOM.
 * - Quy chế Practice: hiển thị transcript phân vai (Speaker A/B, Man/Woman), highlight thời gian thực, seek/replay theo đoạn.
 */
export const ToeicListeningGroupView: React.FC<ToeicListeningGroupViewProps> = ({
  group,
  currentQuestion,
  childQuestions,
  questionIndexWithinGroup,
  globalQuestionNumber,
  totalExamQuestions,
  userAnswers,
  onSelectAnswer,
  onNavigateToChildQuestion,
  policy,
  engineState,
  onPlay,
  onPause,
  onRestart,
  onSeek,
  onSetSpeed,
  revealedTranscript,
  onToggleTranscript,
}) => {
  const [imageError, setImageError] = useState(false);

  const isPart3 = group.part === 'part3_conv';
  const partTitle = isPart3
    ? 'Part 3: Short Conversations (Hội thoại ngắn)'
    : 'Part 4: Short Talks (Bài nói ngắn)';

  const selectedAnswer = userAnswers[currentQuestion.id];
  const hasAnsweredCurrent = Boolean(selectedAnswer);
  const choiceLetters = ['A', 'B', 'C', 'D'];

  // Nhãn màu sắc phân vai người nói (Speaker Badges)
  const getSpeakerStyle = (speaker?: string) => {
    if (!speaker) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    const s = speaker.toLowerCase();
    if (s.includes('man') || s.includes('person 1') || s.includes('speaker a')) {
      return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    }
    if (s.includes('woman') || s.includes('person 2') || s.includes('speaker b')) {
      return 'text-pink-400 bg-pink-500/10 border-pink-500/20';
    }
    return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  };

  const imageUrl = ('imageUrl' in group ? group.imageUrl : undefined) || currentQuestion.imageUrl;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="toeic-listening-group-view">
      {/* ========================================================================= */}
      {/* 1. GROUP CONTEXT & NAVIGATION HEADER                                      */}
      {/* ========================================================================= */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
              {isPart3 ? <Users className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
              <span>{isPart3 ? 'Part 3: Conversations' : 'Part 4: Short Talks'}</span>
            </span>

            {group.topic && (
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {group.topic}
              </span>
            )}

            {group.title && (
              <span className="text-xs font-bold text-slate-200">
                {group.title}
              </span>
            )}
          </div>

          {/* Group vs Global Position indicator */}
          <div className="text-[11px] text-slate-400 flex items-center gap-2 self-start sm:self-auto">
            <span>
              Câu hỏi nhóm: <strong className="text-amber-300">{questionIndexWithinGroup + 1}</strong> / {childQuestions.length}
            </span>
            <span className="text-slate-600">•</span>
            <span>
              Toàn bài: <strong className="text-white">{globalQuestionNumber}</strong> / {totalExamQuestions}
            </span>
          </div>
        </div>

        {/* Group Description Note */}
        <p className="text-xs text-amber-400/90 font-medium">
          💡 Format TOEIC chuẩn: Lắng nghe đoạn {isPart3 ? 'hội thoại' : 'bài nói'} và trả lời {childQuestions.length} câu hỏi liên quan bên dưới.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 2. SHARED AUDIO BAR (LISTENING ENGINE INTEGRATED)                          */}
      {/* ========================================================================= */}
      <ToeicListeningBar
        engineState={engineState}
        policy={policy}
        onPlay={onPlay}
        onPause={onPause}
        onRestart={onRestart}
        onSeek={onSeek}
        onSetSpeed={onSetSpeed}
        onToggleTranscript={onToggleTranscript}
        isTranscriptVisible={revealedTranscript}
        partLabel={partTitle}
        hasAnswered={hasAnsweredCurrent}
      />

      {/* ========================================================================= */}
      {/* 3. TRANSCRIPT TIMELINE & SPEAKER LABELS (PRACTICE ONLY, NO LEAK IN MOCK)  */}
      {/* ========================================================================= */}
      {policy.showTranscript && revealedTranscript && (
        <div
          data-testid="group-transcript-container"
          className="p-4 bg-cyan-950/30 border border-cyan-500/30 rounded-2xl text-xs text-cyan-200 space-y-2.5 animate-fade-in shadow-inner"
        >
          <div className="flex items-center justify-between font-bold text-cyan-300 pb-2 border-b border-cyan-500/20">
            <span className="flex items-center gap-1.5">
              <Headphones className="w-4 h-4 text-cyan-400" />
              <span>Kịch Bản Lời Thoại (Dialogue Transcript):</span>
            </span>
            <span className="text-[10px] text-cyan-400/80 font-normal">Chế độ Luyện Tập</span>
          </div>

          {group.transcript.segments && group.transcript.segments.length > 0 ? (
            <div className="space-y-2 pt-1 font-serif text-slate-200">
              {group.transcript.segments.map((seg, sIdx) => {
                const isActive = policy.showHighlight && engineState.activeSegmentIndex === sIdx;
                const canSeekSegment = policy.allowSeek && onSeek && typeof seg.startMs === 'number';

                return (
                  <div
                    key={seg.id || `seg_${sIdx}`}
                    role={canSeekSegment ? 'button' : undefined}
                    tabIndex={canSeekSegment ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (canSeekSegment && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onSeek(seg.startMs!);
                      }
                    }}
                    onClick={() => {
                      if (canSeekSegment) {
                        onSeek(seg.startMs!);
                      }
                    }}
                    className={`p-2 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 ${
                      canSeekSegment ? 'cursor-pointer hover:bg-slate-800/80' : ''
                    } ${
                      isActive
                        ? 'bg-amber-500/15 border border-amber-500/40 text-white font-medium ring-1 ring-amber-400/30'
                        : 'text-slate-300 border border-transparent'
                    }`}
                    title={canSeekSegment ? 'Nhấp hoặc nhấn Enter để nghe lại từ đoạn này' : undefined}
                  >
                    <div className="flex items-baseline gap-2">
                      {seg.speaker && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase tracking-wider shrink-0 border ${getSpeakerStyle(
                            seg.speaker
                          )}`}
                        >
                          {seg.speaker}
                        </span>
                      )}
                      <p className="flex-1 leading-relaxed">{seg.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="italic font-serif leading-relaxed text-slate-200 whitespace-pre-line pt-1">
              "{group.transcript.fullText}"
            </p>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. VISUAL GRAPHIC / IMAGE (IF PRESENT IN GROUP OR QUESTION)               */}
      {/* ========================================================================= */}
      {imageUrl && !imageError && (
        <div className="relative rounded-3xl overflow-hidden border-2 border-slate-750 bg-slate-950 shadow-xl max-h-[380px] flex items-center justify-center group">
          {/* ACCESSIBILITY INVARIANT: Alt text không tiết lộ đáp án */}
          <img
            src={imageUrl}
            alt={`Hình ảnh minh họa đi kèm câu hỏi nhóm ${isPart3 ? 'Part 3' : 'Part 4'}`}
            className="w-full h-auto max-h-[380px] object-contain rounded-2xl transition-transform duration-500 group-hover:scale-[1.01]"
            loading="eager"
            onError={() => setImageError(true)}
          />
          <div className="absolute top-3 left-3 px-3 py-1 bg-slate-950/80 backdrop-blur-md border border-slate-700/80 rounded-xl text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>Hình ảnh / biểu đồ đoạn nghe</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CHILD QUESTIONS NAVIGATION PILLS / TABS                                */}
      {/* ========================================================================= */}
      <div className="p-3 bg-slate-850/80 border border-slate-750 rounded-2xl space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <span className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Các câu hỏi của đoạn này ({childQuestions.length} câu):</span>
          </span>
          <span className="text-[11px] text-slate-400 font-normal">
            Bấm chọn câu để chuyển câu hỏi nhanh
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Điều hướng các câu hỏi trong đoạn nghe"
          className="grid grid-cols-3 gap-2"
        >
          {childQuestions.map((q, idx) => {
            const isCurrent = idx === questionIndexWithinGroup;
            const ans = userAnswers[q.id];
            const isAnswered = Boolean(ans);

            return (
              <button
                key={q.id}
                role="tab"
                type="button"
                aria-selected={isCurrent}
                aria-label={`Câu hỏi ${idx + 1}${isAnswered ? ` (Đã chọn ${ans})` : ' (Chưa trả lời)'}`}
                onClick={() => onNavigateToChildQuestion(idx)}
                className={`min-h-[44px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  isCurrent
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 font-black ring-2 ring-amber-400'
                    : isAnswered
                    ? 'bg-slate-800 text-slate-200 border-emerald-500/30 hover:bg-slate-750 hover:border-emerald-500/50'
                    : 'bg-slate-850 text-slate-400 border-slate-750 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                <span>Câu {idx + 1}</span>
                {isAnswered ? (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                      isCurrent
                        ? 'bg-slate-950 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {ans}
                  </span>
                ) : (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isCurrent ? 'bg-slate-950' : 'bg-slate-600'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. CURRENT CHILD QUESTION STEM & OPTIONS (A, B, C, D)                      */}
      {/* ========================================================================= */}
      <div className="space-y-4 pt-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
            <span>Câu {globalQuestionNumber}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400 font-normal">
              (Câu {questionIndexWithinGroup + 1} trong đoạn {isPart3 ? 'hội thoại' : 'bài nói'})
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
            {currentQuestion.questionText}
          </h3>
        </div>

        {/* 4 Choices */}
        {currentQuestion.options && currentQuestion.options.length > 0 && (
          <div className="grid grid-cols-1 gap-2.5">
            {currentQuestion.options.map((option, idx) => {
              const choiceLetter = choiceLetters[idx];
              const isSelected = selectedAnswer === choiceLetter;

              return (
                <button
                  key={choiceLetter}
                  type="button"
                  onClick={() => onSelectAnswer(choiceLetter)}
                  className={`min-h-[52px] p-4 rounded-2xl border text-left text-xs sm:text-sm font-medium transition-all duration-150 flex items-center gap-3 active:scale-[0.99] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400 text-amber-300 font-bold shadow-md shadow-amber-500/10 ring-1 ring-amber-400/40'
                      : 'bg-slate-850 hover:bg-slate-800 border-slate-750 text-slate-300'
                  }`}
                  aria-label={`Lựa chọn ${choiceLetter}: ${option}`}
                  aria-pressed={isSelected}
                >
                  <span
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {choiceLetter}
                  </span>
                  <span className="flex-1 leading-snug">{option}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Sub-navigation within group (Previous / Next Question in this group) */}
        <div className="flex items-center justify-between pt-2">
          {questionIndexWithinGroup > 0 ? (
            <button
              type="button"
              onClick={() => onNavigateToChildQuestion(questionIndexWithinGroup - 1)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Câu trước trong đoạn</span>
            </button>
          ) : (
            <div />
          )}

          {questionIndexWithinGroup < childQuestions.length - 1 ? (
            <button
              type="button"
              onClick={() => onNavigateToChildQuestion(questionIndexWithinGroup + 1)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition-colors ml-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <span>Câu tiếp trong đoạn</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
};
