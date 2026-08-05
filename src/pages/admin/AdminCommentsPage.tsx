import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Trash2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Comment, Profile, Book, Chapter } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { formatRelative } from '@/lib/utils'

type CommentWithRelations = Comment & { user?: Profile; chapter?: Chapter; chapter_book?: Book }

export function AdminCommentsPage() {
  const { toast } = useToast()
  const [comments, setComments] = useState<CommentWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchComments = useCallback(async () => {
    const { data, error } = await supabase
      .from('comments')
      .select('*, user:profiles(*), chapter:chapters(*)')
      .order('created_at', { ascending: false })
    if (error) {
      toast('Failed to load comments', 'error')
    } else if (data) {
      setComments(data as unknown as CommentWithRelations[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchComments()

    const channel = supabase
      .channel('admin-comments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
        fetchComments()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchComments])

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', id)
    if (error) {
      toast('Failed to delete comment: ' + error.message, 'error')
    } else {
      toast('Comment deleted', 'success')
      setComments((prev) => prev.filter((c) => c.id !== id))
    }
  }

  const filtered = comments.filter((c) =>
    c.content.toLowerCase().includes(search.toLowerCase()) ||
    c.user?.display_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold mb-6">Comments</h1>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search comments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No comments" />
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-start gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={c.user?.avatar_url ?? undefined} />
                  <AvatarFallback>{c.user?.display_name?.[0]?.toUpperCase() ?? 'A'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{c.user?.display_name ?? 'Anonymous'}</span>
                    <span className="text-xs text-muted-foreground">{formatRelative(c.created_at)}</span>
                    {c.chapter && (
                      <span className="text-xs text-muted-foreground">on "{c.chapter.title}"</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/80">{c.content}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)} className="shrink-0">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
