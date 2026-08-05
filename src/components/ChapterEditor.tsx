import { useState, useEffect, useRef, useCallback } from 'react'
import { Save, Lock, Unlock, Loader2, CheckCircle2, AlertCircle, Upload, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { Chapter, TipTapDoc } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ChapterTipTapEditor } from '@/components/editor/ChapterTipTapEditor'
import { cn } from '@/lib/utils'

interface ChapterEditorProps {
  chapter: Chapter | null
  bookId: string
  onSaved: () => void
  onCancel: () => void
}

const EMPTY_DOC: TipTapDoc = { type: 'doc', content: [{ type: 'paragraph' }] }

export function ChapterEditor({ chapter, bookId, onSaved, onCancel }: ChapterEditorProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState<TipTapDoc | null>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [isFree, setIsFree] = useState(false)
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!chapter)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const loadedRef = useRef(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>('')

  useEffect(() => {
    if (!chapter) {
      setContent(EMPTY_DOC)
      loadedRef.current = true
      return
    }

    setLoading(true)
    const loadChapter = async () => {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('id', chapter.id)
        .maybeSingle()

      if (error || !data) {
        toast('Failed to load chapter data', 'error')
        setLoading(false)
        return
      }

      const ch = data as unknown as Chapter
      setTitle(ch.title ?? '')

      // Parse content: could be TipTap JSON object, JSON string, or legacy HTML
      let doc: TipTapDoc | null = null
      if (ch.content && typeof ch.content === 'object' && (ch.content as TipTapDoc).type === 'doc') {
        doc = ch.content as TipTapDoc
      } else if (ch.content && typeof ch.content === 'string') {
        try {
          const parsed = JSON.parse(ch.content)
          if (parsed.type === 'doc') doc = parsed as TipTapDoc
        } catch {
          // Legacy HTML string - convert to a single paragraph
          doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: ch.content }] }] }
        }
      } else if (Array.isArray(ch.content)) {
        // Legacy block format - convert to TipTap JSON
        doc = legacyBlocksToTipTap(ch.content as any[])
      }

      setContent(doc ?? EMPTY_DOC)
      lastSavedRef.current = JSON.stringify(doc ?? EMPTY_DOC)
      setAudioUrl(ch.audio_url ?? '')
      setVideoUrl(ch.video_url ?? '')
      setBannerUrl(ch.banner_url ?? null)
      setIsFree(ch.is_free ?? false)
      setStatus(ch.status ?? 'draft')
      loadedRef.current = true
      setLoading(false)
    }
    loadChapter()
  }, [chapter?.id])

  const doAutosave = useCallback(async () => {
    if (!chapter || !loadedRef.current || !title.trim() || !content) return

    const contentStr = JSON.stringify(content)
    if (contentStr === lastSavedRef.current && title === chapter.title) return

    setAutosaveState('saving')
    const { error } = await supabase.from('chapters').update({
      title: title.trim(),
      content: content,
      audio_url: audioUrl || null,
      video_url: videoUrl || null,
      banner_url: bannerUrl,
      is_free: isFree,
      status,
      updated_at: new Date().toISOString(),
    }).eq('id', chapter.id)

    if (error) {
      setAutosaveState('error')
    } else {
      lastSavedRef.current = contentStr
      setAutosaveState('saved')
      setTimeout(() => setAutosaveState('idle'), 2000)
    }
  }, [chapter, title, content, audioUrl, videoUrl, isFree, status])

  useEffect(() => {
    if (!loadedRef.current || !chapter) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      doAutosave()
    }, 2000)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [title, content, audioUrl, videoUrl, isFree, status, chapter, doAutosave])

  const handleSave = async () => {
    if (!title.trim()) {
      toast('Title is required', 'error')
      return
    }
    setSaving(true)
    const payload = {
      book_id: bookId,
      title: title.trim(),
      content: content ?? EMPTY_DOC,
      audio_url: audioUrl || null,
      video_url: videoUrl || null,
      banner_url: bannerUrl,
      is_free: isFree,
      status,
      updated_at: new Date().toISOString(),
    }

    if (chapter) {
      const { error } = await supabase.from('chapters').update(payload).eq('id', chapter.id)
      if (error) {
        toast('Failed to save: ' + error.message, 'error')
      } else {
        toast('Chapter saved', 'success')
        onSaved()
      }
    } else {
      const { count } = await supabase
        .from('chapters')
        .select('*', { count: 'exact', head: true })
        .eq('book_id', bookId)
      const { error } = await supabase.from('chapters').insert({ ...payload, order_index: count ?? 0 })
      if (error) {
        toast('Failed to create: ' + error.message, 'error')
      } else {
        toast('Chapter created', 'success')
        onSaved()
      }
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid sm:grid-cols-3 gap-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Chapter Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chapter title" />
      </div>

      <div className="space-y-2">
        <Label>Chapter Banner Image (optional)</Label>
        <div className="flex items-center gap-3">
          {bannerUrl ? (
            <div className="relative group">
              <img src={bannerUrl} alt="Chapter banner" className="h-24 w-full max-w-md rounded-lg object-cover" />
              <button
                onClick={() => setBannerUrl(null)}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <ChapterBannerUpload bookId={bookId} chapterId={chapter?.id} onUploaded={setBannerUrl} />
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Chapter Audio URL (Bunny.net)</Label>
          <Input value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} placeholder="https://...bunny.net/..." />
        </div>
        <div className="space-y-2">
          <Label>Chapter Video URL (Bunny.net)</Label>
          <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://...bunny.net/..." />
        </div>
        <div className="space-y-2">
          <Label>Access</Label>
          <div className="flex gap-2">
            <Button size="sm" variant={isFree ? 'default' : 'outline'} onClick={() => setIsFree(true)}>
              <Unlock className="h-3.5 w-3.5" /> Free
            </Button>
            <Button size="sm" variant={!isFree ? 'default' : 'outline'} onClick={() => setIsFree(false)}>
              <Lock className="h-3.5 w-3.5" /> Premium
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Content</Label>
          {chapter && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {autosaveState === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>}
              {autosaveState === 'saved' && <><CheckCircle2 className="h-3 w-3 text-success" /> Saved</>}
              {autosaveState === 'error' && <><AlertCircle className="h-3 w-3 text-destructive" /> Save failed</>}
              {autosaveState === 'idle' && <span className="text-muted-foreground/50">Autosave on</span>}
            </div>
          )}
        </div>
        {content ? (
          <ChapterTipTapEditor content={content} onChange={(json) => setContent(json as TipTapDoc)} />
        ) : (
          <div className="rounded-lg border border-border bg-background p-4 min-h-[500px] flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Status:</Label>
          <Button size="sm" variant={status === 'draft' ? 'default' : 'outline'} onClick={() => setStatus('draft')}>Draft</Button>
          <Button size="sm" variant={status === 'published' ? 'default' : 'outline'} onClick={() => setStatus('published')}>Published</Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Chapter'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function legacyBlocksToTipTap(blocks: any[]): TipTapDoc {
  const content: any[] = blocks.map((block) => {
    switch (block.type) {
      case 'paragraph':
        return { type: 'paragraph', content: block.text ? [{ type: 'text', text: block.text }] : [] }
      case 'heading1':
        return { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: block.text ?? '' }] }
      case 'heading2':
        return { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: block.text ?? '' }] }
      case 'heading3':
        return { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: block.text ?? '' }] }
      case 'quote':
        return { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: block.text ?? '' }] }] }
      case 'divider':
        return { type: 'horizontalRule' }
      case 'image':
        return { type: 'imageBlock', attrs: { src: block.url, alt: '', caption: block.caption ?? '' } }
      case 'audio':
        return { type: 'audio', attrs: { url: block.url, title: block.title ?? '', duration: '' } }
      case 'video':
        return { type: 'video', attrs: { url: block.url, title: block.title ?? '' } }
      default:
        return { type: 'paragraph', content: [] }
    }
  })
  return { type: 'doc', content }
}

function ChapterBannerUpload({ bookId, chapterId, onUploaded }: {
  bookId: string
  chapterId: string | undefined
  onUploaded: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast('Please upload an image file', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return }
    setUploading(true)
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${bookId}/${chapterId ?? 'new'}-banner-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('content-media').upload(path, file, { cacheControl: '3600' })
    if (error) { toast('Failed to upload banner', 'error'); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('content-media').getPublicUrl(path)
    onUploaded(urlData.publicUrl)
    toast('Banner uploaded', 'success')
    setUploading(false)
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
      <button
        onClick={() => !uploading && inputRef.current?.click()}
        className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary/40 transition-colors"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? 'Uploading...' : 'Upload banner image'}
      </button>
    </>
  )
}
