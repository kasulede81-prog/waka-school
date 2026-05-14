import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../components/ToastProvider'
import { getSiteKind, postLoginPath, redirectToParentHome, redirectToStaffApp } from '../../lib/site'

export function LoginPage() {
  const navigate = useNavigate()
  const { signIn, user, profile, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingNav, setPendingNav] = useState(false)

  useEffect(() => {
    if (!pendingNav || authLoading) return
    if (!user || !profile) return

    const path = postLoginPath(profile.role)
    if (profile.role === 'parent' && getSiteKind() === 'app') {
      redirectToParentHome()
      return
    }
    if (profile.role !== 'parent' && getSiteKind() === 'portal') {
      redirectToStaffApp('/dashboard')
      return
    }
    navigate(path)
  }, [pendingNav, authLoading, user, profile, navigate])

  async function submit() {
    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)
    if (error) {
      showToast(error, 'error')
      return
    }
    showToast('Login successful', 'success')
    setPendingNav(true)
  }

  const site = getSiteKind()
  const signupHref = site === 'portal' ? undefined : '/auth/signup'

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Login</h2>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        placeholder="Password"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
      />
      <button
        onClick={submit}
        disabled={loading}
        className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
      <div className="flex justify-between text-xs">
        {signupHref ? (
          <Link to={signupHref} className="text-emerald-700 dark:text-emerald-400">
            Create account
          </Link>
        ) : (
          <span />
        )}
        <Link to="/auth/forgot-password" className="text-emerald-700 dark:text-emerald-400">
          Forgot password?
        </Link>
      </div>
    </div>
  )
}
