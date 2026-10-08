import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DbRepository } from '../server/dbRepository';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function syncLocalToNeon() {
  const localUrl = process.env.LOCAL_DATABASE_URL || 'postgres://postgres@localhost:5432/cpms_db';
  const neonUrl = process.argv[2] || process.env.NEON_DATABASE_URL;

  if (!neonUrl) {
    console.error('\n[Error] Please provide your Neon database connection URL as an argument.');
    console.error('Usage: npx tsx scripts/syncToRemoteDb.ts "postgres://user:pass@ep-xyz.neon.tech/neondb?sslmode=require"\n');
    process.exit(1);
  }

  console.log('[1/4] Connecting to local PostgreSQL database...');
  const localPool = new Pool({
    connectionString: localUrl,
    ssl: false,
  });

  console.log('[2/4] Connecting to remote Neon PostgreSQL database...');
  const neonPool = new Pool({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    // 1. Fetch all local data
    console.log('Extracting local data...');
    const localRepo = new DbRepository();
    
    // Test local connection
    const userCount = await localRepo.getUserCount();
    console.log(`Found ${userCount} users in local database.`);

    const [offices, groups, deliverables, tasks, submissions, accounts, defenseAttempts] = await Promise.all([
      localRepo.getAllOffices(),
      localRepo.getAllGroups(),
      localRepo.getAllDeliverables(),
      localRepo.getAllTasks(),
      localRepo.getAllSubmissions(),
      localRepo.getAllUsers(),
      localRepo.getAllDefenseAttempts(),
    ]);

    // Fetch stored files from local DB
    const filesRes = await localPool.query('SELECT key, data_url, file_name FROM stored_files');
    console.log(`Found ${filesRes.rows.length} stored manuscript files.`);

    // 2. Initialize schema on Neon
    console.log('[3/4] Ensuring database schema is ready on Neon...');
    const schemaPath = path.join(__dirname, '..', 'server', 'schema.sql');
    const ddl = await fs.readFile(schemaPath, 'utf8');
    await neonPool.query(ddl);
    await neonPool.query('ALTER TABLE submission_versions ADD COLUMN IF NOT EXISTS file_data_url TEXT;');

    // 3. Populate Neon database
    console.log('[4/4] Uploading all records to Neon...');
    const client = await neonPool.connect();
    try {
      await client.query('BEGIN');

      // Sync state revision
      await client.query(`
        CREATE TABLE IF NOT EXISTS state_meta (
          id INT PRIMARY KEY DEFAULT 1,
          revision INT NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`
        INSERT INTO state_meta (id, revision, updated_at)
        VALUES (1, 100, NOW())
        ON CONFLICT (id) DO UPDATE SET revision = 100, updated_at = NOW()
      `);

      // Sync Offices & SubOffices
      console.log(` -> Uploading ${offices.length} offices...`);
      for (const off of offices) {
        await client.query(`
          INSERT INTO offices (id, name, code, sort_order, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, sort_order = EXCLUDED.sort_order, updated_at = NOW()
        `, [off.id, off.name, off.code, off.sortOrder]);

        for (const sub of (off.subOffices || [])) {
          await client.query(`
            INSERT INTO sub_offices (id, office_id, name, code, sort_order, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (id) DO UPDATE SET office_id = EXCLUDED.office_id, name = EXCLUDED.name, code = EXCLUDED.code, sort_order = EXCLUDED.sort_order, updated_at = NOW()
          `, [sub.id, off.id, sub.name, sub.code, sub.sortOrder]);
        }
      }

      // Sync Users & Accounts
      console.log(` -> Uploading ${accounts.length} users and accounts...`);
      for (const u of accounts) {
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

      // Sync Groups & Members
      console.log(` -> Uploading ${groups.length} capstone groups and members...`);
      for (const g of groups) {
        await client.query(`
          INSERT INTO groups (id, name, title, office_id, sub_office_id, adviser_id, adviser_name, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            title = EXCLUDED.title,
            office_id = EXCLUDED.office_id,
            sub_office_id = EXCLUDED.sub_office_id,
            adviser_id = EXCLUDED.adviser_id,
            adviser_name = EXCLUDED.adviser_name,
            updated_at = NOW()
        `, [g.id, g.name, g.title, g.officeId, g.subOfficeId || null, g.adviserId || null, g.adviserName || null, g.createdAt || new Date().toISOString()]);

        await client.query('DELETE FROM group_members WHERE group_id = $1', [g.id]);
        for (const m of (g.members || [])) {
          const mRes = await client.query(`
            INSERT INTO group_members (id, group_id, user_id, first_name, last_name, email)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
          `, [m.id, g.id, m.id, m.firstName, m.lastName, m.email || null]);
          
          const gmId = mRes.rows[0].id;
          for (const role of (m.roles || [])) {
            await client.query(`
              INSERT INTO group_member_roles (group_member_id, role_name)
              VALUES ($1, $2)
            `, [gmId, role]);
          }
        }
      }

      // Sync Deliverables & Rubrics
      console.log(` -> Uploading ${deliverables.length} deliverables and rubrics...`);
      for (const d of deliverables) {
        await client.query(`
          INSERT INTO deliverables (id, name, description, total_possible_points, sort_order, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            total_possible_points = EXCLUDED.total_possible_points,
            sort_order = EXCLUDED.sort_order,
            updated_at = NOW()
        `, [d.id, d.name, d.description, d.totalPossiblePoints, d.sortOrder]);

        await client.query('DELETE FROM rubric_criteria WHERE deliverable_id = $1', [d.id]);
        for (const [idx, c] of (d.rubric || []).entries()) {
          const critRes = await client.query(`
            INSERT INTO rubric_criteria (id, deliverable_id, name, max_score, sort_order)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
          `, [c.id, d.id, c.name, c.maxScore, idx]);

          const cId = critRes.rows[0].id;
          for (const lvl of (c.levels || [])) {
            await client.query(`
              INSERT INTO rubric_levels (rubric_criterion_id, name, percentage, description)
              VALUES ($1, $2, $3, $4)
            `, [cId, lvl.name, lvl.percentage, lvl.description]);
          }
        }
      }

      // Sync Tasks
      console.log(` -> Uploading ${tasks.length} tasks...`);
      for (const t of tasks) {
        await client.query(`
          INSERT INTO tasks (id, deliverable_id, name, instructions, deadline, max_score, late_policy_type, late_deduction_amount, is_revision_task, revision_cycle_number, previous_task_id, status, is_archived, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
          ON CONFLICT (id) DO UPDATE SET
            deliverable_id = EXCLUDED.deliverable_id,
            name = EXCLUDED.name,
            instructions = EXCLUDED.instructions,
            deadline = EXCLUDED.deadline,
            max_score = EXCLUDED.max_score,
            late_policy_type = EXCLUDED.late_policy_type,
            late_deduction_amount = EXCLUDED.late_deduction_amount,
            is_revision_task = EXCLUDED.is_revision_task,
            revision_cycle_number = EXCLUDED.revision_cycle_number,
            previous_task_id = EXCLUDED.previous_task_id,
            status = EXCLUDED.status,
            is_archived = EXCLUDED.is_archived,
            updated_at = NOW()
        `, [
          t.id, t.deliverableId, t.name, t.instructions, t.deadline, t.maxScore,
          t.latePolicy.type, t.latePolicy.deductionAmount,
          t.isRevisionTask, t.revisionCycleNumber || 1, t.previousTaskId || null,
          t.status, t.isArchived,
        ]);
      }

      // Sync Submissions & Versions
      console.log(` -> Uploading ${submissions.length} submissions and versions...`);
      for (const s of submissions) {
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
            await client.query(`
              INSERT INTO revision_responses (id, submission_version_id, instructor_comment, page_or_section, change_description)
              VALUES ($1, $2, $3, $4, $5)
            `, [rr.id, vId, rr.instructorComment, rr.pageOrSection, rr.changeDescription]);
          }
        }

        // Annotations
        await client.query('DELETE FROM submission_annotations WHERE submission_id = $1', [s.id]);
        for (const a of (s.annotations || [])) {
          await client.query(`
            INSERT INTO submission_annotations (id, submission_id, version_number, page_number, x, y, width, height, comment, author_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [a.id, s.id, a.version, a.pageNumber, a.x, a.y, a.width || null, a.height || null, a.comment, a.authorName]);
        }

        // Grade
        if (s.grade) {
          const gRes = await client.query(`
            INSERT INTO submission_grades (submission_id, rubric_raw_score, rubric_max_score, task_raw_score, late_deduction, days_late, final_score, overall_remarks, graded_at, is_returned, returned_at, last_edited_at, frozen_rubric_json)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (submission_id) DO UPDATE SET
              rubric_raw_score = EXCLUDED.rubric_raw_score,
              rubric_max_score = EXCLUDED.rubric_max_score,
              task_raw_score = EXCLUDED.task_raw_score,
              late_deduction = EXCLUDED.late_deduction,
              days_late = EXCLUDED.days_late,
              final_score = EXCLUDED.final_score,
              overall_remarks = EXCLUDED.overall_remarks,
              graded_at = EXCLUDED.graded_at,
              is_returned = EXCLUDED.is_returned,
              returned_at = EXCLUDED.returned_at,
              last_edited_at = EXCLUDED.last_edited_at,
              frozen_rubric_json = EXCLUDED.frozen_rubric_json
            RETURNING id
          `, [
            s.id, s.grade.rubricRawScore, s.grade.rubricMaxScore, s.grade.taskRawScore,
            s.grade.lateDeduction, s.grade.daysLate, s.grade.finalScore, s.grade.overallRemarks,
            s.grade.gradedAt, s.grade.isReturned, s.grade.returnedAt || null, s.grade.lastEditedAt || null,
            s.grade.frozenRubric ? JSON.stringify(s.grade.frozenRubric) : null,
          ]);

          const gradeId = gRes.rows[0].id;
          await client.query('DELETE FROM submission_grade_criterion_assessments WHERE grade_id = $1', [gradeId]);
          for (const [critId, ca] of Object.entries(s.grade.criterionAssessments || {})) {
            await client.query(`
              INSERT INTO submission_grade_criterion_assessments (grade_id, criterion_id, level_name, percentage, score, max_points)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [gradeId, critId, ca.levelName, ca.percentage, ca.score, ca.maxPoints]);
          }
        }
      }

      // Sync Defense Attempts & Evaluations
      console.log(` -> Uploading ${defenseAttempts.length} defense attempts and evaluations...`);
      for (const d of defenseAttempts) {
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
        `, [d.id, d.groupId, d.attemptNumber, d.previousAttemptId || null, d.defenseDate, d.defenseTime, d.venue, d.leadPanelId || null, d.status, d.createdAt || new Date().toISOString()]);

        await client.query('DELETE FROM defense_attempt_panel_members WHERE defense_attempt_id = $1', [d.id]);
        for (const [idx, pId] of (d.panelMemberIds || []).entries()) {
          await client.query(`
            INSERT INTO defense_attempt_panel_members (defense_attempt_id, panel_user_id, sort_order)
            VALUES ($1, $2, $3)
          `, [d.id, pId, idx]);
        }

        // Evaluations
        await client.query('DELETE FROM presentation_evaluations WHERE defense_attempt_id = $1', [d.id]);
        for (const pe of (d.presentationEvaluations || [])) {
          const peRes = await client.query(`
            INSERT INTO presentation_evaluations (defense_attempt_id, panel_user_id, panel_member_name, evaluated_at, clarity_of_presentation, understanding_of_project, engagement_and_communication, use_of_visual_aids, handling_of_qa, team_collaboration, time_management, professionalism_and_confidence, total_group_score, average_group_score, comments)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id
          `, [
            d.id, pe.panelMemberId, pe.panelMemberName, pe.evaluatedAt,
            pe.clarityOfPresentation, pe.understandingOfProject, pe.engagementAndCommunication,
            pe.useOfVisualAids, pe.handlingOfQA, pe.teamCollaboration, pe.timeManagement,
            pe.professionalismAndConfidence, pe.totalGroupScore, pe.averageGroupScore, pe.comments || null
          ]);

          const peId = peRes.rows[0].id;
          for (const ir of (pe.individualStudentRatings || [])) {
            await client.query(`
              INSERT INTO presentation_individual_ratings (presentation_evaluation_id, student_id, student_name, rate)
              VALUES ($1, $2, $3, $4)
            `, [peId, ir.studentId, ir.studentName, ir.rate]);
          }
        }

        await client.query('DELETE FROM manuscript_evaluations WHERE defense_attempt_id = $1', [d.id]);
        for (const me of (d.manuscriptEvaluations || [])) {
          const meRes = await client.query(`
            INSERT INTO manuscript_evaluations (defense_attempt_id, panel_user_id, panel_member_name, evaluated_at, comments, is_passed)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
          `, [d.id, me.panelMemberId, me.panelMemberName, me.evaluatedAt, me.comments || null, me.isPassed]);

          const meId = meRes.rows[0].id;
          for (const cr of (me.criterionRatings || [])) {
            await client.query(`
              INSERT INTO manuscript_criterion_ratings (manuscript_evaluation_id, criterion_id, criterion_name, rating, comments)
              VALUES ($1, $2, $3, $4, $5)
            `, [meId, cr.criterionId, cr.criterionName, cr.rating, cr.comments || null]);
          }
        }

        // Defense report
        if (d.defenseReport) {
          const dr = d.defenseReport;
          const drRes = await client.query(`
            INSERT INTO defense_reports (defense_attempt_id, committee_action, finalized_at, published_to_students, remarks)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (defense_attempt_id) DO UPDATE SET
              committee_action = EXCLUDED.committee_action,
              finalized_at = EXCLUDED.finalized_at,
              published_to_students = EXCLUDED.published_to_students,
              remarks = EXCLUDED.remarks
            RETURNING id
          `, [d.id, dr.committeeAction, dr.finalizedAt, dr.publishedToStudents, dr.remarks || null]);

          const drId = drRes.rows[0].id;
          await client.query('DELETE FROM defense_report_proposals WHERE defense_report_id = $1', [drId]);
          for (const [idx, p] of (dr.proposals || []).entries()) {
            await client.query(`
              INSERT INTO defense_report_proposals (defense_report_id, proposal_title, action, sort_order)
              VALUES ($1, $2, $3, $4)
            `, [drId, p.title, p.action, idx]);
          }

          await client.query('DELETE FROM defense_report_signatures WHERE defense_report_id = $1', [drId]);
          for (const sig of (dr.panelSignatures || [])) {
            await client.query(`
              INSERT INTO defense_report_signatures (defense_report_id, panel_user_id, panel_name, role_title, is_signed, signed_at)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [drId, sig.panelMemberId, sig.panelMemberName, sig.roleTitle, sig.isSigned, sig.signedAt || null]);
          }
        }
      }

      // Sync Stored Files (PDFs)
      console.log(` -> Uploading ${filesRes.rows.length} binary manuscript files...`);
      for (const f of filesRes.rows) {
        await client.query(`
          INSERT INTO stored_files (key, data_url, file_name, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (key) DO UPDATE SET data_url = EXCLUDED.data_url, file_name = EXCLUDED.file_name, updated_at = NOW()
        `, [f.key, f.data_url, f.file_name]);
      }

      await client.query('COMMIT');
      console.log('\n[SUCCESS] ALL DATA (Users, Groups, Tasks, Submissions, Defense Schedules, Evaluations, PDFs) HAS BEEN MIGRATED TO NEON!\n');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('\n[Error during migration]:', err);
    process.exit(1);
  } finally {
    await localPool.end();
    await neonPool.end();
  }
}

syncLocalToNeon();
