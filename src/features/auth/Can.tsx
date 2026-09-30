import type { ReactNode } from 'react'
import type { ModuleName, PermissionAction } from '@/types/enums'
import { useCan } from './permissions'

interface CanProps {
  module: ModuleName
  action: PermissionAction
  children: ReactNode
  /** Rendered when the permission is absent. Defaults to rendering nothing. */
  fallback?: ReactNode
}

/**
 * Permission gate for a piece of UI.
 *
 *   <Can module="Students" action="Create">
 *     <Button onClick={openCreate}>Add student</Button>
 *   </Can>
 *
 * Hides rather than disables: a disabled button advertises a capability the user does
 * not have and cannot obtain. Use `fallback` when the layout needs the space held.
 *
 * This is presentation only -- the API enforces the same grid on every request, so a
 * user who forges their way past this still gets a 403.
 */
export function Can({ module, action, children, fallback = null }: CanProps) {
  const allowed = useCan(module, action)
  return <>{allowed ? children : fallback}</>
}
