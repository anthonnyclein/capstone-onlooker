import { validateSchedule } from '../../utils/schedule';
import React, { useState } from 'react';
import {
  Group,
  DefenseAttempt,
  UserAccount,
  DefenseReportProposal,
  DefenseSignature,
} from '../../types';
import { ProposalReportModal } from '../panel/ProposalReportModal';
import { AddPanelAccountModal } from './AddPanelAccountModal';
import { PanelWorkloadSummary } from './PanelWorkloadSummary';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { storage } from '../../services/storage';
import { generateInitialsAvatarSvg } from '../../utils/avatar';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Shield,
  Plus,
  Edit2,
  Lock,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Award,
  BookOpen,
  FileCheck,
  RotateCcw,
  History,
  X,
  Star,
  Search,
  Sparkles,
  BarChart3,
  UserCheck,
  Filter,
  Trash2,
} from 'lucide-react';

interface DefenseSchedulingViewProps {
  groups: Group[];
  defenseAttempts?: DefenseAttempt[];
  allAccounts?: UserAccount[];
  accounts?: UserAccount[];
  currentUser: UserAccount;
  onSaveAttempt?: (attempt: DefenseAttempt) => void;
  onDeleteAttempt?: (attemptId: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const DefenseSchedulingView: React.FC<DefenseSchedulingViewProps> = ({
  groups,
  defenseAttempts = [],
  allAccounts,
  accounts,
  currentUser,
  onSaveAttempt,
  onDeleteAttempt,
}) => {
  const resolvedAccounts = allAccounts || accounts || storage.getAccounts();
  const resolvedAttempts = defenseAttempts && defenseAttempts.length > 0 ? defenseAttempts : storage.getDefenseAttempts();
  // Panel account roster
  const panelAccounts = resolvedAccounts.filter((a) => a.role === 'panel');

  // View switch: 'schedules' or 'workload'
  const [activeSubView, setActiveSubView] = useState<'schedules' | 'workload'>('schedules');
  const [panelFilterId, setPanelFilterId] = useState<string>('all');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<'all' | 'scheduled' | 'unscheduled'>('all');

  // Modal states
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [isAddPanelModalOpen, setIsAddPanelModalOpen] = useState<boolean>(false);
  const [editingAttempt, setEditingAttempt] = useState<DefenseAttempt | null>(null);
  const [redefenseTargetGroup, setRedefenseTargetGroup] = useState<Group | null>(null);
  const [redefensePreviousAttempt, setRedefensePreviousAttempt] = useState<DefenseAttempt | null>(
    null
  );
  const [attemptToReset, setAttemptToReset] = useState<DefenseAttempt | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Form states
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [defenseDate, setDefenseDate] = useState<string>('');
  const [defenseTime, setDefenseTime] = useState<string>('09:00');
  const [venue, setVenue] = useState<string>('');
  const [selectedPanelIds, setSelectedPanelIds] = useState<string[]>([]);
  const [selectedLeadPanelId, setSelectedLeadPanelId] = useState<string>('');
  const [formConflictError, setFormConflictError] = useState<string | null>(null);
  const [modalPanelSearch, setModalPanelSearch] = useState<string>('');

  // Expanded score breakdown cards
  const [expandedAttemptIds, setExpandedAttemptIds] = useState<Record<string, boolean>>({});

  // View Proposal Report Modal
  const [viewingReportAttempt, setViewingReportAttempt] = useState<DefenseAttempt | null>(null);

  const toggleExpand = (attemptId: string) => {
    setExpandedAttemptIds((prev) => ({
      ...prev,
      [attemptId]: !prev[attemptId],
    }));
  };

  const getPanelName = (panelId: string): string => {
    const acc = resolvedAccounts.find((a) => a.id === panelId);
    if (!acc) return panelId;
    return `${acc.academicTitle ? acc.academicTitle + ' ' : ''}${acc.firstName} ${acc.lastName}`;
  };

  // Helper to compute how many groups a panel member is assigned to
  const getPanelAssignedGroupsCount = (panelId: string): number => {
    const assignedAttempts = resolvedAttempts.filter((a) => a.panelMemberIds.includes(panelId));
    const uniqueGroupIds = new Set(assignedAttempts.map((a) => a.groupId));
    return uniqueGroupIds.size;
  };

  const hasAnyEvaluations = (attempt: DefenseAttempt): boolean => {
    const presCount = Object.keys(attempt.presentationEvaluations || {}).length;
    const manuCount = Object.keys(attempt.manuscriptEvaluations || {}).length;
    return presCount > 0 || manuCount > 0;
  };

  const hasSignedReport = (attempt: DefenseAttempt): boolean => {
    return Boolean(attempt.report?.signatures && attempt.report.signatures.length > 0);
  };

  // Open modal for new schedule
  const handleOpenNewSchedule = (group?: Group, preselectedPanelId?: string) => {
    setEditingAttempt(null);
    setRedefenseTargetGroup(null);
    setRedefensePreviousAttempt(null);
    setSelectedGroupId(group ? group.id : groups[0]?.id || '');
    setDefenseDate(new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0]);
    setDefenseTime('10:00');
    setVenue('');
    setModalPanelSearch('');

    if (preselectedPanelId) {
      // If opened from a specific panelist
      const defaultPanels = [preselectedPanelId];
      // Add other panels up to 3
      const others = panelAccounts.filter((p) => p.id !== preselectedPanelId).slice(0, 2).map((p) => p.id);
      setSelectedPanelIds([...defaultPanels, ...others]);
      setSelectedLeadPanelId(preselectedPanelId);
    } else {
      setSelectedPanelIds([]);
      setSelectedLeadPanelId('');
    }

    setFormConflictError(null);
    setIsScheduleModalOpen(true);
  };

  // Open modal for editing schedule (only if unlocked / no signed report)
  const handleOpenEditSchedule = (attempt: DefenseAttempt) => {
    if (hasSignedReport(attempt)) {
      alert('This defense schedule and result cannot be edited because the official defense report has already been signed by the panel committee.');
      return;
    }
    setEditingAttempt(attempt);
    setRedefenseTargetGroup(null);
    setRedefensePreviousAttempt(null);
    setSelectedGroupId(attempt.groupId);
    setDefenseDate(attempt.defenseDate);
    setDefenseTime(attempt.defenseTime);
    setVenue(attempt.venue);
    setSelectedPanelIds([...attempt.panelMemberIds]);
    setSelectedLeadPanelId(attempt.leadPanelId);
    setModalPanelSearch('');
    setFormConflictError(null);
    setIsScheduleModalOpen(true);
  };

  // Prompt coordinator to reset defense schedule, assigned panels, and scores from database
  const handlePromptReset = (attempt: DefenseAttempt) => {
    if (hasSignedReport(attempt)) {
      alert('Cannot reset this defense because the official defense report has already been signed by the panel committee.');
      return;
    }
    setAttemptToReset(attempt);
  };

  // Execute reset: cascade delete attempt and its scores, assigned panels, and schedules
  const handleConfirmReset = async () => {
    if (!attemptToReset || isResetting) return;
    const targetId = attemptToReset.id;
    setIsResetting(true);
    try {
      if (onDeleteAttempt) {
        onDeleteAttempt(targetId);
      }
      await storage.deleteDefenseAttempt(targetId);
    } catch (err) {
      console.error('Failed to reset defense attempt:', err);
    } finally {
      setIsResetting(false);
      setAttemptToReset(null);
      if (isScheduleModalOpen && editingAttempt?.id === targetId) {
        setIsScheduleModalOpen(false);
      }
    }
  };

  // Open modal for Redefense
  const handleOpenRedefense = (group: Group, previousAttempt: DefenseAttempt) => {
    setEditingAttempt(null);
    setRedefenseTargetGroup(group);
    setRedefensePreviousAttempt(previousAttempt);
    setSelectedGroupId(group.id);
    setDefenseDate(new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]);
    setDefenseTime(previousAttempt.defenseTime);
    setVenue(previousAttempt.venue);
    setSelectedPanelIds([...previousAttempt.panelMemberIds]);
    setSelectedLeadPanelId(previousAttempt.leadPanelId);
    setModalPanelSearch('');
    setFormConflictError(null);
    setIsScheduleModalOpen(true);
  };

