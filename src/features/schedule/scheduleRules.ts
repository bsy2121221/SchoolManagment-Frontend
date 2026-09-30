import { DAYS_OF_WEEK } from '@/types/enums'
import type { TimeOfDay } from './types'

/** ScheduleEntryCreateDTO's `[StringLength(50)]` on Room, and `TeacherSchedule.Room`. */
export const SCHEDULE_LIMITS = { room: 50 } as const

/*
 * Times of day.
 *
 * The API speaks "HH:mm:ss" with no date and no zone, and these helpers keep it that way:
 * arithmetic is done in minutes since midnight, and a `Date` appears only inside the
 * TimePicker, built from and read back as local wall-clock fields. Nothing here calls
 * `toISOString()`, which would shift the time by the browser's UTC offset.
 */

/** "09:05:00" -> 545. NaN for anything that is not a time. */
export function timeToMinutes(value: TimeOfDay): number {
  const [hours, minutes] = value.split(':').map(Number)
  if (hours === undefined || minutes === undefined) return Number.NaN
  return hours * 60 + minutes
}

/** "09:05:00" -> "09:05". A 24-hour clock, because a timetable is read down a column. */
export function shortTime(value: TimeOfDay | null | undefined): string {
  if (!value) return '—'
  const [hours, minutes] = value.split(':')
  return hours && minutes ? `${hours.padStart(2, '0')}:${minutes}` : value
}

export function timeRange(start: TimeOfDay, end: TimeOfDay): string {
  return `${shortTime(start)}–${shortTime(end)}`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** A TimePicker's Date -> "09:05:00", from the local wall-clock fields. */
export function dateToTime(date: Date): TimeOfDay {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

/** "09:05:00" -> a Date today at 09:05 local, for a TimePicker's value. */
export function timeToDate(value: TimeOfDay | null | undefined): Date | null {
  if (!value) return null
  const minutes = timeToMinutes(value)
  if (Number.isNaN(minutes)) return null
  const date = new Date()
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return date
}

/**
 * The server's clash rule: two lessons collide when each starts before the other ends.
 * Back-to-back lessons (09:00–10:00, then 10:00–11:00) do not.
 */
export function overlaps(
  a: { startTime: TimeOfDay; endTime: TimeOfDay },
  b: { startTime: TimeOfDay; endTime: TimeOfDay },
): boolean {
  return (
    timeToMinutes(a.startTime) < timeToMinutes(b.endTime) &&
    timeToMinutes(a.endTime) > timeToMinutes(b.startTime)
  )
}

/** 1 -> "Monday". */
export function dayLabel(dayOfWeek: number): string {
  return DAYS_OF_WEEK.find((day) => day.value === dayOfWeek)?.label ?? `Day ${dayOfWeek}`
}

/** Today as the API numbers it: 1 = Monday .. 7 = Sunday. `getDay()` counts Sunday as 0. */
export function todayDayOfWeek(): number {
  const day = new Date().getDay()
  return day === 0 ? 7 : day
}

/** 1350 -> "22 h 30 min". */
export function formatMinutes(total: number): string {
  if (total <= 0) return '0 h'
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`
}

/**
 * The days a weekly grid shows: Monday to Friday always, and Saturday or Sunday only when a
 * lesson falls on them. Most schools teach five days, and two empty columns on every
 * timetable would push the ones that matter off a laptop screen.
 */
export function visibleDays(lessonDays: Iterable<number>): number[] {
  const used = new Set(lessonDays)
  return DAYS_OF_WEEK.map((day) => day.value).filter((day) => day <= 5 || used.has(day))
}

/**
 * The entry a 409 names, from `data.conflictWith` on the envelope the server returned.
 * Null for any other failure.
 */
export function conflictOf(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null
  if (!('status' in error) || error.status !== 409) return null
  const envelope = 'data' in error ? error.data : undefined
  if (typeof envelope !== 'object' || envelope === null || !('data' in envelope)) return null
  const payload = envelope.data
  if (typeof payload !== 'object' || payload === null || !('conflictWith' in payload)) return null
  return typeof payload.conflictWith === 'number' ? payload.conflictWith : null
}
