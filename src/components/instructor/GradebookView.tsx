import React, { useState, useMemo } from 'react';
import {
  Group,
  Deliverable,
  Task,
  GroupTaskSubmission,
  Office,
} from '../../types';
import { toCsvText } from '../../services/csv';
import {
  GraduationCap,
  Download,
  Search,
  SlidersHorizontal,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface GradebookViewProps {
  groups: Group[];
  deliverables: Deliverable[];
  tasks: Task[];
  submissions: GroupTaskSubmission[];
  offices: Office[];
  onOpenDocumentViewer: (submissionId: string) => void;
}

export const GradebookView: React.FC<GradebookViewProps> = ({
  groups,
  deliverables,
  tasks,
  submissions,
  offices,
  onOpenDocumentViewer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOfficeId, setSelectedOfficeId] = useState('all');

  const publishedTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'published' && !t.isArchived);
  }, [tasks]);

  const totalMaxPoints = useMemo(() => {
    return publishedTasks.reduce((sum, t) => sum + t.maxScore, 0);
  }, [publishedTasks]);

  // Compute grade records for each group
  const gradebookRows = useMemo(() => {
    return groups
      .filter((g) => {
        const matchesSearch =
          !searchTerm ||
          g.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          g.clientNames.some((c) => c.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesOffice =
          selectedOfficeId === 'all' || g.officeId === selectedOfficeId;
        return matchesSearch && matchesOffice;
      })
      .map((grp) => {
        let totalScoreEarned = 0;
        let submittedCount = 0;
        let returnedCount = 0;

        const taskScores: Record<
          string,
          {
            submissionId?: string;
            score?: number;
            status: string;
            isLate?: boolean;
            penalty?: number;
          }
        > = {};

        for (const t of publishedTasks) {
          const sub = submissions.find(
            (s) => s.groupId === grp.id && s.taskId === t.id
          );
          if (sub && sub.grade) {
            const score = sub.grade.finalScore;
            totalScoreEarned += score;
            submittedCount++;
            if (sub.status === 'returned') returnedCount++;

            taskScores[t.id] = {
              submissionId: sub.id,
              score,
              status: sub.status,
              isLate: sub.grade.daysLate > 0,
              penalty: sub.grade.lateDeduction,
            };
          } else if (sub && sub.versions.length > 0) {
            submittedCount++;
            taskScores[t.id] = {
              submissionId: sub.id,
              status: sub.status,
            };
          } else {
            taskScores[t.id] = {
              status: 'unsubmitted',
            };
          }
        }

        const percentage =
          totalMaxPoints > 0 ? (totalScoreEarned / totalMaxPoints) * 100 : 0;

        return {
          group: grp,
          totalScoreEarned,
          percentage,
          submittedCount,
          returnedCount,
          taskScores,
        };
      });
  }, [groups, searchTerm, selectedOfficeId, publishedTasks, submissions, totalMaxPoints]);

  // Export Gradebook CSV
  const handleExportCSV = () => {
    const headers = [
      'Capstone Title',
      'Office',
      'Clients',
      ...publishedTasks.map((t) => `${t.name} (Max ${t.maxScore})`),
      `Total Score (Max ${totalMaxPoints})`,
      'Percentage (%)',
    ];

    const rows = gradebookRows.map((row) => {
      const office = offices.find((o) => o.id === row.group.officeId);
      return [
        row.group.title,
        office?.name || '',
        row.group.clientNames.join(', '),
        ...publishedTasks.map((t) => {
          const item = row.taskScores[t.id];
          if (!item || item.score === undefined) return 'N/A';
          return item.score.toFixed(1);
        }),
        row.totalScoreEarned.toFixed(1),
        `${row.percentage.toFixed(1)}%`,
      ];
    });

    const csvContent = toCsvText(headers, rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Capstone_Gradebook_${new Date().toISOString().slice(0, 10)}.csv`);
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
            Comprehensive Gradebook
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Evaluate group scores across all proposal milestones, track late penalties, and export grades.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Download className="w-4 h-4 text-indigo-600" />
          Export Gradebook CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search group or client..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs text-slate-500">Filter Office:</span>
          <select
            value={selectedOfficeId}
            onChange={(e) => setSelectedOfficeId(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg py-1.5 px-2.5 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Offices</option>
            {offices.map((off) => (
              <option key={off.id} value={off.id}>
                {off.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Gradebook Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 sticky left-0 bg-slate-50 z-10 w-72 shadow-xs">
                  Capstone Proposal
                </th>
                {publishedTasks.map((t) => (
                  <th
                    key={t.id}
                    className="py-3 px-3 text-center whitespace-nowrap min-w-[130px] border-l border-slate-200/60"
                  >
                    <div className="font-bold text-slate-900 truncate max-w-[150px]">
                      {t.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      Max: {t.maxScore} pts
                    </div>
                  </th>
                ))}
                <th className="py-3 px-4 text-center font-bold text-indigo-900 bg-indigo-50/50 border-l border-indigo-100 whitespace-nowrap">
                  Total Score
                  <div className="text-[10px] font-normal text-indigo-700">
                    Max {totalMaxPoints} pts
                  </div>
                </th>
                <th className="py-3 px-4 text-center font-bold text-slate-900 bg-slate-100/50 border-l border-slate-200 whitespace-nowrap">
                  Percentage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {gradebookRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={publishedTasks.length + 3}
                    className="text-center py-12 text-slate-400"
                  >
                    No group records found.
                  </td>
                </tr>
              ) : (
                gradebookRows.map((row) => (
                  <tr
                    key={row.group.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Sticky Group Title Column */}
                    <td className="py-3.5 px-4 sticky left-0 bg-white z-10 shadow-xs border-r border-slate-100">
                      <div className="font-bold text-slate-900 leading-snug line-clamp-1">
                        {row.group.title}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {row.group.clientNames.join(', ')}
                      </div>
                    </td>

                    {/* Task Scores */}
                    {publishedTasks.map((t) => {
                      const item = row.taskScores[t.id];

                      return (
                        <td
                          key={t.id}
                          className="py-3.5 px-3 text-center border-l border-slate-100 whitespace-nowrap"
                        >
                          {item && item.score !== undefined ? (
                            <div
                              onClick={() =>
                                item.submissionId &&
                                onOpenDocumentViewer(item.submissionId)
                              }
                              className="cursor-pointer group flex flex-col items-center justify-center hover:opacity-80"
                            >
                              <span
                                className={`font-mono font-bold text-xs ${
                                  item.status === 'returned'
                                    ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200'
                                    : 'text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200'
                                }`}
                              >
                                {item.score.toFixed(1)}
                              </span>
                              {item.isLate && (
                                <span className="text-[10px] text-rose-600 font-semibold mt-0.5">
                                  -{item.penalty} late
                                </span>
                              )}
                            </div>
                          ) : item && item.status === 'submitted' ? (
                            <button
                              onClick={() =>
                                item.submissionId &&
                                onOpenDocumentViewer(item.submissionId)
                              }
                              className="text-[11px] font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200"
                            >
                              Needs Review
                            </button>
                          ) : (
                            <span className="text-slate-300 font-mono">--</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Total Score */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-indigo-700 bg-indigo-50/30 border-l border-indigo-100 whitespace-nowrap text-sm">
                      {row.totalScoreEarned.toFixed(1)}
                    </td>

                    {/* Percentage */}
                    <td className="py-3.5 px-4 text-center font-bold text-slate-800 bg-slate-100/30 border-l border-slate-200 whitespace-nowrap">
                      {row.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
