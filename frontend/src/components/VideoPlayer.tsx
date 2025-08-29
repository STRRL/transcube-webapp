import { useEffect, useRef } from 'react'

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

export default function VideoPlayer({ src, poster, subtitles = [] }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="relative w-full h-full bg-black" ref={containerRef}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        poster={poster}
        crossOrigin="anonymous"
        playsInline
      >
        <source src={src} type="video/mp4" />
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
    </div>
  )
}