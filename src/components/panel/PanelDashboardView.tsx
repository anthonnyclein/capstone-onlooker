import React, { useState } from 'react';
import {
  Group,
  DefenseAttempt,
  UserAccount,
  GroupTaskSubmission,
  PresentationEvaluation,
  ManuscriptEvaluation,
  DefenseReportProposal,
  DefenseSignature,
} from '../../types';
import { PresentationEvaluationModal } from './PresentationEvaluationModal';
import { ManuscriptEvaluationModal } from './ManuscriptEvaluationModal';
import { ProposalReportModal } from './ProposalReportModal';
import { storage } from '../../services/storage';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  MapPin,
  ShieldCheck,
  Users,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface PanelDashboardViewProps {
  currentUser?: UserAccount;
  panelUser?: UserAccount;
  groups: Group[];
  defenseAttempts?: DefenseAttempt[];
  submissions?: GroupTaskSubmission[];
  allAccounts?: UserAccount[];
  accounts?: UserAccount[];
  onSavePresentationEvaluation?: (attemptId: string, evaluation: PresentationEvaluation) => void;
  onSaveManuscriptEvaluation?: (attemptId: string, evaluation: ManuscriptEvaluation) => void;
  onSaveDefenseReport?: (
    attemptId: string,
    report: DefenseReportProposal,
    shouldInvalidateSignatures?: boolean
  ) => void;
  onSignDefenseReport?: (attemptId: string, signature: DefenseSignature) => void;
  onOpenSubmission?: (submission: GroupTaskSubmission) => void;
}

