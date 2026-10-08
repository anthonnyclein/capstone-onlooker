import { pool, getClient } from './db';
import type {
  Office,
  SubOffice,
  Group,
  StudentMember,
  StudentRole,
  Deliverable,
  RubricCriterion,
  Task,
  GroupTaskSubmission,
  SubmissionVersion,
  DocumentAnnotation,
  SubmissionGrade,
  CriterionAssessment,
  DefenseAttempt,
  PresentationEvaluation,
  ManuscriptEvaluation,
  DefenseReportProposal,
  CommitteeAction,
  UserAccount,
} from '../src/types';

export class DbRepository {
  async getAllUsers(): Promise<UserAccount[]> {
    const userRes = await pool.query(`
      SELECT 
        u.id, u.username, u.first_name AS "firstName", u.last_name AS "lastName",
        u.role, u.password_hash AS "passwordHash", u.must_change_password AS "mustChangePassword",
        u.academic_title AS "academicTitle", u.academic_rank AS "academicRank",
        u.avatar_url AS "avatarUrl",
        gm.group_id AS "groupId",
        COALESCE(
          (SELECT json_agg(gmr.role_name ORDER BY gmr.id)
           FROM group_member_roles gmr
           WHERE gmr.group_member_id = gm.id),
          '[]'::json
        ) AS "studentRoles"
      FROM users u
      LEFT JOIN group_members gm ON gm.user_id = u.id
      ORDER BY u.last_name, u.first_name
    `);

    return userRes.rows.map(row => ({
      id: row.id,
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      passwordHash: row.passwordHash || undefined,
      mustChangePassword: row.mustChangePassword,
      academicTitle: row.academicTitle || undefined,
      academicRank: row.academicRank || undefined,
      avatarUrl: row.avatarUrl || undefined,
      groupId: row.groupId || undefined,
      studentRoles: row.studentRoles && row.studentRoles.length > 0 ? (row.studentRoles as StudentRole[]) : undefined,
    }));
  }

