import { useState, useEffect, useCallback } from 'react'
import { Trash2, RotateCcw, BookOpen, FileText, Film, Tag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Book } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { formatDate } from '@/lib/utils'

type DeletedItemType = 'book' | 'chapter' | 'reel' | 'genre'

interface DeletedItem {
  id: string
  title: string
  type: DeletedItemType
  deleted_at: string | null
  deleted_by: string | null
}

export function AdminRecycleBinPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<DeletedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<DeletedItemType>('book')

  const fetchItems = useCallback(async () => {
    const [booksRes, chaptersRes, reelsRes, genresRes] = await Promise.all([
      supabase.from('books').select('id, title, deleted_at, deleted_by').not('deleted_at', 'is', null),
      supabase.from('chapters').select('id, title, deleted_at, deleted_by').not('deleted_at', 'is', null),
      supabase.from('reels').select('id, title, deleted_at, deleted_by').not('deleted_at', 'is', null),
      supabase.from('genres').select('id, name, deleted_at, deleted_by').not('deleted_at', 'is', null),
    ])

    const all: DeletedItem[] = [
      ...((booksRes.data as any[]) ?? []).map(b => ({ id: b.id, title: b.title, type: 'book' as DeletedItemType, deleted_at: b.deleted_at, deleted_by: b.deleted_by })),
      ...((chaptersRes.data as any[]) ?? []).map(c => ({ id: c.id, title: c.title, type: 'chapter' as DeletedItemType, deleted_at: c.deleted_at, deleted_by: c.deleted_by })),
      ...((reelsRes.data as any[]) ?? []).map(r => ({ id: r.id, title: r.title, type: 'reel' as DeletedItemType, deleted_at: r.deleted_at, deleted_by: r.deleted_by })),
      ...((genresRes.data as any[]) ?? []).map(g => ({ id: g.id, title: g.name, type: 'genre' as DeletedItemType, deleted_at: g.deleted_at, deleted_by: g.deleted_by })),
    ].sort((a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? ''))

    setItems(all)
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleRestore = async (item: DeletedItem) => {
    const table = item.type === 'book' ? 'books' : item.type === 'chapter' ? 'chapters' : item.type === 'genre' ? 'genres' : 'reels'
    const { error } = await supabase.from(table)
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', item.id)
    if (error) {
      toast('Failed to restore', 'error')
    } else {
      toast('Restored successfully', 'success')
      await supabase.rpc('admin_log_action', {
        p_action: 'item_restored', p_entity_type: item.type, p_entity_id: item.id,
      })
      fetchItems()
    }
  }

  const handlePermanentDelete = async (item: DeletedItem) => {
    if (!confirm('Permanently delete this item? This cannot be undone.')) return
    const table = item.type === 'book' ? 'books' : item.type === 'chapter' ? 'chapters' : item.type === 'genre' ? 'genres' : 'reels'
    const { error } = await supabase.from(table).delete().eq('id', item.id)
    if (error) {
      toast('Failed to delete', 'error')
    } else {
      toast('Permanently deleted', 'info')
      await supabase.rpc('admin_log_action', {
        p_action: 'item_permanently_deleted', p_entity_type: item.type, p_entity_id: item.id,
      })
      fetchItems()
    }
  }

  const filtered = items.filter(i => i.type === tab)
  const counts = {
    book: items.filter(i => i.type === 'book').length,
    chapter: items.filter(i => i.type === 'chapter').length,
    reel: items.filter(i => i.type === 'reel').length,
    genre: items.filter(i => i.type === 'genre').length,
  }

  if (loading) {
    return (
      <div>
        <h1 className="font-serif text-2xl font-semibold mb-6">Recycle Bin</h1>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold mb-6">Recycle Bin</h1>

      <div className="flex gap-1 mb-6 border-b border-border">
        {(['book', 'chapter', 'reel', 'genre'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'book' ? 'Books' : t === 'chapter' ? 'Chapters' : t === 'reel' ? 'Reels' : 'Genres'} ({counts[t]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Trash2} title="Nothing here" description={`No deleted ${tab}s.`} />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {item.type === 'book' && <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />}
                    {item.type === 'chapter' && <FileText className="h-5 w-5 text-muted-foreground shrink-0" />}
                    {item.type === 'reel' && <Film className="h-5 w-5 text-muted-foreground shrink-0" />}
                    {item.type === 'genre' && <Tag className="h-5 w-5 text-muted-foreground shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">Deleted {item.deleted_at ? formatDate(item.deleted_at) : 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleRestore(item)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handlePermanentDelete(item)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
