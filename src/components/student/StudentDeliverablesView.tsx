import { flushFileStore } from '../../services/fileStore';
import { saveFileBlob, storage } from '../../services/storage';
import React, { useState } from 'react';
import {
  Group,
  Deliverable,
  Task,
  GroupTaskSubmission,
  StudentMember,
  SubmissionVersion,
  RevisionResponse,
} from '../../types';
import {
  Layers,
  Upload,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ClockAlert,
  Eye,
  Plus,
  Trash2,
  Undo2,
  FolderGit2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import {
  formatDateTime,
  calculateDaysLate,
  isDeadlinePassed,
  getCurrentManilaTimeString,
} from '../../utils/dateUtils';
import { calculateLateDeduction } from '../../utils/scoring';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SubmissionStatusBadge } from '../common/Badge';

interface RevisionItem {
  id: string;
  reviewerComment: string;
  changesMade: string;
}

interface StudentDeliverablesViewProps {
  currentStudent: StudentMember;
  group: Group;
  deliverables: Deliverable[];
  tasks: Task[];
  submissions: GroupTaskSubmission[];
  onSaveSubmissions: (submissions: GroupTaskSubmission[]) => void;
  onOpenDocumentViewer: (submissionId: string) => void;
  preselectedTaskId?: string;
}

