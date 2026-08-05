import { useState, useEffect, useCallback } from 'react'
import { Users as UsersIcon, Shield, User as UserIcon, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Profile } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { formatDate } from '@/lib/utils'

export function AdminUsersPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) {
      toast('Failed to load users', 'error')
    } else if (data) {
      setUsers(data as Profile[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()

    const channel = supabase
      .channel('admin-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchUsers])

  const toggleRole = async (user: Profile) => {
    const newRole = user.role === 'admin' ? 'reader' : 'admin'
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)
    if (error) {
      toast('Failed to update role: ' + error.message, 'error')
    } else {
      toast(`${user.display_name} is now ${newRole}`, 'success')
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u))
    }
  }

  const filtered = users.filter((u) =>
    u.display_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold mb-6">Users</h1>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users found" />
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatar_url ?? undefined} />
                  <AvatarFallback>{user.display_name[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{user.display_name}</p>
                    {user.role === 'admin' ? (
                      <Badge variant="default"><Shield className="h-3 w-3" /> Admin</Badge>
                    ) : (
                      <Badge variant="secondary"><UserIcon className="h-3 w-3" /> Reader</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  <p className="text-xs text-muted-foreground">Joined {formatDate(user.created_at)}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => toggleRole(user)}>
                  {user.role === 'admin' ? 'Make Reader' : 'Make Admin'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
