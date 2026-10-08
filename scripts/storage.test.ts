import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CsvStore, encodeState, decodeState } from '../server/csvStore';
import { exportDataset, parseCsvFiles, type AppDataset } from '../src/services/portableData';
import { hashPassword, verifyPassword } from '../src/utils/password';
import { normalizeUsername, getDefaultPassword } from '../src/utils/credentials';
import { calculateSubmissionScore } from '../src/utils/scoring';
import { toDateTimeLocalValue } from '../src/utils/dateUtils';
import { validateSchedule } from '../src/utils/schedule';
import { parseCsvText } from '../src/services/csv';

const empty = (): AppDataset => ({ offices: [], groups: [], accounts: [], tasks: [], deliverables: [], submissions: [], defenseAttempts: [] });

test('single CSV preserves every value, long PDF text, quotes, Unicode and empty collections', () => {
  const state = { revision: 4, values: { array: [null, true, 0, '', 'ñ, "quoted"\nsecond line', '=SUM(A1:A2)', '\t@formula'], empty: [], document: 'JVBERi0' + 'a'.repeat(65000), nested: { a: {} } }, files: {} };
  const csv = encodeState(state);
  assert.deepEqual(decodeState(csv), state);
  assert.ok(csv.startsWith('\uFEFFrecord_path,type,part,value'));
});

