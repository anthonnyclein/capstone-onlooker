import { Router } from 'express';
import { dbRepository } from '../dbRepository';
import { encodeState, decodeState } from '../csvStore';
import { optionalJwt, authenticateJwt, requireRole, AuthenticatedRequest } from '../jwt';
import type { UserAccount } from '../../src/types';

const router = Router();

/**
 * GET /api/state
 * Returns full state with revision from PostgreSQL 3NF tables.
 */
router.get('/state', async (_req, res) => {
  try {
    const revision = await dbRepository.getStateRevision();
    const [offices, groups, deliverables, tasks, submissions, accounts, defenseAttempts] = await Promise.all([
      dbRepository.getAllOffices(),
      dbRepository.getAllGroups(),
      dbRepository.getAllDeliverables(),
      dbRepository.getAllTasks(),
      dbRepository.getAllSubmissions(),
      dbRepository.getAllUsers(),
      dbRepository.getAllDefenseAttempts(),
    ]);

    const values: Record<string, string> = {
      cpms_offices_v1: JSON.stringify(offices),
      cpms_groups_v1: JSON.stringify(groups),
      cpms_deliverables_v1: JSON.stringify(deliverables),
      cpms_tasks_v1: JSON.stringify(tasks),
      cpms_submissions_v1: JSON.stringify(submissions),
      cpms_accounts_v1: JSON.stringify(accounts),
      cpms_defense_attempts_v2: JSON.stringify(defenseAttempts),
    };

    res.json({ revision, values });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch application state' });
  }
});

/**
 * GET /api/state/revision
 * Ultra-fast query checking only the database revision for client synchronization.
 */
router.get('/state/revision', async (_req, res) => {
  try {
    const revision = await dbRepository.getStateRevision();
    res.json({ revision });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to check revision' });
  }
});

/**
 * PUT /api/state
 * Transactionally updates full state into PostgreSQL 3NF normalized tables.
 */
router.put('/state', optionalJwt, async (req: AuthenticatedRequest, res) => {
  try {
    const { values, revision } = req.body;
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      res.status(400).json({ error: 'Invalid storage values payload.' });
      return;
    }

    const parsed: Record<string, any> = {};
    for (const [key, val] of Object.entries(values)) {
      if (!/^cpms_[a-z_0-9]+$/.test(key) || typeof val !== 'string') {
        res.status(400).json({ error: `Invalid storage key: ${key}` });
        return;
      }
      parsed[key] = JSON.parse(val as string);
    }

    const nextRevision = await dbRepository.saveFullDataset({
      offices: parsed['cpms_offices_v1'] || [],
      groups: parsed['cpms_groups_v1'] || [],
      deliverables: parsed['cpms_deliverables_v1'] || [],
      tasks: parsed['cpms_tasks_v1'] || [],
      submissions: parsed['cpms_submissions_v1'] || [],
      accounts: parsed['cpms_accounts_v1'] || [],
      defenseAttempts: parsed['cpms_defense_attempts_v2'] || [],
    }, typeof revision === 'number' ? revision : undefined);

    res.json({ revision: nextRevision });
  } catch (err: any) {
    res.status(409).json({ error: err.message || 'Storage update conflict' });
  }
});

/**
 * Entity REST endpoints
 */
