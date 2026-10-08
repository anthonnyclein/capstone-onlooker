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
  Building2,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Award,
  Calendar,
} from 'lucide-react';
import { formatDateTime } from '../../utils/dateUtils';

interface StudentGroupViewProps {
  currentStudent: StudentMember;
  group: Group;
  office?: Office;
  deliverables: Deliverable[];
  tasks: Task[];
  submissions: GroupTaskSubmission[];
}

export const StudentGroupView: React.FC<StudentGroupViewProps> = ({
  currentStudent,
  group,
  office,
  deliverables,
  tasks,
  submissions,
}) => {
  const subOffice = office?.subOffices.find((s) => s.id === group.subOfficeId);

  const groupSubmissions = submissions.filter((s) => s.groupId === group.id);
  const returnedCount = groupSubmissions.filter((s) => s.status === 'returned').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          My Capstone Group
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          View group profile, institutional office assignment, client beneficiaries, and proponent roster.
        </p>
      </div>

      {/* Main Group Details Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Institutional Assignment
            </span>
          </div>
          <h3 className="text-xl font-bold text-slate-900">
            {group.title}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg border border-slate-200 text-indigo-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Office & Sub-office
              </span>
              <span className="text-sm font-semibold text-slate-900 block mt-0.5">
                {office?.name || 'Office'}
              </span>
              <span className="text-xs text-slate-600 block mt-0.5">
                Unit: {subOffice?.name} ({subOffice?.code})
              </span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg border border-slate-200 text-indigo-600">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Beneficiary Client(s)
              </span>
              <span className="text-sm font-semibold text-slate-900 block mt-0.5">
                {group.clientNames.join(', ')}
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">
                Primary partner institution for capstone validation
              </span>
            </div>
          </div>
        </div>

        {/* Member Roster */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-bold text-slate-900">
              Proponent Student Members ({group.members.length})
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {group.members.map((m) => {
              const isCurrentUser = m.id === currentStudent.id;
              const isPM = m.roles.includes('Project Manager');

              return (
                <div
                  key={m.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isCurrentUser
                      ? 'bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-300'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {m.firstName} {m.lastName}
                    </span>
                    {isCurrentUser && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                        You
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-mono text-slate-400 block mt-0.5">
                    @{m.username}
                  </span>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {m.roles.map((r) => (
                      <span
                        key={r}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          r === 'Project Manager'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Group Activity & Submission Stats */}
        <div className="pt-4 border-t border-slate-100">
          <h4 className="text-sm font-bold text-slate-900 mb-3">
            Group Capstone Milestone Statistics
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-500 block">Total Published Tasks</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">
                {tasks.filter((t) => t.status === 'published' && !t.isArchived).length}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-500 block">Submissions Delivered</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">
                {groupSubmissions.filter((s) => s.versions.length > 0).length}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-500 block">Returned Feedback</span>
              <span className="text-xl font-bold text-emerald-600 mt-1 block">
                {returnedCount}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
