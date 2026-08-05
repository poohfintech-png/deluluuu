import { useCallback, useRef, useState, useEffect } from 'react'
import type { TipTapDoc, TipTapNode } from '@/types'
import { Play, Pause, Volume2, VolumeX, Loader2, Music, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TipTapRendererProps {
  doc: TipTapDoc | string | null
  onAudioProgress?: (progress: number) => void
}

export function TipTapRenderer({ doc, onAudioProgress }: TipTapRendererProps) {
  if (!doc) {
    return <p className="text-muted-foreground italic">No content yet.</p>
  }

  if (typeof doc === 'string') {
    try {
      const parsed = JSON.parse(doc) as TipTapDoc
      if (parsed.type === 'doc') {
        return <RenderNodes nodes={parsed.content ?? []} onAudioProgress={onAudioProgress} />
      }
    } catch {
      return <div className="tiptap-content" dangerouslySetInnerHTML={{ __html: doc }} />
    }
  }

  if (typeof doc === 'object' && doc !== null && doc.type === 'doc') {
    return <RenderNodes nodes={doc.content ?? []} onAudioProgress={onAudioProgress} />
  }

  return <p className="text-muted-foreground italic">Unable to render content.</p>
}

function RenderNodes({ nodes, onAudioProgress }: { nodes: TipTapNode[]; onAudioProgress?: (p: number) => void }) {
  return (
    <div className="tiptap-content">
      {nodes.map((node, i) => (
        <RenderNode key={i} node={node} onAudioProgress={onAudioProgress} />
      ))}
    </div>
  )
}

function RenderNode({ node, onAudioProgress }: { node: TipTapNode; onAudioProgress?: (p: number) => void }) {
  switch (node.type) {
    case 'paragraph':
      return <p>{renderInline(node.content ?? [])}</p>

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      const text = renderInline(node.content ?? [])
      if (level === 1) return <h1>{text}</h1>
      if (level === 2) return <h2>{text}</h2>
      if (level === 3) return <h3>{text}</h3>
      return <h1>{text}</h1>
    }

    case 'bulletList':
      return <ul>{(node.content ?? []).map((item, i) => <li key={i}>{renderInline(item.content ?? [])}</li>)}</ul>

    case 'orderedList':
      return <ol>{(node.content ?? []).map((item, i) => <li key={i}>{renderInline(item.content ?? [])}</li>)}</ol>

    case 'taskList':
      return (
        <ul className="task-list">
          {(node.content ?? []).map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <input type="checkbox" checked={(item.attrs?.checked as boolean) ?? false} readOnly className="mt-1.5" />
              <span>{renderInline(item.content ?? [])}</span>
            </li>
          ))}
        </ul>
      )

    case 'blockquote':
      return <blockquote>{(node.content ?? []).map((p, i) => <p key={i}>{renderInline(p.content ?? [])}</p>)}</blockquote>

    case 'codeBlock':
      return <pre><code>{(node.content ?? []).map((c) => c.text ?? '').join('\n')}</code></pre>

    case 'horizontalRule':
      return <hr />

    case 'table':
      return <TableNode node={node} />

    case 'imageBlock':
      return (
        <figure className="my-6">
          <img
            src={node.attrs?.src as string}
            alt={(node.attrs?.alt as string) || (node.attrs?.caption as string) || ''}
            className="rounded-lg w-full"
            loading="lazy"
          />
          {node.attrs?.caption ? (
            <figcaption className="text-xs text-muted-foreground italic text-center mt-2">
              {node.attrs.caption as string}
            </figcaption>
          ) : null}
        </figure>
      )

    case 'audio':
      return <ReadOnlyAudioPlayer url={node.attrs?.url as string} title={node.attrs?.title as string} duration={node.attrs?.duration as string} onProgress={onAudioProgress} />

    case 'video':
      return <ReadOnlyVideoPlayer url={node.attrs?.url as string} title={node.attrs?.title as string} />

    default:
      if (node.content) {
        return <>{node.content.map((c, i) => <RenderNode key={i} node={c} onAudioProgress={onAudioProgress} />)}</>
      }
      return null
  }
}

function renderInline(nodes: TipTapNode[]): React.ReactNode {
  return nodes.map((node, i) => {
    if (node.type === 'text') {
      let text: React.ReactNode = node.text ?? ''
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === 'bold') text = <strong key={i}>{text}</strong>
          if (mark.type === 'italic') text = <em key={i}>{text}</em>
          if (mark.type === 'underline') text = <u key={i}>{text}</u>
          if (mark.type === 'strike') text = <s key={i}>{text}</s>
          if (mark.type === 'link') text = <a key={i} href={mark.attrs?.href as string} target="_blank" rel="noopener noreferrer" className="text-primary underline">{text}</a>
          if (mark.type === 'code') text = <code key={i}>{text}</code>
        }
      }
      return <span key={i}>{text}</span>
    }
    if (node.type === 'hardBreak') return <br key={i} />
    return null
  })
}

