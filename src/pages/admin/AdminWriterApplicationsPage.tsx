import { useState, useEffect } from 'react'
import { Feather, CheckCircle2, XCircle, FileText, Loader2, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { WriterApplication } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

export function AdminWriterApplicationsPage() {
  const { toast } = useToast()
  const [applications, setApplications] = useState<WriterApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState<WriterApplication | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [action, setAction] = useState<'approved' | 'rejected' | 'changes_requested'>('approved')
  const [processing, setProcessing] = useState(false)

  const fetchApplications = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('writer_applications')
      .select('*, user:profiles!writer_applications_user_id_fkey(*)')
      .order('created_at', { ascending: false })
    setApplications((data as unknown as WriterApplication[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchApplications() }, [])

  const handleReview = async () => {
    if (!reviewing) return
    setProcessing(true)
    const { error } = await supabase
      .from('writer_applications')
      .update({
        status: action,
        review_notes: reviewNotes.trim() || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewing.id)
    if (error) {
      toast('Failed: ' + error.message, 'error')
      setProcessing(false)
      return
    }
    if (action === 'approved' && reviewing.user_id) {
      await supabase.from('profiles').update({ role: 'writer' }).eq('id', reviewing.user_id)
      await supabase.from('notifications').insert({
        user_id: reviewing.user_id,
        type: 'success',
        title: 'Writer Application Approved!',
        body: 'Congratulations! You are now a writer. Access your writer dashboard to start publishing.',
        link: '/dashboard',
      })
    } else if (reviewing.user_id) {
      await supabase.from('notifications').insert({
        user_id: reviewing.user_id,
        type: action === 'rejected' ? 'warning' : 'info',
        title: `Writer Application ${action === 'rejected' ? 'Rejected' : 'Changes Requested'}`,
        body: reviewNotes.trim() || 'Please check your application status for details.',
        link: '/writer',
      })
    }
    toast(`Application ${action}`, 'success')
    setProcessing(false)
    setReviewing(null)
    setReviewNotes('')
    fetchApplications()
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="warning">Pending</Badge>
      case 'approved': return <Badge variant="success">Approved</Badge>
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>
      case 'changes_requested': return <Badge variant="secondary">Changes Requested</Badge>
      default: return <Badge>{status}</Badge>
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-semibold">Writer Applications</h1>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : applications.length === 0 ? (
        <EmptyState icon={Feather} title="No applications yet" description="Writer applications will appear here for review." />
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <Card key={app.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full overflow-hidden bg-secondary/30 shrink-0">
                  {app.profile_picture_url ? (
                    <img src={app.profile_picture_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Feather className="h-5 w-5 text-muted-foreground/40" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{app.name}</h3>
                    {statusBadge(app.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    @{app.username} · {app.email}
                  </p>
                  {app.genres.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {app.genres.slice(0, 4).map((g) => <span key={g} className="text-[10px] text-muted-foreground/70">#{g}</span>)}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => { setReviewing(app); setReviewNotes(app.review_notes ?? '') }}>
                  Review
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {reviewing && (
        <Dialog open onOpenChange={() => setReviewing(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Application — {reviewing.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-full overflow-hidden bg-secondary/30 shrink-0">
                  {reviewing.profile_picture_url ? <img src={reviewing.profile_picture_url} alt="" className="h-full w-full object-cover" /> : <Feather className="h-6 w-6 text-muted-foreground/40 m-auto mt-5" />}
                </div>
                <div>
                  <p className="font-medium">{reviewing.name}</p>
                  <p className="text-sm text-muted-foreground">@{reviewing.username}</p>
                  <p className="text-sm text-muted-foreground">{reviewing.email}</p>
                </div>
              </div>
              {reviewing.about && <Field label="About"><p className="text-sm">{reviewing.about}</p></Field>}
              {reviewing.writing_experience && <Field label="Writing Experience"><p className="text-sm">{reviewing.writing_experience}</p></Field>}
              {reviewing.genres.length > 0 && <Field label="Genres"><div className="flex gap-1 flex-wrap">{reviewing.genres.map((g) => <Badge key={g} variant="secondary">{g}</Badge>)}</div></Field>}
              {reviewing.previous_work_links.length > 0 && <Field label="Previous Work"><div className="space-y-1">{reviewing.previous_work_links.map((l, i) => <a key={i} href={l} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline block truncate">{l}</a>)}</div></Field>}
              {reviewing.sample_writing_url && <Field label="Sample Writing"><a href={reviewing.sample_writing_url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1"><FileText className="h-4 w-4" /> View Sample</a></Field>}

              <div className="space-y-2">
                <Label>Review Notes (optional)</Label>
                <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Feedback for the applicant..." rows={3} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={action === 'approved' ? 'default' : 'outline'} onClick={() => setAction('approved')}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant={action === 'rejected' ? 'destructive' : 'outline'} onClick={() => setAction('rejected')}>
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                <Button size="sm" variant={action === 'changes_requested' ? 'default' : 'outline'} onClick={() => setAction('changes_requested')}>
                  <MessageSquare className="h-4 w-4" /> Request Changes
                </Button>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleReview} disabled={processing}>{processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  )
}
