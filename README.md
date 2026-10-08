# Capstone Project Onlooker

A local capstone proposal manager for coordinators, students, and defense panels. New installations contain no preloaded accounts, groups, submissions, grades, or panel assignments.

## Start

Requires Node.js 22.12 or later.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:3000** and create your coordinator account. No API key is required.

For the production build:

```sh
npm run build
npm start
```

Use `npm run lint` and `npm test` to check types and persistence, CSV, password, and grading behavior.

## Workflow

1. Add offices and their sub-offices.
2. Create groups and assign student members, including a project manager. The group dialog provides usernames and initial passwords. Usernames follow the `firstname.lastname` format pattern, and initial passwords match the username; users must change them on first login.
3. Create deliverables with rubric criteria, then publish tasks with Philippine-time deadlines.
4. Students sign in and upload an actual PDF (up to 10 MB per file), with revision responses when required. Original document bytes and every version are retained.
5. Coordinators open submissions, view or download the original PDF, add page-referenced comments, grade the rubric, and return assessments. Resubmission clears the preceding assessment so old grades are not mistaken for the new version's grade.
6. Add panel accounts from Oral Defense. Default usernames follow `firstname.lastname` and initial passwords match the username. Assign committees and a lead panel, then schedule defenses. Group and panel conflicts at the same date/time are blocked.
7. Panel members evaluate presentations and manuscripts. The lead panel saves the official decision; assigned panel members can then sign the saved report.

## Full-Stack Architecture & Database

The application is a full-stack Node.js system powered by **PostgreSQL** and **JWT (JSON Web Token)** security:

- **DBMS**: PostgreSQL (`cpms_db`).
- **Relational 3rd Normal Form (3NF)**:
  - Decomposed and normalized entities eliminate data redundancy and transitive dependencies.
  - Dedicated relational tables include:
    - `offices`, `sub_offices`
    - `users` (with username format `firstname.lastname`)
    - `groups`, `group_clients`, `group_members`, `group_member_roles`
    - `deliverables`, `rubric_criteria`, `rubric_criterion_levels`
    - `tasks`
    - `submissions`, `submission_versions`, `revision_responses`, `submission_annotations`, `submission_grades`, `submission_grade_criterion_assessments`
    - `defense_attempts`, `defense_attempt_panel_members`, `presentation_evaluations`, `presentation_individual_ratings`, `manuscript_evaluations`, `manuscript_item_ratings`, `defense_reports`, `defense_report_committee_actions`, `defense_report_signatures`
    - `stored_files` (PDF document storage)
- **Security & Authentication**:
  - Secure JWT authentication with PBKDF2 cryptographic password hashing.
  - Initial coordinator setup and user logins issue signed JWT tokens attached to all API transactions (`Authorization: Bearer <token>`).
  - Role-based authorization (`instructor`, `panel`, `student`).

## Text-file storage and spreadsheet backups

In addition to direct PostgreSQL persistence, spreadsheet compatibility is maintained:
- Use **Settings → Download CSV Files** or **Download Complete CSV Backup** to export spreadsheet-readable `.csv` text files.
- Real-time automatic migrations seed empty PostgreSQL databases from `data/capstone.csv` upon first startup.
