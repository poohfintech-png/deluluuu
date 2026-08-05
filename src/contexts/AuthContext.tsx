import * as React from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole, EntitlementKey, UserMembership } from '@/types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  isWriter: boolean
  isActiveSubscriber: boolean
  isEmailVerified: boolean
  entitlements: Set<EntitlementKey>
  activeMembership: UserMembership | null
  hasEntitlement: (key: EntitlementKey) => boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, displayName: string, role?: UserRole) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshEntitlements: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [session, setSession] = React.useState<Session | null>(null)
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [isActiveSubscriber, setIsActiveSubscriber] = React.useState(false)
  const [entitlements, setEntitlements] = React.useState<Set<EntitlementKey>>(new Set())
  const [activeMembership, setActiveMembership] = React.useState<UserMembership | null>(null)

  const fetchProfile = React.useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
    if (error) {
      console.error('Profile fetch error:', error)
      return null
    }
    return data as Profile | null
  }, [])

  const checkEntitlements = React.useCallback(async (uid: string, role: string | undefined) => {

    if (role === 'admin') {
      setEntitlements(new Set(['all_access' as EntitlementKey]))
      setIsActiveSubscriber(true)
      setActiveMembership(null)
      return
    }
    const { data } = await supabase
      .from('user_memberships')
      .select('*, plan:membership_plans(*)')
      .eq('user_id', uid)
      .eq('status', 'active')
      .gt('end_date', new Date().toISOString())
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
       
      const membership = data as unknown as UserMembership
      setActiveMembership(membership)
      setEntitlements(new Set(membership.entitlements as EntitlementKey[]))
      setIsActiveSubscriber(membership.entitlements.includes('premium_books') || membership.entitlements.includes('all_access'))
    } else {
      setActiveMembership(null)
      setEntitlements(new Set())
      setIsActiveSubscriber(false)
    }
  }, [])

  const refreshProfile = React.useCallback(async () => {
    if (user) {
      const p = await fetchProfile(user.id)
      setProfile(p)
      await checkEntitlements(user.id, p?.role)
    }
  }, [user, fetchProfile, checkEntitlements])

  const refreshEntitlements = React.useCallback(async () => {
    if (user) {
      await checkEntitlements(user.id, profile?.role)
    }
  }, [user, profile, checkEntitlements])

  React.useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        Promise.all([fetchProfile(session.user.id)]).then(
          async ([p]) => {
            if (!mounted) return
            setProfile(p)
            await checkEntitlements(session.user.id, p?.role)
            setLoading(false)
          },
        )
      } else {
        setLoading(false)
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (!session?.user) {
        setProfile(null)
        setIsActiveSubscriber(false)
        setEntitlements(new Set())
        setActiveMembership(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [fetchProfile, checkEntitlements])

  React.useEffect(() => {
    if (user && !profile) {
      refreshProfile()
    }
  }, [user, profile, refreshProfile])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data.user) {
      try {
        const ua = navigator.userAgent
        await supabase.from('admin_login_history').insert({
          user_id: data.user.id,
          email,
          user_agent: ua,
          success: true,
        })
      } catch { /* non-critical */ }
    } else if (error) {
      try {
        await supabase.from('admin_login_history').insert({
          email,
          user_agent: navigator.userAgent,
          success: false,
        })
      } catch { /* non-critical */ }
    }
    return { error: error?.message ?? null }
  }

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    role: UserRole = 'reader',
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, role } },
    })
    if (error) return { error: error.message }
    if (data.user) {
      const p = await fetchProfile(data.user.id)
      setProfile(p)
    }
    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
    setIsActiveSubscriber(false)
    setEntitlements(new Set())
    setActiveMembership(null)
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    })
    return { error: error?.message ?? null }
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) {
      await supabase
        .from('profiles')
        .update({ password_changed_at: new Date().toISOString() })
        .eq('id', user?.id ?? '')
    }
    return { error: error?.message ?? null }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isAdmin: profile?.role === 'admin',
        isWriter: profile?.role === 'writer' || profile?.role === 'admin',
        isActiveSubscriber,
        isEmailVerified: !!user?.email_confirmed_at,
        entitlements,
        activeMembership,
        hasEntitlement: (key: EntitlementKey) => {
          if (profile?.role === 'admin') return true
          return entitlements.has(key) || entitlements.has('all_access' as EntitlementKey)
        },
        signIn,
        signUp,
        signOut,
        refreshProfile,
        refreshEntitlements,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
