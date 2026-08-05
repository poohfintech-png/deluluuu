import { useState, useRef, useEffect, useCallback } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Play, Pause, Volume2, VolumeX, Loader2, Music, X, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const SPEEDS = [0.5, 1, 1.25, 1.5, 2]

export function AudioBlockView({ node, updateAttributes, selected, deleteNode, editor }: NodeViewProps) {
  const url = node.attrs.url as string
  const title = node.attrs.title as string
  const duration = node.attrs.duration as string
  const isEditable = editor?.isEditable ?? false

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
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState(title)

  useEffect(() => {
    setTitleInput(title)
  }, [title])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrent(audio.currentTime)
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
  }, [url])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().catch(() => { setError(true) })
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

  const saveTitle = useCallback(() => {
    updateAttributes({ title: titleInput.trim() })
    setEditingTitle(false)
  }, [titleInput, updateAttributes])

  if (!url) {
    return (
      <NodeViewWrapper>
        <div className="my-4 flex items-center gap-3 rounded-lg border border-dashed border-border p-4">
          <Music className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Audio block (no URL set)</span>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper>
      <div
        className={cn(
          'my-4 rounded-xl border bg-card overflow-hidden transition-shadow',
          selected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
        )}
      >
        {/* Hidden audio element - no controls attribute = no download button */}
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          style={{ display: 'none' }}
        />

        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border/50">
          <button
            type="button"
            contentEditable={false}
            onClick={toggle}
            disabled={error}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all',
              error ? 'bg-destructive/20 cursor-not-allowed' : 'bg-primary text-primary-foreground hover:scale-105',
            )}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : playing ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            {editingTitle && isEditable ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                  onBlur={saveTitle}
                  contentEditable={false}
                  autoFocus
                  className="flex-1 bg-transparent border-b border-primary text-sm font-medium outline-none"
                  placeholder="Audio title..."
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{title || 'Untitled audio'}</p>
                {isEditable && (
                  <button
                    type="button"
                    contentEditable={false}
                    onClick={() => setEditingTitle(true)}
                    className="text-muted-foreground/50 hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {error ? 'Failed to load audio' : `${formatTime(current)} / ${formatTime(dur || parseFloat(duration) || 0)}`}
            </p>
          </div>

          {/* Speed selector */}
          <div className="relative shrink-0">
            <button
              type="button"
              contentEditable={false}
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="rounded-md px-2 py-1 text-xs font-medium bg-secondary hover:bg-secondary/80 transition-colors"
            >
              {speed}x
            </button>
            {showSpeedMenu && (
              <div
                contentEditable={false}
                className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover p-1 shadow-lg"
              >
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => changeSpeed(s)}
                    className={cn(
                      'block w-full px-3 py-1.5 text-xs text-left rounded hover:bg-secondary transition-colors',
                      s === speed && 'text-primary font-medium',
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {isEditable && (
            <button
              type="button"
              contentEditable={false}
              onClick={deleteNode}
              className="text-muted-foreground/50 hover:text-destructive transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div
          contentEditable={false}
          onClick={seek}
          className="group h-12 flex items-center px-4 cursor-pointer"
        >
          <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden group-hover:h-2 transition-all">
            <div
              className="h-full bg-primary transition-[width] duration-100"
              style={{ width: `${dur ? (current / dur) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Volume + time */}
        <div className="flex items-center gap-3 px-4 pb-3" contentEditable={false}>
          <button
            type="button"
            onClick={toggleMute}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={changeVolume}
            className="w-20 h-1 accent-primary cursor-pointer"
          />
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatTime(current)} / {formatTime(dur || parseFloat(duration) || 0)}
          </span>
        </div>
      </div>
    </NodeViewWrapper>
  )
}
