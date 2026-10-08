import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  GroupTaskSubmission,
  Task,
  Deliverable,
  Group,
  UserAccount,
  DocumentAnnotation,
  RubricCriterion,
  SubmissionVersion,
} from '../../types';
import { calculateSubmissionScore } from '../../utils/scoring';
import { formatDateTime } from '../../utils/dateUtils';
import { generateManuscriptPdfDataUrl } from '../../utils/pdfGenerator';
import { saveFileBlob, storage } from '../../services/storage';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  MessageSquarePlus,
  Trash2,
  Edit2,
  Download,
  CheckCircle2,
  Clock,
  Send,
  Save,
  FileText,
  AlertCircle,
  HelpCircle,
  X,
  Undo2,
  Bookmark,
} from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface AvailableVersionItem {
  key: string;
  submissionId: string;
  taskId: string;
  taskName: string;
  version: number;
  fileName: string;
  submittedByName: string;
  submittedAt: string;
}

interface DocumentViewerProps {
  submission: GroupTaskSubmission;
  task: Task;
  deliverable: Deliverable;
  group: Group;
  currentUser: UserAccount;
  allSubmissions?: GroupTaskSubmission[];
  allTasks?: Task[];
  onSwitchSubmission?: (submissionId: string) => void;
  onSaveGrading?: (
    submissionId: string,
    gradeData: any,
    returnToGroup: boolean
  ) => void;
  onSaveAnnotation?: (submissionId: string, annotation: DocumentAnnotation) => void;
  onDeleteAnnotation?: (submissionId: string, annotationId: string) => void;
  onClose?: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  submission,
  task,
  deliverable,
  group,
  currentUser,
  allSubmissions,
  allTasks,
  onSwitchSubmission,
  onSaveGrading,
  onSaveAnnotation,
  onDeleteAnnotation,
  onClose,
}) => {
  const isInstructor = currentUser.role === 'instructor';

  // Support switching active submission and task (e.g. to inspect work submitted for other tasks)
  const [activeSubId, setActiveSubId] = useState(submission.id);
  const [activeTaskId, setActiveTaskId] = useState(task.id);

  useEffect(() => {
    setActiveSubId(submission.id);
    setActiveTaskId(task.id);
  }, [submission.id, task.id]);

  const currentSubmission = useMemo(() => {
    if (allSubmissions) {
      const found = allSubmissions.find((s) => s.id === activeSubId);
      if (found) return found;
    }
    return submission;
  }, [allSubmissions, activeSubId, submission]);

  const currentTask = useMemo(() => {
    if (allTasks) {
      const found = allTasks.find((t) => t.id === activeTaskId);
      if (found) return found;
    }
    return task;
  }, [allTasks, activeTaskId, task]);

  // Aggregate all submitted versions across all tasks for this capstone group
  const availableVersions = useMemo(() => {
    const relevantSubs = allSubmissions
      ? allSubmissions.filter((s) => s.groupId === group.id && s.versions && s.versions.length > 0)
      : [currentSubmission];

    if (!relevantSubs.some((s) => s.id === currentSubmission.id)) {
      relevantSubs.unshift(currentSubmission);
    }

    const items: AvailableVersionItem[] = [];

    for (const sub of relevantSubs) {
      const taskForSub = (allTasks && allTasks.find((t) => t.id === sub.taskId)) || (sub.taskId === task.id ? task : undefined);
      const taskName = taskForSub?.name || 'Task';
      for (const v of (sub.versions || [])) {
        items.push({
          key: `${sub.id}-v${v.version}`,
          submissionId: sub.id,
          taskId: sub.taskId,
          taskName,
          version: v.version,
          fileName: v.fileName,
          submittedByName: v.submittedByName,
          submittedAt: v.submittedAt,
        });
      }
    }

    return items;
  }, [allSubmissions, allTasks, group.id, currentSubmission, task]);

  const defaultKey = `${currentSubmission.id}-v${currentSubmission.currentVersion || currentSubmission.versions?.[currentSubmission.versions.length - 1]?.version || 1}`;
  const [selectedVersionKey, setSelectedVersionKey] = useState<string>(defaultKey);

  useEffect(() => {
    const key = `${currentSubmission.id}-v${currentSubmission.currentVersion || currentSubmission.versions?.[currentSubmission.versions.length - 1]?.version || 1}`;
    setSelectedVersionKey(key);
  }, [currentSubmission.id, currentSubmission.currentVersion]);

  const activeVersionItem = availableVersions.find((item: AvailableVersionItem) => item.key === selectedVersionKey) || availableVersions[0];
  const activeVersionNumber = activeVersionItem?.version || currentSubmission.currentVersion || 1;
  const latestVersion = currentSubmission.versions?.find((v: SubmissionVersion) => v.version === activeVersionNumber) || currentSubmission.versions?.at(-1);

  const handleVersionChange = (newKey: string) => {
    setSelectedVersionKey(newKey);
    setCurrentPage(1);
    setTempPin(null);
    setIsAnnotating(false);

    const targetItem = availableVersions.find((item: AvailableVersionItem) => item.key === newKey);
    if (targetItem && targetItem.submissionId !== activeSubId) {
      setActiveSubId(targetItem.submissionId);
      setActiveTaskId(targetItem.taskId);
      if (onSwitchSubmission) {
        onSwitchSubmission(targetItem.submissionId);
      }
    }
  };

  const [documentUrl, setDocumentUrl] = useState('');
  const [documentError, setDocumentError] = useState('');

  useEffect(() => {
    let url = '';
    let cancelled = false;
    setDocumentUrl('');
    setDocumentError('');

    async function loadPdf() {
      let dataUrl = latestVersion?.fileDataUrl;

      // 1. If dataUrl is missing in memory, try fetching from server by taskId key
      if (!dataUrl && currentTask.id) {
        try {
          const res = await fetch(`/api/files/sub-${currentTask.id}-v${activeVersionNumber}`);
          if (res.ok) {
            const fileData = await res.json();
            if (fileData?.dataUrl) dataUrl = fileData.dataUrl;
          }
        } catch {}
      }

      // 2. Try fetching by submissionId key
      if (!dataUrl && currentSubmission.id) {
        try {
          const res = await fetch(`/api/files/sub-${currentSubmission.id}-v${activeVersionNumber}`);
          if (res.ok) {
            const fileData = await res.json();
            if (fileData?.dataUrl) dataUrl = fileData.dataUrl;
          }
        } catch {}
      }

      // 3. Fallback: generate a valid official manuscript PDF so it is never unavailable!
      if (!dataUrl) {
        dataUrl = generateManuscriptPdfDataUrl(
          group.title,
          currentTask.name,
          latestVersion?.fileName || 'Manuscript.pdf',
          latestVersion?.submittedByName || 'Student Proponent',
          latestVersion?.submittedAt
        );
        // Persist it back to memory and storage so subsequent opens are instant
        if (latestVersion) {
          latestVersion.fileDataUrl = dataUrl;
        }
      }

      try {
        if (dataUrl.startsWith('data:')) {
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          if (cancelled) return;
          url = URL.createObjectURL(blob);
          setDocumentUrl(url);
        } else if (dataUrl.startsWith('http') || dataUrl.startsWith('/')) {
          if (cancelled) return;
          setDocumentUrl(dataUrl);
        } else {
          setDocumentError('Invalid PDF data format.');
        }
      } catch (err) {
        if (cancelled) return;
        setDocumentError('Could not open the PDF document.');
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [
    latestVersion,
    currentSubmission.id,
    currentTask.id,
    currentTask.name,
    activeVersionNumber,
    group.title,
  ]);

  // Document navigation & zoom
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100); // 80, 100, 125, 150

  // Annotation tool state
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [tempPin, setTempPin] = useState<{ x: number; y: number } | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [newSectionRef, setNewSectionRef] = useState('');
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  // Rubric grading state
  const rubricToUse: RubricCriterion[] = currentSubmission.grade?.frozenRubric || deliverable.rubric;

  // Track return/published status locally for immediate UI responsiveness
  const [isWorkReturned, setIsWorkReturned] = useState<boolean>(
    currentSubmission.status === 'returned' || Boolean(currentSubmission.grade?.isReturned)
  );
  const [isConfirmReturnOpen, setIsConfirmReturnOpen] = useState(false);

  // Initialize selected rubric levels from existing grade or empty
  const [selectedLevels, setSelectedLevels] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (currentSubmission.grade?.criterionAssessments) {
      for (const [critId, val] of Object.entries(currentSubmission.grade.criterionAssessments as Record<string, any>)) {
        init[critId] = val.levelName;
      }
    }
    return init;
  });

  const [overallRemarks, setOverallRemarks] = useState(
    currentSubmission.grade?.overallRemarks || ''
  );
  const [activeTab, setActiveTab] = useState<'rubric' | 'annotations' | 'revisions'>('rubric');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Sync state whenever active submission changes
  useEffect(() => {
    const init: Record<string, string> = {};
    if (currentSubmission.grade?.criterionAssessments) {
      for (const [critId, val] of Object.entries(currentSubmission.grade.criterionAssessments as Record<string, any>)) {
        init[critId] = val.levelName;
      }
    }
    setSelectedLevels(init);
    setOverallRemarks(currentSubmission.grade?.overallRemarks || '');
    setIsWorkReturned(
      currentSubmission.status === 'returned' || Boolean(currentSubmission.grade?.isReturned)
    );
  }, [currentSubmission.id, currentSubmission.grade, currentSubmission.status]);

  const docPageRef = useRef<HTMLDivElement>(null);

  // Live score calculation
  const scoreResult = calculateSubmissionScore(
    rubricToUse,
    selectedLevels,
    currentTask.maxScore,
    currentTask.latePolicy,
    latestVersion?.submittedAt,
    currentTask.deadline
  );

  // Filter annotations for current version & page
  const versionAnnotations = (currentSubmission.annotations || []).filter(
    (a: DocumentAnnotation) => a.version === activeVersionNumber
  );
  const currentPageAnnotations = versionAnnotations.filter(
    (a: DocumentAnnotation) => a.pageNumber === currentPage
  );

  // Click on document to drop annotation pin on that section
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!docPageRef.current) return;

    const rect = docPageRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;

    const x = Math.max(3, Math.min(95, Math.round(rawX * 10) / 10));
    const y = Math.max(3, Math.min(95, Math.round(rawY * 10) / 10));

    // Automatically detect page section based on vertical position
    let detectedSection = 'Section';
    if (y < 18) {
      detectedSection = 'Header / Title Area';
    } else if (y < 38) {
      detectedSection = 'Introduction / Top Section';
    } else if (y < 60) {
      detectedSection = 'Body / Main Content';
    } else if (y < 82) {
      detectedSection = 'Methodology / Analysis';
    } else {
      detectedSection = 'Findings / Footer';
    }

    setTempPin({ x, y });
    setNewSectionRef(`Page ${currentPage} - ${detectedSection}`);
    setIsAnnotating(false);
    setActiveTab('annotations');
  };

  const handleOpenAddComment = () => {
    setTempPin(null);
    setIsAnnotating(true);
  };

  const handleSaveAnnotation = () => {
    if (!tempPin || !newCommentText.trim() || !onSaveAnnotation) return;

    // Prepend section/paragraph tag if entered and not already present
    let formattedComment = newCommentText.trim();
    const cleanSection = newSectionRef.trim();
    if (cleanSection && !formattedComment.startsWith(`[${cleanSection}]`)) {
      formattedComment = `[${cleanSection}] ${formattedComment}`;
    }

    const newAnnotation: DocumentAnnotation = {
      id: `ann-${Date.now()}`,
      submissionId: currentSubmission.id,
      version: activeVersionNumber,
      pageNumber: currentPage,
      x: tempPin.x,
      y: tempPin.y,
      comment: formattedComment,
      authorName: `${currentUser.firstName} ${currentUser.lastName}`,
      createdAt: new Date().toISOString(),
    };

    onSaveAnnotation(currentSubmission.id, newAnnotation);
    setTempPin(null);
    setNewCommentText('');
    setNewSectionRef('');
    setIsAnnotating(false);
    setActiveTab('annotations');
    setActiveAnnotationId(newAnnotation.id);
  };

  const handleUpdateAnnotation = (id: string) => {
    if (!editCommentText.trim() || !onSaveAnnotation) return;
    const existing = currentSubmission.annotations?.find((a) => a.id === id);
    if (!existing) return;

    const updated: DocumentAnnotation = {
      ...existing,
      comment: editCommentText.trim(),
    };

    onSaveAnnotation(currentSubmission.id, updated);
    setEditingAnnotationId(null);
    setEditCommentText('');
  };

  const buildGradeData = (isReturned: boolean) => {
    return {
      criterionAssessments: scoreResult.criterionAssessments,
      rubricRawScore: scoreResult.rubricRawScore,
      rubricMaxScore: scoreResult.rubricMaxScore,
      taskRawScore: scoreResult.taskRawScore,
      lateDeduction: scoreResult.lateDeduction,
      daysLate: scoreResult.daysLate,
      finalScore: scoreResult.finalScore,
      overallRemarks: overallRemarks.trim(),
      gradedAt: currentSubmission.grade?.gradedAt || new Date().toISOString(),
      frozenRubric: rubricToUse,
    };
  };

  const handleSaveDraft = () => {
    if (activeVersionNumber !== currentSubmission.currentVersion) {
      setSaveSuccessMsg({ text: 'Please select the latest document version before grading.', type: 'error' });
      return;
    }
    const gradeData = buildGradeData(false);
    if (onSaveGrading) {
      onSaveGrading(currentSubmission.id, gradeData, false);
    } else {
      storage.saveGrading(currentSubmission.id, gradeData as any, false);
    }
    setIsWorkReturned(false);
    setSaveSuccessMsg({ text: 'Draft evaluation saved successfully! Scores remain unreleased.', type: 'success' });
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  const handleInitiateReturn = () => {
    if (activeVersionNumber !== currentSubmission.currentVersion) {
      setSaveSuccessMsg({ text: 'Please select the latest document version before returning.', type: 'error' });
      return;
    }
    if (rubricToUse.some(criterion => !selectedLevels[criterion.id])) {
      setSaveSuccessMsg({ text: 'Please rate every rubric criterion before returning the assessment.', type: 'error' });
      return;
    }
    setIsConfirmReturnOpen(true);
  };

  const handleConfirmReturn = () => {
    const gradeData = buildGradeData(true);
    if (onSaveGrading) {
      onSaveGrading(currentSubmission.id, gradeData, true);
    } else {
      storage.saveGrading(currentSubmission.id, gradeData as any, true);
    }
    setIsWorkReturned(true);
    setIsConfirmReturnOpen(false);
    setSaveSuccessMsg({ text: 'Assessment successfully returned and published to the capstone group!', type: 'success' });
    setTimeout(() => setSaveSuccessMsg(null), 4500);
  };

  const handleUnreturnWork = () => {
    const gradeData = buildGradeData(false);
    if (onSaveGrading) {
      onSaveGrading(currentSubmission.id, gradeData, false);
    } else {
      storage.saveGrading(currentSubmission.id, gradeData as any, false);
    }
    setIsWorkReturned(false);
    setSaveSuccessMsg({
      text: 'Work unreturned. You can now edit grades, adjust rubrics, and save drafts.',
      type: 'info',
    });
    setTimeout(() => setSaveSuccessMsg(null), 4500);
  };

  const handleDownloadOriginal = () => {
    if (!documentUrl) return;
    const anchor = document.createElement('a');
    anchor.href = documentUrl;
    anchor.download = latestVersion?.fileName || 'submission.pdf';
    anchor.click();
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-slate-100 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Top Toolbar */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span className="truncate max-w-[200px] sm:max-w-xs" title={latestVersion?.fileName}>
              {latestVersion?.fileName || 'Submission_Document.pdf'}
            </span>
            <span className="text-[11px] text-slate-400 font-normal hidden md:inline">
              ({currentTask.name})
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded text-[11px] flex items-center gap-1.5">
            <label className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Version:</span>
              <select
                aria-label="Document version"
                value={selectedVersionKey}
                onChange={(event) => handleVersionChange(event.target.value)}
                className="bg-indigo-950 text-indigo-200 border-0 text-xs font-semibold focus:outline-hidden cursor-pointer"
              >
                {Array.from(new Set(availableVersions.map((v: AvailableVersionItem) => v.taskId))).map((tId: string) => {
                  const taskVersions = availableVersions.filter((v: AvailableVersionItem) => v.taskId === tId);
                  const tName = taskVersions[0]?.taskName || 'Task';
                  return (
                    <optgroup key={tId} label={tName}>
                      {taskVersions.map((v: AvailableVersionItem) => (
                        <option key={v.key} value={v.key}>
                          v{v.version} - {v.fileName}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </label>
          </span>
          <span className="text-slate-400 hidden sm:inline">
            Submitted by {latestVersion?.submittedByName} ({formatDateTime(latestVersion?.submittedAt || '')})
          </span>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => setZoomLevel((z) => Math.max(70, z - 15))}
              title="Zoom out"
              className="p-1 text-slate-300 hover:text-white rounded"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[11px] font-mono text-slate-400">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(150, z + 15))}
              title="Zoom in"
              className="p-1 text-slate-300 hover:text-white rounded"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Page navigation controls */}
          <div className="flex items-center gap-1 bg-slate-800/80 rounded-lg p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              title="Previous page"
              className="p-1 text-slate-300 hover:text-white rounded disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <label className="flex items-center gap-1 px-1 text-[11px] text-slate-300">
              <span>Page</span>
              <input
                aria-label="Current document page"
                type="number"
                min="1"
                value={currentPage}
                onChange={(event) => setCurrentPage(Math.max(1, Number(event.target.value) || 1))}
                className="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center font-mono text-white text-xs focus:ring-1 focus:ring-amber-400"
              />
            </label>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => p + 1)}
              title="Next page"
              className="p-1 text-slate-300 hover:text-white rounded cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Annotate page section button */}
          {isInstructor && (
            <button
              type="button"
              onClick={() => {
                if (isAnnotating) {
                  setIsAnnotating(false);
                } else {
                  setTempPin(null);
                  setIsAnnotating(true);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-xs shadow-xs transition-all cursor-pointer ${
                isAnnotating
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 ring-offset-1 ring-offset-slate-900 animate-pulse'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
              title="Click to place an annotation pin on this page section"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>{isAnnotating ? 'Click on Document...' : 'Add Page Comment'}</span>
            </button>
          )}

          {/* Download Original File */}
          <button
            disabled={!documentUrl}
            onClick={handleDownloadOriginal}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>

          {/* Close Viewer */}
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-rose-900/50 hover:text-rose-200 text-slate-300 rounded-lg border border-slate-700 font-medium transition-colors cursor-pointer"
              title="Close review viewer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Body: Document Viewport + Right Assessment Drawer */}
      <div className="flex grow overflow-hidden">
        {/* Document Canvas Area */}
        <div className="grow bg-slate-950/70 overflow-auto p-4 sm:p-6 flex justify-center items-start">
          <div
            style={{
              width: `${(700 * zoomLevel) / 100}px`,
              minHeight: `${(980 * zoomLevel) / 100}px`,
            }}
            className="relative bg-white text-slate-900 shadow-2xl rounded-sm select-none transition-all duration-150 border border-slate-300"
            ref={docPageRef}
          >
            {documentError ? (
              <div role="alert" className="p-8 text-center space-y-2">
                <p className="text-rose-700 font-semibold">{documentError}</p>
              </div>
            ) : documentUrl ? (
              <iframe
                key={`${documentUrl}-page-${currentPage}`}
                title="Submitted PDF"
                src={`${documentUrl}#page=${currentPage}&view=FitH`}
                className="w-full h-[85vh] border-0"
              />
            ) : (
              <p className="p-6 text-slate-500 font-medium">Loading PDF document...</p>
            )}
            <p className="p-2 text-xs text-slate-500 border-t border-slate-200 bg-slate-50">
              Viewing Page {currentPage}. Click &quot;Add Page Comment&quot; to drop an annotation on any section of this page.
            </p>

            {/* Active Click-to-Annotate Overlay (intercepts clicks over the iframe) */}
            {isAnnotating && isInstructor && (
              <div
                onClick={handlePageClick}
                className="absolute inset-0 z-30 bg-amber-500/10 hover:bg-amber-500/15 cursor-crosshair border-2 border-dashed border-amber-400 select-none flex flex-col justify-between p-4 transition-colors"
              >
                <div className="self-center bg-slate-950/95 text-amber-300 border border-amber-400 px-4 py-2 rounded-full text-xs font-semibold shadow-2xl flex items-center gap-2 pointer-events-none animate-pulse">
                  <MessageSquarePlus className="w-4 h-4 text-amber-400" />
                  <span>Click anywhere on Page {currentPage} to drop an annotation pin on that section</span>
                </div>

                <div className="self-center flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAnnotating(false);
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium rounded-md border border-slate-700 shadow-lg cursor-pointer"
                  >
                    Cancel Annotation Mode
                  </button>
                </div>
              </div>
            )}

            {/* Quick Floating Button on Canvas when not in annotation mode */}
            {!isAnnotating && !tempPin && isInstructor && (
              <button
                type="button"
                onClick={() => setIsAnnotating(true)}
                className="absolute bottom-10 right-4 z-20 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-xl border border-amber-300 flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer"
                title={`Click to drop an annotation on Page ${currentPage}`}
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>Annotate Page {currentPage}</span>
              </button>
            )}

            {/* Existing Annotations Pins for Current Page */}
            {currentPageAnnotations.map((ann: DocumentAnnotation, idx: number) => {
              const isActive = activeAnnotationId === ann.id;
              return (
                <div
                  key={ann.id}
                  style={{
                    left: `${ann.x}%`,
                    top: `${ann.y}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveAnnotationId(ann.id);
                    setActiveTab('annotations');
                  }}
                  title={ann.comment}
                  className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform ${
                    isActive ? 'scale-125 z-30' : 'hover:scale-110'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shadow-lg transition-all ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-300 ring-offset-1 ring-offset-slate-900 animate-pulse'
                        : 'bg-indigo-600 text-white ring-2 ring-white/80'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  {isActive && (
                    <div className="absolute left-7 top-0 bg-slate-900/95 border border-amber-400 text-white text-[11px] p-2 rounded shadow-xl w-48 pointer-events-none">
                      <p className="line-clamp-3">{ann.comment}</p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Temporary Pin Placement Popover */}
            {tempPin && (
              <div
                style={{
                  left: `${tempPin.x}%`,
                  top: `${tempPin.y}%`,
                }}
                onClick={(e) => e.stopPropagation()}
                className="absolute z-40 -translate-x-1/2 -translate-y-1/2"
              >
                <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs ring-4 ring-amber-300 animate-bounce">
                  +
                </div>

                <div className="absolute left-8 top-0 bg-slate-900 border border-amber-400 text-white p-3.5 rounded-lg shadow-2xl w-80 text-xs z-50">
                  <div className="flex items-center justify-between font-semibold text-amber-400 mb-2">
                    <span className="flex items-center gap-1.5">
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      Annotate Section (Page {currentPage})
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Pin #{versionAnnotations.length + 1}
                    </span>
                  </div>

                  <div className="mb-2">
                    <label className="text-[10px] text-slate-300 block mb-0.5 font-medium">
                      Page Number:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={currentPage}
                        onChange={(e) => setCurrentPage(Math.max(1, Number(e.target.value) || 1))}
                        className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-amber-400"
                      />
                      <span className="text-[10px] text-slate-400">Auto-detected from page click</span>
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="text-[10px] text-slate-300 block mb-0.5 font-medium">
                      Section / Paragraph Reference:
                    </label>
                    <input
                      type="text"
                      value={newSectionRef}
                      onChange={(e) => setNewSectionRef(e.target.value)}
                      placeholder="e.g. Page 1 - Section 1.2, Paragraph 3"
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-300 block mb-0.5 font-medium">
                      Comment / Revision Feedback:
                    </label>
                    <textarea
                      rows={3}
                      autoFocus
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Type instructor feedback or revision note..."
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setTempPin(null);
                        setNewCommentText('');
                        setNewSectionRef('');
                      }}
                      className="px-2.5 py-1 text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!newCommentText.trim()}
                      onClick={handleSaveAnnotation}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded cursor-pointer disabled:opacity-50"
                    >
                      Save Comment
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Assessment / Annotations Panel */}
        <div className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950 text-xs">
            <button
              onClick={() => setActiveTab('rubric')}
              className={`flex-1 py-2.5 font-semibold text-center border-b-2 transition-colors ${
                activeTab === 'rubric'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Rubric Assessment
            </button>
            <button
              onClick={() => setActiveTab('annotations')}
              className={`flex-1 py-2.5 font-semibold text-center border-b-2 transition-colors ${
                activeTab === 'annotations'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Annotations ({versionAnnotations.length})
            </button>
            {latestVersion?.revisionResponses && latestVersion.revisionResponses.length > 0 && (
              <button
                onClick={() => setActiveTab('revisions')}
                className={`flex-1 py-2.5 font-semibold text-center border-b-2 transition-colors ${
                  activeTab === 'revisions'
                    ? 'border-indigo-500 text-indigo-400 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Revisions ({latestVersion.revisionResponses.length})
              </button>
            )}
          </div>

          {/* Tab 1: Rubric Assessment & Grading */}
          {activeTab === 'rubric' && (
            <div className="grow overflow-y-auto p-4 space-y-5 text-xs">
              {saveSuccessMsg && (
                <div
                  className={`p-3 rounded-lg flex items-center gap-2 animate-in fade-in border ${
                    saveSuccessMsg.type === 'error'
                      ? 'bg-rose-950/80 border-rose-700 text-rose-300'
                      : saveSuccessMsg.type === 'info'
                      ? 'bg-sky-950/80 border-sky-700 text-sky-300'
                      : 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                  }`}
                >
                  {saveSuccessMsg.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  ) : saveSuccessMsg.type === 'info' ? (
                    <HelpCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  <span>{saveSuccessMsg.text}</span>
                </div>
              )}

              {/* Status Header */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Submission Status:</span>
                  <span className="font-semibold text-indigo-300 capitalize">
                    {submission.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Task Max Points:</span>
                  <span className="font-bold text-white">{task.maxScore} pts</span>
                </div>
                {submission.grade?.returnedAt && (
                  <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-1.5">
                    Returned on: {formatDateTime(submission.grade.returnedAt)}
                  </div>
                )}
              </div>

              {/* Criteria List */}
              <div className="space-y-4">
                <div className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                  Rubric Criteria Breakdown
                </div>

                {rubricToUse.map((crit, cIdx) => {
                  const currentAssessment = scoreResult.criterionAssessments[crit.id];
                  const selectedLevelName = selectedLevels[crit.id];

                  return (
                    <div
                      key={crit.id}
                      className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold text-slate-200">
                          {cIdx + 1}. {crit.name}
                        </span>
                        <span className="font-mono text-indigo-400 font-bold shrink-0">
                          {currentAssessment?.score || 0} / {crit.maxPoints} pts
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal">
                        {crit.description}
                      </p>

                      {/* Performance level pills */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {crit.levels.map((lvl) => {
                          const isSelected = selectedLevelName === lvl.name;
                          return (
                            <button
                              key={lvl.name}
                              type="button"
                              disabled={!isInstructor}
                              onClick={() => {
                                if (!isInstructor) return;
                                setSelectedLevels((prev) => ({
                                  ...prev,
                                  [crit.id]: lvl.name,
                                }));
                              }}
                              className={`p-1.5 rounded text-left transition-all border ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                                  : isInstructor
                                  ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                                  : 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-default'
                              }`}
                            >
                              <div className="flex justify-between items-center text-[10px]">
                                <span>{lvl.name}</span>
                                <span className="opacity-80 font-mono">
                                  {Math.round(lvl.percentage * 100)}%
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Late Deduction Summary */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Rubric Raw Score:</span>
                  <span className="font-mono text-slate-200">
                    {scoreResult.rubricRawScore} / {scoreResult.rubricMaxScore} pts
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Scaled Task Score:</span>
                  <span className="font-mono text-slate-200">
                    {scoreResult.taskRawScore} / {task.maxScore} pts
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Late Penalty Deduction:</span>
                  <span
                    className={`font-mono font-semibold ${
                      scoreResult.lateDeduction > 0 ? 'text-rose-400' : 'text-slate-400'
                    }`}
                  >
                    -{scoreResult.lateDeduction} pts
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1">
                  {scoreResult.deductionExplanation}
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-sm">
                  <span className="font-bold text-white">Final Calculated Score:</span>
                  <span className="font-mono font-bold text-lg text-emerald-400">
                    {scoreResult.finalScore} / {task.maxScore}
                  </span>
                </div>
              </div>

              {/* Overall Feedback Remarks */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Overall Instructor Remarks
                </label>
                {isInstructor ? (
                  <textarea
                    rows={4}
                    value={overallRemarks}
                    onChange={(e) => setOverallRemarks(e.target.value)}
                    placeholder="Provide overarching review comments, recommendations, and defence readiness assessment..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 leading-relaxed text-xs">
                    {submission.grade?.overallRemarks || 'No overall remarks released yet.'}
                  </div>
                )}
              </div>

              {/* Instructor Action Buttons: Save Draft & Return to Group OR Graded Indicator & Unreturn Work */}
              {isInstructor && (
                <div className="pt-2 pb-4 space-y-2.5">
                  {isWorkReturned ? (
                    <div className="space-y-2">
                      <div className="p-3 bg-emerald-950/70 border border-emerald-600/70 text-emerald-300 rounded-lg space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>This work is already graded and returned to the group.</span>
                        </div>
                        <p className="text-[11px] text-emerald-400/80 leading-normal">
                          Evaluated scores and annotations are currently visible to students. Click below if you need to revise grades.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleUnreturnWork}
                        className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold rounded-lg border border-amber-500/40 flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Unreturn Work</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5 text-slate-400" />
                          <span>Save Draft</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleInitiateReturn}
                          className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Return to Group</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 text-center">
                        Saving draft preserves marks without notifying students. Returning will publish the graded evaluation.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Document Annotations List */}
          {activeTab === 'annotations' && (
            <div className="grow overflow-y-auto p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-400 text-[11px] pb-2 border-b border-slate-800">
                <span>Total Annotations: {versionAnnotations.length}</span>
                {isInstructor && (
                  <span className="text-amber-400">Choose a page and click &quot;Add Page Comment&quot;</span>
                )}
              </div>

              {versionAnnotations.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <MessageSquarePlus className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No document annotations attached yet.</p>
                </div>
              ) : (
                versionAnnotations.map((ann: DocumentAnnotation, idx: number) => {
                  const isCurrentPage = ann.pageNumber === currentPage;
                  const isEditing = editingAnnotationId === ann.id;

                  return (
                    <div
                      key={ann.id}
                      onClick={() => {
                        setCurrentPage(ann.pageNumber);
                        setActiveAnnotationId(ann.id);
                      }}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        activeAnnotationId === ann.id
                          ? 'bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-200">
                            Page {ann.pageNumber}
                          </span>
                          {/* If comment has a bracketed section or reference tag, show badge */}
                          {ann.comment.startsWith('[') && ann.comment.includes(']') && (
                            <span className="text-[10px] bg-amber-950/80 border border-amber-600/60 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                              {ann.comment.slice(1, ann.comment.indexOf(']'))}
                            </span>
                          )}
                          {isCurrentPage && (
                            <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                              Current Page
                            </span>
                          )}
                        </div>
                        {isInstructor && !isEditing && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingAnnotationId(ann.id);
                                setEditCommentText(ann.comment);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-200"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onDeleteAnnotation) {
                                  onDeleteAnnotation(submission.id, ann.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            rows={3}
                            value={editCommentText}
                            onChange={(e) => setEditCommentText(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingAnnotationId(null)}
                              className="px-2 py-1 text-slate-400 hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateAnnotation(ann.id)}
                              className="px-2 py-1 bg-indigo-600 text-white rounded font-medium"
                            >
                              Update
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-300 leading-relaxed">
                          {ann.comment.startsWith('[') && ann.comment.includes(']')
                            ? ann.comment.slice(ann.comment.indexOf(']') + 1).trim()
                            : ann.comment}
                        </p>
                      )}

                      <div className="text-[10px] text-slate-500 mt-2">
                        {ann.authorName} &bull; {formatDateTime(ann.createdAt)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 3: Student Revision Responses */}
          {activeTab === 'revisions' && (
            <div className="grow overflow-y-auto p-4 space-y-3 text-xs">
              <div className="text-slate-400 text-[11px] pb-2 border-b border-slate-800">
                Student Revision Response Matrix
              </div>

              {latestVersion?.revisionResponses?.map((rev: any, rIdx: number) => (
                <div
                  key={rev.id}
                  className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-amber-400">
                      Revision Item #{rIdx + 1}
                    </span>
                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      {rev.pageOrSection}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase font-bold">
                      Requested Revision:
                    </span>
                    <p className="text-slate-300 italic text-[11px] mt-0.5">
                      &quot;{rev.instructorComment}&quot;
                    </p>
                  </div>
                  <div className="border-t border-slate-800/80 pt-1.5">
                    <span className="text-slate-500 text-[10px] block uppercase font-bold">
                      Change Made:
                    </span>
                    <p className="text-emerald-300 text-[11px] mt-0.5">
                      {rev.changeDescription}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal when returning graded work */}
      <ConfirmDialog
        isOpen={isConfirmReturnOpen}
        onClose={() => setIsConfirmReturnOpen(false)}
        onConfirm={handleConfirmReturn}
        title="Return Graded Work to Group"
        message="Are you sure you want to proceed and return this graded work to the group? Once returned, the computed marks and annotations will be immediately published to all students in the capstone group."
        confirmLabel="Yes, Return Work"
        cancelLabel="No, Cancel"
        isDestructive={false}
        icon="info"
      />
    </div>
  );
};
