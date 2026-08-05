import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Heart, MessageCircle, Send, Lock, Headphones, Video, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { Chapter, Book, Comment, Profile } from '@/types'
import { TipTapRenderer } from '@/components/editor/TipTapRenderer'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { AudioPlayer } from '@/components/AudioPlayer'
import { EmptyState } from '@/components/EmptyState'
import { formatRelative, cn } from '@/lib/utils'

export function ChapterReaderPage() {
  const { bookId, chapterId } = useParams()
  const navigate = useNavigate()
  const { user, profile, isActiveSubscriber, isAdmin, hasEntitlement } = useAuth()
  const { toast } = useToast()

  const [book, setBook] = useState<Book | null>(null)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [comments, setComments] = useState<(Comment & { user?: Profile })[]>([])
  const [newComment, setNewComment] = useState('')
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [commentLoading, setCommentLoading] = useState(false)
  const progressRef = useRef(0)

  const canRead = (ch: Chapter | null) => {
    if (!ch) return false
    return ch.is_free || hasEntitlement('premium_books') || isAdmin
  }

  useEffect(() => {
    if (!bookId || !chapterId) return
    const fetchData = async () => {
      setLoading(true)
      const [{ data: bookData }, { data: chapterData }, { data: chaptersData }] = await Promise.all([
        supabase.from('books').select('*').eq('id', bookId).maybeSingle(),
        supabase.from('chapters').select('*').eq('id', chapterId).maybeSingle(),
        supabase.from('chapters').select('*').eq('book_id', bookId).eq('status', 'published').order('order_index', { ascending: true }),
      ])

      setBook(bookData as Book | null)
      setChapter(chapterData as unknown as Chapter | null)
      setChapters((chaptersData as unknown as Chapter[]) || [])

      // Comments
      const { data: commentData } = await supabase
        .from('comments')
        .select('*, user:profiles(*)')
        .eq('chapter_id', chapterId)
        .order('created_at', { ascending: false })
      if (commentData) setComments(commentData as unknown as (Comment & { user?: Profile })[])

      // Likes
      if (user) {
        const { data: likeData } = await supabase
          .from('chapter_likes')
          .select('id')
          .eq('user_id', user.id)
          .eq('chapter_id', chapterId)
          .maybeSingle()
        setLiked(!!likeData)
      }
      const { count } = await supabase
        .from('chapter_likes')
        .select('*', { count: 'exact', head: true })
        .eq('chapter_id', chapterId)
      setLikeCount(count || 0)

      // Reading history
      if (user && chapterData) {
        await supabase
          .from('reading_history')
          .upsert({
            user_id: user.id,
            chapter_id: chapterId,
            book_id: bookId,
            progress: 0,
            last_read_at: new Date().toISOString(),
          }, { onConflict: 'user_id,chapter_id' })
      }

      setLoading(false)
    }
    fetchData()
  }, [bookId, chapterId, user])

  // Progress tracking
  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY
      const height = document.documentElement.scrollHeight - window.innerHeight
      if (height > 0) {
        const pct = Math.min(100, Math.round((scrolled / height) * 100))
        if (Math.abs(pct - progressRef.current) >= 5) {
          progressRef.current = pct
          if (user && bookId && chapterId) {
            supabase
              .from('reading_history')
              .update({ progress: pct, last_read_at: new Date().toISOString() })
              .eq('user_id', user.id)
              .eq('chapter_id', chapterId)
              .then(() => {})
          }
        }
      }
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [user, bookId, chapterId])

  const toggleLike = async () => {
    if (!user) {
      navigate('/auth')
      return
    }
    if (liked) {
      await supabase.from('chapter_likes').delete().eq('user_id', user.id).eq('chapter_id', chapterId)
      setLiked(false)
      setLikeCount((c) => c - 1)
    } else {
      await supabase.from('chapter_likes').insert({ user_id: user.id, chapter_id: chapterId })
      setLiked(true)
      setLikeCount((c) => c + 1)
    }
  }

  const submitComment = async () => {
    if (!user || !newComment.trim() || !chapterId) return
    setCommentLoading(true)
    const content = newComment.trim()
    const { data, error } = await supabase
      .from('comments')
      .insert({ chapter_id: chapterId, user_id: user.id, content })
      .select('*, user:profiles(*)')
      .single()
    if (!error && data) {
      setComments((prev) => [data as unknown as Comment & { user?: Profile }, ...prev])
      setNewComment('')
      toast('Comment posted', 'success')
    } else {
      toast('Failed to post comment', 'error')
    }
    setCommentLoading(false)
  }

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', id)
    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== id))
      toast('Comment deleted', 'info')
    }
  }

  const handleAudioProgress = useCallback((seconds: number) => {
    if (user && bookId && chapterId) {
      supabase
        .from('listening_history')
        .upsert({
          user_id: user.id,
          chapter_id: chapterId,
          book_id: bookId,
          progress: Math.floor(seconds),
          last_listened_at: new Date().toISOString(),
        }, { onConflict: 'user_id,chapter_id' })
        .then(() => {})
    }
  }, [user, bookId, chapterId])

  if (loading) {
    return (
      <div className="container max-w-2xl py-8">
        <Skeleton className="h-6 w-24 mb-6" />
        <Skeleton className="h-10 w-3/4 mb-4" />
        <Skeleton className="h-4 w-1/2 mb-8" />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (!chapter || !book) {
    return (
      <div className="container py-20 text-center">
        <EmptyState icon={Lock} title="Chapter not found" />
      </div>
    )
  }

  if (!canRead(chapter)) {
    return (
      <div className="container max-w-2xl py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border border-primary/20 mx-auto mb-4">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-serif text-2xl font-semibold mb-2">This chapter is locked</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
          Subscribe to Delulu to unlock this chapter and all premium content.
        </p>
        <Button size="lg" onClick={() => navigate('/subscribe')}>Subscribe Now</Button>
      </div>
    )
  }

  const currentIdx = chapters.findIndex((c) => c.id === chapterId)
  const prevChapter = currentIdx > 0 ? chapters[currentIdx - 1] : null
  const nextChapter = currentIdx < chapters.length - 1 ? chapters[currentIdx + 1] : null

  return (
    <div className="min-h-screen pb-20 px-4 sm:px-6">
      {/* Ambient warm gradient background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-primary-soft/10 via-background to-accent-soft/10" />

      {/* Progress bar */}
      <div className="fixed top-16 left-0 right-0 h-1 bg-secondary/30 z-40">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
          style={{ width: `${progressRef.current}%` }}
        />
      </div>

     <article className="container max-w-3xl py-6 md:py-10 rounded-[1.75rem] border border-border/50 bg-card/60 backdrop-blur-sm shadow-lg shadow-black/5">
        <Link to={`/book/${bookId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-8 group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" /> {book.title}
        </Link>

          <div className="animate-fade-in-up mb-8 pt-4">
             <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80 mb-3">{book.title}</p>
             <h1 className="font-serif text-3xl md:text-4xl font-semibold text-balance leading-tight mb-2">{chapter.title}</h1>
             <p className="text-sm text-muted-foreground">{formatRelative(chapter.created_at)}</p>
           </div>

        {/* Chapter banner */}
        {chapter.banner_url && (
          <div className="mb-8 relative overflow-hidden rounded-[1.5rem] animate-fade-in">
            <img src={chapter.banner_url} alt={chapter.title} className="w-full max-h-72 object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/15 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#221916] via-[#221916]/80 to-transparent" />
         </div>
       )}
        {/* Chapter-level audio */}
        {chapter.audio_url && (
          <div className="mb-8">
            <AudioPlayer url={chapter.audio_url} title={chapter.title} onProgress={handleAudioProgress} />
          </div>
        )}

        {/* Chapter-level video */}
        {chapter.video_url && (
          <div className="mb-8">
            <div className="rounded-2xl overflow-hidden border border-border bg-black book-shadow">
              <video src={chapter.video_url} controls className="w-full" />
            </div>
          </div>
        )}

        {/* Rich content — immersive reading */}
        <div className="prose-delulu font-body text-[1.02rem] leading-[1.9] text-foreground/90">
          <TipTapRenderer doc={chapter.content} onAudioProgress={handleAudioProgress} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-6 mt-12 pt-6 border-t border-border/50">
          <button
            onClick={toggleLike}
            className={cn(
              'flex items-center gap-2 text-sm transition-all duration-300',
              liked ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Heart className={cn('h-5 w-5 transition-transform hover:scale-110', liked && 'fill-primary scale-110')} />
            {likeCount} {likeCount === 1 ? 'Like' : 'Likes'}
          </button>
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <MessageCircle className="h-5 w-5" />
            {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
          </button>
        </div>

        {/* Comments */}
        <div className="mt-8">
          <h3 className="font-serif text-lg font-semibold mb-6">Comments</h3>
          {user && (
            <div className="flex gap-3 mb-6">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback>{profile?.display_name[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Textarea
                  placeholder="Share your thoughts..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[60px] resize-none"
                />
                <div className="flex justify-end mt-2">
                  <Button size="sm" onClick={submitComment} disabled={!newComment.trim() || commentLoading}>
                    <Send className="h-3.5 w-3.5" /> Post
                  </Button>
                </div>
              </div>
            </div>
          )}

          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No comments yet. Be the first to share.</p>
          ) : (
            <div className="space-y-4">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={c.user?.avatar_url ?? undefined} />
                    <AvatarFallback>{c.user?.display_name?.[0]?.toUpperCase() ?? 'A'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{c.user?.display_name ?? 'Anonymous'}</span>
                      <span className="text-xs text-muted-foreground">{formatRelative(c.created_at)}</span>
                      {(c.user_id === user?.id || isAdmin) && (
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prev / Next */}
        <div className="flex justify-between mt-12 pt-6 border-t border-border">
          {prevChapter ? (
            <Button variant="outline" onClick={() => navigate(`/book/${bookId}/chapter/${prevChapter.id}`)}>
              <ArrowLeft className="h-4 w-4" /> Previous
            </Button>
          ) : <div />}
          {nextChapter ? (
            <Button variant="outline" onClick={() => navigate(`/book/${bookId}/chapter/${nextChapter.id}`)}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : <div />}
        </div>
      </article>
    </div>
  )
}



