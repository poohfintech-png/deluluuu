import { Link } from 'react-router-dom'
import { BookOpen, Sparkles, TrendingUp, Heart, Users } from 'lucide-react'
import type { Book } from '@/types'
import { cn } from '@/lib/utils'

interface BookCardProps {
  book: Book
  className?: string
}

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

function getBookMeta(book: Book) {
  const views = book.view_count ?? null
  const likes = book.like_count ?? null
  const authorLabel = book.author?.display_name ?? ''
  return { views, likes, authorLabel }
}

export function BookCard({ book, className }: BookCardProps) {
  const cover = book.cover_url
  const title = book.title || 'Untitled Story'
  const { views, likes, authorLabel } = getBookMeta(book)

  const description = stripHtml(book.description) || 'A story waiting to be discovered.'
  const viewLabel = formatCount(views)
  const likeLabel = formatCount(likes)
  const authorText = authorLabel ? authorLabel : 'Anonymous Writer'

  return (
    <Link
      to={`/book/${book.id}`}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/30 bg-card/90 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1.5 hover:border-border/50 hover:shadow-2xl hover:shadow-black/20',
        className
      )}
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-secondary/20">
        {cover ? (
          <img
            src={cover}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-secondary/20 to-background">
            <BookOpen className="h-12 w-12 text-primary/25" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/12 to-transparent opacity-90 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="absolute inset-0 ring-1 ring-inset ring-white/5" />

        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/35 backdrop-blur-md border border-white/10 px-2.5 py-1">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/85">
            Story
          </span>
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/75 mb-1 line-clamp-1">
            by {authorText}
          </p>
          <h3 className="font-serif text-base font-semibold leading-tight text-white line-clamp-2 group-hover:text-primary/95 transition-colors duration-300">
            {title}
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3.5 md:p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2.5">
          {viewLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/30 px-2.5 py-1 border border-border/30">
              <TrendingUp className="h-3 w-3" />
              {viewLabel} views
            </span>
          )}
          {likeLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/30 px-2.5 py-1 border border-border/30">
              <Heart className="h-3 w-3" />
              {likeLabel} likes
            </span>
          )}
          {!viewLabel && !likeLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/30 px-2.5 py-1 border border-border/30">
              <Users className="h-3 w-3" />
              Reader pick
            </span>
          )}
        </div>

        <p className="text-sm text-foreground/70 line-clamp-2 leading-relaxed">
          {description}
        </p>

        <div className="mt-auto pt-3.5 flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.18em] text-primary/80 font-medium">
            Read now
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary transition-transform duration-300 group-hover:translate-x-0.5">
            →
          </span>
        </div>
      </div>
    </Link>
  )
}

export function BookCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/30 bg-card/70 animate-pulse">
      <div className="aspect-[2/3] bg-secondary/30" />
      <div className="p-4 space-y-3">
        <div className="h-3 w-20 rounded-full bg-secondary/30" />
        <div className="h-5 w-3/4 rounded bg-secondary/30" />
        <div className="h-3 w-full rounded bg-secondary/30" />
        <div className="h-3 w-5/6 rounded bg-secondary/30" />
      </div>
    </div>
  )
}