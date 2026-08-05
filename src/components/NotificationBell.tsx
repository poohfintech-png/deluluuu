import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, CheckCircle2, XCircle, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Notification } from '@/types'
import { formatRelative } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu'

export function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const markedReadRef = useRef(false)

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) {
      setNotifications(data as Notification[])
      setUnreadCount(data.filter((n: Notification) => !n.is_read).length)
    }
  }, [user])

  useEffect(() => {
    fetchNotifications()
    if (!user) return
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => fetchNotifications())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchNotifications, user])

  // Auto-mark as read when dropdown opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && unreadCount > 0 && !markedReadRef.current) {
      markedReadRef.current = true
      // Mark all unread as read after a short delay (so user sees them first)
      setTimeout(async () => {
        if (!user) return
        await supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('is_read', false)
        fetchNotifications()
      }, 1500)
    }
    if (!isOpen) {
      markedReadRef.current = false
    }
  }

  const iconFor = (type: string) => {
    if (type === 'success') return <CheckCircle2 className="h-4 w-4 text-green-400" />
    if (type === 'error') return <XCircle className="h-4 w-4 text-destructive" />
    return <Info className="h-4 w-4 text-primary" />
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-full p-2 hover:bg-secondary/60 transition-colors">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-in fade-in zoom-in duration-200">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <p className="text-sm font-medium">Notifications</p>
          {unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">No notifications</p>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-3 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}
                onClick={() => {
                  if (n.action_url || n.link) {
                    window.location.href = n.action_url || n.link || ''
                  }
                }}
                role={n.action_url || n.link ? 'button' : undefined}
              >
                <div className="mt-0.5 shrink-0">{iconFor(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{formatRelative(n.created_at)}</p>
                </div>
                {!n.is_read && <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
