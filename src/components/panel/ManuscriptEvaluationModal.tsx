import React, { useState } from 'react';
import {
  Group,
  DefenseAttempt,
  UserAccount,
  ManuscriptEvaluation,
  ManuscriptItemRating,
} from '../../types';
import {
  MANUSCRIPT_SECTIONS,
  TOTAL_MANUSCRIPT_ITEMS_COUNT,
  RATING_SCALE_OPTIONS,
} from '../../data/ratingCriteria';
import { formatDateTime } from '../../utils/dateUtils';
import {
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Clock,
  X,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface ManuscriptEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  attempt: DefenseAttempt;
  group: Group;
  currentUser: UserAccount;
  onSaveEvaluation: (attemptId: string, evaluation: ManuscriptEvaluation) => void;
}

export const ManuscriptEvaluationModal: React.FC<ManuscriptEvaluationModalProps> = ({
  isOpen,
  onClose,
  attempt,
  group,
  currentUser,
  onSaveEvaluation,
}) => {
  const existingEval = attempt.manuscriptEvaluations?.[currentUser.id];

  // Ratings map: itemId -> { rate: number, comment?: string }
  const [ratings, setRatings] = useState<Record<string, ManuscriptItemRating>>(() => {
    if (existingEval?.ratings) {
      return { ...existingEval.ratings };
    }
    const initial: Record<string, ManuscriptItemRating> = {};
    return initial;
  });

  const [overallRemarks, setOverallRemarks] = useState<string>(
    existingEval?.overallRemarks || ''
  );
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Rating progress calculation
  const ratedItemKeys = Object.keys(ratings).filter((k) => ratings[k]?.rate >= 1 && ratings[k]?.rate <= 5);
  const ratedCount = ratedItemKeys.length;
  const isAllItemsRated = ratedCount === TOTAL_MANUSCRIPT_ITEMS_COUNT;

  const totalScore = ratedItemKeys.reduce(
    (acc, k) => acc + (ratings[k]?.rate || 0),
    0
  );
  const averageScore =
    ratedCount > 0 ? Number((totalScore / ratedCount).toFixed(2)) : 0;

  const handleRateItem = (itemId: string, score: number) => {
    setRatings((prev) => ({
      ...prev,
      [itemId]: {
        itemId,
        rate: score,
        comment: prev[itemId]?.comment || '',
      },
    }));
    setValidationError(null);
  };

  const handleCommentItem = (itemId: string, comment: string) => {
    setRatings((prev) => ({
      ...prev,
      [itemId]: {
        itemId,
        rate: prev[itemId]?.rate || 0,
        comment,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAllItemsRated) {
      setValidationError(
        `Please rate all 33 manuscript items before submitting. Currently rated: ${ratedCount}/33.`
      );
      return;
    }

    const evaluation: ManuscriptEvaluation = {
      panelMemberId: currentUser.id,
      panelMemberName: `${currentUser.academicTitle ? currentUser.academicTitle + ' ' : ''}${currentUser.firstName} ${currentUser.lastName}`,
      evaluatedAt: new Date().toISOString(),
      ratings,
      totalScore,
      averageScore,
      overallRemarks: overallRemarks.trim() || undefined,
    };

    onSaveEvaluation(attempt.id, evaluation);
    onClose();
  };

  const activeSection = MANUSCRIPT_SECTIONS[activeChapterIndex];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col my-auto overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-6 flex items-start justify-between gap-4 border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                Official Manuscript Rating Sheet
              </span>
              <span className="text-xs text-slate-400">
                Attempt {attempt.attemptNumber} &bull; {attempt.defenseDate}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold mt-1.5 text-white">
              Manuscript Rating Sheet
            </h2>
            <div className="text-xs text-slate-300 mt-1 space-y-0.5">
              <p className="line-clamp-1">
                <strong className="text-slate-200">Capstone Project Title:</strong> {group.title}
              </p>
              <p className="text-slate-400">
                <strong className="text-slate-300">Proponents:</strong>{' '}
                {group.members.map((m) => `${m.firstName} ${m.lastName}`).join(', ')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Metrics Header Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                Evaluation Progress
              </div>
              <div className="text-xs font-bold text-slate-800 flex items-center gap-2 mt-0.5">
                <span className={isAllItemsRated ? 'text-emerald-600' : 'text-orange-600'}>
                  {ratedCount} of {TOTAL_MANUSCRIPT_ITEMS_COUNT} items rated
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600">
                  {Math.round((ratedCount / TOTAL_MANUSCRIPT_ITEMS_COUNT) * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide text-right">
                Total Score
              </div>
              <div className="text-base font-bold text-orange-600 mt-0.5 text-right">
                {totalScore} <span className="text-xs text-slate-400 font-normal">/ 165</span>
              </div>
            </div>
            <div className="border-l border-slate-200 pl-5">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide text-right">
                Average Rating
              </div>
              <div className="text-base font-bold text-slate-800 mt-0.5 text-right">
                {averageScore > 0 ? averageScore.toFixed(2) : '—'}{' '}
                <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chapter Tabs Navigation */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 overflow-x-auto flex items-center gap-1 shrink-0 no-scrollbar">
          {MANUSCRIPT_SECTIONS.map((sec, sIdx) => {
            const sectionItemIds = sec.items.map((it) => it.id);
            const sectionRatedCount = sectionItemIds.filter(
              (id) => ratings[id]?.rate >= 1 && ratings[id]?.rate <= 5
            ).length;
            const isSectionComplete = sectionRatedCount === sec.items.length;
            const isActive = activeChapterIndex === sIdx;

            return (
              <button
                key={sec.sectionCode}
                onClick={() => setActiveChapterIndex(sIdx)}
                className={`py-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'border-orange-600 text-orange-700 bg-orange-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{sec.chapterTitle.split(' – ')[0]}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSectionComplete
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {sectionRatedCount}/{sec.items.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 no-scrollbar">
          {validationError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Active Chapter Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {activeSection.chapterTitle}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Evaluate each item below from 1 (Poor) to 5 (Excellent). You can attach specific manuscript revision comments.
                </p>
              </div>
            </div>

            {/* List of Items for Active Chapter */}
            <div className="space-y-3.5">
              {activeSection.items.map((item, idx) => {
                const itemRating = ratings[item.id];
                const currentScore = itemRating?.rate || 0;
                const currentComment = itemRating?.comment || '';

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition-all ${
                      currentScore > 0
                        ? 'bg-white border-slate-200 shadow-xs'
                        : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      {/* Left: Item Label and Description */}
                      <div className="flex-1">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                          {item.label}
                        </div>
                        {item.description && (
                          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                            {item.description}
                          </p>
                        )}

                        {/* Inline Comment Field */}
                        <div className="mt-3 flex items-start gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-1 shrink-0" />
                          <input
                            type="text"
                            value={currentComment}
                            onChange={(e) => handleCommentItem(item.id, e.target.value)}
                            placeholder="Add specific comments or required revisions for this item (optional)..."
                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-orange-500 bg-white placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      {/* Right: 1-5 Rating Scale Buttons */}
                      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 self-start">
                        {RATING_SCALE_OPTIONS.map((opt) => {
                          const isSelected = currentScore === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleRateItem(item.id, opt.value)}
                              className={`px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-bold rounded-lg border transition-all flex flex-col items-center min-w-[48px] sm:min-w-[54px] ${
                                isSelected
                                  ? 'bg-orange-600 text-white border-orange-600 shadow-xs scale-105'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span className="text-sm">{opt.value}</span>
                              <span className="text-[10px] font-normal opacity-90">
                                {opt.shortLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chapter Navigation Stepper Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <button
              type="button"
              disabled={activeChapterIndex === 0}
              onClick={() => setActiveChapterIndex((prev) => Math.max(0, prev - 1))}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border ${
                activeChapterIndex === 0
                  ? 'opacity-40 cursor-not-allowed border-slate-200 text-slate-400'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              &larr; Previous Chapter
            </button>

            <span className="text-xs text-slate-500 font-medium">
              Chapter {activeChapterIndex + 1} of {MANUSCRIPT_SECTIONS.length}
            </span>

            <button
              type="button"
              disabled={activeChapterIndex === MANUSCRIPT_SECTIONS.length - 1}
              onClick={() =>
                setActiveChapterIndex((prev) => Math.min(MANUSCRIPT_SECTIONS.length - 1, prev + 1))
              }
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border ${
                activeChapterIndex === MANUSCRIPT_SECTIONS.length - 1
                  ? 'opacity-40 cursor-not-allowed border-slate-200 text-slate-400'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Next Chapter &rarr;
            </button>
          </div>

          {/* Overall Remarks & Attestation */}
          <section className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Consolidated Manuscript Remarks & Attestation
            </h4>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Overall Manuscript Remarks & General Critique
              </label>
              <textarea
                value={overallRemarks}
                onChange={(e) => setOverallRemarks(e.target.value)}
                rows={3}
                placeholder="Summary of manuscript strengths, critical issues to revise before re-submission, formatting compliance notes..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* Signature Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Name and Signature of the Panel
                </div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {currentUser.academicTitle} {currentUser.firstName} {currentUser.lastName}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Evaluator &bull; {currentUser.academicRank || 'Department of IT'}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Attestation Date
                </div>
                <div className="text-xs font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {formatDateTime(new Date().toISOString())}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-4 sm:p-5 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isAllItemsRated}
            className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-2 ${
              isAllItemsRated
                ? 'bg-orange-600 hover:bg-orange-500 cursor-pointer'
                : 'bg-slate-400 cursor-not-allowed opacity-60'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Save & Sign Manuscript Evaluation ({ratedCount}/33)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
