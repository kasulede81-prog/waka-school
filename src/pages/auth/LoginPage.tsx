import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../components/ToastProvider'

export function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)
    if (error) {
      showToast(error, 'error')
      return
    }
    showToast('Login successful', 'success')
    navigate('/dashboard')
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Login</h2>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
      <button onClick={submit} disabled={loading} className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
      <div className="flex justify-between text-xs">
        <Link to="/auth/signup" className="text-emerald-700 dark:text-emerald-400">Create account</Link>
        <Link to="/auth/forgot-password" className="text-emerald-700 dark:text-emerald-400">Forgot password?</Link>
      </div>
    </div>
  )
}

