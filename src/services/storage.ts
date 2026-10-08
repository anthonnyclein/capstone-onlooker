import {
  Office,
  Group,
  Deliverable,
  Task,
  GroupTaskSubmission,
  UserAccount,
  StudentMember,
  SubmissionVersion,
  SubmissionGrade,
  DocumentAnnotation,
  DefenseAttempt,
  PresentationEvaluation,
  ManuscriptEvaluation,
  DefenseReportProposal,
  DefenseSignature,
} from '../types';
import { fileStore, subscribeDataChanges, flushFileStore } from './fileStore';
import { authService } from './authService';
import { generateInitialsAvatarSvg } from '../utils/avatar';
import { normalizeUsername } from '../utils/credentials';
import {
  exportDataset,
  parseCsvFiles,
  AppDataset,
  CsvTableFile,
  ImportParseResult,
} from './portableData';

const STORAGE_KEYS = {
  OFFICES: 'cpms_offices_v1',
  GROUPS: 'cpms_groups_v1',
  DELIVERABLES: 'cpms_deliverables_v1',
  TASKS: 'cpms_tasks_v1',
  SUBMISSIONS: 'cpms_submissions_v1',
  ACCOUNTS: 'cpms_accounts_v1',
  CURRENT_USER: 'cpms_current_user_v1',
  INITIALIZED: 'cpms_initialized_v1',
  DEFENSE_ATTEMPTS: 'cpms_defense_attempts_v2',
};

export async function saveFileBlob(key: string, dataUrl: string, fileName: string): Promise<void> {
  const response = await fetch('/api/files/' + encodeURIComponent(key), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl, fileName }) });
  if (!response.ok) throw new Error((await response.json()).error || 'Document could not be saved');
}
export async function getFileBlob(key: string): Promise<{ dataUrl: string; fileName: string } | null> {
  const response = await fetch('/api/files/' + encodeURIComponent(key));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Document could not be loaded');
  return response.json();
}

class StorageService {
  private listeners: (() => void)[] = [];

  constructor() {
    subscribeDataChanges(() => {
      this.notify();
    });
  }



  public subscribe(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  // Current User / Session
  public getCurrentUser(): UserAccount | null {
    const raw = sessionStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!raw) return null;
    try {
      return this.getAccounts().find(account => account.id === JSON.parse(raw).id) || null;
    } catch {
      return null;
    }
  }

  public setCurrentUser(user: UserAccount | null): void {
    if (user) {
      sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify({ id: user.id }));
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
    this.notify();
  }

  public getAccounts(): UserAccount[] {
    const raw = fileStore.getItem(STORAGE_KEYS.ACCOUNTS);
    let accounts: UserAccount[];
    if (!raw) {
      accounts = [];
    } else {
      try {
        accounts = JSON.parse(raw);
      } catch {
        accounts = [];
      }
    }

    // Automatically ensure coordinator usernames conform to firstname.lastname
    // and panel accounts use first letters initials avatar instead of stock photos
    let updated = false;
    accounts = accounts.map((acc) => {
      let current = acc;
      if (current.role === 'instructor') {
        const canonical = normalizeUsername(current.firstName, current.lastName);
        if (canonical && current.username !== canonical) {
          current = { ...current, username: canonical };
          updated = true;
        }
      }
      if (current.role === 'panel' && (!current.avatarUrl || current.avatarUrl.includes('unsplash.com'))) {
        current = {
          ...current,
          avatarUrl: generateInitialsAvatarSvg(current.firstName, current.lastName),
        };
        updated = true;
      }
      return current;
    });

    if (updated && raw) {
      fileStore.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    }

    return accounts;
  }

  public saveAccounts(accounts: UserAccount[]): void {
    fileStore.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    this.notify();
  }

  public addAccount(account: UserAccount): void {
    const accounts = this.getAccounts();
    const existingIdx = accounts.findIndex(
      a => a.id === account.id || a.username.toLowerCase() === account.username.toLowerCase()
    );
    if (existingIdx !== -1) {
      accounts[existingIdx] = { ...accounts[existingIdx], ...account };
    } else {
      accounts.push(account);
    }
    this.saveAccounts(accounts);
  }

  public deleteAccount(accountId: string): void {
    const accounts = this.getAccounts().filter(a => a.id !== accountId);
    this.saveAccounts(accounts);
  }

