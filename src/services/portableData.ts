/**
 * Portable text-file (CSV) storage for the whole application dataset.
 *
 * Design goals:
 *  1. Every file is a plain CSV table that opens directly in a spreadsheet
 *     (one header row, one record per row, scalar cells only).
 *  2. Export -> import is lossless, so the app can be moved to another PC by
 *     copying a folder of text files.
 *  3. Import is resilient: files are recognised by their header row (file
 *     names may be changed freely) and only the tables present in the
 *     selection are replaced; missing tables fall back to the current data.
 *
 * Nested collections are either split into their own child table (rows with a
 * parent id column) or encoded as escaped ` | `-separated lists inside a cell,
 * so every cell stays a single spreadsheet value.
 */

import {
  Office,
  SubOffice,
  Group,
  StudentMember,
  Deliverable,
  RubricCriterion,
  Task,
  GroupTaskSubmission,
  SubmissionVersion,
  RevisionResponse,
  DocumentAnnotation,
  SubmissionGrade,
  CriterionAssessment,
  UserAccount,
  DefenseAttempt,
  DefenseReportProposal,
  DefenseSignature,
  CommitteeAction,
  PresentationEvaluation,
  PresentationIndividualRating,
  ManuscriptEvaluation,
  ManuscriptItemRating,
} from '../types';
import { toCsvText, parseCsvText } from './csv';

export interface AppDataset {
  offices: Office[];
  groups: Group[];
  deliverables: Deliverable[];
  tasks: Task[];
  submissions: GroupTaskSubmission[];
  accounts: UserAccount[];
  defenseAttempts: DefenseAttempt[];
}

export interface CsvTableFile {
  /** File name, e.g. `cpms_offices.csv`. */
  name: string;
  /** Human readable table label used in the UI. */
  label: string;
  text: string;
  rows: number;
  kind: 'data' | 'meta';
}

export type TableKey =
  | 'offices'
  | 'groups'
  | 'groupMembers'
  | 'deliverables'
  | 'rubricCriteria'
  | 'tasks'
  | 'submissions'
  | 'submissionVersions'
  | 'revisionResponses'
  | 'annotations'
  | 'gradeAssessments'
  | 'gradeRubric'
  | 'accounts'
  | 'defenseAttempts'
  | 'reportActions'
  | 'reportSignatures'
  | 'presentationEvaluations'
  | 'presentationIndividualRatings'
  | 'manuscriptEvaluations'
  | 'manuscriptRatings';

/* ------------------------------------------------------------------ */
/* Cell helpers                                                        */
/* ------------------------------------------------------------------ */

const LIST_SEP = ' | ';

