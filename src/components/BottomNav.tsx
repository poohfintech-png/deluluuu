import { Link, useLocation } from 'react-router-dom'
import { BookOpen, PlayCircle, LayoutDashboard, User as UserIcon, Sparkles, Headphones, Feather } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const location = useLocation()
  const { user, isWriter } = useAuth()
  const { isDisabled: isFeatureDisabled } = useFeatureFlags()
  const isActive = (path: string) => location.pathname === path
  const showReels = !isFeatureDisabled('reels')
  const showAudiobooks = !isFeatureDisabled('audiobooks')
  const colClass =
    showReels && showAudiobooks
      ? 'grid-cols-6'
      : showReels || showAudiobooks
        ? 'grid-cols-5'
        : 'grid-cols-4'

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-xl border-t border-border/30">
      <div className={cn('grid h-16', colClass)}>
        <BottomLink to="/" active={isActive('/')} icon={BookOpen} label="Discover" />
        {showReels && <BottomLink to="/reels" active={isActive('/reels')} icon={PlayCircle} label="Reels" />}
        {showAudiobooks && <BottomLink to="/audiobooks" active={isActive('/audiobooks')} icon={Headphones} label="Audio" />}
        {user ? (
          <BottomLink to="/dashboard" active={isActive('/dashboard')} icon={LayoutDashboard} label="Library" />
        ) : (
          <BottomLink to="/writer" active={isActive('/writer')} icon={Sparkles} label="Writers" />
        )}
        {user && isWriter && (
          <BottomLink to="/writer-dashboard" active={isActive('/writer-dashboard')} icon={Feather} label="Write" />
        )}
        {user ? (
          <BottomLink to="/profile" active={isActive('/profile')} icon={UserIcon} label="Profile" />
        ) : (
          <BottomLink to="/auth" active={isActive('/auth')} icon={UserIcon} label="Sign In" />
        )}
      </div>
    </nav>
  )
}

function BottomLink({
  to,
  active,
  icon: Icon,
  label,
}: {
  to: string
  active: boolean
  icon: typeof BookOpen
  label: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-all duration-300 relative',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {active && (
        <span className="absolute top-0 h-1 w-8 rounded-full bg-primary animate-scale-in" />
      )}
      <Icon className={cn('h-5 w-5 transition-transform duration-300', active && 'scale-110')} />
      {label}
    </Link>
  )
}