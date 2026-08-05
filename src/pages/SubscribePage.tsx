import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Check, Upload, Lock, Smartphone, Sparkles, BadgeCheck, XCircle, Clock3, Globe, MapPin, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext'
import { useToast } from '@/contexts/ToastContext'
import type { MembershipPlan, PaymentRequest, BillingRegion, PaymentMethod, PaymentSetting } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatINR, formatDate, cn } from '@/lib/utils'

export function SubscribePage() {
  const { user, isActiveSubscriber, isAdmin, activeMembership } = useAuth()
  const { isEnabled, paymentMode } = useFeatureFlags()
  const paymentsEnabled = isEnabled('payment_system')
  const showManual = paymentsEnabled && (paymentMode === 'manual_payment' || paymentMode === 'both')
  const showGateway = paymentsEnabled && (paymentMode === 'gateway_payment' || paymentMode === 'both')
  const { toast } = useToast()

  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null)
  const [billingRegion, setBillingRegion] = useState<BillingRegion>('india')
  const [country, setCountry] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi')
  const [uploading, setUploading] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [transactionId, setTransactionId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [paymentSettings, setPaymentSettings] = useState<Record<string, string>>({})
  const [showInstructions, setShowInstructions] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchPaymentRequests = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('payment_requests')
      .select('*, plan:membership_plans(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setPaymentRequests(data as unknown as PaymentRequest[])
  }, [user])

  useEffect(() => {
    const fetchData = async () => {
      const [plansRes, settingsRes] = await Promise.all([
        supabase.from('membership_plans').select('*').eq('status', 'active').eq('is_visible', true).is('deleted_at', null).order('display_order', { ascending: true }),
        supabase.from('payment_settings').select('*'),
      ])
      if (plansRes.data) setPlans(plansRes.data as MembershipPlan[])
      if (settingsRes.data) {
        const map: Record<string, string> = {}
        for (const s of settingsRes.data as PaymentSetting[]) map[s.setting_key] = s.setting_value ?? ''
        setPaymentSettings(map)
      }
      fetchPaymentRequests()
      setLoading(false)
    }
    fetchData()
  }, [fetchPaymentRequests])

  const handleUpload = async (file: File) => {
    if (!user) { toast('Please sign in first', 'error'); return }
    if (!file.type.startsWith('image/')) { toast('Please upload an image file', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) { toast('Only JPG, PNG, WebP, and GIF are allowed', 'error'); return }
    setUploading(true)
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${user.id}/temp-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('payments').upload(path, file, { cacheControl: '3600' })
    if (error) { toast('Failed to upload screenshot', 'error'); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('payments').getPublicUrl(path)
    setScreenshotUrl(urlData.publicUrl)
    toast('Screenshot uploaded', 'success')
    setUploading(false)
  }

  // "Continue to Payment" — just show instructions, NO database row
  const handleContinue = () => {
    if (!selectedPlan) { toast('Please select a plan', 'error'); return }
    setShowInstructions(true)
  }

  // "Submit for Approval" — create the payment request WITH screenshot
  const handleSubmitProof = async () => {
    if (!user || !selectedPlan || !screenshotUrl) {
      toast('Please upload payment screenshot', 'error')
      return
    }
    setSubmitting(true)
    const { data, error } = await supabase.rpc('create_payment_request', {
      p_plan_id: selectedPlan.id,
      p_billing_region: billingRegion,
      p_country: country || null,
      p_payment_method: paymentMethod,
      p_screenshot_url: screenshotUrl,
      p_transaction_id: transactionId || null,
    })

    if (error) {
      toast('Failed to submit: ' + error.message, 'error')
    } else {
      toast('Payment proof submitted! Waiting for admin review.', 'success')
      resetPaymentFlow()
      fetchPaymentRequests()
    }
    setSubmitting(false)
  }

  const resetPaymentFlow = () => {
    setShowInstructions(false)
    setScreenshotUrl(null)
    setTransactionId('')
    setSelectedPlan(null)
    setCountry('')
  }

  if (loading) {
    return (
      <div className="container max-w-4xl py-12">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!paymentsEnabled) {
    return (
      <div className="container max-w-2xl py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mx-auto mb-4">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="font-serif text-2xl font-semibold mb-2">Subscriptions Unavailable</h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
          The payment system is currently disabled. Please check back later.
        </p>
        <Button asChild variant="outline"><Link to="/">Back to Home</Link></Button>
      </div>
    )
  }

  if (isActiveSubscriber || isAdmin) {
    return (
      <div className="container max-w-2xl py-12">
        <div className="text-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 border border-success/20 mx-auto mb-4">
            <BadgeCheck className="h-8 w-8 text-success" />
          </div>
          <h1 className="font-serif text-3xl font-semibold mb-2">You're subscribed!</h1>
          <p className="text-muted-foreground">Enjoy unlimited access to all premium content.</p>
        </div>
        {activeMembership && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="font-medium">{activeMembership.plan_snapshot?.name ?? 'DELULU Premium'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expires</p>
                  <p className="font-medium">{formatDate(activeMembership.end_date)}</p>
                </div>
                <Badge variant="success">Active</Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  const upiId = paymentSettings.upi_id || 'delulu@upi'
  const paypalEmail = paymentSettings.paypal_email || ''
  const paypalMeLink = paymentSettings.paypal_me_link || ''
  const instructions = paymentSettings.payment_instructions || 'Pay to the UPI ID above and upload the screenshot.'

  const price = billingRegion === 'international' && selectedPlan?.price_intl
    ? `$${(selectedPlan.price_intl / 100).toFixed(2)}`
    : selectedPlan ? formatINR(selectedPlan.price_inr) : ''

  return (
    <div className="container max-w-4xl py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-4">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Premium Access</span>
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-semibold mb-3">Choose Your Plan</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Unlock all premium stories and content. Cancel anytime.
        </p>
      </div>

      {/* Plans — shown when no plan selected or when instructions not shown */}
      {!showInstructions && (
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {plans.map((plan) => {
            const isYearly = plan.duration_days >= 365
            const planPrice = billingRegion === 'international' && plan.price_intl
              ? `$${(plan.price_intl / 100).toFixed(2)}`
              : formatINR(plan.price_inr)
            return (
              <Card
                key={plan.id}
                className={cn(
                  'relative cursor-pointer transition-all',
                  selectedPlan?.id === plan.id ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/30',
                )}
                onClick={() => setSelectedPlan(plan)}
              >
                {(plan.is_popular || isYearly) && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    {plan.badge || (isYearly ? 'Best Value' : 'Popular')}
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {plan.is_recommended && <Badge variant="default" className="text-xs">Recommended</Badge>}
                  </CardTitle>
                  {plan.short_description && <p className="text-sm text-muted-foreground mt-1">{plan.short_description}</p>}
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="font-serif text-4xl font-semibold">{planPrice}</span>
                    <span className="text-sm text-muted-foreground">/{plan.duration_days === 30 ? 'month' : plan.duration_days === 365 ? 'year' : `${plan.duration_days} days`}</span>
                  </div>
                  {plan.description && <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>}
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {plan.benefits.map((b) => (
                      <li key={b} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-success" />
                        {b === 'premium_books' ? 'Access to all premium books' :
                         b === 'premium_audiobooks' ? 'Access to premium audiobooks' :
                         b === 'premium_reels' ? 'Access to premium reels' :
                         b === 'premium_drama' ? 'Access to premium dramas' :
                         b === 'all_access' ? 'Complete access to everything' : b}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Step 1: Billing region + payment method → show instructions */}
      {selectedPlan && !showInstructions && (
        <Card className="mb-10 animate-fade-in">
          <CardHeader><CardTitle>Complete Payment</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {/* Billing Region */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</div>
                <h3 className="font-medium flex items-center gap-2"><Globe className="h-4 w-4" /> Select Billing Region</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setBillingRegion('india')}
                  className={cn('p-4 rounded-lg border-2 text-left transition-all', billingRegion === 'india' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30')}
                >
                  <MapPin className="h-4 w-4 mb-1" />
                  <p className="font-medium text-sm">India</p>
                  <p className="text-xs text-muted-foreground">UPI / PayPal</p>
                </button>
                <button
                  onClick={() => setBillingRegion('international')}
                  className={cn('p-4 rounded-lg border-2 text-left transition-all', billingRegion === 'international' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30')}
                >
                  <Globe className="h-4 w-4 mb-1" />
                  <p className="font-medium text-sm">International</p>
                  <p className="text-xs text-muted-foreground">PayPal</p>
                </button>
              </div>
              {billingRegion === 'international' && (
                <div className="mt-3 space-y-2">
                  <label className="text-sm font-medium">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Enter your Country"
                    className="flex h-10 w-full rounded-md border border-input bg-secondary/40 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</div>
                <h3 className="font-medium">Payment Method</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(billingRegion === 'india' || showManual) && (
                  <button
                    onClick={() => setPaymentMethod('upi')}
                    className={cn('p-3 rounded-lg border-2 text-sm transition-all', paymentMethod === 'upi' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30')}
                  >
                    <Smartphone className="h-4 w-4 mb-1" /> UPI
                  </button>
                )}
                {paypalEmail && (
                  <button
                    onClick={() => setPaymentMethod('paypal')}
                    className={cn('p-3 rounded-lg border-2 text-sm transition-all', paymentMethod === 'paypal' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30')}
                  >
                    PayPal
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-sm">Amount to pay: <span className="font-semibold text-primary">{price}</span></p>
            </div>

            <Button className="w-full" size="lg" onClick={handleContinue}>
              Continue to Payment
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Payment instructions + upload + submit */}
      {showInstructions && selectedPlan && (
        <Card className="mb-10 animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Payment Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Payment details */}
            {paymentMethod === 'upi' && showManual && (
              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Send payment to UPI ID</p>
                    <p className="font-mono font-medium text-lg">{upiId}</p>
                    {paymentSettings.business_name && <p className="text-xs text-muted-foreground">{paymentSettings.business_name}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm">Amount: <span className="font-semibold text-primary">{formatINR(selectedPlan.price_inr)}</span></p>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(upiId); toast('UPI ID copied', 'success') }}>Copy UPI ID</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">{instructions}</p>
                {paymentSettings.payment_notes && <p className="text-xs text-muted-foreground mt-2">Note: {paymentSettings.payment_notes}</p>}
              </div>
            )}

            {paymentMethod === 'paypal' && (
              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                {paypalEmail && <p className="text-sm mb-1">PayPal Email: <span className="font-mono font-medium">{paypalEmail}</span></p>}
                {paypalMeLink && <p className="text-sm mb-1">PayPal.me: <a href={paypalMeLink.startsWith('http') ? paypalMeLink : `https://${paypalMeLink}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">{paypalMeLink}</a></p>}
                <p className="text-sm">Amount: <span className="font-semibold text-primary">{price}</span></p>
                <p className="text-xs text-muted-foreground mt-2">{instructions}</p>
              </div>
            )}

            {showGateway && (
              <div className="rounded-lg border border-border bg-secondary/30 p-4 text-center">
                <Lock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Gateway checkout is not yet configured.</p>
              </div>
            )}

            {/* Upload screenshot */}
            <div>
              <h3 className="font-medium mb-3">Upload Payment Screenshot</h3>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 cursor-pointer hover:border-primary/40 transition-colors',
                  screenshotUrl && 'border-success/40 bg-success/5',
                )}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </div>
                ) : screenshotUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    <BadgeCheck className="h-8 w-8 text-success" />
                    <p className="text-sm text-success">Screenshot uploaded</p>
                    <img src={screenshotUrl} alt="Payment proof" className="max-h-32 rounded-md mt-2" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to upload payment screenshot</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG, WebP, GIF — max 5MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* Transaction ID */}
            <div>
              <label className="text-sm font-medium">Transaction ID (optional)</label>
              <input
                type="text"
                placeholder="e.g. 123456789012"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-secondary/40 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring mt-1"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={resetPaymentFlow}>Cancel</Button>
              <Button className="flex-1" size="lg" onClick={handleSubmitProof} disabled={!screenshotUrl || submitting}>
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Your request will be reviewed by our team. You'll get access once approved.
            </p>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {paymentRequests.length > 0 && (
        <div>
          <h2 className="font-serif text-xl font-semibold mb-4">Your Payment History</h2>
          <div className="space-y-3">
            {paymentRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">{req.plan_snapshot?.name ?? 'Plan'}</p>
                  <p className="text-xs text-muted-foreground font-mono">{req.order_ref}</p>
                  <p className="text-xs text-muted-foreground">Requested {formatDate(req.created_at)}</p>
                  {req.rejection_reason && <p className="text-xs text-destructive mt-1">Rejected: {req.rejection_reason}</p>}
                </div>
                <StatusBadge status={req.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: 'default' | 'success' | 'destructive' | 'warning'; icon: typeof Check }> = {
    pending: { variant: 'warning', icon: Clock3 },
    submitted: { variant: 'warning', icon: Clock3 },
    under_review: { variant: 'default', icon: Clock3 },
    approved: { variant: 'success', icon: BadgeCheck },
    rejected: { variant: 'destructive', icon: XCircle },
    expired: { variant: 'warning', icon: Clock3 },
    cancelled: { variant: 'secondary' as any, icon: XCircle },
  }
  const cfg = map[status] ?? map.pending
  const Icon = cfg.icon
  return (
    <Badge variant={cfg.variant} className="capitalize">
      <Icon className="h-3 w-3 mr-1" /> {status.replace(/_/g, ' ')}
    </Badge>
  )
}
