import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  BookOpen,
  Headphones,
  Feather,
  ArrowRight,
  TrendingUp,
  Clock,
  Flame,
  Star,
  Compass,
  PlayCircle,
  ChevronRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Book, Genre, DramaSeries } from '@/types'
import { BookCard, BookCardSkeleton } from '@/components/BookCard'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext'

export function HomePage() {
  const { user, isAdmin, isWriter } = useAuth()
  const { isDisabled: isFeatureDisabled, isComingSoon: isFeatureComingSoon } = useFeatureFlags()

  const reelsDisabled = isFeatureDisabled('reels')
  const audiobooksDisabled = isFeatureDisabled('audiobooks')
  const audiobooksComingSoon = isFeatureComingSoon('audiobooks')

  const [trending, setTrending] = useState<Book[]>([])
  const [recent, setRecent] = useState<Book[]>([])
  const [popular, setPopular] = useState<Book[]>([])
  const [newReleases, setNewReleases] = useState<Book[]>([])
  const [recommended, setRecommended] = useState<Book[]>([])
  const [genres, setGenres] = useState<Genre[]>([])
  const [featuredDramas, setFeaturedDramas] = useState<DramaSeries[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      const bookSelect = '*, author:profiles!books_author_id_fkey(*)'
      const featuredBookSelect = '*, book:books!featured_books_book_id_fkey(*, author:profiles!books_author_id_fkey(*))'

      const [trendFeat, popFeat, newFeat, recFeat, genreRes] = await Promise.all([
        supabase.from('featured_books').select(featuredBookSelect).eq('section', 'trending').order('position', { ascending: true }).limit(10),
        supabase.from('featured_books').select(featuredBookSelect).eq('section', 'popular').order('position', { ascending: true }).limit(10),
        supabase.from('featured_books').select(featuredBookSelect).eq('section', 'new_releases').order('position', { ascending: true }).limit(10),
        supabase.from('featured_books').select(featuredBookSelect).eq('section', 'recommended').order('position', { ascending: true }).limit(10),
        supabase.from('genres').select('*').order('sort_order', { ascending: true }).limit(12),
      ])

      const recentRes = await supabase
        .from('books')
        .select(bookSelect)
        .eq('status', 'published')
        .order('updated_at', { ascending: false })
        .limit(10)

      const featuredDramasRes = reelsDisabled
        ? null
        : await supabase
            .from('featured_reels')
            .select('*, drama:drama_series(*)')
            .eq('section', 'featured')
            .order('position', { ascending: true })
            .limit(10)

      const extractBooks = (data: { book: Book }[] | null) =>
        (data ?? []).map((f) => f.book).filter((b): b is Book => b !== null && b.status === 'published')

      setTrending(extractBooks(trendFeat.data as unknown as { book: Book }[] | null))
      setRecent((recentRes.data as unknown as Book[]) ?? [])
      setPopular(extractBooks(popFeat.data as unknown as { book: Book }[] | null))
      setNewReleases(extractBooks(newFeat.data as unknown as { book: Book }[] | null))
      setRecommended(extractBooks(recFeat.data as unknown as { book: Book }[] | null))
      setGenres((genreRes.data as Genre[]) ?? [])

      if (featuredDramasRes?.data) {
        const dramas = ((featuredDramasRes.data as unknown as { drama: DramaSeries }[] | null) ?? [])
          .map((f) => f.drama)
          .filter((d): d is DramaSeries => d !== null && d.status === 'published')
        setFeaturedDramas(dramas)
      }

      setLoading(false)
    }

    fetchAll()
  }, [reelsDisabled])

  const hasAnyBooks =
    trending.length > 0 || recent.length > 0 || popular.length > 0 || newReleases.length > 0 || recommended.length > 0

  const heroBook = trending[0] ?? popular[0] ?? recent[0] ?? null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          {heroBook?.cover_url ? (
            <img
              src={heroBook.cover_url}
              alt=""
              className="h-full w-full object-cover scale-105 brightness-[0.28] contrast-110 saturate-75"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-secondary/30 via-background to-secondary/10" />
          )}
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/92 to-background/72" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/92 via-background/45 to-transparent" />
        </div>

        <div className="container relative pt-12 pb-14 md:pt-20 md:pb-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary/30 backdrop-blur-md border border-border/30 px-4 py-1.5 mb-4 animate-fade-in-up">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary tracking-wide">Premium Storytelling Platform</span>
            </div>

            <h1 className="font-serif text-4xl md:text-6xl font-semibold leading-[1.06] mb-4 text-balance animate-fade-in-up text-foreground">
              Stories that <span className="text-primary italic">move</span> you
            </h1>

            <p className="text-base md:text-lg text-foreground/75 max-w-xl mb-6 leading-relaxed animate-fade-in-up">
              Discover beautifully written stories, immersive audio, and short-form video reels from talented writers.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-3 animate-fade-in-up">
              {user ? (
                <Button size="lg" className="bg-secondary/30 hover:bg-secondary/50 border border-border/30 text-foreground" asChild>
                  <Link to="/dashboard">
                    Go to Library <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button size="lg" className="bg-primary/20 hover:bg-primary/30 border border-border/30 text-foreground" asChild>
                  <Link to="/auth?mode=signup">
                    Start Reading <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button size="lg" variant="outline" className="bg-secondary/30 hover:bg-secondary/50 border border-border/30 text-foreground" asChild>
                {isWriter ? (
                  <Link to="/writer-dashboard">
                    <Feather className="h-4 w-4" /> Writer Dashboard
                  </Link>
                ) : (
                  <Link to="/writer">
                    <Feather className="h-4 w-4" /> Join as Writer
                  </Link>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="container py-10 md:py-12">
          <SectionHeader icon={Compass} title="Discover" subtitle="Explore our collection" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <BookCardSkeleton key={i} />
            ))}
          </div>
        </section>
      ) : !hasAnyBooks ? (
        <section className="container py-16">
          <div className="flex flex-col items-center justify-center text-center bg-card/90 backdrop-blur-xl border border-border/30 rounded-2xl p-10 max-w-md mx-auto">
            <BookOpen className="h-12 w-12 text-primary/30 mb-4" />
            <h3 className="font-serif text-lg font-semibold mb-2">No stories available yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {isAdmin
                ? 'Head to the admin panel to publish your first book.'
                : 'Check back soon for new stories from our writers.'}
            </p>
          </div>
        </section>
      ) : (
        <>
          {trending.length > 0 && (
            <BookSection icon={TrendingUp} title="Everyone Is Talking About" subtitle="Most viewed this week" books={trending} />
          )}
          {popular.length > 0 && (
            <BookSection icon={Flame} title="Popular Stories" subtitle="Loved by readers" books={popular} />
          )}
          {recent.length > 0 && (
            <BookSection icon={Clock} title="Recently Updated" subtitle="Fresh chapters added" books={recent} />
          )}
          {recommended.length > 0 && (
            <BookSection icon={Compass} title="Recommended For You" subtitle="Picked for you" books={recommended} />
          )}

          {!reelsDisabled && featuredDramas.length > 0 && (
            <section className="container py-8 md:py-10">
              <SectionHeader icon={PlayCircle} title="Scenes Alive" subtitle="Step into short-form dramas" link="/reels" />
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                {featuredDramas.map((drama) => (
                  <Link
                    key={drama.id}
                    to={`/drama/${drama.id}`}
                    className="group relative w-36 sm:w-40 md:w-44 shrink-0 flex flex-col overflow-hidden rounded-2xl border border-border/30 bg-card/90 transition-all duration-500 hover:border-border/50 hover:shadow-xl hover:-translate-y-1.5"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden bg-secondary/20">
                      {drama.poster_url ? (
                        <img
                          src={drama.poster_url}
                          alt={drama.title}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <PlayCircle className="h-8 w-8 text-primary/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">{drama.title}</h3>
                      {drama.genre_data && <p className="text-xs text-muted-foreground truncate mt-0.5">{drama.genre_data.name}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!audiobooksDisabled && (
            <section className="container py-8 md:py-10">
              <SectionHeader icon={Headphones} title="Voices From Other Worlds" subtitle="Listen to stories come alive" link="/audiobooks" />
              {audiobooksComingSoon ? (
                <div className="flex flex-col items-center justify-center text-center py-12 rounded-2xl border border-dashed border-border bg-card/90">
                  <Headphones className="h-10 w-10 text-primary/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Audiobooks are coming soon. Stay tuned!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
                  <div className="flex flex-col items-center justify-center text-center py-12 rounded-2xl border border-dashed border-border bg-card/90">
                    <Headphones className="h-10 w-10 text-primary/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No audiobooks available yet.</p>
                  </div>
                </div>
              )}
            </section>
          )}

          {newReleases.length > 0 && (
            <BookSection icon={Star} title="New Releases" subtitle="Just published" books={newReleases} />
          )}
          {trending.length > 0 && (
            <BookSection icon={BookOpen} title="Stories That Move You" subtitle="Handpicked tales that stay with you" books={trending} />
          )}
        </>
      )}

      {genres.length > 0 && (
        <section className="container py-10 md:py-12">
          <SectionHeader icon={Compass} title="Genres" subtitle="Explore by category" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {genres.map((genre) => (
              <Link
                key={genre.id}
                to={`/?genre=${genre.slug ?? genre.name}`}
                className="group flex items-center gap-3 rounded-2xl bg-card/90 backdrop-blur-xl border border-border/30 p-4 hover:border-border/50 hover:bg-secondary/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform duration-300">
                  {genre.icon ? <span className="text-lg">{genre.icon}</span> : <BookOpen className="h-5 w-5 text-primary" />}
                </div>
                <div className="min-0">
                  <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">{genre.name}</h3>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">Browse genre</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function BookSection({
  icon: Icon,
  title,
  subtitle,
  books,
}: {
  icon: typeof BookOpen
  title: string
  subtitle: string
  books: Book[]
}) {
  return (
    <section className="container py-8 md:py-10 animate-fade-in">
      <SectionHeader icon={Icon} title={title} subtitle={subtitle} />
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
        {books.map((book) => (
          <div key={book.id} className="w-36 sm:w-40 md:w-44 shrink-0">
            <BookCard book={book} className="h-full" />
          </div>
        ))}
      </div>
    </section>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  link,
}: {
  icon: typeof BookOpen
  title: string
  subtitle: string
  link?: string
}) {
  return (
    <div className="flex items-center justify-between mb-5 md:mb-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shadow-sm shadow-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-serif text-xl md:text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      {link && (
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground hover:bg-secondary/40">
          <Link to={link}>
            View All <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  )
}