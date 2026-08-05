import { useState, useEffect, useCallback } from 'react'
import {
  Settings2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Save,
  ChevronDown,
  ChevronUp,
  CreditCard,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { FeatureFlag, FeatureFlagStatus, FeatureDependency, PaymentMode } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { key: 'monetization', label: 'Monetization', keys: ['coins_system', 'premium_chapters', 'writer_earnings', 'subscriptions', 'payment_system'] },
  { key: 'content', label: 'Content Types', keys: ['reels', 'audiobooks'] },
  { key: 'community', label: 'Community', keys: ['comments', 'ratings', 'reviews', 'messaging'] },
  { key: 'ai', label: 'AI Features', keys: ['ai_writer_tools', 'ai_cover_generator'] },
  { key: 'panic', label: 'Panic Switches', keys: ['registration', 'writer_applications', 'uploads'] },
]

const STATUS_OPTIONS: { value: FeatureFlagStatus; label: string; icon: typeof CheckCircle2; color: string }[] = [
  { value: 'disabled', label: 'Disabled', icon: XCircle, color: 'text-destructive' },
  { value: 'coming_soon', label: 'Coming Soon', icon: Clock, color: 'text-warning' },
  { value: 'enabled', label: 'Enabled', icon: CheckCircle2, color: 'text-success' },
]

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'disabled', label: 'Disabled' },
  { value: 'manual_payment', label: 'Manual Payment' },
  { value: 'gateway_payment', label: 'Gateway Payment' },
  { value: 'both', label: 'Both' },
]