export const PanelDashboardView: React.FC<PanelDashboardViewProps> = ({
  currentUser: propCurrentUser,
  panelUser,
  groups,
  defenseAttempts: propDefenseAttempts,
  submissions: propSubmissions,
  allAccounts: propAllAccounts,
  accounts: propAccounts,
  onSavePresentationEvaluation: propSavePres,
  onSaveManuscriptEvaluation: propSaveManu,
  onSaveDefenseReport: propSaveReport,
  onSignDefenseReport: propSignReport,
  onOpenSubmission,
}) => {
  const currentUser = propCurrentUser || panelUser || storage.getCurrentUser()!;
  const allAccounts = propAllAccounts || propAccounts || storage.getAccounts();
  const defenseAttempts = propDefenseAttempts && propDefenseAttempts.length > 0 ? propDefenseAttempts : storage.getDefenseAttempts();
  const submissions = propSubmissions && propSubmissions.length > 0 ? propSubmissions : storage.getSubmissions();

  const handleSavePres = (attemptId: string, evalData: PresentationEvaluation) => {
    if (propSavePres) propSavePres(attemptId, evalData);
    else storage.savePresentationEvaluation(attemptId, evalData);
  };
  const handleSaveManu = (attemptId: string, evalData: ManuscriptEvaluation) => {
    if (propSaveManu) propSaveManu(attemptId, evalData);
    else storage.saveManuscriptEvaluation(attemptId, evalData);
  };
  const handleSaveReport = (attemptId: string, report: DefenseReportProposal, shouldInvalidate?: boolean) => {
    if (propSaveReport) propSaveReport(attemptId, report, shouldInvalidate);
    else storage.saveDefenseReport(attemptId, report, shouldInvalidate);
  };
  const handleSignReport = (attemptId: string, sig: DefenseSignature) => {
    if (propSignReport) propSignReport(attemptId, sig);
    else storage.signDefenseReport(attemptId, sig);
  };

  // Filter only attempts where current user is assigned
  const assignedAttempts = defenseAttempts.filter((a) =>
    a.panelMemberIds.includes(currentUser.id)
  );

  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedAttemptForPresentation, setSelectedAttemptForPresentation] =
    useState<DefenseAttempt | null>(null);
  const [selectedAttemptForManuscript, setSelectedAttemptForManuscript] =
    useState<DefenseAttempt | null>(null);
  const [selectedAttemptForReport, setSelectedAttemptForReport] =
    useState<DefenseAttempt | null>(null);

  // Filter logic
  const filteredAttempts = assignedAttempts.filter((att) => {
    const hasMyPresentation = !!att.presentationEvaluations?.[currentUser.id];
    const hasMyManuscript = !!att.manuscriptEvaluations?.[currentUser.id];
    const hasMySignature = att.report?.signatures?.some((s) => s.panelMemberId === currentUser.id);
    const isCompleted = hasMyPresentation && hasMyManuscript && hasMySignature;

    if (activeFilter === 'pending') {
      return !isCompleted;
    }
    if (activeFilter === 'completed') {
      return isCompleted;
    }
    return true;
  });

  // Calculate metrics
  const totalAssigned = assignedAttempts.length;
  const leadPanelCount = assignedAttempts.filter((a) => a.leadPanelId === currentUser.id).length;
  const pendingActionsCount = assignedAttempts.filter((a) => {
    const pres = !a.presentationEvaluations?.[currentUser.id];
    const manu = !a.manuscriptEvaluations?.[currentUser.id];
    const rep = !a.report?.signatures?.some((s) => s.panelMemberId === currentUser.id);
    return pres || manu || rep;
  }).length;

  const getGroup = (groupId: string): Group | undefined => {
    return groups.find((g) => g.id === groupId);
  };

  const getLatestManuscriptSubmission = (groupId: string): GroupTaskSubmission | undefined => {
    // Find latest submission for this group
    return submissions
      .filter((s) => s.groupId === groupId)
      .sort((a, b) => {
        const timeB = b.submittedAt || b.versions?.[b.versions.length - 1]?.submittedAt || '';
        const timeA = a.submittedAt || a.versions?.[a.versions.length - 1]?.submittedAt || '';
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      })[0];
  };

  const getPanelName = (panelId: string): string => {
    const acc = allAccounts.find((a) => a.id === panelId);
    if (!acc) return panelId;
    return `${acc.academicTitle ? acc.academicTitle + ' ' : ''}${acc.firstName} ${acc.lastName}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-orange-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold tracking-wide uppercase mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              Defense Committee Portal
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Welcome, {currentUser.academicTitle || 'Prof.'} {currentUser.firstName} {currentUser.lastName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Evaluate oral defense presentations, grade manuscripts according to official rubrics, and formalize committee decisions.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl px-4 py-3 text-center min-w-[80px]">
              <div className="text-lg sm:text-xl font-bold text-white">{totalAssigned}</div>
              <div className="text-[10px] text-slate-300 uppercase tracking-wider mt-0.5">
                Assigned
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl px-4 py-3 text-center min-w-[80px]">
              <div className="text-lg sm:text-xl font-bold text-orange-400">{leadPanelCount}</div>
              <div className="text-[10px] text-slate-300 uppercase tracking-wider mt-0.5">
                Lead Panel
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl px-4 py-3 text-center min-w-[80px]">
              <div className="text-lg sm:text-xl font-bold text-amber-400">{pendingActionsCount}</div>
              <div className="text-[10px] text-slate-300 uppercase tracking-wider mt-0.5">
                Pending
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Assigned ({assignedAttempts.length})
          </button>
          <button
            onClick={() => setActiveFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeFilter === 'pending'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending My Action ({pendingActionsCount})
          </button>
          <button
            onClick={() => setActiveFilter('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeFilter === 'completed'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Completed ({totalAssigned - pendingActionsCount})
          </button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
          <span>Ratings automatically lock schedule against instructor modification.</span>
        </div>
      </div>

      {/* Assigned Groups Defense List */}
      {filteredAttempts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Defenses Found</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {activeFilter === 'pending'
              ? "You have completed all pending evaluations and report signatures! Great work."
              : "No capstone defense schedules are currently assigned to your account."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {filteredAttempts.map((attempt) => {
            const grp = getGroup(attempt.groupId);
            if (!grp) return null;

            const isLead = attempt.leadPanelId === currentUser.id;
            const myPresentation = attempt.presentationEvaluations?.[currentUser.id];
            const myManuscript = attempt.manuscriptEvaluations?.[currentUser.id];
            const report = attempt.report;
            const hasMySignature = report?.signatures?.some(
              (s) => s.panelMemberId === currentUser.id
            );
            const manuscriptSub = getLatestManuscriptSubmission(grp.id);

            return (
              <div
                key={attempt.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden hover:border-slate-300 transition-all"
              >
                {/* Card Header */}
                <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200/80 px-2.5 py-0.5 rounded-full">
                        {grp.code || `Group ${grp.id}`}
                      </span>
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        Attempt {attempt.attemptNumber}
                      </span>
                      {isLead ? (
                        <span className="text-xs font-bold text-white bg-orange-600 px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          Lead Panelist
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          Panel Member
                        </span>
                      )}

                      {/* Official Decision Badge if available */}
                      {report?.decision && (
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
                          Decision: {report.decision}
                        </span>
                      )}
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {grp.title}
                    </h2>

                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      <span className="font-semibold text-slate-700">Proponents:</span>
                      {grp.members.map((m, i) => (
                        <span key={m.id} className="text-slate-600">
                          {m.firstName} {m.lastName}
                          {i < grp.members.length - 1 ? ',' : ''}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Schedule details & Manuscript */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 lg:gap-6 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-100 shrink-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Calendar className="w-3.5 h-3.5 text-orange-600" />
                        <span>{attempt.defenseDate}</span>
                        <span className="text-slate-400 font-normal">at</span>
                        <Clock className="w-3.5 h-3.5 text-orange-600 ml-1" />
                        <span>{attempt.defenseTime}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="line-clamp-1">{attempt.venue}</span>
                      </div>
                    </div>

                    {manuscriptSub && onOpenSubmission && (
                      <button
                        onClick={() => onOpenSubmission(manuscriptSub)}
                        className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5 shadow-2xs self-start sm:self-center"
                      >
                        <FileText className="w-3.5 h-3.5 text-orange-600" />
                        <span>View Manuscript</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Panel Composition & Evaluation Status Grid */}
                <div className="p-5 sm:p-6 bg-slate-50/50 space-y-4">
                  {/* Assigned Panel Roster */}
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">
                      Defense Committee:
                    </span>
                    {attempt.panelMemberIds.map((pid) => {
                      const isThisLead = attempt.leadPanelId === pid;
                      const hasEval =
                        attempt.presentationEvaluations?.[pid] &&
                        attempt.manuscriptEvaluations?.[pid];
                      const isMe = currentUser.id === pid;

                      return (
                        <div
                          key={pid}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${
                            isMe
                              ? 'bg-orange-50 text-orange-900 border-orange-200 font-bold'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          <span>{getPanelName(pid)}</span>
                          {isThisLead && (
                            <span className="text-[9px] font-bold px-1 rounded bg-orange-100 text-orange-700">
                              Lead
                            </span>
                          )}
                          {hasEval && (
                            <span title="Completed Evaluation" className="flex items-center">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 3 Step Evaluation Actions Bar */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    {/* 1. Presentation Evaluation */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                            <Award className="w-3.5 h-3.5 text-orange-600" />
                            1. Oral Presentation
                          </span>
                          {myPresentation ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Completed
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              Pending Rating
                            </span>
                          )}
                        </div>

                        {myPresentation ? (
                          <div className="mt-2 text-xs text-slate-600">
                            <div>
                              Group Score:{' '}
                              <strong className="text-slate-900">
                                {myPresentation.totalGroupScore}/40
                              </strong>{' '}
                              ({myPresentation.averageGroupScore.toFixed(2)}/5.0)
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {myPresentation.individualRatings.length} students individually scored
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                            Rate 8 group presentation criteria and individual student proponent performance.
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => setSelectedAttemptForPresentation(attempt)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs ${
                          myPresentation
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                            : 'bg-orange-600 hover:bg-orange-500 text-white'
                        }`}
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>{myPresentation ? 'Edit Presentation Rating' : 'Evaluate Presentation'}</span>
                      </button>
                    </div>

                    {/* 2. Manuscript Evaluation */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5 text-orange-600" />
                            2. Manuscript Rating
                          </span>
                          {myManuscript ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Completed
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              Pending Rating
                            </span>
                          )}
                        </div>

                        {myManuscript ? (
                          <div className="mt-2 text-xs text-slate-600">
                            <div>
                              Manuscript Score:{' '}
                              <strong className="text-slate-900">
                                {myManuscript.totalScore}/165
                              </strong>{' '}
                              ({myManuscript.averageScore.toFixed(2)}/5.0)
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              All 33 criteria evaluated
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                            Grade Chapters 1-5 and overall formatting across all 33 standardized criteria.
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => setSelectedAttemptForManuscript(attempt)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs ${
                          myManuscript
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                            : 'bg-orange-600 hover:bg-orange-500 text-white'
                        }`}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{myManuscript ? 'Edit Manuscript Rating' : 'Evaluate Manuscript'}</span>
                      </button>
                    </div>

                    {/* 3. Official Proposal Defense Report */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                            <FileCheck className="w-3.5 h-3.5 text-orange-600" />
                            3. Proposal Report
                          </span>
                          {hasMySignature ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Signed
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              {isLead ? 'Needs Drafting' : 'Pending Signature'}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                          <div>
                            Decision:{' '}
                            <strong className="text-slate-900">
                              {report?.decision || 'Under Deliberation'}
                            </strong>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Signatures: {report?.signatures?.length || 0}/
                            {attempt.panelMemberIds.length} recorded
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedAttemptForReport(attempt)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs ${
                          isLead
                            ? 'bg-orange-600 hover:bg-orange-500 text-white'
                            : hasMySignature
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>
                          {isLead
                            ? 'Draft / Manage Report'
                            : hasMySignature
                            ? 'View Official Report'
                            : 'Review & Sign Report'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Presentation Evaluation Modal */}
      {selectedAttemptForPresentation && (
        <PresentationEvaluationModal
          isOpen={!!selectedAttemptForPresentation}
          onClose={() => setSelectedAttemptForPresentation(null)}
          attempt={selectedAttemptForPresentation}
          group={getGroup(selectedAttemptForPresentation.groupId)!}
          currentUser={currentUser}
          onSaveEvaluation={handleSavePres}
        />
      )}

      {/* Manuscript Evaluation Modal */}
      {selectedAttemptForManuscript && (
        <ManuscriptEvaluationModal
          isOpen={!!selectedAttemptForManuscript}
          onClose={() => setSelectedAttemptForManuscript(null)}
          attempt={selectedAttemptForManuscript}
          group={getGroup(selectedAttemptForManuscript.groupId)!}
          currentUser={currentUser}
          onSaveEvaluation={handleSaveManu}
        />
      )}

      {/* Proposal Report Modal */}
      {selectedAttemptForReport && (
        <ProposalReportModal
          isOpen={!!selectedAttemptForReport}
          onClose={() => setSelectedAttemptForReport(null)}
          attempt={defenseAttempts.find(attempt => attempt.id === selectedAttemptForReport.id) || selectedAttemptForReport}
          group={getGroup(selectedAttemptForReport.groupId)!}
          currentUser={currentUser}
          allPanelAccounts={allAccounts.filter((a) => a.role === 'panel' || a.role === 'instructor')}
          onSaveReport={handleSaveReport}
          onSignReport={handleSignReport}
        />
      )}
    </div>
  );
};