export const StudentDeliverablesView: React.FC<StudentDeliverablesViewProps> = ({
  currentStudent,
  group,
  deliverables,
  tasks,
  submissions,
  onSaveSubmissions,
  onOpenDocumentViewer,
  preselectedTaskId,
}) => {
  // Submission modal state
  const [selectedTaskForUpload, setSelectedTaskForUpload] = useState<Task | null>(
    preselectedTaskId ? tasks.find((t) => t.id === preselectedTaskId) || null : null
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [revisionItems, setRevisionItems] = useState<RevisionItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const publishedTasks = tasks.filter(
    (t) => t.status === 'published' && !t.isArchived
  );

  // Helper to get group submission for a task
  const getSubmissionForTask = (taskId: string) => {
    return submissions.find((s) => s.groupId === group.id && s.taskId === taskId);
  };

  // Open upload modal
  const handleOpenUploadModal = (task: Task) => {
    const existing = getSubmissionForTask(task.id);
    if (existing && (existing.status !== 'not_submitted' || (existing.versions && existing.versions.length > 0))) {
      alert('This task has already been submitted and cannot be submitted again.');
      return;
    }
    setUploadError('');
    setUploadedFile(null);
    setSubmissionNotes('');
    setRevisionItems([]);
    setSelectedTaskForUpload(task);
  };

  // Add revision matrix row
  const handleAddRevisionItem = () => {
    setRevisionItems((prev) => [
      ...prev,
      {
        id: `rev-${Date.now()}`,
        reviewerComment: '',
        changesMade: '',
      },
    ]);
  };

  const handleUpdateRevisionItem = (
    id: string,
    field: 'reviewerComment' | 'changesMade',
    value: string
  ) => {
    setRevisionItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveRevisionItem = (id: string) => {
    setRevisionItems((prev) => prev.filter((item) => item.id !== id));
  };

  // File drag and drop handlers
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
        setUploadError('Please upload a PDF document (.pdf)');
        return;
      }
      setUploadedFile(file);
      setUploadError('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
        setUploadError('Please upload a PDF document (.pdf)');
        return;
      }
      setUploadedFile(file);
      setUploadError('');
    }
  };

  // Pre-submission review & confirmation
  const handleInitiateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile) {
      setUploadError('Please select or drop a PDF file to submit.');
      return;
    }

    if (selectedTaskForUpload?.isRevisionTask && (revisionItems.length === 0 || revisionItems.some(row => !row.reviewerComment.trim() || !row.changesMade.trim()))) {
      setUploadError('Revision tasks require at least one revision matrix entry.');
      return;
    }

    setIsConfirmModalOpen(true);
  };

  // Final execute submission
  const handleConfirmSubmit = async () => {
    if (!selectedTaskForUpload || !uploadedFile || isSaving) return;
    setIsSaving(true);
    try {
    if (uploadedFile.size > 10 * 1024 * 1024) throw new Error('PDF must be 10 MB or smaller.');
    const bytes = new Uint8Array(await uploadedFile.slice(0, 5).arrayBuffer());
    if (new TextDecoder().decode(bytes) !== '%PDF-') throw new Error('The selected file is not a valid PDF.');
    const fileDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read the PDF.'));
      reader.readAsDataURL(new Blob([uploadedFile], { type: 'application/pdf' }));
    });

    const currentTimestamp = getCurrentManilaTimeString();
    const existingSub = getSubmissionForTask(selectedTaskForUpload.id);

    const versionNumber = existingSub ? existingSub.versions.length + 1 : 1;
    const newSubId = existingSub ? existingSub.id : `sub-${Date.now()}`;

    try {
      await saveFileBlob(`sub-${selectedTaskForUpload.id}-v${versionNumber}`, fileDataUrl, uploadedFile.name);
      await saveFileBlob(`sub-${newSubId}-v${versionNumber}`, fileDataUrl, uploadedFile.name);
    } catch (blobErr) {
      console.warn('Backup file save warning:', blobErr);
    }

    const newVersion: SubmissionVersion = {
      version: versionNumber,
      fileName: uploadedFile.name,
      fileSize: uploadedFile.size,
      fileDataUrl,
      submittedAt: currentTimestamp,
      submittedByMemberId: currentStudent.id,
      submittedByName: `${currentStudent.firstName} ${currentStudent.lastName}`,
      remarks: submissionNotes.trim() || undefined,
      revisionResponses:
        revisionItems.length > 0
          ? revisionItems
              .filter((r) => r.reviewerComment)
              .map((r) => ({
                id: r.id,
                instructorComment: r.reviewerComment,
                pageOrSection: 'Specified Revision Areas',
                changeDescription: r.changesMade,
              }))
          : undefined,
    };

    let updatedSubmissions: GroupTaskSubmission[];

    if (existingSub) {
      const updated: GroupTaskSubmission = {
        ...existingSub,
        grade: undefined,
        currentVersion: versionNumber,
        versions: [...existingSub.versions, newVersion],
        status: 'submitted',
        submittedAt: currentTimestamp,
      };
      updatedSubmissions = submissions.map((s) =>
        s.id === existingSub.id ? updated : s
      );
    } else {
      const newSub: GroupTaskSubmission = {
        id: newSubId,
        groupId: group.id,
        taskId: selectedTaskForUpload.id,
        deliverableId: selectedTaskForUpload.deliverableId,
        currentVersion: versionNumber,
        versions: [newVersion],
        annotations: [],
        status: 'submitted',
        submittedAt: currentTimestamp,
      };
      updatedSubmissions = [...submissions, newSub];
    }

    storage.saveSubmissions(updatedSubmissions);
    onSaveSubmissions(updatedSubmissions);

    try {
      await flushFileStore();
    } catch (flushErr) {
      console.warn('Background sync warning:', flushErr);
    }

    setIsConfirmModalOpen(false);
    setSelectedTaskForUpload(null);
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : 'Upload failed.');
      setIsConfirmModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Compute late penalty preview for modal
  const latePreview = selectedTaskForUpload
    ? (() => {
        const now = new Date().toISOString();
        const daysLate = calculateDaysLate(now, selectedTaskForUpload.deadline);
        const deduction = calculateLateDeduction(
          selectedTaskForUpload.latePolicy,
          daysLate,
          selectedTaskForUpload.maxScore
        );
        return { isLate: daysLate > 0, daysLate, deduction };
      })()
    : { isLate: false, daysLate: 0, deduction: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Deliverables & Tasks
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Submit proposal chapters, track milestone deadlines, inspect grading rubrics, and upload revision cycles.
        </p>
      </div>

      {/* Deliverables List */}
      <div className="space-y-6">
        {deliverables.map((del) => {
          const deliverableTasks = publishedTasks.filter(
            (t) => t.deliverableId === del.id
          );

          if (deliverableTasks.length === 0) return null;

          return (
            <div
              key={del.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
            >
              {/* Deliverable Header */}
              <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-base font-bold text-slate-900">
                      {del.name}
                    </h3>
                    <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {del.totalPossiblePoints} Total Points
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                    {del.description}
                  </p>
                </div>
              </div>

              {/* Tasks List */}
              <div className="p-5 space-y-4">
                {deliverableTasks.map((task) => {
                  const sub = getSubmissionForTask(task.id);
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
                  const displayStatus: GroupTaskSubmission['status'] = isReturned
                    ? 'returned'
                    : isSubmitted
                    ? (sub?.status === 'graded_awaiting_return' ? 'graded_awaiting_return' : 'submitted')
                    : 'not_submitted';
                  const isUnderReview = isSubmitted && !isReturned;
                  const isOverdue = !isSubmitted && isDeadlinePassed(task.deadline);
                  const latestVer = hasVersions ? sub!.versions[sub!.versions.length - 1] : undefined;

                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isOverdue
                          ? 'bg-rose-50/30 border-rose-200'
                          : isReturned
                          ? 'bg-emerald-50/20 border-emerald-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="space-y-1.5 flex-1 min-w-[280px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900">
                              {task.name}
                            </h4>
                            {task.isRevisionTask && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded">
                                Revision Task
                              </span>
                            )}
                            <SubmissionStatusBadge
                              status={displayStatus}
                            />
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">
                            {task.instructions}
                          </p>

                          <div className="flex items-center gap-3 text-xs text-slate-500 pt-1 flex-wrap">
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                              Deadline: {formatDateTime(task.deadline)}
                            </span>
                            <span>&bull;</span>
                            <span>Max Task Score: <strong>{task.maxScore} pts</strong></span>
                            <span>&bull;</span>
                            <span>
                              Late Policy:{' '}
                              <strong>
                                {task.latePolicy.type === 'none'
                                  ? 'No deduction'
                                  : task.latePolicy.type === 'fixed'
                                  ? `Fixed -${task.latePolicy.deductionAmount} pts`
                                  : `-${task.latePolicy.deductionAmount} pts/day`}
                              </strong>
                            </span>
                          </div>

                          {/* Submission metadata banner */}
                          {latestVer && (
                            <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <strong>Latest Submitted:</strong> Version {latestVer.version} ({latestVer.fileName}) on {formatDateTime(latestVer.submittedAt)} by {latestVer.submittedByName}
                              </div>
                              {sub?.grade && (
                                <div className="font-mono font-bold text-indigo-700 text-xs">
                                  Grade: {sub.grade.finalScore.toFixed(1)} / {task.maxScore} pts
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isReturned && sub ? (
                            <button
                              onClick={() => onOpenDocumentViewer(sub.id)}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Graded Work & Rubric
                            </button>
                          ) : isSubmitted && sub ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onOpenDocumentViewer(sub.id)}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View Submission
                              </button>
                              <span className="text-[11px] text-emerald-800 font-medium px-2 py-1 bg-emerald-50 rounded border border-emerald-200">
                                Submitted & Locked
                              </span>
                            </div>
                          ) : (() => {
                            const isProjectManager = currentStudent.roles?.includes('Project Manager');
                            return (
                              <button
                                onClick={() => isProjectManager && handleOpenUploadModal(task)}
                                disabled={!isProjectManager}
                                title={!isProjectManager ? 'Only the Project Manager can submit deliverables.' : undefined}
                                className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                                  !isProjectManager
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : isOverdue
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }`}
                              >
                                <Upload className="w-3.5 h-3.5" />
                                Upload Deliverable
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submission Upload Modal */}
      {selectedTaskForUpload && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedTaskForUpload(null)}
          title={`Submit Proposal: ${selectedTaskForUpload.name}`}
          subtitle={`Max Score: ${selectedTaskForUpload.maxScore} pts • Deadline: ${formatDateTime(selectedTaskForUpload.deadline)}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleInitiateSubmit} className="space-y-4">
            {uploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Late Submission Warning Preview */}
            {latePreview.isLate && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                <ClockAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <strong>Late Submission Warning:</strong> This submission deadline was {formatDateTime(selectedTaskForUpload.deadline)}. Your submission is approximately <strong>{latePreview.daysLate} day(s) late</strong>. A late penalty of <strong>-{latePreview.deduction} points</strong> will be applied according to policy.
                </div>
              </div>
            )}

            {/* Drag and Drop File Upload Box */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Proposal Document (PDF format required) *
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleFileDrop}
                className={`p-6 border-2 border-dashed rounded-xl text-center transition-all cursor-pointer ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : uploadedFile
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
                onClick={() => document.getElementById('file-upload-input')?.click()}
              >
                <input
                  id="file-upload-input"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {uploadedFile ? (
                  <div className="flex flex-col items-center">
                    <FileText className="w-8 h-8 text-emerald-600 mb-2" />
                    <span className="text-xs font-bold text-slate-900">
                      {uploadedFile.name}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5">
                      {(uploadedFile.size / 1024).toFixed(1)} KB &bull; Click or drop another to replace
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-xs font-semibold text-slate-700">
                      Drag and drop your PDF here, or <span className="text-indigo-600 underline">browse files</span>
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">
                      Only PDF documents (.pdf) accepted for annotation pinning
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Revision Task Matrix Requirements */}
            {selectedTaskForUpload.isRevisionTask && (
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Revision Matrix *
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Map each panel / instructor correction comment to the specific page or section change made.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRevisionItem}
                    className="px-2 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Matrix Entry
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {revisionItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">
                          Correction Item #{idx + 1}
                        </span>
                        {revisionItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRevisionItem(item.id)}
                            className="text-rose-600 hover:underline text-[11px]"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={item.reviewerComment}
                        onChange={(e) =>
                          handleUpdateRevisionItem(item.id, 'reviewerComment', e.target.value)
                        }
                        placeholder="Reviewer / Instructor Comment or Required Action..."
                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white"
                        required
                      />
                      <textarea
                        rows={1}
                        value={item.changesMade}
                        onChange={(e) =>
                          handleUpdateRevisionItem(item.id, 'changesMade', e.target.value)
                        }
                        placeholder="Changes implemented in this version (e.g. Page 5, expanded Section 1.4)..."
                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white"
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submission Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Proponent Submission Notes / Remarks
              </label>
              <textarea
                rows={2}
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
                placeholder="Optional remarks for the evaluating instructor..."
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500">
              Submitting as: <strong>{currentStudent.firstName} {currentStudent.lastName}</strong> ({currentStudent.roles.join(', ')}) &bull; Current Timezone: <strong>Asia/Manila (PHT)</strong>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedTaskForUpload(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
              >
                Review & Confirm Submission
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirmation Before Final Submitting */}
      <ConfirmDialog
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmSubmit}
        title="Confirm Proposal Submission"
        message={`Are you ready to submit "${uploadedFile?.name}" for task "${selectedTaskForUpload?.name}"? Please note that once submitted, this deliverable is locked and you will no longer be able to re-upload or modify this submission.`}
        confirmLabel="Yes, Submit File"
      />
    </div>
  );
};
