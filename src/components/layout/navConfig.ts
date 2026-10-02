import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import ApartmentIcon from '@mui/icons-material/Apartment'
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'
import BadgeIcon from '@mui/icons-material/Badge'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ClassIcon from '@mui/icons-material/Class'
import DashboardIcon from '@mui/icons-material/Dashboard'
import EscalatorWarningIcon from '@mui/icons-material/EscalatorWarning'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom'
import GradingIcon from '@mui/icons-material/Grading'
import GroupsIcon from '@mui/icons-material/Groups'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import PersonIcon from '@mui/icons-material/Person'
import PublicIcon from '@mui/icons-material/Public'
import SchoolIcon from '@mui/icons-material/School'
import SettingsIcon from '@mui/icons-material/Settings'
import type { SvgIconComponent } from '@mui/icons-material'
import { ROLES } from '@/types/enums'
import type { ModuleName } from '@/types/enums'

export interface NavItem {
  label: string
  to: string
  icon: SvgIconComponent
  /**
   * The permission module gating this entry. Omitted for the dashboard, which every
   * signed-in user can reach.
   */
  module?: ModuleName
  /**
   * Additional role restriction, for controllers that gate on the role name and
   * ignore the permission grid. RolesController and the cross-tenant half of
   * SchoolsController both do this.
   */
  roles?: readonly string[]
  /**
   * Roles for which the entry is *hidden* even though the permission allows it. For
   * screens that exist but are the wrong answer for one audience: a SuperAdmin's
   * dashboard is the platform page, and "My school" means nothing to an account whose
   * SchoolId is null.
   */
  excludeRoles?: readonly string[]
  section: 'Overview' | 'People' | 'Academics' | 'Operations' | 'Administration'
}

