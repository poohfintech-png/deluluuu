import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Clock,
  Headphones,
  Heart,
  UserPlus,
  Bookmark,
  History,
  Sparkles,
  PlayCircle,
  Compass,
  CheckCircle2,
  Flame,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext'
import type {
  Book,
  ReadingHistoryEntry,
  ListeningHistoryEntry,
  Profile,
  Follow,
  UserLibraryItem,
  ViewingHistoryEntry,
} from '@/types'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { BookCard, BookCardSkeleton } from '@/components/BookCard'
import { EmptyState } from '@/components/EmptyState'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelative, formatDate } from '@/lib/utils'

export function ReaderDashboardPage() {
  const { user, profile } = useAuth()
  const { isEnabled, isDisabled } = useFeatureFlags()
  const audiobooksEnabled = isEnabled('audiobooks')
  const audiobooksDisabled = isDisabled('audiobooks')
  const dramaEnabled = isEnabled('reels')
  const dramaDisabled = isDisabled('reels')
  const [tab, setTab] = useState('continue')
  const [library, setLibrary] = useState<Book[]>([])
  const [readingHistory, setReadingHistory] = useState<(ReadingHistoryEntry & { chapter?: any; book?: Book })[]>([])
  const [listeningHistory, setListeningHistory] = useState<(ListeningHistoryEntry & { chapter?: any; book?: Book })[]>([])
  const [savedBooks, setSavedBooks] = useState<Book[]>([])
  const [completedBooks, setCompletedBooks] = useState<Book[]>([])
  const [dramaLibrary, setDramaLibrary] = useState<UserLibraryItem[]>([])
  const [viewingHistory, setViewingHistory] = useState<ViewingHistoryEntry[]>([])
  const [following, setFollowing] = useState<(Follow & { following?: Profile })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      const [libRes, rhRes, lhRes, followRes, savedRes, completedRes, dramaLibRes, viewingRes] = await Promise.all([
        supabase.from('libraries').select('book:books(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('reading_history').select('*, chapter:chapters(*), book:books(*)').eq('user_id', user.id).order('last_read_at', { ascending: false }).limit(20),
        supabase.from('listening_history').select('*, chapter:chapters(*), book:books(*)').eq('user_id', user.id).order('last_listened_at', { ascending: false }).limit(20),
        supabase.from('follows').select('*, following:profiles(*)').eq('follower_id', user.id).order('created_at', { ascending: false }),
        supabase.from('libraries').select('book:books(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
        Promise.resolve({ data: null, error: null, status: 0, statusText: '', count: null }),
        dramaDisabled
          ? Promise.resolve({ data: null, error: null, status: 0, statusText: '', count: null })
          : supabase.from('user_library').select('*, reel:reels!inner(*), drama:drama_series!inner(*)').eq('user_id', user.id).eq('content_type', 'drama').order('created_at', { ascending: false }),
        dramaDisabled
          ? Promise.resolve({ data: null, error: null, status: 0, statusText: '', count: null })
          : supabase.from('viewing_history').select('*, reel:reels(*)').eq('user_id', user.id).eq('content_type', 'drama').order('last_watched_at', { ascending: false }).limit(20),
      ])

      if (libRes.data) setLibrary(libRes.data.map((d: any) => d.book as Book).filter(Boolean))
      if (rhRes.data) setReadingHistory(rhRes.data as any)
      if (lhRes.data) setListeningHistory(lhRes.data as any)
      if (followRes.data) setFollowing(followRes.data as any)
      if (savedRes.data) setSavedBooks(savedRes.data.map((d: any) => d.book as Book).filter(Boolean))
      if (dramaLibRes.data) setDramaLibrary(dramaLibRes.data as unknown as UserLibraryItem[])
      if (viewingRes.data) setViewingHistory(viewingRes.data as unknown as ViewingHistoryEntry[])
      setLoading(false)
    }
    fetchData()
  }, [user, dramaDisabled])

  const hasDramaContent = dramaLibrary.length > 0 || viewingHistory.length > 0

  return (
    <div className="container max-w-5xl py-8 md:py-12">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="font-serif text-2xl md:text-3xl font-semibold text-primary">My Library</h1>
        <p className="text-sm text-muted-foreground mt-1">Your personal reading space</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 flex-wrap bg-card/90 backdrop-blur-xl border border-border/30 rounded-2xl p-1.5">
          <TabsTrigger value="continue"><Compass className="h-4 w-4 mr-1.5" /> Continue Your Escape</TabsTrigger>
          <TabsTrigger value="library"><Bookmark className="h-4 w-4 mr-1.5" /> The Worlds I Carry</TabsTrigger>
          {dramaEnabled && <TabsTrigger value="drama"><PlayCircle className="h-4 w-4 mr-1.5" /> Scenes Alive</TabsTrigger>}
          {audiobooksEnabled && <TabsTrigger value="audiobooks"><Headphones className="h-4 w-4 mr-1.5" /> Voices From Other Worlds</TabsTrigger>}
          <TabsTrigger value="following"><UserPlus className="h-4 w-4 mr-1.5" /> Following</TabsTrigger>
        </TabsList>

        <TabsContent value="continue">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : readingHistory.length === 0 && listeningHistory.length === 0 && viewingHistory.length === 0 ? (
            <EmptyState
              icon={Compass}
              title="No journeys in progress"
              description="Start reading or watching to pick up where you left off."
              action={<Button asChild><Link to="/">Discover Stories</Link></Button>}
            />
          ) : (
            <div className="space-y-6">
              {readingHistory.length > 0 && (
                <div>
                  <h3 className="font-serif text-lg font-semibold mb-3 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" /> Continue Reading
                  </h3>
                  <div className="space-y-2">
                    {readingHistory.slice(0, 5).map((entry) => (
                      <Link
                        key={entry.id}
                        to={`/book/${entry.book_id}/chapter/${entry.chapter_id}`}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border/30 hover:border-border/50 hover:bg-secondary/20 transition-all"
                      >
                        <div className="w-10 h-14 rounded overflow-hidden bg-secondary/30 shrink-0">
                          {entry.book?.cover_url && <img src={entry.book.cover_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entry.chapter?.title ?? 'Unknown chapter'}</p>
                          <p className="text-xs text-muted-foreground truncate">{entry.book?.title}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">{formatRelative(entry.last_read_at)}</p>
                          <div className="mt-1 w-20 h-1 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${entry.progress}%` }} />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {viewingHistory.length > 0 && (
                <div>
                  <h3 className="font-serif text-lg font-semibold mb-3 flex items-center gap-2">
                    <PlayCircle className="h-4 w-4 text-primary" /> Continue Watching
                  </h3>
                  <div className="space-y-2">
                    {viewingHistory.slice(0, 5).map((entry) => (
                      <Link
                        key={entry.id}
                        to={entry.episode_id ? `/drama/${entry.content_id}/episode/${entry.episode_id}` : `/drama/${entry.content_id}`}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border/30 hover:border-border/50 hover:bg-secondary/20 transition-all"
                      >
                        <div className="w-10 h-14 rounded overflow-hidden bg-secondary/30 shrink-0">
                          {entry.reel?.thumbnail_url && <img src={entry.reel.thumbnail_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entry.reel?.title ?? 'Unknown episode'}</p>
                          <p className="text-xs text-muted-foreground truncate">Drama</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">{formatRelative(entry.last_watched_at)}</p>
                          <div className="mt-1 w-20 h-1 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${entry.progress}%` }} />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {listeningHistory.length > 0 && (
                <div>
                  <h3 className="font-serif text-lg font-semibold mb-3 flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-primary" /> Continue Listening
                  </h3>
                  <div className="space-y-2">
                    {listeningHistory.slice(0, 5).map((entry) => (
                      <Link
                        key={entry.id}
                        to={`/book/${entry.book_id}/chapter/${entry.chapter_id}`}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border/30 hover:border-border/50 hover:bg-secondary/20 transition-all"
                      >
                        <div className="w-10 h-14 rounded overflow-hidden bg-secondary/30 shrink-0">
                          {entry.book?.cover_url && <img src={entry.book.cover_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entry.chapter?.title ?? 'Unknown chapter'}</p>
                          <p className="text-xs text-muted-foreground truncate">{entry.book?.title}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">{formatRelative(entry.last_listened_at)}</p>
                          <p className="text-xs text-muted-foreground">{Math.floor(entry.progress / 60)}m listened</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="library">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <BookCardSkeleton key={i} />)}
            </div>
          ) : library.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Your library is empty"
              description="Browse and add books to your library to keep track of stories you love."
              action={<Button asChild><Link to="/">Discover Books</Link></Button>}
            />
          ) : (
            <div className="space-y-8">
              <div>
                <h3 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-primary" /> Stories That Captured Me
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {library.map((book) => <BookCard key={book.id} book={book} />)}
                </div>
              </div>

              {completedBooks.length > 0 && (
                <div>
                  <h3 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Worlds I Completed
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {completedBooks.map((book) => <BookCard key={book.id} book={book} />)}
                  </div>
                </div>
              )}

              {readingHistory.length > 0 && (
                <div>
                  <h3 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" /> Memories I Left Behind
                  </h3>
                  <div className="space-y-2">
                    {readingHistory.map((entry) => (
                      <Link
                        key={entry.id}
                        to={`/book/${entry.book_id}/chapter/${entry.chapter_id}`}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border/30 hover:border-border/50 hover:bg-secondary/20 transition-all"
                      >
                        <div className="w-10 h-14 rounded overflow-hidden bg-secondary/30 shrink-0">
                          {entry.book?.cover_url && <img src={entry.book.cover_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entry.chapter?.title ?? 'Unknown chapter'}</p>
                          <p className="text-xs text-muted-foreground truncate">{entry.book?.title}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">{formatRelative(entry.last_read_at)}</p>
                          <Badge variant="secondary" className="mt-1">{entry.progress}%</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {dramaEnabled && (
          <TabsContent value="drama">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : !hasDramaContent ? (
              <EmptyState
                icon={PlayCircle}
                title="No dramas in your library yet"
                description="Save dramas to watch them later."
                action={<Button asChild><Link to="/reels">Discover Dramas</Link></Button>}
              />
            ) : (
              <div className="space-y-6">
                {viewingHistory.length > 0 && (
                  <div>
                    <h3 className="font-serif text-lg font-semibold mb-3 flex items-center gap-2">
                      <PlayCircle className="h-4 w-4 text-primary" /> Continue The Scene
                    </h3>
                    <div className="space-y-2">
                      {viewingHistory.map((entry) => (
                        <Link
                          key={entry.id}
                          to={entry.episode_id ? `/drama/${entry.content_id}/episode/${entry.episode_id}` : `/drama/${entry.content_id}`}
                          className="flex items-center gap-4 p-4 rounded-lg border border-border/30 hover:border-border/50 hover:bg-secondary/20 transition-all"
                        >
                          <div className="w-10 h-14 rounded overflow-hidden bg-secondary/30 shrink-0">
                            {entry.reel?.thumbnail_url && <img src={entry.reel.thumbnail_url} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{entry.reel?.title ?? 'Unknown episode'}</p>
                            <p className="text-xs text-muted-foreground truncate">Drama</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">{formatRelative(entry.last_watched_at)}</p>
                            <div className="mt-1 w-20 h-1 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${entry.progress}%` }} />
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {dramaLibrary.length > 0 && (
                  <div>
                    <h3 className="font-serif text-lg font-semibold mb-3 flex items-center gap-2">
                      <Bookmark className="h-4 w-4 text-primary" /> Worlds I Watched
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {dramaLibrary.map((item) => (
                        <Link key={item.id} to={`/drama/${item.content_id}`} className="group">
                          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-secondary/30 border border-border/30 group-hover:border-border/50 transition-all">
                            {item.reel?.thumbnail_url ? (
                              <img src={item.reel.thumbnail_url} alt={item.reel.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                            ) : (
                              <div className="flex h-full items-center justify-center"><PlayCircle className="h-8 w-8 text-muted-foreground/30" /></div>
                            )}
                          </div>
                          <p className="text-sm font-medium mt-2 truncate group-hover:text-primary transition-colors">{item.reel?.title ?? 'Unknown'}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        )}

        {audiobooksEnabled && (
          <TabsContent value="audiobooks">
            {listeningHistory.length === 0 ? (
              <EmptyState
                icon={Headphones}
                title="No audiobooks yet"
                description="Your audiobook listening history and saved audiobooks will appear here."
                action={<Button asChild><Link to="/audiobooks">Discover Audiobooks</Link></Button>}
              />
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="font-serif text-lg font-semibold mb-3 flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-primary" /> Whispers I Hear
                  </h3>
                  <div className="space-y-2">
                    {listeningHistory.map((entry) => (
                      <Link
                        key={entry.id}
                        to={`/book/${entry.book_id}/chapter/${entry.chapter_id}`}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border/30 hover:border-border/50 hover:bg-secondary/20 transition-all"
                      >
                        <div className="w-10 h-14 rounded overflow-hidden bg-secondary/30 shrink-0">
                          {entry.book?.cover_url && <img src={entry.book.cover_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entry.chapter?.title ?? 'Unknown chapter'}</p>
                          <p className="text-xs text-muted-foreground truncate">{entry.book?.title}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">{formatRelative(entry.last_listened_at)}</p>
                          <p className="text-xs text-muted-foreground">{Math.floor(entry.progress / 60)}m listened</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="following">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : following.length === 0 ? (
            <EmptyState icon={UserPlus} title="You're not following anyone yet" description="Follow writers to stay updated on their latest stories." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {following.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-4 rounded-lg border border-border/30 bg-card/90">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={f.following?.avatar_url ?? undefined} />
                    <AvatarFallback>{f.following?.display_name?.[0]?.toUpperCase() ?? 'A'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{f.following?.display_name ?? 'Unknown'}</p>
                    {f.following?.username && <p className="text-xs text-muted-foreground">@{f.following.username}</p>}
                    <p className="text-xs text-muted-foreground">Since {formatDate(f.created_at)}</p>
                  </div>
                  <Heart className="h-4 w-4 text-primary" />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}