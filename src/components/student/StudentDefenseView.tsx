import React, { useState } from 'react';
import {
  Group,
  DefenseAttempt,
  UserAccount,
} from '../../types';
import { storage } from '../../services/storage';
import { ProposalReportModal } from '../panel/ProposalReportModal';
import {
  Calendar,
  Clock,
  MapPin,
  ShieldCheck,
  Award,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  History,
  Users,
  Printer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface StudentDefenseViewProps {
  currentUser: UserAccount;
  group: Group;
  defenseAttempts?: DefenseAttempt[];
  allAccounts?: UserAccount[];
  accounts?: UserAccount[];
}

export const StudentDefenseView: React.FC<StudentDefenseViewProps> = ({
  currentUser,
  group,
  defenseAttempts = [],
  allAccounts,
  accounts,
}) => {
  const resolvedAccounts = allAccounts || accounts || storage.getAccounts();
  const resolvedAttempts = defenseAttempts && defenseAttempts.length > 0 ? defenseAttempts : storage.getDefenseAttempts();
  // Filter attempts for this group in chronological order
  const groupAttempts = resolvedAttempts
    .filter((a) => a.groupId === group.id)
    .sort((a, b) => a.attemptNumber - b.attemptNumber);

  const latestAttempt = groupAttempts[groupAttempts.length - 1];

  const [viewingReportAttempt, setViewingReportAttempt] = useState<DefenseAttempt | null>(null);
  const [expandedHistoryAttemptId, setExpandedHistoryAttemptId] = useState<string | null>(null);

  const getPanelName = (panelId: string): string => {
    const acc = resolvedAccounts.find((a) => a.id === panelId);
    if (!acc) return panelId;
    return `${acc.academicTitle ? acc.academicTitle + ' ' : ''}${acc.firstName} ${acc.lastName}`;
  };

  const getPanelRank = (panelId: string): string => {
    const acc = resolvedAccounts.find((a) => a.id === panelId);
    return acc?.academicRank || 'Department of IT';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-orange-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold tracking-wide uppercase mb-3">
              <Award className="w-3.5 h-3.5" />
              Oral Defense & Committee Decision
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {group.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Track your scheduled defense timetable, review official committee findings, and monitor required manuscript conditions.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl px-4 py-3 text-center min-w-[90px]">
              <div className="text-lg font-bold text-white">
                {groupAttempts.length > 0 ? `Attempt ${latestAttempt.attemptNumber}` : '—'}
              </div>
              <div className="text-[10px] text-slate-300 uppercase tracking-wider mt-0.5">
                Current Attempt
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl px-4 py-3 text-center min-w-[90px]">
              <div className="text-lg font-bold text-orange-400">
                {latestAttempt?.report?.decision ? latestAttempt.report.decision.split(' ')[0] : 'Scheduled'}
              </div>
              <div className="text-[10px] text-slate-300 uppercase tracking-wider mt-0.5">
                Status
              </div>
            </div>
          </div>
        </div>
      </div>

      {groupAttempts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Defense Scheduled Yet</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your capstone coordinator has not yet assigned a defense committee or schedule for your group. You will be notified once a date is confirmed.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active / Latest Attempt Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Card Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full">
                    {group.code || `Group ${group.id}`}
                  </span>
                  <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    Attempt {latestAttempt.attemptNumber}
                  </span>

                  {latestAttempt.report?.decision && (
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                        latestAttempt.report.decision === 'Passed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : latestAttempt.report.decision === 'Provisionally Passed'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : latestAttempt.report.decision === 'Re-defense'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      Official Decision: {latestAttempt.report.decision}
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-bold text-slate-900 pt-1">
                  Defense Schedule & Evaluation Status
                </h2>
              </div>

              {/* View Official Document button */}
              {latestAttempt.report && (
                <button
                  onClick={() => setViewingReportAttempt(latestAttempt)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-2 self-start lg:self-center"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>View Official Proposal Report</span>
                </button>
              )}
            </div>

            {/* Timetable and Venue */}
            <div className="p-5 sm:p-6 bg-slate-50/50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Defense Date
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">
                    {latestAttempt.defenseDate}
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Time Slot
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">
                    {latestAttempt.defenseTime}
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Venue / Room
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5 line-clamp-1">
                    {latestAttempt.venue}
                  </div>
                </div>
              </div>
            </div>

            {/* Defense Committee Members & Signature Status */}
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Assigned Defense Committee
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Lead panel and committee members evaluating your proposal manuscript and oral presentation.
                  </p>
                </div>

                {latestAttempt.report?.signatures && (
                  <span className="text-xs font-semibold text-slate-700">
                    Signatures:{' '}
                    <strong className="text-emerald-600">
                      {latestAttempt.report.signatures.length}/{latestAttempt.panelMemberIds.length} Signed
                    </strong>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {latestAttempt.panelMemberIds.map((pid) => {
                  const isLead = latestAttempt.leadPanelId === pid;
                  const sig = latestAttempt.report?.signatures?.find(
                    (s) => s.panelMemberId === pid
                  );

                  return (
                    <div
                      key={pid}
                      className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold text-slate-900">
                            {getPanelName(pid)}
                          </div>
                          {isLead ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                              Lead Panel
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              Panelist
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {getPanelRank(pid)}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 text-xs">
                        {sig ? (
                          <div className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Report Signed</span>
                          </div>
                        ) : (
                          <div className="text-slate-400 italic">
                            Pending Signature
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Conditions / Revision Remarks */}
              {latestAttempt.report?.conditionsOrRemarks && (
                <div className="p-4 bg-orange-50/60 border border-orange-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-900 uppercase tracking-wide">
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <span>Official Conditions & Required Revisions</span>
                  </div>
                  <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed pl-6">
                    {latestAttempt.report.conditionsOrRemarks}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Chronological Redefense History (if > 1 attempt) */}
          {groupAttempts.length > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Chronological Defense History ({groupAttempts.length} Attempts)
                </h3>
              </div>

              <div className="space-y-3">
                {groupAttempts.map((att) => {
                  const isExpanded = expandedHistoryAttemptId === att.id;
                  const rep = att.report;

                  return (
                    <div
                      key={att.id}
                      className="border border-slate-200 rounded-xl overflow-hidden"
                    >
                      <div
                        onClick={() =>
                          setExpandedHistoryAttemptId(isExpanded ? null : att.id)
                        }
                        className="p-3.5 sm:p-4 bg-slate-50 hover:bg-slate-100/80 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs font-bold text-slate-800 bg-white border border-slate-200 px-2.5 py-0.5 rounded-lg">
                            Attempt {att.attemptNumber}
                          </span>
                          <span className="text-xs text-slate-600 font-medium">
                            {att.defenseDate} at {att.defenseTime} &bull; {att.venue}
                          </span>
                          {rep?.decision && (
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                rep.decision === 'Passed'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : rep.decision === 'Provisionally Passed'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : rep.decision === 'Re-defense'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}
                            >
                              Result: {rep.decision}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {rep && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingReportAttempt(att);
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg"
                            >
                              View Report
                            </button>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-4 bg-white space-y-3 text-xs border-t border-slate-200">
                          {rep?.conditionsOrRemarks ? (
                            <div>
                              <span className="font-bold text-slate-700 block mb-1">
                                Committee Remarks / Findings:
                              </span>
                              <p className="text-slate-600 whitespace-pre-line leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                                {rep.conditionsOrRemarks}
                              </p>
                            </div>
                          ) : (
                            <p className="text-slate-400 italic">
                              No formal remarks logged for this historical attempt.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Official Proposal Report Modal (Read-only for Students) */}
      {viewingReportAttempt && (
        <ProposalReportModal
          isOpen={!!viewingReportAttempt}
          onClose={() => setViewingReportAttempt(null)}
          attempt={viewingReportAttempt}
          group={group}
          currentUser={currentUser}
          allPanelAccounts={resolvedAccounts.filter((a) => a.role === 'panel')}
          onSaveReport={() => {}}
          onSignReport={() => {}}
        />
      )}
    </div>
  );
};
