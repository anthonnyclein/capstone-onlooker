import React, { useState } from 'react';
import {
  Group,
  DefenseAttempt,
  UserAccount,
  DefenseReportProposal,
  CommitteeDecisionType,
  CommitteeActionType,
  DefenseSignature,
} from '../../types';
import {
  COMMITTEE_DECISIONS,
  INSTITUTION_INFO,
} from '../../data/ratingCriteria';
import { formatDateTime } from '../../utils/dateUtils';
import { REPORT_HEADER_IMAGE, REPORT_FOOTER_IMAGE } from '../../assets/reportBanners';
import {
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Printer,
  X,
  Clock,
  ShieldCheck,
  Award,
} from 'lucide-react';

interface ProposalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  attempt: DefenseAttempt;
  group: Group;
  currentUser: UserAccount;
  allPanelAccounts: UserAccount[];
  onSaveReport: (
    attemptId: string,
    report: DefenseReportProposal,
    shouldInvalidateSignatures?: boolean
  ) => void;
  onSignReport: (attemptId: string, signature: DefenseSignature) => void;
}

export const ProposalReportModal: React.FC<ProposalReportModalProps> = ({
  isOpen,
  onClose,
  attempt,
  group,
  currentUser,
  allPanelAccounts,
  onSaveReport,
  onSignReport,
}) => {
  const isLeadPanel = attempt.leadPanelId === currentUser.id;
  const isAssignedPanel = attempt.panelMemberIds.includes(currentUser.id);

  const existingReport = attempt.report;

  // Form State
  const [decision, setDecision] = useState<CommitteeDecisionType | undefined>(
    existingReport?.decision
  );
  const [conditions, setConditions] = useState<string>(
    existingReport?.conditionsOrRemarks || ''
  );
  const [degreeSought, setDegreeSought] = useState<string>(
    existingReport?.degreeSought || INSTITUTION_INFO.degree
  );
  const [venueOrPlace, setVenueOrPlace] = useState<string>(
    existingReport?.venueOrPlace || attempt.venue
  );

  // Committee Actions map: panelMemberId -> 'For Acceptance' | 'For Rejection' | 'Provisional'
  const [committeeActions, setCommitteeActions] = useState<
    Record<string, CommitteeActionType>
  >(existingReport?.committeeActions || {});

  const [confirmInvalidationOpen, setConfirmInvalidationOpen] = useState<boolean>(false);
  const [pendingSavePayload, setPendingSavePayload] = useState<DefenseReportProposal | null>(
    null
  );

  if (!isOpen) return null;

  // Assigned panel accounts
  const assignedPanels = attempt.panelMemberIds.map((id) => {
    const acc = allPanelAccounts.find((a) => a.id === id);
    return {
      id,
      name: acc
        ? `${acc.academicTitle ? acc.academicTitle + ' ' : ''}${acc.firstName} ${acc.lastName}`
        : id,
      rank: acc?.academicRank || 'Panel Member',
      isLead: attempt.leadPanelId === id,
    };
  });

  const existingSignatures = existingReport?.signatures || [];
  const isReportSigned = existingSignatures.length > 0;
  const hasUserSigned = existingSignatures.some((s) => s.panelMemberId === currentUser.id);

  const handleActionChange = (panelId: string, action: CommitteeActionType) => {
    // Only lead panel can change for everyone, or panelist for themselves
    if (!isLeadPanel && currentUser.id !== panelId) return;

    setCommitteeActions((prev) => ({
      ...prev,
      [panelId]: action,
    }));
  };

  const handleSaveReportDraft = (forceInvalidate: boolean = false) => {
    if (!decision) return;
    const finalDecision = decision;
    const payload: DefenseReportProposal = {
      leadPanelId: attempt.leadPanelId,
      leadPanelName:
        assignedPanels.find((p) => p.isLead)?.name ||
        `${currentUser.academicTitle || ''} ${currentUser.firstName} ${currentUser.lastName}`.trim(),
      degreeSought,
      venueOrPlace,
      committeeActions,
      decision: finalDecision,
      conditionsOrRemarks: conditions,
      updatedAt: new Date().toISOString(),
      signatures: forceInvalidate ? [] : existingReport?.signatures || [],
      lastSignaturesInvalidatedAt: forceInvalidate
        ? new Date().toISOString()
        : existingReport?.lastSignaturesInvalidatedAt,
    };

    // Check if decision or conditions changed while signatures already exist
    const hasExistingSignatures = (existingReport?.signatures || []).length > 0;
    const decisionChanged = existingReport?.decision !== decision;
    const conditionsChanged =
      (existingReport?.conditionsOrRemarks || '').trim() !== conditions.trim();

    if (!forceInvalidate && hasExistingSignatures && (decisionChanged || conditionsChanged)) {
      setPendingSavePayload(payload);
      setConfirmInvalidationOpen(true);
      return;
    }

    onSaveReport(attempt.id, payload, forceInvalidate);
    onClose();
  };

  const handleConfirmInvalidation = () => {
    if (pendingSavePayload) {
      onSaveReport(attempt.id, pendingSavePayload, true);
    }
    setConfirmInvalidationOpen(false);
    onClose();
  };

  const handleSign = () => {
    const signature: DefenseSignature = {
      panelMemberId: currentUser.id,
      panelMemberName: `${currentUser.academicTitle ? currentUser.academicTitle + ' ' : ''}${currentUser.firstName} ${currentUser.lastName}`,
      signedAt: new Date().toISOString(),
      isLeadPanel,
    };

    if (!existingReport || !isAssignedPanel || hasUserSigned) return;
    onSignReport(attempt.id, signature);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150 print:p-0 print:bg-white print:static print:overflow-visible">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[96vh] flex flex-col my-auto overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:border-none print:rounded-none print:overflow-visible">
        {/* Modal Top Bar (Screen only) */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-orange-400" />
            <span className="text-sm font-bold text-white">
              Official Proposal Defense Report (MSUN Document 3)
            </span>
            {isLeadPanel && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                Lead Panel Authority
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-semibold px-2.5 cursor-pointer"
              title="Print Official Document"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print Document</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Document Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 bg-slate-100/50 no-scrollbar print:p-0 print:bg-white print:overflow-visible">
          {/* Invalidation Alert if Signatures were Cleared (Screen only) */}
          {existingReport?.lastSignaturesInvalidatedAt && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5 max-w-3xl mx-auto print:hidden">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Signatures Previously Re-requested</div>
                <div className="text-amber-700 text-[11px]">
                  The report decision or conditions were modified on{' '}
                  {formatDateTime(existingReport.lastSignaturesInvalidatedAt)}. All panel members must provide their re-attestation signature.
                </div>
              </div>
            </div>
          )}

          {/* Paper Sheet Container conforming strictly to attached MSU Naawan Document */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-300 p-6 sm:p-10 max-w-3xl mx-auto space-y-4 print:border-none print:shadow-none print:p-0 print:max-w-none print:space-y-3 font-serif">
            {/* 1. MSU Naawan Official Header Image */}
            <div className="w-full">
              <img
                src={REPORT_HEADER_IMAGE}
                alt="Mindanao State University at Naawan"
                className="w-full object-contain select-none"
              />
            </div>

            {/* 2. Sub-headers */}
            <div className="text-left mt-1 mb-2">
              <p
                style={{ fontFamily: '"Monotype Corsiva", "Corsiva", "Apple Chancery", "URW Chancery L", cursive' }}
                className="text-base font-bold italic text-slate-900 leading-snug"
              >
                College of Business and Information Technology
              </p>
              <p
                style={{ fontFamily: '"Monotype Corsiva", "Corsiva", "Apple Chancery", "URW Chancery L", cursive' }}
                className="text-base font-bold italic text-slate-900 leading-snug"
              >
                Department of Information Technology
              </p>
            </div>

            {/* 3. Title */}
            <div className="text-center my-3">
              <h1 className="text-sm sm:text-base font-bold tracking-wider text-slate-900 uppercase font-sans">
                REPORT OF CAPSTONE PROJECT PROPOSAL
              </h1>
            </div>

            {/* 4. Metadata Form Table */}
            <div className="border border-black divide-y divide-black text-xs text-slate-900 font-sans">
              {/* Name of Proponent(s) */}
              <div className="p-2 min-h-[34px] flex flex-wrap items-baseline gap-2">
                <span className="font-bold text-slate-900 shrink-0">Name of Proponent(s):</span>
                <span className="font-medium text-slate-900">
                  {group.members.map((m, idx) => (
                    <span key={m.id}>
                      {m.firstName} {m.lastName}
                      {idx < group.members.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </span>
              </div>

              {/* Degree Sought */}
              <div className="p-2 min-h-[34px] flex flex-wrap items-baseline gap-2">
                <span className="font-bold text-slate-900 shrink-0">Degree Sought:</span>
                {isLeadPanel ? (
                  <input
                    type="text"
                    value={degreeSought}
                    onChange={(e) => setDegreeSought(e.target.value)}
                    className="flex-1 bg-transparent border-b border-dashed border-slate-400 focus:outline-hidden focus:border-orange-500 font-medium text-slate-900 px-1 py-0.5 print:border-none"
                  />
                ) : (
                  <span className="font-medium text-slate-900">{degreeSought}</span>
                )}
              </div>

              {/* Capstone Project Title */}
              <div className="p-2 min-h-[34px] flex flex-wrap items-baseline gap-2">
                <span className="font-bold text-slate-900 shrink-0">Capstone Project Title:</span>
                <span className="font-bold text-slate-900">{group.title}</span>
              </div>

              {/* Schedule and Place */}
              <div className="p-2 min-h-[34px] flex flex-wrap items-baseline gap-2">
                <span className="font-bold text-slate-900 shrink-0">
                  Schedule and Place of Capstone Project Proposal Defense:
                </span>
                {isLeadPanel ? (
                  <span className="flex-1 flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                    <span>{attempt.defenseDate} at {attempt.defenseTime},</span>
                    <input
                      type="text"
                      value={venueOrPlace}
                      onChange={(e) => setVenueOrPlace(e.target.value)}
                      placeholder="Place / Venue"
                      className="bg-transparent border-b border-dashed border-slate-400 focus:outline-hidden focus:border-orange-500 font-medium text-slate-900 px-1 py-0.5 print:border-none"
                    />
                  </span>
                ) : (
                  <span className="font-medium text-slate-900">
                    {attempt.defenseDate} at {attempt.defenseTime}, {venueOrPlace}
                  </span>
                )}
              </div>
            </div>

            {/* 5. Action of Capstone Project Examination Committee */}
            <div className="text-center my-3">
              <h2 className="text-xs sm:text-sm font-bold tracking-wider text-slate-900 uppercase font-sans">
                ACTION OF CAPSTONE PROJECT EXAMINATION COMMITTEE
              </h2>
            </div>

            <div className="border border-black overflow-hidden text-xs font-sans">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-black text-slate-900 bg-slate-50/50 print:bg-transparent">
                    <th className="py-2 px-3 text-left font-bold w-[45%] border-r border-black">
                      Panel Member(s) Name:
                    </th>
                    <th className="py-2 px-2 text-center font-bold w-[18%] border-r border-black">
                      For Acceptance
                    </th>
                    <th className="py-2 px-2 text-center font-bold w-[18%] border-r border-black">
                      For Rejection
                    </th>
                    <th className="py-2 px-2 text-center font-bold w-[19%]">
                      Provisional
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black">
                  {assignedPanels.map((p) => {
                    const currentAction = committeeActions[p.id];
                    const canEditThisRow = isLeadPanel || currentUser.id === p.id;
                    const sig = existingSignatures.find((s) => s.panelMemberId === p.id);

                    return (
                      <tr key={p.id} className="min-h-[38px]">
                        <td className="py-2 px-3 border-r border-black align-middle">
                          <div className="font-bold text-slate-900 flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span>{p.name}</span>
                              {p.isLead && (
                                <span className="text-[10px] font-semibold px-1 rounded bg-orange-100 text-orange-800 border border-orange-200 print:hidden">
                                  Lead
                                </span>
                              )}
                            </div>
                            {sig && (
                              <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5 print:hidden">
                                <ShieldCheck className="w-3 h-3" /> Signed
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 print:hidden">{p.rank}</div>
                        </td>

                        {(['For Acceptance', 'For Rejection', 'Provisional'] as CommitteeActionType[]).map(
                          (act, actIdx) => {
                            const isSelected = currentAction === act;
                            return (
                              <td
                                key={act}
                                className={`py-2 px-2 text-center align-middle ${
                                  actIdx < 2 ? 'border-r border-black' : ''
                                }`}
                              >
                                {canEditThisRow ? (
                                  <label className="inline-flex items-center justify-center p-1 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`action_${p.id}`}
                                      checked={isSelected}
                                      onChange={() => handleActionChange(p.id, act)}
                                      className="text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer print:hidden"
                                    />
                                    <span className="hidden print:inline font-bold text-sm text-slate-900">
                                      {isSelected ? '✓' : ''}
                                    </span>
                                  </label>
                                ) : (
                                  <span className="font-bold text-sm text-slate-900">
                                    {isSelected ? '✓' : ''}
                                  </span>
                                )}
                              </td>
                            );
                          }
                        )}
                      </tr>
                    );
                  })}

                  {/* Empty rows to maintain document layout consistency */}
                  {Array.from({ length: Math.max(0, 4 - assignedPanels.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="h-[36px]">
                      <td className="border-r border-black">&nbsp;</td>
                      <td className="border-r border-black">&nbsp;</td>
                      <td className="border-r border-black">&nbsp;</td>
                      <td>&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 6. Committee Decision Section */}
            <div className="text-center my-3">
              <h2 className="text-xs sm:text-sm font-bold tracking-wider text-slate-900 uppercase font-sans">
                COMMITTEE DECISION
              </h2>
            </div>

            <div className="border border-black text-xs text-slate-900 font-sans">
              {/* 4 Decision Checkboxes */}
              <div className="grid grid-cols-4 border-b border-black divide-x divide-black text-center font-bold bg-slate-50/50 print:bg-transparent">
                {(['Passed', 'Provisionally Passed', 'Re-defense', 'Failed'] as CommitteeDecisionType[]).map(
                  (dType) => {
                    const isSelected = decision === dType;
                    const canSelect = isLeadPanel && !isReportSigned;

                    return (
                      <div
                        key={dType}
                        onClick={() => canSelect && setDecision(dType)}
                        className={`py-2 px-1 text-center transition-colors ${
                          canSelect ? 'cursor-pointer hover:bg-orange-50/60' : ''
                        } ${isSelected ? 'bg-orange-100/70 print:bg-transparent' : ''}`}
                      >
                        <span className="inline-flex items-center gap-1.5 font-bold text-[11px] sm:text-xs">
                          <span className="font-mono text-sm">
                            [{' '}
                            {isSelected ? (
                              <span className="font-bold text-orange-700 print:text-black">✓</span>
                            ) : (
                              <span className="text-transparent">_</span>
                            )}{' '}
                            ]
                          </span>
                          <span>{dType}</span>
                        </span>
                      </div>
                    );
                  }
                )}
              </div>

              {/* Descriptions Paragraphs directly from official form */}
              <div className="p-2.5 space-y-1.5 text-[10px] sm:text-[11px] leading-tight border-b border-black text-slate-800">
                <p>
                  <span className="font-bold text-slate-900">Passed:</span> The oral examination result is excellent without any need for revision.
                </p>
                <p>
                  <span className="font-bold text-slate-900">Provisionally Passed:</span> The oral examination result is satisfactory, but revision(s) is/are needed. No formal session/presentation is required. The manuscript will be checked by the Panel Member(s).
                </p>
                <p>
                  <span className="font-bold text-slate-900">Re-defense:</span> The oral examination result is not satisfactory, that is, other significant item(s) is/are not met and/or absent.
                </p>
                <p>
                  <span className="font-bold text-slate-900">Failed:</span> The total finding of the oral examination is unacceptable.
                </p>
              </div>

              {/* Conditions, if any */}
              <div className="p-2.5 min-h-[75px]">
                <div className="font-bold text-slate-900 mb-1">Conditions, if any:</div>
                {isLeadPanel ? (
                  <textarea
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                    rows={3}
                    placeholder="Specify conditions, revisions, or absent items (if none, leave blank)..."
                    className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-hidden focus:border-orange-500 bg-white print:hidden font-sans"
                  />
                ) : null}
                <div
                  className={`${
                    isLeadPanel ? 'hidden print:block' : ''
                  } text-xs text-slate-900 whitespace-pre-line leading-relaxed min-h-[40px]`}
                >
                  {conditions || (isLeadPanel ? '' : 'None')}
                </div>
              </div>
            </div>

            {/* 7. Signatures Block */}
            <div className="pt-4 space-y-6 text-xs text-slate-900 font-sans">
              {/* Submitted by */}
              <div>
                <p className="font-bold mb-4">Submitted by:</p>
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-900 text-sm">Cris Niel Anthonny M. Gulfan</p>
                  <p className="text-slate-700">Capstone Project 1 Coordinator</p>
                </div>
              </div>

              {/* Noted by */}
              <div>
                <p className="font-bold mb-4">Noted by:</p>
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900 text-sm">Jehanie May A. Macasawang</p>
                    <p className="text-slate-700">Department Chairperson</p>
                    <p className="pt-2 text-slate-700">
                      Date: <span className="underline inline-block min-w-[140px]">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900 text-sm">Dr. Lilibeth P. Coronel</p>
                    <p className="text-slate-700">College Dean</p>
                    <p className="pt-2 text-slate-700">
                      Date: <span className="underline inline-block min-w-[140px]">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 8. MSU Naawan Official Footer Image */}
            <div className="w-full pt-4">
              <img
                src={REPORT_FOOTER_IMAGE}
                alt="Mindanao State University at Naawan Footer"
                className="w-full object-contain select-none"
              />
            </div>
          </div>

          {/* Panel Members Digital Attestation Bar (Screen only) */}
          <div className="max-w-3xl mx-auto p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3 print:hidden">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Panel Members Digital Attestation
                </h3>
                <p className="text-[11px] text-slate-500">
                  Assigned panelists can verify the report and sign digitally.
                </p>
              </div>
              <div className="text-xs font-semibold text-slate-700">
                Signed:{' '}
                <span className="text-orange-600 font-bold">
                  {existingSignatures.length} / {assignedPanels.length}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {assignedPanels.map((p) => {
                const sig = existingSignatures.find((s) => s.panelMemberId === p.id);
                const isCurrent = currentUser.id === p.id;

                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-lg border flex flex-col justify-between min-h-[95px] text-xs transition-all ${
                      sig
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : isCurrent
                        ? 'bg-orange-50/30 border-orange-200 ring-1 ring-orange-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {p.isLead ? <span className="font-bold text-orange-700">Lead Panel</span> : 'Panel Member'}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 mt-2">
                      {sig ? (
                        <div className="text-emerald-700">
                          <div className="flex items-center gap-1 font-bold text-[11px]">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Signed Digitally</span>
                          </div>
                          <div className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(sig.signedAt)}
                          </div>
                        </div>
                      ) : isCurrent && isAssignedPanel ? (
                        <button
                          type="button"
                          disabled={!existingReport?.decision}
                          title={
                            !existingReport?.decision
                              ? 'The lead panel must save an official decision first.'
                              : 'Sign the saved report'
                          }
                          onClick={handleSign}
                          className="w-full py-1.5 px-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Sign Proposal Report</span>
                        </button>
                      ) : (
                        <div className="text-slate-400 text-[11px] italic">
                          Pending Signature
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer Controls (Screen only) */}
        <div className="bg-slate-50 p-4 sm:p-5 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print</span>
            </button>
            {isLeadPanel && !isReportSigned && (
              <button
                type="button"
                disabled={!decision}
                onClick={() => handleSaveReportDraft(false)}
                className="px-5 py-2.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Official Decision & Report</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Signature Invalidation Confirmation Modal */}
      {confirmInvalidationOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-full bg-rose-100">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Invalidate Existing Signatures?
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Modifying the official <strong>Committee Decision</strong> or{' '}
              <strong>Conditions / Remarks</strong> changes the contractual terms of this defense attempt.
            </p>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              All <strong>{existingSignatures.length} existing panel signatures</strong> will be invalidated. Each panel member will be required to review the updated report and re-sign.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmInvalidationOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmInvalidation}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-xs cursor-pointer"
              >
                Confirm & Re-request Signatures
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
