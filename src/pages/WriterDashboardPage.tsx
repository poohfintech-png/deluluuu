import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  FileText,
  Eye,
  Heart,
  TrendingUp,
  Loader2,
  PenLine,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Book, Chapter } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function WriterDashboardPage() {
  const { user, profile } = useAuth()
  const [books, setBooks] = useState<Book[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)
  const [totalViews, setTotalViews] = useState(0)
  const [totalLikes, setTotalLikes] = useState(0)
  const [followers, setFollowers] = useState(0)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      setLoading(true)
      const [booksRes, followersRes] = await Promise.all([
        supabase.from('books').select('*, author:profiles!books_author_id_fkey(*)').eq('author_id', user.id).order('updated_at', { ascending: false }),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
      ])
      const booksData = (booksRes.data as unknown as Book[]) ?? []
      setBooks(booksData)
      setFollowers(followersRes.count ?? 0)

      const views = booksData.reduce((sum, b) => sum + (b.view_count ?? 0), 0)
      const likes = booksData.reduce((sum, b) => sum + (b.like_count ?? 0), 0)
      setTotalViews(views)
      setTotalLikes(likes)

      if (booksData.length > 0) {
        const bookIds = booksData.map((b) => b.id)
        const { data: chData } = await supabase.from('chapters').select('*').in('book_id', bookIds).order('updated_at', { ascending: false })
        setChapters((chData as Chapter[]) ?? [])
      }
      setLoading(false)
    }
    fetchData()
  }, [user])

  const publishedBooks = books.filter((b) => b.status === 'published')
  const draftBooks = books.filter((b) => b.status === 'draft')
  const publishedChapters = chapters.filter((c) => c.status === 'published')
  const draftChapters = chapters.filter((c) => c.status === 'draft')

  if (!profile) return null

  return (
    <div className="container max-w-5xl py-8 md:py-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 animate-fade-in-up">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-semibold text-primary">Author Studio</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back, {profile.display_name}</p>
        </div>
        <Badge variant="secondary" className="gap-1.5 bg-card/90 backdrop-blur-xl border border-border/30">
          <PenLine className="h-3.5 w-3.5" /> Writer
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={BookOpen} label="Published Books" value={publishedBooks.length} />
        <StatCard icon={FileText} label="Chapters" value={publishedChapters.length} />
        <StatCard icon={Eye} label="Total Views" value={totalViews} />
        <StatCard icon={Users} label="Followers" value={followers} />
      </div>

      <Tabs defaultValue="books">
        <TabsList className="w-full justify-start mb-6 flex-wrap bg-card/90 backdrop-blur-xl border border-border/30 rounded-2xl p-1.5">
          <TabsTrigger value="books" className="gap-1.5"><BookOpen className="h-4 w-4" /> My Books</TabsTrigger>
          <TabsTrigger value="chapters" className="gap-1.5"><FileText className="h-4 w-4" /> My Chapters</TabsTrigger>
          <TabsTrigger value="drafts" className="gap-1.5"><PenLine className="h-4 w-4" /> Drafts</TabsTrigger>
        </TabsList>

        <TabsContent value="books">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          ) : books.length === 0 ? (
            <EmptyState icon={BookOpen} title="No books yet" description="Your published and draft books will appear here." />
          ) : (
            <div className="space-y-3">
              {books.map((book) => (
                <Card key={book.id} className="bg-card/90 border-border/30">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-16 rounded overflow-hidden bg-secondary/30 shrink-0">
                      {book.cover_url ? <img src={book.cover_url} alt="" className="w-full h-full object-cover" /> : <BookOpen className="h-5 w-5 text-muted-foreground/40 m-auto mt-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{book.title}</h3>
                        <Badge variant={book.status === 'published' ? 'success' : 'secondary'} className="capitalize">{book.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-3">
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {book.view_count}</span>
                        <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {book.like_count}</span>
                      </p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/book/${book.id}`}>View</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="chapters">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : publishedChapters.length === 0 ? (
            <EmptyState icon={FileText} title="No published chapters" description="Your published chapters will appear here." />
          ) : (
            <div className="space-y-2">
              {publishedChapters.map((ch) => {
                const book = books.find((b) => b.id === ch.book_id)
                return (
                  <div key={ch.id} className="flex items-center gap-3 rounded-lg border border-border/30 bg-card/90 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary/40 shrink-0"><FileText className="h-5 w-5 text-muted-foreground/40" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ch.title}</p>
                      <p className="text-xs text-muted-foreground">{book?.title ?? 'Unknown book'}</p>
                    </div>
                    <Badge variant="success">Published</Badge>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="drafts">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : draftBooks.length === 0 && draftChapters.length === 0 ? (
            <EmptyState icon={PenLine} title="No drafts" description="Your draft books and chapters will appear here." />
          ) : (
            <div className="space-y-4">
              {draftBooks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Draft Books</h3>
                  <div className="space-y-2">
                    {draftBooks.map((book) => (
                      <div key={book.id} className="flex items-center gap-3 rounded-lg border border-border/30 bg-card/90 p-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary/40 shrink-0"><BookOpen className="h-5 w-5 text-muted-foreground/40" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{book.title}</p>
                        </div>
                        <Badge variant="secondary">Draft</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {draftChapters.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Draft Chapters</h3>
                  <div className="space-y-2">
                    {draftChapters.map((ch) => {
                      const book = books.find((b) => b.id === ch.book_id)
                      return (
                        <div key={ch.id} className="flex items-center gap-3 rounded-lg border border-border/30 bg-card/90 p-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary/40 shrink-0"><FileText className="h-5 w-5 text-muted-foreground/40" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{ch.title}</p>
                            <p className="text-xs text-muted-foreground">{book?.title ?? 'Unknown book'}</p>
                          </div>
                          <Badge variant="secondary">Draft</Badge>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: number }) {
  return (
    <div className="bg-card/90 backdrop-blur-xl rounded-2xl border border-border/30 p-5 transition-all duration-300 hover:border-border/50 hover:-translate-y-0.5">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      <p className="font-serif text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}