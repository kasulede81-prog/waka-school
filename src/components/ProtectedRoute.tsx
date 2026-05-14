import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '../types'
import { useAuth } from '../lib/auth'
import { getSiteKind, redirectToParentHome, redirectToStaffApp } from '../lib/site'

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
    if (profile.role === 'parent') {
      if (getSiteKind() === 'app') {
        redirectToParentHome()
        return <div className="p-6 text-sm text-slate-600">Opening parent portal…</div>
      }
      return <Navigate to="/portal" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  if (allowedRoles) {
    if (!profile) return <Navigate to="/dashboard" replace />
    if (!allowedRoles.includes(profile.role)) {
      if (profile.role === 'parent') {
        if (getSiteKind() === 'app') {
          redirectToParentHome()
          return <div className="p-6 text-sm text-slate-600">Opening parent portal…</div>
        }
        return <Navigate to="/portal" replace />
      }
      if (getSiteKind() === 'portal') {
        redirectToStaffApp('/dashboard')
        return <div className="p-6 text-sm text-slate-600">Opening school app…</div>
      }
      return <Navigate to="/dashboard" replace />
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

