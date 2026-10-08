export type UserRole = 'instructor' | 'panel' | 'student';

export type StudentRole = 'Project Manager' | 'Systems Analyst' | 'Programmer';

export type LatePolicyType = 'none' | 'fixed' | 'per_day';

export type SubmissionStatus = 
  | 'not_submitted' 
  | 'submitted' 
  | 'graded_awaiting_return' 
  | 'returned';

export interface PerformanceLevel {
  name: 'Poor' | 'Fair' | 'Satisfactory' | 'Very Good' | 'Excellent';
  percentage: number; // e.g. 0.10, 0.40, 0.60, 0.80, 1.00
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
  levels: {
    name: string;
    percentage: number;
  }[];
}

export interface SubOffice {
  id: string;
  officeId: string;
  name: string;
  code: string;
}

export interface Office {
  id: string;
  name: string;
  code: string;
  subOffices: SubOffice[];
}

export interface StudentMember {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  roles: StudentRole[];
  passwordHash?: string;
  mustChangePassword?: boolean;
}

export interface Group {
  id: string;
  title: string;
  code?: string;
  officeId: string;
  subOfficeId: string;
  clientNames: string[];
  members: StudentMember[];
  createdAt: string;
}

export interface Deliverable {
  id: string;
  name: string;
  description: string;
  totalPossiblePoints: number;
  rubric: RubricCriterion[];
  isArchived?: boolean;
  createdAt: string;
}

export interface LatePolicy {
  type: LatePolicyType;
  deductionAmount: number; // fixed points or points per day
  maxDeduction?: number;
}

export interface Task {
  id: string;
  deliverableId: string;
  name: string;
  instructions: string;
  deadline: string; // ISO string in Asia/Manila (UTC+8)
  maxScore: number;
  latePolicy: LatePolicy;
  status: 'draft' | 'published';
  isRevisionTask?: boolean;
  isArchived?: boolean;
  createdAt: string;
}

export interface RevisionResponse {
  id: string;
  instructorComment: string;
  pageOrSection: string;
  changeDescription: string;
}

export interface DocumentAnnotation {
  id: string;
  submissionId: string;
  version: number;
  pageNumber: number;
  x: number; // percentage from left (0 to 100)
  y: number; // percentage from top (0 to 100)
  width?: number; // optional selection area
  height?: number;
  comment: string;
  authorName: string;
  createdAt: string;
}

export interface SubmissionVersion {
  version: number;
  submittedAt: string; // ISO string
  submittedByMemberId: string;
  submittedByName: string;
  fileName: string;
  fileSize: number; // in bytes
  fileDataUrl?: string; // base64 or object url
  remarks?: string;
  revisionResponses?: RevisionResponse[];
}

export interface CriterionAssessment {
  criterionId: string;
  levelName: string;
  percentage: number;
  score: number;
  maxPoints: number;
}

export interface SubmissionGrade {
  criterionAssessments: Record<string, CriterionAssessment>;
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
  frozenRubric: RubricCriterion[]; // Snapshot of rubric when graded
}

export interface GroupTaskSubmission {
  id: string;
  groupId: string;
  taskId: string;
  deliverableId: string;
  status: SubmissionStatus;
  currentVersion: number;
  versions: SubmissionVersion[];
  annotations: DocumentAnnotation[];
  grade?: SubmissionGrade;
  submittedAt?: string;
}

export interface UserAccount {
  passwordHash?: string;
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  academicTitle?: string; // e.g. "Dr.", "Prof.", "Engr."
  academicRank?: string; // e.g. "Associate Professor", "Industry Expert"
  groupId?: string; // For student
  studentRoles?: StudentRole[];
  mustChangePassword?: boolean;
  avatarUrl?: string;
}

export type DefenseResult = 'Passed' | 'Provisionally Passed' | 'Re-defense' | 'Failed';

export type CommitteeAction = 'For Acceptance' | 'For Rejection' | 'Provisional';

export interface DefenseSignature {
  panelMemberId: string;
  panelMemberName: string;
  signedAt: string; // ISO string in Asia/Manila (UTC+8)
  signatureDataUrl?: string;
  isLeadPanel: boolean;
}

export interface PresentationGroupRating {
  clarityOfPresentation: number; // 1 to 5
  understandingOfProject: number; // 1 to 5
  engagementAndCommunication: number; // 1 to 5
  useOfVisualAids: number; // 1 to 5
  handlingOfQA: number; // 1 to 5
  teamCollaboration: number; // 1 to 5
  timeManagement: number; // 1 to 5
  professionalismAndConfidence: number; // 1 to 5
}

export interface PresentationIndividualRating {
  studentId: string;
  studentName: string;
  rate: number; // 1 to 5
}

export interface PresentationEvaluation {
  panelMemberId: string;
  panelMemberName: string;
  evaluatedAt: string; // ISO timestamp
  groupRating: PresentationGroupRating;
  individualRatings: PresentationIndividualRating[];
  totalGroupScore: number; // out of 40
  averageGroupScore: number; // out of 5.0
  comments?: string;
}

export interface ManuscriptItemRating {
  itemId: string; // e.g. '1.1', '2.1'
  rate: number; // 1 to 5
  comment?: string;
}

export interface ManuscriptEvaluation {
  panelMemberId: string;
  panelMemberName: string;
  evaluatedAt: string; // ISO timestamp
  ratings: Record<string, ManuscriptItemRating>; // key: itemId
  totalScore: number; // out of 165
  averageScore: number; // out of 5.0
  overallRemarks?: string;
}

export interface DefenseReportProposal {
  leadPanelId: string;
  leadPanelName: string;
  degreeSought: string; // default: "Bachelor of Science in Information Technology"
  venueOrPlace: string;
  committeeActions: Record<string, CommitteeAction>; // panelMemberId -> action
  decision: DefenseResult;
  conditionsOrRemarks: string;
  updatedAt: string;
  signatures: DefenseSignature[];
  lastSignaturesInvalidatedAt?: string;
}

export interface DefenseAttempt {
  id: string;
  groupId: string;
  attemptNumber: number; // 1, 2, 3...
  previousAttemptId?: string; // links to previous attempt if redefense
  defenseDate: string; // YYYY-MM-DD
  defenseTime: string; // HH:mm (24h)
  venue: string; // place of defense
  panelMemberIds: string[]; // assigned panel members
  leadPanelId: string; // designated lead panel
  createdAt: string;
  status: 'scheduled' | 'evaluating' | 'completed';
  presentationEvaluations: Record<string, PresentationEvaluation>; // panelMemberId -> PresentationEvaluation
  manuscriptEvaluations: Record<string, ManuscriptEvaluation>; // panelMemberId -> ManuscriptEvaluation
  report?: DefenseReportProposal;
}

export type CommitteeDecisionType = DefenseResult;
export type CommitteeActionType = CommitteeAction;
