import { useEffect } from 'react'
import { appSignupUrl } from '../lib/site'

export function RedirectToAppSignup() {
  useEffect(() => {
    window.location.replace(appSignupUrl())
  }, [])
  return <div className="p-6 text-center text-sm text-slate-500">Redirecting to school registration…</div>
}