/**
 * The sidebar, and the single place a module's route/permission pairing is declared.
 * Sidebar.tsx filters this by `can(module, 'View')`, so adding an entry here is all it
 * takes to make a new module appear for exactly the users allowed to see it.
 *
 * The `Schools` module appears twice, because the controller splits the same
 * permission across two audiences: Platform and Schools are cross-tenant and need the
 * SuperAdmin role on top of the grid, while My school reads `/schools/current` and needs
 * only the grid. No user ever sees both sets.
 *
 * Still absent:
 *   Reports  — genuinely unbuildable: `Reports` is a permission module with no
 *              endpoints of its own. Only GET /api/Dashboard/stats reads it.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: 'Dashboard',
    to: '/',
    icon: DashboardIcon,
    // Everyone: GET /api/Dashboard has no guard and picks its sections from the caller.
    section: 'Overview',
  },
  {
    label: 'Platform',
    to: '/platform',
    icon: PublicIcon,
    module: 'Schools',
    roles: [ROLES.SuperAdmin],
    section: 'Overview',
  },
  {
    label: 'My profile',
    to: '/my-profile',
    icon: BadgeIcon,
    // No module, deliberately. The seeded Teacher role holds no `Teachers` permission row
    // at all, so gating this on `Teachers:View` would hide it from the only people who can
    // use it. `GET /teachers/my-profile` is [Authorize(Roles = "Teacher")] -- the role is
    // the whole check server-side, so it is the whole check here too.
    roles: [ROLES.Teacher],
    section: 'Overview',
  },
  {
    label: 'My family',
    to: '/my-family',
    icon: FamilyRestroomIcon,
    // No module, for the same reason as "My profile" above: the seeded Parent role holds no
    // `Parents` permission row, and `GET /parents/my-profile` is
    // [Authorize(Roles = "Parent")]. A separate path from /my-profile because that one's
    // endpoints are Teacher-only -- sharing the path would 403 for one of the two.
    roles: [ROLES.Parent],
    section: 'Overview',
  },

  { label: 'Students', to: '/students', icon: SchoolIcon, module: 'Students', section: 'People' },
  { label: 'Teachers', to: '/teachers', icon: GroupsIcon, module: 'Teachers', section: 'People' },
  {
    label: 'Parents',
    to: '/parents',
    icon: EscalatorWarningIcon,
    module: 'Parents',
    section: 'People',
  },

  { label: 'Classes', to: '/classes', icon: ClassIcon, module: 'Classes', section: 'Academics' },
  {
    label: 'Subjects',
    to: '/subjects',
    icon: MenuBookIcon,
    module: 'Subjects',
    section: 'Academics',
  },
  {
    label: 'Attendance',
    to: '/attendance',
    icon: AssignmentTurnedInIcon,
    module: 'Attendance',
    // The grid is not enough here, and for the opposite reason to Roles below: the seeded
    // Student and Parent roles both hold Attendance:View, but every endpoint on
    // AttendanceController is AdminOrTeacher. Without this they would see the link and get a
    // 403 from the register, the summary and the daily report alike.
    roles: [ROLES.SuperAdmin, ROLES.Admin, ROLES.Teacher],
    section: 'Academics',
  },
  {
    label: 'Examinations',
    to: '/examinations',
    icon: FactCheckIcon,
    module: 'Examinations',
    // Same correction as Attendance above, and made for the same reason: the seeded Student and
    // Parent roles both hold Examinations:View, but every endpoint on ExaminationsController is
    // AdminOrTeacher. Without this they would see the link and get a 403 from the list, the mark
    // sheet and the single read alike. See §7.34.
    roles: [ROLES.SuperAdmin, ROLES.Admin, ROLES.Teacher],
    section: 'Academics',
  },
  {
    label: 'Results',
    to: '/results',
    icon: GradingIcon,
    module: 'Results',
    // The third module where the grid is wider than the API. Student and Parent both hold
    // Results:View, but the two writes are AdminOrTeacher, grade-entry is stricter still, and the
    // one read they could call needs a Students.Id they have no way to discover -- there is no
    // my-results endpoint. See §7.35.
    roles: [ROLES.SuperAdmin, ROLES.Admin, ROLES.Teacher],
    section: 'Academics',
  },

  {
    label: 'Fees',
    to: '/fees',
    icon: AccountBalanceWalletIcon,
    module: 'Fees',
    // Narrower than the three Academics modules: Student and Parent hold Fees:View, but every
    // fee endpoint beyond the price list is AdminOnly -- a Teacher has no fee permission at all,
    // and a parent cannot pay through this API. See §7.41.
    roles: [ROLES.SuperAdmin, ROLES.Admin],
    section: 'Operations',
  },
  {
    label: 'Timetable',
    to: '/schedule',
    icon: CalendarMonthIcon,
    module: 'Schedule',
    // Student and Parent hold Schedule:View, but every schedule endpoint is AdminOrTeacher and
    // none resolves "my class", so the entry would open onto 403s. See §7.50.
    roles: [ROLES.SuperAdmin, ROLES.Admin, ROLES.Teacher],
    section: 'Operations',
  },

  {
    label: 'Schools',
    to: '/schools',
    icon: ApartmentIcon,
    module: 'Schools',
    // The list is every tenant on the deployment, so the role guard matters here as much
    // as on Roles: Schools:View alone is held by every school admin.
    roles: [ROLES.SuperAdmin],
    section: 'Administration',
  },
  {
    label: 'My school',
    to: '/my-school',
    icon: ApartmentIcon,
    module: 'Schools',
    // A SuperAdmin's SchoolId is null, so /schools/current answers 404 for them.
    excludeRoles: [ROLES.SuperAdmin],
    section: 'Administration',
  },
  { label: 'Users', to: '/users', icon: PersonIcon, module: 'Users', section: 'Administration' },
  {
    label: 'Roles & Permissions',
    to: '/roles',
    icon: AdminPanelSettingsIcon,
    module: 'Roles',
    // Reads are Roles:View, which every school admin holds (the Users role picker needs
    // it), but roles are global and Phase 14 made every write SuperAdminOnly on the server.
    // A school admin would get a read-only view of other schools' roles, so the entry is
    // the SuperAdmin's. See FRONTEND_PLAN.md §7.5 and §7.58.
    roles: [ROLES.SuperAdmin],
    section: 'Administration',
  },
  {
    label: 'Settings',
    to: '/settings',
    icon: SettingsIcon,
    // The grid alone: seeded for Admin and SuperAdmin. A SuperAdmin picks a school on the page.
    module: 'Settings',
    section: 'Administration',
  },
]

export const NAV_SECTIONS = [
  'Overview',
  'People',
  'Academics',
  'Operations',
  'Administration',
] as const