function escItem(item: string): string {
  return item.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

/** Escape + join a scalar array into one cell value (order preserved). */
export function listJoin(items: (string | number)[]): string {
  return items.map((item) => escItem(String(item))).join(LIST_SEP);
}

/** Inverse of listJoin. */
export function listSplit(text: string): string[] {
  if (text === '') return [];
  return splitEscaped(text, LIST_SEP);
}

function splitEscaped(text: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let escaped = false;
  let i = 0;
  while (i < text.length) {
    if (escaped) {
      current += text[i];
      escaped = false;
      i += 1;
      continue;
    }
    if (text[i] === '\\') {
      escaped = true;
      i += 1;
      continue;
    }
    if (text.startsWith(sep, i)) {
      result.push(current);
      current = '';
      i += sep.length;
      continue;
    }
    current += text[i];
    i += 1;
  }
  if (escaped) current += '\\';
  result.push(current);
  return result;
}

function str(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

function optStr(value: string | undefined): string {
  return value === undefined || value === null ? '' : value;
}

function fromOptStr(value: string): string | undefined {
  return value === '' ? undefined : value;
}

function boolTo(value: boolean): string {
  return value ? 'true' : 'false';
}

function boolFrom(value: string): boolean {
  return value.trim().toLowerCase() === 'true';
}

function boolOptTo(value: boolean | undefined): string {
  return value === undefined ? '' : boolTo(value);
}

function boolOptFrom(value: string): boolean | undefined {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === '') return undefined;
  return trimmed === 'true';
}

function numTo(value: number | undefined): string {
  return value === undefined || Number.isNaN(value) ? '' : String(value);
}

function numFrom(value: string, fallback = 0): number {
  if (value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numOptFrom(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function byPosition(a: { pos: number }, b: { pos: number }): number {
  return a.pos - b.pos;
}

interface Positioned {
  pos: number;
}

function positionSort<T extends Positioned>(items: T[]): T[] {
  return [...items].sort(byPosition);
}

interface Level {
  name: string;
  percentage: number;
}

function levelsTo(levels: Level[]): string {
  return listJoin(levels.map((level) => `${level.name}=${level.percentage}`));
}

function levelsFrom(cell: string): Level[] {
  return listSplit(cell).map((item) => {
    const idx = item.lastIndexOf('=');
    if (idx === -1) return { name: item, percentage: 0 };
    return { name: item.slice(0, idx), percentage: numFrom(item.slice(idx + 1)) };
  });
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

interface TablePlan {
  key: TableKey;
  name: string;
  label: string;
  headers: string[];
  rows: string[][];
}

export function exportDataset(dataset: AppDataset, exportedAt: string = new Date().toISOString()): CsvTableFile[] {
  const plans: TablePlan[] = [];

  /* 1. Offices + sub-offices (flattened with parent id) */
  {
    const rows: string[][] = [];
    dataset.offices.forEach((office, officeIndex) => {
      rows.push([office.id, office.code, office.name, '', String(officeIndex)]);
      office.subOffices.forEach((sub, subIndex) => {
        rows.push([sub.id, sub.code, sub.name, office.id, String(subIndex)]);
      });
    });
    plans.push({
      key: 'offices',
      name: 'cpms_offices.csv',
      label: 'Offices & Sub-offices',
      headers: ['id', 'code', 'name', 'parent_id', 'position'],
      rows,
    });
  }

  /* 2. Groups */
  {
    const rows: string[][] = dataset.groups.map((group, index) => [
      group.id,
      group.title,
      optStr(group.code),
      group.officeId,
      group.subOfficeId,
      listJoin(group.clientNames),
      group.createdAt,
      String(index),
    ]);
    plans.push({
      key: 'groups',
      name: 'cpms_groups.csv',
      label: 'Capstone Groups',
      headers: ['id', 'title', 'code', 'office_id', 'sub_office_id', 'client_names', 'created_at', 'position'],
      rows,
    });
  }

  /* 3. Group members (roster + login credentials) */
  {
    const rows: string[][] = [];
    dataset.groups.forEach((group) => {
      group.members.forEach((member, index) => {
        rows.push([
          group.id,
          member.id,
          member.firstName,
          member.lastName,
          member.username,
          listJoin(member.roles),
          optStr(member.passwordHash),
          boolOptTo(member.mustChangePassword),
          String(index),
        ]);
      });
    });
    plans.push({
      key: 'groupMembers',
      name: 'cpms_group_members.csv',
      label: 'Group Members / Student Credentials',
      headers: [
        'group_id',
        'member_id',
        'first_name',
        'last_name',
        'username',
        'roles',
        'password_hash',
        'must_change_password',
        'position',
      ],
      rows,
    });
  }

  /* 4. Deliverables */
  {
    const rows: string[][] = dataset.deliverables.map((deliverable, index) => [
      deliverable.id,
      deliverable.name,
      deliverable.description,
      String(deliverable.totalPossiblePoints),
      boolOptTo(deliverable.isArchived),
      deliverable.createdAt,
      String(index),
    ]);
    plans.push({
      key: 'deliverables',
      name: 'cpms_deliverables.csv',
      label: 'Deliverables',
      headers: ['id', 'name', 'description', 'total_points', 'is_archived', 'created_at', 'position'],
      rows,
    });
  }

  /* 5. Rubric criteria (child of deliverable) */
  {
    const rows: string[][] = [];
    dataset.deliverables.forEach((deliverable) => {
      deliverable.rubric.forEach((criterion, index) => {
        rows.push([
          deliverable.id,
          criterion.id,
          String(index),
          criterion.name,
          criterion.description,
          String(criterion.maxPoints),
          levelsTo(criterion.levels),
        ]);
      });
    });
    plans.push({
      key: 'rubricCriteria',
      name: 'cpms_rubric_criteria.csv',
      label: 'Rubric Criteria',
      headers: ['deliverable_id', 'criterion_id', 'position', 'name', 'description', 'max_points', 'levels'],
      rows,
    });
  }

  /* 6. Tasks */
  {
    const rows: string[][] = dataset.tasks.map((task, index) => [
      task.id,
      task.deliverableId,
      task.name,
      task.instructions,
      task.deadline,
      String(task.maxScore),
      task.latePolicy.type,
      String(task.latePolicy.deductionAmount),
      numTo(task.latePolicy.maxDeduction),
      task.status,
      boolOptTo(task.isRevisionTask),
      boolOptTo(task.isArchived),
      task.createdAt,
      String(index),
    ]);
    plans.push({
      key: 'tasks',
      name: 'cpms_tasks.csv',
      label: 'Tasks / Milestones',
      headers: [
        'id',
        'deliverable_id',
        'name',
        'instructions',
        'deadline',
        'max_score',
        'late_policy_type',
        'late_deduction_amount',
        'late_max_deduction',
        'status',
        'is_revision_task',
        'is_archived',
        'created_at',
        'position',
      ],
      rows,
    });
  }

  /* 7. Submissions (grade scalars inline) */
  {
    const rows: string[][] = dataset.submissions.map((submission, index) => {
      const grade = submission.grade;
      return [
        submission.id,
        submission.groupId,
        submission.taskId,
        submission.deliverableId,
        submission.status,
        String(submission.currentVersion),
        optStr(submission.submittedAt),
        boolTo(!!grade),
        numTo(grade?.rubricRawScore),
        numTo(grade?.rubricMaxScore),
        numTo(grade?.taskRawScore),
        numTo(grade?.lateDeduction),
        numTo(grade?.daysLate),
        numTo(grade?.finalScore),
        optStr(grade?.overallRemarks),
        optStr(grade?.gradedAt),
        boolOptTo(grade?.isReturned),
        optStr(grade?.returnedAt),
        optStr(grade?.lastEditedAt),
        String(index),
      ];
    });
    plans.push({
      key: 'submissions',
      name: 'cpms_submissions.csv',
      label: 'Submissions (incl. grade totals)',
      headers: [
        'id',
        'group_id',
        'task_id',
        'deliverable_id',
        'status',
        'current_version',
        'submitted_at',
        'has_grade',
        'grade_rubric_raw_score',
        'grade_rubric_max_score',
        'grade_task_raw_score',
        'grade_late_deduction',
        'grade_days_late',
        'grade_final_score',
        'grade_overall_remarks',
        'grade_graded_at',
        'grade_is_returned',
        'grade_returned_at',
        'grade_last_edited_at',
        'position',
      ],
      rows,
    });
  }

  /* 8. Submission versions */
  {
    const rows: string[][] = [];
    dataset.submissions.forEach((submission) => {
      submission.versions.forEach((version, index) => {
        rows.push([
          submission.id,
          String(index),
          String(version.version),
          version.submittedAt,
          version.submittedByMemberId,
          version.submittedByName,
          version.fileName,
          String(version.fileSize),
          optStr(version.remarks),
          optStr(version.fileDataUrl),
        ]);
      });
    });
    plans.push({
      key: 'submissionVersions',
      name: 'cpms_submission_versions.csv',
      label: 'Submission Versions',
      headers: [
        'submission_id',
        'position',
        'version',
        'submitted_at',
        'submitted_by_member_id',
        'submitted_by_name',
        'file_name',
        'file_size',
        'remarks',
        'file_data_url',
      ],
      rows,
    });
  }

  /* 9. Revision responses (child of a version) */
  {
    const rows: string[][] = [];
    dataset.submissions.forEach((submission) => {
      submission.versions.forEach((version) => {
        (version.revisionResponses || []).forEach((response, index) => {
          rows.push([
            submission.id,
            String(version.version),
            String(index),
            response.id,
            response.instructorComment,
            response.pageOrSection,
            response.changeDescription,
          ]);
        });
      });
    });
    plans.push({
      key: 'revisionResponses',
      name: 'cpms_revision_responses.csv',
      label: 'Revision Responses',
      headers: [
        'submission_id',
        'version',
        'position',
        'response_id',
        'instructor_comment',
        'page_or_section',
        'change_description',
      ],
      rows,
    });
  }

  /* 10. Annotations */
  {
    const rows: string[][] = [];
    dataset.submissions.forEach((submission) => {
      submission.annotations.forEach((annotation, index) => {
        rows.push([
          submission.id,
          String(index),
          annotation.id,
          String(annotation.version),
          String(annotation.pageNumber),
          String(annotation.x),
          String(annotation.y),
          annotation.width === undefined ? '' : String(annotation.width),
          annotation.height === undefined ? '' : String(annotation.height),
          annotation.comment,
          annotation.authorName,
          annotation.createdAt,
        ]);
      });
    });
    plans.push({
      key: 'annotations',
      name: 'cpms_annotations.csv',
      label: 'Document Annotations',
      headers: [
        'submission_id',
        'position',
        'annotation_id',
        'version',
        'page_number',
        'x',
        'y',
        'width',
        'height',
        'comment',
        'author_name',
        'created_at',
      ],
      rows,
    });
  }

  /* 11. Grade criterion assessments */
  {
    const rows: string[][] = [];
    dataset.submissions.forEach((submission) => {
      if (!submission.grade) return;
      Object.values(submission.grade.criterionAssessments).forEach((assessment) => {
        rows.push([
          submission.id,
          assessment.criterionId,
          assessment.levelName,
          String(assessment.percentage),
          String(assessment.score),
          String(assessment.maxPoints),
        ]);
      });
    });
    plans.push({
      key: 'gradeAssessments',
      name: 'cpms_grade_assessments.csv',
      label: 'Grade Rubric Scores',
      headers: ['submission_id', 'criterion_id', 'level_name', 'percentage', 'score', 'max_points'],
      rows,
    });
  }

  /* 12. Frozen rubric snapshot per graded submission */
  {
    const rows: string[][] = [];
    dataset.submissions.forEach((submission) => {
      if (!submission.grade) return;
      submission.grade.frozenRubric.forEach((criterion, index) => {
        rows.push([
          submission.id,
          String(index),
          criterion.id,
          criterion.name,
          criterion.description,
          String(criterion.maxPoints),
          levelsTo(criterion.levels),
        ]);
      });
    });
    plans.push({
      key: 'gradeRubric',
      name: 'cpms_grade_frozen_rubric.csv',
      label: 'Graded Rubric Snapshots',
      headers: ['submission_id', 'position', 'criterion_id', 'name', 'description', 'max_points', 'levels'],
      rows,
    });
  }

  /* 13. Accounts (instructor / panel / student logins) */
  {
    const rows: string[][] = dataset.accounts.map((account, index) => [
      account.id,
      account.username,
      account.firstName,
      account.lastName,
      account.role,
      optStr(account.academicTitle),
      optStr(account.academicRank),
      optStr(account.groupId),
      account.studentRoles ? listJoin(account.studentRoles) : '',
      boolOptTo(account.mustChangePassword),
      optStr(account.avatarUrl),
      String(index),
      optStr(account.passwordHash),
    ]);
    plans.push({
      key: 'accounts',
      name: 'cpms_accounts.csv',
      label: 'User Accounts',
      headers: [
        'id',
        'username',
        'first_name',
        'last_name',
        'role',
        'academic_title',
        'academic_rank',
        'group_id',
        'student_roles',
        'must_change_password',
        'avatar_url',
        'position',
        'password_hash',
      ],
      rows,
    });
  }

  /* 14. Defense attempts (report scalars inline) */
  {
    const rows: string[][] = dataset.defenseAttempts.map((attempt, index) => {
      const report = attempt.report;
      return [
        attempt.id,
        attempt.groupId,
        String(attempt.attemptNumber),
        optStr(attempt.previousAttemptId),
        attempt.defenseDate,
        attempt.defenseTime,
        attempt.venue,
        listJoin(attempt.panelMemberIds),
        attempt.leadPanelId,
        attempt.createdAt,
        attempt.status,
        String(index),
        boolTo(!!report),
        optStr(report?.leadPanelId),
        optStr(report?.leadPanelName),
        optStr(report?.degreeSought),
        optStr(report?.venueOrPlace),
        optStr(report?.decision),
        optStr(report?.conditionsOrRemarks),
        optStr(report?.updatedAt),
        optStr(report?.lastSignaturesInvalidatedAt),
      ];
    });
    plans.push({
      key: 'defenseAttempts',
      name: 'cpms_defense_attempts.csv',
      label: 'Oral Defense Attempts',
      headers: [
        'id',
        'group_id',
        'attempt_number',
        'previous_attempt_id',
        'defense_date',
        'defense_time',
        'venue',
        'panel_member_ids',
        'lead_panel_id',
        'created_at',
        'status',
        'position',
        'has_report',
        'report_lead_panel_id',
        'report_lead_panel_name',
        'report_degree_sought',
        'report_venue_or_place',
        'report_decision',
        'report_conditions_or_remarks',
        'report_updated_at',
        'report_last_signatures_invalidated_at',
      ],
      rows,
    });
  }

  /* 15. Report committee actions */
  {
    const rows: string[][] = [];
    dataset.defenseAttempts.forEach((attempt) => {
      if (!attempt.report) return;
      Object.entries(attempt.report.committeeActions).forEach(([panelId, action], index) => {
        rows.push([attempt.id, panelId, action as string, String(index)]);
      });
    });
    plans.push({
      key: 'reportActions',
      name: 'cpms_report_actions.csv',
      label: 'Report Committee Actions',
      headers: ['attempt_id', 'panel_member_id', 'action', 'position'],
      rows,
    });
  }

  /* 16. Report signatures */
  {
    const rows: string[][] = [];
    dataset.defenseAttempts.forEach((attempt) => {
      if (!attempt.report) return;
      attempt.report.signatures.forEach((signature, index) => {
        rows.push([
          attempt.id,
          signature.panelMemberId,
          signature.panelMemberName,
          signature.signedAt,
          boolTo(signature.isLeadPanel),
          optStr(signature.signatureDataUrl),
          String(index),
        ]);
      });
    });
    plans.push({
      key: 'reportSignatures',
      name: 'cpms_report_signatures.csv',
      label: 'Report Signatures',
      headers: [
        'attempt_id',
        'panel_member_id',
        'panel_member_name',
        'signed_at',
        'is_lead_panel',
        'signature_data_url',
        'position',
      ],
      rows,
    });
  }

  /* 17. Presentation evaluations */
  {
    const rows: string[][] = [];
    dataset.defenseAttempts.forEach((attempt) => {
      Object.values(attempt.presentationEvaluations || {}).forEach((evaluation) => {
        const rating = evaluation.groupRating;
        rows.push([
          attempt.id,
          evaluation.panelMemberId,
          evaluation.panelMemberName,
          evaluation.evaluatedAt,
          String(rating.clarityOfPresentation),
          String(rating.understandingOfProject),
          String(rating.engagementAndCommunication),
          String(rating.useOfVisualAids),
          String(rating.handlingOfQA),
          String(rating.teamCollaboration),
          String(rating.timeManagement),
          String(rating.professionalismAndConfidence),
          String(evaluation.totalGroupScore),
          String(evaluation.averageGroupScore),
          optStr(evaluation.comments),
        ]);
      });
    });
    plans.push({
      key: 'presentationEvaluations',
      name: 'cpms_presentation_evaluations.csv',
      label: 'Oral Presentation Evaluations',
      headers: [
        'attempt_id',
        'panel_member_id',
        'panel_member_name',
        'evaluated_at',
        'clarity_of_presentation',
        'understanding_of_project',
        'engagement_and_communication',
        'use_of_visual_aids',
        'handling_of_qa',
        'team_collaboration',
        'time_management',
        'professionalism_and_confidence',
        'total_group_score',
        'average_group_score',
        'comments',
      ],
      rows,
    });
  }

  /* 18. Presentation individual student ratings */
  {
    const rows: string[][] = [];
    dataset.defenseAttempts.forEach((attempt) => {
      Object.values(attempt.presentationEvaluations || {}).forEach((evaluation) => {
        evaluation.individualRatings.forEach((rating, index) => {
          rows.push([
            attempt.id,
            evaluation.panelMemberId,
            String(index),
            rating.studentId,
            rating.studentName,
            String(rating.rate),
          ]);
        });
      });
    });
    plans.push({
      key: 'presentationIndividualRatings',
      name: 'cpms_presentation_individual_ratings.csv',
      label: 'Presentation Individual Student Ratings',
      headers: ['attempt_id', 'panel_member_id', 'position', 'student_id', 'student_name', 'rate'],
      rows,
    });
  }

  /* 19. Manuscript evaluations */
  {
    const rows: string[][] = [];
    dataset.defenseAttempts.forEach((attempt) => {
      Object.values(attempt.manuscriptEvaluations || {}).forEach((evaluation, index) => {
        rows.push([
          attempt.id,
          evaluation.panelMemberId,
          evaluation.panelMemberName,
          evaluation.evaluatedAt,
          String(evaluation.totalScore),
          String(evaluation.averageScore),
          optStr(evaluation.overallRemarks),
          String(index),
        ]);
      });
    });
    plans.push({
      key: 'manuscriptEvaluations',
      name: 'cpms_manuscript_evaluations.csv',
      label: 'Manuscript Evaluations',
      headers: [
        'attempt_id',
        'panel_member_id',
        'panel_member_name',
        'evaluated_at',
        'total_score',
        'average_score',
        'overall_remarks',
        'position',
      ],
      rows,
    });
  }

  /* 20. Manuscript 33-item ratings */
  {
    const rows: string[][] = [];
    dataset.defenseAttempts.forEach((attempt) => {
      Object.values(attempt.manuscriptEvaluations || {}).forEach((evaluation) => {
        Object.values(evaluation.ratings || {}).forEach((rating, index) => {
          rows.push([attempt.id, evaluation.panelMemberId, rating.itemId, String(rating.rate), optStr(rating.comment), String(index)]);
        });
      });
    });
    plans.push({
      key: 'manuscriptRatings',
      name: 'cpms_manuscript_ratings.csv',
      label: 'Manuscript Item Ratings',
      headers: ['attempt_id', 'panel_member_id', 'item_id', 'rate', 'comment', 'position'],
      rows,
    });
  }

  const files: CsvTableFile[] = plans.map((plan) => ({
    name: plan.name,
    label: plan.label,
    rows: plan.rows.length,
    kind: 'data',
    text: toCsvText(plan.headers, plan.rows),
  }));

  // Human readable manifest (not a data table – ignored on import).
  files.push({
    name: 'cpms_manifest.csv',
    label: 'Backup Manifest',
    kind: 'meta',
    rows: files.length,
    text: toCsvText(
      ['file_name', 'table', 'rows', 'exported_at'],
      files.map((file) => [file.name, file.label, String(file.rows), exportedAt])
    ),
  });

  return files;
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

interface TableDef {
  key: TableKey;
  name: string;
  label: string;
  headers: string[];
}

export const TABLE_DEFS: TableDef[] = [
  { key: 'offices', name: 'cpms_offices.csv', label: 'Offices & Sub-offices', headers: ['id', 'code', 'name', 'parent_id', 'position'] },
  { key: 'groups', name: 'cpms_groups.csv', label: 'Capstone Groups', headers: ['id', 'title', 'code', 'office_id', 'sub_office_id', 'client_names', 'created_at', 'position'] },
  { key: 'groupMembers', name: 'cpms_group_members.csv', label: 'Group Members / Student Credentials', headers: ['group_id', 'member_id', 'first_name', 'last_name', 'username', 'roles', 'password_hash', 'must_change_password', 'position'] },
  { key: 'deliverables', name: 'cpms_deliverables.csv', label: 'Deliverables', headers: ['id', 'name', 'description', 'total_points', 'is_archived', 'created_at', 'position'] },
  { key: 'rubricCriteria', name: 'cpms_rubric_criteria.csv', label: 'Rubric Criteria', headers: ['deliverable_id', 'criterion_id', 'position', 'name', 'description', 'max_points', 'levels'] },
  { key: 'tasks', name: 'cpms_tasks.csv', label: 'Tasks / Milestones', headers: ['id', 'deliverable_id', 'name', 'instructions', 'deadline', 'max_score', 'late_policy_type', 'late_deduction_amount', 'late_max_deduction', 'status', 'is_revision_task', 'is_archived', 'created_at', 'position'] },
  { key: 'submissions', name: 'cpms_submissions.csv', label: 'Submissions (incl. grade totals)', headers: ['id', 'group_id', 'task_id', 'deliverable_id', 'status', 'current_version', 'submitted_at', 'has_grade', 'grade_rubric_raw_score', 'grade_rubric_max_score', 'grade_task_raw_score', 'grade_late_deduction', 'grade_days_late', 'grade_final_score', 'grade_overall_remarks', 'grade_graded_at', 'grade_is_returned', 'grade_returned_at', 'grade_last_edited_at', 'position'] },
  { key: 'submissionVersions', name: 'cpms_submission_versions.csv', label: 'Submission Versions', headers: ['submission_id', 'position', 'version', 'submitted_at', 'submitted_by_member_id', 'submitted_by_name', 'file_name', 'file_size', 'remarks', 'file_data_url'] },
  { key: 'revisionResponses', name: 'cpms_revision_responses.csv', label: 'Revision Responses', headers: ['submission_id', 'version', 'position', 'response_id', 'instructor_comment', 'page_or_section', 'change_description'] },
  { key: 'annotations', name: 'cpms_annotations.csv', label: 'Document Annotations', headers: ['submission_id', 'position', 'annotation_id', 'version', 'page_number', 'x', 'y', 'width', 'height', 'comment', 'author_name', 'created_at'] },
  { key: 'gradeAssessments', name: 'cpms_grade_assessments.csv', label: 'Grade Rubric Scores', headers: ['submission_id', 'criterion_id', 'level_name', 'percentage', 'score', 'max_points'] },
  { key: 'gradeRubric', name: 'cpms_grade_frozen_rubric.csv', label: 'Graded Rubric Snapshots', headers: ['submission_id', 'position', 'criterion_id', 'name', 'description', 'max_points', 'levels'] },
  { key: 'accounts', name: 'cpms_accounts.csv', label: 'User Accounts', headers: ['id', 'username', 'first_name', 'last_name', 'role', 'academic_title', 'academic_rank', 'group_id', 'student_roles', 'must_change_password', 'avatar_url', 'position', 'password_hash'] },
  { key: 'defenseAttempts', name: 'cpms_defense_attempts.csv', label: 'Oral Defense Attempts', headers: ['id', 'group_id', 'attempt_number', 'previous_attempt_id', 'defense_date', 'defense_time', 'venue', 'panel_member_ids', 'lead_panel_id', 'created_at', 'status', 'position', 'has_report', 'report_lead_panel_id', 'report_lead_panel_name', 'report_degree_sought', 'report_venue_or_place', 'report_decision', 'report_conditions_or_remarks', 'report_updated_at', 'report_last_signatures_invalidated_at'] },
  { key: 'reportActions', name: 'cpms_report_actions.csv', label: 'Report Committee Actions', headers: ['attempt_id', 'panel_member_id', 'action', 'position'] },
  { key: 'reportSignatures', name: 'cpms_report_signatures.csv', label: 'Report Signatures', headers: ['attempt_id', 'panel_member_id', 'panel_member_name', 'signed_at', 'is_lead_panel', 'signature_data_url', 'position'] },
  { key: 'presentationEvaluations', name: 'cpms_presentation_evaluations.csv', label: 'Oral Presentation Evaluations', headers: ['attempt_id', 'panel_member_id', 'panel_member_name', 'evaluated_at', 'clarity_of_presentation', 'understanding_of_project', 'engagement_and_communication', 'use_of_visual_aids', 'handling_of_qa', 'team_collaboration', 'time_management', 'professionalism_and_confidence', 'total_group_score', 'average_group_score', 'comments'] },
  { key: 'presentationIndividualRatings', name: 'cpms_presentation_individual_ratings.csv', label: 'Presentation Individual Student Ratings', headers: ['attempt_id', 'panel_member_id', 'position', 'student_id', 'student_name', 'rate'] },
  { key: 'manuscriptEvaluations', name: 'cpms_manuscript_evaluations.csv', label: 'Manuscript Evaluations', headers: ['attempt_id', 'panel_member_id', 'panel_member_name', 'evaluated_at', 'total_score', 'average_score', 'overall_remarks', 'position'] },
  { key: 'manuscriptRatings', name: 'cpms_manuscript_ratings.csv', label: 'Manuscript Item Ratings', headers: ['attempt_id', 'panel_member_id', 'item_id', 'rate', 'comment', 'position'] },
];

export interface ImportedTableInfo {
  key: TableKey;
  name: string;
  label: string;
  rows: number;
}

export interface ImportParseResult {
  /** Only the tables found in the provided files are present. */
  data: Partial<AppDataset>;
  imported: ImportedTableInfo[];
  skipped: string[];
}

/**
 * Parse a set of CSV files and rebuild dataset structures.
 *
 * `base` supplies the current dataset so that a partial import (only some
 * files selected) keeps every table that was not provided, including the
 * child collections of a provided parent whose child file is missing.
 */
export function parseCsvFiles(files: { name: string; text: string }[], base: AppDataset): ImportParseResult {
  const found = new Map<TableKey, string[][]>();
  const imported: ImportedTableInfo[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    // The manifest is documentation for humans, not a data table.
    if (file.name === 'cpms_manifest.csv') continue;
    const rows = parseCsvText(file.text);
    if (rows.length === 0) {
      skipped.push(`${file.name} (empty file)`);
      continue;
    }
    const header = rows[0].map((cell) => cell.trim());
    const headerKey = header.join(',');
    const def = TABLE_DEFS.find((candidate) => candidate.headers.join(',') === headerKey);
    if (!def) {
      skipped.push(`${file.name} (unrecognised table)`);
      continue;
    }
    const body = rows.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''));
    found.set(def.key, body);
    imported.push({ key: def.key, name: file.name, label: def.label, rows: body.length });
  }

  const data = assembleDataset(found, base);
  return { data, imported, skipped };
}

function rowsOf(found: Map<TableKey, string[][]>, key: TableKey): string[][] | undefined {
  return found.get(key);
}

function assembleDataset(found: Map<TableKey, string[][]>, base: AppDataset): Partial<AppDataset> {
  const data: Partial<AppDataset> = {};

  /* ----- offices ----- */
  if (found.has('offices')) {
    const flat = (rowsOf(found, 'offices') || []).map((row) => ({
      id: row[0],
      code: row[1],
      name: row[2],
      parent: row[3],
      pos: numFrom(row[4]),
    }));
    const tops = positionSort(flat.filter((item) => !item.parent));
    const offices: Office[] = tops.map((item) => ({ id: item.id, code: item.code, name: item.name, subOffices: [] }));
    const byId = new Map(offices.map((office) => [office.id, office]));
    positionSort(flat.filter((item) => item.parent)).forEach((item) => {
      const parent = byId.get(item.parent);
      if (!parent) return;
      const sub: SubOffice = { id: item.id, officeId: item.parent, name: item.name, code: item.code };
      parent.subOffices.push(sub);
    });
    data.offices = offices;
  }

  /* ----- groups + members ----- */
  const groupRows = rowsOf(found, 'groups');
  const memberRows = rowsOf(found, 'groupMembers');
  if (groupRows || memberRows) {
    const groups: Group[] = groupRows
      ? positionSort(
          groupRows.map((row) => ({
            id: row[0],
            title: row[1],
            code: fromOptStr(row[2]),
            officeId: row[3],
            subOfficeId: row[4],
            clientNames: listSplit(row[5]),
            createdAt: row[6],
            members: [] as StudentMember[],
            pos: numFrom(row[7]),
          }))
        ).map(({ pos: _pos, ...group }) => group as Group)
      : base.groups.map((group) => ({ ...group }));

    let membersByGroup: Map<string, StudentMember[]> | null = null;
    if (memberRows) {
      membersByGroup = new Map<string, StudentMember[]>();
      const parsedMembers = memberRows.map((row) => ({
        groupId: row[0],
        pos: numFrom(row[8]),
        member: {
          id: row[1],
          firstName: row[2],
          lastName: row[3],
          username: row[4],
          roles: listSplit(row[5]) as StudentMember['roles'],
          passwordHash: fromOptStr(row[6]),
          mustChangePassword: boolOptFrom(row[7]),
        } as StudentMember,
      }));
      const groupIds = new Set(parsedMembers.map((entry) => entry.groupId));
      groupIds.forEach((groupId) => {
        const members = positionSort(parsedMembers.filter((entry) => entry.groupId === groupId)).map(
          (entry) => entry.member
        );
        membersByGroup!.set(groupId, members);
      });
    }

    data.groups = groups.map((group) => ({
      ...group,
      members: membersByGroup ? membersByGroup.get(group.id) || [] : group.members,
    }));
  }

  /* ----- deliverables + rubric ----- */
  const deliverableRows = rowsOf(found, 'deliverables');
  const rubricRows = rowsOf(found, 'rubricCriteria');
  if (deliverableRows || rubricRows) {
    const deliverables: Deliverable[] = deliverableRows
      ? positionSort(
          deliverableRows.map((row) => ({
            id: row[0],
            name: row[1],
            description: row[2],
            totalPossiblePoints: numFrom(row[3]),
            isArchived: boolOptFrom(row[4]),
            createdAt: row[5],
            rubric: [] as RubricCriterion[],
            pos: numFrom(row[6]),
          }))
        ).map(({ pos: _pos, ...deliverable }) => deliverable as Deliverable)
      : base.deliverables.map((deliverable) => ({ ...deliverable, rubric: [...deliverable.rubric] }));

    if (rubricRows) {
      const byDeliverable = new Map<string, { criterion: RubricCriterion; pos: number }[]>();
      rubricRows.forEach((row) => {
        const criterion: RubricCriterion = {
          id: row[1],
          name: row[3],
          description: row[4],
          maxPoints: numFrom(row[5]),
          levels: levelsFrom(row[6]),
        };
        const list = byDeliverable.get(row[0]) || [];
        list.push({ criterion, pos: numFrom(row[2]) });
        byDeliverable.set(row[0], list);
      });
      data.deliverables = deliverables.map((deliverable) => {
        const list = byDeliverable.get(deliverable.id);
        if (!list) return { ...deliverable, rubric: [] };
        return { ...deliverable, rubric: positionSort(list).map((entry) => entry.criterion) };
      });
    } else {
      data.deliverables = deliverables;
    }
  }

  /* ----- tasks ----- */
  if (found.has('tasks')) {
    const rows = rowsOf(found, 'tasks') || [];
    data.tasks = positionSort(
      rows.map((row) => ({
        id: row[0],
        deliverableId: row[1],
        name: row[2],
        instructions: row[3],
        deadline: row[4],
        maxScore: numFrom(row[5]),
        latePolicy: {
          type: row[6] as Task['latePolicy']['type'],
          deductionAmount: numFrom(row[7]),
          maxDeduction: numOptFrom(row[8]),
        },
        status: row[9] as Task['status'],
        isRevisionTask: boolOptFrom(row[10]),
        isArchived: boolOptFrom(row[11]),
        createdAt: row[12],
        pos: numFrom(row[13]),
      }))
    ).map(({ pos: _pos, ...task }) => task as Task);
  }

  /* ----- submissions (+ versions, responses, annotations, grade) ----- */
  const submissionRows = rowsOf(found, 'submissions');
  const versionRows = rowsOf(found, 'submissionVersions');
  const responseRows = rowsOf(found, 'revisionResponses');
  const annotationRows = rowsOf(found, 'annotations');
  const assessmentRows = rowsOf(found, 'gradeAssessments');
  const frozenRubricRows = rowsOf(found, 'gradeRubric');

  if (submissionRows || versionRows || responseRows || annotationRows || assessmentRows || frozenRubricRows) {
    const baseById = new Map(base.submissions.map((submission) => [submission.id, submission]));

    const submissions: GroupTaskSubmission[] = (submissionRows
      ? positionSort(
          submissionRows.map((row) => ({
            id: row[0],
            groupId: row[1],
            taskId: row[2],
            deliverableId: row[3],
            status: row[4] as GroupTaskSubmission['status'],
            currentVersion: numFrom(row[5]),
            submittedAt: fromOptStr(row[6]),
            hasGrade: boolFrom(row[7]),
            grade: {
              rubricRawScore: numFrom(row[8]),
              rubricMaxScore: numFrom(row[9]),
              taskRawScore: numFrom(row[10]),
              lateDeduction: numFrom(row[11]),
              daysLate: numFrom(row[12]),
              finalScore: numFrom(row[13]),
              overallRemarks: row[14],
              gradedAt: row[15],
              isReturned: boolOptFrom(row[16]) === true,
              returnedAt: fromOptStr(row[17]),
              lastEditedAt: fromOptStr(row[18]),
            },
            pos: numFrom(row[19]),
          }))
        ).map(({ pos: _pos, ...entry }) => entry)
      : base.submissions.map((submission) => ({
          id: submission.id,
          groupId: submission.groupId,
          taskId: submission.taskId,
          deliverableId: submission.deliverableId,
          status: submission.status,
          currentVersion: submission.currentVersion,
          submittedAt: submission.submittedAt,
          hasGrade: !!submission.grade,
          grade: submission.grade,
        }))
    ).map((entry) => {
      const existing = baseById.get(entry.id);
      const submission: GroupTaskSubmission = {
        id: entry.id,
        groupId: entry.groupId,
        taskId: entry.taskId,
        deliverableId: entry.deliverableId,
        status: entry.status,
        currentVersion: entry.currentVersion,
        versions: existing ? existing.versions : [],
        annotations: existing ? existing.annotations : [],
        submittedAt: entry.submittedAt,
      };
      if (submissionRows) {
        if (entry.hasGrade && 'grade' in entry && entry.grade && typeof entry.grade === 'object' && !('criterionAssessments' in (entry.grade as SubmissionGrade))) {
          const scalar = entry.grade as unknown as {
            rubricRawScore: number;
            rubricMaxScore: number;
            taskRawScore: number;
            lateDeduction: number;
            daysLate: number;
            finalScore: number;
            overallRemarks: string;
            gradedAt: string;
            isReturned: boolean;
            returnedAt?: string;
            lastEditedAt?: string;
          };
          submission.grade = {
            criterionAssessments: existing?.grade?.criterionAssessments || {},
            rubricRawScore: scalar.rubricRawScore,
            rubricMaxScore: scalar.rubricMaxScore,
            taskRawScore: scalar.taskRawScore,
            lateDeduction: scalar.lateDeduction,
            daysLate: scalar.daysLate,
            finalScore: scalar.finalScore,
            overallRemarks: scalar.overallRemarks,
            gradedAt: scalar.gradedAt,
            isReturned: scalar.isReturned,
            returnedAt: scalar.returnedAt,
            lastEditedAt: scalar.lastEditedAt,
            frozenRubric: existing?.grade?.frozenRubric || [],
          };
        } else if (!entry.hasGrade) {
          delete submission.grade;
        } else {
          submission.grade = existing?.grade;
        }
      } else {
        if (existing?.grade) submission.grade = existing.grade;
      }
      return submission;
    });

    const byId = new Map(submissions.map((submission) => [submission.id, submission]));

    if (versionRows) {
      const versionsBySubmission = new Map<string, { version: SubmissionVersion; pos: number }[]>();
      versionRows.forEach((row) => {
        const version: SubmissionVersion = {
          version: numFrom(row[2]),
          submittedAt: row[3],
          submittedByMemberId: row[4],
          submittedByName: row[5],
          fileName: row[6],
          fileSize: numFrom(row[7]),
          remarks: fromOptStr(row[8]),
          fileDataUrl: fromOptStr(row[9]),
        };
        const list = versionsBySubmission.get(row[0]) || [];
        list.push({ version, pos: numFrom(row[1]) });
        versionsBySubmission.set(row[0], list);
      });
      byId.forEach((submission) => {
        const list = versionsBySubmission.get(submission.id);
        submission.versions = list ? positionSort(list).map((entry) => entry.version) : [];
      });
    }

    if (responseRows) {
      const grouped = new Map<string, { response: RevisionResponse; pos: number; version: number }[]>();
      responseRows.forEach((row) => {
        const key = `${row[0]}::${row[1]}`;
        const list = grouped.get(key) || [];
        list.push({
          version: numFrom(row[1]),
          pos: numFrom(row[2]),
          response: { id: row[3], instructorComment: row[4], pageOrSection: row[5], changeDescription: row[6] },
        } as { response: RevisionResponse; pos: number; version: number });
        grouped.set(key, list);
      });
      byId.forEach((submission) => {
        submission.versions = submission.versions.map((version) => {
          const list = grouped.get(`${submission.id}::${version.version}`);
          if (!list) return { ...version, revisionResponses: undefined };
          return { ...version, revisionResponses: positionSort(list).map((entry) => entry.response) };
        });
      });
    }

    if (annotationRows) {
      const grouped = new Map<string, { annotation: DocumentAnnotation; pos: number }[]>();
      annotationRows.forEach((row) => {
        const list = grouped.get(row[0]) || [];
        list.push({
          pos: numFrom(row[1]),
          annotation: {
            submissionId: row[0],
            id: row[2],
            version: numFrom(row[3]),
            pageNumber: numFrom(row[4]),
            x: numFrom(row[5]),
            y: numFrom(row[6]),
            width: numOptFrom(row[7]),
            height: numOptFrom(row[8]),
            comment: row[9],
            authorName: row[10],
            createdAt: row[11],
          },
        });
        grouped.set(row[0], list);
      });
      byId.forEach((submission) => {
        const list = grouped.get(submission.id);
        submission.annotations = list ? positionSort(list).map((entry) => entry.annotation) : [];
      });
    }

    if (assessmentRows) {
      const grouped = new Map<string, CriterionAssessment[]>();
      assessmentRows.forEach((row) => {
        const assessment: CriterionAssessment = {
          criterionId: row[1],
          levelName: row[2],
          percentage: numFrom(row[3]),
          score: numFrom(row[4]),
          maxPoints: numFrom(row[5]),
        };
        grouped.set(row[0], [...(grouped.get(row[0]) || []), assessment]);
      });
      byId.forEach((submission) => {
        if (!submission.grade) return;
        const list = grouped.get(submission.id) || [];
        const map: Record<string, CriterionAssessment> = {};
        list.forEach((assessment) => {
          map[assessment.criterionId] = assessment;
        });
        submission.grade.criterionAssessments = map;
      });
    }

    if (frozenRubricRows) {
      const grouped = new Map<string, { criterion: RubricCriterion; pos: number }[]>();
      frozenRubricRows.forEach((row) => {
        const list = grouped.get(row[0]) || [];
        list.push({
          pos: numFrom(row[1]),
          criterion: {
            id: row[2],
            name: row[3],
            description: row[4],
            maxPoints: numFrom(row[5]),
            levels: levelsFrom(row[6]),
          },
        });
        grouped.set(row[0], list);
      });
      byId.forEach((submission) => {
        if (!submission.grade) return;
        const list = grouped.get(submission.id);
        submission.grade.frozenRubric = list ? positionSort(list).map((entry) => entry.criterion) : [];
      });
    }

    data.submissions = submissions;
  }

  /* ----- accounts ----- */
  if (found.has('accounts')) {
    const rows = rowsOf(found, 'accounts') || [];
    data.accounts = positionSort(
      rows.map((row) => ({
        id: row[0],
        username: row[1],
        firstName: row[2],
        lastName: row[3],
        role: row[4] as UserAccount['role'],
        academicTitle: fromOptStr(row[5]),
        academicRank: fromOptStr(row[6]),
        groupId: fromOptStr(row[7]),
        studentRoles: row[8] === '' ? undefined : (listSplit(row[8]) as UserAccount['studentRoles']),
        mustChangePassword: boolOptFrom(row[9]),
        avatarUrl: fromOptStr(row[10]),
        passwordHash: fromOptStr(row[12] || ''),
        pos: numFrom(row[11]),
      }))
    ).map(({ pos: _pos, ...account }) => account as UserAccount);
  }

  /* ----- defense attempts + report + evaluations ----- */
  const attemptRows = rowsOf(found, 'defenseAttempts');
  const actionRows = rowsOf(found, 'reportActions');
  const signatureRows = rowsOf(found, 'reportSignatures');
  const presRows = rowsOf(found, 'presentationEvaluations');
  const presIndividualRows = rowsOf(found, 'presentationIndividualRatings');
  const manuRows = rowsOf(found, 'manuscriptEvaluations');
  const manuRatingRows = rowsOf(found, 'manuscriptRatings');

  if (
    attemptRows ||
    actionRows ||
    signatureRows ||
    presRows ||
    presIndividualRows ||
    manuRows ||
    manuRatingRows
  ) {
    const baseById = new Map(base.defenseAttempts.map((attempt) => [attempt.id, attempt]));

    interface AttemptEntry {
      id: string;
      groupId: string;
      attemptNumber: number;
      previousAttemptId?: string;
      defenseDate: string;
      defenseTime: string;
      venue: string;
      panelMemberIds: string[];
      leadPanelId: string;
      createdAt: string;
      status: DefenseAttempt['status'];
      hasReport: boolean;
      reportLeadPanelId?: string;
      reportLeadPanelName?: string;
      reportDegreeSought?: string;
      reportVenueOrPlace?: string;
      reportDecision?: string;
      reportConditionsOrRemarks?: string;
      reportUpdatedAt?: string;
      reportLastSignaturesInvalidatedAt?: string;
    }

    const entries: AttemptEntry[] = attemptRows
      ? positionSort(
          attemptRows.map((row) => ({
            id: row[0],
            groupId: row[1],
            attemptNumber: numFrom(row[2]),
            previousAttemptId: fromOptStr(row[3]),
            defenseDate: row[4],
            defenseTime: row[5],
            venue: row[6],
            panelMemberIds: listSplit(row[7]),
            leadPanelId: row[8],
            createdAt: row[9],
            status: row[10] as DefenseAttempt['status'],
            pos: numFrom(row[11]),
            hasReport: boolFrom(row[12]),
            reportLeadPanelId: row[13],
            reportLeadPanelName: row[14],
            reportDegreeSought: row[15],
            reportVenueOrPlace: row[16],
            reportDecision: row[17],
            reportConditionsOrRemarks: row[18],
            reportUpdatedAt: row[19],
            reportLastSignaturesInvalidatedAt: fromOptStr(row[20]),
          }))
        ).map(({ pos: _pos, ...entry }) => entry)
      : base.defenseAttempts.map((attempt) => ({
          id: attempt.id,
          groupId: attempt.groupId,
          attemptNumber: attempt.attemptNumber,
          previousAttemptId: attempt.previousAttemptId,
          defenseDate: attempt.defenseDate,
          defenseTime: attempt.defenseTime,
          venue: attempt.venue,
          panelMemberIds: attempt.panelMemberIds,
          leadPanelId: attempt.leadPanelId,
          createdAt: attempt.createdAt,
          status: attempt.status,
          hasReport: !!attempt.report,
        }));

    const attempts: DefenseAttempt[] = entries.map((entry) => {
      const existing = baseById.get(entry.id);
      const attempt: DefenseAttempt = {
        id: entry.id,
        groupId: entry.groupId,
        attemptNumber: entry.attemptNumber,
        previousAttemptId: entry.previousAttemptId,
        defenseDate: entry.defenseDate,
        defenseTime: entry.defenseTime,
        venue: entry.venue,
        panelMemberIds: entry.panelMemberIds,
        leadPanelId: entry.leadPanelId,
        createdAt: entry.createdAt,
        status: entry.status,
        presentationEvaluations: existing ? existing.presentationEvaluations : {},
        manuscriptEvaluations: existing ? existing.manuscriptEvaluations : {},
      };
      if (attemptRows && entry.hasReport) {
        const report: DefenseReportProposal = {
          leadPanelId: entry.reportLeadPanelId || '',
          leadPanelName: entry.reportLeadPanelName || '',
          degreeSought: entry.reportDegreeSought || '',
          venueOrPlace: entry.reportVenueOrPlace || '',
          committeeActions: existing?.report?.committeeActions || {},
          decision: (entry.reportDecision || '') as DefenseReportProposal['decision'],
          conditionsOrRemarks: entry.reportConditionsOrRemarks || '',
          updatedAt: entry.reportUpdatedAt || '',
          signatures: existing?.report?.signatures || [],
          lastSignaturesInvalidatedAt: entry.reportLastSignaturesInvalidatedAt,
        };
        attempt.report = report;
      } else if (attemptRows) {
        delete attempt.report;
      } else if (existing?.report) {
        attempt.report = existing.report;
      }
      if (!attemptRows && existing) {
        attempt.presentationEvaluations = existing.presentationEvaluations;
        attempt.manuscriptEvaluations = existing.manuscriptEvaluations;
      }
      return attempt;
    });

    const byId = new Map(attempts.map((attempt) => [attempt.id, attempt]));

    if (actionRows && (attemptRows || actionRows)) {
      const grouped = new Map<string, { panelId: string; action: CommitteeAction; pos: number }[]>();
      actionRows.forEach((row) => {
        const list = grouped.get(row[0]) || [];
        list.push({ panelId: row[1], action: row[2] as CommitteeAction, pos: numFrom(row[3]) });
        grouped.set(row[0], list);
      });
      byId.forEach((attempt) => {
        if (!attempt.report) return;
        const list = grouped.get(attempt.id) || [];
        const actions: Record<string, CommitteeAction> = {};
        positionSort(list).forEach((entry) => {
          actions[entry.panelId] = entry.action;
        });
        attempt.report.committeeActions = actions;
      });
    }

    if (signatureRows) {
      const grouped = new Map<string, { signature: DefenseSignature; pos: number }[]>();
      signatureRows.forEach((row) => {
        const list = grouped.get(row[0]) || [];
        list.push({
          pos: numFrom(row[6]),
          signature: {
            panelMemberId: row[1],
            panelMemberName: row[2],
            signedAt: row[3],
            isLeadPanel: boolFrom(row[4]),
            signatureDataUrl: fromOptStr(row[5]),
          },
        });
        grouped.set(row[0], list);
      });
      byId.forEach((attempt) => {
        if (!attempt.report) return;
        const list = grouped.get(attempt.id);
        attempt.report.signatures = list ? positionSort(list).map((entry) => entry.signature) : [];
      });
    }

    if (presRows || presIndividualRows) {
      const individualByAttemptPanel = new Map<string, { rating: PresentationIndividualRating; pos: number }[]>();
      (presIndividualRows || []).forEach((row) => {
        const key = `${row[0]}::${row[1]}`;
        const list = individualByAttemptPanel.get(key) || [];
        list.push({ pos: numFrom(row[2]), rating: { studentId: row[3], studentName: row[4], rate: numFrom(row[5]) } });
        individualByAttemptPanel.set(key, list);
      });

      const evaluationsByAttempt = new Map<string, PresentationEvaluation[]>();
      (presRows || []).forEach((row) => {
        const attemptId = row[0];
        const panelId = row[1];
        const evaluation: PresentationEvaluation = {
          panelMemberId: panelId,
          panelMemberName: row[2],
          evaluatedAt: row[3],
          groupRating: {
            clarityOfPresentation: numFrom(row[4]),
            understandingOfProject: numFrom(row[5]),
            engagementAndCommunication: numFrom(row[6]),
            useOfVisualAids: numFrom(row[7]),
            handlingOfQA: numFrom(row[8]),
            teamCollaboration: numFrom(row[9]),
            timeManagement: numFrom(row[10]),
            professionalismAndConfidence: numFrom(row[11]),
          },
          totalGroupScore: numFrom(row[12]),
          averageGroupScore: numFrom(row[13]),
          comments: fromOptStr(row[14]),
          individualRatings: positionSort(individualByAttemptPanel.get(`${attemptId}::${panelId}`) || []).map(
            (entry) => entry.rating
          ),
        };
        evaluationsByAttempt.set(attemptId, [...(evaluationsByAttempt.get(attemptId) || []), evaluation]);
      });

      byId.forEach((attempt) => {
        if (!presRows) return;
        const list = evaluationsByAttempt.get(attempt.id) || [];
        const map: Record<string, PresentationEvaluation> = {};
        list.forEach((evaluation) => {
          map[evaluation.panelMemberId] = evaluation;
        });
        attempt.presentationEvaluations = map;
      });
    }

    if (manuRows || manuRatingRows) {
      const ratingsByAttemptPanel = new Map<string, ManuscriptItemRating[]>();
      (manuRatingRows || []).forEach((row) => {
        const key = `${row[0]}::${row[1]}`;
        ratingsByAttemptPanel.set(key, [
          ...(ratingsByAttemptPanel.get(key) || []),
          { itemId: row[2], rate: numFrom(row[3]), comment: fromOptStr(row[4]) },
        ]);
      });

      const evaluationsByAttempt = new Map<string, ManuscriptEvaluation[]>();
      (manuRows || []).forEach((row) => {
        const attemptId = row[0];
        const panelId = row[1];
        const evaluation: ManuscriptEvaluation = {
          panelMemberId: panelId,
          panelMemberName: row[2],
          evaluatedAt: row[3],
          totalScore: numFrom(row[4]),
          averageScore: numFrom(row[5]),
          overallRemarks: fromOptStr(row[6]),
          ratings: {},
        };
        (ratingsByAttemptPanel.get(`${attemptId}::${panelId}`) || []).forEach((rating) => {
          evaluation.ratings[rating.itemId] = rating;
        });
        evaluationsByAttempt.set(attemptId, [...(evaluationsByAttempt.get(attemptId) || []), evaluation]);
      });

      byId.forEach((attempt) => {
        if (!manuRows) return;
        const list = evaluationsByAttempt.get(attempt.id) || [];
        const map: Record<string, ManuscriptEvaluation> = {};
        list.forEach((evaluation) => {
          map[evaluation.panelMemberId] = evaluation;
        });
        attempt.manuscriptEvaluations = map;
      });
    }

    data.defenseAttempts = attempts;
  }

  return data;
}
