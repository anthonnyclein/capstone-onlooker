import React, { useState } from 'react';
import {
  Group,
  Deliverable,
  Task,
  GroupTaskSubmission,
} from '../../types';
import {
  Award,
  Eye,
  ClockAlert,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import { formatDateTime } from '../../utils/dateUtils';

interface StudentFeedbackViewProps {
  group: Group;
  deliverables: Deliverable[];
  tasks: Task[];
  submissions: GroupTaskSubmission[];
  onOpenDocumentViewer: (submissionId: string) => void;
}

export const StudentFeedbackView: React.FC<StudentFeedbackViewProps> = ({
  group,
  deliverables,
  tasks,
  submissions,
  onOpenDocumentViewer,
}) => {
  const returnedSubmissions = submissions.filter(
    (s) => s.groupId === group.id && s.status === 'returned' && s.grade
  );

  // Overall statistics
  const totalEarned = returnedSubmissions.reduce(
    (sum, s) => sum + (s.grade?.finalScore || 0),
    0
  );
  const totalMax = returnedSubmissions.reduce((sum, s) => {
    const t = tasks.find((item) => item.id === s.taskId);
    return sum + (t?.maxScore || 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Returned Scores & Formative Feedback
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Review instructor rubric performance levels, score calculations, evaluation remarks, and late penalty calculations.
        </p>
      </div>

      {returnedSubmissions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-xs">
          <Award className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700">
            No returned scores yet
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Once your instructor finishes evaluating and returns your submissions, your scores, rubric scorecard, and annotated feedback will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Overall Summary Banner */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Cumulative Evaluated Milestones
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-mono font-bold text-indigo-600">
                  {totalEarned.toFixed(1)}
                </span>
                <span className="text-sm font-mono text-slate-500">
                  / {totalMax} Possible Points
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Overall Assessment Percentage
              </span>
              <span className="text-2xl font-bold text-emerald-600 mt-1 block">
                {totalMax > 0 ? `${((totalEarned / totalMax) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
          </div>

          {/* Submissions List */}
          <div className="space-y-5">
            {returnedSubmissions.map((sub) => {
              const task = tasks.find((t) => t.id === sub.taskId);
              const deliverable = deliverables.find((d) => d.id === sub.deliverableId);
              const grade = sub.grade!;
              const rubricToUse = grade.frozenRubric || deliverable?.rubric || [];

              return (
                <div
                  key={sub.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
                >
                  {/* Task Assessment Summary Header */}
                  <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {deliverable?.name}
                        </span>
                        {grade.daysLate > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded">
                            {grade.daysLate} day(s) late
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {task?.name}
                      </h3>
                      <span className="text-xs text-slate-500">
                        Returned on: {grade.returnedAt ? formatDateTime(grade.returnedAt) : 'Recently'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 block uppercase font-bold">
                          Final Score
                        </span>
                        <span className="text-xl font-mono font-bold text-indigo-700">
                          {grade.finalScore.toFixed(1)} / {task?.maxScore} pts
                        </span>
                      </div>

                      <button
                        onClick={() => onOpenDocumentViewer(sub.id)}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect Document & Annotations
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-5">
                    {/* General Remarks */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                        <MessageSquare className="w-4 h-4 text-indigo-600" />
                        General Instructor Feedback & Revision Notes
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {grade.overallRemarks || 'No additional general comments specified.'}
                      </p>
                    </div>

                    {/* Score Calculation Breakdown */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Score Calculation Breakdown
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block">Scaled Task Raw Score:</span>
                          <span className="text-base font-mono font-bold text-slate-900 mt-1 block">
                            {grade.taskRawScore.toFixed(1)} pts
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            Rubric Raw: {grade.rubricRawScore} / {grade.rubricMaxScore} pts
                          </span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block">Late Submission Deduction:</span>
                          <span className={`text-base font-mono font-bold mt-1 block ${grade.lateDeduction > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {grade.lateDeduction > 0 ? `-${grade.lateDeduction.toFixed(1)}` : '0.0'} pts
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            {grade.daysLate} day(s) late
                          </span>
                        </div>

                        <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-200">
                          <span className="text-indigo-900 font-medium block">Final Task Grade:</span>
                          <span className="text-base font-mono font-bold text-indigo-700 mt-1 block">
                            {grade.finalScore.toFixed(1)} / {task?.maxScore} pts
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Rubric Scorecard */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        Detailed Rubric Scorecard
                      </h4>

                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                            <tr>
                              <th className="py-2.5 px-4">Criterion</th>
                              <th className="py-2.5 px-4">Performance Level Selected</th>
                              <th className="py-2.5 px-4 text-right">Points Earned</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rubricToUse.map((crit) => {
                              const critAssessment = grade.criterionAssessments[crit.id];

                              return (
                                <tr key={crit.id} className="hover:bg-slate-50/60">
                                  <td className="py-3 px-4 max-w-sm">
                                    <div className="font-bold text-slate-900">
                                      {crit.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                      {crit.description}
                                    </div>
                                  </td>

                                  <td className="py-3 px-4">
                                    {critAssessment ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 font-semibold text-xs">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                                        {critAssessment.levelName} ({Math.round(critAssessment.percentage * 100)}%)
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 italic">Not evaluated</span>
                                    )}
                                  </td>

                                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-xs">
                                    {critAssessment ? critAssessment.score.toFixed(1) : 0} / {crit.maxPoints} pts
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
