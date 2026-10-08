import React, { useState } from 'react';
import { UserAccount, Group } from '../../types';
import {
  User,
  KeyRound,
  RotateCcw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Users,
  Building2,
  Lock,
  LogOut,
} from 'lucide-react';
import { TIMEZONE } from '../../utils/dateUtils';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { DataBackupCard } from './DataBackupCard';

interface SettingsViewProps {
  currentUser: UserAccount;
  group?: Group;
  onLogout?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  group,
  onLogout,
}) => {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const isInstructor = currentUser.role === 'instructor';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Account & System Settings
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your credentials, your preferences, and view regional submission configuration.
        </p>
      </div>

      {/* User Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600" />
          Account Profile
        </h3>

        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-full bg-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-xs">
            {currentUser.firstName[0]}
            {currentUser.lastName[0]}
          </div>

          <div className="space-y-1">
            <h4 className="text-base font-bold text-slate-900">
              {currentUser.firstName} {currentUser.lastName}
            </h4>
            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                @{currentUser.username}
              </span>
              <span>&bull;</span>
              <span className="capitalize font-semibold text-indigo-700">
                {isInstructor ? 'Capstone Instructor / Coordinator' : currentUser.role === 'panel' ? 'Panel Member' : 'Capstone Student'}
              </span>
              {currentUser.studentRoles && (
                <>
                  <span>&bull;</span>
                  <span>Roles: {currentUser.studentRoles.join(', ')}</span>
                </>
              )}
            </div>

            {group && (
              <div className="text-xs text-slate-600 pt-1">
                <strong>Assigned Capstone Group:</strong> {group.title}
              </div>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
            Change Password
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5 sm:ml-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log Out / Exit to Portal
            </button>
          )}
        </div>
      </div>

      {/* Regional Timezone & Lateness Policy */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          Institutional Timezone & Deadline Standards
        </h3>

        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">System Timezone Standard:</span>
            <span className="font-mono font-bold text-indigo-700 px-2 py-0.5 bg-white rounded border border-slate-200">
              {TIMEZONE} (PHT, UTC+8)
            </span>
          </div>
          <p className="leading-relaxed">
            All capstone proposal deadlines, student submission timestamps, revision matrices, and evaluation returns are standardized in <strong>Asia/Manila time (Philippine Standard Time)</strong>.
          </p>
          <p className="leading-relaxed text-slate-500">
            Late deductions are computed based on the difference between the submission timestamp and the published deadline in Asia/Manila, according to the deliverable&apos;s late policy.
          </p>
        </div>
      </div>

      {/* Data Backup & Transfer (Coordinator only) */}
      {isInstructor && <DataBackupCard />}

      {/* Password Change Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        user={currentUser}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
};