  async findUserByUsername(usernameOrName: string): Promise<UserAccount | null> {
    const clean = usernameOrName.trim().toLowerCase();
    const res = await pool.query(`
      SELECT 
        u.id, u.username, u.first_name AS "firstName", u.last_name AS "lastName",
        u.role, u.password_hash AS "passwordHash", u.must_change_password AS "mustChangePassword",
        u.academic_title AS "academicTitle", u.academic_rank AS "academicRank",
        u.avatar_url AS "avatarUrl",
        gm.group_id AS "groupId",
        COALESCE(
          (SELECT json_agg(gmr.role_name ORDER BY gmr.id)
           FROM group_member_roles gmr
           WHERE gmr.group_member_id = gm.id),
          '[]'::json
        ) AS "studentRoles"
      FROM users u
      LEFT JOIN group_members gm ON gm.user_id = u.id
      WHERE LOWER(u.username) = $1
         OR LOWER(REPLACE(CONCAT(u.first_name, '.', u.last_name), ' ', '')) = $1
      LIMIT 1
    `, [clean]);

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      passwordHash: row.passwordHash || undefined,
      mustChangePassword: row.mustChangePassword,
      academicTitle: row.academicTitle || undefined,
      academicRank: row.academicRank || undefined,
      avatarUrl: row.avatarUrl || undefined,
      groupId: row.groupId || undefined,
      studentRoles: row.studentRoles && row.studentRoles.length > 0 ? (row.studentRoles as StudentRole[]) : undefined,
    };
  }

  async findUserById(id: string): Promise<UserAccount | null> {
    const res = await pool.query(`
      SELECT 
        u.id, u.username, u.first_name AS "firstName", u.last_name AS "lastName",
        u.role, u.password_hash AS "passwordHash", u.must_change_password AS "mustChangePassword",
        u.academic_title AS "academicTitle", u.academic_rank AS "academicRank",
        u.avatar_url AS "avatarUrl",
        gm.group_id AS "groupId",
        COALESCE(
          (SELECT json_agg(gmr.role_name ORDER BY gmr.id)
           FROM group_member_roles gmr
           WHERE gmr.group_member_id = gm.id),
          '[]'::json
        ) AS "studentRoles"
      FROM users u
      LEFT JOIN group_members gm ON gm.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `, [id]);

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      passwordHash: row.passwordHash || undefined,
      mustChangePassword: row.mustChangePassword,
      academicTitle: row.academicTitle || undefined,
      academicRank: row.academicRank || undefined,
      avatarUrl: row.avatarUrl || undefined,
      groupId: row.groupId || undefined,
      studentRoles: row.studentRoles && row.studentRoles.length > 0 ? (row.studentRoles as StudentRole[]) : undefined,
    };
  }

  async saveUser(user: UserAccount): Promise<void> {
    await pool.query(`
      INSERT INTO users (id, username, first_name, last_name, role, password_hash, must_change_password, academic_title, academic_rank, avatar_url, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        password_hash = CASE 
          WHEN EXCLUDED.must_change_password = true AND EXCLUDED.password_hash IS NULL THEN NULL 
          ELSE COALESCE(EXCLUDED.password_hash, users.password_hash) 
        END,
        must_change_password = EXCLUDED.must_change_password,
        academic_title = EXCLUDED.academic_title,
        academic_rank = EXCLUDED.academic_rank,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW()
    `, [
      user.id,
      user.username.toLowerCase(),
      user.firstName,
      user.lastName,
      user.role,
      user.passwordHash || null,
      user.mustChangePassword ?? false,
      user.academicTitle || null,
      user.academicRank || null,
      user.avatarUrl || null,
    ]);
  }

  async getUserCount(): Promise<number> {
    const res = await pool.query('SELECT COUNT(*)::int AS count FROM users');
    return res.rows[0].count;
  }

  async getAllOffices(): Promise<Office[]> {
    const officesRes = await pool.query('SELECT id, name, code FROM offices ORDER BY name');
    const subOfficesRes = await pool.query('SELECT id, office_id AS "officeId", name, code FROM sub_offices ORDER BY name');

    const subMap = new Map<string, SubOffice[]>();
    for (const sub of subOfficesRes.rows) {
      const list = subMap.get(sub.officeId) || [];
      list.push(sub);
      subMap.set(sub.officeId, list);
    }

    return officesRes.rows.map(off => ({
      id: off.id,
      name: off.name,
      code: off.code,
      subOffices: subMap.get(off.id) || [],
    }));
  }

  async getAllGroups(): Promise<Group[]> {
    const groupsRes = await pool.query(`
      SELECT id, title, code, office_id AS "officeId", sub_office_id AS "subOfficeId", created_at AS "createdAt"
      FROM groups
      ORDER BY title
    `);

    const clientsRes = await pool.query(`
      SELECT group_id, client_name
      FROM group_clients
      ORDER BY group_id, sort_order
    `);
    const clientsMap = new Map<string, string[]>();
    for (const row of clientsRes.rows) {
      const list = clientsMap.get(row.group_id) || [];
      list.push(row.client_name);
      clientsMap.set(row.group_id, list);
    }

    const membersRes = await pool.query(`
      SELECT 
        gm.group_id, gm.id AS member_id, u.id AS user_id,
        u.first_name AS "firstName", u.last_name AS "lastName", u.username,
        u.password_hash AS "passwordHash", u.must_change_password AS "mustChangePassword",
        COALESCE(
          (SELECT json_agg(gmr.role_name ORDER BY gmr.id)
           FROM group_member_roles gmr
           WHERE gmr.group_member_id = gm.id),
          '[]'::json
        ) AS "roles"
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      ORDER BY gm.group_id, u.last_name, u.first_name
    `);
    const membersMap = new Map<string, StudentMember[]>();
    for (const row of membersRes.rows) {
      const list = membersMap.get(row.group_id) || [];
      list.push({
        id: row.user_id,
        firstName: row.firstName,
        lastName: row.lastName,
        username: row.username,
        roles: (row.roles || []) as StudentRole[],
        passwordHash: row.passwordHash || undefined,
        mustChangePassword: row.mustChangePassword,
      });
      membersMap.set(row.group_id, list);
    }

    return groupsRes.rows.map(g => ({
      id: g.id,
      title: g.title,
      code: g.code || undefined,
      officeId: g.officeId,
      subOfficeId: g.subOfficeId,
      clientNames: clientsMap.get(g.id) || [],
      members: membersMap.get(g.id) || [],
      createdAt: g.createdAt instanceof Date ? g.createdAt.toISOString() : String(g.createdAt),
    }));
  }

  async getAllDeliverables(): Promise<Deliverable[]> {
    const delivRes = await pool.query(`
      SELECT id, name, description, total_possible_points AS "totalPossiblePoints", is_archived AS "isArchived", created_at AS "createdAt"
      FROM deliverables
      ORDER BY created_at
    `);

    const criteriaRes = await pool.query(`
      SELECT 
        rc.id, rc.deliverable_id, rc.name, rc.description, rc.max_points AS "maxPoints", rc.sort_order,
        COALESCE(
          (SELECT json_agg(json_build_object('name', rcl.name, 'percentage', rcl.percentage) ORDER BY rcl.sort_order)
           FROM rubric_criterion_levels rcl
           WHERE rcl.criterion_id = rc.id),
          '[]'::json
        ) AS levels
      FROM rubric_criteria rc
      ORDER BY rc.deliverable_id, rc.sort_order
    `);

    const critMap = new Map<string, RubricCriterion[]>();
    for (const row of criteriaRes.rows) {
      const list = critMap.get(row.deliverable_id) || [];
      list.push({
        id: row.id,
        name: row.name,
        description: row.description,
        maxPoints: Number(row.maxPoints),
        levels: (row.levels || []).map((l: any) => ({ name: l.name, percentage: Number(l.percentage) })),
      });
      critMap.set(row.deliverable_id, list);
    }

    return delivRes.rows.map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      totalPossiblePoints: Number(d.totalPossiblePoints),
      isArchived: d.isArchived,
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
      rubric: critMap.get(d.id) || [],
    }));
  }

  async getAllTasks(): Promise<Task[]> {
    const tasksRes = await pool.query(`
      SELECT 
        id, deliverable_id AS "deliverableId", name, instructions, deadline, max_score AS "maxScore",
        late_policy_type AS "latePolicyType", late_deduction_amount AS "lateDeductionAmount", late_max_deduction AS "lateMaxDeduction",
        status, is_revision_task AS "isRevisionTask", is_archived AS "isArchived", created_at AS "createdAt"
      FROM tasks
      ORDER BY deadline, created_at
    `);

    return tasksRes.rows.map(t => ({
      id: t.id,
      deliverableId: t.deliverableId,
      name: t.name,
      instructions: t.instructions,
      deadline: t.deadline,
      maxScore: Number(t.maxScore),
      latePolicy: {
        type: t.latePolicyType,
        deductionAmount: Number(t.lateDeductionAmount),
        maxDeduction: t.lateMaxDeduction !== null ? Number(t.lateMaxDeduction) : undefined,
      },
      status: t.status,
      isRevisionTask: t.isRevisionTask,
      isArchived: t.isArchived,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
    }));
  }

  async getAllSubmissions(): Promise<GroupTaskSubmission[]> {
    const subsRes = await pool.query(`
      SELECT 
        id, group_id AS "groupId", task_id AS "taskId", deliverable_id AS "deliverableId",
        status, current_version AS "currentVersion", submitted_at AS "submittedAt"
      FROM submissions
      ORDER BY created_at
    `);

    const versionsRes = await pool.query(`
      SELECT 
        sv.id, sv.submission_id, sv.version_number AS "version", sv.submitted_at AS "submittedAt",
        sv.submitted_by_member_id AS "submittedByMemberId", sv.submitted_by_name AS "submittedByName",
        sv.file_name AS "fileName", sv.file_size AS "fileSize", sv.file_key AS "fileKey",
        sv.file_data_url AS "fileDataUrl", sv.remarks,
        COALESCE(
          (SELECT json_agg(json_build_object(
             'id', rr.id,
             'instructorComment', rr.instructor_comment,
             'pageOrSection', rr.page_or_section,
             'changeDescription', rr.change_description
           ) ORDER BY rr.id)
           FROM revision_responses rr
           WHERE rr.submission_version_id = sv.id),
          '[]'::json
        ) AS "revisionResponses"
      FROM submission_versions sv
      ORDER BY sv.submission_id, sv.version_number
    `);

    const versionsMap = new Map<string, SubmissionVersion[]>();
    for (const v of versionsRes.rows) {
      const list = versionsMap.get(v.submission_id) || [];
      list.push({
        version: v.version,
        submittedAt: v.submittedAt instanceof Date ? v.submittedAt.toISOString() : String(v.submittedAt),
        submittedByMemberId: v.submittedByMemberId || '',
        submittedByName: v.submittedByName,
        fileName: v.fileName,
        fileSize: Number(v.fileSize),
        fileDataUrl: v.fileDataUrl || undefined,
        remarks: v.remarks || undefined,
        revisionResponses: (v.revisionResponses && v.revisionResponses.length > 0) ? v.revisionResponses : undefined,
      });
      versionsMap.set(v.submission_id, list);
    }

    const annotRes = await pool.query(`
      SELECT 
        id, submission_id, version_number AS "version", page_number AS "pageNumber",
        x, y, width, height, comment, author_name AS "authorName", created_at AS "createdAt"
      FROM submission_annotations
      ORDER BY submission_id, version_number, page_number
    `);
    const annotMap = new Map<string, DocumentAnnotation[]>();
    for (const a of annotRes.rows) {
      const list = annotMap.get(a.submission_id) || [];
      list.push({
        id: a.id,
        submissionId: a.submission_id,
        version: a.version,
        pageNumber: a.pageNumber,
        x: Number(a.x),
        y: Number(a.y),
        width: a.width !== null ? Number(a.width) : undefined,
        height: a.height !== null ? Number(a.height) : undefined,
        comment: a.comment,
        authorName: a.authorName,
        createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
      });
      annotMap.set(a.submission_id, list);
    }

    const gradesRes = await pool.query(`
      SELECT 
        sg.id, sg.submission_id, sg.rubric_raw_score AS "rubricRawScore", sg.rubric_max_score AS "rubricMaxScore",
        sg.task_raw_score AS "taskRawScore", sg.late_deduction AS "lateDeduction", sg.days_late AS "daysLate",
        sg.final_score AS "finalScore", sg.overall_remarks AS "overallRemarks", sg.graded_at AS "gradedAt",
        sg.is_returned AS "isReturned", sg.returned_at AS "returnedAt", sg.last_edited_at AS "lastEditedAt",
        sg.frozen_rubric_json,
        COALESCE(
          (SELECT json_agg(json_build_object(
             'criterionId', ca.criterion_id,
             'levelName', ca.level_name,
             'percentage', ca.percentage,
             'score', ca.score,
             'maxPoints', ca.max_points
           ))
           FROM submission_grade_criterion_assessments ca
           WHERE ca.grade_id = sg.id),
          '[]'::json
        ) AS assessments
      FROM submission_grades sg
    `);

    const gradesMap = new Map<string, SubmissionGrade>();
    for (const g of gradesRes.rows) {
      const assessmentsObj: Record<string, CriterionAssessment> = {};
      for (const item of (g.assessments || [])) {
        assessmentsObj[item.criterionId] = {
          criterionId: item.criterionId,
          levelName: item.levelName,
          percentage: Number(item.percentage),
          score: Number(item.score),
          maxPoints: Number(item.maxPoints),
        };
      }

      let frozenRubric: RubricCriterion[] = [];
      if (g.frozen_rubric_json) {
        try { frozenRubric = JSON.parse(g.frozen_rubric_json); } catch {}
      }

      gradesMap.set(g.submission_id, {
        criterionAssessments: assessmentsObj,
        rubricRawScore: Number(g.rubricRawScore),
        rubricMaxScore: Number(g.rubricMaxScore),
        taskRawScore: Number(g.taskRawScore),
        lateDeduction: Number(g.lateDeduction),
        daysLate: Number(g.daysLate),
        finalScore: Number(g.finalScore),
        overallRemarks: g.overallRemarks,
        gradedAt: g.gradedAt instanceof Date ? g.gradedAt.toISOString() : String(g.gradedAt),
        isReturned: g.isReturned,
        returnedAt: g.returnedAt ? (g.returnedAt instanceof Date ? g.returnedAt.toISOString() : String(g.returnedAt)) : undefined,
        lastEditedAt: g.lastEditedAt ? (g.lastEditedAt instanceof Date ? g.lastEditedAt.toISOString() : String(g.lastEditedAt)) : undefined,
        frozenRubric,
      });
    }

    return subsRes.rows.map(s => ({
      id: s.id,
      groupId: s.groupId,
      taskId: s.taskId,
      deliverableId: s.deliverableId,
      status: s.status,
      currentVersion: s.currentVersion,
      submittedAt: s.submittedAt ? (s.submittedAt instanceof Date ? s.submittedAt.toISOString() : String(s.submittedAt)) : undefined,
      versions: versionsMap.get(s.id) || [],
      annotations: annotMap.get(s.id) || [],
      grade: gradesMap.get(s.id),
    }));
  }

  async getAllDefenseAttempts(): Promise<DefenseAttempt[]> {
    const attemptsRes = await pool.query(`
      SELECT 
        da.id, da.group_id AS "groupId", da.attempt_number AS "attemptNumber",
        da.previous_attempt_id AS "previousAttemptId", da.defense_date AS "defenseDate",
        da.defense_time AS "defenseTime", da.venue, da.lead_panel_id AS "leadPanelId",
        da.status, da.created_at AS "createdAt",
        COALESCE(
          (SELECT json_agg(pm.panel_user_id ORDER BY pm.sort_order)
           FROM defense_attempt_panel_members pm
           WHERE pm.defense_attempt_id = da.id),
          '[]'::json
        ) AS "panelMemberIds"
      FROM defense_attempts da
      ORDER BY da.defense_date, da.defense_time
    `);

    const presRes = await pool.query(`
      SELECT 
        pe.id, pe.defense_attempt_id, pe.panel_user_id, pe.panel_member_name, pe.evaluated_at,
        pe.clarity_of_presentation, pe.understanding_of_project, pe.engagement_and_communication,
        pe.use_of_visual_aids, pe.handling_of_qa, pe.team_collaboration, pe.time_management,
        pe.professionalism_and_confidence, pe.total_group_score, pe.average_group_score, pe.comments,
        COALESCE(
          (SELECT json_agg(json_build_object('studentId', pir.student_id, 'studentName', pir.student_name, 'rate', pir.rate))
           FROM presentation_individual_ratings pir
           WHERE pir.presentation_evaluation_id = pe.id),
          '[]'::json
        ) AS "individualRatings"
      FROM presentation_evaluations pe
    `);
    const presMap = new Map<string, Record<string, PresentationEvaluation>>();
    for (const row of presRes.rows) {
      const attemptMap = presMap.get(row.defense_attempt_id) || {};
      attemptMap[row.panel_user_id] = {
        panelMemberId: row.panel_user_id,
        panelMemberName: row.panel_member_name,
        evaluatedAt: row.evaluated_at instanceof Date ? row.evaluated_at.toISOString() : String(row.evaluated_at),
        groupRating: {
          clarityOfPresentation: row.clarity_of_presentation,
          understandingOfProject: row.understanding_of_project,
          engagementAndCommunication: row.engagement_and_communication,
          useOfVisualAids: row.use_of_visual_aids,
          handlingOfQA: row.handling_of_qa,
          teamCollaboration: row.team_collaboration,
          timeManagement: row.time_management,
          professionalismAndConfidence: row.professionalism_and_confidence,
        },
        individualRatings: (row.individualRatings || []).map((ir: any) => ({
          studentId: ir.studentId,
          studentName: ir.studentName,
          rate: Number(ir.rate),
        })),
        totalGroupScore: Number(row.total_group_score),
        averageGroupScore: Number(row.average_group_score),
        comments: row.comments || undefined,
      };
      presMap.set(row.defense_attempt_id, attemptMap);
    }

    const manuRes = await pool.query(`
      SELECT 
        me.id, me.defense_attempt_id, me.panel_user_id, me.panel_member_name, me.evaluated_at,
        me.total_score, me.average_score, me.overall_remarks,
        COALESCE(
          (SELECT json_agg(json_build_object('itemId', mir.item_id, 'rate', mir.rate, 'comment', mir.comment))
           FROM manuscript_item_ratings mir
           WHERE mir.manuscript_evaluation_id = me.id),
          '[]'::json
        ) AS items
      FROM manuscript_evaluations me
    `);
    const manuMap = new Map<string, Record<string, ManuscriptEvaluation>>();
    for (const row of manuRes.rows) {
      const attemptMap = manuMap.get(row.defense_attempt_id) || {};
      const ratingsObj: Record<string, { itemId: string; rate: number; comment?: string }> = {};
      for (const item of (row.items || [])) {
        ratingsObj[item.itemId] = {
          itemId: item.itemId,
          rate: Number(item.rate),
          comment: item.comment || undefined,
        };
      }

      attemptMap[row.panel_user_id] = {
        panelMemberId: row.panel_user_id,
        panelMemberName: row.panel_member_name,
        evaluatedAt: row.evaluated_at instanceof Date ? row.evaluated_at.toISOString() : String(row.evaluated_at),
        ratings: ratingsObj,
        totalScore: Number(row.total_score),
        averageScore: Number(row.average_score),
        overallRemarks: row.overall_remarks || undefined,
      };
      manuMap.set(row.defense_attempt_id, attemptMap);
    }

    const reportRes = await pool.query(`
      SELECT 
        dr.id, dr.defense_attempt_id, dr.lead_panel_id, dr.lead_panel_name,
        dr.degree_sought, dr.venue_or_place, dr.decision, dr.conditions_or_remarks,
        dr.updated_at, dr.last_signatures_invalidated_at,
        COALESCE(
          (SELECT json_object_agg(ca.panel_member_id, ca.action)
           FROM defense_report_committee_actions ca
           WHERE ca.defense_report_id = dr.id),
          '{}'::json
        ) AS "committeeActions",
        COALESCE(
          (SELECT json_agg(json_build_object(
             'panelMemberId', sig.panel_member_id,
             'panelMemberName', sig.panel_member_name,
             'signedAt', sig.signed_at,
             'signatureDataUrl', sig.signature_data_url,
             'isLeadPanel', sig.is_lead_panel
           ))
           FROM defense_report_signatures sig
           WHERE sig.defense_report_id = dr.id),
          '[]'::json
        ) AS signatures
      FROM defense_reports dr
    `);
    const reportMap = new Map<string, DefenseReportProposal>();
    for (const row of reportRes.rows) {
      reportMap.set(row.defense_attempt_id, {
        leadPanelId: row.lead_panel_id || '',
        leadPanelName: row.lead_panel_name,
        degreeSought: row.degree_sought,
        venueOrPlace: row.venue_or_place,
        decision: row.decision,
        conditionsOrRemarks: row.conditions_or_remarks,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
        lastSignaturesInvalidatedAt: row.last_signatures_invalidated_at ? (row.last_signatures_invalidated_at instanceof Date ? row.last_signatures_invalidated_at.toISOString() : String(row.last_signatures_invalidated_at)) : undefined,
        committeeActions: (row.committeeActions || {}) as Record<string, CommitteeAction>,
        signatures: (row.signatures || []).map((s: any) => ({
          panelMemberId: s.panelMemberId,
          panelMemberName: s.panelMemberName,
          signedAt: s.signedAt instanceof Date ? s.signedAt.toISOString() : String(s.signedAt),
          signatureDataUrl: s.signatureDataUrl || undefined,
          isLeadPanel: Boolean(s.isLeadPanel),
        })),
      });
    }

    return attemptsRes.rows.map(da => ({
      id: da.id,
      groupId: da.groupId,
      attemptNumber: da.attemptNumber,
      previousAttemptId: da.previousAttemptId || undefined,
      defenseDate: da.defenseDate,
      defenseTime: da.defenseTime,
      venue: da.venue,
      panelMemberIds: da.panelMemberIds || [],
      leadPanelId: da.leadPanelId || '',
      status: da.status,
      createdAt: da.createdAt instanceof Date ? da.createdAt.toISOString() : String(da.createdAt),
      presentationEvaluations: presMap.get(da.id) || {},
      manuscriptEvaluations: manuMap.get(da.id) || {},
      report: reportMap.get(da.id),
    }));
  }

  async getStoredFile(key: string): Promise<{ dataUrl: string; fileName: string } | null> {
    const res = await pool.query('SELECT data_url AS "dataUrl", file_name AS "fileName" FROM stored_files WHERE key = $1', [key]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async saveStoredFile(key: string, dataUrl: string, fileName: string): Promise<void> {
    await pool.query(`
      INSERT INTO stored_files (key, file_name, data_url, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (key) DO UPDATE SET
        file_name = EXCLUDED.file_name,
        data_url = EXCLUDED.data_url
    `, [key, fileName, dataUrl]);
  }

  async getStateRevision(): Promise<number> {
    const res = await pool.query("SELECT value FROM app_meta WHERE key = 'state_revision'");
    if (res.rows.length === 0) return 0;
    return parseInt(res.rows[0].value, 10) || 0;
  }

  async saveFullDataset(dataset: {
    offices: Office[];
    groups: Group[];
    deliverables: Deliverable[];
    tasks: Task[];
    submissions: GroupTaskSubmission[];
    accounts: UserAccount[];
    defenseAttempts: DefenseAttempt[];
  }, expectedRevision?: number): Promise<number> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const revRes = await client.query("SELECT value FROM app_meta WHERE key = 'state_revision'");
      const currentRev = revRes.rows.length > 0 ? (parseInt(revRes.rows[0].value, 10) || 0) : 0;
      if (expectedRevision !== undefined && expectedRevision !== currentRev) {
        throw new Error('Data changed in another session. Please refresh.');
      }
      const nextRev = currentRev + 1;

      // 1. Sync Offices and SubOffices
      const officeIds = dataset.offices.map(o => o.id);
      if (officeIds.length > 0) {
        await client.query('DELETE FROM offices WHERE id NOT IN (' + officeIds.map((_, i) => '$' + (i + 1)).join(',') + ')', officeIds);
      } else {
        await client.query('DELETE FROM offices');
      }

      for (const off of dataset.offices) {
        await client.query(`
          INSERT INTO offices (id, name, code)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code
        `, [off.id, off.name, off.code]);

        const subIds = (off.subOffices || []).map(s => s.id);
        if (subIds.length > 0) {
          await client.query('DELETE FROM sub_offices WHERE office_id = $1 AND id NOT IN (' + subIds.map((_, i) => '$' + (i + 2)).join(',') + ')', [off.id, ...subIds]);
        } else {
          await client.query('DELETE FROM sub_offices WHERE office_id = $1', [off.id]);
        }

        for (const sub of (off.subOffices || [])) {
          await client.query(`
            INSERT INTO sub_offices (id, office_id, name, code)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code
          `, [sub.id, off.id, sub.name, sub.code]);
        }
      }

      // 2. Sync Users / Accounts
      const allUsersMap = new Map<string, UserAccount>();
      for (const acc of dataset.accounts) {
        allUsersMap.set(acc.id, acc);
      }
      for (const grp of dataset.groups) {
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
          } else {
            const existing = allUsersMap.get(mem.id)!;
            existing.groupId = grp.id;
            existing.studentRoles = mem.roles;
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
            password_hash = CASE 
              WHEN EXCLUDED.must_change_password = true AND EXCLUDED.password_hash IS NULL THEN NULL 
              ELSE COALESCE(EXCLUDED.password_hash, users.password_hash) 
            END,
            must_change_password = EXCLUDED.must_change_password,
            academic_title = EXCLUDED.academic_title,
            academic_rank = EXCLUDED.academic_rank,
            avatar_url = EXCLUDED.avatar_url,
            updated_at = NOW()
        `, [
          u.id,
          u.username.toLowerCase(),
          u.firstName,
          u.lastName,
          u.role,
          u.passwordHash || null,
          u.mustChangePassword ?? false,
          u.academicTitle || null,
          u.academicRank || null,
          u.avatarUrl || null,
        ]);
      }

      // 3. Sync Groups, Clients, Members, Roles
      const groupIds = dataset.groups.map(g => g.id);
      if (groupIds.length > 0) {
        await client.query('DELETE FROM groups WHERE id NOT IN (' + groupIds.map((_, i) => '$' + (i + 1)).join(',') + ')', groupIds);
      } else {
        await client.query('DELETE FROM groups');
      }

      for (const grp of dataset.groups) {
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
          await client.query(`
            INSERT INTO group_clients (group_id, client_name, sort_order)
            VALUES ($1, $2, $3)
          `, [grp.id, grp.clientNames[i], i]);
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
            await client.query(`
              INSERT INTO group_member_roles (group_member_id, role_name)
              VALUES ($1, $2)
              ON CONFLICT (group_member_id, role_name) DO NOTHING
            `, [groupMemberId, role]);
          }
        }
      }

      // 4. Sync Deliverables & Rubrics
      const delivIds = dataset.deliverables.map(d => d.id);
      if (delivIds.length > 0) {
        await client.query('DELETE FROM deliverables WHERE id NOT IN (' + delivIds.map((_, i) => '$' + (i + 1)).join(',') + ')', delivIds);
      } else {
        await client.query('DELETE FROM deliverables');
      }

      for (const d of dataset.deliverables) {
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
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              max_points = EXCLUDED.max_points,
              sort_order = EXCLUDED.sort_order
          `, [crit.id, d.id, crit.name, crit.description || '', crit.maxPoints, i]);

          await client.query('DELETE FROM rubric_criterion_levels WHERE criterion_id = $1', [crit.id]);
          for (let j = 0; j < (crit.levels || []).length; j++) {
            const lvl = crit.levels[j];
            await client.query(`
              INSERT INTO rubric_criterion_levels (criterion_id, name, percentage, sort_order)
              VALUES ($1, $2, $3, $4)
            `, [crit.id, lvl.name, lvl.percentage, j]);
          }
        }
      }

      // 5. Sync Tasks
      const taskIds = dataset.tasks.map(t => t.id);
      if (taskIds.length > 0) {
        await client.query('DELETE FROM tasks WHERE id NOT IN (' + taskIds.map((_, i) => '$' + (i + 1)).join(',') + ')', taskIds);
      } else {
        await client.query('DELETE FROM tasks');
      }

      for (const t of dataset.tasks) {
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

      // 6. Sync Submissions, Versions, Annotations, Grades
      // Deduplicate submissions by (groupId, taskId) to satisfy uq_group_task_submission
      const deduplicatedSubs: GroupTaskSubmission[] = [];
      const seenGroupTask = new Set<string>();
      for (let i = dataset.submissions.length - 1; i >= 0; i--) {
        const s = dataset.submissions[i];
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
        // Clear any conflicting row with matching (group_id, task_id) but different id
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
            await client.query(`
              INSERT INTO submission_grade_criterion_assessments (grade_id, criterion_id, level_name, percentage, score, max_points)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [gradeId, critId, ca.levelName, ca.percentage, ca.score, ca.maxPoints]);
          }
        }
      }

      // 7. Sync Defense Attempts, Evaluations, Reports
      const daIds = dataset.defenseAttempts.map(d => d.id);
      if (daIds.length > 0) {
        await client.query('DELETE FROM defense_attempts WHERE id NOT IN (' + daIds.map((_, i) => '$' + (i + 1)).join(',') + ')', daIds);
      } else {
        await client.query('DELETE FROM defense_attempts');
      }

      for (const da of dataset.defenseAttempts) {
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
          await client.query(`
            INSERT INTO defense_attempt_panel_members (defense_attempt_id, panel_user_id, sort_order)
            VALUES ($1, $2, $3)
            ON CONFLICT (defense_attempt_id, panel_user_id) DO NOTHING
          `, [da.id, da.panelMemberIds[i], i]);
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
            await client.query(`
              INSERT INTO presentation_individual_ratings (presentation_evaluation_id, student_id, student_name, rate)
              VALUES ($1, $2, $3, $4)
            `, [peId, ir.studentId, ir.studentName, ir.rate]);
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
            await client.query(`
              INSERT INTO manuscript_item_ratings (manuscript_evaluation_id, item_id, rate, comment)
              VALUES ($1, $2, $3, $4)
            `, [meId, itemId, rating.rate, rating.comment || null]);
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
            await client.query(`
              INSERT INTO defense_report_committee_actions (defense_report_id, panel_member_id, action)
              VALUES ($1, $2, $3)
            `, [drId, panelId, action]);
          }

          for (const sig of (rep.signatures || [])) {
            await client.query(`
              INSERT INTO defense_report_signatures (defense_report_id, panel_member_id, panel_member_name, signed_at, signature_data_url, is_lead_panel)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [drId, sig.panelMemberId, sig.panelMemberName, sig.signedAt, sig.signatureDataUrl || null, sig.isLeadPanel]);
          }
        }
      }

      await client.query(`
        INSERT INTO app_meta (key, value, updated_at)
        VALUES ('state_revision', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [String(nextRev)]);

      await client.query('COMMIT');
      return nextRev;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteRevisionResponsesBySubmission(submissionId: string): Promise<void> {
    await pool.query(
      `DELETE FROM revision_responses WHERE submission_version_id IN (
         SELECT id FROM submission_versions WHERE submission_id = $1
       )`,
      [submissionId]
    );
  }

  async deleteSubmissionById(submissionId: string): Promise<void> {
    await pool.query(`DELETE FROM submissions WHERE id = $1`, [submissionId]);
  }

  async unsubmitSubmission(submissionId: string): Promise<void> {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM submission_versions WHERE submission_id = $1`, [submissionId]);
      await client.query(`DELETE FROM submission_annotations WHERE submission_id = $1`, [submissionId]);
      await client.query(`DELETE FROM submission_grades WHERE submission_id = $1`, [submissionId]);
      await client.query(
        `UPDATE submissions SET status = 'not_submitted', current_version = 0, submitted_at = NULL, updated_at = NOW() WHERE id = $1`,
        [submissionId]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async deleteTaskById(taskId: string): Promise<number> {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      // PostgreSQL CASCADE foreign keys automatically delete from submissions,
      // submission_versions, revision_responses, submission_annotations, and submission_grades.
      await client.query(`DELETE FROM tasks WHERE id = $1`, [taskId]);

      const revRes = await client.query("SELECT value FROM app_meta WHERE key = 'state_revision'");
      const currentRev = revRes.rows.length > 0 ? (parseInt(revRes.rows[0].value, 10) || 0) : 0;
      const nextRev = currentRev + 1;
      await client.query(
        "INSERT INTO app_meta (key, value) VALUES ('state_revision', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
        [String(nextRev)]
      );

      await client.query('COMMIT');
      return nextRev;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async deleteDefenseAttemptById(attemptId: string): Promise<number> {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      // PostgreSQL CASCADE foreign keys automatically delete from defense_attempt_panel_members,
      // presentation_evaluations, presentation_individual_ratings, manuscript_evaluations,
      // manuscript_item_ratings, defense_reports, defense_report_committee_actions, and defense_report_signatures.
      await client.query(`DELETE FROM defense_attempts WHERE id = $1`, [attemptId]);

      const revRes = await client.query("SELECT value FROM app_meta WHERE key = 'state_revision'");
      const currentRev = revRes.rows.length > 0 ? (parseInt(revRes.rows[0].value, 10) || 0) : 0;
      const nextRev = currentRev + 1;
      await client.query(
        "INSERT INTO app_meta (key, value) VALUES ('state_revision', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
        [String(nextRev)]
      );

      await client.query('COMMIT');
      return nextRev;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

export const dbRepository = new DbRepository();
