import React, { useState, useEffect } from 'react';
import {
  UserAccount,
  Group,
  Office,
  Deliverable,
  Task,
  GroupTaskSubmission,
  StudentMember,
  DefenseAttempt,
} from './types';
import { storage } from './services/storage';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, ViewTab } from './components/layout/Sidebar';
import { LoginPortalView } from './components/auth/LoginPortalView';
import { ChangePasswordModal } from './components/auth/ChangePasswordModal';
import { SaveStatus } from './components/common/SaveStatus';
import { DocumentViewer } from './components/submission/DocumentViewer';
import { SettingsView } from './components/common/SettingsView';
import { initAutoBackup } from './services/autoBackup';
import { authService } from './services/authService';

// Instructor Views
import { DashboardView as InstructorDashboardView } from './components/instructor/DashboardView';
import { OfficesView } from './components/instructor/OfficesView';
import { GroupsView } from './components/instructor/GroupsView';
import { DeliverablesView } from './components/instructor/DeliverablesView';
import { SubmissionsReviewView } from './components/instructor/SubmissionsReviewView';
import { GradebookView } from './components/instructor/GradebookView';
import { ReportsView } from './components/instructor/ReportsView';
import { DefenseSchedulingView } from './components/instructor/DefenseSchedulingView';

// Panel Views
import { PanelDashboardView } from './components/panel/PanelDashboardView';
import { PanelAccountsView } from './components/panel/PanelAccountsView';

// Student Views
import { StudentDashboardView } from './components/student/StudentDashboardView';
import { StudentGroupView } from './components/student/StudentGroupView';
import { StudentDeliverablesView } from './components/student/StudentDeliverablesView';
import { StudentSubmissionsView } from './components/student/StudentSubmissionsView';
import { StudentFeedbackView } from './components/student/StudentFeedbackView';
import { StudentDefenseView } from './components/student/StudentDefenseView';

