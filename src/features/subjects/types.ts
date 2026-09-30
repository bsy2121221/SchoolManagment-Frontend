/**
 * Mirrors SchoolManagment.Models/DTOs/Subjects and the procedures behind them.
 *
 * As everywhere else, the school is absent from these shapes: `SchoolId` comes from the
 * token and the API takes it from there.
 */

/** DTOs/Subjects/SubjectDTO.cs */
export interface SubjectRow {
  id: number
  subjectName: string
  /**
   * Unique per school, and stored upper-cased and trimmed by the procedure whatever is
   * sent. Typed nullable because the column is: `Subjects.SubjectCode` allows NULL, and
   * one such row per school can exist from before `sp_CreateSubject` existed. Every
   * write path now requires a code.
   */
  subjectCode: string | null
  grade: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Query string for `GET /api/Subjects`. */
export interface SubjectListQuery {
  grade?: string
  isActive?: boolean
  page?: number
  pageSize?: number
}

/**
 * DTOs/Subjects/SubjectCreateDTO.cs and SubjectUpdateDTO.cs -- identical shapes, so one
 * dialog serves both. All three fields are `[Required]` on either.
 */
export interface SubjectPayload {
  subjectName: string
  subjectCode: string
  grade: string
}
