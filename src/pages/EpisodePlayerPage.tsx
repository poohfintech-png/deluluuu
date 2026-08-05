import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Lock,
  PlayCircle,
  ChevronRight,
  ChevronLeft,
  Film,
  Loader2,
  Clock,
  Coins,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext'
import { useToast } from '@/contexts/ToastContext'
import type { DramaSeries, Reel } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export function EpisodePlayerPage() {
  const { dramaId, episodeId } = useParams<{ dramaId: string; episodeId: string }>()
  const { user } = useAuth()
  const { isEnabled } = useFeatureFlags()
  const coinsEnabled = isEnabled('coins_system')
  const { toast } = useToast()
  const [drama, setDrama] = useState<DramaSeries | null>(null)
  const [episode, setEpisode] = useState<Reel | null>(null)
  const [allEpisodes, setAllEpisodes] = useState<Reel[]>([])
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [unlocking, setUnlocking] = useState(false)

  useEffect(() => {
    if (!dramaId || !episodeId) return
    const fetchData = async () => {
      setLoading(true)
      const [dramaRes, epRes, allEpsRes] = await Promise.all([
        supabase.from('drama_series').select('*, genre_data:genres(*)').eq('id', dramaId).maybeSingle(),
        supabase.from('reels').select('*').eq('id', episodeId).maybeSingle(),
        supabase.from('reels').select('*').eq('drama_series_id', dramaId).order('episode_number', { ascending: true }),
      ])

      setDrama(dramaRes.data as unknown as DramaSeries)
      setEpisode(epRes.data as unknown as Reel)
      setAllEpisodes((allEpsRes.data as unknown as Reel[]) ?? [])

      if (user) {
        const { data: unlocked } = await supabase.from('unlocked_content').select('reel_id').eq('user_id', user.id)
        setUnlockedIds(new Set((unlocked ?? []).map((u) => u.reel_id)))
      }
      setLoading(false)
    }
    fetchData()
  }, [dramaId, episodeId, user])

  // Increment view count on load
  useEffect(() => {
    if (!episode) return
    supabase.from('reels').update({ view_count: (episode.view_count ?? 0) + 1 }).eq('id', episode.id).then(() => {})
  }, [episode?.id])

  const handleUnlock = async () => {
    if (!user || !episode) return
    if (!coinsEnabled) { toast('Coin system is currently disabled', 'error'); return }
    setUnlocking(true)
    try {
      const { data: profile } = await supabase.from('profiles').select('coins').eq('id', user.id).maybeSingle()
      const currentCoins = profile?.coins ?? 0
      if (currentCoins < episode.coin_unlock_price) {
        toast(`Not enough coins. You have ${currentCoins}, need ${episode.coin_unlock_price}`, 'error')
        return
      }
      const { error: unlockError } = await supabase.from('unlocked_content').insert({
        user_id: user.id,
        reel_id: episode.id,
        coins_spent: episode.coin_unlock_price,
      })
      if (unlockError) { toast('Failed to unlock: ' + unlockError.message, 'error'); return }
      await supabase.from('coin_transactions').insert({
        user_id: user.id,
        amount: -episode.coin_unlock_price,
        transaction_type: 'spend',
        description: `Unlocked: ${episode.title}`,
        reel_id: episode.id,
      })
      await supabase.from('profiles').update({ coins: currentCoins - episode.coin_unlock_price }).eq('id', user.id)
      setUnlockedIds((prev) => new Set(prev).add(episode.id))
      toast('Episode unlocked!', 'success')
    } catch {
      toast('Failed to unlock episode', 'error')
    } finally {
      setUnlocking(false)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-4xl py-8">
        <Skeleton className="h-6 w-20 mb-6" />
        <Skeleton className="aspect-video w-full rounded-xl mb-4" />
        <Skeleton className="h-6 w-1/2 mb-2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    )
  }

  if (!drama || !episode) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Film className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="font-serif text-lg font-semibold mb-2">Episode not found</h3>
        <Button asChild variant="outline"><Link to="/reels">Back to Reels</Link></Button>
      </div>
    )
  }

  const isLocked = episode.is_premium && !unlockedIds.has(episode.id)
  const currentIndex = allEpisodes.findIndex((e) => e.id === episode.id)
  const prevEpisode = currentIndex > 0 ? allEpisodes[currentIndex - 1] : null
  const nextEpisode = currentIndex < allEpisodes.length - 1 ? allEpisodes[currentIndex + 1] : null

  return (
    <div className="min-h-screen pb-12">
      {/* Back nav */}
      <div className="container pt-6 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/drama/${dramaId}`}><ArrowLeft className="h-4 w-4" /> {drama.title}</Link>
        </Button>
      </div>

      {/* Video player */}
      <section className="container pt-4">
        <div className="relative aspect-video w-full max-w-4xl mx-auto rounded-xl overflow-hidden bg-black">
          {isLocked ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90">
              {episode.thumbnail_url && (
                <img src={episode.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
              )}
              <div className="relative z-10 text-center px-6">
                <Lock className="h-12 w-12 text-white/80 mx-auto mb-4" />
                <h3 className="font-serif text-xl text-white mb-2">Premium Episode</h3>
                <p className="text-white/60 text-sm mb-6">{coinsEnabled ? `Unlock this episode for ${episode.coin_unlock_price} coins` : 'Premium content'}</p>
                <Button size="lg" onClick={handleUnlock} disabled={unlocking || !coinsEnabled}>
                  {unlocking ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>{coinsEnabled ? <><Coins className="h-5 w-5" /> Unlock for {episode.coin_unlock_price} Coins</> : 'Premium'}</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <iframe
              src={episode.bunny_video_url}
              className="h-full w-full"
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture"
              title={episode.title}
            />
          )}
        </div>

        {/* Episode info */}
        <div className="max-w-4xl mx-auto mt-4">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary">EP {episode.episode_number}</Badge>
            {episode.is_premium ? (
              <Badge className="bg-amber-500/90 text-white"><Lock className="h-3 w-3 mr-1" /> Premium</Badge>
            ) : (
              <Badge variant="success">Free</Badge>
            )}
            {episode.duration && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> {episode.duration}
              </span>
            )}
          </div>
          <h1 className="font-serif text-xl md:text-2xl font-semibold mb-2">{episode.title}</h1>
          {episode.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{episode.description}</p>
          )}
        </div>

        {/* Prev/Next */}
        <div className="max-w-4xl mx-auto mt-6 flex items-center justify-between gap-4">
          {prevEpisode ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/drama/${dramaId}/episode/${prevEpisode.id}`}>
                <ChevronLeft className="h-4 w-4" /> EP {prevEpisode.episode_number}
              </Link>
            </Button>
          ) : (
            <div />
          )}
          {nextEpisode && (
            <Button size="sm" asChild>
              <Link to={`/drama/${dramaId}/episode/${nextEpisode.id}`}>
                Next: EP {nextEpisode.episode_number} <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </section>

      {/* Episode list */}
      {allEpisodes.length > 1 && (
        <section className="container pt-10">
          <h2 className="font-serif text-lg font-semibold mb-4">All Episodes</h2>
          <div className="space-y-2 max-w-4xl mx-auto">
            {allEpisodes.map((ep) => {
              const epLocked = ep.is_premium && !unlockedIds.has(ep.id)
              const isCurrent = ep.id === episode.id
              return (
                <Link
                  key={ep.id}
                  to={`/drama/${dramaId}/episode/${ep.id}`}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                    isCurrent ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/20'
                  }`}
                >
                  <div className="relative w-20 aspect-video rounded overflow-hidden bg-secondary/30 shrink-0">
                    {ep.thumbnail_url ? (
                      <img src={ep.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Film className="h-4 w-4 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground">EP {ep.episode_number}</span>
                    <h3 className="text-sm font-medium truncate">{ep.title}</h3>
                  </div>
                  {epLocked ? (
                    <Lock className="h-4 w-4 text-amber-500 shrink-0" />
                  ) : (
                    <PlayCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
