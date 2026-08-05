import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit, Trash2, Save, X, Archive, RotateCcw, Loader2, CreditCard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { MembershipPlan, MembershipPlanStatus, EntitlementKey } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { formatINR, formatDate } from '@/lib/utils'

const ALL_ENTITLEMENTS: { key: EntitlementKey; label: string }[] = [
  { key: 'premium_books', label: 'Premium Books' },
  { key: 'premium_audiobooks', label: 'Premium Audiobooks' },
  { key: 'premium_reels', label: 'Premium Reels' },
  { key: 'premium_drama', label: 'Premium Dramas' },
  { key: 'future_content', label: 'Future Premium Content' },
  { key: 'all_access', label: 'All Access' },
]

export function AdminMembershipPlansPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<MembershipPlan | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  const fetchPlans = useCallback(async () => {
    const { data, error } = await supabase
      .from('membership_plans')
      .select('*')
      .order('display_order', { ascending: true })
    if (error) {
      toast('Failed to load plans', 'error')
    } else {
      setPlans(data as MembershipPlan[])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  const handleSave = async (plan: Partial<MembershipPlan>) => {
    if (!plan.name || !plan.price_inr || !plan.duration_days) {
      toast('Name, price, and duration are required', 'error')
      return
    }

    const benefits = plan.benefits ?? ['premium_books']
    const planData = {
      name: plan.name,
      description: plan.description ?? null,
      short_description: plan.short_description ?? null,
      long_description: plan.long_description ?? null,
      price_inr: plan.price_inr,
      price_intl: plan.price_intl ?? null,
      intl_currency: plan.intl_currency ?? 'USD',
      currency: plan.currency ?? 'INR',
      duration_days: plan.duration_days,
      duration_type: plan.duration_type ?? 'monthly',
      billing_type: plan.billing_type ?? 'one_time',
      benefits,
      display_order: plan.display_order ?? 0,
      status: plan.status ?? 'active',
      is_visible: plan.is_visible ?? true,
      is_popular: plan.is_popular ?? false,
      is_recommended: plan.is_recommended ?? false,
      badge: plan.badge ?? null,
      accent_color: plan.accent_color ?? 'primary',
    }

    if (editing) {
      // Increment version on edit
      const { error } = await supabase
        .from('membership_plans')
        .update({ ...planData, plan_version: (editing.plan_version ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq('id', editing.id)
      if (error) {
        toast('Failed to update plan', 'error')
      } else {
        toast('Plan updated — existing subscribers keep their version', 'success')
        await supabase.rpc('admin_log_action', {
          p_action: 'plan_updated', p_entity_type: 'membership_plan', p_entity_id: editing.id,
        })
        fetchPlans()
      }
    } else {
      const { error } = await supabase
        .from('membership_plans')
        .insert({ ...planData, created_by: user?.id })
      if (error) {
        toast('Failed to create plan', 'error')
      } else {
        toast('Plan created', 'success')
        await supabase.rpc('admin_log_action', {
          p_action: 'plan_created', p_entity_type: 'membership_plan',
        })
        fetchPlans()
      }
    }
    setShowEditor(false)
    setEditing(null)
  }

  const handleArchive = async (plan: MembershipPlan) => {
    const activeCount = plans.filter(p => p.status === 'active').length
    if (plan.status === 'active' && activeCount <= 1) {
      toast('Cannot archive the only active plan', 'error')
      return
    }
    const { error } = await supabase
      .from('membership_plans')
      .update({ status: 'archived', is_visible: false, updated_at: new Date().toISOString() })
      .eq('id', plan.id)
    if (error) {
      toast('Failed to archive plan', 'error')
    } else {
      toast('Plan archived', 'info')
      await supabase.rpc('admin_log_action', {
        p_action: 'plan_archived', p_entity_type: 'membership_plan', p_entity_id: plan.id,
      })
      fetchPlans()
    }
  }

  const handleDisable = async (plan: MembershipPlan) => {
    const activeCount = plans.filter(p => p.status === 'active').length
    if (plan.status === 'active' && activeCount <= 1) {
      toast('Cannot disable the only active plan', 'error')
      return
    }
    const { error } = await supabase
      .from('membership_plans')
      .update({ status: 'disabled', updated_at: new Date().toISOString() })
      .eq('id', plan.id)
    if (error) {
      toast('Failed to disable plan', 'error')
    } else {
      toast('Plan disabled', 'info')
      fetchPlans()
    }
  }

  const handleEnable = async (plan: MembershipPlan) => {
    const { error } = await supabase
      .from('membership_plans')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', plan.id)
    if (error) {
      toast('Failed to enable plan', 'error')
    } else {
      toast('Plan enabled', 'success')
      fetchPlans()
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="font-serif text-2xl font-semibold mb-6">Membership Plans</h1>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-semibold">Membership Plans</h1>
        <Button onClick={() => { setEditing(null); setShowEditor(true) }}>
          <Plus className="h-4 w-4" /> New Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <EmptyState icon={CreditCard} title="No plans yet" description="Create your first membership plan." />
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-lg">{plan.name}</h3>
                      <Badge variant={plan.status === 'active' ? 'success' : plan.status === 'archived' ? 'secondary' : 'warning'}>
                        {plan.status}
                      </Badge>
                      {plan.is_visible ? <Badge variant="default">Visible</Badge> : <Badge variant="secondary">Hidden</Badge>}
                      {plan.is_popular && <Badge variant="default">Popular</Badge>}
                      {plan.is_recommended && <Badge variant="default">Recommended</Badge>}
                      <Badge variant="outline">v{plan.plan_version}</Badge>
                    </div>
                    {plan.description && <p className="text-sm text-muted-foreground mb-2">{plan.description}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-2">
                      <span>INR: {formatINR(plan.price_inr)}</span>
                      {plan.price_intl != null && <span>Intl: ${(plan.price_intl / 100).toFixed(2)}</span>}
                      <span>Duration: {plan.duration_days} days</span>
                      <span>Order: {plan.display_order}</span>
                      <span>Updated: {formatDate(plan.updated_at)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {plan.benefits.map((b) => (
                        <Badge key={b} variant="outline" className="text-xs">
                          {ALL_ENTITLEMENTS.find(e => e.key === b)?.label ?? b}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(plan); setShowEditor(true) }}>
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </Button>
                    {plan.status === 'active' ? (
                      <Button size="sm" variant="ghost" onClick={() => handleDisable(plan)}>Disable</Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => handleEnable(plan)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Enable
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleArchive(plan)}>
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showEditor && (
        <PlanEditor
          plan={editing}
          onClose={() => { setShowEditor(false); setEditing(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

function PlanEditor({ plan, onClose, onSave }: {
  plan: MembershipPlan | null
  onClose: () => void
  onSave: (plan: Partial<MembershipPlan>) => void
}) {
  const [name, setName] = useState(plan?.name ?? '')
  const [description, setDescription] = useState(plan?.description ?? '')
  const [shortDescription, setShortDescription] = useState(plan?.short_description ?? '')
  const [longDescription, setLongDescription] = useState(plan?.long_description ?? '')
  const [priceInr, setPriceInr] = useState(plan?.price_inr ?? 99)
  const [priceIntl, setPriceIntl] = useState<number | ''>(plan?.price_intl ?? '')
  const [intlCurrency, setIntlCurrency] = useState(plan?.intl_currency ?? 'USD')
  const [durationDays, setDurationDays] = useState(plan?.duration_days ?? 30)
  const [durationType, setDurationType] = useState(plan?.duration_type ?? 'monthly')
  const [billingType, setBillingType] = useState(plan?.billing_type ?? 'one_time')
  const [displayOrder, setDisplayOrder] = useState(plan?.display_order ?? 0)
  const [isVisible, setIsVisible] = useState(plan?.is_visible ?? true)
  const [isPopular, setIsPopular] = useState(plan?.is_popular ?? false)
  const [isRecommended, setIsRecommended] = useState(plan?.is_recommended ?? false)
  const [badge, setBadge] = useState(plan?.badge ?? '')
  const [accentColor, setAccentColor] = useState(plan?.accent_color ?? 'primary')
  const [benefits, setBenefits] = useState<string[]>(plan?.benefits ?? ['premium_books'])
  const [saving, setSaving] = useState(false)

  const toggleBenefit = (key: string) => {
    setBenefits(prev => prev.includes(key) ? prev.filter(b => b !== key) : [...prev, key])
  }

  const handleSave = () => {
    setSaving(true)
    onSave({
      name, description: description || null,
      short_description: shortDescription || null,
      long_description: longDescription || null,
      price_inr: priceInr, price_intl: priceIntl === '' ? null : priceIntl,
      intl_currency: intlCurrency,
      duration_days: durationDays, duration_type: durationType,
      billing_type: billingType,
      display_order: displayOrder,
      is_visible: isVisible, is_popular: isPopular, is_recommended: isRecommended,
      badge: badge || null, accent_color: accentColor,
      benefits,
    })
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{plan ? 'Edit Plan' : 'New Membership Plan'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Plan Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="DELULU Premium" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Unlock all premium books" />
          </div>
          <div className="space-y-2">
            <Label>Short Description</Label>
            <Input value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="Unlock all premium books" />
          </div>
          <div className="space-y-2">
            <Label>Long Description</Label>
            <Textarea value={longDescription} onChange={(e) => setLongDescription(e.target.value)} rows={3} placeholder="Detailed description shown on plan details page" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price (INR paise)</Label>
              <Input type="number" value={priceInr} onChange={(e) => setPriceInr(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">99 = ₹0.99</p>
            </div>
            <div className="space-y-2">
              <Label>Price Intl (cents)</Label>
              <Input type="number" value={priceIntl} onChange={(e) => setPriceIntl(e.target.value === '' ? '' : Number(e.target.value))} placeholder="299" />
              <p className="text-xs text-muted-foreground">299 = $2.99</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Intl Currency</Label>
              <select value={intlCurrency} onChange={(e) => setIntlCurrency(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-secondary/40 px-3 py-2 text-sm">
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Duration Type</Label>
              <select value={durationType} onChange={(e) => setDurationType(e.target.value as 'monthly' | 'yearly' | 'lifetime' | 'custom')} className="flex h-10 w-full rounded-md border border-input bg-secondary/40 px-3 py-2 text-sm">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="lifetime">Lifetime</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duration (days)</Label>
              <Input type="number" value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Display Order</Label>
              <Input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Badge Text (optional)</Label>
              <Input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Best Value" />
            </div>
            <div className="space-y-2">
              <Label>Accent Color</Label>
              <select value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-secondary/40 px-3 py-2 text-sm">
                <option value="primary">Primary</option>
                <option value="amber">Amber</option>
                <option value="emerald">Emerald</option>
                <option value="rose">Rose</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Benefits / Entitlements</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_ENTITLEMENTS.map((e) => (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => toggleBenefit(e.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    benefits.includes(e.key)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isVisible} onChange={(e) => setIsVisible(e.target.checked)} />
            Visible to readers
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPopular} onChange={(e) => setIsPopular(e.target.checked)} />
            Mark as Popular
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isRecommended} onChange={(e) => setIsRecommended(e.target.checked)} />
            Mark as Recommended
          </label>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {plan ? 'Save Changes' : 'Create Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
