import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { WindowFullscreen, WindowUnfullscreen } from '../../wailsjs/runtime/runtime'
import KeyboardShortcutsModal from './KeyboardShortcutsModal'

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
  // Track only overlay state for window-level fallback
  const [windowFsOverlay, setWindowFsOverlay] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Minimal two-step approach: standard on video, then WebKit fallback
  const enterFullscreen = () => {
    const v = videoRef.current as any
    if (!v) return
    // Some WebKit builds require the video to be playing before fullscreen
    if (v.paused) {
      try {
        const pp = v.play()
        if (pp && typeof pp.then === 'function') {
          pp.catch(() => {})
        }
      } catch (err) {
        // ignore
      }
    }
    if (v.requestFullscreen) {
      try {
        const p = v.requestFullscreen()
        if (p && typeof p.then === 'function') {
          p.catch(() => {})
        }
      } catch (err) {
        // ignore
      }
      return
    }
    // Try WebKit presentation mode first if available (WKWebView on macOS)
    if (typeof v.webkitSetPresentationMode === 'function') {
      try {
        v.webkitSetPresentationMode('fullscreen')
        return
      } catch (err) {
        // ignore
      }
    }
    if (typeof v.webkitEnterFullscreen === 'function') {
      try {
        v.webkitEnterFullscreen()
      } catch (err) {
        // Last-ditch: attempt presentation mode after failure
        if (typeof v.webkitSetPresentationMode === 'function') {
          try { v.webkitSetPresentationMode('fullscreen') } catch {}
        }
      }
      return
    }
    if (typeof v.webkitRequestFullscreen === 'function') {
      try {
        v.webkitRequestFullscreen()
      } catch (err) {
        // ignore
      }
      return
    }

    // Final fallback in WKWebView: fullscreen the app window and overlay the player
    try {
      WindowFullscreen()
      setWindowFsOverlay(true)
    } catch (err) {
      // ignore
    }
  }

  const exitFullscreen = () => {
    const v = videoRef.current as any
    const doc = document as any
    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        const p = document.exitFullscreen()
        if (p && typeof p.then === 'function') {
          p.catch(() => {})
        }
      } catch (err) {
        // ignore
      }
      return
    }
    if (doc.webkitExitFullscreen) {
      try { doc.webkitExitFullscreen() } catch (err) {}
      return
    }
    if (v?.webkitExitFullscreen) {
      try { v.webkitExitFullscreen() } catch (err) {}
      return
    }
    if (v?.webkitSetPresentationMode) {
      try { v.webkitSetPresentationMode('inline') } catch (err) {}
    }

    // Also handle window-level fullscreen fallback
    try {
      WindowUnfullscreen()
      setWindowFsOverlay(false)
    } catch (err) {
      // ignore
    }
  }

  const isVideoFullscreen = () => {
    const v = videoRef.current as any
    return (
      document.fullscreenElement === v ||
      (document as any).webkitFullscreenElement === v ||
      v?.webkitDisplayingFullscreen === true ||
      v?.webkitPresentationMode === 'fullscreen'
    )
  }

  const toggleFullscreen = () => {
    if (isVideoFullscreen()) exitFullscreen()
    else enterFullscreen()
  }
  
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
      enterFullscreen()
    },
    exitFullscreen: () => {
      exitFullscreen()
    },
    toggleFullscreen: () => {
      toggleFullscreen()
    },
  }))

  // Add comprehensive keyboard shortcuts (YouTube-style)
  useEffect(() => {
    if (!videoRef.current) return
    
    const video = videoRef.current
    
    // Define shortcut handlers in a systematic way
    const shortcuts: { [key: string]: (e: KeyboardEvent) => void } = {
      // Play/Pause
      'k': () => video.paused ? video.play() : video.pause(),
      ' ': () => video.paused ? video.play() : video.pause(),
      
      // Seeking
      'ArrowLeft': () => { video.currentTime = Math.max(0, video.currentTime - 5) },
      'ArrowRight': () => { video.currentTime = Math.min(video.duration || 0, video.currentTime + 5) },
      'j': () => { video.currentTime = Math.max(0, video.currentTime - 10) },
      'l': () => { video.currentTime = Math.min(video.duration || 0, video.currentTime + 10) },
      
      // Volume
      'ArrowUp': () => { video.volume = Math.min(1, video.volume + 0.05) },
      'ArrowDown': () => { video.volume = Math.max(0, video.volume - 0.05) },
      'm': () => { video.muted = !video.muted },
      
      // Fullscreen
      'f': () => toggleFullscreen(),
      'Escape': () => {
        // Close shortcuts modal if open, otherwise exit fullscreen
        if (showShortcutsModal) {
          setShowShortcutsModal(false)
        } else {
          const v = video as any
          if (document.fullscreenElement === v ||
              (document as any).webkitFullscreenElement === v ||
              v?.webkitDisplayingFullscreen === true ||
              v?.webkitPresentationMode === 'fullscreen') {
            exitFullscreen()
          }
        }
      },
      
      // Subtitles
      'c': () => {
        const tracks = video.textTracks
        if (tracks && tracks.length > 0) {
          const track = tracks[0]
          track.mode = track.mode === 'showing' ? 'hidden' : 'showing'
        }
      },
      
      // Frame by frame (when paused)
      ',': (e) => {
        if (!e.shiftKey && video.paused) {
          video.currentTime = Math.max(0, video.currentTime - (1/30))
        }
      },
      '.': (e) => {
        if (!e.shiftKey && video.paused) {
          video.currentTime = Math.min(video.duration || 0, video.currentTime + (1/30))
        }
      },
      
      // Number keys for seeking
      '0': () => { if (video.duration) video.currentTime = 0 },
      '1': () => { if (video.duration) video.currentTime = video.duration * 0.1 },
      '2': () => { if (video.duration) video.currentTime = video.duration * 0.2 },
      '3': () => { if (video.duration) video.currentTime = video.duration * 0.3 },
      '4': () => { if (video.duration) video.currentTime = video.duration * 0.4 },
      '5': () => { if (video.duration) video.currentTime = video.duration * 0.5 },
      '6': () => { if (video.duration) video.currentTime = video.duration * 0.6 },
      '7': () => { if (video.duration) video.currentTime = video.duration * 0.7 },
      '8': () => { if (video.duration) video.currentTime = video.duration * 0.8 },
      '9': () => { if (video.duration) video.currentTime = video.duration * 0.9 },
    }
    
    // Shift key combinations for playback speed and help
    const shiftShortcuts: { [key: string]: (e: KeyboardEvent) => void } = {
      ',': () => { video.playbackRate = Math.max(0.25, video.playbackRate - 0.25) },
      '<': () => { video.playbackRate = Math.max(0.25, video.playbackRate - 0.25) },
      '.': () => { video.playbackRate = Math.min(2, video.playbackRate + 0.25) },
      '>': () => { video.playbackRate = Math.min(2, video.playbackRate + 0.25) },
      '?': () => { setShowShortcutsModal(true) },
      '/': () => { setShowShortcutsModal(true) }, // Handle both ? and / since Shift+/ = ?
    }
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input (but allow if target is video)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      // Prevent default behavior for all our shortcuts
      const key = e.key.toLowerCase()
      
      // Check for shift combinations first
      if (e.shiftKey && shiftShortcuts[e.key]) {
        e.preventDefault()
        e.stopPropagation()
        shiftShortcuts[e.key](e)
        return
      }
      
      // Check regular shortcuts
      if (shortcuts[key] || shortcuts[e.key]) {
        e.preventDefault()
        e.stopPropagation()
        const handler = shortcuts[key] || shortcuts[e.key]
        handler(e)
        return
      }
    }
    
    // Add event listeners in capture phase to intercept before native controls
    const container = containerRef.current
    
    // Use capture phase for all listeners to ensure we get the event first
    if (container) {
      container.addEventListener('keydown', handleKeyDown, true)
      container.tabIndex = -1
    }
    
    if (video) {
      video.addEventListener('keydown', handleKeyDown, true)
    }
    
    // Also add to document for global shortcuts (capture phase)
    document.addEventListener('keydown', handleKeyDown, true)
    
    return () => {
      if (container) {
        container.removeEventListener('keydown', handleKeyDown, true)
      }
      if (video) {
        video.removeEventListener('keydown', handleKeyDown, true)
      }
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [showShortcutsModal])

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

  // Minimal fullscreen state syncing
  useEffect(() => {
    const v = videoRef.current as any
    const isFS = () => (
      document.fullscreenElement === v ||
      (document as any).webkitFullscreenElement === v ||
      v?.webkitDisplayingFullscreen === true ||
      v?.webkitPresentationMode === 'fullscreen'
    )
    const onStdFs = () => setIsFullscreen(isFS())
    const onBegin = () => setIsFullscreen(true)
    const onEnd = () => setIsFullscreen(false)
    const onPresentation = () => setIsFullscreen(isFS())
    document.addEventListener('fullscreenchange', onStdFs)
    v?.addEventListener?.('webkitbeginfullscreen', onBegin)
    v?.addEventListener?.('webkitendfullscreen', onEnd)
    v?.addEventListener?.('webkitpresentationmodechanged', onPresentation)
    return () => {
      document.removeEventListener('fullscreenchange', onStdFs)
      v?.removeEventListener?.('webkitbeginfullscreen', onBegin)
      v?.removeEventListener?.('webkitendfullscreen', onEnd)
      v?.removeEventListener?.('webkitpresentationmodechanged', onPresentation)
    }
  }, [])


  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black ${windowFsOverlay ? 'fixed inset-0 z-[1000]' : ''}`}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        poster={poster}
        crossOrigin="anonymous"
        playsInline
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
      {/* No overlay: allow native controls to receive clicks */}
      
      {/* Keyboard shortcuts modal */}
      <KeyboardShortcutsModal 
        isOpen={showShortcutsModal} 
        onClose={() => setShowShortcutsModal(false)} 
      />
    </div>
  )
})

VideoPlayer.displayName = 'VideoPlayer'

export default VideoPlayer
