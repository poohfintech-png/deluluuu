import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Users,
  CreditCard,
  TrendingUp,
  FileText,
  Clock,
  BadgeCheck,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatINR, formatRelative } from '@/lib/utils'

interface Stats {
  totalBooks: number
  publishedBooks: number
  totalChapters: number
  totalUsers: number
  activeSubscribers: number
  monthlySubscribers: number
  yearlySubscribers: number
  pendingPayments: number
  totalRevenue: number
}

interface RecentPayment {
  id: string
  order_ref: string
  status: string
  amount: number
  created_at: string
  user?: { display_name?: string }
  plan_snapshot?: { name?: string }
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    const [books, pubBooks, chapters, users, memberships, payments] = await Promise.all([
      supabase.from('books').select('*', { count: 'exact', head: true }),
      supabase.from('books').select('*', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('chapters').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('user_memberships').select('*, plan:membership_plans(*)').eq('status', 'active'),
      supabase.from('payment_requests').select('id, order_ref, status, amount, created_at, user:profiles!payment_requests_user_id_fkey(display_name), plan_snapshot').order('created_at', { ascending: false }).limit(5),
    ])

    const allMemberships = (memberships.data as any[]) || []
    const now = new Date().toISOString()
    const active = allMemberships.filter((m) => m.end_date && m.end_date > now)
    const monthly = active.filter((m) => m.plan?.duration_type === 'monthly' || (m.plan?.duration_days && m.plan.duration_days < 365))
    const yearly = active.filter((m) => m.plan?.duration_type === 'yearly' || (m.plan?.duration_days && m.plan.duration_days >= 365))

    const { data: approvedPayments } = await supabase
      .from('payment_requests')
      .select('amount')
      .eq('status', 'approved')
    const revenue = (approvedPayments || []).reduce((sum, p) => sum + (p.amount ?? 0), 0)

    const { count: pendingCount } = await supabase
      .from('payment_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'submitted'])

    setStats({
      totalBooks: books.count || 0,
      publishedBooks: pubBooks.count || 0,
      totalChapters: chapters.count || 0,
      totalUsers: users.count || 0,
      activeSubscribers: active.length,
      monthlySubscribers: monthly.length,
      yearlySubscribers: yearly.length,
      pendingPayments: pendingCount || 0,
      totalRevenue: revenue,
    })

    setRecentPayments((payments.data as unknown as RecentPayment[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStats()

    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, () => {
        fetchStats()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_memberships' }, () => {
        fetchStats()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, () => {
        fetchStats()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters' }, () => {
        fetchStats()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchStats])

  if (loading) {
    return (
      <div>
        <h1 className="font-serif text-2xl font-semibold mb-6">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    )
  }

  const statCards = [
    { label: 'Total Revenue', value: formatINR(stats?.totalRevenue ?? 0), icon: TrendingUp, color: 'text-success' },
    { label: 'Active Subscribers', value: stats?.activeSubscribers ?? 0, icon: BadgeCheck, color: 'text-primary' },
    { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-accent' },
    { label: 'Pending Payments', value: stats?.pendingPayments ?? 0, icon: Clock, color: 'text-warning' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-semibold">Dashboard</h1>
        <button
          onClick={fetchStats}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="bg-card/90 backdrop-blur-xl border border-border/30 transition-all duration-300 hover:border-border/50 hover:-translate-y-0.5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <Icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <p className="font-serif text-2xl font-semibold">{s.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-card/90 border-border/30">
          <CardHeader><CardTitle className="text-sm">Content</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Books</span>
              <span className="font-medium">{stats?.totalBooks}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Published</span>
              <span className="font-medium">{stats?.publishedBooks}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Chapters</span>
              <span className="font-medium">{stats?.totalChapters}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/90 border-border/30">
          <CardHeader><CardTitle className="text-sm">Subscribers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly</span>
              <span className="font-medium">{stats?.monthlySubscribers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Yearly</span>
              <span className="font-medium">{stats?.yearlySubscribers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Active</span>
              <span className="font-medium text-primary">{stats?.activeSubscribers}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/90 border-border/30">
          <CardHeader><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Link to="/admin/books" className="flex items-center justify-between text-sm hover:text-primary transition-colors">
              <span>Manage Books</span><ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link to="/admin/chapters" className="flex items-center justify-between text-sm hover:text-primary transition-colors">
              <span>Manage Chapters</span><ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link to="/admin/payments" className="flex items-center justify-between text-sm hover:text-primary transition-colors">
              <span>Review Payments</span><ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/90 border-border/30">
        <CardHeader>
          <CardTitle className="text-base">Recent Payment Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No payment requests yet.</p>
          ) : (
            <div className="space-y-3">
              {recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                      {payment.user?.display_name?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{payment.user?.display_name ?? 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{payment.plan_snapshot?.name ?? 'Plan'} · {formatRelative(payment.created_at)}</p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      payment.status === 'approved' ? 'success' :
                      payment.status === 'submitted' || payment.status === 'pending' ? 'warning' :
                      payment.status === 'rejected' ? 'destructive' : 'secondary'
                    }
                    className="capitalize"
                  >
                    {payment.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}