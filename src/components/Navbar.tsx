import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { BookOpen, LayoutDashboard, LogOut, Menu, X, User as UserIcon, Shield, Sparkles, PlayCircle, Feather, Headphones } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { NotificationBell } from '@/components/NotificationBell'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export function Navbar() {
  const { user, profile, isAdmin, isWriter, signOut } = useAuth()
  const { isDisabled: isFeatureDisabled } = useFeatureFlags()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-xl border-b border-border/30">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-secondary/25 border border-border/30 group-hover:from-primary/35 group-hover:to-secondary/35 transition-all duration-300">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <span className="font-serif text-xl font-semibold tracking-tight text-primary">Delulu</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/" active={isActive('/')}>Discover</NavLink>
          {!isFeatureDisabled('reels') && <NavLink to="/reels" active={isActive('/reels')}>Reels</NavLink>}
          {!isFeatureDisabled('audiobooks') && <NavLink to="/audiobooks" active={isActive('/audiobooks')}>Audiobooks</NavLink>}
          {user && <NavLink to="/dashboard" active={isActive('/dashboard')}>My Library</NavLink>}
          {isWriter && <NavLink to="/writer-dashboard" active={isActive('/writer-dashboard')}>Writer Dashboard</NavLink>}
          {user && !isAdmin && !isWriter && <NavLink to="/subscribe" active={isActive('/subscribe')}>Subscribe</NavLink>}
          {!isWriter && <NavLink to="/writer" active={isActive('/writer')}>Writers</NavLink>}
        </nav>

        <div className="flex items-center gap-2">
          {user && <NotificationBell />}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 bg-secondary/30 hover:bg-secondary/50 border border-border/30 transition-all duration-300">
                  <Avatar className="h-8 w-8 ring-2 ring-primary/10">
                    <AvatarImage src={profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs bg-primary/15">
                      {profile?.display_name?.[0]?.toUpperCase() ?? 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium max-w-[100px] truncate">
                    {profile?.display_name}
                  </span>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56 bg-card/95 backdrop-blur-xl border border-border/30 shadow-lg">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{profile?.display_name}</span>
                    <span className="text-xs text-muted-foreground">{profile?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <UserIcon className="mr-2 h-4 w-4" /> Profile & Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                  <LayoutDashboard className="mr-2 h-4 w-4" /> My Library
                </DropdownMenuItem>
                {isWriter && (
                  <DropdownMenuItem onClick={() => navigate('/writer-dashboard')}>
                    <Feather className="mr-2 h-4 w-4" /> Writer Dashboard
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/control-panel')}>
                    <Shield className="mr-2 h-4 w-4" /> Control Panel
                  </DropdownMenuItem>
                )}
                {!isAdmin && !isWriter && (
                  <DropdownMenuItem onClick={() => navigate('/subscribe')}>
                    <Sparkles className="mr-2 h-4 w-4" /> Subscribe
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>Sign In</Button>
              <Button size="sm" className="glow-rose" onClick={() => navigate('/auth?mode=signup')}>Get Started</Button>
            </div>
          )}

          <button
            className="md:hidden p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 border border-border/30 transition-all duration-300"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border/30 bg-background/95 backdrop-blur-xl animate-fade-in">
          <nav className="container py-4 flex flex-col gap-1">
            <MobileLink to="/" onClick={() => setMobileOpen(false)} active={isActive('/')}>
              <BookOpen className="h-4 w-4" /> Discover
            </MobileLink>
            {!isFeatureDisabled('reels') && (
              <MobileLink to="/reels" onClick={() => setMobileOpen(false)} active={isActive('/reels')}>
                <PlayCircle className="h-4 w-4" /> Reels
              </MobileLink>
            )}
            {!isFeatureDisabled('audiobooks') && (
              <MobileLink to="/audiobooks" onClick={() => setMobileOpen(false)} active={isActive('/audiobooks')}>
                <Headphones className="h-4 w-4" /> Audiobooks
              </MobileLink>
            )}
            {user && (
              <MobileLink to="/dashboard" onClick={() => setMobileOpen(false)} active={isActive('/dashboard')}>
                <LayoutDashboard className="h-4 w-4" /> My Library
              </MobileLink>
            )}
            {user && (
              <MobileLink to="/profile" onClick={() => setMobileOpen(false)} active={isActive('/profile')}>
                <UserIcon className="h-4 w-4" /> Profile
              </MobileLink>
            )}
            {isWriter && (
              <MobileLink to="/writer-dashboard" onClick={() => setMobileOpen(false)} active={isActive('/writer-dashboard')}>
                <Feather className="h-4 w-4" /> Writer Dashboard
              </MobileLink>
            )}
            {!isWriter && (
              <MobileLink to="/writer" onClick={() => setMobileOpen(false)} active={isActive('/writer')}>
                <Sparkles className="h-4 w-4" /> Join as Writer
              </MobileLink>
            )}
            {user && !isAdmin && !isWriter && (
              <MobileLink to="/subscribe" onClick={() => setMobileOpen(false)} active={isActive('/subscribe')}>
                <Sparkles className="h-4 w-4" /> Subscribe
              </MobileLink>
            )}
            {isAdmin && (
              <MobileLink to="/control-panel" onClick={() => setMobileOpen(false)} active={isActive('/control-panel')}>
                <Shield className="h-4 w-4" /> Control Panel
              </MobileLink>
            )}
            {!user && (
              <div className="flex gap-2 mt-2">
                <Button variant="outline" className="flex-1" onClick={() => { setMobileOpen(false); navigate('/auth') }}>Sign In</Button>
                <Button className="flex-1 glow-rose" onClick={() => { setMobileOpen(false); navigate('/auth?mode=signup') }}>Get Started</Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        'px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-300',
        active ? 'text-primary bg-primary/15' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40',
      )}
    >
      {children}
    </Link>
  )
}

function MobileLink({
  to,
  active,
  onClick,
  children,
}: {
  to: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-300',
        active ? 'text-primary bg-primary/15' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30',
      )}
    >
      {children}
    </Link>
  )
}