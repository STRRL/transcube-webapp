import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Maximize2, Minimize2 } from 'lucide-react'

interface VideoPlayerProps {
  src: string
  poster?: string
  subtitles?: Array<{
    src: string
    label: string
    language: string
    default?: boolean
  }>
}

export interface VideoPlayerHandle {
  seekTo: (timeInSeconds: number) => void
  enterFullscreen: () => void
  exitFullscreen: () => void
  toggleFullscreen: () => void
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(({ src, poster, subtitles = [] }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  useImperativeHandle(ref, () => ({
    seekTo: (timeInSeconds: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = timeInSeconds
        if (videoRef.current.paused) {
          videoRef.current.play()
        }
      }
    },
    enterFullscreen: () => {
      // Try container fullscreen (standard approach)
      if (containerRef.current) {
        const container = containerRef.current as any
        if (container.requestFullscreen) {
          container.requestFullscreen().catch(() => {})
          setIsFullscreen(true)
        } else if (container.webkitRequestFullscreen) {
          container.webkitRequestFullscreen()
          setIsFullscreen(true)
        } else if (container.mozRequestFullScreen) {
          container.mozRequestFullScreen()
          setIsFullscreen(true)
        } else if (container.msRequestFullscreen) {
          container.msRequestFullscreen()
          setIsFullscreen(true)
        }
      }
    },
    exitFullscreen: () => {
      // Try standard document exit fullscreen
      if (document.fullscreenElement) {
        const doc = document as any
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {})
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen()
        } else if (doc.mozCancelFullScreen) {
          doc.mozCancelFullScreen()
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen()
        }
        setIsFullscreen(false)
      }
    },
    toggleFullscreen: () => {
      if (document.fullscreenElement) {
        // Exit fullscreen
        const doc = document as any
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {})
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen()
        } else if (doc.mozCancelFullScreen) {
          doc.mozCancelFullScreen()
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen()
        }
        setIsFullscreen(false)
      } else {
        // Enter fullscreen
        if (containerRef.current) {
          const container = containerRef.current as any
          if (container.requestFullscreen) {
            container.requestFullscreen().catch(() => {})
            setIsFullscreen(true)
          } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen()
            setIsFullscreen(true)
          } else if (container.mozRequestFullScreen) {
            container.mozRequestFullScreen()
            setIsFullscreen(true)
          } else if (container.msRequestFullscreen) {
            container.msRequestFullscreen()
            setIsFullscreen(true)
          }
        }
      }
    },
  }))

  useEffect(() => {
    // Auto-enable the first subtitle track when video loads
    if (videoRef.current && subtitles.length > 0) {
      const video = videoRef.current
      
      // Wait for tracks to be loaded
      const enableDefaultTrack = () => {
        const tracks = video.textTracks
        if (tracks && tracks.length > 0) {
          // Find and enable the default track
          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i]
            if (track.kind === 'subtitles') {
              // Enable the first subtitle track
              track.mode = i === 0 ? 'showing' : 'hidden'
            }
          }
        }
      }
      
      // Try to enable immediately and also when metadata loads
      enableDefaultTrack()
      video.addEventListener('loadedmetadata', enableDefaultTrack)
      
      return () => {
        video.removeEventListener('loadedmetadata', enableDefaultTrack)
      }
    }
  }, [subtitles])

  useEffect(() => {
    const video = videoRef.current as any
    const onStdFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onStdFs)
    // Safari/WebKit media fullscreen events
    const onWebkitBegin = () => setIsFullscreen(true)
    const onWebkitEnd = () => setIsFullscreen(false)
    video?.addEventListener?.('webkitbeginfullscreen', onWebkitBegin)
    video?.addEventListener?.('webkitendfullscreen', onWebkitEnd)
    return () => {
      document.removeEventListener('fullscreenchange', onStdFs)
      video?.removeEventListener?.('webkitbeginfullscreen', onWebkitBegin)
      video?.removeEventListener?.('webkitendfullscreen', onWebkitEnd)
    }
  }, [])

  return (
    <div className="relative w-full h-full bg-black" ref={containerRef}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        poster={poster}
        crossOrigin="anonymous"
        playsInline
        onDoubleClick={() => {
          if (document.fullscreenElement) {
            // Exit fullscreen
            const doc = document as any
            if (doc.exitFullscreen) {
              doc.exitFullscreen().catch(() => {})
            } else if (doc.webkitExitFullscreen) {
              doc.webkitExitFullscreen()
            } else if (doc.mozCancelFullScreen) {
              doc.mozCancelFullScreen()
            } else if (doc.msExitFullscreen) {
              doc.msExitFullscreen()
            }
            setIsFullscreen(false)
          } else {
            // Enter fullscreen
            if (containerRef.current) {
              const container = containerRef.current as any
              if (container.requestFullscreen) {
                container.requestFullscreen().catch(() => {})
                setIsFullscreen(true)
              } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen()
                setIsFullscreen(true)
              } else if (container.mozRequestFullScreen) {
                container.mozRequestFullScreen()
                setIsFullscreen(true)
              } else if (container.msRequestFullscreen) {
                container.msRequestFullscreen()
                setIsFullscreen(true)
              }
            }
          }
        }}
      >
        <source src={src} type={src.endsWith('.webm') ? 'video/webm' : 'video/mp4'} />
        {subtitles.map((sub, index) => (
          <track
            key={index}
            src={sub.src}
            kind="subtitles"
            label={sub.label}
            srcLang={sub.language}
            default={sub.default}
          />
        ))}
      </video>
      <div className="absolute bottom-3 right-3">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="rounded-full opacity-80 hover:opacity-100"
          onClick={() => {
            if (document.fullscreenElement) {
              // Exit fullscreen
              const doc = document as any
              if (doc.exitFullscreen) {
                doc.exitFullscreen().catch(() => {})
              } else if (doc.webkitExitFullscreen) {
                doc.webkitExitFullscreen()
              } else if (doc.mozCancelFullScreen) {
                doc.mozCancelFullScreen()
              } else if (doc.msExitFullscreen) {
                doc.msExitFullscreen()
              }
              setIsFullscreen(false)
            } else {
              // Enter fullscreen
              if (containerRef.current) {
                const container = containerRef.current as any
                if (container.requestFullscreen) {
                  container.requestFullscreen().catch(() => {})
                  setIsFullscreen(true)
                } else if (container.webkitRequestFullscreen) {
                  container.webkitRequestFullscreen()
                  setIsFullscreen(true)
                } else if (container.mozRequestFullScreen) {
                  container.mozRequestFullScreen()
                  setIsFullscreen(true)
                } else if (container.msRequestFullscreen) {
                  container.msRequestFullscreen()
                  setIsFullscreen(true)
                }
              }
            }
          }}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  )
})

VideoPlayer.displayName = 'VideoPlayer'

export default VideoPlayer