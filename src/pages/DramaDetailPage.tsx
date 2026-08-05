import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  PlayCircle,
  Lock,
  Clock,
  Star,
  Film,
  Loader2,
  Coins,
  ChevronRight,
  BookOpen,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext'
import { useToast } from '@/contexts/ToastContext'
import type { DramaSeries, Reel } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export function DramaDetailPage() {
  const { dramaId } = useParams<{ dramaId: string }>()
  const { user } = useAuth()
  const { isEnabled } = useFeatureFlags()
  const coinsEnabled = isEnabled('coins_system')
  const { toast } = useToast()
  const [drama, setDrama] = useState<DramaSeries | null>(null)
  const [episodes, setEpisodes] = useState<Reel[]>([])
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [unlocking, setUnlocking] = useState<string | null>(null)

  useEffect(() => {
    if (!dramaId) return
    const fetchDrama = async () => {
      setLoading(true)
      const [dramaRes, epRes] = await Promise.all([
        supabase.from('drama_series').select('*, genre_data:genres(*), book:books(*)').eq('id', dramaId).maybeSingle(),
        supabase.from('reels').select('*, genre_data:genres(*)').eq('drama_series_id', dramaId).order('episode_number', { ascending: true }),
      ])

      if (dramaRes.data) setDrama(dramaRes.data as unknown as DramaSeries)
      setEpisodes((epRes.data as unknown as Reel[]) ?? [])

      if (user) {
        const { data: unlocked } = await supabase.from('unlocked_content').select('reel_id').eq('user_id', user.id)
        setUnlockedIds(new Set((unlocked ?? []).map((u) => u.reel_id)))
      }
      setLoading(false)
    }
    fetchDrama()
  }, [dramaId, user])

  const handleUnlock = async (episode: Reel) => {
    if (!user) { toast('Sign in to unlock episodes', 'error'); return }
    if (!coinsEnabled) { toast('Coin system is currently disabled', 'error'); return }
    if (unlocking) return
    setUnlocking(episode.id)
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
      setUnlocking(null)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-4xl py-8">
        <Skeleton className="h-6 w-20 mb-6" />
        <div className="flex gap-6">
          <Skeleton className="w-48 h-72 rounded-xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!drama) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Film className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="font-serif text-lg font-semibold mb-2">Drama not found</h3>
        <Button asChild variant="outline"><Link to="/reels">Back to Reels</Link></Button>
      </div>
    )
  }

  const freeEpisodes = episodes.filter((e) => !e.is_premium)
  const premiumEpisodes = episodes.filter((e) => e.is_premium)
  const firstFree = freeEpisodes[0] ?? episodes[0]

  return (
    <div className="min-h-screen pb-12">
      {/* Back nav */}
      <div className="container pt-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/reels"><ArrowLeft className="h-4 w-4" /> Back to Reels</Link>
        </Button>
      </div>

      {/* Hero section */}
      <section className="container pt-4">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Poster */}
          <div className="w-40 md:w-56 shrink-0 mx-auto md:mx-0">
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-border bg-secondary/30 shadow-lg">
              {drama.poster_url ? (
                <img src={drama.poster_url} alt={drama.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Film className="h-10 w-10 text-muted-foreground/30" />
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            <div>
              <h1 className="font-serif text-2xl md:text-4xl font-semibold mb-2 text-balance">{drama.title}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                {drama.genre_data && (
                  <Badge variant="secondary">{drama.genre_data.name}</Badge>
                )}
                <Badge variant="secondary">{episodes.length} Episodes</Badge>
                <Badge variant="secondary">{freeEpisodes.length} Free</Badge>
                {premiumEpisodes.length > 0 && (
                  <Badge className="bg-amber-500/90 text-white">{premiumEpisodes.length} Premium</Badge>
                )}
              </div>
            </div>

            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl">
              {drama.description || 'No description available.'}
            </p>

            {drama.book && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                <span>Based on: </span>
                <Link to={`/book/${drama.book.id}`} className="text-primary hover:underline">{drama.book.title}</Link>
              </div>
            )}

            {firstFree && (
              <Button size="lg" asChild>
                <Link to={`/drama/${drama.id}/episode/${firstFree.id}`}>
                  <PlayCircle className="h-5 w-5" /> Watch Episode 1
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Episode list */}
      <section className="container pt-10">
        <h2 className="font-serif text-xl font-semibold mb-5">Episodes</h2>
        {episodes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No episodes uploaded yet.</p>
        ) : (
          <div className="space-y-3">
            {episodes.map((ep) => {
              const isUnlocked = !ep.is_premium || unlockedIds.has(ep.id)
              return (
                <div
                  key={ep.id}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-3 md:p-4 transition-all hover:border-primary/20"
                >
                  {/* Thumbnail */}
                  <div className="relative w-24 md:w-32 aspect-video rounded-lg overflow-hidden bg-secondary/30 shrink-0">
                    {ep.thumbnail_url ? (
                      <img src={ep.thumbnail_url} alt={ep.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Film className="h-5 w-5 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute top-1 left-1">
                      <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        EP {ep.episode_number}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{ep.title}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {ep.duration && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> {ep.duration}
                        </span>
                      )}
                      {ep.is_premium ? (
                        <Badge className="bg-amber-500/90 text-white">
                          <Lock className="h-3 w-3 mr-1" /> {coinsEnabled ? `${ep.coin_unlock_price} Coins` : 'Premium'}
                        </Badge>
                      ) : (
                        <Badge variant="success">Free</Badge>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <div className="shrink-0">
                    {isUnlocked ? (
                      <Button size="sm" asChild>
                        <Link to={`/drama/${drama.id}/episode/${ep.id}`}>
                          <PlayCircle className="h-4 w-4" /> Play
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnlock(ep)}
                        disabled={unlocking === ep.id || !coinsEnabled}
                      >
                        {unlocking === ep.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <><Coins className="h-4 w-4" /> Unlock</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
