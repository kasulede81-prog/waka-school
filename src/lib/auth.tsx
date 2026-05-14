import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Role } from '../types'
import { emailConfirmationRedirectUrl, passwordResetRedirectUrl } from './site'

interface Profile {
  id: string
  organization_id: string | null
  full_name: string
  phone: string | null
  role: Role
}

interface AuthContextValue {
  loading: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  permissions: string[]
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (payload: {
    fullName: string
    schoolName: string
    email: string
    phone: string
    password: string
  }) => Promise<{ error?: string; needsEmailVerification?: boolean }>
  forgotPassword: (email: string) => Promise<{ error?: string }>
  resetPassword: (newPassword: string) => Promise<{ error?: string }>
  requestPhoneOtp: (phone: string) => Promise<{ error?: string }>
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let cancelled = false
    const loadingFailsafe = window.setTimeout(() => {
      if (!cancelled) {
        console.warn('Auth: session check exceeded time limit; continuing without session.')
        setLoading(false)
      }
    }, 12_000)

    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (cancelled) return
        if (error) console.warn('Supabase getSession:', error.message)
        setSession(data.session ?? null)
        if (data.session?.user) {
          try {
            await loadProfile(data.session.user.id)
          } catch (e) {
            console.error('loadProfile failed:', e)
          }
        }
      } catch (e) {
        console.error('Auth session init failed:', e)
      } finally {
        window.clearTimeout(loadingFailsafe)
        if (!cancelled) setLoading(false)
      }
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      if (nextSession?.user) {
        try {
          await loadProfile(nextSession.user.id)
        } catch (e) {
          console.error('loadProfile (auth state):', e)
        }
      } else {
        setProfile(null)
        setPermissions([])
      }
    })

    return () => {
      cancelled = true
      window.clearTimeout(loadingFailsafe)
      subscription.unsubscribe()
    }
  }, [])

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('id, organization_id, full_name, phone, role')
      .eq('id', userId)
      .single()
    setProfile((data as Profile | null) ?? null)
    const { data: roleRows, error: roleError } = await supabase
      .from('user_role_assignments')
      .select('role_id')
      .eq('user_id', userId)
    if (roleError) {
      setPermissions([])
      return
    }
    const roleIds = (roleRows ?? []).map((r) => r.role_id).filter(Boolean)
    if (!roleIds.length) {
      setPermissions([])
      return
    }
    const { data: permissionLinks, error: linkError } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .in('role_id', roleIds)
    if (linkError) {
      setPermissions([])
      return
    }
    const permissionIds = Array.from(new Set((permissionLinks ?? []).map((p) => p.permission_id).filter(Boolean)))
    if (!permissionIds.length) {
      setPermissions([])
      return
    }
    const { data: permissionRows, error: permissionError } = await supabase
      .from('permissions')
      .select('code')
      .in('id', permissionIds)
    if (permissionError) {
      setPermissions([])
      return
    }
    const codes = new Set<string>()
    ;(permissionRows ?? []).forEach((p) => {
      if (p.code) codes.add(p.code)
    })
    setPermissions(Array.from(codes))
  }

  async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase environment variables are missing.' }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message }
  }

  async function signUp(payload: {
    fullName: string
    schoolName: string
    email: string
    phone: string
    password: string
  }) {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase environment variables are missing.' }
    }
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        emailRedirectTo: emailConfirmationRedirectUrl(),
        data: {
          full_name: payload.fullName,
          school_name: payload.schoolName,
          phone: payload.phone,
        },
      },
    })
    if (error) return { error: error.message }
    return { needsEmailVerification: !data.session }
  }

  async function forgotPassword(email: string) {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase environment variables are missing.' }
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetRedirectUrl(),
    })
    return { error: error?.message }
  }

  async function resetPassword(newPassword: string) {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase environment variables are missing.' }
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error?.message }
  }

  async function signOut() {
    if (!isSupabaseConfigured) return
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
    setPermissions([])
  }

  async function requestPhoneOtp(phone: string) {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase environment variables are missing.' }
    }
    const { error } = await supabase.auth.signInWithOtp({ phone })
    return { error: error?.message }
  }

  async function verifyPhoneOtp(phone: string, token: string) {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase environment variables are missing.' }
    }
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    })
    return { error: error?.message }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      permissions,
      signIn,
      signUp,
      forgotPassword,
      resetPassword,
      requestPhoneOtp,
      verifyPhoneOtp,
      signOut,
    }),
    [loading, permissions, profile, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

