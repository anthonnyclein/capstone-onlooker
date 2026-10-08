import React, { useState, useMemo } from 'react';
import {
  Group,
  Office,
  Deliverable,
  Task,
  GroupTaskSubmission,
} from '../../types';
import {
  Users,
  Layers,
  FileCheck,
  ClockAlert,
  Search,
  SlidersHorizontal,
  Building2,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  LayoutGrid,
  List,
} from 'lucide-react';
import { calculateDaysLate } from '../../utils/dateUtils';
import { Badge, SubmissionStatusBadge } from '../common/Badge';

interface DashboardViewProps {
  groups: Group[];
  offices: Office[];
  deliverables: Deliverable[];
  tasks: Task[];
  submissions: GroupTaskSubmission[];
  onSelectGroup: (groupId: string) => void;
  onOpenSubmissionReview: (submissionId: string) => void;
  onNavigateToTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  groups,
  offices,
  deliverables,
  tasks,
  submissions,
  onSelectGroup,
  onOpenSubmissionReview,
  onNavigateToTab,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOfficeFilter, setSelectedOfficeFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat'); // all groups vs grouped by Office/Sub-office
  const [sortBy, setSortBy] = useState<'title' | 'office' | 'members'>('title');
  const [displayType, setDisplayType] = useState<'cards' | 'table'>('cards');

  // Summary Metrics calculations
  const totalGroupsCount = groups.length;
  const activeDeliverablesCount = deliverables.filter(d => !d.isArchived).length;
  const publishedTasks = tasks.filter(t => t.status === 'published' && !t.isArchived);
  const activeTasksCount = publishedTasks.length;

  const awaitingGradingCount = submissions.filter(
    s => s.status === 'submitted' || s.status === 'graded_awaiting_return'
  ).length;

  const returnedSubmissionsCount = submissions.filter(
    s => s.status === 'returned'
  ).length;

  // Overdue count: Published tasks whose deadline has passed where group has not submitted
  const overdueGroupsCount = useMemo(() => {
    const now = new Date();
    let count = 0;
    for (const task of publishedTasks) {
      const deadline = new Date(task.deadline);
      if (now > deadline) {
        for (const grp of groups) {
          const sub = submissions.find(s => s.groupId === grp.id && s.taskId === task.id);
          if (!sub || sub.versions.length === 0) {
            count++;
          }
        }
      }
    }
    return count;
  }, [publishedTasks, groups, submissions]);

  // Office and SubOffice name lookup helpers
  const getOfficeName = (officeId: string) => {
    return offices.find(o => o.id === officeId)?.name || 'Unknown Office';
  };

  const getSubOfficeName = (officeId: string, subOfficeId: string) => {
    const off = offices.find(o => o.id === officeId);
    return off?.subOffices.find(s => s.id === subOfficeId)?.name || 'General';
  };

  // Group submission progress helper
  const getGroupProgress = (groupId: string) => {
    if (publishedTasks.length === 0) return { submitted: 0, total: 0, returned: 0 };
    let submitted = 0;
    let returned = 0;
    for (const t of publishedTasks) {
      const sub = submissions.find(s => s.groupId === groupId && s.taskId === t.id);
      if (sub && sub.versions.length > 0) {
        submitted++;
        if (sub.status === 'returned') returned++;
      }
    }
    return { submitted, total: publishedTasks.length, returned };
  };