export default function App() {
  // Storage state hooks
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => storage.getCurrentUser());
  const [accounts, setAccounts] = useState<UserAccount[]>(() => storage.getAccounts());
  const [offices, setOffices] = useState<Office[]>(() => storage.getOffices());
  const [groups, setGroups] = useState<Group[]>(() => storage.getGroups());
  const [deliverables, setDeliverables] = useState<Deliverable[]>(() => storage.getDeliverables());
  const [tasks, setTasks] = useState<Task[]>(() => storage.getTasks());
  const [submissions, setSubmissions] = useState<GroupTaskSubmission[]>(() => storage.getSubmissions());
  const [defenseAttempts, setDefenseAttempts] = useState<DefenseAttempt[]>(() => storage.getDefenseAttempts());

  // Navigation & UI States
  const [currentTab, setCurrentTab] = useState<ViewTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Document Viewer overlay state
  const [activeViewerSubmissionId, setActiveViewerSubmissionId] = useState<string | null>(null);

  // Student direct upload navigation helper
  const [preselectedTaskIdForSubmission, setPreselectedTaskIdForSubmission] = useState<string | undefined>(undefined);

  // Subscribe to storage changes
  useEffect(() => {
    const unsubscribe = storage.subscribe(() => {
      setCurrentUser(storage.getCurrentUser());
      setAccounts(storage.getAccounts());
      setOffices(storage.getOffices());
      setGroups(storage.getGroups());
      setDeliverables(storage.getDeliverables());
      setTasks(storage.getTasks());
      setSubmissions(storage.getSubmissions());
      setDefenseAttempts(storage.getDefenseAttempts());
    });
    return unsubscribe;
  }, []);

  // Keep the CSV backup folder up to date with every change (if connected).
  useEffect(() => initAutoBackup(), []);

  // Dev-only hook: lets the browser console verify the CSV export/import
  // round-trip against the live storage (stripped out of production builds).
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __cpms?: unknown }).__cpms = { storage };
    }
  }, []);

  // When switching user, ensure currentTab is valid for role
  const handleSelectUser = (user: UserAccount) => {
    storage.setCurrentUser(user);
    setCurrentUser(user);
    setCurrentTab('dashboard');
    setActiveViewerSubmissionId(null);
  };

  // Logout and return to portal selection
  const handleLogout = () => {
    authService.logout();
    storage.setCurrentUser(null);
    setCurrentUser(null);
    setCurrentTab('dashboard');
    setActiveViewerSubmissionId(null);
  };

  // Instructor pending submissions count for badge
  const pendingSubmissionsCount = submissions.filter(
    (s) => s.status === 'submitted' || s.status === 'graded_awaiting_return'
  ).length;

  // If no user is logged in, show the Portal Selection view
  if (!currentUser) {
    return (
      <>
        <LoginPortalView
          accounts={accounts}
          onSelectUser={handleSelectUser}
        />
      </>
    );
  }

  // Derive current student's group if student
  const studentGroup = currentUser?.groupId
    ? groups.find((g) => g.id === currentUser.groupId)
    : null;

  const studentOffice = studentGroup
    ? offices.find((o) => o.id === studentGroup.officeId)
    : undefined;

  const currentStudentMember: StudentMember | undefined =
    studentGroup?.members.find((m) => m.id === currentUser?.id || m.username === currentUser?.username) ||
    undefined;

  // Document Viewer data
  const viewerSubmission = activeViewerSubmissionId
    ? submissions.find((s) => s.id === activeViewerSubmissionId)
    : null;
  const viewerTask = viewerSubmission
    ? tasks.find((t) => t.id === viewerSubmission.taskId)
    : null;
  const viewerDeliverable = viewerSubmission
    ? deliverables.find((d) => d.id === viewerSubmission.deliverableId)
    : null;
  const viewerGroup = viewerSubmission
    ? groups.find((g) => g.id === viewerSubmission.groupId)
    : null;

  return (
    <div className="h-screen bg-slate-100 flex flex-col font-sans text-slate-800 overflow-hidden">
      <SaveStatus />
      {/* Navbar */}
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        groups={groups}
      />

      {/* Main Workspace with Sidebar */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            setPreselectedTaskIdForSubmission(undefined);
          }}
          currentUser={currentUser}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          pendingSubmissionsCount={pendingSubmissionsCount}
          onLogout={handleLogout}
        />

        {/* Content Area */}
        <main id="main-body-container" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 min-h-0 no-scrollbar">
          <div className="max-w-7xl mx-auto">
            {/* Role: Instructor Views */}
            {currentUser?.role === 'instructor' ? (
              <>
                {currentTab === 'dashboard' && (
                  <InstructorDashboardView
                    groups={groups}
                    offices={offices}
                    deliverables={deliverables}
                    tasks={tasks}
                    submissions={submissions}
                    onSelectGroup={(groupId) => setCurrentTab('groups')}
                    onOpenSubmissionReview={(subId) => setActiveViewerSubmissionId(subId)}
                    onNavigateToTab={(tab) => setCurrentTab(tab)}
                  />
                )}

                {currentTab === 'offices' && (
                  <OfficesView
                    offices={offices}
                    groups={groups}
                    onSaveOffices={(newOffices) => storage.saveOffices(newOffices)}
                    onSelectGroup={(groupId) => setCurrentTab('groups')}
                  />
                )}

                {currentTab === 'groups' && (
                  <GroupsView
                    groups={groups}
                    offices={offices}
                    onSaveGroups={(newGroups) => storage.saveGroups(newGroups)}
                  />
                )}

                {currentTab === 'deliverables' && (
                  <DeliverablesView
                    deliverables={deliverables}
                    tasks={tasks}
                    submissions={submissions}
                    onSaveDeliverables={(newDeliverables) => storage.saveDeliverables(newDeliverables)}
                    onSaveTasks={(newTasks) => storage.saveTasks(newTasks)}
                  />
                )}

                {currentTab === 'submissions' && (
                  <SubmissionsReviewView
                    submissions={submissions}
                    groups={groups}
                    offices={offices}
                    deliverables={deliverables}
                    tasks={tasks}
                    onOpenDocumentViewer={(subId) => setActiveViewerSubmissionId(subId)}
                  />
                )}

                {currentTab === 'gradebook' && (
                  <GradebookView
                    groups={groups}
                    deliverables={deliverables}
                    tasks={tasks}
                    submissions={submissions}
                    offices={offices}
                    onOpenDocumentViewer={(subId) => setActiveViewerSubmissionId(subId)}
                  />
                )}

                {currentTab === 'reports' && (
                  <ReportsView
                    groups={groups}
                    deliverables={deliverables}
                    tasks={tasks}
                    submissions={submissions}
                    offices={offices}
                  />
                )}

                {currentTab === 'oral-defense' && (
                  <DefenseSchedulingView
                    groups={groups}
                    defenseAttempts={defenseAttempts}
                    accounts={accounts}
                    currentUser={currentUser}
                    onSaveAttempt={(attempt) => storage.saveDefenseAttempt(attempt)}
                    onDeleteAttempt={(attemptId) => storage.deleteDefenseAttempt(attemptId)}
                    onNavigateToTab={(tab: any) => setCurrentTab(tab as ViewTab)}
                  />
                )}

                {currentTab === 'panel-accounts' && (
                  <PanelAccountsView />
                )}

                {currentTab === 'settings' && (
                  <SettingsView
                    currentUser={currentUser}
                    onLogout={handleLogout}
                  />
                )}
              </>
            ) : currentUser?.role === 'panel' ? (
              /* Role: Panel Member Views */
              <>
                {(currentTab === 'dashboard' || currentTab === 'panel-defense') && (
                  <PanelDashboardView
                    panelUser={currentUser}
                    defenseAttempts={defenseAttempts}
                    submissions={submissions}
                    onOpenSubmission={submission => setActiveViewerSubmissionId(submission.id)}
                    groups={groups}
                    accounts={accounts}
                  />
                )}

                {currentTab === 'settings' && (
                  <SettingsView
                    currentUser={currentUser}
                    onLogout={handleLogout}
                  />
                )}
              </>
            ) : (
              /* Role: Student Views */
              studentGroup && currentStudentMember ? (
                <>
                  {currentTab === 'dashboard' && (
                    <StudentDashboardView
                      currentStudent={currentStudentMember}
                      group={studentGroup}
                      office={studentOffice}
                      deliverables={deliverables}
                      tasks={tasks}
                      submissions={submissions}
                      onNavigateToTab={(tab) => setCurrentTab(tab === 'feedback' ? 'scores' : tab)}
                      onOpenSubmissionUpload={(taskId) => {
                        setPreselectedTaskIdForSubmission(taskId);
                        setCurrentTab('deliverables');
                      }}
                      onOpenDocumentViewer={(subId) => setActiveViewerSubmissionId(subId)}
                    />
                  )}

                  {currentTab === 'my-group' && (
                    <StudentGroupView
                      currentStudent={currentStudentMember}
                      group={studentGroup}
                      office={studentOffice}
                      deliverables={deliverables}
                      tasks={tasks}
                      submissions={submissions}
                    />
                  )}

                  {currentTab === 'deliverables' && (
                    <StudentDeliverablesView
                      currentStudent={currentStudentMember}
                      group={studentGroup}
                      deliverables={deliverables}
                      tasks={tasks}
                      submissions={submissions}
                      onSaveSubmissions={(newSubs) => storage.saveSubmissions(newSubs)}
                      onOpenDocumentViewer={(subId) => setActiveViewerSubmissionId(subId)}
                      preselectedTaskId={preselectedTaskIdForSubmission}
                    />
                  )}

                  {currentTab === 'my-submissions' && (
                    <StudentSubmissionsView
                      group={studentGroup}
                      deliverables={deliverables}
                      tasks={tasks}
                      submissions={submissions}
                      onOpenDocumentViewer={(subId) => setActiveViewerSubmissionId(subId)}
                    />
                  )}

                  {currentTab === 'defense-results' && (
                    <StudentDefenseView
                      group={studentGroup}
                      currentUser={currentUser}
                      accounts={accounts}
                      defenseAttempts={defenseAttempts}
                    />
                  )}

                  {currentTab === 'scores' && (
                    <StudentFeedbackView
                      group={studentGroup}
                      deliverables={deliverables}
                      tasks={tasks}
                      submissions={submissions}
                      onOpenDocumentViewer={(subId) => setActiveViewerSubmissionId(subId)}
                    />
                  )}

                  {currentTab === 'settings' && (
                    <SettingsView
                      currentUser={currentUser!}
                      group={studentGroup}
                      onLogout={handleLogout}
                    />
                  )}
                </>
              ) : (
                <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-xs p-6">
                  <h3 className="text-base font-bold text-slate-800">
                    No Capstone Group Assigned
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Your account is not linked to an active group. Contact your coordinator to manage your group assignment.
                  </p>
                  <button
                    onClick={handleLogout}
                    className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs"
                  >
                    Return to Login Portal
                  </button>
                </div>
              )
            )}
          </div>
        </main>
      </div>

      {/* Integrated Document Viewer (Full-Screen Overlay) */}
      {viewerSubmission && viewerTask && viewerDeliverable && viewerGroup && currentUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-7xl h-[94vh] flex flex-col shadow-2xl">
            <DocumentViewer
              key={viewerSubmission.id}
              submission={viewerSubmission}
              task={viewerTask}
              deliverable={viewerDeliverable}
              group={viewerGroup}
              currentUser={currentUser}
              allSubmissions={submissions}
              allTasks={tasks}
              onSwitchSubmission={(newSubId) => setActiveViewerSubmissionId(newSubId)}
              onSaveGrading={(submissionId, gradeData, returnToGroup) => {
                storage.saveGrading(submissionId, gradeData, returnToGroup);
              }}
              onSaveAnnotation={(submissionId, annotation) => {
                storage.saveAnnotation(submissionId, annotation);
              }}
              onDeleteAnnotation={(submissionId, annotationId) => {
                storage.deleteAnnotation(submissionId, annotationId);
              }}
              onClose={() => setActiveViewerSubmissionId(null)}
            />
          </div>
        </div>
      )}

      {/* Password Change Prompt on First Login */}
      {currentUser && currentUser.mustChangePassword && (
        <ChangePasswordModal
          isOpen={true}
          user={currentUser}
          onClose={() => {}}
          onPasswordChanged={(updatedUser) => {
            setCurrentUser(updatedUser);
            storage.setCurrentUser(updatedUser);
          }}
          isFirstLoginPrompt={true}
        />
      )}
    </div>
  );
}
