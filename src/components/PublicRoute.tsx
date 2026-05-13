import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function PublicRoute() {
  const { loading, user, profile } = useAuth()
  const location = useLocation()
  const isKiosk = location.pathname.startsWith('/kiosk')

  if (loading) return <div className="p-6 text-sm">Loading session...</div>

  if (user && !isKiosk) return <Navigate to={profile?.role === 'parent' ? '/portal' : '/dashboard'} replace />

  return <Outlet />
}

