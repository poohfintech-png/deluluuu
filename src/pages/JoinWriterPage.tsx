import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Feather,
  DollarSign,
  Users,
  TrendingUp,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Upload,
  HelpCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export function JoinWriterPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sampleInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState(user?.email ?? '')
  const [about, setAbout] = useState('')
  const [writingExperience, setWritingExperience] = useState('')
  const [genres, setGenres] = useState('')
  const [previousLinks, setPreviousLinks] = useState('')
  const [profilePicUrl, setProfilePicUrl] = useState('')
  const [sampleUrl, setSampleUrl] = useState('')
  const [uploadingPic, setUploadingPic] = useState(false)
  const [uploadingSample, setUploadingSample] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [existingApplication, setExistingApplication] = useState<{ status: string } | null>(null)

  useEffect(() => {
    if (!user) return
    const checkExisting = async () => {
      const { data } = await supabase
        .from('writer_applications')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data) setExistingApplication(data as { status: string })
    }
    checkExisting()
  }, [user])

  // Auto-fill from user profile when arriving post-signup
  useEffect(() => {
    if (user && searchParams.get('post_signup') === '1') {
      setEmail(user.email ?? '')
      toast('Complete your writer application below', 'info')
    }
  }, [user, searchParams, toast])

  const handleProfilePic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    e.target.value = ''
    if (!file.type.startsWith('image/')) {
      toast('Please upload an image file', 'error')
      return
    }
    setUploadingPic(true)
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${user.id}/writer-applications/${Date.now()}-profile.${ext}`
    const { error } = await supabase.storage.from('content-media').upload(path, file)
    if (error) {
      toast('Upload failed: ' + error.message, 'error')
    } else {
      const { data } = supabase.storage.from('content-media').getPublicUrl(path)
      setProfilePicUrl(data.publicUrl)
      toast('Profile picture uploaded', 'success')
    }
    setUploadingPic(false)
  }

  const handleSampleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    e.target.value = ''
    if (file.size > 10 * 1024 * 1024) {
      toast('File must be under 10MB', 'error')
      return
    }
    setUploadingSample(true)
    const ext = file.name.split('.').pop() ?? 'txt'
    const path = `${user.id}/writer-applications/${Date.now()}-sample.${ext}`
    const { error } = await supabase.storage.from('content-media').upload(path, file)
    if (error) {
      toast('Upload failed: ' + error.message, 'error')
    } else {
      const { data } = supabase.storage.from('content-media').getPublicUrl(path)
      setSampleUrl(data.publicUrl)
      toast('Sample writing uploaded', 'success')
    }
    setUploadingSample(false)
  }

  const handleSubmit = async () => {
    if (!user) {
      toast('Please sign in to submit an application', 'error')
      navigate('/auth?mode=signup&writer=1')
      return
    }
    if (!name.trim() || !username.trim() || !email.trim()) {
      toast('Name, username, and email are required', 'error')
      return
    }
    setSubmitting(true)

    // If re-applying after rejection, upsert instead of insert
    const { error: existingError } = await supabase
      .from('writer_applications')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingError) {
      toast('Failed to check existing application', 'error')
      setSubmitting(false)
      return
    }

    const { error } = await supabase.from('writer_applications').insert({
      user_id: user.id,
      name: name.trim(),
      username: username.trim(),
      email: email.trim(),
      about: about.trim() || null,
      writing_experience: writingExperience.trim() || null,
      genres: genres.split(',').map((g) => g.trim()).filter(Boolean),
      previous_work_links: previousLinks.split('\n').map((l) => l.trim()).filter(Boolean),
      sample_writing_url: sampleUrl || null,
      profile_picture_url: profilePicUrl || null,
      status: 'pending',
    })

    if (error) {
      toast('Failed to submit: ' + error.message, 'error')
    } else {
      setSubmitted(true)
      toast('Application submitted! We will review it soon.', 'success')
    }
    setSubmitting(false)
  }

  if (!user) {
    return (
      <div className="container max-w-md py-20 text-center">
        <Feather className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="font-serif text-2xl font-semibold mb-2">Join as a Writer</h1>
        <p className="text-muted-foreground mb-6">Sign in or create an account to apply.</p>
        <Button asChild>
          <Link to="/auth?mode=signup&writer=1">Get Started</Link>
        </Button>
      </div>
    )
  }

  // Show pending status if application already exists
  if (existingApplication) {
    return (
      <div className="container max-w-md py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border border-primary/20 mx-auto mb-4">
          {existingApplication.status === 'approved' ? (
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          ) : existingApplication.status === 'rejected' ? (
            <XCircle className="h-8 w-8 text-destructive" />
          ) : (
            <Clock className="h-8 w-8 text-amber-500" />
          )}
        </div>
        <h1 className="font-serif text-2xl font-semibold mb-2">
          {existingApplication.status === 'approved'
            ? 'Application Approved!'
            : existingApplication.status === 'rejected'
              ? 'Application Rejected'
              : 'Application Pending'}
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
          {existingApplication.status === 'approved'
            ? 'Congratulations! You are now a writer. Access your writer dashboard to start publishing.'
            : existingApplication.status === 'rejected'
              ? 'Your application was not approved. You can re-apply with updated information.'
              : 'Your writer application is under review. We will notify you once it is approved.'}
        </p>
        {existingApplication.status === 'approved' ? (
          <Button asChild><Link to="/writer-dashboard">Go to Writer Dashboard</Link></Button>
        ) : existingApplication.status === 'rejected' ? (
          <Button variant="outline" onClick={() => setExistingApplication(null)}>Re-apply</Button>
        ) : (
          <Button asChild variant="outline"><Link to="/">Back to Home</Link></Button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-transparent" />
        <div className="container relative py-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-6">
            <Feather className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Writer Program</span>
          </div>
          <h1 className="font-serif text-3xl md:text-5xl font-semibold mb-4 max-w-2xl mx-auto text-balance">
            Share your stories with the world
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Join a community of writers, earn from your craft, and reach readers across the platform.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="container py-16">
        <h2 className="font-serif text-2xl font-semibold text-center mb-10">Why Join Us</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Benefit icon={DollarSign} title="Monetize Your Writing" description="Earn coins and revenue from premium chapters and reels." />
          <Benefit icon={Users} title="Reach Readers" description="Get discovered by thousands of readers looking for their next favorite story." />
          <Benefit icon={TrendingUp} title="Grow Your Audience" description="Analytics, insights, and tools to help you understand and grow your readership." />
          <Benefit icon={Shield} title="Protect Your Work" description="Your stories stay yours. We provide tools to manage and protect your content." />
          <Benefit icon={Feather} title="Creative Freedom" description="Write across genres. Publish chapters, audio, and video reels." />
          <Benefit icon={CheckCircle2} title="Admin Support" description="Our team reviews and supports your work every step of the way." />
        </div>
      </section>

      {/* Application Form */}
      <section className="container max-w-2xl py-12">
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <h2 className="font-serif text-2xl font-semibold mb-2">Writer Application</h2>
          <p className="text-sm text-muted-foreground mb-6">Fill out the form below. Our team will review and respond.</p>

          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
              </div>
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>

            <div className="space-y-2">
              <Label>Profile Picture</Label>
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-full overflow-hidden bg-secondary/30 border border-border shrink-0">
                  {profilePicUrl ? (
                    <img src={profilePicUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Users className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePic} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingPic}>
                  {uploadingPic ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading</> : <><Upload className="h-4 w-4" /> Upload</>}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>About Yourself</Label>
              <Textarea value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Tell us about yourself..." rows={3} />
            </div>

            <div className="space-y-2">
              <Label>Writing Experience</Label>
              <Textarea value={writingExperience} onChange={(e) => setWritingExperience(e.target.value)} placeholder="Describe your writing background..." rows={3} />
            </div>

            <div className="space-y-2">
              <Label>Genres You Write</Label>
              <Input value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="Romance, Fantasy, Drama..." />
            </div>

            <div className="space-y-2">
              <Label>Previous Work Links</Label>
              <Textarea value={previousLinks} onChange={(e) => setPreviousLinks(e.target.value)} placeholder="One link per line" rows={2} />
            </div>

            <div className="space-y-2">
              <Label>Sample Writing</Label>
              <div className="flex items-center gap-3">
                <input ref={sampleInputRef} type="file" className="hidden" onChange={handleSampleUpload} />
                <Button type="button" variant="outline" size="sm" onClick={() => sampleInputRef.current?.click()} disabled={uploadingSample}>
                  {uploadingSample ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading</> : <><Upload className="h-4 w-4" /> Upload Sample</>}
                </Button>
                {sampleUrl && <Badge variant="success">Uploaded</Badge>}
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={submitting} size="lg" className="w-full">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting</> : 'Submit Application'}
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container max-w-2xl py-12">
        <div className="flex items-center gap-2 mb-6">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-2xl font-semibold">FAQ</h2>
        </div>
        <div className="space-y-4">
          <FAQItem q="How long does review take?" a="We typically review applications within 3-5 business days." />
          <FAQItem q="What happens after approval?" a="You'll receive a Writer role and access to the writer dashboard where you can create and publish books, chapters, and reels." />
          <FAQItem q="How do I earn money?" a="Writers earn through premium chapters and reels. Readers unlock content using coins, and you receive a share of the revenue." />
          <FAQItem q="Can I write in any genre?" a="Yes! We welcome all genres. Specify your preferred genres in the application." />
        </div>
      </section>

      {/* Success dialog */}
      <Dialog open={submitted} onOpenChange={() => navigate('/')}>
        <DialogContent>
          <DialogHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20 mx-auto mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <DialogTitle className="text-center">Application Submitted!</DialogTitle>
            <DialogDescription className="text-center">
              Your application is now pending review. We'll notify you once it's approved.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => navigate('/')}>Back to Home</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Benefit({ icon: Icon, title, description }: { icon: typeof Feather; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 mb-4">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-serif text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full p-4 text-left"
      >
        <span className="font-medium text-sm">{q}</span>
        <span className="text-muted-foreground">{open ? '−' : '+'}</span>
      </button>
      {open && <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>}
    </div>
  )
}
