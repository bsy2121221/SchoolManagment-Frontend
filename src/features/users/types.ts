/**
 * Mirrors SchoolManagment.Models/DTOs/Users and the procedures behind them.
 *
 * This module is the account layer under every other one. A student, a teacher and a parent
 * each own a row here, and it is the row that decides whether they can sign in at all --
 * which is why the list is the broadest screen in the app and the only one that can bring a
 * deactivated account back.
 *
 * **There is no create.** `UserCreateDTO` and `sp_CreateUser` both exist, but no endpoint
 * joins them: users arrive through student, teacher or parent registration, or through
 * `POST /schools/{id}/administrators`. So this module edits, it does not admit.
 */

/**
 * DTOs/Users/UserDTO.cs, as `sp_GetAllUsers` and `sp_GetUserById` return it.
 *
 * Deliberately flat. Users, Persons and Addresses are three tables, and `dbo.vw_Users`
 * re-flattens them back into the column names the DTO has always had -- so `firstName` is a
 * `Persons` column and `email` is a `Users` one, and nothing here says so.
 */
export interface UserRow {
  /** `Users.Id`. Every endpoint in this module is keyed on it. */
  id: number
  /** Null only for the platform SuperAdmin, who belongs to no school. */
  schoolId: number | null
  /** `Persons.Id`. Here for callers that edit the person directly; nothing in Phase 8 does. */
  personId: number
  /** Allocated by the server at registration and never changed, not even by a rename. */
  username: string
  email: string
  firstName: string
  lastName: string
  fullName: string | null
  phoneNumber: string | null
  alternatePhoneNumber: string | null

  /** The primary address flattened to one line. The parts below are the same row. */
  address: string | null
  addressId: number | null
  addressType: string | null
  addressLine1: string | null
  addressLine2: string | null
  landmark: string | null
  city: string | null
  state: string | null
  country: string | null
  postalCode: string | null

  /** `Roles.Id` -- see `ROLE_IDS`. The filter to prefer: a role can be renamed, its id cannot. */
  roleId: number
  /** Role name, and what the UI displays. */
  role: string
  roleCode: string | null

  isActive: boolean
  /** True until they have changed the password their account was created with. */
  requirePasswordChange: boolean
  /**
   * Whether `Persons.ProfilePicture` holds bytes. The list never carries the image itself,
   * so this is what says whether `GET /users/{id}/profile-picture` is worth a request.
   */
  hasProfilePicture: boolean
  /** Null means they have never signed in. */
  lastLoginAt: string | null

  createdBy: number | null
  createdByUsername: string | null
  modifiedBy: number | null
  modifiedByUsername: string | null
  createdAt: string
  updatedAt: string

  schoolCode: string | null
  schoolName: string | null

  /**
   * Admission number for a student, employee id for a teacher, null for everyone else. The
   * old procedures called this `RoleId`; it was renamed when `roleId` came to mean
   * `Roles.Id`.
   */
  roleIdentifier: string | null
}

/** DTOs/Users/AddressDTO.cs. `addressLine1` is `[Required]` whenever this object is sent. */
export interface AddressPayload {
  id?: number | null
  /** `CK_Addresses_AddressType`: Permanent, Current or Correspondence. */
  addressType: string
  addressLine1: string
  addressLine2?: string | null
  /**
   * On the DTO but **not written**: `UserRepository.UpdateUserAsync` has no `@Landmark`
   * parameter to forward it through, and `sp_UpdateUser` has none to receive it. Sending it
   * is silently ignored, so the edit form does not offer the box.
   */
  landmark?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postalCode?: string | null
  isPrimary?: boolean
}

/**
 * DTOs/Users/UserUpdateDTO.cs.
 *
 * Two things about the address, both from `sp_UpdateUserIdentity`:
 *
 *  - `address` is the free-text form and is written to `AddressLine1`. It is **ignored**
 *    when `addressDetails` is sent, so sending both writes the line twice with different
 *    values. The repository drops `address` in that case for exactly this reason.
 *  - All-null means "the address is not part of this edit"; an explicit empty string
 *    clears the field. So there is no way to remove an address outright -- `addressLine1`
 *    is required whenever `addressDetails` is present at all.
 */
export interface UserUpdatePayload {
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string | null
  address?: string | null
  addressDetails?: AddressPayload | null
}

/** DTOs/Users/UserStatusUpdateDTO.cs. */
export interface UserStatusPayload {
  isActive: boolean
}

/** DTOs/Users/UserRoleUpdateDTO.cs. `Roles.Id`, and custom roles start at 100. */
export interface UserRolePayload {
  roleId: number
}
