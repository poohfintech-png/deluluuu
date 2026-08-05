import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Tag, X, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { Genre } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function AdminGenresPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [genres, setGenres] = useState<Genre[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Genre | null>(null)
  const [showForm, setShowForm] = useState(false)

  const fetchGenres = async () => {
    setLoading(true)
    const { data } = await supabase.from('genres').select('*').is('deleted_at', null).order('sort_order', { ascending: true })
    setGenres((data as Genre[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchGenres() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Move this genre to the recycle bin? It can be restored later.')) return
    const { error } = await supabase.from('genres').update({ deleted_at: new Date().toISOString(), deleted_by: user?.id }).eq('id', id)
    if (error) toast('Failed: ' + error.message, 'error')
    else { toast('Genre archived', 'success'); fetchGenres() }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-semibold">Genres</h1>
        <Button onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus className="h-4 w-4" /> New Genre
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : genres.length === 0 ? (
        <EmptyState icon={Tag} title="No genres yet" description="Create genres to categorize books and reels." action={<Button onClick={() => { setEditing(null); setShowForm(true) }}><Plus className="h-4 w-4" /> New Genre</Button>} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {genres.map((genre) => (
            <Card key={genre.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                  {genre.icon ? <span className="text-lg">{genre.icon}</span> : <Tag className="h-5 w-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{genre.name}</h3>
                  {genre.slug && <p className="text-[10px] text-muted-foreground truncate">/{genre.slug}</p>}
                </div>
                <button onClick={() => { setEditing(genre); setShowForm(true) }} className="text-muted-foreground hover:text-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDelete(genre.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-3.5 w-3.5" /></button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <GenreForm
          key={editing?.id ?? 'new'}
          genre={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchGenres() }}
        />
      )}
    </div>
  )
}

function GenreForm({ genre, onClose, onSaved }: { genre: Genre | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast()
  const [name, setName] = useState(genre?.name ?? '')
  const [slug, setSlug] = useState(genre?.slug ?? '')
  const [description, setDescription] = useState(genre?.description ?? '')
  const [icon, setIcon] = useState(genre?.icon ?? '')
  const [sortOrder, setSortOrder] = useState(genre?.sort_order ?? 0)
  const [saving, setSaving] = useState(false)

  const handleNameChange = (v: string) => {
    setName(v)
    if (!genre) setSlug(slugify(v))
  }

  const handleSave = async () => {
    if (!name.trim()) { toast('Name is required', 'error'); return }
    setSaving(true)
    const payload = {
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      description: description.trim() || null,
      icon: icon.trim() || null,
      sort_order: sortOrder,
    }
    if (genre) {
      const { error } = await supabase.from('genres').update(payload).eq('id', genre.id)
      if (error) toast('Failed: ' + error.message, 'error')
      else { toast('Genre updated', 'success'); onSaved() }
    } else {
      const { error } = await supabase.from('genres').insert(payload)
      if (error) toast('Failed: ' + error.message, 'error')
      else { toast('Genre created', 'success'); onSaved() }
    }
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{genre ? 'Edit Genre' : 'New Genre'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Romance" />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated" />
          </div>
          <div className="space-y-2">
            <Label>Icon (emoji)</Label>
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="e.g. ❤️" className="w-20" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Genre description" />
          </div>
          <div className="space-y-2">
            <Label>Sort Order</Label>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} min={0} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
