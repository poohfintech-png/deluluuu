import { useState, useEffect } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown, LayoutGrid, Film, BookOpen, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Book, Reel, FeaturedBook, FeaturedReel, FeaturedSection, FeaturedReelSection } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const BOOK_SECTIONS: { key: BookSectionKey; label: string }[] = [
  { key: 'trending', label: 'Trending Books' },
  { key: 'popular', label: 'Popular Stories' },
  { key: 'new_releases', label: 'New Releases' },
  { key: 'recommended', label: 'Recommended' },
]

type BookSectionKey = 'trending' | 'popular' | 'new_releases' | 'recommended'

const REEL_SECTIONS: { key: FeaturedReelSection; label: string }[] = [
  { key: 'featured', label: 'Featured Reels' },
  { key: 'trending', label: 'Trending Reels' },
  { key: 'popular', label: 'Popular Reels' },
  { key: 'new_reels', label: 'New Reels' },
]

export function AdminHomepagePage() {
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold mb-6">Homepage Management</h1>
      <Tabs defaultValue="books">
        <TabsList className="mb-6">
          <TabsTrigger value="books" className="gap-1.5"><BookOpen className="h-4 w-4" /> Books</TabsTrigger>
          <TabsTrigger value="reels" className="gap-1.5"><Film className="h-4 w-4" /> Reels</TabsTrigger>
        </TabsList>
        <TabsContent value="books"><BookSectionsManager /></TabsContent>
        <TabsContent value="reels"><ReelSectionsManager /></TabsContent>
      </Tabs>
    </div>
  )
}

