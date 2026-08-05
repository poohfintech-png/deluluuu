import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Users,
  CreditCard,
  MessageSquare,
  Sparkles,
  LogOut,
  Menu,
  X,
  Home,
  Film,
  Feather,
  Tag,
  LayoutGrid,
  Settings2,
  Shield,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/control-panel', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/control-panel/books', label: 'Books', icon: BookOpen },
  { to: '/control-panel/chapters', label: 'Chapters', icon: FileText },
  { to: '/control-panel/reels', label: 'Reels', icon: Film },
  { to: '/control-panel/genres', label: 'Genres', icon: Tag },
  { to: '/control-panel/writers', label: 'Writer Applications', icon: Feather },
  { to: '/control-panel/users', label: 'Users', icon: Users },
  { to: '/control-panel/plans', label: 'Membership Plans', icon: CreditCard },
  { to: '/control-panel/payments', label: 'Payments', icon: CreditCard },
  { to: '/control-panel/payment-settings', label: 'Payment Settings', icon: Settings2 },
  { to: '/control-panel/comments', label: 'Comments', icon: MessageSquare },
  { to: '/control-panel/homepage', label: 'Homepage', icon: LayoutGrid },
  { to: '/control-panel/recycle-bin', label: 'Recycle Bin', icon: Trash2 },
  { to: '/control-panel/feature-flags', label: 'Platform Controls', icon: Settings2 },
  { to: '/control-panel/security', label: 'Security', icon: Shield },
]

export function AdminLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isActive = (to: string, exact?: boolean) =>
    exact ? location.pathname === to : location.pathname.startsWith(to)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:sticky top-0 left-0 h-screen w-64 border-r border-border bg-card z-50 transition-transform',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center gap-2 px-6 border-b border-border">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-serif text-lg font-semibold">Delulu</span>
          <Badge className="ml-auto">Admin</Badge>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive(item.to, item.exact)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <Home className="h-4 w-4" /> View Site
          </Link>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="md:hidden flex h-16 items-center gap-3 px-4 border-b border-border">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="font-serif text-lg font-semibold">Admin Panel</span>
        </header>
        <main className="p-4 md:p-8 max-w-6xl">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
