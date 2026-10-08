import React from 'react';
import { UserAccount, Group } from '../../types';
import {
  Menu,
  LogOut,
} from 'lucide-react';

interface NavbarProps {
  currentUser: UserAccount | null;
  onLogout: () => void;
  onToggleSidebar: () => void;
  groups: Group[];
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  onToggleSidebar,
  groups,
}) => {
  const currentGroup = currentUser?.groupId
    ? groups.find(g => g.id === currentUser.groupId)
    : null;

  const isPM = currentUser?.studentRoles?.includes('Project Manager');

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-xs shrink-0">
      {/* Main App Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation menu"
            className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-xs font-bold text-sm tracking-wider">
              CPO
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight">
                Capstone Project Onlooker
              </h1>
            </div>
          </div>
        </div>

        {/* User Status and Persona Pill */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-left"
          >
            <div className="relative">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                  currentUser?.role === 'panel'
                    ? 'bg-orange-600'
                    : currentUser?.role === 'instructor'
                    ? 'bg-indigo-600'
                    : 'bg-emerald-600'
                }`}
              >
                {currentUser ? `${currentUser.firstName[0]}${currentUser.lastName[0]}` : 'U'}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                  currentUser?.role === 'panel'
                    ? 'bg-orange-400'
                    : currentUser?.role === 'instructor'
                    ? 'bg-indigo-400'
                    : 'bg-emerald-400'
                }`}
              />
            </div>
            <div className="hidden md:block">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                {currentUser?.academicTitle ? `${currentUser.academicTitle} ` : ''}
                {currentUser?.firstName} {currentUser?.lastName}
                {currentUser?.role === 'panel' ? (
                  <span className="text-[10px] px-1.5 py-0.2 bg-orange-500/20 text-orange-300 rounded border border-orange-500/30">
                    Panel Member
                  </span>
                ) : currentUser?.role === 'instructor' ? (
                  <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                    Instructor
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                    {isPM ? 'Student PM' : 'Student'}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                {currentUser?.role === 'panel'
                  ? currentUser.academicRank || 'Evaluation Committee'
                  : currentUser?.role === 'instructor'
                  ? 'Coordinator / Evaluator'
                  : currentGroup?.title || 'Capstone Student'}
              </div>
            </div>
          </div>

          {/* Exit to Portal Button */}
          <button
            onClick={onLogout}
            title="Exit to Portal Selection Screen"
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/50 border border-slate-700/80 hover:border-rose-500/60 text-slate-400 hover:text-rose-300 transition-all flex items-center gap-1.5 text-xs"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline font-medium">Log Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