function TableNode({ node }: { node: TipTapNode }) {
  const rows = node.content ?? []
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {(row.content ?? []).map((cell, ci) => {
                const isHeader = cell.type === 'tableHeader'
                const Tag = isHeader ? 'th' : 'td'
                return (
                  <Tag key={ci} className="border border-border p-2">
                    {(cell.content ?? []).map((p, pi) => <p key={pi}>{renderInline(p.content ?? [])}</p>)}
                  </Tag>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const SPEEDS = [0.5, 1, 1.25, 1.5, 2]

function ReadOnlyAudioPlayer({ url, title, duration, onProgress }: { url: string; title: string; duration: string; onProgress?: (p: number) => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [dur, setDur] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      setCurrent(audio.currentTime)
      if (onProgress && audio.duration) {
        onProgress((audio.currentTime / audio.duration) * 100)
      }
    }
    const onDur = () => setDur(audio.duration)
    const onEnd = () => setPlaying(false)
    const onWaiting = () => setLoading(true)
    const onPlaying = () => { setLoading(false); setError(false) }
    const onError = () => { setLoading(false); setError(true); setPlaying(false) }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onDur)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onDur)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('error', onError)
    }
  }, [url, onProgress])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().catch(() => setError(true))
      setPlaying(true)
    }
  }, [playing])

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !dur) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audio.currentTime = pct * dur
    setCurrent(audio.currentTime)
  }, [dur])

  const changeVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    setMuted(v === 0)
    if (audioRef.current) audioRef.current.volume = v
  }, [])

  const toggleMute = useCallback(() => {
    const newMuted = !muted
    setMuted(newMuted)
    if (audioRef.current) audioRef.current.volume = newMuted ? 0 : volume
  }, [muted, volume])

  const changeSpeed = useCallback((s: number) => {
    setSpeed(s)
    if (audioRef.current) audioRef.current.playbackRate = s
    setShowSpeedMenu(false)
  }, [])

  if (!url) return null

  return (
    <div className="my-4 rounded-xl border border-border bg-card/90 overflow-hidden">
      <audio ref={audioRef} src={url} preload="metadata" style={{ display: 'none' }} />

      <div className="flex items-center gap-3 p-4 border-b border-border/50">
        <button
          type="button"
          onClick={toggle}
          disabled={error}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all',
            error ? 'bg-destructive/20 cursor-not-allowed' : 'bg-primary text-primary-foreground hover:scale-105',
          )}
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{title || 'Untitled audio'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {error ? 'Failed to load audio' : `${formatTime(current)} / ${formatTime(dur || parseFloat(duration) || 0)}`}
          </p>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className="rounded-md px-2 py-1 text-xs font-medium bg-secondary hover:bg-secondary/80 transition-colors"
          >
            {speed}x
          </button>
          {showSpeedMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover/95 backdrop-blur-xl p-1 shadow-lg">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeSpeed(s)}
                  className={cn('block w-full px-3 py-1.5 text-xs text-left rounded hover:bg-secondary transition-colors', s === speed && 'text-primary font-medium')}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div onClick={seek} className="group h-12 flex items-center px-4 cursor-pointer">
        <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden group-hover:h-2 transition-all">
          <div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${dur ? (current / dur) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 pb-3">
        <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground transition-colors">
          {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={changeVolume} className="w-20 h-1 accent-primary cursor-pointer" />
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatTime(current)} / {formatTime(dur || parseFloat(duration) || 0)}
        </span>
      </div>
    </div>
  )
}

function ReadOnlyVideoPlayer({ url, title }: { url: string; title: string }) {
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
    if (playing) { v.pause(); setPlaying(false) }
    else { v.play().catch(() => setError(true)); setPlaying(true) }
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
    videoRef.current?.requestFullscreen?.()
  }, [])

  if (!url) return null

  return (
    <div
      className="my-4 rounded-xl overflow-hidden border border-border bg-black group"
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
          <button type="button" onClick={toggle} className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/60 transition-colors">
              <Play className="h-7 w-7 text-white ml-1" />
            </div>
          </button>
        )}
        <div className={cn('absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 transition-opacity', showControls || !playing ? 'opacity-100' : 'opacity-0')}>
          <div onClick={seek} className="h-1.5 rounded-full bg-white/20 overflow-hidden cursor-pointer mb-2 hover:h-2 transition-all">
            <div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${dur ? (current / dur) * 100 : 0}%` }} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggle} className="text-white hover:text-primary transition-colors">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button onClick={toggleMute} className="text-white hover:text-primary transition-colors">
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={changeVolume} className="w-16 h-1 accent-primary cursor-pointer" />
            <span className="text-xs text-white/80 tabular-nums">{formatTime(current)} / {formatTime(dur)}</span>
            <div className="flex-1" />
            <button onClick={fullscreen} className="text-white hover:text-primary transition-colors">
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      {title && (
        <div className="p-3 bg-card/90 border-t border-border">
          <p className="text-sm text-foreground/80">{title}</p>
        </div>
      )}
    </div>
  )
}