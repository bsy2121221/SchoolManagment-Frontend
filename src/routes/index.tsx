// oxlint-disable react/only-export-components -- a route manifest exports `router`,
// not components; the lazy() bindings below are route targets, so the fast-refresh
// rule does not apply here.
import { lazy } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAnonymous, RequireAuth, RequirePermission, RequireRole } from '@/features/auth/guards'
import { HomeRedirect } from '@/pages/HomeRedirect'
import { ROLES } from '@/types/enums'

// Lazy so each module ships as its own chunk. AppShell's Suspense boundary catches these.
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const ChangePasswordPage = lazy(() => import('@/features/auth/pages/ChangePasswordPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const ForbiddenPage = lazy(() => import('@/pages/ForbiddenPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

// Phase 2 -- Classes. Delivered, so it no longer sits in PENDING_MODULES below.
const ClassListPage = lazy(() => import('@/features/classes/pages/ClassListPage'))
const ClassDetailsPage = lazy(() => import('@/features/classes/pages/ClassDetailsPage'))

// Phase 3 -- Schools. Taken ahead of Subjects because onboarding a tenant is the first
// thing that has to work: until a school exists, no other module has anything to show.
const PlatformDashboardPage = lazy(() => import('@/features/schools/pages/PlatformDashboardPage'))
const SchoolListPage = lazy(() => import('@/features/schools/pages/SchoolListPage'))
const SchoolDetailsPage = lazy(() => import('@/features/schools/pages/SchoolDetailsPage'))
const MySchoolPage = lazy(() => import('@/features/schools/pages/MySchoolPage'))

// Phase 4 -- Subjects. One screen: the list carries its own create/edit dialog, and
// there is no per-subject endpoint worth a details page.
const SubjectListPage = lazy(() => import('@/features/subjects/pages/SubjectListPage'))

// Phase 5 -- Students. The list carries the registration, edit and promotion dialogs; the
// profile adds the academic figures, fee balance and subject enrolments.
const StudentListPage = lazy(() => import('@/features/students/pages/StudentListPage'))
const StudentProfilePage = lazy(() => import('@/features/students/pages/StudentProfilePage'))

// Phase 6 -- Teachers. Three screens: the list with its registration and edit dialogs, the
// profile with the stats, subject assignment and subject-class matrix, and the teacher's own
// read-mostly view of themselves.
const TeacherListPage = lazy(() => import('@/features/teachers/pages/TeacherListPage'))
const TeacherProfilePage = lazy(() => import('@/features/teachers/pages/TeacherProfilePage'))
const MyProfilePage = lazy(() => import('@/features/teachers/pages/MyProfilePage'))

// Phase 7 -- Parents. Three screens, mirroring Teachers: the list with its registration and
// edit dialogs, the profile with the children and the link/unlink control, and the parent's
// own read-only view. Read-only because there is no PUT my-profile for a parent.
const ParentListPage = lazy(() => import('@/features/parents/pages/ParentListPage'))
const ParentProfilePage = lazy(() => import('@/features/parents/pages/ParentProfilePage'))
const MyParentProfilePage = lazy(() => import('@/features/parents/pages/MyParentProfilePage'))

// Phase 8 -- Users. The account layer under every other module: the list governs every login
// in the school, and the details screen carries the profile picture and the audit trail.
const UserListPage = lazy(() => import('@/features/users/pages/UserListPage'))
const UserDetailsPage = lazy(() => import('@/features/users/pages/UserDetailsPage'))

// Phase 9 -- Attendance. Two screens: the class register, which writes the whole roll in one
// bulk submission, and the reports pair (per student, per day) that reads the aggregates.
const AttendanceRegisterPage = lazy(
  () => import('@/features/attendance/pages/AttendanceRegisterPage'),
)
const AttendanceReportsPage = lazy(() => import('@/features/attendance/pages/AttendanceReportsPage'))

// Phase 10 -- Examinations. Two screens: the list, which carries the upsert dialog and the
// delete, and the mark sheet, which is a read of what Results (Phase 11) has written.
const ExaminationListPage = lazy(() => import('@/features/examinations/pages/ExaminationListPage'))
const ExaminationMarkSheetPage = lazy(
  () => import('@/features/examinations/pages/ExaminationMarkSheetPage'),
)

// Phase 11 -- Results. Two screens: grade entry, which writes a whole class in one bulk
// submission, and the per-student report card, which reads every mark a student has been given.
const GradeEntryPage = lazy(() => import('@/features/results/pages/GradeEntryPage'))
const StudentReportCardPage = lazy(
  () => import('@/features/results/pages/StudentReportCardPage'),
)

// Phase 12 -- Fees. Three screens: the finance desk (outstanding, collection, the payments
// ledger and the price list), one student's fee account, and a printable receipt.
const FeesPage = lazy(() => import('@/features/fees/pages/FeesPage'))
const StudentFeeAccountPage = lazy(() => import('@/features/fees/pages/StudentFeeAccountPage'))
const ReceiptPage = lazy(() => import('@/features/fees/pages/ReceiptPage'))

// Phase 13 -- Schedule. One screen with two views, by teacher and by class, carrying the
// add/edit dialog with its clash preview.
const SchedulePage = lazy(() => import('@/features/schedule/pages/SchedulePage'))

// Phase 14 -- Roles. The last module; PENDING_MODULES and its placeholder page went with it.
const RoleListPage = lazy(() => import('@/features/roles/pages/RoleListPage'))
const RoleDetailsPage = lazy(() => import('@/features/roles/pages/RoleDetailsPage'))

export const router = createBrowserRouter([
  {
    element: <RequireAnonymous />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },

  {
    element: <RequireAuth />,
    children: [
      /**
       * Outside AppShell on purpose: a user held here by requirePasswordChange must
       * not be given navigation to escape through.
       */
      { path: '/change-password', element: <ChangePasswordPage /> },

      {
        element: <AppShell />,
        children: [
          /**
           * A SuperAdmin is sent to /platform from here; everyone else gets the school
           * dashboard. See HomeRedirect for why the decision lives in the route rather
           * than in LoginPage.
           */
          {
            index: true,
            element: (
              <HomeRedirect>
                <DashboardPage />
              </HomeRedirect>
            ),
          },
          { path: 'forbidden', element: <ForbiddenPage /> },

          /**
           * Classes. The details route is nested under the list path so that both are
           * behind one permission check -- Classes:View covers reading either, and the
           * finer Create/Edit/Delete flags gate the buttons inside.
           */
          {
            path: 'classes',
            element: (
              <RequirePermission module="Classes">
                <Outlet />
              </RequirePermission>
            ),
            children: [
              { index: true, element: <ClassListPage /> },
              { path: ':classId', element: <ClassDetailsPage /> },
            ],
          },

          /**
           * Students. Nested as for Classes, so `Students:View` covers reading the list and
           * any one profile, and the finer flags gate the buttons inside.
           *
           * Worth knowing: `GET /students/{id}`, `/{id}/profile` and `/{id}/subjects` carry
           * no policy attribute server-side, so this guard is the only thing keeping a
           * student or parent off those screens.
           */
          {
            path: 'students',
            element: (
              <RequirePermission module="Students">
                <Outlet />
              </RequirePermission>
            ),
            children: [
              { index: true, element: <StudentListPage /> },
              { path: ':studentId', element: <StudentProfilePage /> },
            ],
          },

          /**
           * Teachers. Nested as for Classes and Students, so `Teachers:View` covers the
           * list and any one profile.
           *
           * The child route is `:userId`, not `:teacherId`: `sp_GetTeacherProfile` takes
           * @UserId, so `Users.Id` is the only id that can open this screen. Every write
           * inside it uses `Teachers.Id`, which the profile response carries.
           */
          {
            path: 'teachers',
            element: (
              <RequirePermission module="Teachers">
                <Outlet />
              </RequirePermission>
            ),
            children: [
              { index: true, element: <TeacherListPage /> },
              { path: ':userId', element: <TeacherProfilePage /> },
            ],
          },

          /**
           * Parents. Nested as for Teachers, so `Parents:View` covers the list and any one
           * profile.
           *
           * The child route is `:userId`, not `:parentId`: `sp_GetParentProfile` takes
           * @UserId, so `Users.Id` is the only id that can open this screen. Every write
           * inside it -- the edit, the delete, the child links -- uses `Parents.Id`, which
           * the profile response carries.
           */
          {
            path: 'parents',
            element: (
              <RequirePermission module="Parents">
                <Outlet />
              </RequirePermission>
            ),
            children: [
              { index: true, element: <ParentListPage /> },
              { path: ':userId', element: <ParentProfilePage /> },
            ],
          },

          /**
           * Users. Nested as for the modules above, so `Users:View` covers the list and any one
           * account.
           *
           * The child route is `:userId` and so is the id every endpoint in the module takes --
           * this is the one module where the route id and the write id are the same thing.
           *
           * Worth knowing about the guard: `GET /users/{id}` and both profile-picture writes are
           * gated by `CanAccessUser` (admin or self) rather than by the grid, so a teacher could
           * read their own row through the API. This route is stricter, because there is no
           * self-service account screen -- a teacher edits themselves at `/my-profile`.
           */
          {
            path: 'users',
            element: (
              <RequirePermission module="Users">
                <Outlet />
              </RequirePermission>
            ),
            children: [
              { index: true, element: <UserListPage /> },
              { path: ':userId', element: <UserDetailsPage /> },
            ],
          },

          /**
           * Attendance. Nested as for the modules above, so `Attendance:View` covers the
           * register and both reports, and `Attendance:Create` gates the marking inside.
           *
           * The role guard is not redundant with the permission one here, and this is the
           * first module where the two genuinely disagree. The seeded grid gives **Student
           * and Parent `Attendance:View`**, but all six endpoints are
           * `AuthPolicies.AdminOrTeacher`, so those roles would pass this guard and then get
           * a 403 from every request the screen makes. Guarding on the role as well means
           * they are told they cannot come in, rather than shown a page that cannot load.
           * FRONTEND_PLAN.md §7 records the underlying gap: a student cannot read their own
           * attendance through this API at all.
           *
           * SuperAdmin is in the list because the policy includes it, for the case of a
           * SuperAdmin who has switched into a school.
           */
          {
            path: 'attendance',
            element: (
              <RequireRole roles={[ROLES.Admin, ROLES.Teacher, ROLES.SuperAdmin]}>
                <RequirePermission module="Attendance">
                  <Outlet />
                </RequirePermission>
              </RequireRole>
            ),
            children: [
              { index: true, element: <AttendanceRegisterPage /> },
              { path: 'reports', element: <AttendanceReportsPage /> },
            ],
          },

          /**
           * Examinations. Nested as for the modules above, so `Examinations:View` covers the
           * list and any one mark sheet, and the finer flags gate the dialogs inside.
           *
           * Role-guarded for exactly the same reason as Attendance above, and the first draft of
           * this route got it wrong: the seeded grid **does** give the Student and Parent roles
           * `Examinations:View` (`01_Schema.sql:506` and `:512`), while all five endpoints are
           * `AuthPolicies.AdminOrTeacher`. Without the role check those two audiences pass the
           * permission guard and then get a 403 from every request the screen makes. See §7.34.
           */
          {
            path: 'examinations',
            element: (
              <RequireRole roles={[ROLES.Admin, ROLES.Teacher, ROLES.SuperAdmin]}>
                <RequirePermission module="Examinations">
                  <Outlet />
                </RequirePermission>
              </RequireRole>
            ),
            children: [
              { index: true, element: <ExaminationListPage /> },
              { path: ':examinationId', element: <ExaminationMarkSheetPage /> },
            ],
          },

          /**
           * Results. Role-guarded for the third time in this section, and this one is the widest
           * gap between the grid and the API yet: Student and Parent both hold `Results:View`, but
           * the two writes are `AdminOrTeacher`, grade-entry is stricter still, and the one read
           * those roles could call takes a `Students.Id` that appears on no token and is returned
           * by no endpoint they can reach. There is no `my-results`. So the permission is real and
           * unusable, and letting those audiences in would show them a screen with no way to name
           * the student it is about. See §7.35.
           *
           * The child route is `:studentId` and it is `Students.Id`, not `Users.Id` -- unlike the
           * Teachers and Parents profile routes, whose procedures are keyed on the user.
           */
          {
            path: 'results',
            element: (
              <RequireRole roles={[ROLES.Admin, ROLES.Teacher, ROLES.SuperAdmin]}>
                <RequirePermission module="Results">
                  <Outlet />
                </RequirePermission>
              </RequireRole>
            ),
            children: [
              { index: true, element: <GradeEntryPage /> },
              { path: 'student/:studentId', element: <StudentReportCardPage /> },
            ],
          },

          /**
           * Fees. Role-guarded to Admin and SuperAdmin, which is narrower than any module above.
           * The seeded grid gives Student and Parent `Fees:View`, but every endpoint a person can
           * act on here is `AdminOnly`: recording a payment certifies that money was received, so
           * it stays with school staff, and the per-student reads take a `Students.Id` with no
           * `StudentParents` check behind it, so opening them to parents would let any parent read
           * any child's account. There is no parent self-service or payment gateway. See §7.41.
           *
           * The fee-type reads are `AllSchoolUsers`, but a price list on its own is not a screen.
           *
           * `students/:studentId` is `Students.Id`, as on `/students/:studentId`.
           * `receipts/:receiptNumber` is the server-generated receipt number, not the payment id.
           */
          /**
           * The timetable. Role-guarded to the three roles the API serves: every Schedule read
           * is AdminOrTeacher, so a Student or Parent -- both hold `Schedule:View` in the seeded
           * grid -- would reach a page whose every request is a 403. See §7.50. Writes are
           * AdminOnly and gated inside the page.
           */
          {
            path: 'schedule',
            element: (
              <RequireRole roles={[ROLES.Admin, ROLES.Teacher, ROLES.SuperAdmin]}>
                <RequirePermission module="Schedule">
                  <SchedulePage />
                </RequirePermission>
              </RequireRole>
            ),
          },

          {
            path: 'fees',
            element: (
              <RequireRole roles={[ROLES.Admin, ROLES.SuperAdmin]}>
                <RequirePermission module="Fees">
                  <Outlet />
                </RequirePermission>
              </RequireRole>
            ),
            children: [
              { index: true, element: <FeesPage /> },
              { path: 'students/:studentId', element: <StudentFeeAccountPage /> },
              { path: 'receipts/:receiptNumber', element: <ReceiptPage /> },
            ],
          },

          /**
           * A parent's own record and their children, and the one parent screen a parent can
           * reach.
           *
           * Role-guarded with **no module**, for the same reason as the teacher's screen
           * below: the seeded grid gives the Parent role no `Parents` permission row at all,
           * so `RequirePermission module="Parents"` would lock out exactly the audience this
           * page is for. `GET /parents/my-profile` is `[Authorize(Roles = "Parent")]`, so the
           * role is the whole check server-side too.
           *
           * A distinct path from `/my-profile`, which is the Teacher screen: that route's
           * endpoints are role-gated to Teacher, so one shared path would 403 for whichever
           * audience it did not belong to.
           */
          {
            path: 'my-family',
            element: (
              <RequireRole roles={[ROLES.Parent]}>
                <MyParentProfilePage />
              </RequireRole>
            ),
          },

          /**
           * A teacher's own record, and the one teacher screen a teacher can reach.
           *
           * Guarded by role with **no module**, because the seeded grid gives the Teacher
           * role no `Teachers` permission row at all -- `RequirePermission module="Teachers"`
           * would lock out exactly the audience this page is for. That matches the server:
           * both my-profile endpoints are `[Authorize(Roles = "Teacher")]`, so the role is
           * the whole check there too, and an Admin gets a 403 rather than their own record.
           */
          {
            path: 'my-profile',
            element: (
              <RequireRole roles={[ROLES.Teacher]}>
                <MyProfilePage />
              </RequireRole>
            ),
          },

          /**
           * Subjects. `GET /api/Subjects` is Admin/Teacher, so a teacher holding
           * Subjects:View can read the list; the write buttons are gated on the finer
           * flags inside, which the seeded Teacher role does not hold.
           */
          {
            path: 'subjects',
            element: (
              <RequirePermission module="Subjects">
                <SubjectListPage />
              </RequirePermission>
            ),
          },

          /**
           * Schools, in two halves with different guards, because the controller does
           * the same thing:
           *
           *   /platform, /schools, /schools/:id — cross-tenant, so `Schools:View` is
           *     not sufficient. Every school admin holds it for their own school, which
           *     is why these also require the SuperAdmin role.
           *   /my-school — `GET /schools/current`, which takes no id and reads the one
           *     on the caller's token. The grid alone is the right guard here.
           */
          {
            element: (
              <RequireRole roles={[ROLES.SuperAdmin]}>
                <RequirePermission module="Schools">
                  <Outlet />
                </RequirePermission>
              </RequireRole>
            ),
            children: [
              { path: 'platform', element: <PlatformDashboardPage /> },
              {
                path: 'schools',
                children: [
                  { index: true, element: <SchoolListPage /> },
                  { path: ':schoolId', element: <SchoolDetailsPage /> },
                ],
              },
            ],
          },
          {
            path: 'my-school',
            element: (
              <RequirePermission module="Schools">
                <MySchoolPage />
              </RequirePermission>
            ),
          },

          /**
           * /roles — SuperAdmin, and the grid. Reads are `Roles:View`, which every school
           * admin holds, but roles are global and every write is SuperAdminOnly (§7.58), so a
           * school admin would find a screen of disabled controls over other schools' roles.
           */
          {
            path: 'roles',
            element: (
              <RequireRole roles={[ROLES.SuperAdmin]}>
                <RequirePermission module="Roles">
                  <Outlet />
                </RequirePermission>
              </RequireRole>
            ),
            children: [
              { index: true, element: <RoleListPage /> },
              { path: ':roleId', element: <RoleDetailsPage /> },
            ],
          },

          { path: '404', element: <NotFoundPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },

  // Anything unmatched above (i.e. while signed out) falls through to the guards.
  { path: '*', element: <Navigate to="/" replace /> },
])
