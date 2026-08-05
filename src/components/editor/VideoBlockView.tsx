import { useState, useRef, useCallback } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Play, Pause, Loader2, Volume2, VolumeX, X, Maximize2, Film } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VideoBlockView({ node, updateAttributes, selected, deleteNode, editor }: NodeViewProps) {
  const url = node.attrs.url as string
  const title = node.attrs.title as string
  const isEditable = editor?.isEditable ?? false

  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [dur, setDur] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [showControls, setShowControls] = useState(true)

  const toggle = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (playing) {
      v.pause()
      setPlaying(false)
    } else {
      v.play().catch(() => setError(true))
      setPlaying(true)
    }
  }, [playing])

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current
    if (!v || !dur) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    v.currentTime = pct * dur
    setCurrent(v.currentTime)
  }, [dur])

  const changeVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    setVolume(vol)
    setMuted(vol === 0)
    if (videoRef.current) videoRef.current.volume = vol
  }, [])

  const toggleMute = useCallback(() => {
    const newMuted = !muted
    setMuted(newMuted)
    if (videoRef.current) videoRef.current.volume = newMuted ? 0 : volume
  }, [muted, volume])

  const fullscreen = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.requestFullscreen) v.requestFullscreen()
  }, [])

  if (!url) {
    return (
      <NodeViewWrapper>
        <div className="my-4 flex items-center gap-3 rounded-lg border border-dashed border-border/40 bg-card/90 p-4">
          <Film className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Video block (no URL set)</span>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper>
      <div
        className={cn(
          'my-4 rounded-xl overflow-hidden border bg-black transition-shadow group',
          selected ? 'border-primary ring-2 ring-primary/20' : 'border-border/30',
        )}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        <div className="relative">
          <video
            ref={videoRef}
            src={url}
            preload="metadata"
            className="w-full aspect-video"
            onClick={toggle}
            onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
            onWaiting={() => setLoading(true)}
            onPlaying={() => { setLoading(false); setError(false) }}
            onEnded={() => setPlaying(false)}
            onError={() => { setLoading(false); setError(true) }}
          />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <p className="text-sm text-white/80">Failed to load video</p>
            </div>
          )}

          {!playing && !loading && !error && (
            <button
              type="button"
              contentEditable={false}
              onClick={toggle}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/60 transition-colors">
                <Play className="h-7 w-7 text-white ml-1" />
              </div>
            </button>
          )}

          <div
            contentEditable={false}
            className={cn(
              'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 transition-opacity',
              showControls || !playing ? 'opacity-100' : 'opacity-0',
            )}
          >
            <div onClick={seek} className="h-1.5 rounded-full bg-white/20 overflow-hidden cursor-pointer mb-2 hover:h-2 transition-all">
              <div
                className="h-full bg-primary transition-[width] duration-100"
                style={{ width: `${dur ? (current / dur) * 100 : 0}%` }}
              />
            </div>

            <div className="flex items-center gap-3">
              <button onClick={toggle} className="text-white hover:text-primary transition-colors">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button onClick={toggleMute} className="text-white hover:text-primary transition-colors">
                {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={changeVolume}
                className="w-16 h-1 accent-primary cursor-pointer"
              />
              <span className="text-xs text-white/80 tabular-nums">
                {formatTime(current)} / {formatTime(dur)}
              </span>
              <div className="flex-1" />
              <button onClick={fullscreen} className="text-white hover:text-primary transition-colors">
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {(title || isEditable) && (
          <div className="flex items-center gap-2 p-3 bg-card/90 border-t border-border/30">
            <p className="text-sm text-foreground/80 flex-1 truncate">{title || 'Untitled video'}</p>
            {isEditable && (
              <button
                type="button"
                contentEditable={false}
                onClick={deleteNode}
                className="text-muted-foreground/50 hover:text-destructive transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}