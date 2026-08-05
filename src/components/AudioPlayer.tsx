import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Gauge,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatDuration } from '@/lib/utils'

interface AudioPlayerProps {
  url: string
  title?: string
  onProgress?: (seconds: number) => void
  className?: string
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2]

export function AudioPlayer({ url, title, onProgress, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [speedIndex, setSpeedIndex] = useState(1)
  const [showSpeed, setShowSpeed] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => {
      setCurrent(audio.currentTime)
      onProgress?.(audio.currentTime)
    }
    const onMeta = () => setDuration(audio.duration)
    const onEnd = () => setPlaying(false)

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnd)
    }
  }, [onProgress])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEEDS[speedIndex]
    }
  }, [speedIndex])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play()
      setPlaying(true)
    }
  }, [playing])

  const seek = (pct: number) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    audio.currentTime = (pct / 100) * duration
    setCurrent(audio.currentTime)
  }

  const skip = (seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds))
    setCurrent(audio.currentTime)
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !audio.muted
    setMuted(audio.muted)
  }

  const setVol = (v: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = v
    setVolume(v)
    setMuted(v === 0)
  }

  const cycleSpeed = () => {
    setSpeedIndex((prev) => (prev + 1) % SPEEDS.length)
  }

  const progress = duration ? (current / duration) * 100 : 0

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-4 shadow-sm',
        className,
      )}
    >
      <audio ref={audioRef} src={url} preload="metadata" />
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="secondary"
          className="h-10 w-10 rounded-full shrink-0"
          onClick={togglePlay}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </Button>
        <div className="flex-1 min-w-0">
          {title && (
            <p className="text-sm font-medium truncate mb-1">{title}</p>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
              {formatDuration(current)}
            </span>
            <div
              className="flex-1 h-1.5 rounded-full bg-secondary cursor-pointer group relative"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                seek(((e.clientX - rect.left) / rect.width) * 100)
              }}
            >
              <div
                className="absolute h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute h-3 w-3 rounded-full bg-primary -top-[3px] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums w-10">
              {formatDuration(duration)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => skip(-15)}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => skip(15)}>
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={toggleMute}>
            {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => setVol(Number(e.target.value))}
            className="w-16 h-1 accent-primary cursor-pointer"
          />
        </div>
        <div className="relative">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs gap-1"
            onClick={() => setShowSpeed(!showSpeed)}
          >
            <Gauge className="h-3.5 w-3.5" />
            {SPEEDS[speedIndex]}x
          </Button>
          {showSpeed && (
            <div className="absolute bottom-full right-0 mb-2 rounded-lg border border-border bg-popover p-1 shadow-lg z-10">
              {SPEEDS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => { setSpeedIndex(i); setShowSpeed(false) }}
                  className={cn(
                    'block w-full px-3 py-1.5 text-xs rounded text-left hover:bg-secondary',
                    i === speedIndex && 'text-primary font-medium',
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
