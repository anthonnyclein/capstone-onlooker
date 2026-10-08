import React, { useState, useMemo } from 'react';
import {
  Group,
  Office,
  Deliverable,
  Task,
  GroupTaskSubmission,
} from '../../types';
import {
  FileCheck,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  Clock,
  Layers,
  Building2,
  Users,
  CheckCircle2,
  ClockAlert,
  ArrowRight,
  Undo2,
  Trash2,
} from 'lucide-react';
import { formatDateTime, calculateDaysLate } from '../../utils/dateUtils';
import { SubmissionStatusBadge } from '../common/Badge';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { storage } from '../../services/storage';
import { authService } from '../../services/authService';
import { flushFileStore } from '../../services/fileStore';

interface SubmissionsReviewViewProps {
  submissions: GroupTaskSubmission[];
  groups: Group[];
  offices: Office[];
  deliverables: Deliverable[];
  tasks: Task[];
  onOpenDocumentViewer: (submissionId: string) => void;
}

export const SubmissionsReviewView: React.FC<SubmissionsReviewViewProps> = ({
  submissions,
  groups,
  offices,
  deliverables,
  tasks,
  onOpenDocumentViewer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('all');
  const [selectedOfficeId, setSelectedOfficeId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const [submissionToDelete, setSubmissionToDelete] = useState<GroupTaskSubmission | null>(null);
  const [removedSubmissionIds, setRemovedSubmissionIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Lookup helpers
  const getGroup = (groupId: string) => groups.find((g) => g.id === groupId);
  const getTask = (taskId: string) => tasks.find((t) => t.id === taskId);
  const getOffice = (officeId: string) => offices.find((o) => o.id === officeId);

  const handleConfirmDelete = async () => {
    if (!submissionToDelete || isProcessing) return;
    const targetId = submissionToDelete.id;
    setIsProcessing(true);
    setRemovedSubmissionIds((prev) => new Set(prev).add(targetId));
    try {
      storage.deleteSubmission(targetId);
      await fetch(`/api/review/submission/${targetId}`, {
        method: 'DELETE',
        headers: {
          ...authService.getAuthHeaders(),
        },
      }).catch(() => {});
      await flushFileStore();
    } finally {
      setIsProcessing(false);
      setSubmissionToDelete(null);
    }
  };

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      // If locally marked as removed/unsubmitted/deleted, exclude from review list immediately
      if (removedSubmissionIds.has(sub.id)) return false;

      // Unsubmitted tasks or tasks with no submitted files should not appear in the review list
      if (sub.status === 'not_submitted') return false;
      if (!sub.versions || sub.versions.length === 0) return false;

      const grp = getGroup(sub.groupId);
      const tsk = getTask(sub.taskId);

      // Search match
      const matchSearch =
        !searchTerm ||
        (grp && grp.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (grp && grp.clientNames.some((c) => c.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (tsk && tsk.name.toLowerCase().includes(searchTerm.toLowerCase()));

      // Task filter
      const matchTask = selectedTaskId === 'all' || sub.taskId === selectedTaskId;

      // Office filter
      const matchOffice =
        selectedOfficeId === 'all' || (grp && grp.officeId === selectedOfficeId);

      // Status filter
      const matchStatus =
        selectedStatus === 'all' || sub.status === selectedStatus;

      return matchSearch && matchTask && matchOffice && matchStatus;
    });
  }, [submissions, searchTerm, selectedTaskId, selectedOfficeId, selectedStatus, groups, tasks, removedSubmissionIds]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Submission Evaluation & Annotations
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Review submitted proposal drafts, pin visual corrections, evaluate interactive rubrics, and publish grades.
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search proposal or task..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Task selector */}
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg py-1.5 px-2.5 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Tasks</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Office selector */}
          <select
            value={selectedOfficeId}
            onChange={(e) => setSelectedOfficeId(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg py-1.5 px-2.5 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Offices</option>
            {offices.map((off) => (
              <option key={off.id} value={off.id}>
                {off.code}
              </option>
            ))}
          </select>

          {/* Status selector */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg py-1.5 px-2.5 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted (Awaiting Review)</option>
            <option value="graded_awaiting_return">Graded</option>
            <option value="returned">Returned to Group</option>
            <option value="draft">Student In-Progress Draft</option>
          </select>
        </div>
      </div>

      {/* Submissions List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredSubmissions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            No submissions found matching the criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Capstone Group & Title</th>
                  <th className="py-3 px-4">Task</th>
                  <th className="py-3 px-4">Version & Submitted At</th>
                  <th className="py-3 px-4">Late Status</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubmissions.map((sub) => {
                  const grp = getGroup(sub.groupId);
                  const tsk = getTask(sub.taskId);
                  const off = grp ? getOffice(grp.officeId) : null;
                  const latestVer = sub.versions[sub.versions.length - 1];

                  // Calculate lateness
                  const isLate =
                    latestVer && tsk
                      ? calculateDaysLate(latestVer.submittedAt, tsk.deadline) > 0
                      : false;
                  const daysLate =
                    latestVer && tsk
                      ? calculateDaysLate(latestVer.submittedAt, tsk.deadline)
                      : 0;

                  return (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 leading-snug line-clamp-2">
                          {grp?.title || 'Unknown Group'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <span>{off?.code}</span>
                          <span>&bull;</span>
                          <span>{grp?.clientNames[0]}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-medium text-slate-800 block">
                          {tsk?.name || 'Task'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Max {tsk?.maxScore} pts
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {latestVer ? (
                          <div>
                            <span className="font-semibold text-slate-800">
                              Version {latestVer.version}
                            </span>
                            <span className="text-[11px] text-slate-400 block">
                              {formatDateTime(latestVer.submittedAt)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No files yet</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isLate ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <ClockAlert className="w-3 h-3" />
                            {daysLate} day(s) late
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            On Time
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <SubmissionStatusBadge status={sub.status} />
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {sub.grade ? (
                          <div className="font-mono font-bold text-indigo-700">
                            {sub.grade.finalScore.toFixed(1)} / {tsk?.maxScore}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">-- / {tsk?.maxScore}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenDocumentViewer(sub.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title={sub.status === 'returned' || sub.status === 'graded_awaiting_return' || sub.grade ? 'View evaluated student work and rubric assessment' : 'Open Document Viewer to grade and annotate'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {sub.status === 'returned' || sub.status === 'graded_awaiting_return' || sub.grade ? 'View Graded Work' : 'Grade / Annotate'}
                          </button>
                          {sub.status !== 'not_submitted' && sub.versions && sub.versions.length > 0 && (
                            <button
                              onClick={() => setSubmissionToDelete(sub)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg shadow-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Delete task submission – removes submission as if never submitted"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Submission Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!submissionToDelete}
        onClose={() => setSubmissionToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Task Submission"
        message={`Are you sure you want to permanently delete this submission for "${getGroup(submissionToDelete?.groupId || '')?.title}"? All submitted files, versions, and grades will be removed. On the student's end, it will be as if they have never submitted, and they will be able to submit.`}
        confirmLabel={isProcessing ? 'Deleting...' : 'Delete Submission'}
        isDestructive={true}
        icon="warning"
      />
    </div>
  );
};