  // Toggle panel member selection
  const handleTogglePanel = (panelId: string) => {
    if (selectedPanelIds.includes(panelId)) {
      const updated = selectedPanelIds.filter((id) => id !== panelId);
      setSelectedPanelIds(updated);
      if (selectedLeadPanelId === panelId) {
        setSelectedLeadPanelId(updated[0] || '');
      }
    } else {
      const updated = [...selectedPanelIds, panelId];
      setSelectedPanelIds(updated);
      if (!selectedLeadPanelId) {
        setSelectedLeadPanelId(panelId);
      }
    }
    setFormConflictError(null);
  };

  // Designate lead panel
  const handleSetLeadPanel = (panelId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedPanelIds.includes(panelId)) {
      setSelectedPanelIds([...selectedPanelIds, panelId]);
    }
    setSelectedLeadPanelId(panelId);
    setFormConflictError(null);
  };

  // Save new panel account created by instructor
  const handleSaveNewPanelAccount = (newAccount: UserAccount) => {
    storage.addAccount(newAccount);
    // If schedule modal was open, automatically select this panel member
    if (isScheduleModalOpen) {
      setSelectedPanelIds((prev) => [...prev, newAccount.id]);
      if (!selectedLeadPanelId) {
        setSelectedLeadPanelId(newAccount.id);
      }
    }
  };

  // Validate conflict prevention engine
  const validateConflicts = () => validateSchedule({
    groupId: selectedGroupId, defenseDate, defenseTime, venue,
    panelMemberIds: selectedPanelIds, leadPanelId: selectedLeadPanelId,
  }, resolvedAttempts, editingAttempt?.id);

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();

    const conflict = validateConflicts();
    if (conflict) {
      setFormConflictError(conflict);
      return;
    }

    if (editingAttempt) {
      // Retain evaluations for panels that remain in selectedPanelIds
      const cleanPres: Record<string, any> = {};
      const cleanManu: Record<string, any> = {};
      for (const pid of selectedPanelIds) {
        if (editingAttempt.presentationEvaluations?.[pid]) {
          cleanPres[pid] = editingAttempt.presentationEvaluations[pid];
        }
        if (editingAttempt.manuscriptEvaluations?.[pid]) {
          cleanManu[pid] = editingAttempt.manuscriptEvaluations[pid];
        }
      }

      // Update existing attempt
      const updated: DefenseAttempt = {
        ...editingAttempt,
        defenseDate,
        defenseTime,
        venue,
        panelMemberIds: selectedPanelIds,
        leadPanelId: selectedLeadPanelId,
        presentationEvaluations: cleanPres,
        manuscriptEvaluations: cleanManu,
      };
      if (onSaveAttempt) {
        onSaveAttempt(updated);
      } else {
        storage.saveDefenseAttempt(updated);
      }
    } else {
      // Determine attempt number for this group
      const existingForGroup = resolvedAttempts.filter((a) => a.groupId === selectedGroupId);
      const attemptNumber = Math.max(0, ...existingForGroup.map(attempt => attempt.attemptNumber)) + 1;

      const newAttempt: DefenseAttempt = {
        id: `def-${selectedGroupId}-att-${attemptNumber}-${Date.now().toString().slice(-4)}`,
        groupId: selectedGroupId,
        attemptNumber,
        previousAttemptId: redefensePreviousAttempt?.id,
        defenseDate,
        defenseTime,
        venue,
        panelMemberIds: selectedPanelIds,
        leadPanelId: selectedLeadPanelId,
        createdAt: new Date().toISOString(),
        status: 'scheduled',
        presentationEvaluations: {},
        manuscriptEvaluations: {},
      };
      if (onSaveAttempt) {
        onSaveAttempt(newAttempt);
      } else {
        storage.saveDefenseAttempt(newAttempt);
      }
    }

    setIsScheduleModalOpen(false);
  };

  // Group attempts by group to show chronological histories
  const attemptsByGroup: Record<string, DefenseAttempt[]> = {};
  groups.forEach((g) => {
    attemptsByGroup[g.id] = resolvedAttempts
      .filter((a) => a.groupId === g.id)
      .sort((a, b) => a.attemptNumber - b.attemptNumber);
  });

  // Group counts for schedule status filtering
  const groupsWithScheduleCount = groups.filter((g) => (attemptsByGroup[g.id] || []).length > 0).length;
  const groupsWithoutScheduleCount = groups.filter((g) => (attemptsByGroup[g.id] || []).length === 0).length;

  // Filtered groups by schedule status and panel assignment
  const filteredGroups = groups.filter((group) => {
    const groupAttempts = attemptsByGroup[group.id] || [];

    // Schedule status filter: all, scheduled, or unscheduled
    if (scheduleStatusFilter === 'scheduled' && groupAttempts.length === 0) {
      return false;
    }
    if (scheduleStatusFilter === 'unscheduled' && groupAttempts.length > 0) {
      return false;
    }

    // Panelist assignment filter
    if (panelFilterId === 'all') return true;
    return groupAttempts.some((a) => a.panelMemberIds.includes(panelFilterId));
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Primary Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
              Oral Defense Administration
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Scheduling &bull; Panel Workload &bull; Evaluation Tracking
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Oral Defense Scheduling & Monitoring
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Coordinate defense committees, balance panel evaluator workloads, designate lead chairs, and track proposal attempts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center flex-wrap">
          <button
            onClick={() => setIsAddPanelModalOpen(true)}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-2"
          >
            <Users className="w-4 h-4 text-orange-600" />
            <span>Add Panel Account</span>
          </button>

          <button
            onClick={() => handleOpenNewSchedule()}
            className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Oral Defense</span>
          </button>
        </div>
      </div>

      {/* Sub-view Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubView('schedules')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeSubView === 'schedules'
                ? 'bg-orange-50 text-orange-700 border border-orange-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Defense Schedules & Timetable</span>
            <span className="px-1.5 py-0.2 bg-white/80 rounded-md text-[10px] text-slate-600 font-mono border border-slate-200">
              {groups.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubView('workload')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeSubView === 'workload'
                ? 'bg-orange-50 text-orange-700 border border-orange-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-orange-600" />
            <span>Panel Workload & Assignments Summary</span>
            <span className="px-1.5 py-0.2 bg-orange-100 rounded-md text-[10px] text-orange-800 font-mono font-bold">
              {panelAccounts.length} Panels
            </span>
          </button>
        </div>
      </div>

      {/* RENDER VIEW: Panel Workload & Assignments Summary */}
      {activeSubView === 'workload' && (
        <PanelWorkloadSummary
          panelAccounts={panelAccounts}
          groups={groups}
          defenseAttempts={resolvedAttempts}
          onOpenAddPanel={() => setIsAddPanelModalOpen(true)}
          onSelectGroupSchedule={(groupId) => {
            setActiveSubView('schedules');
            setPanelFilterId('all');
          }}
          onScheduleForPanel={(panelId) => {
            handleOpenNewSchedule(undefined, panelId);
          }}
        />
      )}

      {/* RENDER VIEW: Defense Schedules & Attempts List */}
      {activeSubView === 'schedules' && (
        <div className="space-y-6">
          {/* Filters Bar: Schedule Status & Panelist */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3.5">
            {/* 1. Schedule Status Filter: All Groups, With Defense Schedules, No Schedules Yet */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Calendar className="w-4 h-4 text-orange-600" />
                <span>Schedule Status:</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setScheduleStatusFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    scheduleStatusFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Groups ({groups.length})
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleStatusFilter('scheduled')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    scheduleStatusFilter === 'scheduled'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>With Defense Schedules ({groupsWithScheduleCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleStatusFilter('unscheduled')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    scheduleStatusFilter === 'unscheduled'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>No Schedules Yet ({groupsWithoutScheduleCount})</span>
                </button>
              </div>
            </div>

            {/* 2. Quick Filter by Panel Strip */}
            <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>Filter by Panelist:</span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto p-0.5 max-w-full flex-wrap">
                <button
                  type="button"
                  onClick={() => setPanelFilterId('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    panelFilterId === 'all'
                      ? 'bg-orange-600 text-white font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Panels ({groups.length} Groups)
                </button>

                {panelAccounts.map((p) => {
                  const assignedCount = getPanelAssignedGroupsCount(p.id);
                  const isSelected = panelFilterId === p.id;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPanelFilterId(isSelected ? 'all' : p.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-orange-600 text-white font-bold shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>
                        {p.academicTitle} {p.lastName}
                      </span>
                      <span
                        className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                          isSelected ? 'bg-orange-700 text-white' : 'bg-white/80 text-slate-700'
                        }`}
                      >
                        {assignedCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {filteredGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Groups Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {panelFilterId !== 'all' || scheduleStatusFilter !== 'all'
                  ? 'No capstone groups match the selected filter criteria.'
                  : 'No student capstone groups registered.'}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setScheduleStatusFilter('all');
                    setPanelFilterId('all');
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                >
                  Clear Filters
                </button>
                {panelFilterId !== 'all' && (
                  <button
                    type="button"
                    onClick={() => handleOpenNewSchedule(undefined, panelFilterId)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 shadow-xs cursor-pointer"
                  >
                    Assign Defense to this Panelist
                  </button>
                )}
              </div>
            </div>
          ) : (
            filteredGroups.map((group) => {
          const groupAttempts = attemptsByGroup[group.id] || [];
          const latestAttempt = groupAttempts[groupAttempts.length - 1];
          const hasRedefenseDecision =
            latestAttempt?.report?.decision === 'Re-defense' ||
            latestAttempt?.report?.decision === 'Failed';

          return (
            <div
              key={group.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
            >
              {/* Group Header Bar */}
              <div className="bg-slate-50 p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-orange-700 bg-orange-100/70 border border-orange-200 px-2.5 py-0.5 rounded-full">
                      {group.code || `Group ${group.id}`}
                    </span>
                    <span className="text-xs text-slate-500">
                      {group.members.length} Proponents:
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {group.members.map((m) => `${m.firstName} ${m.lastName}`).join(', ')}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mt-1">
                    {group.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  {hasRedefenseDecision && (
                    <button
                      onClick={() => handleOpenRedefense(group, latestAttempt)}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Schedule Redefense (Attempt {groupAttempts.length + 1})</span>
                    </button>
                  )}

                  {groupAttempts.length === 0 && (
                    <button
                      onClick={() => handleOpenNewSchedule(group)}
                      className="px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Defense Schedule</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Attempts Timeline */}
              {groupAttempts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No oral defense has been scheduled for this group yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {groupAttempts.map((attempt) => {
                    const isSigned = hasSignedReport(attempt);
                    const isExpanded = expandedAttemptIds[attempt.id];
                    const report = attempt.report;
                    const presCount = Object.keys(attempt.presentationEvaluations || {}).length;
                    const manuCount = Object.keys(attempt.manuscriptEvaluations || {}).length;
                    const totalPanels = attempt.panelMemberIds.length;
                    const hasScheduleAndPanel = Boolean(
                      attempt.defenseDate &&
                      attempt.panelMemberIds &&
                      attempt.panelMemberIds.length > 0
                    );
                    const canReset = hasScheduleAndPanel && !isSigned;
                    const canEdit = !isSigned;
                    const isRedefenseDecision =
                      report?.decision === 'Re-defense' || report?.decision === 'Failed';
                    const hasSubsequentAttempt = groupAttempts.some(
                      (a) => a.attemptNumber > attempt.attemptNumber
                    );

                    return (
                      <div key={attempt.id} className="p-4 sm:p-6 space-y-4">
                        {/* Attempt Top Info Bar */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <History className="w-3 h-3 text-slate-500" />
                                Attempt {attempt.attemptNumber}
                              </span>

                              {/* Lock / Editable Status */}
                              {isSigned ? (
                                <span
                                  className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-slate-300"
                                  title="Official report signed by panel committee. Schedule and results are locked."
                                >
                                  <Lock className="w-3 h-3 text-slate-500" />
                                  Report Signed (Locked)
                                </span>
                              ) : (
                                <span
                                  className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200"
                                  title="Defense details, panel assignments, and scores are editable."
                                >
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Editable (Unsigned)
                                </span>
                              )}

                              {/* Official Decision Badge */}
                              {report?.decision ? (
                                <span
                                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                    report.decision === 'Passed'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : report.decision === 'Provisionally Passed'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : report.decision === 'Re-defense'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}
                                >
                                  Result: {report.decision}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                  Status: {attempt.status}
                                </span>
                              )}
                            </div>

                            {/* Schedule Details */}
                            <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap pt-0.5">
                              <span className="flex items-center gap-1 font-semibold text-slate-800">
                                <Calendar className="w-3.5 h-3.5 text-orange-600" />
                                {attempt.defenseDate}
                              </span>
                              <span className="flex items-center gap-1 font-semibold text-slate-800">
                                <Clock className="w-3.5 h-3.5 text-orange-600" />
                                {attempt.defenseTime}
                              </span>
                              <span className="flex items-center gap-1 text-slate-600">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {attempt.venue}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 self-start lg:self-center flex-wrap">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditSchedule(attempt)}
                                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                                title="Edit defense date, time, venue, and assigned panels"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                <span>Edit Details & Panels</span>
                              </button>
                            )}

                            {canReset && (
                              <button
                                type="button"
                                onClick={() => handlePromptReset(attempt)}
                                className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 hover:border-rose-300 rounded-lg text-xs font-bold text-rose-600 transition-colors flex items-center gap-1.5 cursor-pointer"
                                title="Reset defense schedule, assigned panels, and scores from the database"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                                <span>Reset</span>
                              </button>
                            )}

                            {isRedefenseDecision && !hasSubsequentAttempt && (
                              <button
                                type="button"
                                onClick={() => handleOpenRedefense(group, attempt)}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                title="Schedule a redefense for this group"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Schedule Redefense</span>
                              </button>
                            )}

                            {report && (
                              <button
                                type="button"
                                onClick={() => setViewingReportAttempt(attempt)}
                                className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg text-xs font-bold text-orange-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                <FileCheck className="w-3.5 h-3.5 text-orange-600" />
                                <span>View Official Report</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => toggleExpand(attempt.id)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span>Evaluation Scores ({presCount}/{totalPanels})</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Committee Overview Chips */}
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            Committee:
                          </span>
                          {attempt.panelMemberIds.map((pid) => {
                            const isLead = attempt.leadPanelId === pid;
                            const hasPres = !!attempt.presentationEvaluations?.[pid];
                            const hasManu = !!attempt.manuscriptEvaluations?.[pid];
                            const isSigned = attempt.report?.signatures?.some(
                              (s) => s.panelMemberId === pid
                            );

                            return (
                              <div
                                key={pid}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs"
                              >
                                <span className="font-semibold">{getPanelName(pid)}</span>
                                {isLead && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-100 text-orange-700">
                                    Lead
                                  </span>
                                )}
                                <div className="flex items-center gap-1 ml-1 text-[10px]">
                                  {hasPres && (
                                    <span className="text-emerald-700 font-bold" title="Presentation Rated">
                                      P✔
                                    </span>
                                  )}
                                  {hasManu && (
                                    <span className="text-emerald-700 font-bold" title="Manuscript Rated">
                                      M✔
                                    </span>
                                  )}
                                  {isSigned && (
                                    <span className="text-blue-700 font-bold" title="Report Signed">
                                      S✔
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Expandable Panel: Detailed Scores Breakdown */}
                        {isExpanded && (
                          <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                Committee Evaluations & Remarks Breakdown
                              </h4>
                              <span className="text-xs text-slate-500">
                                Presentation Max: 40 pts &bull; Manuscript Max: 165 pts
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {attempt.panelMemberIds.map((pid) => {
                                const pres = attempt.presentationEvaluations?.[pid];
                                const manu = attempt.manuscriptEvaluations?.[pid];
                                const sig = attempt.report?.signatures?.find(
                                  (s) => s.panelMemberId === pid
                                );

                                return (
                                  <div
                                    key={pid}
                                    className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5"
                                  >
                                    <div className="border-b border-slate-100 pb-2">
                                      <div className="text-xs font-bold text-slate-900">
                                        {getPanelName(pid)}
                                      </div>
                                      <div className="text-[10px] text-slate-500">
                                        {attempt.leadPanelId === pid
                                          ? 'Lead Panelist'
                                          : 'Panel Member'}
                                      </div>
                                    </div>

                                    {/* Presentation Score */}
                                    <div className="text-xs space-y-1">
                                      <div className="flex items-center justify-between text-slate-600">
                                        <span className="flex items-center gap-1 font-medium">
                                          <Award className="w-3 h-3 text-orange-600" />
                                          Presentation:
                                        </span>
                                        {pres ? (
                                          <span className="font-bold text-slate-900">
                                            {pres.totalGroupScore}/40 ({pres.averageGroupScore.toFixed(2)}/5)
                                          </span>
                                        ) : (
                                          <span className="text-slate-400 italic">Not rated</span>
                                        )}
                                      </div>

                                      {/* Manuscript Score */}
                                      <div className="flex items-center justify-between text-slate-600">
                                        <span className="flex items-center gap-1 font-medium">
                                          <BookOpen className="w-3 h-3 text-orange-600" />
                                          Manuscript:
                                        </span>
                                        {manu ? (
                                          <span className="font-bold text-slate-900">
                                            {manu.totalScore}/165 ({manu.averageScore.toFixed(2)}/5)
                                          </span>
                                        ) : (
                                          <span className="text-slate-400 italic">Not rated</span>
                                        )}
                                      </div>

                                      {/* Signature */}
                                      <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100">
                                        <span className="text-[11px]">Report Signature:</span>
                                        {sig ? (
                                          <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Signed
                                          </span>
                                        ) : (
                                          <span className="text-[11px] text-amber-600 font-semibold">
                                            Pending
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Remarks if any */}
                                    {(pres?.comments || manu?.overallRemarks) && (
                                      <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                                        "{pres?.comments || manu?.overallRemarks}"
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Consolidated Conditions / Remarks from Lead Panel */}
                            {report?.conditionsOrRemarks && (
                              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                                <span className="font-bold text-slate-900 block mb-1">
                                  Lead Panel Conditions & Revision Items:
                                </span>
                                <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                                  {report.conditionsOrRemarks}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  )}

      {/* Scheduling & Conflict Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingAttempt
                    ? `Edit Defense Schedule (Attempt ${editingAttempt.attemptNumber})`
                    : redefenseTargetGroup
                    ? `Schedule Redefense for ${redefenseTargetGroup.code || redefenseTargetGroup.title}`
                    : 'Schedule Oral Defense Session'}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Assign defense panel members, designate the lead chair, set date/time, and verify conflict prevention rules.
                </p>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="p-5 sm:p-6 space-y-5">
              {/* Conflict Prevention Error Alert */}
              {formConflictError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold block">Schedule Conflict Detected</span>
                    <span>{formConflictError}</span>
                  </div>
                </div>
              )}

              {/* Group Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student Group
                </label>
                <select
                  value={selectedGroupId}
                  disabled={!!editingAttempt || !!redefenseTargetGroup}
                  onChange={(e) => {
                    setSelectedGroupId(e.target.value);
                    setFormConflictError(null);
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-orange-500 font-medium"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code ? `${g.code} • ` : ''}{g.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date, Time, Venue Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Defense Date
                  </label>
                  <input
                    type="date"
                    required
                    value={defenseDate}
                    onChange={(e) => {
                      setDefenseDate(e.target.value);
                      setFormConflictError(null);
                    }}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Defense Time
                  </label>
                  <select
                    value={defenseTime}
                    onChange={(e) => {
                      setDefenseTime(e.target.value);
                      setFormConflictError(null);
                    }}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-orange-500"
                  >
                    <option value="08:00">08:00 AM</option>
                    <option value="09:00">09:00 AM</option>
                    <option value="10:00">10:00 AM</option>
                    <option value="11:00">11:00 AM</option>
                    <option value="13:00">01:00 PM</option>
                    <option value="14:00">02:00 PM</option>
                    <option value="15:00">03:00 PM</option>
                    <option value="16:00">04:00 PM</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Venue / Room / Link
                  </label>
                  <input
                    type="text"
                    required
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. IT Multimedia Laboratory (Room 302)"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Panel Member Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Assign Panel Members (Select 3 Recommended)
                  </label>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                      Selected: {selectedPanelIds.length} Panelists
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddPanelModalOpen(true)}
                      className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add New Panelist</span>
                    </button>
                  </div>
                </div>

                {/* Filter search in modal */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter panels by name or rank..."
                    value={modalPanelSearch}
                    onChange={(e) => setModalPanelSearch(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-orange-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                  {panelAccounts
                    .filter((p) => {
                      if (!modalPanelSearch.trim()) return true;
                      const q = modalPanelSearch.toLowerCase();
                      const name = `${p.academicTitle || ''} ${p.firstName} ${p.lastName}`.toLowerCase();
                      const rank = (p.academicRank || '').toLowerCase();
                      return name.includes(q) || rank.includes(q);
                    })
                    .map((p) => {
                      const isSelected = selectedPanelIds.includes(p.id);
                      const isLead = selectedLeadPanelId === p.id;
                      const assignedCount = getPanelAssignedGroupsCount(p.id);

                      return (
                        <div
                          key={p.id}
                          onClick={() => handleTogglePanel(p.id)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-orange-50/80 border-orange-400 text-slate-900 shadow-xs'
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <img
                              src={
                                p.avatarUrl ||
                                generateInitialsAvatarSvg(p.firstName, p.lastName, '#ea580c')
                              }
                              alt={p.firstName}
                              className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-200"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold flex items-center gap-1 truncate">
                                <span className="truncate">
                                  {p.academicTitle} {p.firstName} {p.lastName}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 line-clamp-1">
                                {p.academicRank}
                              </div>
                              <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                                {assignedCount === 0
                                  ? 'No groups assigned yet'
                                  : `${assignedCount} group${assignedCount > 1 ? 's' : ''} assigned`}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isSelected && (
                              <button
                                type="button"
                                onClick={(e) => handleSetLeadPanel(p.id, e)}
                                className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                                  isLead
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'bg-slate-100 hover:bg-amber-100 text-slate-700'
                                }`}
                                title={isLead ? 'Current designated Lead Panel' : 'Click to designate as Lead Panel'}
                              >
                                <Star className={`w-3 h-3 ${isLead ? 'fill-white' : 'text-slate-400'}`} />
                                <span>{isLead ? 'Lead Chair' : 'Make Lead'}</span>
                              </button>
                            )}

                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 text-orange-600 rounded-sm focus:ring-orange-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Lead Panel Designation */}
              {selectedPanelIds.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>Designate Lead Panelist (Committee Chair)</span>
                    </label>
                    <span className="text-[10px] font-bold text-amber-700 uppercase">
                      Mandatory
                    </span>
                  </div>

                  <select
                    value={selectedLeadPanelId}
                    onChange={(e) => setSelectedLeadPanelId(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-amber-300 bg-white focus:outline-hidden focus:border-amber-500 font-bold text-slate-900"
                  >
                    {selectedPanelIds.map((pid) => (
                      <option key={pid} value={pid}>
                        {getPanelName(pid)} — Designated Lead Panel Chair
                      </option>
                    ))}
                  </select>

                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    The designated Lead Panel chairs the defense proceedings, facilitates committee deliberation, records the official proposal decision & conditions, and provides the primary electronic signature.
                  </p>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                {editingAttempt && !hasSignedReport(editingAttempt) ? (
                  <button
                    type="button"
                    onClick={() => handlePromptReset(editingAttempt)}
                    className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                    <span>Reset Defense</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsScheduleModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl shadow-xs transition-colors"
                  >
                    {editingAttempt ? 'Save Changes' : 'Confirm Schedule'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Panelist Account Modal */}
      <AddPanelAccountModal
        isOpen={isAddPanelModalOpen}
        onClose={() => setIsAddPanelModalOpen(false)}
        onSave={handleSaveNewPanelAccount}
        existingAccounts={resolvedAccounts}
      />

      {/* View Official Proposal Report Modal (Read-Only for Instructor) */}
      {viewingReportAttempt && (
        <ProposalReportModal
          isOpen={!!viewingReportAttempt}
          onClose={() => setViewingReportAttempt(null)}
          attempt={resolvedAttempts.find(attempt => attempt.id === viewingReportAttempt.id) || viewingReportAttempt}
          group={groups.find((g) => g.id === viewingReportAttempt.groupId)!}
          currentUser={currentUser}
          allPanelAccounts={panelAccounts}
          onSaveReport={() => {}}
          onSignReport={() => {}}
        />
      )}

      {/* Reset Defense Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!attemptToReset}
        onClose={() => {
          if (!isResetting) setAttemptToReset(null);
        }}
        onConfirm={handleConfirmReset}
        title="Reset Defense Schedule & Scores"
        message={`Are you sure you want to proceed with resetting this defense? All grades and evaluation scores from the panels, scheduled date/time, and assigned panel members will be permanently removed from the database for ${groups.find((g) => g.id === attemptToReset?.groupId)?.title || 'this group'} (Attempt ${attemptToReset?.attemptNumber || 1}).`}
        confirmLabel={isResetting ? 'Resetting...' : 'Proceed to Reset'}
        cancelLabel="Cancel"
        isDestructive={true}
      />
    </div>
  );
};