router.get('/offices', async (_req, res) => {
  try {
    res.json(await dbRepository.getAllOffices());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/groups', async (_req, res) => {
  try {
    res.json(await dbRepository.getAllGroups());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/deliverables', async (_req, res) => {
  try {
    res.json(await dbRepository.getAllDeliverables());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tasks', async (_req, res) => {
  try {
    res.json(await dbRepository.getAllTasks());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tasks/:id', optionalJwt, async (req, res) => {
  try {
    const { id } = req.params;
    const revision = await dbRepository.deleteTaskById(id);
    res.json({ success: true, revision });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete task from database' });
  }
});

router.get('/submissions', async (_req, res) => {
  try {
    res.json(await dbRepository.getAllSubmissions());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/accounts', async (_req, res) => {
  try {
    res.json(await dbRepository.getAllUsers());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/accounts/:id', optionalJwt, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body as Partial<UserAccount>;
    const existing = await dbRepository.findUserById(id);
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const merged = { ...existing, ...updates };
    if (updates.passwordHash === null || ('passwordHash' in req.body && req.body.passwordHash === null) || (updates.mustChangePassword === true && !updates.passwordHash)) {
      merged.passwordHash = undefined;
    }
    await dbRepository.saveUser(merged);
    res.json(merged);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update account' });
  }
});

router.get('/defense-attempts', async (_req, res) => {
  try {
    res.json(await dbRepository.getAllDefenseAttempts());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/defense-attempts/:id', optionalJwt, async (req, res) => {
  try {
    const { id } = req.params;
    const revision = await dbRepository.deleteDefenseAttemptById(id);
    res.json({ success: true, revision });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete defense attempt from database' });
  }
});

/**
 * Binary / PDF document storage in PostgreSQL
 */
router.put('/files/:key', async (req, res) => {
  try {
    const { dataUrl, fileName } = req.body;
    if (typeof dataUrl !== 'string' || !/^data:application\/pdf;base64,/.test(dataUrl) || typeof fileName !== 'string') {
      res.status(400).json({ error: 'A valid PDF document is required.' });
      return;
    }

    await dbRepository.saveStoredFile(req.params.key, dataUrl, fileName);
    res.json({ saved: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/files/:key', async (req, res) => {
  try {
    const file = await dbRepository.getStoredFile(req.params.key);
    if (!file) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    res.json(file);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Spreadsheet / CSV Backup export and import
 */
router.get('/backup', async (_req, res) => {
  try {
    const revision = await dbRepository.getStateRevision();
    const [offices, groups, deliverables, tasks, submissions, accounts, defenseAttempts] = await Promise.all([
      dbRepository.getAllOffices(),
      dbRepository.getAllGroups(),
      dbRepository.getAllDeliverables(),
      dbRepository.getAllTasks(),
      dbRepository.getAllSubmissions(),
      dbRepository.getAllUsers(),
      dbRepository.getAllDefenseAttempts(),
    ]);

    const state = {
      revision,
      values: {
        cpms_offices_v1: offices,
        cpms_groups_v1: groups,
        cpms_deliverables_v1: deliverables,
        cpms_tasks_v1: tasks,
        cpms_submissions_v1: submissions,
        cpms_accounts_v1: accounts,
        cpms_defense_attempts_v2: defenseAttempts,
      },
      files: {},
    };

    const csvText = encodeState(state);
    res.type('text/csv').attachment('capstone.csv').send(csvText);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/backup/restore', authenticateJwt, requireRole('instructor'), async (req: AuthenticatedRequest, res) => {
  try {
    const { csvText } = req.body;
    if (!csvText || typeof csvText !== 'string') {
      res.status(400).json({ error: 'CSV content is required.' });
      return;
    }

    const state = decodeState(csvText);
    const dataset = {
      offices: state.values['cpms_offices_v1'] || [],
      groups: state.values['cpms_groups_v1'] || [],
      deliverables: state.values['cpms_deliverables_v1'] || [],
      tasks: state.values['cpms_tasks_v1'] || [],
      submissions: state.values['cpms_submissions_v1'] || [],
      accounts: state.values['cpms_accounts_v1'] || [],
      defenseAttempts: state.values['cpms_defense_attempts_v2'] || [],
    };

    const nextRev = await dbRepository.saveFullDataset(dataset);
    res.json({ success: true, revision: nextRev });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a review (revision responses) and cascade‑delete its submission (by submission ID)
router.delete(
  '/review/submission/:submissionId',
  optionalJwt,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user && req.user.role !== 'instructor') {
        res.status(403).json({ error: 'Forbidden. Only coordinators/instructors can delete submissions.' });
        return;
      }
      const { submissionId } = req.params;
      await dbRepository.deleteRevisionResponsesBySubmission(submissionId);
      await dbRepository.deleteSubmissionById(submissionId);
      res.status(204).end(); // No Content
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PATCH to unsubmit a submission – resets status and removes versions/grade
router.patch(
  '/review/unsubmit/:submissionId',
  optionalJwt,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user && req.user.role !== 'instructor') {
        res.status(403).json({ error: 'Forbidden. Only coordinators/instructors can unsubmit submissions.' });
        return;
      }
      const { submissionId } = req.params;
      await dbRepository.unsubmitSubmission(submissionId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;

