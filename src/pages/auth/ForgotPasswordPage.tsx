import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../components/ToastProvider'

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setLoading(true)
    const { error } = await forgotPassword(email.trim().toLowerCase())
    setLoading(false)
    if (error) {
      showToast(error, 'error')
      return
    }
    showToast('Password reset email sent.', 'success')
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Forgot Password</h2>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
      <button onClick={submit} disabled={loading} className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
        {loading ? 'Sending...' : 'Send reset link'}
      </button>
      <p className="text-xs text-slate-500">
        <Link to="/auth/login" className="text-emerald-700 dark:text-emerald-400">Back to login</Link>
      </p>
    </div>
  )
}

