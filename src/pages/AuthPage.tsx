import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandLogoLockup } from '../components/BrandLogo'
import { useAuth } from '../lib/auth'
import { isSupabaseConfigured } from '../lib/supabase'

export function AuthPage() {
  const navigate = useNavigate()
  const { signIn, requestPhoneOtp, verifyPhoneOtp, profile, user } = useAuth()
  const [mode, setMode] = useState<'password' | 'otp'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user && profile) {
      navigate(profile.role === 'parent' ? '/portal' : '/dashboard')
    }
  }, [navigate, profile, user])

  async function handleSignIn() {
    setLoading(true)
    setError('')
    const result = await signIn(email, password)
    if (result.error) setError(result.error)
    else navigate('/dashboard')
    setLoading(false)
  }

  async function handleRequestOtp() {
    setLoading(true)
    setError('')
    setMessage('')
    const result = await requestPhoneOtp(phone)
    if (result.error) setError(result.error)
    else {
      setOtpSent(true)
      setMessage('OTP sent. Enter code from SMS to continue.')
    }
    setLoading(false)
  }

  async function handleVerifyOtp() {
    setLoading(true)
    setError('')
    const result = await verifyPhoneOtp(phone, otp)
    if (result.error) setError(result.error)
    else navigate('/dashboard')
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <BrandLogoLockup layout="inline" className="mb-4" />
        <h1 className="sr-only">Waka School Login</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Email/password authentication with tenant-aware Supabase profiles.
        </p>
        {!isSupabaseConfigured ? (
          <p className="mt-2 rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900">Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` to enable login.</p>
        ) : null}
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode('password')} className={`rounded-md px-3 py-2 text-xs ${mode === 'password' ? 'bg-emerald-600 text-white' : 'border border-slate-300 dark:border-slate-700'}`}>Password</button>
            <button onClick={() => setMode('otp')} className={`rounded-md px-3 py-2 text-xs ${mode === 'otp' ? 'bg-emerald-600 text-white' : 'border border-slate-300 dark:border-slate-700'}`}>Phone OTP</button>
          </div>
          {mode === 'password' ? (
            <>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Email address" />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Password" />
            </>
          ) : (
            <>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="+2567XXXXXXXX" />
              {otpSent ? (
                <input value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="6-digit OTP" />
              ) : null}
            </>
          )}
          {message ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p> : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          {mode === 'password' ? (
            <button disabled={loading || !isSupabaseConfigured} onClick={handleSignIn} className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          ) : otpSent ? (
            <button disabled={loading || !isSupabaseConfigured} onClick={handleVerifyOtp} className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          ) : (
            <button disabled={loading || !isSupabaseConfigured} onClick={handleRequestOtp} className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

