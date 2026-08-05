import { useState, useEffect, useRef } from 'react'
import { Plus, Edit2, Trash2, Film, Loader2, Upload, Lock, Unlock, BookOpen, Star, Tv, Sparkles, ChevronUp, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { Reel, Book, Genre, DramaSeries } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function AdminReelsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [reels, setReels] = useState<Reel[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [genres, setGenres] = useState<Genre[]>([])
  const [dramas, setDramas] = useState<DramaSeries[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Reel | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showDramaForm, setShowDramaForm] = useState(false)
  const [editingDrama, setEditingDrama] = useState<DramaSeries | null>(null)
  const [showFeatured, setShowFeatured] = useState(false)

  const fetchReels = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('reels')
      .select('*, book:books!reels_related_book_id_fkey(*), genre_data:genres(*)')
      .order('created_at', { ascending: false })
    setReels((data as unknown as Reel[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchReels()
    supabase.from('books').select('*').order('title').then(({ data }) => setBooks((data as Book[]) ?? []))
    supabase.from('genres').select('*').order('sort_order', { ascending: true }).then(({ data }) => setGenres((data as Genre[]) ?? []))
    fetchDramas()
  }, [])

  const fetchDramas = async () => {
    const { data } = await supabase.from('drama_series').select('*, genre_data:genres(*)').order('created_at', { ascending: false })
    setDramas((data as unknown as DramaSeries[]) ?? [])
  }

  const handleDeleteDrama = async (id: string) => {
    if (!confirm('Delete this drama series? Episodes will be unlinked, not deleted.')) return
    const { error } = await supabase.from('drama_series').delete().eq('id', id)
    if (error) toast('Failed: ' + error.message, 'error')
    else { toast('Drama deleted', 'success'); fetchDramas() }
  }

  const toggleDramaStatus = async (drama: DramaSeries) => {
    const newStatus = drama.status === 'published' ? 'draft' : 'published'
    const { error } = await supabase.from('drama_series').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', drama.id)
    if (error) toast('Failed: ' + error.message, 'error')
    else { toast(`Drama ${newStatus}`, 'success'); fetchDramas() }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this reel?')) return
    const { error } = await supabase.from('reels').delete().eq('id', id)
    if (error) toast('Failed to delete: ' + error.message, 'error')
    else { toast('Reel deleted', 'success'); fetchReels() }
  }

  const toggleStatus = async (reel: Reel) => {
    const newStatus = reel.status === 'published' ? 'draft' : 'published'
    const { error } = await supabase.from('reels').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', reel.id)
    if (error) toast('Failed: ' + error.message, 'error')
    else { toast(`Reel ${newStatus}`, 'success'); fetchReels() }
  }

  return (
    <div className="space-y-8">
      {/* Drama Series Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <Tv className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-semibold">Drama Series</h2>
              <p className="text-xs text-muted-foreground">Group episodes into mini drama series</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFeatured(true)}>
              <Sparkles className="h-4 w-4" /> Featured
            </Button>
            <Button size="sm" onClick={() => { setEditingDrama(null); setShowDramaForm(true) }}>
              <Plus className="h-4 w-4" /> New Drama
            </Button>
          </div>
        </div>
        {dramas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No drama series yet. Create one to group episodes.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {dramas.map((drama) => (
              <Card key={drama.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-14 rounded overflow-hidden bg-secondary/30 shrink-0">
                    {drama.poster_url ? (
                      <img src={drama.poster_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center"><Tv className="h-4 w-4 text-muted-foreground/40" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{drama.title}</h3>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant={drama.status === 'published' ? 'success' : 'secondary'} className="text-[10px]">{drama.status}</Badge>
                      {drama.genre_data && <span className="text-[10px] text-muted-foreground">{drama.genre_data.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => toggleDramaStatus(drama)}>
                      {drama.status === 'published' ? 'Unpub' : 'Pub'}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEditingDrama(drama); setShowDramaForm(true) }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDeleteDrama(drama.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Reels (Episodes) Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <Film className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-semibold">Episodes</h2>
              <p className="text-xs text-muted-foreground">Individual reel episodes</p>
            </div>
          </div>
          <Button onClick={() => { setEditing(null); setShowForm(true) }}>
            <Plus className="h-4 w-4" /> New Episode
          </Button>
        </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : reels.length === 0 ? (
        <EmptyState
          icon={Film}
          title="No reels yet"
          description="Upload your first reel episode to get started."
          action={<Button onClick={() => { setEditing(null); setShowForm(true) }}><Plus className="h-4 w-4" /> New Reel</Button>}
        />
      ) : (
        <div className="space-y-3">
          {reels.map((reel) => (
            <Card key={reel.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-14 h-20 rounded overflow-hidden bg-secondary/30 shrink-0">
                  {reel.thumbnail_url ? (
                    <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Film className="h-5 w-5 text-muted-foreground/40" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-medium truncate">{reel.title}</h3>
                    <Badge variant={reel.status === 'published' ? 'success' : 'secondary'} className="capitalize">{reel.status}</Badge>
                    {reel.is_premium && <Badge className="bg-amber-500/90 text-white"><Lock className="h-3 w-3" /></Badge>}
                    {reel.is_independent_drama ? (
                      <Badge variant="secondary"><Star className="h-3 w-3" /> Drama</Badge>
                    ) : (
                      <Badge variant="secondary"><BookOpen className="h-3 w-3" /> Book</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    EP {reel.episode_number}
                    {reel.book ? ` · ${reel.book.title}` : ''}
                    {reel.genre_data ? ` · ${reel.genre_data.name}` : ''}
                    {reel.is_premium ? ` · ${reel.coin_unlock_price} coins` : ' · Free'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => toggleStatus(reel)}>
                    {reel.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(reel); setShowForm(true) }}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(reel.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      </div>

      {showForm && (
        <ReelForm
          key={editing?.id ?? 'new'}
          reel={editing}
          books={books}
          genres={genres}
          dramas={dramas}
          userId={user?.id ?? null}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchReels() }}
        />
      )}

      {showDramaForm && (
        <DramaForm
          key={editingDrama?.id ?? 'new'}
          drama={editingDrama}
          books={books}
          genres={genres}
          userId={user?.id ?? null}
          onClose={() => setShowDramaForm(false)}
          onSaved={() => { setShowDramaForm(false); fetchDramas() }}
        />
      )}

      {showFeatured && (
        <FeaturedDramasManager
          dramas={dramas}
          onClose={() => setShowFeatured(false)}
        />
      )}
    </div>
  )
}

type ReelType = 'book_based' | 'independent_drama'

function ReelForm({
  reel,
  books,
  genres,
  dramas,
  userId,
  onClose,
  onSaved,
}: {
  reel: Reel | null
  books: Book[]
  genres: Genre[]
  dramas: DramaSeries[]
  userId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [title, setTitle] = useState(reel?.title ?? '')
  const [description, setDescription] = useState(reel?.description ?? '')
  const [reelType, setReelType] = useState<ReelType>(
    reel ? (reel.is_independent_drama ? 'independent_drama' : 'book_based') : 'book_based'
  )
  const [relatedBookId, setRelatedBookId] = useState(reel?.related_book_id ?? '')
  const [dramaSeriesId, setDramaSeriesId] = useState(reel?.drama_series_id ?? '')
  const [episodeNumber, setEpisodeNumber] = useState(reel?.episode_number ?? 1)
  const [bunnyUrl, setBunnyUrl] = useState(reel?.bunny_video_url ?? '')
  const [thumbnailUrl, setThumbnailUrl] = useState(reel?.thumbnail_url ?? '')
  const [duration, setDuration] = useState(reel?.duration ?? '')
  const [genreId, setGenreId] = useState(reel?.genre_id ?? '')
  const [isPremium, setIsPremium] = useState(reel?.is_premium ?? false)
  const [coinPrice, setCoinPrice] = useState(reel?.coin_unlock_price ?? 0)
  const [status, setStatus] = useState<'draft' | 'published'>(reel?.status ?? 'draft')
  const [uploadingThumb, setUploadingThumb] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    e.target.value = ''
    if (!file.type.startsWith('image/')) { toast('Please upload an image', 'error'); return }
    setUploadingThumb(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${userId}/reels/${Date.now()}-thumb.${ext}`
    const { error } = await supabase.storage.from('content-media').upload(path, file)
    if (error) { toast('Upload failed: ' + error.message, 'error'); }
    else {
      const { data } = supabase.storage.from('content-media').getPublicUrl(path)
      setThumbnailUrl(data.publicUrl)
      toast('Thumbnail uploaded', 'success')
    }
    setUploadingThumb(false)
  }

  const handleSave = async () => {
    if (!title.trim() || !bunnyUrl.trim()) { toast('Title and Bunny.net video URL are required', 'error'); return }
    if (reelType === 'book_based' && !relatedBookId) { toast('Please select a book for book-based reels', 'error'); return }
    setSaving(true)
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      related_book_id: reelType === 'book_based' ? relatedBookId : null,
      drama_series_id: dramaSeriesId || null,
      is_independent_drama: reelType === 'independent_drama',
      episode_number: episodeNumber,
      bunny_video_url: bunnyUrl.trim(),
      thumbnail_url: thumbnailUrl || null,
      duration: duration.trim() || null,
      genre_id: genreId || null,
      is_premium: isPremium,
      coin_unlock_price: isPremium ? coinPrice : 0,
      status,
      created_by: userId,
      updated_at: new Date().toISOString(),
    }
    if (reel) {
      const { error } = await supabase.from('reels').update(payload).eq('id', reel.id)
      if (error) toast('Failed: ' + error.message, 'error')
      else { toast('Reel updated', 'success'); onSaved() }
    } else {
      const { error } = await supabase.from('reels').insert(payload)
      if (error) toast('Failed: ' + error.message, 'error')
      else { toast('Reel created', 'success'); onSaved() }
    }
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reel ? 'Edit Reel' : 'New Reel'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Reel Type Selector */}
          <div className="space-y-2">
            <Label>Reel Type *</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReelType('book_based')}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                  reelType === 'book_based' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                }`}
              >
                <BookOpen className={`h-6 w-6 ${reelType === 'book_based' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">Book Based Reel</span>
                <span className="text-xs text-muted-foreground text-center">Episodes linked to a book</span>
              </button>
              <button
                type="button"
                onClick={() => setReelType('independent_drama')}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                  reelType === 'independent_drama' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                }`}
              >
                <Star className={`h-6 w-6 ${reelType === 'independent_drama' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">Independent Drama</span>
                <span className="text-xs text-muted-foreground text-center">Original mini drama series</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Episode title" />
          </div>

          {/* Drama Series selector */}
          <div className="space-y-2">
            <Label>Drama Series</Label>
            <Select value={dramaSeriesId} onValueChange={setDramaSeriesId}>
              <SelectTrigger><SelectValue placeholder="Select a drama series (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None (standalone)</SelectItem>
                {dramas.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Book selector — only for book-based reels */}
          {reelType === 'book_based' && (
            <div className="space-y-2">
              <Label>Related Book *</Label>
              <Select value={relatedBookId} onValueChange={setRelatedBookId}>
                <SelectTrigger><SelectValue placeholder="Select a book" /></SelectTrigger>
                <SelectContent>
                  {books.length === 0 ? (
                    <SelectItem value="_none" disabled>No books available</SelectItem>
                  ) : (
                    books.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
              {books.length === 0 && (
                <p className="text-xs text-destructive">No books exist yet. Create a book first.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Episode Number</Label>
              <Input type="number" value={episodeNumber} onChange={(e) => setEpisodeNumber(Number(e.target.value))} min={1} />
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 2:30" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bunny.net Video URL *</Label>
            <Input value={bunnyUrl} onChange={(e) => setBunnyUrl(e.target.value)} placeholder="https://...bunny.net/..." />
          </div>

          <div className="space-y-2">
            <Label>Genre</Label>
            <Select value={genreId} onValueChange={setGenreId}>
              <SelectTrigger><SelectValue placeholder="Select genre" /></SelectTrigger>
              <SelectContent>
                {genres.length === 0 ? (
                  <SelectItem value="_none" disabled>No genres available</SelectItem>
                ) : (
                  genres.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
            {genres.length === 0 && (
              <p className="text-xs text-muted-foreground">No genres yet. Create genres in the Genres admin page.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Thumbnail</Label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-24 rounded overflow-hidden bg-secondary/30 border border-border shrink-0">
                {thumbnailUrl ? <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <div className="flex h-full items-center justify-center"><Film className="h-5 w-5 text-muted-foreground/40" /></div>}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbUpload} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingThumb}>
                {uploadingThumb ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading</> : <><Upload className="h-4 w-4" /> Upload</>}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Episode description" rows={2} />
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Button size="sm" variant={isPremium ? 'default' : 'outline'} onClick={() => setIsPremium(true)}>
              <Lock className="h-3.5 w-3.5" /> Premium
            </Button>
            <Button size="sm" variant={!isPremium ? 'default' : 'outline'} onClick={() => setIsPremium(false)}>
              <Unlock className="h-3.5 w-3.5" /> Free
            </Button>
            {isPremium && (
              <div className="flex items-center gap-2">
                <Label className="text-xs">Coins:</Label>
                <Input type="number" value={coinPrice} onChange={(e) => setCoinPrice(Number(e.target.value))} min={0} className="w-20" />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant={status === 'draft' ? 'default' : 'outline'} onClick={() => setStatus('draft')}>Draft</Button>
            <Button size="sm" variant={status === 'published' ? 'default' : 'outline'} onClick={() => setStatus('published')}>Published</Button>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DramaForm({
  drama,
  books,
  genres,
  userId,
  onClose,
  onSaved,
}: {
  drama: DramaSeries | null
  books: Book[]
  genres: Genre[]
  userId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [title, setTitle] = useState(drama?.title ?? '')
  const [description, setDescription] = useState(drama?.description ?? '')
  const [posterUrl, setPosterUrl] = useState(drama?.poster_url ?? '')
  const [genreId, setGenreId] = useState(drama?.genre_id ?? '')
  const [relatedBookId, setRelatedBookId] = useState(drama?.related_book_id ?? '')
  const [isIndependent, setIsIndependent] = useState(drama?.is_independent ?? true)
  const [status, setStatus] = useState<'draft' | 'published'>(drama?.status ?? 'draft')
  const [uploadingPoster, setUploadingPoster] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    e.target.value = ''
    if (!file.type.startsWith('image/')) { toast('Please upload an image', 'error'); return }
    setUploadingPoster(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${userId}/drama-posters/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('covers').upload(path, file)
    if (error) { toast('Upload failed: ' + error.message, 'error') }
    else {
      const { data } = supabase.storage.from('covers').getPublicUrl(path)
      setPosterUrl(data.publicUrl)
      toast('Poster uploaded', 'success')
    }
    setUploadingPoster(false)
  }

  const handleSave = async () => {
    if (!title.trim()) { toast('Title is required', 'error'); return }
    setSaving(true)
    const payload = {
      title: title.trim(),
      description: description.trim() || '',
      poster_url: posterUrl || null,
      genre_id: genreId || null,
      related_book_id: !isIndependent && relatedBookId ? relatedBookId : null,
      is_independent: isIndependent,
      status,
      created_by: userId,
      updated_at: new Date().toISOString(),
    }
    if (drama) {
      const { error } = await supabase.from('drama_series').update(payload).eq('id', drama.id)
      if (error) toast('Failed: ' + error.message, 'error')
      else { toast('Drama updated', 'success'); onSaved() }
    } else {
      const { error } = await supabase.from('drama_series').insert(payload)
      if (error) toast('Failed: ' + error.message, 'error')
      else { toast('Drama created', 'success'); onSaved() }
    }
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{drama ? 'Edit Drama Series' : 'New Drama Series'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Drama series title" />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Drama description" rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Poster Image</Label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-24 rounded overflow-hidden bg-secondary/30 border border-border shrink-0">
                {posterUrl ? <img src={posterUrl} alt="" className="w-full h-full object-cover" /> : <div className="flex h-full items-center justify-center"><Tv className="h-5 w-5 text-muted-foreground/40" /></div>}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePosterUpload} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingPoster}>
                {uploadingPoster ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading</> : <><Upload className="h-4 w-4" /> Upload</>}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Genre</Label>
            <Select value={genreId} onValueChange={setGenreId}>
              <SelectTrigger><SelectValue placeholder="Select genre" /></SelectTrigger>
              <SelectContent>
                {genres.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Button size="sm" variant={isIndependent ? 'default' : 'outline'} onClick={() => setIsIndependent(true)}>
              <Star className="h-3.5 w-3.5" /> Independent
            </Button>
            <Button size="sm" variant={!isIndependent ? 'default' : 'outline'} onClick={() => setIsIndependent(false)}>
              <BookOpen className="h-3.5 w-3.5" /> Book Based
            </Button>
          </div>

          {!isIndependent && (
            <div className="space-y-2">
              <Label>Related Book</Label>
              <Select value={relatedBookId} onValueChange={setRelatedBookId}>
                <SelectTrigger><SelectValue placeholder="Select a book" /></SelectTrigger>
                <SelectContent>
                  {books.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" variant={status === 'draft' ? 'default' : 'outline'} onClick={() => setStatus('draft')}>Draft</Button>
            <Button size="sm" variant={status === 'published' ? 'default' : 'outline'} onClick={() => setStatus('published')}>Published</Button>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FeaturedDramasManager({ dramas, onClose }: { dramas: DramaSeries[]; onClose: () => void }) {
  const { toast } = useToast()
  const [section, setSection] = useState<string>('featured')
  const [featured, setFeatured] = useState<{ id: string; drama_id: string; position: number; drama?: DramaSeries }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const sections = [
    { value: 'featured', label: 'Featured' },
    { value: 'trending', label: 'Trending' },
    { value: 'popular', label: 'Popular' },
    { value: 'new_reels', label: 'New Releases' },
  ]

  useEffect(() => {
    fetchFeatured()
  }, [section])

  const fetchFeatured = async () => {
    setLoading(true)
    const { data } = await supabase.from('featured_reels').select('*, drama:drama_series(*)').eq('section', section).order('position', { ascending: true })
    setFeatured((data as unknown as { id: string; drama_id: string; position: number; drama?: DramaSeries }[]) ?? [])
    setLoading(false)
  }

  const handleAdd = async (dramaId: string) => {
    const maxPos = featured.length > 0 ? Math.max(...featured.map((f) => f.position)) : -1
    const { error } = await supabase.from('featured_reels').insert({
      drama_id: dramaId,
      section,
      position: maxPos + 1,
    })
    if (error) toast('Failed: ' + error.message, 'error')
    else { toast('Added to featured', 'success'); fetchFeatured() }
  }

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('featured_reels').delete().eq('id', id)
    if (error) toast('Failed: ' + error.message, 'error')
    else { toast('Removed', 'success'); fetchFeatured() }
  }

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    const index = featured.findIndex((f) => f.id === id)
    if (index === -1) return
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= featured.length) return
    const item = featured[index]
    const swapItem = featured[swapIndex]
    setSaving(true)
    await Promise.all([
      supabase.from('featured_reels').update({ position: swapItem.position }).eq('id', item.id),
      supabase.from('featured_reels').update({ position: item.position }).eq('id', swapItem.id),
    ])
    setSaving(false)
    fetchFeatured()
  }

  const availableDramas = dramas.filter((d) => !featured.some((f) => f.drama_id === d.id))

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Featured Dramas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Section</Label>
            <Select value={section} onValueChange={setSection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {sections.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Current featured ({featured.length})</Label>
                {featured.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No dramas featured in this section yet.</p>
                ) : (
                  <div className="space-y-2">
                    {featured.map((f, i) => (
                      <div key={f.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                        <span className="text-xs text-muted-foreground w-6">{i + 1}</span>
                        <span className="text-sm flex-1 truncate">{f.drama?.title ?? 'Unknown'}</span>
                        <Button size="icon" variant="ghost" disabled={saving || i === 0} onClick={() => handleMove(f.id, 'up')}><ChevronUp className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" disabled={saving || i === featured.length - 1} onClick={() => handleMove(f.id, 'down')}><ChevronDown className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleRemove(f.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {availableDramas.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Add drama to this section</Label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {availableDramas.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => handleAdd(d.id)}
                        className="flex items-center gap-2 w-full rounded-lg border border-border p-2 hover:border-primary/30 hover:bg-primary/5 transition-all text-left"
                      >
                        <Plus className="h-3.5 w-3.5 text-primary" />
                        <span className="text-sm flex-1 truncate">{d.title}</span>
                        {d.genre_data && <Badge variant="secondary" className="text-[10px]">{d.genre_data.name}</Badge>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Done</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
