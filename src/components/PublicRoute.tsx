import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getSiteKind, redirectToParentHome, redirectToStaffApp } from '../lib/site'

export function PublicRoute() {
  const { loading, user, profile } = useAuth()
  const location = useLocation()
  const isKiosk = location.pathname.startsWith('/kiosk')

  if (loading) return <div className="p-6 text-sm">Loading session...</div>

  if (user && !isKiosk) {
    if (profile?.role === 'parent') {
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

  return <Outlet />
}

