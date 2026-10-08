import React from 'react';
import {
  Group,
  Office,
  Deliverable,
  Task,
  GroupTaskSubmission,
  StudentMember,
} from '../../types';
import {
  Users,
  Clock,
  FileCheck,
  Award,
  AlertCircle,
  ArrowRight,
  Upload,
  Eye,
  CheckCircle2,
  Calendar,
  Building2,
  Sparkles,
} from 'lucide-react';
import { formatDateTime, isDeadlinePassed } from '../../utils/dateUtils';
import { SubmissionStatusBadge } from '../common/Badge';

interface StudentDashboardViewProps {
  currentStudent: StudentMember;
  group: Group;
  office?: Office;
  deliverables: Deliverable[];
  tasks: Task[];
  submissions: GroupTaskSubmission[];
  onNavigateToTab: (tab: any) => void;
  onOpenSubmissionUpload: (taskId: string) => void;
  onOpenDocumentViewer: (submissionId: string) => void;
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  currentStudent,
  group,
  office,
  deliverables,
  tasks,
  submissions,
  onNavigateToTab,
  onOpenSubmissionUpload,
  onOpenDocumentViewer,
}) => {
  const subOffice = office?.subOffices.find((s) => s.id === group.subOfficeId);

  const publishedTasks = tasks.filter(
    (t) => t.status === 'published' && !t.isArchived
  );

  // Group task status counts
  const tasksWithStatus = publishedTasks.map((t) => {
    const sub = submissions.find(
      (s) => s.groupId === group.id && s.taskId === t.id
    );
    const hasVersions = Boolean(sub && sub.versions && sub.versions.length > 0);
    const isSubmitted = Boolean(
      sub && (
        sub.status === 'submitted' ||
        sub.status === 'graded_awaiting_return' ||
        sub.status === 'returned' ||
        hasVersions ||
        Boolean(sub.submittedAt)
      )
    );
    const isReturned = sub?.status === 'returned';
    const isUnderReview = isSubmitted && !isReturned;
    const isOverdue = !isSubmitted && isDeadlinePassed(t.deadline);

    return {
      task: t,
      submission: sub,
      isSubmitted,
      isReturned,
      isUnderReview,
      isOverdue,
    };
  });

  const returnedSubmissions = submissions.filter(
    (s) => s.groupId === group.id && s.status === 'returned'
  );

  const pendingTasks = tasksWithStatus.filter((item) => !item.isSubmitted);

  // Overall group score calculation
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
      {/* Proposal Summary Banner */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              {office?.code || 'Office'} &bull; {subOffice?.code || 'Sub-office'}
            </span>
            <span className="text-xs font-medium text-indigo-300">
              Logged in as <strong>{currentStudent.firstName} {currentStudent.lastName}</strong> ({currentStudent.roles.join(', ')})
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug">
            {group.title}
          </h2>

          <div className="mt-3 flex items-center gap-4 text-xs text-indigo-200 flex-wrap">
            <span><strong>Client(s):</strong> {group.clientNames.join(', ')}</span>
            <span>&bull;</span>
            <span><strong>Proponents ({group.members.length}):</strong> {group.members.map(m => `${m.firstName} ${m.lastName}`).join(', ')}</span>
          </div>
        </div>
      </div>

      {/* Quick KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigateToTab('deliverables')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigateToTab('deliverables');
            }
          }}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
          title="Click to view all deliverables and tasks"
        >
          <div>
            <span className="text-xs font-medium text-slate-500 block">Active Tasks</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {publishedTasks.length}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {pendingTasks.length} pending submission
            </span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigateToTab('scores')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigateToTab('scores');
            }
          }}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
          title="Click to view returned evaluations and rubric feedback"
        >
          <div>
            <span className="text-xs font-medium text-slate-500 block">Evaluated & Returned</span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block">
              {returnedSubmissions.length}
            </span>
            <span className="text-[11px] text-emerald-700/80 mt-0.5 block">
              Feedback available to view
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigateToTab('scores')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigateToTab('scores');
            }
          }}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
          title="Click to view detailed grading breakdown"
        >
          <div>
            <span className="text-xs font-medium text-slate-500 block">Cumulative Score</span>
            <span className="text-2xl font-bold text-indigo-600 mt-1 block font-mono">
              {totalMax > 0 ? `${totalEarned.toFixed(1)} / ${totalMax}` : 'N/A'}
            </span>
            <span className="text-[11px] text-indigo-700/80 mt-0.5 block">
              {totalMax > 0 ? `${((totalEarned / totalMax) * 100).toFixed(1)}% weighted average` : 'No returned grades yet'}
            </span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Active Tasks & Action Items */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Upcoming Deliverables & Tasks
            </h3>
            <span className="text-xs text-slate-500">
              Submit your proposal drafts, monitor deadlines, and comply with late policies.
            </span>
          </div>
          <button
            onClick={() => onNavigateToTab('deliverables')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            View All Tasks &rarr;
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {tasksWithStatus.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              No published tasks yet.
            </div>
          ) : (
            tasksWithStatus.map(({ task, submission, isSubmitted, isReturned, isUnderReview, isOverdue }) => {
              const latestVer = submission?.versions[submission.versions.length - 1];

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-4 flex-wrap ${
                    isOverdue
                      ? 'bg-rose-50/40 border-rose-200'
                      : isReturned
                      ? 'bg-emerald-50/30 border-emerald-200'
                      : isUnderReview
                      ? 'bg-amber-50/30 border-amber-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="space-y-1 flex-1 min-w-[280px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900">
                        {task.name}
                      </h4>
                      {task.isRevisionTask && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                          Revision Task
                        </span>
                      )}
                      <SubmissionStatusBadge status={submission?.status || 'not_submitted'} />
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2">
                      {task.instructions}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-slate-500 pt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        Deadline: <strong>{formatDateTime(task.deadline)}</strong>
                      </span>
                      <span>&bull;</span>
                      <span>Max Score: {task.maxScore} pts</span>
                      {submission?.grade && (
                        <>
                          <span>&bull;</span>
                          <span className="font-semibold text-emerald-700">
                            Score: {submission.grade.finalScore.toFixed(1)} / {task.maxScore}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isReturned && submission ? (
                      <button
                        onClick={() => onOpenDocumentViewer(submission.id)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Feedback & Rubric
                      </button>
                    ) : isSubmitted && submission ? (
                      <button
                        onClick={() => onOpenDocumentViewer(submission.id)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Submission {latestVer ? `v${latestVer.version}` : ''}
                      </button>
                    ) : (
                      <button
                        onClick={() => onOpenSubmissionUpload(task.id)}
                        className={`px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 ${
                          isOverdue
                            ? 'bg-rose-600 hover:bg-rose-700'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Submit Deliverable
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Recent Feedback Section */}
      {returnedSubmissions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Recent Evaluated Submissions
              </h3>
              <span className="text-xs text-slate-500">
                Review instructor remarks, rubric point allocations, and pinned document annotations.
              </span>
            </div>
            <button
              onClick={() => onNavigateToTab('scores')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              All Scores & Feedback &rarr;
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {returnedSubmissions.map((sub) => {
              const t = tasks.find((item) => item.id === sub.taskId);
              return (
                <div
                  key={sub.id}
                  className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-900 block">
                      {t?.name || 'Task'}
                    </span>
                    <div className="text-xs text-slate-600">
                      <strong>Instructor Feedback:</strong>{' '}
                      {sub.grade?.overallRemarks || 'No comments specified.'}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono font-bold text-indigo-700">
                      {sub.grade?.finalScore.toFixed(1)} / {t?.maxScore}
                    </div>
                    <button
                      onClick={() => onOpenDocumentViewer(sub.id)}
                      className="mt-2 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-white rounded border border-indigo-200 transition-colors inline-block"
                    >
                      Inspect Viewer &rarr;
                    </button>
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
