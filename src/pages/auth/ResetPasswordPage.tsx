import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { validateStrongPassword } from '../../lib/auth-utils'
import { useToast } from '../../components/ToastProvider'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { resetPassword } = useAuth()
  const { showToast } = useToast()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error')
      return
    }
    const pwdError = validateStrongPassword(password)
    if (pwdError) {
      showToast(pwdError, 'error')
      return
    }
    setLoading(true)
    const { error } = await resetPassword(password)
    setLoading(false)
    if (error) {
      showToast(error, 'error')
      return
    }
    showToast('Password updated successfully.', 'success')
    navigate('/auth/login')
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Reset Password</h2>
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="New password" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
      <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="Confirm new password" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
      <button onClick={submit} disabled={loading} className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
        {loading ? 'Updating...' : 'Update password'}
      </button>
    </div>
  )
}

