import React from 'react';
import {
  Group,
  Deliverable,
  Task,
  GroupTaskSubmission,
} from '../../types';
import {
  FileCheck,
  Eye,
  Calendar,
  Clock,
  User,
  Layers,
  FileText,
  MessageSquare,
  AlertCircle,
  FolderGit2,
} from 'lucide-react';
import { formatDateTime } from '../../utils/dateUtils';
import { SubmissionStatusBadge } from '../common/Badge';

interface StudentSubmissionsViewProps {
  group: Group;
  deliverables: Deliverable[];
  tasks: Task[];
  submissions: GroupTaskSubmission[];
  onOpenDocumentViewer: (submissionId: string) => void;
}

export const StudentSubmissionsView: React.FC<StudentSubmissionsViewProps> = ({
  group,
  deliverables,
  tasks,
  submissions,
  onOpenDocumentViewer,
}) => {
  const groupSubmissions = submissions.filter((s) => s.groupId === group.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          My Group&apos;s Submissions & Revision History
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Review all uploaded file versions, examine timestamps and proponents, and view returned document annotations.
        </p>
      </div>

      {groupSubmissions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-xs">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700">No submissions uploaded yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Navigate to Deliverables & Tasks to upload your proposal drafts.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupSubmissions.map((sub) => {
            const task = tasks.find((t) => t.id === sub.taskId);
            const deliverable = deliverables.find((d) => d.id === sub.deliverableId);

            return (
              <div
                key={sub.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
              >
                {/* Submission Header */}
                <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {deliverable?.name}
                      </span>
                      <SubmissionStatusBadge status={sub.status} />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      {task?.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    {sub.grade && (
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 block">Assessed Grade</span>
                        <span className="text-base font-mono font-bold text-indigo-700">
                          {sub.grade.finalScore.toFixed(1)} / {task?.maxScore} pts
                        </span>
                      </div>
                    )}

                    <button
                      onClick={() => onOpenDocumentViewer(sub.id)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {sub.status === 'returned'
                        ? 'Open Evaluated Document'
                        : 'Inspect Submitted Document'}
                    </button>
                  </div>
                </div>

                {/* Versions History Timeline */}
                <div className="p-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <FolderGit2 className="w-4 h-4 text-indigo-600" />
                    Version History ({sub.versions.length} versions submitted)
                  </h4>

                  <div className="space-y-3">
                    {sub.versions.map((ver) => {
                      const versionAnnotations = sub.annotations.filter(
                        (a) => a.version === ver.version
                      );
                      const annotationCount = versionAnnotations.length;

                      return (
                        <div
                          key={ver.version}
                          className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex items-start justify-between gap-4 flex-wrap"
                        >
                          <div className="space-y-1.5 flex-1 min-w-[260px]">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-200">
                                Version {ver.version}
                              </span>
                              <span className="text-xs font-semibold text-slate-900 flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-slate-500" />
                                {ver.fileName}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                ({(ver.fileSize / 1024).toFixed(1)} KB)
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {formatDateTime(ver.submittedAt)}
                              </span>
                              <span>&bull;</span>
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                Submitted by: <strong>{ver.submittedByName}</strong>
                              </span>
                            </div>

                            {ver.remarks && (
                              <p className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 italic mt-1">
                                &quot;{ver.remarks}&quot;
                              </p>
                            )}

                            {/* Revision response matrix preview */}
                            {ver.revisionResponses && ver.revisionResponses.length > 0 && (
                              <div className="mt-2 text-xs bg-purple-50/50 p-2.5 rounded-lg border border-purple-100">
                                <span className="font-semibold text-purple-900 block mb-1">
                                  Revision Response Matrix ({ver.revisionResponses.length} items addressed):
                                </span>
                                <ul className="list-disc list-inside space-y-1 text-slate-700 text-[11px]">
                                  {ver.revisionResponses.map((item) => (
                                    <li key={item.id}>
                                      <strong>Comment:</strong> {item.instructorComment} &rarr; <em>{item.changeDescription}</em>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Annotation Pill */}
                          <div className="text-right shrink-0">
                            {annotationCount > 0 ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-medium">
                                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                                <span>
                                  {annotationCount} pinned annotation(s)
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                {sub.status === 'returned'
                                  ? 'No annotations on this version'
                                  : 'Evaluation pending'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
