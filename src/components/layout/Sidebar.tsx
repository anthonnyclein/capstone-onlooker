import React from 'react';
import { UserAccount } from '../../types';
import {
  LayoutDashboard,
  Building2,
  Users,
  Layers,
  FileCheck,
  BookOpenCheck,
  BarChart3,
  Settings,
  UploadCloud,
  Award,
  X,
  GraduationCap,
  ShieldCheck,
  LogOut,
  Calendar,
} from 'lucide-react';

export type ViewTab =
  | 'dashboard'
  | 'offices'
  | 'groups'
  | 'deliverables'
  | 'submissions'
  | 'gradebook'
  | 'reports'
  | 'oral-defense'
  | 'panel-defense'
  | 'panel-accounts'
  | 'defense-results'
  | 'my-group'
  | 'my-submissions'
  | 'scores'
  | 'settings';

interface SidebarProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  currentUser: UserAccount | null;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  pendingSubmissionsCount?: number;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  isOpenMobile,
  onCloseMobile,
  pendingSubmissionsCount = 0,
  onLogout,
}) => {
  const isInstructor = currentUser?.role === 'instructor';
  const isPanel = currentUser?.role === 'panel';

  interface NavItem {
    id: ViewTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }

  const instructorNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'oral-defense', label: 'Defense & Redefense', icon: Calendar },
    { id: 'offices', label: 'Offices & Sub-offices', icon: Building2 },
    { id: 'groups', label: 'Groups & Students', icon: Users },
    { id: 'deliverables', label: 'Deliverables & Tasks', icon: Layers },
    {
      id: 'submissions',
      label: 'Submission Review',
      icon: FileCheck,
      badge: pendingSubmissionsCount > 0 ? pendingSubmissionsCount : undefined,
    },
    { id: 'gradebook', label: 'Gradebook', icon: BookOpenCheck },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'panel-accounts', label: 'Panel Accounts', icon: ShieldCheck },
    { id: 'settings', label: 'Account Settings', icon: Settings },
  ];

  const panelNavItems: NavItem[] = [
    { id: 'panel-defense', label: 'Assigned Defenses', icon: ShieldCheck },
    { id: 'settings', label: 'Account Settings', icon: Settings },
  ];

  const studentNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'defense-results', label: 'Defense & Redefense', icon: Calendar },
    { id: 'my-group', label: 'My Group', icon: Users },
    { id: 'deliverables', label: 'Deliverables & Tasks', icon: Layers },
    { id: 'my-submissions', label: "My Group's Submissions", icon: UploadCloud },
    { id: 'scores', label: 'Scores & Feedback', icon: Award },
    { id: 'settings', label: 'Account Settings', icon: Settings },
  ];

  const navItems = isPanel
    ? panelNavItems
    : isInstructor
    ? instructorNavItems
    : studentNavItems;

  const handleNavClick = (tab: ViewTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="app-sidebar"
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 lg:z-10 w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 transition-transform duration-200 ease-in-out no-scrollbar ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile Header with close */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
              CPO
            </div>
            <span className="text-sm font-semibold text-white">Menu Navigation</span>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Header Banner */}
        <div className="px-4 py-3 bg-slate-950/40 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            {isPanel ? (
              <ShieldCheck className="w-4 h-4 text-orange-400 shrink-0" />
            ) : isInstructor ? (
              <ShieldCheck className="w-4 h-4 text-orange-400 shrink-0" />
            ) : (
              <GraduationCap className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              {isPanel
                ? 'Panel Member Portal'
                : isInstructor
                ? 'Instructor Console'
                : 'Student Portal'}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav id="sidebar-nav" className="p-3 space-y-1 overflow-y-auto grow no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-white text-orange-700'
                        : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/30 text-slate-400 text-xs flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <div className="font-medium text-slate-300 truncate">
              {currentUser?.firstName} {currentUser?.lastName}
            </div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5">
              @{currentUser?.username}
            </div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Exit to Login Selection Portal"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
