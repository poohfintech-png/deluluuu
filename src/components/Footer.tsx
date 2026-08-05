import { Sparkles, Heart } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="mt-20 bg-background/95 backdrop-blur-xl border-t border-border/30">
      <div className="container py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-secondary/25 border border-border/30 group-hover:from-primary/35 group-hover:to-secondary/35 transition-all duration-300">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <span className="font-serif text-lg font-semibold text-primary">Delulu</span>
          </Link>
          <p className="text-sm text-muted-foreground text-center">
            A premium storytelling platform for readers and writers.
          </p>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Made with <Heart className="h-3.5 w-3.5 text-primary" /> in India
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-border/30 flex flex-col sm:flex-row justify-between gap-4 text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Delulu. All rights reserved.</p>
          <p>For adults 18+ only. By using this site you confirm you are of legal age.</p>
        </div>
      </div>
    </footer>
  )
}