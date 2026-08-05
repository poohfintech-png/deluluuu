import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { EntitlementKey, UserMembership } from '@/types'

export function useEntitlements() {
  const { user, isAdmin } = useAuth()
  const [entitlements, setEntitlements] = useState<Set<EntitlementKey>>(new Set())
  const [activeMembership, setActiveMembership] = useState<UserMembership | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setEntitlements(new Set())
      setActiveMembership(null)
      setLoading(false)
      return
    }

    if (isAdmin) {
      setEntitlements(new Set(['all_access' as EntitlementKey]))
      setActiveMembership(null)
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('user_memberships')
      .select('*, plan:membership_plans(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      const membership = data as unknown as UserMembership
      setActiveMembership(membership)
      setEntitlements(new Set(membership.entitlements as EntitlementKey[]))
    } else {
      setActiveMembership(null)
      setEntitlements(new Set())
    }
    setLoading(false)
  }, [user, isAdmin])

  useEffect(() => {
    refresh()
  }, [refresh])

  const hasEntitlement = useCallback(
    (key: EntitlementKey): boolean => {
      if (isAdmin) return true
      return entitlements.has(key) || entitlements.has('all_access' as EntitlementKey)
    },
    [entitlements, isAdmin],
  )

  const canReadPremiumBooks = useCallback((): boolean => hasEntitlement('premium_books'), [hasEntitlement])

  return {
    entitlements,
    activeMembership,
    loading,
    hasEntitlement,
    canReadPremiumBooks,
    refresh,
  }
}