  public updateAccount(updated: Partial<UserAccount> & { id: string }): void {
    const accounts = this.getAccounts();
    const index = accounts.findIndex(
      a => a.id === updated.id || (updated.username && a.username.toLowerCase() === updated.username.toLowerCase())
    );
    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...updated };
    } else {
      accounts.push(updated as UserAccount);
    }
    this.saveAccounts(accounts);

    // Also sync the member inside groups if this is a student account
    const groups = this.getGroups();
    let groupsChanged = false;
    for (const grp of groups) {
      for (let i = 0; i < grp.members.length; i++) {
        if (grp.members[i].id === updated.id || (updated.username && grp.members[i].username.toLowerCase() === updated.username.toLowerCase())) {
          grp.members[i] = {
            ...grp.members[i],
            mustChangePassword: updated.mustChangePassword !== undefined ? updated.mustChangePassword : grp.members[i].mustChangePassword,
            passwordHash: updated.passwordHash || grp.members[i].passwordHash,
          };
          groupsChanged = true;
        }
      }
    }
    if (groupsChanged) {
      fileStore.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    }

    const cur = this.getCurrentUser();
    if (cur && (cur.id === updated.id || (updated.username && cur.username.toLowerCase() === updated.username.toLowerCase()))) {
      this.setCurrentUser({ ...cur, ...updated });
    }
  }

  // Offices
  public getOffices(): Office[] {
    const raw = fileStore.getItem(STORAGE_KEYS.OFFICES);
    return raw ? JSON.parse(raw) : [];
  }

  public saveOffices(offices: Office[]): void {
    fileStore.setItem(STORAGE_KEYS.OFFICES, JSON.stringify(offices));
    this.notify();
  }

  // Groups
  public getGroups(): Group[] {
    const raw = fileStore.getItem(STORAGE_KEYS.GROUPS);
    return raw ? JSON.parse(raw) : [];
  }

  public saveGroups(groups: Group[]): void {
    fileStore.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    this.syncStudentAccountsWithGroups(groups);
    this.notify();
  }

  // Sync student accounts whenever groups change
  private syncStudentAccountsWithGroups(groups: Group[]): void {
    const existingAccounts = this.getAccounts();
    const nonStudentAccounts = existingAccounts.filter(a => a.role === 'instructor' || a.role === 'panel');
    const studentAccounts: UserAccount[] = [];

    for (const grp of groups) {
      for (const mem of grp.members) {
        const existing = existingAccounts.find(a => a.id === mem.id || a.username === mem.username);
        studentAccounts.push({
          id: mem.id,
          username: mem.username,
          firstName: mem.firstName,
          lastName: mem.lastName,
          role: 'student',
          groupId: grp.id,
          studentRoles: mem.roles,
          mustChangePassword: existing?.mustChangePassword ?? mem.mustChangePassword ?? true,
          passwordHash: existing?.passwordHash,
          avatarUrl: existing?.avatarUrl,
        });
      }
    }

    this.saveAccounts([...nonStudentAccounts, ...studentAccounts]);
  }

  // Deliverables
  public getDeliverables(): Deliverable[] {
    const raw = fileStore.getItem(STORAGE_KEYS.DELIVERABLES);
    return raw ? JSON.parse(raw) : [];
  }

  public saveDeliverables(deliverables: Deliverable[]): void {
    fileStore.setItem(STORAGE_KEYS.DELIVERABLES, JSON.stringify(deliverables));
    this.notify();
  }

  // Tasks
  public getTasks(): Task[] {
    const raw = fileStore.getItem(STORAGE_KEYS.TASKS);
    return raw ? JSON.parse(raw) : [];
  }

  public saveTasks(tasks: Task[]): void {
    fileStore.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    this.notify();
  }

  public async deleteTask(taskId: string): Promise<void> {
    const tasks = this.getTasks().filter(t => t.id !== taskId);
    this.saveTasks(tasks);
    const submissions = this.getSubmissions().filter(s => s.taskId !== taskId);
    this.saveSubmissions(submissions);

    try {
      await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
        headers: { ...authService.getAuthHeaders() },
      });
    } catch (err) {
      console.warn('API task deletion error:', err);
    }
    await flushFileStore();
  }

  // Submissions
  public getSubmissions(): GroupTaskSubmission[] {
    const raw = fileStore.getItem(STORAGE_KEYS.SUBMISSIONS);
    return raw ? JSON.parse(raw) : [];
  }

  public saveSubmissions(submissions: GroupTaskSubmission[]): void {
    fileStore.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
    this.notify();
  }

  public getSubmissionForGroupTask(groupId: string, taskId: string): GroupTaskSubmission | undefined {
    return this.getSubmissions().find(s => s.groupId === groupId && s.taskId === taskId);
  }

  public saveOrUpdateSubmission(submission: GroupTaskSubmission): void {
    const all = this.getSubmissions();
    const idx = all.findIndex(s => s.id === submission.id);
    if (idx !== -1) {
      all[idx] = submission;
    } else {
      all.push(submission);
    }
    this.saveSubmissions(all);
  }

  public deleteSubmission(submissionId: string): void {
    const submissions = this.getSubmissions().filter(s => s.id !== submissionId);
    this.saveSubmissions(submissions);
  }

  public unsubmitSubmission(submissionId: string): void {
    const submissions = this.getSubmissions();
    const sub = submissions.find(s => s.id === submissionId);
    if (sub) {
      sub.status = 'not_submitted';
      sub.grade = undefined;
      sub.versions = [];
      sub.currentVersion = 0;
      sub.submittedAt = undefined;
      this.saveSubmissions(submissions);
    }
  }

  // Helper to add or update annotations
  public saveAnnotation(submissionId: string, annotation: DocumentAnnotation): void {
    const submissions = this.getSubmissions();
    const sub = submissions.find(s => s.id === submissionId);
    if (sub) {
      const existingIdx = sub.annotations.findIndex(a => a.id === annotation.id);
      if (existingIdx !== -1) {
        sub.annotations[existingIdx] = annotation;
      } else {
        sub.annotations.push(annotation);
      }
      this.saveSubmissions(submissions);
    }
  }

  public deleteAnnotation(submissionId: string, annotationId: string): void {
    const submissions = this.getSubmissions();
    const sub = submissions.find(s => s.id === submissionId);
    if (sub) {
      sub.annotations = sub.annotations.filter(a => a.id !== annotationId);
      this.saveSubmissions(submissions);
    }
  }

  // Helper to save grading (Save Draft or Return to Group)
  public saveGrading(submissionId: string, grade: SubmissionGrade, returnToGroup: boolean): void {
    const submissions = this.getSubmissions();
    const sub = submissions.find(s => s.id === submissionId);
    if (sub) {
      grade.isReturned = returnToGroup;
      if (returnToGroup && !grade.returnedAt) {
        grade.returnedAt = new Date().toISOString();
      }
      grade.lastEditedAt = new Date().toISOString();

      sub.grade = grade;
      sub.status = returnToGroup ? 'returned' : 'graded_awaiting_return';
      this.saveSubmissions(submissions);
    }
  }

  // ==========================================
  // Defense Attempts, Evaluations & Reporting
  // ==========================================

  public getDefenseAttempts(): DefenseAttempt[] {
    const raw = fileStore.getItem(STORAGE_KEYS.DEFENSE_ATTEMPTS);
    return raw ? JSON.parse(raw) : [];
  }

  public saveDefenseAttempts(attempts: DefenseAttempt[]): void {
    fileStore.setItem(STORAGE_KEYS.DEFENSE_ATTEMPTS, JSON.stringify(attempts));
    this.notify();
  }

  public getDefenseAttemptById(attemptId: string): DefenseAttempt | undefined {
    return this.getDefenseAttempts().find(a => a.id === attemptId);
  }

  public getDefenseAttemptsForGroup(groupId: string): DefenseAttempt[] {
    return this.getDefenseAttempts()
      .filter(a => a.groupId === groupId)
      .sort((a, b) => a.attemptNumber - b.attemptNumber);
  }

  public getLatestDefenseAttemptForGroup(groupId: string): DefenseAttempt | undefined {
    const groupAttempts = this.getDefenseAttemptsForGroup(groupId);
    return groupAttempts[groupAttempts.length - 1];
  }

  public hasAnyEvaluations(attempt: DefenseAttempt): boolean {
    const presCount = Object.keys(attempt.presentationEvaluations || {}).length;
    const manuCount = Object.keys(attempt.manuscriptEvaluations || {}).length;
    return presCount > 0 || manuCount > 0;
  }

  public saveDefenseAttempt(attempt: DefenseAttempt): void {
    const all = this.getDefenseAttempts();
    const idx = all.findIndex(a => a.id === attempt.id);
    if (idx !== -1) {
      all[idx] = attempt;
    } else {
      all.push(attempt);
    }
    this.saveDefenseAttempts(all);
  }

  public async deleteDefenseAttempt(attemptId: string): Promise<void> {
    const all = this.getDefenseAttempts().filter(a => a.id !== attemptId);
    this.saveDefenseAttempts(all);
    try {
      await fetch(`/api/defense-attempts/${encodeURIComponent(attemptId)}`, {
        method: 'DELETE',
        headers: { ...authService.getAuthHeaders() },
      });
    } catch (err) {
      console.warn('API defense attempt deletion error:', err);
    }
    await flushFileStore();
  }

  public async resetDefenseAttempt(attemptId: string): Promise<void> {
    return this.deleteDefenseAttempt(attemptId);
  }

  public savePresentationEvaluation(attemptId: string, evaluation: PresentationEvaluation): void {
    const all = this.getDefenseAttempts();
    const attempt = all.find(a => a.id === attemptId);
    if (attempt) {
      if (!attempt.presentationEvaluations) {
        attempt.presentationEvaluations = {};
      }
      attempt.presentationEvaluations[evaluation.panelMemberId] = evaluation;
      if (attempt.status === 'scheduled') {
        attempt.status = 'evaluating';
      }
      this.saveDefenseAttempts(all);
    }
  }

  public saveManuscriptEvaluation(attemptId: string, evaluation: ManuscriptEvaluation): void {
    const all = this.getDefenseAttempts();
    const attempt = all.find(a => a.id === attemptId);
    if (attempt) {
      if (!attempt.manuscriptEvaluations) {
        attempt.manuscriptEvaluations = {};
      }
      attempt.manuscriptEvaluations[evaluation.panelMemberId] = evaluation;
      if (attempt.status === 'scheduled') {
        attempt.status = 'evaluating';
      }
      this.saveDefenseAttempts(all);
    }
  }

  public saveDefenseReport(attemptId: string, report: DefenseReportProposal, shouldInvalidateSignatures: boolean = false): void {
    const all = this.getDefenseAttempts();
    const attempt = all.find(a => a.id === attemptId);
    if (attempt) {
      if (shouldInvalidateSignatures && report.signatures && report.signatures.length > 0) {
        report.signatures = [];
        report.lastSignaturesInvalidatedAt = new Date().toISOString();
      }
      attempt.report = report;
      if (report.decision) {
        attempt.status = 'completed';
      }
      this.saveDefenseAttempts(all);
    }
  }

  public signDefenseReport(attemptId: string, signature: DefenseSignature): void {
    const all = this.getDefenseAttempts();
    const attempt = all.find(a => a.id === attemptId);
    if (attempt && attempt.report) {
      const existingSignatures = attempt.report.signatures || [];
      const filtered = existingSignatures.filter(s => s.panelMemberId !== signature.panelMemberId);
      filtered.push(signature);
      attempt.report.signatures = filtered;
      this.saveDefenseAttempts(all);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Portable text-file (CSV) storage                                  */
  /* ---------------------------------------------------------------- */

  /** Snapshot of every table as it is currently stored. */
  public getCurrentDataset(): AppDataset {
    return {
      offices: this.getOffices(),
      groups: this.getGroups(),
      deliverables: this.getDeliverables(),
      tasks: this.getTasks(),
      submissions: this.getSubmissions(),
      accounts: this.getAccounts(),
      defenseAttempts: this.getDefenseAttempts(),
    };
  }

  /** Serialize the whole dataset into spreadsheet-ready CSV files. */
  public exportAllAsCsv(): CsvTableFile[] {
    return exportDataset(this.getCurrentDataset());
  }

  /** Parse selected CSV files against the current data (no writes yet). */
  public parseImportFiles(files: { name: string; text: string }[]): ImportParseResult {
    return parseCsvFiles(files, this.getCurrentDataset());
  }

  /**
   * Write previously parsed tables into storage. Only the tables present in
   * the import are replaced; everything else is left untouched. Notifies
   * subscribers exactly once so the UI (and auto-save) refresh together.
   */
  public applyImportResult(result: ImportParseResult): string[] {
    const { data } = result;
    const applied: string[] = [];
    const write = (key: string, value: unknown, label: string) => {
      fileStore.setItem(key, JSON.stringify(value));
      applied.push(label);
    };

    if (data.offices) write(STORAGE_KEYS.OFFICES, data.offices, 'Offices');
    if (data.groups) {
      write(STORAGE_KEYS.GROUPS, data.groups, 'Groups');
      if (!data.accounts) this.syncStudentAccountsWithGroups(data.groups);
    }
    if (data.deliverables) write(STORAGE_KEYS.DELIVERABLES, data.deliverables, 'Deliverables');
    if (data.tasks) write(STORAGE_KEYS.TASKS, data.tasks, 'Tasks');
    if (data.submissions) write(STORAGE_KEYS.SUBMISSIONS, data.submissions, 'Submissions');
    if (data.accounts) write(STORAGE_KEYS.ACCOUNTS, data.accounts, 'Accounts');
    if (data.defenseAttempts) write(STORAGE_KEYS.DEFENSE_ATTEMPTS, data.defenseAttempts, 'Defense attempts');

    if (applied.length === 0) return applied;

    fileStore.setItem(STORAGE_KEYS.INITIALIZED, 'true');

    // End the session gracefully if the imported accounts no longer include it.
    const current = this.getCurrentUser();
    if (data.accounts && current && !data.accounts.some(account => account.id === current.id)) {
      sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }

    this.notify();
    return applied;
  }

  /** Convenience wrapper: parse + apply in one step. */
  public importCsvFiles(files: { name: string; text: string }[]): ImportParseResult {
    const result = this.parseImportFiles(files);
    if (result.imported.length > 0) {
      this.applyImportResult(result);
    }
    return result;
  }
}

export const storage = new StorageService();
