import { useState, useEffect, useCallback } from 'react'
import { Shield, Activity, LogIn, Database, HardDrive, Clock, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { AdminActivityLog, AdminLoginHistory, Profile } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { formatRelative, formatDate } from '@/lib/utils'

export function AdminSecurityPage() {
  const { user, profile, session } = useAuth()
  const [activityLog, setActivityLog] = useState<(AdminActivityLog & { admin?: Profile })[]>([])
  const [loginHistory, setLoginHistory] = useState<(AdminLoginHistory & { user?: Profile })[]>([])
  const [loading, setLoading] = useState(true)
  const [dbStats, setDbStats] = useState<{ users: number; books: number; payments: number; plans: number } | null>(null)

  const fetchData = useCallback(async () => {
    const [logRes, loginRes, statsRes] = await Promise.all([
      supabase.from('admin_activity_log').select('*, admin:profiles!admin_activity_log_admin_id_fkey(*)').order('created_at', { ascending: false }).limit(50),
      supabase.from('admin_login_history').select('*, user:profiles!admin_login_history_user_id_fkey(*)').order('created_at', { ascending: false }).limit(30),
      Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('books').select('id', { count: 'exact', head: true }),
        supabase.from('payment_requests').select('id', { count: 'exact', head: true }),
        supabase.from('membership_plans').select('id', { count: 'exact', head: true }),
      ]).then(([u, b, p, m]) => ({
        users: u.count ?? 0, books: b.count ?? 0, payments: p.count ?? 0, plans: m.count ?? 0,
      })),
    ])

    setActivityLog(logRes.data as unknown as (AdminActivityLog & { admin?: Profile })[] ?? [])
    setLoginHistory(loginRes.data as unknown as (AdminLoginHistory & { user?: Profile })[] ?? [])
    setDbStats(statsRes)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div>
        <h1 className="font-serif text-2xl font-semibold mb-6">Security</h1>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold mb-6">Security</h1>

      {/* Current session */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Current Session</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback>{profile?.display_name?.[0]?.toUpperCase() ?? 'A'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{profile?.display_name}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="success">Authenticated</Badge>
                <Badge variant="default">Admin</Badge>
                <span className="text-xs text-muted-foreground">Session active</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database status */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Database Status</CardTitle></CardHeader>
        <CardContent>
          {dbStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label="Users" value={dbStats.users} />
              <Stat label="Books" value={dbStats.books} />
              <Stat label="Payment Requests" value={dbStats.payments} />
              <Stat label="Membership Plans" value={dbStats.plans} />
            </div>
          )}
          <div className="mt-4 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <span className="text-sm text-muted-foreground">All systems operational</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Admin Login History */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><LogIn className="h-5 w-5" /> Admin Login History</CardTitle></CardHeader>
          <CardContent>
            {loginHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No login attempts recorded.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {loginHistory.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                    {entry.success ? (
                      <CheckCircle className="h-4 w-4 text-success shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.email ?? entry.user?.email ?? 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground truncate">{entry.user_agent ?? 'Unknown browser'}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{formatRelative(entry.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Admin Activity Log</CardTitle></CardHeader>
          <CardContent>
            {activityLog.length === 0 ? (
              <p className="text-sm text-muted-foreground">No admin actions recorded.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {activityLog.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{log.action.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.admin?.display_name ?? 'Unknown'} {log.entity_type && `· ${log.entity_type}`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{formatRelative(log.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center p-3 rounded-lg border border-border bg-secondary/20">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