function BookSectionsManager() {
  const { toast } = useToast()
  const [featured, setFeatured] = useState<Record<BookSectionKey, FeaturedBook[]>>({
    trending: [],
    popular: [],
    new_releases: [],
    recommended: [],
  })
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBook, setSelectedBook] = useState<Record<BookSectionKey, string>>({
    trending: '',
    popular: '',
    new_releases: '',
    recommended: '',
  })

  const fetchFeatured = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('featured_books')
      .select('*, book:books!featured_books_book_id_fkey(*)')
      .order('position', { ascending: true })
    const grouped: Record<BookSectionKey, FeaturedBook[]> = { trending: [], popular: [], new_releases: [], recommended: [] }
    for (const item of (data as unknown as FeaturedBook[]) ?? []) {
      if (item.book && item.book.status === 'published') {
        const sec = item.section as BookSectionKey
        if (sec in grouped) grouped[sec].push(item)
      }
    }
    setFeatured(grouped)
    setLoading(false)
  }

  useEffect(() => {
    fetchFeatured()
    supabase.from('books').select('*').eq('status', 'published').order('title').then(({ data }) => setBooks((data as Book[]) ?? []))
  }, [])

  const addBookToSection = async (section: BookSectionKey) => {
    const bookId = selectedBook[section]
    if (!bookId) { toast('Select a book first', 'error'); return }
    const existing = featured[section]
    const { error } = await supabase.from('featured_books').insert({
      book_id: bookId,
      section,
      position: existing.length,
    })
    if (error) {
      if (error.code === '23505') toast('This book is already in this section', 'error')
      else toast('Failed: ' + error.message, 'error')
    } else {
      toast('Book added to section', 'success')
      setSelectedBook((prev) => ({ ...prev, [section]: '' }))
      fetchFeatured()
    }
  }

  const removeBook = async (id: string) => {
    const { error } = await supabase.from('featured_books').delete().eq('id', id)
    if (error) toast('Failed: ' + error.message, 'error')
    else { toast('Removed', 'success'); fetchFeatured() }
  }

  const moveBook = async (item: FeaturedBook, direction: 'up' | 'down') => {
    const section = item.section as BookSectionKey
    const sectionItems = featured[section]
    const idx = sectionItems.findIndex((f) => f.id === item.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sectionItems.length) return
    const swapItem = sectionItems[swapIdx]
    await Promise.all([
      supabase.from('featured_books').update({ position: swapIdx }).eq('id', item.id),
      supabase.from('featured_books').update({ position: idx }).eq('id', swapItem.id),
    ])
    fetchFeatured()
  }

  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
  }

  return (
    <div className="space-y-6">
      {BOOK_SECTIONS.map(({ key, label }) => (
        <div key={key}>
          <h3 className="font-medium text-sm mb-3">{label}</h3>
          <div className="flex gap-2 mb-3">
            <Select value={selectedBook[key]} onValueChange={(v) => setSelectedBook((prev) => ({ ...prev, [key]: v })) as unknown as string}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Select a book to add" /></SelectTrigger>
              <SelectContent>
                {books.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => addBookToSection(key)}><Plus className="h-4 w-4" /> Add</Button>
          </div>
          {featured[key].length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No books in this section yet.</p>
          ) : (
            <div className="space-y-2">
              {featured[key].map((item, idx) => (
                <Card key={item.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-8 h-10 rounded overflow-hidden bg-secondary/30 shrink-0">
                      {item.book?.cover_url ? <img src={item.book.cover_url} alt="" className="w-full h-full object-cover" /> : <BookOpen className="h-4 w-4 text-muted-foreground/40 m-auto mt-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.book?.title}</p>
                      <Badge variant="secondary" className="text-[10px]">#{idx + 1}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveBook(item, 'up')} disabled={idx === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveBook(item, 'down')} disabled={idx === featured[key].length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeBook(item.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ReelSectionsManager() {
  const { toast } = useToast()
  const [featured, setFeatured] = useState<Record<FeaturedReelSection, FeaturedReel[]>>({
    featured: [],
    trending: [],
    popular: [],
    new_reels: [],
  })
  const [reels, setReels] = useState<Reel[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReel, setSelectedReel] = useState<Record<FeaturedReelSection, string>>({
    featured: '',
    trending: '',
    popular: '',
    new_reels: '',
  })

  const fetchFeatured = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('featured_reels')
      .select('*, reel:reels(*)')
      .order('position', { ascending: true })
    const grouped: Record<FeaturedReelSection, FeaturedReel[]> = { featured: [], trending: [], popular: [], new_reels: [] }
    for (const item of (data as unknown as FeaturedReel[]) ?? []) {
      if (item.reel && item.reel.status === 'published') {
        grouped[item.section]?.push(item)
      }
    }
    setFeatured(grouped)
    setLoading(false)
  }

  useEffect(() => {
    fetchFeatured()
    supabase.from('reels').select('*').eq('status', 'published').order('title').then(({ data }) => setReels((data as Reel[]) ?? []))
  }, [])

  const addReelToSection = async (section: FeaturedReelSection) => {
    const reelId = selectedReel[section]
    if (!reelId) { toast('Select a reel first', 'error'); return }
    const existing = featured[section]
    const { error } = await supabase.from('featured_reels').insert({
      reel_id: reelId,
      section,
      position: existing.length,
    })
    if (error) {
      if (error.code === '23505') toast('This reel is already in this section', 'error')
      else toast('Failed: ' + error.message, 'error')
    } else {
      toast('Reel added to section', 'success')
      setSelectedReel((prev) => ({ ...prev, [section]: '' }))
      fetchFeatured()
    }
  }

  const removeReel = async (id: string) => {
    const { error } = await supabase.from('featured_reels').delete().eq('id', id)
    if (error) toast('Failed: ' + error.message, 'error')
    else { toast('Removed', 'success'); fetchFeatured() }
  }

  const moveReel = async (item: FeaturedReel, direction: 'up' | 'down') => {
    const sectionItems = featured[item.section]
    const idx = sectionItems.findIndex((f) => f.id === item.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sectionItems.length) return
    const swapItem = sectionItems[swapIdx]
    await Promise.all([
      supabase.from('featured_reels').update({ position: swapIdx }).eq('id', item.id),
      supabase.from('featured_reels').update({ position: idx }).eq('id', swapItem.id),
    ])
    fetchFeatured()
  }

  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
  }

  return (
    <div className="space-y-6">
      {REEL_SECTIONS.map(({ key, label }) => (
        <div key={key}>
          <h3 className="font-medium text-sm mb-3">{label}</h3>
          <div className="flex gap-2 mb-3">
            <Select value={selectedReel[key]} onValueChange={(v) => setSelectedReel((prev) => ({ ...prev, [key]: v }))}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Select a reel to add" /></SelectTrigger>
              <SelectContent>
                {reels.length === 0 ? (
                  <SelectItem value="_none" disabled>No reels available</SelectItem>
                ) : (
                  reels.map((r) => <SelectItem key={r.id} value={r.id}>{r.title} (EP {r.episode_number})</SelectItem>)
                )}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => addReelToSection(key)}><Plus className="h-4 w-4" /> Add</Button>
          </div>
          {featured[key].length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No reels in this section yet.</p>
          ) : (
            <div className="space-y-2">
              {featured[key].map((item, idx) => (
                <Card key={item.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-8 h-12 rounded overflow-hidden bg-secondary/30 shrink-0">
                      {item.reel?.thumbnail_url ? <img src={item.reel.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <Film className="h-4 w-4 text-muted-foreground/40 m-auto mt-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.reel?.title}</p>
                      <Badge variant="secondary" className="text-[10px]">EP {item.reel?.episode_number} · #{idx + 1}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveReel(item, 'up')} disabled={idx === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveReel(item, 'down')} disabled={idx === featured[key].length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeReel(item.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
