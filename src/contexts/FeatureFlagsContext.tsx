import * as React from 'react'
import { supabase } from '@/lib/supabase'
import type { FeatureFlag, FeatureFlagStatus, PaymentMode } from '@/types'

interface FeatureFlagsContextValue {
  flags: Record<string, FeatureFlagStatus>
  loading: boolean
  isEnabled: (key: string) => boolean
  isComingSoon: (key: string) => boolean
  isDisabled: (key: string) => boolean
  getStatus: (key: string) => FeatureFlagStatus | undefined
  paymentMode: PaymentMode
  maintenanceMode: boolean
  refresh: () => Promise<void>
}

const FeatureFlagsContext = React.createContext<FeatureFlagsContextValue | null>(null)

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = React.useState<Record<string, FeatureFlagStatus>>({})
  const [paymentMode, setPaymentMode] = React.useState<PaymentMode>('manual_payment')
  const [maintenanceMode, setMaintenanceMode] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    const [flagsRes, settingsRes] = await Promise.all([
      supabase.from('feature_flags').select('*'),
      supabase.from('platform_settings').select('*'),
    ])

    const flagsMap: Record<string, FeatureFlagStatus> = {}
    for (const f of (flagsRes.data as FeatureFlag[] | null) ?? []) {
      flagsMap[f.feature_key] = f.status
    }
    setFlags(flagsMap)

    const settingsMap: Record<string, string> = {}
    for (const s of (settingsRes.data as { setting_key: string; setting_value: string | null }[] | null) ?? []) {
      settingsMap[s.setting_key] = s.setting_value ?? ''
    }
    const pm = settingsMap['payment_mode'] as PaymentMode | undefined
    if (pm) setPaymentMode(pm)
    setMaintenanceMode(settingsMap['maintenance_mode'] === 'true')

    setLoading(false)
  }, [])

  React.useEffect(() => {
    refresh()

    const channel = supabase
      .channel('feature-flags-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feature_flags' }, () => {
        refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_settings' }, () => {
        refresh()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const value: FeatureFlagsContextValue = {
    flags,
    loading,
    isEnabled: (key: string) => flags[key] === 'enabled',
    isComingSoon: (key: string) => flags[key] === 'coming_soon',
    isDisabled: (key: string) => flags[key] === 'disabled',
    getStatus: (key: string) => flags[key],
    paymentMode,
    maintenanceMode,
    refresh,
  }

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>
}

export function useFeatureFlags() {
  const ctx = React.useContext(FeatureFlagsContext)
  if (!ctx) throw new Error('useFeatureFlags must be used within FeatureFlagsProvider')
  return ctx
}
