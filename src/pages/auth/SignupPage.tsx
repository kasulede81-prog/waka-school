import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { normalizeUgPhone, validateStrongPassword } from '../../lib/auth-utils'
import { useToast } from '../../components/ToastProvider'

export function SignupPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState({
    fullName: '',
    schoolName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!form.fullName.trim() || !form.schoolName.trim() || !form.email.trim() || !form.phone.trim()) {
      showToast('All fields are required.', 'error')
      return
    }
    if (form.password !== form.confirmPassword) {
      showToast('Passwords do not match.', 'error')
      return
    }
    const pwdError = validateStrongPassword(form.password)
    if (pwdError) {
      showToast(pwdError, 'error')
      return
    }
    let normalizedPhone = ''
    try {
      normalizedPhone = normalizeUgPhone(form.phone)
    } catch (e) {
      showToast((e as Error).message, 'error')
      return
    }

    setLoading(true)
    const result = await signUp({
      fullName: form.fullName.trim(),
      schoolName: form.schoolName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: normalizedPhone,
      password: form.password,
    })
    setLoading(false)
    if (result.error) {
      showToast(result.error, 'error')
      return
    }
    if (result.needsEmailVerification) {
      showToast('Signup successful. Verify your email, then login.', 'success')
      navigate('/auth/login')
      return
    }
    showToast('Account created successfully.', 'success')
    navigate('/dashboard')
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Create Account</h2>
      <input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Full name" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
      <input value={form.schoolName} onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))} placeholder="School / organization name" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
      <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
      <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+2567XXXXXXXX or 07XXXXXXXX" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
      <input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} type="password" placeholder="Password" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
      <input value={form.confirmPassword} onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))} type="password" placeholder="Confirm password" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
      <button onClick={submit} disabled={loading} className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
        {loading ? 'Creating account...' : 'Create account'}
      </button>
      <p className="text-xs text-slate-500">
        Already have an account? <Link to="/auth/login" className="text-emerald-700 dark:text-emerald-400">Login</Link>
      </p>
    </div>
  )
}

