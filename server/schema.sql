-- Capstone Proposal Management System - Relational 3rd Normal Form (3NF) Database Schema
-- DBMS: PostgreSQL

CREATE TABLE IF NOT EXISTS offices (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sub_offices (
  id VARCHAR(64) PRIMARY KEY,
  office_id VARCHAR(64) NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_offices_office_id ON sub_offices(office_id);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('instructor', 'panel', 'student')),
  password_hash TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  academic_title VARCHAR(50),
  academic_rank VARCHAR(200),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));

CREATE TABLE IF NOT EXISTS groups (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  office_id VARCHAR(64) NOT NULL REFERENCES offices(id) ON DELETE RESTRICT,
  sub_office_id VARCHAR(64) NOT NULL REFERENCES sub_offices(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_groups_office ON groups(office_id);
CREATE INDEX IF NOT EXISTS idx_groups_sub_office ON groups(sub_office_id);

CREATE TABLE IF NOT EXISTS group_clients (
  id SERIAL PRIMARY KEY,
  group_id VARCHAR(64) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  client_name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_group_clients_group ON group_clients(group_id);

CREATE TABLE IF NOT EXISTS group_members (
  id VARCHAR(64) PRIMARY KEY,
  group_id VARCHAR(64) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_group_member UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

CREATE TABLE IF NOT EXISTS group_member_roles (
  id SERIAL PRIMARY KEY,
  group_member_id VARCHAR(64) NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL CHECK (role_name IN ('Project Manager', 'Systems Analyst', 'Programmer')),
  CONSTRAINT uq_group_member_role UNIQUE (group_member_id, role_name)
);
CREATE INDEX IF NOT EXISTS idx_member_roles ON group_member_roles(group_member_id);

CREATE TABLE IF NOT EXISTS deliverables (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  total_possible_points NUMERIC(10, 2) NOT NULL DEFAULT 100,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rubric_criteria (
  id VARCHAR(64) PRIMARY KEY,
  deliverable_id VARCHAR(64) NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  max_points NUMERIC(10, 2) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_deliverable ON rubric_criteria(deliverable_id);

CREATE TABLE IF NOT EXISTS rubric_criterion_levels (
  id SERIAL PRIMARY KEY,
  criterion_id VARCHAR(64) NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  percentage NUMERIC(5, 4) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_criterion_levels ON rubric_criterion_levels(criterion_id);

CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(64) PRIMARY KEY,
  deliverable_id VARCHAR(64) NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  deadline VARCHAR(50) NOT NULL,
  max_score NUMERIC(10, 2) NOT NULL DEFAULT 100,
  late_policy_type VARCHAR(20) NOT NULL CHECK (late_policy_type IN ('none', 'fixed', 'per_day')),
  late_deduction_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  late_max_deduction NUMERIC(10, 2),
  status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'published')),
  is_revision_task BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_deliverable ON tasks(deliverable_id);

CREATE TABLE IF NOT EXISTS submissions (
  id VARCHAR(64) PRIMARY KEY,
  group_id VARCHAR(64) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  task_id VARCHAR(64) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  deliverable_id VARCHAR(64) NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL CHECK (status IN ('not_submitted', 'submitted', 'graded_awaiting_return', 'returned')),
  current_version INT NOT NULL DEFAULT 1,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_group_task_submission UNIQUE (group_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_submissions_group ON submissions(group_id);
CREATE INDEX IF NOT EXISTS idx_submissions_task ON submissions(task_id);

CREATE TABLE IF NOT EXISTS submission_versions (
  id SERIAL PRIMARY KEY,
  submission_id VARCHAR(64) NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  submitted_by_member_id VARCHAR(64),
  submitted_by_name VARCHAR(200) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  file_key VARCHAR(255),
  file_data_url TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_sub_version UNIQUE (submission_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_sub_versions ON submission_versions(submission_id);

CREATE TABLE IF NOT EXISTS revision_responses (
  id VARCHAR(64) PRIMARY KEY,
  submission_version_id INT NOT NULL REFERENCES submission_versions(id) ON DELETE CASCADE,
  instructor_comment TEXT NOT NULL,
  page_or_section VARCHAR(100) NOT NULL,
  change_description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_revision_responses_version ON revision_responses(submission_version_id);

CREATE TABLE IF NOT EXISTS submission_annotations (
  id VARCHAR(64) PRIMARY KEY,
  submission_id VARCHAR(64) NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  page_number INT NOT NULL,
  x NUMERIC(6, 2) NOT NULL,
  y NUMERIC(6, 2) NOT NULL,
  width NUMERIC(6, 2),
  height NUMERIC(6, 2),
  comment TEXT NOT NULL,
  author_name VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_submission_annotations_sub ON submission_annotations(submission_id);

CREATE TABLE IF NOT EXISTS submission_grades (
  id SERIAL PRIMARY KEY,
  submission_id VARCHAR(64) NOT NULL REFERENCES submissions(id) ON DELETE CASCADE UNIQUE,
  rubric_raw_score NUMERIC(10, 2) NOT NULL DEFAULT 0,
  rubric_max_score NUMERIC(10, 2) NOT NULL DEFAULT 0,
  task_raw_score NUMERIC(10, 2) NOT NULL DEFAULT 0,
  late_deduction NUMERIC(10, 2) NOT NULL DEFAULT 0,
  days_late INT NOT NULL DEFAULT 0,
  final_score NUMERIC(10, 2) NOT NULL DEFAULT 0,
  overall_remarks TEXT NOT NULL DEFAULT '',
  graded_at TIMESTAMPTZ NOT NULL,
  is_returned BOOLEAN NOT NULL DEFAULT FALSE,
  returned_at TIMESTAMPTZ,
  last_edited_at TIMESTAMPTZ,
  frozen_rubric_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_submission_grades_sub ON submission_grades(submission_id);

CREATE TABLE IF NOT EXISTS submission_grade_criterion_assessments (
  id SERIAL PRIMARY KEY,
  grade_id INT NOT NULL REFERENCES submission_grades(id) ON DELETE CASCADE,
  criterion_id VARCHAR(64) NOT NULL,
  level_name VARCHAR(100) NOT NULL,
  percentage NUMERIC(5, 4) NOT NULL,
  score NUMERIC(10, 2) NOT NULL,
  max_points NUMERIC(10, 2) NOT NULL,
  CONSTRAINT uq_sub_grade_criterion UNIQUE (grade_id, criterion_id)
);
CREATE INDEX IF NOT EXISTS idx_grade_criteria ON submission_grade_criterion_assessments(grade_id);

CREATE TABLE IF NOT EXISTS defense_attempts (
  id VARCHAR(64) PRIMARY KEY,
  group_id VARCHAR(64) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL DEFAULT 1,
  previous_attempt_id VARCHAR(64) REFERENCES defense_attempts(id) ON DELETE SET NULL,
  defense_date VARCHAR(20) NOT NULL,
  defense_time VARCHAR(20) NOT NULL,
  venue VARCHAR(200) NOT NULL,
  lead_panel_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('scheduled', 'evaluating', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_defense_attempts_group ON defense_attempts(group_id);

CREATE TABLE IF NOT EXISTS defense_attempt_panel_members (
  id SERIAL PRIMARY KEY,
  defense_attempt_id VARCHAR(64) NOT NULL REFERENCES defense_attempts(id) ON DELETE CASCADE,
  panel_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT uq_defense_panel_member UNIQUE (defense_attempt_id, panel_user_id)
);
CREATE INDEX IF NOT EXISTS idx_defense_panel_members ON defense_attempt_panel_members(defense_attempt_id);

CREATE TABLE IF NOT EXISTS presentation_evaluations (
  id SERIAL PRIMARY KEY,
  defense_attempt_id VARCHAR(64) NOT NULL REFERENCES defense_attempts(id) ON DELETE CASCADE,
  panel_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  panel_member_name VARCHAR(200) NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL,
  clarity_of_presentation INT NOT NULL DEFAULT 1,
  understanding_of_project INT NOT NULL DEFAULT 1,
  engagement_and_communication INT NOT NULL DEFAULT 1,
  use_of_visual_aids INT NOT NULL DEFAULT 1,
  handling_of_qa INT NOT NULL DEFAULT 1,
  team_collaboration INT NOT NULL DEFAULT 1,
  time_management INT NOT NULL DEFAULT 1,
  professionalism_and_confidence INT NOT NULL DEFAULT 1,
  total_group_score NUMERIC(10, 2) NOT NULL DEFAULT 0,
  average_group_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  comments TEXT,
  CONSTRAINT uq_presentation_eval UNIQUE (defense_attempt_id, panel_user_id)
);
CREATE INDEX IF NOT EXISTS idx_pres_eval_attempt ON presentation_evaluations(defense_attempt_id);

CREATE TABLE IF NOT EXISTS presentation_individual_ratings (
  id SERIAL PRIMARY KEY,
  presentation_evaluation_id INT NOT NULL REFERENCES presentation_evaluations(id) ON DELETE CASCADE,
  student_id VARCHAR(64) NOT NULL,
  student_name VARCHAR(200) NOT NULL,
  rate INT NOT NULL DEFAULT 1,
  CONSTRAINT uq_pres_indiv_student UNIQUE (presentation_evaluation_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_pres_indiv_eval ON presentation_individual_ratings(presentation_evaluation_id);

CREATE TABLE IF NOT EXISTS manuscript_evaluations (
  id SERIAL PRIMARY KEY,
  defense_attempt_id VARCHAR(64) NOT NULL REFERENCES defense_attempts(id) ON DELETE CASCADE,
  panel_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  panel_member_name VARCHAR(200) NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL,
  total_score NUMERIC(10, 2) NOT NULL DEFAULT 0,
  average_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  overall_remarks TEXT,
  CONSTRAINT uq_manuscript_eval UNIQUE (defense_attempt_id, panel_user_id)
);
CREATE INDEX IF NOT EXISTS idx_manu_eval_attempt ON manuscript_evaluations(defense_attempt_id);

CREATE TABLE IF NOT EXISTS manuscript_item_ratings (
  id SERIAL PRIMARY KEY,
  manuscript_evaluation_id INT NOT NULL REFERENCES manuscript_evaluations(id) ON DELETE CASCADE,
  item_id VARCHAR(50) NOT NULL,
  rate INT NOT NULL DEFAULT 1,
  comment TEXT,
  CONSTRAINT uq_manuscript_item_rating UNIQUE (manuscript_evaluation_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_manu_item_ratings ON manuscript_item_ratings(manuscript_evaluation_id);

CREATE TABLE IF NOT EXISTS defense_reports (
  id SERIAL PRIMARY KEY,
  defense_attempt_id VARCHAR(64) NOT NULL REFERENCES defense_attempts(id) ON DELETE CASCADE UNIQUE,
  lead_panel_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  lead_panel_name VARCHAR(200) NOT NULL,
  degree_sought VARCHAR(255) NOT NULL DEFAULT 'Bachelor of Science in Information Technology',
  venue_or_place VARCHAR(255) NOT NULL,
  decision VARCHAR(50) NOT NULL CHECK (decision IN ('Passed', 'Provisionally Passed', 'Re-defense', 'Failed')),
  conditions_or_remarks TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_signatures_invalidated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_defense_reports_attempt ON defense_reports(defense_attempt_id);

CREATE TABLE IF NOT EXISTS defense_report_committee_actions (
  id SERIAL PRIMARY KEY,
  defense_report_id INT NOT NULL REFERENCES defense_reports(id) ON DELETE CASCADE,
  panel_member_id VARCHAR(64) NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('For Acceptance', 'For Rejection', 'Provisional')),
  CONSTRAINT uq_report_panel_action_item UNIQUE (defense_report_id, panel_member_id)
);
CREATE INDEX IF NOT EXISTS idx_committee_actions ON defense_report_committee_actions(defense_report_id);

CREATE TABLE IF NOT EXISTS defense_report_signatures (
  id SERIAL PRIMARY KEY,
  defense_report_id INT NOT NULL REFERENCES defense_reports(id) ON DELETE CASCADE,
  panel_member_id VARCHAR(64) NOT NULL,
  panel_member_name VARCHAR(200) NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL,
  signature_data_url TEXT,
  is_lead_panel BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uq_report_panel_sig UNIQUE (defense_report_id, panel_member_id)
);
CREATE INDEX IF NOT EXISTS idx_report_signatures ON defense_report_signatures(defense_report_id);

CREATE TABLE IF NOT EXISTS stored_files (
  key VARCHAR(255) PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  data_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_meta (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Performance Optimization Indexes for High-Concurrency Queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_groups_code ON groups(code);
CREATE INDEX IF NOT EXISTS idx_deliverables_archived ON deliverables(is_archived);
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(is_archived);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_deliverable ON submissions(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_submission_versions_sub_ver ON submission_versions(submission_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_submission_annotations_sub_ver ON submission_annotations(submission_id, version_number);
CREATE INDEX IF NOT EXISTS idx_defense_attempts_status ON defense_attempts(status);
CREATE INDEX IF NOT EXISTS idx_defense_attempts_lead ON defense_attempts(lead_panel_id);
CREATE INDEX IF NOT EXISTS idx_defense_panel_user ON defense_attempt_panel_members(panel_user_id);
CREATE INDEX IF NOT EXISTS idx_pres_eval_user ON presentation_evaluations(panel_user_id);
CREATE INDEX IF NOT EXISTS idx_pres_indiv_student ON presentation_individual_ratings(student_id);
CREATE INDEX IF NOT EXISTS idx_manu_eval_user ON manuscript_evaluations(panel_user_id);
CREATE INDEX IF NOT EXISTS idx_defense_reports_lead ON defense_reports(lead_panel_id);
CREATE INDEX IF NOT EXISTS idx_report_actions_panel ON defense_report_committee_actions(panel_member_id);
CREATE INDEX IF NOT EXISTS idx_report_signatures_panel ON defense_report_signatures(panel_member_id);
