import { useState, useEffect, useRef } from 'react'
import { Plus, Edit2, Trash2, BookOpen, Upload, X, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { Book, Genre } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { RichBlurbEditor } from '@/components/RichBlurbEditor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export function AdminBooksPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Book | null>(null)
  const [showForm, setShowForm] = useState(false)

  const fetchBooks = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('books')
      .select('*, author:profiles!books_author_id_fkey(*)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) {
      toast('Failed to load books', 'error')
    } else if (data) {
      setBooks(data as unknown as Book[])
    }
    setLoading(false)
  }

  useEffect(() => { fetchBooks() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Move this book to the recycle bin? It can be restored later.')) return
    const { error } = await supabase.from('books').update({ deleted_at: new Date().toISOString(), deleted_by: user?.id }).eq('id', id)
    if (error) {
      toast('Failed to delete book', 'error')
    } else {
      toast('Book moved to recycle bin', 'success')
      await supabase.rpc('admin_log_action', { p_action: 'book_deleted', p_entity_type: 'book', p_entity_id: id })
      fetchBooks()
    }
  }

  const toggleStatus = async (book: Book) => {
    const newStatus = book.status === 'published' ? 'draft' : 'published'
    const { error } = await supabase.from('books').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', book.id)
    if (error) {
      toast('Failed to update status: ' + error.message, 'error')
    } else {
      toast(`Book ${newStatus === 'published' ? 'published' : 'unpublished'}`, 'success')
      fetchBooks()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-semibold">Books</h1>
        <Button onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus className="h-4 w-4" /> New Book
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : books.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No books yet"
          description="Create your first book to get started."
          action={<Button onClick={() => { setEditing(null); setShowForm(true) }}><Plus className="h-4 w-4" /> New Book</Button>}
        />
      ) : (
        <div className="space-y-3">
          {books.map((book) => (
            <Card key={book.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-16 rounded overflow-hidden bg-secondary/30 shrink-0">
                  {book.cover_url ? (
                    <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><BookOpen className="h-5 w-5 text-muted-foreground/40" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{book.title}</h3>
                    <Badge variant={book.status === 'published' ? 'success' : 'secondary'} className="capitalize">
                      {book.status}
                    </Badge>
                  </div>
                  <p
                    className="text-xs text-muted-foreground line-clamp-1"
                    dangerouslySetInnerHTML={{ __html: book.description || 'No description' }}
                  />
                  {book.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {book.tags.slice(0, 4).map((t) => (
                        <span key={t} className="text-[10px] text-muted-foreground/70">#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => toggleStatus(book)}>
                    {book.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(book); setShowForm(true) }}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(book.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <BookForm
          key={editing?.id ?? 'new'}
          book={editing}
          userId={user?.id ?? null}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchBooks() }}
        />
      )}
    </div>
  )
}

function BookForm({
  book,
  userId,
  onClose,
  onSaved,
}: {
  book: Book | null
  userId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [title, setTitle] = useState(book?.title ?? '')
  const [description, setDescription] = useState(book?.description ?? '')
  const [tags, setTags] = useState(book?.tags.join(', ') ?? '')
  const [coverUrl, setCoverUrl] = useState(book?.cover_url ?? '')
  const [status, setStatus] = useState<'draft' | 'published'>(book?.status ?? 'draft')
  const [genres, setGenres] = useState<Genre[]>([])
  const [genreId, setGenreId] = useState(book?.genre_id ?? '')

  useEffect(() => {
    if (book) {
    setGenreId(book.genre_id ?? '')
    }
  }, [book])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
  const fetchGenres = async () => {
    const { data, error } = await supabase
      .from('genres')
      .select('*')
      .is('deleted_at', null)
      .order('sort_order')

    if (!error && data) {
      setGenres(data as Genre[])
    }
  }

  fetchGenres()
}, [])

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset for re-upload

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast('Only JPG, PNG, and WebP images are accepted', 'error')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be under 5MB', 'error')
      return
    }

    if (!userId) {
      toast('You must be signed in to upload', 'error')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${userId}/${Date.now()}.${ext}`

    const { error, data } = await supabase.storage
      .from('covers')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      toast('Upload failed: ' + error.message, 'error')
      setUploading(false)
      setUploadProgress(0)
      return
    }

    // Simulate progress completion
    setUploadProgress(100)
    const { data: urlData } = supabase.storage.from('covers').getPublicUrl(path)
    setCoverUrl(urlData.publicUrl)
    toast('Cover uploaded successfully', 'success')
    setUploading(false)
    setTimeout(() => setUploadProgress(0), 1000)
  }

  const handleRemoveCover = () => {
    setCoverUrl('')
    toast('Cover removed. Save to confirm.', 'info')
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast('Title is required', 'error')
      return
    }
    setSaving(true)
    const payload = {
      title: title.trim(),
      description: description.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      cover_url: coverUrl || null,
      genre_id: genreId || null,
      status,
      author_id: userId,
      updated_at: new Date().toISOString(),
    }

    if (book) {
      const { error } = await supabase.from('books').update(payload).eq('id', book.id)
      if (error) {
        toast('Failed to update book: ' + error.message, 'error')
      } else {
        toast('Book updated', 'success')
        onSaved()
      }
    } else {
      const { error } = await supabase.from('books').insert(payload)
      if (error) {
        toast('Failed to create book: ' + error.message, 'error')
      } else {
        toast('Book created', 'success')
        onSaved()
      }
    }
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{book ? 'Edit Book' : 'New Book'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <RichBlurbEditor value={description} onChange={setDescription} />
          </div>

          <div className="space-y-2">
            <Label>Tags (comma-separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="romance, drama, ..." />
          </div>

          
          <div className="space-y-2">
            <Label>Genre</Label>

            <Select
              value={genreId}
              onValueChange={setGenreId}
             >

              <SelectTrigger>
               <SelectValue placeholder="Select a genre" />
             </SelectTrigger>

              <SelectContent>
                {genres.map((genre) => (
                   <SelectItem
                     key={genre.id}
                     value={genre.id}
                   >
                      {genre.name}
                     </SelectItem>
                ))}
              
              </SelectContent>
            </Select>
          </div>
               
        
          <div className="space-y-2">
            <Label>Cover Image</Label>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-16 h-20 rounded overflow-hidden bg-secondary/30 shrink-0 border border-border">
                  {coverUrl ? (
                    <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUploadClick}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="h-4 w-4" /> Upload Cover</>
                    )}
                  </Button>
                  {coverUrl && !uploading && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveCover}>
                      <X className="h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
              </div>
              {uploading && (
                <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
              {coverUrl && !uploading && (
                <p className="text-xs text-green-400">Cover uploaded and ready to save</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={status === 'draft' ? 'default' : 'outline'}
                onClick={() => setStatus('draft')}
              >Draft</Button>
              <Button
                size="sm"
                variant={status === 'published' ? 'default' : 'outline'}
                onClick={() => setStatus('published')}
              >Published</Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
