import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Lock,
  Headphones,
  Video,
  Heart,
  Bookmark,
  BookmarkCheck,
  Clock,
  User as UserIcon,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { Book, Chapter, Profile } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'

export function BookPage() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin, hasEntitlement } = useAuth()
  const { toast } = useToast()

  const [book, setBook] = useState<Book | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [author, setAuthor] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [inLibrary, setInLibrary] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [viewCount, setViewCount] = useState(0)
  const viewTrackedRef = useRef(false)

  useEffect(() => {
    if (!bookId) return

    const fetchData = async () => {
      setLoading(true)

      const { data: bookData } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .is('deleted_at', null)
        .maybeSingle()

      if (bookData) {
        setBook(bookData as Book)

        if (bookData.author_id) {
          const { data: authorData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', bookData.author_id)
            .maybeSingle()

          setAuthor(authorData as Profile | null)
        }
      }

      const { data: chapterData } = await supabase
        .from('chapters')
        .select('*')
        .eq('book_id', bookId)
        .eq('status', 'published')
        .order('order_index', { ascending: true })

      if (chapterData) setChapters(chapterData as unknown as Chapter[])

      if (user) {
        const { data: libData } = await supabase
          .from('libraries')
          .select('id')
          .eq('user_id', user.id)
          .eq('book_id', bookId)
          .maybeSingle()

        setInLibrary(!!libData)

        if (bookData?.author_id && bookData.author_id !== user.id) {
          const { data: followData } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', user.id)
            .eq('following_id', bookData.author_id)
            .maybeSingle()

          setIsFollowing(!!followData)
        }

        const { data: stats } = await supabase.rpc('get_book_stats', { p_book_id: bookId })
        if (stats) {
          const bookStats = Array.isArray(stats) ? stats[0] : stats
          setIsLiked(bookStats?.is_liked ?? false)
          setLikeCount(bookStats?.like_count ?? 0)
          setViewCount(bookStats?.view_count ?? 0)
        }
      } else {
        setLikeCount(bookData?.like_count ?? 0)
        setViewCount(bookData?.view_count ?? 0)
      }

      setLoading(false)

      if (!viewTrackedRef.current && bookId) {
        viewTrackedRef.current = true
        const sessionKey = user
          ? `u-${user.id}`
          : `s-${sessionStorage.getItem('session_id') || Math.random().toString(36).slice(2)}`

        if (!sessionStorage.getItem('session_id')) {
          sessionStorage.setItem('session_id', sessionKey.split('s-')[1])
        }

        try {
          const { data } = await supabase.rpc('increment_book_view', {
            p_book_id: bookId,
            p_session_key: sessionKey,
          })

          if (data === true) {
            setViewCount((prev) => prev + 1)
          }
        } catch {
          // non-critical
        }
      }
    }

    fetchData()
  }, [bookId, user])

  const toggleLibrary = async () => {
    if (!user) {
      navigate('/auth')
      return
    }

    if (inLibrary) {
      await supabase.from('libraries').delete().eq('user_id', user.id).eq('book_id', bookId)
      setInLibrary(false)
      toast('Removed from library', 'info')
    } else {
      await supabase.from('libraries').insert({ user_id: user.id, book_id: bookId })
      setInLibrary(true)
      toast('Added to library', 'success')
    }
  }

  const toggleFollow = async () => {
    if (!user || !book?.author_id) return

    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', book.author_id)
      setIsFollowing(false)
      toast('Unfollowed', 'info')
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: book.author_id })
      setIsFollowing(true)
      toast('Following author', 'success')
    }
  }

  const toggleLike = async () => {
    if (!user) {
      navigate('/auth')
      return
    }

    if (!bookId) return

    const { data } = await supabase.rpc('toggle_book_like', { p_book_id: bookId })

    if (data === true) {
      setIsLiked(true)
      setLikeCount((prev) => prev + 1)
    } else {
      setIsLiked(false)
      setLikeCount((prev) => Math.max(0, prev - 1))
    }
  }

  if (loading) {
    return (
      <div className="container py-8">
        <Skeleton className="h-6 w-24 mb-6" />
        <div className="grid md:grid-cols-[280px_1fr] gap-8">
          <Skeleton className="aspect-[3/4] w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="container py-20 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <h2 className="font-serif text-xl font-semibold mb-2">Book not found</h2>
        <Button variant="outline" onClick={() => navigate('/')}>
          Back to home
        </Button>
      </div>
    )
  }

  const canRead = (chapter: Chapter) => chapter.is_free || hasEntitlement('premium_books') || isAdmin

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border/20">
        <div className="absolute inset-0">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt=""
              className="h-full w-full object-cover scale-105 brightness-[0.22] contrast-110 saturate-75"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-secondary/30 via-background to-secondary/10" />
          )}
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/65" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/50 to-transparent" />
        </div>

        <div className="container relative py-10 md:py-14">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="grid gap-8 md:grid-cols-[300px,1fr] items-start">
            <div className="relative mx-auto w-full max-w-[300px]">
              <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-3xl bg-primary/10 blur-2xl" />
              <div className="relative overflow-hidden rounded-3xl border border-border/30 bg-card/90 shadow-2xl shadow-black/20">
                <div className="relative aspect-[3/4] overflow-hidden bg-secondary/20">
                  {book.cover_url ? (
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary/20 to-background">
                      <BookOpen className="h-16 w-16 text-primary/25" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/35 backdrop-blur-md border border-white/10 px-3 py-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/85">
                      Book
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-1 md:pt-4">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/30 px-3 py-1 border border-border/30 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 text-primary" />
                  Updated {formatDate(book.updated_at || book.created_at)}
                </span>
              </div>

              <h1 className="font-serif text-4xl md:text-6xl font-semibold leading-[1.04] tracking-tight mb-4 text-balance">
                {book.title}
              </h1>

              {author && (
                <div className="flex items-center gap-2 mb-5">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={author.avatar_url ?? undefined} />
                    <AvatarFallback>{author.display_name?.[0]?.toUpperCase() || 'A'}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{author.display_name}</span>
                    <span className="text-xs text-muted-foreground">Author</span>
                  </div>
                  {user && book.author_id !== user.id && (
                    <Button
                      size="sm"
                      variant={isFollowing ? 'secondary' : 'outline'}
                      className="ml-2"
                      onClick={toggleFollow}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </Button>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/30 px-3 py-1 border border-border/30 text-xs">
                  <Heart className={`h-3 w-3 ${isLiked ? 'fill-primary text-primary' : ''}`} />
                  {likeCount} likes
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/30 px-3 py-1 border border-border/30 text-xs">
                  <BookOpen className="h-3 w-3" />
                  {viewCount} views
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/30 px-3 py-1 border border-border/30 text-xs">
                  <BookOpen className="h-3 w-3" />
                  {chapters.length} chapters
                </span>
              </div>

              <div
                className="max-w-3xl rounded-3xl border border-border/30 bg-card/70 backdrop-blur-xl p-5 md:p-6 mb-8 prose-blurb"
                dangerouslySetInnerHTML={{ __html: book.description || 'No description available.' }}
              />

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={toggleLibrary} variant={inLibrary ? 'secondary' : 'outline'}>
                  {inLibrary ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                  {inLibrary ? 'In Library' : 'Add to Library'}
                </Button>

                <Button
                  size="lg"
                  className="bg-primary/20 hover:bg-primary/30 border border-border/30 text-foreground"
                  asChild
                >
                  <Link to={chapters[0] ? `/book/${book.id}/chapter/${chapters[0].id}` : '#'}>
                    Read Now <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="bg-secondary/30 hover:bg-secondary/50 border border-border/30 text-foreground"
                >
                  <Heart className="h-4 w-4" />
                  Like
                </Button>

                <Button
                  size="lg"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              </div>

              {!hasEntitlement('premium_books') && !isAdmin && (
                <div className="mt-8 rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
                  <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium mb-1">Subscribe to unlock full content</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Free preview chapters are available. Subscribe to read everything.
                    </p>
                    {user && (
                      <Button size="sm" onClick={() => navigate('/subscribe')}>
                        Subscribe Now
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="container py-10 md:py-12">
        <div className="flex items-center justify-between mb-5 md:mb-6">
          <h2 className="font-serif text-2xl font-semibold">Chapters</h2>
          <span className="text-sm text-muted-foreground">{chapters.length} total</span>
        </div>

        <div className="space-y-3">
          {chapters.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No chapters published yet.</p>
          ) : (
            chapters.map((chapter, idx) => {
              const readable = canRead(chapter)
              return (
                <Link
                  key={chapter.id}
                  to={readable ? `/book/${book.id}/chapter/${chapter.id}` : '/subscribe'}
                  className="group flex items-center gap-4 p-4 rounded-2xl border border-border hover:border-primary/30 hover:bg-secondary/30 transition-all"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 text-sm font-medium shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                        {chapter.title}
                      </h3>
                      {chapter.is_free && <Badge variant="success" className="text-[10px]">Free</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {chapter.audio_url && (
                        <span className="flex items-center gap-1">
                          <Headphones className="h-3 w-3" /> Audio
                        </span>
                      )}
                      {chapter.video_url && (
                        <span className="flex items-center gap-1">
                          <Video className="h-3 w-3" /> Video
                        </span>
                      )}
                      <span>{formatDate(chapter.created_at)}</span>
                    </div>
                  </div>
                  {!readable ? (
                    <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                  )}
                </Link>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}