import { useState, useRef, useCallback } from 'react'
import { Upload, Link2, Loader2, X, FileAudio, Film, Image as ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'

export type MediaKind = 'audio' | 'video' | 'image'

export interface MediaInsertResult {
  url: string
  title: string
  duration?: string
}

interface MediaInsertDialogProps {
  kind: MediaKind
  onClose: () => void
  onInsert: (result: MediaInsertResult) => void
}

const AUDIO_EXTS = ['mp3', 'wav', 'm4a', 'ogg']
const VIDEO_EXTS = ['mp4', 'webm', 'mov']
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif']

export function MediaInsertDialog({ kind, onClose, onInsert }: MediaInsertDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [mode, setMode] = useState<'upload' | 'url'>('upload')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const config = {
    audio: { exts: AUDIO_EXTS, accept: 'audio/*', label: 'Audio', icon: FileAudio, bucket: 'content-media' },
    video: { exts: VIDEO_EXTS, accept: 'video/*', label: 'Video', icon: Film, bucket: 'content-media' },
    image: { exts: IMAGE_EXTS, accept: 'image/*', label: 'Image', icon: ImageIcon, bucket: 'content-media' },
  }[kind]

  const handleFileSelect = useCallback(async (file: File) => {
    if (!user) {
      toast('You must be signed in to upload', 'error')
      return
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!config.exts.includes(ext)) {
      toast(`Only ${config.exts.join(', ')} files are supported`, 'error')
      return
    }

    const maxMB = kind === 'image' ? 5 : 100
    if (file.size > maxMB * 1024 * 1024) {
      toast(`File must be under ${maxMB}MB`, 'error')
      return
    }

    setUploading(true)
    setProgress(0)

    const path = `${user.id}/${Date.now()}.${ext}`

    // Simulate progress for UX
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 10, 90))
    }, 300)

    const { error } = await supabase.storage.from(config.bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

    clearInterval(progressInterval)

    if (error) {
      toast('Upload failed: ' + error.message, 'error')
      setUploading(false)
      setProgress(0)
      return
    }

    setProgress(100)
    const { data: urlData } = supabase.storage.from(config.bucket).getPublicUrl(path)
    toast(`${config.label} uploaded successfully`, 'success')
    setUploading(false)

    onInsert({ url: urlData.publicUrl, title: title.trim() || file.name.replace(/\.[^.]+$/, '') })
  }, [user, config, title, kind, toast, onInsert])

  const handleUrlSubmit = useCallback(() => {
    if (!url.trim()) {
      toast('Please enter a URL', 'error')
      return
    }
    try {
      new URL(url.trim())
    } catch {
      toast('Please enter a valid URL', 'error')
      return
    }
    onInsert({ url: url.trim(), title: title.trim() })
  }, [url, title, toast, onInsert])

  const Icon = config.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-serif text-lg font-semibold">Insert {config.label}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 rounded-lg bg-secondary/40 p-1 mb-5">
          <button
            onClick={() => setMode('upload')}
            className={cn(
              'flex items-center gap-1.5 flex-1 rounded-md py-2 text-sm font-medium transition-colors',
              mode === 'upload' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Upload className="h-4 w-4" /> Upload
          </button>
          <button
            onClick={() => setMode('url')}
            className={cn(
              'flex items-center gap-1.5 flex-1 rounded-md py-2 text-sm font-medium transition-colors',
              mode === 'url' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Link2 className="h-4 w-4" /> Paste URL
          </button>
        </div>

        {/* Title input (shared) */}
        <div className="mb-4">
          <label className="text-sm font-medium mb-1 block">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`${config.label} title...`}
            className="flex h-10 w-full rounded-md border border-input bg-secondary/40 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring outline-none"
          />
        </div>

        {/* Upload mode */}
        {mode === 'upload' && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={config.accept}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileSelect(f)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border p-8 hover:border-primary/40 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <div className="text-sm text-muted-foreground">Uploading... {progress}%</div>
                  <div className="w-full max-w-xs h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-sm font-medium">Click to upload {config.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {config.exts.join(', ').toUpperCase()} · Max {kind === 'image' ? '5' : '100'}MB
                  </div>
                </>
              )}
            </button>
          </div>
        )}

        {/* URL mode */}
        {mode === 'url' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                {kind === 'audio' ? 'Bunny.net CDN URL' : kind === 'video' ? 'Bunny.net CDN URL' : 'Image URL'}
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  kind === 'image'
                    ? 'https://...'
                    : 'https://...bunny.net/...'
                }
                className="flex h-10 w-full rounded-md border border-input bg-secondary/40 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring outline-none"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit() }}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                {kind === 'image'
                  ? 'Paste any image URL'
                  : 'Paste your Bunny.net CDN URL for this file'}
              </p>
            </div>
            <button
              onClick={handleUrlSubmit}
              disabled={!url.trim()}
              className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Insert {config.label}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
