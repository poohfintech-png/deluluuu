import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Heart,
  TrendingUp,
  Sparkles,
  Flame,
  Users,
  ChevronRight,
  FileText,
  Bookmark,
  Share2,
  Compass,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Book, Chapter } from '@/types'
import { Button } from '@/components/ui/button'
import { BookCard } from '@/components/BookCard'

function stripHtml(input?: string | null) {
  if (!input) return ''
  return input.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function formatCount(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num)) return String(value)
  if (num >= 1000000) return `${(num / 1000000).toFixed(num >= 10000000 ? 0 : 1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}K`
  return `${num}`
}

function timeAgo(dateValue?: string | null) {
  if (!dateValue) return null
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null

  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

export function BookPage() {
  const { id } = useParams()
  const [book, setBook] = useState<Book | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [recommended, setRecommended] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBook = async () => {
      if (!id) return

      const [bookRes, chapterRes, recRes] = await Promise.all([
        supabase
          .from('books')
          .select('*, author:profiles!books_author_id_fkey(*)')
          .eq('id', id)
          .single(),
        supabase
          .from('chapters')
          .select('*')
          .eq('book_id', id)
          .order('position', { ascending: true }),
        supabase
          .from('books')
          .select('*, author:profiles!books_author_id_fkey(*)')
          .eq('status', 'published')
          .neq('id', id)
          .order('updated_at', { ascending: false })
          .limit(6),
      ])

      setBook((bookRes.data as Book) ?? null)
      setChapters((chapterRes.data as Chapter[]) ?? [])
      setRecommended((recRes.data as Book[]) ?? [])
      setLoading(false)
    }

    fetchBook()
  }, [id])

  const stats = useMemo(() => {
    const views = (book as any)?.views ?? (book as any)?.view_count ?? (book as any)?.viewCount ?? null
    const likes = (book as any)?.likes ?? (book as any)?.like_count ?? (book as any)?.likeCount ?? null
    const chapterCount = chapters.length || (book as any)?.chapter_count || (book as any)?.chapterCount || 0
    const updatedAt = (book as any)?.updated_at ?? (book as any)?.updatedAt ?? null

    return {
      views: formatCount(views),
      likes: formatCount(likes),
      chapterCount: formatCount(chapterCount),
      updatedLabel: timeAgo(updatedAt),
    }
  }, [book, chapters.length])

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container py-10">
          <div className="h-6 w-32 rounded-full bg-secondary/30 animate-pulse mb-6" />
          <div className="grid gap-8 md:grid-cols-[320px,1fr]">
            <div className="aspect-[2/3] rounded-3xl bg-secondary/30 animate-pulse" />
            <div className="space-y-4">
              <div className="h-10 w-3/4 rounded bg-secondary/30 animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-secondary/30 animate-pulse" />
              <div className="h-24 w-full rounded bg-secondary/30 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container py-16 text-center">
          <h1 className="font-serif text-3xl font-semibold mb-4">Book not found</h1>
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Back home
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const cover = book.cover_url || book.coverUrl || null
  const title = book.title || 'Untitled Story'
  const authorName =
    book.author?.full_name ||
    book.author?.name ||
    book.author_name ||
    book.authorName ||
    'Anonymous Writer'

  const description = stripHtml(book.description || book.excerpt) || 'No summary available yet.'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border/20">
        <div className="absolute inset-0">
          {cover ? (
            <img
              src={cover}
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
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="mb-6 text-muted-foreground hover:text-foreground hover:bg-secondary/30"
          >
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>

          <div className="grid gap-8 md:grid-cols-[300px,1fr] items-start">
            <div className="relative mx-auto w-full max-w-[300px]">
              <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-3xl bg-primary/10 blur-2xl" />
              <div className="relative overflow-hidden rounded-3xl border border-border/30 bg-card/90 shadow-2xl shadow-black/20">
                <div className="relative aspect-[2/3] overflow-hidden bg-secondary/20">
                  {cover ? (
                    <img
                      src={cover}
                      alt={title}
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-secondary/20 to-background">
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
                  <Flame className="h-3 w-3 text-primary" />
                  Featured Story
                </span>
                {stats.updatedLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary/30 px-3 py-1 border border-border/30 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 text-primary" />
                    Updated {stats.updatedLabel}
                  </span>
                )}
              </div>

              <h1 className="font-serif text-4xl md:text-6xl font-semibold leading-[1.04] tracking-tight mb-4 text-balance">
                {title}
              </h1>

              <p className="text-lg text-foreground/75 mb-5">
                by <span className="text-foreground font-medium">{authorName}</span>
              </p>

              <div className="flex flex-wrap items-center gap-2 mb-6">
                {stats.views && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary/30 px-3 py-1 border border-border/30 text-xs">
                    <TrendingUp className="h-3 w-3" />
                    {stats.views} views
                  </span>
                )}
                {stats.likes && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary/30 px-3 py-1 border border-border/30 text-xs">
                    <Heart className="h-3 w-3" />
                    {stats.likes} likes
                  </span>
                )}
                {stats.chapterCount && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary/30 px-3 py-1 border border-border/30 text-xs">
                    <Users className="h-3 w-3" />
                    {stats.chapterCount} chapters
                  </span>
                )}
              </div>

              <div className="max-w-3xl rounded-3xl border border-border/30 bg-card/70 backdrop-blur-xl p-5 md:p-6 mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="font-serif text-xl font-semibold">About this book</h2>
                </div>
                <p className="text-base md:text-lg leading-relaxed text-foreground/75">
                  {description}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" className="bg-primary/20 hover:bg-primary/30 border border-border/30 text-foreground" asChild>
                  <Link to={chapters[0] ? `/book/${book.id}/chapter/${chapters[0].id}` : '#'}>
                    Read Now <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-secondary/30 hover:bg-secondary/50 border border-border/30 text-foreground"
                >
                  <Bookmark className="h-4 w-4" />
                  Save for Later
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
            </div>
          </div>
        </div>
      </section>

      <section className="container py-10 md:py-12">
        <div className="flex items-center justify-between mb-5 md:mb-6">
          <h2 className="font-serif text-2xl font-semibold">Chapters</h2>
          <span className="text-sm text-muted-foreground">
            {chapters.length} total
          </span>
        </div>

        <div className="space-y-3">
          {chapters.map((chapter, index) => (
            <Link
              key={chapter.id}
              to={`/book/${book.id}/chapter/${chapter.id}`}
              className="group flex items-center justify-between rounded-2xl border border-border/30 bg-card/90 px-4 py-4 hover:border-border/50 hover:bg-secondary/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">
                    Chapter {index + 1}
                  </p>
                  <h3 className="font-medium text-base group-hover:text-primary transition-colors">
                    {chapter.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Open chapter
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container py-10 md:py-12 border-t border-border/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shadow-sm shadow-primary/10">
            <Compass className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-semibold tracking-tight">More to explore</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Similar stories you may like
            </p>
          </div>
        </div>

        {recommended.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {recommended.map((item) => (
              <div key={item.id} className="w-full">
                <BookCard book={item} className="h-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/90 p-8 text-center text-sm text-muted-foreground">
            No related stories available yet.
          </div>
        )}
      </section>
    </div>
  )
}