  // Filtered & Sorted groups
  const filteredGroups = useMemo(() => {
    return groups
      .filter(g => {
        const matchesSearch =
          g.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          g.clientNames.some(c => c.toLowerCase().includes(searchTerm.toLowerCase())) ||
          g.members.some(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesOffice =
          selectedOfficeFilter === 'all' || g.officeId === selectedOfficeFilter;

        return matchesSearch && matchesOffice;
      })
      .sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'office') return a.officeId.localeCompare(b.officeId);
        if (sortBy === 'members') return b.members.length - a.members.length;
        return 0;
      });
  }, [groups, searchTerm, selectedOfficeFilter, sortBy]);

  // Grouped by Office / SubOffice structure
  const groupedData = useMemo(() => {
    const result: { office: Office; subOffices: { subOffice: any; groups: Group[] }[] }[] = [];

    for (const off of offices) {
      if (selectedOfficeFilter !== 'all' && off.id !== selectedOfficeFilter) continue;

      const subList: { subOffice: any; groups: Group[] }[] = [];
      for (const sub of off.subOffices) {
        const matchingGroups = filteredGroups.filter(
          g => g.officeId === off.id && g.subOfficeId === sub.id
        );
        if (matchingGroups.length > 0) {
          subList.push({ subOffice: sub, groups: matchingGroups });
        }
      }

      if (subList.length > 0) {
        result.push({ office: off, subOffices: subList });
      }
    }

    return result;
  }, [offices, selectedOfficeFilter, filteredGroups]);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Context */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Capstone Management Overview
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Monitor capstone proposals, evaluate group submissions, and track revision workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateToTab('submissions')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <FileCheck className="w-4 h-4" />
            Review Submissions ({awaitingGradingCount})
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Groups */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigateToTab('offices')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigateToTab('offices');
            }
          }}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
          title="Click to view academic offices and group allocations"
        >
          <div>
            <span className="text-xs font-medium text-slate-500 block">Total Groups</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {totalGroupsCount}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {groups.reduce((acc, g) => acc + g.members.length, 0)} enrolled students
            </span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Active Deliverables & Tasks */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigateToTab('deliverables')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigateToTab('deliverables');
            }
          }}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
          title="Click to manage deliverables and tasks"
        >
          <div>
            <span className="text-xs font-medium text-slate-500 block">Active Tasks</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {activeTasksCount}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Across {activeDeliverablesCount} deliverables
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Awaiting Grading */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigateToTab('submissions')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigateToTab('submissions');
            }
          }}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
          title="Click to review submissions awaiting evaluation"
        >
          <div>
            <span className="text-xs font-medium text-slate-500 block">Awaiting Grading</span>
            <span className="text-2xl font-bold text-amber-600 mt-1 block">
              {awaitingGradingCount}
            </span>
            <span className="text-[11px] text-amber-700/80 mt-0.5 block">
              Needs evaluation/return
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <FileCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Returned Submissions */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigateToTab('gradebook')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigateToTab('gradebook');
            }
          }}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
          title="Click to view gradebook and returned feedback"
        >
          <div>
            <span className="text-xs font-medium text-slate-500 block">Returned</span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block">
              {returnedSubmissionsCount}
            </span>
            <span className="text-[11px] text-emerald-700/80 mt-0.5 block">
              Feedback published
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Overdue Submissions */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigateToTab('submissions')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigateToTab('submissions');
            }
          }}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-rose-300 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
          title="Click to view overdue task submissions"
        >
          <div>
            <span className="text-xs font-medium text-slate-500 block">Overdue Tasks</span>
            <span className={`text-2xl font-bold mt-1 block ${overdueGroupsCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
              {overdueGroupsCount}
            </span>
            <span className="text-[11px] text-rose-600/80 mt-0.5 block">
              Past published deadline
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <ClockAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Bar: Filters, Search, Grouping Toggle */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative w-full md:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search proposal, client, student..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={selectedOfficeFilter}
            onChange={(e) => setSelectedOfficeFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg py-1.5 px-2.5 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Offices</option>
            {offices.map((off) => (
              <option key={off.id} value={off.id}>
                {off.code} - {off.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {/* Grouping switch */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode('flat')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                viewMode === 'flat'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Groups
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                viewMode === 'grouped'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Grouped by Office
            </button>
          </div>

          {/* Cards vs Table view toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setDisplayType('cards')}
              title="Card Grid"
              className={`p-1 rounded ${
                displayType === 'cards' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDisplayType('table')}
              title="Table View"
              className={`p-1 rounded ${
                displayType === 'table' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Groups Presentation */}
      {viewMode === 'grouped' ? (
        /* Grouped by Office and SubOffice */
        <div className="space-y-6">
          {groupedData.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No capstone groups match the selected filter.</p>
            </div>
          ) : (
            groupedData.map(({ office, subOffices }) => (
              <div key={office.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{office.name}</h3>
                      <span className="text-xs text-slate-500">Unit Code: {office.code}</span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-full text-slate-700">
                    {subOffices.reduce((sum, s) => sum + s.groups.length, 0)} Groups
                  </span>
                </div>

                <div className="p-5 space-y-6">
                  {subOffices.map(({ subOffice, groups: subGroups }) => (
                    <div key={subOffice.id} className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider pl-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        {subOffice.name} ({subOffice.code}) &bull; {subGroups.length} Groups
                      </div>

                      {displayType === 'cards' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {subGroups.map((grp) => renderGroupCard(grp))}
                        </div>
                      ) : (
                        renderGroupTable(subGroups)
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Flat View of All Groups */
        <div>
          {filteredGroups.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No capstone groups found.</p>
            </div>
          ) : displayType === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredGroups.map((grp) => renderGroupCard(grp))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              {renderGroupTable(filteredGroups)}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Helper renderer for Group Card
  function renderGroupCard(grp: Group) {
    const progress = getGroupProgress(grp.id);
    const officeName = getOfficeName(grp.officeId);
    const subOfficeName = getSubOfficeName(grp.officeId, grp.subOfficeId);

    return (
      <div
        key={grp.id}
        className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between"
      >
        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              {subOfficeName}
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {progress.submitted}/{progress.total} Submitted
            </span>
          </div>

          <h4
            onClick={() => onSelectGroup(grp.id)}
            className="text-sm font-bold text-slate-900 hover:text-indigo-600 cursor-pointer line-clamp-2 leading-snug"
          >
            {grp.title}
          </h4>

          <div className="mt-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">Client: </span>
            {grp.clientNames.join(', ')}
          </div>

          {/* Members & Roles */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Proponents ({grp.members.length}):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {grp.members.map((m) => {
                const isPM = m.roles.includes('Project Manager');
                return (
                  <span
                    key={m.id}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                      isPM
                        ? 'bg-purple-50 text-purple-700 border-purple-200 font-semibold'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{m.firstName} {m.lastName}</span>
                    <span className="text-[10px] opacity-70">
                      ({m.roles.map(r => r === 'Project Manager' ? 'PM' : r === 'Systems Analyst' ? 'SA' : 'Dev').join('/')})
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer actions & progress bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all"
                style={{
                  width: `${progress.total > 0 ? (progress.returned / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              {progress.returned} Graded
            </span>
          </div>

          <button
            onClick={() => onSelectGroup(grp.id)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Manage Group &rarr;
          </button>
        </div>
      </div>
    );
  }

  // Helper renderer for Group Table
  function renderGroupTable(groupList: Group[]) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600 border-collapse">
          <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Capstone Proposal Title</th>
              <th className="py-3 px-4">Office & Sub-office</th>
              <th className="py-3 px-4">Main Client</th>
              <th className="py-3 px-4">Members & Roles</th>
              <th className="py-3 px-4 text-center">Progress</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groupList.map((grp) => {
              const progress = getGroupProgress(grp.id);
              const subOfficeName = getSubOfficeName(grp.officeId, grp.subOfficeId);
              return (
                <tr key={grp.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs">
                    <div
                      onClick={() => onSelectGroup(grp.id)}
                      className="cursor-pointer hover:text-indigo-600 line-clamp-2"
                    >
                      {grp.title}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium text-[11px]">
                      {subOfficeName}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {grp.clientNames.join(', ')}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-0.5">
                      {grp.members.map((m) => (
                        <div key={m.id} className="text-[11px]">
                          <span className="font-medium text-slate-800">
                            {m.firstName} {m.lastName}
                          </span>
                          <span className="text-slate-400 ml-1">
                            ({m.roles.join(', ')})
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <span className="font-semibold text-indigo-700">
                        {progress.returned}/{progress.total}
                      </span>
                      <span className="text-[10px] text-slate-400">returned</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => onSelectGroup(grp.id)}
                      className="px-2.5 py-1 text-indigo-600 hover:bg-indigo-50 font-semibold rounded transition-colors"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
};