export function AdminFeatureFlagsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [dependencies, setDependencies] = useState<FeatureDependency[]>([])
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('manual_payment')
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [savingPayment, setSavingPayment] = useState(false)
  const [expandedDeps, setExpandedDeps] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    const [flagsRes, depsRes, settingsRes] = await Promise.all([
      supabase.from('feature_flags').select('*').order('feature_key'),
      supabase.from('feature_dependencies').select('*'),
      supabase.from('platform_settings').select('*'),
    ])
    setFlags((flagsRes.data as FeatureFlag[]) ?? [])
    setDependencies((depsRes.data as FeatureDependency[]) ?? [])
    const settingsMap: Record<string, string> = {}
    for (const s of (settingsRes.data as { setting_key: string; setting_value: string | null }[] | null) ?? []) {
      settingsMap[s.setting_key] = s.setting_value ?? ''
    }
    setPaymentMode((settingsMap['payment_mode'] as PaymentMode) ?? 'manual_payment')
    setMaintenanceMode(settingsMap['maintenance_mode'] === 'true')
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const getDependents = (featureKey: string) =>
    dependencies.filter((d) => d.required_feature_key === featureKey && d.dependency_type === 'requires')

  const getRequirements = (featureKey: string) =>
    dependencies.filter((d) => d.feature_key === featureKey && d.dependency_type === 'requires')

  const canEnable = (featureKey: string): { ok: boolean; missing: FeatureFlag[] } => {
    const reqs = getRequirements(featureKey)
    const missing: FeatureFlag[] = []
    for (const r of reqs) {
      const reqFlag = flags.find((f) => f.feature_key === r.required_feature_key)
      if (reqFlag && reqFlag.status !== 'enabled') missing.push(reqFlag)
    }
    return { ok: missing.length === 0, missing }
  }

  const handleStatusChange = async (flag: FeatureFlag, newStatus: FeatureFlagStatus) => {
    if (newStatus === 'enabled') {
      const { ok, missing } = canEnable(flag.feature_key)
      if (!ok) {
        const names = missing.map((m) => m.feature_name).join(', ')
        toast(`Cannot enable: requires ${names} to be enabled first`, 'error')
        return
      }
    }

    setUpdating(flag.feature_key)
    const { error } = await supabase
      .from('feature_flags')
      .update({ status: newStatus, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('id', flag.id)

    if (error) {
      toast('Failed to update: ' + error.message, 'error')
    } else {
      toast(`${flag.feature_name} set to ${newStatus.replace('_', ' ')}`, 'success')
      fetchData()
    }
    setUpdating(null)
  }

  const handlePaymentModeChange = async (mode: PaymentMode) => {
    setSavingPayment(true)
    const { error } = await supabase
      .from('platform_settings')
      .update({ setting_value: mode, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('setting_key', 'payment_mode')

    if (error) {
      toast('Failed to update payment mode', 'error')
    } else {
      setPaymentMode(mode)
      toast('Payment mode updated', 'success')
    }
    setSavingPayment(false)
  }

  const handleMaintenanceToggle = async (enabled: boolean) => {
    setSavingPayment(true)
    const { error } = await supabase
      .from('platform_settings')
      .update({ setting_value: enabled ? 'true' : 'false', updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('setting_key', 'maintenance_mode')
    if (error) {
      toast('Failed to update maintenance mode', 'error')
    } else {
      setMaintenanceMode(enabled)
      toast(enabled ? 'Maintenance mode enabled — visitors see maintenance page' : 'Maintenance mode disabled', 'success')
      await supabase.rpc('admin_log_action', { p_action: enabled ? 'maintenance_enabled' : 'maintenance_disabled' })
    }
    setSavingPayment(false)
  }

  const toggleExpanded = (key: string) => {
    setExpandedDeps((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
          <Settings2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-semibold">Platform Controls</h1>
          <p className="text-xs text-muted-foreground">Toggle features and manage dependencies</p>
        </div>
      </div>

      <Card className="mb-6 bg-card/90 border-border/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4" /> Payment Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <Select
              value={paymentMode}
              onValueChange={(v) => handlePaymentModeChange(v as PaymentMode)}
              disabled={savingPayment}
            >
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savingPayment && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Controls how payments are processed. Gateway integration is not yet active.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6 bg-card/90 border-border/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" /> Maintenance Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{maintenanceMode ? 'Active' : 'Inactive'}</p>
              <p className="text-xs text-muted-foreground">When enabled, visitors see a maintenance page. Admins can still log in.</p>
            </div>
            <button
              onClick={() => handleMaintenanceToggle(!maintenanceMode)}
              disabled={savingPayment}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                maintenanceMode ? 'bg-secondary/70' : 'bg-secondary/40',
              )}
            >
              <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', maintenanceMode ? 'translate-x-6' : 'translate-x-1')} />
            </button>
          </div>
        </CardContent>
      </Card>

      {CATEGORIES.map((cat) => (
        <div key={cat.key} className="mb-8">
          <h2 className="font-serif text-lg font-semibold mb-4">{cat.label}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cat.keys.map((key) => {
              const flag = flags.find((f) => f.feature_key === key)
              if (!flag) return null
              const dependents = getDependents(key)
              const requirements = getRequirements(key)
              const { ok } = canEnable(key)
              const isExpanded = expandedDeps.has(key)
              const statusOpt = STATUS_OPTIONS.find((s) => s.value === flag.status)
              const StatusIcon = statusOpt?.icon ?? XCircle

              return (
                <Card key={key} className={cn('bg-card/90 border-border/30', flag.status === 'disabled' && 'opacity-75')}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm">{flag.feature_name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{flag.description}</p>
                      </div>
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ml-3 bg-secondary/40', statusOpt?.color)}>
                        <StatusIcon className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <Select
                        value={flag.status}
                        onValueChange={(v) => handleStatusChange(flag, v as FeatureFlagStatus)}
                        disabled={updating === key}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {updating === key && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    </div>

                    {(dependents.length > 0 || requirements.length > 0) && (
                      <div className="border-t border-border/50 pt-3">
                        <button
                          onClick={() => toggleExpanded(key)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                        >
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          Dependency info
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2">
                            {dependents.length > 0 && flag.status === 'disabled' && (
                              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-2">
                                <p className="text-[10px] font-medium text-destructive mb-1">Blocked Features</p>
                                {dependents.map((d) => {
                                  const depFlag = flags.find((f) => f.feature_key === d.feature_key)
                                  return (
                                    <div key={d.id} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <XCircle className="h-2.5 w-2.5 text-destructive" />
                                      {depFlag?.feature_name ?? d.feature_key}
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {requirements.length > 0 && (
                              <div className="rounded-lg bg-secondary/10 border border-border/30 p-2">
                                <p className="text-[10px] font-medium text-foreground/80 mb-1">Requires</p>
                                {requirements.map((r) => {
                                  const reqFlag = flags.find((f) => f.feature_key === r.required_feature_key)
                                  const isMet = reqFlag?.status === 'enabled'
                                  return (
                                    <div key={r.id} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      {isMet ? (
                                        <CheckCircle2 className="h-2.5 w-2.5 text-success" />
                                      ) : (
                                        <AlertTriangle className="h-2.5 w-2.5 text-warning" />
                                      )}
                                      {reqFlag?.feature_name ?? r.required_feature_key}
                                    </div>
                                  )
                                })}
                                {!ok && flag.status !== 'enabled' && (
                                  <p className="text-[10px] text-warning mt-1">
                                    Enable required features first to activate this one.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}