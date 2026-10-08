import React, { useState } from 'react';
import { Group, DefenseAttempt, UserAccount } from '../../types';
import {
  Users,
  Shield,
  Star,
  Award,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  BarChart3,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { formatDateTime } from '../../utils/dateUtils';
import { generateInitialsAvatarSvg } from '../../utils/avatar';

interface PanelWorkloadSummaryProps {
  panelAccounts: UserAccount[];
  groups: Group[];
  defenseAttempts: DefenseAttempt[];
  onOpenAddPanel: () => void;
  onSelectGroupSchedule: (groupId: string) => void;
  onScheduleForPanel?: (panelId: string) => void;
}

export const PanelWorkloadSummary: React.FC<PanelWorkloadSummaryProps> = ({
  panelAccounts,
  groups,
  defenseAttempts,
  onOpenAddPanel,
  onSelectGroupSchedule,
  onScheduleForPanel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'lead_only' | 'active_only' | 'available_only'>('all');

  // Compute stats per panel
  const panelWorkloadData = panelAccounts.map((panel) => {
    // Defense attempts where this panel is a member
    const assignedAttempts = defenseAttempts.filter((a) =>
      a.panelMemberIds.includes(panel.id)
    );

    // Defense attempts where this panel is the lead panel
    const leadAttempts = assignedAttempts.filter((a) => a.leadPanelId === panel.id);
    const memberAttempts = assignedAttempts.filter((a) => a.leadPanelId !== panel.id);

    // Unique groups assigned to this panel
    const uniqueGroupIds = Array.from(new Set(assignedAttempts.map((a) => a.groupId)));
    const assignedGroups = uniqueGroupIds
      .map((gid) => {
        const group = groups.find((g) => g.id === gid);
        const groupAttempts = assignedAttempts.filter((a) => a.groupId === gid);
        // Latest attempt for this group
        const latestAttempt = groupAttempts[groupAttempts.length - 1];
        const isLeadForGroup = groupAttempts.some((a) => a.leadPanelId === panel.id);

        return {
          group,
          latestAttempt,
          isLead: isLeadForGroup,
          attemptsCount: groupAttempts.length,
        };
      })
      .filter((item) => item.group !== undefined);

    return {
      panel,
      assignedAttempts,
      assignedGroups,
      totalGroupsCount: assignedGroups.length,
      leadCount: leadAttempts.length,
      memberCount: memberAttempts.length,
      isLeadChair: leadAttempts.length > 0,
    };
  });

  // Sort: highest workload first, or lead panels first
  const sortedPanels = [...panelWorkloadData].sort((a, b) => {
    if (b.totalGroupsCount !== a.totalGroupsCount) {
      return b.totalGroupsCount - a.totalGroupsCount;
    }
    return b.leadCount - a.leadCount;
  });

  // Filter based on search & filterRole
  const filteredPanels = sortedPanels.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const fullName = `${item.panel.academicTitle || ''} ${item.panel.firstName} ${item.panel.lastName}`.toLowerCase();
    const rank = (item.panel.academicRank || '').toLowerCase();
    const username = item.panel.username.toLowerCase();

    const matchesQuery = !q || fullName.includes(q) || rank.includes(q) || username.includes(q);

    if (!matchesQuery) return false;

    if (filterRole === 'lead_only') return item.leadCount > 0;
    if (filterRole === 'active_only') return item.totalGroupsCount > 0;
    if (filterRole === 'available_only') return item.totalGroupsCount === 0;

    return true;
  });

  // Aggregates
  const totalPanels = panelAccounts.length;
  const panelsWithAssignments = panelWorkloadData.filter((p) => p.totalGroupsCount > 0).length;
  const leadPanelCount = panelWorkloadData.filter((p) => p.leadCount > 0).length;
  const totalAssignments = panelWorkloadData.reduce((acc, p) => acc + p.totalGroupsCount, 0);
  const avgWorkload = totalPanels > 0 ? (totalAssignments / totalPanels).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Top Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Faculty Evaluators
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {totalPanels}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {panelsWithAssignments} active &bull; {totalPanels - panelsWithAssignments} unassigned
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Lead Panelists (Chairs)
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-0.5 flex items-center gap-1.5">
              <span>{leadPanelCount}</span>
              <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Authorizes official reports
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Panel Seats
            </div>
            <div className="text-2xl font-bold text-indigo-600 mt-0.5">
              {totalAssignments}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Across all defense schedules
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Average Workload
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-0.5">
              {avgWorkload} <span className="text-xs font-normal text-slate-400">grps/evaluator</span>
            </div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
              Capacity balanced (&le; 3 max)
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Action and Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search panel by name, rank, or @username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-hidden focus:border-orange-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilterRole('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterRole === 'all'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({totalPanels})
            </button>
            <button
              onClick={() => setFilterRole('lead_only')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                filterRole === 'lead_only'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Star className="w-3 h-3 fill-current" />
              <span>Lead Panels ({leadPanelCount})</span>
            </button>
            <button
              onClick={() => setFilterRole('active_only')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterRole === 'active_only'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Assigned ({panelsWithAssignments})
            </button>
            <button
              onClick={() => setFilterRole('available_only')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterRole === 'available_only'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Available ({totalPanels - panelsWithAssignments})
            </button>
          </div>

          <button
            onClick={onOpenAddPanel}
            className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Panel Account</span>
          </button>
        </div>
      </div>

      {/* Visual Panel Workload Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPanels.map(({ panel, assignedGroups, totalGroupsCount, leadCount, memberCount }) => {
          const isLeadAny = leadCount > 0;

          // Max recommended workload benchmark is 3 groups
          const workloadPercentage = Math.min(Math.round((totalGroupsCount / 3) * 100), 100);
          const workloadStatus =
            totalGroupsCount === 0
              ? { label: 'Available (No Groups)', color: 'text-slate-500', barBg: 'bg-slate-200' }
              : totalGroupsCount <= 2
              ? { label: 'Balanced Load', color: 'text-emerald-700 font-semibold', barBg: 'bg-emerald-500' }
              : totalGroupsCount === 3
              ? { label: 'Capacity Reached', color: 'text-amber-700 font-semibold', barBg: 'bg-amber-500' }
              : { label: 'Heavy Load', color: 'text-rose-700 font-bold', barBg: 'bg-rose-500' };

          return (
            <div
              key={panel.id}
              className={`bg-white rounded-2xl border transition-all duration-200 shadow-xs flex flex-col justify-between overflow-hidden ${
                isLeadAny
                  ? 'border-amber-300/80 hover:border-amber-400 hover:shadow-md'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              {/* Card Header */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={
                          panel.avatarUrl ||
                          generateInitialsAvatarSvg(panel.firstName, panel.lastName, '#ea580c')
                        }
                        alt={`${panel.firstName} ${panel.lastName}`}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-xs"
                      />
                      {isLeadAny && (
                        <span
                          title="Designated Lead Panelist"
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-xs text-[10px]"
                        >
                          ★
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {panel.academicTitle ? `${panel.academicTitle} ` : ''}
                          {panel.firstName} {panel.lastName}
                        </h3>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        @{panel.username}
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium truncate max-w-[220px] mt-0.5">
                        {panel.academicRank || 'Defense Committee Evaluator'}
                      </div>
                    </div>
                  </div>

                  {/* Workload Pill */}
                  <div className="text-right shrink-0">
                    <div className="text-lg font-black text-slate-900 leading-none">
                      {totalGroupsCount}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      {totalGroupsCount === 1 ? 'Group' : 'Groups'}
                    </div>
                  </div>
                </div>

                {/* Workload Progress Bar */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-slate-500">Workload Capacity</span>
                    <span className={workloadStatus.color}>{workloadStatus.label}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${workloadStatus.barBg}`}
                      style={{ width: `${Math.max(workloadPercentage, 5)}%` }}
                    />
                  </div>
                </div>

                {/* Role Counts Badges */}
                <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px]">
                  {leadCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-bold">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      <span>{leadCount} Lead Chair</span>
                    </span>
                  )}
                  {memberCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                      <Shield className="w-3 h-3 text-slate-500" />
                      <span>{memberCount} Committee Member</span>
                    </span>
                  )}
                  {totalGroupsCount === 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-400">
                      <span>Available for assignments</span>
                    </span>
                  )}
                </div>

                {/* Assigned Groups Visual List */}
                <div className="mt-4 space-y-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Assigned Capstone Groups</span>
                    <span className="text-slate-400 font-normal">({assignedGroups.length})</span>
                  </div>

                  {assignedGroups.length === 0 ? (
                    <div className="p-3 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                      No defense sessions currently assigned to this evaluator.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {assignedGroups.map(({ group, latestAttempt, isLead }) => {
                        if (!group) return null;

                        return (
                          <div
                            key={group.id}
                            onClick={() => onSelectGroupSchedule(group.id)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 group ${
                              isLead
                                ? 'bg-amber-50/50 hover:bg-amber-50 border-amber-200'
                                : 'bg-slate-50/70 hover:bg-slate-100/70 border-slate-200'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900 group-hover:text-orange-600 transition-colors truncate">
                                  {group.code ? `${group.code}: ` : ''}{group.title}
                                </span>
                                {isLead && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500 text-white shrink-0">
                                    Lead
                                  </span>
                                )}
                              </div>

                              {latestAttempt && (
                                <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-slate-400" />
                                    {latestAttempt.defenseDate}
                                  </span>
                                  <span>&bull;</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {latestAttempt.defenseTime}
                                  </span>
                                </div>
                              )}
                            </div>

                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-orange-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Action */}
              <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">
                  {panel.role.toUpperCase()} ROSTER
                </span>
                {onScheduleForPanel && (
                  <button
                    onClick={() => onScheduleForPanel(panel.id)}
                    className="font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 transition-colors"
                  >
                    <span>Schedule Defense</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
