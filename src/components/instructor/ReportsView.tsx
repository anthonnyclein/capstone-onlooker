import React, { useMemo } from 'react';
import {
  Group,
  Deliverable,
  Task,
  GroupTaskSubmission,
  Office,
} from '../../types';
import { toCsvText } from '../../services/csv';
import {
  BarChart3,
  Download,
  CheckCircle2,
  ClockAlert,
  Building2,
  FileCheck,
  TrendingUp,
  Award,
} from 'lucide-react';
import { calculateDaysLate } from '../../utils/dateUtils';

interface ReportsViewProps {
  groups: Group[];
  deliverables: Deliverable[];
  tasks: Task[];
  submissions: GroupTaskSubmission[];
  offices: Office[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  groups,
  deliverables,
  tasks,
  submissions,
  offices,
}) => {
  const publishedTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'published' && !t.isArchived);
  }, [tasks]);

  // 1. Task Performance & Timeliness Metrics
  const taskAnalytics = useMemo(() => {
    return publishedTasks.map((t) => {
      const taskSubs = submissions.filter((s) => s.taskId === t.id);
      const submittedCount = taskSubs.filter((s) => s.versions.length > 0).length;
      const gradedSubs = taskSubs.filter((s) => s.grade);

      let onTimeCount = 0;
      let lateCount = 0;
      let totalScore = 0;
      let minScore = Infinity;
      let maxScore = -Infinity;

      for (const s of taskSubs) {
        const latestVer = s.versions[s.versions.length - 1];
        if (latestVer) {
          const daysLate = calculateDaysLate(latestVer.submittedAt, t.deadline);
          if (daysLate > 0) lateCount++;
          else onTimeCount++;
        }
        if (s.grade) {
          const sc = s.grade.finalScore;
          totalScore += sc;
          if (sc < minScore) minScore = sc;
          if (sc > maxScore) maxScore = sc;
        }
      }

      const avgScore = gradedSubs.length > 0 ? totalScore / gradedSubs.length : 0;
      const complianceRate = groups.length > 0 ? (submittedCount / groups.length) * 100 : 0;

      return {
        task: t,
        totalGroups: groups.length,
        submittedCount,
        gradedCount: gradedSubs.length,
        onTimeCount,
        lateCount,
        avgScore,
        minScore: minScore === Infinity ? 0 : minScore,
        maxScore: maxScore === -Infinity ? 0 : maxScore,
        complianceRate,
      };
    });
  }, [publishedTasks, submissions, groups]);

  // 2. Proposal Distribution across Offices & Sub-offices
  const officeDistribution = useMemo(() => {
    return offices.map((off) => {
      const officeGroups = groups.filter((g) => g.officeId === off.id);
      const subDistribution = off.subOffices.map((sub) => {
        const count = groups.filter(
          (g) => g.officeId === off.id && g.subOfficeId === sub.id
        ).length;
        return { name: sub.name, code: sub.code, count };
      });

      return {
        office: off,
        totalGroups: officeGroups.length,
        percentage: groups.length > 0 ? (officeGroups.length / groups.length) * 100 : 0,
        subDistribution,
      };
    });
  }, [offices, groups]);

  // 3. Annotations and Feedback Summary
  const annotationStats = useMemo(() => {
    let totalAnnotations = 0;
    let commentOnly = 0;
    let requiredAction = 0;

    for (const sub of submissions) {
      for (const ann of sub.annotations) {
        totalAnnotations++;
        commentOnly++;
      }
    }

    return { totalAnnotations, commentOnly, requiredAction };
  }, [submissions]);

  // Export Analytics CSV
  const handleExportAnalyticsCSV = () => {
    const headers = [
      'Task Name',
      'Deliverable ID',
      'Max Score',
      'Total Groups',
      'Submitted Count',
      'Compliance Rate (%)',
      'On Time Count',
      'Late Count',
      'Average Score',
      'Highest Score',
      'Lowest Score',
    ];

    const rows = taskAnalytics.map((ta) => [
      ta.task.name,
      ta.task.deliverableId,
      ta.task.maxScore,
      ta.totalGroups,
      ta.submittedCount,
      `${ta.complianceRate.toFixed(1)}%`,
      ta.onTimeCount,
      ta.lateCount,
      ta.avgScore.toFixed(1),
      ta.maxScore.toFixed(1),
      ta.minScore.toFixed(1),
    ]);

    const csvContent = toCsvText(headers, rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Capstone_Compliance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Institutional Reports & Analytics
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Statistical breakdown of proposal compliance, timeliness, score distribution, and revision volume.
          </p>
        </div>
        <button
          onClick={handleExportAnalyticsCSV}
          className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Download className="w-4 h-4 text-indigo-600" />
          Export Report CSV
        </button>
      </div>

      {/* Top Analytics KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Average Compliance</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {taskAnalytics.length > 0
              ? (
                  taskAnalytics.reduce((acc, t) => acc + t.complianceRate, 0) /
                  taskAnalytics.length
                ).toFixed(1)
              : 0}
            %
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Average on-time and completed submission rate
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Document Annotations</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {annotationStats.totalAnnotations}
          </div>
          <span className="text-[11px] text-purple-700/80 mt-1 block">
            {annotationStats.requiredAction} required revisions &bull; {annotationStats.commentOnly} advisory comments
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Participating Units</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {offices.length} Offices
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Across {offices.reduce((sum, o) => sum + o.subOffices.length, 0)} colleges/departments
          </span>
        </div>
      </div>

      {/* Task Performance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Task Submission Compliance & Score Distribution
          </h3>
          <span className="text-xs text-slate-400">
            Across {publishedTasks.length} active tasks
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Task Name</th>
                <th className="py-3 px-4 text-center">Compliance</th>
                <th className="py-3 px-4 text-center">On-Time</th>
                <th className="py-3 px-4 text-center">Late</th>
                <th className="py-3 px-4 text-center">Avg Score</th>
                <th className="py-3 px-4 text-center">High / Low</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {taskAnalytics.map((ta) => (
                <tr key={ta.task.id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div>{ta.task.name}</div>
                    <span className="text-[10px] text-slate-400">
                      Max {ta.task.maxScore} pts
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full"
                          style={{ width: `${ta.complianceRate}%` }}
                        />
                      </div>
                      <span className="font-semibold text-slate-800 text-[11px]">
                        {ta.complianceRate.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                      {ta.onTimeCount}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className={`font-semibold px-2 py-0.5 rounded ${ta.lateCount > 0 ? 'text-rose-700 bg-rose-50' : 'text-slate-400'}`}>
                      {ta.lateCount}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-indigo-700 whitespace-nowrap">
                    {ta.gradedCount > 0 ? ta.avgScore.toFixed(1) : '--'}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-slate-600 whitespace-nowrap">
                    {ta.gradedCount > 0
                      ? `${ta.maxScore.toFixed(1)} / ${ta.minScore.toFixed(1)}`
                      : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Office & Sub-Office Distribution Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-4">
          Capstone Proposal Distribution by Office & Sub-office
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {officeDistribution.map((od) => (
            <div
              key={od.office.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {od.office.code}
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {od.office.name}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  {od.totalGroups} Groups ({od.percentage.toFixed(0)}%)
                </span>
              </div>

              {/* Breakdown by sub-offices */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                {od.subDistribution.map((sub) => (
                  <div
                    key={sub.code}
                    className="flex items-center justify-between text-xs text-slate-600 bg-white p-2 rounded border border-slate-100"
                  >
                    <span>
                      {sub.name} ({sub.code})
                    </span>
                    <span className="font-semibold text-slate-800">
                      {sub.count} group(s)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
