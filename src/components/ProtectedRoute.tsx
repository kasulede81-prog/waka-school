import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '../types'
import { useAuth } from '../lib/auth'

interface Props {
  allowedRoles?: Role[]
  requiredPermissions?: string[]
  denyRoles?: Role[]
}

export function ProtectedRoute({ allowedRoles, requiredPermissions, denyRoles }: Props) {
  const { loading, user, profile, permissions } = useAuth()
  const location = useLocation()

  if (loading) return <div className="p-6 text-sm">Loading session...</div>

  if (!user) return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />

  if (denyRoles && profile && denyRoles.includes(profile.role)) {
    return <Navigate to={profile.role === 'parent' ? '/portal' : '/dashboard'} replace />
  }

  if (allowedRoles) {
    if (!profile) return <Navigate to="/dashboard" replace />
    if (!allowedRoles.includes(profile.role)) {
      return <Navigate to={profile.role === 'parent' ? '/portal' : '/dashboard'} replace />
    }
  }

  if (requiredPermissions?.length) {
    const missing = requiredPermissions.some((permission) => !permissions.includes(permission))
    if (missing && profile?.role !== 'super_admin') {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <Outlet />
}

