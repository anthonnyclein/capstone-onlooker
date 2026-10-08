import React, { useState } from 'react';
import {
  Group,
  DefenseAttempt,
  UserAccount,
  PresentationEvaluation,
  PresentationGroupRating,
  PresentationIndividualRating,
} from '../../types';
import {
  PRESENTATION_GROUP_ITEMS,
  RATING_SCALE_OPTIONS,
} from '../../data/ratingCriteria';
import { formatDateTime } from '../../utils/dateUtils';
import {
  CheckCircle2,
  AlertCircle,
  Award,
  Users,
  Clock,
  FileText,
  X,
  Sparkles,
} from 'lucide-react';

interface PresentationEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  attempt: DefenseAttempt;
  group: Group;
  currentUser: UserAccount;
  onSaveEvaluation: (attemptId: string, evaluation: PresentationEvaluation) => void;
}

export const PresentationEvaluationModal: React.FC<PresentationEvaluationModalProps> = ({
  isOpen,
  onClose,
  attempt,
  group,
  currentUser,
  onSaveEvaluation,
}) => {
  const existingEval = attempt.presentationEvaluations?.[currentUser.id];

  // Group Ratings state (8 items, 1-5)
  const [groupRatings, setGroupRatings] = useState<PresentationGroupRating>(() => {
    if (existingEval?.groupRating) {
      return { ...existingEval.groupRating };
    }
    return {
      clarityOfPresentation: 0,
      understandingOfProject: 0,
      engagementAndCommunication: 0,
      useOfVisualAids: 0,
      handlingOfQA: 0,
      teamCollaboration: 0,
      timeManagement: 0,
      professionalismAndConfidence: 0,
    };
  });

  // Individual Ratings state (each student, 1-5)
  const [individualRatings, setIndividualRatings] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    if (existingEval?.individualRatings) {
      existingEval.individualRatings.forEach((ir) => {
        map[ir.studentId] = ir.rate;
      });
    } else {
      group.members.forEach((m) => {
        map[m.id] = 0;
      });
    }
    return map;
  });

  const [comments, setComments] = useState<string>(existingEval?.comments || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculation helpers
  const groupScoresArray = Object.values(groupRatings).filter((val) => val > 0);
  const totalGroupScore = Object.values(groupRatings).reduce((acc, curr) => acc + (curr || 0), 0);
  const averageGroupScore =
    groupScoresArray.length > 0
      ? Number((totalGroupScore / PRESENTATION_GROUP_ITEMS.length).toFixed(2))
      : 0;

  const isGroupRatingComplete = PRESENTATION_GROUP_ITEMS.every(
    (item) => groupRatings[item.id] >= 1 && groupRatings[item.id] <= 5
  );

  const isIndividualRatingComplete = group.members.every(
    (m) => (individualRatings[m.id] || 0) >= 1 && (individualRatings[m.id] || 0) <= 5
  );

  const handleGroupRate = (
    itemId: keyof PresentationGroupRating,
    score: number
  ) => {
    setGroupRatings((prev) => ({ ...prev, [itemId]: score }));
    setValidationError(null);
  };

  const handleIndividualRate = (studentId: string, score: number) => {
    setIndividualRatings((prev) => ({ ...prev, [studentId]: score }));
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isGroupRatingComplete) {
      setValidationError('Please rate all 8 group presentation criteria (1-5).');
      return;
    }

    if (!isIndividualRatingComplete) {
      setValidationError('Please provide an individual rating (1-5) for every student proponent.');
      return;
    }

    const indRatingsArray: PresentationIndividualRating[] = group.members.map((m) => ({
      studentId: m.id,
      studentName: `${m.firstName} ${m.lastName}`,
      rate: individualRatings[m.id] || 3,
    }));

    const evaluation: PresentationEvaluation = {
      panelMemberId: currentUser.id,
      panelMemberName: `${currentUser.academicTitle ? currentUser.academicTitle + ' ' : ''}${currentUser.firstName} ${currentUser.lastName}`,
      evaluatedAt: new Date().toISOString(),
      groupRating: groupRatings,
      individualRatings: indRatingsArray,
      totalGroupScore,
      averageGroupScore,
      comments: comments.trim() || undefined,
    };

    onSaveEvaluation(attempt.id, evaluation);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col my-auto overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-6 flex items-start justify-between gap-4 border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Award className="w-3 h-3" />
                Official Evaluation Form
              </span>
              <span className="text-xs text-slate-400">
                Attempt {attempt.attemptNumber} &bull; {attempt.defenseDate} at {attempt.defenseTime}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold mt-1.5 text-white">
              Presentation Rating Sheet
            </h2>
            <p className="text-xs text-slate-300 mt-1 line-clamp-1">
              <strong className="text-slate-200">Capstone Project Title:</strong> {group.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 no-scrollbar">
          {/* Validation Banner */}
          {validationError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Quick Stats Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Evaluator / Panelist
              </div>
              <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                {currentUser.academicTitle} {currentUser.firstName} {currentUser.lastName}
                {attempt.leadPanelId === currentUser.id && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">
                    Lead Panel
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {currentUser.academicRank || 'Department of Information Technology'}
              </div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Group Raw Score
                </div>
                <div className="text-lg font-bold text-orange-600 mt-0.5">
                  {totalGroupScore} <span className="text-xs text-slate-400 font-normal">/ 40</span>
                </div>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Group Average
                </div>
                <div className="text-lg font-bold text-slate-800 mt-0.5">
                  {averageGroupScore > 0 ? averageGroupScore.toFixed(2) : '—'}{' '}
                  <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Group Rating */}
          <section className="space-y-3">
            <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  Group Rating (8 Criteria)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 ml-8">
                  Rate each criterion from 1 (Poor) to 5 (Excellent). All criteria are mandatory.
                </p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                isGroupRatingComplete
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {groupScoresArray.length}/8 Rated
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {PRESENTATION_GROUP_ITEMS.map((item, idx) => {
                const currentScore = groupRatings[item.id];
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                      currentScore > 0
                        ? 'bg-white border-slate-200 shadow-xs'
                        : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 pr-2">
                        <div className="text-xs sm:text-sm font-bold text-slate-900">
                          {idx + 1}. {item.title}
                        </div>
                        <ul className="mt-1 space-y-0.5 text-xs text-slate-600 list-disc list-inside">
                          {item.bulletPoints.map((bp, bIdx) => (
                            <li key={bIdx} className="leading-relaxed">
                              {bp}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* 1-5 Rating Scale Buttons */}
                      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 self-start sm:self-center">
                        {RATING_SCALE_OPTIONS.map((opt) => {
                          const isSelected = currentScore === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleGroupRate(item.id, opt.value)}
                              className={`px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-bold rounded-lg border transition-all flex flex-col items-center min-w-[48px] sm:min-w-[56px] ${
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
          </section>

          {/* Section 2: Overall Individual Rating */}
          <section className="space-y-3 pt-2">
            <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  Overall Individual Rating
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 ml-8">
                  Rate each student proponent's presentation, Q&A mastery, and poise (1 to 5).
                </p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                isIndividualRatingComplete
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {Object.values(individualRatings).filter((v) => v > 0).length}/{group.members.length} Rated
              </span>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {group.members.map((member, mIdx) => {
                const memberScore = individualRatings[member.id] || 0;
                return (
                  <div
                    key={member.id}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                  >
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>{mIdx + 1}. {member.firstName} {member.lastName}</span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          (@{member.username})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {member.roles.map((r) => (
                          <span
                            key={r}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5">
                      {RATING_SCALE_OPTIONS.map((opt) => {
                        const isSelected = memberScore === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleIndividualRate(member.id, opt.value)}
                            className={`px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-bold rounded-lg border transition-all flex flex-col items-center min-w-[48px] sm:min-w-[56px] ${
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
                );
              })}
            </div>
          </section>

          {/* Section 3: Optional Panel Comments & Signature */}
          <section className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center">
                3
              </span>
              Panel Comments & Attestation
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Oral Presentation Notes / Recommendations (Optional)
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={2}
                placeholder="Record specific verbal feedback, presentation commendations, or areas for improvement..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* Signature Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Panelist Electronic Signature
                </div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {currentUser.academicTitle} {currentUser.firstName} {currentUser.lastName}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Attesting panelist &bull; {currentUser.academicRank || 'Department of IT'}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Timestamp
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
            disabled={!isGroupRatingComplete || !isIndividualRatingComplete}
            className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-2 ${
              isGroupRatingComplete && isIndividualRatingComplete
                ? 'bg-orange-600 hover:bg-orange-500 cursor-pointer'
                : 'bg-slate-400 cursor-not-allowed opacity-60'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save & Sign Presentation Evaluation</span>
          </button>
        </div>
      </div>
    </div>
  );
};
