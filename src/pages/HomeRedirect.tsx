import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector } from '@/app/hooks'
import { selectIsSuperAdmin } from '@/features/auth/permissions'

/** Where a platform administrator's session actually begins. */
export const PLATFORM_PATH = '/platform'

/**
 * The index route's dispatcher: a platform administrator lands on the platform page,
 * everyone else on their school dashboard.
 *
 * This is the only place the two audiences diverge, and it is deliberately here rather
 * than in LoginPage. Login is not the only way to arrive at `/` — a bookmark, a reload,
 * `RequireAnonymous` bouncing an already-signed-in user, and the post-password-change
 * redirect all land here too, and a SuperAdmin should reach the platform page from every
 * one of them. Putting the decision in the route means it cannot be missed by one path.
 *
 * `children` is rendered rather than imported so the dashboard stays in its own lazy
 * chunk: a SuperAdmin redirects before it is ever rendered, so its chunk is never
 * fetched.
 */
export function HomeRedirect({ children }: { children: ReactNode }) {
  const isSuperAdmin = useAppSelector(selectIsSuperAdmin)
  if (isSuperAdmin) return <Navigate to={PLATFORM_PATH} replace />
  return <>{children}</>
}