test('CSV writes survive restart, serialize concurrent updates and reject stale updates', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cpms-test-'));
  try {
    const store = new CsvStore(directory); await store.load();
    await Promise.all([1, 2, 3].map(number => store.update(state => ({ ...state, revision: state.revision + 1, values: { ...state.values, [number]: ['saved'] } }))));
    const reopened = new CsvStore(directory); await reopened.load();
    assert.equal(reopened.state.revision, 3);
    assert.equal(Object.keys(reopened.state.values).length, 3);
    await assert.rejects(reopened.update(() => { throw new Error('Stale version'); }));
    assert.deepEqual(decodeState(await readFile(path.join(directory, 'capstone.csv'), 'utf8')), reopened.state);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('spreadsheet exports round-trip credentials, submissions, actual PDF and nested feedback', async () => {
  const dataset = empty();
  dataset.accounts = [{ id: 'a', username: 'test.user', firstName: 'Test', lastName: 'User', role: 'instructor', passwordHash: await hashPassword('password123'), mustChangePassword: false }];
  dataset.offices = [{ id: 'o', name: 'Research, Office', code: 'R', subOffices: [{ id: 'so', officeId: 'o', name: 'Department', code: 'D' }] }];
  dataset.groups = [{ id: 'g', title: 'Title "quoted"\nsecond line', officeId: 'o', subOfficeId: 'so', clientNames: ['A | B'], createdAt: '2026-10-05T00:00:00Z', members: [] }];
  dataset.submissions = [{ id: 's', groupId: 'g', taskId: 't', deliverableId: 'd', status: 'submitted', currentVersion: 1, versions: [{ version: 1, submittedAt: '2026-10-05T00:00:00Z', submittedByMemberId: 'u', submittedByName: 'User', fileName: 'paper.pdf', fileSize: 12, fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQK', revisionResponses: [{ id: 'r', instructorComment: 'Fix, please', changeDescription: 'Fixed\nnow', pageOrSection: '1' }] }], annotations: [] }];
  const result = parseCsvFiles(exportDataset(dataset), empty());
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), dataset);
});

test('password hashing rejects wrong passwords and never stores plaintext', async () => {
  const hash = await hashPassword('secure passphrase');
  assert.ok(!hash.includes('secure passphrase'));
  assert.ok(await verifyPassword('secure passphrase', hash));
  assert.equal(await verifyPassword('wrong', hash), false);
  assert.notEqual(await hashPassword('secure passphrase'), hash);
});

test('grading scales rubric scores and deducts started late days', () => {
  const result = calculateSubmissionScore([{ id: 'r', name: 'Quality', description: '', maxPoints: 20, levels: [{ name: 'Good', percentage: 0.8 }] }], { r: 'Good' }, 100, { type: 'per_day', deductionAmount: 5 }, '2026-10-06T00:00:01Z', '2026-10-05T00:00:00Z');
  assert.equal(result.taskRawScore, 80); assert.equal(result.daysLate, 2); assert.equal(result.finalScore, 70);
  assert.equal(toDateTimeLocalValue('2026-10-05T00:00:00Z'), '2026-10-05T08:00');
});

test('scheduling rejects group, panel and venue conflicts but permits editing the same attempt', () => {
  const candidate = { groupId: 'g', defenseDate: '2026-10-05', defenseTime: '09:00', venue: 'Room 1', panelMemberIds: ['p'], leadPanelId: 'p' };
  const attempt = { ...candidate, id: 'a', attemptNumber: 1, status: 'scheduled' as const, createdAt: '2026-10-05', presentationEvaluations: {}, manuscriptEvaluations: {} };
  assert.match(validateSchedule(candidate, [attempt])!, /group/);
  assert.match(validateSchedule({ ...candidate, groupId: 'g2' }, [attempt])!, /panel/);
  assert.match(validateSchedule({ ...candidate, groupId: 'g2', panelMemberIds: ['p2'], leadPanelId: 'p2' }, [attempt])!, /venue/);
  assert.equal(validateSchedule(candidate, [attempt], 'a'), null);
  assert.equal(validateSchedule({ ...candidate, defenseTime: '10:00' }, [attempt]), null);
  assert.match(validateSchedule({ ...candidate, leadPanelId: 'other' }, [])!, /lead panel/);
});

test('malformed quoted CSV is rejected', () => {
  assert.throws(() => parseCsvText('id,name\n1,"unclosed'), /closing quote/);
});

test('group edits preserve custom passwords, reset works, and CSV is the source of truth', async () => {
  const originalFetch = globalThis.fetch;
  let disk = { revision: 0, values: {} as Record<string, string> };
  globalThis.fetch = (async (_url: any, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const payload = JSON.parse(String(init.body));
      assert.equal(payload.revision, disk.revision);
      disk = { values: payload.values, revision: disk.revision + 1 };
      return new Response(JSON.stringify({ revision: disk.revision }));
    }
    return new Response(JSON.stringify(disk));
  }) as typeof fetch;
  const session = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => session.get(key) ?? null, setItem: (key: string, value: string) => session.set(key, value), removeItem: (key: string) => session.delete(key) } });
  try {
    const { initializeFileStore, flushFileStore } = await import('../src/services/fileStore');
    const { storage } = await import('../src/services/storage');
    await initializeFileStore();
    assert.equal(storage.getAccounts().length, 0);
    storage.saveGroups([{ id: 'g', title: 'Research', officeId: 'o', subOfficeId: 'so', clientNames: [], createdAt: '2026-10-05', members: [{ id: 'm', username: 'student.user', firstName: 'Student', lastName: 'User', roles: ['Project Manager'], mustChangePassword: true }] }]);
    const hash = await hashPassword('custom password');
    storage.updateAccount({ id: 'm', passwordHash: hash, mustChangePassword: false });
    storage.saveGroups(storage.getGroups().map(group => ({ ...group, title: 'Updated title' })));
    await flushFileStore();
    assert.equal(storage.getAccounts()[0].passwordHash, hash);
    assert.equal(storage.getAccounts()[0].mustChangePassword, false);
    await initializeFileStore();
    assert.equal(storage.getGroups()[0].title, 'Updated title');
    storage.updateAccount({ id: 'm', passwordHash: undefined, mustChangePassword: true });
    storage.saveGroups(storage.getGroups());
    await flushFileStore();
    assert.equal(storage.getAccounts()[0].passwordHash, undefined);
    assert.equal(storage.getAccounts()[0].mustChangePassword, true);
  } finally { globalThis.fetch = originalFetch; }
});

