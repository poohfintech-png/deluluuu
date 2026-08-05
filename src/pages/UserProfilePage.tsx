import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User as UserIcon,
  Upload,
  Trash2,
  Loader2,
  Coins,
  BookOpen,
  Heart,
  MessageSquare,
  Lock,
  LogOut,
  Settings,
  Save,
  History,
  Feather,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext'
import { useToast } from '@/contexts/ToastContext'
import type { Book, ReadingHistoryEntry, Comment } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookCard } from '@/components/BookCard'
import { EmptyState } from '@/components/EmptyState'
import { cn } from '@/lib/utils'

export function UserProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const { isEnabled } = useFeatureFlags()
  const coinsEnabled = isEnabled('coins_system')
  const { toast } = useToast()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [library, setLibrary] = useState<Book[]>([])
  const [history, setHistory] = useState<ReadingHistoryEntry[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [coinTx, setCoinTx] = useState<{ id: string; amount: number; type: string; description: string | null; created_at: string }[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name)
      setUsername(profile.username ?? '')
      setBio(profile.bio ?? '')
      setAvatarUrl(profile.avatar_url ?? '')
    }
  }, [profile])

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      setLoadingData(true)
      const [libRes, histRes, commentsRes, txRes] = await Promise.all([
        supabase.from('libraries').select('*, book:books(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('reading_history').select('*, chapter:chapters(*), book:books(*)').eq('user_id', user.id).order('last_read_at', { ascending: false }).limit(20),
        supabase.from('comments').select('*, chapter:chapters(*)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
        coinsEnabled
          ? supabase.from('coin_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
          : Promise.resolve({ data: null, error: null, status: 0, statusText: '', count: null }),
      ])
      setLibrary((libRes.data as unknown as { book: Book }[])?.map((l) => l.book).filter(Boolean) ?? [])
      setHistory((histRes.data as unknown as ReadingHistoryEntry[]) ?? [])
      setComments((commentsRes.data as unknown as Comment[]) ?? [])
      setCoinTx((txRes.data as unknown as { id: string; amount: number; type: string; description: string | null; created_at: string }[]) ?? [])
      setLoadingData(false)
    }
    fetchData()
  }, [user])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    e.target.value = ''
    if (!file.type.startsWith('image/')) { toast('Please upload an image', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return }
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${user.id}/avatars/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('content-media').upload(path, file)
    if (error) { toast('Upload failed: ' + error.message, 'error'); }
    else {
      const { data } = supabase.storage.from('content-media').getPublicUrl(path)
      setAvatarUrl(data.publicUrl)
      toast('Avatar uploaded', 'success')
    }
    setUploadingAvatar(false)
  }

  const handleRemoveAvatar = () => {
    setAvatarUrl('')
    toast('Avatar removed. Save to confirm.', 'info')
  }

  const handleSaveProfile = async () => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      display_name: displayName.trim() || 'Anonymous',
      username: username.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl || null,
    }).eq('id', user.id)
    if (error) toast('Failed: ' + error.message, 'error')
    else { toast('Profile updated', 'success'); refreshProfile() }
    setSaving(false)
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast('Password must be at least 6 characters', 'error'); return }
    if (newPassword !== confirmPassword) { toast('Passwords do not match', 'error'); return }
    setChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) toast('Failed: ' + error.message, 'error')
    else { toast('Password changed', 'success'); setNewPassword(''); setConfirmPassword('') }
    setChangingPassword(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  if (!profile) return null

  return (
    <div className="container max-w-4xl py-8 md:py-12">
      <div className="bg-card/90 backdrop-blur-xl rounded-3xl border border-border/30 p-6 md:p-8 mb-8 animate-fade-in-up">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <div className="h-28 w-28 rounded-full overflow-hidden bg-secondary/30 border-2 border-primary/20 shadow-lg">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center"><UserIcon className="h-12 w-12 text-muted-foreground/40" /></div>
              )}
            </div>
            {profile.role === 'writer' && (
              <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-secondary/20 border-2 border-background">
                <Feather className="h-4 w-4 text-primary" />
              </div>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="font-serif text-2xl md:text-3xl font-semibold text-primary">{profile.display_name}</h1>
            {profile.username && <p className="text-sm text-muted-foreground mt-0.5">@{profile.username}</p>}
            {profile.bio && <p className="text-sm text-foreground/60 mt-2 max-w-md">{profile.bio}</p>}
            <div className="flex items-center gap-2 mt-3 justify-center sm:justify-start">
              <Badge variant="secondary" className="capitalize">{profile.role}</Badge>
              {coinsEnabled && <Badge className="gap-1"><Coins className="h-3 w-3" /> {profile.coins}</Badge>}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="library">
        <TabsList className="w-full justify-start mb-6 flex-wrap bg-card/90 backdrop-blur-xl border border-border/30 rounded-2xl p-1.5">
          <TabsTrigger value="library" className="gap-1.5 rounded-xl"><BookOpen className="h-4 w-4" /> Library</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 rounded-xl"><History className="h-4 w-4" /> History</TabsTrigger>
          {coinsEnabled && <TabsTrigger value="coins" className="gap-1.5 rounded-xl"><Coins className="h-4 w-4" /> Coins</TabsTrigger>}
          <TabsTrigger value="settings" className="gap-1.5 rounded-xl"><Settings className="h-4 w-4" /> Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="library">
          {loadingData ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[3/4] bg-secondary/30 animate-pulse rounded-xl" />)}</div>
          ) : library.length === 0 ? (
            <EmptyState icon={BookOpen} title="Your library is empty" description="Save books to your library to read them later." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6 animate-fade-in">
              {library.map((book) => <BookCard key={book.id} book={book} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {loadingData ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-secondary/30 animate-pulse rounded-lg" />)}</div>
          ) : history.length === 0 ? (
            <EmptyState icon={History} title="No reading history" description="Start reading to see your history here." />
          ) : (
            <div className="space-y-3 animate-fade-in">
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-4 rounded-2xl bg-card/90 border border-border/30 p-4 hover:border-border/50 transition-all duration-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shrink-0"><BookOpen className="h-5 w-5 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{h.book?.title ?? 'Unknown book'}</p>
                    <p className="text-xs text-muted-foreground truncate">{h.chapter?.title ?? 'Unknown chapter'}</p>
                  </div>
                  <Badge variant="secondary">{h.progress}%</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {coinsEnabled && (
          <TabsContent value="coins">
            <div className="bg-card/90 backdrop-blur-xl rounded-2xl border border-border/30 p-6 mb-4 animate-fade-in">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/20 border border-border/30"><Coins className="h-7 w-7 text-primary" /></div>
                <div>
                  <p className="font-serif text-3xl font-semibold">{profile.coins}</p>
                  <p className="text-sm text-muted-foreground">Current balance</p>
                </div>
              </div>
            </div>
            {coinTx.length === 0 ? (
              <EmptyState icon={Coins} title="No transactions yet" description="Your coin transactions will appear here." />
            ) : (
              <div className="space-y-2 animate-fade-in">
                {coinTx.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-xl bg-card/90 border border-border/30 p-4">
                    <div>
                      <p className="text-sm font-medium">{tx.description ?? tx.type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={cn('font-semibold', tx.amount > 0 ? 'text-success' : 'text-destructive')}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="settings">
          <div className="space-y-6 animate-fade-in">
            <div className="bg-card/90 backdrop-blur-xl rounded-2xl border border-border/30 p-6">
              <h3 className="font-serif text-lg font-semibold mb-4">Profile Information</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-full overflow-hidden bg-secondary/30 border border-border">
                    {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><UserIcon className="h-6 w-6 text-muted-foreground/40" /></div>}
                  </div>
                  <div className="flex gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}>
                      {uploadingAvatar ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading</> : <><Upload className="h-4 w-4" /> Change</>}
                    </Button>
                    {avatarUrl && <Button variant="ghost" size="sm" onClick={handleRemoveAvatar}><Trash2 className="h-4 w-4" /> Remove</Button>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Display Name</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" /></div>
                </div>
                <div className="space-y-2"><Label>Bio</Label><Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell us about yourself" /></div>
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving</> : <><Save className="h-4 w-4" /> Save Profile</>}
                </Button>
              </div>
            </div>

            <div className="bg-card/90 backdrop-blur-xl rounded-2xl border border-border/30 p-6">
              <h3 className="font-serif text-lg font-semibold mb-4">Change Password</h3>
              <div className="space-y-4">
                <div className="space-y-2"><Label>New Password</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" /></div>
                <div className="space-y-2"><Label>Confirm Password</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" /></div>
                <Button onClick={handleChangePassword} disabled={changingPassword}>
                  {changingPassword ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating</> : <><Lock className="h-4 w-4" /> Update Password</>}
                </Button>
              </div>
            </div>

            <div className="bg-card/90 backdrop-blur-xl rounded-2xl border border-border/30 p-6">
              <Button variant="destructive" onClick={handleSignOut}><LogOut className="h-4 w-4" /> Sign Out</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}