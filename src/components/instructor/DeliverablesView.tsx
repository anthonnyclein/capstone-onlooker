import React, { useState, useMemo } from 'react';
import {
  Deliverable,
  Task,
  RubricCriterion,
  LatePolicy,
  GroupTaskSubmission,
} from '../../types';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Archive,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FolderGit2,
  Calendar,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { formatDateTime, toDateTimeLocalValue } from '../../utils/dateUtils';
import { DEFAULT_PERFORMANCE_LEVELS } from '../../data/performanceLevels';
import { storage } from '../../services/storage';
import { flushFileStore } from '../../services/fileStore';

interface DeliverablesViewProps {
  deliverables: Deliverable[];
  tasks: Task[];
  submissions: GroupTaskSubmission[];
  onSaveDeliverables: (deliverables: Deliverable[]) => void;
  onSaveTasks: (tasks: Task[]) => void;
}

export const DeliverablesView: React.FC<DeliverablesViewProps> = ({
  deliverables,
  tasks,
  submissions,
  onSaveDeliverables,
  onSaveTasks,
}) => {
  // Selected Deliverable for accordion view
  const [expandedDeliverableId, setExpandedDeliverableId] = useState<string>(
    deliverables[0]?.id || ''
  );

  // Deliverable Modal State
  const [isDeliverableModalOpen, setIsDeliverableModalOpen] = useState(false);
  const [editingDeliverableId, setEditingDeliverableId] = useState<string | null>(null);
  const [delName, setDelName] = useState('');
  const [delDescription, setDelDescription] = useState('');
  const [delPoints, setDelPoints] = useState<number>(100);
  const [delCriteria, setDelCriteria] = useState<RubricCriterion[]>([]);
  const [deliverableFormErrors, setDeliverableFormErrors] = useState<string[]>([]);

  // Task Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [targetDeliverableIdForTask, setTargetDeliverableIdForTask] = useState<string>('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskName, setTaskName] = useState('');
  const [taskInstructions, setTaskInstructions] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskMaxScore, setTaskMaxScore] = useState<number>(100);
  const [taskStatus, setTaskStatus] = useState<'draft' | 'published'>('published');
  const [isRevisionTask, setIsRevisionTask] = useState(false);
  const [lateType, setLateType] = useState<'none' | 'fixed' | 'per_day'>('none');
  const [lateAmount, setLateAmount] = useState<number>(0);
  const [lateMaxDeduction, setLateMaxDeduction] = useState<number | undefined>(undefined);
  const [taskFormErrors, setTaskFormErrors] = useState<string[]>([]);

  // Deletion / Archival dialogs
  const [confirmDeleteDeliverable, setConfirmDeleteDeliverable] = useState<Deliverable | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<Task | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [archiveOptionDeliverable, setArchiveOptionDeliverable] = useState<Deliverable | null>(null);
  const [archiveOptionTask, setArchiveOptionTask] = useState<Task | null>(null);

  // Check submissions count for a deliverable / task
  const getSubmissionsForDeliverable = (delId: string) => {
    return submissions.filter((s) => s.deliverableId === delId);
  };

  const getSubmissionsForTask = (taskId: string) => {
    return submissions.filter((s) => s.taskId === taskId);
  };

  // --- Deliverable CRUD ---
  const handleOpenDeliverableModal = (del?: Deliverable) => {
    setDeliverableFormErrors([]);
    if (del) {
      setEditingDeliverableId(del.id);
      setDelName(del.name);
      setDelDescription(del.description);
      setDelPoints(del.totalPossiblePoints);
      setDelCriteria(JSON.parse(JSON.stringify(del.rubric)));
    } else {
      setEditingDeliverableId(null);
      setDelName('');
      setDelDescription('');
      setDelPoints(100);
      setDelCriteria([
        {
          id: `crit-${Date.now()}-1`,
          name: 'Problem Statement & Justification',
          description: 'Clarity, relevance, and evidence supporting the capstone problem.',
          maxPoints: 40,
          levels: DEFAULT_PERFORMANCE_LEVELS,
        },
        {
          id: `crit-${Date.now()}-2`,
          name: 'Objectives & Scope Alignment',
          description: 'Feasibility, SMART formulation, and well-bounded scope.',
          maxPoints: 30,
          levels: DEFAULT_PERFORMANCE_LEVELS,
        },
        {
          id: `crit-${Date.now()}-3`,
          name: 'Academic Rigor & Documentation',
          description: 'Adherence to formatting, APA citations, and grammar.',
          maxPoints: 30,
          levels: DEFAULT_PERFORMANCE_LEVELS,
        },
      ]);
    }
    setIsDeliverableModalOpen(true);
  };

  const handleAddCriterion = () => {
    setDelCriteria((prev) => [
      ...prev,
      {
        id: `crit-${Date.now()}`,
        name: 'New Rubric Criterion',
        description: 'Criterion performance indicators and scoring requirements.',
        maxPoints: 20,
        levels: DEFAULT_PERFORMANCE_LEVELS,
      },
    ]);
  };

  const handleRemoveCriterion = (idx: number) => {
    if (delCriteria.length <= 1) return;
    setDelCriteria((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCriterionChange = (idx: number, field: string, value: any) => {
    setDelCriteria((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  };

  const handleCriterionLevelChange = (
    cIdx: number,
    lIdx: number,
    percentage: number
  ) => {
    setDelCriteria((prev) =>
      prev.map((c, i) => {
        if (i !== cIdx) return c;
        const newLevels = c.levels.map((lvl, j) =>
          j === lIdx ? { ...lvl, percentage } : lvl
        );
        return { ...c, levels: newLevels };
      })
    );
  };

  const handleSubmitDeliverable = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    if (!delName.trim()) errors.push('Deliverable name is required.');
    if (!delDescription.trim()) errors.push('Deliverable description is required.');

    const criteriaSum = delCriteria.reduce((sum, c) => sum + Number(c.maxPoints || 0), 0);
    if (criteriaSum !== Number(delPoints)) {
      errors.push(
        `Rubric validation failed: The sum of criterion maximum points (${criteriaSum} pts) must equal the Deliverable total possible points (${delPoints} pts).`
      );
    }

    if (errors.length > 0) {
      setDeliverableFormErrors(errors);
      return;
    }

    if (editingDeliverableId) {
      const updated = deliverables.map((d) =>
        d.id === editingDeliverableId
          ? {
              ...d,
              name: delName.trim(),
              description: delDescription.trim(),
              totalPossiblePoints: Number(delPoints),
              rubric: delCriteria,
            }
          : d
      );
      onSaveDeliverables(updated);
    } else {
      const newDel: Deliverable = {
        id: `del-${Date.now()}`,
        name: delName.trim(),
        description: delDescription.trim(),
        totalPossiblePoints: Number(delPoints),
        rubric: delCriteria,
        createdAt: new Date().toISOString(),
      };
      onSaveDeliverables([...deliverables, newDel]);
      setExpandedDeliverableId(newDel.id);
    }

    setIsDeliverableModalOpen(false);
  };

  const handleDeleteDeliverableClick = (del: Deliverable) => {
    const existingSubs = getSubmissionsForDeliverable(del.id);
    if (existingSubs.length > 0) {
      // Require confirmation before deletion. Prevent deletion when it would remove existing submissions or grades; offer archiving instead.
      setArchiveOptionDeliverable(del);
      return;
    }
    setConfirmDeleteDeliverable(del);
  };

  const handleArchiveDeliverable = () => {
    if (!archiveOptionDeliverable) return;
    const updated = deliverables.map((d) =>
      d.id === archiveOptionDeliverable.id ? { ...d, isArchived: true } : d
    );
    onSaveDeliverables(updated);
    setArchiveOptionDeliverable(null);
  };

  const handleExecuteDeleteDeliverable = () => {
    if (!confirmDeleteDeliverable) return;
    const updated = deliverables.filter((d) => d.id !== confirmDeleteDeliverable.id);
    onSaveDeliverables(updated);
    // Also remove orphaned tasks
    const updatedTasks = tasks.filter((t) => t.deliverableId !== confirmDeleteDeliverable.id);
    onSaveTasks(updatedTasks);
    setConfirmDeleteDeliverable(null);
  };

  // --- Task CRUD ---
  const handleOpenTaskModal = (delId: string, task?: Task) => {
    setTaskFormErrors([]);
    setTargetDeliverableIdForTask(delId);
    if (task) {
      setEditingTaskId(task.id);
      setTaskName(task.name);
      setTaskInstructions(task.instructions);
      setTaskDeadline(toDateTimeLocalValue(task.deadline));
      setTaskMaxScore(task.maxScore);
      setTaskStatus(task.status);
      setIsRevisionTask(!!task.isRevisionTask);
      setLateType(task.latePolicy.type);
      setLateAmount(task.latePolicy.deductionAmount || 0);
      setLateMaxDeduction(task.latePolicy.maxDeduction);
    } else {
      const parentDel = deliverables.find((d) => d.id === delId);
      setEditingTaskId(null);
      setTaskName('');
      setTaskInstructions('');
      // Default deadline: 7 days from now
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(23, 59, 0, 0);
      setTaskDeadline(toDateTimeLocalValue(d.toISOString()));
      setTaskMaxScore(parentDel?.totalPossiblePoints || 100);
      setTaskStatus('published');
      setIsRevisionTask(false);
      setLateType('none');
      setLateAmount(0);
      setLateMaxDeduction(undefined);
    }
    setIsTaskModalOpen(true);
  };

  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    if (!taskName.trim()) errors.push('Task name is required.');
    if (!taskInstructions.trim()) errors.push('Instructions or revision requirements are required.');
    if (!taskDeadline) errors.push('Deadline date and time is required.');
    if (taskMaxScore <= 0) errors.push('Maximum task score must be greater than 0.');

    if (errors.length > 0) {
      setTaskFormErrors(errors);
      return;
    }

    const latePolicy: LatePolicy = {
      type: lateType,
      deductionAmount: Number(lateAmount || 0),
      maxDeduction: lateMaxDeduction ? Number(lateMaxDeduction) : undefined,
    };

    const deadlineIso = new Date(taskDeadline + ':00+08:00').toISOString();

    if (editingTaskId) {
      const updated = tasks.map((t) =>
        t.id === editingTaskId
          ? {
              ...t,
              name: taskName.trim(),
              instructions: taskInstructions.trim(),
              deadline: deadlineIso,
              maxScore: Number(taskMaxScore),
              latePolicy,
              status: taskStatus,
              isRevisionTask,
            }
          : t
      );
      onSaveTasks(updated);
    } else {
      const newTask: Task = {
        id: `task-${Date.now()}`,
        deliverableId: targetDeliverableIdForTask,
        name: taskName.trim(),
        instructions: taskInstructions.trim(),
        deadline: deadlineIso,
        maxScore: Number(taskMaxScore),
        latePolicy,
        status: taskStatus,
        isRevisionTask,
        createdAt: new Date().toISOString(),
      };
      onSaveTasks([...tasks, newTask]);
    }

    setIsTaskModalOpen(false);
  };

  const handleDeleteTaskClick = (task: Task) => {
    setConfirmDeleteTask(task);
  };

  const handleArchiveTask = () => {
    if (!archiveOptionTask) return;
    const updated = tasks.map((t) =>
      t.id === archiveOptionTask.id ? { ...t, isArchived: true } : t
    );
    onSaveTasks(updated);
    setArchiveOptionTask(null);
  };

  const handleExecuteDeleteTask = async () => {
    if (!confirmDeleteTask || isDeletingTask) return;
    const targetTaskId = confirmDeleteTask.id;
    setIsDeletingTask(true);
    try {
      await storage.deleteTask(targetTaskId);
      onSaveTasks(tasks.filter((t) => t.id !== targetTaskId));
    } catch (err) {
      console.error('Failed to remove task:', err);
    } finally {
      setIsDeletingTask(false);
      setConfirmDeleteTask(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Deliverables & Revision Tasks
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Design proposal deliverables, establish weighted rubric criteria, and manage initial and revision task cycles.
          </p>
        </div>
        <button
          onClick={() => handleOpenDeliverableModal()}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Create Deliverable
        </button>
      </div>

      {/* Deliverables Accordion List */}
      <div className="space-y-4">
        {deliverables.map((del) => {
          const isExpanded = expandedDeliverableId === del.id;
          const deliverableTasks = tasks.filter(
            (t) => t.deliverableId === del.id && !t.isArchived
          );
          const existingSubs = getSubmissionsForDeliverable(del.id);

          return (
            <div
              key={del.id}
              className={`bg-white rounded-xl border transition-all shadow-xs overflow-hidden ${
                isExpanded ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200'
              }`}
            >
              {/* Deliverable Header Banner */}
              <div
                onClick={() => setExpandedDeliverableId(isExpanded ? '' : del.id)}
                className="p-5 bg-slate-50/70 hover:bg-slate-50 cursor-pointer flex items-center justify-between flex-wrap gap-3 transition-colors border-b border-slate-100"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-lg shrink-0 mt-0.5">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900">{del.name}</h3>
                      {del.isArchived && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                          Archived
                        </span>
                      )}
                      <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {del.totalPossiblePoints} Possible Points
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                      {del.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDeliverableModal(del);
                    }}
                    title="Edit Deliverable & Rubric"
                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-white"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDeliverableClick(del);
                    }}
                    title="Delete or Archive Deliverable"
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="p-1 text-slate-400">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Expanded Content: Rubric Criteria + Associated Tasks */}
              {isExpanded && (
                <div className="p-5 space-y-6">
                  {/* Rubric Criteria Summary */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        Default Grading Rubric ({del.rubric.length} Criteria &bull; {del.totalPossiblePoints} pts)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {del.rubric.map((crit, idx) => (
                        <div
                          key={crit.id}
                          className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-slate-900">
                              {idx + 1}. {crit.name}
                            </span>
                            <span className="font-mono font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                              {crit.maxPoints} pts
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            {crit.description}
                          </p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {crit.levels.map((lvl) => (
                              <span
                                key={lvl.name}
                                className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 rounded"
                              >
                                {lvl.name} ({Math.round(lvl.percentage * 100)}%)
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tasks in Deliverable */}
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <FolderGit2 className="w-4 h-4 text-indigo-600" />
                          Tasks and Revisions
                        </h4>
                        <span className="text-xs text-slate-500">
                          Initial submissions and subsequent revision requirements for this deliverable.
                        </span>
                      </div>

                      <button
                        onClick={() => handleOpenTaskModal(del.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create Task in {del.name.split(':')[0]}
                      </button>
                    </div>

                    <div className="space-y-3">
                      {deliverableTasks.length === 0 ? (
                        <div className="text-center py-6 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
                          No tasks created yet in this deliverable. Click &quot;Create Task&quot; above.
                        </div>
                      ) : (
                        deliverableTasks.map((t) => {
                          const subCount = getSubmissionsForTask(t.id).length;
                          const isRevision = t.isRevisionTask;

                          return (
                            <div
                              key={t.id}
                              className="p-4 rounded-lg bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex items-start justify-between gap-4 flex-wrap"
                            >
                              <div className="space-y-1.5 flex-1 min-w-[280px]">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-slate-900">
                                    {t.name}
                                  </span>
                                  {isRevision && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded">
                                      Revision Task
                                    </span>
                                  )}
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                      t.status === 'published'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}
                                  >
                                    {t.status === 'published' ? 'Published' : 'Draft'}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-600 leading-relaxed">
                                  {t.instructions}
                                </p>

                                <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 flex-wrap">
                                  <span className="flex items-center gap-1 font-medium text-slate-700">
                                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                                    Deadline: {formatDateTime(t.deadline)}
                                  </span>
                                  <span>&bull;</span>
                                  <span>Max Score: <strong>{t.maxScore} pts</strong></span>
                                  <span>&bull;</span>
                                  <span>
                                    Late Policy:{' '}
                                    <strong>
                                      {t.latePolicy.type === 'none'
                                        ? 'No deduction'
                                        : t.latePolicy.type === 'fixed'
                                        ? `Fixed -${t.latePolicy.deductionAmount} pts`
                                        : `-${t.latePolicy.deductionAmount} pts/day`}
                                    </strong>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right text-xs text-slate-500 mr-2">
                                  <span className="font-semibold text-indigo-700">{subCount}</span> group submissions
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenTaskModal(del.id, t)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTaskClick(t)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Deliverable Modal (with Rubric Builder) */}
      <Modal
        isOpen={isDeliverableModalOpen}
        onClose={() => setIsDeliverableModalOpen(false)}
        title={editingDeliverableId ? 'Edit Deliverable & Rubric' : 'Create Deliverable & Rubric'}
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmitDeliverable} className="space-y-4">
          {deliverableFormErrors.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 space-y-1">
              <div className="font-semibold flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Please fix validation errors:
              </div>
              <ul className="list-disc list-inside">
                {deliverableFormErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deliverable Name *
              </label>
              <input
                type="text"
                value={delName}
                onChange={(e) => setDelName(e.target.value)}
                placeholder="e.g. Chapter 1: The Problem and Its Background"
                required
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Total Possible Points *
              </label>
              <input
                type="number"
                min="10"
                value={delPoints}
                onChange={(e) => setDelPoints(Number(e.target.value))}
                required
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Instructions or Description *
            </label>
            <textarea
              rows={2}
              value={delDescription}
              onChange={(e) => setDelDescription(e.target.value)}
              placeholder="Scope and formatting guidelines for this deliverable..."
              required
              className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Rubric Criteria Builder */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                  Grading Rubric Criteria
                </span>
                <span className="text-[11px] text-slate-500">
                  Total of criteria max points must equal {delPoints} pts (Current sum:{' '}
                  <strong className="text-indigo-700">
                    {delCriteria.reduce((sum, c) => sum + Number(c.maxPoints || 0), 0)} pts
                  </strong>
                  ).
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddCriterion}
                className="px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Criterion
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {delCriteria.map((crit, cIdx) => (
                <div
                  key={crit.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-700">
                      Criterion #{cIdx + 1}
                    </span>
                    {delCriteria.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCriterion(cIdx)}
                        className="text-[11px] text-rose-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        value={crit.name}
                        onChange={(e) => handleCriterionChange(cIdx, 'name', e.target.value)}
                        placeholder="Criterion title"
                        required
                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          value={crit.maxPoints}
                          onChange={(e) => handleCriterionChange(cIdx, 'maxPoints', Number(e.target.value))}
                          required
                          className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-bold"
                        />
                        <span className="text-slate-500 text-[11px]">pts</span>
                      </div>
                    </div>
                  </div>

                  <textarea
                    rows={1}
                    value={crit.description}
                    onChange={(e) => handleCriterionChange(cIdx, 'description', e.target.value)}
                    placeholder="Criterion description / standard..."
                    className="w-full text-[11px] p-1.5 border border-slate-300 rounded bg-white text-slate-600"
                  />

                  {/* Performance levels percentage editor */}
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Performance Levels (% of criterion max):
                    </span>
                    <div className="grid grid-cols-5 gap-1 text-center text-[10px]">
                      {crit.levels.map((lvl, lIdx) => (
                        <div key={lvl.name} className="p-1 bg-slate-50 rounded">
                          <span className="block font-medium text-slate-700">{lvl.name}</span>
                          <div className="flex items-center justify-center mt-0.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={Math.round(lvl.percentage * 100)}
                              onChange={(e) =>
                                handleCriterionLevelChange(
                                  cIdx,
                                  lIdx,
                                  Number(e.target.value) / 100
                                )
                              }
                              className="w-10 text-center font-mono border border-slate-300 rounded text-[10px] py-0.5"
                            />
                            <span className="text-slate-400 ml-0.5">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDeliverableModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              {editingDeliverableId ? 'Save Deliverable & Rubric' : 'Create Deliverable'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Task Modal */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title={editingTaskId ? 'Edit Task' : 'Create Task in Deliverable'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitTask} className="space-y-4">
          {taskFormErrors.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 space-y-1">
              {taskFormErrors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Task Name *
            </label>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g. Chapter 1 - Initial Proposal Submission"
              required
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Instructions or Revision Requirements *
            </label>
            <textarea
              rows={3}
              value={taskInstructions}
              onChange={(e) => setTaskInstructions(e.target.value)}
              placeholder="Provide exact deliverables, formatting standards, or panel revision requirements..."
              required
              className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deadline (Asia/Manila PHT) *
              </label>
              <input
                type="datetime-local"
                value={taskDeadline}
                onChange={(e) => setTaskDeadline(e.target.value)}
                required
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Maximum Task Score *
              </label>
              <input
                type="number"
                min="1"
                value={taskMaxScore}
                onChange={(e) => setTaskMaxScore(Number(e.target.value))}
                required
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-bold"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Rubric score is automatically scaled if this differs from deliverable rubric total.
              </span>
            </div>
          </div>

          {/* Revision Task & Publish Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div>
              <span className="font-semibold text-slate-700 block mb-1">Task Type:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRevisionTask}
                  onChange={(e) => setIsRevisionTask(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>This is a Revision Task (requires revision matrix)</span>
              </label>
            </div>

            <div>
              <span className="font-semibold text-slate-700 block mb-1">Publish Status:</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="published"
                    checked={taskStatus === 'published'}
                    onChange={() => setTaskStatus('published')}
                  />
                  <span>Published (Visible to students)</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="draft"
                    checked={taskStatus === 'draft'}
                    onChange={() => setTaskStatus('draft')}
                  />
                  <span>Draft</span>
                </label>
              </div>
            </div>
          </div>

          {/* Late-submission deduction policy */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-xs">
            <span className="font-bold text-slate-800 uppercase tracking-wider block">
              Late Submission Deduction Policy
            </span>

            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="lateType"
                  value="none"
                  checked={lateType === 'none'}
                  onChange={() => setLateType('none')}
                />
                <span>No deduction</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="lateType"
                  value="fixed"
                  checked={lateType === 'fixed'}
                  onChange={() => setLateType('fixed')}
                />
                <span>Fixed point deduction</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="lateType"
                  value="per_day"
                  checked={lateType === 'per_day'}
                  onChange={() => setLateType('per_day')}
                />
                <span>Point deduction per day late</span>
              </label>
            </div>

            {lateType !== 'none' && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {lateType === 'fixed' ? 'Fixed Points Deducted' : 'Points Deducted Per Day Late'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={lateAmount}
                    onChange={(e) => setLateAmount(Number(e.target.value))}
                    className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Optional Maximum Deduction
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={lateMaxDeduction ?? ''}
                    onChange={(e) =>
                      setLateMaxDeduction(e.target.value ? Number(e.target.value) : undefined)
                    }
                    placeholder="None (unlimited)"
                    className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              {editingTaskId ? 'Save Task Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Archive Option for Deliverable with Existing Submissions */}
      {archiveOptionDeliverable && (
        <Modal
          isOpen={true}
          onClose={() => setArchiveOptionDeliverable(null)}
          title="Deletion Restrained: Existing Submissions Recorded"
          maxWidth="md"
        >
          <div className="flex gap-3 items-start pt-1 pb-2">
            <Archive className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">
              &quot;{archiveOptionDeliverable.name}&quot; cannot be permanently deleted because capstone groups have already submitted work or received grades under it. Would you like to <strong>Archive</strong> this deliverable instead to preserve student records?
            </p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setArchiveOptionDeliverable(null)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleArchiveDeliverable}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
            >
              Archive Deliverable
            </button>
          </div>
        </Modal>
      )}

      {/* Archive Option for Task with Existing Submissions */}
      {archiveOptionTask && (
        <Modal
          isOpen={true}
          onClose={() => setArchiveOptionTask(null)}
          title="Archive Task with Submissions"
          maxWidth="md"
        >
          <div className="flex gap-3 items-start pt-1 pb-2">
            <Archive className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">
              Task &quot;{archiveOptionTask.name}&quot; contains active student submissions. It cannot be permanently destroyed without losing student records. Would you like to archive this task instead?
            </p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setArchiveOptionTask(null)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleArchiveTask}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
            >
              Archive Task
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Deliverable Confirm (No submissions) */}
      <ConfirmDialog
        isOpen={!!confirmDeleteDeliverable}
        onClose={() => setConfirmDeleteDeliverable(null)}
        onConfirm={handleExecuteDeleteDeliverable}
        title="Delete Deliverable Confirmation"
        message={`Are you sure you want to permanently delete "${confirmDeleteDeliverable?.name}" and all tasks under it?`}
        confirmLabel="Delete Deliverable"
      />

      {/* Delete Task Confirm */}
      <ConfirmDialog
        isOpen={!!confirmDeleteTask}
        onClose={() => {
          if (!isDeletingTask) setConfirmDeleteTask(null);
        }}
        onConfirm={handleExecuteDeleteTask}
        title="Remove Task Confirmation"
        message={`Are you sure you want to proceed with removing task "${confirmDeleteTask?.name}"? Confirming will permanently remove this task and cascade delete all affected records (submissions, uploaded files, annotations, and grades) in the database.`}
        confirmLabel={isDeletingTask ? 'Removing...' : 'Proceed'}
        cancelLabel="Cancel"
        isDestructive={true}
      />
    </div>
  );
};
