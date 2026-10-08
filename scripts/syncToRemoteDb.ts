import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dbRepository } from '../server/dbRepository';
import type { UserAccount, GroupTaskSubmission } from '../src/types';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function syncLocalToNeon() {
  const localUrl = process.env.LOCAL_DATABASE_URL || 'postgres://postgres@localhost:5432/cpms_db';
  const rawNeonUrl = process.argv[2] || process.env.NEON_DATABASE_URL;

  if (!rawNeonUrl) {
    console.error('\n[Error] Please provide your Neon database connection URL.');
    process.exit(1);
  }

  // Clean URL params if needed
  const neonUrl = rawNeonUrl.replace(/&?channel_binding=[^&]+/, '');

  console.log('[1/4] Extracting all records from local PostgreSQL database...');
  const [offices, groups, deliverables, tasks, submissions, accounts, defenseAttempts] = await Promise.all([
    dbRepository.getAllOffices(),
    dbRepository.getAllGroups(),
    dbRepository.getAllDeliverables(),
    dbRepository.getAllTasks(),
    dbRepository.getAllSubmissions(),
    dbRepository.getAllUsers(),
    dbRepository.getAllDefenseAttempts(),
  ]);

  console.log(` -> Found ${accounts.length} users/accounts.`);
  console.log(` -> Found ${groups.length} groups.`);
  console.log(` -> Found ${deliverables.length} deliverables.`);
  console.log(` -> Found ${tasks.length} tasks.`);
  console.log(` -> Found ${submissions.length} submissions.`);
  console.log(` -> Found ${defenseAttempts.length} defense attempts.`);

  const localPool = new Pool({ connectionString: localUrl, ssl: false });
  const filesRes = await localPool.query('SELECT key, data_url, file_name FROM stored_files');
  console.log(` -> Found ${filesRes.rows.length} stored manuscript files.`);
  await localPool.end();

  console.log('\n[2/4] Connecting to remote Neon PostgreSQL database...');
  const neonPool = new Pool({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  const client = await neonPool.connect();

  try {
    console.log('[3/4] Initializing schema on Neon...');
    const schemaPath = path.join(__dirname, '..', 'server', 'schema.sql');
    const ddl = await fs.readFile(schemaPath, 'utf8');
    await client.query(ddl);
    await client.query('ALTER TABLE submission_versions ADD COLUMN IF NOT EXISTS file_data_url TEXT;');

    console.log('[4/4] Uploading full dataset into Neon in a transaction...');
    await client.query('BEGIN');

    // 1. Sync Offices
    console.log(` -> Inserting ${offices.length} offices...`);
    const officeIds = offices.map(o => o.id);
    if (officeIds.length > 0) {
      await client.query('DELETE FROM offices WHERE id NOT IN (' + officeIds.map((_, i) => '$' + (i + 1)).join(',') + ')', officeIds);
    } else {
      await client.query('DELETE FROM offices');
    }
    for (const off of offices) {
      await client.query(
        'INSERT INTO offices (id, name, code) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code',
        [off.id, off.name, off.code]
      );
      const subIds = (off.subOffices || []).map(s => s.id);
      if (subIds.length > 0) {
        await client.query('DELETE FROM sub_offices WHERE office_id = $1 AND id NOT IN (' + subIds.map((_, i) => '$' + (i + 2)).join(',') + ')', [off.id, ...subIds]);
      } else {
        await client.query('DELETE FROM sub_offices WHERE office_id = $1', [off.id]);
      }
      for (const sub of (off.subOffices || [])) {
        await client.query(
          'INSERT INTO sub_offices (id, office_id, name, code) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code',
          [sub.id, off.id, sub.name, sub.code]
        );
      }
    }

    // 2. Sync Users
    console.log(` -> Inserting ${accounts.length} users & credentials...`);
    const allUsersMap = new Map<string, UserAccount>();
    for (const acc of accounts) allUsersMap.set(acc.id, acc);
    for (const grp of groups) {
      for (const mem of (grp.members || [])) {
        if (!allUsersMap.has(mem.id)) {
          allUsersMap.set(mem.id, {
            id: mem.id,
            username: mem.username,
            firstName: mem.firstName,
            lastName: mem.lastName,
            role: 'student',
            passwordHash: mem.passwordHash,
            mustChangePassword: mem.mustChangePassword,
            groupId: grp.id,
            studentRoles: mem.roles,
          });
        }
      }
    }
    const userList = Array.from(allUsersMap.values());
    const userIds = userList.map(u => u.id);
    if (userIds.length > 0) {
      await client.query('DELETE FROM users WHERE id NOT IN (' + userIds.map((_, i) => '$' + (i + 1)).join(',') + ')', userIds);
    } else {
      await client.query('DELETE FROM users');
    }
    for (const u of userList) {
      await client.query(`
        INSERT INTO users (id, username, first_name, last_name, role, password_hash, must_change_password, academic_title, academic_rank, avatar_url, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          role = EXCLUDED.role,
          password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
          must_change_password = EXCLUDED.must_change_password,
          academic_title = EXCLUDED.academic_title,
          academic_rank = EXCLUDED.academic_rank,
          avatar_url = EXCLUDED.avatar_url,
          updated_at = NOW()
      `, [u.id, u.username.toLowerCase(), u.firstName, u.lastName, u.role, u.passwordHash || null, u.mustChangePassword ?? false, u.academicTitle || null, u.academicRank || null, u.avatarUrl || null]);
    }

    // 3. Sync Groups
    console.log(` -> Inserting ${groups.length} groups & members...`);
    const groupIds = groups.map(g => g.id);
    if (groupIds.length > 0) {
      await client.query('DELETE FROM groups WHERE id NOT IN (' + groupIds.map((_, i) => '$' + (i + 1)).join(',') + ')', groupIds);
    } else {
      await client.query('DELETE FROM groups');
    }
    for (const grp of groups) {
      await client.query(`
        INSERT INTO groups (id, title, code, office_id, sub_office_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          code = EXCLUDED.code,
          office_id = EXCLUDED.office_id,
          sub_office_id = EXCLUDED.sub_office_id,
          updated_at = NOW()
      `, [grp.id, grp.title, grp.code || null, grp.officeId, grp.subOfficeId, grp.createdAt || new Date().toISOString()]);

      await client.query('DELETE FROM group_clients WHERE group_id = $1', [grp.id]);
      for (let i = 0; i < (grp.clientNames || []).length; i++) {
        await client.query('INSERT INTO group_clients (group_id, client_name, sort_order) VALUES ($1, $2, $3)', [grp.id, grp.clientNames[i], i]);
      }

      const memberUserIds = (grp.members || []).map(m => m.id);
      if (memberUserIds.length > 0) {
        await client.query('DELETE FROM group_members WHERE group_id = $1 AND user_id NOT IN (' + memberUserIds.map((_, i) => '$' + (i + 2)).join(',') + ')', [grp.id, ...memberUserIds]);
      } else {
        await client.query('DELETE FROM group_members WHERE group_id = $1', [grp.id]);
      }

      for (const mem of (grp.members || [])) {
        const gmRes = await client.query(`
          INSERT INTO group_members (id, group_id, user_id, created_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (group_id, user_id) DO UPDATE SET created_at = NOW()
          RETURNING id
        `, [`gm-${grp.id}-${mem.id}`, grp.id, mem.id]);

        const groupMemberId = gmRes.rows[0].id;
        await client.query('DELETE FROM group_member_roles WHERE group_member_id = $1', [groupMemberId]);
        for (const role of (mem.roles || [])) {
          await client.query('INSERT INTO group_member_roles (group_member_id, role_name) VALUES ($1, $2) ON CONFLICT (group_member_id, role_name) DO NOTHING', [groupMemberId, role]);
        }
      }
    }

    // 4. Sync Deliverables & Rubrics
    console.log(` -> Inserting ${deliverables.length} deliverables...`);
    const delivIds = deliverables.map(d => d.id);
    if (delivIds.length > 0) {
      await client.query('DELETE FROM deliverables WHERE id NOT IN (' + delivIds.map((_, i) => '$' + (i + 1)).join(',') + ')', delivIds);
    } else {
      await client.query('DELETE FROM deliverables');
    }
    for (const d of deliverables) {
      await client.query(`
        INSERT INTO deliverables (id, name, description, total_possible_points, is_archived, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          total_possible_points = EXCLUDED.total_possible_points,
          is_archived = EXCLUDED.is_archived,
          updated_at = NOW()
      `, [d.id, d.name, d.description || '', d.totalPossiblePoints, d.isArchived ?? false, d.createdAt || new Date().toISOString()]);

      const critIds = (d.rubric || []).map(r => r.id);
      if (critIds.length > 0) {
        await client.query('DELETE FROM rubric_criteria WHERE deliverable_id = $1 AND id NOT IN (' + critIds.map((_, i) => '$' + (i + 2)).join(',') + ')', [d.id, ...critIds]);
      } else {
        await client.query('DELETE FROM rubric_criteria WHERE deliverable_id = $1', [d.id]);
      }

      for (let i = 0; i < (d.rubric || []).length; i++) {
        const crit = d.rubric[i];
        await client.query(`
          INSERT INTO rubric_criteria (id, deliverable_id, name, description, max_points, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, max_points = EXCLUDED.max_points, sort_order = EXCLUDED.sort_order
        `, [crit.id, d.id, crit.name, crit.description || '', crit.maxPoints, i]);

        await client.query('DELETE FROM rubric_criterion_levels WHERE criterion_id = $1', [crit.id]);
        for (let j = 0; j < (crit.levels || []).length; j++) {
          const lvl = crit.levels[j];
          await client.query('INSERT INTO rubric_criterion_levels (criterion_id, name, percentage, sort_order) VALUES ($1, $2, $3, $4)', [crit.id, lvl.name, lvl.percentage, j]);
        }
      }
    }

    // 5. Sync Tasks
    console.log(` -> Inserting ${tasks.length} tasks...`);
    const taskIds = tasks.map(t => t.id);
    if (taskIds.length > 0) {
      await client.query('DELETE FROM tasks WHERE id NOT IN (' + taskIds.map((_, i) => '$' + (i + 1)).join(',') + ')', taskIds);
    } else {
      await client.query('DELETE FROM tasks');
    }
    for (const t of tasks) {
      await client.query(`
        INSERT INTO tasks (
          id, deliverable_id, name, instructions, deadline, max_score,
          late_policy_type, late_deduction_amount, late_max_deduction,
          status, is_revision_task, is_archived, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        ON CONFLICT (id) DO UPDATE SET
          deliverable_id = EXCLUDED.deliverable_id,
          name = EXCLUDED.name,
          instructions = EXCLUDED.instructions,
          deadline = EXCLUDED.deadline,
          max_score = EXCLUDED.max_score,
          late_policy_type = EXCLUDED.late_policy_type,
          late_deduction_amount = EXCLUDED.late_deduction_amount,
          late_max_deduction = EXCLUDED.late_max_deduction,
          status = EXCLUDED.status,
          is_revision_task = EXCLUDED.is_revision_task,
          is_archived = EXCLUDED.is_archived,
          updated_at = NOW()
      `, [
        t.id, t.deliverableId, t.name, t.instructions || '', t.deadline, t.maxScore,
        t.latePolicy?.type || 'none', t.latePolicy?.deductionAmount || 0, t.latePolicy?.maxDeduction || null,
        t.status, t.isRevisionTask ?? false, t.isArchived ?? false, t.createdAt || new Date().toISOString()
      ]);
    }

    // 6. Sync Submissions & Versions
    console.log(` -> Inserting ${submissions.length} submissions & versions...`);
    const deduplicatedSubs: GroupTaskSubmission[] = [];
    const seenGroupTask = new Set<string>();
    for (let i = submissions.length - 1; i >= 0; i--) {
      const s = submissions[i];
      const key = `${s.groupId}:::${s.taskId}`;
      if (!seenGroupTask.has(key)) {
        seenGroupTask.add(key);
        deduplicatedSubs.unshift(s);
      }
    }
    const subIds = deduplicatedSubs.map(s => s.id);
    if (subIds.length > 0) {
      await client.query('DELETE FROM submissions WHERE id NOT IN (' + subIds.map((_, i) => '$' + (i + 1)).join(',') + ')', subIds);
    } else {
      await client.query('DELETE FROM submissions');
    }
    for (const s of deduplicatedSubs) {
      await client.query('DELETE FROM submissions WHERE group_id = $1 AND task_id = $2 AND id != $3', [s.groupId, s.taskId, s.id]);
      await client.query(`
        INSERT INTO submissions (id, group_id, task_id, deliverable_id, status, current_version, submitted_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (id) DO UPDATE SET
          group_id = EXCLUDED.group_id,
          task_id = EXCLUDED.task_id,
          deliverable_id = EXCLUDED.deliverable_id,
          status = EXCLUDED.status,
          current_version = EXCLUDED.current_version,
          submitted_at = EXCLUDED.submitted_at,
          updated_at = NOW()
      `, [s.id, s.groupId, s.taskId, s.deliverableId, s.status, s.currentVersion, s.submittedAt || null]);

      await client.query('DELETE FROM submission_versions WHERE submission_id = $1', [s.id]);
      for (const v of (s.versions || [])) {
        const vRes = await client.query(`
          INSERT INTO submission_versions (submission_id, version_number, submitted_at, submitted_by_member_id, submitted_by_name, file_name, file_size, remarks, file_data_url)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `, [s.id, v.version, v.submittedAt, v.submittedByMemberId || null, v.submittedByName, v.fileName, v.fileSize, v.remarks || null, v.fileDataUrl || null]);

        const vId = vRes.rows[0].id;
        for (const rr of (v.revisionResponses || [])) {
          await client.query('INSERT INTO revision_responses (id, submission_version_id, instructor_comment, page_or_section, change_description) VALUES ($1, $2, $3, $4, $5)', [rr.id, vId, rr.instructorComment, rr.pageOrSection, rr.changeDescription]);
        }
      }

      await client.query('DELETE FROM submission_annotations WHERE submission_id = $1', [s.id]);
      for (const a of (s.annotations || [])) {
        await client.query(`
          INSERT INTO submission_annotations (id, submission_id, version_number, page_number, x, y, width, height, comment, author_name, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [a.id, s.id, a.version, a.pageNumber, a.x, a.y, a.width || null, a.height || null, a.comment, a.authorName, a.createdAt || new Date().toISOString()]);
      }

      await client.query('DELETE FROM submission_grades WHERE submission_id = $1', [s.id]);
      if (s.grade) {
        const g = s.grade;
        const gRes = await client.query(`
          INSERT INTO submission_grades (
            submission_id, rubric_raw_score, rubric_max_score, task_raw_score,
            late_deduction, days_late, final_score, overall_remarks, graded_at,
            is_returned, returned_at, last_edited_at, frozen_rubric_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id
        `, [
          s.id, g.rubricRawScore, g.rubricMaxScore, g.taskRawScore,
          g.lateDeduction, g.daysLate, g.finalScore, g.overallRemarks || '', g.gradedAt,
          g.isReturned, g.returnedAt || null, g.lastEditedAt || null, JSON.stringify(g.frozenRubric || [])
        ]);

        const gradeId = gRes.rows[0].id;
        for (const [critId, ca] of Object.entries(g.criterionAssessments || {})) {
          await client.query('INSERT INTO submission_grade_criterion_assessments (grade_id, criterion_id, level_name, percentage, score, max_points) VALUES ($1, $2, $3, $4, $5, $6)', [gradeId, critId, ca.levelName, ca.percentage, ca.score, ca.maxPoints]);
        }
      }
    }

    // 7. Sync Defense Attempts
    console.log(` -> Inserting ${defenseAttempts.length} defense attempts...`);
    const daIds = defenseAttempts.map(d => d.id);
    if (daIds.length > 0) {
      await client.query('DELETE FROM defense_attempts WHERE id NOT IN (' + daIds.map((_, i) => '$' + (i + 1)).join(',') + ')', daIds);
    } else {
      await client.query('DELETE FROM defense_attempts');
    }
    for (const da of defenseAttempts) {
      await client.query(`
        INSERT INTO defense_attempts (id, group_id, attempt_number, previous_attempt_id, defense_date, defense_time, venue, lead_panel_id, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (id) DO UPDATE SET
          group_id = EXCLUDED.group_id,
          attempt_number = EXCLUDED.attempt_number,
          previous_attempt_id = EXCLUDED.previous_attempt_id,
          defense_date = EXCLUDED.defense_date,
          defense_time = EXCLUDED.defense_time,
          venue = EXCLUDED.venue,
          lead_panel_id = EXCLUDED.lead_panel_id,
          status = EXCLUDED.status,
          updated_at = NOW()
      `, [da.id, da.groupId, da.attemptNumber, da.previousAttemptId || null, da.defenseDate, da.defenseTime, da.venue, da.leadPanelId || null, da.status, da.createdAt || new Date().toISOString()]);

      await client.query('DELETE FROM defense_attempt_panel_members WHERE defense_attempt_id = $1', [da.id]);
      for (let i = 0; i < (da.panelMemberIds || []).length; i++) {
        await client.query('INSERT INTO defense_attempt_panel_members (defense_attempt_id, panel_user_id, sort_order) VALUES ($1, $2, $3) ON CONFLICT (defense_attempt_id, panel_user_id) DO NOTHING', [da.id, da.panelMemberIds[i], i]);
      }

      await client.query('DELETE FROM presentation_evaluations WHERE defense_attempt_id = $1', [da.id]);
      for (const [panelId, pe] of Object.entries(da.presentationEvaluations || {})) {
        const peRes = await client.query(`
          INSERT INTO presentation_evaluations (
            defense_attempt_id, panel_user_id, panel_member_name, evaluated_at,
            clarity_of_presentation, understanding_of_project, engagement_and_communication,
            use_of_visual_aids, handling_of_qa, team_collaboration, time_management,
            professionalism_and_confidence, total_group_score, average_group_score, comments
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id
        `, [
          da.id, panelId, pe.panelMemberName, pe.evaluatedAt,
          pe.groupRating.clarityOfPresentation, pe.groupRating.understandingOfProject, pe.groupRating.engagementAndCommunication,
          pe.groupRating.useOfVisualAids, pe.groupRating.handlingOfQA, pe.groupRating.teamCollaboration, pe.groupRating.timeManagement,
          pe.groupRating.professionalismAndConfidence, pe.totalGroupScore, pe.averageGroupScore, pe.comments || null
        ]);

        const peId = peRes.rows[0].id;
        for (const ir of (pe.individualRatings || [])) {
          await client.query('INSERT INTO presentation_individual_ratings (presentation_evaluation_id, student_id, student_name, rate) VALUES ($1, $2, $3, $4)', [peId, ir.studentId, ir.studentName, ir.rate]);
        }
      }

      await client.query('DELETE FROM manuscript_evaluations WHERE defense_attempt_id = $1', [da.id]);
      for (const [panelId, me] of Object.entries(da.manuscriptEvaluations || {})) {
        const meRes = await client.query(`
          INSERT INTO manuscript_evaluations (defense_attempt_id, panel_user_id, panel_member_name, evaluated_at, total_score, average_score, overall_remarks)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [da.id, panelId, me.panelMemberName, me.evaluatedAt, me.totalScore, me.averageScore, me.overallRemarks || null]);

        const meId = meRes.rows[0].id;
        for (const [itemId, rating] of Object.entries(me.ratings || {})) {
          await client.query('INSERT INTO manuscript_item_ratings (manuscript_evaluation_id, item_id, rate, comment) VALUES ($1, $2, $3, $4)', [meId, itemId, rating.rate, rating.comment || null]);
        }
      }

      await client.query('DELETE FROM defense_reports WHERE defense_attempt_id = $1', [da.id]);
      if (da.report) {
        const rep = da.report;
        const drRes = await client.query(`
          INSERT INTO defense_reports (defense_attempt_id, lead_panel_id, lead_panel_name, degree_sought, venue_or_place, decision, conditions_or_remarks, updated_at, last_signatures_invalidated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `, [
          da.id, rep.leadPanelId || null, rep.leadPanelName, rep.degreeSought, rep.venueOrPlace,
          rep.decision, rep.conditionsOrRemarks || '', rep.updatedAt, rep.lastSignaturesInvalidatedAt || null
        ]);

        const drId = drRes.rows[0].id;
        for (const [panelId, action] of Object.entries(rep.committeeActions || {})) {
          await client.query('INSERT INTO defense_report_committee_actions (defense_report_id, panel_member_id, action) VALUES ($1, $2, $3)', [drId, panelId, action]);
        }

        for (const sig of (rep.signatures || [])) {
          await client.query(`
            INSERT INTO defense_report_signatures (defense_report_id, panel_member_id, panel_member_name, signed_at, signature_data_url, is_lead_panel)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [drId, sig.panelMemberId, sig.panelMemberName, sig.signedAt, sig.signatureDataUrl || null, sig.isLeadPanel]);
        }
      }
    }

    // 8. Sync Stored Files (PDFs)
    console.log(` -> Inserting ${filesRes.rows.length} manuscript PDF files...`);
    for (const f of filesRes.rows) {
      await client.query(`
        INSERT INTO stored_files (key, data_url, file_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO UPDATE SET data_url = EXCLUDED.data_url, file_name = EXCLUDED.file_name
      `, [f.key, f.data_url, f.file_name]);
    }

    // 9. Sync app_meta state revision
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      INSERT INTO app_meta (key, value, updated_at)
      VALUES ('state_revision', '300', NOW())
      ON CONFLICT (key) DO UPDATE SET value = '300', updated_at = NOW()
    `);

    await client.query('COMMIT');
    console.log('\n[SUCCESS] ENTIRE DATABASE SUCCESSFULLY UPLOADED TO NEON!\n');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n[Error during migration]:', err);
    process.exit(1);
  } finally {
    client.release();
    await neonPool.end();
  }
}

syncLocalToNeon();
