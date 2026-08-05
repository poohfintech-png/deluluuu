import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, FileText, ArrowUp, ArrowDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { Book, Chapter } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChapterEditor } from '@/components/ChapterEditor'
import { formatDate } from '@/lib/utils'

export function AdminChaptersPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [books, setBooks] = useState<Book[]>([])
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)
  const [chaptersLoading, setChaptersLoading] = useState(false)
  const [editing, setEditing] = useState<Chapter | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editorKey, setEditorKey] = useState(0)

  useEffect(() => {
    const fetchBooks = async () => {
      setLoading(true)
      const { data, error } = await supabase.from('books').select('*').order('created_at', { ascending: false })
      if (error) {
        toast('Failed to load books', 'error')
      } else if (data) {
        setBooks(data as Book[])
        if (data.length > 0) setSelectedBookId(data[0].id)
      }
      setLoading(false)
    }
    fetchBooks()
  }, [])

  const fetchChapters = useCallback(async () => {
    if (!selectedBookId) return
    setChaptersLoading(true)
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', selectedBookId)
      .is('deleted_at', null)
      .order('order_index', { ascending: true })
    if (error) {
      toast('Failed to load chapters', 'error')
    } else if (data) {
      setChapters(data as unknown as Chapter[])
    }
    setChaptersLoading(false)
  }, [selectedBookId])

  useEffect(() => {
    if (selectedBookId) fetchChapters()
  }, [selectedBookId, fetchChapters])

  const handleDelete = async (id: string) => {
    if (!confirm('Move this chapter to the recycle bin? It can be restored later.')) return
    const { error } = await supabase.from('chapters').update({ deleted_at: new Date().toISOString(), deleted_by: user?.id }).eq('id', id)
    if (error) {
      toast('Failed to delete chapter', 'error')
    } else {
      toast('Chapter moved to recycle bin', 'success')
      await supabase.rpc('admin_log_action', { p_action: 'chapter_deleted', p_entity_type: 'chapter', p_entity_id: id })
      fetchChapters()
    }
  }

  const moveChapter = async (chapter: Chapter, direction: 'up' | 'down') => {
    const idx = chapters.findIndex((c) => c.id === chapter.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= chapters.length) return
    const swapWith = chapters[swapIdx]
    const { error: e1 } = await supabase.from('chapters').update({ order_index: swapWith.order_index, updated_at: new Date().toISOString() }).eq('id', chapter.id)
    const { error: e2 } = await supabase.from('chapters').update({ order_index: chapter.order_index, updated_at: new Date().toISOString() }).eq('id', swapWith.id)
    if (e1 || e2) {
      toast('Failed to reorder', 'error')
    } else {
      fetchChapters()
    }
  }

  const toggleStatus = async (ch: Chapter) => {
    const newStatus = ch.status === 'published' ? 'draft' : 'published'
    const { error } = await supabase.from('chapters').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', ch.id)
    if (error) {
      toast('Failed to update: ' + error.message, 'error')
    } else {
      toast(`Chapter ${newStatus}`, 'success')
      fetchChapters()
    }
  }

  const openNewEditor = () => {
    setEditing(null)
    setEditorKey((k) => k + 1)
    setShowEditor(true)
  }

  const openEditEditor = (chapter: Chapter) => {
    setEditing(chapter)
    setEditorKey((k) => k + 1)
    setShowEditor(true)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="font-serif text-2xl font-semibold">Chapters</h1>
        <div className="flex items-center gap-2">
          <select
            value={selectedBookId ?? ''}
            onChange={(e) => setSelectedBookId(e.target.value)}
            className="h-9 rounded-md border border-input bg-secondary/40 px-3 text-sm"
          >
            {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
          <Button onClick={openNewEditor} disabled={!selectedBookId}>
            <Plus className="h-4 w-4" /> New Chapter
          </Button>
        </div>
      </div>

      {loading || chaptersLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : chapters.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No chapters yet"
          description="Create the first chapter for this book."
          action={<Button onClick={openNewEditor}><Plus className="h-4 w-4" /> New Chapter</Button>}
        />
      ) : (
        <div className="space-y-2">
          {chapters.map((ch, idx) => (
            <Card key={ch.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveChapter(ch, 'up')} disabled={idx === 0}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveChapter(ch, 'down')} disabled={idx === chapters.length - 1}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/60 text-xs font-medium shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{ch.title}</h3>
                    <Badge variant={ch.status === 'published' ? 'success' : 'secondary'} className="capitalize">{ch.status}</Badge>
                    {ch.is_free && <Badge variant="default">Free</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {ch.audio_url && <span>Audio</span>}
                    {ch.video_url && <span>Video</span>}
                    <span>{formatDate(ch.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => toggleStatus(ch)}>
                    {ch.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEditEditor(ch)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(ch.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showEditor && selectedBookId && (
        <Dialog open onOpenChange={() => setShowEditor(false)}>
          <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Chapter' : 'New Chapter'}</DialogTitle>
            </DialogHeader>
            <ChapterEditor
              key={editorKey}
              chapter={editing}
              bookId={selectedBookId}
              onSaved={() => { setShowEditor(false); fetchChapters() }}
              onCancel={() => setShowEditor(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
