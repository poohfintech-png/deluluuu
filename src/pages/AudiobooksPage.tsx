import { Link } from 'react-router-dom'
import { Headphones, Clock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AudiobooksPage() {
  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-transparent" />
        <div className="container relative py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-6">
            <Headphones className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Coming Soon</span>
          </div>
          <h1 className="font-serif text-3xl md:text-5xl font-semibold mb-4 max-w-2xl mx-auto text-balance">
            Audiobooks are on the way
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            We're building a premium audiobook experience with narrated stories, adjustable playback,
            bookmarks, sleep timers, and more.
          </p>
          <Button asChild variant="outline">
            <Link to="/"><Sparkles className="h-4 w-4" /> Explore Books in the Meantime</Link>
          </Button>
        </div>
      </section>

      <section className="container py-16">
        <h2 className="font-serif text-2xl font-semibold text-center mb-10">What to Expect</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { icon: Headphones, title: 'Audiobook Library', desc: 'Browse and listen to a growing collection of narrated stories.' },
            { icon: Clock, title: 'Listening Progress', desc: 'Pick up exactly where you left off across all your devices.' },
            { icon: Sparkles, title: 'Premium Features', desc: 'Adjustable playback speed, sleep timers, bookmarks, and collections.' },
          ].map((f) => {
            const Icon = f.icon
            return (
              <div key={f.title} className="rounded-xl border border-border bg-card p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 mx-auto mb-4">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-serif text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
