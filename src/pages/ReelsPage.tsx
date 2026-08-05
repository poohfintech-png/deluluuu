import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  PlayCircle,
  TrendingUp,
  Flame,
  Star,
  Clock,
  Loader2,
  Film,
  Lock,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext'
import type { DramaSeries, Reel, FeaturedReelSection } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function ReelsPage() {
  const { isAdmin } = useAuth()
  const { isComingSoon: isFeatureComingSoon, isDisabled: isFeatureDisabled } = useFeatureFlags()
  const [featured, setFeatured] = useState<DramaSeries[]>([])
  const [trending, setTrending] = useState<DramaSeries[]>([])
  const [popular, setPopular] = useState<DramaSeries[]>([])
  const [newReleases, setNewReleases] = useState<DramaSeries[]>([])
  const [continueWatching, setContinueWatching] = useState<{ drama: DramaSeries; episode: Reel; progress: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isFeatureDisabled('reels')) {
      setLoading(false)
      return
    }
    const fetchAll = async () => {
      const [featRes, trendRes, popRes, newRes] = await Promise.all([
        supabase.from('featured_reels').select('*, drama:drama_series(*)').eq('section', 'featured').order('position', { ascending: true }).limit(10),
        supabase.from('featured_reels').select('*, drama:drama_series(*)').eq('section', 'trending').order('position', { ascending: true }).limit(10),
        supabase.from('featured_reels').select('*, drama:drama_series(*)').eq('section', 'popular').order('position', { ascending: true }).limit(10),
        supabase.from('featured_reels').select('*, drama:drama_series(*)').eq('section', 'new_reels').order('position', { ascending: true }).limit(10),
      ])

      const extract = (data: { drama: DramaSeries }[] | null) =>
        (data ?? []).map((f) => f.drama).filter((d): d is DramaSeries => d !== null && d.status === 'published')

      setFeatured(extract(featRes.data as unknown as { drama: DramaSeries }[] | null))
      setTrending(extract(trendRes.data as unknown as { drama: DramaSeries }[] | null))
      setPopular(extract(popRes.data as unknown as { drama: DramaSeries }[] | null))
      setNewReleases(extract(newRes.data as unknown as { drama: DramaSeries }[] | null))
      setLoading(false)
    }
    fetchAll()
  }, [isFeatureDisabled])

  const hasAny = featured.length > 0 || trending.length > 0 || popular.length > 0 || newReleases.length > 0

  if (isFeatureDisabled('reels')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <Film className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="font-serif text-lg font-semibold mb-2">Mini Dramas are currently unavailable</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          This feature has been turned off. Please check back later.
        </p>
      </div>
    )
  }

  if (isFeatureComingSoon('reels')) {
    return (
      <div className="min-h-screen">
        <section className="relative overflow-hidden border-b border-border/30">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-transparent" />
          <div className="container relative py-20 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-secondary/25 px-4 py-1.5 mb-6">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">Coming Soon</span>
            </div>
            <h1 className="font-serif text-3xl md:text-5xl font-semibold mb-4 max-w-2xl mx-auto text-balance">
              Mini Dramas are coming
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
              We're putting the finishing touches on our episodic mini drama experience.
              Check back soon for bite-sized stories you can watch on the go.
            </p>
            <Button asChild variant="outline" className="bg-secondary/30 hover:bg-secondary/50 border border-border/30 text-foreground">
              <Link to="/"><PlayCircle className="h-4 w-4" /> Explore Books</Link>
            </Button>
          </div>
        </section>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <Film className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="font-serif text-lg font-semibold mb-2">No dramas available yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {isAdmin ? 'Head to the admin panel to create your first drama series.' : 'Check back soon for mini dramas.'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-12">
      {featured.length > 0 && (
        <section className="relative overflow-hidden border-b border-border/30">
          <div className="relative">
            <Link to={`/drama/${featured[0].id}`} className="block relative aspect-[16/9] md:aspect-[21/9] overflow-hidden">
              {featured[0].poster_url ? (
                <img src={featured[0].poster_url} alt={featured[0].title} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-secondary/30 via-secondary/10 to-background" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
                <Badge className="bg-primary/90 text-white mb-3">Featured Drama</Badge>
                <h1 className="font-serif text-3xl md:text-5xl font-semibold text-white mb-3 max-w-2xl text-balance">
                  {featured[0].title}
                </h1>
                <p className="text-white/70 text-sm md:text-base max-w-xl line-clamp-2 mb-4">
                  {featured[0].description}
                </p>
                <Button size="lg" className="bg-secondary/30 hover:bg-secondary/50 border border-border/30 text-white">
                  <PlayCircle className="h-5 w-5" /> Watch Now
                </Button>
              </div>
            </Link>
          </div>
        </section>
      )}

      <div className="container py-8 space-y-12">
        {continueWatching.length > 0 && (
          <DramaSection icon={Clock} title="Continue Watching" dramas={continueWatching.map((c) => c.drama)} />
        )}
        {featured.length > 0 && (
          <DramaSection icon={Star} title="Featured Dramas" subtitle="Handpicked for you" dramas={featured} />
        )}
        {trending.length > 0 && (
          <DramaSection icon={TrendingUp} title="Trending Dramas" subtitle="Most watched this week" dramas={trending} />
        )}
        {popular.length > 0 && (
          <DramaSection icon={Flame} title="Popular Dramas" subtitle="Loved by viewers" dramas={popular} />
        )}
        {newReleases.length > 0 && (
          <DramaSection icon={PlayCircle} title="New Releases" subtitle="Freshly added" dramas={newReleases} />
        )}
      </div>
    </div>
  )
}

function DramaSection({ icon: Icon, title, subtitle, dramas }: { icon: typeof Film; title: string; subtitle?: string; dramas: DramaSeries[] }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-border/30">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif text-xl md:text-2xl font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
        {dramas.map((drama) => (
          <DramaCard key={drama.id} drama={drama} />
        ))}
      </div>
    </section>
  )
}

export function DramaCard({ drama }: { drama: DramaSeries }) {
  return (
    <Link
      to={`/drama/${drama.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/30 bg-card/90 transition-all hover:border-border/50 hover:shadow-lg hover:-translate-y-1"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-secondary/20">
        {drama.poster_url ? (
          <img src={drama.poster_url} alt={drama.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Film className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute top-2 right-2">
          {drama.episode_count ? (
            <Badge className="bg-black/70 text-white">{drama.episode_count} EP</Badge>
          ) : null}
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">{drama.title}</h3>
        {drama.genre_data && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{drama.genre_data.name}</p>
        )}
      </div>
    </Link>
  )
}