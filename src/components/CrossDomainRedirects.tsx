import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getAppOrigin, getPortalOrigin } from '../lib/site'

/** Full URL → app origin + current path (marketing / portal misuse of ERP paths). */
export function RedirectToAppOrigin() {
  const location = useLocation()
  useEffect(() => {
    window.location.replace(`${getAppOrigin()}${location.pathname}${location.search}${location.hash}`)
  }, [location.hash, location.pathname, location.search])
  return (
    <div className="flex min-h-[30vh] items-center justify-center bg-slate-50 px-4 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-400">
      Opening the school app…
    </div>
  )
}

/** Full URL → portal origin + current path (staff opening parent URLs on app host). */
export function RedirectToPortalOrigin() {
  const location = useLocation()
  useEffect(() => {
    window.location.replace(`${getPortalOrigin()}${location.pathname}${location.search}${location.hash}`)
  }, [location.hash, location.pathname, location.search])
  return (
    <div className="flex min-h-[30vh] items-center justify-center bg-slate-50 px-4 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-400">
      Opening the parent portal…
    </div>
  )
}
