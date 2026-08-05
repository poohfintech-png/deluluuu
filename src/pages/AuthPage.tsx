import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Sparkles, Mail, Lock, User as UserIcon, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset'

export function AuthPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { signIn, signUp, resetPassword, updatePassword, user } = useAuth()
  const { toast } = useToast()

  const [mode, setMode] = useState<AuthMode>(
    searchParams.get('mode') === 'signup' ? 'signup'
    : searchParams.get('mode') === 'reset' ? 'reset'
    : 'signin',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (user && mode !== 'reset') navigate('/')
  }, [user, navigate, mode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (mode === 'signin') {
      const { error } = await signIn(email, password)
      if (error) toast(error, 'error')
      else { toast('Welcome back!', 'success'); navigate('/') }
    } else if (mode === 'signup') {
      if (password.length < 6) { toast('Password must be at least 6 characters', 'error'); setLoading(false); return }
      const isWriterSignup = searchParams.get('mode') === 'signup' && searchParams.get('writer') === '1'
      const { error } = await signUp(email, password, displayName || email.split('@')[0], isWriterSignup ? 'writer' : 'reader')
      if (error) toast(error, 'error')
      else {
        if (isWriterSignup) {
          toast('Account created! Complete your writer application next.', 'success')
          navigate('/writer?post_signup=1')
        } else {
          toast('Account created! Welcome.', 'success')
          navigate('/')
        }
      }
    } else if (mode === 'forgot') {
      const { error } = await resetPassword(email)
      if (error) toast(error, 'error')
      else { setResetSent(true); toast('Reset link sent to your email', 'success') }
    } else if (mode === 'reset') {
      if (newPassword.length < 6) { toast('Password must be at least 6 characters', 'error'); setLoading(false); return }
      if (newPassword !== confirmPassword) { toast('Passwords do not match', 'error'); setLoading(false); return }
      const { error } = await updatePassword(newPassword)
      if (error) toast(error, 'error')
      else { toast('Password updated! Please sign in.', 'success'); navigate('/auth') }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/10 via-background to-secondary/5" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] opacity-35 animate-float" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-secondary/10 rounded-full blur-[100px]" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-6 group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-secondary/25 border border-border/30 group-hover:from-primary/35 group-hover:to-secondary/35 transition-all duration-300">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <span className="font-serif text-xl font-semibold text-primary">Delulu</span>
          </Link>
          <h1 className="font-serif text-3xl font-semibold mb-2 text-foreground">
            {mode === 'signin' && 'Welcome Back'}
            {mode === 'signup' && 'Join Delulu'}
            {mode === 'forgot' && 'Reset Password'}
            {mode === 'reset' && 'New Password'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'signin' && 'Sign in to continue your journey'}
            {mode === 'signup' && 'Create an account to start reading'}
            {mode === 'forgot' && 'Enter your email to receive a reset link'}
            {mode === 'reset' && 'Choose a new password for your account'}
          </p>
        </div>

        <div className="bg-card/90 backdrop-blur-xl rounded-3xl border border-border/30 p-6 md:p-8 shadow-xl animate-fade-in-up">
          {mode === 'forgot' && resetSent ? (
            <div className="text-center py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 border border-success/20 mx-auto mb-4">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <p className="font-medium mb-2">Check your email</p>
              <p className="text-sm text-muted-foreground mb-6">We sent a password reset link to {email}</p>
              <Button onClick={() => setMode('signin')} className="w-full">Back to Sign In</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="name" type="text" placeholder="Your name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="pl-9" required />
                  </div>
                </div>
              )}

              {(mode === 'signin' || mode === 'signup' || mode === 'forgot') && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" required />
                  </div>
                </div>
              )}

              {(mode === 'signin' || mode === 'signup') && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" required />
                  </div>
                </div>
              )}

              {mode === 'reset' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="newPassword" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pl-9" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-9" required />
                    </div>
                  </div>
                </>
              )}

              {mode === 'signin' && (
                <div className="text-right">
                  <button type="button" onClick={() => setMode('forgot')} className="text-xs text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
              )}

              <Button type="submit" className="w-full glow-rose" size="lg" disabled={loading}>
                {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Send Reset Link' : 'Update Password'}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm">
            {mode === 'signin' && (
              <p className="text-muted-foreground">
                New to Delulu?{' '}
                <button onClick={() => setMode('signup')} className="text-primary font-medium hover:underline">Create an account</button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-muted-foreground">
                Already have an account?{' '}
                <button onClick={() => setMode('signin')} className="text-primary font-medium hover:underline">Sign in</button>
              </p>
            )}
            {(mode === 'forgot' || mode === 'reset') && (
              <button onClick={() => setMode('signin')} className="text-primary font-medium hover:underline inline-flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}