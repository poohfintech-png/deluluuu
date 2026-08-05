import { useState, useEffect, useCallback } from 'react'
import { Check, X, Clock, CreditCard, BadgeCheck, XCircle, Eye, RefreshCw, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { PaymentRequest, Profile, MembershipPlan } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { formatINR, formatDate, formatRelative } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type RequestWithRelations = PaymentRequest & { user?: Profile; plan?: MembershipPlan }

export function AdminPaymentsPage() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<RequestWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted' | 'approved' | 'rejected' | 'expired'>('submitted')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<RequestWithRelations | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*, user:profiles!payment_requests_user_id_fkey(*), plan:membership_plans!payment_requests_plan_id_fkey(*)')
      .order('created_at', { ascending: false })
    if (error) {
      toast('Failed to load payment requests', 'error')
    } else {
      setRequests(data as unknown as RequestWithRelations[])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    fetchRequests()
    const channel = supabase
      .channel('admin-payments-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, () => fetchRequests())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchRequests])

  const handleApprove = async (req: RequestWithRelations) => {
    setActionLoading(req.id)
    const { error } = await supabase.rpc('approve_payment_request', { p_request_id: req.id })
    if (error) {
      toast('Failed to approve: ' + error.message, 'error')
    } else {
      toast('Payment approved — user now has access', 'success')
      fetchRequests()
    }
    setActionLoading(null)
  }

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) {
      toast('Rejection reason is required', 'error')
      return
    }
    setActionLoading(rejectTarget.id)
    const { error } = await supabase.rpc('reject_payment_request', {
      p_request_id: rejectTarget.id,
      p_reason: rejectReason,
    })
    if (error) {
      toast('Failed to reject: ' + error.message, 'error')
    } else {
      toast('Payment rejected — user notified', 'info')
      setRejectTarget(null)
      setRejectReason('')
      fetchRequests()
    }
    setActionLoading(null)
  }

  const handleRequestNewProof = async (req: RequestWithRelations) => {
    setActionLoading(req.id)
    const { error } = await supabase.rpc('request_new_proof', { p_request_id: req.id })
    if (error) {
      toast('Failed: ' + error.message, 'error')
    } else {
      toast('New proof requested — user notified', 'info')
      fetchRequests()
    }
    setActionLoading(null)
  }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    submitted: requests.filter(r => r.status === 'submitted').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    expired: requests.filter(r => r.status === 'expired').length,
  }

  if (loading) {
    return (
      <div>
        <h1 className="font-serif text-2xl font-semibold mb-6">Payments</h1>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold mb-6">Payments</h1>

      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {(['submitted', 'pending', 'approved', 'rejected', 'expired', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors whitespace-nowrap ${
              filter === f ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.replace(/_/g, ' ')} ({counts[f]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payments" description={`No ${filter.replace(/_/g, ' ')} payment requests.`} />
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const expectedAmount = req.billing_region === 'international' && req.plan?.price_intl
              ? req.plan.price_intl
              : req.plan?.price_inr ?? 0
            const amountMismatch = req.amount !== expectedAmount
            const isExpired = new Date(req.expires_at) < new Date() && req.status === 'submitted'
            const canReview = req.status === 'submitted' || req.status === 'pending' || req.status === 'under_review'

            return (
              <Card key={req.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 text-sm font-medium shrink-0">
                      {req.user?.display_name?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{req.user?.display_name ?? 'Unknown'}</p>
                        <StatusBadge status={req.status} />
                        {isExpired && <Badge variant="warning"><Clock className="h-3 w-3 mr-1" /> Expired</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono">{req.order_ref}</span>
                        <span>{req.user?.email}</span>
                        <span>{req.plan?.name ?? req.plan_snapshot?.name ?? 'Plan'} v{req.plan_version}</span>
                        <span className={amountMismatch ? 'text-destructive font-medium' : ''}>
                          Amount: {req.currency === 'INR' ? formatINR(req.amount) : `$${(req.amount / 100).toFixed(2)}`}
                          {amountMismatch && <AlertTriangle className="h-3 w-3 inline ml-1" />}
                        </span>
                        <span className="capitalize">{req.billing_region}</span>
                        {req.country && <span>{req.country}</span>}
                        <span className="capitalize">{req.payment_method}</span>
                        {req.transaction_id && <span>Txn: {req.transaction_id}</span>}
                        <span>Requested {formatRelative(req.created_at)}</span>
                        {req.submitted_at && <span>Submitted {formatDate(req.submitted_at)}</span>}
                      </div>
                      {req.rejection_reason && (
                        <p className="text-xs text-destructive mt-1">Rejection reason: {req.rejection_reason}</p>
                      )}
                      {req.admin_notes && (
                        <p className="text-xs text-muted-foreground mt-1">Admin notes: {req.admin_notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {req.screenshot_url && (
                        <Button size="sm" variant="outline" onClick={() => setPreviewUrl(req.screenshot_url!)}>
                          <Eye className="h-3.5 w-3.5" /> Proof
                        </Button>
                      )}
                      {canReview && !isExpired && (
                        <>
                          <Button size="sm" variant="default" onClick={() => handleApprove(req)} disabled={actionLoading === req.id}>
                            <Check className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setRejectTarget(req)}>
                            <X className="h-3.5 w-3.5" /> Reject
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleRequestNewProof(req)} disabled={actionLoading === req.id}>
                            <RefreshCw className="h-3.5 w-3.5" /> New Proof
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Screenshot preview */}
      {previewUrl && (
        <Dialog open onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Payment Screenshot</DialogTitle></DialogHeader>
            <img src={previewUrl} alt="Payment proof" className="w-full rounded-lg" />
            <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reject dialog */}
      {rejectTarget && (
        <Dialog open onOpenChange={() => { setRejectTarget(null); setRejectReason('') }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject Payment Request</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Rejecting <span className="font-mono font-medium">{rejectTarget.order_ref}</span> from {rejectTarget.user?.display_name}.
                The user will see the rejection reason.
              </p>
              <div className="space-y-2">
                <Label>Rejection Reason (required)</Label>
                <Input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Payment screenshot is unclear, please resubmit."
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button variant="destructive" onClick={handleReject} disabled={actionLoading === rejectTarget.id}>
                Reject Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: 'default' | 'success' | 'destructive' | 'warning' | 'secondary'; icon: typeof Check }> = {
    pending: { variant: 'warning', icon: Clock },
    submitted: { variant: 'warning', icon: Clock },
    under_review: { variant: 'default', icon: Clock },
    approved: { variant: 'success', icon: BadgeCheck },
    rejected: { variant: 'destructive', icon: XCircle },
    expired: { variant: 'secondary', icon: Clock },
    cancelled: { variant: 'secondary', icon: XCircle },
  }
  const cfg = map[status] ?? map.pending
  const Icon = cfg.icon
  return (
    <Badge variant={cfg.variant} className="capitalize">
      <Icon className="h-3 w-3 mr-1" /> {status.replace(/_/g, ' ')}
    </Badge>
  )
}