test('defense attempts and evaluations persist cleanly through storage and CSV', async () => {
  const originalFetch = globalThis.fetch;
  let disk = { revision: 0, values: {} as Record<string, string> };
  globalThis.fetch = (async (_url: any, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const payload = JSON.parse(String(init.body));
      disk = { values: payload.values, revision: disk.revision + 1 };
      return new Response(JSON.stringify({ revision: disk.revision }));
    }
    return new Response(JSON.stringify(disk));
  }) as typeof fetch;
  const session = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => session.get(key) ?? null, setItem: (key: string, value: string) => session.set(key, value), removeItem: (key: string) => session.delete(key) } });
  try {
    const { initializeFileStore, flushFileStore } = await import('../src/services/fileStore');
    const { storage } = await import('../src/services/storage');
    await initializeFileStore();
    const attempt = {
      id: 'att-1',
      groupId: 'grp-1',
      attemptNumber: 1,
      defenseDate: '2026-10-10',
      defenseTime: '10:00',
      venue: 'Room 301',
      panelMemberIds: ['pan-1', 'pan-2'],
      leadPanelId: 'pan-1',
      status: 'scheduled' as const,
      createdAt: '2026-10-05T00:00:00Z',
      presentationEvaluations: {},
      manuscriptEvaluations: {},
    };
    storage.saveDefenseAttempt(attempt);
    await flushFileStore();
    assert.equal(storage.getDefenseAttempts().length, 1);
    assert.equal(storage.getDefenseAttemptsForGroup('grp-1')[0].venue, 'Room 301');

    storage.savePresentationEvaluation('att-1', {
      panelMemberId: 'pan-1',
      panelMemberName: 'Dr. Panel',
      evaluatedAt: '2026-10-10T11:00:00Z',
      groupRating: { clarityOfPresentation: 5, understandingOfProject: 5, engagementAndCommunication: 5, useOfVisualAids: 5, handlingOfQA: 5, teamCollaboration: 5, timeManagement: 5, professionalismAndConfidence: 5 },
      individualRatings: [{ studentId: 'stu-1', studentName: 'Student One', rate: 5 }],
      totalGroupScore: 40,
      averageGroupScore: 5,
    });
    await flushFileStore();
    const evaluated = storage.getDefenseAttemptById('att-1');
    assert.equal(evaluated?.status, 'evaluating');
    assert.equal(evaluated?.presentationEvaluations?.['pan-1'].averageGroupScore, 5);
  } finally { globalThis.fetch = originalFetch; }
});

test('username format conforms to firstname.lastname and default password matches username', () => {
  assert.equal(normalizeUsername('Maria Clara', 'Santos'), 'mariaclara.santos');
  assert.equal(normalizeUsername('Pedro', 'Penduko'), 'pedro.penduko');
  assert.equal(normalizeUsername('Juan', 'Dela Cruz'), 'juan.delacruz');
  assert.equal(normalizeUsername('Cris Niel Anthonny', 'Gulfan'), 'crisnielanthonny.gulfan');
  assert.equal(getDefaultPassword('pedro.penduko'), 'pedro.penduko');
  assert.equal(getDefaultPassword('Pedro', 'Penduko'), 'pedro.penduko');
  assert.equal(getDefaultPassword('crisnielanthonny.gulfan'), 'crisnielanthonny.gulfan');
});

test('storage normalizes coordinator account username to firstname.lastname', async () => {
  const originalFetch = globalThis.fetch;
  let disk = { revision: 0, values: {} as Record<string, string> };
  globalThis.fetch = (async (_url: any, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const payload = JSON.parse(String(init.body));
      disk = { values: payload.values, revision: disk.revision + 1 };
      return new Response(JSON.stringify({ revision: disk.revision }));
    }
    return new Response(JSON.stringify(disk));
  }) as typeof fetch;
  const session = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => session.get(key) ?? null, setItem: (key: string, value: string) => session.set(key, value), removeItem: (key: string) => session.delete(key) } });
  try {
    const { storage } = await import('../src/services/storage');
    storage.addAccount({
      id: 'coord-test-1',
      username: 'anthonnyclein',
      firstName: 'Cris Niel Anthonny',
      lastName: 'Gulfan',
      role: 'instructor',
      mustChangePassword: false,
    });
    const accounts = storage.getAccounts();
    const coordinator = accounts.find(a => a.id === 'coord-test-1');
    assert.equal(coordinator?.username, 'crisnielanthonny.gulfan');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
